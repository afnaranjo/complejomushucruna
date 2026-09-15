<?php

declare(strict_types=1);

require_once __DIR__ . '/Test.php';
foreach (['Config', 'Database', 'Http', 'Auth', 'VoceroAuth', 'Router'] as $class) {
    $sourcePath = __DIR__ . '/../src/' . $class . '.php';
    if (is_file($sourcePath)) require_once $sourcePath;
}

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Forbidden;
use Finados\Router;
use Finados\Unauthorized;
use Finados\VoceroAuth;

function vocero_config(): Config
{
    return Config::fromFile(temp_file(json_encode([
        'environment' => 'test', 'databaseDsn' => 'sqlite::memory:',
        'databaseUser' => '', 'databasePassword' => '', 'allowedOrigin' => 'https://example.invalid',
        'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
    ], JSON_THROW_ON_ERROR)));
}

function vocero_response_body($response): array
{
    $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($body)) throw new RuntimeException('Expected JSON object.');
    return $body;
}

function close_vocero_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    session_id('');
    $_SESSION = [];
}

same(true, is_file(__DIR__ . '/../migrations/003_vocero_accounts_sqlite.sql'));
same(true, is_file(__DIR__ . '/../resources/vocero-consents.json'));
same(true, class_exists(VoceroAuth::class));

$consents = json_decode(file_get_contents(__DIR__ . '/../resources/vocero-consents.json'), true, 512, JSON_THROW_ON_ERROR);
same('2026-09-15', $consents['account']['version']);
same('Confirmo que he leído la Política de Privacidad y autorizo el tratamiento de mi correo electrónico para crear y proteger mi cuenta de Vocero.', $consents['account']['text']);
same('2026-09-14 + 2026-09-14', $consents['policies']['version']);
same('He leído y acepto las Políticas del Vocero y las Bases del Termómetro.', $consents['policies']['text']);
same('2026-09-15', $consents['image']['version']);
same('Autorizo por separado al responsable del programa a usar mi imagen, mi voz y el contenido que publique como vocero en sus canales oficiales y materiales de la feria, con mi crédito y sin pago adicional. Entiendo que la fotografía que subo para identificación y gafete no se publicará por ese solo hecho. He leído la Autorización de uso de imagen y contenido.', $consents['image']['text']);
same('2026-09-15', $consents['data']['version']);
same('Autorizo el tratamiento de mis datos personales, incluida la fotografía que subo, para verificar mi identidad, gestionar mi participación y, si corresponde, elaborar y entregar mi credencial o gafete. He leído la Política de Privacidad y conozco mis derechos de acceso, rectificación, eliminación, oposición y portabilidad.', $consents['data']['text']);

$config = vocero_config();
$pdo = Database::connect($config);
$pdo->exec(file_get_contents(__DIR__ . '/../migrations/001_initial_sqlite.sql'));
$pdo->exec(file_get_contents(__DIR__ . '/../migrations/002_sheets_outbox_sqlite.sql'));
$pdo->exec(file_get_contents(__DIR__ . '/../migrations/003_vocero_accounts_sqlite.sql'));
$nowText = '2026-09-15 00:00:00';
$pdo->prepare('INSERT INTO vocero_accounts (public_id,email_enc,email_idx,password_hash,privacy_version,privacy_hash,privacy_acknowledged_at,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)')
    ->execute([str_repeat('a', 32), 'enc-a', 'idx-a', 'hash-a', '2026-09-15', hash('sha256', 'aviso'), $nowText, $nowText, $nowText]);
throws(fn () => $pdo->prepare('INSERT INTO vocero_accounts (public_id,email_enc,email_idx,password_hash,privacy_version,privacy_hash,privacy_acknowledged_at,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,1,?,?)')
    ->execute([str_repeat('b', 32), 'enc-b', 'idx-a', 'hash-b', '2026-09-15', hash('sha256', 'aviso'), $nowText, $nowText, $nowText]), PDOException::class);
$pdo->prepare('INSERT INTO voceros (public_id,submission_id,status,full_name,cedula_enc,cedula_idx,birth_date_enc,age_at_submission,whatsapp_enc,whatsapp_idx,email_enc,email_idx,city,main_network,previous_participation,community_source,kit_pickup,submitted_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    ->execute([str_repeat('c', 32), str_repeat('d', 32), 'Nuevo', 'Vocero de prueba', 'cedula', 'cedula-idx', 'fecha', 20, 'telefono', 'telefono-idx', 'correo', 'correo-idx', 'Ambato', 'Instagram', 'No', 'Formulario', 'Taquilla', $nowText, $nowText, $nowText]);
$voceroId = (int) $pdo->lastInsertId();
$accountId = (int) $pdo->query("SELECT id FROM vocero_accounts WHERE email_idx = 'idx-a'")->fetchColumn();
$pdo->prepare('INSERT INTO vocero_account_links (account_id, vocero_id, created_at) VALUES (?, ?, ?)')->execute([$accountId, $voceroId, $nowText]);
throws(fn () => $pdo->prepare('INSERT INTO vocero_account_links (account_id, vocero_id, created_at) VALUES (?, ?, ?)')->execute([$accountId, $voceroId + 1, $nowText]), PDOException::class);
throws(fn () => $pdo->prepare('INSERT INTO vocero_account_links (account_id, vocero_id, created_at) VALUES (?, ?, ?)')->execute([$accountId + 1, $voceroId, $nowText]), PDOException::class);
$pdo->prepare('INSERT INTO vocero_photos (vocero_id, storage_key, content_type, bytes, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?)')->execute([$voceroId, 'private/test.jpg', 'image/jpeg', 10, hash('sha256', 'photo'), $nowText]);
throws(fn () => $pdo->prepare('INSERT INTO vocero_photos (vocero_id, storage_key, content_type, bytes, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?)')->execute([$voceroId, 'private/second.jpg', 'image/jpeg', 11, hash('sha256', 'photo-2'), $nowText]), PDOException::class);
same('003_vocero_accounts', $pdo->query("SELECT version FROM schema_migrations WHERE version = '003_vocero_accounts'")->fetchColumn());

// Registration must fail without a locally derived privacy acknowledgement.
$clock = 1800000000;
$auth = new VoceroAuth($pdo, $config, static function () use (&$clock): int { return $clock; });
throws(fn () => $auth->register('vocero@example.invalid', 'contraseña válida', false, '192.0.2.40'), \InvalidArgumentException::class);
throws(fn () => $auth->register('vocero@example.invalid', str_repeat('x', 9), true, '192.0.2.40'), \InvalidArgumentException::class);
throws(fn () => $auth->register('vocero@example.invalid', str_repeat('x', 129), true, '192.0.2.40'), \InvalidArgumentException::class);
$beforeId = session_id();
$registered = $auth->register('  Vocero@Example.Invalid  ', 'contraseña válida', true, '192.0.2.40');
same(false, $beforeId === session_id());
same('vocero@example.invalid', $registered['user']['email']);
same('vocero', $registered['user']['role']);
same(false, array_key_exists('password_hash', $registered['user']));
same('finados_vocero', session_name());
same('Lax', session_get_cookie_params()['samesite']);
same(true, session_get_cookie_params()['httponly']);
same(false, str_contains((string) $pdo->query("SELECT email_enc FROM vocero_accounts WHERE email_idx <> 'idx-a' ORDER BY id DESC LIMIT 1")->fetchColumn(), 'vocero@example.invalid'));
$duplicateMessages = [];
foreach (['VOCERO@example.invalid', '  vocero@example.invalid '] as $email) {
    try { $auth->register($email, 'contraseña válida', true, '192.0.2.40'); } catch (Unauthorized $error) { $duplicateMessages[] = $error->getMessage(); }
}
same(['No se pudo crear la cuenta', 'No se pudo crear la cuenta'], $duplicateMessages);

// Login rotates the session and CSRF while retaining only a server-issued role.
$registeredCsrf = $registered['csrf'];
$existingId = session_id();
$login = $auth->login('VOCERO@example.invalid', 'contraseña válida', '192.0.2.40');
same(false, $existingId === session_id());
same(false, $registeredCsrf === $login['csrf']);
same('vocero', $login['user']['role']);
same(true, strlen($login['csrf']) >= 64);
$auth->verifyCsrf($login['csrf']);
throws(fn () => $auth->verifyCsrf(''), Forbidden::class);

// Five failed attempts lock the same canonical email and IP for fifteen minutes.
$auth->logout();
for ($i = 0; $i < 5; $i++) {
    throws(fn () => $auth->login('vocero@example.invalid', 'incorrecta', '192.0.2.41'), Unauthorized::class);
    if ($i < 4) $clock += 100;
}
$clock += 899;
throws(fn () => $auth->login('vocero@example.invalid', 'contraseña válida', '192.0.2.41'), Unauthorized::class);
$clock++;
same('vocero', $auth->login('vocero@example.invalid', 'contraseña válida', '192.0.2.41')['user']['role']);

// Activity can extend idle expiry but never the twelve-hour absolute boundary.
$clock += 1799;
same('vocero', $auth->requireUser()['role']);
$clock += 1800;
throws(fn () => $auth->requireUser(), Unauthorized::class);
$auth->login('vocero@example.invalid', 'contraseña válida', '192.0.2.40');
for ($i = 0; $i < 24; $i++) { $clock += 1799; $auth->requireUser(); }
$clock += 24;
throws(fn () => $auth->requireUser(), Unauthorized::class);
$auth->login('vocero@example.invalid', 'contraseña válida', '192.0.2.40');
$oldVoceroSession = session_id();
$auth->logout();
same('', session_id());
session_id($oldVoceroSession);
throws(fn () => $auth->requireUser(), Unauthorized::class);
close_vocero_session();

// Cookie scopes are intentionally separate; using finados_admin for Vocero must break this contract.
\Finados\Http::startSession($config, 'admin');
same('finados_admin', session_name());
same('Strict', session_get_cookie_params()['samesite']);
\Finados\Http::destroySession();
close_vocero_session();
\Finados\Http::startSession($config, 'vocero');
same('finados_vocero', session_name());
same('Lax', session_get_cookie_params()['samesite']);
\Finados\Http::destroySession();
close_vocero_session();

// Vocero endpoints execute before the admin guard and never accept a client role.
$routePdo = Database::connect(vocero_config());
$routePdo->exec(file_get_contents(__DIR__ . '/../migrations/001_initial_sqlite.sql'));
$routePdo->exec(file_get_contents(__DIR__ . '/../migrations/002_sheets_outbox_sqlite.sql'));
$routePdo->exec(file_get_contents(__DIR__ . '/../migrations/003_vocero_accounts_sqlite.sql'));
$router = new Router(vocero_config(), $routePdo);
$server = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.42'];
$session = vocero_response_body($router->handle('GET', '/api/vocero/auth/session', $server));
same(false, $session['authenticated']);
same(null, $session['user']);
same(true, is_string($session['csrf']));
$server += ['CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $session['csrf']];
$rejectedRole = vocero_response_body($router->handle('POST', '/api/vocero/auth/register', $server, json_encode([
    'email' => 'route@example.invalid', 'password' => 'contraseña válida', 'privacyAcknowledged' => true, 'role' => 'administrador',
], JSON_THROW_ON_ERROR)));
same(422, $router->handle('POST', '/api/vocero/auth/register', $server, json_encode([
    'email' => 'role-again@example.invalid', 'password' => 'contraseña válida', 'privacyAcknowledged' => true, 'role' => 'administrador',
], JSON_THROW_ON_ERROR))->status);
same('validation_error', $rejectedRole['code']);
$created = vocero_response_body($router->handle('POST', '/api/vocero/auth/register', $server, json_encode([
    'email' => 'route@example.invalid', 'password' => 'contraseña válida', 'privacyAcknowledged' => true,
], JSON_THROW_ON_ERROR)));
same(true, $created['authenticated']);
same('vocero', $created['user']['role']);
$logoutServer = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.42', 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $created['csrf']];
same(['ok' => true], vocero_response_body($router->handle('POST', '/api/vocero/auth/logout', $logoutServer, '{}')));
close_vocero_session();
