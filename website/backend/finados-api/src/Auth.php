<?php

declare(strict_types=1);

namespace Finados;

use Closure;
use PDO;
use RuntimeException;
use Throwable;

require_once __DIR__ . '/Http.php';
require_once __DIR__ . '/AdminUsers.php';

final class Auth
{
    private readonly Closure $clock;
    private const BCRYPT_SHA384_PREFIX = 'bcrypt-sha384$v1$';
    private const DUMMY_ARGON2ID_HASH = '$argon2id$v=19$m=65536,t=4,p=1$cXdlcnR5dWlvcGFzZGZoZw$3OsG3gSTK7Hy28lbd1VbgtMAxaDPPlWTYy25ioTGJwA';
    private const DUMMY_BCRYPT_HASH = '$2y$12$N7H6WSb3fDyozFDIRLI3QuSiJ6Y9KohPpm2HnWgEkiIIwNpWhJaNG';

    public function __construct(private readonly PDO $pdo, private readonly Config $config, ?callable $clock = null)
    {
        $this->clock = $clock === null ? static fn (): int => time() : Closure::fromCallable($clock);
    }

    public function login(string $username, #[\SensitiveParameter] string $password, string $ip): array
    {
        Http::startSession($this->config, 'admin');
        $now = ($this->clock)();
        // Cada persona entra con su propia cuenta. Se canonicaliza también para el control de intentos.
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
            // Serialize authentication attempts for the account being tried. A name that does not
            // exist locks nothing and can never authenticate.
            if ($sqlite) { $this->pdo->exec('BEGIN IMMEDIATE'); } else { $this->pdo->beginTransaction(); }
            $transactionStarted = true;
            $statement = $this->pdo->prepare('SELECT * FROM admin_users WHERE username = ?' . ($sqlite ? '' : ' FOR UPDATE'));
            $statement->execute([$username]);
            $admin = $statement->fetch();
            $attempts = $this->pdo->prepare('SELECT succeeded, attempted_at FROM login_attempts WHERE username_hash = ? AND ip_hash = ? AND attempted_at >= ? ORDER BY attempted_at, id');
            $attempts->execute([$usernameHash, $ipHash, gmdate('Y-m-d H:i:s', $now - 1800)]);
            $blocked = $this->isBlocked($attempts->fetchAll(), $now);
            $valid = false;
            if (!$blocked) {
                // Use the real hash for absent usernames too, avoiding a fast missing-user branch.
                $hash = $admin ? $admin['password_hash'] : self::dummyPasswordHash();
                $verified = self::verifyPassword($password, $hash);
                $valid = $verified && $admin && $admin['username'] === $username && (int) $admin['active'] === 1;
                $record = $this->pdo->prepare('INSERT INTO login_attempts (username_hash, ip_hash, succeeded, attempted_at) VALUES (?, ?, ?, ?)');
                $record->execute([$usernameHash, $ipHash, (int) $valid, gmdate('Y-m-d H:i:s', $now)]);
                if ($valid) {
                    if (self::needsPasswordRehash($hash)) {
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
        Http::startSession($this->config, 'admin');
        $now = ($this->clock)();
        if (!isset($_SESSION['admin_id'], $_SESSION['authenticated_at'], $_SESSION['last_activity'], $_SESSION['credential_version'])
            || $now - $_SESSION['last_activity'] >= 1800 || $now - $_SESSION['authenticated_at'] >= 43200
            || $now < $_SESSION['authenticated_at'] || $now < $_SESSION['last_activity']) {
            $this->logout();
            throw new Unauthorized('Sesión no disponible');
        }
        $statement = $this->pdo->prepare('SELECT * FROM admin_users WHERE id = ?');
        $statement->execute([$_SESSION['admin_id']]);
        $admin = $statement->fetch();
        // Desactivar la cuenta o cambiar su contraseña corta la sesión en la siguiente petición.
        if (!$admin || (int) $admin['active'] !== 1
            || !hash_equals($this->credentialVersion($admin['password_hash']), $_SESSION['credential_version'])) {
            $this->logout();
            throw new Unauthorized('Sesión no disponible');
        }
        $_SESSION['last_activity'] = $now;
        return $this->user($admin);
    }

    public function logout(): void
    {
        Http::startSession($this->config, 'admin');
        Http::destroySession();
    }

    public function csrfToken(): string
    {
        Http::startSession($this->config, 'admin');
        if (!isset($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf'];
    }

    public function verifyCsrf(string $token): void
    {
        Http::startSession($this->config, 'admin');
        if ($token === '' || !isset($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $token)) {
            throw new Forbidden('Solicitud no válida');
        }
    }

    public static function hashPassword(#[\SensitiveParameter] string $password): string
    {
        if (defined('PASSWORD_ARGON2ID')) {
            return password_hash($password, PASSWORD_ARGON2ID, self::passwordOptions());
        }

        // Bcrypt truncates its input after 72 bytes. A versioned, base64-encoded SHA-384
        // prehash binds every byte while keeping the bcrypt input to a fixed 64 ASCII bytes.
        return self::BCRYPT_SHA384_PREFIX . password_hash(
            self::bcryptPrehash($password),
            PASSWORD_BCRYPT,
            self::passwordOptions(),
        );
    }

    public static function verifyPassword(#[\SensitiveParameter] string $password, string $hash): bool
    {
        if (str_starts_with($hash, self::BCRYPT_SHA384_PREFIX)) {
            $bcryptHash = substr($hash, strlen(self::BCRYPT_SHA384_PREFIX));
            if ((password_get_info($bcryptHash)['algoName'] ?? 'unknown') !== 'bcrypt') {
                return false;
            }
            return password_verify(self::bcryptPrehash($password), $bcryptHash);
        }

        $algorithm = password_get_info($hash)['algoName'] ?? 'unknown';
        if (!in_array($algorithm, ['bcrypt', 'argon2id'], true)) {
            return false;
        }
        return password_verify($password, $hash);
    }

    public static function passwordAlgorithm(): string
    {
        return defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT;
    }

    public static function passwordOptions(): array
    {
        return defined('PASSWORD_ARGON2ID')
            ? ['memory_cost' => 65536, 'time_cost' => 4, 'threads' => 1]
            : ['cost' => 12];
    }

    public static function needsPasswordRehash(string $hash): bool
    {
        if (str_starts_with($hash, self::BCRYPT_SHA384_PREFIX)) {
            $bcryptHash = substr($hash, strlen(self::BCRYPT_SHA384_PREFIX));
            if ((password_get_info($bcryptHash)['algoName'] ?? 'unknown') !== 'bcrypt') {
                return true;
            }
            return defined('PASSWORD_ARGON2ID')
                || password_needs_rehash($bcryptHash, PASSWORD_BCRYPT, self::passwordOptions());
        }

        $algorithm = password_get_info($hash)['algoName'] ?? 'unknown';
        if ($algorithm === 'bcrypt') {
            // Every legacy bcrypt credential is upgraded to the non-truncating versioned scheme
            // (or Argon2id) after its next successful verification.
            return true;
        }
        if ($algorithm === 'argon2id' && defined('PASSWORD_ARGON2ID')) {
            return password_needs_rehash($hash, PASSWORD_ARGON2ID, self::passwordOptions());
        }
        // Never downgrade a valid Argon2id hash on a runtime that cannot generate it.
        return $algorithm !== 'argon2id';
    }

    public static function dummyPasswordHash(): string
    {
        return defined('PASSWORD_ARGON2ID')
            ? self::DUMMY_ARGON2ID_HASH
            : self::BCRYPT_SHA384_PREFIX . self::DUMMY_BCRYPT_HASH;
    }

    private static function bcryptPrehash(#[\SensitiveParameter] string $password): string
    {
        return base64_encode(hash('sha384', $password, true));
    }

    private function credentialVersion(string $hash): string
    {
        return hash_hmac('sha256', $hash, $this->config->hmacKey());
    }

    /** La persona en sesión con su rol y sus módulos; el rol se lee en cada petición, así un cambio rige de inmediato. */
    private function user(array $admin): array
    {
        $role = null;
        if (($admin['role_id'] ?? null) !== null) {
            $statement = $this->pdo->prepare('SELECT name, modules FROM admin_roles WHERE id = ?');
            $statement->execute([$admin['role_id']]);
            $role = $statement->fetch(PDO::FETCH_ASSOC) ?: null;
        }
        return AdminUsers::describe($admin, $role);
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
