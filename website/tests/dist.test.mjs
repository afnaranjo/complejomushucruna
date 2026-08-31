import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { checkDist } from '../scripts/check-dist.mjs';

test('la salida completa no contiene rutas rotas ni referencias al runtime antiguo', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-dist-'));
  await buildSite(output);
  const result = await checkDist(output);

  assert.equal(result.errors.length, 0, result.errors.join('\n'));
  assert.ok(result.htmlFiles >= 14);
  assert.ok(result.checkedLinks >= 100);
});

test('publica robots, sitemap y una página 404 propia', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-seo-'));
  await buildSite(output);
  const robots = await readFile(join(output, 'robots.txt'), 'utf8');
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');
  const notFound = await readFile(join(output, '404.html'), 'utf8');

  assert.match(robots, /Sitemap: https:\/\/complejomushucruna.com\/sitemap.xml/);
  assert.match(sitemap, /https:\/\/complejomushucruna.com\/experiencias\//);
  assert.match(sitemap, /https:\/\/complejomushucruna.com\/eventos\/archivo\/finados-2021\//);
  assert.match(notFound, /<h1>Página no encontrada<\/h1>/);
});

test('mantiene pequeños los recursos propios de código', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-size-'));
  await buildSite(output);
  const css = await stat(join(output, 'assets/styles.css'));
  const js = await stat(join(output, 'assets/site.js'));

  assert.ok(css.size < 100_000, `CSS demasiado grande: ${css.size}`);
  assert.ok(js.size < 30_000, `JavaScript demasiado grande: ${js.size}`);
});
