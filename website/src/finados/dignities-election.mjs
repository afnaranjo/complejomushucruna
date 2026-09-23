import { escapeHtml } from '../render/html.mjs';

export const dignitiesAssetVersion = '20260923-dignities-4';

export const dignityCandidates = Object.freeze([
  { name: 'Golpe a Golpe', slug: 'golpe-a-golpe', category: 'rey-pan' },
  { name: 'Guaynaa', slug: 'guaynaa', category: 'rey-pan' },
  { name: 'Hueveando', slug: 'hueveando', category: 'rey-pan' },
  { name: 'Kike Jav', slug: 'kike-jav', category: 'rey-pan' },
  { name: 'Waldokinc', slug: 'waldokinc', category: 'rey-pan' },
  { name: 'William Luna', slug: 'william-luna', category: 'rey-pan' },
  { name: 'Karina Chango', slug: 'karina-chango', category: 'colada-morada' },
  { name: 'Kramelo Latino', slug: 'kramelo-latino', category: 'colada-morada' },
  { name: 'Las Diablitas Taz Taz', slug: 'las-diablitas-taz-taz', category: 'colada-morada' },
  { name: 'Las Ñañas', slug: 'las-nanas', category: 'colada-morada' },
].map(candidate => Object.freeze({
  ...candidate,
  asset: `/assets/finados/dignidades-2026/${candidate.slug}.webp`,
})));

const categories = Object.freeze([
  {
    key: 'rey-pan',
    number: '01',
    title: 'Rey Pan',
    intro: 'Seis nominados. Una corona. Elige al artista que quieres ver como próximo Rey Pan.',
  },
  {
    key: 'colada-morada',
    number: '02',
    title: 'Señorita Colada Morada',
    intro: 'Cuatro nominadas. Una tradición que se renueva contigo. Haz escuchar tu elección.',
  },
]);

function renderCandidate(candidate, index) {
  const artwork = `${candidate.asset}?v=${dignitiesAssetVersion}`;
  return `<article class="dignity-candidate" data-reveal>
    <a class="dignity-candidate__art" href="${artwork}" target="_blank" rel="noopener noreferrer" aria-label="Ampliar arte de ${escapeHtml(candidate.name)} en otra pestaña">
      <img src="${artwork}" width="1080" height="1350" alt="${escapeHtml(candidate.name)}, ${candidate.category === 'rey-pan' ? 'nominado a Rey Pan' : 'nominada a Señorita Colada Morada'} en Finados Mushuc Runa 2026" loading="lazy" decoding="async">
      <span aria-hidden="true">Ampliar ↗</span>
    </a>
    <div class="dignity-candidate__caption">
      <span>Nominación ${String(index + 1).padStart(2, '0')}</span>
      <h4>${escapeHtml(candidate.name)}</h4>
    </div>
  </article>`;
}

function renderCategory(category) {
  const candidates = dignityCandidates.filter(candidate => candidate.category === category.key);
  return `<section id="candidatos-${category.key}" class="dignity-ballot dignity-ballot--${category.key}" aria-labelledby="dignity-${category.key}-title">
    <header class="dignity-ballot__header" data-reveal>
      <span class="dignity-ballot__number">${category.number}</span>
      <div>
        <p>Elige la próxima dignidad</p>
        <h3 id="dignity-${category.key}-title">${category.title}</h3>
        <p class="dignity-ballot__intro">${category.intro}</p>
      </div>
    </header>
    <div class="dignity-candidates">
      ${candidates.map(renderCandidate).join('\n      ')}
    </div>
  </section>`;
}

export function renderDignitiesElection() {
  return `<section id="eleccion-dignidades" class="dignities-election" aria-labelledby="dignities-election-title">
    <div class="dignities-election__shell">
      <header class="dignities-election__intro" data-reveal>
        <div class="dignities-election__eyebrow"><span aria-hidden="true">♛</span> Elección Finados 2026</div>
        <h2 id="dignities-election-title"><span>Tú eliges</span> a las próximas dignidades</h2>
        <p class="dignities-election__lead">Conoce a quienes quieren llevar la corona de <strong>Rey Pan y Señorita Colada Morada</strong>. Recorre los artes, apoya a tu favorito y participa desde las publicaciones oficiales.</p>
        <div class="dignities-election__actions" aria-label="Accesos a las nominaciones">
          <a href="#candidatos-rey-pan">Conoce a quienes quieren llevar la corona</a>
          <a href="#canales">Vota en los canales oficiales <span aria-hidden="true">↓</span></a>
        </div>
        <p class="dignities-election__deadline"><span>Votaciones abiertas hasta</span><time datetime="2026-10-27">27 de octubre</time></p>
      </header>
      ${categories.map(renderCategory).join('\n      ')}
      <div class="dignities-election__closing" data-reveal>
        <p>Tu reacción y tu comentario hacen parte de esta historia.</p>
        <a href="#canales">Apoya a tu favorito <span aria-hidden="true">↓</span></a>
      </div>
    </div>
  </section>`;
}
