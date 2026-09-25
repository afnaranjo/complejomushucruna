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
    foreach (glob($planRoot . '/*') ?: [] as $file) is_dir($file) ? null : unlink($file);
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

// Guion de la voz y audio de cada spot.
$store = new Finados\MediaPlanStore($pdo, new Finados\Audit($pdo, new Finados\Crypto($config)), $planRoot);
$wav = $planRoot . '/voz.wav';
$samples = str_repeat(pack('v', 0), 800);
file_put_contents($wav, 'RIFF' . pack('V', 36 + strlen($samples)) . 'WAVEfmt ' . pack('VvvVVvv', 16, 1, 1, 8000, 16000, 2, 16) . 'data' . pack('V', strlen($samples)) . $samples);
$audio = $store->saveAudio($wav, filesize($wav), 'Spot general "final".wav', 1, '192.0.2.60');
same(true, (bool) preg_match('/^[a-f0-9]{32}$/', $audio['id']));
same('Spot general final.wav', $audio['name']);
same(true, in_array($audio['type'], ['audio/x-wav', 'audio/wav', 'audio/wave'], true));
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'media.plan_audio_uploaded'")->fetchColumn());
// Un archivo que no es audio se rechaza aunque se llame .mp3.
$fake = $planRoot . '/falso.mp3';
file_put_contents($fake, '<?php echo 1;');
throws(static fn () => $store->saveAudio($fake, filesize($fake), 'falso.mp3', 1, '192.0.2.60'), InvalidArgumentException::class);
throws(static fn () => $store->saveAudio($wav, Finados\MediaPlanStore::AUDIO_BYTES + 1, 'grande.wav', 1, '192.0.2.60'), InvalidArgumentException::class);
// El spot guarda su guion (con saltos de línea) y la referencia al audio.
$withAudio = $plan;
$withAudio['spots'][0]['script'] = "LOCUTOR: ¡Llega Finados 2026!\nDel 30 de octubre al 2 de noviembre.";
$withAudio['spots'][0]['audio'] = $audio;
$savedAudio = $decode($router->handle('POST', '/api/media-plan', $post($csrf), json_encode(['data' => $withAudio, 'version' => 3])));
same("LOCUTOR: ¡Llega Finados 2026!\nDel 30 de octubre al 2 de noviembre.", $savedAudio['data']['spots'][0]['script']);
same($audio['id'], $savedAudio['data']['spots'][0]['audio']['id']);
$badAudio = $withAudio; $badAudio['spots'][0]['audio']['type'] = 'application/pdf';
same(422, $router->handle('POST', '/api/media-plan', $post($csrf), json_encode(['data' => $badAudio, 'version' => 4]))->status);
$longScript = $withAudio; $longScript['spots'][0]['script'] = str_repeat('a', Finados\MediaPlanStore::SCRIPT_CHARS + 1);
same(422, $router->handle('POST', '/api/media-plan', $post($csrf), json_encode(['data' => $longScript, 'version' => 4]))->status);
// Descarga: el mismo archivo, como adjunto, sin caché y con el nombre original.
$download = $router->handle('GET', '/api/media-plan/audio/' . $audio['id'], $origin);
same(200, $download->status);
same(file_get_contents($wav), $download->body);
same('private, no-store', $download->headers['Cache-Control']);
same(true, str_starts_with($download->headers['Content-Disposition'], 'attachment; filename="Spot general final.wav"'));
same(404, $router->handle('GET', '/api/media-plan/audio/' . str_repeat('0', 32), $origin)->status);
// La subida exige multipart y un archivo realmente recibido por PHP.
same(415, $router->handle('POST', '/api/media-plan/audio', $post($csrf), '{}')->status);
same(422, $router->handle('POST', '/api/media-plan/audio', [...$origin, 'CONTENT_TYPE' => 'multipart/form-data; boundary=x', 'HTTP_X_CSRF_TOKEN' => $csrf], '', [], ['audio' => ['tmp_name' => $wav, 'size' => filesize($wav), 'error' => UPLOAD_ERR_OK, 'name' => 'x.wav']])->status);
same(413, $router->handle('POST', '/api/media-plan/audio', [...$origin, 'CONTENT_TYPE' => 'multipart/form-data; boundary=x', 'CONTENT_LENGTH' => (string) (Finados\MediaPlanStore::AUDIO_BYTES * 2), 'HTTP_X_CSRF_TOKEN' => $csrf], '', [], [])->status);
foreach (glob($planRoot . '/media-plan-audio/*') ?: [] as $file) unlink($file);
rmdir($planRoot . '/media-plan-audio');
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
