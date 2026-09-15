<?php

declare(strict_types=1);

namespace Finados;

use RuntimeException;
use Throwable;

require_once __DIR__ . '/operations.php';

final class MissingDumpBinary extends RuntimeException {}

final class BackupCommand
{
    public static function run(array $arguments): int
    {
        $defaults = null;
        try {
            $options = Operations::options($arguments, ['--output']);
            [$config, $publicRoots] = Operations::configuration($options);
            $mysql = str_starts_with($config->databaseDsn(), 'mysql:');
            if (!$mysql && $config->isProduction()) throw new RuntimeException('Production requires MySQL.');
            $binary = $mysql ? Operations::executable('mysqldump') : null;
            if ($mysql && $binary === null) throw new MissingDumpBinary();
            $directory = Operations::datedDirectory($options['--output'], $publicRoots);
            $raw = $directory . ($mysql ? '/database.sql' : '/database.sqlite');
            if ($mysql) {
                [$database, $client] = self::mysqlClient($config);
                $defaults = $directory . '/client-' . bin2hex(random_bytes(8)) . '.cnf';
                Operations::writeExclusive($defaults, $client);
                Operations::writeExclusive($raw, '');
                $stream = fopen($raw, 'r+b');
                try {
                    // stderr is discarded deliberately: mysqldump diagnostics can contain secrets.
                    $process = proc_open([$binary, '--defaults-file=' . $defaults, '--single-transaction', '--quick',
                        '--skip-lock-tables', '--no-tablespaces', '--databases', $database],
                        [0 => ['file', '/dev/null', 'r'], 1 => $stream, 2 => ['file', '/dev/null', 'w']], $pipes,
                        null, ['PATH' => getenv('PATH') ?: '', 'LANG' => 'C']);
                    if (!is_resource($process) || proc_close($process) !== 0) throw new RuntimeException('Dump failed.');
                } finally { fclose($stream); }
            } else {
                // VACUUM INTO creates a consistent snapshot, including committed WAL contents.
                $pdo = Database::connect($config);
                $pdo->exec('VACUUM INTO ' . $pdo->quote($raw));
                if (!chmod($raw, 0600)) throw new RuntimeException('Snapshot permissions failed.');
                $snapshot = new \PDO('sqlite:' . $raw);
                if ($snapshot->query('PRAGMA integrity_check')->fetchColumn() !== 'ok') throw new RuntimeException('Invalid snapshot.');
                $snapshot = null;
            }
            clearstatcache(true, $raw);
            if (!is_file($raw) || filesize($raw) < 1) throw new RuntimeException('Empty backup.');
            $archive = $raw . '.gz';
            self::compress($raw, $archive);
            $manifest = ['file' => basename($archive), 'format' => $mysql ? 'mysql-sql-gzip' : 'sqlite-gzip',
                'created_at' => gmdate('c'), 'bytes' => filesize($archive), 'sha256' => hash_file('sha256', $archive)];
            Operations::writeExclusive($directory . '/manifest.json', json_encode($manifest, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT) . "\n");
            // Only the intermediate created by this run is removed; previous backups are untouched.
            unlink($raw);
            fwrite(STDOUT, json_encode(['backups' => 1, 'bytes' => $manifest['bytes'], 'sha256' => $manifest['sha256']]) . "\n");
            return 0;
        } catch (Throwable $error) {
            fwrite(STDERR, $error instanceof MissingDumpBinary
                ? "No está disponible mysqldump. Usa Backup Wizard de cPanel y verifica la descarga privada antes de continuar.\n"
                : "No se pudo completar el respaldo. No uses archivos sin manifiesto verificado.\n");
            return 1;
        } finally {
            if ($defaults !== null && is_file($defaults)) unlink($defaults);
        }
    }

    private static function mysqlClient(Config $config): array
    {
        $parts = [];
        foreach (explode(';', substr($config->databaseDsn(), 6)) as $part) {
            if ($part === '') continue;
            $pair = explode('=', $part, 2);
            if (count($pair) !== 2 || !in_array($pair[0], ['host', 'port', 'dbname', 'unix_socket', 'charset'], true)
                || isset($parts[$pair[0]])) throw new RuntimeException('Invalid MySQL DSN.');
            $parts[$pair[0]] = $pair[1];
        }
        $database = $parts['dbname'] ?? '';
        if (!preg_match('/^[a-zA-Z0-9_]+$/D', $database)) throw new RuntimeException('Invalid MySQL database.');
        $values = ['user' => $config->databaseUser(), 'password' => $config->databasePassword(), 'default-character-set' => $parts['charset'] ?? 'utf8mb4'];
        if (isset($parts['unix_socket'])) $values['socket'] = $parts['unix_socket'];
        else $values['host'] = $parts['host'] ?? 'localhost';
        if (isset($parts['port'])) {
            if (!ctype_digit($parts['port']) || (int) $parts['port'] < 1 || (int) $parts['port'] > 65535) throw new RuntimeException('Invalid port.');
            $values['port'] = $parts['port'];
        }
        $contents = "[client]\n";
        foreach ($values as $key => $value) {
            if (str_contains($value, "\0")) throw new RuntimeException('Invalid MySQL configuration.');
            $escaped = str_replace(['\\', '"', "\n", "\r", "\t"], ['\\\\', '\\"', '\\n', '\\r', '\\t'], $value);
            $contents .= $key . '="' . $escaped . "\"\n";
        }
        return [$database, $contents];
    }

    private static function compress(string $raw, string $archive): void
    {
        Operations::writeExclusive($archive, '');
        $input = fopen($raw, 'rb');
        $output = gzopen($archive, 'wb9');
        if ($input === false || $output === false) throw new RuntimeException('Compression unavailable.');
        try {
            while (!feof($input)) {
                $chunk = fread($input, 65536);
                if ($chunk === false || gzwrite($output, $chunk) !== strlen($chunk)) throw new RuntimeException('Compression failed.');
            }
        } finally { fclose($input); gzclose($output); }
        clearstatcache(true, $archive);
        if (filesize($archive) < 1) throw new RuntimeException('Empty backup.');
    }
}

if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    ini_set('display_errors', '0'); ini_set('log_errors', '0'); umask(0077);
    set_error_handler(static function (): never { throw new RuntimeException('Operation failed.'); });
    exit(BackupCommand::run(array_slice($argv, 1)));
}
