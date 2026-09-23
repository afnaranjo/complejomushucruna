import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { adminRecordPayload, ATTENDANCE_LABELS, channelTypeFor, CONFIRMATION_LABELS, coverageBuckets, coveragePayload, createMediaAdminClient, fillAdminRecordForm, normalizeMediaFilters, ORIGIN_LABELS, COVERAGE_RESULT_LABELS } from '../src/admin/admin-medios.js';
import { MediaApiClient } from '../src/finados/media-portal.js';

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('el build publica el submenú Eventos de Medios, el alta desde coordinación y los avisos de vinculación del portal', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-medios-cobertura-'));
  const files = await buildSite(output);
  assert.ok(files.includes('admin/medios/eventos/index.html'));
  const admin = await readFile(join(output, 'admin/medios/index.html'), 'utf8');
  const events = await readFile(join(output, 'admin/medios/eventos/index.html'), 'utf8');
  // Sidebar: Eventos hangs from Medios, before Emprendedores, and is marked as the current page on its own route.
  for (const html of [admin, events]) {
    const order = [...html.matchAll(/class="admin-nav-link(?: admin-nav-link--child)?" href="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(order, ['/admin/panel/', '/admin/voceros/', '/admin/medios/', '/admin/medios/eventos/', '/admin/emprendedores/']);
  }
  assert.match(events, /href="\/admin\/medios\/eventos\/" aria-current="page"/);
  assert.match(events, /data-admin-medios-eventos/);
  assert.match(events, /data-coverage-summary/);
  assert.match(events, /data-event-select/);
  assert.match(events, /data-coverage-rows/);
  assert.match(events, /data-coverage-create/);
  assert.match(events, /data-record-dialog/);
  // 019: the event form invites everyone and the table shows confirmation and attendance.
  assert.match(events, /name="place"/);
  assert.match(events, /name="details"/);
  assert.match(events, /Crear evento e invitar a todos/);
  assert.match(events, /<th scope="col">Confirmó<\/th><th scope="col">Asistió<\/th><th scope="col">Link<\/th>/);
  assert.match(events, /Marca el check de «Asistió»/);
  // La tabla es ancha: se desplaza sola en escritorio y se apila en móvil.
  assert.match(events, /class="admin-coverage-scroll"/);
  assert.equal((events.match(/<th scope="col">/g) ?? []).length, 10, 'la tabla conserva sus diez columnas');
  // La pestaña Medios refleja lo que viene de los eventos.
  assert.match(admin, /<th scope="col">Eventos<\/th>/);
  assert.match(events, /Volver a Medios/);
  // Main panel: add button, origin filter and column, claims section and the shared record dialog.
  assert.match(admin, /data-admin-add/);
  assert.match(admin, /<select name="origin"><option value="">Todos<\/option><option value="cuenta">Con cuenta<\/option><option value="coordinacion">Cargado por coordinación<\/option>/);
  assert.match(admin, /<th scope="col">Origen<\/th>/);
  assert.match(admin, /data-claims-panel/);
  assert.match(admin, /data-record-form/);
  assert.equal((admin.match(/name="media_types"/g) ?? []).length, 5, 'un checkbox por tipo en el diálogo de alta');
  assert.match(admin, /name="followers_validated"/);
  assert.match(admin, /name="representatives"/);
  // Coordinación completa todo lo que el medio llenaría: varias señales, oyentes y género.
  assert.match(admin, /<textarea name="frequency"/);
  assert.match(admin, /<textarea name="tv_channel"/);
  assert.match(admin, /name="audience_count"/);
  assert.match(admin, /<select name="radio_genre">/);
  assert.match(admin, /admin-medios\.js\?v=20260923-admin-medios-18/);
  // Portal: invitation notice on access, suggestion and pending-claim notices on the profile.
  const access = await readFile(join(output, 'finados/medios/acceso/index.html'), 'utf8');
  assert.match(access, /data-media-invitation hidden/);
  assert.match(access, /data-media-invitation-name/);
  const profile = await readFile(join(output, 'finados/medios/mi-registro/index.html'), 'utf8');
  assert.match(profile, /data-media-lookup hidden/);
  assert.match(profile, /data-media-lookup-list/);
  assert.match(profile, /data-media-claim hidden/);
  assert.match(profile, /data-media-events hidden/);
  assert.match(profile, /data-media-events-list/);
  assert.match(profile, /media-portal\.js\?v=20260923-medios-13/);
  // Voceros and Emprendedores untouched by the Medios change.
  assert.doesNotMatch(await readFile(join(output, 'finados/voceros/mi-registro/index.html'), 'utf8'), /data-media-lookup|data-media-claim/);
  assert.doesNotMatch(await readFile(join(output, 'admin/emprendedores/index.html'), 'utf8'), /data-admin-medios-eventos|data-record-dialog/);
});

test('el alta desde coordinación arma el cuerpo exacto: representantes por línea, canales con tipo inferido y seguidores validados', () => {
  const values = { media_name: ' Radio Cumbre ', frequency: '102.5 FM\n101.7 FM', tv_channel: '', province: 'Chimborazo', city: 'Riobamba', program_name: 'Al día', representatives: 'Marcelo Padilla - Director\nAníbal Rojas — Periodista\nSolo Nombre', channels: 'https://www.facebook.com/radiocumbre\nfacebook.com/radiocumbre\ntiktok.com/@cumbre\nhttps://x.com/cumbre\nradiocumbre.ec', followers_validated: '22000', audience_count: '25000', radio_genre: 'Popular y tropical', paid_media: 'yes', contact_name: '', phone: '', contact_email: '' };
  const checked = ['radio', 'digital'];
  const form = { elements: { namedItem: name => (name in values ? { value: values[name] } : null) }, querySelectorAll: selector => (selector.includes(':checked') ? checked.map(value => ({ value })) : []) };
  const body = adminRecordPayload(form);
  assert.equal(body.media_name, 'Radio Cumbre');
  assert.deepEqual(body.media_types, ['radio', 'digital']);
  assert.deepEqual(body.representatives, [{ name: 'Marcelo Padilla', role: 'Director' }, { name: 'Aníbal Rojas', role: 'Periodista' }, { name: 'Solo Nombre', role: '' }]);
  assert.deepEqual(body.channels.map(channel => [channel.type, channel.url]), [['facebook', 'https://www.facebook.com/radiocumbre'], ['facebook', 'https://facebook.com/radiocumbre'], ['tiktok', 'https://tiktok.com/@cumbre'], ['x', 'https://x.com/cumbre'], ['website', 'https://radiocumbre.ec']]);
  assert.equal(body.followers_validated, 22000);
  assert.equal(body.paid_media, 'yes');
  assert.deepEqual(Object.keys(body).sort(), ['audience_count', 'channels', 'city', 'contact_email', 'contact_name', 'followers_validated', 'frequency', 'media_name', 'media_types', 'paid_media', 'phone', 'program_name', 'province', 'radio_genre', 'representatives', 'tv_channel']);
  assert.equal(body.frequency, '102.5 FM\n101.7 FM', 'las frecuencias viajan una por línea');
  assert.equal(body.audience_count, 25000);
  assert.equal(body.radio_genre, 'Popular y tropical');
  assert.throws(() => adminRecordPayload({ ...form, elements: { namedItem: name => ({ value: name === 'audience_count' ? '25 mil' : values[name] ?? '' }) } }), /oyentes/);
  assert.throws(() => adminRecordPayload({ ...form, querySelectorAll: () => [] }), /tipo de medio/);
  assert.throws(() => adminRecordPayload({ ...form, elements: { namedItem: name => ({ value: name === 'followers_validated' ? '22 mil' : values[name] ?? '' }) } }), /número entero/);
  assert.equal(channelTypeFor('https://fb.watch/v/abc/'), 'facebook');
  assert.equal(channelTypeFor('https://youtu.be/xyz'), 'youtube');
  assert.equal(channelTypeFor('no es url'), 'otro');
  // The same dialog is refilled from a record for editing.
  const filled = {};
  const target = { elements: { namedItem: name => ({ set value(text) { filled[name] = text; } }) }, querySelectorAll: () => [] };
  fillAdminRecordForm(target, { media_name: 'Radio Cumbre', radio_stations: [{ name: 'Radio Cumbre', frequency: '102.5 FM' }, { name: 'Radio Cumbre', frequency: '101.7 FM' }], tv_channels: ['Canal 6'], representatives: [{ name: 'Marcelo Padilla', role: 'Director' }], channels: [{ type: 'facebook', url: 'https://www.facebook.com/radiocumbre' }], followers_validated: 22000, audience_count: 25000, radio_genre: 'Popular y tropical', paid_media: 'yes' });
  assert.equal(filled.frequency, '102.5 FM\n101.7 FM');
  assert.equal(filled.tv_channel, 'Canal 6');
  assert.equal(filled.audience_count, '25000');
  assert.equal(filled.radio_genre, 'Popular y tropical');
  assert.equal(filled.representatives, 'Marcelo Padilla - Director');
  assert.equal(filled.channels, 'https://www.facebook.com/radiocumbre');
  assert.equal(filled.followers_validated, '22000');
  assert.equal(filled.paid_media, 'yes');
});

test('la cobertura por evento normaliza la fila y los big numbers conservan el orden y el grupo de alerta', () => {
  assert.deepEqual(coveragePayload({ contracted: 'yes', result: 'mencion', people_count: '2', links: 'facebook.com/share/1\nhttps://facebook.com/share/1\n', note: ' Entrevista ', attended: 'yes' }), { contracted: 'yes', result: 'mencion', people_count: 2, links: ['https://facebook.com/share/1'], note: 'Entrevista', attended: 'yes', confirmation: null });
  // El check desmarcado se envía como «no asistió», no como «sin dato».
  assert.equal(coveragePayload({ contracted: '', result: 'pendiente', people_count: 0, links: '', note: '', attended: 'no' }).attended, 'no');
  // Coordinación también registra la confirmación; vacío significa «sin respuesta».
  assert.equal(coveragePayload({ contracted: '', result: 'pendiente', people_count: 0, links: '', note: '', confirmation: 'yes' }).confirmation, 'yes');
  assert.equal(coveragePayload({ contracted: '', result: 'pendiente', people_count: 0, links: '', note: '', confirmation: '' }).confirmation, null);
  assert.deepEqual(coveragePayload({ contracted: '', result: 'inventado', people_count: 'x', links: '', note: '' }), { contracted: null, result: 'pendiente', people_count: 0, links: [], note: '', attended: null, confirmation: null });
  const summary = { todos: { label: 'Todos', ids: ['a', 'b'] }, confirmaron: { label: 'Confirmaron asistencia', ids: ['a'] }, no_confirmaron: { label: 'Sin respuesta', ids: ['b'] }, asistieron: { label: 'Asistieron', ids: ['a'] }, no_asistieron: { label: 'No asistieron', ids: ['b'] }, pautados: { label: 'Pautados', ids: ['a'] }, pautados_publicaron: { label: 'Pautados que publicaron', ids: [] }, pautados_sin_publicacion: { label: 'Pautados sin publicación', ids: ['a'] }, sin_contrato_publicaron: { label: 'Sin contrato que publicaron', ids: ['b'] }, sin_contrato_sin_publicacion: { label: 'Sin contrato sin publicación', ids: [] } };
  const buckets = coverageBuckets(summary);
  // Attendance first (what the team checks the day of the event), then the commercial cross.
  assert.deepEqual(buckets.map(bucket => [bucket.key, bucket.count, bucket.alert]), [['todos', 2, false], ['confirmaron', 1, false], ['no_confirmaron', 1, true], ['asistieron', 1, false], ['no_asistieron', 1, true], ['pautados', 1, false], ['pautados_publicaron', 0, false], ['pautados_sin_publicacion', 1, true], ['sin_contrato_publicaron', 1, false], ['sin_contrato_sin_publicacion', 0, false]]);
  // Asistieron + No asistieron cubren a todos, porque la asistencia es un check.
  assert.equal(buckets.find(b => b.key === 'asistieron').count + buckets.find(b => b.key === 'no_asistieron').count, buckets.find(b => b.key === 'todos').count);
  assert.ok(buckets.find(bucket => bucket.key === 'pautados_sin_publicacion').ids.has('a'));
  assert.deepEqual(Object.keys(ATTENDANCE_LABELS), ['', 'yes', 'no']);
  assert.deepEqual(Object.keys(CONFIRMATION_LABELS), ['pendiente', 'yes', 'no']);
  assert.deepEqual(Object.keys(COVERAGE_RESULT_LABELS), ['pendiente', 'link', 'mencion', 'sin_publicacion', 'no_asistio']);
  assert.deepEqual(Object.keys(ORIGIN_LABELS), ['cuenta', 'coordinacion']);
  assert.deepEqual(normalizeMediaFilters({ origin: 'coordinacion' }), { origin: 'coordinacion', page: 1, pageSize: 25 });
  assert.throws(() => normalizeMediaFilters({ origin: 'otro' }), /origen válido/);
});

test('los clientes del panel y del portal solo usan las rutas nuevas permitidas', async () => {
  const calls = [];
  const client = createMediaAdminClient('https://finados.complejomushucruna.com/api', async (url, options) => { calls.push([url, options]); return url.endsWith('/auth/session') ? json(200, { authenticated: true, csrf: 'admin-token' }) : json(200, { ok: true, items: [] }); });
  await client.session();
  await client.create({ media_name: 'Radio Cumbre' });
  assert.equal(calls.at(-1)[0], 'https://finados.complejomushucruna.com/api/medios');
  assert.equal(calls.at(-1)[1].method, 'POST');
  await client.updateDetails('a'.repeat(32), {}); assert.match(calls.at(-1)[0], /\/medios\/a{32}\/details$/);
  // Coordinación también reporta y retira publicaciones de medios sin cuenta.
  await client.addVideo('a'.repeat(32), 'https://www.facebook.com/share/v/abc/');
  assert.match(calls.at(-1)[0], /\/medios\/a{32}\/videos$/); assert.equal(calls.at(-1)[1].method, 'POST');
  await client.removeVideo('a'.repeat(32), 7);
  assert.equal(calls.at(-1)[1].method, 'PATCH'); assert.deepEqual(JSON.parse(calls.at(-1)[1].body), { video_id: 7 });
  await client.invite('a'.repeat(32)); assert.match(calls.at(-1)[0], /\/medios\/a{32}\/invite$/);
  await client.resolveClaim('a'.repeat(32), true); assert.match(calls.at(-1)[0], /\/medios\/a{32}\/claim\/approve$/);
  await client.claims(); assert.match(calls.at(-1)[0], /\/media-claims$/);
  await client.events(); assert.match(calls.at(-1)[0], /\/media-events$/);
  await client.eventCoverage('b'.repeat(32)); assert.match(calls.at(-1)[0], /\/media-events\/b{32}$/);
  await client.updateCoverage('b'.repeat(32), 'a'.repeat(32), {}); assert.match(calls.at(-1)[0], /\/media-events\/b{32}\/coverage\/a{32}$/); assert.equal(calls.at(-1)[1].method, 'PATCH');
  await assert.rejects(client.request('/media-events/x'), /Ruta de API no permitida/);
  await assert.rejects(client.request(`/medios/${'a'.repeat(32)}/claim/steal`), /Ruta de API no permitida/);

  const portalCalls = [];
  const api = new MediaApiClient('https://finados.complejomushucruna.com/api', async (url, options) => { portalCalls.push([url, options]); return url.includes('/auth/session') ? json(200, { authenticated: false, csrf: 't' }) : json(200, { ok: true, items: [] }); });
  await api.invitation('c'.repeat(64)); assert.equal(portalCalls.at(-1)[0], `https://finados.complejomushucruna.com/api/media/invitation?token=${'c'.repeat(64)}`);
  await api.lookup('radio mun'); assert.equal(portalCalls.at(-1)[0], 'https://finados.complejomushucruna.com/api/media/lookup?name=radio%20mun');
  await api.claim('a'.repeat(32)); assert.deepEqual(JSON.parse(portalCalls.at(-1)[1].body), { public_id: 'a'.repeat(32) });
  await api.register('x@example.invalid', 'frase segura del medio', 'c'.repeat(64));
  assert.deepEqual(JSON.parse(portalCalls.at(-1)[1].body), { email: 'x@example.invalid', password: 'frase segura del medio', privacyAcknowledged: true, invitation: 'c'.repeat(64) });
  await api.register('x@example.invalid', 'frase segura del medio');
  assert.ok(!('invitation' in JSON.parse(portalCalls.at(-1)[1].body)));
  await api.confirmAttendance('b'.repeat(32), 'yes');
  assert.deepEqual(JSON.parse(portalCalls.at(-1)[1].body), { event: 'b'.repeat(32), answer: 'yes' });
  assert.equal(portalCalls.at(-1)[0], 'https://finados.complejomushucruna.com/api/media/attendance');
  await assert.rejects(api.request('/invitation?token=corto'), /Ruta de API no permitida/);
  await assert.rejects(api.request('/lookup?name=a&extra=1'), /Ruta de API no permitida/);
});
