<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/VoceroAuth.php';

// Simulate MySQL's lock protocol over real SQLite transactions and authentication SQL.
final class VoceroAuthMysqlProtocol extends PDO
{
    public array $events = [];
    public bool $denyAcquire = false;
    public ?Throwable $acquireFailure = null;
    public ?Throwable $releaseFailure = null;

    public function getAttribute(int $attribute): mixed
    {
        return $attribute === PDO::ATTR_DRIVER_NAME ? 'mysql' : parent::getAttribute($attribute);
    }

    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $isLock = str_starts_with($query, 'SELECT GET_LOCK(') || str_starts_with($query, 'SELECT RELEASE_LOCK(');
        $statement = parent::prepare($isLock ? 'SELECT 1' : preg_replace('/ FOR UPDATE$/D', '', $query), $options);
        $statement->originalSql = $query;
        return $statement;
    }

    public function beginTransaction(): bool
    {
        $this->events[] = ['BEGIN'];
        return parent::beginTransaction();
    }

    public function commit(): bool
    {
        $this->events[] = ['COMMIT'];
        return parent::commit();
    }

    public function rollBack(): bool
    {
        $this->events[] = ['ROLLBACK'];
        return parent::rollBack();
    }
}

final class VoceroAuthMysqlStatement extends PDOStatement
{
    public string $originalSql = '';
    private mixed $lockResult = null;

    protected function __construct(private VoceroAuthMysqlProtocol $owner) {}

    public function execute(?array $params = null): bool
    {
        if (str_starts_with($this->originalSql, 'SELECT GET_LOCK(')) {
            $this->owner->events[] = ['GET', $params[0] ?? null];
            if ($this->owner->acquireFailure !== null) throw $this->owner->acquireFailure;
            $this->lockResult = $this->owner->denyAcquire ? 0 : 1;
            return true;
        }
        if (str_starts_with($this->originalSql, 'SELECT RELEASE_LOCK(')) {
            $this->owner->events[] = ['RELEASE', $params[0] ?? null];
            if ($this->owner->releaseFailure !== null) throw $this->owner->releaseFailure;
            $this->lockResult = 1;
            return true;
        }
        return parent::execute($params);
    }

    public function fetchColumn(int $column = 0): mixed
    {
        return $this->lockResult ?? parent::fetchColumn($column);
    }
}

function close_vocero_lock_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) Finados\Http::destroySession();
    session_id('');
    $_SESSION = [];
}

$lockConfig = Finados\Config::fromFile(temp_file(json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
    'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('e', 32)),
    'hmacKey' => base64_encode(str_repeat('h', 32)),
], JSON_THROW_ON_ERROR)));
$lockPdo = new VoceroAuthMysqlProtocol('sqlite::memory:', null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$lockPdo->setAttribute(PDO::ATTR_STATEMENT_CLASS, [VoceroAuthMysqlStatement::class, [$lockPdo]]);
foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts'] as $migration) {
    $lockPdo->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
}
$lockAuth = new Finados\VoceroAuth($lockPdo, $lockConfig, static fn (): int => 1800000000);
$lockPassword = 'contraseña de protocolo';
$lockAuth->register('first@example.invalid', $lockPassword, true, '192.0.2.60');
$lockAuth->register('second@example.invalid', $lockPassword, true, '192.0.2.60');

// Two different accounts from one IP must take the same opaque lock before their quota transaction.
$lockPdo->events = [];
same('vocero', $lockAuth->login('first@example.invalid', $lockPassword, '192.0.2.60')['user']['role']);
$firstEvents = $lockPdo->events;
$firstLockName = $firstEvents[0][1] ?? null;
same([['GET', $firstLockName], ['BEGIN'], ['COMMIT'], ['RELEASE', $firstLockName]], $firstEvents);
same(true, is_string($firstLockName));
same('finados.vocero.ip.140382b91efea1ad55296af18c6151b27be96541280ff8', $firstLockName);
same(64, strlen($firstLockName));
same(false, str_contains($firstLockName, '192.0.2.60'));
close_vocero_lock_session();

$lockPdo->events = [];
same('vocero', $lockAuth->login('second@example.invalid', $lockPassword, '192.0.2.60')['user']['role']);
same($firstLockName, $lockPdo->events[0][1] ?? null);
same(['GET', 'BEGIN', 'COMMIT', 'RELEASE'], array_map(static fn (array $event): string => $event[0], $lockPdo->events));
close_vocero_lock_session();

$lockPdo->events = [];
same('vocero', $lockAuth->login('second@example.invalid', $lockPassword, '192.0.2.61')['user']['role']);
same(false, hash_equals($firstLockName, $lockPdo->events[0][1] ?? ''));
close_vocero_lock_session();

// A RELEASE failure after COMMIT is cleanup-only: the authenticated result remains authoritative.
$lockPdo->events = [];
$lockPdo->releaseFailure = new RuntimeException('Synthetic private release detail');
$lockErrorLog = temp_file('');
$lockPreviousErrorLog = ini_get('error_log');
ini_set('error_log', $lockErrorLog);
try {
    same('vocero', $lockAuth->login('first@example.invalid', $lockPassword, '192.0.2.62')['user']['role']);
} finally {
    ini_set('error_log', $lockPreviousErrorLog);
}
same(['GET', 'BEGIN', 'COMMIT', 'RELEASE'], array_map(static fn (array $event): string => $event[0], $lockPdo->events));
same(true, str_contains(file_get_contents($lockErrorLog), 'Finados vocero login lock cleanup failed.'));
same(false, str_contains(file_get_contents($lockErrorLog), 'Synthetic private release detail'));
close_vocero_lock_session();
$lockPdo->releaseFailure = null;

// Even an uncertain or denied acquisition gets a best-effort release and opens no transaction.
foreach (['failure', 'denied'] as $mode) {
    $lockPdo->events = [];
    $lockPdo->acquireFailure = $mode === 'failure' ? new RuntimeException('Synthetic private acquire detail') : null;
    $lockPdo->denyAcquire = $mode === 'denied';
    throws(fn () => $lockAuth->login('first@example.invalid', $lockPassword, '192.0.2.63'), RuntimeException::class);
    same(['GET', 'RELEASE'], array_map(static fn (array $event): string => $event[0], $lockPdo->events));
    same(false, $lockPdo->inTransaction());
    close_vocero_lock_session();
}
$lockPdo->acquireFailure = null;
$lockPdo->denyAcquire = false;
