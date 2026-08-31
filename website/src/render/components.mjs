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
