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

test('real HTTP isolates Voceros and admin, stores multipart photos, resets access and backs up', async (t) => {
  const stack = await startLocalStack();
  t.after(stack.stop);
  assert.equal((await stat(stack.root)).mode & 0o777, 0o700);
  assert.equal((await stat(stack.configPath)).mode & 0o777, 0o600);
  async function json(response, status) {
    assert.equal(response.status, status, await response.clone().text());
    return response.json();
  }
  function client() {
    const cookies = new Map(); let csrf = '';
    return {
      get cookie() { return [...cookies.values()].join('; '); },
      async request(path, { method = 'GET', body, token = csrf, origin = stack.publicOrigin, headers = {} } = {}) {
        const multipart = body instanceof FormData;
        const cookie = [...cookies.values()].join('; ');
        const response = await fetch(stack.apiOrigin + '/api' + path, { method, headers: {
          Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...(token ? { 'X-CSRF-Token': token } : {}),
          ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}), ...headers,
        }, ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(5000) });
        const setCookies = response.headers.getSetCookie();
        for (const entry of setCookies) {
          const pair = entry.split(';')[0], name = pair.split('=')[0];
          if (/max-age=0|expires=Thu, 01 Jan 1970/i.test(entry)) cookies.delete(name);
          else cookies.set(name, pair);
        }
        if (response.status !== 204 && response.headers.get('content-type')?.includes('application/json')) {
          const result = await response.clone().json();
          if (typeof result.csrf === 'string') csrf = result.csrf;
        }
        return response;
      },
    };
  }
  const admin = client(), a = client(), b = client(), recovery = client();
  const request = admin.request.bind(admin);
  const closed = await json(await fetch(stack.publicOrigin + '/api/voceros/'), 200);
  assert.deepEqual({ open: closed.open, authenticationRequired: closed.authenticationRequired, accessUrl: closed.accessUrl, timezone: closed.timezone },
    { open: false, authenticationRequired: true, accessUrl: '/finados/voceros/acceso/', timezone: 'America/Guayaquil' });
  const head = await fetch(stack.publicOrigin + '/api/voceros/', { method: 'HEAD' });
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal((await fetch(stack.publicOrigin + '/api/voceros/', { method: 'POST', body: new URLSearchParams(publicFixture()) })).status, 401);
  assert.equal((await fetch(stack.publicOrigin + '/api/voceros/', { method: 'DELETE' })).status, 405);
  const health = await json(await request('/health'), 200);
  assert.deepEqual({ ok: health.ok, service: health.service, contract: health.contract, migration: health.migration }, {
    ok: true, service: 'finados-voceros-api', contract: 'vocero-accounts-v1',
    migration: { version: '003_vocero_accounts', ready: true },
  });
  assert.deepEqual(health.capabilities, {
    voceroAccounts: true, voceroProfile: true, privatePhoto: true, adminPasswordReset: true, photoUpload: true,
  });
  assert.deepEqual(health.runtime, {
    fileinfo: true, gd: true, jpeg: true, png: true, webp: true, exif: true, openssl: true, functions: true,
  });
  assert.deepEqual({
    privateRoot: health.storage.privateRoot,
    canonical: health.storage.canonical,
    writable: health.storage.writable,
    permissions: health.storage.permissions,
  }, { privateRoot: true, canonical: true, writable: true, permissions: true });
  assert.ok(Number.isSafeInteger(health.storage.freeBytes));
  assert.ok(health.storage.freeBytes >= 100 * 1024 * 1024);
  assert.equal(health.limits.fileUploads, true);
  assert.ok(health.limits.uploadMaxBytes >= 5 * 1024 * 1024);
  assert.ok(health.limits.postMaxBytes >= 5 * 1024 * 1024 + 256 * 1024);
  assert.equal(health.limits.memoryBytes, 256 * 1024 * 1024);
  for (const path of ['/voceros', '/dashboard', '/voceros/' + 'a'.repeat(32)]) assert.equal((await request(path)).status, 401);
  assert.equal((await request('/voceros', { origin: 'https://untrusted.example' })).status, 403);
  const preflight = await request('/auth/login', { method: 'OPTIONS', headers: {
    'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Content-Type, X-CSRF-Token' } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), stack.publicOrigin);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), 'true');
  assert.match(preflight.headers.get('vary'), /Origin/);
  for (const headers of [{ 'Access-Control-Request-Method': 'DELETE' }, { 'Access-Control-Request-Headers': 'X-Other' }]) {
    assert.equal((await request('/auth/login', { method: 'OPTIONS', headers })).status, 403);
  }
  for (const path of ['/admin/', '/admin/voceros/', '/finados/voceros/', '/finados/voceros/acceso/', '/finados/voceros/mi-registro/', '/finados/voceros/restablecer/']) {
    assert.equal((await fetch(stack.publicOrigin + path)).status, 200);
  }
  assert.equal((await fetch(stack.publicOrigin + '/tests/integration/fixture.php')).status, 404);
  const password = randomBytes(24).toString('base64url');
  const adult = publicFixture();
  const minor = publicFixture({ nombre_completo: 'Prueba Integración Menor', cedula: '0000000002', whatsapp: '0900000002',
    correo: 'menor@example.invalid', fecha_nacimiento: (new Date().getUTCFullYear() - 17) + '-01-01',
    representante_nombre: 'Representante Sintético', representante_cedula: '0000000003',
    representante_telefono: '0900000003', representante_correo: 'representante@example.invalid' });
  async function register(account, fields) {
    const anonymous = await account.request('/vocero/auth/session');
    assert.equal((await json(anonymous, 200)).authenticated, false);
    assert.match(anonymous.headers.get('set-cookie'), /finados_vocero=.*HttpOnly.*SameSite=Lax/i);
    const before = account.cookie;
    assert.equal((await account.request('/vocero/auth/register', { method: 'POST', body: { email: fields.correo, password, privacyAcknowledged: true } })).status, 202);
    assert.equal((await account.request('/vocero/profile')).status, 401);
    await account.request('/vocero/auth/session');
    const login = await json(await account.request('/vocero/auth/login', { method: 'POST', body: { email: fields.correo, password } }), 200);
    assert.equal(login.user.role, 'vocero'); assert.notEqual(account.cookie, before);
  }
  await register(a, adult); await register(b, minor);
  assert.notEqual(a.cookie, b.cookie);
  const image = value => {
    const generated = spawnSync('php', ['-r', '$im=imagecreatetruecolor(30,40); imagefill($im,0,0,imagecolorallocate($im,(int)$argv[1],40,70)); imagejpeg($im);', String(value)]);
    assert.equal(generated.status, 0);
    return new Blob([generated.stdout], { type: 'image/jpeg' });
  };
  const photoA = image(30), photoB = image(200);
  const form = (fields, photo) => {
    const payload = new FormData();
    for (const [name, value] of Object.entries(fields)) if (name !== 'correo') payload.set(name, value);
    if (photo) payload.set('fotografia', photo, 'foto-sintetica.jpg');
    return payload;
  };
  assert.equal((await a.request('/vocero/profile', { method: 'POST', body: form(adult) })).status, 422);
  const saved = await json(await a.request('/vocero/profile', { method: 'POST', body: form(adult, photoA) }), 200);
  const id = saved.public_id;
  assert.equal(saved.registered, true);
  assert.equal((await json(await a.request('/vocero/profile', { method: 'POST', body: form(adult, photoA) }), 200)).public_id, id);
  assert.equal((await b.request('/vocero/profile', { method: 'POST', body: form({ ...minor, representante_nombre: '' }, photoB) })).status, 422);
  const savedB = await json(await b.request('/vocero/profile', { method: 'POST', body: form(minor, photoB) }), 200);
  assert.equal(savedB.status, 'Pendiente de autorización');
  assert.notEqual(savedB.public_id, id);
  assert.equal((await json(await a.request('/vocero/profile'), 200)).email, adult.correo);
  assert.equal((await json(await b.request('/vocero/profile'), 200)).email, minor.correo);
  assert.equal((await a.request('/vocero/profile?public_id=' + savedB.public_id)).status, 422);
  assert.equal((await a.request('/vocero/photo?public_id=' + savedB.public_id)).status, 422);
  for (const account of [a, b]) {
    assert.equal((await account.request('/voceros')).status, 401);
    assert.equal((await account.request('/voceros/' + id + '/photo')).status, 401);
  }
  const aPhoto = await a.request('/vocero/photo'), bPhoto = await b.request('/vocero/photo');
  assert.equal(aPhoto.status, 200); assert.equal(bPhoto.status, 200);
  assert.equal(aPhoto.headers.get('content-type'), 'image/jpeg');
  assert.match(aPhoto.headers.get('cache-control'), /private, no-store/);
  assert.equal(aPhoto.headers.get('x-content-type-options'), 'nosniff');
  const aBytes = Buffer.from(await aPhoto.arrayBuffer()), bBytes = Buffer.from(await bPhoto.arrayBuffer());
  assert.notDeepEqual(aBytes, bBytes);
  let db = await stack.inspect();
  assert.equal(db.voceros.length, 2); assert.equal(db.vocero_consents.length, 6);
  assert.equal(db.sheets_outbox.length, 2);
  assert.equal(db.vocero_accounts.length, 2); assert.equal(db.vocero_photos.length, 2);
  for (const fields of db.sheets_field_names) assert.doesNotMatch(JSON.stringify(fields), /photo|fotografia|storage_key|jpeg/i);
  assert.doesNotMatch(JSON.stringify(db), /adulto@example\.invalid|0900000001|representante@example\.invalid/);
  for (const consent of db.vocero_consents) assert.equal(consent.text_version, consent.consent_type === 'politicas' ? '2026-09-14 + 2026-09-14' : '2026-09-15');

  const anonymous = await request('/auth/session');
  const oldCsrf = (await json(anonymous, 200)).csrf;
  assert.match(anonymous.headers.get('set-cookie'), /finados_admin=.*HttpOnly.*SameSite=Strict/i);
  const anonymousCookie = admin.cookie;
  assert.equal((await request('/auth/login', { method: 'POST', body: stack.credentials, token: '' })).status, 403);
  assert.equal((await request('/auth/login', { method: 'POST', body: { username: 'admin', password: 'invalid' } })).status, 401);
  const login = await json(await request('/auth/login', { method: 'POST', body: stack.credentials }), 200);
  assert.equal(login.user.role, 'administrador'); assert.notEqual(admin.cookie, anonymousCookie); assert.notEqual(login.csrf, oldCsrf);
  // Send admin cookie without capturing the separate anonymous vocero cookie.
  assert.equal((await fetch(stack.apiOrigin + '/api/vocero/profile', { headers: { Cookie: admin.cookie, Origin: stack.publicOrigin } })).status, 401);
  const list = await json(await request('/voceros'), 200);
  assert.equal(list.pagination.total, 2);
  assert.equal(list.items.find(item => item.public_id === id).whatsapp, '******0001');
  for (const query of ['search=' + encodeURIComponent(adult.correo), 'status=Nuevo', 'city=Ciudad%20Sint%C3%A9tica&main_network=Instagram&status=Nuevo']) {
    assert.equal((await json(await request('/voceros?' + query), 200)).pagination.total, 1);
  }
  assert.equal((await json(await request('/voceros?pageSize=1&page=2'), 200)).items.length, 1);
  const detail = await json(await request('/voceros/' + id), 200);
  assert.equal(detail.email, adult.correo); assert.equal(detail.consents.length, 3); assert.equal(detail.photo.available, true);
  const downloaded = await request('/voceros/' + id + '/photo');
  assert.equal(downloaded.status, 200); assert.match(downloaded.headers.get('cache-control'), /private, no-store/);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), aBytes);
  assert.equal((await request('/voceros/' + id, { method: 'PATCH', body: { status: 'Aprobado' }, token: oldCsrf })).status, 403);
  assert.equal((await request('/voceros/' + id, { method: 'PATCH', body: { status: 'Aprobado' } })).status, 200);
  assert.equal((await a.request('/vocero/profile', { method: 'POST', body: form(adult) })).status, 403);
  const note = '<script>alert("texto sintético")</script>';
  assert.equal((await request('/voceros/' + id + '/notes', { method: 'POST', body: { body: note } })).status, 201);
  assert.equal((await json(await request('/voceros/' + id), 200)).notes[0].body, note);
  const csv = await request('/voceros/export', { method: 'POST', body: { status: 'Aprobado' } });
  assert.equal(csv.status, 200); assert.match(csv.headers.get('cache-control'), /no-store/);
  const csvBytes = new Uint8Array(await csv.arrayBuffer());
  assert.deepEqual([...csvBytes.slice(0, 3)], [239, 187, 191]);
  const csvText = new TextDecoder().decode(csvBytes);
  assert.match(csvText, /adulto@example\.invalid/); assert.match(csvText, /'=Prueba Integración Adulta/);
  assert.doesNotMatch(csvText, /menor@example\.invalid|photo|fotografia|voceros-photos|storage_key/i);

  const reset = await json(await request('/voceros/' + id + '/password-reset', { method: 'POST', body: {} }), 201);
  const resetUrl = new URL(reset.resetUrl);
  assert.equal(resetUrl.origin, stack.publicOrigin);
  const token = resetUrl.searchParams.get('token'), newPassword = randomBytes(24).toString('base64url');
  assert.match(token, /^[a-f0-9]{64}$/);
  await recovery.request('/vocero/auth/session');
  assert.equal((await recovery.request('/vocero/auth/reset', { method: 'POST', body: { token, password: newPassword } })).status, 200);
  assert.equal((await a.request('/vocero/profile')).status, 401);
  assert.equal((await b.request('/vocero/profile')).status, 200);
  assert.equal((await recovery.request('/vocero/auth/reset', { method: 'POST', body: { token, password: newPassword } })).status, 422);
  await a.request('/vocero/auth/session');
  assert.equal((await a.request('/vocero/auth/login', { method: 'POST', body: { email: adult.correo, password } })).status, 401);
  assert.equal((await a.request('/vocero/auth/login', { method: 'POST', body: { email: adult.correo, password: newPassword } })).status, 200);
  assert.equal((await a.request('/vocero/profile')).status, 200);
  db = await stack.inspect();
  assert.equal(db.vocero_password_resets.length, 1); assert.ok(db.vocero_password_resets[0].consumed_at);
  assert.doesNotMatch(JSON.stringify(db), new RegExp(token));
  for (const event of ['admin.login', 'vocero.photo_viewed', 'vocero.status_changed', 'vocero.note_added', 'vocero.exported', 'vocero.password_reset_created']) {
    assert.ok(db.audit_log.some(row => row.event_type === event), event);
  }
  const receipt = await stack.backup();
  assert.equal(receipt.photos, 2);
  assert.deepEqual(Object.keys(receipt).sort(), ['backups', 'bytes', 'photos', 'sha256']);
  const { readdir } = await import('node:fs/promises');
  const [backupDirectory] = await readdir(join(stack.privateDirectory, 'backups'));
  const backupRoot = join(stack.privateDirectory, 'backups', backupDirectory);
  const manifest = JSON.parse(await readFile(join(backupRoot, 'manifest.json'), 'utf8'));
  assert.equal(manifest.photos.count, 2); assert.equal(manifest.photos.files.length, 2);
  assert.equal((await request('/auth/logout', { method: 'POST' })).status, 200);
  assert.equal((await request('/voceros')).status, 401);
  assert.equal((await b.request('/vocero/profile')).status, 200);
  const config = JSON.parse(await readFile(stack.configPath, 'utf8'));
  await writeFile(stack.configPath, JSON.stringify({ ...config, environment: 'production', allowedOrigin: 'https://complejomushucruna.com' }));
  assert.equal((await fetch(stack.apiOrigin + '/api/health')).status, 403);
  assert.equal((await fetch(stack.publicOrigin + '/api/voceros/')).status, 403);
  await stack.stop();
  await assert.rejects(stat(stack.root), { code: 'ENOENT' });
  await assert.rejects(fetch(stack.apiOrigin + '/api/health'));
  await assert.rejects(fetch(stack.publicOrigin + '/api/voceros/'));
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
    for (const file of files.filter((file) => !file.startsWith('admin/') && !file.startsWith('assets/admin/') && !/^finados\/(?:voceros|medios)\/(acceso|mi-registro|restablecer)\//.test(file) && !['assets/finados/vocero-portal.js', 'assets/finados/media-portal.js'].includes(file))) {
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
      return operation.id === 'probe' ? JSON.stringify({ phpVersion: '8.2.12', phpModules: ['PDO', 'pdo_mysql', 'openssl', 'session', 'fileinfo', 'gd', 'exif'], paths: true, databaseProbe: '1', media: { jpeg: true, png: true, webp: true, memoryBytes: 268435456, freeBytes: 104857600, privateRoot: true, fileUploads: true, uploadMaxBytes: 5242880, postMaxBytes: 5505024 } }) : '';
    },
    async upload({ id, source, files }) {
      assert.equal(id, 'upload-release');
      const archive = spawnSync('tar', ['-cf', '-', '-C', source, ...files], { maxBuffer: 32 * 1024 * 1024 });
      assert.equal(archive.status, 0);
      const inventory = spawnSync('tar', ['-tf', '-'], { input: archive.stdout, encoding: 'utf8' });
      assert.equal(inventory.status, 0);
      manifest = inventory.stdout;
    },
    async health() { return {
      status: 200, ok: true, service: 'finados-voceros-api', contract: 'vocero-accounts-v1',
      migration: { version: '003_vocero_accounts', ready: true },
      capabilities: { voceroAccounts: true, voceroProfile: true, privatePhoto: true, adminPasswordReset: true, photoUpload: true },
      runtime: { fileinfo: true, gd: true, jpeg: true, png: true, webp: true, exif: true, openssl: true, functions: true },
      storage: { privateRoot: true, canonical: true, writable: true, permissions: true, freeBytes: 104857600 },
      limits: { fileUploads: true, uploadMaxBytes: 5242880, postMaxBytes: 5505024, memoryBytes: 268435456 },
    }; },
  }, { release: 'local-integration-test' });
  assert.match(manifest, /src\/Router\.php/);
  assert.match(manifest, /resources\/vocero-consents\.json/);
  assert.match(manifest, /migrations\/003_vocero_accounts_mysql\.sql/);
  for (const name of ['PhotoStorage', 'VoceroMediaLock', 'VoceroAuth', 'VoceroProfile', 'VoceroPasswordReset']) assert.ok(manifest.includes('src/' + name + '.php'));
  assert.doesNotMatch(manifest, /PhotoStorage 2|staging|voceros-photos/);
  assert.match(manifest, /public\/index\.php/);
  assert.doesNotMatch(manifest, /tests\/|integration\/|fixture|local-stack|\.sqlite|credentials\.json|config\.json/);
});
