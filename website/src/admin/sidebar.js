// Los grupos del menú administrativo (hoy Medios → Seguimiento, Eventos y Calendario) llegan
// desplegados en el HTML para que funcionen sin JavaScript. Aquí se pliegan salvo el grupo de la
// página actual. La sección es solo un botón: cada clic abre o cierra sus opciones y nunca navega.

/** Un grupo está abierto cuando la página actual es una de sus opciones. */
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
      event.preventDefault();
      const open = parent.getAttribute('aria-expanded') !== 'true';
      apply(parent, children, open);
      if (open) children.querySelector('a')?.focus();
    });
  }
}

if (typeof document !== 'undefined') initializeAdminSidebar();
