import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
import './sidebar.js?v=20260926-admin-sidebar-3';
import { rangeLabel, phaseLabel, todayLabel, FRONTS, frontOf } from './campaign-banner.js?v=20261001-banner-3';

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
    if (!/^\/(?:auth\/(?:session|logout)|noticias|noticias\/(?:fases|avisos|acciones))$/.test(path)
      && !/^\/noticias\/(?:fases|avisos|acciones)\/[a-f0-9]{32}$/.test(path)) throw new Error('Ruta de API no permitida.');
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
    createAction: body => request('/noticias/acciones', { method: 'POST', body }),
    updateAction: (id, body) => request(`/noticias/acciones/${id}`, { method: 'PATCH', body }),
    archiveAction: id => request(`/noticias/acciones/${id}`, { method: 'POST', body: {} }),
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

export const ACTION_STATUS_LABELS = Object.freeze({ propuesta: 'Propuesta', aprobada: 'Aprobada', produccion: 'En producción', publicada: 'Publicada', descartada: 'Descartada' });

export function actionPayload(form) {
  const value = name => String(form.get(name) ?? '').trim();
  if (value('title') === '') throw new TypeError('Escribe qué debe salir.');
  if (value('starts_on') === '') throw new TypeError('Elige desde qué fecha.');
  const ends = value('ends_on') || value('starts_on');
  if (ends < value('starts_on')) throw new TypeError('La fecha final no puede ser anterior a la inicial.');
  if (!FRONTS.some(front => front.key === value('front'))) throw new TypeError('Elige un frente.');
  return { title: value('title'), starts_on: value('starts_on'), ends_on: ends, front: value('front'), status: value('status') || 'propuesta',
    channel: value('channel'), owner: value('owner'), detail: String(form.get('detail') ?? '').trim() };
}

/** Cada acción va al tramo en el que empieza; las que caen fuera de todo tramo quedan aparte. */
export function groupActions(phases = [], actions = []) {
  const groups = phases.map(phase => ({ phase, actions: [] }));
  const outside = [];
  for (const action of actions) {
    const group = groups.find(item => item.phase.starts_on <= action.starts_on && action.starts_on <= item.phase.ends_on);
    (group ? group.actions : outside).push(action);
  }
  return { groups, outside };
}

/** Las semanas del mes, de lunes a domingo, con los días del mes vecino para completar. */
export function monthWeeks(year, month) {
  const pad = value => String(value).padStart(2, '0');
  const iso = date => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first.getTime() - ((first.getUTCDay() + 6) % 7) * 86400000);
  const weeks = [];
  for (let cursor = start; weeks.length < 6; ) {
    const week = [];
    for (let day = 0; day < 7; day++) { week.push({ iso: iso(cursor), day: cursor.getUTCDate(), inMonth: cursor.getUTCMonth() === month }); cursor = new Date(cursor.getTime() + 86400000); }
    weeks.push(week);
    if (cursor.getUTCMonth() !== month && weeks.length >= 4) break;
  }
  return weeks;
}

export const actionsOn = (actions, day) => actions.filter(action => action.starts_on <= day && day <= action.ends_on);

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

  const state = { today: '', phases: [], notices: [], actions: [], view: 'lista', hidden: new Set(), month: null };
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
  const actionDialog = query('[data-action-dialog]');
  const actionForm = actionDialog?.querySelector('form');
  const actionTitle = actionDialog?.querySelector('[data-action-title]');
  const actionPhase = actionDialog?.querySelector('[data-action-phase]');
  const actionFeedback = actionDialog?.querySelector('[data-action-feedback]');
  const actionRemove = actionDialog?.querySelector('[data-action-remove]');
  const calendar = query('[data-plan-calendar]');
  const frontFilter = query('[data-front-filter]');
  let editingAction = '';
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  for (const front of FRONTS) {
    const option = node('option', front.label); option.value = front.key;
    actionForm?.elements.front.append(option);
  }
  // Abiertos se conservan al volver a dibujar; al entrar se abre el tramo de hoy.
  const opened = new Set();
  let firstRender = true;

  const visible = () => state.actions.filter(action => !state.hidden.has(action.front));

  function actionRow(action) {
    const front = frontOf(action.front);
    const row = node('button', undefined, 'campaign-action');
    row.type = 'button';
    row.style.setProperty('--front-color', front.color);
    row.dataset.status = action.status;
    const when = node('span', action.starts_on === action.ends_on ? rangeLabel(action.starts_on, action.starts_on).replace(/^\d+ – /, '') : rangeLabel(action.starts_on, action.ends_on), 'campaign-action__when');
    const main = node('span', undefined, 'campaign-action__main');
    main.append(node('strong', action.title));
    const meta = [action.channel, action.owner].filter(Boolean).join(' · ');
    if (meta) main.append(node('small', meta));
    row.append(when, node('b', front.label, 'campaign-action__front'), main, node('span', ACTION_STATUS_LABELS[action.status] ?? action.status, 'campaign-action__status'));
    row.addEventListener('click', () => openAction(action));
    return row;
  }

  function renderFilter() {
    frontFilter.replaceChildren();
    for (const front of FRONTS) {
      const count = state.actions.filter(action => action.front === front.key).length;
      const chip = node('button', `${front.label} · ${count}`, 'campaign-plan__chip');
      chip.type = 'button';
      chip.style.setProperty('--front-color', front.color);
      chip.setAttribute('aria-pressed', String(!state.hidden.has(front.key)));
      chip.addEventListener('click', () => { state.hidden.has(front.key) ? state.hidden.delete(front.key) : state.hidden.add(front.key); render(); });
      frontFilter.append(chip);
    }
  }

  function renderCalendar() {
    if (!state.month) { const [y, m] = (state.today || '2026-10-01').split('-').map(Number); state.month = { year: y, month: m - 1 }; }
    const { year, month } = state.month;
    query('[data-month-label]').textContent = `${MONTHS[month]} ${year}`;
    const grid = query('[data-month-grid]');
    grid.replaceChildren();
    for (const label of ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']) grid.append(node('span', label, 'campaign-calendar__weekday'));
    const actions = visible();
    for (const week of monthWeeks(year, month)) for (const day of week) {
      const cell = node('div', undefined, 'campaign-calendar__day');
      if (!day.inMonth) cell.dataset.outside = 'true';
      if (day.iso === state.today) cell.dataset.today = 'true';
      const phase = state.phases.find(item => item.starts_on <= day.iso && day.iso <= item.ends_on);
      if (phase) cell.style.setProperty('--phase-accent', phase.accent || '#94165e');
      const head = node('div', undefined, 'campaign-calendar__head');
      const add = node('button', String(day.day), 'campaign-calendar__number');
      add.type = 'button';
      add.title = 'Agregar una acción este día';
      add.addEventListener('click', () => openAction(null, day.iso));
      head.append(add);
      if (phase && (phase.starts_on === day.iso || (day.iso.endsWith('-01') && day.inMonth) || week[0] === day)) head.append(node('small', phase.title));
      cell.append(head);
      for (const action of actionsOn(actions, day.iso)) {
        const front = frontOf(action.front);
        const chip = node('button', action.title, 'campaign-calendar__chip');
        chip.type = 'button';
        chip.title = `${front.label} · ${action.title}`;
        chip.dataset.status = action.status;
        chip.style.setProperty('--front-color', front.color);
        chip.addEventListener('click', () => openAction(action));
        cell.append(chip);
      }
      grid.append(cell);
    }
  }

  function render() {
    renderFilter();
    for (const button of panel.querySelectorAll('[data-plan-view]')) button.setAttribute('aria-pressed', String(button.dataset.planView === state.view));
    phaseList.hidden = state.view !== 'lista';
    calendar.hidden = state.view !== 'calendario';
    if (state.view === 'calendario') renderCalendar();

    phaseList.replaceChildren();
    if (!state.phases.length) phaseList.append(node('li', 'Todavía no hay tramos. Agrega el primero.', 'admin-panel-empty'));
    const { groups, outside } = groupActions(state.phases, visible());
    for (const { phase, actions } of groups) {
      const item = node('li', undefined, 'campaign-map__item');
      item.style.setProperty('--phase-accent', phase.accent || '#94165e');
      item.dataset.state = phaseState(phase, state.today);
      const block = node('details', undefined, 'campaign-map__block');
      if (firstRender && item.dataset.state === 'actual') opened.add(phase.public_id);
      block.open = opened.has(phase.public_id);
      block.addEventListener('toggle', () => { block.open ? opened.add(phase.public_id) : opened.delete(phase.public_id); });
      const summary = node('summary');
      const body = node('div');
      body.append(node('strong', rangeLabel(phase.starts_on, phase.ends_on), 'campaign-map__range'), node('p', phaseLabel(phase)));
      const counts = node('div', undefined, 'campaign-map__counts');
      counts.append(node('span', actions.length === 1 ? '1 acción' : `${actions.length} acciones`));
      for (const front of FRONTS) { const n = actions.filter(action => action.front === front.key).length; if (n) { const dot = node('i', String(n)); dot.title = `${front.label}: ${n}`; dot.style.setProperty('--front-color', front.color); counts.append(dot); } }
      const edit = node('button', 'Editar tramo', 'button-quiet');
      edit.type = 'button';
      edit.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openPhase(phase); });
      summary.append(body, counts, edit);
      const list = node('div', undefined, 'campaign-map__actions');
      for (const action of actions) list.append(actionRow(action));
      if (!actions.length) list.append(node('p', 'Todavía no hay acciones en este tramo.', 'admin-panel-empty'));
      const add = node('button', '+ Agregar acción a este tramo', 'button-quiet campaign-map__add');
      add.type = 'button';
      add.addEventListener('click', () => openAction(null, state.today >= phase.starts_on && state.today <= phase.ends_on ? state.today : phase.starts_on));
      list.append(add);
      block.append(summary, list);
      item.append(block);
      phaseList.append(item);
    }
    if (outside.length) {
      const item = node('li', undefined, 'campaign-map__item');
      const block = node('details', undefined, 'campaign-map__block');
      block.open = true;
      const summary = node('summary'); summary.append(node('div'));
      summary.firstChild.append(node('strong', 'Fuera del mapa', 'campaign-map__range'), node('p', 'Acciones cuyas fechas no caen en ningún tramo.'));
      const list = node('div', undefined, 'campaign-map__actions');
      for (const action of outside) list.append(actionRow(action));
      block.append(summary, list); item.append(block); phaseList.append(item);
    }
    firstRender = false;
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
    state.actions = Array.isArray(data.actions) ? data.actions : [];
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

  function openAction(action, day = '') {
    editingAction = action?.public_id ?? '';
    if (actionTitle) actionTitle.textContent = action ? 'Editar acción' : 'Agregar acción';
    if (actionFeedback) { actionFeedback.textContent = ''; actionFeedback.dataset.error = 'false'; }
    if (actionRemove) actionRemove.hidden = !action;
    const starts = action?.starts_on || day || state.today;
    const phase = state.phases.find(item => item.starts_on <= starts && starts <= item.ends_on);
    if (actionPhase) actionPhase.textContent = phase ? `Tramo ${rangeLabel(phase.starts_on, phase.ends_on)} · ${phaseLabel(phase)}` : 'Qué debe salir, cuándo, por qué canal y quién lo hace.';
    const elements = actionForm.elements;
    elements.title.value = action?.title ?? '';
    elements.front.value = action?.front ?? 'emocional';
    elements.status.value = action?.status ?? 'propuesta';
    elements.starts_on.value = starts || '';
    elements.ends_on.value = action?.ends_on ?? starts ?? '';
    elements.channel.value = action?.channel ?? '';
    elements.owner.value = action?.owner ?? '';
    elements.detail.value = action?.detail ?? '';
    actionDialog.showModal();
  }

  query('[data-action-new]')?.addEventListener('click', () => openAction(null, state.today));
  for (const button of panel.querySelectorAll('[data-plan-view]')) button.addEventListener('click', () => { state.view = button.dataset.planView; render(); });
  query('[data-month-prev]')?.addEventListener('click', () => { const m = state.month; state.month = m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }; render(); });
  query('[data-month-next]')?.addEventListener('click', () => { const m = state.month; state.month = m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }; render(); });
  if (location.hash === '#calendario') state.view = 'calendario';
  actionForm?.addEventListener('submit', async event => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    let payload;
    try { payload = actionPayload(new FormData(actionForm)); }
    catch (error) { if (actionFeedback) { actionFeedback.textContent = error.message; actionFeedback.dataset.error = 'true'; } return; }
    try {
      apply(editingAction ? await client.updateAction(editingAction, payload) : await client.createAction(payload));
      actionDialog.close();
      feedback(editingAction ? 'Acción actualizada.' : 'Acción agregada.', 'success');
    } catch (error) { if (actionFeedback) { actionFeedback.textContent = error.message; actionFeedback.dataset.error = 'true'; } if (error.status === 401) fail(error); }
  });
  actionRemove?.addEventListener('click', async () => {
    if (!editingAction || !confirm('¿Quitar esta acción del calendario? Queda archivada, no se borra.')) return;
    const id = editingAction;
    actionDialog.close();
    await save(() => client.archiveAction(id));
  });

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
