import { readFileSync } from 'node:fs';
import { escapeHtml as esc } from '../render/html.mjs';
import { ecuadorProvinces } from '../media-accreditation/page.mjs';
import { apiBasesForCsp, LOCAL_API_BASE, PRIMARY_API_BASE } from '../finados/runtime-origins.mjs';

// Server-owned text is incorporated at build time and escaped as HTML, never fetched by the browser.
const consents = JSON.parse(readFileSync(new URL('../../backend/finados-api/resources/media-consents.json', import.meta.url), 'utf8'));
export const MEDIA_TYPES = Object.freeze(['Radio', 'TV', 'Prensa escrita', 'Digital', 'Redes sociales']);
export const PROGRAM_TYPES = Object.freeze(['Noticias', 'Magazine', 'Cultural', 'Deportivo', 'Entretenimiento', 'Opinión']);
export const mediaPortalScriptVersion = '20260921-medios-1';

const email = id => `<label class="vocero-field" for="${id}"><span>Correo electrónico</span><input id="${id}" name="email" type="email" autocomplete="username" maxlength="254" autocapitalize="none" spellcheck="false" required></label>`;
const password = (id, label, autocomplete) => `<label class="vocero-field" for="${id}"><span>${label}</span><input id="${id}" name="${id.includes('confirmation') ? 'confirmation' : 'password'}" type="password" autocomplete="${autocomplete}" minlength="${autocomplete === 'current-password' ? '1' : '10'}" maxlength="128" required></label>`;
const required = ' <span aria-hidden="true">*</span>';
const field = (name, label, attrs) => `<label class="vocero-field" for="${name}"><span>${label}${required}</span><input id="${name}" name="${name}" ${attrs} required></label>`;
const select = (name, label, values, attrs = '') => `<label class="vocero-field" for="${name}"><span>${label}${required}</span><select id="${name}" name="${name}" ${attrs} required><option value="">Selecciona una opción</option>${values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>`;

function renderMediaForm() {
  return `<section class="media-status-panel" aria-labelledby="media-status-title"><p class="vocero-eyebrow">Estado de la acreditación</p><h2 id="media-status-title" data-media-status>—</h2><p data-media-status-help>Completa y guarda el registro de tu medio.</p></section>
<form data-media-profile class="vocero-profile-form media-profile-form" novalidate>
<fieldset data-profile-fields disabled>
<legend class="sr-only">Registro del medio</legend>
<section aria-labelledby="media-data-title"><p class="vocero-eyebrow">01 · Tu medio</p><h2 id="media-data-title">Datos del medio</h2><p>Los campos con * son obligatorios.</p>
<div class="vocero-fields">
${field('media_name', 'Nombre del medio', 'type="text" maxlength="140" autocomplete="organization"')}
${select('media_type', 'Tipo de medio', MEDIA_TYPES)}
${field('frequency_channel', 'Frecuencia / canal', 'type="text" maxlength="120"')}
${field('program_name', 'Nombre del programa o espacio', 'type="text" maxlength="160"')}
${select('program_type', 'Tipo de programa', PROGRAM_TYPES)}
${select('province', 'Provincia', ecuadorProvinces, 'autocomplete="address-level1"')}
${field('city', 'Ciudad', 'type="text" maxlength="100" autocomplete="address-level2"')}
${select('contract', 'Mantiene contrato vigente con Mushuc Runa', ['Sí', 'No'])}
</div></section>
<section aria-labelledby="media-team-title"><p class="vocero-eyebrow">02 · Equipo de cobertura</p><h2 id="media-team-title">Personas a acreditar</h2>
<div class="vocero-fields">
<label class="vocero-field" for="people_count"><span>Número de personas a acreditar${required}</span><select id="people_count" name="people_count" required><option value="">Selecciona una opción</option><option value="1">1 persona</option><option value="2">2 personas (máximo)</option></select></label>
<label class="vocero-field media-field-wide" for="team"><span>Nombres y cargos del equipo${required}</span><textarea id="team" name="team" rows="4" maxlength="500" placeholder="Ej.: Luis Peña — Reportero" required aria-describedby="team-help"></textarea><small id="team-help">Incluye una línea por cada persona.</small></label>
</div></section>
<section aria-labelledby="media-contact-title"><p class="vocero-eyebrow">03 · Contacto</p><h2 id="media-contact-title">Datos de contacto</h2>
<div class="vocero-fields">
${field('phone', 'Teléfono / WhatsApp', 'type="tel" maxlength="25" autocomplete="tel" inputmode="tel"')}
${field('contact_email', 'Correo electrónico de contacto', 'type="email" maxlength="180" autocomplete="email"')}
<label class="vocero-field" for="account-email"><span>Correo de tu cuenta</span><input id="account-email" type="email" data-account-email readonly aria-describedby="account-email-help"><small id="account-email-help">Este correo está vinculado a la cuenta del medio.</small></label>
</div></section>
<label class="vocero-check"><input name="conditions_accepted" type="checkbox" required><span>${esc(consents.conditions.text)}${required}</span></label>
<p class="vocero-field-help">La información se utilizará únicamente para gestionar la acreditación y el contacto del evento.</p>
<div class="vocero-save"><button class="vocero-primary" type="submit">Guardar registro</button></div>
</fieldset></form>`;
}

export function renderMediaPortalPage(page) {
  const mode = page.route.endsWith('/mi-registro/') ? 'profile' : page.route.endsWith('/restablecer/') ? 'reset' : 'access';
  const api = page.adminEnvironment === 'development' ? (page.adminApiBase ?? LOCAL_API_BASE) : PRIMARY_API_BASE;
  const connectSources = apiBasesForCsp(api);
  const title = { access: 'La cuenta de tu medio', profile: 'Mi registro', reset: 'Restablecer contraseña' }[mode];
  const content = mode === 'profile' ? `<div class="vocero-workspace-heading"><div><p class="vocero-eyebrow">Registro de medios</p><h1>${title}</h1><p data-profile-status>Comprobando tu registro…</p></div><button class="vocero-quiet" type="button" data-media-logout disabled>Cerrar sesión</button></div>${renderMediaForm()}`
    : mode === 'reset' ? `<div class="vocero-access-intro"><p class="vocero-eyebrow">Recupera tu acceso</p><h1>${title}</h1><p>Elige una contraseña de 10 a 128 caracteres.</p></div><form data-media-reset novalidate><fieldset disabled>${password('reset-password', 'Nueva contraseña', 'new-password')}${password('reset-confirmation', 'Confirma tu contraseña', 'new-password')}<button class="vocero-primary" type="submit">Guardar contraseña</button></fieldset></form><a href="/finados/medios/acceso/?modo=login">Volver a iniciar sesión</a>`
    : `<div class="vocero-access-intro"><p class="vocero-eyebrow">Registro de medios</p><h1>${title}</h1><p>Crea la cuenta de tu medio para completar el registro y consultar el estado de la acreditación.</p></div>
<nav class="vocero-modes" aria-label="Acceso a tu cuenta"><button type="button" data-mode="register" aria-pressed="true">Crear cuenta</button><button type="button" data-mode="login" aria-pressed="false">Iniciar sesión</button></nav>
<form data-media-register novalidate><fieldset disabled>${email('register-email')}${password('register-password', 'Contraseña', 'new-password')}<p class="vocero-field-help">De 10 a 128 caracteres. Puedes usar una frase larga.</p>${password('register-confirmation', 'Confirma tu contraseña', 'new-password')}<label class="vocero-check"><input name="privacyAcknowledged" type="checkbox" required><span>${esc(consents.account.text)}</span></label><button class="vocero-primary" type="submit">Crear cuenta</button></fieldset></form>
<form data-media-login novalidate hidden><fieldset disabled>${email('login-email')}${password('login-password', 'Contraseña', 'current-password')}<button class="vocero-primary" type="submit">Iniciar sesión</button></fieldset><details class="vocero-help"><summary>¿Olvidaste tu contraseña?</summary><p>Solicita al equipo de comunicación de Finados Mushuc Runa un enlace temporal para restablecer tu acceso.</p></details></form>`;
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Medios Finados 2026</title><meta name="description" content="Acceso privado y registro de medios de Finados Mushuc Runa.">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src ${connectSources}; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="media-api-base" content="${esc(api)}"><meta name="theme-color" content="#241146">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}"><link rel="icon" href="/assets/finados/favicon-finados.png">
<link rel="stylesheet" href="/assets/finados/vocero-portal.css?v=20260915-1"><link rel="stylesheet" href="/assets/finados/media-portal.css?v=${mediaPortalScriptVersion}"><script type="module" src="/assets/finados/media-portal.js?v=${mediaPortalScriptVersion}"></script>
</head><body class="vocero-portal media-portal" data-media-view="${mode}">
<a class="skip-link" href="#contenido">Ir al contenido</a><div class="vocero-chumbi" aria-hidden="true"></div>
<header class="vocero-header"><a href="/finados/" aria-label="Finados Mushuc Runa"><img src="/assets/finados/logo-finados.svg" width="766" height="449" alt="Finados 2026, legado que nos une"></a><a href="/finados/medios/">← Volver a Medios</a></header>
<main id="contenido" class="vocero-workspace vocero-workspace--${mode}"><div class="vocero-feedback" data-media-feedback role="status" aria-live="polite" aria-atomic="true" tabindex="-1">Comprobando acceso…</div><button class="vocero-quiet" data-session-retry type="button" hidden>Reintentar conexión</button>${content}</main>
<footer class="vocero-footer"><span>Finados Mushuc Runa · Registro de medios</span><a href="/finados/medios/">Medios</a></footer><noscript><p>Activa JavaScript para acceder a la cuenta de tu medio y completar el registro.</p></noscript>
</body></html>`;
}
