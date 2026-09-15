import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../../scripts/build.mjs';
import { startLocalStack } from './local-stack.mjs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function publicFixture(overrides = {}) {
  return { submission_id: randomBytes(16).toString('hex'), nombre_completo: '=Prueba Integración Adulta',
    cedula: '0000000001', fecha_nacimiento: '1990-01-01', whatsapp: '0900000001', correo: 'adulto@example.invalid',
    ciudad: 'Ciudad Sintética', instagram: 'https://example.invalid/perfil', red_principal: 'Instagram',
    vocero_previo: 'No, es mi primera vez', fuente_comunidad: 'Instagram', retiro_kit: 'En la oficina',
    consentimiento_politicas: 'Sí', autorizacion_imagen: 'Sí', consentimiento_datos: 'Sí', ...overrides };
}

test('real HTTP connects public registration, durable outbox and authenticated administration', async (t) => {
  const stack = await startLocalStack();
  t.after(stack.stop);
  assert.equal((await stat(stack.root)).mode & 0o777, 0o700);
  assert.equal((await stat(stack.privateDirectory)).mode & 0o777, 0o700);
  assert.equal((await stat(stack.configPath)).mode & 0o777, 0o600);
  let cookie = '';
  let csrf = '';
  async function request(path, { method = 'GET', body, token = csrf, origin = stack.publicOrigin, session = true, headers = {} } = {}) {
    const response = await fetch(`${stack.apiOrigin}/api${path}`, { method, headers: {
      Origin: origin, ...(session && cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'X-CSRF-Token': token } : {}), ...headers,
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000) });
    if (session && response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return response;
  }
  async function json(response, status) { assert.equal(response.status, status); return response.json(); }
  const submit = (payload, origin = stack.publicOrigin) => fetch(`${stack.publicOrigin}/api/voceros/`, {
    method: 'POST', headers: { Origin: origin }, body: new URLSearchParams(payload), signal: AbortSignal.timeout(5000) });

  assert.deepEqual(await json(await request('/health'), 200), { ok: true });
  for (const path of ['/voceros', '/dashboard', '/voceros/' + 'a'.repeat(32)]) assert.equal((await request(path)).status, 401);
  assert.equal((await request('/voceros/' + 'a'.repeat(32), { method: 'PATCH', body: { status: 'Aprobado' } })).status, 401);
  assert.equal((await request('/voceros', { origin: 'https://untrusted.example' })).status, 403);
  const preflight = await request('/auth/login', { method: 'OPTIONS', headers: {
    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type, X-CSRF-Token' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), stack.publicOrigin);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  assert.match(preflight.headers.get('vary'), /Origin/);
  assert.equal((await request('/auth/login', { method: 'OPTIONS', headers: { 'Access-Control-Request-Method': 'DELETE' } })).status, 403);
  assert.equal((await request('/auth/login', { method: 'OPTIONS', headers: { 'Access-Control-Request-Headers': 'X-Other' } })).status, 403);
  assert.equal((await request('/auth/login', { method: 'OPTIONS', origin: 'https://untrusted.example' })).status, 403);
  for (const path of ['/admin/', '/admin/voceros/', '/finados/voceros/', '/assets/admin/admin.js', '/assets/admin/admin.css']) {
    assert.equal((await fetch(stack.publicOrigin + path)).status, 200);
  }
  assert.equal((await fetch(stack.publicOrigin + '/tests/integration/fixture.php')).status, 404);
  const adult = publicFixture();
  assert.equal((await submit(adult, 'https://untrusted.example')).status, 403);
  const receipt = await json(await submit(adult), 200);
  assert.equal(receipt.database, 'stored');
  assert.equal(receipt.googleSheets, 'queued');
  assert.equal(receipt.registrationId, adult.submission_id);
  assert.deepEqual(await json(await submit(adult), 200), receipt);
  assert.equal((await submit({ ...adult, submission_id: randomBytes(16).toString('hex') })).status, 409);
  const now = new Date();
  const minor = publicFixture({ nombre_completo: 'Prueba Integración Menor', cedula: '0000000002', whatsapp: '0900000002',
    correo: 'menor@example.invalid', fecha_nacimiento: `${now.getUTCFullYear() - 17}-01-01`,
    representante_nombre: 'Representante Sintético', representante_cedula: '0000000003',
    representante_telefono: '0900000003', representante_correo: 'representante@example.invalid' });
  assert.equal((await submit({ ...minor, representante_nombre: '' })).status, 422);
  assert.equal((await submit(minor)).status, 200);
  let db = await stack.inspect();
  assert.equal(db.voceros.length, 2);
  assert.equal(db.vocero_consents.length, 6);
  assert.equal(db.sheets_outbox.length, 2);
  for (const row of db.sheets_outbox) { assert.equal(row.state, 'pending'); assert.ok(row.payload_enc); }
  assert.doesNotMatch(JSON.stringify(db), /adulto@example\.invalid|0900000001|representante@example\.invalid/);
  const id = db.voceros.find((row) => row.submission_id === adult.submission_id).public_id;
  assert.equal(db.voceros.find((row) => row.submission_id === minor.submission_id).status, 'Pendiente de autorización');
  assert.equal(db.vocero_consents.filter((row) => row.vocero_id === db.voceros.find((row) => row.public_id === id).id).length, 3);

  const anonymousResponse = await request('/auth/session');
  const anonymous = await json(anonymousResponse, 200);
  assert.equal(anonymous.authenticated, false);
  assert.match(anonymousResponse.headers.get('set-cookie') ?? '', /HttpOnly/i);
  assert.match(anonymousResponse.headers.get('set-cookie') ?? '', /SameSite=Strict/i);
  assert.doesNotMatch(anonymousResponse.headers.get('set-cookie') ?? '', /;\s*Domain=/i);
  csrf = anonymous.csrf;
  const anonymousCookie = cookie;
  assert.equal((await request('/auth/login', { method: 'POST', body: stack.credentials, token: '' })).status, 403);
  assert.equal((await request('/auth/login', { method: 'POST', body: { username: 'admin', password: 'invalid' } })).status, 401);
  const login = await json(await request('/auth/login', { method: 'POST', body: stack.credentials }), 200);
  assert.equal(login.authenticated, true);
  assert.notEqual(cookie, anonymousCookie);
  assert.notEqual(login.csrf, csrf);
  const oldCsrf = csrf;
  csrf = login.csrf;
  const list = await json(await request('/voceros'), 200);
  assert.equal(list.pagination.total, 2);
  const summary = list.items.find((item) => item.public_id === id);
  assert.equal(summary.whatsapp, '******0001');
  assert.equal(summary.cedula, '******0001');
  for (const query of [`search=${encodeURIComponent(adult.correo)}`, 'status=Nuevo', 'city=Ciudad%20Sint%C3%A9tica&main_network=Instagram&status=Nuevo']) {
    assert.equal((await json(await request('/voceros?' + query), 200)).pagination.total, 1);
  }
  assert.equal((await json(await request('/voceros?pageSize=1&page=2'), 200)).items.length, 1);
  const detail = await json(await request('/voceros/' + id), 200);
  assert.equal(detail.email, adult.correo);
  assert.equal(detail.consents.length, 3);
  assert.equal((await request('/voceros/' + id, { method: 'PATCH', body: { status: 'Aprobado' }, token: oldCsrf })).status, 403);
  assert.equal((await request('/voceros/' + id, { method: 'PATCH', body: { status: 'Aprobado' }, token: '' })).status, 403);
  assert.equal((await request('/voceros/' + id, { method: 'PATCH', body: { status: 'Aprobado' } })).status, 200);
  const note = '<script>alert("texto sintético")</script>';
  assert.equal((await request('/voceros/' + id + '/notes', { method: 'POST', body: { body: note } })).status, 201);
  const updated = await json(await request('/voceros/' + id), 200);
  assert.equal(updated.status, 'Aprobado');
  assert.equal(updated.notes[0].body, note);
  const csv = await request('/voceros/export', { method: 'POST', body: { status: 'Aprobado' } });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('cache-control'), /no-store/);
  const bytes = new Uint8Array(await csv.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [239, 187, 191]);
  const csvText = new TextDecoder().decode(bytes);
  assert.match(csvText, /adulto@example\.invalid/);
  assert.match(csvText, /'=Prueba Integración Adulta/);
  assert.doesNotMatch(csvText, /menor@example\.invalid/);
  const dashboard = await json(await request('/dashboard'), 200);
  assert.equal(dashboard.total, 2);
  assert.equal(dashboard.byStatus.Aprobado, 1);
  db = await stack.inspect();
  for (const event of ['admin.login', 'vocero.status_changed', 'vocero.note_added', 'vocero.exported']) {
    assert.ok(db.audit_log.some((row) => row.event_type === event), event);
  }
  const authenticatedCookie = cookie;
  const logout = await request('/auth/logout', { method: 'POST' });
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get('set-cookie'), /expires=/i);
  cookie = authenticatedCookie;
  assert.equal((await request('/voceros')).status, 401);
  // Test adapters must fail closed with production config, even on loopback.
  const config = JSON.parse(await readFile(stack.configPath, 'utf8'));
  await writeFile(stack.configPath, JSON.stringify({ ...config, environment: 'production', allowedOrigin: 'https://complejomushucruna.com' }));
  assert.equal((await fetch(stack.apiOrigin + '/api/health')).status, 403);
  assert.equal((await fetch(stack.publicOrigin + '/api/voceros/')).status, 403);
  await stack.stop();
  await assert.rejects(stat(stack.root), { code: 'ENOENT' });
  await assert.rejects(fetch(stack.apiOrigin + '/api/health'));
});

test('development build uses its configured loopback API; production refuses overrides', async () => {
  const root = await mkdtemp(join(tmpdir(), 'voceros-build-integration-'));
  try {
    await buildSite(join(root, 'dev'), { adminEnvironment: 'development', adminApiBase: 'http://127.0.0.1:49123/api' });
    assert.match(await readFile(join(root, 'dev/admin/index.html'), 'utf8'), /http:\/\/127\.0\.0\.1:49123\/api/);
    assert.match(await readFile(join(root, 'dev/assets/admin/admin.js'), 'utf8'), /http:\/\/127\.0\.0\.1:49123\/api/);
    await assert.rejects(buildSite(join(root, 'invalid'), { adminApiBase: 'http://127.0.0.1:49123/api' }));
    await assert.rejects(buildSite(join(root, 'invalid'), { adminEnvironment: 'development', adminApiBase: 'https://untrusted.example/api' }));
    const files = await buildSite(join(root, 'production'));
    assert.ok(files.includes('api/voceros/index.php'));
    assert.ok(!files.some((file) => /tests\/|integration\/|fixture|local-stack|\.sqlite|credentials\.json|config\.json/.test(file)));
    for (const file of files.filter((file) => /\.(html|js|php|json)$/.test(file))) {
      assert.doesNotMatch(await readFile(join(root, 'production', file), 'utf8'), /VOCEROS_TEST_CONFIG|local_test_config|http:\/\/127\.0\.0\.1:/, file);
    }
    assert.match(await readFile(join(root, 'production/admin/index.html'), 'utf8'), /https:\/\/finados\.complejomushucruna\.com\/api/);
    for (const file of files.filter((file) => !file.startsWith('admin/') && !file.startsWith('assets/admin/'))) {
      assert.deepEqual(await readFile(join(root, 'production', file)), await readFile(join(root, 'dev', file)), file);
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('local HTTP adapters reject direct CLI execution', () => {
  for (const name of ['api-router.php', 'public-router.php']) {
    const run = spawnSync('php', [fileURLToPath(new URL(name, import.meta.url))], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    assert.equal(run.status, 0);
    assert.equal(run.stdout, '{"ok":false}');
    assert.equal(run.stderr, '');
  }
});

test('backend release tar produced from deploy selection excludes every local adapter and fixture', async () => {
  const { deployBackend } = await import('../../scripts/deploy-finados-backend.mjs');
  const config = {
    DEPLOY_SSH_HOST: 'hosting.example.test', DEPLOY_SSH_USER: 'usuario_cpanel', DEPLOY_SSH_PORT: '22',
    DEPLOY_SSH_KEY: '/private/tmp/fixture-key', DEPLOY_REMOTE_ROOT: '/home/usuario_cpanel/public_html/complejomushucruna.com',
    DEPLOY_SITE_URL: 'https://complejomushucruna.com', FINADOS_APP_ROOT: '/home/usuario_cpanel/apps/finados-api',
    FINADOS_BACKEND_ROOT: '/home/usuario_cpanel/apps/finados-api/current',
    FINADOS_API_DOCROOT: '/home/usuario_cpanel/public_html/finados.complejomushucruna.com',
    FINADOS_CONFIG_PATH: '/home/usuario_cpanel/private-data/finados-backend.json',
    FINADOS_BACKUP_ROOT: '/home/usuario_cpanel/backups/finados-api',
    FINADOS_PUBLIC_ROOTS: '["/home/usuario_cpanel/public_html/complejomushucruna.com","/home/usuario_cpanel/public_html/finados.complejomushucruna.com"]',
  };
  let manifest;
  await deployBackend(config, {
    async repository() { return { branch: 'main', dirty: false, head: 'a'.repeat(40), remoteHead: 'a'.repeat(40) }; },
    async run(operation) {
      return operation.id === 'probe' ? JSON.stringify({ phpVersion: '8.2.12', phpModules: ['PDO', 'pdo_mysql', 'openssl', 'session'], paths: true, databaseProbe: '1' }) : '';
    },
    async upload({ id, source, files }) {
      assert.equal(id, 'upload-release');
      const archive = spawnSync('tar', ['-cf', '-', '-C', source, ...files], { maxBuffer: 32 * 1024 * 1024 });
      assert.equal(archive.status, 0);
      const inventory = spawnSync('tar', ['-tf', '-'], { input: archive.stdout, encoding: 'utf8' });
      assert.equal(inventory.status, 0);
      manifest = inventory.stdout;
    },
    async health() { return { status: 200, ok: true }; },
  }, { release: 'local-integration-test' });
  assert.match(manifest, /src\/Router\.php/);
  assert.match(manifest, /public\/index\.php/);
  assert.doesNotMatch(manifest, /tests\/|integration\/|fixture|local-stack|\.sqlite|credentials\.json|config\.json/);
});
