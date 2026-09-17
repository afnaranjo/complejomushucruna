const PUBLIC_ID_PATTERN = /^[a-f0-9]{32}$/;
const LIGHTS = Object.freeze({
  red: { short: 'Rojo', long: 'En preparación' },
  yellow: { short: 'Amarillo', long: 'En avance' },
  green: { short: 'Verde', long: 'Listo' },
});

export function validBadgeId(value) {
  return typeof value === 'string' && PUBLIC_ID_PATTERN.test(value);
}

export function verificationApiUrl(apiBase, publicId) {
  if (typeof apiBase !== 'string' || !/^https:\/\/finados\.complejomushucruna\.com\/api$/.test(apiBase)) throw new TypeError('Origen de validación inválido.');
  if (!validBadgeId(publicId)) throw new TypeError('Identificador de gafete inválido.');
  return `${apiBase}/voceros/verify/${publicId}`;
}

export async function fetchBadgeVerification(apiBase, publicId, fetchImplementation = globalThis.fetch) {
  const response = await fetchImplementation(verificationApiUrl(apiBase, publicId), {
    method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('validation_unavailable');
  const payload = await response.json();
  const verification = payload?.ok === true ? payload.verification : null;
  if (!verification || typeof verification.name !== 'string' || typeof verification.level_label !== 'string' || !LIGHTS[verification.traffic_light]) throw new Error('validation_unavailable');
  return {
    name: verification.name.trim().slice(0, 120) || 'Vocero oficial',
    level: verification.level_label.trim().slice(0, 80) || 'En preparación',
    light: LIGHTS[verification.traffic_light],
  };
}

function showStatus(root, message, error = false) {
  const status = root.querySelector('[data-vocero-verify-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.error = String(error);
  status.setAttribute('role', error ? 'alert' : 'status');
}

export function renderVerification(root, verification) {
  const result = root.querySelector('[data-vocero-verify-result]');
  const error = root.querySelector('[data-vocero-verify-error]');
  if (!result || !error) return;
  root.querySelector('[data-vocero-verify-name]').textContent = verification.name;
  root.querySelector('[data-vocero-verify-level]').textContent = verification.level;
  const light = root.querySelector('[data-vocero-verify-light]');
  light.textContent = `${verification.light.short} · ${verification.light.long}`;
  light.dataset.trafficLight = verification.light.short.toLowerCase();
  result.hidden = false;
  error.hidden = true;
}

export async function initializeVoceroVerification(root = globalThis.document, location = globalThis.location, fetchImplementation = globalThis.fetch) {
  if (!root?.querySelector?.('[data-vocero-verification]') && !root?.body?.hasAttribute?.('data-vocero-verification')) return;
  const apiBase = root.querySelector('meta[name="vocero-verify-api-base"]')?.content ?? '';
  const id = new URLSearchParams(location?.search ?? '').get('id') ?? '';
  try {
    const verification = await fetchBadgeVerification(apiBase, id, fetchImplementation);
    renderVerification(root, verification);
    showStatus(root, 'Gafete confirmado.');
  } catch {
    const result = root.querySelector('[data-vocero-verify-result]');
    const error = root.querySelector('[data-vocero-verify-error]');
    if (result) result.hidden = true;
    if (error) error.hidden = false;
    showStatus(root, 'No se pudo validar este gafete.', true);
  }
}

if (globalThis.document?.body?.hasAttribute('data-vocero-verification')) initializeVoceroVerification();
