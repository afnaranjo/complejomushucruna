import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pages } from '../src/pages.mjs';
import { primaryNavigation } from '../src/data/site.mjs';
import { mfsAssetVersion, mfsEvent, mfsPrizes } from '../src/finados/mfs-page.mjs';
import { buildMfsFormData, canShowMfsBadge, ecuadorDateTime, MfsApiClient, mfsStatusMessage, validateMfsForm } from '../src/finados/mfs-portal.js';
import { createMfsAdminClient, normalizeMfsFilters, safeTikTokLink } from '../src/admin/admin-mfs.js';

const page = pages.find(item => item.route === '/finados/mfs/');
const html = page.render(page);

test('MFS tiene su landing noindex y cierra el submenú de Finados', () => {
  assert.ok(page, 'la ruta /finados/mfs/ existe');
  assert.equal(page.indexable, false);
  assert.match(html, /<meta name="robots" content="noindex, nofollow, noarchive">/);
  const children = primaryNavigation.find(item => item.href === '/finados/').children;
  assert.deepEqual(children.at(-1), { label: 'MFS', href: '/finados/mfs/' });
  assert.match(html, /id="navegacion-principal"/);
});

test('la landing usa la línea gráfica de Mushuc Freestyle y sus datos aprobados', () => {
  assert.match(html, new RegExp(`/assets/finados/mfs\\.css\\?v=${mfsAssetVersion}`));
  assert.match(html, /badeen-display-latin\.woff2/);
  for (const name of ['mfs-logo.svg', 'mfs-retrato-1100.webp', 'mfs-retrato-640.webp', 'mfs-organizadores.svg', 'mfs-arte-oficial-800.webp']) {
    assert.ok(html.includes(`/assets/finados/mfs/${name}?v=${mfsAssetVersion}`), name);
  }
  assert.deepEqual(mfsPrizes.map(prize => prize.amount), [600, 250, 100]);
  assert.match(html, /Más de USD 950<br>en premios/);
  assert.ok(html.includes('datetime="2026-11-02T13:00:00-05:00"'));
  assert.ok(html.includes('datetime="2026-10-29T23:59:00-05:00"'));
  assert.ok(html.includes(`${mfsEvent.slots} cupos`));
  assert.ok(html.includes('id="inscripcion"'));
  // La inscripción ya está abierta: los botones llevan a la cuenta del participante.
  assert.ok(html.includes('href="/finados/mfs/acceso/"'));
  assert.ok(html.includes('href="/finados/mfs/acceso/?modo=login"'));
  // La portada ofrece las dos entradas: inscribirse o iniciar sesión.
  const hero = html.slice(html.indexOf('class="mfs-hero"'), html.indexOf('class="mfs-ticker"'));
  assert.match(hero, /href="\/finados\/mfs\/acceso\/">Inscríbete gratis/);
  assert.match(hero, /href="\/finados\/mfs\/acceso\/\?modo=login">Iniciar sesión<\/a>/);
  assert.match(hero, /href="#bases">Ver las bases/);
  assert.doesNotMatch(html, /muy pronto/);
  assert.ok(html.includes('href="#bases"') && html.includes('id="bases"'));
  assert.ok(html.includes('https://wa.me/593980346729'));
  // Sin voseo en los textos nuevos.
  assert.doesNotMatch(html, /\b(inscribite|grabá|subí|registrate|escribinos|podés|tenés|sumate)\b/i);
  // Los enlaces externos abren en otra pestaña de forma segura.
  for (const link of html.match(/<a [^>]*target="_blank"[^>]*>/g) ?? []) assert.match(link, /rel="noopener noreferrer"/);
});

test('los SVG del arte son vectoriales, livianos y sin contenido activo', async () => {
  for (const name of ['mfs-logo', 'mfs-icono', 'mfs-letras', 'mfs-organizadores', 'mfs-plaza']) {
    const svg = await readFile(new URL(`../public/assets/finados/mfs/${name}.svg`, import.meta.url), 'utf8');
    assert.doesNotMatch(svg, /<script|foreignObject|base64|javascript:/i, name);
    assert.ok(svg.length < 200_000, `${name} pesa ${svg.length} bytes`);
  }
});

test('el portal de MFS tiene acceso, registro y restablecer, privados y con su propia API', () => {
  for (const slug of ['acceso', 'mi-registro', 'restablecer']) {
    const portal = pages.find(item => item.route === `/finados/mfs/${slug}/`);
    assert.ok(portal, slug);
    const markup = portal.render(portal);
    assert.match(markup, /noindex, nofollow, noarchive/);
    assert.match(markup, /mfs-portal\.js\?v=/);
    assert.match(markup, /data-mfs-view="(access|profile|reset)"/);
    assert.doesNotMatch(markup, /voceros-portal\.js|emprendedor-portal\.js/);
  }
  const profile = pages.find(item => item.route === '/finados/mfs/mi-registro/').render({ route: '/finados/mfs/mi-registro/' });
  for (const name of ['nombre_completo', 'nombre_artistico', 'cedula', 'whatsapp', 'audicion_tiktok', 'declaracion_video', 'consentimiento_bases', 'autorizacion_imagen', 'consentimiento_datos', 'fotografia']) {
    assert.match(profile, new RegExp(`name="${name}"`), name);
  }
  for (const route of ['/finados/mfs/bases/', '/finados/mfs/politica-de-privacidad/']) {
    const legal = pages.find(item => item.route === route);
    assert.ok(legal, route);
    assert.match(legal.render(legal), /Texto de aceptación del formulario/);
  }
});

test('el formulario de MFS valida como el servidor y arma el multipart exacto', () => {
  const ok = { nombre_completo: 'Juan Rimador', cedula: '1804567890', whatsapp: '0991112222', audicion_tiktok: 'https://www.tiktok.com/@mc/video/1' };
  assert.match(validateMfsForm({ ...ok, cedula: '18045' }, { hasPhoto: true }), /cédula/);
  assert.equal(validateMfsForm(ok, { hasPhoto: true }), '');
  assert.match(validateMfsForm(ok, { hasPhoto: false }), /fotografía/);
  assert.match(validateMfsForm({ ...ok, whatsapp: '0891112222' }, { hasPhoto: true }), /WhatsApp/);
  assert.match(validateMfsForm({ ...ok, audicion_tiktok: 'https://youtube.com/watch?v=1' }, { hasPhoto: true }), /TikTok/);
  assert.match(validateMfsForm({ ...ok, audicion_tiktok: 'https://tiktok.com.evil.test/x' }, { hasPhoto: true }), /TikTok/);
  const elements = { nombre_completo: { value: ' Juan ' }, nombre_artistico: { value: '' }, cedula: { value: '1804567890' }, whatsapp: { value: '0991112222' }, audicion_tiktok: { value: ok.audicion_tiktok },
    declaracion_video: { checked: true }, consentimiento_bases: { checked: true }, autorizacion_imagen: { checked: false }, consentimiento_datos: { checked: true } };
  const data = buildMfsFormData({ elements });
  assert.equal(data.get('nombre_completo'), 'Juan');
  assert.equal(data.get('autorizacion_imagen'), 'No');
  assert.equal(data.get('fotografia'), null);
});

test('los clientes de MFS solo llaman a sus propias rutas', async () => {
  const calls = [];
  const fake = async (url, options) => { calls.push([url, options.method]); return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => ({ csrf: 'token', authenticated: false }) }; };
  const portal = new MfsApiClient('https://finados.complejomushucruna.com/api', fake);
  await assert.rejects(() => portal.request('/emprendedor/profile'), /Ruta de API no permitida/);
  await portal.session();
  assert.equal(calls.at(-1)[0], 'https://finados.complejomushucruna.com/api/mfs/auth/session');
  const admin = createMfsAdminClient('https://finados.complejomushucruna.com/api', fake);
  await assert.rejects(() => admin.request('/emprendedores'), /Ruta de API no permitida/);
  await assert.rejects(() => admin.request('/voceros'), /Ruta de API no permitida/);
  await admin.session();
  await admin.setStatus('a'.repeat(32), 'Seleccionado');
  assert.deepEqual(calls.at(-1), [`https://finados.complejomushucruna.com/api/mfs-participants/${'a'.repeat(32)}`, 'PATCH']);
  assert.throws(() => normalizeMfsFilters({ status: 'Ganador' }), /estado válido/);
  assert.equal(normalizeMfsFilters({ status: 'Archivado' }).status, 'Archivado');
  assert.equal(safeTikTokLink('javascript:alert(1)'), '');
  assert.equal(safeTikTokLink('https://vm.tiktok.com/ZMabc/'), 'https://vm.tiktok.com/ZMabc/');
});

test('Mushuc Freestyle aparece en el panel debajo de Creadoras', () => {
  const admin = pages.find(item => item.route === '/admin/mfs/');
  assert.ok(admin);
  const markup = admin.render(admin);
  const order = [...markup.matchAll(/class="admin-nav-link(?: admin-nav-link--child)?" href="([^"]+)"/g)].map(match => match[1]);
  assert.equal(order.indexOf('/admin/mfs/'), order.indexOf('/admin/creadoras/') + 1);
  assert.equal(order.at(-1), '/admin/mfs/');
  assert.match(markup, /href="\/admin\/mfs\/" aria-current="page"/);
  assert.match(markup, /admin-mfs\.js\?v=/);
  assert.match(markup, /data-admin-restore/);
});

test('Badeen Display queda solo para títulos de marca; lo que hay que leer va en Inter', async () => {
  const css = await readFile(new URL('../src/finados/mfs.css', import.meta.url), 'utf8');
  const rule = selector => css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{[^}]*\\}`))?.[0] ?? '';
  for (const selector of ['.mfs-button', '.mfs-ticker span', '.mfs-prize strong', '.mfs-steps b', '.mfs-page h3', '.mfs-page .mfs-prizes h2']) {
    assert.match(rule(selector), /"Inter"/, selector);
    assert.doesNotMatch(rule(selector), /Badeen/, selector);
  }
  assert.match(rule('.mfs-regresa'), /Badeen Display/);
});

test('el portal celebra la aprobación y solo entonces ofrece el gafete', () => {
  assert.equal(mfsStatusMessage({ registered: true, status: 'Aprobado', stage_name: 'MC Plaza' }).state, 'celebrate');
  assert.match(mfsStatusMessage({ registered: true, status: 'Aprobado', stage_name: 'MC Plaza' }).title, /MC Plaza, tu audición fue aprobada/);
  assert.match(mfsStatusMessage({ registered: true, status: 'Seleccionado' }).kicker, /32/);
  assert.equal(mfsStatusMessage({ registered: true, status: 'Nuevo' }).state, 'default');
  assert.equal(mfsStatusMessage({ registered: false }).state, 'calm');
  for (const [status, expected] of [['Aprobado', true], ['Seleccionado', true], ['Nuevo', false], ['En revisión', false], ['Rechazado', false]]) {
    assert.equal(canShowMfsBadge({ registered: true, status, photo: { available: true } }), expected, status);
  }
  assert.equal(canShowMfsBadge({ registered: true, status: 'Aprobado', photo: { available: false } }), false);
  assert.match(ecuadorDateTime('2026-09-24 21:06:00'), /16:06/);
  const profile = pages.find(item => item.route === '/finados/mfs/mi-registro/').render({ route: '/finados/mfs/mi-registro/' });
  for (const marker of ['data-mfs-status', 'data-mfs-badge', 'data-mfs-cedula-form', 'mfs-portal.css']) assert.match(profile, new RegExp(marker), marker);
  assert.doesNotMatch(profile, /hora UTC/);
});
