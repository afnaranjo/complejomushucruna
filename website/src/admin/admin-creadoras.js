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
  const start = Math.max(DAY_START_HOUR * 60, Math.min(startMinutes, DAY_END_HOUR * 60 - length));
  return { starts_at: formatMoment(key, start), ends_at: formatMoment(key, start + length) };
}

/** Al estirar el borde inferior: se mueve solo el final, con un mínimo de un cuarto de hora. */
export function resizedShift(shift, endMinutes) {
  const from = minutesOf(shift.starts_at);
  if (from === null) throw new TypeError('Turno sin horas válidas.');
  const end = Math.max(from + STEP_MINUTES, Math.min(endMinutes, DAY_END_HOUR * 60));
  const key = String(shift.starts_at).slice(0, 10);
  return { starts_at: formatMoment(key, from), ends_at: formatMoment(key, end) };
}

export function defaultShift(key, startMinutes, hours = 3) {
  const start = Math.max(DAY_START_HOUR * 60, Math.min(startMinutes, DAY_END_HOUR * 60 - hours * 60));
  return { starts_at: formatMoment(key, start), ends_at: formatMoment(key, start + hours * 60) };
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

export function creadoraPayload(form) {
  const value = name => String(form.get(name) ?? '').trim();
  return {
    full_name: value('full_name'),
    status: value('status') || 'Activa',
    whatsapp: value('whatsapp'),
    city: value('city'),
    main_network: value('main_network'),
    social_link: value('social_link'),
    note: value('note'),
  };
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
      item.append(body, node('span', `${creadora.shift_count ?? 0}`, 'creadora-chip__count'));
      item.addEventListener('click', () => {
        state.selected = state.selected === creadora.public_id ? '' : creadora.public_id;
        renderCreadoras();
        feedback(state.selected ? `«${creadora.full_name}» seleccionada: toca una hora del calendario para asignarle un turno.` : '');
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

  function shiftBox(shift, key, { absolute }) {
    const box = node('article', undefined, 'shift-box');
    box.dataset.shift = shift.public_id;
    box.draggable = true;
    box.tabIndex = 0;
    box.append(node('strong', shift.name), node('span', shiftLabel(shift)));
    if (shift.place) box.append(node('small', shift.place));
    if (absolute) {
      const geometry = shiftGeometry(shift, key);
      if (geometry === null) return null;
      box.style.top = `${geometry.top}%`;
      box.style.height = `${geometry.height}%`;
      const handle = node('button', '', 'shift-box__handle');
      handle.type = 'button';
      handle.setAttribute('aria-label', `Cambiar la duración del turno de ${shift.name}`);
      handle.addEventListener('pointerdown', event => event.stopPropagation());
      handle.addEventListener('click', async () => {
        const answer = prompt(`¿A qué hora termina el turno de ${shift.name}?`, String(shift.ends_at).slice(11, 16));
        if (answer === null) return;
        const parts = /^(\d{1,2}):(\d{2})$/.exec(answer.trim());
        if (!parts) { feedback('Escribe la hora como 18:30.', 'error'); return; }
        await save(() => client.updateShift(shift.public_id, resizedShift(shift, Number(parts[1]) * 60 + Number(parts[2]))));
      });
      box.append(handle);
    }
    box.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', `shift:${shift.public_id}`); event.dataTransfer.effectAllowed = 'move'; });
    box.addEventListener('dblclick', async () => {
      if (!confirm(`¿Quitar del calendario el turno de ${shift.name} (${shiftLabel(shift)})?`)) return;
      await save(() => client.removeShift(shift.public_id));
    });
    box.title = `${shift.name} · ${shiftLabel(shift)}${shift.place ? ` · ${shift.place}` : ''}\nArrastra para mover. Doble clic para quitar.`;
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
      canvas.addEventListener('click', async event => {
        if (event.target !== canvas && !event.target.classList.contains('calendar-line')) return;
        if (!state.selected) { feedback('Elige primero una creadora de la lista y toca de nuevo la hora.'); return; }
        await save(() => client.createShift({ creadora: state.selected, ...defaultShift(key, minutesAt(event)) }));
      });
      for (const shift of state.shifts) {
        const box = shiftBox(shift, key, { absolute: true });
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

  const dialog = query('[data-creadora-dialog]');
  query('[data-creadora-new]')?.addEventListener('click', () => { dialog.querySelector('form').reset(); dialog.showModal(); });
  dialog?.querySelector('form')?.addEventListener('submit', async event => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    try {
      await client.create(creadoraPayload(new FormData(event.target)));
      dialog.close();
      await load(false);
      feedback('Creadora agregada.', 'success');
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
