import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const receiverPath = fileURLToPath(new URL('../../integrations/google-sheets/Code.gs', import.meta.url));
const ingestToken = 'synthetic-ingest-token-with-more-than-32-characters';
const submissionId = 'a'.repeat(32);

class MockRange {
  constructor(sheet, row, column, rowCount = 1, columnCount = 1) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rowCount = rowCount;
    this.columnCount = columnCount;
  }

  setValues(values) {
    for (let rowOffset = 0; rowOffset < this.rowCount; rowOffset++) {
      const targetRow = this.row - 1 + rowOffset;
      if (!this.sheet.rows[targetRow]) this.sheet.rows[targetRow] = [];
      for (let columnOffset = 0; columnOffset < this.columnCount; columnOffset++) {
        this.sheet.rows[targetRow][this.column - 1 + columnOffset] = values[rowOffset][columnOffset];
      }
    }
    return this;
  }

  getValues() {
    return Array.from({ length: this.rowCount }, (_, rowOffset) =>
      Array.from({ length: this.columnCount }, (_, columnOffset) =>
        this.sheet.rows[this.row - 1 + rowOffset]?.[this.column - 1 + columnOffset] ?? ''));
  }

  createTextFinder(expected) {
    let exact = false;
    const matches = () => {
      const found = [];
      for (let rowOffset = 0; rowOffset < this.rowCount; rowOffset++) {
        for (let columnOffset = 0; columnOffset < this.columnCount; columnOffset++) {
          const value = this.sheet.rows[this.row - 1 + rowOffset]?.[this.column - 1 + columnOffset] ?? '';
          if ((exact && String(value) === String(expected)) || (!exact && String(value).includes(String(expected)))) {
            found.push({
              getRow: () => this.row + rowOffset,
              getColumn: () => this.column + columnOffset,
            });
          }
        }
      }
      return found;
    };
    return {
      matchEntireCell(value) { exact = value; return this; },
      findNext() { return matches()[0] ?? null; },
      findAll() { return matches(); },
    };
  }

  setBackground() { return this; }
  setFontColor() { return this; }
  setFontWeight() { return this; }
}

class MockSheet {
  constructor(name, lock) {
    this.name = name;
    this.lock = lock;
    this.rows = [];
    this.appendAttempts = 0;
    this.failAtAppend = null;
  }

  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map(row => row.length)); }
  getRange(row, column, rowCount = 1, columnCount = 1) {
    return new MockRange(this, row, column, rowCount, columnCount);
  }
  setFrozenRows() {}

  appendRow(values) {
    assert.equal(this.lock.held, true, 'all deduplication and writes must remain under the script lock');
    this.appendAttempts++;
    if (this.failAtAppend === this.appendAttempts) {
      throw new Error(`synthetic failure ${ingestToken} persona@example.invalid`);
    }
    this.rows.push([...values]);
  }

  insertColumnBefore(column) {
    for (const row of this.rows) row.splice(column - 1, 0, '');
  }
}

class MockSpreadsheet {
  constructor(lock, { consentFailureAt = null } = {}) {
    this.lock = lock;
    this.consentFailureAt = consentFailureAt;
    this.primary = new MockSheet('Registros', lock);
    this.sheets = [this.primary];
  }

  getSheets() { return this.sheets; }
  getSheetByName(name) { return this.sheets.find(sheet => sheet.name === name) ?? null; }
  insertSheet(name) {
    const sheet = new MockSheet(name, this.lock);
    if (name === 'Consentimientos') sheet.failAtAppend = this.consentFailureAt;
    this.sheets.push(sheet);
    return sheet;
  }
}

async function receiverFixture(options = {}) {
  const source = await readFile(receiverPath, 'utf8');
  const lock = {
    held: false,
    waits: 0,
    releases: 0,
    waitLock() { this.waits++; this.held = true; },
    releaseLock() { this.releases++; this.held = false; },
  };
  const spreadsheets = new Map();
  const opened = [];
  const logs = [];
  let flushes = 0;
  const context = vm.createContext({
    console: { error: message => logs.push(String(message)) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(text) {
        return {
          text,
          setMimeType(mimeType) { this.mimeType = mimeType; return this; },
        };
      },
    },
    LockService: { getScriptLock: () => lock },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: name => name === 'INGEST_TOKEN' ? ingestToken : null }),
    },
    SpreadsheetApp: {
      openById(id) {
        if (!spreadsheets.has(id)) spreadsheets.set(id, new MockSpreadsheet(lock, options));
        const spreadsheet = spreadsheets.get(id);
        opened.push(spreadsheet);
        return spreadsheet;
      },
      flush() {
        assert.equal(lock.held, true, 'durability flush must occur before releasing the lock');
        flushes++;
      },
    },
  });
  vm.runInContext(`${source}\nglobalThis.__receiver = { doPost };`, context, { filename: receiverPath });
  return {
    lock,
    logs,
    get flushes() { return flushes; },
    get spreadsheet() { return opened.at(-1); },
    post(record, kind = 'voceros') {
      const output = context.__receiver.doPost({
        postData: { contents: JSON.stringify({ token: ingestToken, kind, record }) },
      });
      return JSON.parse(output.text);
    },
  };
}

function vocerosRecord() {
  return {
    id: submissionId,
    submission_id: submissionId,
    submittedAt: '2026-09-14T10:00:00-05:00',
    status: 'Nuevo',
    nombre_completo: '=Persona Sintética',
    cedula: '1800000001',
    fecha_nacimiento: '2000-01-02',
    edad: 26,
    whatsapp: '0990000001',
    correo: 'persona@example.invalid',
    ciudad: 'Ciudad Prueba',
    tiktok: 'https://example.invalid/perfil',
    instagram: '',
    facebook: '',
    red_principal: 'TikTok',
    vocero_previo: 'No, es mi primera vez',
    fuente_comunidad: 'Otro',
    retiro_kit: 'En la oficina',
    representante_nombre: '',
    representante_cedula: '',
    representante_telefono: '',
    representante_correo: '',
    utm_source: 'test',
    utm_medium: '',
    utm_campaign: '',
    utm_content: '',
    utm_term: '',
    consents: ['politicas', 'imagen', 'datos'].map((type, index) => ({
      consentimiento_tipo: type,
      aceptado: 'true',
      texto_version: `test-v${index + 1}`,
      texto_hash: String(index + 1).repeat(64),
      fecha_hora: '2026-09-14T10:00:00-05:00',
      ip_origen: '192.0.2.10',
      user_agent: 'Synthetic test agent',
      url_origen: 'https://example.invalid/voceros/',
      metodo: 'formulario_web',
      id_registro: submissionId,
    })),
  };
}

test('Voceros confirma la primera escritura solo después de guardar ficha y tres consentimientos', async () => {
  const receiver = await receiverFixture();

  assert.deepEqual(receiver.post(vocerosRecord()), { ok: true, submission_id: submissionId });
  assert.equal(receiver.spreadsheet.primary.rows.length, 2);
  const consentSheet = receiver.spreadsheet.getSheetByName('Consentimientos');
  assert.equal(consentSheet.rows.length, 4);
  assert.deepEqual(consentSheet.rows.slice(1).map(row => row[0]), ['politicas', 'imagen', 'datos']);
  assert.deepEqual(consentSheet.rows.slice(1).map(row => row[9]), [submissionId, submissionId, submissionId]);
  assert.equal(receiver.flushes, 1);
  assert.deepEqual([receiver.lock.waits, receiver.lock.releases, receiver.lock.held], [1, 1, false]);
});

test('Voceros responde el mismo recibo al replay completo sin añadir filas', async () => {
  const receiver = await receiverFixture();
  assert.deepEqual(receiver.post(vocerosRecord()), { ok: true, submission_id: submissionId });
  const consentSheet = receiver.spreadsheet.getSheetByName('Consentimientos');
  const before = [receiver.spreadsheet.primary.rows.length, consentSheet.rows.length];

  assert.deepEqual(receiver.post(vocerosRecord()), { ok: true, submission_id: submissionId });
  assert.deepEqual([receiver.spreadsheet.primary.rows.length, consentSheet.rows.length], before);
  assert.equal(new Set(consentSheet.rows.slice(1).map(row => `${row[9]}:${row[0]}:${row[3]}`)).size, 3);
});

test('Voceros recupera una escritura parcial añadiendo solo los consentimientos faltantes', async () => {
  const receiver = await receiverFixture({ consentFailureAt: 2 });
  const record = vocerosRecord();
  const first = receiver.post(record);
  const vocerosSpreadsheet = receiver.spreadsheet;
  const consentSheet = vocerosSpreadsheet.getSheetByName('Consentimientos');
  assert.deepEqual(first, { ok: false, error: 'internal_error' });
  assert.equal(vocerosSpreadsheet.primary.rows.length, 2);
  assert.equal(consentSheet.rows.length, 2);
  consentSheet.failAtAppend = null;
  const recovered = receiver.post(record);

  assert.deepEqual(recovered, { ok: true, submission_id: submissionId });
  assert.equal(vocerosSpreadsheet.primary.rows.length, 2);
  assert.equal(consentSheet.rows.length, 4);
  assert.equal(new Set(consentSheet.rows.slice(1).map(row => `${row[9]}:${row[0]}:${row[3]}`)).size, 3);
});

test('Voceros no emite recibo ni registra secretos o datos personales cuando una escritura falla', async () => {
  const receiver = await receiverFixture({ consentFailureAt: 1 });
  const failure = receiver.post(vocerosRecord());

  assert.deepEqual(failure, { ok: false, error: 'internal_error' });
  assert.equal('submission_id' in failure, false);
  assert.doesNotMatch(receiver.logs.join('\n'), /synthetic-ingest-token|persona@example\.invalid/i);
});

test('Acreditación de medios y brunch conservan sus recibos de compatibilidad', async () => {
  for (const [kind, record] of [
    ['media', { id: 'media-fixture', submittedAt: '2026-09-14T10:00:00-05:00' }],
    ['brunch', { id: 'brunch-fixture', submittedAt: '2026-09-14T10:00:00-05:00' }],
  ]) {
    const receiver = await receiverFixture();
    assert.deepEqual(receiver.post(record, kind), { ok: true, duplicate: false });
    assert.deepEqual(receiver.post(record, kind), { ok: true, duplicate: true });
    assert.equal(receiver.spreadsheet.primary.rows.length, 2);
  }
});
