import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = fileURLToPath(new URL('..', import.meta.url));
const repositoryRoot = join(websiteRoot, '..');
const deployScript = join(websiteRoot, 'scripts', 'deploy-cpanel.mjs');
const approvedLegacyVocerosHash = 'e3cbffe53c6d6cce453a4aab06e99e19184fb36cba6fa0cc0757a6410959944c';
const replacementEndpointSource = `<?php
declare(strict_types=1);
function voceros_bootstrap() {}
function voceros_handle_request(array $server, array $post): array {
  return ['status' => 200, 'json' => ['open' => true]];
}
`;

function fixtureConfig(overrides = {}) {
  return {
    DEPLOY_SSH_HOST: 'hosting.example.test', DEPLOY_SSH_USER: 'usuario_cpanel',
    DEPLOY_SSH_PORT: '22', DEPLOY_SSH_KEY: '/private/tmp/fixture-key',
    DEPLOY_REMOTE_ROOT: '/home/usuario_cpanel/public_html/complejomushucruna.com',
    DEPLOY_SITE_URL: 'https://complejomushucruna.com',
    FINADOS_APP_ROOT: '/home/usuario_cpanel/apps/finados-api',
    FINADOS_BACKEND_ROOT: '/home/usuario_cpanel/apps/finados-api/current',
    FINADOS_API_DOCROOT: '/home/usuario_cpanel/public_html/finados.complejomushucruna.com',
    FINADOS_CONFIG_PATH: '/home/usuario_cpanel/private-data/finados-backend.json',
    FINADOS_BACKUP_ROOT: '/home/usuario_cpanel/backups/finados-api',
    FINADOS_PUBLIC_ROOTS: '["/home/usuario_cpanel/public_html/complejomushucruna.com","/home/usuario_cpanel/public_html/finados.complejomushucruna.com"]',
    ...overrides,
  };
}

function recordingTransport(overrides = {}) {
  return {
    commands: [], writes: [], output: [], operations: [],
    async repository() { return { branch: 'main', dirty: false, head: 'a'.repeat(40), remoteHead: 'a'.repeat(40), ...overrides.repository }; },
    async run(operation) {
      this.commands.push(operation.command);
      this.operations.push(operation);
      if (operation.write) this.writes.push(operation);
      if (operation.id === overrides.failAt) throw new Error('fixture-password');
      if (operation.id === 'probe') return JSON.stringify({ phpVersion: '8.2.12', phpModules: ['PDO', 'pdo_mysql', 'openssl', 'session'], paths: true, databaseProbe: '1', ...overrides.probe });
      return '';
    },
    async upload(operation) { this.writes.push(operation); },
    async interactive(operation) { this.writes.push(operation); },
    async health() { return { status: 200, ok: true }; },
  };
}

function historicalVocerosEndpoint() {
  const source = execFileSync('git', ['show', 'b85cb0f:website/public/api/voceros/index.php'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  assert.equal(createHash('sha256').update(source).digest('hex'), approvedLegacyVocerosHash);
  return source;
}

async function publicEndpointInstallFixture(existingSource, endpointSource = replacementEndpointSource) {
  const { installPublicBootstrap } = await import('../scripts/deploy-finados-backend.mjs');
  const { publishFrontendFiles } = await import('../scripts/deploy-cpanel.mjs');
  const temp = await mkdtemp(join(tmpdir(), 'finados-first-publish-'));
  await mkdir(join(temp, 'api/voceros'), { recursive: true });
  const endpoint = join(temp, 'api/voceros/index.php');
  if (existingSource !== undefined) await writeFile(endpoint, existingSource);
  const transport = recordingTransport();
  transport.run = async operation => {
    const input = operation.input.replaceAll(
      '/home/usuario_cpanel/public_html/complejomushucruna.com',
      temp,
    );
    const result = spawnSync('php', [], { input, encoding: 'utf8' });
    if (result.status !== 0) throw new Error('fixture install failed');
    return result.stdout;
  };
  const stages = [];
  const publish = () => publishFrontendFiles(fixtureConfig(), {
    endpointSource,
    install: (config, prepared) => installPublicBootstrap(config, transport, { source: prepared }),
    upload: () => stages.push('upload'),
    normalize: () => stages.push('permissions'),
    verify: () => stages.push('HTTPS'),
  });
  return { endpoint, publish, stages };
}

test('backend prevuelo ejecuta lecturas sin migración ni escritura y devuelve salud del subdominio', async () => {
  const { checkBackend } = await import('../scripts/deploy-finados-backend.mjs');
  const transport = recordingTransport();
  const result = await checkBackend(fixtureConfig(), transport);
  assert.equal(result.healthUrl, 'https://finados.complejomushucruna.com/api/health');
  assert.equal(result.database, 'ready');
  assert.equal(transport.writes.length, 0);
  assert.ok(transport.commands.every(command => !command.includes('--delete') && !command.includes('rm -rf')));
  assert.doesNotMatch(transport.output.join('\n'), /fixture-password|fixture-key/);
});

test('backend prevuelo bloquea rama, cambios, divergencia, PHP, módulos y DB inválidos', async () => {
  const { checkBackend } = await import('../scripts/deploy-finados-backend.mjs');
  for (const overrides of [
    { repository: { branch: 'feature' } }, { repository: { dirty: true } }, { repository: { remoteHead: 'b'.repeat(40) } },
    { probe: { phpVersion: '8.0.30' } }, { probe: { phpModules: ['PDO'] } },
    { probe: { paths: false } }, { probe: { databaseProbe: '0' } }, { failAt: 'probe' },
  ]) {
    const transport = recordingTransport(overrides);
    await assert.rejects(checkBackend(fixtureConfig(), transport), error => !error.message.includes('fixture-password'));
    assert.equal(transport.writes.length, 0);
  }
});

test('backend rechaza rutas públicas, amplias o ambiguas antes de conectar', async () => {
  const { checkBackend } = await import('../scripts/deploy-finados-backend.mjs');
  for (const overrides of [
    { FINADOS_APP_ROOT: '/' }, { FINADOS_CONFIG_PATH: '/home/usuario_cpanel/public_html/config.json' },
    { FINADOS_API_DOCROOT: '/home/usuario_cpanel' }, { FINADOS_BACKEND_ROOT: '/home/usuario_cpanel/apps/finados-api' },
    { FINADOS_PUBLIC_ROOTS: '[]' }, { FINADOS_BACKUP_ROOT: '/home/usuario_cpanel/apps/finados-api/backups' },
  ]) await assert.rejects(checkBackend(fixtureConfig(overrides), recordingTransport()));
});

test('backend acepta el docroot exacto de cPanel como carpeta hermana de public_html', async () => {
  const { checkBackend } = await import('../scripts/deploy-finados-backend.mjs');
  const config = fixtureConfig({
    FINADOS_API_DOCROOT: '/home/usuario_cpanel/finados.complejomushucruna.com',
    FINADOS_PUBLIC_ROOTS: '["/home/usuario_cpanel/public_html/complejomushucruna.com","/home/usuario_cpanel/finados.complejomushucruna.com"]',
  });
  assert.equal((await checkBackend(config, recordingTransport())).database, 'ready');
});

test('backend despliega solo después de respaldo y no activa current si falla migración', async () => {
  const { deployBackend } = await import('../scripts/deploy-finados-backend.mjs');
  const transport = recordingTransport();
  await deployBackend(fixtureConfig(), transport, { release: '20260914-abcdef' });
  const ids = transport.writes.map(item => item.id);
  assert.ok(ids.indexOf('backup-files') < ids.indexOf('backup-database'));
  assert.ok(ids.indexOf('backup-database') < ids.indexOf('upload-release'));
  assert.ok(ids.indexOf('migrate') < ids.indexOf('activate'));
  assert.ok(ids.indexOf('activate') < ids.indexOf('install-api'));
  const failed = recordingTransport({ failAt: 'migrate' });
  await assert.rejects(deployBackend(fixtureConfig(), failed, { release: '20260914-abcdef' }));
  assert.ok(!failed.writes.some(item => item.id === 'activate'));
  const backupFailed = recordingTransport({ failAt: 'backup-database' });
  await assert.rejects(deployBackend(fixtureConfig(), backupFailed, { release: '20260914-abcdef' }));
  assert.ok(!backupFailed.writes.some(item => item.id === 'upload-release'));
});

test('backend admin exige TTY e importación real ejecuta primero dry-run', async () => {
  const { administerBackend, importBackend } = await import('../scripts/deploy-finados-backend.mjs');
  const transport = recordingTransport();
  await assert.rejects(administerBackend(fixtureConfig(), transport, { tty: false }));
  assert.equal(transport.writes.length, 0);
  await administerBackend(fixtureConfig(), transport, { tty: true });
  assert.equal(transport.writes[0].id, 'admin');
  assert.equal(transport.writes[0].capture, false);
  const options = { voceros: '/home/usuario_cpanel/private-data/voceros.csv', consents: '/home/usuario_cpanel/private-data/consents.csv' };
  const preview = recordingTransport();
  await importBackend(fixtureConfig(), preview, options);
  assert.equal(preview.writes.length, 0);
  const real = recordingTransport();
  await importBackend(fixtureConfig(), real, { ...options, execute: true });
  assert.equal(real.writes.at(-1).id, 'import');
  assert.match(real.commands[0], /--dry-run/);
});

test('backend todos los programas PHP enviados por SSH compilan con el intérprete real', async () => {
  const { deployBackend, installPublicBootstrap } = await import('../scripts/deploy-finados-backend.mjs');
  const transport = recordingTransport();
  await deployBackend(fixtureConfig(), transport, { release: '20260914-abcdef' });
  await installPublicBootstrap(fixtureConfig(), transport);
  for (const operation of transport.operations.filter(item => item.input)) {
    const result = spawnSync('php', ['-l'], { input: operation.input, encoding: 'utf8' });
    assert.equal(result.status, 0, `${operation.id}: ${result.stdout} ${result.stderr}`);
  }
});

test('backend primer despliegue migra atómicamente el endpoint histórico exacto aprobado', async () => {
  const historical = historicalVocerosEndpoint();
  const fixture = await publicEndpointInstallFixture(historical);

  await fixture.publish();

  const installed = await readFile(fixture.endpoint, 'utf8');
  assert.notEqual(installed, historical);
  assert.match(installed, /FINADOS MANAGED BOOTSTRAP BEGIN/);
  assert.deepEqual(fixture.stages, ['upload', 'permissions', 'HTTPS']);
});

test('backend primer despliegue conserva el endpoint histórico si el reemplazo no pasa salud', async () => {
  const historical = historicalVocerosEndpoint();
  const unhealthySource = replacementEndpointSource.replace("'status' => 200", "'status' => 503");
  const fixture = await publicEndpointInstallFixture(historical, unhealthySource);

  await assert.rejects(fixture.publish());

  assert.equal(await readFile(fixture.endpoint, 'utf8'), historical);
  assert.deepEqual(await readdir(join(fixture.endpoint, '..')), ['index.php']);
  assert.deepEqual(fixture.stages, []);
});

test('backend primer despliegue se detiene si falta el endpoint histórico esperado', async () => {
  const fixture = await publicEndpointInstallFixture(undefined);

  await assert.rejects(fixture.publish());

  assert.deepEqual(await readdir(join(fixture.endpoint, '..')), []);
  assert.deepEqual(fixture.stages, []);
});

test('backend primer despliegue rechaza una variación de un byte del endpoint histórico', async () => {
  const historical = historicalVocerosEndpoint();
  const changed = historical.replace('MUSHUC_API_ENTRY', 'NUSHUC_API_ENTRY');
  assert.equal(Buffer.byteLength(changed), Buffer.byteLength(historical));
  assert.notEqual(createHash('sha256').update(changed).digest('hex'), approvedLegacyVocerosHash);
  const fixture = await publicEndpointInstallFixture(changed);

  await assert.rejects(fixture.publish());

  assert.equal(await readFile(fixture.endpoint, 'utf8'), changed);
  assert.deepEqual(fixture.stages, []);
});

test('backend primer despliegue no confía en una cadena genérica dentro de una aplicación ajena', async () => {
  const foreign = "<?php\n// voceros_bootstrap\necho 'aplicación ajena';\n";
  const fixture = await publicEndpointInstallFixture(foreign);

  await assert.rejects(fixture.publish());

  assert.equal(await readFile(fixture.endpoint, 'utf8'), foreign);
  assert.deepEqual(fixture.stages, []);
});

test('backend prepara el mismo endpoint administrado sin alterar bytes en reintentos', async () => {
  const { preparePublicEndpoint } = await import('../scripts/deploy-finados-backend.mjs');
  const prepared = preparePublicEndpoint(fixtureConfig(), replacementEndpointSource);

  assert.equal(preparePublicEndpoint(fixtureConfig(), prepared), prepared);
});

test('backend bootstrap real conserva PHP strict_types e instalación repetida', async () => {
  const { installPublicBootstrap } = await import('../scripts/deploy-finados-backend.mjs');
  const temp = await mkdtemp(join(tmpdir(), 'finados-bootstrap-'));
  await mkdir(join(temp, 'api/voceros'), { recursive: true });
  const endpoint = join(temp, 'api/voceros/index.php');
  await writeFile(endpoint, historicalVocerosEndpoint());
  const source = replacementEndpointSource
    + "if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) echo getenv('FINADOS_BACKEND_ROOT');\n";
  const transport = recordingTransport();
  await installPublicBootstrap(fixtureConfig(), transport, { source });
  for (let i = 0; i < 2; i++) {
    const input = transport.operations[0].input.replaceAll('/home/usuario_cpanel/public_html/complejomushucruna.com', temp)
      .replaceAll('.finados-', `.finados-${i}-`);
    const result = spawnSync('php', [], { input, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const endpointResult = spawnSync('php', [endpoint], { encoding: 'utf8' });
    assert.equal(endpointResult.status, 0, endpointResult.stderr);
    assert.equal(endpointResult.stdout, '/home/usuario_cpanel/apps/finados-api/current');
  }
});

test('backend activación sin symlinks conserva current anterior y publica una copia completa', async () => {
  const { deployBackend } = await import('../scripts/deploy-finados-backend.mjs');
  const { mkdir } = await import('node:fs/promises');
  const temp = await mkdtemp(join(tmpdir(), 'finados-activate-'));
  await mkdir(join(temp, 'releases/20260914-abcdef/src'), { recursive: true });
  await mkdir(join(temp, 'current/src'), { recursive: true });
  await writeFile(join(temp, 'current/src/old.php'), 'old');
  await writeFile(join(temp, 'releases/20260914-abcdef/src/new.php'), 'new');
  const transport = recordingTransport();
  await deployBackend(fixtureConfig(), transport, { release: '20260914-abcdef' });
  const input = transport.operations.find(item => item.id === 'activate').input.replaceAll('/home/usuario_cpanel/apps/finados-api', temp);
  const result = spawnSync('php', ['-d', 'disable_functions=symlink'], { input, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(join(temp, 'current/src/new.php'), 'utf8'), 'new');
  assert.equal(await readFile(join(temp, 'previous-20260914-abcdef/src/old.php'), 'utf8'), 'old');
});

test('backend gateway real carga la release y preserva directivas ajenas del subdominio', async () => {
  const { deployBackend } = await import('../scripts/deploy-finados-backend.mjs');
  const { mkdir } = await import('node:fs/promises');
  const temp = await mkdtemp(join(tmpdir(), 'finados-gateway-'));
  await mkdir(join(temp, 'docroot/api'), { recursive: true });
  await mkdir(join(temp, 'current/public'), { recursive: true });
  await writeFile(join(temp, 'current/public/index.php'), "<?php echo getenv('FINADOS_CONFIG_PATH');");
  await writeFile(join(temp, 'docroot/api/.htaccess'), '# hosting-owned\nHeader set X-Test yes\n');
  const transport = recordingTransport();
  await deployBackend(fixtureConfig(), transport, { release: '20260914-abcdef' });
  const input = transport.operations.find(item => item.id === 'install-api').input
    .replaceAll('/home/usuario_cpanel/public_html/finados.complejomushucruna.com', join(temp, 'docroot'))
    .replaceAll('/home/usuario_cpanel/apps/finados-api/current', join(temp, 'current'));
  const result = spawnSync('php', [], { input, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const response = spawnSync('php', [join(temp, 'docroot/api/index.php')], { encoding: 'utf8' });
  assert.equal(response.status, 0, response.stderr);
  assert.equal(response.stdout, '/home/usuario_cpanel/private-data/finados-backend.json');
  assert.ok((await readFile(join(temp, 'docroot/api/.htaccess'), 'utf8')).startsWith('# hosting-owned\nHeader set X-Test yes\n'));
  await writeFile(join(temp, 'docroot/api/index.php'), '<?php echo "another application";');
  const rejected = spawnSync('php', [], { input, encoding: 'utf8' });
  assert.notEqual(rejected.status, 0);
  assert.equal(await readFile(join(temp, 'docroot/api/index.php'), 'utf8'), '<?php echo "another application";');
});

test('backend bootstrap no sigue un ancestro API que apunta fuera del docroot', async () => {
  const { installPublicBootstrap } = await import('../scripts/deploy-finados-backend.mjs');
  const { mkdir, symlink } = await import('node:fs/promises');
  const temp = await mkdtemp(join(tmpdir(), 'finados-alias-'));
  await mkdir(join(temp, 'docroot'));
  await mkdir(join(temp, 'outside/voceros'), { recursive: true });
  const endpoint = join(temp, 'outside/voceros/index.php');
  const original = '<?php function voceros_bootstrap() {}';
  await writeFile(endpoint, original);
  await symlink(join(temp, 'outside'), join(temp, 'docroot/api'));
  const transport = recordingTransport();
  await installPublicBootstrap(fixtureConfig(), transport);
  const input = transport.operations[0].input.replaceAll('/home/usuario_cpanel/public_html/complejomushucruna.com', join(temp, 'docroot'));
  const result = spawnSync('php', [], { input, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.equal(await readFile(endpoint, 'utf8'), original);
});

test('backend migración aplica versiones posteriores en orden y no repite las registradas', async () => {
  const { deployBackend } = await import('../scripts/deploy-finados-backend.mjs');
  const { mkdir } = await import('node:fs/promises');
  const temp = await mkdtemp(join(tmpdir(), 'finados-migrations-'));
  await mkdir(join(temp, 'src'));
  await mkdir(join(temp, 'migrations'));
  await writeFile(join(temp, 'src/Config.php'), '<?php namespace Finados; class Config { static function fromProductionEnvironment() { return null; } }');
  await writeFile(join(temp, 'src/Database.php'), `<?php namespace Finados;
class Database { static function connect($config) { return new MigrationDatabase(); } }
class MigrationDatabase {
  function query($sql) { return new class { function fetchColumn() { return 1; } }; }
  function exec($sql) { echo json_encode(['sql'=>$sql]) . "\\n"; }
  function prepare($sql) { return new MigrationStatement($sql); }
}
class MigrationStatement {
  private $value;
  function __construct(private $sql) {}
  function execute($args) {
    $this->value = $args[0];
    if (str_starts_with($this->sql, 'INSERT')) {
      file_put_contents(__DIR__ . '/versions', $args[0] . "\\n", FILE_APPEND);
      echo json_encode(['version'=>$args[0]]) . "\\n";
    }
  }
  function fetchColumn() { return in_array($this->value, file_exists(__DIR__.'/versions') ? file(__DIR__.'/versions', FILE_IGNORE_NEW_LINES) : []) ? $this->value : false; }
}`);
  await writeFile(join(temp, 'migrations/001_initial_mysql.sql'), 'CREATE TABLE initial_table (id INT);');
  await writeFile(join(temp, 'migrations/002_later_mysql.sql'), 'CREATE TABLE later_table (id INT);');
  const transport = recordingTransport();
  await deployBackend(fixtureConfig(), transport, { release: '20260914-abcdef' });
  const input = transport.operations.find(item => item.id === 'migrate').input
    .replaceAll('/home/usuario_cpanel/apps/finados-api/releases/20260914-abcdef', temp);
  const first = spawnSync('php', [], { input, encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  const output = first.stdout.trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(output.filter(item => item.version).map(item => item.version), ['001_initial_mysql', '002_later_mysql']);
  assert.ok(output.some(item => item.sql?.includes('later_table')));
  const second = spawnSync('php', [], { input, encoding: 'utf8' });
  assert.equal(second.status, 0, second.stderr);
  assert.ok(!second.stdout.includes('later_table'));
  assert.ok(!second.stdout.includes('"version"'));
});

test('backend frontend mantiene Voceros abierto si la transferencia o la etapa posterior se interrumpe', async () => {
  const { publishFrontendFiles, uploadVocerosRegistrationConfig } = await import('../scripts/deploy-cpanel.mjs');
  const { mkdir, copyFile } = await import('node:fs/promises');
  const temp = await mkdtemp(join(tmpdir(), 'finados-publish-'));
  await mkdir(join(temp, 'dist/api/voceros'), { recursive: true });
  await mkdir(join(temp, 'live/api/voceros'), { recursive: true });
  await mkdir(join(temp, 'private'), { mode: 0o700 });
  await mkdir(join(temp, 'backend/src'), { recursive: true });
  const endpoint = join(temp, 'live/api/voceros/index.php');
  const source = await readFile(join(websiteRoot, 'public/api/voceros/index.php'), 'utf8');
  await writeFile(join(temp, 'dist/api/voceros/index.php'), source);
  await copyFile(join(websiteRoot, 'public/api/_voceros-bootstrap.php'), join(temp, 'dist/api/_voceros-bootstrap.php'));
  for (const name of ['Config', 'Crypto']) await copyFile(join(websiteRoot, `backend/finados-api/src/${name}.php`), join(temp, `backend/src/${name}.php`));
  // Keep the endpoint, bootstrap, Config, Crypto and legal reader real. Only the DB
  // boundary and repository constructors are replaced: GET does not consume records.
  await writeFile(join(temp, 'backend/src/Database.php'), '<?php namespace Finados; class Database { static function connect($config) { return new \\stdClass(); } }');
  for (const name of ['Audit', 'VocerosRepository']) await writeFile(join(temp, `backend/src/${name}.php`), `<?php namespace Finados; class ${name} { function __construct(...$args) {} }`);
  await writeFile(join(temp, 'private/backend.json'), JSON.stringify({
    environment: 'production', databaseDsn: 'mysql:host=localhost;dbname=fixture', databaseUser: 'fixture', databasePassword: 'fixture',
    allowedOrigin: 'https://complejomushucruna.com', encryptionKey: Buffer.alloc(32, 'e').toString('base64'), hmacKey: Buffer.alloc(32, 'h').toString('base64'),
  }));
  await writeFile(join(temp, 'dist/other.html'), 'other');
  const mapPaths = input => input.replaceAll('/home/usuario_cpanel/public_html/complejomushucruna.com', join(temp, 'live'))
    .replaceAll('/home/usuario_cpanel/private-data/finados-backend.json', join(temp, 'private/backend.json'))
    .replaceAll('/home/usuario_cpanel/apps/finados-api/current', join(temp, 'backend'));
  const readResponse = () => {
    const response = spawnSync('php', ['-r', `$_SERVER['REQUEST_METHOD']='GET'; require '${endpoint}'; $response = voceros_handle_request($_SERVER, []); echo json_encode($response);`],
      { encoding: 'utf8', env: { ...process.env, FINADOS_CONFIG_PATH: '', FINADOS_BACKEND_ROOT: '' } });
    assert.equal(response.status, 0, response.stderr);
    const parsed = JSON.parse(response.stdout);
    return { status: parsed.status, open: parsed.json.open };
  };
  // The old endpoint is configured and working before either simulated failure.
  const backendModule = await import('../scripts/deploy-finados-backend.mjs');
  await uploadVocerosRegistrationConfig(fixtureConfig(), { async run({ command, input }) {
    const result = spawnSync('sh', ['-c', command.replaceAll('/home/usuario_cpanel/private-data', join(temp, 'private'))], { input });
    assert.equal(result.status, 0);
  } });
  await writeFile(endpoint, mapPaths(backendModule.preparePublicEndpoint(fixtureConfig(), source)));
  assert.deepEqual(readResponse(), { status: 200, open: true });
  const transport = recordingTransport();
  transport.run = async operation => {
    const input = mapPaths(operation.input);
    const result = spawnSync('php', [], { input, encoding: 'utf8' });
    if (result.status !== 0) throw new Error('install failed');
    return result.stdout;
  };
  const stages = [];
  const upload = async (_config, { archiveArgs }) => {
    const args = archiveArgs.map(value => value.endsWith('/website/dist') ? join(temp, 'dist') : value);
    const archive = spawnSync('tar', args);
    assert.equal(archive.status, 0);
    const extraction = spawnSync('tar', ['-xf', '-', '-C', join(temp, 'live')], { input: archive.stdout });
    assert.equal(extraction.status, 0);
    // A partial helper write cannot break an endpoint with embedded dependencies.
    await writeFile(join(temp, 'live/api/_voceros-bootstrap.php'), '<?php invalid truncated transfer');
    assert.deepEqual(readResponse(), { status: 200, open: true });
    stages.push('uploaded');
  };
  for (const failure of ['upload', 'after-transfer']) {
    await assert.rejects(publishFrontendFiles(fixtureConfig(), {
      endpointSource: source,
      install: async (config, prepared) => backendModule.installPublicBootstrap(config, transport, { source: prepared }),
      upload: async (...args) => { await upload(...args); if (failure === 'upload') throw new Error('connection lost'); },
      normalize: () => { throw new Error('after-transfer'); },
      verify: () => assert.fail('verification must not run after interruption'),
    }));
    assert.deepEqual(readResponse(), { status: 200, open: true });
  }
  assert.equal(stages.length, 2);
  const previous = await readFile(endpoint, 'utf8');
  for (const badSource of [
    source.replace('declare(strict_types=1);', 'declare(strict_types=1); invalid PHP'),
    source.replace('function registration_config(string $directory): ?array\n{', 'function registration_config(string $directory): ?array\n{\n return null;'),
  ]) {
    await assert.rejects(publishFrontendFiles(fixtureConfig(), {
      endpointSource: badSource,
      install: async (config, prepared) => backendModule.installPublicBootstrap(config, transport, { source: prepared }),
      upload: () => assert.fail('do not transfer after failed preparation'),
    }));
    assert.equal(await readFile(endpoint, 'utf8'), previous);
    assert.deepEqual(readResponse(), { status: 200, open: true });
  }
});

test('backend configuración legal usa la carpeta privada alternativa del JSON canónico', async () => {
  const { uploadVocerosRegistrationConfig } = await import('../scripts/deploy-cpanel.mjs');
  const { validateBackendConfig } = await import('../scripts/deploy-finados-backend.mjs');
  const temp = await mkdtemp(join(tmpdir(), 'finados-config-directory-'));
  const config = validateBackendConfig(fixtureConfig({ FINADOS_CONFIG_PATH: '/home/usuario_cpanel/secrets/backend.json' }));
  const transport = { async run({ command, input }) {
    const result = spawnSync('sh', ['-c', command.replaceAll('/home/usuario_cpanel/secrets', temp)], { input, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  } };
  await uploadVocerosRegistrationConfig(config, transport);
  const legal = JSON.parse(await readFile(join(temp, 'voceros-registration.json'), 'utf8'));
  assert.equal(legal.enabled, true);
  const code = `<?php require '${join(websiteRoot, 'public/api/voceros/index.php').replaceAll("'", "\\'")}'; echo json_encode(registration_config('${temp}'));`;
  const result = spawnSync('php', [], { input: code, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).enabled, true);
});

async function configFixture(overrides = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'mushuc-deploy-'));
  const keyFile = join(directory, 'id_rsa_complejo');
  const configFile = join(directory, '.env.deploy');
  await writeFile(keyFile, 'llave-ficticia-para-prueba\n', { mode: 0o600 });

  const config = {
    DEPLOY_SSH_HOST: 'hosting.example.test',
    DEPLOY_SSH_USER: 'usuario_prueba',
    DEPLOY_SSH_PORT: '22',
    DEPLOY_SSH_KEY: keyFile,
    DEPLOY_REMOTE_ROOT: '/home/usuario_prueba/public_html/complejomushucruna.com',
    DEPLOY_SITE_URL: 'https://complejomushucruna.com',
    ...overrides,
  };

  await writeFile(configFile, `${Object.entries(config).map(([key, value]) => `${key}=${value}`).join('\n')}\n`);
  return { configFile, keyFile };
}

test('valida una configuración local sin imprimir credenciales', async () => {
  const { configFile, keyFile } = await configFixture();
  const result = spawnSync(process.execPath, [deployScript, '--validate-config', configFile], {
    cwd: websiteRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Configuración válida para complejomushucruna\.com/);
  assert.doesNotMatch(result.stdout, /hosting\.example\.test|usuario_prueba|id_rsa_complejo/);
  assert.doesNotMatch(result.stderr, new RegExp(keyFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('rechaza un destino remoto amplio antes de conectarse', async () => {
  const { configFile } = await configFixture({ DEPLOY_REMOTE_ROOT: '/' });
  const result = spawnSync(process.execPath, [deployScript, '--validate-config', configFile], {
    cwd: websiteRoot,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEPLOY_REMOTE_ROOT debe apuntar al docroot exacto/);
});

test('valida la configuración privada de Google Sheets como un par inseparable', async () => {
  const { configFile } = await configFixture({
    GOOGLE_SHEETS_WEB_APP_URL: 'https://script.google.com/macros/s/implementacion/exec',
  });
  const result = spawnSync(process.execPath, [deployScript, '--validate-config', configFile], {
    cwd: websiteRoot,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /deben configurarse juntos/);
});

test('acepta una URL publicada y un token fuerte sin mostrarlos', async () => {
  const token = 'a'.repeat(64);
  const webAppUrl = 'https://script.google.com/macros/s/implementacion/exec';
  const { configFile } = await configFixture({
    GOOGLE_SHEETS_WEB_APP_URL: webAppUrl,
    GOOGLE_SHEETS_TOKEN: token,
  });
  const result = spawnSync(process.execPath, [deployScript, '--validate-config', configFile], {
    cwd: websiteRoot,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(`${token}|${webAppUrl}`));
});

test('git ignora nombres habituales de llaves privadas aunque no tengan extensión', () => {
  for (const filename of ['id_rsa', 'id_ed25519', 'id_rsa_complejo']) {
    const output = execFileSync('git', ['check-ignore', '--no-index', filename], {
      cwd: join(websiteRoot, '..'),
      encoding: 'utf8',
    });
    assert.equal(output.trim(), filename);
  }
});

test('normaliza permisos de carpetas después de la transferencia y antes de verificar HTTPS', async () => {
  const { publishFrontendFiles } = await import('../scripts/deploy-cpanel.mjs');
  const stages = [];
  await publishFrontendFiles(fixtureConfig(), {
    endpointSource: '<?php function voceros_bootstrap() {}',
    install: () => stages.push('install'), upload: () => stages.push('upload'),
    normalize: () => stages.push('permissions'), verify: () => stages.push('HTTPS'),
  });
  assert.deepEqual(stages, ['install', 'upload', 'permissions', 'HTTPS']);
});

test('transfiere dist por el mismo cliente SSH sin depender de SCP en Windows', async () => {
  const source = await readFile(deployScript, 'utf8');

  assert.match(source, /spawn\('tar'/);
  assert.match(source, /localTar\.stdout\.pipe\(remoteTar\.stdin\)/);
  assert.match(source, /tar -xf - -C/);
  assert.doesNotMatch(source, /run\('scp'/);
});

test('sincroniza únicamente main sin descargar etiquetas ni ejecutar mantenimiento', async () => {
  const source = await readFile(deployScript, 'utf8');

  assert.match(
    source,
    /run\('git', \['fetch', '--no-auto-maintenance', '--no-tags', 'origin', 'main'\]/,
  );
  assert.doesNotMatch(source, /run\('git', \['fetch', 'origin'\]/);
});

test('la verificación completa conserva serialización y todas las suites del proyecto', async () => {
  const packageConfig = JSON.parse(await readFile(join(websiteRoot, 'package.json'), 'utf8'));

  assert.equal(packageConfig.scripts['test:node'], 'node --test --test-concurrency=1 tests/*.test.mjs');
  assert.equal(packageConfig.scripts['test:php'], 'php backend/finados-api/tests/run.php');
  assert.equal(packageConfig.scripts.test, 'npm run test:node && npm run test:php');
  assert.equal(packageConfig.scripts['test:integration'], 'node --test --test-concurrency=1 tests/integration/*.test.mjs');
  assert.equal(packageConfig.scripts.check, 'npm test && npm run test:integration && npm run build && node scripts/check-dist.mjs');
});

test('el preflight frontend ejecuta una sola vez la verificación completa del proyecto', async () => {
  const deployModule = await import('../scripts/deploy-cpanel.mjs');
  assert.equal(typeof deployModule.runProjectChecks, 'function');
  const calls = [];
  let checkedDist = '';

  await deployModule.runProjectChecks({
    execute(command, args, options) {
      calls.push({ command, args, cwd: options.cwd });
    },
    ensureDist: async path => { checkedDist = path; },
  });

  assert.deepEqual(calls, [{
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['run', 'check'],
    cwd: join(websiteRoot, '.'),
  }]);
  assert.equal(checkedDist, join(websiteRoot, 'dist/index.html'));
});

test('el despliegue verifica las páginas, habilita Voceros y conserva su configuración fuera del sitio público', async () => {
  const source = await readFile(deployScript, 'utf8');

  assert.match(source, /\['\/acreditacion-de-medios\/', 200\]/);
  assert.match(source, /\['\/api\/acreditacion-medios\/', 200\]/);
  assert.match(source, /\['\/finados\/voceros\/', 200\]/);
  assert.match(source, /\['\/finados\/voceros\/politicas-del-vocero\/', 200\]/);
  assert.match(source, /\['\/finados\/voceros\/politica-de-privacidad\/', 200\]/);
  assert.match(source, /\['\/finados\/voceros\/ejercer-derechos\/', 200\]/);
  assert.match(source, /\['\/api\/voceros\/', 200\]/);
  assert.match(source, /\['\/assets\/finados\/voceros\.css', 200\]/);
  assert.match(source, /payload\.open !== true/);
  assert.match(source, /uploadVocerosRegistrationConfig\(config\)/);
  assert.match(source, /voceros-registration\.json/);
  assert.match(source, /Eventos Finados 2026/);
  assert.match(source, /retentionYears: 3/);
  assert.match(source, /command -v php/);
  assert.match(source, /function_exists\(\"mail\"\)/);
  assert.match(source, /target, 'php -l'/);
  assert.match(source, /lintPhpEndpoints\(config\)/);
  assert.match(source, /_google-sheets\.php/);
  assert.doesNotMatch(source, /uploadGoogleSheetsConfig\(config\)/);
  assert.match(source, /verifyGoogleSheetsBridge\(config\)/);
  assert.match(source, /verificacion-sin-escritura/);
});
