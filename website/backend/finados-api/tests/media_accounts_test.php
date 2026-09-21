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
    // One private root per run, removed on shutdown, so encrypted test photos never linger in the system temp directory.
    static $path = null;
    if ($path === null) {
        $root = tempnam(sys_get_temp_dir(), 'finados-media-');
        if ($root === false || !unlink($root) || !mkdir($root, 0700)) throw new RuntimeException('Unable to create media test root.');
        register_shutdown_function(static function () use ($root): void {
            $entries = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
            foreach ($entries as $entry) $entry->isDir() && !$entry->isLink() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
            rmdir($root);
        });
        $path = $root . '/config.json';
        file_put_contents($path, json_encode([
            'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
            'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
        ], JSON_THROW_ON_ERROR));
    }
    return Config::fromFile($path);
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
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts', '008_media_accounts', '009_media_videos', '010_media_video_views', '011_media_contact_channels', '012_media_consents', '013_media_types_radio', '014_media_channels_photo', '015_media_traffic_light'] as $migration) {
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
$record = ['media_name' => 'Radio Prueba', 'media_types' => ['radio', 'digital'], 'radio_stations' => [['name' => 'Radio Prueba Ambato', 'frequency' => '99.9 FM'], ['name' => 'Radio Prueba Riobamba', 'frequency' => '101.5 FM']],
    'audience_count' => 25000, 'radio_genre' => 'Popular y tropical', 'tv_channels' => [], 'contact_name' => 'Persona Responsable', 'phone' => '0990000000',
    'contact_email' => 'Prensa@Example.invalid', 'province' => 'Tungurahua', 'city' => 'Ambato',
    'channels' => [['type' => 'facebook', 'url' => 'facebook.com/radioprueba', 'followers' => 12000], ['type' => 'facebook', 'url' => 'https://www.facebook.com/radiopruebariobamba', 'followers' => 3000], ['type' => 'tiktok', 'url' => 'https://www.tiktok.com/@radioprueba', 'followers' => null], ['type' => 'website', 'url' => 'radioprueba.example', 'followers' => null]],
    'conditions_accepted' => true, 'privacy_accepted' => true, 'image_accepted' => true];
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'privacy_accepted' => false]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'image_accepted' => 'sí']))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'channels' => [['type' => 'facebook', 'url' => 'javascript:alert(1)', 'followers' => null]]]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'channels' => []]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'channels' => [['type' => 'mastodon', 'url' => 'https://example.social/@radio', 'followers' => null]]]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'channels' => [['type' => 'facebook', 'url' => 'facebook.com/radioprueba', 'followers' => 1], ['type' => 'otro', 'url' => 'https://FACEBOOK.com/radioprueba', 'followers' => 1]]]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'facebook' => 'facebook.com/radioprueba']))->status);
// Followers are whole numbers declared per account; a web page has none.
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'channels' => [['type' => 'facebook', 'url' => 'facebook.com/radioprueba', 'followers' => '12000']]]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'channels' => [['type' => 'facebook', 'url' => 'facebook.com/radioprueba', 'followers' => -5]]]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'channels' => [['type' => 'website', 'url' => 'radioprueba.example', 'followers' => 10]]]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'channels' => [['type' => 'facebook', 'url' => 'facebook.com/radioprueba']]]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'phone' => 'sin numero']))->status);
// At least one platform; radio details are mandatory with Radio and forbidden without it.
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'media_types' => []]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'media_types' => ['radio', 'podcast']]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'radio_stations' => []]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'audience_count' => '25000']))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'radio_genre' => 'Inventado']))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'media_types' => ['digital']]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'media_types' => ['radio', 'tv']]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'contact_email' => 'no-es-correo']))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'province' => 'Provincia Inventada']))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'social_link' => 'https://example.invalid/']))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'people_count' => 2]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'conditions_accepted' => false]))->status);
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'status' => 'Aprobado']))->status);
// A medium can never set its own traffic light.
same(422, $router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'traffic_light' => 'green']))->status);
same(403, $router->handle('POST', '/api/media/profile', $json('token-incorrecto'), media_json($record))->status);
// Videos need a saved record first.
$login = ['csrf' => media_body($router->handle('GET', '/api/media/auth/session', $origin))['csrf']] + $login;
same(403, $router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'https://www.tiktok.com/@radio/video/1']))->status);
$saved = media_body($router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json($record)));
same(true, $saved['registered']);
same('Nuevo', $saved['status']);
same(true, $saved['editable']);
same('https://facebook.com/radioprueba', $saved['social_link']);
same('https://radioprueba.example', $saved['website']);
same('', $saved['instagram']);
same(4, count($saved['channels']));
same(['type' => 'facebook', 'url' => 'https://www.facebook.com/radiopruebariobamba', 'followers' => 3000], $saved['channels'][1]);
same(15000, $saved['followers_total']);
same(['available' => false], $saved['photo']);
same(false, $saved['can_add_videos']);
same('Persona Responsable', $saved['contact_name']);
same(['conditions', 'privacy', 'image'], array_keys($saved['consents']));
same(true, $saved['consents']['image']['accepted']);
same(3, (int) $pdo->query('SELECT COUNT(*) FROM media_consents')->fetchColumn());
same('prensa@example.invalid', $saved['contact_email']);
same('Ambato', $saved['city']);
$stored = $pdo->query('SELECT contact_name_enc, phone_enc, contact_email_enc FROM media_profiles')->fetch();
same(false, str_contains(implode('|', $stored), 'Persona'));
same(false, str_contains(implode('|', $stored), '0990000000'));
same(false, str_contains(strtolower(implode('|', $stored)), 'prensa@'));
same([], $saved['videos']);
same(false, array_key_exists('people_count', $saved));
$updated = media_body($router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'media_types' => ['tv', 'radio'], 'tv_channels' => ['Canal 25', 'Canal 40 UHF']])));
same(['radio', 'tv'], $updated['media_types']);
same(['Canal 25', 'Canal 40 UHF'], $updated['tv_channels']);
same('99.9 FM · 101.5 FM · Canal 25 · Canal 40 UHF', $updated['frequency_channel']);
same(25000, $updated['audience_count']);
same('Radio Prueba Riobamba', $updated['radio_stations'][1]['name']);
// Saving again without changes adds no evidence rows; withdrawing image use is allowed and recorded.
same(3, (int) $pdo->query('SELECT COUNT(*) FROM media_consents')->fetchColumn());
$withdrawn = media_body($router->handle('POST', '/api/media/profile', $json($login['csrf']), media_json([...$record, 'image_accepted' => false])));
same(false, $withdrawn['consents']['image']['accepted']);
same(true, $withdrawn['consents']['privacy']['accepted']);
same(4, (int) $pdo->query('SELECT COUNT(*) FROM media_consents')->fetchColumn());
same(false, str_contains((string) $pdo->query('SELECT GROUP_CONCAT(ip_hash) FROM media_consents')->fetchColumn(), '192.0.2'));
same(1, (int) $pdo->query('SELECT COUNT(*) FROM media_profiles')->fetchColumn());
// The responsible person's photo is mandatory: without it there is no approval and no videos.
same(true, $updated['photo_required']);
$earlyImage = imagecreatetruecolor(200, 200);
$earlyUpload = tempnam(sys_get_temp_dir(), 'media-photo-');
imagejpeg($earlyImage, $earlyUpload, 90);
$earlyRepository = new MediaRepository($pdo, new Finados\Crypto($config));
$earlyAccountId = (int) $pdo->query('SELECT account_id FROM media_profiles LIMIT 1')->fetchColumn();
$pdo->exec("UPDATE media_profiles SET status = 'Aprobado'");
same(false, media_body($router->handle('GET', '/api/media/profile', $origin))['can_add_videos']);
same(403, $router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'https://www.tiktok.com/@radio/video/1']))->status);
$login = ['csrf' => media_body($router->handle('GET', '/api/media/auth/session', $origin))['csrf']] + $login;
$pdo->exec("UPDATE media_profiles SET status = 'Nuevo'");
$earlyRepository->savePhotoForAccount($earlyAccountId, new Finados\MediaPhotoStorage($config, new Finados\Crypto($config)), $earlyUpload, filesize($earlyUpload), '192.0.2.59');
unlink($earlyUpload);
// Videos stay closed until administration approves the record.
same(false, $updated['can_add_videos']);
same(true, $updated['can_upload_photo']);
same(403, $router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'https://www.tiktok.com/@radio/video/1']))->status);
$login = ['csrf' => media_body($router->handle('GET', '/api/media/auth/session', $origin))['csrf']] + $login;
$pdo->exec("UPDATE media_profiles SET status = 'Aprobado'");
same(true, media_body($router->handle('GET', '/api/media/profile', $origin))['can_add_videos']);
// The medium keeps adding the links of what it published.
$firstVideo = media_body($router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'https://www.tiktok.com/@radio/video/1'])));
same(1, count($firstVideo['videos']));
same(201, $router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'youtube.com/watch?v=abc']))->status);
same(409, $router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'https://www.TikTok.com/@radio/video/1']))->status);
same(422, $router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'no es un link']))->status);
same(422, $router->handle('POST', '/api/media/videos', $json($login['csrf']), media_json(['url' => 'https://a.example/v', 'otro' => 1]))->status);
same(2, count(media_body($router->handle('GET', '/api/media/profile', $origin))['videos']));
$pdo->exec("UPDATE media_profiles SET status = 'Nuevo'");
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
same('Ambato', $list['items'][0]['city']);
same(['radio', 'digital'], $list['items'][0]['media_types']);
same(25000, $list['items'][0]['audience_count']);
same(1, media_body($router->handle('GET', '/api/medios?media_type=radio', $origin))['pagination']['total']);
same(0, media_body($router->handle('GET', '/api/medios?media_type=prensa', $origin))['pagination']['total']);
same('tiktok', $list['items'][0]['channels'][2]['type']);
same(15000, $list['items'][0]['followers_total']);
same(1, count($list['topFollowers']));
same(15000, $list['topFollowers'][0]['followers_total']);
same('facebook', $list['topFollowers'][0]['top_channel']);
same(false, array_key_exists('contact_name', $list['items'][0]));
same(1, media_body($router->handle('GET', '/api/medios?province=Tungurahua&search=ambato', $origin))['pagination']['total']);
same(0, media_body($router->handle('GET', '/api/medios?province=Azuay', $origin))['pagination']['total']);
same(false, array_key_exists('phone', $list['items'][0]));
same(1, $list['summary']['byStatus']['Nuevo']);
same(2, $list['summary']['videos']);
same(2, $list['items'][0]['videos_count']);
same(422, $router->handle('GET', '/api/medios?media_type=podcast', $origin)->status);
same(422, $router->handle('GET', '/api/medios?status=Inventado', $origin)->status);
$detail = media_body($router->handle('GET', '/api/medios/' . $publicId, $origin));
same('https://facebook.com/radioprueba', $detail['social_link']);
same('0990000000', $detail['phone']);
same('Persona Responsable', $detail['contact_name']);
same(false, $detail['consents']['image']['accepted']);
same(false, array_key_exists('ip_hash', $detail['consents']['image']));
same('https://youtube.com/watch?v=abc', $detail['videos'][0]['url']);
same('radio@example.invalid', $detail['account_email']);
// A record saved before 014 has one link per network in its own columns and no list yet: it must stay visible.
$pdo->exec("UPDATE media_profiles SET channels = NULL, tv_channels = NULL, tv_channel = 'Canal 25'");
$legacyList = media_body($router->handle('GET', '/api/medios', $origin))['items'][0];
same(['facebook', 'tiktok', 'website'], array_column($legacyList['channels'], 'type'));
same('https://facebook.com/radioprueba', $legacyList['channels'][0]['url']);
same(0, $legacyList['followers_total']);
$legacyDetail = media_body($router->handle('GET', '/api/medios/' . $publicId, $origin));
same(3, count($legacyDetail['channels']));
same(['Canal 25'], $legacyDetail['tv_channels']);
same(false, in_array('facebook', array_keys($legacyList), true));
$pdo->prepare('UPDATE media_profiles SET channels = ?, tv_channels = ?, tv_channel = ?')->execute([json_encode($detail['channels']), '[]', '']);

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
// The traffic light is set only by administration and starts red.
same('red', $ranked['items'][0]['traffic_light']);
same(422, $router->handle('PATCH', '/api/medios/' . $publicId, $admin, media_json(['traffic_light' => 'blue']))->status);
same(422, $router->handle('PATCH', '/api/medios/' . $publicId, $admin, '{}')->status);
same(['ok' => true], media_body($router->handle('PATCH', '/api/medios/' . $publicId, $admin, media_json(['traffic_light' => 'yellow']))));
same('yellow', media_body($router->handle('GET', '/api/medios/' . $publicId, $origin))['traffic_light']);
same(['ok' => true], media_body($router->handle('PATCH', '/api/medios/' . $publicId, $admin, media_json(['status' => 'En revisión', 'traffic_light' => 'green']))));
same('green', media_body($router->handle('GET', '/api/medios', $origin))['items'][0]['traffic_light']);
same(2, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'media.traffic_light_changed'")->fetchColumn());
same(422, $router->handle('PATCH', '/api/medios/' . $publicId, $admin, media_json(['status' => 'Eliminado']))->status);
// Approval is refused while the photo is missing.
$photoRow = $pdo->query('SELECT * FROM media_photos')->fetch(PDO::FETCH_ASSOC);
$pdo->exec('DELETE FROM media_photos');
same(422, $router->handle('PATCH', '/api/medios/' . $publicId, $admin, media_json(['status' => 'Aprobado']))->status);
$pdo->prepare('INSERT INTO media_photos (id, profile_id, storage_key, content_type, bytes, sha256, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute(array_values($photoRow));
same(['ok' => true], media_body($router->handle('PATCH', '/api/medios/' . $publicId, $admin, media_json(['status' => 'Aprobado']))));
same(201, $router->handle('POST', '/api/medios/' . $publicId . '/notes', $admin, media_json(['body' => 'Credenciales listas.']))->status);
$detail = media_body($router->handle('GET', '/api/medios/' . $publicId, $origin));
same('Aprobado', $detail['status']);
same('Credenciales listas.', $detail['notes'][0]['body']);
$export = $router->handle('POST', '/api/medios/export', $admin, media_json(['status' => 'Aprobado']));
same(200, $export->status);
same(true, str_contains($export->body, 'Radio Prueba'));
same(true, str_contains($export->body, 'Persona Responsable') && str_contains($export->body, 'Facebook: https://facebook.com/radioprueba (12000 seguidores) | Facebook: https://www.facebook.com/radiopruebariobamba (3000 seguidores)') && str_contains($export->body, ',15000,') && str_contains($export->body, 'Tungurahua'));
same(true, str_contains($export->body, 'Radio Prueba Ambato (99.9 FM) | Radio Prueba Riobamba (101.5 FM)') && str_contains($export->body, 'Radio | Medio digital') && str_contains($export->body, ',25000,'));
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
same('green', $own['traffic_light']);
same(false, $own['editable']);
same(false, array_key_exists('notes', $own));
same(false, array_key_exists('views_count', $own['videos'][0]));
same(false, array_key_exists('id', $own['videos'][0]));
same(403, $router->handle('POST', '/api/media/profile', $json($relogin['csrf']), media_json($record))->status);
// An approved medium can no longer edit its record, but keeps reporting published videos.
$relogin = ['csrf' => media_body($router->handle('GET', '/api/media/auth/session', $origin))['csrf']] + $relogin;
same(201, $router->handle('POST', '/api/media/videos', $json($relogin['csrf']), media_json(['url' => 'https://www.instagram.com/reel/xyz/']))->status);
media_close_session();

// The representative's photo is normalized, encrypted and stored apart from the Voceros photo store.
$photoRoot = dirname($config->privateDirectory() . '/x');
$image = imagecreatetruecolor(320, 240);
imagefill($image, 0, 0, imagecolorallocate($image, 110, 44, 224));
$upload = tempnam(sys_get_temp_dir(), 'media-photo-');
imagejpeg($image, $upload, 90);
$mediaRepository = new MediaRepository($pdo, new Finados\Crypto($config));
$photoStorage = new Finados\MediaPhotoStorage($config, new Finados\Crypto($config));
$accountId = (int) $pdo->query('SELECT account_id FROM media_profiles LIMIT 1')->fetchColumn();
$meta = $mediaRepository->savePhotoForAccount($accountId, $photoStorage, $upload, filesize($upload), '192.0.2.60');
same(true, $meta['available']);
same(320, $meta['width']);
$jpeg = $mediaRepository->photoForAccount($accountId, $photoStorage);
same("\xFF\xD8", substr($jpeg, 0, 2));
same(true, is_dir($photoRoot . '/media-photos/files'));
same(1, count(array_diff(scandir($photoRoot . '/media-photos/files'), ['.', '..'])));
same(false, is_dir($photoRoot . '/voceros-photos/files') && count(array_diff(scandir($photoRoot . '/voceros-photos/files'), ['.', '..'])) > 0);
$stored = file_get_contents($photoRoot . '/media-photos/files/' . $pdo->query('SELECT storage_key FROM media_photos')->fetchColumn());
same(false, str_contains($stored, "\xFF\xD8\xFF"));
// Replacing keeps a single file and a single row.
$mediaRepository->savePhotoForAccount($accountId, $photoStorage, $upload, filesize($upload), '192.0.2.60');
same(1, (int) $pdo->query('SELECT COUNT(*) FROM media_photos')->fetchColumn());
same(1, count(array_diff(scandir($photoRoot . '/media-photos/files'), ['.', '..'])));
$notImage = tempnam(sys_get_temp_dir(), 'media-photo-');
file_put_contents($notImage, 'esto no es una imagen');
throws(fn () => $mediaRepository->savePhotoForAccount($accountId, $photoStorage, $notImage, filesize($notImage), '192.0.2.60'), InvalidArgumentException::class);
same(true, str_starts_with($mediaRepository->photoForAdmin($publicId, $photoStorage, 1, '192.0.2.61'), "\xFF\xD8"));
unlink($upload); unlink($notImage);

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
