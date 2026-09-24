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


/** «12 h 30 min», «45 min» o «0 h». */
export function formatHours(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60), rest = total % 60;
  if (!hours && !rest) return '0 h';
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Las horas de los turnos se guardan en hora de Ecuador, sin convertir. */
export function shiftWhen(startsAt, endsAt) {
  const start = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(startsAt ?? ''));
  const end = /[ T](\d{2}):(\d{2})/.exec(String(endsAt ?? ''));
  if (!start) return '—';
  const [, year, month, day, hour, minute] = start;
  const date = new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(+year, +month - 1, +day)));
  return `${date} · ${hour}:${minute}${end ? `–${end[1]}:${end[2]}` : ''}`;
}

const CONTENT_KINDS = Object.freeze({ video: 'Video', live: 'En vivo', historia: 'Historia', foto: 'Fotografía', otro: 'Otro' });

/** Totales del equipo, en el orden en que se leen. */
export function creadoraTotals(data = {}) {
  const totals = data.totals ?? {};
  return [
    ['Creadoras', totals.creadoras ?? (data.people ?? []).length],
    ['Horas asistidas', formatHours(totals.attended_minutes)],
    ['Turnos', totals.shifts ?? 0],
    ['Asistencias', totals.attended ?? 0],
    ['Guiones grabados', `${totals.recorded ?? 0} de ${totals.scripts ?? 0}`],
    ['Videos', totals.videos ?? 0],
    ['Contenido total', totals.content ?? 0],
  ];
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


  /** Creadoras: totales arriba, una tarjeta por persona y, al tocarla, todo su historial. */
  function renderCreadoras(container, data) {
    container.replaceChildren();
    if (!data || !Array.isArray(data.people)) { container.append(node('p', 'No se pudo cargar la sección de creadoras.', 'admin-panel-empty')); return; }
    const totals = node('div', undefined, 'admin-big-numbers admin-big-numbers--static');
    for (const [label, value] of creadoraTotals(data)) { const box = node('div', undefined, 'admin-big-number'); box.append(node('strong', value), node('span', label)); totals.append(box); }
    container.append(totals);
    if (!data.people.length) { container.append(node('p', 'Todavía no hay creadoras registradas.', 'admin-panel-empty')); return; }
    const people = node('div', undefined, 'admin-creadora-people');
    const drawer = node('section', undefined, 'admin-panel-drawer admin-creadora-history');
    drawer.hidden = true;
    let active = '';
    const list = (title, items, empty, render) => {
      const column = node('div', undefined, 'admin-creadora-history__column');
      column.append(node('h4', `${title} (${items.length})`));
      if (!items.length) { column.append(node('p', empty, 'admin-panel-empty')); return column; }
      const ol = node('ol', undefined, 'admin-panel-list');
      for (const item of items) ol.append(render(item));
      column.append(ol);
      return column;
    };
    const linkTo = (url, text) => { if (typeof url !== 'string' || !url.startsWith('https://')) return null; const link = node('a', text); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link; };
    for (const person of data.people) {
      const card = node('button', undefined, 'admin-creadora-person'); card.type = 'button'; card.setAttribute('aria-pressed', 'false');
      card.append(node('strong', person.name));
      const stats = node('dl');
      for (const [label, value] of [['Horas', formatHours(person.attended_minutes)], ['Asistió', `${person.attended} de ${person.shifts}`], ['Grabados', `${person.recorded} de ${person.scripts}`], ['Videos', person.videos]]) {
        const row = node('div'); row.append(node('dt', label), node('dd', value)); stats.append(row);
      }
      card.append(stats);
      card.addEventListener('click', () => {
        for (const other of people.querySelectorAll('button')) other.setAttribute('aria-pressed', 'false');
        if (active === person.creadora) { active = ''; drawer.hidden = true; drawer.replaceChildren(); return; }
        active = person.creadora; card.setAttribute('aria-pressed', 'true');
        drawer.replaceChildren();
        const heading = node('div', undefined, 'records-heading');
        heading.append(node('h3', `Historial de ${person.name}`), node('p', `${formatHours(person.attended_minutes)} asistidas de ${formatHours(person.scheduled_minutes)} agendadas · ${person.content} piezas de contenido`));
        const columns = node('div', undefined, 'admin-creadora-history__columns');
        const history = person.history ?? {};
        columns.append(
          list('Turnos', history.shifts ?? [], 'Sin turnos todavía.', shift => {
            const row = node('li'); const body = node('div');
            body.append(node('strong', shiftWhen(shift.starts_at, shift.ends_at)));
            const attended = shift.attended === 'yes' ? '✓ Asistió' : shift.attended === 'no' ? '✗ No asistió' : 'Sin marcar';
            body.append(node('small', [attended, formatHours(shift.minutes), shift.place].filter(Boolean).join(' · ')));
            row.dataset.attended = shift.attended ?? ''; row.append(body); return row;
          }),
          list('Guiones grabados', history.recorded_scripts ?? [], 'Todavía no hay guiones grabados.', script => {
            const row = node('li'); const body = node('div');
            body.append(node('strong', script.title), node('small', `Turno del ${shiftWhen(script.shift_at)}`));
            row.append(body); const ref = linkTo(script.reference_url, 'Referencia'); if (ref) row.append(ref); return row;
          }),
          list('Videos y contenido', history.content ?? [], 'Todavía no hay contenido registrado.', item => {
            const row = node('li'); const body = node('div');
            body.append(node('strong', `${CONTENT_KINDS[item.kind] ?? 'Contenido'} · ${item.title}`), node('small', `Turno del ${shiftWhen(item.shift_at)}`));
            row.append(body); const link = linkTo(item.url, 'Ver publicación'); if (link) row.append(link); return row;
          }),
        );
        const more = node('a', 'Abrir en el calendario de Creadoras', 'button-quiet'); more.href = '/admin/creadoras/';
        drawer.append(heading, columns, more);
        drawer.hidden = false;
        drawer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      people.append(card);
    }
    container.append(people, drawer);
  }

  async function load() {
    retry.hidden = true;
    feedback(status, 'Cargando panel…');
    try {
      const data = await client.panel();
      renderGroup(query('[data-panel-media]'), panelCards(data.media), { detailLink: '/admin/medios/' });
      renderGroup(query('[data-panel-voceros]'), panelCards(data.voceros), { detailLink: '/admin/voceros/' });
      renderCreadoras(query('[data-panel-creadoras]'), data.creadoras);
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
