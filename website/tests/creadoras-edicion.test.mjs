import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { pages } from '../src/pages.mjs';
import { campaignWeeks, CAMPAIGN_START, contentPayload, createCreadoraAdminClient, rangeLabel, shiftToWeek, shiftView, shiftsInWeek, viewRange, WEEKS_SHOWN } from '../src/admin/admin-creadoras.js';
import { ecuadorStamp, EDIT_TOTALS, filterEditing, itemWhen } from '../src/admin/admin-creadoras-edicion.js';

test('Creadoras se ve por semanas, como el Calendario de medios', () => {
  // Siete semanas desde la primera de campaña, de lunes a domingo.
  const range = viewRange('weeks', CAMPAIGN_START);
  assert.equal(range.days.length, WEEKS_SHOWN * 7);
  assert.deepEqual([range.from, range.to], ['2026-09-21', '2026-11-09']);
  assert.equal(viewRange('weeks', '2026-09-24').from, '2026-09-21', 'cualquier día arranca en el lunes de su semana');
  assert.equal(shiftView('weeks', '2026-09-21', 1), '2026-09-28');
  assert.equal(shiftView('weeks', '2026-09-21', -1), '2026-09-14');
  assert.match(rangeLabel('weeks', CAMPAIGN_START), /^21 de septiembre al 8 de noviembre de 2026$/);

  const weeks = campaignWeeks(CAMPAIGN_START);
  assert.deepEqual(weeks.map(week => week.name), ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4', 'Semana 5', 'Semana 6', 'Semana 7']);
  assert.deepEqual([weeks[5].start, weeks[5].end], ['2026-10-26', '2026-11-01']);
  assert.equal(campaignWeeks('2026-09-14', 1)[0].name, 'Antes de la campaña');

  // Cada semana muestra sus turnos en orden de día y hora; el domingo es de su semana.
  const shifts = [
    { public_id: 'b', starts_at: '2026-09-27 18:00', ends_at: '2026-09-27 20:00' },
    { public_id: 'a', starts_at: '2026-09-22 09:00', ends_at: '2026-09-22 12:00' },
    { public_id: 'c', starts_at: '2026-09-28 09:00', ends_at: '2026-09-28 10:00' },
  ];
  assert.deepEqual(shiftsInWeek(shifts, '2026-09-21').map(shift => shift.public_id), ['a', 'b']);
  assert.deepEqual(shiftsInWeek(shifts, '2026-09-28').map(shift => shift.public_id), ['c']);

  // Arrastrar a otra semana conserva el día de la semana, la hora y la duración.
  assert.deepEqual(shiftToWeek(shifts[0], '2026-10-12'), { starts_at: '2026-10-18 18:00', ends_at: '2026-10-18 20:00' });
  assert.deepEqual(shiftToWeek(shifts[1], '2026-09-14'), { starts_at: '2026-09-15 09:00', ends_at: '2026-09-15 12:00' });
});

test('el contenido del turno dice de qué guion salió, o que es creado nuevo', () => {
  assert.deepEqual(contentPayload({ kind: 'video', title: 'Recorrido', url: '', script: 'a'.repeat(32) }), { kind: 'video', title: 'Recorrido', url: '', script: 'a'.repeat(32) });
  assert.deepEqual(contentPayload({ kind: 'video', title: 'Baile', url: '', script: '' }), { kind: 'video', title: 'Baile', url: '' });
});

test('Edición filtra por estado, creadora, guion y texto, y lee la hora en Ecuador', () => {
  const items = [
    { public_id: '1', title: 'Recorrido', creadora: 'ana', creadora_name: 'Ana', edited: false, has_script: true, script: { title: 'Idea A', body: 'Plano de la colada' } },
    { public_id: '2', title: 'Baile', creadora: 'eva', creadora_name: 'Eva', edited: true, has_script: false, script: null },
    { public_id: '3', title: 'Entrevista', creadora: 'ana', creadora_name: 'Ana', edited: false, has_script: false, script: null },
  ];
  const ids = filters => filterEditing(items, filters).map(item => item.public_id);
  assert.deepEqual(ids({}), ['1', '3'], 'por defecto solo lo que falta editar');
  assert.deepEqual(ids({ state: 'edited' }), ['2']);
  assert.deepEqual(ids({ state: '', script: 'new' }), ['2', '3']);
  assert.deepEqual(ids({ state: '', script: 'with' }), ['1']);
  assert.deepEqual(ids({ state: '', creadora: 'eva' }), ['2']);
  assert.deepEqual(ids({ state: '', search: 'COLADA' }), ['1'], 'busca también dentro del guion');
  assert.equal(ecuadorStamp('2026-10-05 20:30:00'), '05/10/2026 15:30');
  assert.equal(ecuadorStamp('2026-10-06 02:00:00'), '05/10/2026 21:00', 'de madrugada en UTC sigue siendo la noche anterior en Ecuador');
  assert.equal(ecuadorStamp(null), '');
  assert.equal(itemWhen({ starts_at: '2026-10-05 10:00', ends_at: '2026-10-05 13:00' }), 'lun 5 · 10:00–13:00');
  assert.deepEqual(EDIT_TOTALS.map(([key]) => key), ['pending', 'edited', 'with_script', 'new', 'total']);
});

test('el cliente de Creadoras solo habla con las rutas de Edición permitidas', async () => {
  const calls = [];
  const fetcher = async (url, options) => { calls.push([url, options.method, options.body]); return { ok: true, json: async () => ({ csrf: 'x', items: [] }) }; };
  const client = createCreadoraAdminClient('https://finados.complejomushucruna.com/api', fetcher);
  await client.session();
  await client.editing();
  await client.updateEditing('content', 'a'.repeat(32), { edited: true });
  await client.updateEditing('script', 'b'.repeat(32), { edited: false });
  assert.deepEqual(calls.slice(1).map(([url, method]) => [url.replace('https://finados.complejomushucruna.com/api', ''), method]), [
    ['/creadoras/edicion', 'GET'], [`/creadoras/edicion/contenido/${'a'.repeat(32)}`, 'PATCH'], [`/creadoras/edicion/guion/${'b'.repeat(32)}`, 'PATCH'],
  ]);
  await assert.rejects(client.request('/creadoras/edicion/borrar'), /Ruta de API no permitida/);
});

test('Creadoras despliega Creadoras y Edición en el menú, y Edición se publica', async t => {
  const output = await mkdtemp(join(tmpdir(), 'creadoras-edicion-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const files = await buildSite(output);
  assert.ok(files.includes('admin/creadoras/edicion/index.html'));
  assert.ok(files.includes('assets/admin/admin-creadoras-edicion.js'));
  const html = await readFile(join(output, 'admin/creadoras/edicion/index.html'), 'utf8');
  assert.match(html, /data-admin-creadoras-edicion/);
  assert.match(html, /<h1>Edición<\/h1>/);
  for (const marker of ['data-edit-totals', 'data-edit-filters', 'data-edit-list', 'value="pending"', 'value="new"']) assert.ok(html.includes(marker), marker);
  assert.doesNotMatch(html, /\sstyle="/);
  assert.doesNotMatch(html, /fbevents|connect\.facebook/);
  assert.equal(pages.find(page => page.route === '/admin/creadoras/edicion/').indexable, false);
  // Creadoras es un botón que despliega sus dos opciones, como Medios y Producción.
  assert.match(html, /<button type="button" class="admin-nav-link admin-nav-toggle" data-nav-parent aria-expanded="true" aria-controls="admin-nav-creadoras" data-nav-current>/);
  assert.match(html, /href="\/admin\/creadoras\/"><span class="admin-nav-marker" aria-hidden="true">›<\/span><span><strong>Creadoras<\/strong>/);
  assert.match(html, /href="\/admin\/creadoras\/edicion\/" aria-current="page"><span class="admin-nav-marker" aria-hidden="true">›<\/span><span><strong>Edición<\/strong>/);
  const panel = await readFile(join(output, 'admin/panel/index.html'), 'utf8');
  assert.match(panel, /aria-controls="admin-nav-creadoras">[\s\S]*?<div class="admin-nav-children" id="admin-nav-creadoras" data-nav-children hidden>/);
  const bundle = await readFile(join(output, 'assets/admin/admin-creadoras-edicion.js'), 'utf8');
  assert.match(bundle, /from '\.\/admin-creadoras\.js\?v=20260926-creadoras-12'/);
  assert.match(bundle, /const LOCAL_API = null;/);
});
