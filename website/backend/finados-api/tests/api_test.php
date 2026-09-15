<?php

declare(strict_types=1);

require_once __DIR__ . '/Test.php';
foreach (['Config', 'Database', 'Crypto', 'Audit', 'VocerosRepository', 'Auth'] as $class) {
    require_once __DIR__ . '/../src/' . $class . '.php';
}

// Removing the router, authorization, CSRF gates or serialization breaks actual CGI requests.
same(true, is_file(__DIR__ . '/../src/Router.php'));
same(true, is_file(__DIR__ . '/../public/index.php'));
$apiDb = temp_file('');
$apiErrorLog = temp_file('');
$apiConfigPath = temp_file(json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite:' . $apiDb,
    'databaseUser' => '', 'databasePassword' => '', 'allowedOrigin' => 'https://complejomushucruna.com',
    'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
], JSON_THROW_ON_ERROR));
$apiConfig = Finados\Config::fromFile($apiConfigPath);
$apiPdo = Finados\Database::connect($apiConfig);
$apiPdo->exec(file_get_contents(__DIR__ . '/../migrations/001_initial_sqlite.sql'));
$apiPdo->exec('PRAGMA journal_mode = WAL');
$apiSecret = bin2hex(random_bytes(24));
$apiHash = Finados\Auth::hashPassword($apiSecret);
$apiPdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
    ->execute([str_repeat('a', 32), 'admin', $apiHash, gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s')]);
$apiRepository = new Finados\VocerosRepository($apiPdo, new Finados\Crypto($apiConfig));
$apiConsents = array_map(static fn (string $type): array => [
    'consent_type' => $type, 'accepted' => 1, 'text_version' => 'synthetic-v1', 'text_hash' => hash('sha256', $type),
    'accepted_at' => gmdate('Y-m-d H:i:s'), 'ip' => '192.0.2.55', 'user_agent' => 'Synthetic',
    'source_url' => 'https://example.invalid/', 'method' => 'checkbox',
], ['privacy', 'image', 'data']);
$apiRecord = [
    'submission_id' => str_repeat('b', 32), 'full_name' => '=Persona Sintética', 'cedula' => '1800000001',
    'birth_date' => '2000-01-02', 'age_at_submission' => 26, 'whatsapp' => '+593990000001',
    'email' => 'synthetic@example.invalid', 'city' => '@Ciudad Prueba', 'main_network' => 'TikTok',
    'previous_participation' => 'No', 'community_source' => '-Prueba', 'kit_pickup' => 'Sí',
    'submitted_at' => gmdate('Y-m-d H:i:s'),
];
$apiId = $apiRepository->create($apiRecord, $apiConsents);
$apiOtherId = $apiRepository->create(array_replace($apiRecord, [
    'submission_id' => str_repeat('c', 32), 'full_name' => 'Otra persona', 'city' => 'Otra ciudad',
    'main_network' => 'Instagram', 'previous_participation' => 'Sí', 'submitted_at' => '2020-01-01 10:00:00',
]), $apiConsents);
$apiWorker = temp_file(<<<'PHP'
<?php
require getenv('FINADOS_TEST_SOURCE') . '/Router.php';
$config = Finados\Config::fromFile(getenv('FINADOS_TEST_CONFIG'));
$pdo = Finados\Database::connect($config);
// A second real connection inserts after the first export page starts reading.
// No result is mocked: this deterministically reproduces a concurrent registration.
if (getenv('FINADOS_TEST_CONCURRENT') === '1') {
    class ConcurrentExportStatement extends PDOStatement {
        private static bool $inserted = false;
        protected function __construct(private PDO $writer) {}
        public function execute(?array $params = null): bool {
            $result = parent::execute($params);
            if (!self::$inserted && str_contains($this->queryString, 'LIMIT ? OFFSET ?')) {
                self::$inserted = true;
                $row = $this->writer->query("SELECT * FROM voceros WHERE city = 'Lote' LIMIT 1")->fetch();
                unset($row['id']);
                $row['public_id'] = str_repeat('d', 32); $row['submission_id'] = str_repeat('e', 32);
                $row['submitted_at'] = '2099-01-01 00:00:00';
                $sql = 'INSERT INTO voceros (' . implode(', ', array_keys($row)) . ') VALUES (' . implode(', ', array_fill(0, count($row), '?')) . ')';
                $this->writer->prepare($sql)->execute(array_values($row));
            }
            return $result;
        }
    }
    $pdo->setAttribute(PDO::ATTR_STATEMENT_CLASS, [ConcurrentExportStatement::class, [Finados\Database::connect($config)]]);
}
$router = new Finados\Router($config, $pdo);
$router->handle($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI'], $_SERVER, file_get_contents('php://input'))->send();
PHP);

function api_request(string $method, string $uri, mixed $body = null, string $cookie = '', ?string $csrf = null, ?string $origin = 'https://complejomushucruna.com', array $server = []): array
{
    global $apiWorker, $apiConfigPath, $apiErrorLog;
    $raw = $body === null ? '' : (is_string($body) ? $body : json_encode($body === [] ? (object) [] : $body, JSON_THROW_ON_ERROR));
    $env = array_replace([
        'REDIRECT_STATUS' => '200', 'SCRIPT_FILENAME' => $apiWorker, 'SCRIPT_NAME' => '/api/index.php',
        'REQUEST_METHOD' => $method, 'REQUEST_URI' => $uri, 'HTTP_COOKIE' => $cookie,
        'CONTENT_TYPE' => 'application/json', 'CONTENT_LENGTH' => (string) strlen($raw),
        'REMOTE_ADDR' => '192.0.2.99', 'HTTP_X_FORWARDED_FOR' => '198.51.100.7',
        'FINADOS_TEST_SOURCE' => dirname(__DIR__) . '/src', 'FINADOS_TEST_CONFIG' => $apiConfigPath,
    ], $server);
    if ($origin !== null) $env['HTTP_ORIGIN'] = $origin;
    if ($csrf !== null) $env['HTTP_X_CSRF_TOKEN'] = $csrf;
    $pipes = [];
    $process = proc_open([dirname(PHP_BINARY) . '/php-cgi', '-d', 'session.save_path=' . sys_get_temp_dir(), '-d', 'error_log=' . $apiErrorLog, '-f', $apiWorker], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, $env);
    fwrite($pipes[0], $raw); fclose($pipes[0]);
    $output = stream_get_contents($pipes[1]); $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    same(0, proc_close($process));
    same('', $errors);
    [$head, $rawBody] = explode("\r\n\r\n", $output, 2);
    $headers = [];
    foreach (explode("\r\n", $head) as $line) {
        [$key, $value] = explode(':', $line, 2);
        $headers[strtolower($key)] = trim($value);
    }
    return ['status' => (int) ($headers['status'] ?? 200), 'headers' => $headers, 'body' => $rawBody, 'json' => json_decode($rawBody, true)];
}
function api_cookie(array $response): string
{
    return explode(';', $response['headers']['set-cookie'])[0];
}

foreach (['/api/voceros', '/api/voceros/' . $apiId, '/api/dashboard'] as $apiPath) {
    $response = api_request('GET', $apiPath, origin: null);
    same(401, $response['status']);
    same(['ok', 'code', 'message'], array_keys($response['json']));
}
foreach ([['PATCH', '/api/voceros/' . $apiId], ['POST', '/api/voceros/' . $apiId . '/notes'], ['POST', '/api/voceros/export'], ['POST', '/api/auth/logout']] as [$method, $apiPath]) {
    same(401, api_request($method, $apiPath, [])['status']);
}
same(200, api_request('GET', '/api/health', origin: null)['status']);
same(['ok' => true], api_request('GET', '/api/health')['json']);
$response = api_request('GET', '/api/voceros', origin: 'https://malicioso.example');
same(403, $response['status']);
same(false, isset($response['headers']['access-control-allow-origin']));
same('Origin', $response['headers']['vary']);
foreach (['null', 'https://complejomushucruna.com.evil.invalid', 'https://complejomushucruna.com/'] as $origin) {
    same(403, api_request('GET', '/api/auth/session', origin: $origin)['status']);
}
$response = api_request('OPTIONS', '/api/auth/session', server: ['HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET', 'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'Content-Type, X-CSRF-Token']);
same(204, $response['status']);
same('', $response['body']);
same('https://complejomushucruna.com', $response['headers']['access-control-allow-origin']);
same('true', $response['headers']['access-control-allow-credentials']);
same('GET, POST, PATCH, OPTIONS', $response['headers']['access-control-allow-methods']);
same(403, api_request('OPTIONS', '/api/voceros', server: ['HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'DELETE'])['status']);
same(403, api_request('OPTIONS', '/api/voceros', server: ['HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'X-Evil'])['status']);

$session = api_request('GET', '/api/auth/session');
same(false, $session['json']['authenticated']);
same(null, $session['json']['user']);
same(64, strlen($session['json']['csrf']));
same(false, str_contains($session['body'], $apiHash));
$cookie = api_cookie($session); $csrf = $session['json']['csrf'];
$credentials = ['username' => 'admin', 'password' => $apiSecret];
same(403, api_request('POST', '/api/auth/login', $credentials, $cookie)['status']);
same(403, api_request('POST', '/api/auth/login', $credentials, $cookie, 'wrong')['status']);
same(401, api_request('POST', '/api/auth/login', ['username' => 'admin', 'password' => 'wrong'], $cookie, $csrf)['status']);
$login = api_request('POST', '/api/auth/login', $credentials, $cookie, $csrf);
same(200, $login['status']); same(true, $login['json']['authenticated']);
same('admin', $login['json']['user']['username']);
same(false, $cookie === api_cookie($login)); same(false, $csrf === $login['json']['csrf']);
same(false, str_contains($login['body'], $apiHash));
// Administrative login must leave a minimal audit, never a password or credential hash.
$loginAudits = $apiPdo->query("SELECT * FROM audit_log WHERE event_type = 'admin.login'")->fetchAll();
same(1, count($loginAudits));
same(1, (int) $loginAudits[0]['actor_id']);
same('admin', $loginAudits[0]['subject_type']);
same(str_repeat('a', 32), $loginAudits[0]['subject_public_id']);
same('{}', $loginAudits[0]['metadata_json']);
same(hash_hmac('sha256', '192.0.2.99', str_repeat('h', 32)), $loginAudits[0]['ip_hash']);
$oldCookie = $cookie; $cookie = api_cookie($login); $csrf = $login['json']['csrf'];
same(401, api_request('GET', '/api/voceros', cookie: $oldCookie)['status']);
same(true, api_request('GET', '/api/auth/session', cookie: $cookie)['json']['authenticated']);

$list = api_request('GET', '/api/voceros?page=1&pageSize=1', cookie: $cookie);
same(200, $list['status']);
same(['page' => 1, 'pageSize' => 1, 'total' => 2, 'pages' => 2], $list['json']['pagination']);
same($apiId, $list['json']['items'][0]['public_id']);
same('******0001', $list['json']['items'][0]['cedula']);
same(false, str_contains($list['body'], 'synthetic@example.invalid'));
same(false, str_contains($list['body'], '+593990000001'));
same('no-store', $list['headers']['cache-control']);
same($apiOtherId, api_request('GET', '/api/voceros?page=2&pageSize=1', cookie: $cookie)['json']['items'][0]['public_id']);
foreach (['Sintética', '@Ciudad', $apiId, '1800000001', '+593990000001', 'SYNTHETIC@EXAMPLE.INVALID'] as $search) {
    $found = api_request('GET', '/api/voceros?search=' . rawurlencode($search), cookie: $cookie);
    same(200, $found['status']); same(true, $found['json']['pagination']['total'] > 0);
}
foreach (['synthetic@', '180000', '990000', '%', "' OR 1=1 --"] as $search) {
    same(0, api_request('GET', '/api/voceros?search=' . rawurlencode($search), cookie: $cookie)['json']['pagination']['total']);
}
$filters = ['status' => 'Nuevo', 'city' => 'Otra ciudad', 'main_network' => 'Instagram', 'previous_participation' => 'Sí', 'date_from' => '2020-01-01', 'date_to' => '2020-01-01'];
same(1, api_request('GET', '/api/voceros?' . http_build_query($filters), cookie: $cookie)['json']['pagination']['total']);
foreach (['page=0', 'pageSize=101', 'status=Inventado', 'search[]=x', 'date_from=2026-02-30', 'unknown=x'] as $query) {
    same(422, api_request('GET', '/api/voceros?' . $query, cookie: $cookie)['status']);
}
$detail = api_request('GET', '/api/voceros/' . $apiId, cookie: $cookie);
same($apiRecord['email'], $detail['json']['email']); same(3, count($detail['json']['consents']));
$viewAudits = $apiPdo->query("SELECT * FROM audit_log WHERE event_type = 'vocero.viewed'")->fetchAll();
same(1, count($viewAudits));
same(1, (int) $viewAudits[0]['actor_id']);
same('vocero', $viewAudits[0]['subject_type']);
same($apiId, $viewAudits[0]['subject_public_id']);
same('{}', $viewAudits[0]['metadata_json']);
same(hash_hmac('sha256', '192.0.2.99', str_repeat('h', 32)), $viewAudits[0]['ip_hash']);
foreach (['', 'not-an-ip'] as $invalidIp) {
    same(403, api_request('GET', '/api/voceros/' . $apiId, cookie: $cookie, server: ['REMOTE_ADDR' => $invalidIp])['status']);
}
same(404, api_request('GET', '/api/voceros/' . str_repeat('f', 32), cookie: $cookie)['status']);
same(1, (int) $apiPdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero.viewed'")->fetchColumn());
$dashboard = api_request('GET', '/api/dashboard', cookie: $cookie);
same(2, $dashboard['json']['total']); same(2, $dashboard['json']['byStatus']['Nuevo']); same(1, $dashboard['json']['lastSevenDays']);
same(1, $dashboard['json']['byDate']['2020-01-01']);

foreach ([['PATCH', '/api/voceros/' . $apiId, ['status' => 'Aprobado']], ['POST', '/api/voceros/' . $apiId . '/notes', ['body' => 'Nota']], ['POST', '/api/voceros/export', []], ['POST', '/api/auth/logout', []]] as [$method, $apiPath, $body]) {
    same(403, api_request($method, $apiPath, $body, $cookie)['status']);
    same(403, api_request($method, $apiPath, $body, $cookie, 'wrong')['status']);
}
same(422, api_request('PATCH', '/api/voceros/abc', ['status' => 'Inventado'], $cookie, $csrf)['status']);
foreach (Finados\VocerosRepository::STATUSES as $status) {
    same(200, api_request('PATCH', '/api/voceros/' . $apiId, ['status' => $status], $cookie, $csrf)['status']);
    same($status, $apiRepository->find($apiId)['status']);
}
foreach (['', 'not-an-ip'] as $invalidIp) {
    same(403, api_request('POST', '/api/voceros/' . $apiId . '/notes', ['body' => 'No debe guardarse'], $cookie, $csrf, server: ['REMOTE_ADDR' => $invalidIp])['status']);
}
same([], $apiRepository->find($apiId)['notes']);
foreach (['', ' ', str_repeat('ñ', 2001)] as $note) {
    same(422, api_request('POST', '/api/voceros/' . $apiId . '/notes', ['body' => $note], $cookie, $csrf)['status']);
}
same(201, api_request('POST', '/api/voceros/' . $apiId . '/notes', ['body' => 'Nota sintética'], $cookie, $csrf)['status']);
same(201, api_request('POST', '/api/voceros/' . $apiId . '/notes', ['body' => str_repeat('ñ', 2000)], $cookie, $csrf)['status']);
same('Nota sintética', $apiRepository->find($apiId)['notes'][0]['body']);
foreach (['{', 'null', '[]', '{"status":[]}', '{"status":"Nuevo","email":"x"}'] as $invalid) {
    same(422, api_request('PATCH', '/api/voceros/' . $apiId, $invalid, $cookie, $csrf)['status']);
}
same(415, api_request('PATCH', '/api/voceros/' . $apiId, ['status' => 'Nuevo'], $cookie, $csrf, server: ['CONTENT_TYPE' => 'text/plain'])['status']);
same(413, api_request('PATCH', '/api/voceros/' . $apiId, str_repeat('x', 17000), $cookie, $csrf)['status']);
same(405, api_request('DELETE', '/api/voceros/' . $apiId, cookie: $cookie)['status']);
same(404, api_request('GET', '/api/missing', cookie: $cookie)['status']);

$export = api_request('POST', '/api/voceros/export', ['search' => 'synthetic@example.invalid'], $cookie, $csrf);
same(200, $export['status']); same("\xEF\xBB\xBF", substr($export['body'], 0, 3));
same('text/csv; charset=utf-8', $export['headers']['content-type']);
same(true, str_contains($export['headers']['content-disposition'], 'attachment;'));
same('no-store', $export['headers']['cache-control']);
$stream = fopen('php://temp', 'w+'); fwrite($stream, substr($export['body'], 3)); rewind($stream);
$columns = fgetcsv($stream, escape: ''); $row = array_combine($columns, fgetcsv($stream, escape: '')); fclose($stream);
same("'=Persona Sintética", $row['full_name']); same("'+593990000001", $row['whatsapp']);
same("'@Ciudad Prueba", $row['city']); same("'-Prueba", $row['community_source']);
$auditRows = $apiPdo->query("SELECT * FROM audit_log WHERE actor_id IS NOT NULL")->fetchAll();
same(true, count($auditRows) >= 7);
foreach ($auditRows as $auditRow) {
    same(hash_hmac('sha256', '192.0.2.99', str_repeat('h', 32)), $auditRow['ip_hash']);
    same(false, str_contains($auditRow['metadata_json'], 'synthetic@example.invalid'));
    same(false, str_contains($auditRow['metadata_json'], 'Nota sintética'));
}
$exportAudit = $apiPdo->query("SELECT metadata_json FROM audit_log WHERE event_type = 'vocero.exported'")->fetchColumn();
same(2, json_decode($exportAudit, true)['count']);
same(hash_hmac('sha256', 'synthetic@example.invalid', str_repeat('h', 32)), json_decode($exportAudit, true)['filters']['search_hash']);

// Dropping batches after the first page loses registrations; no partial identifier search is allowed.
for ($i = 0; $i < 101; $i++) {
    $apiRepository->create(array_replace($apiRecord, ['submission_id' => sprintf('%032x', $i + 100), 'full_name' => 'Lote sintético', 'city' => 'Lote']), $apiConsents);
}
$batchExport = api_request('POST', '/api/voceros/export', ['city' => 'Lote'], $cookie, $csrf);
same(200, $batchExport['status']);
$stream = fopen('php://temp', 'w+'); fwrite($stream, substr($batchExport['body'], 3)); rewind($stream);
$columns = fgetcsv($stream, escape: ''); $ids = [];
while (($row = fgetcsv($stream, escape: '')) !== false) $ids[] = $row[0];
fclose($stream); same(101, count($ids)); same(101, count(array_unique($ids)));
$concurrentExport = api_request('POST', '/api/voceros/export', ['city' => 'Lote'], $cookie, $csrf, server: ['FINADOS_TEST_CONCURRENT' => '1']);
same(200, $concurrentExport['status']);
$stream = fopen('php://temp', 'w+'); fwrite($stream, substr($concurrentExport['body'], 3)); rewind($stream);
fgetcsv($stream, escape: ''); $concurrentIds = [];
while (($row = fgetcsv($stream, escape: '')) !== false) $concurrentIds[] = $row[0];
fclose($stream);
same(101, count($concurrentIds)); same(101, count(array_unique($concurrentIds)));
same(false, in_array(str_repeat('d', 32), $concurrentIds, true));
same(102, $apiRepository->list(['city' => 'Lote'])['total']);
same(0, api_request('GET', '/api/voceros?search=' . substr($apiId, 0, 10), cookie: $cookie)['json']['pagination']['total']);
foreach ([['search' => []], ['search' => null], ['city' => false], ['status' => 'Inventado'], ['page' => 1], ['date_from' => '2026-02-30']] as $badFilters) {
    same(422, api_request('POST', '/api/voceros/export', $badFilters, $cookie, $csrf)['status']);
}
$apiAudit = new Finados\Audit($apiPdo, new Finados\Crypto($apiConfig));
foreach ([['search' => 'PII'], ['search_hash' => 'PII'], ['date_from' => '2026-02-30'], ['status' => 'PII']] as $badMetadata) {
    throws(fn () => $apiAudit->log('vocero.exported', 1, 'vocero', null, ['count' => 1, 'filters' => $badMetadata]), InvalidArgumentException::class);
}
same(405, api_request('GET', '/api/voceros/export', cookie: $cookie)['status']);

// Internal SQL errors remain generic and an audit failure must prevent releasing a CSV.
$apiPdo->exec("CREATE TRIGGER fail_api_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT, 'secret sql path'); END");
$failed = api_request('POST', '/api/voceros/export', [], $cookie, $csrf);
same(500, $failed['status']); same(['ok', 'code', 'message'], array_keys($failed['json']));
same(false, str_contains($failed['body'], 'secret sql path'));
same(true, str_contains(file_get_contents($apiErrorLog), 'Finados API request failed.'));
same(false, str_contains(file_get_contents($apiErrorLog), 'secret sql path'));
// A failed detail audit must withhold protected fields and consent evidence.
$failedDetail = api_request('GET', '/api/voceros/' . $apiId, cookie: $cookie);
same(500, $failedDetail['status']);
same(['ok', 'code', 'message'], array_keys($failedDetail['json']));
foreach (['cedula', 'email', 'whatsapp'] as $protectedField) {
    same(false, str_contains($failedDetail['body'], $apiRecord[$protectedField]));
}
same(false, str_contains($failedDetail['body'], '192.0.2.55'));
same(1, (int) $apiPdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero.viewed'")->fetchColumn());
// A login whose audit fails must invalidate its freshly rotated session and cookie.
$unauditedSession = api_request('GET', '/api/auth/session');
$unauditedCookie = api_cookie($unauditedSession);
$failedLogin = api_request('POST', '/api/auth/login', $credentials, $unauditedCookie, $unauditedSession['json']['csrf']);
same(500, $failedLogin['status']);
same(['ok', 'code', 'message'], array_keys($failedLogin['json']));
same(true, str_contains($failedLogin['headers']['set-cookie'], 'Max-Age=0'));
same(401, api_request('GET', '/api/voceros', cookie: api_cookie($failedLogin))['status']);
same(401, api_request('GET', '/api/voceros', cookie: $unauditedCookie)['status']);
same(false, str_contains($failedLogin['body'], $apiSecret));
same(false, str_contains($failedLogin['body'], $apiHash));
same(1, (int) $apiPdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'admin.login'")->fetchColumn());
$apiPdo->exec('DROP TRIGGER fail_api_audit');
$logout = api_request('POST', '/api/auth/logout', [], $cookie, $csrf);
same(200, $logout['status']); same(true, str_contains($logout['headers']['set-cookie'], 'Max-Age=0'));
same(401, api_request('GET', '/api/voceros', cookie: $cookie)['status']);

// The real front controller fails closed with sanitized JSON when private config is unavailable.
$frontController = dirname(__DIR__) . '/public/index.php';
$pipes = [];
$process = proc_open([dirname(PHP_BINARY) . '/php-cgi', '-d', 'error_log=' . $apiErrorLog, '-f', $frontController], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, [
    'REDIRECT_STATUS' => '200', 'SCRIPT_FILENAME' => $frontController, 'REQUEST_METHOD' => 'GET', 'REQUEST_URI' => '/api/health',
]);
fclose($pipes[0]); $frontOutput = stream_get_contents($pipes[1]); $frontErrors = stream_get_contents($pipes[2]);
fclose($pipes[1]); fclose($pipes[2]); same(0, proc_close($process)); same('', $frontErrors);
same(true, str_contains($frontOutput, 'Status: 503'));
$frontBody = json_decode(explode("\r\n\r\n", $frontOutput, 2)[1], true);
same(['ok' => false, 'code' => 'service_unavailable', 'message' => 'Servicio no disponible.'], $frontBody);
