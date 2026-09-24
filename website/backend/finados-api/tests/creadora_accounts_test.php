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
    '018_media_coverage', '019_media_event_attendance', '020_media_event_checkin', '021_creadora_accounts', '022_creadora_identity', '023_creadora_shift_content', '025_creadora_shift_script', '026_creadora_shift_members'] as $migration) {
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

// El turno guarda lo que pasó: asistencia y el contenido que se grabó.
$vivo = creadora_body($router->handle('POST', '/api/creadoras/turnos', $json($csrf), creadora_json([
    'creadora' => $ana['public_id'], 'starts_at' => '2026-11-02 09:00', 'ends_at' => '2026-11-02 13:00'])))['shift'];
same(null, $vivo['attended']);
same(0, count($vivo['content']));
// La asistencia se marca desde el mismo turno y queda con su hora.
$asistio = creadora_body($router->handle('PATCH', '/api/creadoras/turnos/' . $vivo['public_id'], $json($csrf), creadora_json(['attended' => 'yes'])));
same('yes', $asistio['shift']['attended']);
same(true, is_string($asistio['shift']['attendance_at']));
same('attendance', $asistio['log'][0]['action']);
same(true, str_contains($asistio['log'][0]['detail'], 'Asistió'));
same(422, $router->handle('PATCH', '/api/creadoras/turnos/' . $vivo['public_id'], $json($csrf), creadora_json(['attended' => 'quizás']))->status);
// Quitar la marca la deja sin dato otra vez.
same(null, creadora_body($router->handle('PATCH', '/api/creadoras/turnos/' . $vivo['public_id'], $json($csrf), creadora_json(['attended' => ''])))['shift']['attended']);
$router->handle('PATCH', '/api/creadoras/turnos/' . $vivo['public_id'], $json($csrf), creadora_json(['attended' => 'yes']));

// Varios contenidos en el mismo turno, cada uno con su tipo y su nombre.
same(422, $router->handle('POST', '/api/creadoras/turnos/' . $vivo['public_id'] . '/contenido', $json($csrf), creadora_json(['kind' => 'podcast', 'title' => 'x']))->status);
same(422, $router->handle('POST', '/api/creadoras/turnos/' . $vivo['public_id'] . '/contenido', $json($csrf), creadora_json(['kind' => 'video', 'title' => '']))->status);
same(422, $router->handle('POST', '/api/creadoras/turnos/' . $vivo['public_id'] . '/contenido', $json($csrf), creadora_json(['kind' => 'video', 'title' => 'Recorrido', 'url' => 'http://x.test']))->status);
$conVideo = creadora_body($router->handle('POST', '/api/creadoras/turnos/' . $vivo['public_id'] . '/contenido', $json($csrf), creadora_json([
    'kind' => 'video', 'title' => 'Recorrido por la feria', 'url' => 'https://www.tiktok.com/@ana/video/1'])));
same('video', $conVideo['shift']['content'][0]['kind']);
same('Video', $conVideo['shift']['content'][0]['kind_label']);
same('Recorrido por la feria', $conVideo['shift']['content'][0]['title']);
same('content', $conVideo['log'][0]['action']);
$conLive = creadora_body($router->handle('POST', '/api/creadoras/turnos/' . $vivo['public_id'] . '/contenido', $json($csrf), creadora_json([
    'kind' => 'live', 'title' => 'En vivo desde el escenario'])));
same(2, count($conLive['shift']['content']), 'un turno puede dejar más de un contenido');
// El calendario resume cuánto dejó cada turno.
$conteo = null;
foreach (creadora_body($router->handle('GET', '/api/creadoras/calendario?from=2026-11-02&to=2026-11-03', $origin))['shifts'] as $item) if ($item['public_id'] === $vivo['public_id']) $conteo = $item;
same(2, $conteo['content_count']);
same('yes', $conteo['attended']);
// Quitar un contenido deja el otro y queda en la bitácora.
$sinLive = creadora_body($router->handle('PATCH', '/api/creadoras/turnos/' . $vivo['public_id'] . '/contenido', $json($csrf), creadora_json(['content' => $conLive['shift']['content'][1]['public_id']])));
same(1, count($sinLive['shift']['content']));
same(true, str_contains($sinLive['log'][0]['detail'], 'Quitó'));
same(422, $router->handle('PATCH', '/api/creadoras/turnos/' . $vivo['public_id'] . '/contenido', $json($csrf), creadora_json(['content' => str_repeat('f', 32)]))->status);

// El cuaderno del turno: la referencia y el guion de lo que se va a grabar, y puede haber varios.
same(0, count($vivo['scripts']));
same(422, $router->handle('POST', '/api/creadoras/turnos/' . $vivo['public_id'] . '/guiones', $json($csrf), creadora_json(['title' => '', 'body' => 'x']))->status);
same(422, $router->handle('POST', '/api/creadoras/turnos/' . $vivo['public_id'] . '/guiones', $json($csrf), creadora_json(['title' => 'Idea', 'reference_url' => 'http://ref.test']))->status);
$guion = "Plano 1: entrada del complejo.\nPlano 2: la colada morada.\nCierre: invitación a venir.";
$conGuion = creadora_body($router->handle('POST', '/api/creadoras/turnos/' . $vivo['public_id'] . '/guiones', $json($csrf), creadora_json([
    'title' => 'Recorrido de apertura', 'body' => $guion, 'reference_url' => 'https://www.tiktok.com/@ref/video/9'])));
same(1, count($conGuion['shift']['scripts']));
same('Recorrido de apertura', $conGuion['shift']['scripts'][0]['title']);
same($guion, $conGuion['shift']['scripts'][0]['body'], 'el guion conserva sus saltos de línea');
same('https://www.tiktok.com/@ref/video/9', $conGuion['shift']['scripts'][0]['reference_url']);
same(true, str_contains($conGuion['log'][0]['detail'], 'Agregó el guion'));
// Más de un guion en el mismo turno, en el orden en que se escribieron.
$dos = creadora_body($router->handle('POST', '/api/creadoras/turnos/' . $vivo['public_id'] . '/guiones', $json($csrf), creadora_json([
    'title' => 'Entrevista a expositora', 'body' => 'Preguntas cortas.'])));
same(2, count($dos['shift']['scripts']));
same('Entrevista a expositora', $dos['shift']['scripts'][1]['title']);
// Editar un guion conserva lo que no se manda.
$id = $dos['shift']['scripts'][0]['public_id'];
$editado = creadora_body($router->handle('PATCH', '/api/creadoras/turnos/' . $vivo['public_id'] . '/guiones/' . $id, $json($csrf), creadora_json(['title' => 'Recorrido de apertura v2'])));
same('Recorrido de apertura v2', $editado['shift']['scripts'][0]['title']);
same($guion, $editado['shift']['scripts'][0]['body']);
// Un guion de otro turno no se toca desde aquí.
same(422, $router->handle('PATCH', '/api/creadoras/turnos/' . $turno['public_id'] . '/guiones/' . $id, $json($csrf), creadora_json(['title' => 'Ajeno']))->status);
same(1, count(creadora_body($router->handle('POST', '/api/creadoras/turnos/' . $vivo['public_id'] . '/guiones/' . $id, $json($csrf), ''))['shift']['scripts']));
// El calendario cuenta los guiones para saber qué turno ya tiene plan.
$conteoGuion = null;
foreach (creadora_body($router->handle('GET', '/api/creadoras/calendario?from=2026-11-02&to=2026-11-03', $origin))['shifts'] as $item) if ($item['public_id'] === $vivo['public_id']) $conteoGuion = $item;
same(1, $conteoGuion['script_count']);
// Al abrir el turno, su detalle trae los guiones que el calendario solo cuenta.
$detalle = creadora_body($router->handle('GET', '/api/creadoras/turnos/' . $vivo['public_id'], $origin));
same(1, count($detalle['shift']['scripts']));
same($conteoGuion['script_count'], count($detalle['shift']['scripts']));
same(true, is_array($detalle['shift']['content']));
same(422, $router->handle('GET', '/api/creadoras/turnos/' . str_repeat('0', 32), $origin)->status);

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

// Varias creadoras en la misma caja: un turno compartido, con asistencia y contenido de cada una.
$c = $admin['csrf'];
same(422, $router->handle('POST', '/api/creadoras/turnos', $json($c), creadora_json(['creadoras' => [], 'starts_at' => '2026-11-03 10:00', 'ends_at' => '2026-11-03 13:00']))->status);
same(422, $router->handle('POST', '/api/creadoras/turnos', $json($c), creadora_json(['creadoras' => 'no-es-lista', 'starts_at' => '2026-11-03 10:00', 'ends_at' => '2026-11-03 13:00']))->status);
$grupo = creadora_body($router->handle('POST', '/api/creadoras/turnos', $json($c), creadora_json([
    'creadoras' => [$ana['public_id'], $sofia['public_id'], $completa['public_id'], $ana['public_id']],
    'starts_at' => '2026-11-03 10:00', 'ends_at' => '2026-11-03 13:00', 'place' => 'Escenario'])))['shift'];
same(3, count($grupo['creadoras']));
same('Ana Creadora, Sofía Contenido, Lucía Full', $grupo['name']);
// Ninguna de las tres puede estar en otro turno a la misma hora.
same(409, $router->handle('POST', '/api/creadoras/turnos', $json($c), creadora_json(['creadora' => $sofia['public_id'], 'starts_at' => '2026-11-03 12:00', 'ends_at' => '2026-11-03 14:00']))->status);
// En un turno compartido hay que decir de quién es la asistencia.
same(422, $router->handle('PATCH', '/api/creadoras/turnos/' . $grupo['public_id'], $json($c), creadora_json(['attended' => 'yes']))->status);
$marcado = creadora_body($router->handle('PATCH', '/api/creadoras/turnos/' . $grupo['public_id'], $json($c), creadora_json(['attended' => 'yes', 'attendance_for' => $ana['public_id']])))['shift'];
same('yes', $marcado['creadoras'][0]['attended']);
same(null, $marcado['creadoras'][1]['attended']);
same('partial', $marcado['attended']);
same(1, $marcado['attended_count']);
// El contenido de un turno compartido dice de quién es.
same(422, $router->handle('POST', '/api/creadoras/turnos/' . $grupo['public_id'] . '/contenido', $json($c), creadora_json(['kind' => 'video', 'title' => 'Sin dueña']))->status);
$router->handle('POST', '/api/creadoras/turnos/' . $grupo['public_id'] . '/contenido', $json($c), creadora_json(['kind' => 'video', 'title' => 'Baile de apertura', 'creadora' => $sofia['public_id']]));
$conVideo = creadora_body($router->handle('POST', '/api/creadoras/turnos/' . $grupo['public_id'] . '/contenido', $json($c), creadora_json(['kind' => 'live', 'title' => 'Live del escenario', 'creadora' => $sofia['public_id']])))['shift'];
same('Sofía Contenido', $conVideo['content'][0]['creadora_name']);
// Un guion puede ser de una creadora o de todas, y se marca cuando ya está grabado.
same(422, $router->handle('POST', '/api/creadoras/turnos/' . $grupo['public_id'] . '/guiones', $json($c), creadora_json(['title' => 'Ajena', 'creadora' => str_repeat('f', 32)]))->status);
$router->handle('POST', '/api/creadoras/turnos/' . $grupo['public_id'] . '/guiones', $json($c), creadora_json(['title' => 'Coreografía grupal', 'body' => 'Las tres juntas.']));
$guiones = creadora_body($router->handle('POST', '/api/creadoras/turnos/' . $grupo['public_id'] . '/guiones', $json($c), creadora_json(['title' => 'Entrevista a Lucía', 'creadora' => $completa['public_id']])))['shift']['scripts'];
same('', $guiones[0]['creadora']);
same('Lucía Full', $guiones[1]['creadora_name']);
same(false, $guiones[1]['recorded']);
$grabado = creadora_body($router->handle('PATCH', '/api/creadoras/turnos/' . $grupo['public_id'] . '/guiones/' . $guiones[1]['public_id'], $json($c), creadora_json(['recorded' => true])))['shift']['scripts'][1];
same(true, $grabado['recorded']);
same('Entrevista a Lucía', $grabado['title']);
same(422, $router->handle('PATCH', '/api/creadoras/turnos/' . $grupo['public_id'] . '/guiones/' . $guiones[1]['public_id'], $json($c), creadora_json(['recorded' => 'quizás']))->status);
// Los indicadores cuentan por creadora; el guion «para todas» cuenta para cada una, pero una sola vez en el total.
$tablero = creadora_body($router->handle('GET', '/api/creadoras/calendario?from=2026-11-02&to=2026-11-09', $origin));
$porNombre = array_column($tablero['indicators']['items'], null, 'name');
same(2, $porNombre['Lucía Full']['scripts']);
same(1, $porNombre['Lucía Full']['recorded']);
same(1, $porNombre['Sofía Contenido']['videos']);
same(2, $porNombre['Sofía Contenido']['content']);
same(1, $porNombre['Sofía Contenido']['scripts']);
same(0, $porNombre['Sofía Contenido']['recorded']);
same(1, $porNombre['Ana Creadora']['attended'] >= 1 ? 1 : 0);
same(2, (int) $pdo->query("SELECT COUNT(*) FROM creadora_shift_script g JOIN creadora_shifts s ON s.id = g.shift_id WHERE s.public_id = '" . $grupo['public_id'] . "'")->fetchColumn());
same(true, $tablero['indicators']['totals']['recorded'] >= 1);
$enCalendario = array_values(array_filter($tablero['shifts'], static fn (array $shift): bool => $shift['public_id'] === $grupo['public_id']))[0];
same(3, count($enCalendario['creadoras']));
same(1, $enCalendario['recorded_count']);
// Sacar a una integrante no borra el turno de las demás y la bitácora lo cuenta.
$sinLucia = creadora_body($router->handle('PATCH', '/api/creadoras/turnos/' . $grupo['public_id'], $json($c), creadora_json(['creadoras' => [$ana['public_id'], $sofia['public_id']]])));
same(2, count($sinLucia['shift']['creadoras']));
same('reassigned', $sinLucia['log'][0]['action']);
same(true, str_contains($sinLucia['log'][0]['detail'], 'Lucía Full'));
// Ana conserva su asistencia porque siguió en el turno.
same('yes', $sinLucia['shift']['creadoras'][0]['attended']);
// La creadora con cuenta ve también los turnos que comparte.
same(1, (int) $pdo->query("SELECT COUNT(*) FROM creadora_shift_members m JOIN creadoras c ON c.id = m.creadora_id WHERE c.full_name = 'Sofía Contenido' AND m.shift_id = (SELECT id FROM creadora_shifts WHERE public_id = '" . $grupo['public_id'] . "')")->fetchColumn());

// Retirar a una integrante de un turno compartido deja el turno en pie para las demás.
$compartido = creadora_body($router->handle('POST', '/api/creadoras/turnos', $json($c), creadora_json([
    'creadoras' => [$completa['public_id'], $ana['public_id']], 'starts_at' => '2026-11-04 10:00', 'ends_at' => '2026-11-04 12:00'])))['shift'];
$router->handle('POST', '/api/creadoras/' . $completa['public_id'] . '/retirar', $json($c), '');
$tras = array_values(array_filter(creadora_body($router->handle('GET', '/api/creadoras/calendario?from=2026-11-02&to=2026-11-09', $origin))['shifts'],
    static fn (array $shift): bool => $shift['public_id'] === $compartido['public_id']))[0];
same('Ana Creadora', $tras['name']);
same($ana['public_id'], $tras['creadora']);

// El panel principal resume a cada creadora: horas que vino y su historial, sin modificar nada.
$antesPanel = (int) $pdo->query('SELECT COUNT(*) FROM creadora_shift_log')->fetchColumn();
$panelCrypto = new Finados\Crypto($config);
$panel = ['creadoras' => (new Finados\CreadoraRepository($pdo, $panelCrypto, new Finados\Audit($pdo, $panelCrypto)))->panel()];
same(true, is_array($panel['creadoras']));
$anaPanel = array_values(array_filter($panel['creadoras']['people'], static fn (array $person): bool => $person['creadora'] === $ana['public_id']))[0];
same('Ana Creadora', $anaPanel['name']);
same(true, $anaPanel['attended_minutes'] > 0);
same(true, $anaPanel['scheduled_minutes'] >= $anaPanel['attended_minutes']);
same($anaPanel['shifts'], count($anaPanel['history']['shifts']));
same(true, isset($anaPanel['history']['content'], $anaPanel['history']['recorded_scripts']));
foreach ($anaPanel['history']['shifts'] as $turno) same(true, $turno['minutes'] >= 15);
same(array_sum(array_column($panel['creadoras']['people'], 'attended_minutes')), $panel['creadoras']['totals']['attended_minutes']);
same(false, in_array($completa['public_id'], array_column($panel['creadoras']['people'], 'creadora'), true));
same($antesPanel, (int) $pdo->query('SELECT COUNT(*) FROM creadora_shift_log')->fetchColumn());

// El resto de secciones sigue intacto.
same(0, (int) $pdo->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same(0, (int) $pdo->query('SELECT COUNT(*) FROM media_profiles')->fetchColumn());
same(0, (int) $pdo->query('SELECT COUNT(*) FROM emprendedor_profiles')->fetchColumn());
creadora_close_session();
