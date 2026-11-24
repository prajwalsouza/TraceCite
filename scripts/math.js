// LaTeX in trace data, rendered with MathJax (TeX → SVG).
// Write math in any block text, field or source as \( … \) or $ … $ inline, and \[ … \] or $$ … $$ on its
// own line; \$ is a literal dollar. The builder adds this file and the MathJax loader only when the data
// contains math (or with --math on). Without a network the TeX stays readable as plain text.
//
// Trace redraws large parts of the page as you read: opening a sentence re-renders the whole paper from
// its raw text. Typesetting again each time would flash raw TeX and make the page jump. So every rendered
// formula is cached by its TeX, and a MutationObserver swaps cached copies in synchronously, before the
// browser paints. Only formulas never seen before are typeset (asynchronously), then cached.
// Trace styles every <svg> as a 19 px stroked icon; MathJax states each formula's size as width/height
// attributes, so those are copied into inline styles, which win over that rule (see also themes.css).
// MathJax's context menu is off, so clicking a formula behaves like clicking the sentence around it.
window.MathJax = {
  tex: {
    inlineMath: [['\\(', '\\)'], ['$', '$']],
    displayMath: [['\\[', '\\]'], ['$$', '$$']],
    processEscapes: true,
    macros: {
      R: '\\mathbb{R}', N: '\\mathbb{N}', Z: '\\mathbb{Z}', C: '\\mathbb{C}', D: '\\mathbb{D}',
      // Highlight part of an equation: \hl{…} in the accent colour; \hlb, \hlg, \hla, \hlp in the
      // blue, green, amber and plum tag colours. \color{…}{…} and \textcolor{…}{…} also work.
      hl: ['\\class{mjx-hl}{#1}', 1], hlb: ['\\class{mjx-hl-blue}{#1}', 1], hlg: ['\\class{mjx-hl-green}{#1}', 1],
      hla: ['\\class{mjx-hl-amber}{#1}', 1], hlp: ['\\class{mjx-hl-plum}{#1}', 1],
    },
  },
  svg: { fontCache: 'global' },
  options: { enableMenu: false, skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'input'], ignoreHtmlClass: 'no-math' },
  startup: {
    ready() {
      MathJax.startup.defaultReady();
      MathJax.startup.promise.then(() => {
        const SKIP = 'script,style,textarea,input,code,pre,mjx-container,.no-math';
        const SEG = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|(?<!\\)\$([^$\n]+?)(?<!\\)\$/g;
        const ANY = /\\\(|\\\[|\$/;
        const key = (tex, display) => (display ? 'D:' : 'I:') + tex;
        const cache = new Map();

        // Every svg in a formula, including the nested ones MathJax uses for \tag and alignment.
        const size = (root) => root.querySelectorAll('svg').forEach((svg) => {
          for (const k of ['width', 'height']) { const v = svg.getAttribute(k) || 'auto'; if (svg.style[k] !== v) svg.style[k] = v; }
        });

        const textNodes = (root) => {
          const out = [];
          if (root.nodeType === 3) { if (root.parentElement && !root.parentElement.closest(SKIP) && ANY.test(root.data)) out.push(root); return out; }
          if (root.nodeType !== 1 || root.closest(SKIP)) return out;
          const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && !n.parentElement.closest(SKIP) && ANY.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
          while (w.nextNode()) out.push(w.currentNode);
          return out;
        };

        // Replace math in a text node with cached renderings. Returns false if any formula is new.
        const swap = (node) => {
          const text = node.data;
          const frag = document.createDocumentFragment();
          let last = 0, found = false;
          for (const m of text.matchAll(SEG)) {
            const display = m[2] !== undefined || m[3] !== undefined;
            const hit = cache.get(key(m[1] ?? m[2] ?? m[3] ?? m[4], display));
            if (!hit) return false;
            found = true;
            frag.append(text.slice(last, m.index), hit.cloneNode(true));
            last = m.index + m[0].length;
          }
          if (!found) return true;
          frag.append(text.slice(last));
          node.replaceWith(frag);
          return true;
        };

        const remember = (roots) => {
          for (const item of MathJax.startup.document.getMathItemsWithin(roots)) {
            const el = item.typesetRoot;
            if (!el || !el.isConnected) continue;
            size(el);
            el.dataset.tex = item.math; if (item.display) el.dataset.display = '1';
            const k = key(item.math, item.display);
            if (!cache.has(k)) cache.set(k, el.cloneNode(true));
          }
        };

        let queue = new Set();
        let timer = 0;
        const flush = () => {
          timer = 0;
          const nodes = [...queue].filter((n) => n.isConnected && !n.closest('mjx-container'));
          queue = new Set();
          const roots = nodes.filter((n) => !nodes.some((o) => o !== n && o.contains(n)));
          if (!roots.length) return;
          MathJax.typesetPromise(roots).then(() => { remember(roots); roots.forEach((r) => watch(r)); }).catch((e) => console.warn('[math]', e));
        };

        const handle = (root) => {
          for (const t of textNodes(root)) {
            if (!t.isConnected) continue;
            const parent = t.parentElement;
            if (!swap(t) && parent) queue.add(parent);
          }
        };

        // Tag focus: when a Mathematics tag is hovered or pinned in the tag tree, light up that symbol or
        // kind of mathematics inside every rendered equation (index written by scripts/math-tags.mjs).
        const INDEX = (() => { try { return JSON.parse(document.getElementById('trace-math-index')?.textContent || '{}'); } catch { return {}; } })();
        const norm = (t) => (t === 'ℓ' ? t : t.normalize('NFKC'));
        const glyph = (code) => {
          const cp = parseInt(code, 16);
          if (cp >= 0x1d434 && cp <= 0x1d467) { const o = cp - 0x1d434; return o < 26 ? String.fromCharCode(65 + o) : String.fromCharCode(97 + o - 26); }
          if (cp === 0x210e) return 'h';
          return norm(String.fromCodePoint(cp));
        };
        const word = (g) => [...g.children].filter((c) => c.tagName === 'use').map((u) => glyph(u.getAttribute('data-c'))).join('');
        const leaves = (id, out = []) => { const e = INDEX[id]; if (!e) return out; if (e.children) e.children.forEach((c) => leaves(c, out)); else out.push(e); return out; };
        // Symbol → tone of its tag group, so a symbol lights up in its tag's colour.
        const toneOf = new Map(Object.values(INDEX).filter((e) => e.symbol && e.tone).map((e) => [norm(e.symbol), e.tone]));
        const NS = 'http://www.w3.org/2000/svg';
        const mark = (g, tone, kind, tint = true) => {
          g.classList.add('mjx-mark', 'mk-' + kind);
          if (tone) g.style.setProperty('--mk', `var(--reading-${tone})`);
          if (!tint || g.querySelector(':scope > rect.mjx-bg')) return;
          try {
            const b = g.getBBox(); const pad = 70;
            const r = document.createElementNS(NS, 'rect');
            r.setAttribute('class', 'mjx-bg');
            r.setAttribute('x', b.x - pad); r.setAttribute('y', b.y - pad * 0.6); r.setAttribute('width', b.width + 2 * pad); r.setAttribute('height', b.height + pad * 1.2);
            g.insertBefore(r, g.firstChild);
          } catch {}
        };
        const unmark = (kind) => document.querySelectorAll('g.mk-' + kind).forEach((g) => {
          g.classList.remove('mk-' + kind);
          if (!g.classList.contains('mk-hover') && !g.classList.contains('mk-focus')) { g.classList.remove('mjx-mark'); g.style.removeProperty('--mk'); g.querySelector(':scope > rect.mjx-bg')?.remove(); }
        });
        // Marks are applied lazily: only to formulas on screen (plus a margin), and to the rest as they scroll
        // into view. A parent tag like "Mathematics" would otherwise mark thousands of symbols at once and
        // freeze the page. Each kind of mark (focus from the tag tree, hover on a symbol) has one current rule;
        // a formula is brought up to date with it when it becomes visible.
        const OUT = '#reading-focus-tree, #sidebar, .tt-board, #settings-view';
        const unmarkOne = (g, kind) => {
          g.classList.remove('mk-' + kind);
          if (!g.classList.contains('mk-hover') && !g.classList.contains('mk-focus')) { g.classList.remove('mjx-mark'); g.style.removeProperty('--mk'); g.querySelector(':scope > rect.mjx-bg')?.remove(); }
        };
        const rules = { focus: null, hover: null };
        let version = 0;
        const seen = new WeakMap(); // box → { focus: version, hover: version }
        const visible = new Set();
        const bring = (box) => {
          if (box.closest(OUT)) return;
          const d = seen.get(box) || {};
          for (const kind of ['focus', 'hover']) {
            const r = rules[kind];
            if (d[kind] === (r ? r.v : 0)) continue;
            box.querySelectorAll('g.mk-' + kind).forEach((g) => unmarkOne(g, kind));
            if (r) r.apply(box);
            d[kind] = r ? r.v : 0;
          }
          seen.set(box, d);
        };
        const io = new IntersectionObserver((entries) => {
          for (const en of entries) { if (en.isIntersecting) { visible.add(en.target); bring(en.target); } else visible.delete(en.target); }
        }, { rootMargin: '600px 0px' });
        const watched = new WeakSet();
        const watch = (root = document) => root.querySelectorAll?.('mjx-container[jax="SVG"]').forEach((b) => { if (!watched.has(b)) { watched.add(b); io.observe(b); } });
        let ws = 0;
        const watchSoon = () => { if (!ws) ws = requestAnimationFrame(() => { ws = 0; watch(document); }); };
        const setRule = (kind, apply) => {
          rules[kind] = apply ? { v: ++version, apply } : null;
          document.querySelectorAll('g.mk-' + kind).forEach((g) => unmarkOne(g, kind));
          for (const b of [...visible]) if (b.isConnected) bring(b); else visible.delete(b);
        };

        let lit = null;
        const light = () => {
          const id = document.querySelector('#reading-focus-tree [data-reading-tag].previewing')?.dataset.readingTag || null;
          const want = id && INDEX[id] ? id : null;
          lit = want;
          if (!want) { setRule('focus', null); return; }
          const targets = leaves(want);
          const symbols = new Set(targets.filter((t) => t.symbol).map((t) => norm(t.symbol)));
          const words = new Set(targets.flatMap((t) => t.words || []));
          const glyphs = new Set(targets.flatMap((t) => t.glyphs || []).map((c) => c.toUpperCase()));
          const nodes = targets.flatMap((t) => t.nodes || []);
          const display = targets.some((t) => t.display);
          // Many targets (a parent tag): colour only, without the tinted backing, to keep it light.
          const tint = targets.length <= 6;
          setRule('focus', (box) => {
            if (display && box.getAttribute('display') === 'true') { const g = box.querySelector('svg > g'); if (g) mark(g, null, 'focus', false); }
            if (symbols.size || words.size) box.querySelectorAll('g[data-mml-node="mi"]').forEach((g) => { const w = word(g); if (symbols.has(w) || words.has(w)) mark(g, toneOf.get(w), 'focus', tint); });
            if (glyphs.size) box.querySelectorAll('g[data-mml-node="mo"]').forEach((g) => { if ([...g.querySelectorAll('use')].some((u) => glyphs.has((u.getAttribute('data-c') || '').toUpperCase()))) mark(g, null, 'focus', tint); });
            for (const n of nodes) box.querySelectorAll(`g[data-mml-node="${n}"]`).forEach((g) => mark(g, null, 'focus', false));
          });
        };
        // Tag-tree focus changes are debounced, so sweeping the pointer across the tree costs nothing.
        let lightTimer = 0;
        const relight = () => { clearTimeout(lightTimer); lightTimer = setTimeout(light, 90); };
        new MutationObserver(() => {
          const id = document.querySelector('#reading-focus-tree [data-reading-tag].previewing')?.dataset.readingTag || null;
          if (id !== lit) relight();
        }).observe(document.getElementById('reading-focus-tree') || document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
        // Equation hover (Settings → Reading → Highlight in equations, on by default):
        // hovering a symbol lights up the same symbol in every equation (lazily, as above), and hovering an
        // equation shows a copy button for its LaTeX. Clicking the button never opens the sentence.
        const hoverOn = () => !document.documentElement.classList.contains('eq-hover-off');
        let hovered = '';
        const clearHover = () => { hovered = ''; setRule('hover', null); };
        document.addEventListener('mouseover', (e) => {
          if (!hoverOn()) return;
          const g = e.target.closest?.('mjx-container g[data-mml-node="mi"]');
          const w = g && !g.closest(OUT) ? word(g) : '';
          if (w === hovered) return;
          if (!w) { if (hovered) clearHover(); return; }
          hovered = w;
          const tone = toneOf.get(norm(w));
          setRule('hover', (box) => box.querySelectorAll('g[data-mml-node="mi"]').forEach((n) => { if (word(n) === w) mark(n, tone, 'hover', true); }));
        });
        // One floating copy button, placed over the hovered equation.
        const copy = document.createElement('button');
        copy.type = 'button'; copy.className = 'mjx-copy'; copy.hidden = true;
        copy.setAttribute('aria-label', 'Copy this equation as LaTeX'); copy.title = 'Copy LaTeX';
        const COPY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11" height="11" rx="2.4"/><path d="M15.5 8.5V6.4a1.9 1.9 0 0 0-1.9-1.9H6.4a1.9 1.9 0 0 0-1.9 1.9v7.2a1.9 1.9 0 0 0 1.9 1.9h2.1"/></svg>';
        const DONE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7"/></svg>';
        copy.innerHTML = COPY_ICON + '<span></span>';
        document.body.append(copy);
        let current = null, hideTimer = 0;
        const place = (box) => {
          const r = box.getBoundingClientRect();
          if (box.getAttribute('display') === 'true') {
            // Beside the equation, clear of its number; above its right end if there is no room.
            const right = r.right + 8;
            if (right + 30 < innerWidth) { copy.style.left = right + 'px'; copy.style.top = (r.top + r.height / 2 - 13) + 'px'; }
            else { copy.style.left = (r.right - 30) + 'px'; copy.style.top = Math.max(4, r.top - 30) + 'px'; }
          } else { copy.style.left = Math.min(innerWidth - 34, r.right - 4) + 'px'; copy.style.top = Math.max(4, r.top - 28) + 'px'; }
        };
        document.addEventListener('mouseover', (e) => {
          if (!hoverOn()) return;
          if (e.target.closest?.('.mjx-copy')) { clearTimeout(hideTimer); return; }
          const box = e.target.closest?.('mjx-container[jax="SVG"]');
          if (!box || box.closest('#reading-focus-tree, #sidebar, .ev-math, .tt-board')) { if (current) { clearTimeout(hideTimer); hideTimer = setTimeout(() => { copy.classList.remove('show'); setTimeout(() => { if (!copy.classList.contains('show')) copy.hidden = true; }, 160); current = null; }, 350); } return; }
          clearTimeout(hideTimer);
          if (!box.dataset.tex) return;
          current = box; copy.hidden = false; copy.classList.remove('done'); copy.querySelector('span').textContent = ''; copy.innerHTML = COPY_ICON + '<span></span>'; place(box); requestAnimationFrame(() => copy.classList.add('show'));
        });
        addEventListener('scroll', () => { if (current && !copy.hidden) place(current); }, { passive: true });
        const stop = (e) => { if (e.target.closest?.('.mjx-copy')) { e.stopPropagation(); e.stopImmediatePropagation(); } };
        for (const t of ['pointerdown', 'mousedown']) document.addEventListener(t, stop, true);
        copy.addEventListener('click', async (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!current) return;
          const tex = current.dataset.tex.trim();
          try { await navigator.clipboard.writeText(tex); } catch { const t = document.createElement('textarea'); t.value = tex; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch {} t.remove(); }
          copy.innerHTML = DONE_ICON + '<span>Copied</span>'; copy.classList.add('done');
          clearTimeout(hideTimer); hideTimer = setTimeout(() => { copy.classList.remove('show'); setTimeout(() => { copy.hidden = true; }, 160); current = null; }, 1300);
        });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { copy.hidden = true; clearHover(); } });

        window.TraceMath = { light, index: INDEX, watch };

        new MutationObserver((list) => {
          for (const m of list) {
            if (m.type === 'characterData') { handle(m.target); continue; }
            for (const n of m.addedNodes) if (n.isConnected && !(n.nodeType === 1 && n.tagName === 'MJX-CONTAINER')) handle(n);
          }
          if (queue.size && !timer) timer = setTimeout(flush, 30);
          watchSoon();
        }).observe(document.body, { childList: true, subtree: true, characterData: true });

        MathJax.typesetPromise([document.body]).then(() => { remember([document.body]); watch(document); }).catch((e) => console.warn('[math]', e));
      });
    },
  },
};
