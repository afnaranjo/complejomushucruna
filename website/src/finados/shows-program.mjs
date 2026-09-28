// Transcribed from “Propuesta afiche artistas web - FINAL.svg”, supplied 2026-09-16.
// Editorial order follows the artwork, deliberately not chronological order.
export const showsProgram = Object.freeze([
  Object.freeze({ day: 'Domingo', date: '01', month: 'noviembre', iso: '2026-11-01', featured: true,
    artists: Object.freeze(['Waldokinc', 'Golpe a Golpe', 'Guaynaa']) }),
  Object.freeze({ day: 'Viernes', date: '30', month: 'octubre', iso: '2026-10-30',
    artists: Object.freeze(['Grupo Bodega', 'Pablo Noboa']) }),
  Object.freeze({ day: 'Sábado', date: '31', month: 'octubre', iso: '2026-10-31',
    artists: Object.freeze(['William Luna', 'Kjarkas']) }),
  Object.freeze({ day: 'Lunes', date: '02', month: 'noviembre', iso: '2026-11-02',
    artists: Object.freeze(['Cliver y su Grupo Coralí', 'Sonido Mazter', 'K’ramelo Latino']) }),
  Object.freeze({ day: 'Martes', date: '03', month: 'noviembre', iso: '2026-11-03',
    artists: Object.freeze(['El Loco Abraham']) }),
]);

// Venta oficial en Ticketstar, una página por noche, en orden cronológico. La miniatura es el arte
// oficial de cada evento en Ticketstar (1200 × 600), guardado aquí como WebP.
export const showsTickets = Object.freeze([
  Object.freeze({ iso: '2026-10-30', day: 'Viernes', date: '30', month: 'oct', url: 'https://ticketstar365.com/evento/Finados30Octubre',
    alt: 'Viernes 30 de octubre, Megaescenario 18:00: Grupo Boddega y Pablo Noboa' }),
  Object.freeze({ iso: '2026-10-31', day: 'Sábado', date: '31', month: 'oct', url: 'https://ticketstar365.com/evento/Finados31Octubre',
    alt: 'Sábado 31 de octubre, Megaescenario 18:00: William Luna, Kjarkas y Encuentro Sur' }),
  Object.freeze({ iso: '2026-11-01', day: 'Domingo', date: '01', month: 'nov', url: 'https://ticketstar365.com/evento/Finados01Noviembre',
    alt: 'Domingo 1 de noviembre, Megaescenario 18:00: Guaynaa, Waldokinc y Golpe a Golpe' }),
  Object.freeze({ iso: '2026-11-02', day: 'Lunes', date: '02', month: 'nov', url: 'https://ticketstar365.com/evento/Finados02Noviembre',
    alt: 'Lunes 2 de noviembre, Megaescenario 18:00: Sonido Mazter, Cliver y su Grupo Coralí y K’ramelo Latino' }),
  Object.freeze({ iso: '2026-11-03', day: 'Martes', date: '03', month: 'nov', url: 'https://ticketstar365.com/evento/finados03Noviembre',
    alt: 'Martes 3 de noviembre, Megaescenario 16:00: El Loco Abraham y Lorena Tonato' }),
]);

export const plazaShows = Object.freeze([
  Object.freeze({ artist: 'Hueveando', date: '03 noviembre', iso: '2026-11-03' }),
  Object.freeze({ artist: 'Las Ñañas', date: '01 noviembre', iso: '2026-11-01' }),
]);

export const showsAttractions = Object.freeze([
  '+500 stands · Gastronomía',
  'Dinosaurios · Show de alta escuela',
  'Juegos mecánicos · Resbaladera gigante',
  'Granja turística',
]);

export { finadosSponsors as showsSponsors } from './sponsors.mjs';
