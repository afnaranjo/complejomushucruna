import { escapeHtml } from '../render/html.mjs';

export const sponsorAssetVersion = '20260922-sponsors-5';
export const finadosSponsors = Object.freeze([
  'Mushuc Runa Cooperativa de Ahorro y Crédito',
  'Pushak Ltda. Cooperativa de Ahorro y Crédito',
  'Seguros Unidos',
  'Credi Fácil Ltda. Cooperativa de Ahorro y Crédito',
  'Cogarol',
  'Whisky John Morris',
  'Tequila Azteca',
  'Textilana Cooperativa de Ahorro y Crédito',
  'Óptica Interandina',
  'Mutualista Ambato',
  'Pollos al Gusto',
]);

export function renderFinadosSponsors() {
  const artwork = `/assets/finados/shows/auspiciantes-finados-2026.webp?v=${sponsorAssetVersion}`;
  return `<section class="finados-sponsors" aria-labelledby="finados-sponsors-title">
    <h2 id="finados-sponsors-title" class="sr-only">Organizador y auspiciantes</h2>
    <a class="finados-sponsors-art" href="${artwork}" target="_blank" rel="noopener noreferrer" aria-label="Ampliar composición oficial de organizador y auspiciantes en otra pestaña">
      <img src="${artwork}" width="2321" height="650" alt="Organiza: Luis Alfonso Chango P. Auspician: ${escapeHtml(finadosSponsors.join('; '))}. Composición oficial con cenefa, organizador centrado y logos en su orden original." loading="lazy" decoding="async">
    </a>
  </section>`;
}
