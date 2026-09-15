const SHEETS = Object.freeze({
  media: '1j0OjpWgHNok9OTRNXr0llpjBybrxUMlUnbhM3ukVj8M',
  brunch: '1VCnaIEGFnrqtCBZHUQ51APzqYfK4ZrGqDgJvTKt2rEM',
  voceros: '1Z4MzXyyyA-V8wb1a2eaOodjb_VzqQm1qTDOtBf1gyuI',
});

const HEADERS = Object.freeze({
  media: [
    'Fecha de envío', 'ID', 'Nombre del medio', 'Tipo de medio', 'Frecuencia / canal',
    'Programa o espacio', 'Tipo de programa', 'Provincia', 'Ciudad', 'Contrato vigente',
    'Personas', 'Nombres y cargos', 'Teléfono / WhatsApp', 'Correo', 'Aceptó condiciones',
  ],
  brunch: [
    'Fecha de confirmación', 'ID de registro', 'Código', 'Nombre', 'Empresa',
    'Cargo / referencia', 'Asistencia', 'Acompañantes', 'Total personas', 'Comentarios', 'Fuente',
  ],
  voceros: [
    'Fecha de envío', 'ID', 'Estado', 'Nombre completo', 'Cédula', 'Fecha de nacimiento', 'Edad',
    'WhatsApp', 'Correo', 'Ciudad', 'TikTok', 'Instagram', 'Facebook', 'Red principal',
    'Vocero anterior', 'Cómo se enteró', 'Retiro del kit', 'Representante', 'Cédula representante',
    'Teléfono representante', 'Correo representante', 'UTM source', 'UTM medium', 'UTM campaign',
    'UTM content', 'UTM term',
  ],
});

const CONSENT_HEADERS = Object.freeze([
  'Tipo', 'Aceptado', 'Versión', 'SHA-256', 'Fecha y hora', 'IP', 'Navegador', 'URL', 'Método', 'ID de registro',
]);

const VOCEROS_CONSENT_TYPES = Object.freeze(['politicas', 'imagen', 'datos']);

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function asCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function rowFor(kind, record) {
  if (kind === 'media') {
    return [
      record.submittedAt, record.id, record.nombre_medio, record.tipo_medio,
      record.frecuencia_canal, record.nombre_programa, record.tipo_programa,
      record.provincia, record.ciudad, record.contrato_mushuc, record.numero_personas,
      record.equipo, record.telefono, record.correo, record.acepta_condiciones,
    ].map(asCell);
  }
  if (kind === 'voceros') {
    return [
      record.submittedAt, record.id, record.status, record.nombre_completo, record.cedula,
      record.fecha_nacimiento, record.edad, record.whatsapp, record.correo, record.ciudad,
      record.tiktok, record.instagram, record.facebook, record.red_principal, record.vocero_previo,
      record.fuente_comunidad, record.retiro_kit, record.representante_nombre,
      record.representante_cedula, record.representante_telefono, record.representante_correo,
      record.utm_source, record.utm_medium, record.utm_campaign, record.utm_content, record.utm_term,
    ].map(asCell);
  }
  return [
    record.submittedAt, record.id, record.slug, record.name, record.company, record.role,
    record.attendance, record.companions, record.total, record.comments, record.source,
  ].map(asCell);
}

function consentRow(consent, submissionId) {
  return [
    consent.consentimiento_tipo, consent.aceptado, consent.texto_version, consent.texto_hash,
    consent.fecha_hora, consent.ip_origen, consent.user_agent, consent.url_origen,
    consent.metodo, submissionId,
  ].map(asCell);
}

function styleHeader(sheet, width) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, width)
    .setBackground('#391f6f')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
}

function ensureSheetSchema(kind, sheet) {
  const headers = HEADERS[kind];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    styleHeader(sheet, headers.length);
    return;
  }

  if (kind === 'brunch') {
    const width = Math.max(sheet.getLastColumn(), 10);
    const current = sheet.getRange(1, 1, 1, width).getValues()[0].map(String);
    const alreadyCurrent = current[4] === 'Empresa' && current[5] === 'Cargo / referencia';
    const legacySchema = current[4] === 'Empresa / cargo' && current[5] === 'Asistencia';
    if (!alreadyCurrent && legacySchema) sheet.insertColumnBefore(5);
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  styleHeader(sheet, headers.length);
}

function ensureBrunchSchema() {
  const spreadsheet = SpreadsheetApp.openById(SHEETS.brunch);
  ensureSheetSchema('brunch', spreadsheet.getSheets()[0]);
}

function ensureConsentSheet(spreadsheet) {
  const sheet = spreadsheet.getSheetByName('Consentimientos') || spreadsheet.insertSheet('Consentimientos');
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, CONSENT_HEADERS.length).setValues([CONSENT_HEADERS]);
    styleHeader(sheet, CONSENT_HEADERS.length);
  } else {
    sheet.getRange(1, 1, 1, CONSENT_HEADERS.length).setValues([CONSENT_HEADERS]);
  }
  return sheet;
}

function findSubmission(sheet, submissionId) {
  return sheet.getRange(1, 2, Math.max(sheet.getLastRow(), 1), 1)
    .createTextFinder(submissionId)
    .matchEntireCell(true)
    .findNext();
}

function vocerosPayload(record) {
  const id = String(record.submission_id || record.id || '').toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(id) || (record.id && String(record.id).toLowerCase() !== id)
    || (record.submission_id && String(record.submission_id).toLowerCase() !== id)
    || !Array.isArray(record.consents) || record.consents.length !== VOCEROS_CONSENT_TYPES.length) return null;

  const seen = new Set();
  const consents = [];
  for (const original of record.consents) {
    if (!original || typeof original !== 'object') return null;
    const type = String(original.consentimiento_tipo || '');
    const hash = String(original.texto_hash || '').toLowerCase();
    const accepted = original.aceptado === true || String(original.aceptado).toLowerCase() === 'true';
    if (!VOCEROS_CONSENT_TYPES.includes(type) || seen.has(type) || !accepted || !/^[a-f0-9]{64}$/.test(hash)
      || !String(original.texto_version || '') || !String(original.fecha_hora || '') || !String(original.metodo || '')) return null;
    seen.add(type);
    consents.push(Object.assign({}, original, {
      consentimiento_tipo: type,
      aceptado: 'true',
      texto_hash: hash,
      id_registro: id,
    }));
  }
  if (!VOCEROS_CONSENT_TYPES.every(type => seen.has(type))) return null;
  return { id, record: Object.assign({}, record, { id, submission_id: id, consents }), consents };
}

function consentKey(submissionId, consent) {
  return [submissionId, consent.consentimiento_tipo, String(consent.texto_hash).toLowerCase()].join('\u001f');
}

function storedConsentKeys(sheet, submissionId) {
  const keys = new Set();
  const rowCount = Math.max(0, sheet.getLastRow() - 1);
  if (rowCount === 0) return keys;
  const rows = sheet.getRange(2, 1, rowCount, CONSENT_HEADERS.length).getValues();
  rows.forEach((row) => {
    if (String(row[9]) !== submissionId) return;
    keys.add([submissionId, String(row[0]), String(row[3]).toLowerCase()].join('\u001f'));
  });
  return keys;
}

function persistVoceros(spreadsheet, sheet, payload) {
  if (!findSubmission(sheet, payload.id)) sheet.appendRow(rowFor('voceros', payload.record));
  const consentSheet = ensureConsentSheet(spreadsheet);
  const stored = storedConsentKeys(consentSheet, payload.id);
  payload.consents.forEach((consent) => {
    const key = consentKey(payload.id, consent);
    if (stored.has(key)) return;
    consentSheet.appendRow(consentRow(consent, payload.id));
    stored.add(key);
  });

  // Apps Script batches spreadsheet writes. Flush, then verify both sheets while
  // the script lock remains held before emitting the durable receipt.
  SpreadsheetApp.flush();
  const durableConsents = storedConsentKeys(consentSheet, payload.id);
  if (!findSubmission(sheet, payload.id)
    || !payload.consents.every(consent => durableConsents.has(consentKey(payload.id, consent)))) {
    throw new Error('Voceros write was not durable.');
  }
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    const payload = JSON.parse(event && event.postData ? event.postData.contents : '{}');
    const expectedToken = PropertiesService.getScriptProperties().getProperty('INGEST_TOKEN');
    if (!expectedToken || payload.token !== expectedToken) return jsonResponse({ ok: false, error: 'unauthorized' });
    const kind = payload.kind;
    if (!Object.prototype.hasOwnProperty.call(SHEETS, kind) || !payload.record || !payload.record.id) {
      return jsonResponse({ ok: false, error: 'invalid_payload' });
    }

    const voceros = kind === 'voceros' ? vocerosPayload(payload.record) : null;
    if (kind === 'voceros' && voceros === null) return jsonResponse({ ok: false, error: 'invalid_payload' });

    lock.waitLock(15000);
    const spreadsheet = SpreadsheetApp.openById(SHEETS[kind]);
    const sheet = spreadsheet.getSheets()[0];
    ensureSheetSchema(kind, sheet);

    if (kind === 'voceros') {
      persistVoceros(spreadsheet, sheet, voceros);
      return jsonResponse({ ok: true, submission_id: voceros.id });
    }

    const id = String(payload.record.id);
    const duplicate = findSubmission(sheet, id);
    if (!duplicate) sheet.appendRow(rowFor(kind, payload.record));
    return jsonResponse({ ok: true, duplicate: Boolean(duplicate) });
  } catch (_) {
    console.error('Google Sheets receiver failed.');
    return jsonResponse({ ok: false, error: 'internal_error' });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function doGet() {
  return jsonResponse({ ok: true, service: 'Finados Mushuc Runa 2026' });
}
