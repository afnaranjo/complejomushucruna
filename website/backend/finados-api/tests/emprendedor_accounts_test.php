<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\EmprendedorPhotoStorage;
use Finados\EmprendedorRepository;
use Finados\Router;

function emprendedor_config(): Config
{
    static $path = null;
    if ($path === null) {
        $root = tempnam(sys_get_temp_dir(), 'finados-emprendedor-');
        if ($root === false || !unlink($root) || !mkdir($root, 0700)) throw new RuntimeException('Unable to create emprendedor test root.');
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
function emprendedor_body($response): array
{
    $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($body)) throw new RuntimeException('Expected JSON object.');
    return $body;
}
function emprendedor_close_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    session_id('');
    $_SESSION = [];
}
function emprendedor_json(array $payload): string { return json_encode($payload, JSON_THROW_ON_ERROR); }

emprendedor_close_session();
$config = emprendedor_config();
$pdo = Database::connect($config);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts', '008_media_accounts', '009_media_videos', '010_media_video_views', '011_media_contact_channels', '012_media_consents', '013_media_types_radio', '014_media_channels_photo', '015_media_traffic_light', '016_media_paid', '017_emprendedor_accounts', '018_media_coverage', '019_media_event_attendance', '020_media_event_checkin'] as $migration) {
    $pdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
}
same('017_emprendedor_accounts', $pdo->query("SELECT version FROM schema_migrations WHERE version = '017_emprendedor_accounts'")->fetchColumn());
same(5, (int) $pdo->query('SELECT COUNT(*) FROM emprendedor_video_schedule')->fetchColumn());
$adminSecret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([
    str_repeat('a', 32), 'admin', Auth::hashPassword($adminSecret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'),
]);
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.70'];
$json = static fn (string $csrf): array => [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $csrf];
$multipart = static fn (string $csrf): array => [...$origin, 'CONTENT_TYPE' => 'multipart/form-data; boundary=finados', 'HTTP_X_CSRF_TOKEN' => $csrf];

// The entrepreneur scope has its own cookie and never shares the Vocero, Medios or admin session.
$session = emprendedor_body($router->handle('GET', '/api/emprendedor/auth/session', $origin));
same(false, $session['authenticated']);
same('finados_emprendedor', session_name());
$secret = 'frase segura del emprendimiento';
same(403, $router->handle('POST', '/api/emprendedor/auth/register', ['REMOTE_ADDR' => '192.0.2.70', 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $session['csrf']], emprendedor_json(['email' => 'tienda@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true]))->status);
$created = $router->handle('POST', '/api/emprendedor/auth/register', $json($session['csrf']), emprendedor_json(['email' => 'tienda@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true]));
same(202, $created->status);
same(1, (int) $pdo->query('SELECT COUNT(*) FROM emprendedor_accounts')->fetchColumn());
same(0, (int) $pdo->query('SELECT COUNT(*) FROM vocero_accounts')->fetchColumn());
same(0, (int) $pdo->query('SELECT COUNT(*) FROM media_accounts')->fetchColumn());
same(401, $router->handle('GET', '/api/emprendedor/profile', $origin)->status);
$session = emprendedor_body($router->handle('GET', '/api/emprendedor/auth/session', $origin));
$login = emprendedor_body($router->handle('POST', '/api/emprendedor/auth/login', $json($session['csrf']), emprendedor_json(['email' => 'tienda@example.invalid', 'password' => $secret])));
same(true, $login['authenticated']);
same('emprendedor', $login['user']['role']);

$empty = emprendedor_body($router->handle('GET', '/api/emprendedor/profile', $origin));
same(false, $empty['registered']);
same('tienda@example.invalid', $empty['email']);
$record = ['nombre_completo' => 'María Emprendedora Prueba', 'cedula' => '1800000001', 'fecha_nacimiento' => '1990-05-20', 'whatsapp' => '0990000001', 'ciudad' => 'Ambato',
    'emprendimiento' => 'Dulces de la Abuela', 'producto' => 'Colada morada y guaguas de pan', 'stand' => 'A-12',
    'tiktok' => 'https://www.tiktok.com/@dulcesabuela', 'instagram' => '', 'facebook' => '', 'red_principal' => 'TikTok', 'participacion_previa' => 'No, es mi primera vez',
    'consentimiento_politicas' => 'Sí', 'autorizacion_imagen' => 'Sí', 'consentimiento_datos' => 'Sí'];
// The profile is a multipart form, like Voceros; JSON bodies are refused.
same(415, $router->handle('POST', '/api/emprendedor/profile', $json($login['csrf']), '', $record)->status);
same(422, $router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', [...$record, 'consentimiento_datos' => 'No'])->status);
same(422, $router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', [...$record, 'fecha_nacimiento' => date('Y-m-d', strtotime('-17 years'))])->status);
same(422, $router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', [...$record, 'cedula' => '18000'])->status);
same(422, $router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', [...$record, 'whatsapp' => '0890000001'])->status);
same(422, $router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', [...$record, 'tiktok' => '', 'instagram' => '', 'facebook' => ''])->status);
same(422, $router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', [...$record, 'instagram' => 'http://instagram.com/x'])->status);
same(422, $router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', [...$record, 'red_principal' => 'YouTube'])->status);
same(422, $router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', [...$record, 'emprendimiento' => ''])->status);
same(422, $router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', [...$record, 'status' => 'Aprobado'])->status);
same(422, $router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', [...$record, 'traffic_light' => 'green'])->status);
$saved = emprendedor_body($router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', $record));
same(true, $saved['registered']);
same('Nuevo', $saved['status']);
same('red', $saved['traffic_light']);
same('Dulces de la Abuela', $saved['business_name']);
same('A-12', $saved['stand_code']);
same('1800000001', $saved['cedula']);
same(false, $saved['profile_complete']);
same(false, $saved['photo']['available']);
same(true, $saved['editable']);
same(3, count($saved['consents']));
same('policies', $saved['consents'][0]['consent_type']);
same(0, $saved['progress']['level']);
same('En preparación', $saved['progress']['level_label']);
same(5, count($saved['progress']['videos']));
same(false, $saved['progress']['videos'][0]['unlocked']);
$publicId = $saved['public_id'];
same(1, preg_match('/^[a-f0-9]{32}$/', $publicId));
// Saving again keeps one record and one consent row per type.
$again = emprendedor_body($router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', [...$record, 'ciudad' => 'Pelileo']));
same('Pelileo', $again['city']);
same(1, (int) $pdo->query('SELECT COUNT(*) FROM emprendedor_profiles')->fetchColumn());
same(3, (int) $pdo->query('SELECT COUNT(*) FROM emprendedor_consents')->fetchColumn());
same(false, str_contains((string) $pdo->query('SELECT GROUP_CONCAT(ip_hash) FROM emprendedor_consents')->fetchColumn(), '192.0.2'));
// Videos stay locked until the global date arrives.
same(404, $router->handle('POST', '/api/emprendedor/videos/1', $json($login['csrf']), emprendedor_json(['url' => 'https://www.tiktok.com/@dulcesabuela/video/1']))->status);
same(404, $router->handle('POST', '/api/emprendedor/videos/9', $json($login['csrf']), emprendedor_json(['url' => 'https://www.tiktok.com/@dulcesabuela/video/1']))->status);
same(404, $router->handle('GET', '/api/emprendedor/photo', $origin)->status);

// The photo is normalized, encrypted and stored in the programme's own store.
$photoRoot = dirname($config->privateDirectory() . '/x');
$image = imagecreatetruecolor(320, 240);
imagefill($image, 0, 0, imagecolorallocate($image, 200, 44, 120));
$upload = tempnam(sys_get_temp_dir(), 'emprendedor-photo-');
imagejpeg($image, $upload, 90);
$repository = new EmprendedorRepository($pdo, new Finados\Crypto($config));
$storage = new EmprendedorPhotoStorage($config, new Finados\Crypto($config));
$accountId = (int) $pdo->query('SELECT account_id FROM emprendedor_profiles LIMIT 1')->fetchColumn();
$withPhoto = $repository->saveForAccount($accountId, $record, ['tmp_name' => $upload, 'size' => filesize($upload)], $storage, '192.0.2.71');
same(true, $withPhoto['photo']['available']);
same(320, $withPhoto['photo']['width']);
same(true, $withPhoto['profile_complete']);
same("\xFF\xD8", substr($repository->photoForAccount($accountId, $storage), 0, 2));
same(true, is_dir($photoRoot . '/emprendedor-photos/files'));
same(1, count(array_diff(scandir($photoRoot . '/emprendedor-photos/files'), ['.', '..'])));
same(false, is_dir($photoRoot . '/voceros-photos/files') || is_dir($photoRoot . '/media-photos/files'));
$stored = file_get_contents($photoRoot . '/emprendedor-photos/files/' . $pdo->query('SELECT storage_key FROM emprendedor_photos')->fetchColumn());
same(false, str_contains($stored, "\xFF\xD8\xFF"));
// Replacing keeps one file and one row; a non-image is refused.
$repository->saveForAccount($accountId, $record, ['tmp_name' => $upload, 'size' => filesize($upload)], $storage, '192.0.2.71');
same(1, count(array_diff(scandir($photoRoot . '/emprendedor-photos/files'), ['.', '..'])));
same(1, (int) $pdo->query('SELECT COUNT(*) FROM emprendedor_photos')->fetchColumn());
$notImage = tempnam(sys_get_temp_dir(), 'emprendedor-noimg-');
file_put_contents($notImage, 'esto no es una imagen');
throws(fn () => $repository->saveForAccount($accountId, $record, ['tmp_name' => $notImage, 'size' => filesize($notImage)], $storage, '192.0.2.71'), InvalidArgumentException::class);
unlink($upload); unlink($notImage);
same(200, $router->handle('GET', '/api/emprendedor/photo', $origin)->status);
same('image/jpeg', $router->handle('GET', '/api/emprendedor/photo', $origin)->headers['Content-Type']);
// A second account cannot reuse the same cédula while the first record is active.
emprendedor_close_session();
$session2 = emprendedor_body($router->handle('GET', '/api/emprendedor/auth/session', $origin));
same(202, $router->handle('POST', '/api/emprendedor/auth/register', $json($session2['csrf']), emprendedor_json(['email' => 'otra@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true]))->status);
$session2 = emprendedor_body($router->handle('GET', '/api/emprendedor/auth/session', $origin));
$login2 = emprendedor_body($router->handle('POST', '/api/emprendedor/auth/login', $json($session2['csrf']), emprendedor_json(['email' => 'otra@example.invalid', 'password' => $secret])));
same(409, $router->handle('POST', '/api/emprendedor/profile', $multipart($login2['csrf']), '', [...$record, 'whatsapp' => '0990000002'])->status);
same(409, $router->handle('POST', '/api/emprendedor/profile', $multipart($login2['csrf']), '', [...$record, 'cedula' => '1800000002'])->status);
same(1, (int) $pdo->query('SELECT COUNT(*) FROM emprendedor_profiles')->fetchColumn());
emprendedor_close_session();

// Administrative routes require the separate admin session.
same(401, $router->handle('GET', '/api/emprendedores', $origin)->status);
same(401, $router->handle('GET', '/api/emprendedor-dashboard', $origin)->status);
same(401, $router->handle('PATCH', '/api/emprendedor-video-schedule', $json('x'), '{}')->status);
$adminSession = emprendedor_body($router->handle('GET', '/api/auth/session', $origin));
$adminLogin = emprendedor_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), emprendedor_json(['username' => 'admin', 'password' => $adminSecret])));
same(true, $adminLogin['authenticated']);
$admin = $json($adminLogin['csrf']);
$list = emprendedor_body($router->handle('GET', '/api/emprendedores?search=abuela&status=Nuevo&page=1&pageSize=25', $origin));
same(1, $list['pagination']['total']);
same('María Emprendedora Prueba', $list['items'][0]['full_name']);
same('Dulces de la Abuela', $list['items'][0]['business_name']);
same('1800000001', $list['items'][0]['cedula']);
same(0, $list['items'][0]['videos_submitted']);
same(1, emprendedor_body($router->handle('GET', '/api/emprendedores?search=1800000001', $origin))['pagination']['total']);
same(1, emprendedor_body($router->handle('GET', '/api/emprendedores?main_network=TikTok&city=Ambato', $origin))['pagination']['total']);
same(0, emprendedor_body($router->handle('GET', '/api/emprendedores?main_network=Facebook', $origin))['pagination']['total']);
same(422, $router->handle('GET', '/api/emprendedores?status=Inventado', $origin)->status);
same(422, $router->handle('GET', '/api/emprendedores?province=Azuay', $origin)->status);
$pending = emprendedor_body($router->handle('GET', '/api/emprendedor-accounts', $origin));
same(1, count($pending['items']));
same('otra@example.invalid', $pending['items'][0]['email']);
$detail = emprendedor_body($router->handle('GET', '/api/emprendedores/' . $publicId, $origin));
same('tienda@example.invalid', $detail['email']);
same(true, $detail['account']['active']);
same('1990-05-20', $detail['birth_date']);
same(true, $detail['photo']['available']);
same(3, count($detail['consents']));
same([], $detail['notes']);
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'emprendedor.viewed'")->fetchColumn());
// Progress: followers, level, traffic light and views are set only by administration.
same(422, $router->handle('PATCH', '/api/emprendedores/' . $publicId . '/progress', $admin, emprendedor_json(['followers_count' => 100, 'level' => 9, 'traffic_light' => 'red']))->status);
same(422, $router->handle('PATCH', '/api/emprendedores/' . $publicId . '/progress', $admin, emprendedor_json(['followers_count' => 100, 'level' => 2, 'traffic_light' => 'blue']))->status);
same(['ok' => true], emprendedor_body($router->handle('PATCH', '/api/emprendedores/' . $publicId . '/progress', $admin, emprendedor_json(['followers_count' => 2500, 'level' => 2, 'traffic_light' => 'yellow']))));
$detail = emprendedor_body($router->handle('GET', '/api/emprendedores/' . $publicId, $origin));
same(2500, $detail['progress']['followers_count']);
same('En camino', $detail['progress']['level_label']);
same('yellow', $detail['progress']['traffic_light']);
same('yellow', $detail['traffic_light']);
// Global schedule opens video slots for everyone; a future date keeps them locked.
$schedule = emprendedor_body($router->handle('GET', '/api/emprendedor-video-schedule', $origin));
same(5, count($schedule['video_slots']));
same(null, $schedule['video_slots'][0]['enabled_at']);
$slots = static fn (?string $first, ?string $second = null): array => ['video_slots' => [
    ['slot' => 1, 'enabled' => $first !== null, 'enabled_at' => $first], ['slot' => 2, 'enabled' => $second !== null, 'enabled_at' => $second],
    ['slot' => 3, 'enabled' => false, 'enabled_at' => null], ['slot' => 4, 'enabled' => false, 'enabled_at' => null], ['slot' => 5, 'enabled' => false, 'enabled_at' => null]]];
same(422, $router->handle('PATCH', '/api/emprendedor-video-schedule', $admin, emprendedor_json(['video_slots' => [['slot' => 1, 'enabled' => true, 'enabled_at' => null]]]))->status);
same(422, $router->handle('PATCH', '/api/emprendedor-video-schedule', $admin, emprendedor_json(['video_slots' => array_map(static fn (int $slot): array => ['slot' => $slot, 'enabled' => true, 'enabled_at' => null], range(1, 5))]))->status);
$today = (new DateTimeImmutable('now', new DateTimeZone('America/Guayaquil')))->format('Y-m-d');
$tomorrow = (new DateTimeImmutable('now', new DateTimeZone('America/Guayaquil')))->modify('+1 day')->format('Y-m-d');
$updated = emprendedor_body($router->handle('PATCH', '/api/emprendedor-video-schedule', $admin, emprendedor_json($slots($today, $tomorrow))));
same($today, $updated['video_slots'][0]['enabled_at']);
same($tomorrow, $updated['video_slots'][1]['enabled_at']);
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'emprendedor.video_schedule_updated'")->fetchColumn());
emprendedor_close_session();

// The entrepreneur pastes the link once its slot opens; a received link is locked and views come from administration.
$session = emprendedor_body($router->handle('GET', '/api/emprendedor/auth/session', $origin));
$login = emprendedor_body($router->handle('POST', '/api/emprendedor/auth/login', $json($session['csrf']), emprendedor_json(['email' => 'tienda@example.invalid', 'password' => $secret])));
$own = emprendedor_body($router->handle('GET', '/api/emprendedor/profile', $origin));
same(true, $own['progress']['videos'][0]['unlocked']);
same(false, $own['progress']['videos'][1]['unlocked']);
same($tomorrow, $own['progress']['videos'][1]['enabled_at']);
same(1, $own['progress']['videos_unlocked']);
same(false, array_key_exists('notes', $own));
same(422, $router->handle('POST', '/api/emprendedor/videos/1', $json($login['csrf']), emprendedor_json(['url' => 'http://www.tiktok.com/@dulcesabuela/video/1']))->status);
same(404, $router->handle('POST', '/api/emprendedor/videos/2', $json($login['csrf']), emprendedor_json(['url' => 'https://www.tiktok.com/@dulcesabuela/video/2']))->status);
$video = emprendedor_body($router->handle('POST', '/api/emprendedor/videos/1', $json($login['csrf']), emprendedor_json(['url' => 'https://www.tiktok.com/@dulcesabuela/video/1'])));
same('submitted', $video['progress']['videos'][0]['status']);
same('https://www.tiktok.com/@dulcesabuela/video/1', $video['progress']['videos'][0]['url']);
same(422, $router->handle('POST', '/api/emprendedor/videos/1', $json($login['csrf']), emprendedor_json(['url' => 'https://www.tiktok.com/@dulcesabuela/video/1b']))->status);
emprendedor_close_session();

$adminSession = emprendedor_body($router->handle('GET', '/api/auth/session', $origin));
$adminLogin = emprendedor_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), emprendedor_json(['username' => 'admin', 'password' => $adminSecret])));
$admin = $json($adminLogin['csrf']);
$views = array_map(static fn (int $slot): array => ['slot' => $slot, 'views_count' => $slot === 1 ? 4200 : 0], range(1, 5));
same(['ok' => true], emprendedor_body($router->handle('PATCH', '/api/emprendedores/' . $publicId . '/progress', $admin, emprendedor_json(['followers_count' => 2600, 'level' => 3, 'traffic_light' => 'green', 'video_views' => $views]))));
same(0, (int) $pdo->query('SELECT COUNT(*) FROM emprendedor_videos WHERE slot <> 1')->fetchColumn());
$dashboard = emprendedor_body($router->handle('GET', '/api/emprendedor-dashboard', $origin));
same(1, $dashboard['total']);
same(1, $dashboard['byStatus']['Nuevo']);
same(1, $dashboard['lastSevenDays']);
same(2600, $dashboard['topFollowers'][0]['followers_count']);
same('Dulces de la Abuela', $dashboard['topFollowers'][0]['business_name']);
same(4200, $dashboard['topVideos'][0]['views_count']);
same(1, $dashboard['topVideos'][0]['slot']);
same(1, emprendedor_body($router->handle('GET', '/api/emprendedores', $origin))['items'][0]['videos_submitted']);
// Public badge validation exposes only name, business, level and traffic light.
$verification = emprendedor_body($router->handle('GET', '/api/emprendedores/verify/' . $publicId, ['REMOTE_ADDR' => '198.51.100.9']));
same(['name' => 'María Emprendedora Prueba', 'business_name' => 'Dulces de la Abuela', 'level' => 3, 'level_label' => 'Constante', 'traffic_light' => 'green', 'traffic_light_label' => ['short' => 'Verde', 'long' => 'Listo']], $verification['verification']);
same(404, $router->handle('GET', '/api/emprendedores/verify/' . str_repeat('b', 32), $origin)->status);
same(405, $router->handle('POST', '/api/emprendedores/verify/' . $publicId, $admin, '{}')->status);
// Status, notes, export and password reset.
same(422, $router->handle('PATCH', '/api/emprendedores/' . $publicId, $admin, emprendedor_json(['status' => 'Eliminado']))->status);
same(['ok' => true], emprendedor_body($router->handle('PATCH', '/api/emprendedores/' . $publicId, $admin, emprendedor_json(['status' => 'Aprobado']))));
same(201, $router->handle('POST', '/api/emprendedores/' . $publicId . '/notes', $admin, emprendedor_json(['body' => 'Stand confirmado.']))->status);
$detail = emprendedor_body($router->handle('GET', '/api/emprendedores/' . $publicId, $origin));
same('Aprobado', $detail['status']);
same('Stand confirmado.', $detail['notes'][0]['body']);
same('admin', $detail['notes'][0]['author']);
$export = $router->handle('POST', '/api/emprendedores/export', $admin, emprendedor_json(['status' => 'Aprobado']));
same(200, $export->status);
same('text/csv; charset=utf-8', $export->headers['Content-Type']);
same(true, str_contains($export->body, 'María Emprendedora Prueba') && str_contains($export->body, 'Dulces de la Abuela') && str_contains($export->body, ',2600,3,Constante,Sí,1,4200,'));
same(true, str_contains($export->body, 'Video 1: https://www.tiktok.com/@dulcesabuela/video/1 (4200 views)'));
same(200, $router->handle('GET', '/api/emprendedores/' . $publicId . '/photo', $origin)->status);
$reset = emprendedor_body($router->handle('POST', '/api/emprendedores/' . $publicId . '/password-reset', $admin, '{}'));
same(true, str_starts_with($reset['resetUrl'], 'https://example.invalid/finados/emprendedores/restablecer/?token='));
$token = explode('token=', $reset['resetUrl']);
emprendedor_close_session();
// Consuming the reset changes the password and an approved record becomes read-only for its owner.
$session = emprendedor_body($router->handle('GET', '/api/emprendedor/auth/session', $origin));
$newSecret = 'nueva frase segura del emprendimiento';
same(['ok' => true], array_intersect_key(emprendedor_body($router->handle('POST', '/api/emprendedor/auth/reset', $json($session['csrf']), emprendedor_json(['token' => $token[1], 'password' => $newSecret]))), ['ok' => true]));
$session = emprendedor_body($router->handle('GET', '/api/emprendedor/auth/session', $origin));
same(401, $router->handle('POST', '/api/emprendedor/auth/login', $json($session['csrf']), emprendedor_json(['email' => 'tienda@example.invalid', 'password' => $secret]))->status);
$login = emprendedor_body($router->handle('POST', '/api/emprendedor/auth/login', $json($session['csrf']), emprendedor_json(['email' => 'tienda@example.invalid', 'password' => $newSecret])));
$own = emprendedor_body($router->handle('GET', '/api/emprendedor/profile', $origin));
same('Aprobado', $own['status']);
same(false, $own['editable']);
same('green', $own['traffic_light']);
same(403, $router->handle('POST', '/api/emprendedor/profile', $multipart($login['csrf']), '', $record)->status);
emprendedor_close_session();

// Existing Voceros and Medios administration keeps working beside the new routes, and the Router constructor stays lazy.
$adminSession = emprendedor_body($router->handle('GET', '/api/auth/session', $origin));
$adminLogin = emprendedor_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), emprendedor_json(['username' => 'admin', 'password' => $adminSecret])));
same(200, $router->handle('GET', '/api/voceros', $origin)->status);
same(200, $router->handle('GET', '/api/medios', $origin)->status);
emprendedor_close_session();

// Safe retirement hides the record, disables the account and keeps the evidence.
$repository = new EmprendedorRepository($pdo, new Finados\Crypto($config));
$repository->archiveAccount($pending['items'][0]['public_id'], 1, '192.0.2.72');
same([], $repository->pendingAccounts());
$repository->archive($publicId, 1, '192.0.2.72');
same(0, $repository->list([])['total']);
same(null, $repository->find($publicId));
same(null, $repository->publicVerification($publicId));
same(1, (int) $pdo->query('SELECT COUNT(*) FROM emprendedor_profiles')->fetchColumn());
same(0, (int) $pdo->query('SELECT SUM(active) FROM emprendedor_accounts')->fetchColumn());
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'emprendedor.archived'")->fetchColumn());
emprendedor_close_session();
