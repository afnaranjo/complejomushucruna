import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { pages } from '../src/pages.mjs';
import { renderLayout } from '../src/render/layout.mjs';

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

export async function buildSite(outputDirectory = join(websiteRoot, 'dist')) {
  const output = resolve(outputDirectory);
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  for (const page of pages) {
    const relativePath = page.route === '/' ? 'index.html' : `${page.route.slice(1)}index.html`;
    const target = join(output, relativePath);
    await mkdir(dirname(target), { recursive: true });
    const html = page.render ? page.render(page) : renderLayout(page);
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
  await cp(join(websiteRoot, 'src', 'finados', 'voceros.css'), join(finadosAssets, 'voceros.css'));
  await cp(join(websiteRoot, 'src', 'finados', 'voceros.js'), join(finadosAssets, 'voceros.js'));

  const htmlFiles = (await listFiles(output)).filter((file) => file.endsWith('.html'));
  for (const htmlFile of htmlFiles) {
    const path = join(output, htmlFile);
    const html = await readFile(path, 'utf8');
    await writeFile(path, injectCookieConsent(html), 'utf8');
  }

  return (await listFiles(output)).sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = await buildSite();
  console.log(`Sitio construido: ${files.length} archivos`);
}
