import { escapeHtml, externalAttributes } from './html.mjs';

export function hero({ eyebrow, heading, intro, image = '' }) {
  const style = image ? ` style="--hero-image: url('${escapeHtml(image)}')"` : '';
  return `<section class="hero"${style}>
    <div class="hero__content shell">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(heading)}</h1>
      <p class="hero__intro">${escapeHtml(intro)}</p>
      <div class="hero__actions">
        <a class="button button--gold" href="/visitanos/">Planifica tu visita</a>
        <a class="button button--ghost" href="/experiencias/">Descubre el Complejo</a>
      </div>
    </div>
  </section>`;
}

export function proseSection({ eyebrow, heading, paragraphs }) {
  return `<section class="section shell section--prose">
    <header class="section-heading">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h2>${escapeHtml(heading)}</h2>
    </header>
    <div class="prose">${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}</div>
  </section>`;
}

export function linkList(items, className = 'link-list') {
  return `<ul class="${escapeHtml(className)}">${items.map((item) => `<li><a href="${escapeHtml(item.href)}"${externalAttributes(item.href)}>${escapeHtml(item.label)}</a></li>`).join('')}</ul>`;
}

export function archiveList(events) {
  return `<ol class="event-timeline">${events.map((event) => `<li class="event-timeline__item">
    <p class="event-timeline__year">${event.year}</p>
    <div>
      <p class="status-label">${escapeHtml(event.status)}</p>
      <h2><a href="/eventos/archivo/${escapeHtml(event.slug)}/">${escapeHtml(event.title)}</a></h2>
      <p>${escapeHtml(event.summary)}</p>
    </div>
  </li>`).join('')}</ol>`;
}

export function sectionHeading({ eyebrow, heading, intro = '' }) {
  return `<header class="section-heading" data-reveal>
    <p class="eyebrow">${escapeHtml(eyebrow)}</p>
    <h2>${escapeHtml(heading)}</h2>
    ${intro ? `<p>${escapeHtml(intro)}</p>` : ''}
  </header>`;
}

export function editorial({ eyebrow, heading, paragraphs, image, alt, reverse = false, accent = '' }) {
  return `<section class="section shell editorial${reverse ? ' editorial--reverse' : ''}" data-reveal>
    <figure class="editorial__media"><img src="${escapeHtml(image)}" alt="${escapeHtml(alt)}" width="1200" height="900" loading="lazy"></figure>
    <div class="editorial__copy">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h2>${escapeHtml(heading)}</h2>
      ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('')}
      ${accent ? `<span class="hand-accent">${escapeHtml(accent)}</span>` : ''}
    </div>
  </section>`;
}

export function experienceIndex(experiences) {
  return `<div class="experience-index">${experiences.map((experience, index) => `<article class="experience-feature" data-reveal>
    <div class="experience-feature__media"><img src="${escapeHtml(experience.image)}" alt="${escapeHtml(experience.name)} en el Complejo Mushuc Runa" width="1200" height="900" loading="lazy"></div>
    <div class="experience-feature__copy">
      <p class="experience-feature__number">${String(index + 1).padStart(2, '0')}</p>
      <h2>${escapeHtml(experience.name)}</h2>
      <p>${escapeHtml(experience.description)}</p>
      <p class="status-label">${escapeHtml(experience.status)}</p>
    </div>
  </article>`).join('')}</div>`;
}

export function institutionalHighlights(highlights) {
  return `<section class="section current-section">
    <div class="shell">
      ${sectionHeading({
        eyebrow: 'Actualidad institucional',
        heading: 'Un Complejo preparado para grandes encuentros',
        intro: 'La portada institucional más reciente pone en primer plano su infraestructura, capacidad de convocatoria y compromiso con la comunidad.',
      })}
      <div class="current-highlights">${highlights.map((highlight, index) => `<article class="current-highlight" data-reveal>
        <figure class="current-highlight__media"><img src="${escapeHtml(highlight.image)}" alt="${escapeHtml(highlight.alt)}" width="1024" height="640" loading="${index === 0 ? 'eager' : 'lazy'}"></figure>
        <div class="current-highlight__copy">
          <p class="current-highlight__number">${String(index + 1).padStart(2, '0')}</p>
          <h3>${escapeHtml(highlight.title)}</h3>
          <p>${escapeHtml(highlight.description)}</p>
        </div>
      </article>`).join('')}</div>
    </div>
  </section>`;
}

export function heritageQuote(quote, citation) {
  return `<section class="heritage-band"><div class="shell" data-reveal><blockquote>“${escapeHtml(quote)}”<cite>${escapeHtml(citation)}</cite></blockquote></div></section>`;
}

export function categoryField(categories) {
  return `<ul class="category-field">${categories.map((category) => `<li data-reveal>${escapeHtml(category)}</li>`).join('')}</ul>`;
}

export function visitPanel({ routes, tourUrl }) {
  return `<section class="section shell"><div class="visit-panel" data-reveal>
    <div>
      <p class="eyebrow">Cómo llegar</p>
      <h2>Dos rutas para encontrarnos</h2>
      <p>Desde el lugar en donde te encuentres, abre una de las referencias publicadas y continúa el recorrido con el GPS de tu dispositivo.</p>
      <div class="button-row"><a class="button button--red" href="${escapeHtml(tourUrl)}"${externalAttributes(tourUrl)}>Abrir tour virtual</a></div>
    </div>
    <ol class="route-list">${routes.map((route) => `<li><a href="${escapeHtml(route.href)}"${externalAttributes(route.href)}>${escapeHtml(route.label)}</a><p>${escapeHtml(route.description)}</p></li>`).join('')}</ol>
  </div></section>`;
}

export function archiveArticle(texts) {
  return `<section class="section shell"><article class="archive-copy" data-reveal>
    <aside class="archive-warning"><strong>Archivo histórico.</strong> Este contenido conserva la memoria de una edición anterior. Fechas, precios, inscripciones y enlaces comerciales ya no están vigentes.</aside>
    <h2>Contenido original recuperado</h2>
    ${texts.map((text) => `<p>${escapeHtml(text)}</p>`).join('')}
  </article></section>`;
}
