import { historicalEvents, site } from './data/site.mjs';
import { archiveList, hero, proseSection } from './render/components.mjs';

const mainPages = [
  {
    route: '/',
    title: site.name,
    description: `${site.legalName}: cultura, naturaleza, recreación y encuentros en Tungurahua.`,
    body: hero({
      eyebrow: 'Tisaleo · Tungurahua',
      heading: site.tagline,
      intro: 'Un territorio para encontrarnos con la cultura, la naturaleza, el deporte y la alegría de compartir.',
      image: '/assets/images/hero-complejo.webp',
    }) + proseSection({
      eyebrow: 'Bienvenidos',
      heading: 'Un lugar con identidad propia',
      paragraphs: ['El Complejo Mushuc Runa reúne experiencias culturales, recreativas y deportivas en un entorno andino de gran escala.'],
    }),
  },
  {
    route: '/experiencias/',
    title: 'Experiencias',
    description: 'Conoce las experiencias y atractivos documentados del Complejo Mushuc Runa.',
    body: hero({ eyebrow: 'Descubre', heading: 'Experiencias para compartir', intro: 'Naturaleza, recreación y memoria cultural en un solo territorio.' }),
  },
  {
    route: '/granja/',
    title: 'Granja Agroturística',
    description: 'Conoce la Granja Agroturística del Complejo Mushuc Runa y sus categorías históricas.',
    body: hero({ eyebrow: 'Naturaleza', heading: 'Granja Agroturística', intro: 'Un encuentro cercano con el entorno rural y sus especies.' }),
  },
  {
    route: '/eventos/',
    title: 'Eventos',
    description: 'Explora el archivo histórico de eventos realizados en el Complejo Mushuc Runa.',
    body: hero({ eyebrow: 'Memoria viva', heading: 'Eventos que nos reúnen', intro: 'Un archivo de celebraciones, ferias y encuentros que forman parte de nuestra historia.' }) + `<section class="section shell">${archiveList(historicalEvents)}</section>`,
  },
  {
    route: '/historia/',
    title: 'Historia',
    description: 'Conoce la historia del Complejo Intercultural y Deportivo Mushuc Runa.',
    body: hero({ eyebrow: 'Nuestra raíz', heading: 'Historia', intro: 'Una visión nacida para unir identidad, comunidad, deporte y desarrollo.' }),
  },
  {
    route: '/visitanos/',
    title: 'Visítanos',
    description: 'Encuentra las rutas publicadas para llegar al Complejo Mushuc Runa en Tisaleo, Tungurahua.',
    body: hero({ eyebrow: 'Planifica', heading: 'Visítanos', intro: 'Consulta las rutas de llegada y prepara tu recorrido antes de viajar.' }),
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
  }) + proseSection({
    eyebrow: 'Memoria del Complejo',
    heading: 'Contenido preservado',
    paragraphs: ['Esta página conserva la referencia histórica del evento. Las fechas, precios, inscripciones y enlaces comerciales de esa edición ya no están vigentes.'],
  }),
}));

export const pages = Object.freeze([...mainPages, ...archivePages]);
