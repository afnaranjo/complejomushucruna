import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
import './sidebar.js?v=20260923-admin-sidebar-1';
import './campaign-banner.js?v=20260923-noticias-1';

export const MFS_STATUSES = Object.freeze(['Nuevo', 'En revisión', 'Aprobado', 'Rechazado', 'Seleccionado']);
export const MFS_ARCHIVED = 'Archivado';
const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
const FILTERS = ['search', 'status'];

export function maskPhone(value) {
  const text = String(value ?? '');
  return text.length > 4 ? '*'.repeat(text.length - 4) + text.slice(-4) : '*'.repeat(text.length);
}

export function normalizeMfsFilters(input = {}) {
  const result = {};
  for (const key of FILTERS) {
    const value = String(input[key] ?? '').trim();
    if (value) result[key] = value;
  }
  if (result.status && ![...MFS_STATUSES, MFS_ARCHIVED].includes(result.status)) throw new Error('Selecciona un estado válido.');
  if (result.search && result.search.length > 180) throw new Error('La búsqueda es demasiado larga.');
  result.page = Math.min(1000000, Math.max(1, Number.parseInt(input.page, 10) || 1));
  result.pageSize = [25, 50, 100].includes(Number(input.pageSize)) ? Number(input.pageSize) : 25;
  return result;
}

export function renderMfsSummary(data = {}) {
  return [
    { label: 'Inscritos', value: data.total ?? 0 },
    { label: 'Nuevos', value: data.byStatus?.Nuevo ?? 0 },
    { label: 'Seleccionados', value: data.byStatus?.Seleccionado ?? 0 },
    { label: 'Últimos 7 días', value: data.lastSevenDays ?? 0 },
    { label: 'Cuentas sin ficha', value: data.pendingAccounts ?? 0 },
  ];
}

/** Solo se abren como enlace las audiciones HTTPS de TikTok; cualquier otro valor se muestra como texto. */
export function safeTikTokLink(value) {
  try {
    const url = new URL(String(value ?? ''));
    return url.protocol === 'https:' && ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'].includes(url.hostname) ? url.href : '';
  } catch { return ''; }
}

export class MfsAdminError extends Error {
  constructor(status) {
    super(({ 0: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.', 401: 'La sesión venció. Inicia sesión nuevamente.', 403: 'No se autorizó la solicitud. Actualiza la página e intenta de nuevo.', 404: 'La inscripción no está disponible.', 422: 'Revisa los datos ingresados e intenta de nuevo.', 429: 'Hay demasiados intentos. Espera antes de volver a intentar.' })[status] ?? 'No se pudo completar la solicitud. Intenta de nuevo.');
    this.status = status;
  }
}

export function createMfsAdminClient(baseUrl = API, fetchImplementation = fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  let csrf = '';
  async function request(path, options = {}) {
    if (!/^\/(?:auth\/(?:session|logout)|mfs-dashboard|mfs-accounts|mfs-participants(?:\/export)?)(?:\?[^#]*)?$/.test(path)
      && !/^\/mfs-participants\/[a-f0-9]{32}(?:\/(?:notes|audition|delete|restore|photo|password-reset))?$/.test(path)
      && !/^\/mfs-accounts\/[a-f0-9]{32}\/delete$/.test(path)) throw new Error('Ruta de API no permitida.');
    const method = (options.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST', 'PATCH'].includes(method)) throw new Error('Método no permitido.');
    const headers = { Accept: options.blob && path.endsWith('/photo') ? 'image/jpeg' : 'application/json' };
    if (method !== 'GET') {
      if (!csrf) throw new MfsAdminError(403);
      headers['X-CSRF-Token'] = csrf;
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch { throw new MfsAdminError(0); }
    if (!response.ok) throw new MfsAdminError(response.status);
    if (options.blob) {
      if (path.endsWith('/photo') && response.headers.get('Content-Type')?.split(';')[0] !== 'image/jpeg') throw new MfsAdminError(502);
      return response.blob();
    }
    let data;
    try { data = await response.json(); } catch { throw new MfsAdminError(502); }
    if (typeof data.csrf === 'string') csrf = data.csrf;
    return data;
  }
  return {
    request,
    session: () => request('/auth/session'),
    logout: () => request('/auth/logout', { method: 'POST' }),
    dashboard: () => request('/mfs-dashboard'),
    list: filters => request('/mfs-participants?' + new URLSearchParams(normalizeMfsFilters(filters))),
    pendingAccounts: () => request('/mfs-accounts'),
    deletePendingAccount: id => request(`/mfs-accounts/${id}/delete`, { method: 'POST', body: {} }),
    detail: id => request(`/mfs-participants/${id}`),
    photo: id => request(`/mfs-participants/${id}/photo`, { blob: true }),
    setStatus: (id, status) => request(`/mfs-participants/${id}`, { method: 'PATCH', body: { status } }),
    addNote: (id, body) => request(`/mfs-participants/${id}/notes`, { method: 'POST', body: { body } }),
    correctAudition: (id, url) => request(`/mfs-participants/${id}/audition`, { method: 'POST', body: { url } }),
    archive: id => request(`/mfs-participants/${id}/delete`, { method: 'POST', body: {} }),
    restore: id => request(`/mfs-participants/${id}/restore`, { method: 'POST', body: {} }),
    passwordReset: id => request(`/mfs-participants/${id}/password-reset`, { method: 'POST', body: {} }),
    export: filters => {
      const { page, pageSize, ...body } = normalizeMfsFilters(filters);
      return request('/mfs-participants/export', { method: 'POST', body, blob: true });
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
  if (!element) return;
  element.textContent = message;
  element.dataset.error = String(kind === 'error');
  element.dataset.success = String(kind === 'success');
}
function dateTime(value) {
  if (!value) return '—';
  const parsed = new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : String(value).replace(' ', 'T') + 'Z');
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(parsed);
}
function tiktokLink(value) {
  const href = safeTikTokLink(value);
  if (!href) return node('span', value || '—');
  const link = node('a', 'Ver audición ↗');
  link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.title = href;
  return link;
}

export async function initializeMfsAdmin() {
  const panel = document.querySelector('[data-admin-mfs]');
  if (!panel) return;
  const navigation = document.querySelector('[data-admin-navigation]');
  const compact = globalThis.matchMedia?.('(max-width: 1120px)');
  if (navigation) navigation.open = !(compact?.matches ?? false);
  compact?.addEventListener('change', event => { if (navigation) navigation.open = !event.matches; });

  const query = selector => panel.querySelector(selector);
  const status = query('[data-admin-feedback]');
  const retry = query('[data-session-retry]');
  const configuredBase = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredBase || runtime.apiBase;
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) { feedback(status, 'La configuración de acceso no es válida.', 'error'); return; }
  const client = createMfsAdminClient(base);
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
  const dialog = query('[data-detail]');
  const detailFeedback = query('[data-detail-feedback]');
  const statusForm = query('[data-status-form]');
  const auditionForm = query('[data-audition-form]');
  const noteForm = query('[data-note-form]');
  const photoImage = query('[data-admin-photo-image]');
  const photoMessage = query('[data-admin-photo-message]');
  const resetButton = query('[data-admin-reset]');
  const resetOutput = query('[data-reset-output]');
  const resetInput = query('[data-reset-url]');
  const resetFeedback = query('[data-reset-feedback]');
  const archiveButton = query('[data-admin-delete]');
  const restoreButton = query('[data-admin-restore]');
  const logout = document.querySelector('[data-admin-logout]');
  const sidebarUser = document.querySelector('[data-admin-sidebar-user]');
  let filters = normalizeMfsFilters();
  let pagination = { page: 1, pages: 0 };
  let currentId = '';
  let generation = 0;
  let photoUrl = '';
  let opener = null;
  const confirmAction = message => typeof globalThis.confirm === 'function' && globalThis.confirm(message);
  const fail = (error, target = status) => {
    if (error.status === 401) { location.replace('/admin/'); return; }
    feedback(target, error.message, 'error');
  };
  const detailForms = [statusForm, auditionForm, noteForm];
  const lockDetail = locked => { for (const item of detailForms) item.querySelector('fieldset').disabled = locked; };

  function clearDetail() {
    generation++;
    currentId = '';
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = '';
    photoImage.removeAttribute('src'); photoImage.hidden = true; photoMessage.textContent = '';
    resetInput.value = ''; resetOutput.hidden = true; feedback(resetFeedback, '');
    resetButton.disabled = archiveButton.disabled = true; restoreButton.hidden = true; archiveButton.hidden = false;
    query('[data-detail-content]').replaceChildren(); query('[data-notes]').replaceChildren();
    for (const item of detailForms) item.reset();
    lockDetail(true);
  }
  globalThis.addEventListener?.('pagehide', clearDetail);

  async function summary() {
    dashboard.setAttribute('aria-busy', 'true');
    try {
      const data = await client.dashboard();
      dashboard.replaceChildren();
      for (const metric of renderMfsSummary(data)) {
        const block = node('dl'); block.append(node('dt', metric.label), node('dd', metric.value)); dashboard.append(block);
      }
    } finally { dashboard.setAttribute('aria-busy', 'false'); }
  }

  async function loadPendingAccounts() {
    try {
      const data = await client.pendingAccounts();
      const items = Array.isArray(data.items) ? data.items : [];
      pendingAccounts.replaceChildren();
      pendingCount.textContent = `${items.length} ${items.length === 1 ? 'cuenta' : 'cuentas'}`;
      for (const account of items) {
        const row = node('tr');
        const email = node('td', account.email); email.dataset.label = 'Correo';
        const created = node('td', dateTime(account.created_at)); created.dataset.label = 'Creada';
        const action = node('td'); action.dataset.label = 'Acciones';
        const button = node('button', 'Retirar cuenta', 'button-danger'); button.type = 'button';
        button.addEventListener('click', async () => {
          if (!confirmAction('Esto desactivará el acceso de esta cuenta y conservará su trazabilidad. ¿Continuar?')) return;
          button.disabled = true; feedback(pendingMessage, 'Retirando cuenta…');
          try { await client.deletePendingAccount(account.public_id); await Promise.all([summary(), loadPendingAccounts()]); feedback(pendingMessage, 'Cuenta retirada.', 'success'); }
          catch (error) { button.disabled = false; fail(error, pendingMessage); }
        });
        action.append(button); row.append(email, created, action); pendingAccounts.append(row);
      }
      feedback(pendingMessage, items.length ? '' : 'No hay cuentas pendientes de ficha.');
    } catch (error) { pendingAccounts.replaceChildren(); pendingCount.textContent = 'No disponible'; fail(error, pendingMessage); }
  }

  async function list() {
    region.setAttribute('aria-busy', 'true');
    previous.disabled = next.disabled = true;
    const message = query('[data-list-message]');
    feedback(message, 'Cargando inscripciones…');
    try {
      const data = await client.list(filters);
      pagination = data.pagination;
      if (pagination.pages > 0 && pagination.page > pagination.pages) { filters.page = pagination.pages; return list(); }
      records.replaceChildren();
      for (const record of data.items) {
        const row = node('tr');
        const cell = (label, value, secondary) => {
          const td = node('td'); td.dataset.label = label;
          if (value instanceof Node) td.append(value); else td.append(node('span', value));
          if (secondary) td.append(node('small', secondary));
          row.append(td); return td;
        };
        cell('Participante', record.full_name, record.stage_name ? `«${record.stage_name}»` : 'Sin nombre artístico').className = 'record-name';
        cell('Contacto', maskPhone(record.whatsapp), record.email);
        cell('Audición', tiktokLink(record.audition_url));
        cell('Foto', record.has_photo ? 'Sí' : 'No');
        cell('Inscripción', dateTime(record.submitted_at));
        const badge = node('span', record.status, 'status-badge'); badge.dataset.status = record.status;
        cell('Estado', badge);
        const open = node('button', 'Ver detalle', 'button-quiet'); open.type = 'button';
        open.setAttribute('aria-label', 'Ver detalle de ' + record.full_name);
        open.addEventListener('click', () => openDetail(record.public_id, open));
        cell('Acciones', open);
        records.append(row);
      }
      query('[data-record-count]').textContent = `${pagination.total} resultados`;
      query('[data-page-label]').textContent = pagination.pages ? `Página ${pagination.page} de ${pagination.pages}` : 'Sin páginas';
      feedback(message, data.items.length ? '' : 'No hay inscripciones con estos filtros.');
    } catch (error) {
      records.replaceChildren(); query('[data-record-count]').textContent = 'No disponible';
      pagination = { page: 1, pages: 0 }; fail(error, message);
    } finally {
      region.setAttribute('aria-busy', 'false');
      previous.disabled = pagination.page <= 1;
      next.disabled = pagination.page >= pagination.pages;
    }
  }

  const fields = [['public_id', 'Identificador'], ['full_name', 'Nombres y apellidos'], ['stage_name', 'Nombre artístico'], ['whatsapp', 'WhatsApp'], ['email', 'Correo']];
  function renderDetail(data) {
    const dl = node('dl', undefined, 'detail-fields');
    for (const [key, label] of fields) { const field = node('div'); field.append(node('dt', label), node('dd', data[key] || '—')); dl.append(field); }
    const audition = node('div'); audition.append(node('dt', 'Audición en TikTok'));
    const auditionValue = node('dd'); auditionValue.append(tiktokLink(data.audition_url), node('small', ` · enviada ${dateTime(data.audition_submitted_at)}`)); audition.append(auditionValue); dl.append(audition);
    const submitted = node('p', `Inscripción: ${dateTime(data.submitted_at)} · Estado: ${data.status}${data.account?.active === false ? ' · Cuenta desactivada' : ''}`);
    const consents = node('section'); consents.append(node('h3', 'Consentimientos'));
    for (const consent of data.consents ?? []) consents.append(node('p', `${consent.consent_type} · ${consent.text_version} · ${consent.accepted ? 'Aceptado' : 'No aceptado'} · ${dateTime(consent.recorded_at)}`));
    consents.append(node('p', `Declaración del video: ${data.video_declaration_at ? 'confirmada ' + dateTime(data.video_declaration_at) : '—'}`));
    query('[data-detail-content]').replaceChildren(submitted, dl, consents);
    const archived = data.status === MFS_ARCHIVED;
    statusForm.elements.status.value = archived ? 'En revisión' : data.status;
    auditionForm.elements.url.value = data.audition_url ?? '';
    archiveButton.hidden = archived; restoreButton.hidden = !archived;
    archiveButton.disabled = archived;
    resetButton.disabled = !data.account?.active;
    const notes = query('[data-notes]'); notes.replaceChildren();
    for (const note of data.notes ?? []) { const li = node('li'); li.append(node('p', note.body), node('small', `${dateTime(note.created_at)} · ${note.author ?? 'Administración'}`)); notes.append(li); }
    if (!data.notes?.length) notes.append(node('li', 'Todavía no hay notas.'));
    lockDetail(false);
    statusForm.querySelector('fieldset').disabled = archived;
    auditionForm.querySelector('fieldset').disabled = archived;
  }

  async function loadDetail(id, withPhoto = false) {
    const mine = generation;
    const data = await client.detail(id);
    if (mine !== generation || currentId !== id) return;
    renderDetail(data);
    if (withPhoto) {
      photoMessage.textContent = data.photo?.available ? 'Cargando fotografía…' : 'Sin fotografía';
      if (data.photo?.available) {
        try {
          const blob = await client.photo(id);
          if (mine !== generation) return;
          photoUrl = URL.createObjectURL(blob);
          photoImage.src = photoUrl; photoImage.hidden = false;
          photoMessage.textContent = 'Fotografía privada del participante.';
        } catch (error) { if (mine === generation) fail(error, photoMessage); }
      }
    }
  }

  async function openDetail(id, trigger) {
    clearDetail();
    currentId = id; opener = trigger;
    dialog.showModal(); query('#detail-title').focus();
    feedback(detailFeedback, 'Cargando detalle…');
    try { await loadDetail(id, true); feedback(detailFeedback, ''); }
    catch (error) { fail(error, detailFeedback); }
  }
  query('[data-detail-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { clearDetail(); (opener?.isConnected ? opener : query('#records-title')).focus(); });

  async function act(action, success, refreshList = true) {
    const id = currentId;
    if (!id) return;
    lockDetail(true); archiveButton.disabled = true;
    feedback(detailFeedback, 'Guardando…');
    try {
      await action(id);
      await Promise.allSettled(refreshList ? [list(), summary()] : []);
      if (currentId === id) { await loadDetail(id); feedback(detailFeedback, success, 'success'); }
    } catch (error) { fail(error, detailFeedback); if (currentId === id) lockDetail(false); }
  }
  statusForm.addEventListener('submit', event => { event.preventDefault(); act(id => client.setStatus(id, statusForm.elements.status.value), 'Estado actualizado.'); });
  auditionForm.addEventListener('submit', event => {
    event.preventDefault();
    const url = auditionForm.elements.url.value.trim();
    if (!safeTikTokLink(url)) { feedback(detailFeedback, 'El enlace debe ser de un video de TikTok (https://www.tiktok.com/…).', 'error'); return; }
    if (!confirmAction('Vas a reemplazar la audición enviada por el participante. ¿Continuar?')) return;
    act(id => client.correctAudition(id, url), 'Audición corregida.');
  });
  noteForm.addEventListener('submit', event => {
    event.preventDefault();
    const text = noteForm.elements.body.value.trim();
    if (!text) { feedback(detailFeedback, 'Escribe una nota antes de guardar.', 'error'); return; }
    act(async id => { await client.addNote(id, text); noteForm.reset(); }, 'Nota guardada.', false);
  });
  archiveButton.addEventListener('click', () => {
    if (!confirmAction('Esto ocultará la inscripción y desactivará el acceso del participante. Podrás restaurarla desde el filtro «Archivado». ¿Continuar?')) return;
    act(id => client.archive(id), 'Inscripción retirada. Puedes restaurarla cuando quieras.');
  });
  restoreButton.addEventListener('click', () => act(id => client.restore(id), 'Inscripción restaurada: vuelve a «En revisión» y la cuenta recupera el acceso.'));
  resetButton.addEventListener('click', async () => {
    const id = currentId;
    if (!id) return;
    resetButton.disabled = true; resetOutput.hidden = true;
    feedback(resetFeedback, 'Generando enlace…');
    try {
      const data = await client.passwordReset(id);
      const url = new URL(data.resetUrl);
      if (!isAllowedSiteOrigin(url.origin) || url.pathname !== '/finados/mfs/restablecer/' || !/^\?token=[a-f0-9]{64}$/.test(url.search)) throw new MfsAdminError(502);
      if (currentId !== id) return;
      resetInput.value = data.resetUrl; resetOutput.hidden = false;
      feedback(resetFeedback, 'Enlace válido por 30 minutos y un solo uso. Entrégalo por el canal acordado.');
    } catch (error) { fail(error, resetFeedback); } finally { if (currentId === id) resetButton.disabled = false; }
  });
  query('[data-reset-copy]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(resetInput.value); feedback(resetFeedback, 'Enlace copiado.', 'success'); }
    catch { feedback(resetFeedback, 'No se pudo copiar. Selecciona y copia el enlace de la caja.', 'error'); }
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    try { filters = normalizeMfsFilters(Object.fromEntries(new FormData(form))); feedback(status, ''); list(); } catch (error) { fail(error); }
  });
  form.addEventListener('reset', () => { filters = normalizeMfsFilters(); feedback(status, ''); list(); });
  previous.addEventListener('click', () => { filters.page = Math.max(1, pagination.page - 1); list(); });
  next.addEventListener('click', () => { filters.page = pagination.page + 1; list(); });
  exportButton.addEventListener('click', async () => {
    exportButton.disabled = true; feedback(status, 'Preparando exportación con los filtros aplicados…');
    try {
      const blob = await client.export(filters);
      const url = URL.createObjectURL(blob);
      const link = node('a'); link.href = url; link.download = 'mushuc-freestyle.csv'; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      feedback(status, 'Exportación descargada.', 'success');
    } catch (error) { fail(error); } finally { exportButton.disabled = false; }
  });
  logout?.addEventListener('click', async () => {
    if (dialog.open) dialog.close();
    logout.disabled = true;
    try { await client.logout(); location.replace('/admin/'); } catch (error) { fail(error); logout.disabled = false; }
  });

  async function start() {
    retry.hidden = true;
    feedback(status, 'Comprobando acceso…');
    try {
      const session = await client.session();
      if (!session.authenticated) { location.replace('/admin/'); return; }
      const username = session.user?.username ?? 'equipo';
      query('[data-admin-user]').textContent = `Sesión: ${username} · Mushuc Freestyle 2026`;
      if (sidebarUser) sidebarUser.textContent = username;
      form.querySelector('fieldset').disabled = false; exportButton.disabled = false; if (logout) logout.disabled = false;
      feedback(status, '');
      const results = await Promise.allSettled([summary(), list(), loadPendingAccounts()]);
      for (const result of results) if (result.status === 'rejected') { fail(result.reason); retry.hidden = false; }
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', start);
  await start();
}
if (typeof document !== 'undefined') initializeMfsAdmin();
