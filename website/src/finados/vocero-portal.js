const API = 'https://finados.complejomushucruna.com/api';
const LOCAL_API = 'http://127.0.0.1:4174/api';
const ACCESS = '/finados/voceros/acceso/?modo=login';
const PROFILE = '/finados/voceros/mi-registro/';

export class VoceroError extends Error {
  constructor(status, context = '') {
    super(({ 0: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.',
      401: context === 'login' ? 'No se pudo iniciar sesión. Revisa tu correo y contraseña.' : 'Tu sesión venció. Inicia sesión nuevamente.',
      403: 'No se autorizó el cambio. Tu registro puede estar en revisión o el acceso debe actualizarse.',
      404: 'La función o el enlace no está disponible. Solicita ayuda a la coordinación de Voceros.',
      409: 'Ya existe un registro con los datos proporcionados. Consulta con la coordinación de Voceros.',
      413: 'El archivo supera el tamaño permitido. Selecciona una fotografía de máximo 5 MB.',
      415: 'El formato no es compatible. Selecciona una fotografía JPG, PNG o WebP.',
      422: 'Revisa los campos, consentimientos y fotografía. No se pudo guardar la información.',
      429: 'Hay demasiados intentos. Espera 15 minutos antes de volver a intentar.' })[status] ?? 'No se pudo completar la solicitud. Intenta de nuevo.');
    this.status = status;
    if (context === 'reset' && [401, 403, 404, 422].includes(status)) this.message = 'El enlace de recuperación venció, ya fue usado o no está disponible. Solicita un enlace nuevo a la coordinación.';
  }
}

export class VoceroApiClient {
  #csrf = '';
  constructor(baseUrl = API, fetchImplementation = globalThis.fetch) {
    if (![API, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
    this.baseUrl = baseUrl;
    this.fetch = fetchImplementation;
  }
  async request(path, { body, blob = false } = {}) {
    if (!/^(?:\/(?:auth\/(?:session|register|login|logout|reset)|profile|photo)|\/videos\/[1-5])$/.test(path)) throw new Error('Ruta de API no permitida.');
    if (body !== undefined && !this.#csrf) await this.session();
    const headers = { Accept: blob ? 'image/jpeg' : 'application/json' };
    const multipart = body instanceof FormData;
    if (body !== undefined) {
      if (!this.#csrf) throw new VoceroError(403);
      headers['X-CSRF-Token'] = this.#csrf;
      if (!multipart) headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      const fetchImplementation = this.fetch;
      response = await fetchImplementation(`${this.baseUrl}/vocero${path}`, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'include', cache: 'no-store', redirect: 'error',
        referrerPolicy: 'no-referrer', headers,
        ...(body === undefined ? {} : { body: multipart ? body : JSON.stringify(body) }),
      });
    } catch { throw new VoceroError(0); }
    if (blob && response.ok) return response.blob();
    let data;
    try { data = await response.json(); } catch { throw new VoceroError(response.ok ? 502 : response.status); }
    if (typeof data?.csrf === 'string') this.#csrf = data.csrf;
    if (!response.ok) {
      if ([401, 403].includes(response.status)) this.#csrf = '';
      throw new VoceroError(response.status, path === '/auth/login' ? 'login' : path === '/auth/reset' ? 'reset' : '');
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
    if (result?.ok !== true) throw new VoceroError(502, 'reset');
    return result;
  }
}

export async function registerAndSwitchToLogin(api, email, password, setMode) {
  await api.register(email, password);
  setMode({ mode: 'login', email, message: 'Cuenta creada; inicia sesión con tu correo y contraseña para completar el registro.' });
}

export const PROFILE_FIELDS = Object.freeze({
  nombre_completo: 'full_name', cedula: 'cedula', fecha_nacimiento: 'birth_date', whatsapp: 'whatsapp', ciudad: 'city',
  tiktok: 'tiktok', instagram: 'instagram', facebook: 'facebook', red_principal: 'main_network',
  vocero_previo: 'previous_participation', fuente_comunidad: 'community_source', retiro_kit: 'kit_pickup',
  representante_nombre: 'representative_name', representante_cedula: 'representative_cedula',
  representante_telefono: 'representative_phone', representante_correo: 'representative_email',
  utm_source: 'utm_source', utm_medium: 'utm_medium', utm_campaign: 'utm_campaign', utm_content: 'utm_content', utm_term: 'utm_term',
});
const CONSENTS = ['consentimiento_politicas', 'autorizacion_imagen', 'consentimiento_datos'];
function newSubmissionId() {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
}
export function validatePhoto(file) {
  if (!file || file.size === 0) throw new Error('Selecciona una fotografía para identificación y gafete.');
  if (file.size > 5 * 1024 * 1024) throw new VoceroError(413);
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new VoceroError(415);
}
export class VoceroProfileState {
  constructor(generateId = newSubmissionId) { this.generateId = generateId; this.submissionId = ''; this.values = {}; }
  load(profile) {
    if (typeof profile.registered !== 'boolean') throw new VoceroError(502);
    if (profile.registered) {
      if (!/^[a-f0-9]{32}$/.test(profile.submission_id ?? '')) throw new VoceroError(502);
      this.submissionId = profile.submission_id;
    } else if (!this.submissionId) this.submissionId = this.generateId();
    this.photoRequired = !profile.registered;
    this.editable = !profile.registered || ['Nuevo', 'Pendiente de autorización'].includes(profile.status);
    this.values = Object.fromEntries(Object.entries(PROFILE_FIELDS).map(([name, key]) => [name, String(profile[key] ?? '')]));
    return this.values;
  }
  body(fields) {
    if (!this.editable || !this.submissionId) throw new VoceroError(403);
    const body = new FormData();
    for (const name of [...Object.keys(PROFILE_FIELDS), ...CONSENTS]) {
      const value = fields.get(name);
      body.set(name, typeof value === 'string' ? value : (this.values[name] ?? ''));
    }
    body.set('submission_id', this.submissionId);
    body.set('url_origen', 'https://complejomushucruna.com/finados/voceros/mi-registro/');
    const photo = fields.get('fotografia');
    if (photo?.size || this.photoRequired) {
      validatePhoto(photo);
      body.set('fotografia', photo, photo.name || 'fotografia.jpg');
    }
    return body;
  }
}

export class PhotoPreview {
  constructor(url = URL, events = globalThis) {
    this.url = url; this.current = '';
    events.addEventListener?.('pagehide', () => this.clear());
  }
  replace(blob) { this.clear(); this.current = this.url.createObjectURL(blob); return this.current; }
  clear() { if (this.current) this.url.revokeObjectURL(this.current); this.current = ''; }
}

function showFeedback(element, message, error = false) {
  element.textContent = message;
  element.dataset.error = String(error);
  element.setAttribute('role', error ? 'alert' : 'status');
  if (message) element.focus();
}
function ageToday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const [year, month, day] = value.split('-').map(Number);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [y, m, d] = today.split('-').map(Number);
  return y - year - (m < month || (m === month && d < day) ? 1 : 0);
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

async function loadBadgeImage(source) {
  if (!source) return null;
  return new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
}

async function badgeBlob(profile, photoBlob) {
  if (!globalThis.document?.createElement || !photoBlob) return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const context = canvas.getContext('2d');
  if (!context) return null;
  const roundRect = (x, y, width, height, radius) => { context.beginPath(); if (context.roundRect) context.roundRect(x, y, width, height, radius); else { context.rect(x, y, width, height); } };
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#241146'); gradient.addColorStop(0.44, '#3c1679'); gradient.addColorStop(1, '#df2b84');
  context.fillStyle = gradient; context.fillRect(0, 0, canvas.width, canvas.height);
  // Franja chumbi, marco cian y formas orbitantes para que se sienta como un póster de Finados.
  const chumbi = ['#ff2e8a', '#ffc42e', '#00d2d6', '#f4eada'];
  for (let x = 0, index = 0; x < canvas.width; x += 60, index += 1) {
    context.fillStyle = chumbi[index % chumbi.length]; context.fillRect(x, 0, 60, 24);
  }
  context.fillStyle = '#00d2d6'; context.fillRect(0, canvas.height - 24, canvas.width, 24);
  context.strokeStyle = '#00d2d6'; context.lineWidth = 6; context.strokeRect(22, 22, canvas.width - 44, canvas.height - 44);
  context.globalAlpha = .18; context.fillStyle = '#00d2d6'; context.beginPath(); context.arc(950, 260, 250, 0, Math.PI * 2); context.fill();
  context.fillStyle = '#ffc42e'; context.beginPath(); context.arc(120, 1515, 170, 0, Math.PI * 2); context.fill();
  context.globalAlpha = .3; context.strokeStyle = '#f4eada'; context.lineWidth = 6; context.beginPath(); context.arc(540, 670, 500, Math.PI * 1.04, Math.PI * 1.86); context.stroke(); context.globalAlpha = 1;
  context.fillStyle = '#ff2e8a'; context.save(); context.translate(-165, 705); context.rotate(-.35); context.fillRect(0, 0, 470, 82); context.restore();
  let logo = null;
  try { logo = await loadBadgeImage('/assets/finados/logo-finados.svg'); } catch { /* Logo is decorative; text remains the accessible fallback. */ }
  if (logo) { const maxW = 390; const maxH = 190; const scale = Math.min(maxW / logo.width, maxH / logo.height); context.drawImage(logo, (canvas.width - logo.width * scale) / 2, 70, logo.width * scale, logo.height * scale); }
  context.textAlign = 'center'; context.fillStyle = '#f4eada'; context.font = '700 25px Inter, Arial'; context.fillText('COMUNIDAD DE VOCEROS · FINADOS 2026', 540, 390);
  context.fillStyle = '#f5c84b'; context.font = '700 30px Inter, Arial'; context.fillText('GAFETE DIGITAL', 540, 438);
  context.textAlign = 'left';
  context.fillStyle = '#ffffff'; context.font = '900 116px Anton, Arial Narrow, sans-serif'; context.fillText('INVITADO', 70, 510); context.fillText('ESPECIAL', 70, 635);
  context.fillStyle = '#00cfd1'; context.fillRect(74, 682, 360, 12);
  const image = await (globalThis.createImageBitmap ? globalThis.createImageBitmap(photoBlob) : loadBadgeImage(URL.createObjectURL(photoBlob)));
  const frame = { x: 90, y: 760, width: 900, height: 730 };
  context.fillStyle = '#f4eada'; roundRect(frame.x - 16, frame.y - 16, frame.width + 32, frame.height + 32, 28); context.fill();
  context.save(); roundRect(frame.x, frame.y, frame.width, frame.height, 18); context.clip();
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  const width = image.width * scale; const height = image.height * scale;
  context.drawImage(image, frame.x + (frame.width - width) / 2, frame.y + (frame.height - height) / 2, width, height); context.restore();
  image.close?.();
  context.fillStyle = '#f4eada'; context.textAlign = 'left'; context.font = '700 29px Inter, Arial'; context.fillText('VOCERO OFICIAL', 82, 1590);
  context.fillStyle = '#ffffff'; context.font = '900 62px Inter, Arial';
  const name = String(profile.full_name ?? 'Vocero').trim().slice(0, 34);
  context.fillText(name, 80, 1680);
  context.fillStyle = '#f5c84b'; context.font = '700 26px Inter, Arial'; context.fillText('LEGADO QUE NOS UNE', 82, 1755);
  context.fillStyle = '#f4eada'; context.font = '500 23px Inter, Arial'; context.fillText('Comparte tu voz, celebra nuestras raíces.', 82, 1812);
  context.textAlign = 'right'; context.fillStyle = '#ffffff'; context.font = '700 23px Inter, Arial'; context.fillText('MUSHUC RUNA', 998, 1812);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

export async function initializeVoceroPortal(root = document, location = globalThis.location) {
  const view = root.body?.dataset.voceroView;
  if (!view) return;
  const api = new VoceroApiClient(root.querySelector('meta[name="vocero-api-base"]').content);
  const feedback = root.querySelector('[data-vocero-feedback]');
  const retry = root.querySelector('[data-session-retry]');
  const relogin = root.querySelector('[data-session-login]');
  const message = (text, error = false) => showFeedback(feedback, text, error);
  const reportError = error => { message(error.message, true); relogin.hidden = error.status !== 401 || view !== 'profile'; };
  root.addEventListener('input', event => event.target.removeAttribute?.('aria-invalid'));
  let ready = false;
  const forms = [...root.querySelectorAll('form')];
  const state = new VoceroProfileState();
  const preview = new PhotoPreview();
  const profileForm = root.querySelector('[data-vocero-profile]');
  const photo = root.querySelector('[name="fotografia"]');
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
  globalThis.addEventListener?.('pagehide', () => { photoGeneration++; clearPhoto(); });
  globalThis.addEventListener?.('pageshow', event => { if (event.persisted) location.reload(); });
  const loadSavedPhoto = async () => {
    const generation = ++photoGeneration;
    const blob = await api.photo();
    if (generation === photoGeneration) showPhoto(blob);
    return blob;
  };
  function updateMinor() {
    const age = ageToday(profileForm.elements.namedItem('fecha_nacimiento').value);
    const minor = Number.isFinite(age) && age >= 16 && age < 18;
    const section = root.querySelector('[data-vocero-minor]');
    section.hidden = !minor;
    for (const input of section.querySelectorAll('input')) { input.required = minor; input.disabled = !minor; }
  }
  function populate(profile) {
    const values = state.load(profile);
    for (const [name, value] of Object.entries(values)) {
      const input = profileForm.elements.namedItem(name);
      if (input) input.value = value;
    }
    root.querySelector('[data-account-email]').value = profile.email;
    root.querySelector('[data-profile-status]').textContent = profile.registered ? `Estado: ${profile.status}` : 'Completa tu registro para participar.';
    photo.required = state.photoRequired;
    root.querySelector('[data-photo-label]').textContent = profile.photo?.available ? 'Fotografía nueva (opcional)' : 'Seleccionar fotografía';
    profileForm.querySelector('fieldset').disabled = !state.editable;
    for (const button of profileForm.querySelectorAll('button[type="submit"]')) button.hidden = !state.editable;
    root.querySelector('[data-save-help]').textContent = state.editable ? 'Revisa tus datos y guarda tu registro.' : 'Tu registro está en revisión o ya tiene una decisión. Puedes consultar tus datos; para cambios, contacta a la coordinación.';
    root.querySelector('.vocero-consents').hidden = !state.editable;
    updateMinor();
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
    const kit = progressPanel.querySelector('[data-vocero-kit-status]'); if (kit) kit.textContent = progress.kit_status === 'retirado' ? 'Retirado' : 'Pendiente de retiro';
    for (const count of root.querySelectorAll('[data-vocero-videos-count]')) count.textContent = String(Math.max(0, Math.min(5, Number(progress.videos_unlocked) || 0)));
    const level = Number(progress.level) || 0;
    for (const card of progressPanel.querySelectorAll('[data-vocero-level]')) card.classList.toggle('is-current', Number(card.dataset.voceroLevel) === level);
    const videos = progress.videos ?? [];
    for (const slotElement of root.querySelectorAll('[data-video-slot]')) {
      const slot = Number(slotElement.dataset.videoSlot); const video = videos.find(item => Number(item.slot) === slot) ?? { slot, unlocked: false, url: '', status: 'empty' };
      const unlocked = Boolean(video.unlocked) && state.editable;
      const input = slotElement.querySelector('[data-video-url]'); const button = slotElement.querySelector('[data-video-save]'); const status = slotElement.querySelector('[data-video-status]');
      if (input) { input.disabled = !unlocked; input.value = video.url ?? ''; }
      if (button) button.disabled = !unlocked;
      if (status) status.textContent = !video.unlocked ? 'Bloqueado por coordinación' : video.status === 'submitted' ? 'Enlace recibido' : 'Habilitado para enviar';
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
      const badge = await badgeBlob(profile, blob);
      if (!badge) throw new Error('No se pudo generar la imagen.');
      if (badgeUrl) URL.revokeObjectURL(badgeUrl);
      badgeUrl = URL.createObjectURL(badge); badgePreview.src = badgeUrl; badgeStatus.textContent = 'Listo para compartir en tus redes.';
    } catch { badgeStatus.textContent = 'Completa tu perfil y vuelve a abrir esta pantalla para generar el gafete.'; }
  }
  const downloadBadge = root.querySelector('[data-vocero-badge-download]');
  const shareBadge = root.querySelector('[data-vocero-badge-share]');
  downloadBadge?.addEventListener('click', () => { if (!badgeUrl) return; const link = document.createElement('a'); link.href = badgeUrl; link.download = 'gafete-finados-mushuc-runa-2026.png'; link.click(); });
  shareBadge?.addEventListener('click', async () => {
    if (!badgeUrl) return;
    try {
      const blob = await fetch(badgeUrl).then(response => response.blob());
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], 'gafete-finados-2026.png', { type: 'image/png' })] })) await navigator.share({ title: 'Invitado especial Finados Mushuc Runa 2026', files: [new File([blob], 'gafete-finados-2026.png', { type: 'image/png' })] });
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
    if (result.authenticated !== true || result.user?.role !== 'vocero') throw new VoceroError(401, 'login');
    location.assign(PROFILE);
  });
  submit(root.querySelector('[data-vocero-reset]'), async data => {
    if (!/^[a-f0-9]{64}$/.test(resetToken)) throw new Error('El enlace no es válido. Solicita un enlace nuevo a la coordinación.');
    await api.reset(resetToken, data.get('password'));
    resetToken = '';
    for (const form of forms) { form.reset(); form.hidden = true; }
    message('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
  });
  submit(profileForm, async data => {
    const age = ageToday(data.get('fecha_nacimiento'));
    if (!Number.isFinite(age) || age < 16) throw new Error('El programa recibe participantes desde los 16 años. Revisa tu fecha de nacimiento.');
    if (!['tiktok', 'instagram', 'facebook'].some(name => data.get(name)?.trim())) throw new Error('Ingresa al menos un enlace de tu perfil social.');
    const saved = await api.saveProfile(state.body(data));
    populate(saved);
    photo.value = ''; clearPhoto();
    message('Registro guardado. Puedes consultar aquí el estado de tu participación.');
    if (saved.photo?.available) {
      try { const blob = await loadSavedPhoto(); await updateBadge(saved, blob); } catch { message('Registro guardado. No se pudo cargar la vista previa de tu foto; vuelve a abrir tu registro para consultarla.'); }
    }
  });
  photo?.addEventListener('change', () => {
    const selected = photo.files?.[0];
    if (!selected) return;
    try { validatePhoto(selected); photoGeneration++; showPhoto(selected); message('Fotografía lista para guardar.'); }
    catch (error) { photoGeneration++; photo.value = ''; clearPhoto(); reportError(error); }
  });
  root.querySelector('[data-photo-replace]')?.addEventListener('click', () => photo.click());
  profileForm?.elements.namedItem('fecha_nacimiento').addEventListener('change', updateMinor);
  const logout = root.querySelector('[data-vocero-logout]');
  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await api.logout(); photoGeneration++; clearPhoto(); profileForm.reset(); location.assign(ACCESS); }
    catch (error) { reportError(error); logout.disabled = false; }
  });
  async function start() {
    retry.hidden = true; ready = false;
    try {
      const session = await api.session();
      if (view === 'profile') {
        if (!session.authenticated || session.user?.role !== 'vocero') { location.replace(ACCESS); return; }
        const profile = await api.profile();
        populate(profile); logout.disabled = false; ready = true; message('');
        if (profile.photo?.available) {
          try { const blob = await loadSavedPhoto(); await updateBadge(profile, blob); } catch (error) { reportError(error); }
        }
      } else {
        if (view === 'access' && session.authenticated && session.user?.role === 'vocero') { location.replace(PROFILE); return; }
        if (view === 'reset' && !/^[a-f0-9]{64}$/.test(resetToken)) throw new Error('El enlace no es válido. Solicita un enlace nuevo a la coordinación.');
        for (const form of forms) form.querySelector('fieldset').disabled = false;
        ready = true; message('');
      }
    } catch (error) { reportError(error); retry.hidden = false; }
  }
  retry.addEventListener('click', start);
  await start();
}

if (typeof document !== 'undefined') initializeVoceroPortal();
