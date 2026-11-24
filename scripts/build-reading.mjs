#!/usr/bin/env node
// Build one self-contained, reading-only Trace page from a trace data file, or the standalone reader.
//
//   node build-reading.mjs --data trace.json --out paper.html [--zip paper.trace.zip] [--data-url paper.trace.zip]
//                          [--bib refs.bib] [--label "An essay"] [--by "Name"] [--note "What changed"] [--history old.trace.zip]
//                          [--trace <dir>] [--math off]
//   node build-reading.mjs --reader --out trace-reader.html
//
// The builder checks the data, then packs it as a TraceCite package (.trace.zip: manifest.json, the trace
// data, its BibTrace .bib files, figure assets and interactive scripts; see package.js). The page carries
// that package and prepares it in the browser, so a built page, the standalone reader and the sidebar's
// Export all use the same format and the same code.
//   default       the package is baked into the page (base64), so one file works on its own, even from disk;
//   --zip f       also write the package to f;
//   --data-url f  write the package to f next to the page and fetch it when served (needs a web server);
//   --reader      no document: the page asks for a .trace.zip (drop, pick, or ?src=URL).
// Loading never spins forever: scripts/boot.js shows a plain message if nothing draws in 10 s.
//
// The page runs Trace's own scripts and styles, inlined, so every reading interaction (tag tree hover and
// pin, sentence hover outline, click-to-open evidence, citation links, sidebar drawer, search) behaves
// exactly as in Trace. Only the Reading view is reachable. Fonts are embedded.
import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname, extname, join, basename, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
await import('./zip.js');
const { TraceZip } = globalThis;
const argv = process.argv.slice(2);
const args = Object.fromEntries(argv.reduce((pairs, value, i, all) => (value.startsWith('--') ? [...pairs, [value.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]] : pairs), []));
const reader = !!args.reader;
// Trace's reading code is vendored into this skill (see scripts/vendor-trace.mjs).
const traceDir = resolve(args.trace || join(here, '..', 'trace'));
const dataPath = reader ? null : resolve(args.data || join(here, '..', 'examples', 'outliners.trace.json'));
const outPath = resolve(args.out || (reader ? 'trace-reader.html' : join(here, '..', 'references', 'outliners-reading.html')));

// Scripts the reading view needs, in Trace's load order. Revision patches,
// the work plan, result traces and shared-server hooks are left out.
const SCRIPTS = ['structure.js', 'source-passages.js', 'provided-context-data.js', 'provided-context.js', 'online-context-data.js', 'online-context.js', 'source-context-data.js', 'source-context.js', 'table-blocks.js', 'core.js', 'reading-focus.js', 'table-evidence-data.js', 'table-evidence.js', 'table-evidence-panel.js', 'reading-peek.js', 'document-actions.js', 'app.js'];
const STYLES = ['styles.css', 'paper-typography.css', 'floating-navigation.css', 'reading-rails.css', 'document-actions.css', 'table-blocks.css'];
const MIME = { '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif' };
const MATHJAX = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js';
const read = (name) => readFile(join(traceDir, name), 'utf8');
const own = (name) => readFile(join(here, name), 'utf8');
async function dataUri(path) {
  const ext = extname(path).toLowerCase();
  if (!MIME[ext]) return null;
  try { if ((await stat(path)).size > 4e6) return null; } catch { return null; }
  return `data:${MIME[ext]};base64,${(await readFile(path)).toString('base64')}`;
}

// The preparation modules (written for Node) bundled for the browser as TracePrep: imports become local
// bindings, exports become each module's return value, Node-only lines are dropped.
async function prepBundle() {
  const MODS = { environments: 'environments.mjs', mathTags: 'math-tags.mjs', provenance: 'provenance.mjs', comments: 'comments.mjs', crossrefs: 'crossrefs.mjs', spans: 'spans.mjs', bibtrace: 'bibtrace.mjs' };
  const byFile = Object.fromEntries(Object.entries(MODS).map(([k, f]) => [f, k]));
  let out = 'globalThis.TracePrep = (() => {\n  const __m = {};\n';
  for (const [key, file] of Object.entries(MODS)) {
    let code = await own(file);
    const names = [...code.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
    code = code.replace(/^import\s*\{([^}]*)\}\s*from\s*'\.\/([^']+)';?\s*$/gm, (_, list, f) => {
      if (f === 'cite-styles.js') return '';
      if (!byFile[f]) throw new Error(`${file}: cannot bundle import from ${f}`);
      return `const {${list.replace(/\s+as\s+/g, ': ')}} = __m.${byFile[f]};`;
    })
      .replace(/^import\s.*$/gm, '')
      .replace(/^.*import\.meta.*$/gm, '')
      .replace(/require\('\.\/cite-styles\.js'\)/g, 'globalThis.TraceCiteStyles')
      .replace(/^export\s+/gm, '');
    out += `  __m.${key} = (() => {\n${code}\n  return { ${names.join(', ')} };\n  })();\n`;
  }
  return out + '  return __m;\n})();\n';
}

// ---------- 1. The document: check it, then pack it ----------
let packageBytes = null, packageName = '', title = 'TraceCite reader';
if (!reader) {
  const dataText = await readFile(dataPath, 'utf8');
  const raw = JSON.parse(dataText);
  title = raw.title || title;
  const baseDir = dirname(dataPath);
  // Check a copy with its bibliography and environment tags loaded, exactly as the page will see it.
  {
    const check = JSON.parse(dataText);
    const { loadBibliography } = await import('./bibtrace.mjs');
    const n = await loadBibliography(check, baseDir, args.bib === true ? undefined : args.bib);
    if (n) console.log(`Bibliography: ${n} entries.`);
    const { ensureEnvironmentTags } = await import('./environments.mjs'); ensureEnvironmentTags(check);
    const { validate } = await import('./validate-trace.mjs');
    const { errors, warnings } = await validate(check, baseDir);
    for (const w of warnings) console.warn('warning: ' + w);
    if (errors.length) { for (const e of errors) console.error('error: ' + e); process.exit(1); }
  }
  // Files in the package keep their paths relative to the data file, so the data needs no rewriting.
  const files = new Map();
  const inside = (rel, what) => {
    const norm = rel.split(/[\\/]/).join('/');
    if (isAbsolute(rel) || norm.split('/').includes('..')) throw new Error(`${what} "${rel}" must be a path inside the data file's folder to be packed.`);
    return norm.replace(/^\.\//, '');
  };
  const dataName = basename(dataPath);
  files.set(dataName, Buffer.from(dataText));
  const bibs = [];
  for (const p of [].concat(raw.bibliography || [])) { const rel = inside(p, 'Bibliography'); files.set(rel, await readFile(resolve(baseDir, p))); bibs.push(rel); }
  if (args.bib && args.bib !== true) { const rel = 'bibliography/' + basename(args.bib); files.set(rel, await readFile(resolve(args.bib))); bibs.push(rel); }
  // Figures named in Assets and Video poster fields: next to the data (assets/manuscript/…) or in the Trace checkout.
  const field = (b, k) => b.fields?.find((f) => f.key === k)?.value || '';
  const pending = new Set();
  (function walk(list) { for (const b of list || []) { try { for (const a of JSON.parse(field(b, 'Assets') || '[]')) if (typeof a === 'string') pending.add(a); } catch {} if (field(b, 'Video poster')) pending.add(field(b, 'Video poster')); walk(b.children); } })(raw.blocks);
  let images = 0;
  for (const relAsset of pending) {
    const url = 'assets/manuscript/' + relAsset;
    if (!MIME[extname(relAsset).toLowerCase()] || /\.ttf$/i.test(relAsset)) continue;
    for (const b of [baseDir, traceDir]) {
      try { const buf = await readFile(join(b, url)); if (buf.length > 8e6) console.warn(`warning: ${url} is ${(buf.length / 1e6).toFixed(1)} MB; consider a smaller copy.`); files.set(inside(url, 'Asset'), buf); images++; break; } catch {}
    }
  }
  // Interactive figures bring their components ("interactiveScripts"; "vizScripts" is the older name).
  const scripts = [...new Set([].concat(raw.interactiveScripts || [], raw.vizScripts || []))];
  for (const p of scripts) files.set(inside(p, 'Interactive script'), await readFile(resolve(baseDir, p)));
  // Version history: carried over from the last package built for this document (--zip file, or the page
  // being replaced); a new entry is added only when the content (data and .bib files) has changed.
  let previous = null;
  for (const from of [args.zip && args.zip !== true ? resolve(args.zip) : null, args.history && args.history !== true ? resolve(args.history) : null, outPath]) {
    if (!from) continue;
    try {
      let bytes = await readFile(from);
      if (/\.html?$/i.test(from)) { const m = bytes.toString('utf8').match(/<script id="trace-package"[^>]*>([^<]+)<\/script>/); if (!m) continue; bytes = Buffer.from(m[1], 'base64'); }
      const z = await TraceZip.read(new Uint8Array(bytes));
      const man = JSON.parse(TraceZip.text(z.get('manifest.json')));
      if (Array.isArray(man.history) && man.data === dataName) { previous = man; break; }
    } catch {}
  }
  await import('./package.js');
  const TP = globalThis.TracePackage;
  const stamp = [raw.updatedAt, raw.date].map((d) => d && new Date(d)).find((d) => d && !isNaN(d) && d.getFullYear() >= 1980) || new Date('2026-01-01T00:00:00Z');
  const pkgIn = { files: new Map([...files].map(([k, v]) => [k, new Uint8Array(v)])), dataPath: dataName, doc: raw, manifest: { bibliography: bibs, history: previous?.history || [] } };
  const { history, changed } = await TP.withHistory(pkgIn, { by: args.by && args.by !== true ? args.by : '', note: args.note && args.note !== true ? args.note : (previous ? '' : 'First package'), date: stamp.toISOString() });
  const manifest = TP.makeManifest(raw, dataName, pkgIn.files, history, { ...(args.label && args.label !== true ? { label: args.label } : {}), generator: 'TraceCite build-reading' });
  manifest.bibliography = bibs;
  // Reproducible: the same data and history always pack to the same bytes (entry times come from the last history date).
  packageBytes = await TP.zipFiles(manifest, pkgIn.files);
  packageName = dataName.replace(/(\.trace)?\.json$/i, '') + '.trace.zip';
  console.log(`Package: ${files.size + 1} files (${bibs.length} bibliography, ${images} images, ${manifest.interactiveScripts.length} interactive scripts), ${(packageBytes.length / 1e3).toFixed(0)} kB zipped, version ${manifest.version}${changed ? ' (new)' : ''}.`);
  // Prepare the package exactly as the page will (same code, run here), and check what Trace's reader insists on:
  // every tag has an id, a name and a children list. A failure here would otherwise only show in the browser.
  {
    await import('./cite-styles.js');
    new Function(await prepBundle())();
    const pkg = await TP.open([{ name: packageName, bytes: packageBytes }]);
    const ready = await TP.prepare(pkg);
    (function tags(list, where) { for (const t of list || []) { if (!t?.id || typeof t.name !== 'string' || !t.name.trim() || !Array.isArray(t.children)) throw new Error(`prepared tag ${t?.id || '?'} (${where}) needs an id, a name and a children list`); tags(t.children, t.id); } })(ready.trace.tagTree, 'tagTree');
    for (const n of ready.notes) console.warn('note: ' + n);
  }
  if (args.zip && args.zip !== true) { await writeFile(resolve(args.zip), packageBytes); console.log(`Wrote ${resolve(args.zip)}.`); }
}

// ---------- 2. Styles, with fonts inlined ----------
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
css += '\n/* themes.css */\n' + (await own('themes.css'));

// ---------- 3. Markup: Trace's own index.html, with external files replaced by inline ones ----------
let html = await read('index.html');
html = html.replace(/\s*<link rel="stylesheet"[^>]*>/g, '').replace(/\s*<script src="[^"]*"[^>]*><\/script>/g, '');
const safe = (text) => text.replace(/<\/(script)/gi, '<\\/$1');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Loaded first, run at once: the loader, the zip reader, citation styles and the preparation code.
let scripts = '';
for (const [label, code] of [['boot', await own('boot.js')], ['zip', await own('zip.js')], ['cite styles', await own('cite-styles.js')], ['prepare', await prepBundle()], ['package', await own('package.js')]]) scripts += `<script>/* ${label} */\n${safe(code)}\n</script>\n`;
if (packageBytes) {
  const src = args['data-url'] && args['data-url'] !== true ? args['data-url'] : '';
  if (src) { await writeFile(resolve(dirname(outPath), src), packageBytes); scripts += `<script id="trace-package" type="application/octet-stream" data-src="${esc(src)}"></script>\n`; }
  else scripts += `<script id="trace-package" type="application/octet-stream" data-name="${esc(packageName)}">${Buffer.from(packageBytes).toString('base64')}</script>\n`;
}
scripts += `<script>{const u=new URL(location.href);if(u.searchParams.has('view')){u.searchParams.delete('view');history.replaceState(null,'',u);}}globalThis.__traceAssetMap=globalThis.__traceAssetMap||{};globalThis.__traceAsset=u=>globalThis.__traceAssetMap[u]||u;globalThis.__traceExtraTones={};</script>\n`;
// Everything below waits for the package: boot.js runs these templates once it is prepared.
const add = (label, code, when) => { scripts += `<script type="text/x-outline-deferred"${when ? ` data-when="${when}"` : ''}>/* ${label} */\n${safe(code)}\n</script>\n`; };
for (const name of SCRIPTS) {
  let code = await read(name);
  // A source with many quotes, each with its context, notes and provenance, needs more than Trace's 100 fields.
  if (name === 'core.js') code = code.replace('b.fields.length > 100', 'b.fields.length > 4000');
  // Comments live in the outline, never in the prose.
  if (name === 'structure.js') code = code.replace("if(b.type==='note'){", () => "if(b.type==='note'&&!(b.fields||[]).some(f=>f.key==='Comment by')){");
  // Extra tag tones (math variable groups) join Trace's own root tones; they are known once the package is prepared.
  if (name === 'reading-peek.js') code = code.replace('const roots={', () => 'const roots={...(globalThis.__traceExtraTones||{}),');
  if (name === 'app.js') { add('citations', await own('citations.js')); add('long documents', await own('trace-window.js')); }
  // Resolve figure paths to the package's copies before the browser requests them.
  if (name === 'app.js') code = code.replace(/'assets\/manuscript\/'\s*\+\s*(\w+)/g, (_, v) => `__traceAsset('assets/manuscript/'+${v})`).replace(/video\.src=media;/, "video.src='';video.hidden=true;").replace("document.title = 'Trace — ' + doc.title", 'document.title = doc.title').replace("  window.addEventListener('pagehide', save);", "  window.__traceRender = () => render();\n  window.addEventListener('pagehide', save);")
    .replace("} catch { box.append(el('p', '', 'Figure assets are not available.')); }", "} catch { if (!(C.get(block, 'Interactive') || C.get(block, 'Viz'))) box.append(el('p', '', 'Figure assets are not available.')); }")
    .replace("C.readingTree(doc).forEach(n=>emit(n,fragment));", "(window.__traceWindow ? window.__traceWindow.tree(C.readingTree(doc)) : C.readingTree(doc)).forEach(n=>emit(n,fragment));")
    .replace("function emit(n,container){\n      if(query&&!visibleNode(n))return;", "function emit(n,container){\n      if(n.kind==='placeholder'){container.append(window.__traceWindow.placeholder(n));return;}\n      if(query&&!visibleNode(n))return;");
  if (name === 'app.js' && !(code.includes('__traceWindow.tree') && code.includes("n.kind==='placeholder'") && code.includes('__traceRender'))) throw new Error('Trace app.js changed: the long-document hooks did not apply');
  add(name, code);
}
for (const [label, file] of [['reading-only', 'reading-only.js'], ['params', 'params.js'], ['flow', 'flow.js'], ['tag icons', 'tag-icons.js'], ['settings', 'settings.js'], ['media', 'media.js'], ['search', 'search.js'], ['rich text', 'rich-text.js'], ['environments', 'environments.js'], ['cross-references', 'crossref.js'], ['trace part', 'trace-part.js'], ['contents', 'trace-toc.js'], ['front matter', 'front-matter.js'], ['tour', 'tour.js']]) add(label, await own(file));
// Interactives: run only when the document has an interactive figure; its own components follow (boot.js).
add('interactives', await own('viz.js'), 'viz');
// The in-app tour film (Settings → About → Watch the tour), started by tour.js with the open document's data.
scripts += `<script id="trace-tour-film" type="text/plain">${safe(await own('tour-film.html'))}</script>\n`;
scripts += `<script>__outlineBoot.start();</script>\n`;
// The saved theme is applied before the page draws, so there is no flash.
const early = `<script>try{const p=JSON.parse(localStorage.getItem('trace-reading-prefs')||'{}'),t=p.theme||'sage',d=document.documentElement;d.dataset.theme=t;const pal=(p.palettes||{})[t];if(pal)d.dataset.palette=pal;if(['blackboard:slate','book:night','whiteboard:glass'].includes(t+':'+pal))d.classList.add('dark');if(p.eqHover===false)d.classList.add('eq-hover-off');const F={gentium:"'Gentium Book Plus',Charter,Georgia,serif",libertinus:"'Libertinus Serif',Georgia,serif",vollkorn:"'Vollkorn',Georgia,serif",literata:"'Literata',Georgia,serif",baskerville:"'Libre Baskerville',Georgia,serif",garamond:"'EB Garamond',Georgia,serif",atkinson:"'Atkinson Hyperlegible',system-ui,sans-serif",poppins:"'Poppins',system-ui,sans-serif",system:"system-ui,-apple-system,sans-serif"};if(F[p.font]){d.dataset.font=p.font;d.style.setProperty('--font-user',F[p.font]);}if(t!=='sage')d.classList.add('house');if(['matte','pitch','textbook-dark'].includes(t))d.classList.add('dark');if(p.side==='shut')d.classList.add('side-shut');}catch{}</script>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&family=Literata:opsz,wght@7..72,500;7..72,600&display=swap">`;
// LaTeX: \( … \) or $ … $ inline, \[ … \] or $$ … $$ display, rendered by MathJax (scripts/math.js).
// boot.js runs this and loads MathJax only when the prepared document contains math; --math off leaves it out.
const math = args.math === 'off' ? '' : `<script type="text/x-outline-math" data-src="${MATHJAX}">/* math */\n${safe(await own('math.js'))}\n</script>\n`;
html = html.replace('</head>', () => `${early}\n<style>${css}</style>\n${math}\n</head>`).replace('</body>', () => `${scripts}</body>`);
// Skeleton: a shimmering outline of the paper until Trace draws the real one
// (Trace replaces both the title and the outline when it first renders). The reader starts with a drop zone.
const line = (w, cls = 'sk-line') => `<span class="sk ${cls}" style="width:${w}%"></span>`;
const para = (ws) => `<div class="sk-para">${ws.map((w) => line(w)).join('')}</div>`;
const skeleton = `<div class="sk-paper" aria-hidden="true">${line(34, 'sk-head')}${para([100, 97, 93, 58])}${para([98, 95, 71])}${line(41, 'sk-head')}${para([99, 94, 96, 88, 46])}${line(29, 'sk-head')}${para([97, 92, 63])}</div>`;
html = html.replace('<h1 id="document-title" spellcheck="false"></h1>', () => `<h1 id="document-title" spellcheck="false">${reader ? '' : '<span class="sk sk-title" aria-hidden="true"></span>'}</h1>`)
  .replace('<div id="outline" aria-label="Document blocks"></div>', () => `<div id="outline" aria-label="Document blocks" aria-busy="true">${skeleton}</div>`);
// The eyebrow comes from the document ("eyebrow", or --label); boot.js fills it in.
html = html.replace(/THE INTEREST PAPER|A TRACE OUTLINE/, () => '<span class="trace-eyebrow">AN OUTLINE</span>').replace('<span>Interest paper</span>', () => `<span>${esc(title)}</span>`).replace(' The interest paper</div>', () => ` ${esc(title)}</div>`);
html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`);

await writeFile(outPath, html);
console.log(`Wrote ${outPath} (${(html.length / 1e6).toFixed(2)} MB${reader ? ', standalone reader' : ''}).`);
