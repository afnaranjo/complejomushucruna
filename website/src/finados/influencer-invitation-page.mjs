import { escapeHtml as esc } from '../render/html.mjs';
import { apiBasesForCsp, LOCAL_API_BASE, PRIMARY_API_BASE } from './runtime-origins.mjs';

// Lo que se ve antes de que responda la API; el panel puede cambiarlo (sobre todo la hora).
export const influencerEventDefaults = Object.freeze({
  title: 'Lanzamiento Guaynaa',
  date: '2026-10-15',
  dateLabel: 'Jueves 15 de octubre de 2026',
  time: '18:00',
  place: 'Juan Montalvo y 12 de Noviembre, Ambato, Ecuador',
});
export const influencerInvitationVersion = '20261013-invitacion-3';

function shell(page, { api, body, kind }) {
  const connect = apiBasesForCsp(api);
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)} | Finados Mushuc Runa 2026</title>
<meta name="description" content="${esc(page.description)}">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src ${connect}; base-uri 'none'; form-action 'none'; object-src 'none'">
<meta name="invitation-api-base" content="${esc(api)}"><meta name="theme-color" content="#140d1f">
<link rel="canonical" href="https://complejomushucruna.com${esc(page.route)}">
<link rel="icon" href="/assets/finados/favicon-finados.png">
<link rel="preload" href="/assets/finados/guaynaa-lanzamiento-oficial-640.webp" as="image" media="(max-width: 700px)"><link rel="preload" href="/assets/finados/guaynaa-lanzamiento-oficial-1122.webp" as="image" media="(min-width: 701px)">
<link rel="stylesheet" href="/assets/finados/influencer-invitation.css?v=${influencerInvitationVersion}">
<script type="module" src="/assets/finados/influencer-invitation.js?v=${influencerInvitationVersion}"></script>
</head><body class="inv" data-invitation="${kind}">
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
<figure class="inv-poster"><img src="/assets/finados/guaynaa-lanzamiento-oficial-1122.webp" srcset="/assets/finados/guaynaa-lanzamiento-oficial-640.webp 640w, /assets/finados/guaynaa-lanzamiento-oficial-1122.webp 1122w" sizes="(max-width: 700px) calc(100vw - 32px), 34rem" width="1122" height="1402" alt="SanFra te trae a Guaynaa. 15 de octubre, 18:00, Finados Mushuc Runa." fetchpriority="high" decoding="async"></figure>
<p class="inv-eyebrow">Una invitación solo para ti</p>
<h1 class="inv-title"><span class="inv-name" data-guest-name>Hola</span><span>queremos que estés aquí.</span></h1>
<p class="inv-lead">Antes de que todo Ecuador lo sepa, queremos que tú lo vivas primero. <strong>SanFra</strong> y <strong>Finados Mushuc Runa</strong> te invitan al <strong>Lanzamiento Guaynaa</strong>.</p>
<p class="inv-story">Finados es tradición, es familia, es volver a casa. Y cada año esa tradición la cuentan voces como la tuya. Por eso no imaginamos este lanzamiento sin ti: tu manera de contar las cosas es parte de lo que Finados quiere ser.</p>
</header>
${radarAndPerks}
${eventCard}
<section class="inv-rsvp" aria-labelledby="inv-rsvp-title" data-rsvp>
<h2 id="inv-rsvp-title">¿Nos acompañas?</h2>
<p class="inv-status" data-status role="status" aria-live="polite">Cargando tu invitación…</p>
<div class="inv-choices" data-choices hidden>
<button type="button" class="inv-yes" data-answer="si">Sí, ahí estaré</button>
<button type="button" class="inv-no" data-answer="no">Esta vez no podré</button>
</div>
</section>`;
  return shell(page, { api: pageApi(page), body, kind: 'creador' });
}

/** «Nuevos creadores»: invitación abierta; la persona deja sus datos y confirma. */
export function renderInfluencerOpenPage(page) {
  const body = `<header class="inv-hero">
<figure class="inv-poster"><img src="/assets/finados/guaynaa-lanzamiento-oficial-1122.webp" srcset="/assets/finados/guaynaa-lanzamiento-oficial-640.webp 640w, /assets/finados/guaynaa-lanzamiento-oficial-1122.webp 1122w" sizes="(max-width: 700px) calc(100vw - 32px), 34rem" width="1122" height="1402" alt="SanFra te trae a Guaynaa. 15 de octubre, 18:00, Finados Mushuc Runa." fetchpriority="high" decoding="async"></figure>
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
<div class="inv-thanks" data-thanks hidden tabindex="-1"></div>
</section>`;
  return shell(page, { api: pageApi(page), body, kind: 'nuevo' });
}
