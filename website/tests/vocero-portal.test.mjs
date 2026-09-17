import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../scripts/build.mjs';

const clientModule = () => import('../src/finados/vocero-portal.js');
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

test('representante: los cuatro campos se presentan como obligatorios, sin etiqueta Opcional', async () => {
  const { renderVoceroForm } = await import('../src/finados/vocero-form.mjs');
  const catalogue = JSON.parse(await readFile(new URL('../backend/finados-api/resources/vocero-consents.json', import.meta.url)));
  const html = renderVoceroForm(catalogue);
  assert.equal((html.match(/type="submit"/g) ?? []).length, 1, 'el formulario debe mostrar un único botón de guardado');
  for (const name of ['representante_nombre', 'representante_cedula', 'representante_telefono', 'representante_correo']) {
    const label = html.match(new RegExp(`<label[^>]*for="${name}"[^>]*>[\\s\\S]*?<\\/label>`))?.[0];
    assert.ok(label, name);
    assert.doesNotMatch(label, /Opcional/);
    assert.match(label, /<span aria-hidden="true">\*<\/span>/);
    assert.match(label, /<input[^>]* required>/);
  }
});

test('autoguardado: agrupa cambios y ejecuta una sola vez después de la pausa', async () => {
  const { createAutoSaveScheduler } = await clientModule();
  const callbacks = [];
  let nextId = 0;
  const pending = new Map();
  const scheduler = createAutoSaveScheduler(() => { callbacks.push('saved'); }, {
    delay: 700,
    setTimeoutImplementation: (callback, delay) => { const id = ++nextId; pending.set(id, { callback, delay }); return id; },
    clearTimeoutImplementation: id => pending.delete(id),
  });
  scheduler.schedule();
  scheduler.schedule();
  assert.equal(pending.size, 1);
  const timer = pending.values().next().value;
  await timer.callback();
  assert.deepEqual(callbacks, ['saved']);
});

test('autoguardado: se habilita con el formulario completo aunque no haya red social', async () => {
  const { isProfileReadyForAutoSave } = await clientModule();
  const values = new Map([
    ['fecha_nacimiento', { value: '2000-01-01' }],
    ['tiktok', { value: 'https://tiktok.com/@vocero' }],
    ['instagram', { value: '' }],
    ['facebook', { value: '' }],
  ]);
  const form = { checkValidity: () => false, elements: { namedItem: name => values.get(name) } };
  assert.equal(isProfileReadyForAutoSave(form), false);
  form.checkValidity = () => true;
  assert.equal(isProfileReadyForAutoSave(form), true);
  values.get('tiktok').value = '';
  assert.equal(isProfileReadyForAutoSave(form), true);
});

test('registro: los enlaces sociales se presentan como opcionales', async () => {
  const { renderVoceroForm } = await import('../src/finados/vocero-form.mjs');
  const catalogue = JSON.parse(await readFile(new URL('../backend/finados-api/resources/vocero-consents.json', import.meta.url)));
  const html = renderVoceroForm(catalogue);
  for (const name of ['tiktok', 'instagram', 'facebook']) {
    const label = html.match(new RegExp(`<label[^>]*for="${name}"[^>]*>[\\s\\S]*?<\\/label>`))?.[0];
    assert.ok(label, name);
    assert.match(label, /Opcional/);
    assert.doesNotMatch(label, /required/);
  }
  assert.doesNotMatch(html, /Llena al menos uno/);
});

test('cliente invoca fetch sin ligar this al cliente (compatible con Window.fetch)', async () => {
  const { VoceroApiClient } = await clientModule();
  let receiver;
  const api = new VoceroApiClient(undefined, function () { receiver = this; return Promise.resolve(reply({ csrf: 'token' })); });
  await api.session();
  assert.equal(receiver, undefined);
});

test('portal: rutas privadas, catálogo exacto y landing con acceso separado', async () => {
  const output = await mkdtemp(join(tmpdir(), 'vocero-portal-'));
  const files = await buildSite(output);
  const landing = await readFile(join(output, 'finados/voceros/index.html'), 'utf8');
  const catalogue = JSON.parse(await readFile(new URL('../backend/finados-api/resources/vocero-consents.json', import.meta.url)));
  for (const slug of ['acceso', 'mi-registro', 'restablecer']) {
    assert.ok(files.includes(`finados/voceros/${slug}/index.html`));
    const page = await readFile(join(output, `finados/voceros/${slug}/index.html`), 'utf8');
    assert.match(page, /noindex, nofollow, noarchive/);
    assert.match(page, /name="referrer" content="no-referrer"/);
    assert.match(page, /default-src 'none'/);
    assert.doesNotMatch(page, /unsafe-inline|127\.0\.0\.1|data-cookie-consent|href="\/admin/);
    assert.equal((page.match(/<h1\b/g) ?? []).length, 1);
    if (slug === 'acceso') {
      assert.match(page, /data-vocero-register/);
      assert.ok(page.includes(catalogue.account.text));
    }
    if (slug === 'mi-registro') {
      assert.match(page, /name="fotografia"[^>]+accept="image\/jpeg,image\/png,image\/webp"[^>]+required/);
      for (const key of ['policies', 'image', 'data']) assert.ok(page.includes(catalogue[key].text));
      assert.doesNotMatch(page, /name="(?:correo|email|accountId|role|estado|status|website)"/);
    }
  }
  assert.match(landing, /href="\/finados\/voceros\/acceso\/"[^>]*>Crear cuenta/);
  assert.match(landing, /Iniciar sesión/);
  assert.doesNotMatch(landing, /data-voceros-form|action="\/api\/voceros\/"/);
  assert.doesNotMatch(await readFile(join(output, 'sitemap.xml'), 'utf8'), /voceros\/(acceso|mi-registro|restablecer)/);
  assert.doesNotMatch(await readFile(join(output, 'assets/finados/vocero-portal.js'), 'utf8'), /127\.0\.0\.1|localStorage|sessionStorage|document\.cookie/);
});

test('portal: build local comparte la API validada y el cliente rechaza otros orígenes', async () => {
  const output = await mkdtemp(join(tmpdir(), 'vocero-local-'));
  const local = 'http://127.0.0.1:4835/api';
  await buildSite(output, { adminEnvironment: 'development', adminApiBase: local });
  for (const route of ['admin', 'finados/voceros/acceso', 'finados/voceros/mi-registro', 'finados/voceros/restablecer']) {
    assert.ok((await readFile(join(output, route, 'index.html'), 'utf8')).includes(local));
  }
  assert.ok((await readFile(join(output, 'assets/finados/vocero-portal.js'), 'utf8')).includes(`const LOCAL_API = '${local}'`));
  const { VoceroApiClient } = await clientModule();
  assert.throws(() => new VoceroApiClient('https://other.example/api'), /no permitido/);
  await assert.rejects(buildSite(output, { adminEnvironment: 'production', adminApiBase: local }), /no permitida/);
});

test('cliente: sesión, 202 opaco sin autenticar, login separado, CSRF rotado y multipart', async () => {
  const { VoceroApiClient, registerAndSwitchToLogin } = await clientModule();
  const calls = [];
  const responses = [reply({ authenticated: false, csrf: 'first' }), reply({ ok: true }, 202), reply({ authenticated: true, csrf: 'second' }), reply({ registered: true })];
  const api = new VoceroApiClient(undefined, async (url, options) => { calls.push({ url, ...options }); return responses.shift(); });
  let mode;
  await registerAndSwitchToLogin(api, 'person@example.invalid', 'long password', (value) => { mode = value; });
  assert.equal(calls.length, 2);
  assert.equal(mode.mode, 'login');
  assert.equal(mode.email, 'person@example.invalid');
  assert.match(mode.message, /inicia sesión/i);
  assert.deepEqual(JSON.parse(calls[1].body), { email: 'person@example.invalid', password: 'long password', privacyAcknowledged: true });
  await api.login('person@example.invalid', 'long password');
  const body = new FormData(); body.set('fotografia', new Blob(['image'], { type: 'image/jpeg' }), 'photo.jpg');
  await api.saveProfile(body);
  assert.equal(calls[3].headers['X-CSRF-Token'], 'second');
  assert.equal(calls[3].headers['Content-Type'], undefined);
  assert.equal(calls[3].body.get('fotografia').type, 'image/jpeg');
  assert.ok(calls.every(call => call.credentials === 'include' && call.redirect === 'error' && call.cache === 'no-store'));
});

test('perfil: mapeo explícito, identificador estable, campos bloqueados excluidos', async () => {
  const { VoceroProfileState } = await clientModule();
  let generated = 0;
  const state = new VoceroProfileState(() => { generated++; return 'a'.repeat(32); });
  const profile = { registered: true, submission_id: 'b'.repeat(32), full_name: 'Persona Prueba', birth_date: '2000-01-01', city: 'Ambato', main_network: 'TikTok', previous_participation: 'No, es mi primera vez', community_source: 'Otro', kit_pickup: 'En la oficina', representative_name: 'Tutor', representative_phone: '0999999999', representative_email: 'tutor@example.invalid', photo: { available: true }, status: 'Nuevo' };
  const mapped = state.load(profile);
  assert.equal(mapped.nombre_completo, profile.full_name);
  assert.equal(mapped.fecha_nacimiento, profile.birth_date);
  assert.equal(mapped.representante_telefono, profile.representative_phone);
  assert.equal(mapped.representante_correo, profile.representative_email);
  assert.equal(state.photoRequired, false);
  assert.equal(generated, 0);
  const fields = new FormData();
  for (const [key, value] of Object.entries(mapped)) fields.set(key, value);
  for (const key of ['correo', 'email', 'accountId', 'role', 'estado', 'status', 'website']) fields.set(key, 'untrusted');
  for (let i = 0; i < 2; i++) {
    const body = state.body(fields);
    assert.equal(body.get('submission_id'), profile.submission_id);
    for (const key of ['correo', 'email', 'accountId', 'role', 'estado', 'status', 'website']) assert.equal(body.has(key), false);
  }
  const fresh = new VoceroProfileState(() => { generated++; return 'c'.repeat(32); });
  fresh.load({ registered: false }); fresh.load({ registered: false });
  assert.equal(generated, 1);
  assert.equal(fresh.photoRequired, true);
  assert.throws(() => fresh.body(new FormData()), /fotografía/i);
});

test('foto: validación y limpieza de URL al reemplazar, guardar y salir', async () => {
  const { PhotoPreview, validatePhoto } = await clientModule();
  const revoked = []; let id = 0; let leave;
  const preview = new PhotoPreview({ createObjectURL: () => `blob:${++id}`, revokeObjectURL: value => revoked.push(value) }, { addEventListener: (event, handler) => { assert.equal(event, 'pagehide'); leave = handler; } });
  assert.equal(preview.replace(new Blob()), 'blob:1');
  preview.replace(new Blob()); preview.clear(); preview.replace(new Blob()); leave();
  assert.deepEqual(revoked, ['blob:1', 'blob:2', 'blob:3']);
  assert.throws(() => validatePhoto({ size: 5242881, type: 'image/jpeg' }), /5 MB/);
  assert.throws(() => validatePhoto({ size: 20, type: 'image/svg+xml' }), /JPG/);
  assert.doesNotThrow(() => validatePhoto({ size: 5242880, type: 'image/webp' }));
});

test('errores diferenciados y reset inexistente nunca simula éxito', async () => {
  const { VoceroApiClient, VoceroError } = await clientModule();
  const messages = [401, 403, 409, 413, 415, 422, 429].map(status => new VoceroError(status).message);
  assert.equal(new Set(messages).size, messages.length);
  const api = new VoceroApiClient(undefined, async url => url.endsWith('/session') ? reply({ csrf: 'token' }) : reply({}, 404));
  await assert.rejects(api.reset('a'.repeat(64), 'long password'), error => error.status === 404);
  const unavailable = new VoceroApiClient(undefined, async url => url.endsWith('/session') ? reply({ csrf: 'token' }) : reply({}, 401));
  await assert.rejects(unavailable.reset('a'.repeat(64), 'long password'), error => /enlace.*no está disponible/i.test(error.message));
});

test('reset exige confirmación explícita del servidor antes de mostrar éxito', async () => {
  const { VoceroApiClient } = await clientModule();
  for (const body of [{}, { ok: false }, { authenticated: true }]) {
    const api = new VoceroApiClient(undefined, async url => url.endsWith('/session') ? reply({ csrf: 'test-csrf' }) : reply(body));
    await assert.rejects(api.reset('a'.repeat(64), 'long password'), error => error.status === 502);
  }
  const api = new VoceroApiClient(undefined, async url => url.endsWith('/session') ? reply({ csrf: 'test-csrf' }) : reply({ ok: true }));
  assert.equal((await api.reset('a'.repeat(64), 'long password')).ok, true);
});

test('endpoint anónimo devuelve 401 sin inicializar backend ni Sheets', () => {
  const endpoint = fileURLToPath(new URL('../public/api/voceros/index.php', import.meta.url));
  const result = spawnSync('php', ['-r', `require $argv[1]; $hit=false; $trap=function()use(&$hit){$hit=true; throw new Exception();}; $r=voceros_handle_request(['REQUEST_METHOD'=>'POST'], [], $trap, $trap); echo json_encode([$r,$hit]);`, endpoint], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const [response, hit] = JSON.parse(result.stdout);
  assert.equal(response.status, 401);
  assert.equal(response.json.message, 'Crea una cuenta o inicia sesión para completar tu registro.');
  assert.equal(hit, false);
});
