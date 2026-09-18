<?php

declare(strict_types=1);

require_once __DIR__ . '/Test.php';

use Finados\Config;

function valid_config(array $overrides = []): string
{
    return temp_file(json_encode(array_replace([
        'environment' => 'test',
        'databaseDsn' => 'sqlite::memory:',
        'databaseUser' => '',
        'databasePassword' => '',
        'allowedOrigin' => 'http://127.0.0.1:4173',
        'encryptionKey' => base64_encode(str_repeat('e', 32)),
        'hmacKey' => base64_encode(str_repeat('h', 32)),
    ], $overrides), JSON_THROW_ON_ERROR));
}

$config = Config::fromFile(valid_config());
same('sqlite::memory:', $config->databaseDsn());
same('', $config->databaseUser());
same('', $config->databasePassword());
same('http://127.0.0.1:4173', $config->allowedOrigin());
same(str_repeat('e', 32), $config->encryptionKey());
same(str_repeat('h', 32), $config->hmacKey());
same(false, $config->isProduction());

$multiOriginValues = [
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigins' => ['https://complejomushucruna.com', 'https://finados.expoferiamushucruna.com'],
    'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
];
$multiOrigin = Config::fromFile(temp_file(json_encode($multiOriginValues, JSON_THROW_ON_ERROR)));
same(['https://complejomushucruna.com', 'https://finados.expoferiamushucruna.com'], $multiOrigin->allowedOrigins());
same(true, $multiOrigin->isAllowedOrigin('https://complejomushucruna.com'));
same(true, $multiOrigin->isAllowedOrigin('https://finados.expoferiamushucruna.com'));
same(false, $multiOrigin->isAllowedOrigin('https://evil.example'));

throws(fn () => Config::fromFile(temp_file('{}')), RuntimeException::class);
throws(fn () => Config::fromFile(valid_config(['unexpected' => 'value'])), RuntimeException::class);
throws(fn () => Config::fromFile(valid_config(['databaseDsn' => 'pgsql:dbname=finados'])), RuntimeException::class);
throws(fn () => Config::fromFile(valid_config(['encryptionKey' => base64_encode(str_repeat('e', 31))])), RuntimeException::class);
throws(fn () => Config::fromFile(valid_config(['allowedOrigin' => 'http://127.0.0.1:4173/api'])), RuntimeException::class);
throws(fn () => Config::fromFile(valid_config([
    'environment' => 'production',
    'allowedOrigin' => 'http://finados.complejomushucruna.com',
])), RuntimeException::class);

$production = Config::fromFile(valid_config([
    'environment' => 'production',
    'databaseDsn' => 'mysql:host=127.0.0.1;dbname=finados;charset=utf8mb4',
    'databaseUser' => 'finados_user',
    'databasePassword' => 'test-password-only',
    'allowedOrigin' => 'https://finados.complejomushucruna.com',
]));
same(true, $production->isProduction());
throws(fn () => Config::fromFile(temp_public_file(json_encode([
    'environment' => 'production',
    'databaseDsn' => 'sqlite::memory:',
    'databaseUser' => '',
    'databasePassword' => '',
    'allowedOrigin' => 'https://finados.complejomushucruna.com',
    'encryptionKey' => base64_encode(str_repeat('e', 32)),
    'hmacKey' => base64_encode(str_repeat('h', 32)),
], JSON_THROW_ON_ERROR))), RuntimeException::class);

throws(fn () => Config::fromProductionEnvironment([]), RuntimeException::class);
throws(fn () => Config::fromProductionEnvironment(['FINADOS_CONFIG_PATH' => 'finados-backend.json']), RuntimeException::class);
throws(fn () => Config::fromProductionEnvironment([
    'FINADOS_CONFIG_PATH' => valid_config(),
]), RuntimeException::class);
throws(fn () => Config::fromProductionEnvironment([
    'FINADOS_CONFIG_PATH' => temp_public_file(json_encode([
        'environment' => 'production',
        'databaseDsn' => 'sqlite::memory:',
        'databaseUser' => '',
        'databasePassword' => '',
        'allowedOrigin' => 'https://finados.complejomushucruna.com',
        'encryptionKey' => base64_encode(str_repeat('e', 32)),
        'hmacKey' => base64_encode(str_repeat('h', 32)),
    ], JSON_THROW_ON_ERROR)),
]), RuntimeException::class);

$productionFromEnvironment = Config::fromProductionEnvironment([
    'FINADOS_CONFIG_PATH' => valid_config([
        'environment' => 'production',
        'allowedOrigin' => 'https://finados.complejomushucruna.com',
    ]),
]);
same(true, $productionFromEnvironment->isProduction());
