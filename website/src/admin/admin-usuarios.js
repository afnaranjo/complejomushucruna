import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
import './sidebar.js?v=20260926-admin-sidebar-3';
import './campaign-banner.js?v=20260925-banner-2';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';

export class UsuariosAdminError extends Error {
  constructor(status, message = '') {
    super(message || ({
      0: 'No se pudo conectar. Revisa tu conexión.',
      401: 'Tu sesión terminó. Vuelve a iniciar sesión.',
      403: 'Tu rol no tiene acceso a Usuarios.',
      404: 'No se encontró ese usuario o rol.',
      409: 'Ya existe un usuario o un rol con ese nombre.',
      422: 'Revisa los datos. Si cambiaste un rol, recuerda que debe quedar alguien que administre usuarios.',
    })[status] || 'No se pudo completar la acción.');
    this.status = status;
  }
}

export function createUsuariosClient(baseUrl = API, fetchImplementation = fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  let csrf = '';
  async function request(path, options = {}) {
    if (!/^\/(?:auth\/(?:session|logout)|admin-users|admin-roles|admin-activity(?:\?user=[a-f0-9]{32})?)$/.test(path)
      && !/^\/admin-users\/[a-f0-9]{32}(?:\/enlace)?$/.test(path)
      && !/^\/admin-roles\/[a-f0-9]{32}$/.test(path)) throw new Error('Ruta de API no permitida.');
    const method = (options.method ?? 'GET').toUpperCase();
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') {
      if (!csrf) throw new UsuariosAdminError(403);
      headers['X-CSRF-Token'] = csrf;
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch { throw new UsuariosAdminError(0); }
    if (!response.ok) throw new UsuariosAdminError(response.status);
    let data;
    try { data = await response.json(); } catch { throw new UsuariosAdminError(502); }
    if (typeof data.csrf === 'string') csrf = data.csrf;
    return data;
  }
  return {
    request,
    session: () => request('/auth/session'),
    logout: () => request('/auth/logout', { method: 'POST' }),
    load: () => request('/admin-users'),
    createUser: body => request('/admin-users', { method: 'POST', body }),
    updateUser: (id, body) => request(`/admin-users/${id}`, { method: 'PATCH', body }),
    newLink: id => request(`/admin-users/${id}/enlace`, { method: 'POST', body: {} }),
    createRole: body => request('/admin-roles', { method: 'POST', body }),
    updateRole: (id, body) => request(`/admin-roles/${id}`, { method: 'PATCH', body }),
    activity: (user = '') => request(user ? `/admin-activity?user=${user}` : '/admin-activity'),
  };
}

/* ---------- Funciones puras (probadas) ---------- */

/** El enlace que se le envía a la persona: siempre del mismo sitio donde se generó. */
export function setupUrl(origin, token) {
  return `${origin}/admin/activar/?token=${encodeURIComponent(token)}`;
}

/** Las marcas de tiempo del servidor están en UTC; aquí se leen en hora de Ecuador. */
export function ecuadorTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value ?? ''));
  if (!match) return '';
  const [, year, month, day, hour, minute] = match.map(Number);
  const local = new Date(Date.UTC(year, month - 1, day, hour, minute) - 5 * 3600000);
  const pad = number => String(number).padStart(2, '0');
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

const AREAS = Object.freeze({
  admin: 'Panel', admin_user: 'Usuarios', admin_role: 'Usuarios', campaign: 'Noticias', vocero: 'Voceros', vocero_account: 'Voceros',
  media: 'Medios', media_account: 'Medios', media_event: 'Medios', creadora: 'Creadoras', creadora_account: 'Creadoras',
  emprendedor: 'Emprendedores', emprendedor_account: 'Emprendedores', mfs: 'Mushuc Freestyle', mfs_account: 'Mushuc Freestyle', production: 'Producción',
});
const ACTIONS = Object.freeze({
  login: 'entró al panel', created: 'creó un registro', created_by_admin: 'creó un registro', updated: 'editó un registro', updated_by_admin: 'editó un registro',
  viewed: 'abrió un registro', exported: 'exportó la lista', status_changed: 'cambió un estado', note_added: 'agregó una nota', archived: 'retiró un registro',
  retired: 'retiró un registro', deleted: 'retiró un registro', restored: 'restauró un registro', photo_viewed: 'vio una fotografía', progress_updated: 'actualizó el progreso',
  video_schedule_updated: 'cambió las fechas de videos', password_reset_created: 'generó un enlace de acceso', role_changed: 'cambió el rol de una persona',
  setup_link_created: 'generó un enlace de contraseña', password_set: 'eligió su contraseña', activated: 'activó una cuenta', deactivated: 'desactivó una cuenta',
  phase_created: 'agregó un tramo', phase_updated: 'editó un tramo', phase_deleted: 'quitó un tramo', notice_created: 'publicó un aviso', notice_deleted: 'quitó un aviso',
  shift_created: 'agregó un turno', shift_updated: 'cambió un turno', shift_canceled: 'quitó un turno', attendance_marked: 'marcó una asistencia',
  content_added: 'registró contenido', content_removed: 'quitó contenido', script_added: 'agregó un guion', script_updated: 'editó un guion', script_removed: 'quitó un guion',
  editing_updated: 'marcó la edición de un video', entry_created: 'agregó un bloque', entry_updated: 'cambió un bloque', entry_canceled: 'quitó un bloque',
  item_created: 'agregó una pieza', item_updated: 'editó una pieza', item_archived: 'archivó una pieza', plan_saved: 'guardó el calendario de medios',
  plan_audio_uploaded: 'subió un audio', coverage_updated: 'actualizó la cobertura de un evento', paid_media_changed: 'cambió la pauta de un medio',
  traffic_light_changed: 'cambió un semáforo', tour_visit_created: 'agendó una cita de gira', tour_visit_updated: 'cambió una cita de gira', tour_visit_canceled: 'quitó una cita de gira',
  tour_person_created: 'agregó una persona a la gira', tour_person_updated: 'editó una persona de la gira', tour_person_retired: 'retiró a una persona de la gira',
  video_added_by_admin: 'agregó un video', video_removed_by_admin: 'quitó un video', video_views_updated: 'registró visualizaciones', invitation_created: 'generó una invitación',
  claim_approved: 'aprobó una vinculación', claim_rejected: 'rechazó una vinculación', audition_corrected: 'corrigió una audición',
});

/** Una línea legible de la auditoría: sección y qué hizo. */
export function describeActivity(event) {
  const [area, action = ''] = String(event ?? '').split('.');
  const place = AREAS[area] ?? 'Panel';
  const what = ACTIONS[action] ?? `hizo un cambio (${event})`;
  return `${what} · ${place}`;
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

export async function initializeUsuarios() {
  const panel = document.querySelector('[data-admin-usuarios]');
  if (!panel) return;
  const navigation = document.querySelector('[data-admin-navigation]');
  const compact = globalThis.matchMedia?.('(max-width: 1120px)');
  const applyNavigation = value => { if (navigation) navigation.open = !value; };
  applyNavigation(compact?.matches ?? false);
  compact?.addEventListener('change', event => applyNavigation(event.matches));
  const query = selector => panel.querySelector(selector);
  const status = query('[data-admin-feedback]');
  const retry = query('[data-session-retry]');
  const configuredBase = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredBase || runtime.apiBase;
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) { status.textContent = 'La configuración de acceso no es válida.'; status.dataset.error = 'true'; return; }
  if (!isAllowedSiteOrigin(location.origin) && location.hostname !== (LOCAL_API ? new URL(LOCAL_API).hostname : '')) { status.textContent = 'Origen no permitido.'; status.dataset.error = 'true'; return; }
  const client = createUsuariosClient(base);
  const logout = document.querySelector('[data-admin-logout]');
  const feedback = (message, kind = '') => { status.textContent = message; status.dataset.error = String(kind === 'error'); status.dataset.success = String(kind === 'success'); };
  const fail = error => { if (error.status === 401) { location.replace('/admin/'); return; } feedback(error.message, 'error'); };

  const state = { users: [], roles: [], modules: [], me: '' };
  const rows = query('[data-user-rows]');
  const roleList = query('[data-role-list]');
  const activityList = query('[data-activity-list]');
  const activityUser = query('[data-activity-user]');
  const linkBox = query('[data-link-box]');

  function showLink(user, link) {
    linkBox.hidden = false;
    query('[data-link-name]').textContent = user.full_name;
    const input = query('[data-link-url]');
    input.value = setupUrl(location.origin, link.token);
    linkBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input.select();
  }
  query('[data-link-copy]').addEventListener('click', async () => {
    const input = query('[data-link-url]');
    try { await navigator.clipboard.writeText(input.value); feedback('Enlace copiado.', 'success'); }
    catch { input.select(); feedback('Selecciona el enlace y cópialo con Cmd + C.'); }
  });
  query('[data-link-close]').addEventListener('click', () => { linkBox.hidden = true; query('[data-link-url]').value = ''; });

  const roleOptions = (select, value) => {
    select.replaceChildren();
    for (const role of state.roles) select.append(Object.assign(node('option', role.name), { value: role.public_id }));
    select.value = value;
  };

  function renderUsers() {
    rows.replaceChildren();
    query('[data-user-count]').textContent = `${state.users.filter(user => user.active).length} activas de ${state.users.length}`;
    for (const user of state.users) {
      const row = node('tr');
      row.dataset.active = String(user.active);
      const who = node('td');
      who.append(node('strong', user.full_name), node('small', `@${user.username}${user.public_id === state.me ? ' · tú' : ''}`));
      const roleCell = node('td');
      const select = document.createElement('select');
      select.setAttribute('aria-label', `Rol de ${user.full_name}`);
      roleOptions(select, user.role);
      select.disabled = user.owner;
      if (user.owner) select.title = 'La cuenta admin siempre es de Administración.';
      select.addEventListener('change', async () => {
        try { await client.updateUser(user.public_id, { role: select.value }); feedback(`${user.full_name} ahora tiene el rol ${select.selectedOptions[0]?.textContent}.`, 'success'); await refresh(); }
        catch (error) { fail(error); await refresh(); }
      });
      roleCell.append(select);
      const stateCell = node('td');
      stateCell.append(node('span', user.active ? (user.has_password ? 'Activa' : 'Activa · falta que elija su contraseña') : 'Desactivada', `us-state us-state--${user.active ? (user.has_password ? 'on' : 'pending') : 'off'}`));
      const last = node('td', user.last_login_at ? ecuadorTime(user.last_login_at) : 'Nunca');
      const actions = node('td', undefined, 'us-actions');
      if (user.active) {
        const link = node('button', user.has_password ? 'Enlace para cambiar contraseña' : 'Enlace para elegir contraseña', 'button-quiet');
        link.type = 'button';
        link.addEventListener('click', async () => {
          try { const data = await client.newLink(user.public_id); showLink(user, data.link); await refresh(false); }
          catch (error) { fail(error); }
        });
        actions.append(link);
      }
      const history = node('button', 'Ver su actividad', 'button-quiet');
      history.type = 'button';
      history.addEventListener('click', () => { activityUser.value = user.public_id; loadActivity(); query('#us-activity-title').scrollIntoView({ behavior: 'smooth' }); });
      actions.append(history);
      if (!user.owner && user.public_id !== state.me) {
        const toggle = node('button', user.active ? 'Desactivar' : 'Activar', user.active ? 'button-danger' : 'button-quiet');
        toggle.type = 'button';
        toggle.addEventListener('click', async () => {
          if (user.active && !confirm(`¿Desactivar a ${user.full_name}? Deja de poder entrar de inmediato; lo que hizo se conserva.`)) return;
          try { await client.updateUser(user.public_id, { active: !user.active }); feedback(user.active ? `${user.full_name} ya no puede entrar.` : `${user.full_name} puede entrar otra vez.`, 'success'); await refresh(); }
          catch (error) { fail(error); }
        });
        actions.append(toggle);
      }
      row.append(who, roleCell, stateCell, last, actions);
      rows.append(row);
    }
    const chosen = activityUser.value;
    activityUser.replaceChildren(Object.assign(node('option', 'Todas'), { value: '' }));
    for (const user of state.users) activityUser.append(Object.assign(node('option', user.full_name), { value: user.public_id }));
    activityUser.value = chosen;
  }

  /** Una tarjeta por rol con sus casillas; el rol del sistema ve todo y no se puede recortar. */
  function roleCard(role) {
    const card = node('form', undefined, 'us-role');
    if (role?.system) card.dataset.system = 'true';
    const head = node('div', undefined, 'us-role__head');
    const name = Object.assign(document.createElement('input'), { name: 'name', maxLength: 80, required: true, value: role?.name ?? '', placeholder: 'Nombre del rol' });
    name.setAttribute('aria-label', 'Nombre del rol');
    name.disabled = Boolean(role?.system);
    head.append(name, node('small', role ? `${role.users} ${role.users === 1 ? 'persona' : 'personas'}` : 'Rol nuevo'));
    const description = Object.assign(document.createElement('input'), { name: 'description', maxLength: 240, value: role?.description ?? '', placeholder: 'Para qué sirve (opcional)' });
    description.setAttribute('aria-label', 'Descripción del rol');
    const list = node('fieldset', undefined, 'us-modules');
    list.append(node('legend', role?.system ? 'Ve todo, también los módulos que se creen después' : 'Módulos que ve'));
    for (const module of state.modules) {
      const option = node('label', undefined, 'us-module');
      const box = Object.assign(document.createElement('input'), { type: 'checkbox', name: 'modules', value: module.key });
      box.checked = Boolean(role?.all || role?.modules.includes(module.key));
      box.disabled = Boolean(role?.system);
      const text = node('span');
      text.append(node('strong', module.label), node('small', module.description));
      option.append(box, text);
      list.append(option);
    }
    const save = node('button', role ? 'Guardar rol' : 'Crear rol', 'button-primary');
    save.type = 'submit';
    card.append(head, description, list, save);
    card.addEventListener('submit', async event => {
      event.preventDefault();
      const body = {
        name: name.value.trim(),
        description: description.value.trim(),
        modules: [...card.querySelectorAll('input[name="modules"]:checked')].map(box => box.value),
      };
      if (!body.name) { feedback('Ponle un nombre al rol.', 'error'); name.focus(); return; }
      try {
        if (role) await client.updateRole(role.public_id, body);
        else await client.createRole(body);
        feedback(role ? `Rol «${body.name}» guardado. Rige de inmediato para sus personas.` : `Rol «${body.name}» creado.`, 'success');
        await refresh();
      } catch (error) { fail(error); }
    });
    return card;
  }

  function renderRoles() {
    roleList.replaceChildren(...state.roles.map(roleCard));
  }

  async function loadActivity() {
    activityList.replaceChildren(node('li', 'Cargando actividad…', 'admin-panel-empty'));
    try {
      const data = await client.activity(activityUser.value);
      activityList.replaceChildren();
      if (!data.activity.length) { activityList.append(node('li', 'Todavía no hay actividad registrada.', 'admin-panel-empty')); return; }
      for (const entry of data.activity) {
        const item = node('li');
        item.append(node('time', ecuadorTime(entry.at)), node('strong', entry.full_name || entry.username || '—'), node('span', describeActivity(entry.event)));
        activityList.append(item);
      }
    } catch (error) { activityList.replaceChildren(node('li', error.message, 'admin-panel-empty')); }
  }
  activityUser.addEventListener('change', loadActivity);

  async function refresh(withActivity = true) {
    const data = await client.load();
    state.users = data.users ?? [];
    state.roles = data.roles ?? [];
    state.modules = data.modules ?? [];
    state.me = data.me ?? '';
    renderUsers();
    renderRoles();
    if (withActivity) await loadActivity();
  }

  const dialog = query('[data-user-dialog]');
  const form = dialog.querySelector('form');
  const dialogFeedback = dialog.querySelector('[data-user-feedback]');
  query('[data-user-new]').addEventListener('click', () => {
    form.reset();
    const nonSystem = state.roles.find(role => !role.system) ?? state.roles[0];
    roleOptions(form.elements.role, nonSystem?.public_id ?? '');
    dialogFeedback.textContent = '';
    dialog.showModal();
    form.elements.full_name.focus();
  });
  form.addEventListener('submit', async event => {
    if (event.submitter?.value === 'cancel') return;
    event.preventDefault();
    const body = { full_name: form.elements.full_name.value.trim(), username: form.elements.username.value.trim().toLowerCase(), role: form.elements.role.value };
    if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(body.username)) { dialogFeedback.textContent = 'El usuario debe tener de 3 a 40 letras o números, sin espacios (puede llevar punto, guion o guion bajo).'; dialogFeedback.dataset.error = 'true'; return; }
    try {
      const data = await client.createUser(body);
      dialog.close();
      await refresh();
      showLink(data.user, data.link);
      feedback(`Cuenta de ${data.user.full_name} creada. Envíale el enlace para que elija su contraseña.`, 'success');
    } catch (error) {
      dialogFeedback.textContent = error.status === 409 ? 'Ese usuario ya existe. Elige otro.' : error.message;
      dialogFeedback.dataset.error = 'true';
      if (error.status === 401) fail(error);
    }
  });
  query('[data-role-new]').addEventListener('click', () => {
    const existing = roleList.querySelector('[data-new-role]');
    if (existing) { existing.querySelector('input').focus(); return; }
    const card = roleCard(null);
    card.dataset.newRole = 'true';
    roleList.append(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.querySelector('input').focus();
  });
  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await client.logout(); location.replace('/admin/'); } catch (error) { logout.disabled = false; fail(error); }
  });

  async function start() {
    retry.hidden = true;
    try {
      const session = await client.session();
      if (!session.authenticated) { location.replace('/admin/'); return; }
      query('[data-admin-user]').textContent = `Sesión de ${session.user.full_name ?? session.user.username}`;
      if (logout) logout.disabled = false;
      await refresh();
      query('[data-user-new]').disabled = false;
      query('[data-role-new]').disabled = false;
      feedback('');
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', start);
  await start();
}

if (typeof document !== 'undefined') initializeUsuarios();
