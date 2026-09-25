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
  assert.deepEqual(order, ['/admin/panel/', '/admin/noticias/', '/admin/voceros/', '/admin/medios/', '/admin/medios/eventos/', '/admin/medios/calendario/', '/admin/emprendedores/', '/admin/creadoras/', '/admin/mfs/']);
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

test('Panel va arriba de «Panel y formularios» y el panel muestra la sección de Creadoras', async () => {
  const { pages } = await import('../src/pages.mjs');
  const { creadoraTotals, formatHours, shiftWhen } = await import('../src/admin/panel.js');
  const page = pages.find(item => item.route === '/admin/panel/');
  const html = page.render(page);
  const home = html.indexOf('class="admin-sidebar__home"');
  assert.ok(home > html.indexOf('<p>Administración</p>'), 'debajo de Administración');
  assert.ok(home < html.indexOf('id="admin-forms-title"'), 'arriba de Panel y formularios');
  assert.ok(html.indexOf('href="/admin/panel/"') < html.indexOf('id="admin-forms-title"'));
  assert.match(html, /data-panel-creadoras/);
  assert.match(html, /Creadoras de contenido/);
  assert.equal(formatHours(750), '12 h 30 min');
  assert.equal(formatHours(45), '45 min');
  assert.equal(formatHours(0), '0 h');
  assert.match(shiftWhen('2026-10-30 09:00:00', '2026-10-30 12:30:00'), /30 oct.*09:00–12:30/);
  const totals = Object.fromEntries(creadoraTotals({ totals: { creadoras: 3, attended_minutes: 600, shifts: 5, attended: 4, scripts: 10, recorded: 2, videos: 1, content: 2 } }));
  assert.equal(totals['Horas asistidas'], '10 h');
  assert.equal(totals['Guiones grabados'], '2 de 10');
});

test('Redes sociales: periodo por defecto de 30 días, comparación y lectura para decidir', async () => {
  const { lastDays, socialDelta, socialVerdict, socialInsights, formatSocial } = await import('../src/admin/panel.js');
  const page = pages.find(item => item.route === '/admin/panel/');
  const html = page.render(page);
  assert.match(html, /data-panel-social/);
  assert.match(html, /<h2 id="panel-redes-title">Redes sociales<\/h2>/);
  assert.match(html, /data-social-preset="30" aria-pressed="true"/);
  assert.match(html, /Finados Mushuc Runa/);
  assert.doesNotMatch(html, /<form/);
  assert.ok(html.indexOf('data-panel-social') < html.indexOf('data-panel-media'), 'va antes de Medios');
  assert.deepEqual(lastDays(30, '2026-09-24'), { from: '2026-08-26', to: '2026-09-24' });
  assert.deepEqual(lastDays(7, '2026-03-02'), { from: '2026-02-24', to: '2026-03-02' });
  assert.deepEqual(socialDelta(150, 100), { direction: 'up', pct: 50, good: true });
  assert.deepEqual(socialDelta(0.3, 0.2, { lowerIsBetter: true }), { direction: 'up', pct: 50, good: false });
  assert.equal(socialDelta(10, 0).direction, 'new');
  assert.equal(socialDelta(100.5, 100).direction, 'flat');
  assert.equal(socialDelta(null, 3).direction, null);
  const growing = { label: 'TikTok', followers: { end: 7716, net: 1565, previous_net: -18, growth_pct: 25.44 }, metrics: { views: { current: 900, previous: 100 }, interactions: { current: 50, previous: 10 }, engagement_rate: { current: 5.5, previous: 10 } } };
  assert.equal(socialVerdict(growing).label, 'Mejorando');
  assert.equal(socialVerdict({ followers: { net: -5, previous_net: 10 }, metrics: { views: { current: 1, previous: 5 }, interactions: { current: 1, previous: 5 } } }).label, 'Empeorando');
  assert.equal(socialVerdict({}).label, 'Sin comparación');
  const insights = socialInsights({ networks: [growing], totals: { cost_per_follower: { current: 0.24, previous: 0.5 } }, ads: { current: { ctr: 2 }, previous: { ctr: 4 } } });
  assert.ok(insights.some(text => text.startsWith('TikTok es la red que más crece')));
  assert.ok(insights.some(text => text.includes('menos interacción por vista')));
  assert.ok(insights.some(text => text.includes('más barato')));
  assert.ok(insights.some(text => text.includes('menos clics por impresión')));
  assert.equal(formatSocial(null), '—');
  assert.equal(formatSocial(1565, 'signed'), '+1565'.replace('1565', new Intl.NumberFormat('es-EC').format(1565)));
});

test('Redes sociales: la comparación se lee corta', async () => {
  const { socialDelta, socialDeltaText } = await import('../src/admin/panel.js');
  const text = (c, p, o) => socialDeltaText(socialDelta(c, p, o), c, p, o?.kind);
  assert.equal(text(150, 100), '▲ 50 %');
  assert.equal(text(60, 100), '▼ 40 %');
  assert.equal(text(1300, 100), '▲ ×13');
  assert.equal(text(2764, -22), `▲ antes -22`);
  assert.equal(text(5, 0), '▲ Nuevo');
  assert.equal(text(5, null), 'Sin comparación');
});

test('las secciones del Panel arrancan plegadas y se abren con un clic en el título', async () => {
  const page = pages.find(item => item.route === '/admin/panel/');
  const html = page.render(page);
  const folds = [...html.matchAll(/<details class="admin-panel-section admin-panel-fold[^"]*"[^>]*data-panel-fold="([a-z]+)"[^>]*>/g)];
  assert.deepEqual(folds.map(match => match[1]), ['redes', 'medios', 'creadoras', 'voceros']);
  for (const match of folds) assert.doesNotMatch(match[0], /\sopen/, `${match[1]} arranca cerrada`);
  for (const key of ['redes', 'medios', 'creadoras', 'voceros']) assert.match(html, new RegExp(`<summary><div class="records-heading"><div><h2 id="panel-${key}-title">`));
  const bundle = await readFile(new URL('../src/admin/panel.js', import.meta.url), 'utf8');
  assert.match(bundle, /social\.addEventListener\('toggle'/, 'Metricool se consulta al abrir la sección');
});
