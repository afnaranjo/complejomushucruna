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
