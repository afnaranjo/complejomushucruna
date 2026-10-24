import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pages } from '../src/pages.mjs';
import { combineInvitationTotals, combineTotals, createInvitacionesClient, dateLabel, ecuadorToday, INVITATIONS, invitationState } from '../src/admin/admin-invitaciones.js';
import { adminInvitationContext, createInfluencersClient } from '../src/admin/admin-influencers.js';
import { isPreview } from '../src/finados/influencer-invitation.js';

const render = route => { const page = pages.find(item => item.route === route); return page.render(page); };

test('Invitaciones aparece en el menú y permite la vista previa solo en su página', () => {
  const html = render('/admin/invitaciones/');
  assert.match(html, /href="\/admin\/invitaciones\/"[^>]*aria-current="page"/);
  assert.match(html, /frame-src 'self'/);
  assert.match(html, /data-admin-invitaciones/);
  assert.doesNotMatch(render('/admin/pase-dorado/'), /frame-src/);
});

test('cada pantalla de la invitación se abre en modo vista previa del propio sitio', () => {
  for (const invitation of INVITATIONS) for (const screen of invitation.screens) {
    const preview = new URL(screen.path, 'https://complejomushucruna.com');
    assert.equal(preview.searchParams.get('vista'), '1');
    if (invitation.id === 'guaynaa') assert.ok(pages.some(page => page.route === preview.pathname), screen.path);
  }
  assert.equal(isPreview('?vista=1'), true);
  assert.equal(isPreview('?c=abcdefghjk'), false);
});

test('Inauguración es una invitación separada para Voceros y Creadores', () => {
  const invitation = INVITATIONS.find(item => item.id === 'inauguracion');
  assert.ok(invitation);
  assert.equal(invitation.event, 'inauguracion');
  assert.deepEqual(invitation.audiences, ['Voceros', 'Creadores']);
  assert.equal(invitation.manage, '/admin/invitaciones/inauguracion/');
  assert.deepEqual(invitation.sources, [
    { kind: 'vocero', event: 'inauguracion' },
    { kind: 'creador', event: 'inauguracion' },
  ]);
  assert.deepEqual(invitation.screens.map(screen => screen.key), ['personal-apoyo', 'personal-registro', 'gracias', 'gafete', 'verificar']);
  assert.match(invitation.screens[0].path, /^\/finados\/invitacion\/inauguracion\/\?vista=1&variante=apoyo$/);
  assert.match(invitation.screens[1].path, /^\/finados\/invitacion\/inauguracion\/\?vista=1&variante=registro$/);
  for (const screen of invitation.screens.slice(2)) assert.match(screen.path, /^\/finados\/invitacion\/inauguracion\/(?:gracias|gafete|verificar)\/\?vista=1$/);
});

test('la ruta administrativa de Inauguración permite gestionar invitados y revisar todas sus pantallas', () => {
  const html = render('/admin/invitaciones/inauguracion/');
  assert.match(html, /frame-src 'self'/);
  assert.match(html, /data-admin-influencers/);
  assert.match(html, /data-event="inauguracion"/);
  assert.match(html, /data-kind="vocero"/);
  assert.match(html, /Invitación de la Inauguración Oficial/);
  assert.match(html, /href="\/admin\/invitaciones\/"/);
  assert.match(html, /data-invitation-kind/);
  assert.match(html, /<option value="vocero">Voceros<\/option>/);
  assert.match(html, /<option value="creador">Creadores<\/option>/);
  assert.match(html, /data-invitation-variant/);
  assert.match(html, /<option value="apoyo">Ya apoyó a Finados<\/option>/);
  assert.match(html, /<option value="registro">Se registró, sin video<\/option>/);
  assert.match(html, /data-add-form/);
  assert.match(html, /data-event-form/);
  assert.match(html, /data-rows/);
  for (const path of INVITATIONS.find(item => item.id === 'inauguracion').screens.map(screen => screen.path)) {
    assert.ok(html.includes(path.replaceAll('&', '&amp;')), path);
  }
});

test('el contexto administrativo aísla Inauguración y deja Guaynaa como flujo predeterminado', () => {
  assert.deepEqual(adminInvitationContext({ event: 'inauguracion', kind: 'vocero', variant: 'apoyo' }), {
    event: 'inauguracion', eventQuery: 'inauguracion', kind: 'vocero', variant: 'apoyo', personal: true,
  });
  assert.deepEqual(adminInvitationContext({ event: 'inauguracion', kind: 'creador', variant: 'registro' }), {
    event: 'inauguracion', eventQuery: 'inauguracion', kind: 'creador', variant: 'registro', personal: true,
  });
  assert.deepEqual(adminInvitationContext({ kind: 'creador' }), {
    event: 'guaynaa', eventQuery: '', kind: 'creador', variant: 'apoyo', personal: true,
  });
  assert.throws(() => adminInvitationContext({ event: 'inauguracion', kind: 'nuevo', variant: 'apoyo' }));
  assert.throws(() => adminInvitationContext({ event: 'inauguracion', kind: 'vocero', variant: 'otra' }));
});

test('el cliente gestiona Inauguración con event=inauguracion sin alterar las rutas de Guaynaa', async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, method: options.method, body: options.body });
    return {
      ok: true,
      json: async () => ({ csrf: 'csrf-prueba', guests: [], event: {} }),
      blob: async () => new Blob(['csv']),
    };
  };
  const client = createInfluencersClient(undefined, fakeFetch);
  await client.session();
  await client.list('vocero', 'inauguracion');
  await client.create('Ana\nLuis', { event: 'inauguracion', kind: 'vocero', variant: 'apoyo' });
  await client.saveEvent({ title: 'Inauguración', date: '2026-10-30', time: '12:00', place: 'Mushuc Runa', details: '' }, 'inauguracion');
  await client.exportCsv('creador', 'inauguracion');
  await client.list('creador');
  await client.create('Mía');
  await client.saveEvent({ title: 'Lanzamiento Guaynaa', date: '2026-10-15', time: '18:00', place: 'Ambato', details: '' });
  await client.exportCsv('nuevo');
  assert.deepEqual(calls.map(call => [call.url.replace(/^https?:\/\/[^/]+\/api/, ''), call.method]), [
    ['/auth/session', 'GET'],
    ['/influencers?kind=vocero&event=inauguracion', 'GET'],
    ['/influencers?event=inauguracion', 'POST'],
    ['/influencers/evento?event=inauguracion', 'PATCH'],
    ['/influencers/export?kind=creador&event=inauguracion', 'GET'],
    ['/influencers?kind=creador', 'GET'],
    ['/influencers', 'POST'],
    ['/influencers/evento', 'PATCH'],
    ['/influencers/export?kind=nuevo', 'GET'],
  ]);
  assert.deepEqual(JSON.parse(calls[2].body), { names: 'Ana\nLuis', kind: 'vocero', message_variant: 'apoyo' });
  assert.deepEqual(JSON.parse(calls[3].body), { title: 'Inauguración', date: '2026-10-30', time: '12:00', place: 'Mushuc Runa', details: '' });
  assert.deepEqual(JSON.parse(calls[6].body), { names: 'Mía' });
  assert.deepEqual(JSON.parse(calls[7].body), { title: 'Lanzamiento Guaynaa', date: '2026-10-15', time: '18:00', place: 'Ambato', details: '' });
});

test('estado, fecha y totales de la invitación', () => {
  assert.equal(ecuadorToday(new Date('2026-10-21T03:00:00Z')), '2026-10-20');
  assert.equal(invitationState('2026-10-15', '2026-10-20').label, 'Ya pasó');
  assert.equal(invitationState('2026-10-20', '2026-10-20').key, 'hoy');
  assert.equal(invitationState('2026-11-01', '2026-10-20').key, 'proxima');
  assert.equal(dateLabel('2026-10-15', '18:00'), '15 de octubre de 2026 · 18:00');
  assert.deepEqual(combineTotals({ totals: { total: 10, si: 6, no: 1, pendiente: 3, abrieron: 8 } }, { totals: { total: 4, si: 3, no: 0, pendiente: 1, por_aprobar: 2 } }),
    { invitados: 14, si: 9, no: 1, pendiente: 4, abrieron: 8, porAprobar: 2 });
  assert.deepEqual(combineInvitationTotals(
    { totals: { total: 8, si: 5, no: 1, pendiente: 2, abrieron: 7 } },
    { totals: { total: 3, si: 2, no: 0, pendiente: 1, abrieron: 3 } },
  ), { invitados: 11, si: 7, no: 1, pendiente: 3, abrieron: 10, porAprobar: 0 });
});

test('el cliente solo lee la sesión y las listas, separando los conteos por evento', async () => {
  const requested = [];
  const client = createInvitacionesClient(undefined, async url => {
    requested.push(url);
    return { ok: true, json: async () => ({ authenticated: true }) };
  });
  assert.deepEqual(await client.session(), { authenticated: true });
  await client.list('creador');
  await client.list('vocero', 'inauguracion');
  assert.ok(requested.some(url => url.endsWith('/influencers?kind=creador')));
  assert.ok(requested.some(url => url.endsWith('/influencers?kind=vocero&event=inauguracion')));
  await assert.rejects(() => client.list('vocero', 'guaynaa'), /Ruta de API no permitida/);
  const source = await readFile(new URL('../src/admin/admin-invitaciones.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /method: '(?:POST|PATCH|DELETE)'/);
});

test('la invitación de inauguración ofrece tren, break y entradas Arena, con condiciones y aceptación visibles', () => {
  const page = pages.find(item => item.route === '/finados/invitacion/inauguracion/');
  const html = page.render(page);
  assert.match(html, /tren-complejo-752\.webp/);
  assert.match(html, /entradas Arena/);
  assert.match(html, /Break para compartir/);
  assert.match(html, /Al confirmar «Sí, ahí estaré» aceptas las <a href="\/finados\/invitacion\/inauguracion\/condiciones\/"/);
  assert.match(html, /sujetos a cambios y a disponibilidad\. Aplican restricciones\./);
  const terms = pages.find(item => item.route === '/finados/invitacion/inauguracion/condiciones/');
  const termsHtml = terms.render(terms);
  assert.match(termsHtml, /Uso de imagen/);
  assert.match(termsHtml, /noindex/);
  assert.match(termsHtml, /data-invitation="condiciones"/);
});

test('la inauguración muestra el plazo para confirmar con un contador que cierra a la hora exacta', async () => {
  const { deadlineParts } = await import('../src/finados/influencer-invitation.js');
  const page = pages.find(item => item.route === '/finados/invitacion/inauguracion/');
  const html = page.render(page);
  assert.match(html, /data-deadline-at="2026-10-26T09:00:00-05:00"/);
  assert.match(html, /Lunes 26 de octubre · 9:00/);
  assert.match(html, /Tienes hasta el <strong>lunes 26 de octubre a las 9:00<\/strong> para confirmar/);
  const deadline = '2026-10-26T09:00:00-05:00';
  assert.deepEqual(deadlineParts(deadline, Date.parse('2026-10-24T09:00:00-05:00')), { closed: false, days: 2, hours: 0, minutes: 0, seconds: 0 });
  assert.deepEqual(deadlineParts(deadline, Date.parse('2026-10-26T08:59:59-05:00')), { closed: false, days: 0, hours: 0, minutes: 0, seconds: 1 });
  assert.equal(deadlineParts(deadline, Date.parse('2026-10-26T09:00:00-05:00')).closed, true);
});

test('la invitación de inauguración no muestra el rol debajo del nombre', () => {
  const page = pages.find(item => item.route === '/finados/invitacion/inauguracion/');
  assert.doesNotMatch(page.render(page), /data-guest-role|VOCERO\/A · CREADOR\/A/);
});

test('solo la versión «registro» (voceros sin video) invita a subir el video', async () => {
  const { inaugurationNarrative } = await import('../src/finados/influencer-invitation.js');
  const page = pages.find(item => item.route === '/finados/invitacion/inauguracion/');
  const html = page.render(page);
  assert.match(html, /<section class="inv-video" data-opening-video hidden/);
  assert.match(html, /href="\/finados\/voceros\/mi-registro\/"[^>]*>Subir mi video</);
  assert.doesNotMatch(inaugurationNarrative('registro').lead, /primera vez en la feria/);
  const source = await readFile(new URL('../src/finados/influencer-invitation.js', import.meta.url), 'utf8');
  assert.match(source, /node\.hidden = variant !== 'registro'/);
});

test('el enlace único de voceros muestra la invitación y pide iniciar sesión para confirmar', async () => {
  const { createVoceroGateClient } = await import('../src/finados/influencer-invitation.js');
  const page = pages.find(item => item.route === '/inauguracion/');
  const html = page.render(page);
  assert.match(html, /data-invitation="vocero-acceso"/);
  assert.match(html, /data-gate-form/);
  assert.match(html, /autocomplete="current-password"/);
  assert.match(html, /data-deadline-at="2026-10-26T09:00:00-05:00"/);
  assert.match(html, /noindex/);
  const calls = [];
  const client = createVoceroGateClient(undefined, async (url, options) => { calls.push([url, options.method]); return { ok: true, json: async () => ({ csrf: 'x', token: 'abcdefghjk' }) }; });
  await client.session(); await client.invitation();
  assert.deepEqual(calls.map(([url, method]) => [url.replace(/^https:\/\/[^/]+\/api/, ''), method]), [['/vocero/auth/session', 'GET'], ['/vocero/inauguracion', 'GET']]);
});
