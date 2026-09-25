import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { pages } from '../src/pages.mjs';
import {
  daysInclusive, importedPlan, initialPlan, mediaFromSource, moveToWeek, pdfFromJpeg, planRows, spotKpis, suggestedAssignments, textColorFor, weekFor, WEEKS,
} from '../src/admin/admin-medios-calendario.js';

test('Calendario de medios: página propia dentro de Medios, sin estilos ni scripts en línea', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-medios-calendario-'));
  const files = await buildSite(output);
  assert.ok(files.includes('admin/medios/calendario/index.html'));
  assert.ok(files.includes('assets/admin/admin-medios-calendario.js'));
  const html = await readFile(join(output, 'admin/medios/calendario/index.html'), 'utf8');
  assert.match(html, /data-admin-medios-calendario/);
  assert.match(html, /<h1>Calendario estratégico de comunicación<\/h1>/);
  for (const tab of ['spots', 'calendario', 'medios', 'plan', 'reportes']) assert.match(html, new RegExp(`data-plan-tab="${tab}"`), tab);
  for (const dialog of ['spot', 'assignment', 'media', 'plan']) assert.match(html, new RegExp(`data-dialog="${dialog}"`), dialog);
  // La política de seguridad del panel no admite estilos en línea ni librerías externas.
  assert.doesNotMatch(html, /\sstyle="/);
  assert.doesNotMatch(html, /cdn\.jsdelivr|html2canvas|jspdf|onclick=/i);
  assert.match(html, /script-src 'self'/);
  // En el menú, el calendario vive dentro de Medios, debajo de Eventos, y es la página actual.
  const group = html.slice(html.indexOf('<div class="admin-nav-group"'), html.indexOf('</div></div>', html.indexOf('data-nav-children')));
  assert.ok(group.indexOf('href="/admin/medios/eventos/"') < group.indexOf('href="/admin/medios/calendario/"'));
  assert.match(group, /href="\/admin\/medios\/calendario\/" aria-current="page"><span class="admin-nav-marker" aria-hidden="true">›<\/span><span><strong>Calendario de medios<\/strong>/);
  const bundle = await readFile(join(output, 'assets/admin/admin-medios-calendario.js'), 'utf8');
  assert.doesNotMatch(bundle, /127\.0\.0\.1/);
  assert.doesNotMatch(bundle, /localStorage|innerHTML/);
  assert.match(bundle, /import \{ createMediaAdminClient \} from '\.\/admin-medios\.js\?v=/);
  const client = await readFile(join(output, 'assets/admin/admin-medios.js'), 'utf8');
  assert.match(client, /media-plan/);
  assert.equal(pages.find(page => page.route === '/admin/medios/calendario/').indexable, false);
  // Medios y Eventos siguen igual.
  for (const route of ['admin/medios/index.html', 'admin/medios/eventos/index.html']) assert.match(await readFile(join(output, route), 'utf8'), /data-admin-medios/);
});

test('Calendario de medios: estrategia sugerida, semanas y cálculos del plan', () => {
  let n = 0; const id = prefix => `${prefix}_${++n}`;
  const plan = initialPlan(id);
  assert.deepEqual(plan.spots.map(spot => spot.id), ['general', 'atractivos', 'carteleras']);
  assert.equal(plan.assignments.length, 16);
  assert.equal(suggestedAssignments([plan.spots[2]], id).length, 4);
  assert.deepEqual(spotKpis(plan), [['Piezas totales', 6], ['Con cobertura nacional', 2], ['Con cobertura regional', 3], ['Con cobertura local', 3]]);
  assert.equal(WEEKS.length, 7);
  assert.equal(daysInclusive('2026-09-21', '2026-11-05'), 46);
  assert.equal(weekFor('2026-10-30').id, 'w6');
  assert.equal(weekFor('2026-12-01'), null);
  // Mover a la última semana (4 días) recorta una pauta de 7 días sin salirse de la campaña.
  assert.deepEqual(moveToWeek({ id: 'a', spotId: 'general', weekId: 'w1', start: '2026-09-21', end: '2026-09-27', note: '' }, 'w7'), { id: 'a', spotId: 'general', weekId: 'w7', start: '2026-11-02', end: '2026-11-05', note: '' });
  assert.equal(moveToWeek({ start: '2026-10-22', end: '2026-10-25' }, 'w2').end, '2026-10-01');
  const state = { ...plan, media: [{ id: 'm1', name: 'Radio Centro', type: 'Radio', coverage: 'Regional', rate: 10 }], plans: [{ id: 'p1', mediaId: 'm1', spotId: 'general', start: '2026-09-21', end: '2026-09-30', freq: 3, cost: 12.5, objective: '' }] };
  const rows = planRows(state);
  assert.equal(rows.rows[0].days, 10);
  assert.equal(rows.impacts, 30);
  assert.equal(rows.total, 375);
  assert.equal(textColorFor('#94165e'), '#ffffff');
  assert.equal(textColorFor('#f5e6bd'), '#241146');
});

test('Calendario de medios: traer desde Medios registrados e importar el respaldo del archivo original', () => {
  assert.deepEqual(mediaFromSource({ public_id: 'a'.repeat(32), media_name: 'Radio Cumbre', media_types: ['radio', 'redes'], city: 'Riobamba', province: 'Chimborazo', program_name: '', frequency_channel: '98.5 FM' }),
    { name: 'Radio Cumbre', type: 'Radio', city: 'Riobamba / Chimborazo', program: '98.5 FM', sourceId: 'a'.repeat(32) });
  assert.equal(mediaFromSource({ media_types: ['tv'] }).type, 'Televisión');
  assert.equal(mediaFromSource({ media_types: [] }).type, 'Otro');
  // El respaldo del HTML original (sin sourceId) entra tal cual.
  const original = { spots: [{ id: 'general', qty: 1, name: 'AUDIO GENERAL', desc: '', national: true, regional: true, local: true, color: '#d91f26' }], assignments: [{ id: 'as_x', spotId: 'general', weekId: 'w1', start: '2026-09-21', end: '2026-09-27', note: 'Lanzamiento' }], media: [{ id: 'media_x', name: 'Radio', type: 'Radio', coverage: 'Local', city: '', program: '', contact: '', rate: 5, status: 'active', notes: '' }], plans: [] };
  const imported = importedPlan(original);
  assert.equal(imported.media[0].sourceId, '');
  assert.equal(imported.spots[0].color, '#d91f26');
  assert.throws(() => importedPlan({ spots: [] }), /no es un respaldo/);
});

test('Calendario de medios: el PDF se arma sin librerías y con su tabla de referencias correcta', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = pdfFromJpeg(jpeg, 2400, 1300, 1190.55, 841.89);
  const text = new TextDecoder('latin1').decode(pdf);
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  assert.match(text, /\/Filter \/DCTDecode \/Length 4/);
  const startxref = Number(/startxref\n(\d+)/.exec(text)[1]);
  assert.equal(text.slice(startxref, startxref + 4), 'xref');
  for (const [index, offset] of [...text.matchAll(/(\d{10}) 00000 n/g)].map((match, i) => [i + 1, Number(match[1])])) {
    assert.equal(text.slice(offset, offset + `${index} 0 obj`.length), `${index} 0 obj`);
  }
});
