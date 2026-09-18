import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, PRIMARY_SITE_ORIGIN, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';

export const STATUSES = Object.freeze(['Nuevo', 'En revisión', 'Aprobado', 'Rechazado', 'Pendiente de autorización']);
export const PREVIOUS_PARTICIPATION = Object.freeze(['No, es mi primera vez', 'Sí, en Finados 2025', 'Sí, en Carnaval 2026', 'Sí, en otra edición']);
const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
export function resolveAdminOrigins(location = globalThis.location) { return resolveRuntimeOrigins(location); }
const FILTERS = ['search', 'status', 'city', 'main_network', 'previous_participation', 'date_from', 'date_to'];
export function maskId(value) {
  const text = String(value ?? '');
  return text.length > 4 ? '*'.repeat(text.length - 4) + text.slice(-4) : '*'.repeat(text.length);
}
export const maskPhone = maskId;
export function normalizeFilters(input = {}) {
  const result = {};
  for (const key of FILTERS) {
    const value = String(input[key] ?? '').trim();
    if (value) result[key] = value;
  }
  if (result.status && !STATUSES.includes(result.status)) throw new Error('Selecciona un estado válido.');
  for (const key of ['date_from', 'date_to']) {
    const date = result[key];
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('Revisa las fechas del filtro.');
  }
  if (result.date_from && result.date_to && result.date_from > result.date_to) throw new Error('La fecha inicial debe ser anterior o igual a la final.');
  result.page = Math.min(1000000, Math.max(1, Number.parseInt(input.page, 10) || 1));
  result.pageSize = [25, 50, 100].includes(Number(input.pageSize)) ? Number(input.pageSize) : 25;
  return result;
}
export function renderSummary(data) {
  return [
    { label: 'Registros', value: data.total ?? 0 },
    { label: 'Nuevos', value: data.byStatus?.Nuevo ?? 0 },
    { label: 'Aprobados', value: data.byStatus?.Aprobado ?? 0 },
    { label: 'Últimos 7 días', value: data.lastSevenDays ?? 0 },
  ];
}
export class AdminError extends Error {
  constructor(status) {
    super(({ 0: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.', 401: 'La sesión venció. Inicia sesión nuevamente.', 403: 'No se autorizó la solicitud. Actualiza la página e intenta de nuevo.', 404: 'El registro no está disponible.', 422: 'Revisa los datos ingresados e intenta de nuevo.', 429: 'Hay demasiados intentos. Espera antes de volver a intentar.' })[status] ?? 'No se pudo completar la solicitud. Intenta de nuevo.');
    this.status = status;
  }
}
export function createAdminClient(baseUrl = API, fetchImplementation = fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  let csrf = '';
  async function request(path, options = {}) {
    if (!/^\/(?:auth\/(?:session|login|logout)|dashboard|vocero-accounts|vocero-video-schedule|voceros(?:\/[a-zA-Z0-9-]+(?:\/(?:notes|progress))?)?)(?:\?[^#]*)?$/.test(path)
      && !/^\/(?:vocero-accounts|voceros)\/[a-f0-9]{32}\/(?:delete|photo|password-reset|progress)$/.test(path)) throw new Error('Ruta de API no permitida.');
    const method = (options.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST', 'PATCH'].includes(method)) throw new Error('Método no permitido.');
    const headers = { Accept: options.blob && path.endsWith('/photo') ? 'image/jpeg' : 'application/json' };
    if (method !== 'GET') {
      if (!csrf) throw new AdminError(403);
      headers['X-CSRF-Token'] = csrf;
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch { throw new AdminError(0); }
    if (!response.ok) throw new AdminError(response.status);
    if (options.blob) {
      if (path.endsWith('/photo') && response.headers.get('Content-Type')?.split(';')[0] !== 'image/jpeg') throw new AdminError(502);
      return response.blob();
    }
    let data;
    try { data = await response.json(); } catch { throw new AdminError(502); }
    if (typeof data.csrf === 'string') csrf = data.csrf;
    return data;
  }
  return {
    request,
    session: () => request('/auth/session'),
    login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
    logout: () => request('/auth/logout', { method: 'POST' }),
    pendingAccounts: () => request('/vocero-accounts'),
    videoSchedule: () => request('/vocero-video-schedule'),
    updateVideoSchedule: body => request('/vocero-video-schedule', { method: 'PATCH', body }),
    deletePendingAccount: id => request(`/vocero-accounts/${id}/delete`, { method: 'POST', body: {} }),
    deleteProfile: id => request(`/voceros/${id}/delete`, { method: 'POST', body: {} }),
    export: filters => {
      const { page, pageSize, ...body } = normalizeFilters(filters);
      return request('/voceros/export', { method: 'POST', body, blob: true });
    },
  };
}

/** Owns sensitive detail state; closing invalidates pending work before it reaches the DOM. */
export class AdminDetailAccess {
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
  get filename() { return this.id ? `vocero-${this.id}.jpg` : ''; }
  async loadPhoto() {
    if (!this.id) throw new AdminError(404);
    const generation = this.#generation;
    const blob = await this.client.request(`/voceros/${this.id}/photo`, { blob: true });
    if (generation !== this.#generation) return '';
    if (this.photoUrl) this.urls.revokeObjectURL(this.photoUrl);
    this.photoUrl = this.urls.createObjectURL(blob);
    return this.photoUrl;
  }
  async generateReset() {
    if (!this.id) throw new AdminError(404);
    const generation = this.#generation;
    this.resetUrl = '';
    const data = await this.client.request(`/voceros/${this.id}/password-reset`, { method: 'POST', body: {} });
    if (generation !== this.#generation) return '';
    let reset;
    try { reset = new URL(data.resetUrl); } catch { throw new AdminError(502); }
    if (!isAllowedSiteOrigin(reset.origin) || reset.origin !== this.siteOrigin || reset.pathname !== '/finados/voceros/restablecer/' || !/^\?token=[a-f0-9]{64}$/.test(reset.search)) throw new AdminError(502);
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

export function collectVideoSchedulePayload(videoInput) {
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

export function collectProgressPayload(progressForm) {
  return {
    body: {
      followers_count: Number(progressForm.elements.followers_count.value),
      level: Number(progressForm.elements.level.value),
      traffic_light: progressForm.elements.traffic_light.value,
      kit_status: progressForm.elements.kit_status.value,
    },
  };
}

export function initializeAdminNavigation(root = document, compact = globalThis.matchMedia?.('(max-width: 1120px)').matches ?? false) {
  const navigation = root.querySelector('[data-admin-navigation]');
  if (!navigation) return;
  if (compact && navigation.contains?.(root.activeElement)) navigation.querySelector('summary')?.focus();
  navigation.open = !compact;
}

export async function initializeAdmin() {
  const login = document.querySelector('[data-admin-login]');
  const panel = document.querySelector('[data-admin-voceros]');
  if (!login && !panel) return;
  if (panel) {
    const compactNavigation = globalThis.matchMedia?.('(max-width: 1120px)');
    initializeAdminNavigation(document, compactNavigation?.matches ?? false);
    compactNavigation?.addEventListener('change', event => initializeAdminNavigation(document, event.matches));
  }
  const status = document.querySelector('[data-admin-feedback]');
  const retry = document.querySelector('[data-session-retry]');
  const configuredBase = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveAdminOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredBase || runtime.apiBase;
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) {
    feedback(status, 'La configuración de acceso no es válida.', 'error'); return;
  }
  const client = createAdminClient(base);
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
      if (login && data.authenticated) { redirect('/admin/voceros/'); return; }
      if (panel && !data.authenticated) { redirect('/admin/'); return; }
      feedback(status, '');
      if (login) login.querySelector('fieldset').disabled = false;
      if (panel) await startPanel(data.user);
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', session);
  if (login) {
    const password = login.elements.password;
    document.querySelector('[data-toggle-password]').addEventListener('click', event => {
      const shown = password.type === 'password';
      password.type = shown ? 'text' : 'password';
      event.currentTarget.textContent = shown ? 'Ocultar' : 'Mostrar';
      event.currentTarget.setAttribute('aria-pressed', String(shown));
    });
    login.addEventListener('submit', async event => {
      event.preventDefault();
      const username = login.elements.username.value.trim();
      const secret = password.value;
      login.querySelector('fieldset').disabled = true;
      feedback(status, 'Iniciando sesión…');
      try {
        await client.login(username, secret);
        password.value = '';
        redirect('/admin/voceros/');
      } catch (error) {
        password.value = '';
        fail(error.status === 401 ? new Error('Usuario o contraseña incorrectos.') : error);
        login.querySelector('fieldset').disabled = false;
        password.focus();
      }
    });
    await session(); return;
  }

  const query = selector => panel.querySelector(selector);
  const form = query('[data-admin-filters]');
  const records = query('[data-records]');
  const region = query('[data-records-region]');
  const dashboard = query('[data-admin-dashboard]');
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
  let filters = normalizeFilters();
  let pagination = { page: 1, pages: 0 };
  let listGeneration = 0;
  let detailGeneration = 0;
  let currentId = null;
  let opener = null;
  let progressAutosaveTimer = 0;
  let lastProgressPayload = '';
  const detailAccess = new AdminDetailAccess(client, URL, runtime.siteOrigin);
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
  async function summary() {
    dashboard.setAttribute('aria-busy', 'true');
    try {
      const data = await client.request('/dashboard');
      dashboard.replaceChildren();
      for (const metric of renderSummary(data)) {
        const block = node('dl'); block.append(node('dt', metric.label), node('dd', metric.value)); dashboard.append(block);
      }
      renderCounts(query('[data-status-counts]'), data.byStatus);
      renderCounts(query('[data-date-counts]'), data.byDate);
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
      feedback(globalVideoFeedback, 'Configura una fecha por video para habilitarlo a todos los voceros.');
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
      const data = await client.request('/voceros?' + new URLSearchParams(filters));
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
        cell('Vocero', record.full_name, record.public_id).className = 'record-name';
        cell('Contacto', maskPhone(record.whatsapp), 'Cédula ' + maskId(record.cedula));
        cell('Ciudad / red', record.city, record.main_network);
        cell('Registro', dateTime(record.submitted_at));
        const badge = node('span', record.status, 'status-badge'); badge.dataset.status = record.status;
        cell('Estado', '').replaceChildren(badge);
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
    ['public_id', 'Identificador'], ['submission_id', 'Envío'], ['full_name', 'Nombre completo'], ['cedula', 'Cédula'],
    ['birth_date', 'Fecha de nacimiento'], ['age_at_submission', 'Edad al registrarse'], ['whatsapp', 'WhatsApp'], ['email', 'Correo'],
    ['city', 'Ciudad'], ['main_network', 'Red principal'], ['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['facebook', 'Facebook'],
    ['previous_participation', 'Participación anterior'], ['community_source', 'Comunidad de origen'], ['kit_pickup', 'Retiro de kit'],
    ['representative_name', 'Representante'], ['representative_cedula', 'Cédula del representante'], ['representative_phone', 'Teléfono del representante'], ['representative_email', 'Correo del representante'],
  ];
  function renderDetail(data) {
    const dl = node('dl', undefined, 'detail-fields');
    for (const [key, label] of details) {
      const field = node('div'); field.append(node('dt', label), node('dd', data[key] ?? '—')); dl.append(field);
    }
    const submitted = node('p', 'Registrado: ' + dateTime(data.submitted_at) + ' · Hora de Ecuador');
    const consents = node('section'); consents.append(node('h3', 'Consentimientos'));
    for (const consent of data.consents ?? []) consents.append(node('p', `${consent.consent_type ?? 'Consentimiento'} · ${consent.text_version ?? '—'} · ${consent.accepted ? 'Aceptado' : 'No aceptado'} · ${dateTime(consent.accepted_at)}`));
    query('[data-detail-content]').replaceChildren(submitted, dl, consents);
    statusForm.elements.status.value = data.status;
    renderProgress(data.progress ?? {});
    query('[data-notes]').replaceChildren();
    for (const note of data.notes ?? []) {
      const li = node('li'); li.append(node('p', note.body), node('small', `${dateTime(note.created_at)} · Usuario ${note.author_id}`)); query('[data-notes]').append(li);
    }
    if (!data.notes?.length) query('[data-notes]').append(node('li', 'Todavía no hay notas.'));
  }
  function renderProgress(progress) {
    const value = progress ?? {};
    progressForm.elements.followers_count.value = String(Number(value.followers_count) || 0);
    progressForm.elements.level.value = String(Number(value.level) || 0);
    progressForm.elements.traffic_light.value = value.traffic_light ?? 'red';
    progressForm.elements.kit_status.value = value.kit_status ?? 'pendiente';
    const videos = Array.isArray(value.videos) ? value.videos : [];
    const enabledCount = videos.filter(video => Boolean(video.unlocked)).length;
    progressSummary.textContent = `${value.level_label ?? 'En preparación'} · ${Number(value.followers_count) || 0} seguidores validados · ${enabledCount} de 5 videos habilitados · ${value.kit_status === 'retirado' ? 'Kit retirado' : 'Kit pendiente'}`;
    adminVideos.replaceChildren();
    for (const video of videos) {
      const stateClass = video.unlocked ? (video.status === 'submitted' ? ' admin-video-item--submitted' : ' admin-video-item--enabled') : '';
      const item = node('article', undefined, 'admin-video-item' + stateClass);
      item.append(node('strong', `Video ${video.slot}`), node('span', video.unlocked ? (video.status === 'submitted' ? 'Enlace recibido' : 'Habilitado') : 'Bloqueado'));
      if (video.enabled_at) item.append(node('small', 'Disponible desde ' + dateOnly(String(video.enabled_at).slice(0, 10))));
      if (video.url) { const link = node('a', video.url); link.href = video.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; item.append(link); }
      adminVideos.append(item);
    }
    if (!adminVideos.children.length) adminVideos.append(node('p', 'Los cinco espacios aparecerán al actualizar el progreso.'));
  }
  for (const slot of [1, 2, 3, 4, 5]) {
    const checkbox = scheduleVideoInput(slot, 'enabled'); const date = scheduleVideoInput(slot, 'enabled_at');
    checkbox?.addEventListener('change', () => { if (date) { date.required = checkbox.checked; if (!checkbox.checked) date.value = ''; } });
  }
  async function loadDetail(id, generation, media = false) {
    const data = await client.request('/voceros/' + encodeURIComponent(id));
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
      const path = '/voceros/' + encodeURIComponent(id) + (kind === 'note' ? '/notes' : kind === 'progress' ? '/progress' : '');
      await client.request(path, { method: kind === 'note' ? 'POST' : 'PATCH', body });
      saved = true;
      // A confirmed status change affects the workspace even if its inspector closed.
      // Start both refreshes before checking detail lifetime or reloading the detail.
      if (kind === 'status') {
        const results = await Promise.allSettled([list(), summary()]);
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
    const result = collectProgressPayload(progressForm);
    if (result.error) { feedback(progressFeedback, result.error, 'error'); result.focus?.(); return; }
    progressForm.dataset.pendingBody = JSON.stringify(result.body);
    mutate(event, 'progress', result.body);
  });
  const scheduleProgressAutosave = () => {
    if (!currentId || progressForm.querySelector('fieldset').disabled) return;
    globalThis.clearTimeout(progressAutosaveTimer);
    progressAutosaveTimer = globalThis.setTimeout(() => {
      if (!currentId || progressForm.querySelector('fieldset').disabled) return;
      const result = collectProgressPayload(progressForm);
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
    const result = collectVideoSchedulePayload(scheduleVideoInput);
    if (result.error) { feedback(globalVideoFeedback, result.error, 'error'); result.focus?.(); return; }
    globalVideoForm.querySelector('fieldset').disabled = true;
    feedback(globalVideoFeedback, 'Guardando fechas globales…');
    try {
      const data = await client.updateVideoSchedule(result.body);
      renderVideoSchedule(Array.isArray(data.video_slots) ? data.video_slots : []);
      await Promise.allSettled([list(), currentId ? loadDetail(currentId, detailGeneration) : Promise.resolve()]);
      feedback(globalVideoFeedback, 'Fechas globales guardadas para todos los voceros.', 'success');
    } catch (error) { fail(error, globalVideoFeedback); }
    finally { globalVideoForm.querySelector('fieldset').disabled = false; }
  });
  noteForm.addEventListener('submit', event => mutate(event, 'note'));
  form.addEventListener('submit', event => {
    event.preventDefault();
    try { filters = normalizeFilters(Object.fromEntries(new FormData(form))); feedback(status, ''); list(); } catch (error) { fail(error); }
  });
  form.addEventListener('reset', () => { filters = normalizeFilters(); feedback(status, ''); list(); });
  previous.addEventListener('click', () => { filters.page = Math.max(1, pagination.page - 1); list(); });
  next.addEventListener('click', () => { filters.page = pagination.page + 1; list(); });
  exportButton.addEventListener('click', async () => {
    exportButton.disabled = true; feedback(status, 'Preparando exportación con los filtros aplicados…');
    try {
      const blob = await client.export(filters);
      const url = URL.createObjectURL(blob);
      const link = node('a'); link.href = url; link.download = 'voceros.csv'; document.body.append(link); link.click(); link.remove();
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
    query('[data-admin-user]').textContent = `Sesión: ${username} · Registros del formulario de Voceros`;
    if (sidebarUser) sidebarUser.textContent = username;
    form.querySelector('fieldset').disabled = false; exportButton.disabled = false; logout.disabled = false;
    const results = await Promise.allSettled([summary(), list(), loadPendingAccounts(), loadVideoSchedule()]);
    for (const result of results) if (result.status === 'rejected') { fail(result.reason); retry.hidden = false; }
  };
  await session();
}
if (typeof document !== 'undefined') initializeAdmin();
