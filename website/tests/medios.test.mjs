import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readdir } from 'node:fs/promises';
import { buildSite } from '../scripts/build.mjs';
import { primaryNavigation } from '../src/data/site.mjs';
import { MediaApiClient, MediaError, MEDIA_FIELDS, normalizeLink, profilePayload } from '../src/finados/media-portal.js';
import { createMediaAdminClient, MEDIA_STATUSES, normalizeMediaFilters, renderMediaSummary, safeLink } from '../src/admin/admin-medios.js';

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('MEDIOS aparece en el submenú de Finados inmediatamente después de VOCEROS', () => {
  const children = primaryNavigation.find(item => item.href === '/finados/').children.map(item => item.label);
  assert.equal(children.indexOf('MEDIOS'), children.indexOf('VOCEROS') + 1);
  assert.equal(children.at(-1), 'MEDIOS');
});

test('el build publica la landing, las cuentas de medios y su panel sin tocar la acreditación vigente', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-medios-'));
  const files = await buildSite(output);
  for (const file of ['finados/medios/index.html', 'finados/medios/acceso/index.html', 'finados/medios/mi-registro/index.html',
    'finados/medios/restablecer/index.html', 'admin/medios/index.html', 'assets/finados/media-portal.js', 'assets/finados/media-portal.css', 'assets/admin/admin-medios.js']) {
    assert.ok(files.includes(file), file);
  }
  const landing = await readFile(join(output, 'finados/medios/index.html'), 'utf8');
  assert.match(landing, /<h1 id="media-title">Registro<br>de medios<\/h1>/);
  assert.match(landing, /href="\/finados\/medios\/acceso\/"/);
  assert.match(landing, /href="\/finados\/medios\/acceso\/\?modo=login"/);
  assert.match(landing, /noindex, nofollow, noarchive/);
  assert.match(landing, /id="navegacion-principal"/);
  assert.doesNotMatch(landing, /<form/);

  const access = await readFile(join(output, 'finados/medios/acceso/index.html'), 'utf8');
  assert.match(access, /data-media-register/);
  assert.match(access, /data-media-login/);
  assert.match(access, /connect-src https:\/\/finados\.complejomushucruna\.com\/api\/ https:\/\/api\.expoferiamushucruna\.com\/api\//);
  assert.match(access, /form-action 'none'/);
  assert.doesNotMatch(access, /127\.0\.0\.1/);

  const profile = await readFile(join(output, 'finados/medios/mi-registro/index.html'), 'utf8');
  for (const name of [...MEDIA_FIELDS, 'conditions_accepted']) assert.match(profile, new RegExp(`name="${name}"`), name);
  assert.deepEqual([...MEDIA_FIELDS], ['media_name', 'frequency_channel', 'social_link']);
  for (const retired of ['people_count', 'team', 'media_type', 'program_name', 'province', 'contract', 'phone']) assert.doesNotMatch(profile, new RegExp(`name="${retired}"`), retired);
  assert.match(profile, /data-media-video-form/);
  assert.match(profile, /Agregar video/);

  const admin = await readFile(join(output, 'admin/medios/index.html'), 'utf8');
  assert.match(admin, /data-admin-medios/);
  assert.match(admin, /\/assets\/admin\/admin-medios\.js\?v=/);
  assert.doesNotMatch(admin, /\/assets\/admin\/admin\.js/);
  const voceros = await readFile(join(output, 'admin/voceros/index.html'), 'utf8');
  for (const html of [admin, voceros]) {
    const order = [...html.matchAll(/class="admin-nav-link" href="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(order, ['/admin/voceros/', '/admin/medios/']);
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

test('el registro de medios arma el contrato exacto y normaliza los links', () => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ media_name: ' Radio Prueba ', frequency_channel: '99.9 FM', social_link: 'facebook.com/radioprueba' })) data.set(name, value);
  assert.throws(() => profilePayload(data), /condiciones/);
  data.set('conditions_accepted', 'on');
  assert.deepEqual(profilePayload(data), { media_name: 'Radio Prueba', frequency_channel: '99.9 FM', social_link: 'https://facebook.com/radioprueba', conditions_accepted: true });
  assert.equal(normalizeLink('http://www.tiktok.com/@radio/video/1', 500), 'https://www.tiktok.com/@radio/video/1');
  for (const invalid of ['', 'no es un link', 'javascript:alert(1)', 'https://usuario:clave@example.com/', 'https://localhost/video']) assert.throws(() => normalizeLink(invalid), /link válido/, invalid);
  data.set('social_link', 'sin enlace');
  assert.throws(() => profilePayload(data), /link válido/);
  data.set('social_link', 'https://instagram.com/radio'); data.set('frequency_channel', ' ');
  assert.throws(() => profilePayload(data), /nombre del medio y su frecuencia/);
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
  assert.deepEqual(renderMediaSummary({ total: 3, byStatus: { Nuevo: 2, Aprobado: 1 }, videos: 5 }).map(item => item.value), [3, 2, 1, 5]);
  assert.deepEqual(normalizeMediaFilters({ media_type: 'TV', province: 'Azuay' }), { page: 1, pageSize: 25 });
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
  const constructor = /public function __construct[\s\S]*?\n    }\n/.exec(router)[0];
  assert.doesNotMatch(constructor, /Media/, 'el constructor del Router no debe depender de Medios');
});
