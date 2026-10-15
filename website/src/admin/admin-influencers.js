import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
import './sidebar.js?v=20260926-admin-sidebar-3';
import './campaign-banner.js?v=20261001-banner-3';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';

export class InfluencersAdminError extends Error {
  constructor(status) {
    super(({
      0: 'No se pudo conectar. Revisa tu conexión.',
      401: 'Tu sesión terminó. Vuelve a iniciar sesión.',
      403: 'Tu rol no tiene acceso a Influencers.',
      404: 'No se encontró ese creador.',
      422: 'Revisa los datos e intenta de nuevo.',
    })[status] || 'No se pudo completar la acción.');
    this.status = status;
  }
}

export function createInfluencersClient(baseUrl = API, fetchImplementation = fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  let csrf = '';
  async function request(path, options = {}) {
    if (!/^\/(?:auth\/(?:session|logout)|influencers(?:\?kind=(?:creador|nuevo))?|influencers\/evento|influencers\/export\?kind=(?:creador|nuevo)|influencers\/[a-f0-9]{32}(?:\/archivar|\/enlace)?)$/.test(path)) throw new Error('Ruta de API no permitida.');
    const method = (options.method ?? 'GET').toUpperCase();
    const headers = { Accept: options.csv ? 'text/csv' : 'application/json' };
    if (method !== 'GET') {
      if (!csrf) throw new InfluencersAdminError(403);
      headers['X-CSRF-Token'] = csrf;
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch { throw new InfluencersAdminError(0); }
    if (!response.ok) throw new InfluencersAdminError(response.status);
    if (options.csv) return response.blob();
    let data;
    try { data = await response.json(); } catch { throw new InfluencersAdminError(502); }
    if (typeof data.csrf === 'string') csrf = data.csrf;
    return data;
  }
  return {
    session: () => request('/auth/session'),
    logout: () => request('/auth/logout', { method: 'POST' }),
    list: kind => request(`/influencers?kind=${kind}`),
    create: names => request('/influencers', { method: 'POST', body: { names } }),
    update: (id, body) => request(`/influencers/${id}`, { method: 'PATCH', body }),
    archive: id => request(`/influencers/${id}/archivar`, { method: 'POST', body: {} }),
    newLink: id => request(`/influencers/${id}/enlace`, { method: 'POST', body: {} }),
    saveEvent: body => request('/influencers/evento', { method: 'PATCH', body }),
    exportCsv: kind => request(`/influencers/export?kind=${kind}`, { csv: true }),
  };
}

/* ---------- Funciones puras (probadas) ---------- */

/** El enlace personal de un creador, siempre del mismo sitio donde se abrió el panel. */
export function personalInvitationUrl(origin, token) {
  return `${origin}/i/?c=${encodeURIComponent(token)}`;
}

/** El gafete con QR, para quien confirmó y está aprobado. */
export function badgeUrl(origin, token) {
  return `${origin}/finados/invitacion/gafete/?c=${encodeURIComponent(token)}`;
}

export function badgeMessage(name, url) {
  return `Hola, ${name}. ¡Tu lugar en el Lanzamiento Guaynaa está confirmado! Descarga aquí tu gafete con tu código QR y preséntalo en la entrada: ${url}`;
}

export function openInvitationUrl(origin) {
  return `${origin}/finados/invitacion/creadores/`;
}

/** WhatsApp necesita el número con código de país: 0987654321 → 593987654321. */
export function whatsappNumber(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (/^0\d{9}$/.test(digits)) return `593${digits.slice(1)}`;
  return /^\d{9,15}$/.test(digits) ? digits : '';
}

export function invitationMessage(name, url) {
  return `Hola, ${name}. Tenemos una invitación especial para ti: el Lanzamiento Guaynaa de Finados Mushuc Runa 2026. Ábrela aquí y confírmanos si nos acompañas: ${url}`;
}

/** Abre WhatsApp con el mensaje listo; si no hay número, deja elegir el contacto. */
export function whatsappLink(phone, message) {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function matchesFilter(guest, filter) {
  if (!filter) return true;
  if (filter === 'por_aprobar') return guest.approval === 'pendiente';
  return guest.response === filter;
}

export function ecuadorTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(value ?? ''));
  if (!match) return '';
  const [, year, month, day, hour, minute] = match.map(Number);
  const local = new Date(Date.UTC(year, month - 1, day, hour, minute) - 5 * 3600000);
  const pad = number => String(number).padStart(2, '0');
  return `${pad(local.getUTCDate())}/${pad(local.getUTCMonth() + 1)} ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
}

const RESPONSES = Object.freeze({ pendiente: 'Sin respuesta', si: 'Sí asistirá', no: 'No asistirá' });
const APPROVALS = Object.freeze({ pendiente: 'Por aprobar', aprobado: 'Aprobado', rechazado: 'No aprobado' });

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function selectOf(values, current, label) {
  const select = document.createElement('select');
  select.setAttribute('aria-label', label);
  for (const [value, text] of Object.entries(values)) select.append(Object.assign(node('option', text), { value }));
  select.value = current;
  return select;
}

export async function initializeInfluencers() {
  const panel = document.querySelector('[data-admin-influencers]');
  if (!panel) return;
  const kind = panel.dataset.kind === 'creador' ? 'creador' : 'nuevo';
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
  const client = createInfluencersClient(base);
  const logout = document.querySelector('[data-admin-logout]');
  const feedback = (message, tone = '') => { status.textContent = message; status.dataset.error = String(tone === 'error'); status.dataset.success = String(tone === 'success'); };
  const fail = error => { if (error.status === 401) { location.replace('/admin/'); return; } feedback(error.message, 'error'); };
  const state = { guests: [], totals: {}, event: null, filter: '' };
  const rows = query('[data-rows]');
  const listMessage = query('[data-list-message]');
  const summary = query('[data-summary]');

  const copy = async (text, done) => {
    try { await navigator.clipboard.writeText(text); feedback(done, 'success'); }
    catch { feedback('No se pudo copiar automáticamente. Mantén presionado el enlace para copiarlo.'); }
  };

  function renderSummary() {
    const totals = state.totals;
    const metrics = kind === 'creador'
      ? [['Invitados', totals.total], ['Confirmaron que sí', totals.si], ['No asistirán', totals.no], ['Sin respuesta', totals.pendiente], ['Abrieron la invitación', totals.abrieron]]
      : [['Registros', totals.total], ['Dijeron que sí', totals.si], ['Por aprobar', totals.por_aprobar], ['Aprobados que asisten', totals.aprobados_si], ['No asistirán', totals.no]];
    summary.replaceChildren(...metrics.map(([label, value]) => { const block = node('dl'); block.append(node('dt', label), node('dd', String(value ?? 0))); return block; }));
    summary.setAttribute('aria-busy', 'false');
  }

  function renderEvent() {
    const event = state.event;
    if (!event) return;
    const form = query('[data-event-form]');
    form.elements.title.value = event.title;
    form.elements.date.value = event.date;
    form.elements.time.value = event.time;
    form.elements.place.value = event.place;
    form.elements.details.value = event.details;
    query('[data-event-summary]').textContent = `${event.title} · ${event.date.split('-').reverse().join('/')} · ${event.time || 'hora por confirmar'}`;
  }

  function guestRow(guest) {
    const row = node('tr');
    const who = node('td');
    who.dataset.label = 'Creador';
    who.append(node('strong', guest.full_name, 'record-name'));
    const contact = [guest.whatsapp, guest.city].filter(Boolean).join(' · ');
    if (contact) who.append(node('small', contact));
    if (guest.note) who.append(node('small', `Nota: ${guest.note}`));
    if (guest.from_open) who.append(node('small', 'Vino de Nuevos creadores · aprobado', 'inf-from-open'));
    const cells = [who];
    if (kind === 'creador') {
      const opened = node('td', guest.opened_at ? `Sí · ${ecuadorTime(guest.opened_at)}` : 'Todavía no');
      opened.dataset.label = 'Abrió';
      cells.push(opened);
    } else {
      const account = node('td');
      account.dataset.label = 'Cuenta';
      if (/^https:\/\//.test(guest.social_link)) {
        const link = Object.assign(node('a', guest.social_link.replace(/^https:\/\/(www\.)?/, '')), { href: guest.social_link, target: '_blank', rel: 'noopener noreferrer' });
        account.append(link);
      } else account.append(node('span', guest.social_link || '—'));
      if (guest.followers !== null) account.append(node('small', `${Number(guest.followers).toLocaleString('es-EC')} seguidores`));
      cells.push(account);
    }
    const answer = node('td');
    answer.dataset.label = 'Respuesta';
    const responseSelect = selectOf(RESPONSES, guest.response, `Respuesta de ${guest.full_name}`);
    responseSelect.dataset.response = guest.response;
    responseSelect.className = 'inf-response';
    responseSelect.addEventListener('change', async () => {
      try { await client.update(guest.public_id, { response: responseSelect.value }); feedback(`Respuesta de ${guest.full_name} actualizada.`, 'success'); await refresh(); }
      catch (error) { fail(error); await refresh(); }
    });
    answer.append(responseSelect);
    if (guest.responded_at) answer.append(node('small', ecuadorTime(guest.responded_at)));
    cells.push(answer);
    if (kind === 'nuevo') {
      const approval = node('td');
      approval.dataset.label = 'Aprobación';
      const approvalSelect = selectOf(APPROVALS, guest.approval, `Aprobación de ${guest.full_name}`);
      approvalSelect.dataset.approval = guest.approval;
      approvalSelect.className = 'inf-approval';
      approvalSelect.addEventListener('change', async () => {
        try { await client.update(guest.public_id, { approval: approvalSelect.value }); feedback(approvalSelect.value === 'aprobado' ? `${guest.full_name} fue aprobado y pasó a Creadores.` : `${guest.full_name}: ${APPROVALS[approvalSelect.value].toLowerCase()}.`, 'success'); await refresh(); }
        catch (error) { fail(error); await refresh(); }
      });
      approval.append(approvalSelect);
      cells.push(approval);
    }
    const actions = node('td', undefined, 'inf-actions');
    if (kind === 'creador' && guest.invite_token) {
      const url = personalInvitationUrl(location.origin, guest.invite_token);
      const send = Object.assign(node('a', 'Enviar por WhatsApp', 'button-primary'), { href: whatsappLink(guest.whatsapp, invitationMessage(guest.full_name, url)), target: '_blank', rel: 'noopener noreferrer' });
      const copyLink = node('button', 'Copiar enlace', 'button-quiet');
      copyLink.type = 'button';
      copyLink.addEventListener('click', () => copy(url, `Enlace de ${guest.full_name} copiado.`));
      const view = Object.assign(node('a', 'Ver', 'button-quiet'), { href: url, target: '_blank', rel: 'noopener' });
      actions.append(send, copyLink, view);
    } else if (guest.whatsapp) {
      const chat = Object.assign(node('a', 'Escribir por WhatsApp', 'button-quiet'), { href: whatsappLink(guest.whatsapp, `Hola, ${guest.full_name.split(' ')[0]}. Te escribimos de Finados Mushuc Runa por tu registro al Lanzamiento Guaynaa.`), target: '_blank', rel: 'noopener noreferrer' });
      actions.append(chat);
    }
    if (guest.invite_token && guest.response === 'si' && guest.approval === 'aprobado') {
      const badge = badgeUrl(location.origin, guest.invite_token);
      const sendBadge = Object.assign(node('a', 'Enviar gafete', kind === 'nuevo' ? 'button-primary' : 'button-quiet'), { href: whatsappLink(guest.whatsapp, badgeMessage(guest.full_name, badge)), target: '_blank', rel: 'noopener noreferrer' });
      actions.append(sendBadge);
    }
    const edit = node('button', 'Editar', 'button-quiet');
    edit.type = 'button';
    edit.addEventListener('click', () => openEdit(guest));
    actions.append(edit);
    if (kind === 'creador') {
      const relink = node('button', 'Nuevo enlace', 'button-quiet');
      relink.type = 'button';
      relink.addEventListener('click', async () => {
        if (!confirm(`¿Generar un enlace nuevo para ${guest.full_name}? El enlace anterior dejará de funcionar.`)) return;
        try { await client.newLink(guest.public_id); feedback(`Enlace nuevo para ${guest.full_name}. Envíale este.`, 'success'); await refresh(); } catch (error) { fail(error); }
      });
      actions.append(relink);
    }
    const remove = node('button', 'Retirar', 'button-danger');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!confirm(`¿Retirar a ${guest.full_name}? Se guarda en el historial; su enlace deja de funcionar.`)) return;
      try { await client.archive(guest.public_id); feedback(`${guest.full_name} fue retirado.`, 'success'); await refresh(); } catch (error) { fail(error); }
    });
    actions.append(remove);
    cells.push(actions);
    row.append(...cells);
    return row;
  }

  function renderRows() {
    const visible = state.guests.filter(guest => matchesFilter(guest, state.filter));
    rows.replaceChildren(...visible.map(guestRow));
    listMessage.textContent = state.guests.length === 0
      ? (kind === 'creador' ? 'Todavía no hay creadores. Escribe sus nombres arriba para crear sus invitaciones.' : 'Todavía no hay registros. Comparte el enlace de arriba.')
      : `${visible.length} de ${state.guests.length}`;
    query('[data-list-region]').setAttribute('aria-busy', 'false');
  }

  async function refresh() {
    const data = await client.list(kind);
    state.guests = data.guests ?? [];
    state.totals = data.totals ?? {};
    state.event = data.event ?? null;
    renderSummary();
    renderEvent();
    renderRows();
  }

  query('[data-filter]').addEventListener('change', event => { state.filter = event.target.value; renderRows(); });

  const eventForm = query('[data-event-form]');
  eventForm.addEventListener('submit', async event => {
    event.preventDefault();
    const message = eventForm.querySelector('[data-event-feedback]');
    const values = Object.fromEntries(new FormData(eventForm));
    try {
      const data = await client.saveEvent({ title: values.title.trim(), date: values.date, time: values.time, place: values.place.trim(), details: values.details.trim() });
      state.event = data.event;
      renderEvent();
      message.textContent = 'Evento guardado. Las invitaciones ya muestran estos datos.';
      message.dataset.error = 'false';
    } catch (error) { message.textContent = error.message; message.dataset.error = 'true'; if (error.status === 401) fail(error); }
  });

  const addForm = query('[data-add-form]');
  addForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const names = addForm.elements.names.value;
    if (!names.trim()) { feedback('Escribe al menos un nombre.', 'error'); addForm.elements.names.focus(); return; }
    const button = addForm.querySelector('button');
    button.disabled = true;
    try {
      const data = await client.create(names);
      addForm.reset();
      await refresh();
      feedback(`${data.guests.length === 1 ? 'Se creó 1 invitación' : `Se crearon ${data.guests.length} invitaciones`}. Envía cada una con «Enviar por WhatsApp».`, 'success');
    } catch (error) { fail(error); }
    finally { button.disabled = false; }
  });

  const openLink = query('[data-open-link]');
  if (openLink) {
    openLink.value = openInvitationUrl(location.origin);
    query('[data-open-preview]').href = openLink.value;
    query('[data-open-copy]').addEventListener('click', () => copy(openLink.value, 'Enlace copiado.'));
  }

  const dialog = query('[data-edit-dialog]');
  const editForm = dialog.querySelector('form');
  const editFeedback = dialog.querySelector('[data-edit-feedback]');
  let editing = null;
  function openEdit(guest) {
    editing = guest;
    editForm.elements.full_name.value = guest.full_name;
    editForm.elements.whatsapp.value = guest.whatsapp;
    editForm.elements.social_link.value = guest.social_link;
    editForm.elements.followers.value = guest.followers ?? '';
    editForm.elements.city.value = guest.city;
    editForm.elements.note.value = guest.note;
    editFeedback.textContent = '';
    dialog.showModal();
    editForm.elements.full_name.focus();
  }
  editForm.addEventListener('submit', async event => {
    if (event.submitter?.value === 'cancel' || !editing) return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(editForm));
    try {
      await client.update(editing.public_id, {
        full_name: values.full_name.trim(), whatsapp: values.whatsapp.trim(), social_link: values.social_link.trim(),
        followers: values.followers === '' ? null : Number(values.followers), city: values.city.trim(), note: values.note.trim(),
      });
      dialog.close();
      feedback(`Datos de ${values.full_name.trim()} guardados.`, 'success');
      await refresh();
    } catch (error) {
      editFeedback.textContent = error.status === 422 ? 'Revisa el WhatsApp (solo números), la cuenta (@usuario o enlace https) y los seguidores.' : error.message;
      editFeedback.dataset.error = 'true';
      if (error.status === 401) fail(error);
    }
  });

  const exportButton = query('[data-export]');
  exportButton.addEventListener('click', async () => {
    try {
      const blob = await client.exportCsv(kind);
      const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `influencers-${kind === 'creador' ? 'creadores' : 'nuevos'}.csv` });
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (error) { fail(error); }
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
      eventForm.querySelector('fieldset').disabled = false;
      if (addForm) addForm.querySelector('button').disabled = false;
      exportButton.disabled = false;
      feedback('');
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', start);
  await start();
}

if (typeof document !== 'undefined') initializeInfluencers();
