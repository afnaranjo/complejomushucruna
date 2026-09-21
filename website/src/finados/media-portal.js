import { MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from './runtime-origins.mjs';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';
const ACCESS = '/finados/medios/acceso/?modo=login';
const PROFILE = '/finados/medios/mi-registro/';

export const MEDIA_CHANNELS = Object.freeze(['facebook', 'instagram', 'tiktok', 'youtube', 'website', 'other_link']);
export const MEDIA_CONSENTS = Object.freeze({ conditions_accepted: true, privacy_accepted: true, image_accepted: false });
export const MEDIA_TYPES = Object.freeze(['radio', 'tv', 'prensa', 'digital', 'redes']);
export const MAX_STATIONS = 10;
export const MEDIA_FIELDS = Object.freeze(['media_name', 'contact_name', 'phone', 'contact_email', 'province', 'city', ...MEDIA_CHANNELS]);
export const STATUS_HELP = Object.freeze({
  Nuevo: 'Recibimos tu registro. Puedes actualizarlo mientras el equipo lo revisa.',
  'En revisión': 'El equipo de Finados Mushuc Runa está revisando tu registro. Aún puedes actualizarlo.',
  Aprobado: 'Tu registro fue aprobado. Ya no se puede modificar, pero puedes seguir agregando los links de tus videos.',
  Rechazado: 'Tu solicitud no fue aprobada. Comunícate con el equipo de comunicación para más información.',
});

export function resolveMediaOrigins(location = globalThis.location) { return resolveRuntimeOrigins(location); }

export class MediaError extends Error {
  constructor(status, context = '') {
    super(({ 0: 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.',
      401: context === 'login' ? 'No se pudo iniciar sesión. Revisa tu correo y contraseña.' : 'Tu sesión venció. Inicia sesión nuevamente.',
      403: 'No se autorizó el cambio. Tu registro puede estar revisado o el acceso debe actualizarse.',
      404: 'La función o el enlace no está disponible. Solicita ayuda al equipo de comunicación.',
      409: 'Ese link ya fue agregado.',
      422: 'Revisa los datos ingresados. Los links deben ser enlaces válidos (https://…).',
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
    if (!/^\/(?:auth\/(?:session|register|login|logout|reset)|profile|videos)$/.test(path)) throw new Error('Ruta de API no permitida.');
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
  addVideo(url) { return this.request('/videos', { body: { url } }); }
  async reset(token, password) {
    const result = await this.request('/auth/reset', { body: { token, password } });
    if (result?.ok !== true) throw new MediaError(502, 'reset');
    return result;
  }
}

/** Accepts "facebook.com/medio" and returns the https link the API stores. */
export function normalizeLink(value, max = 300) {
  let link = String(value ?? '').trim();
  if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
  link = link.replace(/^http:\/\//i, 'https://');
  let url;
  try { url = new URL(link); } catch { url = null; }
  if (!url || url.protocol !== 'https:' || url.username || url.password || !/\.[a-z]{2,24}$/i.test(url.hostname) || /[\s<>"\\]/.test(link) || link.length > max) {
    throw new Error('Escribe un link válido, por ejemplo https://www.facebook.com/tumedio.');
  }
  return link;
}

/** Builds the exact JSON contract expected by POST /api/media/profile. */
/**
 * Builds the platform block of the contract. Radio details are mandatory with Radio and
 * sent empty otherwise, mirroring the server rules.
 */
export function platformPayload(types, stations, data) {
  const selected = MEDIA_TYPES.filter(type => types.includes(type));
  if (selected.length === 0) throw new Error('Marca al menos un tipo de medio: radio, televisión, prensa, digital o redes.');
  const body = { media_types: selected, radio_stations: [], audience_count: null, radio_genre: '', tv_channel: '' };
  if (selected.includes('radio')) {
    const cleaned = stations.map(station => ({ name: String(station.name ?? '').trim(), frequency: String(station.frequency ?? '').trim() }));
    if (cleaned.length === 0 || cleaned.length > MAX_STATIONS || cleaned.some(station => !station.name || !station.frequency)) throw new Error('Escribe el nombre y la frecuencia de cada emisora.');
    const audience = String(data.get('audience_count') ?? '').trim();
    if (!/^[0-9]{1,9}$/.test(audience) || Number(audience) > 100000000) throw new Error('Escribe la cantidad de oyentes solo con números, sin puntos ni comas.');
    const genre = String(data.get('radio_genre') ?? '').trim();
    if (!genre) throw new Error('Selecciona el género de la radio.');
    Object.assign(body, { radio_stations: cleaned, audience_count: Number(audience), radio_genre: genre });
  }
  if (selected.includes('tv')) {
    body.tv_channel = String(data.get('tv_channel') ?? '').trim();
    if (!body.tv_channel) throw new Error('Escribe el canal o la señal de televisión.');
  }
  return body;
}

export function profilePayload(data, stations = []) {
  const body = { media_name: '', ...platformPayload(data.getAll('media_types').map(String), stations, data) };
  for (const name of MEDIA_FIELDS) body[name] = String(data.get(name) ?? '').trim();
  for (const name of ['media_name', 'contact_name', 'province', 'city']) if (!body[name]) throw new Error('Completa los datos del medio, su ubicación y la persona de contacto.');
  if (!/^\+?[0-9][0-9 ()-]{6,23}$/.test(body.phone)) throw new Error('Escribe un número telefónico válido, por ejemplo 0991234567.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.contact_email)) throw new Error('Escribe un correo de contacto válido.');
  for (const name of MEDIA_CHANNELS) if (body[name]) body[name] = normalizeLink(body[name]);
  if (!MEDIA_CHANNELS.some(name => body[name])) throw new Error('Agrega al menos un canal: una red social o la página web de tu medio.');
  for (const [name, mandatory] of Object.entries(MEDIA_CONSENTS)) {
    body[name] = data.get(name) !== null;
    if (mandatory && !body[name]) throw new Error('Para registrarte debes aceptar las Buenas prácticas y la Política de Privacidad. El uso de imagen es opcional.');
  }
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
  const videosPanel = root.querySelector('[data-media-videos]');
  const videoForm = root.querySelector('[data-media-video-form]');
  const videoList = root.querySelector('[data-media-video-list]');
  const videoCount = root.querySelector('[data-media-video-count]');
  let canAddVideos = false;
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

  const typeGroup = root.querySelector('[data-media-types]');
  const stationList = root.querySelector('[data-media-stations]');
  const stationTemplate = root.querySelector('[data-media-station-template]');
  const stationAdd = root.querySelector('[data-station-add]');
  const readStations = () => [...(stationList?.querySelectorAll('[data-media-station]') ?? [])].map(row => ({ name: row.querySelector('[data-station-name]').value, frequency: row.querySelector('[data-station-frequency]').value }));
  function addStation(station = {}) {
    if (stationList.childElementCount >= MAX_STATIONS) return;
    const row = stationTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector('[data-station-name]').value = station.name ?? '';
    row.querySelector('[data-station-frequency]').value = station.frequency ?? '';
    row.querySelector('[data-station-remove]').addEventListener('click', () => { row.remove(); stationAdd.hidden = false; });
    stationList.append(row);
    stationAdd.hidden = stationList.childElementCount >= MAX_STATIONS;
  }
  /** Sections follow the marked platforms; hidden controls are disabled so they neither validate nor submit. */
  function syncSections() {
    const selected = new Set([...profileForm.querySelectorAll('input[name="media_types"]:checked')].map(input => input.value));
    for (const section of profileForm.querySelectorAll('[data-media-section]')) {
      const active = selected.has(section.dataset.mediaSection);
      section.hidden = !active;
      for (const control of section.querySelectorAll('input, select, button')) control.disabled = !active;
    }
    if (selected.has('radio') && stationList.childElementCount === 0) addStation();
    if (selected.size > 0) typeGroup.removeAttribute('data-invalid');
  }
  if (profileForm) {
    stationAdd.addEventListener('click', () => { addStation(); stationList.lastElementChild?.querySelector('input')?.focus(); });
    typeGroup.addEventListener('change', syncSections);
    syncSections();
  }

  function renderVideos(videos = []) {
    videoList.replaceChildren();
    for (const video of videos) {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.href = video.url; link.textContent = video.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      const date = document.createElement('small');
      const parsed = new Date(String(video.created_at ?? '').replace(' ', 'T') + 'Z');
      date.textContent = Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(parsed);
      item.append(link, date); videoList.append(item);
    }
    videoCount.textContent = videos.length === 0 ? 'Aún no has agregado videos.' : videos.length === 1 ? '1 video agregado.' : `${videos.length} videos agregados.`;
  }
  function populate(profile) {
    editable = profile.editable !== false;
    profileForm.querySelector('[data-account-email]').value = profile.email ?? '';
    if (!profile.registered && !profileForm.elements.namedItem('contact_email').value) profileForm.elements.namedItem('contact_email').value = profile.email ?? '';
    if (profile.registered) {
      for (const name of MEDIA_FIELDS) profileForm.elements.namedItem(name).value = String(profile[name] ?? '');
      for (const input of profileForm.querySelectorAll('input[name="media_types"]')) input.checked = (profile.media_types ?? []).includes(input.value);
      stationList.replaceChildren();
      for (const station of profile.radio_stations ?? []) addStation(station);
      profileForm.elements.namedItem('audience_count').value = profile.audience_count ?? '';
      profileForm.elements.namedItem('radio_genre').value = profile.radio_genre ?? '';
      profileForm.elements.namedItem('tv_channel').value = profile.tv_channel ?? '';
      // Restore the saved answers; a withdrawn image authorization must stay unchecked.
      for (const name of Object.keys(MEDIA_CONSENTS)) profileForm.elements.namedItem(name).checked = profile.consents?.[name.replace('_accepted', '')]?.accepted ?? true;
    }
    const status = profile.registered ? profile.status : '';
    statusTitle.textContent = status || 'Registro pendiente';
    statusTitle.closest('section').dataset.status = status;
    statusHelp.textContent = STATUS_HELP[status] ?? 'Completa y guarda el registro de tu medio.';
    profileStatus.textContent = profile.registered ? `Estado de tu registro: ${status}.` : 'Aún no has guardado el registro de tu medio.';
    profileForm.querySelector('fieldset').disabled = !editable;
    syncSections();
    // Videos are reported after the record exists, and keep being accepted once it is approved.
    videosPanel.hidden = !profile.registered;
    canAddVideos = profile.registered === true && profile.can_add_videos !== false;
    videoForm.querySelector('fieldset').disabled = !canAddVideos;
    if (profile.registered) renderVideos(profile.videos);
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
      finally { fields.disabled = form === videoForm ? !canAddVideos : view === 'profile' ? !editable : false; form.setAttribute('aria-busy', 'false'); }
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
    if (data.getAll('media_types').length === 0) { typeGroup.dataset.invalid = 'true'; typeGroup.querySelector('input').focus(); }
    const saved = await api.saveProfile(profilePayload(data, readStations()));
    populate({ ...saved, email: profileForm.querySelector('[data-account-email]').value });
    message('Registro guardado. Ahora puedes agregar los links de los videos que publiques.');
  });
  submit(videoForm, async data => {
    const result = await api.addVideo(normalizeLink(data.get('url'), 500));
    renderVideos(result.videos);
    videoForm.reset();
    message('Video agregado. Puedes seguir agregando más links.');
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
