<?php

declare(strict_types=1);

namespace Finados;

use RuntimeException;

final class Config
{
    private const REQUIRED_KEYS = [
        'environment',
        'databaseDsn',
        'databaseUser',
        'databasePassword',
        'allowedOrigin',
        'encryptionKey',
        'hmacKey',
    ];

    private function __construct(
        private readonly string $environment,
        private readonly string $databaseDsn,
        private readonly string $databaseUser,
        private readonly string $databasePassword,
        private readonly string $allowedOrigin,
        private readonly string $encryptionKey,
        private readonly string $hmacKey,
        private readonly string $privateDirectory,
    ) {
    }

    public static function fromFile(string $path): self
    {
        $resolvedPath = realpath($path);
        if ($resolvedPath === false || !is_file($resolvedPath) || !is_readable($resolvedPath)) {
            throw new RuntimeException('Finados backend configuration file is unavailable.');
        }

        $contents = file_get_contents($resolvedPath);
        if ($contents === false) {
            throw new RuntimeException('Finados backend configuration file is unavailable.');
        }

        try {
            $values = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new RuntimeException('Finados backend configuration is invalid.');
        }

        if (!is_array($values) || array_is_list($values) || !self::hasExactKeys($values)) {
            throw new RuntimeException('Finados backend configuration is invalid.');
        }

        foreach (self::REQUIRED_KEYS as $key) {
            if (!is_string($values[$key])) {
                throw new RuntimeException('Finados backend configuration is invalid.');
            }
        }

        $environment = $values['environment'];
        if (!in_array($environment, ['test', 'production'], true)) {
            throw new RuntimeException('Finados backend configuration is invalid.');
        }

        $databaseDsn = $values['databaseDsn'];
        if (!str_starts_with($databaseDsn, 'mysql:') && !str_starts_with($databaseDsn, 'sqlite:')) {
            throw new RuntimeException('Finados backend configuration is invalid.');
        }

        $allowedOrigin = $values['allowedOrigin'];
        $origin = parse_url($allowedOrigin);
        if (
            $origin === false
            || !isset($origin['scheme'], $origin['host'])
            || isset($origin['user'])
            || isset($origin['pass'])
            || isset($origin['path'])
            || isset($origin['query'])
            || isset($origin['fragment'])
        ) {
            throw new RuntimeException('Finados backend configuration is invalid.');
        }

        if ($environment === 'production') {
            if ($origin['scheme'] !== 'https' || self::isInsidePublicHtml($resolvedPath)) {
                throw new RuntimeException('Finados backend configuration is invalid.');
            }
        }

        return new self(
            $environment,
            $databaseDsn,
            $values['databaseUser'],
            $values['databasePassword'],
            $allowedOrigin,
            self::decodeKey($values['encryptionKey']),
            self::decodeKey($values['hmacKey']),
            dirname($resolvedPath),
        );
    }

    public static function fromProductionEnvironment(?array $environment = null): self
    {
        // Some CGI/LSAPI handlers expose putenv() values only to named getenv() calls.
        $path = $environment === null ? getenv('FINADOS_CONFIG_PATH') : ($environment['FINADOS_CONFIG_PATH'] ?? null);
        if (!is_string($path) || !str_starts_with($path, DIRECTORY_SEPARATOR)) {
            throw new RuntimeException('Finados backend production configuration is invalid.');
        }

        $resolvedPath = realpath($path);
        if ($resolvedPath === false || !is_file($resolvedPath) || self::isInsidePublicHtml($resolvedPath)) {
            throw new RuntimeException('Finados backend production configuration is invalid.');
        }

        $config = self::fromFile($resolvedPath);
        if (!$config->isProduction()) {
            throw new RuntimeException('Finados backend production configuration is invalid.');
        }

        return $config;
    }

    public function databaseDsn(): string
    {
        return $this->databaseDsn;
    }

    public function databaseUser(): string
    {
        return $this->databaseUser;
    }

    public function databasePassword(): string
    {
        return $this->databasePassword;
    }

    public function allowedOrigin(): string
    {
        return $this->allowedOrigin;
    }

    public function encryptionKey(): string
    {
        return $this->encryptionKey;
    }

    public function hmacKey(): string
    {
        return $this->hmacKey;
    }

    public function privateDirectory(): string
    {
        return $this->privateDirectory;
    }

    public function isProduction(): bool
    {
        return $this->environment === 'production';
    }

    private static function hasExactKeys(array $values): bool
    {
        $actual = array_keys($values);
        sort($actual);
        $required = self::REQUIRED_KEYS;
        sort($required);

        return $actual === $required;
    }

    private static function decodeKey(string $value): string
    {
        $decoded = base64_decode($value, true);
        if ($decoded === false || strlen($decoded) !== 32) {
            throw new RuntimeException('Finados backend configuration is invalid.');
        }

        return $decoded;
    }

    private static function isInsidePublicHtml(string $path): bool
    {
        return in_array('public_html', explode(DIRECTORY_SEPARATOR, $path), true);
    }
}
