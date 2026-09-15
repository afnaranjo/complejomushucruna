<?php
declare(strict_types=1);

require __DIR__ . '/guard.php';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/api/voceros/') {
    require __DIR__ . '/../../public/api/voceros/index.php';
    $bootstrap = static function () use ($testConfig): array {
        $pdo = Finados\Database::connect($testConfig);
        $crypto = new Finados\Crypto($testConfig);
        $directory = dirname(getenv('VOCEROS_TEST_CONFIG'));
        return ['repository' => new Finados\VocerosRepository($pdo, $crypto, new Finados\Audit($pdo, $crypto)),
            'privateDirectory' => $directory, 'config' => registration_config($directory)];
    };
    $response = voceros_handle_request($_SERVER, $_POST, $bootstrap, null, [$testConfig->allowedOrigin()]);
    (new Finados\Response($response['status'], ['Content-Type' => 'application/json; charset=utf-8',
        'Cache-Control' => 'no-store', 'X-Content-Type-Options' => 'nosniff', ...$response['headers']],
        $_SERVER['REQUEST_METHOD'] === 'HEAD' ? '' : json_encode($response['json'], JSON_THROW_ON_ERROR)))->send();
    return;
}
// Serve only generated static assets; never execute another PHP endpoint in this harness.
$root = realpath($_SERVER['DOCUMENT_ROOT']);
$file = realpath($root . '/' . rawurldecode((string) $path));
if ($file !== false && is_dir($file)) $file = realpath($file . '/index.html');
if ($file === false || !str_starts_with($file, $root . '/') || !is_file($file)
    || !in_array(strtolower(pathinfo($file, PATHINFO_EXTENSION)), ['html', 'css', 'js', 'mjs', 'png', 'webp', 'jpg', 'jpeg', 'svg', 'woff', 'woff2', 'ico', 'xml', 'txt', 'pdf'], true)) {
    http_response_code(404); return;
}
return false;
