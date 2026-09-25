import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { pages } from '../src/pages.mjs';
import { boxColors, durationText, entryGeometry, entryLabel, entryMarks, entryPayload, entrySpan, fromJornada, jornadaHours, jornadaMinutes, movedEntry, resizedEntry, slotFor, toJornada } from '../src/admin/admin-produccion.js';

test('Producción: grupo en el menú con Activaciones, Cronograma Sol y Cronograma Luna, cada uno su tablero', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-produccion-'));
  const files = await buildSite(output);
  assert.ok(files.includes('assets/admin/admin-produccion.js'));
  for (const [board, title] of [['activaciones', 'Activaciones'], ['sol', 'Cronograma Sol'], ['luna', 'Cronograma Luna']]) {
    assert.ok(files.includes(`admin/produccion/${board}/index.html`), board);
    const html = await readFile(join(output, `admin/produccion/${board}/index.html`), 'utf8');
    assert.match(html, new RegExp(`data-admin-produccion data-board="${board}"`));
    assert.match(html, new RegExp(`<h1>${title}</h1>`));
    for (const marker of ['data-item-list', 'data-calendar-grid', 'data-entry-dialog', 'data-item-dialog', 'data-view="week"']) assert.ok(html.includes(marker), `${board}: ${marker}`);
    assert.doesNotMatch(html, /\sstyle="/);
    assert.match(html, new RegExp(`href="/admin/produccion/${board}/" aria-current="page"`));
    assert.equal(pages.find(page => page.route === `/admin/produccion/${board}/`).indexable, false);
  }
  // Producción es un botón que despliega su grupo, como Medios.
  const html = await readFile(join(output, 'admin/produccion/sol/index.html'), 'utf8');
  assert.match(html, /<button type="button" class="admin-nav-link admin-nav-toggle" data-nav-parent aria-expanded="true" aria-controls="admin-nav-produccion" data-nav-current>/);
  const panel = await readFile(join(output, 'admin/panel/index.html'), 'utf8');
  assert.match(panel, /aria-controls="admin-nav-produccion">[\s\S]*?<div class="admin-nav-children" id="admin-nav-produccion" data-nav-children hidden>/);
  const bundle = await readFile(join(output, 'assets/admin/admin-produccion.js'), 'utf8');
  assert.doesNotMatch(bundle, /127\.0\.0\.1|innerHTML|localStorage/);
  assert.match(await readFile(join(output, 'assets/admin/admin-medios.js'), 'utf8'), /produccion/);
});

test('Producción: colores de la caja, duración de la pieza y bloque que se envía', () => {
  assert.deepEqual(boxColors('#6E2CE0'), { edge: '#6e2ce0', soft: 'color-mix(in srgb, #6e2ce0 12%, white)', ink: 'color-mix(in srgb, #6e2ce0 72%, black)' });
  assert.equal(boxColors('rojo').edge, '#94165e');
  assert.equal(durationText(90), '1 h 30 min');
  assert.equal(durationText(60), '1 hora');
  assert.equal(entryMarks({ owner: 'Iván', place: 'Tarima', status: 'confirmado' }), '👤 Iván · Tarima · ✓ confirmado');
  assert.deepEqual(slotFor('2026-10-30', 19 * 60, 90), { starts_at: '2026-10-30 19:00', ends_at: '2026-10-30 20:30' });
  // Un show que empieza a las 23:00 termina de madrugada, en la misma caja.
  assert.deepEqual(slotFor('2026-10-30', 23 * 60, 120), { starts_at: '2026-10-30 23:00', ends_at: '2026-10-31 01:00' });
  // La jornada llega hasta las 03:00: un bloque muy tarde se corre para caber.
  assert.deepEqual(slotFor('2026-10-30', 26 * 60 + 30, 120), { starts_at: '2026-10-31 01:00', ends_at: '2026-10-31 03:00' });
  const base = { title: ' Show principal ', day: '2026-10-30', start: '19:00', end: '20:30', color: '#6e2ce0', status: 'planificado', owner: '', place: '', note: '' };
  assert.equal(entryPayload(base).title, 'Show principal');
  assert.equal(entryPayload(base).starts_at, '2026-10-30 19:00');
  assert.throws(() => entryPayload({ ...base, title: ' ' }), /título/);
  assert.throws(() => entryPayload({ ...base, end: '18:00' }), /12 horas/);
  // Si la hora de fin es de madrugada, termina al día siguiente.
  assert.deepEqual([entryPayload({ ...base, start: '23:30', end: '01:30' }).starts_at, entryPayload({ ...base, start: '23:30', end: '01:30' }).ends_at], ['2026-10-30 23:30', '2026-10-31 01:30']);
  // Si empieza de madrugada, es de esa misma noche.
  assert.deepEqual([entryPayload({ ...base, start: '01:00', end: '02:00' }).starts_at, entryPayload({ ...base, start: '01:00', end: '02:00' }).ends_at], ['2026-10-31 01:00', '2026-10-31 02:00']);
});

test('Producción: la jornada va de 06:00 a 03:00 y lo de madrugada es de la noche anterior', () => {
  assert.deepEqual(toJornada('2026-10-31 01:30'), { key: '2026-10-30', minutes: 1530 });
  assert.deepEqual(toJornada('2026-10-30 19:00'), { key: '2026-10-30', minutes: 1140 });
  assert.equal(fromJornada('2026-10-30', 1530), '2026-10-31 01:30');
  const late = { starts_at: '2026-10-30 23:00', ends_at: '2026-10-31 01:30' };
  assert.deepEqual(entrySpan(late), { key: '2026-10-30', start: 1380, end: 1530 });
  assert.equal(entryLabel(late), '23:00–01:30 (+1)');
  assert.equal(entryGeometry(late, '2026-10-31'), null);
  const geometry = entryGeometry(late, '2026-10-30');
  assert.ok(Math.abs(geometry.top - ((1380 - 360) / 1260) * 100) < 1e-9 && Math.abs(geometry.height - (150 / 1260) * 100) < 1e-9);
  assert.equal(jornadaHours().length, 21);
  assert.deepEqual(jornadaHours().slice(-3), [0, 1, 2]);
  assert.equal(jornadaMinutes(1), 26 * 60 + 45);
  assert.deepEqual(movedEntry(late, '2026-10-31', 22 * 60), { starts_at: '2026-10-31 22:00', ends_at: '2026-11-01 00:30' });
  assert.deepEqual(resizedEntry(late, 26 * 60), { starts_at: '2026-10-30 23:00', ends_at: '2026-10-31 02:00' });
  assert.deepEqual(resizedEntry(late, 40 * 60), { starts_at: '2026-10-30 23:00', ends_at: '2026-10-31 03:00' });
});
