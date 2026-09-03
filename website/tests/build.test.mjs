import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { escapeHtml } from '../src/render/html.mjs';

test('escapa contenido que no debe convertirse en HTML activo', () => {
  assert.equal(
    escapeHtml('<script>alert("Mushuc")</script>'),
    '&lt;script&gt;alert(&quot;Mushuc&quot;)&lt;/script&gt;',
  );
});

test('genera las rutas institucionales y el archivo histórico', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-site-'));
  const files = await buildSite(output);

  for (const expected of [
    'index.html',
    'experiencias/index.html',
    'granja/index.html',
    'eventos/index.html',
    'historia/index.html',
    'visitanos/index.html',
    'acceso-compra-stands/index.html',
    'eventos/archivo/finados-2021/index.html',
    'eventos/archivo/navidad-2025/index.html',
  ]) {
    assert.ok(files.includes(expected), `Falta ${expected}`);
  }
});

test('cada página entrega metadatos, canonical y un único h1', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-meta-'));
  await buildSite(output);
  const home = await readFile(join(output, 'index.html'), 'utf8');

  assert.match(home, /<title>Complejo Mushuc Runa/);
  assert.match(home, /<meta name="description" content="[^"]+">/);
  assert.match(home, /<link rel="canonical" href="https:\/\/complejomushucruna.com\/">/);
  assert.equal((home.match(/<h1\b/g) ?? []).length, 1);
  assert.match(home, /<a class="skip-link" href="#contenido">/);
  assert.match(home, /<main id="contenido">/);
});

test('genera una previsualización privada de Finados sin publicarla en la navegación', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-finados-preview-'));
  const files = await buildSite(output);
  const home = await readFile(join(output, 'index.html'), 'utf8');
  const landing = await readFile(join(output, 'finados/index.html'), 'utf8');
  const stands = await readFile(join(output, 'acceso-compra-stands/index.html'), 'utf8');
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');

  assert.ok(files.includes('finados/index.html'));
  assert.ok(files.includes('acceso-compra-stands/index.html'));
  assert.doesNotMatch(home, /href="\/finados\/?"/);
  assert.doesNotMatch(sitemap, /complejomushucruna\.com\/finados\//);
  assert.doesNotMatch(sitemap, /complejomushucruna\.com\/acceso-compra-stands\//);
  assert.match(landing, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(landing, /Finados 2026 · Venta de stands/);
  assert.match(landing, /href="https:\/\/mushucticket\.com\/"/);
  assert.doesNotMatch(landing, /reserva\.mushucticket\.com\/customers/);
  assert.match(landing, /Guaynaa enciende el Megaescenario/);
  assert.match(landing, /Los Kjarkas: la raíz que nos une/);
  assert.match(landing, />Instagram <span aria-hidden="true">↗<\/span><\/a>/);
  assert.match(landing, /href="\/"[^>]*>Volver al Complejo/);
  assert.equal((landing.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(landing, /2 nov|120K|\$12/i);
  assert.match(stands, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(stands, /Acceso para compra de stands/);
  assert.match(stands, /14 de septiembre/);
  assert.match(stands, /datetime="2026-09-14T08:00:00-05:00"/);
  assert.match(stands, /Venta 100% online/);
  assert.match(stands, /Más de 500 stands/);
  assert.match(stands, /https:\/\/mushucticket\.com\//);
  assert.equal((stands.match(/href="https:\/\/mushucticket\.com\/"/g) ?? []).length, 2);
  assert.doesNotMatch(stands, /reserva\.mushucticket\.com\/customers/);
  assert.match(stands, /\/assets\/finados\/logo-finados\.svg\?v=20260903/);
  assert.match(stands, /data-stands-countdown/);
  assert.match(stands, /data-target="2026-09-14T08:00:00-05:00"/);
  assert.match(stands, /14 de septiembre/);
  assert.match(stands, /08:00 <small>AM<\/small>/);
  assert.match(stands, /Días · Horas · Minutos · Segundos/);
  assert.match(stands, /class="stands-countdown-grid"/);
  assert.doesNotMatch(stands, /Haz clic en el botón y adquiere tu stand para ser parte de la expoferia más grande del Ecuador\./);
  assert.match(stands, /Correo electrónico/);
  assert.match(stands, /Cédula de ciudadanía <span>PDF<\/span>/);
  assert.match(stands, /RUC habilitado <span>PDF<\/span>/);
  assert.match(stands, /Catálogo de productos <span>PDF<\/span>/);
  assert.match(stands, /Te recomendamos utilizar un computador/);
  assert.match(stands, /\/assets\/finados\/expositora-requisitos\.webp/);
  assert.match(stands, /href="\/finados\/"/);
  assert.equal((stands.match(/<h1\b/g) ?? []).length, 1);
});
