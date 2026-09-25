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
  assert.equal((html.match(/name="schedule_video_[1-5]_enabled"/g) ?? []).length, 5);
  assert.equal((html.match(/name="schedule_video_[1-5]_enabled_at"/g) ?? []).length, 5);
  assert.match(html, /data-global-video-form/);
  assert.match(html, /Estas fechas aplican para todos los voceros/);
  assert.doesNotMatch(html, /name="videos_unlocked"/);
});

test('admin ubica el top de seguidores antes de registros y pendientes al final colapsado', async () => {
  const { renderAdminVocerosPage } = await import('../src/admin/page.mjs');
  const html = renderAdminVocerosPage({ title: 'Voceros', route: '/admin/voceros/' });
  const topIndex = html.indexOf('data-followers-leaderboard');
  const recordsIndex = html.indexOf('data-records-region');
  const pendingIndex = html.indexOf('data-pending-accounts');

  assert.ok(topIndex > -1, 'el ranking de seguidores debe existir');
  assert.ok(recordsIndex > topIndex, 'registros debe quedar después del ranking');
  assert.ok(pendingIndex > recordsIndex, 'cuentas pendientes debe quedar al final de la página');
  assert.match(html, /<details class="pending-accounts"[^>]*data-pending-panel/);
  assert.doesNotMatch(html, /<details class="pending-accounts"[^>]*open/);
});

test('admin agrega una columna visual de videos enviados en la tabla de registros', async () => {
  const { renderAdminVocerosPage } = await import('../src/admin/page.mjs');
  const html = renderAdminVocerosPage({ title: 'Voceros', route: '/admin/voceros/' });

  assert.match(html, /<th scope="col">Videos<\/th>/);
  assert.ok(html.indexOf('<th scope="col">Videos</th>') > html.indexOf('<th scope="col">Registro</th>'));
  assert.ok(html.indexOf('<th scope="col">Estado</th>') > html.indexOf('<th scope="col">Videos</th>'));
});

test('admin normaliza videos enviados para marcar cinco checks en tabla', async () => {
  const { videoSubmissionState } = await load();

  assert.deepEqual(videoSubmissionState({ videos_submitted: 2 }), { submitted: 2, total: 5 });
  assert.deepEqual(videoSubmissionState({ videos: [{ status: 'submitted', url: 'https://video.example/1' }, { status: 'enabled' }] }), { submitted: 1, total: 5 });
  assert.deepEqual(videoSubmissionState({ videos_submitted: 99 }), { submitted: 5, total: 5 });
  assert.deepEqual(videoSubmissionState({ videos_submitted: -1 }), { submitted: 0, total: 5 });
});

test('admin ordena y limita el top de seguidores para lectura rápida', async () => {
  const { topFollowers } = await load();
  const items = Array.from({ length: 18 }, (_, index) => ({
    full_name: `Vocero ${index}`,
    city: index % 2 ? 'Ambato' : '',
    main_network: index % 3 ? 'TikTok' : '',
    followers_count: index * 100,
  }));
  items.push({ full_name: 'Sin dato', followers_count: 'no-numérico' });

  const ranking = topFollowers(items, 15);

  assert.equal(ranking.length, 15);
  assert.equal(ranking[0].full_name, 'Vocero 17');
  assert.equal(ranking[0].followers_count, 1700);
  assert.equal(ranking.at(-1).full_name, 'Vocero 3');
  assert.equal(ranking.some(item => item.full_name === 'Sin dato'), false);
});

test('admin prepara y valida calendario global de videos', async () => {
  const { collectVideoSchedulePayload } = await load();
  const videos = new Map([
    ['1_enabled', { checked: true }],
    ['1_enabled_at', { value: '2026-09-20', focused: false, focus() { this.focused = true; } }],
  ]);
  const videoInput = (slot, suffix) => videos.get(`${slot}_${suffix}`) ?? (suffix === 'enabled' ? { checked: false } : { value: '', focus() {} });

  assert.deepEqual(collectVideoSchedulePayload(videoInput).body, {
    video_slots: [
      { slot: 1, enabled: true, enabled_at: '2026-09-20' },
      { slot: 2, enabled: false, enabled_at: null },
      { slot: 3, enabled: false, enabled_at: null },
      { slot: 4, enabled: false, enabled_at: null },
      { slot: 5, enabled: false, enabled_at: null },
    ],
  });

  videos.get('1_enabled_at').value = '';
  const invalid = collectVideoSchedulePayload(videoInput);
  assert.equal(invalid.error, 'Indica la fecha de habilitación del video 1.');
  invalid.focus();
  assert.equal(videos.get('1_enabled_at').focused, true);
});

test('admin prepara el autoguardado de progreso con seguidores sin fechas de video', async () => {
  const { collectProgressPayload } = await load();
  const elements = {
    followers_count: { value: '15750' },
    level: { value: '3' },
    traffic_light: { value: 'yellow' },
    kit_status: { value: 'pendiente' },
  };

  assert.deepEqual(collectProgressPayload({ elements }).body, {
    followers_count: 15750,
    level: 3,
    traffic_light: 'yellow',
    kit_status: 'pendiente',
    video_views: [
      { slot: 1, views_count: 0 },
      { slot: 2, views_count: 0 },
      { slot: 3, views_count: 0 },
      { slot: 4, views_count: 0 },
      { slot: 5, views_count: 0 },
    ],
  });
});

test('admin incluye vistas validadas por cada video en progreso', async () => {
  const { collectProgressPayload } = await load();
  const elements = {
    followers_count: { value: '15750' },
    level: { value: '3' },
    traffic_light: { value: 'yellow' },
    kit_status: { value: 'pendiente' },
    video_views_1: { value: '1000' },
    video_views_2: { value: '' },
    video_views_3: { value: '250' },
    video_views_4: { value: '0' },
    video_views_5: { value: '12' },
  };

  assert.deepEqual(collectProgressPayload({ elements }).body.video_views, [
    { slot: 1, views_count: 1000 },
    { slot: 2, views_count: 0 },
    { slot: 3, views_count: 250 },
    { slot: 4, views_count: 0 },
    { slot: 5, views_count: 12 },
  ]);
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
  assert.match(html, /id="admin-forms-title"[^>]*>Panel y formularios<\/p>/);
  assert.match(html, /<a[^>]+href="\/admin\/voceros\/"[^>]+aria-current="page"[^>]*>[\s\S]*?<strong>Voceros<\/strong>[\s\S]*?<small>Registros y seguimiento<\/small>/);
  assert.match(html, /Los próximos formularios aparecerán aquí cuando estén habilitados\./);
  assert.match(html, /class="admin-sidebar__account"[\s\S]*?data-admin-logout/);
  assert.equal([...html.matchAll(/aria-current="page"/g)].length, 1);

  // Eventos vive dentro de Medios: el enlace de la sección manda sobre su panel de opciones.
  const group = html.slice(html.indexOf('<div class="admin-nav-group"'), html.indexOf('</div>', html.indexOf('data-nav-children')) + 6);
  // Medios es un botón que despliega; «Seguimiento de medios» es la opción que lleva a /admin/medios/.
  // Fuera de Medios llega ya plegado desde el servidor: el menú no salta cuando carga el JavaScript.
  assert.match(group, /<button type="button" class="admin-nav-link admin-nav-toggle" data-nav-parent aria-expanded="false" aria-controls="admin-nav-medios">/);
  assert.match(group, /<div class="admin-nav-children" id="admin-nav-medios" data-nav-children hidden>/);
  assert.doesNotMatch(group.slice(0, group.indexOf('data-nav-children')), /href=/);
  assert.match(group, /href="\/admin\/medios\/"><span class="admin-nav-marker" aria-hidden="true">›<\/span><span><strong>Seguimiento de medios<\/strong>/);
  assert.ok(group.indexOf('Seguimiento de medios') < group.indexOf('href="/admin/medios/eventos/"'));
  assert.match(group, /href="\/admin\/medios\/eventos\/"/);
  assert.ok(!html.includes('href="/admin/medios/eventos/"', html.indexOf('data-nav-children') + group.length),
    'Eventos aparece una sola vez y siempre dentro de Medios');

  // El módulo compartido se publica y lo carga cada pantalla administrativa.
  const sidebar = await readFile(join(out, 'assets/admin/sidebar.js'), 'utf8');
  assert.equal(sidebar, await readFile(new URL('../src/admin/sidebar.js', import.meta.url), 'utf8'));
  for (const bundle of ['admin.js', 'panel.js', 'admin-medios.js', 'admin-emprendedores.js']) {
    assert.match(await readFile(join(out, 'assets/admin', bundle), 'utf8'), /import '\.\/sidebar\.js\?v=/, bundle);
  }
});

test('el submenú de Medios se pliega salvo en su propia sección', async () => {
  const { initializeAdminSidebar, groupIsCurrent } = await import('../src/admin/sidebar.js');
  const build = (currentChild = false) => {
    const children = { hidden: false, querySelector: () => ({ focus() {} }) };
    const parent = {
      attributes: { 'aria-expanded': 'true' },
      handler: null,
      setAttribute(name, value) { this.attributes[name] = value; },
      getAttribute(name) { return this.attributes[name]; },
      addEventListener(_, handler) { this.handler = handler; },
    };
    const group = { querySelector: selector => (selector === '[data-nav-parent]' ? parent : children), current: currentChild };
    group.querySelector = selector => {
      if (selector === '[aria-current="page"]') return currentChild ? {} : null;
      return selector === '[data-nav-parent]' ? parent : children;
    };
    initializeAdminSidebar({ querySelectorAll: () => [group] });
    return { parent, children };
  };

  // Fuera de Medios arranca plegado; el primer clic no navega, abre.
  const away = build(false);
  assert.equal(away.children.hidden, true);
  assert.equal(away.parent.getAttribute('aria-expanded'), 'false');
  let prevented = false;
  away.parent.handler({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(away.children.hidden, false);
  // Medios es solo un botón: el siguiente clic tampoco navega, cierra el grupo.
  prevented = false;
  away.parent.handler({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(away.children.hidden, true);
  assert.equal(away.parent.getAttribute('aria-expanded'), 'false');

  // Dentro de Medios o de Eventos se ve desplegado desde el inicio.
  const inside = build(true);
  assert.equal(inside.children.hidden, false);
  assert.equal(inside.parent.getAttribute('aria-expanded'), 'true');
  assert.equal(groupIsCurrent({ querySelector: () => null }), false);
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
