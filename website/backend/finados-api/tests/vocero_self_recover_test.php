<?php
declare(strict_types=1);
require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

// Recuperación sin coordinación: correo de la cuenta + cédula y WhatsApp de la ficha.
$root = tempnam(sys_get_temp_dir(), 'finados-recover-');
unlink($root); mkdir($root, 0700);
register_shutdown_function(static function () use ($root): void { @unlink($root . '/config.json'); @rmdir($root); });
file_put_contents($root . '/config.json', json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://complejomushucruna.com', 'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
]));
$config = Finados\Config::fromFile($root . '/config.json');
$db = Finados\Database::connect($config);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts'] as $migration) $db->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
$crypto = new Finados\Crypto($config);
$repository = new Finados\VocerosRepository($db, $crypto);
$auth = new Finados\VoceroAuth($db, $config);
$service = new Finados\VoceroPasswordReset($db, $config);
$old = bin2hex(random_bytes(12)); $new = 'NuevaClave2026';
$auth->register('Olvido@Example.invalid', $old, true, '192.0.2.10');
$record = ['submission_id' => str_repeat('b', 32), 'full_name' => 'Persona sintética', 'cedula' => '1800000001', 'birth_date' => '2000-01-02', 'age_at_submission' => 26, 'whatsapp' => '+593990000001', 'email' => 'olvido@example.invalid', 'city' => 'Prueba', 'main_network' => 'TikTok', 'previous_participation' => 'No', 'community_source' => 'Prueba', 'kit_pickup' => 'Sí', 'submitted_at' => gmdate('Y-m-d H:i:s')];
$consents = array_map(static fn ($type) => ['consent_type' => $type, 'accepted' => 1, 'text_version' => 'test', 'text_hash' => hash('sha256', $type), 'accepted_at' => gmdate('Y-m-d H:i:s'), 'ip' => '192.0.2.10', 'user_agent' => 'Synthetic', 'source_url' => 'https://example.invalid/', 'method' => 'checkbox'], ['privacy', 'image', 'data']);
$repository->create($record, $consents);
$db->exec("INSERT INTO vocero_account_links (account_id,vocero_id,created_at) VALUES (1,1,CURRENT_TIMESTAMP)");
$hash = static fn (): string => (string) $db->query('SELECT password_hash FROM vocero_accounts')->fetchColumn();

// Un dato que no coincide no cambia nada ni dice cuál falló.
throws(fn () => $service->selfRecover('olvido@example.invalid', '1800000002', '0990000001', $new, '192.0.2.20'), Finados\RecoveryMismatch::class);
throws(fn () => $service->selfRecover('otro@example.invalid', '1800000001', '0990000001', $new, '192.0.2.20'), Finados\RecoveryMismatch::class);
throws(fn () => $service->selfRecover('olvido@example.invalid', '1800000001', '0990000009', $new, '192.0.2.20'), Finados\RecoveryMismatch::class);
throws(fn () => $service->selfRecover('olvido@example.invalid', '1800000001', '0990000001', 'corta', '192.0.2.20'), InvalidArgumentException::class);
throws(fn () => $service->selfRecover('no-es-correo', '1800000001', '0990000001', $new, '192.0.2.20'), InvalidArgumentException::class);
same(true, Finados\Auth::verifyPassword($old, $hash()));
// Con los tres datos (el WhatsApp escrito como 09… aunque se guardó con +593) se crea la clave nueva.
$service->selfRecover(' OLVIDO@example.invalid ', '1800000001', '099 000 0001', $new, '192.0.2.21');
same(true, Finados\Auth::verifyPassword($new, $hash()));
same(1, (int) $db->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero.password_self_reset'")->fetchColumn());
same(false, str_contains((string) json_encode($db->query('SELECT * FROM audit_log')->fetchAll()), '1800000001'), 'la auditoría no guarda la cédula');
// Una ficha eliminada o una cuenta inactiva no se recuperan por aquí.
$db->exec("UPDATE voceros SET status = 'Eliminado'");
throws(fn () => $service->selfRecover('olvido@example.invalid', '1800000001', '0990000001', $old, '192.0.2.22'), Finados\RecoveryMismatch::class);
$db->exec("UPDATE voceros SET status = 'Aprobado'");
// Tope por IP: ocho intentos cada 15 minutos.
$limited = null;
try { for ($i = 0; $i < 10; $i++) { try { $service->selfRecover('olvido@example.invalid', '1800000009', '0990000001', $new, '192.0.2.30'); } catch (Finados\RecoveryMismatch) {} } }
catch (Finados\PasswordResetRateLimit $error) { $limited = $error; }
same(true, $limited !== null, 'tope de intentos por IP');
// Ruta HTTP.
$router = new Finados\Router($config, $db);
$origin = ['HTTP_ORIGIN' => 'https://complejomushucruna.com', 'REMOTE_ADDR' => '192.0.2.40'];
$session = json_decode($router->handle('GET', '/api/vocero/auth/session', $origin)->body, true);
$server = [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $session['csrf']];
same(404, $router->handle('POST', '/api/vocero/auth/recover', $server, json_encode(['email' => 'olvido@example.invalid', 'cedula' => '1800000003', 'whatsapp' => '0990000001', 'password' => $new]))->status);
same(403, $router->handle('POST', '/api/vocero/auth/recover', [...$server, 'HTTP_ORIGIN' => 'https://evil.invalid'], json_encode(['email' => 'olvido@example.invalid', 'cedula' => '1800000001', 'whatsapp' => '0990000001', 'password' => $new]))->status);
$ok = $router->handle('POST', '/api/vocero/auth/recover', $server, json_encode(['email' => 'olvido@example.invalid', 'cedula' => '1800000001', 'whatsapp' => '0990000001', 'password' => 'OtraClave2026']));
same(200, $ok->status);
same(true, Finados\Auth::verifyPassword('OtraClave2026', $hash()));
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
