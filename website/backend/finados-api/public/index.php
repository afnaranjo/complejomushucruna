<?php

declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');
require_once __DIR__ . '/../src/Router.php';

try {
    $config = Finados\Config::fromProductionEnvironment();
    $router = new Finados\Router($config, Finados\Database::connect($config));
    // Bound reads before JSON decoding, including chunked requests without Content-Length.
    $raw = file_get_contents('php://input', false, null, 0, 16385);
    if ($raw === false) throw new RuntimeException();
    $router->handle($_SERVER['REQUEST_METHOD'] ?? 'GET', $_SERVER['REQUEST_URI'] ?? '/', $_SERVER, $raw)->send();
} catch (Throwable) {
    error_log('Finados API bootstrap failed.');
    (new Finados\Response(503, [
        'Content-Type' => 'application/json; charset=utf-8', 'Cache-Control' => 'no-store', 'Vary' => 'Origin',
        'X-Content-Type-Options' => 'nosniff', 'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'",
    ], '{"ok":false,"code":"service_unavailable","message":"Servicio no disponible."}'))->send();
}
