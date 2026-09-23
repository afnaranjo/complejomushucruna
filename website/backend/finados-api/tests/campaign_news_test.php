<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Router;

function news_config(): Config
{
    static $path = null;
    if ($path === null) {
        $root = tempnam(sys_get_temp_dir(), 'finados-news-');
        if ($root === false || !unlink($root) || !mkdir($root, 0700)) throw new RuntimeException('Unable to create news test root.');
        register_shutdown_function(static function () use ($root): void {
            $entries = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
            foreach ($entries as $entry) $entry->isDir() && !$entry->isLink() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
            rmdir($root);
        });
        $path = $root . '/config.json';
        file_put_contents($path, json_encode([
            'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
            'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('n', 32)), 'hmacKey' => base64_encode(str_repeat('w', 32)),
        ], JSON_THROW_ON_ERROR));
    }
    return Config::fromFile($path);
}
function news_body($response): array
{
    $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($body)) throw new RuntimeException('Expected JSON object.');
    return $body;
}
function news_json(array $payload): string { return json_encode($payload, JSON_THROW_ON_ERROR); }

if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
$config = news_config();
$pdo = Database::connect($config);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts', '024_campaign_news'] as $migration) {
    $pdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
}
same('024_campaign_news', $pdo->query("SELECT version FROM schema_migrations WHERE version = '024_campaign_news'")->fetchColumn());
// El mapa maestro llega sembrado con sus siete tramos.
same(7, (int) $pdo->query('SELECT COUNT(*) FROM campaign_phases')->fetchColumn());

$adminSecret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([
    str_repeat('b', 32), 'admin', Auth::hashPassword($adminSecret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'),
]);
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.99'];
$json = static fn (string $csrf): array => [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $csrf];

// Las noticias son del equipo: sin sesión administrativa no se leen ni se cambian.
same(401, $router->handle('GET', '/api/noticias', $origin)->status);
same(401, $router->handle('POST', '/api/noticias/fases', $origin, news_json(['title' => 'x']))->status);

if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
$session = news_body($router->handle('GET', '/api/auth/session', $origin));
$admin = news_body($router->handle('POST', '/api/auth/login', $json($session['csrf']), news_json(['username' => 'admin', 'password' => $adminSecret])));
$csrf = $admin['csrf'];

$overview = news_body($router->handle('GET', '/api/noticias', $origin));
same(7, count($overview['phases']));
same(true, (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $overview['today']));
// El primer tramo del mapa es el que Alex tiene en su presentación.
same('Fundamentos', $overview['phases'][0]['title']);
same('2026-08-25', $overview['phases'][0]['starts_on']);
same('Cierre', $overview['phases'][6]['title']);
same('2026-11-03', $overview['phases'][6]['ends_on']);
// Hoy cae dentro de la campaña, así que hay tramo en curso y se conoce el siguiente.
same(true, $overview['current'] !== null || $overview['next'] !== null);
if ($overview['current'] !== null) {
    same(true, $overview['current']['starts_on'] <= $overview['today']);
    same(true, $overview['current']['ends_on'] >= $overview['today']);
}
if ($overview['current'] !== null && $overview['next'] !== null) {
    same(true, $overview['next']['starts_on'] > $overview['today'], 'el siguiente empieza después de hoy');
}

// Coordinación agrega, corrige y quita tramos del mapa.
same(422, $router->handle('POST', '/api/noticias/fases', $json($csrf), news_json(['title' => '', 'starts_on' => '2026-11-04', 'ends_on' => '2026-11-06']))->status);
same(422, $router->handle('POST', '/api/noticias/fases', $json($csrf), news_json(['title' => 'Post feria', 'starts_on' => '2026-11-06', 'ends_on' => '2026-11-04']))->status);
same(422, $router->handle('POST', '/api/noticias/fases', $json($csrf), news_json(['title' => 'Post feria', 'starts_on' => '2026-11-04', 'ends_on' => '2026-11-06', 'accent' => 'rojo']))->status);
same(422, $router->handle('POST', '/api/noticias/fases', $json($csrf), news_json(['title' => 'Fuera de rango', 'starts_on' => '2025-01-01', 'ends_on' => '2025-01-05']))->status);
$creado = news_body($router->handle('POST', '/api/noticias/fases', $json($csrf), news_json([
    'title' => 'Post feria', 'detail' => 'Cierre y aprendizajes', 'starts_on' => '2026-11-04', 'ends_on' => '2026-11-10', 'accent' => '#1C6854'])));
same(8, count($creado['phases']));
same('#1c6854', $creado['phases'][7]['accent']);
$nuevo = $creado['phases'][7]['public_id'];
$editado = news_body($router->handle('PATCH', '/api/noticias/fases/' . $nuevo, $json($csrf), news_json(['title' => 'Post feria 2026'])));
same('Post feria 2026', $editado['phases'][7]['title']);
same('2026-11-04', $editado['phases'][7]['starts_on'], 'editar solo el tema conserva las fechas');
same(8, count(news_body($router->handle('GET', '/api/noticias', $origin))['phases']));
same(7, count(news_body($router->handle('POST', '/api/noticias/fases/' . $nuevo, $json($csrf), ''))['phases']));
same(422, $router->handle('POST', '/api/noticias/fases/' . str_repeat('e', 32), $json($csrf), '')->status);

// Un aviso puntual se ve mientras está vigente y desaparece solo al pasar su fecha.
$hoy = $overview['today'];
$vigente = news_body($router->handle('POST', '/api/noticias/avisos', $json($csrf), news_json([
    'body' => 'Esta semana grabamos con el equipo de audiovisual.', 'starts_on' => $hoy, 'ends_on' => $hoy])));
same(1, count($vigente['notices']));
$viejo = news_body($router->handle('POST', '/api/noticias/avisos', $json($csrf), news_json([
    'body' => 'Aviso del mes pasado.', 'starts_on' => '2026-08-01', 'ends_on' => '2026-08-05'])));
same(1, count($viejo['notices']), 'un aviso vencido no llega a la banda');
same(2, count($viejo['all_notices']), 'pero sigue en la sección de Noticias');
same(422, $router->handle('POST', '/api/noticias/avisos', $json($csrf), news_json(['body' => '   ']))->status);
same(422, $router->handle('POST', '/api/noticias/avisos', $json($csrf), news_json(['body' => 'x', 'starts_on' => '2026-10-10', 'ends_on' => '2026-10-01']))->status);
// Un aviso sin fechas se muestra siempre.
same(2, count(news_body($router->handle('POST', '/api/noticias/avisos', $json($csrf), news_json(['body' => 'Aviso permanente.'])))['notices']));
$quitado = news_body($router->handle('POST', '/api/noticias/avisos/' . $vigente['notices'][0]['public_id'], $json($csrf), ''));
same(1, count($quitado['notices']));

same(404, $router->handle('GET', '/api/noticias/otra-cosa', $origin)->status);
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
