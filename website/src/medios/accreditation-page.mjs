import { escapeHtml as esc } from '../render/html.mjs';
import { apiBasesForCsp, LOCAL_API_BASE, PRIMARY_API_BASE } from '../finados/runtime-origins.mjs';
import { mediaPortalScriptVersion } from './portal-page.mjs';

const BASE = '/finados/medios';

/**
 * Destino del QR de acreditación de un evento. Es pública y no indexable: solo muestra el evento y
 * lleva a iniciar sesión o crear cuenta; el registro de llegada exige la sesión del medio.
 */
export function renderMediaAccreditationPage(page) {
  const api = page.adminEnvironment === 'development' ? (page.adminApiBase ?? LOCAL_API_BASE) : PRIMARY_API_BASE;
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Acreditación de medios | Finados Mushuc Runa 2026</title><meta name="description" content="Acreditación de medios para los eventos de Finados Mushuc Runa 2026.">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src ${apiBasesForCsp(api)}; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="media-api-base" content="${esc(api)}"><meta name="theme-color" content="#241146">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}"><link rel="icon" href="/assets/finados/favicon-finados.png">
<link rel="stylesheet" href="/assets/finados/vocero-portal.css?v=20260915-1"><link rel="stylesheet" href="/assets/finados/media-portal.css?v=${mediaPortalScriptVersion}">
<script type="module" src="/assets/finados/media-portal.js?v=${mediaPortalScriptVersion}"></script>
</head><body class="vocero-portal" data-media-view="acreditacion">
<a class="skip-link" href="#contenido">Ir al contenido</a><div class="vocero-chumbi" aria-hidden="true"></div>
<header class="vocero-header"><a href="/finados/" aria-label="Finados Mushuc Runa"><img src="/assets/finados/logo-finados.svg" width="766" height="449" alt="Finados 2026, legado que nos une"></a><a href="${BASE}/">← Registro de medios</a></header>
<main id="contenido" class="vocero-workspace vocero-workspace--access">
<div class="vocero-feedback" data-vocero-feedback role="status" aria-live="polite" aria-atomic="true" tabindex="-1">Cargando el evento…</div>
<div class="vocero-access-intro"><p class="vocero-eyebrow">Acreditación de medios</p><h1 data-accreditation-name>Evento</h1><p data-accreditation-meta></p><p data-accreditation-details></p></div>
<section class="media-accreditation-box" data-accreditation-anonymous hidden>
  <p>Para acreditarte necesitas la cuenta de tu medio. Si ya la tienes, inicia sesión; si no, créala en un minuto y vuelve a este enlace.</p>
  <div class="media-event__actions">
    <a class="vocero-primary" data-accreditation-login href="${BASE}/acceso/?modo=login">Ya tengo cuenta: iniciar sesión</a>
    <a class="vocero-quiet" data-accreditation-register href="${BASE}/acceso/">Crear la cuenta de mi medio</a>
  </div>
</section>
<section class="media-accreditation-box" data-accreditation-session hidden>
  <p data-accreditation-state>Revisando tu registro…</p>
  <div class="media-event__actions">
    <button class="vocero-primary" type="button" data-accreditation-checkin hidden>Ya llegué: registrar mi asistencia</button>
    <button class="vocero-quiet" type="button" data-accreditation-confirm hidden>Confirmo que asistiré</button>
    <button class="vocero-quiet" type="button" data-accreditation-decline hidden>No podré asistir</button>
  </div>
  <a class="vocero-quiet" href="${BASE}/mi-registro/">Ir a mi registro</a>
</section>
</main>
<footer class="vocero-footer"><span>Finados Mushuc Runa · Acreditación de medios</span><a href="${BASE}/politica-de-privacidad/">Privacidad</a></footer>
<noscript><p>Activa JavaScript para acreditarte en el evento.</p></noscript>
</body></html>`;
}
