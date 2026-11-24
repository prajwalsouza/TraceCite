// "In this outline": the sidebar contents as a tree that suits any shape of document: a paper with a handful
// of sections, a thesis with chapters and subsections, a textbook with parts, chapters and sections.
// - Top-level parts are always listed; the part being read opens to show its subsections (and theirs, up to
//   four levels). Any part opens or closes with its chevron. A single wrapper section (a book title around
//   everything) is skipped.
// - The paper's own numbers ("1.1 The problem") go in the number column; if it has none, top-level parts are
//   counted 01, 02 … and deeper ones go unnumbered.
// - The part being read is shown in the accent; its parents in full ink. The list keeps it in view.
// - Clicking goes there through TraceWindow, so parts of a long document that are not drawn yet are loaded.
// Replaces Trace's flat list (#contents), which stays in the page, hidden.
(() => {
  const seed = window.OUTLINE_SEED;
  if (!seed) return;
  const NUM = /^\s*((?:\d+|[A-Z]|[IVXLC]+)(?:\.\d+)*)\.?\s+(?=\S)/;
  const CHAPTER = /^\s*(?:Chapter|Part|Appendix)\s+(\d+|[A-Z]|[IVXLC]+)\s*[:.–—-]?\s*/i;
  function entries(blocks, depth) {
    const out = [];
    for (const b of blocks || []) {
      const isSection = b.type === 'section';
      if (!isSection && !(depth === 0 && (b.text || '').trim())) continue;
      out.push({ id: b.id, title: (b.text || 'Untitled').trim(), depth, children: isSection && depth < 3 ? entries(b.children, depth + 1) : [] });
    }
    return out;
  }
  let top = entries(seed.blocks, 0);
  if (top.length === 1 && top[0].children.length) top = top[0].children.map(function lift(e) { return { ...e, depth: e.depth - 1, children: e.children.map(lift) }; });
  const all = [];
  (function flat(list, parent) { for (const e of list) { e.parent = parent; all.push(e); flat(e.children, e); } })(top, null);
  const own = top.filter((e) => NUM.test(e.title) || CHAPTER.test(e.title)).length >= top.length / 2;
  for (const e of all) {
    const m = e.title.match(CHAPTER) || e.title.match(NUM);
    if (own && m) { e.num = m[1]; e.label = e.title.slice(m[0].length) || e.title; }
    else { e.label = e.title; e.num = !own && e.depth === 0 ? String(top.indexOf(e) + 1).padStart(2, '0') : ''; }
  }
  const byId = new Map(all.map((e) => [e.id, e]));

  const nav = document.getElementById('outline-navigation');
  if (!nav) return;
  const list = document.createElement('nav'); list.id = 'trace-toc'; list.setAttribute('aria-label', 'Contents');
  document.getElementById('contents')?.after(list);
  const count = document.createElement('span'); count.className = 'toc-count'; count.textContent = String(top.length);
  nav.querySelector('.nav-heading')?.append(count);
  const opened = new Set(); // opened by hand
  let current = null, path = new Set();

  const svgChevron = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';
  function row(e) {
    const wrap = document.createElement('div'); wrap.className = 'toc-item'; wrap.dataset.depth = e.depth;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'toc-link'; b.dataset.toc = e.id;
    const n = document.createElement('span'); n.className = 'toc-num'; n.textContent = e.num;
    const t = document.createElement('span'); t.className = 'toc-label'; t.textContent = e.label; b.title = e.title;
    b.append(n, t);
    b.addEventListener('click', () => go(e.id));
    wrap.append(b);
    if (e.children.length) {
      const c = document.createElement('button'); c.type = 'button'; c.className = 'toc-fold'; c.innerHTML = svgChevron;
      c.setAttribute('aria-label', 'Show or hide the parts of ' + e.label);
      c.addEventListener('click', (ev) => { ev.stopPropagation(); const open = isOpen(e); open ? (opened.delete(e.id), closedByHand.add(e.id)) : (opened.add(e.id), closedByHand.delete(e.id)); draw(); });
      wrap.append(c);
    }
    return wrap;
  }
  const closedByHand = new Set();
  const isOpen = (e) => !closedByHand.has(e.id) && (opened.has(e.id) || path.has(e.id));
  function draw() {
    list.replaceChildren();
    (function add(entries) {
      for (const e of entries) {
        const r = row(e);
        r.classList.toggle('on', e.id === current);
        r.classList.toggle('in-path', path.has(e.id) && e.id !== current);
        if (e.children.length) r.classList.toggle('open', isOpen(e));
        list.append(r);
        if (e.children.length && isOpen(e)) add(e.children);
      }
    })(top);
    keepInView();
  }
  function keepInView() {
    const on = list.querySelector('.toc-item.on'); if (!on) return;
    const box = nav.getBoundingClientRect(), r = on.getBoundingClientRect();
    if (r.top < box.top + 40) nav.scrollTop -= box.top + 40 - r.top;
    else if (r.bottom > box.bottom - 30) nav.scrollTop += r.bottom - (box.bottom - 30);
  }
  function go(id) {
    if (location.hash && !/^#?\/?$/.test(location.hash)) location.hash = '/';
    setTimeout(() => {
      const el = window.TraceWindow ? window.TraceWindow.go(id, { smooth: true }) : document.getElementById('reading-' + id);
      if (!window.TraceWindow) el?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      if (matchMedia('(max-width: 760px)').matches) document.getElementById('close-navigation')?.click();
    }, location.hash.length > 2 ? 60 : 0);
  }
  // Which part is being read: the last entry whose heading (or placeholder) starts above the reading line.
  function locate() {
    const y = innerHeight * 0.3;
    let best = null;
    for (const e of all) {
      const el = document.getElementById('reading-' + e.id); if (!el) continue;
      const t = el.getBoundingClientRect().top;
      if (t <= y) best = e; else break; // entries are in reading order
    }
    const id = best?.id || top[0]?.id;
    if (id === current) return;
    current = id; path = new Set(); for (let e = byId.get(id); e; e = e.parent) path.add(e.id);
    draw();
    dispatchEvent(new Event('trace-toc-change'));
  }
  let t = 0;
  addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(locate, 60); }, { passive: true });
  addEventListener('hashchange', () => setTimeout(locate, 80));
  draw(); setTimeout(locate, 300);
  window.TraceToc = { entries: top, locate, get current() { return byId.get(current) || null; } };
})();
