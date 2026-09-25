import legacyPages from './data/legacy-pages.json' with { type: 'json' };
import {
  currentHighlights,
  experiences,
  farmCategories,
  historicalEvents,
  routeOptions,
  site,
} from './data/site.mjs';
import {
  archiveArticle,
  archiveList,
  categoryField,
  editorial,
  experienceIndex,
  heritageQuote,
  hero,
  homeFinadosHero,
  institutionalHighlights,
  sectionHeading,
  visitPanel,
} from './render/components.mjs';
import { renderFinadosPage } from './finados/page.mjs';
import { renderFinadosDignitiesPage } from './finados/dignities-page.mjs';
import { renderFinadosShowsPage } from './finados/shows-page.mjs';
import { renderMfsPage } from './finados/mfs-page.mjs';
import { renderMfsPortalPage } from './finados/mfs-portal-page.mjs';
import { renderMfsVerificationPage } from './finados/mfs-verification-page.mjs';
import { mfsLegalDocuments, mfsLegalRoutes, renderMfsLegalPage } from './finados/mfs-legal-page.mjs';
import { renderStandsAccessPage } from './finados/stands-page.mjs';
import { renderVocerosLegalPage } from './finados/voceros-legal-page.mjs';
import { renderVocerosPage } from './finados/voceros-page.mjs';
import { renderVoceroPortalPage } from './finados/vocero-portal-page.mjs';
import { renderVoceroVerificationPage } from './finados/vocero-verification-page.mjs';
import { renderNameCapturePage, renderNameScreenPage } from './finados/nombres-en-pantalla-page.mjs';
import { renderMediaAccreditationBody } from './media-accreditation/page.mjs';
import { renderCreadorasLandingPage } from './creadoras/landing-page.mjs';
import { renderCreadoraPortalPage } from './creadoras/portal-page.mjs';
import { renderCreadoraLegalPage } from './creadoras/legal-page.mjs';
import { renderAdminNoticiasPage,
  renderAdminCreadorasPage, renderAdminMfsPage,
  renderAdminEmprendedoresPage, renderAdminLoginPage, renderAdminMediosEventosPage, renderAdminMediosCalendarioPage, renderAdminMediosGiraPage, renderAdminMediosPage, renderAdminPanelPage, renderAdminVocerosPage } from './admin/page.mjs';
import { renderMediaLandingBody } from './medios/landing-page.mjs';
import { renderMediaPortalPage } from './medios/portal-page.mjs';
import { renderMediaAccreditationPage } from './medios/accreditation-page.mjs';
import { mediaLegalDocuments, mediaLegalRoutes, renderMediaLegalPage } from './medios/legal-page.mjs';
import { renderEmprendedoresPage } from './emprendedores/landing-page.mjs';
import { renderEmprendedorPortalPage } from './emprendedores/portal-page.mjs';
import { renderEmprendedorVerificationPage } from './emprendedores/verification-page.mjs';
import { emprendedorLegalDocuments, emprendedorLegalRoutes, renderEmprendedorLegalPage } from './emprendedores/legal-page.mjs';

const historyParagraphs = [
  'Al pie del volcán Carihuayrazo, cerca al Puñalica y de frente a los Llimpes, se levanta el Complejo Intercultural y Deportivo Mushuc Runa, en honor al hombre nuevo, que se abre espacio en este mundo globalizado. Desde la parte alta se puede apreciar la explanada que acoge a varios poblados de Ambato, Tisaleo, Quero y Cevallos. La obra que inició en el 2012 bajo la inspiración de Luis Alfonso Chango, tiene un toque campestre y natural, dotado de funcionalidad moderna. El proyecto fue inspirado en la reivindicación de los indígenas que hasta hace poco, sólo servían como peones de estas tierras.',
  'Una isla artificial se ubicó al ingreso de los estadios de fútbol para dar la bienvenida. Aquí se preparan datos de las culturas ancestrales de la región, un registro dinámico de información integral de todos los atractivos naturales, culturales y de entretenimiento. Por la parte oriental del Complejo Intercultural y Deportivo Mushuc Runa cruza el legendario camino del Inca con toda su rica historia que se remonta al tiempo.',
];

function legacyTexts(sourceId, fallback) {
  const page = legacyPages.find((item) => item.id === sourceId);
  const ignored = /^(?:Separador|Hero|Nueva galería|comprar|Team|Divider|Top|Title|Button|Cards)$/i;
  const texts = (page?.texts ?? []).filter((text) => !ignored.test(text) && !text.startsWith('['));
  return texts.length ? texts : [fallback];
}

const eventImages = Object.freeze({
  'finados-2021': '/assets/images/events/finados-2021.webp',
  'finados-2022': '/assets/images/events/finados-2022.webp',
  'festival-de-canto': '/assets/images/events/festival-canto.webp',
  'finados-2023': '/assets/images/events/finados-2023.webp',
  toros: '/assets/images/events/toros.webp',
  'finados-2025': '/assets/images/events/finados-2025.webp',
  'navidad-2025': '/assets/images/events/navidad-2025.webp',
});

function homePageBody() {
  const identity = editorial({
    eyebrow: 'Bienvenidos',
    heading: 'Un lugar con identidad propia',
    paragraphs: [
      'El Complejo Mushuc Runa reúne experiencias culturales, recreativas y deportivas en un entorno andino de gran escala.',
      'Aquí, el paisaje y la memoria de los pueblos dialogan con espacios creados para el encuentro de familias, visitantes y comunidades.',
    ],
    image: '/assets/images/complejo-carihuayrazo.webp',
    alt: 'Vista panorámica del Complejo Mushuc Runa y el paisaje de Tungurahua',
    accent: 'Mushuc Runa',
  });

  const experiencesSection = `<section class="section section--compact home-chapter home-chapter--experiences"><div class="shell">${sectionHeading({
    eyebrow: 'Explora',
    heading: 'Muchas formas de vivir el Complejo',
    intro: 'Recuperamos las experiencias documentadas en el sitio anterior y señalamos con transparencia cuáles necesitan confirmación de disponibilidad.',
  })}${experienceIndex(experiences.slice(0, 3))}<div class="button-row"><a class="button button--red" href="/experiencias/">Ver todas las experiencias</a></div></div></section>`;

  const quote = heritageQuote(
    'Un espacio donde identidad, comunidad y territorio vuelven a encontrarse.',
    'Complejo Intercultural y Deportivo Mushuc Runa',
  );

  const archiveSection = `<section class="section home-chapter home-chapter--archive"><div class="shell">${sectionHeading({
    eyebrow: 'Memoria viva',
    heading: 'Eventos que forman parte de nuestra historia',
    intro: 'El archivo conserva las páginas publicadas de ferias y celebraciones anteriores sin presentar sus ofertas como vigentes.',
  })}${archiveList(historicalEvents.slice(-3))}<div class="button-row"><a class="button button--red" href="/eventos/">Explorar el archivo</a></div></div></section>`;

  return `<div class="home-story">
    ${homeFinadosHero()}
    <div class="home-story__flow">
      ${institutionalHighlights(currentHighlights)}
      <div class="home-chapter home-chapter--identity">${identity}</div>
      ${experiencesSection}
      <div class="home-chapter home-chapter--quote">${quote}</div>
      ${archiveSection}
      <div class="home-chapter home-chapter--visit">${visitPanel({ routes: routeOptions, tourUrl: site.tourUrl })}</div>
    </div>
  </div>`;
}

const mainPages = [
  {
    route: '/',
    title: site.name,
    description: `${site.legalName}: cultura, naturaleza, recreación y encuentros en Tungurahua.`,
    body: homePageBody(),
  },
  {
    route: '/experiencias/',
    title: 'Experiencias',
    description: 'Conoce las experiencias y atractivos documentados del Complejo Mushuc Runa.',
    body: hero({
      eyebrow: 'Descubre',
      heading: 'Experiencias para compartir',
      intro: 'Naturaleza, recreación y memoria cultural en un solo territorio.',
      image: '/assets/images/mushuc-park.webp',
    }) + `<section class="section shell section--compact">${sectionHeading({
      eyebrow: 'Elige tu recorrido',
      heading: 'Aventura, aprendizaje y encuentro',
      intro: 'Estas experiencias fueron presentadas en el sitio institucional anterior. Confirma su operación antes de planificar tu visita.',
    })}${experienceIndex(experiences)}</section>` + heritageQuote(
      'Cada rincón guarda una forma distinta de acercarse a nuestro territorio.',
      'Experiencias del Complejo',
    ) + visitPanel({ routes: routeOptions, tourUrl: site.tourUrl }),
  },
  {
    route: '/granja/',
    title: 'Granja Agroturística',
    description: 'Conoce la Granja Agroturística del Complejo Mushuc Runa y sus categorías históricas.',
    body: hero({
      eyebrow: 'Naturaleza',
      heading: 'Granja Agroturística',
      intro: 'Un encuentro cercano con el entorno rural, sus especies y la vida del campo.',
      image: '/assets/images/granja.webp',
    }) + editorial({
      eyebrow: 'Aprender observando',
      heading: 'Conoce nuestros ejemplares',
      paragraphs: [
        'La Granja Agroturística fue creada como un espacio para acercar a las familias al entorno rural y a la diversidad de especies documentadas en el Complejo.',
        'La experiencia actual y las actividades de interacción deben confirmarse antes de la visita, priorizando siempre el bienestar animal.',
      ],
      image: '/assets/images/granja-detalle.webp',
      alt: 'Espacios de la Granja Agroturística del Complejo Mushuc Runa',
      accent: 'Naturaleza que enseña',
    }) + `<section class="section shell">${sectionHeading({
      eyebrow: 'Archivo de la granja',
      heading: 'Especies documentadas',
      intro: 'La página anterior organizaba su recorrido en estas siete categorías.',
    })}${categoryField(farmCategories)}</section>` + visitPanel({ routes: routeOptions, tourUrl: site.tourUrl }),
  },
  {
    route: '/eventos/',
    title: 'Eventos',
    description: 'Explora el archivo histórico de eventos realizados en el Complejo Mushuc Runa.',
    body: hero({
      eyebrow: 'Memoria viva',
      heading: 'Eventos que nos reúnen',
      intro: 'Ferias, celebraciones y encuentros que forman parte de la historia del Complejo.',
      image: '/assets/images/hero-eventos.webp',
    }) + `<section class="section shell">${sectionHeading({
      eyebrow: '2021–2025',
      heading: 'Archivo histórico',
      intro: 'Cada página conserva el contenido recuperado de su edición. Sus fechas, precios, inscripciones y enlaces de compra ya no están vigentes.',
    })}${archiveList(historicalEvents)}</section>`,
  },
  {
    route: '/historia/',
    title: 'Historia',
    description: 'Conoce la historia del Complejo Intercultural y Deportivo Mushuc Runa.',
    body: hero({
      eyebrow: 'Nuestra raíz',
      heading: 'Historia',
      intro: 'Una visión nacida para unir identidad, comunidad, deporte y desarrollo.',
      image: '/assets/images/complejo-carihuayrazo.webp',
    }) + editorial({
      eyebrow: '¿Qué es el Complejo?',
      heading: 'Una obra inspirada en el hombre nuevo',
      paragraphs: historyParagraphs,
      image: '/assets/images/historia-aerea.webp',
      alt: 'Vista aérea histórica del territorio donde se levanta el Complejo Mushuc Runa',
      accent: 'Desde 2012',
    }) + heritageQuote(
      'El legendario Camino del Inca cruza por la parte oriental del Complejo con toda su rica historia.',
      'Texto histórico recuperado',
    ) + editorial({
      eyebrow: 'Territorio',
      heading: 'Paisaje, memoria y encuentro',
      paragraphs: ['Desde la parte alta se aprecia la explanada que acoge a poblados de Ambato, Tisaleo, Quero y Cevallos, rodeada por una geografía que define la experiencia del lugar.'],
      image: '/assets/images/vista-aerea.webp',
      alt: 'Paisaje andino visto desde el Complejo Mushuc Runa',
      reverse: true,
    }),
  },
  {
    route: '/visitanos/',
    title: 'Visítanos',
    description: 'Encuentra las rutas publicadas para llegar al Complejo Mushuc Runa en Tisaleo, Tungurahua.',
    body: hero({
      eyebrow: 'Planifica',
      heading: 'Visítanos',
      intro: 'Santa Lucía de Tisaleo, kilómetro 12 de la vía Ambato–Riobamba.',
      image: '/assets/images/vista-aerea.webp',
    }) + visitPanel({ routes: routeOptions, tourUrl: site.tourUrl }) + editorial({
      eyebrow: 'Antes de viajar',
      heading: 'Prepara tu recorrido',
      paragraphs: [
        'La Carretera E35 vía Ambato–Riobamba y el Camino Real vía Manzana de Oro son las dos referencias publicadas en el sitio anterior.',
        'Confirma horarios, precios y disponibilidad de experiencias mediante los canales oficiales antes de desplazarte.',
      ],
      image: '/assets/images/ubicacion.webp',
      alt: 'Referencia de ubicación del Complejo Mushuc Runa',
      accent: 'Será un gusto recibirte',
    }),
  },
  {
    route: '/acreditacion-de-medios/',
    title: 'Acreditación de medios',
    description: 'Registro oficial para medios de comunicación que cubrirán el lanzamiento de Finados Mushuc Runa 2026.',
    bodyClass: 'media-accreditation-page',
    designSystem: 'finados',
    headerVariant: 'finados',
    footerVariant: 'finados',
    heroImage: '/assets/images/acreditacion-medios-periodista.jpg?v=20260909',
    stylesheet: '/assets/media-accreditation.css?v=20260916-4',
    body: renderMediaAccreditationBody(),
  },
];

const archivePages = historicalEvents.map((event) => ({
  route: `/eventos/archivo/${event.slug}/`,
  title: event.title,
  description: `${event.status}: ${event.summary}`,
  body: hero({
    eyebrow: `${event.status} · ${event.year}`,
    heading: event.title,
    intro: event.summary,
    image: eventImages[event.slug],
  }) + archiveArticle(legacyTexts(event.sourceId, event.summary)),
}));

const finadosPreview = {
  route: '/finados/',
  title: 'Finados 2026',
  description: 'Previsualización privada de la identidad y experiencia digital de Finados 2026.',
  indexable: false,
  render: renderFinadosPage,
};

const finadosDignitiesPage = {
  route: '/finados/dignidades-finados-2025/',
  title: 'Dignidades Finados 2025',
  description: 'Ganadores de Rey Pan y Señorita Colada Morada de Finados Mushuc Runa 2025.',
  indexable: false,
  render: renderFinadosDignitiesPage,
};

const finadosShowsPage = {
  route: '/finados/shows/',
  title: 'Shows Finados 2026',
  description: 'Artistas, fechas, shows y auspiciantes de Finados Mushuc Runa 2026. Consulta el cartel oficial de la feria.',
  indexable: false,
  render: renderFinadosShowsPage,
};

const finadosMfsPage = {
  route: '/finados/mfs/',
  title: 'Mushuc Freestyle 2026',
  description: 'Mushuc Freestyle regresa en su 2da edición a la Plaza de la Luna en Finados Mushuc Runa 2026. Inscripción gratuita y premio económico.',
  indexable: false,
  render: renderMfsPage,
};

const finadosVocerosPage = {
  route: '/finados/voceros/',
  title: 'Voceros',
  description: 'Comunidad de voceros de Finados Mushuc Runa 2026: niveles, tendencias, acompañamiento y registro.',
  indexable: false,
  render: renderVocerosPage,
};

const voceroVerificationPage = {
  route: '/finados/voceros/verificar/',
  title: 'Validación de gafete',
  description: 'Confirma el nivel y el semáforo de un vocero oficial de Finados Mushuc Runa 2026.',
  indexable: false,
  render: renderVoceroVerificationPage,
};

const vocerosLegalPages = [
  ['politicas-del-vocero', 'Políticas del Vocero', 'policies'],
  ['bases-del-termometro', 'Bases del Termómetro', 'thermometer'],
  ['politica-de-privacidad', 'Política de Privacidad', 'privacy'],
  ['autorizacion-de-imagen', 'Autorización de uso de imagen', 'image'],
  ['ejercer-derechos', 'Contacto para ejercer derechos', 'rights'],
].map(([slug, title, documentKey]) => ({
  route: `/finados/voceros/${slug}/`,
  title,
  description: `${title} de la Comunidad de Voceros de Finados Mushuc Runa 2026.`,
  documentKey,
  indexable: false,
  render: renderVocerosLegalPage,
}));

const finadosMediaPage = {
  route: '/finados/medios/',
  title: 'Registro de medios',
  description: 'Registro con cuenta para medios de comunicación que cubrirán Finados Mushuc Runa 2026.',
  indexable: false,
  bodyClass: 'media-accreditation-page',
  designSystem: 'finados',
  headerVariant: 'finados',
  footerVariant: 'finados',
  heroImage: '/assets/images/acreditacion-medios-periodista.jpg?v=20260909',
  stylesheet: '/assets/media-accreditation.css?v=20260921-medios-2',
  body: renderMediaLandingBody(),
};

const finadosEmprendedoresPage = {
  route: '/finados/emprendedores/',
  title: 'Emprendedores',
  description: 'Programa De emprendedor a influencer de Finados Mushuc Runa 2026: registro, videos, niveles y gafete para expositores.',
  indexable: false,
  render: renderEmprendedoresPage,
};

const emprendedorVerificationPage = {
  route: '/finados/emprendedores/verificar/',
  title: 'Validación de gafete de emprendedor',
  description: 'Confirma el nivel y el semáforo de un emprendedor participante de Finados Mushuc Runa 2026.',
  indexable: false,
  render: renderEmprendedorVerificationPage,
};

const standsAccessPage = {
  route: '/acceso-compra-stands/',
  title: 'Acceso para compra de stands',
  description: 'Información y acceso para la compra online de stands de Finados 2026.',
  indexable: false,
  render: renderStandsAccessPage,
};

const finadosNameCapturePage = {
  route: '/finados/nombre/',
  title: 'Tu nombre en escena · Finados 2026',
  description: 'Comparte tu nombre y hazlo aparecer en la pantalla de Finados Mushuc Runa 2026.',
  indexable: false,
  render: () => renderNameCapturePage({ mode: 'qr' }),
};

const finadosNameWritePage = {
  route: '/finados/nombre/escribe/',
  title: 'Escribe tu nombre · Finados 2026',
  description: 'Escribe el nombre que quieres compartir en la pantalla de Finados Mushuc Runa 2026.',
  indexable: false,
  render: () => renderNameCapturePage({ mode: 'write' }),
};

const finadosNameScreenPage = {
  route: '/finados/pantalla/',
  title: 'Nombres en pantalla · Finados 2026',
  description: 'Pantalla de nombres compartidos con consentimiento en Finados Mushuc Runa 2026.',
  indexable: false,
  render: renderNameScreenPage,
};

export const pages = Object.freeze([
  { route: '/admin/', title: 'Iniciar sesión', indexable: false, render: renderAdminLoginPage },
  { route: '/admin/panel/', title: 'Panel · Administración', indexable: false, render: renderAdminPanelPage },
  { route: '/admin/voceros/', title: 'Voceros · Administración', indexable: false, render: renderAdminVocerosPage },
  { route: '/admin/medios/', title: 'Medios · Administración', indexable: false, render: renderAdminMediosPage },
  { route: '/admin/medios/eventos/', title: 'Medios · Eventos · Administración', indexable: false, render: renderAdminMediosEventosPage },
  { route: '/admin/medios/calendario/', title: 'Medios · Calendario de medios · Administración', indexable: false, render: renderAdminMediosCalendarioPage },
  { route: '/admin/medios/gira/', title: 'Medios · Gira de medios · Administración', indexable: false, render: renderAdminMediosGiraPage },
  { route: '/admin/emprendedores/', title: 'Emprendedores · Administración', indexable: false, render: renderAdminEmprendedoresPage },
  { route: '/admin/creadoras/', title: 'Creadoras · Administración', indexable: false, render: renderAdminCreadorasPage },
  { route: '/admin/noticias/', title: 'Noticias · Administración', indexable: false, render: renderAdminNoticiasPage },
  { route: '/admin/mfs/', title: 'Mushuc Freestyle · Administración', indexable: false, render: renderAdminMfsPage },
  { route: '/finados/creadoras/', title: 'Creadoras de contenido · Finados 2026', indexable: false, render: renderCreadorasLandingPage },
  { route: '/finados/creadoras/acceso/', title: 'Tu cuenta de creadora', indexable: false, render: renderCreadoraPortalPage },
  { route: '/finados/creadoras/mi-registro/', title: 'Mi registro · Creadoras', indexable: false, render: renderCreadoraPortalPage },
  { route: '/finados/creadoras/restablecer/', title: 'Restablecer contraseña · Creadoras', indexable: false, render: renderCreadoraPortalPage },
  { route: '/finados/creadoras/condiciones/', title: 'Condiciones de participación · Creadoras', indexable: false, render: renderCreadoraLegalPage },
  { route: '/finados/creadoras/politica-de-privacidad/', title: 'Política de Privacidad · Creadoras', indexable: false, render: renderCreadoraLegalPage },
  ...mainPages,
  ...archivePages,
  finadosPreview,
  finadosShowsPage,
  finadosMfsPage,
  ...['acceso', 'mi-registro', 'restablecer'].map(slug => ({ route: `/finados/mfs/${slug}/`, title: 'Cuenta de Mushuc Freestyle', indexable: false, render: renderMfsPortalPage })),
  { route: '/finados/mfs/verificar/', title: 'Validación de gafete · Mushuc Freestyle', indexable: false, render: renderMfsVerificationPage },
  ...Object.entries(mfsLegalDocuments).map(([documentKey, document]) => ({ route: mfsLegalRoutes[documentKey], title: document.title, description: document.summary, documentKey, indexable: false, render: renderMfsLegalPage })),
  finadosVocerosPage,
  voceroVerificationPage,
  ...['acceso', 'mi-registro', 'restablecer'].map(slug => ({ route: `/finados/voceros/${slug}/`, title: 'Cuenta de Vocero', indexable: false, render: renderVoceroPortalPage })),
  ...vocerosLegalPages,
  finadosMediaPage,
  ...['acceso', 'mi-registro', 'restablecer'].map(slug => ({ route: `/finados/medios/${slug}/`, title: 'Cuenta de medio', indexable: false, render: renderMediaPortalPage })),
  { route: '/finados/medios/acreditacion/', title: 'Acreditación de medios', indexable: false, render: renderMediaAccreditationPage },
  ...Object.entries(mediaLegalDocuments).map(([documentKey, document]) => ({ route: mediaLegalRoutes[documentKey], title: document.title, description: document.summary, documentKey, indexable: false, render: renderMediaLegalPage })),
  finadosEmprendedoresPage,
  emprendedorVerificationPage,
  ...['acceso', 'mi-registro', 'restablecer'].map(slug => ({ route: `/finados/emprendedores/${slug}/`, title: 'Cuenta de Emprendedor', indexable: false, render: renderEmprendedorPortalPage })),
  ...Object.entries(emprendedorLegalDocuments).map(([documentKey, document]) => ({ route: emprendedorLegalRoutes[documentKey], title: document.title, description: document.summary, documentKey, indexable: false, render: renderEmprendedorLegalPage })),
  finadosDignitiesPage,
  standsAccessPage,
  finadosNameCapturePage,
  finadosNameWritePage,
  finadosNameScreenPage,
]);
