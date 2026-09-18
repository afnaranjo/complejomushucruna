import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { pages } from '../src/pages.mjs';
import { renderLayout } from '../src/render/layout.mjs';
import { injectInvitationOpeningHeader } from '../src/finados/opening-header.mjs';

const websiteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const execFileAsync = promisify(execFile);

const cookieConsentMarkup = `  <aside class="cookie-consent" data-cookie-consent hidden role="region" aria-label="Preferencias de cookies">
    <p class="cookie-consent__message">Nuestro sitio web utiliza cookies para mejorar tu navegación.</p>
    <button class="cookie-consent__accept" type="button" data-cookie-consent-accept aria-label="Aceptar el uso de cookies">Aceptar</button>
  </aside>`;

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
    const accountPage = page.route.startsWith('/admin/') || /^\/finados\/voceros\/(acceso|mi-registro|restablecer)\/$/.test(page.route);
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
  await cp(join(websiteRoot, 'src', 'finados', 'sponsors.css'), join(finadosAssets, 'sponsors.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'presentation.css'), join(finadosAssets, 'presentation.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'presentation.js'), join(finadosAssets, 'presentation.js'));
  await cp(join(websiteRoot, 'src', 'finados', 'voceros.css'), join(finadosAssets, 'voceros.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'voceros.js'), join(finadosAssets, 'voceros.js'));
  await cp(join(websiteRoot, 'src', 'finados', 'vocero-portal.css'), join(finadosAssets, 'vocero-portal.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'qrcode-generator.mjs'), join(finadosAssets, 'qrcode-generator.mjs'));
  await cp(join(websiteRoot, 'src', 'finados', 'runtime-origins.mjs'), join(finadosAssets, 'runtime-origins.mjs'));
  await cp(join(websiteRoot, 'src', 'finados', 'vocero-verification.js'), join(finadosAssets, 'vocero-verification.js'));
  const portalScript = await readFile(join(websiteRoot, 'src', 'finados', 'vocero-portal.js'), 'utf8');
  await writeFile(join(finadosAssets, 'vocero-portal.js'), portalScript.replace(
    "const LOCAL_API = 'http://127.0.0.1:4174/api';",
    adminEnvironment === 'production' ? 'const LOCAL_API = null;' : `const LOCAL_API = '${developmentApi}';`), 'utf8');

  const adminAssets = join(output, 'assets', 'admin');
  await mkdir(adminAssets, { recursive: true });
  await execFileAsync(process.execPath, [
    join(websiteRoot, 'node_modules', '@tailwindcss', 'cli', 'dist', 'index.mjs'),
    '-i', join(websiteRoot, 'src', 'admin', 'admin.css'),
    '-o', join(adminAssets, 'admin.css'), '--minify',
  ], { cwd: websiteRoot });
  const adminScript = await readFile(join(websiteRoot, 'src', 'admin', 'admin.js'), 'utf8');
  await writeFile(join(adminAssets, 'admin.js'), adminEnvironment === 'production'
    ? adminScript.replace("const LOCAL_API = 'http://127.0.0.1:4174/api';", 'const LOCAL_API = null;')
    : adminScript.replace("const LOCAL_API = 'http://127.0.0.1:4174/api';", `const LOCAL_API = '${developmentApi}';`), 'utf8');

  const htmlFiles = (await listFiles(output)).filter((file) => file.endsWith('.html'));
  for (const htmlFile of htmlFiles) {
    if (htmlFile.startsWith('admin/') || /^finados\/voceros\/(acceso|mi-registro|restablecer)\//.test(htmlFile)) continue;
    const path = join(output, htmlFile);
    const html = await readFile(path, 'utf8');
    const route = `/${htmlFile.replace(/index\.html$/, '')}`;
    await writeFile(path, injectCookieConsent(injectInvitationOpeningHeader(html, route)), 'utf8');
  }

  return (await listFiles(output)).sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await buildSite();
  console.log(`Sitio construido: ${files.length} archivos`);
}
