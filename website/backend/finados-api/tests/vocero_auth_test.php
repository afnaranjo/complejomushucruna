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
$pdo->prepare('INSERT INTO vocero_photos (vocero_id, storage_key, content_type, bytes, sha256, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute([$voceroId, 'private/test.jpg', 'image/jpeg', 10, hash('sha256', 'photo'), 80, 100, $nowText]);
throws(fn () => $pdo->prepare('INSERT INTO vocero_photos (vocero_id, storage_key, content_type, bytes, sha256, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')->execute([$voceroId, 'private/second.jpg', 'image/jpeg', 11, hash('sha256', 'photo-2'), 80, 100, $nowText]), PDOException::class);
same('003_vocero_accounts', $pdo->query("SELECT version FROM schema_migrations WHERE version = '003_vocero_accounts'")->fetchColumn());
same(['email_idx', 'ip_hash', 'attempted_at'], array_column($pdo->query("PRAGMA index_info('idx_vocero_login_window')")->fetchAll(), 'name'));
same(['email_idx', 'attempted_at'], array_column($pdo->query("PRAGMA index_info('idx_vocero_login_email_window')")->fetchAll(), 'name'));
same(['ip_hash', 'attempted_at'], array_column($pdo->query("PRAGMA index_info('idx_vocero_login_ip_window')")->fetchAll(), 'name'));
$generatedPasswordHash = Auth::hashPassword('contraseña válida');
$passwordInfo = password_get_info(defined('PASSWORD_ARGON2ID')
    ? $generatedPasswordHash
    : substr($generatedPasswordHash, strlen('bcrypt-sha384$v1$')));
same(defined('PASSWORD_ARGON2ID') ? 'argon2id' : 'bcrypt', $passwordInfo['algoName']);
same(defined('PASSWORD_ARGON2ID') ? 65536 : 12, defined('PASSWORD_ARGON2ID') ? $passwordInfo['options']['memory_cost'] : $passwordInfo['options']['cost']);
if (defined('PASSWORD_ARGON2ID')) {
    same(4, $passwordInfo['options']['time_cost']);
    same(1, $passwordInfo['options']['threads']);
} else {
    same(true, str_starts_with($generatedPasswordHash, 'bcrypt-sha384$v1$'));
}
same(true, Auth::verifyPassword('contraseña válida', $generatedPasswordHash));
same(false, Auth::verifyPassword('contraseña distinta', $generatedPasswordHash));
same(false, Auth::needsPasswordRehash(Auth::dummyPasswordHash()));

// The versioned bcrypt fallback must bind every password byte, not bcrypt's first 72 bytes.
$bcryptSharedPrefix = str_repeat('p', 72);
$bcryptLongPassword = $bcryptSharedPrefix . '-sufijo-a';
$bcryptDifferentSuffix = $bcryptSharedPrefix . '-sufijo-b';
$bcryptPrehash = base64_encode(hash('sha384', $bcryptLongPassword, true));
$versionedBcryptHash = 'bcrypt-sha384$v1$' . password_hash($bcryptPrehash, PASSWORD_BCRYPT, ['cost' => 4]);
same(true, Auth::verifyPassword($bcryptLongPassword, $versionedBcryptHash));
same(false, Auth::verifyPassword($bcryptDifferentSuffix, $versionedBcryptHash));

// Existing unversioned bcrypt credentials remain usable and are marked for migration.
$legacyPassword = 'credencial heredada segura';
$legacyBcryptHash = password_hash($legacyPassword, PASSWORD_BCRYPT, ['cost' => 4]);
same(true, Auth::verifyPassword($legacyPassword, $legacyBcryptHash));
same(false, Auth::verifyPassword($legacyPassword . '-otra', $legacyBcryptHash));
same(true, Auth::needsPasswordRehash($legacyBcryptHash));
if (defined('PASSWORD_ARGON2ID')) {
    $argonPassword = str_repeat('á', 65);
    $argonHash = password_hash($argonPassword, PASSWORD_ARGON2ID, ['memory_cost' => 65536, 'time_cost' => 4, 'threads' => 1]);
    same(true, Auth::verifyPassword($argonPassword, $argonHash));
    same(false, Auth::verifyPassword($argonPassword . 'x', $argonHash));
    same(false, Auth::needsPasswordRehash($argonHash));
}
$mysqlDuplicateKeyMatcher = new ReflectionMethod(VoceroAuth::class, 'isMySqlEmailDuplicateMessage');
foreach ([
    "Duplicate entry 'x' for key 'email_idx'",
    'Duplicate entry \'x\' for key `email_idx`',
    "Duplicate entry 'x' for key 'vocero_accounts.email_idx'",
    'Duplicate entry \'x\' for key `vocero_accounts.email_idx`',
] as $message) {
    same(true, $mysqlDuplicateKeyMatcher->invoke(null, $message));
}
same(false, $mysqlDuplicateKeyMatcher->invoke(null, "Duplicate entry 'x' for key 'public_id'"));
same(false, $mysqlDuplicateKeyMatcher->invoke(null, "Duplicate entry 'x' for key 'other.email_idx'"));

// Registration must fail without a locally derived privacy acknowledgement.
$clock = 1800000000;
$auth = new VoceroAuth($pdo, $config, static function () use (&$clock): int { return $clock; });
throws(fn () => $auth->register('vocero@example.invalid', 'contraseña válida', false, '192.0.2.40'), \InvalidArgumentException::class);
throws(fn () => $auth->register('vocero@example.invalid', str_repeat('x', 9), true, '192.0.2.40'), \InvalidArgumentException::class);
throws(fn () => $auth->register('vocero@example.invalid', str_repeat('x', 129), true, '192.0.2.40'), \InvalidArgumentException::class);
$beforeId = session_id();
same([], $auth->register('  Vocero@Example.Invalid  ', 'contraseña válida', true, '192.0.2.40'));
same($beforeId, session_id());
same(PHP_SESSION_NONE, session_status());
same(2, (int) $pdo->query('SELECT COUNT(*) FROM vocero_accounts')->fetchColumn());
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero_account.registered'")->fetchColumn());
$registrationAudit = $pdo->query("SELECT actor_id, subject_type FROM audit_log WHERE event_type = 'vocero_account.registered'")->fetch();
same(null, $registrationAudit['actor_id']);
same('vocero_account', $registrationAudit['subject_type']);
same(false, str_contains((string) $pdo->query("SELECT email_enc FROM vocero_accounts WHERE email_idx <> 'idx-a' ORDER BY id DESC LIMIT 1")->fetchColumn(), 'vocero@example.invalid'));
foreach (['VOCERO@example.invalid', '  vocero@example.invalid '] as $email) {
    same([], $auth->register($email, 'contraseña válida', true, '192.0.2.40'));
}
same(2, (int) $pdo->query('SELECT COUNT(*) FROM vocero_accounts')->fetchColumn());
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero_account.registered'")->fetchColumn());
$integrityEmailIndex = hash_hmac('sha256', 'integrity@example.invalid', str_repeat('h', 32));
$pdo->exec("CREATE TRIGGER reject_other_integrity BEFORE INSERT ON vocero_accounts WHEN NEW.email_idx = '$integrityEmailIndex' BEGIN SELECT RAISE(ABORT, 'NOT NULL constraint failed: vocero_accounts.synthetic'); END");
throws(fn () => $auth->register('integrity@example.invalid', 'contraseña válida', true, '192.0.2.40'), PDOException::class);
$pdo->exec('DROP TRIGGER reject_other_integrity');
same(2, (int) $pdo->query('SELECT COUNT(*) FROM vocero_accounts')->fetchColumn());
$pdo->exec("CREATE TRIGGER fail_vocero_registration_audit BEFORE INSERT ON audit_log WHEN NEW.event_type = 'vocero_account.registered' BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
throws(fn () => $auth->register('audit-failure@example.invalid', 'contraseña válida', true, '192.0.2.40'), PDOException::class);
$pdo->exec('DROP TRIGGER fail_vocero_registration_audit');
same(2, (int) $pdo->query('SELECT COUNT(*) FROM vocero_accounts')->fetchColumn());
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero_account.registered'")->fetchColumn());

// A successful login upgrades a legacy unversioned bcrypt hash without changing the account.
$legacyVoceroHash = password_hash('contraseña válida', PASSWORD_BCRYPT, ['cost' => 4]);
$registeredAccountId = (int) $pdo->query("SELECT id FROM vocero_accounts WHERE email_idx <> 'idx-a' ORDER BY id DESC LIMIT 1")->fetchColumn();
$pdo->prepare('UPDATE vocero_accounts SET password_hash = ? WHERE id = ?')->execute([$legacyVoceroHash, $registeredAccountId]);

// Login rotates the session and CSRF while retaining only a server-issued role.
$pdo->exec('DELETE FROM vocero_login_attempts');
foreach (['vocero@example.invalid', 'missing@example.invalid'] as $email) {
    throws(fn () => $auth->login($email, 'incorrecta', '192.0.2.40'), Unauthorized::class);
}
same([0, 0], array_map('intval', $pdo->query('SELECT succeeded FROM vocero_login_attempts ORDER BY id')->fetchAll(PDO::FETCH_COLUMN)));
same(2, (int) $pdo->query('SELECT COUNT(DISTINCT email_idx) FROM vocero_login_attempts')->fetchColumn());
$pdo->exec('DELETE FROM vocero_login_attempts');
$existingId = session_id();
$login = $auth->login('VOCERO@example.invalid', 'contraseña válida', '192.0.2.40');
same(false, $existingId === session_id());
same('vocero', $login['user']['role']);
$migratedVoceroHash = $pdo->query('SELECT password_hash FROM vocero_accounts WHERE id = ' . $registeredAccountId)->fetchColumn();
same(false, hash_equals($legacyVoceroHash, $migratedVoceroHash));
same(true, Auth::verifyPassword('contraseña válida', $migratedVoceroHash));
same(false, Auth::needsPasswordRehash($migratedVoceroHash));
same(true, strlen($login['csrf']) >= 64);
$auth->verifyCsrf($login['csrf']);
throws(fn () => $auth->verifyCsrf(''), Forbidden::class);

// Five failed attempts lock independently by canonical email or by IP for fifteen minutes.
$auth->logout();
$pdo->exec('DELETE FROM vocero_login_attempts');
for ($i = 0; $i < 4; $i++) {
    throws(fn () => $auth->login('vocero@example.invalid', 'incorrecta', '192.0.2.' . (31 + $i)), Unauthorized::class);
}
same('vocero', $auth->login('vocero@example.invalid', 'contraseña válida', '192.0.2.35')['user']['role']);
$auth->logout();
throws(fn () => $auth->login('vocero@example.invalid', 'incorrecta', '192.0.2.36'), Unauthorized::class);
throws(fn () => $auth->login('vocero@example.invalid', 'contraseña válida', '192.0.2.37'), Unauthorized::class);
$pdo->exec('DELETE FROM vocero_login_attempts');
for ($i = 0; $i < 5; $i++) {
    throws(fn () => $auth->login('vocero@example.invalid', 'incorrecta', '192.0.2.' . (41 + $i)), Unauthorized::class);
    if ($i < 4) $clock += 100;
}
$clock += 899;
throws(fn () => $auth->login('vocero@example.invalid', 'contraseña válida', '192.0.2.99'), Unauthorized::class);
$clock++;
same('vocero', $auth->login('vocero@example.invalid', 'contraseña válida', '192.0.2.99')['user']['role']);
$auth->logout();
$pdo->exec('DELETE FROM vocero_login_attempts');
for ($i = 0; $i < 5; $i++) {
    throws(fn () => $auth->login('other' . $i . '@example.invalid', 'incorrecta', '192.0.2.100'), Unauthorized::class);
    if ($i < 4) $clock += 100;
}
throws(fn () => $auth->login('vocero@example.invalid', 'contraseña válida', '192.0.2.100'), Unauthorized::class);
$clock += 900;
same('vocero', $auth->login('vocero@example.invalid', 'contraseña válida', '192.0.2.100')['user']['role']);

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
throws(fn () => \Finados\Http::startSession($config, 'vocero'), \RuntimeException::class);
\Finados\Http::destroySession();
close_vocero_session();
\Finados\Http::startSession($config, 'vocero');
same('finados_vocero', session_name());
same('Lax', session_get_cookie_params()['samesite']);
throws(fn () => \Finados\Http::startSession($config, 'admin'), \RuntimeException::class);
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
$missingOrigin = ['REMOTE_ADDR' => '192.0.2.42', 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $session['csrf']];
same(403, $router->handle('POST', '/api/vocero/auth/register', $missingOrigin, json_encode([
    'email' => 'missing-origin@example.invalid', 'password' => 'contraseña válida', 'privacyAcknowledged' => true,
], JSON_THROW_ON_ERROR))->status);
$wrongOrigin = ['HTTP_ORIGIN' => 'https://attacker.invalid', 'REMOTE_ADDR' => '192.0.2.42', 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $session['csrf']];
same(403, $router->handle('POST', '/api/vocero/auth/login', $wrongOrigin, json_encode([
    'email' => 'route@example.invalid', 'password' => 'contraseña válida',
], JSON_THROW_ON_ERROR))->status);
$rejectedRole = vocero_response_body($router->handle('POST', '/api/vocero/auth/register', $server, json_encode([
    'email' => 'route@example.invalid', 'password' => 'contraseña válida', 'privacyAcknowledged' => true, 'role' => 'administrador',
], JSON_THROW_ON_ERROR)));
same(422, $router->handle('POST', '/api/vocero/auth/register', $server, json_encode([
    'email' => 'role-again@example.invalid', 'password' => 'contraseña válida', 'privacyAcknowledged' => true, 'role' => 'administrador',
], JSON_THROW_ON_ERROR))->status);
same('validation_error', $rejectedRole['code']);
$createdResponse = $router->handle('POST', '/api/vocero/auth/register', $server, json_encode([
    'email' => 'route@example.invalid', 'password' => 'contraseña válida', 'privacyAcknowledged' => true,
], JSON_THROW_ON_ERROR));
$duplicateResponse = $router->handle('POST', '/api/vocero/auth/register', $server, json_encode([
    'email' => 'ROUTE@example.invalid', 'password' => 'contraseña válida', 'privacyAcknowledged' => true,
], JSON_THROW_ON_ERROR));
same(202, $createdResponse->status);
same($createdResponse->status, $duplicateResponse->status);
same($createdResponse->body, $duplicateResponse->body);
same(['ok' => true, 'message' => 'Cuenta creada; inicia sesión.'], vocero_response_body($createdResponse));
same(1, (int) $routePdo->query('SELECT COUNT(*) FROM vocero_accounts')->fetchColumn());
$afterRegistration = vocero_response_body($router->handle('GET', '/api/vocero/auth/session', $server));
same(false, $afterRegistration['authenticated']);
same(null, $afterRegistration['user']);
$loginServer = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.42', 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $afterRegistration['csrf']];
$routeLogin = vocero_response_body($router->handle('POST', '/api/vocero/auth/login', $loginServer, json_encode([
    'email' => 'route@example.invalid', 'password' => 'contraseña válida',
], JSON_THROW_ON_ERROR)));
same(true, $routeLogin['authenticated']);
same('vocero', $routeLogin['user']['role']);
$logoutServer = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.42', 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $routeLogin['csrf']];
same(403, $router->handle('POST', '/api/vocero/auth/logout', ['REMOTE_ADDR' => '192.0.2.42', 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $routeLogin['csrf']], '{}')->status);
same(['ok' => true], vocero_response_body($router->handle('POST', '/api/vocero/auth/logout', $logoutServer, '{}')));
close_vocero_session();

// Password policy counts Unicode characters while the HTTP login accepts their full UTF-8 bytes.
$unicodeConfig = vocero_config();
$unicodePdo = Database::connect($unicodeConfig);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts'] as $migration) {
    $unicodePdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
}
$unicodeCrypto = new Finados\Crypto($unicodeConfig);
$legacyShortPassword = str_repeat('á', 5); // Five characters, ten UTF-8 bytes.
$legacyShortHash = password_hash($legacyShortPassword, PASSWORD_BCRYPT, ['cost' => 4]);
$unicodePdo->prepare('INSERT INTO vocero_accounts (public_id,email_enc,email_idx,password_hash,privacy_version,privacy_hash,privacy_acknowledged_at,active,created_at,updated_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)')->execute([
    str_repeat('e', 32), $unicodeCrypto->encrypt('legacy-short@example.invalid'),
    $unicodeCrypto->lookup('legacy-short@example.invalid'), $legacyShortHash,
    'legacy', hash('sha256', 'legacy'),
]);
$unicodeAuth = new VoceroAuth($unicodePdo, $unicodeConfig);
same('vocero', $unicodeAuth->login('legacy-short@example.invalid', $legacyShortPassword, '192.0.2.76')['user']['role']);
$migratedLegacyShortHash = $unicodePdo->query("SELECT password_hash FROM vocero_accounts WHERE public_id = '" . str_repeat('e', 32) . "'")->fetchColumn();
same(false, hash_equals($legacyShortHash, $migratedLegacyShortHash));
same(true, Auth::verifyPassword($legacyShortPassword, $migratedLegacyShortHash));
close_vocero_session();
foreach (['', "\xff", str_repeat('x', 129), str_repeat('😀', 129)] as $invalidLoginPassword) {
    throws(fn () => $unicodeAuth->login('legacy-short@example.invalid', $invalidLoginPassword, '192.0.2.76'), InvalidArgumentException::class);
}

$unicodeRouter = new Router($unicodeConfig, $unicodePdo);
$unicodeServer = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.77'];
$unicodeSession = vocero_response_body($unicodeRouter->handle('GET', '/api/vocero/auth/session', $unicodeServer));
$unicodeServer += ['CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $unicodeSession['csrf']];
same(422, $unicodeRouter->handle('POST', '/api/vocero/auth/register', $unicodeServer, json_encode([
    'email' => 'short-unicode@example.invalid', 'password' => str_repeat('á', 5), 'privacyAcknowledged' => true,
], JSON_THROW_ON_ERROR))->status);
$unicodePassword = str_repeat('á', 65);
same(202, $unicodeRouter->handle('POST', '/api/vocero/auth/register', $unicodeServer, json_encode([
    'email' => 'unicode@example.invalid', 'password' => $unicodePassword, 'privacyAcknowledged' => true,
], JSON_THROW_ON_ERROR))->status);
$unicodeLogin = $unicodeRouter->handle('POST', '/api/vocero/auth/login', $unicodeServer, json_encode([
    'email' => 'unicode@example.invalid', 'password' => $unicodePassword,
], JSON_THROW_ON_ERROR));
same(200, $unicodeLogin->status);
same('vocero', vocero_response_body($unicodeLogin)['user']['role']);
close_vocero_session();
