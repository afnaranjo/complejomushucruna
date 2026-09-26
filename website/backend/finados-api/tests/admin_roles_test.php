<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Router;

$rolesRoot = tempnam(sys_get_temp_dir(), 'finados-roles-');
if ($rolesRoot === false || !unlink($rolesRoot) || !mkdir($rolesRoot, 0700)) throw new RuntimeException('Unable to create roles test root.');
register_shutdown_function(static function () use ($rolesRoot): void {
    foreach (glob($rolesRoot . '/*') ?: [] as $file) is_dir($file) ? null : unlink($file);
    rmdir($rolesRoot);
});
file_put_contents($rolesRoot . '/config.json', json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('r', 32)), 'hmacKey' => base64_encode(str_repeat('s', 32)),
], JSON_THROW_ON_ERROR));
$config = Config::fromFile($rolesRoot . '/config.json');
$pdo = Database::connect($config);
// La cuenta admin ya existía antes de la migración, como en producción.
$migrations = glob(__DIR__ . '/../migrations/*_sqlite.sql');
sort($migrations, SORT_STRING);
$secret = bin2hex(random_bytes(16));
foreach ($migrations as $migration) {
    if (str_contains($migration, '034_admin_roles')) {
        $pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([str_repeat('f', 32), 'admin', Auth::hashPassword($secret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s')]);
    }
    $pdo->exec(file_get_contents($migration));
}
same('Administración', $pdo->query("SELECT r.name FROM admin_users u JOIN admin_roles r ON r.id = u.role_id WHERE u.username = 'admin'")->fetchColumn());

if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
$router = new Router($config, $pdo);
$origin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.70'];
$decode = static fn ($response): array => json_decode($response->body, true, 64, JSON_THROW_ON_ERROR);
$csrf = '';
$login = static function (string $username, string $password) use ($router, $origin, $decode, &$csrf): int {
    $router->handle('POST', '/api/auth/logout', [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $csrf], '{}');
    $session = $decode($router->handle('GET', '/api/auth/session', $origin));
    $response = $router->handle('POST', '/api/auth/login', [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $session['csrf']], json_encode(['username' => $username, 'password' => $password]));
    $csrf = $response->status === 200 ? $decode($response)['csrf'] : $session['csrf'];
    return $response->status;
};
$send = static function (string $method, string $path, array $body = []) use ($router, $origin, &$csrf) { return $router->handle($method, $path, [...$origin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $csrf], json_encode((object) $body)); };
$get = static fn (string $path) => $router->handle('GET', $path, $origin);

// Sin sesión nadie administra usuarios.
same(401, $get('/api/admin-users')->status);
same(200, $login('admin', $secret));
$me = $decode($get('/api/auth/session'))['user'];
same([['*'], 'Administración', '/admin/panel/'], [$me['modules'], $me['role'], $me['home']]);

// Catálogo: los cuatro roles de partida y todos los módulos para activar.
$data = $decode($get('/api/admin-users'));
same(['Administración', 'Community', 'Comunicación', 'Producción'], array_column($data['roles'], 'name'));
same(true, $data['roles'][0]['system'] && $data['roles'][0]['all']);
same(['panel', 'noticias', 'voceros', 'medios', 'produccion', 'emprendedores', 'creadoras', 'mfs', 'usuarios'], array_column($data['modules'], 'key'));
$roles = array_column($data['roles'], 'public_id', 'name');

// Crear una cuenta: nace sin contraseña conocida y con un enlace para elegirla.
$response = $send('POST', '/api/admin-users', ['username' => 'Ana.Medios', 'full_name' => 'Ana Medios', 'role' => $roles['Comunicación']]);
$created = $decode($response);
same(['ana.medios', 'Comunicación', false], [$created['user']['username'], $created['user']['role_name'], $created['user']['has_password']]);
$ana = $created['user']['public_id'];
$link = $created['link']['token'];
same(409, $send('POST', '/api/admin-users', ['username' => 'ana.medios', 'full_name' => 'Otra', 'role' => $roles['Comunicación']])->status);
foreach ([['username' => 'a b', 'full_name' => 'X', 'role' => $roles['Comunicación']], ['username' => 'bien', 'full_name' => '', 'role' => $roles['Comunicación']], ['username' => 'bien', 'full_name' => 'X', 'role' => str_repeat('0', 32)]] as $invalid) {
    same(true, in_array($send('POST', '/api/admin-users', $invalid)->status, [404, 422], true));
}
same(401, $login('ana.medios', 'cualquier-cosa-larga'));

// La persona abre el enlace, ve a quién pertenece y elige su contraseña. El enlace sirve una sola vez.
same(200, $login('admin', $secret));
same('Ana Medios', $decode($get('/api/admin-setup?token=' . $link))['account']['full_name']);
same(422, $send('POST', '/api/admin-setup', ['token' => $link, 'password' => 'corta'])->status);
same(200, $send('POST', '/api/admin-setup', ['token' => $link, 'password' => 'clave-de-ana-2026'])->status);
same(404, $send('POST', '/api/admin-setup', ['token' => $link, 'password' => 'otra-clave-2026'])->status);
same(404, $get('/api/admin-setup?token=' . str_repeat('a', 64))->status);

// Con su cuenta, Comunicación solo entra a Medios; el servidor rechaza lo demás.
same(200, $login('ana.medios', 'clave-de-ana-2026'));
$session = $decode($get('/api/auth/session'))['user'];
same([['medios'], 'Comunicación', '/admin/medios/', 'Ana Medios'], [$session['modules'], $session['role'], $session['home'], $session['full_name']]);
same(200, $get('/api/medios')->status);
same(200, $get('/api/media-tour?from=2026-10-01&to=2026-10-08')->status);
same(200, $get('/api/noticias')->status, 'la banda del tema central la leen todos');
foreach (['/api/creadoras/calendario?from=2026-10-01&to=2026-10-08', '/api/voceros', '/api/panel', '/api/admin-users', '/api/produccion/sol?from=2026-10-01&to=2026-10-08', '/api/mfs-participants', '/api/admin-activity'] as $closed) {
    same(403, $get($closed)->status);
}
same(403, $send('POST', '/api/noticias/avisos', ['body' => 'x'])->status, 'editar Noticias es del módulo Noticias');
same(403, $send('PATCH', '/api/admin-users/' . $ana, ['role' => $roles['Administración']])->status, 'nadie se sube de rol solo');
// Lo que hace queda con su nombre en la auditoría.
$send('POST', '/api/media-tour/people', ['name' => 'Vocera Prueba']);

// Activar un módulo más en el rol le abre esa sección al instante, sin volver a entrar.
same(200, $login('admin', $secret));
$role = $decode($send('PATCH', '/api/admin-roles/' . $roles['Comunicación'], ['name' => 'Comunicación', 'description' => 'Medios y creadoras', 'modules' => ['medios', 'creadoras']]))['role'];
same(['medios', 'creadoras'], $role['modules']);
same(422, $send('PATCH', '/api/admin-roles/' . $roles['Comunicación'], ['name' => 'Comunicación', 'modules' => ['marte']])->status);
same(409, $send('POST', '/api/admin-roles', ['name' => 'comunicación', 'modules' => []])->status);
$editor = $decode($send('POST', '/api/admin-roles', ['name' => 'Edición de video', 'description' => 'Solo Creadoras', 'modules' => ['creadoras']]))['role'];
same([false, ['creadoras']], [$editor['system'], $editor['modules']]);
// El rol del sistema sigue viendo todo aunque se intente quitarle módulos.
same(['*'], $decode($send('PATCH', '/api/admin-roles/' . $roles['Administración'], ['name' => 'Administración', 'modules' => []]))['role']['modules']);
same(200, $login('ana.medios', 'clave-de-ana-2026'));
same(200, $get('/api/creadoras/calendario?from=2026-10-01&to=2026-10-08')->status);

// La cuenta admin no se desactiva ni cambia de rol; quien administra no se desactiva a sí mismo.
same(200, $login('admin', $secret));
same(422, $send('PATCH', '/api/admin-users/' . str_repeat('f', 32), ['active' => false])->status);
same(422, $send('PATCH', '/api/admin-users/' . str_repeat('f', 32), ['role' => $roles['Producción']])->status);
// Desactivar corta el acceso; reactivar lo devuelve.
same(false, $decode($send('PATCH', '/api/admin-users/' . $ana, ['active' => false]))['user']['active']);
same(401, $login('ana.medios', 'clave-de-ana-2026'));
same(200, $login('admin', $secret));
same(true, $decode($send('PATCH', '/api/admin-users/' . $ana, ['active' => true, 'role' => $roles['Producción'], 'full_name' => 'Ana María Medios']))['user']['active']);
// Un enlace nuevo anula el anterior y permite volver a fijar la contraseña.
$first = $decode($send('POST', '/api/admin-users/' . $ana . '/enlace'))['link']['token'];
$second = $decode($send('POST', '/api/admin-users/' . $ana . '/enlace'))['link']['token'];
same(404, $get('/api/admin-setup?token=' . $first)->status);
same(200, $get('/api/admin-setup?token=' . $second)->status);

// Actividad: quién hizo qué, con su nombre.
$activity = $decode($get('/api/admin-activity'))['activity'];
$byAna = array_values(array_filter($activity, static fn (array $row): bool => $row['username'] === 'ana.medios'));
same(true, in_array('media_tour.person_saved', array_column($byAna, 'event'), true) || count($byAna) > 0);
same('Ana María Medios', $byAna[0]['full_name']);
same(true, count($decode($get('/api/admin-activity?user=' . $ana))['activity']) > 0);
