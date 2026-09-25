<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Router;

$tourRoot = tempnam(sys_get_temp_dir(), 'finados-tour-');
if ($tourRoot === false || !unlink($tourRoot) || !mkdir($tourRoot, 0700)) throw new RuntimeException('Unable to create tour test root.');
register_shutdown_function(static function () use ($tourRoot): void {
    foreach (glob($tourRoot . '/*') ?: [] as $file) is_dir($file) ? null : unlink($file);
    rmdir($tourRoot);
});
file_put_contents($tourRoot . '/config.json', json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('t', 32)), 'hmacKey' => base64_encode(str_repeat('u', 32)),
], JSON_THROW_ON_ERROR));
$config = Config::fromFile($tourRoot . '/config.json');
$pdo = Database::connect($config);
$migrations = glob(__DIR__ . '/../migrations/*_sqlite.sql');
sort($migrations, SORT_STRING);
foreach ($migrations as $migration) $pdo->exec(file_get_contents($migration));
same('031_media_tour', $pdo->query("SELECT version FROM schema_migrations WHERE version = '031_media_tour'")->fetchColumn());
$secret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([str_repeat('e', 32), 'admin', Auth::hashPassword($secret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s')]);

if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.70'];
$decode = static fn ($response): array => json_decode($response->body, true, 64, JSON_THROW_ON_ERROR);
same(401, $router->handle('GET', '/api/media-tour?from=2026-10-26&to=2026-11-02', $origin)->status);
$session = $decode($router->handle('GET', '/api/auth/session', $origin));
$csrf = $decode($router->handle('POST', '/api/auth/login', [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $session['csrf']], json_encode(['username' => 'admin', 'password' => $secret])))['csrf'];
$send = static fn (string $method, string $path, array $body = []) => $router->handle($method, $path, [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $csrf], json_encode((object) $body));

// Dos medios de Seguimiento para visitar.
$medium = static fn (string $name, string $type): array => ['media_name' => $name, 'media_types' => [$type], 'frequency' => '', 'tv_channel' => '', 'province' => 'Tungurahua', 'city' => 'Ambato', 'program_name' => '',
    'representatives' => [], 'channels' => [], 'followers_validated' => null, 'paid_media' => 'no', 'contact_name' => '', 'phone' => '', 'contact_email' => '', 'audience_count' => null, 'radio_genre' => ''];
$radio = $decode($send('POST', '/api/medios', $medium('Radio Centro', 'radio')))['public_id'];
$tv = $decode($send('POST', '/api/medios', $medium('Unimax TV', 'tv')))['public_id'];

// Personas de la gira; el teléfono se guarda cifrado.
$ana = $decode($send('POST', '/api/media-tour/people', ['name' => 'Ana Chango', 'role' => 'Vocera', 'phone' => '0991234567']))['person'];
$luis = $decode($send('POST', '/api/media-tour/people', ['name' => 'Luis Pérez', 'role' => 'Artista']))['person'];
same(['Ana Chango', 'Vocera', '0991234567'], [$ana['name'], $ana['role'], $ana['phone']]);
same(false, str_contains((string) $pdo->query('SELECT phone_enc FROM media_tour_people LIMIT 1')->fetchColumn(), '0991234567'));
same(422, $send('POST', '/api/media-tour/people', ['name' => ''])->status);
same(422, $send('POST', '/api/media-tour/people', ['name' => 'X', 'phone' => 'no es un número'])->status);

// Una cita: medio de Seguimiento, dos personas, día y hora.
$visit = $decode($send('POST', '/api/media-tour/visits', ['media' => $radio, 'people' => [$ana['public_id'], $luis['public_id']], 'starts_at' => '2026-10-28 09:00', 'ends_at' => '2026-10-28 10:00', 'kind' => 'entrevista', 'place' => 'Cabina principal']))['visit'];
same('Radio Centro', $visit['media']['name']);
same(['Ana Chango', 'Luis Pérez'], array_column($visit['people'], 'name'));
same(['2026-10-28 09:00', '2026-10-28 10:00', 'programada'], [$visit['starts_at'], $visit['ends_at'], $visit['status']]);
// Ana no puede estar en otro medio a la misma hora; Luis sí puede ir solo a otra hora.
same(409, $send('POST', '/api/media-tour/visits', ['media' => $tv, 'people' => [$ana['public_id']], 'starts_at' => '2026-10-28 09:30', 'ends_at' => '2026-10-28 10:30'])->status);
same(201, $send('POST', '/api/media-tour/visits', ['media' => $tv, 'people' => [$luis['public_id']], 'starts_at' => '2026-10-28 10:00', 'ends_at' => '2026-10-28 11:00', 'kind' => 'en_vivo'])->status);
// Validaciones: sin personas, medio inexistente, cruza la medianoche, menos de 15 minutos, tipo raro.
foreach ([
    ['media' => $radio, 'people' => [], 'starts_at' => '2026-10-29 09:00', 'ends_at' => '2026-10-29 10:00'],
    ['media' => str_repeat('0', 32), 'people' => [$ana['public_id']], 'starts_at' => '2026-10-29 09:00', 'ends_at' => '2026-10-29 10:00'],
    ['media' => $radio, 'people' => [$ana['public_id']], 'starts_at' => '2026-10-29 23:00', 'ends_at' => '2026-10-30 01:00'],
    ['media' => $radio, 'people' => [$ana['public_id']], 'starts_at' => '2026-10-29 09:00', 'ends_at' => '2026-10-29 09:10'],
    ['media' => $radio, 'people' => [$ana['public_id']], 'starts_at' => '2026-10-29 09:00', 'ends_at' => '2026-10-29 10:00', 'kind' => 'fiesta'],
] as $invalid) same(422, $send('POST', '/api/media-tour/visits', $invalid)->status);

// Mover (solo horas), cambiar estado y medio; el choque se revisa también al editar.
$moved = $decode($send('PATCH', '/api/media-tour/visits/' . $visit['public_id'], ['starts_at' => '2026-10-28 14:00', 'ends_at' => '2026-10-28 15:30']))['visit'];
same(['2026-10-28 14:00', '2026-10-28 15:30', 'Radio Centro'], [$moved['starts_at'], $moved['ends_at'], $moved['media']['name']]);
same(409, $send('PATCH', '/api/media-tour/visits/' . $visit['public_id'], ['starts_at' => '2026-10-28 10:30', 'ends_at' => '2026-10-28 11:00'])->status);
$done = $decode($send('PATCH', '/api/media-tour/visits/' . $visit['public_id'], ['status' => 'realizada', 'media' => $tv, 'note' => 'Salió muy bien']))['visit'];
same(['realizada', 'Unimax TV', 'Salió muy bien'], [$done['status'], $done['media']['name'], $done['note']]);

// Calendario del rango con personas, citas, medios de Seguimiento y totales.
$calendar = $decode($router->handle('GET', '/api/media-tour?from=2026-10-26&to=2026-11-02', $origin));
same(2, count($calendar['visits']));
same(['Radio Centro', 'Unimax TV'], array_column($calendar['media'], 'name'));
same(['visits' => 2, 'done' => 1, 'confirmed' => 0, 'media' => 1, 'people' => 2], $calendar['totals']);
$anaRow = array_values(array_filter($calendar['people'], static fn ($p) => $p['name'] === 'Ana Chango'))[0];
same([1, 1], [$anaRow['visits_count'], $anaRow['done_count']]);
same(422, $router->handle('GET', '/api/media-tour?from=2026-10-26&to=2027-06-01', $origin)->status);

// Quitar la cita y retirar a una persona no borran nada: dejan de verse.
same(200, $send('POST', '/api/media-tour/visits/' . $visit['public_id'] . '/cancelar')->status);
same(1, count($decode($router->handle('GET', '/api/media-tour?from=2026-10-26&to=2026-11-02', $origin))['visits']));
same(1, (int) $pdo->query('SELECT COUNT(*) FROM media_tour_visits WHERE canceled_at IS NOT NULL')->fetchColumn());
same(200, $send('POST', '/api/media-tour/people/' . $ana['public_id'] . '/retirar')->status);
same(['Luis Pérez'], array_column($decode($router->handle('GET', '/api/media-tour?from=2026-10-26&to=2026-11-02', $origin))['people'], 'name'));
same(1, (int) $pdo->query("SELECT COUNT(*) FROM media_tour_people WHERE status = 'Retirada'")->fetchColumn());
same(404, $send('PATCH', '/api/media-tour/people/' . str_repeat('0', 32), ['name' => 'Nadie'])->status);
same(true, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type LIKE 'media.tour_%'")->fetchColumn() >= 7);

if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
