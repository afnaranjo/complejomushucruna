import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { access, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(websiteRoot, '..');
const defaultConfigPath = join(websiteRoot, '.env.deploy');
const publicHostname = 'complejomushucruna.com';
const allowedKeys = new Set([
  'DEPLOY_SSH_HOST',
  'DEPLOY_SSH_USER',
  'DEPLOY_SSH_PORT',
  'DEPLOY_SSH_KEY',
  'DEPLOY_REMOTE_ROOT',
  'DEPLOY_SITE_URL',
  'GOOGLE_SHEETS_WEB_APP_URL',
  'GOOGLE_SHEETS_TOKEN',
]);
const requiredKeys = new Set([
  'DEPLOY_SSH_HOST',
  'DEPLOY_SSH_USER',
  'DEPLOY_SSH_PORT',
  'DEPLOY_SSH_KEY',
  'DEPLOY_REMOTE_ROOT',
  'DEPLOY_SITE_URL',
]);

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? websiteRoot,
    encoding: 'utf8',
    input: options.input,
    stdio: options.silent ? ['pipe', 'ignore', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  });

  if (result.error) fail(`No se pudo ejecutar ${command}.`);
  if (result.status !== 0) {
    const detail = options.silent ? '' : (result.stderr || result.stdout || '').trim();
    fail(detail ? `${options.label ?? command}: ${detail}` : `${options.label ?? command} falló.`);
  }
  return options.silent ? '' : (result.stdout ?? '').trim();
}

async function readDeployConfig(path) {
  let contents;
  try {
    contents = await readFile(path, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      fail('Falta la configuración local website/.env.deploy. Créala desde deploy.env.example.');
    }
    fail('No se pudo leer la configuración local de despliegue.');
  }

  const config = {};
  for (const [index, rawLine] of contents.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator < 1) fail(`Línea ${index + 1} inválida en la configuración local.`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (!allowedKeys.has(key)) fail(`Variable no permitida en la configuración local: ${key}`);
    if (Object.hasOwn(config, key)) fail(`Variable repetida en la configuración local: ${key}`);
    if (!value) fail(`La variable ${key} no puede estar vacía.`);
    config[key] = value;
  }

  for (const key of requiredKeys) {
    if (!Object.hasOwn(config, key)) fail(`Falta la variable requerida ${key}.`);
  }
  const hasSheetsUrl = Object.hasOwn(config, 'GOOGLE_SHEETS_WEB_APP_URL');
  const hasSheetsToken = Object.hasOwn(config, 'GOOGLE_SHEETS_TOKEN');
  if (hasSheetsUrl !== hasSheetsToken) {
    fail('GOOGLE_SHEETS_WEB_APP_URL y GOOGLE_SHEETS_TOKEN deben configurarse juntos.');
  }
  return config;
}

async function validateConfig(config) {
  if (!/^[A-Za-z0-9.-]+$/.test(config.DEPLOY_SSH_HOST)) {
    fail('DEPLOY_SSH_HOST contiene caracteres no permitidos.');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(config.DEPLOY_SSH_USER)) {
    fail('DEPLOY_SSH_USER contiene caracteres no permitidos.');
  }

  const port = Number(config.DEPLOY_SSH_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail('DEPLOY_SSH_PORT debe ser un puerto válido.');
  }

  let siteUrl;
  try {
    siteUrl = new URL(config.DEPLOY_SITE_URL);
  } catch {
    fail('DEPLOY_SITE_URL debe ser una URL válida.');
  }
  if (siteUrl.protocol !== 'https:' || siteUrl.hostname !== publicHostname || siteUrl.pathname !== '/') {
    fail(`DEPLOY_SITE_URL debe ser https://${publicHostname}.`);
  }

  const expectedRoot = `/home/${config.DEPLOY_SSH_USER}/public_html/${publicHostname}`;
  if (config.DEPLOY_REMOTE_ROOT !== expectedRoot) {
    fail(`DEPLOY_REMOTE_ROOT debe apuntar al docroot exacto /home/<usuario>/public_html/${publicHostname}.`);
  }

  if (!isAbsolute(config.DEPLOY_SSH_KEY)) {
    fail('DEPLOY_SSH_KEY debe ser una ruta absoluta.');
  }
  let keyStats;
  try {
    keyStats = await stat(config.DEPLOY_SSH_KEY);
  } catch {
    fail('No se encontró la llave privada indicada en DEPLOY_SSH_KEY.');
  }
  if (!keyStats.isFile()) fail('DEPLOY_SSH_KEY debe apuntar a un archivo regular.');
  if (process.platform !== 'win32' && (keyStats.mode & 0o077) !== 0) {
    fail('La llave privada tiene permisos inseguros. Ejecuta chmod 600 sobre ese archivo.');
  }

  if (config.GOOGLE_SHEETS_WEB_APP_URL) {
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.GOOGLE_SHEETS_WEB_APP_URL)) {
      fail('GOOGLE_SHEETS_WEB_APP_URL debe ser una URL publicada de Google Apps Script terminada en /exec.');
    }
    if (!/^[A-Fa-f0-9]{64}$/.test(config.GOOGLE_SHEETS_TOKEN)) {
      fail('GOOGLE_SHEETS_TOKEN debe contener exactamente 64 caracteres hexadecimales.');
    }
  }

  return {
    ...config,
    DEPLOY_SSH_PORT: String(port),
    DEPLOY_SITE_URL: `https://${publicHostname}`,
  };
}

async function loadConfig(path) {
  return validateConfig(await readDeployConfig(path));
}

function git(...args) {
  return execFileSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' }).trim();
}

function verifyRepository() {
  if (git('branch', '--show-current') !== 'main') {
    fail('El despliegue solo está permitido desde la rama main.');
  }
  if (git('status', '--porcelain')) {
    fail('El repositorio tiene cambios sin commit. Confírmalos o guárdalos antes de desplegar.');
  }

  console.log('Sincronizando la referencia segura de GitHub…');
  run('git', ['fetch', '--no-auto-maintenance', '--no-tags', 'origin', 'main'], {
    cwd: repositoryRoot,
    label: 'git fetch',
  });
  if (git('rev-list', '--left-right', '--count', 'main...origin/main') !== '0\t0') {
    fail('main debe estar completamente sincronizada con origin/main antes de desplegar.');
  }
}

function sshBaseArgs(config) {
  return [
    '-i', config.DEPLOY_SSH_KEY,
    '-p', config.DEPLOY_SSH_PORT,
    '-o', 'BatchMode=yes',
    '-o', 'IdentitiesOnly=yes',
    '-o', 'ConnectTimeout=8',
    '-o', 'StrictHostKeyChecking=accept-new',
  ];
}

function checkRemote(config) {
  const target = `${config.DEPLOY_SSH_USER}@${config.DEPLOY_SSH_HOST}`;
  const command = `test -d ${config.DEPLOY_REMOTE_ROOT} && test -w ${config.DEPLOY_REMOTE_ROOT} && command -v php >/dev/null && php -r 'exit(function_exists("mail") && class_exists("ZipArchive") ? 0 : 1);'`;
  run('ssh', [...sshBaseArgs(config), target, command], {
    silent: true,
    label: 'La validación SSH',
  });
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
}

function backupRemote(config) {
  const target = `${config.DEPLOY_SSH_USER}@${config.DEPLOY_SSH_HOST}`;
  const backupRoot = `/home/${config.DEPLOY_SSH_USER}/backups`;
  const backupPath = `${backupRoot}/${publicHostname}-${timestamp()}`;
  const command = [
    'set -eu',
    'umask 077',
    `mkdir -p ${backupRoot}`,
    `test ! -e ${backupPath}`,
    `cp -a ${config.DEPLOY_REMOTE_ROOT} ${backupPath}`,
  ].join('; ');

  run('ssh', [...sshBaseArgs(config), target, command], {
    silent: true,
    label: 'La copia de seguridad remota',
  });
}

function uploadGoogleSheetsConfig(config) {
  if (!config.GOOGLE_SHEETS_WEB_APP_URL) return;
  const target = `${config.DEPLOY_SSH_USER}@${config.DEPLOY_SSH_HOST}`;
  const privateDirectory = `/home/${config.DEPLOY_SSH_USER}/private-data`;
  const destination = `${privateDirectory}/google-sheets-config.json`;
  const temporary = `${destination}.tmp`;
  const contents = JSON.stringify({
    webAppUrl: config.GOOGLE_SHEETS_WEB_APP_URL,
    token: config.GOOGLE_SHEETS_TOKEN,
  });
  const command = [
    'set -eu',
    'umask 077',
    `mkdir -p ${privateDirectory}`,
    `chmod 700 ${privateDirectory}`,
    `cat > ${temporary}`,
    `chmod 600 ${temporary}`,
    `mv ${temporary} ${destination}`,
  ].join('; ');

  run('ssh', [...sshBaseArgs(config), target, command], {
    input: contents,
    silent: true,
    label: 'La configuración privada de Google Sheets',
  });
}

function verifyGoogleSheetsBridge(config) {
  if (!config.GOOGLE_SHEETS_WEB_APP_URL) return;
  const target = `${config.DEPLOY_SSH_USER}@${config.DEPLOY_SSH_HOST}`;
  const privatePath = `/home/${config.DEPLOY_SSH_USER}/private-data/google-sheets-config.json`;
  const source = `<?php
$config = json_decode((string) file_get_contents('${privatePath}'), true);
$url = is_array($config) ? ($config['webAppUrl'] ?? '') : '';
$payload = json_encode(['token' => 'verificacion-sin-escritura', 'kind' => 'media', 'record' => ['id' => 'healthcheck']]);
$body = false;
if (is_string($url) && is_string($payload) && function_exists('curl_init')) {
    $request = curl_init($url);
    curl_setopt_array($request, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_HTTPHEADER => ['Content-Type: application/json'], CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 15, CURLOPT_MAXREDIRS => 3]);
    $body = curl_exec($request);
    curl_close($request);
}
$response = is_string($body) ? json_decode($body, true) : null;
exit(is_array($response) && ($response['error'] ?? '') === 'unauthorized' ? 0 : 1);
`;
  run('ssh', [...sshBaseArgs(config), target, 'php'], {
    input: source,
    silent: true,
    label: 'La comprobación privada de Google Sheets',
  });
}

function waitForProcess(child, label) {
  return new Promise((resolvePromise, rejectPromise) => {
    child.once('error', () => rejectPromise(new Error(`No se pudo ejecutar ${label}.`)));
    child.once('close', (code) => resolvePromise(code));
  });
}

async function uploadDist(config) {
  const target = `${config.DEPLOY_SSH_USER}@${config.DEPLOY_SSH_HOST}`;
  const localTar = spawn('tar', ['-cf', '-', '-C', join(websiteRoot, 'dist'), '.'], {
    cwd: websiteRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const remoteTar = spawn(
    'ssh',
    [...sshBaseArgs(config), target, `tar -xf - -C ${config.DEPLOY_REMOTE_ROOT}`],
    { cwd: websiteRoot, stdio: ['pipe', 'ignore', 'pipe'] },
  );

  let localError = '';
  let remoteError = '';
  localTar.stderr.setEncoding('utf8');
  remoteTar.stderr.setEncoding('utf8');
  localTar.stderr.on('data', (chunk) => { localError += chunk; });
  remoteTar.stderr.on('data', (chunk) => { remoteError += chunk; });
  localTar.stdout.pipe(remoteTar.stdin);

  const [localCode, remoteCode] = await Promise.all([
    waitForProcess(localTar, 'tar'),
    waitForProcess(remoteTar, 'ssh'),
  ]);
  if (localCode !== 0 || remoteCode !== 0) {
    const detail = (remoteError || localError).trim();
    fail(detail ? `La transferencia de archivos: ${detail}` : 'La transferencia de archivos falló.');
  }
}

function normalizeRemotePermissions(config) {
  const target = `${config.DEPLOY_SSH_USER}@${config.DEPLOY_SSH_HOST}`;
  const root = config.DEPLOY_REMOTE_ROOT;
  const findCommand = [
    `find ${root} -mindepth 1 -type d -perm 0700`,
    `! -path '${root}/.well-known' ! -path '${root}/.well-known/*'`,
    `! -path '${root}/cgi-bin' ! -path '${root}/cgi-bin/*'`,
    '-exec chmod 755 {} +',
  ].join(' ');
  const command = ['set -eu', `chmod 750 ${root}`, findCommand].join('; ');

  run('ssh', [...sshBaseArgs(config), target, command], {
    silent: true,
    label: 'La normalización de permisos remotos',
  });
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    return await fetch(url, { redirect: 'manual', signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyPublicSite(config) {
  const cacheBust = `deploy=${Date.now()}`;
  const checks = [
    ['/', 200],
    ['/finados/', 200],
    ['/acreditacion-de-medios/', 200],
    ['/api/acreditacion-medios/', 200],
    ['/invitaciones/', 200],
    ['/api/invitaciones-rsvp/', 200],
    ['/assets/styles.css', 200],
    ['/assets/finados/finados.css', 200],
    [`/__verificacion-${Date.now()}`, 404],
  ];

  for (const [path, expectedStatus] of checks) {
    let response;
    try {
      const separator = path.includes('?') ? '&' : '?';
      response = await fetchWithTimeout(`${config.DEPLOY_SITE_URL}${path}${separator}${cacheBust}`);
    } catch {
      fail(`No se pudo verificar por HTTPS la ruta pública ${path}.`);
    }
    if (response.status !== expectedStatus) {
      fail(`La ruta pública ${path} respondió ${response.status}; se esperaba ${expectedStatus}.`);
    }
    if (path === '/api/acreditacion-medios/') {
      let payload;
      try {
        payload = await response.json();
      } catch {
        fail('El endpoint de acreditación no respondió JSON ejecutable.');
      }
      if (typeof payload.open !== 'boolean' || payload.deadline !== '2026-09-15T18:00:00-05:00') {
        fail('El endpoint de acreditación no confirmó la fecha límite configurada.');
      }
    }
    if (path === '/api/invitaciones-rsvp/') {
      let payload;
      try {
        payload = await response.json();
      } catch {
        fail('El endpoint de invitaciones no respondió JSON ejecutable.');
      }
      if (payload.ready !== true || payload.workbook !== 'confirmaciones-invitaciones-finados-2026.xlsx') {
        fail('El endpoint de invitaciones no confirmó la generación del archivo Excel.');
      }
    }
  }
}

function lintPhpEndpoints(config) {
  const target = `${config.DEPLOY_SSH_USER}@${config.DEPLOY_SSH_HOST}`;
  const files = [
    ['acreditación', join(websiteRoot, 'public', 'api', 'acreditacion-medios', 'index.php')],
    ['invitaciones', join(websiteRoot, 'public', 'api', 'invitaciones-rsvp', 'index.php')],
    ['integración de Google Sheets', join(websiteRoot, 'public', 'api', '_google-sheets.php')],
  ];
  for (const [label, path] of files) {
    run('ssh', [...sshBaseArgs(config), target, 'php -l'], {
      input: readFileSync(path, 'utf8'),
      silent: true,
      label: `La validación PHP de ${label}`,
    });
  }
}

async function runProjectChecks() {
  console.log('Construyendo y validando el sitio…');
  const testDirectory = join(websiteRoot, 'tests');
  const testFiles = (await readdir(testDirectory))
    .filter((file) => file.endsWith('.test.mjs'))
    .map((file) => join(testDirectory, file));
  run(process.execPath, ['--test', '--test-concurrency=1', ...testFiles], {
    cwd: websiteRoot,
    label: 'Las pruebas locales',
  });
  run(process.execPath, [join(websiteRoot, 'scripts', 'build.mjs')], { cwd: websiteRoot, label: 'La construcción local' });
  run(process.execPath, [join(websiteRoot, 'scripts', 'check-dist.mjs')], { cwd: websiteRoot, label: 'La validación de la salida' });
  return access(join(websiteRoot, 'dist', 'index.html'));
}

function parseArguments(argv) {
  const mode = argv[0];
  if (!['--validate-config', '--check', '--deploy'].includes(mode)) {
    fail('Uso: node scripts/deploy-cpanel.mjs --validate-config|--check|--deploy [ruta-config]');
  }
  if (argv.length > 2) fail('Se recibieron argumentos no reconocidos.');
  return { mode, configPath: resolve(argv[1] ?? defaultConfigPath) };
}

async function main() {
  const { mode, configPath } = parseArguments(process.argv.slice(2));
  const config = await loadConfig(configPath);

  if (mode === '--validate-config') {
    console.log(`Configuración válida para ${publicHostname}.`);
    return;
  }

  verifyRepository();
  await runProjectChecks();
  console.log('Verificando acceso SSH y destino remoto…');
  checkRemote(config);
  lintPhpEndpoints(config);

  if (mode === '--check') {
    console.log(`Prevuelo completo para ${publicHostname}; no se modificó el servidor.`);
    return;
  }

  console.log('Creando una copia de seguridad recuperable en el servidor…');
  backupRemote(config);
  console.log('Actualizando la configuración privada de Google Sheets…');
  uploadGoogleSheetsConfig(config);
  console.log('Comprobando el puente privado de Google Sheets…');
  verifyGoogleSheetsBridge(config);
  console.log('Subiendo la salida estática sin eliminar archivos exclusivos del servidor…');
  await uploadDist(config);
  console.log('Restaurando permisos públicos de las carpetas transferidas…');
  normalizeRemotePermissions(config);
  console.log('Verificando las rutas públicas por HTTPS…');
  await verifyPublicSite(config);
  console.log(`Despliegue verificado en https://${publicHostname}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'El despliegue falló.');
  process.exitCode = 1;
});
