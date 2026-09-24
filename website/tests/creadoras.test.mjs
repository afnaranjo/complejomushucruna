import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';
import {
  createCreadoraAdminClient, creadoraPayload, CREADORA_FIELDS, dayKey, defaultShift, describeLogEntry, fillCreadoraForm, minutesFromOffset,
  contentLabel, contentPayload, CONTENT_KINDS, scriptPayload, scriptSummary, creadoraColor, CREADORA_HUES, dragPreview, duplicatedShift, durationLabel, layoutDay, minutesFromTime, movedShift, pastedShift, rangeLabel, resizedShift,
  shiftFormValues, shiftMembers, attendanceMark, scriptsMark, shiftGeometry, shiftLabel, shiftPayload, shiftView, viewRange, weekStart,
  DAY_START_HOUR, DAY_END_HOUR, MAX_END_MINUTES, STEP_MINUTES,
} from '../src/admin/admin-creadoras.js';

test('el calendario ofrece día, semana y mes, y pide al servidor el rango exacto de cada vista', () => {
  // Día: un solo día.
  assert.deepEqual(viewRange('day', '2026-10-30'), { days: ['2026-10-30'], from: '2026-10-30', to: '2026-10-31' });

  // Semana: de lunes a domingo, aunque se pida desde un miércoles.
  const week = viewRange('week', '2026-10-28');
  assert.equal(week.days.length, 7);
  assert.equal(week.days[0], '2026-10-26');
  assert.equal(week.days[6], '2026-11-01');
  assert.equal(week.from, '2026-10-26');
  assert.equal(week.to, '2026-11-02');
  assert.equal(weekStart('2026-11-01'), '2026-10-26', 'el domingo pertenece a la semana que empezó el lunes');

  // Mes: semanas completas, así que empieza y termina en lunes y domingo.
  const month = viewRange('month', '2026-10-15');
  assert.equal(month.days.length % 7, 0);
  assert.equal(month.days[0], '2026-09-28');
  assert.ok(month.days.includes('2026-10-01') && month.days.includes('2026-10-31'));
  assert.equal(month.to, '2026-11-02');

  // Las flechas avanzan según la vista, y el mes no se desborda al pasar de diciembre.
  assert.equal(shiftView('day', '2026-10-30', 1), '2026-10-31');
  assert.equal(shiftView('week', '2026-10-28', -1), '2026-10-19');
  assert.equal(shiftView('month', '2026-12-10', 1), '2027-01-01');

  assert.equal(rangeLabel('day', '2026-10-30'), 'viernes 30 de octubre de 2026');
  assert.equal(rangeLabel('week', '2026-10-28'), '26 de octubre al 1 de noviembre de 2026');
  assert.equal(rangeLabel('month', '2026-10-15'), 'octubre de 2026');
  assert.throws(() => viewRange('año', '2026-10-30'), TypeError);
});

test('arrastrar una caja conserva su duración, la estira desde abajo y nunca se sale del día', () => {
  const shift = { starts_at: '2026-10-30 09:00:00', ends_at: '2026-10-30 12:00:00' };

  // Moverla a otro día y otra hora mantiene las tres horas.
  const moved = movedShift(shift, '2026-10-31', 14 * 60);
  assert.deepEqual(moved, { starts_at: '2026-10-31 14:00', ends_at: '2026-10-31 17:00' });

  // Soltarla al final del día la recoloca para que quepa entera, y nunca produce «24:00»,
  // que el servidor rechaza por hora inválida.
  const late = movedShift(shift, '2026-10-31', DAY_END_HOUR * 60 - 30);
  assert.equal(late.ends_at, '2026-10-31 23:59');
  assert.equal(late.starts_at, '2026-10-31 20:59');

  // Estirar mueve solo el final y respeta el mínimo de un cuarto de hora.
  assert.deepEqual(resizedShift(shift, 19 * 60), { starts_at: '2026-10-30 09:00', ends_at: '2026-10-30 19:00' });
  assert.deepEqual(resizedShift(shift, 8 * 60), { starts_at: '2026-10-30 09:00', ends_at: `2026-10-30 09:${STEP_MINUTES}` });
  assert.equal(resizedShift(shift, 26 * 60).ends_at, '2026-10-30 23:59');

  // Una caja nueva nace con tres horas desde donde se soltó, sin pasarse de la medianoche.
  assert.deepEqual(defaultShift('2026-11-01', 10 * 60), { starts_at: '2026-11-01 10:00', ends_at: '2026-11-01 13:00' });
  assert.equal(defaultShift('2026-11-01', 23 * 60).ends_at, '2026-11-01 23:59');
  assert.equal(MAX_END_MINUTES, DAY_END_HOUR * 60 - 1);
  // Ninguna hora generada llega a «24:00».
  for (const minutes of [0, 6 * 60, 20 * 60, 23 * 60 + 30, 24 * 60]) {
    for (const value of Object.values(defaultShift('2026-11-01', minutes))) assert.doesNotMatch(value, /24:/, String(minutes));
  }

  assert.throws(() => movedShift({ starts_at: 'ayer', ends_at: 'hoy' }, '2026-11-01', 600), TypeError);
});

test('la posición del puntero se convierte en horas de cuarto en cuarto dentro del día visible', () => {
  assert.equal(minutesFromOffset(0), DAY_START_HOUR * 60);
  assert.equal(minutesFromOffset(1), DAY_END_HOUR * 60 - STEP_MINUTES, 'el fondo de la columna no crea un turno vacío');
  // A mitad de una jornada de 6:00 a 24:00 caen las 15:00.
  assert.equal(minutesFromOffset(0.5), 15 * 60);
  // Se redondea al cuarto más cercano, nunca a un minuto suelto.
  assert.equal(minutesFromOffset(0.51) % STEP_MINUTES, 0);
  assert.equal(minutesFromOffset(-3), DAY_START_HOUR * 60, 'fuera de la columna no se sale del día');
});

test('cada caja se dibuja en su día, recortada a la franja visible', () => {
  const shift = { starts_at: '2026-10-30 09:00:00', ends_at: '2026-10-30 12:00:00' };
  const geometry = shiftGeometry(shift, '2026-10-30');
  // De 6:00 a 24:00 son 18 horas: las 9:00 están a un sexto y tres horas ocupan un sexto.
  assert.ok(Math.abs(geometry.top - (3 / 18) * 100) < 0.001);
  assert.ok(Math.abs(geometry.height - (3 / 18) * 100) < 0.001);
  // Un turno de otro día no se pinta en esta columna.
  assert.equal(shiftGeometry(shift, '2026-10-31'), null);
  // Lo que empieza antes de las 6:00 se recorta al borde superior.
  const early = shiftGeometry({ starts_at: '2026-10-30 04:00:00', ends_at: '2026-10-30 07:00:00' }, '2026-10-30');
  assert.equal(early.top, 0);
  assert.ok(Math.abs(early.height - (1 / 18) * 100) < 0.001);
  assert.equal(shiftGeometry({ starts_at: '2026-10-30 01:00:00', ends_at: '2026-10-30 03:00:00' }, '2026-10-30'), null);
  assert.equal(shiftLabel(shift), '09:00–12:00');
});

test('la bitácora se lee como una frase: quién, qué y cómo quedó', () => {
  assert.equal(describeLogEntry({
    label: 'Movió el turno', creadora: 'Ana Creadora',
    before: { starts_at: '2026-10-30 09:00:00', ends_at: '2026-10-30 12:00:00' },
    after: { starts_at: '2026-10-31 14:00:00', ends_at: '2026-10-31 17:00:00' },
  }), 'Movió el turno · Ana Creadora · de 09:00–12:00 del 2026-10-30 a 14:00–17:00 del 2026-10-31');
  assert.equal(describeLogEntry({
    label: 'Agregó el turno', creadora: 'Sofía', after: { starts_at: '2026-11-01 08:00:00', ends_at: '2026-11-01 10:00:00' },
  }), 'Agregó el turno · Sofía · 08:00–10:00 del 2026-11-01');
  assert.equal(describeLogEntry({ label: 'Quitó el turno', creadora: 'Ana', detail: 'La creadora fue retirada.' }),
    'Quitó el turno · Ana · La creadora fue retirada.');
  assert.equal(describeLogEntry({}), '');
});

test('el cliente administrativo solo llama a las rutas de creadoras y exige CSRF para escribir', async () => {
  const calls = [];
  const client = createCreadoraAdminClient('https://finados.complejomushucruna.com/api', async (url, options) => {
    calls.push([url, options.method, options.headers['X-CSRF-Token'] ?? null]);
    return { ok: true, json: async () => ({ csrf: 'token-nuevo' }) };
  });
  await assert.rejects(() => client.request('/voceros'), /Ruta de API no permitida/);
  await assert.rejects(() => client.request('/medios'), /Ruta de API no permitida/);
  await assert.rejects(() => client.request('/creadoras/turnos/no-es-un-id'), /Ruta de API no permitida/);
  await assert.rejects(() => client.request('/creadoras', { method: 'DELETE' }), /Método no permitido/);
  // Sin haber leído todavía un token, escribir se rechaza antes de salir a la red.
  await assert.rejects(() => client.createShift({}), error => error.status === 403);

  await client.session();
  await client.calendar('2026-10-26', '2026-11-02');
  const id = 'a'.repeat(32);
  await client.getShift(id);
  await client.createShift({ creadora: id });
  await client.updateShift(id, { starts_at: '2026-10-30 09:00' });
  await client.removeShift(id);
  await client.retire(id);
  assert.deepEqual(calls.map(([url, method]) => [url.replace('https://finados.complejomushucruna.com/api', ''), method]), [
    ['/auth/session', 'GET'],
    ['/creadoras/calendario?from=2026-10-26&to=2026-11-02', 'GET'],
    [`/creadoras/turnos/${id}`, 'GET'],
    ['/creadoras/turnos', 'POST'],
    [`/creadoras/turnos/${id}`, 'PATCH'],
    [`/creadoras/turnos/${id}`, 'POST'],
    [`/creadoras/${id}/retirar`, 'POST'],
  ]);
  assert.equal(calls[0][2], null, 'una lectura no manda token');
  assert.ok(calls.slice(3).every(([, , token]) => token === 'token-nuevo'), 'cada escritura manda el token vigente');
  assert.throws(() => createCreadoraAdminClient('https://otro.example/api'), /Origen de API no permitido/);
});

test('la ficha recoge los datos de la persona y el formulario los recorta', () => {
  const form = new Map([['full_name', '  Ana Creadora  '], ['cedula', ' 1801234567 '], ['birth_date', '1998-04-12'],
    ['whatsapp', ' 0990000011 '], ['contact_email', ' ana@example.invalid '], ['city', 'Ambato'],
    ['main_network', 'tiktok'], ['social_link', 'https://www.tiktok.com/@ana'], ['followers_count', ' 12500 '],
    ['tiktok', 'https://www.tiktok.com/@ana'], ['instagram', ''], ['facebook', ''], ['note', ' Tardes '], ['status', '']]);
  assert.deepEqual(creadoraPayload(form), {
    full_name: 'Ana Creadora', cedula: '1801234567', birth_date: '1998-04-12', whatsapp: '0990000011',
    contact_email: 'ana@example.invalid', city: 'Ambato', status: 'Activa', main_network: 'tiktok',
    followers_count: 12500, social_link: 'https://www.tiktok.com/@ana',
    tiktok: 'https://www.tiktok.com/@ana', instagram: '', facebook: '', note: 'Tardes',
  });
  // Sin seguidores escritos se manda cero, no una cadena vacía que el servidor rechazaría.
  assert.equal(creadoraPayload(new Map([['full_name', 'Ana'], ['followers_count', '']])).followers_count, 0);
});

test('la ficha guardada se vuelca en el formulario para revisarla o corregirla', () => {
  const elements = Object.fromEntries(CREADORA_FIELDS.map(name => [name, { value: 'previo' }]));
  const form = fillCreadoraForm({ elements }, {
    full_name: 'Ana Creadora', cedula: '1801234567', followers_count: 12500, city: null, note: undefined,
  });
  assert.equal(form.elements.full_name.value, 'Ana Creadora');
  assert.equal(form.elements.cedula.value, '1801234567');
  assert.equal(form.elements.followers_count.value, '12500', 'los números llegan como texto al campo');
  assert.equal(form.elements.city.value, '', 'un dato ausente limpia el campo, no arrastra el anterior');
  assert.equal(form.elements.note.value, '');
});

test('la sección de creadoras se publica con su calendario, su bitácora y su entrada de menú', async t => {
  const output = await mkdtemp(join(tmpdir(), 'creadoras-build-'));
  t.after(() => rm(output, { recursive: true, force: true }));
  const files = new Set(await buildSite(output));
  assert.ok(files.has('admin/creadoras/index.html'));
  assert.ok(files.has('assets/admin/admin-creadoras.js'));

  const page = await readFile(join(output, 'admin/creadoras/index.html'), 'utf8');
  assert.match(page, /data-admin-creadoras/);
  for (const view of ['day', 'week', 'month']) assert.match(page, new RegExp(`data-view="${view}"`), view);
  assert.match(page, /data-calendar-grid/);
  assert.match(page, /data-calendar-month/);
  assert.match(page, /data-calendar-log/);
  assert.match(page, /data-creadora-list/);
  assert.match(page, /data-creadora-dialog/);
  // Se puede agendar sin arrastrar: hay un botón y un formulario propio del turno.
  assert.match(page, /data-shift-new/);
  assert.match(page, /data-shift-dialog/);
  for (const name of ['day', 'start', 'end']) assert.match(page, new RegExp(`name="${name}"`), name);
  // Las creadoras del turno se eligen con casillas: pueden ser varias en la misma caja.
  assert.match(page, /data-shift-people-list/);
  assert.doesNotMatch(page, /<select name="creadora"/);
  // Arriba del calendario van los indicadores de cada una.
  for (const marker of ['data-creadora-indicators', 'data-creadora-totals', 'Indicadores por creadora']) assert.match(page, new RegExp(marker), marker);
  // El contenido dice de quién es y el guion, para quién.
  for (const marker of ['data-content-creadora', 'data-script-creadora']) assert.match(page, new RegExp(marker), marker);
  // Duplicar, copiar y pegar, además de crear.
  for (const marker of ['data-shift-duplicate', 'data-shift-copy', 'data-shift-duration', 'data-clipboard', 'data-clipboard-cancel'])
    assert.match(page, new RegExp(marker), marker);
  assert.match(page, /su borde de abajo para cambiar la hora de fin/);
  // El turno guarda lo que pasó: asistencia y contenido con su botón «+».
  for (const marker of ['data-shift-record', 'data-content-add', 'data-content-list', 'data-content-kind', 'data-content-title', 'data-content-url'])
    assert.match(page, new RegExp(marker), marker);
  // La asistencia se marca por creadora; las filas se dibujan con las integrantes del turno.
  assert.match(page, /data-shift-attendance/);
  // El cuaderno de apuntes, a la derecha y plegable.
  for (const marker of ['data-shift-notebook', 'data-script-add', 'data-script-list', 'data-script-title', 'data-script-body', 'data-script-url'])
    assert.match(page, new RegExp(marker), marker);
  assert.match(page, /Cuaderno de apuntes/);
  assert.match(page, /<textarea data-script-body/, 'el guion se escribe en un campo largo');
  // El arrastre es propio, no el del navegador: la caja ya no usa draggable.
  const bundleSource = await readFile(join(output, 'assets/admin/admin-creadoras.js'), 'utf8');
  assert.match(bundleSource, /shift-ghost/, 'la etiqueta de arrastre viaja en el bundle');
  assert.match(bundleSource, /setPointerCapture/);
  assert.match(bundleSource, /attendance_for/, 'la asistencia viaja con su dueña');
  assert.match(bundleSource, /Ya está grabado/);
  // La ficha pide los datos de la persona, no solo el nombre.
  for (const name of ['cedula', 'birth_date', 'contact_email', 'followers_count', 'tiktok', 'instagram', 'facebook'])
    assert.match(page, new RegExp(`name="${name}"`), name);
  assert.match(page, /Cambios del calendario/);
  assert.match(page, /noindex, nofollow, noarchive/);
  // La semana viene marcada de entrada.
  assert.match(page, /data-view="week" aria-pressed="true"/);

  // Aparece en el menú administrativo, después de Emprendedores.
  const order = [...page.matchAll(/class="admin-nav-link(?: admin-nav-link--child)?" href="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(order, ['/admin/noticias/', '/admin/panel/', '/admin/voceros/', '/admin/medios/', '/admin/medios/eventos/', '/admin/emprendedores/', '/admin/creadoras/', '/admin/mfs/']);

  // El bundle no lleva la API local a producción y conserva el menú plegable compartido.
  const bundle = await readFile(join(output, 'assets/admin/admin-creadoras.js'), 'utf8');
  assert.match(bundle, /const LOCAL_API = null;/);
  assert.doesNotMatch(bundle, /127\.0\.0\.1/);
  assert.match(bundle, /import '\.\/sidebar\.js\?v=/);
});

test('la fecha de hoy se calcula en el calendario local, sin saltos por zona horaria', () => {
  // dayKey usa el día local del navegador: a las 23:00 sigue siendo hoy, no mañana.
  const night = new Date(2026, 9, 30, 23, 30);
  assert.equal(dayKey(night), '2026-10-30');
  const morning = new Date(2026, 9, 30, 0, 15);
  assert.equal(dayKey(morning), '2026-10-30');
});

test('varias creadoras a la misma hora se reparten el ancho en vez de taparse', () => {
  const key = '2026-10-30';
  const a = { public_id: 'a', starts_at: `${key} 09:00:00`, ends_at: `${key} 12:00:00` };
  const b = { public_id: 'b', starts_at: `${key} 09:00:00`, ends_at: `${key} 11:00:00` };
  const c = { public_id: 'c', starts_at: `${key} 10:00:00`, ends_at: `${key} 11:00:00` };
  // Tres turnos que coinciden ocupan tres columnas distintas del mismo día.
  const together = layoutDay([a, b, c], key);
  assert.equal(together.length, 3);
  assert.deepEqual(together.map(entry => entry.columns), [3, 3, 3]);
  assert.deepEqual([...new Set(together.map(entry => entry.column))].sort(), [0, 1, 2]);

  // Uno que empieza cuando el otro terminó recupera el ancho completo.
  const apart = layoutDay([a, { public_id: 'd', starts_at: `${key} 12:00:00`, ends_at: `${key} 14:00:00` }], key);
  assert.deepEqual(apart.map(entry => entry.columns), [1, 1]);

  // Los turnos de otro día no entran en el reparto.
  assert.equal(layoutDay([{ public_id: 'e', starts_at: '2026-10-31 09:00:00', ends_at: '2026-10-31 10:00:00' }], key).length, 0);
  assert.deepEqual(layoutDay([], key), []);
});

test('el turno se puede agendar desde su propio formulario, sin arrastrar nada', () => {
  const form = new Map([['creadora', 'a'.repeat(32)], ['day', '2026-10-30'], ['start', '09:00'], ['end', '12:00'],
    ['place', ' Plaza de la Luna '], ['note', '']]);
  assert.deepEqual(shiftPayload(form), {
    creadoras: ['a'.repeat(32)], starts_at: '2026-10-30 09:00', ends_at: '2026-10-30 12:00',
    place: 'Plaza de la Luna', note: '',
  });
  // Los navegadores mandan la hora con segundos; el servidor recibe siempre hora y minuto.
  assert.equal(shiftPayload(new Map([['creadora', 'a'], ['day', '2026-10-30'], ['start', '09:00:00'], ['end', '12:30:00']])).ends_at, '2026-10-30 12:30');
  // Lo incompleto o absurdo se detiene antes de salir a la red.
  assert.throws(() => shiftPayload(new Map([['creadora', 'a'], ['day', ''], ['start', '09:00'], ['end', '12:00']])), /Elige el día/);
  assert.throws(() => shiftPayload(new Map([['creadora', 'a'], ['day', '2026-10-30'], ['start', ''], ['end', '12:00']])), /hora de inicio/);
  assert.throws(() => shiftPayload(new Map([['creadora', 'a'], ['day', '2026-10-30'], ['start', '12:00'], ['end', '12:05']])), /al menos 15 minutos/);
  // Un fin anterior al inicio se explica aparte, porque suele ser a. m. en vez de p. m.
  assert.throws(() => shiftPayload(new Map([['creadora', 'a'], ['day', '2026-10-30'], ['start', '12:00'], ['end', '09:00']])), /posterior a la de inicio/);

  // Un turno guardado vuelve al formulario tal como está.
  assert.deepEqual(shiftFormValues({ creadora: 'b'.repeat(32), starts_at: '2026-10-30 09:00:00', ends_at: '2026-10-30 12:00:00', place: 'Tarima', note: 'Llega 15 antes' }),
    { creadoras: ['b'.repeat(32)], day: '2026-10-30', start: '09:00', end: '12:00', place: 'Tarima', note: 'Llega 15 antes' });
  assert.deepEqual(shiftFormValues({}), { creadoras: [], day: '', start: '', end: '', place: '', note: '' });
});

test('un mismo turno puede reunir a varias creadoras en una sola caja', () => {
  // Las casillas marcadas del formulario viajan como lista, sin repetir.
  const form = new FormData();
  for (const id of ['a'.repeat(32), 'b'.repeat(32), 'a'.repeat(32)]) form.append('creadoras', id);
  for (const [name, value] of [['day', '2026-10-30'], ['start', '10:00'], ['end', '13:00'], ['place', 'Escenario'], ['note', '']]) form.append(name, value);
  assert.deepEqual(shiftPayload(form).creadoras, ['a'.repeat(32), 'b'.repeat(32)]);
  // Sin nadie marcado, el turno no sale.
  const empty = new FormData();
  for (const [name, value] of [['day', '2026-10-30'], ['start', '10:00'], ['end', '13:00']]) empty.append(name, value);
  assert.throws(() => shiftPayload(empty), /al menos una creadora/);

  const shift = { public_id: 'c'.repeat(32), name: 'Ana, Sofía, Lucía', starts_at: '2026-10-30 10:00:00', ends_at: '2026-10-30 13:00:00',
    creadoras: [{ public_id: 'a'.repeat(32), name: 'Ana', attended: 'yes' }, { public_id: 'b'.repeat(32), name: 'Sofía', attended: null }, { public_id: 'd'.repeat(32), name: 'Lucía', attended: 'yes' }],
    script_count: 3, recorded_count: 1 };
  assert.deepEqual(shiftFormValues(shift).creadoras, ['a'.repeat(32), 'b'.repeat(32), 'd'.repeat(32)]);
  assert.equal(shiftMembers(shift).length, 3);
  // Un turno de antes, con una sola creadora, se lee igual.
  assert.deepEqual(shiftMembers({ creadora: 'z', name: 'Zoe', attended: 'no' }), [{ public_id: 'z', name: 'Zoe', attended: 'no' }]);

  // La caja resume la asistencia de todas y los guiones grabados.
  assert.equal(attendanceMark(shift), '2/3 asistieron');
  assert.equal(attendanceMark({ creadoras: shift.creadoras.map(member => ({ ...member, attended: 'yes' })) }), '✓ asistieron todas');
  assert.equal(attendanceMark({ creadoras: shift.creadoras.map(member => ({ ...member, attended: 'no' })) }), '✗ no asistió ninguna');
  assert.equal(attendanceMark({ creadoras: shift.creadoras.map(member => ({ ...member, attended: null })) }), '');
  assert.equal(attendanceMark({ creadora: 'z', attended: 'yes' }), '✓ asistió');
  assert.equal(scriptsMark(shift), '3 guiones · 1 grabado');
  assert.equal(scriptsMark({ script_count: 1, recorded_count: 0 }), '1 guion');
  assert.equal(scriptsMark({ script_count: 2, recorded_count: 2 }), '2 guiones · 2 grabados');
  assert.equal(scriptsMark({}), '');

  // Pegar lleva a todas las integrantes; duplicar deja el hueco listo para elegir a otras.
  assert.deepEqual(pastedShift(shift, '2026-11-01', 15 * 60).creadoras, ['a'.repeat(32), 'b'.repeat(32), 'd'.repeat(32)]);
  assert.deepEqual(duplicatedShift(shift).creadoras, []);

  // El contenido de un turno compartido lleva a su dueña; un guion puede ir para todas.
  assert.equal(contentPayload({ kind: 'video', title: 'Baile', creadora: 'b'.repeat(32) }).creadora, 'b'.repeat(32));
  assert.equal(scriptPayload({ title: 'Coreografía', creadora: '' }).creadora, '');
  assert.equal('creadora' in scriptPayload({ title: 'Sin elegir' }), false);
});

test('copiar, pegar y duplicar conservan la creadora, la duración y el detalle', () => {
  const shift = { public_id: 'a'.repeat(32), creadora: 'b'.repeat(32), name: 'Ana Creadora',
    starts_at: '2026-10-30 09:00:00', ends_at: '2026-10-30 12:00:00', place: 'Plaza de la Luna', note: 'Llega antes' };

  // Pegar lo lleva a otro día y otra hora sin perder las tres horas ni el detalle.
  assert.deepEqual(pastedShift(shift, '2026-11-01', 15 * 60), {
    creadoras: ['b'.repeat(32)], starts_at: '2026-11-01 15:00', ends_at: '2026-11-01 18:00',
    place: 'Plaza de la Luna', note: 'Llega antes',
  });

  // Duplicar repite el mismo hueco, para asignarlo después a otras creadoras.
  assert.deepEqual(duplicatedShift(shift), {
    creadoras: [], starts_at: '2026-10-30 09:00', ends_at: '2026-10-30 12:00',
    place: 'Plaza de la Luna', note: 'Llega antes',
  });
  // Un turno sin lugar ni nota se copia igual, sin arrastrar «undefined».
  assert.deepEqual(duplicatedShift({ creadora: 'c', starts_at: '2026-10-30 09:00:00', ends_at: '2026-10-30 10:00:00' }),
    { creadoras: [], starts_at: '2026-10-30 09:00', ends_at: '2026-10-30 10:00', place: '', note: '' });
});

test('la duración se dice en palabras y el fin anterior al inicio se explica', () => {
  assert.equal(durationLabel(9 * 60, 12 * 60), '3 horas');
  assert.equal(durationLabel(9 * 60, 10 * 60), '1 hora');
  assert.equal(durationLabel(9 * 60, 9 * 60 + 45), '45 minutos');
  assert.equal(durationLabel(9 * 60, 10 * 60 + 30), '1 h 30 min');
  assert.equal(durationLabel(12 * 60, 9 * 60), '', 'un fin anterior al inicio no tiene duración');
  assert.equal(minutesFromTime('09:30'), 570);
  assert.equal(minutesFromTime('09:30:00'), 570);
  assert.equal(minutesFromTime(''), null);

  // El caso real: elegir 12:00 a. m. en vez de p. m. deja el fin en medianoche.
  assert.throws(() => shiftPayload(new Map([['creadora', 'a'], ['day', '2026-10-30'], ['start', '09:00'], ['end', '00:00']])),
    /posterior a la de inicio.*a\. m\./s);
});

test('cada creadora conserva su color, y arrastrando se lee a dónde va el turno', () => {
  const id = 'a'.repeat(32);
  const color = creadoraColor(id);
  // El color sale del identificador: no cambia al recargar ni al reordenar la lista.
  assert.deepEqual(color, creadoraColor(id));
  assert.ok(CREADORA_HUES.includes(color.hue));
  // El fondo es un tinte muy claro para no competir con el texto; el filete sí va saturado.
  assert.match(color.soft, /^hsl\(\d+ 78% 97%\)$/);
  assert.match(color.edge, /^hsl\(\d+ 58% 45%\)$/);
  // Creadoras distintas no comparten color mientras quepan en la paleta.
  const hues = new Set(Array.from({ length: CREADORA_HUES.length }, (_, index) => creadoraColor(`${index}`.padStart(32, '0')).hue));
  assert.ok(hues.size > 1, 'la paleta reparte matices distintos');
  // Un identificador vacío no rompe el color.
  assert.ok(CREADORA_HUES.includes(creadoraColor(undefined).hue));

  // Mientras se arrastra se ve quién, qué día y qué horas quedarían.
  const shift = { name: 'Jhos', starts_at: '2026-09-21 09:15:00', ends_at: '2026-09-21 12:15:00' };
  assert.equal(dragPreview(shift, '2026-09-22', 10 * 60 + 15), 'Jhos · mar 22 · 10:15–13:15');
  // La duración se conserva al cambiar de día.
  assert.equal(dragPreview(shift, '2026-09-24', 6 * 60), 'Jhos · jue 24 · 06:00–09:00');
});

test('el turno registra lo que pasó: asistencia y varias piezas de contenido', () => {
  // Cada pieza se lee por su tipo y su nombre.
  assert.equal(contentLabel({ kind: 'video', title: 'Recorrido por la feria' }), 'Video · Recorrido por la feria');
  assert.equal(contentLabel({ kind: 'live', title: 'Desde el escenario' }), 'En vivo · Desde el escenario');
  // Un tipo desconocido cae en la etiqueta que mande el servidor, sin romper la lista.
  assert.equal(contentLabel({ kind: 'podcast', kind_label: 'Pódcast', title: 'Charla' }), 'Pódcast · Charla');
  assert.equal(contentLabel({}), '');

  // El nombre es obligatorio; el enlace, opcional pero seguro.
  assert.deepEqual(contentPayload({ kind: 'video', title: '  Recorrido  ', url: ' https://tiktok.com/v/1 ' }),
    { kind: 'video', title: 'Recorrido', url: 'https://tiktok.com/v/1' });
  assert.deepEqual(contentPayload({ kind: 'foto', title: 'Galería' }), { kind: 'foto', title: 'Galería', url: '' });
  assert.throws(() => contentPayload({ kind: 'podcast', title: 'x' }), /tipo de contenido/);
  assert.throws(() => contentPayload({ kind: 'video', title: '   ' }), /nombre del contenido/);
  assert.throws(() => contentPayload({ kind: 'video', title: 'x', url: 'http://inseguro.test' }), /https:\/\//);
  // Los tipos que ofrece la pantalla son los que acepta el servidor.
  assert.deepEqual(Object.keys(CONTENT_KINDS), ['video', 'live', 'historia', 'foto', 'otro']);
});

test('el cuaderno guarda la referencia y el guion, y admite varios por turno', () => {
  // El guion es texto largo: conserva sus saltos de línea y solo se recortan los extremos.
  const guion = 'Plano 1: entrada.\nPlano 2: la colada morada.';
  assert.deepEqual(scriptPayload({ title: '  Recorrido de apertura  ', body: `  ${guion}  `, referenceUrl: ' https://tiktok.com/v/9 ' }),
    { title: 'Recorrido de apertura', body: guion, reference_url: 'https://tiktok.com/v/9' });
  // La idea puede ir sin guion escrito, solo con su referencia.
  assert.deepEqual(scriptPayload({ title: 'Idea suelta', referenceUrl: '' }), { title: 'Idea suelta', body: '', reference_url: '' });
  assert.throws(() => scriptPayload({ title: '   ', body: 'x' }), /nombre a la idea/);
  assert.throws(() => scriptPayload({ title: 'x', referenceUrl: 'http://inseguro.test' }), /https:\/\//);

  // El resumen deja leer la idea sin desplegarla.
  assert.equal(scriptSummary({ body: 'Plano corto.' }), 'Plano corto.');
  assert.equal(scriptSummary({ body: 'a'.repeat(200) }).length, 90);
  assert.match(scriptSummary({ body: 'a'.repeat(200) }), /…$/);
  assert.equal(scriptSummary({ body: 'Uno\n\ndos   tres' }), 'Uno dos tres', 'los saltos no ensucian el resumen');
  assert.equal(scriptSummary({ body: '', reference_url: 'https://x' }), 'Solo referencia');
  assert.equal(scriptSummary({}), 'Sin guion escrito');
});
