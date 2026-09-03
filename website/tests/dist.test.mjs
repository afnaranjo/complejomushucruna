import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { checkDist } from '../scripts/check-dist.mjs';

test('la salida completa no contiene rutas rotas ni referencias al runtime antiguo', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-dist-'));
  await buildSite(output);
  const result = await checkDist(output);

  assert.equal(result.errors.length, 0, result.errors.join('\n'));
  assert.ok(result.htmlFiles >= 14);
  assert.ok(result.checkedLinks >= 100);
});

test('publica robots, sitemap y una página 404 propia', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-seo-'));
  await buildSite(output);
  const robots = await readFile(join(output, 'robots.txt'), 'utf8');
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');
  const notFound = await readFile(join(output, '404.html'), 'utf8');

  assert.match(robots, /Sitemap: https:\/\/complejomushucruna.com\/sitemap.xml/);
  assert.match(sitemap, /https:\/\/complejomushucruna.com\/experiencias\//);
  assert.match(sitemap, /https:\/\/complejomushucruna.com\/eventos\/archivo\/finados-2021\//);
  assert.match(notFound, /<h1>Página no encontrada<\/h1>/);
});

test('mantiene pequeños los recursos propios de código', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-size-'));
  await buildSite(output);
  const css = await stat(join(output, 'assets/styles.css'));
  const js = await stat(join(output, 'assets/site.js'));

  assert.ok(css.size < 100_000, `CSS demasiado grande: ${css.size}`);
  assert.ok(js.size < 30_000, `JavaScript demasiado grande: ${js.size}`);
});

test('empaqueta la experiencia Finados con recursos locales y optimizados', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-finados-assets-'));
  await buildSite(output);
  const landing = await readFile(join(output, 'finados/index.html'), 'utf8');
  const standsPage = await readFile(join(output, 'acceso-compra-stands/index.html'), 'utf8');
  const finadosStyles = await readFile(join(output, 'assets/finados/finados.css'), 'utf8');
  const finadosScript = await readFile(join(output, 'assets/finados/finados.js'), 'utf8');
  const css = await stat(join(output, 'assets/finados/finados.css'));
  const js = await stat(join(output, 'assets/finados/finados.js'));
  const exhibitor = await stat(join(output, 'assets/finados/expositor-artesanias.webp'));
  const requirementsExhibitor = await stat(join(output, 'assets/finados/expositora-requisitos.webp'));
  const favicon = await stat(join(output, 'assets/finados/favicon-finados.png'));
  const campaignLogo = await readFile(join(output, 'assets/finados/logo-finados.svg'), 'utf8');
  const legacyIcon = await readFile(join(output, 'assets/finados/icons/legado.svg'), 'utf8');
  const encounterIcon = await readFile(join(output, 'assets/finados/icons/encuentro.svg'), 'utf8');
  const growthIcon = await readFile(join(output, 'assets/finados/icons/crecimiento.svg'), 'utf8');
  const spectatorIcon = await readFile(join(output, 'assets/finados/icons/espectador.svg'), 'utf8');
  const guaynaa = await stat(join(output, 'assets/finados/guaynaa-finados.webp'));
  const guaynaaMobile = await stat(join(output, 'assets/finados/guaynaa-finados-960.webp'));
  const kjarkas = await stat(join(output, 'assets/finados/kjarkas-finados.webp'));
  const kjarkasMobile = await stat(join(output, 'assets/finados/kjarkas-finados-960.webp'));

  assert.match(landing, /\/assets\/finados\/finados\.css/);
  assert.match(landing, /\/assets\/finados\/finados\.js/);
  assert.match(landing, /rel="icon" href="\/assets\/finados\/favicon-finados\.png"/);
  assert.match(landing, /rel="preload" as="image" href="\/assets\/finados\/expositor-artesanias\.webp"/);
  assert.match(landing, /Venta de stands/);
  assert.match(landing, /14 de septiembre/);
  assert.match(landing, /datetime="2026-09-14"/);
  assert.match(landing, /Venta online/);
  assert.match(landing, /href="https:\/\/mushucticket\.com\/"/);
  assert.doesNotMatch(landing, /reserva\.mushucticket\.com\/customers/);
  assert.match(landing, /\/assets\/finados\/logo-finados\.svg\?v=20260903/);
  assert.match(landing, /class="hero-paloma"/);
  assert.match(landing, /\/assets\/finados\/icons\/paloma\.svg/);
  assert.doesNotMatch(landing, /class="hero-encuentro"/);
  assert.match(landing, /\/assets\/finados\/guaynaa-finados\.webp/);
  assert.match(landing, /Guaynaa enciende el Megaescenario/);
  assert.match(landing, /\/assets\/finados\/kjarkas-finados\.webp/);
  assert.match(landing, /Los Kjarkas: la raíz que nos une/);
  assert.match(landing, /https:\/\/www\.facebook\.com\/FinadosMushucRunaEc/);
  assert.match(landing, /https:\/\/www\.tiktok\.com\/@finadosmushucruna/);
  assert.match(landing, /https:\/\/www\.instagram\.com\/finadosmushucruna\//);
  assert.match(standsPage, /Más de 500 stands/);
  assert.match(standsPage, /Venta 100% online/);
  assert.match(standsPage, /https:\/\/mushucticket\.com\//);
  assert.doesNotMatch(standsPage, /reserva\.mushucticket\.com\/customers/);
  assert.match(standsPage, /\/assets\/finados\/icons\/espectador\.svg\?v=20260903/);
  assert.match(standsPage, /data-stands-countdown/);
  assert.match(standsPage, /data-target="2026-09-14T08:00:00-05:00"/);
  assert.match(standsPage, /08:00 <small>AM<\/small>/);
  assert.match(standsPage, /Días · Horas · Minutos · Segundos/);
  assert.doesNotMatch(standsPage, /Haz clic en el botón y adquiere tu stand/);
  assert.match(standsPage, /Correo electrónico/);
  assert.match(standsPage, /Cédula de ciudadanía/);
  assert.match(standsPage, /RUC habilitado/);
  assert.match(standsPage, /Catálogo de productos/);
  assert.match(standsPage, /Te recomendamos utilizar un computador/);
  assert.match(standsPage, /\/assets\/finados\/expositora-requisitos\.webp/);
  assert.match(finadosScript, /data-stands-countdown/);
  assert.match(finadosScript, /dataset\.target/);
  assert.match(campaignLogo, /viewBox="0 0 766 449"/);
  assert.match(legacyIcon, /viewBox="0 0 899 969"/);
  assert.match(encounterIcon, /viewBox="0 0 574 702"/);
  assert.match(growthIcon, /fill:#ffc42e/);
  assert.match(spectatorIcon, /viewBox="0 0 1271 587"/);
  assert.match(spectatorIcon, /fill:#00d2d6/);
  assert.doesNotMatch(spectatorIcon, /<image/);
  assert.ok(landing.indexOf('id="artistas"') < landing.indexOf('id="kjarkas"'));
  assert.ok(landing.indexOf('id="kjarkas"') < landing.indexOf('id="canales"'));
  assert.ok(landing.indexOf('id="canales"') < landing.indexOf('id="legado"'));
  assert.match(finadosStyles, /\.hero-paloma/);
  assert.doesNotMatch(finadosStyles, /\.hero-encuentro/);
  assert.ok(css.size < 80_000, `CSS Finados demasiado grande: ${css.size}`);
  assert.ok(js.size < 20_000, `JavaScript Finados demasiado grande: ${js.size}`);
  assert.ok(exhibitor.size < 250_000, `Expositor Finados demasiado grande: ${exhibitor.size}`);
  assert.ok(requirementsExhibitor.size < 180_000, `Expositora de requisitos demasiado grande: ${requirementsExhibitor.size}`);
  assert.ok(favicon.size < 60_000, `Favicon Finados demasiado grande: ${favicon.size}`);
  assert.ok(Buffer.byteLength(campaignLogo) < 25_000, `Logo Finados demasiado grande: ${Buffer.byteLength(campaignLogo)}`);
  assert.ok(guaynaa.size < 250_000, `Guaynaa Finados demasiado grande: ${guaynaa.size}`);
  assert.ok(guaynaaMobile.size < guaynaa.size, 'La variante móvil de Guaynaa debe ser menor');
  assert.ok(kjarkas.size < 250_000, `Kjarkas Finados demasiado grande: ${kjarkas.size}`);
  assert.ok(kjarkasMobile.size < kjarkas.size, 'La variante móvil de Los Kjarkas debe ser menor');
});
