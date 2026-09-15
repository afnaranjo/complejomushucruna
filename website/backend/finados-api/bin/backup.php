<?php

declare(strict_types=1);

namespace Finados;

use RuntimeException;
use Throwable;

require_once __DIR__ . '/operations.php';
require_once __DIR__ . '/../src/Crypto.php';
require_once __DIR__ . '/../src/PhotoStorage.php';
require_once __DIR__ . '/../src/VoceroMediaLock.php';

final class MissingDumpBinary extends RuntimeException {}

final class BackupCommand
{
    public static function run(array $arguments): int
    {
        $defaults = null;
        $directory = null;
        $lease = null;
        $complete = false;
        try {
            $options = Operations::options($arguments, ['--output']);
            [$config, $publicRoots] = Operations::configuration($options);
            $mysql = str_starts_with($config->databaseDsn(), 'mysql:');
            if (!$mysql && $config->isProduction()) throw new RuntimeException('Production requires MySQL.');
            $binary = $mysql ? Operations::executable('mysqldump') : null;
            if ($mysql && $binary === null) throw new MissingDumpBinary();
            $pdo = Database::connect($config);
            $lease = VoceroMediaLock::acquire($pdo, $config);
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
            $database = ['file' => basename($archive), 'format' => $mysql ? 'mysql-sql-gzip' : 'sqlite-gzip',
                'bytes' => filesize($archive), 'sha256' => hash_file('sha256', $archive)];
            $photos = self::photos($pdo, $config, $directory);
            if ($mysql && (int) $pdo->query("SELECT IS_USED_LOCK('finados.voceros.media') = CONNECTION_ID()")->fetchColumn() !== 1) {
                throw new RuntimeException('Media snapshot lock was lost.');
            }
            // Only the intermediate created by this run is removed; previous backups are untouched.
            unlink($raw);
            if ($defaults !== null) { unlink($defaults); $defaults = null; }
            $manifest = ['version' => 2, 'created_at' => gmdate('c'), 'database' => $database, 'photos' => $photos];
            $manifestText = json_encode($manifest, JSON_THROW_ON_ERROR | JSON_PRETTY_PRINT) . "\n";
            Operations::writeExclusive($directory . '/manifest.json', $manifestText);
            $complete = true;
            $receipt = json_encode(['backups' => 1, 'photos' => $photos['count'], 'bytes' => $database['bytes'] + $photos['bytes'],
                'sha256' => hash('sha256', $manifestText)]) . "\n";
            if (file_put_contents('php://stdout', $receipt) !== strlen($receipt)) throw new RuntimeException('Receipt failed.');
            return 0;
        } catch (Throwable $error) {
            file_put_contents('php://stderr', $error instanceof MissingDumpBinary
                ? "No está disponible mysqldump. Usa Backup Wizard de cPanel y verifica la descarga privada antes de continuar.\n"
                : "No se pudo completar el respaldo. No uses archivos sin manifiesto verificado.\n");
            return 1;
        } finally {
            try { if ($defaults !== null && is_file($defaults)) unlink($defaults); } catch (Throwable) {}
            try { if (!$complete && $directory !== null) self::removeIncomplete($directory); } catch (Throwable) {}
            try { if ($lease !== null) $lease->release(); } catch (Throwable) { /* Connection closure also releases MySQL locks. */ }
        }
    }

    private static function photos(\PDO $pdo, Config $config, string $directory): array
    {
        $mysql = $pdo->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql';
        $exists = $pdo->query($mysql
            ? "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'vocero_photos'"
            : "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'vocero_photos'")->fetchColumn();
        $rows = (int) $exists === 0 ? [] : $pdo->query('SELECT storage_key, sha256, bytes, content_type, width, height FROM vocero_photos ORDER BY storage_key')->fetchAll(\PDO::FETCH_ASSOC);
        $expected = [];
        foreach ($rows as $row) {
            $key = $row['storage_key'];
            if (!is_string($key) || !preg_match('/^[a-f0-9]{64}$/D', $key) || isset($expected[$key])
                || !preg_match('/^[a-f0-9]{64}$/D', $row['sha256'])) throw new RuntimeException('Invalid photo metadata.');
            $expected[$key] = $row;
        }
        $root = $config->privateDirectory() . '/voceros-photos';
        $filesRoot = $root . '/files';
        foreach ([$root, $filesRoot] as $path) {
            if (is_link($path) || (file_exists($path) && (!is_dir($path) || realpath($path) !== $path))) throw new RuntimeException('Invalid photo tree.');
        }
        $found = is_dir($filesRoot) ? array_values(array_diff(scandir($filesRoot), ['.', '..'])) : [];
        sort($found, SORT_STRING); $keys = array_keys($expected); sort($keys, SORT_STRING);
        if ($found !== $keys) throw new RuntimeException('Photo inventory mismatch.');
        $summary = ['count' => 0, 'bytes' => 0, 'sha256' => hash('sha256', ''), 'files' => []];
        if ($keys === []) return $summary; // A pre-003 backup creates no source photo directories.
        $storage = new PhotoStorage($config, new Crypto($config));
        if (!mkdir($directory . '/voceros-photos', 0700) || !mkdir($directory . '/voceros-photos/files', 0700)) throw new RuntimeException('Archive directory unavailable.');
        $aggregate = hash_init('sha256');
        foreach ($keys as $key) {
            $path = $filesRoot . '/' . $key;
            $before = lstat($path);
            if (($before['mode'] & 0170000) !== 0100000 || $before['nlink'] !== 1) throw new RuntimeException('Invalid photo file.');
            $stream = fopen($path, 'rb');
            if ($stream === false) throw new RuntimeException('Photo unavailable.');
            try {
                $opened = fstat($stream);
                if ($opened === false || ($opened['mode'] & 0170000) !== 0100000 || $opened['nlink'] !== 1
                    || $opened['dev'] !== $before['dev'] || $opened['ino'] !== $before['ino']) throw new RuntimeException('Photo file changed.');
                $encrypted = stream_get_contents($stream, PhotoStorage::MAX_ENCRYPTED_BYTES + 1);
                if (!is_string($encrypted) || strlen($encrypted) > PhotoStorage::MAX_ENCRYPTED_BYTES || !feof($stream)) throw new RuntimeException('Invalid photo size.');
            } finally { fclose($stream); }
            $jpeg = $storage->decode($key, $encrypted);
            $logicalHash = hash('sha256', $jpeg); $row = $expected[$key];
            $dimensions = getimagesizefromstring($jpeg);
            if (!hash_equals($row['sha256'], $logicalHash) || (int) $row['bytes'] !== strlen($jpeg)
                || $row['content_type'] !== 'image/jpeg' || (int) $row['width'] !== $dimensions[0] || (int) $row['height'] !== $dimensions[1]) throw new RuntimeException('Photo metadata mismatch.');
            $relative = 'voceros-photos/files/' . $key;
            Operations::writeExclusive($directory . '/' . $relative, $encrypted);
            $entry = ['storage_key' => $key, 'file' => $relative, 'bytes' => strlen($encrypted), 'sha256' => hash('sha256', $encrypted), 'jpeg_sha256' => $logicalHash];
            $summary['files'][] = $entry; $summary['count']++; $summary['bytes'] += $entry['bytes'];
            hash_update($aggregate, $key . "\0" . $entry['bytes'] . "\0" . $entry['sha256'] . "\0" . $logicalHash . "\n");
        }
        $summary['sha256'] = hash_final($aggregate);
        return $summary;
    }

    private static function removeIncomplete(string $directory): void
    {
        // This exact directory was created exclusively by this invocation; never walk source data.
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST) as $entry) {
            if ($entry->isDir() && !$entry->isLink()) rmdir($entry->getPathname());
            else unlink($entry->getPathname());
        }
        rmdir($directory);
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
