import { resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
// Mismo cliente administrativo (sesión, CSRF y rutas permitidas) y las mismas piezas de calendario
// que Creadoras y Gira de medios, para que todos los calendarios se usen igual.
import { createMediaAdminClient } from './admin-medios.js?v=20260925-admin-medios-27';
import {
  dateFromKey, dayKey, dayLabel, defaultShift, durationLabel, hourRows, layoutDay, minutesFromOffset, minutesFromTime,
  minutesOf, monthStart, movedShift, rangeLabel, resizedShift, shiftGeometry, shiftLabel, shiftView, viewRange,
} from './admin-creadoras.js?v=20260925-creadoras-11';

const LOCAL_API = 'http://127.0.0.1:4174/api';
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const BOARDS = Object.freeze(['activaciones', 'sol', 'luna']);
export const PRODUCTION_STATUSES = Object.freeze({ planificado: 'Planificado', confirmado: 'Confirmado', realizado: 'Realizado', no_se_hizo: 'No se hizo' });
const STATUS_MARKS = Object.freeze({ planificado: '', confirmado: '✓ confirmado', realizado: '★ realizado', no_se_hizo: '✗ no se hizo' });

/* ---------- Funciones puras (probadas) ---------- */

/** El tinte, el filete y la tinta de una caja salen del color de la pieza. */
export function boxColors(hex) {
  const color = /^#[0-9a-f]{6}$/i.test(String(hex)) ? String(hex).toLowerCase() : '#94165e';
  return { edge: color, soft: `color-mix(in srgb, ${color} 12%, white)`, ink: `color-mix(in srgb, ${color} 72%, black)` };
}

export function entryMarks(entry = {}) {
  return [entry.owner ? `👤 ${entry.owner}` : '', entry.place ?? '', STATUS_MARKS[entry.status] ?? ''].filter(Boolean).join(' · ');
}

/** «1 h 30 min» para mostrar la duración de una pieza en la biblioteca. */
export function durationText(minutes) {
  return durationLabel(0, Number(minutes) || 0) || '—';
}

/** Soltar una pieza a una hora: el bloque dura lo que la pieza, sin pasar de la medianoche. */
export function slotFor(key, startMinutes, durationMinutes) {
  return defaultShift(key, startMinutes, Math.max(15, Number(durationMinutes) || 60) / 60);
}

export function entryPayload({ title, day, start, end, color, status, owner, place, note }) {
  if (!String(title ?? '').trim()) throw new Error('Escribe el título.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) throw new Error('Elige el día.');
  const from = minutesFromTime(start); const to = minutesFromTime(end);
  if (from === null || to === null) throw new Error('Escribe la hora de inicio y de fin.');
  if (to <= from) throw new Error('La hora de fin debe ser posterior a la de inicio. Revisa si elegiste a. m. en lugar de p. m.');
  if (to - from < 15) throw new Error('El bloque debe durar al menos 15 minutos.');
  return { title: String(title).trim(), starts_at: `${day} ${start}`, ends_at: `${day} ${end}`, color, status, owner: String(owner ?? '').trim(), place: String(place ?? '').trim(), note: String(note ?? '').trim() };
}

/* ---------- Interfaz ---------- */

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
function paint(element, hex) {
  const colors = boxColors(hex);
  element.style.setProperty('--shift-edge', colors.edge);
  element.style.setProperty('--shift-soft', colors.soft);
  element.style.setProperty('--shift-ink', colors.ink);
}

export async function initializeProduction() {
  const panel = document.querySelector('[data-admin-produccion]');
  if (!panel) return;
  const board = panel.dataset.board;
  if (!BOARDS.includes(board)) return;
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
  const client = createMediaAdminClient(base);
  const logout = document.querySelector('[data-admin-logout]');
  const sidebarUser = document.querySelector('[data-admin-sidebar-user]');
  const say = (element, message, kind = '') => { element.textContent = message; element.dataset.error = String(kind === 'error'); element.dataset.success = String(kind === 'success'); };
  const feedback = (message, kind = '') => say(status, message, kind);
  const message = error => error.status === 422 ? 'Revisa los datos: título, día y horas.' : error.status === 404 ? 'Ese elemento ya no está disponible. Recarga la página.' : error.message;
  const fail = error => { if (error.status === 401) { location.replace('/admin/'); return; } feedback(message(error), 'error'); };

  const state = { view: 'week', anchor: dayKey(new Date()), items: [], entries: [], totals: {} };
  const grid = query('[data-calendar-grid]');
  const monthGrid = query('[data-calendar-month]');
  const label = query('[data-calendar-label]');
  const library = query('[data-item-list]');
  const totals = query('[data-production-totals]');

  async function save(action, success = 'Guardado.') {
    try { await action(); await load(false); feedback(success, 'success'); return true; }
    catch (error) { fail(error); renderGrid(); return false; }
  }

  function renderTotals() {
    totals.replaceChildren();
    const data = state.totals ?? {};
    for (const [text, value] of [['Piezas en la biblioteca', data.items], ['Bloques agendados', data.entries], ['Confirmados', data.confirmed], ['Realizados', data.done]]) {
      const box = node('div', undefined, 'admin-big-number'); box.append(node('strong', value ?? 0), node('span', text)); totals.append(box);
    }
  }

  /* Biblioteca: tarjetas que se arrastran a una hora del calendario, como en Calendario de medios. */
  function renderLibrary() {
    library.replaceChildren();
    if (!state.items.length) { library.append(node('p', 'Todavía no hay piezas. Crea la primera con «+ Nueva pieza».', 'admin-panel-empty')); return; }
    for (const item of state.items) {
      const card = node('div', undefined, 'mc-audio production-piece');
      card.style.setProperty('--mc-color', item.color);
      card.draggable = true; card.tabIndex = 0; card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${item.name}, ${durationText(item.duration_minutes)}. Arrástrala al calendario o tócala para agendarla.`);
      card.append(node('strong', item.name));
      if (item.description) card.append(node('small', item.description));
      const meta = node('div', undefined, 'production-piece__meta');
      meta.append(node('span', durationText(item.duration_minutes), 'mc-pill'), node('span', item.uses === 1 ? 'Agendada 1 vez' : `Agendada ${item.uses} veces`, 'production-piece__uses'));
      const edit = node('button', 'Editar', 'creadora-chip__edit'); edit.type = 'button';
      edit.addEventListener('click', event => { event.stopPropagation(); openItem(item); });
      card.append(meta, edit);
      card.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', `item:${item.public_id}`); event.dataTransfer.effectAllowed = 'copy'; });
      card.addEventListener('click', () => {
        const slot = slotFor(state.anchor, 9 * 60, item.duration_minutes);
        openEntry(null, { item, day: state.anchor, start: slot.starts_at.slice(11, 16), end: slot.ends_at.slice(11, 16) });
      });
      card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); card.click(); } });
      library.append(card);
    }
  }

  const ghost = node('div', '', 'shift-ghost'); ghost.hidden = true; document.body.append(ghost);
  const showGhost = (text, x, y) => { ghost.textContent = text; ghost.style.transform = `translate(${x + 14}px, ${y - 12}px)`; ghost.hidden = false; };
  const hideGhost = () => { ghost.hidden = true; };
  const canvasAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-day]') ?? null;
  const minutesIn = (canvas, y) => { const rect = canvas.getBoundingClientRect(); return minutesFromOffset((y - rect.top) / rect.height); };

  function entryBox(entry, key, { absolute, placement = null }) {
    const box = node('article', undefined, 'shift-box production-box');
    box.dataset.status = entry.status; box.tabIndex = 0;
    paint(box, entry.color);
    box.append(node('strong', entry.title), node('span', shiftLabel(entry)));
    const marks = entryMarks(entry); if (marks) box.append(node('small', marks, 'shift-box__marks'));
    box.title = `${entry.title} · ${shiftLabel(entry)}${marks ? `\n${marks}` : ''}\nArrastra para mover o el borde de abajo para cambiar la hora de fin. Tócala para editarla.`;
    if (absolute) {
      const geometry = placement ?? shiftGeometry(entry, key);
      if (geometry === null) return null;
      box.style.top = `${geometry.top}%`; box.style.height = `${geometry.height}%`;
      const columns = geometry.columns ?? 1; const column = geometry.column ?? 0;
      box.style.left = `calc(${(column / columns) * 100}% + .2rem)`;
      box.style.width = `calc(${(1 / columns) * 100}% - .4rem)`;
      if (columns > 1) box.dataset.shared = 'true';
      box.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.classList.contains('shift-box__handle')) return;
        const origin = { x: event.clientX, y: event.clientY };
        let dragging = false; let target = null;
        box.setPointerCapture(event.pointerId);
        const move = moved => {
          if (!dragging && Math.hypot(moved.clientX - origin.x, moved.clientY - origin.y) < 5) return;
          dragging = true; box.dataset.dragging = 'true';
          const canvas = canvasAt(moved.clientX, moved.clientY);
          if (!canvas) { showGhost('Suelta dentro del calendario', moved.clientX, moved.clientY); target = null; return; }
          target = { key: canvas.dataset.day, minutes: minutesIn(canvas, moved.clientY) };
          showGhost(`${entry.title} · ${dayLabel(target.key, true)} · ${shiftLabel(movedShift(entry, target.key, target.minutes))}`, moved.clientX, moved.clientY);
        };
        const cleanup = () => { box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', end); box.removeEventListener('pointercancel', stop); delete box.dataset.dragging; hideGhost(); };
        const end = async () => {
          cleanup();
          if (!dragging) { openEntry(entry); return; }
          if (!target) { renderGrid(); return; }
          await save(() => client.updateProductionEntry(board, entry.public_id, movedShift(entry, target.key, target.minutes)), 'Bloque movido.');
        };
        const stop = () => { cleanup(); renderGrid(); };
        box.addEventListener('pointermove', move); box.addEventListener('pointerup', end); box.addEventListener('pointercancel', stop);
      });
      const handle = node('span', '', 'shift-box__handle');
      handle.title = 'Arrastra para cambiar la hora de fin.'; handle.setAttribute('aria-hidden', 'true');
      handle.addEventListener('pointerdown', event => {
        event.preventDefault(); event.stopPropagation();
        const canvas = box.parentElement; if (!canvas) return;
        handle.setPointerCapture(event.pointerId);
        let minutes = minutesOf(entry.ends_at);
        const preview = moved => {
          minutes = minutesIn(canvas, moved.clientY);
          const next = resizedShift(entry, minutes);
          const geometry = shiftGeometry({ ...entry, ends_at: next.ends_at }, key);
          if (geometry) box.style.height = `${geometry.height}%`;
          box.querySelector('span').textContent = shiftLabel(next);
          showGhost(`${entry.title} · ${shiftLabel(next)}`, moved.clientX, moved.clientY);
        };
        const cleanup = () => { handle.removeEventListener('pointermove', preview); handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', cancel); hideGhost(); };
        const finish = async () => { cleanup(); await save(() => client.updateProductionEntry(board, entry.public_id, resizedShift(entry, minutes)), 'Horario actualizado.'); };
        const cancel = () => { cleanup(); renderGrid(); };
        handle.addEventListener('pointermove', preview); handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', cancel);
      });
      box.append(handle);
    } else {
      box.addEventListener('click', event => { event.stopPropagation(); openEntry(entry); });
    }
    box.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEntry(entry); } });
    return box;
  }

  /** Soltar una pieza de la biblioteca a una hora la agenda en el acto, con su duración. */
  async function dropItem(event, key, minutes) {
    event.preventDefault();
    const payload = String(event.dataTransfer?.getData('text/plain') ?? '');
    if (!payload.startsWith('item:')) return;
    const item = state.items.find(entry => entry.public_id === payload.slice(5));
    if (!item) return;
    await save(() => client.createProductionEntry(board, { item: item.public_id, ...slotFor(key, minutes, item.duration_minutes) }), `${item.name} agendado.`);
  }

  function renderGrid() {
    const { days } = viewRange(state.view, state.anchor);
    grid.hidden = state.view === 'month';
    monthGrid.hidden = state.view !== 'month';
    label.textContent = rangeLabel(state.view, state.anchor);
    if (state.view === 'month') { renderMonth(days); return; }
    grid.replaceChildren();
    grid.style.setProperty('--calendar-days', String(days.length));
    const hours = node('div', undefined, 'calendar-hours');
    for (const hour of hourRows()) hours.append(node('span', `${String(hour).padStart(2, '0')}:00`));
    grid.append(hours);
    for (const key of days) {
      const column = node('div', undefined, 'calendar-day');
      column.append(node('h3', dayLabel(key, days.length > 1)));
      const canvas = node('div', undefined, 'calendar-canvas');
      canvas.dataset.day = key;
      for (const hour of hourRows()) canvas.append(node('span', undefined, 'calendar-line'));
      const minutesAt = event => minutesFromOffset((event.clientY - canvas.getBoundingClientRect().top) / canvas.getBoundingClientRect().height);
      canvas.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; canvas.dataset.over = 'true'; });
      canvas.addEventListener('dragleave', () => { delete canvas.dataset.over; });
      canvas.addEventListener('drop', event => { delete canvas.dataset.over; dropItem(event, key, minutesAt(event)); });
      canvas.addEventListener('click', event => {
        if (event.target !== canvas && !event.target.classList.contains('calendar-line')) return;
        const slot = defaultShift(key, minutesAt(event), 1);
        openEntry(null, { day: key, start: slot.starts_at.slice(11, 16), end: slot.ends_at.slice(11, 16) });
      });
      for (const placement of layoutDay(state.entries, key)) {
        const box = entryBox(placement.shift, key, { absolute: true, placement });
        if (box) canvas.append(box);
      }
      column.append(canvas);
      grid.append(column);
    }
  }

  function renderMonth(days) {
    monthGrid.replaceChildren();
    const header = node('div', undefined, 'calendar-month__header');
    for (const name of DAY_NAMES) header.append(node('span', name.slice(0, 3)));
    monthGrid.append(header);
    const body = node('div', undefined, 'calendar-month__body');
    const current = dateFromKey(monthStart(state.anchor)).getMonth();
    for (const key of days) {
      const cell = node('div', undefined, 'calendar-month__day');
      cell.dataset.day = key;
      if (dateFromKey(key).getMonth() !== current) cell.dataset.outside = 'true';
      cell.append(node('span', String(dateFromKey(key).getDate()), 'calendar-month__number'));
      cell.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
      cell.addEventListener('drop', event => dropItem(event, key, 9 * 60));
      cell.addEventListener('click', event => { if (event.target === cell) openEntry(null, { day: key }); });
      for (const entry of state.entries) {
        if (String(entry.starts_at).slice(0, 10) !== key) continue;
        const box = entryBox(entry, key, { absolute: false });
        if (box) cell.append(box);
      }
      body.append(cell);
    }
    monthGrid.append(body);
  }

  async function load(announce = true) {
    if (announce) feedback('Cargando calendario…');
    const { from, to } = viewRange(state.view, state.anchor);
    try {
      const data = await client.production(board, from, to);
      state.items = data.items ?? []; state.entries = data.entries ?? []; state.totals = data.totals ?? {};
      renderTotals(); renderLibrary(); renderGrid();
      if (announce) feedback('');
    } catch (error) { fail(error); }
  }

  for (const button of panel.querySelectorAll('[data-view]')) {
    button.addEventListener('click', async () => {
      state.view = button.dataset.view;
      for (const other of panel.querySelectorAll('[data-view]')) other.setAttribute('aria-pressed', String(other === button));
      await load();
    });
  }
  query('[data-calendar-previous]').addEventListener('click', async () => { state.anchor = shiftView(state.view, state.anchor, -1); await load(); });
  query('[data-calendar-next]').addEventListener('click', async () => { state.anchor = shiftView(state.view, state.anchor, 1); await load(); });
  query('[data-calendar-today]').addEventListener('click', async () => { state.anchor = dayKey(new Date()); await load(); });

  /* Bloque del calendario */
  const entryDialog = query('[data-entry-dialog]');
  const entryForm = entryDialog.querySelector('form');
  const entryTitle = entryDialog.querySelector('[data-entry-title]');
  const entryFeedback = entryDialog.querySelector('[data-entry-feedback]');
  const entryRemove = entryDialog.querySelector('[data-entry-remove]');
  const entryDuration = entryDialog.querySelector('[data-entry-duration]');
  let editingEntry = null; let fromItem = null;
  function updateDuration() {
    const text = durationLabel(minutesFromTime(entryForm.elements.start.value), minutesFromTime(entryForm.elements.end.value));
    entryDuration.textContent = text ? `Dura ${text}` : '';
  }
  entryForm.elements.start.addEventListener('input', updateDuration);
  entryForm.elements.end.addEventListener('input', updateDuration);
  function openEntry(entry, { item = null, day = state.anchor, start = '09:00', end = '10:00' } = {}) {
    editingEntry = entry; fromItem = item;
    entryTitle.textContent = entry ? 'Editar bloque' : item ? `Agendar «${item.name}»` : 'Agendar bloque';
    say(entryFeedback, '');
    entryForm.elements.title.value = entry?.title ?? item?.name ?? '';
    entryForm.elements.color.value = entry?.color ?? item?.color ?? '#94165e';
    entryForm.elements.day.value = entry ? entry.starts_at.slice(0, 10) : day;
    entryForm.elements.start.value = entry ? entry.starts_at.slice(11, 16) : start;
    entryForm.elements.end.value = entry ? entry.ends_at.slice(11, 16) : end;
    entryForm.elements.status.value = entry?.status ?? 'planificado';
    for (const key of ['owner', 'place', 'note']) entryForm.elements[key].value = entry?.[key] ?? '';
    entryRemove.hidden = !entry;
    updateDuration();
    entryDialog.showModal();
    entryForm.elements.title.focus();
  }
  entryForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') { entryDialog.close(); return; }
    let body;
    try {
      body = entryPayload(Object.fromEntries(['title', 'day', 'start', 'end', 'color', 'status', 'owner', 'place', 'note'].map(key => [key, entryForm.elements[key].value])));
    } catch (error) { say(entryFeedback, error.message, 'error'); return; }
    say(entryFeedback, 'Guardando…');
    try {
      if (editingEntry) await client.updateProductionEntry(board, editingEntry.public_id, body);
      else await client.createProductionEntry(board, { ...body, ...(fromItem ? { item: fromItem.public_id } : {}) });
      entryDialog.close(); await load(false); feedback(editingEntry ? 'Bloque actualizado.' : 'Bloque agendado.', 'success');
    } catch (error) { if (error.status === 401) { location.replace('/admin/'); return; } say(entryFeedback, message(error), 'error'); }
  });
  entryRemove.addEventListener('click', async () => {
    if (!editingEntry || !confirm(`¿Quitar «${editingEntry.title}» del calendario?`)) return;
    try { await client.cancelProductionEntry(board, editingEntry.public_id); entryDialog.close(); await load(false); feedback('Bloque quitado.', 'success'); }
    catch (error) { say(entryFeedback, message(error), 'error'); }
  });

  /* Pieza de la biblioteca */
  const itemDialog = query('[data-item-dialog]');
  const itemForm = itemDialog.querySelector('form');
  const itemTitle = itemDialog.querySelector('[data-item-title]');
  const itemFeedback = itemDialog.querySelector('[data-item-feedback]');
  const itemArchive = itemDialog.querySelector('[data-item-archive]');
  let editingItem = null;
  function openItem(item = null) {
    editingItem = item;
    itemTitle.textContent = item ? 'Editar pieza' : 'Nueva pieza';
    itemForm.elements.name.value = item?.name ?? '';
    itemForm.elements.description.value = item?.description ?? '';
    itemForm.elements.color.value = item?.color ?? '#94165e';
    itemForm.elements.duration_minutes.value = String(item?.duration_minutes ?? 60);
    itemArchive.hidden = !item;
    say(itemFeedback, '');
    itemDialog.showModal();
    itemForm.elements.name.focus();
  }
  itemForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') { itemDialog.close(); return; }
    const body = { name: itemForm.elements.name.value.trim(), description: itemForm.elements.description.value.trim(), color: itemForm.elements.color.value, duration_minutes: Number(itemForm.elements.duration_minutes.value) };
    if (!body.name) { say(itemFeedback, 'Escribe el nombre.', 'error'); return; }
    try {
      if (editingItem) await client.updateProductionItem(board, editingItem.public_id, body); else await client.createProductionItem(board, body);
      itemDialog.close(); await load(false); feedback(editingItem ? 'Pieza actualizada.' : 'Pieza agregada a la biblioteca.', 'success');
    } catch (error) { if (error.status === 401) { location.replace('/admin/'); return; } say(itemFeedback, message(error), 'error'); }
  });
  itemArchive.addEventListener('click', async () => {
    if (!editingItem || !confirm(`¿Sacar «${editingItem.name}» de la biblioteca? Los bloques ya agendados se conservan.`)) return;
    try { await client.archiveProductionItem(board, editingItem.public_id); itemDialog.close(); await load(false); feedback('Pieza sacada de la biblioteca.', 'success'); }
    catch (error) { say(itemFeedback, message(error), 'error'); }
  });

  query('[data-item-new]').addEventListener('click', () => openItem());
  query('[data-entry-new]').addEventListener('click', () => openEntry(null));
  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await client.logout(); location.replace('/admin/'); } catch (error) { logout.disabled = false; fail(error); }
  });

  async function start() {
    retry.hidden = true;
    try {
      // La sesión y el calendario se piden a la vez.
      const loading = load();
      const session = await client.session();
      if (!session.authenticated) { location.replace('/admin/'); return; }
      query('[data-admin-user]').textContent = `Sesión de ${session.user.username}`;
      if (sidebarUser) sidebarUser.textContent = session.user.username;
      if (logout) logout.disabled = false;
      query('[data-item-new]').disabled = false; query('[data-entry-new]').disabled = false;
      await loading;
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', start);
  await start();
}

if (typeof document !== 'undefined') initializeProduction();
