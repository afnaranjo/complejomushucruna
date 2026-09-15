<?php
declare(strict_types=1);

require __DIR__ . '/guard.php';
$router = new Finados\Router($testConfig, Finados\Database::connect($testConfig));
$raw = file_get_contents('php://input', false, null, 0, 16385);
$router->handle($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI'], $_SERVER, $raw === false ? '' : $raw, $_POST, $_FILES)->send();
