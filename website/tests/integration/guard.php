<?php
declare(strict_types=1);

require_once __DIR__ . '/../../backend/finados-api/src/Router.php';

function local_test_config(): Finados\Config
{
    // SERVER_NAME is PHP's bound server address, not the untrusted Host header.
    if (PHP_SAPI !== 'cli-server' || ($_SERVER['SERVER_NAME'] ?? '') !== '127.0.0.1'
        || ($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1') throw new RuntimeException();
    $path = getenv('VOCEROS_TEST_CONFIG');
    if (!is_string($path) || $path === '') throw new RuntimeException();
    $config = Finados\Config::fromFile($path);
    if ($config->isProduction() || !str_starts_with($config->databaseDsn(), 'sqlite:/')
        || preg_match('#^http://127\.0\.0\.1:[1-9][0-9]{0,4}$#D', $config->allowedOrigin()) !== 1) throw new RuntimeException();
    return $config;
}

try { $testConfig = local_test_config(); }
catch (Throwable) { http_response_code(403); header('Content-Type: application/json'); echo '{"ok":false}'; exit; }
umask(0077);
// Per-run identity rejects unrelated listeners during readiness.
$instance = getenv('VOCEROS_TEST_INSTANCE');
if (is_string($instance) && preg_match('/^[a-f0-9]{48}$/D', $instance)) header('X-Voceros-Test-Instance: ' . $instance);
