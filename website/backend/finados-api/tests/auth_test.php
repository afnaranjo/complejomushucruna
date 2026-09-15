<?php

declare(strict_types=1);

require_once __DIR__ . '/Test.php';
foreach (['Database', 'Http', 'Auth'] as $class) {
    if (is_file(__DIR__ . '/../src/' . $class . '.php')) {
        require_once __DIR__ . '/../src/' . $class . '.php';
    }
}

use Finados\Auth;
use Finados\Config;
use Finados\Database;
use Finados\Forbidden;
use Finados\Unauthorized;

function auth_config(bool $production = false): Config
{
    return Config::fromFile(temp_file(json_encode([
        'environment' => $production ? 'production' : 'test', 'databaseDsn' => 'sqlite::memory:',
        'databaseUser' => '', 'databasePassword' => '', 'allowedOrigin' => 'https://example.invalid',
        'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
    ], JSON_THROW_ON_ERROR)));
}

same(true, class_exists(Auth::class));
$config = auth_config();
$pdo = Database::connect($config);
$pdo->exec(file_get_contents(__DIR__ . '/../migrations/001_initial_sqlite.sql'));
$secret = bin2hex(random_bytes(24));
$hash = password_hash($secret, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT);
$insert = $pdo->prepare('INSERT INTO admin_users (public_id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
$insert->execute([str_repeat('a', 32), 'admin', $hash, '2026-09-14 00:00:00', '2026-09-14 00:00:00']);
$adminId = (int) $pdo->lastInsertId();
$now = 1800000000;
$auth = new Auth($pdo, $config, static function () use (&$now): int { return $now; });

// Missing rotation, insecure cookies or returning the password hash break the login contract.
$preLoginToken = $auth->csrfToken();
$oldId = session_id();
$result = $auth->login('admin', $secret, '192.0.2.1');
same($adminId, $result['user']['id']);
same('admin', $result['user']['username']);
same('administrador', $result['user']['role']);
same(false, $oldId === session_id());
same(false, $preLoginToken === $result['csrf']);
same(true, strlen($result['csrf']) >= 64);
same(false, str_contains(json_encode($result), $hash));
same(false, str_contains(json_encode($_SESSION), $hash));
$cookies = session_get_cookie_params();
same('', $cookies['domain']);
same(true, $cookies['httponly']);
same('Strict', $cookies['samesite']);
same(0, $cookies['lifetime']);
same('1', ini_get('session.use_strict_mode'));
same('1', ini_get('session.use_only_cookies'));
// PHP's default garbage collection must not delete an otherwise valid 30-minute session at 24 minutes.
same('43200', ini_get('session.gc_maxlifetime'));
$persistedId = session_id();
session_write_close();
session_id($persistedId);
same($adminId, $auth->requireUser()['id']);
$auth->verifyCsrf($result['csrf']);
throws(fn () => $auth->verifyCsrf(''), Forbidden::class);
throws(fn () => $auth->verifyCsrf(str_repeat('0', 64)), Forbidden::class);
same($adminId, $auth->requireUser()['id']);
$loggedOutId = session_id();
session_write_close();
$auth->logout();
same('', session_id());
// Replaying the previous cookie/identifier in a later request must not resume authentication.
session_id($loggedOutId);
throws(fn () => $auth->requireUser(), Unauthorized::class);
$auth->login('admin', $secret, '192.0.2.1');
$auth->logout();
same('', session_id());
throws(fn () => $auth->requireUser(), Unauthorized::class);
throws(fn () => $auth->verifyCsrf($result['csrf']), Forbidden::class);

// Wrong username, password and disabled users disclose the same message and no IP plaintext.
$messages = [];
foreach ([['admin', 'wrong'], ['missing', $secret]] as [$username, $password]) {
    try { $auth->login($username, $password, '192.0.2.2'); } catch (Unauthorized $e) { $messages[] = $e->getMessage(); }
}
same(['Credenciales incorrectas', 'Credenciales incorrectas'], $messages);
$pdo->exec('UPDATE admin_users SET active = 0');
throws(fn () => $auth->login('admin', $secret, '192.0.2.3'), Unauthorized::class);
$pdo->exec('UPDATE admin_users SET active = 1');
$attempts = json_encode($pdo->query('SELECT * FROM login_attempts')->fetchAll());
same(false, str_contains($attempts, '192.0.2.'));
same(false, str_contains($attempts, $secret));
same(false, str_contains($attempts, 'admin'));

// The fifth failure locks for a full 15 minutes, even after the first failure leaves the window.
for ($i = 0; $i < 5; $i++) {
    throws(fn () => $auth->login('admin', 'wrong', '192.0.2.10'), Unauthorized::class);
    if ($i < 4) { $now += 100; }
}
$now += 899;
throws(fn () => $auth->login('admin', $secret, '192.0.2.10'), Unauthorized::class);
same($adminId, $auth->login('admin', $secret, '192.0.2.11')['user']['id']);
$now++;
same($adminId, $auth->login('admin', $secret, '192.0.2.10')['user']['id']);
// Widely spaced failures must not cause a lock.
for ($i = 0; $i < 5; $i++) {
    throws(fn () => $auth->login('admin', 'wrong', '192.0.2.12'), Unauthorized::class);
    $now += 901;
}
same($adminId, $auth->login('admin', $secret, '192.0.2.12')['user']['id']);

// Activity extends idle expiry but must never extend the absolute 12-hour boundary.
$now += 1799;
same($adminId, $auth->requireUser()['id']);
$now += 1800;
throws(fn () => $auth->requireUser(), Unauthorized::class);
$auth->login('admin', $secret, '192.0.2.20');
for ($i = 0; $i < 24; $i++) { $now += 1799; $auth->requireUser(); }
$now += 24;
throws(fn () => $auth->requireUser(), Unauthorized::class);
// Disabling an account or rotating its hash revokes previously authenticated sessions.
$auth->login('admin', $secret, '192.0.2.20');
$pdo->exec('UPDATE admin_users SET active = 0');
throws(fn () => $auth->requireUser(), Unauthorized::class);
$pdo->exec('UPDATE admin_users SET active = 1');
$auth->login('admin', $secret, '192.0.2.20');
$pdo->prepare('UPDATE admin_users SET password_hash = ?')->execute([password_hash(bin2hex(random_bytes(24)), PASSWORD_BCRYPT)]);
throws(fn () => $auth->requireUser(), Unauthorized::class);
$auth->logout();
$productionAuth = new Auth($pdo, auth_config(true));
$productionAuth->csrfToken();
same(true, session_get_cookie_params()['secure']);
$productionAuth->logout();

// Exercise the command through injected terminal IO, never through a secret CLI argument.
if (is_file(__DIR__ . '/../bin/create-admin.php')) { require_once __DIR__ . '/../bin/create-admin.php'; }
same(true, class_exists(Finados\AdminCommand::class));
same(true, method_exists(Finados\HiddenPasswordReader::class, 'readPair'));
$cliDb = temp_file('');
$cliConfig = temp_file(json_encode([
    'environment' => 'test', 'databaseDsn' => 'sqlite:' . $cliDb,
    'databaseUser' => '', 'databasePassword' => '', 'allowedOrigin' => 'https://example.invalid',
    'encryptionKey' => base64_encode(str_repeat('e', 32)), 'hmacKey' => base64_encode(str_repeat('h', 32)),
], JSON_THROW_ON_ERROR));
$cliPdo = Database::connect(Config::fromFile($cliConfig));
$cliPdo->exec(file_get_contents(__DIR__ . '/../migrations/001_initial_sqlite.sql'));
$args = ['--username', 'admin', '--config', $cliConfig];
function run_admin_command(array $args, array $secrets): array
{
    $output = '';
    $reads = 0;
    $code = Finados\AdminCommand::run($args, static function () use (&$secrets, &$reads): array {
        $reads++;
        return $secrets;
    }, static function (string $message) use (&$output): void { $output .= $message; });
    return [$code, $output, $reads];
}
$initialSecret = bin2hex(random_bytes(24));
same([0, "Usuario admin creado\n", 1], run_admin_command($args, [$initialSecret, $initialSecret]));
$cliAdmin = $cliPdo->query('SELECT * FROM admin_users')->fetch();
same('admin', $cliAdmin['username']);
same(true, Auth::verifyPassword($initialSecret, $cliAdmin['password_hash']));
$cliPasswordInfoHash = defined('PASSWORD_ARGON2ID')
    ? $cliAdmin['password_hash']
    : substr($cliAdmin['password_hash'], strlen('bcrypt-sha384$v1$'));
same(defined('PASSWORD_ARGON2ID') ? 'argon2id' : 'bcrypt', password_get_info($cliPasswordInfoHash)['algoName']);
$rotationSecret = bin2hex(random_bytes(24));
same([0, "Contraseña de admin actualizada\n", 1], run_admin_command($args, [$rotationSecret, $rotationSecret]));
$rotated = $cliPdo->query('SELECT * FROM admin_users')->fetch();
same($cliAdmin['public_id'], $rotated['public_id']);
same(false, Auth::verifyPassword($initialSecret, $rotated['password_hash']));
same(true, Auth::verifyPassword($rotationSecret, $rotated['password_hash']));
same(1, (int) $cliPdo->query('SELECT COUNT(*) FROM admin_users')->fetchColumn());
foreach ([['short', 'short'], [$initialSecret, $rotationSecret], [str_repeat('é', 13), str_repeat('é', 13)], [str_repeat('x', 73), str_repeat('x', 73)], ["\xFF", "\xFF"]] as $invalidSecrets) {
    [$code, $output, $reads] = run_admin_command($args, $invalidSecrets);
    same(1, $code);
    same("No se pudo configurar admin\n", $output);
    same(1, $reads);
}
foreach ([['--username', 'other', '--config', $cliConfig], [...$args, '--password', 'synthetic'], [...$args, '--config', $cliConfig], []] as $invalidArgs) {
    same([1, "No se pudo configurar admin\n", 0], run_admin_command($invalidArgs, []));
}
// A failed write must preserve the current hash and leave no open transaction or sensitive output.
$cliPdo->exec("CREATE TRIGGER fail_rotation BEFORE UPDATE ON admin_users BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
same([1, "No se pudo configurar admin\n", 1], run_admin_command($args, [$initialSecret, $initialSecret]));
$afterFailedRotation = $cliPdo->query('SELECT * FROM admin_users')->fetch();
same(true, hash_equals($rotated['password_hash'], $afterFailedRotation['password_hash']));
// The real executable refuses pipes and secret arguments; no noninteractive password path exists.
$pipes = [];
$process = proc_open([PHP_BINARY, __DIR__ . '/../bin/create-admin.php', ...$args, '--password', 'synthetic'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
fclose($pipes[0]);
same("No se pudo configurar admin\n", stream_get_contents($pipes[1]));
same('', stream_get_contents($pipes[2]));
fclose($pipes[1]); fclose($pipes[2]);
same(1, proc_close($process));
$pipes = [];
$process = proc_open([PHP_BINARY, __DIR__ . '/../bin/create-admin.php', ...$args], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes);
fclose($pipes[0]);
same("No se pudo configurar admin\n", stream_get_contents($pipes[1]));
same('', stream_get_contents($pipes[2]));
fclose($pipes[1]); fclose($pipes[2]);
same(1, proc_close($process));

// A real pseudoterminal sends each input only after its ready prompt, independently of stdout.
$cliPdo->exec('DROP TRIGGER fail_rotation');
function tty_state($terminal, string $option = '-a'): string
{
    $statePipes = [];
    $stateProcess = proc_open(['stty', $option], [0 => $terminal, 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $statePipes);
    $terminalState = stream_get_contents($statePipes[1]);
    stream_get_contents($statePipes[2]);
    fclose($statePipes[1]); fclose($statePipes[2]);
    same(0, proc_close($stateProcess));
    return trim($terminalState);
}
function tty_echo_disabled($terminal): bool
{
    return preg_match('/(?:^|\s)-echo(?:\s|;|$)/', tty_state($terminal)) === 1;
}
function tty_wait_for_prompt(array $pipes, string &$output, string $prompt): void
{
    $deadline = microtime(true) + 5;
    do {
        $output .= stream_get_contents($pipes[0]) . stream_get_contents($pipes[2]);
        if (str_contains($output, $prompt)) { return; }
        usleep(10000);
    } while (microtime(true) < $deadline);
    throw new RuntimeException('Missing safe terminal prompt.');
}
function tty_finish($process, array $pipes, string &$terminalOutput): array
{
    $stdout = '';
    $deadline = microtime(true) + 10;
    do {
        $terminalOutput .= stream_get_contents($pipes[0]) . stream_get_contents($pipes[2]);
        $stdout .= stream_get_contents($pipes[1]);
        $status = proc_get_status($process);
        if ($status['running']) { usleep(10000); }
    } while ($status['running'] && microtime(true) < $deadline);
    same(false, $status['running']);
    $terminalOutput .= stream_get_contents($pipes[0]) . stream_get_contents($pipes[2]);
    $stdout .= stream_get_contents($pipes[1]);
    return [$status['exitcode'], $stdout];
}
// The normal capture is also safe on PHP installations without the optional pcntl extension.
foreach ([[], ['-d', 'disable_functions=pcntl_signal,pcntl_async_signals,pcntl_signal_get_handler']] as $phpFlags) {
$ttyPipes = [];
$process = proc_open([PHP_BINARY, ...$phpFlags, __DIR__ . '/../bin/create-admin.php', ...$args], [0 => ['pty'], 1 => ['pipe', 'w'], 2 => ['pty']], $ttyPipes);
$originalTerminal = tty_state($ttyPipes[0], '-g');
foreach ($ttyPipes as $pipe) { stream_set_blocking($pipe, false); }
$ttyOutput = '';
try {
    tty_wait_for_prompt($ttyPipes, $ttyOutput, 'Contraseña de admin (entrada oculta): ');
    same(true, tty_echo_disabled($ttyPipes[0]));
    $ttySecret = bin2hex(random_bytes(24));
    fwrite($ttyPipes[0], $ttySecret . "\n");
    tty_wait_for_prompt($ttyPipes, $ttyOutput, 'Confirma la contraseña (entrada oculta): ');
    same(true, tty_echo_disabled($ttyPipes[0]));
    fwrite($ttyPipes[0], $ttySecret . "\n");
    same([0, "Contraseña de admin actualizada\n"], tty_finish($process, $ttyPipes, $ttyOutput));
    same(true, hash_equals($originalTerminal, tty_state($ttyPipes[0], '-g')));
    same(false, str_contains($ttyOutput, $ttySecret));
    $ttyHash = $cliPdo->query('SELECT password_hash FROM admin_users')->fetchColumn();
    same(true, Auth::verifyPassword($ttySecret, $ttyHash));
    same(false, str_contains($ttyOutput, $ttyHash));
} finally {
    proc_terminate($process, 9);
    foreach ($ttyPipes as $pipe) { fclose($pipe); }
    proc_close($process);
}
}
// Interrupt during the second entry: restore the exact terminal state and preserve the old hash.
foreach (function_exists('pcntl_signal') ? [SIGINT, SIGTERM, SIGHUP] : [] as $signal) {
    $ttyPipes = [];
    $process = proc_open([PHP_BINARY, __DIR__ . '/../bin/create-admin.php', ...$args], [0 => ['pty'], 1 => ['pipe', 'w'], 2 => ['pty']], $ttyPipes);
    $originalTerminal = tty_state($ttyPipes[0], '-g');
    foreach ($ttyPipes as $pipe) { stream_set_blocking($pipe, false); }
    $ttyOutput = '';
    try {
        tty_wait_for_prompt($ttyPipes, $ttyOutput, 'Contraseña de admin (entrada oculta): ');
        same(true, tty_echo_disabled($ttyPipes[0]));
        fwrite($ttyPipes[0], $ttySecret . "\n");
        tty_wait_for_prompt($ttyPipes, $ttyOutput, 'Confirma la contraseña (entrada oculta): ');
        same(true, tty_echo_disabled($ttyPipes[0]));
        proc_terminate($process, $signal);
        same([1, "No se pudo configurar admin\n"], tty_finish($process, $ttyPipes, $ttyOutput));
        same(true, hash_equals($originalTerminal, tty_state($ttyPipes[0], '-g')));
        same(false, str_contains($ttyOutput, $ttySecret));
        same(true, hash_equals($ttyHash, $cliPdo->query('SELECT password_hash FROM admin_users')->fetchColumn()));
    } finally {
        proc_terminate($process, 9);
        foreach ($ttyPipes as $pipe) { fclose($pipe); }
        proc_close($process);
    }
}

// Real CGI requests prove that logout consumes a cookie in a fresh process and expires it.
// The disposable worker has no public route and uses only the existing synthetic SQLite database.
$cgiWorker = temp_file(<<<'PHP'
<?php
require getenv('FINADOS_TEST_SOURCE') . '/Config.php';
require getenv('FINADOS_TEST_SOURCE') . '/Database.php';
require getenv('FINADOS_TEST_SOURCE') . '/Auth.php';
$config = Finados\Config::fromFile(getenv('FINADOS_TEST_CONFIG'));
$pdo = Finados\Database::connect($config);
$auth = new Finados\Auth($pdo, $config);
try {
    switch ($_SERVER['PATH_INFO']) {
        case '/login':
            $password = bin2hex(random_bytes(24));
            $pdo->prepare("UPDATE admin_users SET password_hash = ? WHERE username = 'admin'")->execute([Finados\Auth::hashPassword($password)]);
            $auth->login('admin', $password, '192.0.2.99');
            break;
        case '/logout':
            $auth->logout();
            break;
        case '/session':
            $auth->requireUser();
            break;
    }
    echo 'ok';
} catch (Finados\Unauthorized) {
    http_response_code(401);
    echo 'unauthorized';
}
PHP);
function auth_cgi_request(string $worker, string $configPath, string $action, string $cookie = ''): string
{
    $pipes = [];
    $process = proc_open([dirname(PHP_BINARY) . '/php-cgi', '-d', 'session.save_path=' . sys_get_temp_dir(), '-f', $worker], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, [
        'REDIRECT_STATUS' => '200', 'SCRIPT_FILENAME' => $worker, 'REQUEST_METHOD' => 'GET',
        'SCRIPT_NAME' => '/auth-test', 'PATH_INFO' => $action, 'HTTP_COOKIE' => $cookie,
        'FINADOS_TEST_SOURCE' => dirname(__DIR__) . '/src', 'FINADOS_TEST_CONFIG' => $configPath,
    ]);
    fclose($pipes[0]);
    $response = stream_get_contents($pipes[1]);
    $errors = stream_get_contents($pipes[2]);
    fclose($pipes[1]); fclose($pipes[2]);
    same(0, proc_close($process));
    same('', $errors);
    return $response;
}
$response = auth_cgi_request($cgiWorker, $cliConfig, '/login');
same(1, preg_match('/Set-Cookie: (finados_admin=[^;\r\n]+)/i', $response, $matches));
$cookie = $matches[1];
same(false, str_contains(auth_cgi_request($cgiWorker, $cliConfig, '/session', $cookie), '401'));
$response = auth_cgi_request($cgiWorker, $cliConfig, '/logout', $cookie);
same(true, str_contains($response, 'Set-Cookie: finados_admin='));
same(true, str_contains($response, 'Max-Age=0'));
same(true, str_contains($response, 'HttpOnly'));
same(true, str_contains($response, 'SameSite=Strict'));
same(false, str_contains($response, 'domain='));
same(true, str_contains(auth_cgi_request($cgiWorker, $cliConfig, '/session', $cookie), 'Status: 401'));
