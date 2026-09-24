<?php
declare(strict_types=1);
namespace Finados;

use Closure;
use InvalidArgumentException;
use OutOfBoundsException;
use PDO;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/MfsAuth.php';

// Shares the rate-limit exception declared for the Vocero recovery flow.
require_once __DIR__ . '/VoceroPasswordReset.php';

/** Assisted recovery: plaintext tokens leave this service only in create's return value. */
final class MfsPasswordReset
{
    private readonly Closure $clock;
    private readonly Crypto $crypto;
    private readonly Audit $audit;

    public function __construct(private readonly PDO $pdo, private readonly Config $config, ?callable $clock = null)
    {
        $this->clock = $clock === null ? static fn (): int => time() : Closure::fromCallable($clock);
        $this->crypto = new Crypto($config);
        $this->audit = new Audit($pdo, $this->crypto);
    }

    public function create(string $profilePublicId, int $adminId, string $ip): string
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $profilePublicId) !== 1) throw new InvalidArgumentException();
        $ip = $this->ip($ip);
        return $this->transaction(function () use ($profilePublicId, $adminId, $ip): string {
            $admin = $this->pdo->prepare('SELECT id FROM admin_users WHERE id = ? AND active = 1' . $this->rowLock());
            $admin->execute([$adminId]);
            if ($admin->fetchColumn() === false) throw new Forbidden();
            $query = $this->pdo->prepare('SELECT a.id FROM mfs_accounts a JOIN mfs_profiles m ON m.account_id = a.id WHERE m.public_id = ? AND a.active = 1' . $this->rowLock());
            $query->execute([$profilePublicId]);
            $accountId = $query->fetchColumn();
            if ($accountId === false) throw new OutOfBoundsException();
            $now = ($this->clock)(); $at = gmdate('Y-m-d H:i:s', $now);
            $count = $this->pdo->prepare('SELECT COUNT(*) FROM mfs_password_resets WHERE account_id = ? AND created_at > ?');
            $count->execute([$accountId, gmdate('Y-m-d H:i:s', $now - 900)]);
            if ((int) $count->fetchColumn() >= 5) throw new PasswordResetRateLimit();
            $raw = bin2hex(random_bytes(32));
            $this->pdo->prepare('UPDATE mfs_password_resets SET consumed_at = ? WHERE account_id = ? AND consumed_at IS NULL')->execute([$at, $accountId]);
            $this->pdo->prepare('INSERT INTO mfs_password_resets (account_id, token_hash, expires_at, created_by_admin_id, created_at) VALUES (?, ?, ?, ?, ?)')->execute([
                $accountId, hash_hmac('sha256', $raw, $this->config->hmacKey()), gmdate('Y-m-d H:i:s', $now + 1800), $adminId, $at,
            ]);
            $this->audit->log('mfs.password_reset_created', $adminId, 'mfs_profile', $profilePublicId, [], $ip);
            return $raw;
        });
    }

    public function consume(#[\SensitiveParameter] string $token, #[\SensitiveParameter] string $password, string $ip): void
    {
        $ip = $this->ip($ip);
        MfsAuth::password($password);
        if (preg_match('/^[a-f0-9]{64}$/D', $token) !== 1) throw new InvalidArgumentException();
        $accepted = $this->transaction(function () use ($token, $password, $ip): bool {
            $now = ($this->clock)(); $at = gmdate('Y-m-d H:i:s', $now);
            $count = $this->pdo->prepare("SELECT COUNT(*) FROM audit_log WHERE event_type = 'mfs.password_reset_attempted' AND ip_hash = ? AND created_at > ?");
            $count->execute([$this->crypto->lookup($ip), gmdate('Y-m-d H:i:s', $now - 900)]);
            if ((int) $count->fetchColumn() >= 10) throw new PasswordResetRateLimit();
            // The attempt contains neither token nor its hash, even for an unknown token.
            $this->audit->log('mfs.password_reset_attempted', null, 'mfs_account', null, [], $ip);
            $query = $this->pdo->prepare('SELECT r.id, r.account_id, r.expires_at, r.consumed_at, a.public_id, a.active FROM mfs_password_resets r JOIN mfs_accounts a ON a.id = r.account_id WHERE r.token_hash = ?' . $this->rowLock());
            $query->execute([hash_hmac('sha256', $token, $this->config->hmacKey())]);
            $row = $query->fetch();
            if (!$row || (int) $row['active'] !== 1 || $row['consumed_at'] !== null || $row['expires_at'] <= $at) return false;
            // Credential version is derived from this salted hash, invalidating every earlier session.
            $hash = Auth::hashPassword($password);
            $this->pdo->prepare('UPDATE mfs_accounts SET password_hash = ?, updated_at = ? WHERE id = ?')->execute([$hash, $at, $row['account_id']]);
            $this->pdo->prepare('UPDATE mfs_password_resets SET consumed_at = ? WHERE account_id = ? AND consumed_at IS NULL')->execute([$at, $row['account_id']]);
            $this->audit->log('mfs.password_reset_consumed', null, 'mfs_account', $row['public_id'], [], $ip);
            return true;
        });
        if (!$accepted) throw new InvalidArgumentException();
    }

    private function ip(string $ip): string
    {
        $packed = inet_pton($ip);
        if ($packed === false) throw new Forbidden();
        return inet_ntop($packed);
    }

    private function rowLock(): string { return $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : ''; }

    private function transaction(callable $operation): mixed
    {
        $mysql = $this->rowLock() !== ''; $locked = false; $started = false;
        try {
            if ($mysql) {
                // Serialize the small recovery flow, including IP quota and concurrent issuances.
                $locked = true;
                $query = $this->pdo->prepare('SELECT GET_LOCK(?, 10)');
                $query->execute(['finados.mfs.password-reset']);
                if ((int) $query->fetchColumn() !== 1) throw new RuntimeException();
                $this->pdo->beginTransaction();
            } else $this->pdo->exec('BEGIN IMMEDIATE');
            $started = true;
            $result = $operation();
            if ($mysql) $this->pdo->commit(); else $this->pdo->exec('COMMIT');
            $started = false;
            return $result;
        } catch (Throwable $error) {
            if ($started) {
                try {
                    if ($mysql) { if ($this->pdo->inTransaction()) $this->pdo->rollBack(); }
                    else $this->pdo->exec('ROLLBACK');
                } catch (Throwable) {
                    // Preserve the original operation/commit failure, not its cleanup failure.
                    $this->logCleanupFailure('rollback');
                }
            }
            throw $error;
        } finally {
            if ($locked) {
                try {
                    $query = $this->pdo->prepare('SELECT RELEASE_LOCK(?)');
                    $query->execute(['finados.mfs.password-reset']);
                } catch (Throwable) {
                    // COMMIT remains authoritative. Never discard a committed token/password or
                    // mask the primary failure. Database uses nonpersistent connections: any retained
                    // named lock is released when this request's connection closes.
                    $this->logCleanupFailure('lock');
                }
            }
        }
    }

    private function logCleanupFailure(string $operation): void
    {
        // Diagnostics are best effort and contain neither exception details nor sensitive values.
        try { error_log('Finados mfs password reset ' . $operation . ' cleanup failed.'); }
        catch (Throwable) { /* Logging must not replace the transaction's confirmed outcome. */ }
    }
}
