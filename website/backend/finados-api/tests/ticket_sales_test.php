<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';
require_once __DIR__ . '/../src/TicketSales.php';

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Router;
use Finados\TicketSales;

$tsRoot = tempnam(sys_get_temp_dir(), 'finados-tickets-');
if ($tsRoot === false || !unlink($tsRoot) || !mkdir($tsRoot, 0700)) throw new RuntimeException('Unable to create ticket sales test root.');
register_shutdown_function(static function () use ($tsRoot): void {
    $entries = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($tsRoot, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($entries as $entry) $entry->isDir() && !$entry->isLink() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
    rmdir($tsRoot);
});

// Sin archivo de configuración la sección avisa que falta conectarla, sin llamar a Ticketstar.
$tsCalls = [];
$tsFake = static function (string $method, string $path, array $headers, ?string $body) use (&$tsCalls, &$tsSalesStatus): array {
    $tsCalls[] = [$method, $path, $headers, $body];
    if ($path === '/ventas-auth/login') {
        return [200, json_encode(['success' => true, 'token' => 'aaa.bbb.' . count($tsCalls), 'token_type' => 'Bearer', 'expires_in' => 3600])];
    }
    if ($tsSalesStatus !== 200) return [$tsSalesStatus, '{"success":false,"message":"Unauthorized"}'];
    return [200, json_encode(['success' => true, 'eventos' => [
        ['id_evento' => 1918, 'evento' => 'FERIA FINADOS 1-11-2026', 'localidades' => [
            ['id_localidad' => 1, 'localidad' => 'GENERAL PREVENTA', 'precios' => [
                ['id_descuento' => 0, 'tipo_precio' => 'PRECIO NORMAL', 'precio' => 5.0, 'cantidad_vendida' => 25, 'total_vendido' => 125.0],
                ['id_descuento' => 9, 'tipo_precio' => 'ESPECIAL 50%', 'precio' => 2.5, 'cantidad_vendida' => 2, 'total_vendido' => 5.0],
            ], 'cantidad_vendida' => 27, 'total_vendido' => 130.0],
        ], 'totales' => ['cantidad_vendida' => 27, 'total_vendido' => 130.0]],
        ['id_evento' => 1917, 'evento' => 'FERIA FINADOS 31-10-2026', 'localidades' => [
            ['id_localidad' => 2, 'localidad' => 'VIP PREVENTA', 'precios' => [
                ['id_descuento' => 0, 'tipo_precio' => 'PRECIO NORMAL', 'precio' => 20.0, 'cantidad_vendida' => 11, 'total_vendido' => 220.0],
            ], 'cantidad_vendida' => 11, 'total_vendido' => 220.0],
        ], 'totales' => ['cantidad_vendida' => 12, 'total_vendido' => 220.0]],
    ]])];
};
$tsSalesStatus = 200;
$tsNow = new DateTimeImmutable('2026-09-30 16:00', new DateTimeZone('America/Guayaquil'));
$tickets = new TicketSales($tsRoot, $tsFake, $tsNow);
same(['configured' => false], $tickets->report());
same([], $tsCalls);

// Una configuración sin correo válido o sin contraseña se rechaza.
file_put_contents($tsRoot . '/ticketstar-config.json', json_encode(['email' => 'no-es-correo', 'password' => 'x']));
throws(static fn () => $tickets->report(), RuntimeException::class);
file_put_contents($tsRoot . '/ticketstar-config.json', json_encode(['email' => 'empresario@example.invalid', 'password' => 'clave-de-prueba']));

// Inicia sesión, consulta con el token en cabecera y ordena las noches por fecha.
$report = $tickets->report();
same(true, $report['configured']);
same(false, $report['cached']);
same(['POST', '/ventas-auth/login'], array_slice($tsCalls[0], 0, 2));
same(['email' => 'empresario@example.invalid', 'password' => 'clave-de-prueba'], json_decode((string) $tsCalls[0][3], true));
same(['GET', '/ventas-empresario'], array_slice($tsCalls[1], 0, 2));
same('Authorization: Bearer aaa.bbb.1', $tsCalls[1][2][0]);
same(null, $tsCalls[1][3]);
same(['2026-10-31', '2026-11-01'], array_column($report['events'], 'date'));
same(['sold' => 39, 'revenue' => 350.0, 'events' => 2], $report['totals']);
same(true, $report['events'][1]['consistent']);
// El total de Ticketstar (12) no cuadra con sus localidades (11): el Panel lo marca.
same(false, $report['events'][0]['consistent']);
same(['discount_id' => 9, 'label' => 'ESPECIAL 50%', 'price' => 2.5, 'sold' => 2, 'revenue' => 5.0], $report['events'][1]['localities'][0]['prices'][1]);
// El token queda en un archivo privado; la contraseña no se guarda en ningún archivo nuevo.
same('0600', substr(sprintf('%o', fileperms($tsRoot . '/ticketstar-cache/token.json')), -4));
foreach (glob($tsRoot . '/ticketstar-cache/*') as $file) same(false, str_contains((string) file_get_contents($file), 'clave-de-prueba'));

// La segunda lectura sale de la caché; `refresh` reutiliza el token sin volver a iniciar sesión.
same(true, $tickets->report()['cached']);
same(2, count($tsCalls));
same(false, $tickets->report(true)['cached']);
same(3, count($tsCalls));
same('/ventas-empresario', $tsCalls[2][1]);

// Si Ticketstar rechaza el token, inicia sesión una sola vez más y reintenta.
$tsSalesStatus = 401;
throws(static fn () => $tickets->report(true), RuntimeException::class);
same(['/ventas-empresario', '/ventas-auth/login', '/ventas-empresario'], array_column(array_slice($tsCalls, 3), 1));
$tsSalesStatus = 200;
same(false, $tickets->report(true)['cached']);

// Fechas en el nombre del evento.
same('2026-11-03', TicketSales::eventDate('FERIA FINADOS 3-11-2026'));
same(null, TicketSales::eventDate('FERIA FINADOS'));
same(null, TicketSales::eventDate('FERIA 31-02-2026'));

// La ruta exige sesión administrativa y no acepta parámetros extra.
mkdir($tsRoot . '/router', 0700);
$tsConfigPath = $tsRoot . '/router/config.json';
file_put_contents($tsConfigPath, json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('s', 32)), 'hmacKey' => base64_encode(str_repeat('m', 32)),
], JSON_THROW_ON_ERROR));
$tsConfig = Config::fromFile($tsConfigPath);
$tsPdo = Database::connect($tsConfig);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts'] as $migration) $tsPdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
$tsSecret = bin2hex(random_bytes(16));
$tsPdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([str_repeat('d', 32), 'admin', Auth::hashPassword($tsSecret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s')]);
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
$tsRouter = new Router($tsConfig, $tsPdo);
$tsOrigin = ['HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.51'];
same(401, $tsRouter->handle('GET', '/api/venta-entradas', $tsOrigin)->status);
$tsSession = json_decode($tsRouter->handle('GET', '/api/auth/session', $tsOrigin)->body, true);
$tsRouter->handle('POST', '/api/auth/login', [...$tsOrigin, 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $tsSession['csrf']], json_encode(['username' => 'admin', 'password' => $tsSecret]));
same(422, $tsRouter->handle('GET', '/api/venta-entradas?evento=1', $tsOrigin)->status);
same(422, $tsRouter->handle('GET', '/api/venta-entradas?refresh=2', $tsOrigin)->status);
same(403, $tsRouter->handle('POST', '/api/venta-entradas', $tsOrigin)->status);
// La base del test no tiene archivo de Ticketstar: la sección responde «sin configurar».
same(['configured' => false], json_decode($tsRouter->handle('GET', '/api/venta-entradas', $tsOrigin)->body, true));
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
session_id('');
$_SESSION = [];
