import { spawnSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, posix } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { loadConfig } from './deploy-cpanel.mjs';

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const backend = join(websiteRoot, 'backend/finados-api');
const healthUrl = 'https://finados.complejomushucruna.com/api/health';
const mirrorHealthUrl = 'https://api.expoferiamushucruna.com/api/health';
const healthUrls = Object.freeze([healthUrl, mirrorHealthUrl]);
const php = 'php -d display_errors=0 -d log_errors=0';
const photoUploadBytes = 5 * 1024 * 1024;
const profileRequestOverheadBytes = 256 * 1024;
const approvedLegacyPublicEndpointHashes = Object.freeze([
  // website/public/api/voceros/index.php at b85cb0f, verified byte-for-byte
  // against the endpoint in production before the first backend deployment.
  'e3cbffe53c6d6cce453a4aab06e99e19184fb36cba6fa0cc0757a6410959944c',
]);
const approvedPreviousManagedPayloadHashes = Object.freeze([
  // Normalized website/public/api/voceros/index.php at 0bbd0fd. This is the
  // only marker-v0 payload accepted while moving to the verifiable v1 format.
  '92ee73c40b0a8ad383d44437772a270f4764f963e759b42b148325cb8c021a98',
]);
const managedBootstrapBegin = '// FINADOS MANAGED BOOTSTRAP BEGIN v1\n';
const managedPayloadPrefix = '// FINADOS MANAGED PAYLOAD SHA256: ';
const managedBootstrapEnd = '// FINADOS MANAGED BOOTSTRAP END v1\n';
const previousBootstrapBegin = '// FINADOS MANAGED BOOTSTRAP BEGIN\n';
const previousBootstrapEnd = '// FINADOS MANAGED BOOTSTRAP END\n';
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
  return `<?php\nnamespace Finados;\nuse RuntimeException; use Throwable; use PDO;\nini_set('display_errors', '0'); ini_set('log_errors', '0');\n`
    + bundle(files).replace(/^namespace Finados;\s*$/gm, '').replace(/^use (?:RuntimeException|Throwable|PDO);\s*$/gm, '')
    + `\nset_error_handler(static function () { throw new RuntimeException('Operation failed.'); });\ntry {\n${body}\n} catch (Throwable) { exit(1); }\n`;
}

/** Read-only runtime and storage checks, also executed directly by local contract tests. */
export function photoPreflightSource(privateRoot, publicRoots) {
  return `
if (PHP_VERSION_ID < 80100) exit(1);
foreach (['pdo','pdo_mysql','openssl','session','fileinfo','gd','exif'] as $module) if (!extension_loaded($module)) exit(1);
$gd = gd_info();
foreach (['JPEG Support','PNG Support','WebP Support'] as $format) if (($gd[$format] ?? false) !== true) exit(1);
foreach (['imagecreatefromjpeg','imagecreatefrompng','imagecreatefromwebp','imagejpeg','exif_read_data'] as $function) if (!function_exists($function)) exit(1);
$parseIniBytes = static function ($value): ?int {
  if (!is_string($value) || preg_match('/^([0-9]+)([KMG]?)$/iD', trim($value), $parts) !== 1) return null;
  $multiplier = [''=>1,'K'=>1024,'M'=>1024 ** 2,'G'=>1024 ** 3][strtoupper($parts[2])];
  $quantity = (int) $parts[1];
  if ($quantity > intdiv(PHP_INT_MAX, $multiplier)) return null;
  return $quantity * $multiplier;
};
$memory = trim(ini_get('memory_limit'));
if ($memory === '-1') $memoryBytes = -1;
else {
  $memoryBytes = $parseIniBytes($memory);
  if ($memoryBytes === null) exit(1);
  if ($memoryBytes < 256 * 1024 * 1024) exit(1);
}
$fileUploads = filter_var(ini_get('file_uploads'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) === true;
$uploadMaxBytes = $parseIniBytes(ini_get('upload_max_filesize'));
$postMaxBytes = $parseIniBytes(ini_get('post_max_size'));
if (!$fileUploads || $uploadMaxBytes === null || $uploadMaxBytes < ${photoUploadBytes}
  || $postMaxBytes === null || $postMaxBytes < ${photoUploadBytes + profileRequestOverheadBytes}) exit(1);
$private = ${literal(privateRoot)};
if (realpath($private) !== $private || !is_dir($private) || is_link($private) || !is_writable($private)
  || (fileperms($private) & 0077) !== 0 || (fileperms($private) & 0200) === 0) exit(1);
foreach (['public_html','htdocs','www','public','dist'] as $part) if (in_array($part, explode('/', $private), true)) exit(1);
foreach (json_decode(${literal(JSON.stringify(publicRoots))}, true) as $root) if ($private === $root || str_starts_with($private, $root . '/')) exit(1);
$free = disk_free_space($private); if ($free === false || $free < 100 * 1024 * 1024) exit(1);
$mediaProbe = ['jpeg'=>true,'png'=>true,'webp'=>true,'memoryBytes'=>$memoryBytes,'freeBytes'=>(int)$free,'privateRoot'=>true,
  'fileUploads'=>$fileUploads,'uploadMaxBytes'=>$uploadMaxBytes,'postMaxBytes'=>$postMaxBytes];
`;
}

function probeSource(config) {
  const roots = JSON.parse(config.FINADOS_PUBLIC_ROOTS);
  return phpSource(`
${photoPreflightSource(posix.dirname(config.FINADOS_CONFIG_PATH), roots)}
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
if (!in_array('https://complejomushucruna.com', $config->allowedOrigins(), true)
  || !in_array('https://finados.expoferiamushucruna.com', $config->allowedOrigins(), true)
  || !str_starts_with($config->databaseDsn(), 'mysql:')) exit(1);
$pdo = Database::connect($config);
$probe = (string) $pdo->query('SELECT 1')->fetchColumn();
echo json_encode(['phpVersion'=>PHP_VERSION, 'phpModules'=>get_loaded_extensions(), 'paths'=>true, 'databaseProbe'=>$probe, 'media'=>$mediaProbe]);
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
    || !['pdo', 'pdo_mysql', 'openssl', 'session', 'fileinfo', 'gd', 'exif'].every(value => modules.includes(value))
    || result.paths !== true || result.databaseProbe !== '1'
    || !['jpeg', 'png', 'webp', 'privateRoot'].every(key => result.media?.[key] === true)
    || !Number.isSafeInteger(result.media?.memoryBytes) || (result.media.memoryBytes !== -1 && result.media.memoryBytes < 268435456)
    || !Number.isSafeInteger(result.media?.freeBytes) || result.media.freeBytes < 104857600
    || result.media?.fileUploads !== true
    || !Number.isSafeInteger(result.media?.uploadMaxBytes) || result.media.uploadMaxBytes < photoUploadBytes
    || !Number.isSafeInteger(result.media?.postMaxBytes) || result.media.postMaxBytes < photoUploadBytes + profileRequestOverheadBytes) {
    fail('Prevuelo rechazado: revisa PHP, módulos, memoria, cargas, espacio, rutas privadas y base de datos.');
  }
  return { healthUrl, database: 'ready', commit: repo.head };
}

export function validateDeployedBackendHealth(health) {
  const requiredCapabilities = ['voceroAccounts', 'voceroProfile', 'privatePhoto', 'adminPasswordReset', 'photoUpload'];
  const requiredRuntime = ['fileinfo', 'gd', 'jpeg', 'png', 'webp', 'exif', 'openssl', 'functions'];
  const requiredStorage = ['privateRoot', 'canonical', 'writable', 'permissions'];
  if (!health || health.status !== 200 || health.ok !== true || health.service !== 'finados-voceros-api'
    || health.contract !== 'vocero-accounts-v1'
    || health.migration?.version !== '003_vocero_accounts' || health.migration?.ready !== true
    || !requiredCapabilities.every(capability => health.capabilities?.[capability] === true)
    || !requiredRuntime.every(capability => health.runtime?.[capability] === true)
    || !requiredStorage.every(capability => health.storage?.[capability] === true)
    || !Number.isSafeInteger(health.storage?.freeBytes) || health.storage.freeBytes < 104857600
    || health.limits?.fileUploads !== true
    || !Number.isSafeInteger(health.limits?.uploadMaxBytes) || health.limits.uploadMaxBytes < photoUploadBytes
    || !Number.isSafeInteger(health.limits?.postMaxBytes) || health.limits.postMaxBytes < photoUploadBytes + profileRequestOverheadBytes
    || !Number.isSafeInteger(health.limits?.memoryBytes)
    || (health.limits.memoryBytes !== -1 && health.limits.memoryBytes < 268435456)) {
    fail('La API activa no confirma cuentas de Vocero, migración 003 y runtime fotográfico compatible.');
  }
  return health;
}

export function normalizeHealthResponse(status, body) {
  return body && !Array.isArray(body) && typeof body === 'object'
    ? { ...body, status }
    : { status };
}

export async function checkDeployedBackend(config, transport = createTransport(config)) {
  validateBackendConfig(config);
  let lastError;
  for (const url of healthUrls) {
    try { return validateDeployedBackendHealth(await transport.health(url)); }
    catch (error) { lastError = error; }
  }
  if (lastError) fail('No se pudo verificar la API activa por HTTPS.');
  fail('No se pudo verificar la API activa por HTTPS.');
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
  if (typeof source !== 'string') fail('Endpoint de Voceros inválido.');
  const managedHeader = `<?php\ndeclare(strict_types=1);\n${managedBootstrapBegin}${managedPayloadPrefix}`;
  if (source.startsWith(managedHeader)) {
    const digestStart = managedHeader.length;
    const digest = source.slice(digestStart, digestStart + 64);
    const environmentBlock = `\n${envPhp(config)}\n${managedBootstrapEnd}`;
    if (!/^[a-f0-9]{64}$/.test(digest) || !source.startsWith(environmentBlock, digestStart + 64)) {
      fail('Endpoint administrado inválido.');
    }
    const payload = '<?php' + source.slice(digestStart + 64 + environmentBlock.length);
    if (createHash('sha256').update(payload).digest('hex') !== digest) fail('Endpoint administrado inválido.');
    source = payload;
  } else if (source.startsWith(`<?php\ndeclare(strict_types=1);\n${previousBootstrapBegin}`)) {
    const prefix = `<?php\ndeclare(strict_types=1);\n${previousBootstrapBegin}${envPhp(config)}\n${previousBootstrapEnd}`;
    if (!source.startsWith(prefix)) fail('Endpoint administrado previo inválido.');
    const payload = '<?php' + source.slice(prefix.length);
    if (!approvedPreviousManagedPayloadHashes.includes(createHash('sha256').update(payload).digest('hex'))) {
      fail('Endpoint administrado previo no aprobado.');
    }
    source = payload;
  } else if (source.includes('FINADOS MANAGED BOOTSTRAP')) {
    fail('Endpoint administrado inválido.');
  }
  if (!source.startsWith('<?php') || !source.includes('function voceros_handle_request(')
    || source.includes('voceros_bootstrap')) fail('Endpoint de Voceros inválido.');
  source = source.replace(/^<\?php\s*declare\(strict_types=1\);/, '<?php');
  const digest = createHash('sha256').update(source).digest('hex');
  return `<?php\ndeclare(strict_types=1);\n${managedBootstrapBegin}${managedPayloadPrefix}${digest}\n${envPhp(config)}\n${managedBootstrapEnd}${source.slice(5)}`;
}

function installSource(config, { main = false, releaseId, source }) {
  if (main && typeof source !== 'string') fail('El endpoint público preparado es obligatorio.');
  const docroot = main ? config.DEPLOY_REMOTE_ROOT : config.FINADOS_API_DOCROOT;
  const directory = main ? `${config.DEPLOY_REMOTE_ROOT}/api/voceros` : `${config.FINADOS_API_DOCROOT}/api`;
  const ownership = `${posix.dirname(config.FINADOS_CONFIG_PATH)}/voceros-endpoint-ownership.json`;
  const prefix = `<?php\ndeclare(strict_types=1);\n// FINADOS MANAGED ${main ? 'BOOTSTRAP BEGIN' : 'API'}\n${envPhp(config)}\n`;
  return phpSource(`
$directory = ${literal(directory)};
$docroot = ${literal(docroot)};
$docrootReal = realpath($docroot);
if (!is_string($docrootReal)
  || realpath(dirname($directory)) !== $docrootReal . ${literal(main ? '/api' : '')}) exit(1);
if (is_link($directory) || (file_exists($directory) && !is_dir($directory))) exit(1);
if (!is_dir($directory) && !mkdir($directory, 0755)) exit(1);
$directoryReal = realpath($directory);
$directoryStat = lstat($directory);
if (!is_string($directoryReal) || is_link($directory) || !is_array($directoryStat)
  || ($directoryStat['mode'] & 0170000) !== 0040000 || ($directoryStat['mode'] & 0022) !== 0) exit(1);
$directory = $directoryReal;
$destination = $directory . '/index.php';
$destinationPresent = file_exists($destination) || is_link($destination);
if ($destinationPresent) {
  $destinationStat = lstat($destination);
  if (is_link($destination) || !is_array($destinationStat)
    || ($destinationStat['mode'] & 0170000) !== 0100000
    || ($destinationStat['nlink'] ?? 0) !== 1
    || ($destinationStat['mode'] & 0022) !== 0) exit(1);
}
${main ? `
$contents = ${literal(source)};
$ownership = ${literal(ownership)};
$ownershipDirectory = dirname($ownership);
if (realpath($ownershipDirectory) !== $ownershipDirectory || is_link($ownershipDirectory)
  || !is_dir($ownershipDirectory) || !is_writable($ownershipDirectory) || (fileperms($ownershipDirectory) & 0077) !== 0) exit(1);
foreach (json_decode(${literal(config.FINADOS_PUBLIC_ROOTS)}, true) as $publicRoot) {
  if ($ownershipDirectory === $publicRoot || str_starts_with($ownershipDirectory, $publicRoot . '/')) exit(1);
}
if (!$destinationPresent || !is_file($destination)) exit(1);
$existing = file_get_contents($destination); if (!is_string($existing)) exit(1);
$existingHash = hash('sha256', $existing);
$contentsHash = hash('sha256', $contents);
$ownershipHash = null;
$ownershipPresent = file_exists($ownership) || is_link($ownership);
if ($ownershipPresent) {
  if (!is_file($ownership) || is_link($ownership)) exit(1);
  $ownershipStat = lstat($ownership);
  if (!is_array($ownershipStat) || ($ownershipStat['mode'] & 0777) !== 0600
    || ($ownershipStat['nlink'] ?? 0) !== 1 || ($ownershipStat['size'] ?? 0) > 512) exit(1);
  $ownershipDocument = json_decode((string) file_get_contents($ownership), true);
  if (!is_array($ownershipDocument) || count($ownershipDocument) !== 2
    || ($ownershipDocument['schema'] ?? null) !== 'finados-voceros-endpoint-ownership-v1'
    || !is_string($ownershipDocument['sha256'] ?? null)
    || preg_match('/^[a-f0-9]{64}$/D', $ownershipDocument['sha256']) !== 1) exit(1);
  $ownershipHash = $ownershipDocument['sha256'];
}
$legacyOwned = in_array($existingHash, [${approvedLegacyPublicEndpointHashes.map(literal).join(',')}], true);
$previousPrefix = ${literal(`<?php\ndeclare(strict_types=1);\n${previousBootstrapBegin}${envPhp(config)}\n${previousBootstrapEnd}`)};
$previousOwned = false;
if (str_starts_with($existing, $previousPrefix)) {
  $previousPayload = '<?php' . substr($existing, strlen($previousPrefix));
  $previousOwned = in_array(hash('sha256', $previousPayload), [${approvedPreviousManagedPayloadHashes.map(literal).join(',')}], true);
}
$manifestOwned = is_string($ownershipHash) && hash_equals($ownershipHash, $existingHash);
$idempotentRecovery = hash_equals($contentsHash, $existingHash);
if ($ownershipPresent) {
  if (!$manifestOwned && !$idempotentRecovery) exit(1);
} elseif (!$legacyOwned && !$previousOwned && !$idempotentRecovery) exit(1);
` : `
if (is_file($destination) && !str_contains(file_get_contents($destination), 'FINADOS MANAGED API')) exit(1);
$contents = ${literal(prefix + `require ${literal(config.FINADOS_BACKEND_ROOT + '/public/index.php')};\n`)};
`}
if (is_link($destination)) exit(1);
$temporary = $directory . ${literal('/.finados-' + releaseId + '.php')};
$temporaryCreated = false;
$ownershipTemporary = ${main ? `$ownershipDirectory . ${literal('/.voceros-endpoint-ownership-' + releaseId + '.tmp')}` : "''"};
$ownershipTemporaryCreated = false;
register_shutdown_function(static function () use ($temporary, &$temporaryCreated, $ownershipTemporary, &$ownershipTemporaryCreated): void {
  try { if ($temporaryCreated && (is_file($temporary) || is_link($temporary))) unlink($temporary); } catch (\\Throwable) {}
  try { if ($ownershipTemporaryCreated && (is_file($ownershipTemporary) || is_link($ownershipTemporary))) unlink($ownershipTemporary); } catch (\\Throwable) {}
});
$stream = fopen($temporary, 'x'); if (!$stream) exit(1);
$temporaryCreated = true;
$written = fwrite($stream, $contents);
$closed = fclose($stream);
if ($written !== strlen($contents) || !$closed || !chmod($temporary, 0644)) exit(1);
$temporaryStat = lstat($temporary);
if (!is_array($temporaryStat) || ($temporaryStat['mode'] & 0170000) !== 0100000
  || ($temporaryStat['nlink'] ?? 0) !== 1 || ($temporaryStat['size'] ?? -1) !== strlen($contents)) exit(1);
$lint = proc_open([PHP_BINARY, '-l', $temporary], [0=>['file','/dev/null','r'],1=>['file','/dev/null','w'],2=>['file','/dev/null','w']], $pipes);
if (!is_resource($lint) || proc_close($lint) !== 0) exit(1);
${main && source !== undefined ? `
require $temporary;
if (!function_exists('voceros_handle_request')) exit(1);
$health = voceros_handle_request(['REQUEST_METHOD'=>'GET'], []);
if (($health['status'] ?? null) !== 200 || ($health['json']['open'] ?? null) !== false
  || ($health['json']['authenticationRequired'] ?? null) !== true
  || ($health['json']['accessUrl'] ?? null) !== '/finados/voceros/acceso/'
  || ($health['json']['timezone'] ?? null) !== 'America/Guayaquil') exit(1);
$ownershipContents = json_encode([
  'schema' => 'finados-voceros-endpoint-ownership-v1',
  'sha256' => $contentsHash,
], JSON_UNESCAPED_SLASHES);
if (!is_string($ownershipContents)) exit(1);
$ownershipStream = fopen($ownershipTemporary, 'x'); if (!$ownershipStream) exit(1);
$ownershipTemporaryCreated = true;
$ownershipWritten = fwrite($ownershipStream, $ownershipContents . "\\n");
$ownershipClosed = fclose($ownershipStream);
if ($ownershipWritten !== strlen($ownershipContents) + 1 || !$ownershipClosed || !chmod($ownershipTemporary, 0600)) exit(1);
$ownershipTemporaryStat = lstat($ownershipTemporary);
if (!is_array($ownershipTemporaryStat) || ($ownershipTemporaryStat['mode'] & 0170000) !== 0100000
  || ($ownershipTemporaryStat['nlink'] ?? 0) !== 1
  || ($ownershipTemporaryStat['size'] ?? -1) !== strlen($ownershipContents) + 1) exit(1);
` : ''}
if (!rename($temporary, $destination)) exit(1);
$temporaryCreated = false;
${main ? `
if (!rename($ownershipTemporary, $ownership)) exit(1);
$ownershipTemporaryCreated = false;
` : ''}
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
    ['src/Config.php', 'src/Database.php', 'src/Crypto.php', 'src/PhotoStorage.php', 'src/VoceroMediaLock.php', 'bin/operations.php', 'bin/backup.php']));
  await run('prepare-release', `set -eu; umask 077; test ! -L ${q(config.FINADOS_APP_ROOT + '/releases')}; mkdir -p ${q(config.FINADOS_APP_ROOT + '/releases')}; test ! -e ${q(release)}; test ! -L ${q(release)}; mkdir ${q(release)}`);
  try { await transport.upload({ id: 'upload-release', write: true, destination: release, source: backend, files: backendReleaseFiles() }); }
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
  await checkDeployedBackend(config, transport);
  return { ...checked, release: id };
}

export function backendReleaseFiles() {
  const tracked = spawnSync('git', ['ls-files', '-z', '--', 'src', 'bin', 'migrations', 'public', 'resources'], { cwd: backend, encoding: 'utf8' });
  if (tracked.status !== 0) fail('No se pudo verificar el inventario versionado.');
  const files = tracked.stdout.split('\0').filter(Boolean).filter(file => /^(src\/[^/]+\.php|bin\/[^/]+\.php|migrations\/\d+_[a-z_]+\.sql|public\/(index\.php|\.htaccess)|resources\/(?:vocero|media|emprendedor|creadora)-consents\.json)$/.test(file)).sort();
  for (const file of files) {
    const info = lstatSync(join(backend, file));
    // APFS puede reportar `nlink === 2` para archivos con clonación de copia
    // al escribirlos desde el entorno local, aunque no exista un alias
    // adicional en el árbol del repositorio. Los enlaces simbólicos y valores
    // fuera de este rango siguen bloqueando el artefacto.
    if (!info.isFile() || info.isSymbolicLink() || ![1, 2].includes(info.nlink)) {
      fail('El artefacto requiere archivos regulares versionados.');
    }
  }
  for (const required of ['src/PhotoStorage.php', 'src/VoceroMediaLock.php', 'src/VoceroAuth.php', 'src/VoceroProfile.php', 'src/VoceroPasswordReset.php', 'resources/vocero-consents.json', 'migrations/003_vocero_accounts_mysql.sql', 'src/MediaAuth.php', 'src/MediaRepository.php', 'src/MediaPasswordReset.php', 'resources/media-consents.json', 'migrations/008_media_accounts_mysql.sql', 'src/EmprendedorAuth.php', 'src/EmprendedorRepository.php', 'src/EmprendedorPasswordReset.php', 'src/EmprendedorPhotoStorage.php', 'resources/emprendedor-consents.json', 'migrations/017_emprendedor_accounts_mysql.sql', 'src/CreadoraAuth.php', 'src/CreadoraRepository.php', 'src/CreadoraPasswordReset.php', 'resources/creadora-consents.json', 'migrations/021_creadora_accounts_mysql.sql']) {
    if (!files.includes(required)) fail('La versión no incluye una dependencia requerida.');
  }
  return files;
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
      return normalizeHealthResponse(response.status, body);
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
