// Parametric tags: tags that carry a value for every sentence, not just yes or no.
// Each one opens (only when expanded) into a chart the reader can filter.
//
// Data: the trace file may hold a top-level `parameters` list, shaped like tagTree,
// with `measure` on each leaf and optional `plot` and `unit`:
//   { id: 'p-length', name: 'Length', children: [
//       { id: 'p-chars',  name: 'Characters', measure: 'characters', plot: 'histogram' },
//       { id: 'p-conf',   name: 'Confidence', measure: { field: 'Confidence' }, plot: 'strip' },
//       { id: 'p-method', name: 'Method', measure: { field: 'Method', type: 'category' } } ] }
// Measures: characters, words, citations, quotes; { field } reads a number from each
// sentence's fields; { field, type: 'category' } reads a text value.
// Plots (the vocabulary; add new ones here and nowhere else):
//   histogram   continuous numbers, binned; brush the bars or use the range slider
//   strip       continuous numbers, one dot per sentence; brush or use the range slider
//   counts      small whole numbers, a labelled bar per value; tap values on and off
//   categories  text values, a labelled bar list; tap values on and off
// Without `plot`: text gets categories, small whole numbers counts, the rest a histogram.
(function () {
  'use strict';
  const doc = window.OUTLINE_SEED || { blocks: [], sources: [] };
  const get = (b, k) => b?.fields?.find((f) => f.key === k)?.value || '';
  const sentences = [];
  (function walk(bs) { for (const b of bs || []) { if (b.type === 'sentence') sentences.push(b); walk(b.children); } })(doc.blocks);
  const sources = new Map((doc.sources || []).map((s) => [s.id, s]));

  const DEFAULT = [
    { id: 'p-length', name: 'Length', children: [
      { id: 'p-characters', name: 'Characters', measure: 'characters', unit: 'characters', plot: 'histogram' },
      { id: 'p-words', name: 'Words', measure: 'words', unit: 'words', plot: 'strip' } ] },
    { id: 'p-evidence', name: 'Evidence', children: [
      { id: 'p-citations', name: 'Citations', measure: 'citations', unit: 'citations', plot: 'counts' },
      { id: 'p-quotes', name: 'Checked quotes', measure: 'quotes', unit: 'quotes', plot: 'counts' } ] },
  ];
  const TREE = Array.isArray(doc.parameters) && doc.parameters.length ? doc.parameters : DEFAULT;

  const citations = (s) => (s.children || []).filter((c) => c.type === 'citation' || (c.type === 'reference' && get(c, 'Source ID')));
  function measure(m, s) {
    if (m && typeof m === 'object' && m.field) {
      const raw = String(get(s, m.field)).trim();
      if (m.type === 'category') return raw || null;
      const v = parseFloat(raw.replace(',', '.')); return Number.isFinite(v) ? v : null;
    }
    switch (m) {
      case 'characters': return s.text.length;
      case 'words': return s.text.trim().split(/\s+/).filter(Boolean).length;
      case 'citations': return citations(s).length;
      case 'quotes': return citations(s).filter((c) => (sources.get(get(c, 'Source ID'))?.fields || []).some((f) => /^Exact quote/.test(f.key) && f.value)).length;
      default: return null;
    }
  }
  const LEAVES = new Map();
  (function walk(list) {
    for (const p of list || []) {
      if (p.measure) {
        const values = new Map();
        for (const s of sentences) { const v = measure(p.measure, s); if (v != null) values.set(s.id, v); }
        const all = [...values.values()];
        const text = all.some((v) => typeof v === 'string');
        const integer = !text && all.every(Number.isInteger);
        const min = text ? 0 : Math.min(...all), max = text ? 0 : Math.max(...all);
        const plot = p.plot || (text ? 'categories' : integer && max - min <= 8 ? 'counts' : 'histogram');
        LEAVES.set(p.id, { ...p, values, min, max, integer, text, plot });
      }
      walk(p.children);
    }
  })(TREE);

  // ---------- state ----------
  // A filter is a range { lo, hi } or a set of values { set }.
  const filters = new Map();
  const openLeaves = new Set();
  const openGroups = new Set();
  const passes = (f, v) => v != null && (f.set ? f.set.has(v) : v >= f.lo && v <= f.hi);
  function matches() {
    if (!filters.size) return null;
    const out = new Set();
    for (const s of sentences) {
      let ok = true;
      for (const [id, f] of filters) if (!passes(f, LEAVES.get(id)?.values.get(s.id))) { ok = false; break; }
      if (ok) out.add(s.id);
    }
    return out;
  }
  const listeners = new Set();
  function changed() { applyFocus(); drawRail(); drawDock(); listeners.forEach((f) => f()); }
  function live() { applyFocus(); drawDock(); }

  const outline = document.getElementById('outline');
  function applyFocus() {
    const m = matches();
    outline.classList.toggle('param-focus-active', !!m);
    outline.querySelectorAll('[data-read-sentence]').forEach((n) => n.classList.toggle('param-match', !!m && m.has(n.dataset.readSentence)));
  }
  new MutationObserver(() => { if (filters.size) applyFocus(); }).observe(outline, { childList: true });

  // ---------- formatting ----------
  const fmtRaw = (v) => (Math.abs(v) >= 100 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1));
  const fmt = (v, leaf) => (typeof v === 'string' ? v : leaf?.integer ? String(Math.round(v)) : fmtRaw(v));
  function describe(leaf, f) {
    if (f.set) return [...f.set].sort((a, b) => (typeof a === 'string' ? String(a).localeCompare(b) : a - b)).map((v) => fmt(v, leaf)).join(', ');
    return leaf.integer ? `${Math.ceil(f.lo - 1e-9)}–${Math.floor(f.hi + 1e-9)}` : `${fmtRaw(f.lo)}–${fmtRaw(f.hi)}`;
  }
  const countIn = (leaf, f) => [...leaf.values.values()].filter((v) => passes(f, v)).length;

  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const snap = (leaf, v) => (leaf.integer ? Math.round(v) : v);

  function caption(leaf, onClear) {
    const cap = el('div', 'pm-cap');
    const text = el('span', 'pm-range');
    const clear = el('button', 'pm-clear', 'Clear'); clear.type = 'button';
    clear.addEventListener('click', onClear);
    cap.append(text, clear);
    const pick = leaf.plot === 'counts' || leaf.plot === 'categories';
    return { cap, set: (f) => {
      if (!f) { text.textContent = `${leaf.values.size} sentences · ${pick ? 'tap values to filter' : 'drag to filter'}`; clear.hidden = true; return; }
      const n = countIn(leaf, f); const all = matches();
      text.textContent = `${describe(leaf, f)} · ${n} sentence${n === 1 ? '' : 's'}` + (all && filters.size > 1 ? ` · ${all.size} with all filters` : '');
      clear.hidden = false;
    } };
  }

  // A minimal range slider: a thin track, two round handles, the span between filled.
  function rangeSlider(leaf, onInput, onCommit) {
    const wrap = el('div', 'pm-slider');
    const track = el('div', 'pm-track'); const fill = el('div', 'pm-fill');
    const lo = el('button', 'pm-handle'); const hi = el('button', 'pm-handle');
    for (const [h, name] of [[lo, 'Lower'], [hi, 'Upper']]) {
      h.type = 'button'; h.setAttribute('role', 'slider'); h.setAttribute('aria-label', `${name} limit for ${leaf.name}`);
      h.setAttribute('aria-valuemin', leaf.min); h.setAttribute('aria-valuemax', leaf.max);
    }
    track.append(fill); wrap.append(track, lo, hi);
    const span = (leaf.max - leaf.min) || 1;
    let cur = { lo: leaf.min, hi: leaf.max };
    function paint(f) {
      cur = f ? { lo: f.lo, hi: f.hi } : { lo: leaf.min, hi: leaf.max };
      const a = ((cur.lo - leaf.min) / span) * 100, b = ((cur.hi - leaf.min) / span) * 100;
      lo.style.left = a + '%'; hi.style.left = b + '%';
      fill.style.left = a + '%'; fill.style.width = Math.max(0, b - a) + '%';
      wrap.classList.toggle('active', !!f);
      lo.setAttribute('aria-valuenow', cur.lo); hi.setAttribute('aria-valuenow', cur.hi);
      lo.setAttribute('aria-valuetext', fmt(cur.lo, leaf)); hi.setAttribute('aria-valuetext', fmt(cur.hi, leaf));
    }
    const valueAt = (x) => { const r = track.getBoundingClientRect(); return snap(leaf, leaf.min + clamp((x - r.left) / r.width, 0, 1) * span); };
    function drag(handle, which) {
      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); handle.setPointerCapture(e.pointerId); wrap.classList.add('dragging');
        const move = (ev) => {
          const v = valueAt(ev.clientX);
          const next = which === 'lo' ? { lo: Math.min(v, cur.hi), hi: cur.hi } : { lo: cur.lo, hi: Math.max(v, cur.lo) };
          paint(next); onInput(next);
        };
        const up = () => { handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); handle.removeEventListener('pointercancel', up); wrap.classList.remove('dragging'); onCommit(cur); };
        handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); handle.addEventListener('pointercancel', up);
      });
      handle.addEventListener('keydown', (e) => {
        const step = leaf.integer ? 1 : span / 50;
        const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? step : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -step : 0;
        if (!d) return; e.preventDefault();
        const next = which === 'lo' ? { lo: clamp(snap(leaf, cur.lo + d), leaf.min, cur.hi), hi: cur.hi } : { lo: cur.lo, hi: clamp(snap(leaf, cur.hi + d), cur.lo, leaf.max) };
        paint(next); onCommit(next);
      });
    }
    drag(lo, 'lo'); drag(hi, 'hi');
    track.addEventListener('pointerdown', (e) => {
      const v = valueAt(e.clientX);
      const next = Math.abs(v - cur.lo) <= Math.abs(v - cur.hi) ? { lo: Math.min(v, cur.hi), hi: cur.hi } : { lo: cur.lo, hi: Math.max(v, cur.lo) };
      paint(next); onCommit(next);
    });
    return { el: wrap, paint };
  }

  // ---------- the charts ----------
  function chart(leaf, size = {}) {
    if (leaf.plot === 'counts' || leaf.plot === 'categories') return pickChart(leaf, size);
    return rangeChart(leaf, size);
  }
  const commitRange = (leaf) => (f) => { if (f.lo <= leaf.min && f.hi >= leaf.max) filters.delete(leaf.id); else filters.set(leaf.id, f); changed(); };

  // Histogram or strip plot: brush the chart, or use the range slider underneath.
  function rangeChart(leaf, { width = 196, height = 54 } = {}) {
    const box = el('div', 'pm-hist pm-' + leaf.plot);
    const span = (leaf.max - leaf.min) || 1;
    const xOf = (v) => ((v - leaf.min) / span) * (width - 8) + 4;
    const vOf = (x) => leaf.min + clamp((x - 4) / (width - 8), 0, 1) * span;
    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'pm-svg', role: 'img', 'aria-label': `${leaf.name}: ${leaf.plot === 'strip' ? 'one dot per sentence' : 'distribution'} across ${leaf.values.size} sentences. Drag to filter.` });
    const sel = svgEl('rect', { class: 'pm-sel', x: 0, y: 0, width: 0, height, rx: 3 });
    svg.append(sel);
    const marks = [];
    if (leaf.plot === 'strip') {
      const seen = new Map();
      const r = Math.max(2.2, Math.min(3.4, width / leaf.values.size / 2.2));
      for (const v of leaf.values.values()) {
        const k = Math.round(xOf(v) / (r * 2));
        const stack = seen.get(k) || 0; seen.set(k, stack + 1);
        const c = svgEl('circle', { class: 'pm-dot', cx: xOf(v), cy: Math.max(r + 1, height - r - 2 - stack * (r * 2 + 1)), r });
        svg.append(c); marks.push({ node: c, lo: v, hi: v });
      }
    } else {
      const s1 = leaf.max - leaf.min;
      const unit = leaf.integer && s1 < 18;
      const count = unit ? s1 + 1 : Math.min(18, Math.max(6, Math.ceil(Math.sqrt(leaf.values.size) * 2)));
      const w = unit ? 1 : (s1 || 1) / count;
      const bins = Array.from({ length: count }, (_, i) => ({ lo: leaf.min + i * w, hi: i === count - 1 ? leaf.max : leaf.min + (i + 1) * w - (unit ? 0 : 1e-9), n: 0 }));
      for (const v of leaf.values.values()) bins[Math.min(count - 1, Math.floor((v - leaf.min) / w))].n++;
      const peak = Math.max(1, ...bins.map((b) => b.n));
      const bw = (width - 8) / count;
      bins.forEach((b, i) => {
        const h = b.n ? Math.max(2, (b.n / peak) * (height - 4)) : 0;
        const r = svgEl('rect', { class: 'pm-bar', x: 4 + i * bw + 1, y: height - h, width: Math.max(1, bw - 2), height: h, rx: 1.5 });
        svg.append(r); marks.push({ node: r, lo: b.lo, hi: b.hi, x0: 4 + i * bw, x1: 4 + (i + 1) * bw });
      });
    }
    const axis = el('div', 'pm-axis'); axis.append(el('span', '', fmt(leaf.min, leaf)), el('span', '', fmt(leaf.max, leaf) + (leaf.unit ? ' ' + leaf.unit : '')));
    const cap = caption(leaf, () => { filters.delete(leaf.id); changed(); });
    const slider = rangeSlider(leaf, (f) => { filters.set(leaf.id, f); paint(f); live(); }, commitRange(leaf));
    box.append(svg, slider.el, axis, cap.cap);
    function paint(f = filters.get(leaf.id)) {
      marks.forEach((m) => m.node.classList.toggle('in', !!f && m.hi >= f.lo && m.lo <= f.hi));
      svg.classList.toggle('filtered', !!f);
      if (f) { const a = xOf(f.lo), b = xOf(f.hi); sel.setAttribute('x', Math.max(0, a - 3)); sel.setAttribute('width', Math.max(6, b - a + 6)); } else sel.setAttribute('width', 0);
      slider.paint(f); cap.set(f);
    }
    let start = null;
    const local = (e) => { const r = svg.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * width; };
    function rangeFrom(a, b) {
      if (Math.abs(b - a) < 4) { // a tap picks the mark under it
        const hit = marks.find((m) => (m.x0 ?? xOf(m.lo) - 4) <= a && a <= (m.x1 ?? xOf(m.hi) + 4));
        if (hit) return { lo: hit.lo, hi: hit.hi };
      }
      return { lo: snap(leaf, vOf(Math.min(a, b))), hi: snap(leaf, vOf(Math.max(a, b))) };
    }
    svg.addEventListener('pointerdown', (e) => { e.preventDefault(); svg.setPointerCapture(e.pointerId); start = local(e); });
    svg.addEventListener('pointermove', (e) => { if (start != null) paint(rangeFrom(start, local(e))); });
    svg.addEventListener('pointerup', (e) => {
      if (start == null) return;
      const f = rangeFrom(start, local(e)); start = null;
      const cur = filters.get(leaf.id);
      if (cur && !cur.set && Math.abs(cur.lo - f.lo) < 1e-6 && Math.abs(cur.hi - f.hi) < 1e-6) filters.delete(leaf.id); else filters.set(leaf.id, f);
      changed();
    });
    svg.addEventListener('pointercancel', () => { start = null; paint(); });
    paint();
    return box;
  }

  // Counts (small whole numbers, vertical bars) and categories (text, a bar list):
  // tap values on and off.
  function pickChart(leaf, { height = 54 } = {}) {
    const box = el('div', 'pm-hist pm-' + leaf.plot);
    let values;
    if (leaf.plot === 'counts') { values = []; for (let v = leaf.min; v <= leaf.max; v++) values.push(v); }
    else values = [...new Set(leaf.values.values())];
    const n = new Map(values.map((v) => [v, 0])); for (const v of leaf.values.values()) n.set(v, (n.get(v) || 0) + 1);
    if (leaf.plot === 'categories') values.sort((a, b) => n.get(b) - n.get(a) || String(a).localeCompare(b));
    const peak = Math.max(1, ...n.values());
    const row = el('div', 'pm-pick'); row.setAttribute('role', 'group'); row.setAttribute('aria-label', `${leaf.name}: tap values to filter`);
    const f = filters.get(leaf.id);
    for (const v of values) {
      const on = !!f?.set?.has(v);
      const b = el('button', 'pm-pick-item' + (on ? ' on' : '')); b.type = 'button'; b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', `${fmt(v, leaf)}${leaf.unit ? ' ' + leaf.unit : ''}: ${n.get(v)} sentences`);
      const bar = el('span', 'pm-pick-bar');
      if (leaf.plot === 'counts') bar.style.height = Math.max(3, (n.get(v) / peak) * (height - 22)) + 'px';
      else bar.style.width = Math.max(2, (n.get(v) / peak) * 100) + '%';
      if (leaf.plot === 'counts') b.append(el('span', 'pm-pick-n', String(n.get(v))), bar, el('span', 'pm-pick-v', fmt(v, leaf)));
      else b.append(el('span', 'pm-pick-v', fmt(v, leaf)), el('span', 'pm-pick-track', null), el('span', 'pm-pick-n', String(n.get(v))));
      if (leaf.plot === 'categories') b.querySelector('.pm-pick-track').append(bar);
      b.addEventListener('click', () => {
        const set = new Set(filters.get(leaf.id)?.set || []);
        set.has(v) ? set.delete(v) : set.add(v);
        if (set.size) filters.set(leaf.id, { set }); else filters.delete(leaf.id);
        changed();
      });
      row.append(b);
    }
    const cap = caption(leaf, () => { filters.delete(leaf.id); changed(); });
    box.append(row);
    if (leaf.plot === 'counts' && leaf.unit) { const u = el('div', 'pm-axis'); u.append(el('span', ''), el('span', '', leaf.unit)); box.append(u); }
    box.append(cap.cap);
    box.classList.toggle('filtered', !!f);
    cap.set(f);
    return box;
  }

  // ---------- the tree: collapsed by default; a chart only when its row is open ----------
  const ICON = { right: 'm9 6 6 6-6 6', down: 'm6 9 6 6 6-6' };
  const chev = (dir) => { const s = svgEl('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }); s.append(svgEl('path', { d: ICON[dir] })); return s; };
  function tree(list, opts, depth = 0) {
    const ul = el('ul', 'pm-list' + (depth ? ' pm-sub' : ''));
    for (const p of list || []) {
      const li = el('li', 'pm-item');
      const leaf = LEAVES.get(p.id);
      const kids = (p.children || []).length > 0;
      const open = leaf ? openLeaves.has(p.id) : openGroups.has(p.id);
      const row = el('div', 'pm-row' + (leaf && filters.has(p.id) ? ' filtered' : '') + (open ? ' open' : ''));
      const btn = el('button', 'pm-name'); btn.type = 'button';
      btn.setAttribute('aria-expanded', String(open));
      btn.append(chev(open ? 'down' : 'right'), el('span', 'pm-label', p.name));
      if (leaf && filters.has(p.id)) btn.append(el('span', 'pm-badge', describe(leaf, filters.get(p.id))));
      btn.addEventListener('click', () => { const set = leaf ? openLeaves : openGroups; set.has(p.id) ? set.delete(p.id) : set.add(p.id); changed(); });
      row.append(btn); li.append(row);
      if (open && leaf) li.append(chart(leaf, opts.size));
      if (open && kids) li.append(tree(p.children, opts, depth + 1));
      ul.append(li);
    }
    return ul;
  }

  const railBlock = el('section', 'pm-rail'); railBlock.setAttribute('aria-label', 'Parametric tags');
  function drawRail() {
    const rail = document.getElementById('reading-tag-rail');
    if (!rail) return;
    // In the margin, all parameters fold under one row so they cost one line until opened.
    railBlock.replaceChildren(tree([{ id: 'p-root', name: 'Parameters', children: TREE }], { size: { width: 190, height: 50 } }));
    if (rail.firstChild !== railBlock) rail.prepend(railBlock);
  }
  const dock = el('div', 'pm-dock'); dock.hidden = true;
  document.body.append(dock);
  const X_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const CHART_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V11M10 19V6M15 19v-9M20 19v-5"/></svg>';
  function drawDock() {
    dock.replaceChildren();
    if (!filters.size) { dock.hidden = true; return; }
    const m = matches();
    const icon = el('span', 'dock-icon'); icon.innerHTML = CHART_ICON;
    const label = el('span', 'dock-label', [...filters].map(([id, f]) => `${LEAVES.get(id).name} ${describe(LEAVES.get(id), f)}`).join(' · '));
    const count = el('span', 'dock-count', `${m.size} sentence${m.size === 1 ? '' : 's'}`);
    const x = el('button', 'dock-x'); x.type = 'button'; x.innerHTML = X_ICON; x.setAttribute('aria-label', 'Clear parameter filters');
    x.addEventListener('click', () => { filters.clear(); changed(); });
    dock.append(icon, label, count, x); dock.hidden = false;
  }
  const rail = document.getElementById('reading-tag-rail');
  // A heading over the rail: "Tag tree". Hovering, focusing or tapping it unfolds a short note in small
  // text right underneath (no floating card), which folds away by itself when the pointer leaves.
  const railHead = el('div', 'rail-head');
  railHead.innerHTML = '<button class="rail-title" type="button" aria-expanded="false" aria-controls="rail-note">Tag tree</button>'
    + '<div class="rail-note" id="rail-note"><div><p>An index of ideas, like the index at the back of a book, but for what each sentence does: its role, how it is supported, what it is about.</p>'
    + '<p>Hover a tag to light up its sentences; click to keep them lit. A tag includes everything under it. Parameters are measures you can filter by.</p></div></div>';
  {
    const btn = railHead.querySelector('.rail-title');
    let timer = 0;
    const show = (on) => { clearTimeout(timer); railHead.classList.toggle('open', on); btn.setAttribute('aria-expanded', String(on)); };
    const later = (ms) => { clearTimeout(timer); timer = setTimeout(() => show(false), ms); };
    railHead.addEventListener('pointerenter', (e) => { if (e.pointerType !== 'touch') show(true); });
    railHead.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch' && !railHead.contains(document.activeElement)) later(500); });
    btn.addEventListener('focus', () => show(true));
    btn.addEventListener('blur', () => later(300));
    btn.addEventListener('click', () => { const on = !railHead.classList.contains('open'); show(on); if (on) later(9000); });
  }
  if (rail) new MutationObserver(() => { if (rail.firstChild !== railHead || railHead.nextSibling !== railBlock) rail.prepend(railHead, railBlock); }).observe(rail, { childList: true });
  if (rail) rail.prepend(railHead, railBlock);
  drawRail(); drawDock();

  window.TraceParams = {
    TREE, LEAVES, filters, matches, sentences,
    histogram: chart, chart,
    tree: (opts = {}) => tree(TREE, { size: { width: 260, height: 64 }, ...opts }),
    clear: () => { filters.clear(); changed(); },
    setRange: (id, range) => { if (!range) filters.delete(id); else filters.set(id, Array.isArray(range) ? { lo: range[0], hi: range[1] } : range); changed(); },
    onChange: (f) => listeners.add(f),
  };
})();
