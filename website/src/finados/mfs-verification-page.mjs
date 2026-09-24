import { escapeHtml as esc } from '../render/html.mjs';
import { apiBasesForCsp, PRIMARY_API_BASE } from './runtime-origins.mjs';

export const mfsVerificationScriptVersion = '20260924-mfs-verify-1';

/**
 * Destino del QR del gafete de Mushuc Freestyle: documento público y noindex. Solo muestra lo
 * necesario para validar en la puerta: estado, nombre, nombre artístico y cédula enmascarada.
 */
export function renderMfsVerificationPage(page) {
  const api = PRIMARY_API_BASE;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Validación de gafete | Mushuc Freestyle 2026</title>
  <meta name="description" content="Confirma el estado de un participante de Mushuc Freestyle 2026.">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#173976">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src ${apiBasesForCsp(api)}; base-uri 'none'; form-action 'none'; object-src 'none'">
  <meta name="mfs-verify-api-base" content="${esc(api)}">
  <link rel="canonical" href="${esc(`https://complejomushucruna.com${page.route}`)}">
  <link rel="icon" href="/assets/finados/mfs/mfs-icono.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/finados/vocero-portal.css?v=20260916-1">
  <link rel="stylesheet" href="/assets/finados/mfs-portal.css?v=20260924-mfs-portal-3">
  <script type="module" src="/assets/finados/mfs-verification.js?v=${mfsVerificationScriptVersion}"></script>
</head>
<body class="vocero-portal" data-mfs-verification>
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  <div class="vocero-chumbi" aria-hidden="true"></div>
  <header class="vocero-header"><a href="/finados/mfs/" aria-label="Mushuc Freestyle 2026"><img src="/assets/finados/mfs/mfs-logo.svg" width="1686" height="469" alt="Mushuc Freestyle"></a><a href="/finados/mfs/">← Mushuc Freestyle</a></header>
  <main id="contenido" class="vocero-workspace">
    <div class="vocero-access-intro"><p class="vocero-eyebrow">Mushuc Freestyle 2026 · 2da edición</p><h1>Validación de gafete</h1><p>Comprueba el estado de este participante y compara la cédula con su documento.</p></div>
    <div class="vocero-feedback" data-mfs-verify-feedback role="status" aria-live="polite" aria-atomic="true" tabindex="-1">Validando gafete…</div>
    <section class="mfs-status mfs-verify" data-mfs-verify-result data-state="celebrate" hidden aria-labelledby="mfs-verify-title">
      <img class="mfs-status__icon" src="/assets/finados/mfs/mfs-icono.svg" width="96" height="96" alt="">
      <div>
        <p class="mfs-status__kicker" data-mfs-verify-kicker>Gafete verificado</p>
        <h2 class="mfs-status__title mfs-verify__state" id="mfs-verify-title" data-mfs-verify-state></h2>
        <dl class="mfs-verify__details">
          <div><dt>Nombre artístico</dt><dd data-mfs-verify-stage></dd></div>
          <div><dt>Nombre</dt><dd data-mfs-verify-name></dd></div>
          <div><dt>Cédula</dt><dd data-mfs-verify-cedula></dd></div>
        </dl>
        <p class="mfs-status__meta">Estado publicado por la coordinación de Mushuc Freestyle en este momento. El gafete es personal e intransferible.</p>
      </div>
    </section>
    <section class="mfs-status" data-mfs-verify-error data-state="calm" hidden aria-labelledby="mfs-verify-error-title">
      <img class="mfs-status__icon" src="/assets/finados/mfs/mfs-icono.svg" width="96" height="96" alt="">
      <div><p class="mfs-status__kicker">Validación no disponible</p><h2 class="mfs-status__title" id="mfs-verify-error-title">No pudimos confirmar este gafete</h2><p class="mfs-status__text">El enlace puede estar incompleto o corresponder a una inscripción retirada. Consulta con la coordinación de Mushuc Freestyle.</p></div>
    </section>
  </main>
  <footer class="vocero-footer"><span>Mushuc Freestyle 2026 · Validación individual</span><a href="/finados/mfs/politica-de-privacidad/">Privacidad</a></footer>
  <noscript><p>Activa JavaScript para validar este gafete.</p></noscript>
</body>
</html>`;
}
