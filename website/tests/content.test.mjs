import test from 'node:test';
import assert from 'node:assert/strict';

import {
  historicalEvents,
  primaryNavigation,
  site,
} from '../src/data/site.mjs';

test('la navegación institucional agrupa venta dentro de Finados y conserva el orden aprobado', () => {
  assert.equal(site.name, 'Complejo Mushuc Runa');
  assert.deepEqual(primaryNavigation.map((item) => item.href), [
    '/',
    '/finados/',
    '/acreditacion-de-medios/',
    'https://guiap.com/360/mr2023-2024/',
    '/granja/',
    '/historia/',
  ]);
  assert.deepEqual(primaryNavigation.map((item) => item.label), [
    'INICIO',
    'FINADOS 2026',
    'ACREDITACIÓN DE MEDIOS',
    'TOUR VIRTUAL',
    'GRANJA',
    'NOSOTROS',
  ]);
  assert.deepEqual(primaryNavigation[1], {
    label: 'FINADOS 2026',
    href: '/finados/',
    emphasis: 'finados',
    children: [
      { label: 'SHOWS', href: '/finados/shows/' },
      { label: 'VENTA DE STANDS', href: 'https://www.mushucticket.com/', emphasis: 'stands' },
      { label: 'PROGRAMACIÓN ARTÍSTICA', href: '/finados/#artistas' },
      { label: 'DIGNIDADES 2025', href: '/finados/dignidades-finados-2025/' },
      { label: 'VOCEROS', href: '/finados/voceros/' },
      { label: 'MEDIOS', href: '/finados/medios/' },
      { label: 'EMPRENDEDOR', href: '/finados/emprendedores/' },
      { label: 'MFS', href: '/finados/mfs/' },
    ],
  });
  assert.deepEqual(primaryNavigation[2], {
    label: 'ACREDITACIÓN DE MEDIOS',
    href: '/acreditacion-de-medios/',
  });
  assert.deepEqual(primaryNavigation[3], {
    label: 'TOUR VIRTUAL',
    href: site.tourUrl,
  });
  assert.deepEqual(primaryNavigation[5], {
    label: 'NOSOTROS',
    href: '/historia/',
    children: [
      { label: 'HISTORIA', href: '/historia/' },
      { label: 'VISITAMOS', href: '/visitanos/' },
    ],
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
