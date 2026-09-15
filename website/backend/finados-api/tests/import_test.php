<?php

declare(strict_types=1);
require_once __DIR__ . '/OperationsTest.php';

// Missing commands and duplicate insertion both break the observable CLI/database contract.
[$root, $pdo] = operations_fixture();
[$voceros, $consents] = historical_rows();
write_historical_files($root, $voceros, $consents);
$before = hash_file('sha256', $root . '/database.sqlite');
$dry = operations_cli('import-voceros', import_arguments($root, true));
same(0, $dry['code']);
same($before, hash_file('sha256', $root . '/database.sqlite'));
same([], glob($root . '/imports/*'));
$first = operations_cli('import-voceros', import_arguments($root));
same(0, $first['code']);
same(['inserted' => 2, 'skipped' => 0, 'errors' => 0], json_decode($first['out'], true));
$copies = glob($root . '/imports/*/*.csv');
same(2, count($copies));
$hashes = array_map(static fn ($path) => hash_file('sha256', $path), $copies);
sort($hashes);
$originalHashes = [hash_file('sha256', $root . '/voceros.csv'), hash_file('sha256', $root . '/consents.csv')];
sort($originalHashes); same($originalHashes, $hashes);
foreach ($copies as $copy) same(0600, fileperms($copy) & 0777);
$second = operations_cli('import-voceros', import_arguments($root));
same(0, $second['code']);
same(['inserted' => 0, 'skipped' => 2, 'errors' => 0], json_decode($second['out'], true));
same(4, count(glob($root . '/imports/*/*.csv')));
same(2, (int) $pdo->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same(6, (int) $pdo->query('SELECT COUNT(*) FROM vocero_consents')->fetchColumn());
same(['Nuevo', 'Pendiente de autorización'], $pdo->query('SELECT status FROM voceros ORDER BY id')->fetchAll(PDO::FETCH_COLUMN));
same('2026-09-13 19:15:16', $pdo->query('SELECT submitted_at FROM voceros ORDER BY id')->fetchColumn());
same('@synthetic', $pdo->query('SELECT tiktok FROM voceros ORDER BY id')->fetchColumn());
$raw = json_encode($pdo->query('SELECT * FROM voceros')->fetchAll()) . json_encode($pdo->query('SELECT * FROM vocero_consents')->fetchAll());
foreach (['1800000001', '0990000001', 'synthetic-a@example.invalid', '192.0.2.15'] as $pii) same(false, str_contains($raw, $pii));

// Every malformed source aborts the entire batch before backups or database writes.
$cases = ['header', 'invalid-utf8', 'id', 'unknown-status', 'orphan', 'missing', 'duplicate-consent', 'wrong-type', 'false-consent', 'duplicate-id', 'date'];
foreach ($cases as $case) {
    [$invalidRoot, $invalidPdo] = operations_fixture();
    [$v, $c] = historical_rows();
    switch ($case) {
        case 'header': $v[0][3] = 'Nombre inesperado'; break;
        case 'invalid-utf8': $v[1][3] = "\xFF"; break;
        case 'id': $v[1][1] = 'not-an-id'; break;
        case 'unknown-status': $v[2][2] = 'Persona Sintética estado privado'; break;
        case 'orphan': $c[1][9] = str_repeat('d', 32); break;
        case 'missing': array_pop($c); break;
        case 'duplicate-consent': $c[] = $c[1]; break;
        case 'wrong-type': $c[1][0] = 'otro'; break;
        case 'false-consent': $c[1][1] = 'false'; break;
        case 'duplicate-id': $v[2][1] = $v[1][1]; break;
        case 'date': $v[1][0] = '2026-02-30T00:00:00-05:00'; break;
    }
    write_historical_files($invalidRoot, $v, $c);
    foreach ([true, false] as $dryRun) {
        $result = operations_cli('import-voceros', import_arguments($invalidRoot, $dryRun));
        same(1, $result['code']);
        same(0, (int) $invalidPdo->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
        same([], glob($invalidRoot . '/imports/*'));
        same(true, str_contains($result['err'], 'line'));
        foreach (['Persona Sintética', '1800000001', '0990000001', 'synthetic-a@example.invalid', '192.0.2.15'] as $pii) {
            same(false, str_contains($result['out'] . $result['err'], $pii));
        }
    }
}

// A database failure after the first row cannot leave a partially imported batch.
[$rollbackRoot, $rollbackPdo] = operations_fixture();
write_historical_files($rollbackRoot, $voceros, $consents);
$rollbackPdo->exec("CREATE TRIGGER fail_second BEFORE INSERT ON voceros WHEN NEW.age_at_submission = 17 BEGIN SELECT RAISE(ABORT, 'private synthetic error'); END");
$result = operations_cli('import-voceros', import_arguments($rollbackRoot));
same(1, $result['code']);
same(0, (int) $rollbackPdo->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same(0, (int) $rollbackPdo->query('SELECT COUNT(*) FROM audit_log')->fetchColumn());
same(2, count(glob($rollbackRoot . '/imports/*/*.csv')));
same(false, str_contains($result['err'], 'private synthetic error'));

// A dry-run must not create even a missing SQLite database, and BOM is optional.
[$emptyRoot, $emptyPdo] = operations_fixture();
write_historical_files($emptyRoot, $voceros, $consents);
$emptyPdo = null;
unlink($emptyRoot . '/database.sqlite');
file_put_contents($emptyRoot . '/voceros.csv', historical_csv($voceros, false));
same(0, operations_cli('import-voceros', import_arguments($emptyRoot, true))['code']);
same(false, file_exists($emptyRoot . '/database.sqlite'));

// A permissive CSV reader silently accepts stray quotes; importing those changes the source meaning.
foreach (['"Persona Sintética A"garbage', 'Persona "Sintética A', '"Persona Sintética A'] as $malformedCell) {
    [$quoteRoot, $quotePdo] = operations_fixture();
    write_historical_files($quoteRoot, $voceros, $consents);
    $bytes = file_get_contents($quoteRoot . '/voceros.csv');
    $bytes = str_replace('"Persona Sintética A"', $malformedCell, $bytes);
    file_put_contents($quoteRoot . '/voceros.csv', $bytes);
    $result = operations_cli('import-voceros', import_arguments($quoteRoot));
    same(1, $result['code']);
    same(0, (int) $quotePdo->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
    same([], glob($quoteRoot . '/imports/*'));
}

// Multiline quoted values are legal CSV, and diagnostics refer to physical lines after them.
[$multilineRoot, $multilinePdo] = operations_fixture();
[$v, $c] = historical_rows();
$v[1][3] = "Persona\nSintética A";
$v[2][2] = 'unknown';
write_historical_files($multilineRoot, $v, $c);
$result = operations_cli('import-voceros', import_arguments($multilineRoot));
same(4, json_decode($result['err'], true)['line']);
$v[2][2] = 'Pendiente de autorización del representante';
write_historical_files($multilineRoot, $v, $c);
same(0, operations_cli('import-voceros', import_arguments($multilineRoot))['code']);
same("Persona\nSintética A", $multilinePdo->query('SELECT full_name FROM voceros ORDER BY id')->fetchColumn());

// Backup failure must block database mutation even when all CSV rows are valid.
[$blockedRoot, $blockedPdo] = operations_fixture();
write_historical_files($blockedRoot, $voceros, $consents);
file_put_contents($blockedRoot . '/imports', 'synthetic existing file');
same(1, operations_cli('import-voceros', import_arguments($blockedRoot))['code']);
same(0, (int) $blockedPdo->query('SELECT COUNT(*) FROM voceros')->fetchColumn());

// Historical fputcsv can emit an ambiguous even backslash run before a quote.
// The old validator accepted it while fgetcsv silently moved the quote in the stored value.
foreach ([['prefix' . str_repeat('\\', 2) . '"suffix', false],
    ['prefix' . str_repeat('\\', 4) . '"suffix', false],
    ['prefix' . '\\' . '"suffix', true], ['prefix"suffix', true],
    ['prefix' . str_repeat('\\', 2), true], ['prefix' . '\\', false],
    ["prefix\nwith,comma and \"quote\"", true]] as [$historicalValue, $reversible]) {
    [$escapeRoot, $escapePdo] = operations_fixture();
    [$escapeV, $escapeC] = historical_rows();
    $escapeV[1][3] = $historicalValue;
    write_historical_files($escapeRoot, $escapeV, $escapeC);
    $result = operations_cli('import-voceros', import_arguments($escapeRoot));
    same($reversible ? 0 : 1, $result['code']);
    if ($reversible) same($historicalValue, $escapePdo->query('SELECT full_name FROM voceros ORDER BY id')->fetchColumn());
    else {
        same(0, (int) $escapePdo->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
        same([], glob($escapeRoot . '/imports/*'));
        same(false, str_contains($result['err'], 'prefix'));
    }
}
