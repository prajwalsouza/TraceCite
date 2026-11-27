#!/usr/bin/env node
// Released format versions are frozen: their schema files must never change. A new feature goes into a new
// minor version (additive) or a new major version (breaking), with its own schema file. See docs/format.md,
// "Versioning". Run by `npm run validate`.
//   1.0 frozen with release 0.3.0 (2026-11-25).
//   1.1 adds "changes" (the edit history); frozen with release 0.4.0 (2026-11-27).
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const FROZEN = {
  'schema/tracecite-1.0.schema.json': 'bbdf8fda4ed609e415171cedb139ce6a636335c6792c5c4672c7de91ea7f2eb5',
  'schema/tracecite-1.1.schema.json': '3968cfb57307f28da11a205cfa9e3dd30b94183a7d58c8e98c07afc280a51515',
};
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0;
for (const [file, want] of Object.entries(FROZEN)) {
  const got = createHash('sha256').update(await readFile(join(root, file))).digest('hex');
  if (got !== want) { bad++; console.error(`${file} has changed, but its format version is frozen. Put the change in a new version's schema instead.`); }
}
if (bad) process.exit(1);
console.log(`Frozen formats unchanged: ${Object.keys(FROZEN).map((f) => f.match(/tracecite-([\d.]+)\.schema/)[1]).join(', ')}.`);
