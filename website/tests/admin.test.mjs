import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';

const load = () => import('../src/admin/admin.js');
test('admin detalle mantiene fotos y enlaces solo durante su apertura y descarta respuestas tardías', async () => {
  const { AdminDetailAccess, createAdminClient } = await load();
  const pending = []; const calls = []; const revoked = []; let sequence = 0;
  const id = 'a'.repeat(32); const other = 'b'.repeat(32);
  const resetUrl = 'https://complejomushucruna.com/finados/voceros/restablecer/?token=' + 'c'.repeat(64);
  const client = createAdminClient(undefined, async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith('/session')) return Response.json({ csrf: 'test-csrf' });
    if (url.endsWith('/photo')) return new Promise(resolve => pending.push(resolve));
    return Response.json({ resetUrl });
  });
  const access = new AdminDetailAccess(client, { createObjectURL: () => `blob:${++sequence}`, revokeObjectURL: url => revoked.push(url) });
  await client.session();
  access.open(id);
  assert.equal(calls.length, 1, 'opening state does not fetch a photo eagerly');
  const first = access.loadPhoto();
  access.close();
  pending.shift()(new Response('jpeg', { headers: { 'Content-Type': 'image/jpeg' } }));
  assert.equal(await first, ''); assert.equal(sequence, 0);
  access.open(id);
  const loaded = access.loadPhoto(); pending.shift()(new Response('jpeg', { headers: { 'Content-Type': 'image/jpeg' } }));
  assert.equal(await loaded, 'blob:1'); assert.equal(access.filename, `vocero-${id}.jpg`);
  assert.equal(await access.generateReset(), resetUrl);
  let copied = '';
  assert.equal(await access.copyReset({ writeText: async value => { copied = value; } }), true);
  assert.equal(copied, resetUrl);
  await assert.rejects(access.copyReset({ writeText: async () => { throw new Error('denied'); } }));
  access.open(other); assert.deepEqual(revoked, ['blob:1']); assert.equal(access.resetUrl, '');
  await assert.rejects(access.copyReset({ writeText: async () => {} }));
  const changed = access.loadPhoto(); access.open(id);
  pending.shift()(new Response('jpeg', { headers: { 'Content-Type': 'image/jpeg' } }));
  assert.equal(await changed, '');
  const last = access.loadPhoto(); pending.shift()(new Response('jpeg', { headers: { 'Content-Type': 'image/jpeg' } }));
  await last; access.close(); assert.deepEqual(revoked, ['blob:1', 'blob:2']);
  assert.ok(calls.every(call => call.credentials === 'include' && call.cache === 'no-store' && call.redirect === 'error'));
  assert.equal(calls.find(call => call.url.endsWith('/password-reset')).headers['X-CSRF-Token'], 'test-csrf');
  assert.throws(() => access.open('../private'));
  await assert.rejects(client.request('/voceros/../photo', { blob: true }));
});

test('admin descarta enlaces tardíos y rechaza destinos externos de recuperación', async () => {
  const { AdminDetailAccess } = await load();
  let resolve;
  const access = new AdminDetailAccess({ request: async () => new Promise(done => { resolve = done; }) });
  access.open('a'.repeat(32)); const promise = access.generateReset(); access.close();
  resolve({ resetUrl: 'https://complejomushucruna.com/finados/voceros/restablecer/?token=' + 'c'.repeat(64) });
  assert.equal(await promise, ''); assert.equal(access.resetUrl, '');
  access.open('b'.repeat(32)); const evil = access.generateReset(); resolve({ resetUrl: 'https://evil.invalid/' });
  await assert.rejects(evil);
});

test('admin renderiza foto privada y recuperación con campo de solo lectura', async () => {
  const { renderAdminVocerosPage } = await import('../src/admin/page.mjs');
  const html = renderAdminVocerosPage({ title: 'Voceros', route: '/admin/voceros/' });
  assert.match(html, /data-admin-photo/); assert.match(html, /data-admin-reset/);
  assert.match(html, /Sin fotografía histórica/); assert.match(html, /readonly[^>]*data-reset-url/);
  assert.match(html, /img-src 'self' blob:/);
});

test('admin selecciona la API espejo según el host visible y no usa el meta fijo', async () => {
  const { resolveAdminOrigins, createAdminClient } = await load();
  const mirror = resolveAdminOrigins({ hostname: 'finados.expoferiamushucruna.com', origin: 'https://finados.expoferiamushucruna.com' });
  assert.deepEqual(mirror, {
    apiBase: 'https://api.expoferiamushucruna.com/api',
    siteOrigin: 'https://finados.expoferiamushucruna.com',
  });
  assert.doesNotThrow(() => createAdminClient(mirror.apiBase));
  const primary = resolveAdminOrigins({ hostname: 'complejomushucruna.com', origin: 'https://complejomushucruna.com' });
  assert.equal(primary.apiBase, 'https://finados.complejomushucruna.com/api');
});

test('admin acepta enlaces de recuperación del origen espejo y rechaza otros destinos', async () => {
  const { AdminDetailAccess } = await load();
  const token = 'd'.repeat(64);
  const access = new AdminDetailAccess({ request: async () => ({ resetUrl: `https://finados.expoferiamushucruna.com/finados/voceros/restablecer/?token=${token}` }) }, undefined, 'https://finados.expoferiamushucruna.com');
  access.open('a'.repeat(32));
  assert.equal(await access.generateReset(), `https://finados.expoferiamushucruna.com/finados/voceros/restablecer/?token=${token}`);
});

test('admin presenta cinco habilitaciones independientes con fecha por video', async () => {
  const { renderAdminVocerosPage } = await import('../src/admin/page.mjs');
  const html = renderAdminVocerosPage({ title: 'Voceros', route: '/admin/voceros/' });
  assert.equal((html.match(/name="video_[1-5]_enabled"/g) ?? []).length, 5);
  assert.equal((html.match(/name="video_[1-5]_enabled_at"/g) ?? []).length, 5);
  assert.match(html, /data-admin-video-controls/);
  assert.match(html, /Marca cada video y registra la fecha/);
  assert.doesNotMatch(html, /name="videos_unlocked"/);
});

test('admin muestra cuentas pendientes y acción de retiro protegida', async () => {
  const { renderAdminVocerosPage } = await import('../src/admin/page.mjs');
  const html = renderAdminVocerosPage({ title: 'Voceros', route: '/admin/voceros/' });
  assert.match(html, /data-pending-accounts/);
  assert.match(html, /Cuentas pendientes de ficha/);
  assert.match(html, /data-admin-delete/);
});
test('admin genera acceso aislado, recursos y configuración segura de producción', async () => {
  const out = await mkdtemp(join(tmpdir(), 'admin-build-'));
  const files = await buildSite(out);
  assert.ok(files.includes('admin/index.html'));
  assert.ok(files.includes('admin/voceros/index.html'));
  for (const path of ['admin/index.html', 'admin/voceros/index.html']) {
    const html = await readFile(join(out, path), 'utf8');
    assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/);
    assert.match(html, /Content-Security-Policy/);
    assert.match(html, /api\.expoferiamushucruna\.com\/api/);
    assert.match(html, /name="admin-api-base" content="https:\/\/finados.complejomushucruna.com\/api"/);
    assert.doesNotMatch(html, /127\.0\.0\.1|localhost|cookie-consent/);
  }
  assert.match(await readFile(join(out, 'admin/index.html'), 'utf8'), /<title>Iniciar sesión \| Complejo Mushuc Runa<\/title>/);
  assert.match(await readFile(join(out, 'admin/voceros/index.html'), 'utf8'), /data-admin-dashboard/);
  assert.match(await readFile(join(out, 'admin/voceros/index.html'), 'utf8'), /data-admin-voceros/);
  assert.ok(files.includes('assets/admin/admin.css'));
  assert.ok(files.includes('assets/admin/admin.js'));
  assert.doesNotMatch(await readFile(join(out, 'assets/admin/admin.js'), 'utf8'), /127\.0\.0\.1|localhost/);
  for (const path of files.filter(p => p.endsWith('.html') && !p.startsWith('admin/'))) {
    assert.doesNotMatch(await readFile(join(out, path), 'utf8'), /href="\/admin\//);
  }
  assert.doesNotMatch(await readFile(join(out, 'sitemap.xml'), 'utf8'), /\/admin\//);
});

test('admin orienta cada formulario desde una navegación lateral accesible', async () => {
  const out = await mkdtemp(join(tmpdir(), 'admin-navigation-'));
  await buildSite(out);
  const html = await readFile(join(out, 'admin/voceros/index.html'), 'utf8');

  assert.match(html, /<aside[^>]+class="admin-sidebar"[^>]+aria-label="Navegación administrativa"/);
  assert.match(html, /<details class="admin-sidebar__navigation" data-admin-navigation open>/);
  assert.match(html, /<summary[^>]*>\s*<span>Menú administrativo<\/span>/);
  assert.match(html, /<nav[^>]+aria-labelledby="admin-forms-title"/);
  assert.match(html, /id="admin-forms-title"[^>]*>Formularios<\/p>/);
  assert.match(html, /<a[^>]+href="\/admin\/voceros\/"[^>]+aria-current="page"[^>]*>[\s\S]*?<strong>Voceros<\/strong>[\s\S]*?<small>Registros y seguimiento<\/small>/);
  assert.match(html, /Los próximos formularios aparecerán aquí cuando estén habilitados\./);
  assert.match(html, /class="admin-sidebar__account"[\s\S]*?data-admin-logout/);
  assert.equal([...html.matchAll(/aria-current="page"/g)].length, 1);
});

test('admin limita el build de desarrollo a configuración local explícita', async () => {
  const out = await mkdtemp(join(tmpdir(), 'admin-dev-'));
  await buildSite(out, { adminEnvironment: 'development' });
  const html = await readFile(join(out, 'admin/index.html'), 'utf8');
  assert.match(html, /name="admin-api-base" content="http:\/\/127.0.0.1:4174\/api"/);
  await assert.rejects(() => buildSite(out, { adminEnvironment: 'https://evil.example' }));
});

test('admin inicia la navegación compacta plegada sin alterar el escritorio', async () => {
  const { initializeAdminNavigation } = await load();
  const compact = { open: true };
  const desktop = { open: false };

  initializeAdminNavigation({ querySelector: () => compact }, true);
  initializeAdminNavigation({ querySelector: () => desktop }, false);

  assert.equal(compact.open, false);
  assert.equal(desktop.open, true);
});

test('admin devuelve el foco al resumen antes de plegar la navegación compacta', async () => {
  const { initializeAdminNavigation } = await load();
  const focusedLink = {};
  const events = [];
  let open = true;
  const summary = { focus: () => events.push('focus') };
  const navigation = {
    contains: element => element === focusedLink,
    querySelector: selector => selector === 'summary' ? summary : null,
  };
  Object.defineProperty(navigation, 'open', {
    get: () => open,
    set: value => { if (!value) events.push('close'); open = value; },
  });
  const root = {
    activeElement: focusedLink,
    querySelector: selector => selector === '[data-admin-navigation]' ? navigation : null,
  };

  initializeAdminNavigation(root, true);

  assert.equal(navigation.open, false);
  assert.deepEqual(events, ['focus', 'close']);
});

test('admin enmascara identificadores sin revelar valores cortos y normaliza filtros permitidos', async () => {
  const { maskId, maskPhone, normalizeFilters, renderSummary } = await load();
  assert.equal(maskId('1234567890'), '******7890');
  assert.equal(maskPhone('******4567'), '******4567');
  assert.equal(maskId('123'), '***');
  assert.deepEqual(normalizeFilters({ search: '  Ana  ', status: 'Nuevo', city: ' Quito ', page: '2', evil: 'x' }), { search: 'Ana', status: 'Nuevo', city: 'Quito', page: 2, pageSize: 25 });
  assert.throws(() => normalizeFilters({ status: 'Eliminado' }));
  assert.throws(() => normalizeFilters({ date_from: '2026-02-30' }));
  assert.throws(() => normalizeFilters({ date_from: '2026-09-14', date_to: '2026-09-01' }));
  assert.deepEqual(renderSummary({ total: 9, byStatus: { Nuevo: 3, Aprobado: 2 }, byDate: {}, lastSevenDays: 4 }), [
    { label: 'Registros', value: 9 }, { label: 'Nuevos', value: 3 }, { label: 'Aprobados', value: 2 }, { label: 'Últimos 7 días', value: 4 },
  ]);
});

test('admin cliente obtiene y rota CSRF, envía cookies y descarga exportación filtrada', async () => {
  const { createAdminClient } = await load();
  const calls = [];
  const client = createAdminClient('https://finados.complejomushucruna.com/api', async (url, options) => {
    calls.push({ url, ...options });
    if (url.endsWith('/export')) return new Response('id,nombre\n1,Prueba', { headers: { 'Content-Type': 'text/csv' } });
    return Response.json({ authenticated: true, user: { username: 'operador' }, csrf: url.endsWith('/login') ? 'rotated' : 'initial' });
  });
  await client.session(); await client.login('operador', 'prueba');
  await client.request('/voceros/example', { method: 'PATCH', body: { status: 'Aprobado' } });
  const csv = await client.export({ city: 'Quito', page: 3 });
  assert.equal(calls[1].headers['X-CSRF-Token'], 'initial');
  assert.equal(calls[2].headers['X-CSRF-Token'], 'rotated');
  assert.equal(calls[2].body, '{"status":"Aprobado"}');
  assert.ok(calls.every(call => call.credentials === 'include' && call.cache === 'no-store'));
  assert.equal(calls[3].method, 'POST');
  assert.equal(calls[3].body, '{"city":"Quito"}');
  assert.match(await csv.text(), /1,Prueba/);
  assert.throws(() => createAdminClient('https://evil.example/api'));
  await assert.rejects(() => client.request('//evil.example'));
});

test('admin cliente permite consultar pendientes y retirar registros con POST protegido', async () => {
  const { createAdminClient } = await load();
  const calls = [];
  const client = createAdminClient(undefined, async (url, options) => {
    calls.push({ url, ...options });
    return Response.json({ csrf: 'csrf-token', items: [] });
  });
  await client.session();
  await client.request('/vocero-accounts');
  await client.request('/vocero-accounts/' + 'a'.repeat(32) + '/delete', { method: 'POST', body: {} });
  await client.request('/voceros/' + 'b'.repeat(32) + '/delete', { method: 'POST', body: {} });
  assert.equal(calls[1].url.endsWith('/vocero-accounts'), true);
  assert.equal(calls[2].method, 'POST');
  assert.equal(calls[2].headers['X-CSRF-Token'], 'csrf-token');
  assert.equal(calls[3].url.endsWith('/voceros/' + 'b'.repeat(32) + '/delete'), true);
});

test('admin cliente distingue errores de sesión, permiso, validación y red', async () => {
  const { createAdminClient } = await load();
  for (const status of [401, 403, 422]) {
    const client = createAdminClient(undefined, async () => Response.json({ message: 'error' }, { status }));
    await assert.rejects(() => client.session(), error => error.status === status && error.message.length > 0);
  }
  const client = createAdminClient(undefined, async () => { throw new TypeError('network'); });
  await assert.rejects(() => client.session(), error => error.status === 0);
});
