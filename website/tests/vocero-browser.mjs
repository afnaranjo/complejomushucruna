// Synthetic browser checks; all API traffic is intercepted. Uses an existing Playwright installation.
// VOCERO_PLAYWRIGHT_MODULE=/absolute/path/playwright/index.mjs node tests/vocero-browser.mjs
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.VOCERO_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.VOCERO_PLAYWRIGHT_MODULE).href : 'playwright');
const root = resolve('dist');
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + new URL(req.url, 'http://fixture').pathname.replace(/\/$/, '/index.html'));
  if (!path.startsWith(root + '/')) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(path);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[extname(path)] ?? 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.VOCERO_CHROMIUM_EXECUTABLE ? { executablePath: process.env.VOCERO_CHROMIUM_EXECUTABLE } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(7000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
let authenticated = false; let saved = false; let rejectSave = true;
let resetAccepted = false;
const calls = [];
const record = { registered: true, submission_id: 'b'.repeat(32), full_name: 'Persona Prueba', cedula: '0102030400', birth_date: '2000-01-01', whatsapp: '0999999999', email: 'person@example.invalid', city: 'Ambato', main_network: 'TikTok', tiktok: 'https://www.tiktok.com/@prueba', instagram: '', facebook: '', previous_participation: 'No, es mi primera vez', community_source: 'Otro', kit_pickup: 'En la oficina', status: 'Nuevo', photo: { available: true } };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl1sAAAAASUVORK5CYII=', 'base64');
await page.addInitScript(() => {
  globalThis.__revoked = [];
  const original = URL.revokeObjectURL;
  URL.revokeObjectURL = value => { globalThis.__revoked.push(value); original.call(URL, value); };
});
await page.route('https://finados.complejomushucruna.com/api/**', async route => {
  const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
  const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
  calls.push({ path, method, body: request.postData() });
  const respond = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
  if (path.endsWith('/session')) return respond({ authenticated, user: authenticated ? { role: 'vocero', email: record.email } : null, csrf: 'fixture-csrf' });
  if (path.endsWith('/register')) return respond({ ok: true }, 202);
  if (path.endsWith('/login')) { authenticated = true; return respond({ authenticated, user: { role: 'vocero', email: record.email }, csrf: 'rotated-csrf' }); }
  if (path.endsWith('/logout')) { authenticated = false; return respond({ ok: true }); }
  if (path.endsWith('/reset')) return resetAccepted ? respond({ ok: true, csrf: 'reset-csrf' }) : respond({}, 404);
  if (path.endsWith('/photo')) return route.fulfill({ headers, contentType: 'image/png', body: png });
  if (path.endsWith('/profile') && method === 'POST') {
    if (rejectSave) return respond({}, 422);
    saved = true;
    record.submission_id = request.postData().match(/name="submission_id"\r\n\r\n([a-f0-9]{32})/)[1];
    return respond(record);
  }
  return respond(saved ? record : { registered: false, email: record.email, status: null, photo: { available: false } });
});
await mkdir('output/playwright', { recursive: true });
try {
  await page.goto(origin + '/finados/voceros/acceso/');
  await page.locator('[data-vocero-register] input[name=email]').fill(record.email);
  await page.locator('#register-password').fill('frase larga de prueba');
  await page.locator('#register-confirmation').fill('frase larga de prueba');
  await page.locator('[name=privacyAcknowledged]').check();
  await page.getByRole('button', { name: 'Crear cuenta', exact: true }).last().click();
  await page.locator('[data-vocero-register]').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('#login-email').inputValue(), record.email);
  assert.equal(calls.filter(call => call.path.endsWith('/login')).length, 0);
  assert.match(await page.locator('[data-vocero-feedback]').textContent(), /inicia sesión/);
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-vocero-feedback')), true);
  await page.screenshot({ path: 'output/playwright/vocero-login-desktop.png', fullPage: true, animations: 'disabled' });
  await page.locator('#login-password').fill('frase larga de prueba');
  await page.locator('[data-vocero-login] button[type=submit]').click();
  await page.waitForURL('**/mi-registro/');
  await page.locator('[data-profile-fields]:not([disabled])').waitFor();
  assert.equal(await page.locator('#fotografia').getAttribute('required'), '');
  for (const [name, value] of Object.entries({ nombre_completo: record.full_name, cedula: record.cedula, fecha_nacimiento: record.birth_date, whatsapp: record.whatsapp, ciudad: record.city, tiktok: record.tiktok })) await page.locator(`[name="${name}"]`).fill(value);
  const birthYear = Number(await page.evaluate(() => new Intl.DateTimeFormat('en', { timeZone: 'America/Guayaquil', year: 'numeric' }).format(new Date()))) - 16;
  await page.locator('[name=fecha_nacimiento]').fill(`${birthYear}-01-01`);
  const representative = page.locator('[data-vocero-minor]');
  await representative.waitFor({ state: 'visible' });
  assert.doesNotMatch(await representative.textContent(), /Opcional/);
  assert.equal(await representative.locator('input').count(), 4);
  for (const input of await representative.locator('input').all()) {
    assert.equal(await input.evaluate(element => element.required && element.validity.valueMissing && !element.disabled), true);
    assert.match(await input.evaluate(element => element.labels[0].textContent), /\*/);
  }
  await page.locator('[name=fecha_nacimiento]').fill(record.birth_date);
  await representative.waitFor({ state: 'hidden' });
  for (const input of await representative.locator('input').all()) assert.equal(await input.evaluate(element => !element.required && element.disabled), true);
  for (const [name, value] of Object.entries({ red_principal: record.main_network, vocero_previo: record.previous_participation, fuente_comunidad: record.community_source, retiro_kit: record.kit_pickup })) await page.locator(`[name="${name}"]`).selectOption(value);
  for (const name of ['consentimiento_politicas', 'autorizacion_imagen', 'consentimiento_datos']) await page.locator(`[name="${name}"]`).check();
  await page.locator('#fotografia').setInputFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: png });
  await page.locator('#fotografia').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png });
  assert.equal(await page.evaluate(() => __revoked.length), 1);
  await page.locator('#fotografia').setInputFiles({ name: 'invalid.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await page.locator('[data-vocero-feedback][data-error=true]').waitFor();
  assert.equal(await page.evaluate(() => __revoked.length), 2);
  assert.equal(await page.locator('[data-photo-preview]').isVisible(), false);
  assert.equal(await page.locator('[name=nombre_completo]').inputValue(), record.full_name);
  await page.locator('#fotografia').setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).last().click();
  await page.locator('[data-vocero-feedback][data-error=true]').waitFor();
  assert.equal(await page.locator('[name=nombre_completo]').inputValue(), record.full_name);
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute('data-vocero-feedback')), true);
  assert.equal(await page.locator('#fotografia').evaluate(input => input.files.length), 1);
  rejectSave = false;
  await page.getByRole('button', { name: 'Guardar registro', exact: true }).last().click();
  await page.waitForFunction(() => document.querySelector('[data-vocero-feedback]').textContent.startsWith('Registro guardado.'));
  assert.equal(await page.locator('#fotografia').getAttribute('required'), null);
  const submissions = calls.filter(call => call.path.endsWith('/profile') && call.method === 'POST');
  assert.equal(submissions.length, 2);
  const idOf = body => body.match(/name="submission_id"\r\n\r\n([a-f0-9]{32})/)[1];
  assert.equal(idOf(submissions[0].body), idOf(submissions[1].body));
  for (const call of submissions) assert.doesNotMatch(call.body, /name="(?:correo|email|accountId|role|estado|status|website)"/);
  await page.reload();
  await page.locator('[data-profile-fields]:not([disabled])').waitFor();
  await page.locator('[data-photo-preview]:not([hidden])').waitFor();
  assert.equal(await page.locator('[name=nombre_completo]').inputValue(), record.full_name);
  assert.equal(await page.locator('#account-email').getAttribute('readonly'), '');
  assert.equal(await page.locator('#fotografia').getAttribute('required'), null);
  await page.screenshot({ path: 'output/playwright/vocero-profile-desktop.png', fullPage: true, animations: 'disabled' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
  await page.screenshot({ path: 'output/playwright/vocero-profile-mobile.png', fullPage: true, animations: 'disabled' });
  record.status = 'En revisión';
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-profile-status]').textContent.includes('En revisión'));
  assert.equal(await page.locator('[data-profile-fields]').getAttribute('disabled'), '');
  assert.equal(await page.getByRole('button', { name: 'Guardar registro' }).count(), 0);
  await page.locator('[data-photo-preview]:not([hidden])').waitFor();
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent('pagehide')));
  assert.equal(await page.evaluate(() => __revoked.length), 1);
  assert.equal(await page.locator('[data-photo-preview]').getAttribute('src'), null);
  await page.goto(origin + '/finados/voceros/restablecer/?token=' + 'd'.repeat(64));
  await page.locator('fieldset:not([disabled])').waitFor();
  assert.equal(new URL(page.url()).search, '');
  await page.locator('#reset-password').fill('nueva frase de prueba');
  await page.locator('#reset-confirmation').fill('nueva frase de prueba');
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await page.locator('[data-vocero-feedback][data-error=true]').waitFor();
  assert.match(await page.locator('[data-vocero-feedback]').textContent(), /no está disponible/);
  await page.screenshot({ path: 'output/playwright/vocero-reset-mobile.png', fullPage: true, animations: 'disabled' });
  resetAccepted = true;
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
  await page.getByText('Contraseña actualizada. Inicia sesión con tu nueva contraseña.').waitFor();
  assert.equal(await page.locator('[data-vocero-reset]').isHidden(), true);
  assert.equal(await page.locator('#reset-password').inputValue(), '');
  assert.equal(new URL(page.url()).search, '');
  assert.equal(JSON.parse(calls.findLast(call => call.path.endsWith('/reset')).body).token, 'd'.repeat(64));
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.deepEqual(errors, []);
  console.log('PASS navegador: registro 202 → login, perfil nuevo, reintento 422, edición, solo lectura, reset 404, foco, preview y móvil.');
} catch (error) {
  console.error({ errors, feedback: await page.locator('[data-vocero-feedback]').textContent(), calls: calls.map(call => `${call.method} ${call.path}`) });
  throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
