import { site } from '../data/site.mjs';
import { escapeHtml } from '../render/html.mjs';
import { renderFinadosFooter } from './footer.mjs';
import { renderFinadosNavigation } from './navigation.mjs';
import { showsProgram, plazaShows, showsAttractions } from './shows-program.mjs';
import { renderFinadosSponsors, sponsorAssetVersion } from './sponsors.mjs';
import { renderFairOpeningHeader, renderOpeningAssets } from './opening-header.mjs';

const version = '20260916-shows-2';
const asset = name => `/assets/finados/shows/${name}.webp?v=${version}`;

function renderProgram() {
  return showsProgram.map(show => `<article class="shows-date-row${show.featured ? ' shows-date-row--featured' : ''}">
    <time class="shows-date" datetime="${show.iso}"><span>${show.day}</span><strong>${show.date}</strong><span>${show.month}</span></time>
    <div class="shows-artists"><h3>${show.artists.map(escapeHtml).join('<span> · </span>')}</h3></div>
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
  <link rel="stylesheet" href="/assets/finados/navigation.css?v=20260918-navigation-progress-1">
  <link rel="stylesheet" href="/assets/finados/shows.css?v=20260917-shows-3">
  <link rel="stylesheet" href="/assets/finados/sponsors.css?v=${sponsorAssetVersion}">
  ${renderOpeningAssets()}
  <script type="module" src="/assets/finados/finados.js?v=20260918-navigation-progress-1"></script>
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
    ${renderFairOpeningHeader({ compact: true })}
    <section class="shows-hero" aria-labelledby="shows-title">
      <picture class="shows-hero-image">
        <source media="(max-width: 640px)" srcset="${asset('ambiente-concierto-800')}">
        <img src="${asset('ambiente-concierto-1600')}" width="1600" height="900" alt="Imagen conceptual de un grupo de amigos disfrutando de un concierto" fetchpriority="high" decoding="async">
      </picture>
      <div class="shows-hero-shade" aria-hidden="true"></div>
      <div class="shows-hero-copy">
        <p class="shows-kicker">Finados Mushuc Runa 2026</p>
        <h1 id="shows-title">SHOWS</h1>
        <p class="shows-hero-tagline">La música<br>que nos une.</p>
        <a class="shows-button" href="#shows">Ver el cartel <span aria-hidden="true">↓</span></a>
      </div>
      <p class="shows-hero-caption">Ambiente de concierto · Imagen conceptual</p>
      <div class="chumbi-line shows-hero-weave" aria-hidden="true"></div>
    </section>

    <section id="shows" class="shows-cartel" aria-labelledby="shows-cartel-title">
      <header class="shows-section-heading">
        <div><p class="shows-kicker">El escenario nos reúne</p><h2 id="shows-cartel-title">Un cartel.<br>Muchas emociones.</h2></div>
        <a class="shows-text-link" href="${asset('cartel-shows-2481')}" target="_blank" rel="noopener noreferrer">Ampliar cartel <span aria-hidden="true">↗</span><span class="sr-only"> (se abre en otra pestaña)</span></a>
      </header>
      <figure class="shows-poster">
        <a href="${asset('cartel-shows-2481')}" target="_blank" rel="noopener noreferrer" aria-label="Ampliar el cartel oficial de shows en otra pestaña">
          <img src="${asset('cartel-shows-1240')}" srcset="${asset('cartel-shows-1240')} 1240w, ${asset('cartel-shows-2481')} 2481w" sizes="(max-width: 1080px) calc(100vw - 32px), 1040px" width="2481" height="3300" alt="Cartel oficial de Finados Mushuc Runa 2026. Artistas, fechas, atractivos y código QR de información; programación en texto debajo." loading="lazy" decoding="async">
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
        <h3 id="shows-plaza-title" class="shows-plaza-brand"><img src="${asset('plaza-de-la-luna')}" width="170" height="165" alt="Plaza de la Luna" loading="lazy" decoding="async"></h3>
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
