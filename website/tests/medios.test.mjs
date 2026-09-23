import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readdir } from 'node:fs/promises';
import { buildSite } from '../scripts/build.mjs';
import { primaryNavigation } from '../src/data/site.mjs';
import { channelsPayload, mediaInitials, TRAFFIC_LIGHTS, MediaApiClient, MediaError, MEDIA_CONSENTS, MEDIA_FIELDS, normalizeLink, platformPayload, profilePayload, validatePhoto } from '../src/finados/media-portal.js';
import { collectVideoViews, createMediaAdminClient, describeField, MEDIA_STATUSES, normalizeMediaFilters, PAID_MEDIA_LABELS, renderMediaSummary, safeLink, topMediaFollowers, topMediaViews, TRAFFIC_LIGHT_LABELS } from '../src/admin/admin-medios.js';
import { topVideoViews } from '../src/admin/admin.js';

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('MEDIOS aparece en el submenú de Finados inmediatamente después de VOCEROS', () => {
  const children = primaryNavigation.find(item => item.href === '/finados/').children.map(item => item.label);
  assert.equal(children.indexOf('MEDIOS'), children.indexOf('VOCEROS') + 1);
  assert.equal(children.indexOf('EMPRENDEDOR'), children.indexOf('MEDIOS') + 1);
  assert.equal(children.at(-1), 'EMPRENDEDOR');
});

test('el build publica la landing, las cuentas de medios y su panel sin tocar la acreditación vigente', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-medios-'));
  const files = await buildSite(output);
  for (const file of ['finados/medios/index.html', 'finados/medios/acceso/index.html', 'finados/medios/mi-registro/index.html',
    'finados/medios/restablecer/index.html', 'admin/medios/index.html', 'assets/finados/media-portal.js', 'assets/finados/media-portal.css', 'assets/admin/admin-medios.js']) {
    assert.ok(files.includes(file), file);
  }
  const landing = await readFile(join(output, 'finados/medios/index.html'), 'utf8');
  const voceroAccess = await readFile(join(output, 'finados/voceros/acceso/index.html'), 'utf8');
  assert.doesNotMatch(voceroAccess, /type="checkbox"[^>]*checked/, 'las casillas de Voceros no cambian');
  assert.match(landing, /<h1 id="media-title">Registro<br>de medios<\/h1>/);
  assert.match(landing, /href="\/finados\/medios\/acceso\/"/);
  assert.match(landing, /href="\/finados\/medios\/acceso\/\?modo=login"/);
  assert.match(landing, /noindex, nofollow, noarchive/);
  assert.match(landing, /id="navegacion-principal"/);
  assert.doesNotMatch(landing, /<form/);

  const access = await readFile(join(output, 'finados/medios/acceso/index.html'), 'utf8');
  assert.match(access, /data-media-register/);
  // Alex pidió que las aceptaciones de Medios vengan marcadas; la persona puede desmarcarlas y el envío las sigue exigiendo.
  assert.match(access, /name="privacyAcknowledged" type="checkbox" required checked/);
  assert.match(access, /data-media-login/);
  assert.match(access, /connect-src https:\/\/finados\.complejomushucruna\.com\/api\/ https:\/\/api\.expoferiamushucruna\.com\/api\//);
  assert.match(access, /form-action 'none'/);
  assert.doesNotMatch(access, /127\.0\.0\.1/);

  const profile = await readFile(join(output, 'finados/medios/mi-registro/index.html'), 'utf8');
  for (const name of [...MEDIA_FIELDS, ...Object.keys(MEDIA_CONSENTS)]) assert.match(profile, new RegExp(`name="${name}"`), name);
  assert.deepEqual([...MEDIA_FIELDS], ['media_name', 'contact_name', 'phone', 'contact_email', 'province', 'city']);
  assert.match(profile, /Se requiere al menos uno/);
  for (const marker of ['data-channel-followers', 'data-media-channel-template', 'data-channel-add', 'data-media-tv-template', 'data-tv-add', 'data-media-photo-form', 'No hay un máximo de cinco']) assert.match(profile, new RegExp(marker), marker);
  assert.match(profile, /img-src 'self' blob:/);
  assert.deepEqual([...profile.matchAll(/name="media_types" value="([a-z]+)"/g)].map(match => match[1]), ['radio', 'tv', 'prensa', 'digital', 'redes']);
  assert.match(profile, /data-media-section="radio" hidden/);
  assert.match(profile, /data-media-section="tv" hidden/);
  for (const name of ['audience_count', 'radio_genre']) assert.match(profile, new RegExp(`name="${name}"`), name);
  assert.match(profile, /Agregar otra emisora/);
  for (const retired of ['people_count', 'team', 'media_type', 'program_name', 'contract', 'social_link', 'facebook', 'tv_channel']) assert.doesNotMatch(profile, new RegExp(`name="${retired}"`), retired);
  assert.match(profile, /name="conditions_accepted" type="checkbox" required checked/);
  assert.match(profile, /name="privacy_accepted" type="checkbox" required checked/);
  // Image use is a separate, optional consent: pre-checked for convenience, never required.
  assert.match(profile, /name="image_accepted" type="checkbox" checked/);
  for (const [route, title] of [['buenas-practicas', 'Buenas prácticas para medios'], ['politica-de-privacidad', 'Política de Privacidad para medios'], ['uso-de-imagen', 'Autorización de uso de imagen y contenido para medios']]) {
    assert.match(profile, new RegExp(`href="/finados/medios/${route}/" target="_blank" rel="noopener noreferrer"`), route);
    const legal = await readFile(join(output, `finados/medios/${route}/index.html`), 'utf8');
    assert.match(legal, new RegExp(`<h1>${title}</h1>`), route);
    assert.match(legal, /noindex, nofollow, noarchive/);
    assert.match(legal, /data-consent-text="(conditions|privacy|image)"/);
    assert.match(legal, /Volver a Medios/);
    assert.doesNotMatch(legal, /Comunidad de Voceros|Políticas del Vocero/, route);
  }
  assert.match(access, /href="\/finados\/medios\/politica-de-privacidad\/"/);
  assert.match(profile, /data-media-video-form/);
  // Registered media land on their videos: avatar header first, then videos, and the profile behind the avatar.
  const positions = ['data-media-dashboard', 'data-media-video-form', 'data-media-profile-panel', 'data-media-photo-form', 'data-media-profile '].map(marker => profile.indexOf(marker));
  assert.ok(positions.every(position => position > 0) && positions.every((position, index) => index === 0 || position > positions[index - 1]), JSON.stringify(positions));
  assert.match(profile, /data-media-profile-toggle aria-expanded="false" aria-controls="media-profile-panel"/);
  assert.match(profile, /data-media-light hidden/);
  // The responsible person's photo is mandatory and opens the profile, before the rest of the form.
  assert.match(profile, /Foto de la persona responsable/);
  assert.match(profile, /No uses el logotipo del medio/);
  assert.ok(profile.indexOf('data-media-photo-form') < profile.indexOf('data-media-profile '), 'la foto va antes de la ficha');
  assert.doesNotMatch(profile, /Es opcional y se guarda cifrada/);
  assert.match(profile, /data-media-video-locked hidden>Podrás agregar los links de tus videos cuando/);
  assert.match(profile, /Agregar video/);

  const admin = await readFile(join(output, 'admin/medios/index.html'), 'utf8');
  assert.match(admin, /data-admin-medios/);
  assert.match(admin, /\/assets\/admin\/admin-medios\.js\?v=/);
  assert.doesNotMatch(admin, /\/assets\/admin\/admin\.js/);
  // The paid-media flag is administrative: filter, column and dropdown live only in the panel.
  // Filter, status form and the coordination record dialog.
  assert.equal((admin.match(/<select name="paid_media"/g) ?? []).length, 3);
  assert.match(admin, /<th scope="col">Pauta<\/th>/);
  const mediaProfile = await readFile(join(output, 'finados/medios/mi-registro/index.html'), 'utf8');
  assert.doesNotMatch(mediaProfile, /paid_media|Medio pautado/);
  const voceros = await readFile(join(output, 'admin/voceros/index.html'), 'utf8');
  for (const html of [admin, voceros]) {
    const order = [...html.matchAll(/class="admin-nav-link" href="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(order, ['/admin/voceros/', '/admin/medios/', '/admin/emprendedores/']);
  }
  assert.match(admin, /href="\/admin\/medios\/" aria-current="page"/);
  assert.match(voceros, /href="\/admin\/voceros\/" aria-current="page"/);

  for (const script of ['assets/finados/media-portal.js', 'assets/admin/admin-medios.js']) {
    assert.match(await readFile(join(output, script), 'utf8'), /const LOCAL_API = null;/, script);
  }
  const accreditation = await readFile(join(output, 'acreditacion-de-medios/index.html'), 'utf8');
  assert.match(accreditation, /action="\/api\/acreditacion-medios\/" method="post"/);
});

test('el cliente de medios solo usa rutas permitidas, envía CSRF y no liga this a fetch', async () => {
  const calls = [];
  const fetchStub = function (url, options) {
    assert.equal(this, undefined);
    calls.push([url, options]);
    if (url.endsWith('/media/auth/session')) return Promise.resolve(json(200, { authenticated: false, user: null, csrf: 'token-1' }));
    if (url.endsWith('/media/auth/login')) return Promise.resolve(json(401, { ok: false }));
    return Promise.resolve(json(202, { ok: true }));
  };
  const api = new MediaApiClient('https://finados.complejomushucruna.com/api', fetchStub);
  await api.register('radio@example.invalid', 'frase segura del medio');
  assert.equal(calls[0][0], 'https://finados.complejomushucruna.com/api/media/auth/session');
  assert.equal(calls[1][1].headers['X-CSRF-Token'], 'token-1');
  assert.equal(calls[1][1].credentials, 'include');
  assert.deepEqual(JSON.parse(calls[1][1].body), { email: 'radio@example.invalid', password: 'frase segura del medio', privacyAcknowledged: true });
  await assert.rejects(api.login('radio@example.invalid', 'otra'), error => error instanceof MediaError && error.status === 401 && /correo y contraseña/.test(error.message));
  await assert.rejects(api.request('/../voceros'), /Ruta de API no permitida/);
  assert.throws(() => new MediaApiClient('https://example.invalid/api'), /Origen de API no permitido/);
});

test('el registro de medios arma el contrato exacto, exige contacto y al menos un canal', () => {
  const data = new FormData();
  const values = { media_name: ' Radio Prueba ', contact_name: 'Persona Responsable', phone: '0991234567', contact_email: 'prensa@example.invalid', province: 'Tungurahua', city: 'Ambato' };
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  const channels = [{ type: 'facebook', url: 'facebook.com/radioprueba', followers: ' 12000 ' }, { type: 'facebook', url: 'https://www.facebook.com/radiopruebariobamba', followers: '' }, { type: 'website', url: 'radioprueba.example', followers: '999' }, { type: 'x', url: '  ', followers: '5' }];
  assert.throws(() => profilePayload(data, [], [], channels), /al menos un tipo de medio/);
  data.append('media_types', 'digital'); data.append('media_types', 'prensa');
  assert.throws(() => profilePayload(data, [], [], []), /al menos un canal/);
  assert.throws(() => profilePayload(data, [], [], channels), /Buenas prácticas y la Política de Privacidad/);
  data.set('conditions_accepted', 'on'); data.set('privacy_accepted', 'on');
  assert.deepEqual(profilePayload(data, [], [], channels), { ...values, media_name: 'Radio Prueba', media_types: ['prensa', 'digital'], radio_stations: [], audience_count: null, radio_genre: '', tv_channels: [],
    channels: [{ type: 'facebook', url: 'https://facebook.com/radioprueba', followers: 12000 }, { type: 'facebook', url: 'https://www.facebook.com/radiopruebariobamba', followers: null }, { type: 'website', url: 'https://radioprueba.example', followers: null }],
    conditions_accepted: true, privacy_accepted: true, image_accepted: false });
  data.set('image_accepted', 'on');
  assert.equal(profilePayload(data, [], [], channels).image_accepted, true);
  assert.equal(normalizeLink('http://www.tiktok.com/@radio/video/1', 500), 'https://www.tiktok.com/@radio/video/1');
  for (const invalid of ['', 'no es un link', 'javascript:alert(1)', 'https://usuario:clave@example.com/', 'https://localhost/video']) assert.throws(() => normalizeLink(invalid), /link válido/, invalid);
  assert.throws(() => channelsPayload([{ type: 'facebook', url: 'sin enlace' }]), /link válido/);
  for (const followers of ['12.000', '-1', '1e4', '10000000000']) assert.throws(() => channelsPayload([{ type: 'tiktok', url: 'tiktok.com/@radio', followers }]), /seguidores solo con números/, followers);
  assert.deepEqual(topMediaFollowers([{ media_name: 'B', followers_total: 10 }, { media_name: 'A', followers_total: 500 }, { media_name: 'Sin dato', followers_total: 0 }]).map(item => item.media_name), ['A', 'B']);
  assert.equal(topMediaFollowers(Array.from({ length: 30 }, (_, index) => ({ media_name: `Medio ${index}`, followers_total: index + 1 }))).length, 20);
  assert.throws(() => channelsPayload([{ type: 'mastodon', url: 'https://example.social/@radio' }]), /red de cada canal/);
  assert.throws(() => channelsPayload([{ type: 'facebook', url: 'facebook.com/radio' }, { type: 'otro', url: 'https://FACEBOOK.com/radio' }]), /repetido/);
  assert.throws(() => channelsPayload(Array.from({ length: 21 }, (_, index) => ({ type: 'website', url: `medio${index}.example` }))), /hasta 20/);
  const broken = (name, value, message) => { const copy = new FormData(); for (const [key, item] of data.entries()) copy.append(key, item); copy.set(name, value); assert.throws(() => profilePayload(copy, [], [], channels), message, name); };
  broken('phone', 'abc', /número telefónico/);
  broken('contact_email', 'correo', /correo de contacto/);
  broken('city', ' ', /ubicación/);
  assert.throws(() => validatePhoto(null), /Selecciona una fotografía/);
  assert.throws(() => validatePhoto({ size: 6 * 1024 * 1024, type: 'image/jpeg' }), error => error.status === 413);
  assert.throws(() => validatePhoto({ size: 1000, type: 'application/pdf' }), error => error.status === 415);
  assert.doesNotThrow(() => validatePhoto({ size: 1000, type: 'image/webp' }));
});

test('tipos de medio: varios a la vez, y Radio exige emisoras, oyentes y género', () => {
  const data = new FormData();
  assert.throws(() => platformPayload([], [], data), /al menos un tipo de medio/);
  assert.deepEqual(platformPayload(['digital', 'prensa', 'inventado'], [{ name: 'x', frequency: 'y' }], data), { media_types: ['prensa', 'digital'], radio_stations: [], audience_count: null, radio_genre: '', tv_channels: [] });
  const stations = [{ name: ' Radio Uno ', frequency: ' 99.9 FM ' }, { name: 'Radio Dos', frequency: '101.5 FM' }];
  assert.throws(() => platformPayload(['radio'], [], data), /cada emisora/);
  assert.throws(() => platformPayload(['radio'], [{ name: 'Radio Uno', frequency: '' }], data), /cada emisora/);
  assert.throws(() => platformPayload(['radio'], stations, data), /oyentes/);
  data.set('audience_count', '25.000');
  assert.throws(() => platformPayload(['radio'], stations, data), /solo con números/);
  data.set('audience_count', '25000');
  assert.throws(() => platformPayload(['radio'], stations, data), /género/);
  data.set('radio_genre', 'Popular y tropical');
  assert.deepEqual(platformPayload(['tv', 'radio'].slice(1), stations, data), { media_types: ['radio'], radio_stations: [{ name: 'Radio Uno', frequency: '99.9 FM' }, { name: 'Radio Dos', frequency: '101.5 FM' }], audience_count: 25000, radio_genre: 'Popular y tropical', tv_channels: [] });
  assert.throws(() => platformPayload(['radio', 'tv'], stations, data), /canal o la señal/);
  assert.throws(() => platformPayload(['radio', 'tv'], stations, data, ['Canal 25', ' ']), /canal o la señal/);
  assert.deepEqual(platformPayload(['radio', 'tv'], stations, data, [' Canal 25 ', 'Canal 40 UHF']).tv_channels, ['Canal 25', 'Canal 40 UHF']);
  assert.deepEqual(platformPayload(['prensa'], stations, data, ['Canal 25']).tv_channels, []);
  assert.throws(() => platformPayload(['radio'], Array.from({ length: 11 }, () => stations[0]), data), /cada emisora/);
  assert.equal(describeField('media_types', ['radio', 'digital']), 'Radio · Medio digital');
  assert.equal(describeField('radio_stations', stations.map(station => ({ name: station.name.trim(), frequency: station.frequency.trim() }))), 'Radio Uno — 99.9 FM\nRadio Dos — 101.5 FM');
  assert.equal(describeField('audience_count', null), '');
  assert.equal(describeField('tv_channels', ['Canal 25', 'Canal 40 UHF']), 'Canal 25\nCanal 40 UHF');
});

test('el medio agrega links de video con CSRF por la ruta permitida', async () => {
  const calls = [];
  const api = new MediaApiClient('https://finados.complejomushucruna.com/api', (url, options) => {
    calls.push([url, options]);
    if (url.endsWith('/media/auth/session')) return Promise.resolve(json(200, { authenticated: true, csrf: 'token-2' }));
    return Promise.resolve(calls.length === 2 ? json(201, { ok: true, videos: [{ url: 'https://youtu.be/abc', created_at: '2026-09-21 10:00:00' }] }) : json(409, { ok: false }));
  });
  const result = await api.addVideo('https://youtu.be/abc');
  assert.equal(calls[1][0], 'https://finados.complejomushucruna.com/api/media/videos');
  assert.deepEqual(JSON.parse(calls[1][1].body), { url: 'https://youtu.be/abc' });
  assert.equal(calls[1][1].headers['X-CSRF-Token'], 'token-2');
  assert.equal(result.videos.length, 1);
  await assert.rejects(api.addVideo('https://youtu.be/abc'), error => error.status === 409 && /ya fue agregado/.test(error.message));
});

test('el panel de medios normaliza filtros, resume estados y restringe sus rutas', async () => {
  assert.deepEqual(normalizeMediaFilters({ search: '  radio ', status: 'Aprobado', page: '0', pageSize: '50', otro: 'x' }), { search: 'radio', status: 'Aprobado', page: 1, pageSize: 50 });
  assert.throws(() => normalizeMediaFilters({ status: 'Eliminado' }), /estado válido/);
  assert.deepEqual(MEDIA_STATUSES, ['Nuevo', 'En revisión', 'Aprobado', 'Rechazado']);
  assert.deepEqual(renderMediaSummary({ total: 3, byStatus: { Nuevo: 2, Aprobado: 1 }, videos: 5, views: 0 }).map(item => item.value), [3, 2, 1, 5, '0']);
  assert.deepEqual(normalizeMediaFilters({ media_type: 'radio', province: 'Azuay' }), { province: 'Azuay', media_type: 'radio', page: 1, pageSize: 25 });
  assert.throws(() => normalizeMediaFilters({ media_type: 'podcast' }), /tipo de medio válido/);
  assert.deepEqual(normalizeMediaFilters({ paid_media: 'yes' }), { paid_media: 'yes', page: 1, pageSize: 25 });
  assert.throws(() => normalizeMediaFilters({ paid_media: 'si' }), /opción válida de pauta/);
  assert.equal(safeLink('https://www.tiktok.com/@radio/video/1'), 'https://www.tiktok.com/@radio/video/1');
  for (const unsafe of ['javascript:alert(1)', 'http://example.com/', 'texto']) assert.equal(safeLink(unsafe), '', unsafe);
  const calls = [];
  const client = createMediaAdminClient('https://finados.complejomushucruna.com/api', async (url, options) => {
    calls.push([url, options]);
    return url.endsWith('/auth/session') ? json(200, { authenticated: true, csrf: 'admin-token' }) : json(200, { ok: true });
  });
  await assert.rejects(client.changeStatus('a'.repeat(32), 'Aprobado'), error => error.status === 403);
  await client.session();
  await client.changeStatus('a'.repeat(32), 'Aprobado');
  assert.deepEqual(JSON.parse(calls.at(-1)[1].body), { status: 'Aprobado' });
  await client.changeStatus('a'.repeat(32), 'Aprobado', 'green');
  assert.deepEqual(JSON.parse(calls.at(-1)[1].body), { status: 'Aprobado', traffic_light: 'green' });
  await client.changeStatus('a'.repeat(32), 'Aprobado', 'green', 'yes');
  assert.deepEqual(JSON.parse(calls.at(-1)[1].body), { status: 'Aprobado', traffic_light: 'green', paid_media: 'yes' });
  assert.deepEqual(Object.keys(PAID_MEDIA_LABELS), ['no', 'yes']);
  assert.deepEqual(Object.keys(TRAFFIC_LIGHT_LABELS), ['red', 'yellow', 'green']);
  assert.deepEqual(Object.keys(TRAFFIC_LIGHTS), ['red', 'yellow', 'green']);
  assert.equal(mediaInitials('  radio  prueba ambato '), 'RP');
  assert.equal(mediaInitials(''), 'M');
  assert.equal(calls.at(-1)[0], `https://finados.complejomushucruna.com/api/medios/${'a'.repeat(32)}`);
  assert.equal(calls.at(-1)[1].method, 'PATCH');
  assert.equal(calls.at(-1)[1].headers['X-CSRF-Token'], 'admin-token');
  await assert.rejects(client.request('/voceros'), /Ruta de API no permitida/);
  await assert.rejects(client.detail('no-valido'), /Ruta de API no permitida/);
});

test('el empaquetado del backend incluye cada catálogo de resources y Medios carga bajo demanda', async () => {
  const script = await readFile(new URL('../scripts/deploy-finados-backend.mjs', import.meta.url), 'utf8');
  const allowlist = /filter\(file => \/(.+?)\/\.test\(file\)\)/.exec(script);
  assert.ok(allowlist, 'no se encontró la lista de archivos del artefacto');
  const pattern = new RegExp(allowlist[1]);
  const resources = await readdir(new URL('../backend/finados-api/resources/', import.meta.url));
  assert.ok(resources.includes('media-consents.json'));
  for (const name of resources) assert.match(`resources/${name}`, pattern, `${name} debe viajar en el artefacto`);
  for (const name of ['src/MediaAuth.php', 'src/MediaRepository.php', 'src/MediaPasswordReset.php', 'migrations/008_media_accounts_mysql.sql', 'migrations/009_media_videos_mysql.sql']) assert.match(name, pattern, name);
  const router = await readFile(new URL('../backend/finados-api/src/Router.php', import.meta.url), 'utf8');
  const constructor = /public function __construct[\s\S]*?\r?\n    }\r?\n/.exec(router)[0];
  assert.doesNotMatch(constructor, /Media/, 'el constructor del Router no debe depender de Medios');
});

test('Top 20 por visualizaciones: Medios suma sus videos y Voceros amplía su ranking a veinte', async () => {
  const media = Array.from({ length: 25 }, (_, index) => ({ public_id: String(index).padStart(32, 'a'), media_name: `Medio ${String(index).padStart(2, '0')}`, views_total: index * 100, videos_count: 2 }));
  const ranking = topMediaViews(media);
  assert.equal(ranking.length, 20);
  assert.equal(ranking[0].media_name, 'Medio 24');
  assert.ok(ranking.every(item => item.views_total > 0));
  assert.deepEqual(topMediaViews([{ media_name: 'B', views_total: 5 }, { media_name: 'A', views_total: 5 }, { media_name: 'Sin views', views_total: 0 }, null]).map(item => item.media_name), ['A', 'B']);
  const videos = Array.from({ length: 30 }, (_, index) => ({ full_name: `Vocero ${index}`, slot: 1, views_count: index + 1 }));
  assert.equal(topVideoViews(videos).length, 20);

  assert.deepEqual(collectVideoViews([{ dataset: { videoId: '7' }, value: ' 1500 ' }, { dataset: { videoId: '9' }, value: '0' }]), { 7: 1500, 9: 0 });
  for (const value of ['', '1.500', '-3', '1e3', '1000000001']) assert.throws(() => collectVideoViews([{ dataset: { videoId: '7' }, value }]), /números enteros/, value);
  assert.throws(() => collectVideoViews([]), /no tiene videos/);

  const calls = [];
  const client = createMediaAdminClient('https://finados.complejomushucruna.com/api', async (url, options) => {
    calls.push([url, options]);
    return url.endsWith('/auth/session') ? json(200, { authenticated: true, csrf: 'admin-token' }) : json(200, { ok: true });
  });
  await client.session();
  await client.updateVideoViews('b'.repeat(32), { 7: 1500 });
  assert.equal(calls.at(-1)[0], `https://finados.complejomushucruna.com/api/medios/${'b'.repeat(32)}/video-views`);
  assert.equal(calls.at(-1)[1].method, 'PATCH');
  assert.deepEqual(JSON.parse(calls.at(-1)[1].body), { video_views: { 7: 1500 } });

  const output = await mkdtemp(join(tmpdir(), 'mushuc-top20-'));
  await buildSite(output);
  const mediosAdmin = await readFile(join(output, 'admin/medios/index.html'), 'utf8');
  assert.match(mediosAdmin, /Top 20 por visualizaciones/);
  assert.match(mediosAdmin, /Top 20 por seguidores/);
  const voceros = await readFile(join(output, 'admin/voceros/index.html'), 'utf8');
  assert.match(voceros, /Top 20 por visualizaciones de videos/);
  assert.match(voceros, /Top 20 por seguidores/);
  assert.doesNotMatch(voceros, /Top 10/);
});
