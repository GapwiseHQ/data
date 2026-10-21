import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { UNIVERSITIES, CAMPUS_IDS } from '../src/campus-catalog.js';

test('landing catalog is complete without importing map geometry or graph data', async () => {
  assert.equal(UNIVERSITIES.length, 38);
  assert.equal(CAMPUS_IDS.length, 90);
  assert.equal(new Set(CAMPUS_IDS).size, CAMPUS_IDS.length);
  const catalog = await readFile(new URL('../src/campus-catalog.js', import.meta.url), 'utf8');
  assert.doesNotMatch(catalog, /\bimport\b|\bfrom\s+["']/);
  const landing = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  assert.match(landing, /from '\.\/campus-catalog\.js'/);
  assert.doesNotMatch(landing, /campus-contribution-data|entrance-map-data/);
});
