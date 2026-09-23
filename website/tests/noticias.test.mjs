import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';
import { daysLeft, phaseLabel, rangeLabel, todayLabel } from '../src/admin/campaign-banner.js';
import { createNewsClient, noticePayload, phasePayload, phaseState } from '../src/admin/admin-noticias.js';

test('la banda dice la fecha de hoy y el tramo en palabras del equipo', () => {
  assert.equal(todayLabel('2026-09-23'), 'miércoles 23 de septiembre');
  assert.equal(todayLabel(''), '');
  // El mes se repite solo cuando el tramo cruza de mes.
  assert.equal(rangeLabel('2026-10-03', '2026-10-11'), '3 – 11 oct');
  assert.equal(rangeLabel('2026-09-17', '2026-10-02'), '17 sep – 2 oct');
  assert.equal(rangeLabel('malo', '2026-10-02'), '');
  assert.equal(phaseLabel({ title: 'Revelación + Preventa', detail: 'Comercial · mixto · feria' }), 'Revelación + Preventa · Comercial · mixto · feria');
  assert.equal(phaseLabel({ title: 'Cierre', detail: '' }), 'Cierre');
  assert.equal(phaseLabel(null), '');
  // Cuánto queda del tramo, para saber si la semana ya se acaba.
  assert.equal(daysLeft('2026-09-23', '2026-10-02'), 9);
  assert.equal(daysLeft('2026-10-02', '2026-10-02'), 0);
  assert.equal(daysLeft('2026-10-03', '2026-10-02'), -1);
});

test('cada tramo sabe si es el de hoy, uno pasado o uno que viene', () => {
  const phase = { starts_on: '2026-09-17', ends_on: '2026-10-02' };
  assert.equal(phaseState(phase, '2026-09-23'), 'actual');
  assert.equal(phaseState(phase, '2026-09-17'), 'actual', 'el primer día ya cuenta');
  assert.equal(phaseState(phase, '2026-10-02'), 'actual', 'y el último también');
  assert.equal(phaseState(phase, '2026-10-03'), 'pasado');
  assert.equal(phaseState(phase, '2026-09-16'), 'proximo');
  assert.equal(phaseState(null, '2026-09-23'), 'otro');
});

test('los formularios de tramo y aviso validan antes de salir a la red', () => {
  const phase = new Map([['title', ' Revelación + Preventa '], ['detail', 'Comercial · mixto · feria'],
    ['starts_on', '2026-09-17'], ['ends_on', '2026-10-02'], ['accent', '#f5bf2f']]);
  assert.deepEqual(phasePayload(phase), {
    title: 'Revelación + Preventa', detail: 'Comercial · mixto · feria',
    starts_on: '2026-09-17', ends_on: '2026-10-02', accent: '#f5bf2f',
  });
  assert.throws(() => phasePayload(new Map([['title', ''], ['starts_on', '2026-09-17'], ['ends_on', '2026-10-02']])), /tema del tramo/);
  assert.throws(() => phasePayload(new Map([['title', 'x'], ['starts_on', ''], ['ends_on', '2026-10-02']])), /fechas del tramo/);
  assert.throws(() => phasePayload(new Map([['title', 'x'], ['starts_on', '2026-10-02'], ['ends_on', '2026-09-17']])), /anterior a la inicial/);

  assert.deepEqual(noticePayload(new Map([['body', ' Grabamos con audiovisual '], ['starts_on', ''], ['ends_on', '']])),
    { body: 'Grabamos con audiovisual', starts_on: '', ends_on: '' });
  assert.throws(() => noticePayload(new Map([['body', '  ']])), /Escribe el aviso/);
  assert.throws(() => noticePayload(new Map([['body', 'x'], ['starts_on', '2026-10-10'], ['ends_on', '2026-10-01']])), /anterior a la inicial/);
});

test('el cliente de noticias solo llama a sus rutas y exige CSRF para escribir', async () => {
  const calls = [];
  const client = createNewsClient('https://finados.complejomushucruna.com/api', async (url, options) => {
    calls.push([url.replace('https://finados.complejomushucruna.com/api', ''), options.method]);
    return { ok: true, json: async () => ({ csrf: 'token' }) };
  });
  await assert.rejects(() => client.request('/voceros'), /Ruta de API no permitida/);
  await assert.rejects(() => client.request('/creadoras'), /Ruta de API no permitida/);
  await assert.rejects(() => client.createPhase({}), error => error.status === 403);
  await client.session();
  const id = 'a'.repeat(32);
  await client.overview();
  await client.createPhase({ title: 'x' });
  await client.updatePhase(id, { title: 'y' });
  await client.deletePhase(id);
  await client.createNotice({ body: 'z' });
  await client.deleteNotice(id);
  assert.deepEqual(calls, [
    ['/auth/session', 'GET'], ['/noticias', 'GET'], ['/noticias/fases', 'POST'],
    [`/noticias/fases/${id}`, 'PATCH'], [`/noticias/fases/${id}`, 'POST'],
    ['/noticias/avisos', 'POST'], [`/noticias/avisos/${id}`, 'POST'],
  ]);
});

test('la banda del tema central sale en todos los paneles y Noticias tiene su sección', async t => {
  const output = await mkdtemp(join(tmpdir(), 'noticias-build-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const files = new Set(await buildSite(output));
  assert.ok(files.has('admin/noticias/index.html'));
  assert.ok(files.has('assets/admin/admin-noticias.js'));
  assert.ok(files.has('assets/admin/campaign-banner.js'));

  // La banda va arriba de cada panel del equipo.
  for (const route of ['admin/panel', 'admin/voceros', 'admin/medios', 'admin/medios/eventos', 'admin/emprendedores', 'admin/creadoras']) {
    const html = await readFile(join(output, route, 'index.html'), 'utf8');
    assert.match(html, /<section class="campaign-banner" data-campaign-banner hidden/, route);
    const bundle = /<script type="module" src="\/assets\/(admin\/[^?"]+)/.exec(html)?.[1];
    assert.ok(bundle, `${route} carga un bundle`);
    assert.match(await readFile(join(output, 'assets', bundle), 'utf8'), /campaign-banner\.js\?v=/, `${route} carga la banda`);
  }

  // Noticias es la primera entrada del menú y trae el mapa y los avisos.
  const page = await readFile(join(output, 'admin/noticias/index.html'), 'utf8');
  for (const marker of ['data-admin-noticias', 'data-phase-list', 'data-notice-list', 'data-phase-dialog', 'data-notice-dialog', 'data-phase-new', 'data-notice-new'])
    assert.match(page, new RegExp(marker), marker);
  assert.match(page, /Mapa de la campaña/);
  const order = [...page.matchAll(/class="admin-nav-link(?: admin-nav-link--child)?" href="([^"]+)"/g)].map(match => match[1]);
  assert.equal(order[0], '/admin/noticias/', 'Noticias abre el menú');

  // El bundle no lleva la API local a producción.
  const bundle = await readFile(join(output, 'assets/admin/admin-noticias.js'), 'utf8');
  assert.match(bundle, /const LOCAL_API = null;/);
  assert.doesNotMatch(bundle, /127\.0\.0\.1/);
  // La banda tampoco lleva la API local a producción.
  const banner = await readFile(join(output, 'assets/admin/campaign-banner.js'), 'utf8');
  assert.match(banner, /const LOCAL_API = null;/);
  assert.doesNotMatch(banner, /127\.0\.0\.1/);
});
