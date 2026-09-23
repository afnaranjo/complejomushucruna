import { resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
// The panel reuses the administrative client: same allowlist, same CSRF handling, one bundle less.
import { createMediaAdminClient } from './admin-medios.js';
import './sidebar.js?v=20260923-admin-sidebar-1';
import './campaign-banner.js?v=20260923-noticias-1';

const LOCAL_API = 'http://127.0.0.1:4174/api';

/** Every card keeps the list behind its figure, so a click only expands what is already loaded. */
export function panelCards(section = {}) {
  return (section.cards ?? []).map(card => ({ key: String(card.key ?? ''), label: String(card.label ?? ''), items: Array.isArray(card.items) ? card.items : [], count: Array.isArray(card.items) ? card.items.length : 0 }));
}

export function eventLabel(event = {}) {
  const date = typeof event.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.event_date)
    ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${event.event_date}T00:00:00Z`))
    : 'Fecha por confirmar';
  return [date, event.place].filter(Boolean).join(' · ');
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}

export async function initializeAdminPanel() {
  const panel = document.querySelector('[data-admin-panel]');
  if (!panel) return;
  const navigation = document.querySelector('[data-admin-navigation]');
  const compact = globalThis.matchMedia?.('(max-width: 1120px)');
  const applyNavigation = value => { if (navigation) navigation.open = !value; };
  applyNavigation(compact?.matches ?? false);
  compact?.addEventListener('change', event => applyNavigation(event.matches));
  const query = selector => panel.querySelector(selector);
  const status = query('[data-admin-feedback]');
  const retry = query('[data-session-retry]');
  const configuredBase = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredBase || runtime.apiBase;
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) { status.textContent = 'La configuración de acceso no es válida.'; status.dataset.error = 'true'; return; }
  const client = createMediaAdminClient(base);
  const logout = document.querySelector('[data-admin-logout]');
  const sidebarUser = document.querySelector('[data-admin-sidebar-user]');
  const feedback = (element, message, kind = '') => { element.textContent = message; element.dataset.error = String(kind === 'error'); element.dataset.success = String(kind === 'success'); };
  const fail = error => { if (error.status === 401) { location.replace('/admin/'); return; } feedback(status, error.message, 'error'); };

  /** A group of figures with one shared, collapsed list underneath. */
  function renderGroup(container, cards, { detailLink = null } = {}) {
    container.replaceChildren();
    if (!cards.length) { container.append(node('p', 'Todavía no hay datos.', 'admin-panel-empty')); return; }
    const numbers = node('div', undefined, 'admin-big-numbers');
    const drawer = node('section', undefined, 'admin-panel-drawer');
    drawer.hidden = true;
    let active = '';
    const close = () => { active = ''; drawer.hidden = true; drawer.replaceChildren(); for (const button of numbers.querySelectorAll('button')) button.setAttribute('aria-pressed', 'false'); };
    for (const card of cards) {
      const button = node('button', undefined, 'admin-big-number'); button.type = 'button';
      button.dataset.bucket = card.key; button.setAttribute('aria-pressed', 'false');
      button.dataset.alert = String(card.key.includes('sin_publicacion') || card.key === 'no_asistieron');
      button.append(node('strong', String(card.count)), node('span', card.label));
      button.addEventListener('click', () => {
        if (active === card.key) { close(); return; }
        active = card.key;
        for (const other of numbers.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other.dataset.bucket === card.key));
        drawer.replaceChildren();
        const heading = node('div', undefined, 'records-heading');
        heading.append(node('h3', card.label), node('p', card.count === 1 ? '1 registro' : `${card.count} registros`));
        drawer.append(heading);
        if (!card.items.length) drawer.append(node('p', 'Ningún registro en este grupo.'));
        else {
          const list = node('ol', undefined, 'admin-panel-list');
          for (const item of card.items) {
            const row = node('li');
            const body = node('div');
            body.append(node('strong', item.name ?? '—'));
            if (item.detail) body.append(node('small', item.detail));
            row.append(body);
            if (typeof item.url === 'string' && item.url.startsWith('https://')) {
              const link = node('a', 'Ver publicación'); link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; row.append(link);
            } else if (detailLink && /^[a-f0-9]{32}$/.test(item.public_id ?? '')) {
              const link = node('a', 'Ver detalle'); link.href = detailLink; row.append(link);
            }
            list.append(row);
          }
          drawer.append(list);
        }
        drawer.hidden = false;
        drawer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      numbers.append(button);
    }
    container.append(numbers, drawer);
  }

  async function load() {
    retry.hidden = true;
    feedback(status, 'Cargando panel…');
    try {
      const data = await client.panel();
      renderGroup(query('[data-panel-media]'), panelCards(data.media), { detailLink: '/admin/medios/' });
      renderGroup(query('[data-panel-voceros]'), panelCards(data.voceros), { detailLink: '/admin/voceros/' });
      const events = query('[data-panel-events]');
      events.replaceChildren();
      const list = data.media?.events ?? [];
      if (!list.length) events.append(node('p', 'Todavía no hay eventos. Créalos en Medios → Eventos.', 'admin-panel-empty'));
      for (const event of list) {
        const block = node('details', undefined, 'admin-panel-event');
        const summary = node('summary');
        summary.append(node('strong', event.name), node('small', `${eventLabel(event)} · ${event.coverage_count} medios`));
        block.append(summary);
        const body = node('div', undefined, 'admin-panel-event__body');
        block.append(body);
        block.addEventListener('toggle', () => { if (block.open && !body.childElementCount) renderGroup(body, panelCards(event)); }, { once: false });
        events.append(block);
      }
      if (list.length) list.length === 1 ? events.firstElementChild.setAttribute('open', '') : null;
      feedback(status, '');
    } catch (error) { fail(error); retry.hidden = false; }
  }

  retry.addEventListener('click', load);
  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await client.logout(); location.replace('/admin/'); }
    catch (error) { logout.disabled = false; fail(error); }
  });

  try {
    const session = await client.session();
    if (!session.authenticated) { location.replace('/admin/'); return; }
    query('[data-admin-user]').textContent = `Sesión de ${session.user.username}`;
    if (sidebarUser) sidebarUser.textContent = session.user.username;
    if (logout) logout.disabled = false;
    await load();
  } catch (error) { fail(error); retry.hidden = false; }
}

if (typeof document !== 'undefined') initializeAdminPanel();
