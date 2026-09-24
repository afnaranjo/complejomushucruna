import { site, routeOptions } from '../data/site.mjs';
import { escapeHtml } from '../render/html.mjs';
import { renderFinadosFooter } from './footer.mjs';
import { renderFinadosNavigation } from './navigation.mjs';

// Mushuc Freestyle 2026: su propia línea gráfica (azul, lima y crema, Badeen Display)
// dentro del marco de Finados. Los datos salen de la especificación aprobada del módulo.
export const mfsAssetVersion = '20260924-mfs-2';
const asset = name => `/assets/finados/mfs/${name}?v=${mfsAssetVersion}`;

export const mfsEvent = Object.freeze({
  date: 'Lunes 2 de noviembre',
  dateIso: '2026-11-02T13:00:00-05:00',
  time: '13:00',
  place: 'Plaza de la Luna',
  venue: 'Complejo Mushuc Runa · Tisaleo, Tungurahua',
  closing: 'Jueves 29 de octubre, 23:59',
  closingIso: '2026-10-29T23:59:00-05:00',
  slots: 32,
  sponsorPhone: '+593 98 034 6729',
  sponsorWhatsapp: 'https://wa.me/593980346729',
});

export const mfsPrizes = Object.freeze([
  { place: '1er lugar', amount: 600 },
  { place: '2do lugar', amount: 250 },
  { place: '3er lugar', amount: 100 },
]);

const steps = [
  ['Graba tu audición', 'Preséntate con tu nombre artístico, suelta tus barras y anuncia en el video que la final será en Finados Mushuc Runa 2026.'],
  ['Súbela a TikTok', 'Publica el video en tu cuenta de TikTok con acceso público y copia el enlace.'],
  ['Inscríbete aquí', 'Crea tu cuenta, inicia sesión, completa tus datos, sube una foto tipo retrato y pega el enlace de tu audición.'],
  ['Espera la revisión', `Coordinación revisa cada audición y confirma a quienes ocupan los ${mfsEvent.slots} cupos de la competencia.`],
];

const rules = [
  'La inscripción es gratuita.',
  `Hay ${mfsEvent.slots} cupos para la competencia.`,
  'Cada participante se identifica con su cédula de ciudadanía.',
  'La audición es un único video público en TikTok; una vez enviada no se reemplaza desde tu cuenta.',
  `Las inscripciones cierran el ${mfsEvent.closing.toLowerCase()}.`,
  `La final es el ${mfsEvent.date.toLowerCase()} a las ${mfsEvent.time}, en la ${mfsEvent.place}.`,
  'Los premios son personales e intransferibles, se entregan con cédula y acta firmada, y se pagan dentro de 15 días hábiles.',
];

const tickerWords = ['Inscripción gratuita', 'Premio económico', `${mfsEvent.slots} cupos`, 'Plaza de la Luna', '2da edición'];

function renderTicker() {
  const run = tickerWords.map(word => `<span>${escapeHtml(word)}</span><img src="${asset('mfs-icono.svg')}" width="24" height="24" alt="">`).join('');
  return `<div class="mfs-ticker" aria-hidden="true"><div class="mfs-ticker-track">${run}${run}</div></div>`;
}

export function renderMfsPage(page) {
  const mainRoute = routeOptions[0]?.href ?? '';
  return `<!doctype html>
<html lang="es" class="scroll-smooth">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mushuc Freestyle 2026 · 2da edición | Finados Mushuc Runa</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapeHtml(`${site.baseUrl}${page.route}`)}">
  <meta name="theme-color" content="#173976">
  <link rel="icon" href="${asset('mfs-icono.svg')}" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/assets/finados/favicon-finados.png">
  <link rel="preload" href="/assets/finados/mfs/fonts/badeen-display-latin.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/assets/finados/finados.css?v=20260916-7">
  <link rel="stylesheet" href="/assets/finados/navigation.css?v=20260918-navigation-progress-1">
  <link rel="stylesheet" href="/assets/finados/mfs.css?v=${mfsAssetVersion}">
  <script type="module" src="/assets/finados/finados.js?v=20260918-navigation-progress-1"></script>
</head>
<body class="mfs-page font-sans antialiased">
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
    <section class="mfs-hero" aria-labelledby="mfs-title">
      <picture class="mfs-hero-portrait">
        <source media="(max-width: 720px)" srcset="${asset('mfs-retrato-640.webp')}">
        <img src="${asset('mfs-retrato-1100.webp')}" width="1100" height="1787" alt="Ilustración en semitono de un MC con gorra, lentes y una grabadora al hombro" fetchpriority="high" decoding="async">
      </picture>
      <p class="mfs-edition" aria-hidden="true"><b>2</b><sup>da</sup> edición</p>
      <div class="mfs-hero-copy">
        <h1 id="mfs-title" class="mfs-lockup">
          <img src="${asset('mfs-logo.svg')}" width="1686" height="469" alt="Mushuc Freestyle">
          <span class="sr-only"> 2026 · 2da edición</span>
        </h1>
        <p class="mfs-regresa">Regresa</p>
        <div class="mfs-hero-panel">
        <dl class="mfs-facts">
          <div><dt>Final</dt><dd><time datetime="${mfsEvent.dateIso}">${mfsEvent.date} · ${mfsEvent.time}</time></dd></div>
          <div><dt>Dónde</dt><dd>${mfsEvent.place}<small>${mfsEvent.venue}</small></dd></div>
        </dl>
        <div class="mfs-actions">
          <a class="mfs-button" href="/finados/mfs/acceso/">Inscríbete gratis <span aria-hidden="true">→</span></a>
          <a class="mfs-button mfs-button--ghost" href="#bases">Ver las bases</a>
        </div>
        <p class="mfs-closing">Inscripciones hasta el <time datetime="${mfsEvent.closingIso}">${mfsEvent.closing.toLowerCase()}</time>.</p>
        </div>
      </div>
    </section>

    ${renderTicker()}

    <section class="mfs-editorial" aria-labelledby="mfs-plaza-title">
      <div class="mfs-wrap mfs-editorial-grid">
        <div>
          <p class="mfs-kicker">Finados Mushuc Runa 2026</p>
          <h2 id="mfs-plaza-title">La plaza vuelve a llenarse</h2>
        </div>
        <div class="mfs-editorial-copy">
          <p>Mushuc Freestyle regresa en su segunda edición a la Plaza de la Luna. Rimas, beats y la barra del público, en medio de la feria más grande de Finados.</p>
          <p>Si improvisas, esta es tu tarima: inscríbete gratis, envía tu audición y gánate uno de los ${mfsEvent.slots} cupos.</p>
          <img class="mfs-plaza-logo" src="${asset('mfs-plaza.svg')}" width="472" height="456" alt="Plaza de la Luna" loading="lazy" decoding="async">
        </div>
      </div>
    </section>

    <section class="mfs-prizes" aria-labelledby="mfs-prizes-title">
      <div class="mfs-wrap">
        <p class="mfs-kicker">Premio económico</p>
        <h2 id="mfs-prizes-title">Más de USD 950<br>en premios</h2>
        <ol class="mfs-prize-list">
          ${mfsPrizes.map((prize, index) => `<li class="mfs-prize mfs-prize--${index + 1}"><span>${prize.place}</span><strong><small>$</small>${prize.amount}</strong></li>`).join('\n          ')}
        </ol>
        <ul class="mfs-extras">
          <li>Medallas</li><li>Reconocimientos</li><li>Trofeos</li>
        </ul>
        <p class="mfs-special"><img src="${asset('mfs-icono.svg')}" width="48" height="48" alt=""> <span><strong>Reconocimiento especial</strong> al mejor MC de la zona centro.</span></p>
        <p class="mfs-fineprint">Los premios son personales e intransferibles. Se entregan con cédula y acta firmada, y se pagan dentro de 15 días hábiles.</p>
      </div>
    </section>

    <section id="inscripcion" class="mfs-signup" aria-labelledby="mfs-signup-title">
      <div class="mfs-wrap">
        <p class="mfs-kicker">Inscripción gratuita</p>
        <h2 id="mfs-signup-title">Cómo inscribirte</h2>
        <ol class="mfs-steps">
          ${steps.map(([title, text], index) => `<li><b>${String(index + 1).padStart(2, '0')}</b><h3>${escapeHtml(title)}</h3><p>${escapeHtml(text)}</p></li>`).join('\n          ')}
        </ol>
        <div class="mfs-signup-status">
          <p><strong>La inscripción ya está abierta.</strong> Tienes hasta el ${mfsEvent.closing.toLowerCase()}.</p>
          <div class="mfs-actions">
            <a class="mfs-button mfs-button--dark" href="/finados/mfs/acceso/">Crear mi cuenta <span aria-hidden="true">→</span></a>
            <a class="mfs-button mfs-button--dark-ghost" href="/finados/mfs/acceso/?modo=login">Ya tengo cuenta</a>
          </div>
        </div>
      </div>
    </section>

    <section id="bases" class="mfs-rules" aria-labelledby="mfs-rules-title">
      <div class="mfs-wrap mfs-rules-grid">
        <div>
          <p class="mfs-kicker">Lo que tienes que saber</p>
          <h2 id="mfs-rules-title">Bases resumidas</h2>
        </div>
        <div>
          <ul class="mfs-rule-list">
            ${rules.map(rule => `<li>${escapeHtml(rule)}</li>`).join('\n            ')}
          </ul>
          <p class="mfs-rules-links"><a href="/finados/mfs/bases/">Leer las bases completas</a> · <a href="/finados/mfs/politica-de-privacidad/">Política de Privacidad</a></p>
        </div>
      </div>
    </section>

    <section class="mfs-visit" aria-labelledby="mfs-visit-title">
      <div class="mfs-wrap mfs-visit-grid">
        <div>
          <p class="mfs-kicker">Cómo llegar</p>
          <h2 id="mfs-visit-title">Te esperamos en la plaza</h2>
          <p>${mfsEvent.place} · ${mfsEvent.venue}. La competencia se vive dentro de la feria: ingresa con la entrada general de Finados y usa los parqueaderos del Complejo.</p>
          ${mainRoute ? `<a class="mfs-button" href="${escapeHtml(mainRoute)}" target="_blank" rel="noopener noreferrer">Abrir en Maps <span aria-hidden="true">↗</span><span class="sr-only"> (se abre en otra pestaña)</span></a>` : ''}
        </div>
        <div class="mfs-sponsor">
          <h3>¿Tu marca en la tarima?</h3>
          <p>Súmate como auspiciante de Mushuc Freestyle 2026.</p>
          <a class="mfs-button mfs-button--ghost" href="${mfsEvent.sponsorWhatsapp}" target="_blank" rel="noopener noreferrer">Escríbenos al ${mfsEvent.sponsorPhone}<span class="sr-only"> por WhatsApp (se abre en otra pestaña)</span></a>
        </div>
      </div>
    </section>

    <section class="mfs-art" aria-labelledby="mfs-art-title">
      <div class="mfs-wrap mfs-art-grid">
        <div>
          <p class="mfs-kicker">Organiza</p>
          <h2 id="mfs-art-title" class="sr-only">Organizadores y arte oficial</h2>
          <img class="mfs-organizers" src="${asset('mfs-organizadores.svg')}" width="970" height="248" alt="Organiza: Luis Alfonso Chango P. y el Complejo Intercultural y Deportivo Mushuc Runa" loading="lazy" decoding="async">
        </div>
        <figure class="mfs-poster">
          <a href="${asset('mfs-arte-oficial-1400.webp')}" target="_blank" rel="noopener noreferrer" aria-label="Ampliar el arte oficial de Mushuc Freestyle 2026 en otra pestaña">
            <img src="${asset('mfs-arte-oficial-800.webp')}" srcset="${asset('mfs-arte-oficial-800.webp')} 800w, ${asset('mfs-arte-oficial-1400.webp')} 1400w" sizes="(max-width: 900px) calc(100vw - 32px), 460px" width="1400" height="1400" alt="Arte oficial de Mushuc Freestyle 2026, 2da edición: inscripción gratuita, premios de 600, 250 y 100 dólares, medallas, reconocimientos y trofeos." loading="lazy" decoding="async">
          </a>
          <figcaption>Arte oficial · 2da edición</figcaption>
        </figure>
      </div>
    </section>
  </main>
  ${renderFinadosFooter()}
</body>
</html>`;
}
