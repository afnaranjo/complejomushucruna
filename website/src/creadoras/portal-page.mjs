import { readFileSync } from 'node:fs';
import { escapeHtml as esc } from '../render/html.mjs';
import { apiBasesForCsp, LOCAL_API_BASE, PRIMARY_API_BASE } from '../finados/runtime-origins.mjs';

export const creadoraPortalScriptVersion = '20260923-creadoras-1';
const BASE = '/finados/creadoras';
const consents = JSON.parse(readFileSync(new URL('../../backend/finados-api/resources/creadora-consents.json', import.meta.url), 'utf8'));

export const CREADORA_NETWORKS = Object.freeze([['tiktok', 'TikTok'], ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['youtube', 'YouTube'], ['otro', 'Otra red']]);

const email = id => `<label class="vocero-field" for="${id}"><span>Correo electrónico</span><input id="${id}" name="email" type="email" autocomplete="email" maxlength="254" required inputmode="email" autocapitalize="none" spellcheck="false"></label>`;
const password = (id, label, autocomplete) => `<label class="vocero-field" for="${id}"><span>${esc(label)}</span><input id="${id}" name="password" type="password" autocomplete="${autocomplete}" minlength="10" maxlength="128" required></label>`;
const field = (name, label, attributes = '', optional = false) => `<label class="vocero-field" for="campo-${name}"><span>${esc(label)}${optional ? '' : ' *'}</span><input id="campo-${name}" name="${name}" ${attributes} ${optional ? '' : 'required'}></label>`;

function profileForm() {
  const networks = CREADORA_NETWORKS.map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('');
  return `<form class="vocero-profile" data-creadora-form novalidate><fieldset disabled>
<section aria-labelledby="datos-title"><p class="vocero-eyebrow">01 · Tus datos</p><h2 id="datos-title">Quién eres</h2>
<p>Con esto la coordinación sabe a quién llamar y dónde publicas. Los campos con * son obligatorios.</p>
<div class="vocero-fields">
${field('full_name', 'Nombre y apellido', 'autocomplete="name" minlength="3" maxlength="160"')}
${field('whatsapp', 'Número de WhatsApp', 'type="tel" autocomplete="tel" inputmode="numeric" pattern="09[0-9]{8}" maxlength="10" placeholder="Ej.: 0995874566"')}
<label class="vocero-field" for="account-email"><span>Correo de tu cuenta</span><input id="account-email" type="email" data-account-email readonly aria-describedby="email-help"><small id="email-help">Este correo está vinculado a tu cuenta.</small></label>
${field('city', 'Ciudad', 'autocomplete="address-level2" maxlength="100"', true)}
<label class="vocero-field" for="campo-main_network"><span>¿En qué red publicas más?</span><select id="campo-main_network" name="main_network"><option value="">Sin definir</option>${networks}</select></label>
${field('social_link', 'Enlace de tu cuenta', 'type="url" maxlength="400" pattern="https://.*" placeholder="https://"', true)}
</div></section>
<section class="vocero-consents" aria-labelledby="consents-title"><p class="vocero-eyebrow">02 · Consentimientos</p><h2 id="consents-title">Revisa y confirma</h2>
<label class="vocero-check"><input type="checkbox" name="policies_accepted" required><span>${esc(consents.policies.text)}</span></label>
<label class="vocero-check"><input type="checkbox" name="privacy_accepted" required><span>${esc(consents.privacy.text)}</span></label>
<nav class="vocero-legal-links" aria-label="Documentos de consentimiento"><a href="${BASE}/condiciones/" target="_blank" rel="noopener noreferrer">Condiciones de participación</a><a href="${BASE}/politica-de-privacidad/" target="_blank" rel="noopener noreferrer">Política de Privacidad</a></nav>
</section>
<div class="vocero-save"><p>Guarda para que la coordinación pueda asignarte turnos.</p><button class="vocero-primary" type="submit">Guardar mis datos</button></div>
</fieldset></form>`;
}

function shiftsPanel() {
  return `<section class="vocero-progress-panel" data-creadora-shifts aria-labelledby="turnos-title">
<div class="vocero-section-heading"><div><p class="vocero-eyebrow">Tu calendario</p><h2 id="turnos-title">Cuándo te toca venir</h2>
<p>Los días y horas que la coordinación asignó. Si algo no te queda, avísale antes; aquí no se cambian solos.</p></div></div>
<ol class="creadora-shifts" data-creadora-shift-list><li class="admin-panel-empty">Todavía no tienes turnos asignados.</li></ol>
</section>`;
}

export function renderCreadoraPortalPage(page) {
  const mode = page.route.endsWith('/mi-registro/') ? 'profile' : page.route.endsWith('/restablecer/') ? 'reset' : 'access';
  const api = page.adminEnvironment === 'development' ? (page.adminApiBase ?? LOCAL_API_BASE) : PRIMARY_API_BASE;
  const connectSources = apiBasesForCsp(api);
  const title = { access: 'Tu cuenta de creadora', profile: 'Mi registro', reset: 'Restablecer contraseña' }[mode];
  const content = mode === 'profile'
    ? `<div class="vocero-workspace-heading"><div><p class="vocero-eyebrow">Creadoras de contenido</p><h1>${title}</h1><p data-profile-status>Comprobando tu registro…</p></div><button class="vocero-quiet" type="button" data-creadora-logout disabled>Cerrar sesión</button></div>${shiftsPanel()}${profileForm()}`
    : mode === 'reset'
      ? `<div class="vocero-access-intro"><p class="vocero-eyebrow">Recupera tu acceso</p><h1>${title}</h1><p>Elige una contraseña de 10 a 128 caracteres.</p></div><form data-creadora-reset novalidate><fieldset disabled>${password('reset-password', 'Nueva contraseña', 'new-password')}${password('reset-confirmation', 'Confirma tu contraseña', 'new-password')}<button class="vocero-primary" type="submit">Guardar contraseña</button></fieldset></form><a href="${BASE}/acceso/?modo=login">Volver a iniciar sesión</a>`
      : `<div class="vocero-access-intro"><p class="vocero-eyebrow">Creadoras de contenido</p><h1>${title}</h1><p>Crea tu cuenta para registrar tus datos y ver los días y horas que te tocan.</p></div>
<nav class="vocero-modes" aria-label="Acceso a tu cuenta"><button type="button" data-mode="register" aria-pressed="true">Crear cuenta</button><button type="button" data-mode="login" aria-pressed="false">Iniciar sesión</button></nav>
<form data-creadora-register novalidate><fieldset disabled>${email('register-email')}${password('register-password', 'Contraseña', 'new-password')}<p class="vocero-field-help">De 10 a 128 caracteres. Puedes usar una frase larga.</p>${password('register-confirmation', 'Confirma tu contraseña', 'new-password')}<label class="vocero-check"><input name="privacyAcknowledged" type="checkbox" required><span>${esc(consents.account.text)}</span></label><a href="${BASE}/politica-de-privacidad/" target="_blank" rel="noopener noreferrer">Leer Política de Privacidad</a><button class="vocero-primary" type="submit">Crear cuenta</button></fieldset></form>
<form data-creadora-login novalidate hidden><fieldset disabled>${email('login-email')}${password('login-password', 'Contraseña', 'current-password')}<button class="vocero-primary" type="submit">Iniciar sesión</button></fieldset><details class="vocero-help"><summary>¿Olvidaste tu contraseña?</summary><p>Pide a la coordinación un enlace temporal para restablecer tu acceso.</p></details></form>`;
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Creadoras Finados 2026</title><meta name="description" content="Acceso privado de las creadoras de contenido de Finados Mushuc Runa.">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src ${connectSources}; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="creadora-api-base" content="${esc(api)}"><meta name="theme-color" content="#241146">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}"><link rel="icon" href="/assets/finados/favicon-finados.png">
<link rel="stylesheet" href="/assets/finados/vocero-portal.css?v=20260915-1"><link rel="stylesheet" href="/assets/finados/creadoras.css?v=${creadoraPortalScriptVersion}"><script type="module" src="/assets/finados/creadora-portal.js?v=${creadoraPortalScriptVersion}"></script>
</head><body class="vocero-portal" data-creadora-view="${mode}">
<a class="skip-link" href="#contenido">Ir al contenido</a><div class="vocero-chumbi" aria-hidden="true"></div>
<header class="vocero-header"><a href="/finados/" aria-label="Finados Mushuc Runa"><img src="/assets/finados/logo-finados.svg" width="766" height="449" alt="Finados 2026, legado que nos une"></a><a href="${BASE}/">← Volver a Creadoras</a></header>
<main id="contenido" class="vocero-workspace vocero-workspace--${mode}"><div class="vocero-feedback" data-creadora-feedback role="status" aria-live="polite" aria-atomic="true" tabindex="-1">Comprobando acceso…</div><button class="vocero-quiet" data-session-retry type="button" hidden>Reintentar conexión</button><a data-session-login href="${BASE}/acceso/?modo=login" hidden>Iniciar sesión nuevamente</a>${content}</main>
<footer class="vocero-footer"><span>Finados Mushuc Runa · Creadoras de contenido</span><a href="${BASE}/politica-de-privacidad/">Privacidad</a></footer><noscript><p>Activa JavaScript para acceder a tu cuenta.</p></noscript>
</body></html>`;
}
