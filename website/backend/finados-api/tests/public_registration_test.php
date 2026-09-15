<?php
declare(strict_types=1);
require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../../../public/api/voceros/index.php';

// Old clients and hostile inputs cannot reopen anonymous intake.
$calls = 0;
$trap = static function () use (&$calls): never { $calls++; throw new RuntimeException('Private callback reached'); };
foreach (['GET', 'HEAD', 'POST', 'OPTIONS', 'DELETE', 'PATCH', 'PUT', ''] as $method) {
    $response = voceros_handle_request(['REQUEST_METHOD' => $method, 'HTTP_ORIGIN' => 'https://untrusted.example', 'CONTENT_LENGTH' => PHP_INT_MAX],
        ['submission_id' => str_repeat('a', 32), 'fotografia' => 'untrusted'], $trap, $trap);
    same(in_array($method, ['GET', 'HEAD'], true) ? 200 : ($method === 'POST' ? 401 : 405), $response['status']);
    if ($method === 'GET' || $method === 'HEAD') {
        same(false, $response['json']['open']);
        same(true, $response['json']['authenticationRequired']);
        same('/finados/voceros/acceso/', $response['json']['accessUrl']);
        same('America/Guayaquil', $response['json']['timezone']);
    } elseif ($method !== 'POST') same('GET, HEAD, POST', $response['headers']['Allow']);
    else same('Crea una cuenta o inicia sesión para completar tu registro.', $response['json']['message']);
}
same(0, $calls);
same(false, function_exists('voceros_bootstrap'));
