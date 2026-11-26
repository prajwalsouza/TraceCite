#!/usr/bin/env node
// Edits round trip (format 1.1): open a sample package, make a text edit, add and remove a sentence, save it
// as the next version, open that again and validate it. Undoing every edit gives back the original blocks.
// Run by `npm run validate`.
import { readFile, writeFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
await import('./zip.js'); await import('./package.js');
const P = globalThis.TracePackage;
const pkg = await P.open([{ name: 'sample.trace.zip', bytes: await readFile(join(root, 'samples/sample.trace.zip')) }]);
const before = JSON.stringify(pkg.doc.blocks);
const s1 = P.findBlock(pkg.doc.blocks, 's-1').b, s3 = P.findBlock(pkg.doc.blocks, 's-3');
const at = '2026-11-25T12:00:00.000Z', by = 'Check';
const added = { id: 's-check', type: 'sentence', text: 'A sentence added in edit mode.', tags: [], fields: [{ key: 'Added by', value: by }], collapsed: false, children: [] };
const changes = [
  { id: 'ch-1', at, by, op: 'text', block: 's-1', before: s1.text, after: s1.text.replace('Markup', 'Structural markup') },
  { id: 'ch-2', at, by, op: 'insert', block: 's-check', parent: 'p-structure', previous: 's-1', value: added },
  { id: 'ch-3', at, by, op: 'remove', block: 's-3', parent: s3.parent.id, previous: s3.list[s3.list.indexOf(s3.b) - 1].id, value: s3.b },
];
const next = await P.withEdits(pkg, changes, { by, note: 'Edit mode check' });
assert.equal(JSON.stringify(pkg.doc.blocks), before, 'the original package is not changed');
const back = await P.open([{ name: 'next.trace.zip', bytes: next.bytes }]);
assert.equal(back.doc.format, 'tracecite/1.1');
assert.equal(back.manifest.format, 'tracecite/1.1');
assert.equal(back.manifest.version, (pkg.manifest.version || 1) + 1);
assert.equal(back.doc.changes.length, 3);
assert.ok(back.doc.changes.every((c) => c.version === back.manifest.version));
assert.match(P.findBlock(back.doc.blocks, 's-1').b.text, /^Structural markup/);
assert.ok(P.findBlock(back.doc.blocks, 's-check') && !P.findBlock(back.doc.blocks, 's-3'));
// Validate the saved data with the command-line validator, beside its .bib files, as an author would.
const dir = await mkdtemp(join(tmpdir(), 'trace-edits-'));
for (const [p, bytes] of back.files) { await mkdir(dirname(join(dir, p)), { recursive: true }); await writeFile(join(dir, p), bytes); }
execFileSync(process.execPath, [join(root, 'scripts/validate-trace.mjs'), join(dir, back.dataPath)], { stdio: 'pipe' });
await rm(dir, { recursive: true, force: true });
const undo = JSON.parse(JSON.stringify(back.doc.blocks));
for (const c of [...changes].reverse()) P.applyChange(undo, P.invert(c));
assert.equal(JSON.stringify(undo), before, 'undoing every edit gives back the original');
assert.throws(() => P.applyChange(JSON.parse(before), { ...changes[0], before: 'something else' }), /changed since/);
console.log(`Edits round trip: version ${pkg.manifest.version} → ${back.manifest.version}, ${back.doc.changes.length} changes, valid tracecite/1.1, undo restores the original.`);
