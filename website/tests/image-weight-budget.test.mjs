import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildSite } from '../scripts/build.mjs';

// Una sola imagen de varios MB vuelve lenta la página en datos móviles y satura el hosting compartido.
const IMAGE_BUDGET = 1_000_000;

test('ninguna página pública incrusta una imagen de más de 1 MB', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'image-budget-'));
  const files = await buildSite(directory);
  const offenders = [];
  for (const file of files.filter(name => name.endsWith('.html') && !name.startsWith('admin/'))) {
    const html = await readFile(join(directory, file), 'utf8');
    const urls = new Set();
    for (const [, attr] of html.matchAll(/<img\b[^>]*?\s(?:src|srcset)="([^"]+)"/g)) {
      for (const candidate of attr.split(',')) urls.add(candidate.trim().split(/\s+/)[0]);
    }
    for (const [, attr] of html.matchAll(/<img\b[^>]*?\ssrcset="([^"]+)"/g)) {
      for (const candidate of attr.split(',')) urls.add(candidate.trim().split(/\s+/)[0]);
    }
    for (const url of urls) {
      if (!url.startsWith('/')) continue;
      const path = join(directory, url.split('?')[0]);
      const size = (await stat(path).catch(() => ({ size: 0 }))).size;
      if (size > IMAGE_BUDGET) offenders.push(`${file}: ${url} (${size} bytes)`);
    }
  }
  assert.deepEqual(offenders, []);
});
