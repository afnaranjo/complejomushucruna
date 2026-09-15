import { startLocalStack } from './local-stack.mjs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const target = process.argv[2];
let paused = false;
try {
  const stack = await startLocalStack({
    async onStage(stage, info) {
      if (stage !== target || paused) return;
      paused = true;
      if (stage === 'manifest') await mkdir(join(info.root, 'local-stack.json'));
      process.send({ stage, ...info });
      await new Promise((resolve) => process.once('message', resolve));
    },
  });
  process.send({ stage: 'ready', publicOrigin: stack.publicOrigin, apiOrigin: stack.apiOrigin });
  await new Promise((resolve) => process.once('message', resolve));
  await stack.stop();
} catch {
  process.exitCode = 1;
} finally { process.disconnect(); }
