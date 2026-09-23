<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\MediaRepository;
use Finados\Router;

function coverage_config(): Config
{
    static $path = null;
    if ($path === null) {
        $root = tempnam(sys_get_temp_dir(), 'finados-coverage-');
        if ($root === false || !unlink($root) || !mkdir($root, 0700)) throw new RuntimeException('Unable to create coverage test root.');
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
function coverage_body($response): array
{
    $body = json_decode($response->body, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($body)) throw new RuntimeException('Expected JSON object.');
    return $body;
}
function coverage_close_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    session_id('');
    $_SESSION = [];
}
function coverage_json(array $payload): string { return json_encode($payload, JSON_THROW_ON_ERROR); }

coverage_close_session();
$config = coverage_config();
$pdo = Database::connect($config);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts', '008_media_accounts', '009_media_videos', '010_media_video_views', '011_media_contact_channels', '012_media_consents', '013_media_types_radio', '014_media_channels_photo', '015_media_traffic_light', '016_media_paid', '018_media_coverage', '019_media_event_attendance'] as $migration) {
    $pdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
}
same('018_media_coverage', $pdo->query("SELECT version FROM schema_migrations WHERE version = '018_media_coverage'")->fetchColumn());
$adminSecret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([
    str_repeat('a', 32), 'admin', Auth::hashPassword($adminSecret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'),
]);
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.80'];
$json = static fn (string $csrf): array => [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $csrf];

// Administration signs in and creates the coverage event of the launch.
$adminSession = coverage_body($router->handle('GET', '/api/auth/session', $origin));
$adminLogin = coverage_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), coverage_json(['username' => 'admin', 'password' => $adminSecret])));
$admin = $json($adminLogin['csrf']);
same([], coverage_body($router->handle('GET', '/api/media-events', $origin))['items']);
same(422, $router->handle('POST', '/api/media-events', $admin, coverage_json(['name' => 'ab', 'event_date' => null]))->status);
same(422, $router->handle('POST', '/api/media-events', $admin, coverage_json(['name' => 'Lanzamiento', 'event_date' => '2026-13-40']))->status);
$event = coverage_body($router->handle('POST', '/api/media-events', $admin, coverage_json(['name' => 'Lanzamiento Finados 2026', 'event_date' => '2026-09-17'])))['event'];
same('Lanzamiento Finados 2026', $event['name']);
same(409, $router->handle('POST', '/api/media-events', $admin, coverage_json(['name' => 'lanzamiento finados 2026', 'event_date' => null]))->status);
$eventId = $event['public_id'];

// Coordination creates a record for a medium that has no account: only name and type are mandatory.
$record = ['media_name' => 'Radio Cumbre', 'media_types' => ['radio'], 'frequency' => '102.5 FM', 'tv_channel' => '', 'province' => 'Chimborazo', 'city' => 'Riobamba', 'program_name' => 'Al día Noticias y deportes',
    'representatives' => [['name' => 'Marcelo Padilla', 'role' => 'Director'], ['name' => 'Aníbal Rojas', 'role' => 'Periodista']],
    'channels' => [['type' => 'facebook', 'url' => 'https://www.facebook.com/radiocumbre', 'followers' => null]], 'followers_validated' => 22000, 'paid_media' => 'yes',
    'contact_name' => '', 'phone' => '', 'contact_email' => ''];
same(422, $router->handle('POST', '/api/medios', $admin, coverage_json([...$record, 'media_types' => []]))->status);
same(422, $router->handle('POST', '/api/medios', $admin, coverage_json([...$record, 'media_name' => 'R']))->status);
same(422, $router->handle('POST', '/api/medios', $admin, coverage_json([...$record, 'province' => 'Marte']))->status);
same(422, $router->handle('POST', '/api/medios', $admin, coverage_json([...$record, 'representatives' => [['name' => 'X', 'cargo' => 'Y']]]))->status);
same(422, $router->handle('POST', '/api/medios', $admin, coverage_json([...$record, 'followers_validated' => '22000']))->status);
same(422, $router->handle('POST', '/api/medios', $admin, coverage_json([...$record, 'phone' => 'sin numero']))->status);
same(422, $router->handle('POST', '/api/medios', $admin, coverage_json([...$record, 'status' => 'Aprobado']))->status);
$created = coverage_body($router->handle('POST', '/api/medios', $admin, coverage_json($record)));
same('coordinacion', $created['origin']);
same(false, $created['linked']);
same(true, $created['invitation_allowed']);
same('Al día Noticias y deportes', $created['program_name']);
same('Marcelo Padilla', $created['representatives'][0]['name']);
same(22000, $created['followers_validated']);
same('yes', $created['paid_media']);
same('102.5 FM', $created['radio_stations'][0]['frequency']);
same('', $created['account_email']);
same([], $created['coverage']);
$cumbre = $created['public_id'];
// Duplicate names are refused, case-insensitively, so loading a list never creates two records for one medium.
same(409, $router->handle('POST', '/api/medios', $admin, coverage_json([...$record, 'media_name' => 'RADIO CUMBRE']))->status);
$second = coverage_body($router->handle('POST', '/api/medios', $admin, coverage_json([...$record, 'media_name' => 'Radio Mundo', 'frequency' => '91.5 FM', 'city' => 'Guaranda', 'province' => 'Bolívar', 'paid_media' => 'no', 'followers_validated' => null, 'representatives' => []])));
$mundo = $second['public_id'];
$list = coverage_body($router->handle('GET', '/api/medios?origin=coordinacion', $origin));
same(2, $list['pagination']['total']);
same('coordinacion', $list['items'][0]['origin']);
same(false, $list['items'][0]['linked']);
same(0, coverage_body($router->handle('GET', '/api/medios?origin=cuenta', $origin))['pagination']['total']);
same(422, $router->handle('GET', '/api/medios?origin=otro', $origin)->status);
// Coordination completes the record later.
same(['ok' => true], coverage_body($router->handle('PATCH', '/api/medios/' . $cumbre . '/details', $admin, coverage_json([...$record, 'followers_validated' => 25000, 'representatives' => [['name' => 'Marcelo Padilla', 'role' => 'Director']]]))));
same(25000, coverage_body($router->handle('GET', '/api/medios/' . $cumbre, $origin))['followers_validated']);
same(409, $router->handle('PATCH', '/api/medios/' . $mundo . '/details', $admin, coverage_json([...$record]))->status);

// Coverage per event and the big-number buckets.
$coverage = static fn (?string $contracted, string $result, array $links = [], int $people = 2): string => coverage_json(['contracted' => $contracted, 'result' => $result, 'people_count' => $people, 'links' => $links, 'note' => '']);
same(422, $router->handle('PATCH', '/api/media-events/' . $eventId . '/coverage/' . $cumbre, $admin, $coverage('yes', 'publicado'))->status);
same(422, $router->handle('PATCH', '/api/media-events/' . $eventId . '/coverage/' . $cumbre, $admin, $coverage('maybe', 'link'))->status);
same(422, $router->handle('PATCH', '/api/media-events/' . $eventId . '/coverage/' . $cumbre, $admin, $coverage('yes', 'link', ['javascript:alert(1)']))->status);
same(404, $router->handle('PATCH', '/api/media-events/' . str_repeat('b', 32) . '/coverage/' . $cumbre, $admin, $coverage('yes', 'link'))->status);
same(['ok' => true], coverage_body($router->handle('PATCH', '/api/media-events/' . $eventId . '/coverage/' . $cumbre, $admin, $coverage('yes', 'link', ['https://www.facebook.com/share/v/1CBhn9eMsa/', 'https://www.facebook.com/share/v/1CBhn9eMsa/']))));
same(['ok' => true], coverage_body($router->handle('PATCH', '/api/media-events/' . $eventId . '/coverage/' . $mundo, $admin, $coverage('no', 'no_asistio', [], 1))));
$detail = coverage_body($router->handle('GET', '/api/media-events/' . $eventId, $origin));
same('Lanzamiento Finados 2026', $detail['event']['name']);
same(2, count($detail['items']));
same(1, count($detail['items'][0]['links']));
same([$cumbre, $mundo], $detail['summary']['todos']['ids']);
same([$cumbre], $detail['summary']['pautados']['ids']);
same([$cumbre], $detail['summary']['pautados_publicaron']['ids']);
same([], $detail['summary']['pautados_sin_publicacion']['ids']);
same([], $detail['summary']['sin_contrato_publicaron']['ids']);
same([$mundo], $detail['summary']['sin_contrato_sin_publicacion']['ids']);
same([$mundo], $detail['summary']['no_asistieron']['ids']);
same('Pautados sin publicación', $detail['summary']['pautados_sin_publicacion']['label']);
// A radio mention counts as published even without a link.
same(['ok' => true], coverage_body($router->handle('PATCH', '/api/media-events/' . $eventId . '/coverage/' . $mundo, $admin, $coverage('yes', 'mencion'))));
$detail = coverage_body($router->handle('GET', '/api/media-events/' . $eventId, $origin));
same([$cumbre, $mundo], $detail['summary']['pautados_publicaron']['ids']);
same(1, coverage_body($router->handle('GET', '/api/media-events', $origin))['items'][0]['coverage_count'] === 2 ? 1 : 0);
same('mencion', coverage_body($router->handle('GET', '/api/medios/' . $mundo, $origin))['coverage'][0]['result']);
same(2, (int) $pdo->query("SELECT COUNT(*) FROM media_event_coverage")->fetchColumn());
// Invitation for a record without account.
same(403, $router->handle('POST', '/api/medios/' . $cumbre . '/invite', ['REMOTE_ADDR' => '192.0.2.80', 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $adminLogin['csrf']], '{}')->status);
$invite = coverage_body($router->handle('POST', '/api/medios/' . $cumbre . '/invite', $admin, '{}'));
same(true, str_starts_with($invite['invitationUrl'], 'https://example.invalid/finados/medios/acceso/?invitacion='));
$inviteToken = explode('invitacion=', $invite['invitationUrl'])[1];
$export = $router->handle('POST', '/api/medios/export', $admin, coverage_json(['origin' => 'coordinacion']));
same(200, $export->status);
same(true, str_contains($export->body, 'origin') && str_contains($export->body, ',coordinacion,No,') && str_contains($export->body, 'Marcelo Padilla (Director)') && str_contains($export->body, ',25000,'));
coverage_close_session();

// A medium registers with the invitation: its account is linked to the prepared record before the first login.
$preview = coverage_body($router->handle('GET', '/api/media/invitation?token=' . $inviteToken, ['REMOTE_ADDR' => '198.51.100.20']));
same('Radio Cumbre', $preview['invitation']['media_name']);
same(404, $router->handle('GET', '/api/media/invitation?token=' . str_repeat('c', 64), $origin)->status);
$session = coverage_body($router->handle('GET', '/api/media/auth/session', $origin));
$secret = 'frase segura de la radio';
same(404, $router->handle('POST', '/api/media/auth/register', $json($session['csrf']), coverage_json(['email' => 'cumbre@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true, 'invitation' => str_repeat('c', 64)]))->status);
same(0, (int) $pdo->query('SELECT COUNT(*) FROM media_accounts')->fetchColumn());
same(202, $router->handle('POST', '/api/media/auth/register', $json($session['csrf']), coverage_json(['email' => 'cumbre@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true, 'invitation' => $inviteToken]))->status);
same(1, (int) $pdo->query('SELECT COUNT(*) FROM media_invitations WHERE consumed_at IS NOT NULL')->fetchColumn());
$session = coverage_body($router->handle('GET', '/api/media/auth/session', $origin));
$login = coverage_body($router->handle('POST', '/api/media/auth/login', $json($session['csrf']), coverage_json(['email' => 'cumbre@example.invalid', 'password' => $secret])));
$own = coverage_body($router->handle('GET', '/api/media/profile', $origin));
same(true, $own['registered']);
same('Radio Cumbre', $own['media_name']);
same('coordinacion', $own['origin']);
same(true, $own['linked']);
same(false, array_key_exists('followers_validated', $own) && $own['followers_validated'] !== null && false);
same(true, $own['editable']);
// The link is single use.
same(404, $router->handle('POST', '/api/media/auth/register', $json($login['csrf']), coverage_json(['email' => 'otra@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true, 'invitation' => $inviteToken]))->status);
coverage_close_session();

// Another medium creates an account on its own, finds the record coordination loaded and asks to take it over.
$session = coverage_body($router->handle('GET', '/api/media/auth/session', $origin));
same(202, $router->handle('POST', '/api/media/auth/register', $json($session['csrf']), coverage_json(['email' => 'mundo@example.invalid', 'password' => $secret, 'privacyAcknowledged' => true]))->status);
$session = coverage_body($router->handle('GET', '/api/media/auth/session', $origin));
$login = coverage_body($router->handle('POST', '/api/media/auth/login', $json($session['csrf']), coverage_json(['email' => 'mundo@example.invalid', 'password' => $secret])));
same([], coverage_body($router->handle('GET', '/api/media/lookup?name=zz', $origin))['items']);
$found = coverage_body($router->handle('GET', '/api/media/lookup?name=radio%20mun', $origin))['items'];
same(1, count($found));
same('Radio Mundo', $found[0]['media_name']);
same(['public_id', 'media_name', 'city', 'media_types'], array_keys($found[0]));
same(404, $router->handle('POST', '/api/media/claim', $json($login['csrf']), coverage_json(['public_id' => $cumbre]))->status);
$claim = coverage_body($router->handle('POST', '/api/media/claim', $json($login['csrf']), coverage_json(['public_id' => $mundo])));
same('Radio Mundo', $claim['claim']['media_name']);
$pending = coverage_body($router->handle('GET', '/api/media/profile', $origin));
same(false, $pending['registered']);
same(false, $pending['editable']);
same('Radio Mundo', $pending['claim']['media_name']);
same(403, $router->handle('POST', '/api/media/claim', $json($login['csrf']), coverage_json(['public_id' => $mundo]))->status);
same([], coverage_body($router->handle('GET', '/api/media/lookup?name=radio', $origin))['items']);
coverage_close_session();
$adminSession = coverage_body($router->handle('GET', '/api/auth/session', $origin));
$adminLogin = coverage_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), coverage_json(['username' => 'admin', 'password' => $adminSecret])));
$admin = $json($adminLogin['csrf']);
$claims = coverage_body($router->handle('GET', '/api/media-claims', $origin))['items'];
same(1, count($claims));
same('mundo@example.invalid', $claims[0]['email']);
same(true, coverage_body($router->handle('GET', '/api/medios', $origin))['items'][0]['claim_pending'] || coverage_body($router->handle('GET', '/api/medios', $origin))['items'][1]['claim_pending']);
same(['ok' => true], coverage_body($router->handle('POST', '/api/medios/' . $mundo . '/claim/approve', $admin, '{}')));
same(404, $router->handle('POST', '/api/medios/' . $mundo . '/claim/reject', $admin, '{}')->status);
same([], coverage_body($router->handle('GET', '/api/media-claims', $origin))['items']);
same('mundo@example.invalid', coverage_body($router->handle('GET', '/api/medios/' . $mundo, $origin))['account_email']);
same(403, $router->handle('POST', '/api/medios/' . $mundo . '/invite', $admin, '{}')->status);
coverage_close_session();
$session = coverage_body($router->handle('GET', '/api/media/auth/session', $origin));
$login = coverage_body($router->handle('POST', '/api/media/auth/login', $json($session['csrf']), coverage_json(['email' => 'mundo@example.invalid', 'password' => $secret])));
$own = coverage_body($router->handle('GET', '/api/media/profile', $origin));
same(true, $own['registered']);
same('Radio Mundo', $own['media_name']);
same(2, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type IN ('media.claim_approved', 'media.invitation_consumed')")->fetchColumn());
coverage_close_session();

// Retiring a coordination record without account keeps working.
$repository = new MediaRepository($pdo, new Finados\Crypto($config));
$third = $repository->createByAdmin([...$record, 'media_name' => 'Radio Brisa 95.3', 'paid_media' => 'no'], 1, '192.0.2.81');
$repository->archive($third['public_id'], 1, '192.0.2.81');
same(null, $repository->find($third['public_id']));
same(3, (int) $pdo->query('SELECT COUNT(*) FROM media_profiles')->fetchColumn());
coverage_close_session();

// ---------------------------------------------------------------- 019: invitation, confirmation and attendance
coverage_close_session();
$adminSession = coverage_body($router->handle('GET', '/api/auth/session', $origin));
$adminLogin = coverage_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), coverage_json(['username' => 'admin', 'password' => $adminSecret])));
$admin = $json($adminLogin['csrf']);
// A new event invites every active medium at once; contract is pre-filled from each record.
$active = (int) $pdo->query("SELECT COUNT(*) FROM media_profiles WHERE status <> 'Eliminado'")->fetchColumn();
same(422, $router->handle('POST', '/api/media-events', $admin, coverage_json(['name' => 'Rueda de prensa Finados', 'event_date' => null, 'place' => str_repeat('x', 200), 'details' => '']))->status);
$second = coverage_body($router->handle('POST', '/api/media-events', $admin, coverage_json(['name' => 'Rueda de prensa Finados', 'event_date' => '2026-10-01', 'place' => 'Complejo Mushuc Runa', 'details' => 'Acreditación desde las 09:00'])))['event'];
same($active, $second['coverage_count']);
same('Complejo Mushuc Runa', $second['place']);
$rueda = $second['public_id'];
$detail = coverage_body($router->handle('GET', '/api/media-events/' . $rueda, $origin));
same($active, count($detail['items']));
same('Acreditación desde las 09:00', $detail['event']['details']);
same($active, count($detail['summary']['todos']['ids']));
same(0, count($detail['summary']['confirmaron']['ids']));
same(0, count($detail['summary']['asistieron']['ids']));
// Only linked media can answer, so "Sin respuesta" counts just those.
$linked = (int) $pdo->query("SELECT COUNT(*) FROM media_profiles WHERE status <> 'Eliminado' AND account_id IS NOT NULL")->fetchColumn();
same($linked, count($detail['summary']['no_confirmaron']['ids']));
$cumbreRow = null;
foreach ($detail['items'] as $item) if ($item['public_id'] === $cumbre) $cumbreRow = $item;
same('yes', $cumbreRow['contracted']);
same(null, $cumbreRow['confirmation']);
same(null, $cumbreRow['attended']);
coverage_close_session();

// The medium sees the invitation in its portal and answers it.
$session = coverage_body($router->handle('GET', '/api/media/auth/session', $origin));
$login = coverage_body($router->handle('POST', '/api/media/auth/login', $json($session['csrf']), coverage_json(['email' => 'cumbre@example.invalid', 'password' => $secret])));
$own = coverage_body($router->handle('GET', '/api/media/profile', $origin));
same(2, count($own['events']));
$invitation = null;
foreach ($own['events'] as $entry) if ($entry['public_id'] === $rueda) $invitation = $entry;
same('Rueda de prensa Finados', $invitation['name']);
same('Complejo Mushuc Runa', $invitation['place']);
same(null, $invitation['confirmation']);
same(false, array_key_exists('note', $invitation));
same(422, $router->handle('POST', '/api/media/attendance', $json($login['csrf']), coverage_json(['event' => $rueda, 'answer' => 'tal vez']))->status);
same(404, $router->handle('POST', '/api/media/attendance', $json($login['csrf']), coverage_json(['event' => str_repeat('d', 32), 'answer' => 'yes']))->status);
$answered = coverage_body($router->handle('POST', '/api/media/attendance', $json($login['csrf']), coverage_json(['event' => $rueda, 'answer' => 'yes'])));
foreach ($answered['events'] as $entry) if ($entry['public_id'] === $rueda) same('yes', $entry['confirmation']);
// The answer can be changed, and the medium never sets its own attendance.
$answered = coverage_body($router->handle('POST', '/api/media/attendance', $json($login['csrf']), coverage_json(['event' => $rueda, 'answer' => 'no'])));
foreach ($answered['events'] as $entry) if ($entry['public_id'] === $rueda) { same('no', $entry['confirmation']); same(null, $entry['attended']); }
// Without an allowed origin the request is refused before reaching the session guard.
same(403, $router->handle('POST', '/api/media/attendance', ['REMOTE_ADDR' => '192.0.2.80', 'CONTENT_TYPE' => 'application/json'], coverage_json(['event' => $rueda, 'answer' => 'yes']))->status);
coverage_close_session();

// Coordination records who actually attended, for media with and without an account.
$adminSession = coverage_body($router->handle('GET', '/api/auth/session', $origin));
$adminLogin = coverage_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), coverage_json(['username' => 'admin', 'password' => $adminSecret])));
$admin = $json($adminLogin['csrf']);
$attendance = static fn (string $attended): string => coverage_json(['contracted' => 'yes', 'result' => 'pendiente', 'people_count' => 2, 'links' => [], 'note' => '', 'attended' => $attended]);
same(422, $router->handle('PATCH', '/api/media-events/' . $rueda . '/coverage/' . $cumbre, $admin, $attendance('quizá'))->status);
same(['ok' => true], coverage_body($router->handle('PATCH', '/api/media-events/' . $rueda . '/coverage/' . $cumbre, $admin, $attendance('yes'))));
same(['ok' => true], coverage_body($router->handle('PATCH', '/api/media-events/' . $rueda . '/coverage/' . $mundo, $admin, $attendance('no'))));
$detail = coverage_body($router->handle('GET', '/api/media-events/' . $rueda, $origin));
same([$cumbre], $detail['summary']['asistieron']['ids']);
same(true, in_array($mundo, $detail['summary']['no_asistieron']['ids'], true));
same(0, count($detail['summary']['confirmaron']['ids']));
foreach ($detail['items'] as $item) if ($item['public_id'] === $cumbre) { same('yes', $item['attended']); same('no', $item['confirmation']); }
same(1, (int) $pdo->query("SELECT COUNT(*) FROM media_events WHERE name = 'Rueda de prensa Finados'")->fetchColumn());
same(1, coverage_body($router->handle('GET', '/api/media-events', $origin))['items'][0]['confirmed_count'] === 0 ? 1 : 0);
coverage_close_session();

// ---------------------------------------------------------------- the sheet's contract belongs on the record
// Medios is the source of truth: a contract in the sheet marks the record as paid, not only the event row.
$importer = static function (array $group) use ($pdo, $config): array {
    $repository = new MediaRepository($pdo, new Finados\Crypto($config));
    return $repository->createByAdmin([
        'media_name' => $group['name'], 'media_types' => ['radio'], 'frequency' => '', 'tv_channel' => '', 'province' => '', 'city' => '', 'program_name' => '',
        'representatives' => [], 'channels' => [], 'followers_validated' => null,
        'paid_media' => $group['contracted'] === 'yes' ? 'yes' : 'no', 'contact_name' => '', 'phone' => '', 'contact_email' => '',
    ], 1, '127.0.0.1');
};
same('yes', $importer(['name' => 'Radio Con Contrato', 'contracted' => 'yes'])['paid_media']);
same('no', $importer(['name' => 'Radio Sin Contrato', 'contracted' => 'no'])['paid_media']);
same('no', $importer(['name' => 'Radio Sin Dato', 'contracted' => null])['paid_media']);
coverage_close_session();

// Coordination may register the answer a medium gave by phone; the same column the portal writes.
$adminSession = coverage_body($router->handle('GET', '/api/auth/session', $origin));
$adminLogin = coverage_body($router->handle('POST', '/api/auth/login', $json($adminSession['csrf']), coverage_json(['username' => 'admin', 'password' => $adminSecret])));
$admin = $json($adminLogin['csrf']);
$withConfirmation = static fn (?string $confirmation): string => coverage_json(['contracted' => 'yes', 'result' => 'pendiente', 'people_count' => 1, 'links' => [], 'note' => '', 'attended' => 'yes', 'confirmation' => $confirmation]);
same(422, $router->handle('PATCH', '/api/media-events/' . $rueda . '/coverage/' . $mundo, $admin, $withConfirmation('quizá'))->status);
same(['ok' => true], coverage_body($router->handle('PATCH', '/api/media-events/' . $rueda . '/coverage/' . $mundo, $admin, $withConfirmation('yes'))));
$detail = coverage_body($router->handle('GET', '/api/media-events/' . $rueda, $origin));
foreach ($detail['items'] as $item) if ($item['public_id'] === $mundo) { same('yes', $item['confirmation']); same(true, $item['confirmed_at'] !== null); }
same(true, in_array($mundo, $detail['summary']['confirmaron']['ids'], true));
// An empty answer clears it back to "no answer".
same(['ok' => true], coverage_body($router->handle('PATCH', '/api/media-events/' . $rueda . '/coverage/' . $mundo, $admin, $withConfirmation(null))));
$detail = coverage_body($router->handle('GET', '/api/media-events/' . $rueda, $origin));
foreach ($detail['items'] as $item) if ($item['public_id'] === $mundo) { same(null, $item['confirmation']); same(null, $item['confirmed_at']); }
same(true, in_array($mundo, $detail['summary']['no_confirmaron']['ids'], true));
coverage_close_session();
