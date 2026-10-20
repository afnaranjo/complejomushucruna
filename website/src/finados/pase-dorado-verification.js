import { MIRROR_API_BASE, PRIMARY_API_BASE, resolveRuntimeOrigins } from './runtime-origins.mjs';

const PUBLIC_ID = /^[a-f0-9]{32}$/;

export function paseDoradoApiUrl(apiBase, publicId) {
  if (![PRIMARY_API_BASE, MIRROR_API_BASE].includes(apiBase)) throw new TypeError('Origen de validación inválido.');
  if (typeof publicId !== 'string' || !PUBLIC_ID.test(publicId)) throw new TypeError('Identificador de pase inválido.');
  return `${apiBase}/pase-dorado/verify/${publicId}`;
}

/** En la puerta solo importa una cosa: válido o no permitido. */
export function describePaseDorado(verification) {
  if (!verification) return { valid: false, state: 'NO PERMITIDO', name: '', cedula: '', note: 'Este código no corresponde a ningún pase dorado registrado.' };
  const valid = verification.valid === true;
  return {
    valid,
    state: valid ? 'VÁLIDO' : 'NO PERMITIDO',
    name: String(verification.name ?? '').trim().slice(0, 160) || '—',
    cedula: verification.cedula_masked ? `C.I. ${verification.cedula_masked}` : '—',
    note: valid ? 'Comprueba que la cédula coincida con el documento de la persona.' : 'Este pase fue anulado o retirado por la organización.',
  };
}

export async function initializePaseDoradoVerification(root = globalThis.document, location = globalThis.location, fetchImplementation = globalThis.fetch) {
  if (!root?.body?.hasAttribute?.('data-pase-dorado-verification')) return;
  const configured = root.querySelector('meta[name="pase-dorado-api-base"]')?.content ?? '';
  const apiBase = location?.hostname === 'finados.expoferiamushucruna.com' ? resolveRuntimeOrigins(location).apiBase : configured || resolveRuntimeOrigins(location).apiBase;
  const card = root.querySelector('.pd-card');
  const show = (view, state) => {
    card.dataset.state = state;
    root.querySelector('[data-pd-state]').textContent = view.state;
    root.querySelector('[data-pd-note]').textContent = view.note;
    const details = root.querySelector('[data-pd-details]');
    details.hidden = !view.name;
    root.querySelector('[data-pd-name]').textContent = view.name;
    root.querySelector('[data-pd-cedula]').textContent = view.cedula;
  };
  try {
    const id = new URLSearchParams(location?.search ?? '').get('id') ?? '';
    if (!PUBLIC_ID.test(id)) { show(describePaseDorado(null), 'invalid'); return; }
    const response = await fetchImplementation(paseDoradoApiUrl(apiBase, id), { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' } });
    if (response.status === 404) { show(describePaseDorado(null), 'invalid'); return; }
    if (!response.ok) throw new Error();
    const payload = await response.json();
    if (payload?.ok !== true || typeof payload.verification?.valid !== 'boolean') throw new Error();
    const view = describePaseDorado(payload.verification);
    show(view, view.valid ? 'valid' : 'invalid');
  } catch {
    show({ state: 'Sin conexión', name: '', cedula: '', note: 'No se pudo comprobar el pase. Revisa la conexión e inténtalo de nuevo.' }, 'error');
  }
}

if (globalThis.document?.body?.hasAttribute('data-pase-dorado-verification')) initializePaseDoradoVerification();
