<?php
declare(strict_types=1);

namespace Finados;

require_once __DIR__ . '/operations.php';
require_once __DIR__ . '/../src/Crypto.php';
require_once __DIR__ . '/../src/Audit.php';
require_once __DIR__ . '/../src/VocerosRepository.php';

// One bounded pass, suitable for cron. No background loop, PII, token or endpoint in output.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
try {
    $options = Operations::options(array_slice($argv, 1), []);
    [$config] = Operations::configuration($options);
    $outbox = new SheetsOutbox(Database::connect($config), new Crypto($config));
    $directory = Operations::configDirectory($options);
    $counts = $outbox->reconcile(static fn (array $record): string => SheetsTransport::deliver($directory, $record));
    fwrite(STDOUT, json_encode($counts, JSON_THROW_ON_ERROR) . "\n");
} catch (\Throwable) {
    fwrite(STDERR, "Sheets reconciliation unavailable; check private configuration and migrations.\n");
    exit(1);
}
