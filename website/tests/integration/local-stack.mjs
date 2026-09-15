import { spawn } from 'node:child_process';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import { buildSite } from '../../scripts/build.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const website = resolve(here, '../..');
const cleanEnv = () => ({ PATH: process.env.PATH, LANG: 'en_US.UTF-8' });
async function freePort() {
  const server = createServer();
  await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
  const port = server.address().port;
  await new Promise((yes) => server.close(yes));
  return port;
}
function fixture(input) {
  return new Promise((yes, no) => {
    const child = spawn('php', [join(here, 'fixture.php')], { env: cleanEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.resume();
    child.once('error', no);
    child.once('exit', (code) => code === 0 ? yes(output) : no(new Error('Private fixture operation failed.')));
    child.stdin.end(JSON.stringify(input));
  });
}
async function ready(url, child) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error('Local PHP server exited.');
    try { if ((await fetch(url, { signal: AbortSignal.timeout(500) })).ok) return; } catch {}
    await new Promise((yes) => setTimeout(yes, 30));
  }
  throw new Error('Local PHP server did not become ready.');
}

/** Owns only its fresh temp directory and the two PHP processes it spawns. No real credentials. */
export async function startLocalStack() {
  const root = await mkdtemp(join(tmpdir(), 'voceros-http-integration-'));
  await chmod(root, 0o700);
  const privateDirectory = join(root, 'private');
  const sessions = join(privateDirectory, 'sessions');
  await mkdir(sessions, { recursive: true, mode: 0o700 });
  const configPath = join(privateDirectory, 'config.json');
  const credentials = { username: 'admin', password: randomBytes(24).toString('base64url') };
  const children = [];
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    await Promise.all(children.map((child) => new Promise((done) => {
      if (child.exitCode !== null || child.signalCode !== null) return done();
      const timeout = setTimeout(() => child.kill('SIGKILL'), 1500);
      child.once('exit', () => { clearTimeout(timeout); done(); });
      child.kill('SIGTERM');
    })));
    await rm(root, { recursive: true, force: true });
  };
  try {
    const publicPort = await freePort();
    let apiPort = await freePort();
    while (apiPort === publicPort) apiPort = await freePort();
    const publicOrigin = `http://127.0.0.1:${publicPort}`;
    const apiOrigin = `http://127.0.0.1:${apiPort}`;
    const config = { environment: 'test', databaseDsn: `sqlite:${join(privateDirectory, 'voceros.sqlite')}`,
      databaseUser: '', databasePassword: '', allowedOrigin: publicOrigin,
      encryptionKey: randomBytes(32).toString('base64'), hmacKey: randomBytes(32).toString('base64') };
    await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
    await writeFile(join(privateDirectory, 'credentials.json'), JSON.stringify(credentials), { mode: 0o600 });
    await writeFile(join(privateDirectory, 'voceros-registration.json'), JSON.stringify({ enabled: true,
      responsable: 'Organización sintética', direccion: 'Dirección de prueba', telefono: '0000000000',
      contactEmail: 'legal@example.invalid', policiesVersion: 'test-policy', thermometerVersion: 'test-bases',
      imageVersion: 'test-image', privacyVersion: 'test-data', retentionYears: 3 }), { mode: 0o600 });
    await fixture({ action: 'init', config: configPath, password: credentials.password });
    const dist = join(root, 'dist');
    await buildSite(dist, { adminEnvironment: 'development', adminApiBase: `${apiOrigin}/api` });
    // No Sheets config is supplied: the real transport leaves the encrypted DB outbox pending.
    for (const [port, router] of [[publicPort, 'public-router.php'], [apiPort, 'api-router.php']]) {
      const child = spawn('php', ['-d', 'display_errors=0', '-d', `session.save_path=${sessions}`,
        '-d', `error_log=${join(privateDirectory, 'php.log')}`, '-S', `127.0.0.1:${port}`, '-t', dist, join(here, router)],
      { cwd: website, env: { ...cleanEnv(), VOCEROS_TEST_CONFIG: configPath }, stdio: ['ignore', 'ignore', 'pipe'] });
      children.push(child);
      child.stderr.resume();
      child.on('error', () => {});
    }
    await ready(`${apiOrigin}/api/health`, children[1]);
    await ready(`${publicOrigin}/api/voceros/`, children[0]);
    return { root, dist, privateDirectory, configPath, publicOrigin, apiOrigin, credentials, stop,
      inspect: async () => JSON.parse(await fixture({ action: 'inspect', config: configPath })) };
  } catch (error) { await stop(); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stack = await startLocalStack();
  const manifest = join(stack.root, 'local-stack.json');
  await writeFile(manifest, JSON.stringify({ publicOrigin: stack.publicOrigin, apiOrigin: stack.apiOrigin,
    credentialsPath: join(stack.privateDirectory, 'credentials.json') }), { mode: 0o600 });
  console.log(`Frontend: ${stack.publicOrigin}/admin/\nAPI: ${stack.apiOrigin}/api/health\nManifest privado: ${manifest}\nSolo HTTP local; TLS/Secure requieren verificación separada. Ctrl+C limpia los procesos y temporales propios.`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await stack.stop(); process.exit(0); });
}
