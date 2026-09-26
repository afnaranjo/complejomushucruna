<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Router;

$editRoot = tempnam(sys_get_temp_dir(), 'finados-edit-');
if ($editRoot === false || !unlink($editRoot) || !mkdir($editRoot, 0700)) throw new RuntimeException('Unable to create editing test root.');
register_shutdown_function(static function () use ($editRoot): void {
    foreach (glob($editRoot . '/*') ?: [] as $file) is_dir($file) ? null : unlink($file);
    rmdir($editRoot);
});
file_put_contents($editRoot . '/config.json', json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('d', 32)),
], JSON_THROW_ON_ERROR));
$config = Config::fromFile($editRoot . '/config.json');
$pdo = Database::connect($config);
$migrations = glob(__DIR__ . '/../migrations/*_sqlite.sql');
sort($migrations, SORT_STRING);
foreach ($migrations as $migration) $pdo->exec(file_get_contents($migration));
same('033_creadora_editing', $pdo->query("SELECT version FROM schema_migrations WHERE version = '033_creadora_editing'")->fetchColumn());
$secret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([str_repeat('e', 32), 'admin', Auth::hashPassword($secret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s')]);

if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.90'];
$decode = static fn ($response): array => json_decode($response->body, true, 64, JSON_THROW_ON_ERROR);
same(401, $router->handle('GET', '/api/creadoras/edicion', $origin)->status);
$session = $decode($router->handle('GET', '/api/auth/session', $origin));
$csrf = $decode($router->handle('POST', '/api/auth/login', [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $session['csrf']], json_encode(['username' => 'admin', 'password' => $secret])))['csrf'];
$send = static fn (string $method, string $path, array $body = []) => $router->handle($method, $path, [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $csrf], json_encode((object) $body));
$queue = static fn (): array => $decode($router->handle('GET', '/api/creadoras/edicion', $origin));

// Dos creadoras en un mismo turno, con dos guiones en el cuaderno.
$ana = $decode($send('POST', '/api/creadoras', ['full_name' => 'Ana Prueba']))['creadora']['public_id'];
$eva = $decode($send('POST', '/api/creadoras', ['full_name' => 'Eva Prueba']))['creadora']['public_id'];
$shift = $decode($send('POST', '/api/creadoras/turnos', ['creadoras' => [$ana, $eva], 'starts_at' => '2026-10-05 10:00', 'ends_at' => '2026-10-05 13:00']))['shift']['public_id'];
$scripts = $decode($send('POST', "/api/creadoras/turnos/$shift/guiones", ['title' => 'Recorrido', 'body' => "Plano 1: entrada\nPlano 2: stands", 'creadora' => $ana]))['shift']['scripts'];
$recorrido = $scripts[0]['public_id'];
$scripts = $decode($send('POST', "/api/creadoras/turnos/$shift/guiones", ['title' => 'Colada morada', 'body' => 'Probar la colada', 'recorded' => true]))['shift']['scripts'];
$colada = $scripts[1]['public_id'];

// Un video que salió del guion y otro creado nuevo, sin guion.
$content = $decode($send('POST', "/api/creadoras/turnos/$shift/contenido", ['kind' => 'video', 'title' => 'Recorrido final', 'url' => 'https://example.invalid/v1', 'creadora' => $ana, 'script' => $recorrido]))['shift']['content'];
same([$recorrido, 'Recorrido', false], [$content[0]['script'], $content[0]['script_title'], $content[0]['edited']]);
$content = $decode($send('POST', "/api/creadoras/turnos/$shift/contenido", ['kind' => 'video', 'title' => 'Baile espontáneo', 'creadora' => $eva]))['shift']['content'];
$fromScript = $content[0]['public_id'];
$fresh = $content[1]['public_id'];
same('', $content[1]['script']);
// Un guion de otro turno no se puede ligar.
same(422, $send('POST', "/api/creadoras/turnos/$shift/contenido", ['kind' => 'video', 'title' => 'X', 'creadora' => $ana, 'script' => str_repeat('a', 32)])->status);

// La cola: los dos videos y el guion grabado que todavía no tiene video (Colada morada).
$data = $queue();
same(['total' => 3, 'pending' => 3, 'edited' => 0, 'with_script' => 2, 'new' => 1], $data['totals']);
$byId = array_column($data['items'], null, 'public_id');
same(["Plano 1: entrada\nPlano 2: stands", true], [$byId[$fromScript]['script']['body'], $byId[$fromScript]['has_script']]);
same([false, null, 2], [$byId[$fresh]['has_script'], $byId[$fresh]['script'], count($byId[$fresh]['script_options'])]);
same(['script', 'Probar la colada', 'Para todas: Ana Prueba, Eva Prueba'], [$byId[$colada]['type'], $byId[$colada]['script']['body'], $byId[$colada]['creadora_name']]);
same('Eva Prueba', $byId[$fresh]['creadora_name']);

// El editor marca como editado, con enlace y nota; y lo puede devolver a pendiente.
$data = $decode($send('PATCH', "/api/creadoras/edicion/contenido/$fresh", ['edited' => true, 'edited_url' => 'https://example.invalid/final', 'edit_note' => 'Con subtítulos']));
$byId = array_column($data['items'], null, 'public_id');
same([true, 'admin', 'https://example.invalid/final', 'Con subtítulos'], [$byId[$fresh]['edited'], $byId[$fresh]['edited_by'], $byId[$fresh]['edited_url'], $byId[$fresh]['edit_note']]);
same(['pending' => 2, 'edited' => 1], array_intersect_key($data['totals'], ['pending' => 0, 'edited' => 0]));
same(422, $send('PATCH', "/api/creadoras/edicion/contenido/$fresh", ['edited_url' => 'http://inseguro'])->status);
same(422, $send('PATCH', "/api/creadoras/edicion/guion/$colada", ['script' => $recorrido])->status);
same(422, $send('PATCH', "/api/creadoras/edicion/contenido/$fresh", ['borrar' => true])->status);
same(true, $decode($send('PATCH', "/api/creadoras/edicion/guion/$colada", ['edited' => true]))['totals']['edited'] === 2);
$data = $decode($send('PATCH', "/api/creadoras/edicion/contenido/$fresh", ['edited' => false]));
$byId = array_column($data['items'], null, 'public_id');
same([false, '', 'https://example.invalid/final'], [$byId[$fresh]['edited'], $byId[$fresh]['edited_by'], $byId[$fresh]['edited_url']]);

// Corregir de qué guion salió: el creado nuevo se liga a Colada y el guion suelto sale de la cola.
$data = $decode($send('PATCH', "/api/creadoras/edicion/contenido/$fresh", ['script' => $colada]));
$byId = array_column($data['items'], null, 'public_id');
same([true, 'Colada morada'], [$byId[$fresh]['has_script'], $byId[$fresh]['script']['title']]);
same(false, isset($byId[$colada]));
same(2, $data['totals']['total']);

// Quitar un guion no borra el video: solo lo deja sin guion.
$send('POST', "/api/creadoras/turnos/$shift/guiones/$colada");
$byId = array_column($queue()['items'], null, 'public_id');
same([true, false], [isset($byId[$fresh]), $byId[$fresh]['has_script']]);

// Un turno quitado no aparece en edición, pero sus datos siguen guardados.
$send('POST', "/api/creadoras/turnos/$shift");
same(0, $queue()['totals']['total']);
same(2, (int) $pdo->query('SELECT COUNT(*) FROM creadora_shift_content')->fetchColumn());

// Todo queda en la bitácora del calendario.
$details = array_column($decode($router->handle('GET', '/api/creadoras/bitacora', $origin))['log'], 'detail');
same(true, in_array('Marcó como editado: Baile espontáneo', $details, true));
same(true, in_array('Ligó al guion: Baile espontáneo', $details, true));
