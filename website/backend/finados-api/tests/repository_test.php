<?php

declare(strict_types=1);

require_once __DIR__ . '/Test.php';
foreach (['Database', 'Crypto', 'Audit', 'VocerosRepository'] as $class) {
    $sourcePath = __DIR__ . '/../src/' . $class . '.php';
    if (is_file($sourcePath)) {
        require_once $sourcePath;
    }
}

use Finados\Config;
use Finados\Crypto;
use Finados\Database;
use Finados\VocerosRepository;

function repository_config(array $overrides = []): Config
{
    return Config::fromFile(temp_file(json_encode(array_replace([
        'environment' => 'test',
        'databaseDsn' => 'sqlite::memory:',
        'databaseUser' => '',
        'databasePassword' => '',
        'allowedOrigin' => 'http://127.0.0.1:4173',
        'encryptionKey' => base64_encode(str_repeat('e', 32)),
        'hmacKey' => base64_encode(str_repeat('h', 32)),
    ], $overrides), JSON_THROW_ON_ERROR)));
}

// Equal encryption and lookup keys must fail before any cryptographic operation.
throws(fn () => new Crypto(repository_config([
    'hmacKey' => base64_encode(str_repeat('e', 32)),
])), RuntimeException::class);

// Removing randomized authenticated encryption exposes data or accepts tampering.
$config = repository_config();
$crypto = new Crypto($config);
foreach (['', '0995874566', 'Texto sintético con ñ y á'] as $plaintext) {
    $encrypted = $crypto->encrypt($plaintext);
    same($plaintext, $crypto->decrypt($encrypted));
    same(false, $encrypted === $crypto->encrypt($plaintext));
    $raw = base64_decode($encrypted, true);
    same(true, is_string($raw) && strlen($raw) === 28 + strlen($plaintext));
    $raw[12] = chr(ord($raw[12]) ^ 1);
    throws(fn () => $crypto->decrypt(base64_encode($raw)), RuntimeException::class);
}
foreach (['not-base64!', '', base64_encode(str_repeat('a', 27))] as $invalid) {
    throws(fn () => $crypto->decrypt($invalid), RuntimeException::class);
}
$otherCrypto = new Crypto(repository_config(['encryptionKey' => base64_encode(str_repeat('x', 32))]));
throws(fn () => $otherCrypto->decrypt($crypto->encrypt('test')), RuntimeException::class);
same(hash_hmac('sha256', 'test@example.invalid', str_repeat('h', 32)), $crypto->lookup(' TEST@example.invalid '));
same(false, $crypto->lookup('test') === (new Crypto(repository_config(['hmacKey' => base64_encode(str_repeat('x', 32))])))->lookup('test'));

// Removing the production guard would permit a disposable SQLite database in production.
throws(fn () => Database::connect(repository_config([
    'environment' => 'production', 'allowedOrigin' => 'https://example.invalid',
])), RuntimeException::class);
$pdo = Database::connect($config);
same(1, (int) $pdo->query('PRAGMA foreign_keys')->fetchColumn());
same(PDO::ERRMODE_EXCEPTION, $pdo->getAttribute(PDO::ATTR_ERRMODE));
same(PDO::FETCH_ASSOC, $pdo->getAttribute(PDO::ATTR_DEFAULT_FETCH_MODE));

function vocero_fixture(array $overrides = []): array
{
    return array_replace([
        'submission_id' => 'a1b2c3d4e5f60123456789abcdef0123',
        'full_name' => 'Persona Sintética', 'cedula' => '1800000001',
        'birth_date' => '2000-01-02', 'age_at_submission' => 26,
        'whatsapp' => '0995874566', 'email' => 'vocero@example.invalid', 'city' => 'Ciudad Prueba',
        'main_network' => 'TikTok', 'previous_participation' => 'No',
        'community_source' => 'Prueba', 'kit_pickup' => 'Por confirmar',
        'representative_name' => 'Representante Sintético', 'representative_cedula' => '1800000002',
        'representative_phone' => '0990000002', 'representative_email' => 'rep@example.invalid',
        'submitted_at' => '2026-09-14 10:00:00',
    ], $overrides);
}

function consent_fixture(): array
{
    return array_map(static fn (string $type): array => [
        'consent_type' => $type, 'accepted' => 1, 'text_version' => 'synthetic-v1',
        'text_hash' => hash('sha256', 'Synthetic consent ' . $type),
        'accepted_at' => '2026-09-14 10:00:00', 'ip' => '192.0.2.55',
        'user_agent' => 'Synthetic Test Agent', 'source_url' => 'https://example.invalid/voceros/',
        'method' => 'checkbox',
    ], ['privacy', 'image', 'data']);
}

function raw_database_dump(PDO $pdo): string
{
    $dump = [];
    foreach (['voceros', 'vocero_consents', 'vocero_notes', 'audit_log'] as $table) {
        $dump[$table] = $pdo->query('SELECT * FROM ' . $table)->fetchAll();
    }
    return json_encode($dump, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
}

// Missing schema, encryption, uniqueness or transaction boundaries breaks these persisted outcomes.
same(true, is_file(__DIR__ . '/../migrations/001_initial_sqlite.sql'));
$pdo->exec(file_get_contents(__DIR__ . '/../migrations/001_initial_sqlite.sql'));
$repository = new VocerosRepository($pdo, $crypto);
$publicId = $repository->create(vocero_fixture(), consent_fixture());
same(1, preg_match('/^[a-f0-9]{32}$/D', $publicId));
same(false, $publicId === vocero_fixture()['submission_id']);
same($publicId, $repository->create(vocero_fixture(['full_name' => 'Ignored replay']), consent_fixture()));
same(1, count($repository->list(['search' => '', 'status' => '', 'page' => 1])['items']));
$detail = $repository->find($publicId);
same('Persona Sintética', $detail['full_name']);
same(3, count($detail['consents']));
same([], $detail['notes']);
foreach (['cedula', 'birth_date', 'whatsapp', 'email', 'representative_name', 'representative_cedula', 'representative_phone', 'representative_email'] as $field) {
    same(vocero_fixture()[$field], $detail[$field]);
    same(false, str_contains(raw_database_dump($pdo), vocero_fixture()[$field]));
}
same('192.0.2.55', $detail['consents'][0]['ip']);
same(false, str_contains(raw_database_dump($pdo), '192.0.2.55'));
same(null, $repository->find(str_repeat('f', 32)));
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero.created'")->fetchColumn());
foreach ([[], array_slice(consent_fixture(), 0, 2), [...consent_fixture(), consent_fixture()[0]]] as $invalidConsents) {
    throws(fn () => $repository->create(vocero_fixture(['submission_id' => str_repeat('b', 32)]), $invalidConsents), InvalidArgumentException::class);
}
$pdo->exec("CREATE TRIGGER fail_consent BEFORE INSERT ON vocero_consents WHEN NEW.consent_type = 'image' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
throws(fn () => $repository->create(vocero_fixture(['submission_id' => str_repeat('c', 32)]), consent_fixture()), RuntimeException::class);
same(1, (int) $pdo->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same(3, (int) $pdo->query('SELECT COUNT(*) FROM vocero_consents')->fetchColumn());
same(1, (int) $pdo->query('SELECT COUNT(*) FROM audit_log')->fetchColumn());
same(false, $pdo->inTransaction());
$pdo->exec('DROP TRIGGER fail_consent');

// Returning full rows in the list leaks protected data before opening an authenticated detail.
$item = $repository->list([])['items'][0];
same('******0001', $item['cedula']);
same('******4566', $item['whatsapp']);
foreach (['email', 'birth_date', 'representative_name', 'cedula_enc', 'cedula_idx', 'id'] as $privateField) {
    same(false, array_key_exists($privateField, $item));
}
$secondId = $repository->create(vocero_fixture([
    'submission_id' => str_repeat('d', 32), 'full_name' => 'Segunda Persona', 'city' => 'Otra Ciudad',
    'cedula' => '1800000003', 'whatsapp' => '0990000003', 'email' => 'second@example.invalid',
    'main_network' => 'Instagram', 'previous_participation' => 'Sí', 'submitted_at' => '2026-09-15 12:00:00',
]), consent_fixture());
foreach (['Persona Sint', 'Ciudad Prueba', $publicId, vocero_fixture()['submission_id'], '1800000001', '0995874566', ' VOCERO@EXAMPLE.INVALID '] as $search) {
    $result = $repository->list(['search' => $search]);
    same(1, $result['total']);
    same($publicId, $result['items'][0]['public_id']);
}
foreach (['099587', 'vocero@', "' OR 1=1 --", '%', '_'] as $search) {
    same(0, $repository->list(['search' => $search])['total']);
}
same($secondId, $repository->list(['page' => 1, 'per_page' => 1])['items'][0]['public_id']);
same($publicId, $repository->list(['page' => 2, 'per_page' => 1])['items'][0]['public_id']);
same(2, $repository->list(['page' => 3, 'per_page' => 1])['total']);
same([], $repository->list(['page' => 3, 'per_page' => 1])['items']);
same(1, $repository->list(['city' => 'Otra Ciudad', 'main_network' => 'Instagram', 'previous_participation' => 'Sí', 'date_from' => '2026-09-15', 'date_to' => '2026-09-15'])['total']);
same(0, $repository->list(['city' => 'Otra Ciudad', 'date_to' => '2026-09-14'])['total']);
foreach ([['page' => 0], ['per_page' => 101], ['per_page' => -1], ['page' => '1 OR 1=1'], ['status' => 'Inventado'], ['date_from' => '2026-02-30'], ['date_from' => '2026-09-15', 'date_to' => '2026-09-14'], ['search' => []]] as $badFilters) {
    throws(fn () => $repository->list($badFilters), InvalidArgumentException::class);
}

// A mutation without its audit must roll back, and notes must never be copied into audit metadata.
$pdo->exec("INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES ('00000000000000000000000000000001', 'synthetic-admin', 'not-a-real-password-hash', '2026-09-14 00:00:00', '2026-09-14 00:00:00')");
$actorId = (int) $pdo->lastInsertId();
$repository->changeStatus($publicId, 'En revisión', $actorId);
same('En revisión', $repository->find($publicId)['status']);
same(1, $repository->list(['status' => 'En revisión'])['total']);
$auditRow = $pdo->query("SELECT * FROM audit_log WHERE event_type = 'vocero.status_changed'")->fetch();
same($actorId, (int) $auditRow['actor_id']);
same($publicId, $auditRow['subject_public_id']);
same(['from_status' => 'Nuevo', 'to_status' => 'En revisión'], json_decode($auditRow['metadata_json'], true));
$repository->changeStatus($publicId, 'En revisión', $actorId);
same(1, (int) $pdo->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero.status_changed'")->fetchColumn());
foreach (['', 'Registrado', "Nuevo'; DROP TABLE voceros; --"] as $invalidStatus) {
    throws(fn () => $repository->changeStatus($publicId, $invalidStatus, $actorId), InvalidArgumentException::class);
}
throws(fn () => $repository->changeStatus(str_repeat('f', 32), 'Aprobado', $actorId), OutOfBoundsException::class);
throws(fn () => $repository->changeStatus($publicId, 'Aprobado', 999999), InvalidArgumentException::class);
$repository->addNote($publicId, ' Nota sintética con teléfono 0995874566 ', $actorId);
$repository->addNote($publicId, 'Segunda nota', $actorId);
same(['Nota sintética con teléfono 0995874566', 'Segunda nota'], array_column($repository->find($publicId)['notes'], 'body'));
same(false, str_contains(json_encode($pdo->query('SELECT * FROM audit_log')->fetchAll()), '0995874566'));
foreach (['', '   ', str_repeat('á', 2001), "\xFF"] as $invalidNote) {
    throws(fn () => $repository->addNote($publicId, $invalidNote, $actorId), InvalidArgumentException::class);
}
$repository->addNote($publicId, str_repeat('á', 2000), $actorId);
throws(fn () => $repository->addNote(str_repeat('f', 32), 'Valid note', $actorId), OutOfBoundsException::class);
throws(fn () => $repository->addNote($publicId, 'Valid note', 999999), InvalidArgumentException::class);
$pdo->exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT, 'synthetic audit failure'); END");
throws(fn () => $repository->changeStatus($publicId, 'Aprobado', $actorId), RuntimeException::class);
same('En revisión', $repository->find($publicId)['status']);
throws(fn () => $repository->addNote($publicId, 'Must roll back', $actorId), RuntimeException::class);
same(3, count($repository->find($publicId)['notes']));
throws(fn () => $repository->create(vocero_fixture(['submission_id' => str_repeat('e', 32)]), consent_fixture()), RuntimeException::class);
same(2, (int) $pdo->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same(6, (int) $pdo->query('SELECT COUNT(*) FROM vocero_consents')->fetchColumn());
same(false, $pdo->inTransaction());
$pdo->exec('DROP TRIGGER fail_audit');

$audit = new Finados\Audit($pdo, $crypto);
throws(fn () => $audit->log('vocero.exported', $actorId, 'vocero', null, ['email' => 'private@example.invalid']), InvalidArgumentException::class);
throws(fn () => $audit->log('vocero.exported', $actorId, 'vocero', null, ['count' => 'private@example.invalid']), InvalidArgumentException::class);
$audit->log('vocero.exported', $actorId, 'vocero', null, ['count' => 2], '192.0.2.99');
$auditRow = $pdo->query("SELECT * FROM audit_log WHERE event_type = 'vocero.exported'")->fetch();
same(hash_hmac('sha256', '192.0.2.99', str_repeat('h', 32)), $auditRow['ip_hash']);
same(['count' => 2], json_decode($auditRow['metadata_json'], true));

// Invalid status on creation must not bypass the state allowlist used by administrative changes.
throws(fn () => $repository->create(vocero_fixture(['submission_id' => str_repeat('e', 32), 'status' => 'Inventado']), consent_fixture()), InvalidArgumentException::class);

// Filter bounds count characters, and SQLite must preserve MySQL's non-null migration key.
throws(fn () => $repository->list(['search' => str_repeat('a', 181)]), InvalidArgumentException::class);
throws(fn () => $repository->list(['city' => "\xFF"]), InvalidArgumentException::class);
throws(fn () => $pdo->exec("INSERT INTO schema_migrations (version, applied_at) VALUES (NULL, '2026-09-14 00:00:00')"), PDOException::class);
