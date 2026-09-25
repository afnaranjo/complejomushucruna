<?php
declare(strict_types=1);

require __DIR__ . '/guard.php';
$router = new Finados\Router($testConfig, Finados\Database::connect($testConfig));
$limit = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) === '/api/media-plan' ? 1024 * 1024 + 1 : 16385;
$raw = file_get_contents('php://input', false, null, 0, $limit);
$router->handle($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI'], $_SERVER, $raw === false ? '' : $raw, $_POST, $_FILES)->send();
