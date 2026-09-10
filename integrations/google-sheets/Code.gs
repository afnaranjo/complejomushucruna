const SHEETS = Object.freeze({
  media: '1j0OjpWgHNok9OTRNXr0llpjBybrxUMlUnbhM3ukVj8M',
  brunch: '1VCnaIEGFnrqtCBZHUQ51APzqYfK4ZrGqDgJvTKt2rEM',
});

const HEADERS = Object.freeze({
  media: [
    'Fecha de envío', 'ID', 'Nombre del medio', 'Tipo de medio', 'Frecuencia / canal',
    'Programa o espacio', 'Tipo de programa', 'Provincia', 'Ciudad', 'Contrato vigente',
    'Personas', 'Nombres y cargos', 'Teléfono / WhatsApp', 'Correo', 'Aceptó condiciones',
  ],
  brunch: [
    'Fecha de confirmación', 'ID de registro', 'Código', 'Nombre', 'Empresa / cargo',
    'Asistencia', 'Acompañantes', 'Total personas', 'Comentarios', 'Fuente',
  ],
});

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
  return [
    record.submittedAt, record.id, record.slug, record.name, record.role,
    record.attendance, record.companions, record.total, record.comments, record.source,
  ].map(asCell);
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

    lock.waitLock(15000);
    const spreadsheet = SpreadsheetApp.openById(SHEETS[kind]);
    const sheet = spreadsheet.getSheets()[0];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, HEADERS[kind].length).setValues([HEADERS[kind]]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, HEADERS[kind].length)
        .setBackground('#391f6f')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
    }

    const id = String(payload.record.id);
    const duplicate = sheet.getRange(1, 2, Math.max(sheet.getLastRow(), 1), 1)
      .createTextFinder(id)
      .matchEntireCell(true)
      .findNext();
    if (!duplicate) sheet.appendRow(rowFor(kind, payload.record));
    return jsonResponse({ ok: true, duplicate: Boolean(duplicate) });
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: 'internal_error' });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

function doGet() {
  return jsonResponse({ ok: true, service: 'Finados Mushuc Runa 2026' });
}
