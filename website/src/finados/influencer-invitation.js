import { MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from './runtime-origins.mjs';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «2026-10-15» → «Jueves 15 de octubre de 2026», sin depender de la zona horaria del teléfono. */
export function eventDateLabel(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!match) return '';
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const label = `${DAYS[date.getUTCDay()]} ${day} de ${MONTHS[month - 1]} de ${year}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function eventTimeLabel(value) {
  return /^\d{2}:\d{2}$/.test(String(value ?? '')) ? `${value} · hora de Ecuador` : 'Hora por confirmar';
}

/** El código personal del enlace: 32 caracteres hexadecimales en ?c=. */
export function invitationToken(search) {
  const token = new URLSearchParams(search).get('c') ?? '';
  return /^[a-f0-9]{32}$/.test(token) ? token : '';
}

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

export function createInvitationClient(baseUrl = API, fetchImplementation = globalThis.fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  async function request(path, body) {
    if (!/^\/invitacion\/(?:evento|nuevo|c\/[a-f0-9]{32})$/.test(path)) throw new Error('Ruta de API no permitida.');
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
        422: 'Revisa los datos e intenta de nuevo.',
        429: 'Recibimos varios registros seguidos. Espera unos minutos e intenta de nuevo.',
      })[response.status] ?? 'No se pudo completar. Intenta de nuevo en un momento.');
      error.status = response.status;
      throw error;
    }
    return data;
  }
  return {
    event: () => request('/invitacion/evento'),
    open: token => request(`/invitacion/c/${token}`),
    respond: (token, response) => request(`/invitacion/c/${token}`, { response }),
    register: body => request('/invitacion/nuevo', body),
  };
}

function paintEvent(event) {
  if (!event) return;
  const set = (selector, text) => { const node = document.querySelector(selector); if (node && text) node.textContent = text; };
  set('[data-event-title]', event.title);
  set('[data-event-date]', eventDateLabel(event.date));
  set('[data-event-time]', eventTimeLabel(event.time));
  set('[data-event-place]', event.place);
  const map = document.querySelector('[data-event-map]');
  if (map && event.place) map.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.place)}`;
  const details = document.querySelector('[data-event-details]');
  if (details) { details.textContent = event.details ?? ''; details.hidden = !event.details; }
}

async function startPersonal(client) {
  const status = document.querySelector('[data-status]');
  const choices = document.querySelector('[data-choices]');
  const buttons = [...choices.querySelectorAll('[data-answer]')];
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
    name = data.guest.name;
    const nameNode = document.querySelector('[data-guest-name]');
    nameNode.textContent = `${name},`;
    document.title = `${name}, te invitamos | Finados Mushuc Runa 2026`;
    choices.hidden = false;
    mark(data.guest.response);
  } catch (error) { status.textContent = error.message; status.dataset.error = 'true'; return; }
  for (const button of buttons) {
    button.addEventListener('click', async () => {
      buttons.forEach(item => { item.disabled = true; });
      status.textContent = 'Guardando tu respuesta…';
      try {
        const data = await client.respond(token, button.dataset.answer);
        mark(data.guest.response);
        if (data.guest.response === 'si') document.body.dataset.celebrate = 'true';
      } catch (error) { status.textContent = error.message; status.dataset.error = 'true'; }
      finally { buttons.forEach(item => { item.disabled = false; }); }
    });
  }
}

async function startOpen(client) {
  client.event().then(data => paintEvent(data?.event)).catch(() => {});
  const form = document.querySelector('[data-open-form]');
  const status = form.querySelector('[data-status]');
  const thanks = document.querySelector('[data-thanks]');
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
      const first = data.guest.name.split(' ')[0];
      thanks.textContent = data.guest.response === 'si'
        ? `¡Gracias, ${first}! Recibimos tu confirmación. El equipo revisará tu registro y te escribirá por WhatsApp para confirmar tu lugar.`
        : `Gracias por avisarnos, ${first}. Te tendremos presente para lo que viene en Finados.`;
      form.hidden = true;
      thanks.hidden = false;
      thanks.focus();
      if (data.guest.response === 'si') document.body.dataset.celebrate = 'true';
    } catch (error) { status.textContent = error.message; status.dataset.error = 'true'; }
    finally { submit.disabled = false; }
  });
}

if (typeof document !== 'undefined') {
  const configured = document.querySelector('meta[name="invitation-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configured || runtime.apiBase;
  const client = createInvitationClient(base);
  if (document.body.dataset.invitation === 'creador') startPersonal(client);
  else startOpen(client);
}
