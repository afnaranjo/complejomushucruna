import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';

/** El token del enlace: 64 caracteres hexadecimales; cualquier otra cosa no se envía. */
export function tokenFrom(search) {
  const token = new URLSearchParams(String(search ?? '')).get('token') ?? '';
  return /^[a-f0-9]{64}$/.test(token) ? token : '';
}

/** La contraseña debe tener al menos 10 caracteres y coincidir con su repetición. */
export function passwordProblem(password, confirm) {
  if (String(password).length < 10) return 'La contraseña debe tener al menos 10 caracteres.';
  if (password !== confirm) return 'Las dos contraseñas no coinciden.';
  return '';
}

export function createSetupClient(baseUrl = API, fetchImplementation = fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  const call = async (path, options = {}) => {
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, { credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', ...options });
    } catch { return { status: 0, data: null }; }
    let data = null;
    try { data = await response.json(); } catch { /* sin cuerpo */ }
    return { status: response.status, data };
  };
  return {
    preview: token => call(`/admin-setup?token=${token}`, { headers: { Accept: 'application/json' } }),
    async complete(token, password) {
      const session = await call('/auth/session', { headers: { Accept: 'application/json' } });
      const csrf = session.data?.csrf ?? '';
      return call('/admin-setup', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify({ token, password }) });
    },
  };
}

export async function initializeActivar() {
  const main = document.querySelector('[data-admin-activar]');
  if (!main) return;
  const intro = main.querySelector('[data-setup-intro]');
  const form = main.querySelector('[data-setup-form]');
  const fields = main.querySelector('[data-setup-fields]');
  const status = main.querySelector('[data-setup-feedback]');
  const say = (message, error = false) => { status.textContent = message; status.dataset.error = String(error); status.dataset.success = String(!error && Boolean(message)); };
  const configuredBase = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredBase || runtime.apiBase;
  if (!isAllowedSiteOrigin(location.origin) && location.hostname !== (LOCAL_API ? new URL(LOCAL_API).hostname : '')) { intro.textContent = 'Origen no permitido.'; return; }
  const client = createSetupClient(base);
  const token = tokenFrom(location.search);
  // El token no debe quedar en el historial ni en capturas de la barra de direcciones.
  history.replaceState(null, '', location.pathname);
  const invalid = 'Este enlace ya no sirve: se usó, venció o se generó uno más nuevo. Pide a quien administra los usuarios un enlace nuevo.';
  if (!token) { intro.textContent = invalid; return; }
  const preview = await client.preview(token);
  if (preview.status !== 200) { intro.textContent = preview.status === 0 ? 'No se pudo conectar. Revisa tu conexión y vuelve a abrir el enlace.' : invalid; return; }
  intro.textContent = `Hola, ${preview.data.account.full_name}. Tu usuario es «${preview.data.account.username}». Elige la contraseña con la que vas a entrar.`;
  fields.disabled = false;
  form.elements.password.focus();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const problem = passwordProblem(form.elements.password.value, form.elements.confirm.value);
    if (problem) { say(problem, true); return; }
    fields.disabled = true;
    say('Guardando…');
    const result = await client.complete(token, form.elements.password.value);
    form.elements.password.value = '';
    form.elements.confirm.value = '';
    if (result.status === 200) {
      say('Listo. Tu contraseña quedó guardada. Ya puedes iniciar sesión con tu usuario.');
      intro.textContent = `Usuario: ${preview.data.account.username}`;
      return;
    }
    fields.disabled = result.status !== 422;
    say(result.status === 422 ? 'La contraseña debe tener al menos 10 caracteres.' : result.status === 0 ? 'No se pudo conectar. Inténtalo otra vez.' : invalid, true);
  });
}

if (typeof document !== 'undefined') initializeActivar();
