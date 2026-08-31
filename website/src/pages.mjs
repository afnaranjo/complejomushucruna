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
  institutionalHighlights,
  sectionHeading,
  visitPanel,
} from './render/components.mjs';
import { renderFinadosPage } from './finados/page.mjs';

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

const mainPages = [
  {
    route: '/',
    title: site.name,
    description: `${site.legalName}: cultura, naturaleza, recreación y encuentros en Tungurahua.`,
    body: hero({
      eyebrow: 'Santa Lucía · Tisaleo · Tungurahua',
      heading: site.tagline,
      intro: 'Un territorio para encontrarnos con la cultura, la naturaleza, el deporte y la alegría de compartir.',
      image: '/assets/images/hero-complejo.webp',
    }) + institutionalHighlights(currentHighlights) + editorial({
      eyebrow: 'Bienvenidos',
      heading: 'Un lugar con identidad propia',
      paragraphs: [
        'El Complejo Mushuc Runa reúne experiencias culturales, recreativas y deportivas en un entorno andino de gran escala.',
        'Aquí, el paisaje y la memoria de los pueblos dialogan con espacios creados para el encuentro de familias, visitantes y comunidades.',
      ],
      image: '/assets/images/complejo-carihuayrazo.webp',
      alt: 'Vista panorámica del Complejo Mushuc Runa y el paisaje de Tungurahua',
      accent: 'Mushuc Runa',
    }) + `<section class="section shell section--compact">${sectionHeading({
      eyebrow: 'Explora',
      heading: 'Muchas formas de vivir el Complejo',
      intro: 'Recuperamos las experiencias documentadas en el sitio anterior y señalamos con transparencia cuáles necesitan confirmación de disponibilidad.',
    })}${experienceIndex(experiences.slice(0, 3))}<div class="button-row"><a class="button button--red" href="/experiencias/">Ver todas las experiencias</a></div></section>` + heritageQuote(
      'Un espacio donde identidad, comunidad y territorio vuelven a encontrarse.',
      'Complejo Intercultural y Deportivo Mushuc Runa',
    ) + `<section class="section shell">${sectionHeading({
      eyebrow: 'Memoria viva',
      heading: 'Eventos que forman parte de nuestra historia',
      intro: 'El archivo conserva las páginas publicadas de ferias y celebraciones anteriores sin presentar sus ofertas como vigentes.',
    })}${archiveList(historicalEvents.slice(-3))}<div class="button-row"><a class="button button--red" href="/eventos/">Explorar el archivo</a></div></section>` + visitPanel({ routes: routeOptions, tourUrl: site.tourUrl }),
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

export const pages = Object.freeze([...mainPages, ...archivePages, finadosPreview]);
