export const PRIMARY_SITE_ORIGIN = 'https://complejomushucruna.com';
export const MIRROR_SITE_ORIGIN = 'https://finados.expoferiamushucruna.com';
export const PRIMARY_API_BASE = 'https://finados.complejomushucruna.com/api';
export const MIRROR_API_BASE = 'https://api.expoferiamushucruna.com/api';
export const LOCAL_API_BASE = 'http://127.0.0.1:4174/api';

const mirrorHost = new URL(MIRROR_SITE_ORIGIN).hostname;

export function isMirrorLocation(location = globalThis.location) {
  return String(location?.hostname ?? '').toLowerCase() === mirrorHost;
}

export function resolveRuntimeOrigins(location = globalThis.location) {
  if (isMirrorLocation(location)) return { apiBase: MIRROR_API_BASE, siteOrigin: MIRROR_SITE_ORIGIN };
  const hostname = String(location?.hostname ?? '').toLowerCase();
  if (hostname === '127.0.0.1' || hostname === 'localhost') return { apiBase: LOCAL_API_BASE, siteOrigin: String(location?.origin ?? 'http://127.0.0.1:4175') };
  return { apiBase: PRIMARY_API_BASE, siteOrigin: PRIMARY_SITE_ORIGIN };
}

export function apiBasesForCsp(primary = PRIMARY_API_BASE) {
  return [...new Set([primary, PRIMARY_API_BASE, MIRROR_API_BASE])].map(base => `${base}/`).join(' ');
}

export function isAllowedSiteOrigin(origin) {
  return origin === PRIMARY_SITE_ORIGIN || origin === MIRROR_SITE_ORIGIN;
}
