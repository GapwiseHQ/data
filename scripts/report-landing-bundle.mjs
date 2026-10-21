// Run after: npm exec -- vite build --manifest
// gzip values are estimates from emitted files, not observed CDN transfer sizes.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const output = resolve(process.argv[2] ?? 'dist');
const manifest = JSON.parse(await readFile(resolve(output, '.vite/manifest.json'), 'utf8'));
const visited = new Set();
const assets = new Set();
function visit(key) {
  if (visited.has(key)) return;
  const chunk = manifest[key];
  if (!chunk) throw new Error(`Required landing chunk missing from Vite manifest: ${key}`);
  visited.add(key);
  assets.add(chunk.file);
  for (const css of chunk.css ?? []) assets.add(css);
  for (const dependency of chunk.imports ?? []) visit(dependency);
}
// entry.jsx selects main.jsx for the landing route. Other dynamic route chunks
// are deliberately excluded; shared static dependencies and CSS are included.
visit('index.html');
visit('src/main.jsx');
const files = await Promise.all([...assets].sort().map(async (file) => {
  const bytes = await readFile(resolve(output, file));
  return { file, bytes: bytes.length, gzipBytes: gzipSync(bytes).length };
}));
const sum = (extension, key) => files.filter(({ file }) => file.endsWith(extension))
  .reduce((total, file) => total + file[key], 0);
console.log(JSON.stringify({
  metric: 'Emitted landing-route assets; gzip estimates exclude HTTP headers, fonts, images, and HTML',
  javascriptBytes: sum('.js', 'bytes'),
  javascriptGzipBytes: sum('.js', 'gzipBytes'),
  cssBytes: sum('.css', 'bytes'),
  cssGzipBytes: sum('.css', 'gzipBytes'),
  files,
}, null, 2));
