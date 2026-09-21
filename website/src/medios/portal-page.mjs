import { readFileSync } from 'node:fs';
import { escapeHtml as esc } from '../render/html.mjs';
import { ecuadorProvinces } from '../media-accreditation/page.mjs';
import { mediaLegalRoutes } from './legal-page.mjs';
import { apiBasesForCsp, LOCAL_API_BASE, PRIMARY_API_BASE } from '../finados/runtime-origins.mjs';

// Server-owned text is incorporated at build time and escaped as HTML, never fetched by the browser.
const consents = JSON.parse(readFileSync(new URL('../../backend/finados-api/resources/media-consents.json', import.meta.url), 'utf8'));
export const mediaPortalScriptVersion = '20260921-medios-5';

const email = id => `<label class="vocero-field" for="${id}"><span>Correo electrónico</span><input id="${id}" name="email" type="email" autocomplete="username" maxlength="254" autocapitalize="none" spellcheck="false" required></label>`;
const password = (id, label, autocomplete) => `<label class="vocero-field" for="${id}"><span>${label}</span><input id="${id}" name="${id.includes('confirmation') ? 'confirmation' : 'password'}" type="password" autocomplete="${autocomplete}" minlength="${autocomplete === 'current-password' ? '1' : '10'}" maxlength="128" required></label>`;
const required = ' <span aria-hidden="true">*</span>';
const legalLink = (key, label) => `<a href="${mediaLegalRoutes[key]}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const consent = (name, key, { optional = false } = {}) => `<label class="vocero-check"><input name="${name}" type="checkbox"${optional ? '' : ' required'} checked><span>${esc(consents[key].text)}${optional ? ' <small>Opcional</small>' : required}</span></label>`;
const channel = (name, label, placeholder) => `<label class="vocero-field" for="${name}"><span>${label} <small>Opcional</small></span><input id="${name}" name="${name}" type="text" inputmode="url" maxlength="300" autocapitalize="none" spellcheck="false" placeholder="${placeholder}" data-media-channel></label>`;
const field = (name, label, attrs) => `<label class="vocero-field" for="${name}"><span>${label}${required}</span><input id="${name}" name="${name}" ${attrs} required></label>`;

function renderMediaForm() {
  return `<section class="media-status-panel" aria-labelledby="media-status-title"><p class="vocero-eyebrow">Estado del registro</p><h2 id="media-status-title" data-media-status>—</h2><p data-media-status-help>Completa y guarda el registro de tu medio.</p></section>
<form data-media-profile class="vocero-profile-form media-profile-form" novalidate>
<fieldset data-profile-fields disabled>
<legend class="sr-only">Registro del medio</legend>
<section aria-labelledby="media-data-title"><p class="vocero-eyebrow">01 · Tu medio</p><h2 id="media-data-title">Datos del medio</h2><p>Los campos con * son obligatorios.</p>
<div class="vocero-fields">
${field('media_name', 'Nombre del medio', 'type="text" maxlength="140" autocomplete="organization"')}
${field('frequency_channel', 'Frecuencia / canal', 'type="text" maxlength="120" placeholder="Ej.: 99.9 FM, canal 25 o solo digital"')}
<label class="vocero-field" for="province"><span>Provincia${required}</span><select id="province" name="province" autocomplete="address-level1" required><option value="">Selecciona una opción</option>${ecuadorProvinces.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>
${field('city', 'Ciudad', 'type="text" maxlength="100" autocomplete="address-level2"')}
</div></section>
<section aria-labelledby="media-contact-title"><p class="vocero-eyebrow">02 · Contacto</p><h2 id="media-contact-title">Persona de contacto</h2>
<div class="vocero-fields">
${field('contact_name', 'Nombre y apellido', 'type="text" maxlength="160" autocomplete="name"')}
${field('phone', 'Número telefónico / WhatsApp', 'type="tel" maxlength="25" autocomplete="tel" inputmode="tel" placeholder="Ej.: 0991234567"')}
${field('contact_email', 'Correo de contacto', 'type="email" maxlength="180" autocomplete="email"')}
<label class="vocero-field" for="account-email"><span>Correo de tu cuenta</span><input id="account-email" type="email" data-account-email readonly aria-describedby="account-email-help"><small id="account-email-help">Este correo está vinculado a la cuenta del medio.</small></label>
</div></section>
<section aria-labelledby="media-channels-title"><p class="vocero-eyebrow">03 · Canales del medio</p><h2 id="media-channels-title">Redes sociales y página web</h2>
<p id="channels-help">Pega el enlace de cada canal que tenga tu medio. Completa al menos uno.</p>
<div class="vocero-fields" aria-describedby="channels-help">
${channel('facebook', 'Facebook', 'https://www.facebook.com/tumedio')}
${channel('instagram', 'Instagram', 'https://www.instagram.com/tumedio')}
${channel('tiktok', 'TikTok', 'https://www.tiktok.com/@tumedio')}
${channel('youtube', 'YouTube', 'https://www.youtube.com/@tumedio')}
${channel('website', 'Página web', 'https://www.tumedio.com')}
${channel('other_link', 'Otro canal', 'X, Threads, WhatsApp Channel u otro')}
</div></section>
<section aria-labelledby="media-consents-title"><p class="vocero-eyebrow">Aceptaciones</p><h2 id="media-consents-title">Políticas del registro</h2>
<p>Las casillas ya vienen marcadas para que solo tengas que guardar. Puedes leer cada documento antes de aceptar; el uso de imagen es opcional.</p>
${consent('conditions_accepted', 'conditions')}
${consent('privacy_accepted', 'privacy')}
${consent('image_accepted', 'image', { optional: true })}
<p class="vocero-legal-links">${legalLink('practices', 'Buenas prácticas para medios')}${legalLink('privacy', 'Política de Privacidad')}${legalLink('image', 'Autorización de uso de imagen y contenido')}</p>
</section>
<div class="vocero-save"><button class="vocero-primary" type="submit">Guardar registro</button></div>
</fieldset></form>
<section class="media-videos" aria-labelledby="media-videos-title" data-media-videos hidden>
<p class="vocero-eyebrow">04 · Tus publicaciones</p><h2 id="media-videos-title">Videos publicados</h2>
<p>Cada vez que tu medio publique un video sobre Finados Mushuc Runa 2026, pega aquí su link. Puedes agregar todos los que necesites.</p>
<form data-media-video-form novalidate><fieldset disabled><label class="vocero-field" for="video_url"><span>Link del video${required}</span><input id="video_url" name="url" type="text" inputmode="url" maxlength="500" autocapitalize="none" spellcheck="false" placeholder="Ej.: https://www.tiktok.com/@tumedio/video/…" required></label><button class="vocero-primary" type="submit">Agregar video</button></fieldset></form>
<p class="media-videos__count" data-media-video-count>Aún no has agregado videos.</p>
<ol class="media-videos__list" data-media-video-list></ol>
</section>`;
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
<form data-media-register novalidate><fieldset disabled>${email('register-email')}${password('register-password', 'Contraseña', 'new-password')}<p class="vocero-field-help">De 10 a 128 caracteres. Puedes usar una frase larga.</p>${password('register-confirmation', 'Confirma tu contraseña', 'new-password')}<label class="vocero-check"><input name="privacyAcknowledged" type="checkbox" required checked><span>${esc(consents.account.text)}</span></label>${legalLink('privacy', 'Leer Política de Privacidad para medios')}<button class="vocero-primary" type="submit">Crear cuenta</button></fieldset></form>
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
