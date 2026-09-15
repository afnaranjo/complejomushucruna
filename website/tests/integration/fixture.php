<?php
declare(strict_types=1);

// CLI-only fixture provisioning. Passwords arrive on stdin, never argv or logs.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
umask(0077);
require_once __DIR__ . '/../../backend/finados-api/bin/create-admin.php';
$input = json_decode(stream_get_contents(STDIN), true, 512, JSON_THROW_ON_ERROR);
$config = Finados\Config::fromFile($input['config']);
if ($config->isProduction() || !str_starts_with($config->databaseDsn(), 'sqlite:/')) exit(1);
if (($input['action'] ?? '') === 'backup') {
    require_once __DIR__ . '/../../backend/finados-api/bin/backup.php';
    exit(Finados\BackupCommand::run(['--config', $input['config'], '--output', $config->privateDirectory() . '/backups']));
}
$pdo = Finados\Database::connect($config);
if (($input['action'] ?? '') === 'inspect') {
    $result = [];
    foreach (['voceros', 'vocero_consents', 'vocero_notes', 'sheets_outbox', 'audit_log', 'schema_migrations'] as $table) {
        $result[$table] = $pdo->query('SELECT * FROM ' . $table)->fetchAll(PDO::FETCH_ASSOC);
    }
    foreach (['vocero_accounts' => 'id, public_id, active, privacy_version', 'vocero_account_links' => 'account_id, vocero_id',
        'vocero_photos' => 'vocero_id, content_type, bytes, width, height', 'vocero_password_resets' => 'id, account_id, expires_at, consumed_at',
        'vocero_login_attempts' => 'id, succeeded, attempted_at'] as $table => $columns) {
        $result[$table] = $pdo->query('SELECT ' . $columns . ' FROM ' . $table)->fetchAll(PDO::FETCH_ASSOC);
    }
    require_once __DIR__ . '/../../backend/finados-api/src/Crypto.php';
    $crypto = new Finados\Crypto($config);
    $result['sheets_field_names'] = array_map(static function (array $row) use ($crypto): array {
        $payload = json_decode($crypto->decrypt($row['payload_enc']), true, 512, JSON_THROW_ON_ERROR);
        $keys = [];
        array_walk_recursive($payload, static function ($value, $key) use (&$keys): void { $keys[] = $key; });
        return array_values(array_unique([...array_keys($payload), ...$keys]));
    }, $result['sheets_outbox']);
    echo json_encode($result, JSON_THROW_ON_ERROR);
    exit;
}
// Apply the real SQLite migration files in order, only against a new private fixture.
$pdo->beginTransaction();
$migrations = glob(__DIR__ . '/../../backend/finados-api/migrations/*_sqlite.sql'); sort($migrations, SORT_STRING);
foreach ($migrations as $migration) {
    $pdo->exec(file_get_contents($migration));
    $pdo->prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
        ->execute([basename($migration), gmdate('Y-m-d H:i:s')]);
}
$pdo->commit();
exit(Finados\AdminCommand::run(['--username', 'admin', '--config', $input['config']],
    static fn (): array => [$input['password'], $input['password']], static function (string $message): void {}));
