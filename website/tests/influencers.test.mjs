import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pages } from '../src/pages.mjs';
import { badgePath, badgeVerificationUrl, createInvitationClient, describeVerification, eventDateLabel, eventDateParts, eventTimeLabel, inaugurationNarrative, invitationPaths, invitationRoleLabel, invitationStorageKey, invitationToken, resolveInvitationVariant, responseMessage, thanksContent, THANKS_PATH, validateOpenForm } from '../src/finados/influencer-invitation.js';
import { badgeMessage, badgeUrl, invitationMessage, matchesFilter, openInvitationUrl, personalInvitationUrl, whatsappLink, whatsappNumber } from '../src/admin/admin-influencers.js';

const render = route => { const page = pages.find(item => item.route === route); assert.ok(page, route); return page.render(page); };

test('Influencers aparece en el menú con Creadores y Nuevos creadores', () => {
  const html = render('/admin/influencers/creadores/');
  assert.match(html, /data-nav-group data-module="influencers"/);
  assert.ok(html.includes('href="/admin/influencers/creadores/" aria-current="page"'));
  assert.ok(html.includes('href="/admin/influencers/nuevos/"'));
  assert.match(html, /data-add-form/);
  const nuevos = render('/admin/influencers/nuevos/');
  assert.match(nuevos, /data-open-link/);
  assert.match(nuevos, /<option value="por_aprobar">Por aprobar<\/option>/);
});

test('las dos invitaciones muestran el Lanzamiento Guaynaa, su fecha y su lugar sin Pixel ni cookies', async () => {
  for (const route of ['/finados/invitacion/', '/finados/invitacion/creadores/']) {
    const html = render(route);
    assert.match(html, /noindex, nofollow, noarchive/);
    assert.ok(html.includes('Lanzamiento Guaynaa'));
    assert.ok(html.includes('Jueves 15 de octubre de 2026'));
    assert.ok(html.includes('Juan Montalvo y 12 de Noviembre, Ambato, Ecuador'));
    assert.doesNotMatch(html, /1494610251215623|data-cookie-consent/);
    assert.ok(html.includes('guaynaa-lanzamiento-hoy-1122.webp'), route);
    assert.ok(html.includes('18:00 · hora de Ecuador'), route);
    assert.match(html, /<dt>Dress code<\/dt><dd>[^<]*<span class="inv-dress-swatch"[^>]*><\/span>Blanco/, route);
    assert.ok(html.includes('estamos en busca de talentos para todas nuestras marcas amigas'), route);
    for (const zone of ['Zona VIP', 'Zona de creadores', 'Zona de cócteles']) assert.ok(html.includes(zone), `${route} ${zone}`);
  }
  assert.match(render('/finados/invitacion/'), /data-answer="si">Sí, ahí estaré/);
  assert.match(render('/finados/invitacion/creadores/'), /name="consent" required/);
  const built = await readFile(new URL('../dist/finados/invitacion/index.html', import.meta.url), 'utf8').catch(() => '');
  if (built) assert.doesNotMatch(built, /1494610251215623|data-cookie-consent/);
});

test('la invitación lee la fecha en español, la hora o «por confirmar» y el código del enlace', () => {
  assert.equal(eventDateLabel('2026-10-15'), 'Jueves 15 de octubre de 2026');
  assert.equal(eventDateLabel('15/10/2026'), '');
  assert.deepEqual(eventDateParts('2026-10-30'), { weekday: 'VIE', day: '30', month: 'OCT' });
  assert.deepEqual(eventDateParts('30/10/2026'), { weekday: '', day: '', month: '' });
  assert.equal(eventTimeLabel(''), 'Hora por confirmar');
  assert.equal(eventTimeLabel('19:30'), '19:30 · hora de Ecuador');
  const token = 'a'.repeat(32);
  assert.equal(invitationToken(`?c=${token}`), token);
  assert.equal(invitationToken('?c=../../x'), '');
  assert.match(responseMessage('si', 'Ana'), /^¡Ana, te esperamos!/);
  assert.match(responseMessage('no', 'Ana'), /Gracias por avisarnos, Ana/);
});

test('el formulario de nuevos creadores valida antes de enviar', () => {
  const ok = { full_name: 'Mía Tapia', whatsapp: '098 765 4321', social_link: '@mia.crea', followers: '12500', city: 'Ambato', response: 'si', consent: true };
  assert.deepEqual(validateOpenForm(ok).data, { ...ok, whatsapp: '0987654321', followers: 12500 });
  assert.equal(validateOpenForm({ ...ok, whatsapp: '12' }).field, 'whatsapp');
  assert.equal(validateOpenForm({ ...ok, social_link: 'http://x.com/a' }).field, 'social_link');
  assert.equal(validateOpenForm({ ...ok, followers: 'mil' }).field, 'followers');
  assert.equal(validateOpenForm({ ...ok, response: undefined }).field, 'response');
  assert.equal(validateOpenForm({ ...ok, consent: false }).field, 'consent');
});

test('el panel arma el enlace personal y el mensaje listo para WhatsApp', () => {
  const token = 'b'.repeat(32);
  const url = personalInvitationUrl('https://finados.expoferiamushucruna.com', token);
  assert.equal(url, `https://finados.expoferiamushucruna.com/i/?c=${token}`);
  assert.equal(openInvitationUrl('https://complejomushucruna.com'), 'https://complejomushucruna.com/finados/invitacion/creadores/');
  assert.equal(whatsappNumber('0987654321'), '593987654321');
  assert.equal(whatsappNumber(''), '');
  const link = whatsappLink('0987654321', invitationMessage('Ana', url));
  assert.ok(link.startsWith('https://wa.me/593987654321?text='));
  assert.ok(decodeURIComponent(link).includes(url));
  assert.ok(whatsappLink('', 'hola').startsWith('https://wa.me/?text='));
  assert.equal(matchesFilter({ response: 'si', approval: 'pendiente' }, 'por_aprobar'), true);
  assert.equal(matchesFilter({ response: 'no', approval: 'aprobado' }, 'si'), false);
});

test('el panel arma enlaces y mensajes independientes para la Inauguración', () => {
  const origin = 'https://finados.expoferiamushucruna.com';
  const token = 'b'.repeat(32);
  const support = personalInvitationUrl(origin, token, 'inauguracion', 'apoyo');
  const registration = personalInvitationUrl(origin, token, 'inauguracion', 'registro');
  assert.equal(support, `${origin}/finados/invitacion/inauguracion/?c=${token}&variante=apoyo`);
  assert.equal(registration, `${origin}/finados/invitacion/inauguracion/?c=${token}&variante=registro`);
  assert.equal(badgeUrl(origin, token, 'inauguracion'), `${origin}/finados/invitacion/inauguracion/gafete/?c=${token}`);
  assert.match(invitationMessage('Ana', support, 'inauguracion', 'apoyo'), /Hemos visto tu apoyo/);
  assert.match(invitationMessage('Ana', registration, 'inauguracion', 'registro'), /Te sumaste a Finados 2026/);
  assert.match(invitationMessage('Ana', support, 'inauguracion', 'apoyo'), /Inauguración Oficial/);
  assert.match(badgeMessage('Ana', 'https:\/\/x', 'inauguracion'), /Inauguración Oficial de Finados Mushuc Runa/);
  assert.equal(openInvitationUrl(origin), `${origin}/finados/invitacion/creadores/`, 'Guaynaa conserva su enlace abierto');
});

test('al confirmar, la persona pasa a la pantalla de gracias según su respuesta', async () => {
  assert.equal(THANKS_PATH, '/finados/invitacion/gracias/');
  const html = render('/finados/invitacion/gracias/');
  assert.match(html, /data-invitation="gracias"/);
  assert.match(html, /noindex, nofollow, noarchive/);
  assert.doesNotMatch(html, /1494610251215623|data-cookie-consent/);
  assert.deepEqual([thanksContent({ kind: 'creador', name: 'Ana Pérez', response: 'si' }).title, thanksContent({ kind: 'creador', name: 'Ana Pérez', response: 'si' }).subtitle], ['¡Gracias, Ana!', 'Tu lugar está confirmado.']);
  assert.match(thanksContent({ kind: 'nuevo', name: 'Mía', response: 'si' }).message, /te escribirá por WhatsApp/);
  assert.equal(thanksContent({ kind: 'creador', name: 'Ana', response: 'no' }).perks, false);
  assert.equal(thanksContent().title, '¡Gracias!');
  const js = await readFile(new URL('../src/finados/influencer-invitation.js', import.meta.url), 'utf8');
  // El nombre nunca viaja en la dirección: se pasa dentro de la pestaña.
  assert.doesNotMatch(js, /THANKS_PATH\s*\+|gracias\/\?/);
  assert.equal((js.match(/location\.assign\(THANKS_PATH\)/g) ?? []).length, 2);
});

test('enlace corto, gafete con QR y validación en la puerta', () => {
  assert.equal(invitationToken('?c=k7m2q9xa4b'), 'k7m2q9xa4b');
  assert.equal(invitationToken('?c=k7m2q9xa4l'), '', 'sin letras confusas');
  assert.ok(render('/i/').includes('data-invitation="creador"'));
  assert.doesNotMatch(render('/i/'), /1494610251215623|data-cookie-consent/);
  assert.equal(badgePath('k7m2q9xa4b'), '/finados/invitacion/gafete/?c=k7m2q9xa4b');
  const id = 'c'.repeat(32);
  assert.equal(badgeVerificationUrl(id, 'https://finados.expoferiamushucruna.com'), `https://finados.expoferiamushucruna.com/finados/invitacion/verificar/?id=${id}`);
  assert.equal(badgeVerificationUrl(id, 'https://otro.example'), `https://complejomushucruna.com/finados/invitacion/verificar/?id=${id}`);
  assert.throws(() => badgeVerificationUrl('x'));
  assert.equal(describeVerification({ valid: true, name: 'Ana' }).state, 'Invitación válida ✓');
  assert.equal(describeVerification({ valid: false, response: 'si', approval: 'pendiente' }).state, 'Pendiente de aprobación');
  assert.equal(describeVerification({ valid: false, retired: true }).state, 'Invitación retirada');
  assert.equal(badgeUrl('https://complejomushucruna.com', 'k7m2q9xa4b'), 'https://complejomushucruna.com/finados/invitacion/gafete/?c=k7m2q9xa4b');
  assert.match(badgeMessage('Ana', 'https://x'), /Tu lugar en el Lanzamiento Guaynaa está confirmado/);
  for (const route of ['/finados/invitacion/gafete/', '/finados/invitacion/verificar/']) {
    const html = render(route);
    assert.match(html, /noindex, nofollow, noarchive/);
    assert.match(html, /img-src 'self' blob:/);
  }
});

test('la invitación personal trae la vista de quien ya confirmó con gafete y dress code', () => {
  const html = render('/finados/invitacion/');
  assert.match(html, /data-confirmed hidden/);
  assert.match(html, /data-confirmed-download>Descargar mi gafete/);
  assert.equal((html.match(/<dt>Dress code<\/dt>/g) ?? []).length, 2);
  const thanks = render('/finados/invitacion/gracias/');
  assert.ok(thanks.includes('guaynaa-lanzamiento-hoy-640.webp'));
  assert.ok(thanks.includes('Dress code'));
});

test('la Inauguración Oficial tiene cinco pantallas propias y conserva intactas las de Guaynaa', () => {
  const inauguration = invitationPaths('inauguracion');
  assert.deepEqual(inauguration, {
    personal: '/finados/invitacion/inauguracion/',
    personalShort: '/ii/',
    thanks: '/finados/invitacion/inauguracion/gracias/',
    badge: '/finados/invitacion/inauguracion/gafete/',
    verify: '/finados/invitacion/inauguracion/verificar/',
  });
  assert.deepEqual(invitationPaths('guaynaa'), {
    personal: '/finados/invitacion/',
    personalShort: '/i/',
    open: '/finados/invitacion/creadores/',
    thanks: '/finados/invitacion/gracias/',
    badge: '/finados/invitacion/gafete/',
    verify: '/finados/invitacion/verificar/',
  });
  assert.throws(() => invitationPaths('evento-inventado'));
  assert.equal(pages.some(page => page.route === '/finados/invitacion/inauguracion/creadores/'), false);
  assert.ok(pages.some(page => page.route === '/admin/invitaciones/inauguracion/'), 'la administración tiene una ruta independiente');

  for (const route of Object.values(inauguration)) {
    const html = render(route);
    assert.match(html, /data-invitation-event="inauguracion"/);
    assert.match(html, /noindex, nofollow, noarchive/);
    assert.match(html, /Inauguración Oficial de Finados Mushuc Runa/);
    assert.doesNotMatch(html, /Guaynaa|guaynaa-lanzamiento|1494610251215623|data-cookie-consent/);
  }
  const personal = render('/ii/');
  assert.match(personal, /Viernes 30 de octubre de 2026/);
  assert.match(personal, /12:00 · hora de Ecuador/);
  assert.match(personal, /Panamericana Sur km 12, vía Ambato–Riobamba/);
  assert.doesNotMatch(personal, /km 1\/2/);
  assert.match(personal, /logo-finados\.svg/);
  assert.match(personal, /logo-complejo-mushuc-runa\.svg/);
  assert.match(personal, /class="inv-opening-art__organizer"/);
  assert.match(personal, /Organiza:<\/span><strong>Luis Alfonso Chango P\.<\/strong>/);
  assert.match(personal, /<span class="inv-opening-date__save">SAVE THE<\/span><strong class="inv-opening-date__title">DATE<\/strong>/);
  assert.match(personal, /data-event-weekday>VIE<\/span><b data-event-day>30<\/b>/);
  assert.match(personal, /data-event-month>OCT<\/span>/);
  assert.match(personal, /class="sr-only" data-event-date datetime="2026-10-30">Viernes 30 de octubre de 2026<\/time>/);
  assert.match(personal, /data-answer="si">Sí, ahí estaré/);

  assert.match(render('/i/'), /Lanzamiento Guaynaa/);
  assert.match(render('/finados/invitacion/gafete/'), /Lanzamiento Guaynaa/);
});

test('estado temporal, redirecciones y QR quedan aislados por invitación', () => {
  assert.equal(invitationStorageKey('guaynaa'), 'finados-invitacion-respuesta');
  assert.equal(invitationStorageKey('inauguracion'), 'finados-invitacion-inauguracion-respuesta');
  assert.notEqual(invitationStorageKey('guaynaa'), invitationStorageKey('inauguracion'));
  assert.equal(badgePath('k7m2q9xa4b', 'inauguracion'), '/finados/invitacion/inauguracion/gafete/?c=k7m2q9xa4b');
  const id = 'e'.repeat(32);
  assert.equal(
    badgeVerificationUrl(id, 'https://finados.expoferiamushucruna.com', 'inauguracion'),
    `https://finados.expoferiamushucruna.com/finados/invitacion/inauguracion/verificar/?id=${id}`,
  );
  const content = thanksContent({ kind: 'creador', name: 'Ana', response: 'si' }, 'inauguracion');
  assert.match(content.message, /Inauguración Oficial de Finados Mushuc Runa/);
  assert.doesNotMatch(content.message, /Guaynaa/);
});

test('la pantalla de gracias confirma al vocero de inauguración que ya tiene gafete', () => {
  const content = thanksContent({
    kind: 'vocero',
    name: 'Adonnis Pabón',
    response: 'si',
    badge: true,
  }, 'inauguracion');

  assert.equal(content.eyebrow, 'Asistencia confirmada');
  assert.equal(content.subtitle, 'Tu lugar está confirmado.');
  assert.match(content.message, /Nos honra contar contigo/);
  assert.doesNotMatch(content.message, /revisará tu registro|confirmar tu lugar/);
});

test('la narrativa de Inauguración distingue apoyo y primera participación sin confiar en la URL real', async () => {
  const support = inaugurationNarrative('apoyo');
  const registration = inaugurationNarrative('registro');
  assert.match(support.title, /^Hemos visto tu apoyo a Finados 2026/);
  assert.match(registration.title, /^Te sumaste a Finados 2026/);
  assert.match(registration.lead, /primera vez/i);
  assert.notDeepEqual(support, registration);
  assert.equal(resolveInvitationVariant({ eventKey: 'inauguracion', search: '?variante=apoyo', apiVariant: 'registro' }), 'registro', 'la API manda en enlaces reales');
  assert.equal(resolveInvitationVariant({ eventKey: 'inauguracion', search: '?vista=1&variante=apoyo', apiVariant: 'registro', preview: true }), 'apoyo', 'la URL solo manda en vista previa');
  assert.equal(resolveInvitationVariant({ eventKey: 'inauguracion', search: '?vista=1&variante=inventada', preview: true }), 'apoyo');

  const html = render('/finados/invitacion/inauguracion/');
  for (const marker of ['data-opening-eyebrow', 'data-opening-title', 'data-opening-lead', 'data-opening-story']) assert.match(html, new RegExp(marker));
  const source = await readFile(new URL('../src/finados/influencer-invitation.js', import.meta.url), 'utf8');
  assert.match(source, /data\.guest\.message_variant/);
});

test('el rol ceremonial distingue voceros y creadores en pantalla y gafete', () => {
  assert.equal(invitationRoleLabel('vocero', 'inauguracion'), 'VOCERO/A FINADOS 2026');
  assert.equal(invitationRoleLabel('creador', 'inauguracion'), 'CREADOR/A DE CONTENIDO');
  assert.equal(invitationRoleLabel('creador', 'guaynaa'), 'INVITADO ESPECIAL');
  assert.equal(invitationRoleLabel('nuevo', 'guaynaa'), 'CREADOR INVITADO');
});

test('el cliente de inauguración usa únicamente su namespace de API', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push([url, options.method]);
    return { ok: true, json: async () => ({}) };
  };
  const token = 'k7m2q9xa4b';
  const id = 'f'.repeat(32);
  const client = createInvitationClient('http://127.0.0.1:4174/api', fakeFetch, 'inauguracion');
  await client.event();
  await client.open(token);
  await client.respond(token, 'si');
  await client.register({ full_name: 'Ana' });
  await client.badge(token);
  await client.verify(id);
  assert.deepEqual(calls, [
    ['http://127.0.0.1:4174/api/invitacion/inauguracion/evento', 'GET'],
    [`http://127.0.0.1:4174/api/invitacion/inauguracion/c/${token}`, 'GET'],
    [`http://127.0.0.1:4174/api/invitacion/inauguracion/c/${token}`, 'POST'],
    ['http://127.0.0.1:4174/api/invitacion/inauguracion/nuevo', 'POST'],
    [`http://127.0.0.1:4174/api/invitacion/inauguracion/gafete/${token}`, 'GET'],
    [`http://127.0.0.1:4174/api/invitacion/inauguracion/verificar/${id}`, 'GET'],
  ]);
});
