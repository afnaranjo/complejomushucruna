export const site = Object.freeze({
  name: 'Complejo Mushuc Runa',
  legalName: 'Complejo Intercultural y Deportivo Mushuc Runa',
  tagline: '¡Cultura y diversión en un solo lugar!',
  baseUrl: 'https://complejomushucruna.com',
  description: 'Un espacio intercultural, deportivo y recreativo en Tisaleo, Tungurahua.',
  tourUrl: 'https://guiap.com/360/mr2023-2024/',
});

export const primaryNavigation = Object.freeze([
  { label: 'Inicio', href: '/' },
  { label: 'Experiencias', href: '/experiencias/' },
  { label: 'Granja', href: '/granja/' },
  { label: 'Eventos', href: '/eventos/' },
  { label: 'Historia', href: '/historia/' },
  { label: 'Visítanos', href: '/visitanos/' },
]);

export const socialLinks = Object.freeze([
  { label: 'Facebook', href: 'https://www.facebook.com/complejomushucruna' },
  { label: 'X', href: 'https://twitter.com/complejomushuc_' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@complejomushucruna_' },
]);

export const experiences = Object.freeze([
  {
    name: 'Mushuc Park',
    description: 'Una experiencia recreativa para compartir en familia, recuperada del recorrido institucional del Complejo.',
    status: 'Disponibilidad por confirmar',
    image: '/assets/images/mushuc-park.webp',
  },
  {
    name: 'Granja Agroturística',
    description: 'Un espacio de acercamiento al entorno rural y a distintas especies de la granja.',
    status: 'Experiencia histórica documentada',
    image: '/assets/images/granja.webp',
  },
  {
    name: 'Cabalgatas',
    description: 'Una de las actividades presentadas históricamente dentro de la oferta del Complejo.',
    status: 'Disponibilidad por confirmar',
    image: '/assets/images/cabalgatas.webp',
  },
  {
    name: 'Piscina',
    description: 'Zona recreativa incluida en la comunicación histórica del Complejo.',
    status: 'Disponibilidad por confirmar',
    image: '/assets/images/piscina.webp',
  },
  {
    name: 'Tren',
    description: 'Recorrido familiar registrado en el sitio institucional anterior.',
    status: 'Disponibilidad por confirmar',
    image: '/assets/images/tren.webp',
  },
  {
    name: 'Pesca',
    description: 'Actividad vinculada al entorno natural en la presentación histórica del Complejo.',
    status: 'Disponibilidad por confirmar',
    image: '/assets/images/pesca.webp',
  },
]);

export const currentHighlights = Object.freeze([
  {
    title: 'Más de 10 mil parqueaderos',
    description: '¡Tu comodidad es primero! La portada institucional más reciente destaca más de 10.000 parqueaderos habilitados para facilitar la llegada y disfrutar de los encuentros del Complejo con mayor tranquilidad.',
    image: '/assets/images/actual/parqueaderos.webp',
    alt: 'Vista aérea del Complejo Mushuc Runa con sus zonas de parqueadero y megaescenario',
  },
  {
    title: 'El Megaescenario',
    description: 'El corazón de los eventos feriales del Complejo integra luces, pantallas gigantes y sonido para recibir espectáculos culturales y musicales de gran escala en la zona centro del Ecuador.',
    image: '/assets/images/actual/megaescenario.webp',
    alt: 'Megaescenario del Complejo Mushuc Runa durante un espectáculo nocturno',
  },
  {
    title: 'Responsabilidad social',
    description: 'Celebrar también significa compartir, cuidar y dejar una huella positiva: el Complejo comunica iniciativas de apoyo comunitario, reciclaje y prácticas sostenibles durante sus eventos.',
    image: '/assets/images/actual/responsabilidad-social.webp',
    alt: 'Representantes comunitarios e institucionales reunidos en el Complejo Mushuc Runa',
  },
]);

export const farmCategories = Object.freeze([
  'Aves',
  'Conejos',
  'Cuyes',
  'Ganado vacuno',
  'Mulas y burros',
  'Caballos y ponis',
  'Ovinos y porcinos',
]);

export const historicalEvents = Object.freeze([
  {
    slug: 'finados-2021',
    title: 'Finados 2021',
    year: 2021,
    sourceId: 1771,
    status: 'Archivo histórico',
    activeCommerceUrl: null,
    summary: 'Memoria visual y audiovisual de la edición de Finados 2021.',
  },
  {
    slug: 'finados-2022',
    title: 'Finados 2022',
    year: 2022,
    sourceId: 1405,
    status: 'Archivo histórico',
    activeCommerceUrl: null,
    summary: 'Programación, rutas y recuerdos publicados para Finados 2022.',
  },
  {
    slug: 'festival-de-canto',
    title: 'Festival de Canto',
    year: 2022,
    sourceId: 1279,
    status: 'Archivo histórico',
    activeCommerceUrl: null,
    summary: 'Archivo de participantes, jueces y piezas del Festival de Canto.',
  },
  {
    slug: 'finados-2023',
    title: 'Finados 2023',
    year: 2023,
    sourceId: 1929,
    status: 'Archivo histórico',
    activeCommerceUrl: null,
    summary: 'Recorrido por la feria, sus experiencias y auspiciantes publicados en 2023.',
  },
  {
    slug: 'toros',
    title: 'Toros',
    year: 2023,
    sourceId: 1588,
    status: 'Archivo histórico',
    activeCommerceUrl: null,
    summary: 'Página histórica recuperada del calendario de eventos del Complejo.',
  },
  {
    slug: 'finados-2025',
    title: 'Finados 2025',
    year: 2025,
    sourceId: 2919,
    status: 'Archivo histórico',
    activeCommerceUrl: null,
    summary: 'Memoria de la feria y de sus principales experiencias publicadas en 2025.',
  },
  {
    slug: 'navidad-2025',
    title: 'Navidad 2025',
    year: 2025,
    sourceId: 2991,
    status: 'Archivo histórico',
    activeCommerceUrl: null,
    summary: 'Archivo visual de la programación navideña presentada en el sitio anterior.',
  },
]);

export const routeOptions = Object.freeze([
  {
    label: 'Ruta principal',
    href: 'https://maps.app.goo.gl/xCssCeX8vNTH3m666',
    description: 'Referencia recuperada para llegar al Complejo desde Ambato y la vía a Riobamba.',
  },
  {
    label: 'Ruta alternativa',
    href: 'https://maps.app.goo.gl/HqXS9vxJnXTULzQo6',
    description: 'Segunda referencia de acceso publicada en la página Ubícanos.',
  },
]);

export const assetManifest = Object.freeze([
  { path: '/assets/icons/favicon.svg', kind: 'icon' },
  { path: '/assets/images/logo-complejo-dorado.png', kind: 'logo' },
  { path: '/assets/images/patron-mushuc.png', kind: 'pattern' },
  { path: '/assets/images/hero-complejo.webp', kind: 'image' },
  { path: '/assets/images/actual/parqueaderos.webp', kind: 'image' },
  { path: '/assets/images/actual/megaescenario.webp', kind: 'image' },
  { path: '/assets/images/actual/responsabilidad-social.webp', kind: 'image' },
  { path: '/assets/images/complejo-carihuayrazo.webp', kind: 'image' },
  { path: '/assets/images/vista-aerea.webp', kind: 'image' },
  { path: '/assets/images/historia-aerea.webp', kind: 'image' },
  { path: '/assets/images/mushuc-park.webp', kind: 'image' },
  { path: '/assets/images/granja.webp', kind: 'image' },
  { path: '/assets/images/granja-detalle.webp', kind: 'image' },
  { path: '/assets/images/cabalgatas.webp', kind: 'image' },
  { path: '/assets/images/piscina.webp', kind: 'image' },
  { path: '/assets/images/tren.webp', kind: 'image' },
  { path: '/assets/images/pesca.webp', kind: 'image' },
  { path: '/assets/images/ubicacion.webp', kind: 'image' },
  { path: '/assets/images/hero-eventos.webp', kind: 'image' },
  { path: '/assets/images/events/finados-2021.webp', kind: 'historical-image' },
  { path: '/assets/images/events/finados-2022.webp', kind: 'historical-image' },
  { path: '/assets/images/events/festival-canto.webp', kind: 'historical-image' },
  { path: '/assets/images/events/finados-2023.webp', kind: 'historical-image' },
  { path: '/assets/images/events/toros.webp', kind: 'historical-image' },
  { path: '/assets/images/events/finados-2025.webp', kind: 'historical-image' },
  { path: '/assets/images/events/navidad-2025.webp', kind: 'historical-image' },
  { path: '/assets/finados/logo-finados.svg', kind: 'campaign-logo' },
  { path: '/assets/finados/icons/crecimiento.svg', kind: 'campaign-icon' },
  { path: '/assets/finados/icons/encuentro.svg', kind: 'campaign-icon' },
  { path: '/assets/finados/icons/espectador.svg', kind: 'campaign-icon' },
  { path: '/assets/finados/icons/legado.svg', kind: 'campaign-icon' },
  { path: '/assets/finados/hero-artista-mock.webp', kind: 'concept-image' },
  { path: '/assets/finados/hero-artista-mock-960.webp', kind: 'concept-image' },
  { path: '/assets/finados/fonts/anton-latin.woff2', kind: 'campaign-font' },
  { path: '/assets/finados/fonts/dm-serif-display-italic-latin.woff2', kind: 'campaign-font' },
  { path: '/assets/finados/fonts/dm-serif-display-latin.woff2', kind: 'campaign-font' },
  { path: '/assets/finados/fonts/inter-variable-latin.woff2', kind: 'campaign-font' },
  { path: '/assets/fonts/montserrat.woff2', kind: 'font' },
  { path: '/assets/fonts/roboto.woff2', kind: 'font' },
  { path: '/assets/fonts/roboto-slab.woff2', kind: 'font' },
  { path: '/assets/fonts/handgoal.ttf', kind: 'font' },
]);
