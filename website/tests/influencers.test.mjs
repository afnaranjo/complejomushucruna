import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pages } from '../src/pages.mjs';
import { eventDateLabel, eventTimeLabel, invitationToken, responseMessage, validateOpenForm } from '../src/finados/influencer-invitation.js';
import { invitationMessage, matchesFilter, openInvitationUrl, personalInvitationUrl, whatsappLink, whatsappNumber } from '../src/admin/admin-influencers.js';

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
    assert.ok(html.includes('guaynaa-lanzamiento-oficial-1122.webp'), route);
    assert.ok(html.includes('18:00 · hora de Ecuador'), route);
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
  assert.equal(url, `https://finados.expoferiamushucruna.com/finados/invitacion/?c=${token}`);
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
