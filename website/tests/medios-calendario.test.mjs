import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { pages } from '../src/pages.mjs';
import {
  daysInclusive, importedPlan, initialPlan, moveToWeek, pdfFromJpeg, spotKpis, suggestedAssignments, textColorFor, weekFor, WEEKS,
} from '../src/admin/admin-medios-calendario.js';

test('Calendario de medios: página propia dentro de Medios, sin estilos ni scripts en línea', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-medios-calendario-'));
  const files = await buildSite(output);
  assert.ok(files.includes('admin/medios/calendario/index.html'));
  assert.ok(files.includes('assets/admin/admin-medios-calendario.js'));
  const html = await readFile(join(output, 'admin/medios/calendario/index.html'), 'utf8');
  assert.match(html, /data-admin-medios-calendario/);
  assert.match(html, /<h1>Calendario estratégico de comunicación<\/h1>/);
  for (const tab of ['spots', 'calendario', 'reportes']) assert.match(html, new RegExp(`data-plan-tab="${tab}"`), tab);
  for (const dialog of ['spot', 'assignment']) assert.match(html, new RegExp(`data-dialog="${dialog}"`), dialog);
  // Medios de comunicación y Plan de medios se retiraron: ya viven en Seguimiento de medios.
  assert.doesNotMatch(html, /data-plan-tab="(?:medios|plan)"|data-dialog="(?:media|plan)"|Plan de medios|Medios de comunicación/);
  assert.match(html, />3\. Reportes</);
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
  assert.doesNotMatch(bundle, /drawMediaReport|renderPlan|renderMedia/);
  assert.equal(pages.find(page => page.route === '/admin/medios/calendario/').indexable, false);
  // Medios y Eventos siguen igual.
  for (const route of ['admin/medios/index.html', 'admin/medios/eventos/index.html']) assert.match(await readFile(join(output, route), 'utf8'), /data-admin-medios/);
});

test('Calendario de medios: estrategia sugerida y semanas', () => {
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
  assert.equal(textColorFor('#94165e'), '#ffffff');
  assert.equal(textColorFor('#f5e6bd'), '#241146');
});

test('Calendario de medios: importa el respaldo del archivo original sin perder medios ni plan', () => {
  // El respaldo del HTML original (sin sourceId) entra tal cual.
  const original = { spots: [{ id: 'general', qty: 1, name: 'AUDIO GENERAL', desc: '', national: true, regional: true, local: true, color: '#d91f26' }], assignments: [{ id: 'as_x', spotId: 'general', weekId: 'w1', start: '2026-09-21', end: '2026-09-27', note: 'Lanzamiento' }], media: [{ id: 'media_x', name: 'Radio', type: 'Radio', coverage: 'Local', city: '', program: '', contact: '', rate: 5, status: 'active', notes: '' }], plans: [] };
  const imported = importedPlan(original);
  assert.equal(imported.media[0].sourceId, '');
  assert.equal(imported.media.length, 1, 'los medios del respaldo se conservan aunque ya no se muestren');
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

test('Fluidez: caché, compresión, precarga de módulos y menú sin saltos', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-fluidez-'));
  await buildSite(output);
  const htaccess = await readFile(join(output, '.htaccess'), 'utf8');
  assert.match(htaccess, /# BEGIN cPanel-generated php ini directives/, 'se conservan las directivas de cPanel');
  assert.match(htaccess, /<IfModule mod_deflate\.c>[\s\S]*AddOutputFilterByType DEFLATE text\/html text\/css/);
  assert.match(htaccess, /<If "%\{QUERY_STRING\} =~ \/\(\^\|&\)v=\/">\s*#[^\n]*\n[^\n]*\n\s*Header set Cache-Control "public, max-age=86400, stale-while-revalidate=604800"/);
  assert.match(htaccess, /Header set Cache-Control "no-cache"/);
  assert.doesNotMatch(htaccess, /immutable/);
  const rules = JSON.parse(await readFile(join(output, 'speculation-rules.json'), 'utf8'));
  assert.equal(rules.prefetch[0].eagerness, 'moderate');
  assert.ok(JSON.stringify(rules).includes('/api/*'), 'nunca precarga la API');
  // Cada pantalla administrativa anuncia su fuente, su API y todo su árbol de módulos.
  const panel = await readFile(join(output, 'admin/medios/index.html'), 'utf8');
  const head = panel.slice(0, panel.indexOf('</head>'));
  assert.match(head, /<link rel="preconnect" href="https:\/\/finados\.complejomushucruna\.com" crossorigin="use-credentials">/);
  assert.match(head, /<link rel="preload" href="\/assets\/finados\/fonts\/inter-variable-latin\.woff2" as="font" type="font\/woff2" crossorigin>/);
  for (const module of ['admin-medios.js?v=', 'sidebar.js?v=', 'campaign-banner.js?v=', 'runtime-origins.mjs?v=', 'qrcode-generator.mjs?v=']) assert.ok(head.includes(module), module);
  assert.ok(head.indexOf('modulepreload') < head.indexOf('<script type="module"'));
  // Ningún módulo publicado se importa sin versión.
  const { readdir } = await import('node:fs/promises');
  const scripts = (await readdir(join(output, 'assets'), { recursive: true })).filter(file => /\.m?js$/.test(file));
  for (const file of scripts) assert.doesNotMatch(await readFile(join(output, 'assets', file), 'utf8'), /from\s*'\.{1,2}\/[^'?]+\.m?js'/, file);
});
