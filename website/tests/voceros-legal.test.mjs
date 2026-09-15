import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderVocerosLegalPage } from '../src/finados/voceros-legal-page.mjs';

test('los avisos muestran íntegro el consentimiento canónico y su versión individual', async () => {
  const catalog = JSON.parse(await readFile(new URL('../backend/finados-api/resources/vocero-consents.json', import.meta.url), 'utf8'));
  const normalize = text => text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [key, consent, version] of [['privacy', 'data', '2026-09-15'], ['image', 'image', '2026-09-15'], ['policies', null, '2026-09-14'], ['thermometer', null, '2026-09-14']]) {
    const html = renderVocerosLegalPage({ documentKey: key, route: '/finados/voceros/legal/' });
    assert.match(html, new RegExp(`datetime="${version}"`));
    if (consent) {
      const shown = html.match(/<p data-consent-text="[^"]+">([\s\S]*?)<\/p>/)?.[1];
      assert.equal(normalize(shown ?? ''), normalize(catalog[consent].text));
    }
    if (key === 'privacy') {
      assert.match(normalize(html), /fotografía.*obligatoria/);
      assert.match(normalize(html), /acceso restringido/);
      assert.match(normalize(html), /tres años contados desde el envío/);
      assert.match(normalize(html), /no hay purga automática/);
    }
  }
});
