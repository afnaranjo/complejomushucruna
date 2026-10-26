import { qrcode } from './qrcode-generator.mjs';
import { isAllowedSiteOrigin } from './runtime-origins.mjs';

const HEX32 = /^[a-f0-9]{32}$/;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/**
 * Enlace que viaja en el QR de un medio confirmado. Solo lleva los identificadores públicos del evento
 * y del medio; la página de acreditación muestra si ese medio está confirmado, sin datos de contacto.
 */
export function mediaPassUrl(eventId, mediaId, siteOrigin) {
  if (typeof eventId !== 'string' || !HEX32.test(eventId)) throw new TypeError('Identificador de evento inválido.');
  if (typeof mediaId !== 'string' || !HEX32.test(mediaId)) throw new TypeError('Identificador de medio inválido.');
  if (!isAllowedSiteOrigin(siteOrigin)) throw new TypeError('Origen de acreditación inválido.');
  return `${siteOrigin}/finados/medios/acreditacion/?evento=${eventId}&medio=${mediaId}`;
}

/** «2026-10-30» → «30 de octubre de 2026». */
export function passDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  return match ? `${Number(match[3])} de ${MONTHS[Number(match[2]) - 1]} de ${match[1]}` : '';
}

export function mediaPassFileName(mediaName) {
  const slug = String(mediaName ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return `qr-medio-${slug || 'confirmado'}.png`;
}

function wrap(context, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width <= maxWidth || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s*\S*$/, '')}…`; }
  return lines;
}

/** Tarjeta 1080 × 1350 con el QR del medio confirmado, lista para imprimir o enviar por WhatsApp. */
export function drawMediaPass(canvas, { url, mediaName, eventName, eventDate = '', place = '' }) {
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const sans = '"Inter", "Helvetica Neue", Arial, sans-serif';
  context.fillStyle = '#241146'; context.fillRect(0, 0, W, H);
  // Cenefa superior con los colores de Finados.
  const stripes = ['#ff2e8a', '#ffd23f', '#22d3c5', '#7b2cbf'];
  stripes.forEach((color, index) => { context.fillStyle = color; context.fillRect(index * (W / 4), 0, W / 4, 18); });
  context.textAlign = 'center'; context.textBaseline = 'alphabetic';
  context.fillStyle = '#ffd23f'; context.font = `800 34px ${sans}`;
  context.fillText('PASE DE MEDIO CONFIRMADO', W / 2, 92);
  context.fillStyle = '#ffffff'; context.font = `900 66px ${sans}`;
  let y = 182;
  for (const line of wrap(context, mediaName || 'Medio', W - 140, 2)) { context.fillText(line, W / 2, y); y += 74; }
  context.fillStyle = '#f7d9ff'; context.font = `600 34px ${sans}`;
  for (const line of wrap(context, eventName || '', W - 160, 2)) { context.fillText(line, W / 2, y + 4); y += 44; }
  const meta = [passDate(eventDate), place].filter(Boolean).join(' · ');
  if (meta) { context.fillStyle = '#22d3c5'; context.font = `600 30px ${sans}`; context.fillText(meta, W / 2, y + 8); }
  // QR sobre fondo blanco, siempre en el mismo lugar para que la tarjeta se escanee igual.
  const code = qrcode(0, 'M');
  code.addData(url, 'Byte');
  code.make();
  const modules = code.getModuleCount();
  const box = 640, quiet = 4, top = 470, left = (W - box) / 2;
  context.fillStyle = '#ffffff';
  if (context.roundRect) { context.beginPath(); context.roundRect(left - 16, top - 16, box + 32, box + 32, 28); context.fill(); } else context.fillRect(left - 16, top - 16, box + 32, box + 32);
  const cell = box / (modules + quiet * 2);
  context.fillStyle = '#241146';
  for (let row = 0; row < modules; row += 1) for (let column = 0; column < modules; column += 1) {
    if (code.isDark(row, column)) context.fillRect(left + (column + quiet) * cell, top + (row + quiet) * cell, cell + 0.4, cell + 0.4);
  }
  context.fillStyle = '#ffffff'; context.font = `700 32px ${sans}`;
  context.fillText('Presenta este QR en el ingreso de prensa', W / 2, 1200);
  context.fillStyle = '#ff2e8a'; context.font = `800 30px ${sans}`;
  context.fillText('FINADOS MUSHUC RUNA 2026 · LEGADO QUE NOS UNE', W / 2, 1268);
  return canvas;
}
