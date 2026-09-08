import test from 'node:test';
import assert from 'node:assert/strict';

import {
  historicalEvents,
  primaryNavigation,
  site,
} from '../src/data/site.mjs';

test('la navegación institucional prioriza venta, Finados y tour en el orden aprobado', () => {
  assert.equal(site.name, 'Complejo Mushuc Runa');
  assert.deepEqual(primaryNavigation.map((item) => item.href), [
    '/',
    'https://www.mushucticket.com/',
    '/finados/',
    'https://guiap.com/360/mr2023-2024/',
    '/granja/',
    '/historia/',
    '/visitanos/',
  ]);
  assert.deepEqual(primaryNavigation.map((item) => item.label), [
    'INICIO',
    'VENTA DE STANDS',
    'FINADOS 2026',
    'TOUR VIRTUAL',
    'GRANJA',
    'HISTORIA',
    'VISITAMOS',
  ]);
  assert.deepEqual(primaryNavigation[1], {
    label: 'VENTA DE STANDS',
    href: 'https://www.mushucticket.com/',
    emphasis: 'stands',
  });
  assert.deepEqual(primaryNavigation[2], {
    label: 'FINADOS 2026',
    href: '/finados/',
    emphasis: 'finados',
  });
  assert.deepEqual(primaryNavigation[3], {
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
