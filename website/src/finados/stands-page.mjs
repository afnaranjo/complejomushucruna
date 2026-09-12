import { site } from '../data/site.mjs';
import { escapeHtml, externalAttributes } from '../render/html.mjs';

const purchaseUrl = 'https://mushucticket.com/';
const campaignAssetVersion = '20260903';
const campaignRuntimeVersion = '20260912';
const newTabAttributes = ' target="_blank" rel="noopener noreferrer"';

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
  <link rel="stylesheet" href="/assets/finados/finados.css?v=${campaignRuntimeVersion}">
  <script type="module" src="/assets/finados/finados.js?v=${campaignRuntimeVersion}"></script>
</head>
<body class="stands-access-page bg-night font-sans text-lienzo antialiased selection:bg-winay selection:text-night">
  <a class="skip-link" href="#contenido">Ir al contenido</a>
  <div class="chumbi-line fixed inset-x-0 top-0 z-50 h-3" aria-hidden="true"></div>

  <header class="stands-access-nav absolute inset-x-0 top-3 z-40">
    <div class="mx-auto flex h-20 w-[min(100%-2rem,88rem)] items-center justify-end sm:h-24">
      <a class="button-outline-light" href="/finados/"${newTabAttributes}>Volver a Finados</a>
    </div>
  </header>

  <main id="contenido">
    <section class="stands-access-hero relative isolate flex min-h-[100svh] items-center overflow-hidden px-4 pb-20 pt-32 text-center sm:pb-24 sm:pt-36">
      <div class="stands-access-backdrop absolute inset-0 -z-30" aria-hidden="true"></div>
      <img class="stands-access-spectator absolute -z-20" src="/assets/finados/icons/espectador.svg?v=${campaignAssetVersion}" alt="" width="1271" height="587" aria-hidden="true">

      <div class="stands-access-shell mx-auto w-[min(100%,74rem)]">
        <a class="stands-access-brand hero-enter mx-auto block" href="/finados/"${newTabAttributes} aria-label="Finados 2026, volver a la landing" data-hero-item>
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
          <div class="stands-hero-actions">
            <a class="stands-purchase-button" href="${purchaseUrl}"${externalAttributes(purchaseUrl)}>Comprar mi stand <span aria-hidden="true">↗</span></a>
            <a class="stands-section-button" href="#politicas-generales" aria-label="Ir a políticas generales y mapa de accesos">Políticas y mapa <span aria-hidden="true">↓</span></a>
          </div>
          <p class="stands-online-note mx-auto mt-7 max-w-3xl">Venta exclusivamente online a través del canal de compra.</p>
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

    <section id="politicas-generales" class="stands-policies px-4 py-20 text-lienzo sm:py-28" aria-labelledby="politicas-title">
      <div class="mx-auto w-[min(100%,88rem)]">
        <header class="stands-policies-heading" data-reveal>
          <p class="kicker text-fuchsia">Feria Finados Mushuc Runa 2026</p>
          <h2 id="politicas-title" class="stands-policies-title mt-5 font-display uppercase">Políticas generales</h2>
          <p class="mt-6 max-w-3xl text-lg font-semibold leading-relaxed text-lienzo/75 sm:text-xl">Información para la compra, operación y salida de los expositores.</p>
        </header>

        <div class="stands-policy-grid mt-12">
          <article class="stands-policy-card stands-policy-card--purchase" data-reveal>
            <p class="stands-policy-label"><span aria-hidden="true">01</span> Compra de stands</p>
            <ol class="stands-policy-list mt-7">
              <li><span aria-hidden="true">1</span><p>Venta de stands <strong>solo en línea</strong>: lunes 14 de septiembre, 8:00 am, en <a href="${purchaseUrl}"${externalAttributes(purchaseUrl)}>www.mushucticket.com</a>, hasta agotar stock.</p></li>
              <li><span aria-hidden="true">2</span><p>Se autoriza la adquisición de <strong>un (1) stand por RUC</strong>.</p></li>
              <li><span aria-hidden="true">3</span><p>El costo aplica según la <strong>lista de precios oficial de Feria Finados Mushuc Runa 2026</strong>.</p></li>
            </ol>
          </article>

          <article class="stands-policy-card stands-policy-card--warranty" data-reveal>
            <p class="stands-policy-label"><span aria-hidden="true">02</span> Garantía</p>
            <div class="stands-warranty-values mt-7" aria-label="Valores de garantía por categoría">
              <p><span>Artesanías</span><strong>$25</strong></p>
              <p><span>Comercio y productores</span><strong>$50</strong></p>
              <p><span>Gastronomía</span><strong>$200</strong></p>
            </div>
            <h3 class="stands-policy-subtitle mt-8">Condiciones de reembolso</h3>
            <ol class="stands-policy-list stands-policy-list--compact mt-4">
              <li><span aria-hidden="true">1</span><p>Tener cuenta de ahorros activa en Coop. Mushuc Runa.</p></li>
              <li><span aria-hidden="true">2</span><p>Devolución general: <strong>30 días</strong>.</p></li>
              <li><span aria-hidden="true">3</span><p>Devolución zona gastronómica: <strong>60 días</strong>.</p></li>
            </ol>
          </article>

          <article class="stands-policy-card stands-policy-card--dates" data-reveal>
            <p class="stands-policy-label"><span aria-hidden="true">03</span> Fechas clave</p>
            <div class="stands-key-dates mt-8">
              <div><time datetime="2026-10-26">26–27 <small>octubre · oficinas</small></time><p>Entrega de gafetes, Juan Benigno Vela y Montalvo, 9:00–17:00.</p></div>
              <div><time datetime="2026-10-29">29 <small>octubre · complejo</small></time><p>Entrega de gafetes, de 8:00–20:00.</p></div>
              <div><time datetime="2026-10-30T14:00:00-05:00">30 <small>octubre · 14:00</small></time><p>Fecha límite de stand listo, previa revisión de comisarios.</p></div>
              <div><time datetime="2026-11-03">3 <small>noviembre · salida</small></time><p>Salida oficial con salvoconducto: peatonal 18:00, vehicular 21:00.</p></div>
            </div>
          </article>

          <article class="stands-policy-card stands-policy-card--vehicles" data-reveal>
            <p class="stands-policy-label"><span aria-hidden="true">04</span> Vehículos</p>
            <div class="stands-vehicle-grid mt-8">
              <div>
                <span>Ingreso libre para expositores</span>
                <strong>5:00–10:00 am</strong>
                <p>Desde las 11:00, restricción total: grúa al parqueadero V2 + $25.</p>
              </div>
              <div>
                <span>Abastecimiento fuera de horario de circulación interna</span>
                <strong>Uso de estación de transbordo</strong>
                <p>El expositor deberá utilizar la estación de transbordo, ubicada en los parqueaderos. Costo: $5.</p>
              </div>
            </div>
          </article>

          <article class="stands-policy-card stands-policy-card--fair" data-reveal>
            <p class="stands-policy-label"><span aria-hidden="true">05</span> Durante la feria</p>
            <ol class="stands-policy-list stands-policy-list--columns mt-8">
              <li><span aria-hidden="true">9</span><p>Atención mínima: <strong>11:00 a 20:00</strong>.</p></li>
              <li><span aria-hidden="true">10</span><p>Respetar el <strong>área contratada</strong>.</p></li>
              <li><span aria-hidden="true">11</span><p>Gafete <strong>personal e intransferible</strong>; da acceso a feria, baños y duchas. Sin gafete, se paga la entrada de $3,00.</p></li>
              <li><span aria-hidden="true">12</span><p>Portar el gafete en todo momento y <strong>registrar entrada/salida</strong> en los scanners.</p></li>
              <li><span aria-hidden="true">14</span><p>Administración se reserva el derecho de <strong>cambiar ubicaciones</strong>, con previo aviso.</p></li>
              <li><span aria-hidden="true">15</span><p><strong>Respeto</strong> al staff, expositores y visitantes.</p></li>
              <li><span aria-hidden="true">16</span><p><strong>Prohibido ingerir bebidas alcohólicas</strong>, atender en estado etílico o bajo efectos de sustancias sujetas a fiscalización.</p></li>
              <li><span aria-hidden="true">17</span><p>Equipos de enfriamiento entregados son de uso exclusivo de <strong>bebidas de auspiciantes</strong>.</p></li>
              <li><span aria-hidden="true">18</span><p>Asaderos: deben contar con <strong>campana y extractor de humo</strong> obligatorios.</p></li>
              <li>
                <span aria-hidden="true">19</span>
                <div>
                  <p>Incumplimiento:</p>
                  <ol class="stands-policy-sublist">
                    <li><strong>Primera vez, llamado de atención.</strong></li>
                    <li>Reincidencia, se ejecuta el <strong>100% de la garantía</strong>, con evidencia fotográfica.</li>
                  </ol>
                </div>
              </li>
            </ol>
          </article>

          <article class="stands-policy-card stands-policy-card--sanctions" data-reveal>
            <p class="stands-policy-label"><span aria-hidden="true">06</span> Sanciones del 100% de la garantía</p>
            <ol class="stands-sanctions-list mt-8">
              <li><span aria-hidden="true">1</span><p>No retirar los gafetes en las fechas establecidas.</p></li>
              <li><span aria-hidden="true">2</span><p>Vender productos no autorizados.</p></li>
              <li><span aria-hidden="true">3</span><p>Abandonar la feria antes del 3 de noviembre, 18:00.</p></li>
              <li><span aria-hidden="true">4</span><p>Exceder el área asignada afectando a terceros.</p></li>
              <li><span aria-hidden="true">5</span><p>Ingresar bebidas o licor no autorizado para negocio.</p></li>
              <li><span aria-hidden="true">6</span><p>Falsificar, duplicar o dar mal uso al gafete.</p></li>
            </ol>
          </article>
        </div>
      </div>
    </section>

    <section id="mapa-accesos" class="stands-map px-4 py-20 text-night sm:py-28" aria-labelledby="mapa-accesos-title">
      <div class="mx-auto w-[min(100%,96rem)]">
        <header class="stands-map-heading" data-reveal>
          <p class="kicker text-night">Ubicación y circulación</p>
          <h2 id="mapa-accesos-title" class="stands-map-title mt-5 font-display uppercase">Mapa de accesos</h2>
        </header>
        <figure class="stands-map-frame mt-10" data-reveal>
          <img src="/assets/finados/mapa-accesos.svg?v=20260911" width="3508" height="2481" loading="lazy" alt="Mapa oficial de accesos de la Feria Finados Mushuc Runa 2026">
          <figcaption>Mapa de accesos · Feria Finados Mushuc Runa 2026</figcaption>
        </figure>
      </div>
    </section>
  </main>

  <footer class="bg-night px-4 py-10 text-lienzo">
    <div class="mx-auto flex w-[min(100%,74rem)] flex-col gap-7 border-t border-lienzo/30 pt-8 sm:flex-row sm:items-end sm:justify-between">
      <img class="h-auto w-36" src="/assets/finados/logo-finados.svg?v=${campaignAssetVersion}" width="766" height="449" alt="Finados 2026">
      <a class="footer-link" href="/finados/"${newTabAttributes}>Volver a Finados <span aria-hidden="true">↗</span></a>
    </div>
  </footer>
</body>
</html>`;
}
