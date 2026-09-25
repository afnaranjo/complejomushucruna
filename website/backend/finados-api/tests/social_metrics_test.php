<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';
require_once __DIR__ . '/../src/SocialMetrics.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Router;
use Finados\SocialMetrics;

$socialRoot = tempnam(sys_get_temp_dir(), 'finados-social-');
if ($socialRoot === false || !unlink($socialRoot) || !mkdir($socialRoot, 0700)) throw new RuntimeException('Unable to create social test root.');
register_shutdown_function(static function () use ($socialRoot): void {
    $entries = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($socialRoot, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($entries as $entry) $entry->isDir() && !$entry->isLink() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
    rmdir($socialRoot);
});
$now = new DateTimeImmutable('2026-09-24 15:00', new DateTimeZone('America/Guayaquil'));

// Sin archivo de configuración la sección avisa que falta conectarla, sin llamar a nadie.
$called = 0;
$social = new SocialMetrics($socialRoot, static function () use (&$called): array { $called++; return []; }, $now);
same(['configured' => false], $social->report('2026-09-01', '2026-09-10'));
same(0, $called);

// Solo se acepta la marca de Finados: cualquier otra marca en la configuración se rechaza.
file_put_contents($socialRoot . '/metricool-config.json', json_encode(['token' => str_repeat('A', 64), 'userId' => 1814962, 'blogId' => 2205500]));
throws(static fn () => $social->report('2026-09-01', '2026-09-10'), RuntimeException::class);
file_put_contents($socialRoot . '/metricool-config.json', json_encode(['token' => str_repeat('A', 64), 'userId' => 1814962, 'blogId' => SocialMetrics::FINADOS_BLOG_ID]));

// Periodo del 11 al 20 de septiembre; el anterior equivalente es del 1 al 10.
$daily = static function (string $from, int $days, callable $value): array {
    $points = [];
    for ($i = 0; $i < $days; $i++) $points[] = ['dateTime' => date('Y-m-d', strtotime("$from +$i day")) . 'T12:00:00+0200', 'value' => $value($i)];
    return $points;
};
$seen = [];
$fake = static function (array $urls, string $token) use (&$seen, $daily): array {
    $out = [];
    foreach ($urls as $url) {
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        $seen[] = $query + ['token' => $token];
        $values = match ($query['network'] . '/' . $query['metric']) {
            'instagram/Followers' => $daily('2026-08-31', 21, static fn (int $i) => 1000 + 10 * $i), // 31 ago = 1000 … 20 sep = 1200
            'instagram/views' => $daily('2026-09-01', 20, static fn (int $i) => $i < 10 ? 100 : 300),
            'instagram/postsInteractions' => $daily('2026-09-01', 20, static fn (int $i) => $i < 10 ? 5 : 30),
            'facebookAds/spend' => $daily('2026-09-01', 20, static fn (int $i) => $i < 10 ? 2 : 5),
            'facebookAds/clicks' => $daily('2026-09-01', 20, static fn (int $i) => 10),
            'facebookAds/impressions' => $daily('2026-09-01', 20, static fn (int $i) => 1000),
            'tiktok/likes' => $daily('2026-09-11', 10, static fn (int $i) => 4),
            'tiktok/shares' => $daily('2026-09-11', 10, static fn (int $i) => 1),
            default => [],
        };
        $out[] = $query['metric'] === 'comments' ? [500, false] : [200, json_encode(['data' => [['metric' => $query['metric'], 'values' => $values]]])];
    }
    return $out;
};
$social = new SocialMetrics($socialRoot, $fake, $now);
$report = $social->report('2026-09-11', '2026-09-20');
same(true, $report['configured']);
same(false, $report['cached']);
same(true, $report["incomplete"]);
same(null, array_values(array_filter($report["networks"], static fn ($n) => $n["key"] === "tiktok"))[0]["metrics"]["interactions"]["previous"]);
same(['from' => '2026-09-01', 'to' => '2026-09-10'], $report['previous']);
same(10, $report['range']['days']);
// Todas las consultas van a la marca de Finados y el token viaja fuera de la URL.
same([SocialMetrics::FINADOS_BLOG_ID], array_values(array_unique(array_map(static fn ($q) => (int) $q['blogId'], $seen))));
same('2026-09-01T00:00:00', $seen[0]['from']);
same(false, str_contains(json_encode($seen[0]['from'] . $seen[0]['to']), 'AAAA'));

$instagram = array_values(array_filter($report['networks'], static fn ($n) => $n['key'] === 'instagram'))[0];
same(1200.0, $instagram['followers']['end']);
same(1100.0, $instagram['followers']['start']);
same(100.0, $instagram['followers']['net']);
same(100.0, $instagram['followers']['previous_net']);
same(9.09, $instagram['followers']['growth_pct']);
same(['current' => 3000.0, 'previous' => 1000.0], $instagram['metrics']['views']);
same(['current' => 10.0, 'previous' => 5.0], $instagram['metrics']['engagement_rate']);
same(10, count($instagram['series']['followers']));
$tiktok = array_values(array_filter($report['networks'], static fn ($n) => $n['key'] === 'tiktok'))[0];
same(50.0, $tiktok['metrics']['interactions']['current']);
same(['spend' => 50.0, 'impressions' => 10000.0, 'reach' => null, 'clicks' => 100.0, 'ctr' => 1.0, 'cpc' => 0.5, 'cpm' => 5.0], $report['ads']['current']);
same(20.0, $report['ads']['previous']['spend']);
same(['current' => 0.5, 'previous' => 0.2], $report['totals']['cost_per_follower']);

// La segunda lectura del mismo rango sale de la caché; `refresh` vuelve a consultar.
$before = count($seen);
same(true, $social->report('2026-09-11', '2026-09-20')['cached']);
same($before, count($seen));
same(false, $social->report('2026-09-11', '2026-09-20', true)['cached']);

// Fechas inválidas, invertidas, futuras o de más de un año se rechazan.
throws(static fn () => $social->report('2026-09-20', '2026-09-11'), InvalidArgumentException::class);
throws(static fn () => $social->report('2026-09-01', '2026-09-25'), InvalidArgumentException::class);
throws(static fn () => $social->report('2025-01-01', '2026-09-20'), InvalidArgumentException::class);
throws(static fn () => $social->report('2026-9-1', '2026-09-20'), InvalidArgumentException::class);

// Si Metricool no responde nada, el error es explícito.
throws(static fn () => (new SocialMetrics($socialRoot, static fn (array $urls) => array_fill(0, count($urls), [0, false]), $now))->report('2026-08-01', '2026-08-02'), RuntimeException::class);

// La ruta exige sesión administrativa y valida el rango.
mkdir($socialRoot . '/router', 0700);
$configPath = $socialRoot . '/router/config.json';
file_put_contents($configPath, json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('s', 32)), 'hmacKey' => base64_encode(str_repeat('m', 32)),
], JSON_THROW_ON_ERROR));
$config = Config::fromFile($configPath);
$pdo = Database::connect($config);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts'] as $migration) $pdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
$secret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([str_repeat('c', 32), 'admin', Auth::hashPassword($secret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s')]);
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.50'];
same(401, $router->handle('GET', '/api/redes-sociales?from=2026-09-01&to=2026-09-10', $origin)->status);
$session = json_decode($router->handle('GET', '/api/auth/session', $origin)->body, true);
$router->handle('POST', '/api/auth/login', [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $session['csrf']], json_encode(['username' => 'admin', 'password' => $secret]));
same(422, $router->handle('GET', '/api/redes-sociales?from=2026-09-01', $origin)->status);
same(422, $router->handle('GET', '/api/redes-sociales?from=2026-09-01&to=2026-09-10&blogId=1', $origin)->status);
same(403, $router->handle('POST', '/api/redes-sociales?from=2026-09-01&to=2026-09-10', $origin)->status);
// La base del test no tiene archivo de Metricool: la sección responde «sin configurar».
same(['configured' => false], json_decode($router->handle('GET', '/api/redes-sociales?from=2026-09-01&to=2026-09-10', $origin)->body, true));
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
