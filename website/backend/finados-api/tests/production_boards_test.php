<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Router;

$prodRoot = tempnam(sys_get_temp_dir(), 'finados-prod-');
if ($prodRoot === false || !unlink($prodRoot) || !mkdir($prodRoot, 0700)) throw new RuntimeException('Unable to create production test root.');
register_shutdown_function(static function () use ($prodRoot): void {
    foreach (glob($prodRoot . '/*') ?: [] as $file) is_dir($file) ? null : unlink($file);
    rmdir($prodRoot);
});
file_put_contents($prodRoot . '/config.json', json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('v', 32)), 'hmacKey' => base64_encode(str_repeat('w', 32)),
], JSON_THROW_ON_ERROR));
$config = Config::fromFile($prodRoot . '/config.json');
$pdo = Database::connect($config);
$migrations = glob(__DIR__ . '/../migrations/*_sqlite.sql');
sort($migrations, SORT_STRING);
foreach ($migrations as $migration) $pdo->exec(file_get_contents($migration));
same('032_production_boards', $pdo->query("SELECT version FROM schema_migrations WHERE version = '032_production_boards'")->fetchColumn());
$secret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([str_repeat('f', 32), 'admin', Auth::hashPassword($secret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s')]);

if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.80'];
$decode = static fn ($response): array => json_decode($response->body, true, 64, JSON_THROW_ON_ERROR);
same(401, $router->handle('GET', '/api/produccion/sol?from=2026-10-26&to=2026-11-02', $origin)->status);
$session = $decode($router->handle('GET', '/api/auth/session', $origin));
$csrf = $decode($router->handle('POST', '/api/auth/login', [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $session['csrf']], json_encode(['username' => 'admin', 'password' => $secret])))['csrf'];
$send = static fn (string $method, string $path, array $body = []) => $router->handle($method, $path, [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $csrf], json_encode((object) $body));
$calendar = static fn (string $board) => $decode($router->handle('GET', "/api/produccion/$board?from=2026-10-26&to=2026-11-02", $origin));

// Un tablero que no existe no responde.
same(404, $router->handle('GET', '/api/produccion/marte?from=2026-10-26&to=2026-11-02', $origin)->status);

// Biblioteca de piezas del Cronograma Sol: nombre, color y duración por defecto.
$show = $decode($send('POST', '/api/produccion/sol/items', ['name' => 'Show principal', 'description' => 'Artista internacional', 'color' => '#6E2CE0', 'duration_minutes' => 90]))['item'];
same(['Show principal', '#6e2ce0', 90, 0], [$show['name'], $show['color'], $show['duration_minutes'], $show['uses']]);
foreach ([['name' => ''], ['name' => 'X', 'color' => 'morado'], ['name' => 'X', 'duration_minutes' => 10], ['name' => 'X', 'duration_minutes' => 50]] as $invalid) {
    same(422, $send('POST', '/api/produccion/sol/items', $invalid)->status);
}

// Arrastrar la pieza a una hora crea un bloque con su nombre y su color.
$entry = $decode($send('POST', '/api/produccion/sol/entries', ['item' => $show['public_id'], 'starts_at' => '2026-10-30 19:00', 'ends_at' => '2026-10-30 20:30']))['entry'];
same(['Show principal', '#6e2ce0', '2026-10-30 19:00', '2026-10-30 20:30', 'planificado', $show['public_id']], [$entry['title'], $entry['color'], $entry['starts_at'], $entry['ends_at'], $entry['status'], $entry['item']]);
// También sin pieza, escribiendo el título.
same(201, $send('POST', '/api/produccion/sol/entries', ['title' => 'Prueba de sonido', 'starts_at' => '2026-10-30 15:00', 'ends_at' => '2026-10-30 16:00', 'owner' => 'Iván', 'place' => 'Tarima'])->status);
foreach ([
    ['title' => '', 'starts_at' => '2026-10-30 15:00', 'ends_at' => '2026-10-30 16:00'],
    ['title' => 'X', 'starts_at' => '2026-10-30 23:00', 'ends_at' => '2026-10-31 01:00'],
    ['title' => 'X', 'starts_at' => '2026-10-30 15:00', 'ends_at' => '2026-10-30 15:10'],
    ['title' => 'X', 'starts_at' => '2026-10-30 15:00', 'ends_at' => '2026-10-30 16:00', 'status' => 'quizás'],
] as $invalid) same(422, $send('POST', '/api/produccion/sol/entries', $invalid)->status);
// Una pieza de otro tablero no se puede usar aquí.
same(404, $send('POST', '/api/produccion/luna/entries', ['item' => $show['public_id'], 'starts_at' => '2026-10-30 19:00', 'ends_at' => '2026-10-30 20:00'])->status);

// Mover y estirar (solo horas) y cambiar el estado.
$moved = $decode($send('PATCH', '/api/produccion/sol/entries/' . $entry['public_id'], ['starts_at' => '2026-10-31 20:00', 'ends_at' => '2026-10-31 22:00']))['entry'];
same(['2026-10-31 20:00', '2026-10-31 22:00', 'Show principal'], [$moved['starts_at'], $moved['ends_at'], $moved['title']]);
same('confirmado', $decode($send('PATCH', '/api/produccion/sol/entries/' . $entry['public_id'], ['status' => 'confirmado']))['entry']['status']);

// Los tableros no se mezclan.
$sol = $calendar('sol');
same(2, count($sol['entries']));
same(['items' => 1, 'entries' => 2, 'confirmed' => 1, 'done' => 0], $sol['totals']);
same(1, $sol['items'][0]['uses']);
same([], $calendar('luna')['entries']);
same([], $calendar('activaciones')['items']);
same(404, $send('PATCH', '/api/produccion/luna/entries/' . $entry['public_id'], ['status' => 'realizado'])->status);

// Archivar la pieza la saca de la biblioteca; sus bloques se quedan. Quitar un bloque no lo borra.
same(200, $send('POST', '/api/produccion/sol/items/' . $show['public_id'] . '/archivar')->status);
same([], $calendar('sol')['items']);
same(2, count($calendar('sol')['entries']));
same(200, $send('POST', '/api/produccion/sol/entries/' . $entry['public_id'] . '/cancelar')->status);
same(1, count($calendar('sol')['entries']));
same(2, (int) $pdo->query('SELECT COUNT(*) FROM production_entries')->fetchColumn());
same(422, $router->handle('GET', '/api/produccion/sol?from=2026-10-26&to=2027-06-01', $origin)->status);
same(true, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type LIKE 'production.%'")->fetchColumn() >= 6);

if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
