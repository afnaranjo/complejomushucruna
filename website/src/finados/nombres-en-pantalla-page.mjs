import { escapeHtml } from '../render/html.mjs';
import { site } from '../data/site.mjs';

const assetVersion = '20260924-nombres-1';

function documentShell({ title, description, body, script = true }) {
  return `<!doctype html>
<html lang="es" class="finados-names-page">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapeHtml(site.baseUrl)}${script ? '/finados/nombre/' : '/finados/pantalla/'}">
  <link rel="icon" href="/assets/finados/favicon-finados.png" type="image/png">
  <link rel="stylesheet" href="/assets/finados/nombres-en-pantalla.css?v=${assetVersion}">
</head>
<body class="finados-names-page">
  ${body}
  ${script ? `<script type="module" src="/assets/finados/nombres-en-pantalla.js?v=${assetVersion}"></script>` : ''}
</body>
</html>`;
}

export function renderNameCapturePage() {
  return documentShell({
    title: 'Tu nombre en Finados 2026 | Mushuc Runa',
    description: 'Comparte tu nombre y hazlo aparecer en la pantalla de Finados Mushuc Runa 2026.',
    body: `<main class="name-capture" id="contenido">
  <div class="name-capture__mist" aria-hidden="true"></div>
  <section class="name-capture__card" aria-labelledby="name-capture-title">
    <p class="name-kicker">Finados Mushuc Runa · 2026</p>
    <h1 id="name-capture-title">Deja tu nombre en escena</h1>
    <p class="name-capture__intro">Escanea, escribe cómo quieres aparecer y comparte este momento con la comunidad.</p>
    <div class="name-qr" data-name-qr aria-label="Código QR para abrir esta experiencia"></div>
    <p class="name-qr__caption">Escanea este código para participar desde tu teléfono.</p>
    <form class="name-form" data-name-form novalidate>
      <label for="display-name">¿Cómo quieres que aparezca tu nombre?</label>
      <input id="display-name" name="name" type="text" maxlength="60" autocomplete="name" required>
      <label class="name-consent"><input name="consent" type="checkbox" required> <span>Acepto que mi nombre aparezca públicamente en la pantalla de Finados.</span></label>
      <button type="submit">Enviar a pantalla <span aria-hidden="true">↗</span></button>
      <p class="name-form__status" data-name-status aria-live="polite"></p>
    </form>
  </section>
</main>`,
  });
}

export function renderNameScreenPage() {
  return documentShell({
    title: 'Nombres en pantalla | Finados 2026',
    description: 'Pantalla de nombres compartidos con consentimiento en Finados Mushuc Runa 2026.',
    script: false,
    body: `<main class="name-screen" id="contenido" data-name-screen>
  <div class="name-screen__grain" aria-hidden="true"></div>
  <div class="name-screen__fog name-screen__fog--one" aria-hidden="true"></div>
  <div class="name-screen__fog name-screen__fog--two" aria-hidden="true"></div>
  <h1 class="sr-only">Nombres en pantalla de Finados 2026</h1>
  <p class="name-screen__context">Finados Mushuc Runa <span>2026</span></p>
  <section class="name-scene" data-name-scene aria-live="off" aria-label="Nombres compartidos por la comunidad"></section>
  <p class="name-screen__note">Nombres compartidos con consentimiento</p>
</main>
<script type="module" src="/assets/finados/nombres-en-pantalla.js?v=${assetVersion}"></script>`,
  });
}
