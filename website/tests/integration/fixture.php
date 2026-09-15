<?php
declare(strict_types=1);

// CLI-only fixture provisioning. Passwords arrive on stdin, never argv or logs.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
umask(0077);
require_once __DIR__ . '/../../backend/finados-api/bin/create-admin.php';
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$config = Finados\Config::fromFile($input['config']);
if ($config->isProduction() || !str_starts_with($config->databaseDsn(), 'sqlite:/')) exit(1);
$pdo = Finados\Database::connect($config);
if (($input['action'] ?? '') === 'inspect') {
    $result = [];
    foreach (['voceros', 'vocero_consents', 'vocero_notes', 'sheets_outbox', 'audit_log', 'schema_migrations'] as $table) {
        $result[$table] = $pdo->query('SELECT * FROM ' . $table)->fetchAll(PDO::FETCH_ASSOC);
    }
    echo json_encode($result, JSON_THROW_ON_ERROR);
    exit;
}
// Apply the real SQLite migration files in order, only against a new private fixture.
$pdo->beginTransaction();
foreach (glob(__DIR__ . '/../../backend/finados-api/migrations/*_sqlite.sql') as $migration) {
    $pdo->exec(file_get_contents($migration));
    $pdo->prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        ->execute([basename($migration), gmdate('Y-m-d H:i:s')]);
}
$pdo->commit();
exit(Finados\AdminCommand::run(['--username', 'admin', '--config', $input['config']],
    static fn (): array => [$input['password'], $input['password']], static function (string $message): void {}));
