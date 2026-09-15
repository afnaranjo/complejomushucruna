import test from 'node:test';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

async function worker(t, stage) {
  const root = await mkdtemp(join(tmpdir(), 'voceros-lifecycle-test-'));
  const child = fork(fileURLToPath(new URL('lifecycle-worker.mjs', import.meta.url)), [stage], {
    env: { PATH: process.env.PATH, TMPDIR: root }, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
  });
  const events = [];
  child.on('message', (message) => events.push(message));
  const exited = once(child, 'exit');
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) { child.kill('SIGTERM'); await exited; }
    await rm(root, { recursive: true, force: true });
  });
  async function waitStage(expected) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const found = events.find((event) => event.stage === expected);
      if (found) return found;
      if (expected === 'credentials' && (await readdir(root, { recursive: true })).some((file) => file.endsWith('credentials.json'))) return { pids: [] };
      if (child.exitCode !== null || child.signalCode !== null) assert.fail('Worker exited before checkpoint ' + expected);
      await new Promise((yes) => setTimeout(yes, 10));
    }
    assert.fail('Checkpoint was not reached: ' + expected);
  }
  return { child, root, exited, waitStage };
}

for (const [stage, signal] of [['credentials', 'SIGTERM'], ['provisioning', 'SIGINT'], ['build', 'SIGTERM'], ['readiness', 'SIGINT']]) {
  test(`interrupting ${stage} waits for owned work and leaves no files or PHP processes`, { timeout: 15000 }, async (t) => {
    const run = await worker(t, stage);
    const checkpoint = await run.waitStage(stage);
    run.child.kill(signal);
    await run.exited;
    assert.deepEqual(await readdir(run.root), []);
    for (const pid of checkpoint.pids ?? []) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  });
}

test('manifest write failure cleans credentials, build and both PHP servers', { timeout: 15000 }, async (t) => {
  const run = await worker(t, 'manifest');
  const checkpoint = await run.waitStage('manifest');
  run.child.send('continue');
  const [code] = await run.exited;
  assert.equal(code, 1);
  assert.deepEqual(await readdir(run.root), []);
  for (const pid of checkpoint.pids) assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});

test('a deliberate bind collision retries with coherent ports without requesting the foreign server', { timeout: 15000 }, async (t) => {
  const run = await worker(t, 'public-released');
  const checkpoint = await run.waitStage('public-released');
  let foreignRequests = 0;
  const server = createServer((_request, response) => { foreignRequests++; response.end('{"ok":true}'); });
  await new Promise((yes, no) => { server.once('error', no); server.listen(checkpoint.publicPort, '127.0.0.1', yes); });
  t.after(() => new Promise((yes) => server.close(yes)));
  run.child.send('continue');
  // Only the first occurrence is paused by the worker.
  const ready = await run.waitStage('ready');
  assert.notEqual(new URL(ready.publicOrigin).port, String(checkpoint.publicPort));
  assert.equal(foreignRequests, 0);
  const health = await fetch(ready.apiOrigin + '/api/health');
  assert.equal(health.status, 200);
  const page = await (await fetch(ready.publicOrigin + '/admin/')).text();
  assert.ok(page.includes(ready.apiOrigin + '/api'));
  const preflight = await fetch(ready.apiOrigin + '/api/auth/login', { method: 'OPTIONS', headers: {
    Origin: ready.publicOrigin, 'Access-Control-Request-Method': 'POST' } });
  assert.equal(preflight.status, 204);
  run.child.send('stop');
  await run.exited;
  assert.deepEqual(await readdir(run.root), []);
});
