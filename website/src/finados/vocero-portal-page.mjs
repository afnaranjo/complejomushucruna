import { readFileSync } from 'node:fs';
import { escapeHtml as esc } from '../render/html.mjs';
import { renderVoceroForm, renderVoceroProgressPanels, renderVoceroVideosPanel } from './vocero-form.mjs';

// Server-owned text is incorporated at build time and escaped as HTML, never fetched by the browser.
const consents = JSON.parse(readFileSync(new URL('../../backend/finados-api/resources/vocero-consents.json', import.meta.url), 'utf8'));
const email = id => `<label class="vocero-field" for="${id}"><span>Correo electrónico</span><input id="${id}" name="email" type="email" autocomplete="username" maxlength="254" autocapitalize="none" spellcheck="false" required></label>`;
const password = (id, label, autocomplete) => `<label class="vocero-field" for="${id}"><span>${label}</span><input id="${id}" name="${id.includes('confirmation') ? 'confirmation' : 'password'}" type="password" autocomplete="${autocomplete}" minlength="${autocomplete === 'current-password' ? '1' : '10'}" maxlength="128" required></label>`;

export function renderVoceroPortalPage(page) {
  const mode = page.route.endsWith('/mi-registro/') ? 'profile' : page.route.endsWith('/restablecer/') ? 'reset' : 'access';
  const api = page.adminEnvironment === 'development' ? (page.adminApiBase ?? 'http://127.0.0.1:4174/api') : 'https://finados.complejomushucruna.com/api';
  const title = { access: 'Tu cuenta de Vocero', profile: 'Mi registro', reset: 'Restablecer contraseña' }[mode];
  const content = mode === 'profile' ? `<div class="vocero-workspace-heading"><div><p class="vocero-eyebrow">Comunidad de Voceros</p><h1>${title}</h1><p data-profile-status>Comprobando tu registro…</p></div><button class="vocero-quiet" type="button" data-vocero-logout disabled>Cerrar sesión</button></div>${renderVoceroProgressPanels()}${renderVoceroForm(consents)}${renderVoceroVideosPanel()}`
    : mode === 'reset' ? `<div class="vocero-access-intro"><p class="vocero-eyebrow">Recupera tu acceso</p><h1>${title}</h1><p>Elige una contraseña de 10 a 128 caracteres.</p></div><form data-vocero-reset novalidate><fieldset disabled>${password('reset-password', 'Nueva contraseña', 'new-password')}${password('reset-confirmation', 'Confirma tu contraseña', 'new-password')}<button class="vocero-primary" type="submit">Guardar contraseña</button></fieldset></form><a href="/finados/voceros/acceso/?modo=login">Volver a iniciar sesión</a>`
    : `<div class="vocero-access-intro"><p class="vocero-eyebrow">Comunidad de Voceros</p><h1>${title}</h1><p>Crea tu cuenta para completar el registro y consultar su estado.</p></div>
<nav class="vocero-modes" aria-label="Acceso a tu cuenta"><button type="button" data-mode="register" aria-pressed="true">Crear cuenta</button><button type="button" data-mode="login" aria-pressed="false">Iniciar sesión</button></nav>
<form data-vocero-register novalidate><fieldset disabled>${email('register-email')}${password('register-password', 'Contraseña', 'new-password')}<p class="vocero-field-help">De 10 a 128 caracteres. Puedes usar una frase larga.</p>${password('register-confirmation', 'Confirma tu contraseña', 'new-password')}<label class="vocero-check"><input name="privacyAcknowledged" type="checkbox" required><span>${esc(consents.account.text)}</span></label><a href="/finados/voceros/politica-de-privacidad/" target="_blank" rel="noopener noreferrer">Leer Política de Privacidad</a><button class="vocero-primary" type="submit">Crear cuenta</button></fieldset></form>
<form data-vocero-login novalidate hidden><fieldset disabled>${email('login-email')}${password('login-password', 'Contraseña', 'current-password')}<button class="vocero-primary" type="submit">Iniciar sesión</button></fieldset><details class="vocero-help"><summary>¿Olvidaste tu contraseña?</summary><p>Solicita a la coordinación de Voceros un enlace temporal para restablecer tu acceso.</p><a href="/finados/voceros/ejercer-derechos/">Consultar contacto del programa</a></details></form>`;
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Voceros Finados 2026</title><meta name="description" content="Acceso privado y registro de Voceros de Finados Mushuc Runa.">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src ${esc(api)}/; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="vocero-api-base" content="${esc(api)}"><meta name="theme-color" content="#241146">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}"><link rel="icon" href="/assets/finados/favicon-finados.png">
<link rel="stylesheet" href="/assets/finados/vocero-portal.css?v=20260915-1"><script type="module" src="/assets/finados/vocero-portal.js?v=20260915-1"></script>
</head><body class="vocero-portal" data-vocero-view="${mode}">
<a class="skip-link" href="#contenido">Ir al contenido</a><div class="vocero-chumbi" aria-hidden="true"></div>
<header class="vocero-header"><a href="/finados/" aria-label="Finados Mushuc Runa"><img src="/assets/finados/logo-finados.svg" width="766" height="449" alt="Finados 2026, legado que nos une"></a><a href="/finados/voceros/">← Volver a Voceros</a></header>
<main id="contenido" class="vocero-workspace vocero-workspace--${mode}"><div class="vocero-feedback" data-vocero-feedback role="status" aria-live="polite" aria-atomic="true" tabindex="-1">Comprobando acceso…</div><button class="vocero-quiet" data-session-retry type="button" hidden>Reintentar conexión</button><a data-session-login href="/finados/voceros/acceso/?modo=login" hidden>Iniciar sesión nuevamente</a>${content}</main>
<footer class="vocero-footer"><span>Finados Mushuc Runa · Comunidad de Voceros</span><a href="/finados/voceros/politica-de-privacidad/">Privacidad</a></footer><noscript><p>Activa JavaScript para acceder a tu cuenta y completar tu registro.</p></noscript>
</body></html>`;
}
