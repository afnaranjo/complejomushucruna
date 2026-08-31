import { readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const allowedExtension = /\.(?:avif|webp|jpe?g|png|svg|mp4|woff2|ttf)$/i;

export function validateAssetPaths(paths) {
  for (const path of paths) {
    if (path.startsWith('/') || path.split(/[\\/]/).includes('..')) {
      throw new Error(`Ruta insegura: ${path}`);
    }
    if (!allowedExtension.test(path)) {
      throw new Error(`Extensión no permitida: ${path}`);
    }
  }
  return true;
}

async function listFiles(directory, root = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path, root));
    else files.push(relative(root, path).split(sep).join('/'));
  }
  return files;
}

async function main() {
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const directory = resolve(process.argv[2] ?? join(scriptDirectory, '..', 'public', 'assets'));
  const files = await listFiles(directory);
  validateAssetPaths(files);
  console.log(`Activos válidos: ${files.length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
