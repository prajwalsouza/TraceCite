// Flow: a structural analysis of how a document moves between its tags.
// Generated from the trace data; nothing here is stored in the document.
//
// The reader picks a level (sections, paragraphs, sentences) and a tag family.
// Every unit at that level is labelled with the main tag it carries in the
// family (the most frequent first-level tag among its sentences). Then:
//   Path         the order the document moves through those tags, repeats collapsed
//   Transitions  a Markov-style chart: how often one tag is followed by another,
//                shown once some tag is followed by others at least `minTransitions` times
// Both are patterns in this one document, never causes. Each can be copied as Mermaid.
//
// Optional trace data: "flow": { "families": ["role", "support"], "minTransitions": 3 }
(function () {
  'use strict';
  const doc = window.OUTLINE_SEED || { blocks: [], tagTree: [] };
  const CONFIG = { minTransitions: 3, ...(doc.flow || {}) };
  const HIDE = /^(collab-|heading$|document-structure|math$|xref$|links$)/;
  const TONE = { move: 'plum', role: 'blue', support: 'amber', topic: 'green', 'learning-topics': 'green', revision: 'plum', planning: 'plum' };

  // ---------- data ----------
  const families = (doc.tagTree || []).filter((t) => !HIDE.test(t.id) && (t.children || []).length && (!CONFIG.families || CONFIG.families.includes(t.id)));
  const firstLevel = new Map();           // any tag id -> [family id, first-level tag]
  for (const fam of families) for (const top of fam.children || []) (function walk(t) { firstLevel.set(t.id, [fam.id, top]); (t.children || []).forEach(walk); })(top);
  const sentencesOf = (b) => { const out = []; (function w(x) { for (const c of x.children || []) { if (c.type === 'sentence') out.push(c); w(c); } })(b); return out; };
  const paragraphs = []; (function w(bs) { for (const b of bs || []) { if (b.type === 'paragraph') paragraphs.push(b); w(b.children); } })(doc.blocks);
  const allSentences = (doc.blocks || []).flatMap((b) => (b.type === 'sentence' ? [b] : sentencesOf(b)));
  const LEVELS = [
    { id: 'sections', name: 'Sections', units: () => (doc.blocks || []).filter((b) => b.type === 'section').map((b) => ({ id: b.id, name: b.text, block: b, sentences: sentencesOf(b) })) },
    { id: 'paragraphs', name: 'Paragraphs', units: () => paragraphs.map((b) => ({ id: b.id, name: b.text, block: b, sentences: sentencesOf(b) })) },
    { id: 'sentences', name: 'Sentences', units: () => allSentences.map((s) => ({ id: s.id, name: s.text, sentences: [s] })) },
  ];

  function summarise(seq, names) {
    const runs = [];
    for (const step of seq) { const last = runs[runs.length - 1]; if (last && last.state === step.state) last.units.push(step.unit); else runs.push({ state: step.state, units: [step.unit] }); }
    const trans = new Map(); const out = new Map(); const freq = new Map();
    seq.forEach((s) => freq.set(s.state, (freq.get(s.state) || 0) + 1));
    for (let i = 0; i + 1 < seq.length; i++) { const k = seq[i].state + '→' + seq[i + 1].state; trans.set(k, (trans.get(k) || 0) + 1); out.set(seq[i].state, (out.get(seq[i].state) || 0) + 1); }
    const order = []; for (const s of seq) if (!order.includes(s.state)) order.push(s.state);
    const edges = [...trans].map(([k, n]) => { const [x, y] = k.split('→'); return { id: k, a: x, b: y, n, p: n / out.get(x) }; });
    const ready = [...out.values()].some((n) => n >= CONFIG.minTransitions);
    return { seq, names, runs, edges, order, freq, out, ready };
  }

  // ---------- automatic labelling: which tags carry the structure? ----------
  // Every family (and, for nested families, its second level) is a candidate set of
  // states. Each is scored by how predictable the next unit's state becomes
  // (1 - conditional entropy / max entropy), times how many units it covers, with a
  // penalty for too few or too many states. The best one is used, and the page says so.
  function candidates() {
    const out = [];
    for (const fam of families) {
      out.push({ id: fam.id, name: fam.name, map: (t) => { const h = firstLevel.get(t); return h && h[0] === fam.id ? [h[1].id, h[1].name] : null; } });
      const deep = new Map();
      for (const top of fam.children || []) for (const c of top.children || []) (function w(t) { deep.set(t.id, c); (t.children || []).forEach(w); })(c);
      if (deep.size) out.push({ id: fam.id + '·2', name: fam.name + ' (detail)', map: (t) => { const d = deep.get(t); if (d) return [d.id, d.name]; const h = firstLevel.get(t); return h && h[0] === fam.id && !(h[1].children || []).length ? [h[1].id, h[1].name] : null; } });
    }
    return out;
  }
  function labelWith(levelId, cand) {
    const level = LEVELS.find((l) => l.id === levelId);
    const units = level.units(); const seq = []; const names = new Map();
    for (const u of units) {
      // A paragraph's or section's own tag states the author's intent; it wins over a vote.
      const own = (u.block?.tags || []).map((t) => cand.map(t)).find(Boolean);
      if (own) { names.set(own[0], own[1]); seq.push({ state: own[0], unit: u }); continue; }
      const counts = new Map(), first = new Map();
      u.sentences.forEach((s, i) => (s.tags || []).forEach((t) => { const m = cand.map(t); if (!m) return; names.set(m[0], m[1]); counts.set(m[0], (counts.get(m[0]) || 0) + 1); if (!first.has(m[0])) first.set(m[0], i); }));
      if (!counts.size) continue;
      seq.push({ state: [...counts].sort((a, b) => b[1] - a[1] || first.get(a[0]) - first.get(b[0]))[0][0], unit: u });
    }
    return { seq, names, units: units.length };
  }
  // Score a labelling by the information the current tag carries about the next one:
  // I = H(next) - H(next | current), in bits, with add-0.5 smoothing so moves seen once
  // do not count as certainty. More kinds can explain more, but only if the pattern repeats.
  function score(seqAll, unitsTotal) {
    // Structure is what follows a change, so repeats are collapsed before scoring.
    const seq = seqAll.filter((s, i) => i === 0 || s.state !== seqAll[i - 1].state);
    const states = [...new Set(seq.map((s) => s.state))]; const k = states.length;
    if (seq.length < 3 || k < 2) return { score: 0, predictability: 0, k, coverage: 0 };
    const alpha = 0.5, idx = new Map(states.map((s, i) => [s, i]));
    const n = states.map(() => states.map(() => 0));
    for (let i = 0; i + 1 < seq.length; i++) n[idx.get(seq[i].state)][idx.get(seq[i + 1].state)]++;
    const total = seq.length - 1;
    const rowN = n.map((r) => r.reduce((x, y) => x + y, 0));
    const colP = states.map((_, j) => (n.reduce((x, r) => x + r[j], 0) + alpha) / (total + k * alpha));
    const H = (ps) => -ps.reduce((h, p) => h + (p > 0 ? p * Math.log2(p) : 0), 0);
    // With repeats collapsed the next tag always differs, so the fair baseline is
    // "any other tag, in proportion to how common it is", not "any tag". Two kinds
    // therefore carry no structure (they can only alternate).
    let Hnext = 0, Hcond = 0;
    n.forEach((r, i) => {
      if (!rowN[i]) return; const w = rowN[i] / total;
      const others = colP.map((p, j) => (j === i ? 0 : p)); const z = others.reduce((x, y) => x + y, 0) || 1;
      Hnext += w * H(others.map((p) => p / z));
      Hcond += w * H(r.map((c, j) => (j === i ? 0 : (c + alpha) / (rowN[i] - r[i] + (k - 1) * alpha))));
    });
    const info = Math.max(0, Hnext - Hcond);
    const coverage = seqAll.length / Math.max(1, unitsTotal);
    const sizeFit = k > 8 ? 8 / k : 1;
    return { score: info * coverage * sizeFit * Math.min(1, total / 4), predictability: Hnext ? info / Hnext : 0, coverage, k, bits: info };
  }
  function choose(levelId) {
    let best = null;
    for (const cand of candidates()) {
      if (CONFIG.families && !CONFIG.families.includes(cand.id.split('·')[0])) continue;
      const lab = labelWith(levelId, cand); const sc = score(lab.seq, lab.units);
      if (!best || sc.score > best.sc.score) best = { cand, lab, sc };
    }
    return best;
  }

  // ---------- from transitions to an approximate flowchart ----------
  // Main line: start where the document starts and follow the most frequent next
  // tag not yet on the line. Other frequent moves become branches; moves back become
  // returns; a tag that often repeats is marked as such.
  function infer(a) {
    if (!a.seq.length) return { nodes: [], edges: [] };
    const outs = (s) => a.edges.filter((e) => e.a === s && e.b !== s).sort((x, y) => y.n - x.n || y.p - x.p);
    const main = [a.seq[0].state]; const on = new Set(main);
    for (let cur = main[0]; ;) { const next = outs(cur).find((e) => !on.has(e.b)); if (!next) break; main.push(next.b); on.add(next.b); cur = next.b; }
    const rank = new Map(main.map((s, i) => [s, i]));
    const side = a.order.filter((s) => !on.has(s));
    const edges = [];
    for (let i = 0; i + 1 < main.length; i++) { const e = a.edges.find((x) => x.a === main[i] && x.b === main[i + 1]); edges.push({ ...e, role: 'main' }); }
    for (const e of a.edges) {
      if (e.a === e.b || edges.some((x) => x.id === e.id)) continue;
      if (e.n < 2 && e.p < 0.34) continue;                        // too rare to call structure
      const back = rank.has(e.a) && rank.has(e.b) && rank.get(e.b) < rank.get(e.a);
      edges.push({ ...e, role: back ? 'return' : 'branch' });
    }
    const repeats = new Map(a.edges.filter((e) => e.a === e.b && e.p >= 0.3).map((e) => [e.a, e]));
    return { main, side, edges, repeats };
  }
  // The inferred flowchart. Wide canvases run the main line left to right (returns
  // alternate above and below in their own lanes, branches hang below); narrow ones
  // stack it top to bottom (returns alternate left and right). Labels sit at each
  // curve's middle; cards carry their tag's icon.
  function layoutFlow(a, f, W) {
    const label = (s) => a.names.get(s) || s;
    const ICON_W = 18;
    const cw = (s) => cardW(label(s)) + ICON_W;
    const n = f.main.length;
    const horizontal = W >= 640 && n > 1 && n * 150 <= W - 40;
    const nodes = []; const pos = new Map();
    const add = (s, x, y, kind) => { const d = { id: 'f-' + s, key: s, state: s, text: label(s), meta: '', icon: true, kind, x, y, w: cw(s), h: fitLabel(label(s), cw(s), true).h }; nodes.push(d); pos.set(s, d); };
    let H;
    if (horizontal) {
      const margin = 24 + Math.max(...f.main.map(cw)) / 2;
      const y = 170;
      f.main.forEach((s, i) => add(s, n === 1 ? W / 2 : margin + (i * (W - margin * 2)) / (n - 1), y, 'tag'));
      const below = new Map();
      f.side.forEach((s, i) => {
        const from = f.edges.filter((e) => e.b === s && pos.has(e.a)).sort((x, z) => z.n - x.n)[0];
        const base = from ? pos.get(from.a) : { x: W / 2, y };
        const k = below.get(base.x) || 0; below.set(base.x, k + 1);
        add(s, Math.max(cw(s) / 2 + 8, Math.min(W - cw(s) / 2 - 8, base.x + k * 30)), y + 110 + k * 54, 'side');
      });
      H = Math.max(360, Math.max(...nodes.map((d) => d.y + d.h / 2)) + 60);
    } else {
      const gap = 88, cx = W / 2 - (f.side.length ? 60 : 0);
      f.main.forEach((s, i) => add(s, cx, 30 + i * gap, 'tag'));
      f.side.forEach((s, i) => {
        const from = f.edges.filter((e) => e.b === s && pos.has(e.a)).sort((x, z) => z.n - x.n)[0];
        const y0 = from ? pos.get(from.a).y + gap / 2 : 30 + (n + i) * gap;
        add(s, Math.min(W - cw(s) / 2 - 8, cx + 200 + (i % 2) * 40), y0, 'side');
      });
      H = Math.max(420, Math.max(...nodes.map((d) => d.y + d.h / 2)) + 50);
    }
    const edges = []; const maxN = Math.max(1, ...f.edges.map((e) => e.n || 1));
    const lanes = [0, 0];                                         // returns placed so far on each side
    const rank = new Map(f.main.map((s, i) => [s, i]));
    for (const e of f.edges) {
      const s = pos.get(e.a), t = pos.get(e.b); if (!s || !t) continue;
      let c;
      if (e.role === 'main') {
        c = horizontal ? [P(s.x + s.w / 2, s.y), P(s.x + s.w / 2 + 24, s.y), P(t.x - t.w / 2 - 24, t.y), P(t.x - t.w / 2, t.y)]
                       : [P(s.x, s.y + s.h / 2), P(s.x, s.y + s.h / 2 + 18), P(t.x, t.y - t.h / 2 - 18), P(t.x, t.y - t.h / 2)];
      } else if (e.role === 'return') {
        const side = lanes[0] <= lanes[1] ? 0 : 1; const lane = lanes[side]++;
        const span = Math.abs((rank.get(e.a) ?? 0) - (rank.get(e.b) ?? 0));
        if (horizontal) {
          const dir = side === 0 ? -1 : 1; const h = 46 + 22 * span + 16 * lane;
          c = [P(s.x - 8, s.y + dir * s.h / 2), P(s.x - 8, s.y + dir * (s.h / 2 + h)), P(t.x + 8, t.y + dir * (t.h / 2 + h)), P(t.x + 8, t.y + dir * t.h / 2)];
        } else {
          const left = side === 0; const edge = (d) => d.x + (left ? -d.w / 2 : d.w / 2);
          const lx = (left ? Math.min(edge(s), edge(t)) - 34 - 16 * lane : Math.max(edge(s), edge(t)) + 34 + 16 * lane) + (left ? -10 : 10) * (span - 1);
          c = [P(edge(s), s.y), P(lx, s.y), P(lx, t.y), P(edge(t), t.y)];
        }
      } else if (horizontal) {
        const down = t.y > s.y + 1;
        c = down ? [P(s.x, s.y + s.h / 2), P(s.x, s.y + s.h / 2 + 40), P(t.x, t.y - t.h / 2 - 40), P(t.x, t.y - t.h / 2)]
                 : [P(s.x, s.y - s.h / 2), P(s.x, s.y - s.h / 2 - 40), P(t.x, t.y + t.h / 2 + 40), P(t.x, t.y + t.h / 2)];
      } else {
        const sx = s.x + (t.x > s.x ? s.w / 2 : -s.w / 2), tx = t.x + (t.x > s.x ? -t.w / 2 : t.w / 2);
        c = [P(sx, s.y), P((sx + tx) / 2, s.y), P((sx + tx) / 2, t.y), P(tx, t.y)];
      }
      const mid = at(c, 0.5);
      const label2 = e.role === 'main' ? (horizontal ? P(mid.x, mid.y - 9) : P(mid.x + 24, mid.y + 4)) : P(mid.x, mid.y + 4);
      edges.push({ id: 'f' + e.id, a: e.a, b: e.b, c, label: label2, w: 1.2 + 3 * ((e.n || 1) / maxN), text: `${Math.round(e.p * 100)}%`, n: e.n, p: e.p, weak: e.role !== 'main', role: e.role });
    }
    return { nodes, edges, H };
  }

  // ---------- geometry: cubic Béziers, trimmed for arrowheads ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  const P = (x, y) => ({ x, y });
  const at = (c, t) => { const u = 1 - t; return P(u * u * u * c[0].x + 3 * u * u * t * c[1].x + 3 * u * t * t * c[2].x + t * t * t * c[3].x, u * u * u * c[0].y + 3 * u * u * t * c[1].y + 3 * u * t * t * c[2].y + t * t * t * c[3].y); };
  // de Casteljau: the part of the curve from 0 to t.
  function head(c, t) {
    const m = (p, q) => P(lerp(p.x, q.x, t), lerp(p.y, q.y, t));
    const a = m(c[0], c[1]), b = m(c[1], c[2]), d = m(c[2], c[3]), e = m(a, b), f = m(b, d), g = m(e, f);
    return [c[0], a, e, g];
  }
  // de Casteljau: the part of the curve from t to 1.
  function tailFrom(c, t) {
    const m = (p, q) => P(lerp(p.x, q.x, t), lerp(p.y, q.y, t));
    const a = m(c[0], c[1]), b = m(c[1], c[2]), d = m(c[2], c[3]), e = m(a, b), f = m(b, d), g = m(e, f);
    return [g, f, d, c[3]];
  }
  // Stop a few pixels short of the card so the arrowhead never merges into its border.
  function pullBack(c, gap) {
    const d = P(c[3].x - c[2].x, c[3].y - c[2].y); let m = Math.hypot(d.x, d.y);
    const u = m > 0.01 ? P(d.x / m, d.y / m) : (() => { const t = P(c[3].x - c[0].x, c[3].y - c[0].y); const n = Math.hypot(t.x, t.y) || 1; return P(t.x / n, t.y / n); })();
    return [c[0], c[1], P(c[2].x - u.x * gap, c[2].y - u.y * gap), P(c[3].x - u.x * gap, c[3].y - u.y * gap)];
  }
  // The tangent (first derivative) of the curve at t.
  const tangent = (c, t) => { const u = 1 - t; return P(3 * u * u * (c[1].x - c[0].x) + 6 * u * t * (c[2].x - c[1].x) + 3 * t * t * (c[3].x - c[2].x), 3 * u * u * (c[1].y - c[0].y) + 6 * u * t * (c[2].y - c[1].y) + 3 * t * t * (c[3].y - c[2].y)); };
  // The parameter where the curve is `dist` (straight-line) away from its end.
  // Where a circle of radius `dist` around the tip crosses the curve (the last crossing),
  // found by stepping back then bisecting to sub-pixel accuracy.
  function tBack(c, dist) {
    const tip = c[3]; const d = (t) => { const p = at(c, t); return Math.hypot(p.x - tip.x, p.y - tip.y); };
    let hi = 1, lo = 1; const step = 0.01;
    while (lo > 0 && d(lo) < dist) { hi = lo; lo = Math.max(0, lo - step); }
    if (d(lo) < dist) return 0;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (d(m) >= dist) lo = m; else hi = m; }
    return lo;
  }
  // The arrowhead sits square on the end of the line: it points along the chord of
  // exactly the stretch it covers (one head-length back to the tip), and the line
  // stops at the tip. On curves this matches what the eye reads as the line's end.
  function arrowed(c, len) {
    const tip = c[3];
    const base = at(c, tBack(c, len));
    const ang = Math.atan2(tip.y - base.y, tip.x - base.x);
    return { body: head(c, Math.max(0.02, tBack(c, 0.6))), tip, ang };
  }
  const head4 = (c, t) => head(c, t);
  const path = (c) => `M${c[0].x.toFixed(1)},${c[0].y.toFixed(1)} C${c[1].x.toFixed(1)},${c[1].y.toFixed(1)} ${c[2].x.toFixed(1)},${c[2].y.toFixed(1)} ${c[3].x.toFixed(1)},${c[3].y.toFixed(1)}`;
  // An open, pencil-drawn head: two equal strokes at equal angles, meeting at the tip.
  function arrowHead(tip, ang, len, w) {
    const spread = Math.atan2(w, len);
    const a1 = ang + Math.PI - spread, a2 = ang + Math.PI + spread;
    const p1 = P(tip.x + Math.cos(a1) * len, tip.y + Math.sin(a1) * len), p2 = P(tip.x + Math.cos(a2) * len, tip.y + Math.sin(a2) * len);
    return `M${p1.x.toFixed(2)},${p1.y.toFixed(2)} L${tip.x.toFixed(2)},${tip.y.toFixed(2)} L${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---------- layouts ----------
  // Node cards in the Mermaid Replay manner: soft rounded cards, label, a quiet count beneath.
  const cardW = (t) => Math.max(84, Math.min(220, 28 + t.length * 7.1));
  const CARD_H = 32, CARD_H2 = 46, CH_W = 7.1;
  // Labels wrap to at most two lines inside the card; beyond that the second line ends in an ellipsis.
  const fitLabel = (text, w, icon) => {
    const max = Math.max(6, Math.floor((w - (icon ? 42 : 24)) / CH_W));
    if (text.length <= max) return { lines: [text], h: CARD_H };
    const words = text.split(' '); let l1 = '', i = 0;
    for (; i < words.length; i++) { const t = (l1 ? l1 + ' ' : '') + words[i]; if (t.length > max) break; l1 = t; }
    if (!l1) return { lines: [text.slice(0, max - 1) + '…'], h: CARD_H };
    let l2 = words.slice(i).join(' ');
    if (l2.length > max) { l2 = l2.slice(0, max - 1); l2 = (l2.includes(' ') ? l2.replace(/\s+\S*$/, '') : l2) + '…'; }
    return { lines: [l1, l2], h: CARD_H2 };
  };
  // Path: runs left to right, wrapping into rows; rows join with an S-curve.
  function layoutPath(a, W) {
    const nodes = []; const gapX = 34, rowGap = 50, padX = 6;
    let x = padX, y = 14, row = 0;
    a.runs.forEach((r, i) => {
      const label = a.names.get(r.state) || r.state;
      const w = cardW(label + (r.units.length > 1 ? '  ×' + r.units.length : ''));
      if (x + w > W - padX && i > 0) { x = padX; y += CARD_H + rowGap; row++; }
      nodes.push({ id: `run-${i}`, key: `run-${i}`, state: r.state, text: label + (r.units.length > 1 ? `  ×${r.units.length}` : ''), meta: '', x: x + w / 2, y: y + CARD_H / 2, w, h: CARD_H, row, units: r.units, kind: 'run', index: i });
      x += w + gapX;
    });
    const edges = [];
    for (let i = 0; i + 1 < nodes.length; i++) {
      const s = nodes[i], t = nodes[i + 1];
      let c;
      if (s.row === t.row) c = [P(s.x + s.w / 2, s.y), P(s.x + s.w / 2 + 14, s.y), P(t.x - t.w / 2 - 14, t.y), P(t.x - t.w / 2, t.y)];
      else c = [P(s.x, s.y + s.h / 2), P(s.x, s.y + s.h / 2 + rowGap * 0.9), P(t.x, t.y - t.h / 2 - rowGap * 0.9), P(t.x, t.y - t.h / 2)];
      edges.push({ id: `step-${i}`, a: s.key, b: t.key, c, w: 1.5 });
    }
    const H = (nodes.length ? Math.max(...nodes.map((d) => d.y + d.h / 2)) : 0) + 14;
    return { nodes, edges, H };
  }
  // Transitions: an arc diagram. Tags in order of first appearance; forward moves arc
  // above, backward below, repeats loop off the card. Narrow screens stack it vertically.
  function layoutArcs(a, W) {
    const n = a.order.length; const vertical = W < 560;
    const maxN = Math.max(1, ...a.edges.map((e) => e.n));
    const card = (s) => { const text = a.names.get(s) || s; return { text, w: cardW(text) }; };
    const nodes = []; const pos = new Map();
    let H, edgeFor;
    if (!vertical) {
      const margin = 16 + Math.max(...a.order.map((s) => card(s).w)) / 2;
      const xs = a.order.map((s, i) => (n === 1 ? W / 2 : margin + (i * (W - margin * 2)) / (n - 1)));
      const heightOf = (dx) => Math.min(130, 26 + 0.3 * dx);
      let up = 54, down = 24;
      for (const e of a.edges) { if (e.a === e.b) continue; const i = a.order.indexOf(e.a), j = a.order.indexOf(e.b); const h = heightOf(Math.abs(xs[j] - xs[i])); if (j > i) up = Math.max(up, h + 22); else down = Math.max(down, h + 22); }
      const y = up + CARD_H / 2 + 4;
      a.order.forEach((s, i) => { const c = card(s); const d = { id: 'tag-' + s, key: s, state: s, text: c.text, meta: `${a.freq.get(s) || 0}`, x: xs[i], y, w: c.w, h: fitLabel(c.text, c.w, false).h, kind: 'tag' }; nodes.push(d); pos.set(s, d); });
      edgeFor = (e, s, t) => {
        if (e.a === e.b) { const ex = s.x + s.w / 2, ey = s.y - s.h / 2; return { c: [P(ex - 16, ey), P(ex - 16, ey - 34), P(ex + 26, ey - 28), P(ex + 4, ey - 2)], label: P(ex + 8, ey - 32) }; }
        const fwd = t.x > s.x; const dir = fwd ? -1 : 1; const h = heightOf(Math.abs(t.x - s.x)); const off = 6;
        const sx = s.x + (fwd ? off : -off), tx = t.x + (fwd ? -off : off);
        const c = [P(sx, s.y + dir * s.h / 2), P(sx, s.y + dir * (s.h / 2 + h)), P(tx, t.y + dir * (t.h / 2 + h)), P(tx, t.y + dir * t.h / 2)];
        return { c, label: at(c, 0.5) };
      };
      H = y + CARD_H / 2 + down + 18;
    } else {
      const gap = 58, x0 = 8;
      a.order.forEach((s, i) => { const c = card(s); const d = { id: 'tag-' + s, key: s, state: s, text: c.text, meta: '', x: x0 + c.w / 2, y: 30 + i * gap, w: c.w, h: CARD_H, kind: 'tag' }; nodes.push(d); pos.set(s, d); });
      edgeFor = (e, s, t) => {
        const rx = (d) => d.x + d.w / 2;
        if (e.a === e.b) { const ex = rx(s), ey = s.y; return { c: [P(ex, ey - 6), P(ex + 30, ey - 22), P(ex + 30, ey + 22), P(ex + 2, ey + 6)], label: P(ex + 40, ey + 4) }; }
        const down = t.y > s.y; const h = 34 + 0.55 * Math.abs(t.y - s.y); const off = down ? -5 : 5;
        const m = Math.max(rx(s), rx(t)) + h;
        const c = [P(rx(s), s.y + off), P(m, s.y + off), P(m, t.y - off), P(rx(t), t.y - off)];
        return { c, label: at(c, 0.5) };
      };
      H = 30 + (n - 1) * gap + CARD_H / 2 + 22;
    }
    const edges = [];
    for (const e of a.edges) {
      const s = pos.get(e.a), t = pos.get(e.b); if (!s || !t) continue;
      const g = edgeFor(e, s, t);
      edges.push({ id: e.id, a: e.a, b: e.b, c: g.c, label: g.label, w: 1.2 + 3.2 * (e.n / maxN), text: `${Math.round(e.p * 100)}%`, n: e.n, p: e.p, weak: e.n < 2 });
    }
    return { nodes, edges, H };
  }

  // Animation frames, with a timer fallback for throttled or background pages.
  function nextFrame(fn) {
    let done = false;
    const go = () => { if (!done) { done = true; fn(performance.now()); } };
    const id = requestAnimationFrame(go);
    setTimeout(() => { if (!done) { cancelAnimationFrame(id); go(); } }, 34);
  }

  // ---------- rendering with smooth transitions ----------
  // Each chart keeps its current geometry; a change tweens nodes and curves to the
  // new layout while new marks fade in and old ones fade out.
  function chart(kind) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'fl-svg fl-' + kind); svg.setAttribute('role', 'img');
    let cur = { nodes: new Map(), edges: new Map(), H: 120 }, raf = 0;
    const node = (d, o) => ({ ...d, o });
    function frame(from, to, t) {
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // ease in-out
      const mix = (a, b) => (a == null ? b : b == null ? a : lerp(a, b, e));
      const nodes = new Map(), edges = new Map();
      for (const id of new Set([...from.nodes.keys(), ...to.nodes.keys()])) {
        const a = from.nodes.get(id), b = to.nodes.get(id);
        const base = b || a;
        nodes.set(id, { ...base, x: mix(a?.x, b?.x), y: mix(a?.y, b?.y), w: mix(a?.w, b?.w), r: mix(a?.r, b?.r), o: lerp(a ? a.o : 0, b ? 1 : 0, e) });
      }
      for (const id of new Set([...from.edges.keys(), ...to.edges.keys()])) {
        const a = from.edges.get(id), b = to.edges.get(id); const base = b || a;
        const c = base.c.map((p, i) => P(mix(a?.c[i].x, b?.c[i].x), mix(a?.c[i].y, b?.c[i].y)));
        const label = base.label ? P(mix(a?.label?.x, b?.label?.x), mix(a?.label?.y, b?.label?.y)) : null;
        edges.set(id, { ...base, c, label, w: mix(a?.w, b?.w), o: lerp(a ? a.o : 0, b ? 1 : 0, e) });
      }
      return { nodes, edges, H: mix(from.H, to.H) };
    }
    // Pencil: a fine displacement roughens the graphite; a faint second stroke gives it grain.
    const pencilId = 'fl-pencil-' + kind + '-' + Math.random().toString(36).slice(2, 7);
    const defs = `<defs><filter id="${pencilId}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.15" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`;
    function paint(s, tone) {
      svg.setAttribute('viewBox', `0 0 ${width} ${Math.ceil(s.H)}`); svg.setAttribute('height', Math.ceil(s.H));
      let out = defs + `<g class="fl-vp" transform="${vpTransform()}">`;
      for (const e of s.edges.values()) {
        const sw = Math.max(1.25, e.w * 0.85);
        const len = 9 + e.w * 1.9, half = len * 0.5;
        const cc = pullBack(e.c, 3);
        const { body, tip, ang } = arrowed(cc, len);
        const head = arrowHead(tip, ang, len, half);
        // Dashed lines end in a solid stretch, so the head always sits on ink, not in a gap.
        const split = e.weak ? tBack(body, len * 1.6) : 1;
        const dashed = e.weak ? path(head4(body, split)) : path(body);
        const solid = e.weak ? `<path class="fl-line fl-tail" d="${path(tailFrom(body, split))}" style="stroke-width:${sw.toFixed(2)}"/>` : '';
        out += `<g class="fl-edge${e.weak ? ' weak' : ''}" data-id="${esc(e.id)}" data-a="${esc(e.a)}" data-b="${esc(e.b)}" style="opacity:${e.o.toFixed(3)}"><path class="fl-hit" d="${path(e.c)}"/><g class="fl-ink" filter="url(#${pencilId})"><path class="fl-line" d="${dashed}" style="stroke-width:${sw.toFixed(2)}"/>${solid}<path class="fl-line fl-grain" d="${path(body)}" transform="translate(0.55 0.35)" style="stroke-width:${(sw * 0.55).toFixed(2)}"/><path class="fl-arrow" d="${head}" style="stroke-width:${(sw + 0.15).toFixed(2)}"/></g>`;
        if (e.label && e.text) out += `<text class="fl-elabel" x="${e.label.x.toFixed(1)}" y="${(e.label.y + 3.5).toFixed(1)}" text-anchor="middle">${esc(e.text)}</text>`;
        out += '</g>';
      }
      for (const d of s.nodes.values()) {
        const x = d.x - d.w / 2, y = d.y - d.h / 2;
        const ico = d.icon && window.TraceTagIcon ? `<svg class="fl-ico" x="${(x + 11).toFixed(1)}" y="${(d.y - 7).toFixed(1)}" width="14" height="14" viewBox="0 0 24 24">${window.TraceTagIcon.inner(window.TraceTagIcon.iconFor(d.state, d.text))}</svg>` : '';
        // With an icon the label starts just after it (a chip), so the two never collide.
        const tx = d.icon ? x + 31 : d.x;
        out += `<g class="fl-node${d.kind === 'side' ? ' fl-side' : ''}" data-id="${esc(d.key)}" tabindex="0" role="button" style="opacity:${d.o.toFixed(3)}"><rect class="fl-card" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${d.w.toFixed(1)}" height="${d.h}" rx="11"/>${ico}${(() => { const f = fitLabel(d.text, d.w, d.icon), ls = d.h >= CARD_H2 ? f.lines : [f.lines.length > 1 ? f.lines[0] + '…' : f.lines[0]];
          return `<text class="fl-label" x="${tx.toFixed(1)}" y="${(d.y + (ls.length > 1 ? -3.5 : 4)).toFixed(1)}" text-anchor="${d.icon ? 'start' : 'middle'}">${ls.map((l, k) => `<tspan x="${tx.toFixed(1)}" dy="${k ? 15 : 0}">${esc(l)}</tspan>`).join('')}<title>${esc(d.text)}</title></text>`; })()}${d.meta ? `<text class="fl-meta" x="${d.x.toFixed(1)}" y="${(d.y + d.h / 2 + 13).toFixed(1)}" text-anchor="middle">${esc(d.meta)}</text>` : ''}</g>`;
      }
      out += '</g>';
      svg.innerHTML = out; svg.dataset.tone = tone;
      onPaint();
    }
    let onPaint = () => {};
    let width = 640;

    // ---------- pan and zoom ----------
    // Mouse: drag to pan; Cmd/Ctrl + wheel (and trackpad pinch) zooms at the pointer.
    // Touch: one finger sideways pans (vertical scrolls the page); two fingers pan and pinch.
    // A drag past 4 px never counts as a click. Double-click on empty space, the reset
    // button or 0 resets; + and − zoom while the chart has focus.
    const view = { x: 0, y: 0, k: 1 };
    const vpTransform = () => `translate(${view.x.toFixed(1)} ${view.y.toFixed(1)}) scale(${view.k.toFixed(3)})`;
    let onView = () => {};
    const applyView = () => { svg.querySelector('.fl-vp')?.setAttribute('transform', vpTransform()); svg.classList.toggle('fl-moved', view.x !== 0 || view.y !== 0 || view.k !== 1); onView(); };
    const toLocal = (cx, cy) => { const r = svg.getBoundingClientRect(); const sx = width / r.width; return P((cx - r.left) * sx, (cy - r.top) * sx); };
    function zoomAt(p, factor) { const k = Math.max(0.5, Math.min(3, view.k * factor)); const f = k / view.k; view.x = p.x - (p.x - view.x) * f; view.y = p.y - (p.y - view.y) * f; view.k = k; applyView(); }
    function resetView() { view.x = view.y = 0; view.k = 1; applyView(); }
    // Fit the whole chart into the canvas and centre it.
    function centerView() {
      const vp = svg.querySelector('.fl-vp'); if (!vp) return;
      let b; try { b = vp.getBBox(); } catch { return; }
      if (!b || !b.width || !b.height) { resetView(); return; }
      const H = svg.viewBox.baseVal?.height || 300, pad = 28;
      const k = Math.max(0.5, Math.min(1.6, (width - pad * 2) / b.width, (H - pad * 2) / b.height));
      view.k = k; view.x = (width - b.width * k) / 2 - b.x * k; view.y = (H - b.height * k) / 2 - b.y * k; applyView();
    }
    // ---------- moving single cards ----------
    // A card can be dragged on its own; its arrows reroute from the nearer sides, labels
    // follow and step aside. Positions persist through repaints until the layout is restored.
    const overrides = new Map();            // node key -> {x, y}
    let lastTone = 'neutral', onLayout = () => {};
    function route(s, t, offset = 0) {
      if (s === t) { const ex = s.x + s.w / 2, ey = s.y - s.h / 2; return [P(ex - 16, ey), P(ex - 16, ey - 34), P(ex + 26, ey - 28), P(ex + 4, ey - 2)]; }
      const dx = t.x - s.x, dy = t.y - s.y;
      if (Math.abs(dx) >= Math.abs(dy) * 1.2) {
        const g = Math.sign(dx) || 1, sx = s.x + g * s.w / 2, tx = t.x - g * t.w / 2, k = Math.max(24, Math.abs(tx - sx) * 0.45);
        return [P(sx, s.y + offset), P(sx + g * k, s.y + offset), P(tx - g * k, t.y + offset), P(tx, t.y + offset)];
      }
      const g = Math.sign(dy) || 1, sy = s.y + g * s.h / 2, ty = t.y - g * t.h / 2, k = Math.max(20, Math.abs(ty - sy) * 0.45);
      return [P(s.x + offset, sy), P(s.x + offset, sy + g * k), P(t.x + offset, ty - g * k), P(t.x + offset, ty)];
    }
    // Labels never overlap each other or sit on a card.
    function separateLabels(state) {
      const boxes = [...state.edges.values()].filter((e) => e.label && e.text).map((e) => ({ e, w: e.text.length * 6 + 10, h: 14, ax: e.label.x, ay: e.label.y }));
      // A label may step aside, but never far from its own curve.
      const clamp = (b) => { const dx = b.e.label.x - b.ax, dy = b.e.label.y - b.ay, d = Math.hypot(dx, dy), m = 22; if (d > m) b.e.label = P(b.ax + (dx / d) * m, b.ay + (dy / d) * m); };
      const cards = [...state.nodes.values()];
      for (let iter = 0; iter < 40; iter++) {
        let moved = false;
        for (let i = 0; i < boxes.length; i++) {
          const a = boxes[i];
          for (let j = i + 1; j < boxes.length; j++) {
            const b = boxes[j]; const ox = (a.w + b.w) / 2 - Math.abs(a.e.label.x - b.e.label.x), oy = (a.h + b.h) / 2 - Math.abs(a.e.label.y - b.e.label.y);
            if (ox > 0 && oy > 0) { const d = (oy / 2 + 0.5) * (a.e.label.y <= b.e.label.y ? 1 : -1); a.e.label = P(a.e.label.x, a.e.label.y - d); b.e.label = P(b.e.label.x, b.e.label.y + d); moved = true; }
          }
          for (const c of cards) {
            const ox = (a.w + c.w) / 2 + 2 - Math.abs(a.e.label.x - c.x), oy = (a.h + c.h) / 2 + 2 - Math.abs(a.e.label.y - c.y);
            if (ox > 0 && oy > 0) { a.e.label = oy < ox ? P(a.e.label.x, a.e.label.y + (a.e.label.y < c.y ? -oy : oy)) : P(a.e.label.x + (a.e.label.x < c.x ? -ox : ox), a.e.label.y); moved = true; }
          }
        }
        boxes.forEach(clamp);
        if (!moved) break;
      }
      return state;
    }
    // Side cards settle so they never overlap each other or the main line.
    function settle(nodes) {
      const list = [...nodes.values()];
      for (let iter = 0; iter < 60; iter++) {
        let moved = false;
        for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
          const a = list[i], b = list[j];
          const ox = (a.w + b.w) / 2 + 18 - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 + 16 - Math.abs(a.y - b.y);
          if (ox > 0 && oy > 0) {
            const mover = b.kind === 'side' && !overrides.has(b.key) ? b : a.kind === 'side' && !overrides.has(a.key) ? a : null; if (!mover) continue;
            const other = mover === a ? b : a;
            if (oy <= ox) mover.y += (mover.y >= other.y ? 1 : -1) * oy; else mover.x += (mover.x >= other.x ? 1 : -1) * ox;
            moved = true;
          }
        }
        if (!moved) break;
      }
    }
    // Reroute every edge that touches a moved card.
    function reroute(state, keys) {
      const byKey = new Map([...state.nodes.values()].map((d) => [d.key, d]));
      for (const e of state.edges.values()) {
        if (!keys || keys.has(e.a) || keys.has(e.b)) {
          const s = byKey.get(e.a), t = byKey.get(e.b); if (!s || !t) continue;
          const reverse = [...state.edges.values()].some((x) => x.a === e.b && x.b === e.a && x !== e);
          e.c = route(s, t, reverse && e.a !== e.b ? 5 : 0); e.label = at(e.c, 0.5); e.label = P(e.label.x, e.label.y + 4);
        }
      }
      return state;
    }
    function applyOverrides(state) {
      const moved = new Set();
      for (const d of state.nodes.values()) { const o = overrides.get(d.key); if (o) { d.x = o.x; d.y = o.y; moved.add(d.key); } }
      settle(state.nodes);
      if (moved.size) reroute(state, moved);
      return separateLabels(state);
    }
    function nodeByKey(key) { for (const d of cur.nodes.values()) if (d.key === key) return d; return null; }
    function moveNode(key, x, y) {
      overrides.set(key, { x, y }); const d = nodeByKey(key); if (!d) return;
      d.x = x; d.y = y; reroute(cur, new Set([key])); separateLabels(cur); paint(cur, lastTone); onLayout();
    }
    function restoreLayout() { overrides.clear(); onLayout(); }

    svg.setAttribute('tabindex', '0'); svg.style.touchAction = 'pan-y';
    const pointers = new Map(); let drag = null, dragged = false, pinch = null, nodeDrag = null;
    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      pointers.set(e.pointerId, P(e.clientX, e.clientY));
      dragged = false;
      const card = e.target.closest?.('.fl-node');
      if (card && pointers.size === 1) { const d = nodeByKey(card.dataset.id); if (d) { nodeDrag = { key: d.key, start: P(e.clientX, e.clientY), x: d.x, y: d.y, id: e.pointerId, active: false }; drag = null; return; } }
      if (pointers.size === 1) drag = { start: P(e.clientX, e.clientY), vx: view.x, vy: view.y, id: e.pointerId, active: false };
      else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, mid: toLocal((a.x + b.x) / 2, (a.y + b.y) / 2), vx: view.x, vy: view.y }; drag = null; }
    });
    svg.addEventListener('pointermove', (e) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, P(e.clientX, e.clientY));
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mid = toLocal((a.x + b.x) / 2, (a.y + b.y) / 2);
        const k = Math.max(0.5, Math.min(3, pinch.k * (d / pinch.d))); const f = k / pinch.k;
        view.k = k; view.x = mid.x - (pinch.mid.x - pinch.vx) * f; view.y = mid.y - (pinch.mid.y - pinch.vy) * f; dragged = true; applyView(); return;
      }
      if (nodeDrag && nodeDrag.id === e.pointerId) {
        const ddx = e.clientX - nodeDrag.start.x, ddy = e.clientY - nodeDrag.start.y;
        if (!nodeDrag.active) { if (Math.hypot(ddx, ddy) < 4) return; nodeDrag.active = true; dragged = true; svg.setPointerCapture(e.pointerId); svg.classList.add('fl-dragging-node'); }
        const s = width / svg.getBoundingClientRect().width / view.k;   // screen px -> chart units at this zoom
        moveNode(nodeDrag.key, nodeDrag.x + ddx * s, nodeDrag.y + ddy * s);
        return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.start.x, dy = e.clientY - drag.start.y;
      if (!drag.active) {
        if (Math.hypot(dx, dy) < 4) return;
        // On touch, a mostly vertical move belongs to the page's scroll.
        if (e.pointerType === 'touch' && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        drag.active = true; dragged = true; svg.setPointerCapture(e.pointerId); svg.classList.add('fl-dragging');
      }
      const s = width / svg.getBoundingClientRect().width;
      view.x = drag.vx + dx * s; view.y = drag.vy + dy * s; applyView();
    });
    const end = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (drag && drag.id === e.pointerId) drag = null; if (nodeDrag && nodeDrag.id === e.pointerId) nodeDrag = null; svg.classList.remove('fl-dragging', 'fl-dragging-node'); };
    // Keyboard: Shift + arrows nudge the focused card.
    svg.addEventListener('keydown', (e) => {
      const card = e.target.closest?.('.fl-node'); if (!card || !e.shiftKey) return;
      const d = nodeByKey(card.dataset.id); if (!d) return;
      const step = 12, k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]; if (!k) return;
      e.preventDefault(); moveNode(d.key, d.x + k[0], d.y + k[1]);
      svg.querySelector(`.fl-node[data-id="${CSS.escape(d.key)}"]`)?.focus({ preventScroll: true });
    });
    svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end); svg.addEventListener('lostpointercapture', end);
    // A drag must not also click (pin) what it started on.
    svg.addEventListener('click', (e) => { if (dragged) { e.stopImmediatePropagation(); e.preventDefault(); dragged = false; } }, true);
    svg.addEventListener('wheel', (e) => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoomAt(toLocal(e.clientX, e.clientY), Math.exp(-e.deltaY * 0.0025)); }, { passive: false });
    svg.addEventListener('dblclick', (e) => { if (!e.target.closest('.fl-node')) centerView(); });
    svg.addEventListener('keydown', (e) => {
      if (e.target !== svg) return;
      const c = P(width / 2, (svg.viewBox.baseVal?.height || 200) / 2);
      if (e.key === '+' || e.key === '=') { e.preventDefault(); zoomAt(c, 1.2); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); zoomAt(c, 1 / 1.2); }
      else if (e.key === '0') { e.preventDefault(); centerView(); }
    });
    function show(layout, tone, animate) {
      lastTone = tone;
      const to = applyOverrides({ nodes: new Map(layout.nodes.map((d) => [d.id, node(d, 1)])), edges: new Map(layout.edges.map((d) => [d.id, node(d, 1)])), H: layout.H });
      const run = ++raf;
      const from = cur; const start = performance.now(); const dur = animate && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 520 : 0;
      const step = (now) => { if (run !== raf) return; const t = dur ? Math.min(1, (now - start) / dur) : 1; paint(frame(from, to, t), tone); if (t < 1) nextFrame(step); else cur = to; };
      step(start);
    }
    return { svg, show, setWidth: (w) => { width = w; }, onPaint: (f) => { onPaint = f; }, current: () => cur, resetView, centerView, restoreLayout, hasOverrides: () => overrides.size > 0, onLayout: (f) => { onLayout = f; }, onView: (f) => { onView = f; }, moved: () => view.x !== 0 || view.y !== 0 || view.k !== 1 };
  }

  // ---------- Mermaid ----------
  const mq = (s) => '"' + String(s).replace(/"/g, '#quot;') + '"';
  function mermaid(a, kind) {
    if (kind === 'path') {
      const lines = ['flowchart LR'];
      a.runs.forEach((r, i) => lines.push(`  r${i}[${mq((a.names.get(r.state) || r.state) + (r.units.length > 1 ? ' ×' + r.units.length : ''))}]`));
      for (let i = 0; i + 1 < a.runs.length; i++) lines.push(`  r${i} --> r${i + 1}`);
      return lines.join('\n');
    }
    const id = new Map(a.order.map((s, i) => [s, 't' + i]));
    const lines = ['flowchart LR'];
    a.order.forEach((s) => lines.push(`  ${id.get(s)}((${mq(a.names.get(s) || s)}))`));
    for (const e of a.edges) lines.push(`  ${id.get(e.a)} -->|${mq(`${e.n} · ${Math.round(e.p * 100)}%`)}| ${id.get(e.b)}`);
    return lines.join('\n');
  }

  // ---------- the view (built once; switching level animates inside it) ----------
  let built = null;
  function view() {
    if (built) { setTimeout(() => built.update(false), 0); return [built.root]; }
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const root = el('div', 'fl');
    if (!families.length) { root.append(el('p', 'lede', 'This document has no tag families to analyse.')); built = { root, update() {} }; return [root]; }
    let level = 'sentences';
    const seg = el('div', 'fl-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', 'Level of analysis');
    const LEVEL_ICON = {
      sections: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14M5 10h9M5 15h14M5 20h9"/></svg>',
      paragraphs: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 4v16M17 4v16M17 4h-6.5a4 4 0 0 0 0 8H13"/></svg>',
      sentences: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16M4 15h10"/><circle cx="18" cy="15" r="1.2"/></svg>',
    };
    for (const it of LEVELS) { const b = el('button'); b.innerHTML = LEVEL_ICON[it.id] || ''; b.append(el('span', '', it.name)); b.type = 'button'; b.dataset.v = it.id; b.addEventListener('click', () => { level = it.id; [flowB, pathB, arcB].forEach((x) => x.c.restoreLayout()); [pathB, arcB].forEach((x) => x.c.resetView()); setTimeout(() => flowB.c.centerView(), 560); seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === level))); update(true); }); seg.append(b); }
    seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === level)));
    const controls = el('div', 'fl-controls'); controls.append(el('span', 'fl-k', 'Level'), seg);
    const basis = el('p', 'fl-basis');
    const lede = el('p', 'lede', 'The structure this document seems to follow, inferred from how its tags succeed one another. An approximate reading, not a rule.');

    const COPY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/></svg>';
    const DONE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
    function block(title, kind, parent) {
      const sec = el('section', 'fl-block');
      const head = el('div', 'fl-head'); const h = el('h2', '', title);
      const copy = el('button', 'fl-copy'); copy.type = 'button'; copy.innerHTML = COPY; copy.title = 'Copy as Mermaid'; copy.setAttribute('aria-label', `Copy the ${title.toLowerCase()} chart as Mermaid`);
      const reset = el('button', 'fl-copy fl-reset'); reset.type = 'button'; reset.hidden = kind !== 'flow';
      reset.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/></svg>';
      reset.title = 'Centre the chart'; reset.setAttribute('aria-label', `Centre the ${title.toLowerCase()} chart`);
      const restore = el('button', 'fl-copy fl-restore'); restore.type = 'button'; restore.hidden = true;
      restore.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/></svg>';
      restore.title = 'Restore layout'; restore.setAttribute('aria-label', `Restore the ${title.toLowerCase()} layout`);
      const tools = el('div', 'fl-tools'); tools.append(restore, reset, copy);
      head.append(h, tools);
      const note = el('p', 'fl-note'); const c = chart(kind);
      reset.addEventListener('click', () => c.centerView());
      restore.addEventListener('click', () => { c.restoreLayout(); if (built) built.update(true); });
      c.onLayout(() => { restore.hidden = !c.hasOverrides(); });
      c.onView(() => { if (kind !== 'flow') reset.hidden = !c.moved(); }); const readout = el('p', 'fl-readout'); readout.setAttribute('aria-live', 'polite');
      const insights = el('ul', 'fl-insights');
      sec.append(head, note, c.svg, readout, insights); parent.append(sec);
      const code = { text: '' };
      copy.addEventListener('click', async () => {
        let ok = false;
        try { await navigator.clipboard.writeText(code.text); ok = true; } catch { const t = el('textarea'); t.value = code.text; t.style.cssText = 'position:fixed;opacity:0'; document.body.append(t); t.select(); try { ok = document.execCommand('copy'); } catch {} t.remove(); }
        copy.innerHTML = ok ? DONE : COPY; copy.classList.toggle('done', ok); copy.title = ok ? 'Copied' : 'Copy failed';
        setTimeout(() => { copy.innerHTML = COPY; copy.classList.remove('done'); copy.title = 'Copy as Mermaid'; }, 1500);
      });
      const b = { sec, note, c, readout, insights, code, describeNode: () => '', describeEdge: () => '', openNode: null };
      interact(b);
      return b;
    }
    // Hover, focus and tap: highlight by colour; a line under the chart says what it means.
    function interact(b) {
      const svg = b.c.svg; let pinned = null, hover = null;
      const apply = () => {
        const t = pinned || hover; svg.classList.toggle('fl-focus', !!t);
        svg.querySelectorAll('.fl-node,.fl-edge').forEach((g) => g.classList.remove('on'));
        if (!t) { b.readout.textContent = ''; return; }
        if (t.type === 'node') {
          svg.querySelectorAll(`.fl-node[data-id="${CSS.escape(t.id)}"]`).forEach((g) => g.classList.add('on'));
          svg.querySelectorAll('.fl-edge').forEach((g) => { if (g.dataset.a === t.id || g.dataset.b === t.id) { g.classList.add('on'); svg.querySelector(`.fl-node[data-id="${CSS.escape(g.dataset.a === t.id ? g.dataset.b : g.dataset.a)}"]`)?.classList.add('on'); } });
          b.readout.textContent = b.describeNode(t.id);
        } else {
          const g = svg.querySelector(`.fl-edge[data-id="${CSS.escape(t.id)}"]`); if (!g) { hover = pinned = null; apply(); return; }
          g.classList.add('on'); svg.querySelector(`.fl-node[data-id="${CSS.escape(g.dataset.a)}"]`)?.classList.add('on'); svg.querySelector(`.fl-node[data-id="${CSS.escape(g.dataset.b)}"]`)?.classList.add('on');
          b.readout.textContent = b.describeEdge(t.id);
        }
      };
      const target = (e) => { const n = e.target.closest?.('.fl-node'); if (n) return { type: 'node', id: n.dataset.id }; const g = e.target.closest?.('.fl-edge'); if (g) return { type: 'edge', id: g.dataset.id }; return null; };
      svg.addEventListener('pointerover', (e) => { if (e.pointerType === 'touch') return; hover = target(e); apply(); });
      svg.addEventListener('pointerleave', () => { hover = null; apply(); });
      svg.addEventListener('click', (e) => { const t = target(e); pinned = t && !(pinned && pinned.type === t.type && pinned.id === t.id) ? t : null; apply(); });
      svg.addEventListener('dblclick', (e) => { const n = e.target.closest?.('.fl-node'); if (n && b.openNode) b.openNode(n.dataset.id); });
      svg.addEventListener('focusin', (e) => { const n = e.target.closest?.('.fl-node'); if (n) { hover = { type: 'node', id: n.dataset.id }; apply(); } });
      svg.addEventListener('focusout', () => { hover = null; apply(); });
      svg.addEventListener('keydown', (e) => {
        const n = e.target.closest?.('.fl-node'); if (!n) return;
        if (e.key === 'Enter' && b.openNode) { e.preventDefault(); b.openNode(n.dataset.id); }
        else if (e.key === ' ') { e.preventDefault(); pinned = pinned?.id === n.dataset.id ? null : { type: 'node', id: n.dataset.id }; apply(); }
        else if (e.key === 'Escape' && pinned) { e.stopPropagation(); pinned = null; apply(); }
      });
      // Highlights survive re-painting; targets that no longer exist are dropped.
      b.c.onPaint(() => { svg.querySelectorAll('.fl-node').forEach((g) => g.setAttribute('aria-label', g.textContent.trim())); apply(); });
    }
    const flowB = block('Inferred structure', 'flow', root);
    flowB.sec.classList.add('fl-main');
    // The main chart leads; its explanation follows directly under it, then the controls.
    flowB.sec.append(basis, flowB.note);
    root.append(controls, lede);
    const more = el('details', 'fl-more'); const sum = el('summary', '', 'How this was inferred'); more.append(sum); root.append(more);
    const pathB = block('Observed path', 'path', more), arcB = block('Transitions', 'arcs', more);
    const goTo = (unit) => { location.hash = '/'; setTimeout(() => { window.TraceWindow?.ensure(unit.sentences[0]?.id); const n = document.querySelector(`#outline [data-read-sentence="${CSS.escape(unit.sentences[0]?.id || '')}"]`) || document.getElementById('reading-' + unit.id); n?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60); };

    function update(animate) {
      const best = choose(level);
      const W = Math.max(300, Math.round(root.getBoundingClientRect().width || 640));
      const unitWord = level === 'sentences' ? 'sentence' : level === 'paragraphs' ? 'paragraph' : 'section';
      if (!best || best.sc.score <= 0) {
        basis.textContent = `Too few tagged ${unitWord}s at this level to infer a structure. Try a finer level.`;
        for (const b of [flowB, pathB, arcB]) { b.c.show({ nodes: [], edges: [], H: 0 }, 'neutral', animate); b.c.svg.hidden = true; b.note.textContent = ''; b.insights.replaceChildren(); }
        return;
      }
      const a = summarise(best.lab.seq, best.lab.names);
      const fam = best.cand.id.split('·')[0]; const tone = TONE[fam] || 'neutral'; a.tone = tone;
      basis.textContent = `Inferred from ${a.seq.length} ${unitWord}s using ${best.cand.name}, the tags whose order is most predictable here (${Math.round(best.sc.predictability * 100)}% predictable, ${best.sc.k} kinds).`;
      const f = infer(a);
      const runsOf = (s) => a.runs.filter((r) => r.state === s).reduce((n, r) => n + r.units.length, 0);
      // Inferred structure
      flowB.c.svg.hidden = false; flowB.c.setWidth(W); flowB.c.show(layoutFlow(a, f, W), tone, animate);
      flowB.note.textContent = `Main line: the most frequent next step from each tag. Side branches and dashed returns are other moves seen at least twice.`;
      flowB.code.text = mermaidFlow(a, f);
      flowB.describeNode = (s) => `${a.names.get(s)}: ${runsOf(s)} ${unitWord}${runsOf(s) === 1 ? '' : 's'}${f.repeats.has(s) ? `, followed by another ${a.names.get(s)} ${Math.round(f.repeats.get(s).p * 100)}% of the time` : ''}.`;
      flowB.describeEdge = (id) => { const e = a.edges.find((x) => 'f' + x.id === id); return e ? `${a.names.get(e.a)} → ${a.names.get(e.b)}: ${e.n} of ${a.out.get(e.a)} moves (${Math.round(e.p * 100)}%).` : ''; };
      flowB.openNode = (s) => { const r = a.runs.find((x) => x.state === s); if (r) goTo(r.units[0]); };
      flowB.insights.replaceChildren();
      // Observed path
      pathB.c.svg.hidden = false; pathB.c.setWidth(W); pathB.c.show(layoutPath(a, W), tone, animate);
      pathB.note.textContent = `The ${unitWord}s in reading order, labelled by their main ${best.cand.name.toLowerCase()} tag; repeats are collapsed.`;
      pathB.code.text = mermaid(a, 'path');
      pathB.describeNode = (k) => { const r = a.runs[+k.split('-')[1]]; return r ? `${a.names.get(r.state)}: ${r.units.length} ${unitWord}${r.units.length === 1 ? '' : 's'} — ${r.units.map((u) => u.name).slice(0, 2).join(' · ')}${r.units.length > 2 ? ' …' : ''}. Enter or double-click opens it.` : ''; };
      pathB.describeEdge = () => '';
      pathB.openNode = (k) => { const r = a.runs[+k.split('-')[1]]; if (r) goTo(r.units[0]); };
      // Transitions
      arcB.c.setWidth(W);
      if (a.ready) {
        arcB.note.textContent = `${a.seq.length - 1} moves between ${a.order.length} tags. Width shows how often; the percentage is the share of moves out of a tag; dashed moves happened once.`;
        arcB.c.svg.hidden = false; arcB.c.show(layoutArcs(a, W), tone, animate); arcB.code.text = mermaid(a, 'arcs');
        arcB.describeNode = (s) => `${a.names.get(s)}: ${a.freq.get(s) || 0} ${unitWord}s, ${a.out.get(s) || 0} moves on.`;
        arcB.describeEdge = (id) => { const e = a.edges.find((x) => x.id === id); return e ? `${a.names.get(e.a)} → ${a.names.get(e.b)}: ${e.n} of ${a.out.get(e.a)} moves (${Math.round(e.p * 100)}%).` : ''; };
        const top = a.edges.filter((e) => e.n >= 2).sort((x, y) => y.p - x.p || y.n - x.n).slice(0, 3);
        arcB.insights.replaceChildren(...top.map((e) => el('li', '', `After ${a.names.get(e.a)}, the next ${unitWord} is ${e.a === e.b ? 'also ' + a.names.get(e.b) : a.names.get(e.b)} ${e.n} of ${a.out.get(e.a)} times (${Math.round(e.p * 100)}%).`)));
      } else {
        arcB.note.textContent = `No tag is followed by others at least ${CONFIG.minTransitions} times at this level, so there is no transition pattern yet.`;
        arcB.c.show({ nodes: [], edges: [], H: 0 }, tone, animate); arcB.c.svg.hidden = true; arcB.insights.replaceChildren(); arcB.code.text = mermaid(a, 'arcs');
      }
    }
    new ResizeObserver(() => update(false)).observe(root);
    built = { root, update };
    setTimeout(() => { update(false); setTimeout(() => flowB.c.centerView(), 30); }, 0);
    return [root];
  }
  function mermaidFlow(a, f) {
    const id = new Map([...f.main, ...f.side].map((s, i) => [s, 's' + i]));
    const lines = ['flowchart TD'];
    for (const s of [...f.main, ...f.side]) lines.push(`  ${id.get(s)}[${mq((a.names.get(s) || s) + (f.repeats.has(s) ? ' (repeats)' : ''))}]`);
    for (const e of f.edges) lines.push(`  ${id.get(e.a)} ${e.role === 'main' ? '-->' : '-.->'}|${mq(`${Math.round(e.p * 100)}%`)}| ${id.get(e.b)}`);
    return lines.join('\n');
  }

  window.TraceFlow = { choose, summarise, infer, mermaid, view, LEVELS, families, scores: (lv) => candidates().map((c) => { const l = labelWith(lv, c); return [c.id, score(l.seq, l.units)]; }) };
})();
