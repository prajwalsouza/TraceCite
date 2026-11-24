// BibTrace: standard BibTeX with trace fields on top.
//
// Every source lives in a .bib file that any BibTeX/BibLaTeX tool can read. The trace evidence rides along
// as extra fields, which other tools ignore:
//
//   @techreport{raggett1999html,
//     author      = {Raggett, Dave and Le Hors, Arnaud and Jacobs, Ian},
//     title       = {{HTML} 4.01 Specification},
//     institution = {World Wide Web Consortium}, type = {W3C Recommendation}, year = {1999},
//     url         = {https://www.w3.org/TR/html401/intro/intro.html},
//     trace-quote          = {HTML has its roots in SGML which has always been a language for the specification of structural markup.},
//     trace-quote-location = {2.4.1 Separate structure and presentation · first sentence},
//     trace-quote-note-1   = {The quote opens its passage.},
//     trace-quote-2        = {Experience has shown that separating the structure of a document from its presentational aspects reduces the cost of serving a wide range of platforms},
//     trace-quote-2-location = {2.4.1 Separate structure and presentation · third sentence},
//     trace-quote-2-tags   = {topic-markup},
//     trace-url-read = {https://www.w3.org/TR/html401/intro/intro.html},
//     trace-checked  = {2026-11-24},
//     trace-status   = {Checked excerpt · verbatim against the page text},
//   }
//
// Trace fields. Quote 1 has no number; later quotes are -2, -3, …, and each quote can have children:
//   trace-quote[-n]               the exact words, verbatim
//   trace-quote[-n]-location      where they sit (section, paragraph, page)
//   trace-quote[-n]-context       the longer passage around them, verbatim (shown with the quote marked)
//   trace-quote[-n]-context-withheld   why the passage is not reproduced (e.g. copyright), instead of a context
//   trace-quote[-n]-tags          tag ids for this quote, separated by ;
//   trace-quote[-n]-note-m        notes on this quote (m = 1, 2, …), shown as its children
//   trace-quote[-n]-comment-m     people's comments on this quote; trace-quote[-n]-comment-m-by names the person (optional)
//   trace-quote[-n]-added-by / -added-via / -checked-by / -checked-on, trace-quote[-n]-note-m-by   provenance
// and for the whole record: trace-added-by, trace-added-via (manual, Zotero, agent, script, PDF), trace-added-on,
// trace-status (how far it is checked), trace-checked (date), trace-url-read (the
// page actually read), trace-note (anything else). trace-quote-location-n (older form) is also read. A trace data file points at its bibliography with "bibliography": "refs.bib";
// sentences cite an entry by its key ("Source ID": "raggett1999html").
import { readFile } from 'node:fs/promises';
import './cite-styles.js';
const CS = globalThis.TraceCiteStyles;

// LaTeX accents and symbols that commonly appear in names and titles.
const ACCENTS = { "'": { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', y: 'ý', c: 'ć', n: 'ń', s: 'ś', z: 'ź', A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú', C: 'Ć', S: 'Ś', Z: 'Ź' },
  '`': { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù', A: 'À', E: 'È' }, '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û' },
  '"': { a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' }, '~': { a: 'ã', n: 'ñ', o: 'õ', N: 'Ñ' },
  c: { c: 'ç', s: 'ş', C: 'Ç', S: 'Ş' }, v: { c: 'č', s: 'š', z: 'ž', r: 'ř', e: 'ě', C: 'Č', S: 'Š', Z: 'Ž' }, u: { g: 'ğ', a: 'ă' }, '=': { a: 'ā', e: 'ē', o: 'ō' }, '.': { z: 'ż', I: 'İ' }, H: { o: 'ő', u: 'ű' }, r: { a: 'å', A: 'Å' } };
const SYMBOLS = { '\\ss': 'ß', '\\o': 'ø', '\\O': 'Ø', '\\ae': 'æ', '\\AE': 'Æ', '\\aa': 'å', '\\AA': 'Å', '\\l': 'ł', '\\L': 'Ł', '\\i': 'ı', '\\&': '&', '\\%': '%', '\\_': '_', '\\#': '#', '--': '–', '---': '—' };
export function delatex(value) {
  let s = String(value);
  s = s.replace(/\{\\([`'^"~=.]|[cvuHr])\s*\{?\s*(\\?[A-Za-z])\s*\}?\}/g, (m, a, c) => ACCENTS[a]?.[c.replace('\\', '')] ?? m)
    .replace(/\\([`'^"~=.])\{?([A-Za-z])\}?/g, (m, a, c) => ACCENTS[a]?.[c] ?? m)
    .replace(/\{\\(ss|o|O|ae|AE|aa|AA|l|L|i)\}/g, (m, c) => SYMBOLS['\\' + c] ?? m);
  // Text-mode dashes only outside math.
  const parts = s.split(/(\$[^$]*\$|\\\([\s\S]*?\\\))/);
  return parts.map((p, i) => (i % 2 ? p : p.replace(/---/g, '—').replace(/(?<!-)--(?!-)/g, '–').replace(/\\([&%_#])/g, '$1'))).join('');
}

// ---------- parse ----------
export function parseBib(text) {
  const entries = [], strings = {};
  let i = 0;
  const s = String(text);
  const skipWs = () => { while (i < s.length && /[\s,]/.test(s[i])) i++; };
  function value() {
    const parts = [];
    for (;;) {
      while (/\s/.test(s[i])) i++;
      if (s[i] === '{') {
        let depth = 0, j = i;
        for (; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === '{') depth++; else if (s[j] === '}' && --depth === 0) break; }
        parts.push(s.slice(i + 1, j)); i = j + 1;
      } else if (s[i] === '"') {
        let depth = 0, j = i + 1;
        for (; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === '{') depth++; else if (s[j] === '}') depth--; else if (s[j] === '"' && depth === 0) break; }
        parts.push(s.slice(i + 1, j)); i = j + 1;
      } else {
        const m = /^[A-Za-z0-9_:.\-+/]+/.exec(s.slice(i));
        if (!m) break;
        i += m[0].length; parts.push(/^\d+$/.test(m[0]) ? m[0] : strings[m[0].toLowerCase()] ?? m[0]);
      }
      while (/\s/.test(s[i])) i++;
      if (s[i] === '#') { i++; continue; }
      break;
    }
    return parts.join('');
  }
  while (i < s.length) {
    const at = s.indexOf('@', i);
    if (at < 0) break;
    i = at + 1;
    const typeMatch = /^([A-Za-z]+)\s*([{(])/.exec(s.slice(i));
    if (!typeMatch) continue;
    const type = typeMatch[1].toLowerCase(), close = typeMatch[2] === '{' ? '}' : ')';
    i += typeMatch[0].length;
    if (type === 'comment' || type === 'preamble') { let depth = 1; while (i < s.length && depth) { if (s[i] === '{' || s[i] === '(') depth++; else if (s[i] === '}' || s[i] === ')') depth--; i++; } continue; }
    if (type === 'string') { skipWs(); const m = /^([A-Za-z][\w-]*)\s*=\s*/.exec(s.slice(i)); if (m) { i += m[0].length; strings[m[1].toLowerCase()] = value(); } while (i < s.length && s[i] !== close) i++; i++; continue; }
    const keyMatch = /^\s*([^,\s]+)\s*,/.exec(s.slice(i));
    if (!keyMatch) continue;
    const key = keyMatch[1]; i += keyMatch[0].length;
    const fields = {}, raw = {};
    for (;;) {
      skipWs();
      if (s[i] === close || i >= s.length) { i++; break; }
      const m = /^([A-Za-z][\w:.+-]*)\s*=\s*/.exec(s.slice(i));
      if (!m) { while (i < s.length && s[i] !== close) i++; i++; break; }
      i += m[0].length;
      const name = m[1].toLowerCase(), v = value();
      raw[name] = v;
      fields[name] = name.startsWith('trace-') || ['url', 'doi', 'eprint'].includes(name) ? v : delatex(v).replace(/\s+/g, ' ').trim();
    }
    entries.push({ type, key, fields, raw });
  }
  return entries;
}

// ---------- write ----------
const ORDER = ['author', 'editor', 'title', 'journal', 'shortjournal', 'booktitle', 'publisher', 'institution', 'organization', 'howpublished', 'volume', 'number', 'pages', 'year', 'month', 'day', 'doi', 'url', 'eprint', 'archiveprefix', 'note'];
export function writeBib(entries) {
  return entries.map(({ type, key, fields }) => {
    const names = Object.keys(fields).filter((k) => fields[k] !== undefined && fields[k] !== '');
    names.sort((a, b) => {
      const ta = a.startsWith('trace-'), tb = b.startsWith('trace-');
      if (ta !== tb) return ta ? 1 : -1;
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || (ta ? 0 : a.localeCompare(b));
    });
    const width = Math.max(...names.map((n) => n.length));
    const lines = names.map((n) => `  ${n.padEnd(width)} = {${String(fields[n]).replace(/[{}]/g, (c) => (balanced(fields[n]) ? c : '\\' + c))}},`);
    return `@${type}{${key},\n${lines.join('\n')}\n}`;
  }).join('\n\n') + '\n';
}
const balanced = (v) => { let d = 0; for (const c of String(v)) { if (c === '{') d++; else if (c === '}' && --d < 0) return false; } return d === 0; };

// ---------- to trace sources ----------
// Each entry becomes a trace source. "Bib data" keeps the structured record so the reading page can
// restyle citations; the APA fields Trace itself reads are computed here.
export function bibToSources(entries) {
  const recs = entries.map((e) => ({ id: e.key, bib: { type: e.type, ...e.fields } }));
  const suf = CS.suffixes(recs, 'apa');
  return recs.map(({ id, bib }) => {
    const sx = suf.get(id) || '';
    const names = CS.parseNames(bib.author || bib.editor || '');
    const fields = [
      ['APA citation', CS.inline(bib, 'apa', sx)],
      ['First author', names[0] ? names[0].literal || names[0].family : ''],
      ['Year', CS.yearOf(bib) + sx],
      ['APA reference', CS.reference(bib, 'apa', sx)],
      ['URL', bib.url || (bib.doi ? 'https://doi.org/' + bib.doi : bib.eprint ? 'https://arxiv.org/abs/' + bib.eprint : '')],
      ['DOI', bib.doi || ''],
    ];
    for (let n = 1; n < 50; n++) {
      const sfx = n === 1 ? '' : '-' + n, q = bib['trace-quote' + sfx];
      if (!q) { if (n > 1) break; continue; }
      const k = n === 1 ? '' : ' ' + n;
      fields.push(['Exact quote' + k, q], ['Quote location' + k, bib['trace-quote' + sfx + '-location'] || bib['trace-quote-location' + sfx] || '']);
      if (bib['trace-quote' + sfx + '-context']) fields.push(['Quote context' + k, bib['trace-quote' + sfx + '-context']]);
      if (bib['trace-quote' + sfx + '-context-withheld']) fields.push(['Quote context withheld' + k, bib['trace-quote' + sfx + '-context-withheld']]);
      if (bib['trace-quote' + sfx + '-tags']) fields.push(['Quote tags' + k, bib['trace-quote' + sfx + '-tags']]);
      for (const [b, f] of [['added-by', 'Quote added by'], ['added-via', 'Quote added via'], ['checked-by', 'Quote checked by'], ['checked-on', 'Quote checked on']]) if (bib[`trace-quote${sfx}-${b}`]) fields.push([f + k, bib[`trace-quote${sfx}-${b}`]]);
      for (let m = 1; m < 50 && bib[`trace-quote${sfx}-note-${m}`]; m++) { fields.push([`Quote note${k}.${m}`, bib[`trace-quote${sfx}-note-${m}`]]); if (bib[`trace-quote${sfx}-note-${m}-by`]) fields.push([`Quote note by${k}.${m}`, bib[`trace-quote${sfx}-note-${m}-by`]]); }
      for (let m = 1; m < 50 && bib[`trace-quote${sfx}-comment-${m}`]; m++) { fields.push([`Quote comment${k}.${m}`, bib[`trace-quote${sfx}-comment-${m}`]]); fields.push([`Quote comment by${k}.${m}`, bib[`trace-quote${sfx}-comment-${m}-by`] || '']); }
    }
    fields.push(['Record status', bib['trace-status'] || (bib['trace-quote'] ? 'Checked excerpt' : 'Reference only · no passage checked')]);
    if (bib['trace-checked']) fields.push(['Checked on', bib['trace-checked']]);
    for (const [b, f] of [['trace-added-by', 'Added by'], ['trace-added-via', 'Added via'], ['trace-added-on', 'Added on']]) if (bib[b]) fields.push([f, bib[b]]);
    if (bib['trace-url-read']) fields.push(['Page read', bib['trace-url-read']]);
    if (bib['trace-note']) fields.push(['Note', bib['trace-note']]);
    fields.push(['Bib key', id], ['Bib data', JSON.stringify(Object.fromEntries(Object.entries(bib).filter(([k]) => !k.startsWith('trace-'))))]);
    return { id, type: 'source', text: CS.inline(bib, 'apa', sx), tags: [], collapsed: true, children: [], fields: fields.filter(([, v]) => v).map(([key, value]) => ({ key, value: String(value) })) };
  });
}

// Load a trace document's bibliography (if any) into its sources, in place. Entries replace inline sources
// with the same id. Returns the number of entries loaded.
export async function loadBibliography(doc, baseDir, extraPath) {
  const paths = [doc.bibliography, extraPath].flat().filter(Boolean);
  let count = 0;
  for (const p of paths) {
    const { resolve } = await import('node:path');
    const text = await readFile(resolve(baseDir, p), 'utf8');
    const sources = bibToSources(parseBib(text));
    const byId = new Map((doc.sources || []).map((s) => [s.id, s]));
    for (const s of sources) byId.set(s.id, s);
    doc.sources = [...byId.values()];
    count += sources.length;
  }
  return count;
}
