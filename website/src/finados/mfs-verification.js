import { MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from './runtime-origins.mjs';

const PUBLIC_ID = /^[a-f0-9]{32}$/;

export function mfsVerificationApiUrl(apiBase, publicId) {
  if (![PRIMARY_API_BASE, MIRROR_API_BASE].includes(apiBase)) throw new TypeError('Origen de validación inválido.');
  if (typeof publicId !== 'string' || !PUBLIC_ID.test(publicId)) throw new TypeError('Identificador de gafete inválido.');
  return `${apiBase}/mfs/verify/${publicId}`;
}

/** Lo que muestra la puerta: el estado en grande y los datos para comparar con la cédula física. */
export function describeMfsVerification(verification = {}) {
  const valid = verification.valid === true;
  return {
    valid,
    kicker: valid ? 'Gafete verificado ✓' : 'Gafete no vigente',
    state: String(verification.status ?? '').toUpperCase() || '—',
    stage: String(verification.stage_name ?? '').trim().slice(0, 80) || '—',
    name: String(verification.name ?? '').trim().slice(0, 160) || '—',
    cedula: verification.cedula_masked ? `C.I. ${verification.cedula_masked}` : 'Sin cédula registrada',
  };
}

export async function initializeMfsVerification(root = globalThis.document, location = globalThis.location, fetchImplementation = globalThis.fetch) {
  if (!root?.body?.hasAttribute?.('data-mfs-verification')) return;
  const configured = root.querySelector('meta[name="mfs-verify-api-base"]')?.content ?? '';
  const apiBase = location?.hostname === 'finados.expoferiamushucruna.com' ? resolveRuntimeOrigins(location).apiBase : configured || resolveRuntimeOrigins(location).apiBase;
  const feedback = root.querySelector('[data-mfs-verify-feedback]');
  const result = root.querySelector('[data-mfs-verify-result]');
  const error = root.querySelector('[data-mfs-verify-error]');
  try {
    const id = new URLSearchParams(location?.search ?? '').get('id') ?? '';
    const response = await fetchImplementation(mfsVerificationApiUrl(apiBase, id), { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error();
    const payload = await response.json();
    if (payload?.ok !== true || typeof payload.verification?.status !== 'string') throw new Error();
    const view = describeMfsVerification(payload.verification);
    root.querySelector('[data-mfs-verify-kicker]').textContent = view.kicker;
    root.querySelector('[data-mfs-verify-state]').textContent = view.state;
    root.querySelector('[data-mfs-verify-stage]').textContent = view.stage;
    root.querySelector('[data-mfs-verify-name]').textContent = view.name;
    root.querySelector('[data-mfs-verify-cedula]').textContent = view.cedula;
    result.dataset.state = view.valid ? 'celebrate' : 'calm';
    result.hidden = false; error.hidden = true;
    feedback.textContent = view.valid ? `Gafete confirmado: ${view.state.toLowerCase()}.` : 'Este gafete no está vigente.';
  } catch {
    result.hidden = true; error.hidden = false;
    feedback.textContent = 'No se pudo validar este gafete.';
    feedback.dataset.error = 'true';
  }
}

if (globalThis.document?.body?.hasAttribute('data-mfs-verification')) initializeMfsVerification();
