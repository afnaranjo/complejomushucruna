<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

// Missing ownership service must fail before fixture setup can hide the missing behavior.
same(true, class_exists(Finados\VoceroProfile::class));

function profile_root(): string
{
    $root = tempnam(sys_get_temp_dir(), 'finados-profile-');
    unlink($root); mkdir($root, 0700);
    register_shutdown_function(static function () use ($root): void {
        $entries = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($entries as $entry) $entry->isDir() && !$entry->isLink() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
        rmdir($root);
    });
    return $root;
}

function profile_fields(array $replace = []): array
{
    return array_replace([
        'submission_id' => str_repeat('1', 32), 'nombre_completo' => 'Persona Sintética', 'cedula' => '1800000001',
        'fecha_nacimiento' => '2000-01-02', 'whatsapp' => '0990000001', 'ciudad' => 'Ciudad Prueba',
        'tiktok' => 'https://example.invalid/profile', 'red_principal' => 'TikTok',
        'vocero_previo' => 'No, es mi primera vez', 'fuente_comunidad' => 'Facebook', 'retiro_kit' => 'En la oficina',
        'consentimiento_politicas' => 'Sí', 'autorizacion_imagen' => 'Sí', 'consentimiento_datos' => 'Sí',
    ], $replace);
}

function profile_upload(string $root, int $width = 80, int $height = 100): array
{
    $path = tempnam($root, 'upload-'); $image = imagecreatetruecolor($width, $height);
    imagejpeg($image, $path, 95);
    if (PHP_VERSION_ID < 80500) imagedestroy($image);
    return ['tmp_name' => $path, 'error' => UPLOAD_ERR_OK, 'size' => filesize($path), 'name' => 'untrusted-name.png', 'type' => 'text/plain'];
}

$profileRoot = profile_root();
$profileConfigPath = $profileRoot . '/config.json';
file_put_contents($profileConfigPath, json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://complejomushucruna.com', 'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
]));
$profileConfig = Finados\Config::fromFile($profileConfigPath);
final class ProfileTransactionProbe extends PDO
{
    public ?Closure $beforeCommit = null;
    public ?Closure $afterCommit = null;
    public bool $rollbackFails = false;
    public ?Closure $beforeBegin = null;
    public ?Closure $beforePhotoMetadata = null;
    public ?Closure $beforeSubmissionLookup = null;
    public function beginTransaction(): bool
    {
        if ($this->beforeBegin !== null) ($this->beforeBegin)();
        return parent::beginTransaction();
    }
    public function commit(): bool
    {
        if ($this->beforeCommit !== null) ($this->beforeCommit)();
        $committed = parent::commit();
        if ($this->afterCommit !== null) ($this->afterCommit)();
        return $committed;
    }
    public function rollBack(): bool
    {
        if ($this->rollbackFails) throw new ProfileCommitFailure('Synthetic rollback acknowledgement failure');
        return parent::rollBack();
    }
}
final class ProfileCommitFailure extends RuntimeException {}
final class ProfileStatementProbe extends PDOStatement
{
    protected function __construct(private ProfileTransactionProbe $owner) {}
    public function execute(?array $params = null): bool
    {
        if ($this->owner->beforePhotoMetadata !== null && str_starts_with($this->queryString, 'INSERT INTO vocero_photos')) ($this->owner->beforePhotoMetadata)();
        if ($this->owner->beforeSubmissionLookup !== null && $this->queryString === 'SELECT public_id FROM voceros WHERE submission_id = ?') ($this->owner->beforeSubmissionLookup)();
        return parent::execute($params);
    }
}
$profileDb = new ProfileTransactionProbe('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$profileDb->setAttribute(PDO::ATTR_STATEMENT_CLASS, [ProfileStatementProbe::class, [$profileDb]]);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts'] as $migration) $profileDb->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
$profileAuth = new Finados\VoceroAuth($profileDb, $profileConfig);
$profilePassword = bin2hex(random_bytes(16));
$profileAuth->register('owner@example.invalid', $profilePassword, true, '192.0.2.1');
$profileAccountId = (int) $profileDb->query('SELECT id FROM vocero_accounts')->fetchColumn();
$profile = new Finados\VoceroProfile($profileDb, $profileConfig);
$profileUpload = profile_upload($profileRoot);
$profileFiles = ['fotografia' => $profileUpload];
same(null, $profile->get($profileAccountId));
throws(fn () => $profile->photo($profileAccountId), OutOfBoundsException::class);
throws(fn () => $profile->save($profileAccountId, profile_fields(), [], '192.0.2.1', 'Prueba'), InvalidArgumentException::class);
$profileFirst = $profile->save($profileAccountId, profile_fields(), $profileFiles, '192.0.2.1', 'Prueba');
$profileStoredPhoto = $profileDb->query('SELECT * FROM vocero_photos')->fetch();
$profileSecond = $profile->save($profileAccountId, profile_fields(), $profileFiles, '192.0.2.1', 'Prueba');
same($profileFirst, $profileSecond);
same(1, (int) $profileDb->query('SELECT COUNT(*) FROM vocero_accounts')->fetchColumn());
same(1, (int) $profileDb->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same(1, (int) $profileDb->query('SELECT COUNT(*) FROM vocero_account_links')->fetchColumn());
same(1, (int) $profileDb->query('SELECT COUNT(*) FROM vocero_photos')->fetchColumn());
same($profileStoredPhoto, $profileDb->query('SELECT * FROM vocero_photos')->fetch());
same(1, count(glob($profileRoot . '/voceros-photos/files/*')));
same([], glob($profileRoot . '/voceros-photos/staging/*'));

$profileOwn = $profile->get($profileAccountId);
same('owner@example.invalid', $profileOwn['email']);
same('Nuevo', $profileOwn['status']);
same(str_repeat('1', 32), $profileOwn['submission_id']);
same(['available' => true, 'width' => 80, 'height' => 100, 'created_at' => $profileStoredPhoto['created_at']], $profileOwn['photo']);
same('image/jpeg', getimagesizefromstring($profile->photo($profileAccountId))['mime']);
foreach (['storage_key', 'sha256', 'bytes', 'consents', 'notes', 'email_enc', 'account_id', 'id'] as $privateField) same(false, array_key_exists($privateField, $profileOwn));
same(false, str_contains(json_encode($profileOwn), $profileStoredPhoto['storage_key']));

$profileEvidence = $profileDb->query('SELECT * FROM vocero_consents ORDER BY id')->fetchAll();
$profileCatalogue = json_decode(file_get_contents(__DIR__ . '/../resources/vocero-consents.json'), true);
foreach (['policies', 'image', 'data'] as $i => $type) {
    same($profileCatalogue[$type]['version'], $profileEvidence[$i]['text_version']);
    same(hash('sha256', $profileCatalogue[$type]['text']), $profileEvidence[$i]['text_hash']);
    same(1, (int) $profileEvidence[$i]['accepted']);
}
same(['politicas', 'imagen', 'datos'], array_column($profileEvidence, 'consent_type'));

// A stable registration ID permits edits but never creates a second link or changes ownership.
$profileEdited = $profile->save($profileAccountId, profile_fields(['ciudad' => 'Ciudad Actualizada']), [], '192.0.2.1', 'Prueba');
same($profileFirst['public_id'], $profileEdited['public_id']);
same('Ciudad Actualizada', $profile->get($profileAccountId)['city']);
same($profileStoredPhoto, $profileDb->query('SELECT * FROM vocero_photos')->fetch());
same($profileEvidence, $profileDb->query('SELECT * FROM vocero_consents ORDER BY id')->fetchAll());
throws(fn () => $profile->save($profileAccountId, profile_fields(['submission_id' => str_repeat('2', 32)]), [], '192.0.2.1', 'Prueba'), InvalidArgumentException::class);
foreach (['accountId', 'account_id', 'email', 'correo', 'role', 'estado', 'status', 'public_id'] as $forged) {
    throws(fn () => $profile->save($profileAccountId, profile_fields([$forged => 'attacker']), [], '192.0.2.1', 'Prueba'), InvalidArgumentException::class);
}

// All canonical consents and the existing business validation remain server-enforced on edits.
foreach ([['cedula' => 'abc'], ['fecha_nacimiento' => '2026-02-30'], ['fecha_nacimiento' => '2099-01-01'],
    ['fecha_nacimiento' => '2020-01-01'], ['whatsapp' => '1234567890'], ['tiktok' => 'http://example.invalid'],
    ['tiktok' => ''], ['red_principal' => 'Otra'], ['vocero_previo' => 'Otra'], ['fuente_comunidad' => 'Otra'], ['retiro_kit' => 'Otra'],
    ['consentimiento_politicas' => 'No'], ['autorizacion_imagen' => 'No'], ['consentimiento_datos' => 'No'], ['ciudad' => []]] as $invalid) {
    throws(fn () => $profile->save($profileAccountId, profile_fields($invalid), [], '192.0.2.1', 'Prueba'), InvalidArgumentException::class);
}
foreach (['consentimiento_politicas', 'autorizacion_imagen', 'consentimiento_datos'] as $required) {
    $missing = profile_fields(); unset($missing[$required]);
    throws(fn () => $profile->save($profileAccountId, $missing, [], '192.0.2.1', 'Prueba'), InvalidArgumentException::class);
}
foreach ([['fotografia' => []], ['fotografia' => ['tmp_name' => ['bad']]], ['fotografia' => array_replace($profileUpload, ['error' => UPLOAD_ERR_PARTIAL])],
    ['fotografia' => array_replace($profileUpload, ['size' => -1])], ['unknown' => $profileUpload]] as $invalidFiles) {
    throws(fn () => $profile->save($profileAccountId, profile_fields(), $invalidFiles, '192.0.2.1', 'Prueba'), InvalidArgumentException::class);
}

// Photo replacement deletes only the old committed file; identical uploads are true no-ops.
$profileNewUpload = profile_upload($profileRoot, 60, 90);
$profile->save($profileAccountId, profile_fields(), ['fotografia' => $profileNewUpload], '192.0.2.1', 'Prueba');
same(false, is_file($profileRoot . '/voceros-photos/files/' . $profileStoredPhoto['storage_key']));
same(1, count(glob($profileRoot . '/voceros-photos/files/*')));
same(60, $profile->get($profileAccountId)['photo']['width']);
same(90, $profile->get($profileAccountId)['photo']['height']);
foreach (['Aprobado', 'Rechazado', 'En revisión'] as $lockedStatus) {
    $profileDb->prepare('UPDATE voceros SET status = ?')->execute([$lockedStatus]);
    throws(fn () => $profile->save($profileAccountId, profile_fields(), $profileFiles, '192.0.2.1', 'Prueba'), Finados\Forbidden::class);
    same($lockedStatus, $profile->get($profileAccountId)['status']);
}
$profileDb->exec("UPDATE voceros SET status = 'Nuevo'");

// A second account must not be able to claim an existing registration by submission ID or identity.
$profileAuth->register('second@example.invalid', $profilePassword, true, '192.0.2.2');
$profileSecondAccount = (int) $profileDb->query('SELECT MAX(id) FROM vocero_accounts')->fetchColumn();
same(null, $profile->get($profileSecondAccount));
throws(fn () => $profile->photo($profileSecondAccount), OutOfBoundsException::class);
throws(fn () => $profile->save($profileSecondAccount, profile_fields(), $profileFiles, '192.0.2.2', 'Prueba'), InvalidArgumentException::class);
same(1, (int) $profileDb->query('SELECT COUNT(*) FROM vocero_account_links')->fetchColumn());
same([], glob($profileRoot . '/voceros-photos/staging/*'));

// Failed consent, link, photo metadata and audit writes all roll back and clean this operation's staging.
foreach (['vocero_consents', 'vocero_account_links', 'vocero_photos', 'audit_log'] as $failTable) {
    $profileDb->exec("CREATE TRIGGER fail_profile BEFORE INSERT ON $failTable BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
    throws(fn () => $profile->save($profileSecondAccount, profile_fields(['submission_id' => str_repeat('2', 32), 'cedula' => '1800000002', 'whatsapp' => '0990000002']), $profileFiles, '192.0.2.2', 'Prueba'), RuntimeException::class);
    same(1, (int) $profileDb->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
    same(1, (int) $profileDb->query('SELECT COUNT(*) FROM vocero_account_links')->fetchColumn());
    same(1, count(glob($profileRoot . '/voceros-photos/files/*')));
    same([], glob($profileRoot . '/voceros-photos/staging/*'));
    same(false, $profileDb->inTransaction());
    $profileDb->exec('DROP TRIGGER fail_profile');
}

// Promote failure rolls back new rows, and commit failure removes only this operation's final file.
$secondValidFields = profile_fields(['submission_id' => str_repeat('2', 32), 'cedula' => '1800000002', 'whatsapp' => '0990000002']);
$profileDb->beforePhotoMetadata = static function () use ($profileRoot, $profileDb): void {
    same(true, $profileDb->inTransaction());
    $staged = glob($profileRoot . '/voceros-photos/staging/*'); same(1, count($staged));
    unlink($staged[0]);
};
throws(fn () => $profile->save($profileSecondAccount, $secondValidFields, $profileFiles, '192.0.2.2', 'Prueba'), RuntimeException::class);
$profileDb->beforePhotoMetadata = null;
same(1, (int) $profileDb->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
same([], glob($profileRoot . '/voceros-photos/staging/*'));
$oldCommittedPhoto = $profileDb->query('SELECT * FROM vocero_photos')->fetch();
$oldCommittedFields = $profile->get($profileAccountId);
$profileDb->beforeBegin = static function () use ($profileRoot, $profileDb): void {
    same(false, $profileDb->inTransaction());
    same(1, count(glob($profileRoot . '/voceros-photos/staging/*')));
    $lock = fopen($profileRoot . '/finados.voceros.media.lock', 'c');
    same(false, flock($lock, LOCK_EX | LOCK_NB)); fclose($lock);
};
$profileDb->beforeCommit = static function () use ($profileRoot, $oldCommittedPhoto): never {
    same([], glob($profileRoot . '/voceros-photos/staging/*'));
    same(2, count(glob($profileRoot . '/voceros-photos/files/*')));
    same(true, is_file($profileRoot . '/voceros-photos/files/' . $oldCommittedPhoto['storage_key']));
    throw new ProfileCommitFailure('Synthetic commit failure');
};
foreach ([[$profileSecondAccount, $secondValidFields], [$profileAccountId, profile_fields(['ciudad' => 'Must roll back'])]] as [$id, $fields]) {
    throws(fn () => $profile->save($id, $fields, $profileFiles, '192.0.2.2', 'Prueba'), ProfileCommitFailure::class);
    same(false, $profileDb->inTransaction());
    same($oldCommittedPhoto, $profileDb->query('SELECT * FROM vocero_photos')->fetch());
    same($oldCommittedFields, $profile->get($profileAccountId));
    same(1, (int) $profileDb->query('SELECT COUNT(*) FROM voceros')->fetchColumn());
    same(1, count(glob($profileRoot . '/voceros-photos/files/*')));
    same([], glob($profileRoot . '/voceros-photos/staging/*'));
    $lock = fopen($profileRoot . '/finados.voceros.media.lock', 'c');
    same(true, flock($lock, LOCK_EX | LOCK_NB)); flock($lock, LOCK_UN); fclose($lock);
}
$profileDb->beforeBegin = null; $profileDb->beforeCommit = null;

// A minor needs all representative data and remains pending after a permitted edit.
$minorFields = array_replace($secondValidFields, ['fecha_nacimiento' => (new DateTimeImmutable('now', new DateTimeZone('America/Guayaquil')))->modify('-17 years')->format('Y-m-d')]);
throws(fn () => $profile->save($profileSecondAccount, $minorFields, $profileFiles, '192.0.2.2', 'Prueba'), InvalidArgumentException::class);
$minorFields += ['representante_nombre' => 'Representante Sintético', 'representante_cedula' => '1800000098', 'representante_telefono' => '0990000098', 'representante_correo' => 'representative@example.invalid'];
$minorSaved = $profile->save($profileSecondAccount, $minorFields, $profileFiles, '192.0.2.2', 'Prueba');
same('Pendiente de autorización', $minorSaved['status']);
same('Representante Sintético', $profile->get($profileSecondAccount)['representative_name']);
same('Pendiente de autorización', $profile->save($profileSecondAccount, array_replace($minorFields, ['ciudad' => 'Ciudad Menor']), [], '192.0.2.2', 'Prueba')['status']);

// Restored historical consent text is retained, and current catalogue text is appended once.
$minorRow = $profileDb->query('SELECT MAX(id) FROM voceros')->fetchColumn();
$profileDb->prepare("UPDATE vocero_consents SET text_version = 'historical', text_hash = ? WHERE vocero_id = ? AND consent_type = 'datos'")->execute([hash('sha256', 'Historical data consent'), $minorRow]);
$historicalConsent = $profileDb->query("SELECT * FROM vocero_consents WHERE text_version = 'historical'")->fetch();
$profile->save($profileSecondAccount, $minorFields, [], '192.0.2.2', 'Prueba');
same($historicalConsent, $profileDb->query("SELECT * FROM vocero_consents WHERE text_version = 'historical'")->fetch());
same(4, (int) $profileDb->query('SELECT COUNT(*) FROM vocero_consents WHERE vocero_id = ' . (int) $minorRow)->fetchColumn());
$profile->save($profileSecondAccount, $minorFields, [], '192.0.2.2', 'Prueba');
same(4, (int) $profileDb->query('SELECT COUNT(*) FROM vocero_consents WHERE vocero_id = ' . (int) $minorRow)->fetchColumn());

// Deactivated or nonexistent accounts cannot read either resource or edit persisted data.
$profileDb->prepare('UPDATE vocero_accounts SET active = 0 WHERE id = ?')->execute([$profileSecondAccount]);
foreach ([$profileSecondAccount, 999999] as $invalidAccount) {
    throws(fn () => $profile->get($invalidAccount), Finados\Unauthorized::class);
    throws(fn () => $profile->photo($invalidAccount), Finados\Unauthorized::class);
    throws(fn () => $profile->save($invalidAccount, $minorFields, [], '192.0.2.2', 'Prueba'), Finados\Unauthorized::class);
}

// Queue construction uses its existing allowlist and never receives image data or storage references.
$profileCrypto = new Finados\Crypto($profileConfig);
$profileDb->beginTransaction();
(new Finados\SheetsOutbox($profileDb, $profileCrypto))->ensure($profileFirst['public_id']);
$profileDb->commit();
$profileSheetPayload = $profileCrypto->decrypt($profileDb->query('SELECT payload_enc FROM sheets_outbox')->fetchColumn());
foreach (['fotografia', 'storage_key', 'sha256', 'voceros-photos', 'image/jpeg'] as $photoLeak) same(false, str_contains($profileSheetPayload, $photoLeak));
foreach ($profileDb->query('SELECT metadata_json FROM audit_log') as $log) {
    foreach (['fotografia', 'storage_key', 'sha256', 'voceros-photos', 'image/jpeg'] as $photoLeak) same(false, str_contains($log['metadata_json'], $photoLeak));
}

// Three legacy rows remain byte-for-byte unchanged and never acquire an implicit account or photo.
$profileRepo = new Finados\VocerosRepository($profileDb, $profileCrypto);
$legacyConsents = array_map(static fn (string $type): array => [
    'consent_type' => $type, 'accepted' => 1, 'text_version' => 'historical', 'text_hash' => hash('sha256', 'historical-' . $type),
    'accepted_at' => '2025-01-01 00:00:00', 'ip' => '192.0.2.10', 'user_agent' => 'Prueba', 'source_url' => 'https://example.invalid/', 'method' => 'import',
], ['politicas', 'imagen', 'datos']);
$legacyIds = [];
for ($i = 10; $i <= 12; $i++) {
    $legacyRecord = Finados\PublicRegistration::validate(profile_fields(['submission_id' => sprintf('%032x', $i), 'cedula' => sprintf('180000%04d', $i), 'whatsapp' => sprintf('099000%04d', $i)]), 'historical' . $i . '@example.invalid');
    $legacyIds[] = $profileRepo->create($legacyRecord, $legacyConsents);
}
$legacySnapshot = array_map(fn (string $id): array => $profileRepo->find($id), $legacyIds);
$profileAuth->register('historical10@example.invalid', $profilePassword, true, '192.0.2.10');
$legacyAccount = (int) $profileDb->query('SELECT MAX(id) FROM vocero_accounts')->fetchColumn();
same(null, $profile->get($legacyAccount));
throws(fn () => $profile->photo($legacyAccount), OutOfBoundsException::class);
throws(fn () => $profile->save($legacyAccount, profile_fields(['submission_id' => str_repeat('f', 32), 'cedula' => '1800000100', 'whatsapp' => '0990000100']), $profileFiles, '192.0.2.10', 'Prueba'), Finados\DuplicateRegistration::class);
same($legacySnapshot, array_map(fn (string $id): array => $profileRepo->find($id), $legacyIds));
same(2, (int) $profileDb->query('SELECT COUNT(*) FROM vocero_account_links')->fetchColumn());
same(2, (int) $profileDb->query('SELECT COUNT(*) FROM vocero_photos')->fetchColumn());

// A registration appearing between the profile precheck and repository insert must never be adopted.
$profileAuth->register('racing@example.invalid', $profilePassword, true, '192.0.2.30');
$racingAccount = (int) $profileDb->query('SELECT MAX(id) FROM vocero_accounts')->fetchColumn();
$racingFields = profile_fields(['submission_id' => str_repeat('e', 32), 'cedula' => '1800000030', 'whatsapp' => '0990000030']);
$profileDb->beforeSubmissionLookup = static function () use ($profileDb, $profileRepo, $racingFields, $legacyConsents): void {
    $profileDb->beforeSubmissionLookup = null;
    $profileRepo->create(Finados\PublicRegistration::validate($racingFields, 'racing@example.invalid'), $legacyConsents);
};
throws(fn () => $profile->save($racingAccount, $racingFields, $profileFiles, '192.0.2.30', 'Prueba'), InvalidArgumentException::class);
same(null, $profile->get($racingAccount));
same(2, (int) $profileDb->query('SELECT COUNT(*) FROM vocero_account_links')->fetchColumn());
same([], glob($profileRoot . '/voceros-photos/staging/*'));

// Business-rule parity against the shipped anonymous endpoint at real acceptance boundaries.
require_once __DIR__ . '/../../../public/api/voceros/index.php';
$age16 = (new DateTimeImmutable('now', new DateTimeZone('America/Guayaquil')))->modify('-16 years')->format('Y-m-d');
$rep = ['representante_nombre' => 'Representante Sintético', 'representante_cedula' => '1800000080', 'representante_telefono' => '0990000080', 'representante_correo' => 'rep@example.invalid'];
$parityCases = [
    [[], true], [['nombre_completo' => '1234'], false], [['nombre_completo' => '12345'], true],
    [['nombre_completo' => str_repeat('ñ', 80)], true], [['nombre_completo' => str_repeat('ñ', 81)], false],
    [['ciudad' => str_repeat('a', 100)], true], [['ciudad' => str_repeat('a', 101)], false],
    [['fecha_nacimiento' => $age16] + $rep, true], [['fecha_nacimiento' => $age16], false],
    [['fecha_nacimiento' => '2020-01-01'], false], [['fecha_nacimiento' => '2099-01-01'], false], [['fecha_nacimiento' => '2000-02-30'], false],
    [['cedula' => '1800000001'], true], [['cedula' => '180000001'], false], [['cedula' => '180000000a'], false],
    [['whatsapp' => '0990000001'], true], [['whatsapp' => '+593990000001'], false],
    [['tiktok' => '', 'instagram' => 'https://example.invalid/profile'], true], [['tiktok' => ''], false],
    [['tiktok' => 'http://example.invalid/profile'], false], [['tiktok' => 'javascript:alert(1)'], false],
    [['red_principal' => 'YouTube'], false], [['retiro_kit' => 'Inventado'], false], [['fuente_comunidad' => 'Inventado'], false],
    [['consentimiento_politicas' => 'No'], false], [['autorizacion_imagen' => 'No'], false], [['consentimiento_datos' => 'No'], false],
];
foreach ($parityCases as [$overrides, $accepted]) {
    $fields = profile_fields($overrides);
    $valid = true;
    try { Finados\PublicRegistration::validate($fields, 'parity@example.invalid'); } catch (InvalidArgumentException) { $valid = false; }
    same($accepted, $valid);
    $parityDb = Finados\Database::connect($profileConfig);
    foreach (['001_initial', '002_sheets_outbox'] as $migration) $parityDb->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
    $parityRepo = new Finados\VocerosRepository($parityDb, $profileCrypto);
    $parityResponse = voceros_handle_request(['REQUEST_METHOD' => 'POST', 'REMOTE_ADDR' => '192.0.2.15'], $fields + ['correo' => 'parity@example.invalid'],
        fn (): array => ['repository' => $parityRepo, 'privateDirectory' => $profileRoot, 'config' => ['policiesVersion' => 'p1', 'thermometerVersion' => 't1', 'imageVersion' => 'i1', 'privacyVersion' => 'd1']], fn (): string => 'synced');
    same($accepted ? 200 : 422, $parityResponse['status']);
}

// Independent PHP processes must serialize the same account and retain exactly one final photo.
$concurrentRoot = profile_root();
$concurrentConfigPath = $concurrentRoot . '/config.json';
$concurrentOptions = json_decode(file_get_contents($profileConfigPath), true);
$concurrentOptions['databaseDsn'] = 'sqlite:' . $concurrentRoot . '/db.sqlite';
file_put_contents($concurrentConfigPath, json_encode($concurrentOptions));
$concurrentConfig = Finados\Config::fromFile($concurrentConfigPath);
$concurrentPdo = Finados\Database::connect($concurrentConfig);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts'] as $migration) $concurrentPdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
(new Finados\VoceroAuth($concurrentPdo, $concurrentConfig))->register('concurrent@example.invalid', $profilePassword, true, '192.0.2.20');
$concurrentUpload = profile_upload($concurrentRoot);
$profileWorker = 'require ' . var_export(realpath(__DIR__ . '/../src/Router.php'), true) . ';'
    . '$config = Finados\\Config::fromFile($argv[1]); $pdo = Finados\\Database::connect($config);'
    . '$result = (new Finados\\VoceroProfile($pdo, $config))->save(1, json_decode($argv[2], true), ["fotografia" => json_decode($argv[3], true)], "192.0.2.20", "Prueba");'
    . 'echo json_encode($result);';
$profileWorkers = [];
for ($i = 0; $i < 4; $i++) {
    $process = proc_open([PHP_BINARY, '-r', $profileWorker, $concurrentConfigPath, json_encode(profile_fields()), json_encode($concurrentUpload)], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
    $profileWorkers[] = [$process, $pipes];
}
$concurrentIds = [];
foreach ($profileWorkers as [$process, $pipes]) {
    $output = stream_get_contents($pipes[1]); $error = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]); same(0, proc_close($process)); same('', $error);
    $concurrentIds[] = json_decode($output, true)['public_id'];
}
same(1, count(array_unique($concurrentIds)));
foreach (['voceros', 'vocero_account_links', 'vocero_photos'] as $table) same(1, (int) $concurrentPdo->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn());
same(3, (int) $concurrentPdo->query('SELECT COUNT(*) FROM vocero_consents')->fetchColumn());
same(1, count(glob($concurrentRoot . '/voceros-photos/files/*')));
same([], glob($concurrentRoot . '/voceros-photos/staging/*'));

// A lost commit acknowledgement must retain the file already referenced by committed metadata.
$profileDb->afterCommit = static function (): never { throw new ProfileCommitFailure('Synthetic lost commit acknowledgement'); };
throws(fn () => $profile->save($racingAccount, $racingFields, $profileFiles, '192.0.2.30', 'Prueba'), ProfileCommitFailure::class);
$profileDb->afterCommit = null;
same(false, $profileDb->inTransaction());
$unknownCommitted = $profile->get($racingAccount);
same(true, $unknownCommitted !== null);
same('image/jpeg', getimagesizefromstring($profile->photo($racingAccount))['mime']);
same($unknownCommitted, $profile->save($racingAccount, $racingFields, $profileFiles, '192.0.2.30', 'Prueba'));
same([], glob($profileRoot . '/voceros-photos/staging/*'));

// A rollback with no acknowledgement also cannot authorize deletion of a promoted file.
$unknownOldPhoto = $profile->photo($profileAccountId);
$unknownOldRow = $profileDb->query('SELECT * FROM vocero_photos WHERE vocero_id = 1')->fetch();
$profileDb->beforeCommit = static function (): never { throw new ProfileCommitFailure('Synthetic commit failure'); };
$profileDb->rollbackFails = true;
throws(fn () => $profile->save($profileAccountId, profile_fields(), $profileFiles, '192.0.2.1', 'Prueba'), ProfileCommitFailure::class);
$profileDb->beforeCommit = null; $profileDb->rollbackFails = false;
$unknownNewRow = $profileDb->query('SELECT * FROM vocero_photos WHERE vocero_id = 1')->fetch();
same(true, is_file($profileRoot . '/voceros-photos/files/' . $unknownNewRow['storage_key']));
same(true, is_file($profileRoot . '/voceros-photos/files/' . $unknownOldRow['storage_key']));
$profileDb->rollBack();
same($unknownOldPhoto, $profile->photo($profileAccountId));
// Only this test now proves rollback; remove its deliberate orphan from its isolated fixture.
(new Finados\PhotoStorage($profileConfig, $profileCrypto))->delete($unknownNewRow['storage_key']);

// Pause a real reader after fetching metadata while a separate process replaces the same photo.
$readerWorker = <<<'PHP'
require $argv[1];
class PausedPhotoStatement extends PDOStatement {
    public function fetch(int $mode = PDO::FETCH_DEFAULT, int $cursorOrientation = PDO::FETCH_ORI_NEXT, int $cursorOffset = 0): mixed {
        $row = parent::fetch($mode, $cursorOrientation, $cursorOffset);
        if ($this->queryString === 'SELECT * FROM vocero_photos WHERE vocero_id = ?') {
            $this->closeCursor();
            fwrite(STDOUT, "metadata\n"); fflush(STDOUT);
            if (fgets(STDIN) === false) throw new RuntimeException('Reader was not resumed.');
        }
        return $row;
    }
}
$config = Finados\Config::fromFile($argv[2]); $pdo = Finados\Database::connect($config);
$pdo->setAttribute(PDO::ATTR_STATEMENT_CLASS, [PausedPhotoStatement::class]);
try {
    $jpeg = (new Finados\VoceroProfile($pdo, $config))->photo(1);
    $size = getimagesizefromstring($jpeg);
    echo json_encode(['width' => $size[0], 'height' => $size[1], 'mime' => $size['mime']]);
} catch (Throwable) { echo json_encode(['failed' => true]); }
PHP;
$readerProcess = proc_open([PHP_BINARY, '-r', $readerWorker, realpath(__DIR__ . '/../src/Router.php'), $concurrentConfigPath], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $readerPipes);
same("metadata\n", fgets($readerPipes[1]));
$readerLockProbe = fopen($concurrentRoot . '/finados.voceros.media.lock', 'c');
$readerHoldsLock = !flock($readerLockProbe, LOCK_EX | LOCK_NB);
if (!$readerHoldsLock) flock($readerLockProbe, LOCK_UN);
fclose($readerLockProbe);
$replacementUpload = profile_upload($concurrentRoot, 70, 90);
$writerProcess = proc_open([PHP_BINARY, '-r', $profileWorker, $concurrentConfigPath, json_encode(profile_fields()), json_encode($replacementUpload)], [1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $writerPipes);
if ($readerHoldsLock) {
    $deadline = microtime(true) + 5;
    while (glob($concurrentRoot . '/voceros-photos/staging/*') === [] && microtime(true) < $deadline) usleep(10000);
    same(1, count(glob($concurrentRoot . '/voceros-photos/staging/*')));
    same(true, proc_get_status($writerProcess)['running']);
} else {
    // Without the read lock, force replacement to finish before allowing the stale read to continue.
    $writerOutput = stream_get_contents($writerPipes[1]); $writerError = stream_get_contents($writerPipes[2]);
}
fwrite($readerPipes[0], "continue\n"); fclose($readerPipes[0]);
$readerOutput = stream_get_contents($readerPipes[1]); $readerError = stream_get_contents($readerPipes[2]);
fclose($readerPipes[1]); fclose($readerPipes[2]); same(0, proc_close($readerProcess)); same('', $readerError);
if ($readerHoldsLock) {
    $writerOutput = stream_get_contents($writerPipes[1]); $writerError = stream_get_contents($writerPipes[2]);
}
fclose($writerPipes[1]); fclose($writerPipes[2]); same(0, proc_close($writerProcess)); same('', $writerError);
same(['width' => 80, 'height' => 100, 'mime' => 'image/jpeg'], json_decode($readerOutput, true));
same(70, json_decode($writerOutput, true)['photo']['width']);
$afterReplacement = (new Finados\VoceroProfile($concurrentPdo, $concurrentConfig))->photo(1);
same(70, getimagesizefromstring($afterReplacement)[0]);
same(0600, fileperms($concurrentRoot . '/finados.voceros.media.lock') & 0777);

// A valid account email at the 254-byte boundary must remain usable for a complete profile.
$longProfileEmail = str_repeat('a', 64) . '@' . str_repeat('b', 63) . '.' . str_repeat('c', 63) . '.' . str_repeat('d', 53) . '.invalid';
same(254, strlen($longProfileEmail));
$profileAuth->register($longProfileEmail, $profilePassword, true, '192.0.2.70');
$longEmailAccount = (int) $profileDb->query('SELECT MAX(id) FROM vocero_accounts')->fetchColumn();
$longEmailFields = profile_fields(['submission_id' => str_repeat('a', 32), 'cedula' => '1800000070', 'whatsapp' => '0990000070']);
same($longProfileEmail, $profile->save($longEmailAccount, $longEmailFields, $profileFiles, '192.0.2.70', 'Prueba')['email']);
throws(fn () => Finados\PublicRegistration::validate($longEmailFields, $longProfileEmail . 'a'), InvalidArgumentException::class);

// Lock failures expose no filesystem warning/path and never follow a link to change another file's mode.
$lockPath = $concurrentRoot . '/finados.voceros.media.lock';
rename($lockPath, $lockPath . '.saved');
$lockTarget = $concurrentRoot . '/lock-target'; file_put_contents($lockTarget, 'untouched'); chmod($lockTarget, 0640);
$concurrentProfile = new Finados\VoceroProfile($concurrentPdo, $concurrentConfig);
foreach (['symlink', 'directory'] as $badLock) {
    if ($badLock === 'symlink') symlink($lockTarget, $lockPath); else mkdir($lockPath, 0700);
    $lockError = null;
    try { $concurrentProfile->photo(1); } catch (RuntimeException $error) { $lockError = $error->getMessage(); }
    same(true, is_string($lockError)); same(false, str_contains($lockError, $concurrentRoot)); same(false, str_contains($lockError, 'fopen'));
    same('untouched', file_get_contents($lockTarget)); same(0640, fileperms($lockTarget) & 0777);
    if ($badLock === 'symlink') unlink($lockPath); else rmdir($lockPath);
}
rename($lockPath . '.saved', $lockPath);
same('image/jpeg', getimagesizefromstring($concurrentProfile->photo(1))['mime']);
