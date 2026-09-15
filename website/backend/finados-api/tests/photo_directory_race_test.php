<?php
declare(strict_types=1);
require_once __DIR__ . '/OperationsTest.php';

// Model another process creating each directory after is_dir but before mkdir.
// The namespace shim replaces only that filesystem race; directories and PhotoStorage are real.
$worker = <<<'PHP'
namespace Finados;
function mkdir(string $path, int $permissions = 0777, bool $recursive = false): bool {
    $created = \mkdir($path, $permissions, $recursive);
    if ($created && basename($path) === $GLOBALS['racingDirectory']) return false;
    return $created;
}
require $argv[1];
$GLOBALS['racingDirectory'] = $argv[3];
$config = Config::fromFile($argv[2]);
try {
    new PhotoStorage($config, new Crypto($config));
    echo 'ready';
} catch (\Throwable) { exit(1); }
PHP;
foreach (['voceros-photos', 'staging', 'files'] as $racingDirectory) {
    [$caseRoot] = operations_fixture();
    $process = proc_open([PHP_BINARY, '-r', $worker, realpath(__DIR__ . '/../src/Router.php'), $caseRoot . '/config.json', $racingDirectory],
        [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    $output = stream_get_contents($pipes[1]); $error = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    same(0, proc_close($process)); same('ready', $output); same('', $error);
    foreach (['voceros-photos', 'voceros-photos/staging', 'voceros-photos/files'] as $relativeDirectory) same(0700, fileperms($caseRoot . '/' . $relativeDirectory) & 0777);
}
