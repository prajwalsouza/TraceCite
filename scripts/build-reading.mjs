#!/usr/bin/env node
// Build one self-contained, reading-only Trace page from a trace data file.
//
//   node build-reading.mjs --data trace.json --out paper.html [--data-url paper.json] [--trace <dir>] [--math on|off] [--math-tags off] [--bib refs.bib]
//
// By default the data is baked into the page, so the file works on its own (even from file://).
// --data-url writes the data as a JSON file next to the page and the page fetches it when served.
// Loading never spins forever: scripts/boot.js shows a plain message if nothing draws in 10 s.
//
// The page runs Trace's own scripts and styles, inlined, so every reading
// interaction (tag tree hover and pin, sentence hover outline, click-to-open
// evidence, citation links, sidebar drawer, search) behaves exactly as in Trace.
// Only the Reading view is reachable. Fonts and figure images are embedded.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, dirname, extname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, i, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[i + 1]]] : pairs), []));
// Trace's reading code is vendored into trace/.
const traceDir = resolve(args.trace || join(here, '..', 'trace'));
const dataPath = resolve(args.data || join(here, '..', 'examples', 'outliners.trace.json'));
const outPath = resolve(args.out || join(here, '..', 'references', 'outliners-reading.html'));

// Scripts the reading view needs, in Trace's load order. Revision patches,
// the work plan, result traces and shared-server hooks are left out.
const SCRIPTS = ['structure.js', 'source-passages.js', 'provided-context-data.js', 'provided-context.js', 'online-context-data.js', 'online-context.js', 'source-context-data.js', 'source-context.js', 'table-blocks.js', 'core.js', 'reading-focus.js', 'table-evidence-data.js', 'table-evidence.js', 'table-evidence-panel.js', 'reading-peek.js', 'document-actions.js', 'app.js'];
const STYLES = ['styles.css', 'paper-typography.css', 'floating-navigation.css', 'reading-rails.css', 'document-actions.css', 'table-blocks.css'];
const MIME = { '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif' };

const read = (name) => readFile(join(traceDir, name), 'utf8');
async function dataUri(path) {
  const ext = extname(path).toLowerCase();
  if (!MIME[ext]) return null;
  try { if ((await stat(path)).size > 4e6) return null; } catch { return null; }
  return `data:${MIME[ext]};base64,${(await readFile(path)).toString('base64')}`;
}

// 1. The trace data. Keep only what the reading view reads.
const raw = JSON.parse(await readFile(dataPath, 'utf8'));
// Sources can live in a BibTrace bibliography: standard BibTeX plus trace-* evidence fields (scripts/bibtrace.mjs).
// "bibliography": "refs.bib" in the data (relative to it), or --bib refs.bib, loads it before validation.
{ const { loadBibliography } = await import('./bibtrace.mjs');
  const n = await loadBibliography(raw, dirname(dataPath), args.bib);
  if (n) console.log(`Bibliography: ${n} entries.`); }
// Structural tags carry their own schema: env-lemma makes a paragraph a lemma (scripts/environments.mjs).
// Their tag family is added before validation so documents only need the tags.
{ const { ensureEnvironmentTags } = await import('./environments.mjs'); ensureEnvironmentTags(raw); }
// Check the data against the trace schema first (schema/tracecite-1.0.schema.json).
{ const { validate } = await import('./validate-trace.mjs');
  const { errors, warnings } = await validate(raw, dirname(dataPath));
  for (const w of warnings) console.warn('warning: ' + w);
  if (errors.length) { for (const e of errors) console.error('error: ' + e); process.exit(1); } }
const KEEP = ['format', 'version', 'id', 'title', 'subtitle', 'authors', 'affiliations', 'date', 'revision', 'keywords', 'doi', 'license', 'note', 'updatedAt', 'tagTree', 'parameters', 'flow', 'blocks', 'sources', 'documentStructure', 'appliedOutlineRevisions', 'manuscript'];
const trace = Object.fromEntries(KEEP.filter((k) => raw[k] !== undefined).map((k) => [k, raw[k]]));
// Mathematics: parse the TeX and add the variables and equation types to the tag tree (scripts/math-tags.mjs).
// The data file is not changed. "mathTags": {"off": true} in the data, or --math-tags off, leaves it out.
let mathIndex = null, mathTones = {};
if (args['math-tags'] !== 'off') {
  const { addMathTags } = await import('./math-tags.mjs');
  trace.tagTree = JSON.parse(JSON.stringify(trace.tagTree));
  trace.blocks = JSON.parse(JSON.stringify(trace.blocks));
  trace.mathTags = raw.mathTags;
  const added = addMathTags(trace);
  delete trace.mathTags;
  if (added) { mathIndex = added.index; mathTones = added.tones || {}; const c = added.counts; console.log(`Math tags: ${c.variables} variables, ${c.indices} indices, ${c.sets} number sets, ${c.types} equation types, across ${c.sentences} blocks.`); }
}
// Mathematical environments: run-in headings for theorem, lemma, …, proof blocks (scripts/environments.mjs).
let envIndex = null;
{ const { addEnvironments } = await import('./environments.mjs');
  const added = addEnvironments(trace);
  if (added) { envIndex = added.index; console.log(`Environments: ${added.count} (theorems, lemmas, proofs …).`); } }
// Provenance: who added each part of the trace, how, and who checked it (scripts/provenance.mjs).
{ const { addProvenance } = await import('./provenance.mjs');
  const added = addProvenance(trace);
  if (added) console.log(`Provenance: ${added.people} people or agents, ${added.ways} ways in.`); }
// Comments: note blocks with a "Comment by" field, children of what they are about (scripts/comments.mjs).
{ const { addComments } = await import('./comments.mjs');
  const added = addComments(trace);
  if (added) console.log(`Comments: ${added.total} (${added.people} people${added.unsigned ? ', ' + added.unsigned + ' unsigned' : ''}).`); }
// Cross-references: "Theorem 4.1", "Section 6.3", "(3.1)" link to where they are stated, and sentences that
// state or recall results are tagged (scripts/crossrefs.mjs). "crossRefs": {"off": true} in the data leaves it out.
let xrefIndex = null;
{ const { addCrossRefs } = await import('./crossrefs.mjs');
  trace.crossRefs = raw.crossRefs;
  const added = addCrossRefs(trace);
  delete trace.crossRefs;
  if (added) { xrefIndex = added.index; console.log(`Cross-references: ${added.counts.labels} labels, mentioned in ${added.counts.mentioning} sentences.`); } }
// Figures: Trace builds 'assets/manuscript/<path>' from each figure's Assets and
// Video poster fields. Embed a resized copy of each so the file stands alone.
const assets = {};
let scratch;
process.on('exit', () => { if (scratch) rmSync(scratch, { recursive: true, force: true }); });
async function embedImage(relative) {
  const url = 'assets/manuscript/' + relative;
  if (assets[url] || !/\.(png|jpe?g|svg)$/i.test(relative)) return;
  // Figures may sit next to the data file (assets/manuscript/...) or in the Trace checkout.
  let file = null;
  for (const base of [dirname(dataPath), traceDir]) { try { await stat(join(base, url)); file = join(base, url); break; } catch {} }
  if (!file) return;
  if (/\.svg$/i.test(file)) { assets[url] = `data:image/svg+xml;base64,${(await readFile(file)).toString('base64')}`; return; }
  let source = file, type = MIME[extname(file).toLowerCase()];
  try { // macOS sips: longest side 1600 px, JPEG. Falls back to the original.
    scratch ||= mkdtempSync(join(dirname(outPath), 'zz-trace-reading-'));
    const out = join(scratch, Object.keys(assets).length + '.jpg');
    execFileSync('sips', ['-Z', '1600', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', file, '--out', out], { stdio: 'ignore' });
    source = out; type = 'image/jpeg';
  } catch {}
  assets[url] = `data:${type};base64,${(await readFile(source)).toString('base64')}`;
}
const walkBlocks = (blocks, fn) => (blocks || []).forEach((b) => { fn(b); walkBlocks(b.children, fn); });
const fieldOf = (b, k) => b.fields?.find((f) => f.key === k)?.value || '';
const pending = [];
walkBlocks(trace.blocks, (b) => {
  try { for (const a of JSON.parse(fieldOf(b, 'Assets') || '[]')) if (typeof a === 'string') pending.push(a); } catch {}
  if (fieldOf(b, 'Video poster')) pending.push(fieldOf(b, 'Video poster'));
});
for (const relative of pending) await embedImage(relative);
const assetCache = { size: Object.keys(assets).length };
// Tag names are shown as plain words: a leading '#' (Trace's mark for structural
// roles) adds nothing in a tag tree, so it is dropped and the first letter capitalised.
(function clean(list) { for (const t of list || []) { if (typeof t.name === 'string') { const n = t.name.replace(/^#\s*/, ''); t.name = n.charAt(0).toUpperCase() + n.slice(1); } clean(t.children); } })(trace.tagTree);
const json = JSON.stringify(trace);
const hash = createHash('sha256').update(json).digest('hex').slice(0, 12);

// 2. Styles, with fonts inlined.
let css = '';
for (const name of STYLES) css += `\n/* ${name} */\n` + (await read(name));
for (const match of [...new Set(css.match(/url\('assets\/[^']+'\)/g) || [])]) {
  const uri = await dataUri(join(traceDir, match.slice(5, -2)));
  if (uri) css = css.split(match).join(`url('${uri}')`);
}
css += `
/* Reading-only edition: every other view and all editing controls are removed. */
@media (max-width:760px){
  /* Phone: keep Trace's look, tighten the vertical rhythm for a narrow column. */
  .document-header{padding-bottom:4px!important;min-height:0!important}
  .document-header h1{font-size:clamp(28px,8.4vw,34px)!important;line-height:1.12!important}
  #outline>.reading-group:first-child>.reading-section{margin-top:14px!important}
  .apa-paragraph>p,.reading-list{line-height:1.78!important}
  .apa-sentence{-webkit-tap-highlight-color:transparent}
}
/* No paper card: the text sits on the page. Settings → Reading → Paper card brings it back. */
main{background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important}
.view-switch,#fold-all,.project-notes,#sources-nav,#new-paragraph,#document-actions-toggle,#document-actions-panel,#revision-notice,.help p[data-edit-only],.apa-reference>button,#view-caption:empty{display:none!important}
`;

css += '\n/* themes.css */\n' + (await readFile(join(here, 'themes.css'), 'utf8'));

// 3. Markup: Trace's own index.html, with external files replaced by inline ones.
let html = await read('index.html');
html = html.replace(/\s*<link rel="stylesheet"[^>]*>/g, '').replace(/\s*<script src="[^"]*"[^>]*><\/script>/g, '');
const safe = (text) => text.replace(/<\/(script)/gi, '<\\/$1');
// Data is baked into the page by default. With --data-url name.json the page
// fetches that file instead (written next to the page), which needs a server.
const dataUrl = args['data-url'];
const deferType = dataUrl ? ' type="text/x-outline-deferred"' : '';
let scripts = `<script>/* boot */\n${safe(await readFile(join(here, 'boot.js'), 'utf8'))}\n</script>\n`;
scripts += dataUrl
  ? `<script id="trace-data" type="application/json" data-src="${dataUrl.replace(/"/g, '&quot;')}"></script>\n`
  : `<script id="trace-data" type="application/json">${json.replace(/</g, '\\u003c')}</script>\n`;
scripts += `<script id="trace-assets" type="application/json">${JSON.stringify(assets)}</script>\n`;
if (envIndex) scripts += `<script id="trace-env-index" type="application/json">${JSON.stringify(envIndex).replace(/</g, '\\u003c')}</script>\n`;
if (xrefIndex) scripts += `<script id="trace-xref-index" type="application/json">${JSON.stringify(xrefIndex).replace(/</g, '\\u003c')}</script>\n`;
if (mathIndex) scripts += `<script id="trace-math-index" type="application/json">${JSON.stringify(mathIndex).replace(/</g, '\\u003c')}</script>\n`;
scripts += `<script>${dataUrl ? '' : "globalThis.OUTLINE_SEED=JSON.parse(document.getElementById('trace-data').textContent);"}globalThis.TRACE_PAPER={storageKey:'trace-reading-${hash}'};{const u=new URL(location.href);if(u.searchParams.has('view')){u.searchParams.delete('view');history.replaceState(null,'',u);}}</script>\n`;
scripts += `<script>{const m=JSON.parse(document.getElementById('trace-assets').textContent);globalThis.__traceAsset=u=>m[u]||u;}</script>\n`;
scripts += `<script>globalThis.__traceExtraTones=${JSON.stringify(mathTones)};</script>\n`;
const add = (label, code) => { scripts += `<script${deferType}>/* ${label} */\n${safe(code)}\n</script>\n`; };
for (const name of SCRIPTS) {
  let code = await read(name);
  // Resolve figure paths to the embedded copies before the browser requests them.
  // Citation styles must patch Trace's citation functions before app.js draws the paper.
  // Extra tag tones (math variable groups) join Trace's own root tones.
  // A source with many quotes, each with its context, notes and provenance, needs more than Trace's 100 fields.
  if (name === 'core.js') code = code.replace('b.fields.length > 100', 'b.fields.length > 4000');
  // Comments live in the outline, never in the prose.
  if (name === 'structure.js') code = code.replace("if(b.type==='note'){", () => "if(b.type==='note'&&!(b.fields||[]).some(f=>f.key==='Comment by')){");
  if (name === 'reading-peek.js' && Object.keys(mathTones).length) code = code.replace('const roots={', () => 'const roots={...' + JSON.stringify(mathTones) + ',');
  if (name === 'app.js') { add('cite styles', await readFile(join(here, 'cite-styles.js'), 'utf8')); add('citations', await readFile(join(here, 'citations.js'), 'utf8')); add('long documents', await readFile(join(here, 'trace-window.js'), 'utf8')); }
  if (name === 'app.js') code = code.replace(/'assets\/manuscript\/'\s*\+\s*(\w+)/g, (_, v) => `__traceAsset('assets/manuscript/'+${v})`).replace(/video\.src=media;/, "video.src='';video.hidden=true;").replace("document.title = 'Trace — ' + doc.title", 'document.title = doc.title').replace("  window.addEventListener('pagehide', save);", "  window.__traceRender = () => render();\n  window.addEventListener('pagehide', save);")
    .replace("C.readingTree(doc).forEach(n=>emit(n,fragment));", "(window.__traceWindow ? window.__traceWindow.tree(C.readingTree(doc)) : C.readingTree(doc)).forEach(n=>emit(n,fragment));")
    .replace("function emit(n,container){\n      if(query&&!visibleNode(n))return;", "function emit(n,container){\n      if(n.kind==='placeholder'){container.append(window.__traceWindow.placeholder(n));return;}\n      if(query&&!visibleNode(n))return;");
  if (name === 'app.js' && !(code.includes('__traceWindow.tree') && code.includes("n.kind==='placeholder'") && code.includes('__traceRender'))) throw new Error('Trace app.js changed: the long-document hooks did not apply');
  add(name, code);
}
for (const [label, file] of [['reading-only', 'reading-only.js'], ['params', 'params.js'], ['flow', 'flow.js'], ['tag icons', 'tag-icons.js'], ['settings', 'settings.js'], ['media', 'media.js'], ['search', 'search.js'], ['rich text', 'rich-text.js'], ['environments', 'environments.js'], ['cross-references', 'crossref.js'], ['trace part', 'trace-part.js'], ['contents', 'trace-toc.js'], ['front matter', 'front-matter.js']]) add(label, await readFile(join(here, file), 'utf8'));
scripts += `<script>__outlineBoot.start();</script>\n`;
if (dataUrl) await writeFile(resolve(dirname(outPath), dataUrl), json);
// The saved theme is applied before the page draws, so there is no flash.
const early = `<script>try{const p=JSON.parse(localStorage.getItem('trace-reading-prefs')||'{}'),t=p.theme||'sage',d=document.documentElement;d.dataset.theme=t;const pal=(p.palettes||{})[t];if(pal)d.dataset.palette=pal;if(['blackboard:slate','book:night','whiteboard:glass'].includes(t+':'+pal))d.classList.add('dark');if(p.eqHover===false)d.classList.add('eq-hover-off');const F={gentium:"'Gentium Book Plus',Charter,Georgia,serif",libertinus:"'Libertinus Serif',Georgia,serif",vollkorn:"'Vollkorn',Georgia,serif",literata:"'Literata',Georgia,serif",baskerville:"'Libre Baskerville',Georgia,serif",garamond:"'EB Garamond',Georgia,serif",atkinson:"'Atkinson Hyperlegible',system-ui,sans-serif",poppins:"'Poppins',system-ui,sans-serif",system:"system-ui,-apple-system,sans-serif"};if(F[p.font]){d.dataset.font=p.font;d.style.setProperty('--font-user',F[p.font]);}if(t!=='sage')d.classList.add('house');if(['matte','pitch','textbook-dark'].includes(t))d.classList.add('dark');if(p.side==='shut')d.classList.add('side-shut');}catch{}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Literata:opsz,wght@7..72,500;7..72,600&display=swap">`;
// LaTeX: \( … \) or $ … $ inline, \[ … \] or $$ … $$ display, rendered by MathJax (scripts/math.js).
// Added automatically when the data contains math; --math on forces it, --math off leaves it out.
const mathFlag = args.math || 'auto';
const useMath = mathFlag === 'on' || (mathFlag !== 'off' && /\\\(|\\\[|\$\$|(?<!\\)\$[^$\s][^$\n]*\$/.test(json));
const math = useMath ? `<script>/* math */\n${safe(await readFile(join(here, 'math.js'), 'utf8'))}\n</script>
<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js"></script>
` : '';
html = html.replace('</head>', () => `${early}\n<style>${css}</style>\n${math}\n</head>`).replace('</body>', () => `${scripts}</body>`);
// Skeleton: a shimmering outline of the paper until Trace draws the real one
// (Trace replaces both the title and the outline when it first renders).
const line = (w, cls = 'sk-line') => `<span class="sk ${cls}" style="width:${w}%"></span>`;
const para = (ws) => `<div class="sk-para">${ws.map((w) => line(w)).join('')}</div>`;
const skeleton = `<div class="sk-paper" aria-hidden="true">${line(34, 'sk-head')}${para([100, 97, 93, 58])}${para([98, 95, 71])}${line(41, 'sk-head')}${para([99, 94, 96, 88, 46])}${line(29, 'sk-head')}${para([97, 92, 63])}</div>`;
html = html.replace('<h1 id="document-title" spellcheck="false"></h1>', () => `<h1 id="document-title" spellcheck="false"><span class="sk sk-title" aria-hidden="true"></span></h1>`)
  .replace('<div id="outline" aria-label="Document blocks"></div>', () => `<div id="outline" aria-label="Document blocks" aria-busy="true">${skeleton}</div>`);
// Labels that Trace hard-codes for the interest paper come from the data instead.
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const label = raw.eyebrow || args.label || 'An outline';
html = html.replace(/THE INTEREST PAPER|A TRACE OUTLINE/, () => esc(label.toUpperCase())).replace('<span>Interest paper</span>', () => `<span>${esc(label)}</span>`).replace(' The interest paper</div>', () => ` ${esc(trace.title)}</div>`);
html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${trace.title.replace(/[<&]/g, '')}</title>`);

await writeFile(outPath, html);
console.log(`Wrote ${outPath} (${(html.length / 1e6).toFixed(2)} MB, ${assetCache.size} images, data ${hash}).`);
