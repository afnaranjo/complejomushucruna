<?php

declare(strict_types=1);

namespace Finados;

use RuntimeException;
use Throwable;

require_once __DIR__ . '/../src/Config.php';
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Auth.php';

final class AdminCommand
{
    /** IO injection is an in-process seam. The executable exposes no password option or env input. */
    public static function run(array $arguments, callable $readSecret, callable $write): int
    {
        $password = $confirmation = '';
        $pdo = null;
        try {
            $options = self::options($arguments);
            $config = isset($options['--config'])
                ? Config::fromFile($options['--config']) : Config::fromProductionEnvironment();
            // --config is only a local test fixture path. Production always uses the validated env entry.
            if (isset($options['--config']) && $config->isProduction()) {
                throw new RuntimeException('Invalid configuration mode.');
            }
            $pdo = Database::connect($config);
            $password = $readSecret();
            $confirmation = $readSecret();
            $characters = preg_match_all('/./us', $password);
            // The shared 72-byte upper bound prevents bcrypt truncation on fallback runtimes.
            if ($characters === false || $characters < 14 || strlen($password) > 72
                || str_contains($password, "\0") || !hash_equals($password, $confirmation)) {
                throw new RuntimeException('Invalid password.');
            }
            $hash = Auth::hashPassword($password);
            $pdo->beginTransaction();
            $sqlite = $pdo->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'sqlite';
            $existing = $pdo->query("SELECT id FROM admin_users WHERE username = 'admin'" . ($sqlite ? '' : ' FOR UPDATE'))->fetch();
            $now = gmdate('Y-m-d H:i:s');
            if ($existing) {
                $pdo->prepare('UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE id = ?')->execute([$hash, $now, $existing['id']]);
            } else {
                $pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
                    ->execute([bin2hex(random_bytes(16)), 'admin', $hash, $now, $now]);
            }
            $pdo->commit();
            $write($existing ? "Contraseña de admin actualizada\n" : "Usuario admin creado\n");
            return 0;
        } catch (Throwable) {
            if ($pdo !== null && $pdo->inTransaction()) { $pdo->rollBack(); }
            $write("No se pudo configurar admin\n");
            return 1;
        } finally {
            if (function_exists('sodium_memzero')) {
                sodium_memzero($password);
                sodium_memzero($confirmation);
            }
        }
    }

    private static function options(array $arguments): array
    {
        $options = [];
        for ($i = 0; $i < count($arguments); $i += 2) {
            $key = $arguments[$i];
            if (!in_array($key, ['--username', '--config'], true) || isset($options[$key])
                || !isset($arguments[$i + 1]) || !is_string($arguments[$i + 1])) {
                throw new RuntimeException('Invalid arguments.');
            }
            $options[$key] = $arguments[$i + 1];
        }
        if (($options['--username'] ?? null) !== 'admin') { throw new RuntimeException('Invalid username.'); }
        return $options;
    }
}

final class HiddenPasswordReader
{
    public static function read(): string
    {
        if (PHP_SAPI !== 'cli' || !stream_isatty(STDIN)) {
            throw new RuntimeException('An interactive terminal is required.');
        }
        $previous = trim(self::terminal(['-g']));
        if ($previous === '' || preg_match('/^[a-zA-Z0-9:;= ]+$/D', $previous) !== 1) {
            throw new RuntimeException('Terminal state is unavailable.');
        }
        $restore = static function () use ($previous): void { self::terminal([$previous]); };
        $handlers = [];
        $async = null;
        if (function_exists('pcntl_signal') && function_exists('pcntl_async_signals')) {
            $async = pcntl_async_signals(true);
            foreach ([SIGINT, SIGTERM, SIGHUP] as $signal) {
                $handlers[$signal] = pcntl_signal_get_handler($signal);
                pcntl_signal($signal, static function (): never { throw new RuntimeException('Input interrupted.'); });
            }
        }
        $restored = false;
        register_shutdown_function(static function () use (&$restored, $restore): void {
            if (!$restored) { $restore(); }
        });
        try {
            self::terminal(['-echo']);
            $line = fgets(STDIN, 4098);
            if ($line === false || !str_ends_with($line, "\n")) {
                throw new RuntimeException('Input unavailable.');
            }
            return rtrim($line, "\r\n");
        } finally {
            $restore();
            $restored = true;
            foreach ($handlers as $signal => $handler) { pcntl_signal($signal, $handler); }
            if ($async !== null) { pcntl_async_signals($async); }
        }
    }

    private static function terminal(array $arguments): string
    {
        $pipes = [];
        $process = proc_open(['stty', ...$arguments], [0 => STDIN, 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
        if (!is_resource($process)) { throw new RuntimeException('Terminal control unavailable.'); }
        $output = stream_get_contents($pipes[1]);
        stream_get_contents($pipes[2]);
        fclose($pipes[1]); fclose($pipes[2]);
        if (proc_close($process) !== 0 || $output === false) { throw new RuntimeException('Terminal control unavailable.'); }
        return $output;
    }
}

if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    // Suppress detailed diagnostics at this sensitive boundary; all failures have one generic output.
    ini_set('display_errors', '0');
    ini_set('log_errors', '0');
    exit(AdminCommand::run(array_slice($argv, 1), [HiddenPasswordReader::class, 'read'],
        static fn (string $message) => fwrite(STDOUT, $message)));
}
