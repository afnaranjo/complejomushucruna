<?php
declare(strict_types=1);

if (!defined('MUSHUC_API_ENTRY')) {
    http_response_code(404);
    exit;
}

function voceros_bootstrap(?array $environment = null, ?callable $connect = null): array
{
    $environment ??= getenv();
    $path = $environment['FINADOS_CONFIG_PATH'] ?? null;
    if (!is_string($path) || !str_starts_with($path, DIRECTORY_SEPARATOR)) {
        throw new RuntimeException('Private backend configuration is unavailable.');
    }
    $resolved = realpath($path);
    $docroot = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: realpath(dirname(__DIR__));
    if ($resolved === false || !is_file($resolved)
        || in_array('public_html', explode(DIRECTORY_SEPARATOR, $resolved), true)
        || ($docroot && str_starts_with($resolved, $docroot . DIRECTORY_SEPARATOR))) {
        throw new RuntimeException('Private backend configuration is unavailable.');
    }
    $privateDirectory = dirname($resolved);
    $backendRoot = $environment['FINADOS_BACKEND_ROOT'] ?? null;
    if (!is_string($backendRoot) || !str_starts_with($backendRoot, DIRECTORY_SEPARATOR)) {
        throw new RuntimeException('Private backend source is unavailable.');
    }
    $backendRoot = realpath($backendRoot);
    if ($backendRoot === false || !is_dir($backendRoot)
        || in_array('public_html', explode(DIRECTORY_SEPARATOR, $backendRoot), true)
        || ($docroot && ($backendRoot === $docroot || str_starts_with($backendRoot, $docroot . DIRECTORY_SEPARATOR)))) {
        throw new RuntimeException('Private backend source is unavailable.');
    }
    foreach (['Config', 'Database', 'Crypto', 'Audit', 'VocerosRepository'] as $class) {
        $source = realpath($backendRoot . '/src/' . $class . '.php');
        if ($source === false || !is_file($source) || !str_starts_with($source, $backendRoot . DIRECTORY_SEPARATOR)
            || ($docroot && str_starts_with($source, $docroot . DIRECTORY_SEPARATOR))
            || in_array('public_html', explode(DIRECTORY_SEPARATOR, $source), true)) {
            throw new RuntimeException('Private backend source is unavailable.');
        }
        require_once $source;
    }
    $config = Finados\Config::fromProductionEnvironment($environment);
    $pdo = ($connect ?? [Finados\Database::class, 'connect'])($config);
    $crypto = new Finados\Crypto($config);
    return [
        'repository' => new Finados\VocerosRepository($pdo, $crypto, new Finados\Audit($pdo, $crypto)),
        'privateDirectory' => $privateDirectory,
        'config' => registration_config($privateDirectory),
    ];
}
