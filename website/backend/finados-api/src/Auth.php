<?php

declare(strict_types=1);

namespace Finados;

use Closure;
use PDO;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/Http.php';

final class Auth
{
    private readonly Closure $clock;

    public function __construct(private readonly PDO $pdo, private readonly Config $config, ?callable $clock = null)
    {
        $this->clock = $clock === null ? static fn (): int => time() : Closure::fromCallable($clock);
    }

    public function login(string $username, #[\SensitiveParameter] string $password, string $ip): array
    {
        Http::startSession($this->config);
        $now = ($this->clock)();
        // All supported login names resolve to this single account. Canonicalize also for throttling.
        $username = strtolower(trim($username));
        $usernameHash = hash_hmac('sha256', $username, $this->config->hmacKey());
        $packedIp = inet_pton($ip);
        if ($packedIp === false) {
            throw new Unauthorized('Credenciales incorrectas');
        }
        $ipHash = hash_hmac('sha256', inet_ntop($packedIp), $this->config->hmacKey());
        $sqlite = $this->pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite';
        $transactionStarted = false;
        try {
            // Serialize authentication attempts, including missing-user attempts. The sole admin row
            // is the MySQL lock; with no admin row there is no account that can be authenticated.
            if ($sqlite) { $this->pdo->exec('BEGIN IMMEDIATE'); } else { $this->pdo->beginTransaction(); }
            $transactionStarted = true;
            $statement = $this->pdo->query("SELECT * FROM admin_users WHERE username = 'admin'" . ($sqlite ? '' : ' FOR UPDATE'));
            $admin = $statement->fetch();
            $attempts = $this->pdo->prepare('SELECT succeeded, attempted_at FROM login_attempts WHERE username_hash = ? AND ip_hash = ? AND attempted_at >= ? ORDER BY attempted_at, id');
            $attempts->execute([$usernameHash, $ipHash, gmdate('Y-m-d H:i:s', $now - 1800)]);
            $blocked = $this->isBlocked($attempts->fetchAll(), $now);
            $valid = false;
            if (!$blocked) {
                // Use the real hash for absent usernames too, avoiding a fast missing-user branch.
                $hash = $admin ? $admin['password_hash'] : self::hashPassword(bin2hex(random_bytes(24)));
                $verified = password_verify($password, $hash);
                $valid = $verified && $username === 'admin' && $admin && (int) $admin['active'] === 1;
                $record = $this->pdo->prepare('INSERT INTO login_attempts (username_hash, ip_hash, succeeded, attempted_at) VALUES (?, ?, ?, ?)');
                $record->execute([$usernameHash, $ipHash, (int) $valid, gmdate('Y-m-d H:i:s', $now)]);
                if ($valid) {
                    if (password_needs_rehash($hash, self::passwordAlgorithm())) {
                        $hash = self::hashPassword($password);
                    }
                    $this->pdo->prepare('UPDATE admin_users SET password_hash = ?, last_login_at = ? WHERE id = ?')
                        ->execute([$hash, gmdate('Y-m-d H:i:s', $now), $admin['id']]);
                    $admin['password_hash'] = $hash;
                }
            }
            if ($sqlite) { $this->pdo->exec('COMMIT'); } else { $this->pdo->commit(); }
            $transactionStarted = false;
        } catch (Throwable) {
            if ($transactionStarted) {
                if ($sqlite) { $this->pdo->exec('ROLLBACK'); } elseif ($this->pdo->inTransaction()) { $this->pdo->rollBack(); }
            }
            throw new RuntimeException('No se pudo comprobar el acceso.');
        }
        if (!$valid) {
            throw new Unauthorized('Credenciales incorrectas');
        }
        if (!session_regenerate_id(true)) {
            Http::destroySession();
            throw new RuntimeException('No se pudo iniciar la sesión.');
        }
        $_SESSION = [
            'admin_id' => (int) $admin['id'], 'authenticated_at' => $now, 'last_activity' => $now,
            'credential_version' => $this->credentialVersion($admin['password_hash']),
            'csrf' => bin2hex(random_bytes(32)),
        ];
        return ['user' => $this->user($admin), 'csrf' => $_SESSION['csrf']];
    }

    public function requireUser(): array
    {
        Http::startSession($this->config);
        $now = ($this->clock)();
        if (!isset($_SESSION['admin_id'], $_SESSION['authenticated_at'], $_SESSION['last_activity'], $_SESSION['credential_version'])
            || $now - $_SESSION['last_activity'] >= 1800 || $now - $_SESSION['authenticated_at'] >= 43200
            || $now < $_SESSION['authenticated_at'] || $now < $_SESSION['last_activity']) {
            $this->logout();
            throw new Unauthorized('Sesión no disponible');
        }
        $statement = $this->pdo->prepare('SELECT id, public_id, username, active, password_hash FROM admin_users WHERE id = ?');
        $statement->execute([$_SESSION['admin_id']]);
        $admin = $statement->fetch();
        if (!$admin || $admin['username'] !== 'admin' || (int) $admin['active'] !== 1
            || !hash_equals($this->credentialVersion($admin['password_hash']), $_SESSION['credential_version'])) {
            $this->logout();
            throw new Unauthorized('Sesión no disponible');
        }
        $_SESSION['last_activity'] = $now;
        return $this->user($admin);
    }

    public function logout(): void
    {
        Http::destroySession();
    }

    public function csrfToken(): string
    {
        Http::startSession($this->config);
        if (!isset($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf'];
    }

    public function verifyCsrf(string $token): void
    {
        Http::startSession($this->config);
        if ($token === '' || !isset($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $token)) {
            throw new Forbidden('Solicitud no válida');
        }
    }

    public static function hashPassword(#[\SensitiveParameter] string $password): string
    {
        return password_hash($password, self::passwordAlgorithm());
    }

    private static function passwordAlgorithm(): string
    {
        return defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
    }

    private function credentialVersion(string $hash): string
    {
        return hash_hmac('sha256', $hash, $this->config->hmacKey());
    }

    private function user(array $admin): array
    {
        return ['id' => (int) $admin['id'], 'public_id' => $admin['public_id'], 'username' => $admin['username']];
    }

    private function isBlocked(array $attempts, int $now): bool
    {
        $failures = [];
        $blockedUntil = 0;
        foreach ($attempts as $attempt) {
            $at = strtotime($attempt['attempted_at'] . ' UTC');
            if ($at < $blockedUntil) { continue; }
            if ((int) $attempt['succeeded'] === 1) { $failures = []; continue; }
            $failures = array_values(array_filter($failures, static fn (int $failure): bool => $failure > $at - 900));
            $failures[] = $at;
            if (count($failures) >= 5) {
                $blockedUntil = $at + 900;
                $failures = [];
            }
        }
        return $now < $blockedUntil;
    }
}
