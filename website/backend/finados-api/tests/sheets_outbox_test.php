<?php
declare(strict_types=1);

require_once __DIR__ . '/OperationsTest.php';
foreach (['Config', 'Database', 'Crypto', 'Audit', 'VocerosRepository'] as $class) require_once __DIR__ . '/../src/' . $class . '.php';

[$outboxRoot] = operations_fixture();
$outboxConfig = Finados\Config::fromFile($outboxRoot . '/config.json');
$outboxDb = Finados\Database::connect($outboxConfig);
$outboxDb->exec(file_get_contents(__DIR__ . '/../migrations/002_sheets_outbox_sqlite.sql'));
// Applying the additive migration twice preserves jobs and imports.
$outboxDb->exec(file_get_contents(__DIR__ . '/../migrations/002_sheets_outbox_sqlite.sql'));
$outboxCrypto = new Finados\Crypto($outboxConfig);
$outboxRepo = new Finados\VocerosRepository($outboxDb, $outboxCrypto);
$outbox = new Finados\SheetsOutbox($outboxDb, $outboxCrypto);
$outboxRecord = [
    'submission_id' => str_repeat('a', 32), 'full_name' => 'Persona Prueba', 'cedula' => '1800000022',
    'birth_date' => '2000-01-02', 'age_at_submission' => 26, 'whatsapp' => '0990000022',
    'email' => 'outbox@example.invalid', 'city' => 'Ciudad Prueba', 'main_network' => 'TikTok',
    'previous_participation' => 'No', 'community_source' => 'Prueba', 'kit_pickup' => 'Oficina',
    'submitted_at' => '2026-09-14 10:00:00',
];
$outboxConsents = array_map(static fn ($type) => [
    'consent_type' => $type, 'accepted' => 1, 'text_version' => 'test-v1', 'text_hash' => hash('sha256', $type),
    'accepted_at' => '2026-09-14 10:00:00', 'ip' => '192.0.2.4', 'user_agent' => 'Test',
    'source_url' => 'https://example.invalid/', 'method' => 'formulario_web',
], ['politicas', 'imagen', 'datos']);

// Removing the transaction coupling would leave a canonical row when the durable enqueue fails.
$outboxDb->exec("CREATE TRIGGER fail_outbox BEFORE INSERT ON sheets_outbox BEGIN SELECT RAISE(ABORT, 'synthetic'); END");
throws(fn () => $outboxRepo->createPublic($outboxRecord, $outboxConsents, '192.0.2.4'), Throwable::class);
foreach (['voceros', 'vocero_consents', 'audit_log', 'sheets_outbox'] as $table) same(0, (int) $outboxDb->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn());
$outboxDb->exec('DROP TRIGGER fail_outbox');

// A separate process exits immediately after canonical commit, before any delivery code runs.
$workerPrefix = 'foreach (["Config","Database","Crypto","Audit","VocerosRepository"] as $class) require_once '
    . var_export(realpath(__DIR__ . '/../src') . '/', true) . '.$class.".php";'
    . '$config = Finados\\Config::fromFile(' . var_export($outboxRoot . '/config.json', true) . ');'
    . '$pdo = Finados\\Database::connect($config); $crypto = new Finados\\Crypto($config);';
$process = proc_open([PHP_BINARY, '-r', $workerPrefix
    . '(new Finados\\VocerosRepository($pdo,$crypto))->createPublic(' . var_export($outboxRecord, true) . ','
    . var_export($outboxConsents, true) . ',"192.0.2.4"); exit(72);'], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
same('', stream_get_contents($pipes[1])); same('', stream_get_contents($pipes[2]));
fclose($pipes[1]); fclose($pipes[2]); same(72, proc_close($process));
same(1, (int) $outboxDb->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same(3, (int) $outboxDb->query('SELECT COUNT(*) FROM vocero_consents')->fetchColumn());
same('pending', $outboxDb->query('SELECT state FROM sheets_outbox')->fetchColumn());
$rawJob = json_encode($outboxDb->query('SELECT * FROM sheets_outbox')->fetch());
foreach (['Persona Prueba', 'outbox@example.invalid', '0990000022', '192.0.2.4'] as $privateValue) same(false, str_contains($rawJob, $privateValue));

// Real filesystem failure in a secondary sink does not lose the database pending job.
$originalLog = ini_get('error_log');
ini_set('error_log', $outboxRoot . '/test.log');
same('queued', $outbox->deliver($outboxRecord['submission_id'], static function (array $payload) use ($outboxRoot): string {
    file_put_contents($outboxRoot . '/absent-directory/receiver.json', json_encode($payload));
    return 'synced';
}));
same('pending', $outboxDb->query('SELECT state FROM sheets_outbox')->fetchColumn());
same(false, str_contains(file_get_contents($outboxRoot . '/test.log'), 'outbox@example.invalid'));
same(false, $outboxRepo->createPublic($outboxRecord, $outboxConsents, '192.0.2.4')['created']);

// Receiver acceptance followed by process death must recover after the lease expires.
$outboxDb->exec('UPDATE sheets_outbox SET next_attempt_at = 0'); // Simulate reaching the retry deadline.
$acceptedPath = $outboxRoot . '/receiver.json';
$process = proc_open([PHP_BINARY, '-r', $workerPrefix
    . '(new Finados\\SheetsOutbox($pdo,$crypto))->deliver(' . var_export($outboxRecord['submission_id'], true)
    . ',function($payload){file_put_contents(' . var_export($acceptedPath, true) . ',json_encode([$payload["id"]=>$payload]));exit(73);});'],
    [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
same('', stream_get_contents($pipes[1])); same('', stream_get_contents($pipes[2]));
fclose($pipes[1]); fclose($pipes[2]); same(73, proc_close($process));
same('queued', $outbox->deliver($outboxRecord['submission_id'], static fn () => throw new RuntimeException('Active lease must prevent sending')));
same(['synced' => 0, 'queued' => 0], $outbox->reconcile(static fn () => 'synced'));
$outboxDb->exec('UPDATE sheets_outbox SET lease_until = 1');
$receiver = static function (array $payload) use ($acceptedPath): string {
    $rows = json_decode(file_get_contents($acceptedPath), true);
    $rows[$payload['submission_id']] = $payload;
    file_put_contents($acceptedPath, json_encode($rows));
    return 'synced';
};
same(['synced' => 1, 'queued' => 0], $outbox->reconcile($receiver));
same(1, count(json_decode(file_get_contents($acceptedPath), true)));
same(['synced' => 0, 'queued' => 0], $outbox->reconcile($receiver));
same('synced', $outboxRepo->createPublic($outboxRecord, $outboxConsents, '192.0.2.4')['sheets']);
same(null, $outboxDb->query('SELECT payload_enc FROM sheets_outbox')->fetchColumn());
same(1, (int) $outboxDb->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero.sheets_synced'")->fetchColumn());

// Two live connections contend for the same job; only its lease holder may send or acknowledge it.
$secondRecord = array_replace($outboxRecord, ['submission_id' => str_repeat('b', 32), 'cedula' => '1800000023', 'whatsapp' => '0990000023', 'email' => 'second@example.invalid']);
$outboxRepo->createPublic($secondRecord, $outboxConsents, '192.0.2.4');
$otherDb = Finados\Database::connect($outboxConfig);
$otherDb->exec('PRAGMA busy_timeout = 500');
$otherWorker = new Finados\SheetsOutbox($otherDb, $outboxCrypto);
same('synced', $outbox->deliver($secondRecord['submission_id'], static function () use ($otherWorker, $secondRecord): string {
    same('queued', $otherWorker->deliver($secondRecord['submission_id'], static fn () => throw new LogicException('Concurrent send')));
    return 'synced';
}));
same(1, (int) $outboxDb->query("SELECT attempts FROM sheets_outbox WHERE submission_id = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'")->fetchColumn());

// A response without the matching submission receipt must remain pending, even with generic ok=true.
same(true, class_exists(Finados\SheetsTransport::class));
$transportConfig = ['webAppUrl' => 'https://script.google.com/macros/s/synthetic/exec', 'token' => str_repeat('s', 32)];
file_put_contents($outboxRoot . '/google-sheets-config.json', json_encode($transportConfig));
$thirdRecord = array_replace($outboxRecord, ['submission_id' => str_repeat('c', 32), 'cedula' => '1800000024', 'whatsapp' => '0990000024', 'email' => 'third@example.invalid']);
$outboxRepo->createPublic($thirdRecord, $outboxConsents, '192.0.2.4');
foreach ([['ok' => true], ['ok' => true, 'submission_id' => str_repeat('f', 32)], ['ok' => false, 'submission_id' => str_repeat('c', 32)]] as $badReceipt) {
    $outboxDb->exec('UPDATE sheets_outbox SET next_attempt_at = 0');
    same('queued', $outbox->deliver($thirdRecord['submission_id'], static fn ($payload) => Finados\SheetsTransport::deliver($outboxRoot, $payload,
        static fn () => [200, json_encode($badReceipt)])));
}
$outboxDb->exec('UPDATE sheets_outbox SET next_attempt_at = 0');
same('synced', $outbox->deliver($thirdRecord['submission_id'], static fn ($payload) => Finados\SheetsTransport::deliver($outboxRoot, $payload,
    static fn () => [200, '{"ok":true,"submission_id":"cccccccccccccccccccccccccccccccc"}'])));

// Recover older canonical rows by replaying the stable ID, using stored data, never the new POST values.
$legacyRecord = array_replace($outboxRecord, ['submission_id' => str_repeat('d', 32), 'cedula' => '1800000025', 'whatsapp' => '0990000025', 'email' => 'legacy@example.invalid']);
$outboxRepo->create($legacyRecord, $outboxConsents);
$outboxRepo->createPublic(array_replace($legacyRecord, ['full_name' => 'Changed replay']), $outboxConsents, '192.0.2.4');
$outboxDb->exec("CREATE TRIGGER fail_ack BEFORE INSERT ON audit_log WHEN NEW.event_type = 'vocero.sheets_synced' BEGIN SELECT RAISE(ABORT, 'synthetic'); END");
same('queued', $outbox->deliver($legacyRecord['submission_id'], static fn () => 'synced'));
same('pending', $outboxDb->query("SELECT state FROM sheets_outbox WHERE submission_id = 'dddddddddddddddddddddddddddddddd'")->fetchColumn());
$outboxDb->exec('DROP TRIGGER fail_ack');
$outboxDb->exec('UPDATE sheets_outbox SET next_attempt_at = 0');
// No network call when secondary configuration is absent; CLI re-runs retain exactly one pending job.
unlink($outboxRoot . '/google-sheets-config.json');
$cliResult = operations_cli('reconcile-sheets', ['--config', $outboxRoot . '/config.json']);
same(['synced' => 0, 'queued' => 1], json_decode($cliResult['out'], true));
same(0, $cliResult['code']);
same('', $cliResult['err']);
$cliRepeated = operations_cli('reconcile-sheets', ['--config', $outboxRoot . '/config.json']);
same(['synced' => 0, 'queued' => 0], json_decode($cliRepeated['out'], true));
same(0, $cliRepeated['code']);
same('', $cliRepeated['err']);
$outboxDb->exec('UPDATE sheets_outbox SET next_attempt_at = 0');
same('synced', $outbox->deliver($legacyRecord['submission_id'], static function ($payload): string {
    same('Persona Prueba', $payload['nombre_completo']);
    return 'synced';
}));
same(['synced' => 0, 'queued' => 0], json_decode(operations_cli('reconcile-sheets', ['--config', $outboxRoot . '/config.json'])['out'], true));

// A persistent failure in the oldest full batch must not starve the 101st job after a restart.
[$fairRoot] = operations_fixture();
$fairConfig = Finados\Config::fromFile($fairRoot . '/config.json');
$fairDb = Finados\Database::connect($fairConfig);
$fairDb->exec(file_get_contents(__DIR__ . '/../migrations/002_sheets_outbox_sqlite.sql'));
$fairCrypto = new Finados\Crypto($fairConfig);
$fairRepo = new Finados\VocerosRepository($fairDb, $fairCrypto);
$fairWorker = new Finados\SheetsOutbox($fairDb, $fairCrypto);
for ($i = 1; $i <= 101; $i++) {
    $fairDb->beginTransaction();
    $id = $fairRepo->create(array_replace($outboxRecord, ['submission_id' => sprintf('%032x', $i)]), $outboxConsents);
    $fairWorker->ensure($id);
    $fairDb->commit();
}
$lastId = sprintf('%032x', 101);
$fairReceiver = static fn (array $payload): string => $payload['id'] === $lastId ? 'synced' : 'queued';
same(['synced' => 0, 'queued' => 100], $fairWorker->reconcile($fairReceiver));
$restartedWorker = new Finados\SheetsOutbox(Finados\Database::connect($fairConfig), $fairCrypto);
same(['synced' => 1, 'queued' => 0], $restartedWorker->reconcile($fairReceiver));
same(['synced' => 0, 'queued' => 0], $restartedWorker->reconcile($fairReceiver));
same(101, (int) $fairDb->query('SELECT SUM(attempts) FROM sheets_outbox')->fetchColumn());
same(100, (int) $fairDb->query("SELECT COUNT(*) FROM sheets_outbox WHERE state = 'pending' AND payload_enc IS NOT NULL")->fetchColumn());

// Direct replays honor the same waiting period; repeated failures eventually cap their delay.
$firstFairId = sprintf('%032x', 1);
same('queued', $fairWorker->deliver($firstFairId, static fn () => 'synced'));
same(101, (int) $fairDb->query('SELECT SUM(attempts) FROM sheets_outbox')->fetchColumn());
$fairDb->exec("UPDATE sheets_outbox SET attempts = 999, next_attempt_at = 0 WHERE submission_id = '00000000000000000000000000000001'");
$beforeBackoff = time();
same('queued', $fairWorker->deliver($firstFairId, static fn () => 'queued'));
$scheduled = (int) $fairDb->query("SELECT next_attempt_at FROM sheets_outbox WHERE submission_id = '00000000000000000000000000000001'")->fetchColumn();
same(true, $scheduled >= $beforeBackoff + 3600 && $scheduled <= time() + 3600);

// When a lease expires during delivery, the stale worker must not erase its successor's retry deadline.
$secondFairId = sprintf('%032x', 2);
$fairDb->exec("UPDATE sheets_outbox SET next_attempt_at = 0 WHERE submission_id = '00000000000000000000000000000002'");
$successorDeadline = null;
same('queued', $fairWorker->deliver($secondFairId, static function () use ($fairDb, $restartedWorker, $secondFairId, &$successorDeadline): string {
    $fairDb->exec("UPDATE sheets_outbox SET lease_until = 0 WHERE submission_id = '00000000000000000000000000000002'");
    same('queued', $restartedWorker->deliver($secondFairId, static fn () => 'queued'));
    $successorDeadline = (int) $fairDb->query("SELECT next_attempt_at FROM sheets_outbox WHERE submission_id = '00000000000000000000000000000002'")->fetchColumn();
    return 'synced';
}));
same(true, $successorDeadline > time());
same($successorDeadline, (int) $fairDb->query("SELECT next_attempt_at FROM sheets_outbox WHERE submission_id = '00000000000000000000000000000002'")->fetchColumn());
same(3, (int) $fairDb->query("SELECT attempts FROM sheets_outbox WHERE submission_id = '00000000000000000000000000000002'")->fetchColumn());
same(100, (int) $fairDb->query("SELECT COUNT(*) FROM sheets_outbox WHERE state = 'pending' AND payload_enc IS NOT NULL")->fetchColumn());
ini_set('error_log', $originalLog);
