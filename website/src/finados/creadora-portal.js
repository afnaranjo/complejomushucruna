import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from './runtime-origins.mjs';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
const BASE = '/finados/creadoras';
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export class CreadoraError extends Error {
  constructor(status) {
    super(status === 0 ? 'No se pudo conectar con el servidor.'
      : status === 401 ? 'Inicia sesión para continuar.'
      : status === 403 ? 'Solicitud no permitida.'
      : status === 409 ? 'Ese nombre ya está registrado. Avisa a la coordinación.'
      : status === 422 ? 'Revisa los datos del formulario.'
      : status === 429 ? 'Demasiados intentos. Espera un momento.'
      : 'No se pudo completar la operación.');
    this.status = status;
  }
}

export function createCreadoraClient(baseUrl = API, fetchImplementation = fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  let csrf = '';
  async function request(path, options = {}) {
    if (!/^\/creadora\/(?:auth\/(?:session|register|login|logout|reset)|profile|turnos)$/.test(path)) throw new Error('Ruta de API no permitida.');
    const method = (options.method ?? 'GET').toUpperCase();
    if (!['GET', 'POST'].includes(method)) throw new Error('Método no permitido.');
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') {
      headers['X-CSRF-Token'] = csrf;
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch { throw new CreadoraError(0); }
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (data && typeof data.csrf === 'string') csrf = data.csrf;
    if (!response.ok) throw new CreadoraError(response.status);
    return data ?? {};
  }
  return {
    request,
    session: () => request('/creadora/auth/session'),
    register: body => request('/creadora/auth/register', { method: 'POST', body }),
    login: body => request('/creadora/auth/login', { method: 'POST', body }),
    logout: () => request('/creadora/auth/logout', { method: 'POST', body: {} }),
    reset: body => request('/creadora/auth/reset', { method: 'POST', body }),
    profile: () => request('/creadora/profile'),
    saveProfile: body => request('/creadora/profile', { method: 'POST', body }),
    shifts: () => request('/creadora/turnos'),
  };
}

/** «viernes 30 de octubre · 09:00 a 12:00», que es como lo diría una persona. */
export function describeShift(shift = {}) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(shift.starts_at ?? ''));
  const end = /[T ](\d{2}):(\d{2})/.exec(String(shift.ends_at ?? ''));
  if (!match || !end) return '';
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const weekday = DAY_NAMES[(date.getDay() + 6) % 7];
  return `${weekday} ${Number(day)} de ${MONTH_NAMES[Number(month) - 1]} · ${hour}:${minute} a ${end[1]}:${end[2]}`;
}

export const PROFILE_FIELDS = Object.freeze(['full_name', 'cedula', 'birth_date', 'whatsapp', 'city',
  'main_network', 'social_link', 'followers_count', 'tiktok', 'instagram', 'facebook']);

export function profilePayload(form) {
  const value = name => String(form.get(name) ?? '').trim();
  const payload = { policies_accepted: form.get('policies_accepted') !== null, privacy_accepted: form.get('privacy_accepted') !== null };
  for (const name of PROFILE_FIELDS) payload[name] = value(name);
  payload.followers_count = payload.followers_count === '' ? 0 : Number(payload.followers_count);
  return payload;
}

export function initializeCreadoraPortal() {
  const body = document.body;
  const view = body?.dataset?.creadoraView;
  if (!view) return;
  const configured = document.querySelector('meta[name="creadora-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configured || runtime.apiBase;
  const feedback = document.querySelector('[data-creadora-feedback]');
  const say = (message, kind = '') => { if (!feedback) return; feedback.textContent = message; feedback.dataset.error = String(kind === 'error'); feedback.dataset.success = String(kind === 'success'); };
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) { say('La configuración de acceso no es válida.', 'error'); return; }
  if (!isAllowedSiteOrigin(location.origin) && location.hostname !== new URL(LOCAL_API).hostname) { say('Origen no permitido.', 'error'); return; }
  const client = createCreadoraClient(base);
  const loginLink = document.querySelector('[data-session-login]');
  const retry = document.querySelector('[data-session-retry]');
  const enable = (form, on = true) => { const fieldset = form?.querySelector('fieldset'); if (fieldset) fieldset.disabled = !on; };
  const fail = error => {
    if (error.status === 401 && view === 'profile') { location.replace(`${BASE}/acceso/?modo=login`); return; }
    say(error.message, 'error');
    if (error.status === 401 && loginLink) loginLink.hidden = false;
    if (error.status === 0 && retry) retry.hidden = false;
  };

  if (view === 'access') {
    const register = document.querySelector('[data-creadora-register]');
    const login = document.querySelector('[data-creadora-login]');
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
      if (String(form.get('password')) !== String(register.querySelector('#register-confirmation').value)) { say('Las contraseñas no coinciden.', 'error'); return; }
      enable(register, false);
      try {
        await client.register({ email: String(form.get('email')), password: String(form.get('password')), privacyAcknowledged: true });
        say('Cuenta creada. Ahora inicia sesión.', 'success');
        show('login');
      } catch (error) { fail(error); } finally { enable(register); }
    });
    login.addEventListener('submit', async event => {
      event.preventDefault();
      const form = new FormData(login);
      enable(login, false);
      try {
        await client.login({ email: String(form.get('email')), password: String(form.get('password')) });
        location.replace(`${BASE}/mi-registro/`);
      } catch (error) { fail(error); enable(login); }
    });
    client.session().then(() => { enable(register); enable(login); say(''); }).catch(fail);
    return;
  }

  if (view === 'reset') {
    const form = document.querySelector('[data-creadora-reset]');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const password = String(new FormData(form).get('password'));
      if (password !== form.querySelector('#reset-confirmation').value) { say('Las contraseñas no coinciden.', 'error'); return; }
      const token = new URLSearchParams(location.search).get('token') ?? '';
      enable(form, false);
      try {
        await client.reset({ token, password });
        say('Contraseña actualizada. Ya puedes iniciar sesión.', 'success');
      } catch (error) { fail(error); } finally { enable(form); }
    });
    client.session().then(() => { enable(form); say(''); }).catch(fail);
    return;
  }

  const form = document.querySelector('[data-creadora-form]');
  const list = document.querySelector('[data-creadora-shift-list]');
  const statusLine = document.querySelector('[data-profile-status]');
  const logout = document.querySelector('[data-creadora-logout]');

  function renderShifts(shifts = []) {
    list.replaceChildren();
    if (!shifts.length) {
      const empty = document.createElement('li');
      empty.className = 'admin-panel-empty';
      empty.textContent = 'Todavía no tienes turnos asignados.';
      list.append(empty);
      return;
    }
    for (const shift of shifts) {
      const item = document.createElement('li');
      const when = document.createElement('strong');
      when.textContent = describeShift(shift);
      item.append(when);
      if (shift.place) { const place = document.createElement('span'); place.textContent = shift.place; item.append(place); }
      if (shift.note) { const note = document.createElement('small'); note.textContent = shift.note; item.append(note); }
      list.append(item);
    }
  }

  function fill(profile, emailValue) {
    const mail = form.querySelector('[data-account-email]');
    if (mail && emailValue) mail.value = emailValue;
    if (!profile) return;
    for (const name of PROFILE_FIELDS) {
      const input = form.querySelector(`[name="${name}"]`);
      if (input && profile[name] !== undefined) input.value = profile[name] ?? '';
    }
    for (const name of ['policies_accepted', 'privacy_accepted']) {
      const input = form.querySelector(`[name="${name}"]`);
      if (input) input.checked = true;
    }
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    enable(form, false);
    try {
      const data = await client.saveProfile(profilePayload(new FormData(form)));
      renderShifts(data.shifts ?? []);
      say('Datos guardados. La coordinación ya puede asignarte turnos.', 'success');
      if (statusLine) statusLine.textContent = `Estado: ${data.profile?.status ?? 'Nuevo'}`;
    } catch (error) { fail(error); } finally { enable(form); }
  });

  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await client.logout(); location.replace(`${BASE}/acceso/?modo=login`); }
    catch (error) { logout.disabled = false; fail(error); }
  });

  (async () => {
    try {
      const session = await client.session();
      if (!session.authenticated) { location.replace(`${BASE}/acceso/?modo=login`); return; }
      const data = await client.profile();
      fill(data.profile, session.user?.email);
      renderShifts(data.shifts ?? []);
      enable(form);
      if (logout) logout.disabled = false;
      if (statusLine) statusLine.textContent = data.profile ? `Estado: ${data.profile.status}` : 'Completa tus datos para que la coordinación pueda asignarte turnos.';
      say('');
    } catch (error) { fail(error); }
  })();
}

if (typeof document !== 'undefined') initializeCreadoraPortal();
