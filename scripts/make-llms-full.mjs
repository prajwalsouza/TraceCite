#!/usr/bin/env node
// Writes llms-full.txt: llms.txt followed by the guidance and specifications it links to, inlined, so an agent
// can read everything in one request. Run by `npm run build`.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const parts = ['llms.txt', 'docs/writing-with-agents.md', 'docs/format.md', 'docs/bibtrace.md', 'docs/package.md', 'docs/sample.md'];
let out = '';
for (const p of parts) out += (out ? `\n\n---\n\n<!-- ${p} -->\n\n` : '') + (await readFile(join(root, p), 'utf8')).trim() + '\n';
await writeFile(join(root, 'llms-full.txt'), out);
console.log(`Wrote llms-full.txt (${(out.length / 1e3).toFixed(0)} kB from ${parts.length} files).`);
