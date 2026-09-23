import { MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';

export const TRAFFIC_LIGHT_LABELS = Object.freeze({ red: 'Rojo · En preparación', yellow: 'Amarillo · En avance', green: 'Verde · Listo' });
export const MEDIA_STATUSES = Object.freeze(['Nuevo', 'En revisión', 'Aprobado', 'Rechazado']);
/** Whether the organisation buys advertising in the medium. Internal: the medium never sees it. */
export const PAID_MEDIA_LABELS = Object.freeze({ no: 'No pautado', yes: 'Pautado' });
/** Who created the record; coordination-created rows are tinted so the team sees which media still have no account. */
export const ORIGIN_LABELS = Object.freeze({ cuenta: 'Con cuenta', coordinacion: 'Cargado por coordinación' });
export const COVERAGE_RESULT_LABELS = Object.freeze({ pendiente: 'Pendiente', link: 'Publicó con link', mencion: 'Mención al aire (sin link)', sin_publicacion: 'No publicó', no_asistio: 'No asistió' });
export const ATTENDANCE_LABELS = Object.freeze({ '': 'Sin registrar', yes: 'Asistió', no: 'No asistió' });
export const CONFIRMATION_LABELS = Object.freeze({ pendiente: 'Sin respuesta', yes: 'Confirmó', no: 'No asistirá' });
export const ADMIN_RECORD_FIELDS = Object.freeze(['media_name', 'media_types', 'frequency', 'tv_channel', 'province', 'city', 'program_name', 'representatives', 'channels', 'followers_validated', 'paid_media', 'contact_name', 'phone', 'contact_email', 'audience_count', 'radio_genre']);
const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
export const MEDIA_TYPE_LABELS = Object.freeze({ radio: 'Radio', tv: 'Televisión', prensa: 'Prensa escrita', digital: 'Medio digital', redes: 'Redes sociales' });
const FILTERS = ['search', 'status', 'province', 'media_type', 'paid_media', 'origin'];
const DETAIL_FIELDS = Object.freeze([
  ['media_name', 'Nombre del medio'], ['media_types', 'Tipo de medio'], ['radio_stations', 'Emisoras y frecuencias'], ['audience_count', 'Oyentes (dato del medio)'], ['radio_genre', 'Género de la radio'], ['tv_channels', 'Canales de televisión'], ['province', 'Provincia'], ['city', 'Ciudad'],
  ['contact_name', 'Persona de contacto'], ['phone', 'Número telefónico'], ['contact_email', 'Correo de contacto'], ['account_email', 'Correo de la cuenta'],
]);
export const CHANNEL_LABELS = Object.freeze({ facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', x: 'X', website: 'Web', otro: 'Otro' });
const LINK_FIELDS = new Set();

export function normalizeMediaFilters(input = {}) {
  const result = {};
  for (const key of FILTERS) {
    const value = String(input[key] ?? '').trim();
    if (value) result[key] = value;
  }
  if (result.status && !MEDIA_STATUSES.includes(result.status)) throw new Error('Selecciona un estado válido.');
  if (result.media_type && !Object.hasOwn(MEDIA_TYPE_LABELS, result.media_type)) throw new Error('Selecciona un tipo de medio válido.');
  if (result.paid_media && !Object.hasOwn(PAID_MEDIA_LABELS, result.paid_media)) throw new Error('Selecciona una opción válida de pauta.');
  if (result.origin && !Object.hasOwn(ORIGIN_LABELS, result.origin)) throw new Error('Selecciona un origen válido.');
  if (result.search && result.search.length > 100) throw new Error('La búsqueda es demasiado larga.');
  result.page = Math.min(1000000, Math.max(1, Number.parseInt(input.page, 10) || 1));
  result.pageSize = [25, 50, 100].includes(Number(input.pageSize)) ? Number(input.pageSize) : 25;
  return result;
}

export function renderMediaSummary(data = {}) {
  return [
    { label: 'Medios', value: data.total ?? 0 },
    { label: 'Nuevos', value: data.byStatus?.Nuevo ?? 0 },
    { label: 'Aprobados', value: data.byStatus?.Aprobado ?? 0 },
    { label: 'Videos recibidos', value: data.videos ?? 0 },
    { label: 'Views validadas', value: new Intl.NumberFormat('es-EC').format(data.views ?? 0) },
  ];
}

/** Media ranked by total validated views; mirrors the server order and tolerates partial rows. */
export function topMediaViews(items = [], limit = 20) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({ ...item, views_total: Math.max(0, Number.parseInt(item?.views_total, 10) || 0), videos_count: Math.max(0, Number.parseInt(item?.videos_count, 10) || 0) }))
    .filter(item => item.views_total > 0 && typeof item.media_name === 'string' && item.media_name.trim() !== '')
    .sort((left, right) => right.views_total - left.views_total || left.media_name.localeCompare(right.media_name, 'es'))
    .slice(0, Math.max(0, Number.parseInt(limit, 10) || 0));
}

/** Media ranked by the followers they declared across all their channels. */
export function topMediaFollowers(items = [], limit = 20) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({ ...item, followers_total: Math.max(0, Number.parseInt(item?.followers_total, 10) || 0) }))
    .filter(item => item.followers_total > 0 && typeof item.media_name === 'string' && item.media_name.trim() !== '')
    .sort((left, right) => right.followers_total - left.followers_total || left.media_name.localeCompare(right.media_name, 'es'))
    .slice(0, Math.max(0, Number.parseInt(limit, 10) || 0));
}

/** Reads the views typed beside each video; every value must be a whole number from 0 to 1.000.000.000. */
export function collectVideoViews(inputs) {
  const views = {};
  for (const input of inputs) {
    const id = String(input.dataset?.videoId ?? '');
    const text = String(input.value ?? '').trim();
    if (!/^[1-9][0-9]{0,15}$/.test(id) || !/^[0-9]{1,10}$/.test(text) || Number(text) > 1000000000) throw new Error('Escribe las views como números enteros, sin puntos ni comas.');
    views[id] = Number(text);
  }
  if (Object.keys(views).length === 0) throw new Error('Este medio todavía no tiene videos.');
  return views;
}

export class MediaAdminError extends Error {
  constructor(status) {
    super(({ 0: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.', 401: 'La sesión venció. Inicia sesión nuevamente.', 403: 'No se autorizó la solicitud. Actualiza la página e intenta de nuevo.', 404: 'El registro no está disponible.', 422: 'Revisa los datos ingresados e intenta de nuevo.', 429: 'Hay demasiados intentos. Espera antes de volver a intentar.' })[status] ?? 'No se pudo completar la solicitud. Intenta de nuevo.');
    this.status = status;
  }
}

export function createMediaAdminClient(baseUrl = API, fetchImplementation = fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  let csrf = '';
  async function request(path, options = {}) {
    if (!/^\/(?:auth\/(?:session|logout)|panel|media-accounts|media-claims|media-events|medios(?:\/export)?)(?:\?[^#]*)?$/.test(path)
      && !/^\/medios\/[a-f0-9]{32}(?:\/(?:delete|notes|password-reset|video-views|videos|photo|details|invite|claim\/(?:approve|reject)))?$/.test(path)
      && !/^\/media-events\/[a-f0-9]{32}(?:\/coverage\/[a-f0-9]{32})?$/.test(path)
      && !/^\/media-accounts\/[a-f0-9]{32}\/delete$/.test(path)) throw new Error('Ruta de API no permitida.');
    const method = (options.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST', 'PATCH'].includes(method)) throw new Error('Método no permitido.');
    const headers = { Accept: !options.blob ? 'application/json' : path.endsWith('/photo') ? 'image/jpeg' : 'text/csv' };
    if (method !== 'GET') {
      if (!csrf) throw new MediaAdminError(403);
      headers['X-CSRF-Token'] = csrf;
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch { throw new MediaAdminError(0); }
    if (!response.ok) throw new MediaAdminError(response.status);
    if (options.blob) return response.blob();
    let data;
    try { data = await response.json(); } catch { throw new MediaAdminError(502); }
    if (typeof data.csrf === 'string') csrf = data.csrf;
    return data;
  }
  return {
    request,
    session: () => request('/auth/session'),
    logout: () => request('/auth/logout', { method: 'POST' }),
    list: filters => request('/medios?' + new URLSearchParams(filters)),
    detail: id => request(`/medios/${id}`),
    photo: id => request(`/medios/${id}/photo`, { blob: true }),
    changeStatus: (id, status, trafficLight, paidMedia) => request(`/medios/${id}`, { method: 'PATCH', body: { status, ...(trafficLight === undefined ? {} : { traffic_light: trafficLight }), ...(paidMedia === undefined ? {} : { paid_media: paidMedia }) } }),
    addNote: (id, body) => request(`/medios/${id}/notes`, { method: 'POST', body: { body } }),
    updateVideoViews: (id, views) => request(`/medios/${id}/video-views`, { method: 'PATCH', body: { video_views: views } }),
    addVideo: (id, url) => request(`/medios/${id}/videos`, { method: 'POST', body: { url } }),
    removeVideo: (id, videoId) => request(`/medios/${id}/videos`, { method: 'PATCH', body: { video_id: videoId } }),
    archive: id => request(`/medios/${id}/delete`, { method: 'POST', body: {} }),
    passwordReset: id => request(`/medios/${id}/password-reset`, { method: 'POST', body: {} }),
    pendingAccounts: () => request('/media-accounts'),
    archiveAccount: id => request(`/media-accounts/${id}/delete`, { method: 'POST', body: {} }),
    export: filters => {
      const { page, pageSize, ...body } = normalizeMediaFilters(filters);
      return request('/medios/export', { method: 'POST', body, blob: true });
    },
    create: body => request('/medios', { method: 'POST', body }),
    updateDetails: (id, body) => request(`/medios/${id}/details`, { method: 'PATCH', body }),
    invite: id => request(`/medios/${id}/invite`, { method: 'POST', body: {} }),
    claims: () => request('/media-claims'),
    resolveClaim: (id, approve) => request(`/medios/${id}/claim/${approve ? 'approve' : 'reject'}`, { method: 'POST', body: {} }),
    panel: () => request('/panel'),
    events: () => request('/media-events'),
    createEvent: body => request('/media-events', { method: 'POST', body }),
    eventCoverage: id => request(`/media-events/${id}`),
    updateCoverage: (eventId, profileId, body) => request(`/media-events/${eventId}/coverage/${profileId}`, { method: 'PATCH', body }),
  };
}

/** Infers the channel kind from a pasted URL so coordination only types links. */
export function channelTypeFor(url) {
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return 'otro'; }
  if (/(^|\.)(facebook\.com|fb\.watch|fb\.com)$/.test(host)) return 'facebook';
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (/(^|\.)tiktok\.com$/.test(host)) return 'tiktok';
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(host)) return 'youtube';
  if (/(^|\.)(x\.com|twitter\.com)$/.test(host)) return 'x';
  return 'website';
}

/** Turns the coordination form into the exact body the API expects; throws a readable message on the first problem. */
export function adminRecordPayload(form) {
  const value = name => String(form.elements.namedItem?.(name)?.value ?? form.elements?.[name]?.value ?? '').trim();
  const types = [...(form.querySelectorAll?.('input[name="media_types"]:checked') ?? [])].map(input => input.value);
  if (!types.length) throw new Error('Marca al menos un tipo de medio.');
  if (value('media_name').length < 2) throw new Error('Escribe el nombre del medio.');
  const representatives = value('representatives').split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    const [name, ...rest] = line.split(/\s+[-–—:]\s+/);
    return { name: name.trim(), role: rest.join(' - ').trim() };
  });
  if (representatives.some(person => person.name.length < 2)) throw new Error('Cada representante necesita un nombre (una línea por persona: Nombre - Cargo).');
  const channels = []; const seen = new Set();
  for (const line of value('channels').split('\n').map(item => item.trim()).filter(Boolean)) {
    const url = /^https?:\/\//i.test(line) ? line : `https://${line}`;
    if (seen.has(url.toLowerCase())) continue;
    seen.add(url.toLowerCase());
    channels.push({ type: channelTypeFor(url), url, followers: null });
  }
  const followers = value('followers_validated');
  if (followers && !/^\d{1,10}$/.test(followers)) throw new Error('Los seguidores validados deben ser un número entero.');
  const audience = value('audience_count');
  if (audience && !/^\d{1,9}$/.test(audience)) throw new Error('Los oyentes deben ser un número entero.');
  return {
    media_name: value('media_name'), media_types: types, frequency: value('frequency'), tv_channel: value('tv_channel'),
    province: value('province'), city: value('city'), program_name: value('program_name'), representatives, channels,
    followers_validated: followers ? Number(followers) : null, audience_count: audience ? Number(audience) : null,
    radio_genre: value('radio_genre'), paid_media: value('paid_media') === 'yes' ? 'yes' : 'no',
    contact_name: value('contact_name'), phone: value('phone'), contact_email: value('contact_email'),
  };
}

/** Fills the coordination form from a record so the same dialog edits existing media. */
export function fillAdminRecordForm(form, data = {}) {
  const set = (name, text) => { const field = form.elements.namedItem?.(name); if (field) field.value = text ?? ''; };
  set('media_name', data.media_name);
  for (const input of form.querySelectorAll?.('input[name="media_types"]') ?? []) input.checked = (data.media_types ?? []).includes(input.value);
  set('frequency', (data.radio_stations ?? []).map(station => station.frequency).join('\n'));
  set('tv_channel', (data.tv_channels ?? []).join('\n'));
  set('audience_count', data.audience_count == null ? '' : String(data.audience_count));
  set('radio_genre', data.radio_genre ?? '');
  set('province', data.province); set('city', data.city); set('program_name', data.program_name);
  set('representatives', (data.representatives ?? []).map(person => person.role ? `${person.name} - ${person.role}` : person.name).join('\n'));
  set('channels', (data.channels ?? []).map(channel => channel.url).join('\n'));
  set('followers_validated', data.followers_validated == null ? '' : String(data.followers_validated));
  set('paid_media', data.paid_media === 'yes' ? 'yes' : 'no');
  set('contact_name', data.contact_name); set('phone', data.phone); set('contact_email', data.contact_email);
}

/** Coverage form controls of one row → API body. */
export function coveragePayload(controls) {
  const links = String(controls.links ?? '').split('\n').map(line => line.trim()).filter(Boolean).map(line => (/^https?:\/\//i.test(line) ? line : `https://${line}`));
  const people = Number.parseInt(controls.people_count, 10);
  const pick = value => (value === 'yes' || value === 'no' ? value : null);
  return { contracted: pick(controls.contracted), result: Object.hasOwn(COVERAGE_RESULT_LABELS, controls.result) ? controls.result : 'pendiente', people_count: Number.isFinite(people) ? Math.max(0, Math.min(200, people)) : 0, links: [...new Set(links)], note: String(controls.note ?? '').trim(), attended: pick(controls.attended), confirmation: pick(controls.confirmation) };
}

/** Big-number cards in the order the team reads them; the id list drives the click filter. */
export function coverageBuckets(summary = {}) {
  const order = ['todos', 'confirmaron', 'no_confirmaron', 'asistieron', 'no_asistieron', 'pautados', 'pautados_publicaron', 'pautados_sin_publicacion', 'sin_contrato_publicaron', 'sin_contrato_sin_publicacion'];
  // Asistieron + No asistieron cubren el total, porque la asistencia es un check.
  return order.filter(key => summary[key]).map(key => ({ key, label: summary[key].label, count: (summary[key].ids ?? []).length, ids: new Set(summary[key].ids ?? []), alert: ['pautados_sin_publicacion', 'no_confirmaron', 'no_asistieron'].includes(key) }));
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
function feedback(element, message, kind = '') {
  element.textContent = message;
  element.dataset.error = String(kind === 'error');
  element.dataset.success = String(kind === 'success');
}
/** Human-readable value for the platform fields of a record. */
export function describeField(key, value) {
  if (key === 'media_types') return (Array.isArray(value) ? value : []).map(type => MEDIA_TYPE_LABELS[type] ?? type).join(' · ');
  if (key === 'radio_stations') return (Array.isArray(value) ? value : []).map(station => `${station.name} — ${station.frequency}`).join('\n');
  if (key === 'tv_channels') return (Array.isArray(value) ? value : []).join('\n');
  if (key === 'audience_count') return value == null ? '' : new Intl.NumberFormat('es-EC').format(value);
  return value == null ? '' : String(value);
}

/** Only https links become anchors; anything else is shown as plain text. */
export function safeLink(value) {
  try { const url = new URL(String(value ?? '')); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
}
function linkNode(value) {
  const href = safeLink(value);
  if (!href) return node('span', value || '—');
  const anchor = node('a', value); anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
  return anchor;
}
function dateTime(value) {
  if (!value) return '—';
  const parsed = new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(parsed);
}

export async function initializeMediaAdmin() {
  const panel = document.querySelector('[data-admin-medios]');
  if (!panel) return;
  const navigation = document.querySelector('[data-admin-navigation]');
  const compactNavigation = globalThis.matchMedia?.('(max-width: 1120px)');
  const applyNavigation = compact => { if (navigation) navigation.open = !compact; };
  applyNavigation(compactNavigation?.matches ?? false);
  compactNavigation?.addEventListener('change', event => applyNavigation(event.matches));

  const query = selector => panel.querySelector(selector);
  const status = query('[data-admin-feedback]');
  const retry = query('[data-session-retry]');
  const configuredBase = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredBase || runtime.apiBase;
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) {
    feedback(status, 'La configuración de acceso no es válida.', 'error'); return;
  }
  const client = createMediaAdminClient(base);
  const form = query('[data-admin-filters]');
  const records = query('[data-records]');
  const region = query('[data-records-region]');
  const dashboard = query('[data-admin-dashboard]');
  const viewsLeaderboard = query('[data-media-views-leaderboard]');
  const viewsLeaderboardCount = query('[data-media-views-leaderboard-count]');
  const followersLeaderboard = query('[data-media-followers-leaderboard]');
  const followersLeaderboardCount = query('[data-media-followers-leaderboard-count]');
  const previous = query('[data-previous]');
  const next = query('[data-next]');
  const exportButton = query('[data-admin-export]');
  const pendingAccounts = query('[data-pending-accounts]');
  const pendingCount = query('[data-pending-count]');
  const pendingMessage = query('[data-pending-message]');
  const logout = document.querySelector('[data-admin-logout]');
  const sidebarUser = document.querySelector('[data-admin-sidebar-user]');
  const dialog = query('[data-detail]');
  const detailFeedback = query('[data-detail-feedback]');
  const detailContent = query('[data-detail-content]');
  const notes = query('[data-notes]');
  const statusForm = query('[data-status-form]');
  const noteForm = query('[data-note-form]');
  const resetButton = query('[data-admin-reset]');
  const resetOutput = query('[data-reset-output]');
  const resetInput = query('[data-reset-url]');
  const resetFeedback = query('[data-reset-feedback]');
  const deleteButton = query('[data-admin-delete]');
  let filters = normalizeMediaFilters();
  let pagination = { page: 1, pages: 0 };
  let listGeneration = 0;
  let detailGeneration = 0;
  let currentId = null;
  let opener = null;
  let photoUrl = '';
  let detailHasPhoto = false;

  const clearDetail = () => {
    currentId = null; detailGeneration++;
    if (photoUrl) { URL.revokeObjectURL(photoUrl); photoUrl = ''; }
    detailContent.replaceChildren(); notes.replaceChildren(); noteForm.reset();
    resetInput.value = ''; resetOutput.hidden = true; resetButton.disabled = true; deleteButton.disabled = true;
    feedback(resetFeedback, ''); feedback(detailFeedback, '');
  };
  const fail = (error, target = status) => {
    if (error.status === 401) { clearDetail(); location.replace('/admin/'); return; }
    feedback(target, error.message, 'error');
  };
  globalThis.addEventListener?.('pagehide', clearDetail);
  globalThis.addEventListener?.('pageshow', event => { if (event.persisted) location.reload(); });

  function renderFollowersLeaderboard(items = []) {
    const ranking = topMediaFollowers(items, 20);
    followersLeaderboard.replaceChildren();
    followersLeaderboardCount.textContent = ranking.length ? `${ranking.length} medios` : 'Sin datos';
    if (!ranking.length) { followersLeaderboard.append(node('li', 'Todavía no hay medios con seguidores declarados.')); return; }
    const format = new Intl.NumberFormat('es-EC');
    for (const [index, record] of ranking.entries()) {
      const item = node('li'); const body = node('div');
      body.append(node('strong', record.media_name));
      body.append(node('small', [record.channels_count === 1 ? '1 canal' : `${record.channels_count ?? 0} canales`, CHANNEL_LABELS[record.top_channel] ? `mayor: ${CHANNEL_LABELS[record.top_channel]}` : ''].filter(Boolean).join(' · ')));
      item.append(node('span', String(index + 1).padStart(2, '0'), 'followers-leaderboard__rank'), body, node('span', format.format(record.followers_total), 'followers-leaderboard__value'));
      if (/^[a-f0-9]{32}$/.test(record.public_id ?? '')) {
        const open = node('button', 'Ver', 'button-quiet'); open.type = 'button';
        open.setAttribute('aria-label', 'Ver detalle de ' + record.media_name);
        open.addEventListener('click', () => openDetail(record.public_id, open));
        item.append(open);
      }
      followersLeaderboard.append(item);
    }
  }

  function renderViewsLeaderboard(items = []) {
    const ranking = topMediaViews(items, 20);
    viewsLeaderboard.replaceChildren();
    viewsLeaderboardCount.textContent = ranking.length ? `${ranking.length} medios` : 'Sin datos';
    if (!ranking.length) { viewsLeaderboard.append(node('li', 'Todavía no hay videos con views registradas.')); return; }
    const format = new Intl.NumberFormat('es-EC');
    for (const [index, record] of ranking.entries()) {
      const item = node('li');
      const body = node('div');
      body.append(node('strong', record.media_name));
      body.append(node('small', [record.frequency_channel, record.videos_count === 1 ? '1 video' : `${record.videos_count} videos`].filter(Boolean).join(' · ')));
      item.append(node('span', String(index + 1).padStart(2, '0'), 'followers-leaderboard__rank'), body, node('span', format.format(record.views_total), 'followers-leaderboard__value'));
      if (/^[a-f0-9]{32}$/.test(record.public_id ?? '')) {
        const open = node('button', 'Ver', 'button-quiet'); open.type = 'button';
        open.setAttribute('aria-label', 'Ver detalle de ' + record.media_name);
        open.addEventListener('click', () => openDetail(record.public_id, open));
        item.append(open);
      }
      viewsLeaderboard.append(item);
    }
  }

  async function list() {
    const generation = ++listGeneration;
    region.setAttribute('aria-busy', 'true');
    previous.disabled = next.disabled = true;
    feedback(query('[data-list-message]'), 'Cargando registros…');
    try {
      const data = await client.list(filters);
      if (generation !== listGeneration) return;
      pagination = data.pagination;
      if (pagination.pages > 0 && pagination.page > pagination.pages) { filters.page = pagination.pages; return list(); }
      dashboard.replaceChildren();
      for (const metric of renderMediaSummary(data.summary)) {
        const block = node('dl'); block.append(node('dt', metric.label), node('dd', metric.value)); dashboard.append(block);
      }
      dashboard.setAttribute('aria-busy', 'false');
      renderViewsLeaderboard(data.topViews);
      renderFollowersLeaderboard(data.topFollowers);
      records.replaceChildren();
      for (const record of data.items) {
        const row = node('tr');
        const cell = (label, value, secondary) => {
          const td = node('td'); td.dataset.label = label;
          td.append(node('span', value)); if (secondary) td.append(node('small', secondary)); row.append(td); return td;
        };
        cell('Medio', record.media_name, describeField('media_types', record.media_types)).className = 'record-name';
        cell('Frecuencia', record.frequency_channel || '—', record.audience_count == null ? '' : `${describeField('audience_count', record.audience_count)} oyentes · ${record.radio_genre}`);
        cell('Ubicación', record.city || '—', record.province);
        const channels = node('span', undefined, 'admin-media-channels');
        for (const channel of Array.isArray(record.channels) ? record.channels : []) {
          const href = safeLink(channel?.url);
          if (!href) continue;
          const anchor = node('a', CHANNEL_LABELS[channel.type] ?? 'Canal'); anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.title = href;
          channels.append(anchor);
        }
        if (!channels.childElementCount) channels.textContent = '—';
        cell('Canales', '').replaceChildren(channels);
        if (record.followers_total > 0) channels.append(node('small', `${new Intl.NumberFormat('es-EC').format(record.followers_total)} seguidores declarados`));
        cell('Videos', record.videos_count === 1 ? '1 video' : `${record.videos_count ?? 0} videos`, `${new Intl.NumberFormat('es-EC').format(record.views_total ?? 0)} views`);
        // Lo que viene de los eventos: publicaciones registradas por coordinación y asistencias confirmadas.
        cell('Eventos', (record.event_links_count ?? 0) === 1 ? '1 publicación' : `${record.event_links_count ?? 0} publicaciones`, (record.events_attended ?? 0) === 1 ? 'asistió a 1 evento' : `asistió a ${record.events_attended ?? 0} eventos`);
        cell('Registro', dateTime(record.submitted_at));
        const badge = node('span', record.status, 'status-badge'); badge.dataset.status = record.status;
        const lightKey = Object.hasOwn(TRAFFIC_LIGHT_LABELS, record.traffic_light) ? record.traffic_light : 'red';
        const lightMark = node('span', TRAFFIC_LIGHT_LABELS[lightKey], 'admin-media-light'); lightMark.dataset.light = lightKey;
        const paidKey = Object.hasOwn(PAID_MEDIA_LABELS, record.paid_media) ? record.paid_media : 'no';
        const paidMark = node('span', PAID_MEDIA_LABELS[paidKey], 'admin-media-paid'); paidMark.dataset.paid = paidKey;
        cell('Estado y semáforo', '').replaceChildren(badge, lightMark);
        cell('Pauta', '').replaceChildren(paidMark);
        const originKey = Object.hasOwn(ORIGIN_LABELS, record.origin) ? record.origin : 'cuenta';
        row.dataset.origin = originKey;
        const originMark = node('span', originKey === 'cuenta' ? 'Con cuenta' : record.linked ? 'Coordinación · vinculado' : record.claim_pending ? 'Coordinación · vinculación pendiente' : 'Coordinación · sin cuenta', 'admin-media-origin'); originMark.dataset.origin = originKey; originMark.dataset.linked = String(Boolean(record.linked));
        cell('Origen', '').replaceChildren(originMark);
        const open = node('button', 'Ver detalle', 'button-quiet'); open.type = 'button';
        open.setAttribute('aria-label', 'Ver detalle de ' + record.media_name);
        open.addEventListener('click', () => openDetail(record.public_id, open));
        cell('Acciones', '').replaceChildren(open); records.append(row);
      }
      query('[data-record-count]').textContent = `${pagination.total} resultados`;
      query('[data-page-label]').textContent = pagination.pages ? `Página ${pagination.page} de ${pagination.pages}` : 'Sin páginas';
      feedback(query('[data-list-message]'), data.items.length ? '' : 'No hay registros con estos filtros.');
    } catch (error) {
      if (generation !== listGeneration) return;
      records.replaceChildren();
      query('[data-record-count]').textContent = 'No disponible';
      pagination = { page: 1, pages: 0 };
      query('[data-page-label]').textContent = 'Sin páginas';
      fail(error, query('[data-list-message]'));
    } finally {
      if (generation === listGeneration) {
        region.setAttribute('aria-busy', 'false');
        previous.disabled = pagination.page <= 1;
        next.disabled = pagination.page >= pagination.pages;
      }
    }
  }

  async function pending() {
    feedback(pendingMessage, 'Cargando cuentas…');
    try {
      const data = await client.pendingAccounts();
      pendingAccounts.replaceChildren();
      for (const account of data.items) {
        const row = node('tr');
        for (const [label, value] of [['Correo', account.email], ['Creada', dateTime(account.created_at)], ['Último acceso', dateTime(account.last_login_at)]]) {
          const td = node('td', value); td.dataset.label = label; row.append(td);
        }
        const remove = node('button', 'Retirar cuenta', 'button-quiet'); remove.type = 'button';
        remove.setAttribute('aria-label', 'Retirar la cuenta ' + account.email);
        remove.addEventListener('click', async () => {
          if (remove.dataset.confirm !== 'true') { remove.dataset.confirm = 'true'; remove.textContent = 'Confirmar retiro'; return; }
          remove.disabled = true;
          try { await client.archiveAccount(account.public_id); await pending(); }
          catch (error) { remove.disabled = false; fail(error, pendingMessage); }
        });
        const actions = node('td'); actions.dataset.label = 'Acciones'; actions.append(remove); row.append(actions);
        pendingAccounts.append(row);
      }
      pendingCount.textContent = String(data.items.length);
      // Accounts without a saved record are easy to miss: surface them as soon as any exists.
      if (data.items.length > 0) query('[data-pending-panel]').open = true;
      feedback(pendingMessage, data.items.length ? '' : 'No hay cuentas pendientes.');
    } catch (error) { pendingCount.textContent = '—'; fail(error, pendingMessage); }
  }

  const claimsRows = query('[data-claims-rows]');
  const claimsCount = query('[data-claims-count]');
  const claimsMessage = query('[data-claims-message]');
  async function claims() {
    if (!claimsRows) return;
    try {
      const data = await client.claims();
      claimsRows.replaceChildren();
      for (const claim of data.items) {
        const row = node('tr');
        for (const [label, value] of [['Medio', claim.media_name], ['Ciudad', claim.city || '—'], ['Cuenta', claim.email], ['Solicitado', dateTime(claim.requested_at)]]) { const td = node('td', value); td.dataset.label = label; row.append(td); }
        const actions = node('td'); actions.dataset.label = 'Acciones';
        const open = node('button', 'Revisar', 'button-quiet'); open.type = 'button'; open.addEventListener('click', () => openDetail(claim.public_id, open));
        actions.append(open); row.append(actions); claimsRows.append(row);
      }
      claimsCount.textContent = String(data.items.length);
      if (data.items.length > 0) query('[data-claims-panel]').open = true;
      feedback(claimsMessage, data.items.length ? '' : 'No hay solicitudes de vinculación.');
    } catch (error) { claimsCount.textContent = '—'; fail(error, claimsMessage); }
  }

  const recordDialog = document.querySelector('[data-record-dialog]');
  const recordForm = recordDialog?.querySelector('[data-record-form]');
  const recordFeedback = recordDialog?.querySelector('[data-record-feedback]');
  let recordEditing = null;
  function openRecordDialog(data = null) {
    if (!recordDialog || !recordForm) return;
    recordEditing = data?.public_id ?? null;
    recordForm.reset(); fillAdminRecordForm(recordForm, data ?? {});
    recordDialog.querySelector('[data-record-title]').textContent = recordEditing ? `Editar ${data.media_name}` : 'Agregar medio';
    feedback(recordFeedback, recordEditing ? 'Completa o corrige la información cargada por coordinación.' : 'Solo el nombre y el tipo son obligatorios. El medio podrá vincular su cuenta después.');
    recordDialog.showModal(); recordForm.elements.namedItem('media_name').focus();
  }
  recordForm?.addEventListener('submit', async event => {
    event.preventDefault();
    let body;
    try { body = adminRecordPayload(recordForm); } catch (error) { feedback(recordFeedback, error.message, 'error'); return; }
    recordForm.querySelector('fieldset').disabled = true; feedback(recordFeedback, 'Guardando…');
    try {
      if (recordEditing) {
        const editing = recordEditing; const generationAtSave = detailGeneration;
        await client.updateDetails(editing, body); recordDialog.close(); await list();
        if (dialog.open && currentId === editing && generationAtSave === detailGeneration) { await loadDetail(editing, generationAtSave); feedback(detailFeedback, 'Datos actualizados.', 'success'); }
        else feedback(status, 'Datos actualizados.', 'success');
      } else {
        const created = await client.create(body); recordDialog.close(); await list();
        feedback(status, `Medio ${created.media_name} creado por coordinación.`, 'success');
      }
    } catch (error) {
      feedback(recordFeedback, error.status === 409 ? 'Ya existe un medio con ese nombre. Búscalo en la lista y complétalo en lugar de crear otro.' : error.message, 'error');
    } finally { recordForm.querySelector('fieldset').disabled = false; }
  });
  recordDialog?.querySelector('[data-record-close]')?.addEventListener('click', () => recordDialog.close());
  query('[data-admin-add]')?.addEventListener('click', () => openRecordDialog());

  async function loadDetail(id, generation) {
    const data = await client.detail(id);
    if (generation !== detailGeneration) return false;
    const submitted = node('p', `Registrado: ${dateTime(data.submitted_at)} · Actualizado: ${dateTime(data.updated_at)} · Último acceso: ${dateTime(data.last_login_at)}`);
    const dl = node('dl', undefined, 'detail-fields');
    for (const [key, label] of DETAIL_FIELDS) {
      const field = node('div'); const value = node('dd');
      if (LINK_FIELDS.has(key)) value.append(linkNode(data[key])); else { value.textContent = describeField(key, data[key]) || '—'; if (['radio_stations', 'tv_channels'].includes(key)) value.style.whiteSpace = 'pre-line'; }
      field.append(node('dt', label), value); dl.append(field);
    }
    const channelField = node('div'); const channelValue = node('dd');
    const channelList = node('ul', undefined, 'admin-media-channel-list');
    for (const channel of Array.isArray(data.channels) ? data.channels : []) {
      const item = node('li'); item.append(node('strong', `${CHANNEL_LABELS[channel.type] ?? 'Canal'}: `), linkNode(channel.url));
      if (Number.isInteger(channel.followers)) item.append(node('small', ` · ${new Intl.NumberFormat('es-EC').format(channel.followers)} seguidores`));
      channelList.append(item);
    }
    channelValue.append(channelList.childElementCount ? channelList : node('span', '—'));
    channelField.append(node('dt', 'Redes sociales y páginas web'), channelValue); dl.append(channelField);
    const consentLabels = { conditions: 'Buenas prácticas y condiciones', privacy: 'Política de Privacidad', image: 'Uso de imagen y contenido' };
    for (const [key, label] of Object.entries(consentLabels)) {
      const answer = data.consents?.[key];
      const field = node('div');
      field.append(node('dt', label), node('dd', !answer ? 'Sin registro' : `${answer.accepted ? 'Aceptado' : 'No autorizado'} · ${dateTime(answer.recorded_at)}`));
      dl.append(field);
    }
    const videos = node('section', undefined, 'notes-section');
    const total = (data.videos ?? []).length;
    videos.append(node('h3', total === 1 ? 'Videos publicados (1)' : `Videos publicados (${total})`));
    if (total === 0) videos.append(node('p', 'Este medio todavía no ha agregado links de video.'));
    const videoList = node('ol', undefined, 'admin-media-videos');
    const viewInputs = [];
    for (const video of data.videos ?? []) {
      const item = node('li');
      const info = node('div'); info.append(linkNode(video.url), node('small', dateTime(video.created_at)));
      const label = node('label', 'Views validadas');
      const input = node('input'); input.type = 'number'; input.min = '0'; input.max = '1000000000'; input.step = '1'; input.inputMode = 'numeric';
      input.value = String(video.views_count ?? 0); input.dataset.videoId = String(video.id);
      input.setAttribute('aria-label', 'Views validadas de ' + video.url);
      label.append(input); viewInputs.push(input);
      const remove = node('button', 'Quitar', 'button-quiet'); remove.type = 'button';
      remove.setAttribute('aria-label', 'Quitar el link ' + video.url);
      remove.addEventListener('click', async () => {
        if (remove.dataset.confirm !== 'true') { remove.dataset.confirm = 'true'; remove.textContent = 'Confirmar'; return; }
        const generationAtClick = detailGeneration;
        remove.disabled = true;
        try { await client.removeVideo(id, video.id); await list(); if (generationAtClick !== detailGeneration) return; await loadDetail(id, generationAtClick); feedback(detailFeedback, 'Link retirado.', 'success'); }
        catch (error) { remove.disabled = false; fail(error, detailFeedback); }
      });
      item.append(info, label, remove); videoList.append(item);
    }
    videos.append(videoList);
    // Coordination reports links for media without an account, so every record can be followed up on.
    const addVideo = node('div', undefined, 'admin-media-add-video');
    const addInput = node('input'); addInput.type = 'url'; addInput.placeholder = 'https://…'; addInput.maxLength = 500;
    addInput.setAttribute('aria-label', 'Link de una publicación de este medio');
    const addButton = node('button', 'Agregar link', 'button-quiet'); addButton.type = 'button';
    const addFeedback = node('p', '', 'feedback'); addFeedback.setAttribute('role', 'status'); addFeedback.setAttribute('aria-live', 'polite');
    const submitVideo = async () => {
      const url = addInput.value.trim();
      if (!url) { feedback(addFeedback, 'Pega el link de la publicación.', 'error'); return; }
      const generationAtClick = detailGeneration;
      addButton.disabled = true; feedback(addFeedback, 'Guardando…');
      try {
        await client.addVideo(id, url);
        addInput.value = '';
        await list();
        if (generationAtClick !== detailGeneration) return;
        await loadDetail(id, generationAtClick);
        feedback(detailFeedback, 'Link agregado al medio.', 'success');
      } catch (error) {
        addButton.disabled = false;
        if (error.status === 401) fail(error);
        else feedback(addFeedback, error.status === 409 ? 'Ese link ya está registrado en este medio.' : error.message, 'error');
      }
    };
    addButton.addEventListener('click', submitVideo);
    addInput.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); submitVideo(); } });
    addVideo.append(node('label', 'Agregar una publicación de este medio'), addInput, addButton, addFeedback);
    videos.append(addVideo);
    if (total > 0) {
      const save = node('button', 'Guardar views', 'button-primary'); save.type = 'button';
      const saved = node('p', '', 'feedback'); saved.setAttribute('role', 'status'); saved.setAttribute('aria-live', 'polite');
      save.addEventListener('click', async () => {
        const generationAtClick = detailGeneration;
        try {
          const views = collectVideoViews(viewInputs);
          save.disabled = true; feedback(saved, 'Guardando…');
          await client.updateVideoViews(id, views);
          await list();
          if (generationAtClick !== detailGeneration) return;
          await loadDetail(id, generationAtClick);
          if (generationAtClick === detailGeneration) feedback(detailFeedback, 'Views actualizadas. El Top 20 ya refleja el cambio.', 'success');
        } catch (error) {
          save.disabled = false;
          if (error.status === 401) fail(error); else feedback(saved, error.message, 'error');
        }
      });
      videos.append(save, saved);
    }
    detailHasPhoto = data.photo?.available === true;
    const photo = node('section', undefined, 'admin-photo');
    photo.append(node('h3', 'Foto de la persona responsable (obligatoria)'));
    if (data.photo?.available) {
      const image = node('img'); image.alt = 'Foto de la persona responsable del medio'; image.hidden = true;
      const state = node('p', 'Cargando fotografía…');
      photo.append(state, image);
      client.photo(id).then((blob) => {
        if (generation !== detailGeneration) return;
        photoUrl = URL.createObjectURL(blob); image.src = photoUrl; image.hidden = false; state.textContent = `Subida: ${dateTime(data.photo.created_at)}`;
      }).catch(() => { state.textContent = 'No se pudo cargar la fotografía.'; });
    } else photo.append(node('p', 'Falta la foto de la persona responsable. El registro no se puede aprobar hasta que el medio la suba.'));
    const coordination = node('section', undefined, 'notes-section admin-media-coordination');
    coordination.append(node('h3', 'Ficha de coordinación'));
    const originText = data.origin === 'coordinacion' ? (data.linked ? 'Cargado por coordinación · ya vinculado a una cuenta' : 'Cargado por coordinación · sin cuenta') : 'Creado por el propio medio con su cuenta';
    const coordinationList = node('dl', undefined, 'detail-fields');
    for (const [label, text] of [['Origen', originText], ['Programa', data.program_name || '—'], ['Representantes', (data.representatives ?? []).map(person => person.role ? `${person.name} (${person.role})` : person.name).join('\n') || '—'], ['Seguidores validados por coordinación', data.followers_validated == null ? '—' : new Intl.NumberFormat('es-EC').format(data.followers_validated)]]) {
      const field = node('div'); const value = node('dd', text); value.style.whiteSpace = 'pre-line'; field.append(node('dt', label), value); coordinationList.append(field);
    }
    coordination.append(coordinationList);
    const edit = node('button', 'Editar datos de coordinación', 'button-quiet'); edit.type = 'button';
    edit.addEventListener('click', () => openRecordDialog(data));
    coordination.append(edit);
    if (data.claim) {
      const claimBox = node('div', undefined, 'admin-media-claim');
      claimBox.append(node('p', `La cuenta ${data.claim.email} pide vincularse a este medio (${dateTime(data.claim.requested_at)}). Confirma solo si corresponde al medio.`));
      const approve = node('button', 'Aprobar vinculación', 'button-primary'); approve.type = 'button';
      const reject = node('button', 'Rechazar', 'button-quiet'); reject.type = 'button';
      for (const [button, ok] of [[approve, true], [reject, false]]) button.addEventListener('click', async () => {
        const generationAtClick = detailGeneration; approve.disabled = reject.disabled = true;
        try { await client.resolveClaim(id, ok); await Promise.all([list(), claims()]); if (generationAtClick !== detailGeneration) return; await loadDetail(id, generationAtClick); feedback(detailFeedback, ok ? 'Cuenta vinculada al medio.' : 'Solicitud rechazada.', 'success'); }
        catch (error) { approve.disabled = reject.disabled = false; fail(error, detailFeedback); }
      });
      claimBox.append(approve, reject); coordination.append(claimBox);
    } else if (data.invitation_allowed) {
      const invite = node('button', 'Generar enlace de invitación', 'button-quiet'); invite.type = 'button';
      const inviteOutput = node('div', undefined, 'admin-media-invite'); inviteOutput.hidden = true;
      const inviteInput = node('input'); inviteInput.type = 'text'; inviteInput.readOnly = true; inviteInput.setAttribute('aria-label', 'Enlace de invitación');
      const copy = node('button', 'Copiar enlace', 'button-quiet'); copy.type = 'button';
      const inviteHelp = node('p', 'Con este enlace el medio crea su cuenta ya vinculada a esta ficha. Vale siete días y un solo uso.', 'feedback');
      invite.addEventListener('click', async () => {
        invite.disabled = true;
        try { const result = await client.invite(id); inviteInput.value = result.invitationUrl; inviteOutput.hidden = false; feedback(detailFeedback, 'Enlace generado. Entrégalo por el canal acordado con el medio.', 'success'); }
        catch (error) { fail(error, detailFeedback); }
        finally { invite.disabled = false; }
      });
      copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(inviteInput.value); feedback(detailFeedback, 'Enlace copiado.', 'success'); } catch { inviteInput.select(); } });
      inviteOutput.append(inviteInput, copy, inviteHelp); coordination.append(invite, inviteOutput);
    }
    const coverage = node('section', undefined, 'notes-section');
    coverage.append(node('h3', (data.coverage ?? []).length === 1 ? 'Cobertura de eventos (1)' : `Cobertura de eventos (${(data.coverage ?? []).length})`));
    if (!(data.coverage ?? []).length) coverage.append(node('p', 'Sin cobertura registrada. Se administra desde el submenú Eventos.'));
    const coverageList = node('ul', undefined, 'admin-media-coverage-list');
    for (const entry of data.coverage ?? []) {
      const item = node('li');
      item.append(node('strong', entry.event_name), node('span', ` · ${entry.event_date ?? 'sin fecha'} · ${entry.contracted === 'yes' ? 'Pautado' : entry.contracted === 'no' ? 'Sin contrato' : 'Contrato sin dato'} · ${CONFIRMATION_LABELS[entry.confirmation ?? 'pendiente']} · ${ATTENDANCE_LABELS[entry.attended ?? '']} · ${COVERAGE_RESULT_LABELS[entry.result] ?? entry.result} · ${entry.people_count} persona(s)`));
      for (const url of entry.links ?? []) { item.append(node('br'), linkNode(url)); }
      coverageList.append(item);
    }
    coverage.append(coverageList);
    detailContent.replaceChildren(submitted, coordination, photo, dl, videos, coverage);
    statusForm.elements.status.value = data.status;
    statusForm.elements.traffic_light.value = Object.hasOwn(TRAFFIC_LIGHT_LABELS, data.traffic_light) ? data.traffic_light : 'red';
    statusForm.elements.paid_media.value = Object.hasOwn(PAID_MEDIA_LABELS, data.paid_media) ? data.paid_media : 'no';
    notes.replaceChildren();
    for (const note of data.notes ?? []) {
      const item = node('li'); item.append(node('p', note.body), node('small', `${note.author} · ${dateTime(note.created_at)}`)); notes.append(item);
    }
    resetButton.disabled = !data.account_active; deleteButton.disabled = false;
    delete deleteButton.dataset.confirm; deleteButton.textContent = 'Retirar registro';
    return true;
  }
  async function openDetail(id, trigger) {
    clearDetail();
    currentId = id; opener = trigger;
    const generation = detailGeneration;
    statusForm.querySelector('fieldset').disabled = noteForm.querySelector('fieldset').disabled = true;
    dialog.showModal(); query('#detail-title').focus();
    feedback(detailFeedback, 'Cargando detalle…');
    try {
      if (await loadDetail(id, generation)) {
        statusForm.querySelector('fieldset').disabled = noteForm.querySelector('fieldset').disabled = false;
        feedback(detailFeedback, '');
      }
    } catch (error) { if (generation === detailGeneration) fail(error, detailFeedback); }
  }
  query('[data-detail-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { clearDetail(); (opener?.isConnected ? opener : query('#records-title')).focus(); });

  async function mutate(event, action, success, refreshList = false) {
    event?.preventDefault();
    const id = currentId; const generation = detailGeneration;
    if (!id) return;
    statusForm.querySelector('fieldset').disabled = noteForm.querySelector('fieldset').disabled = true;
    feedback(detailFeedback, 'Guardando…');
    try {
      await action(id);
      if (refreshList) await list();
      if (generation !== detailGeneration) return;
      await loadDetail(id, generation);
      if (generation === detailGeneration) feedback(detailFeedback, success, 'success');
    } catch (error) { if (generation === detailGeneration) fail(error, detailFeedback); }
    finally { if (generation === detailGeneration) statusForm.querySelector('fieldset').disabled = noteForm.querySelector('fieldset').disabled = false; }
  }
  statusForm.addEventListener('submit', (event) => {
    if (statusForm.elements.status.value === 'Aprobado' && !detailHasPhoto) {
      event.preventDefault(); event.stopImmediatePropagation();
      feedback(detailFeedback, 'No se puede aprobar: falta la foto de la persona responsable del medio.', 'error');
    }
  });
  statusForm.addEventListener('submit', event => mutate(event, id => client.changeStatus(id, statusForm.elements.status.value, statusForm.elements.traffic_light.value, statusForm.elements.paid_media.value), 'Estado, semáforo y pauta actualizados.', true));
  noteForm.addEventListener('submit', event => {
    const body = noteForm.elements.body.value.trim();
    if (!body) { event.preventDefault(); feedback(detailFeedback, 'Escribe una nota antes de guardar.', 'error'); return; }
    mutate(event, async id => { await client.addNote(id, body); noteForm.reset(); }, 'Nota guardada.');
  });
  resetButton.addEventListener('click', async () => {
    const id = currentId; const generation = detailGeneration;
    resetButton.disabled = true; resetOutput.hidden = true; resetInput.value = '';
    feedback(resetFeedback, 'Generando enlace…');
    try {
      const data = await client.passwordReset(id);
      if (generation !== detailGeneration) return;
      resetInput.value = data.resetUrl; resetOutput.hidden = false;
      feedback(resetFeedback, 'Enlace válido por 30 minutos. Compártelo solo con el responsable del medio.', 'success');
    } catch (error) { if (generation === detailGeneration) fail(error, resetFeedback); }
    finally { if (generation === detailGeneration) resetButton.disabled = false; }
  });
  query('[data-reset-copy]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(resetInput.value); feedback(resetFeedback, 'Enlace copiado.', 'success'); }
    catch { resetInput.select(); feedback(resetFeedback, 'Copia el enlace manualmente.', 'error'); }
  });
  deleteButton.addEventListener('click', async () => {
    if (deleteButton.dataset.confirm !== 'true') { deleteButton.dataset.confirm = 'true'; deleteButton.textContent = 'Confirmar retiro del registro'; return; }
    const id = currentId;
    deleteButton.disabled = true;
    try { await client.archive(id); dialog.close(); await list(); feedback(status, 'Registro retirado. Se conserva la evidencia para auditoría.', 'success'); }
    catch (error) { deleteButton.disabled = false; fail(error, detailFeedback); }
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    try { filters = normalizeMediaFilters({ ...Object.fromEntries(new FormData(form)), page: 1 }); list(); }
    catch (error) { feedback(query('[data-list-message]'), error.message, 'error'); }
  });
  form.addEventListener('reset', () => { setTimeout(() => { filters = normalizeMediaFilters(); list(); }); });
  previous.addEventListener('click', () => { filters.page = Math.max(1, pagination.page - 1); list(); });
  next.addEventListener('click', () => { filters.page = pagination.page + 1; list(); });
  exportButton.addEventListener('click', async () => {
    exportButton.disabled = true;
    feedback(status, 'Preparando exportación…');
    try {
      const blob = await client.export(filters);
      const url = URL.createObjectURL(blob);
      const link = node('a'); link.href = url; link.download = `medios-${new Date().toISOString().slice(0, 10)}.csv`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      feedback(status, 'Exportación lista.', 'success');
    } catch (error) { fail(error); }
    finally { exportButton.disabled = false; }
  });
  logout.addEventListener('click', async () => {
    logout.disabled = true;
    try { await client.logout(); clearDetail(); location.replace('/admin/'); }
    catch (error) { logout.disabled = false; fail(error); }
  });

  async function session() {
    retry.hidden = true;
    feedback(status, 'Comprobando acceso…');
    try {
      const data = await client.session();
      if (!data.authenticated) { location.replace('/admin/'); return; }
      feedback(status, '');
      query('[data-admin-user]').textContent = `Sesión de ${data.user.username}`;
      sidebarUser.textContent = data.user.username;
      logout.disabled = false; exportButton.disabled = false;
      form.querySelector('fieldset').disabled = false;
      query('[data-admin-add]').disabled = false;
      await Promise.all([list(), pending(), claims()]);
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', session);
  await session();
}

/** Submenu "Eventos": one coverage table per event with clickable big numbers on top. */
export async function initializeMediaEventsAdmin() {
  const panel = document.querySelector('[data-admin-medios-eventos]');
  if (!panel) return;
  const navigation = document.querySelector('[data-admin-navigation]');
  const compactNavigation = globalThis.matchMedia?.('(max-width: 1120px)');
  const applyNavigation = compact => { if (navigation) navigation.open = !compact; };
  applyNavigation(compactNavigation?.matches ?? false);
  compactNavigation?.addEventListener('change', event => applyNavigation(event.matches));
  const query = selector => panel.querySelector(selector);
  const status = query('[data-admin-feedback]');
  const retry = query('[data-session-retry]');
  const configuredBase = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredBase || runtime.apiBase;
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) { feedback(status, 'La configuración de acceso no es válida.', 'error'); return; }
  const client = createMediaAdminClient(base);
  const logout = document.querySelector('[data-admin-logout]');
  const sidebarUser = document.querySelector('[data-admin-sidebar-user]');
  const eventSelect = query('[data-event-select]');
  const eventForm = query('[data-event-form]');
  const eventFeedback = query('[data-event-feedback]');
  const summary = query('[data-coverage-summary]');
  const rows = query('[data-coverage-rows]');
  const tableMessage = query('[data-coverage-message]');
  const filterLabel = query('[data-coverage-filter]');
  const addForm = query('[data-coverage-add]');
  const addResults = query('[data-coverage-results]');
  const addFeedback = query('[data-coverage-add-feedback]');
  const fail = (error, target = status) => { if (error.status === 401) { location.replace('/admin/'); return; } feedback(target, error.message, 'error'); };
  let current = null; let coverage = null; let activeBucket = 'todos'; let generation = 0;
  const timers = new Map();

  async function loadEvents(selectId = null) {
    const data = await client.events();
    eventSelect.replaceChildren();
    for (const event of data.items) {
      const option = node('option', `${event.name}${event.event_date ? ` · ${event.event_date}` : ''} · ${event.confirmed_count ?? 0}/${event.coverage_count} confirmados`); option.value = event.public_id; eventSelect.append(option);
    }
    eventSelect.disabled = data.items.length === 0;
    if (!data.items.length) { feedback(tableMessage, 'Crea el primer evento para registrar la cobertura de los medios.'); summary.replaceChildren(); rows.replaceChildren(); return; }
    eventSelect.value = selectId && data.items.some(event => event.public_id === selectId) ? selectId : (current && data.items.some(event => event.public_id === current) ? current : data.items[0].public_id);
    await loadCoverage(eventSelect.value);
  }
  function renderSummary() {
    summary.replaceChildren();
    for (const bucket of coverageBuckets(coverage.summary)) {
      const card = node('button', undefined, 'admin-big-number'); card.type = 'button'; card.dataset.bucket = bucket.key; card.dataset.alert = String(bucket.alert); card.setAttribute('aria-pressed', String(bucket.key === activeBucket));
      card.append(node('strong', String(bucket.count)), node('span', bucket.label));
      card.addEventListener('click', () => { activeBucket = bucket.key; renderSummary(); renderRows(); });
      summary.append(card);
    }
  }
  function renderRows() {
    const bucket = coverageBuckets(coverage.summary).find(item => item.key === activeBucket) ?? { ids: new Set(), label: 'Todos' };
    const items = coverage.items.filter(item => bucket.ids.has(item.public_id));
    filterLabel.textContent = `${bucket.label}: ${items.length} de ${coverage.items.length} medios`;
    rows.replaceChildren();
    for (const item of items) rows.append(coverageRow(item));
    feedback(tableMessage, coverage.items.length ? (items.length ? '' : 'Ningún medio en este grupo.') : 'Este evento todavía no tiene medios. Agrégalos abajo.');
  }
  function coverageRow(item) {
    const row = node('tr'); row.dataset.origin = item.origin; row.dataset.profile = item.public_id;
    const cell = (label, content) => { const td = node('td'); td.dataset.label = label; if (typeof content === 'string') td.append(node('span', content)); else td.append(content); row.append(td); return td; };
    const name = node('div'); name.append(node('strong', item.media_name), node('small', [describeField('media_types', item.media_types), item.frequency_channel, item.city].filter(Boolean).join(' · ')));
    const originMark = node('span', item.origin === 'cuenta' ? 'Con cuenta' : item.linked ? 'Coord. · vinculado' : 'Coord. · sin cuenta', 'admin-media-origin'); originMark.dataset.origin = item.origin; name.append(originMark);
    cell('Medio', name).className = 'record-name';
    const contracted = node('select'); for (const [value, label] of [['', 'Sin dato'], ['yes', 'Sí · Pautado'], ['no', 'No · Sin contrato']]) { const option = node('option', label); option.value = value; contracted.append(option); } contracted.value = item.contracted ?? ''; contracted.setAttribute('aria-label', `Contrato de ${item.media_name}`);
    cell('Contrato', contracted);
    const confirmation = node('select', undefined, 'admin-media-confirmation');
    for (const [value, label] of [['', 'Sin respuesta'], ['yes', 'Confirmó'], ['no', 'No asistirá']]) { const option = node('option', label); option.value = value; confirmation.append(option); }
    confirmation.value = item.confirmation ?? '';
    confirmation.dataset.confirmation = item.confirmation ?? 'pendiente';
    confirmation.setAttribute('aria-label', `Confirmación de ${item.media_name}`);
    if (item.confirmed_at) confirmation.title = `Respondió ${dateTime(item.confirmed_at)}${item.linked ? '' : ' (registrado por coordinación)'}`;
    cell('Confirmó', confirmation);
    // Marcado = asistió, desmarcado = no asistió. Las observaciones puntuales van en la nota.
    const attended = node('input'); attended.type = 'checkbox'; attended.className = 'admin-attendance-check';
    attended.checked = item.attended === 'yes'; attended.setAttribute('aria-label', `Asistió ${item.media_name}`);
    cell('Asistió', attended).className = 'admin-cell-check';
    // Se marca solo cuando la cobertura ya tiene un link cargado.
    const published = node('input'); published.type = 'checkbox'; published.className = 'admin-attendance-check'; published.disabled = true;
    published.checked = (item.links ?? []).length > 0;
    published.setAttribute('aria-label', `${item.media_name} ${published.checked ? 'tiene link publicado' : 'sin link publicado'}`);
    cell('Link', published).className = 'admin-cell-check';
    const result = node('select'); for (const [value, label] of Object.entries(COVERAGE_RESULT_LABELS)) { const option = node('option', label); option.value = value; result.append(option); } result.value = item.result; result.setAttribute('aria-label', `Resultado de ${item.media_name}`);
    cell('Resultado', result);
    const people = node('input'); people.type = 'number'; people.min = '0'; people.max = '200'; people.step = '1'; people.value = String(item.people_count ?? 0); people.setAttribute('aria-label', `Personas de ${item.media_name}`);
    cell('Personas', people);
    const links = node('textarea'); links.rows = 2; links.value = (item.links ?? []).join('\n'); links.placeholder = 'Un link por línea'; links.setAttribute('aria-label', `Links de ${item.media_name}`);
    const linkCell = cell('Links', links);
    const preview = node('div', undefined, 'admin-media-coverage-links'); for (const url of item.links ?? []) preview.append(linkNode(url)); linkCell.append(preview);
    const note = node('input'); note.type = 'text'; note.maxLength = 2000; note.value = item.note ?? ''; note.placeholder = 'Nota'; note.setAttribute('aria-label', `Nota de ${item.media_name}`);
    cell('Nota', note);
    const state = node('small', item.updated_at ? `Guardado ${dateTime(item.updated_at)}` : '', 'admin-coverage-state');
    cell('Estado', state);
    const save = async () => {
      const body = coveragePayload({ contracted: contracted.value, result: result.value, people_count: people.value, links: links.value, note: note.value, attended: attended.checked ? 'yes' : 'no', confirmation: confirmation.value });
      state.textContent = 'Guardando…';
      try {
        await client.updateCoverage(current, item.public_id, body);
        const fresh = await client.eventCoverage(current);
        coverage = fresh; renderSummary();
        const updated = fresh.items.find(entry => entry.public_id === item.public_id);
        state.textContent = updated ? `Guardado ${dateTime(updated.updated_at)}` : 'Guardado';
        preview.replaceChildren(); for (const url of updated?.links ?? []) preview.append(linkNode(url));
        published.checked = (updated?.links ?? []).length > 0;
        confirmation.dataset.confirmation = updated?.confirmation ?? 'pendiente';
        // The row stays visible while editing even if it leaves the active bucket; the numbers above already moved.
      } catch (error) { state.textContent = 'No se pudo guardar'; fail(error, tableMessage); }
    };
    const schedule = () => { globalThis.clearTimeout(timers.get(item.public_id)); timers.set(item.public_id, globalThis.setTimeout(save, 900)); };
    for (const control of [contracted, confirmation, attended, result, people, links, note]) { control.addEventListener('change', schedule); control.addEventListener('input', schedule); }
    return row;
  }
  async function loadCoverage(id) {
    const own = ++generation; current = id;
    feedback(tableMessage, 'Cargando cobertura…');
    try { const data = await client.eventCoverage(id); if (own !== generation) return; coverage = data; activeBucket = 'todos'; renderSummary(); renderRows(); }
    catch (error) { if (own === generation) fail(error, tableMessage); }
  }
  eventSelect.addEventListener('change', () => loadCoverage(eventSelect.value));
  eventForm.addEventListener('submit', async event => {
    event.preventDefault();
    const name = eventForm.elements.name.value.trim(); const date = eventForm.elements.event_date.value || null;
    if (name.length < 3) { feedback(eventFeedback, 'Escribe el nombre del evento.', 'error'); return; }
    eventForm.querySelector('fieldset').disabled = true; feedback(eventFeedback, 'Creando evento e invitando a todos los medios…');
    try { const created = await client.createEvent({ name, event_date: date, place: eventForm.elements.place.value.trim(), details: eventForm.elements.details.value.trim() }); eventForm.reset(); feedback(eventFeedback, `Evento ${created.event.name} creado. Se invitó a ${created.event.coverage_count} medios; los que tienen cuenta lo verán en su portal para confirmar.`, 'success'); await loadEvents(created.event.public_id); }
    catch (error) { feedback(eventFeedback, error.status === 409 ? 'Ya existe un evento con ese nombre.' : error.message, 'error'); }
    finally { eventForm.querySelector('fieldset').disabled = false; }
  });
  // Add an existing medium (searched by name) to the current event, or create it from scratch.
  let searchTimer = 0;
  const searchInput = addForm.elements.search;
  async function search() {
    const term = searchInput.value.trim();
    addResults.replaceChildren();
    if (term.length < 2 || !current) return;
    try {
      const data = await client.list({ search: term, page: 1, pageSize: 25 });
      const present = new Set((coverage?.items ?? []).map(item => item.public_id));
      for (const record of data.items) {
        const item = node('li'); const button = node('button', present.has(record.public_id) ? `${record.media_name} · ya está en el evento` : `${record.media_name} · ${record.city || 'sin ciudad'}`, 'button-quiet'); button.type = 'button'; button.disabled = present.has(record.public_id);
        button.addEventListener('click', async () => {
          button.disabled = true; feedback(addFeedback, 'Agregando…');
          try { await client.updateCoverage(current, record.public_id, coveragePayload({ contracted: record.paid_media === 'yes' ? 'yes' : '', result: 'pendiente', people_count: 0, links: '', note: '', attended: '' })); searchInput.value = ''; addResults.replaceChildren(); await loadCoverage(current); await loadEvents(current); feedback(addFeedback, `${record.media_name} agregado al evento.`, 'success'); }
          catch (error) { button.disabled = false; fail(error, addFeedback); }
        });
        item.append(button); addResults.append(item);
      }
      if (!data.items.length) addResults.append(node('li', 'No hay medios con ese nombre. Puedes crearlo con el botón de abajo.'));
    } catch (error) { fail(error, addFeedback); }
  }
  searchInput.addEventListener('input', () => { globalThis.clearTimeout(searchTimer); searchTimer = globalThis.setTimeout(search, 400); });
  addForm.addEventListener('submit', event => { event.preventDefault(); search(); });
  // The shared record dialog creates the medium and then adds it to the event.
  const recordDialog = document.querySelector('[data-record-dialog]');
  const recordForm = recordDialog?.querySelector('[data-record-form]');
  const recordFeedback = recordDialog?.querySelector('[data-record-feedback]');
  query('[data-coverage-create]')?.addEventListener('click', () => {
    recordForm.reset(); fillAdminRecordForm(recordForm, { media_name: searchInput.value.trim() });
    recordDialog.querySelector('[data-record-title]').textContent = 'Agregar medio';
    feedback(recordFeedback, 'Solo el nombre y el tipo son obligatorios. Al guardar, el medio se agrega a este evento.');
    recordDialog.showModal(); recordForm.elements.namedItem('media_name').focus();
  });
  recordForm?.addEventListener('submit', async event => {
    event.preventDefault();
    let body;
    try { body = adminRecordPayload(recordForm); } catch (error) { feedback(recordFeedback, error.message, 'error'); return; }
    recordForm.querySelector('fieldset').disabled = true; feedback(recordFeedback, 'Guardando…');
    try {
      const created = await client.create(body);
      if (current) await client.updateCoverage(current, created.public_id, coveragePayload({ contracted: body.paid_media === 'yes' ? 'yes' : '', result: 'pendiente', people_count: 0, links: '', note: '', attended: '' }));
      recordDialog.close(); searchInput.value = ''; addResults.replaceChildren();
      await loadCoverage(current); await loadEvents(current);
      feedback(addFeedback, `${created.media_name} creado y agregado al evento.`, 'success');
    } catch (error) { feedback(recordFeedback, error.status === 409 ? 'Ya existe un medio con ese nombre. Búscalo arriba y agrégalo en lugar de crear otro.' : error.message, 'error'); }
    finally { recordForm.querySelector('fieldset').disabled = false; }
  });
  recordDialog?.querySelector('[data-record-close]')?.addEventListener('click', () => recordDialog.close());
  logout.addEventListener('click', async () => { logout.disabled = true; try { await client.logout(); location.replace('/admin/'); } catch (error) { logout.disabled = false; fail(error); } });
  async function session() {
    retry.hidden = true; feedback(status, 'Comprobando acceso…');
    try {
      const data = await client.session();
      if (!data.authenticated) { location.replace('/admin/'); return; }
      feedback(status, ''); query('[data-admin-user]').textContent = `Sesión de ${data.user.username}`; sidebarUser.textContent = data.user.username;
      logout.disabled = false; eventForm.querySelector('fieldset').disabled = false; addForm.querySelector('fieldset').disabled = false; query('[data-coverage-create]').disabled = false;
      await loadEvents();
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', session);
  await session();
}

if (typeof document !== 'undefined') { initializeMediaAdmin(); initializeMediaEventsAdmin(); }
