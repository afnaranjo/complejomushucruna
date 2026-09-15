<?php
declare(strict_types=1);

require_once __DIR__ . '/Test.php';
require_once __DIR__ . '/../src/Router.php';

// Simulate only MySQL's named-lock protocol and failure acknowledgements. SQL and transactions
// execute on real SQLite; production service, router, authentication and audit remain real.
final class ResetMysqlProtocol extends PDO
{
    public array $events = [];
    public ?Throwable $acquireFailure = null;
    public bool $acquireDenied = false;
    public ?Throwable $releaseFailure = null;
    public ?Throwable $rollbackFailure = null;
    public ?Throwable $auditFailure = null;
    public function getAttribute(int $attribute): mixed
    {
        return $attribute === PDO::ATTR_DRIVER_NAME ? 'mysql' : parent::getAttribute($attribute);
    }
    public function prepare(string $query, array $options = []): PDOStatement|false
    {
        $namedLock = str_starts_with($query, 'SELECT GET_LOCK(') || str_starts_with($query, 'SELECT RELEASE_LOCK(');
        $statement = parent::prepare($namedLock ? 'SELECT 1' : preg_replace('/ FOR UPDATE$/D', '', $query), $options);
        $statement->originalSql = $query;
        return $statement;
    }
    public function beginTransaction(): bool { $this->events[] = 'BEGIN'; return parent::beginTransaction(); }
    public function commit(): bool { $this->events[] = 'COMMIT'; return parent::commit(); }
    public function rollBack(): bool
    {
        $this->events[] = 'ROLLBACK';
        $result = parent::rollBack();
        if ($this->rollbackFailure !== null) throw $this->rollbackFailure;
        return $result;
    }
}
final class ResetMysqlStatement extends PDOStatement
{
    public string $originalSql = '';
    private mixed $lockResult = null;
    protected function __construct(private ResetMysqlProtocol $owner) {}
    public function execute(?array $params = null): bool
    {
        if (str_starts_with($this->originalSql, 'SELECT GET_LOCK(')) {
            same(['finados.voceros.password-reset'], $params);
            $this->owner->events[] = 'GET';
            if ($this->owner->acquireFailure !== null) throw $this->owner->acquireFailure;
            $this->lockResult = $this->owner->acquireDenied ? 0 : 1;
            return true;
        }
        if (str_starts_with($this->originalSql, 'SELECT RELEASE_LOCK(')) {
            same(['finados.voceros.password-reset'], $params);
            $this->owner->events[] = 'RELEASE';
            if ($this->owner->releaseFailure !== null) throw $this->owner->releaseFailure;
            $this->lockResult = 1;
            return true;
        }
        if (str_starts_with($this->originalSql, 'INSERT INTO audit_log') && $this->owner->auditFailure !== null) throw $this->owner->auditFailure;
        return parent::execute($params);
    }
    public function fetchColumn(int $column = 0): mixed { return $this->lockResult ?? parent::fetchColumn($column); }
}
function reset_protocol_error(callable $operation): Throwable
{
    try { $operation(); } catch (Throwable $error) { return $error; }
    throw new RuntimeException('Expected an operation failure.');
}

$resetLockLog = temp_file('');
$resetLockPreviousLog = ini_get('error_log');
ini_set('error_log', $resetLockLog);
try {
    $resetLockConfig = Finados\Config::fromFile(temp_file(json_encode([
        'environment' => 'test', 'databaseDsn' => 'sqlite::memory:', 'databaseUser' => '', 'databasePassword' => '',
        'allowedOrigin' => 'https://example.invalid', 'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
    ])));
    $resetLockDb = new ResetMysqlProtocol('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $resetLockDb->setAttribute(PDO::ATTR_STATEMENT_CLASS, [ResetMysqlStatement::class, [$resetLockDb]]);
    foreach (['001_initial', '002_sheets_outbox', '003_vocero_accounts'] as $migration) $resetLockDb->exec(file_get_contents(__DIR__ . '/../migrations/' . $migration . '_sqlite.sql'));
    $resetLockOldPassword = bin2hex(random_bytes(12)); $resetLockNewPassword = bin2hex(random_bytes(12));
    $resetLockAuth = new Finados\VoceroAuth($resetLockDb, $resetLockConfig);
    $resetLockAuth->register('locks@example.invalid', $resetLockOldPassword, true, '192.0.2.50');
    $resetLockDb->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)')->execute([str_repeat('a', 32), 'admin', Finados\Auth::hashPassword($resetLockOldPassword)]);
    $resetLockId = str_repeat('b', 32);
    $resetLockDb->prepare('INSERT INTO voceros (public_id,submission_id,status,full_name,cedula_enc,cedula_idx,birth_date_enc,age_at_submission,whatsapp_enc,whatsapp_idx,email_enc,email_idx,city,main_network,previous_participation,community_source,kit_pickup,submitted_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)')->execute([$resetLockId, str_repeat('c', 32), 'Nuevo', 'Prueba sintética', 'cipher', 'index1', 'cipher', 20, 'cipher', 'index2', 'cipher', 'index3', 'Prueba', 'TikTok', 'No', 'Otro', 'Oficina']);
    $resetLockDb->exec('INSERT INTO vocero_account_links (account_id, vocero_id, created_at) VALUES (1, 1, CURRENT_TIMESTAMP)');
    $resetLockService = new Finados\VoceroPasswordReset($resetLockDb, $resetLockConfig);

    // A release exception after confirmed COMMIT must not discard the only plaintext token.
    $resetLockDb->events = [];
    $resetLockDb->releaseFailure = new RuntimeException('Synthetic sensitive RELEASE failure');
    $resetLockToken = $resetLockService->create($resetLockId, 1, '192.0.2.50');
    same(1, preg_match('/^[a-f0-9]{64}$/D', $resetLockToken));
    same(['GET', 'BEGIN', 'COMMIT', 'RELEASE'], $resetLockDb->events);
    same(hash_hmac('sha256', $resetLockToken, str_repeat('h', 32)), $resetLockDb->query('SELECT token_hash FROM vocero_password_resets')->fetchColumn());
    same(1, (int) $resetLockDb->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero.password_reset_created'")->fetchColumn());

    // The public route must complete logout and CSRF rotation after a committed consumption.
    $resetLockLogin = $resetLockAuth->login('locks@example.invalid', $resetLockOldPassword, '192.0.2.50');
    $resetLockOldSessionId = session_id();
    $resetLockDb->events = [];
    $resetLockRouter = new Finados\Router($resetLockConfig, $resetLockDb);
    $resetLockResponse = $resetLockRouter->handle('POST', '/api/vocero/auth/reset', [
        'HTTP_ORIGIN' => 'https://example.invalid', 'REMOTE_ADDR' => '192.0.2.50', 'CONTENT_TYPE' => 'application/json', 'HTTP_X_CSRF_TOKEN' => $resetLockLogin['csrf'],
    ], json_encode(['token' => $resetLockToken, 'password' => $resetLockNewPassword]));
    same(200, $resetLockResponse->status);
    same(true, json_decode($resetLockResponse->body, true)['ok']);
    same(false, isset($_SESSION['vocero_account_id']));
    same(false, session_id() === $resetLockOldSessionId);
    same(false, json_decode($resetLockResponse->body, true)['csrf'] === $resetLockLogin['csrf']);
    same(['GET', 'BEGIN', 'COMMIT', 'RELEASE'], $resetLockDb->events);
    same(true, password_verify($resetLockNewPassword, $resetLockDb->query('SELECT password_hash FROM vocero_accounts')->fetchColumn()));
    same(true, is_string($resetLockDb->query('SELECT consumed_at FROM vocero_password_resets')->fetchColumn()));
    same(1, (int) $resetLockDb->query("SELECT COUNT(*) FROM audit_log WHERE event_type = 'vocero.password_reset_consumed'")->fetchColumn());

    // Cleanup must retain the original operation exception, even if rollback acknowledgement fails.
    foreach ([false, true] as $failRollback) {
        $resetLockDb->events = [];
        $resetLockDb->auditFailure = new RuntimeException('Primary operation failure');
        $resetLockDb->rollbackFailure = $failRollback ? new RuntimeException('Synthetic sensitive ROLLBACK failure') : null;
        same($resetLockDb->auditFailure, reset_protocol_error(fn () => $resetLockService->create($resetLockId, 1, '192.0.2.50')));
        same(['GET', 'BEGIN', 'ROLLBACK', 'RELEASE'], $resetLockDb->events);
        same(1, (int) $resetLockDb->query('SELECT COUNT(*) FROM vocero_password_resets')->fetchColumn());
        same(false, $resetLockDb->inTransaction());
    }
    $resetLockDb->auditFailure = $resetLockDb->rollbackFailure = null;

    // Failed acquisition is also primary; release attempts cannot replace its exception.
    $resetLockDb->events = [];
    $resetLockDb->acquireFailure = new RuntimeException('Primary acquisition failure');
    same($resetLockDb->acquireFailure, reset_protocol_error(fn () => $resetLockService->create($resetLockId, 1, '192.0.2.50')));
    same(['GET', 'RELEASE'], $resetLockDb->events);
    $resetLockDb->acquireFailure = null; $resetLockDb->acquireDenied = true;
    $resetLockError = reset_protocol_error(fn () => $resetLockService->create($resetLockId, 1, '192.0.2.50'));
    same(RuntimeException::class, $resetLockError::class);
    same(false, $resetLockError === $resetLockDb->releaseFailure);
    same(1, (int) $resetLockDb->query('SELECT COUNT(*) FROM vocero_password_resets')->fetchColumn());

    $resetLockOutput = file_get_contents($resetLockLog);
    same(true, str_contains($resetLockOutput, 'Finados password reset lock cleanup failed.'));
    same(true, str_contains($resetLockOutput, 'Finados password reset rollback cleanup failed.'));
    foreach ([$resetLockToken, $resetLockNewPassword, 'Synthetic sensitive', 'Primary operation', 'Primary acquisition'] as $sensitive) same(false, str_contains($resetLockOutput, $sensitive));
} finally {
    ini_set('error_log', $resetLockPreviousLog);
    Finados\Http::destroySession(); session_id(''); $_SESSION = [];
}
