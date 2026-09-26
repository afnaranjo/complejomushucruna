import { resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';

// Los grupos del menú administrativo (Medios, Producción, Creadoras) llegan desplegados en el HTML
// para que funcionen sin JavaScript. Aquí se pliegan salvo el grupo de la página actual. La sección
// es solo un botón: cada clic abre o cierra sus opciones y nunca navega.
//
// Además, cada persona ve solo los módulos de su rol: el menú oculta los demás y, si alguien abre una
// sección que no le corresponde, lo lleva a su portada. El servidor igual rechaza esas peticiones.

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

/** Si el rol ve ese módulo. «*» es el rol que ve todo, incluidos los módulos nuevos. */
export function canSee(user, module) {
  if (!module) return true;
  const modules = Array.isArray(user?.modules) ? user.modules : [];
  return modules.includes('*') || modules.includes(module);
}

/**
 * Aplica el rol al menú: oculta lo que no ve y devuelve a dónde llevar a la persona si la página
 * actual no es de su rol (o null si puede quedarse).
 */
export function applyAccess(aside, user) {
  if (!aside || !user) return null;
  for (const item of aside.querySelectorAll('[data-module]')) item.hidden = !canSee(user, item.dataset.module);
  const name = aside.querySelector('[data-admin-sidebar-user]');
  if (name && user.full_name) name.textContent = user.full_name;
  const role = aside.querySelector('[data-admin-sidebar-role]');
  if (role) role.textContent = user.role ? `Rol: ${user.role}` : '';
  aside.dataset.access = 'ready';
  const current = aside.dataset.currentModule;
  return current && !canSee(user, current) ? (user.home || '/admin/') : null;
}

async function loadAccess(root) {
  const aside = root.querySelector?.('.admin-sidebar[data-access]');
  if (!aside) return;
  // Si no se puede saber el rol, el menú se muestra igual: cada página y el servidor siguen protegidos.
  const reveal = () => { aside.dataset.access = 'ready'; };
  try {
    const location = globalThis.location;
    const configured = root.querySelector('meta[name="admin-api-base"]')?.content;
    const runtime = resolveRuntimeOrigins(location);
    const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configured || runtime.apiBase;
    const response = await fetch(`${base}/auth/session`, { credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } });
    if (!response.ok) { reveal(); return; }
    const data = await response.json();
    if (!data.authenticated) { reveal(); return; }
    const target = applyAccess(aside, data.user);
    if (target && target !== location.pathname) location.replace(target);
  } catch { reveal(); }
}

if (typeof document !== 'undefined') {
  initializeAdminSidebar();
  loadAccess(document);
}
