// Run with ADMIN_PLAYWRIGHT_MODULE pointing to an existing Playwright installation.
// Browser fixtures are synthetic; every API request is intercepted locally.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.ADMIN_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.ADMIN_PLAYWRIGHT_MODULE).href : 'playwright');
const root = resolve('dist');
const server = createServer(async (req, res) => {
  const path = resolve(root, '.' + new URL(req.url, 'http://test').pathname.replace(/\/$/, '/index.html'));
  if (!path.startsWith(root + '/')) { res.writeHead(404).end(); return; }
  try {
    const body = await readFile(path);
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' })[extname(path)] ?? 'application/octet-stream');
    res.end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.ADMIN_CHROMIUM_EXECUTABLE ? { executablePath: process.env.ADMIN_CHROMIUM_EXECUTABLE } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(7000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
let authenticated = false;
let rejectLogin = true;
let status = 'Nuevo';
let notes = [];
let failure = 0;
let pendingPatch = null;
let failDetailAfterPatch = false;
let detailFailure = false;
const calls = [];
const record = { public_id: '00000000-0000-4000-8000-000000000001', submission_id: 'fixture-1', full_name: '<img src=x onerror=alert(1)> Prueba', status, city: 'Quito', main_network: 'TikTok', previous_participation: 'No, es mi primera vez', cedula: '******1234', whatsapp: '******5678', submitted_at: '2026-09-14 16:00:00' };
await page.route('https://finados.complejomushucruna.com/api/**', async route => {
  const request = route.request(); const url = new URL(request.url()); const method = request.method();
  const body = request.postDataJSON(); calls.push({ path: url.pathname, query: url.searchParams, method, body, headers: request.headers() });
  const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type, X-CSRF-Token', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS' };
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
  const respond = (data, code = 200) => route.fulfill({ status: code, headers, contentType: 'application/json', body: JSON.stringify(data) });
  if (url.pathname.endsWith('/session')) return respond({ authenticated, user: authenticated ? { username: 'operador-prueba' } : null, csrf: 'test-csrf' });
  if (url.pathname.endsWith('/login')) {
    if (rejectLogin) return respond({ message: 'bad' }, 401);
    authenticated = true; return respond({ authenticated, user: { username: 'operador-prueba' }, csrf: 'test-csrf' });
  }
  if (failure === -1) { failure = 0; return route.abort('failed'); }
  if (failure) { const code = failure; failure = 0; return respond({ message: 'fallo controlado' }, code); }
  if (url.pathname.endsWith('/logout')) { authenticated = false; return respond({ ok: true }); }
  if (url.pathname.endsWith('/dashboard')) return respond({ total: 26, byStatus: { Nuevo: status === 'Aprobado' ? 24 : 25, Aprobado: status === 'Aprobado' ? 2 : 1 }, byDate: { '2026-09-14': 26 }, lastSevenDays: 26 });
  if (url.pathname.endsWith('/export')) return route.fulfill({ headers, contentType: 'text/csv', body: 'nombre\nPrueba' });
  if (url.pathname.endsWith('/notes')) { notes.push({ body: body.body, created_at: '2026-09-14 16:30:00', author_id: 1 }); return respond({ ok: true }, 201); }
  if (method === 'PATCH') {
    if (pendingPatch) await pendingPatch;
    status = body.status;
    detailFailure = failDetailAfterPatch;
    return respond({ ok: true });
  }
  if (url.pathname === '/api/voceros') {
    const empty = url.searchParams.get('search') === 'vacío' || (url.searchParams.has('status') && url.searchParams.get('status') !== status);
    return respond({ items: empty ? [] : [{ ...record, status }], pagination: { page: Number(url.searchParams.get('page') ?? 1), pageSize: 25, total: empty ? 0 : 26, pages: empty ? 0 : 2 } });
  }
  if (detailFailure) { detailFailure = false; return respond({ message: 'Fallo de detalle posterior al guardado' }, 500); }
  return respond({ ...record, status, cedula: '0000001234', whatsapp: '0000005678', email: 'fixture@example.test', notes, consents: [{ consent_type: 'privacy', accepted: 1, text_version: 'v1', accepted_at: '2026-09-14 16:00:00' }] });
});
await mkdir('output/playwright', { recursive: true });
async function mutationRegressions() {
  const failures = [];
  for (const scenario of ['close-during-patch', 'detail-fails-after-patch']) {
    authenticated = true; status = 'Nuevo'; pendingPatch = null; detailFailure = false; failDetailAfterPatch = false;
    await page.goto(origin + '/admin/voceros/');
    await page.getByRole('button', { name: /Ver detalle de/ }).waitFor();
    await page.locator('[data-admin-filters] select[name="status"]').selectOption('Nuevo');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await page.waitForFunction(() => document.querySelector('[data-records-region]').getAttribute('aria-busy') === 'false');
    await page.getByRole('button', { name: /Ver detalle de/ }).click();
    await page.getByText('0000001234', { exact: true }).waitFor();
    await page.getByLabel('Estado del registro').selectOption('Aprobado');
    let releasePatch;
    if (scenario === 'close-during-patch') pendingPatch = new Promise(resolve => { releasePatch = resolve; });
    else failDetailAfterPatch = true;
    const patchRequest = page.waitForRequest(request => request.method() === 'PATCH');
    await page.getByRole('button', { name: 'Guardar estado' }).click();
    await patchRequest;
    if (releasePatch) { await page.getByRole('button', { name: 'Cerrar detalle' }).click(); releasePatch(); }
    try {
      await page.waitForFunction(() => {
        const metrics = [...document.querySelectorAll('[data-admin-dashboard] dl')].map(dl => [dl.querySelector('dt').textContent, dl.querySelector('dd').textContent]);
        return document.querySelector('[data-record-count]').textContent === '0 resultados'
          && document.querySelectorAll('[data-records] tr').length === 0
          && metrics.some(([label, value]) => label === 'Nuevos' && value === '24')
          && metrics.some(([label, value]) => label === 'Aprobados' && value === '2');
      }, undefined, { timeout: 2500 });
      if (scenario === 'close-during-patch') {
        assert.equal(await page.locator('dialog').evaluate(dialog => dialog.open), false);
        assert.equal(await page.locator('[data-detail-content]').textContent(), '');
      } else {
        await page.getByText('El cambio se guardó, pero no se pudo actualizar el detalle. Cierra y vuelve a abrir el registro.').waitFor();
      }
      console.log(`Mutation regression ${scenario}: PASS`);
    } catch (error) { failures.push(`${scenario}: ${error.message}`); console.error(`Mutation regression ${scenario}: FAIL (list/summary not reconciled)`); }
  }
  assert.deepEqual(failures, []);
}
try {
  if (process.argv.includes('--mutation-regressions')) await mutationRegressions();
  else {
  await page.goto(origin + '/admin/voceros/');
  await page.waitForURL('**/admin/');
  await page.getByLabel('Usuario', { exact: true }).fill('operador-prueba');
  await page.getByLabel('Contraseña', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Mostrar', exact: true }).click();
  assert.equal(await page.locator('#password').getAttribute('type'), 'text');
  await page.getByRole('button', { name: 'Ocultar', exact: true }).click();
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await page.getByText('Usuario o contraseña incorrectos.').waitFor();
  assert.equal(await page.locator('#password').inputValue(), '');
  await page.screenshot({ path: 'output/playwright/admin-login.png', animations: 'disabled' });
  rejectLogin = false;
  await page.getByLabel('Contraseña', { exact: true }).fill('fixture-password');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await page.waitForURL('**/admin/voceros/');
  await page.getByRole('button', { name: /Ver detalle de/ }).waitFor();
  assert.equal(await page.locator('[data-records] img').count(), 0);
  assert.equal(await page.locator('[data-records]').innerText().then(t => t.includes('0000001234')), false);
  await page.screenshot({ path: 'output/playwright/admin-desktop.png', animations: 'disabled' });
  await page.getByRole('button', { name: /Siguiente/ }).click();
  await page.getByText('Página 2 de 2').waitFor();
  await page.getByRole('button', { name: /Ver detalle de/ }).click();
  await page.getByText('0000001234', { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Añadir nota').getAttribute('maxlength'), '2000');
  assert.equal(await page.locator('[data-detail-content] img').count(), 0);
  await page.getByLabel('Estado del registro').selectOption('Aprobado');
  await page.getByRole('button', { name: 'Guardar estado' }).click();
  await page.getByText('Estado actualizado.', { exact: true }).waitFor();
  await page.getByLabel('Añadir nota').fill('<script>alert(1)</script> Revisión de prueba');
  await page.getByRole('button', { name: 'Guardar nota' }).click();
  await page.getByText('Nota guardada.', { exact: true }).waitFor();
  assert.equal(await page.locator('[data-notes] script').count(), 0);
  await page.screenshot({ path: 'output/playwright/admin-detail.png', animations: 'disabled' });
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog').evaluate(d => d.open), false);
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Registros');
  await page.getByLabel('Ciudad exacta').fill('Quito');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await page.getByText('Página 1 de 2').waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV' }).click();
  await downloadPromise;
  const exported = calls.findLast(c => c.path.endsWith('/export'));
  assert.deepEqual(exported.body, { city: 'Quito' });
  assert.equal(exported.method, 'POST');
  assert.equal(exported.headers['x-csrf-token'], 'test-csrf');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'output/playwright/admin-mobile.png', fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  failure = 422;
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await page.getByText('Revisa los datos ingresados e intenta de nuevo.').waitFor();
  failure = 403;
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await page.getByText('No se autorizó la solicitud. Actualiza la página e intenta de nuevo.').waitFor();
  failure = -1;
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await page.getByText('No se pudo conectar. Revisa tu conexión e intenta de nuevo.').waitFor();
  await page.getByLabel('Buscar', { exact: true }).fill('vacío');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await page.getByText('No hay registros con estos filtros.').waitFor();
  failure = 401;
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  authenticated = false;
  await page.waitForURL('**/admin/');
  authenticated = true;
  await page.goto(origin + '/admin/');
  await page.waitForURL('**/admin/voceros/');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.waitForURL('**/admin/');
  assert.deepEqual(errors, []);
  console.log('Admin browser: login/logout, 401/403/422/network, safe rendering, pagination, status, notes, export, focus, mobile: PASS');
  }
} catch (error) { console.error('Browser errors:', errors, 'URL:', page.url(), 'Feedback:', await page.locator('[data-admin-feedback]').textContent()); throw error; }
finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
