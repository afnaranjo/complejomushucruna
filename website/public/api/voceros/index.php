<?php
declare(strict_types=1);

// Retained for the deployment configuration reader. Public requests never call it.
function registration_config(string $directory): ?array
{
    $path = $directory . DIRECTORY_SEPARATOR . 'voceros-registration.json';
    if (!is_file($path)) return null;
    $contents = file_get_contents($path);
    $config = is_string($contents) ? json_decode($contents, true) : null;
    if (!is_array($config) || ($config['enabled'] ?? false) !== true) return null;
    foreach ([
        'responsable', 'direccion', 'telefono', 'contactEmail',
        'policiesVersion', 'thermometerVersion', 'imageVersion', 'privacyVersion',
    ] as $field) {
        if (!is_string($config[$field] ?? null) || trim($config[$field]) === '') return null;
    }
    if (!filter_var($config['contactEmail'], FILTER_VALIDATE_EMAIL)) return null;
    if ((int) ($config['retentionYears'] ?? 0) !== 3) return null;
    return $config;
}

function voceros_handle_request(array $server, array $post, ?callable $bootstrap = null, ?callable $sheets = null,
    array $allowedOrigins = []): array
{
    $message = 'Crea una cuenta o inicia sesión para completar tu registro.';
    $method = $server['REQUEST_METHOD'] ?? '';
    if ($method === 'GET' || $method === 'HEAD') {
        return ['status' => 200, 'json' => $method === 'HEAD' ? [] : [
            'open' => false, 'authenticationRequired' => true,
            'accessUrl' => '/finados/voceros/acceso/', 'message' => $message,
            'timezone' => 'America/Guayaquil',
        ], 'headers' => []];
    }
    if ($method === 'POST') return ['status' => 401, 'json' => ['ok' => false, 'message' => $message], 'headers' => []];
    return ['status' => 405, 'json' => ['ok' => false, 'message' => 'Método no permitido.'], 'headers' => ['Allow' => 'GET, HEAD, POST']];
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    $response = voceros_handle_request($_SERVER, []);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, max-age=0');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    foreach ($response['headers'] as $name => $value) header($name . ': ' . $value);
    http_response_code($response['status']);
    if ($_SERVER['REQUEST_METHOD'] !== 'HEAD') echo json_encode($response['json'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}
