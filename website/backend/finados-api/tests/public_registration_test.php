<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
foreach (['Database', 'Crypto', 'Audit', 'VocerosRepository'] as $class) require_once __DIR__ . '/../src/' . $class . '.php';

// Execute the shipped endpoint, with only private configuration and external transport replaced.
$endpoint = __DIR__ . '/../../../public/api/voceros/index.php';
require_once $endpoint;
$publicTestOriginalLog = ini_get('error_log');
ini_set('error_log', temp_file(''));

function public_fixture(int $number = 1, array $overrides = []): array
{
    return array_replace([
        'submission_id' => str_pad(dechex($number), 32, '0', STR_PAD_LEFT),
        'nombre_completo' => 'Persona Sintética', 'cedula' => sprintf('180000%04d', $number),
        'fecha_nacimiento' => '2000-01-02', 'whatsapp' => sprintf('099000%04d', $number),
        'correo' => 'synthetic' . $number . '@example.invalid', 'ciudad' => 'Ciudad Prueba',
        'tiktok' => 'https://example.invalid/test', 'red_principal' => 'TikTok',
        'vocero_previo' => 'No, es mi primera vez', 'fuente_comunidad' => 'Facebook',
        'retiro_kit' => 'En la oficina', 'consentimiento_politicas' => 'Sí',
        'autorizacion_imagen' => 'Sí', 'consentimiento_datos' => 'Sí',
    ], $overrides);
}

$testConfig = Finados\Config::fromFile(temp_file(json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'http://127.0.0.1', 'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
])));
$publicDb = Finados\Database::connect($testConfig);
$publicDb->exec(file_get_contents(__DIR__ . '/../migrations/001_initial_sqlite.sql'));
$publicDb->exec(file_get_contents(__DIR__ . '/../migrations/002_sheets_outbox_sqlite.sql'));
$publicCrypto = new Finados\Crypto($testConfig);
$publicRepository = new Finados\VocerosRepository($publicDb, $publicCrypto);
$legal = ['policiesVersion' => 'p1', 'thermometerVersion' => 't1', 'imageVersion' => 'i1', 'privacyVersion' => 'd1'];
$publicPrivateDirectory = tempnam(sys_get_temp_dir(), 'voceros-intake-');
unlink($publicPrivateDirectory);
mkdir($publicPrivateDirectory, 0700);
register_shutdown_function(static function () use ($publicPrivateDirectory): void {
    foreach (glob($publicPrivateDirectory . '/*') as $file) unlink($file);
    rmdir($publicPrivateDirectory);
});
$bootstrap = fn () => ['repository' => $publicRepository, 'config' => $legal, 'privateDirectory' => $publicPrivateDirectory];
$legalFile = $publicPrivateDirectory . '/voceros-registration.json';
$completeLegal = $legal + ['enabled' => true, 'responsable' => 'Responsable Sintético', 'direccion' => 'Dirección Prueba', 'telefono' => '0990000000', 'contactEmail' => 'legal@example.invalid', 'retentionYears' => 3];
file_put_contents($legalFile, json_encode($completeLegal));
same($completeLegal, registration_config($publicPrivateDirectory));
foreach (['responsable', 'direccion', 'telefono', 'contactEmail', 'retentionYears'] as $requiredField) {
    $invalidLegal = $completeLegal;
    unset($invalidLegal[$requiredField]);
    file_put_contents($legalFile, json_encode($invalidLegal));
    same(null, registration_config($publicPrivateDirectory));
}
file_put_contents($legalFile, json_encode($completeLegal));
$sheetsCalls = 0;
$sheets = function ($directory, $kind, $payload) use ($publicDb, &$sheetsCalls): string {
    $sheetsCalls++;
    same(false, $publicDb->inTransaction());
    $query = $publicDb->prepare('SELECT COUNT(*) FROM voceros WHERE submission_id = ?');
    $query->execute([$payload['id']]);
    same(1, (int) $query->fetchColumn());
    throw new RuntimeException('Synthetic transport failure');
};
$submit = fn (array $post, array $server = [], ?callable $transport = null) => voceros_handle_request(array_replace([
    'REQUEST_METHOD' => 'POST', 'REMOTE_ADDR' => '192.0.2.55', 'HTTP_ORIGIN' => 'https://complejomushucruna.com',
], $server), $post, $bootstrap, $transport ?? $sheets);

$response = $submit(public_fixture());
same(200, $response['status']);
same(true, $response['json']['ok']);
same('stored', $response['json']['database']);
same('queued', $response['json']['googleSheets']);
// A successful queued receipt must have a durable database job, never just an audit label.
same(1, (int) $publicDb->query("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'sheets_outbox'")->fetchColumn());
$queued = $publicDb->query('SELECT * FROM sheets_outbox')->fetch();
$queuedPayload = json_decode($publicCrypto->decrypt($queued['payload_enc']), true);
same(public_fixture()['submission_id'], $queuedPayload['id']);
same(3, count($queuedPayload['consents']));
same('Sí', $queuedPayload['consentimiento_politicas'] ?? null);
same('Sí', $queuedPayload['autorizacion_imagen'] ?? null);
same('Sí', $queuedPayload['consentimiento_datos'] ?? null);
same(public_fixture()['submission_id'], $response['json']['registrationId']);
same(1, (int) $publicDb->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same(3, (int) $publicDb->query('SELECT COUNT(*) FROM vocero_consents')->fetchColumn());
same('Nuevo', $publicDb->query('SELECT status FROM voceros')->fetchColumn());
$publicId = $publicDb->query('SELECT public_id FROM voceros')->fetchColumn();
same(false, $publicId === $response['json']['registrationId']);
$detail = $publicRepository->find($publicId);
same('p1 + t1', $detail['consents'][0]['text_version']);
same(hash('sha256', POLICY_TEXT), $detail['consents'][0]['text_hash']);
same('192.0.2.55', $detail['consents'][0]['ip']);
same(hash_hmac('sha256', '192.0.2.55', str_repeat('h', 32)), $publicDb->query('SELECT ip_hash FROM audit_log LIMIT 1')->fetchColumn());
same(false, str_contains(json_encode($publicRepository->list([])), '192.0.2.55'));
same(public_fixture()['correo'], $detail['email']);
same(public_fixture()['whatsapp'], $detail['whatsapp']);
same(public_fixture()['cedula'], $detail['cedula']);
same(public_fixture()['fecha_nacimiento'], $detail['birth_date']);
same(public_fixture()['tiktok'], $detail['tiktok']);
same('formulario_web', $detail['consents'][0]['method']);
same(['politicas', 'imagen', 'datos'], array_column($detail['consents'], 'consent_type'));

// Replay and identity collisions must not create another consent bundle or consume the IP quota.
same(200, $submit(public_fixture())['status']);
same(1, (int) $publicDb->query('SELECT COUNT(*) FROM sheets_outbox')->fetchColumn());
same(1, (int) $publicDb->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
foreach (['cedula', 'correo', 'whatsapp'] as $field) {
    $duplicate = $submit(public_fixture(20, [$field => public_fixture()[$field]]));
    same(409, $duplicate['status']);
    same('Ya existe un registro con los datos proporcionados.', $duplicate['json']['message']);
}
for ($i = 2; $i <= 5; $i++) same(200, $submit(public_fixture($i))['status']);
same(200, $submit(public_fixture())['status']);
$limited = $submit(public_fixture(6));
same(429, $limited['status']);
same('900', $limited['headers']['Retry-After']);
same(5, (int) $publicDb->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same(200, $submit(public_fixture(6), ['REMOTE_ADDR' => '192.0.2.56'], fn () => 'synced')['status']);
$publicDb->exec("UPDATE audit_log SET created_at = '2000-01-01 00:00:00'");
same('synced', $submit(public_fixture(7), [], fn () => 'synced')['json']['googleSheets']);
same('synced', $submit(public_fixture(7, ['nombre_completo' => 'Replay must not mutate']))['json']['googleSheets']);

// Minor status and required representative fields are preserved by the real endpoint.
$minor = public_fixture(8, ['fecha_nacimiento' => (new DateTimeImmutable('now', new DateTimeZone('America/Guayaquil')))->modify('-17 years')->format('Y-m-d')]);
same(422, $submit($minor)['status']);
$minor += ['representante_nombre' => 'Representante Sintético', 'representante_cedula' => '1800000099', 'representante_telefono' => '0990000099', 'representante_correo' => 'rep@example.invalid'];
same(200, $submit($minor)['status']);
same(1, (int) $publicDb->query("SELECT COUNT(*) FROM voceros WHERE status = 'Pendiente de autorización'")->fetchColumn());
$before = (int) $publicDb->query('SELECT COUNT(*) FROM voceros')->fetchColumn();
foreach ([['cedula' => 'abc'], ['whatsapp' => '1234567890'], ['correo' => 'bad'], ['tiktok' => 'http://example.invalid'], ['consentimiento_datos' => 'No'], ['submission_id' => 'bad']] as $invalid) same(422, $submit(public_fixture(9, $invalid))['status']);
same(200, $submit(public_fixture(9, ['website' => 'bot']))['status']);
same(403, $submit(public_fixture(9), ['HTTP_ORIGIN' => 'https://attacker.invalid'])['status']);
same(413, $submit(public_fixture(9), ['CONTENT_LENGTH' => 65537])['status']);
same($before, (int) $publicDb->query('SELECT COUNT(*) FROM voceros')->fetchColumn());

// A failed DB transaction never reaches the secondary transport and remains retryable.
$callsBefore = $sheetsCalls;
$testLog = temp_file('');
$originalLog = ini_get('error_log');
ini_set('error_log', $testLog);
$publicDb->exec("CREATE TRIGGER public_fail BEFORE INSERT ON vocero_consents BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
same(500, $submit(public_fixture(9))['status']);
ini_set('error_log', $originalLog);
same(false, str_contains(file_get_contents($testLog), 'synthetic failure'));
same($callsBefore, $sheetsCalls);
same($before, (int) $publicDb->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same(false, $publicDb->inTransaction());
$publicDb->exec('DROP TRIGGER public_fail');
same(200, $submit(public_fixture(9))['status']);

// The public entry fails closed when private bootstrap is unavailable, including GET readiness.
$unavailable = static function (): never { throw new RuntimeException('private credentials must not escape'); };
same(false, voceros_handle_request(['REQUEST_METHOD' => 'GET'], [], $unavailable)['json']['open']);
same(503, voceros_handle_request(['REQUEST_METHOD' => 'POST'], public_fixture(), $unavailable)['status']);
same(200, voceros_handle_request(['REQUEST_METHOD' => 'HEAD'], [], $unavailable)['status']);
same('GET, HEAD, POST', voceros_handle_request(['REQUEST_METHOD' => 'DELETE'], [], $bootstrap)['headers']['Allow']);
same(true, voceros_handle_request(['REQUEST_METHOD' => 'GET'], [], $bootstrap)['json']['open']);

// Server paths must not permit loading config/code from the public docroot or relative paths.
$originalConfigPath = getenv('FINADOS_CONFIG_PATH');
$originalDocroot = $_SERVER['DOCUMENT_ROOT'] ?? null;
try {
    foreach ([false, 'relative/config.json', '/nonexistent-finados-config.json', temp_public_file('{}')] as $invalidPath) {
        putenv($invalidPath === false ? 'FINADOS_CONFIG_PATH' : 'FINADOS_CONFIG_PATH=' . $invalidPath);
        throws(fn () => voceros_bootstrap(), RuntimeException::class);
    }
    $publicConfig = temp_file('{}');
    $_SERVER['DOCUMENT_ROOT'] = dirname($publicConfig);
    putenv('FINADOS_CONFIG_PATH=' . $publicConfig);
    throws(fn () => voceros_bootstrap(), RuntimeException::class);
} finally {
    putenv($originalConfigPath === false ? 'FINADOS_CONFIG_PATH' : 'FINADOS_CONFIG_PATH=' . $originalConfigPath);
    if ($originalDocroot === null) unset($_SERVER['DOCUMENT_ROOT']);
    else $_SERVER['DOCUMENT_ROOT'] = $originalDocroot;
}

// Code and data have independent server-owned locations; only the connection is substituted.
$bootstrapRoot = $publicPrivateDirectory . '/apps';
mkdir($bootstrapRoot . '/src', 0700, true);
foreach (['Config', 'Database', 'Crypto', 'Audit', 'VocerosRepository', 'SheetsOutbox', 'SheetsTransport'] as $class) copy(__DIR__ . '/../src/' . $class . '.php', $bootstrapRoot . '/src/' . $class . '.php');
$productionConfig = $publicPrivateDirectory . '/finados-backend.json';
file_put_contents($productionConfig, json_encode([
    'environment' => 'production', 'databaseDsn' => 'mysql:host=example.invalid;dbname=synthetic',
    'databaseUser' => '', 'databasePassword' => '', 'allowedOrigin' => 'https://example.invalid',
    'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
]));
$script = 'require ' . var_export($endpoint, true) . '; $env = ' . var_export([
    'FINADOS_CONFIG_PATH' => $productionConfig, 'FINADOS_BACKEND_ROOT' => $bootstrapRoot,
], true) . '; $result = voceros_bootstrap($env, static fn () => new PDO("sqlite::memory:"));'
    . 'if (!$result["repository"] instanceof Finados\\VocerosRepository || $result["privateDirectory"] !== dirname($env["FINADOS_CONFIG_PATH"]) || $result["config"]["policiesVersion"] !== "p1") exit(1);'
    . 'foreach ([null, "relative/path", dirname(' . var_export(temp_public_file('{}'), true) . ')] as $bad) {'
    . '$env["FINADOS_BACKEND_ROOT"] = $bad; try { voceros_bootstrap($env, static fn () => new PDO("sqlite::memory:")); exit(2); } catch (RuntimeException $e) {} }';
$process = proc_open([PHP_BINARY, '-r', $script], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
$bootstrapOutput = stream_get_contents($pipes[1]);
$bootstrapError = stream_get_contents($pipes[2]);
fclose($pipes[1]); fclose($pipes[2]);
$bootstrapStatus = proc_close($process);
foreach (glob($bootstrapRoot . '/src/*') as $file) unlink($file);
rmdir($bootstrapRoot . '/src'); rmdir($bootstrapRoot);
same(0, $bootstrapStatus);
same('', $bootstrapOutput);
same('', $bootstrapError);

// Concurrent real requests must share the same five-slot quota rather than each reading five free slots.
$concurrentFile = temp_file('');
$concurrentConfig = temp_file(json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite:' . $concurrentFile,
    'databaseUser' => '', 'databasePassword' => '', 'allowedOrigin' => 'http://127.0.0.1',
    'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
]));
$concurrentDb = Finados\Database::connect(Finados\Config::fromFile($concurrentConfig));
$concurrentDb->exec(file_get_contents(__DIR__ . '/../migrations/001_initial_sqlite.sql'));
$concurrentDb->exec(file_get_contents(__DIR__ . '/../migrations/002_sheets_outbox_sqlite.sql'));
$worker = 'require ' . var_export($endpoint, true) . ';'
    . 'foreach (["Config", "Database", "Crypto", "Audit", "VocerosRepository"] as $class) require_once '
    . var_export(realpath(__DIR__ . '/../src') . '/', true) . '.$class.".php";'
    . '$config = Finados\\Config::fromFile(' . var_export($concurrentConfig, true) . ');'
    . '$pdo = Finados\\Database::connect($config); $repo = new Finados\\VocerosRepository($pdo, new Finados\\Crypto($config));'
    . '$bootstrap = fn () => ["repository" => $repo, "config" => ' . var_export($legal, true)
    . ', "privateDirectory" => ' . var_export($publicPrivateDirectory, true) . '];'
    . '$result = voceros_handle_request(["REQUEST_METHOD" => "POST", "REMOTE_ADDR" => "192.0.2.200"], json_decode($argv[1], true), $bootstrap, fn () => "synced");'
    . 'echo json_encode($result);';
$workers = [];
for ($i = 1; $i <= 8; $i++) {
    $process = proc_open([PHP_BINARY, '-r', $worker, json_encode(public_fixture($i))], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    $workers[] = [$process, $pipes];
}
$statuses = [];
foreach ($workers as [$process, $pipes]) {
    $result = json_decode(stream_get_contents($pipes[1]), true);
    $error = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    same(0, proc_close($process));
    same('', $error);
    $statuses[] = $result['status'];
    if ($result['status'] === 429) same('900', $result['headers']['Retry-After']);
}
sort($statuses);
same([200, 200, 200, 200, 200, 429, 429, 429], $statuses);
same(5, (int) $concurrentDb->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same(15, (int) $concurrentDb->query('SELECT COUNT(*) FROM vocero_consents')->fetchColumn());
ini_set('error_log', $publicTestOriginalLog);
