import { site } from '../data/site.mjs';
import { escapeHtml } from '../render/html.mjs';
import { renderFinadosFooter } from '../finados/footer.mjs';
import { renderFinadosNavigation } from '../finados/navigation.mjs';

const campaignAssetVersion = '20260914-1';
const campaignRuntimeVersion = '20260916-7';
const vocerosStyleVersion = '20261006-premio-1';
const campaignScriptVersion = '20260918-navigation-progress-1';
const navigationAssetVersion = '20260925-navigation-fluid-1';
const BASE = '/finados/emprendedores';

const steps = Object.freeze([
  { number: '01', title: 'Crea tu cuenta', text: 'Con tu correo y una contraseña. Es tu acceso privado al programa.' },
  { number: '02', title: 'Registra tu emprendimiento', text: 'Tus datos, tu foto, qué produces o vendes, tu stand si ya lo tienes y las redes donde publicas.' },
  { number: '03', title: 'Cuenta tu historia en video', text: 'Cinco espacios de video que la coordinación habilita en fechas comunes. Cuando se abra uno, pegas el enlace de tu video.' },
  { number: '04', title: 'Suma reproducciones', text: 'Publica en TikTok con #finadosmushucruna y comparte tu video. El video con más reproducciones al corte del 29 de octubre gana USD 250.' },
]);

const faqs = Object.freeze([
  ['¿Quién puede participar?', 'Personas mayores de edad que produzcan o vendan un producto o servicio y participen como expositoras en la feria. Si todavía no tienes stand, puedes registrarte y agregar el código después.'],
  ['¿Tiene costo?', 'No. Registrarte en el programa es gratuito y no reemplaza la compra de tu stand, que se hace por el canal oficial de venta.'],
  ['¿Qué videos cuentan?', 'Los que publiques desde un perfil público declarado en tu registro, sobre tu emprendimiento y tu participación en la feria, en cada espacio habilitado.'],
  ['¿Qué gano?', 'Visibilidad para tu stand y acompañamiento para contar tu historia. Además, el video con más reproducciones en TikTok al corte del 29 de octubre, a las 18:00, gana USD 250. Hay un solo ganador: no hay segundo lugar, menciones ni premios compartidos.'],
  ['¿Cómo se elige al ganador?', 'Gana el video con más reproducciones al corte. Si hay empate, desempatan los compartidos y, si persiste, los me gusta. Los números salen de la publicación misma: no hay votación ni jurado. Se anuncia el 30 de octubre en la apertura de la feria.'],
  ['¿Cómo se validan las reproducciones?', 'La coordinación abre cada video registrado y captura reproducciones, compartidos y me gusta con hora; esa captura es la evidencia oficial. Queda fuera cualquier video con vistas, likes o compartidos comprados o generados con bots.'],
]);

function faqMarkup() {
  return faqs.map(([question, answer], index) => `<details class="voceros-faq"${index === 0 ? ' open' : ''}>
    <summary><span>${String(index + 1).padStart(2, '0')}</span>${escapeHtml(question)}</summary>
    <p>${escapeHtml(answer)}</p>
  </details>`).join('');
}

export function renderEmprendedoresPage(page) {
  const canonical = `${site.baseUrl}${page.route}`;

  return `<!doctype html>
<html lang="es" class="scroll-smooth bg-night">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Emprendedores | Finados Mushuc Runa 2026</title>
  <meta name="description" content="${escapeHtml(page.description)}">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <link rel="canonical" href="${escapeHtml(canonical)}">
  <meta name="theme-color" content="#241146">
  <link rel="icon" href="/assets/finados/favicon-finados.png" type="image/png" sizes="256x256">
  <link rel="apple-touch-icon" href="/assets/finados/favicon-finados.png">
  <link rel="preload" as="image" href="/assets/finados/logo-finados.svg?v=${campaignAssetVersion}" fetchpriority="high">
  <link rel="stylesheet" href="/assets/finados/finados.css?v=${campaignRuntimeVersion}">
  <link rel="stylesheet" href="/assets/finados/voceros.css?v=${vocerosStyleVersion}">
  <link rel="stylesheet" href="/assets/finados/navigation.css?v=${navigationAssetVersion}">
  <script type="module" src="/assets/finados/finados.js?v=${campaignScriptVersion}"></script>
</head>
<body class="voceros-page emprendedores-page">
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
    <section class="voceros-hero" aria-labelledby="emprendedores-title">
      <div class="voceros-hero__shape voceros-hero__shape--eye" aria-hidden="true"></div>
      <div class="voceros-hero__shape voceros-hero__shape--wave" aria-hidden="true"></div>
      <div class="voceros-shell voceros-hero__grid">
        <div class="voceros-hero__copy">
          <p class="voceros-pill">De emprendedor a influencer</p>
          <h1 id="emprendedores-title">Tu historia <em>trae gente</em> a tu stand</h1>
          <p>Cuenta en video quién eres, qué haces y por qué hay que visitarte en la feria. Registra tu emprendimiento y sube tus videos: el que más reproducciones logre gana USD 250.</p>
          <a class="voceros-button" href="${BASE}/acceso/">Crear cuenta <span aria-hidden="true">↗</span></a>
          <a class="voceros-button" href="${BASE}/acceso/?modo=login">Iniciar sesión</a>
        </div>
        <div class="voceros-hero__poster" aria-label="Programa De emprendedor a influencer Finados 2026">
          <span>Finados</span>
          <strong>2026</strong>
          <p>Tu stand<br>tiene<br>historia.</p>
          <img src="/assets/finados/icons/crecimiento.svg?v=${campaignAssetVersion}" width="512" height="512" alt="" aria-hidden="true">
        </div>
      </div>
    </section>

    <section class="voceros-intro voceros-section" aria-labelledby="que-es-title">
      <div class="voceros-shell">
        <div class="voceros-heading" data-reveal>
          <p>01 · Qué es esto</p>
          <h2 id="que-es-title">La feria, contada por quienes la hacen posible</h2>
        </div>
        <div class="voceros-intro__lead" data-reveal>
          <p>Un programa para los expositores de la Feria de Finados 2026 del Complejo Mushuc Runa: cada emprendedor cuenta su historia, muestra su producto y dice dónde encontrarlo, con su propia voz y en sus propias redes. No es publicidad pagada ni mano de obra: es tu emprendimiento hablando por ti.</p>
          <p>La feria es del 30 de octubre al 3 de noviembre, en Tisaleo, vía Ambato–Riobamba.</p>
        </div>
        <div class="voceros-principles">
          <article data-reveal><img src="/assets/finados/icons/encuentro.svg?v=${campaignAssetVersion}" width="256" height="256" alt=""><span>Encuentro</span><h3>Tu voz, tu producto</h3><p>Grabas con tu celular, a tu manera. Mientras más real, mejor conecta.</p></article>
          <article data-reveal><img src="/assets/finados/icons/crecimiento.svg?v=${campaignAssetVersion}" width="256" height="256" alt=""><span>Crecimiento</span><h3>Gana el que más se ve</h3><p>El video con más reproducciones en TikTok al corte del 29 de octubre se lleva USD 250.</p></article>
          <article data-reveal><img src="/assets/finados/icons/legado.svg?v=${campaignAssetVersion}" width="256" height="256" alt=""><span>Legado</span><h3>Te acompañamos</h3><p>Fechas comunes para cada video, guía de contenido y un gafete digital del programa.</p></article>
        </div>
      </div>
    </section>

    <section class="voceros-thermometer voceros-section emprendedores-prize" id="premio" aria-labelledby="premio-title">
      <div class="voceros-shell">
        <div class="voceros-heading voceros-heading--light" data-reveal>
          <p>02 · El premio</p>
          <h2 id="premio-title">USD 250 al video con más reproducciones</h2>
          <span>Hay un solo ganador. No hay segundo lugar, menciones, empates ni premios compartidos.</span>
        </div>
        <div class="voceros-levels">
          <article class="voceros-level voceros-level--tope" data-reveal>
            <span class="voceros-level__number">$250</span>
            <div><p>Ganador único</p><h3>Video con más reproducciones</h3><span>Al corte del 29 de octubre, a las 18:00, en TikTok.</span></div>
          </article>
          <article class="voceros-level voceros-level--gorra" data-reveal>
            <span class="voceros-level__number">29</span>
            <div><p>Octubre · 12:00</p><h3>Cierre de postulación</h3><span>Hasta esa hora puedes registrar o reemplazar el enlace de tu video.</span></div>
          </article>
          <article class="voceros-level voceros-level--tuyos" data-reveal>
            <span class="voceros-level__number">30</span>
            <div><p>Octubre · apertura</p><h3>Premiación</h3><span>Se anuncia el ganador desde el escenario, en el acto de apertura de la feria.</span></div>
          </article>
          <article class="voceros-level voceros-level--registro" data-reveal>
            <span class="voceros-level__number">=</span>
            <div><p>Empate</p><h3>Desempate</h3><span>Primero los compartidos; si persiste, los me gusta. Sin votación ni jurado.</span></div>
          </article>
        </div>
        <aside class="voceros-conditions" data-reveal>
          <h3>Para que tu video cuente</h3>
          <p>Publícalo en TikTok, en cuenta pública del negocio o de su titular, entre el 8 y el 29 de octubre, con el hashtag #finadosmushucruna en la descripción. Mínimo 15 segundos.</p>
          <p>Muestra tu negocio, tu producto y a quien lo hace, nombra la Feria de Finados Mushuc Runa e invita a venir. Mantenlo publicado hasta después de la premiación.</p>
          <p>Queda fuera cualquier video con vistas, likes o compartidos comprados o con bots, y la decisión del comité es definitiva.</p>
          <a href="${BASE}/bases-de-participacion/" target="_blank" rel="noopener noreferrer">Bases de participación <span aria-hidden="true">↗</span></a>
        </aside>
      </div>
    </section>

    <section class="voceros-support voceros-section" aria-labelledby="pasos-title">
      <div class="voceros-shell voceros-support__grid">
        <div class="voceros-heading" data-reveal><p>03 · Cómo participar</p><h2 id="pasos-title">Cuatro pasos</h2></div>
        <ol>
          ${steps.map(step => `<li data-reveal><span>${step.number}</span><div><strong>${escapeHtml(step.title)}</strong><p>${escapeHtml(step.text)}</p></div></li>`).join('')}
        </ol>
      </div>
    </section>

    <section class="voceros-rules voceros-section" aria-labelledby="reglas-title">
      <div class="voceros-shell voceros-rules__grid">
        <div class="voceros-heading voceros-heading--light" data-reveal><p>04 · Las reglas</p><h2 id="reglas-title">Claro, corto y entre todos</h2></div>
        <div class="voceros-rules__list" data-reveal>
          <p>Cuenta lo que haces de verdad: tu producto, tu proceso, tu gente.</p>
          <p>Solo información oficial de la feria. Si no está publicado, no se publica.</p>
          <p>Sin precios, fechas ni promociones de la feria que no sean oficiales, y sin prometer ventas.</p>
          <p>Sin rostros ni datos de menores de edad sin permiso del adulto responsable.</p>
          <p>Respeto a la comunidad Chibuleo, a los demás expositores y al público. Pide permiso antes de grabar.</p>
          <a href="${BASE}/politicas-del-programa/" target="_blank" rel="noopener noreferrer">Revisar Políticas del programa <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </section>

    <section class="voceros-registration voceros-section" id="registro" aria-labelledby="registro-title">
      <div class="voceros-shell voceros-registration__grid">
        <header class="voceros-heading" data-reveal>
          <p>05 · Registro</p>
          <h2 id="registro-title">Tu registro, en tu cuenta</h2>
          <span>Crea una cuenta para completar tus datos, tu emprendimiento y tu fotografía. Podrás consultar tu estado y agregar tus videos.</span>
        </header>
        <div class="voceros-form">
          <p>Si ya tienes una cuenta, inicia sesión para continuar con tu registro.</p>
          <a class="voceros-button" href="${BASE}/acceso/">Crear cuenta <span aria-hidden="true">↗</span></a>
          <a class="voceros-button" href="${BASE}/acceso/?modo=login">Iniciar sesión</a>
        </div>
      </div>
    </section>

    <section class="voceros-faqs voceros-section" aria-labelledby="preguntas-title">
      <div class="voceros-shell voceros-faqs__grid">
        <div class="voceros-heading voceros-heading--light" data-reveal><p>06 · Preguntas</p><h2 id="preguntas-title">Lo que necesitas saber</h2></div>
        <div>${faqMarkup()}</div>
      </div>
    </section>

    <section class="voceros-documents" id="documentos-legales" aria-labelledby="documentos-title">
      <div class="voceros-shell">
        <div class="voceros-heading" data-reveal><p>Documentos del programa</p><h2 id="documentos-title">Lee antes de registrarte</h2></div>
        <p data-reveal>Consulta las reglas de participación, la validación de videos y el tratamiento de tus datos. Cada documento se abre en una pestaña nueva para que puedas revisarlo sin perder lo que llenaste.</p>
        <ul data-reveal>
          <li><a href="${BASE}/politicas-del-programa/" target="_blank" rel="noopener noreferrer">Políticas del programa <span aria-hidden="true">↗</span></a></li>
          <li><a href="${BASE}/bases-de-participacion/" target="_blank" rel="noopener noreferrer">Bases de participación <span aria-hidden="true">↗</span></a></li>
          <li><a href="${BASE}/politica-de-privacidad/" target="_blank" rel="noopener noreferrer">Política de Privacidad <span aria-hidden="true">↗</span></a></li>
          <li><a href="${BASE}/autorizacion-de-imagen/" target="_blank" rel="noopener noreferrer">Autorización de uso de imagen <span aria-hidden="true">↗</span></a></li>
          <li><a href="${BASE}/ejercer-derechos/" target="_blank" rel="noopener noreferrer">Contacto para ejercer derechos <span aria-hidden="true">↗</span></a></li>
        </ul>
        <small>Última actualización de esta página: 6 de octubre de 2026.</small>
      </div>
    </section>
  </main>

  ${renderFinadosFooter()}
</body>
</html>`;
}
