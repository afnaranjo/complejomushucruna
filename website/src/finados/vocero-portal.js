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
    if (!/^\/(?:auth\/(?:session|register|login|logout|reset)|profile|photo)$/.test(path)) throw new Error('Ruta de API no permitida.');
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
  photo() { return this.request('/photo', { blob: true }); }
  reset(token, password) { return this.request('/auth/reset', { body: { token, password } }); }
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
  }
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
      try { await loadSavedPhoto(); } catch { message('Registro guardado. No se pudo cargar la vista previa de tu foto; vuelve a abrir tu registro para consultarla.'); }
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
          try { await loadSavedPhoto(); } catch (error) { reportError(error); }
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
