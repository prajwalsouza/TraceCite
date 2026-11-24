#!/usr/bin/env node
// Extract the context (the full passage) around each exact quote from the source's own file.
//
//   node contexts-from-files.mjs --data doc.trace.json --map sources-to-files.json --out doc.contexts.json
//
// sources-to-files.json maps each source id to one or more local files: { "src-readme": "../trace/README.md",
// "src-code": ["app.js", "reading-peek.js"] } (paths relative to the map). Files can be Markdown or plain
// text (the paragraph between blank lines), code (the run of non-blank lines around the quote, at most 12),
// or a saved HTML page (the <p>, <li>, <dd> or <td> element holding the quote, tags stripped, entities
// decoded, whitespace collapsed). The output maps "sourceId|n" (n = quote number, 1 = the first) to
// { context, file }. Every context contains its quote exactly; quotes that are not found are reported.
// Generators merge the output into their sources as "Quote context" fields (or BibTrace
// trace-quote[-n]-context), so the data stays reproducible without re-reading the files.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, extname } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((p, v, i, a) => (v.startsWith('--') ? [...p, [v.slice(2), a[i + 1]]] : p), []));
if (!args.data || !args.map || !args.out) { console.error('usage: node contexts-from-files.mjs --data doc.trace.json --map map.json --out contexts.json'); process.exit(1); }
const doc = JSON.parse(await readFile(resolve(args.data), 'utf8'));
const mapPath = resolve(args.map), map = JSON.parse(await readFile(mapPath, 'utf8'));
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };
const decode = (t) => t.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const squash = (t) => t.replace(/\s+/g, ' ').trim();

function passages(text, file) {
  const ext = extname(file).toLowerCase();
  if (['.html', '.htm'].includes(ext)) {
    const body = text.replace(/<(script|style)[\s\S]*?<\/\1>/gi, '');
    // Each element type separately, so an enclosing <div> never hides the <p> inside it.
    return ['p', 'li', 'dd', 'td', 'blockquote', 'div'].flatMap((tag) => [...body.matchAll(new RegExp(`<(${tag})\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi'))]).map((m) => squash(decode(m[2].replace(/<\/?(a|em|i|b|strong|span|code|abbr|sup|sub|small|cite|q|var|kbd|tt|u|mark)\b[^>]*>/gi, '').replace(/<[^>]+>/g, ' ')))).filter(Boolean).sort((a, b) => a.length - b.length);
  }
  if (['.js', '.mjs', '.cjs', '.css', '.ts', '.py'].includes(ext)) return { code: text.split('\n') };
  return text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}
function codeContext(lines, quote) {
  const i = lines.findIndex((l) => l.includes(quote));
  if (i < 0) return null;
  let a = i, b = i;
  while (a > 0 && lines[a - 1].trim() && i - a < 5) a--;
  while (b < lines.length - 1 && lines[b + 1].trim() && b - i < 6) b++;
  return lines.slice(a, b + 1).join('\n');
}

const out = {}, report = [];
for (const s of doc.sources || []) {
  const files = [map[s.id]].flat().filter(Boolean);
  if (!files.length) continue;
  const texts = await Promise.all(files.map(async (f) => { const p = resolve(dirname(mapPath), f); return { f, p, t: await readFile(p, 'utf8') }; }));
  for (const field of s.fields || []) {
    const m = field.key.match(/^Exact quote(?: (\d+))?$/); if (!m || !field.value) continue;
    const n = m[1] || '1', q = field.value;
    let found = null;
    for (const { f, t } of texts) {
      const ps = passages(t, f);
      const ctx = ps.code ? codeContext(ps.code, q) : ps.find((p) => p.includes(q) || squash(p).includes(q));
      if (ctx) { found = { context: ctx.includes(q) ? ctx : squash(ctx), file: f }; break; }
    }
    if (found && found.context.includes(q)) { out[`${s.id}|${n}`] = found; report.push(`${s.id} quote ${n}: ${found.context.length} characters from ${found.file}`); }
    else report.push(`${s.id} quote ${n}: NOT FOUND in ${files.join(', ')}`);
  }
}
await writeFile(resolve(args.out), JSON.stringify(out, null, 2) + '\n');
console.log(report.join('\n') + `\n${Object.keys(out).length} contexts written to ${args.out}`);
