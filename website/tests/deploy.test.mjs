import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const websiteRoot = fileURLToPath(new URL('..', import.meta.url));
const deployScript = join(websiteRoot, 'scripts', 'deploy-cpanel.mjs');

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
  const source = await readFile(deployScript, 'utf8');
  const uploadIndex = source.indexOf('uploadDist(config);');
  const permissionsIndex = source.indexOf('normalizeRemotePermissions(config);');
  const verificationIndex = source.indexOf('await verifyPublicSite(config);');

  assert.ok(uploadIndex >= 0);
  assert.ok(permissionsIndex > uploadIndex);
  assert.ok(verificationIndex > permissionsIndex);
  assert.match(source, /-perm 0700/);
  assert.match(source, /\.well-known/);
  assert.match(source, /cgi-bin/);
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
