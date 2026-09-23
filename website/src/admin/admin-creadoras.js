import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
import './sidebar.js?v=20260923-admin-sidebar-1';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';

export const CREADORA_STATUSES = Object.freeze(['Nuevo', 'Activa', 'En pausa', 'Retirada']);
export const NETWORK_LABELS = Object.freeze({ tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', otro: 'Otra red' });
export const ORIGIN_LABELS = Object.freeze({ coordinacion: 'Coordinación', cuenta: 'Cuenta propia' });
export const VIEWS = Object.freeze({ day: 'Día', week: 'Semana', month: 'Mes' });
/** El calendario muestra de 6:00 a 24:00 y las cajas se acomodan de cuarto en cuarto de hora. */
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 24;
export const STEP_MINUTES = 15;
/** El día se cierra a las 23:59: el backend no acepta «24:00» como hora. */
export const MAX_END_MINUTES = DAY_END_HOUR * 60 - 1;
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export class CreadoraAdminError extends Error {
  constructor(status) {
    super(status === 0 ? 'No se pudo conectar con el servidor.'
      : status === 401 ? 'Tu sesión expiró.'
      : status === 403 ? 'Solicitud no permitida.'
      : status === 409 ? 'Ese cambio choca con algo que ya existe.'
      : status === 422 ? 'Revisa los datos.'
      : 'No se pudo completar la operación.');
    this.status = status;
  }
}

export function createCreadoraAdminClient(baseUrl = API, fetchImplementation = fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  let csrf = '';
  async function request(path, options = {}) {
    if (!/^\/(?:auth\/(?:session|logout)|creadoras(?:\?[^#]*)?|creadoras\/(?:calendario|bitacora|turnos)(?:\?[^#]*)?)$/.test(path)
      && !/^\/creadoras\/[a-f0-9]{32}(?:\/retirar)?$/.test(path)
      && !/^\/creadoras\/turnos\/[a-f0-9]{32}$/.test(path)) throw new Error('Ruta de API no permitida.');
    const method = (options.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST', 'PATCH'].includes(method)) throw new Error('Método no permitido.');
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') {
      if (!csrf) throw new CreadoraAdminError(403);
      headers['X-CSRF-Token'] = csrf;
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch { throw new CreadoraAdminError(0); }
    if (!response.ok) throw new CreadoraAdminError(response.status);
    let data;
    try { data = await response.json(); } catch { throw new CreadoraAdminError(502); }
    if (typeof data.csrf === 'string') csrf = data.csrf;
    return data;
  }
  return {
    request,
    session: () => request('/auth/session'),
    logout: () => request('/auth/logout', { method: 'POST' }),
    list: (filters = {}) => request('/creadoras?' + new URLSearchParams(filters)),
    create: body => request('/creadoras', { method: 'POST', body }),
    update: (id, body) => request(`/creadoras/${id}`, { method: 'PATCH', body }),
    retire: id => request(`/creadoras/${id}/retirar`, { method: 'POST', body: {} }),
    calendar: (from, to) => request('/creadoras/calendario?' + new URLSearchParams({ from, to })),
    log: () => request('/creadoras/bitacora'),
    createShift: body => request('/creadoras/turnos', { method: 'POST', body }),
    updateShift: (id, body) => request(`/creadoras/turnos/${id}`, { method: 'PATCH', body }),
    removeShift: id => request(`/creadoras/turnos/${id}`, { method: 'POST', body: {} }),
  };
}

// --- Fechas: todo el calendario trabaja en hora de Ecuador, sin convertir nada ----------------

export function parseMoment(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value ?? ''));
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  return { year, month, day, hour, minute };
}

export function formatMoment(dayKey, minutes) {
  const hour = Math.floor(minutes / 60);
  return `${dayKey} ${String(hour).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateFromKey(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(key, amount) {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + amount);
  return dayKey(date);
}

/** La semana empieza el lunes, como se lee un horario de trabajo. */
export function weekStart(key) {
  const date = dateFromKey(key);
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  return dayKey(date);
}

export function monthStart(key) {
  const date = dateFromKey(key);
  return dayKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

/** Los días que dibuja cada vista y el rango que hay que pedirle al servidor. */
export function viewRange(view, anchor) {
  if (view === 'day') return { days: [anchor], from: anchor, to: addDays(anchor, 1) };
  if (view === 'week') {
    const start = weekStart(anchor);
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    return { days, from: start, to: addDays(start, 7) };
  }
  if (view !== 'month') throw new TypeError('Vista de calendario no válida.');
  const first = monthStart(anchor);
  const start = weekStart(first);
  const date = dateFromKey(first);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const end = addDays(weekStart(dayKey(lastDay)), 7);
  const days = [];
  for (let key = start; key !== end; key = addDays(key, 1)) days.push(key);
  return { days, from: start, to: end };
}

export function shiftView(view, anchor, direction) {
  if (view === 'day') return addDays(anchor, direction);
  if (view === 'week') return addDays(weekStart(anchor), direction * 7);
  const date = dateFromKey(monthStart(anchor));
  return dayKey(new Date(date.getFullYear(), date.getMonth() + direction, 1));
}

export function rangeLabel(view, anchor) {
  const { days } = viewRange(view, anchor);
  if (view === 'day') {
    const date = dateFromKey(anchor);
    return `${DAY_NAMES[(date.getDay() + 6) % 7]} ${date.getDate()} de ${MONTH_NAMES[date.getMonth()]} de ${date.getFullYear()}`;
  }
  if (view === 'week') {
    const first = dateFromKey(days[0]);
    const last = dateFromKey(days[6]);
    const tail = `${last.getDate()} de ${MONTH_NAMES[last.getMonth()]} de ${last.getFullYear()}`;
    return first.getMonth() === last.getMonth()
      ? `${first.getDate()} al ${tail}`
      : `${first.getDate()} de ${MONTH_NAMES[first.getMonth()]} al ${tail}`;
  }
  const date = dateFromKey(monthStart(anchor));
  return `${MONTH_NAMES[date.getMonth()]} de ${date.getFullYear()}`;
}

export function dayLabel(key, short = false) {
  const date = dateFromKey(key);
  const name = DAY_NAMES[(date.getDay() + 6) % 7];
  return short ? `${name.slice(0, 3)} ${date.getDate()}` : `${name} ${date.getDate()}`;
}

export function hourRows() {
  return Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, index) => DAY_START_HOUR + index);
}

export function minutesOf(value) {
  const moment = parseMoment(value);
  return moment === null ? null : moment.hour * 60 + moment.minute;
}

/** Dónde cae la caja dentro de la columna del día, en porcentaje: sirve igual en cualquier ancho. */
export function shiftGeometry(shift, key) {
  const start = parseMoment(shift.starts_at);
  const end = parseMoment(shift.ends_at);
  if (start === null || end === null) return null;
  const dayStart = DAY_START_HOUR * 60;
  const dayEnd = DAY_END_HOUR * 60;
  const startKey = `${String(start.year).padStart(4, '0')}-${String(start.month).padStart(2, '0')}-${String(start.day).padStart(2, '0')}`;
  if (startKey !== key) return null;
  const from = Math.max(start.hour * 60 + start.minute, dayStart);
  const to = Math.min(end.hour * 60 + end.minute, dayEnd);
  if (to <= from) return null;
  const span = dayEnd - dayStart;
  return { top: ((from - dayStart) / span) * 100, height: ((to - from) / span) * 100 };
}

/** Convierte la posición del puntero dentro de la columna en una hora de cuarto en cuarto. */
export function minutesFromOffset(ratio) {
  const span = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const raw = DAY_START_HOUR * 60 + Math.max(0, Math.min(1, ratio)) * span;
  const snapped = Math.round(raw / STEP_MINUTES) * STEP_MINUTES;
  return Math.max(DAY_START_HOUR * 60, Math.min(DAY_END_HOUR * 60 - STEP_MINUTES, snapped));
}

/** Al soltar una caja: mismo largo, nuevo día y nueva hora, sin salirse del día. */
export function movedShift(shift, key, startMinutes) {
  const from = minutesOf(shift.starts_at);
  const to = minutesOf(shift.ends_at);
  if (from === null || to === null) throw new TypeError('Turno sin horas válidas.');
  const length = to - from;
  const start = Math.max(DAY_START_HOUR * 60, Math.min(startMinutes, MAX_END_MINUTES - length));
  return { starts_at: formatMoment(key, start), ends_at: formatMoment(key, start + length) };
}

/** Al estirar el borde inferior: se mueve solo el final, con un mínimo de un cuarto de hora. */
export function resizedShift(shift, endMinutes) {
  const from = minutesOf(shift.starts_at);
  if (from === null) throw new TypeError('Turno sin horas válidas.');
  const end = Math.max(from + STEP_MINUTES, Math.min(endMinutes, MAX_END_MINUTES));
  const key = String(shift.starts_at).slice(0, 10);
  return { starts_at: formatMoment(key, from), ends_at: formatMoment(key, end) };
}

export function defaultShift(key, startMinutes, hours = 3) {
  const start = Math.max(DAY_START_HOUR * 60, Math.min(startMinutes, MAX_END_MINUTES - hours * 60));
  return { starts_at: formatMoment(key, start), ends_at: formatMoment(key, Math.min(start + hours * 60, MAX_END_MINUTES)) };
}

/**
 * Varias creadoras pueden venir a la misma hora, así que las cajas que coinciden en el tiempo
 * se reparten el ancho de la columna en vez de taparse. Cada grupo que se solapa se divide en
 * tantas columnas como haga falta.
 */
export function layoutDay(shifts, key) {
  const boxes = shifts
    .map(shift => ({ shift, geometry: shiftGeometry(shift, key) }))
    .filter(entry => entry.geometry !== null)
    .sort((a, b) => a.geometry.top - b.geometry.top || a.geometry.height - b.geometry.height);
  const placed = [];
  let group = [];
  let groupEnd = -1;
  const close = () => {
    if (!group.length) return;
    const columns = [];
    for (const entry of group) {
      let index = columns.findIndex(end => end <= entry.geometry.top + 0.0001);
      if (index === -1) { index = columns.length; columns.push(0); }
      columns[index] = entry.geometry.top + entry.geometry.height;
      entry.column = index;
    }
    for (const entry of group) {
      placed.push({ ...entry.geometry, shift: entry.shift, column: entry.column, columns: columns.length });
    }
    group = [];
    groupEnd = -1;
  };
  for (const entry of boxes) {
    if (group.length && entry.geometry.top >= groupEnd - 0.0001) close();
    group.push(entry);
    groupEnd = Math.max(groupEnd, entry.geometry.top + entry.geometry.height);
  }
  close();
  return placed;
}

export function shiftLabel(shift) {
  const start = parseMoment(shift.starts_at);
  const end = parseMoment(shift.ends_at);
  if (start === null || end === null) return '';
  const time = moment => `${String(moment.hour).padStart(2, '0')}:${String(moment.minute).padStart(2, '0')}`;
  return `${time(start)}–${time(end)}`;
}

/** Una línea legible de la bitácora: quién, qué y cómo quedó. */
export function describeLogEntry(entry = {}) {
  const parts = [entry.label ?? '', entry.creadora ? `· ${entry.creadora}` : ''].filter(Boolean);
  const before = entry.before ? `${shiftLabel(entry.before)} del ${String(entry.before.starts_at).slice(0, 10)}` : '';
  const after = entry.after ? `${shiftLabel(entry.after)} del ${String(entry.after.starts_at).slice(0, 10)}` : '';
  if (before && after && before !== after) parts.push(`· de ${before} a ${after}`);
  else if (after) parts.push(`· ${after}`);
  else if (before) parts.push(`· ${before}`);
  if (entry.detail) parts.push(`· ${entry.detail}`);
  return parts.join(' ');
}

export const CREADORA_FIELDS = Object.freeze(['full_name', 'cedula', 'birth_date', 'whatsapp', 'contact_email', 'city',
  'status', 'main_network', 'followers_count', 'social_link', 'tiktok', 'instagram', 'facebook', 'note']);

/** Del formulario del turno al cuerpo que entiende el servidor. */
export function shiftPayload(form) {
  const value = name => String(form.get(name) ?? '').trim();
  const day = value('day');
  const start = value('start');
  const end = value('end');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TypeError('Elige el día del turno.');
  if (!/^\d{2}:\d{2}/.test(start) || !/^\d{2}:\d{2}/.test(end)) throw new TypeError('Escribe la hora de inicio y la de fin.');
  const from = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const to = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
  if (to - from < STEP_MINUTES) throw new TypeError('El turno debe durar al menos 15 minutos.');
  return {
    creadora: value('creadora'),
    starts_at: `${day} ${start.slice(0, 5)}`,
    ends_at: `${day} ${end.slice(0, 5)}`,
    place: value('place'),
    note: value('note'),
  };
}

/** Los valores del formulario para un turno ya guardado. */
export function shiftFormValues(shift = {}) {
  return {
    creadora: shift.creadora ?? '',
    day: String(shift.starts_at ?? '').slice(0, 10),
    start: String(shift.starts_at ?? '').slice(11, 16),
    end: String(shift.ends_at ?? '').slice(11, 16),
    place: shift.place ?? '',
    note: shift.note ?? '',
  };
}

export function creadoraPayload(form) {
  const value = name => String(form.get(name) ?? '').trim();
  const payload = {};
  for (const name of CREADORA_FIELDS) payload[name] = value(name);
  payload.status = payload.status || 'Activa';
  payload.followers_count = payload.followers_count === '' ? 0 : Number(payload.followers_count);
  return payload;
}

/** Vuelca una ficha guardada en el formulario para revisarla o corregirla. */
export function fillCreadoraForm(form, creadora = {}) {
  for (const name of CREADORA_FIELDS) {
    const field = form.elements?.[name];
    if (!field) continue;
    const value = creadora[name];
    field.value = value === undefined || value === null ? '' : String(value);
  }
  return form;
}

// --- Pantalla -------------------------------------------------------------------------------

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}

export async function initializeAdminCreadoras() {
  const panel = document.querySelector('[data-admin-creadoras]');
  if (!panel) return;
  const navigation = document.querySelector('[data-admin-navigation]');
  const compact = globalThis.matchMedia?.('(max-width: 1120px)');
  const applyNavigation = value => { if (navigation) navigation.open = !value; };
  applyNavigation(compact?.matches ?? false);
  compact?.addEventListener('change', event => applyNavigation(event.matches));
  const query = selector => panel.querySelector(selector);
  const status = query('[data-admin-feedback]');
  const configuredBase = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredBase || runtime.apiBase;
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) { status.textContent = 'La configuración de acceso no es válida.'; status.dataset.error = 'true'; return; }
  if (!isAllowedSiteOrigin(location.origin) && location.hostname !== new URL(LOCAL_API).hostname) { status.textContent = 'Origen no permitido.'; status.dataset.error = 'true'; return; }
  const client = createCreadoraAdminClient(base);
  const logout = document.querySelector('[data-admin-logout]');
  const sidebarUser = document.querySelector('[data-admin-sidebar-user]');
  const feedback = (message, kind = '') => { status.textContent = message; status.dataset.error = String(kind === 'error'); status.dataset.success = String(kind === 'success'); };
  const fail = error => { if (error.status === 401) { location.replace('/admin/'); return; } feedback(error.message, 'error'); };

  const state = { view: 'week', anchor: dayKey(new Date()), shifts: [], creadoras: [], log: [], selected: '' };
  const grid = query('[data-calendar-grid]');
  const monthGrid = query('[data-calendar-month]');
  const list = query('[data-creadora-list]');
  const logList = query('[data-calendar-log]');
  const label = query('[data-calendar-label]');

  function renderCreadoras() {
    list.replaceChildren();
    if (!state.creadoras.length) { list.append(node('p', 'Todavía no hay creadoras. Agrega la primera con el botón de arriba.', 'admin-panel-empty')); return; }
    for (const creadora of state.creadoras) {
      const item = node('li', undefined, 'creadora-chip');
      item.dataset.creadora = creadora.public_id;
      item.draggable = true;
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-pressed', String(state.selected === creadora.public_id));
      const body = node('span');
      body.append(node('strong', creadora.full_name));
      const detail = [creadora.main_network_label, creadora.city].filter(Boolean).join(' · ');
      if (detail) body.append(node('small', detail));
      const open = node('button', 'Ver ficha', 'creadora-chip__edit');
      open.type = 'button';
      open.addEventListener('click', event => { event.stopPropagation(); editCreadora(creadora); });
      item.append(body, node('span', `${creadora.shift_count ?? 0}`, 'creadora-chip__count'), open);
      item.addEventListener('click', () => {
        state.selected = creadora.public_id;
        renderCreadoras();
        openShiftDialog(null, { creadora: creadora.public_id });
      });
      item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.click(); } });
      item.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', `creadora:${creadora.public_id}`); event.dataTransfer.effectAllowed = 'copy'; });
      list.append(item);
    }
  }

  function renderLog() {
    logList.replaceChildren();
    if (!state.log.length) { logList.append(node('li', 'Todavía no hay cambios registrados.', 'admin-panel-empty')); return; }
    for (const entry of state.log) {
      const item = node('li');
      item.append(node('strong', entry.actor), node('span', describeLogEntry(entry)), node('time', entry.recorded_at));
      logList.append(item);
    }
  }

  async function save(action) {
    try {
      const data = await action();
      if (Array.isArray(data.log)) state.log = data.log;
      await load(false);
      feedback('Calendario actualizado.', 'success');
    } catch (error) { fail(error); await load(false); }
  }

  function shiftBox(shift, key, { absolute, placement = null }) {
    const box = node('article', undefined, 'shift-box');
    box.dataset.shift = shift.public_id;
    box.draggable = true;
    box.tabIndex = 0;
    box.append(node('strong', shift.name), node('span', shiftLabel(shift)));
    if (shift.place) box.append(node('small', shift.place));
    if (absolute) {
      const geometry = placement ?? shiftGeometry(shift, key);
      if (geometry === null) return null;
      box.style.top = `${geometry.top}%`;
      box.style.height = `${geometry.height}%`;
      // Cuando varias coinciden en la hora, cada una ocupa su porción de la columna.
      const columns = geometry.columns ?? 1;
      const column = geometry.column ?? 0;
      box.style.left = `calc(${(column / columns) * 100}% + .2rem)`;
      box.style.width = `calc(${(1 / columns) * 100}% - .4rem)`;
      if (columns > 1) box.dataset.shared = 'true';
      const handle = node('span', '', 'shift-box__handle');
      handle.setAttribute('aria-hidden', 'true');
      box.append(handle);
    }
    box.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', `shift:${shift.public_id}`); event.dataTransfer.effectAllowed = 'move'; });
    box.addEventListener('click', event => { event.stopPropagation(); editShift(shift); });
    box.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); editShift(shift); } });
    box.title = `${shift.name} · ${shiftLabel(shift)}${shift.place ? ` · ${shift.place}` : ''}\nArrastra para mover, o toca para abrir el turno.`;
    return box;
  }

  async function drop(event, key, minutes) {
    event.preventDefault();
    const payload = String(event.dataTransfer?.getData('text/plain') ?? '');
    if (payload.startsWith('creadora:')) {
      await save(() => client.createShift({ creadora: payload.slice(9), ...defaultShift(key, minutes) }));
      return;
    }
    if (!payload.startsWith('shift:')) return;
    const shift = state.shifts.find(item => item.public_id === payload.slice(6));
    if (!shift) return;
    await save(() => client.updateShift(shift.public_id, movedShift(shift, key, minutes)));
  }

  function renderGrid() {
    const { days } = viewRange(state.view, state.anchor);
    grid.hidden = state.view === 'month';
    monthGrid.hidden = state.view === 'month' ? false : true;
    label.textContent = rangeLabel(state.view, state.anchor);
    if (state.view === 'month') { renderMonth(days); return; }
    grid.replaceChildren();
    grid.style.setProperty('--calendar-days', String(days.length));
    const hours = node('div', undefined, 'calendar-hours');
    for (const hour of hourRows()) hours.append(node('span', `${String(hour).padStart(2, '0')}:00`));
    grid.append(hours);
    for (const key of days) {
      const column = node('div', undefined, 'calendar-day');
      column.append(node('h3', dayLabel(key, days.length > 1)));
      const canvas = node('div', undefined, 'calendar-canvas');
      canvas.dataset.day = key;
      for (const hour of hourRows()) canvas.append(node('span', undefined, 'calendar-line'));
      canvas.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; });
      const minutesAt = event => minutesFromOffset((event.clientY - canvas.getBoundingClientRect().top) / canvas.getBoundingClientRect().height);
      canvas.addEventListener('drop', event => drop(event, key, minutesAt(event)));
      canvas.addEventListener('click', event => {
        if (event.target !== canvas && !event.target.classList.contains('calendar-line')) return;
        if (!state.creadoras.length) { feedback('Primero agrega una creadora.', 'error'); return; }
        const slot = defaultShift(key, minutesAt(event));
        openShiftDialog(null, { day: key, start: slot.starts_at.slice(11, 16), end: slot.ends_at.slice(11, 16) });
      });
      for (const placement of layoutDay(state.shifts, key)) {
        const box = shiftBox(placement.shift, key, { absolute: true, placement });
        if (box) canvas.append(box);
      }
      column.append(canvas);
      grid.append(column);
    }
  }

  function renderMonth(days) {
    monthGrid.replaceChildren();
    const header = node('div', undefined, 'calendar-month__header');
    for (const name of DAY_NAMES) header.append(node('span', name.slice(0, 3)));
    monthGrid.append(header);
    const body = node('div', undefined, 'calendar-month__body');
    const current = dateFromKey(monthStart(state.anchor)).getMonth();
    for (const key of days) {
      const cell = node('div', undefined, 'calendar-month__day');
      cell.dataset.day = key;
      if (dateFromKey(key).getMonth() !== current) cell.dataset.outside = 'true';
      cell.append(node('span', String(dateFromKey(key).getDate()), 'calendar-month__number'));
      cell.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; });
      cell.addEventListener('drop', event => {
        const payload = String(event.dataTransfer?.getData('text/plain') ?? '');
        const existing = payload.startsWith('shift:') ? state.shifts.find(item => item.public_id === payload.slice(6)) : null;
        return drop(event, key, existing ? minutesOf(existing.starts_at) : 9 * 60);
      });
      for (const shift of state.shifts) {
        if (String(shift.starts_at).slice(0, 10) !== key) continue;
        const box = shiftBox(shift, key, { absolute: false });
        if (box) cell.append(box);
      }
      body.append(cell);
    }
    monthGrid.append(body);
  }

  async function load(announce = true) {
    if (announce) feedback('Cargando calendario…');
    const { from, to } = viewRange(state.view, state.anchor);
    try {
      const data = await client.calendar(from, to);
      state.shifts = data.shifts ?? [];
      state.creadoras = data.creadoras ?? [];
      state.log = data.log ?? [];
      renderCreadoras();
      renderGrid();
      renderLog();
      if (announce) feedback('');
    } catch (error) { fail(error); }
  }

  for (const button of panel.querySelectorAll('[data-view]')) {
    button.addEventListener('click', async () => {
      state.view = button.dataset.view;
      for (const other of panel.querySelectorAll('[data-view]')) other.setAttribute('aria-pressed', String(other === button));
      await load();
    });
    button.setAttribute('aria-pressed', String(button.dataset.view === state.view));
  }
  query('[data-calendar-previous]')?.addEventListener('click', async () => { state.anchor = shiftView(state.view, state.anchor, -1); await load(); });
  query('[data-calendar-next]')?.addEventListener('click', async () => { state.anchor = shiftView(state.view, state.anchor, 1); await load(); });
  query('[data-calendar-today]')?.addEventListener('click', async () => { state.anchor = dayKey(new Date()); await load(); });

  const shiftDialog = query('[data-shift-dialog]');
  const shiftForm = shiftDialog?.querySelector('form');
  const shiftTitle = shiftDialog?.querySelector('[data-shift-title]');
  const shiftFeedback = shiftDialog?.querySelector('[data-shift-feedback]');
  const removeButton = shiftDialog?.querySelector('[data-shift-remove]');
  let editingShift = '';

  function openShiftDialog(shift, { creadora = '', day = state.anchor, start = '09:00', end = '12:00' } = {}) {
    if (!shiftForm) return;
    editingShift = shift?.public_id ?? '';
    if (shiftTitle) shiftTitle.textContent = shift ? `Turno de ${shift.name}` : 'Agregar turno';
    if (shiftFeedback) { shiftFeedback.textContent = ''; shiftFeedback.dataset.error = 'false'; }
    if (removeButton) removeButton.hidden = !shift;
    const options = shiftForm.elements.creadora;
    options.replaceChildren();
    for (const person of state.creadoras) {
      const option = node('option', person.full_name);
      option.value = person.public_id;
      options.append(option);
    }
    const values = shift ? shiftFormValues(shift) : { creadora: creadora || state.selected || state.creadoras[0]?.public_id || '', day, start, end, place: '', note: '' };
    for (const [name, value] of Object.entries(values)) if (shiftForm.elements[name]) shiftForm.elements[name].value = value;
    shiftDialog.showModal();
  }

  function editShift(shift) { openShiftDialog(shift); }

  query('[data-shift-new]')?.addEventListener('click', () => {
    if (!state.creadoras.length) { feedback('Primero agrega una creadora.', 'error'); return; }
    openShiftDialog(null);
  });

  shiftForm?.addEventListener('submit', async event => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    let payload;
    try { payload = shiftPayload(new FormData(shiftForm)); }
    catch (error) { if (shiftFeedback) { shiftFeedback.textContent = error.message; shiftFeedback.dataset.error = 'true'; } return; }
    try {
      const data = editingShift ? await client.updateShift(editingShift, payload) : await client.createShift(payload);
      if (Array.isArray(data.log)) state.log = data.log;
      shiftDialog.close();
      await load(false);
      feedback(editingShift ? 'Turno actualizado.' : 'Turno agregado al calendario.', 'success');
    } catch (error) {
      if (shiftFeedback) { shiftFeedback.textContent = error.status === 409 ? 'Esa creadora ya tiene un turno a esa hora.' : error.message; shiftFeedback.dataset.error = 'true'; }
      if (error.status === 401) fail(error);
    }
  });

  removeButton?.addEventListener('click', async () => {
    if (!editingShift || !confirm('¿Quitar este turno del calendario?')) return;
    const id = editingShift;
    shiftDialog.close();
    await save(() => client.removeShift(id));
  });

  const dialog = query('[data-creadora-dialog]');
  const dialogTitle = dialog?.querySelector('[data-dialog-title]');
  let editing = '';
  function editCreadora(creadora) {
    editing = creadora.public_id;
    if (dialogTitle) dialogTitle.textContent = `Ficha de ${creadora.full_name}`;
    fillCreadoraForm(dialog.querySelector('form'), creadora);
    dialog.showModal();
  }
  query('[data-creadora-new]')?.addEventListener('click', () => {
    editing = '';
    if (dialogTitle) dialogTitle.textContent = 'Agregar creadora';
    dialog.querySelector('form').reset();
    dialog.showModal();
  });
  dialog?.querySelector('form')?.addEventListener('submit', async event => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    const payload = creadoraPayload(new FormData(event.target));
    try {
      if (editing) await client.update(editing, payload);
      else await client.create(payload);
      dialog.close();
      await load(false);
      feedback(editing ? 'Ficha actualizada.' : 'Creadora agregada.', 'success');
    } catch (error) { fail(error); }
  });

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
  } catch (error) { fail(error); }
}

if (typeof document !== 'undefined') initializeAdminCreadoras();
