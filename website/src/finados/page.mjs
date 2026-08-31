import { routeOptions, site, socialLinks } from '../data/site.mjs';
import { escapeHtml, externalAttributes } from '../render/html.mjs';

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
  return axes.map((axis) => `
    <article class="axis-panel group relative min-h-80 overflow-hidden border-t-2 border-night p-6 sm:p-8 lg:min-h-96 lg:border-l-2 lg:border-t-0" data-reveal>
      <span class="font-sans text-xs font-black tracking-mega text-night/60">${axis.number}</span>
      <img class="axis-icon absolute -bottom-8 -right-7 h-44 w-44 transition duration-200 ease-brand group-hover:-translate-y-2 sm:h-56 sm:w-56" src="/assets/finados/icons/${axis.key}.svg" alt="" width="224" height="224" loading="lazy">
      <div class="relative z-10 max-w-52 pt-24 lg:pt-36">
        <h3 class="font-display text-4xl uppercase leading-none text-night sm:text-5xl">${axis.title}</h3>
        <p class="mt-4 font-sans text-sm font-semibold leading-relaxed text-night/75">${axis.text}</p>
      </div>
    </article>`).join('');
}

function socialMarkup() {
  return socialLinks
    .filter((item) => item.label !== 'X')
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
  <link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml">
  <link rel="preload" as="image" href="/assets/finados/hero-artista-mock.webp" imagesrcset="/assets/finados/hero-artista-mock-960.webp 960w, /assets/finados/hero-artista-mock.webp 1600w" imagesizes="100vw" fetchpriority="high">
  <link rel="stylesheet" href="/assets/finados/finados.css">
  <script type="module" src="/assets/finados/finados.js"></script>
</head>
<body class="bg-lienzo font-sans text-night antialiased selection:bg-winay selection:text-night">
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  <div class="chumbi-line fixed inset-x-0 top-0 z-50 h-3" aria-hidden="true"></div>

  <header class="campaign-header fixed inset-x-0 top-3 z-40 transition-colors duration-200" data-header>
    <div class="mx-auto flex h-20 w-[min(100%-2rem,88rem)] items-center justify-between sm:h-24">
      <a href="#inicio" aria-label="Finados 2026, inicio">
        <img class="h-auto w-28 sm:w-36" src="/assets/finados/logo-finados.svg" width="184" height="108" alt="Finados 2026, legado que nos une">
      </a>
      <a class="button-outline-light" href="/">Volver al Complejo</a>
    </div>
  </header>

  <main id="contenido">
    <section id="inicio" class="hero-stage relative isolate flex min-h-[100svh] items-end overflow-hidden bg-night text-lienzo">
      <picture class="absolute inset-0 -z-30">
        <source media="(max-width: 700px)" srcset="/assets/finados/hero-artista-mock-960.webp">
        <img class="h-full w-full object-cover object-[68%_center] sm:object-center" src="/assets/finados/hero-artista-mock.webp" srcset="/assets/finados/hero-artista-mock-960.webp 960w, /assets/finados/hero-artista-mock.webp 1600w" sizes="100vw" width="1600" height="800" alt="Representación conceptual de una cantante ficticia frente a un público durante un concierto" fetchpriority="high">
      </picture>
      <div class="hero-scrim absolute inset-0 -z-20" aria-hidden="true"></div>
      <img class="absolute -bottom-24 -left-20 -z-10 h-72 w-72 opacity-90 sm:h-[30rem] sm:w-[30rem] lg:-bottom-44 lg:-left-32 lg:h-[42rem] lg:w-[42rem]" src="/assets/finados/icons/encuentro.svg" alt="" width="672" height="672">

      <div class="relative mx-auto grid w-[min(100%-2rem,88rem)] gap-10 pb-12 pt-40 sm:pb-16 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:pb-20">
        <div class="max-w-4xl">
          <p class="hero-enter inline-flex border-2 border-cyan bg-night/80 px-4 py-2 text-[0.64rem] font-black uppercase tracking-wide text-lienzo" data-hero-item>Visual conceptual · artista por anunciar</p>
          <h1 class="hero-enter mt-6 font-display text-[clamp(4.25rem,11vw,9.75rem)] uppercase leading-[0.82] tracking-[-0.025em] text-lienzo" data-hero-item>
            <span class="block">El legado</span>
            <span class="block text-fuchsia">vuelve a</span>
            <span class="block">encontrarnos</span>
          </h1>
          <div class="hero-enter mt-8 flex flex-wrap gap-3" data-hero-item>
            <a class="button-primary" href="#legado">Explorar el concepto <span aria-hidden="true">↓</span></a>
            <a class="button-ghost" href="${escapeHtml(route.href)}"${externalAttributes(route.href)}>Cómo llegar <span aria-hidden="true">↗</span></a>
          </div>
        </div>
        <blockquote class="hero-enter border-l-4 border-winay pl-6 font-serif text-3xl italic leading-[1.05] text-white sm:text-4xl lg:mb-2" data-hero-item>
          Mi primer gran concierto fue aquí
        </blockquote>
      </div>
    </section>

    <section id="legado" class="relative overflow-hidden bg-fuchsia py-24 text-night sm:py-32">
      <div class="mx-auto grid w-[min(100%-2rem,88rem)] gap-12 lg:grid-cols-[0.62fr_1.38fr] lg:items-start">
        <p class="kicker" data-reveal>Finados 2026</p>
        <div>
          <h2 class="max-w-5xl font-display text-[clamp(3.5rem,8vw,7.5rem)] uppercase leading-[0.86]" data-reveal>Una fiesta que se recuerda antes de empezar</h2>
          <p class="mt-10 max-w-2xl font-serif text-2xl italic leading-tight sm:text-4xl" data-reveal>La memoria, la música y el trabajo vuelven a encontrarse en un mismo territorio</p>
        </div>
      </div>
    </section>

    <section aria-labelledby="ejes-title" class="bg-lienzo text-night">
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

    <section class="bg-purple py-5 text-lienzo" aria-label="Mensaje principal">
      <div class="marquee" aria-hidden="true">
        <div class="marquee-track font-display text-4xl uppercase leading-none sm:text-6xl">
          <span>Legado que nos une</span><span>Memoria que se celebra</span><span>Legado que nos une</span><span>Memoria que se celebra</span>
        </div>
      </div>
      <p class="sr-only">Legado que nos une. Memoria que se celebra.</p>
    </section>

    <section class="bg-night py-24 text-lienzo sm:py-32">
      <div class="mx-auto grid w-[min(100%-2rem,88rem)] gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <figure class="poster-frame relative" data-reveal>
          <img class="aspect-[4/3] w-full object-cover object-[68%_center]" src="/assets/finados/hero-artista-mock.webp" width="1600" height="800" alt="Visual conceptual con una cantante ficticia en el escenario" loading="lazy">
          <figcaption class="absolute bottom-0 left-0 bg-cyan px-4 py-3 text-[0.65rem] font-black uppercase tracking-wide text-night">Imagen conceptual · no corresponde a una artista confirmada</figcaption>
        </figure>
        <div class="lg:pl-8">
          <p class="kicker text-cyan" data-reveal>Próxima revelación</p>
          <h2 class="mt-5 font-display text-[clamp(4rem,8vw,7.5rem)] uppercase leading-[0.84]" data-reveal>El escenario todavía guarda su nombre</h2>
          <p class="mt-8 max-w-lg font-sans text-lg leading-relaxed text-lienzo/75" data-reveal>Esta imagen abre la dirección artística de la campaña. La programación oficial se incorporará únicamente cuando cada anuncio cuente con autorización.</p>
        </div>
      </div>
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

    <section class="relative overflow-hidden bg-fuchsia py-24 text-night sm:py-32">
      <img class="absolute -bottom-28 -right-24 h-80 w-80 opacity-30 sm:h-[34rem] sm:w-[34rem]" src="/assets/finados/icons/legado.svg" alt="" width="544" height="544" loading="lazy">
      <div class="relative mx-auto w-[min(100%-2rem,88rem)]">
        <p class="kicker" data-reveal>La historia continúa</p>
        <h2 class="mt-5 max-w-6xl font-display text-[clamp(4rem,10vw,9rem)] uppercase leading-[0.83]" data-reveal>Lo próximo se contará por los canales oficiales</h2>
        <div class="mt-10 flex flex-wrap gap-3" data-reveal>${socialMarkup()}</div>
      </div>
    </section>
  </main>

  <footer class="bg-night px-4 py-12 text-lienzo">
    <div class="mx-auto flex w-[min(100%,88rem)] flex-col gap-8 border-t border-lienzo/30 pt-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <img class="h-auto w-36" src="/assets/finados/logo-finados.svg" width="184" height="108" alt="Finados 2026">
        <p class="mt-4 max-w-md text-sm leading-relaxed text-lienzo/60">Previsualización de campaña. Fechas, programación, artistas, precios y condiciones serán comunicados únicamente tras su aprobación oficial.</p>
      </div>
      <a class="footer-link" href="/">Volver a complejomushucruna.com <span aria-hidden="true">↗</span></a>
    </div>
  </footer>
</body>
</html>`;
}
