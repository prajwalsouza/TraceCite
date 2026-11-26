#!/usr/bin/env node
// Validate a trace data file against the schema's rules, with no dependencies.
//   node validate-trace.mjs <file.trace.json>
// Exits 1 on errors. Warnings (for example a long quote) do not fail.
import { readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function validate(doc, baseDir = '.') {
  const errors = [], warnings = [];
  const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
  if (doc?.format === undefined) warn('format is missing; declare "format": "tracecite/1.0"');
  else if (typeof doc.format !== 'string' || !/^tracecite\/1\.\d+(?:\.\d+)?$/.test(doc.format)) err('format must name TraceCite major version 1 (for example tracecite/1.0)');
  if (doc?.version !== 2) err('version must be 2');
  // 1.1: "changes", the edit history. A document that records edits declares 1.1 (or a later 1.x).
  if (doc?.changes !== undefined) {
    const minor = +((/^tracecite\/1\.(\d+)/.exec(doc.format || '') || [])[1] ?? -1);
    if (minor < 1) err('changes (the edit history) needs "format": "tracecite/1.1"');
    if (!Array.isArray(doc.changes)) err('changes must be an array');
    else {
      const seen = new Set(), ID = /^[A-Za-z0-9_.:-]{1,160}$/;
      doc.changes.forEach((c, i) => {
        const at = `changes[${i}]`;
        if (!c || typeof c !== 'object') return err(`${at} must be an object`);
        if (!ID.test(c.id || '')) err(`${at}: id is not valid`); else if (seen.has(c.id)) err(`${at}: duplicate change id ${c.id}`); else seen.add(c.id);
        if (typeof c.at !== 'string' || isNaN(Date.parse(c.at))) err(`${at}: at must be an ISO date-time`);
        if (!['text', 'insert', 'remove'].includes(c.op)) err(`${at}: op must be text, insert or remove`);
        if (!ID.test(c.block || '')) err(`${at}: block must be a block id`);
        if (c.op === 'text' && (typeof c.before !== 'string' || typeof c.after !== 'string')) err(`${at}: a text change needs before and after`);
        if ((c.op === 'insert' || c.op === 'remove') && (!c.value || c.value.id !== c.block)) err(`${at}: an ${c.op} change needs the block as value`);
        if (c.version !== undefined && !(Number.isInteger(c.version) && c.version >= 1)) err(`${at}: version must be a whole number from 1`);
      });
    }
  }
  if (typeof doc?.title !== 'string' || !doc.title.trim()) err('title is required');
  for (const k of ['tagTree', 'blocks', 'sources']) if (!Array.isArray(doc?.[k])) err(`${k} must be an array`);
  if (errors.length) return { errors, warnings };
  const tagIds = new Set();
  (function tags(list, depth) { for (const t of list) { if (!/^[a-zA-Z0-9_-]{1,128}$/.test(t.id || '')) err(`tag id "${t.id}" is not valid`); if (tagIds.has(t.id)) err(`duplicate tag id ${t.id}`); tagIds.add(t.id); if (!t.name) err(`tag ${t.id} has no name`); if (!Array.isArray(t.children)) err(`tag ${t.id} needs a children array`); else tags(t.children, depth + 1); } })(doc.tagTree, 0);
  // Connected highlights: "slot" 1–5 and "symbols" (TeX strings) on tags; span tags and links in text (spans.mjs).
  (function slots(list) { for (const t of list || []) {
    if (t.slot !== undefined && !(Number.isInteger(t.slot) && t.slot >= 1 && t.slot <= 5)) err(`tag ${t.id}: slot must be a whole number from 1 to 5`);
    if (t.symbols !== undefined && !(Array.isArray(t.symbols) && t.symbols.every((s) => typeof s === 'string' && s.trim()))) err(`tag ${t.id}: symbols must be a list of TeX strings`);
    slots(t.children); } })(doc.tagTree);
  const { scan } = await import('./spans.mjs');
  const QUOTED = /^(Exact quote|Quote context|Quote location|Bib data|APA reference|APA citation)/;
  const TYPES = new Set(['section', 'paragraph', 'sentence', 'citation', 'reference', 'note', 'figure', 'table', 'table-row', 'table-cell']);
  const ids = new Set(), sourceIds = new Set(doc.sources.map((s) => s.id));
  const get = (b, k) => b.fields?.find((f) => f.key === k)?.value;
  const checkTags = (tags, where) => {
    for (const t of tags || []) if (!tagIds.has(t)) err(`${where}: tag "${t}" is not in tagTree`);
  };
  const assetChecks = [];
  (function walk(list, parent) {
    for (const b of list) {
      const where = `${b.type || '?'} ${b.id || '?'}`;
      for (const k of ['id', 'type', 'text', 'tags', 'fields', 'children']) if (b[k] === undefined) err(`${where}: missing ${k}`);
      if (ids.has(b.id)) err(`duplicate block id ${b.id}`); ids.add(b.id);
      if (!TYPES.has(b.type)) err(`${where}: unknown type`);
      // Trace refuses to draw a page whose blocks carry a tag missing from tagTree.
      for (const t of b.tags || []) if (!tagIds.has(t)) err(`${where}: tag "${t}" is not in tagTree (Trace will not draw the page)`);
      for (const f of b.fields || []) if (typeof f.key !== 'string' || typeof f.value !== 'string') err(`${where}: fields must be {key, value} strings`);
      for (const text of [b.text, ...(b.fields || []).filter((f) => !QUOTED.test(f.key)).map((f) => f.value)]) {
        const found = scan(text);
        for (const s of found.spans) if (!tagIds.has(s.tag)) err(`${where}: span tag "${s.tag}" ([${s.text}]{.${s.tag}}) is not in tagTree`);
        for (const l of found.links) if (!l.kind) warn(`${where}: link "${l.url}" is not allowed (use https://, http://, mailto: or #/at/<block id>); it shows as plain text`);
          else if (l.kind === 'internal' && !JSON.stringify(doc.blocks).includes(`"id":"${l.url.slice(5)}"`)) warn(`${where}: internal link ${l.url} names no block`);
      }
      // LaTeX: \( … \) inline, \[ … \] or $$ … $$ display. Unbalanced delimiters show as raw TeX.
      for (const [label, text] of [['text', b.text], ...(b.fields || []).map((f) => [`field "${f.key}"`, f.value])]) {
        if (typeof text !== 'string') continue;
        const count = (re) => (text.match(re) || []).length;
        if (count(/\\\(/g) !== count(/\\\)/g)) warn(`${where}: ${label} has unbalanced \\( \\) math delimiters`);
        if (count(/\\\[/g) !== count(/\\\]/g)) warn(`${where}: ${label} has unbalanced \\[ \\] math delimiters`);
        if (count(/\$\$/g) % 2) warn(`${where}: ${label} has an odd number of $$ math delimiters`);
      }
      const src = get(b, 'Source ID'); if (src && !sourceIds.has(src)) err(`${where}: Source ID "${src}" has no source`);
      if (b.type === 'table-row' && parent?.type !== 'table') err(`${where}: table-row must sit inside a table`);
      if (b.type === 'table-cell' && parent?.type !== 'table-row') err(`${where}: table-cell must sit inside a table-row`);
      if (b.type === 'figure') {
        const raw = get(b, 'Assets');
        if (raw) { try { for (const a of JSON.parse(raw)) assetChecks.push([where, a]); } catch { err(`${where}: Assets must be a JSON array string`); } }
        if (!raw && !get(b, 'Video asset') && !get(b, 'Viz') && !get(b, 'Interactive')) warn(`${where}: a figure without Assets or Video asset`);
      }
      walk(b.children || [], b);
    }
  })(doc.blocks, null);
  const seenSources = new Set();
  for (const s of doc.sources) {
    if (seenSources.has(s.id)) err(`duplicate source id ${s.id}`);
    seenSources.add(s.id);
    checkTags(s.tags, `source ${s.id}`);
    if (s.type !== 'source') err(`source ${s.id}: type must be "source"`);
    for (const f of s.fields || []) {
      if (typeof f.key !== 'string' || typeof f.value !== 'string') err(`source ${s.id}: fields must be {key, value} strings`);
      if (/^Quote tags(?: \d+)?$/.test(f.key) && typeof f.value === 'string') checkTags(f.value.split(';').map((t) => t.trim()).filter(Boolean), `source ${s.id}: ${f.key}`);
    }
    for (const f of s.fields || []) if (/^Exact quote/.test(f.key) && f.value && f.value.split(/\s+/).length > 40) warn(`source ${s.id}: ${f.key} is over 40 words`);
    const quotes = (s.fields || []).filter((f) => /^Exact quote/.test(f.key) && f.value);
    for (const q of quotes) { const loc = q.key.replace('Exact quote', 'Quote location'); if (!get(s, loc)) warn(`source ${s.id}: ${q.key} has no ${loc}`); }
  }
  for (const [where, a] of assetChecks) { if (!/^(?:images|figures)\/[A-Za-z0-9_./-]+\.(png|jpg|jpeg|svg|pdf)$/i.test(a) || a.includes('..')) { err(`${where}: asset "${a}" must be images/… or figures/… (png, jpg, svg, pdf)`); continue; } try { await stat(join(baseDir, 'assets', 'manuscript', a)); } catch { warn(`${where}: asset file assets/manuscript/${a} not found next to the data`); } }
  if (doc.parameters) (function params(list) { for (const p of list) { if (!p.id || !p.name) err('every parameter needs id and name'); if (p.measure && typeof p.measure === 'string' && !['characters', 'words', 'citations', 'quotes'].includes(p.measure)) err(`parameter ${p.id}: unknown measure ${p.measure}`); if (p.plot && !['histogram', 'strip', 'counts', 'categories'].includes(p.plot)) err(`parameter ${p.id}: unknown plot ${p.plot}`); params(p.children || []); } })(doc.parameters);
  // Trace's rule: a quote should carry its context, the full passage it sits in, and that context must contain it.
  for (const src of doc.sources || []) {
    const F = Object.fromEntries((src.fields || []).map((f) => [f.key, f.value]));
    for (const [k, q] of Object.entries(F)) {
      const m = k.match(/^Exact quote(?: (\d+))?$/); if (!m || !q) continue;
      const ctx = F['Quote context' + (m[1] ? ' ' + m[1] : '')];
      const withheld = F['Quote context withheld' + (m[1] ? ' ' + m[1] : '')];
      if (!ctx?.trim() && !withheld?.trim()) err(`source ${src.id}: ${k} has no context (add the full passage it sits in, or say why it is withheld)`);
      else if (ctx && !ctx.includes(q)) err(`source ${src.id}: the context of ${k} does not contain the quote verbatim`);
    }
  }
  if (doc.flow?.families) for (const f of doc.flow.families) if (!doc.tagTree.some((t) => t.id === f)) err(`flow.families: "${f}" is not a root tag`);
  return { errors, warnings };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const file = resolve(process.argv[2] || '');
  const doc = JSON.parse(await readFile(file, 'utf8'));
  // A BibTrace bibliography ("bibliography": "refs.bib") supplies the sources; load it before checking links.
  if (doc.bibliography) { const { loadBibliography } = await import('./bibtrace.mjs'); const n = await loadBibliography(doc, dirname(file)); console.log(`Bibliography: ${n} entries.`); }
  { const { ensureEnvironmentTags } = await import('./environments.mjs'); ensureEnvironmentTags(doc); }
  const { errors, warnings } = await validate(doc, dirname(file));
  for (const w of warnings) console.log('warning: ' + w);
  for (const e of errors) console.log('error: ' + e);
  console.log(errors.length ? `${errors.length} errors` : `Valid trace data (${warnings.length} warnings).`);
  process.exit(errors.length ? 1 : 0);
}
