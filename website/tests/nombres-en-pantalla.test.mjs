import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { layoutSecondaryNames, selectSceneNames } from '../src/finados/nombres-en-pantalla.js';

test('elige un protagonista aleatorio y conserva el resto en cola', () => {
  const items = Array.from({ length: 10 }, (_, index) => ({ public_id: String(index), display_name: `Nombre ${index}` }));
  const scene = selectSceneNames(items, 7, () => 0.4);
  assert.equal(scene.primary.public_id, '2');
  assert.equal(scene.secondary.length, 6);
  assert.equal(scene.remaining.length, 3);
});

test('distribuye secundarios en posiciones únicas y limita capas en móvil', () => {
  const desktop = layoutSecondaryNames(6, { width: 1920, height: 1080 });
  assert.equal(desktop.length, 6);
  assert.equal(new Set(desktop.map((position) => `${position.left ?? ''}-${position.right ?? ''}-${position.top ?? ''}-${position.bottom ?? ''}`)).size, 6);
  assert.equal(layoutSecondaryNames(6, { width: 390, height: 844 }).length, 2);
});

test('declara el ciclo escénico de tres segundos y el modo reducido', async () => {
  const css = await readFile(join(process.cwd(), 'src', 'finados', 'nombres-en-pantalla.css'), 'utf8');
  assert.match(css, /animation: name-arrive 4\.2s/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /filter: blur\(10px\)/);
});
