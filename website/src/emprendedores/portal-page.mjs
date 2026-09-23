import { readFileSync } from 'node:fs';
import { escapeHtml as esc } from '../render/html.mjs';
import { apiBasesForCsp, LOCAL_API_BASE, PRIMARY_API_BASE } from '../finados/runtime-origins.mjs';

// Server-owned text is incorporated at build time and escaped as HTML, never fetched by the browser.
const consents = JSON.parse(readFileSync(new URL('../../backend/finados-api/resources/emprendedor-consents.json', import.meta.url), 'utf8'));
export const emprendedorPortalScriptVersion = '20260922-emprendedores-1';
export const EMPRENDEDOR_LEVELS = Object.freeze(['En preparación', 'Primer video', 'En camino', 'Constante', 'Destacado', 'Referente', 'Tope']);
export const EMPRENDEDOR_NETWORKS = Object.freeze(['TikTok', 'Instagram', 'Facebook']);
export const EMPRENDEDOR_PREVIOUS_PARTICIPATION = Object.freeze(['No, es mi primera vez', 'Sí, en Finados 2025', 'Sí, en Carnaval 2026', 'Sí, en otra edición']);
const BASE = '/finados/emprendedores';

const email = id => `<label class="vocero-field" for="${id}"><span>Correo electrónico</span><input id="${id}" name="email" type="email" autocomplete="username" maxlength="254" autocapitalize="none" spellcheck="false" required></label>`;
const password = (id, label, autocomplete) => `<label class="vocero-field" for="${id}"><span>${label}</span><input id="${id}" name="${id.includes('confirmation') ? 'confirmation' : 'password'}" type="password" autocomplete="${autocomplete}" minlength="${autocomplete === 'current-password' ? '1' : '10'}" maxlength="128" required></label>`;
const field = (name, label, attrs = '', optional = false) => `<label class="vocero-field" for="${name}"><span>${label}${optional ? ' <small>Opcional</small>' : ' <span aria-hidden="true">*</span>'}</span><input id="${name}" name="${name}" ${attrs}${optional ? '' : ' required'}></label>`;
const select = (name, label, values) => `<label class="vocero-field" for="${name}"><span>${label} <span aria-hidden="true">*</span></span><select id="${name}" name="${name}" required><option value="">Selecciona una opción</option>${values.map(value => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>`;

export function renderEmprendedorForm() {
  return `<form data-emprendedor-profile class="vocero-profile-form" novalidate>
<fieldset data-profile-fields disabled>
<legend class="sr-only">Mi registro de Emprendedor</legend>
<div class="vocero-profile-layout">
<section class="vocero-photo" aria-labelledby="photo-title">
<p class="vocero-eyebrow">01 · Tu fotografía</p><h2 id="photo-title">Fotografía para identificación y gafete</h2>
<div class="vocero-photo-frame"><img data-photo-preview alt="Vista previa de tu fotografía para identificación" hidden><span data-photo-placeholder>Tu fotografía<br><small>De frente · Sin filtros</small></span></div>
<p id="photo-help">Sube una foto reciente, de frente, con el rostro visible y sin filtros. Debe ser tuya, no el logotipo de tu emprendimiento. Se usará para verificar tu identidad y elaborar tu gafete. Su carga no autoriza por sí sola la publicación en canales oficiales. JPG, PNG o WebP; máximo 5 MB.</p>
<label class="vocero-field" for="fotografia"><span data-photo-label>Seleccionar fotografía</span><input id="fotografia" name="fotografia" type="file" accept="image/jpeg,image/png,image/webp" required aria-describedby="photo-help"></label>
<button class="vocero-quiet" data-photo-replace type="button" hidden>Reemplazar fotografía</button>
</section>
<div class="vocero-profile-details">
<section aria-labelledby="personal-title"><p class="vocero-eyebrow">02 · Tus datos</p><h2 id="personal-title">Información personal</h2><p>Los campos con * son obligatorios. El programa recibe personas mayores de edad.</p>
<div class="vocero-fields">
${field('nombre_completo', 'Nombre y apellido completos', 'autocomplete="name" minlength="5" maxlength="160"')}
${field('cedula', 'Cédula', 'inputmode="numeric" pattern="[0-9]{10}" minlength="10" maxlength="10" placeholder="Ej.: 1808743587"')}
${field('fecha_nacimiento', 'Fecha de nacimiento', 'type="date"')}
${field('whatsapp', 'Número de WhatsApp', 'type="tel" autocomplete="tel" inputmode="numeric" pattern="09[0-9]{8}" maxlength="10" placeholder="Ej.: 0995874566"')}
<label class="vocero-field" for="account-email"><span>Correo de tu cuenta</span><input id="account-email" type="email" data-account-email readonly aria-describedby="email-help"><small id="email-help">Este correo está vinculado a tu cuenta.</small></label>
${field('ciudad', 'Ciudad', 'autocomplete="address-level2" maxlength="100"')}
</div></section>
<section aria-labelledby="business-title"><p class="vocero-eyebrow">03 · Tu emprendimiento</p><h2 id="business-title">Lo que ofreces en la feria</h2>
<div class="vocero-fields">
${field('emprendimiento', 'Nombre de tu emprendimiento', 'minlength="2" maxlength="160"')}
${field('producto', 'Qué produces o vendes', 'minlength="2" maxlength="300" placeholder="Ej.: Colada morada y guaguas de pan"')}
${field('stand', 'Número o código de stand', 'maxlength="40" placeholder="Si ya lo tienes"', true)}
</div></section>
<section aria-labelledby="social-title"><p class="vocero-eyebrow">04 · Tus redes</p><h2 id="social-title">Dónde publicas tus videos</h2>
<p id="social-help">Comparte al menos un perfil. La coordinación valida en él tus seguidores y las vistas de tus videos. Usa enlaces que comiencen con https://.</p>
<div class="vocero-fields">
${['tiktok', 'instagram', 'facebook'].map(name => field(name, `Enlace de tu perfil de ${name === 'tiktok' ? 'TikTok' : name[0].toUpperCase() + name.slice(1)}`, 'type="url" maxlength="300" pattern="https://.*" aria-describedby="social-help"', true)).join('')}
${select('red_principal', '¿En cuál red publicas más?', EMPRENDEDOR_NETWORKS)}
${select('participacion_previa', '¿Ya has sido expositor de la feria antes?', EMPRENDEDOR_PREVIOUS_PARTICIPATION)}
</div></section>
<section class="vocero-consents" aria-labelledby="consents-title"><p class="vocero-eyebrow">05 · Consentimientos</p><h2 id="consents-title">Revisa y confirma</h2>
${[['policies', 'consentimiento_politicas'], ['image', 'autorizacion_imagen'], ['data', 'consentimiento_datos']].map(([key, name]) => `<label class="vocero-check"><input type="checkbox" name="${name}" value="Sí" required><span>${esc(consents[key].text)}</span></label>`).join('')}
<nav class="vocero-legal-links" aria-label="Documentos de consentimiento"><a href="${BASE}/politicas-del-programa/" target="_blank" rel="noopener noreferrer">Políticas del programa</a><a href="${BASE}/bases-de-participacion/" target="_blank" rel="noopener noreferrer">Bases de participación</a><a href="${BASE}/autorizacion-de-imagen/" target="_blank" rel="noopener noreferrer">Autorización de uso de imagen</a><a href="${BASE}/politica-de-privacidad/" target="_blank" rel="noopener noreferrer">Política de Privacidad</a></nav>
</section><div class="vocero-save"><div><p data-save-help>Tus cambios se guardan automáticamente cuando el formulario está completo.</p><p class="vocero-save-status" data-auto-save-status role="status" aria-live="polite"></p></div><button class="vocero-primary" type="submit">Guardar registro</button></div>
</div></div></fieldset></form>`;
}

export function renderEmprendedorProgressPanels() {
  const levelCards = EMPRENDEDOR_LEVELS.map((label, index) => `<li data-vocero-level="${index}"><span>${String(index).padStart(2, '0')}</span><strong>${label}</strong></li>`).join('');
  return `<section class="vocero-progress-panel" data-vocero-progress aria-labelledby="progress-title"><div class="vocero-section-heading"><div><p class="vocero-eyebrow">Tu camino</p><h2 id="progress-title">Niveles y avances</h2><p>La coordinación actualiza tu avance con la métrica validada de tus redes. El color te muestra en qué momento estás.</p></div><div class="vocero-progress-summary"><div class="vocero-traffic-light" role="img" aria-label="Semáforo de avance"><span data-vocero-light="red"></span><span data-vocero-light="yellow"></span><span data-vocero-light="green"></span></div><strong data-vocero-level-label>En preparación</strong><small><span data-vocero-followers>0</span> seguidores validados</small></div></div><ol class="vocero-levels" data-vocero-levels>${levelCards}</ol><dl class="vocero-progress-meta"><div><dt>Emprendimiento</dt><dd data-emprendedor-business>—</dd></div><div><dt>Videos habilitados</dt><dd><span data-vocero-videos-count>0</span> de 5</dd></div></dl></section>
<section class="vocero-badge-panel" data-vocero-badge hidden aria-labelledby="badge-title"><div><p class="vocero-eyebrow">Comparte tu logro</p><h2 id="badge-title">Tu gafete digital</h2><p>Al completar tu registro, genera una imagen lista para compartir como emprendedor participante de Finados Mushuc Runa 2026.</p><p class="vocero-badge-format">Formato historia 1080 × 1920 · incluye un QR único para validar tu identidad, nivel y semáforo actual. No contiene correo, cédula completa ni fotografía fuera del gafete.</p><p class="vocero-badge-status" data-vocero-badge-status></p><div class="vocero-badge-actions"><button class="vocero-primary" type="button" data-vocero-badge-download>Descargar gafete</button><button class="vocero-quiet" type="button" data-vocero-badge-share>Compartir</button></div></div><div class="vocero-badge-preview"><img data-vocero-badge-preview alt="Gafete digital de emprendedor participante Finados Mushuc Runa 2026, formato historia 1080 por 1920"></div></section>`;
}

export function renderEmprendedorVideosPanel() {
  const videoSlots = Array.from({ length: 5 }, (_, index) => index + 1).map(slot => `<article class="vocero-video-slot" data-video-slot="${slot}"><div class="vocero-video-slot__heading"><span class="vocero-video-number">0${slot}</span><div><h3>Video ${slot}</h3><p data-video-status>Bloqueado por coordinación</p></div></div><label class="vocero-field"><span>Enlace del video</span><input type="url" data-video-url placeholder="https://..." inputmode="url" maxlength="500" disabled></label><button class="vocero-primary vocero-video-save" type="button" data-video-save disabled>Guardar video</button></article>`).join('');
  return `<details class="vocero-videos-panel" data-vocero-videos aria-labelledby="videos-title"><summary><span><span class="vocero-eyebrow">De emprendedor a influencer</span><strong id="videos-title">Tus cinco videos</strong><small>La coordinación habilita cada espacio en una fecha común para todos. Cuando se desbloquee uno, pega aquí el enlace público del video.</small></span><span class="vocero-video-counter"><span data-vocero-videos-count>0</span>/5 habilitados</span></summary><div class="vocero-video-grid">${videoSlots}</div></details>`;
}

export function renderEmprendedorPortalPage(page) {
  const mode = page.route.endsWith('/mi-registro/') ? 'profile' : page.route.endsWith('/restablecer/') ? 'reset' : 'access';
  const api = page.adminEnvironment === 'development' ? (page.adminApiBase ?? LOCAL_API_BASE) : PRIMARY_API_BASE;
  const connectSources = apiBasesForCsp(api);
  const title = { access: 'Tu cuenta de Emprendedor', profile: 'Mi registro', reset: 'Restablecer contraseña' }[mode];
  const content = mode === 'profile' ? `<div class="vocero-workspace-heading"><div><p class="vocero-eyebrow">De emprendedor a influencer</p><h1>${title}</h1><p data-profile-status>Comprobando tu registro…</p></div><button class="vocero-quiet" type="button" data-vocero-logout disabled>Cerrar sesión</button></div>${renderEmprendedorProgressPanels()}${renderEmprendedorForm()}${renderEmprendedorVideosPanel()}`
    : mode === 'reset' ? `<div class="vocero-access-intro"><p class="vocero-eyebrow">Recupera tu acceso</p><h1>${title}</h1><p>Elige una contraseña de 10 a 128 caracteres.</p></div><form data-vocero-reset novalidate><fieldset disabled>${password('reset-password', 'Nueva contraseña', 'new-password')}${password('reset-confirmation', 'Confirma tu contraseña', 'new-password')}<button class="vocero-primary" type="submit">Guardar contraseña</button></fieldset></form><a href="${BASE}/acceso/?modo=login">Volver a iniciar sesión</a>`
    : `<div class="vocero-access-intro"><p class="vocero-eyebrow">De emprendedor a influencer</p><h1>${title}</h1><p>Crea tu cuenta para registrar tu emprendimiento, subir tus videos y consultar tu avance.</p></div>
<nav class="vocero-modes" aria-label="Acceso a tu cuenta"><button type="button" data-mode="register" aria-pressed="true">Crear cuenta</button><button type="button" data-mode="login" aria-pressed="false">Iniciar sesión</button></nav>
<form data-vocero-register novalidate><fieldset disabled>${email('register-email')}${password('register-password', 'Contraseña', 'new-password')}<p class="vocero-field-help">De 10 a 128 caracteres. Puedes usar una frase larga.</p>${password('register-confirmation', 'Confirma tu contraseña', 'new-password')}<label class="vocero-check"><input name="privacyAcknowledged" type="checkbox" required><span>${esc(consents.account.text)}</span></label><a href="${BASE}/politica-de-privacidad/" target="_blank" rel="noopener noreferrer">Leer Política de Privacidad</a><button class="vocero-primary" type="submit">Crear cuenta</button></fieldset></form>
<form data-vocero-login novalidate hidden><fieldset disabled>${email('login-email')}${password('login-password', 'Contraseña', 'current-password')}<button class="vocero-primary" type="submit">Iniciar sesión</button></fieldset><details class="vocero-help"><summary>¿Olvidaste tu contraseña?</summary><p>Solicita a la coordinación del programa un enlace temporal para restablecer tu acceso.</p><a href="${BASE}/ejercer-derechos/">Consultar contacto del programa</a></details></form>`;
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Emprendedores Finados 2026</title><meta name="description" content="Acceso privado y registro del programa De emprendedor a influencer de Finados Mushuc Runa.">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src ${connectSources}; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="emprendedor-api-base" content="${esc(api)}"><meta name="theme-color" content="#241146">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}"><link rel="icon" href="/assets/finados/favicon-finados.png">
<link rel="stylesheet" href="/assets/finados/vocero-portal.css?v=20260915-1"><script type="module" src="/assets/finados/emprendedor-portal.js?v=${emprendedorPortalScriptVersion}"></script>
</head><body class="vocero-portal" data-emprendedor-view="${mode}">
<a class="skip-link" href="#contenido">Ir al contenido</a><div class="vocero-chumbi" aria-hidden="true"></div>
<header class="vocero-header"><a href="/finados/" aria-label="Finados Mushuc Runa"><img src="/assets/finados/logo-finados.svg" width="766" height="449" alt="Finados 2026, legado que nos une"></a><a href="${BASE}/">← Volver a Emprendedores</a></header>
<main id="contenido" class="vocero-workspace vocero-workspace--${mode}"><div class="vocero-feedback" data-vocero-feedback role="status" aria-live="polite" aria-atomic="true" tabindex="-1">Comprobando acceso…</div><button class="vocero-quiet" data-session-retry type="button" hidden>Reintentar conexión</button><a data-session-login href="${BASE}/acceso/?modo=login" hidden>Iniciar sesión nuevamente</a>${content}</main>
<footer class="vocero-footer"><span>Finados Mushuc Runa · De emprendedor a influencer</span><a href="${BASE}/politica-de-privacidad/">Privacidad</a></footer><noscript><p>Activa JavaScript para acceder a tu cuenta y completar tu registro.</p></noscript>
</body></html>`;
}
