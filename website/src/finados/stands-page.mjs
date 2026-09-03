import { site } from '../data/site.mjs';
import { escapeHtml, externalAttributes } from '../render/html.mjs';

const purchaseUrl = 'https://mushucticket.com/';
const campaignAssetVersion = '20260903';

export function renderStandsAccessPage(page) {
  const canonical = `${site.baseUrl}${page.route}`;

  return `<!doctype html>
<html lang="es" class="scroll-smooth bg-night">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Acceso para compra de stands | Finados 2026</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="theme-color" content="#241146">
  <link rel="icon" href="/assets/finados/favicon-finados.png" type="image/png" sizes="256x256">
  <link rel="apple-touch-icon" href="/assets/finados/favicon-finados.png">
  <link rel="preload" as="image" href="/assets/finados/logo-finados.svg?v=${campaignAssetVersion}" fetchpriority="high">
  <link rel="stylesheet" href="/assets/finados/finados.css">
  <script type="module" src="/assets/finados/finados.js"></script>
</head>
<body class="stands-access-page bg-night font-sans text-lienzo antialiased selection:bg-winay selection:text-night">
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  <div class="chumbi-line fixed inset-x-0 top-0 z-50 h-3" aria-hidden="true"></div>

  <header class="stands-access-nav absolute inset-x-0 top-3 z-40">
    <div class="mx-auto flex h-20 w-[min(100%-2rem,88rem)] items-center justify-end sm:h-24">
      <a class="button-outline-light" href="/finados/">Volver a Finados</a>
    </div>
  </header>

  <main id="contenido">
    <section class="stands-access-hero relative isolate flex min-h-[100svh] items-center overflow-hidden px-4 pb-20 pt-32 text-center sm:pb-24 sm:pt-36">
      <div class="stands-access-backdrop absolute inset-0 -z-30" aria-hidden="true"></div>
      <img class="stands-access-spectator absolute -z-20" src="/assets/finados/icons/espectador.svg?v=${campaignAssetVersion}" alt="" width="1271" height="587" aria-hidden="true">

      <div class="stands-access-shell mx-auto w-[min(100%,74rem)]">
        <a class="stands-access-brand hero-enter mx-auto block" href="/finados/" aria-label="Finados 2026, volver a la landing" data-hero-item>
          <img class="mx-auto h-auto w-[min(17rem,72vw)] sm:w-80" src="/assets/finados/logo-finados.svg?v=${campaignAssetVersion}" width="766" height="449" alt="Mushuc Runa Finados 2026, legado que nos une">
        </a>
        <p class="hero-enter kicker mt-10 text-cyan" data-hero-item>Venta de stands · Finados 2026</p>
        <h1 class="stands-access-title hero-enter mx-auto mt-5 max-w-5xl font-display uppercase" data-hero-item>
          <span class="block text-lienzo">Acceso para</span>
          <span class="block text-fuchsia">compra de stands</span>
        </h1>
        <div class="stands-access-facts hero-enter mx-auto mt-10 grid max-w-5xl gap-3 text-left sm:grid-cols-2" data-hero-item>
          <article class="stands-access-fact stands-access-fact-date sm:col-span-2">
            <span>Apertura de venta de stands</span>
            <div class="stands-sale-date">
              <time datetime="2026-09-14T08:00:00-05:00">14 de septiembre</time>
              <strong class="stands-sale-time">08:00 <small>AM</small></strong>
            </div>
          </article>
          <article class="stands-access-fact stands-access-fact-online">
            <span>Modalidad</span>
            <strong>Venta 100% online</strong>
          </article>
          <article class="stands-access-fact stands-access-fact-count">
            <span>Disponibilidad</span>
            <strong>Más de 500 stands</strong>
          </article>
        </div>

        <div class="stands-countdown hero-enter mx-auto mt-10 max-w-5xl" data-hero-item data-stands-countdown data-target="2026-09-14T08:00:00-05:00">
          <div class="stands-countdown-grid" aria-hidden="true">
            <span class="stands-countdown-unit">
              <strong data-countdown-value="days">--</strong>
              <small>Días</small>
            </span>
            <span class="stands-countdown-unit">
              <strong data-countdown-value="hours">--</strong>
              <small>Horas</small>
            </span>
            <span class="stands-countdown-unit">
              <strong data-countdown-value="minutes">--</strong>
              <small>Minutos</small>
            </span>
            <span class="stands-countdown-unit">
              <strong data-countdown-value="seconds">--</strong>
              <small>Segundos</small>
            </span>
          </div>
          <span class="sr-only" aria-live="polite" data-countdown-status>La venta de stands inicia el 14 de septiembre.</span>
          <noscript><p>La venta de stands inicia el 14 de septiembre.</p></noscript>
        </div>

        <div class="hero-enter mt-10" data-hero-item>
          <a class="stands-purchase-button" href="${purchaseUrl}"${externalAttributes(purchaseUrl)}>Comprar mi stand <span aria-hidden="true">↗</span></a>
          <p class="mx-auto mt-5 max-w-2xl text-sm font-bold text-lienzo/65">Venta exclusivamente online a través del canal de compra.</p>
        </div>
      </div>
    </section>

    <section class="stands-requirements px-4 py-20 text-night sm:py-28" aria-labelledby="requisitos-title">
      <div class="stands-requirements-grid mx-auto w-[min(100%,80rem)]">
        <div class="stands-requirements-copy" data-reveal>
          <p class="kicker text-night">Antes de comprar</p>
          <h2 id="requisitos-title" class="stands-requirements-title mt-5 font-display uppercase">Ten lista tu información</h2>
          <p class="stands-requirements-lead mt-6 max-w-2xl font-sans text-lg font-bold leading-relaxed sm:text-xl">Compra tu stand con calma y enfócate en lo importante: tu producto, tu marca y tu feria.</p>

          <ol class="stands-requirements-list mt-9">
            <li class="stands-requirement-item">
              <span class="stands-requirement-number" aria-hidden="true">01</span>
              <strong>Correo electrónico</strong>
            </li>
            <li class="stands-requirement-item">
              <span class="stands-requirement-number" aria-hidden="true">02</span>
              <strong>Cédula de ciudadanía <span>PDF</span></strong>
            </li>
            <li class="stands-requirement-item">
              <span class="stands-requirement-number" aria-hidden="true">03</span>
              <strong>RUC habilitado <span>PDF</span></strong>
            </li>
            <li class="stands-requirement-item">
              <span class="stands-requirement-number" aria-hidden="true">04</span>
              <strong>Catálogo de productos <span>PDF</span></strong>
            </li>
          </ol>

          <aside class="stands-computer-note mt-8">
            <span aria-hidden="true">⌁</span>
            <p><strong>Te recomendamos utilizar un computador</strong> para completar tu compra con mayor comodidad.</p>
          </aside>
        </div>

        <div class="stands-requirements-visual" data-reveal>
          <div class="stands-requirements-stamp" aria-hidden="true">Todo listo<br>para empezar</div>
          <img src="/assets/finados/expositora-requisitos.webp?v=${campaignAssetVersion}" width="880" height="1320" loading="lazy" alt="Emprendedora preparando en su computador la información para comprar un stand">
        </div>
      </div>
    </section>

    <section class="stands-access-story bg-lienzo px-4 py-20 text-night sm:py-28">
      <div class="mx-auto grid w-[min(100%,74rem)] gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div data-reveal>
          <p class="kicker text-purple">Finados 2026</p>
          <h2 class="stands-story-title mt-5 max-w-3xl font-display uppercase">Sé parte de nuestra historia</h2>
          <p class="mt-7 max-w-2xl font-sans text-lg font-semibold leading-relaxed text-night/75 sm:text-xl">Más de 500 stands disponibles para que destaques tu marca y tu producto.</p>
        </div>
        <aside class="stands-story-card" data-reveal>
          <span>Acceso de compra</span>
          <strong>100% online</strong>
          <p>La venta de stands inicia el 14 de septiembre.</p>
          <a class="button-dark mt-7" href="${purchaseUrl}"${externalAttributes(purchaseUrl)}>Ir a comprar <span aria-hidden="true">↗</span></a>
        </aside>
      </div>
    </section>
  </main>

  <footer class="bg-night px-4 py-10 text-lienzo">
    <div class="mx-auto flex w-[min(100%,74rem)] flex-col gap-7 border-t border-lienzo/30 pt-8 sm:flex-row sm:items-end sm:justify-between">
      <img class="h-auto w-36" src="/assets/finados/logo-finados.svg?v=${campaignAssetVersion}" width="766" height="449" alt="Finados 2026">
      <a class="footer-link" href="/finados/">Volver a Finados <span aria-hidden="true">↗</span></a>
    </div>
  </footer>
</body>
</html>`;
}
