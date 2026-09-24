import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from './runtime-origins.mjs';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
const BASE = '/finados/mfs';
const ACCESS = `${BASE}/acceso/?modo=login`;
const PROFILE = `${BASE}/mi-registro/`;
export const MFS_FIELDS = Object.freeze(['nombre_completo', 'nombre_artistico', 'cedula', 'whatsapp', 'audicion_tiktok']);
export const MFS_CHECKS = Object.freeze(['declaracion_video', 'consentimiento_bases', 'autorizacion_imagen', 'consentimiento_datos']);
const PROFILE_KEYS = Object.freeze({ nombre_completo: 'full_name', nombre_artistico: 'stage_name', cedula: 'cedula', whatsapp: 'whatsapp', audicion_tiktok: 'audition_url' });
const CELEBRATE = Object.freeze(['Aprobado', 'Seleccionado']);

export class MfsError extends Error {
  constructor(status, context = '') {
    super(({ 0: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.',
      401: context === 'login' ? 'No se pudo iniciar sesión. Revisa tu correo y contraseña.' : 'Tu sesión venció. Inicia sesión nuevamente.',
      403: 'No se autorizó el cambio. Tu inscripción puede estar en revisión.',
      404: 'La función o el enlace no está disponible. Solicita ayuda a la coordinación.',
      409: 'Ya existe una inscripción con esa cédula o ese número de WhatsApp. Consulta con la coordinación.',
      413: 'El archivo supera el tamaño permitido. Selecciona una fotografía de máximo 5 MB.',
      415: 'El formato no es compatible. Selecciona una fotografía JPG, PNG o WebP.',
      422: 'Revisa los campos, la fotografía, el enlace de TikTok y los consentimientos.',
      429: 'Hay demasiados intentos. Espera 15 minutos antes de volver a intentar.' })[status] ?? 'No se pudo completar la solicitud. Intenta de nuevo.');
    this.status = status;
    if (context === 'reset' && [401, 403, 404, 422].includes(status)) this.message = 'El enlace de recuperación venció, ya fue usado o no está disponible. Solicita un enlace nuevo a la coordinación.';
  }
}

export class MfsApiClient {
  #csrf = '';
  constructor(baseUrl = API, fetchImplementation = globalThis.fetch) {
    if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
    this.baseUrl = baseUrl;
    this.fetch = fetchImplementation;
  }
  async request(path, { body, blob = false } = {}) {
    if (!/^\/(?:auth\/(?:session|register|login|logout|reset)|profile|photo|cedula)$/.test(path)) throw new Error('Ruta de API no permitida.');
    if (body !== undefined && !this.#csrf) await this.session();
    const headers = { Accept: blob ? 'image/jpeg' : 'application/json' };
    const multipart = body instanceof FormData;
    if (body !== undefined) {
      if (!this.#csrf) throw new MfsError(403);
      headers['X-CSRF-Token'] = this.#csrf;
      if (!multipart) headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      const fetchImplementation = this.fetch;
      response = await fetchImplementation(`${this.baseUrl}/mfs${path}`, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'include', cache: 'no-store', redirect: 'error',
        referrerPolicy: 'no-referrer', headers,
        ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
      });
    } catch { throw new MfsError(0); }
    if (blob && response.ok) return response.blob();
    let data;
    try { data = await response.json(); } catch { throw new MfsError(response.ok ? 502 : response.status); }
    if (typeof data?.csrf === 'string') this.#csrf = data.csrf;
    if (!response.ok) {
      if ([401, 403].includes(response.status)) this.#csrf = '';
      throw new MfsError(response.status, path === '/auth/login' ? 'login' : path === '/auth/reset' ? 'reset' : '');
    }
    return data;
  }
  session() { return this.request('/auth/session'); }
  register(email, password) { return this.request('/auth/register', { body: { email, password, privacyAcknowledged: true } }); }
  login(email, password) { return this.request('/auth/login', { body: { email, password } }); }
  async logout() { const result = await this.request('/auth/logout', { body: {} }); this.#csrf = ''; return result; }
  profile() { return this.request('/profile'); }
  saveProfile(body) { return this.request('/profile', { body }); }
  photo() { return this.request('/photo', { blob: true }); }
  addCedula(cedula) { return this.request('/cedula', { body: { cedula } }); }
  reset(token, password) { return this.request('/auth/reset', { body: { token, password } }); }
}

/** Arma el multipart exacto que espera el servidor: campos, casillas y la foto solo si hay una nueva. */
export function buildMfsFormData(form, file = null) {
  const data = new FormData();
  for (const name of MFS_FIELDS) data.append(name, String(form.elements[name]?.value ?? '').trim());
  for (const name of MFS_CHECKS) data.append(name, form.elements[name]?.checked ? 'Sí' : 'No');
  if (file) data.append('fotografia', file);
  return data;
}

/** Validación en el navegador que replica la del servidor, para avisar antes de enviar. */
export function validateMfsForm(values, { hasPhoto }) {
  if (!hasPhoto) return 'Sube tu fotografía tipo retrato.';
  if ((values.nombre_completo ?? '').trim().length < 5) return 'Escribe tus nombres y apellidos.';
  if (!/^\d{10}$/.test((values.cedula ?? '').trim())) return 'La cédula debe tener 10 dígitos.';
  if (!/^09\d{8}$/.test((values.whatsapp ?? '').trim())) return 'El WhatsApp debe tener 10 dígitos y empezar con 09.';
  let url;
  try { url = new URL((values.audicion_tiktok ?? '').trim()); } catch { return 'Pega el enlace completo de tu video en TikTok.'; }
  const hosts = ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'];
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.pathname.length < 2) return 'El enlace debe ser de un video público de TikTok (https://www.tiktok.com/…).';
  return '';
}


/** Fecha y hora en Ecuador, que es como la entiende el participante. */
export function ecuadorDateTime(value) {
  if (!value) return '';
  const parsed = new Date(/Z$|[+-]\d\d:\d\d$/.test(value) ? value : String(value).replace(' ', 'T') + 'Z');
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Guayaquil', hourCycle: 'h23' }).format(parsed);
}

/** El mensaje de cada estado: la inscripción se cuenta con la emoción de la competencia. */
export function mfsStatusMessage(profile = {}) {
  const name = String(profile.stage_name || profile.full_name || '').trim();
  const hey = name ? `${name}, ` : '';
  if (!profile.registered) return { state: 'calm', kicker: 'Inscripción gratuita · 32 cupos', title: 'Tu lugar en la tarima empieza aquí', text: 'Completa tus datos, sube tu foto y pega el enlace de tu audición en TikTok. Tienes hasta el jueves 29 de octubre, 23:59.' };
  const messages = {
    'Nuevo': { state: 'default', kicker: 'Inscripción recibida', title: `¡${hey}ya estás en la lista!`, text: 'Recibimos tu audición. La coordinación la va a escuchar y te avisaremos por WhatsApp. Mientras tanto, sigue afinando tus barras.' },
    'En revisión': { state: 'default', kicker: 'Audición en revisión', title: 'Estamos escuchando tu audición', text: 'La coordinación está revisando tu video. Prepárate: muy pronto sabrás si subes a la tarima de la Plaza de la Luna.' },
    'Aprobado': { state: 'celebrate', kicker: 'Audición aprobada', title: `¡${hey}tu audición fue aprobada!`, text: 'Tu flow convenció. Estás un paso más cerca de la final en la Plaza de la Luna, el lunes 2 de noviembre a las 13:00. Descarga tu gafete y compártelo.' },
    'Seleccionado': { state: 'celebrate', kicker: '¡Estás dentro de los 32!', title: `¡${hey}nos vemos en la tarima!`, text: 'Fuiste seleccionado para competir en Mushuc Freestyle 2026. La final es el lunes 2 de noviembre a las 13:00 en la Plaza de la Luna. Descarga tu gafete y que todos lo sepan.' },
    'Rechazado': { state: 'calm', kicker: 'Resultado de tu audición', title: 'Esta vez no fue, pero la plaza te espera', text: 'Tu audición no quedó entre las seleccionadas. Gracias por atreverte a rimar: te esperamos en la Plaza de la Luna para vivir la final y en la próxima edición.' },
  };
  return messages[profile.status] ?? { state: 'default', kicker: 'Tu inscripción', title: `Estado: ${profile.status ?? '—'}`, text: '' };
}

export function canShowMfsBadge(profile = {}) {
  return Boolean(profile.registered && CELEBRATE.includes(profile.status) && profile.photo?.available);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
}

/** Gafete en formato historia (1080 × 1920) con el arte de Mushuc Freestyle. No lleva cédula, correo ni teléfono. */
export async function mfsBadgeBlob(profile, photoBlob) {
  if (!globalThis.document?.createElement || !photoBlob) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const W = canvas.width, H = canvas.height;
  const BLUE = '#173976', DEEP = '#0f2856', LIME = '#c2e817', CREAM = '#f4eada';
  const round = (x, y, width, height, radius) => { context.beginPath(); if (context.roundRect) context.roundRect(x, y, width, height, radius); else context.rect(x, y, width, height); };
  try {
    if (globalThis.FontFace && document.fonts) {
      const badeen = new FontFace('Badeen Display', 'url(/assets/finados/mfs/fonts/badeen-display-latin.woff2)');
      document.fonts.add(await badeen.load());
    }
    await Promise.all(['900 80px Inter', '800 30px Inter', '700 30px Inter'].map(font => document.fonts?.load(font)));
  } catch { /* si una fuente falla, el gafete se dibuja con la de respaldo */ }
  const [background, letters, logo, finados, photo] = await Promise.all([
    loadImage('/assets/finados/mfs/mfs-fondo-1600.webp').catch(() => null),
    loadImage('/assets/finados/mfs/mfs-letras.svg').catch(() => null),
    loadImage('/assets/finados/mfs/mfs-logo.svg').catch(() => null),
    loadImage('/assets/finados/logo-finados.svg').catch(() => null),
    globalThis.createImageBitmap ? globalThis.createImageBitmap(photoBlob) : loadImage(URL.createObjectURL(photoBlob)),
  ]);

  context.fillStyle = BLUE; context.fillRect(0, 0, W, H);
  if (background) { const scale = Math.max(W / background.width, H / background.height); context.drawImage(background, (W - background.width * scale) / 2, (H - background.height * scale) / 2, background.width * scale, background.height * scale); }
  if (letters) { context.save(); context.globalAlpha = .95; context.drawImage(letters, 180, -120, 1260, 1260); context.restore(); }

  // Logo sobre una placa azul, como en el arte oficial.
  if (logo) {
    const width = 820, height = width * logo.height / logo.width;
    context.fillStyle = BLUE; round((W - width) / 2 - 28, 96, width + 56, height + 56, 28); context.fill();
    context.drawImage(logo, (W - width) / 2, 124, width, height);
  }

  // Retrato con borde crema, ligeramente girado como un recorte.
  const frame = { x: 190, y: 470, width: 700, height: 860 };
  context.save();
  context.translate(W / 2, frame.y + frame.height / 2); context.rotate(-.025); context.translate(-W / 2, -(frame.y + frame.height / 2));
  context.fillStyle = CREAM; round(frame.x - 22, frame.y - 22, frame.width + 44, frame.height + 44, 26); context.fill();
  context.save(); round(frame.x, frame.y, frame.width, frame.height, 16); context.clip();
  const scale = Math.max(frame.width / photo.width, frame.height / photo.height);
  context.drawImage(photo, frame.x + (frame.width - photo.width * scale) / 2, frame.y + (frame.height - photo.height * scale) / 2, photo.width * scale, photo.height * scale);
  context.restore(); context.restore();
  photo.close?.();

  // Sello del estado en Badeen, la voz de la marca.
  const stamp = profile.status === 'Seleccionado' ? 'SELECCIONADO' : 'APROBADO';
  context.save(); context.translate(W / 2, 1352); context.rotate(-.04);
  context.font = '400 88px "Badeen Display", "Arial Black", sans-serif';
  const stampWidth = Math.min(900, context.measureText(stamp).width + 80);
  context.fillStyle = DEEP; context.fillRect(-stampWidth / 2 + 10, -62, stampWidth, 116);
  context.fillStyle = LIME; context.fillRect(-stampWidth / 2, -72, stampWidth, 116);
  context.fillStyle = BLUE; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(stamp, 0, -10);
  context.restore();

  // Nombre legible: Inter extra negrita, ajustado al ancho.
  context.textAlign = 'center'; context.textBaseline = 'alphabetic';
  const stageName = String(profile.stage_name || '').trim().slice(0, 32);
  const fullName = String(profile.full_name || '').trim().slice(0, 48);
  const fit = (text, start, min, weight) => { let size = start; while (size > min) { context.font = `${weight} ${size}px Inter, Arial, sans-serif`; if (context.measureText(text).width <= 920) break; size -= 2; } return size; };
  if (stageName) {
    fit(stageName.toUpperCase(), 104, 56, 900); context.fillStyle = LIME; context.fillText(stageName.toUpperCase(), W / 2, 1530);
    fit(fullName, 44, 28, 700); context.fillStyle = CREAM; context.fillText(fullName, W / 2, 1592);
  } else {
    fit(fullName.toUpperCase(), 84, 44, 900); context.fillStyle = LIME; context.fillText(fullName.toUpperCase(), W / 2, 1560);
  }
  context.fillStyle = CREAM; context.font = '800 30px Inter, Arial, sans-serif';
  context.fillText('FINAL · LUNES 2 DE NOVIEMBRE · 13:00', W / 2, 1668);
  context.font = '700 28px Inter, Arial, sans-serif';
  context.fillText('Plaza de la Luna · Complejo Mushuc Runa', W / 2, 1712);

  // Pie: franja lima con la edición y el logo de Finados.
  context.fillStyle = LIME; context.fillRect(0, H - 150, W, 150);
  context.fillStyle = BLUE; context.textAlign = 'left'; context.font = '900 40px Inter, Arial, sans-serif'; context.fillText('MUSHUC FREESTYLE 2026', 70, H - 86);
  context.font = '800 26px Inter, Arial, sans-serif'; context.fillText('2DA EDICIÓN · #MUSHUCFREESTYLE', 70, H - 44);
  if (finados) { const width = 210, height = width * finados.height / finados.width; context.fillStyle = BLUE; round(W - width - 110, H - 138, width + 40, height + 16, 14); context.fill(); context.drawImage(finados, W - width - 90, H - 130, width, height); }
  context.strokeStyle = LIME; context.lineWidth = 18; context.strokeRect(9, 9, W - 18, H - 18);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

export function initializeMfsPortal() {
  const body = document.body;
  const view = body?.dataset?.mfsView;
  if (!view) return;
  const configured = document.querySelector('meta[name="mfs-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configured || runtime.apiBase;
  const feedback = document.querySelector('[data-mfs-feedback]');
  const say = (message, kind = '') => { if (!feedback) return; feedback.textContent = message; feedback.dataset.error = String(kind === 'error'); feedback.dataset.success = String(kind === 'success'); };
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) { say('La configuración de acceso no es válida.', 'error'); return; }
  if (!isAllowedSiteOrigin(location.origin) && !(LOCAL_API && location.hostname === new URL(LOCAL_API).hostname)) { say('Origen no permitido.', 'error'); return; }
  const client = new MfsApiClient(base);
  const loginLink = document.querySelector('[data-session-login]');
  const retry = document.querySelector('[data-session-retry]');
  const enable = (form, on = true) => { const fieldset = form?.querySelector('fieldset'); if (fieldset) fieldset.disabled = !on; };
  const fail = error => {
    if (error.status === 401 && view === 'profile') { location.replace(ACCESS); return; }
    say(error.message, 'error');
    feedback?.focus();
    if (error.status === 401 && loginLink) loginLink.hidden = false;
    if (error.status === 0 && retry) retry.hidden = false;
  };
  retry?.addEventListener('click', () => location.reload());

  if (view === 'access') {
    const register = document.querySelector('[data-mfs-register]');
    const login = document.querySelector('[data-mfs-login]');
    const show = mode => {
      register.hidden = mode !== 'register';
      login.hidden = mode !== 'login';
      for (const button of document.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === mode));
    };
    for (const button of document.querySelectorAll('[data-mode]')) button.addEventListener('click', () => show(button.dataset.mode));
    if (new URLSearchParams(location.search).get('modo') === 'login') show('login');
    register.addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(register);
      if (!register.checkValidity()) { say('Completa el correo, la contraseña (mínimo 10 caracteres) y la casilla de privacidad.', 'error'); return; }
      if (String(form.get('password')) !== String(register.querySelector('#register-confirmation').value)) { say('Las contraseñas no coinciden.', 'error'); return; }
      enable(register, false);
      try {
        await client.register(String(form.get('email')).trim(), String(form.get('password')));
        const loginEmail = login.querySelector('#login-email');
        if (loginEmail) loginEmail.value = String(form.get('email')).trim();
        say('Cuenta creada. Ahora inicia sesión para completar tu inscripción.', 'success');
        show('login');
      } catch (error) { fail(error); } finally { enable(register); }
    });
    login.addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(login);
      enable(login, false);
      try {
        await client.login(String(form.get('email')).trim(), String(form.get('password')));
        location.replace(PROFILE);
      } catch (error) { fail(error); enable(login); }
    });
    client.session().then(session => {
      if (session.authenticated) { location.replace(PROFILE); return; }
      enable(register); enable(login); say('');
    }).catch(fail);
    return;
  }

  if (view === 'reset') {
    const form = document.querySelector('[data-mfs-reset]');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const password = String(new FormData(form).get('password'));
      if (password !== form.querySelector('#reset-confirmation').value) { say('Las contraseñas no coinciden.', 'error'); return; }
      const token = new URLSearchParams(location.search).get('token') ?? '';
      enable(form, false);
      try {
        await client.reset(token, password);
        say('Contraseña actualizada. Ya puedes iniciar sesión.', 'success');
      } catch (error) { fail(error); } finally { enable(form); }
    });
    client.session().then(() => { enable(form); say(''); }).catch(fail);
    return;
  }

  const form = document.querySelector('[data-mfs-profile]');
  const saveStatus = form.querySelector('[data-save-status]');
  const saveButton = form.querySelector('[data-save-button]');
  const logout = document.querySelector('[data-mfs-logout]');
  const photoInput = form.querySelector('#fotografia');
  const preview = form.querySelector('[data-photo-preview]');
  const placeholder = form.querySelector('[data-photo-placeholder]');
  const photoLabel = form.querySelector('[data-photo-label]');
  let hasSavedPhoto = false;
  let previewUrl = '';

  const showPhoto = blob => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob);
    preview.src = previewUrl;
    preview.hidden = false;
    placeholder.hidden = true;
  };
  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { say(new MfsError(415).message, 'error'); photoInput.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { say(new MfsError(413).message, 'error'); photoInput.value = ''; return; }
    showPhoto(file);
    if (photoLabel) photoLabel.textContent = 'Cambiar fotografía';
  });

  const statusPanel = document.querySelector('[data-mfs-status]');
  const cedulaPanel = document.querySelector('[data-mfs-cedula]');
  const cedulaForm = document.querySelector('[data-mfs-cedula-form]');
  const sent = document.querySelector('[data-mfs-sent]');
  const badgePanel = document.querySelector('[data-mfs-badge]');
  const badgePreview = document.querySelector('[data-mfs-badge-preview]');
  const badgeStatus = document.querySelector('[data-mfs-badge-status]');
  const badgeDownload = document.querySelector('[data-mfs-badge-download]');
  const badgeShare = document.querySelector('[data-mfs-badge-share]');
  let badgeUrl = '';
  let badgeFile = null;
  let photoBlob = null;

  function showStatus(profile) {
    const message = mfsStatusMessage(profile);
    statusPanel.dataset.state = message.state;
    statusPanel.querySelector('[data-mfs-status-kicker]').textContent = message.kicker;
    statusPanel.querySelector('[data-mfs-status-title]').textContent = message.title;
    statusPanel.querySelector('[data-mfs-status-text]').textContent = message.text;
    const when = profile.registered ? ecuadorDateTime(profile.submitted_at) : '';
    statusPanel.querySelector('[data-mfs-status-meta]').textContent = when ? `Inscripción recibida el ${when} (hora de Ecuador).` : '';
    cedulaPanel.hidden = !(profile.registered && profile.cedula_missing);
    // Una inscripción revisada se guarda plegada: ya no es un formulario para llenar.
    if (profile.registered && profile.editable === false) {
      if (form.parentElement !== sent) sent.append(form);
      sent.hidden = false;
    }
  }

  async function showBadge(profile) {
    if (!canShowMfsBadge(profile)) { badgePanel.hidden = true; return; }
    badgePanel.hidden = false;
    badgeStatus.textContent = 'Preparando tu gafete…';
    try {
      photoBlob ??= await client.photo();
      const blob = await mfsBadgeBlob(profile, photoBlob);
      if (!blob) throw new Error();
      if (badgeUrl) URL.revokeObjectURL(badgeUrl);
      badgeUrl = URL.createObjectURL(blob);
      badgeFile = new File([blob], 'gafete-mushuc-freestyle-2026.png', { type: 'image/png' });
      badgePreview.src = badgeUrl; badgePreview.hidden = false;
      badgeDownload.disabled = false; badgeShare.disabled = false;
      badgeStatus.textContent = '¡Listo! Descárgalo y súbelo a tus historias.';
    } catch { badgeStatus.textContent = 'No se pudo preparar el gafete. Recarga la página para intentarlo de nuevo.'; }
  }
  badgeDownload?.addEventListener('click', () => {
    if (!badgeUrl) return;
    const link = document.createElement('a'); link.href = badgeUrl; link.download = 'gafete-mushuc-freestyle-2026.png'; document.body.append(link); link.click(); link.remove();
  });
  badgeShare?.addEventListener('click', async () => {
    if (!badgeFile) return;
    try {
      if (navigator.share && navigator.canShare?.({ files: [badgeFile] })) await navigator.share({ title: 'Mushuc Freestyle 2026', text: '¡Nos vemos en la Plaza de la Luna! #MushucFreestyle', files: [badgeFile] });
      else { badgeDownload.click(); badgeStatus.textContent = 'Tu dispositivo descargó el gafete para que lo compartas.'; }
    } catch (error) { if (error?.name !== 'AbortError') badgeStatus.textContent = 'No se pudo compartir. Descarga el gafete y súbelo desde tu red social.'; }
  });
  cedulaForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const value = String(cedulaForm.elements.cedula.value).trim();
    if (!/^\d{10}$/.test(value)) { say('La cédula debe tener 10 dígitos.', 'error'); feedback?.focus(); return; }
    enable(cedulaForm, false);
    try {
      const saved = await client.addCedula(value);
      fill(saved); showStatus(saved);
      say('Cédula guardada. ¡Gracias!', 'success');
    } catch (error) { fail(error); enable(cedulaForm); }
  });

  function fill(profile) {
    const mail = form.querySelector('[data-account-email]');
    if (mail) mail.value = profile.email ?? '';
    if (!profile.registered) return;
    for (const [name, key] of Object.entries(PROFILE_KEYS)) {
      const input = form.elements[name];
      if (input && profile[key] !== undefined) input.value = profile[key] ?? '';
    }
    // La audición enviada queda fija; las casillas ya aceptadas vuelven marcadas.
    const audition = form.elements.audicion_tiktok;
    audition.readOnly = true;
    audition.setAttribute('aria-readonly', 'true');
    for (const name of MFS_CHECKS) if (form.elements[name]) form.elements[name].checked = true;
    if (saveButton) saveButton.textContent = 'Guardar cambios';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const file = photoInput.files?.[0] ?? null;
    const values = Object.fromEntries(MFS_FIELDS.map(name => [name, form.elements[name]?.value ?? '']));
    const problem = validateMfsForm(values, { hasPhoto: hasSavedPhoto || Boolean(file) });
    if (problem) { say(problem, 'error'); feedback?.focus(); return; }
    if (!MFS_CHECKS.every(name => form.elements[name]?.checked)) { say('Marca la declaración del video y los tres consentimientos.', 'error'); feedback?.focus(); return; }
    enable(form, false);
    if (saveStatus) saveStatus.textContent = 'Enviando…';
    try {
      const saved = await client.saveProfile(buildMfsFormData(form, file));
      hasSavedPhoto = Boolean(saved.photo?.available);
      photoInput.value = '';
      fill(saved);
      showStatus(saved);
      showBadge(saved);
      say('¡Inscripción recibida! Te contactaremos por WhatsApp con el resultado de la revisión.', 'success');
      statusPanel.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
      if (saveStatus) saveStatus.textContent = 'Guardado.';
      if (!saved.editable) enable(form, false);
      else enable(form);
    } catch (error) { if (saveStatus) saveStatus.textContent = ''; fail(error); enable(form); }
  });

  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await client.logout(); location.replace(ACCESS); }
    catch (error) { logout.disabled = false; fail(error); }
  });

  (async () => {
    try {
      const session = await client.session();
      if (!session.authenticated) { location.replace(ACCESS); return; }
      const profile = await client.profile();
      fill(profile);
      hasSavedPhoto = Boolean(profile.photo?.available);
      if (hasSavedPhoto) {
        try { photoBlob = await client.photo(); showPhoto(photoBlob); if (photoLabel) photoLabel.textContent = 'Cambiar fotografía'; } catch { /* la foto es opcional para mostrar */ }
      }
      showStatus(profile);
      if (profile.editable !== false) enable(form);
      if (logout) logout.disabled = false;
      say('');
      showBadge(profile);
    } catch (error) { fail(error); }
  })();
}

if (typeof document !== 'undefined') initializeMfsPortal();
