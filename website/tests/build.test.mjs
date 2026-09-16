import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { escapeHtml } from '../src/render/html.mjs';

test('agrega un aviso de cookies compacto en páginas públicas y excluye admin', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-cookie-consent-'));
  const files = await buildSite(output);
  const htmlFiles = files.filter((file) => file.endsWith('.html'));

  assert.ok(htmlFiles.length >= 14);
  for (const htmlFile of htmlFiles) {
    const html = await readFile(join(output, htmlFile), 'utf8');
    if (htmlFile.startsWith('admin/') || /^finados\/voceros\/(acceso|mi-registro|restablecer)\//.test(htmlFile)) {
      assert.doesNotMatch(html, /cookie-consent/);
      continue;
    }
    assert.equal((html.match(/data-cookie-consent(?:\s|>)/g) ?? []).length, 1, `${htmlFile} debe incluir una barra`);
    assert.equal((html.match(/data-cookie-consent-accept/g) ?? []).length, 1, `${htmlFile} debe incluir un botón`);
    assert.match(html, /Nuestro sitio web utiliza cookies para mejorar tu navegación\./);
    assert.match(html, />Aceptar<\/button>/, `${htmlFile} debe mostrar la acción Aceptar`);
    assert.match(html, /\/assets\/cookie-consent\.css\?v=20260914-2/);
    assert.match(html, /\/assets\/cookie-consent\.js\?v=20260914-2/);
  }
});

test('escapa contenido que no debe convertirse en HTML activo', () => {
  assert.equal(
    escapeHtml('<script>alert("Mushuc")</script>'),
    '&lt;script&gt;alert(&quot;Mushuc&quot;)&lt;/script&gt;',
  );
});

test('compila Finados únicamente desde las fuentes declaradas', async () => {
  const productionCss = await readFile(join(process.cwd(), 'src', 'finados', 'finados.css'), 'utf8');

  assert.match(productionCss, /^@import "tailwindcss" source\(none\);/);
  assert.match(productionCss, /^@source "\.\/page\.mjs";/m);
  assert.match(productionCss, /^@source "\.\/stands-page\.mjs";/m);
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
    'finados/dignidades-finados-2025/index.html',
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
  assert.match(home, /<meta name="google-site-verification" content="nEfLh1DS-VLhCWOMJGp2cLwFXuBijd9P7KrWpk85fLQ">/);
  assert.equal((home.match(/name="google-site-verification"/g) ?? []).length, 1);
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
  assert.match(home, /class="home-story"/);
  assert.match(home, /class="hero hero--finados home-story__hero"/);
  for (const chapter of ['current', 'identity', 'experiences', 'quote', 'archive', 'visit']) {
    assert.match(home, new RegExp(`home-chapter--${chapter}`));
  }
  assert.match(home, /class="site-header site-header--finados"/);
  assert.match(home, /\/assets\/icons\/logo-complejo\.svg\?v=20260909/);
  assert.match(home, /\/assets\/styles\.css\?v=20260915-1/);
  assert.match(home, /\/assets\/site\.js\?v=20260914-1/);
  assert.match(home, /Finados 2026 · Venta de stands/);
  assert.match(home, /14 de septiembre/);
  assert.match(home, /Venta online/);
  assert.match(home, /href="https:\/\/mushucticket\.com\/" data-stands-purchase-link/);
  assert.match(home, /\/assets\/finados\/expositor-artesanias\.webp/);
  assert.doesNotMatch(mainNavigation, /href="\/experiencias\/"/);
  assert.doesNotMatch(mainNavigation, /href="\/eventos\/"/);
  assert.match(
    mainNavigation,
    /class="main-nav__action main-nav__action--stands" href="https:\/\/www\.mushucticket\.com\/" data-stands-purchase-link target="_blank" rel="noopener noreferrer">VENTA DE STANDS<\/a>/,
  );
  assert.match(
    mainNavigation,
    /class="main-nav__action main-nav__action--finados" href="\/finados\/">FINADOS 2026<\/a>/,
  );
  assert.match(mainNavigation, /href="\/finados\/voceros\/">VOCEROS<\/a>/);
  assert.match(
    mainNavigation,
    /href="https:\/\/guiap\.com\/360\/mr2023-2024\/" target="_blank" rel="noopener noreferrer">TOUR VIRTUAL<\/a>/,
  );
  assert.match(mainNavigation, /href="\/granja\/"/);
  assert.match(mainNavigation, /href="\/historia\/"/);
  assert.match(mainNavigation, /href="\/visitanos\/"/);
  const expectedOrder = ['INICIO', 'VENTA DE STANDS', 'FINADOS 2026', 'ACREDITACIÓN DE MEDIOS', 'TOUR VIRTUAL', 'GRANJA', 'HISTORIA', 'VISITAMOS'];
  for (let index = 1; index < expectedOrder.length; index += 1) {
    assert.ok(
      mainNavigation.indexOf(`>${expectedOrder[index - 1]}</a>`) < mainNavigation.indexOf(`>${expectedOrder[index]}</a>`),
      `${expectedOrder[index - 1]} debe mostrarse antes de ${expectedOrder[index]}`,
    );
  }
});

test('publica una acreditación de medios completa, limitada por fecha y respaldada en servidor', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-media-accreditation-'));
  const files = await buildSite(output);
  const page = await readFile(join(output, 'acreditacion-de-medios/index.html'), 'utf8');
  const finadosPage = await readFile(join(output, 'finados/index.html'), 'utf8');
  const endpoint = await readFile(join(output, 'api/acreditacion-medios/index.php'), 'utf8');
  const googleSheetsBridge = await readFile(join(output, 'api/_google-sheets.php'), 'utf8');
  const endpointConfig = await readFile(join(output, 'api/acreditacion-medios/.htaccess'), 'utf8');
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');

  assert.ok(files.includes('acreditacion-de-medios/index.html'));
  assert.ok(files.includes('api/acreditacion-medios/index.php'));
  assert.match(endpointConfig, /DirectoryIndex index\.php/);
  assert.match(sitemap, /complejomushucruna\.com\/acreditacion-de-medios\//);
  assert.match(page, /<body class="media-accreditation-page">/);
  assert.match(page, /class="site-header site-header--finados"/);
  assert.match(page, /<nav id="navegacion-principal"[\s\S]*href="\/finados\/voceros\/"[^>]*>VOCEROS<\/a>/);
  assert.match(page, /\/assets\/images\/acreditacion-medios-periodista\.jpg\?v=20260909/);
  assert.match(page, /\/assets\/media-accreditation\.css\?v=20260909/);
  assert.match(page, /Acreditación de medios/);
  assert.match(page, /Martes 15 de septiembre · 18:00/);
  assert.match(page, /data-deadline="2026-09-15T18:00:00-05:00"/);
  assert.match(page, /action="\/api\/acreditacion-medios\/" method="post"/);
  for (const field of [
    'nombre_medio', 'tipo_medio', 'frecuencia_canal', 'nombre_programa', 'tipo_programa',
    'provincia', 'ciudad', 'contrato_mushuc', 'numero_personas', 'equipo', 'telefono',
    'correo', 'acepta_condiciones',
  ]) {
    assert.match(page, new RegExp(`name="${field}"`));
  }
  for (const mediaType of ['Radio', 'TV', 'Prensa escrita', 'Digital', 'Redes sociales']) {
    assert.match(page, new RegExp(`>${mediaType}<`));
  }
  for (const province of ['Azuay', 'Galápagos', 'Pichincha', 'Tungurahua', 'Zamora Chinchipe']) {
    assert.match(page, new RegExp(`>${province}<`));
  }
  assert.match(page, /value="2">2 personas \(máximo\)<\/option>/);
  assert.match(page, /name="acepta_condiciones"[^>]*required/);
  assert.match(page, /Gracias, bienvenido al lanzamiento de Finados Mushuc Runa 2026/);
  assert.match(page, /data-media-team/);
  assert.match(page, /data-media-name/);
  assert.match(page, /data-media-download>Descargar imagen/);
  assert.doesNotMatch(page, />Cerrar<\/button>/);
  const finadosFooter = finadosPage.match(/<footer class="bg-night[\s\S]*?<\/footer>/)?.[0];
  const accreditationFooter = page.match(/<footer class="bg-night[\s\S]*?<\/footer>/)?.[0];
  assert.ok(finadosFooter, 'La página Finados debe incluir su footer de campaña');
  assert.equal(accreditationFooter, finadosFooter, 'Acreditación debe reutilizar exactamente el footer de Finados');

  assert.match(endpoint, /America\/Guayaquil/);
  assert.match(endpoint, /2026-09-15 18:00:00/);
  assert.match(endpoint, /private-data/);
  assert.match(endpoint, /fputcsv/);
  assert.match(endpoint, /finadosmushucruna@gmail\.com/);
  assert.match(endpoint, /mail\(/);
  assert.match(endpoint, /google_sheets_deliver\(\$privateDirectory, 'media'/);
  assert.match(googleSheetsBridge, /google-sheets-config\.json/);
  assert.match(googleSheetsBridge, /google-sheets-pending\.jsonl/);
  assert.match(googleSheetsBridge, /script\\\.google\\\.com\/macros\/s/);
  assert.match(endpoint, /\^\[=\+\\-@\]/);
  assert.doesNotMatch(endpoint, /password|passwd|secret\s*=/i);
});

test('publica invitaciones fuera del menú y registra RSVP en archivos compatibles con Excel', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-invitaciones-'));
  const files = await buildSite(output);
  const page = await readFile(join(output, 'invitaciones/index.html'), 'utf8');
  const endpoint = await readFile(join(output, 'api/invitaciones-rsvp/index.php'), 'utf8');
  const endpointConfig = await readFile(join(output, 'api/invitaciones-rsvp/.htaccess'), 'utf8');
  const home = await readFile(join(output, 'index.html'), 'utf8');
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');
  const sheetsIntegration = await readFile(join(process.cwd(), '..', 'integrations', 'google-sheets', 'Code.gs'), 'utf8');

  assert.ok(files.includes('invitaciones/index.html'));
  assert.ok(files.includes('api/invitaciones-rsvp/index.php'));
  assert.match(endpointConfig, /DirectoryIndex index\.php/);
  assert.match(page, /<title>Invitaciones \| Finados Mushuc Runa 2026<\/title>/);
  assert.match(page, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(page, /<link rel="canonical" href="https:\/\/complejomushucruna\.com\/invitaciones\/">/);
  assert.match(page, /Brunch/);
  assert.match(page, /Confirmar asistencia/);
  assert.match(page, /data-invitation-company/);
  assert.match(page, /label\.textContent = 'Empresa'/);
  assert.match(page, /input\.autocomplete = 'organization'/);
  assert.match(page, /company: companyValue\.trim\(\)/);
  assert.match(page, /Abg\. <strong>Luis Alfonso Chango<\\u002Fstrong>, Mentalizador Feria Finados 2026\./);
  assert.doesNotMatch(page, /Luis A\. Chango|Gerente General, Coop\. Mushuc Runa/);
  assert.match(page, /api\/invitaciones-rsvp/);
  assert.match(page, /Bienvenido al Brunch Empresarial, Finados Mushuc Runa 2026\./);
  assert.match(page, /Descargar imagen/);
  assert.match(page, /invitacion-brunch-finados-mushuc-runa-2026\.png/);
  assert.match(page, /canvas\.toBlob/);
  assert.doesNotMatch(home, /href="\/invitaciones\//);
  assert.doesNotMatch(sitemap, /complejomushucruna\.com\/invitaciones\//);

  assert.match(endpoint, /private-data/);
  assert.match(endpoint, /confirmaciones-invitaciones-finados-2026\.csv/);
  assert.match(endpoint, /confirmaciones-invitaciones-finados-2026\.xlsx/);
  assert.match(endpoint, /ZipArchive/);
  assert.match(endpoint, /fputcsv/);
  assert.match(endpoint, /America\/Guayaquil/);
  assert.match(endpoint, /\$company = normalize_text\(\$input\['company'\]/);
  assert.match(endpoint, /'Empresa', 'Cargo \/ referencia'/);
  assert.match(endpoint, /'company' => \$company/);
  assert.match(endpoint, /google_sheets_deliver\(\$privateDirectory, 'brunch'/);
  assert.match(sheetsIntegration, /'Nombre', 'Empresa',\s*'Cargo \/ referencia'/);
  assert.match(sheetsIntegration, /record\.name, record\.company, record\.role/);
  assert.match(sheetsIntegration, /function ensureBrunchSchema\(\)/);
  assert.doesNotMatch(endpoint, /password|passwd|secret\s*=/i);
});

test('genera las páginas de Finados y ordena sus subpáginas en un menú desplegable', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-finados-preview-'));
  const files = await buildSite(output);
  const home = await readFile(join(output, 'index.html'), 'utf8');
  const landing = await readFile(join(output, 'finados/index.html'), 'utf8');
  const stands = await readFile(join(output, 'acceso-compra-stands/index.html'), 'utf8');
  const voceros = await readFile(join(output, 'finados/voceros/index.html'), 'utf8');
  const dignities = await readFile(join(output, 'finados/dignidades-finados-2025/index.html'), 'utf8');
  const sitemap = await readFile(join(output, 'sitemap.xml'), 'utf8');

  assert.ok(files.includes('finados/index.html'));
  assert.ok(files.includes('acceso-compra-stands/index.html'));
  assert.ok(files.includes('finados/voceros/index.html'));
  assert.ok(files.includes('finados/dignidades-finados-2025/index.html'));
  assert.match(home, /href="\/finados\/">FINADOS 2026<\/a>/);
  assert.doesNotMatch(sitemap, /complejomushucruna\.com\/finados\//);
  assert.doesNotMatch(sitemap, /complejomushucruna\.com\/acceso-compra-stands\//);
  assert.doesNotMatch(sitemap, /complejomushucruna\.com\/finados\/voceros\//);
  assert.doesNotMatch(sitemap, /complejomushucruna\.com\/finados\/dignidades-finados-2025\//);
  for (const page of [home, landing, voceros, dignities]) {
    assert.equal((page.match(/<nav id="navegacion-principal"/g) ?? []).length, 1);
    assert.doesNotMatch(page, /class="campaign-nav"/);
    const navigation = page.match(/<(?:ul class="main-nav__submenu"|ul class="campaign-submenu__list")[\s\S]*?<\/ul>/)?.[0] ?? '';
    const expected = ['Programación artística', 'Dignidades 2025', 'Voceros'];
    for (let index = 1; index < expected.length; index += 1) {
      assert.ok(
        navigation.toLocaleLowerCase('es').indexOf(expected[index - 1].toLocaleLowerCase('es'))
          < navigation.toLocaleLowerCase('es').indexOf(expected[index].toLocaleLowerCase('es')),
        `El submenú debe ordenar ${expected[index - 1]} antes de ${expected[index]}`,
      );
    }
  }
  for (const page of [home, landing, stands, voceros, dignities]) {
    assert.equal((page.match(/<nav id="navegacion-principal"/g) ?? []).length, 1);
    const navigation = page.match(/<(?:ul class="main-nav__submenu"|ul class="campaign-submenu__list")[\s\S]*?<\/ul>/)?.[0] ?? '';
    assert.match(navigation, /href="\/finados\/voceros\/"[^>]*>VOCEROS<\/a>/i);
  }
  assert.match(landing, /href="\/finados\/dignidades-finados-2025\/">DIGNIDADES 2025<\/a>/);
  assert.match(dignities, /<title>Dignidades Finados 2025 \| Mushuc Runa<\/title>/);
  assert.match(dignities, /<h1[^>]*>[\s\S]*Dignidades[\s\S]*Finados 2025[\s\S]*<\/h1>/);
  assert.match(dignities, /Euler Caicedo/);
  assert.match(dignities, /ganador del concurso a Rey Pan/);
  assert.match(dignities, /Tierra Canela/);
  assert.match(dignities, /agrupación ganadora del concurso a Señorita Colada Morada/);
  assert.match(dignities, /euler-caicedo-rey-pan\.webp\?v=20260914-1/);
  assert.match(dignities, /tierra-canela-colada-morada\.webp\?v=20260914-1/);
  assert.match(dignities, /auspiciantes-finados-2025\.webp\?v=20260914-1/);
  assert.ok(dignities.indexOf('id="ganadores"') < dignities.indexOf('class="dignities-sponsors"'));
  assert.equal((dignities.match(/<h1\b/g) ?? []).length, 1);
  assert.match(landing, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(landing, /\/assets\/finados\/finados\.css\?v=20260915-1/);
  assert.match(landing, /\/assets\/finados\/finados\.js\?v=20260915-1/);
  assert.match(landing, /Finados 2026 · Venta de stands/);
  assert.match(landing, /href="https:\/\/mushucticket\.com\/" data-stands-purchase-link/);
  assert.doesNotMatch(landing, /reserva\.mushucticket\.com\/customers/);
  assert.match(landing, /Guaynaa enciende el Megaescenario/);
  assert.match(landing, /Kjarkas: la raíz que nos une/);
  assert.doesNotMatch(landing, /Los Kjarkas/i);
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
  assert.match(landing, /href="\/"[^>]*>INICIO<\/a>/);
  assert.equal((landing.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(landing, /2 nov|120K|\$12/i);
  assert.match(stands, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.match(stands, /\/assets\/finados\/finados\.css\?v=20260915-1/);
  assert.match(stands, /\/assets\/finados\/finados\.js\?v=20260915-1/);
  assert.match(stands, /Acceso para compra de stands/);
  assert.match(stands, /14 de septiembre/);
  assert.match(stands, /datetime="2026-09-14T08:00:00-05:00"/);
  assert.match(stands, /Venta 100% online/);
  assert.match(stands, /Más de 500 stands/);
  assert.match(stands, /https:\/\/mushucticket\.com\//);
  assert.equal((stands.match(/href="https:\/\/mushucticket\.com\/"/g) ?? []).length, 3);
  assert.doesNotMatch(stands, /reserva\.mushucticket\.com\/customers/);
  assert.match(stands, /\/assets\/finados\/logo-finados\.svg\?v=20260903/);
  assert.match(stands, /data-stands-countdown/);
  assert.match(stands, /data-target="2026-09-14T08:00:00-05:00"/);
  assert.match(stands, /data-switch-at="2026-09-14T07:59:00-05:00"/);
  assert.match(stands, /data-countdown-welcome hidden>Bienvenidos a Finados Mushuc Runa 2026\.<\/p>/);
  assert.match(stands, /14 de septiembre/);
  assert.match(stands, /08:00 <small>AM<\/small>/);
  assert.match(stands, /class="stands-countdown-grid"/);
  assert.doesNotMatch(stands, /stands-countdown-heading/);
  assert.match(stands, /data-countdown-value="days">--<\/strong>\s*<small>Días<\/small>/);
  assert.match(stands, /data-countdown-value="hours">--<\/strong>\s*<small>Horas<\/small>/);
  assert.match(stands, /data-countdown-value="minutes">--<\/strong>\s*<small>Minutos<\/small>/);
  assert.match(stands, /data-countdown-value="seconds">--<\/strong>\s*<small>Segundos<\/small>/);
  assert.equal((stands.match(/data-stands-purchase-link/g) ?? []).length, 4);
  assert.doesNotMatch(stands, /Haz clic en el botón y adquiere tu stand para ser parte de la expoferia más grande del Ecuador\./);
  assert.match(stands, /class="stands-online-note[^>]*">Venta exclusivamente online a través del canal de compra\.<\/p>/);
  assert.match(stands, /class="stands-section-button" href="#politicas-generales"[^>]*>Políticas y mapa/);
  assert.doesNotMatch(stands, /href="#politicas-generales"[^>]*target="_blank"/);
  assert.match(stands, /Correo electrónico/);
  assert.match(stands, /Cédula de ciudadanía <span>PDF<\/span>/);
  assert.match(stands, /RUC habilitado <span>PDF<\/span>/);
  assert.match(stands, /Catálogo de productos <span>PDF<\/span>/);
  assert.match(stands, /Te recomendamos utilizar un computador/);
  assert.match(stands, /\/assets\/finados\/expositora-requisitos\.webp/);
  assert.match(stands, /id="politicas-generales" class="stands-policies[^\"]*text-lienzo/);
  assert.match(stands, /Venta de stands <strong>solo en línea<\/strong>: lunes 14 de septiembre, 8:00 am/);
  assert.match(stands, /Artesanías<\/span><strong>\$25<\/strong>/);
  assert.match(stands, /Comercio y productores<\/span><strong>\$50<\/strong>/);
  assert.match(stands, /Gastronomía<\/span><strong>\$200<\/strong>/);
  assert.match(stands, /Entrega de gafetes, Juan Benigno Vela y Montalvo, 9:00–17:00/);
  assert.match(stands, /Fecha límite de stand listo, previa revisión de comisarios/);
  assert.match(stands, /Uso de estación de transbordo/);
  assert.match(stands, /Atención mínima: <strong>11:00 a 20:00<\/strong>/);
  assert.match(stands, /<ol class="stands-policy-sublist">\s*<li><strong>Primera vez, llamado de atención\.<\/strong><\/li>\s*<li>Reincidencia, se ejecuta el <strong>100% de la garantía<\/strong>, con evidencia fotográfica\.<\/li>\s*<\/ol>/);
  assert.match(stands, /Sanciones del 100% de la garantía/);
  assert.match(stands, /Falsificar, duplicar o dar mal uso al gafete/);
  assert.match(stands, /id="mapa-accesos"/);
  assert.match(stands, /\/assets\/finados\/mapa-accesos\.svg\?v=20260911/);
  assert.ok(stands.indexOf('Sé parte de nuestra historia') < stands.indexOf('id="politicas-generales"'));
  assert.ok(stands.indexOf('id="politicas-generales"') < stands.indexOf('id="mapa-accesos"'));
  assert.match(stands, /class="button-outline-light" href="\/finados\/" target="_blank" rel="noopener noreferrer"/);
  assert.match(stands, /href="https:\/\/mushucticket\.com\/" data-stands-purchase-link target="_blank" rel="noopener noreferrer"/);
  assert.match(stands, /class="footer-link" href="\/finados\/" target="_blank" rel="noopener noreferrer"/);
  assert.equal((stands.match(/<h1\b/g) ?? []).length, 1);
});

test('construye la landing de Voceros y dirige al registro privado', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-voceros-'));
  const files = await buildSite(output);
  const page = await readFile(join(output, 'finados/voceros/index.html'), 'utf8');
  const css = await readFile(join(output, 'assets/finados/voceros.css'), 'utf8');
  const endpointConfig = await readFile(join(output, 'api/voceros/.htaccess'), 'utf8');
  const vocerosScript = await readFile(join(output, 'assets/finados/voceros.js'), 'utf8');
  const sheetsIntegration = await readFile(join(process.cwd(), '..', 'integrations', 'google-sheets', 'Code.gs'), 'utf8');

  assert.ok(files.includes('finados/voceros/index.html'));
  assert.ok(files.includes('assets/finados/voceros.css'));
  assert.ok(files.includes('assets/finados/voceros.js'));
  assert.ok(files.includes('api/voceros/index.php'));
  assert.ok(files.includes('api/_voceros-bootstrap.php'));
  for (const legalPage of [
    'politicas-del-vocero', 'bases-del-termometro', 'politica-de-privacidad',
    'autorizacion-de-imagen', 'ejercer-derechos',
  ]) assert.ok(files.includes(`finados/voceros/${legalPage}/index.html`));
  assert.match(endpointConfig, /DirectoryIndex index\.php/);
  assert.match(page, /<title>Voceros \| Finados Mushuc Runa 2026<\/title>/);
  assert.match(page, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  assert.equal((page.match(/<h1\b/g) ?? []).length, 1);
  assert.match(page, /Volví a la feria/);
  assert.match(page, /Sube de nivel/);
  assert.match(page, /No te damos una plantilla/);
  assert.match(page, /<li>Video vertical en TikTok\.<\/li>/);
  assert.doesNotMatch(page, /reels de Instagram|reels o video de Facebook|En Instagram y Facebook usa|Lo publicado del 1 al 13 de septiembre/i);
  assert.match(css, /\.voceros-support \.voceros-heading h2\s*\{[^}]*max-width:\s*100%[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(page, /href="\/finados\/voceros\/acceso\/">Crear cuenta/);
  assert.match(page, /Iniciar sesión/);
  assert.doesNotMatch(page, /data-voceros-form|name="cedula"|data-voceros-thanks/);
  assert.match(page, /Entre 16 y 17 necesitas autorización escrita/);
  assert.match(page, /Política de Privacidad/);
  assert.match(vocerosScript, /registro-vocero-finados-mushuc-runa-2026\.png/);
  assert.match(vocerosScript, /canvas\.width = 1080/);
  assert.match(vocerosScript, /canvas\.height = 1920/);
  assert.match(vocerosScript, /navigatorImplementation\.canShare/);
  assert.match(vocerosScript, /navigatorImplementation\.share/);
  assert.match(vocerosScript, /formData\.get\('nombre_completo'\)/);
  assert.match(vocerosScript, /formData\.get\('whatsapp'\)/);
  assert.match(vocerosScript, /formData\.get\('fecha_nacimiento'\)/);
  assert.match(vocerosScript, /formData\.get\('ciudad'\)/);
  assert.match(vocerosScript, /formData\.get\('vocero_previo'\)/);
  assert.match(page, /Última actualización de esta página: 14 de septiembre de 2026/);
  assert.doesNotMatch(page, /la más grande|\$\d+/i);
  assert.match(css, /\.voceros-button\s*\{[^}]*background: var\(--voceros-cyan\);[^}]*box-shadow: 6px 6px 0 var\(--voceros-fuchsia\)/s);


  assert.match(sheetsIntegration, /voceros: '1Z4MzXyyyA-V8wb1a2eaOodjb_VzqQm1qTDOtBf1gyuI'/);
  assert.match(sheetsIntegration, /insertSheet\('Consentimientos'\)/);
  assert.match(sheetsIntegration, /record\.nombre_completo/);

  const legalExpectations = [
    ['politicas-del-vocero', 'Políticas del Vocero', 'Participación voluntaria y gratuita'],
    ['bases-del-termometro', 'Bases del Termómetro', 'Vistas válidas'],
    ['politica-de-privacidad', 'Política de Privacidad', 'Responsable y contacto'],
    ['autorizacion-de-imagen', 'Autorización de uso de imagen y contenido', 'Edición e integridad'],
    ['ejercer-derechos', 'Contacto para ejercer derechos', 'Autoridad de control'],
  ];
  for (const [slug, title, requiredText] of legalExpectations) {
    const legalPage = await readFile(join(output, `finados/voceros/${slug}/index.html`), 'utf8');
    assert.match(legalPage, new RegExp(`<h1>${title}</h1>`));
    assert.match(legalPage, new RegExp(requiredText));
    assert.match(legalPage, /Ley Orgánica de Protección de Datos Personales/);
    assert.match(legalPage, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  }
  const privacyPage = await readFile(join(output, 'finados/voceros/politica-de-privacidad/index.html'), 'utf8');
  assert.doesNotMatch(privacyPage, /Validación organizacional pendiente/);
  assert.match(privacyPage, /Eventos Finados 2026/);
  assert.match(privacyPage, /\+593 980 346 729/);
  assert.match(privacyPage, /Santa Lucía, Tisaleo, Tungurahua/);
  assert.match(privacyPage, /facturacioncomplejomushuc@gmail\.com/);
  assert.match(privacyPage, /tres años contados desde el envío del formulario/);
  assert.doesNotMatch(privacyPage, /\bRUC\b/);
});
