// Long documents: load in parts, and remember where the reader was.
//
// Trace draws the whole paper on every redraw. That is fine for a paper and far too slow for a textbook, so a
// long document is read through a window. The reading tree is cut into chunks of roughly equal weight
// (sentences, characters and equations), breaking at section starts where it can. Only the chunks around the
// reader are drawn; everything else becomes a placeholder of the right height that keeps its anchor id
// (reading-<block id>), so the contents, links and the scroll bar still work. As the reader scrolls, nearby
// placeholders turn into text and distant text turns back into placeholders. Heights are measured once seen
// and remembered, so the page does not jump.
//
// Settings → Reading → "Load long documents in parts": Auto (default; on when the document is long),
// Always, Never.
//
// Reading position is remembered in every mode, by block, not by scroll offset: the block at the top of the
// screen, its section, and how far into it the reader was. Stored locally only (localStorage), keyed by the
// document's "id" (or its title when it has none):
//   trace-position:<id> = { "v": 1, "block": "<block id>", "section": "<section id>", "offset": <px>, "at": "<ISO>" }
// On the next visit the page opens there, unless the address names a place (#/at/<block id>).
//
// window.TraceWindow = { ensure(id), go(id, opts), windowed, chunks, positionKey, path(id) }
(() => {
  const seed = window.OUTLINE_SEED;
  if (!seed) return;
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem('trace-reading-prefs') || '{}'); } catch {}
  const MODE = ['auto', 'on', 'off'].includes(prefs.windowing) ? prefs.windowing : 'auto';
  const docKey = seed.id || 't:' + (seed.title || 'untitled').slice(0, 120);
  const POS_KEY = 'trace-position:' + docKey, H_KEY = 'trace-heights:' + docKey;
  const BUDGET = 45;           // weight per chunk (about 30–40 sentences with some maths)
  const AUTO_AT = 700;         // total weight above which Auto turns windowing on (about 450 sentences)
  const MARGIN = 1400;         // px around the viewport kept as text
  const MAX_CHUNKS = 9;        // never draw more than this many chunks at once
  try { history.scrollRestoration = 'manual'; } catch {}

  // ---------- parents and sections, from the data ----------
  const parent = new Map(), byId = new Map();
  (function walk(list, p) { for (const b of list || []) { byId.set(b.id, b); if (p) parent.set(b.id, p.id); walk(b.children, b); } })(seed.blocks, null);
  const path = (id) => { const out = []; for (let x = id; x; x = parent.get(x)) out.unshift(x); return out; };
  const sectionOf = (id) => { const p = path(id); for (let i = p.length - 1; i >= 0; i--) if (byId.get(p[i])?.type === 'section') return p[i]; return p[0]; };

  // ---------- weights and chunks (computed from Trace's reading tree on first use) ----------
  const MATH = /\\\(|\\\[|\$\$/g;
  const textWeight = (t) => 1 + (t || '').length / 240 + ((t || '').match(MATH)?.length || 0) * 0.35;
  function weigh(n) {
    if (n.kind === 'paragraph') return 0.6 + (n.sentences || []).reduce((s, x) => s + textWeight(x.text), 0);
    if (n.kind === 'figure' || n.kind === 'table') return 6;
    if (n.kind === 'equation' || n.kind === 'code-block') return 2;
    if (n.kind === 'note') return textWeight(n.block?.text);
    return (n.children || []).reduce((s, c) => s + weigh(c), 0.5);
  }
  let plan = null; // { range: Map(id → [a, b]), weight: Map(id → w), chunkOf: Map(blockId → chunk), count, total }
  function makePlan(tree) {
    const range = new Map(), weight = new Map(), chunkOf = new Map();
    let chunk = 0, acc = 0, total = 0;
    const mark = (n, c) => { (function all(x) { if (x.block?.id && !chunkOf.has(x.block.id)) chunkOf.set(x.block.id, c); for (const s of x.sentences || []) chunkOf.set(s.id, c); (x.children || []).forEach(all); })(n); };
    (function visit(list) {
      for (const n of list) {
        const id = n.block?.id;
        if (n.kind === 'section') {
          if (acc > BUDGET * 0.45) { chunk++; acc = 0; }
          const start = chunk; acc += 0.5;
          if (id) chunkOf.set(id, start);
          visit(n.children || []);
          if (id) { range.set(id, [start, chunk]); weight.set(id, weigh(n)); }
          continue;
        }
        const w = weigh(n); total += w;
        if (acc > 0 && acc + w > BUDGET) { chunk++; acc = 0; }
        if (id) { range.set(id, [chunk, chunk]); weight.set(id, w); }
        mark(n, chunk); acc += w;
      }
    })(tree);
    return { range, weight, chunkOf, count: chunk + 1, total };
  }
  const chunkFor = (id) => { if (!plan) return null; for (const x of path(id).reverse()) if (plan.chunkOf.has(x)) return plan.chunkOf.get(x); return null; };

  // ---------- state ----------
  let windowed = MODE === 'on';
  let win = null; // [from, to] chunk range drawn as text
  const heights = new Map();
  try { for (const [k, v] of Object.entries(JSON.parse(localStorage.getItem(H_KEY) || '{}'))) heights.set(k, v); } catch {}
  let pxPerWeight = +localStorage.getItem(H_KEY + ':ppw') || 30;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(POS_KEY) || 'null'); } catch {}
  const deep = location.hash.match(/^#\/at\/(.+)$/);
  const startAt = deep ? decodeURIComponent(deep[1]) : saved?.block;

  // ---------- the hook Trace calls (patched into renderAPA by the builder) ----------
  function prune(list) {
    const out = [];
    for (const n of list) {
      const id = n.block?.id, r = id && plan.range.get(id);
      if (!r) { out.push(n); continue; }
      if (r[1] < win[0] || r[0] > win[1]) out.push({ kind: 'placeholder', id, range: r });
      else if (n.kind === 'section' && (r[0] < win[0] || r[1] > win[1])) out.push({ ...n, children: prune(n.children || []) });
      else out.push(n);
    }
    return out;
  }
  function tree(nodes) {
    if (!plan) {
      plan = makePlan(nodes);
      windowed = MODE === 'on' || (MODE === 'auto' && plan.total > AUTO_AT);
      document.documentElement.classList.toggle('trace-windowed', windowed);
      if (windowed) { const o = document.getElementById('outline'); if (o) sizes.observe(o); }
      if (windowed) {
        const c = startAt != null ? chunkFor(startAt) : null;
        const at = c == null ? 0 : c;
        win = [Math.max(0, at - 1), Math.min(plan.count - 1, at + 1)];
      }
      setTimeout(restore, 0);
    }
    return windowed ? prune(nodes) : nodes;
  }
  function placeholder(n) {
    const d = document.createElement('div');
    d.className = 'trace-ph'; d.id = 'reading-' + n.id; d.dataset.ph = n.id;
    d.dataset.from = n.range[0]; d.dataset.to = n.range[1];
    d.style.height = Math.max(24, Math.round(heights.get(n.id) || (plan.weight.get(n.id) || 1) * pxPerWeight)) + 'px';
    d.setAttribute('aria-hidden', 'true');
    return d;
  }

  // ---------- measuring what is drawn ----------
  let saveTimer = 0;
  function measure() {
    let w = 0, h = 0;
    document.querySelectorAll('#outline [id^="reading-"]:not(.trace-ph)').forEach((el) => {
      const id = el.id.slice(8); if (!plan?.weight.has(id)) return;
      const cs = getComputedStyle(el), height = el.offsetHeight + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom);
      if (!height) return;
      heights.set(id, Math.round(height));
      if (plan.range.get(id)[0] === plan.range.get(id)[1] && !el.querySelector('.apa-evidence')) { w += plan.weight.get(id); h += height; }
    });
    if (w > 20) pxPerWeight = pxPerWeight * 0.5 + (h / w) * 0.5;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(H_KEY, JSON.stringify(Object.fromEntries([...heights].slice(-4000)))); localStorage.setItem(H_KEY + ':ppw', String(Math.round(pxPerWeight * 10) / 10)); } catch {} }, 800);
  }

  // ---------- where the reader is ----------
  // The drawn element (or placeholder) at a height on screen, with how far into it that height falls.
  function pieceAt(y) {
    const els = document.querySelectorAll('#outline .trace-ph, #outline section.apa-paragraph[id^="reading-"], #outline [id^="reading-"].reading-visual, #outline pre[id^="reading-"], #outline .reading-group > h2, #outline .reading-group > h3, #outline .reading-group > h4');
    let best = null;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.bottom <= y) { best = { el, r }; continue; }
      if (r.top <= y) return { el, r, frac: (y - r.top) / Math.max(1, r.height) };
      return best ? { ...best, frac: 1 } : { el, r, frac: 0 };
    }
    return best ? { ...best, frac: 1 } : null;
  }
  const idOf = (el) => el.dataset.ph || (el.id ? el.id.slice(8) : el.parentElement?.id?.slice(8)) || el.dataset.readingBlock;
  function chunkAtY(y) {
    const p = pieceAt(y); if (!p) return null;
    if (p.el.classList.contains('trace-ph')) { const a = +p.el.dataset.from, b = +p.el.dataset.to; return Math.min(b, a + Math.floor(Math.max(0, Math.min(0.999, p.frac)) * (b - a + 1))); }
    return chunkFor(idOf(p.el));
  }

  // ---------- keeping the reader's place still ----------
  // Trace rebuilds the drawn text on every redraw, and maths typesets a moment later, so the browser's own
  // scroll anchoring has nothing stable to hold. In windowed mode the page holds its own anchor: the first
  // sentence visible on screen (or, over a placeholder, the placeholder and how far into it the reader is).
  // Its screen position is recorded as the reader scrolls; when the text above it changes size, or a redraw
  // replaces it, the page scrolls by the difference.
  let keep = null;
  function anchor() {
    const s = [...document.querySelectorAll('#outline .apa-sentence')].find((x) => x.getBoundingClientRect().bottom > 0);
    if (s && s.getBoundingClientRect().top < innerHeight) return { kind: 's', id: s.dataset.readSentence, top: s.getBoundingClientRect().top };
    const y = Math.min(120, innerHeight * 0.2);
    const p = pieceAt(y); if (!p) return null;
    return { kind: p.el.classList.contains('trace-ph') ? 'ph' : 'b', id: idOf(p.el), top: p.r.top, frac: p.frac, y };
  }
  function find(a) {
    return a.kind === 's' ? document.querySelector(`#outline [data-read-sentence="${CSS.escape(a.id)}"]`)
      : document.getElementById('reading-' + a.id) || document.querySelector(`#outline [data-reading-block="${CSS.escape(a.id)}"]`);
  }
  function hold(a) {
    if (!a) return;
    const el = find(a); if (!el) return;
    const r = el.getBoundingClientRect();
    const target = a.kind === 'ph' && !el.classList.contains('trace-ph') ? a.y - a.frac * r.height : a.top;
    const dy = r.top - target;
    if (Math.abs(dy) > 0.5) { holding = true; window.scrollBy(0, dy); holding = false; }
  }
  let holding = false, keepFrame = 0;
  const track = () => { keepFrame = 0; if (windowed && !busy) keep = anchor(); };
  addEventListener('scroll', () => { if (!holding && !keepFrame) keepFrame = requestAnimationFrame(track); }, { passive: true });
  const sizes = new ResizeObserver(() => { if (windowed && !busy && keep) { hold(keep); keep = anchor(); } });

  let busy = false;
  function redraw(next) {
    if (!window.__traceRender || busy) return;
    busy = true;
    const a = anchor();
    win = next;
    try { window.__traceRender(); } finally { busy = false; }
    hold(a);
    keep = anchor();
    measure();
    observe();
  }
  function wanted() {
    let a = chunkAtY(-MARGIN), b = chunkAtY(innerHeight + MARGIN);
    const mid = chunkAtY(innerHeight / 2);
    if (a == null || b == null || mid == null) return null;
    if (b - a + 1 > MAX_CHUNKS) { const half = Math.floor(MAX_CHUNKS / 2); a = Math.max(0, mid - half); b = Math.min(plan.count - 1, a + MAX_CHUNKS - 1); }
    return [a, b];
  }
  function check() {
    if (!windowed || !plan || busy || !/^#?\/?$/.test(location.hash.replace(/^#\/at\/.*/, ''))) return;
    const w = wanted(); if (!w) return;
    // Grow at once when text is needed; shrink only when well past (so small scrolls do not redraw).
    const need = w[0] < win[0] || w[1] > win[1];
    const slack = win[1] - win[0] + 1 > MAX_CHUNKS || w[0] - win[0] > 2 || win[1] - w[1] > 2;
    if (need || slack) redraw([Math.min(w[0], need ? w[0] : win[0]), Math.max(w[1], need ? w[1] : win[1])].map((v, i) => i === 0 ? Math.max(v, w[0] - 1) : Math.min(v, w[1] + 1)));
  }
  let io = null;
  const near = new Set();
  function observe() {
    if (!windowed) return;
    io?.disconnect(); near.clear();
    io = new IntersectionObserver((entries) => { for (const e of entries) e.isIntersecting ? near.add(e.target) : near.delete(e.target); if (near.size) requestAnimationFrame(check); }, { rootMargin: MARGIN + 'px 0px' });
    document.querySelectorAll('#outline .trace-ph').forEach((p) => io.observe(p));
  }
  let scrollTimer = 0;
  addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { if (windowed && near.size) check(); remember(); }, 140);
  }, { passive: true });

  // ---------- remembering and restoring the place ----------
  function remember() {
    if (!restored || !/^#?\/?$/.test(location.hash)) return;
    const y = Math.min(120, innerHeight * 0.2);
    const p = pieceAt(y); if (!p || p.el.classList.contains('trace-ph')) return;
    // Prefer the sentence under the line, so a long paragraph is restored to the right sentence.
    let block = idOf(p.el), offset = y - p.r.top;
    const s = [...p.el.querySelectorAll('.apa-sentence')].find((x) => { const r = x.getBoundingClientRect(); return r.bottom > y; });
    if (s) { block = s.dataset.readSentence; offset = y - s.getBoundingClientRect().top; }
    try { localStorage.setItem(POS_KEY, JSON.stringify({ v: 1, block, section: sectionOf(block), offset: Math.round(offset), at: new Date().toISOString() })); } catch {}
  }
  function locate(id) {
    return document.querySelector(`#outline [data-read-sentence="${CSS.escape(id)}"]`) || document.getElementById('reading-' + id) || document.querySelector(`#outline [data-reading-block="${CSS.escape(id)}"]`);
  }
  // The paper is laid out only once the loading skeleton is gone and the fonts are in, so restoring waits for
  // the remembered block to have a real size; nothing is saved until then, so a half-loaded page never
  // overwrites the place.
  let restored = false;
  function restore() {
    measure(); observe();
    if (deep || !saved?.block) { restored = true; return; }
    const started = performance.now();
    const attempt = () => {
      const el = locate(saved.block) || locate(saved.section || '');
      const ready = el && el.getBoundingClientRect().height > 0 && document.getElementById('outline')?.offsetParent !== null;
      if (!ready) { if (performance.now() - started < 8000) return setTimeout(attempt, 60); restored = true; return; }
      const y = Math.min(120, innerHeight * 0.2);
      const exact = el === locate(saved.block);
      window.scrollTo(0, scrollY + el.getBoundingClientRect().top - y + (exact ? saved.offset || 0 : 0));
      keep = anchor();
      // Fonts and maths settle a moment later; hold the place through that, then start saving again.
      let n = 0;
      let moved = false; for (const t of ['wheel', 'touchstart', 'keydown', 'pointerdown']) addEventListener(t, () => { moved = true; }, { once: true, passive: true });
      const settle = () => { if (moved) { restored = true; keep = anchor(); return; } const e = locate(saved.block); if (e && exact) { const want = y - (saved.offset || 0), dy = e.getBoundingClientRect().top - want; if (Math.abs(dy) > 1) window.scrollBy(0, dy); } if (++n < 12) setTimeout(settle, 120); else { restored = true; keep = anchor(); } };
      setTimeout(settle, 120);
    };
    (document.fonts?.ready || Promise.resolve()).then(attempt);
  }

  // ---------- going somewhere that may not be drawn yet ----------
  function ensure(id) {
    if (!windowed || !plan || id == null) return;
    const c = chunkFor(id); if (c == null || (c >= win[0] && c <= win[1])) return;
    busy = true;
    win = [Math.max(0, c - 1), Math.min(plan.count - 1, c + 1)];
    try { window.__traceRender?.(); } finally { busy = false; }
    measure(); observe();
    requestAnimationFrame(track);
  }
  function go(id, { block = 'start', smooth = false } = {}) {
    ensure(id);
    const el = locate(id);
    el?.scrollIntoView({ block, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto' });
    return el;
  }

  window.__traceWindow = { tree, placeholder };
  window.TraceWindow = { ensure, go, path, sectionOf, get windowed() { return windowed; }, get chunks() { return plan?.count || 0; }, get weight() { return plan?.total || 0; }, get window() { return win && [...win]; }, mode: MODE, positionKey: POS_KEY };
})();
