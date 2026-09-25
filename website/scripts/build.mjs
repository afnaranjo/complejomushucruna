import { copyFile, cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { pages } from '../src/pages.mjs';
import { MIRROR_API_BASE } from '../src/finados/runtime-origins.mjs';
import { renderLayout } from '../src/render/layout.mjs';
import { injectInvitationOpeningHeader } from '../src/finados/opening-header.mjs';

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);

const cookieConsentMarkup = `  <aside class="cookie-consent" data-cookie-consent hidden role="region" aria-label="Preferencias de cookies">
    <p class="cookie-consent__message">Nuestro sitio web utiliza cookies para mejorar tu navegación.</p>
    <button class="cookie-consent__accept" type="button" data-cookie-consent-accept aria-label="Aceptar el uso de cookies">Aceptar</button>
  </aside>`;

/** Si otro sitio incrusta la página, sus enlaces se abren en pestaña nueva con nuestro dominio. */
export function injectFramedLinks(html) {
  if (html.includes('/assets/framed-links.js') || !/<\/body>/i.test(html)) return html;
  return html.replace(/<\/body>/i, '  <script type="module" src="/assets/framed-links.js?v=20260924-framed-1"></script>\n</body>');
}

export function injectCookieConsent(html) {
  if (html.includes('data-cookie-consent')) return html;
  if (!/<\/head>/i.test(html) || !/<\/body>/i.test(html)) return html;

  return html
    .replace(/<\/head>/i, '  <link rel="stylesheet" href="/assets/cookie-consent.css?v=20260914-2">\n</head>')
    .replace(
      /<\/body>/i,
      `${cookieConsentMarkup}\n  <script type="module" src="/assets/cookie-consent.js?v=20260914-2"></script>\n</body>`,
    );
}

const metaPixelScript = `  <!-- Meta Pixel Code -->
  <script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '1494610251215623');
  fbq('track', 'PageView');
  </script>
  <!-- End Meta Pixel Code -->`;

const metaPixelNoScript = `<noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=1494610251215623&amp;ev=PageView&amp;noscript=1"
  alt=""></noscript>`;

export function injectMetaPixel(html) {
  if (html.includes('1494610251215623')) return html;
  if (!/<\/head>/i.test(html) || !/<body\b[^>]*>/i.test(html)) return html;

  return html
    .replace(/<\/head>/i, `${metaPixelScript}\n</head>`)
    .replace(/<body\b([^>]*)>/i, `<body$1>\n  ${metaPixelNoScript}`);
}

async function listFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path, root));
    else files.push(relative(root, path).replaceAll('\\', '/'));
  }
  return files;
}

export async function buildSite(outputDirectory = join(websiteRoot, 'dist'), { adminEnvironment = 'production', adminApiBase } = {}) {
  if (!['production', 'development'].includes(adminEnvironment)) throw new Error('Entorno administrativo no permitido.');
  if (adminApiBase !== undefined && (adminEnvironment !== 'development'
    || !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/api$/.test(adminApiBase)
    || Number(new URL(adminApiBase).port) > 65535)) throw new Error('API local no permitida.');
  const developmentApi = adminApiBase ?? 'http://127.0.0.1:4174/api';
  const output = resolve(outputDirectory);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  for (const page of pages) {
    const relativePath = page.route === '/' ? 'index.html' : `${page.route.slice(1)}index.html`;
    const target = join(output, relativePath);
    await mkdir(dirname(target), { recursive: true });
    const accountPage = page.route.startsWith('/admin/') || /^\/finados\/(?:voceros|medios|emprendedores|creadoras|mfs)\/(acceso|mi-registro|restablecer|acreditacion)\/$/.test(page.route);
    const html = page.render ? page.render(accountPage ? { ...page, adminEnvironment, adminApiBase: developmentApi } : page) : renderLayout(page);
    await writeFile(target, `${html}\n`, 'utf8');
  }

  const sitemapEntries = pages
    .filter((page) => page.indexable !== false)
    .map((page) => `  <url><loc>https://complejomushucruna.com${page.route}</loc></url>`)
    .join('\n');
  await writeFile(join(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries}\n</urlset>\n`, 'utf8');

  await mkdir(join(output, 'assets'), { recursive: true });
  await cp(join(websiteRoot, 'src', 'styles.css'), join(output, 'assets', 'styles.css'));
  await cp(join(websiteRoot, 'src', 'site.js'), join(output, 'assets', 'site.js'));
  await cp(join(websiteRoot, 'src', 'stands-sale-schedule.js'), join(output, 'assets', 'stands-sale-schedule.js'));
  await cp(join(websiteRoot, 'src', 'cookie-consent.css'), join(output, 'assets', 'cookie-consent.css'));
  await cp(join(websiteRoot, 'src', 'cookie-consent.js'), join(output, 'assets', 'cookie-consent.js'));
  await cp(join(websiteRoot, 'src', 'framed-links.js'), join(output, 'assets', 'framed-links.js'));
  await cp(
    join(websiteRoot, 'src', 'media-accreditation', 'media-accreditation.css'),
    join(output, 'assets', 'media-accreditation.css'),
  );

  const publicDirectory = join(websiteRoot, 'public');
  try {
    await cp(publicDirectory, output, { recursive: true, force: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const finadosAssets = join(output, 'assets', 'finados');
  await mkdir(finadosAssets, { recursive: true });
  await execFileAsync(process.execPath, [
    join(websiteRoot, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'),
    '-i', join(websiteRoot, 'src', 'finados', 'finados.css'),
    '-o', join(finadosAssets, 'finados.css'),
    '--minify',
  ], { cwd: websiteRoot });
  await cp(join(websiteRoot, 'src', 'finados', 'finados.js'), join(finadosAssets, 'finados.js'));
  await cp(join(websiteRoot, 'src', 'finados', 'navigation.css'), join(finadosAssets, 'navigation.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'shows.css'), join(finadosAssets, 'shows.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'mfs.css'), join(finadosAssets, 'mfs.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'sponsors.css'), join(finadosAssets, 'sponsors.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'dignities-election.css'), join(finadosAssets, 'dignities-election.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'presentation.css'), join(finadosAssets, 'presentation.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'presentation.js'), join(finadosAssets, 'presentation.js'));
  await cp(join(websiteRoot, 'src', 'finados', 'voceros.css'), join(finadosAssets, 'voceros.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'voceros.js'), join(finadosAssets, 'voceros.js'));
  await cp(join(websiteRoot, 'src', 'finados', 'vocero-portal.css'), join(finadosAssets, 'vocero-portal.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'qrcode-generator.mjs'), join(finadosAssets, 'qrcode-generator.mjs'));
  await cp(join(websiteRoot, 'src', 'finados', 'runtime-origins.mjs'), join(finadosAssets, 'runtime-origins.mjs'));
  await cp(join(websiteRoot, 'src', 'finados', 'nombres-en-pantalla.css'), join(finadosAssets, 'nombres-en-pantalla.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'nombres-en-pantalla.js'), join(finadosAssets, 'nombres-en-pantalla.js'));
  await cp(join(websiteRoot, 'src', 'finados', 'vocero-verification.js'), join(finadosAssets, 'vocero-verification.js'));
  await cp(join(websiteRoot, 'src', 'finados', 'creadoras.css'), join(finadosAssets, 'creadoras.css'));
  const creadoraPortalScript = await readFile(join(websiteRoot, 'src', 'finados', 'creadora-portal.js'), 'utf8');
  await writeFile(join(finadosAssets, 'creadora-portal.js'), creadoraPortalScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');
  const portalScript = await readFile(join(websiteRoot, 'src', 'finados', 'vocero-portal.js'), 'utf8');
  await writeFile(join(finadosAssets, 'vocero-portal.js'), portalScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');

  await cp(join(websiteRoot, 'src', 'finados', 'emprendedor-verification.js'), join(finadosAssets, 'emprendedor-verification.js'));
  const emprendedorPortalScript = await readFile(join(websiteRoot, 'src', 'finados', 'emprendedor-portal.js'), 'utf8');
  await writeFile(join(finadosAssets, 'emprendedor-portal.js'), emprendedorPortalScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');

  await cp(join(websiteRoot, 'src', 'finados', 'mfs-portal.css'), join(finadosAssets, 'mfs-portal.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'mfs-verification.js'), join(finadosAssets, 'mfs-verification.js'));
  const mfsPortalScript = await readFile(join(websiteRoot, 'src', 'finados', 'mfs-portal.js'), 'utf8');
  await writeFile(join(finadosAssets, 'mfs-portal.js'), mfsPortalScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');

  await cp(join(websiteRoot, 'src', 'finados', 'media-portal.css'), join(finadosAssets, 'media-portal.css'));
  const mediaPortalScript = await readFile(join(websiteRoot, 'src', 'finados', 'media-portal.js'), 'utf8');
  await writeFile(join(finadosAssets, 'media-portal.js'), mediaPortalScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');

  const adminAssets = join(output, 'assets', 'admin');
  await mkdir(adminAssets, { recursive: true });
  await execFileAsync(process.execPath, [
    join(websiteRoot, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'),
    '-i', join(websiteRoot, 'src', 'admin', 'admin.css'),
    '-o', join(adminAssets, 'admin.css'), '--minify',
  ], { cwd: websiteRoot });
  // El plegado del menú lateral lo comparten las cuatro pantallas administrativas.
  await copyFile(join(websiteRoot, 'src', 'admin', 'sidebar.js'), join(adminAssets, 'sidebar.js'));
  // La banda del tema central la comparten todos los paneles y, como ellos, no lleva la API local a producción.
  const campaignBannerScript = await readFile(join(websiteRoot, 'src', 'admin', 'campaign-banner.js'), 'utf8');
  await writeFile(join(adminAssets, 'campaign-banner.js'), campaignBannerScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');
  const adminNoticiasScript = await readFile(join(websiteRoot, 'src', 'admin', 'admin-noticias.js'), 'utf8');
  await writeFile(join(adminAssets, 'admin-noticias.js'), adminNoticiasScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');
  const adminScript = await readFile(join(websiteRoot, 'src', 'admin', 'admin.js'), 'utf8');
  await writeFile(join(adminAssets, 'admin.js'), adminEnvironment === 'production'
    ? adminScript.replace("const LOCAL_API = 'http://127.0.0.1:4174/api';", 'const LOCAL_API = null;')
    : adminScript.replace("const LOCAL_API = 'http://127.0.0.1:4174/api';", `const LOCAL_API = '${developmentApi}';`), 'utf8');

  const adminPanelScript = await readFile(join(websiteRoot, 'src', 'admin', 'panel.js'), 'utf8');
  await writeFile(join(adminAssets, 'panel.js'), adminPanelScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');

  const adminEmprendedorScript = await readFile(join(websiteRoot, 'src', 'admin', 'admin-emprendedores.js'), 'utf8');
  await writeFile(join(adminAssets, 'admin-emprendedores.js'), adminEmprendedorScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');

  const adminMfsScript = await readFile(join(websiteRoot, 'src', 'admin', 'admin-mfs.js'), 'utf8');
  await writeFile(join(adminAssets, 'admin-mfs.js'), adminMfsScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');

  const adminCreadorasScript = await readFile(join(websiteRoot, 'src', 'admin', 'admin-creadoras.js'), 'utf8');
  await writeFile(join(adminAssets, 'admin-creadoras.js'), adminCreadorasScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');

  const adminMediaPlanScript = await readFile(join(websiteRoot, 'src', 'admin', 'admin-medios-calendario.js'), 'utf8');
  await writeFile(join(adminAssets, 'admin-medios-calendario.js'), adminMediaPlanScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');

  const adminMediaScript = await readFile(join(websiteRoot, 'src', 'admin', 'admin-medios.js'), 'utf8');
  await writeFile(join(adminAssets, 'admin-medios.js'), adminMediaScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');

  const htmlFiles = (await listFiles(output)).filter((file) => file.endsWith('.html'));
  for (const htmlFile of htmlFiles) {
    const accountPage = htmlFile.startsWith('admin/') || /^finados\/(?:voceros|medios|emprendedores|creadoras|mfs)\/(acceso|mi-registro|restablecer|acreditacion)\//.test(htmlFile);
    if (accountPage) continue;
    const path = join(output, htmlFile);
    const html = await readFile(path, 'utf8');
    const route = `/${htmlFile.replace(/index\.html$/, '')}`;
    let updatedHtml = injectFramedLinks(injectCookieConsent(injectInvitationOpeningHeader(html, route)));
    if (!/^finados\/(?:voceros|emprendedores|mfs)\/verificar\//.test(htmlFile)) updatedHtml = injectMetaPixel(updatedHtml);
    await writeFile(path, updatedHtml, 'utf8');
  }

  // Rendimiento: los módulos que se importan sin versión (?v=) reciben una con el hash de su contenido,
  // así el navegador los guarda sin volver a preguntar y se renuevan solos cuando cambian.
  await versionUnversionedImports(output);

  // Rendimiento: cada página anuncia desde el <head> todo su árbol de módulos, para que el navegador
  // los descargue a la vez y no en cadena. Las páginas administrativas además adelantan su fuente y
  // la conexión con la API mientras cargan los módulos.
  for (const htmlFile of (await listFiles(output)).filter((file) => file.endsWith('.html'))) {
    const path = join(output, htmlFile);
    const html = await readFile(path, 'utf8');
    const updated = await injectPerformanceHints(html, output);
    if (updated !== html) await writeFile(path, updated, 'utf8');
  }

  return (await listFiles(output)).sort();
}

const UNVERSIONED_IMPORT = /((?:\bfrom\s*|\bimport\s*)['"])(\.{1,2}\/[^'"?#]+\.m?js)(['"])/g;

export async function versionUnversionedImports(output) {
  const assets = (await listFiles(output)).filter((file) => file.startsWith('assets/') && /\.m?js$/.test(file));
  const hashes = new Map();
  const hashOf = async (file) => {
    if (!hashes.has(file)) hashes.set(file, createHash('sha256').update(await readFile(join(output, file))).digest('hex').slice(0, 10));
    return hashes.get(file);
  };
  for (const file of assets) {
    const path = join(output, file);
    const source = await readFile(path, 'utf8');
    let changed = source;
    for (const match of [...source.matchAll(UNVERSIONED_IMPORT)]) {
      const target = join(dirname(file), match[2]).split('\\').join('/');
      // Solo dependencias que no importan otras sin versión: su hash ya es definitivo.
      const targetSource = await readFile(join(output, target), 'utf8').catch(() => null);
      if (targetSource === null || [...targetSource.matchAll(UNVERSIONED_IMPORT)].length) continue;
      changed = changed.replace(match[0], `${match[1]}${match[2]}?v=${await hashOf(target)}${match[3]}`);
    }
    if (changed !== source) await writeFile(path, changed, 'utf8');
  }
}

const STATIC_IMPORT = /(?:^|[;\n}])\s*import\s+(?:[\w*{}\s,$]+?\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g;

/** Todas las dependencias estáticas de un módulo, con la URL exacta (y su ?v=) con la que se importan. */
export async function moduleGraph(entry, output, seen = new Set()) {
  if (seen.has(entry)) return seen;
  seen.add(entry);
  const url = new URL(entry, 'https://build.invalid');
  let source;
  try { source = await readFile(join(output, decodeURIComponent(url.pathname)), 'utf8'); } catch { return seen; }
  for (const match of source.matchAll(STATIC_IMPORT)) {
    const dependency = new URL(match[1], url);
    await moduleGraph(`${dependency.pathname}${dependency.search}`, output, seen);
  }
  return seen;
}

export async function injectPerformanceHints(html, output) {
  if (html.includes('<!-- performance-hints -->')) return html;
  const entries = [...html.matchAll(/<script type="module" src="(\/[^"]+)"/g)].map((match) => match[1]);
  const modules = new Set();
  for (const entry of entries) for (const item of await moduleGraph(entry, output)) modules.add(item);
  const hints = [];
  const apiBase = /<meta name="admin-api-base" content="([^"]+)"/.exec(html)?.[1];
  if (apiBase) {
    for (const origin of new Set([new URL(apiBase).origin, new URL(MIRROR_API_BASE).origin])) hints.push(`<link rel="preconnect" href="${origin}" crossorigin="use-credentials">`);
    const font = '/assets/finados/fonts/inter-variable-latin.woff2';
    if (await readFile(join(output, font)).then(() => true, () => false)) hints.push(`<link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin>`);
  }
  for (const item of modules) hints.push(`<link rel="modulepreload" href="${item}">`);
  if (!hints.length) return html;
  const block = `<!-- performance-hints -->${hints.join('')}`;
  const firstScript = html.search(/<script type="module" src="\//);
  const headEnd = html.indexOf('</head>');
  const at = firstScript !== -1 && (headEnd === -1 || firstScript < headEnd) ? firstScript : headEnd;
  return at === -1 ? html : `${html.slice(0, at)}${block}\n${html.slice(at)}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await buildSite();
  console.log(`Sitio construido: ${files.length} archivos`);
}
