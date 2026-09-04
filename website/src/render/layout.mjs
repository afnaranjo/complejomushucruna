import { primaryNavigation, site, socialLinks } from '../data/site.mjs';
import { escapeHtml, externalAttributes } from './html.mjs';

const institutionalAssetVersion = '20260904';
const homeAssetVersion = '20260904-2';
const hiddenNavigationRoutes = new Set(['/experiencias/', '/eventos/']);

function navigation(currentRoute) {
  return primaryNavigation.filter((item) => !hiddenNavigationRoutes.has(item.href)).map((item) => {
    const current = item.href === currentRoute ? ' aria-current="page"' : '';
    return `<li><a href="${item.href}"${current}>${escapeHtml(item.label)}</a></li>`;
  }).join('');
}

export function renderLayout(page) {
  const isHome = page.route === '/';
  const canonical = `${site.baseUrl}${page.route}`;
  const title = page.route === '/' ? `${site.name} | ${site.tagline}` : `${page.title} | ${site.name}`;
  const social = socialLinks.map((item) => `<a href="${escapeHtml(item.href)}"${externalAttributes(item.href)}>${escapeHtml(item.label)}</a>`).join('');
  const brand = isHome
    ? `<img src="/assets/icons/logo-complejo.svg?v=${homeAssetVersion}" width="1800" height="1800" alt="Complejo Intercultural y Deportivo Mushuc Runa">`
    : '<img src="/assets/images/logo-complejo-dorado.png" width="289" height="137" alt="Complejo Intercultural y Deportivo Mushuc Runa">';

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <link rel="icon" href="/assets/icons/logo-complejo-mushuc-runa.svg?v=${institutionalAssetVersion}" type="image/svg+xml">
  ${isHome ? '<link rel="preload" as="image" href="/assets/finados/expositor-artesanias.webp" fetchpriority="high">' : ''}
  <link rel="stylesheet" href="/assets/styles.css?v=${homeAssetVersion}">
  <script type="module" src="/assets/site.js"></script>
</head>
<body${isHome ? ' class="home-page"' : ''}>
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  ${isHome ? '<div class="home-chumbi" aria-hidden="true"></div>' : ''}
  <header class="site-header${isHome ? ' site-header--finados' : ''}">
    <a class="brand" href="/" aria-label="Complejo Mushuc Runa, inicio">
      ${brand}
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="navegacion-principal"><span></span><span></span><span></span><span class="sr-only">Abrir menú</span></button>
    <nav id="navegacion-principal" class="main-nav" aria-label="Navegación principal"><ul>${navigation(page.route)}</ul></nav>
  </header>
  <main id="contenido">${page.body}</main>
  <footer class="site-footer">
    <div class="shell site-footer__grid">
      <div><p class="site-footer__name">${escapeHtml(site.legalName)}</p><p>${escapeHtml(site.description)}</p></div>
      <div><p class="site-footer__title">Explora</p><ul>${navigation('')}</ul></div>
      <div><p class="site-footer__title">Conecta</p><div class="social-links">${social}</div></div>
    </div>
    <p class="site-footer__note">Consulta horarios, precios y disponibilidad en los canales oficiales antes de viajar.</p>
  </footer>
</body>
</html>`;
}
