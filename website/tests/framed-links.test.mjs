import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';
import { isFramed, setupFramedLinks, shouldOpenOutside } from '../src/framed-links.js';

const link = (href, attributes = {}) => ({
  href: new URL(href, 'https://finados.expoferiamushucruna.com/').href,
  getAttribute: name => (name === 'href' ? href : attributes[name] ?? null),
  hasAttribute: name => name in attributes,
});
const here = 'https://finados.expoferiamushucruna.com/';

test('fuera de un marco no cambia nada: el sitio se navega igual que siempre', () => {
  const view = {}; view.self = view; view.top = view;
  assert.equal(isFramed(view), false);
  let listened = false;
  assert.equal(setupFramedLinks({ addEventListener: () => { listened = true; } }, view), false);
  assert.equal(listened, false);
});

test('dentro de un marco los enlaces del menú salen a una pestaña nueva con el dominio real', () => {
  assert.equal(isFramed({ self: {}, top: {} }), true);
  assert.equal(isFramed({ get self() { return {}; }, get top() { throw new Error('cross-origin'); } }), true);
  assert.equal(shouldOpenOutside(link('/finados/'), here), true);
  assert.equal(shouldOpenOutside(link('/finados/shows/'), here), true);
  assert.equal(shouldOpenOutside(link('https://www.mushucticket.com/'), here), true);
  // Saltos dentro de la página, enlaces que ya abren pestaña y descargas se respetan.
  assert.equal(shouldOpenOutside(link('#contenido'), here), false);
  assert.equal(shouldOpenOutside(link('/#experiencias'), here), false);
  assert.equal(shouldOpenOutside(link('https://guiap.com/360/', { target: '_blank' }), here), false);
  assert.equal(shouldOpenOutside(link('/mapa.pdf', { download: '' }), here), false);
  assert.equal(shouldOpenOutside(link('javascript:void(0)'), here), false);
  assert.equal(shouldOpenOutside(link('mailto:hola@example.invalid'), here), false);
});

test('el clic abre una pestaña nueva y respeta el submenú que se abre con el primer toque', () => {
  const opened = [];
  let handler;
  const view = { self: {}, top: {}, location: { href: here }, open: (...args) => opened.push(args) };
  setupFramedLinks({ addEventListener: (type, listener) => { handler = listener; } }, view);
  const anchor = link('/finados/shows/');
  const click = (defaultPrevented = false) => {
    let prevented = defaultPrevented;
    handler({ defaultPrevented, button: 0, target: { closest: () => anchor }, preventDefault: () => { prevented = true; } });
    return prevented;
  };
  assert.equal(click(true), true);
  assert.equal(opened.length, 0, 'si el menú usó el clic para desplegar el submenú, no se abre nada');
  assert.equal(click(false), true);
  assert.deepEqual(opened[0], ['https://finados.expoferiamushucruna.com/finados/shows/', '_blank', 'noopener']);
});

test('el build inyecta el script en las páginas públicas y no en las privadas', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-framed-'));
  const files = await buildSite(output);
  assert.ok(files.includes('assets/framed-links.js'));
  for (const page of ['index.html', 'finados/index.html', 'finados/mfs/index.html', 'granja/index.html', 'acreditacion-de-medios/index.html']) {
    const html = await readFile(join(output, page), 'utf8');
    // Una sola vez como script; la precarga del <head> es la misma URL anunciada antes.
    assert.equal((html.match(/<script type="module" src="\/assets\/framed-links\.js/g) ?? []).length, 1, page);
  }
  for (const page of ['admin/index.html', 'finados/voceros/mi-registro/index.html', 'finados/mfs/acceso/index.html']) {
    assert.doesNotMatch(await readFile(join(output, page), 'utf8'), /framed-links/, page);
  }
});
