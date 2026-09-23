// Los grupos del menú administrativo (hoy Medios → Eventos) llegan desplegados en el HTML para que
// funcionen sin JavaScript. Aquí se pliegan salvo el grupo de la página actual: el primer clic en la
// sección abre sus opciones y el siguiente ya navega a la sección.

/** Un grupo está abierto cuando la página actual es la sección o una de sus opciones. */
export function groupIsCurrent(group) {
  return Boolean(group?.querySelector?.('[aria-current="page"]'));
}

function apply(parent, children, expanded) {
  parent.setAttribute('aria-expanded', String(expanded));
  children.hidden = !expanded;
}

export function initializeAdminSidebar(root = typeof document === 'undefined' ? null : document) {
  const groups = root?.querySelectorAll?.('[data-nav-group]');
  if (!groups?.length) return;
  for (const group of groups) {
    const parent = group.querySelector('[data-nav-parent]');
    const children = group.querySelector('[data-nav-children]');
    if (!parent || !children) continue;
    apply(parent, children, groupIsCurrent(group));
    parent.addEventListener('click', event => {
      // Ya desplegado: el enlace hace lo suyo y lleva a la sección.
      if (parent.getAttribute('aria-expanded') === 'true') return;
      event.preventDefault();
      apply(parent, children, true);
      children.querySelector('a')?.focus();
    });
  }
}

if (typeof document !== 'undefined') initializeAdminSidebar();
