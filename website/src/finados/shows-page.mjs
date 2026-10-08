import { site } from '../data/site.mjs';
import { escapeHtml } from '../render/html.mjs';
import { renderFinadosFooter } from './footer.mjs';
import { renderFinadosNavigation } from './navigation.mjs';
import { showsProgram, plazaShows, showsAttractions, showsTickets } from './shows-program.mjs';
import { renderFinadosSponsors, sponsorAssetVersion } from './sponsors.mjs';
import { renderFairOpeningHeader, renderOpeningAssets } from './opening-header.mjs';

const svgVersion = '20261007-shows-8';
const ticketsVersion = '20260928-entradas-1';
const ticketImage = (iso, width) => `/assets/finados/shows/entradas-${iso}-${width}.webp?v=${ticketsVersion}`;
const ticketFor = iso => showsTickets.find(ticket => ticket.iso === iso);
const svgAsset = name => `/assets/finados/shows/${name}.svg?v=${svgVersion}`;

function renderTicketSlider() {
  const slides = showsTickets.map((ticket, index) => `<li class="shows-slide" id="noche-${ticket.iso}" aria-roledescription="diapositiva" aria-label="${index + 1} de ${showsTickets.length}: ${escapeHtml(ticket.day)} ${ticket.date} ${ticket.month}">
      <a class="shows-slide-link" href="${escapeHtml(ticket.url)}" target="_blank" rel="noopener noreferrer">
        <img src="${ticketImage(ticket.iso, 1200)}" srcset="${ticketImage(ticket.iso, 600)} 600w, ${ticketImage(ticket.iso, 1200)} 1200w" sizes="(max-width: 1240px) 100vw, 1200px" width="1200" height="600" alt="${escapeHtml(ticket.alt)}"${index === 0 ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">
        <span class="shows-slide-bar"><time datetime="${ticket.iso}"><span>${ticket.day}</span> <strong>${ticket.date} ${ticket.month}</strong></time><span class="shows-slide-cta">Comprar entradas <span aria-hidden="true">→</span></span></span>
        <span class="sr-only"> (se abre Ticketstar en otra pestaña)</span>
      </a>
    </li>`).join('\n');
  const dots = showsTickets.map((ticket, index) => `<button type="button" class="shows-slider-dot" data-slide-dot="${index}" aria-label="Ver ${escapeHtml(ticket.day)} ${ticket.date} ${ticket.month}"${index === 0 ? ' aria-current="true"' : ''}><span>${ticket.date} ${ticket.month}</span></button>`).join('');
  return `<section id="entradas" class="shows-slider" aria-roledescription="carrusel" aria-labelledby="shows-title" data-shows-slider>
      <div class="shows-slider-inner">
        <header class="shows-slider-heading"><p class="shows-kicker">Venta oficial en Ticketstar</p><h1 id="shows-title">Shows · Elige tu noche</h1></header>
        <div class="shows-slider-frame">
          <ul class="shows-slider-track" data-slider-track>${slides}</ul>
          <button type="button" class="shows-slider-arrow shows-slider-arrow--prev" data-slider-prev aria-label="Noche anterior">←</button>
          <button type="button" class="shows-slider-arrow shows-slider-arrow--next" data-slider-next aria-label="Noche siguiente">→</button>
        </div>
        <div class="shows-slider-dots" role="group" aria-label="Elegir noche">${dots}</div>
      </div>
    </section>`;
}

function renderProgram() {
  return showsProgram.map(show => `<article class="shows-date-row${show.featured ? ' shows-date-row--featured' : ''}">
    <time class="shows-date" datetime="${show.iso}"><span>${show.day}</span><strong>${show.date}</strong><span>${show.month}</span></time>
    <div class="shows-artists"><h3>${show.artists.map(escapeHtml).join('<span> · </span>')}</h3></div>
    ${ticketFor(show.iso) ? `<a class="shows-row-ticket" href="${escapeHtml(ticketFor(show.iso).url)}" target="_blank" rel="noopener noreferrer">Comprar <span aria-hidden="true">→</span><span class="sr-only"> entradas del ${show.date} de ${show.month} en Ticketstar (se abre en otra pestaña)</span></a>` : ''}
  </article>`).join('\n');
}

export function renderFinadosShowsPage(page) {
  return `<!doctype html>
<html lang="es" class="scroll-smooth bg-night">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shows Finados 2026 | Mushuc Runa</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapeHtml(`${site.baseUrl}${page.route}`)}">
  <meta name="theme-color" content="#391f6f">
  <link rel="icon" href="/assets/finados/favicon-finados.png" type="image/png" sizes="256x256">
  <link rel="apple-touch-icon" href="/assets/finados/favicon-finados.png">
  <link rel="stylesheet" href="/assets/finados/finados.css?v=20260916-7">
  <link rel="stylesheet" href="/assets/finados/navigation.css?v=20260925-navigation-fluid-1">
  <link rel="stylesheet" href="/assets/finados/shows.css?v=${svgVersion}">
  <link rel="stylesheet" href="/assets/finados/sponsors.css?v=${sponsorAssetVersion}">
  ${renderOpeningAssets()}
  <script type="module" src="/assets/finados/finados.js?v=20260918-navigation-progress-1"></script>
  <script type="module" src="/assets/finados/shows-slider.js?v=${svgVersion}"></script>
</head>
<body class="shows-page font-sans text-night antialiased selection:bg-winay selection:text-night">
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  <div class="chumbi-line fixed inset-x-0 top-0 z-50 h-3" aria-hidden="true"></div>
  <header class="site-header site-header--finados campaign-header" data-header>
    <a class="brand finados-brand" href="/finados/" aria-label="Volver a Finados 2026">
      <img src="/assets/finados/logo-finados.svg?v=20260903" width="766" height="449" alt="Finados 2026, legado que nos une">
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="navegacion-principal"><span></span><span></span><span></span><span class="sr-only">Abrir menú</span></button>
    ${renderFinadosNavigation({ currentRoute: page.route })}
  </header>

  <main id="contenido">
    ${renderTicketSlider()}
    ${renderFairOpeningHeader({ compact: true })}

    <section id="shows" class="shows-cartel" aria-labelledby="shows-cartel-title">
      <header class="shows-section-heading">
        <div><p class="shows-kicker">El escenario nos reúne</p><h2 id="shows-cartel-title">Un cartel.<br>Muchas emociones.</h2></div>
        <a class="shows-text-link" href="${svgAsset('afiche-artistas-final')}" target="_blank" rel="noopener noreferrer">Ampliar cartel <span aria-hidden="true">↗</span><span class="sr-only"> (se abre en otra pestaña)</span></a>
      </header>
      <figure class="shows-poster">
        <a href="${svgAsset('afiche-artistas-final')}" target="_blank" rel="noopener noreferrer" aria-label="Ampliar el cartel oficial de shows en otra pestaña">
          <img src="${svgAsset('afiche-artistas-final')}" width="3509" height="4961" alt="Cartel oficial de Finados Mushuc Runa 2026. Artistas, fechas, atractivos y código QR de información; programación en texto debajo." loading="lazy" decoding="async">
        </a>
        <figcaption>Organiza: Luis Alfonso Chango P. · Complejo Intercultural y Deportivo Mushuc Runa.<br>Diseño oficial y orden de artistas conservados.</figcaption>
      </figure>
    </section>

    <section class="shows-program" aria-labelledby="shows-program-title">
      <header class="shows-section-heading">
        <div><p class="shows-kicker">Para cantar, bailar y compartir</p><h2 id="shows-program-title">Artistas y fechas</h2></div>
        <p class="shows-stage-note"><strong>Megaescenario</strong><span>Shows desde las <b>18:00</b></span></p>
      </header>
      <div class="shows-date-list">${renderProgram()}</div>
      <section class="shows-plaza" aria-labelledby="shows-plaza-title">
        <h3 id="shows-plaza-title" class="shows-plaza-brand"><img src="${svgAsset('logo-plaza-de-la-luna')}" width="165" height="240" alt="Plaza de la Luna" loading="lazy" decoding="async"></h3>
        <div class="shows-plaza-list">${plazaShows.map(show => `<article class="shows-plaza-show"><h4>${escapeHtml(show.artist)}</h4><time datetime="${show.iso}">${show.date}</time></article>`).join('')}</div>
      </section>
    </section>

    <section class="shows-experience" aria-labelledby="shows-experience-title">
      <div class="shows-experience-inner">
        <div><p class="shows-kicker">Y mucho más para vivir</p><h2 id="shows-experience-title">La feria<br>se disfruta.</h2></div>
        <ul>${showsAttractions.map(text => `<li>${escapeHtml(text)}</li>`).join('')}</ul>
        <p class="shows-colada"><strong>Más de 25.000</strong><span>vasos de colada morada<br>rumbo al récord</span></p>
      </div>
    </section>
  </main>
  ${renderFinadosFooter({ sponsors: renderFinadosSponsors() })}
</body>
</html>`;
}
