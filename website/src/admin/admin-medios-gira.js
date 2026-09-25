import { resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
// Mismo cliente administrativo que Medios (sesión, CSRF y rutas permitidas) y las mismas piezas
// del calendario de Creadoras, para que ambos se usen igual.
import { createMediaAdminClient } from './admin-medios.js?v=20260925-admin-medios-26';
import {
  creadoraColor, dateFromKey, dayKey, dayLabel, defaultShift, durationLabel, hourRows, layoutDay, minutesFromOffset, minutesFromTime,
  minutesOf, monthStart, movedShift, rangeLabel, resizedShift, shiftGeometry, shiftLabel, shiftView, viewRange,
} from './admin-creadoras.js?v=20260925-creadoras-11';

const LOCAL_API = 'http://127.0.0.1:4174/api';
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const TOUR_KINDS = Object.freeze({ entrevista: 'Entrevista', en_vivo: 'En vivo', grabacion: 'Grabación', visita: 'Visita', rueda: 'Rueda de prensa', otro: 'Otro' });
export const TOUR_STATUSES = Object.freeze({ programada: 'Programada', confirmada: 'Confirmada', realizada: 'Realizada', no_se_dio: 'No se dio' });
const STATUS_MARKS = Object.freeze({ programada: '', confirmada: '✓ confirmada', realizada: '★ realizada', no_se_dio: '✗ no se dio' });

/* ---------- Funciones puras (probadas) ---------- */

/** Lo que lleva la caja: el medio arriba y quién va debajo. */
export function visitTitle(visit = {}) {
  return String(visit.media?.name ?? 'Medio');
}
export function visitPeople(visit = {}) {
  const people = Array.isArray(visit.people) ? visit.people : [];
  return people.map(person => person.name).join(', ');
}
export function visitMarks(visit = {}) {
  return [TOUR_KINDS[visit.kind] ?? '', STATUS_MARKS[visit.status] ?? ''].filter(Boolean).join(' · ');
}

/** Busca en la lista de medios de Seguimiento por nombre, ciudad o frecuencia, sin importar tildes. */
export function filterMedia(media, search) {
  const plain = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const needle = plain(search).trim();
  if (!needle) return media;
  return media.filter(item => plain(`${item.name} ${item.city} ${item.frequency}`).includes(needle));
}

/** El cuerpo que se envía al guardar una cita desde el formulario. */
export function visitPayload({ media, people, day, start, end, kind, status, place, note }) {
  if (!media) throw new Error('Escribe el medio y elígelo de la lista.');
  if (!people?.length) throw new Error('Elige al menos una persona.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) throw new Error('Elige el día.');
  const from = minutesFromTime(start); const to = minutesFromTime(end);
  if (from === null || to === null) throw new Error('Escribe la hora de inicio y de fin.');
  if (to <= from) throw new Error('La hora de fin debe ser posterior a la de inicio. Revisa si elegiste a. m. en lugar de p. m.');
  if (to - from < 15) throw new Error('La cita debe durar al menos 15 minutos.');
  return { media, people, starts_at: `${day} ${start}`, ends_at: `${day} ${end}`, kind, status, place: String(place ?? '').trim(), note: String(note ?? '').trim() };
}

/* ---------- Interfaz ---------- */

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}

export async function initializeMediaTour() {
  const panel = document.querySelector('[data-admin-medios-gira]');
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
  const client = createMediaAdminClient(base);
  const logout = document.querySelector('[data-admin-logout]');
  const sidebarUser = document.querySelector('[data-admin-sidebar-user]');
  const say = (element, message, kind = '') => { element.textContent = message; element.dataset.error = String(kind === 'error'); element.dataset.success = String(kind === 'success'); };
  const feedback = (message, kind = '') => say(status, message, kind);
  const message = error => error.status === 409 ? 'Esa persona ya tiene otra cita a esa hora.' : error.status === 422 ? 'Revisa los datos: medio, personas, día y horas.' : error.message;
  const fail = error => { if (error.status === 401) { location.replace('/admin/'); return; } feedback(message(error), 'error'); };

  const state = { view: 'week', anchor: dayKey(new Date()), visits: [], people: [], media: [], totals: {} };
  const grid = query('[data-calendar-grid]');
  const monthGrid = query('[data-calendar-month]');
  const label = query('[data-calendar-label]');
  const list = query('[data-person-list]');
  const totals = query('[data-tour-totals]');

  async function save(action, success = 'Guardado.') {
    try { await action(); await load(false); feedback(success, 'success'); return true; }
    catch (error) { fail(error); renderGrid(); return false; }
  }

  function renderTotals() {
    totals.replaceChildren();
    const data = state.totals ?? {};
    for (const [text, value] of [['Citas agendadas', data.visits], ['Confirmadas', data.confirmed], ['Realizadas', data.done], ['Medios visitados', data.media], ['Personas en la gira', data.people]]) {
      const box = node('div', undefined, 'admin-big-number'); box.append(node('strong', value ?? 0), node('span', text)); totals.append(box);
    }
  }

  function renderPeople() {
    list.replaceChildren();
    if (!state.people.length) { list.append(node('p', 'Todavía no hay personas. Agrega la primera con «Agregar persona».', 'admin-panel-empty')); return; }
    for (const person of state.people) {
      const item = node('li', undefined, 'creadora-chip');
      const color = creadoraColor(person.public_id);
      item.style.setProperty('--shift-soft', color.soft);
      item.style.setProperty('--shift-edge', color.edge);
      item.draggable = true; item.tabIndex = 0; item.setAttribute('role', 'button');
      const body = node('span'); body.append(node('strong', person.name));
      if (person.role) body.append(node('small', person.role));
      const open = node('button', 'Ver ficha', 'creadora-chip__edit'); open.type = 'button';
      open.addEventListener('click', event => { event.stopPropagation(); openPerson(person); });
      item.append(body, node('span', `${person.visits_count ?? 0}`, 'creadora-chip__count'), open);
      item.title = `${person.visits_count ?? 0} citas · ${person.done_count ?? 0} realizadas`;
      item.addEventListener('click', () => openVisit(null, { people: [person.public_id] }));
      item.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.click(); } });
      item.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', `person:${person.public_id}`); event.dataTransfer.effectAllowed = 'copy'; });
      list.append(item);
    }
  }

  /* Arrastre: la misma etiqueta flotante que en Creadoras dice dónde caería la cita. */
  const ghost = node('div', '', 'shift-ghost'); ghost.hidden = true; document.body.append(ghost);
  const showGhost = (text, x, y) => { ghost.textContent = text; ghost.style.transform = `translate(${x + 14}px, ${y - 12}px)`; ghost.hidden = false; };
  const hideGhost = () => { ghost.hidden = true; };
  const canvasAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-day]') ?? null;
  const minutesIn = (canvas, y) => { const rect = canvas.getBoundingClientRect(); return minutesFromOffset((y - rect.top) / rect.height); };

  function visitBox(visit, key, { absolute, placement = null }) {
    const color = creadoraColor(visit.people?.[0]?.public_id ?? visit.public_id);
    const box = node('article', undefined, 'shift-box tour-box');
    box.dataset.status = visit.status; box.tabIndex = 0;
    box.style.setProperty('--shift-soft', color.soft);
    box.style.setProperty('--shift-edge', color.edge);
    box.style.setProperty('--shift-ink', color.ink);
    box.append(node('strong', visitTitle(visit)), node('span', shiftLabel(visit)));
    const people = visitPeople(visit); if (people) box.append(node('small', people));
    const marks = visitMarks(visit); if (marks) box.append(node('small', marks, 'shift-box__marks'));
    box.title = `${visitTitle(visit)} · ${shiftLabel(visit)}\n${people}${visit.place ? `\n${visit.place}` : ''}\nArrastra para mover o el borde de abajo para cambiar la hora de fin. Tócala para editarla.`;
    if (absolute) {
      const geometry = placement ?? shiftGeometry(visit, key);
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
          showGhost(`${visitTitle(visit)} · ${dayLabel(target.key, true)} · ${shiftLabel(movedShift(visit, target.key, target.minutes))}`, moved.clientX, moved.clientY);
        };
        const cleanup = () => { box.removeEventListener('pointermove', move); box.removeEventListener('pointerup', end); box.removeEventListener('pointercancel', stop); delete box.dataset.dragging; hideGhost(); };
        const end = async () => {
          cleanup();
          if (!dragging) { openVisit(visit); return; }
          if (!target) { renderGrid(); return; }
          await save(() => client.updateTourVisit(visit.public_id, movedShift(visit, target.key, target.minutes)), 'Cita movida.');
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
        let minutes = minutesOf(visit.ends_at);
        const preview = moved => {
          minutes = minutesIn(canvas, moved.clientY);
          const next = resizedShift(visit, minutes);
          const geometry = shiftGeometry({ ...visit, ends_at: next.ends_at }, key);
          if (geometry) box.style.height = `${geometry.height}%`;
          box.querySelector('span').textContent = shiftLabel(next);
          showGhost(`${visitTitle(visit)} · ${shiftLabel(next)}`, moved.clientX, moved.clientY);
        };
        const cleanup = () => { handle.removeEventListener('pointermove', preview); handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', cancel); hideGhost(); };
        const finish = async () => { cleanup(); await save(() => client.updateTourVisit(visit.public_id, resizedShift(visit, minutes)), 'Horario actualizado.'); };
        const cancel = () => { cleanup(); renderGrid(); };
        handle.addEventListener('pointermove', preview); handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', cancel);
      });
      box.append(handle);
    } else {
      box.addEventListener('click', event => { event.stopPropagation(); openVisit(visit); });
    }
    box.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openVisit(visit); } });
    return box;
  }

  /** Soltar un nombre en una hora abre la cita con esa persona, ese día y esa hora; solo falta elegir el medio. */
  function dropPerson(event, key, minutes) {
    event.preventDefault();
    const payload = String(event.dataTransfer?.getData('text/plain') ?? '');
    if (!payload.startsWith('person:')) return;
    const slot = defaultShift(key, minutes, 1);
    openVisit(null, { people: [payload.slice(7)], day: key, start: slot.starts_at.slice(11, 16), end: slot.ends_at.slice(11, 16) });
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
      canvas.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
      canvas.addEventListener('drop', event => dropPerson(event, key, minutesAt(event)));
      canvas.addEventListener('click', event => {
        if (event.target !== canvas && !event.target.classList.contains('calendar-line')) return;
        const slot = defaultShift(key, minutesAt(event), 1);
        openVisit(null, { day: key, start: slot.starts_at.slice(11, 16), end: slot.ends_at.slice(11, 16) });
      });
      for (const placement of layoutDay(state.visits, key)) {
        const box = visitBox(placement.shift, key, { absolute: true, placement });
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
      cell.addEventListener('drop', event => dropPerson(event, key, 9 * 60));
      cell.addEventListener('click', event => { if (event.target === cell) openVisit(null, { day: key }); });
      for (const visit of state.visits) {
        if (String(visit.starts_at).slice(0, 10) !== key) continue;
        const box = visitBox(visit, key, { absolute: false });
        if (box) cell.append(box);
      }
      body.append(cell);
    }
    monthGrid.append(body);
  }

  async function load(announce = true) {
    if (announce) feedback('Cargando gira…');
    const { from, to } = viewRange(state.view, state.anchor);
    try {
      const data = await client.mediaTour(from, to);
      state.visits = data.visits ?? []; state.people = data.people ?? []; state.media = data.media ?? []; state.totals = data.totals ?? {};
      renderTotals(); renderPeople(); renderGrid();
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

  /* Cita: medio de Seguimiento (con buscador), quién va, día, horas, tipo, estado, lugar y nota. */
  const visitDialog = query('[data-visit-dialog]');
  const visitForm = visitDialog.querySelector('form');
  const visitTitleText = visitDialog.querySelector('[data-visit-title]');
  const visitFeedback = visitDialog.querySelector('[data-visit-feedback]');
  const mediaSearch = visitDialog.querySelector('[data-media-search]');
  const mediaOptions = visitDialog.querySelector('[data-media-options]');
  const mediaChosen = visitDialog.querySelector('[data-media-chosen]');
  const peopleBox = visitDialog.querySelector('[data-visit-people]');
  const removeVisit = visitDialog.querySelector('[data-visit-remove]');
  const duration = visitDialog.querySelector('[data-visit-duration]');
  let editing = null;
  let chosenMedia = null; let matches = []; let active = -1;

  /* Un solo campo: se escribe el medio y se elige de la lista de Seguimiento que aparece debajo. */
  const mediaLabel = item => [item.name, item.city, item.frequency].filter(Boolean).join(' · ');
  function paintChosen() {
    mediaChosen.textContent = chosenMedia ? `✓ ${mediaLabel(chosenMedia)}` : 'Todavía no eliges el medio.';
    mediaChosen.dataset.chosen = String(Boolean(chosenMedia));
  }
  function closeOptions() { mediaOptions.hidden = true; mediaSearch.setAttribute('aria-expanded', 'false'); mediaSearch.removeAttribute('aria-activedescendant'); active = -1; }
  function choose(item) {
    chosenMedia = item; mediaSearch.value = item.name; paintChosen(); closeOptions();
    say(visitFeedback, '');
  }
  function showOptions() {
    matches = filterMedia(state.media, mediaSearch.value).slice(0, 8);
    mediaOptions.replaceChildren();
    if (!matches.length) {
      mediaOptions.append(node('li', state.media.length ? 'Ningún medio de Seguimiento coincide. Revisa el nombre o créalo primero en Seguimiento de medios.' : 'Todavía no hay medios en Seguimiento de medios.', 'tour-media__empty'));
    }
    matches.forEach((item, index) => {
      const option = node('li', undefined, 'tour-media__option');
      option.id = `tour-media-option-${index}`; option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === active));
      option.append(node('strong', item.name), node('small', [item.city, item.frequency].filter(Boolean).join(' · ')));
      // mousedown para que el campo no pierda el foco antes de elegir.
      option.addEventListener('mousedown', event => { event.preventDefault(); choose(item); });
      mediaOptions.append(option);
    });
    mediaOptions.hidden = false; mediaSearch.setAttribute('aria-expanded', 'true');
    if (active >= 0) mediaSearch.setAttribute('aria-activedescendant', `tour-media-option-${active}`); else mediaSearch.removeAttribute('aria-activedescendant');
  }
  mediaSearch.addEventListener('input', () => {
    // Si cambia lo escrito, hay que volver a elegir de la lista.
    if (chosenMedia && mediaSearch.value !== chosenMedia.name) { chosenMedia = null; paintChosen(); }
    active = -1; showOptions();
  });
  mediaSearch.addEventListener('focus', showOptions);
  mediaSearch.addEventListener('blur', () => setTimeout(closeOptions, 120));
  mediaSearch.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (mediaOptions.hidden) showOptions();
      if (!matches.length) return;
      active = event.key === 'ArrowDown' ? (active + 1) % matches.length : (active <= 0 ? matches.length - 1 : active - 1);
      showOptions();
    } else if (event.key === 'Enter' && !mediaOptions.hidden) {
      event.preventDefault();
      const item = matches[active >= 0 ? active : 0];
      if (item) choose(item);
    } else if (event.key === 'Escape' && !mediaOptions.hidden) {
      event.preventDefault(); event.stopPropagation(); closeOptions();
    }
  });

  function fillPeople(selected = []) {
    peopleBox.replaceChildren();
    if (!state.people.length) { peopleBox.append(node('p', 'Primero agrega a las personas de la gira.', 'admin-panel-empty')); return; }
    for (const person of state.people) {
      const labelElement = node('label', undefined, 'shift-person');
      labelElement.style.setProperty('--shift-edge', creadoraColor(person.public_id).edge);
      const input = document.createElement('input'); input.type = 'checkbox'; input.value = person.public_id; input.checked = selected.includes(person.public_id);
      labelElement.append(input, node('span', person.role ? `${person.name} · ${person.role}` : person.name));
      peopleBox.append(labelElement);
    }
  }
  function updateDuration() {
    const text = durationLabel(minutesFromTime(visitForm.elements.start.value), minutesFromTime(visitForm.elements.end.value));
    duration.textContent = text ? `Dura ${text}` : '';
  }
  visitForm.elements.start.addEventListener('input', updateDuration);
  visitForm.elements.end.addEventListener('input', updateDuration);

  function openVisit(visit, { people = [], day = state.anchor, start = '09:00', end = '10:00' } = {}) {
    editing = visit;
    visitTitleText.textContent = visit ? 'Editar cita' : 'Agendar cita';
    say(visitFeedback, '');
    chosenMedia = visit ? (state.media.find(item => item.public_id === visit.media?.public_id) ?? visit.media) : null;
    mediaSearch.value = chosenMedia?.name ?? ''; paintChosen(); closeOptions();
    fillPeople(visit ? visit.people.map(person => person.public_id) : people);
    visitForm.elements.day.value = visit ? visit.starts_at.slice(0, 10) : day;
    visitForm.elements.start.value = visit ? visit.starts_at.slice(11, 16) : start;
    visitForm.elements.end.value = visit ? visit.ends_at.slice(11, 16) : end;
    visitForm.elements.kind.value = visit?.kind ?? 'entrevista';
    visitForm.elements.status.value = visit?.status ?? 'programada';
    visitForm.elements.place.value = visit?.place ?? '';
    visitForm.elements.note.value = visit?.note ?? '';
    removeVisit.hidden = !visit;
    updateDuration();
    visitDialog.showModal();
    (visit ? visitForm.elements.status : mediaSearch).focus();
  }
  visitForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') { visitDialog.close(); return; }
    let body;
    try {
      body = visitPayload({
        media: chosenMedia?.public_id ?? '', people: [...peopleBox.querySelectorAll('input:checked')].map(input => input.value),
        day: visitForm.elements.day.value, start: visitForm.elements.start.value, end: visitForm.elements.end.value,
        kind: visitForm.elements.kind.value, status: visitForm.elements.status.value, place: visitForm.elements.place.value, note: visitForm.elements.note.value,
      });
    } catch (error) { say(visitFeedback, error.message, 'error'); return; }
    say(visitFeedback, 'Guardando…');
    try {
      if (editing) await client.updateTourVisit(editing.public_id, body); else await client.createTourVisit(body);
      visitDialog.close(); await load(false); feedback(editing ? 'Cita actualizada.' : 'Cita agendada.', 'success');
    } catch (error) { if (error.status === 401) { location.replace('/admin/'); return; } say(visitFeedback, message(error), 'error'); }
  });
  removeVisit.addEventListener('click', async () => {
    if (!editing || !confirm(`¿Quitar la cita en ${visitTitle(editing)}? Deja de verse en el calendario.`)) return;
    try { await client.cancelTourVisit(editing.public_id); visitDialog.close(); await load(false); feedback('Cita quitada.', 'success'); }
    catch (error) { say(visitFeedback, message(error), 'error'); }
  });

  /* Persona de la gira */
  const personDialog = query('[data-person-dialog]');
  const personForm = personDialog.querySelector('form');
  const personTitle = personDialog.querySelector('[data-person-title]');
  const personFeedback = personDialog.querySelector('[data-person-feedback]');
  const retire = personDialog.querySelector('[data-person-retire]');
  let editingPerson = null;
  function openPerson(person = null) {
    editingPerson = person;
    personTitle.textContent = person ? 'Ficha de la persona' : 'Agregar persona';
    for (const key of ['name', 'role', 'phone', 'note']) personForm.elements[key].value = person?.[key] ?? '';
    retire.hidden = !person;
    say(personFeedback, person ? `${person.visits_count} citas · ${person.done_count} realizadas` : '');
    personDialog.showModal();
    personForm.elements.name.focus();
  }
  personForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (event.submitter?.value === 'cancel') { personDialog.close(); return; }
    const body = Object.fromEntries(['name', 'role', 'phone', 'note'].map(key => [key, personForm.elements[key].value.trim()]));
    if (!body.name) { say(personFeedback, 'Escribe el nombre.', 'error'); return; }
    try {
      if (editingPerson) await client.updateTourPerson(editingPerson.public_id, body); else await client.createTourPerson(body);
      personDialog.close(); await load(false); feedback(editingPerson ? 'Ficha actualizada.' : 'Persona agregada a la gira.', 'success');
    } catch (error) { if (error.status === 401) { location.replace('/admin/'); return; } say(personFeedback, error.status === 422 ? 'Revisa el nombre y el teléfono.' : error.message, 'error'); }
  });
  retire.addEventListener('click', async () => {
    if (!editingPerson || !confirm(`¿Retirar a ${editingPerson.name} de la gira? Sus citas pasadas se conservan.`)) return;
    try { await client.retireTourPerson(editingPerson.public_id); personDialog.close(); await load(false); feedback('Persona retirada de la gira.', 'success'); }
    catch (error) { say(personFeedback, error.message, 'error'); }
  });

  query('[data-person-new]').addEventListener('click', () => openPerson());
  query('[data-visit-new]').addEventListener('click', () => openVisit(null));
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
      query('[data-person-new]').disabled = false; query('[data-visit-new]').disabled = false;
      await loading;
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', start);
  await start();
}

if (typeof document !== 'undefined') initializeMediaTour();
