import { routeOptions } from '../data/site.mjs';
import { escapeHtml, externalAttributes } from '../render/html.mjs';
import { PRESENTATION_AT, PRESENTATION_WELCOME } from './presentation.js';

export const openingAssetVersion = '20260917-fair-start-1';

export function renderOpeningAssets() {
  return `<link rel="stylesheet" href="/assets/finados/presentation.css?v=${openingAssetVersion}">
  <script type="module" src="/assets/finados/presentation.js?v=${openingAssetVersion}"></script>`;
}

// Absolute Ecuador date, rendered deterministically. Each page has only one clock.
export function renderFairOpeningHeader({ compact = false, standalone = false, id = 'inicio', titleId = 'presentation-title' } = {}) {
  const tag = compact ? 'h2' : 'h1';
  const map = routeOptions[0].href;
  return `<section id="${escapeHtml(id)}" class="presentation-hero${compact ? ' presentation-hero--compact' : ''}${standalone ? ' presentation-hero--standalone' : ''}" data-fair-opening aria-labelledby="${escapeHtml(titleId)}">
      <div class="presentation-shell">
        <div class="presentation-copy">
          <p class="presentation-kicker">${compact ? 'Inicio de la feria · Edición 2026' : 'Mushuc Runa · ¡Legado que nos une!'}</p>
          <${tag} id="${escapeHtml(titleId)}" class="presentation-title"><span>Bienvenidos a</span><span class="presentation-event-name">Finados Mushuc Runa <em>2026</em></span></${tag}>
          <p class="presentation-date"><time datetime="${PRESENTATION_AT}">Viernes 30 de octubre de 2026</time><strong>10:30 <span>AM</span></strong><span class="presentation-timezone">Hora de Ecuador</span></p>
          ${compact ? '' : '<p class="presentation-location">Complejo Intercultural y Deportivo <strong>MUSHUC RUNA</strong></p>'}
          <a class="presentation-map" href="${escapeHtml(map)}"${externalAttributes(map)}>Mapa de ubicación <span aria-hidden="true">↗</span><span class="presentation-sr-only"> (se abre en otra pestaña)</span></a>
        </div>
        <div class="presentation-timer-wrap">
          ${compact ? '' : '<img class="presentation-symbol" src="/assets/finados/icons/legado.svg?v=20260903" width="899" height="969" alt="" aria-hidden="true">'}
          <div class="presentation-countdown" data-presentation-countdown data-target="${PRESENTATION_AT}">
            <p class="presentation-countdown-label" data-presentation-label>La feria comienza en</p>
            <div class="presentation-clock" data-presentation-clock aria-hidden="true" hidden>
              ${[['days', 'Días'], ['hours', 'Horas'], ['minutes', 'Minutos'], ['seconds', 'Segundos']].map(([key, label]) => `<div class="presentation-unit"><strong data-presentation-value="${key}">00</strong><span>${label}</span></div>`).join('')}
            </div>
            <p class="presentation-fallback" data-presentation-fallback>30 de octubre de 2026 · 10:30 AM (hora de Ecuador)</p>
            <p class="presentation-welcome" data-presentation-welcome hidden>${PRESENTATION_WELCOME}</p>
            <span class="presentation-sr-only" aria-live="polite" aria-atomic="true" data-presentation-status>La feria Finados Mushuc Runa 2026 inicia el viernes 30 de octubre a las 10:30, hora de Ecuador.</span>
          </div>
        </div>
      </div>
      <div class="presentation-weave" aria-hidden="true"></div>
    </section>`;
}

// This frozen export replaces its document after unpacking. Preserve the header
// in that final document without changing the encoded RSVP application.
export function injectInvitationOpeningHeader(html, route) {
  if (route !== '/invitaciones/' || html.includes('data-fair-opening')) return html;
  const anchor = "const doc = new DOMParser().parseFromString(template, 'text/html');";
  if (!html.includes(anchor)) throw new Error('No se encontró el punto de integración de la cabecera de Invitaciones.');
  const header = renderFairOpeningHeader({ compact: true, standalone: true, id: 'inicio-feria', titleId: 'inicio-feria-title' });
  return html
    .replace(/<\/head>/i, `<meta name="viewport" content="width=device-width, initial-scale=1">\n<link data-fair-opening-styles rel="stylesheet" href="/assets/finados/presentation.css?v=${openingAssetVersion}">\n</head>`)
    .replace(/<body\b[^>]*>/i, match => `${match}\n${header}`)
    .replace(anchor, `${anchor}
    const fairHeader = document.querySelector('[data-fair-opening]');
    if (fairHeader) {
      doc.body.prepend(fairHeader.cloneNode(true));
      doc.head.append(document.querySelector('[data-fair-opening-styles]').cloneNode(true));
      const fairRuntime = doc.createElement('script');
      fairRuntime.type = 'module';
      fairRuntime.src = '/assets/finados/presentation.js?v=${openingAssetVersion}';
      doc.head.append(fairRuntime);
    }`);
}
