<?php

declare(strict_types=1);

namespace Finados;

use RuntimeException;

final class Unauthorized extends RuntimeException
{
}

final class Forbidden extends RuntimeException
{
}

final class Http
{
    public static function startSession(Config $config, string $scope = 'admin'): void
    {
        [$name, $sameSite] = match ($scope) {
            'admin' => ['finados_admin', 'Strict'],
            'vocero' => ['finados_vocero', 'Lax'],
            default => throw new RuntimeException('Ámbito de sesión no válido.'),
        };
        if (session_status() === PHP_SESSION_ACTIVE) {
            if (session_name() !== $name) throw new RuntimeException('Ámbito de sesión incompatible.');
            return;
        }
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.use_trans_sid', '0');
        // Application checks enforce idle/absolute expiry; do not let PHP's 24-minute default win.
        ini_set('session.gc_maxlifetime', '43200');
        session_name($name);
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'domain' => '',
            'secure' => $config->isProduction(),
            'httponly' => true,
            'samesite' => $sameSite,
        ]);
        session_cache_limiter('nocache');
        if (!session_start()) {
            throw new RuntimeException('No se pudo iniciar la sesión.');
        }
    }

    public static function destroySession(): void
    {
        if (session_status() !== PHP_SESSION_ACTIVE) {
            return;
        }
        $_SESSION = [];
        $cookie = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires' => 1, 'path' => $cookie['path'], 'domain' => '',
            'secure' => $cookie['secure'], 'httponly' => true, 'samesite' => $cookie['samesite'] ?? 'Strict',
        ]);
        session_destroy();
        session_id('');
    }
}
