import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pages } from '../src/pages.mjs';
import { renderLayout } from '../src/render/layout.mjs';

test('Finados y sus registros no cargan el CSS institucional del Complejo', () => {
  const campaignPages = pages.filter(page => page.route.startsWith('/finados/')
    || ['/acceso-compra-stands/', '/acreditacion-de-medios/'].includes(page.route));
  assert.equal(campaignPages.length, 13);
  for (const page of campaignPages) {
    const html = page.render ? page.render(page) : renderLayout(page);
    assert.doesNotMatch(html, /href="\/assets\/styles\.css/, page.route);
    assert.doesNotMatch(html, /\/assets\/fonts\//, page.route);
    if (!/\/(acceso|mi-registro|restablecer)\/$/.test(page.route)) {
      assert.match(html, /\/assets\/finados\/finados\.css\?v=20260916-4/, page.route);
      assert.match(html, /\/assets\/finados\/navigation\.css\?v=20260916-4/, page.route);
      assert.match(html, /id="navegacion-principal"/, page.route);
    }
    if (page.route === '/acreditacion-de-medios/') {
      assert.match(html, /assets\/finados\/logo-finados\.svg/);
      assert.match(html, /assets\/finados\/favicon-finados\.png/);
    }
  }
});

test('la identidad institucional permanece independiente de la campaña', () => {
  for (const route of ['/', '/granja/', '/historia/', '/visitanos/']) {
    const html = renderLayout(pages.find(page => page.route === route));
    assert.match(html, /href="\/assets\/styles\.css\?v=20260916-3"/);
    assert.doesNotMatch(html, /href="\/assets\/finados\/(finados|navigation)\.css/);
  }
});

test('la cabecera de campaña no declara tokens, fuentes o resets globales', async () => {
  const css = await readFile(new URL('../src/finados/navigation.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /:root|@font-face|--font-display|--color-lienzo|(?:^|\n)body\s*\{/);
  assert.match(css, /\.site-header\.site-header--finados\s*\{[^}]*position: sticky/s);
  assert.match(css, /font-family: "Inter"/);
  assert.match(css, /\[data-open="true"\]/);
  assert.match(css, /max-height: calc\(100svh - 108px\)/);
  assert.match(css, /prefers-reduced-motion/);
});

test('las fuentes y el lienzo de campaña conservan sus valores originales', async () => {
  const css = await readFile(new URL('../src/finados/finados.css', import.meta.url), 'utf8');
  assert.match(css, /--font-display: "Anton", "Arial Narrow", sans-serif/);
  assert.match(css, /--font-sans: "Inter", "Helvetica Neue", Arial, sans-serif/);
  assert.match(css, /--font-serif: "DM Serif Display", Georgia, serif/);
  assert.match(css, /--color-lienzo: #f4eada/);
  assert.doesNotMatch(css, /Roboto|Montserrat|patron-mushuc/);
});
