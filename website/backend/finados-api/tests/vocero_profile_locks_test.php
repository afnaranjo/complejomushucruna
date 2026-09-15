<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

// Only the named-lock protocol is simulated. All profile SQL, transactions and files are real SQLite/GD.
final class ProfileMysqlProtocol extends PDO
{
    public array $events = [];
    public ?string $failAcquire = null;
    public ?string $failRelease = null;
    public bool $failCommit = false;
    public function getAttribute(int $attribute): mixed
    {
        return $attribute === PDO::ATTR_DRIVER_NAME ? 'mysql' : parent::getAttribute($attribute);
    }
    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $lockQuery = str_starts_with($query, 'SELECT GET_LOCK(') || str_starts_with($query, 'SELECT RELEASE_LOCK(');
        $statement = parent::prepare($lockQuery ? 'SELECT 1' : preg_replace('/ FOR UPDATE$/D', '', $query), $options);
        $statement->originalSql = $query;
        return $statement;
    }
    public function beginTransaction(): bool { $this->events[] = ['BEGIN']; return parent::beginTransaction(); }
    public function commit(): bool
    {
        $this->events[] = ['COMMIT'];
        if ($this->failCommit) throw new RuntimeException('Synthetic commit failure');
        return parent::commit();
    }
    public function rollBack(): bool { $this->events[] = ['ROLLBACK']; return parent::rollBack(); }
}
final class ProfileMysqlProtocolStatement extends PDOStatement
{
    public string $originalSql = '';
    private mixed $lockResult = null;
    protected function __construct(private ProfileMysqlProtocol $owner) {}
    public function execute(?array $params = null): bool
    {
        if (str_starts_with($this->originalSql, 'SELECT GET_LOCK(')) {
            $this->owner->events[] = ['GET', $params[0]];
            $this->lockResult = $params[0] === $this->owner->failAcquire ? 0 : 1;
            return true;
        }
        if (str_starts_with($this->originalSql, 'SELECT RELEASE_LOCK(')) {
            $this->owner->events[] = ['RELEASE', $params[0]];
            if ($params[0] === $this->owner->failRelease) throw new RuntimeException('Synthetic private SQL detail');
            $this->lockResult = 1;
            return true;
        }
        if (str_contains($this->originalSql, 'cedula_idx = ? OR email_idx = ? OR whatsapp_idx = ?')) $this->owner->events[] = ['IDENTITY'];
        return parent::execute($params);
    }
    public function fetchColumn(int $column = 0): mixed
    {
        return $this->lockResult !== null ? $this->lockResult : parent::fetchColumn($column);
    }
}
$protocolRoot = tempnam(sys_get_temp_dir(), 'finados-lock-protocol-'); unlink($protocolRoot); mkdir($protocolRoot, 0700);
register_shutdown_function(static function () use ($protocolRoot): void {
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($protocolRoot, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST) as $entry) $entry->isDir() && !$entry->isLink() ? rmdir($entry->getPathname()) : unlink($entry->getPathname());
    rmdir($protocolRoot);
});
file_put_contents($protocolRoot . '/config.json', json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
]));
$protocolConfig = Finados\Config::fromFile($protocolRoot . '/config.json');
$protocolPdo = new ProfileMysqlProtocol('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$protocolPdo->setAttribute(PDO::ATTR_STATEMENT_CLASS, [ProfileMysqlProtocolStatement::class, [$protocolPdo]]);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts'] as $migration) $protocolPdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
(new Finados\VoceroAuth($protocolPdo, $protocolConfig))->register('protocol@example.invalid', bin2hex(random_bytes(16)), true, '192.0.2.50');
$protocolFields = ['submission_id' => str_repeat('5', 32), 'nombre_completo' => 'Persona Sintética', 'cedula' => '1800000050',
    'fecha_nacimiento' => '2000-01-01', 'whatsapp' => '0990000050', 'ciudad' => 'Ciudad Prueba', 'tiktok' => 'https://example.invalid/profile',
    'red_principal' => 'TikTok', 'vocero_previo' => 'No, es mi primera vez', 'fuente_comunidad' => 'Facebook', 'retiro_kit' => 'En la oficina',
    'consentimiento_politicas' => 'Sí', 'autorizacion_imagen' => 'Sí', 'consentimiento_datos' => 'Sí'];
$protocolImage = imagecreatetruecolor(60, 80); imagejpeg($protocolImage, $protocolRoot . '/upload.jpg');
if (PHP_VERSION_ID < 80500) imagedestroy($protocolImage);
$protocolFiles = ['fotografia' => ['name' => 'test.jpg', 'type' => 'image/jpeg', 'tmp_name' => $protocolRoot . '/upload.jpg', 'size' => filesize($protocolRoot . '/upload.jpg'), 'error' => UPLOAD_ERR_OK]];
$protocolProfile = new Finados\VoceroProfile($protocolPdo, $protocolConfig);
$protocolPdo->events = [];
$protocolSaved = $protocolProfile->save(1, $protocolFields, $protocolFiles, '192.0.2.50', 'Prueba');
same([['GET', 'finados.voceros.public-registration'], ['GET', 'finados.voceros.media'], ['BEGIN'], ['IDENTITY'], ['COMMIT'], ['RELEASE', 'finados.voceros.media'], ['RELEASE', 'finados.voceros.public-registration']], $protocolPdo->events);
$protocolPdo->events = [];
same('image/jpeg', getimagesizefromstring($protocolProfile->photo(1))['mime']);
same([['GET', 'finados.voceros.media'], ['RELEASE', 'finados.voceros.media']], $protocolPdo->events);

$protocolPdo->events = []; $protocolPdo->failAcquire = 'finados.voceros.media';
throws(fn () => $protocolProfile->save(1, $protocolFields, $protocolFiles, '192.0.2.50', 'Prueba'), RuntimeException::class);
same([['GET', 'finados.voceros.public-registration'], ['GET', 'finados.voceros.media'], ['RELEASE', 'finados.voceros.media'], ['RELEASE', 'finados.voceros.public-registration']], $protocolPdo->events);
same([], glob($protocolRoot . '/voceros-photos/staging/*'));
$protocolPdo->failAcquire = null;

$protocolPdo->events = []; $protocolPdo->failCommit = true;
throws(fn () => $protocolProfile->save(1, array_replace($protocolFields, ['ciudad' => 'Must roll back']), [], '192.0.2.50', 'Prueba'), RuntimeException::class);
same([['GET', 'finados.voceros.public-registration'], ['GET', 'finados.voceros.media'], ['BEGIN'], ['IDENTITY'], ['COMMIT'], ['ROLLBACK'], ['RELEASE', 'finados.voceros.media'], ['RELEASE', 'finados.voceros.public-registration']], $protocolPdo->events);
same('Ciudad Prueba', $protocolProfile->get(1)['city']);
$protocolPdo->failCommit = false;

// A release failure cannot skip the remaining named lock, and no underlying SQL detail escapes.
$protocolPdo->events = []; $protocolPdo->failRelease = 'finados.voceros.media';
$protocolReleaseError = null;
try { $protocolProfile->save(1, $protocolFields, [], '192.0.2.50', 'Prueba'); } catch (RuntimeException $error) { $protocolReleaseError = $error->getMessage(); }
same(true, is_string($protocolReleaseError)); same(false, str_contains($protocolReleaseError, 'Synthetic private SQL detail'));
same([['RELEASE', 'finados.voceros.media'], ['RELEASE', 'finados.voceros.public-registration']], array_slice($protocolPdo->events, -2));
$protocolPdo->failRelease = null;

// The anonymous path keeps the same deduplication lock through its identity check and commit.
$protocolPdo->events = [];
$protocolCrypto = new Finados\Crypto($protocolConfig);
$protocolRepository = new Finados\VocerosRepository($protocolPdo, $protocolCrypto);
$anonymousFields = array_replace($protocolFields, ['submission_id' => str_repeat('6', 32), 'cedula' => '1800000060', 'whatsapp' => '0990000060']);
$anonymousConsents = $protocolRepository->find($protocolSaved['public_id'])['consents'];
$protocolRepository->createPublic(Finados\PublicRegistration::validate($anonymousFields, 'anonymous@example.invalid'), $anonymousConsents, '192.0.2.60');
same([['GET', 'finados.voceros.public-registration'], ['BEGIN'], ['IDENTITY'], ['COMMIT'], ['RELEASE', 'finados.voceros.public-registration']], $protocolPdo->events);
