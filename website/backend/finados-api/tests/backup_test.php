<?php

declare(strict_types=1);
require_once __DIR__ . '/OperationsTest.php';

// A nonempty compressed file alone is insufficient: the snapshot must restore and match its manifest.
[$backupRoot, $backupPdo] = operations_fixture();
$backupPdo->exec("INSERT INTO schema_migrations VALUES ('synthetic-version', '2026-09-14 00:00:00')");
$backupArgs = ['--config', $backupRoot . '/config.json', '--output', $backupRoot . '/backups'];
$held = fopen($backupRoot . '/finados.voceros.media.lock', 'c'); flock($held, LOCK_EX);
$blocked = proc_open([PHP_BINARY, __DIR__ . '/../bin/backup.php', ...$backupArgs], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $blockedPipes);
try {
    usleep(150000);
    same(true, proc_get_status($blocked)['running']);
    same(false, is_dir($backupRoot . '/backups')); // lock precedes the database snapshot and archive creation.
} finally { flock($held, LOCK_UN); fclose($held); }
$backupOutput = stream_get_contents($blockedPipes[1]); $backupError = stream_get_contents($blockedPipes[2]);
fclose($blockedPipes[1]); fclose($blockedPipes[2]);
$backup = ['code' => proc_close($blocked), 'out' => $backupOutput, 'err' => $backupError];
same(0, $backup['code']);
$archives = glob($backupRoot . '/backups/*/*.sqlite.gz');
same(1, count($archives));
$archive = $archives[0];
$manifestPath = dirname($archive) . '/manifest.json';
$manifest = json_decode(file_get_contents($manifestPath), true);
same(hash_file('sha256', $archive), $manifest['database']['sha256']);
same(filesize($archive), $manifest['database']['bytes']);
same(basename($archive), $manifest['database']['file']);
foreach ([$archive, $manifestPath] as $backupFile) same(0600, fileperms($backupFile) & 0777);
same(0700, fileperms(dirname($archive)) & 0777);
file_put_contents($backupRoot . '/restored.sqlite', gzdecode(file_get_contents($archive)));
$restored = new PDO('sqlite:' . $backupRoot . '/restored.sqlite');
same('ok', $restored->query('PRAGMA integrity_check')->fetchColumn());
same('synthetic-version', $restored->query('SELECT version FROM schema_migrations')->fetchColumn());
same(0, operations_cli('backup', $backupArgs)['code']);
same(2, count(glob($backupRoot . '/backups/*/*.sqlite.gz')));
same(hash_file('sha256', $archive), $manifest['database']['sha256']);

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

// Client-file quoting remains independent of PDO/MySQL availability.
require_once __DIR__ . '/../bin/backup.php';
$clientMethod = new ReflectionMethod(Finados\BackupCommand::class, 'mysqlClient');
[$databaseName, $clientText] = $clientMethod->invoke(null, Finados\Config::fromFile($mysqlRoot . '/config.json'));
same('synthetic', $databaseName);
same(true, str_contains($clientText, 'password="synthetic-only-'));

// A real imported legacy DB gains photos only through the additive migration.
require_once __DIR__ . '/../src/PhotoStorage.php';
require_once __DIR__ . '/../src/Crypto.php';
require_once __DIR__ . '/../src/VoceroMediaLock.php';
[$mediaRoot, $mediaDb] = operations_fixture();
foreach (['002_sheets_outbox', '003_vocero_accounts'] as $migration) $mediaDb->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
[$historical, $consents] = historical_rows();
write_historical_files($mediaRoot, $historical, $consents);
same(0, operations_cli('import-voceros', import_arguments($mediaRoot))['code']);
$mediaConfig = Finados\Config::fromFile($mediaRoot . '/config.json');
$mediaStorage = new Finados\PhotoStorage($mediaConfig, new Finados\Crypto($mediaConfig));
$image = imagecreatetruecolor(40, 60); imagejpeg($image, $mediaRoot . '/input.jpg');
if (PHP_VERSION_ID < 80500) imagedestroy($image);
$mediaArgs = ['--config', $mediaRoot . '/config.json', '--output', $mediaRoot . '/backups'];
$runMedia = static function () use ($mediaArgs, $mediaRoot): array {
    $before = glob($mediaRoot . '/backups/*/manifest.json');
    $result = operations_cli('backup', $mediaArgs);
    same(0, $result['code']);
    $paths = array_values(array_diff(glob($mediaRoot . '/backups/*/manifest.json'), $before));
    same(1, count($paths)); $path = $paths[0];
    return [json_decode(file_get_contents($path), true), dirname($path), json_decode($result['out'], true)];
};
[$zero] = $runMedia();
same(['count' => 0, 'bytes' => 0, 'sha256' => hash('sha256', ''), 'files' => []], $zero['photos']);
same(0, $manifest['photos']['count']); // pre-003 also succeeds without inventing a photo table.
$photos = [];
foreach ([1, 2] as $id) {
    $photo = $mediaStorage->stage($mediaRoot . '/input.jpg', filesize($mediaRoot . '/input.jpg'));
    $mediaStorage->promote($photo);
    $mediaDb->prepare('INSERT INTO vocero_photos (vocero_id,storage_key,content_type,bytes,sha256,width,height,created_at) VALUES (?,?,?,?,?,?,?,?)')
        ->execute([$id, $photo['storage_key'], $photo['mime_type'], $photo['bytes'], $photo['sha256'], $photo['width'], $photo['height'], gmdate('Y-m-d H:i:s')]);
    $photos[] = $photo;
    // Staged uploads are intentionally excluded from snapshots.
    $staged = $mediaStorage->stage($mediaRoot . '/input.jpg', filesize($mediaRoot . '/input.jpg'));
    [$current, $archivedRoot, $receipt] = $runMedia();
    same($id, $current['photos']['count']);
    same(false, file_exists($archivedRoot . '/voceros-photos/staging'));
    $keys = array_column($current['photos']['files'], 'storage_key');
    $sorted = $keys; sort($sorted, SORT_STRING); same($sorted, $keys);
    $totalBytes = 0; $hashInput = '';
    foreach ($current['photos']['files'] as $entry) {
        $archivedPhoto = $archivedRoot . '/' . $entry['file'];
        same(hash_file('sha256', $archivedPhoto), $entry['sha256']);
        same(filesize($archivedPhoto), $entry['bytes']);
        same(0600, fileperms($archivedPhoto) & 0777);
        same(hash('sha256', $mediaStorage->read($entry['storage_key'])), $entry['jpeg_sha256']);
        $totalBytes += $entry['bytes'];
        $hashInput .= $entry['storage_key'] . "\0" . $entry['bytes'] . "\0" . $entry['sha256'] . "\0" . $entry['jpeg_sha256'] . "\n";
        same(false, str_contains(json_encode($receipt), $entry['storage_key']));
    }
    same($totalBytes, $current['photos']['bytes']);
    same(hash('sha256', $hashInput), $current['photos']['sha256']);
    $mediaStorage->discard($staged);
}
$stableHash = $current['photos']['sha256'];
[$repeat] = $runMedia(); same($stableHash, $repeat['photos']['sha256']);

// Restore the exact encrypted archive and verify its logical JPEG hash against restored DB.
$restoreRoot = $mediaRoot . '/restore'; mkdir($restoreRoot, 0700);
$restoreConfig = json_decode(file_get_contents($mediaRoot . '/config.json'), true);
$restoreConfig['databaseDsn'] = 'sqlite:' . $restoreRoot . '/restored.sqlite';
file_put_contents($restoreRoot . '/config.json', json_encode($restoreConfig));
file_put_contents($restoreRoot . '/restored.sqlite', gzdecode(file_get_contents($archivedRoot . '/' . $current['database']['file'])));
$restoredStorage = new Finados\PhotoStorage(Finados\Config::fromFile($restoreRoot . '/config.json'), new Finados\Crypto($mediaConfig));
$restoredDb = new PDO($restoreConfig['databaseDsn']);
foreach ($restoredDb->query('SELECT * FROM vocero_photos') as $row) {
    copy($archivedRoot . '/voceros-photos/files/' . $row['storage_key'], $restoreRoot . '/voceros-photos/files/' . $row['storage_key']);
    same(true, $restoredStorage->verify($row['storage_key'], $row['sha256']));
}
$expectFailure = static function () use ($mediaArgs, $mediaRoot, $mediaDb, $mediaConfig): void {
    $before = glob($mediaRoot . '/backups/*'); sort($before);
    $result = operations_cli('backup', $mediaArgs); same(1, $result['code']); same('', $result['out']);
    $after = glob($mediaRoot . '/backups/*'); sort($after); same($before, $after);
    $lockFile = fopen($mediaRoot . '/finados.voceros.media.lock', 'c');
    same(true, flock($lockFile, LOCK_EX | LOCK_NB)); flock($lockFile, LOCK_UN); fclose($lockFile);
    $lease = Finados\VoceroMediaLock::acquire($mediaDb, $mediaConfig); $lease->release();
};
$key = $photos[0]['storage_key']; $original = $mediaRoot . '/voceros-photos/files/' . $key;
$encrypted = file_get_contents($original);
unlink($original); $expectFailure(); file_put_contents($original, $encrypted);
file_put_contents($original, 'corrupt encrypted content'); $expectFailure(); file_put_contents($original, $encrypted);
$mediaDb->exec("UPDATE vocero_photos SET sha256 = '" . str_repeat('0', 64) . "' WHERE vocero_id = 1");
$expectFailure();
$mediaDb->prepare('UPDATE vocero_photos SET sha256 = ? WHERE vocero_id = 1')->execute([$photos[0]['sha256']]);
$orphan = $mediaStorage->stage($mediaRoot . '/input.jpg', filesize($mediaRoot . '/input.jpg'));
$mediaStorage->promote($orphan); $expectFailure(); $mediaStorage->delete($orphan['storage_key']);
unlink($original); symlink($mediaRoot . '/input.jpg', $original); $expectFailure(); unlink($original); file_put_contents($original, $encrypted);
link($original, $mediaRoot . '/hardlink'); $expectFailure(); unlink($mediaRoot . '/hardlink');
$mediaDb->prepare('UPDATE vocero_photos SET storage_key = ? WHERE vocero_id = 1')->execute(['../invalid']);
$expectFailure();
$mediaDb->prepare('UPDATE vocero_photos SET storage_key = ? WHERE vocero_id = 1')->execute([$key]);
// Even a corrupted legacy schema without uniqueness cannot conceal duplicate references.
$mediaDb->exec('ALTER TABLE vocero_photos RENAME TO original_photos');
$mediaDb->exec('CREATE TABLE vocero_photos AS SELECT * FROM original_photos');
$mediaDb->exec('INSERT INTO vocero_photos SELECT * FROM original_photos WHERE vocero_id = 1');
$expectFailure();
$mediaDb->exec('DROP TABLE vocero_photos'); $mediaDb->exec('ALTER TABLE original_photos RENAME TO vocero_photos');
[$recovered] = $runMedia(); same(2, $recovered['photos']['count']);
