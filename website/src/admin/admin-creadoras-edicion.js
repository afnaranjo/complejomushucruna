import { resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
// Mismo cliente que el calendario de Creadoras: sesión, CSRF y rutas permitidas compartidos.
import { createCreadoraAdminClient, creadoraColor, dayLabel, shiftLabel } from './admin-creadoras.js?v=20260926-creadoras-12';

const LOCAL_API = 'http://127.0.0.1:4174/api';

/* ---------- Funciones puras (probadas) ---------- */

/** El editor filtra por estado, creadora, si tuvo guion y por texto libre. */
export function filterEditing(items = [], { state = 'pending', creadora = '', script = '', search = '' } = {}) {
  const words = String(search).trim().toLocaleLowerCase('es');
  return items.filter(item => {
    if (state === 'pending' && item.edited) return false;
    if (state === 'edited' && !item.edited) return false;
    if (creadora && item.creadora !== creadora) return false;
    if (script === 'with' && !item.has_script) return false;
    if (script === 'new' && item.has_script) return false;
    if (!words) return true;
    return [item.title, item.creadora_name, item.script?.title, item.script?.body, item.kind_label]
      .some(value => String(value ?? '').toLocaleLowerCase('es').includes(words));
  });
}

/** Las marcas de tiempo del servidor están en UTC; aquí se leen en hora de Ecuador. */
export function ecuadorStamp(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value ?? ''));
  if (!match) return '';
  const [, year, month, day, hour, minute] = match.map(Number);
  const local = new Date(Date.UTC(year, month - 1, day, hour, minute) - 5 * 3600000);
  const pad = number => String(number).padStart(2, '0');
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)}/${local.getUTCFullYear()} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

/** Cuándo se grabó: el día y el horario del turno. */
export function itemWhen(item = {}) {
  const day = String(item.starts_at ?? '').slice(0, 10);
  if (!day) return '';
  return `${dayLabel(day, true)} · ${shiftLabel(item)}`;
}

/** El resumen de arriba: lo que falta, lo hecho y cuántos tuvieron guion. */
export const EDIT_TOTALS = Object.freeze([
  ['pending', 'Por editar', { state: 'pending', script: '' }],
  ['edited', 'Ya editados', { state: 'edited', script: '' }],
  ['with_script', 'Con guion', { state: '', script: 'with' }],
  ['new', 'Creados nuevos (sin guion)', { state: '', script: 'new' }],
  ['total', 'Videos grabados', { state: '', script: '' }],
]);

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function link(href, text) {
  const anchor = node('a', text);
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

export async function initializeCreadorasEdicion() {
  const panel = document.querySelector('[data-admin-creadoras-edicion]');
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
  const client = createCreadoraAdminClient(base);
  const logout = document.querySelector('[data-admin-logout]');
  const sidebarUser = document.querySelector('[data-admin-sidebar-user]');
  const feedback = (message, kind = '') => { status.textContent = message; status.dataset.error = String(kind === 'error'); status.dataset.success = String(kind === 'success'); };
  const fail = error => { if (error.status === 401) { location.replace('/admin/'); return; } feedback(error.message, 'error'); };

  const state = { items: [], totals: {}, creadoras: [] };
  const form = query('[data-edit-filters]');
  const list = query('[data-edit-list]');
  const count = query('[data-edit-count]');
  const totalsBox = query('[data-edit-totals]');
  const creadoraSelect = query('[data-edit-creadora]');
  const filters = () => Object.fromEntries(new FormData(form));

  function renderTotals() {
    totalsBox.replaceChildren();
    const current = filters();
    for (const [key, text, preset] of EDIT_TOTALS) {
      const button = node('button', undefined, 'admin-big-number');
      button.type = 'button';
      button.dataset.bucket = key;
      button.dataset.alert = String(key === 'pending' && Number(state.totals[key] ?? 0) > 0);
      button.setAttribute('aria-pressed', String(current.state === preset.state && current.script === preset.script));
      button.append(node('strong', String(state.totals[key] ?? 0)), node('span', text));
      button.addEventListener('click', () => {
        form.elements.state.value = preset.state;
        form.elements.script.value = preset.script;
        render();
      });
      totalsBox.append(button);
    }
  }

  function renderCreadoras() {
    const chosen = creadoraSelect.value;
    creadoraSelect.replaceChildren(Object.assign(node('option', 'Todas'), { value: '' }));
    for (const person of state.creadoras) creadoraSelect.append(Object.assign(node('option', person.full_name), { value: person.public_id }));
    creadoraSelect.value = chosen;
    if (creadoraSelect.value !== chosen) creadoraSelect.value = '';
  }

  async function update(item, body, success) {
    try {
      const data = await client.updateEditing(item.type, item.public_id, body);
      apply(data);
      feedback(success, 'success');
    } catch (error) { fail(error); render(); }
  }

  function card(item) {
    const entry = node('li', undefined, 'ed-item');
    entry.dataset.edited = String(Boolean(item.edited));
    const color = creadoraColor(item.creadora || item.shift);
    entry.style.setProperty('--shift-edge', color.edge);
    entry.style.setProperty('--shift-soft', color.soft);

    const head = node('div', undefined, 'ed-item__head');
    const who = node('div');
    who.append(node('strong', item.creadora_name || 'Sin creadora'), node('span', `${itemWhen(item)}${item.place ? ` · ${item.place}` : ''}`));
    const badges = node('div', undefined, 'ed-badges');
    badges.append(node('span', item.kind_label, 'ed-badge'));
    badges.append(node('span', item.has_script ? 'Con guion' : 'Creado nuevo · sin guion', item.has_script ? 'ed-badge ed-badge--script' : 'ed-badge ed-badge--new'));
    badges.append(node('span', item.edited ? '✓ Editado' : 'Por editar', item.edited ? 'ed-badge ed-badge--done' : 'ed-badge ed-badge--pending'));
    head.append(who, badges);
    entry.append(head);

    entry.append(node('h2', item.title, 'ed-item__title'));
    const links = node('p', undefined, 'ed-links');
    if (item.url) links.append(link(item.url, 'Ver lo grabado'));
    else links.append(node('span', item.type === 'script' ? 'Marcado como grabado en el cuaderno del turno. Todavía no tiene enlace.' : 'Sin enlace del material grabado.'));
    if (item.note) links.append(node('span', item.note));
    entry.append(links);

    if (item.has_script && item.script) {
      // El guion que el editor necesita para armar el video, con sus saltos de línea.
      const script = node('details', undefined, 'ed-script');
      script.open = !item.edited;
      script.append(node('summary', `Guion: ${item.script.title}`));
      script.append(node('p', item.script.body || 'El guion no tiene texto, solo el nombre de la idea.', 'ed-script__body'));
      if (item.script.reference_url) script.append(link(item.script.reference_url, 'Ver la referencia'));
      entry.append(script);
    } else {
      entry.append(node('p', 'No tuvo guion: se creó en el momento. Edítalo a partir de lo grabado.', 'ed-new'));
    }

    if (item.type === 'content' && item.script_options?.length) {
      // Si se registró sin guion por error, aquí se corrige de cuál salió.
      const label = node('label', '¿Salió de un guion del turno?', 'ed-link-script');
      const select = document.createElement('select');
      select.append(Object.assign(node('option', 'No · creado nuevo'), { value: '' }));
      for (const option of item.script_options) select.append(Object.assign(node('option', option.title), { value: option.public_id }));
      select.value = item.script?.public_id ?? '';
      select.addEventListener('change', () => update(item, { script: select.value }, select.value ? 'Video ligado a su guion.' : 'Video marcado como creado nuevo.'));
      label.append(select);
      entry.append(label);
    }

    const editor = node('div', undefined, 'ed-editor');
    const done = node('button', item.edited ? 'Devolver a «por editar»' : '✓ Marcar como editado', item.edited ? 'button-quiet' : 'button-primary');
    done.type = 'button';
    done.addEventListener('click', () => update(item, { edited: !item.edited }, item.edited ? 'Devuelto a por editar.' : `«${item.title}» quedó como editado.`));
    const meta = node('p', item.edited ? `Editado el ${ecuadorStamp(item.edited_at)}${item.edited_by ? ` por ${item.edited_by}` : ''}.` : 'Todavía no se edita.', 'ed-editor__meta');
    const fields = node('div', undefined, 'ed-editor__fields');
    const urlLabel = node('label', 'Enlace del video editado');
    const url = Object.assign(document.createElement('input'), { type: 'url', maxLength: 500, placeholder: 'https:// (opcional)', value: item.edited_url ?? '' });
    urlLabel.append(url);
    const noteLabel = node('label', 'Nota de edición');
    const note = Object.assign(document.createElement('textarea'), { rows: 2, maxLength: 1000, placeholder: 'Ej.: con subtítulos, versión vertical', value: item.edit_note ?? '' });
    noteLabel.append(note);
    const saveNote = node('button', 'Guardar enlace y nota', 'button-quiet');
    saveNote.type = 'button';
    saveNote.addEventListener('click', () => {
      const value = url.value.trim();
      if (value && !/^https:\/\/\S+$/.test(value)) { feedback('El enlace del video editado debe empezar con https://', 'error'); url.focus(); return; }
      update(item, { edited_url: value, edit_note: note.value.trim() }, 'Enlace y nota guardados.');
    });
    fields.append(urlLabel, noteLabel, saveNote);
    const actions = node('div', undefined, 'ed-editor__actions');
    actions.append(done, meta);
    if (item.edited_url) actions.append(link(item.edited_url, 'Ver el video editado'));
    editor.append(actions, fields);
    entry.append(editor);
    return entry;
  }

  function render() {
    renderTotals();
    const shown = filterEditing(state.items, filters());
    list.replaceChildren();
    count.textContent = `${shown.length} de ${state.items.length} ${state.items.length === 1 ? 'video' : 'videos'}`;
    if (!shown.length) {
      const empty = state.items.length
        ? 'No hay videos con estos filtros.'
        : 'Todavía no hay videos grabados. Aparecen aquí cuando en un turno se registra contenido o se marca un guion como «Ya está grabado».';
      list.append(node('li', empty, 'admin-panel-empty'));
      return;
    }
    for (const item of shown) list.append(card(item));
  }

  function apply(data) {
    state.items = data.items ?? [];
    state.totals = data.totals ?? {};
    state.creadoras = data.creadoras ?? [];
    renderCreadoras();
    render();
  }

  async function load() {
    feedback('Cargando videos…');
    apply(await client.editing());
    feedback('');
  }

  form.addEventListener('input', render);
  form.addEventListener('change', render);
  form.addEventListener('submit', event => event.preventDefault());
  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await client.logout(); location.replace('/admin/'); } catch (error) { logout.disabled = false; fail(error); }
  });

  async function start() {
    retry.hidden = true;
    try {
      const session = await client.session();
      if (!session.authenticated) { location.replace('/admin/'); return; }
      query('[data-admin-user]').textContent = `Sesión de ${session.user.username}`;
      if (sidebarUser) sidebarUser.textContent = session.user.username;
      if (logout) logout.disabled = false;
      await load();
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', start);
  await start();
}

if (typeof document !== 'undefined') initializeCreadorasEdicion();
