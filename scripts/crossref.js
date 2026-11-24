// Cross-reference links on the reading page. The builder (scripts/crossrefs.mjs) embeds an index of where
// each label is stated ("Theorem 4.1" → its sentence, "Section 6.3" → its heading, "Equation 3.1" → the
// sentence with \tag{3.1}). Every mention in the text becomes a link in the citation colour: clicking it
// scrolls to the target and briefly highlights it, without opening the sentence it sits in. Trace redraws
// text as you read, so a MutationObserver links new text as it appears. Math is never touched.
(() => {
  let INDEX = {};
  try { INDEX = JSON.parse(document.getElementById('trace-xref-index')?.textContent || '{}'); } catch {}
  if (!Object.keys(INDEX).length) return;
  const KIND_RE = '(Theorems?|Lemmas?|Propositions?|Corollar(?:y|ies)|Definitions?|Remarks?|Conjectures?|Examples?|Claims?|Assumptions?|Sections?|Tables?|Figures?|Equations?|Eq\\.|Sec\\.|Fig\\.|Thm\\.)';
  const NUM = '\\d+(?:\\.\\d+)*';
  const MENTION = new RegExp(`\\b${KIND_RE}\\s+(${NUM}(?:\\([a-z]\\))?(?:(?:,\\s*|\\s+and\\s+|\\s*[–-]\\s*)${NUM}(?:\\([a-z]\\))?)*)|(?<![\\w\\\\])\\((\\d+\\.\\d+)\\)`, 'g');
  const MATH = /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|(?<!\\)\$[^$\n]+?(?<!\\)\$/g;
  const PLURAL = { Theorems: 'Theorem', Lemmas: 'Lemma', Propositions: 'Proposition', Corollaries: 'Corollary', Definitions: 'Definition', Remarks: 'Remark', Conjectures: 'Conjecture', Examples: 'Example', Claims: 'Claim', Assumptions: 'Assumption', Sections: 'Section', Tables: 'Table', Figures: 'Figure', Equations: 'Equation', 'Eq.': 'Equation', 'Sec.': 'Section', 'Fig.': 'Figure', 'Thm.': 'Theorem' };
  const SKIP = 'script,style,textarea,input,code,pre,svg,mjx-container,a,.xref,#reading-focus-tree,.ev-tags,.ev-math,[contenteditable="true"],.no-xref';

  function link(label, text) {
    const a = document.createElement('a');
    a.className = 'xref reading-citation';
    a.href = '#';
    a.dataset.xref = label;
    a.textContent = text;
    return a;
  }
  // Split one text node into text and links. Returns a fragment, or null if nothing to link.
  function linkify(text, own) {
    if (!/\d/.test(text)) return null;
    const masked = text.replace(MATH, (m) => '\u0000'.repeat(m.length));
    const frag = document.createDocumentFragment();
    let last = 0, any = false;
    for (const m of masked.matchAll(MENTION)) {
      if (m[3]) { // "(3.1)"
        const label = 'Equation ' + m[3];
        if (!INDEX[label] || own.has(INDEX[label].id)) continue;
        frag.append(text.slice(last, m.index), link(label, text.slice(m.index, m.index + m[0].length)));
        last = m.index + m[0].length; any = true; continue;
      }
      const kind = PLURAL[m[1]] || m[1];
      const nums = [...m[2].matchAll(new RegExp(NUM, 'g'))];
      if (!nums.some((n) => INDEX[`${kind} ${n[0]}`] && !own.has(INDEX[`${kind} ${n[0]}`].id))) continue;
      frag.append(text.slice(last, m.index));
      let pos = m.index;
      nums.forEach((n, i) => {
        const start = m.index + m[1].length + (m[0].length - m[1].length - m[2].length) + n.index;
        const from = i === 0 ? m.index : start;
        frag.append(text.slice(pos, from));
        const label = `${kind} ${n[0]}`;
        const shown = text.slice(from, start + n[0].length);
        frag.append(INDEX[label] && !own.has(INDEX[label].id) ? link(label, shown) : shown);
        pos = start + n[0].length;
      });
      last = pos; any = true;
    }
    if (!any) return null;
    frag.append(text.slice(last));
    return frag;
  }
  // A result's own statement does not link to itself.
  const ownOf = (n) => { const e = n.parentElement; return new Set([e?.closest('[data-read-sentence]')?.dataset.readSentence, e?.closest('section[id^="reading-"]')?.id.slice(8)].filter(Boolean)); };
  function process(root) {
    if (!root || (root.nodeType === 1 && root.closest(SKIP))) return;
    if (root.nodeType === 3) { if (root.parentElement && !root.parentElement.closest(SKIP)) { const f = linkify(root.data, ownOf(root)); if (f) root.replaceWith(f); } return; }
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && !n.parentElement.closest(SKIP) && /\d/.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
    const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) { const f = linkify(n.data, ownOf(n)); if (f) n.replaceWith(f); }
  }

  function target(label) {
    const id = INDEX[label]?.id;
    if (!id) return null;
    window.TraceWindow?.ensure(id);
    return document.querySelector(`[data-read-sentence="${CSS.escape(id)}"]`) || document.getElementById('reading-' + id) || document.querySelector(`[data-reading-block="${CSS.escape(id)}"]`);
  }
  function go(label) {
    const el = target(label);
    if (!el) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    el.classList.remove('xref-flash'); void el.offsetWidth; el.classList.add('xref-flash');
    setTimeout(() => el.classList.remove('xref-flash'), 1800);
  }
  // Capture phase, so the sentence around the link does not open.
  const handler = (e) => {
    const a = e.target.closest?.('a.xref');
    if (!a) return;
    if (e.type === 'keydown' && e.key !== 'Enter') return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (e.type === 'click' || e.type === 'keydown') go(a.dataset.xref);
  };
  for (const type of ['click', 'keydown', 'pointerdown', 'mousedown']) document.addEventListener(type, (e) => { if (type === 'pointerdown' || type === 'mousedown') { if (e.target.closest?.('a.xref')) e.stopPropagation(); return; } handler(e); }, true);

  const start = () => {
    process(document.body);
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') { if (m.target.isConnected) process(m.target); continue; }
        for (const n of m.addedNodes) if (n.isConnected) process(n);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.TraceXref = { go, index: INDEX };
})();
