import { escapeHtml } from '../render/html.mjs';

export const finadosSubnavigation = Object.freeze([
  { label: 'Programación artística', href: '/finados/#artistas' },
  { label: 'Dignidades 2025', href: '/finados/dignidades-finados-2025/' },
]);

export function renderFinadosNavigation({ currentRoute = '', showComplexLink = true } = {}) {
  const submenu = finadosSubnavigation.map((item) => {
    const current = item.href.split('#')[0] === currentRoute ? ' aria-current="page"' : '';
    return `<li><a href="${escapeHtml(item.href)}"${current}>${escapeHtml(item.label)}</a></li>`;
  }).join('');

  return `<nav class="campaign-nav" aria-label="Navegación de Finados">
    <div class="campaign-submenu" data-campaign-submenu>
      <a class="campaign-submenu__home" href="/finados/"${currentRoute === '/finados/' ? ' aria-current="page"' : ''}>Finados 2026</a>
      <button class="campaign-submenu__toggle" type="button" aria-expanded="false" aria-controls="finados-subpaginas" data-campaign-submenu-toggle>
        <span class="sr-only">Mostrar páginas de Finados 2026</span>
        <span aria-hidden="true">⌄</span>
      </button>
      <ul class="campaign-submenu__list" id="finados-subpaginas">${submenu}</ul>
    </div>
    ${showComplexLink ? '<a class="campaign-nav__complex" href="/">Volver al Complejo</a>' : ''}
  </nav>`;
}
