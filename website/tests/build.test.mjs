import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

test('compila Finados únicamente desde las fuentes declaradas', async () => {
  const probe = join(process.cwd(), 'src', 'finados', '.tailwind-auto-probe.html');
  const output = await mkdtemp(join(tmpdir(), 'mushuc-tailwind-sources-'));

  try {
    await writeFile(probe, '<div class="bg-[#123456]"></div>', 'utf8');
    await buildSite(output);
    const css = await readFile(join(output, 'assets', 'finados', 'finados.css'), 'utf8');

    assert.doesNotMatch(css, /#123456/i);
  } finally {
    await rm(probe, { force: true });
    await rm(output, { force: true, recursive: true });
  }
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
  assert.match(home, /<link rel="icon" href="\/assets\/icons\/logo-complejo-mushuc-runa\.svg\?v=20260904" type="image\/svg\+xml">/);
  assert.equal((home.match(/<h1\b/g) ?? []).length, 1);
  assert.match(home, /<a class="skip-link" href="#contenido">/);
  assert.match(home, /<main id="contenido">/);
});

test('la portada adopta la cabecera de venta de Finados y simplifica la navegación', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-home-finados-'));
  await buildSite(output);
  const home = await readFile(join(output, 'index.html'), 'utf8');
  const mainNavigation = home.match(/<nav id="navegacion-principal"[\s\S]*?<\/nav>/)?.[0] ?? '';

  assert.match(home, /<body class="home-page">/);
  assert.match(home, /class="home-chumbi"/);
  assert.match(home, /class="site-header site-header--finados"/);
  assert.match(home, /\/assets\/icons\/logo-complejo\.svg\?v=20260904-2/);
  assert.match(home, /class="hero hero--finados"/);
  assert.match(home, /Finados 2026 · Venta de stands/);
  assert.match(home, /14 de septiembre/);
  assert.match(home, /Venta online/);
  assert.match(home, /href="https:\/\/mushucticket\.com\/"/);
  assert.match(home, /\/assets\/finados\/expositor-artesanias\.webp/);
  assert.doesNotMatch(mainNavigation, /href="\/experiencias\/"/);
  assert.doesNotMatch(mainNavigation, /href="\/eventos\/"/);
  assert.match(mainNavigation, /href="\/granja\/"/);
  assert.match(mainNavigation, /href="\/historia\/"/);
  assert.match(mainNavigation, /href="\/visitanos\/"/);
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
  assert.match(landing, /\/assets\/finados\/finados\.css\?v=20260903-2/);
  assert.match(landing, /\/assets\/finados\/finados\.js\?v=20260903-2/);
  assert.match(landing, /Finados 2026 · Venta de stands/);
  assert.match(landing, /href="https:\/\/mushucticket\.com\/"/);
  assert.doesNotMatch(landing, /reserva\.mushucticket\.com\/customers/);
  assert.match(landing, /Guaynaa enciende el Megaescenario/);
  assert.match(landing, /Los Kjarkas: la raíz que nos une/);
  assert.match(landing, /id="william-luna"/);
  assert.match(landing, /William Luna celebra cuatro décadas en Finados/);
  assert.match(landing, /celebrará sus 40 años de vida artística en Finados Mushuc Runa 2026/);
  assert.match(landing, /\/assets\/finados\/william-luna\.svg\?v=20260904/);
  assert.match(landing, /id="las-nanas"/);
  assert.match(landing, /Las Ñañas: el grupo sensación/);
  assert.match(landing, /grupo sensación de la actualidad de la música nacional ecuatoriana/);
  assert.match(landing, /\/assets\/finados\/las-nanas\.svg\?v=20260904/);
  assert.ok(landing.indexOf('id="kjarkas"') < landing.indexOf('id="william-luna"'));
  assert.ok(landing.indexOf('id="william-luna"') < landing.indexOf('id="las-nanas"'));
  assert.ok(landing.indexOf('id="las-nanas"') < landing.indexOf('id="canales"'));
  assert.match(landing, />Instagram <span aria-hidden="true">↗<\/span><\/a>/);
  assert.match(landing, /href="\/"[^>]*>Volver al Complejo/);
  assert.equal((landing.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(landing, /2 nov|120K|\$12/i);
  assert.match(stands, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(stands, /\/assets\/finados\/finados\.css\?v=20260903-2/);
  assert.match(stands, /\/assets\/finados\/finados\.js\?v=20260903-2/);
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
  assert.match(stands, /class="stands-countdown-grid"/);
  assert.doesNotMatch(stands, /stands-countdown-heading/);
  assert.match(stands, /data-countdown-value="days">--<\/strong>\s*<small>Días<\/small>/);
  assert.match(stands, /data-countdown-value="hours">--<\/strong>\s*<small>Horas<\/small>/);
  assert.match(stands, /data-countdown-value="minutes">--<\/strong>\s*<small>Minutos<\/small>/);
  assert.match(stands, /data-countdown-value="seconds">--<\/strong>\s*<small>Segundos<\/small>/);
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
