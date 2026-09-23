import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
import './sidebar.js?v=20260923-admin-sidebar-1';
import './campaign-banner.js?v=20260923-noticias-1';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';

export const CREADORA_STATUSES = Object.freeze(['Nuevo', 'Activa', 'En pausa', 'Retirada']);
export const NETWORK_LABELS = Object.freeze({ tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', otro: 'Otra red' });
export const ORIGIN_LABELS = Object.freeze({ coordinacion: 'Coordinación', cuenta: 'Cuenta propia' });
export const VIEWS = Object.freeze({ day: 'Día', week: 'Semana', month: 'Mes' });
export const CONTENT_KINDS = Object.freeze({ video: 'Video', live: 'En vivo', historia: 'Historia', foto: 'Fotografía', otro: 'Otro' });
export const ATTENDANCE_LABELS = Object.freeze({ yes: 'Asistió', no: 'No asistió' });
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
      && !/^\/creadoras\/turnos\/[a-f0-9]{32}(?:\/(?:contenido|guiones(?:\/[a-f0-9]{32})?))?$/.test(path)) throw new Error('Ruta de API no permitida.');
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
    markAttendance: (id, attended) => request(`/creadoras/turnos/${id}`, { method: 'PATCH', body: { attended } }),
    addContent: (id, body) => request(`/creadoras/turnos/${id}/contenido`, { method: 'POST', body }),
    removeContent: (id, content) => request(`/creadoras/turnos/${id}/contenido`, { method: 'PATCH', body: { content } }),
    addScript: (id, body) => request(`/creadoras/turnos/${id}/guiones`, { method: 'POST', body }),
    updateScript: (id, script, body) => request(`/creadoras/turnos/${id}/guiones/${script}`, { method: 'PATCH', body }),
    removeScript: (id, script) => request(`/creadoras/turnos/${id}/guiones/${script}`, { method: 'POST', body: {} }),
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

/** Matices bien separados entre sí, para que dos creadoras seguidas no se confundan. */
export const CREADORA_HUES = Object.freeze([320, 266, 20, 158, 205, 42, 288, 4, 186, 96, 240, 340]);

/**
 * El color de cada creadora sale de su identificador, así que es siempre el mismo aunque cambie
 * el orden de la lista o se recargue la página.
 */
export function creadoraColor(publicId) {
  const text = String(publicId ?? '');
  let hash = 7;
  for (let index = 0; index < text.length; index += 1) hash = (hash * 31 + text.charCodeAt(index)) % 1000003;
  const hue = CREADORA_HUES[hash % CREADORA_HUES.length];
  // El color identifica sin tapar: un tinte apenas perceptible y un filete saturado al costado.
  return { hue, soft: `hsl(${hue} 78% 97%)`, edge: `hsl(${hue} 58% 45%)`, ink: `hsl(${hue} 55% 27%)` };
}

/** Lo que se lee mientras se arrastra: a quién se mueve, a qué día y a qué hora quedaría. */
export function dragPreview(shift, key, startMinutes) {
  const moved = movedShift(shift, key, startMinutes);
  return `${shift.name ?? ''} · ${dayLabel(key, true)} · ${shiftLabel(moved)}`.trim();
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
  const from = minutesFromTime(start);
  const to = minutesFromTime(end);
  if (to <= from) throw new TypeError('La hora de fin debe ser posterior a la de inicio. Revisa si elegiste a. m. en lugar de p. m.');
  if (to - from < STEP_MINUTES) throw new TypeError('El turno debe durar al menos 15 minutos.');
  return {
    creadora: value('creadora'),
    starts_at: `${day} ${start.slice(0, 5)}`,
    ends_at: `${day} ${end.slice(0, 5)}`,
    place: value('place'),
    note: value('note'),
  };
}

/** Una copia del turno en otro día y otra hora, con la misma creadora y la misma duración. */
export function pastedShift(shift, key, startMinutes) {
  const moved = movedShift(shift, key, startMinutes);
  return { creadora: shift.creadora, ...moved, place: shift.place ?? '', note: shift.note ?? '' };
}

/** Una copia del turno en el mismo hueco: sirve para repetirlo con otra creadora. */
export function duplicatedShift(shift) {
  return {
    creadora: shift.creadora,
    starts_at: String(shift.starts_at ?? '').slice(0, 16),
    ends_at: String(shift.ends_at ?? '').slice(0, 16),
    place: shift.place ?? '',
    note: shift.note ?? '',
  };
}

/** Cuánto dura lo que hay escrito en el formulario, para decirlo en palabras. */
export function durationLabel(startMinutes, endMinutes) {
  const minutes = endMinutes - startMinutes;
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} minutos`;
  if (!rest) return hours === 1 ? '1 hora' : `${hours} horas`;
  return `${hours} h ${rest} min`;
}

export function minutesFromTime(value) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value ?? ''));
  return match === null ? null : Number(match[1]) * 60 + Number(match[2]);
}

/** Una línea de contenido tal como se lee en el turno: «Video · Recorrido por la feria». */
export function contentLabel(entry = {}) {
  const kind = CONTENT_KINDS[entry.kind] ?? entry.kind_label ?? '';
  return [kind, entry.title].filter(Boolean).join(' · ');
}

/** Lo que se manda al guardar un guion: el nombre manda, el texto y la referencia son libres. */
export function scriptPayload({ title, body, referenceUrl }) {
  const name = String(title ?? '').trim();
  if (name === '') throw new TypeError('Ponle un nombre a la idea.');
  const link = String(referenceUrl ?? '').trim();
  if (link !== '' && !/^https:\/\/\S+$/.test(link)) throw new TypeError('La referencia debe empezar con https://');
  // El guion conserva sus saltos de línea: solo se recortan los extremos.
  return { title: name, body: String(body ?? '').trim(), reference_url: link };
}

/** Un resumen corto del guion, para leerlo sin desplegarlo. */
export function scriptSummary(script = {}, limit = 90) {
  const body = String(script.body ?? '').replace(/\s+/g, ' ').trim();
  if (body === '') return script.reference_url ? 'Solo referencia' : 'Sin guion escrito';
  return body.length <= limit ? body : `${body.slice(0, limit - 1).trimEnd()}…`;
}

/** Lo que se manda al registrar contenido, con el nombre como único dato obligatorio. */
export function contentPayload({ kind, title, url }) {
  const clean = value => String(value ?? '').trim();
  if (!Object.hasOwn(CONTENT_KINDS, clean(kind))) throw new TypeError('Elige el tipo de contenido.');
  if (clean(title) === '') throw new TypeError('Escribe el nombre del contenido.');
  const link = clean(url);
  if (link !== '' && !/^https:\/\/\S+$/.test(link)) throw new TypeError('El enlace debe empezar con https://');
  return { kind: clean(kind), title: clean(title), url: link };
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

  const state = { view: 'week', anchor: dayKey(new Date()), shifts: [], creadoras: [], log: [], selected: '', clipboard: null };
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
      const color = creadoraColor(creadora.public_id);
      item.style.setProperty('--shift-soft', color.soft);
      item.style.setProperty('--shift-edge', color.edge);
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

  /** Una sola etiqueta flotante dice, mientras se arrastra, dónde caería el turno. */
  const ghost = node('div', '', 'shift-ghost');
  ghost.hidden = true;
  document.body.append(ghost);
  const showGhost = (text, x, y) => {
    ghost.textContent = text;
    ghost.style.transform = `translate(${x + 14}px, ${y - 12}px)`;
    ghost.hidden = false;
  };
  const hideGhost = () => { ghost.hidden = true; };

  function canvasAt(x, y) {
    const element = document.elementFromPoint(x, y);
    return element?.closest?.('[data-day]') ?? null;
  }

  function minutesIn(canvas, y) {
    const rect = canvas.getBoundingClientRect();
    return minutesFromOffset((y - rect.top) / rect.height);
  }

  function shiftBox(shift, key, { absolute, placement = null }) {
    const color = creadoraColor(shift.creadora);
    const box = node('article', undefined, 'shift-box');
    box.dataset.shift = shift.public_id;
    box.tabIndex = 0;
    box.style.setProperty('--shift-soft', color.soft);
    box.style.setProperty('--shift-edge', color.edge);
    box.style.setProperty('--shift-ink', color.ink);
    box.append(node('strong', shift.name), node('span', shiftLabel(shift)));
    if (shift.place) box.append(node('small', shift.place));
    const marks = [];
    if (shift.attended === 'yes') marks.push('✓ asistió');
    else if (shift.attended === 'no') marks.push('✗ no asistió');
    if (shift.content_count) marks.push(`${shift.content_count} ${shift.content_count === 1 ? 'pieza' : 'piezas'}`);
    if (shift.script_count) marks.push(`${shift.script_count} ${shift.script_count === 1 ? 'guion' : 'guiones'}`);
    if (marks.length) box.append(node('small', marks.join(' · '), 'shift-box__marks'));
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

      // Mover: la caja sigue al puntero y la etiqueta canta la hora hasta que se suelta.
      box.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.classList.contains('shift-box__handle')) return;
        const origin = { x: event.clientX, y: event.clientY };
        let dragging = false;
        let target = null;
        box.setPointerCapture(event.pointerId);
        const move = moved => {
          if (!dragging && Math.hypot(moved.clientX - origin.x, moved.clientY - origin.y) < 5) return;
          dragging = true;
          box.dataset.dragging = 'true';
          const canvas = canvasAt(moved.clientX, moved.clientY);
          if (!canvas) { showGhost('Suelta dentro del calendario', moved.clientX, moved.clientY); target = null; return; }
          const minutes = minutesIn(canvas, moved.clientY);
          target = { key: canvas.dataset.day, minutes };
          showGhost(dragPreview(shift, target.key, minutes), moved.clientX, moved.clientY);
        };
        const end = async () => {
          box.removeEventListener('pointermove', move);
          box.removeEventListener('pointerup', end);
          box.removeEventListener('pointercancel', stop);
          delete box.dataset.dragging;
          hideGhost();
          if (!dragging) { editShift(shift); return; }
          if (!target) { renderGrid(); return; }
          await save(() => client.updateShift(shift.public_id, movedShift(shift, target.key, target.minutes)));
        };
        const stop = () => {
          box.removeEventListener('pointermove', move);
          box.removeEventListener('pointerup', end);
          box.removeEventListener('pointercancel', stop);
          delete box.dataset.dragging;
          hideGhost();
          renderGrid();
        };
        box.addEventListener('pointermove', move);
        box.addEventListener('pointerup', end);
        box.addEventListener('pointercancel', stop);
      });

      const handle = node('span', '', 'shift-box__handle');
      handle.title = 'Arrastra para cambiar la hora de fin.';
      handle.setAttribute('aria-hidden', 'true');
      // Estirar: solo se mueve el final, y la etiqueta muestra el horario resultante.
      handle.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
        const canvas = box.parentElement;
        if (!canvas) return;
        handle.setPointerCapture(event.pointerId);
        let minutes = minutesOf(shift.ends_at);
        const preview = moved => {
          minutes = minutesIn(canvas, moved.clientY);
          const next = resizedShift(shift, minutes);
          const geometry = shiftGeometry({ ...shift, ends_at: next.ends_at }, key);
          if (geometry) box.style.height = `${geometry.height}%`;
          box.querySelector('span').textContent = shiftLabel(next);
          showGhost(`${shift.name} · ${shiftLabel(next)}`, moved.clientX, moved.clientY);
        };
        const finish = async () => {
          handle.removeEventListener('pointermove', preview);
          handle.removeEventListener('pointerup', finish);
          handle.removeEventListener('pointercancel', cancel);
          hideGhost();
          await save(() => client.updateShift(shift.public_id, resizedShift(shift, minutes)));
        };
        const cancel = () => {
          handle.removeEventListener('pointermove', preview);
          handle.removeEventListener('pointerup', finish);
          handle.removeEventListener('pointercancel', cancel);
          hideGhost();
          renderGrid();
        };
        handle.addEventListener('pointermove', preview);
        handle.addEventListener('pointerup', finish);
        handle.addEventListener('pointercancel', cancel);
      });
      box.append(handle);
    } else {
      box.addEventListener('click', event => { event.stopPropagation(); editShift(shift); });
    }
    box.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); editShift(shift); } });
    box.title = `${shift.name} · ${shiftLabel(shift)}${shift.place ? ` · ${shift.place}` : ''}\nArrastra para mover, o el borde de abajo para cambiar la hora de fin.`;
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
        if (!state.creadoras.length) { feedback('Primero agrega una creadora.', 'error'); return; }
        if (state.clipboard) {
          const copy = state.clipboard;
          state.clipboard = null;
          showClipboard();
          await save(() => client.createShift(pastedShift(copy, key, minutesAt(event))));
          return;
        }
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
  const duplicateButton = shiftDialog?.querySelector('[data-shift-duplicate]');
  const copyButton = shiftDialog?.querySelector('[data-shift-copy]');
  const durationLine = shiftDialog?.querySelector('[data-shift-duration]');
  const notebook = shiftDialog?.querySelector('[data-shift-notebook]');
  const scriptList = shiftDialog?.querySelector('[data-script-list]');
  const scriptForm = shiftDialog?.querySelector('[data-script-form]');
  let editingScript = '';
  const record = shiftDialog?.querySelector('[data-shift-record]');
  const contentList = shiftDialog?.querySelector('[data-content-list]');
  const contentForm = shiftDialog?.querySelector('[data-content-form]');
  const clipboardBar = query('[data-clipboard]');
  const clipboardLabel = query('[data-clipboard-label]');
  let editingShift = '';

  function showDuration() {
    if (!durationLine || !shiftForm) return;
    const from = minutesFromTime(shiftForm.elements.start?.value);
    const to = minutesFromTime(shiftForm.elements.end?.value);
    const label = from === null || to === null ? '' : durationLabel(from, to);
    durationLine.textContent = label ? `Dura ${label}.` : (from !== null && to !== null ? 'La hora de fin debe ser posterior a la de inicio.' : '');
    durationLine.dataset.error = String(Boolean(from !== null && to !== null && !label));
  }

  /** La parte de «lo que pasó»: solo tiene sentido en un turno ya guardado. */
  function renderRecord(shift) {
    if (!record) return;
    record.hidden = !shift;
    if (contentForm) contentForm.hidden = true;
    if (!shift) return;
    for (const radio of shiftForm.querySelectorAll('[name="attended"]')) radio.checked = radio.value === (shift.attended ?? '');
    contentList.replaceChildren();
    const items = shift.content ?? [];
    if (!items.length) {
      contentList.append(node('li', 'Todavía no hay contenido registrado.', 'admin-panel-empty'));
      return;
    }
    for (const entry of items) {
      const item = node('li');
      const body = node('span');
      body.append(node('strong', contentLabel(entry)));
      if (entry.url) {
        const link = node('a', 'Ver publicación');
        link.href = entry.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        body.append(link);
      }
      const remove = node('button', 'Quitar', 'button-quiet');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!confirm(`¿Quitar «${entry.title}» de este turno?`)) return;
        await withShift(() => client.removeContent(editingShift, entry.public_id));
      });
      item.append(body, remove);
      contentList.append(item);
    }
  }

  /** El cuaderno: cada idea es un bloque plegable, porque el guion puede ser largo. */
  function renderNotebook(shift) {
    if (!notebook) return;
    notebook.hidden = !shift;
    if (scriptForm) scriptForm.hidden = true;
    editingScript = '';
    if (!shift) return;
    scriptList.replaceChildren();
    const scripts = shift.scripts ?? [];
    if (!scripts.length) {
      scriptList.append(node('p', 'Todavía no hay guiones. Agrega el primero con el «+».', 'admin-panel-empty'));
      return;
    }
    for (const script of scripts) {
      const block = node('details', undefined, 'shift-script');
      const summary = node('summary');
      summary.append(node('strong', script.title), node('small', scriptSummary(script)));
      block.append(summary);
      const body = node('div', undefined, 'shift-script__body');
      if (script.body) body.append(node('p', script.body));
      if (script.reference_url) {
        const link = node('a', 'Ver la referencia');
        link.href = script.reference_url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        body.append(link);
      }
      const actions = node('div', undefined, 'shift-script__actions');
      const edit = node('button', 'Editar', 'button-quiet');
      edit.type = 'button';
      edit.addEventListener('click', () => openScript(script));
      const remove = node('button', 'Quitar', 'button-quiet');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!confirm(`¿Quitar el guion «${script.title}»?`)) return;
        await withShift(() => client.removeScript(editingShift, script.public_id));
      });
      actions.append(edit, remove);
      body.append(actions);
      block.append(body);
      scriptList.append(block);
    }
  }

  function openScript(script) {
    if (!scriptForm) return;
    editingScript = script?.public_id ?? '';
    scriptForm.hidden = false;
    scriptForm.querySelector('[data-script-title]').value = script?.title ?? '';
    scriptForm.querySelector('[data-script-body]').value = script?.body ?? '';
    scriptForm.querySelector('[data-script-url]').value = script?.reference_url ?? '';
    scriptForm.querySelector('[data-script-title]').focus();
  }

  /** Cada cambio del registro refresca el turno abierto y el calendario detrás. */
  async function withShift(action) {
    try {
      const data = await action();
      if (Array.isArray(data.log)) state.log = data.log;
      if (data.shift) { renderRecord(data.shift); renderNotebook(data.shift); }
      await load(false);
      if (shiftFeedback) { shiftFeedback.textContent = ''; shiftFeedback.dataset.error = 'false'; }
    } catch (error) {
      if (shiftFeedback) { shiftFeedback.textContent = error.message; shiftFeedback.dataset.error = 'true'; }
      if (error.status === 401) fail(error);
    }
  }

  function showClipboard() {
    if (!clipboardBar) return;
    clipboardBar.hidden = state.clipboard === null;
    if (state.clipboard && clipboardLabel) clipboardLabel.textContent = `${state.clipboard.name} · ${shiftLabel(state.clipboard)}`;
  }

  query('[data-clipboard-cancel]')?.addEventListener('click', () => { state.clipboard = null; showClipboard(); feedback(''); });

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
    if (duplicateButton) duplicateButton.hidden = !shift;
    if (copyButton) copyButton.hidden = !shift;
    renderRecord(shift);
    renderNotebook(shift);
    showDuration();
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

  for (const name of ['start', 'end']) shiftForm?.elements[name]?.addEventListener('input', showDuration);

  // Marcar la asistencia guarda al instante, sin tocar «Guardar turno».
  for (const radio of shiftForm?.querySelectorAll('[name="attended"]') ?? []) {
    radio.addEventListener('change', async () => {
      if (!editingShift) return;
      await withShift(() => client.markAttendance(editingShift, radio.value));
    });
  }

  // El «+» abre el formulario del contenido; se pueden registrar varios en el mismo turno.
  shiftDialog?.querySelector('[data-script-add]')?.addEventListener('click', () => openScript(null));
  shiftDialog?.querySelector('[data-script-cancel]')?.addEventListener('click', () => { if (scriptForm) scriptForm.hidden = true; editingScript = ''; });
  shiftDialog?.querySelector('[data-script-save]')?.addEventListener('click', async () => {
    if (!editingShift || !scriptForm) return;
    let payload;
    try {
      payload = scriptPayload({
        title: scriptForm.querySelector('[data-script-title]').value,
        body: scriptForm.querySelector('[data-script-body]').value,
        referenceUrl: scriptForm.querySelector('[data-script-url]').value,
      });
    } catch (error) { if (shiftFeedback) { shiftFeedback.textContent = error.message; shiftFeedback.dataset.error = 'true'; } return; }
    const script = editingScript;
    await withShift(() => (script ? client.updateScript(editingShift, script, payload) : client.addScript(editingShift, payload)));
  });

  shiftDialog?.querySelector('[data-content-add]')?.addEventListener('click', () => {
    if (!contentForm) return;
    contentForm.hidden = false;
    contentForm.querySelector('[data-content-title]').value = '';
    contentForm.querySelector('[data-content-url]').value = '';
    contentForm.querySelector('[data-content-title]').focus();
  });
  shiftDialog?.querySelector('[data-content-cancel]')?.addEventListener('click', () => { if (contentForm) contentForm.hidden = true; });
  shiftDialog?.querySelector('[data-content-save]')?.addEventListener('click', async () => {
    if (!editingShift || !contentForm) return;
    let payload;
    try {
      payload = contentPayload({
        kind: contentForm.querySelector('[data-content-kind]').value,
        title: contentForm.querySelector('[data-content-title]').value,
        url: contentForm.querySelector('[data-content-url]').value,
      });
    } catch (error) { if (shiftFeedback) { shiftFeedback.textContent = error.message; shiftFeedback.dataset.error = 'true'; } return; }
    await withShift(() => client.addContent(editingShift, payload));
    contentForm.hidden = true;
  });

  // Duplicar deja el mismo hueco listo para otra creadora: se guarda como un turno nuevo.
  duplicateButton?.addEventListener('click', async () => {
    const shift = state.shifts.find(item => item.public_id === editingShift);
    if (!shift) return;
    try {
      const data = await client.createShift(duplicatedShift(shift));
      if (Array.isArray(data.log)) state.log = data.log;
      editingShift = data.shift?.public_id ?? '';
      shiftDialog.close();
      await load(false);
      feedback('Turno duplicado. Ábrelo para cambiarle la creadora o la hora.', 'success');
    } catch (error) {
      if (shiftFeedback) { shiftFeedback.textContent = error.status === 409 ? 'Esa creadora ya tiene un turno a esa hora: cambia la creadora o la hora antes de duplicar.' : error.message; shiftFeedback.dataset.error = 'true'; }
    }
  });

  // Copiar guarda el turno para pegarlo donde se toque después.
  copyButton?.addEventListener('click', () => {
    const shift = state.shifts.find(item => item.public_id === editingShift);
    if (!shift) return;
    state.clipboard = { ...shift };
    shiftDialog.close();
    showClipboard();
    feedback('Turno copiado. Toca una hora del calendario para pegarlo.', 'success');
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
