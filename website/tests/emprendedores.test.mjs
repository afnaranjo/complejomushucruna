import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildSite } from '../scripts/build.mjs';
import { primaryNavigation } from '../src/data/site.mjs';
import { pages } from '../src/pages.mjs';
import { badgeVerificationUrl, createBadgeQrMatrix, EmprendedorApiClient, EmprendedorError, EmprendedorProfileState, isProfileReadyForAutoSave, PROFILE_FIELDS, validatePhoto } from '../src/finados/emprendedor-portal.js';
import { fetchBadgeVerification, verificationApiUrl } from '../src/finados/emprendedor-verification.js';
import { collectEmprendedorProgressPayload, collectEmprendedorVideoSchedulePayload, createEmprendedorAdminClient, EMPRENDEDOR_LEVELS, EMPRENDEDOR_STATUSES, emprendedorVideoSubmissionState, normalizeEmprendedorFilters, renderEmprendedorSummary, topEmprendedorFollowers, topEmprendedorVideoViews } from '../src/admin/admin-emprendedores.js';
import { EMPRENDEDOR_LEVELS as PORTAL_LEVELS } from '../src/emprendedores/portal-page.mjs';

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('EMPRENDEDOR va después de MEDIOS y antes de MFS; Creadoras no aparece en el menú', () => {
  const children = primaryNavigation.find(item => item.href === '/finados/').children;
  assert.deepEqual(children.at(-2), { label: 'EMPRENDEDOR', href: '/finados/emprendedores/' });
  assert.deepEqual(children.at(-1), { label: 'MFS', href: '/finados/mfs/' });
  assert.equal(children.some(item => item.href.startsWith('/finados/creadoras/')), false);
  assert.equal(children.map(item => item.label).indexOf('EMPRENDEDOR'), children.map(item => item.label).indexOf('MEDIOS') + 1);
});

test('el build publica la landing, el portal, la validación, los cinco documentos y el panel de Emprendedores', async () => {
  const output = await mkdtemp(join(tmpdir(), 'mushuc-emprendedores-'));
  const files = await buildSite(output);
  for (const file of ['finados/emprendedores/index.html', 'finados/emprendedores/acceso/index.html', 'finados/emprendedores/mi-registro/index.html', 'finados/emprendedores/restablecer/index.html',
    'finados/emprendedores/verificar/index.html', 'admin/emprendedores/index.html', 'assets/finados/emprendedor-portal.js', 'assets/finados/emprendedor-verification.js', 'assets/admin/admin-emprendedores.js',
    ...['politicas-del-programa', 'bases-de-participacion', 'politica-de-privacidad', 'autorizacion-de-imagen', 'ejercer-derechos'].map(slug => `finados/emprendedores/${slug}/index.html`)]) {
    assert.ok(files.includes(file), file);
  }
  // Voceros and Medios pages are byte-for-byte unaffected by the new programme.
  const voceroProfile = await readFile(join(output, 'finados/voceros/mi-registro/index.html'), 'utf8');
  assert.doesNotMatch(voceroProfile, /emprendedor/i);
  const mediaProfile = await readFile(join(output, 'finados/medios/mi-registro/index.html'), 'utf8');
  assert.doesNotMatch(mediaProfile, /emprendedor/i);

  const landing = await readFile(join(output, 'finados/emprendedores/index.html'), 'utf8');
  assert.match(landing, /De emprendedor a influencer/);
  assert.match(landing, /href="\/finados\/emprendedores\/acceso\/"/);
  assert.match(landing, /href="\/finados\/emprendedores\/acceso\/\?modo=login"/);
  assert.match(landing, /noindex, nofollow, noarchive/);
  assert.match(landing, /id="navegacion-principal"/);
  assert.match(landing, /href="\/finados\/emprendedores\/" aria-current="page"/);
  // No prizes, thresholds or dates are invented for the programme.
  assert.doesNotMatch(landing, /vistas válidas acumuladas|Gorra|Kit completo|premios económicos/);
  for (const level of PORTAL_LEVELS) assert.match(landing, new RegExp(`<h3>${level}</h3>`), level);

  const access = await readFile(join(output, 'finados/emprendedores/acceso/index.html'), 'utf8');
  assert.match(access, /data-emprendedor-view="access"/);
  assert.match(access, /data-vocero-register/);
  assert.match(access, /connect-src https:\/\/finados\.complejomushucruna\.com\/api\/ https:\/\/api\.expoferiamushucruna\.com\/api\//);
  assert.match(access, /form-action 'none'/);
  assert.match(access, /<meta name="emprendedor-api-base" content="https:\/\/finados\.complejomushucruna\.com\/api">/);
  assert.doesNotMatch(access, /127\.0\.0\.1/);
  assert.doesNotMatch(access, /cookie-consent|fbevents/);
  assert.match(access, /programa De emprendedor a influencer/);

  const profile = await readFile(join(output, 'finados/emprendedores/mi-registro/index.html'), 'utf8');
  assert.match(profile, /data-emprendedor-view="profile"/);
  assert.match(profile, /data-emprendedor-profile/);
  for (const name of [...Object.keys(PROFILE_FIELDS), 'fotografia', 'consentimiento_politicas', 'autorizacion_imagen', 'consentimiento_datos']) assert.match(profile, new RegExp(`name="${name}"`), name);
  for (const retired of ['vocero_previo', 'fuente_comunidad', 'retiro_kit', 'representante_nombre', 'submission_id']) assert.doesNotMatch(profile, new RegExp(`name="${retired}"`), retired);
  assert.doesNotMatch(profile, /data-vocero-minor|Kit</);
  assert.match(profile, /name="emprendimiento"[^>]*required/);
  assert.match(profile, /name="stand"(?![^>]*required)/);
  assert.match(profile, /data-emprendedor-business/);
  assert.equal((profile.match(/data-video-slot="/g) ?? []).length, 5);
  assert.equal((profile.match(/data-vocero-level="/g) ?? []).length, 7);
  assert.match(profile, /img-src 'self' blob:/);
  for (const slug of ['politicas-del-programa', 'bases-de-participacion', 'autorizacion-de-imagen', 'politica-de-privacidad']) assert.match(profile, new RegExp(`href="/finados/emprendedores/${slug}/" target="_blank" rel="noopener noreferrer"`), slug);
  // Consent texts are the server catalogue, escaped at build time.
  const consents = JSON.parse(await readFile(new URL('../backend/finados-api/resources/emprendedor-consents.json', import.meta.url), 'utf8'));
  for (const key of ['policies', 'image', 'data']) assert.ok(profile.includes(consents[key].text.replace(/'/g, '&#39;')) || profile.includes(consents[key].text), key);
  assert.ok(access.includes(consents.account.text));

  const verify = await readFile(join(output, 'finados/emprendedores/verificar/index.html'), 'utf8');
  assert.match(verify, /data-emprendedor-verification/);
  assert.match(verify, /data-emprendedor-verify-business/);
  assert.match(verify, /noindex, nofollow, noarchive/);
  assert.doesNotMatch(verify, /fbevents|1494610251215623/);

  for (const [slug, title, consent] of [['politicas-del-programa', 'Políticas del programa De emprendedor a influencer', 'policies'], ['bases-de-participacion', 'Bases de participación', 'policies'], ['politica-de-privacidad', 'Política de Privacidad', 'data'], ['autorizacion-de-imagen', 'Autorización de uso de imagen y contenido', 'image']]) {
    const legal = await readFile(join(output, `finados/emprendedores/${slug}/index.html`), 'utf8');
    assert.match(legal, new RegExp(`<h1>${title}</h1>`), slug);
    assert.match(legal, /noindex, nofollow, noarchive/);
    assert.match(legal, new RegExp(`data-consent-text="${consent}"`), slug);
    assert.ok(legal.includes(consents[consent].text), slug);
    assert.match(legal, /Volver a Emprendedores/);
    assert.doesNotMatch(legal, /Comunidad de Voceros|Políticas del Vocero|Termómetro/, slug);
  }
  const rights = await readFile(join(output, 'finados/emprendedores/ejercer-derechos/index.html'), 'utf8');
  assert.match(rights, /<h1>Contacto para ejercer derechos<\/h1>/);
  assert.doesNotMatch(rights, /data-consent-text/);

  const admin = await readFile(join(output, 'admin/emprendedores/index.html'), 'utf8');
  assert.match(admin, /data-admin-emprendedores/);
  assert.match(admin, /\/assets\/admin\/admin-emprendedores\.js\?v=/);
  assert.doesNotMatch(admin, /\/assets\/admin\/admin\.js|admin-medios\.js/);
  assert.match(admin, /href="\/admin\/emprendedores\/" aria-current="page"/);
  assert.match(admin, /Habilitación global de videos/);
  assert.match(admin, /Top 20 por visualizaciones de videos/);
  assert.match(admin, /Top 20 por seguidores/);
  assert.equal((admin.match(/name="schedule_video_\d_enabled_at"/g) ?? []).length, 5);
  assert.doesNotMatch(admin, /name="kit_status"|Retiro de kit/);
  for (const level of EMPRENDEDOR_LEVELS) assert.match(admin, new RegExp(level), level);
  const voceros = await readFile(join(output, 'admin/voceros/index.html'), 'utf8');
  for (const html of [admin, voceros]) {
    const order = [...html.matchAll(/class="admin-nav-link" href="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(order, ['/admin/noticias/', '/admin/panel/', '/admin/voceros/', '/admin/medios/', '/admin/emprendedores/', '/admin/creadoras/', '/admin/mfs/']);
  }
  assert.match(voceros, /name="kit_status"/, 'el panel de Voceros conserva su kit');
});

test('las rutas de Emprendedores están registradas sin indexación y el portal usa un solo render', () => {
  const routes = pages.filter(page => page.route.startsWith('/finados/emprendedores/') || page.route === '/admin/emprendedores/');
  assert.equal(routes.length, 11);
  assert.ok(routes.every(page => page.indexable === false));
  assert.equal(new Set(['acceso', 'mi-registro', 'restablecer'].map(slug => pages.find(page => page.route === `/finados/emprendedores/${slug}/`).render)).size, 1);
});

test('el cliente del portal solo usa rutas permitidas, prefijo /emprendedor y CSRF', async () => {
  const calls = [];
  const fetchStub = function (url, options) {
    assert.equal(this, undefined);
    calls.push([url, options]);
    if (url.endsWith('/emprendedor/auth/session')) return Promise.resolve(json(200, { authenticated: false, user: null, csrf: 'token-1' }));
    if (url.endsWith('/emprendedor/auth/login')) return Promise.resolve(json(401, { ok: false }));
    return Promise.resolve(json(202, { ok: true }));
  };
  const api = new EmprendedorApiClient('https://finados.complejomushucruna.com/api', fetchStub);
  await api.register('tienda@example.invalid', 'frase segura del emprendimiento');
  assert.equal(calls[0][0], 'https://finados.complejomushucruna.com/api/emprendedor/auth/session');
  assert.equal(calls[1][0], 'https://finados.complejomushucruna.com/api/emprendedor/auth/register');
  assert.equal(calls[1][1].headers['X-CSRF-Token'], 'token-1');
  assert.equal(calls[1][1].credentials, 'include');
  await api.saveVideo(3, 'https://www.tiktok.com/@tienda/video/3');
  assert.equal(calls.at(-1)[0], 'https://finados.complejomushucruna.com/api/emprendedor/videos/3');
  await assert.rejects(api.login('tienda@example.invalid', 'otra'), error => error instanceof EmprendedorError && error.status === 401 && /correo y contraseña/.test(error.message));
  await assert.rejects(api.request('/videos/6'), /Ruta de API no permitida/);
  await assert.rejects(api.request('/../vocero/profile'), /Ruta de API no permitida/);
  assert.throws(() => new EmprendedorApiClient('https://example.invalid/api'), /Origen de API no permitido/);
});

test('el estado del perfil mapea los campos del emprendedor, exige foto hasta tenerla y bloquea registros revisados', () => {
  const state = new EmprendedorProfileState();
  const values = state.load({ registered: true, public_id: 'a'.repeat(32), status: 'Nuevo', full_name: 'María', business_name: 'Dulces', product: 'Colada', stand_code: 'A-12', main_network: 'TikTok', previous_participation: 'No, es mi primera vez', photo: { available: false } });
  assert.equal(values.emprendimiento, 'Dulces');
  assert.equal(values.producto, 'Colada');
  assert.equal(values.stand, 'A-12');
  assert.equal(state.photoRequired, true, 'sin foto guardada, la foto sigue siendo obligatoria');
  assert.equal(state.editable, true);
  state.load({ registered: true, public_id: 'a'.repeat(32), status: 'Aprobado', photo: { available: true } });
  assert.equal(state.photoRequired, false);
  assert.equal(state.editable, false);
  assert.throws(() => state.body(new Map()), error => error.status === 403);
  assert.throws(() => state.load({ registered: true, public_id: 'x', status: 'Nuevo' }), error => error.status === 502);
  assert.deepEqual(Object.keys(PROFILE_FIELDS), ['nombre_completo', 'cedula', 'fecha_nacimiento', 'whatsapp', 'ciudad', 'emprendimiento', 'producto', 'stand', 'tiktok', 'instagram', 'facebook', 'red_principal', 'participacion_previa']);
  assert.throws(() => validatePhoto({ size: 6 * 1024 * 1024, type: 'image/jpeg' }), error => error.status === 413);
});

test('el autoguardado exige mayoría de edad y al menos una red social', () => {
  const form = fields => ({ checkValidity: () => true, elements: { namedItem: name => (name in fields ? { value: fields[name] } : null) } });
  assert.equal(isProfileReadyForAutoSave(form({ fecha_nacimiento: '1990-01-01', tiktok: 'https://www.tiktok.com/@x' })), true);
  assert.equal(isProfileReadyForAutoSave(form({ fecha_nacimiento: '1990-01-01', tiktok: '', instagram: '', facebook: '' })), false);
  const minor = new Date(); minor.setFullYear(minor.getFullYear() - 17);
  assert.equal(isProfileReadyForAutoSave(form({ fecha_nacimiento: minor.toISOString().slice(0, 10), tiktok: 'https://www.tiktok.com/@x' })), false);
});

test('el gafete y la validación pública usan la ruta de emprendedores y solo el identificador público', async () => {
  assert.equal(badgeVerificationUrl('b'.repeat(32)), `https://complejomushucruna.com/finados/emprendedores/verificar/?id=${'b'.repeat(32)}`);
  assert.throws(() => badgeVerificationUrl('correo@example.invalid'), /inválido/);
  assert.ok(createBadgeQrMatrix(badgeVerificationUrl('b'.repeat(32))).length > 20);
  assert.equal(verificationApiUrl('https://finados.complejomushucruna.com/api', 'b'.repeat(32)), `https://finados.complejomushucruna.com/api/emprendedores/verify/${'b'.repeat(32)}`);
  const calls = [];
  const verification = await fetchBadgeVerification('https://finados.complejomushucruna.com/api', 'b'.repeat(32), async (url, options) => {
    calls.push([url, options]);
    return json(200, { ok: true, verification: { name: 'María', business_name: 'Dulces de la Abuela', level: 2, level_label: 'En camino', traffic_light: 'yellow' } });
  });
  assert.equal(calls[0][1].credentials, 'omit');
  assert.deepEqual(verification, { name: 'María', business: 'Dulces de la Abuela', level: 'En camino', light: { short: 'Amarillo', long: 'En avance' } });
});

test('el panel de emprendedores normaliza filtros, resume y usa solo rutas propias', async () => {
  assert.deepEqual(EMPRENDEDOR_STATUSES, ['Nuevo', 'En revisión', 'Aprobado', 'Rechazado']);
  assert.deepEqual(EMPRENDEDOR_LEVELS, PORTAL_LEVELS);
  assert.deepEqual(normalizeEmprendedorFilters({ main_network: 'TikTok', city: ' Ambato ', search: 'dulces' }), { search: 'dulces', city: 'Ambato', main_network: 'TikTok', page: 1, pageSize: 25 });
  assert.throws(() => normalizeEmprendedorFilters({ status: 'Pendiente de autorización' }), /estado válido/);
  assert.throws(() => normalizeEmprendedorFilters({ main_network: 'YouTube' }), /red válida/);
  assert.deepEqual(renderEmprendedorSummary({ total: 3, byStatus: { Nuevo: 2, Aprobado: 1 }, lastSevenDays: 3 }).map(item => item.value), [3, 2, 1, 3]);
  assert.deepEqual(topEmprendedorFollowers([{ full_name: 'B', followers_count: 5 }, { full_name: 'A', followers_count: 9 }]).map(item => item.full_name), ['A', 'B']);
  assert.equal(topEmprendedorVideoViews([{ full_name: 'A', slot: 2, views_count: 0 }]).length, 0);
  assert.deepEqual(emprendedorVideoSubmissionState({ videos_submitted: 2 }), { submitted: 2, total: 5 });
  const form = { elements: { namedItem: name => ({ value: name === 'video_views_1' ? '4200' : '0' }), followers_count: { value: '2600' }, level: { value: '3' }, traffic_light: { value: 'green' } } };
  const payload = collectEmprendedorProgressPayload(form).body;
  assert.deepEqual(payload, { followers_count: 2600, level: 3, traffic_light: 'green', video_views: [{ slot: 1, views_count: 4200 }, { slot: 2, views_count: 0 }, { slot: 3, views_count: 0 }, { slot: 4, views_count: 0 }, { slot: 5, views_count: 0 }] });
  assert.ok(!('kit_status' in payload));
  assert.match(collectEmprendedorVideoSchedulePayload((slot, suffix) => (suffix === 'enabled' ? { checked: slot === 1 } : { value: '' })).error, /fecha de habilitación del video 1/);

  const calls = [];
  const client = createEmprendedorAdminClient('https://finados.complejomushucruna.com/api', async (url, options) => {
    calls.push([url, options]);
    return url.endsWith('/auth/session') ? json(200, { authenticated: true, csrf: 'admin-token' }) : json(200, { ok: true });
  });
  await client.session();
  await client.request('/emprendedor-dashboard');
  await client.request(`/emprendedores/${'a'.repeat(32)}/progress`, { method: 'PATCH', body: payload });
  assert.equal(calls.at(-1)[1].headers['X-CSRF-Token'], 'admin-token');
  await client.updateVideoSchedule({ video_slots: [] });
  assert.equal(calls.at(-1)[0], 'https://finados.complejomushucruna.com/api/emprendedor-video-schedule');
  await assert.rejects(client.request('/voceros'), /Ruta de API no permitida/);
  await assert.rejects(client.request('/medios'), /Ruta de API no permitida/);
  await assert.rejects(client.request('/dashboard'), /Ruta de API no permitida/);
});

test('el artefacto del backend exige las clases, el catálogo y la migración de Emprendedores', async () => {
  const deploy = await readFile(new URL('../scripts/deploy-finados-backend.mjs', import.meta.url), 'utf8');
  assert.match(deploy, /resources\\\/\(\?:vocero\|media\|emprendedor\|creadora\|mfs\)-consents\\\.json/);
  for (const name of ['src/EmprendedorAuth.php', 'src/EmprendedorRepository.php', 'src/EmprendedorPasswordReset.php', 'src/EmprendedorPhotoStorage.php', 'resources/emprendedor-consents.json', 'migrations/017_emprendedor_accounts_mysql.sql']) assert.ok(deploy.includes(`'${name}'`), name);
  const router = await readFile(new URL('../backend/finados-api/src/Router.php', import.meta.url), 'utf8');
  const start = router.indexOf('public function __construct(private readonly Config $config');
  const constructor = router.slice(start, router.indexOf('public function handle', start));
  assert.doesNotMatch(constructor, /Emprendedor|Media/, 'el Router no construye Emprendedor ni Medios al arrancar');
});
