import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { pages } from '../src/pages.mjs';
import { eventLabel, panelCards } from '../src/admin/panel.js';

test('el panel es la primera pantalla tras iniciar sesión y trae sus tres secciones', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-panel-'));
  const files = await buildSite(output);
  assert.ok(files.includes('admin/panel/index.html'));
  assert.ok(files.includes('assets/admin/panel.js'));
  const panel = await readFile(join(output, 'admin/panel/index.html'), 'utf8');
  assert.match(panel, /data-admin-panel/);
  for (const marker of ['data-panel-media', 'data-panel-events', 'data-panel-voceros']) assert.match(panel, new RegExp(marker), marker);
  assert.match(panel, /\/assets\/admin\/panel\.js\?v=/);
  // La cobertura por evento es parte de Medios: vive dentro de esa sección, no como una sección hermana.
  const medios = panel.slice(panel.indexOf('id="panel-medios-title"'), panel.indexOf('id="panel-voceros-title"'));
  assert.match(medios, /class="admin-panel-subsection"[^>]*aria-labelledby="panel-eventos-title"/);
  assert.match(medios, /<h3 id="panel-eventos-title">Medios por evento<\/h3>/);
  assert.ok(medios.includes('data-panel-events'), 'los eventos se muestran dentro de Medios');
  assert.match(panel, /href="\/admin\/panel\/" aria-current="page"/);
  // Noticias abre el menú porque manda sobre todo lo demás; el panel va justo después.
  const order = [...panel.matchAll(/class="admin-nav-link(?: admin-nav-link--child)?" href="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(order, ['/admin/noticias/', '/admin/panel/', '/admin/voceros/', '/admin/medios/', '/admin/medios/eventos/', '/admin/emprendedores/', '/admin/creadoras/', '/admin/mfs/']);
  // Al iniciar sesión se llega al panel, no a Voceros.
  const login = await readFile(join(output, 'assets/admin/admin.js'), 'utf8');
  assert.match(login, /redirect\('\/admin\/panel\/'\)/);
  assert.doesNotMatch(login, /redirect\('\/admin\/voceros\/'\)/);
  // Es una vista de solo lectura: ni formularios ni diálogos de edición.
  assert.doesNotMatch(panel, /data-record-dialog|data-admin-filters|<form/);
  const bundle = await readFile(join(output, 'assets/admin/panel.js'), 'utf8');
  assert.doesNotMatch(bundle, /127\.0\.0\.1/);
  assert.equal(pages.filter(page => page.route === '/admin/panel/').every(page => page.indexable === false), true);
});

test('las tarjetas del panel conservan la lista detrás de cada número', () => {
  const cards = panelCards({ cards: [
    { key: 'medios_aprobados', label: 'Medios aprobados', items: [{ public_id: 'a'.repeat(32), name: 'Radio Cumbre', detail: 'Riobamba · Aprobado' }] },
    { key: 'medios_videos', label: 'Videos recibidos', items: [] },
    { key: 'roto' },
  ] });
  assert.deepEqual(cards.map(card => [card.key, card.count]), [['medios_aprobados', 1], ['medios_videos', 0], ['roto', 0]]);
  assert.equal(cards[0].items[0].name, 'Radio Cumbre');
  assert.deepEqual(panelCards(), []);
  assert.deepEqual(panelCards({ cards: null }), []);
  assert.equal(eventLabel({ event_date: '2026-09-17', place: 'Complejo Mushuc Runa' }), '17 de septiembre de 2026 · Complejo Mushuc Runa');
  assert.equal(eventLabel({ event_date: null, place: '' }), 'Fecha por confirmar');
});
