import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pages } from '../src/pages.mjs';
import { primaryNavigation } from '../src/data/site.mjs';
import { mfsAssetVersion, mfsEvent, mfsPrizes } from '../src/finados/mfs-page.mjs';

const page = pages.find(item => item.route === '/finados/mfs/');
const html = page.render(page);

test('MFS tiene su landing noindex y cierra el submenú de Finados', () => {
  assert.ok(page, 'la ruta /finados/mfs/ existe');
  assert.equal(page.indexable, false);
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  const children = primaryNavigation.find(item => item.href === '/finados/').children;
  assert.deepEqual(children.at(-1), { label: 'MFS', href: '/finados/mfs/' });
  assert.match(html, /id="navegacion-principal"/);
});

test('la landing usa la línea gráfica de Mushuc Freestyle y sus datos aprobados', () => {
  assert.match(html, new RegExp(`/assets/finados/mfs\\.css\\?v=${mfsAssetVersion}`));
  assert.match(html, /badeen-display-latin\.woff2/);
  for (const name of ['mfs-logo.svg', 'mfs-retrato-1100.webp', 'mfs-retrato-640.webp', 'mfs-organizadores.svg', 'mfs-arte-oficial-800.webp']) {
    assert.ok(html.includes(`/assets/finados/mfs/${name}?v=${mfsAssetVersion}`), name);
  }
  assert.deepEqual(mfsPrizes.map(prize => prize.amount), [600, 250, 100]);
  assert.match(html, /Más de USD 950<br>en premios/);
  assert.ok(html.includes('datetime="2026-11-02T13:00:00-05:00"'));
  assert.ok(html.includes('datetime="2026-10-29T23:59:00-05:00"'));
  assert.ok(html.includes(`${mfsEvent.slots} cupos`));
  assert.ok(html.includes('href="#inscripcion"') && html.includes('id="inscripcion"'));
  assert.ok(html.includes('href="#bases"') && html.includes('id="bases"'));
  assert.ok(html.includes('https://wa.me/593980346729'));
  // Sin voseo en los textos nuevos.
  assert.doesNotMatch(html, /\b(inscribite|grabá|subí|registrate|escribinos|podés|tenés|sumate)\b/i);
  // Los enlaces externos abren en otra pestaña de forma segura.
  for (const link of html.match(/<a [^>]*target="_blank"[^>]*>/g) ?? []) assert.match(link, /rel="noopener noreferrer"/);
});

test('los SVG del arte son vectoriales, livianos y sin contenido activo', async () => {
  for (const name of ['mfs-logo', 'mfs-icono', 'mfs-letras', 'mfs-organizadores', 'mfs-plaza']) {
    const svg = await readFile(new URL(`../public/assets/finados/mfs/${name}.svg`, import.meta.url), 'utf8');
    assert.doesNotMatch(svg, /<script|foreignObject|base64|javascript:/i, name);
    assert.ok(svg.length < 200_000, `${name} pesa ${svg.length} bytes`);
  }
});
