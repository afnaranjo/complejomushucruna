import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { loadConfig } from './deploy-cpanel.mjs';

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(websiteRoot, 'backend/finados-api');
const healthUrl = 'https://finados.complejomushucruna.com/api/health';
const php = 'php -d display_errors=0 -d log_errors=0';
const approvedLegacyPublicEndpointHashes = Object.freeze([
  // website/public/api/voceros/index.php at b85cb0f, verified byte-for-byte
  // against the endpoint in production before the first backend deployment.
  'e3cbffe53c6d6cce453a4aab06e99e19184fb36cba6fa0cc0757a6410959944c',
]);
const q = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const literal = value => `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
const within = (path, root) => path === root || path.startsWith(`${root}/`);
class OperationalError extends Error {}
const fail = message => { throw new OperationalError(message); };

export const backendKeys = ['FINADOS_APP_ROOT', 'FINADOS_BACKEND_ROOT', 'FINADOS_API_DOCROOT',
  'FINADOS_CONFIG_PATH', 'FINADOS_BACKUP_ROOT', 'FINADOS_PUBLIC_ROOTS'];

export function validateBackendConfig(config) {
  for (const key of backendKeys) if (typeof config[key] !== 'string' || !config[key]) fail(`Falta ${key}.`);
  const home = `/home/${config.DEPLOY_SSH_USER}`;
  if (!/^[A-Za-z0-9_-]+$/.test(config.DEPLOY_SSH_USER) || !/^[A-Za-z0-9.-]+$/.test(config.DEPLOY_SSH_HOST)) fail('Destino SSH inválido.');
  const port = Number(config.DEPLOY_SSH_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail('Puerto SSH inválido.');
  if (config.DEPLOY_REMOTE_ROOT !== `${home}/public_html/complejomushucruna.com`) fail('Docroot principal inválido.');
  for (const key of backendKeys.filter(key => key !== 'FINADOS_PUBLIC_ROOTS')) {
    const path = config[key];
    if (!/^\/[A-Za-z0-9_./-]+$/.test(path) || posix.normalize(path) !== path || path.endsWith('/')
      || !within(path, home) || path.split('/').length < (key === 'FINADOS_API_DOCROOT' ? 4 : 5)) fail(`Ruta inválida en ${key}.`);
  }
  let roots;
  try { roots = JSON.parse(config.FINADOS_PUBLIC_ROOTS); } catch { fail('FINADOS_PUBLIC_ROOTS debe ser JSON.'); }
  if (!Array.isArray(roots) || roots.length !== 2 || new Set(roots).size !== 2
    || !roots.includes(config.DEPLOY_REMOTE_ROOT) || !roots.includes(config.FINADOS_API_DOCROOT)
    || within(roots[0], roots[1]) || within(roots[1], roots[0])) fail('Se requieren los dos docroots exactos y distintos.');
  for (const key of ['FINADOS_APP_ROOT', 'FINADOS_CONFIG_PATH', 'FINADOS_BACKUP_ROOT']) {
    if (roots.some(root => within(config[key], root)) || config[key].split('/').some(part => ['public_html', 'htdocs', 'www', 'public', 'dist'].includes(part))) fail('El backend, configuración y respaldo deben ser privados.');
  }
  if (config.FINADOS_BACKEND_ROOT !== `${config.FINADOS_APP_ROOT}/current`) fail('FINADOS_BACKEND_ROOT debe apuntar a current.');
  const privatePaths = [config.FINADOS_APP_ROOT, posix.dirname(config.FINADOS_CONFIG_PATH), config.FINADOS_BACKUP_ROOT];
  for (let i = 0; i < privatePaths.length; i++) for (let j = i + 1; j < privatePaths.length; j++) {
    if (within(privatePaths[i], privatePaths[j]) || within(privatePaths[j], privatePaths[i])) fail('Las rutas privadas deben estar separadas.');
  }
  return config;
}

function environment(config) {
  return ['FINADOS_CONFIG_PATH', 'FINADOS_BACKEND_ROOT', 'FINADOS_PUBLIC_ROOTS'].map(key => `${key}=${q(config[key])}`).join(' ');
}

function bundle(files) {
  return files.map(file => readFileSync(join(backend, file), 'utf8')
    .replace(/^<\?php\s*/, '').replace(/declare\(strict_types=1\);/g, '')
    .replace(/^require_once .*;\s*$/gm, '')).join('\n');
}

function phpSource(body, files = []) {
  return `<?php\nnamespace Finados;\nini_set('display_errors', '0'); ini_set('log_errors', '0');\n`
    + bundle(files).replace(/^namespace Finados;\s*$/gm, '').replace(/^use (?:RuntimeException|Throwable);\s*$/gm, '')
    + `\nuse RuntimeException; use Throwable;\nset_error_handler(static function () { throw new RuntimeException('Operation failed.'); });\ntry {\n${body}\n} catch (Throwable) { exit(1); }\n`;
}

function probeSource(config) {
  const roots = JSON.parse(config.FINADOS_PUBLIC_ROOTS);
  return phpSource(`
if (PHP_VERSION_ID < 80100) exit(1);
foreach (['pdo','pdo_mysql','openssl','session'] as $module) if (!extension_loaded($module)) exit(1);
$publicRoots = json_decode(${literal(JSON.stringify(roots))}, true);
foreach ($publicRoots as $root) if (realpath($root) !== $root || !is_dir($root) || !is_writable($root)) exit(1);
foreach ([${[config.FINADOS_APP_ROOT, posix.dirname(config.FINADOS_CONFIG_PATH), config.FINADOS_BACKUP_ROOT].map(literal).join(',')}] as $root) {
  if (realpath($root) !== $root || !is_dir($root) || !is_writable($root) || (fileperms($root) & 0077) !== 0) exit(1);
}
$path = ${literal(config.FINADOS_CONFIG_PATH)};
if (realpath($path) !== $path || !is_file($path) || !is_readable($path) || (fileperms($path) & 0077) !== 0) exit(1);
$current = ${literal(config.FINADOS_BACKEND_ROOT)};
if (file_exists($current) || is_link($current)) {
  $resolved = realpath($current);
  if ($resolved === false || (!str_starts_with($resolved, ${literal(config.FINADOS_APP_ROOT + '/releases/')}) && $resolved !== $current) || !is_dir($resolved . '/src')) exit(1);
}
$api = ${literal(config.FINADOS_API_DOCROOT + '/api')};
if (is_link($api) || (file_exists($api) && !is_dir($api)) || is_link($api . '/index.php') || is_link($api . '/.htaccess')
  || (is_file($api . '/index.php') && !str_contains(file_get_contents($api . '/index.php'), 'FINADOS MANAGED API'))) exit(1);
if (is_link(${literal(config.FINADOS_APP_ROOT + '/releases')}) || is_link(${literal(config.DEPLOY_REMOTE_ROOT + '/api')})
  || is_link(${literal(config.DEPLOY_REMOTE_ROOT + '/api/voceros')})) exit(1);
$config = Config::fromProductionEnvironment();
if ($config->allowedOrigin() !== 'https://complejomushucruna.com' || !str_starts_with($config->databaseDsn(), 'mysql:')) exit(1);
$pdo = Database::connect($config);
$probe = (string) $pdo->query('SELECT 1')->fetchColumn();
echo json_encode(['phpVersion'=>PHP_VERSION, 'phpModules'=>get_loaded_extensions(), 'paths'=>true, 'databaseProbe'=>$probe]);
`, ['src/Config.php', 'src/Database.php']);
}

async function safeRun(transport, operation) {
  try { return await transport.run(operation); } catch { fail(`Falló ${operation.id}; se omitieron los diagnósticos privados.`); }
}

export async function checkBackend(config, transport = createTransport(config)) {
  validateBackendConfig(config);
  let repo;
  try { repo = await transport.repository(); } catch { fail('No se pudo verificar main contra el remoto.'); }
  if (repo.branch !== 'main' || repo.dirty || !/^[a-f0-9]{40,64}$/.test(repo.head) || repo.head !== repo.remoteHead) fail('Se requiere main limpia y sincronizada con origin/main.');
  const output = await safeRun(transport, { id: 'probe', write: false, command: `${environment(config)} ${php}`, input: probeSource(config) });
  let result;
  try { result = JSON.parse(output); } catch { fail('El prevuelo remoto no devolvió un resultado válido.'); }
  const version = /^(\d+)\.(\d+)\./.exec(result.phpVersion ?? '');
  const modules = (Array.isArray(result.phpModules) ? result.phpModules : []).map(value => String(value).toLowerCase());
  if (!version || Number(version[1]) < 8 || (Number(version[1]) === 8 && Number(version[2]) < 1)
    || !['pdo', 'pdo_mysql', 'openssl', 'session'].every(value => modules.includes(value))
    || result.paths !== true || result.databaseProbe !== '1') fail('Prevuelo rechazado: revisa PHP, módulos, rutas privadas y base de datos.');
  return { healthUrl, database: 'ready', commit: repo.head };
}

function migrationSource(release) {
  return phpSource(`
require ${literal(release + '/src/Config.php')}; require ${literal(release + '/src/Database.php')};
$pdo = Database::connect(Config::fromProductionEnvironment());
if ((int)$pdo->query("SELECT GET_LOCK('finados.deploy.migrations', 10)")->fetchColumn() !== 1) exit(1);
try {
  $pdo->exec('CREATE TABLE IF NOT EXISTS schema_migrations (version VARCHAR(80) PRIMARY KEY, applied_at DATETIME NOT NULL) ENGINE=InnoDB');
  $files = glob(${literal(release + '/migrations/*_mysql.sql')});
  if (!$files) exit(1);
  sort($files, SORT_STRING);
  foreach ($files as $file) {
    $version = basename($file, '.sql');
    $query = $pdo->prepare('SELECT version FROM schema_migrations WHERE version = ?'); $query->execute([$version]);
    if (!$query->fetchColumn()) {
      $sql = file_get_contents($file);
      foreach (explode(';', $sql) as $statement) if (trim($statement) !== '') $pdo->exec(preg_replace('/CREATE TABLE (?!IF NOT EXISTS )/', 'CREATE TABLE IF NOT EXISTS ', $statement));
      $pdo->prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')->execute([$version, gmdate('Y-m-d H:i:s')]);
    }
  }
} finally { $pdo->query("SELECT RELEASE_LOCK('finados.deploy.migrations')"); }
`);
}

function envPhp(config) {
  return ['FINADOS_CONFIG_PATH', 'FINADOS_BACKEND_ROOT', 'FINADOS_PUBLIC_ROOTS'].map(key => `putenv(${literal(`${key}=${config[key]}`)});`).join('\n');
}

export function preparePublicEndpoint(config, source) {
  validateBackendConfig(config);
  if (typeof source !== 'string' || !source.startsWith('<?php') || !source.includes('voceros_bootstrap')) fail('Endpoint de Voceros inválido.');
  // Package the two public helpers inside the endpoint so later partial transfers cannot
  // replace a dependency of the active form. Private backend classes remain in current.
  for (const helper of ['_google-sheets.php', '_voceros-bootstrap.php']) {
    const include = `require_once dirname(__DIR__) . DIRECTORY_SEPARATOR . '${helper}';`;
    if (source.includes(include)) {
      const body = readFileSync(join(websiteRoot, 'public/api', helper), 'utf8')
        .replace(/^<\?php\s*declare\(strict_types=1\);\s*/, '');
      source = source.replace(include, body);
    }
  }
  const endMarker = '// FINADOS MANAGED BOOTSTRAP END\n';
  if (source.includes('// FINADOS MANAGED BOOTSTRAP BEGIN\n')) {
    const offset = source.indexOf(endMarker);
    if (offset < 0) fail('Bootstrap previo incompleto.');
    source = '<?php' + source.slice(offset + endMarker.length);
  }
  source = source.replace(/^<\?php\s*declare\(strict_types=1\);/, '<?php');
  return `<?php\ndeclare(strict_types=1);\n// FINADOS MANAGED BOOTSTRAP BEGIN\n${envPhp(config)}\n${endMarker}${source.slice(5)}`;
}

function installSource(config, { main = false, releaseId, source }) {
  if (main && typeof source !== 'string') fail('El endpoint público preparado es obligatorio.');
  const docroot = main ? config.DEPLOY_REMOTE_ROOT : config.FINADOS_API_DOCROOT;
  const directory = main ? `${config.DEPLOY_REMOTE_ROOT}/api/voceros` : `${config.FINADOS_API_DOCROOT}/api`;
  const prefix = `<?php\ndeclare(strict_types=1);\n// FINADOS MANAGED ${main ? 'BOOTSTRAP BEGIN' : 'API'}\n${envPhp(config)}\n`;
  return phpSource(`
$directory = ${literal(directory)};
if (realpath(dirname($directory)) !== realpath(${literal(docroot)}) . ${literal(main ? '/api' : '')}) exit(1);
if (is_link($directory) || (file_exists($directory) && !is_dir($directory))) exit(1);
if (!is_dir($directory) && !mkdir($directory, 0755)) exit(1);
$destination = $directory . '/index.php';
${main ? `
$contents = ${literal(source)};
if (is_file($destination)) {
  $existingHash = hash_file('sha256', $destination);
  $approvedHashes = [${approvedLegacyPublicEndpointHashes.map(literal).join(',')}, hash('sha256', $contents)];
  if (!is_string($existingHash) || !in_array($existingHash, $approvedHashes, true)) exit(1);
}
` : `
if (is_file($destination) && !str_contains(file_get_contents($destination), 'FINADOS MANAGED API')) exit(1);
$contents = ${literal(prefix + `require ${literal(config.FINADOS_BACKEND_ROOT + '/public/index.php')};\n`)};
`}
if (is_link($destination)) exit(1);
$temporary = $directory . ${literal('/.finados-' + releaseId + '.php')};
$stream = fopen($temporary, 'x'); if (!$stream) exit(1);
fwrite($stream, $contents); fclose($stream); chmod($temporary, 0644);
$lint = proc_open([PHP_BINARY, '-l', $temporary], [0=>['file','/dev/null','r'],1=>['file','/dev/null','w'],2=>['file','/dev/null','w']], $pipes);
if (!is_resource($lint) || proc_close($lint) !== 0) exit(1);
${main && source !== undefined ? `
require $temporary;
if (!function_exists('voceros_handle_request')) exit(1);
$health = voceros_handle_request(['REQUEST_METHOD'=>'GET'], []);
if (($health['status'] ?? null) !== 200 || ($health['json']['open'] ?? false) !== true) exit(1);
` : ''}
if (!rename($temporary, $destination)) exit(1);
${main ? '' : `
$htaccess = $directory . '/.htaccess';
if (is_link($htaccess)) exit(1);
$old = is_file($htaccess) ? file_get_contents($htaccess) : '';
$block = ${literal('\n# BEGIN FINADOS API\nOptions -Indexes -MultiViews\nDirectoryIndex index.php\nRewriteEngine On\nRewriteRule ^ index.php [END]\n# END FINADOS API\n')};
$old = preg_replace('/\\n?# BEGIN FINADOS API\\n.*?# END FINADOS API\\n?/s', '', $old);
if (file_put_contents($htaccess, $old . $block) === false) exit(1); chmod($htaccess, 0644);
`}
`);
}

export async function installPublicBootstrap(config, transport = createTransport(config), { source } = {}) {
  validateBackendConfig(config);
  const prepared = preparePublicEndpoint(
    config,
    source ?? readFileSync(join(websiteRoot, 'public/api/voceros/index.php'), 'utf8'),
  );
  await safeRun(transport, { id: 'install-public-bootstrap', write: true, command: php,
    input: installSource(config, { main: true, releaseId: randomBytes(8).toString('hex'), source: prepared }) });
}

export async function deployBackend(config, transport = createTransport(config), options = {}) {
  const checked = await checkBackend(config, transport);
  const id = options.release ?? `${new Date().toISOString().replace(/[^0-9]/g, '')}-${checked.commit.slice(0, 12)}-${randomBytes(4).toString('hex')}`;
  if (!/^[a-zA-Z0-9-]{6,80}$/.test(id)) fail('Identificador de versión inválido.');
  const release = `${config.FINADOS_APP_ROOT}/releases/${id}`;
  const backup = `${config.FINADOS_BACKUP_ROOT}/${id}`;
  const run = (id, command, input) => safeRun(transport, { id, write: true, command, input });
  await run('backup-files', ['set -eu', 'umask 077', `test ! -e ${q(backup)}`, `mkdir ${q(backup)}`,
    `tar -cf ${q(backup + '/backend.tar')} -C ${q(config.FINADOS_APP_ROOT)} .`,
    `tar -cf ${q(backup + '/main-docroot.tar')} -C ${q(config.DEPLOY_REMOTE_ROOT)} .`,
    `tar -cf ${q(backup + '/api-docroot.tar')} -C ${q(config.FINADOS_API_DOCROOT)} .`,
    `sha256sum ${q(backup + '/backend.tar')} ${q(backup + '/main-docroot.tar')} ${q(backup + '/api-docroot.tar')} > ${q(backup + '/files.sha256')}`].join('; '));
  await run('backup-database', `${environment(config)} ${php}`, phpSource(`exit(BackupCommand::run(['--output', ${literal(backup + '/database')}]));`,
    ['src/Config.php', 'src/Database.php', 'bin/operations.php', 'bin/backup.php']));
  await run('prepare-release', `set -eu; umask 077; test ! -L ${q(config.FINADOS_APP_ROOT + '/releases')}; mkdir -p ${q(config.FINADOS_APP_ROOT + '/releases')}; test ! -e ${q(release)}; test ! -L ${q(release)}; mkdir ${q(release)}`);
  try { await transport.upload({ id: 'upload-release', write: true, destination: release, source: backend, files: ['src', 'bin', 'migrations', 'public'] }); }
  catch { fail('Falló la transferencia de la versión. La versión activa no cambió.'); }
  // Check each exit status; find -exec alone does not propagate all lint failures.
  await run('verify-lint', php, phpSource(`
$iterator = new \\RecursiveIteratorIterator(new \\RecursiveDirectoryIterator(${literal(release)}, \\FilesystemIterator::SKIP_DOTS));
foreach ($iterator as $file) if ($file->getExtension() === 'php') {
  $process = proc_open([PHP_BINARY, '-l', $file->getPathname()], [0=>['file','/dev/null','r'],1=>['file','/dev/null','w'],2=>['file','/dev/null','w']], $pipes);
  if (!is_resource($process) || proc_close($process) !== 0) exit(1);
}`));
  await run('migrate', `${environment(config)} ${php}`, migrationSource(release));
  await run('activate', php, phpSource(`
$release = ${literal(release)}; $current = ${literal(config.FINADOS_BACKEND_ROOT)};
$next = ${literal(config.FINADOS_APP_ROOT + '/next-' + id)};
if (file_exists($next) || is_link($next)) exit(1);
$linked = false;
set_error_handler(static function () { return true; });
try { $linked = function_exists('symlink') && symlink($release, $next); } finally { restore_error_handler(); }
if (!$linked) {
  // A complete private copy replaces current only after backup, lint and migration.
  if (!mkdir($next, 0700)) exit(1);
  $process = proc_open(['cp', '-a', $release . '/.', $next . '/'], [0=>['file','/dev/null','r'],1=>['file','/dev/null','w'],2=>['file','/dev/null','w']], $pipes);
  if (!is_resource($process) || proc_close($process) !== 0) exit(1);
}
$previous = ${literal(config.FINADOS_APP_ROOT + '/previous-' + id)};
$moved = false;
if (is_dir($current) && !is_link($current)) {
  if (file_exists($previous) || is_link($previous) || !rename($current, $previous)) exit(1);
  $moved = true;
}
try { if (!rename($next, $current)) throw new RuntimeException(); }
catch (Throwable) {
  if ($moved && !file_exists($current) && !is_link($current)) rename($previous, $current);
  exit(1);
}
`));
  await run('install-api', php, installSource(config, { releaseId: id }));
  let health;
  try { health = await transport.health(healthUrl); } catch { fail('No se pudo verificar HTTPS; conserva el respaldo y revisa la versión activa.'); }
  if (health.status !== 200 || health.ok !== true) fail('La API no confirmó salud después del despliegue.');
  return { ...checked, release: id };
}

export async function administerBackend(config, transport = createTransport(config), { tty = Boolean(process.stdin.isTTY && process.stdout.isTTY && process.stderr.isTTY) } = {}) {
  validateBackendConfig(config);
  if (!tty) fail('backend:admin requiere una terminal interactiva sin captura ni redirección.');
  await transport.interactive({ id: 'admin', write: true, capture: false,
    command: `${environment(config)} ${php} ${q(config.FINADOS_BACKEND_ROOT + '/bin/create-admin.php')} --username admin` });
}

export async function importBackend(config, transport = createTransport(config), { voceros, consents, execute = false } = {}) {
  validateBackendConfig(config);
  for (const path of [voceros, consents]) {
    if (typeof path !== 'string' || !/^\/[A-Za-z0-9_./-]+\.csv$/.test(path) || posix.normalize(path) !== path
      || !within(path, `/home/${config.DEPLOY_SSH_USER}/private-data`)) fail('Los CSV deben estar en private-data, fuera del sitio.');
  }
  const command = `${environment(config)} ${php} ${q(config.FINADOS_BACKEND_ROOT + '/bin/import-voceros.php')} --voceros ${q(voceros)} --consents ${q(consents)}`;
  await safeRun(transport, { id: 'import-check', write: false, command: `${command} --dry-run` });
  if (execute) await safeRun(transport, { id: 'import', write: true, command });
  return { imported: execute };
}

export function createTransport(config) {
  const target = `${config.DEPLOY_SSH_USER}@${config.DEPLOY_SSH_HOST}`;
  const sshArgs = ['-i', config.DEPLOY_SSH_KEY, '-p', config.DEPLOY_SSH_PORT, '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'ConnectTimeout=8', '-o', 'StrictHostKeyChecking=yes'];
  function execute(command, args, options = {}) {
    const result = spawnSync(command, args, { cwd: websiteRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 300000, ...options });
    if (result.error || result.status !== 0) fail('La operación no terminó correctamente; no se muestran diagnósticos privados.');
    return result.stdout?.trim() ?? '';
  }
  return {
    async repository() {
      const git = (...args) => execute('git', ['--no-optional-locks', ...args]);
      return { branch: git('branch', '--show-current'), dirty: git('status', '--porcelain') !== '', head: git('rev-parse', 'HEAD'),
        remoteHead: git('ls-remote', '--exit-code', 'origin', 'refs/heads/main').split(/\s/)[0] };
    },
    async run({ command, input }) { return execute('ssh', [...sshArgs, target, command], { input }); },
    async upload({ source, files, destination }) {
      const artifact = spawnSync('tar', ['-cf', '-', '-C', source, ...files], { maxBuffer: 64 * 1024 * 1024 });
      if (artifact.error || artifact.status !== 0) fail('No se pudo construir el artefacto.');
      execute('ssh', [...sshArgs, target, `umask 077; tar -xf - -C ${q(destination)}`], { input: artifact.stdout });
    },
    async interactive({ command }) {
      execute('ssh', [...sshArgs, '-tt', target, command], { stdio: 'inherit', timeout: undefined });
    },
    async health(url) {
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      const body = await response.json();
      return { status: response.status, ok: body.ok };
    },
  };
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (!['--validate-config', '--check', '--deploy', '--admin', '--import-check', '--import'].includes(mode)) fail('Modo de backend inválido.');
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    if (!['--config', '--voceros', '--consents'].includes(args[i]) || !args[i + 1] || options[args[i]]) fail('Argumentos inválidos.');
    options[args[i]] = args[i + 1];
  }
  if (!mode.startsWith('--import') && (options['--voceros'] || options['--consents'])) fail('Argumentos de importación fuera de contexto.');
  const config = validateBackendConfig(await loadConfig(resolve(options['--config'] ?? join(websiteRoot, '.env.deploy'))));
  const transport = createTransport(config);
  if (mode === '--check') await checkBackend(config, transport);
  if (mode === '--deploy') {
    const tests = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'check'], { cwd: websiteRoot, stdio: 'inherit' });
    if (tests.status !== 0) fail('Las pruebas locales deben pasar antes de desplegar.');
    await deployBackend(config, transport);
  }
  if (mode === '--admin') await administerBackend(config, transport);
  if (mode.startsWith('--import')) await importBackend(config, transport, { voceros: options['--voceros'], consents: options['--consents'], execute: mode === '--import' });
  console.log(mode === '--check' ? 'Prevuelo backend completo; no se modificó el servidor.' : 'Operación backend completada.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => {
  console.error(error instanceof OperationalError ? error.message : 'La operación backend falló. Revisa configuración y requisitos; no se muestran datos privados.');
  process.exitCode = 1;
});
