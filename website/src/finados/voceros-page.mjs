import { site } from '../data/site.mjs';
import { escapeHtml } from '../render/html.mjs';
import { renderFinadosFooter } from './footer.mjs';
import { renderFinadosNavigation } from './navigation.mjs';

const campaignAssetVersion = '20260914-1';
const campaignRuntimeVersion = '20260916-7';
const campaignScriptVersion = '20260918-navigation-progress-1';
const navigationAssetVersion = '20260918-navigation-progress-1';

const levels = Object.freeze([
  {
    key: 'registro',
    name: 'Eres vocero',
    threshold: 'Regístrate + primer video',
    reward: 'Pase gratis de 5 días a la feria, kit digital, credencial física y pulsera.',
  },
  { key: 'gorra', name: 'Gorra', threshold: '4.000 vistas', reward: 'Gorra oficial y acceso a la Zona de Creadores.' },
  { key: 'kit', name: 'Kit completo', threshold: '15.000 vistas', reward: 'Hoodie y bolsa oficiales.' },
  { key: 'tuyos', name: 'Trae a los tuyos', threshold: '80.000 vistas', reward: 'Dos pases de acompañante por un día y acceso al círculo interno.' },
  { key: 'concierto', name: 'Noche de concierto', threshold: '300.000 vistas', reward: 'Un boleto adicional al megaescenario, localidad mesa, la noche que elijas.' },
  { key: 'tope', name: 'Tope', threshold: '1.000.000 vistas', reward: 'Participas por los premios económicos; el número uno será invitado especial, sujeto a autorización del artista y su producción.' },
]);

const trends = Object.freeze([
  { number: '01', name: 'Preséntate', dates: '14 – 20 sep', text: 'Quién eres y un recuerdo tuyo de la feria.' },
  { number: '02', name: 'Volver es tradición', dates: '22 sep – 4 oct', text: 'Un recuerdo real de la feria o de Finados.' },
  { number: '03', name: 'Descubrir lo nuestro', dates: '6 – 18 oct', text: 'Algo nuestro que alguien de fuera no conoce.' },
  { number: '04', name: '¿Con quién vuelves?', dates: '20 – 25 oct', text: 'Tu plan: con quién vas, qué día y por qué.' },
]);

const faqs = Object.freeze([
  ['¿Cuánto cuesta?', 'Nada. El pase de 5 días es gratis para todos los voceros registrados.'],
  ['¿Necesito tener muchos seguidores?', 'No. El nivel Gorra son 4.000 vistas acumuladas: se alcanza con un par de videos que funcionen.'],
  ['¿Puedo participar si vivo fuera de Tungurahua?', 'Sí. El termómetro se sube desde donde estés; los premios se retiran en la feria o en la oficina.'],
  ['¿El pase incluye los conciertos?', 'No. El pase da acceso a toda la feria, y el boleto del megaescenario se gana en el nivel de 300.000 vistas.'],
  ['¿Y si ya publiqué videos de la feria?', 'Cuentan desde el 1 de septiembre. Repórtalos con su enlace y suman.'],
  ['¿Cuánto son los premios económicos?', 'El monto se anuncia en la comunidad a más tardar el 16 de octubre. Preferimos decirlo cuando esté confirmado.'],
  ['¿Qué pasa si no puedo ir a la feria?', 'Sigues sumando en el termómetro con tus videos, y coordinamos la entrega de lo que ganes.'],
  ['¿Puedo ser vocero si soy menor de edad?', 'Desde los 18 sin condiciones. Entre 16 y 17 necesitas autorización escrita de tu representante legal y no puedes cubrir turnos de noche.'],
]);

function levelMarkup() {
  return levels.map((level, index) => `<article class="voceros-level voceros-level--${level.key}" data-reveal>
    <span class="voceros-level__number">${String(index + 1).padStart(2, '0')}</span>
    <div>
      <p>${level.threshold}</p>
      <h3>${level.name}</h3>
      <span>${level.reward}</span>
    </div>
  </article>`).join('');
}

function trendMarkup() {
  return trends.map((trend) => `<article class="voceros-trend" data-reveal>
    <span>${trend.number}</span>
    <time>${trend.dates}</time>
    <h3>${trend.name}</h3>
    <p>${trend.text}</p>
  </article>`).join('');
}

function faqMarkup() {
  return faqs.map(([question, answer], index) => `<details class="voceros-faq"${index === 0 ? ' open' : ''}>
    <summary><span>${String(index + 1).padStart(2, '0')}</span>${question}</summary>
    <p>${answer}</p>
  </details>`).join('');
}

export function renderVocerosPage(page) {
  const canonical = `${site.baseUrl}${page.route}`;

  return `<!doctype html>
<html lang="es" class="scroll-smooth bg-night">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Voceros | Finados Mushuc Runa 2026</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="theme-color" content="#241146">
  <link rel="icon" href="/assets/finados/favicon-finados.png" type="image/png" sizes="256x256">
  <link rel="apple-touch-icon" href="/assets/finados/favicon-finados.png">
  <link rel="preload" as="image" href="/assets/finados/logo-finados.svg?v=${campaignAssetVersion}" fetchpriority="high">
  <link rel="stylesheet" href="/assets/finados/finados.css?v=${campaignRuntimeVersion}">
  <link rel="stylesheet" href="/assets/finados/voceros.css?v=${campaignRuntimeVersion}">
  <link rel="stylesheet" href="/assets/finados/navigation.css?v=${navigationAssetVersion}">
  <script type="module" src="/assets/finados/finados.js?v=${campaignScriptVersion}"></script>
</head>
<body class="voceros-page">
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  <div class="chumbi-line voceros-chumbi" aria-hidden="true"></div>

  <header class="site-header site-header--finados campaign-header voceros-header" data-header>
    <a class="brand finados-brand voceros-header__brand" href="/finados/" aria-label="Finados 2026, página principal">
      <img src="/assets/finados/logo-finados.svg?v=${campaignAssetVersion}" width="766" height="449" alt="Finados 2026, legado que nos une">
    </a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="navegacion-principal"><span></span><span></span><span></span><span class="sr-only">Abrir menú</span></button>
    ${renderFinadosNavigation({ currentRoute: page.route })}
  </header>

  <main id="contenido">
    <section class="voceros-hero" aria-labelledby="voceros-title">
      <div class="voceros-hero__shape voceros-hero__shape--eye" aria-hidden="true"></div>
      <div class="voceros-hero__shape voceros-hero__shape--wave" aria-hidden="true"></div>
      <div class="voceros-shell voceros-hero__grid">
        <div class="voceros-hero__copy">
          <p class="voceros-pill">Comunidad de voceros</p>
          <h1 id="voceros-title">Volví a la feria <em>y esta vez</em> la conté yo</h1>
          <p>Cuenta la feria con tu voz, en tus redes. Mientras más te vean, más subes.</p>
          <a class="voceros-button" href="/finados/voceros/acceso/">Crear cuenta <span aria-hidden="true">↗</span></a>
          <a class="voceros-button" href="/finados/voceros/acceso/?modo=login">Iniciar sesión</a>
        </div>
        <div class="voceros-hero__poster" aria-label="Campaña Comunidad de Voceros Finados 2026">
          <span>Finados</span>
          <strong>2026</strong>
          <p>Tu voz<br>mueve<br>la feria.</p>
          <img src="/assets/finados/icons/encuentro.svg?v=${campaignAssetVersion}" width="512" height="512" alt="" aria-hidden="true">
        </div>
      </div>
    </section>

    <section class="voceros-intro voceros-section" aria-labelledby="que-es-title">
      <div class="voceros-shell">
        <div class="voceros-heading" data-reveal>
          <p>01 · Qué es esto</p>
          <h2 id="que-es-title">La feria, contada desde adentro</h2>
        </div>
        <div class="voceros-intro__lead" data-reveal>
          <p>Somos un grupo de personas que cuentan la Feria de Finados 2026 del Complejo Mushuc Runa desde adentro, con su propia voz y en sus propias redes. No eres un anuncio ni un empleado: eres alguien que vuelve a la feria y la cuenta.</p>
          <p>La feria es del 30 de octubre al 3 de noviembre, en Tisaleo, vía Ambato–Riobamba.</p>
        </div>
        <div class="voceros-principles">
          <article data-reveal><img src="/assets/finados/icons/encuentro.svg?v=${campaignAssetVersion}" width="256" height="256" alt=""><span>Encuentro</span><h3>Tu voz, no la nuestra</h3><p>Grabas con tu celular, a tu manera. Mientras más natural, mejor funciona.</p></article>
          <article data-reveal><img src="/assets/finados/icons/crecimiento.svg?v=${campaignAssetVersion}" width="256" height="256" alt=""><span>Crecimiento</span><h3>Subes solo</h3><p>Nadie elige a dedo. Subes de nivel con tus propias vistas y todos ven el mismo tablero.</p></article>
          <article data-reveal><img src="/assets/finados/icons/legado.svg?v=${campaignAssetVersion}" width="256" height="256" alt=""><span>Legado</span><h3>Te acompañamos</h3><p>Cada lunes hay un Zoom de 30 minutos con guía de contenido, tablero y ganadores.</p></article>
        </div>
      </div>
    </section>

    <section class="voceros-thermometer voceros-section" id="termometro" aria-labelledby="termometro-title">
      <div class="voceros-shell">
        <div class="voceros-heading voceros-heading--light" data-reveal>
          <p>02 · El termómetro</p>
          <h2 id="termometro-title">Sube de nivel</h2>
          <span>Cada nivel se queda con todo lo del anterior.</span>
        </div>
        <div class="voceros-levels">${levelMarkup()}</div>
        <aside class="voceros-conditions" data-reveal>
          <h3>Cómo funciona</h3>
          <p>Suman las vistas de tus videos sobre la feria publicados entre el 1 de septiembre y el 30 de octubre de 2026. Lo que ya subiste también cuenta.</p>
          <p>Solo vistas orgánicas: el contenido impulsado con pauta no suma.</p>
          <p>Los niveles cierran el 30 de octubre al mediodía. Los premios económicos cierran el 8 de noviembre para que lo que grabes en la feria también sume.</p>
          <p>El monto de los premios económicos se anuncia en la comunidad a más tardar el 16 de octubre. Hasta entonces no hay cifra: preferimos decirlo cuando podamos cumplirlo.</p>
          <a href="/finados/voceros/bases-del-termometro/" target="_blank" rel="noopener noreferrer">Bases completas del Termómetro <span aria-hidden="true">↗</span></a>
        </aside>
      </div>
    </section>

    <section class="voceros-counts voceros-section" aria-labelledby="suma-title">
      <div class="voceros-shell">
        <div class="voceros-heading" data-reveal><p>03 · La cuenta</p><h2 id="suma-title">Qué suma y qué no</h2></div>
        <div class="voceros-counts__grid">
          <article class="voceros-counts__yes" data-reveal>
            <h3>Suma</h3>
            <ul>
              <li>Video vertical en TikTok.</li>
              <li>Publicado desde tu cuenta pública, sobre la feria.</li>
              <li>En TikTok usa <strong>#vocerofinadosmushucruna</strong>.</li>
            </ul>
          </article>
          <article class="voceros-counts__no" data-reveal>
            <h3>No suma</h3>
            <ul>
              <li>Contenido impulsado con pauta o promoción pagada.</li>
              <li>Vistas compradas, intercambios de vistas o bots.</li>
              <li>Historias, transmisiones en vivo, fotos y carruseles.</li>
              <li>Videos borrados o puestos en privado antes del 15 de noviembre.</li>
            </ul>
          </article>
        </div>
        <p class="voceros-counts__note" data-reveal><strong>Cómo se cuenta:</strong> reportas el enlace de cada video y una captura de tu analítica. La coordinación puede pedirte ver la analítica en vivo antes de entregar un premio.</p>
      </div>
    </section>

    <section class="voceros-trends voceros-section" aria-labelledby="tendencias-title">
      <div class="voceros-shell">
        <div class="voceros-heading voceros-heading--light" data-reveal>
          <p>04 · Las tendencias</p>
          <h2 id="tendencias-title">No te damos una plantilla. <em>Te damos el tema.</em></h2>
          <span>Cada tendencia es un tema y un puñado de ideas. El formato, el audio y el estilo son tuyos.</span>
        </div>
        <div class="voceros-trends__grid">${trendMarkup()}</div>
        <p class="voceros-trends__note" data-reveal>En cada tendencia compartimos seis ideas concretas, el audio y el formato que está funcionando.</p>
      </div>
    </section>

    <section class="voceros-support voceros-section" aria-labelledby="acompanamos-title">
      <div class="voceros-shell voceros-support__grid">
        <div class="voceros-heading" data-reveal><p>05 · Comunidad</p><h2 id="acompanamos-title">Así te acompañamos</h2></div>
        <ol>
          <li data-reveal><span>01</span><div><strong>Zoom todos los lunes a las 16:00</strong><p>Treinta minutos para ver tablero, ganadores, guía de contenido y lo que viene.</p></div></li>
          <li data-reveal><span>02</span><div><strong>Videos modelo</strong><p>Los ves en el TikTok oficial de la feria y los haces a tu manera.</p></div></li>
          <li data-reveal><span>03</span><div><strong>Comunidad de WhatsApp</strong><p>Un mensaje al día, a las 19:00.</p></div></li>
          <li data-reveal><span>04</span><div><strong>Zona de Creadores</strong><p>Punto de encuentro, carga de celular, agua y un coordinador durante la feria.</p></div></li>
        </ol>
      </div>
    </section>

    <section class="voceros-rules voceros-section" aria-labelledby="reglas-title">
      <div class="voceros-shell voceros-rules__grid">
        <div class="voceros-heading voceros-heading--light" data-reveal><p>06 · Las reglas</p><h2 id="reglas-title">Claro, corto y entre todos</h2></div>
        <div class="voceros-rules__list" data-reveal>
          <p>Solo información oficial. Si no está publicado, no se publica.</p>
          <p>Nada de artistas, programación o precios que no se hayan anunciado.</p>
          <p>Sin superlativos ni promesas: cuenta lo que viste.</p>
          <p>Sin rostros ni datos de menores de edad sin permiso del adulto responsable.</p>
          <p>Respeto a la comunidad Chibuleo, expositores y público. Pide permiso antes de grabar.</p>
          <a href="/finados/voceros/politicas-del-vocero/" target="_blank" rel="noopener noreferrer">Revisar Políticas del Vocero <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>

    <section class="voceros-registration voceros-section" id="registro" aria-labelledby="registro-title">
      <div class="voceros-shell voceros-registration__grid">
        <header class="voceros-heading" data-reveal>
          <p>07 · Registro</p>
          <h2 id="registro-title">Tu registro, en tu cuenta</h2>
          <span>Crea una cuenta para completar tus datos y fotografía. Podrás consultar tu estado y actualizar tu registro mientras esté habilitado.</span>
        </header>
        <div class="voceros-form">
          <p>Si ya tienes una cuenta, inicia sesión para continuar con tu registro.</p>
          <a class="voceros-button" href="/finados/voceros/acceso/">Crear cuenta <span aria-hidden="true">↗</span></a>
          <a class="voceros-button" href="/finados/voceros/acceso/?modo=login">Iniciar sesión</a>
        </div>
      </div>
    </section>

    <section class="voceros-faqs voceros-section" aria-labelledby="preguntas-title">
      <div class="voceros-shell voceros-faqs__grid">
        <div class="voceros-heading voceros-heading--light" data-reveal><p>08 · Preguntas</p><h2 id="preguntas-title">Lo que necesitas saber</h2></div>
        <div>${faqMarkup()}</div>
      </div>
    </section>

    <section class="voceros-documents" id="documentos-legales" aria-labelledby="documentos-title">
      <div class="voceros-shell">
        <div class="voceros-heading" data-reveal><p>Documentos del programa</p><h2 id="documentos-title">Lee antes de registrarte</h2></div>
        <p data-reveal>Consulta las reglas de participación, la medición del Termómetro y el tratamiento de tus datos. Cada documento se abre en una pestaña nueva para que puedas revisarlo sin perder lo que llenaste.</p>
        <ul data-reveal>
          <li><a href="/finados/voceros/politicas-del-vocero/" target="_blank" rel="noopener noreferrer">Políticas del Vocero <span aria-hidden="true">↗</span></a></li>
          <li><a href="/finados/voceros/bases-del-termometro/" target="_blank" rel="noopener noreferrer">Bases del Termómetro <span aria-hidden="true">↗</span></a></li>
          <li><a href="/finados/voceros/politica-de-privacidad/" target="_blank" rel="noopener noreferrer">Política de Privacidad <span aria-hidden="true">↗</span></a></li>
          <li><a href="/finados/voceros/autorizacion-de-imagen/" target="_blank" rel="noopener noreferrer">Autorización de uso de imagen <span aria-hidden="true">↗</span></a></li>
          <li><a href="/finados/voceros/ejercer-derechos/" target="_blank" rel="noopener noreferrer">Contacto para ejercer derechos <span aria-hidden="true">↗</span></a></li>
        </ul>
        <small>Última actualización de esta página: 14 de septiembre de 2026.</small>
      </div>
    </section>
  </main>


  ${renderFinadosFooter()}
</body>
</html>`;
}
