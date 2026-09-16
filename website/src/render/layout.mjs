import { site, socialLinks } from '../data/site.mjs';
import { renderFinadosFooter } from '../finados/footer.mjs';
import { escapeHtml, externalAttributes } from './html.mjs';
import { renderPrimaryNavigation } from './navigation.mjs';

const institutionalAssetVersion = '20260904';
const homeAssetVersion = '20260909';
const stylesVersion = '20260916-3';
const siteRuntimeVersion = '20260916-1';

export function renderLayout(page) {
  const isHome = page.route === '/';
  const isFinadosTheme = page.designSystem === 'finados';
  const hasFinadosHeader = isHome || page.headerVariant === 'finados';
  const bodyClass = [isHome ? 'home-page' : '', page.bodyClass ?? ''].filter(Boolean).join(' ');
  const canonical = `${site.baseUrl}${page.route}`;
  const title = page.route === '/' ? `${site.name} | ${site.tagline}` : `${page.title} | ${site.name}`;
  const social = socialLinks.map((item) => `<a href="${escapeHtml(item.href)}"${externalAttributes(item.href)}>${escapeHtml(item.label)}</a>`).join('');
  const brand = isFinadosTheme
    ? '<img src="/assets/finados/logo-finados.svg?v=20260903" width="766" height="449" alt="Finados 2026, legado que nos une">'
    : hasFinadosHeader
    ? `<img src="/assets/icons/logo-complejo.svg?v=${homeAssetVersion}" width="1800" height="1800" alt="Complejo Intercultural y Deportivo Mushuc Runa">`
    : '<img src="/assets/images/logo-complejo-dorado.png" width="289" height="137" alt="Complejo Intercultural y Deportivo Mushuc Runa">';
  const footer = page.footerVariant === 'finados'
    ? renderFinadosFooter()
    : `<footer class="site-footer">
    <div class="shell site-footer__grid">
      <div><p class="site-footer__name">${escapeHtml(site.legalName)}</p><p>${escapeHtml(site.description)}</p></div>
      <div><p class="site-footer__title">Explora</p><ul>${renderPrimaryNavigation('')}</ul></div>
      <div><p class="site-footer__title">Conecta</p><div class="social-links">${social}</div></div>
    </div>
    <p class="site-footer__note">Consulta horarios, precios y disponibilidad en los canales oficiales antes de viajar.</p>
  </footer>`;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="google-site-verification" content="nEfLh1DS-VLhCWOMJGp2cLwFXuBijd9P7KrWpk85fLQ">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(page.description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  ${isFinadosTheme
    ? '<meta name="theme-color" content="#241146"><link rel="icon" href="/assets/finados/favicon-finados.png" type="image/png" sizes="256x256">'
    : `<link rel="icon" href="/assets/icons/logo-complejo-mushuc-runa.svg?v=${institutionalAssetVersion}" type="image/svg+xml">`}
  ${page.heroImage || isHome ? `<link rel="preload" as="image" href="${page.heroImage ?? '/assets/finados/expositor-artesanias.webp'}" fetchpriority="high">` : ''}
  ${isFinadosTheme
    ? '<link rel="stylesheet" href="/assets/finados/finados.css?v=20260916-7">'
    : `<link rel="stylesheet" href="/assets/styles.css?v=${stylesVersion}">`}
  ${page.stylesheet ? `<link rel="stylesheet" href="${page.stylesheet}">` : ''}
  ${hasFinadosHeader ? '<link rel="stylesheet" href="/assets/finados/navigation.css?v=20260916-8">' : ''}
  <script type="module" src="/assets/site.js?v=${siteRuntimeVersion}"></script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  ${hasFinadosHeader ? '<div class="home-chumbi" aria-hidden="true"></div>' : ''}
  <header class="site-header${hasFinadosHeader ? ' site-header--finados' : ''}">
    <a class="brand" href="/" aria-label="Complejo Mushuc Runa, inicio">
      ${brand}
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="navegacion-principal"><span></span><span></span><span></span><span class="sr-only">Abrir menú</span></button>
    <nav id="navegacion-principal" class="main-nav" aria-label="Navegación principal"><ul>${renderPrimaryNavigation(page.route)}</ul></nav>
  </header>
  <main id="contenido">${page.body}</main>
  ${footer}
</body>
</html>`;
}
