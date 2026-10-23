import { escapeHtml as esc } from '../render/html.mjs';
import { apiBasesForCsp, LOCAL_API_BASE, PRIMARY_API_BASE } from './runtime-origins.mjs';
import { inaugurationNarrative } from './influencer-invitation.js';

// Lo que se ve antes de que responda la API; el panel puede cambiarlo (sobre todo la hora).
export const influencerEventDefaults = Object.freeze({
  title: 'Lanzamiento Guaynaa',
  date: '2026-10-15',
  dateLabel: 'Jueves 15 de octubre de 2026',
  time: '18:00',
  place: 'Juan Montalvo y 12 de Noviembre, Ambato, Ecuador',
  dressCode: 'Blanco',
});
export const inaugurationEventDefaults = Object.freeze({
  title: 'Inauguración Oficial de Finados Mushuc Runa',
  date: '2026-10-30',
  dateLabel: 'Viernes 30 de octubre de 2026',
  time: '12:00',
  place: 'Complejo Intercultural y Deportivo Mushuc Runa · Santa Lucía, Tisaleo · Panamericana Sur km 12, vía Ambato–Riobamba',
  dressCode: '',
});
export const influencerInvitationVersion = '20261023-invitacion-9';

function shell(page, { api, body, kind, eventKey = 'guaynaa' }) {
  const connect = apiBasesForCsp(api);
  const preload = eventKey === 'guaynaa'
    ? '<link rel="preload" href="/assets/finados/guaynaa-lanzamiento-hoy-640.webp" as="image" media="(max-width: 700px)"><link rel="preload" href="/assets/finados/guaynaa-lanzamiento-hoy-1122.webp" as="image" media="(min-width: 701px)">'
    : '<link rel="preload" href="/assets/finados/logo-finados.svg?v=20260903" as="image">';
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)} | Finados Mushuc Runa 2026</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; font-src 'self'; connect-src ${connect}; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="invitation-api-base" content="${esc(api)}"><meta name="theme-color" content="#140d1f">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}">
<link rel="icon" href="/assets/finados/favicon-finados.png">
${preload}
<link rel="stylesheet" href="/assets/finados/influencer-invitation.css?v=${influencerInvitationVersion}">
<script type="module" src="/assets/finados/influencer-invitation.js?v=${influencerInvitationVersion}"></script>
</head><body class="inv inv--${eventKey}" data-invitation="${kind}" data-invitation-event="${eventKey}">
<div class="inv-chumbi" aria-hidden="true"></div>
<main id="contenido">
${body}
</main>
<footer class="inv-footer"><img src="/assets/finados/logo-finados.svg?v=20260903" width="766" height="449" alt="Finados Mushuc Runa 2026, legado que nos une"></footer>
<noscript><p class="inv-noscript">Activa JavaScript para confirmar tu asistencia.</p></noscript>
</body></html>`;
}

const eventCard = `<section class="inv-event" aria-labelledby="inv-event-title">
<div class="inv-event-body">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Te esperamos en</p>
<h2 id="inv-event-title" data-event-title>${esc(influencerEventDefaults.title)}</h2>
<dl class="inv-facts">
<div><dt>Cuándo</dt><dd><span data-event-date>${esc(influencerEventDefaults.dateLabel)}</span><small data-event-time>${esc(influencerEventDefaults.time)} · hora de Ecuador</small></dd></div>
<div><dt>Dónde</dt><dd><span data-event-place>${esc(influencerEventDefaults.place)}</span><a class="inv-map" data-event-map href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(influencerEventDefaults.place)}" target="_blank" rel="noopener noreferrer">Cómo llegar →</a></dd></div>
<div class="inv-dress"><dt>Dress code</dt><dd><span class="inv-dress-swatch" aria-hidden="true"></span>${esc(influencerEventDefaults.dressCode)}<small>Ven vestido de blanco.</small></dd></div>
</dl>
<p class="inv-details" data-event-details hidden></p>
</div>
</section>`;

const radarAndPerks = `<section class="inv-radar" aria-labelledby="inv-radar-title">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Estás en nuestro radar</p>
<h2 id="inv-radar-title">Si te llegó esta invitación, es por algo.</h2>
<p><strong>SanFra</strong> y <strong>Mushuc Runa</strong> estamos en busca de talentos para todas nuestras marcas amigas. Este lanzamiento es exclusivo para influencers destacados, y tú estás en nuestro radar.</p>
<p>Te esperamos y queremos contar contigo. Quizá esta sea la oportunidad de colaborar juntos después del lanzamiento y en nuestros nuevos proyectos.</p>
</section>
<section class="inv-perks" aria-labelledby="inv-perks-title">
<h2 id="inv-perks-title">Un evento único, preparado especialmente para ti</h2>
<ul>
<li><span class="inv-perk-icon" aria-hidden="true">★</span><strong>Zona VIP</strong><small>Tu espacio exclusivo durante el lanzamiento.</small></li>
<li><span class="inv-perk-icon" aria-hidden="true">●</span><strong>Zona de creadores</strong><small>Pensada para tu streaming y tu contenido en vivo.</small></li>
<li><span class="inv-perk-icon" aria-hidden="true">✦</span><strong>Zona de cócteles</strong><small>Para compartir y conectar con otros creadores y las marcas.</small></li>
</ul>
</section>`;

const pageApi = page => page.adminEnvironment === 'development' ? (page.adminApiBase ?? LOCAL_API_BASE) : PRIMARY_API_BASE;

/** «Creadores»: invitación personal. El nombre llega desde el enlace (?c=…) que coordinación le envía. */
export function renderInfluencerPersonalPage(page) {
  const body = `<header class="inv-hero">
<figure class="inv-poster"><img src="/assets/finados/guaynaa-lanzamiento-hoy-1122.webp" srcset="/assets/finados/guaynaa-lanzamiento-hoy-640.webp 640w, /assets/finados/guaynaa-lanzamiento-hoy-1122.webp 1122w" sizes="(max-width: 700px) calc(100vw - 32px), 34rem" width="1122" height="1402" alt="SanFra te trae a Guaynaa. Hoy a las 18:00. Dress code: blanco. Finados Mushuc Runa 2026." fetchpriority="high" decoding="async"></figure>
<p class="inv-eyebrow">Una invitación solo para ti</p>
<h1 class="inv-title"><span class="inv-name" data-guest-name>Hola</span><span>queremos que estés aquí.</span></h1>
<p class="inv-lead">Antes de que todo Ecuador lo sepa, queremos que tú lo vivas primero. <strong>SanFra</strong> y <strong>Finados Mushuc Runa</strong> te invitan al <strong>Lanzamiento Guaynaa</strong>.</p>
<p class="inv-story">Finados es tradición, es familia, es volver a casa. Y cada año esa tradición la cuentan voces como la tuya. Por eso no imaginamos este lanzamiento sin ti: tu manera de contar las cosas es parte de lo que Finados quiere ser.</p>
</header>
<section class="inv-confirmed" aria-labelledby="inv-confirmed-title" data-confirmed hidden>
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Asistencia confirmada</p>
<h2 id="inv-confirmed-title"><span data-confirmed-name>¡Ya confirmaste!</span> Te esperamos.</h2>
<dl class="inv-facts">
<div><dt>Cuándo</dt><dd><span data-event-date>${esc(influencerEventDefaults.dateLabel)}</span><small data-event-time>${esc(influencerEventDefaults.time)} · hora de Ecuador</small></dd></div>
<div><dt>Dónde</dt><dd><span data-event-place>${esc(influencerEventDefaults.place)}</span><a class="inv-map" data-event-map href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(influencerEventDefaults.place)}" target="_blank" rel="noopener noreferrer">Cómo llegar →</a></dd></div>
<div class="inv-dress"><dt>Dress code</dt><dd><span class="inv-dress-swatch" aria-hidden="true"></span>${esc(influencerEventDefaults.dressCode)}<small>Ven vestido de blanco.</small></dd></div>
</dl>
<div class="inv-confirmed-badge" data-confirmed-badge hidden>
<p class="inv-status" data-confirmed-status role="status" aria-live="polite">Preparando tu gafete…</p>
<img class="inv-badge-preview" data-confirmed-preview alt="Tu gafete para el Lanzamiento Guaynaa con tu nombre y tu código QR" width="1080" height="1920" hidden>
<div class="inv-choices" data-confirmed-actions hidden>
<button type="button" class="inv-yes" data-confirmed-download>Descargar mi gafete</button>
<button type="button" class="inv-no" data-confirmed-share>Compartir</button>
</div>
<p class="inv-confirmed-note">Presenta el código QR de tu gafete en la entrada.</p>
</div>
<p class="inv-confirmed-note" data-confirmed-pending hidden>Tu gafete estará listo cuando el equipo confirme tu lugar.</p>
<p class="inv-change"><a href="#inv-rsvp-title" data-confirmed-change>Cambiar mi respuesta</a></p>
</section>
${radarAndPerks}
${eventCard}
<section class="inv-rsvp" aria-labelledby="inv-rsvp-title" data-rsvp>
<h2 id="inv-rsvp-title">¿Nos acompañas?</h2>
<p class="inv-status" data-status role="status" aria-live="polite">Cargando tu invitación…</p>
<div class="inv-choices" data-choices hidden>
<button type="button" class="inv-yes" data-answer="si">Sí, ahí estaré</button>
<button type="button" class="inv-no" data-answer="no">Esta vez no podré</button>
</div>
<p class="inv-change" data-badge-link hidden><a href="/finados/invitacion/gafete/">Ver y descargar mi gafete</a></p>
</section>`;
  return shell(page, { api: pageApi(page), body, kind: 'creador' });
}

/** «Nuevos creadores»: invitación abierta; la persona deja sus datos y confirma. */
export function renderInfluencerOpenPage(page) {
  const body = `<header class="inv-hero">
<figure class="inv-poster"><img src="/assets/finados/guaynaa-lanzamiento-hoy-1122.webp" srcset="/assets/finados/guaynaa-lanzamiento-hoy-640.webp 640w, /assets/finados/guaynaa-lanzamiento-hoy-1122.webp 1122w" sizes="(max-width: 700px) calc(100vw - 32px), 34rem" width="1122" height="1402" alt="SanFra te trae a Guaynaa. Hoy a las 18:00. Dress code: blanco. Finados Mushuc Runa 2026." fetchpriority="high" decoding="async"></figure>
<p class="inv-eyebrow">Invitación para creadores</p>
<h1 class="inv-title"><span class="inv-name">Tu voz</span><span>también es parte de esta tradición.</span></h1>
<p class="inv-lead"><strong>SanFra</strong> y <strong>Finados Mushuc Runa</strong> te invitan a vivir desde adentro el <strong>Lanzamiento Guaynaa</strong>, junto a los creadores que cuentan nuestra tierra.</p>
<p class="inv-story">Finados es tradición, es familia, es volver a casa. Y cada historia que se comparte la mantiene viva. Si creas contenido y quieres ser parte de este momento, déjanos tus datos y confirma tu asistencia.</p>
</header>
${radarAndPerks}
${eventCard}
<section class="inv-rsvp" aria-labelledby="inv-form-title">
<h2 id="inv-form-title">Confirma tu asistencia</h2>
<form class="inv-form" data-open-form novalidate>
<label>Nombre y apellido<input name="full_name" autocomplete="name" maxlength="160" required></label>
<label>WhatsApp<input name="whatsapp" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="09…" required></label>
<label>Tu cuenta principal<input name="social_link" maxlength="500" placeholder="@usuario o enlace de TikTok / Instagram" autocapitalize="none" spellcheck="false" required></label>
<div class="inv-form-row">
<label>Seguidores aproximados<input name="followers" type="number" inputmode="numeric" min="0" max="1000000000" step="1" required></label>
<label>Ciudad<input name="city" autocomplete="address-level2" maxlength="120" required></label>
</div>
<fieldset class="inv-answer"><legend>¿Asistirás?</legend>
<label><input type="radio" name="response" value="si" required> Sí, ahí estaré</label>
<label><input type="radio" name="response" value="no"> Esta vez no podré</label>
</fieldset>
<label class="inv-consent"><input type="checkbox" name="consent" required> Autorizo a Finados Mushuc Runa a usar estos datos solo para coordinar mi asistencia a este evento.</label>
<p class="inv-status" data-status role="status" aria-live="polite"></p>
<button type="submit" class="inv-yes">Confirmar</button>
</form>
</section>`;
  return shell(page, { api: pageApi(page), body, kind: 'nuevo' });
}

/** La pantalla de «gracias» a la que pasa cada persona después de confirmar. */
export function renderInfluencerThanksPage(page) {
  const body = `<header class="inv-hero inv-thanks-hero">
<figure class="inv-poster inv-poster--small"><img src="/assets/finados/guaynaa-lanzamiento-hoy-640.webp" width="640" height="800" alt="SanFra te trae a Guaynaa. Hoy a las 18:00. Dress code: blanco. Finados Mushuc Runa 2026." decoding="async"></figure>
<p class="inv-eyebrow" data-thanks-eyebrow>Confirmación recibida</p>
<h1 class="inv-title"><span class="inv-name" data-thanks-title>¡Gracias!</span><span data-thanks-subtitle>Tu respuesta quedó registrada.</span></h1>
<p class="inv-lead" data-thanks-message>Gracias por responder a la invitación al <strong>Lanzamiento Guaynaa</strong>.</p>
</header>
<section class="inv-event" aria-labelledby="inv-event-title" data-thanks-event>
<div class="inv-event-body">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Guarda la fecha</p>
<h2 id="inv-event-title" data-event-title>${esc(influencerEventDefaults.title)}</h2>
<dl class="inv-facts">
<div><dt>Cuándo</dt><dd><span data-event-date>${esc(influencerEventDefaults.dateLabel)}</span><small data-event-time>${esc(influencerEventDefaults.time)} · hora de Ecuador</small></dd></div>
<div><dt>Dónde</dt><dd><span data-event-place>${esc(influencerEventDefaults.place)}</span><a class="inv-map" data-event-map href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(influencerEventDefaults.place)}" target="_blank" rel="noopener noreferrer">Cómo llegar →</a></dd></div>
<div class="inv-dress"><dt>Dress code</dt><dd><span class="inv-dress-swatch" aria-hidden="true"></span>${esc(influencerEventDefaults.dressCode)}<small>Ven vestido de blanco.</small></dd></div>
</dl>
<p class="inv-details" data-event-details hidden></p>
</div>
</section>
<section class="inv-perks" aria-labelledby="inv-perks-title" data-thanks-perks>
<h2 id="inv-perks-title">Lo que te espera</h2>
<ul>
<li><span class="inv-perk-icon" aria-hidden="true">★</span><strong>Zona VIP</strong><small>Tu espacio exclusivo durante el lanzamiento.</small></li>
<li><span class="inv-perk-icon" aria-hidden="true">●</span><strong>Zona de creadores</strong><small>Pensada para tu streaming y tu contenido en vivo.</small></li>
<li><span class="inv-perk-icon" aria-hidden="true">✦</span><strong>Zona de cócteles</strong><small>Para compartir y conectar con otros creadores y las marcas.</small></li>
</ul>
</section>
<div class="inv-badge-cta" data-thanks-badge hidden><a class="inv-yes" data-thanks-badge-link href="/finados/invitacion/gafete/">Ver y descargar mi gafete</a><p>Tu gafete tiene un código QR único: preséntalo en la entrada.</p></div>
<p class="inv-change"><a data-thanks-back href="/finados/invitacion/creadores/" hidden>Cambiar mi respuesta</a></p>`;
  return shell(page, { api: pageApi(page), body, kind: 'gracias' });
}

/** El gafete del invitado: se genera en su teléfono con un QR único que valida su invitación. */
export function renderInfluencerBadgePage(page) {
  const body = `<header class="inv-hero">
<p class="inv-eyebrow">Tu gafete</p>
<h1 class="inv-title"><span class="inv-name" data-badge-name>Tu gafete</span><span>Lanzamiento Guaynaa</span></h1>
<p class="inv-lead">Descárgalo y preséntalo en la entrada. Su código QR es único y valida tu invitación.</p>
</header>
<section class="inv-rsvp inv-badge" aria-labelledby="inv-badge-title">
<h2 id="inv-badge-title" class="sr-only">Gafete</h2>
<p class="inv-status" data-status role="status" aria-live="polite">Preparando tu gafete…</p>
<img class="inv-badge-preview" data-badge-preview alt="Tu gafete para el Lanzamiento Guaynaa con tu nombre y tu código QR" width="1080" height="1920" hidden>
<div class="inv-choices" data-badge-actions hidden>
<button type="button" class="inv-yes" data-badge-download>Descargar gafete</button>
<button type="button" class="inv-no" data-badge-share>Compartir</button>
</div>
</section>`;
  return shell(page, { api: pageApi(page), body, kind: 'gafete' });
}

/** Lo que ve el equipo al escanear el QR del gafete en la puerta. */
export function renderInfluencerVerifyPage(page) {
  const body = `<header class="inv-hero">
<p class="inv-eyebrow">Validación de gafete</p>
<h1 class="inv-title"><span class="inv-name">Lanzamiento</span><span>Guaynaa</span></h1>
</header>
<section class="inv-rsvp inv-verify" aria-live="polite">
<p class="inv-status" data-status role="status">Validando…</p>
<div class="inv-verify-result" data-verify-result hidden>
<p class="inv-verify-state" data-verify-state></p>
<p class="inv-verify-name" data-verify-name></p>
<p class="inv-verify-meta" data-verify-kind></p>
<p class="inv-verify-meta" data-verify-social></p>
</div>
</section>`;
  return shell(page, { api: pageApi(page), body, kind: 'verificar' });
}

/* -------------------------------------------------------------------------- */
/* Inauguración Oficial: el mismo flujo seguro, con identidad y rutas propias. */

const inaugurationVisual = (small = false) => `<figure class="inv-opening-art${small ? ' inv-opening-art--small' : ''}">
<div class="inv-opening-art__halo" aria-hidden="true"></div>
<div class="inv-opening-art__organizer" aria-label="Organiza: Luis Alfonso Chango P."><span>Organiza:</span><strong>Luis Alfonso Chango P.</strong></div>
<img class="inv-opening-art__brand" src="/assets/icons/logo-complejo-mushuc-runa.svg" width="768" height="768" alt="Complejo Intercultural y Deportivo Mushuc Runa" decoding="async">
<p class="inv-opening-art__invites">Te invitamos a la <strong>inauguración</strong> de:</p>
<img class="inv-opening-art__logo" src="/assets/finados/logo-finados.svg?v=20260903" width="766" height="449" alt="Finados Mushuc Runa 2026, ¡Legado que nos une!" decoding="async"${small ? '' : ' fetchpriority="high"'}>
<div class="inv-opening-art__schedule">
<article class="inv-opening-card inv-opening-card--date">
<div aria-hidden="true"><span class="inv-opening-date__save">SAVE THE</span><strong class="inv-opening-date__title">DATE</strong><p class="inv-opening-date__dayline"><span data-event-weekday>VIE</span><b data-event-day>30</b></p><span class="inv-opening-date__month" data-event-month>OCT</span></div>
<time class="sr-only" data-event-date datetime="${esc(inaugurationEventDefaults.date)}">${esc(inaugurationEventDefaults.dateLabel)}</time>
</article>
<div class="inv-opening-art__time"><strong data-event-time-short>${esc(inaugurationEventDefaults.time)}</strong><em>en punto</em></div>
<article class="inv-opening-card inv-opening-card--place"><span>Nos encontramos en</span><strong data-event-place>${esc(inaugurationEventDefaults.place)}</strong></article>
</div>
</figure>`;

const inaugurationEventCard = `<section class="inv-event inv-event--opening" aria-labelledby="inv-event-title">
<div class="inv-event-body">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>La ceremonia comienza</p>
<h2 id="inv-event-title" data-event-title>${esc(inaugurationEventDefaults.title)}</h2>
<dl class="inv-facts">
<div><dt>Cuándo</dt><dd><span data-event-date>${esc(inaugurationEventDefaults.dateLabel)}</span><small data-event-time>${esc(inaugurationEventDefaults.time)} · hora de Ecuador</small></dd></div>
<div><dt>Dónde</dt><dd><span data-event-place>${esc(inaugurationEventDefaults.place)}</span><a class="inv-map" data-event-map href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(inaugurationEventDefaults.place)}" target="_blank" rel="noopener noreferrer">Cómo llegar →</a></dd></div>
</dl>
<p class="inv-details" data-event-details hidden></p>
</div>
</section>`;

const inaugurationMoments = `<section class="inv-perks inv-perks--opening" aria-labelledby="inv-opening-moments-title">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Una apertura para recordar</p>
<h2 id="inv-opening-moments-title">Vivamos juntos el primer momento de Finados 2026</h2>
<ul>
<li><span class="inv-perk-icon" aria-hidden="true">01</span><strong>Bienvenida</strong><small>El encuentro que abre las puertas de nuestra feria.</small></li>
<li><span class="inv-perk-icon" aria-hidden="true">02</span><strong>Acto inaugural</strong><small>La ceremonia oficial que da inicio a esta edición.</small></li>
<li><span class="inv-perk-icon" aria-hidden="true">03</span><strong>Legado compartido</strong><small>Un espacio para celebrar identidad, comunidad y tradición.</small></li>
</ul>
</section>`;

const inaugurationSignature = `<footer class="inv-opening-signature"><span>Atentamente,</span><strong>Ab. Luis Alfonso Chango</strong><small>Mentalizador Feria Finados Mushuc Runa</small></footer>`;

const inaugurationConfirmed = `<section class="inv-confirmed inv-confirmed--opening" aria-labelledby="inv-confirmed-title" data-confirmed hidden>
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Asistencia confirmada</p>
<h2 id="inv-confirmed-title"><span data-confirmed-name>¡Ya confirmaste!</span> Te esperamos.</h2>
<dl class="inv-facts">
<div><dt>Cuándo</dt><dd><span data-event-date>${esc(inaugurationEventDefaults.dateLabel)}</span><small data-event-time>${esc(inaugurationEventDefaults.time)} · hora de Ecuador</small></dd></div>
<div><dt>Dónde</dt><dd><span data-event-place>${esc(inaugurationEventDefaults.place)}</span><a class="inv-map" data-event-map href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(inaugurationEventDefaults.place)}" target="_blank" rel="noopener noreferrer">Cómo llegar →</a></dd></div>
</dl>
<div class="inv-confirmed-badge" data-confirmed-badge hidden>
<p class="inv-status" data-confirmed-status role="status" aria-live="polite">Preparando tu gafete…</p>
<img class="inv-badge-preview" data-confirmed-preview alt="Tu gafete para la Inauguración Oficial de Finados Mushuc Runa con tu nombre y código QR" width="1080" height="1920" hidden>
<div class="inv-choices" data-confirmed-actions hidden><button type="button" class="inv-yes" data-confirmed-download>Descargar mi gafete</button><button type="button" class="inv-no" data-confirmed-share>Compartir</button></div>
<p class="inv-confirmed-note">Presenta el código QR de tu gafete en la entrada.</p>
</div>
<p class="inv-confirmed-note" data-confirmed-pending hidden>Tu gafete estará listo cuando el equipo confirme tu lugar.</p>
<p class="inv-change"><a href="#respuesta">Cambiar mi respuesta</a></p>
</section>`;

export function renderInaugurationPersonalPage(page) {
  const narrative = inaugurationNarrative('apoyo');
  const body = `<header class="inv-hero inv-opening-hero">
${inaugurationVisual()}
<p class="inv-eyebrow" data-opening-eyebrow>${esc(narrative.eyebrow)}</p>
<h1 class="inv-title"><span class="inv-name" data-guest-name>Hola</span><small class="inv-opening-role" data-guest-role>VOCERO/A · CREADOR/A</small><span data-opening-title>${esc(narrative.title)}</span></h1>
<p class="inv-lead" data-opening-lead>${esc(narrative.lead)}</p>
<p class="inv-story" data-opening-story>${esc(narrative.story)}</p>
</header>
${inaugurationConfirmed}
<section class="inv-radar inv-radar--opening" aria-labelledby="inv-opening-story-title">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>¡Legado que nos une!</p>
<h2 id="inv-opening-story-title">La tradición abre sus puertas</h2>
<p>Este viernes comienza una nueva edición de un encuentro construido por generaciones. Nos honra recibirte para compartir la bienvenida, el acto inaugural y el inicio de cinco días de feria.</p>
</section>
${inaugurationEventCard}
${inaugurationMoments}
${inaugurationSignature}
<section id="respuesta" class="inv-rsvp inv-rsvp--opening" aria-labelledby="inv-rsvp-title">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Reserva tu lugar</p>
<h2 id="inv-rsvp-title">¿Nos acompañas?</h2>
<p class="inv-status" data-status role="status" aria-live="polite">Abriendo tu invitación…</p>
<div class="inv-choices" data-choices hidden><button type="button" class="inv-yes" data-answer="si">Sí, ahí estaré</button><button type="button" class="inv-no" data-answer="no">Esta vez no podré</button></div>
<p class="inv-change" data-badge-link hidden><a href="/finados/invitacion/inauguracion/gafete/">Ver y descargar mi gafete</a></p>
</section>`;
  return shell(page, { api: pageApi(page), body, kind: 'creador', eventKey: 'inauguracion' });
}

export function renderInaugurationThanksPage(page) {
  const body = `<header class="inv-hero inv-thanks-hero inv-opening-hero">
${inaugurationVisual(true)}
<p class="inv-eyebrow" data-thanks-eyebrow>Confirmación recibida</p>
<h1 class="inv-title"><span class="inv-name" data-thanks-title>¡Gracias!</span><span data-thanks-subtitle>Tu respuesta quedó registrada.</span></h1>
<p class="inv-lead" data-thanks-message>Gracias por responder a la invitación a la <strong>Inauguración Oficial de Finados Mushuc Runa</strong>.</p>
</header>
${inaugurationEventCard}
<div data-thanks-perks>${inaugurationMoments}</div>
${inaugurationSignature}
<div class="inv-badge-cta" data-thanks-badge hidden><a class="inv-yes" data-thanks-badge-link href="/finados/invitacion/inauguracion/gafete/">Ver y descargar mi gafete</a><p>Tu gafete tiene un código QR único: preséntalo en la entrada.</p></div>
<p class="inv-change"><a data-thanks-back href="/ii/" hidden>Cambiar mi respuesta</a></p>`;
  return shell(page, { api: pageApi(page), body, kind: 'gracias', eventKey: 'inauguracion' });
}

export function renderInaugurationBadgePage(page) {
  const body = `<header class="inv-hero inv-opening-hero">
${inaugurationVisual(true)}
<p class="inv-eyebrow">Tu acceso personal</p>
<h1 class="inv-title"><span class="inv-name" data-badge-name>Tu gafete</span><span>Inauguración Oficial de Finados Mushuc Runa</span></h1>
<p class="inv-lead">Descárgalo y preséntalo en la entrada. Su código QR es único y valida esta invitación.</p>
</header>
<section class="inv-rsvp inv-badge inv-rsvp--opening" aria-labelledby="inv-badge-title"><h2 id="inv-badge-title" class="sr-only">Gafete</h2><p class="inv-status" data-status role="status" aria-live="polite">Preparando tu gafete…</p><img class="inv-badge-preview" data-badge-preview alt="Tu gafete para la Inauguración Oficial de Finados Mushuc Runa con tu nombre y código QR" width="1080" height="1920" hidden><div class="inv-choices" data-badge-actions hidden><button type="button" class="inv-yes" data-badge-download>Descargar gafete</button><button type="button" class="inv-no" data-badge-share>Compartir</button></div></section>`;
  return shell(page, { api: pageApi(page), body, kind: 'gafete', eventKey: 'inauguracion' });
}

export function renderInaugurationVerifyPage(page) {
  const body = `<header class="inv-hero inv-opening-hero">${inaugurationVisual(true)}<p class="inv-eyebrow">Validación de gafete</p><h1 class="inv-title"><span class="inv-name">Inauguración Oficial</span><span>Finados Mushuc Runa 2026</span></h1></header>
<section class="inv-rsvp inv-verify inv-rsvp--opening" aria-live="polite"><p class="inv-status" data-status role="status">Validando…</p><div class="inv-verify-result" data-verify-result hidden><p class="inv-verify-state" data-verify-state></p><p class="inv-verify-name" data-verify-name></p><p class="inv-verify-meta" data-verify-kind></p><p class="inv-verify-meta" data-verify-social></p></div></section>`;
  return shell(page, { api: pageApi(page), body, kind: 'verificar', eventKey: 'inauguracion' });
}
