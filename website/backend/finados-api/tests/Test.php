<?php

declare(strict_types=1);

function same(mixed $expected, mixed $actual): void
{
    if ($expected !== $actual) {
        throw new RuntimeException(sprintf(
            'Expected %s, received %s.',
            var_export($expected, true),
            var_export($actual, true),
        ));
    }
}

function throws(callable $callback, string $exceptionClass): void
{
    try {
        $callback();
    } catch (Throwable $exception) {
        if ($exception instanceof $exceptionClass) {
            return;
        }

        throw new RuntimeException(sprintf(
            'Expected %s, received %s.',
            $exceptionClass,
            $exception::class,
        ));
    }

    throw new RuntimeException(sprintf('Expected %s to be thrown.', $exceptionClass));
}

function temp_file(string $contents): string
{
    $path = tempnam(sys_get_temp_dir(), 'finados-config-');
    if ($path === false) {
        throw new RuntimeException('Unable to create temporary test configuration.');
    }

    if (file_put_contents($path, $contents) === false) {
        throw new RuntimeException('Unable to write temporary test configuration.');
    }

    register_shutdown_function(static fn (): bool => unlink($path));

    return $path;
}

function temp_public_file(string $contents): string
{
    $root = tempnam(sys_get_temp_dir(), 'finados-public-html-');
    if ($root === false || !unlink($root) || !mkdir($root . '/public_html', 0700, true)) {
        throw new RuntimeException('Unable to create temporary public_html test directory.');
    }

    $path = $root . '/public_html/finados-backend.json';
    if (file_put_contents($path, $contents) === false) {
        throw new RuntimeException('Unable to write temporary public_html test configuration.');
    }

    register_shutdown_function(static function () use ($path, $root): void {
        unlink($path);
        rmdir($root . '/public_html');
        rmdir($root);
    });

    return $path;
}
