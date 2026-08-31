import { primaryNavigation, site, socialLinks } from '../data/site.mjs';
import { escapeHtml, externalAttributes } from './html.mjs';

function navigation(currentRoute) {
  return primaryNavigation.map((item) => {
    const current = item.href === currentRoute ? ' aria-current="page"' : '';
    return `<li><a href="${item.href}"${current}>${escapeHtml(item.label)}</a></li>`;
  }).join('');
}

export function renderLayout(page) {
  const canonical = `${site.baseUrl}${page.route}`;
  const title = page.route === '/' ? `${site.name} | ${site.tagline}` : `${page.title} | ${site.name}`;
  const social = socialLinks.map((item) => `<a href="${escapeHtml(item.href)}"${externalAttributes(item.href)}>${escapeHtml(item.label)}</a>`).join('');

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
  <link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/styles.css">
  <script src="/assets/site.js" defer></script>
</head>
<body>
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  <header class="site-header">
    <a class="brand" href="/" aria-label="Complejo Mushuc Runa, inicio">
      <img src="/assets/images/logo-complejo-dorado.png" width="289" height="137" alt="Complejo Intercultural y Deportivo Mushuc Runa">
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
