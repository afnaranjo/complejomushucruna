import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const SHORT_MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function parseDay(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  return match === null ? null : new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** «miércoles 23 de septiembre», que es como se dice la fecha de hoy. */
export function todayLabel(value) {
  const date = parseDay(value);
  if (date === null) return '';
  return `${DAY_NAMES[date.getDay()]} ${date.getDate()} de ${MONTHS[date.getMonth()]}`;
}

/** «17 sep – 2 oct»: el mes se repite solo cuando cambia. */
export function rangeLabel(from, to) {
  const start = parseDay(from);
  const end = parseDay(to);
  if (start === null || end === null) return '';
  const tail = `${end.getDate()} ${SHORT_MONTHS[end.getMonth()]}`;
  return start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
    ? `${start.getDate()} – ${tail}`
    : `${start.getDate()} ${SHORT_MONTHS[start.getMonth()]} – ${tail}`;
}

/** Cuántos días quedan del tramo en curso, para saber si la semana ya se acaba. */
export function daysLeft(today, endsOn) {
  const start = parseDay(today);
  const end = parseDay(endsOn);
  if (start === null || end === null) return null;
  return Math.round((end - start) / 86400000);
}

/** Frentes de las acciones del calendario: lo emocional convive con shows, atractivos, venta y lo demás. */
export const FRONTS = Object.freeze([
  Object.freeze({ key: 'emocional', label: 'Emocional', color: '#94165e' }),
  Object.freeze({ key: 'shows', label: 'Shows', color: '#3b6ef5' }),
  Object.freeze({ key: 'atractivos', label: 'Atractivos', color: '#14a08a' }),
  Object.freeze({ key: 'venta', label: 'Venta', color: '#e0761a' }),
  Object.freeze({ key: 'participacion', label: 'Participación', color: '#7a3fd1' }),
  Object.freeze({ key: 'medios', label: 'Medios', color: '#b3852a' }),
  Object.freeze({ key: 'servicio', label: 'Servicio', color: '#4a5568' }),
]);
export const frontOf = key => FRONTS.find(front => front.key === key) ?? FRONTS[0];

export function phaseLabel(phase) {
  if (!phase) return '';
  return [phase.title, phase.detail].filter(Boolean).join(' · ');
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}

/** Dibuja la banda: hoy en grande, el tema de esta semana y el que viene. */
export function renderBanner(banner, data) {
  banner.replaceChildren();
  const today = node('div', undefined, 'campaign-banner__today');
  today.append(node('span', 'Hoy'), node('strong', todayLabel(data.today)));
  banner.append(today);

  const phases = node('div', undefined, 'campaign-banner__phases');
  const card = (phase, label) => {
    const item = node('article', undefined, 'campaign-phase');
    item.style.setProperty('--phase-accent', phase.accent || '#94165e');
    item.append(node('span', label, 'campaign-phase__label'));
    item.append(node('strong', rangeLabel(phase.starts_on, phase.ends_on), 'campaign-phase__range'));
    item.append(node('p', phaseLabel(phase)));
    return item;
  };
  if (data.current) {
    const item = card(data.current, 'Esta semana');
    item.dataset.current = 'true';
    const left = daysLeft(data.today, data.current.ends_on);
    if (left !== null && left >= 0) item.append(node('small', left === 0 ? 'Último día del tramo' : left === 1 ? 'Queda 1 día' : `Quedan ${left} días`));
    phases.append(item);
  } else {
    const item = node('article', undefined, 'campaign-phase');
    item.append(node('span', 'Esta semana', 'campaign-phase__label'), node('p', 'Hoy no cae dentro de ningún tramo del mapa.'));
    phases.append(item);
  }
  if (data.next) phases.append(card(data.next, 'Después viene'));
  banner.append(phases);

  // Lo que toca salir hoy según el calendario de la campaña.
  const todays = Array.isArray(data.today_actions) ? data.today_actions : [];
  if (todays.length) {
    const box = node('div', undefined, 'campaign-banner__todo');
    const head = node('div', undefined, 'campaign-banner__todo-head');
    head.append(node('span', 'Hoy toca'));
    const link = node('a', 'Ver calendario');
    link.href = '/admin/noticias/#calendario';
    head.append(link);
    const list = node('ul');
    for (const action of todays.slice(0, 6)) {
      const front = frontOf(action.front);
      const item = node('li');
      item.style.setProperty('--front-color', front.color);
      item.append(node('b', front.label), node('span', action.title));
      list.append(item);
    }
    if (todays.length > 6) list.append(node('li', `y ${todays.length - 6} más en el calendario`, 'campaign-banner__todo-more'));
    box.append(head, list);
    banner.append(box);
  }

  if (data.notices?.length) {
    const notices = node('ul', undefined, 'campaign-banner__notices');
    for (const notice of data.notices) notices.append(node('li', notice.body));
    banner.append(notices);
  }
  banner.hidden = false;
  banner.removeAttribute('data-loading');
  banner.removeAttribute('aria-busy');
}

const CACHE_KEY = 'finados-campaign-banner-v2';
/** Lo último que se vio de la banda (tramos y avisos de campaña, sin datos personales). Si falla, no pasa nada. */
function readCache() {
  try { const value = JSON.parse(sessionStorage.getItem(CACHE_KEY) ?? 'null'); return value && typeof value === 'object' ? value : null; } catch { return null; }
}
function writeCache(data) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch { /* sin almacenamiento: se pinta igual */ }
}

export async function initializeCampaignBanner(fetchImplementation = fetch) {
  const banner = document.querySelector('[data-campaign-banner]');
  if (!banner) return;
  const configured = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configured || runtime.apiBase;
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(base)) { banner.hidden = true; return; }
  if (!isAllowedSiteOrigin(location.origin) && location.hostname !== new URL(LOCAL_API ?? API).hostname) { banner.hidden = true; return; }
  const cached = readCache();
  if (cached) renderBanner(banner, cached);
  try {
    const response = await fetchImplementation(`${base}/noticias`, {
      credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error();
    const data = await response.json();
    renderBanner(banner, data);
    writeCache(data);
  } catch {
    // La banda es informativa: si no carga y no hay nada guardado, se retira sin frenar el panel.
    if (!cached) banner.hidden = true;
  }
}

if (typeof document !== 'undefined') initializeCampaignBanner();
