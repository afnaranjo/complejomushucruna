<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Router;

$planRoot = tempnam(sys_get_temp_dir(), 'finados-plan-');
if ($planRoot === false || !unlink($planRoot) || !mkdir($planRoot, 0700)) throw new RuntimeException('Unable to create plan test root.');
register_shutdown_function(static function () use ($planRoot): void {
    foreach (glob($planRoot . '/*') ?: [] as $file) unlink($file);
    rmdir($planRoot);
});
file_put_contents($planRoot . '/config.json', json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('p', 32)), 'hmacKey' => base64_encode(str_repeat('q', 32)),
], JSON_THROW_ON_ERROR));
$config = Config::fromFile($planRoot . '/config.json');
$pdo = Database::connect($config);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts', '030_media_plan'] as $migration) $pdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
same('030_media_plan', $pdo->query("SELECT version FROM schema_migrations WHERE version = '030_media_plan'")->fetchColumn());
$secret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([str_repeat('d', 32), 'admin', Auth::hashPassword($secret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s')]);

if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.60'];
$post = static fn (string $csrf): array => [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $csrf];
$decode = static fn ($response): array => json_decode($response->body, true, 64, JSON_THROW_ON_ERROR);

// Sin sesión administrativa no se lee ni se guarda.
same(401, $router->handle('GET', '/api/media-plan', $origin)->status);
$session = $decode($router->handle('GET', '/api/auth/session', $origin));
$login = $decode($router->handle('POST', '/api/auth/login', $post($session['csrf']), json_encode(['username' => 'admin', 'password' => $secret])));
$csrf = $login['csrf'];

// Al principio no hay calendario guardado: versión 0.
same(['data' => null, 'version' => 0, 'updated_at' => null], $decode($router->handle('GET', '/api/media-plan', $origin)));

$plan = [
    'spots' => [['id' => 'general', 'qty' => 1, 'name' => 'AUDIO GENERAL', 'desc' => 'SHOWS + FERIA', 'color' => '#94165E', 'national' => true, 'regional' => true, 'local' => false]],
    'assignments' => [['id' => 'as_1', 'spotId' => 'general', 'weekId' => 'w1', 'start' => '2026-09-21', 'end' => '2026-09-27', 'note' => 'Lanzamiento']],
    'media' => [['id' => 'media_1', 'name' => 'Radio Centro', 'type' => 'Radio', 'coverage' => 'Regional', 'city' => 'Ambato', 'program' => 'Rotativo', 'contact' => '', 'rate' => 12.5, 'status' => 'active', 'notes' => '', 'sourceId' => str_repeat('a', 32)]],
    'plans' => [['id' => 'plan_1', 'mediaId' => 'media_1', 'spotId' => 'general', 'start' => '2026-09-21', 'end' => '2026-09-30', 'freq' => 3, 'cost' => 12.5, 'objective' => 'Alcance']],
];
$saved = $decode($router->handle('POST', '/api/media-plan', $post($csrf), json_encode(['data' => $plan, 'version' => 0])));
same(1, $saved['version']);
same('#94165e', $saved['data']['spots'][0]['color']);
same(12.5, $saved['data']['plans'][0]['cost']);
same(1, $decode($router->handle('GET', '/api/media-plan', $origin))['version']);
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'media.plan_saved'")->fetchColumn());

// Guardar sobre una versión vieja no pisa el trabajo de otra persona.
same(409, $router->handle('POST', '/api/media-plan', $post($csrf), json_encode(['data' => $plan, 'version' => 0]))->status);
$plan['assignments'][0]['note'] = 'Cambio';
same(2, $decode($router->handle('POST', '/api/media-plan', $post($csrf), json_encode(['data' => $plan, 'version' => 1])))['version']);

// Datos inválidos: fuera de campaña, spot inexistente, color raro, campos extra, tipo no permitido.
$bad = static function (callable $change) use ($plan): array { $copy = $plan; $change($copy); return $copy; };
foreach ([
    $bad(static function (&$p) { $p['assignments'][0]['end'] = '2026-12-01'; }),
    $bad(static function (&$p) { $p['assignments'][0]['spotId'] = 'otro'; }),
    $bad(static function (&$p) { $p['spots'][0]['color'] = 'red'; }),
    $bad(static function (&$p) { $p['extra'] = []; }),
    $bad(static function (&$p) { $p['media'][0]['type'] = 'Satélite'; }),
    $bad(static function (&$p) { $p['plans'][0]['mediaId'] = 'nadie'; }),
    $bad(static function (&$p) { $p['plans'][0]['freq'] = 0; }),
    $bad(static function (&$p) { $p['spots'][] = $p['spots'][0]; }),
] as $invalid) {
    same(422, $router->handle('POST', '/api/media-plan', $post($csrf), json_encode(['data' => $invalid, 'version' => 2]))->status);
}
same(2, $decode($router->handle('GET', '/api/media-plan', $origin))['version']);
// Sin CSRF no se guarda.
same(403, $router->handle('POST', '/api/media-plan', [...$origin, 'CONTENT_TYPE' => 'application/json'], json_encode(['data' => $plan, 'version' => 2]))->status);
// Un calendario grande (más de 16 KB) sí entra, porque la ruta tiene su propio tope.
$big = $plan;
for ($i = 0; $i < 200; $i++) $big['assignments'][] = ['id' => 'as_big_' . $i, 'spotId' => 'general', 'weekId' => 'w2', 'start' => '2026-09-28', 'end' => '2026-10-04', 'note' => str_repeat('n', 120)];
$payload = json_encode(['data' => $big, 'version' => 2]);
same(true, strlen($payload) > 16384);
same(3, $decode($router->handle('POST', '/api/media-plan', $post($csrf), $payload))['version']);

if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
