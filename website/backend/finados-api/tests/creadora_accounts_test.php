<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Router;

function creadora_config(): Config
{
    static $path = null;
    if ($path === null) {
        $root = tempnam(sys_get_temp_dir(), 'finados-creadora-');
        if ($root === false || !unlink($root) || !mkdir($root, 0700)) throw new RuntimeException('Unable to create creadora test root.');
        register_shutdown_function(static function () use ($root): void {
            $entries = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
            foreach ($entries as $entry) $entry->isDir() && !$entry->isLink() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
            rmdir($root);
        });
        $path = $root . '/config.json';
        file_put_contents($path, json_encode([
            'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
            'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('c', 32)), 'hmacKey' => base64_encode(str_repeat('k', 32)),
        ], JSON_THROW_ON_ERROR));
    }
    return Config::fromFile($path);
}
function creadora_body($response): array
{
    $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($body)) throw new RuntimeException('Expected JSON object.');
    return $body;
}
function creadora_close_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    session_id('');
    $_SESSION = [];
}
function creadora_json(array $payload): string { return json_encode($payload, JSON_THROW_ON_ERROR); }

creadora_close_session();
$config = creadora_config();
$pdo = Database::connect($config);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts', '008_media_accounts', '009_media_videos', '010_media_video_views', '011_media_contact_channels',
    '012_media_consents', '013_media_types_radio', '014_media_channels_photo', '015_media_traffic_light', '016_media_paid', '017_emprendedor_accounts',
    '018_media_coverage', '019_media_event_attendance', '020_media_event_checkin', '021_creadora_accounts', '022_creadora_identity'] as $migration) {
    $pdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
}
same('021_creadora_accounts', $pdo->query("SELECT version FROM schema_migrations WHERE version = '021_creadora_accounts'")->fetchColumn());
$adminSecret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([
    str_repeat('c', 32), 'admin', Auth::hashPassword($adminSecret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'),
]);
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.90'];
$json = static fn (string $csrf): array => [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $csrf];

// Sin sesión administrativa no se ve ni se toca el calendario.
same(401, $router->handle('GET', '/api/creadoras', $origin)->status);
same(401, $router->handle('GET', '/api/creadoras/calendario?from=2026-10-26&to=2026-11-02', $origin)->status);
same(401, $router->handle('POST', '/api/creadoras/turnos', $origin, creadora_json(['creadora' => str_repeat('a', 32)]))->status);

creadora_close_session();
$adminSession = creadora_body($router->handle('GET', '/api/auth/session', $origin));
$admin = creadora_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), creadora_json(['username' => 'admin', 'password' => $adminSecret])));
$csrf = $admin['csrf'];

// Coordinación agrega los nombres. El nombre es obligatorio y no se repite.
same(422, $router->handle('POST', '/api/creadoras', $json($csrf), creadora_json(['full_name' => '']))->status);
same(422, $router->handle('POST', '/api/creadoras', $json($csrf), creadora_json(['full_name' => 'Ana', 'social_link' => 'http://tiktok.com/@ana']))->status);
same(422, $router->handle('POST', '/api/creadoras', $json($csrf), creadora_json(['full_name' => 'Ana Creadora', 'whatsapp' => 'abc']))->status);
$ana = creadora_body($router->handle('POST', '/api/creadoras', $json($csrf), creadora_json([
    'full_name' => 'Ana Creadora', 'whatsapp' => '0990000011', 'city' => 'Ambato', 'main_network' => 'tiktok',
    'social_link' => 'https://www.tiktok.com/@anacreadora', 'note' => 'Disponible en las tardes.'])))['creadora'];
same('Activa', $ana['status']);
same('coordinacion', $ana['origin']);
same(false, $ana['has_account']);
same('0990000011', $ana['whatsapp']);
same(409, $router->handle('POST', '/api/creadoras', $json($csrf), creadora_json(['full_name' => 'ana creadora']))->status);
$sofia = creadora_body($router->handle('POST', '/api/creadoras', $json($csrf), creadora_json(['full_name' => 'Sofía Contenido', 'main_network' => 'instagram'])))['creadora'];
same(2, count(creadora_body($router->handle('GET', '/api/creadoras', $origin))['items']));

// La ficha guarda la identidad de la persona: cédula, nacimiento, correo, redes y seguidores.
same(422, $router->handle('POST', '/api/creadoras', $json($csrf), creadora_json(['full_name' => 'Prueba Cedula', 'cedula' => '18000']))->status);
same(422, $router->handle('POST', '/api/creadoras', $json($csrf), creadora_json(['full_name' => 'Prueba Fecha', 'birth_date' => '1990-13-40']))->status);
same(422, $router->handle('POST', '/api/creadoras', $json($csrf), creadora_json(['full_name' => 'Prueba Futuro', 'birth_date' => '2030-01-01']))->status);
same(422, $router->handle('POST', '/api/creadoras', $json($csrf), creadora_json(['full_name' => 'Prueba Correo', 'contact_email' => 'no-es-correo']))->status);
same(422, $router->handle('POST', '/api/creadoras', $json($csrf), creadora_json(['full_name' => 'Prueba Red', 'tiktok' => 'http://tiktok.com/@x']))->status);
same(422, $router->handle('POST', '/api/creadoras', $json($csrf), creadora_json(['full_name' => 'Prueba Seguidores', 'followers_count' => -5]))->status);
$completa = creadora_body($router->handle('POST', '/api/creadoras', $json($csrf), creadora_json([
    'full_name' => 'Lucía Full', 'cedula' => '1801234567', 'birth_date' => '1998-04-12', 'contact_email' => 'Lucia@Example.Invalid',
    'whatsapp' => '0990000033', 'city' => 'Ambato', 'main_network' => 'tiktok',
    'tiktok' => 'https://www.tiktok.com/@lucia', 'instagram' => 'https://instagram.com/lucia', 'facebook' => '', 'followers_count' => '12500'])))['creadora'];
same('1801234567', $completa['cedula']);
same('1998-04-12', $completa['birth_date']);
same('lucia@example.invalid', $completa['contact_email']);
same(12500, $completa['followers_count']);
same('https://www.tiktok.com/@lucia', $completa['tiktok']);
same(true, is_int($completa['age']) && $completa['age'] >= 27);
// Dos fichas activas no comparten cédula.
same(409, $router->handle('POST', '/api/creadoras', $json($csrf), creadora_json(['full_name' => 'Otra Persona', 'cedula' => '1801234567']))->status);
// Cédula, nacimiento y correo se guardan cifrados.
$row = $pdo->query("SELECT cedula_enc, birth_date_enc, contact_email_enc FROM creadoras WHERE full_name = 'Lucía Full'")->fetch(PDO::FETCH_ASSOC);
same(false, str_contains($row['cedula_enc'], '1801234567'));
same(false, str_contains($row['birth_date_enc'], '1998'));
same(false, str_contains($row['contact_email_enc'], 'lucia'));
// Editar sin volver a mandar la cédula la conserva.
$editada = creadora_body($router->handle('PATCH', '/api/creadoras/' . $completa['public_id'], $json($csrf), creadora_json(['full_name' => 'Lucía Full', 'city' => 'Quito'])))['creadora'];
same('1801234567', $editada['cedula']);
same('Quito', $editada['city']);

// El WhatsApp se guarda cifrado: la columna no contiene el número en claro.
$stored = (string) $pdo->query("SELECT whatsapp_enc FROM creadoras WHERE full_name = 'Ana Creadora'")->fetchColumn();
same(false, str_contains($stored, '0990000011'));

// Una caja del calendario: creadora, día y horas.
same(422, $router->handle('POST', '/api/creadoras/turnos', $json($csrf), creadora_json(['creadora' => $ana['public_id'], 'starts_at' => '2026-10-30 09:00', 'ends_at' => '2026-10-30 09:05']))->status);
same(422, $router->handle('POST', '/api/creadoras/turnos', $json($csrf), creadora_json(['creadora' => $ana['public_id'], 'starts_at' => 'mañana', 'ends_at' => '2026-10-30 12:00']))->status);
same(422, $router->handle('POST', '/api/creadoras/turnos', $json($csrf), creadora_json(['creadora' => $ana['public_id'], 'starts_at' => '2026-10-30 12:00', 'ends_at' => '2026-10-30 09:00']))->status);
$created = creadora_body($router->handle('POST', '/api/creadoras/turnos', $json($csrf), creadora_json([
    'creadora' => $ana['public_id'], 'starts_at' => '2026-10-30 09:00', 'ends_at' => '2026-10-30 12:00', 'place' => 'Plaza de la Luna'])));
same(201, 201);
$turno = $created['shift'];
same('2026-10-30 09:00:00', $turno['starts_at']);
same('Ana Creadora', $turno['name']);
// La bitácora registra quién lo hizo desde el primer movimiento.
same('created', $created['log'][0]['action']);
same('admin', $created['log'][0]['actor']);
same('Ana Creadora', $created['log'][0]['creadora']);

// Nadie puede estar en dos lugares a la vez.
same(409, $router->handle('POST', '/api/creadoras/turnos', $json($csrf), creadora_json([
    'creadora' => $ana['public_id'], 'starts_at' => '2026-10-30 11:00', 'ends_at' => '2026-10-30 13:00']))->status);
// Otra creadora sí puede compartir la misma hora.
$otro = creadora_body($router->handle('POST', '/api/creadoras/turnos', $json($csrf), creadora_json([
    'creadora' => $sofia['public_id'], 'starts_at' => '2026-10-30 09:00', 'ends_at' => '2026-10-30 11:00'])))['shift'];

// Arrastrar la caja: mover el turno de hora deja un registro con el antes y el después.
$moved = creadora_body($router->handle('PATCH', '/api/creadoras/turnos/' . $turno['public_id'], $json($csrf), creadora_json([
    'starts_at' => '2026-10-31 14:00', 'ends_at' => '2026-10-31 17:00'])));
same('2026-10-31 14:00:00', $moved['shift']['starts_at']);
same('moved', $moved['log'][0]['action']);
same('2026-10-30 09:00:00', $moved['log'][0]['before']['starts_at']);
same('2026-10-31 14:00:00', $moved['log'][0]['after']['starts_at']);

// Estirar la caja cambia la duración y se anota aparte.
$resized = creadora_body($router->handle('PATCH', '/api/creadoras/turnos/' . $turno['public_id'], $json($csrf), creadora_json([
    'starts_at' => '2026-10-31 14:00', 'ends_at' => '2026-10-31 19:00'])));
same('resized', $resized['log'][0]['action']);

// Soltar la caja sobre otra creadora queda como reasignación, con el nombre anterior en el detalle.
$reassigned = creadora_body($router->handle('PATCH', '/api/creadoras/turnos/' . $turno['public_id'], $json($csrf), creadora_json([
    'creadora' => $sofia['public_id'], 'starts_at' => '2026-11-01 08:00', 'ends_at' => '2026-11-01 10:00'])));
same('reassigned', $reassigned['log'][0]['action']);
same('Sofía Contenido', $reassigned['shift']['name']);
same(true, str_contains($reassigned['log'][0]['detail'], 'Ana Creadora'));

// El calendario se pide por rango y trae turnos, creadoras y bitácora de una sola vez.
$calendar = creadora_body($router->handle('GET', '/api/creadoras/calendario?from=2026-10-26&to=2026-11-02', $origin));
same(2, count($calendar['shifts']));
same(3, count($calendar['creadoras']));
same(true, count($calendar['log']) >= 4);
same(422, $router->handle('GET', '/api/creadoras/calendario?from=2026-11-02&to=2026-10-26', $origin)->status);
same(422, $router->handle('GET', '/api/creadoras/calendario?from=2026-10-26&to=2027-06-01', $origin)->status);
// Un turno fuera del rango no aparece.
same(0, count(creadora_body($router->handle('GET', '/api/creadoras/calendario?from=2026-12-01&to=2026-12-08', $origin))['shifts']));

// Quitar un turno lo saca del calendario sin borrar su rastro.
$removed = creadora_body($router->handle('POST', '/api/creadoras/turnos/' . $otro['public_id'], $json($csrf), ''));
same($otro['public_id'], $removed['removed']);
same('canceled', $removed['log'][0]['action']);
same(1, count(creadora_body($router->handle('GET', '/api/creadoras/calendario?from=2026-10-26&to=2026-11-02', $origin))['shifts']));
same(1, (int) $pdo->query('SELECT COUNT(*) FROM creadora_shifts WHERE canceled_at IS NOT NULL')->fetchColumn());
same(422, $router->handle('POST', '/api/creadoras/turnos/' . $otro['public_id'], $json($csrf), '')->status);

// La creadora entra con su propia cuenta y ve solo sus turnos.
creadora_close_session();
$session = creadora_body($router->handle('GET', '/api/creadora/auth/session', $origin));
same(false, $session['authenticated']);
same('finados_creadora', session_name());
$secret = 'frase segura de la creadora';
same(202, $router->handle('POST', '/api/creadora/auth/register', $json($session['csrf']), creadora_json(['email' => 'creadora@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true]))->status);
same(0, (int) $pdo->query('SELECT COUNT(*) FROM vocero_accounts')->fetchColumn());
same(0, (int) $pdo->query('SELECT COUNT(*) FROM media_accounts')->fetchColumn());
same(401, $router->handle('GET', '/api/creadora/profile', $origin)->status);
$session = creadora_body($router->handle('GET', '/api/creadora/auth/session', $origin));
$login = creadora_body($router->handle('POST', '/api/creadora/auth/login', $json($session['csrf']), creadora_json(['email' => 'creadora@example.invalid', 'password' => $secret])));
same('creadora', $login['user']['role']);
$own = creadora_body($router->handle('GET', '/api/creadora/profile', $origin));
same(null, $own['profile']);
same(true, isset($own['consents']['policies']['version']));

$record = ['full_name' => 'Valeria Creadora', 'whatsapp' => '0990000022', 'city' => 'Ambato', 'main_network' => 'instagram',
    'social_link' => 'https://www.instagram.com/valeria', 'policies_accepted' => true, 'privacy_accepted' => true];
same(422, $router->handle('POST', '/api/creadora/profile', $json($login['csrf']), creadora_json([...$record, 'policies_accepted' => false]))->status);
same(422, $router->handle('POST', '/api/creadora/profile', $json($login['csrf']), creadora_json([...$record, 'whatsapp' => '']))->status);
// Ella no se asigna estado: el campo ni siquiera se acepta en el cuerpo.
same(422, $router->handle('POST', '/api/creadora/profile', $json($login['csrf']), creadora_json([...$record, 'status' => 'Activa']))->status);
$saved = creadora_body($router->handle('POST', '/api/creadora/profile', $json($login['csrf']), creadora_json($record)));
same('Nuevo', $saved['profile']['status']);
same('cuenta', $saved['profile']['origin']);
same(true, $saved['profile']['has_account']);
same(0, count($saved['shifts']));
same(2, (int) $pdo->query("SELECT COUNT(*) FROM creadora_consents WHERE accepted = 1")->fetchColumn());

// Coordinación le asigna un turno y ella lo ve en su pantalla.
creadora_close_session();
$adminSession = creadora_body($router->handle('GET', '/api/auth/session', $origin));
$admin = creadora_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), creadora_json(['username' => 'admin', 'password' => $adminSecret])));
$valeria = null;
foreach (creadora_body($router->handle('GET', '/api/creadoras', $origin))['items'] as $item) if ($item['full_name'] === 'Valeria Creadora') $valeria = $item;
same(true, $valeria !== null);
$future = gmdate('Y-m-d', strtotime('+3 days'));
$router->handle('POST', '/api/creadoras/turnos', $json($admin['csrf']), creadora_json([
    'creadora' => $valeria['public_id'], 'starts_at' => $future . ' 10:00', 'ends_at' => $future . ' 13:00']));

creadora_close_session();
$session = creadora_body($router->handle('GET', '/api/creadora/auth/session', $origin));
$login = creadora_body($router->handle('POST', '/api/creadora/auth/login', $json($session['csrf']), creadora_json(['email' => 'creadora@example.invalid', 'password' => $secret])));
$mine = creadora_body($router->handle('GET', '/api/creadora/turnos', $origin));
same(1, count($mine['shifts']));
same($future . ' 10:00:00', $mine['shifts'][0]['starts_at']);
// Dentro de su propio ámbito no existe un calendario general: solo lo suyo.
same(404, $router->handle('GET', '/api/creadora/calendario', $origin)->status);
same(404, $router->handle('GET', '/api/creadora/creadoras', $origin)->status);
// Y su cookie no sirve para administrar: sin sesión de administración, la lista general responde 401.
creadora_close_session();
same(401, $router->handle('GET', '/api/creadoras', $origin)->status);
same(401, $router->handle('GET', '/api/creadoras/calendario?from=2026-10-26&to=2026-11-02', $origin)->status);

// Retirar a una creadora libera sus turnos futuros y deja el motivo en la bitácora.
creadora_close_session();
$adminSession = creadora_body($router->handle('GET', '/api/auth/session', $origin));
$admin = creadora_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), creadora_json(['username' => 'admin', 'password' => $adminSecret])));
$retired = creadora_body($router->handle('POST', '/api/creadoras/' . $valeria['public_id'] . '/retirar', $json($admin['csrf']), ''));
same('Retirada', $retired['creadora']['status']);
same(0, (int) $pdo->query("SELECT active FROM creadora_accounts WHERE email_idx <> ''")->fetchColumn());
$log = creadora_body($router->handle('GET', '/api/creadoras/bitacora', $origin))['log'];
same('canceled', $log[0]['action']);
same(true, str_contains($log[0]['detail'], 'retirada'));
// Ya retirada, no recibe turnos nuevos.
same(422, $router->handle('POST', '/api/creadoras/turnos', $json($admin['csrf']), creadora_json([
    'creadora' => $valeria['public_id'], 'starts_at' => '2026-11-02 10:00', 'ends_at' => '2026-11-02 12:00']))->status);
// Y desaparece de la lista de trabajo sin perderse del historial.
same(3, count(creadora_body($router->handle('GET', '/api/creadoras', $origin))['items']));
same(4, (int) $pdo->query('SELECT COUNT(*) FROM creadoras')->fetchColumn());

// El resto de secciones sigue intacto.
same(0, (int) $pdo->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same(0, (int) $pdo->query('SELECT COUNT(*) FROM media_profiles')->fetchColumn());
same(0, (int) $pdo->query('SELECT COUNT(*) FROM emprendedor_profiles')->fetchColumn());
creadora_close_session();
