// Dependency-free source-graph measurement; this is not a production bundle size.
import { readFileSync, globSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const baselineRoot = process.argv[2];
if (!baselineRoot) throw new Error('Usage: node scripts/profile-landing-source.mjs /path/to/baseline-checkout');
function profile(baseline) {
  const visited = new Map();
  function visit(path) {
    path = resolve(path.split('?')[0]);
    if (visited.has(path)) return;
    const source = baseline
      ? readFileSync(resolve(baselineRoot, relative(root, path)), 'utf8')
      : readFileSync(path, 'utf8');
    visited.set(path, Buffer.byteLength(source));
    if (!/\.[cm]?[jt]sx?$/.test(path)) return;
    for (const [, specifier] of source.matchAll(/(?:\bfrom\s*|\bimport\s*)['"]([^'"]+)['"]/g)) {
      if (specifier.startsWith('.')) visit(resolve(dirname(path), specifier));
    }
    for (const [, pattern] of source.matchAll(/import\.meta\.glob\(\s*['"]([^'"]+)['"]/g)) {
      for (const match of globSync(pattern, { cwd: dirname(path) })) visit(resolve(dirname(path), match));
    }
  }
  visit(resolve(root, 'src/main.jsx'));
  const datasets = [...visited].filter(([path]) => /\.(json|geojson)$/.test(path));
  return {
    files: visited.size,
    sourceBytes: [...visited.values()].reduce((a, b) => a + b, 0),
    datasetFiles: datasets.length,
    datasetBytes: datasets.reduce((sum, [, bytes]) => sum + bytes, 0),
  };
}
console.log(JSON.stringify({ metric: 'Landing static source dependency graph, excluding third-party packages and dynamic routes', baselineHEAD: profile(true), workingTree: profile(false) }, null, 2));
