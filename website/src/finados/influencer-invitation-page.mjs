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
export const influencerInvitationVersion = '20261026-plazo-14-1';

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
<li><span class="inv-perk-icon" aria-hidden="true">03</span><strong>Recorrido en el tren</strong><small>Conoce el Complejo a bordo de nuestro tren, junto a los demás invitados especiales.</small></li>
<li><span class="inv-perk-icon" aria-hidden="true">04</span><strong>Break para compartir</strong><small>Un momento para conversar, celebrar y conocernos.</small></li>
<li><span class="inv-perk-icon" aria-hidden="true">05</span><strong>Entradas Arena</strong><small>Por asistir, recibes entradas Arena para los conciertos de Finados 2026.</small></li>
</ul>
</section>`;

/** Lo que solo viven quienes nos acompañan: el tren del Complejo y un break para compartir. */
const inaugurationSpecialGuests = `<section class="inv-special" aria-labelledby="inv-special-title">
<figure class="inv-special__photo"><img src="/assets/finados/tren-complejo-752.webp" srcset="/assets/finados/tren-complejo-480.webp 480w, /assets/finados/tren-complejo-752.webp 752w" sizes="(max-width: 700px) calc(100vw - 32px), 34rem" width="752" height="666" alt="El tren del Complejo Mushuc Runa con visitantes saludando desde el piso superior" loading="lazy" decoding="async"></figure>
<div class="inv-special__body">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Solo para nuestros invitados especiales</p>
<h2 id="inv-special-title">Ese día, eres parte del recorrido</h2>
<p>Quienes nos acompañen en la inauguración serán nuestros invitados especiales: recorrerán el Complejo a bordo del <strong>tren del Complejo Mushuc Runa</strong> y compartiremos juntos un <strong>pequeño break</strong>.</p>
<p class="inv-special__gift"><span aria-hidden="true">🎟</span><span><strong>Además, por asistir recibes entradas Arena</strong> para disfrutar los conciertos de Finados 2026.</span></p>
<p>Queremos que vivas la apertura de Finados 2026 desde adentro, como alguien de casa.</p>
</div>
</section>`;

export const INAUGURATION_TERMS_PATH = '/finados/invitacion/inauguracion/condiciones/';
/** Versión del texto de condiciones que acepta quien confirma; súbela si cambia el contenido. */
export const INAUGURATION_TERMS_VERSION = '2026-10-24';

/** Hasta cuándo se puede confirmar (hora de Ecuador). Debe coincidir con InfluencerRepository::RSVP_DEADLINES. */
export const INAUGURATION_RSVP_DEADLINE = '2026-10-26T14:00:00-05:00';

const inaugurationDeadline = `<section class="inv-deadline" data-deadline data-deadline-at="${INAUGURATION_RSVP_DEADLINE}" aria-labelledby="inv-deadline-title">
<p class="inv-deadline__label" id="inv-deadline-title" data-deadline-label>Confirma tu asistencia hasta el</p>
<p class="inv-deadline__date"><time datetime="${INAUGURATION_RSVP_DEADLINE}">Lunes 26 de octubre · 14:00</time></p>
<div class="inv-deadline__clock" data-deadline-clock role="timer" aria-label="Tiempo que queda para confirmar">
<span><b data-deadline-days>--</b><small>días</small></span><span><b data-deadline-hours>--</b><small>horas</small></span><span><b data-deadline-minutes>--</b><small>min</small></span><span><b data-deadline-seconds>--</b><small>seg</small></span>
</div>
<p class="inv-deadline__note" data-deadline-note>Con tu confirmación armamos el listado oficial de invitados. Después de esa hora ya no podremos incluirte.</p>
</section>`;

/** Solo para voceros que todavía no subieron su video: la invitación también los anima a grabarlo. */
const inaugurationVideoNudge = `<section class="inv-video" data-opening-video hidden aria-labelledby="inv-video-title">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Tu voz también cuenta</p>
<h2 id="inv-video-title">Todavía estás a tiempo de subir tu video</h2>
<p>Tu primer video puede ser el que invite a otra familia a volver a Finados. Graba con tu celular qué significa Finados para ti o qué te emociona de esta edición, publícalo en tus redes y súbelo en tu registro de vocero.</p>
<ol class="inv-video__steps"><li><b>1</b>Graba un video corto con tu celular.</li><li><b>2</b>Publícalo en TikTok, Instagram o Facebook.</li><li><b>3</b>Pega el enlace en tu registro de vocero.</li></ol>
<p class="inv-video__extra">Llega a la inauguración con tu video publicado: es la mejor forma de empezar a contar esta tradición.</p>
<a class="inv-yes inv-video__cta" href="/finados/voceros/mi-registro/" target="_blank" rel="noopener">Subir mi video</a>
</section>`;

const inaugurationFinePrint = `<p class="inv-fineprint">Invitación personal e intransferible. Actividades, horarios, recorrido en tren, break y entradas sujetos a cambios y a disponibilidad. Aplican restricciones. <a href="${INAUGURATION_TERMS_PATH}" target="_blank" rel="noopener">Ver condiciones</a>.</p>`;

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
<h1 class="inv-title"><span class="inv-name" data-guest-name>Hola</span><span data-opening-title>${esc(narrative.title)}</span></h1>
<p class="inv-lead" data-opening-lead>${esc(narrative.lead)}</p>
<p class="inv-story" data-opening-story>${esc(narrative.story)}</p>
</header>
${inaugurationDeadline}
${inaugurationConfirmed}
<section class="inv-radar inv-radar--opening" aria-labelledby="inv-opening-story-title">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>¡Legado que nos une!</p>
<h2 id="inv-opening-story-title">La tradición abre sus puertas</h2>
<p>Este viernes comienza una nueva edición de un encuentro construido por generaciones. Nos honra recibirte para compartir la bienvenida, el acto inaugural y el inicio de cinco días de feria.</p>
</section>
${inaugurationSpecialGuests}
${inaugurationVideoNudge}
${inaugurationEventCard}
${inaugurationMoments}
${inaugurationSignature}
<section id="respuesta" class="inv-rsvp inv-rsvp--opening" aria-labelledby="inv-rsvp-title">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Reserva tu lugar</p>
<h2 id="inv-rsvp-title">¿Nos acompañas?</h2>
<p class="inv-rsvp-deadline" data-deadline-inline>Tienes hasta el <strong>lunes 26 de octubre a las 14:00</strong> para confirmar.</p>
<p class="inv-status" data-status role="status" aria-live="polite">Abriendo tu invitación…</p>
<p class="inv-accept">Al confirmar «Sí, ahí estaré» aceptas las <a href="${INAUGURATION_TERMS_PATH}" target="_blank" rel="noopener">condiciones de la invitación</a>, incluida la autorización de uso de tu imagen captada durante la inauguración.</p>
<div class="inv-choices" data-choices hidden><button type="button" class="inv-yes" data-answer="si">Sí, ahí estaré</button><button type="button" class="inv-no" data-answer="no">Esta vez no podré</button></div>
<p class="inv-change" data-badge-link hidden><a href="/finados/invitacion/inauguracion/gafete/">Ver y descargar mi gafete</a></p>
</section>
${inaugurationFinePrint}`;
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
<p class="inv-change"><a data-thanks-back href="/ii/" hidden>Cambiar mi respuesta</a></p>
${inaugurationFinePrint}`;
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

/** Condiciones de la invitación: beneficios, cambios, uso de imagen y datos. Lo que acepta quien confirma. */
export function renderInaugurationTermsPage(page) {
  const c = { name: 'Eventos Finados 2026', address: 'Santa Lucía, Tisaleo, Tungurahua – Panamericana Sur km 12, vía Ambato–Riobamba', phone: '+593 980 346 729', email: 'facturacioncomplejomushuc@gmail.com' };
  const body = `<header class="inv-hero inv-opening-hero"><p class="inv-eyebrow">Inauguración Oficial · Finados Mushuc Runa 2026</p><h1 class="inv-title"><span class="inv-name">Condiciones</span><span>de la invitación</span></h1>
<p class="inv-lead">Versión ${INAUGURATION_TERMS_VERSION}. Al confirmar tu asistencia con «Sí, ahí estaré» aceptas estas condiciones.</p></header>
<article class="inv-terms">
<section><h2>1. La invitación</h2><p>La invitación es personal e intransferible y se dirige a voceros y creadores de contenido de Finados Mushuc Runa 2026. Los cupos son limitados. Para ingresar se presenta el gafete con código QR que se genera al confirmar la asistencia.</p></section>
<section><h2>2. Beneficios para invitados especiales</h2><p>Quienes asistan a la inauguración podrán participar del recorrido en el tren del Complejo Mushuc Runa y de un break para compartir, y recibirán entradas de la localidad Arena para los conciertos de Finados 2026. Las entradas se entregan solo a quien asiste y registra su llegada; la cantidad, los shows y la forma de entrega los comunica la organización. Son personales, están sujetas a disponibilidad y no se canjean por dinero.</p></section>
<section><h2>3. Sujeto a cambios</h2><p>Los horarios, actividades, recorridos, beneficios y entradas pueden cambiar, reprogramarse o suspenderse por razones de seguridad, clima, operación del evento o fuerza mayor, sin que esto genere compensación. Aplican restricciones de aforo, edad, seguridad e ingreso. Sigue en todo momento las indicaciones del personal de la organización y de seguridad.</p></section>
<section><h2>4. Uso de imagen</h2><p>Durante la inauguración se toman fotografías y videos. Al confirmar tu asistencia autorizas a ${c.name} a usar, sin costo, tu imagen y tu voz captadas en el evento, junto con tu nombre y tu calidad de vocero o creador de contenido, para difundir Finados Mushuc Runa 2026 en su sitio web, redes sociales oficiales, piezas digitales e impresas y pantallas. La licencia es no exclusiva y no se cede a terceros para campañas ajenas. Puedes revocarla escribiendo a <a href="mailto:${c.email}">${c.email}</a>; la organización dejará de hacer nuevos usos, sin efectos retroactivos.</p></section>
<section><h2>5. Datos personales</h2><p>El responsable es <strong>${c.name}</strong>, con domicilio en ${c.address}, teléfono ${c.phone} y correo <a href="mailto:${c.email}">${c.email}</a>. Se tratan tu nombre, tu WhatsApp, tu respuesta, la fecha de tu confirmación y de tu llegada, solo para coordinar tu asistencia, entregar tus beneficios y validar tu ingreso. Puedes ejercer tus derechos de acceso, rectificación, eliminación, oposición, suspensión y portabilidad escribiendo a ese correo, conforme a la Ley Orgánica de Protección de Datos Personales.</p></section>
<section><h2>6. Si no puedes asistir</h2><p>Si respondes «Esta vez no podré» no aceptas estas condiciones ni recibes los beneficios. Puedes cambiar tu respuesta desde el mismo enlace mientras haya cupo.</p></section>
</article>`;
  return shell(page, { api: pageApi(page), body, kind: 'condiciones', eventKey: 'inauguracion' });
}

/** Enlace único para voceros: ven la invitación y, para confirmar, inician sesión con su cuenta de vocero. */
export function renderInaugurationVoceroGatePage(page) {
  const body = `<header class="inv-hero inv-opening-hero">
${inaugurationVisual()}
<p class="inv-eyebrow">Invitación para nuestros voceros</p>
<h1 class="inv-title"><span class="inv-name">Voceros de Finados,</span><span>queremos que estén en el inicio.</span></h1>
<p class="inv-lead">Por primera vez abriremos la feria junto a quienes ya están ayudando a contarla. Te invitamos a la Inauguración Oficial de Finados Mushuc Runa.</p>
<p class="inv-story">Inicia sesión con tu cuenta de vocero para ver tu invitación personal y confirmar tu asistencia.</p>
<p class="inv-gate-jump"><a class="inv-yes" href="#respuesta">Confirmar mi asistencia</a></p>
</header>
${inaugurationDeadline}
${inaugurationSpecialGuests}
${inaugurationEventCard}
${inaugurationMoments}
${inaugurationSignature}
<section id="respuesta" class="inv-rsvp inv-rsvp--opening inv-gate" aria-labelledby="inv-gate-title">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Reserva tu lugar</p>
<h2 id="inv-gate-title">Confirma tu asistencia</h2>
<p class="inv-rsvp-deadline" data-deadline-inline>Tienes hasta el <strong>lunes 26 de octubre a las 14:00</strong> para confirmar.</p>
<p class="inv-gate-help">Inicia sesión con la misma cuenta con la que entras a tu registro de vocero. Te llevamos a tu invitación personal para que confirmes.</p>
<form class="inv-form" data-gate-form novalidate>
<fieldset disabled>
<label>Correo de tu cuenta de vocero<input name="email" type="email" autocomplete="username" inputmode="email" maxlength="254" required autocapitalize="none" spellcheck="false"></label>
<label>Contraseña<input name="password" type="password" autocomplete="current-password" maxlength="1024" required></label>
<button type="submit" class="inv-yes">Ver mi invitación</button>
</fieldset>
<p class="inv-status" data-status role="status" aria-live="polite">Comprobando tu sesión…</p>
</form>
<div class="inv-gate-missing" data-gate-missing hidden>
<p><strong>Primero completa tu registro de vocero.</strong> Tu cuenta todavía no tiene tu ficha con tus datos. Llénala, guárdala y vuelve a este mismo enlace para confirmar tu asistencia.</p>
<a class="inv-yes" href="/finados/voceros/mi-registro/">Completar mi registro</a>
</div>
<p class="inv-gate-links"><a href="/finados/voceros/acceso/?modo=recuperar" target="_blank" rel="noopener">¿Olvidaste tu contraseña? Recupérala aquí</a> · <a href="/finados/voceros/acceso/" target="_blank" rel="noopener">Crear cuenta</a></p>
</section>
${inaugurationFinePrint}`;
  return shell(page, { api: pageApi(page), body, kind: 'vocero-acceso', eventKey: 'inauguracion' });
}

/** Hasta cuándo pueden confirmar los medios (hora de Ecuador). Debe coincidir con el plazo del evento en Medios → Eventos. */
export const MEDIA_INAUGURATION_DEADLINE = '2026-10-28T12:00:00-05:00';

/** Enlace para el grupo de medios: la invitación, las indicaciones y la confirmación directa, sin cuenta. */
export function renderInaugurationMediaPage(page) {
  const body = `<header class="inv-hero inv-opening-hero">
${inaugurationVisual()}
<p class="inv-eyebrow">Invitación para medios de comunicación</p>
<h1 class="inv-title"><span class="inv-name">Medios de comunicación,</span><span>los esperamos en la inauguración.</span></h1>
<p class="inv-lead">Acompáñennos en la Inauguración Oficial de Finados Mushuc Runa 2026 y cuenten desde adentro el inicio de esta tradición.</p>
<p class="inv-story">Para acreditarse, confirmen aquí mismo su asistencia y cuéntennos si transmitirán en vivo. No hace falta crear una cuenta.</p>
<p class="inv-gate-jump"><a class="inv-yes" href="#confirmar">Confirmar asistencia</a></p>
</header>
<section class="inv-deadline" data-deadline data-deadline-at="${MEDIA_INAUGURATION_DEADLINE}" aria-labelledby="inv-media-deadline-title">
<p class="inv-deadline__label" id="inv-media-deadline-title" data-deadline-label>Confirma tu asistencia hasta el</p>
<p class="inv-deadline__date"><time datetime="${MEDIA_INAUGURATION_DEADLINE}">Miércoles 28 de octubre · 12:00</time></p>
<div class="inv-deadline__clock" data-deadline-clock role="timer" aria-label="Tiempo que queda para confirmar">
<span><b data-deadline-days>--</b><small>días</small></span><span><b data-deadline-hours>--</b><small>horas</small></span><span><b data-deadline-minutes>--</b><small>min</small></span><span><b data-deadline-seconds>--</b><small>seg</small></span>
</div>
<p class="inv-deadline__note" data-deadline-note>Con su confirmación armamos la lista de medios acreditados para la inauguración.</p>
</section>
${inaugurationEventCard}
<section class="inv-radar inv-radar--opening inv-media-rules" aria-labelledby="inv-media-rules-title">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Indicaciones para la cobertura</p>
<h2 id="inv-media-rules-title">Antes de venir</h2>
<ul>
<li><strong>Máximo 3 personas por medio</strong>, con su nombre y cargo (periodista, camarógrafo o fotógrafo).</li>
<li>Tengan a mano el <strong>WhatsApp de la persona responsable</strong> del medio ese día, para coordinar con ustedes.</li>
<li>Al llegar, <strong>registren su llegada con el código QR</strong> de la acreditación de medios.</li>
<li>Respeten las zonas de prensa, los horarios y las indicaciones del personal de la organización.</li>
</ul>
</section>
<section id="confirmar" class="inv-rsvp inv-rsvp--opening inv-gate inv-media-rsvp" aria-labelledby="inv-media-confirm-title">
<p class="inv-kicker"><span class="inv-eq" aria-hidden="true"><i></i><i></i><i></i></span>Acreditación</p>
<h2 id="inv-media-confirm-title">Confirma la asistencia de tu medio</h2>
<p class="inv-gate-help">Sin crear cuenta: busca tu medio, cuéntanos si transmitirán y envía. Toma menos de un minuto.</p>
<form class="inv-form" data-media-rsvp novalidate>
<fieldset disabled>
<div class="inv-media-search">
<label for="inv-media-search">Nombre de tu medio</label>
<input id="inv-media-search" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="inv-media-options" autocomplete="off" maxlength="140" placeholder="Escribe para buscar: radio, canal, página…" data-media-search>
<ul id="inv-media-options" class="inv-media-options" role="listbox" data-media-options hidden></ul>
<p class="inv-media-picked" data-media-picked hidden></p>
</div>
<div class="inv-media-new" data-media-new hidden>
<p>No está en la lista: lo registramos con este nombre.</p>
<label>Tipo de medio<select name="new_media_type" data-media-type><option value="">Elige el tipo</option>
<option value="radio">Radio</option>
<option value="tv">Televisión</option>
<option value="prensa">Prensa escrita</option>
<option value="digital">Medio digital</option>
<option value="redes">Redes sociales</option>
</select></label>
</div>
<fieldset class="inv-media-question">
<legend>¿Tu medio asistirá a la inauguración?</legend>
<label><input type="radio" name="answer" value="yes"> Sí, asistiremos</label>
<label><input type="radio" name="answer" value="no"> No podremos asistir</label>
</fieldset>
<div class="inv-media-yes" data-media-yes hidden>
<fieldset class="inv-media-question">
<legend>¿Transmitirán la inauguración en vivo?</legend>
<label><input type="radio" name="live_stream" value="yes"> Sí, transmitiremos en vivo</label>
<label><input type="radio" name="live_stream" value="recorded"> No en vivo: grabaremos para publicar después</label>
<label><input type="radio" name="live_stream" value="no"> No transmitiremos ni publicaremos</label>
</fieldset>
<fieldset class="inv-media-question inv-media-channels" data-media-channels hidden>
<legend>¿Dónde transmitirán? Marca cada plataforma, pega su enlace y escribe cuántos seguidores tiene.</legend>
<div class="inv-media-channel"><label><input type="checkbox" name="platform" value="facebook"> Facebook</label><input type="url" inputmode="url" maxlength="500" data-platform="facebook" aria-label="Enlace de Facebook" placeholder="https://… enlace de la página o el canal" hidden><input type="number" inputmode="numeric" min="0" max="1000000000" step="1" data-followers="facebook" aria-label="Seguidores de Facebook" placeholder="Cantidad de seguidores de esa página" hidden></div>
<div class="inv-media-channel"><label><input type="checkbox" name="platform" value="tiktok"> TikTok</label><input type="url" inputmode="url" maxlength="500" data-platform="tiktok" aria-label="Enlace de TikTok" placeholder="https://… enlace de la página o el canal" hidden><input type="number" inputmode="numeric" min="0" max="1000000000" step="1" data-followers="tiktok" aria-label="Seguidores de TikTok" placeholder="Cantidad de seguidores de esa página" hidden></div>
<div class="inv-media-channel"><label><input type="checkbox" name="platform" value="youtube"> YouTube</label><input type="url" inputmode="url" maxlength="500" data-platform="youtube" aria-label="Enlace de YouTube" placeholder="https://… enlace de la página o el canal" hidden><input type="number" inputmode="numeric" min="0" max="1000000000" step="1" data-followers="youtube" aria-label="Seguidores de YouTube" placeholder="Cantidad de seguidores de esa página" hidden></div>
<div class="inv-media-channel"><label><input type="checkbox" name="platform" value="instagram"> Instagram</label><input type="url" inputmode="url" maxlength="500" data-platform="instagram" aria-label="Enlace de Instagram" placeholder="https://… enlace de la página o el canal" hidden><input type="number" inputmode="numeric" min="0" max="1000000000" step="1" data-followers="instagram" aria-label="Seguidores de Instagram" placeholder="Cantidad de seguidores de esa página" hidden></div>
<div class="inv-media-channel"><label><input type="checkbox" name="platform" value="radio"> Radio FM</label><input type="url" inputmode="url" maxlength="500" data-platform="radio" aria-label="Enlace de Radio FM" placeholder="Enlace de su transmisión en línea (opcional)" hidden><input type="number" inputmode="numeric" min="0" max="1000000000" step="1" data-followers="radio" aria-label="Oyentes o audiencia de Radio FM" placeholder="Oyentes o audiencia aproximada" hidden></div>
<div class="inv-media-channel"><label><input type="checkbox" name="platform" value="tv"> TV abierta</label><input type="url" inputmode="url" maxlength="500" data-platform="tv" aria-label="Enlace de TV abierta" placeholder="Enlace de su transmisión en línea (opcional)" hidden><input type="number" inputmode="numeric" min="0" max="1000000000" step="1" data-followers="tv" aria-label="Oyentes o audiencia de TV abierta" placeholder="Oyentes o audiencia aproximada" hidden></div>
<div class="inv-media-channel"><label><input type="checkbox" name="platform" value="web"> Página web</label><input type="url" inputmode="url" maxlength="500" data-platform="web" aria-label="Enlace de Página web" placeholder="https://… enlace de la página o el canal" hidden><input type="number" inputmode="numeric" min="0" max="1000000000" step="1" data-followers="web" aria-label="Seguidores de Página web" placeholder="Cantidad de seguidores de esa página" hidden></div>
<div class="inv-media-channel"><label><input type="checkbox" name="platform" value="otro"> Otro</label><input type="url" inputmode="url" maxlength="500" data-platform="otro" aria-label="Enlace de Otro" placeholder="https://… enlace de la página o el canal" hidden><input type="number" inputmode="numeric" min="0" max="1000000000" step="1" data-followers="otro" aria-label="Seguidores de Otro" placeholder="Cantidad de seguidores de esa página" hidden></div>
<label class="inv-media-detail">Si es radio o TV: frecuencia o canal y programa<input name="live_detail" maxlength="300" placeholder="Ej.: 98.5 FM · Programa La Mañana"></label>
</fieldset>
<label>Persona responsable del medio ese día<input name="contact_name" maxlength="160" autocomplete="name" placeholder="Nombre y apellido"></label>
<label>WhatsApp de la persona responsable<input name="contact_phone" type="tel" inputmode="tel" maxlength="25" autocomplete="tel" placeholder="09…"></label>
<label class="inv-media-accept"><input type="checkbox" name="conditions"><span>Acepto las <a href="/finados/medios/buenas-practicas/" target="_blank" rel="noopener">condiciones de cobertura</a> y las indicaciones de la organización.</span></label>
</div>
<button type="submit" class="inv-yes">Enviar confirmación</button>
</fieldset>
<p class="inv-status" data-status role="status" aria-live="polite">Cargando la lista de medios…</p>
</form>
<div class="inv-gate-missing inv-media-done" data-media-done hidden>
<p data-media-done-text></p>
<div class="inv-media-pass" data-media-pass hidden>
<canvas data-media-pass-canvas width="1080" height="1350" aria-label="Código QR del medio confirmado"></canvas>
<a class="inv-yes" data-media-pass-download href="#" download="qr-medio.png">Descargar mi QR</a>
<p>Guárdalo en el celular o imprímelo: lo presentan en el ingreso de prensa el día del evento.</p>
</div>
<button type="button" class="inv-no" data-media-again>Confirmar otro medio</button>
</div>
<p class="inv-gate-links"><a href="/finados/medios/acceso/?modo=login">¿Tu medio ya tiene cuenta? También puedes confirmar desde ella</a></p>
</section>
${inaugurationSignature}`;
  return shell(page, { api: pageApi(page), body, kind: 'medios', eventKey: 'inauguracion' });
}
