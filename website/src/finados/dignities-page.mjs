import { site } from '../data/site.mjs';
import { escapeHtml } from '../render/html.mjs';
import { renderFinadosFooter } from './footer.mjs';
import { renderFinadosNavigation } from './navigation.mjs';

const campaignAssetVersion = '20260914-1';
const campaignRuntimeVersion = '20260915-1';

export function renderFinadosDignitiesPage(page) {
  const canonical = `${site.baseUrl}${page.route}`;

  return `<!doctype html>
<html lang="es" class="scroll-smooth bg-night">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dignidades Finados 2025 | Mushuc Runa</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="theme-color" content="#f58a0a">
  <link rel="icon" href="/assets/finados/favicon-finados.png" type="image/png" sizes="256x256">
  <link rel="apple-touch-icon" href="/assets/finados/favicon-finados.png">
  <link rel="stylesheet" href="/assets/styles.css?v=20260915-1">
  <link rel="stylesheet" href="/assets/finados/finados.css?v=${campaignRuntimeVersion}">
  <script type="module" src="/assets/finados/finados.js?v=${campaignRuntimeVersion}"></script>
</head>
<body class="dignities-page font-sans text-night antialiased selection:bg-winay selection:text-night">
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
    <section class="dignities-hero" aria-labelledby="dignities-title">
      <div class="dignities-hero-rays" aria-hidden="true"></div>
      <div class="dignities-hero-grid">
        <div class="dignities-hero-copy">
          <p class="dignities-kicker hero-enter" data-hero-item>Memoria de la 5.ª edición · 2025</p>
          <h1 id="dignities-title" class="dignities-title hero-enter" data-hero-item>
            <span>Dignidades</span>
            <span>Finados 2025</span>
          </h1>
          <p class="dignities-intro hero-enter" data-hero-item>Estos fueron los ganadores de los concursos Rey Pan y Señorita Colada Morada en Finados Mushuc Runa 2025.</p>
          <a class="dignities-hero-button hero-enter" href="#ganadores" data-hero-item>Conoce a los ganadores</a>
        </div>
        <div class="dignities-edition-mark hero-enter" data-hero-item aria-label="Quinta edición, año 2025">
          <strong>5<sup>ta</sup></strong>
          <span>Edición</span>
          <b>2025</b>
        </div>
      </div>
      <div class="dignities-weave" aria-hidden="true"></div>
    </section>

    <section id="ganadores" class="dignities-winners" aria-labelledby="winners-title">
      <header class="dignities-section-heading" data-reveal>
        <p class="dignities-kicker">Quienes llevaron la corona</p>
        <h2 id="winners-title">Ganadores de la edición 2025</h2>
      </header>

      <article class="dignity-winner dignity-winner--rey-pan">
        <figure class="dignity-poster" data-reveal>
          <img src="/assets/finados/dignidades-2025/euler-caicedo-rey-pan.webp?v=${campaignAssetVersion}" width="1080" height="1218" alt="Arte oficial de Euler Caicedo, ganador de Rey Pan en Finados Mushuc Runa 2025" loading="lazy">
          <figcaption>Rey Pan · Finados Mushuc Runa 2025</figcaption>
        </figure>
        <div class="dignity-copy" data-reveal>
          <p class="dignity-number">01 · Rey Pan</p>
          <h3>Euler<br>Caicedo</h3>
          <p>Euler Caicedo fue el ganador del concurso a Rey Pan de Finados Mushuc Runa 2025.</p>
        </div>
      </article>

      <article class="dignity-winner dignity-winner--colada">
        <figure class="dignity-poster" data-reveal>
          <img src="/assets/finados/dignidades-2025/tierra-canela-colada-morada.webp?v=${campaignAssetVersion}" width="1080" height="1218" alt="Arte oficial de Tierra Canela, ganadoras de Señorita Colada Morada en Finados Mushuc Runa 2025" loading="lazy">
          <figcaption>Señorita Colada Morada · Finados Mushuc Runa 2025</figcaption>
        </figure>
        <div class="dignity-copy" data-reveal>
          <p class="dignity-number">02 · Señorita Colada Morada</p>
          <h3>Tierra<br>Canela</h3>
          <p>Tierra Canela fue la agrupación ganadora del concurso a Señorita Colada Morada de Finados Mushuc Runa 2025.</p>
        </div>
      </article>
    </section>

    <section class="dignities-sponsors" aria-labelledby="sponsors-title">
      <div class="dignities-sponsors-heading" data-reveal>
        <p class="dignities-kicker">Gracias por ser parte</p>
        <h2 id="sponsors-title">Auspiciantes Finados 2025</h2>
      </div>
      <div class="dignities-sponsors-scroll" tabindex="0" role="region" aria-label="Logotipos de auspiciantes; desplázate horizontalmente para verlos todos" data-reveal>
        <img src="/assets/finados/dignidades-2025/auspiciantes-finados-2025.webp?v=${campaignAssetVersion}" width="1080" height="132" alt="Auspiciantes de Finados Mushuc Runa 2025 en categorías Diamante, Platino, Oro, Plata y Bronce" loading="lazy">
      </div>
    </section>
  </main>

  ${renderFinadosFooter()}
</body>
</html>`;
}
