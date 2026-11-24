// Inline markdown in block text, fields and quotes: **bold** or __bold__, *italic* or _italic_, `code`.
// The data keeps the raw text (exact quotes stay verbatim); only the display changes. Math segments
// (\( … \), \[ … \], $$ … $$, $ … $) are left untouched for MathJax. Trace redraws text as you read, so a
// MutationObserver formats new text as it appears. Text inside code, inputs, SVG drawings and
// MathJax output is skipped, and so is anything inside an element with class "no-md".
(() => {
  const SKIP = 'script,style,textarea,input,code,pre,svg,mjx-container,[contenteditable="true"],.no-md';
  const MATH = /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|(?<!\\)\$[^$\n]+?(?<!\\)\$)/;
  const MD = /\*\*(?=\S)([^*\n]+?)\*\*|__(?=\S)([^_\n]+?)__|`([^`\n]+)`|(?<![\w*])\*(?=[^\s*])([^*\n]*?[^\s*])\*(?![\w*])|(?<![\w_\\])_(?=[^\s_])([^_\n]*?[^\s_])_(?![\w_])/;
  const SPLIT = new RegExp(MATH.source, 'g');

  function format(text) {
    if (!/[*_`]/.test(text)) return null;
    const parts = text.split(SPLIT);
    let changed = false;
    const out = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i % 2 === 1) { out.append(part); return; } // math: untouched
      let rest = part, m;
      while ((m = rest.match(MD))) {
        changed = true;
        out.append(rest.slice(0, m.index));
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
        : (/[*_`]/.test(n.data) && !plain.has(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) { const frag = format(n.data); if (frag) n.replaceWith(frag); else if (plain.size < 20000) plain.add(n.data); }
  }

  window.TraceRichText = { format, process };
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
