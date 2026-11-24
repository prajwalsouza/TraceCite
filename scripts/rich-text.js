// Inline markdown in block text, fields and notes: **bold** or __bold__, *italic* or _italic_, `code`,
// links [text](https://…) (a new tab), [text](#/at/<block id>) (a jump within the document) and bare https://
// addresses, and span tags [text]{.tag-id} (see spans.mjs: connected highlights colour them by the tag's slot).
// Only http(s), mailto and #/at/ links are made; anything else stays plain text. Exact quotes and their
// passages are never formatted: they stay verbatim.
// The data keeps the raw text (exact quotes stay verbatim); only the display changes. Math segments
// (\( … \), \[ … \], $$ … $$, $ … $) are left untouched for MathJax. Trace redraws text as you read, so a
// MutationObserver formats new text as it appears. Text inside code, inputs, SVG drawings and
// MathJax output is skipped, and so is anything inside an element with class "no-md".
(() => {
  const SKIP = 'script,style,textarea,input,code,pre,svg,mjx-container,a.md-link,[contenteditable="true"],.no-md,.ev-quote,.ev-context,.ev-context-text';
  const LINKY = /\[([^\[\]\n]+)\]\{\.([A-Za-z][\w-]*)\}|\[([^\[\]\n]+)\]\(([^()\s]+)\)|(?<![("\[\w])(https?:\/\/[^\s<>()"]+[^\s<>()".,;:!?'’])/;
  const kindOf = (url) => (/^https?:\/\/\S+$/i.test(url) ? 'external' : /^mailto:\S+$/i.test(url) ? 'mail' : /^#\/at\/[\w.:-]+$/.test(url) ? 'internal' : null);
  const EXT = '<svg class="md-ext" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8M18 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4"/></svg>';
  // Inside a link or span only bold, italic and code apply (no links in links, no endless re-detection).
  function inner(text) { const f = format(text, true); if (f) return f; return document.createTextNode(text); }
  function linkOrSpan(m) {
    const [, spanText, tag, linkText, url, bare] = m;
    if (tag) { const s = document.createElement('span'); s.className = 'tag-span' + (lit.has(tag) ? ' lit' : ''); s.dataset.tag = tag; s.append(inner(spanText)); return s; }
    const href = bare || url, kind = kindOf(href);
    if (!kind) return document.createTextNode(linkText ?? href);
    const a = document.createElement('a'); a.className = 'md-link md-' + kind; a.href = href;
    if (kind === 'internal') a.dataset.at = href.slice(5);
    else { a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = href; }
    a.append(inner(linkText ?? href));
    if (kind !== 'internal') a.insertAdjacentHTML('beforeend', EXT);
    return a;
  }
  const MATH = /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|(?<!\\)\$[^$\n]+?(?<!\\)\$)/;
  const MD = /\*\*(?=\S)([^*\n]+?)\*\*|__(?=\S)([^_\n]+?)__|`([^`\n]+)`|(?<![\w*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\w*])|(?<![\w_\\])_(?=[^\s_])([^_\n]*?[^\s_])_(?![\w_])/;
  const SPLIT = new RegExp(MATH.source, 'g');

  function format(text, plainOnly = false) {
    if (!(plainOnly ? /[*_`]/ : /[*_`\[]|https?:/).test(text)) return null;
    const parts = text.split(SPLIT);
    let changed = false;
    const out = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i % 2 === 1) { out.append(part); return; } // math: untouched
      let rest = part, m;
      while (true) {
        const l = plainOnly ? null : rest.match(LINKY), d = rest.match(MD);
        m = l && (!d || l.index <= d.index) ? l : d;
        if (!m) break;
        changed = true;
        out.append(rest.slice(0, m.index));
        if (m === l) { out.append(linkOrSpan(l)); rest = rest.slice(l.index + l[0].length); continue; }
        const [whole, b1, b2, code, i1, i2] = m;
        const el = document.createElement(code !== undefined ? 'code' : b1 !== undefined || b2 !== undefined ? 'strong' : 'em');
        if (code !== undefined) el.className = 'md-code';
        el.textContent = b1 ?? b2 ?? code ?? i1 ?? i2;
        out.append(el);
        rest = rest.slice(m.index + whole.length);
      }
      out.append(rest);
    });
    return changed ? out : null;
  }

  // Walks elements too, so whole MathJax drawings, code and SVG are skipped in one step, and remembers
  // texts that turned out to need nothing (Trace redraws the same sentences again and again).
  const plain = new Set();
  function process(root) {
    if (!root || (root.nodeType === 1 && root.closest(SKIP))) return;
    if (root.nodeType === 3) root = root.parentElement;
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => n.nodeType === 1 ? (n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP)
        : (/[*_`\[]|https?:/.test(n.data) && !plain.has(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) { const frag = format(n.data); if (frag) n.replaceWith(frag); else if (plain.size < 20000) plain.add(n.data); }
  }

  window.TraceRichText = { format, process };
  // Tag focus lights exactly the spans: hovering or pinning a tag (or a parent of it) in the tag tree.
  let lit = new Set();
  const under = (id) => { const out = new Set(); (function find(list) { for (const t of list || []) { if (t.id === id) (function all(x) { out.add(x.id); (x.children || []).forEach(all); })(t); else find(t.children); } })(window.OUTLINE_SEED?.tagTree); return out; };
  const relight = () => {
    const id = document.querySelector('#reading-focus-tree [data-reading-tag].previewing')?.dataset.readingTag || null;
    lit = id ? under(id) : new Set();
    document.querySelectorAll('.tag-span').forEach((s) => s.classList.toggle('lit', lit.has(s.dataset.tag)));
    document.documentElement.classList.toggle('span-focus', lit.size > 0 && !!document.querySelector('.tag-span.lit'));
  };
  const watchTree = () => { const tree = document.getElementById('reading-focus-tree'); if (!tree) return setTimeout(watchTree, 400); new MutationObserver(relight).observe(tree, { subtree: true, attributes: true, attributeFilter: ['class'] }); };
  watchTree();
  // Links never open the sentence around them; an internal link (#/at/<id>) scrolls to that block.
  const go = (id) => {
    const el = window.TraceWindow?.go?.(id, { block: 'center', smooth: true }) || document.querySelector(`[data-read-sentence="${CSS.escape(id)}"], #reading-${CSS.escape(id)}`);
    el?.scrollIntoView?.({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  for (const type of ['pointerdown', 'mousedown', 'click']) document.addEventListener(type, (e) => {
    const a = e.target.closest?.('a.md-link'); if (!a) return;
    e.stopPropagation();
    if (type === 'click' && a.dataset.at) { e.preventDefault(); go(a.dataset.at); }
  }, true);
  const start = () => {
    process(document.body);
    new MutationObserver((list) => {
      // A redraw adds hundreds of nodes; one pass over their nearest common parts is far cheaper than one each.
      const roots = new Set();
      for (const m of list) {
        if (m.type === 'characterData') { if (m.target.isConnected) roots.add(m.target.parentElement); continue; }
        for (const n of m.addedNodes) if (n.isConnected) roots.add(n.nodeType === 1 ? n : n.parentElement);
        if (roots.size > 24) break;
      }
      if (roots.size > 24) { process(document.body); return; }
      for (const r of roots) if (r && ![...roots].some((o) => o !== r && o?.contains(r))) process(r);
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
