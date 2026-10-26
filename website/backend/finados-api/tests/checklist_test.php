<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Config;
use Finados\Database;
use Finados\Router;

$root = tempnam(sys_get_temp_dir(), 'finados-checklist-');
if ($root === false || !unlink($root) || !mkdir($root, 0700)) throw new RuntimeException('Unable to create checklist test root.');
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
$pdo->exec(file_get_contents(__DIR__ . '/../migrations/041_checklist_marks_sqlite.sql')); // aplicarla dos veces no falla
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.41'];
$json = [...$origin, 'CONTENT_TYPE' => 'application/json'];
$decode = static fn ($response): array => json_decode($response->body, true, 64, JSON_THROW_ON_ERROR);
$post = static fn (array $body, array $server = []) => $router->handle('POST', '/api/checklist/inauguracion-2026', [...$json, ...$server], json_encode($body));

// Público: se lee sin sesión y empieza vacío.
$empty = $decode($router->handle('GET', '/api/checklist/inauguracion-2026', $origin));
same([], $empty['items']);
same(404, $router->handle('GET', '/api/checklist/otro-tablero', $origin)->status);

// Marcar, escribir un responsable y desmarcar.
same(['c__prensa-0' => '1'], $decode($post(['key' => 'c__prensa-0', 'value' => '1']))['items']);
$post(['key' => 'r__prensa-0', 'value' => '  Ana  ']);
same('Ana', $decode($router->handle('GET', '/api/checklist/inauguracion-2026', $origin))['items']['r__prensa-0']);
$post(['key' => 'r__prensa-0', 'value' => 'Luis']);
same('Luis', $decode($router->handle('GET', '/api/checklist/inauguracion-2026', $origin))['items']['r__prensa-0']);
same(['r__prensa-0' => 'Luis'], $decode($post(['key' => 'c__prensa-0', 'value' => '']))['items']);

// Solo claves con la forma del tablero, textos cortos y desde el sitio.
same(422, $post(['key' => 'x__prensa-0', 'value' => '1'])->status);
same(422, $post(['key' => 'c__Prensa 0', 'value' => '1'])->status);
same(422, $post(['key' => 'r__prensa-1', 'value' => str_repeat('a', 301)])->status);
same(422, $post(['key' => 'r__prensa-1', 'value' => 5])->status);
same(422, $post(['key' => 'r__prensa-1', 'value' => 'a', 'otro' => 1])->status);
same(403, $post(['key' => 'c__prensa-1', 'value' => '1'], ['HTTP_ORIGIN' => 'https://ajeno.invalid'])->status);
same(405, $router->handle('DELETE', '/api/checklist/inauguracion-2026', $origin)->status);
