import { escapeHtml as esc } from '../render/html.mjs';
import { apiBasesForCsp, PRIMARY_API_BASE } from './runtime-origins.mjs';

export const paseDoradoVerificationVersion = '20261020-pase-dorado-1';

/**
 * Destino del QR impreso en cada pase dorado: público y noindex. Solo dice si el pase es válido
 * o no permitido, con el nombre y la cédula enmascarada para compararla con el documento.
 */
export function renderPaseDoradoVerificationPage(page) {
  const api = PRIMARY_API_BASE;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pase dorado · Validación | Finados Mushuc Runa 2026</title>
  <meta name="description" content="Validación del pase dorado de Finados Mushuc Runa 2026.">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#1b0f2b">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src ${apiBasesForCsp(api)}; base-uri 'none'; form-action 'none'; object-src 'none'">
  <meta name="pase-dorado-api-base" content="${esc(api)}">
  <link rel="canonical" href="${esc(`https://complejomushucruna.com${page.route}`)}">
  <link rel="icon" href="/assets/finados/favicon-finados.png">
  <link rel="stylesheet" href="/assets/finados/pase-dorado.css?v=${paseDoradoVerificationVersion}">
  <script type="module" src="/assets/finados/pase-dorado-verification.js?v=${paseDoradoVerificationVersion}"></script>
</head>
<body class="pd-page" data-pase-dorado-verification>
  <main id="contenido" class="pd-card" data-state="loading" aria-labelledby="pd-state">
    <img class="pd-logo" src="/assets/finados/logo-finados.svg" width="766" height="449" alt="Finados Mushuc Runa 2026">
    <p class="pd-kicker">Pase dorado · Finados 2026</p>
    <h1 class="pd-state" id="pd-state" data-pd-state role="status" aria-live="polite">Validando…</h1>
    <dl class="pd-details" data-pd-details hidden>
      <div><dt>Nombre</dt><dd data-pd-name></dd></div>
      <div><dt>Cédula</dt><dd data-pd-cedula></dd></div>
    </dl>
    <p class="pd-note" data-pd-note>Comprueba que la cédula coincida con el documento de la persona.</p>
  </main>
  <noscript><p class="pd-noscript">Activa JavaScript para validar este pase.</p></noscript>
</body>
</html>`;
}
