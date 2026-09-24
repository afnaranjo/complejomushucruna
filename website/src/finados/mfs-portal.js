import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from './runtime-origins.mjs';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
const BASE = '/finados/mfs';
const ACCESS = `${BASE}/acceso/?modo=login`;
const PROFILE = `${BASE}/mi-registro/`;
export const MFS_FIELDS = Object.freeze(['nombre_completo', 'nombre_artistico', 'whatsapp', 'audicion_tiktok']);
export const MFS_CHECKS = Object.freeze(['declaracion_video', 'consentimiento_bases', 'autorizacion_imagen', 'consentimiento_datos']);
const PROFILE_KEYS = Object.freeze({ nombre_completo: 'full_name', nombre_artistico: 'stage_name', whatsapp: 'whatsapp', audicion_tiktok: 'audition_url' });

export class MfsError extends Error {
  constructor(status, context = '') {
    super(({ 0: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.',
      401: context === 'login' ? 'No se pudo iniciar sesión. Revisa tu correo y contraseña.' : 'Tu sesión venció. Inicia sesión nuevamente.',
      403: 'No se autorizó el cambio. Tu inscripción puede estar en revisión.',
      404: 'La función o el enlace no está disponible. Solicita ayuda a la coordinación.',
      409: 'Ya existe una inscripción con ese número de WhatsApp. Consulta con la coordinación.',
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
    if (!/^\/(?:auth\/(?:session|register|login|logout|reset)|profile|photo)$/.test(path)) throw new Error('Ruta de API no permitida.');
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
  if (!/^09\d{8}$/.test((values.whatsapp ?? '').trim())) return 'El WhatsApp debe tener 10 dígitos y empezar con 09.';
  let url;
  try { url = new URL((values.audicion_tiktok ?? '').trim()); } catch { return 'Pega el enlace completo de tu video en TikTok.'; }
  const hosts = ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com'];
  if (url.protocol !== 'https:' || !hosts.includes(url.hostname) || url.pathname.length < 2) return 'El enlace debe ser de un video público de TikTok (https://www.tiktok.com/…).';
  return '';
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
  const statusLine = document.querySelector('[data-profile-status]');
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

  const describe = profile => {
    if (!profile.registered) return 'Completa tus datos y envía tu inscripción. Tienes hasta el jueves 29 de octubre, 23:59.';
    const when = profile.submitted_at ? ` Recibida el ${String(profile.submitted_at).slice(0, 16).replace('T', ' ')} (hora UTC).` : '';
    const detail = { 'Nuevo': 'Tu inscripción fue recibida y espera revisión.', 'En revisión': 'La coordinación está revisando tu audición.',
      'Aprobado': 'Tu audición fue aprobada.', 'Rechazado': 'Tu inscripción no fue aprobada en esta ocasión.', 'Seleccionado': '¡Fuiste seleccionado para la competencia!' }[profile.status] ?? '';
    return `Estado: ${profile.status}. ${detail}${when}`;
  };

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
      if (statusLine) statusLine.textContent = describe(saved);
      say('¡Inscripción recibida! Te contactaremos por WhatsApp con el resultado de la revisión.', 'success');
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
        try { showPhoto(await client.photo()); if (photoLabel) photoLabel.textContent = 'Cambiar fotografía'; } catch { /* la foto es opcional para mostrar */ }
      }
      if (statusLine) statusLine.textContent = describe(profile);
      if (profile.editable !== false) enable(form);
      if (logout) logout.disabled = false;
      say(profile.editable === false ? 'Tu inscripción ya fue revisada y no se puede editar desde aquí.' : '');
    } catch (error) { fail(error); }
  })();
}

if (typeof document !== 'undefined') initializeMfsPortal();
