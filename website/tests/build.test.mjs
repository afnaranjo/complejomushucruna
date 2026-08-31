import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { escapeHtml } from '../src/render/html.mjs';

test('escapa contenido que no debe convertirse en HTML activo', () => {
  assert.equal(
    escapeHtml('<script>alert("Mushuc")</script>'),
    '&lt;script&gt;alert(&quot;Mushuc&quot;)&lt;/script&gt;',
  );
});

test('genera las rutas institucionales y el archivo histórico', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-site-'));
  const files = await buildSite(output);

  for (const expected of [
    'index.html',
    'experiencias/index.html',
    'granja/index.html',
    'eventos/index.html',
    'historia/index.html',
    'visitanos/index.html',
    'eventos/archivo/finados-2021/index.html',
    'eventos/archivo/navidad-2025/index.html',
  ]) {
    assert.ok(files.includes(expected), `Falta ${expected}`);
  }
});

test('cada página entrega metadatos, canonical y un único h1', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-meta-'));
  await buildSite(output);
  const home = await readFile(join(output, 'index.html'), 'utf8');

  assert.match(home, /<title>Complejo Mushuc Runa/);
  assert.match(home, /<meta name="description" content="[^"]+">/);
  assert.match(home, /<link rel="canonical" href="https:\/\/complejomushucruna.com\/">/);
  assert.equal((home.match(/<h1\b/g) ?? []).length, 1);
  assert.match(home, /<a class="skip-link" href="#contenido">/);
  assert.match(home, /<main id="contenido">/);
});

test('genera una previsualización privada de Finados sin publicarla en la navegación', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-finados-preview-'));
  const files = await buildSite(output);
  const home = await readFile(join(output, 'index.html'), 'utf8');
  const landing = await readFile(join(output, 'finados/index.html'), 'utf8');
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');

  assert.ok(files.includes('finados/index.html'));
  assert.doesNotMatch(home, /href="\/finados\/?"/);
  assert.doesNotMatch(sitemap, /complejomushucruna\.com\/finados\//);
  assert.match(landing, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(landing, /Visual conceptual · artista por anunciar/);
  assert.match(landing, /href="\/"[^>]*>Volver al Complejo/);
  assert.equal((landing.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(landing, /31 oct|2 nov|120K|\$12/i);
});
