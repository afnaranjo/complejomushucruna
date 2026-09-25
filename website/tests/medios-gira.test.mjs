import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { pages } from '../src/pages.mjs';
import { filterMedia, visitMarks, visitPayload, visitPeople, visitTitle } from '../src/admin/admin-medios-gira.js';

test('Gira de medios: página propia dentro de Medios con el mismo calendario de Creadoras', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-gira-'));
  const files = await buildSite(output);
  assert.ok(files.includes('admin/medios/gira/index.html'));
  assert.ok(files.includes('assets/admin/admin-medios-gira.js'));
  const html = await readFile(join(output, 'admin/medios/gira/index.html'), 'utf8');
  assert.match(html, /data-admin-medios-gira/);
  assert.match(html, /<h1>Gira de medios<\/h1>/);
  for (const marker of ['data-person-list', 'data-calendar-grid', 'data-calendar-month', 'data-visit-dialog', 'data-person-dialog', 'data-media-select', 'data-media-search', 'data-visit-people', 'data-view="day"', 'data-view="week"', 'data-view="month"']) assert.ok(html.includes(marker), marker);
  assert.doesNotMatch(html, /\sstyle="/);
  // En el menú: dentro de Medios, después del Calendario de medios, y es la página actual.
  const group = html.slice(html.indexOf('<div class="admin-nav-group"'), html.indexOf('</div></div>', html.indexOf('data-nav-children')));
  assert.ok(group.indexOf('/admin/medios/calendario/') < group.indexOf('/admin/medios/gira/'));
  assert.match(group, /href="\/admin\/medios\/gira\/" aria-current="page"><span class="admin-nav-marker" aria-hidden="true">›<\/span><span><strong>Gira de medios<\/strong>/);
  const bundle = await readFile(join(output, 'assets/admin/admin-medios-gira.js'), 'utf8');
  assert.doesNotMatch(bundle, /127\.0\.0\.1|innerHTML|localStorage/);
  assert.match(bundle, /from '\.\/admin-creadoras\.js\?v=/);
  assert.match(await readFile(join(output, 'assets/admin/admin-medios.js'), 'utf8'), /media-tour/);
  assert.equal(pages.find(page => page.route === '/admin/medios/gira/').indexable, false);
});

test('Gira de medios: caja de la cita, búsqueda de medios y datos que se envían', () => {
  const visit = { media: { name: 'Radio Centro' }, people: [{ name: 'Ana' }, { name: 'Luis' }], kind: 'en_vivo', status: 'confirmada' };
  assert.equal(visitTitle(visit), 'Radio Centro');
  assert.equal(visitPeople(visit), 'Ana, Luis');
  assert.equal(visitMarks(visit), 'En vivo · ✓ confirmada');
  assert.equal(visitMarks({ kind: 'entrevista', status: 'programada' }), 'Entrevista');
  const media = [{ name: 'Radio Centro', city: 'Ambato', frequency: '96.5 FM' }, { name: 'Unimax Televisión', city: 'Riobamba', frequency: '' }];
  assert.deepEqual(filterMedia(media, 'television').map(item => item.name), ['Unimax Televisión']);
  assert.deepEqual(filterMedia(media, 'AMBATO').map(item => item.name), ['Radio Centro']);
  assert.deepEqual(filterMedia(media, '96.5').map(item => item.name), ['Radio Centro']);
  assert.equal(filterMedia(media, '  ').length, 2);
  const base = { media: 'a'.repeat(32), people: ['b'.repeat(32)], day: '2026-10-28', start: '09:00', end: '10:00', kind: 'entrevista', status: 'programada', place: ' Cabina ', note: '' };
  assert.deepEqual(visitPayload(base), { media: 'a'.repeat(32), people: ['b'.repeat(32)], starts_at: '2026-10-28 09:00', ends_at: '2026-10-28 10:00', kind: 'entrevista', status: 'programada', place: 'Cabina', note: '' });
  assert.throws(() => visitPayload({ ...base, media: '' }), /Elige el medio/);
  assert.throws(() => visitPayload({ ...base, people: [] }), /al menos una persona/);
  assert.throws(() => visitPayload({ ...base, end: '08:00' }), /posterior/);
  assert.throws(() => visitPayload({ ...base, end: '09:10' }), /15 minutos/);
});
