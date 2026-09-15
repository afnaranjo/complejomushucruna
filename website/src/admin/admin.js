export const STATUSES = Object.freeze(['Nuevo', 'En revisión', 'Aprobado', 'Rechazado', 'Pendiente de autorización']);
export const PREVIOUS_PARTICIPATION = Object.freeze(['No, es mi primera vez', 'Sí, en Finados 2025', 'Sí, en Carnaval 2026', 'Sí, en otra edición']);
const API = 'https://finados.complejomushucruna.com/api';
const LOCAL_API = 'http://127.0.0.1:4174/api';
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
  if (![API, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  let csrf = '';
  async function request(path, options = {}) {
    if (!/^\/(?:auth\/(?:session|login|logout)|dashboard|voceros(?:\/[a-zA-Z0-9-]+(?:\/notes)?)?)(?:\?[^#]*)?$/.test(path)) throw new Error('Ruta de API no permitida.');
    const method = (options.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST', 'PATCH'].includes(method)) throw new Error('Método no permitido.');
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') {
      if (!csrf) throw new AdminError(403);
      headers['X-CSRF-Token'] = csrf;
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method, credentials: 'include', cache: 'no-store', redirect: 'error', headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch { throw new AdminError(0); }
    if (!response.ok) throw new AdminError(response.status);
    if (options.blob) return response.blob();
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
    export: filters => {
      const { page, pageSize, ...body } = normalizeFilters(filters);
      return request('/voceros/export', { method: 'POST', body, blob: true });
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
function dateTime(value) {
  if (!value) return '—';
  const parsed = new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z');
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(parsed);
}

export async function initializeAdmin() {
  const login = document.querySelector('[data-admin-login]');
  const panel = document.querySelector('[data-admin-voceros]');
  if (!login && !panel) return;
  const status = document.querySelector('[data-admin-feedback]');
  const retry = document.querySelector('[data-session-retry]');
  const base = document.querySelector('meta[name="admin-api-base"]')?.content;
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) {
    feedback(status, 'La configuración de acceso no es válida.', 'error'); return;
  }
  const client = createAdminClient(base);
  const redirect = path => location.replace(path);
  const fail = (error, target = status) => {
    if (error.status === 401 && panel) { redirect('/admin/'); return; }
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
  const logout = document.querySelector('[data-admin-logout]');
  const dialog = query('[data-detail]');
  const detailFeedback = query('[data-detail-feedback]');
  const statusForm = query('[data-status-form]');
  const noteForm = query('[data-note-form]');
  let filters = normalizeFilters();
  let pagination = { page: 1, pages: 0 };
  let listGeneration = 0;
  let detailGeneration = 0;
  let currentId = null;
  let opener = null;

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
    query('[data-notes]').replaceChildren();
    for (const note of data.notes ?? []) {
      const li = node('li'); li.append(node('p', note.body), node('small', `${dateTime(note.created_at)} · Usuario ${note.author_id}`)); query('[data-notes]').append(li);
    }
    if (!data.notes?.length) query('[data-notes]').append(node('li', 'Todavía no hay notas.'));
  }
  async function loadDetail(id, generation) {
    const data = await client.request('/voceros/' + encodeURIComponent(id));
    if (generation !== detailGeneration || currentId !== id || !dialog.open) return false;
    renderDetail(data); return true;
  }
  async function openDetail(id, trigger) {
    currentId = id; opener = trigger;
    const generation = ++detailGeneration;
    query('[data-detail-content]').replaceChildren(); query('[data-notes]').replaceChildren(); noteForm.reset();
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
  dialog.addEventListener('close', () => {
    currentId = null; detailGeneration++;
    query('[data-detail-content]').replaceChildren(); query('[data-notes]').replaceChildren(); noteForm.reset();
    (opener?.isConnected ? opener : query('#records-title')).focus();
  });
  async function mutate(event, kind) {
    event.preventDefault();
    const id = currentId; const generation = detailGeneration;
    if (!id) return;
    const body = kind === 'status' ? { status: statusForm.elements.status.value } : { body: noteForm.elements.body.value.trim() };
    if (kind === 'note' && !body.body) { feedback(detailFeedback, 'Escribe una nota antes de guardar.', 'error'); return; }
    statusForm.querySelector('fieldset').disabled = noteForm.querySelector('fieldset').disabled = true;
    feedback(detailFeedback, 'Guardando…');
    let saved = false;
    try {
      await client.request('/voceros/' + encodeURIComponent(id) + (kind === 'note' ? '/notes' : ''), { method: kind === 'note' ? 'POST' : 'PATCH', body });
      saved = true;
      if (generation !== detailGeneration) return;
      if (kind === 'note') noteForm.reset();
      await loadDetail(id, generation);
      if (generation !== detailGeneration) return;
      feedback(detailFeedback, kind === 'note' ? 'Nota guardada.' : 'Estado actualizado.', 'success');
      if (kind === 'status') { await list(); try { await summary(); } catch (error) { fail(error); } }
    } catch (error) {
      if (generation === detailGeneration) {
        if (saved && error.status !== 401) feedback(detailFeedback, 'El cambio se guardó, pero no se pudo actualizar el detalle. Cierra y vuelve a abrir el registro.', 'error');
        else fail(error, detailFeedback);
      }
    } finally {
      if (generation === detailGeneration) statusForm.querySelector('fieldset').disabled = noteForm.querySelector('fieldset').disabled = false;
    }
  }
  statusForm.addEventListener('submit', event => mutate(event, 'status'));
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
    logout.disabled = true;
    try { await client.logout(); redirect('/admin/'); } catch (error) { fail(error); logout.disabled = false; }
  });
  startPanel = async user => {
    query('[data-admin-user]').textContent = `Sesión: ${user?.username ?? 'equipo'} · Registros del formulario de Voceros`;
    form.querySelector('fieldset').disabled = false; exportButton.disabled = false; logout.disabled = false;
    const results = await Promise.allSettled([summary(), list()]);
    for (const result of results) if (result.status === 'rejected') { fail(result.reason); retry.hidden = false; }
  };
  await session();
}
if (typeof document !== 'undefined') initializeAdmin();
