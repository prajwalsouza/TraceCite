// The TraceCite tour: a short explainer film, opened from Settings → About ("Watch the tour").
//
// The film itself is scripts/tour-film.html, inlined by the builder as
// <script id="trace-tour-film" type="text/plain"> (with "</" written as "<\/"). This file gathers the
// film's material from the open document (window.OUTLINE_SEED): a cited sentence with its quote and passage,
// tags, the first sentences, connected highlights, maths symbols, provenance and every theme's colours.
// Then it opens the film full-window in an iframe that wears the reader's current theme. When the document
// has no recorded quotes, the sentence and its evidence come from the TraceCite sample document, and the film
// says so. Nothing leaves the page.
(() => {
  const filmSrc = () => (document.getElementById('trace-tour-film')?.textContent || '').replace(/<\\\//g, '</');
  if (!document.getElementById('trace-tour-film')) return;
  const root = document.documentElement;
  const style = document.createElement('style');
  style.textContent = `.trace-tour{position:fixed;inset:0;z-index:500;background:var(--bg,var(--canvas,#fbfaf7));animation:trace-tour-in .3s cubic-bezier(.2,.7,.1,1)}
.trace-tour.out{opacity:0;transition:opacity .25s ease}
.trace-tour iframe{display:block;width:100%;height:100%;border:0}
.trace-tour-x{position:absolute;top:max(12px,env(safe-area-inset-top));right:12px;width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:50%;background:color-mix(in srgb,var(--ink,#222) 6%,transparent);color:var(--ink2,var(--muted,#666));cursor:pointer}
.trace-tour-x:hover,.trace-tour-x:focus-visible{color:var(--ink,#222)}
.trace-tour-x svg{width:15px;height:15px;fill:currentColor}
.tour-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;margin:6px 0 20px}
.tour-row .tour-note{flex:1;min-width:220px;margin:0;color:var(--ink2,var(--muted));font-size:14px;line-height:1.5}
@keyframes trace-tour-in{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.trace-tour{animation:none}}`;
  document.head.append(style);
  const fv = (b, k) => (b?.fields || []).find((f) => f.key === k)?.value || '';

  // ---------- TeX to readable text (for the film's own drawing) ----------
  const SUB = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', i: 'ᵢ', n: 'ₙ', k: 'ₖ', j: 'ⱼ' };
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', n: 'ⁿ', p: 'ᵖ', q: 'q', '-': '⁻' };
  const WORD = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', omega: 'ω', Delta: 'Δ', Sigma: 'Σ',
    dots: '…', ldots: '…', cdots: '⋯', cdot: '·', times: '×', infty: '∞', le: '≤', leq: '≤', ge: '≥', geq: '≥', ne: '≠', neq: '≠', approx: '≈', to: '→', sum: 'Σ', int: '∫', partial: '∂', in: '∈', mid: '|', lvert: '|', rvert: '|', quad: ' ', qquad: ' ', R: 'ℝ', N: 'ℕ', Z: 'ℤ' };
  const tex = (s) => String(s || '')
    .replace(/\\[,;:! ]/g, ' ')
    .replace(/\\(?:mathrm|text|operatorname|mathbf|mathit|mathcal|boldsymbol|class\{[^}]*\})\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:left|right|big|Big|bigg)/g, '')
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√$1')
    .replace(/\\([A-Za-z]+)/g, (m, w) => WORD[w] ?? '')
    .replace(/_\{?([0-9a-z])\}?/g, (m, c) => SUB[c] || '_' + c)
    .replace(/\^\{([^{}]{2,})\}/g, '^($1)').replace(/_\{([^{}]{2,})\}/g, '_($1)')
    .replace(/\^\{?(-?[0-9a-z])\}?/g, (m, c) => (c.length === 1 && SUP[c] && SUP[c] !== c ? SUP[c] : '^' + c))
    .replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();

  // ---------- one block's text as coloured segments ----------
  function segsOf(text, symSlot) {
    const out = [], re = /\[([^\]]+)\]\{\.([\w-]+)\}|\[([^\]]+)\]\(([^)]+)\)|\\\((.+?)\\\)|\\\[([\s\S]+?)\\\]|\$\$([\s\S]+?)\$\$|\$([^$]+)\$/g;
    let i = 0, m;
    const math = (src) => { for (const part of tex(src).split(/([A-Za-zα-ωΑ-Ω][₀-₉ᵢₙₖⱼ]*)/)) if (part) out.push({ t: part, math: true, slot: symSlot[part[0]] || 0 }); };
    const span = (inner, id) => { const slot = (window.__traceSpanIndex || {})[id]?.slot || 0; out.push({ t: inner.replace(/\\\((.+?)\\\)/g, (x, s) => tex(s)), slot }); };
    while ((m = re.exec(text))) {
      if (m.index > i) out.push({ t: text.slice(i, m.index) });
      if (m[1]) span(m[1], m[2]); else if (m[3]) out.push({ t: m[3] }); else math(m[5] || m[6] || m[7] || m[8]);
      i = re.lastIndex;
    }
    if (i < text.length) out.push({ t: text.slice(i) });
    return out;
  }
  const plain = (segs) => segs.map((s) => s.t).join('');

  // ---------- every theme's colours, read from themes.css through a hidden probe ----------
  function themes() {
    const list = window.TraceSettings?.THEMES || [];
    // The probe sits in a box that clears every token, so a theme that leaves one out does not inherit the current theme's.
    const KEYS = ['--bg', '--panel', '--surface', '--ink', '--ink2', '--accent', '--accent-fill', '--font-display', '--font-ui'];
    const box = document.createElement('div'); box.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;' + KEYS.map((k) => k + ':initial').join(';');
    const probe = document.createElement('div'); box.append(probe); document.body.append(box);
    const out = list.map((th) => {
      probe.setAttribute('data-theme', th.id);
      const cs = getComputedStyle(probe), v = (k) => cs.getPropertyValue(k).trim();
      return { id: th.id, name: th.name, bg: v('--bg'), panel: v('--panel'), surface: v('--surface'), ink: v('--ink'), ink2: v('--ink2'), accent: v('--accent'), fill: v('--accent-fill'), display: v('--font-display') || v('--font-ui') || "'Poppins',system-ui,sans-serif" };
    }).filter((t) => t.bg && t.ink);
    box.remove();
    return out;
  }

  // ---------- the document's material ----------
  // The fallback example, from the TraceCite sample document (docs/sample): a plain sentence, and the TEI Guidelines' own words for it.
  const SAMPLE = {
    sample: true,
    sentence: 'Without such marks, a program sees only an undivided run of characters.',
    cite: 'TEI Consortium, 2026',
    ref: 'TEI Consortium. (2026). TEI P5: Guidelines for Electronic Text Encoding and Interchange (Version 4.12.0).',
    quote: 'without them a digitized text appears to be nothing but a sequence of undifferentiated bits',
    where: 'iv. About These Guidelines · paragraph beginning “They make recommendations”',
    context: 'They make recommendations about suitable ways of representing those features of textual resources which need to be identified explicitly in order to facilitate processing by computer programs. In particular, they specify a set of markers (or tags) which may be inserted in the electronic representation of the text, in order to mark the text structure and other features of interest. Many, or most, computer programs depend on the presence of such explicit markers for their functionality, since without them a digitized text appears to be nothing but a sequence of undifferentiated bits. The success of the World Wide Web, for example, is partly a consequence of its use of such markup to indicate such features as headings and lists on individual pages, and to indicate links between pages.',
    note: 'Read in the TEI’s own words: markup makes a text’s structure explicit.',
    checkedOn: '24 Nov 2026',
    tags: ['Markup'],
  };
  const TONE = { move: 'plum', role: 'blue', support: 'amber', topic: 'green', 'learning-topics': 'green', revision: 'plum', planning: 'plum' };
  const SKIP = /^(connected|parts|math|env|provenance|xref|links?|collab-|heading|document-structure)/;

  const tagName = (id) => { let n = id; (function w(ts) { for (const t of ts || []) { if (t.id === id) n = String(t.name).replace(/\\\(|\\\)/g, ''); w(t.children); } })((window.OUTLINE_SEED || {}).tagTree); return n; };
  const when = (d) => { const t = d ? new Date(d) : null; return t && !isNaN(t) ? t.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : (d || ''); };
  // The first `n` characters of a run of segments, cut at a word.
  const clip = (segs, n) => { const out = []; let left = n; for (const sg of segs) { if (left <= 0) break; if (sg.t.length <= left) { out.push(sg); left -= sg.t.length; continue; } const c = sg.t.slice(0, left), k = c.lastIndexOf(' '); out.push({ ...sg, t: (k > 10 ? c.slice(0, k) : c) + '…' }); left = 0; } return out; };
  function gather() {
    const d = window.OUTLINE_SEED || {}, tree = d.tagTree || [];
    const sentences = []; (function w(bs) { for (const b of bs || []) { if (b.type === 'sentence') sentences.push(b); w(b.children); } })(d.blocks);
    const conn = tree.find((t) => t.id === 'connected');
    const hl = (conn?.children || []).filter((c) => c.slot).map((c) => ({ id: c.id, slot: c.slot, name: c.name, sym: (c.symbols || [])[0] ? tex(c.symbols[0]) : '' }));
    const symSlot = {}; for (const c of conn?.children || []) for (const s of c.symbols || []) { const k = tex(s)[0]; if (k && !symSlot[k]) symSlot[k] = c.slot; }

    // A cited sentence whose source carries a quote (and ideally its passage).
    let ev = null;
    const src = new Map((d.sources || []).map((s) => [s.id, s]));
    for (const s of sentences) {
      for (const c of s.children || []) {
        const r = src.get(fv(c, 'Source ID')); if (!r || !fv(r, 'Exact quote')) continue;
        const cand = { segs: segsOf(s.text, symSlot), cite: fv(r, 'APA citation'), ref: fv(r, 'APA reference'), quote: fv(r, 'Exact quote'), where: fv(r, 'Quote location'), context: fv(r, 'Quote context'), note: fv(r, 'Quote note.1'), checked: fv(r, 'Quote checked by'), checkedBy: fv(r, 'Quote checked by'), checkedOn: when(fv(r, 'Quote checked on')), tags: fv(r, 'Quote tags').split(/[;,]\s*/).filter(Boolean).map(tagName) };
        cand.sentence = plain(cand.segs);
        if (!ev || (cand.context && !ev.context) || (!!cand.context === !!ev.context && cand.sentence.length < 170 && ev.sentence.length >= 170)) ev = cand;
      }
      if (ev?.context && ev.sentence.length < 170) break;
    }
    if (!ev) ev = { ...SAMPLE, segs: [{ t: SAMPLE.sentence }] };
    if (!ev.tags?.length) { const s0 = sentences.find((s) => (s.tags || []).length); ev.tags = (s0?.tags || []).filter((t) => !/^(math-|prov-|hl-|link)/.test(t)).slice(0, 2).map(tagName); }

    const families = tree.filter((t) => !SKIP.test(t.id) && (t.children || []).length).slice(0, 3)
      .map((t) => ({ id: t.id, name: t.name, tone: TONE[t.id] || window.__traceExtraTones?.[t.id] || 'neutral', children: t.children.map((c) => ({ id: c.id, name: c.name })) }));
    const lines = sentences.slice(0, 18).map((s) => { const sg = segsOf(s.text, {}); return { len: plain(sg).length, tags: s.tags || [], segs: clip(sg, 68) }; });

    const hlSents = sentences.filter((s) => /\]\{\.[\w-]+\}/.test(s.text) && (s.tags || []).some((t) => hl.some((h) => h.id === t)))
      .map((s) => segsOf(s.text, symSlot)).filter((sg) => plain(sg).length < 160 && !sg.some((x) => x.math && /[\^_|]/.test(x.t)))
      .sort((a, b) => b.filter((x) => x.slot).length - a.filter((x) => x.slot).length).slice(0, 3);

    const count = (id) => sentences.filter((s) => (s.tags || []).includes(id)).length;
    const vars = []; (function w(ts) { for (const t of ts || []) { if (/^math-v-/.test(t.id)) vars.push(t); w(t.children); } })(tree.find((t) => t.id === 'math')?.children);
    const symbols = vars.map((t) => { const [s, label] = String(t.name).split(' · '); return { id: t.id, sym: tex(s.replace(/^\\\(|\\\)$/g, '')), label: label || '', count: count(t.id) }; })
      .filter((s) => s.sym && s.count).sort((a, b) => b.count - a.count).slice(0, 5);

    const symLines = []; for (const sy of symbols) for (const s of sentences.filter((x) => (x.tags || []).includes(sy.id) && !/\\\[|\$\$/.test(x.text)).slice(0, 2)) if (!symLines.some((l) => l.id === s.id)) symLines.push({ id: s.id, tags: s.tags || [], segs: clip(segsOf(s.text, {}), 84) });
    const ps = sentences.find((s) => fv(s, 'Added by') && plain(segsOf(s.text, {})).length < 150);
    const provEx = ps ? { segs: segsOf(ps.text, symSlot), by: fv(ps, 'Added by'), via: fv(ps, 'Added via'), on: when(fv(ps, 'Added on')), agent: /agent/i.test(fv(ps, 'Added via')) } : null;
    const pk = window.__tracePackage || {}, pkg = { name: pk.fileName || '', files: (pk.manifest?.files || []).map((f) => (typeof f === 'string' ? f : f.path)).filter((f) => !/^manifest/.test(f)).map((f) => f.split('/').pop()) };
    const prov = new Map();
    (function w(bs) { for (const b of bs || []) { const by = fv(b, 'Added by'); if (by && !prov.has(by)) prov.set(by, { name: by, agent: /agent/i.test(fv(b, 'Added via')) }); w(b.children); } })(d.blocks);

    return { title: d.title || '', ev, families, lines, hl, hlSents, symbols, prov: [...prov.values()].slice(0, 2), provEx, symLines, pkg, themes: themes(), autoplay: true };
  }

  // ---------- the reader's theme, handed to the film ----------
  function themeVars() {
    const cs = getComputedStyle(root), v = (k) => cs.getPropertyValue(k).trim();
    const body = getComputedStyle(document.body), head = document.querySelector('#outline h2, .reading-section, .document-header h1');
    const disp = head ? getComputedStyle(head).fontFamily : body.fontFamily;
    const dark = root.classList.contains('dark');
    const pairs = {
      '--paper': v('--bg') || v('--canvas') || body.backgroundColor, '--card': v('--surface') || v('--paper'), '--ink': v('--ink'), '--ink2': v('--ink2') || v('--muted'), '--ink3': v('--ink3') || v('--faint'),
      '--line': v('--line'), '--accent': v('--accent') || v('--green'), '--accent-soft': v('--accent-fill') || v('--green-wash'),
      '--blue': v('--reading-blue'), '--green': v('--reading-green'), '--violet': v('--reading-plum'), '--amber': v('--reading-amber'),
      '--disp': disp, '--text': body.fontFamily, '--scheme': dark ? 'dark' : 'light',
    };
    for (let i = 1; i <= 5; i++) pairs['--slot-' + i] = v('--slot-' + i);
    return Object.entries(pairs).filter(([, x]) => x).map(([k, x]) => `${k}:${x}`).join(';');
  }
  const fontLinks = () => [...document.querySelectorAll('link[rel=stylesheet][href*="fonts.googleapis.com"]')].map((l) => `<link rel="stylesheet" href="${l.href}">`).join('')
    + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kalam:wght@400&display=swap">';

  // ---------- the overlay ----------
  let overlay = null, opener = null;
  function close() {
    if (!overlay) return;
    const o = overlay; overlay = null; o.classList.add('out');
    setTimeout(() => o.remove(), 260);
    removeEventListener('keydown', onKey, true);
    opener?.focus?.();
  }
  const onKey = (e) => { if (e.key === 'Escape' && overlay) { e.preventDefault(); e.stopPropagation(); close(); } };
  addEventListener('message', (e) => { if (e.data === 'tour-close' && overlay && e.source === overlay.querySelector('iframe')?.contentWindow) close(); });
  function open(from) {
    if (overlay) return;
    opener = from || document.activeElement;
    let html = filmSrc();
    const data = JSON.stringify(gather()).replace(/</g, '\\u003c');
    html = html.replace('<meta name="tour-fonts">', fontLinks()).replace('/*TOUR-VARS*/', themeVars()).replace('/*TOUR-DATA*/', 'window.TOUR=' + data + ';');
    overlay = document.createElement('div');
    overlay.className = 'trace-tour'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'TraceCite tour');
    const frame = document.createElement('iframe'); frame.title = 'TraceCite tour'; frame.setAttribute('allow', 'fullscreen'); frame.srcdoc = html;
    const x = document.createElement('button'); x.type = 'button'; x.className = 'trace-tour-x'; x.setAttribute('aria-label', 'Close the tour (Esc)'); x.title = 'Close (Esc)';
    x.innerHTML = '<svg viewBox="0 0 384 512" aria-hidden="true"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>';
    x.addEventListener('click', close);
    overlay.append(frame, x); document.body.append(overlay);
    addEventListener('keydown', onKey, true);
    frame.addEventListener('load', () => { try { frame.contentWindow.focus(); } catch (_) {} }, { once: true });
  }

  // ---------- Settings → About: "Watch the tour" ----------
  const PLAY = '<svg viewBox="0 0 384 512" aria-hidden="true"><path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z"/></svg>';
  function addRow() {
    const view = document.getElementById('settings-view');
    if (!view || view.hidden) return;
    const h = [...view.querySelectorAll('h2')].find((x) => /About/.test(x.textContent));
    if (!h || view.querySelector('.tour-row')) return;
    const row = document.createElement('div'); row.className = 'tour-row doc-actions';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'primary'; b.innerHTML = PLAY + 'Watch the tour';
    b.addEventListener('click', () => open(b));
    const p = document.createElement('p'); p.className = 'tour-note'; p.textContent = 'A short film of what TraceCite does, drawn from this document. Scroll to move through it, pause to try things, Esc to close.';
    row.append(b, p);
    const lede = h.nextElementSibling?.classList.contains('lede') ? h.nextElementSibling : h;
    lede.after(row);
  }
  const start = () => { addRow(); const v = document.getElementById('settings-view'); if (v) new MutationObserver(addRow).observe(v, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] }); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.TraceTour = { open, close, gather };
})();
