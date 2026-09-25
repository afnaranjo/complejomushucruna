import { resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
// The panel reuses the administrative client: same allowlist, same CSRF handling, one bundle less.
import { createMediaAdminClient } from './admin-medios.js?v=20260924-admin-medios-21';
import './sidebar.js?v=20260923-admin-sidebar-1';
import './campaign-banner.js?v=20260923-noticias-1';

const LOCAL_API = 'http://127.0.0.1:4174/api';

/** Every card keeps the list behind its figure, so a click only expands what is already loaded. */
export function panelCards(section = {}) {
  return (section.cards ?? []).map(card => ({ key: String(card.key ?? ''), label: String(card.label ?? ''), items: Array.isArray(card.items) ? card.items : [], count: Array.isArray(card.items) ? card.items.length : 0 }));
}

export function eventLabel(event = {}) {
  const date = typeof event.event_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.event_date)
    ? new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${event.event_date}T00:00:00Z`))
    : 'Fecha por confirmar';
  return [date, event.place].filter(Boolean).join(' · ');
}


/** «12 h 30 min», «45 min» o «0 h». */
export function formatHours(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60), rest = total % 60;
  if (!hours && !rest) return '0 h';
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** Las horas de los turnos se guardan en hora de Ecuador, sin convertir. */
export function shiftWhen(startsAt, endsAt) {
  const start = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(startsAt ?? ''));
  const end = /[ T](\d{2}):(\d{2})/.exec(String(endsAt ?? ''));
  if (!start) return '—';
  const [, year, month, day, hour, minute] = start;
  const date = new Intl.DateTimeFormat('es-EC', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(+year, +month - 1, +day)));
  return `${date} · ${hour}:${minute}${end ? `–${end[1]}:${end[2]}` : ''}`;
}

const CONTENT_KINDS = Object.freeze({ video: 'Video', live: 'En vivo', historia: 'Historia', foto: 'Fotografía', otro: 'Otro' });

/** Totales del equipo, en el orden en que se leen. */
export function creadoraTotals(data = {}) {
  const totals = data.totals ?? {};
  return [
    ['Creadoras', totals.creadoras ?? (data.people ?? []).length],
    ['Horas asistidas', formatHours(totals.attended_minutes)],
    ['Turnos', totals.shifts ?? 0],
    ['Asistencias', totals.attended ?? 0],
    ['Guiones grabados', `${totals.recorded ?? 0} de ${totals.scripts ?? 0}`],
    ['Videos', totals.videos ?? 0],
    ['Contenido total', totals.content ?? 0],
  ];
}


/* ---------- Redes sociales (Metricool, solo Finados Mushuc Runa) ---------- */

/** Fecha de hoy en Ecuador, AAAA-MM-DD. */
export function ecuadorToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Los últimos `days` días hasta `today`, ambos incluidos. */
export function lastDays(days, today = ecuadorToday()) {
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  return { from: start.toISOString().slice(0, 10), to: today };
}

/** Compara con el periodo anterior. `good` dice si el cambio es bueno para la campaña. */
export function socialDelta(current, previous, { lowerIsBetter = false } = {}) {
  if (current === null || current === undefined || previous === null || previous === undefined) return { direction: null, pct: null, good: null };
  if (previous === 0) return current === 0 ? { direction: 'flat', pct: 0, good: null } : { direction: 'new', pct: null, good: lowerIsBetter ? null : current > 0 };
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  if (Math.abs(pct) < 1) return { direction: 'flat', pct, good: null };
  const up = pct > 0;
  return { direction: up ? 'up' : 'down', pct, good: lowerIsBetter ? !up : up };
}

const number = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 3 });
export function formatSocial(value, kind = 'number') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  if (kind === 'money') return money.format(value);
  if (kind === 'pct') return `${decimal.format(value)} %`;
  if (kind === 'signed') return `${value > 0 ? '+' : ''}${number.format(value)}`;
  return number.format(value);
}


/** Texto corto de la comparación: los saltos grandes se leen mejor como «×12» que como «1.100 %». */
export function socialDeltaText(delta, current, previous, kind = 'number') {
  if (delta.direction === null) return 'Sin comparación';
  if (delta.direction === 'new') return '▲ Nuevo';
  if (delta.direction === 'flat') return '＝ Igual';
  const arrow = delta.direction === 'up' ? '▲' : '▼';
  if (previous < 0 || current < 0) return `${arrow} antes ${formatSocial(previous, kind === 'number' ? 'signed' : kind)}`;
  if (delta.pct >= 100) return `${arrow} ×${decimal.format(Math.round((current / previous) * 10) / 10)}`;
  return `${arrow} ${formatSocial(Math.abs(delta.pct), 'pct')}`;
}

export const SOCIAL_METRIC_LABELS = Object.freeze({
  gained: ['Nuevos seguidores', 'number'], lost: ['Dejaron de seguir', 'number', true], reach: ['Alcance (suma diaria)', 'number'],
  views: ['Vistas', 'number'], profile_views: ['Visitas al perfil', 'number'], accounts_engaged: ['Cuentas que interactuaron', 'number'],
  interactions: ['Interacciones', 'number'], posts: ['Publicaciones', 'number'], engagement_rate: ['Interacción por vista', 'pct'],
});

/** Mejorando, empeorando o mixto: seguidores netos, vistas e interacciones frente al periodo anterior. */
export function socialVerdict(network = {}) {
  const followers = network.followers ?? {};
  const metrics = network.metrics ?? {};
  const signals = [
    socialDelta(followers.net, followers.previous_net),
    socialDelta(metrics.views?.current, metrics.views?.previous),
    socialDelta(metrics.interactions?.current, metrics.interactions?.previous),
  ].map(delta => delta.good === true ? 1 : delta.good === false ? -1 : 0);
  const score = signals.reduce((a, b) => a + b, 0);
  if (signals.every(signal => signal === 0)) return { key: 'unknown', label: 'Sin comparación' };
  if (score >= 2) return { key: 'up', label: 'Mejorando' };
  if (score <= -2) return { key: 'down', label: 'Empeorando' };
  return { key: 'mixed', label: 'Mixto' };
}

/** Frases cortas para decidir, calculadas solo con los datos del periodo. */
export function socialInsights(report = {}) {
  const out = [];
  const networks = (report.networks ?? []).filter(network => network.followers?.end !== null && network.followers?.end !== undefined);
  const growing = networks.filter(network => network.followers.growth_pct !== null).sort((a, b) => b.followers.growth_pct - a.followers.growth_pct);
  if (growing[0] && growing[0].followers.growth_pct > 0) out.push(`${growing[0].label} es la red que más crece: ${formatSocial(growing[0].followers.net, 'signed')} seguidores (${formatSocial(growing[0].followers.growth_pct, 'pct')}).`);
  for (const network of networks) if (network.followers.net < 0) out.push(`${network.label} perdió ${formatSocial(-network.followers.net)} seguidores en el periodo. Revisa qué se publicó ahí.`);
  for (const network of report.networks ?? []) {
    const rate = network.metrics?.engagement_rate, views = network.metrics?.views;
    if (rate?.current != null && rate?.previous != null && rate.current < rate.previous && socialDelta(views?.current, views?.previous).good) {
      out.push(`${network.label}: más vistas, pero menos interacción por vista (${formatSocial(rate.current, 'pct')} frente a ${formatSocial(rate.previous, 'pct')}). El alcance sube; el contenido engancha menos.`);
    }
  }
  const cost = report.totals?.cost_per_follower;
  if (cost?.current != null) {
    const delta = socialDelta(cost.current, cost.previous, { lowerIsBetter: true });
    out.push(`Cada nuevo seguidor costó en promedio ${formatSocial(cost.current, 'money')} de pauta${delta.direction === 'up' || delta.direction === 'down' ? ` (${delta.good ? 'más barato' : 'más caro'} que el periodo anterior)` : ''}. Es aproximado: incluye seguidores orgánicos.`);
  }
  const ctr = report.ads?.current?.ctr, previousCtr = report.ads?.previous?.ctr;
  if (ctr != null && previousCtr != null) {
    const delta = socialDelta(ctr, previousCtr);
    if (delta.good === false) out.push(`La pauta recibe menos clics por impresión (CTR ${formatSocial(ctr, 'pct')} frente a ${formatSocial(previousCtr, 'pct')}). Conviene renovar las piezas.`);
  }
  if (report.incomplete) out.push('Algunas métricas no respondieron en Metricool; las cifras con «—» no están disponibles.');
  return out;
}

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}

export async function initializeAdminPanel() {
  const panel = document.querySelector('[data-admin-panel]');
  if (!panel) return;
  const navigation = document.querySelector('[data-admin-navigation]');
  const compact = globalThis.matchMedia?.('(max-width: 1120px)');
  const applyNavigation = value => { if (navigation) navigation.open = !value; };
  applyNavigation(compact?.matches ?? false);
  compact?.addEventListener('change', event => applyNavigation(event.matches));
  const query = selector => panel.querySelector(selector);
  const status = query('[data-admin-feedback]');
  const retry = query('[data-session-retry]');
  const configuredBase = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredBase || runtime.apiBase;
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) { status.textContent = 'La configuración de acceso no es válida.'; status.dataset.error = 'true'; return; }
  const client = createMediaAdminClient(base);
  const logout = document.querySelector('[data-admin-logout]');
  const sidebarUser = document.querySelector('[data-admin-sidebar-user]');
  const feedback = (element, message, kind = '') => { element.textContent = message; element.dataset.error = String(kind === 'error'); element.dataset.success = String(kind === 'success'); };
  const fail = error => { if (error.status === 401) { location.replace('/admin/'); return; } feedback(status, error.message, 'error'); };

  /** A group of figures with one shared, collapsed list underneath. */
  function renderGroup(container, cards, { detailLink = null } = {}) {
    container.replaceChildren();
    if (!cards.length) { container.append(node('p', 'Todavía no hay datos.', 'admin-panel-empty')); return; }
    const numbers = node('div', undefined, 'admin-big-numbers');
    const drawer = node('section', undefined, 'admin-panel-drawer');
    drawer.hidden = true;
    let active = '';
    const close = () => { active = ''; drawer.hidden = true; drawer.replaceChildren(); for (const button of numbers.querySelectorAll('button')) button.setAttribute('aria-pressed', 'false'); };
    for (const card of cards) {
      const button = node('button', undefined, 'admin-big-number'); button.type = 'button';
      button.dataset.bucket = card.key; button.setAttribute('aria-pressed', 'false');
      button.dataset.alert = String(card.key.includes('sin_publicacion') || card.key === 'no_asistieron');
      button.append(node('strong', String(card.count)), node('span', card.label));
      button.addEventListener('click', () => {
        if (active === card.key) { close(); return; }
        active = card.key;
        for (const other of numbers.querySelectorAll('button')) other.setAttribute('aria-pressed', String(other.dataset.bucket === card.key));
        drawer.replaceChildren();
        const heading = node('div', undefined, 'records-heading');
        heading.append(node('h3', card.label), node('p', card.count === 1 ? '1 registro' : `${card.count} registros`));
        drawer.append(heading);
        if (!card.items.length) drawer.append(node('p', 'Ningún registro en este grupo.'));
        else {
          const list = node('ol', undefined, 'admin-panel-list');
          for (const item of card.items) {
            const row = node('li');
            const body = node('div');
            body.append(node('strong', item.name ?? '—'));
            if (item.detail) body.append(node('small', item.detail));
            row.append(body);
            if (typeof item.url === 'string' && item.url.startsWith('https://')) {
              const link = node('a', 'Ver publicación'); link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; row.append(link);
            } else if (detailLink && /^[a-f0-9]{32}$/.test(item.public_id ?? '')) {
              const link = node('a', 'Ver detalle'); link.href = detailLink; row.append(link);
            }
            list.append(row);
          }
          drawer.append(list);
        }
        drawer.hidden = false;
        drawer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      numbers.append(button);
    }
    container.append(numbers, drawer);
  }


  /** Creadoras: totales arriba, una tarjeta por persona y, al tocarla, todo su historial. */
  function renderCreadoras(container, data) {
    container.replaceChildren();
    if (!data || !Array.isArray(data.people)) { container.append(node('p', 'No se pudo cargar la sección de creadoras.', 'admin-panel-empty')); return; }
    const totals = node('div', undefined, 'admin-big-numbers admin-big-numbers--static');
    for (const [label, value] of creadoraTotals(data)) { const box = node('div', undefined, 'admin-big-number'); box.append(node('strong', value), node('span', label)); totals.append(box); }
    container.append(totals);
    if (!data.people.length) { container.append(node('p', 'Todavía no hay creadoras registradas.', 'admin-panel-empty')); return; }
    const people = node('div', undefined, 'admin-creadora-people');
    const drawer = node('section', undefined, 'admin-panel-drawer admin-creadora-history');
    drawer.hidden = true;
    let active = '';
    const list = (title, items, empty, render) => {
      const column = node('div', undefined, 'admin-creadora-history__column');
      column.append(node('h4', `${title} (${items.length})`));
      if (!items.length) { column.append(node('p', empty, 'admin-panel-empty')); return column; }
      const ol = node('ol', undefined, 'admin-panel-list');
      for (const item of items) ol.append(render(item));
      column.append(ol);
      return column;
    };
    const linkTo = (url, text) => { if (typeof url !== 'string' || !url.startsWith('https://')) return null; const link = node('a', text); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link; };
    for (const person of data.people) {
      const card = node('button', undefined, 'admin-creadora-person'); card.type = 'button'; card.setAttribute('aria-pressed', 'false');
      card.append(node('strong', person.name));
      const stats = node('dl');
      for (const [label, value] of [['Horas', formatHours(person.attended_minutes)], ['Asistió', `${person.attended} de ${person.shifts}`], ['Grabados', `${person.recorded} de ${person.scripts}`], ['Videos', person.videos]]) {
        const row = node('div'); row.append(node('dt', label), node('dd', value)); stats.append(row);
      }
      card.append(stats);
      card.addEventListener('click', () => {
        for (const other of people.querySelectorAll('button')) other.setAttribute('aria-pressed', 'false');
        if (active === person.creadora) { active = ''; drawer.hidden = true; drawer.replaceChildren(); return; }
        active = person.creadora; card.setAttribute('aria-pressed', 'true');
        drawer.replaceChildren();
        const heading = node('div', undefined, 'records-heading');
        heading.append(node('h3', `Historial de ${person.name}`), node('p', `${formatHours(person.attended_minutes)} asistidas de ${formatHours(person.scheduled_minutes)} agendadas · ${person.content} piezas de contenido`));
        const columns = node('div', undefined, 'admin-creadora-history__columns');
        const history = person.history ?? {};
        columns.append(
          list('Turnos', history.shifts ?? [], 'Sin turnos todavía.', shift => {
            const row = node('li'); const body = node('div');
            body.append(node('strong', shiftWhen(shift.starts_at, shift.ends_at)));
            const attended = shift.attended === 'yes' ? '✓ Asistió' : shift.attended === 'no' ? '✗ No asistió' : 'Sin marcar';
            body.append(node('small', [attended, formatHours(shift.minutes), shift.place].filter(Boolean).join(' · ')));
            row.dataset.attended = shift.attended ?? ''; row.append(body); return row;
          }),
          list('Guiones grabados', history.recorded_scripts ?? [], 'Todavía no hay guiones grabados.', script => {
            const row = node('li'); const body = node('div');
            body.append(node('strong', script.title), node('small', `Turno del ${shiftWhen(script.shift_at)}`));
            row.append(body); const ref = linkTo(script.reference_url, 'Referencia'); if (ref) row.append(ref); return row;
          }),
          list('Videos y contenido', history.content ?? [], 'Todavía no hay contenido registrado.', item => {
            const row = node('li'); const body = node('div');
            body.append(node('strong', `${CONTENT_KINDS[item.kind] ?? 'Contenido'} · ${item.title}`), node('small', `Turno del ${shiftWhen(item.shift_at)}`));
            row.append(body); const link = linkTo(item.url, 'Ver publicación'); if (link) row.append(link); return row;
          }),
        );
        const more = node('a', 'Abrir en el calendario de Creadoras', 'button-quiet'); more.href = '/admin/creadoras/';
        drawer.append(heading, columns, more);
        drawer.hidden = false;
        drawer.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      people.append(card);
    }
    container.append(people, drawer);
  }


  /* Redes sociales: se carga aparte para que una demora de Metricool no frene el resto del panel. */
  const social = query('[data-panel-social]');
  const socialFrom = social?.querySelector('[data-social-from]');
  const socialTo = social?.querySelector('[data-social-to]');
  const socialFeedback = social?.querySelector('[data-social-feedback]');
  const socialContent = social?.querySelector('[data-social-content]');
  const shortDate = value => new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));

  function deltaChip(current, previous, options = {}) {
    const delta = socialDelta(current, previous, options);
    const chip = node('span', undefined, 'admin-social__delta');
    chip.dataset.good = String(delta.good);
    if (delta.direction === null) { chip.textContent = 'Sin comparación'; chip.dataset.good = 'null'; return chip; }
    chip.textContent = socialDeltaText(delta, current, previous, options.kind);
    chip.title = `Periodo anterior: ${formatSocial(previous, options.kind)}`;
    return chip;
  }

  function tile(label, value, current, previous, options = {}) {
    const box = node('div', undefined, 'admin-social__tile');
    box.append(node('span', label), node('strong', value), deltaChip(current, previous, options));
    if (options.note) box.append(node('small', options.note));
    return box;
  }

  /** Una sola serie: el total de seguidores día a día. Pasa el cursor por un punto para ver la cifra. */
  function sparkline(points, label) {
    const values = points.map(point => Number(point[1]));
    if (values.length < 2) return node('p', 'Sin serie diaria.', 'admin-panel-empty');
    const width = 240, height = 56, pad = 6;
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
    const x = index => pad + (index * (width - pad * 2)) / (values.length - 1);
    const y = value => height - pad - ((value - min) * (height - pad * 2)) / span;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('class', 'admin-social__spark');
    svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${label}: de ${formatSocial(values[0])} a ${formatSocial(values.at(-1))}`);
    const line = document.createElementNS(svg.namespaceURI, 'polyline');
    line.setAttribute('points', values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' '));
    svg.append(line);
    points.forEach(([date, value], index) => {
      const hit = document.createElementNS(svg.namespaceURI, 'circle');
      hit.setAttribute('cx', x(index).toFixed(1)); hit.setAttribute('cy', y(Number(value)).toFixed(1)); hit.setAttribute('r', '5');
      const title = document.createElementNS(svg.namespaceURI, 'title'); title.textContent = `${shortDate(date)}: ${formatSocial(value)} seguidores`;
      hit.append(title); svg.append(hit);
    });
    return svg;
  }

  function renderSocial(report) {
    socialContent.replaceChildren();
    if (!report.configured) { socialContent.append(node('p', 'Metricool todavía no está conectado en el servidor.', 'admin-panel-empty')); return; }
    const totals = report.totals ?? {};
    const intro = node('p', `${shortDate(report.range.from)} – ${shortDate(report.range.to)} (${report.range.days} días). Las flechas comparan con ${shortDate(report.previous.from)} – ${shortDate(report.previous.to)}: verde es bueno para la campaña, rojo es malo.`, 'admin-social__range');
    const tiles = node('div', undefined, 'admin-social__tiles');
    tiles.append(
      tile('Seguidores en total', formatSocial(totals.followers), totals.followers_net?.current, totals.followers_net?.previous, { note: `${formatSocial(totals.followers_net?.current, 'signed')} en el periodo` }),
      tile('Vistas', formatSocial(totals.views?.current), totals.views?.current, totals.views?.previous),
      tile('Interacciones', formatSocial(totals.interactions?.current), totals.interactions?.current, totals.interactions?.previous),
      tile('Publicaciones', formatSocial(totals.posts?.current), totals.posts?.current, totals.posts?.previous, { note: 'Facebook e Instagram' }),
      tile('Inversión en pauta', formatSocial(totals.spend?.current, 'money'), totals.spend?.current, totals.spend?.previous, { kind: 'money', note: 'Meta Ads de Finados' }),
      tile('Costo por nuevo seguidor', formatSocial(totals.cost_per_follower?.current, 'money'), totals.cost_per_follower?.current, totals.cost_per_follower?.previous, { lowerIsBetter: true, kind: 'money', note: 'Aproximado; menos es mejor' }),
    );
    const insights = socialInsights(report);
    const reading = node('section', undefined, 'admin-social__insights');
    if (insights.length) { reading.append(node('h3', 'Lectura rápida')); const list = node('ul'); for (const text of insights) list.append(node('li', text)); reading.append(list); }

    const grid = node('div', undefined, 'admin-social__networks');
    for (const network of report.networks ?? []) {
      const card = node('article', undefined, 'admin-social__network');
      card.dataset.network = network.key;
      const verdict = socialVerdict(network);
      const head = node('header');
      const title = node('div'); title.append(node('h3', network.label), node('strong', formatSocial(network.followers?.end)), node('small', 'seguidores'));
      const badge = node('span', `${{ up: '▲', down: '▼', mixed: '◆', unknown: '·' }[verdict.key]} ${verdict.label}`, 'admin-social__verdict'); badge.dataset.verdict = verdict.key;
      head.append(title, badge);
      card.append(head);
      const growth = node('p', undefined, 'admin-social__growth');
      growth.append(node('strong', `${formatSocial(network.followers?.net, 'signed')} seguidores`), node('span', network.followers?.growth_pct == null ? '' : ` (${formatSocial(network.followers.growth_pct, 'pct')})`));
      growth.append(deltaChip(network.followers?.net, network.followers?.previous_net));
      card.append(growth, sparkline(network.series?.followers ?? [], `Seguidores de ${network.label}`));
      const list = node('dl', undefined, 'admin-social__metrics');
      for (const [key, [label, kind, lowerIsBetter]] of Object.entries(SOCIAL_METRIC_LABELS)) {
        const metric = network.metrics?.[key];
        if (!metric || (metric.current == null && metric.previous == null)) continue;
        const row = node('div'); const value = node('dd');
        value.append(node('span', formatSocial(metric.current, kind)), deltaChip(metric.current, metric.previous, { lowerIsBetter: Boolean(lowerIsBetter), kind }));
        row.append(node('dt', label), value); list.append(row);
      }
      card.append(list);
      grid.append(card);
    }

    const ads = report.ads ?? {}, now = ads.current ?? {}, before = ads.previous ?? {};
    const adsCard = node('article', undefined, 'admin-social__network admin-social__ads');
    const adsHead = node('header'); const adsTitle = node('div'); adsTitle.append(node('h3', 'Pauta · Meta Ads'), node('strong', formatSocial(now.spend, 'money')), node('small', 'invertidos'));
    adsHead.append(adsTitle); adsCard.append(adsHead);
    const adsList = node('dl', undefined, 'admin-social__metrics');
    for (const [key, label, kind, lowerIsBetter] of [['impressions', 'Impresiones', 'number'], ['reach', 'Alcance (suma diaria)', 'number'], ['clicks', 'Clics', 'number'], ['ctr', 'CTR (clics por impresión)', 'pct'], ['cpc', 'Costo por clic', 'money', true], ['cpm', 'Costo por mil impresiones', 'money', true]]) {
      const row = node('div'); const value = node('dd');
      value.append(node('span', formatSocial(now[key], kind)), deltaChip(now[key], before[key], { lowerIsBetter: Boolean(lowerIsBetter), kind }));
      row.append(node('dt', label), value); adsList.append(row);
    }
    adsCard.append(sparklineSpend(ads.series?.spend ?? []), adsList);
    grid.append(adsCard);

    const stamp = node('p', `Datos de Metricool · ${report.cached ? 'guardados hace menos de 30 min' : 'leídos ahora'}. «Alcance (suma diaria)» suma el alcance de cada día: no es gente única.`, 'admin-social__stamp');
    socialContent.append(intro, tiles, reading, grid, stamp);
  }

  function sparklineSpend(points) {
    const svg = sparkline(points, 'Inversión diaria');
    for (const title of svg.querySelectorAll?.('title') ?? []) title.textContent = title.textContent.replace(/ seguidores$/, ' USD');
    return svg;
  }

  let socialRange = lastDays(30);
  async function loadSocial(refresh = false) {
    if (!social) return;
    socialFrom.value = socialRange.from; socialTo.value = socialRange.to; socialTo.max = ecuadorToday(); socialFrom.max = socialTo.value;
    social.setAttribute('aria-busy', 'true');
    feedback(socialFeedback, refresh ? 'Leyendo Metricool…' : 'Cargando redes sociales…');
    try {
      renderSocial(await client.social(socialRange.from, socialRange.to, refresh));
      feedback(socialFeedback, '');
    } catch (error) {
      if (error.status === 401) { location.replace('/admin/'); return; }
      feedback(socialFeedback, error.status === 503 ? 'Metricool no respondió. Intenta de nuevo en unos minutos.' : error.status === 422 ? 'Revisa el periodo: hasta hoy y de máximo un año.' : error.message, 'error');
    } finally { social.removeAttribute('aria-busy'); }
  }
  if (social) {
    const presets = [...social.querySelectorAll('[data-social-preset]')];
    const press = active => { for (const button of presets) button.setAttribute('aria-pressed', String(button === active)); };
    for (const button of presets) button.addEventListener('click', () => { socialRange = lastDays(Number(button.dataset.socialPreset)); press(button); loadSocial(); });
    social.querySelector('[data-social-apply]').addEventListener('click', () => {
      if (!socialFrom.value || !socialTo.value || socialFrom.value > socialTo.value) { feedback(socialFeedback, 'Elige una fecha de inicio anterior a la de fin.', 'error'); return; }
      socialRange = { from: socialFrom.value, to: socialTo.value }; press(null); loadSocial();
    });
    social.querySelector('[data-social-refresh]').addEventListener('click', () => loadSocial(true));
  }

  async function load() {
    retry.hidden = true;
    feedback(status, 'Cargando panel…');
    try {
      const data = await client.panel();
      renderGroup(query('[data-panel-media]'), panelCards(data.media), { detailLink: '/admin/medios/' });
      renderGroup(query('[data-panel-voceros]'), panelCards(data.voceros), { detailLink: '/admin/voceros/' });
      renderCreadoras(query('[data-panel-creadoras]'), data.creadoras);
      const events = query('[data-panel-events]');
      events.replaceChildren();
      const list = data.media?.events ?? [];
      if (!list.length) events.append(node('p', 'Todavía no hay eventos. Créalos en Medios → Eventos.', 'admin-panel-empty'));
      for (const event of list) {
        const block = node('details', undefined, 'admin-panel-event');
        const summary = node('summary');
        summary.append(node('strong', event.name), node('small', `${eventLabel(event)} · ${event.coverage_count} medios`));
        block.append(summary);
        const body = node('div', undefined, 'admin-panel-event__body');
        block.append(body);
        block.addEventListener('toggle', () => { if (block.open && !body.childElementCount) renderGroup(body, panelCards(event)); }, { once: false });
        events.append(block);
      }
      if (list.length) list.length === 1 ? events.firstElementChild.setAttribute('open', '') : null;
      feedback(status, '');
    } catch (error) { fail(error); retry.hidden = false; }
  }

  retry.addEventListener('click', load);
  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await client.logout(); location.replace('/admin/'); }
    catch (error) { logout.disabled = false; fail(error); }
  });

  try {
    const session = await client.session();
    if (!session.authenticated) { location.replace('/admin/'); return; }
    query('[data-admin-user]').textContent = `Sesión de ${session.user.username}`;
    if (sidebarUser) sidebarUser.textContent = session.user.username;
    if (logout) logout.disabled = false;
    loadSocial();
    await load();
  } catch (error) { fail(error); retry.hidden = false; }
}

if (typeof document !== 'undefined') initializeAdminPanel();
