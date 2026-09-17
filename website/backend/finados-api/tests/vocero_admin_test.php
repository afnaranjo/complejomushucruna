<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

$root = tempnam(sys_get_temp_dir(), 'finados-admin-');
if ($root === false) throw new RuntimeException('Unable to create admin test root.');
unlink($root); mkdir($root, 0700);
register_shutdown_function(static function () use ($root): void {
    $entries = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($entries as $entry) $entry->isDir() && !$entry->isLink() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
    rmdir($root);
});
$configPath = $root . '/config.json';
file_put_contents($configPath, json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://complejomushucruna.com', 'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
], JSON_THROW_ON_ERROR));
$config = Finados\Config::fromFile($configPath);
$pdo = Finados\Database::connect($config);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts'] as $migration) $pdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
$crypto = new Finados\Crypto($config);
$repo = new Finados\VocerosRepository($pdo, $crypto);
$adminSecret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([
    str_repeat('a', 32), 'admin', Finados\Auth::hashPassword($adminSecret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'),
]);
$auth = new Finados\VoceroAuth($pdo, $config);
$auth->register('pending@example.invalid', $adminSecret, true, '192.0.2.10');
$pending = $repo->pendingAccounts();
same(1, count($pending));
same('pending@example.invalid', $pending[0]['email']);
same('Pendiente de ficha', $pending[0]['status']);

$consents = array_map(static fn (string $type): array => [
    'consent_type' => $type, 'accepted' => 1, 'text_version' => 'test-v1', 'text_hash' => hash('sha256', $type),
    'accepted_at' => gmdate('Y-m-d H:i:s'), 'ip' => '192.0.2.11', 'user_agent' => 'Test',
    'source_url' => 'https://example.invalid/', 'method' => 'checkbox',
], ['privacy', 'image', 'data']);
$record = [
    'submission_id' => str_repeat('b', 32), 'full_name' => 'Persona de prueba', 'cedula' => '1800000001',
    'birth_date' => '2000-01-02', 'age_at_submission' => 26, 'whatsapp' => '0990000001', 'email' => 'profile@example.invalid',
    'city' => 'Ambato', 'main_network' => 'TikTok', 'previous_participation' => 'No', 'community_source' => 'Prueba',
    'kit_pickup' => 'Oficina', 'submitted_at' => gmdate('Y-m-d H:i:s'), 'tiktok' => '', 'instagram' => '', 'facebook' => '',
];
$profileId = $repo->create($record, $consents);
$profileAccount = $auth->register('profile@example.invalid', $adminSecret, true, '192.0.2.11');
$profileAccountId = (int) $pdo->query('SELECT id FROM vocero_accounts WHERE email_idx = ' . $pdo->quote($crypto->lookup('profile@example.invalid')))->fetchColumn();
$profileVoceroId = (int) $pdo->query('SELECT id FROM voceros WHERE public_id = ' . $pdo->quote($profileId))->fetchColumn();
$pdo->prepare('INSERT INTO vocero_account_links (account_id, vocero_id, created_at) VALUES (?, ?, ?)')->execute([$profileAccountId, $profileVoceroId, gmdate('Y-m-d H:i:s')]);

$listed = $repo->list([]);
same(1, $listed['total']);
$repo->archive($profileId, 1, '192.0.2.12');
same(0, $repo->list([])['total']);
same(1, $repo->list(['status' => 'Eliminado'])['total']);
same(0, (int) $pdo->query('SELECT active FROM vocero_accounts WHERE id = ' . $profileAccountId)->fetchColumn());
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero.deleted'")->fetchColumn());

$pendingPublicId = $pending[0]['public_id'];
$pendingAccountId = (int) $pdo->query('SELECT id FROM vocero_accounts WHERE public_id = ' . $pdo->quote($pendingPublicId))->fetchColumn();
$repo->archiveAccount($pendingPublicId, 1, '192.0.2.13');
same([], $repo->pendingAccounts());
same(0, (int) $pdo->query('SELECT active FROM vocero_accounts WHERE id = ' . $pendingAccountId)->fetchColumn());
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero_account.deleted'")->fetchColumn());
