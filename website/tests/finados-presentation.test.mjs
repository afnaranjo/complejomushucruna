import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderFinadosPage } from '../src/finados/page.mjs';
import { routeOptions } from '../src/data/site.mjs';
import {
  PRESENTATION_AT, PRESENTATION_WELCOME, presentationCountdown, setupPresentationCountdown,
} from '../src/finados/presentation.js';

const target = Date.parse(PRESENTATION_AT);
const page = { route: '/finados/', description: 'Finados Mushuc Runa 2026.' };

function countdownFixture(initialTime) {
  let currentTime = initialTime;
  let tick;
  let intervalCount = 0;
  const cancelled = [];
  const listeners = new Map();
  const nodes = Object.fromEntries(['clock', 'welcome', 'label', 'status', 'fallback'].map(key => [key, { hidden: false, textContent: '' }]));
  const values = Object.fromEntries(['days', 'hours', 'minutes', 'seconds'].map(key => [key, { dataset: { presentationValue: key }, textContent: '' }]));
  const classes = new Set();
  const panel = {
    dataset: { target: PRESENTATION_AT },
    classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); } },
    querySelector(selector) { return nodes[selector.match(/data-presentation-(\w+)/)[1]]; },
    querySelectorAll() { return Object.values(values); },
  };
  const doc = {
    querySelector() { return panel; },
    addEventListener(name, handler) { listeners.set(name, handler); },
    removeEventListener(name, handler) { if (listeners.get(name) === handler) listeners.delete(name); },
  };
  const options = {
    now: () => currentTime,
    setInterval(handler, delay) { assert.equal(delay, 1000); intervalCount++; tick = handler; return 42; },
    clearInterval(id) { cancelled.push(id); },
  };
  return { doc, options, nodes, values, classes, cancelled, listeners,
    setTime(time) { currentTime = time; }, tick() { tick(); }, get intervalCount() { return intervalCount; } };
}

test('la feria inicia el 30 de octubre a las 10:30 en Ecuador, sin valores negativos', () => {
  assert.equal(target, Date.parse('2026-10-30T15:30:00Z'));
  assert.deepEqual(presentationCountdown(target - (86_400_000 + 2 * 3_600_000 + 3 * 60_000 + 4_000)),
    { live: false, days: 1, hours: 2, minutes: 3, seconds: 4 });
  assert.deepEqual(presentationCountdown(target - 1_000), { live: false, days: 0, hours: 0, minutes: 0, seconds: 1 });
  assert.equal(presentationCountdown(target - 1).live, false);
  for (const now of [target, target + 86_400_000]) {
    assert.deepEqual(presentationCountdown(now), { live: true, days: 0, hours: 0, minutes: 0, seconds: 0 });
  }
  assert.throws(() => presentationCountdown(NaN), TypeError);
});

test('la bienvenida y la apertura encabezan Finados y la venta de stands conserva su contenido debajo', t => {
  t.mock.method(Date, 'now', () => target - 3_600_000);
  const html = renderFinadosPage(page);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /<h1[^>]*id="presentation-title"[^>]*><span>Bienvenidos a<\/span><span[^>]*>Finados Mushuc Runa <em>2026<\/em>/);
  assert.match(html, /Viernes 30 de octubre de 2026/);
  assert.match(html, /<strong>10:30 <span>AM<\/span>/);
  assert.match(html, /Complejo Intercultural y Deportivo <strong>MUSHUC RUNA<\/strong>/);
  assert.match(html, /<h2 id="stands-body-title"[^>]*>[\s\S]*Haz crecer[\s\S]*tu negocio[\s\S]*en Finados[\s\S]*<\/h2>/);
  assert.ok(html.indexOf('id="inicio"') < html.indexOf('id="venta-de-stands"'));
  assert.ok(html.indexOf('id="venta-de-stands"') < html.indexOf('id="artistas"'));
  for (const text of ['Tu talento, tus productos y tu historia', '14 de septiembre', 'Reservar mi stand', 'William Luna', 'Las Ñañas']) assert.ok(html.includes(text));
  assert.match(html, /data-presentation-countdown data-target="2026-10-30T10:30:00-05:00"/);
  for (const [key, label] of [['days', 'Días'], ['hours', 'Horas'], ['minutes', 'Minutos'], ['seconds', 'Segundos']]) {
    assert.match(html, new RegExp(`data-presentation-value="${key}">\\d{2}</strong><span>${label}</span>`));
  }
  const map = html.match(/<a class="presentation-map"[^>]*>/)[0];
  assert.ok(map.includes(`href="${routeOptions[0].href}"`));
  assert.match(map, /target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /data-presentation-welcome hidden>Bienvenidos a Finados Mushuc Runa 2026\./);
});

test('el HTML es determinista y ofrece la fecha real mientras se activa el reloj', t => {
  let buildTime = target - 86_400_000;
  t.mock.method(Date, 'now', () => buildTime);
  const before = renderFinadosPage(page);
  buildTime = target + 86_400_000;
  const after = renderFinadosPage(page);
  assert.equal(before, after);
  assert.match(before, /data-presentation-clock aria-hidden="true" hidden/);
  assert.match(before, /data-presentation-fallback>30 de octubre de 2026 · 10:30 AM \(hora de Ecuador\)/);
  assert.match(before, /data-presentation-welcome hidden>Bienvenidos a Finados Mushuc Runa 2026\./);
});

test('el contador se actualiza sin deriva y cambia a bienvenida al cumplirse la hora', () => {
  const fixture = countdownFixture(target - 10_000);
  const stop = setupPresentationCountdown(fixture.doc, fixture.options);
  assert.equal(fixture.values.seconds.textContent, '10');
  assert.equal(fixture.nodes.welcome.hidden, true);
  assert.equal(fixture.nodes.clock.hidden, false);
  assert.equal(fixture.nodes.fallback.hidden, true);
  fixture.setTime(target - 3_000);
  fixture.tick();
  assert.equal(fixture.values.seconds.textContent, '03');
  fixture.setTime(target);
  fixture.tick();
  assert.equal(fixture.nodes.clock.hidden, true);
  assert.equal(fixture.nodes.label.hidden, true);
  assert.equal(fixture.nodes.welcome.hidden, false);
  assert.equal(fixture.nodes.status.textContent, PRESENTATION_WELCOME);
  assert.ok(fixture.classes.has('is-live'));
  assert.deepEqual(fixture.cancelled, [42]);
  assert.equal(fixture.listeners.size, 0);
  stop();
  assert.deepEqual(fixture.cancelled, [42]);
});

test('abrir después del inicio o regresar de una pestaña suspendida muestra la bienvenida', () => {
  const past = countdownFixture(target + 60_000);
  setupPresentationCountdown(past.doc, past.options);
  assert.equal(past.intervalCount, 0);
  assert.equal(past.nodes.welcome.hidden, false);
  assert.equal(past.nodes.fallback.hidden, true);
  assert.equal(past.nodes.status.textContent, PRESENTATION_WELCOME);
  const suspended = countdownFixture(target - 60_000);
  setupPresentationCountdown(suspended.doc, suspended.options);
  suspended.setTime(target + 60_000);
  suspended.listeners.get('visibilitychange')();
  assert.equal(suspended.nodes.welcome.hidden, false);
  assert.deepEqual(suspended.cancelled, [42]);
});

test('los estilos de presentación son aislados, responsive y respetan los elementos ocultos', async () => {
  const css = await readFile(new URL('../src/finados/presentation.css', import.meta.url), 'utf8');
  assert.match(css, /"Finados Opening Anton"/);
  assert.match(css, /"Finados Opening Inter"/);
  assert.match(css, /\.presentation-clock\[hidden\][\s\S]*display: none/);
  assert.match(css, /@media \(max-width: 960px\)/);
  assert.match(css, /@media \(max-width: 480px\)/);
  assert.match(css, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.stands-body-title[^}]*font-weight: 400/);
  assert.match(css, /:focus-visible/);
  assert.doesNotMatch(css, /^\s*(?:body|html|h1|h2)\s*[{,]/m);
});
