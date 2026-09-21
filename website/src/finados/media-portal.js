import { MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from './runtime-origins.mjs';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
const ACCESS = '/finados/medios/acceso/?modo=login';
const PROFILE = '/finados/medios/mi-registro/';

export const MEDIA_FIELDS = Object.freeze(['media_name', 'media_type', 'frequency_channel', 'program_name', 'program_type', 'province', 'city', 'contract', 'people_count', 'team', 'phone', 'contact_email']);
export const STATUS_HELP = Object.freeze({
  Nuevo: 'Recibimos tu registro. Puedes actualizarlo mientras el equipo lo revisa.',
  'En revisión': 'El equipo de Finados Mushuc Runa está revisando tu registro. Aún puedes actualizarlo.',
  Aprobado: 'Tu acreditación fue aprobada. El registro ya no se puede modificar.',
  Rechazado: 'Tu solicitud no fue aprobada. Comunícate con el equipo de comunicación para más información.',
});

export function resolveMediaOrigins(location = globalThis.location) { return resolveRuntimeOrigins(location); }

export class MediaError extends Error {
  constructor(status, context = '') {
    super(({ 0: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.',
      401: context === 'login' ? 'No se pudo iniciar sesión. Revisa tu correo y contraseña.' : 'Tu sesión venció. Inicia sesión nuevamente.',
      403: 'No se autorizó el cambio. Tu registro puede estar revisado o el acceso debe actualizarse.',
      404: 'La función o el enlace no está disponible. Solicita ayuda al equipo de comunicación.',
      422: 'Revisa los campos del registro. No se pudo guardar la información.',
      429: 'Hay demasiados intentos. Espera 15 minutos antes de volver a intentar.' })[status] ?? 'No se pudo completar la solicitud. Intenta de nuevo.');
    this.status = status;
    if (context === 'reset' && [401, 403, 404, 422].includes(status)) this.message = 'El enlace de recuperación venció, ya fue usado o no está disponible. Solicita un enlace nuevo.';
  }
}

export class MediaApiClient {
  #csrf = '';
  constructor(baseUrl = API, fetchImplementation = globalThis.fetch) {
    if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
    this.baseUrl = baseUrl;
    this.fetch = fetchImplementation;
  }
  async request(path, { body } = {}) {
    if (!/^\/(?:auth\/(?:session|register|login|logout|reset)|profile)$/.test(path)) throw new Error('Ruta de API no permitida.');
    if (body !== undefined && !this.#csrf) await this.session();
    const headers = { Accept: 'application/json' };
    if (body !== undefined) {
      if (!this.#csrf) throw new MediaError(403);
      headers['X-CSRF-Token'] = this.#csrf;
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      const fetchImplementation = this.fetch;
      response = await fetchImplementation(`${this.baseUrl}/media${path}`, {
        method: body === undefined ? 'GET' : 'POST', credentials: 'include', cache: 'no-store', redirect: 'error',
        referrerPolicy: 'no-referrer', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch { throw new MediaError(0); }
    let data;
    try { data = await response.json(); } catch { throw new MediaError(response.ok ? 502 : response.status); }
    if (typeof data?.csrf === 'string') this.#csrf = data.csrf;
    if (!response.ok) {
      if ([401, 403].includes(response.status)) this.#csrf = '';
      throw new MediaError(response.status, path === '/auth/login' ? 'login' : path === '/auth/reset' ? 'reset' : '');
    }
    return data;
  }
  session() { return this.request('/auth/session'); }
  register(email, password) { return this.request('/auth/register', { body: { email, password, privacyAcknowledged: true } }); }
  login(email, password) { return this.request('/auth/login', { body: { email, password } }); }
  async logout() { const result = await this.request('/auth/logout', { body: {} }); this.#csrf = ''; return result; }
  profile() { return this.request('/profile'); }
  saveProfile(body) { return this.request('/profile', { body }); }
  async reset(token, password) {
    const result = await this.request('/auth/reset', { body: { token, password } });
    if (result?.ok !== true) throw new MediaError(502, 'reset');
    return result;
  }
}

/** Builds the exact JSON contract expected by POST /api/media/profile. */
export function profilePayload(data) {
  const body = {};
  for (const name of MEDIA_FIELDS) body[name] = String(data.get(name) ?? '').trim();
  body.people_count = Number.parseInt(body.people_count, 10);
  if (![1, 2].includes(body.people_count)) throw new Error('Selecciona el número de personas a acreditar.');
  const lines = body.team.split(/\r?\n/).filter(line => line.trim() !== '').length;
  if (lines > 2) throw new Error('Puedes acreditar un máximo de dos personas. Incluye una línea por cada persona.');
  if (data.get('conditions_accepted') === null) throw new Error('Debes aceptar las condiciones de acreditación.');
  body.conditions_accepted = true;
  return body;
}

function showFeedback(element, message, error = false, { focus = true } = {}) {
  element.textContent = message;
  element.dataset.error = String(error);
  if (message && focus) element.focus();
}

function validateForm(form) {
  let first = null;
  for (const control of form.querySelectorAll('input, select, textarea')) {
    if (control.readOnly || control.checkValidity()) { control.removeAttribute('aria-invalid'); continue; }
    control.setAttribute('aria-invalid', 'true');
    first ??= control;
  }
  const confirmation = form.elements.namedItem('confirmation');
  if (!first && confirmation && confirmation.value !== form.elements.namedItem('password').value) {
    confirmation.setAttribute('aria-invalid', 'true');
    confirmation.focus();
    throw new Error('Las contraseñas no coinciden.');
  }
  if (first) { first.focus(); throw new Error('Revisa los campos marcados antes de continuar.'); }
}

export async function initializeMediaPortal(root = document) {
  const view = root.body?.dataset.mediaView;
  if (!view) return;
  const feedback = root.querySelector('[data-media-feedback]');
  const retry = root.querySelector('[data-session-retry]');
  const configuredBase = root.querySelector('meta[name="media-api-base"]')?.content;
  const runtime = resolveMediaOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredBase || runtime.apiBase;
  const message = (text, error = false, focus = true) => showFeedback(feedback, text, error, { focus });
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) { message('La configuración de acceso no es válida.', true); return; }
  const api = new MediaApiClient(base);
  const register = root.querySelector('[data-media-register]');
  const login = root.querySelector('[data-media-login]');
  const reset = root.querySelector('[data-media-reset]');
  const profileForm = root.querySelector('[data-media-profile]');
  const statusTitle = root.querySelector('[data-media-status]');
  const statusHelp = root.querySelector('[data-media-status-help]');
  const profileStatus = root.querySelector('[data-profile-status]');
  const logout = root.querySelector('[data-media-logout]');
  const forms = [register, login, reset].filter(Boolean);
  let ready = false;
  let editable = true;
  const reportError = error => {
    if (error?.status === 401 && view === 'profile') { location.replace(ACCESS); return; }
    message(error?.message ?? 'No se pudo completar la solicitud. Intenta de nuevo.', true);
  };
  root.addEventListener('input', event => event.target.removeAttribute?.('aria-invalid'));
  globalThis.addEventListener?.('pageshow', event => { if (event.persisted) location.reload(); });

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

  function populate(profile) {
    editable = profile.editable !== false;
    profileForm.querySelector('[data-account-email]').value = profile.email ?? '';
    if (profile.registered) {
      for (const name of MEDIA_FIELDS) profileForm.elements.namedItem(name).value = String(profile[name] ?? '');
      profileForm.elements.namedItem('conditions_accepted').checked = true;
    }
    const status = profile.registered ? profile.status : '';
    statusTitle.textContent = status || 'Registro pendiente';
    statusTitle.closest('section').dataset.status = status;
    statusHelp.textContent = STATUS_HELP[status] ?? 'Completa y guarda el registro de tu medio.';
    profileStatus.textContent = profile.registered ? `Estado de tu registro: ${status}.` : 'Aún no has guardado el registro de tu medio.';
    profileForm.querySelector('fieldset').disabled = !editable;
  }

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
        fields.disabled = true; form.setAttribute('aria-busy', 'true'); message('Guardando…', false, false);
        await result;
      } catch (error) { reportError(error); }
      finally { fields.disabled = view === 'profile' ? !editable : false; form.setAttribute('aria-busy', 'false'); }
    });
  }
  submit(register, async data => {
    await api.register(data.get('email'), data.get('password'));
    setMode({ mode: 'login', email: data.get('email'), message: 'Cuenta creada; inicia sesión con tu correo y contraseña para completar el registro.' });
  });
  submit(login, async data => {
    const result = await api.login(data.get('email'), data.get('password'));
    if (result.authenticated !== true || result.user?.role !== 'media') throw new MediaError(401, 'login');
    location.assign(PROFILE);
  });
  submit(reset, async data => {
    if (!/^[a-f0-9]{64}$/.test(resetToken)) throw new Error('El enlace no es válido. Solicita un enlace nuevo.');
    await api.reset(resetToken, data.get('password'));
    resetToken = '';
    for (const form of forms) { form.reset(); form.hidden = true; }
    message('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
  });
  submit(profileForm, async data => {
    const saved = await api.saveProfile(profilePayload(data));
    populate({ ...saved, email: profileForm.querySelector('[data-account-email]').value });
    message('Registro guardado. Puedes consultar aquí el estado de tu acreditación.');
  });
  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await api.logout(); profileForm.reset(); location.assign(ACCESS); }
    catch (error) { reportError(error); logout.disabled = false; }
  });

  async function start() {
    retry.hidden = true; ready = false;
    try {
      const session = await api.session();
      if (view === 'profile') {
        if (!session.authenticated || session.user?.role !== 'media') { location.replace(ACCESS); return; }
        populate(await api.profile());
        logout.disabled = false; ready = true; message('', false, false);
      } else {
        if (view === 'access' && session.authenticated && session.user?.role === 'media') { location.replace(PROFILE); return; }
        if (view === 'reset' && !/^[a-f0-9]{64}$/.test(resetToken)) throw new Error('El enlace no es válido. Solicita un enlace nuevo.');
        for (const form of forms) form.querySelector('fieldset').disabled = false;
        ready = true; message('', false, false);
      }
    } catch (error) { reportError(error); retry.hidden = false; }
  }
  retry.addEventListener('click', start);
  await start();
}

if (typeof document !== 'undefined') initializeMediaPortal();
