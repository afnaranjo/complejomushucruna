<?php

declare(strict_types=1);

namespace Finados;

use Closure;
use InvalidArgumentException;
use PDO;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/Crypto.php';
require_once __DIR__ . '/Audit.php';

final class VoceroAuth
{
    private readonly Closure $clock;
    private readonly Crypto $crypto;
    private readonly Audit $audit;
    private readonly array $accountConsent;

    public function __construct(private readonly PDO $pdo, private readonly Config $config, ?callable $clock = null)
    {
        $this->clock = $clock === null ? static fn (): int => time() : Closure::fromCallable($clock);
        $this->crypto = new Crypto($config);
        $this->audit = new Audit($pdo, $this->crypto);
        $this->accountConsent = self::accountConsent();
    }

    public function register(string $email, #[\SensitiveParameter] string $password, bool $privacyAcknowledged, string $ip): array
    {
        $email = self::email($email);
        self::password($password);
        if (!$privacyAcknowledged) throw new InvalidArgumentException('Debes confirmar la lectura de la Política de Privacidad.');
        $this->ipHash($ip);
        $now = ($this->clock)();
        $nowText = gmdate('Y-m-d H:i:s', $now);
        $emailIndex = $this->crypto->lookup($email);
        $account = [
            'public_id' => bin2hex(random_bytes(16)),
            'email_enc' => $this->crypto->encrypt($email),
            'email_idx' => $emailIndex,
            'password_hash' => Auth::hashPassword($password),
            'privacy_version' => $this->accountConsent['version'],
            'privacy_hash' => hash('sha256', $this->accountConsent['text']),
            'privacy_acknowledged_at' => $nowText,
            'created_at' => $nowText,
            'updated_at' => $nowText,
        ];
        $transactionStarted = false;
        try {
            $this->begin();
            $transactionStarted = true;
            $insert = $this->pdo->prepare('INSERT INTO vocero_accounts (public_id, email_enc, email_idx, password_hash, privacy_version, privacy_hash, privacy_acknowledged_at, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)');
            $insert->execute([
                $account['public_id'], $account['email_enc'], $account['email_idx'], $account['password_hash'],
                $account['privacy_version'], $account['privacy_hash'], $account['privacy_acknowledged_at'],
                $account['created_at'], $account['updated_at'],
            ]);
            $account['id'] = (int) $this->pdo->lastInsertId();
            $this->audit->log('vocero_account.registered', null, 'vocero_account', $account['public_id'], [], $ip);
            $this->commit();
            $transactionStarted = false;
        } catch (\PDOException $error) {
            if ($transactionStarted) $this->rollBack();
            if (!$this->isEmailDuplicateViolation($error)) throw $error;
        }
        // The caller receives the same opaque result for a fresh or duplicate account, without a session.
        return [];
    }

    public function login(string $email, #[\SensitiveParameter] string $password, string $ip): array
    {
        Http::startSession($this->config, 'vocero');
        $email = self::email($email);
        $ipHash = $this->ipHash($ip);
        $emailIndex = $this->crypto->lookup($email);
        $now = ($this->clock)();
        $transactionStarted = false;
        try {
            $this->begin();
            $transactionStarted = true;
            $sqlite = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
            $statement = $this->pdo->prepare('SELECT * FROM vocero_accounts WHERE email_idx = ?' . ($sqlite ? '' : ' FOR UPDATE'));
            $statement->execute([$emailIndex]);
            $account = $statement->fetch();
            $emailAttempts = $this->pdo->prepare('SELECT succeeded, attempted_at FROM vocero_login_attempts WHERE email_idx = ? AND attempted_at >= ? ORDER BY attempted_at, id');
            $emailAttempts->execute([$emailIndex, gmdate('Y-m-d H:i:s', $now - 1800)]);
            $ipAttempts = $this->pdo->prepare('SELECT succeeded, attempted_at FROM vocero_login_attempts WHERE ip_hash = ? AND attempted_at >= ? ORDER BY attempted_at, id');
            $ipAttempts->execute([$ipHash, gmdate('Y-m-d H:i:s', $now - 1800)]);
            $blocked = $this->isBlocked($emailAttempts->fetchAll(), $now) || $this->isBlocked($ipAttempts->fetchAll(), $now);
            $valid = false;
            if (!$blocked) {
                $hash = $account ? $account['password_hash'] : Auth::dummyPasswordHash();
                $verified = password_verify($password, $hash);
                $valid = $verified && $account && (int) $account['active'] === 1;
                $record = $this->pdo->prepare('INSERT INTO vocero_login_attempts (email_idx, ip_hash, succeeded, attempted_at) VALUES (?, ?, ?, ?)');
                $record->execute([$emailIndex, $ipHash, (int) $valid, gmdate('Y-m-d H:i:s', $now)]);
                if ($valid) {
                    if (Auth::needsPasswordRehash($hash)) $hash = Auth::hashPassword($password);
                    $this->pdo->prepare('UPDATE vocero_accounts SET password_hash = ?, last_login_at = ?, updated_at = ? WHERE id = ?')
                        ->execute([$hash, gmdate('Y-m-d H:i:s', $now), gmdate('Y-m-d H:i:s', $now), $account['id']]);
                    $account['password_hash'] = $hash;
                }
            }
            $this->commit();
            $transactionStarted = false;
        } catch (Throwable) {
            if ($transactionStarted) $this->rollBack();
            throw new RuntimeException('No se pudo comprobar el acceso.');
        }
        if (!$valid) throw new Unauthorized('Credenciales incorrectas');
        return $this->start($account, $email, $now);
    }

    public function requireUser(): array
    {
        Http::startSession($this->config, 'vocero');
        $now = ($this->clock)();
        if (!isset($_SESSION['vocero_account_id'], $_SESSION['authenticated_at'], $_SESSION['last_activity'], $_SESSION['credential_version'])
            || $now - $_SESSION['last_activity'] >= 1800 || $now - $_SESSION['authenticated_at'] >= 43200
            || $now < $_SESSION['authenticated_at'] || $now < $_SESSION['last_activity']) {
            $this->logout();
            throw new Unauthorized('Sesión no disponible');
        }
        $statement = $this->pdo->prepare('SELECT id, public_id, email_enc, active, password_hash FROM vocero_accounts WHERE id = ?');
        $statement->execute([$_SESSION['vocero_account_id']]);
        $account = $statement->fetch();
        if (!$account || (int) $account['active'] !== 1 || !hash_equals($this->credentialVersion($account['password_hash']), $_SESSION['credential_version'])) {
            $this->logout();
            throw new Unauthorized('Sesión no disponible');
        }
        $_SESSION['last_activity'] = $now;
        return $this->user($account);
    }

    public function logout(): void
    {
        Http::startSession($this->config, 'vocero');
        Http::destroySession();
    }

    public function csrfToken(): string
    {
        Http::startSession($this->config, 'vocero');
        if (!isset($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
        return $_SESSION['csrf'];
    }

    public function verifyCsrf(string $token): void
    {
        Http::startSession($this->config, 'vocero');
        if ($token === '' || !isset($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $token)) {
            throw new Forbidden('Solicitud no válida');
        }
    }

    private function start(array $account, string $email, int $now): array
    {
        if (!session_regenerate_id(true)) {
            Http::destroySession();
            throw new RuntimeException('No se pudo iniciar la sesión.');
        }
        $_SESSION = [
            'vocero_account_id' => (int) $account['id'], 'authenticated_at' => $now, 'last_activity' => $now,
            'credential_version' => $this->credentialVersion($account['password_hash']), 'csrf' => bin2hex(random_bytes(32)),
        ];
        return ['user' => ['id' => (int) $account['id'], 'public_id' => $account['public_id'], 'email' => $email, 'role' => 'vocero'], 'csrf' => $_SESSION['csrf']];
    }

    private static function accountConsent(): array
    {
        $path = __DIR__ . '/../resources/vocero-consents.json';
        try {
            $catalogue = json_decode((string) file_get_contents($path), true, 16, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            throw new RuntimeException('No se pudo cargar el consentimiento de cuenta.');
        }
        $account = $catalogue['account'] ?? null;
        if (!is_array($account) || !is_string($account['version'] ?? null) || !is_string($account['text'] ?? null)) {
            throw new RuntimeException('No se pudo cargar el consentimiento de cuenta.');
        }
        return $account;
    }

    private static function email(string $email): string
    {
        $email = strtolower(trim($email));
        if (strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('Correo electrónico no válido.');
        }
        return $email;
    }

    private static function password(string $password): void
    {
        if (strlen($password) < 10 || strlen($password) > 128 || preg_match('//u', $password) !== 1) {
            throw new InvalidArgumentException('Contraseña no válida.');
        }
    }

    private function ipHash(string $ip): string
    {
        $packed = inet_pton($ip);
        if ($packed === false) throw new Unauthorized('Credenciales incorrectas');
        return $this->crypto->lookup(inet_ntop($packed));
    }

    private function begin(): void
    {
        if ($this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') $this->pdo->exec('BEGIN IMMEDIATE');
        else $this->pdo->beginTransaction();
    }

    private function commit(): void
    {
        if ($this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') $this->pdo->exec('COMMIT');
        else $this->pdo->commit();
    }

    private function rollBack(): void
    {
        if ($this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') $this->pdo->exec('ROLLBACK');
        elseif ($this->pdo->inTransaction()) $this->pdo->rollBack();
    }

    private function credentialVersion(string $hash): string
    {
        return hash_hmac('sha256', $hash, $this->config->hmacKey());
    }

    private function user(array $account): array
    {
        return ['id' => (int) $account['id'], 'public_id' => $account['public_id'], 'email' => $this->crypto->decrypt($account['email_enc']), 'role' => 'vocero'];
    }

    private function isBlocked(array $attempts, int $now): bool
    {
        $failures = [];
        $blockedUntil = 0;
        foreach ($attempts as $attempt) {
            $at = strtotime($attempt['attempted_at'] . ' UTC');
            if ($at < $blockedUntil) continue;
            if ((int) $attempt['succeeded'] === 1) continue;
            $failures = array_values(array_filter($failures, static fn (int $failure): bool => $failure > $at - 900));
            $failures[] = $at;
            if (count($failures) >= 5) { $blockedUntil = $at + 900; $failures = []; }
        }
        return $now < $blockedUntil;
    }

    private function isEmailDuplicateViolation(\PDOException $error): bool
    {
        $driver = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        if ($driver === 'sqlite') {
            return in_array((string) $error->getCode(), ['19', '23000'], true)
                && preg_match('/UNIQUE constraint failed: vocero_accounts\\.email_idx$/D', $error->getMessage()) === 1;
        }
        $info = $error->errorInfo;
        return $driver === 'mysql'
            && (int) ($info[1] ?? 0) === 1062
            && self::isMySqlEmailDuplicateMessage((string) ($info[2] ?? ''));
    }

    private static function isMySqlEmailDuplicateMessage(string $message): bool
    {
        return preg_match("/for key ['`](?:email_idx|vocero_accounts\\.email_idx)['`]$/D", $message) === 1;
    }
}
