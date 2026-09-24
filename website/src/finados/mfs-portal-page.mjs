import { readFileSync } from 'node:fs';
import { escapeHtml as esc } from '../render/html.mjs';
import { apiBasesForCsp, LOCAL_API_BASE, PRIMARY_API_BASE } from './runtime-origins.mjs';

// El texto de los consentimientos es del servidor: se incorpora al compilar y se escapa como HTML.
const consents = JSON.parse(readFileSync(new URL('../../backend/finados-api/resources/mfs-consents.json', import.meta.url), 'utf8'));
export const mfsPortalScriptVersion = '20260924-mfs-portal-1';
const BASE = '/finados/mfs';

const email = id => `<label class="vocero-field" for="${id}"><span>Correo electrónico</span><input id="${id}" name="email" type="email" autocomplete="username" maxlength="254" autocapitalize="none" spellcheck="false" required></label>`;
const password = (id, label, autocomplete) => `<label class="vocero-field" for="${id}"><span>${label}</span><input id="${id}" name="${id.includes('confirmation') ? 'confirmation' : 'password'}" type="password" autocomplete="${autocomplete}" minlength="${autocomplete === 'current-password' ? '1' : '10'}" maxlength="128" required></label>`;
const field = (name, label, attrs = '', optional = false) => `<label class="vocero-field" for="${name}"><span>${label}${optional ? ' <small>Opcional</small>' : ' <span aria-hidden="true">*</span>'}</span><input id="${name}" name="${name}" ${attrs}${optional ? '' : ' required'}></label>`;

export function renderMfsForm() {
  return `<form data-mfs-profile class="vocero-profile-form" novalidate>
<fieldset data-profile-fields disabled>
<legend class="sr-only">Mi inscripción en Mushuc Freestyle</legend>
<div class="vocero-profile-layout">
<section class="vocero-photo" aria-labelledby="photo-title">
<p class="vocero-eyebrow">01 · Tu fotografía</p><h2 id="photo-title">Foto tipo retrato</h2>
<div class="vocero-photo-frame"><img data-photo-preview alt="Vista previa de tu fotografía" hidden><span data-photo-placeholder>Tu fotografía<br><small>De frente · Sin filtros</small></span></div>
<p id="photo-help">Sube una foto reciente, de frente y con el rostro visible. Sirve para identificarte en la competencia; subirla no autoriza por sí sola su publicación. JPG, PNG o WebP; máximo 5 MB.</p>
<label class="vocero-field" for="fotografia"><span data-photo-label>Seleccionar fotografía</span><input id="fotografia" name="fotografia" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-help"></label>
</section>
<div class="vocero-profile-details">
<section aria-labelledby="personal-title"><p class="vocero-eyebrow">02 · Tus datos</p><h2 id="personal-title">¿Quién eres en la tarima?</h2><p>Los campos con * son obligatorios.</p>
<div class="vocero-fields">
${field('nombre_completo', 'Nombres y apellidos', 'autocomplete="name" minlength="5" maxlength="160"')}
${field('nombre_artistico', 'Nombre artístico', 'maxlength="80" placeholder="Ej.: MC Chimborazo"', true)}
${field('whatsapp', 'Número de WhatsApp', 'type="tel" autocomplete="tel" inputmode="numeric" pattern="09[0-9]{8}" maxlength="10" placeholder="Ej.: 0995874566"')}
<label class="vocero-field" for="account-email"><span>Correo de tu cuenta</span><input id="account-email" type="email" data-account-email readonly aria-describedby="email-help"><small id="email-help">Este correo está vinculado a tu cuenta.</small></label>
</div></section>
<section aria-labelledby="audition-title"><p class="vocero-eyebrow">03 · Tu audición</p><h2 id="audition-title">Video de audición en TikTok</h2>
<p id="audition-help">Pega el enlace público de tu video en TikTok. En el video preséntate, suelta tus barras y anuncia que la final será en Finados Mushuc Runa 2026. Una vez enviado, el enlace queda fijo: si necesitas cambiarlo, pídelo a la coordinación.</p>
<div class="vocero-fields">
${field('audicion_tiktok', 'Enlace de tu video en TikTok', 'type="url" inputmode="url" maxlength="500" pattern="https://.*tiktok\\.com/.+" placeholder="https://www.tiktok.com/@tu_usuario/video/…" aria-describedby="audition-help"')}
</div>
<label class="vocero-check"><input type="checkbox" name="declaracion_video" value="Sí" required><span>Confirmo que el video es mío, que me presento en él y que anuncio que la final será en Finados Mushuc Runa 2026.</span></label>
</section>
<section class="vocero-consents" aria-labelledby="consents-title"><p class="vocero-eyebrow">04 · Consentimientos</p><h2 id="consents-title">Revisa y confirma</h2>
${[['bases', 'consentimiento_bases'], ['image', 'autorizacion_imagen'], ['data', 'consentimiento_datos']].map(([key, name]) => `<label class="vocero-check"><input type="checkbox" name="${name}" value="Sí" required><span>${esc(consents[key].text)}</span></label>`).join('')}
<nav class="vocero-legal-links" aria-label="Documentos de consentimiento"><a href="${BASE}/bases/" target="_blank" rel="noopener noreferrer">Bases de Mushuc Freestyle</a><a href="${BASE}/politica-de-privacidad/" target="_blank" rel="noopener noreferrer">Política de Privacidad</a></nav>
</section><div class="vocero-save"><div><p data-save-help>Revisa tus datos y envía tu inscripción.</p><p class="vocero-save-status" data-save-status role="status" aria-live="polite"></p></div><button class="vocero-primary" type="submit" data-save-button>Enviar inscripción</button></div>
</div></div></fieldset></form>`;
}

export function renderMfsPortalPage(page) {
  const mode = page.route.endsWith('/mi-registro/') ? 'profile' : page.route.endsWith('/restablecer/') ? 'reset' : 'access';
  const api = page.adminEnvironment === 'development' ? (page.adminApiBase ?? LOCAL_API_BASE) : PRIMARY_API_BASE;
  const connectSources = apiBasesForCsp(api);
  const title = { access: 'Inscríbete en Mushuc Freestyle', profile: 'Mi inscripción', reset: 'Restablecer contraseña' }[mode];
  const content = mode === 'profile' ? `<div class="vocero-workspace-heading"><div><p class="vocero-eyebrow">Mushuc Freestyle 2026 · 2da edición</p><h1>${title}</h1><p data-profile-status>Comprobando tu inscripción…</p></div><button class="vocero-quiet" type="button" data-mfs-logout disabled>Cerrar sesión</button></div>${renderMfsForm()}`
    : mode === 'reset' ? `<div class="vocero-access-intro"><p class="vocero-eyebrow">Recupera tu acceso</p><h1>${title}</h1><p>Elige una contraseña de 10 a 128 caracteres.</p></div><form data-mfs-reset novalidate><fieldset disabled>${password('reset-password', 'Nueva contraseña', 'new-password')}${password('reset-confirmation', 'Confirma tu contraseña', 'new-password')}<button class="vocero-primary" type="submit">Guardar contraseña</button></fieldset></form><a href="${BASE}/acceso/?modo=login">Volver a iniciar sesión</a>`
    : `<div class="vocero-access-intro"><p class="vocero-eyebrow">Mushuc Freestyle 2026 · Inscripción gratuita</p><h1>${title}</h1><p>Crea tu cuenta, inicia sesión y envía tus datos, tu foto y el enlace de tu audición en TikTok.</p></div>
<nav class="vocero-modes" aria-label="Acceso a tu cuenta"><button type="button" data-mode="register" aria-pressed="true">Crear cuenta</button><button type="button" data-mode="login" aria-pressed="false">Iniciar sesión</button></nav>
<form data-mfs-register novalidate><fieldset disabled>${email('register-email')}${password('register-password', 'Contraseña', 'new-password')}<p class="vocero-field-help">De 10 a 128 caracteres. Puedes usar una frase larga.</p>${password('register-confirmation', 'Confirma tu contraseña', 'new-password')}<label class="vocero-check"><input name="privacyAcknowledged" type="checkbox" required><span>${esc(consents.account.text)}</span></label><a href="${BASE}/politica-de-privacidad/" target="_blank" rel="noopener noreferrer">Leer Política de Privacidad</a><button class="vocero-primary" type="submit">Crear cuenta</button></fieldset></form>
<form data-mfs-login novalidate hidden><fieldset disabled>${email('login-email')}${password('login-password', 'Contraseña', 'current-password')}<button class="vocero-primary" type="submit">Iniciar sesión</button></fieldset><details class="vocero-help"><summary>¿Olvidaste tu contraseña?</summary><p>Pide a la coordinación de Mushuc Freestyle un enlace temporal para restablecer tu acceso.</p></details></form>`;
  return `<!doctype html><html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Mushuc Freestyle 2026</title><meta name="description" content="Acceso privado e inscripción de participantes de Mushuc Freestyle 2026.">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src ${connectSources}; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="mfs-api-base" content="${esc(api)}"><meta name="theme-color" content="#173976">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}"><link rel="icon" href="/assets/finados/mfs/mfs-icono.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/finados/vocero-portal.css?v=20260915-1"><script type="module" src="/assets/finados/mfs-portal.js?v=${mfsPortalScriptVersion}"></script>
</head><body class="vocero-portal" data-mfs-view="${mode}">
<a class="skip-link" href="#contenido">Ir al contenido</a><div class="vocero-chumbi" aria-hidden="true"></div>
<header class="vocero-header"><a href="${BASE}/" aria-label="Mushuc Freestyle 2026"><img src="/assets/finados/mfs/mfs-logo.svg" width="1686" height="469" alt="Mushuc Freestyle"></a><a href="${BASE}/">← Volver a Mushuc Freestyle</a></header>
<main id="contenido" class="vocero-workspace vocero-workspace--${mode}"><div class="vocero-feedback" data-mfs-feedback role="status" aria-live="polite" aria-atomic="true" tabindex="-1">Comprobando acceso…</div><button class="vocero-quiet" data-session-retry type="button" hidden>Reintentar conexión</button><a data-session-login href="${BASE}/acceso/?modo=login" hidden>Iniciar sesión nuevamente</a>${content}</main>
<footer class="vocero-footer"><span>Finados Mushuc Runa · Mushuc Freestyle 2026</span><a href="${BASE}/politica-de-privacidad/">Privacidad</a></footer><noscript><p>Activa JavaScript para acceder a tu cuenta y completar tu inscripción.</p></noscript>
</body></html>`;
}
