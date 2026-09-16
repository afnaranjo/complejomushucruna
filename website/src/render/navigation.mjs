import { primaryNavigation } from '../data/site.mjs';
import { escapeHtml, externalAttributes } from './html.mjs';

function routeMatches(href, currentRoute, { child = false } = {}) {
  const route = String(currentRoute || '').split('#')[0];
  const base = String(href || '').split('#')[0];
  if (!base.startsWith('/')) return href === currentRoute;
  if (base === '/') return route === '/';
  // The programming anchor belongs to the Finados landing, not every child page.
  if (child && base === '/finados/') return route === '/finados/';
  return route === base || route.startsWith(base);
}

export function renderPrimaryNavigation(currentRoute = '') {
  return primaryNavigation.map((item) => {
    const current = routeMatches(item.href, currentRoute) ? ' aria-current="page"' : '';
    const actionClass = item.emphasis
      ? ` class="main-nav__action main-nav__action--${escapeHtml(item.emphasis)}"`
      : '';
    const purchaseLink = item.emphasis === 'stands' ? ' data-stands-purchase-link' : '';
    const children = item.children?.length
      ? `<button class="main-nav__submenu-toggle" type="button" aria-expanded="false" aria-label="Mostrar páginas de ${escapeHtml(item.label)}" data-submenu-toggle><span aria-hidden="true">⌄</span></button>
        <ul class="main-nav__submenu">${item.children.map((child) => {
          const childCurrent = routeMatches(child.href, currentRoute, { child }) ? ' aria-current="page"' : '';
          return `<li><a href="${escapeHtml(child.href)}"${childCurrent}${externalAttributes(child.href)}>${escapeHtml(child.label)}</a></li>`;
        }).join('')}</ul>`
      : '';
    const itemClass = children ? ' class="main-nav__item main-nav__item--has-submenu" data-submenu' : '';
    return `<li${itemClass}><a${actionClass} href="${escapeHtml(item.href)}"${purchaseLink}${current}${externalAttributes(item.href)}>${escapeHtml(item.label)}</a>${children}</li>`;
  }).join('');
}
