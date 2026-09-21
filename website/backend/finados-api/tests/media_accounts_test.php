<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\MediaRepository;
use Finados\Router;

function media_config(): Config
{
    return Config::fromFile(temp_file(json_encode([
        'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
        'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
    ], JSON_THROW_ON_ERROR)));
}
function media_body($response): array
{
    $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($body)) throw new RuntimeException('Expected JSON object.');
    return $body;
}
function media_close_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    session_id('');
    $_SESSION = [];
}
function media_json(array $payload): string { return json_encode($payload, JSON_THROW_ON_ERROR); }

media_close_session();
$config = media_config();
$pdo = Database::connect($config);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts', '008_media_accounts', '009_media_videos', '010_media_video_views'] as $migration) {
    $pdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
}
same('008_media_accounts', $pdo->query("SELECT version FROM schema_migrations WHERE version = '008_media_accounts'")->fetchColumn());
$adminSecret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([
    str_repeat('a', 32), 'admin', Auth::hashPassword($adminSecret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'),
]);
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.50'];
$json = static fn (string $csrf): array => [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $csrf];

// The media scope has its own cookie and never shares the Vocero or admin session.
$session = media_body($router->handle('GET', '/api/media/auth/session', $origin));
same(false, $session['authenticated']);
same('finados_media', session_name());
$secret = 'frase segura del medio';
same(422, $router->handle('POST', '/api/media/auth/register', $json($session['csrf']), media_json(['email' => 'radio@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true, 'role' => 'admin']))->status);
same(403, $router->handle('POST', '/api/media/auth/register', ['REMOTE_ADDR' => '192.0.2.50', 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $session['csrf']], media_json(['email' => 'radio@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true]))->status);
$created = $router->handle('POST', '/api/media/auth/register', $json($session['csrf']), media_json(['email' => 'radio@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true]));
$duplicate = $router->handle('POST', '/api/media/auth/register', $json($session['csrf']), media_json(['email' => 'RADIO@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true]));
same(202, $created->status);
same($created->body, $duplicate->body);
same(1, (int) $pdo->query('SELECT COUNT(*) FROM media_accounts')->fetchColumn());
same(0, (int) $pdo->query('SELECT COUNT(*) FROM vocero_accounts')->fetchColumn());
same(401, $router->handle('GET', '/api/media/profile', $origin)->status);
// A rejected session is destroyed, so the client requests a fresh CSRF token.
$session = media_body($router->handle('GET', '/api/media/auth/session', $origin));
same(401, $router->handle('POST', '/api/media/auth/login', $json($session['csrf']), media_json(['email' => 'radio@example.invalid', 'password' => 'otra frase distinta']))->status);
$login = media_body($router->handle('POST', '/api/media/auth/login', $json($session['csrf']), media_json(['email' => 'radio@example.invalid', 'password' => $secret])));
same(true, $login['authenticated']);
same('media', $login['user']['role']);

$empty = media_body($router->handle('GET', '/api/media/profile', $origin));
same(false, $empty['registered']);
same('radio@example.invalid', $empty['email']);
$record = ['media_name' => 'Radio Prueba', 'frequency_channel' => '99.9 FM', 'social_link' => 'facebook.com/radioprueba', 'conditions_accepted' => true];
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'social_link' => 'javascript:alert(1)']))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'people_count' => 2]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'conditions_accepted' => false]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'status' => 'Aprobado']))->status);
same(403, $router->handle('POST', '/api/media/profile', $json('token-incorrecto'), media_json($record))->status);
// Videos need a saved record first.
$login = ['csrf' => media_body($router->handle('GET', '/api/media/auth/session', $origin))['csrf']] + $login;
same(403, $router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'https://www.tiktok.com/@radio/video/1']))->status);
$saved = media_body($router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json($record)));
same(true, $saved['registered']);
same('Nuevo', $saved['status']);
same(true, $saved['editable']);
same('https://facebook.com/radioprueba', $saved['social_link']);
same([], $saved['videos']);
same(false, array_key_exists('people_count', $saved));
$updated = media_body($router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'frequency_channel' => '101.5 FM'])));
same('101.5 FM', $updated['frequency_channel']);
same(1, (int) $pdo->query('SELECT COUNT(*) FROM media_profiles')->fetchColumn());
// The medium keeps adding the links of what it published.
$firstVideo = media_body($router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'https://www.tiktok.com/@radio/video/1'])));
same(1, count($firstVideo['videos']));
same(201, $router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'youtube.com/watch?v=abc']))->status);
same(409, $router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'https://www.TikTok.com/@radio/video/1']))->status);
same(422, $router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'no es un link']))->status);
same(422, $router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'https://a.example/v', 'otro' => 1]))->status);
same(2, count(media_body($router->handle('GET', '/api/media/profile', $origin))['videos']));
$publicId = $updated['public_id'];
media_close_session();
// Administrative routes require the separate admin session.
same(401, $router->handle('GET', '/api/medios', $origin)->status);
media_close_session();

$adminSession = media_body($router->handle('GET', '/api/auth/session', $origin));
$adminLogin = media_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), media_json(['username' => 'admin', 'password' => $adminSecret])));
same(true, $adminLogin['authenticated']);
$admin = $json($adminLogin['csrf']);
$list = media_body($router->handle('GET', '/api/medios?search=prueba&status=Nuevo&page=1&pageSize=25', $origin));
same(1, $list['pagination']['total']);
same('Radio Prueba', $list['items'][0]['media_name']);
same(false, array_key_exists('phone', $list['items'][0]));
same(1, $list['summary']['byStatus']['Nuevo']);
same(2, $list['summary']['videos']);
same(2, $list['items'][0]['videos_count']);
same(422, $router->handle('GET', '/api/medios?media_type=TV', $origin)->status);
same(422, $router->handle('GET', '/api/medios?status=Inventado', $origin)->status);
$detail = media_body($router->handle('GET', '/api/medios/' . $publicId, $origin));
same('https://facebook.com/radioprueba', $detail['social_link']);
same('https://youtube.com/watch?v=abc', $detail['videos'][0]['url']);
same('radio@example.invalid', $detail['account_email']);
// Administration validates the views beside each reported link; they feed the Top 20.
same([], $list['topViews']);
same(false, array_key_exists('views_count', media_body($router->handle('GET', '/api/medios/' . $publicId, $origin))['videos'][0]) === false);
$videoIds = array_column($detail['videos'], 'id', 'url');
same(2, count($videoIds));
$tiktok = $videoIds['https://www.tiktok.com/@radio/video/1']; $youtube = $videoIds['https://youtube.com/watch?v=abc'];
same(['ok' => true], media_body($router->handle('PATCH', '/api/medios/' . $publicId . '/video-views', $admin, media_json(['video_views' => [(string) $tiktok => 1500, (string) $youtube => 800]]))));
same(422, $router->handle('PATCH', '/api/medios/' . $publicId . '/video-views', $admin, media_json(['video_views' => ['999999' => 10]]))->status);
same(422, $router->handle('PATCH', '/api/medios/' . $publicId . '/video-views', $admin, media_json(['video_views' => [(string) $tiktok => -1]]))->status);
same(422, $router->handle('PATCH', '/api/medios/' . $publicId . '/video-views', $admin, media_json(['video_views' => [(string) $tiktok => '1500']]))->status);
$ranked = media_body($router->handle('GET', '/api/medios', $origin));
same(1, count($ranked['topViews']));
same('Radio Prueba', $ranked['topViews'][0]['media_name']);
same(2300, $ranked['topViews'][0]['views_total']);
same(1500, $ranked['topViews'][0]['best_video_views']);
same(2300, $ranked['items'][0]['views_total']);
same(2300, $ranked['summary']['views']);
same(422, $router->handle('PATCH', '/api/medios/' . $publicId, $admin, media_json(['status' => 'Eliminado']))->status);
same(['ok' => true], media_body($router->handle('PATCH', '/api/medios/' . $publicId, $admin, media_json(['status' => 'Aprobado']))));
same(201, $router->handle('POST', '/api/medios/' . $publicId . '/notes', $admin, media_json(['body' => 'Credenciales listas.']))->status);
$detail = media_body($router->handle('GET', '/api/medios/' . $publicId, $origin));
same('Aprobado', $detail['status']);
same('Credenciales listas.', $detail['notes'][0]['body']);
$export = $router->handle('POST', '/api/medios/export', $admin, media_json(['status' => 'Aprobado']));
same(200, $export->status);
same(true, str_contains($export->body, 'Radio Prueba'));
same(true, str_contains($export->body, 'https://www.tiktok.com/@radio/video/1 (1500 views)'));
same(true, str_contains($export->body, ',2300,'));
same('text/csv; charset=utf-8', $export->headers['Content-Type']);
$reset = media_body($router->handle('POST', '/api/medios/' . $publicId . '/password-reset', $admin, '{}'));
same(1, preg_match('~^https://example\.invalid/finados/medios/restablecer/\?token=([a-f0-9]{64})$~D', $reset['resetUrl'], $token));
same(404, $router->handle('GET', '/api/medios/' . str_repeat('f', 32), $origin)->status);
same(405, $router->handle('PATCH', '/api/medios', $admin, '{}')->status);
// Existing Voceros administration keeps working beside the new routes.
same(200, $router->handle('GET', '/api/voceros', $origin)->status);
media_close_session();

// An approved record is read-only for its owner; the recovery link replaces the password.
$mediaSession = media_body($router->handle('GET', '/api/media/auth/session', $origin));
$newSecret = 'otra frase segura del medio';
same(['ok' => true], array_intersect_key(media_body($router->handle('POST', '/api/media/auth/reset', $json($mediaSession['csrf']), media_json(['token' => $token[1], 'password' => $newSecret]))), ['ok' => true]));
$mediaSession = media_body($router->handle('GET', '/api/media/auth/session', $origin));
same(422, $router->handle('POST', '/api/media/auth/reset', $json($mediaSession['csrf']), media_json(['token' => $token[1], 'password' => $newSecret]))->status);
same(401, $router->handle('POST', '/api/media/auth/login', $json($mediaSession['csrf']), media_json(['email' => 'radio@example.invalid', 'password' => $secret]))->status);
$relogin = media_body($router->handle('POST', '/api/media/auth/login', $json($mediaSession['csrf']), media_json(['email' => 'radio@example.invalid', 'password' => $newSecret])));
$own = media_body($router->handle('GET', '/api/media/profile', $origin));
same('Aprobado', $own['status']);
same(false, $own['editable']);
same(false, array_key_exists('notes', $own));
same(false, array_key_exists('views_count', $own['videos'][0]));
same(false, array_key_exists('id', $own['videos'][0]));
same(403, $router->handle('POST', '/api/media/profile', $json($relogin['csrf']), media_json($record))->status);
// An approved medium can no longer edit its record, but keeps reporting published videos.
$relogin = ['csrf' => media_body($router->handle('GET', '/api/media/auth/session', $origin))['csrf']] + $relogin;
same(201, $router->handle('POST', '/api/media/videos', $json($relogin['csrf']), media_json(['url' => 'https://www.instagram.com/reel/xyz/']))->status);
media_close_session();

// Safe retirement hides the record, disables the account and keeps the evidence.
$repository = new MediaRepository($pdo, new Finados\Crypto($config));
(new Finados\MediaAuth($pdo, $config))->register('pendiente@example.invalid', $secret, true, '192.0.2.51');
$pending = $repository->pendingAccounts();
same(1, count($pending));
same('pendiente@example.invalid', $pending[0]['email']);
$repository->archiveAccount($pending[0]['public_id'], 1, '192.0.2.52');
same([], $repository->pendingAccounts());
$repository->archive($publicId, 1, '192.0.2.52');
same(0, $repository->list([])['total']);
same(null, $repository->find($publicId));
same(1, (int) $pdo->query('SELECT COUNT(*) FROM media_profiles')->fetchColumn());
same(0, (int) $pdo->query('SELECT SUM(active) FROM media_accounts')->fetchColumn());
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'media.archived'")->fetchColumn());
media_close_session();
