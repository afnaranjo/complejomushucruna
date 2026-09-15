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
const alive = (child) => child.exitCode === null && child.signalCode === null && child.pid;
async function terminate(child) {
  if (!alive(child)) return;
  await new Promise((done) => {
    const timeout = setTimeout(() => child.kill('SIGKILL'), 1500);
    child.once('exit', () => { clearTimeout(timeout); done(); });
    child.kill('SIGTERM');
  });
}
async function release(server) {
  if (server.listening) await new Promise((yes) => server.close(yes));
}

/** Test-only owner: signals, jobs and reservations precede every filesystem operation. */
export async function startLocalStack({ onStage = async () => {} } = {}) {
  const abort = new AbortController();
  const children = [], reservations = [];
  const jobs = new Set();
  let root, stopPromise, finishStartup;
  const startupDone = new Promise((resolve) => { finishStartup = resolve; });
  const cancelled = new Promise((_, reject) => abort.signal.addEventListener('abort', () => reject(new Error('Local stack cancelled.')), { once: true }));
  cancelled.catch(() => {});
  const stop = () => {
    if (stopPromise) return stopPromise;
    abort.abort();
    stopPromise = (async () => {
      await Promise.all(children.map(terminate));
      await startupDone;
      // Await an in-progress build (and its Tailwind children) before removing its output.
      await Promise.allSettled([...jobs]);
      await Promise.all(children.map(terminate));
      await Promise.all(reservations.map(release));
      if (root) await rm(root, { recursive: true, force: true });
      for (const signal of ['SIGINT', 'SIGTERM']) process.removeListener(signal, handleSignal);
    })();
    return stopPromise;
  };
  const handleSignal = () => { stop().catch(() => { process.exitCode = 1; }); };
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, handleSignal);
  const check = () => { if (abort.signal.aborted) throw new Error('Local stack cancelled.'); };
  const track = (promise) => {
    jobs.add(promise);
    promise.then(() => jobs.delete(promise), () => jobs.delete(promise));
    return promise;
  };
  const stage = async (name, info = {}) => {
    check();
    await Promise.race([onStage(name, { root, pids: children.filter(alive).map((child) => child.pid), ...info }), cancelled]);
    check();
  };
  const reserve = async () => {
    check();
    const server = createServer();
    reservations.push(server);
    await new Promise((yes, no) => { server.once('error', no); server.listen(0, '127.0.0.1', yes); });
    check();
    return { server, port: server.address().port };
  };
  const fixture = (input) => {
    check();
    return track(new Promise((yes, no) => {
      const child = spawn('php', [join(here, 'fixture.php')], { env: cleanEnv(), stdio: ['pipe', 'pipe', 'pipe'] });
      children.push(child);
      let output = '';
      child.stdout.on('data', (data) => { output += data; });
      child.stderr.resume();
      child.stdin.on('error', () => {});
      child.once('error', no);
      child.once('exit', (code) => code === 0 ? yes(output) : no(new Error('Private fixture operation failed.')));
      child.stdin.end(JSON.stringify(input));
    }));
  };
  let privateDirectory, sessions, configPath, dist;
  const instance = randomBytes(24).toString('hex');
  const startPhp = async (port, router) => {
    check();
    const child = spawn('php', ['-d', 'display_errors=0', '-d', 'session.save_path=' + sessions,
      '-d', 'error_log=' + join(privateDirectory, 'php.log'), '-d', 'file_uploads=1',
      '-d', 'upload_max_filesize=5M', '-d', 'post_max_size=6M',
      '-d', 'memory_limit=256M',
      '-S', '127.0.0.1:' + port, '-t', dist, join(here, router)],
    { cwd: website, env: { ...cleanEnv(), VOCEROS_TEST_CONFIG: configPath, VOCEROS_TEST_INSTANCE: instance }, stdio: ['ignore', 'ignore', 'pipe'] });
    children.push(child);
    // No HTTP request until this exact child confirms its successful bind.
    await track(new Promise((yes, no) => {
      let log = '';
      const timeout = setTimeout(() => no(new Error('PHP bind timeout.')), 3000);
      const fail = () => {
        clearTimeout(timeout);
        const error = new Error('PHP bind failed.');
        if (/Address already in use|EADDRINUSE/i.test(log)) error.code = 'EADDRINUSE';
        no(error);
      };
      child.once('error', fail);
      child.once('exit', fail);
      child.stderr.on('data', (data) => {
        log = (log + data).slice(-4096);
        if (/Development Server.*started/.test(log)) { clearTimeout(timeout); yes(); }
      });
    }));
    check();
    return child;
  };
  const ready = async (url, child) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      check();
      if (!alive(child)) throw new Error('Local PHP server exited.');
      try {
        const response = await fetch(url, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(500)]) });
        if (response.headers.get('x-voceros-test-instance') !== instance) throw new Error('Foreign listener.');
        if (response.ok) return;
      } catch (error) { if (error.message === 'Foreign listener.') throw error; }
      await Promise.race([new Promise((yes) => setTimeout(yes, 30)), cancelled]);
    }
    throw new Error('Local PHP server did not become ready.');
  };
  try {
    root = await mkdtemp(join(tmpdir(), 'voceros-http-integration-'));
    check();
    await chmod(root, 0o700);
    privateDirectory = join(root, 'private');
    sessions = join(privateDirectory, 'sessions');
    configPath = join(privateDirectory, 'config.json');
    dist = join(root, 'dist');
    await mkdir(sessions, { recursive: true, mode: 0o700 });
    check();
    const credentials = { username: 'admin', password: randomBytes(24).toString('base64url') };
    await writeFile(join(privateDirectory, 'credentials.json'), JSON.stringify(credentials), { mode: 0o600 });
    await stage('credentials');
    await writeFile(join(privateDirectory, 'voceros-registration.json'), JSON.stringify({ enabled: true,
      responsable: 'Organización sintética', direccion: 'Dirección de prueba', telefono: '0000000000',
      contactEmail: 'legal@example.invalid', policiesVersion: '2026-09-14', thermometerVersion: '2026-09-14',
      imageVersion: '2026-09-15', privacyVersion: '2026-09-15', retentionYears: 3 }), { mode: 0o600 });
    const config = { environment: 'test', databaseDsn: 'sqlite:' + join(privateDirectory, 'voceros.sqlite'),
      databaseUser: '', databasePassword: '', encryptionKey: randomBytes(32).toString('base64'), hmacKey: randomBytes(32).toString('base64') };
    let publicOrigin, apiOrigin;
    for (let attempt = 0; attempt < 3; attempt++) {
      const publicReservation = await reserve();
      const apiReservation = await reserve();
      const publicPort = publicReservation.port, apiPort = apiReservation.port;
      publicOrigin = 'http://127.0.0.1:' + publicPort;
      apiOrigin = 'http://127.0.0.1:' + apiPort;
      const attemptChildren = children.length;
      try {
        await writeFile(configPath, JSON.stringify({ ...config, allowedOrigin: publicOrigin }), { mode: 0o600 });
        if (attempt === 0) {
          const provision = fixture({ action: 'init', config: configPath, password: credentials.password });
          await stage('provisioning');
          await provision;
        }
        check();
        const build = track(buildSite(dist, { adminEnvironment: 'development', adminApiBase: apiOrigin + '/api' }));
        await stage('build');
        await build;
        check();
        await release(publicReservation.server);
        await stage('public-released', { publicPort, apiPort, attempt });
        const publicChild = await startPhp(publicPort, 'public-router.php');
        await release(apiReservation.server);
        const apiChild = await startPhp(apiPort, 'api-router.php');
        await stage('readiness');
        await ready(apiOrigin + '/api/health', apiChild);
        await ready(publicOrigin + '/api/voceros/', publicChild);
        break;
      } catch (error) {
        await Promise.all(children.slice(attemptChildren).map(terminate));
        if (error.code !== 'EADDRINUSE' || attempt === 2 || abort.signal.aborted) throw error;
      } finally {
        await release(publicReservation.server);
        await release(apiReservation.server);
      }
    }
    check();
    const manifest = join(root, 'local-stack.json');
    await stage('manifest');
    await writeFile(manifest, JSON.stringify({ publicOrigin, apiOrigin,
      credentialsPath: join(privateDirectory, 'credentials.json') }), { mode: 0o600 });
    check();
    finishStartup();
    return { root, dist, privateDirectory, configPath, publicOrigin, apiOrigin, credentials, manifest, stop,
      backup: async () => JSON.parse(await fixture({ action: 'backup', config: configPath })),
      inspect: async () => JSON.parse(await fixture({ action: 'inspect', config: configPath })) };
  } catch (error) {
    finishStartup();
    await stop();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const stack = await startLocalStack();
    console.log('Frontend: ' + stack.publicOrigin + '/admin/\nAPI: ' + stack.apiOrigin + '/api/health\nManifest privado: ' + stack.manifest
      + '\nSolo HTTP local; TLS/Secure requieren verificación separada. Ctrl+C limpia los procesos y temporales propios.');
  } catch { console.error('No se pudo iniciar el entorno local; recursos propios retirados.'); process.exitCode = 1; }
}
