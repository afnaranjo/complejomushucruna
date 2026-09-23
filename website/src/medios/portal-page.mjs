import { readFileSync } from 'node:fs';
import { escapeHtml as esc } from '../render/html.mjs';
import { ecuadorProvinces } from '../media-accreditation/page.mjs';
import { mediaLegalRoutes } from './legal-page.mjs';
import { apiBasesForCsp, LOCAL_API_BASE, PRIMARY_API_BASE } from '../finados/runtime-origins.mjs';

// Server-owned text is incorporated at build time and escaped as HTML, never fetched by the browser.
const consents = JSON.parse(readFileSync(new URL('../../backend/finados-api/resources/media-consents.json', import.meta.url), 'utf8'));
export const mediaPortalScriptVersion = '20260922-medios-12';

const email = id => `<label class="vocero-field" for="${id}"><span>Correo electrónico</span><input id="${id}" name="email" type="email" autocomplete="username" maxlength="254" autocapitalize="none" spellcheck="false" required></label>`;
const password = (id, label, autocomplete) => `<label class="vocero-field" for="${id}"><span>${label}</span><input id="${id}" name="${id.includes('confirmation') ? 'confirmation' : 'password'}" type="password" autocomplete="${autocomplete}" minlength="${autocomplete === 'current-password' ? '1' : '10'}" maxlength="128" required></label>`;
const required = ' <span aria-hidden="true">*</span>';
export const MEDIA_TYPES = Object.freeze({ radio: 'Radio', tv: 'Televisión', prensa: 'Prensa escrita', digital: 'Medio digital', redes: 'Redes sociales' });
export const CHANNEL_TYPES = Object.freeze({ facebook: 'Facebook', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', x: 'X', website: 'Página web', otro: 'Otro canal' });
export const RADIO_GENRES = Object.freeze(['Noticias e información', 'Musical variada', 'Popular y tropical', 'Folclórica y andina', 'Juvenil y pop', 'Romántica', 'Religiosa', 'Deportiva', 'Comunitaria', 'Otro']);
const legalLink = (key, label) => `<a href="${mediaLegalRoutes[key]}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const consent = (name, key, { optional = false } = {}) => `<label class="vocero-check"><input name="${name}" type="checkbox"${optional ? '' : ' required'} checked><span>${esc(consents[key].text)}${optional ? ' <small>Opcional</small>' : required}</span></label>`;
const field = (name, label, attrs) => `<label class="vocero-field" for="${name}"><span>${label}${required}</span><input id="${name}" name="${name}" ${attrs} required></label>`;

function renderMediaForm() {
  return `<section class="media-dashboard" data-media-dashboard hidden aria-label="Tu medio">
<button class="media-avatar" type="button" data-media-profile-toggle aria-expanded="false" aria-controls="media-profile-panel"><span class="media-avatar__image"><img data-media-avatar alt="" hidden><span data-media-initials aria-hidden="true">M</span></span><span class="media-avatar__text"><strong data-media-name>Tu medio</strong><small data-media-toggle-label>Ver mi perfil</small></span></button>
</section>
<section class="media-status-panel" aria-labelledby="media-status-title"><p class="vocero-eyebrow">Estado del registro</p><h2 id="media-status-title" data-media-status>—</h2><p data-media-status-help>Completa y guarda el registro de tu medio.</p><p class="media-light" data-media-light hidden><span class="media-light__dot" aria-hidden="true"></span><span data-media-light-text></span></p></section>
<section class="media-videos" aria-labelledby="media-videos-title" data-media-videos hidden>
<p class="vocero-eyebrow">Tus publicaciones</p><h2 id="media-videos-title">Videos publicados</h2>
<p>Cada vez que tu medio publique un video sobre Finados Mushuc Runa 2026, pega aquí su link y pulsa «Agregar video». No hay un máximo de cinco: agrega uno por uno todos los que publiques.</p>
<p class="media-videos__locked" data-media-video-locked hidden>Podrás agregar los links de tus videos cuando el equipo de Finados Mushuc Runa apruebe tu registro. Mientras tanto puedes completar tu perfil y subir la foto del representante.</p>
<form data-media-video-form novalidate><fieldset disabled><label class="vocero-field" for="video_url"><span>Link del video${required}</span><input id="video_url" name="url" type="text" inputmode="url" maxlength="500" autocapitalize="none" spellcheck="false" placeholder="Ej.: https://www.tiktok.com/@tumedio/video/…" required></label><button class="vocero-primary" type="submit">Agregar video</button></fieldset></form>
<p class="media-videos__count" data-media-video-count>Aún no has agregado videos.</p>
<ol class="media-videos__list" data-media-video-list></ol>
</section><div class="vocero-notice" data-media-claim hidden><p>Pediste vincular tu cuenta al medio <strong data-media-claim-name></strong>. Coordinación confirmará la vinculación; cuando lo haga, verás aquí tu registro completo.</p></div><div id="media-profile-panel" data-media-profile-panel>
<section class="media-photo" aria-labelledby="media-photo-title" data-media-photo>
<p class="vocero-eyebrow">Obligatoria</p><h2 id="media-photo-title">Foto de la persona responsable${required}</h2>
<p id="media-photo-help">Sube una foto reciente de la <strong>persona responsable del medio</strong>: de frente y con el rostro visible. No uses el logotipo del medio ni una foto grupal. Es obligatoria para verificar su identidad y aprobar el registro; se guarda cifrada y subirla no autoriza por sí sola su publicación. JPG, PNG o WebP; máximo 5 MB.</p>
<div class="media-photo__layout"><div class="vocero-photo-frame media-photo__frame"><img data-media-photo-preview alt="Foto de la persona responsable del medio" hidden><span data-media-photo-placeholder>Sin foto</span></div>
<form data-media-photo-form novalidate><fieldset><label class="vocero-field" for="media_photo"><span data-media-photo-label>Seleccionar fotografía${required}</span><input id="media_photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="media-photo-help"></label><p class="vocero-field-help" data-media-photo-note>La foto se guardará junto con tu registro al pulsar «Guardar registro».</p><button class="vocero-primary" type="submit" data-media-photo-submit hidden>Guardar foto</button></fieldset></form></div>
</section>
<form data-media-profile class="vocero-profile-form media-profile-form" novalidate>
<fieldset data-profile-fields disabled>
<legend class="sr-only">Registro del medio</legend>
<section aria-labelledby="media-data-title"><p class="vocero-eyebrow">01 · Tu medio</p><h2 id="media-data-title">Datos del medio</h2><p>Los campos con * son obligatorios.</p>
<div class="vocero-fields">
<label class="vocero-field media-field-wide" for="media_name"><span>Nombre del medio${required}</span><input id="media_name" name="media_name" type="text" maxlength="140" autocomplete="organization" required></label>
<div class="vocero-notice media-field-wide" data-media-lookup hidden><p>¿Es tu medio? Coordinación ya cargó estos datos. Elige el tuyo y no crees un registro duplicado.</p><ul class="media-lookup-list" data-media-lookup-list></ul></div>
<fieldset class="media-types media-field-wide" data-media-types><legend>Tipo de medio${required} <small>Marca todos los que correspondan; al menos uno.</small></legend>
<div class="media-types__options">${Object.entries(MEDIA_TYPES).map(([key, label]) => `<label><input type="checkbox" name="media_types" value="${key}"><span>${esc(label)}</span></label>`).join('')}</div></fieldset>
<label class="vocero-field" for="province"><span>Provincia${required}</span><select id="province" name="province" autocomplete="address-level1" required><option value="">Selecciona una opción</option>${ecuadorProvinces.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>
${field('city', 'Ciudad', 'type="text" maxlength="100" autocomplete="address-level2"')}
</div></section>
<section aria-labelledby="media-radio-title" data-media-section="radio" hidden><p class="vocero-eyebrow">Radio</p><h2 id="media-radio-title">Emisoras, audiencia y género</h2>
<p>Agrega cada emisora con su frecuencia. Si tu medio tiene más de una, usa «Agregar otra emisora».</p>
<div class="media-stations" data-media-stations></div>
<template data-media-station-template><div class="media-station" data-media-station><label class="vocero-field"><span>Nombre de la emisora${required}</span><input type="text" data-station-name maxlength="140" required></label><label class="vocero-field"><span>Frecuencia${required}</span><input type="text" data-station-frequency maxlength="40" placeholder="Ej.: 99.9 FM" required></label><button class="vocero-quiet" type="button" data-station-remove>Quitar</button></div></template>
<button class="vocero-quiet" type="button" data-station-add>+ Agregar otra emisora</button>
<div class="vocero-fields media-radio-fields">
<label class="vocero-field" for="audience_count"><span>Cantidad de oyentes${required}</span><input id="audience_count" name="audience_count" type="number" min="0" max="100000000" step="1" inputmode="numeric" placeholder="Ej.: 25000" required aria-describedby="audience-help"><small id="audience-help">Audiencia estimada que reporta tu medio, solo números.</small></label>
<label class="vocero-field" for="radio_genre"><span>Género de la radio${required}</span><select id="radio_genre" name="radio_genre" required><option value="">Selecciona una opción</option>${RADIO_GENRES.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>
</div></section>
<section aria-labelledby="media-tv-title" data-media-section="tv" hidden><p class="vocero-eyebrow">Televisión</p><h2 id="media-tv-title">Canales de televisión</h2>
<p>Agrega cada canal o señal. Si tu medio tiene más de uno, usa «Agregar otro canal».</p>
<div class="media-stations" data-media-tv-list></div>
<template data-media-tv-template><div class="media-station media-station--single" data-media-tv-row><label class="vocero-field"><span>Canal o señal${required}</span><input type="text" data-tv-channel maxlength="120" placeholder="Ej.: Canal 25 UHF o señal por cable" required></label><button class="vocero-quiet" type="button" data-row-remove>Quitar</button></div></template>
<button class="vocero-quiet" type="button" data-tv-add>+ Agregar otro canal</button></section>
<section aria-labelledby="media-contact-title"><p class="vocero-eyebrow">02 · Contacto</p><h2 id="media-contact-title">Persona de contacto</h2>
<div class="vocero-fields">
${field('contact_name', 'Nombre y apellido', 'type="text" maxlength="160" autocomplete="name"')}
${field('phone', 'Número telefónico / WhatsApp', 'type="tel" maxlength="25" autocomplete="tel" inputmode="tel" placeholder="Ej.: 0991234567"')}
${field('contact_email', 'Correo de contacto', 'type="email" maxlength="180" autocomplete="email"')}
<label class="vocero-field" for="account-email"><span>Correo de tu cuenta</span><input id="account-email" type="email" data-account-email readonly aria-describedby="account-email-help"><small id="account-email-help">Este correo está vinculado a la cuenta del medio.</small></label>
</div></section>
<section aria-labelledby="media-channels-title"><p class="vocero-eyebrow">03 · Canales digitales</p><h2 id="media-channels-title">Redes sociales y páginas web</h2>
<p id="channels-help">Agrega cada red social o página web de tu medio. Puedes tener más de una cuenta en la misma red: usa «Agregar otro canal» las veces que necesites. Al pegar el enlace se habilita el campo para escribir cuántos seguidores tiene esa cuenta. Se requiere al menos uno.</p>
<div class="media-stations" data-media-channel-list aria-describedby="channels-help"></div>
<template data-media-channel-template><div class="media-station media-station--channel" data-media-channel-row><label class="vocero-field"><span>Red o canal${required}</span><select data-channel-type required>${Object.entries(CHANNEL_TYPES).map(([key, label]) => `<option value="${key}">${esc(label)}</option>`).join('')}</select></label><label class="vocero-field"><span>Enlace${required}</span><input type="text" data-channel-url inputmode="url" maxlength="300" autocapitalize="none" spellcheck="false" placeholder="https://…" required></label><label class="vocero-field"><span>Seguidores <small>Opcional</small></span><input type="number" data-channel-followers min="0" max="1000000000" step="1" inputmode="numeric" placeholder="Pega primero el enlace" disabled></label><button class="vocero-quiet" type="button" data-row-remove>Quitar</button></div></template>
<button class="vocero-quiet" type="button" data-channel-add>+ Agregar otro canal</button></section>
<section aria-labelledby="media-consents-title"><p class="vocero-eyebrow">Aceptaciones</p><h2 id="media-consents-title">Políticas del registro</h2>
<p>Las casillas ya vienen marcadas para que solo tengas que guardar. Puedes leer cada documento antes de aceptar; el uso de imagen es opcional.</p>
${consent('conditions_accepted', 'conditions')}
${consent('privacy_accepted', 'privacy')}
${consent('image_accepted', 'image', { optional: true })}
<p class="vocero-legal-links">${legalLink('practices', 'Buenas prácticas para medios')}${legalLink('privacy', 'Política de Privacidad')}${legalLink('image', 'Autorización de uso de imagen y contenido')}</p>
</section>
<div class="vocero-save"><button class="vocero-primary" type="submit">Guardar registro</button></div>
</fieldset></form>
</div>`;
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
<p class="vocero-notice" data-media-invitation hidden>Coordinación ya cargó los datos de <strong data-media-invitation-name></strong>. Crea tu cuenta aquí y quedará vinculada a ese registro.</p>
<form data-media-register novalidate><fieldset disabled>${email('register-email')}${password('register-password', 'Contraseña', 'new-password')}<p class="vocero-field-help">De 10 a 128 caracteres. Puedes usar una frase larga.</p>${password('register-confirmation', 'Confirma tu contraseña', 'new-password')}<label class="vocero-check"><input name="privacyAcknowledged" type="checkbox" required checked><span>${esc(consents.account.text)}</span></label>${legalLink('privacy', 'Leer Política de Privacidad para medios')}<button class="vocero-primary" type="submit">Crear cuenta</button></fieldset></form>
<form data-media-login novalidate hidden><fieldset disabled>${email('login-email')}${password('login-password', 'Contraseña', 'current-password')}<button class="vocero-primary" type="submit">Iniciar sesión</button></fieldset><details class="vocero-help"><summary>¿Olvidaste tu contraseña?</summary><p>Solicita al equipo de comunicación de Finados Mushuc Runa un enlace temporal para restablecer tu acceso.</p></details></form>`;
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Medios Finados 2026</title><meta name="description" content="Acceso privado y registro de medios de Finados Mushuc Runa.">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src ${connectSources}; base-uri 'none'; form-action 'none'; object-src 'none'">
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
