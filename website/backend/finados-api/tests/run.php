<?php

declare(strict_types=1);

require_once __DIR__ . '/../src/Config.php';

set_error_handler(static function (int $severity, string $message, string $file, int $line): never {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

$tests = array_slice($argv, 1);
if ($tests === []) {
    $tests = array_map('basename', glob(__DIR__ . '/*_test.php') ?: []);
}

$failures = 0;
foreach ($tests as $test) {
    $path = __DIR__ . '/' . basename($test);
    if (!is_file($path)) {
        fwrite(STDERR, "FAIL {$test}: test file not found\n");
        $failures++;
        continue;
    }

    try {
        require $path;
        fwrite(STDOUT, "PASS " . basename($path) . "\n");
    } catch (Throwable $exception) {
        fwrite(STDERR, "FAIL " . basename($path) . ': ' . $exception->getMessage() . "\n");
        $failures++;
    }
}

exit($failures === 0 ? 0 : 1);
