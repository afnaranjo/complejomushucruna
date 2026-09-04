import { routeOptions, site } from '../data/site.mjs';
import { escapeHtml, externalAttributes } from '../render/html.mjs';

const finadosSocialLinks = [
  { label: 'Facebook', href: 'https://www.facebook.com/FinadosMushucRunaEc' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@finadosmushucruna' },
  { label: 'Instagram', href: 'https://www.instagram.com/finadosmushucruna/' },
];

const purchaseUrl = 'https://mushucticket.com/';
const campaignAssetVersion = '20260903';
const campaignRuntimeVersion = '20260903-2';

const axes = [
  {
    key: 'legado',
    number: '01',
    title: 'Legado',
    text: 'Lo que heredamos y volvemos a contar.',
  },
  {
    key: 'encuentro',
    number: '02',
    title: 'Encuentro',
    text: 'La música, la mesa y la emoción compartida.',
  },
  {
    key: 'crecimiento',
    number: '03',
    title: 'Crecimiento',
    text: 'La primera venta y el impulso de seguir adelante.',
  },
  {
    key: 'espectador',
    number: '04',
    title: 'Espectador',
    text: 'Lo que miramos juntos y no se olvida.',
  },
];

function axisMarkup() {
  return axes.map((axis) => {
    const iconSize = axis.key === 'espectador'
      ? 'h-auto w-64 sm:w-72'
      : 'h-auto w-44 sm:w-56';

    return `
    <article class="axis-panel group relative min-h-80 overflow-hidden border-t-2 border-night p-6 sm:p-8 lg:min-h-96 lg:border-l-2 lg:border-t-0" data-reveal>
      <span class="font-sans text-xs font-black tracking-mega text-night/60">${axis.number}</span>
      <img class="axis-icon axis-icon-${axis.key} absolute -bottom-8 -right-7 ${iconSize} transition duration-200 ease-brand group-hover:-translate-y-2" src="/assets/finados/icons/${axis.key}.svg?v=${campaignAssetVersion}" alt="" loading="lazy">
      <div class="relative z-10 max-w-52 pt-24 lg:pt-36">
        <h3 class="font-display text-4xl uppercase leading-none text-night sm:text-5xl">${axis.title}</h3>
        <p class="mt-4 font-sans text-sm font-semibold leading-relaxed text-night/75">${axis.text}</p>
      </div>
    </article>`;
  }).join('');
}

function socialMarkup() {
  return finadosSocialLinks
    .map((item) => `<a class="footer-link" href="${escapeHtml(item.href)}"${externalAttributes(item.href)}>${escapeHtml(item.label)} <span aria-hidden="true">↗</span></a>`)
    .join('');
}

export function renderFinadosPage(page) {
  const canonical = `${site.baseUrl}${page.route}`;
  const route = routeOptions[0];

  return `<!doctype html>
<html lang="es" class="scroll-smooth bg-night">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Finados 2026 | Mushuc Runa</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="theme-color" content="#391F6F">
  <link rel="icon" href="/assets/finados/favicon-finados.png" type="image/png" sizes="256x256">
  <link rel="apple-touch-icon" href="/assets/finados/favicon-finados.png">
  <link rel="preload" as="image" href="/assets/finados/expositor-artesanias.webp" fetchpriority="high">
  <link rel="stylesheet" href="/assets/finados/finados.css?v=${campaignRuntimeVersion}">
  <script type="module" src="/assets/finados/finados.js?v=${campaignRuntimeVersion}"></script>
</head>
<body class="bg-lienzo font-sans text-night antialiased selection:bg-winay selection:text-night">
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  <div class="chumbi-line fixed inset-x-0 top-0 z-50 h-3" aria-hidden="true"></div>

  <header class="campaign-header fixed inset-x-0 top-3 z-40 transition-colors duration-200" data-header>
    <div class="mx-auto flex h-20 w-[min(100%-2rem,88rem)] items-center justify-between sm:h-24">
      <a href="#inicio" aria-label="Finados 2026, inicio">
        <img class="h-auto w-28 sm:w-36" src="/assets/finados/logo-finados.svg?v=${campaignAssetVersion}" width="766" height="449" alt="Finados 2026, legado que nos une">
      </a>
      <a class="button-outline-light" href="/">Volver al Complejo</a>
    </div>
  </header>

  <main id="contenido">
    <section id="inicio" class="hero-stage hero-stands relative isolate min-h-[100svh] overflow-hidden bg-night text-lienzo">
      <div class="hero-stands-backdrop absolute inset-0 -z-30" aria-hidden="true"></div>
      <img class="hero-paloma" src="/assets/finados/icons/paloma.svg" alt="" width="480" height="340" aria-hidden="true">

      <div class="hero-stands-grid relative mx-auto grid min-h-[100svh] w-[min(100%-2rem,88rem)] gap-4 pt-36 lg:grid-cols-[minmax(0,1.06fr)_minmax(28rem,0.94fr)] lg:items-end lg:pt-32">
        <div class="hero-stands-copy z-10 pb-12 sm:pb-16 lg:pb-16">
          <p class="hero-enter inline-flex border-2 border-cyan bg-night/80 px-4 py-2 text-[0.64rem] font-black uppercase tracking-wide text-lienzo" data-hero-item>Finados 2026 · Venta de stands</p>
          <h1 class="hero-enter mt-5 font-display text-[clamp(4.1rem,8.7vw,8.5rem)] uppercase leading-[0.82] tracking-[-0.025em] text-lienzo" data-hero-item>
            <span class="block">Haz crecer</span>
            <span class="block text-fuchsia">tu negocio</span>
            <span class="block">en Finados</span>
          </h1>
          <p class="hero-enter mt-6 max-w-xl font-serif text-xl italic leading-tight text-lienzo/90 sm:text-2xl" data-hero-item>Tu talento, tus productos y tu historia también hacen parte de esta tradición.</p>

          <div class="hero-enter hero-offer-grid mt-7" data-hero-item>
            <div class="hero-date-card">
              <span>Fecha de venta</span>
              <time datetime="2026-09-14">14 de septiembre</time>
            </div>
            <div class="hero-online-card" aria-label="Venta online">
              <span>Venta</span>
              <strong>Online</strong>
              <a class="hero-online-action" href="${purchaseUrl}"${externalAttributes(purchaseUrl)}>Reservar mi stand <span aria-hidden="true">↗</span></a>
            </div>
          </div>
        </div>

        <figure class="hero-enter hero-expositor relative self-end" data-hero-item>
          <img src="/assets/finados/expositor-artesanias.webp" width="743" height="1405" alt="Expositor de artesanías sosteniendo productos de madera" fetchpriority="high">
          <figcaption>Participa como dueño de tu stand</figcaption>
        </figure>
      </div>
    </section>

    <section id="artistas" class="artist-section bg-night py-24 text-lienzo sm:py-32" aria-labelledby="guaynaa-title">
      <div class="mx-auto grid w-[min(100%-2rem,88rem)] gap-10 lg:grid-cols-[1.28fr_0.72fr] lg:items-center">
        <figure class="artist-poster artist-poster-dark" data-reveal>
          <picture>
            <source media="(max-width: 700px)" srcset="/assets/finados/guaynaa-finados-960.webp">
            <img src="/assets/finados/guaynaa-finados.webp" srcset="/assets/finados/guaynaa-finados-960.webp 960w, /assets/finados/guaynaa-finados.webp 1440w" sizes="(max-width: 1023px) calc(100vw - 2rem), 62vw" width="1440" height="720" alt="Arte oficial de Guaynaa para el Megaescenario de Finados 2026" loading="lazy">
          </picture>
          <figcaption>Guaynaa · Domingo 1 de noviembre</figcaption>
        </figure>
        <div class="artist-copy lg:pl-6">
          <p class="kicker text-cyan" data-reveal>Próxima revelación</p>
          <h2 id="guaynaa-title" class="artist-title mt-5 font-display uppercase" data-reveal>Guaynaa enciende el Megaescenario</h2>
          <p class="mt-7 max-w-lg font-sans text-lg leading-relaxed text-lienzo/75" data-reveal>Ritmo urbano, energía y una noche para cantar y bailar juntos en Finados 2026.</p>
          <p class="artist-date artist-date-dark mt-8" data-reveal><span>Domingo</span><time datetime="2026-11-01">1 de noviembre</time></p>
        </div>
      </div>
    </section>

    <section id="kjarkas" class="artist-section bg-lienzo py-24 text-night sm:py-32" aria-labelledby="kjarkas-title">
      <div class="mx-auto grid w-[min(100%-2rem,88rem)] gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
        <div class="artist-copy lg:pr-6">
          <p class="kicker text-purple" data-reveal>Música folclórica</p>
          <h2 id="kjarkas-title" class="artist-title mt-5 font-display uppercase" data-reveal>Los Kjarkas: la raíz que nos une</h2>
          <p class="mt-7 max-w-lg font-sans text-lg leading-relaxed text-night/75" data-reveal>Una noche de memoria, identidad andina y canciones que atraviesan generaciones.</p>
          <p class="artist-date mt-8" data-reveal><span>Sábado</span><time datetime="2026-10-31">31 de octubre</time></p>
        </div>
        <figure class="artist-poster artist-poster-light" data-reveal>
          <picture>
            <source media="(max-width: 700px)" srcset="/assets/finados/kjarkas-finados-960.webp">
            <img src="/assets/finados/kjarkas-finados.webp" srcset="/assets/finados/kjarkas-finados-960.webp 960w, /assets/finados/kjarkas-finados.webp 1440w" sizes="(max-width: 1023px) calc(100vw - 2rem), 62vw" width="1440" height="721" alt="Arte oficial de Los Kjarkas para el Megaescenario de Finados 2026" loading="lazy">
          </picture>
          <figcaption>Los Kjarkas · Sábado 31 de octubre</figcaption>
        </figure>
      </div>
    </section>

    <section id="william-luna" class="artist-section bg-night py-24 text-lienzo sm:py-32" aria-labelledby="william-luna-title">
      <div class="mx-auto grid w-[min(100%-2rem,88rem)] gap-10 lg:grid-cols-[1.28fr_0.72fr] lg:items-center">
        <figure class="artist-poster artist-poster-dark" data-reveal>
          <img src="/assets/finados/william-luna.svg?v=20260904" width="1600" height="801" alt="Arte oficial de William Luna para Finados Mushuc Runa 2026" loading="lazy">
          <figcaption>William Luna · Finados Mushuc Runa 2026</figcaption>
        </figure>
        <div class="artist-copy lg:pl-6">
          <p class="kicker text-cyan" data-reveal>40 años de vida artística</p>
          <h2 id="william-luna-title" class="artist-title mt-5 font-display uppercase" data-reveal>William Luna celebra cuatro décadas en Finados</h2>
          <p class="mt-7 max-w-lg font-sans text-lg leading-relaxed text-lienzo/75" data-reveal>El cantautor celebrará sus 40 años de vida artística en Finados Mushuc Runa 2026.</p>
        </div>
      </div>
    </section>

    <section id="las-nanas" class="artist-section bg-lienzo py-24 text-night sm:py-32" aria-labelledby="las-nanas-title">
      <div class="mx-auto grid w-[min(100%-2rem,88rem)] gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
        <div class="artist-copy lg:pr-6">
          <p class="kicker text-purple" data-reveal>Música nacional ecuatoriana</p>
          <h2 id="las-nanas-title" class="artist-title mt-5 font-display uppercase" data-reveal>Las Ñañas: el grupo sensación</h2>
          <p class="mt-7 max-w-lg font-sans text-lg leading-relaxed text-night/75" data-reveal>Las Ñañas son el grupo sensación de la actualidad de la música nacional ecuatoriana y llegan a Finados Mushuc Runa 2026 con una propuesta fresca y cercana.</p>
        </div>
        <figure class="artist-poster artist-poster-light" data-reveal>
          <img src="/assets/finados/las-nanas.svg?v=20260904" width="1600" height="801" alt="Arte oficial de Las Ñañas para Finados Mushuc Runa 2026" loading="lazy">
          <figcaption>Las Ñañas · Finados Mushuc Runa 2026</figcaption>
        </figure>
      </div>
    </section>

    <section class="bg-purple py-5 text-lienzo" aria-label="Mensaje principal">
      <div class="marquee" aria-hidden="true">
        <div class="marquee-track font-display text-4xl uppercase leading-none sm:text-6xl">
          <span>Legado que nos une</span><span>Memoria que se celebra</span><span>Legado que nos une</span><span>Memoria que se celebra</span>
        </div>
      </div>
      <p class="sr-only">Legado que nos une. Memoria que se celebra.</p>
    </section>

    <section class="bg-white py-24 text-night sm:py-32">
      <div class="mx-auto grid w-[min(100%-2rem,88rem)] gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-stretch">
        <div class="flex flex-col justify-between border-2 border-night bg-winay p-7 shadow-hard sm:p-10" data-reveal>
          <div>
            <p class="kicker">El territorio</p>
            <h2 class="mt-5 font-display text-5xl uppercase leading-[0.9] sm:text-7xl">Aquí vuelven a nacer las historias</h2>
          </div>
          <div class="mt-16 border-t-2 border-night pt-6">
            <p class="font-sans text-lg font-black">Complejo Mushuc Runa</p>
            <p class="mt-1 font-sans text-sm font-semibold text-night/70">Santa Lucía · Tisaleo · Tungurahua</p>
            <a class="button-dark mt-7" href="${escapeHtml(route.href)}"${externalAttributes(route.href)}>Abrir ubicación <span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <figure class="relative min-h-96 overflow-hidden border-2 border-night" data-reveal>
          <img class="absolute inset-0 h-full w-full object-cover" src="/assets/images/actual/megaescenario.webp" width="1200" height="800" alt="Megaescenario del Complejo Mushuc Runa durante un espectáculo nocturno" loading="lazy">
          <figcaption class="absolute bottom-0 right-0 bg-night px-5 py-3 text-[0.65rem] font-black uppercase tracking-wide text-lienzo">Imagen del Complejo</figcaption>
        </figure>
      </div>
    </section>

    <section id="canales" class="relative overflow-hidden bg-fuchsia py-24 text-night sm:py-32">
      <img class="absolute -bottom-28 -right-24 h-80 w-80 object-contain opacity-30 sm:h-[34rem] sm:w-[34rem]" src="/assets/finados/icons/legado.svg?v=${campaignAssetVersion}" alt="" loading="lazy">
      <div class="relative mx-auto w-[min(100%-2rem,88rem)]">
        <p class="kicker" data-reveal>La historia continúa</p>
        <h2 class="channels-title mt-5 max-w-6xl font-display text-[clamp(4rem,10vw,9rem)] uppercase" data-reveal>Lo próximo se contará por los canales oficiales</h2>
        <div class="mt-10 flex flex-wrap gap-3" data-reveal>${socialMarkup()}</div>
      </div>
    </section>

    <section id="legado" aria-labelledby="ejes-title" class="bg-lienzo text-night">
      <div class="mx-auto w-[min(100%-2rem,88rem)] py-20 sm:py-28">
        <div class="grid gap-6 border-b-2 border-night pb-8 sm:grid-cols-2 sm:items-end">
          <div>
            <p class="kicker text-purple" data-reveal>La esencia</p>
            <h2 id="ejes-title" class="mt-4 font-display text-5xl uppercase leading-none sm:text-7xl" data-reveal>Cuatro formas de volver</h2>
          </div>
          <p class="max-w-xl font-sans text-base font-medium leading-relaxed text-night/70 sm:justify-self-end sm:text-lg" data-reveal>Una identidad construida desde la memoria alegre: aquello que permanece, aquello que reúne y aquello que impulsa nuevas historias.</p>
        </div>
        <div class="grid lg:grid-cols-4">${axisMarkup()}
        </div>
      </div>
    </section>
  </main>

  <footer class="bg-night px-4 py-12 text-lienzo">
    <div class="mx-auto flex w-[min(100%,88rem)] flex-col gap-8 border-t border-lienzo/30 pt-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <img class="h-auto w-36" src="/assets/finados/logo-finados.svg?v=${campaignAssetVersion}" width="766" height="449" alt="Finados 2026">
        <p class="mt-4 max-w-md text-sm leading-relaxed text-lienzo/60">Información de Finados 2026. Consulta condiciones, disponibilidad y novedades por los canales oficiales.</p>
      </div>
      <a class="footer-link" href="/">Volver a complejomushucruna.com <span aria-hidden="true">↗</span></a>
    </div>
  </footer>
</body>
</html>`;
}
