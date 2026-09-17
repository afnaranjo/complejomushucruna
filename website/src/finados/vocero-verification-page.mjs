import { escapeHtml as esc } from '../render/html.mjs';

/**
 * The QR destination is intentionally a small, public, noindex document. It
 * never renders account fields or the private badge photograph; the API
 * returns only the projection needed to confirm a vocero's current standing.
 */
export function renderVoceroVerificationPage(page) {
  const api = 'https://finados.complejomushucruna.com/api';
  const canonical = `https://complejomushucruna.com${page.route}`;
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Validación de gafete | Finados Mushuc Runa 2026</title>
  <meta name="description" content="Confirma el nivel y el semáforo de un vocero oficial de Finados Mushuc Runa 2026.">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="referrer" content="no-referrer">
  <meta name="theme-color" content="#241146">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src ${esc(api)}/; base-uri 'none'; form-action 'none'; object-src 'none'">
  <meta name="vocero-verify-api-base" content="${esc(api)}">
  <link rel="canonical" href="${esc(canonical)}">
  <link rel="icon" href="/assets/finados/favicon-finados.png" type="image/png" sizes="256x256">
  <link rel="stylesheet" href="/assets/finados/vocero-portal.css?v=20260916-1">
  <script type="module" src="/assets/finados/vocero-verification.js?v=20260916-1"></script>
</head>
<body class="vocero-portal vocero-verification-page" data-vocero-verification>
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  <div class="vocero-chumbi" aria-hidden="true"></div>
  <header class="vocero-header">
    <a href="/finados/" aria-label="Finados Mushuc Runa"><img src="/assets/finados/logo-finados.svg" width="766" height="449" alt="Finados 2026, legado que nos une"></a>
    <a href="/finados/voceros/">← Comunidad de Voceros</a>
  </header>
  <main id="contenido" class="vocero-workspace vocero-verification-workspace">
    <div class="vocero-access-intro">
      <p class="vocero-eyebrow">Comunidad de Voceros · Finados 2026</p>
      <h1>Validación de gafete</h1>
      <p>Comprueba que este gafete pertenece a un vocero oficial y consulta su nivel actual.</p>
    </div>
    <div class="vocero-feedback" data-vocero-verify-status role="status" aria-live="polite" aria-atomic="true" tabindex="-1">Validando gafete…</div>
    <section class="vocero-verification-card" data-vocero-verify-result hidden aria-labelledby="vocero-verify-title">
      <div class="vocero-verification-card__stamp" aria-hidden="true">✓</div>
      <p class="vocero-eyebrow">Gafete verificado</p>
      <h2 id="vocero-verify-title">Vocero oficial</h2>
      <p class="vocero-verification-card__name" data-vocero-verify-name></p>
      <div class="vocero-verification-card__details">
        <div><span>Nivel actual</span><strong data-vocero-verify-level></strong></div>
        <div><span>Semáforo</span><strong data-vocero-verify-light></strong></div>
      </div>
      <p class="vocero-verification-card__note">Esta información refleja el estado publicado por la coordinación de Voceros. El gafete es personal y no transferible.</p>
      <a class="vocero-primary" href="/finados/voceros/">Conoce la comunidad</a>
    </section>
    <section class="vocero-verification-card vocero-verification-card--error" data-vocero-verify-error hidden aria-labelledby="vocero-verify-error-title">
      <p class="vocero-eyebrow">Validación no disponible</p>
      <h2 id="vocero-verify-error-title">No pudimos confirmar este gafete</h2>
      <p>El enlace puede haber vencido, estar incompleto o corresponder a un registro retirado. Solicita un enlace nuevo a la coordinación.</p>
      <a class="vocero-primary" href="/finados/voceros/">Volver a Voceros</a>
    </section>
  </main>
  <footer class="vocero-footer"><span>Finados Mushuc Runa · Validación individual</span><a href="/finados/voceros/politica-de-privacidad/">Privacidad</a></footer>
  <noscript><p>Activa JavaScript para validar este gafete.</p></noscript>
</body>
</html>`;
}
