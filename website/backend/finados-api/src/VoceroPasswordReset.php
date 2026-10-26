<?php
declare(strict_types=1);
namespace Finados;

use Closure;
use InvalidArgumentException;
use OutOfBoundsException;
use PDO;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/VoceroAuth.php';

final class PasswordResetRateLimit extends RuntimeException {}
final class RecoveryMismatch extends RuntimeException {}

/** Assisted recovery: plaintext tokens leave this service only in create's return value. */
final class VoceroPasswordReset
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

    public function create(string $voceroPublicId, int $adminId, string $ip): string
    {
        if (preg_match('/^[a-f0-9]{32}$/D', $voceroPublicId) !== 1) throw new InvalidArgumentException();
        $ip = $this->ip($ip);
        return $this->transaction(function () use ($voceroPublicId, $adminId, $ip): string {
            $admin = $this->pdo->prepare('SELECT id FROM admin_users WHERE id = ? AND active = 1' . $this->rowLock());
            $admin->execute([$adminId]);
            if ($admin->fetchColumn() === false) throw new Forbidden();
            $query = $this->pdo->prepare('SELECT a.id FROM vocero_accounts a JOIN vocero_account_links l ON l.account_id = a.id JOIN voceros v ON v.id = l.vocero_id WHERE v.public_id = ? AND a.active = 1' . $this->rowLock());
            $query->execute([$voceroPublicId]);
            $accountId = $query->fetchColumn();
            if ($accountId === false) throw new OutOfBoundsException();
            $now = ($this->clock)(); $at = gmdate('Y-m-d H:i:s', $now);
            $count = $this->pdo->prepare('SELECT COUNT(*) FROM vocero_password_resets WHERE account_id = ? AND created_at > ?');
            $count->execute([$accountId, gmdate('Y-m-d H:i:s', $now - 900)]);
            if ((int) $count->fetchColumn() >= 5) throw new PasswordResetRateLimit();
            $raw = bin2hex(random_bytes(32));
            $this->pdo->prepare('UPDATE vocero_password_resets SET consumed_at = ? WHERE account_id = ? AND consumed_at IS NULL')->execute([$at, $accountId]);
            $this->pdo->prepare('INSERT INTO vocero_password_resets (account_id, token_hash, expires_at, created_by_admin_id, created_at) VALUES (?, ?, ?, ?, ?)')->execute([
                $accountId, hash_hmac('sha256', $raw, $this->config->hmacKey()), gmdate('Y-m-d H:i:s', $now + 1800), $adminId, $at,
            ]);
            $this->audit->log('vocero.password_reset_created', $adminId, 'vocero', $voceroPublicId, [], $ip);
            return $raw;
        });
    }

    public function consume(#[\SensitiveParameter] string $token, #[\SensitiveParameter] string $password, string $ip): void
    {
        $ip = $this->ip($ip);
        VoceroAuth::password($password);
        if (preg_match('/^[a-f0-9]{64}$/D', $token) !== 1) throw new InvalidArgumentException();
        $accepted = $this->transaction(function () use ($token, $password, $ip): bool {
            $now = ($this->clock)(); $at = gmdate('Y-m-d H:i:s', $now);
            $count = $this->pdo->prepare("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero.password_reset_attempted' AND ip_hash = ? AND created_at > ?");
            $count->execute([$this->crypto->lookup($ip), gmdate('Y-m-d H:i:s', $now - 900)]);
            if ((int) $count->fetchColumn() >= 10) throw new PasswordResetRateLimit();
            // The attempt contains neither token nor its hash, even for an unknown token.
            $this->audit->log('vocero.password_reset_attempted', null, 'vocero_account', null, [], $ip);
            $query = $this->pdo->prepare('SELECT r.id, r.account_id, r.expires_at, r.consumed_at, a.public_id, a.active FROM vocero_password_resets r JOIN vocero_accounts a ON a.id = r.account_id JOIN vocero_account_links l ON l.account_id = a.id WHERE r.token_hash = ?' . $this->rowLock());
            $query->execute([hash_hmac('sha256', $token, $this->config->hmacKey())]);
            $row = $query->fetch();
            if (!$row || (int) $row['active'] !== 1 || $row['consumed_at'] !== null || $row['expires_at'] <= $at) return false;
            // Credential version is derived from this salted hash, invalidating every earlier session.
            $hash = Auth::hashPassword($password);
            $this->pdo->prepare('UPDATE vocero_accounts SET password_hash = ?, updated_at = ? WHERE id = ?')->execute([$hash, $at, $row['account_id']]);
            $this->pdo->prepare('UPDATE vocero_password_resets SET consumed_at = ? WHERE account_id = ? AND consumed_at IS NULL')->execute([$at, $row['account_id']]);
            $this->audit->log('vocero.password_reset_consumed', null, 'vocero_account', $row['public_id'], [], $ip);
            return true;
        });
        if (!$accepted) throw new InvalidArgumentException();
    }

    /**
     * Self-service recovery: the vocero proves who it is with the e-mail of its account plus the cédula
     * and WhatsApp of its own record, and sets a new password at once. A mismatch never says which datum failed.
     */
    public function selfRecover(string $email, string $cedula, string $whatsapp, #[\SensitiveParameter] string $password, string $ip): void
    {
        $ip = $this->ip($ip);
        VoceroAuth::password($password);
        $email = strtolower(trim($email));
        $cedula = preg_replace('/\D/', '', $cedula) ?? '';
        $whatsapp = preg_replace('/\D/', '', $whatsapp) ?? '';
        if (str_starts_with($whatsapp, '593') && strlen($whatsapp) === 12) $whatsapp = '0' . substr($whatsapp, 3);
        if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false || preg_match('/^\d{10}$/D', $cedula) !== 1 || preg_match('/^09\d{8}$/D', $whatsapp) !== 1) throw new InvalidArgumentException();
        $accepted = $this->transaction(function () use ($email, $cedula, $whatsapp, $password, $ip): bool {
            $now = ($this->clock)(); $at = gmdate('Y-m-d H:i:s', $now);
            $count = $this->pdo->prepare("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero.password_self_reset_attempted' AND ip_hash = ? AND created_at > ?");
            $count->execute([$this->crypto->lookup($ip), gmdate('Y-m-d H:i:s', $now - 900)]);
            if ((int) $count->fetchColumn() >= 8) throw new PasswordResetRateLimit();
            $this->audit->log('vocero.password_self_reset_attempted', null, 'vocero_account', null, [], $ip);
            $query = $this->pdo->prepare('SELECT a.id, a.public_id FROM vocero_accounts a JOIN vocero_account_links l ON l.account_id = a.id JOIN voceros v ON v.id = l.vocero_id WHERE a.email_idx = ? AND a.active = 1 AND v.cedula_idx = ? AND v.whatsapp_idx IN (?, ?, ?) AND v.status <> ?' . $this->rowLock());
            // El WhatsApp pudo guardarse como 09…, +5939… o 5939…: se aceptan las tres escrituras del mismo número.
            $local = substr($whatsapp, 1);
            $query->execute([$this->crypto->lookup($email), $this->crypto->lookup($cedula), $this->crypto->lookup($whatsapp), $this->crypto->lookup('+593' . $local), $this->crypto->lookup('593' . $local), 'Eliminado']);
            $row = $query->fetch();
            if (!$row) return false;
            // Changing the hash changes the credential version: every earlier session is closed.
            $this->pdo->prepare('UPDATE vocero_accounts SET password_hash = ?, updated_at = ? WHERE id = ?')->execute([Auth::hashPassword($password), $at, $row['id']]);
            $this->pdo->prepare('UPDATE vocero_password_resets SET consumed_at = ? WHERE account_id = ? AND consumed_at IS NULL')->execute([$at, $row['id']]);
            $this->audit->log('vocero.password_self_reset', null, 'vocero_account', $row['public_id'], [], $ip);
            return true;
        });
        if (!$accepted) throw new RecoveryMismatch();
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
                $query->execute(['finados.voceros.password-reset']);
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
                    $query->execute(['finados.voceros.password-reset']);
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
        try { error_log('Finados password reset ' . $operation . ' cleanup failed.'); }
        catch (Throwable) { /* Logging must not replace the transaction's confirmed outcome. */ }
    }
}
