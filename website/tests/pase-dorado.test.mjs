import test from 'node:test';
import assert from 'node:assert/strict';
import { pages } from '../src/pages.mjs';
import { isCedula, maskCedula, matchesPass, normalizeCedula, parseLines, qrFileName, verificationUrl } from '../src/admin/admin-pase-dorado.js';
import { describePaseDorado, paseDoradoApiUrl } from '../src/finados/pase-dorado-verification.js';

const render = route => { const page = pages.find(item => item.route === route); assert.ok(page, route); return page.render(page); };
const id = 'a'.repeat(32);

test('Pase dorado aparece en el menú con verificación, alta y lista', () => {
  const html = render('/admin/pase-dorado/');
  assert.ok(html.includes('href="/admin/pase-dorado/" aria-current="page" data-module="pasedorado"'));
  assert.match(html, /data-check-form/);
  assert.match(html, /data-add-form/);
  assert.match(html, /data-print-all/);
  assert.match(html, /admin-pase-dorado\.js\?v=/);
});

test('la página del QR es privada: noindex, sin Pixel y con su propio script', () => {
  const html = render('/finados/pase-dorado/verificar/');
  assert.match(html, /noindex, nofollow, noarchive/);
  assert.match(html, /data-pase-dorado-verification/);
  assert.match(html, /pase-dorado-verification\.js\?v=/);
  assert.doesNotMatch(html, /1494610251215623/);
});

test('lee cada línea con un nombre y una cédula, en cualquier orden', () => {
  const { entries, invalid } = parseLines('Ana Pérez 1801234567\n\n1709876543, Luis Toapanta\nSin cédula\nDos 1801234567 1709876543\nCorta 180123456');
  assert.deepEqual(entries, [{ name: 'Ana Pérez', cedula: '1801234567' }, { name: 'Luis Toapanta', cedula: '1709876543' }]);
  assert.deepEqual(invalid, [4, 5, 6]);
  assert.equal(normalizeCedula('180-123 4567'), '1801234567');
  assert.ok(isCedula('180-123-4567'));
  assert.ok(!isCedula('18012345'));
  assert.equal(maskCedula('1801234567'), '180•••••67');
});

test('el QR lleva a la validación y no contiene la cédula', () => {
  const url = verificationUrl('https://complejomushucruna.com', id);
  assert.equal(url, `https://complejomushucruna.com/finados/pase-dorado/verificar/?id=${id}`);
  assert.throws(() => verificationUrl('https://complejomushucruna.com', '1801234567'));
  assert.equal(paseDoradoApiUrl('https://finados.complejomushucruna.com/api', id), `https://finados.complejomushucruna.com/api/pase-dorado/verify/${id}`);
  assert.throws(() => paseDoradoApiUrl('https://otro.example/api', id), /Origen/);
  assert.equal(qrFileName('Ana María Pérez'), 'pase-dorado-ana-maria-perez.png');
});

test('en la puerta solo se lee válido o no permitido', () => {
  assert.equal(describePaseDorado({ valid: true, name: 'Ana', cedula_masked: '180•••••67' }).state, 'VÁLIDO');
  assert.equal(describePaseDorado({ valid: false, name: 'Ana', cedula_masked: '180•••••67' }).state, 'NO PERMITIDO');
  assert.equal(describePaseDorado(null).state, 'NO PERMITIDO');
  const pass = { full_name: 'Ana Pérez', cedula: '1801234567', status: 'valido' };
  assert.ok(matchesPass(pass, { search: 'ana' }));
  assert.ok(matchesPass(pass, { search: '1801' }));
  assert.ok(!matchesPass(pass, { status: 'anulado' }));
});
