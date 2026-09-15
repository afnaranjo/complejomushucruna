import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';

const load = () => import('../src/admin/admin.js');
test('admin genera acceso aislado, recursos y configuración segura de producción', async () => {
  const out = await mkdtemp(join(tmpdir(), 'admin-build-'));
  const files = await buildSite(out);
  assert.ok(files.includes('admin/index.html'));
  assert.ok(files.includes('admin/voceros/index.html'));
  for (const path of ['admin/index.html', 'admin/voceros/index.html']) {
    const html = await readFile(join(out, path), 'utf8');
    assert.match(html, /name="robots" content="noindex, nofollow, noarchive"/);
    assert.match(html, /Content-Security-Policy/);
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

test('admin limita el build de desarrollo a configuración local explícita', async () => {
  const out = await mkdtemp(join(tmpdir(), 'admin-dev-'));
  await buildSite(out, { adminEnvironment: 'development' });
  const html = await readFile(join(out, 'admin/index.html'), 'utf8');
  assert.match(html, /name="admin-api-base" content="http:\/\/127.0.0.1:4174\/api"/);
  await assert.rejects(() => buildSite(out, { adminEnvironment: 'https://evil.example' }));
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

test('admin cliente distingue errores de sesión, permiso, validación y red', async () => {
  const { createAdminClient } = await load();
  for (const status of [401, 403, 422]) {
    const client = createAdminClient(undefined, async () => Response.json({ message: 'error' }, { status }));
    await assert.rejects(() => client.session(), error => error.status === status && error.message.length > 0);
  }
  const client = createAdminClient(undefined, async () => { throw new TypeError('network'); });
  await assert.rejects(() => client.session(), error => error.status === 0);
});
