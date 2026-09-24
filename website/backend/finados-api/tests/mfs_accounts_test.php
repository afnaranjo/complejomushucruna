<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';
require_once __DIR__ . '/../src/MfsRepository.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\MfsPhotoStorage;
use Finados\MfsRepository;
use Finados\Router;

function mfs_config(): Config
{
    static $path = null;
    if ($path === null) {
        $root = tempnam(sys_get_temp_dir(), 'finados-mfs-');
        if ($root === false || !unlink($root) || !mkdir($root, 0700)) throw new RuntimeException('Unable to create mfs test root.');
        register_shutdown_function(static function () use ($root): void {
            $entries = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
            foreach ($entries as $entry) $entry->isDir() && !$entry->isLink() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
            rmdir($root);
        });
        $path = $root . '/config.json';
        file_put_contents($path, json_encode([
            'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
            'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('m', 32)), 'hmacKey' => base64_encode(str_repeat('k', 32)),
        ], JSON_THROW_ON_ERROR));
    }
    return Config::fromFile($path);
}
function mfs_body($response): array
{
    $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($body)) throw new RuntimeException('Expected JSON object.');
    return $body;
}
function mfs_close_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    session_id('');
    $_SESSION = [];
}
function mfs_json(array $payload): string { return json_encode($payload, JSON_THROW_ON_ERROR); }
function mfs_jpeg(): string
{
    $image = imagecreatetruecolor(320, 400);
    imagefill($image, 0, 0, imagecolorallocate($image, 23, 57, 118));
    $upload = tempnam(sys_get_temp_dir(), 'mfs-photo-');
    imagejpeg($image, $upload, 90);
    return $upload;
}

mfs_close_session();
$config = mfs_config();
$pdo = Database::connect($config);
// La cadena completa de migraciones, en orden, como en producción.
foreach (glob(__DIR__ . '/../migrations/*_sqlite.sql') ?: [] as $migration) {
    $pdo->exec(file_get_contents($migration));
}
same('028_mfs_accounts', $pdo->query("SELECT version FROM schema_migrations WHERE version = '028_mfs_accounts'")->fetchColumn());
$adminSecret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([
    str_repeat('a', 32), 'admin', Auth::hashPassword($adminSecret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'),
]);
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.90'];
$json = static fn (string $csrf): array => [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $csrf];
$multipart = static fn (string $csrf): array => [...$origin, 'CONTENT_TYPE' => 'multipart/form-data; boundary=finados', 'HTTP_X_CSRF_TOKEN' => $csrf];

// MFS tiene su propia cookie y nunca comparte la sesión de Voceros, Emprendedores o administración.
$session = mfs_body($router->handle('GET', '/api/mfs/auth/session', $origin));
same(false, $session['authenticated']);
same('finados_mfs', session_name());
$secret = 'rimas seguras en la plaza';
same(403, $router->handle('POST', '/api/mfs/auth/register', ['REMOTE_ADDR' => '192.0.2.90', 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $session['csrf']], mfs_json(['email' => 'mc@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true]))->status);
same(422, $router->handle('POST', '/api/mfs/auth/register', $json($session['csrf']), mfs_json(['email' => 'mc@example.invalid', 'password' => 'corta', 'privacyAcknowledged' => true]))->status);
same(202, $router->handle('POST', '/api/mfs/auth/register', $json($session['csrf']), mfs_json(['email' => 'mc@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true]))->status);
// Registrar dos veces el mismo correo no crea otra cuenta ni revela que ya existe.
same(202, $router->handle('POST', '/api/mfs/auth/register', $json($session['csrf']), mfs_json(['email' => 'MC@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true]))->status);
same(1, (int) $pdo->query('SELECT COUNT(*) FROM mfs_accounts')->fetchColumn());
same(0, (int) $pdo->query('SELECT COUNT(*) FROM vocero_accounts')->fetchColumn());
same(0, (int) $pdo->query('SELECT COUNT(*) FROM emprendedor_accounts')->fetchColumn());
same(0, (int) $pdo->query('SELECT COUNT(*) FROM creadora_accounts')->fetchColumn());
same(401, $router->handle('GET', '/api/mfs/profile', $origin)->status);
$session = mfs_body($router->handle('GET', '/api/mfs/auth/session', $origin));
same(401, $router->handle('POST', '/api/mfs/auth/login', $json($session['csrf']), mfs_json(['email' => 'mc@example.invalid', 'password' => 'clave equivocada']))->status);
$session = mfs_body($router->handle('GET', '/api/mfs/auth/session', $origin));
$login = mfs_body($router->handle('POST', '/api/mfs/auth/login', $json($session['csrf']), mfs_json(['email' => 'mc@example.invalid', 'password' => $secret])));
same(true, $login['authenticated']);
same('mfs', $login['user']['role']);
same(404, $router->handle('GET', '/api/mfs/inventado', $origin)->status);

$empty = mfs_body($router->handle('GET', '/api/mfs/profile', $origin));
same(false, $empty['registered']);
same('mc@example.invalid', $empty['email']);
$record = ['nombre_completo' => 'Juan Rimador Prueba', 'nombre_artistico' => 'MC Prueba', 'cedula' => '1804567890', 'whatsapp' => '0991112222',
    'audicion_tiktok' => 'https://www.tiktok.com/@mcprueba/video/7420000000000000000', 'declaracion_video' => 'Sí',
    'consentimiento_bases' => 'Sí', 'autorizacion_imagen' => 'Sí', 'consentimiento_datos' => 'Sí'];
same(415, $router->handle('POST', '/api/mfs/profile', $json($login['csrf']), '', $record)->status);
// Sin foto la primera inscripción no se guarda.
same(422, $router->handle('POST', '/api/mfs/profile', $multipart($login['csrf']), '', $record)->status);
foreach ([
    ['audicion_tiktok' => 'http://www.tiktok.com/@mcprueba/video/1'],
    ['audicion_tiktok' => 'https://www.youtube.com/watch?v=abc'],
    ['audicion_tiktok' => 'https://www.tiktok.com/'],
    ['audicion_tiktok' => 'https://tiktok.com.evil.test/@x/video/1'],
    ['whatsapp' => '0891112222'],
    ['cedula' => '18045'],
    ['cedula' => '18045678AB'],
    ['nombre_completo' => 'Ana'],
    ['declaracion_video' => 'No'],
    ['consentimiento_datos' => 'No'],
    ['status' => 'Aprobado'],
] as $change) {
    throws(fn () => MfsRepository::validate([...$record, ...$change]), InvalidArgumentException::class);
}
same(true, MfsRepository::isTikTokUrl('https://vm.tiktok.com/ZMabc123/'));
same(0, (int) $pdo->query('SELECT COUNT(*) FROM mfs_profiles')->fetchColumn());

// Con foto: se normaliza, se cifra y se guarda en su propio almacén.
$photoRoot = $config->privateDirectory();
$repository = new MfsRepository($pdo, new Finados\Crypto($config));
$storage = new MfsPhotoStorage($config, new Finados\Crypto($config));
$accountId = (int) $pdo->query('SELECT id FROM mfs_accounts LIMIT 1')->fetchColumn();
$upload = mfs_jpeg();
$saved = $repository->saveForAccount($accountId, $record, ['tmp_name' => $upload, 'size' => filesize($upload)], $storage, '192.0.2.91');
same('Nuevo', $saved['status']);
same('MC Prueba', $saved['stage_name']);
same('0991112222', $saved['whatsapp']);
same('1804567890', $saved['cedula']);
same(false, $saved['cedula_missing']);
same(false, str_contains((string) $pdo->query('SELECT cedula_enc FROM mfs_profiles')->fetchColumn(), '1804567890'));
same(true, $saved['photo']['available']);
same(true, $saved['editable']);
same(3, count($saved['consents']));
same(true, is_dir($photoRoot . '/mfs-photos/files'));
same(false, is_dir($photoRoot . '/voceros-photos/files') || is_dir($photoRoot . '/emprendedor-photos/files'));
$stored = file_get_contents($photoRoot . '/mfs-photos/files/' . $pdo->query('SELECT storage_key FROM mfs_photos')->fetchColumn());
same(false, str_contains($stored, "\xFF\xD8\xFF"));
same(false, str_contains((string) $pdo->query('SELECT whatsapp_enc FROM mfs_profiles')->fetchColumn(), '0991112222'));
$notImage = tempnam(sys_get_temp_dir(), 'mfs-noimg-');
file_put_contents($notImage, 'esto no es una imagen');
throws(fn () => $repository->saveForAccount($accountId, $record, ['tmp_name' => $notImage, 'size' => filesize($notImage)], $storage, '192.0.2.91'), InvalidArgumentException::class);
unlink($upload); unlink($notImage);
same(1, count(array_diff(scandir($photoRoot . '/mfs-photos/files'), ['.', '..'])));

// Actualizar sin foto conserva la foto; la audición enviada ya no se cambia desde la cuenta.
$updated = mfs_body($router->handle('POST', '/api/mfs/profile', $multipart($login['csrf']), '', [...$record, 'nombre_artistico' => 'MC Plaza']));
same('MC Plaza', $updated['stage_name']);
same(true, $updated['photo']['available']);
same(422, $router->handle('POST', '/api/mfs/profile', $multipart($login['csrf']), '', [...$record, 'audicion_tiktok' => 'https://www.tiktok.com/@mcprueba/video/9999'])->status);
same($record['audicion_tiktok'], (string) $pdo->query('SELECT audition_url FROM mfs_profiles')->fetchColumn());
same(3, (int) $pdo->query('SELECT COUNT(*) FROM mfs_consents')->fetchColumn());
same(200, $router->handle('GET', '/api/mfs/photo', $origin)->status);
same('image/jpeg', $router->handle('GET', '/api/mfs/photo', $origin)->headers['Content-Type']);

// Otra cuenta no puede reutilizar el mismo WhatsApp mientras la primera inscripción siga activa.
mfs_close_session();
$session2 = mfs_body($router->handle('GET', '/api/mfs/auth/session', $origin));
same(202, $router->handle('POST', '/api/mfs/auth/register', $json($session2['csrf']), mfs_json(['email' => 'otro@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true]))->status);
$account2 = (int) $pdo->query("SELECT MAX(id) FROM mfs_accounts")->fetchColumn();
$upload = mfs_jpeg();
throws(fn () => $repository->saveForAccount($account2, $record, ['tmp_name' => $upload, 'size' => filesize($upload)], $storage, '192.0.2.92'), Finados\DuplicateRegistration::class);
throws(fn () => $repository->saveForAccount($account2, [...$record, 'whatsapp' => '0995556666'], ['tmp_name' => $upload, 'size' => filesize($upload)], $storage, '192.0.2.92'), Finados\DuplicateRegistration::class);
unlink($upload);
same(1, (int) $pdo->query('SELECT COUNT(*) FROM mfs_profiles')->fetchColumn());
same(1, count(array_diff(scandir($photoRoot . '/mfs-photos/files'), ['.', '..'])));
mfs_close_session();

// Quien se inscribió sin cédula la completa una sola vez, aunque la inscripción ya esté revisada.
$pdo->exec("UPDATE mfs_profiles SET cedula_enc = NULL, cedula_idx = NULL, status = 'Aprobado'");
mfs_close_session();
$s3 = mfs_body($router->handle('GET', '/api/mfs/auth/session', $origin));
$l3 = mfs_body($router->handle('POST', '/api/mfs/auth/login', $json($s3['csrf']), mfs_json(['email' => 'mc@example.invalid', 'password' => $secret])));
same(true, mfs_body($router->handle('GET', '/api/mfs/profile', $origin))['cedula_missing']);
same(422, $router->handle('POST', '/api/mfs/cedula', $json($l3['csrf']), mfs_json(['cedula' => '123']))->status);
$withCedula = mfs_body($router->handle('POST', '/api/mfs/cedula', $json($l3['csrf']), mfs_json(['cedula' => '1804567890'])));
same('1804567890', $withCedula['cedula']);
same(false, $withCedula['cedula_missing']);
same('Aprobado', $withCedula['status']);
same(403, $router->handle('POST', '/api/mfs/cedula', $json($l3['csrf']), mfs_json(['cedula' => '1800000009']))->status);
$pdo->exec("UPDATE mfs_profiles SET status = 'Nuevo'");
mfs_close_session();

// El QR lleva a una validación pública: estado y cédula enmascarada, nunca el número completo.
$verifyId = (string) $pdo->query('SELECT public_id FROM mfs_profiles')->fetchColumn();
$verify = mfs_body($router->handle('GET', '/api/mfs/verify/' . $verifyId, ['REMOTE_ADDR' => '192.0.2.99']));
same('Nuevo', $verify['verification']['status']);
same(false, $verify['verification']['valid']);
same('180•••••90', $verify['verification']['cedula_masked']);
same(false, str_contains(json_encode($verify, JSON_UNESCAPED_UNICODE), '1804567890'));
same(false, array_key_exists('email', $verify['verification']));
$pdo->exec("UPDATE mfs_profiles SET status = 'Aprobado'");
same(true, mfs_body($router->handle('GET', '/api/mfs/verify/' . $verifyId, ['REMOTE_ADDR' => '192.0.2.99']))['verification']['valid']);
$pdo->exec("UPDATE mfs_profiles SET status = 'Nuevo'");
same(404, $router->handle('GET', '/api/mfs/verify/' . str_repeat('0', 32), ['REMOTE_ADDR' => '192.0.2.99'])->status);
same(404, $router->handle('GET', '/api/mfs/verify/xyz', ['REMOTE_ADDR' => '192.0.2.99'])->status);

// Administración: sesión aparte, estados, notas, audición, archivo reversible y exportación.
same(401, $router->handle('GET', '/api/mfs-participants', $origin)->status);
same(401, $router->handle('GET', '/api/mfs-dashboard', $origin)->status);
$adminSession = mfs_body($router->handle('GET', '/api/auth/session', $origin));
$adminLogin = mfs_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), mfs_json(['username' => 'admin', 'password' => $adminSecret])));
$admin = $json($adminLogin['csrf']);
$dashboard = mfs_body($router->handle('GET', '/api/mfs-dashboard', $origin));
same(1, $dashboard['total']);
same(1, $dashboard['byStatus']['Nuevo']);
same(1, $dashboard['pendingAccounts']);
$list = mfs_body($router->handle('GET', '/api/mfs-participants?search=plaza&page=1&pageSize=25', $origin));
same(1, $list['pagination']['total']);
same('mc@example.invalid', $list['items'][0]['email']);
same(true, $list['items'][0]['has_photo']);
same(1, mfs_body($router->handle('GET', '/api/mfs-participants?search=0991112222', $origin))['pagination']['total']);
same(1, mfs_body($router->handle('GET', '/api/mfs-participants?search=1804567890', $origin))['pagination']['total']);
same(1, mfs_body($router->handle('GET', '/api/mfs-participants?search=mc@example.invalid', $origin))['pagination']['total']);
same(422, $router->handle('GET', '/api/mfs-participants?status=Inventado', $origin)->status);
same(422, $router->handle('GET', '/api/mfs-participants?city=Ambato', $origin)->status);
$pending = mfs_body($router->handle('GET', '/api/mfs-accounts', $origin));
same('otro@example.invalid', $pending['items'][0]['email']);
$publicId = $list['items'][0]['public_id'];
$detail = mfs_body($router->handle('GET', '/api/mfs-participants/' . $publicId, $origin));
same('Juan Rimador Prueba', $detail['full_name']);
same(true, $detail['account']['active']);
same('image/jpeg', $router->handle('GET', '/api/mfs-participants/' . $publicId . '/photo', $origin)->headers['Content-Type']);
same(422, $router->handle('PATCH', '/api/mfs-participants/' . $publicId, $admin, mfs_json(['status' => 'Ganador']))->status);
same(200, $router->handle('PATCH', '/api/mfs-participants/' . $publicId, $admin, mfs_json(['status' => 'Seleccionado']))->status);
same(201, $router->handle('POST', '/api/mfs-participants/' . $publicId . '/notes', $admin, mfs_json(['body' => 'Buen flow en la audición.']))->status);
same(422, $router->handle('POST', '/api/mfs-participants/' . $publicId . '/audition', $admin, mfs_json(['url' => 'https://example.invalid/video']))->status);
same(200, $router->handle('POST', '/api/mfs-participants/' . $publicId . '/audition', $admin, mfs_json(['url' => 'https://www.tiktok.com/@mcprueba/video/1234']))->status);
$detail = mfs_body($router->handle('GET', '/api/mfs-participants/' . $publicId, $origin));
same('Seleccionado', $detail['status']);
same(1, count($detail['notes']));
same('https://www.tiktok.com/@mcprueba/video/1234', $detail['audition_url']);
$reset = mfs_body($router->handle('POST', '/api/mfs-participants/' . $publicId . '/password-reset', $admin, '{}'));
same(1, preg_match('~^https://example\.invalid/finados/mfs/restablecer/\?token=[a-f0-9]{64}$~', $reset['resetUrl']));
$csv = $router->handle('POST', '/api/mfs-participants/export', $admin, '{}');
same('text/csv; charset=utf-8', $csv->headers['Content-Type']);
same(true, str_contains($csv->body, 'MC Plaza'));
same(true, str_contains($csv->body, '1804567890'));
// Retirar oculta la inscripción y desactiva la cuenta; restaurar lo deshace sin perder datos.
same(200, $router->handle('POST', '/api/mfs-participants/' . $publicId . '/delete', $admin, '{}')->status);
same(0, mfs_body($router->handle('GET', '/api/mfs-participants', $origin))['pagination']['total']);
same(1, mfs_body($router->handle('GET', '/api/mfs-participants?status=Archivado', $origin))['pagination']['total']);
same(0, (int) $pdo->query('SELECT active FROM mfs_accounts WHERE id = ' . $accountId)->fetchColumn());
same(200, $router->handle('POST', '/api/mfs-participants/' . $publicId . '/restore', $admin, '{}')->status);
same('En revisión', (string) $pdo->query('SELECT status FROM mfs_profiles')->fetchColumn());
same(1, (int) $pdo->query('SELECT active FROM mfs_accounts WHERE id = ' . $accountId)->fetchColumn());
same(1, (int) $pdo->query('SELECT COUNT(*) FROM mfs_notes')->fetchColumn());
same(200, $router->handle('POST', '/api/mfs-accounts/' . $pending['items'][0]['public_id'] . '/delete', $admin, '{}')->status);
same(0, count(mfs_body($router->handle('GET', '/api/mfs-accounts', $origin))['items']));
// Las rutas de otros programas siguen respondiendo igual.
same(200, $router->handle('GET', '/api/emprendedores', $origin)->status);
same(200, $router->handle('GET', '/api/creadoras', $origin)->status);
mfs_close_session();
