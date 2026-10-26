import { qrcode } from './qrcode-generator.mjs';
import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, PRIMARY_SITE_ORIGIN, resolveRuntimeOrigins } from './runtime-origins.mjs';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const SHORT_DAYS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const SHORT_MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

/**
 * Configuración pública de cada invitación. Guaynaa conserva sus rutas históricas;
 * los eventos nuevos viven en un namespace propio para no mezclar respuestas ni QR.
 */
export const INVITATION_EVENTS = Object.freeze({
  guaynaa: Object.freeze({
    key: 'guaynaa', title: 'Lanzamiento Guaynaa', apiPrefix: '/invitacion', dressCode: 'Blanco',
    paths: Object.freeze({
      personal: '/finados/invitacion/', personalShort: '/i/', open: '/finados/invitacion/creadores/',
      thanks: '/finados/invitacion/gracias/', badge: '/finados/invitacion/gafete/', verify: '/finados/invitacion/verificar/',
    }),
    storageKey: 'finados-invitacion-respuesta', badgeFile: 'gafete-lanzamiento-guaynaa.png',
    shareTitle: 'Lanzamiento Guaynaa', shareText: '¡Nos vemos en el Lanzamiento Guaynaa! #FinadosMushucRuna',
    confirmedMessage: 'Nos emociona contar contigo en el Lanzamiento Guaynaa. Te esperamos: prepárate para vivirlo y contarlo a tu manera.',
    pendingMessage: 'El equipo revisará tu registro y te escribirá por WhatsApp para confirmar tu lugar en el Lanzamiento Guaynaa.',
    declinedMessage: 'Gracias por avisarnos. Sigues en nuestro radar para lo que viene con SanFra y Finados Mushuc Runa. Si cambias de opinión, puedes volver a tu invitación.',
    defaultMessage: 'Gracias por responder a la invitación al Lanzamiento Guaynaa.',
    badgeHero: '/assets/finados/guaynaa-lanzamiento-hoy-1122.webp',
  }),
  inauguracion: Object.freeze({
    key: 'inauguracion', title: 'Inauguración Oficial de Finados Mushuc Runa', apiPrefix: '/invitacion/inauguracion', dressCode: '',
    paths: Object.freeze({
      personal: '/finados/invitacion/inauguracion/', personalShort: '/ii/',
      thanks: '/finados/invitacion/inauguracion/gracias/', badge: '/finados/invitacion/inauguracion/gafete/', verify: '/finados/invitacion/inauguracion/verificar/',
    }),
    storageKey: 'finados-invitacion-inauguracion-respuesta', badgeFile: 'gafete-inauguracion-finados-2026.png',
    shareTitle: 'Inauguración Oficial · Finados Mushuc Runa 2026', shareText: 'Nos encontramos en la Inauguración Oficial de Finados Mushuc Runa 2026. ¡Legado que nos une!',
    confirmedMessage: 'Nos honra contar contigo en la Inauguración Oficial de Finados Mushuc Runa. Te esperamos para abrir juntos esta edición 2026.',
    pendingMessage: 'El equipo revisará tu registro y te escribirá por WhatsApp para confirmar tu lugar en la Inauguración Oficial de Finados Mushuc Runa.',
    declinedMessage: 'Gracias por avisarnos. Esperamos encontrarnos contigo en otro momento de Finados Mushuc Runa 2026.',
    defaultMessage: 'Gracias por responder a la invitación a la Inauguración Oficial de Finados Mushuc Runa.',
    badgeHero: '',
  }),
});

export function invitationEvent(eventKey = 'guaynaa') {
  const event = INVITATION_EVENTS[eventKey];
  if (!event) throw new TypeError('Invitación no disponible.');
  return event;
}

export function invitationPaths(eventKey = 'guaynaa') {
  return { ...invitationEvent(eventKey).paths };
}

export function invitationStorageKey(eventKey = 'guaynaa') {
  return invitationEvent(eventKey).storageKey;
}

const INAUGURATION_NARRATIVES = Object.freeze({
  apoyo: Object.freeze({
    eyebrow: 'Una invitación personal',
    title: 'Hemos visto tu apoyo a Finados 2026.',
    lead: 'Queremos que estés en el momento que abre esta edición: la Inauguración Oficial de Finados Mushuc Runa.',
    story: 'Por primera vez abriremos la feria junto a quienes ya están ayudando a contarla. Tu presencia hará parte de este primer capítulo.',
  }),
  registro: Object.freeze({
    eyebrow: 'Una invitación personal',
    title: 'Te sumaste a Finados 2026.',
    lead: 'Queremos recibirte desde el inicio, en la Inauguración Oficial de Finados Mushuc Runa.',
    story: 'Cuando dijiste «aquí estoy», te volviste parte de las voces que mantienen viva esta tradición. Tu historia también empieza en esta apertura.',
  }),
});

export function inaugurationNarrative(variant = 'apoyo') {
  return { ...(INAUGURATION_NARRATIVES[variant] ?? INAUGURATION_NARRATIVES.apoyo) };
}

/** La API decide la variante real; ?variante= se admite únicamente en la vista previa administrativa. */
export function resolveInvitationVariant({ eventKey = 'guaynaa', search = '', apiVariant = '', preview = false } = {}) {
  if (eventKey !== 'inauguracion') return '';
  const requested = preview ? new URLSearchParams(search).get('variante') : apiVariant;
  return requested === 'registro' ? 'registro' : 'apoyo';
}

export function invitationRoleLabel(kind, eventKey = 'guaynaa') {
  if (eventKey === 'inauguracion') {
    if (kind === 'vocero') return 'VOCERO/A FINADOS 2026';
    if (kind === 'creador') return 'CREADOR/A DE CONTENIDO';
    return 'INVITADO/A FINADOS 2026';
  }
  return kind === 'nuevo' ? 'CREADOR INVITADO' : 'INVITADO ESPECIAL';
}

/** «2026-10-15» → «Jueves 15 de octubre de 2026», sin depender de la zona horaria del teléfono. */
export function eventDateLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return '';
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const label = `${DAYS[date.getUTCDay()]} ${day} de ${MONTHS[month - 1]} de ${year}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Partes breves para el bloque ceremonial «SAVE THE DATE», sin depender de la zona horaria. */
export function eventDateParts(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return { weekday: '', day: '', month: '' };
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return { weekday: SHORT_DAYS[date.getUTCDay()], day: String(day).padStart(2, '0'), month: SHORT_MONTHS[month - 1] };
}

export function eventTimeLabel(value) {
  return /^\d{2}:\d{2}$/.test(String(value ?? '')) ? `${value} · hora de Ecuador` : 'Hora por confirmar';
}

/** El código personal del enlace en ?c=: 10 letras y números (o los 32 caracteres de los primeros enlaces). */
const TOKEN = /^(?:[a-f0-9]{32}|[a-hjkmnp-z2-9]{10})$/;
export function invitationToken(search) {
  const token = new URLSearchParams(search).get('c') ?? '';
  return TOKEN.test(token) ? token : '';
}

/** «?vista=1»: el panel muestra el diseño con datos de muestra, sin abrir ni responder ninguna invitación. */
export function isPreview(search) {
  return new URLSearchParams(search).get('vista') === '1';
}
export const PREVIEW_NAME = 'Tu nombre';
const PREVIEW_ID = '0'.repeat(32);

export function responseMessage(response, name = '') {
  const who = name ? `${name}, ` : '';
  if (response === 'si') return `¡${who}te esperamos! Gracias por confirmar. Guardaremos un lugar para ti.`;
  if (response === 'no') return `Gracias por avisarnos${name ? `, ${name}` : ''}. Te vamos a extrañar; si cambias de opinión, vuelve a este enlace.`;
  return '';
}

/** Normaliza el formulario de nuevos creadores antes de enviarlo; devuelve el error a mostrar, si hay. */
export function validateOpenForm(values) {
  const data = {
    full_name: String(values.full_name ?? '').trim(),
    whatsapp: String(values.whatsapp ?? '').replace(/[\s().-]/g, ''),
    social_link: String(values.social_link ?? '').trim(),
    followers: String(values.followers ?? '').trim(),
    city: String(values.city ?? '').trim(),
    response: values.response,
    consent: values.consent === true,
  };
  if (data.full_name.length < 2) return { error: 'Escribe tu nombre y apellido.', field: 'full_name' };
  if (!/^\+?\d{9,15}$/.test(data.whatsapp)) return { error: 'Revisa tu número de WhatsApp (por ejemplo, 0987654321).', field: 'whatsapp' };
  if (!/^@?[A-Za-z0-9._]{2,40}$/.test(data.social_link) && !/^https:\/\/\S+$/.test(data.social_link)) return { error: 'Escribe tu usuario (@usuario) o el enlace https de tu cuenta.', field: 'social_link' };
  if (!/^\d{1,10}$/.test(data.followers)) return { error: 'Escribe cuántos seguidores tienes, solo con números.', field: 'followers' };
  if (data.city.length < 2) return { error: 'Escribe tu ciudad.', field: 'city' };
  if (!['si', 'no'].includes(data.response)) return { error: 'Cuéntanos si asistirás.', field: 'response' };
  if (!data.consent) return { error: 'Marca la autorización para poder registrar tu confirmación.', field: 'consent' };
  return { data: { ...data, followers: Number(data.followers) } };
}

export const THANKS_PATH = INVITATION_EVENTS.guaynaa.paths.thanks;

/** Lo que dice la pantalla de gracias según quién respondió y qué respondió. */
export function thanksContent({ kind, name = '', response, badge = false } = {}, eventKey = 'guaynaa') {
  const invitation = invitationEvent(eventKey);
  const first = String(name).trim().split(/\s+/)[0] ?? '';
  const hello = first ? `, ${first}` : '';
  const confirmed = kind === 'creador' || badge === true;
  if (response === 'si' && confirmed) return {
    eyebrow: 'Asistencia confirmada', title: `¡Gracias${hello}!`, subtitle: 'Tu lugar está confirmado.',
    message: invitation.confirmedMessage, perks: true,
  };
  if (response === 'si') return {
    eyebrow: 'Registro recibido', title: `¡Gracias${hello}!`, subtitle: 'Recibimos tu confirmación.',
    message: invitation.pendingMessage, perks: true,
  };
  if (response === 'no') return {
    eyebrow: 'Respuesta recibida', title: `Gracias${hello}`, subtitle: 'Te vamos a extrañar.',
    message: invitation.declinedMessage, perks: false,
  };
  return { eyebrow: 'Confirmación', title: '¡Gracias!', subtitle: 'Tu respuesta quedó registrada.', message: invitation.defaultMessage, perks: true };
}

/** La respuesta viaja a la pantalla de gracias dentro de la pestaña, nunca en la dirección. */
function rememberAnswer(eventKey, answer) {
  try { sessionStorage.setItem(invitationStorageKey(eventKey), JSON.stringify(answer)); } catch { /* sin almacenamiento: la pantalla muestra un gracias general */ }
}

function readAnswer(eventKey) {
  try { return JSON.parse(sessionStorage.getItem(invitationStorageKey(eventKey)) ?? 'null'); } catch { return null; }
}

export function createInvitationClient(baseUrl = API, fetchImplementation = globalThis.fetch, eventKey = 'guaynaa') {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  const invitation = invitationEvent(eventKey);
  async function request(resource, body) {
    if (!/^(?:evento|nuevo|(?:c|gafete)\/(?:[a-f0-9]{32}|[a-hjkmnp-z2-9]{10})|verificar\/[a-f0-9]{32})$/.test(resource)) throw new Error('Ruta de API no permitida.');
    const path = `${invitation.apiPrefix}/${resource}`;
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { const error = new Error('No se pudo conectar. Revisa tu conexión e intenta de nuevo.'); error.status = 0; throw error; }
    let data = null;
    try { data = await response.json(); } catch { /* respuesta vacía */ }
    if (!response.ok) {
      const error = new Error(({
        404: 'Este enlace de invitación no está disponible. Escríbenos para enviarte uno nuevo.',
        410: 'El plazo para confirmar terminó el lunes 26 de octubre a las 9:00. Si necesitas ayuda, escríbenos.',
        422: 'Revisa los datos e intenta de nuevo.',
        429: 'Recibimos varios registros seguidos. Espera unos minutos e intenta de nuevo.',
      })[response.status] ?? 'No se pudo completar. Intenta de nuevo en un momento.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  return {
    event: () => request('evento'),
    open: token => request(`c/${token}`),
    respond: (token, response) => request(`c/${token}`, { response }),
    register: body => request('nuevo', body),
    badge: token => request(`gafete/${token}`),
    verify: id => request(`verificar/${id}`),
  };
}

export const DRESS_CODE = INVITATION_EVENTS.guaynaa.dressCode;

function paintEvent(event) {
  if (!event) return;
  const set = (selector, text) => { if (text) for (const node of document.querySelectorAll(selector)) node.textContent = text; };
  const dateParts = eventDateParts(event.date);
  set('[data-event-title]', event.title);
  set('[data-event-date]', eventDateLabel(event.date));
  set('[data-event-weekday]', dateParts.weekday);
  set('[data-event-day]', dateParts.day);
  set('[data-event-month]', dateParts.month);
  set('[data-event-time]', eventTimeLabel(event.time));
  set('[data-event-time-short]', /^\d{2}:\d{2}$/.test(String(event.time ?? '')) ? event.time : 'Por confirmar');
  set('[data-event-place]', event.place);
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(event.date ?? ''))) {
    for (const node of document.querySelectorAll('time[data-event-date]')) node.dateTime = event.date;
  }
  if (event.place) for (const map of document.querySelectorAll('[data-event-map]')) map.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.place)}`;
  const details = document.querySelector('[data-event-details]');
  if (details) { details.textContent = event.details ?? ''; details.hidden = !event.details; }
}

function paintOpeningNarrative(eventKey, variant) {
  if (eventKey !== 'inauguracion') return;
  const content = inaugurationNarrative(variant);
  for (const [key, value] of Object.entries(content)) {
    const node = document.querySelector(`[data-opening-${key}]`);
    if (node) node.textContent = value;
  }
  // Solo quien todavía no subió su video (versión «registro») ve la invitación a grabarlo.
  for (const node of document.querySelectorAll('[data-opening-video]')) node.hidden = variant !== 'registro';
}

/** Días, horas, minutos y segundos que faltan para el cierre; closed cuando ya pasó. */
export function deadlineParts(deadline, now = Date.now()) {
  const end = Date.parse(deadline);
  if (Number.isNaN(end)) return null;
  const left = Math.max(0, Math.floor((end - now) / 1000));
  return { closed: left === 0, days: Math.floor(left / 86400), hours: Math.floor(left / 3600) % 24, minutes: Math.floor(left / 60) % 60, seconds: left % 60 };
}

/** Contador del plazo para confirmar. Al llegar a cero cierra los botones; el servidor también rechaza respuestas tardías. */
function startDeadline(onClose = () => {}) {
  const box = document.querySelector('[data-deadline]');
  if (!box) return { closed: () => false, close: () => {} };
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    box.dataset.closed = 'true';
    box.querySelector('[data-deadline-label]').textContent = 'El plazo para confirmar terminó el';
    box.querySelector('[data-deadline-clock]').hidden = true;
    box.querySelector('[data-deadline-note]').textContent = 'Ya cerramos el listado de invitados. Gracias por tu interés en acompañarnos.';
    const inline = document.querySelector('[data-deadline-inline]');
    if (inline) inline.innerHTML = 'El plazo para confirmar terminó el <strong>lunes 26 de octubre a las 9:00</strong>.';
    onClose();
  };
  const two = value => String(value).padStart(2, '0');
  const tick = () => {
    const parts = deadlineParts(box.dataset.deadlineAt);
    if (!parts) return;
    if (parts.closed) { close(); return; }
    box.querySelector('[data-deadline-days]').textContent = String(parts.days);
    box.querySelector('[data-deadline-hours]').textContent = two(parts.hours);
    box.querySelector('[data-deadline-minutes]').textContent = two(parts.minutes);
    box.querySelector('[data-deadline-seconds]').textContent = two(parts.seconds);
    box.dataset.urgent = String(parts.days === 0);
  };
  const timer = setInterval(tick, 1000);
  tick();
  return { closed: () => closed, close };
}

/** Enlace único para voceros: la API de voceros (solo estas rutas) y el código de su invitación personal. */
export function createVoceroGateClient(baseUrl = API, fetchImplementation = globalThis.fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  let csrf = '';
  async function request(path, body) {
    if (!['/vocero/auth/session', '/vocero/auth/login', '/vocero/inauguracion'].includes(path)) throw new Error('Ruta de API no permitida.');
    const headers = { Accept: 'application/json' };
    if (body !== undefined) { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = csrf; }
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { const error = new Error('No se pudo conectar. Revisa tu conexión e intenta de nuevo.'); error.status = 0; throw error; }
    let data = null;
    try { data = await response.json(); } catch { /* sin cuerpo */ }
    if (typeof data?.csrf === 'string') csrf = data.csrf;
    if (!response.ok) {
      const error = new Error(({
        401: path === '/vocero/auth/login' ? 'El correo o la contraseña no coinciden. Revisa e intenta de nuevo.' : 'Inicia sesión para ver tu invitación.',
        404: 'No encontramos tu invitación con esta cuenta. Escríbele a la coordinación de voceros para que te ayude.',
        422: 'Escribe tu correo y tu contraseña.',
        429: 'Hay demasiados intentos. Espera 15 minutos antes de volver a intentar.',
      })[response.status] ?? 'No se pudo completar. Intenta de nuevo en un momento.');
      error.status = response.status;
      error.code = typeof data?.code === 'string' ? data.code : '';
      throw error;
    }
    return data;
  }
  return {
    session: () => request('/vocero/auth/session'),
    login: (email, password) => request('/vocero/auth/login', { email, password }),
    invitation: () => request('/vocero/inauguracion'),
  };
}

async function startVoceroGate(base) {
  startDeadline();
  const form = document.querySelector('[data-gate-form]');
  const fields = form.querySelector('fieldset');
  const status = form.querySelector('[data-status]');
  const client = createVoceroGateClient(base);
  const say = (text, error = false) => { status.textContent = text; status.dataset.error = String(error); };
  const missing = document.querySelector('[data-gate-missing]');
  const handle = error => {
    if (error.code === 'profile_missing') { form.hidden = true; missing.hidden = false; return; }
    say(error.status === 401 ? '' : error.message, error.status !== 401);
    fields.disabled = false;
  };
  const openInvitation = async () => {
    say('Abriendo tu invitación…');
    const data = await client.invitation();
    if (!/^(?:[a-f0-9]{32}|[a-hjkmnp-z2-9]{10})$/.test(String(data?.token ?? ''))) throw new Error('No se pudo abrir tu invitación.');
    location.replace(`${invitationPaths('inauguracion').personalShort}?c=${data.token}`);
  };
  try {
    const session = await client.session();
    if (session?.authenticated && session.user?.role === 'vocero') { await openInvitation(); return; }
    fields.disabled = false;
    say('');
  } catch (error) { handle(error); }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    if (!email || !password) { say('Escribe tu correo y tu contraseña.', true); return; }
    fields.disabled = true;
    say('Iniciando sesión…');
    try {
      const result = await client.login(email, password);
      if (result?.authenticated !== true || result.user?.role !== 'vocero') throw Object.assign(new Error('El correo o la contraseña no coinciden. Revisa e intenta de nuevo.'), { status: 401 });
      await openInvitation();
    } catch (error) { if (error.status === 401) { say(error.message, true); fields.disabled = false; } else handle(error); }
  });
}

async function startPersonal(client, eventKey = 'guaynaa') {
  const paths = invitationPaths(eventKey);
  const status = document.querySelector('[data-status]');
  const choices = document.querySelector('[data-choices]');
  const buttons = [...choices.querySelectorAll('[data-answer]')];
  const deadline = startDeadline(() => {
    choices.hidden = true;
    status.textContent = 'El plazo para confirmar terminó. Si ya confirmaste, tu lugar sigue reservado.';
    status.dataset.error = 'false';
    for (const link of document.querySelectorAll('.inv-change a[href="#respuesta"]')) link.hidden = true;
  });
  if (isPreview(location.search)) {
    paintOpeningNarrative(eventKey, resolveInvitationVariant({ eventKey, search: location.search, preview: true }));
    client.event().then(data => paintEvent(data?.event)).catch(() => {});
    document.querySelector('[data-guest-name]').textContent = `${PREVIEW_NAME},`;
    buttons.forEach(button => { button.disabled = true; });
    choices.hidden = false;
    status.textContent = 'Vista previa: cada invitado ve aquí su propio nombre.';
    return;
  }
  const token = invitationToken(location.search);
  if (!token) { status.textContent = 'Este enlace está incompleto. Ábrelo tal como te lo enviamos.'; status.dataset.error = 'true'; return; }
  let name = '';
  const mark = response => {
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.answer === response));
    status.textContent = responseMessage(response, name) || 'Elige una opción. Puedes cambiarla después desde este mismo enlace.';
    status.dataset.error = 'false';
  };
  try {
    const data = await client.open(token);
    paintEvent(data.event);
    paintOpeningNarrative(eventKey, resolveInvitationVariant({ eventKey, apiVariant: data.guest.message_variant }));
    name = data.guest.name;
    const nameNode = document.querySelector('[data-guest-name]');
    nameNode.textContent = `${name},`;
    const roleNode = document.querySelector('[data-guest-role]');
    if (roleNode) roleNode.textContent = invitationRoleLabel(data.guest.kind, eventKey);
    document.title = `${name}, te invitamos | Finados Mushuc Runa 2026`;
    choices.hidden = false;
    mark(data.guest.response);
    if (data.event?.rsvp_closed === true) deadline.close();
    else if (deadline.closed()) choices.hidden = true;
    const badgeLink = document.querySelector('[data-badge-link]');
    if (badgeLink && data.guest.badge) { badgeLink.querySelector('a').href = badgePath(token, eventKey); badgeLink.hidden = false; }
    if (data.guest.response === 'si') showConfirmed(client, token, data, eventKey);
  } catch (error) { status.textContent = error.message; status.dataset.error = 'true'; return; }
  for (const button of buttons) {
    button.addEventListener('click', async () => {
      buttons.forEach(item => { item.disabled = true; });
      status.textContent = 'Guardando tu respuesta…';
      try {
        const data = await client.respond(token, button.dataset.answer);
        rememberAnswer(eventKey, { kind: data.guest.kind ?? 'creador', name: data.guest.name, response: data.guest.response, token, badge: data.guest.badge === true });
        if (eventKey === 'guaynaa') location.assign(THANKS_PATH);
        else location.assign(paths.thanks);
      } catch (error) {
        if (error.status === 410) { deadline.close(); status.textContent = error.message; return; }
        status.textContent = error.message; status.dataset.error = 'true';
        buttons.forEach(item => { item.disabled = false; });
      }
    });
  }
}

/** Quien ya confirmó ve primero su confirmación, los datos del evento y su gafete listo para descargar. */
async function showConfirmed(client, token, data, eventKey = 'guaynaa') {
  const card = document.querySelector('[data-confirmed]');
  if (!card) return;
  const first = String(data.guest.name ?? '').trim().split(/\s+/)[0] ?? '';
  card.querySelector('[data-confirmed-name]').textContent = first ? `¡${first}, ya confirmaste!` : '¡Ya confirmaste!';
  document.querySelector('main')?.prepend(card);
  card.hidden = false;
  document.body.dataset.celebrate = 'true';
  if (!data.guest.badge) { card.querySelector('[data-confirmed-pending]').hidden = false; return; }
  const box = card.querySelector('[data-confirmed-badge]');
  box.hidden = false;
  try {
    const badge = await client.badge(token);
    if (!badge.ready) { box.hidden = true; card.querySelector('[data-confirmed-pending]').hidden = false; return; }
    await mountBadge(badge, {
      status: box.querySelector('[data-confirmed-status]'), preview: box.querySelector('[data-confirmed-preview]'), actions: box.querySelector('[data-confirmed-actions]'),
      download: box.querySelector('[data-confirmed-download]'), share: box.querySelector('[data-confirmed-share]'),
    }, eventKey);
  } catch (error) {
    const status = box.querySelector('[data-confirmed-status]');
    status.textContent = error.message || 'No se pudo preparar el gafete.'; status.dataset.error = 'true';
  }
}

async function startOpen(client, eventKey = 'guaynaa') {
  const paths = invitationPaths(eventKey);
  client.event().then(data => paintEvent(data?.event)).catch(() => {});
  const form = document.querySelector('[data-open-form]');
  const status = form.querySelector('[data-status]');
  if (isPreview(location.search)) {
    form.querySelector('button[type="submit"]').disabled = true;
    status.textContent = 'Vista previa: el formulario no envía datos.';
    return;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form));
    values.consent = form.elements.consent.checked;
    const checked = validateOpenForm(values);
    if (checked.error) {
      status.textContent = checked.error; status.dataset.error = 'true';
      const field = form.elements[checked.field];
      (field?.length ? field[0] : field)?.focus();
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    status.textContent = 'Enviando tu confirmación…'; status.dataset.error = 'false';
    try {
      const data = await client.register(checked.data);
      rememberAnswer(eventKey, { kind: 'nuevo', name: data.guest.name, response: data.guest.response });
      if (eventKey === 'guaynaa') location.assign(THANKS_PATH);
      else location.assign(paths.thanks);
    } catch (error) {
      status.textContent = error.message; status.dataset.error = 'true';
      submit.disabled = false;
    }
  });
}

function startThanks(client, eventKey = 'guaynaa') {
  const invitation = invitationEvent(eventKey);
  const paths = invitationPaths(eventKey);
  const answer = isPreview(location.search) ? { kind: 'creador', name: PREVIEW_NAME, response: 'si' } : readAnswer(eventKey) ?? {};
  const content = thanksContent(answer, eventKey);
  const set = (selector, text) => { const node = document.querySelector(selector); if (node) node.textContent = text; };
  set('[data-thanks-eyebrow]', content.eyebrow);
  set('[data-thanks-title]', content.title);
  set('[data-thanks-subtitle]', content.subtitle);
  set('[data-thanks-message]', content.message);
  document.querySelector('[data-thanks-perks]').hidden = !content.perks;
  document.title = `${content.title} | ${invitation.title}`;
  if (answer.response === 'si') document.body.dataset.celebrate = 'true';
  const badgeBox = document.querySelector('[data-thanks-badge]');
  if (answer.badge && TOKEN.test(answer.token ?? '')) { badgeBox.querySelector('[data-thanks-badge-link]').href = badgePath(answer.token, eventKey); badgeBox.hidden = false; }
  const back = document.querySelector('[data-thanks-back]');
  if (TOKEN.test(answer.token ?? '')) { back.href = `${paths.personalShort}?c=${answer.token}`; back.hidden = false; }
  else if (answer.kind === 'nuevo' && paths.open) { back.href = paths.open; back.hidden = false; }
  client.event().then(data => paintEvent(data?.event)).catch(() => {});
}

export function badgePath(token, eventKey = 'guaynaa') {
  return `${invitationPaths(eventKey).badge}?c=${encodeURIComponent(token)}`;
}

/** El QR del gafete lleva a la validación de esa persona, en el mismo sitio donde se abrió. */
export function badgeVerificationUrl(publicId, siteOrigin = PRIMARY_SITE_ORIGIN, eventKey = 'guaynaa') {
  if (!/^[a-f0-9]{32}$/.test(String(publicId ?? ''))) throw new TypeError('Identificador inválido.');
  const origin = isAllowedSiteOrigin(siteOrigin) ? siteOrigin : PRIMARY_SITE_ORIGIN;
  return `${origin}${invitationPaths(eventKey).verify}?id=${publicId}`;
}

/** Lo que muestra la puerta al escanear. */
export function describeVerification(verification = {}) {
  const valid = verification.valid === true;
  let state = 'Invitación válida ✓';
  if (!valid) state = verification.retired ? 'Invitación retirada' : verification.response !== 'si' ? 'No confirmó asistencia' : 'Pendiente de aprobación';
  return { valid, state, name: String(verification.name ?? '').slice(0, 160) || '—', kind: String(verification.kind ?? ''), social: String(verification.social_link ?? '') };
}

function qrMatrix(value) {
  const code = qrcode(0, 'M');
  code.addData(value, 'Byte');
  code.make();
  const size = code.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => code.isDark(row, column)));
}

function loadImage(source) {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = source; });
}

/** Gafete en formato historia (1080 × 1920): el arte del lanzamiento, el nombre y un QR único. */
export async function influencerBadgeBlob(guest, event, siteOrigin, eventKey = 'guaynaa') {
  const invitation = invitationEvent(eventKey);
  const inauguration = eventKey === 'inauguracion';
  if (!globalThis.document?.createElement) return null;
  const matrix = qrMatrix(badgeVerificationUrl(guest.public_id, siteOrigin, eventKey));
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const W = canvas.width, H = canvas.height;
  const round = (x, y, width, height, radius) => { context.beginPath(); if (context.roundRect) context.roundRect(x, y, width, height, radius); else context.rect(x, y, width, height); };
  try { await Promise.all(['900 80px Inter', '800 30px Inter', '600 30px Inter', '400 90px Anton', 'italic 400 54px DM Serif Display'].map(font => document.fonts?.load(font))); } catch { /* fuente de respaldo */ }
  const [poster, finados] = await Promise.all([
    invitation.badgeHero ? loadImage(invitation.badgeHero).catch(() => null) : null,
    loadImage('/assets/finados/logo-finados.svg').catch(() => null),
  ]);
  if (inauguration) {
    context.fillStyle = '#f6ecda'; context.fillRect(0, 0, W, H);
    const colors = ['#ff2b86', '#ffc43d', '#00c8cc', '#6b2de1'];
    for (let x = 0, index = 0; x < W; x += 54, index += 1) { context.fillStyle = colors[index % colors.length]; context.fillRect(x, 0, 54, 42); }
    context.fillStyle = '#ffdb83';
    context.beginPath(); context.moveTo(38, 445); context.quadraticCurveTo(350, 115, 760, 110); context.quadraticCurveTo(1080, 180, 1030, 540); context.quadraticCurveTo(785, 685, 505, 590); context.quadraticCurveTo(220, 760, 38, 445); context.fill();
    context.strokeStyle = 'rgba(107,45,225,.14)'; context.lineWidth = 72; context.beginPath(); context.ellipse(540, 1750, 470, 610, -.15, 0, Math.PI * 2); context.stroke();
    if (finados) {
      const width = 430, height = width * finados.height / finados.width;
      context.save();
      context.filter = 'brightness(0) saturate(100%) invert(18%) sepia(65%) saturate(3515%) hue-rotate(255deg) brightness(77%) contrast(109%)';
      context.drawImage(finados, (W - width) / 2, 170, width, height);
      context.restore();
    }
    context.textAlign = 'center'; context.fillStyle = '#4921ad'; context.font = '400 48px Anton, sans-serif'; context.fillText('TE INVITAMOS A LA', W / 2, 620);
    context.fillStyle = '#ff2b86'; context.font = '400 78px Anton, sans-serif'; context.fillText('INAUGURACIÓN OFICIAL', W / 2, 702);
    context.fillStyle = '#6b2de1'; context.font = '400 112px Anton, sans-serif'; context.fillText(/^[0-9]{2}:[0-9]{2}$/.test(event?.time ?? '') ? event.time : '12:00', W / 2, 855);
    context.fillStyle = '#ff2b86'; context.font = 'italic 400 42px DM Serif Display, Georgia, serif'; context.fillText('EN PUNTO', W / 2, 908);
  } else {
    context.fillStyle = '#0e0916'; context.fillRect(0, 0, W, H);
    if (poster) { const height = W * poster.height / poster.width; context.drawImage(poster, 0, 0, W, height); }
    const fade = context.createLinearGradient(0, 980, 0, 1400);
    fade.addColorStop(0, 'rgba(14, 9, 22, 0)'); fade.addColorStop(1, 'rgba(14, 9, 22, 1)');
    context.fillStyle = fade; context.fillRect(0, 980, W, 940);
    const glow = context.createRadialGradient(W / 2, H, 50, W / 2, H, 900);
    glow.addColorStop(0, 'rgba(139, 92, 246, .45)'); glow.addColorStop(1, 'rgba(139, 92, 246, 0)');
    context.fillStyle = glow; context.fillRect(0, 1100, W, 820);
  }

  // Panel con el nombre, los datos y el QR. Guaynaa conserva su vidrio; Inauguración usa marfil y offset turquesa.
  const panel = inauguration ? { x: 56, y: 1010, width: W - 112, height: 700 } : { x: 56, y: 1170, width: W - 112, height: 590 };
  if (inauguration) { context.fillStyle = '#00c8cc'; round(panel.x + 16, panel.y + 18, panel.width, panel.height, 12); context.fill(); }
  context.fillStyle = inauguration ? '#fff7e9' : 'rgba(35, 24, 51, .94)'; round(panel.x, panel.y, panel.width, panel.height, inauguration ? 12 : 40); context.fill();
  context.strokeStyle = inauguration ? '#6b2de1' : 'rgba(196, 170, 255, .55)'; context.lineWidth = inauguration ? 5 : 3; round(panel.x, panel.y, panel.width, panel.height, inauguration ? 12 : 40); context.stroke();
  const left = panel.x + 48, textWidth = panel.width - 48 - 330;
  context.textAlign = 'left'; context.textBaseline = 'alphabetic';
  context.fillStyle = inauguration ? '#6b2de1' : '#b892ff'; context.font = inauguration ? 'italic 400 31px DM Serif Display, Georgia, serif' : '800 26px Inter, Arial, sans-serif';
  context.fillText(invitationRoleLabel(guest.kind, eventKey), left, panel.y + 76);
  const name = String(guest.name ?? '').trim().slice(0, 60);
  const words = name.split(/\s+/);
  let size = 76; const lines = [];
  for (; size >= 44; size -= 4) {
    context.font = `900 ${size}px Inter, Arial, sans-serif`;
    lines.length = 0; let line = '';
    for (const word of words) { const next = line ? `${line} ${word}` : word; if (context.measureText(next).width <= textWidth || !line) line = next; else { lines.push(line); line = word; } }
    lines.push(line);
    if (lines.length <= 2 && lines.every(text => context.measureText(text).width <= textWidth)) break;
  }
  context.fillStyle = inauguration ? '#ff2b86' : '#ffffff';
  lines.slice(0, 2).forEach((text, index) => context.fillText(text, left, panel.y + 156 + index * (size + 8)));
  const infoY = panel.y + 156 + Math.min(lines.length, 2) * (size + 8) + 30;
  context.fillStyle = inauguration ? '#4921ad' : '#d9c8ff'; context.font = inauguration ? '400 28px Anton, sans-serif' : '800 30px Inter, Arial, sans-serif';
  context.fillText(inauguration ? 'INAUGURACIÓN OFICIAL · FINADOS 2026' : String(event?.title ?? invitation.title).toUpperCase(), left, infoY);
  context.font = '600 28px Inter, Arial, sans-serif'; context.fillStyle = inauguration ? '#4921ad' : '#ece6f7';
  const when = [eventDateLabel(event?.date), /^\d{2}:\d{2}$/.test(event?.time ?? '') ? event.time : ''].filter(Boolean).join(' · ');
  if (when) context.fillText(when, left, infoY + 46);
  const place = String(event?.place ?? '').split(',').slice(0, 2).join(',').trim();
  if (place) { let text = place; while (context.measureText(text).width > textWidth && text.length > 10) text = `${text.slice(0, -2)}…`; context.fillText(text, left, infoY + 88); }
  if (invitation.dressCode) {
    context.font = '800 28px Inter, Arial, sans-serif'; context.fillStyle = '#ffffff';
    context.fillText(`DRESS CODE: ${invitation.dressCode.toUpperCase()}`, left, infoY + 134);
  }
  context.font = '600 22px Inter, Arial, sans-serif'; context.fillStyle = inauguration ? '#6e527f' : '#b9aecb';
  context.fillText('Presenta este QR en la entrada', left, panel.y + panel.height - 44);
  const qrSize = 270, qrX = panel.x + panel.width - qrSize - 48, qrY = panel.y + (panel.height - qrSize) / 2;
  context.fillStyle = '#ffffff'; round(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, inauguration ? 8 : 22); context.fill();
  const quiet = 1, cell = qrSize / (matrix.length + quiet * 2);
  context.fillStyle = '#150d22';
  for (let row = 0; row < matrix.length; row += 1) for (let column = 0; column < matrix.length; column += 1) {
    if (matrix[row][column]) context.fillRect(qrX + (column + quiet) * cell, qrY + (row + quiet) * cell, cell + .4, cell + .4);
  }
  if (inauguration) {
    context.textAlign = 'center'; context.fillStyle = '#ff2b86'; context.font = '800 28px Inter, Arial, sans-serif'; context.fillText('AB. LUIS ALFONSO CHANGO', W / 2, 1810);
    context.fillStyle = '#4921ad'; context.font = '800 20px Inter, Arial, sans-serif'; context.fillText('MENTALIZADOR FERIA FINADOS MUSHUC RUNA', W / 2, 1846);
  } else if (finados) {
    const width = 190, height = width * finados.height / finados.width; context.drawImage(finados, (W - width) / 2, H - height - 34, width, height);
  }
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function startBadge(client, eventKey = 'guaynaa') {
  const status = document.querySelector('[data-status]');
  const elements = () => ({
    status, preview: document.querySelector('[data-badge-preview]'), actions: document.querySelector('[data-badge-actions]'),
    download: document.querySelector('[data-badge-download]'), share: document.querySelector('[data-badge-share]'),
  });
  if (isPreview(location.search)) {
    const event = await client.event().then(data => data?.event).catch(() => null);
    document.querySelector('[data-badge-name]').textContent = PREVIEW_NAME;
    await mountBadge({ guest: { name: PREVIEW_NAME, kind: 'creador', public_id: PREVIEW_ID }, event }, elements(), eventKey);
    status.textContent = 'Vista previa: el QR de muestra no corresponde a ningún invitado.';
    return;
  }
  const token = invitationToken(location.search);
  if (!token) { status.textContent = 'Este enlace está incompleto. Ábrelo tal como te lo enviamos.'; status.dataset.error = 'true'; return; }
  let data;
  try { data = await client.badge(token); } catch (error) { status.textContent = error.message; status.dataset.error = 'true'; return; }
  document.querySelector('[data-badge-name]').textContent = data.guest.name;
  if (!data.ready) {
    status.textContent = data.reason === 'respuesta'
      ? 'Tu gafete aparece cuando confirmas que asistirás. Vuelve a tu invitación y elige «Sí, ahí estaré».'
      : 'Recibimos tu confirmación. Tu gafete estará listo cuando el equipo confirme tu lugar; te avisaremos por WhatsApp.';
    return;
  }
  await mountBadge(data, elements(), eventKey);
}

/** Dibuja el gafete y conecta sus botones de descargar y compartir. */
async function mountBadge(data, { status, preview, actions, download: downloadButton, share }, eventKey = 'guaynaa') {
  const invitation = invitationEvent(eventKey);
  let file = null, url = '';
  try {
    const blob = await influencerBadgeBlob(data.guest, data.event, resolveRuntimeOrigins(location).siteOrigin, eventKey);
    if (!blob) throw new Error();
    url = URL.createObjectURL(blob);
    file = new File([blob], invitation.badgeFile, { type: 'image/png' });
    preview.src = url; preview.hidden = false; actions.hidden = false;
    status.textContent = '¡Listo! Descárgalo y llévalo en tu teléfono.'; status.dataset.error = 'false';
  } catch { status.textContent = 'No se pudo preparar el gafete. Recarga la página para intentarlo de nuevo.'; status.dataset.error = 'true'; return; }
  const download = () => { const link = Object.assign(document.createElement('a'), { href: url, download: invitation.badgeFile }); document.body.append(link); link.click(); link.remove(); };
  downloadButton.addEventListener('click', download);
  share.addEventListener('click', async () => {
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: invitation.shareTitle, text: invitation.shareText, files: [file] });
      else { download(); status.textContent = 'Tu teléfono descargó el gafete para que lo compartas.'; }
    } catch (error) { if (error?.name !== 'AbortError') status.textContent = 'No se pudo compartir. Descarga el gafete y súbelo desde tu red social.'; }
  });
}

async function startVerify(client) {
  const status = document.querySelector('[data-status]');
  const result = document.querySelector('[data-verify-result]');
  const id = new URLSearchParams(location.search).get('id') ?? '';
  try {
    const preview = isPreview(location.search);
    if (!preview && !/^[a-f0-9]{32}$/.test(id)) throw new Error('Este código no es un gafete válido.');
    const verification = preview ? { valid: true, name: PREVIEW_NAME, kind: 'Creador invitado', social_link: '@tu_usuario' } : (await client.verify(id)).verification;
    const view = describeVerification(verification);
    document.querySelector('[data-verify-state]').textContent = view.state;
    document.querySelector('[data-verify-name]').textContent = view.name;
    document.querySelector('[data-verify-kind]').textContent = view.kind;
    document.querySelector('[data-verify-social]').textContent = view.social;
    result.dataset.valid = String(view.valid);
    result.hidden = false;
    status.textContent = view.valid ? 'Gafete confirmado.' : 'Este gafete no está vigente.';
  } catch (error) { status.textContent = error.status === 404 ? 'Este gafete no existe.' : error.message; status.dataset.error = 'true'; }
}

const MEDIA_TYPE_LABELS = Object.freeze({ radio: 'Radio', tv: 'Televisión', prensa: 'Prensa escrita', digital: 'Medio digital', redes: 'Redes sociales' });
const fold = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Medios que coinciden con lo escrito (nombre o ciudad, sin importar tildes); primero los que empiezan con el texto. */
export function filterMedia(list, text, limit = 8) {
  const query = fold(text);
  if (query.length < 2) return [];
  const words = query.split(/\s+/);
  return list
    .map(item => ({ item, name: fold(item.media_name), city: fold(item.city) }))
    .filter(entry => words.every(word => entry.name.includes(word) || entry.city.includes(word)))
    .sort((a, b) => Number(!b.name.startsWith(query)) - Number(!a.name.startsWith(query)) || a.name.localeCompare(b.name))
    .slice(0, limit).map(entry => entry.item);
}

export function mediaOptionLabel(item) {
  const types = (item.media_types ?? []).map(type => MEDIA_TYPE_LABELS[type]).filter(Boolean).join(', ');
  return [item.media_name, [item.city, types].filter(Boolean).join(' · ')].filter(Boolean).join(' — ');
}

/** Lo que se envía al confirmar sin cuenta, o el primer error a corregir. */
export function mediaRsvpPayload(values) {
  const media = values.media ?? '';
  const newName = String(values.new_media_name ?? '').trim();
  if (!media && newName.length < 2) return { error: 'Escribe el nombre de tu medio y elígelo de la lista.' };
  if (!media && !MEDIA_TYPE_LABELS[values.new_media_type]) return { error: 'Elige el tipo de tu medio.' };
  if (!['yes', 'no'].includes(values.answer)) return { error: 'Cuéntanos si tu medio asistirá.' };
  const base = { event: values.event, media, new_media_name: media ? '' : newName, new_media_type: media ? '' : values.new_media_type, answer: values.answer };
  if (values.answer === 'no') return { payload: base };
  const stream = values.live_stream;
  if (!['yes', 'no', 'recorded'].includes(stream)) return { error: 'Cuéntanos si transmitirán en vivo.' };
  const channels = (values.channels ?? []).map(channel => ({ platform: channel.platform, url: String(channel.url ?? '').trim() }));
  const detail = String(values.live_detail ?? '').trim();
  if (stream === 'yes') {
    if (!channels.length) return { error: 'Marca al menos una plataforma donde transmitirán.' };
    for (const channel of channels) {
      const broadcast = ['radio', 'tv'].includes(channel.platform);
      if (!broadcast && !/^https:\/\/\S+$/.test(channel.url)) return { error: 'Pega el enlace (https://…) de la página o el canal donde transmitirán.' };
      if (broadcast && channel.url && !/^https:\/\/\S+$/.test(channel.url)) return { error: 'El enlace de radio o TV debe empezar con https://, o déjalo vacío.' };
    }
    if (channels.some(channel => ['radio', 'tv'].includes(channel.platform)) && detail.length < 2) return { error: 'Escribe la frecuencia o el canal y el nombre del programa.' };
  }
  const name = String(values.contact_name ?? '').trim();
  const phone = String(values.contact_phone ?? '').trim();
  if (name.length < 3) return { error: 'Escribe el nombre de la persona responsable del medio ese día.' };
  if (!/^\+?[0-9][0-9 ()-]{6,23}$/.test(phone)) return { error: 'Escribe el WhatsApp de la persona responsable (por ejemplo, 0991234567).' };
  if (values.conditions !== true) return { error: 'Acepta las condiciones de cobertura para confirmar.' };
  return { payload: { ...base, live_stream: stream, live_channels: stream === 'yes' ? channels : [], live_detail: stream === 'yes' ? detail : '', contact_name: name, contact_phone: phone, conditions: true } };
}

/** Confirmación directa de medios: una sola ruta pública, sin sesión ni cookies. */
export function createMediaRsvpClient(baseUrl = API, fetchImplementation = globalThis.fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  async function request(body) {
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}/media/rsvp`, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { const error = new Error('No se pudo conectar. Revisa tu conexión e intenta de nuevo.'); error.status = 0; throw error; }
    let data = null;
    try { data = await response.json(); } catch { /* sin cuerpo */ }
    if (!response.ok) {
      const error = new Error(({
        404: 'No encontramos ese medio o el evento. Recarga la página e intenta de nuevo.',
        410: 'El plazo para confirmar la asistencia ya terminó.',
        422: 'Revisa los datos e intenta de nuevo.',
        429: 'Se enviaron demasiadas confirmaciones desde este equipo. Espera un momento e intenta de nuevo.',
      })[response.status] ?? 'No se pudo enviar. Intenta de nuevo en un momento.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  return { context: () => request(), send: payload => request(payload) };
}

async function startMediaRsvp(base) {
  const form = document.querySelector('[data-media-rsvp]');
  if (!form) { startDeadline(); return; }
  const fields = form.querySelector('fieldset');
  const status = form.querySelector('[data-status]');
  const search = form.querySelector('[data-media-search]');
  const options = form.querySelector('[data-media-options]');
  const picked = form.querySelector('[data-media-picked]');
  const fresh = form.querySelector('[data-media-new]');
  const yesBox = form.querySelector('[data-media-yes]');
  const channelsBox = form.querySelector('[data-media-channels]');
  const done = document.querySelector('[data-media-done]');
  const say = (text, error = false) => { status.textContent = text; status.dataset.error = String(error); };
  const deadline = startDeadline(() => { fields.disabled = true; form.hidden = true; });
  const client = createMediaRsvpClient(base);
  let media = []; let eventId = ''; let selected = null; let matches = []; let active = -1;

  const choose = item => {
    selected = item;
    search.value = item ? item.media_name : search.value;
    picked.hidden = !item; picked.textContent = item ? `✓ ${mediaOptionLabel(item)}` : '';
    options.hidden = true; search.setAttribute('aria-expanded', 'false');
    fresh.hidden = Boolean(item) || fold(search.value).length < 2;
  };
  const renderOptions = () => {
    options.replaceChildren();
    matches.forEach((item, index) => {
      const li = document.createElement('li'); li.role = 'option'; li.id = `inv-media-option-${index}`; li.textContent = mediaOptionLabel(item);
      li.setAttribute('aria-selected', String(index === active));
      li.addEventListener('mousedown', event => { event.preventDefault(); choose(item); });
      options.append(li);
    });
    const other = document.createElement('li'); other.role = 'option'; other.className = 'inv-media-other'; other.id = `inv-media-option-${matches.length}`;
    other.textContent = `Mi medio no está en la lista: «${search.value.trim()}»`;
    other.setAttribute('aria-selected', String(active === matches.length));
    other.addEventListener('mousedown', event => { event.preventDefault(); choose(null); fresh.hidden = false; form.querySelector('[data-media-type]').focus(); });
    options.append(other);
    const open = fold(search.value).length >= 2;
    options.hidden = !open; search.setAttribute('aria-expanded', String(open));
    if (active >= 0) search.setAttribute('aria-activedescendant', `inv-media-option-${active}`); else search.removeAttribute('aria-activedescendant');
  };
  search.addEventListener('input', () => {
    selected = null; picked.hidden = true; fresh.hidden = true;
    matches = filterMedia(media, search.value); active = -1; renderOptions();
  });
  search.addEventListener('keydown', event => {
    if (options.hidden) return;
    const total = matches.length + 1;
    if (event.key === 'ArrowDown') { event.preventDefault(); active = (active + 1) % total; renderOptions(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); active = (active - 1 + total) % total; renderOptions(); }
    else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); if (active < matches.length) choose(matches[active]); else { choose(null); fresh.hidden = false; } }
    else if (event.key === 'Escape') { options.hidden = true; search.setAttribute('aria-expanded', 'false'); }
  });
  search.addEventListener('blur', () => setTimeout(() => {
    options.hidden = true; search.setAttribute('aria-expanded', 'false');
    if (!selected && fold(search.value).length >= 2) {
      const exact = media.find(item => fold(item.media_name) === fold(search.value));
      if (exact) choose(exact); else fresh.hidden = false;
    }
  }, 120));

  const refresh = () => {
    const yes = form.querySelector('input[name="answer"]:checked')?.value === 'yes';
    yesBox.hidden = !yes;
    channelsBox.hidden = form.querySelector('input[name="live_stream"]:checked')?.value !== 'yes';
    for (const box of channelsBox.querySelectorAll('input[name="platform"]')) channelsBox.querySelector(`input[data-platform="${box.value}"]`).hidden = !box.checked;
  };
  form.addEventListener('change', refresh); refresh();

  try {
    const context = await client.context();
    if (!context.event) { say('La confirmación todavía no está abierta. Vuelve a este enlace en un momento.'); return; }
    if (context.event.rsvp_closed) { deadline.close(); say('El plazo para confirmar ya terminó.'); return; }
    eventId = context.event.public_id; media = context.media ?? [];
    fields.disabled = false; say('');
  } catch (error) { say(error.message, true); return; }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (deadline.closed()) return;
    const value = name => form.querySelector(`[name="${name}"]`)?.value ?? '';
    const checked = liveName => form.querySelector(`input[name="${liveName}"]:checked`)?.value;
    const result = mediaRsvpPayload({
      event: eventId, media: selected?.public_id ?? '', new_media_name: selected ? '' : search.value, new_media_type: value('new_media_type'),
      answer: checked('answer'), live_stream: checked('live_stream'), live_detail: value('live_detail'),
      channels: [...channelsBox.querySelectorAll('input[name="platform"]:checked')].map(box => ({ platform: box.value, url: channelsBox.querySelector(`input[data-platform="${box.value}"]`).value })),
      contact_name: value('contact_name'), contact_phone: value('contact_phone'), conditions: form.querySelector('input[name="conditions"]').checked,
    });
    if (result.error) { say(result.error, true); return; }
    fields.disabled = true; say('Enviando…');
    try {
      const response = await client.send(result.payload);
      const name = response.confirmation?.media_name ?? '';
      done.querySelector('[data-media-done-text]').textContent = result.payload.answer === 'yes'
        ? `¡Listo! ${name} quedó confirmado para la Inauguración Oficial. Te escribiremos al WhatsApp de la persona responsable para coordinar. Al llegar, registren su llegada con el QR de acreditación.`
        : `Gracias por avisarnos. Registramos que ${name} no podrá asistir. Si cambian de planes, vuelvan a este enlace y confirmen.`;
      form.hidden = true; done.hidden = false; say('');
      done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (error) { fields.disabled = false; say(error.message, true); }
  });
  done.querySelector('[data-media-again]').addEventListener('click', () => {
    form.reset(); choose(null); search.value = ''; fresh.hidden = true; refresh();
    done.hidden = true; form.hidden = false; fields.disabled = false; search.focus();
  });
}

if (typeof document !== 'undefined') {
  const eventKey = document.body.dataset.invitationEvent || 'guaynaa';
  const configured = document.querySelector('meta[name="invitation-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configured || runtime.apiBase;
  const client = createInvitationClient(base, globalThis.fetch, eventKey);
  if (document.body.dataset.invitation === 'creador') startPersonal(client, eventKey);
  else if (document.body.dataset.invitation === 'gracias') startThanks(client, eventKey);
  else if (document.body.dataset.invitation === 'gafete') startBadge(client, eventKey);
  else if (document.body.dataset.invitation === 'verificar') startVerify(client, eventKey);
  else if (document.body.dataset.invitation === 'condiciones') { /* página informativa: sin llamadas */ }
  else if (document.body.dataset.invitation === 'vocero-acceso') startVoceroGate(base);
  else if (document.body.dataset.invitation === 'medios') startMediaRsvp(base);
  else startOpen(client, eventKey);
}
