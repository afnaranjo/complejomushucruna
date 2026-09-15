<?php

declare(strict_types=1);

namespace Finados;

use RuntimeException;

require_once __DIR__ . '/../src/Config.php';
require_once __DIR__ . '/../src/Database.php';

/** Shared CLI boundary: fixed diagnostics, private files and no shell interpolation. */
final class Operations
{
    public static function options(array $arguments, array $required, array $flags = []): array
    {
        $options = [];
        for ($i = 0; $i < count($arguments); $i++) {
            $key = $arguments[$i];
            if (isset($options[$key])) throw new RuntimeException('Invalid arguments.');
            if (in_array($key, $flags, true)) { $options[$key] = true; continue; }
            if (!in_array($key, [...$required, '--config'], true) || !isset($arguments[$i + 1])
                || str_starts_with($arguments[$i + 1], '--')) throw new RuntimeException('Invalid arguments.');
            $options[$key] = $arguments[++$i];
        }
        foreach ($required as $key) if (!isset($options[$key])) throw new RuntimeException('Missing arguments.');
        return $options;
    }

    public static function config(array $options): Config
    {
        if (!isset($options['--config'])) return Config::fromProductionEnvironment();
        $config = Config::fromFile($options['--config']);
        if ($config->isProduction()) throw new RuntimeException('Production requires the environment configuration.');
        return $config;
    }

    public static function configDirectory(array $options): string
    {
        $path = realpath($options['--config'] ?? (getenv('FINADOS_CONFIG_PATH') ?: ''));
        if ($path === false) throw new RuntimeException('Configuration unavailable.');
        return dirname($path);
    }

    public static function privateDirectory(string $path): string
    {
        if (!str_starts_with($path, '/') || str_contains($path, "\0")
            || in_array('..', explode('/', $path), true)) throw new RuntimeException('Invalid private directory.');
        // Resolve existing ancestors first, so aliases into a public directory also fail.
        $ancestor = $path; $suffix = [];
        while (!file_exists($ancestor) && !is_link($ancestor)) {
            array_unshift($suffix, basename($ancestor));
            $ancestor = dirname($ancestor);
        }
        $resolved = realpath($ancestor);
        if ($resolved === false || !is_dir($resolved)) throw new RuntimeException('Invalid private directory.');
        $resolved = rtrim($resolved, '/') . ($suffix === [] ? '' : '/' . implode('/', $suffix));
        foreach (['public_html', 'htdocs', 'www', 'public', 'dist'] as $publicPart) {
            if (in_array($publicPart, explode('/', $resolved), true)) throw new RuntimeException('Public backup directory rejected.');
        }
        $docroot = ($_SERVER['DOCUMENT_ROOT'] ?? '') ?: getenv('DOCUMENT_ROOT');
        if (is_string($docroot) && $docroot !== '' && ($public = realpath($docroot)) !== false
            && ($resolved === $public || str_starts_with($resolved, rtrim($public, '/') . '/'))) {
            throw new RuntimeException('Public backup directory rejected.');
        }
        if (!is_dir($resolved) && !mkdir($resolved, 0700, true)) throw new RuntimeException('Private directory unavailable.');
        if ((fileperms($resolved) & 0077) !== 0) throw new RuntimeException('Private directory requires mode 0700.');
        return $resolved;
    }

    public static function datedDirectory(string $root): string
    {
        $directory = self::privateDirectory($root) . '/' . gmdate('Ymd\THis\Z') . '-' . bin2hex(random_bytes(8));
        if (!mkdir($directory, 0700)) throw new RuntimeException('Private directory unavailable.');
        return $directory;
    }

    public static function writeExclusive(string $path, string $contents): void
    {
        $stream = fopen($path, 'x+b');
        if ($stream === false) throw new RuntimeException('Private file unavailable.');
        try {
            if (!chmod($path, 0600) || fwrite($stream, $contents) !== strlen($contents) || !fflush($stream)) {
                throw new RuntimeException('Private file unavailable.');
            }
        } finally { fclose($stream); }
    }

    public static function executable(string $name): ?string
    {
        foreach (explode(PATH_SEPARATOR, getenv('PATH') ?: '') as $directory) {
            if ($directory === '' || !str_starts_with($directory, '/')) continue;
            $path = $directory . '/' . $name;
            if (is_file($path) && is_executable($path)) return $path;
        }
        return null;
    }
}
