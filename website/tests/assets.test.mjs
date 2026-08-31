import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assetManifest } from '../src/data/site.mjs';
import { validateAssetPaths } from '../scripts/check-assets.mjs';

const websiteRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

test('cada activo publicado es local y usa una extensión permitida', async () => {
  const allowed = /\.(?:avif|webp|jpe?g|png|svg|mp4|woff2|ttf)$/i;
  assert.ok(assetManifest.length >= 20);

  for (const asset of assetManifest) {
    assert.match(asset.path, allowed);
    assert.ok(asset.path.startsWith('/assets/'));
    assert.ok(!asset.path.includes('wp-content'));
    await access(join(websiteRoot, 'public', asset.path));
  }
});

test('el validador rechaza ejecutables y rutas que salen de la carpeta pública', () => {
  assert.throws(() => validateAssetPaths(['images/portada.php']), /Extensión no permitida/);
  assert.throws(() => validateAssetPaths(['../secreto.webp']), /Ruta insegura/);
  assert.doesNotThrow(() => validateAssetPaths(['images/portada.webp', 'fonts/handgoal.ttf']));
});

test('el manifiesto no incluye extensiones ejecutables', () => {
  for (const asset of assetManifest) {
    assert.doesNotMatch(asset.path, /\.(?:php\d?|phtml|html?|js|exe|sh)$/i);
  }
});
