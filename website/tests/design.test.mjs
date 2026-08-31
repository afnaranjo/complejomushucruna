import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { setMenuState } from '../src/site.js';

async function buildFixture(prefix) {
  const output = await mkdtemp(join(tmpdir(), prefix));
  await buildSite(output);
  return output;
}

test('la salida aplica la paleta y jerarquía tipográfica aprobadas', async () => {
  const output = await buildFixture('mushuc-design-');
  const css = await readFile(join(output, 'assets/styles.css'), 'utf8');

  for (const color of ['#7C170F', '#AD140E', '#5B0B05', '#9E7721', '#E3B85D']) {
    assert.ok(css.includes(color), `Falta el color ${color}`);
  }
  assert.match(css, /Montserrat/);
  assert.match(css, /Roboto Slab/);
  assert.match(css, /Handgoal/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test('las páginas conservan el contenido institucional recuperado', async () => {
  const output = await buildFixture('mushuc-content-');
  const home = await readFile(join(output, 'index.html'), 'utf8');
  const history = await readFile(join(output, 'historia/index.html'), 'utf8');
  const farm = await readFile(join(output, 'granja/index.html'), 'utf8');
  const visit = await readFile(join(output, 'visitanos/index.html'), 'utf8');

  assert.match(home, /¡Cultura y diversión en un solo lugar!/);
  assert.match(history, /Al pie del volcán Carihuayrazo/);
  assert.match(history, /La obra que inició en el 2012/);
  for (const category of ['Aves', 'Conejos', 'Cuyes', 'Ganado vacuno', 'Caballos y ponis']) {
    assert.match(farm, new RegExp(category));
  }
  assert.match(visit, /Carretera E35/);
  assert.match(visit, /Camino Real/);
});

test('la portada prioriza la versión institucional más reciente sobre el archivo histórico', async () => {
  const output = await buildFixture('mushuc-current-home-');
  const home = await readFile(join(output, 'index.html'), 'utf8');

  for (const heading of [
    'Más de 10 mil parqueaderos',
    'El Megaescenario',
    'Responsabilidad social',
  ]) {
    assert.match(home, new RegExp(heading, 'i'));
  }

  for (const image of [
    '/assets/images/actual/parqueaderos.webp',
    '/assets/images/actual/megaescenario.webp',
    '/assets/images/actual/responsabilidad-social.webp',
  ]) {
    assert.match(home, new RegExp(image.replaceAll('/', '\\/')));
  }

  assert.ok(
    home.indexOf('El Megaescenario') < home.indexOf('Eventos que forman parte de nuestra historia'),
    'La actualidad institucional debe aparecer antes del archivo de eventos',
  );
});

test('la página de experiencias distingue oferta histórica de disponibilidad actual', async () => {
  const output = await buildFixture('mushuc-experiences-');
  const html = await readFile(join(output, 'experiencias/index.html'), 'utf8');

  for (const experience of ['Mushuc Park', 'Granja Agroturística', 'Cabalgatas', 'Piscina', 'Tren', 'Pesca']) {
    assert.match(html, new RegExp(experience));
  }
  assert.match(html, /Disponibilidad por confirmar/);
});

test('el controlador del menú mantiene sincronizados estado y accesibilidad', () => {
  const attributes = new Map();
  const button = { setAttribute: (name, value) => attributes.set(name, value) };
  const nav = { dataset: {} };

  setMenuState(button, nav, true);
  assert.equal(attributes.get('aria-expanded'), 'true');
  assert.equal(nav.dataset.open, 'true');

  setMenuState(button, nav, false);
  assert.equal(attributes.get('aria-expanded'), 'false');
  assert.equal(nav.dataset.open, 'false');
});
