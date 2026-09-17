<?php

declare(strict_types=1);

require_once __DIR__ . '/Test.php';
foreach (['Config', 'Database', 'Crypto', 'Audit', 'VocerosRepository', 'Auth'] as $class) {
    require_once __DIR__ . '/../src/' . $class . '.php';
}

use Finados\Auth;
use Finados\Config;
use Finados\Crypto;
use Finados\Database;
use Finados\VocerosRepository;

$root = tempnam(sys_get_temp_dir(), 'finados-progress-');
if ($root === false) throw new RuntimeException('Unable to create progress test database.');
$configPath = temp_file(json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite:' . $root, 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://complejomushucruna.com', 'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
], JSON_THROW_ON_ERROR));
$config = Config::fromFile($configPath);
$pdo = Database::connect($config);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts', '004_vocero_progress', '005_vocero_video_enablement'] as $migration) {
    $pdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
}
$crypto = new Crypto($config);
$repo = new VocerosRepository($pdo, $crypto);
$adminSecret = bin2hex(random_bytes(16));
$pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')->execute([
    str_repeat('a', 32), 'admin', Auth::hashPassword($adminSecret), gmdate('Y-m-d H:i:s'), gmdate('Y-m-d H:i:s'),
]);
$consents = array_map(static fn (string $type): array => [
    'consent_type' => $type, 'accepted' => 1, 'text_version' => 'test-v1', 'text_hash' => hash('sha256', $type),
    'accepted_at' => gmdate('Y-m-d H:i:s'), 'ip' => '192.0.2.20', 'user_agent' => 'Test',
    'source_url' => 'https://example.invalid/', 'method' => 'checkbox',
], ['privacy', 'image', 'data']);
$publicId = $repo->create([
    'submission_id' => str_repeat('b', 32), 'full_name' => 'Persona de progreso', 'cedula' => '1800000002',
    'birth_date' => '2000-01-02', 'age_at_submission' => 26, 'whatsapp' => '0990000002', 'email' => 'progress@example.invalid',
    'city' => 'Ambato', 'main_network' => 'TikTok', 'previous_participation' => 'No', 'community_source' => 'Prueba',
    'kit_pickup' => 'Oficina', 'submitted_at' => gmdate('Y-m-d H:i:s'), 'tiktok' => '', 'instagram' => '', 'facebook' => '',
], $consents);
$voceroId = (int) $pdo->query('SELECT id FROM voceros WHERE public_id = ' . $pdo->quote($publicId))->fetchColumn();

$repo->updateProgress($publicId, [
    'followers_count' => 1000, 'level' => 2, 'traffic_light' => 'yellow', 'kit_status' => 'pendiente',
    'video_slots' => [
        ['slot' => 1, 'enabled' => true, 'enabled_at' => '2026-09-16'],
        ['slot' => 2, 'enabled' => false, 'enabled_at' => null],
        ['slot' => 3, 'enabled' => true, 'enabled_at' => '2026-09-20'],
        ['slot' => 4, 'enabled' => false, 'enabled_at' => null],
        ['slot' => 5, 'enabled' => false, 'enabled_at' => null],
    ],
], 1, '192.0.2.21');
$progress = $repo->progressForVocero($voceroId);
same(2, $progress['videos_unlocked']);
same(true, $progress['videos'][0]['unlocked']);
same('2026-09-16', $progress['videos'][0]['enabled_at']);
same(false, $progress['videos'][1]['unlocked']);
same(null, $progress['videos'][1]['enabled_at']);
same('2026-09-20', $progress['videos'][2]['enabled_at']);

throws(fn () => $repo->saveVideoByVoceroId($voceroId, 2, 'https://example.invalid/video-2', '192.0.2.22'), OutOfBoundsException::class);
$repo->saveVideoByVoceroId($voceroId, 1, 'https://example.invalid/video-1', '192.0.2.22');
same('https://example.invalid/video-1', $repo->progressForVocero($voceroId)['videos'][0]['url']);
