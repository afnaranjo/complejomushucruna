import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, PRIMARY_SITE_ORIGIN, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
import './sidebar.js?v=20260925-admin-sidebar-2';
import './campaign-banner.js?v=20260925-banner-2';

export const EMPRENDEDOR_STATUSES = Object.freeze(['Nuevo', 'En revisión', 'Aprobado', 'Rechazado']);
export const EMPRENDEDOR_LEVELS = Object.freeze(['En preparación', 'Primer video', 'En camino', 'Constante', 'Destacado', 'Referente', 'Tope']);
const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
export function resolveEmprendedorAdminOrigins(location = globalThis.location) { return resolveRuntimeOrigins(location); }
const FILTERS = ['search', 'status', 'city', 'main_network'];
export function maskId(value) {
  const text = String(value ?? '');
  return text.length > 4 ? '*'.repeat(text.length - 4) + text.slice(-4) : '*'.repeat(text.length);
}
export const maskPhone = maskId;
export function normalizeEmprendedorFilters(input = {}) {
  const result = {};
  for (const key of FILTERS) {
    const value = String(input[key] ?? '').trim();
    if (value) result[key] = value;
  }
  if (result.status && !EMPRENDEDOR_STATUSES.includes(result.status)) throw new Error('Selecciona un estado válido.');
  if (result.main_network && !['TikTok', 'Instagram', 'Facebook'].includes(result.main_network)) throw new Error('Selecciona una red válida.');
  if (result.search && result.search.length > 180) throw new Error('La búsqueda es demasiado larga.');
  result.page = Math.min(1000000, Math.max(1, Number.parseInt(input.page, 10) || 1));
  result.pageSize = [25, 50, 100].includes(Number(input.pageSize)) ? Number(input.pageSize) : 25;
  return result;
}
export function renderEmprendedorSummary(data) {
  return [
    { label: 'Emprendedores', value: data.total ?? 0 },
    { label: 'Nuevos', value: data.byStatus?.Nuevo ?? 0 },
    { label: 'Aprobados', value: data.byStatus?.Aprobado ?? 0 },
    { label: 'Últimos 7 días', value: data.lastSevenDays ?? 0 },
  ];
}
export function topEmprendedorFollowers(items = [], limit = 20) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({ ...item, followers_count: Math.max(0, Number.parseInt(item?.followers_count, 10) || 0) }))
    .filter(item => item.followers_count > 0 && typeof item.full_name === 'string' && item.full_name.trim() !== '')
    .sort((left, right) => right.followers_count - left.followers_count || left.full_name.localeCompare(right.full_name, 'es'))
    .slice(0, Math.max(0, Number.parseInt(limit, 10) || 0));
}
export function topEmprendedorVideoViews(items = [], limit = 20) {
  return (Array.isArray(items) ? items : [])
    .map(item => ({ ...item, views_count: Math.max(0, Number.parseInt(item?.views_count, 10) || 0), slot: Math.max(1, Math.min(5, Number.parseInt(item?.slot, 10) || 1)) }))
    .filter(item => item.views_count > 0 && typeof item.full_name === 'string' && item.full_name.trim() !== '')
    .sort((left, right) => right.views_count - left.views_count || left.full_name.localeCompare(right.full_name, 'es') || left.slot - right.slot)
    .slice(0, Math.max(0, Number.parseInt(limit, 10) || 0));
}
export function emprendedorVideoSubmissionState(record = {}) {
  const total = 5;
  const fromCount = Number.parseInt(record.videos_submitted, 10);
  const submitted = Number.isFinite(fromCount)
    ? fromCount
    : (Array.isArray(record.videos) ? record.videos.filter(video => video?.status === 'submitted' && String(video?.url ?? '').trim()).length : 0);
  return { submitted: Math.min(total, Math.max(0, submitted)), total };
}
export class EmprendedorAdminError extends Error {
  constructor(status) {
    super(({ 0: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.', 401: 'La sesión venció. Inicia sesión nuevamente.', 403: 'No se autorizó la solicitud. Actualiza la página e intenta de nuevo.', 404: 'El registro no está disponible.', 422: 'Revisa los datos ingresados e intenta de nuevo.', 429: 'Hay demasiados intentos. Espera antes de volver a intentar.' })[status] ?? 'No se pudo completar la solicitud. Intenta de nuevo.');
    this.status = status;
  }
}
export function createEmprendedorAdminClient(baseUrl = API, fetchImplementation = fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  let csrf = '';
  async function request(path, options = {}) {
    if (!/^\/(?:auth\/(?:session|login|logout)|emprendedor-dashboard|emprendedor-accounts|emprendedor-video-schedule|emprendedores(?:\/(?:export|[a-f0-9]{32}(?:\/(?:notes|progress))?))?)(?:\?[^#]*)?$/.test(path)
      && !/^\/(?:emprendedor-accounts|emprendedores)\/[a-f0-9]{32}\/(?:delete|photo|password-reset|progress)$/.test(path)) throw new Error('Ruta de API no permitida.');
    const method = (options.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST', 'PATCH'].includes(method)) throw new Error('Método no permitido.');
    const headers = { Accept: options.blob && path.endsWith('/photo') ? 'image/jpeg' : 'application/json' };
    if (method !== 'GET') {
      if (!csrf) throw new EmprendedorAdminError(403);
      headers['X-CSRF-Token'] = csrf;
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch { throw new EmprendedorAdminError(0); }
    if (!response.ok) throw new EmprendedorAdminError(response.status);
    if (options.blob) {
      if (path.endsWith('/photo') && response.headers.get('Content-Type')?.split(';')[0] !== 'image/jpeg') throw new EmprendedorAdminError(502);
      return response.blob();
    }
    let data;
    try { data = await response.json(); } catch { throw new EmprendedorAdminError(502); }
    if (typeof data.csrf === 'string') csrf = data.csrf;
    return data;
  }
  return {
    request,
    session: () => request('/auth/session'),
    login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    pendingAccounts: () => request('/emprendedor-accounts'),
    videoSchedule: () => request('/emprendedor-video-schedule'),
    updateVideoSchedule: body => request('/emprendedor-video-schedule', { method: 'PATCH', body }),
    deletePendingAccount: id => request(`/emprendedor-accounts/${id}/delete`, { method: 'POST', body: {} }),
    deleteProfile: id => request(`/emprendedores/${id}/delete`, { method: 'POST', body: {} }),
    export: filters => {
      const { page, pageSize, ...body } = normalizeEmprendedorFilters(filters);
      return request('/emprendedores/export', { method: 'POST', body, blob: true });
    },
  };
}

/** Owns sensitive detail state; closing invalidates pending work before it reaches the DOM. */
export class EmprendedorDetailAccess {
  #generation = 0;
  constructor(client, urls = URL, siteOrigin = PRIMARY_SITE_ORIGIN) { this.client = client; this.urls = urls; this.siteOrigin = siteOrigin; this.id = ''; this.photoUrl = ''; this.resetUrl = ''; }
  open(id) {
    this.close();
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Identificador no válido.');
    this.id = id;
  }
  close() {
    this.#generation++;
    if (this.photoUrl) this.urls.revokeObjectURL(this.photoUrl);
    this.id = ''; this.photoUrl = ''; this.resetUrl = '';
  }
  get filename() { return this.id ? `emprendedor-${this.id}.jpg` : ''; }
  async loadPhoto() {
    if (!this.id) throw new EmprendedorAdminError(404);
    const generation = this.#generation;
    const blob = await this.client.request(`/emprendedores/${this.id}/photo`, { blob: true });
    if (generation !== this.#generation) return '';
    if (this.photoUrl) this.urls.revokeObjectURL(this.photoUrl);
    this.photoUrl = this.urls.createObjectURL(blob);
    return this.photoUrl;
  }
  async generateReset() {
    if (!this.id) throw new EmprendedorAdminError(404);
    const generation = this.#generation;
    this.resetUrl = '';
    const data = await this.client.request(`/emprendedores/${this.id}/password-reset`, { method: 'POST', body: {} });
    if (generation !== this.#generation) return '';
    let reset;
    try { reset = new URL(data.resetUrl); } catch { throw new EmprendedorAdminError(502); }
    if (!isAllowedSiteOrigin(reset.origin) || reset.origin !== this.siteOrigin || reset.pathname !== '/finados/emprendedores/restablecer/' || !/^\?token=[a-f0-9]{64}$/.test(reset.search)) throw new EmprendedorAdminError(502);
    this.resetUrl = data.resetUrl;
    return this.resetUrl;
  }
  async copyReset(clipboard = globalThis.navigator?.clipboard) {
    if (!this.resetUrl || !clipboard?.writeText) throw new Error('No se pudo copiar. Selecciona y copia el enlace de la caja.');
    const generation = this.#generation;
    await clipboard.writeText(this.resetUrl);
    return generation === this.#generation;
  }
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
function renderVideoSubmissionChecks(record) {
  const { submitted, total } = emprendedorVideoSubmissionState(record);
  const wrapper = node('span', undefined, 'video-checks');
  wrapper.setAttribute('role', 'img');
  wrapper.setAttribute('aria-label', `${submitted} de ${total} videos enviados`);
  for (let index = 1; index <= total; index++) {
    const mark = node('span', index <= submitted ? '✓' : '', 'video-check');
    mark.dataset.done = String(index <= submitted);
    mark.title = `Video ${index}: ${index <= submitted ? 'enviado' : 'pendiente'}`;
    wrapper.append(mark);
  }
  wrapper.append(node('small', `${submitted}/${total}`));
  return wrapper;
}
function dateTime(value) {
  if (!value) return '—';
  const parsed = new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(parsed);
}
function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function collectEmprendedorVideoSchedulePayload(videoInput) {
  const videoSlots = [];
  for (const slot of [1, 2, 3, 4, 5]) {
    const enabled = Boolean(videoInput(slot, 'enabled')?.checked);
    const enabledAt = videoInput(slot, 'enabled_at')?.value || null;
    if (enabled && !enabledAt) {
      return { error: `Indica la fecha de habilitación del video ${slot}.`, focus: () => videoInput(slot, 'enabled_at')?.focus() };
    }
    videoSlots.push({ slot, enabled, enabled_at: enabled ? enabledAt : null });
  }
  return { body: { video_slots: videoSlots } };
}

export function collectEmprendedorProgressPayload(progressForm) {
  const videoViews = [];
  for (const slot of [1, 2, 3, 4, 5]) {
    const input = progressForm.elements.namedItem?.(`video_views_${slot}`) ?? progressForm.elements[`video_views_${slot}`];
    const value = Math.max(0, Number.parseInt(input?.value, 10) || 0);
    videoViews.push({ slot, views_count: Math.min(1000000000, value) });
  }
  return {
    body: {
      followers_count: Number(progressForm.elements.followers_count.value),
      level: Number(progressForm.elements.level.value),
      traffic_light: progressForm.elements.traffic_light.value,
      video_views: videoViews,
    },
  };
}

export function initializeEmprendedorAdminNavigation(root = document, compact = globalThis.matchMedia?.('(max-width: 1120px)').matches ?? false) {
  const navigation = root.querySelector('[data-admin-navigation]');
  if (!navigation) return;
  if (compact && navigation.contains?.(root.activeElement)) navigation.querySelector('summary')?.focus();
  navigation.open = !compact;
}

export async function initializeEmprendedorAdmin() {
  // The shared login page keeps using admin.js; this bundle only drives the Emprendedores panel.
  const panel = document.querySelector('[data-admin-emprendedores]');
  if (!panel) return;
  if (panel) {
    const compactNavigation = globalThis.matchMedia?.('(max-width: 1120px)');
    initializeEmprendedorAdminNavigation(document, compactNavigation?.matches ?? false);
    compactNavigation?.addEventListener('change', event => initializeEmprendedorAdminNavigation(document, event.matches));
  }
  const status = document.querySelector('[data-admin-feedback]');
  const retry = document.querySelector('[data-session-retry]');
  const configuredBase = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveEmprendedorAdminOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredBase || runtime.apiBase;
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) {
    feedback(status, 'La configuración de acceso no es válida.', 'error'); return;
  }
  const client = createEmprendedorAdminClient(base);
  let clearPrivateDetail = () => {};
  const redirect = path => location.replace(path);
  const fail = (error, target = status) => {
    if (error.status === 401 && panel) { clearPrivateDetail(); redirect('/admin/'); return; }
    feedback(target, error.message, 'error');
  };
  let startPanel;
  async function session() {
    retry.hidden = true;
    feedback(status, 'Comprobando acceso…');
    try {
      const data = await client.session();
      if (panel && !data.authenticated) { redirect('/admin/'); return; }
      feedback(status, '');
      if (panel) await startPanel(data.user);
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', session);

  const query = selector => panel.querySelector(selector);
  const form = query('[data-admin-filters]');
  const records = query('[data-records]');
  const region = query('[data-records-region]');
  const dashboard = query('[data-admin-dashboard]');
  const followersLeaderboard = query('[data-followers-leaderboard]');
  const followersLeaderboardCount = query('[data-followers-leaderboard-count]');
  const videoViewsLeaderboard = query('[data-video-views-leaderboard]');
  const videoViewsLeaderboardCount = query('[data-video-views-leaderboard-count]');
  const previous = query('[data-previous]');
  const next = query('[data-next]');
  const exportButton = query('[data-admin-export]');
  const pendingAccounts = query('[data-pending-accounts]');
  const pendingCount = query('[data-pending-count]');
  const pendingMessage = query('[data-pending-message]');
  const globalVideoForm = query('[data-global-video-form]');
  const globalVideoFeedback = query('[data-global-video-feedback]');
  const globalVideoSummary = query('[data-global-video-summary]');
  const logout = document.querySelector('[data-admin-logout]');
  const sidebarUser = document.querySelector('[data-admin-sidebar-user]');
  const dialog = query('[data-detail]');
  const detailFeedback = query('[data-detail-feedback]');
  const statusForm = query('[data-status-form]');
  const progressForm = query('[data-progress-form]');
  const progressFeedback = query('[data-progress-feedback]');
  const progressSummary = query('[data-admin-progress-summary]');
  const adminVideos = query('[data-admin-videos]');
  const scheduleVideoInput = (slot, suffix) => globalVideoForm.elements.namedItem(`schedule_video_${slot}_${suffix}`);
  const noteForm = query('[data-note-form]');
  let filters = normalizeEmprendedorFilters();
  let pagination = { page: 1, pages: 0 };
  let listGeneration = 0;
  let detailGeneration = 0;
  let currentId = null;
  let opener = null;
  let progressAutosaveTimer = 0;
  let lastProgressPayload = '';
  const detailAccess = new EmprendedorDetailAccess(client, URL, runtime.siteOrigin);
  const photoImage = query('[data-admin-photo-image]');
  const photoDownload = query('[data-admin-photo-download]');
  const photoMessage = query('[data-admin-photo-message]');
  const resetButton = query('[data-admin-reset]');
  const resetOutput = query('[data-reset-output]');
  const resetInput = query('[data-reset-url]');
  const resetFeedback = query('[data-reset-feedback]');
  const deleteButton = query('[data-admin-delete]');
  function clearMedia() {
    globalThis.clearTimeout(progressAutosaveTimer);
    lastProgressPayload = '';
    detailAccess.close();
    photoImage.removeAttribute('src'); photoImage.hidden = true;
    photoDownload.removeAttribute('href'); photoDownload.removeAttribute('download'); photoDownload.hidden = true;
    photoMessage.textContent = ''; resetInput.value = ''; resetOutput.hidden = true; resetButton.disabled = true; deleteButton.disabled = true;
    feedback(resetFeedback, ''); feedback(progressFeedback, '');
    progressForm.querySelector('fieldset').disabled = true; progressForm.reset(); progressSummary.textContent = 'Sin actualizar'; adminVideos.replaceChildren();
  }
  clearPrivateDetail = () => { currentId = null; detailGeneration++; clearMedia(); };
  globalThis.addEventListener?.('pagehide', clearPrivateDetail);
  globalThis.addEventListener?.('pageshow', event => { if (event.persisted) location.reload(); });
  resetButton.addEventListener('click', async () => {
    const generation = detailGeneration;
    resetButton.disabled = true; resetOutput.hidden = true; resetInput.value = '';
    feedback(resetFeedback, 'Generando enlace…');
    try {
      const url = await detailAccess.generateReset();
      if (!url || generation !== detailGeneration) return;
      resetInput.value = url; resetOutput.hidden = false;
      feedback(resetFeedback, 'Enlace válido por 30 minutos y un solo uso. Entrégalo por el canal acordado.');
    } catch (error) { if (generation === detailGeneration) fail(error, resetFeedback); }
    finally { if (generation === detailGeneration) resetButton.disabled = false; }
  });
  query('[data-reset-copy]').addEventListener('click', async () => {
    const generation = detailGeneration;
    try { if (await detailAccess.copyReset()) feedback(resetFeedback, 'Enlace copiado.', 'success'); }
    catch { if (generation === detailGeneration) feedback(resetFeedback, 'No se pudo copiar. Selecciona y copia el enlace de la caja.', 'error'); }
  });

  function renderCounts(target, counts, format = value => value) {
    target.replaceChildren();
    for (const [key, value] of Object.entries(counts ?? {})) {
      const row = node('div'); row.append(node('dt', format(key)), node('dd', value)); target.append(row);
    }
    if (!target.children.length) target.append(node('p', 'Sin registros.'));
  }
  function renderFollowersLeaderboard(items = []) {
    const ranking = topEmprendedorFollowers(items, 20);
    followersLeaderboard.replaceChildren();
    followersLeaderboardCount.textContent = ranking.length ? `${ranking.length} emprendedores` : 'Sin datos';
    if (!ranking.length) {
      followersLeaderboard.append(node('li', 'Todavía no hay seguidores validados.'));
      return;
    }
    for (const [index, record] of ranking.entries()) {
      const item = node('li');
      const rank = node('span', String(index + 1).padStart(2, '0'), 'followers-leaderboard__rank');
      const body = node('div');
      body.append(node('strong', record.full_name));
      const meta = [record.business_name, record.city, record.main_network].filter(Boolean).join(' · ');
      body.append(node('small', meta || 'Sin emprendimiento, ciudad o red principal'));
      const value = node('span', new Intl.NumberFormat('es-EC').format(record.followers_count), 'followers-leaderboard__value');
      if (/^[a-f0-9]{32}$/.test(record.public_id ?? '')) {
        const open = node('button', 'Ver detalle', 'button-quiet followers-leaderboard__action');
        open.type = 'button';
        open.addEventListener('click', () => openDetail(record.public_id, open));
        item.append(rank, body, value, open);
      } else item.append(rank, body, value);
      followersLeaderboard.append(item);
    }
  }
  function renderVideoViewsLeaderboard(items = []) {
    const ranking = topEmprendedorVideoViews(items, 20);
    videoViewsLeaderboard.replaceChildren();
    videoViewsLeaderboardCount.textContent = ranking.length ? `${ranking.length} videos` : 'Sin datos';
    if (!ranking.length) {
      videoViewsLeaderboard.append(node('li', 'Todavía no hay videos con views registradas.'));
      return;
    }
    for (const [index, record] of ranking.entries()) {
      const item = node('li');
      const rank = node('span', String(index + 1).padStart(2, '0'), 'followers-leaderboard__rank');
      const body = node('div');
      body.append(node('strong', `${record.full_name} · Video ${record.slot}`));
      const meta = [record.business_name, record.city, record.main_network].filter(Boolean).join(' · ');
      body.append(node('small', meta || 'Sin emprendimiento, ciudad o red principal'));
      const value = node('span', new Intl.NumberFormat('es-EC').format(record.views_count), 'followers-leaderboard__value');
      if (/^[a-f0-9]{32}$/.test(record.public_id ?? '')) {
        const open = node('button', 'Ver detalle', 'button-quiet followers-leaderboard__action');
        open.type = 'button';
        open.addEventListener('click', () => openDetail(record.public_id, open));
        item.append(rank, body, value, open);
      } else item.append(rank, body, value);
      videoViewsLeaderboard.append(item);
    }
  }
  async function summary() {
    dashboard.setAttribute('aria-busy', 'true');
    try {
      const data = await client.request('/emprendedor-dashboard');
      dashboard.replaceChildren();
      for (const metric of renderEmprendedorSummary(data)) {
        const block = node('dl'); block.append(node('dt', metric.label), node('dd', metric.value)); dashboard.append(block);
      }
      renderFollowersLeaderboard(data.topFollowers);
      renderVideoViewsLeaderboard(data.topVideos);
      renderCounts(query('[data-status-counts]'), data.byStatus);
    } catch (error) {
      renderFollowersLeaderboard([]);
      renderVideoViewsLeaderboard([]);
      throw error;
    } finally { dashboard.setAttribute('aria-busy', 'false'); }
  }
  const confirmRetirement = message => typeof globalThis.confirm === 'function' && globalThis.confirm(message);
  function renderPending(items) {
    pendingAccounts.replaceChildren();
    pendingCount.textContent = `${items.length} ${items.length === 1 ? 'cuenta' : 'cuentas'}`;
    for (const account of items) {
      const row = node('tr');
      const email = node('td', account.email); email.dataset.label = 'Correo'; row.append(email);
      const created = node('td', dateTime(account.created_at)); created.dataset.label = 'Creada'; row.append(created);
      const status = node('td', account.status || 'Pendiente de ficha'); status.dataset.label = 'Estado'; row.append(status);
      const actionCell = node('td'); actionCell.dataset.label = 'Acciones';
      const button = node('button', 'Eliminar cuenta', 'button-danger'); button.type = 'button';
      button.addEventListener('click', async () => {
        if (!confirmRetirement('Esto desactivará el acceso de esta cuenta y conservará su trazabilidad. ¿Continuar?')) return;
        button.disabled = true; feedback(pendingMessage, 'Retirando cuenta…');
        try {
          await client.deletePendingAccount(account.public_id);
          await Promise.all([summary(), loadPendingAccounts()]);
          feedback(pendingMessage, 'Cuenta retirada.', 'success');
        } catch (error) {
          button.disabled = false; fail(error, pendingMessage);
        }
      });
      actionCell.append(button); row.append(actionCell); pendingAccounts.append(row);
    }
    feedback(pendingMessage, items.length ? '' : 'No hay cuentas pendientes de ficha.');
  }
  async function loadPendingAccounts() {
    try {
      const data = await client.pendingAccounts();
      renderPending(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      pendingAccounts.replaceChildren(); pendingCount.textContent = 'No disponible'; fail(error, pendingMessage);
    }
  }
  function renderVideoSchedule(slots = []) {
    const enabled = slots.filter(slot => Boolean(slot.enabled_at));
    globalVideoSummary.textContent = `${enabled.length} de 5 configurados`;
    for (const slot of [1, 2, 3, 4, 5]) {
      const item = slots.find(entry => Number(entry.slot) === slot) ?? { slot, enabled_at: null };
      const checkbox = scheduleVideoInput(slot, 'enabled');
      const date = scheduleVideoInput(slot, 'enabled_at');
      const isEnabled = typeof item.enabled_at === 'string' && item.enabled_at !== '';
      if (checkbox) checkbox.checked = isEnabled;
      if (date) { date.value = isEnabled ? item.enabled_at.slice(0, 10) : ''; date.required = isEnabled; }
    }
  }
  async function loadVideoSchedule() {
    try {
      const data = await client.videoSchedule();
      renderVideoSchedule(Array.isArray(data.video_slots) ? data.video_slots : []);
      globalVideoForm.querySelector('fieldset').disabled = false;
      feedback(globalVideoFeedback, 'Configura una fecha por video para habilitarlo a todos los emprendedores.');
    } catch (error) {
      globalVideoForm.querySelector('fieldset').disabled = true;
      globalVideoSummary.textContent = 'No disponible';
      fail(error, globalVideoFeedback);
    }
  }
  async function list() {
    const generation = ++listGeneration;
    region.setAttribute('aria-busy', 'true');
    previous.disabled = next.disabled = true;
    feedback(query('[data-list-message]'), 'Cargando registros…');
    try {
      const data = await client.request('/emprendedores?' + new URLSearchParams(filters));
      if (generation !== listGeneration) return;
      pagination = data.pagination;
      if (pagination.pages > 0 && pagination.page > pagination.pages) { filters.page = pagination.pages; return list(); }
      records.replaceChildren();
      for (const record of data.items) {
        const row = node('tr');
        const cell = (label, value, secondary) => {
          const td = node('td'); td.dataset.label = label;
          td.append(node('span', value)); if (secondary) td.append(node('small', secondary)); row.append(td); return td;
        };
        cell('Emprendedor', record.full_name, record.business_name).className = 'record-name';
        cell('Contacto', maskPhone(record.whatsapp), 'Cédula ' + maskId(record.cedula));
        cell('Ciudad / red', record.city, [record.main_network, record.stand_code ? `Stand ${record.stand_code}` : ''].filter(Boolean).join(' · '));
        cell('Registro', dateTime(record.submitted_at));
        cell('Videos', '').replaceChildren(renderVideoSubmissionChecks(record));
        cell('Nivel', `${record.level ?? 0} · ${EMPRENDEDOR_LEVELS[record.level] ?? EMPRENDEDOR_LEVELS[0]}`, `${new Intl.NumberFormat('es-EC').format(record.followers_count ?? 0)} seguidores`);
        const badge = node('span', record.status, 'status-badge'); badge.dataset.status = record.status;
        const lightKey = ['red', 'yellow', 'green'].includes(record.traffic_light) ? record.traffic_light : 'red';
        const lightMark = node('span', { red: 'Rojo', yellow: 'Amarillo', green: 'Verde' }[lightKey], 'admin-media-light'); lightMark.dataset.light = lightKey;
        cell('Estado', '').replaceChildren(badge, lightMark);
        const open = node('button', 'Ver detalle', 'button-quiet'); open.type = 'button';
        open.setAttribute('aria-label', 'Ver detalle de ' + record.full_name);
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
  const details = [
    ['public_id', 'Identificador'], ['full_name', 'Nombre completo'], ['cedula', 'Cédula'],
    ['birth_date', 'Fecha de nacimiento'], ['age_at_submission', 'Edad al registrarse'], ['whatsapp', 'WhatsApp'], ['email', 'Correo'], ['city', 'Ciudad'],
    ['business_name', 'Emprendimiento'], ['product', 'Qué produce o vende'], ['stand_code', 'Stand'],
    ['main_network', 'Red principal'], ['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['facebook', 'Facebook'],
    ['previous_participation', 'Participación anterior'],
  ];
  function renderDetail(data) {
    const dl = node('dl', undefined, 'detail-fields');
    for (const [key, label] of details) {
      const field = node('div'); field.append(node('dt', label), node('dd', data[key] ?? '—')); dl.append(field);
    }
    const submitted = node('p', 'Registrado: ' + dateTime(data.submitted_at) + ' · Hora de Ecuador');
    const consents = node('section'); consents.append(node('h3', 'Consentimientos'));
    for (const consent of data.consents ?? []) consents.append(node('p', `${consent.consent_type ?? 'Consentimiento'} · ${consent.text_version ?? '—'} · ${consent.accepted ? 'Aceptado' : 'No aceptado'} · ${dateTime(consent.recorded_at)}`));
    query('[data-detail-content]').replaceChildren(submitted, dl, consents);
    statusForm.elements.status.value = data.status;
    renderProgress(data.progress ?? {});
    query('[data-notes]').replaceChildren();
    for (const note of data.notes ?? []) {
      const li = node('li'); li.append(node('p', note.body), node('small', `${dateTime(note.created_at)} · ${note.author ?? 'Administración'}`)); query('[data-notes]').append(li);
    }
    if (!data.notes?.length) query('[data-notes]').append(node('li', 'Todavía no hay notas.'));
  }
  function renderProgress(progress) {
    const value = progress ?? {};
    progressForm.elements.followers_count.value = String(Number(value.followers_count) || 0);
    progressForm.elements.level.value = String(Number(value.level) || 0);
    progressForm.elements.traffic_light.value = value.traffic_light ?? 'red';
    const videos = Array.isArray(value.videos) ? value.videos : [];
    const enabledCount = videos.filter(video => Boolean(video.unlocked)).length;
    progressSummary.textContent = `${value.level_label ?? 'En preparación'} · ${Number(value.followers_count) || 0} seguidores validados · ${enabledCount} de 5 videos habilitados`;
    adminVideos.replaceChildren();
    for (const video of videos) {
      const stateClass = video.unlocked ? (video.status === 'submitted' ? ' admin-video-item--submitted' : ' admin-video-item--enabled') : '';
      const item = node('article', undefined, 'admin-video-item' + stateClass);
      item.append(node('strong', `Video ${video.slot}`), node('span', video.unlocked ? (video.status === 'submitted' ? 'Enlace recibido' : 'Habilitado') : 'Bloqueado'));
      if (video.enabled_at) item.append(node('small', 'Disponible desde ' + dateOnly(String(video.enabled_at).slice(0, 10))));
      if (video.url) { const link = node('a', video.url); link.href = video.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; item.append(link); }
      const views = node('label', undefined, 'admin-video-views');
      views.append(node('span', 'Views validadas'), Object.assign(document.createElement('input'), { type: 'number', name: `video_views_${video.slot}`, min: '0', max: '1000000000', step: '1', value: String(Number(video.views_count) || 0), inputMode: 'numeric', disabled: !video.url }));
      item.append(views);
      adminVideos.append(item);
    }
    if (!adminVideos.children.length) adminVideos.append(node('p', 'Los cinco espacios aparecerán al actualizar el progreso.'));
  }
  for (const slot of [1, 2, 3, 4, 5]) {
    const checkbox = scheduleVideoInput(slot, 'enabled'); const date = scheduleVideoInput(slot, 'enabled_at');
    checkbox?.addEventListener('change', () => { if (date) { date.required = checkbox.checked; if (!checkbox.checked) date.value = ''; } });
  }
  async function loadDetail(id, generation, media = false) {
    const data = await client.request('/emprendedores/' + encodeURIComponent(id));
    if (generation !== detailGeneration || currentId !== id || !dialog.open) return false;
    renderDetail(data);
    deleteButton.disabled = data.status === 'Eliminado' || data.account?.active === false;
    if (media) {
      resetButton.disabled = !data.account?.active;
      if (!data.account?.active) feedback(resetFeedback, 'Este registro no tiene una cuenta activa vinculada.');
      photoMessage.textContent = data.photo?.available ? 'Cargando fotografía…' : 'Sin fotografía histórica';
      if (data.photo?.available) {
        try {
          const url = await detailAccess.loadPhoto();
          if (!url || generation !== detailGeneration || !dialog.open) return false;
          photoImage.src = url; photoImage.hidden = false;
          photoDownload.href = url; photoDownload.download = detailAccess.filename; photoDownload.hidden = false;
          photoMessage.textContent = 'Fotografía privada para identificación y gafete.';
        } catch (error) { if (generation === detailGeneration) fail(error, photoMessage); }
      }
    }
    return true;
  }
  deleteButton.addEventListener('click', async () => {
    const id = currentId; const generation = detailGeneration;
    if (!id || !confirmRetirement('Esto ocultará el registro, desactivará el acceso y conservará la trazabilidad. ¿Continuar?')) return;
    deleteButton.disabled = true; feedback(detailFeedback, 'Retirando registro…');
    try {
      await client.deleteProfile(id);
      const results = await Promise.allSettled([list(), summary(), loadPendingAccounts()]);
      for (const result of results) if (result.status === 'rejected') fail(result.reason);
      if (generation === detailGeneration && dialog.open) dialog.close();
      feedback(status, 'Registro retirado.', 'success');
    } catch (error) {
      if (generation === detailGeneration) { deleteButton.disabled = false; fail(error, detailFeedback); }
    }
  });
  async function openDetail(id, trigger) {
    clearMedia(); detailAccess.open(id);
    currentId = id; opener = trigger;
    const generation = ++detailGeneration;
    query('[data-detail-content]').replaceChildren(); query('[data-notes]').replaceChildren(); noteForm.reset();
    statusForm.querySelector('fieldset').disabled = noteForm.querySelector('fieldset').disabled = progressForm.querySelector('fieldset').disabled = true;
    dialog.showModal(); query('#detail-title').focus();
    feedback(detailFeedback, 'Cargando detalle…');
    try {
      if (await loadDetail(id, generation, true)) {
        statusForm.querySelector('fieldset').disabled = noteForm.querySelector('fieldset').disabled = progressForm.querySelector('fieldset').disabled = false;
        feedback(detailFeedback, '');
      }
    } catch (error) { if (generation === detailGeneration) fail(error, detailFeedback); }
  }
  query('[data-detail-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    clearPrivateDetail();
    query('[data-detail-content]').replaceChildren(); query('[data-notes]').replaceChildren(); noteForm.reset();
    (opener?.isConnected ? opener : query('#records-title')).focus();
  });
  async function mutate(event, kind, bodyOverride = undefined, successOverride = undefined) {
    event?.preventDefault();
    const id = currentId; const generation = detailGeneration;
    if (!id) return;
    const body = bodyOverride ?? (kind === 'status' ? { status: statusForm.elements.status.value } : kind === 'progress' ? JSON.parse(progressForm.dataset.pendingBody ?? '{}') : { body: noteForm.elements.body.value.trim() });
    if (kind === 'note' && !body.body) { feedback(detailFeedback, 'Escribe una nota antes de guardar.', 'error'); return; }
    statusForm.querySelector('fieldset').disabled = noteForm.querySelector('fieldset').disabled = progressForm.querySelector('fieldset').disabled = true;
    const targetFeedback = kind === 'progress' ? progressFeedback : detailFeedback;
    feedback(targetFeedback, 'Guardando…');
    let saved = false;
    try {
      const path = '/emprendedores/' + encodeURIComponent(id) + (kind === 'note' ? '/notes' : kind === 'progress' ? '/progress' : '');
      await client.request(path, { method: kind === 'note' ? 'POST' : 'PATCH', body });
      saved = true;
      // A confirmed status change affects the workspace even if its inspector closed.
      // Start both refreshes before checking detail lifetime or reloading the detail.
      if (kind === 'status' || kind === 'progress') {
        const results = await Promise.allSettled(kind === 'status' ? [list(), summary()] : [summary()]);
        for (const result of results) if (result.status === 'rejected') fail(result.reason);
      }
      if (generation !== detailGeneration) return;
      if (kind === 'note') noteForm.reset();
      await loadDetail(id, generation);
      if (generation !== detailGeneration) return;
      if (kind === 'progress') lastProgressPayload = JSON.stringify(body);
      feedback(targetFeedback, successOverride ?? (kind === 'note' ? 'Nota guardada.' : kind === 'progress' ? 'Progreso actualizado.' : 'Estado actualizado.'), 'success');
    } catch (error) {
      if (generation === detailGeneration) {
        if (saved && error.status !== 401) feedback(targetFeedback, 'El cambio se guardó, pero no se pudo actualizar el detalle. Cierra y vuelve a abrir el registro.', 'error');
        else fail(error, targetFeedback);
      }
    } finally {
      if (generation === detailGeneration) statusForm.querySelector('fieldset').disabled = noteForm.querySelector('fieldset').disabled = progressForm.querySelector('fieldset').disabled = false;
    }
  }
  statusForm.addEventListener('submit', event => mutate(event, 'status'));
  progressForm.addEventListener('submit', event => {
    event.preventDefault();
    const result = collectEmprendedorProgressPayload(progressForm);
    if (result.error) { feedback(progressFeedback, result.error, 'error'); result.focus?.(); return; }
    progressForm.dataset.pendingBody = JSON.stringify(result.body);
    mutate(event, 'progress', result.body);
  });
  const scheduleProgressAutosave = () => {
    if (!currentId || progressForm.querySelector('fieldset').disabled) return;
    globalThis.clearTimeout(progressAutosaveTimer);
    progressAutosaveTimer = globalThis.setTimeout(() => {
      if (!currentId || progressForm.querySelector('fieldset').disabled) return;
      const result = collectEmprendedorProgressPayload(progressForm);
      if (result.error) { feedback(progressFeedback, result.error, 'error'); return; }
      const payload = JSON.stringify(result.body);
      if (payload === lastProgressPayload) return;
      lastProgressPayload = payload;
      progressForm.dataset.pendingBody = payload;
      mutate(null, 'progress', result.body, 'Progreso autoguardado.');
    }, 900);
  };
  progressForm.addEventListener('input', scheduleProgressAutosave);
  progressForm.addEventListener('change', scheduleProgressAutosave);
  globalVideoForm.addEventListener('submit', async event => {
    event.preventDefault();
    const result = collectEmprendedorVideoSchedulePayload(scheduleVideoInput);
    if (result.error) { feedback(globalVideoFeedback, result.error, 'error'); result.focus?.(); return; }
    globalVideoForm.querySelector('fieldset').disabled = true;
    feedback(globalVideoFeedback, 'Guardando fechas globales…');
    try {
      const data = await client.updateVideoSchedule(result.body);
      renderVideoSchedule(Array.isArray(data.video_slots) ? data.video_slots : []);
      await Promise.allSettled([list(), currentId ? loadDetail(currentId, detailGeneration) : Promise.resolve()]);
      feedback(globalVideoFeedback, 'Fechas globales guardadas para todos los emprendedores.', 'success');
    } catch (error) { fail(error, globalVideoFeedback); }
    finally { globalVideoForm.querySelector('fieldset').disabled = false; }
  });
  noteForm.addEventListener('submit', event => mutate(event, 'note'));
  form.addEventListener('submit', event => {
    event.preventDefault();
    try { filters = normalizeEmprendedorFilters(Object.fromEntries(new FormData(form))); feedback(status, ''); list(); } catch (error) { fail(error); }
  });
  form.addEventListener('reset', () => { filters = normalizeEmprendedorFilters(); feedback(status, ''); list(); });
  previous.addEventListener('click', () => { filters.page = Math.max(1, pagination.page - 1); list(); });
  next.addEventListener('click', () => { filters.page = pagination.page + 1; list(); });
  exportButton.addEventListener('click', async () => {
    exportButton.disabled = true; feedback(status, 'Preparando exportación con los filtros aplicados…');
    try {
      const blob = await client.export(filters);
      const url = URL.createObjectURL(blob);
      const link = node('a'); link.href = url; link.download = 'emprendedores.csv'; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      feedback(status, 'Exportación descargada.', 'success');
    } catch (error) { fail(error); } finally { exportButton.disabled = false; }
  });
  logout.addEventListener('click', async () => {
    clearPrivateDetail(); if (dialog.open) dialog.close();
    logout.disabled = true;
    try { await client.logout(); redirect('/admin/'); } catch (error) { fail(error); logout.disabled = false; }
  });
  startPanel = async user => {
    const username = user?.username ?? 'equipo';
    query('[data-admin-user]').textContent = `Sesión: ${username} · Programa De emprendedor a influencer`;
    if (sidebarUser) sidebarUser.textContent = username;
    form.querySelector('fieldset').disabled = false; exportButton.disabled = false; logout.disabled = false;
    const results = await Promise.allSettled([summary(), list(), loadPendingAccounts(), loadVideoSchedule()]);
    for (const result of results) if (result.status === 'rejected') { fail(result.reason); retry.hidden = false; }
  };
  await session();
}
if (typeof document !== 'undefined') initializeEmprendedorAdmin();
