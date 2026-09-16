import { primaryNavigation } from '../data/site.mjs';
import { escapeHtml, externalAttributes } from './html.mjs';

const topLevelTones = Object.freeze(['winay', 'fuchsia', 'cyan', 'purple', 'poncho', 'lienzo']);

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
  return primaryNavigation.map((item, index) => {
    const itemIsCurrent = routeMatches(item.href, currentRoute)
      || item.children?.some((child) => routeMatches(child.href, currentRoute, { child }));
    const current = itemIsCurrent ? ' aria-current="page"' : '';
    const actionClass = item.emphasis
      ? ` class="main-nav__action main-nav__action--${escapeHtml(item.emphasis)}"`
      : '';
    const purchaseLink = item.emphasis === 'stands' ? ' data-stands-purchase-link' : '';
    const children = item.children?.length
      ? `<button class="main-nav__submenu-toggle" type="button" aria-expanded="false" aria-label="Mostrar páginas de ${escapeHtml(item.label)}" data-submenu-toggle><span aria-hidden="true">⌄</span></button>
        <ul class="main-nav__submenu">${item.children.map((child) => {
          const childCurrent = routeMatches(child.href, currentRoute, { child }) ? ' aria-current="page"' : '';
          const childActionClass = child.emphasis
            ? ` class="main-nav__action main-nav__action--${escapeHtml(child.emphasis)}"`
            : '';
          const childPurchaseLink = child.emphasis === 'stands' ? ' data-stands-purchase-link' : '';
          return `<li><a${childActionClass} href="${escapeHtml(child.href)}"${childPurchaseLink}${childCurrent}${externalAttributes(child.href)}>${escapeHtml(child.label)}</a></li>`;
        }).join('')}</ul>`
      : '';
    const tone = topLevelTones[index % topLevelTones.length];
    const itemClasses = ['main-nav__item', `main-nav__item--tone-${tone}`];
    if (children) itemClasses.push('main-nav__item--has-submenu');
    const itemAttributes = ` class="${itemClasses.join(' ')}"${children ? ' data-submenu' : ''}`;
    return `<li${itemAttributes}><a${actionClass} href="${escapeHtml(item.href)}"${purchaseLink}${current}${externalAttributes(item.href)}>${escapeHtml(item.label)}</a>${children}</li>`;
  }).join('');
}
