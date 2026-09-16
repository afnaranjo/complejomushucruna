import { primaryNavigation } from '../data/site.mjs';
import { renderPrimaryNavigation } from '../render/navigation.mjs';

export const finadosSubnavigation = Object.freeze(
  primaryNavigation.find((item) => item.href === '/finados/')?.children ?? [],
);

export function renderFinadosNavigation({ currentRoute = '' } = {}) {
  return `<nav id="navegacion-principal" class="main-nav" aria-label="Navegación principal"><ul>${renderPrimaryNavigation(currentRoute)}</ul></nav>`;
}
