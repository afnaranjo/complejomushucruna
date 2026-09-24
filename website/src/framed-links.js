// Cuando otro sitio muestra una página nuestra dentro de un marco (por ejemplo, la portada en
// Mushuc Ticket), cada enlace se abre en una pestaña nueva con nuestro dominio real, en vez de
// navegar dentro del marco ajeno. Si la página se abre directamente, este script no hace nada.

/** true solo cuando la página vive dentro de un marco. */
export function isFramed(view = globalThis.window) {
  try { return Boolean(view) && view.self !== view.top; }
  catch { return true; } // Un marco de otro origen puede impedir leer `top`: igual está incrustada.
}

/**
 * Decide si un clic en un enlace debe salir del marco. Se respeta el comportamiento propio de la
 * página: los submenús que se abren con el primer toque, los saltos dentro de la misma página y
 * los enlaces que ya abren otra pestaña.
 */
export function shouldOpenOutside(link, currentUrl) {
  if (!link || link.hasAttribute('download')) return false;
  const target = (link.getAttribute('target') ?? '').toLowerCase();
  if (target && target !== '_self') return false;
  const raw = link.getAttribute('href') ?? '';
  if (raw === '' || raw.startsWith('#')) return false;
  let url;
  try { url = new URL(link.href, currentUrl); } catch { return false; }
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  const current = new URL(currentUrl);
  // Un salto dentro de la misma página se queda en el marco.
  if (url.origin === current.origin && url.pathname === current.pathname && url.search === current.search && url.hash) return false;
  return true;
}

export function setupFramedLinks(root = globalThis.document, view = globalThis.window) {
  if (!root || !isFramed(view)) return false;
  // Se escucha en la fase de burbuja: si el menú ya usó el clic para abrir un submenú, no se toca.
  root.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target?.closest?.('a[href]');
    if (!shouldOpenOutside(link, view.location.href)) return;
    event.preventDefault();
    view.open(link.href, '_blank', 'noopener');
  });
  return true;
}

if (typeof document !== 'undefined') setupFramedLinks();
