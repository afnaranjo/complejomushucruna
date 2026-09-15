<?php

declare(strict_types=1);
require_once __DIR__ . '/OperationsTest.php';

// A nonempty compressed file alone is insufficient: the snapshot must restore and match its manifest.
[$backupRoot, $backupPdo] = operations_fixture();
$backupPdo->exec("INSERT INTO schema_migrations VALUES ('synthetic-version', '2026-09-14 00:00:00')");
$backupArgs = ['--config', $backupRoot . '/config.json', '--output', $backupRoot . '/backups'];
$backup = operations_cli('backup', $backupArgs);
same(0, $backup['code']);
$archives = glob($backupRoot . '/backups/*/*.sqlite.gz');
same(1, count($archives));
$archive = $archives[0];
$manifestPath = dirname($archive) . '/manifest.json';
$manifest = json_decode(file_get_contents($manifestPath), true);
same(hash_file('sha256', $archive), $manifest['sha256']);
same(filesize($archive), $manifest['bytes']);
same(basename($archive), $manifest['file']);
foreach ([$archive, $manifestPath] as $backupFile) same(0600, fileperms($backupFile) & 0777);
same(0700, fileperms(dirname($archive)) & 0777);
file_put_contents($backupRoot . '/restored.sqlite', gzdecode(file_get_contents($archive)));
$restored = new PDO('sqlite:' . $backupRoot . '/restored.sqlite');
same('ok', $restored->query('PRAGMA integrity_check')->fetchColumn());
same('synthetic-version', $restored->query('SELECT version FROM schema_migrations')->fetchColumn());
same(0, operations_cli('backup', $backupArgs)['code']);
same(2, count(glob($backupRoot . '/backups/*/*.sqlite.gz')));
same(hash_file('sha256', $archive), $manifest['sha256']);

// Public directories and aliases into them must be rejected before any snapshot is written.
mkdir($backupRoot . '/public_html', 0700);
symlink($backupRoot . '/public_html', $backupRoot . '/public-alias');
foreach (['public_html', 'public-alias'] as $public) {
    same(1, operations_cli('backup', ['--config', $backupRoot . '/config.json', '--output', $backupRoot . '/' . $public . '/backup'])['code']);
}
same([], glob($backupRoot . '/public_html/*'));
mkdir($backupRoot . '/custom-docroot', 0700);
same(1, operations_cli('backup', ['--config', $backupRoot . '/config.json', '--output', $backupRoot . '/custom-docroot/backups'],
    array_replace(getenv(), ['DOCUMENT_ROOT' => $backupRoot . '/custom-docroot']))['code']);
same([], glob($backupRoot . '/custom-docroot/*'));

// MySQL binary absence must give the hosting fallback without connecting or leaking credentials.
[$mysqlRoot] = operations_fixture(['databaseDsn' => 'mysql:host=127.0.0.1;port=3307;dbname=synthetic',
    'databaseUser' => 'synthetic-user', 'databasePassword' => "synthetic-only-'\"\\secret"]);
$env = array_replace(getenv(), ['PATH' => $mysqlRoot]);
$mysqlArgs = ['--config', $mysqlRoot . '/config.json', '--output', $mysqlRoot . '/backups'];
$missing = operations_cli('backup', $mysqlArgs, $env);
same(1, $missing['code']);
same(true, str_contains($missing['err'], 'Backup Wizard'));
same(false, str_contains($missing['out'] . $missing['err'], 'synthetic-only'));

// A stand-in at the external executable boundary validates argv, credential-file mode and cleanup.
$fake = <<<'PHP'
<?php
$args = array_slice($argv, 1);
if (count($args) !== 6 || !str_starts_with($args[0], '--defaults-file=') || $args[1] !== '--single-transaction'
    || $args[2] !== '--quick' || $args[3] !== '--skip-lock-tables' || $args[4] !== '--databases' || $args[5] !== 'synthetic') exit(21);
$path = substr($args[0], strlen('--defaults-file='));
if ((fileperms($path) & 0777) !== 0600) exit(22);
$contents = file_get_contents($path);
if (!str_contains($contents, '[client]') || !str_contains($contents, 'password="synthetic-only-')) exit(23);
file_put_contents(__DIR__ . '/credential-path.txt', $path);
if (is_file(__DIR__ . '/fail')) { fwrite(STDERR, 'synthetic-only-secret'); exit(9); }
echo "-- Synthetic dump\nCREATE TABLE synthetic (id INT);\n";
PHP;
file_put_contents($mysqlRoot . '/mysqldump', '#!' . PHP_BINARY . "\n" . $fake);
chmod($mysqlRoot . '/mysqldump', 0700);
$mysql = operations_cli('backup', $mysqlArgs, $env);
same(0, $mysql['code']);
$dump = glob($mysqlRoot . '/backups/*/*.sql.gz');
same(1, count($dump));
same("-- Synthetic dump\nCREATE TABLE synthetic (id INT);\n", gzdecode(file_get_contents($dump[0])));
same(false, file_exists(file_get_contents($mysqlRoot . '/credential-path.txt')));
file_put_contents($mysqlRoot . '/fail', 'synthetic');
$failure = operations_cli('backup', $mysqlArgs, $env);
same(1, $failure['code']);
same(false, str_contains($failure['err'] . $failure['out'], 'synthetic-only'));
same(false, file_exists(file_get_contents($mysqlRoot . '/credential-path.txt')));
same(1, count(glob($mysqlRoot . '/backups/*/manifest.json')));
