<?php

declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');
require_once __DIR__ . '/../src/Router.php';

$bootstrapStage = 'B1';
try {
    $config = Finados\Config::fromProductionEnvironment();
    $bootstrapStage = 'B2';
    $pdo = Finados\Database::connect($config);
    $bootstrapStage = 'B3';
    $router = new Finados\Router($config, $pdo);
    $bootstrapStage = 'B4';
    // Bound reads before JSON decoding, including chunked requests without Content-Length.
    $raw = file_get_contents('php://input', false, null, 0, 16385);
    if ($raw === false) throw new RuntimeException();
    $bootstrapStage = 'B5';
    $router->handle($_SERVER['REQUEST_METHOD'] ?? 'GET', $_SERVER['REQUEST_URI'] ?? '/', $_SERVER, $raw, $_POST, $_FILES)->send();
} catch (Throwable) {
    error_log('Finados API bootstrap failed.');
    $headers = [
        'Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store', 'Vary' => 'Origin',
        'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'",
    ];
    if (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) === '/api/health') {
        // Opaque code for operational triage; never expose exception messages, paths or configuration.
        $headers['X-Finados-Diagnostic'] = $bootstrapStage;
    }
    (new Finados\Response(503, $headers, '{"ok":false,"code":"service_unavailable","message":"Servicio no disponible."}'))->send();
}
