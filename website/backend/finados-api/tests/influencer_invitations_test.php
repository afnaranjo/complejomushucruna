<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Router;

$root = tempnam(sys_get_temp_dir(), 'finados-influencers-');
if ($root === false || !unlink($root) || !mkdir($root, 0700)) throw new RuntimeException('Unable to create influencer test root.');
register_shutdown_function(static function () use ($root): void {
    foreach (glob($root . '/*') ?: [] as $file) is_dir($file) ? null : unlink($file);
    rmdir($root);
});
file_put_contents($root . '/config.json', json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('v', 32)), 'hmacKey' => base64_encode(str_repeat('w', 32)),
], JSON_THROW_ON_ERROR));
$config = Config::fromFile($root . '/config.json');
$pdo = Database::connect($config);
$migrations = glob(__DIR__ . '/../migrations/*_sqlite.sql');
sort($migrations, SORT_STRING);
foreach ($migrations as $migration) $pdo->exec(file_get_contents($migration));
$pdo->exec(file_get_contents(__DIR__ . '/../migrations/036_influencer_invitations_sqlite.sql')); // aplicarla dos veces no duplica el evento
same('2', (string) $pdo->query('SELECT COUNT(*) FROM influencer_event')->fetchColumn());
$events = $pdo->query('SELECT id, slug, title, event_date, event_time, place FROM influencer_event ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
same([
    ['id' => 1, 'slug' => 'guaynaa', 'title' => 'Lanzamiento Guaynaa', 'event_date' => '2026-10-15', 'event_time' => '', 'place' => 'Juan Montalvo y 12 de Noviembre, Ambato, Ecuador'],
    ['id' => 2, 'slug' => 'inauguracion', 'title' => 'Inauguración Oficial de Finados Mushuc Runa', 'event_date' => '2026-10-30', 'event_time' => '12:00', 'place' => 'Complejo Intercultural y Deportivo Mushuc Runa · Santa Lucía, Tisaleo · Panamericana Sur km 12, vía Ambato–Riobamba'],
], array_map(static fn (array $row): array => [...$row, 'id' => (int) $row['id']], $events));
$secret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([str_repeat('f', 32), 'admin', Auth::hashPassword($secret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s')]);

if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.81'];
$json = [...$origin, 'CONTENT_TYPE' => 'application/json'];
$decode = static fn ($response): array => json_decode($response->body, true, 64, JSON_THROW_ON_ERROR);

// El evento es público y trae lo que dio Alex: Lanzamiento Guaynaa, jueves 15 de octubre, hora por confirmar.
$event = $decode($router->handle('GET', '/api/invitacion/evento', $origin))['event'];
same(['Lanzamiento Guaynaa', '2026-10-15', '', 'Juan Montalvo y 12 de Noviembre, Ambato, Ecuador'], [$event['title'], $event['date'], $event['time'], $event['place']]);
$inauguration = $decode($router->handle('GET', '/api/invitacion/inauguracion/evento', $origin))['event'];
same(['inauguracion', 'Inauguración Oficial de Finados Mushuc Runa', '2026-10-30', '12:00', 'Complejo Intercultural y Deportivo Mushuc Runa · Santa Lucía, Tisaleo · Panamericana Sur km 12, vía Ambato–Riobamba'], [$inauguration['slug'], $inauguration['title'], $inauguration['date'], $inauguration['time'], $inauguration['place']]);
same(404, $router->handle('GET', '/api/invitacion/no-existe/evento', $origin)->status);

// El panel exige sesión.
same(401, $router->handle('GET', '/api/influencers?kind=creador', $origin)->status);
$session = $decode($router->handle('GET', '/api/auth/session', $origin));
$csrf = $decode($router->handle('POST', '/api/auth/login', [...$json, 'HTTP_X_CSRF_TOKEN' => $session['csrf']], json_encode(['username' => 'admin', 'password' => $secret])))['csrf'];
$send = static fn (string $method, string $path, array $body = []) => $router->handle($method, $path, [...$json, 'HTTP_X_CSRF_TOKEN' => $csrf], json_encode((object) $body));

// Coordinación pega los nombres de los creadores, uno por línea: cada uno recibe su enlace personal.
$created = $decode($send('POST', '/api/influencers', ['names' => "Ana Pérez\n\n  Carlos   Ruiz  \nLuz"]))['guests'];
same(['Ana Pérez', 'Carlos Ruiz', 'Luz'], array_column($created, 'full_name'));
same(3, count(array_unique(array_column($created, 'invite_token'))));
foreach ($created as $guest) same(1, preg_match('/^[a-hjkmnp-z2-9]{10}$/D', $guest['invite_token']), 'el enlace usa un código corto');
same(422, $send('POST', '/api/influencers', ['names' => " \n "])->status);
same(422, $send('POST', '/api/influencers', ['names' => str_repeat("Nombre\n", 201)])->status);

// Inauguración tiene sus propios invitados, tipos y variantes de mensaje; no comparte filas con Guaynaa.
$inaugurationVocero = $decode($send('POST', '/api/influencers?event=inauguracion', ['names' => 'Vocera Inauguración', 'kind' => 'vocero', 'message_variant' => 'apoyo']))['guests'][0];
$inaugurationCreator = $decode($send('POST', '/api/influencers?event=inauguracion', ['names' => 'Creador Inauguración', 'kind' => 'creador', 'message_variant' => 'registro']))['guests'][0];
same(['inauguracion', 'vocero', 'apoyo'], [$inaugurationVocero['event'], $inaugurationVocero['kind'], $inaugurationVocero['message_variant']]);
same(['inauguracion', 'creador', 'registro'], [$inaugurationCreator['event'], $inaugurationCreator['kind'], $inaugurationCreator['message_variant']]);
same(422, $send('POST', '/api/influencers?event=inauguracion', ['names' => 'No permitido', 'kind' => 'nuevo', 'message_variant' => 'registro'])->status);
same(422, $send('POST', '/api/influencers?event=inauguracion', ['names' => 'No permitido', 'kind' => 'vocero', 'message_variant' => 'otro'])->status);
same(404, $send('POST', '/api/influencers?event=no-existe', ['names' => 'No permitido', 'kind' => 'vocero', 'message_variant' => 'apoyo'])->status);
same(3, $decode($router->handle('GET', '/api/influencers?kind=creador', $origin))['totals']['total']);
same(1, $decode($router->handle('GET', '/api/influencers?event=inauguracion&kind=vocero', $origin))['totals']['total']);
same(1, $decode($router->handle('GET', '/api/influencers?event=inauguracion&kind=creador', $origin))['totals']['total']);

// Cada ruta pública comprueba el evento: un token de inauguración no se abre como Guaynaa ni al revés.
same(404, $router->handle('GET', '/api/invitacion/c/' . $inaugurationVocero['invite_token'], $origin)->status);
$openedInauguration = $decode($router->handle('GET', '/api/invitacion/inauguracion/c/' . $inaugurationVocero['invite_token'], $origin));
same(['inauguracion', 'Vocera Inauguración', 'vocero', 'apoyo'], [$openedInauguration['event']['slug'], $openedInauguration['guest']['name'], $openedInauguration['guest']['kind'], $openedInauguration['guest']['message_variant']]);
same(404, $router->handle('GET', '/api/invitacion/inauguracion/c/' . $created[0]['invite_token'], $origin)->status);
same('si', $decode($router->handle('POST', '/api/invitacion/inauguracion/c/' . $inaugurationVocero['invite_token'], $json, json_encode(['response' => 'si'])))['guest']['response']);
// Confirmar «sí» en la inauguración deja la fecha de aceptación de las condiciones (uso de imagen incluido).
$consent = $pdo->prepare('SELECT consent_at FROM influencer_guests WHERE public_id = ?');
$consent->execute([$inaugurationVocero['public_id']]);
same(true, $consent->fetchColumn() !== null, 'la aceptación de condiciones queda registrada');
$decode($send('PATCH', '/api/influencers/' . $inaugurationVocero['public_id'], ['social_link' => 'vocera.inauguracion']));
$inaugurationBadge = $decode($router->handle('GET', '/api/invitacion/inauguracion/gafete/' . $inaugurationVocero['invite_token'], $origin));
same(['inauguracion', true], [$inaugurationBadge['event']['slug'], $inaugurationBadge['ready']]);
$inaugurationScan = $decode($router->handle('GET', '/api/invitacion/inauguracion/verificar/' . $inaugurationVocero['public_id'], $origin))['verification'];
same(['Inauguración Oficial de Finados Mushuc Runa', 'Vocero invitado'], [$inaugurationScan['event'], $inaugurationScan['kind']]);
same(false, array_key_exists('social_link', $inaugurationScan), 'la validación pública de inauguración no expone la red social');

// La hora se completa desde el panel.
same(422, $send('PATCH', '/api/influencers/evento', ['title' => 'Lanzamiento Guaynaa', 'date' => '2026-10-15', 'time' => '25:00', 'place' => 'Ambato'])->status);
same('19:30', $decode($send('PATCH', '/api/influencers/evento', ['title' => 'Lanzamiento Guaynaa', 'date' => '2026-10-15', 'time' => '19:30', 'place' => $event['place'], 'details' => '']))['event']['time']);
same('12:30', $decode($send('PATCH', '/api/influencers/evento?event=inauguracion', ['title' => $inauguration['title'], 'date' => $inauguration['date'], 'time' => '12:30', 'place' => $inauguration['place'], 'details' => 'Ingreso por invitación.']))['event']['time']);
same('19:30', $decode($router->handle('GET', '/api/invitacion/evento', $origin))['event']['time']);

// El creador abre su invitación: ve su nombre y queda marcado como «abrió»; luego confirma.
$ana = $created[0];
$opened = $decode($router->handle('GET', '/api/invitacion/c/' . $ana['invite_token'], $origin));
same(['Ana Pérez', 'pendiente', '19:30'], [$opened['guest']['name'], $opened['guest']['response'], $opened['event']['time']]);
same(404, $router->handle('GET', '/api/invitacion/c/' . str_repeat('0', 32), $origin)->status);
same(403, $router->handle('POST', '/api/invitacion/c/' . $ana['invite_token'], ['REMOTE_ADDR' => '192.0.2.81', 'CONTENT_TYPE' => 'application/json'], json_encode(['response' => 'si']))->status, 'sin Origin no se acepta');
same(422, $router->handle('POST', '/api/invitacion/c/' . $ana['invite_token'], $json, json_encode(['response' => 'tal vez']))->status);
same('si', $decode($router->handle('POST', '/api/invitacion/c/' . $ana['invite_token'], $json, json_encode(['response' => 'si'])))['guest']['response']);
same('no', $decode($router->handle('POST', '/api/invitacion/c/' . $created[1]['invite_token'], $json, json_encode(['response' => 'no'])))['guest']['response']);
$list = $decode($router->handle('GET', '/api/influencers?kind=creador', $origin));
same([3, 1, 1, 1, 2], [$list['totals']['total'], $list['totals']['si'], $list['totals']['no'], $list['totals']['pendiente'], $list['totals']['abrieron']]);

// Un enlace nuevo invalida el anterior.
$relinked = $decode($send('POST', '/api/influencers/' . $created[2]['public_id'] . '/enlace'))['guest'];
same(false, $relinked['invite_token'] === $created[2]['invite_token']);
same(404, $router->handle('GET', '/api/invitacion/c/' . $created[2]['invite_token'], $origin)->status);

// Nuevos creadores: el enlace general pide sus datos, su respuesta y el consentimiento.
$newcomer = ['full_name' => 'Mía Tapia', 'whatsapp' => '098 765 4321', 'social_link' => 'mia.crea', 'followers' => 12500, 'city' => 'Ambato', 'response' => 'si', 'consent' => true];
same(422, $router->handle('POST', '/api/invitacion/nuevo', $json, json_encode([...$newcomer, 'consent' => false]))->status);
same(422, $router->handle('POST', '/api/invitacion/nuevo', $json, json_encode([...$newcomer, 'whatsapp' => '12']))->status);
same(422, $router->handle('POST', '/api/invitacion/nuevo', $json, json_encode([...$newcomer, 'social_link' => 'http://inseguro.example/x']))->status);
same(201, $router->handle('POST', '/api/invitacion/nuevo', $json, json_encode($newcomer))->status);
// Volver con el mismo WhatsApp actualiza su registro en lugar de duplicarlo.
same(201, $router->handle('POST', '/api/invitacion/nuevo', $json, json_encode([...$newcomer, 'followers' => '13000']))->status);
$news = $decode($router->handle('GET', '/api/influencers?kind=nuevo', $origin));
same(1, $news['totals']['total']);
$mia = $news['guests'][0];
same(['Mía Tapia', '0987654321', '@mia.crea', 13000, 'Ambato', 'si', 'pendiente'], [$mia['full_name'], $mia['whatsapp'], $mia['social_link'], $mia['followers'], $mia['city'], $mia['response'], $mia['approval']]);
same(1, preg_match('/^[a-hjkmnp-z2-9]{10}$/D', $mia['invite_token']), 'el nuevo creador también recibe su enlace propio');
same(false, str_contains((string) $pdo->query('SELECT whatsapp_enc FROM influencer_guests WHERE kind = \'nuevo\'')->fetchColumn(), '0987654321'), 'el WhatsApp se guarda cifrado');

// Gafete: un nuevo creador que dijo sí todavía no lo tiene hasta que se apruebe.
$pending = $decode($router->handle('GET', '/api/invitacion/gafete/' . $mia['invite_token'], $origin));
same([false, 'aprobacion', null], [$pending['ready'], $pending['reason'], $pending['guest']['public_id']]);
// Coordinación aprueba y anota.
$approved = $decode($send('PATCH', '/api/influencers/' . $mia['public_id'], ['approval' => 'aprobado', 'note' => 'Llamar el miércoles']))['guest'];
same(['aprobado', 'Llamar el miércoles'], [$approved['approval'], $approved['note']]);
same(422, $send('PATCH', '/api/influencers/' . $mia['public_id'], ['approval' => 'quizás'])->status);
// Al aprobarse pasa de Nuevos creadores a Creadores, con su enlace, su respuesta y su origen.
same([0, 2], [$decode($router->handle('GET', '/api/influencers?kind=nuevo', $origin))['totals']['total'], $decode($router->handle('GET', '/api/influencers?kind=creador', $origin))['totals']['aprobados_si']]);
same(['creador', true, $mia['invite_token']], [$approved['kind'], $approved['from_open'], $approved['invite_token']]);
// Si vuelve a llenar el registro abierto no se duplica: solo cambia su respuesta.
same(201, $router->handle('POST', '/api/invitacion/nuevo', $json, json_encode([...$newcomer, 'response' => 'no']))->status);
$again = array_values(array_filter($decode($router->handle('GET', '/api/influencers?kind=creador', $origin))['guests'], static fn (array $guest): bool => $guest['public_id'] === $mia['public_id']));
same([0, 'no'], [$decode($router->handle('GET', '/api/influencers?kind=nuevo', $origin))['totals']['total'], $again[0]['response']]);
same('si', $decode($send('PATCH', '/api/influencers/' . $mia['public_id'], ['response' => 'si']))['guest']['response']);

$badge = $decode($router->handle('GET', '/api/invitacion/gafete/' . $mia['invite_token'], $origin));
same([true, $mia['public_id']], [$badge['ready'], $badge['guest']['public_id']]);
// El creador personal que confirmó ya tiene su gafete; el que dijo que no, no.
same(true, $decode($router->handle('GET', '/api/invitacion/gafete/' . $ana['invite_token'], $origin))['ready']);
same([false, 'respuesta'], array_values(array_intersect_key($decode($router->handle('GET', '/api/invitacion/gafete/' . $created[1]['invite_token'], $origin)), ['ready' => 0, 'reason' => 0])));
// Al escanear el QR la puerta ve el nombre y si la invitación es válida, sin teléfono.
$scan = $decode($router->handle('GET', '/api/invitacion/verificar/' . $mia['public_id'], $origin))['verification'];
same([true, 'Mía Tapia', 'Creador invitado'], [$scan['valid'], $scan['name'], $scan['kind']]);
same(false, array_key_exists('whatsapp', $scan));
same('@mia.crea', $scan['social_link'], 'Guaynaa conserva la red social en su validación pública por compatibilidad');
same(false, $decode($router->handle('GET', '/api/invitacion/verificar/' . $created[1]['public_id'], $origin))['verification']['valid']);
same(404, $router->handle('GET', '/api/invitacion/verificar/' . str_repeat('a', 32), $origin)->status);

// Muchos registros seguidos desde la misma conexión se frenan.
for ($i = 0; $i < 4; $i++) $router->handle('POST', '/api/invitacion/nuevo', $json, json_encode([...$newcomer, 'whatsapp' => '09900000' . $i . '0']));
same(429, $router->handle('POST', '/api/invitacion/nuevo', $json, json_encode([...$newcomer, 'whatsapp' => '0991111111']))->status);

// Retirar archiva sin borrar y el enlace deja de abrir.
same(200, $send('POST', '/api/influencers/' . $ana['public_id'] . '/archivar')->status);
same(404, $router->handle('GET', '/api/invitacion/c/' . $ana['invite_token'], $origin)->status);
same(3, $decode($router->handle('GET', '/api/influencers?kind=creador', $origin))['totals']['total']);
same('1', (string) $pdo->query("SELECT COUNT(*) FROM influencer_guests WHERE archived_at IS NOT NULL")->fetchColumn());
// Un gafete de alguien retirado deja de ser válido en la puerta.
$retired = $decode($router->handle('GET', '/api/invitacion/verificar/' . $ana['public_id'], $origin))['verification'];
same([false, true], [$retired['valid'], $retired['retired']]);

// Exportar a CSV.
$csv = $router->handle('GET', '/api/influencers/export?kind=creador', $origin);
same(200, $csv->status);
same('attachment; filename="influencers-creador-' . gmdate('Y-m-d') . '.csv"', $csv->headers['Content-Disposition']);
same(true, str_contains($csv->body, 'Mía Tapia'));
$inaugurationCsv = $router->handle('GET', '/api/influencers/export?event=inauguracion&kind=creador', $origin);
same(200, $inaugurationCsv->status);
same('attachment; filename="influencers-inauguracion-creador-' . gmdate('Y-m-d') . '.csv"', $inaugurationCsv->headers['Content-Disposition']);
same(true, str_contains($inaugurationCsv->body, 'Creador Inauguración'));
same(false, str_contains($inaugurationCsv->body, 'Mía Tapia'));

// Solo existen las dos listas: Creadores y Nuevos creadores.
same(422, $router->handle('GET', '/api/influencers?kind=otro', $origin)->status);
