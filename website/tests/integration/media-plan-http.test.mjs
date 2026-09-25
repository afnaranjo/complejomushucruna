import test from 'node:test';
import assert from 'node:assert/strict';
import { startLocalStack } from './local-stack.mjs';

/** Un WAV mínimo y válido, para que el servidor lo reconozca como audio por su contenido. */
function wav(samples = 4000) {
  const data = Buffer.alloc(samples * 2);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24); header.writeUInt32LE(16000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

test('HTTP real: el calendario de medios guarda guiones largos y sube, descarga y protege el audio de cada spot', async (t) => {
  const stack = await startLocalStack();
  t.after(stack.stop);
  const cookies = new Map(); let csrf = '';
  async function request(path, { method = 'GET', body, origin = stack.publicOrigin, withCookie = true } = {}) {
    const multipart = body instanceof FormData;
    const cookie = [...cookies.values()].join('; ');
    const response = await fetch(stack.apiOrigin + '/api' + path, { method, headers: {
      Origin: origin, ...(withCookie && cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      ...(body !== undefined && !multipart ? { 'Content-Type': 'application/json' } : {}),
    }, ...(body !== undefined ? { body: multipart ? body : JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
    for (const entry of response.headers.getSetCookie()) { const pair = entry.split(';')[0]; cookies.set(pair.split('=')[0], pair); }
    if (response.headers.get('content-type')?.includes('application/json')) {
      const result = await response.clone().json();
      if (typeof result.csrf === 'string') csrf = result.csrf;
    }
    return response;
  }
  await request('/auth/session');
  assert.equal((await request('/auth/login', { method: 'POST', body: stack.credentials })).status, 200);
  assert.equal((await (await request('/media-plan')).json()).version, 0);

  // Un calendario con varios guiones largos por spot pasa de 16 KB: el punto de entrada lo lee completo.
  const script = 'LOCUTOR: ¡Llega Finados 2026, es tradición! '.repeat(170).trim();
  const spots = ['general', 'atractivos', 'carteleras'].map((id, index) => ({ id, qty: 1, name: `AUDIO ${index + 1}`, desc: '', color: '#94165e', national: true, regional: true, local: true, scripts: [{ id: `${id}_1`, title: 'Guion 1', text: script, audio: null }, { id: `${id}_2`, title: 'Guion 2', text: script, audio: null }] }));
  const plan = { spots, assignments: [{ id: 'as_1', spotId: 'general', weekId: 'w1', start: '2026-09-21', end: '2026-09-27', note: '' }], media: [], plans: [] };
  assert.ok(JSON.stringify({ data: plan, version: 0 }).length > 16384);
  const saved = await request('/media-plan', { method: 'POST', body: { data: plan, version: 0 } });
  assert.equal(saved.status, 200, await saved.clone().text());
  assert.equal((await saved.json()).data.spots[2].scripts[1].text, script);

  // Subida por multipart real, descarga idéntica y rechazo de lo que no es audio.
  const bytes = wav();
  const form = new FormData(); form.append('audio', new Blob([bytes], { type: 'audio/wav' }), 'Spot general final.wav');
  const uploaded = await request('/media-plan/audio', { method: 'POST', body: form });
  assert.equal(uploaded.status, 201, await uploaded.clone().text());
  const { audio } = await uploaded.json();
  assert.equal(audio.name, 'Spot general final.wav');
  assert.equal(audio.size, bytes.length);
  const download = await request(`/media-plan/audio/${audio.id}`);
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
  assert.match(download.headers.get('content-disposition'), /^attachment; filename="Spot general final\.wav"/);
  assert.equal(download.headers.get('cache-control'), 'private, no-store');
  const notAudio = new FormData(); notAudio.append('audio', new Blob(['<?php echo 1;']), 'falso.mp3');
  assert.equal((await request('/media-plan/audio', { method: 'POST', body: notAudio })).status, 422);

  // El spot guarda la referencia y el guion; sin sesión nadie descarga ni sube.
  plan.spots[0].scripts[1].audio = audio;
  assert.equal((await request('/media-plan', { method: 'POST', body: { data: plan, version: 1 } })).status, 200);
  assert.equal((await (await request('/media-plan')).json()).data.spots[0].scripts[1].audio.id, audio.id);
  assert.equal((await request(`/media-plan/audio/${audio.id}`, { withCookie: false })).status, 401);
  assert.equal((await request('/media-plan/audio', { method: 'POST', body: form, withCookie: false })).status, 401);
});
