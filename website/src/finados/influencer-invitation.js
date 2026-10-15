import { qrcode } from './qrcode-generator.mjs';
import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, PRIMARY_SITE_ORIGIN, resolveRuntimeOrigins } from './runtime-origins.mjs';

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

/** El código personal del enlace en ?c=: 10 letras y números (o los 32 caracteres de los primeros enlaces). */
const TOKEN = /^(?:[a-f0-9]{32}|[a-hjkmnp-z2-9]{10})$/;
export function invitationToken(search) {
  const token = new URLSearchParams(search).get('c') ?? '';
  return TOKEN.test(token) ? token : '';
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

const THANKS_KEY = 'finados-invitacion-respuesta';
export const THANKS_PATH = '/finados/invitacion/gracias/';

/** Lo que dice la pantalla de gracias según quién respondió y qué respondió. */
export function thanksContent({ kind, name = '', response } = {}) {
  const first = String(name).trim().split(/\s+/)[0] ?? '';
  const hello = first ? `, ${first}` : '';
  if (response === 'si' && kind === 'creador') return {
    eyebrow: 'Asistencia confirmada', title: `¡Gracias${hello}!`, subtitle: 'Tu lugar está confirmado.',
    message: 'Nos emociona contar contigo en el Lanzamiento Guaynaa. Te esperamos: prepárate para vivirlo y contarlo a tu manera.', perks: true,
  };
  if (response === 'si') return {
    eyebrow: 'Registro recibido', title: `¡Gracias${hello}!`, subtitle: 'Recibimos tu confirmación.',
    message: 'El equipo revisará tu registro y te escribirá por WhatsApp para confirmar tu lugar en el Lanzamiento Guaynaa.', perks: true,
  };
  if (response === 'no') return {
    eyebrow: 'Respuesta recibida', title: `Gracias${hello}`, subtitle: 'Te vamos a extrañar.',
    message: 'Gracias por avisarnos. Sigues en nuestro radar para lo que viene con SanFra y Finados Mushuc Runa. Si cambias de opinión, puedes volver a tu invitación.', perks: false,
  };
  return { eyebrow: 'Confirmación', title: '¡Gracias!', subtitle: 'Tu respuesta quedó registrada.', message: 'Gracias por responder a la invitación al Lanzamiento Guaynaa.', perks: true };
}

/** La respuesta viaja a la pantalla de gracias dentro de la pestaña, nunca en la dirección. */
function rememberAnswer(answer) {
  try { sessionStorage.setItem(THANKS_KEY, JSON.stringify(answer)); } catch { /* sin almacenamiento: la pantalla muestra un gracias general */ }
}

function readAnswer() {
  try { return JSON.parse(sessionStorage.getItem(THANKS_KEY) ?? 'null'); } catch { return null; }
}

export function createInvitationClient(baseUrl = API, fetchImplementation = globalThis.fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  async function request(path, body) {
    if (!/^\/invitacion\/(?:evento|nuevo|(?:c|gafete)\/(?:[a-f0-9]{32}|[a-hjkmnp-z2-9]{10})|verificar\/[a-f0-9]{32})$/.test(path)) throw new Error('Ruta de API no permitida.');
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
    badge: token => request(`/invitacion/gafete/${token}`),
    verify: id => request(`/invitacion/verificar/${id}`),
  };
}

export const DRESS_CODE = 'Blanco';

function paintEvent(event) {
  if (!event) return;
  const set = (selector, text) => { if (text) for (const node of document.querySelectorAll(selector)) node.textContent = text; };
  set('[data-event-title]', event.title);
  set('[data-event-date]', eventDateLabel(event.date));
  set('[data-event-time]', eventTimeLabel(event.time));
  set('[data-event-place]', event.place);
  if (event.place) for (const map of document.querySelectorAll('[data-event-map]')) map.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.place)}`;
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
    const badgeLink = document.querySelector('[data-badge-link]');
    if (badgeLink && data.guest.badge) { badgeLink.querySelector('a').href = badgePath(token); badgeLink.hidden = false; }
    if (data.guest.response === 'si') showConfirmed(client, token, data);
  } catch (error) { status.textContent = error.message; status.dataset.error = 'true'; return; }
  for (const button of buttons) {
    button.addEventListener('click', async () => {
      buttons.forEach(item => { item.disabled = true; });
      status.textContent = 'Guardando tu respuesta…';
      try {
        const data = await client.respond(token, button.dataset.answer);
        rememberAnswer({ kind: data.guest.kind ?? 'creador', name: data.guest.name, response: data.guest.response, token, badge: data.guest.badge === true });
        location.assign(THANKS_PATH);
      } catch (error) {
        status.textContent = error.message; status.dataset.error = 'true';
        buttons.forEach(item => { item.disabled = false; });
      }
    });
  }
}

/** Quien ya confirmó ve primero su confirmación, los datos del evento y su gafete listo para descargar. */
async function showConfirmed(client, token, data) {
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
    });
  } catch (error) {
    const status = box.querySelector('[data-confirmed-status]');
    status.textContent = error.message || 'No se pudo preparar el gafete.'; status.dataset.error = 'true';
  }
}

async function startOpen(client) {
  client.event().then(data => paintEvent(data?.event)).catch(() => {});
  const form = document.querySelector('[data-open-form]');
  const status = form.querySelector('[data-status]');
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
      rememberAnswer({ kind: 'nuevo', name: data.guest.name, response: data.guest.response });
      location.assign(THANKS_PATH);
    } catch (error) {
      status.textContent = error.message; status.dataset.error = 'true';
      submit.disabled = false;
    }
  });
}

function startThanks(client) {
  const answer = readAnswer() ?? {};
  const content = thanksContent(answer);
  const set = (selector, text) => { const node = document.querySelector(selector); if (node) node.textContent = text; };
  set('[data-thanks-eyebrow]', content.eyebrow);
  set('[data-thanks-title]', content.title);
  set('[data-thanks-subtitle]', content.subtitle);
  set('[data-thanks-message]', content.message);
  document.querySelector('[data-thanks-perks]').hidden = !content.perks;
  document.title = `${content.title} | Lanzamiento Guaynaa`;
  if (answer.response === 'si') document.body.dataset.celebrate = 'true';
  const badgeBox = document.querySelector('[data-thanks-badge]');
  if (answer.badge && TOKEN.test(answer.token ?? '')) { badgeBox.querySelector('[data-thanks-badge-link]').href = badgePath(answer.token); badgeBox.hidden = false; }
  const back = document.querySelector('[data-thanks-back]');
  if (TOKEN.test(answer.token ?? '')) { back.href = `/i/?c=${answer.token}`; back.hidden = false; }
  else if (answer.kind === 'nuevo') { back.href = '/finados/invitacion/creadores/'; back.hidden = false; }
  client.event().then(data => paintEvent(data?.event)).catch(() => {});
}

export function badgePath(token) {
  return `/finados/invitacion/gafete/?c=${encodeURIComponent(token)}`;
}

/** El QR del gafete lleva a la validación de esa persona, en el mismo sitio donde se abrió. */
export function badgeVerificationUrl(publicId, siteOrigin = PRIMARY_SITE_ORIGIN) {
  if (!/^[a-f0-9]{32}$/.test(String(publicId ?? ''))) throw new TypeError('Identificador inválido.');
  const origin = isAllowedSiteOrigin(siteOrigin) ? siteOrigin : PRIMARY_SITE_ORIGIN;
  return `${origin}/finados/invitacion/verificar/?id=${publicId}`;
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
export async function influencerBadgeBlob(guest, event, siteOrigin) {
  if (!globalThis.document?.createElement) return null;
  const matrix = qrMatrix(badgeVerificationUrl(guest.public_id, siteOrigin));
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const W = canvas.width, H = canvas.height;
  const round = (x, y, width, height, radius) => { context.beginPath(); if (context.roundRect) context.roundRect(x, y, width, height, radius); else context.rect(x, y, width, height); };
  try { await Promise.all(['900 80px Inter', '800 30px Inter', '600 30px Inter'].map(font => document.fonts?.load(font))); } catch { /* fuente de respaldo */ }
  const [poster, finados] = await Promise.all([
    loadImage('/assets/finados/guaynaa-lanzamiento-hoy-1122.webp').catch(() => null),
    loadImage('/assets/finados/logo-finados.svg').catch(() => null),
  ]);
  context.fillStyle = '#0e0916'; context.fillRect(0, 0, W, H);
  if (poster) { const height = W * poster.height / poster.width; context.drawImage(poster, 0, 0, W, height); }
  const fade = context.createLinearGradient(0, 980, 0, 1400);
  fade.addColorStop(0, 'rgba(14, 9, 22, 0)'); fade.addColorStop(1, 'rgba(14, 9, 22, 1)');
  context.fillStyle = fade; context.fillRect(0, 980, W, 940);
  const glow = context.createRadialGradient(W / 2, H, 50, W / 2, H, 900);
  glow.addColorStop(0, 'rgba(139, 92, 246, .45)'); glow.addColorStop(1, 'rgba(139, 92, 246, 0)');
  context.fillStyle = glow; context.fillRect(0, 1100, W, 820);

  // Panel de vidrio con el nombre, los datos y el QR.
  const panel = { x: 56, y: 1170, width: W - 112, height: 590 };
  context.fillStyle = 'rgba(35, 24, 51, .94)'; round(panel.x, panel.y, panel.width, panel.height, 40); context.fill();
  context.strokeStyle = 'rgba(196, 170, 255, .55)'; context.lineWidth = 3; round(panel.x, panel.y, panel.width, panel.height, 40); context.stroke();
  const left = panel.x + 48, textWidth = panel.width - 48 - 330;
  context.textAlign = 'left'; context.textBaseline = 'alphabetic';
  context.fillStyle = '#b892ff'; context.font = '800 26px Inter, Arial, sans-serif';
  context.fillText(guest.kind === 'nuevo' ? 'CREADOR INVITADO' : 'INVITADO ESPECIAL', left, panel.y + 76);
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
  context.fillStyle = '#ffffff';
  lines.slice(0, 2).forEach((text, index) => context.fillText(text, left, panel.y + 156 + index * (size + 8)));
  const infoY = panel.y + 156 + Math.min(lines.length, 2) * (size + 8) + 30;
  context.fillStyle = '#d9c8ff'; context.font = '800 30px Inter, Arial, sans-serif';
  context.fillText(String(event?.title ?? 'Lanzamiento Guaynaa').toUpperCase(), left, infoY);
  context.font = '600 28px Inter, Arial, sans-serif'; context.fillStyle = '#ece6f7';
  const when = [eventDateLabel(event?.date), /^\d{2}:\d{2}$/.test(event?.time ?? '') ? event.time : ''].filter(Boolean).join(' · ');
  if (when) context.fillText(when, left, infoY + 46);
  const place = String(event?.place ?? '').split(',').slice(0, 2).join(',').trim();
  if (place) { let text = place; while (context.measureText(text).width > textWidth && text.length > 10) text = `${text.slice(0, -2)}…`; context.fillText(text, left, infoY + 88); }
  context.font = '800 28px Inter, Arial, sans-serif'; context.fillStyle = '#ffffff';
  context.fillText(`DRESS CODE: ${DRESS_CODE.toUpperCase()}`, left, infoY + 134);
  context.font = '600 22px Inter, Arial, sans-serif'; context.fillStyle = '#b9aecb';
  context.fillText('Presenta este QR en la entrada', left, panel.y + panel.height - 44);
  const qrSize = 270, qrX = panel.x + panel.width - qrSize - 48, qrY = panel.y + (panel.height - qrSize) / 2;
  context.fillStyle = '#ffffff'; round(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 22); context.fill();
  const quiet = 1, cell = qrSize / (matrix.length + quiet * 2);
  context.fillStyle = '#150d22';
  for (let row = 0; row < matrix.length; row += 1) for (let column = 0; column < matrix.length; column += 1) {
    if (matrix[row][column]) context.fillRect(qrX + (column + quiet) * cell, qrY + (row + quiet) * cell, cell + .4, cell + .4);
  }
  // Pie con Finados.
  if (finados) { const width = 190, height = width * finados.height / finados.width; context.drawImage(finados, (W - width) / 2, H - height - 34, width, height); }
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

async function startBadge(client) {
  const status = document.querySelector('[data-status]');
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
  await mountBadge(data, {
    status, preview: document.querySelector('[data-badge-preview]'), actions: document.querySelector('[data-badge-actions]'),
    download: document.querySelector('[data-badge-download]'), share: document.querySelector('[data-badge-share]'),
  });
}

/** Dibuja el gafete y conecta sus botones de descargar y compartir. */
async function mountBadge(data, { status, preview, actions, download: downloadButton, share }) {
  let file = null, url = '';
  try {
    const blob = await influencerBadgeBlob(data.guest, data.event, resolveRuntimeOrigins(location).siteOrigin);
    if (!blob) throw new Error();
    url = URL.createObjectURL(blob);
    file = new File([blob], 'gafete-lanzamiento-guaynaa.png', { type: 'image/png' });
    preview.src = url; preview.hidden = false; actions.hidden = false;
    status.textContent = '¡Listo! Descárgalo y llévalo en tu teléfono.'; status.dataset.error = 'false';
  } catch { status.textContent = 'No se pudo preparar el gafete. Recarga la página para intentarlo de nuevo.'; status.dataset.error = 'true'; return; }
  const download = () => { const link = Object.assign(document.createElement('a'), { href: url, download: 'gafete-lanzamiento-guaynaa.png' }); document.body.append(link); link.click(); link.remove(); };
  downloadButton.addEventListener('click', download);
  share.addEventListener('click', async () => {
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) await navigator.share({ title: 'Lanzamiento Guaynaa', text: '¡Nos vemos en el Lanzamiento Guaynaa! #FinadosMushucRuna', files: [file] });
      else { download(); status.textContent = 'Tu teléfono descargó el gafete para que lo compartas.'; }
    } catch (error) { if (error?.name !== 'AbortError') status.textContent = 'No se pudo compartir. Descarga el gafete y súbelo desde tu red social.'; }
  });
}

async function startVerify(client) {
  const status = document.querySelector('[data-status]');
  const result = document.querySelector('[data-verify-result]');
  const id = new URLSearchParams(location.search).get('id') ?? '';
  try {
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('Este código no es un gafete válido.');
    const data = await client.verify(id);
    const view = describeVerification(data.verification);
    document.querySelector('[data-verify-state]').textContent = view.state;
    document.querySelector('[data-verify-name]').textContent = view.name;
    document.querySelector('[data-verify-kind]').textContent = view.kind;
    document.querySelector('[data-verify-social]').textContent = view.social;
    result.dataset.valid = String(view.valid);
    result.hidden = false;
    status.textContent = view.valid ? 'Gafete confirmado.' : 'Este gafete no está vigente.';
  } catch (error) { status.textContent = error.status === 404 ? 'Este gafete no existe.' : error.message; status.dataset.error = 'true'; }
}

if (typeof document !== 'undefined') {
  const configured = document.querySelector('meta[name="invitation-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configured || runtime.apiBase;
  const client = createInvitationClient(base);
  if (document.body.dataset.invitation === 'creador') startPersonal(client);
  else if (document.body.dataset.invitation === 'gracias') startThanks(client);
  else if (document.body.dataset.invitation === 'gafete') startBadge(client);
  else if (document.body.dataset.invitation === 'verificar') startVerify(client);
  else startOpen(client);
}
