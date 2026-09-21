import { MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';

export const MEDIA_STATUSES = Object.freeze(['Nuevo', 'En revisión', 'Aprobado', 'Rechazado']);
const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
const FILTERS = ['search', 'status'];
const DETAIL_FIELDS = Object.freeze([
  ['media_name', 'Nombre del medio'], ['frequency_channel', 'Frecuencia / canal'], ['social_link', 'Link de redes'], ['account_email', 'Correo de la cuenta'],
]);
const LINK_FIELDS = new Set(['social_link']);

export function normalizeMediaFilters(input = {}) {
  const result = {};
  for (const key of FILTERS) {
    const value = String(input[key] ?? '').trim();
    if (value) result[key] = value;
  }
  if (result.status && !MEDIA_STATUSES.includes(result.status)) throw new Error('Selecciona un estado válido.');
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
    if (!/^\/(?:auth\/(?:session|logout)|media-accounts|medios(?:\/export)?)(?:\?[^#]*)?$/.test(path)
      && !/^\/medios\/[a-f0-9]{32}(?:\/(?:delete|notes|password-reset|video-views))?$/.test(path)
      && !/^\/media-accounts\/[a-f0-9]{32}\/delete$/.test(path)) throw new Error('Ruta de API no permitida.');
    const method = (options.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST', 'PATCH'].includes(method)) throw new Error('Método no permitido.');
    const headers = { Accept: options.blob ? 'text/csv' : 'application/json' };
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
    changeStatus: (id, status) => request(`/medios/${id}`, { method: 'PATCH', body: { status } }),
    addNote: (id, body) => request(`/medios/${id}/notes`, { method: 'POST', body: { body } }),
    updateVideoViews: (id, views) => request(`/medios/${id}/video-views`, { method: 'PATCH', body: { video_views: views } }),
    archive: id => request(`/medios/${id}/delete`, { method: 'POST', body: {} }),
    passwordReset: id => request(`/medios/${id}/password-reset`, { method: 'POST', body: {} }),
    pendingAccounts: () => request('/media-accounts'),
    archiveAccount: id => request(`/media-accounts/${id}/delete`, { method: 'POST', body: {} }),
    export: filters => {
      const { page, pageSize, ...body } = normalizeMediaFilters(filters);
      return request('/medios/export', { method: 'POST', body, blob: true });
    },
  };
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

  const clearDetail = () => {
    currentId = null; detailGeneration++;
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
      records.replaceChildren();
      for (const record of data.items) {
        const row = node('tr');
        const cell = (label, value, secondary) => {
          const td = node('td'); td.dataset.label = label;
          td.append(node('span', value)); if (secondary) td.append(node('small', secondary)); row.append(td); return td;
        };
        cell('Medio', record.media_name).className = 'record-name';
        cell('Frecuencia', record.frequency_channel);
        cell('Redes', '').replaceChildren(linkNode(record.social_link));
        cell('Videos', record.videos_count === 1 ? '1 video' : `${record.videos_count ?? 0} videos`, `${new Intl.NumberFormat('es-EC').format(record.views_total ?? 0)} views`);
        cell('Registro', dateTime(record.submitted_at));
        const badge = node('span', record.status, 'status-badge'); badge.dataset.status = record.status;
        cell('Estado', '').replaceChildren(badge);
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

  async function loadDetail(id, generation) {
    const data = await client.detail(id);
    if (generation !== detailGeneration) return false;
    const submitted = node('p', `Registrado: ${dateTime(data.submitted_at)} · Actualizado: ${dateTime(data.updated_at)} · Último acceso: ${dateTime(data.last_login_at)}`);
    const dl = node('dl', undefined, 'detail-fields');
    for (const [key, label] of DETAIL_FIELDS) {
      const field = node('div'); const value = node('dd');
      if (LINK_FIELDS.has(key)) value.append(linkNode(data[key])); else value.textContent = data[key] === '' || data[key] == null ? '—' : data[key];
      field.append(node('dt', label), value); dl.append(field);
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
      item.append(info, label); videoList.append(item);
    }
    videos.append(videoList);
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
    detailContent.replaceChildren(submitted, dl, videos);
    statusForm.elements.status.value = data.status;
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
  statusForm.addEventListener('submit', event => mutate(event, id => client.changeStatus(id, statusForm.elements.status.value), 'Estado actualizado.', true));
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
      await Promise.all([list(), pending()]);
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', session);
  await session();
}

if (typeof document !== 'undefined') initializeMediaAdmin();
