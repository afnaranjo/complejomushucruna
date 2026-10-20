<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Router;

$root = tempnam(sys_get_temp_dir(), 'finados-golden-');
if ($root === false || !unlink($root) || !mkdir($root, 0700)) throw new RuntimeException('Unable to create golden pass test root.');
register_shutdown_function(static function () use ($root): void {
    foreach (glob($root . '/*') ?: [] as $file) is_dir($file) ? null : unlink($file);
    rmdir($root);
});
file_put_contents($root . '/config.json', json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('g', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
], JSON_THROW_ON_ERROR));
$config = Config::fromFile($root . '/config.json');
$pdo = Database::connect($config);
$migrations = glob(__DIR__ . '/../migrations/*_sqlite.sql');
sort($migrations, SORT_STRING);
foreach ($migrations as $migration) $pdo->exec(file_get_contents($migration));
$pdo->exec(file_get_contents(__DIR__ . '/../migrations/037_golden_pass_sqlite.sql')); // aplicarla dos veces no falla
$secret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([str_repeat('e', 32), 'admin', Auth::hashPassword($secret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s')]);

if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.91'];
$json = [...$origin, 'CONTENT_TYPE' => 'application/json'];
$decode = static fn ($response): array => json_decode($response->body, true, 64, JSON_THROW_ON_ERROR);

// El panel exige sesión.
same(401, $router->handle('GET', '/api/pases-dorados', $origin)->status);
$session = $decode($router->handle('GET', '/api/auth/session', $origin));
$csrf = $decode($router->handle('POST', '/api/auth/login', [...$json, 'HTTP_X_CSRF_TOKEN' => $session['csrf']], json_encode(['username' => 'admin', 'password' => $secret])))['csrf'];
$send = static fn (string $method, string $path, array $body = []) => $router->handle($method, $path, [...$json, 'HTTP_X_CSRF_TOKEN' => $csrf], json_encode((object) $body));

// Una persona por línea, nombre y cédula en cualquier orden; la cédula repetida no se duplica.
$created = $decode($send('POST', '/api/pases-dorados', ['lines' => "Ana Pérez 1801234567\n\n1709876543, Luis  Toapanta\nRepetida; 1801234567"]));
same(['Ana Pérez', 'Luis Toapanta'], array_column($created['passes'], 'full_name'));
same(['1801234567', '1709876543'], array_column($created['passes'], 'cedula'));
same(['valido', 'valido'], array_column($created['passes'], 'status'));
same([['full_name' => 'Repetida', 'cedula' => '1801234567']], $created['skipped']);
same(1, count($decode($send('POST', '/api/pases-dorados', ['lines' => 'Ana Otra 1801234567']))['skipped']));
// Línea sin cédula, con dos cédulas o con un número de 9 dígitos: se rechaza todo el lote.
same(422, $send('POST', '/api/pases-dorados', ['lines' => "Sin cédula"])->status);
same(422, $send('POST', '/api/pases-dorados', ['lines' => "Dos 1801234567 1709876543"])->status);
same(422, $send('POST', '/api/pases-dorados', ['lines' => "Corta 180123456"])->status);
same(422, $send('POST', '/api/pases-dorados', ['lines' => " \n "])->status);

$list = $decode($router->handle('GET', '/api/pases-dorados', $origin));
same(['total' => 2, 'valido' => 2, 'anulado' => 0], $list['totals']);
[$luis, $ana] = $list['passes'];

// La cédula queda cifrada en la base.
$stored = (string) $pdo->query("SELECT cedula_enc FROM golden_passes WHERE full_name = 'Ana Pérez'")->fetchColumn();
same(false, str_contains($stored, '1801234567'));

// Validación por cédula: válido, no permitido si no existe; la cédula viaja en el cuerpo, no en la URL.
$check = $decode($send('POST', '/api/pases-dorados/verificar', ['cedula' => '180-123-4567']))['check'];
same([true, true, 'Ana Pérez', '180•••••67'], [$check['valid'], $check['found'], $check['name'], $check['cedula_masked']]);
$check = $decode($send('POST', '/api/pases-dorados/verificar', ['cedula' => '0102030405']))['check'];
same([false, false], [$check['valid'], $check['found']]);
same(422, $send('POST', '/api/pases-dorados/verificar', ['cedula' => '12345'])->status);
same(405, $router->handle('GET', '/api/pases-dorados/verificar', $origin)->status);

// Anular: la cédula sigue registrada pero sale «no permitido».
same('anulado', $decode($send('PATCH', '/api/pases-dorados/' . $ana['public_id'], ['status' => 'anulado']))['pass']['status']);
$check = $decode($send('POST', '/api/pases-dorados/verificar', ['cedula' => '1801234567']))['check'];
same([false, true], [$check['valid'], $check['found']]);
same(422, $send('PATCH', '/api/pases-dorados/' . $ana['public_id'], ['status' => 'quizas'])->status);
// Corregir la cédula a una que ya tiene otro pase: conflicto.
same(409, $send('PATCH', '/api/pases-dorados/' . $ana['public_id'], ['cedula' => '1709876543'])->status);
same('0601234567', $decode($send('PATCH', '/api/pases-dorados/' . $ana['public_id'], ['cedula' => '0601234567', 'full_name' => 'Ana María Pérez', 'note' => 'Prensa']))['pass']['cedula']);

// QR: página pública mínima, sin sesión.
$public = $decode($router->handle('GET', '/api/pase-dorado/verify/' . $luis['public_id'], ['REMOTE_ADDR' => '192.0.2.92']))['verification'];
same(['valid' => true, 'name' => 'Luis Toapanta', 'cedula_masked' => '170•••••43'], $public);
same(false, $decode($router->handle('GET', '/api/pase-dorado/verify/' . $ana['public_id'], ['REMOTE_ADDR' => '192.0.2.92']))['verification']['valid']);
same(404, $router->handle('GET', '/api/pase-dorado/verify/' . str_repeat('0', 32), ['REMOTE_ADDR' => '192.0.2.92'])->status);

// Retirar: deja de aparecer, su QR ya no es válido y la cédula se puede volver a registrar.
same(200, $send('POST', '/api/pases-dorados/' . $luis['public_id'] . '/archivar')->status);
same(1, $decode($router->handle('GET', '/api/pases-dorados', $origin))['totals']['total']);
same(false, $decode($router->handle('GET', '/api/pase-dorado/verify/' . $luis['public_id'], ['REMOTE_ADDR' => '192.0.2.92']))['verification']['valid']);
same(404, $send('PATCH', '/api/pases-dorados/' . $luis['public_id'], ['status' => 'valido'])->status);
same(1, count($decode($send('POST', '/api/pases-dorados', ['lines' => 'Luis Toapanta 1709876543']))['passes']));
same(3, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'golden_pass.created'")->fetchColumn());
