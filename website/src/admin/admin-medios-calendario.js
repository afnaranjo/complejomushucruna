import { resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
// Mismo cliente administrativo que Medios: lista de rutas permitidas, CSRF y sesión compartidos.
import { createMediaAdminClient } from './admin-medios.js?v=20260925-admin-medios-23';

const LOCAL_API = 'http://127.0.0.1:4174/api';

/* ---------- Datos fijos de la campaña ---------- */

export const CAMPAIGN_START = '2026-09-21';
export const CAMPAIGN_END = '2026-11-05';
export const WEEKS = Object.freeze([
  { id: 'w1', n: 'Semana 1', start: '2026-09-21', end: '2026-09-27' },
  { id: 'w2', n: 'Semana 2', start: '2026-09-28', end: '2026-10-04' },
  { id: 'w3', n: 'Semana 3', start: '2026-10-05', end: '2026-10-11' },
  { id: 'w4', n: 'Semana 4', start: '2026-10-12', end: '2026-10-18' },
  { id: 'w5', n: 'Semana 5', start: '2026-10-19', end: '2026-10-25' },
  { id: 'w6', n: 'Semana 6', start: '2026-10-26', end: '2026-11-01' },
  { id: 'w7', n: 'Semana 7', start: '2026-11-02', end: '2026-11-05' },
]);
/** Los tres audios de partida, con los colores de Finados en lugar de los genéricos. */
export const DEFAULT_SPOTS = Object.freeze([
  { id: 'general', qty: 1, name: 'AUDIO GENERAL', desc: 'SHOWS INTERNACIONALES + FERIA', national: true, regional: true, local: true, color: '#94165e' },
  { id: 'atractivos', qty: 1, name: 'AUDIO DE ATRACTIVOS', desc: 'AUDIO DE NIÑO + ATRACTIVOS PARA VENTA', national: false, regional: true, local: true, color: '#1f6f8b' },
  { id: 'carteleras', qty: 4, name: 'AUDIO DE CARTELERAS', desc: 'AUDIO DE SHOWS POR DÍA PARA VENTA', national: true, regional: true, local: true, color: '#6e2ce0' },
]);
const SUGGESTED = Object.freeze({
  general: [['w1', '2026-09-21', '2026-09-27', 'Lanzamiento y construcción de alcance.'], ['w2', '2026-09-28', '2026-10-04', 'Mantener cobertura paraguas.'], ['w3', '2026-10-05', '2026-10-11', 'Recordación y frecuencia.'], ['w4', '2026-10-12', '2026-10-18', 'Sostener alcance general.'], ['w5', '2026-10-19', '2026-10-25', 'Escalar frecuencia previa al evento.'], ['w6', '2026-10-26', '2026-11-01', 'Alta frecuencia y llamada a la acción.'], ['w7', '2026-11-02', '2026-11-05', 'Cierre y últimos días.']],
  atractivos: [['w2', '2026-09-28', '2026-10-04', 'Introducir atractivos y experiencia familiar.'], ['w3', '2026-10-05', '2026-10-11', 'Refuerzo regional y local.'], ['w4', '2026-10-12', '2026-10-18', 'Impulsar intención de visita y venta.'], ['w5', '2026-10-19', '2026-10-25', 'Refuerzo de beneficios y atractivos.'], ['w6', '2026-10-26', '2026-11-01', 'Último impulso de atractivos.']],
  carteleras: [['w5', '2026-10-22', '2026-10-25', 'Cartelera 1 · activar venta anticipada.'], ['w6', '2026-10-26', '2026-10-29', 'Cartelera 2 · shows por día.'], ['w6', '2026-10-29', '2026-11-01', 'Cartelera 3 · alta frecuencia.'], ['w7', '2026-11-02', '2026-11-05', 'Cartelera 4 · cierre / últimos shows.']],
});
const MEDIA_TYPES = Object.freeze(['Radio', 'Televisión', 'Digital', 'Prensa', 'Influencer', 'Otro']);
const COVERAGES = Object.freeze(['Nacional', 'Regional', 'Local']);
/** Tipos del registro de Medios → tipo de pauta. */
const SOURCE_TYPES = Object.freeze({ radio: 'Radio', tv: 'Televisión', prensa: 'Prensa', digital: 'Digital', redes: 'Digital' });

/* ---------- Funciones puras (probadas) ---------- */

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** La estrategia sugerida para los audios de partida que sigan existiendo. */
export function suggestedAssignments(spots, makeId = uid) {
  const out = [];
  for (const [spotId, rows] of Object.entries(SUGGESTED)) {
    const spot = spots.find(item => item.id === spotId) ?? null;
    if (!spot) continue;
    for (const [weekId, start, end, note] of rows) out.push({ id: makeId('as'), spotId: spot.id, weekId, start, end, note });
  }
  return out;
}

export function initialPlan(makeId = uid) {
  const spots = DEFAULT_SPOTS.map(spot => ({ ...spot }));
  return { spots, assignments: suggestedAssignments(spots, makeId), media: [], plans: [] };
}

export function daysInclusive(start, end) {
  if (!start || !end) return 0;
  return Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1);
}

export function weekFor(date) {
  return WEEKS.find(week => date >= week.start && date <= week.end) ?? null;
}

/** Mover una pauta a otra semana conserva su duración, sin salirse de esa semana. */
export function moveToWeek(assignment, weekId) {
  const week = WEEKS.find(item => item.id === weekId);
  if (!week) return assignment;
  const duration = Math.max(1, daysInclusive(assignment.start, assignment.end));
  const span = Math.min(duration, daysInclusive(week.start, week.end));
  const end = new Date(Date.parse(`${week.start}T00:00:00Z`) + (span - 1) * 86400000).toISOString().slice(0, 10);
  return { ...assignment, weekId, start: week.start, end };
}

export function planRows(state) {
  let total = 0; let impacts = 0;
  const rows = state.plans.map(plan => {
    const media = state.media.find(item => item.id === plan.mediaId) ?? null;
    const spot = state.spots.find(item => item.id === plan.spotId) ?? null;
    const days = daysInclusive(plan.start, plan.end);
    const hits = days * Number(plan.freq || 0);
    const investment = Math.round(hits * Number(plan.cost || 0) * 100) / 100;
    total += investment; impacts += hits;
    return { plan, media, spot, days, impacts: hits, investment };
  });
  return { rows, total: Math.round(total * 100) / 100, impacts };
}

export function spotKpis(state) {
  return [
    ['Piezas totales', state.spots.reduce((sum, spot) => sum + Number(spot.qty || 0), 0)],
    ['Con cobertura nacional', state.spots.filter(spot => spot.national).length],
    ['Con cobertura regional', state.spots.filter(spot => spot.regional).length],
    ['Con cobertura local', state.spots.filter(spot => spot.local).length],
  ];
}

/** Texto blanco o morado según el color de la pauta, para que siempre se lea. */
export function textColorFor(hex) {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex));
  if (!match) return '#ffffff';
  const [r, g, b] = match.slice(1).map(part => { const c = parseInt(part, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#241146' : '#ffffff';
}

/** Un medio del registro de Medios convertido en medio de pauta. */
export function mediaFromSource(item = {}) {
  const types = Array.isArray(item.media_types) ? item.media_types : [];
  return {
    name: String(item.media_name ?? '').slice(0, 160),
    type: SOURCE_TYPES[types[0]] ?? 'Otro',
    city: [item.city, item.province].filter(Boolean).join(' / ').slice(0, 160),
    program: String(item.program_name || item.frequency_channel || '').slice(0, 160),
    sourceId: /^[a-f0-9]{32}$/.test(item.public_id ?? '') ? item.public_id : '',
  };
}

/** Un respaldo importado solo se acepta si trae las cuatro listas; el servidor valida el detalle. */
export function importedPlan(value) {
  if (!value || typeof value !== 'object' || !['spots', 'assignments', 'media', 'plans'].every(key => Array.isArray(value[key]))) throw new Error('El archivo no es un respaldo del calendario.');
  return {
    spots: value.spots.map(spot => ({ id: String(spot.id), qty: Number.parseInt(spot.qty, 10) || 1, name: String(spot.name ?? ''), desc: String(spot.desc ?? ''), color: String(spot.color ?? '#94165e'), national: !!spot.national, regional: !!spot.regional, local: !!spot.local })),
    assignments: value.assignments.map(item => ({ id: String(item.id), spotId: String(item.spotId), weekId: String(item.weekId), start: String(item.start), end: String(item.end), note: String(item.note ?? '') })),
    media: value.media.map(item => ({ id: String(item.id), name: String(item.name ?? ''), type: MEDIA_TYPES.includes(item.type) ? item.type : 'Otro', coverage: COVERAGES.includes(item.coverage) ? item.coverage : 'Local', city: String(item.city ?? ''), program: String(item.program ?? ''), contact: String(item.contact ?? ''), rate: Number(item.rate) || 0, status: item.status === 'pending' ? 'pending' : 'active', notes: String(item.notes ?? ''), sourceId: /^[a-f0-9]{32}$/.test(item.sourceId ?? '') ? item.sourceId : '' })),
    plans: value.plans.map(item => ({ id: String(item.id), mediaId: String(item.mediaId), spotId: String(item.spotId), start: String(item.start), end: String(item.end), freq: Number.parseInt(item.freq, 10) || 1, cost: Number(item.cost) || 0, objective: String(item.objective ?? '') })),
  };
}

const moneyFormat = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const numberFormat = new Intl.NumberFormat('es-EC');
export const money = value => moneyFormat.format(Number(value || 0));
export function shortDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return '';
  return new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}
function longDate(value) {
  return new Intl.DateTimeFormat('es-EC', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

/** Un PDF de una página con la imagen JPEG del reporte centrada. Sin librerías externas. */
export function pdfFromJpeg(jpeg, width, height, pageWidth, pageHeight) {
  const margin = 22;
  const scale = Math.min((pageWidth - margin * 2) / width, (pageHeight - margin * 2) / height);
  const w = width * scale; const h = height * scale;
  const x = (pageWidth - w) / 2; const y = (pageHeight - h) / 2;
  const encoder = new TextEncoder();
  const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
  const parts = [];
  const offsets = [];
  let length = 0;
  const push = chunk => { const bytes = typeof chunk === 'string' ? encoder.encode(chunk) : chunk; parts.push(bytes); length += bytes.length; };
  push('%PDF-1.4\n');
  const object = (id, body) => { offsets[id] = length; push(`${id} 0 obj\n`); for (const piece of body) push(piece); push('\nendobj\n'); };
  object(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  object(2, ['<< /Type /Pages /Kids [3 0 R] /Count 1 >>']);
  object(3, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`]);
  object(4, [`<< /Length ${encoder.encode(content).length} >>\nstream\n`, content, '\nendstream']);
  object(5, [`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream']);
  const xref = length;
  push(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const out = new Uint8Array(length);
  let position = 0;
  for (const part of parts) { out.set(part, position); position += part.length; }
  return out;
}

/* ---------- Reportes dibujados en canvas (PNG, PDF e impresión) ---------- */

const INK = '#241146'; const MUTED = '#665771'; const ACCENT = '#94165e'; const PAPER = '#ffffff'; const LINE = '#d9ced6';
const FONT = 'Inter, system-ui, sans-serif';

function wrap(ctx, text, maxWidth) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean);
  const lines = []; let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawHeader(ctx, width, title, subtitle, brand) {
  ctx.fillStyle = INK; ctx.font = `800 44px ${FONT}`; ctx.textBaseline = 'top'; ctx.fillText(title, 60, 50);
  ctx.fillStyle = MUTED; ctx.font = `500 24px ${FONT}`; ctx.fillText(subtitle, 60, 108);
  ctx.font = `800 22px ${FONT}`; const bw = ctx.measureText(brand).width + 40;
  ctx.fillStyle = INK; roundRect(ctx, width - 60 - bw, 52, bw, 52, 10); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.fillText(brand, width - 40 - bw, 66);
  ctx.fillStyle = ACCENT; ctx.fillRect(60, 156, width - 120, 6);
}

function drawFooter(ctx, width, height, left) {
  ctx.fillStyle = MUTED; ctx.font = `500 18px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText(left, 60, height - 36);
  const right = `Generado: ${new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(new Date())}`;
  ctx.fillText(right, width - 60 - ctx.measureText(right).width, height - 36);
}

export function drawCalendarReport(canvas, state) {
  const width = 2400; const columnGap = 14; const top = 250;
  const columnWidth = (width - 120 - columnGap * 6) / 7;
  const measure = canvas.getContext('2d');
  measure.font = `500 17px ${FONT}`;
  // Alto de cada semana según sus pautas, para que nada se corte.
  const heights = WEEKS.map(week => state.assignments.filter(a => a.weekId === week.id).reduce((sum, a) => sum + 70 + wrap(measure, a.note, columnWidth - 36).length * 22, 90));
  const height = top + Math.max(520, ...heights) + 170;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, width, height);
  drawHeader(ctx, width, 'Calendario estratégico de comunicación', 'Finados 2026 · Campaña del 21 de septiembre al 5 de noviembre de 2026', 'PLAN DE COMUNICACIÓN');
  let lx = 60; ctx.textBaseline = 'middle'; ctx.font = `700 18px ${FONT}`;
  for (const spot of state.spots) { ctx.fillStyle = spot.color; roundRect(ctx, lx, 192, 22, 22, 5); ctx.fill(); ctx.fillStyle = INK; ctx.fillText(spot.name, lx + 30, 204); lx += 30 + ctx.measureText(spot.name).width + 34; }
  WEEKS.forEach((week, index) => {
    const x = 60 + index * (columnWidth + columnGap);
    const bodyHeight = height - top - 150;
    ctx.fillStyle = '#faf6fb'; ctx.strokeStyle = LINE; ctx.lineWidth = 2; roundRect(ctx, x, top, columnWidth, bodyHeight, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = INK; roundRect(ctx, x, top, columnWidth, 74, 12); ctx.fill(); ctx.fillRect(x, top + 50, columnWidth, 24);
    ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'top'; ctx.font = `800 20px ${FONT}`; ctx.fillText(week.n, x + 16, top + 12);
    ctx.font = `500 17px ${FONT}`; ctx.fillText(`${shortDate(week.start)} – ${shortDate(week.end)}`, x + 16, top + 40);
    let y = top + 90;
    const items = state.assignments.filter(a => a.weekId === week.id).sort((a, b) => a.start.localeCompare(b.start));
    if (!items.length) { ctx.fillStyle = MUTED; ctx.font = `500 17px ${FONT}`; ctx.fillText('Sin pauta', x + 16, y); }
    for (const item of items) {
      const spot = state.spots.find(s => s.id === item.spotId);
      if (!spot) continue;
      ctx.font = `500 17px ${FONT}`;
      const notes = wrap(ctx, item.note, columnWidth - 36);
      const boxHeight = 62 + notes.length * 22;
      ctx.fillStyle = spot.color; roundRect(ctx, x + 10, y, columnWidth - 20, boxHeight, 10); ctx.fill();
      const ink = textColorFor(spot.color);
      ctx.fillStyle = ink; ctx.font = `800 17px ${FONT}`; ctx.fillText(wrap(ctx, spot.name, columnWidth - 40)[0] ?? '', x + 20, y + 10);
      ctx.font = `600 16px ${FONT}`; ctx.fillText(`${shortDate(item.start)} → ${shortDate(item.end)}`, x + 20, y + 34);
      ctx.font = `500 17px ${FONT}`; notes.forEach((line, i) => ctx.fillText(line, x + 20, y + 58 + i * 22));
      y += boxHeight + 10;
    }
  });
  ctx.fillStyle = INK; ctx.font = `800 20px ${FONT}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('Criterio estratégico:', 60, height - 86);
  ctx.fillStyle = MUTED; ctx.font = `500 20px ${FONT}`;
  ctx.fillText('audio general como paraguas; atractivos para consideración y venta; carteleras concentradas en la fase final para impulsar asistencia.', 270, height - 86);
  drawFooter(ctx, width, height, `Periodo total: ${daysInclusive(CAMPAIGN_START, CAMPAIGN_END)} días`);
}

export function drawMediaReport(canvas, state) {
  const width = 2400; const { rows, total, impacts } = planRows(state);
  const columns = [['Medio', 300], ['Tipo', 150], ['Cobertura', 150], ['Pieza', 280], ['Inicio', 120], ['Fin', 120], ['Frec./día', 120], ['Impactos', 130], ['Costo', 150], ['Inversión', 170], ['Objetivo', 590]];
  const measure = canvas.getContext('2d'); measure.font = `500 18px ${FONT}`;
  const rowHeights = rows.map(row => Math.max(56, 20 + Math.max(wrap(measure, row.plan.objective || '—', 560).length, wrap(measure, row.media?.name ?? '—', 270).length) * 24));
  const tableTop = 330;
  const height = tableTop + 60 + (rows.length ? rowHeights.reduce((a, b) => a + b, 0) : 80) + 130;
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, width, height);
  drawHeader(ctx, width, 'Plan de medios', 'Finados 2026 · Radio, televisión y medios digitales · 21 sep – 5 nov 2026', 'PLAN DE MEDIOS');
  const chips = [['Medios', numberFormat.format(state.media.length)], ['Pautas', numberFormat.format(state.plans.length)], ['Impactos / inserciones', numberFormat.format(impacts)], ['Inversión', money(total)]];
  chips.forEach(([label, value], index) => {
    const x = 60 + index * 330;
    ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.fillStyle = '#faf6fb'; roundRect(ctx, x, 190, 310, 100, 12); ctx.fill(); ctx.stroke();
    ctx.fillStyle = MUTED; ctx.textBaseline = 'top'; ctx.font = `600 18px ${FONT}`; ctx.fillText(label, x + 20, 206);
    ctx.fillStyle = INK; ctx.font = `800 34px ${FONT}`; ctx.fillText(value, x + 20, 236);
  });
  let x = 60;
  ctx.fillStyle = INK; ctx.fillRect(60, tableTop, width - 120, 56);
  ctx.fillStyle = '#ffffff'; ctx.font = `800 17px ${FONT}`; ctx.textBaseline = 'middle';
  for (const [label, w] of columns) { ctx.fillText(label.toUpperCase(), x + 12, tableTop + 28); x += w; }
  let y = tableTop + 56;
  if (!rows.length) { ctx.fillStyle = MUTED; ctx.font = `500 20px ${FONT}`; ctx.fillText('No hay pautas registradas.', 72, y + 40); }
  rows.forEach((row, index) => {
    const rh = rowHeights[index];
    if (index % 2) { ctx.fillStyle = '#faf6fb'; ctx.fillRect(60, y, width - 120, rh); }
    ctx.strokeStyle = LINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(60, y + rh); ctx.lineTo(width - 60, y + rh); ctx.stroke();
    const values = [row.media?.name ?? '—', row.media?.type ?? '—', row.media?.coverage ?? '—', row.spot?.name ?? '—', shortDate(row.plan.start), shortDate(row.plan.end), String(row.plan.freq), numberFormat.format(row.impacts), money(row.plan.cost), money(row.investment), row.plan.objective || '—'];
    let cx = 60; ctx.textBaseline = 'top';
    values.forEach((value, column) => {
      const w = columns[column][1];
      ctx.fillStyle = INK; ctx.font = `${column === 9 ? 800 : 500} 18px ${FONT}`;
      wrap(ctx, value, w - 24).forEach((line, i) => ctx.fillText(line, cx + 12, y + 16 + i * 24));
      cx += w;
    });
    y += rh;
  });
  drawFooter(ctx, width, height, `Periodo: ${longDate(CAMPAIGN_START)} – ${longDate(CAMPAIGN_END)}`);
}

/* ---------- Interfaz ---------- */

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined && text !== null) element.textContent = String(text);
  if (className) element.className = className;
  return element;
}
function button(text, className, onClick, label) {
  const element = node('button', text, className); element.type = 'button';
  if (label) element.setAttribute('aria-label', label);
  element.addEventListener('click', onClick);
  return element;
}
function tint(element, color) {
  element.style.setProperty('--mc-color', color);
  element.style.setProperty('--mc-on-color', textColorFor(color));
}

export async function initializeMediaPlan() {
  const root = document.querySelector('[data-admin-medios-calendario]');
  if (!root) return;
  const navigation = document.querySelector('[data-admin-navigation]');
  const compact = globalThis.matchMedia?.('(max-width: 1120px)');
  const applyNavigation = value => { if (navigation) navigation.open = !value; };
  applyNavigation(compact?.matches ?? false);
  compact?.addEventListener('change', event => applyNavigation(event.matches));
  const $ = selector => root.querySelector(selector);
  const status = $('[data-admin-feedback]');
  const retry = $('[data-session-retry]');
  const saveLine = $('[data-plan-save]');
  const toastLine = $('[data-plan-toast]');
  const configuredBase = document.querySelector('meta[name="admin-api-base"]')?.content;
  const runtime = resolveRuntimeOrigins(location);
  const base = location.hostname === 'finados.expoferiamushucruna.com' ? runtime.apiBase : configuredBase || runtime.apiBase;
  if (LOCAL_API && base === LOCAL_API && location.hostname !== new URL(LOCAL_API).hostname) { status.textContent = 'La configuración de acceso no es válida.'; status.dataset.error = 'true'; return; }
  const client = createMediaAdminClient(base);
  const logout = document.querySelector('[data-admin-logout]');
  const sidebarUser = document.querySelector('[data-admin-sidebar-user]');
  const feedback = (element, message, kind = '') => { element.textContent = message; element.dataset.error = String(kind === 'error'); element.dataset.success = String(kind === 'success'); };
  const fail = error => { if (error.status === 401) { location.replace('/admin/'); return; } feedback(status, error.message, 'error'); };
  let toastTimer = 0;
  const toast = message => { toastLine.textContent = message; toastLine.dataset.show = 'true'; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastLine.dataset.show = 'false'; }, 2200); };

  let state = initialPlan();
  let version = 0; let dirty = false; let saving = false; let again = false; let timer = 0; let conflict = false;
  let drag = null;

  /* Guardado compartido: cada cambio se guarda solo, con la versión para no pisar a otra persona. */
  function commit(message) {
    renderAll();
    if (message) toast(message);
    if (conflict) return;
    dirty = true;
    feedback(saveLine, 'Cambios sin guardar…');
    clearTimeout(timer); timer = setTimeout(persist, 700);
  }
  async function persist() {
    if (saving) { again = true; return; }
    saving = true; feedback(saveLine, 'Guardando…');
    try {
      const result = await client.saveMediaPlan(state, version);
      version = result.version; dirty = again;
      const hour = new Intl.DateTimeFormat('es-EC', { timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(new Date());
      feedback(saveLine, `Guardado para todo el equipo · ${hour}`, 'success');
    } catch (error) {
      if (error.status === 401) { location.replace('/admin/'); return; }
      if (error.status === 409) {
        conflict = true; saveLine.replaceChildren();
        feedback(saveLine, 'Otra persona guardó cambios antes que tú. Tus últimos cambios no se guardaron. ', 'error');
        saveLine.append(button('Cargar la versión actual', 'button-quiet', async () => { conflict = false; dirty = false; await loadPlan(); }));
      } else {
        feedback(saveLine, error.status === 422 ? 'No se guardó: hay un dato fuera de lo permitido (fechas de campaña, largos o números). Revísalo.' : `No se guardó: ${error.message}`, 'error');
        saveLine.append(' ', button('Reintentar', 'button-quiet', persist));
      }
    } finally {
      saving = false;
      if (again && !conflict) { again = false; persist(); }
    }
  }
  addEventListener('beforeunload', event => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } });

  /* Pestañas */
  const tabs = [...root.querySelectorAll('[data-plan-tab]')];
  function goTab(key) {
    if (!tabs.some(tab => tab.dataset.planTab === key)) key = 'spots';
    for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.planTab === key));
    for (const panel of root.querySelectorAll('[data-plan-panel]')) panel.hidden = panel.dataset.planPanel !== key;
    history.replaceState(null, '', `#${key}`);
    if (key === 'reportes') renderReport();
  }
  for (const tab of tabs) tab.addEventListener('click', () => goTab(tab.dataset.planTab));
  root.querySelector('[data-plan-go]')?.addEventListener('click', () => goTab('reportes'));
  root.querySelector('[role="tablist"]').addEventListener('keydown', event => {
    const index = tabs.indexOf(document.activeElement);
    if (index < 0 || !['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.focus(); goTab(next.dataset.planTab);
  });

  /* Diálogos */
  const dialogs = {};
  for (const dialog of root.querySelectorAll('[data-dialog]')) {
    dialogs[dialog.dataset.dialog] = dialog;
    for (const close of dialog.querySelectorAll('[data-dialog-close]')) close.addEventListener('click', () => dialog.close());
  }
  const formOf = key => dialogs[key].querySelector('form');
  const fill = (select, items, label, selected) => {
    select.replaceChildren(...items.map(item => { const option = node('option', label(item)); option.value = item.id; option.selected = item.id === selected; return option; }));
  };
  function datesOk(start, end) {
    if (!start || !end || start > end) { toast('Revisa las fechas: el inicio debe ser antes del fin.'); return false; }
    if (start < CAMPAIGN_START || end > CAMPAIGN_END) { toast('Las fechas deben estar entre el 21 sep y el 5 nov de 2026.'); return false; }
    return true;
  }

  /* 1. Spots */
  function renderSpots() {
    const kpis = $('[data-spot-kpis]'); kpis.replaceChildren();
    for (const [label, value] of spotKpis(state)) { const box = node('div', undefined, 'mc-kpi'); box.append(node('span', label), node('strong', value)); kpis.append(box); }
    const body = $('[data-spot-rows]'); body.replaceChildren();
    if (!state.spots.length) { const row = node('tr'); const cell = node('td', 'Aún no hay spots. Usa «+ Añadir spot».', 'mc-empty'); cell.colSpan = 7; row.append(cell); body.append(row); return; }
    for (const spot of state.spots) {
      const row = node('tr');
      const name = node('td'); const swatch = node('span', undefined, 'mc-swatch'); tint(swatch, spot.color); name.append(swatch, node('strong', spot.name));
      row.append(node('td', spot.qty, 'mc-num'), name, node('td', spot.desc || '—'));
      for (const key of ['national', 'regional', 'local']) { const cell = node('td'); if (spot[key]) { const check = node('span', '✓', 'mc-yes'); check.setAttribute('aria-label', 'Sí'); cell.append(check); } else cell.append(node('span', '—', 'mc-no')); row.append(cell); }
      const actions = node('td', undefined, 'mc-actions');
      actions.append(button('Editar', 'button-quiet mc-small', () => openSpot(spot.id)), button('Eliminar', 'button-quiet mc-small mc-danger', () => deleteSpot(spot.id)));
      row.append(actions); body.append(row);
    }
  }
  function openSpot(id = '') {
    const spot = state.spots.find(item => item.id === id) ?? null;
    const form = formOf('spot');
    form.dataset.id = id; dialogs.spot.querySelector('[data-dialog-title]').textContent = spot ? 'Editar spot' : 'Añadir spot';
    form.elements.qty.value = spot?.qty ?? 1; form.elements.name.value = spot?.name ?? ''; form.elements.desc.value = spot?.desc ?? ''; form.elements.color.value = spot?.color ?? '#94165e';
    for (const key of ['national', 'regional', 'local']) form.elements[key].checked = !!spot?.[key];
    dialogs.spot.showModal();
  }
  formOf('spot').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget; const id = form.dataset.id;
    const name = form.elements.name.value.trim();
    if (!name) return toast('Escribe el nombre del spot.');
    const data = { id: id || uid('spot'), qty: Math.min(999, Math.max(1, Number.parseInt(form.elements.qty.value, 10) || 1)), name, desc: form.elements.desc.value.trim(), color: form.elements.color.value.toLowerCase(), national: form.elements.national.checked, regional: form.elements.regional.checked, local: form.elements.local.checked };
    if (id) state.spots = state.spots.map(item => item.id === id ? data : item); else state.spots.push(data);
    dialogs.spot.close(); commit('Spot guardado');
  });
  function deleteSpot(id) {
    if (!confirm('¿Eliminar este spot? También se eliminarán sus pautas del calendario y del plan de medios.')) return;
    state.spots = state.spots.filter(item => item.id !== id);
    state.assignments = state.assignments.filter(item => item.spotId !== id);
    state.plans = state.plans.filter(item => item.spotId !== id);
    commit('Spot eliminado');
  }
  $('[data-spot-new]').addEventListener('click', () => openSpot());

  /* 2. Calendario semanal */
  function renderCalendar() {
    const library = $('[data-audio-library]'); library.replaceChildren();
    if (!state.spots.length) library.append(node('p', 'Añade spots para usarlos en el calendario.', 'mc-empty'));
    for (const spot of state.spots) {
      const card = node('div', undefined, 'mc-audio'); tint(card, spot.color); card.draggable = true;
      card.append(node('strong', spot.name), node('small', spot.desc), node('span', `Cantidad: ${spot.qty}`, 'mc-pill'));
      card.addEventListener('dragstart', event => { drag = { type: 'spot', id: spot.id }; event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('text/plain', `spot:${spot.id}`); });
      library.append(card);
    }
    const legend = $('[data-plan-legend]'); legend.replaceChildren();
    for (const spot of state.spots) { const item = node('span', undefined, 'mc-legend-item'); const dot = node('span', undefined, 'mc-swatch'); tint(dot, spot.color); item.append(dot, spot.name); legend.append(item); }
    const grid = $('[data-weeks]'); grid.replaceChildren();
    WEEKS.forEach((week, index) => {
      const column = node('div', undefined, 'mc-week');
      const head = node('div', undefined, 'mc-week__head');
      head.append(node('span', week.n), node('strong', `${shortDate(week.start)} – ${shortDate(week.end)}`), node('small', index === 0 ? 'Inicio de campaña' : index === WEEKS.length - 1 ? 'Cierre de campaña' : 'Planificación semanal'));
      const body = node('div', undefined, 'mc-week__body');
      for (const item of state.assignments.filter(a => a.weekId === week.id).sort((a, b) => a.start.localeCompare(b.start))) {
        const spot = state.spots.find(s => s.id === item.spotId);
        if (!spot) continue;
        const card = node('div', undefined, 'mc-assignment'); tint(card, spot.color); card.draggable = true;
        const actions = node('div', undefined, 'mc-assignment__actions');
        actions.append(button('✎', 'mc-mini', () => openAssignment(item.id), `Editar pauta ${spot.name}`), button('×', 'mc-mini', () => { state.assignments = state.assignments.filter(a => a.id !== item.id); commit('Pauta quitada'); }, `Quitar pauta ${spot.name}`));
        card.append(actions, node('strong', spot.name), node('span', `${shortDate(item.start)} → ${shortDate(item.end)}`, 'mc-assignment__date'));
        if (item.note) card.append(node('p', item.note));
        card.addEventListener('dragstart', event => { drag = { type: 'assignment', id: item.id }; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', `assignment:${item.id}`); });
        body.append(card);
      }
      body.append(node('div', 'Suelta un audio aquí', 'mc-drop'));
      const add = button('+ Agregar a esta semana', 'button-quiet mc-small mc-week__add', () => openAssignment('', week.id));
      add.disabled = !state.spots.length;
      body.append(add);
      column.addEventListener('dragover', event => { event.preventDefault(); column.dataset.over = 'true'; });
      column.addEventListener('dragleave', event => { if (!column.contains(event.relatedTarget)) column.dataset.over = 'false'; });
      column.addEventListener('drop', event => {
        event.preventDefault(); column.dataset.over = 'false';
        if (drag?.type === 'spot') { state.assignments.push({ id: uid('as'), spotId: drag.id, weekId: week.id, start: week.start, end: week.end, note: '' }); commit(`Audio asignado a ${week.n}`); }
        else if (drag?.type === 'assignment') { state.assignments = state.assignments.map(a => a.id === drag.id ? moveToWeek(a, week.id) : a); commit(`Pauta movida a ${week.n}`); }
        drag = null;
      });
      column.append(head, body); grid.append(column);
    });
  }
  function openAssignment(id = '', weekId = '') {
    const item = state.assignments.find(a => a.id === id) ?? null;
    const week = WEEKS.find(w => w.id === (item?.weekId ?? weekId)) ?? WEEKS[0];
    const form = formOf('assignment');
    form.dataset.id = id; dialogs.assignment.querySelector('[data-dialog-title]').textContent = item ? 'Editar pauta del calendario' : `Agregar pauta · ${week.n}`;
    fill(form.elements.spotId, state.spots, spot => spot.name, item?.spotId ?? state.spots[0]?.id);
    form.elements.start.value = item?.start ?? week.start; form.elements.end.value = item?.end ?? week.end; form.elements.note.value = item?.note ?? '';
    dialogs.assignment.showModal();
  }
  formOf('assignment').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget; const id = form.dataset.id;
    const start = form.elements.start.value; const end = form.elements.end.value;
    if (!datesOk(start, end)) return;
    const week = weekFor(start) ?? weekFor(end);
    const data = { id: id || uid('as'), spotId: form.elements.spotId.value, weekId: week?.id ?? 'w1', start, end, note: form.elements.note.value.trim() };
    if (id) state.assignments = state.assignments.map(a => a.id === id ? data : a); else state.assignments.push(data);
    dialogs.assignment.close(); commit('Pauta guardada');
  });
  $('[data-plan-seed]').addEventListener('click', () => {
    if (!confirm('¿Restaurar la estrategia sugerida? Se reemplazarán las pautas actuales del calendario.')) return;
    state.assignments = suggestedAssignments(state.spots); commit('Estrategia sugerida restaurada');
  });
  $('[data-plan-clear]').addEventListener('click', () => {
    if (!confirm('¿Limpiar todas las pautas del calendario?')) return;
    state.assignments = []; commit('Calendario limpio');
  });

  /* 3. Medios de pauta */
  const coverageClass = { Nacional: 'national', Regional: 'regional', Local: 'local' };
  function renderMedia() {
    const body = $('[data-media-rows]'); body.replaceChildren();
    if (!state.media.length) { const row = node('tr'); const cell = node('td', 'Aún no hay medios registrados. Usa «+ Añadir medio» para crear tu base.', 'mc-empty'); cell.colSpan = 9; row.append(cell); body.append(row); return; }
    for (const media of state.media) {
      const row = node('tr');
      const name = node('td'); name.append(node('strong', media.name)); if (media.notes) name.append(node('small', media.notes)); if (media.sourceId) name.append(node('small', 'Vinculado a Medios registrados', 'mc-linked'));
      const coverage = node('td'); coverage.append(node('span', media.coverage, `mc-pill mc-pill--${coverageClass[media.coverage] ?? 'local'}`));
      const state_ = node('td'); state_.append(node('span', media.status === 'active' ? 'Activo' : 'Por confirmar', `mc-status mc-status--${media.status}`));
      const actions = node('td', undefined, 'mc-actions');
      actions.append(button('Editar', 'button-quiet mc-small', () => openMedia(media.id)), button('Eliminar', 'button-quiet mc-small mc-danger', () => deleteMedia(media.id)));
      row.append(name, node('td', media.type), coverage, node('td', media.city || '—'), node('td', media.program || '—'), node('td', media.contact || '—'), node('td', money(media.rate), 'mc-num'), state_, actions);
      body.append(row);
    }
  }
  let sources = null;
  async function loadSources(select) {
    if (sources) return;
    sources = [];
    try {
      for (let page = 1; page <= 20; page++) {
        const data = await client.list({ page, pageSize: 100 });
        sources.push(...data.items);
        if (page >= (data.pagination?.pages ?? 1)) break;
      }
      sources.sort((a, b) => String(a.media_name).localeCompare(String(b.media_name), 'es'));
      for (const item of sources) { const option = node('option', [item.media_name, item.city].filter(Boolean).join(' · ')); option.value = item.public_id; select.append(option); }
    } catch (error) { sources = null; if (error.status === 401) location.replace('/admin/'); else toast('No se pudo cargar la lista de Medios registrados.'); }
  }
  function openMedia(id = '') {
    const media = state.media.find(item => item.id === id) ?? null;
    const form = formOf('media'); const source = dialogs.media.querySelector('[data-media-source]');
    form.dataset.id = id; form.dataset.source = media?.sourceId ?? '';
    dialogs.media.querySelector('[data-dialog-title]').textContent = media ? 'Editar medio' : 'Añadir medio';
    for (const key of ['name', 'city', 'program', 'contact', 'notes']) form.elements[key].value = media?.[key] ?? '';
    form.elements.type.value = media?.type ?? 'Radio'; form.elements.coverage.value = media?.coverage ?? 'Local'; form.elements.rate.value = media?.rate ?? 0; form.elements.status.value = media?.status ?? 'active';
    source.value = media?.sourceId ?? '';
    dialogs.media.showModal();
    loadSources(source).then(() => { source.value = media?.sourceId ?? ''; });
  }
  dialogs.media.querySelector('[data-media-source]').addEventListener('change', event => {
    const form = formOf('media');
    const item = sources?.find(source => source.public_id === event.target.value);
    form.dataset.source = item?.public_id ?? '';
    if (!item) return;
    const data = mediaFromSource(item);
    form.elements.name.value = data.name; form.elements.type.value = data.type; form.elements.city.value = data.city; form.elements.program.value = data.program;
  });
  formOf('media').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget; const id = form.dataset.id;
    const name = form.elements.name.value.trim();
    if (!name) return toast('Escribe el nombre del medio.');
    const data = { id: id || uid('media'), name, type: form.elements.type.value, coverage: form.elements.coverage.value, city: form.elements.city.value.trim(), program: form.elements.program.value.trim(), contact: form.elements.contact.value.trim(), rate: Math.max(0, Number(form.elements.rate.value) || 0), status: form.elements.status.value, notes: form.elements.notes.value.trim(), sourceId: form.dataset.source || '' };
    if (id) state.media = state.media.map(item => item.id === id ? data : item); else state.media.push(data);
    dialogs.media.close(); commit('Medio guardado');
  });
  function deleteMedia(id) {
    if (!confirm('¿Eliminar este medio? También se eliminarán sus pautas del plan de medios.')) return;
    state.media = state.media.filter(item => item.id !== id);
    state.plans = state.plans.filter(item => item.mediaId !== id);
    commit('Medio eliminado');
  }
  $('[data-media-new]').addEventListener('click', () => openMedia());

  /* 4. Plan de medios */
  function renderPlan() {
    const { rows, total, impacts } = planRows(state);
    const kpis = $('[data-plan-kpis]'); kpis.replaceChildren();
    for (const [label, value] of [['Medios registrados', state.media.length], ['Pautas planificadas', state.plans.length], ['Impactos / inserciones', numberFormat.format(impacts)], ['Inversión total', money(total)]]) { const box = node('div', undefined, 'mc-kpi'); box.append(node('span', label), node('strong', value)); kpis.append(box); }
    const body = $('[data-plan-rows]'); body.replaceChildren();
    if (!rows.length) { const row = node('tr'); const cell = node('td', 'Aún no hay pautas. Primero registra medios y luego crea el plan.', 'mc-empty'); cell.colSpan = 12; row.append(cell); body.append(row); return; }
    for (const row of rows) {
      const tr = node('tr'); const name = node('td'); name.append(node('strong', row.media?.name ?? 'Medio eliminado'));
      const investment = node('td', undefined, 'mc-num'); investment.append(node('strong', money(row.investment)));
      const actions = node('td', undefined, 'mc-actions');
      actions.append(button('Editar', 'button-quiet mc-small', () => openPlan(row.plan.id)), button('Eliminar', 'button-quiet mc-small mc-danger', () => { state.plans = state.plans.filter(item => item.id !== row.plan.id); commit('Pauta eliminada'); }));
      tr.append(name, node('td', row.media?.type ?? '—'), node('td', row.spot?.name ?? 'Spot eliminado'), node('td', shortDate(row.plan.start)), node('td', shortDate(row.plan.end)), node('td', row.plan.freq, 'mc-num'), node('td', row.days, 'mc-num'), node('td', numberFormat.format(row.impacts), 'mc-num'), node('td', money(row.plan.cost), 'mc-num'), investment, node('td', row.plan.objective || '—'), actions);
      body.append(tr);
    }
  }
  function openPlan(id = '') {
    if (!state.media.length) return toast('Primero añade al menos un medio de comunicación.');
    if (!state.spots.length) return toast('Primero añade al menos un spot.');
    const plan = state.plans.find(item => item.id === id) ?? null;
    const form = formOf('plan');
    form.dataset.id = id; dialogs.plan.querySelector('[data-dialog-title]').textContent = plan ? 'Editar pauta' : 'Añadir pauta al plan de medios';
    fill(form.elements.mediaId, state.media, media => `${media.name} — ${media.type}`, plan?.mediaId ?? state.media[0].id);
    fill(form.elements.spotId, state.spots, spot => spot.name, plan?.spotId ?? state.spots[0].id);
    form.elements.start.value = plan?.start ?? CAMPAIGN_START; form.elements.end.value = plan?.end ?? CAMPAIGN_END;
    form.elements.freq.value = plan?.freq ?? 3;
    form.elements.cost.value = plan?.cost ?? state.media.find(media => media.id === form.elements.mediaId.value)?.rate ?? 0;
    form.elements.objective.value = plan?.objective ?? '';
    dialogs.plan.showModal();
  }
  formOf('plan').elements.mediaId.addEventListener('change', event => { const media = state.media.find(item => item.id === event.target.value); if (media) formOf('plan').elements.cost.value = media.rate || 0; });
  formOf('plan').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget; const id = form.dataset.id;
    const start = form.elements.start.value; const end = form.elements.end.value;
    if (!datesOk(start, end)) return;
    const data = { id: id || uid('plan'), mediaId: form.elements.mediaId.value, spotId: form.elements.spotId.value, start, end, freq: Math.min(500, Math.max(1, Number.parseInt(form.elements.freq.value, 10) || 1)), cost: Math.max(0, Number(form.elements.cost.value) || 0), objective: form.elements.objective.value.trim() };
    if (id) state.plans = state.plans.map(item => item.id === id ? data : item); else state.plans.push(data);
    dialogs.plan.close(); commit('Pauta añadida al plan de medios');
  });
  $('[data-plan-new]').addEventListener('click', () => openPlan());

  /* 5. Reportes */
  const canvas = $('[data-report-canvas]');
  const reportType = $('[data-report-type]');
  const reportName = () => reportType.value === 'calendar' ? 'calendario_estrategico_finados_2026' : 'plan_de_medios_finados_2026';
  async function renderReport() {
    try { await document.fonts?.load(`800 20px Inter`); } catch { /* sin la fuente, usa la del sistema */ }
    if (reportType.value === 'calendar') drawCalendarReport(canvas, state); else drawMediaReport(canvas, state);
  }
  const download = (blob, name) => { const link = node('a'); link.href = URL.createObjectURL(blob); link.download = name; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(link.href), 4000); };
  reportType.addEventListener('change', renderReport);
  $('[data-report-png]').addEventListener('click', async () => { await renderReport(); canvas.toBlob(blob => { if (blob) { download(blob, `${reportName()}.png`); toast('Imagen generada'); } }, 'image/png'); });
  $('[data-report-pdf]').addEventListener('click', async () => {
    await renderReport();
    canvas.toBlob(async blob => {
      if (!blob) return;
      const jpeg = new Uint8Array(await blob.arrayBuffer());
      // A3 horizontal para el calendario, A4 horizontal para el plan de medios, como el original.
      const [pageWidth, pageHeight] = reportType.value === 'calendar' ? [1190.55, 841.89] : [841.89, 595.28];
      download(new Blob([pdfFromJpeg(jpeg, canvas.width, canvas.height, pageWidth, pageHeight)], { type: 'application/pdf' }), `${reportName()}.pdf`);
      toast('PDF generado');
    }, 'image/jpeg', 0.95);
  });
  $('[data-report-print]').addEventListener('click', async () => { await renderReport(); print(); });

  /* Respaldo e importación */
  $('[data-plan-backup]').addEventListener('click', () => {
    download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), 'respaldo_plan_comunicacion_2026.json');
  });
  $('[data-plan-import]').addEventListener('change', async event => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      const data = importedPlan(JSON.parse(await file.text()));
      if (!confirm(`¿Reemplazar el calendario actual por el del respaldo? Trae ${data.spots.length} spots, ${data.assignments.length} pautas, ${data.media.length} medios y ${data.plans.length} pautas del plan.`)) return;
      state = data; commit('Respaldo importado');
    } catch (error) { toast(error instanceof SyntaxError ? 'El archivo no es un JSON válido.' : error.message); }
  });

  function renderAll() {
    renderSpots(); renderCalendar(); renderMedia(); renderPlan();
    if (!root.querySelector('[data-plan-panel="reportes"]').hidden) renderReport();
  }

  async function loadPlan() {
    const data = await client.mediaPlan();
    version = data.version;
    if (data.data) { state = data.data; feedback(saveLine, `Calendario compartido del equipo · versión ${version}`); }
    else { state = initialPlan(); feedback(saveLine, 'Estrategia sugerida de partida: se guardará para todo el equipo con tu primer cambio.'); }
    renderAll();
  }

  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await client.logout(); location.replace('/admin/'); } catch (error) { logout.disabled = false; fail(error); }
  });
  async function start() {
    retry.hidden = true; feedback(status, 'Cargando calendario…');
    try {
      const session = await client.session();
      if (!session.authenticated) { location.replace('/admin/'); return; }
      $('[data-admin-user]').textContent = `Sesión de ${session.user.username}`;
      if (sidebarUser) sidebarUser.textContent = session.user.username;
      if (logout) logout.disabled = false;
      await loadPlan();
      for (const control of root.querySelectorAll('[data-spot-new], [data-media-new], [data-plan-new], [data-plan-seed], [data-plan-clear], [data-plan-backup], [data-plan-import]')) control.disabled = false;
      feedback(status, '');
      goTab(location.hash.slice(1));
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', start);
  await start();
}

if (typeof document !== 'undefined') initializeMediaPlan();
