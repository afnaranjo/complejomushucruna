import { execFileSync, spawn, spawnSync } from 'node:child_process';
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
]);

function fail(message) {
  throw new Error(message);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? websiteRoot,
    encoding: 'utf8',
    stdio: options.silent ? 'ignore' : ['ignore', 'pipe', 'pipe'],
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

  for (const key of allowedKeys) {
    if (!Object.hasOwn(config, key)) fail(`Falta la variable requerida ${key}.`);
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
  const command = `test -d ${config.DEPLOY_REMOTE_ROOT} && test -w ${config.DEPLOY_REMOTE_ROOT}`;
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
  }
}

async function runProjectChecks() {
  console.log('Construyendo y validando el sitio…');
  const testDirectory = join(websiteRoot, 'tests');
  const testFiles = (await readdir(testDirectory))
    .filter((file) => file.endsWith('.test.mjs'))
    .map((file) => join(testDirectory, file));
  run(process.execPath, ['--test', ...testFiles], { cwd: websiteRoot, label: 'Las pruebas locales' });
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

  if (mode === '--check') {
    console.log(`Prevuelo completo para ${publicHostname}; no se modificó el servidor.`);
    return;
  }

  console.log('Creando una copia de seguridad recuperable en el servidor…');
  backupRemote(config);
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
