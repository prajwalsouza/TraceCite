#!/usr/bin/env node
// Stress test for long documents: repeats a trace's blocks as chapters of a test book, with fictional
// placeholder authors, so loading in parts, the contents tree, the tag dock and reading position can be checked.
//   node long-test-book.mjs --data paper.trace.json --copies 12 --out zz-book.trace.json
//   node ../scripts/build-reading.mjs --data zz-book.trace.json --out zz-book.html
// Equation \label and \tag are dropped from the copies (MathJax rejects duplicate labels). Delete the output after.
import { readFile, writeFile } from 'node:fs/promises';
const args = Object.fromEntries(process.argv.slice(2).reduce((p, v, i, a) => (v.startsWith('--') ? [...p, [v.slice(2), a[i + 1]]] : p), []));
const d = JSON.parse(await readFile(args.data, 'utf8'));
const n = +(args.copies || 12);
const rid = (b, k) => ({ ...b, id: `${b.id}-c${k}`, children: (b.children || []).map((c) => rid(c, k)) });
const strip = (b) => ({ ...b, text: (b.text || '').replace(/\\label\{[^}]*\}|\\tag\{[^}]*\}/g, ''), children: (b.children || []).map(strip) });
d.blocks = Array.from({ length: n }, (_, i) => ({ id: `ch-${i + 1}`, type: 'section', text: `Chapter ${i + 1}: ${d.title}, part ${i + 1}`, tags: [], collapsed: false, fields: [], children: d.blocks.map((b) => (i ? strip(rid(b, i + 1)) : rid(b, i + 1))) }));
Object.assign(d, { id: 'test-book-' + Date.now(), title: 'A long test book', authors: [{ name: 'Ada Example', affiliations: ['a1'], corresponding: true, email: 'ada@example.org' }, { name: 'Ben Placeholder', affiliations: ['a2'] }], affiliations: [{ id: 'a1', name: 'Department of Examples, Test University' }, { id: 'a2', name: 'Institute of Placeholders' }], date: new Date().toISOString().slice(0, 10), revision: 'Stress test' });
await writeFile(args.out, JSON.stringify(d));
let s = 0; (function w(l) { for (const b of l) { if (b.type === 'sentence') s++; w(b.children || []); } })(d.blocks);
console.log(`${n} chapters, ${s} sentences → ${args.out}`);
