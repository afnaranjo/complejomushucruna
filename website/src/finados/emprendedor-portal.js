import { qrcode } from './qrcode-generator.mjs';
import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, PRIMARY_SITE_ORIGIN, resolveRuntimeOrigins } from './runtime-origins.mjs';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
const ACCESS = '/finados/emprendedores/acceso/?modo=login';
const PROFILE = '/finados/emprendedores/mi-registro/';

const BADGE_VERIFICATION_ORIGIN = PRIMARY_SITE_ORIGIN;
const BADGE_TRAFFIC_LIGHTS = Object.freeze({
  red: Object.freeze({ short: 'Rojo', long: 'En preparación', color: '#e01b24' }),
  yellow: Object.freeze({ short: 'Amarillo', long: 'En avance', color: '#ffc42e' }),
  green: Object.freeze({ short: 'Verde', long: 'Listo', color: '#35c277' }),
});

/** Builds the only public value encoded in an entrepreneur badge QR. */
export function resolveEmprendedorOrigins(location = globalThis.location) { return resolveRuntimeOrigins(location); }

export function badgeVerificationUrl(publicId, siteOrigin = BADGE_VERIFICATION_ORIGIN) {
  if (typeof publicId !== 'string' || !/^[a-f0-9]{32}$/.test(publicId)) throw new TypeError('Identificador público inválido.');
  if (!isAllowedSiteOrigin(siteOrigin)) throw new TypeError('Origen de validación inválido.');
  return `${siteOrigin}/finados/emprendedores/verificar/?id=${publicId}`;
}

export function trafficLightLabel(light) {
  const value = BADGE_TRAFFIC_LIGHTS[light];
  if (!value) throw new TypeError('Semáforo inválido.');
  return { short: value.short, long: value.long };
}

/** Formats the identity number for the public badge without exposing it in full. */
export function formatBadgeCedula(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return 'No disponible';
  if (digits.length <= 4) return `••••${digits}`;
  return `${digits.slice(0, 3)}••••${digits.slice(-2)}`;
}

/** Returns the QR matrix so the canvas renderer and tests share one encoder. */
export function createBadgeQrMatrix(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512) throw new TypeError('Contenido QR inválido.');
  const code = qrcode(0, 'M');
  code.addData(value, 'Byte');
  code.make();
  const size = code.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, column) => code.isDark(row, column)));
}

export class EmprendedorError extends Error {
  constructor(status, context = '') {
    super(({ 0: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.',
      401: context === 'login' ? 'No se pudo iniciar sesión. Revisa tu correo y contraseña.' : 'Tu sesión venció. Inicia sesión nuevamente.',
      403: 'No se autorizó el cambio. Tu registro puede estar en revisión o el acceso debe actualizarse.',
      404: 'La función o el enlace no está disponible. Solicita ayuda a la coordinación del programa.',
      409: 'Ya existe un registro con los datos proporcionados. Consulta con la coordinación del programa.',
      413: 'El archivo supera el tamaño permitido. Selecciona una fotografía de máximo 5 MB.',
      415: 'El formato no es compatible. Selecciona una fotografía JPG, PNG o WebP.',
      422: 'Revisa los campos, consentimientos y fotografía. No se pudo guardar la información.',
      429: 'Hay demasiados intentos. Espera 15 minutos antes de volver a intentar.' })[status] ?? 'No se pudo completar la solicitud. Intenta de nuevo.');
    this.status = status;
    if (context === 'reset' && [401, 403, 404, 422].includes(status)) this.message = 'El enlace de recuperación venció, ya fue usado o no está disponible. Solicita un enlace nuevo a la coordinación.';
  }
}

export class EmprendedorApiClient {
  #csrf = '';
  constructor(baseUrl = API, fetchImplementation = globalThis.fetch) {
    if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
    this.baseUrl = baseUrl;
    this.fetch = fetchImplementation;
  }
  async request(path, { body, blob = false } = {}) {
    if (!/^(?:\/(?:auth\/(?:session|register|login|logout|reset)|profile|photo)|\/videos\/[1-5])$/.test(path)) throw new Error('Ruta de API no permitida.');
    if (body !== undefined && !this.#csrf) await this.session();
    const headers = { Accept: blob ? 'image/jpeg' : 'application/json' };
    const multipart = body instanceof FormData;
    if (body !== undefined) {
      if (!this.#csrf) throw new EmprendedorError(403);
      headers['X-CSRF-Token'] = this.#csrf;
      if (!multipart) headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      const fetchImplementation = this.fetch;
      response = await fetchImplementation(`${this.baseUrl}/emprendedor${path}`, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'include', cache: 'no-store', redirect: 'error',
        referrerPolicy: 'no-referrer', headers,
        ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
      });
    } catch { throw new EmprendedorError(0); }
    if (blob && response.ok) return response.blob();
    let data;
    try { data = await response.json(); } catch { throw new EmprendedorError(response.ok ? 502 : response.status); }
    if (typeof data?.csrf === 'string') this.#csrf = data.csrf;
    if (!response.ok) {
      if ([401, 403].includes(response.status)) this.#csrf = '';
      throw new EmprendedorError(response.status, path === '/auth/login' ? 'login' : path === '/auth/reset' ? 'reset' : '');
    }
    return data;
  }
  session() { return this.request('/auth/session'); }
  register(email, password) { return this.request('/auth/register', { body: { email, password, privacyAcknowledged: true } }); }
  login(email, password) { return this.request('/auth/login', { body: { email, password } }); }
  async logout() { const result = await this.request('/auth/logout', { body: {} }); this.#csrf = ''; return result; }
  profile() { return this.request('/profile'); }
  saveProfile(body) { return this.request('/profile', { body }); }
  saveVideo(slot, url) { return this.request(`/videos/${slot}`, { body: { url } }); }
  photo() { return this.request('/photo', { blob: true }); }
  async reset(token, password) {
    const result = await this.request('/auth/reset', { body: { token, password } });
    if (result?.ok !== true) throw new EmprendedorError(502, 'reset');
    return result;
  }
}

export async function registerAndSwitchToLogin(api, email, password, setMode) {
  await api.register(email, password);
  setMode({ mode: 'login', email, message: 'Cuenta creada; inicia sesión con tu correo y contraseña para completar el registro.' });
}

export const PROFILE_FIELDS = Object.freeze({
  nombre_completo: 'full_name', cedula: 'cedula', fecha_nacimiento: 'birth_date', whatsapp: 'whatsapp', ciudad: 'city',
  emprendimiento: 'business_name', producto: 'product', stand: 'stand_code',
  tiktok: 'tiktok', instagram: 'instagram', facebook: 'facebook', red_principal: 'main_network',
  participacion_previa: 'previous_participation',
});
const CONSENTS = ['consentimiento_politicas', 'autorizacion_imagen', 'consentimiento_datos'];
export function validatePhoto(file) {
  if (!file || file.size === 0) throw new Error('Selecciona una fotografía para identificación y gafete.');
  if (file.size > 5 * 1024 * 1024) throw new EmprendedorError(413);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new EmprendedorError(415);
}
export class EmprendedorProfileState {
  constructor() { this.values = {}; }
  load(profile) {
    if (typeof profile.registered !== 'boolean') throw new EmprendedorError(502);
    if (profile.registered && !/^[a-f0-9]{32}$/.test(profile.public_id ?? '')) throw new EmprendedorError(502);
    // The photo is mandatory for the badge: required on the first save and whenever it is still missing.
    this.photoRequired = !profile.registered || !profile.photo?.available;
    this.editable = !profile.registered || ['Nuevo', 'En revisión'].includes(profile.status);
    this.values = Object.fromEntries(Object.entries(PROFILE_FIELDS).map(([name, key]) => [name, String(profile[key] ?? '')]));
    return this.values;
  }
  body(fields) {
    if (!this.editable) throw new EmprendedorError(403);
    const body = new FormData();
    for (const name of [...Object.keys(PROFILE_FIELDS), ...CONSENTS]) {
      const value = fields.get(name);
      body.set(name, typeof value === 'string' ? value : (this.values[name] ?? ''));
    }
    const photo = fields.get('fotografia');
    if (photo?.size || this.photoRequired) {
      validatePhoto(photo);
      body.set('fotografia', photo, photo.name || 'fotografia.jpg');
    }
    return body;
  }
}

export function createAutoSaveScheduler(save, {
  delay = 900,
  setTimeoutImplementation = globalThis.setTimeout,
  clearTimeoutImplementation = globalThis.clearTimeout,
} = {}) {
  if (typeof save !== 'function') throw new TypeError('La función de autoguardado es obligatoria.');
  let timer = null;
  let running = false;
  let queued = false;
  const schedule = () => {
    if (timer !== null) clearTimeoutImplementation(timer);
    timer = setTimeoutImplementation(async () => {
      timer = null;
      if (running) { queued = true; return; }
      running = true;
      try { await save(); }
      finally {
        running = false;
        if (queued) { queued = false; schedule(); }
      }
    }, delay);
    return timer;
  };
  const cancel = () => {
    if (timer !== null) clearTimeoutImplementation(timer);
    timer = null;
    queued = false;
  };
  return { schedule, cancel };
}

export class PhotoPreview {
  constructor(url = URL, events = globalThis) {
    this.url = url; this.current = '';
    events.addEventListener?.('pagehide', () => this.clear());
  }
  replace(blob) { this.clear(); this.current = this.url.createObjectURL(blob); return this.current; }
  clear() { if (this.current) this.url.revokeObjectURL(this.current); this.current = ''; }
}

function showFeedback(element, message, error = false, { focus = true } = {}) {
  element.textContent = message;
  element.dataset.error = String(error);
  element.setAttribute('role', error ? 'alert' : 'status');
  if (message && focus) element.focus();
}
function ageToday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const [year, month, day] = value.split('-').map(Number);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m, d] = today.split('-').map(Number);
  return y - year - (m < month || (m === month && d < day) ? 1 : 0);
}
function videoEnabledDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}
function validateForm(form) {
  const invalid = [...form.elements].find(element => element.willValidate && !element.checkValidity());
  if (invalid) {
    invalid.setAttribute('aria-invalid', 'true');
    const label = invalid.labels?.[0]?.textContent.trim() || 'los campos obligatorios';
    throw new Error(`Revisa ${label}. ${invalid.validationMessage}`);
  }
  const password = form.elements.namedItem('password');
  const confirmation = form.elements.namedItem('confirmation');
  if (confirmation && password.value !== confirmation.value) throw new Error('Las contraseñas no coinciden. Revisa la confirmación.');
}

export function isProfileReadyForAutoSave(form) {
  if (!form?.checkValidity?.() || !form.elements?.namedItem) return false;
  const value = name => String(form.elements.namedItem(name)?.value ?? '').trim();
  const age = ageToday(value('fecha_nacimiento'));
  return Number.isFinite(age) && age >= 18 && ['tiktok', 'instagram', 'facebook'].some(name => value(name) !== '');
}

async function loadBadgeImage(source) {
  if (!source) return null;
  return new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
}

async function badgeBlob(profile, photoBlob, siteOrigin = BADGE_VERIFICATION_ORIGIN) {
  if (!globalThis.document?.createElement || !photoBlob) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const roundRect = (x, y, width, height, radius) => { context.beginPath(); if (context.roundRect) context.roundRect(x, y, width, height, radius); else context.rect(x, y, width, height); };
  const progress = profile.progress ?? {};
  const light = BADGE_TRAFFIC_LIGHTS[progress.traffic_light] ? progress.traffic_light : 'red';
  const lightLabel = BADGE_TRAFFIC_LIGHTS[light];
  const level = String(progress.level_label ?? 'En preparación').trim().slice(0, 36) || 'En preparación';

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#241146'); gradient.addColorStop(0.48, '#391f6f'); gradient.addColorStop(1, '#b51f78');
  context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);

  // Franja chumbi, marco cian y formas orbitantes del key visual.
  const chumbi = ['#ff2e8a', '#ffc42e', '#00d2d6', '#f4eada'];
  for (let x = 0, index = 0; x < canvas.width; x += 60, index += 1) {
    context.fillStyle = chumbi[index % chumbi.length]; context.fillRect(x, 0, 60, 24);
  }
  context.fillStyle = '#00d2d6'; context.fillRect(0, canvas.height - 24, canvas.width, 24);
  context.strokeStyle = '#00d2d6'; context.lineWidth = 6; context.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);
  context.globalAlpha = .16; context.fillStyle = '#00d2d6'; context.beginPath(); context.arc(930, 290, 260, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#ffc42e'; context.beginPath(); context.arc(100, 1510, 170, 0, Math.PI * 2); context.fill();
  context.globalAlpha = .28; context.strokeStyle = '#f4eada'; context.lineWidth = 6; context.beginPath(); context.arc(520, 650, 500, Math.PI * 1.04, Math.PI * 1.86); context.stroke(); context.globalAlpha = 1;
  context.fillStyle = '#ff2e8a'; context.save(); context.translate(-170, 720); context.rotate(-.35); context.fillRect(0, 0, 430, 72); context.restore();
  context.globalAlpha = .08; context.strokeStyle = '#f4eada'; context.lineWidth = 2;
  for (let x = -canvas.height; x < canvas.width; x += 42) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x + canvas.height, canvas.height); context.stroke(); }
  context.globalAlpha = 1;

  let logo = null;
  const iconMarks = [
    ['/assets/finados/icons/crecimiento.svg', 825, 204, 125, 138, .16],
    ['/assets/finados/icons/legado.svg', 700, 1632, 142, 150, .14],
    ['/assets/finados/icons/espectador.svg', 650, 1740, 300, 130, .16],
  ];
  const [loadedLogo, ...loadedIcons] = await Promise.all([
    loadBadgeImage('/assets/finados/logo-finados.svg').catch(() => null),
    ...iconMarks.map(async ([source]) => loadBadgeImage(source).catch(() => null)),
  ]);
  logo = loadedLogo;
  if (logo) { const maxW = 360; const maxH = 200; const scale = Math.min(maxW / logo.width, maxH / logo.height); context.drawImage(logo, (canvas.width - logo.width * scale) / 2, 66, logo.width * scale, logo.height * scale); }
  loadedIcons.forEach((icon, index) => {
    if (!icon) return;
    const [, x, y, width, height, opacity] = iconMarks[index];
    context.save(); context.globalAlpha = opacity; context.drawImage(icon, x, y, width, height); context.restore();
  });

  // Encabezado separado del título para que ningún texto se solape.
  context.textAlign = 'center'; context.fillStyle = '#f4eada'; context.font = '700 24px Inter, Arial, sans-serif'; context.fillText('DE EMPRENDEDOR A INFLUENCER', 540, 318);
  context.fillStyle = '#ffc42e'; context.font = '700 30px Inter, Arial, sans-serif'; context.fillText('FINADOS 2026', 540, 360);
  context.textAlign = 'left'; context.fillStyle = '#ffffff'; context.font = '900 84px Anton, Arial Narrow, sans-serif'; context.fillText('EMPRENDEDOR 2026', 70, 505);
  context.fillStyle = '#ff2e8a'; context.font = '800 38px Inter, Arial, sans-serif'; context.fillText('EXPOSITOR PARTICIPANTE', 74, 570);
  context.fillStyle = '#00d2d6'; context.fillRect(74, 610, 360, 12);

  // Validate the stable public identifier before creating a temporary photo URL.
  const qrText = badgeVerificationUrl(String(profile.public_id ?? ''), siteOrigin);
  const matrix = createBadgeQrMatrix(qrText);

  let photoUrl = '';
  const image = await (globalThis.createImageBitmap
    ? globalThis.createImageBitmap(photoBlob)
    : (photoUrl = URL.createObjectURL(photoBlob), loadBadgeImage(photoUrl)));
  // Retrato tipo carnet: la proporción vertical evita deformar la fotografía.
  const frame = { x: 86, y: 710, width: 430, height: 560 };
  context.fillStyle = '#f4eada'; roundRect(frame.x - 16, frame.y - 16, frame.width + 32, frame.height + 32, 28); context.fill();
  context.save(); roundRect(frame.x, frame.y, frame.width, frame.height, 18); context.clip();
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  const width = image.width * scale; const height = image.height * scale;
  context.drawImage(image, frame.x + (frame.width - width) / 2, frame.y + (frame.height - height) / 2, width, height); context.restore();
  image.close?.();

  // Panel de validación: QR individual y estado del emprendedor junto al retrato.
  const panel = { x: 570, y: 710, width: 420, height: 560 };
  context.fillStyle = '#f4eada'; roundRect(panel.x, panel.y, panel.width, panel.height, 28); context.fill();
  context.textAlign = 'left'; context.fillStyle = '#391f6f'; context.font = '700 21px Inter, Arial, sans-serif'; context.fillText('EMPRENDEDOR 2026', panel.x + 30, panel.y + 48);
  const qrSize = 248;
  const qrX = panel.x + (panel.width - qrSize) / 2;
  const qrY = panel.y + 74;
  context.fillStyle = '#ffffff'; roundRect(qrX - 14, qrY - 14, qrSize + 28, qrSize + 28, 18); context.fill();
  const quiet = 4;
  const cell = qrSize / (matrix.length + quiet * 2);
  context.fillStyle = '#ffffff'; context.fillRect(qrX, qrY, qrSize, qrSize);
  context.fillStyle = '#241146';
  for (let row = 0; row < matrix.length; row += 1) for (let column = 0; column < matrix.length; column += 1) {
    if (matrix[row][column]) context.fillRect(qrX + (column + quiet) * cell, qrY + (row + quiet) * cell, cell + .4, cell + .4);
  }
  context.textAlign = 'center'; context.fillStyle = '#391f6f'; context.font = '700 15px Inter, Arial, sans-serif'; context.fillText('ESCANEA PARA VALIDAR', panel.x + panel.width / 2, panel.y + 358);
  context.textAlign = 'left'; context.fillStyle = '#391f6f'; context.font = '700 16px Inter, Arial, sans-serif'; context.fillText('NIVEL ACTUAL', panel.x + 30, panel.y + 405);
  let panelLevelSize = 30;
  while (panelLevelSize > 20) { context.font = `900 ${panelLevelSize}px Anton, Arial Narrow, sans-serif`; if (context.measureText(level).width <= panel.width - 60) break; panelLevelSize -= 2; }
  context.fillText(level, panel.x + 30, panel.y + 445);
  context.fillStyle = lightLabel.color; context.beginPath(); context.arc(panel.x + 42, panel.y + 495, 13, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#391f6f'; context.font = '700 17px Inter, Arial, sans-serif'; context.fillText(lightLabel.short.toUpperCase(), panel.x + 66, panel.y + 501);

  // Identidad debajo de ambos bloques, con espacio suficiente para nombres largos y cédula.
  context.textAlign = 'left'; context.fillStyle = '#f4eada'; context.font = '700 25px Inter, Arial, sans-serif'; context.fillText('EMPRENDEDOR PARTICIPANTE', 78, 1360);
  const name = String(profile.full_name ?? 'Emprendedor').trim().slice(0, 42) || 'Emprendedor';
  let nameSize = 60;
  while (nameSize > 40) { context.font = `900 ${nameSize}px Inter, Arial, sans-serif`; if (context.measureText(name).width <= 900) break; nameSize -= 2; }
  context.fillStyle = '#ffffff'; context.fillText(name, 78, 1430);
  const business = String(profile.business_name ?? '').trim().slice(0, 48);
  let businessSize = 30;
  while (businessSize > 20) { context.font = `700 ${businessSize}px Inter, Arial, sans-serif`; if (context.measureText(business).width <= 900) break; businessSize -= 2; }
  context.fillStyle = '#ffc42e'; context.fillText(business, 78, 1476);
  context.fillStyle = '#f4eada'; context.font = '700 20px Inter, Arial, sans-serif'; context.fillText(`C.I. ${formatBadgeCedula(profile.cedula)}`, 78, 1516);
  context.fillStyle = '#00d2d6'; context.fillRect(78, 1544, 360, 10);
  context.textAlign = 'left'; context.fillStyle = '#ffc42e'; context.font = '700 25px Inter, Arial, sans-serif'; context.fillText('¡LEGADO QUE NOS UNE!', 78, 1678);
  context.fillStyle = '#f4eada'; context.font = '500 22px Inter, Arial, sans-serif'; context.fillText('Cuenta tu historia, trae a tu gente a tu stand.', 78, 1730);
  context.fillStyle = '#ffffff'; context.font = '700 22px Inter, Arial, sans-serif'; context.fillText('VALIDACIÓN INDIVIDUAL · FINADOS 2026', 78, 1784);
  context.textAlign = 'right'; context.fillText('MUSHUC RUNA', 1000, 1834);
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

export async function initializeEmprendedorPortal(root = document, location = globalThis.location) {
  const view = root.body?.dataset.emprendedorView;
  if (!view) return;
  const runtime = resolveEmprendedorOrigins(location);
  const configuredApi = root.querySelector('meta[name="emprendedor-api-base"]')?.content;
  const apiBase = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredApi || runtime.apiBase;
  const api = new EmprendedorApiClient(apiBase);
  const feedback = root.querySelector('[data-vocero-feedback]');
  const retry = root.querySelector('[data-session-retry]');
  const relogin = root.querySelector('[data-session-login]');
  const message = (text, error = false, focus = true) => showFeedback(feedback, text, error, { focus });
  const reportError = error => { message(error.message, true); relogin.hidden = error.status !== 401 || view !== 'profile'; };
  root.addEventListener('input', event => event.target.removeAttribute?.('aria-invalid'));
  let ready = false;
  const forms = [...root.querySelectorAll('form')];
  const state = new EmprendedorProfileState();
  const preview = new PhotoPreview();
  const profileForm = root.querySelector('[data-emprendedor-profile]');
  const photo = root.querySelector('[name="fotografia"]');
  const autoSaveStatus = root.querySelector('[data-auto-save-status]');
  let autoSaveScheduler = null;
  let photoGeneration = 0;
  const image = root.querySelector('[data-photo-preview]');
  const progressPanel = root.querySelector('[data-vocero-progress]');
  const badgePanel = root.querySelector('[data-vocero-badge]');
  const badgePreview = root.querySelector('[data-vocero-badge-preview]');
  const badgeStatus = root.querySelector('[data-vocero-badge-status]');
  let badgeUrl = '';
  const showPhoto = blob => {
    image.src = preview.replace(blob); image.hidden = false;
    root.querySelector('[data-photo-placeholder]').hidden = true;
    root.querySelector('[data-photo-replace]').hidden = false;
  };
  const clearPhoto = () => {
    preview.clear(); image?.removeAttribute('src'); if (image) image.hidden = true;
    const placeholder = root.querySelector('[data-photo-placeholder]');
    if (placeholder) placeholder.hidden = false;
  };
  globalThis.addEventListener?.('pagehide', () => { autoSaveScheduler?.cancel(); photoGeneration++; clearPhoto(); });
  globalThis.addEventListener?.('pageshow', event => { if (event.persisted) location.reload(); });
  const loadSavedPhoto = async () => {
    const generation = ++photoGeneration;
    const blob = await api.photo();
    if (generation === photoGeneration) showPhoto(blob);
    return blob;
  };
  function populate(profile) {
    const values = state.load(profile);
    for (const [name, value] of Object.entries(values)) {
      const input = profileForm.elements.namedItem(name);
      if (input) input.value = value;
    }
    root.querySelector('[data-account-email]').value = profile.email;
    root.querySelector('[data-profile-status]').textContent = profile.registered ? `Estado: ${profile.status}` : 'Completa tu registro para participar.';
    photo.required = state.photoRequired;
    root.querySelector('[data-photo-label]').textContent = profile.photo?.available ? 'Fotografía nueva (opcional)' : 'Seleccionar fotografía (obligatoria)';
    profileForm.querySelector('fieldset').disabled = !state.editable;
    for (const button of profileForm.querySelectorAll('button[type="submit"]')) button.hidden = !state.editable;
    root.querySelector('[data-save-help]').textContent = state.editable ? 'Tus cambios se guardan automáticamente cuando el formulario está completo.' : 'Tu registro está en revisión o ya tiene una decisión. Puedes consultar tus datos; para cambios, contacta a la coordinación.';
    const consentTypes = { consentimiento_politicas: 'policies', autorizacion_imagen: 'image', consentimiento_datos: 'data' };
    for (const [field, type] of Object.entries(consentTypes)) {
      const input = profileForm.elements.namedItem(field);
      if (input) input.checked = (profile.consents ?? []).some(consent => consent.consent_type === type && Number(consent.accepted) === 1);
    }
    root.querySelector('.vocero-consents').hidden = !state.editable;
    const business = root.querySelector('[data-emprendedor-business]'); if (business) business.textContent = profile.business_name || '—';
    updateProgress(profile);
    if (!profile.photo?.available) updateBadge(profile);
  }

  function updateProgress(profile) {
    if (!progressPanel) return;
    const progress = profile.progress ?? {};
    const light = progress.traffic_light ?? 'red';
    for (const circle of progressPanel.querySelectorAll('[data-vocero-light]')) circle.classList.toggle('is-active', circle.dataset.voceroLight === light);
    const label = progressPanel.querySelector('[data-vocero-level-label]'); if (label) label.textContent = progress.level_label ?? 'En preparación';
    const followers = progressPanel.querySelector('[data-vocero-followers]'); if (followers) followers.textContent = new Intl.NumberFormat('es-EC').format(Number(progress.followers_count) || 0);
    const level = Number(progress.level) || 0;
    for (const card of progressPanel.querySelectorAll('[data-vocero-level]')) card.classList.toggle('is-current', Number(card.dataset.voceroLevel) === level);
    const videos = progress.videos ?? [];
    const videoPanel = root.querySelector('[data-vocero-videos]');
    const enabledCount = videos.filter(video => Boolean(video.unlocked)).length;
    for (const count of root.querySelectorAll('[data-vocero-videos-count]')) count.textContent = String(enabledCount);
    if (videoPanel) videoPanel.open = enabledCount > 0 || Number(progress.videos_unlocked) > 0;
    for (const slotElement of root.querySelectorAll('[data-video-slot]')) {
      const slot = Number(slotElement.dataset.videoSlot); const video = videos.find(item => Number(item.slot) === slot) ?? { slot, unlocked: false, url: '', status: 'empty' };
      const submitted = video.status === 'submitted' && String(video.url ?? '').trim() !== '';
      const unlocked = Boolean(video.unlocked) && state.editable && !submitted;
      const input = slotElement.querySelector('[data-video-url]'); const button = slotElement.querySelector('[data-video-save]'); const status = slotElement.querySelector('[data-video-status]');
      if (input) { input.disabled = !unlocked; input.value = video.url ?? ''; input.readOnly = submitted; }
      if (button) button.disabled = !unlocked;
      if (status) status.textContent = !video.unlocked ? `Bloqueado hasta ${videoEnabledDate(video.enabled_at) || 'que coordinación lo habilite'}` : submitted ? `Enlace recibido y bloqueado · Disponible desde ${videoEnabledDate(video.enabled_at) || 'la fecha indicada'}` : `Habilitado para enviar · Disponible desde ${videoEnabledDate(video.enabled_at) || 'la fecha indicada'}`;
      slotElement.dataset.locked = String(!unlocked);
    }
  }
  async function updateBadge(profile, photoBlob = null) {
    if (!badgePanel) return;
    if (!profile.profile_complete || !profile.photo?.available) {
      badgePanel.hidden = true; badgeStatus.textContent = 'Completa tus datos, consentimientos y fotografía para habilitar el gafete.'; return;
    }
    badgePanel.hidden = false; badgeStatus.textContent = 'Preparando tu gafete…';
    try {
      const blob = photoBlob ?? await api.photo();
      const badge = await badgeBlob(profile, blob, runtime.siteOrigin);
      if (!badge) throw new Error('No se pudo generar la imagen.');
      if (badgeUrl) URL.revokeObjectURL(badgeUrl);
      badgeUrl = URL.createObjectURL(badge); badgePreview.src = badgeUrl; badgeStatus.textContent = 'Listo para compartir en tus redes.';
    } catch { badgeStatus.textContent = 'Completa tu perfil y vuelve a abrir esta pantalla para generar el gafete.'; }
  }
  const downloadBadge = root.querySelector('[data-vocero-badge-download]');
  const shareBadge = root.querySelector('[data-vocero-badge-share]');
  downloadBadge?.addEventListener('click', () => { if (!badgeUrl) return; const link = document.createElement('a'); link.href = badgeUrl; link.download = 'gafete-emprendedor-finados-2026.png'; link.click(); });
  shareBadge?.addEventListener('click', async () => {
    if (!badgeUrl) return;
    try {
      const blob = await fetch(badgeUrl).then(response => response.blob());
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'gafete-emprendedor-finados-2026.png', { type: 'image/png' })] })) await navigator.share({ title: 'Emprendedor participante Finados Mushuc Runa 2026', files: [new File([blob], 'gafete-emprendedor-finados-2026.png', { type: 'image/png' })] });
      else { downloadBadge.click(); badgeStatus.textContent = 'Tu dispositivo descargó el gafete para compartirlo.'; }
    } catch { badgeStatus.textContent = 'No se pudo compartir. Descarga el gafete e inténtalo desde tu red social.'; }
  });
  for (const slotElement of root.querySelectorAll('[data-video-slot]')) slotElement.querySelector('[data-video-save]')?.addEventListener('click', async () => {
    const slot = Number(slotElement.dataset.videoSlot); const input = slotElement.querySelector('[data-video-url]'); const url = input.value.trim();
    if (!/^https:\/\//i.test(url)) { message('Pega un enlace seguro que comience con https://', true); input.focus(); return; }
    try { slotElement.querySelector('[data-video-save]').disabled = true; const saved = await api.saveVideo(slot, url); populate(saved); message(`Video ${slot} guardado.`); }
    catch (error) { reportError(error); }
  });
  const register = root.querySelector('[data-vocero-register]');
  const login = root.querySelector('[data-vocero-login]');
  function setMode({ mode, email, message: text }) {
    const source = register.hidden ? login : register;
    const rememberedEmail = email ?? source.elements.namedItem('email').value;
    register.hidden = mode !== 'register'; login.hidden = mode !== 'login';
    const active = mode === 'register' ? register : login;
    active.elements.namedItem('email').value = rememberedEmail;
    for (const form of [register, login]) for (const input of form.querySelectorAll('input[type="password"]')) input.value = '';
    for (const button of root.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    if (text) message(text); else active.elements.namedItem('email').focus();
  }
  for (const button of root.querySelectorAll('[data-mode]')) button.addEventListener('click', () => setMode({ mode: button.dataset.mode }));
  if (view === 'access' && new URLSearchParams(location.search).get('modo') === 'login') setMode({ mode: 'login' });
  // Remove the recovery token from the address bar before any subsequent navigation.
  let resetToken = view === 'reset' ? new URLSearchParams(location.search).get('token') ?? '' : '';
  if (view === 'reset' && location.search) globalThis.history?.replaceState(null, '', location.pathname);
  const setAutoSaveStatus = (text, error = false) => {
    if (!autoSaveStatus) return;
    autoSaveStatus.textContent = text;
    autoSaveStatus.dataset.error = String(error);
  };
  function validateProfileBusinessRules(data) {
    const age = ageToday(data.get('fecha_nacimiento'));
    if (!Number.isFinite(age) || age < 18) throw new Error('El programa recibe personas mayores de edad. Revisa tu fecha de nacimiento.');
    if (!['tiktok', 'instagram', 'facebook'].some(name => data.get(name)?.trim())) throw new Error('Ingresa al menos un enlace de tu perfil social.');
  }
  async function saveProfile({ auto = false } = {}) {
    if (!profileForm || !state.editable || profileForm.getAttribute('aria-busy') === 'true') return false;
    const fields = profileForm.querySelector('fieldset');
    try {
      if (auto && !isProfileReadyForAutoSave(profileForm)) return false;
      if (!auto) validateForm(profileForm);
      // FormData must be captured before disabling controls.
      const data = new FormData(profileForm);
      validateProfileBusinessRules(data);
      fields.disabled = true; profileForm.setAttribute('aria-busy', 'true');
      setAutoSaveStatus(auto ? 'Guardando cambios…' : 'Guardando…');
      const saved = await api.saveProfile(state.body(data));
      populate(saved);
      if (photo) photo.value = '';
      clearPhoto();
      setAutoSaveStatus(auto ? 'Guardado automáticamente.' : 'Guardado correctamente.');
      message(auto ? 'Cambios guardados automáticamente.' : 'Registro guardado. Puedes consultar aquí el estado de tu participación.', false, !auto);
      if (saved.photo?.available) {
        try { const blob = await loadSavedPhoto(); await updateBadge(saved, blob); }
        catch { message('Registro guardado. No se pudo cargar la vista previa de tu foto; vuelve a abrir tu registro para consultarla.', false, !auto); }
      }
      return true;
    } catch (error) {
      reportError(error);
      setAutoSaveStatus(auto ? 'No se pudo guardar automáticamente. Revisa tu conexión.' : '', true);
      return false;
    } finally {
      fields.disabled = !state.editable;
      profileForm.setAttribute('aria-busy', 'false');
    }
  }
  const scheduleAutoSave = () => {
    if (!ready || !profileForm || !state.editable || profileForm.getAttribute('aria-busy') === 'true') return;
    if (!isProfileReadyForAutoSave(profileForm)) return;
    autoSaveScheduler?.schedule();
  };
  autoSaveScheduler = profileForm ? createAutoSaveScheduler(() => saveProfile({ auto: true })) : null;
  function submit(form, action) {
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!ready || form.getAttribute('aria-busy') === 'true') return;
      const fields = form.querySelector('fieldset');
      try {
        validateForm(form);
        // FormData must be captured before disabling controls.
        const data = new FormData(form);
        const result = action(data);
        fields.disabled = true; form.setAttribute('aria-busy', 'true'); message('Guardando…');
        await result;
      } catch (error) { reportError(error); }
      finally { fields.disabled = view === 'profile' ? !state.editable : false; form.setAttribute('aria-busy', 'false'); }
    });
  }
  submit(register, async data => {
    await registerAndSwitchToLogin(api, data.get('email'), data.get('password'), setMode);
  });
  submit(login, async data => {
    const result = await api.login(data.get('email'), data.get('password'));
    if (result.authenticated !== true || result.user?.role !== 'emprendedor') throw new EmprendedorError(401, 'login');
    location.assign(PROFILE);
  });
  submit(root.querySelector('[data-vocero-reset]'), async data => {
    if (!/^[a-f0-9]{64}$/.test(resetToken)) throw new Error('El enlace no es válido. Solicita un enlace nuevo a la coordinación.');
    await api.reset(resetToken, data.get('password'));
    resetToken = '';
    for (const form of forms) { form.reset(); form.hidden = true; }
    message('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
  });
  profileForm?.addEventListener('submit', event => {
    event.preventDefault();
    if (!ready || profileForm.getAttribute('aria-busy') === 'true') return;
    void saveProfile();
  });
  photo?.addEventListener('change', () => {
    const selected = photo.files?.[0];
    if (!selected) return;
    try { validatePhoto(selected); photoGeneration++; showPhoto(selected); message('Fotografía lista para guardar.'); }
    catch (error) { photoGeneration++; photo.value = ''; clearPhoto(); reportError(error); }
  });
  root.querySelector('[data-photo-replace]')?.addEventListener('click', () => photo.click());
  profileForm?.addEventListener('input', scheduleAutoSave);
  profileForm?.addEventListener('change', scheduleAutoSave);
  const logout = root.querySelector('[data-vocero-logout]');
  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { autoSaveScheduler?.cancel(); await api.logout(); photoGeneration++; clearPhoto(); profileForm.reset(); location.assign(ACCESS); }
    catch (error) { reportError(error); logout.disabled = false; }
  });
  async function start() {
    retry.hidden = true; ready = false;
    try {
      const session = await api.session();
      if (view === 'profile') {
        if (!session.authenticated || session.user?.role !== 'emprendedor') { location.replace(ACCESS); return; }
        const profile = await api.profile();
        populate(profile); logout.disabled = false; ready = true; message('');
        if (profile.photo?.available) {
          try { const blob = await loadSavedPhoto(); await updateBadge(profile, blob); } catch (error) { reportError(error); }
        }
      } else {
        if (view === 'access' && session.authenticated && session.user?.role === 'emprendedor') { location.replace(PROFILE); return; }
        if (view === 'reset' && !/^[a-f0-9]{64}$/.test(resetToken)) throw new Error('El enlace no es válido. Solicita un enlace nuevo a la coordinación.');
        for (const form of forms) form.querySelector('fieldset').disabled = false;
        ready = true; message('');
      }
    } catch (error) { reportError(error); retry.hidden = false; }
  }
  retry.addEventListener('click', start);
  await start();
}

if (typeof document !== 'undefined') initializeEmprendedorPortal();
