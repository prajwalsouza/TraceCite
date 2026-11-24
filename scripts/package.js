// TraceCite packages (.trace.zip): open one, prepare it for the reading page, and export it again, in the
// browser (and in Node 20+, where the builder uses the same code paths through zip.js).
//
// A package is a plain zip:
//   manifest.json            { "format": "tracecite/1.0", "package": 1, "version": 3, "title", "data": "name.trace.json",
//                              "bibliography": [...], "assets": [...], "interactiveScripts": [...], "files": [...],
//                              "history": [{ "version", "date", "by", "note", "hash", "previous" }, …] }
//   name.trace.json          the trace data, exactly as written (paths in it are relative to it)
//   refs.bib                 BibTrace sources (BibTeX plus trace-* fields), if any
//   assets/manuscript/…      figure images named in "Assets" and "Video poster" fields
//   *.js                     interactive components named in "interactiveScripts" ("vizScripts" also works)
// "format" is the TraceCite format; "version" is this document's own version, which grows by one each time
// its content (the data and its .bib files) changes. "history" says when, by whom and why, with a content
// hash and the previous hash, so two exports can be compared.
//
// open() accepts one file (.trace.zip, .zip, .trace.json, .json) or several dropped together (a .json with
// its .bib, scripts and images, matched to the paths the data names). prepare() runs the steps the builder
// used to run in Node (BibTrace, environments, math tags, provenance, comments, cross-references, the
// interactives index) and reports each stage as it happens. Needs TraceZip, TraceCiteStyles and TracePrep.
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TracePackage = api;
})(typeof globalThis === 'object' ? globalThis : this, function (root) {
  'use strict';
  const KEEP = ['version', 'format', 'id', 'title', 'subtitle', 'authors', 'affiliations', 'date', 'revision', 'keywords', 'doi', 'license', 'note', 'updatedAt', 'tagTree', 'parameters', 'flow', 'blocks', 'sources', 'documentStructure', 'appliedOutlineRevisions', 'manuscript', 'eyebrow'];
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif' };
  const MATH = /\\\(|\\\[|\$\$|(?<!\\)\$[^$\s][^$\n]*\$/;
  const enc = new TextEncoder();
  const join = (dir, rel) => {
    const out = [];
    for (const part of (dir ? dir + '/' + rel : rel).split('/')) { if (!part || part === '.') continue; if (part === '..') out.pop(); else out.push(part); }
    return out.join('/');
  };
  const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
  const base = (p) => p.replace(/^.*[\\/]/, '');
  const walk = (blocks, fn) => (blocks || []).forEach((b) => { fn(b); walk(b.children, fn); });
  const field = (b, k) => (b.fields || []).find((f) => f.key === k)?.value || '';
  const isZip = (b) => b && b[0] === 0x50 && b[1] === 0x4b;
  const tick = () => new Promise((r) => setTimeout(r, 0));
  // Interactive figures: "Interactive" / "Interactive settings" fields and "interactiveScripts"; the older
  // names "Viz" / "Viz settings" / "vizScripts" are accepted too.
  const interactiveOf = (b) => field(b, 'Interactive') || field(b, 'Viz');
  const interactiveSettingsOf = (b) => field(b, 'Interactive settings') || field(b, 'Viz settings');
  const scriptsOf = (doc) => [...new Set([].concat(doc.interactiveScripts || [], doc.vizScripts || []))];
  const assetsOf = (doc) => {
    const out = new Set();
    walk(doc.blocks, (b) => {
      try { for (const a of JSON.parse(field(b, 'Assets') || '[]')) if (typeof a === 'string') out.add('assets/manuscript/' + a); } catch {}
      if (field(b, 'Video poster')) out.add('assets/manuscript/' + field(b, 'Video poster'));
    });
    return [...out];
  };
  // What the data file names, relative to the package root.
  function references(doc, dataPath) {
    const d = dirOf(dataPath);
    return {
      bibliography: [].concat(doc.bibliography || []).map((p) => join(d, p)),
      interactiveScripts: scriptsOf(doc).map((p) => join(d, p)),
      assets: assetsOf(doc).map((p) => join(d, p)),
    };
  }
  function parseDoc(bytes, name) {
    let doc;
    try { doc = JSON.parse(root.TraceZip.text(bytes)); } catch (e) { throw new Error(`${name} is not valid JSON (${e.message}).`); }
    if (!doc || !Array.isArray(doc.blocks)) throw new Error(`${name} is JSON, but not a TraceCite document: it has no "blocks".`);
    return doc;
  }

  // Content hash of the document: its data file and .bib files, in path order. SHA-256 where available.
  async function contentHash(pkg) {
    const refs = references(pkg.doc, pkg.dataPath);
    const bibs = [...new Set([...refs.bibliography, ...(pkg.manifest?.bibliography || [])])];
    const parts = [pkg.dataPath, ...bibs.filter((p) => pkg.files.has(p)).sort()];
    const chunks = []; for (const p of parts) chunks.push(enc.encode(p + '\n'), pkg.files.get(p), enc.encode('\n'));
    const all = new Uint8Array(chunks.reduce((s, c) => s + c.length, 0)); let at = 0; for (const c of chunks) { all.set(c, at); at += c.length; }
    const subtle = root.crypto?.subtle;
    if (subtle) { try { const h = new Uint8Array(await subtle.digest('SHA-256', all)); return 'sha256:' + [...h].map((x) => x.toString(16).padStart(2, '0')).join(''); } catch {} }
    return 'crc32:' + root.TraceZip.crc32(all).toString(16).padStart(8, '0');
  }

  function makeManifest(doc, dataPath, files, history = [], extra = {}) {
    const paths = [...files.keys()].filter((p) => p !== 'manifest.json');
    const refs = references(doc, dataPath);
    const last = history[history.length - 1];
    return {
      format: 'tracecite/1.0', package: 1, version: last ? last.version : 1, title: doc.title || '', data: dataPath,
      bibliography: refs.bibliography.filter((p) => files.has(p)),
      assets: refs.assets.filter((p) => files.has(p)),
      interactiveScripts: refs.interactiveScripts.filter((p) => files.has(p)),
      files: paths.map((p) => ({ path: p, bytes: files.get(p).length })),
      history,
      ...extra,
    };
  }
  async function zipFiles(manifest, files) {
    const entries = [['manifest.json', JSON.stringify(manifest, null, 2)], ...[...files].filter(([p]) => p !== 'manifest.json')];
    const last = manifest.history?.[manifest.history.length - 1];
    return root.TraceZip.write(entries, { date: last?.date ? new Date(last.date) : undefined });
  }
  // Add a history entry when the content differs from the last one recorded. Returns the (new) history.
  async function withHistory(pkg, { by = '', note = '', date } = {}) {
    const history = [...(pkg.manifest?.history || [])];
    const hash = await contentHash(pkg);
    const last = history[history.length - 1];
    if (last?.hash === hash) return { history, changed: false, hash };
    const entry = { version: (last?.version || 0) + 1, date: date || new Date().toISOString(), hash, previous: last?.hash || null };
    if (by) entry.by = by; if (note) entry.note = note;
    history.push(entry);
    return { history, changed: true, hash };
  }

  // One or several files → a package. items: [{ name, bytes }].
  async function open(items, onStage = () => {}) {
    items = [].concat(items).map((x) => ({ name: base(x.name || ''), bytes: x.bytes instanceof Uint8Array ? x.bytes : new Uint8Array(x.bytes) }));
    if (!items.length) throw new Error('No file was given.');
    const Z = root.TraceZip;
    onStage('read');
    const zip = items.find((x) => isZip(x.bytes));
    let files, manifest = null, dataPath, wrapped = false, missing = [];
    if (zip) {
      onStage('unzip'); await tick();
      try { files = await Z.read(zip.bytes); } catch (e) { throw new Error(`${zip.name || 'The file'} is a zip, but it could not be unpacked: ${e.message}`); }
      onStage('manifest');
      if (files.has('manifest.json')) {
        try { manifest = JSON.parse(Z.text(files.get('manifest.json'))); } catch { throw new Error('manifest.json is not valid JSON.'); }
        if (manifest.format && !/^tracecite\/1\./.test(manifest.format)) throw new Error(`This package is ${manifest.format}; this reader understands tracecite/1.x.`);
      }
      dataPath = manifest?.data;
      if (!dataPath) {
        const json = [...files.keys()].filter((k) => k !== 'manifest.json' && /\.json$/i.test(k) && !k.includes('__MACOSX'));
        const docs = json.filter((k) => { try { return Array.isArray(JSON.parse(Z.text(files.get(k))).blocks); } catch { return false; } });
        if (docs.length !== 1) throw new Error(docs.length ? 'The zip holds several TraceCite documents and no manifest.json to say which one to open.' : 'The zip holds no TraceCite document (a .json file with "blocks").');
        dataPath = docs[0];
      }
      if (!files.has(dataPath)) throw new Error(`The package names ${dataPath} as its document, but has no such file.`);
    } else {
      // Loose files: the document is the .json with blocks; the others are matched to the paths it names.
      onStage('manifest');
      const docs = items.filter((x) => /\.json$/i.test(x.name) || x.bytes[0] === 0x7b);
      if (!docs.length) throw new Error(`${items.map((x) => x.name).join(', ')}: expected a .trace.zip package, or a .trace.json document (with its .bib, scripts and images if it has them).`);
      let picked = null;
      for (const x of docs) { try { picked = { item: x, doc: parseDoc(x.bytes, x.name) }; break; } catch (e) { if (docs.length === 1) throw e; } }
      if (!picked) throw new Error('None of the .json files is a TraceCite document (none has "blocks").');
      dataPath = picked.item.name || 'document.trace.json';
      files = new Map([[dataPath, picked.item.bytes]]);
      const refs = references(picked.doc, dataPath);
      const rest = items.filter((x) => x !== picked.item);
      for (const p of [...refs.bibliography, ...refs.interactiveScripts, ...refs.assets]) {
        const hit = rest.find((x) => x.name === base(p));
        if (hit) files.set(p, hit.bytes); else missing.push(p);
      }
      wrapped = true;
    }
    const doc = parseDoc(files.get(dataPath), dataPath);
    if (!wrapped) { const refs = references(doc, dataPath); missing = [...refs.bibliography, ...refs.interactiveScripts, ...refs.assets].filter((p) => !files.has(p)); }
    const pkg = { files, manifest, dataPath, doc, missing, wrapped, name: zip?.name || dataPath };
    if (wrapped || !manifest) {
      // Loose files and manifest-less zips become a proper package, so Export always hands one back.
      const { history } = await withHistory(pkg, { note: 'Packed from ' + items.map((x) => x.name).join(', ') });
      pkg.manifest = makeManifest(doc, dataPath, files, history);
      pkg.bytes = await zipFiles(pkg.manifest, files);
      files.set('manifest.json', enc.encode(JSON.stringify(pkg.manifest, null, 2)));
    } else pkg.bytes = zip.bytes;
    return pkg;
  }

  // The bytes to download: the package as it was opened, unless its content has no history entry yet.
  async function exportBytes(pkg, opts = {}) {
    // A reading page never edits the document, so a package that already records its history goes out byte for byte.
    if (pkg.bytes && pkg.manifest?.history?.length) return pkg.bytes;
    const { history, changed } = await withHistory(pkg, opts);
    if (!changed) return pkg.bytes;
    const manifest = { ...(pkg.manifest || makeManifest(pkg.doc, pkg.dataPath, pkg.files)), history, version: history[history.length - 1].version };
    return zipFiles(manifest, pkg.files);
  }

  // Everything the reading page needs, prepared from the package. The package itself is not changed.
  // onStage(name) is called as each stage starts: sources, maths, structure, references, highlights, figures, interactives.
  async function prepare(pkg, onStage = () => {}) {
    const P = root.TracePrep, Z = root.TraceZip;
    if (!P) throw new Error('The preparation code (TracePrep) is missing from this page.');
    const dir = dirOf(pkg.dataPath);
    const doc = JSON.parse(JSON.stringify(pkg.doc));
    const notes = [];
    onStage('sources'); await tick();
    const bibs = pkg.manifest?.bibliography?.length ? pkg.manifest.bibliography : references(doc, pkg.dataPath).bibliography;
    for (const p of bibs) {
      const f = pkg.files.get(p);
      if (!f) { notes.push(`Its bibliography (${p}) is not in the file.`); continue; }
      let sources;
      try { sources = P.bibtrace.bibToSources(P.bibtrace.parseBib(Z.text(f))); } catch (e) { throw new Error(`${p} could not be read as BibTrace: ${e.message}`); }
      const byId = new Map((doc.sources || []).map((s) => [s.id, s]));
      for (const s of sources) byId.set(s.id, s);
      doc.sources = [...byId.values()];
    }
    P.environments.ensureEnvironmentTags(doc);
    const trace = Object.fromEntries(KEEP.filter((k) => doc[k] !== undefined).map((k) => [k, doc[k]]));
    onStage('maths'); await tick();
    let mathIndex = null, mathTones = {};
    trace.mathTags = doc.mathTags;
    const m = P.mathTags.addMathTags(trace);
    delete trace.mathTags;
    if (m) { mathIndex = m.index; mathTones = m.tones || {}; }
    onStage('structure'); await tick();
    const env = P.environments.addEnvironments(trace);
    P.provenance.addProvenance(trace);
    P.comments.addComments(trace);
    onStage('references'); await tick();
    trace.crossRefs = doc.crossRefs;
    const x = P.crossrefs.addCrossRefs(trace);
    delete trace.crossRefs;
    // Span tags, connected highlights (slots, symbols in formulas) and links (spans.mjs).
    onStage('highlights'); await tick();
    trace.links = doc.links;
    const sp = P.spans.addSpanTags(trace);
    delete trace.links;
    onStage('figures'); await tick();
    const assets = {};
    walk(trace.blocks, (b) => {
      const list = []; try { for (const a of JSON.parse(field(b, 'Assets') || '[]')) if (typeof a === 'string') list.push(a); } catch {}
      if (field(b, 'Video poster')) list.push(field(b, 'Video poster'));
      for (const rel of list) {
        const url = 'assets/manuscript/' + rel, f = pkg.files.get(join(dir, url));
        const type = MIME[(rel.split('.').pop() || '').toLowerCase()];
        if (f && type && !assets[url] && typeof Blob !== 'undefined') assets[url] = URL.createObjectURL(new Blob([f], { type }));
      }
    });
    const missingFigures = (pkg.missing || []).filter((p) => p.includes('assets/'));
    if (missingFigures.length) notes.push(`${missingFigures.length} figure image${missingFigures.length === 1 ? ' is' : 's are'} not in the file.`);
    // Connected highlights keep their names exactly ("q, the power" must not become "Q, the power").
    (function clean(list) { for (const t of list || []) { if (typeof t.name === 'string') { const n = t.name.replace(/^#\s*/, ''); t.name = t.slot || t.symbols ? n : n.charAt(0).toUpperCase() + n.slice(1); } clean(t.children); } })(trace.tagTree);
    onStage('interactives'); await tick();
    const vizIndex = {};
    walk(trace.blocks, (b) => {
      const comp = interactiveOf(b); if (!comp) return;
      let settings = {}; const s = interactiveSettingsOf(b);
      if (s) { try { settings = JSON.parse(s); } catch { throw new Error(`Figure ${b.id}: its interactive settings are not valid JSON.`); } }
      vizIndex[b.id] = { component: comp, settings };
    });
    const vizCode = [];
    if (Object.keys(vizIndex).length) {
      const lost = [];
      for (const p of scriptsOf(doc)) { const f = pkg.files.get(join(dir, p)); if (f) vizCode.push([p, Z.text(f)]); else lost.push(p); }
      if (lost.length) notes.push(`Its interactive figures need ${lost.join(', ')}, which ${lost.length === 1 ? 'is' : 'are'} not in the file. Open the document's .trace.zip, or drop the .json together with ${lost.length === 1 ? 'that script' : 'those scripts'}.`);
    }
    const json = JSON.stringify(trace);
    return {
      trace, mathIndex, mathTones, envIndex: env ? env.index : null, xrefIndex: x ? x.index : null,
      vizIndex, vizCode, assets, notes, hasMath: MATH.test(json), spanIndex: sp ? sp.index : {},
      key: Z.crc32(enc.encode(json)).toString(16).padStart(8, '0'),
      label: doc.eyebrow || pkg.manifest?.label || '',
    };
  }

  const fileName = (pkg) => {
    if (pkg.name && /\.trace\.zip$/i.test(pkg.name)) return pkg.name;
    const t = (pkg.manifest?.title || pkg.doc?.title || 'document').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
    return (t || 'document') + '.trace.zip';
  };
  return { open, prepare, exportBytes, withHistory, contentHash, makeManifest, zipFiles, references, fileName, join, dirOf, interactiveOf, scriptsOf };
});
