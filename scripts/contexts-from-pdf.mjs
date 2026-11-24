#!/usr/bin/env node
// Fill in the context of each quote from the source's own PDF: the whole paragraph the quote sits in.
//
//   node contexts-from-pdf.mjs --bib refs.bib --pdfs ./pdfs            dry run: report what would be added
//   node contexts-from-pdf.mjs --bib refs.bib --pdfs ./pdfs --write    write trace-quote[-n]-context fields
//
// PDFs are found by entry key (pdfs/<key>.pdf) or by arXiv id (pdfs/2307.15683.pdf, slashes as underscores).
// Text comes from pdftotext (poppler). Line breaks and hyphenation at line ends are joined, and runs of
// whitespace collapse to one space; nothing else changes, so each context is the PDF's own words. A quote is
// matched exactly after the same whitespace collapsing; if it is not found (for example math typeset
// differently in the PDF), it is reported and left alone. Existing contexts are kept unless --replace.
//
// Use your own legitimately obtained copies. Long passages are for private reading copies: before publishing
// a page, keep quoted passages within what each source's licence allows.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { parseBib, writeBib } from './bibtrace.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, v, i, all) => (v.startsWith('--') ? [...pairs, [v.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : pairs), []));
if (!args.bib || !args.pdfs) { console.error('usage: node contexts-from-pdf.mjs --bib refs.bib --pdfs <folder> [--write] [--replace]'); process.exit(1); }
const bibPath = resolve(args.bib), dir = resolve(args.pdfs);
const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };
const squash = (t) => t.replace(/-\n(?=[a-z])/g, '').replace(/\s+/g, ' ').trim();

const text = await readFile(bibPath, 'utf8');
const entries = parseBib(text);
let added = 0, missing = 0;
const report = [];
for (const e of entries) {
  const raw = e.raw;
  const quotes = [];
  for (let n = 1; n < 50; n++) { const sfx = n === 1 ? '' : '-' + n; if (!raw['trace-quote' + sfx]) { if (n > 1) break; continue; } quotes.push(sfx); }
  if (!quotes.length) continue;
  const candidates = [e.key, raw.eprint && String(raw.eprint).replace(/\//g, '_')].filter(Boolean).map((k) => join(dir, k + '.pdf'));
  let pdf = null; for (const c of candidates) if (await exists(c)) { pdf = c; break; }
  if (!pdf) { report.push(`${e.key}: no PDF (looked for ${candidates.map((c) => c.split('/').pop()).join(' or ')})`); continue; }
  let full;
  try { full = execFileSync('pdftotext', ['-enc', 'UTF-8', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 << 20 }); }
  catch (err) { report.push(`${e.key}: pdftotext failed (${err.message.split('\n')[0]})`); continue; }
  const paras = full.split(/\n\s*\n/).map(squash).filter(Boolean);
  for (const sfx of quotes) {
    const field = `trace-quote${sfx}-context`;
    if (raw[field] && !args.replace) continue;
    const q = squash(raw['trace-quote' + sfx]);
    let para = paras.find((p) => p.includes(q));
    // A quote can straddle a paragraph break that pdftotext inserted (page or column ends): try neighbours joined.
    if (!para) for (let i = 0; i + 1 < paras.length && !para; i++) { const two = paras[i] + ' ' + paras[i + 1]; if (two.includes(q)) para = two; }
    if (!para) { missing++; report.push(`${e.key} quote${sfx || ' 1'}: not found in the PDF text (math or ligatures may differ); left alone`); continue; }
    raw[field] = para; e.fields[field] = para; added++;
    report.push(`${e.key} quote${sfx || ' 1'}: context ${para.length} characters`);
  }
}
console.log(report.join('\n'));
console.log(`\n${added} contexts ${args.write ? 'written' : 'found (dry run; add --write to save)'}, ${missing} quotes not found.`);
if (args.write && added) {
  const header = (text.match(/^(?:%[^\n]*\n)+/) || [''])[0];
  await writeFile(bibPath, header + (header ? '\n' : '') + writeBib(entries.map((x) => ({ type: x.type, key: x.key, fields: x.raw }))));
}
