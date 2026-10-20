import { isAllowedSiteOrigin, MIRROR_API_BASE, PRIMARY_API_BASE, PRIMARY_SITE_ORIGIN, resolveRuntimeOrigins } from '../finados/runtime-origins.mjs';
import { qrcode } from '../finados/qrcode-generator.mjs';
import './sidebar.js?v=20260926-admin-sidebar-3';
import './campaign-banner.js?v=20261001-banner-3';

const API = PRIMARY_API_BASE;
const LOCAL_API = 'http://127.0.0.1:4174/api';

export class PaseDoradoAdminError extends Error {
  constructor(status) {
    super(({
      0: 'No se pudo conectar. Revisa tu conexión.',
      401: 'Tu sesión terminó. Vuelve a iniciar sesión.',
      403: 'Tu rol no tiene acceso a Pase dorado.',
      404: 'No se encontró ese pase.',
      409: 'Esa cédula ya tiene otro pase dorado.',
      422: 'Revisa los datos e intenta de nuevo.',
    })[status] || 'No se pudo completar la acción.');
    this.status = status;
  }
}

export function createPaseDoradoClient(baseUrl = API, fetchImplementation = fetch) {
  if (![API, MIRROR_API_BASE, LOCAL_API].filter(Boolean).includes(baseUrl)) throw new Error('Origen de API no permitido.');
  let csrf = '';
  async function request(path, options = {}) {
    if (!/^\/(?:auth\/(?:session|logout)|pases-dorados(?:\/verificar|\/[a-f0-9]{32}(?:\/archivar)?)?)$/.test(path)) throw new Error('Ruta de API no permitida.');
    const method = (options.method ?? 'GET').toUpperCase();
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') {
      if (!csrf) throw new PaseDoradoAdminError(403);
      headers['X-CSRF-Token'] = csrf;
      headers['Content-Type'] = 'application/json';
    }
    let response;
    try {
      response = await fetchImplementation(`${baseUrl}${path}`, {
        method, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers,
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
      });
    } catch { throw new PaseDoradoAdminError(0); }
    if (!response.ok) throw new PaseDoradoAdminError(response.status);
    let data;
    try { data = await response.json(); } catch { throw new PaseDoradoAdminError(502); }
    if (typeof data.csrf === 'string') csrf = data.csrf;
    return data;
  }
  return {
    session: () => request('/auth/session'),
    logout: () => request('/auth/logout', { method: 'POST' }),
    list: () => request('/pases-dorados'),
    create: lines => request('/pases-dorados', { method: 'POST', body: { lines } }),
    update: (id, body) => request(`/pases-dorados/${id}`, { method: 'PATCH', body }),
    archive: id => request(`/pases-dorados/${id}/archivar`, { method: 'POST', body: {} }),
    check: cedula => request('/pases-dorados/verificar', { method: 'POST', body: { cedula } }),
  };
}

/* ---------- Funciones puras (probadas) ---------- */

/** Solo dígitos: acepta «180-123-4567» o con espacios. */
export function normalizeCedula(value) {
  return String(value ?? '').replace(/[\s.-]/g, '');
}

export function isCedula(value) {
  return /^\d{10}$/.test(normalizeCedula(value));
}

/** Lee el texto pegado: cada línea con un nombre y una cédula; avisa qué líneas no se entienden. */
export function parseLines(text) {
  const entries = [];
  const invalid = [];
  String(text ?? '').split(/\r?\n/).forEach((raw, index) => {
    if (!raw.trim()) return;
    const numbers = raw.match(/(?<!\d)\d{10}(?!\d)/g) ?? [];
    const rest = numbers.length === 1 ? raw.replace(numbers[0], ' ') : raw;
    const name = rest.replace(/\s+/g, ' ').trim().replace(/^[\s,;:|–—-]+|[\s,;:|–—-]+$/g, '');
    if (numbers.length !== 1 || /\d/.test(rest) || name.length < 2) invalid.push(index + 1);
    else entries.push({ name, cedula: numbers[0] });
  });
  return { entries, invalid };
}

/** El QR impreso lleva a la validación del pase; no contiene la cédula. */
export function verificationUrl(siteOrigin, publicId) {
  if (!/^[a-f0-9]{32}$/.test(String(publicId))) throw new TypeError('Identificador de pase inválido.');
  return `${siteOrigin}/finados/pase-dorado/verificar/?id=${publicId}`;
}

export function maskCedula(cedula) {
  const digits = normalizeCedula(cedula).replace(/\D/g, '');
  if (digits.length <= 5) return '•'.repeat(digits.length);
  return `${digits.slice(0, 3)}${'•'.repeat(digits.length - 5)}${digits.slice(-2)}`;
}

export function matchesPass(pass, { search = '', status = '' } = {}) {
  if (status && pass.status !== status) return false;
  const term = search.trim().toLowerCase();
  if (!term) return true;
  const digits = term.replace(/\D/g, '');
  return pass.full_name.toLowerCase().includes(term) || (digits.length >= 3 && pass.cedula.includes(digits));
}

/** Nombre del archivo PNG: «pase-dorado-ana-perez.png». */
export function qrFileName(name) {
  const slug = String(name ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return `pase-dorado-${slug || 'qr'}.png`;
}

/* ---------- Dibujo del QR ---------- */

function paintQr(context, value, x, y, size) {
  const code = qrcode(0, 'M');
  code.addData(value, 'Byte');
  code.make();
  const modules = code.getModuleCount();
  const cell = size / (modules + 8);
  context.fillStyle = '#ffffff';
  context.fillRect(x, y, size, size);
  context.fillStyle = '#1b0f2b';
  for (let row = 0; row < modules; row += 1) for (let column = 0; column < modules; column += 1) {
    if (code.isDark(row, column)) context.fillRect(x + (column + 4) * cell, y + (row + 4) * cell, cell + 0.4, cell + 0.4);
  }
}

function fitText(context, text, maxWidth, size, weight = 800) {
  let current = size;
  do { context.font = `${weight} ${current}px Inter, system-ui, sans-serif`; current -= 2; } while (context.measureText(text).width > maxWidth && current > 14);
}

/** Solo el QR, pequeño, para la tabla. */
export function drawQrThumb(canvas, url, size = 132) {
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d');
  if (context) paintQr(context, url, 0, 0, size);
  return canvas;
}

/** Tarjeta del QR lista para imprimir: marco dorado, «PASE DORADO», nombre y cédula enmascarada. */
export function drawPassCard(canvas, pass, url) {
  const width = 640; const height = 820;
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height);
  context.strokeStyle = '#d4a017'; context.lineWidth = 14; context.strokeRect(7, 7, width - 14, height - 14);
  context.fillStyle = '#1b0f2b'; context.textAlign = 'center';
  context.font = '900 46px Inter, system-ui, sans-serif';
  context.fillText('PASE DORADO', width / 2, 74);
  context.fillStyle = '#9a7412'; context.font = '700 20px Inter, system-ui, sans-serif';
  context.fillText('FINADOS MUSHUC RUNA 2026', width / 2, 104);
  paintQr(context, url, 70, 126, 500);
  context.fillStyle = '#1b0f2b';
  fitText(context, pass.full_name, width - 80, 34);
  context.fillText(pass.full_name, width / 2, 690);
  context.font = '600 26px Inter, system-ui, sans-serif'; context.fillStyle = '#4a3a5c';
  context.fillText(`C.I. ${maskCedula(pass.cedula)}`, width / 2, 734);
  context.font = '500 18px Inter, system-ui, sans-serif'; context.fillStyle = '#6b5b7b';
  context.fillText('Escanea para validar · personal e intransferible', width / 2, 780);
  return canvas;
}

/* ---------- Pantalla ---------- */

const STATUS_LABELS = Object.freeze({ valido: 'Válido', anulado: 'No permitido' });

function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}

export async function initializePaseDorado() {
  const panel = document.querySelector('[data-admin-pase-dorado]');
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
  if (!isAllowedSiteOrigin(location.origin) && location.hostname !== (LOCAL_API ? new URL(LOCAL_API).hostname : '')) { status.textContent = 'Origen no permitido.'; status.dataset.error = 'true'; return; }
  // El QR impreso apunta al sitio desde el que se generó (principal o espejo); en local, al principal.
  const siteOrigin = isAllowedSiteOrigin(location.origin) ? location.origin : PRIMARY_SITE_ORIGIN;
  const client = createPaseDoradoClient(base);
  const logout = document.querySelector('[data-admin-logout]');
  const feedback = (message, tone = '') => { status.textContent = message; status.dataset.error = String(tone === 'error'); status.dataset.success = String(tone === 'success'); };
  const fail = error => { if (error.status === 401) { location.replace('/admin/'); return; } feedback(error.message, 'error'); };
  const state = { passes: [], totals: {}, search: '', filter: '' };
  const rows = query('[data-rows]');
  const listMessage = query('[data-list-message]');
  const summary = query('[data-summary]');

  function renderSummary() {
    const totals = state.totals;
    const metrics = [['Pases registrados', totals.total], ['Válidos', totals.valido], ['No permitidos', totals.anulado]];
    summary.replaceChildren(...metrics.map(([label, value]) => { const block = node('dl'); block.append(node('dt', label), node('dd', String(value ?? 0))); return block; }));
    summary.setAttribute('aria-busy', 'false');
  }

  function downloadCard(pass) {
    const canvas = drawPassCard(document.createElement('canvas'), pass, verificationUrl(siteOrigin, pass.public_id));
    canvas.toBlob(blob => {
      if (!blob) { feedback('No se pudo generar la imagen del QR.', 'error'); return; }
      const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: qrFileName(pass.full_name) });
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'image/png');
  }

  function passRow(pass) {
    const row = node('tr');
    row.dataset.status = pass.status;
    const who = node('td');
    who.dataset.label = 'Persona';
    who.append(node('strong', pass.full_name, 'record-name'), node('small', `C.I. ${pass.cedula}`));
    if (pass.note) who.append(node('small', `Nota: ${pass.note}`));
    const qr = node('td', undefined, 'pd-qr-cell');
    qr.dataset.label = 'QR';
    const thumb = document.createElement('canvas');
    thumb.className = 'pd-qr-thumb';
    thumb.setAttribute('role', 'img');
    thumb.setAttribute('aria-label', `QR del pase de ${pass.full_name}`);
    drawQrThumb(thumb, verificationUrl(siteOrigin, pass.public_id));
    qr.append(thumb);
    const statusCell = node('td');
    statusCell.dataset.label = 'Estado';
    const select = document.createElement('select');
    select.className = 'pd-status';
    select.setAttribute('aria-label', `Estado del pase de ${pass.full_name}`);
    for (const [value, text] of Object.entries(STATUS_LABELS)) select.append(Object.assign(node('option', text), { value }));
    select.value = pass.status;
    select.dataset.status = pass.status;
    select.addEventListener('change', async () => {
      try { await client.update(pass.public_id, { status: select.value }); feedback(`${pass.full_name}: ${STATUS_LABELS[select.value].toLowerCase()}.`, 'success'); await refresh(); }
      catch (error) { fail(error); await refresh(); }
    });
    statusCell.append(select);
    const actions = node('td', undefined, 'inf-actions');
    const download = node('button', 'Descargar QR', 'button-primary');
    download.type = 'button';
    download.addEventListener('click', () => downloadCard(pass));
    const view = Object.assign(node('a', 'Probar QR', 'button-quiet'), { href: verificationUrl(siteOrigin, pass.public_id), target: '_blank', rel: 'noopener' });
    const edit = node('button', 'Editar', 'button-quiet');
    edit.type = 'button';
    edit.addEventListener('click', () => openEdit(pass));
    const remove = node('button', 'Retirar', 'button-danger');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!confirm(`¿Retirar el pase de ${pass.full_name}? Su QR y su cédula dejarán de ser válidos. Queda en el historial.`)) return;
      try { await client.archive(pass.public_id); feedback(`El pase de ${pass.full_name} fue retirado.`, 'success'); await refresh(); } catch (error) { fail(error); }
    });
    actions.append(download, view, edit, remove);
    row.append(who, qr, statusCell, actions);
    return row;
  }

  function renderRows() {
    const visible = state.passes.filter(pass => matchesPass(pass, { search: state.search, status: state.filter }));
    rows.replaceChildren(...visible.map(passRow));
    listMessage.textContent = state.passes.length === 0 ? 'Todavía no hay pases. Agrégalos arriba con nombre y cédula.' : `${visible.length} de ${state.passes.length}`;
    query('[data-list-region]').setAttribute('aria-busy', 'false');
  }

  async function refresh() {
    const data = await client.list();
    state.passes = data.passes ?? [];
    state.totals = data.totals ?? {};
    renderSummary();
    renderRows();
    query('[data-print-all]').disabled = !state.passes.some(pass => pass.status === 'valido');
  }

  query('[data-filter]').addEventListener('change', event => { state.filter = event.target.value; renderRows(); });
  query('[data-search]').addEventListener('input', event => { state.search = event.target.value; renderRows(); });

  // Verificar cédula en la entrada.
  const checkForm = query('[data-check-form]');
  const checkResult = query('[data-check-result]');
  checkForm.addEventListener('submit', async event => {
    event.preventDefault();
    const input = checkForm.elements.cedula;
    const cedula = normalizeCedula(input.value);
    if (!isCedula(cedula)) { checkResult.hidden = false; checkResult.dataset.state = 'error'; query('[data-check-state]').textContent = 'Cédula incompleta'; query('[data-check-detail]').textContent = 'Escribe los 10 dígitos.'; input.focus(); return; }
    try {
      const { check } = await client.check(cedula);
      checkResult.hidden = false;
      checkResult.dataset.state = check.valid ? 'valid' : 'invalid';
      query('[data-check-state]').textContent = check.valid ? '✓ VÁLIDO' : '✕ NO PERMITIDO';
      query('[data-check-detail]').textContent = check.found
        ? `${check.name} · C.I. ${check.cedula_masked}${check.valid ? '' : ' · pase anulado'}`
        : `C.I. ${check.cedula_masked} no tiene pase dorado.`;
      input.select();
    } catch (error) { fail(error); }
  });

  // Agregar pases en lote.
  const addForm = query('[data-add-form]');
  addForm.addEventListener('submit', async event => {
    event.preventDefault();
    const text = addForm.elements.lines.value;
    const { entries, invalid } = parseLines(text);
    if (invalid.length) { feedback(`Revisa ${invalid.length === 1 ? 'la línea' : 'las líneas'} ${invalid.join(', ')}: cada una necesita un nombre y una cédula de 10 dígitos.`, 'error'); addForm.elements.lines.focus(); return; }
    if (!entries.length) { feedback('Escribe al menos un nombre con su cédula.', 'error'); addForm.elements.lines.focus(); return; }
    const button = addForm.querySelector('button');
    button.disabled = true;
    try {
      const data = await client.create(text);
      addForm.reset();
      await refresh();
      const created = data.passes.length;
      const skipped = (data.skipped ?? []).map(item => item.full_name);
      feedback(`${created === 1 ? 'Se agregó 1 pase' : `Se agregaron ${created} pases`}.${skipped.length ? ` Ya tenían pase (no se duplicaron): ${skipped.join(', ')}.` : ''}`, 'success');
    } catch (error) { fail(error); }
    finally { button.disabled = false; }
  });

  // Hoja para imprimir: los QR de todos los pases válidos.
  const printSheet = query('[data-print-sheet]');
  // La hoja vive directo en <body> para que al imprimir solo salgan los QR.
  document.body.append(printSheet);
  const cardBlob = pass => new Promise(resolve => drawPassCard(document.createElement('canvas'), pass, verificationUrl(siteOrigin, pass.public_id)).toBlob(resolve, 'image/png'));
  query('[data-print-all]').addEventListener('click', async () => {
    const button = query('[data-print-all]');
    button.disabled = true;
    feedback('Preparando la hoja para imprimir…');
    for (const image of printSheet.querySelectorAll('img')) URL.revokeObjectURL(image.src);
    const items = [];
    for (const pass of state.passes.filter(item => item.status === 'valido')) {
      const blob = await cardBlob(pass);
      if (!blob) continue;
      const figure = node('figure', undefined, 'pd-print__item');
      figure.append(Object.assign(document.createElement('img'), { src: URL.createObjectURL(blob), alt: `QR del pase de ${pass.full_name}` }));
      items.push(figure);
    }
    printSheet.replaceChildren(...items);
    // Esperar a que las imágenes estén listas antes de abrir el diálogo de impresión.
    await Promise.all([...printSheet.querySelectorAll('img')].map(image => image.decode().catch(() => {})));
    button.disabled = false;
    feedback('');
    globalThis.print();
  });

  const dialog = query('[data-edit-dialog]');
  const editForm = dialog.querySelector('form');
  const editFeedback = dialog.querySelector('[data-edit-feedback]');
  let editing = null;
  function openEdit(pass) {
    editing = pass;
    editForm.elements.full_name.value = pass.full_name;
    editForm.elements.cedula.value = pass.cedula;
    editForm.elements.note.value = pass.note;
    editFeedback.textContent = '';
    dialog.showModal();
    editForm.elements.full_name.focus();
  }
  editForm.addEventListener('submit', async event => {
    if (event.submitter?.value === 'cancel' || !editing) return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(editForm));
    if (!isCedula(values.cedula)) { editFeedback.textContent = 'La cédula debe tener 10 dígitos.'; editFeedback.dataset.error = 'true'; return; }
    try {
      await client.update(editing.public_id, { full_name: values.full_name.trim(), cedula: normalizeCedula(values.cedula), note: values.note.trim() });
      dialog.close();
      feedback(`Pase de ${values.full_name.trim()} guardado.`, 'success');
      await refresh();
    } catch (error) {
      editFeedback.textContent = error.status === 422 ? 'Revisa el nombre (sin números) y la cédula (10 dígitos).' : error.message;
      editFeedback.dataset.error = 'true';
      if (error.status === 401) fail(error);
    }
  });

  logout?.addEventListener('click', async () => {
    logout.disabled = true;
    try { await client.logout(); location.replace('/admin/'); } catch (error) { logout.disabled = false; fail(error); }
  });

  async function start() {
    retry.hidden = true;
    try {
      const session = await client.session();
      if (!session.authenticated) { location.replace('/admin/'); return; }
      query('[data-admin-user]').textContent = `Sesión de ${session.user.full_name ?? session.user.username}`;
      if (logout) logout.disabled = false;
      await refresh();
      checkForm.querySelector('fieldset').disabled = false;
      addForm.querySelector('button').disabled = false;
      feedback('');
      checkForm.elements.cedula.focus();
    } catch (error) { fail(error); retry.hidden = false; }
  }
  retry.addEventListener('click', start);
  await start();
}

if (typeof document !== 'undefined') initializePaseDorado();
