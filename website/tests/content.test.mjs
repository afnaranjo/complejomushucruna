import test from 'node:test';
import assert from 'node:assert/strict';

import {
  historicalEvents,
  primaryNavigation,
  site,
} from '../src/data/site.mjs';

test('la navegación institucional incorpora el tour virtual antes de Granja', () => {
  assert.equal(site.name, 'Complejo Mushuc Runa');
  assert.deepEqual(primaryNavigation.map((item) => item.href), [
    '/',
    '/experiencias/',
    'https://guiap.com/360/mr2023-2024/',
    '/granja/',
    '/eventos/',
    '/historia/',
    '/visitanos/',
  ]);
  assert.deepEqual(primaryNavigation[2], {
    label: 'TOUR VIRTUAL',
    href: site.tourUrl,
  });
});

test('el archivo incluye cada página histórica publicada que se recuperó', () => {
  assert.deepEqual(historicalEvents.map((event) => event.slug), [
    'finados-2021',
    'finados-2022',
    'festival-de-canto',
    'finados-2023',
    'toros',
    'finados-2025',
    'navidad-2025',
  ]);
});

test('ningún evento histórico queda presentado como una convocatoria vigente', () => {
  for (const event of historicalEvents) {
    assert.equal(event.status, 'Archivo histórico');
    assert.equal(event.activeCommerceUrl, null);
  }
});
