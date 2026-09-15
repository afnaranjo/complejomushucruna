<?php

declare(strict_types=1);

namespace Finados {
    /** Simulate SAPIs that omit putenv() values from bulk getenv() but return named values. */
    function getenv(?string $name = null, bool $localOnly = false): array|string|false
    {
        if (($GLOBALS['finados_named_environment_only'] ?? false) === true && $name === null) {
            return [];
        }

        return $name === null ? \getenv() : \getenv($name, $localOnly);
    }
}

namespace {
    require_once __DIR__ . '/Test.php';

    $previousPath = \getenv('FINADOS_CONFIG_PATH');
    $configPath = temp_file(json_encode([
        'environment' => 'production',
        'databaseDsn' => 'mysql:host=127.0.0.1;dbname=finados;charset=utf8mb4',
        'databaseUser' => 'finados_user',
        'databasePassword' => 'test-password-only',
        'allowedOrigin' => 'https://complejomushucruna.com',
        'encryptionKey' => base64_encode(str_repeat('e', 32)),
        'hmacKey' => base64_encode(str_repeat('h', 32)),
    ], JSON_THROW_ON_ERROR));
    putenv('FINADOS_CONFIG_PATH=' . $configPath);
    $GLOBALS['finados_named_environment_only'] = true;

    try {
        $config = Finados\Config::fromProductionEnvironment();
        same(true, $config->isProduction());
    } finally {
        $GLOBALS['finados_named_environment_only'] = false;
        putenv($previousPath === false ? 'FINADOS_CONFIG_PATH' : 'FINADOS_CONFIG_PATH=' . $previousPath);
    }
}
