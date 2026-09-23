import { MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from './runtime-origins.mjs';

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
  if (typeof apiBase !== 'string' || ![PRIMARY_API_BASE, MIRROR_API_BASE].includes(apiBase)) throw new TypeError('Origen de validación inválido.');
  if (!validBadgeId(publicId)) throw new TypeError('Identificador de gafete inválido.');
  return `${apiBase}/emprendedores/verify/${publicId}`;
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
    name: verification.name.trim().slice(0, 120) || 'Emprendedor participante',
    business: typeof verification.business_name === 'string' ? verification.business_name.trim().slice(0, 160) : '',
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
  const business = root.querySelector('[data-emprendedor-verify-business]'); if (business) business.textContent = verification.business || '—';
  root.querySelector('[data-vocero-verify-level]').textContent = verification.level;
  const light = root.querySelector('[data-vocero-verify-light]');
  light.textContent = `${verification.light.short} · ${verification.light.long}`;
  light.dataset.trafficLight = verification.light.short.toLowerCase();
  result.hidden = false;
  error.hidden = true;
}

export async function initializeEmprendedorVerification(root = globalThis.document, location = globalThis.location, fetchImplementation = globalThis.fetch) {
  if (!root?.querySelector?.('[data-emprendedor-verification]') && !root?.body?.hasAttribute?.('data-emprendedor-verification')) return;
  const configuredApi = root.querySelector('meta[name="emprendedor-verify-api-base"]')?.content ?? '';
  const apiBase = location?.hostname === 'finados.expoferiamushucruna.com' ? resolveRuntimeOrigins(location).apiBase : configuredApi || resolveRuntimeOrigins(location).apiBase;
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

if (globalThis.document?.body?.hasAttribute('data-emprendedor-verification')) initializeEmprendedorVerification();
