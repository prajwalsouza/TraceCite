// Loading guard, package loader and import. The skeleton shimmer must never run forever: the page either
// draws the document or, within a time limit, says plainly that it could not.
//
// Every reading page runs from a TraceCite package (.trace.zip, see package.js). The package comes from:
//   1. a file imported into this tab a moment ago (handed over through IndexedDB across one reload);
//   2. the page itself (#trace-package, base64): the builder's default, works opened from disk;
//   3. ?src=URL, or the page's data-src (built with --data-url): fetched, which needs a web server;
//   4. nothing: the standalone reader invites a file.
// Import works on every page at any moment: drop files anywhere (a .trace.zip, or a .trace.json with its
// .bib, scripts and images), or choose them in Settings → Document. A full-page overlay catches the drop
// and shows each stage as it actually happens; a document that is already open is replaced, with a way back.
// Trace's reading code cannot be started twice in one page, so replacing a document hands the files to a
// fresh page load (IndexedDB) and continues the stages there.
(function () {
  'use strict';
  const LIMIT = 10000;            // ms until we give up waiting for the first draw
  const FETCH_LIMIT = 15000;      // ms for a package request
  const WORK_LIMIT = 30000;       // ms for reading and preparing an imported file
  const root = document.documentElement;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t0 = Date.now();
  let state = 'loading', firstError = null, poll = 0, installed = false;
  const outline = () => document.getElementById('outline');
  const drawn = () => { const o = outline(); return !!o && !o.querySelector('.sk-paper, .drop-zone') && o.children.length > 0; };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // One paint, so a stage shows before the next starts; a hidden tab never paints, so a short timer stands in.
  const frame = () => new Promise((r) => { let done = false; const go = () => { if (!done) { done = true; r(); } }; requestAnimationFrame(() => setTimeout(go, 0)); setTimeout(go, 80); });

  // ---------- the overlay: catch, work, fail ----------
  const STAGES = [
    ['read', 'Reading the file'],
    ['unzip', 'Unzipping'],
    ['manifest', 'Checking the manifest and version history'],
    ['prepare', 'Preparing sources, maths, tags and cross-references'],
    ['draw', 'Drawing the document'],
  ];
  const PREP = { sources: 'sources', maths: 'maths', structure: 'structure and provenance', references: 'cross-references', highlights: 'highlights and links', figures: 'figures', interactives: 'interactives' };
  let ov = null;
  function overlay() {
    if (ov) return ov;
    ov = el('div', 'td'); ov.id = 'trace-drop'; ov.hidden = true; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'td-title');
    const card = el('div', 'td-card');
    const target = el('div', 'td-target'); target.setAttribute('aria-hidden', 'true');
    target.innerHTML = '<svg class="td-ring" viewBox="0 0 120 120"><circle class="td-ring-bg" cx="60" cy="60" r="52"/><circle class="td-ring-fg" cx="60" cy="60" r="52" pathLength="100"/></svg><svg class="td-icon" viewBox="0 0 24 24"><path class="td-arrow" d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5"/><path class="td-tray" d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/><path class="td-check" d="m6.5 12.5 3.6 3.6 7.4-7.6"/></svg>';
    const title = el('p', 'td-title', 'Drop to open'); title.id = 'td-title';
    const sub = el('p', 'td-sub', 'A .trace.zip, or a .trace.json with its .bib and scripts');
    const list = el('ol', 'td-stages');
    for (const [id, label] of STAGES) { const li = el('li', '', ''); li.dataset.stage = id; li.append(el('span', 'td-dot'), el('span', 'td-label', label), el('span', 'td-detail')); list.append(li); }
    const actions = el('div', 'td-actions');
    const again = el('button', 'td-btn td-primary', 'Choose another file'); again.type = 'button'; again.addEventListener('click', () => pick());
    const close = el('button', 'td-btn', 'Close'); close.type = 'button'; close.addEventListener('click', () => hide());
    actions.append(again, close);
    card.append(target, title, sub, list, actions);
    ov.append(card);
    ov.addEventListener('keydown', (e) => { if (e.key === 'Escape' && ov.dataset.state === 'error') hide(); });
    document.body.append(ov);
    return ov;
  }
  function show(mode, text, sub) {
    const o = overlay();
    o.hidden = false; o.dataset.state = mode; root.classList.add('td-open');
    if (text != null) o.querySelector('.td-title').textContent = text;
    if (sub != null) o.querySelector('.td-sub').textContent = sub;
    if (mode === 'error') o.querySelector('.td-primary').focus({ preventScroll: true });
  }
  function hide() {
    if (!ov) return;
    ov.dataset.state = 'leaving';
    root.classList.remove('td-open');
    setTimeout(() => { if (ov.dataset.state === 'leaving') { ov.hidden = true; ov.dataset.state = ''; } }, reduced() ? 0 : 260);
    // An empty reader whose import failed shows its invitation again.
    if (!installed && root.classList.contains('is-reader')) { state = 'loading'; showInvitation(); }
  }
  function resetStages() { overlay().querySelectorAll('.td-stages li').forEach((li) => { li.className = ''; li.querySelector('.td-detail').textContent = ''; }); setRing(0); }
  function setRing(f) { overlay().style.setProperty('--td-progress', String(Math.max(0, Math.min(1, f)))); }
  function stage(id, detail) {
    const lis = [...overlay().querySelectorAll('.td-stages li')];
    const i = lis.findIndex((li) => li.dataset.stage === id); if (i < 0) return;
    lis.forEach((li, j) => { if (j < i && !li.classList.contains('skip')) li.className = 'done'; });
    lis[i].className = 'now';
    if (detail != null) lis[i].querySelector('.td-detail').textContent = detail;
    setRing((i + 0.5) / lis.length);
  }
  function skipStage(id) { const li = overlay().querySelector(`.td-stages li[data-stage="${id}"]`); if (li) li.className = 'skip'; }
  function finishStages() { overlay().querySelectorAll('.td-stages li:not(.skip)').forEach((li) => { li.className = 'done'; }); setRing(1); }
  function importFail(message) {
    working = false; clearTimeout(workTimer);
    show('error', 'That file didn’t open', message);
    console.error('[import] ' + message);
  }

  // ---------- the loading guard for the page's own document ----------
  function settle() {
    state = 'done'; clearInterval(poll);
    outline()?.removeAttribute('aria-busy');
    root.classList.remove('is-loading');
  }
  function fail(why, detail, retry) {
    if (state !== 'loading') return;
    state = 'failed'; clearInterval(poll);
    root.classList.remove('is-loading', 'is-reader-empty');
    document.querySelectorAll('#outline .sk, .document-header .sk').forEach((n) => n.remove());
    const o = outline(); if (!o) return;
    o.removeAttribute('aria-busy');
    o.innerHTML = '';
    const box = el('div', 'load-fail'); box.setAttribute('role', 'alert');
    box.append(el('p', 'lf-title', 'This document didn’t load'), el('p', 'lf-why', why));
    if (detail) box.append(el('p', 'lf-detail', detail));
    const b = el('button', 'lf-retry', retry || 'Try again'); b.type = 'button';
    b.addEventListener('click', () => (retry ? pick() : location.reload())); box.append(b);
    o.append(box);
    console.error('[outline] ' + why + (detail ? ' — ' + detail : ''));
  }
  addEventListener('error', (e) => {
    if (state !== 'loading' || !root.classList.contains('is-loading')) return;
    firstError = firstError || (e.error?.message || e.message || 'script error');
    setTimeout(() => { if (state === 'loading' && !drawn()) { if (working) importFail('Something in the page stopped it from drawing the document: ' + firstError); fail('Something in the page stopped it from drawing the document.', firstError); } }, 600);
  });
  function watch(onDrawn) {
    clearInterval(poll); t0 = Date.now();
    poll = setInterval(() => {
      if (drawn()) { settle(); onDrawn?.(); }
      else if (Date.now() - t0 > LIMIT) { if (working) importFail('The document took too long to draw.'); fail('The document took too long to draw.', firstError); }
    }, 120);
  }
  function runScript(code, label) { const n = document.createElement('script'); n.textContent = code; if (label) n.dataset.part = label; document.body.append(n); }
  function runDeferred(payload) {
    for (const s of document.querySelectorAll('script[type="text/x-outline-deferred"]')) {
      const when = s.dataset.when;
      if (when === 'viz' && !Object.keys(payload.vizIndex).length) { s.remove(); continue; }
      const n = document.createElement('script'); n.textContent = s.textContent; s.replaceWith(n);
      if (when === 'viz') for (const [name, code] of payload.vizCode) runScript(code, 'interactive: ' + name);
      if (state === 'failed') return;
    }
  }
  const jsonTag = (id, value) => { if (value == null) return; document.getElementById(id)?.remove(); const t = el('script'); t.type = 'application/json'; t.id = id; t.textContent = JSON.stringify(value).replace(/</g, '\\u003c'); document.body.append(t); };
  function install(pkg, payload) {
    const d = payload.trace;
    installed = true;
    window.OUTLINE_SEED = d;
    window.TRACE_PAPER = { storageKey: 'trace-reading-' + payload.key };
    globalThis.__traceExtraTones = payload.mathTones || {};
    Object.assign(globalThis.__traceAssetMap, payload.assets);
    jsonTag('trace-assets', payload.assets);
    if (payload.envIndex) jsonTag('trace-env-index', payload.envIndex);
    if (payload.xrefIndex) jsonTag('trace-xref-index', payload.xrefIndex);
    if (payload.mathIndex) jsonTag('trace-math-index', payload.mathIndex);
    if (Object.keys(payload.vizIndex).length) jsonTag('trace-viz-index', payload.vizIndex);
    // Connected highlights: each slotted tag's spans and formula symbols take its slot colour (themes.css --slot-n).
    window.__traceSpanIndex = payload.spanIndex || {};
    const rules = Object.entries(window.__traceSpanIndex).filter(([, v]) => v.slot).map(([id, v]) => {
      const q = CSS.escape(id), a = id.replace(/"/g, '');
      return `.tag-span[data-tag="${a}"]{--hl:var(--slot-${v.slot});color:var(--hl);background:color-mix(in srgb,var(--hl) 11%,transparent)}\nmjx-container g.${q}{--hl:var(--slot-${v.slot});color:var(--hl)}\n[data-reading-tag="${a}"],[data-tag-id="${a}"],.ev-tag[data-tag="${a}"]{--tag-ink:var(--slot-${v.slot})}`;
    });
    if (rules.length) { const st = el('style'); st.id = 'trace-slots'; st.textContent = rules.join('\n'); document.head.append(st); }
    window.__tracePackage = { pkg, bytes: pkg.bytes, manifest: pkg.manifest, notes: payload.notes, fileName: TracePackage.fileName(pkg) };
    document.title = d.title || document.title;
    const label = payload.label || 'An outline';
    for (const n of document.querySelectorAll('.trace-eyebrow')) n.textContent = label.toUpperCase();
    for (const note of payload.notes) console.warn('[package] ' + note);
    if (payload.hasMath) {
      const tpl = document.querySelector('script[type="text/x-outline-math"]');
      if (tpl) { runScript(tpl.textContent, 'math'); const mj = document.createElement('script'); mj.defer = true; mj.src = tpl.dataset.src; document.head.append(mj); }
    }
  }
  // A short, quiet note at the top of the page: what is missing, and the way back after an import.
  function banner(parts) {
    if (!parts.length) return;
    const bar = el('div', 'td-banner'); bar.setAttribute('role', 'status');
    const x = el('button', 'td-banner-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Dismiss'); x.addEventListener('click', () => bar.remove());
    bar.append(x);
    for (const p of parts) bar.append(p);
    document.querySelector('.document-header')?.before(bar);
  }

  // ---------- loading a package into this page ----------
  let working = false, workTimer = 0, generation = 0;
  // The page's own document (baked in or fetched): where "Back" returns after an import. Empty for the reader.
  let home = { title: '' };
  async function loadPackage(pkg, { imported = false, from = null } = {}) {
    // A newer load (a file dropped while the page's own document was still loading) cancels this one.
    const g = ++generation;
    root.classList.remove('is-reader-empty');
    root.classList.add('is-loading');
    showSkeleton();
    let payload;
    try { payload = await TracePackage.prepare(pkg, (s) => imported && stage('prepare', PREP[s])); }
    catch (e) { if (g !== generation) return; if (imported) return importFail(e.message); fail('The document could not be prepared.', e.message); return; }
    if (g !== generation) return;
    if (imported) stage('draw');
    await frame();
    if (g !== generation) return;
    install(pkg, payload);
    let finished = false;
    const arrived = () => {
      if (finished) return; finished = true;
      clearTimeout(workTimer); working = false;
      if (imported) {
        finishStages();
        show('done', 'Opened', pkg.name);
        setTimeout(() => { hide(); root.classList.add('td-arrived'); setTimeout(() => root.classList.remove('td-arrived'), 900); }, reduced() ? 150 : 520);
        const opened = el('span', 'tdb-line'); opened.append(el('span', 'tdb-label', 'Opened'), el('span', 'tdb-title', pkg.manifest?.title || pkg.doc?.title || pkg.name));
        const parts = [opened];
        if (from) {
          const back = el('button', 'td-banner-back'); back.type = 'button'; back.addEventListener('click', () => location.reload());
          if (from.title) back.append(el('span', 'tdb-label', 'Back to'), el('span', 'tdb-prev', from.title)); else back.append(el('span', 'tdb-prev', 'Close this document'));
          const line = el('span', 'tdb-line'); line.append(back); parts.push(line);
        }
        for (const n of payload.notes) parts.push(el('span', 'td-banner-note', n));
        banner(parts);
      } else if (payload.notes.length) banner(payload.notes.map((n) => el('span', 'td-banner-note', n)));
    };
    watch(arrived);
    runDeferred(payload);
    // Trace often draws synchronously, before the watcher's first tick.
    if (state === 'loading' && drawn()) { settle(); arrived(); }
  }

  // Files → package → this page (when nothing is shown yet) or a fresh page load (when a document is open).
  async function handle(fileList) {
    const files = [...fileList].filter((f) => !/^\._|^\.DS_Store$/.test(f.name));
    if (!files.length || working) return;
    working = true; clearTimeout(workTimer);
    workTimer = setTimeout(() => { if (working) importFail('Reading the file took too long.'); }, WORK_LIMIT);
    resetStages();
    show('work', 'Opening', files.length === 1 ? files[0].name : files.length + ' files');
    stage('read', files.length > 1 ? files.length + ' files' : sizeOf(files[0].size));
    let items;
    try { items = await Promise.all(files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))); }
    catch (e) { return importFail('The file could not be read: ' + e.message); }
    await wait(reduced() ? 0 : 140);
    let pkg;
    try {
      pkg = await TracePackage.open(items, (s) => { if (s === 'manifest' && !items.some((x) => x.bytes[0] === 0x50)) skipStage('unzip'); stage(s); });
    } catch (e) { return importFail(e.message + ' Expected a .trace.zip package, or a .trace.json document with its .bib, scripts and images.'); }
    const h = pkg.manifest?.history || [];
    stage('manifest', `version ${pkg.manifest?.version || 1}` + (h.length ? ` · ${h.length} change${h.length === 1 ? '' : 's'} recorded` : ''));
    await wait(reduced() ? 0 : 160);
    if (!installed) return loadPackage(pkg, { imported: true });
    // A document is open: hand the package to a fresh load of this page, which picks up from "Preparing".
    try { await handOver({ items: [{ name: TracePackage.fileName(pkg), bytes: pkg.bytes }], name: pkg.name, from: home }); }
    catch (e) { return importFail('This browser would not hand the document to the page (' + e.message + '). Open it in trace-reader.html instead.'); }
    location.reload();
  }
  const sizeOf = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' kB');

  // IndexedDB hand-over: one record, read once, then deleted.
  const DB = 'tracecite-import';
  function db() { return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('pending'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error('IndexedDB unavailable')); }); }
  async function handOver(rec) { const d = await db(); await new Promise((res, rej) => { const t = d.transaction('pending', 'readwrite'); t.objectStore('pending').put({ ...rec, at: Date.now() }, 'next'); t.oncomplete = res; t.onerror = () => rej(t.error); }); d.close(); }
  async function takeOver() {
    if (!('indexedDB' in window)) return null;
    try {
      const d = await db();
      const rec = await new Promise((res) => { const t = d.transaction('pending', 'readwrite'); const s = t.objectStore('pending'); const g = s.get('next'); g.onsuccess = () => { s.delete('next'); res(g.result || null); }; g.onerror = () => res(null); });
      d.close();
      return rec && Date.now() - rec.at < 60000 ? rec : null;
    } catch { return null; }
  }

  // ---------- choosing files, and dropping them anywhere ----------
  let input = null;
  function pick() {
    if (!input) { input = el('input'); input.type = 'file'; input.multiple = true; input.accept = '.zip,.json,.bib,.js,.png,.jpg,.jpeg,.svg,.webp,.gif,application/zip,application/json'; input.hidden = true; input.addEventListener('change', () => { if (input.files?.length) handle(input.files); input.value = ''; }); document.body.append(input); }
    if (ov?.dataset.state === 'error') hide();
    input.click();
  }
  function enableDrop() {
    let depth = 0;
    const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
    addEventListener('dragenter', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); e.stopPropagation();
      if (++depth === 1 && !working) { resetStages(); show('drag', 'Drop to open', installed ? 'It replaces ' + (window.OUTLINE_SEED?.title ? '“' + window.OUTLINE_SEED.title + '”' : 'this document') + '; you can come back to it.' : 'A .trace.zip, or a .trace.json with its .bib and scripts'); }
    }, true);
    addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; }, true);
    addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; if (--depth <= 0) { depth = 0; if (!working && ov?.dataset.state === 'drag') hide(); } }, true);
    addEventListener('drop', (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); e.stopPropagation(); depth = 0;
      if (working) return;
      overlay().dataset.state = 'caught';
      const files = e.dataTransfer.files;
      setTimeout(() => handle(files), reduced() ? 0 : 220);
    }, true);
  }
  window.TraceImport = { pick, handle };

  async function fetchPackage(url) {
    if (location.protocol === 'file:' && !/^https?:/i.test(url)) { fail('This page loads its document from ' + url + ', which only works when the page is served.', 'Open it through a local web server, or rebuild it with the package baked in.'); return; }
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), FETCH_LIMIT);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      fail(e.name === 'AbortError' ? 'The document took too long to arrive.' : 'The document could not be fetched.', e.name === 'AbortError' ? url : e.message);
    } finally { clearTimeout(timer); }
  }
  function base64(text) { const s = atob(text.trim()); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; }

  // ---------- the skeleton and the empty reader ----------
  let skeleton = '';
  function showSkeleton() {
    const o = outline(); if (!o || o.querySelector('.sk-paper')) return;
    o.innerHTML = skeleton; o.setAttribute('aria-busy', 'true');
    const h = document.getElementById('document-title'); if (h) h.innerHTML = '<span class="sk sk-title" aria-hidden="true"></span>';
  }
  function showInvitation() {
    const o = outline(); if (!o) return;
    root.classList.remove('is-loading');
    root.classList.add('is-reader-empty');
    o.removeAttribute('aria-busy');
    const h = document.getElementById('document-title'); if (h) h.textContent = 'Open a TraceCite document';
    for (const n of document.querySelectorAll('.trace-eyebrow')) n.textContent = 'TRACECITE READER';
    const zone = el('div', 'drop-zone');
    const choose = el('button', 'drop-pick', 'Choose a file'); choose.type = 'button'; choose.addEventListener('click', pick);
    zone.append(el('p', 'drop-title', 'Drop a .trace.zip anywhere on this page'), el('p', 'drop-why', 'Or a .trace.json with its .bib and scripts. Every sentence opens to the exact words it cites. The file stays on this device: nothing is uploaded.'), choose);
    o.innerHTML = ''; o.append(zone);
  }

  window.__outlineBoot = {
    async start() {
      skeleton = outline()?.innerHTML || '';
      enableDrop();
      // 1. A file imported a moment ago, handed over across the reload.
      const handed = await takeOver();
      if (handed) {
        working = true; workTimer = setTimeout(() => { if (working) importFail('Preparing the document took too long.'); }, WORK_LIMIT);
        resetStages(); show('work', 'Opening', handed.name);
        ['read', 'unzip', 'manifest'].forEach((s) => stage(s));
        try {
          const pkg = await TracePackage.open(handed.items);
          stage('prepare');
          home = handed.from || home;
          return loadPackage(pkg, { imported: true, from: home });
        } catch (e) { importFail(e.message); }
      }
      const embedded = document.getElementById('trace-package');
      const src = new URLSearchParams(location.search).get('src') || embedded?.dataset.src;
      try {
        if (embedded && embedded.textContent.trim()) { const pkg = await TracePackage.open([{ name: embedded.dataset.name || '', bytes: base64(embedded.textContent) }]); home = { title: pkg.doc.title || '' }; return loadPackage(pkg); }
        if (src) { const b = await fetchPackage(src); if (b && state === 'loading') { const pkg = await TracePackage.open([{ name: src.split(/[?#]/)[0], bytes: b }]); home = { title: pkg.doc.title || '' }; await loadPackage(pkg); } return; }
      } catch (e) { fail('The document could not be opened.', e.message); return; }
      // 4. The standalone reader: invite a file.
      root.classList.add('is-reader');
      showInvitation();
    },
  };
  globalThis.__traceAssetMap = globalThis.__traceAssetMap || {};
  root.classList.add('is-loading');
})();
