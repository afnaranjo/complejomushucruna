import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
import './sidebar.js?v=20260923-admin-sidebar-1';
import { rangeLabel, phaseLabel, todayLabel } from './campaign-banner.js?v=20260923-noticias-1';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';

export class NewsError extends Error {
  constructor(status) {
    super(status === 0 ? 'No se pudo conectar con el servidor.'
      : status === 401 ? 'Tu sesión expiró.'
      : status === 422 ? 'Revisa los datos.'
      : 'No se pudo completar la operación.');
    this.status = status;
  }
}

export function createNewsClient(baseUrl = API, fetchImplementation = fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  let csrf = '';
  async function request(path, options = {}) {
    if (!/^\/(?:auth\/(?:session|logout)|noticias|noticias\/(?:fases|avisos))$/.test(path)
      && !/^\/noticias\/(?:fases|avisos)\/[a-f0-9]{32}$/.test(path)) throw new Error('Ruta de API no permitida.');
    const method = (options.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST', 'PATCH'].includes(method)) throw new Error('Método no permitido.');
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') {
      if (!csrf) throw new NewsError(403);
      headers['X-CSRF-Token'] = csrf;
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch { throw new NewsError(0); }
    if (!response.ok) throw new NewsError(response.status);
    let data;
    try { data = await response.json(); } catch { throw new NewsError(502); }
    if (typeof data.csrf === 'string') csrf = data.csrf;
    return data;
  }
  return {
    request,
    session: () => request('/auth/session'),
    logout: () => request('/auth/logout', { method: 'POST' }),
    overview: () => request('/noticias'),
    createPhase: body => request('/noticias/fases', { method: 'POST', body }),
    updatePhase: (id, body) => request(`/noticias/fases/${id}`, { method: 'PATCH', body }),
    deletePhase: id => request(`/noticias/fases/${id}`, { method: 'POST', body: {} }),
    createNotice: body => request('/noticias/avisos', { method: 'POST', body }),
    deleteNotice: id => request(`/noticias/avisos/${id}`, { method: 'POST', body: {} }),
  };
}

export function phasePayload(form) {
  const value = name => String(form.get(name) ?? '').trim();
  if (value('title') === '') throw new TypeError('Escribe el tema del tramo.');
  if (value('starts_on') === '' || value('ends_on') === '') throw new TypeError('Elige las fechas del tramo.');
  if (value('ends_on') < value('starts_on')) throw new TypeError('La fecha final no puede ser anterior a la inicial.');
  return { title: value('title'), detail: value('detail'), starts_on: value('starts_on'), ends_on: value('ends_on'), accent: value('accent') || '#94165e' };
}

export function noticePayload(form) {
  const value = name => String(form.get(name) ?? '').trim();
  if (value('body') === '') throw new TypeError('Escribe el aviso.');
  const starts = value('starts_on');
  const ends = value('ends_on');
  if (starts !== '' && ends !== '' && ends < starts) throw new TypeError('La fecha final no puede ser anterior a la inicial.');
  return { body: value('body'), starts_on: starts, ends_on: ends };
}

/** Un tramo es «el de hoy» cuando la fecha cae dentro de su rango. */
export function phaseState(phase, today) {
  if (!phase || !today) return 'otro';
  if (phase.starts_on <= today && today <= phase.ends_on) return 'actual';
  return phase.ends_on < today ? 'pasado' : 'proximo';
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}

export async function initializeAdminNoticias() {
  const panel = document.querySelector('[data-admin-noticias]');
  if (!panel) return;
  const navigation = document.querySelector('[data-admin-navigation]');
  const compact = globalThis.matchMedia?.('(max-width: 1120px)');
  const applyNavigation = value => { if (navigation) navigation.open = !value; };
  applyNavigation(compact?.matches ?? false);
  compact?.addEventListener('change', event => applyNavigation(event.matches));
  const query = selector => panel.querySelector(selector);
  const status = query('[data-admin-feedback]');
  const configured = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configured || runtime.apiBase;
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) { status.textContent = 'La configuración de acceso no es válida.'; status.dataset.error = 'true'; return; }
  const client = createNewsClient(base);
  const logout = document.querySelector('[data-admin-logout]');
  const sidebarUser = document.querySelector('[data-admin-sidebar-user]');
  const feedback = (message, kind = '') => { status.textContent = message; status.dataset.error = String(kind === 'error'); status.dataset.success = String(kind === 'success'); };
  const fail = error => { if (error.status === 401) { location.replace('/admin/'); return; } feedback(error.message, 'error'); };

  const state = { today: '', phases: [], notices: [] };
  const phaseList = query('[data-phase-list]');
  const noticeList = query('[data-notice-list]');
  const phaseDialog = query('[data-phase-dialog]');
  const phaseForm = phaseDialog?.querySelector('form');
  const phaseTitle = phaseDialog?.querySelector('[data-phase-title]');
  const phaseFeedback = phaseDialog?.querySelector('[data-phase-feedback]');
  const phaseRemove = phaseDialog?.querySelector('[data-phase-remove]');
  const noticeDialog = query('[data-notice-dialog]');
  const noticeForm = noticeDialog?.querySelector('form');
  const noticeFeedback = noticeDialog?.querySelector('[data-notice-feedback]');
  let editing = '';

  function render() {
    phaseList.replaceChildren();
    if (!state.phases.length) phaseList.append(node('li', 'Todavía no hay tramos. Agrega el primero.', 'admin-panel-empty'));
    for (const phase of state.phases) {
      const item = node('li', undefined, 'campaign-map__item');
      item.style.setProperty('--phase-accent', phase.accent || '#94165e');
      item.dataset.state = phaseState(phase, state.today);
      const body = node('div');
      body.append(node('strong', rangeLabel(phase.starts_on, phase.ends_on), 'campaign-map__range'), node('p', phaseLabel(phase)));
      const edit = node('button', 'Editar', 'button-quiet');
      edit.type = 'button';
      edit.addEventListener('click', () => openPhase(phase));
      item.append(body, edit);
      phaseList.append(item);
    }
    noticeList.replaceChildren();
    if (!state.notices.length) noticeList.append(node('li', 'Sin avisos publicados.', 'admin-panel-empty'));
    for (const notice of state.notices) {
      const item = node('li');
      const body = node('div');
      body.append(node('strong', notice.body));
      const vigencia = notice.starts_on || notice.ends_on ? rangeLabel(notice.starts_on ?? notice.ends_on, notice.ends_on ?? notice.starts_on) : 'Siempre visible';
      body.append(node('small', vigencia));
      const remove = node('button', 'Quitar', 'button-quiet');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!confirm('¿Quitar este aviso?')) return;
        await save(() => client.deleteNotice(notice.public_id));
      });
      item.append(body, remove);
      noticeList.append(item);
    }
  }

  function apply(data) {
    state.today = data.today ?? '';
    state.phases = data.phases ?? [];
    state.notices = data.all_notices ?? data.notices ?? [];
    render();
  }

  async function save(action) {
    try { apply(await action()); feedback('Noticias actualizadas.', 'success'); }
    catch (error) { fail(error); }
  }

  function openPhase(phase) {
    editing = phase?.public_id ?? '';
    if (phaseTitle) phaseTitle.textContent = phase ? 'Editar tramo' : 'Agregar tramo';
    if (phaseFeedback) { phaseFeedback.textContent = ''; phaseFeedback.dataset.error = 'false'; }
    if (phaseRemove) phaseRemove.hidden = !phase;
    phaseForm.elements.title.value = phase?.title ?? '';
    phaseForm.elements.detail.value = phase?.detail ?? '';
    phaseForm.elements.starts_on.value = phase?.starts_on ?? '';
    phaseForm.elements.ends_on.value = phase?.ends_on ?? '';
    phaseForm.elements.accent.value = phase?.accent ?? '#94165e';
    phaseDialog.showModal();
  }

  query('[data-phase-new]')?.addEventListener('click', () => openPhase(null));
  phaseForm?.addEventListener('submit', async event => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    let payload;
    try { payload = phasePayload(new FormData(phaseForm)); }
    catch (error) { if (phaseFeedback) { phaseFeedback.textContent = error.message; phaseFeedback.dataset.error = 'true'; } return; }
    try {
      apply(editing ? await client.updatePhase(editing, payload) : await client.createPhase(payload));
      phaseDialog.close();
      feedback(editing ? 'Tramo actualizado.' : 'Tramo agregado.', 'success');
    } catch (error) { if (phaseFeedback) { phaseFeedback.textContent = error.message; phaseFeedback.dataset.error = 'true'; } if (error.status === 401) fail(error); }
  });
  phaseRemove?.addEventListener('click', async () => {
    if (!editing || !confirm('¿Quitar este tramo del mapa?')) return;
    const id = editing;
    phaseDialog.close();
    await save(() => client.deletePhase(id));
  });

  query('[data-notice-new]')?.addEventListener('click', () => {
    noticeForm.reset();
    if (noticeFeedback) { noticeFeedback.textContent = ''; noticeFeedback.dataset.error = 'false'; }
    noticeDialog.showModal();
  });
  noticeForm?.addEventListener('submit', async event => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    let payload;
    try { payload = noticePayload(new FormData(noticeForm)); }
    catch (error) { if (noticeFeedback) { noticeFeedback.textContent = error.message; noticeFeedback.dataset.error = 'true'; } return; }
    try {
      apply(await client.createNotice(payload));
      noticeDialog.close();
      feedback('Aviso publicado.', 'success');
    } catch (error) { if (noticeFeedback) { noticeFeedback.textContent = error.message; noticeFeedback.dataset.error = 'true'; } if (error.status === 401) fail(error); }
  });

  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await client.logout(); location.replace('/admin/'); }
    catch (error) { logout.disabled = false; fail(error); }
  });

  try {
    const session = await client.session();
    if (!session.authenticated) { location.replace('/admin/'); return; }
    query('[data-admin-user]').textContent = `Sesión de ${session.user.username} · hoy es ${todayLabel(state.today) || 'hoy'}`;
    if (sidebarUser) sidebarUser.textContent = session.user.username;
    if (logout) logout.disabled = false;
    apply(await client.overview());
    query('[data-admin-user]').textContent = `Sesión de ${session.user.username} · hoy es ${todayLabel(state.today)}`;
    feedback('');
  } catch (error) { fail(error); }
}

if (typeof document !== 'undefined') initializeAdminNoticias();
