import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeRows } from '../scripts/normalize-legacy.mjs';

test('extrae texto, enlaces e imágenes sin conservar etiquetas ejecutables', () => {
  const fixture = `6\t[{"elType":"widget","widgetType":"text-editor","settings":{"editor":"<p>Historia <strong>viva</strong></p><script>alert(1)</script>","link":{"url":"https://example.com/ruta"},"image":{"url":"https://example.com/foto.jpg"}}}]`;
  const [page] = normalizeRows(fixture);

  assert.equal(page.id, 6);
  assert.deepEqual(page.texts, ['Historia viva']);
  assert.deepEqual(page.links, ['https://example.com/ruta']);
  assert.deepEqual(page.images, ['https://example.com/foto.jpg']);
});
