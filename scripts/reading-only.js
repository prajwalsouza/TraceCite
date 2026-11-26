// Reading-only edition. Trace's own app.js runs unchanged; this file only
// keeps the reader inside the Reading view.
(function () {
  'use strict';
  const tree = () => document.getElementById('reading-focus-tree');
  // A tag chip inside an opened sentence would switch to the Tags view.
  // Here it pins the same tag in the reading tag tree instead.
  document.addEventListener('click', (event) => {
    const chip = event.target.closest('.apa-evidence .tag-chip, #sentence-hover-rail .tag-chip');
    if (!chip) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const name = chip.textContent.trim();
    const target = [...tree().querySelectorAll('[data-reading-tag]')].find((b) => b.textContent.trim() === name);
    if (!target) return;
    // Unfold the branch so the reader can see which tag is pinned.
    for (let list = target.closest('ul'); list && list !== tree(); list = list.parentElement.closest('ul')) {
      if (list.hidden) list.previousElementSibling?.querySelector('.reading-tag-toggle')?.click();
    }
    target.click();
  }, true);
  // Nothing in this edition may open another view.
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-view]:not([data-view="apa"]), #sources-nav, #revision-proposal-nav')) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
})();
// Embedded figures: swap Trace's relative asset paths for the copies in this file.
(function () {
  const map = JSON.parse(document.getElementById('trace-assets')?.textContent || '{}');
  function swap(root) {
    root.querySelectorAll?.('img[src^="assets/"], video[poster^="assets/"], a[href^="assets/"], video[src^="assets/"]').forEach((node) => {
      for (const attr of ['src', 'poster', 'href']) {
        const value = node.getAttribute(attr);
        if (!value?.startsWith('assets/')) continue;
        if (map[value]) node.setAttribute(attr, map[value]);
        else if (node.tagName === 'VIDEO' && attr === 'src') { node.removeAttribute('src'); node.hidden = true; }
        else if (node.tagName === 'A') node.hidden = true;
      }
    });
  }
  swap(document);
  new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => n.nodeType === 1 && swap(n.parentNode || n)))).observe(document.body, { childList: true, subtree: true });
})();
// Quiet evidence: drop what says nothing or leads nowhere in this edition,
// and keep one kind of arrow (the thin chevron) everywhere.
(function () {
  function tidy(root) {
    root.querySelectorAll?.('.evidence-card').forEach((card) => {
      if (card.dataset.tidy) return; card.dataset.tidy = '1';
      // "Full paragraph context · pending": no context is stored, so there is nothing to open.
      card.querySelectorAll('details.source-context').forEach((d) => { if (/pending/i.test(d.querySelector('summary')?.textContent || '')) d.remove(); });
      // The source library is not part of the reading edition.
      card.querySelectorAll('.source-links').forEach((n) => { [...n.querySelectorAll('button')].forEach((b) => { if (/source record/i.test(b.textContent)) b.remove(); }); if (!n.children.length) n.remove(); });
      // Empty toggles.
      card.querySelectorAll('details').forEach((d) => { if (![...d.children].some((c) => c.tagName !== 'SUMMARY' && c.textContent.trim())) d.remove(); });
      // A record status is information, not a warning.
      card.querySelectorAll('.edited-warning').forEach((p) => { if (/^(Checked|Reference only)/i.test(p.textContent.trim())) p.className = 'evidence-status'; });
      // Glyph arrows go; the layout already shows what belongs to what.
      card.querySelectorAll('.quote-locator').forEach((n) => { n.textContent = n.textContent.replace(/^\s*↳\s*/, ''); });
      card.querySelectorAll('a, button').forEach((n) => { for (const t of n.childNodes) if (t.nodeType === 3) t.textContent = t.textContent.replace(/\s*[↗→]\s*$/, ''); });
    });
  }
  tidy(document);
  new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => n.nodeType === 1 && tidy(n.parentNode || n)))).observe(document.body, { childList: true, subtree: true });
})();
// The opened sentence, redesigned: tags, the reason for them, and each source
// with its exact quote. Read straight from the trace data; Trace's own panel
// stays in the page (hidden) so its open and close behaviour is unchanged.
(function () {
  const doc = window.OUTLINE_SEED || { blocks: [], sources: [], tagTree: [] };
  const get = (b, k) => b?.fields?.find((f) => f.key === k)?.value || '';
  const byId = new Map();
  const walk = (bs) => (bs || []).forEach((b) => { byId.set(b.id, b); walk(b.children); });
  walk(doc.blocks); walk(doc.sources);
  const ROOT_TONE = { move: 'plum', role: 'blue', support: 'amber', topic: 'green', 'learning-topics': 'green', revision: 'plum', planning: 'plum', 'document-structure': 'blue', 'collab-workspace': 'plum', 'collab-authors': 'amber' };
  const tags = new Map();
  const visit = (list, tone = 'neutral') => (list || []).forEach((t) => { const own = (globalThis.__traceExtraTones || {})[t.id] || ROOT_TONE[t.id] || tone; tags.set(t.id, { name: t.name, tone: own }); visit(t.children, own); });
  visit(doc.tagTree);
  // Bookkeeping tags (authors, workspace, structure) are not part of the argument.
  const HIDE = /^(collab-|heading$|document-structure)/;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  function quotesFor(source, extract) {
    // Each quote may carry children (BibTrace trace-quote-N-context / -note-M / -tags, or the matching
    // source fields): the passage it sits in, notes on it, and its own tags.
    const all = (source.fields || []).filter((f) => /^Exact quote(?: \d+)?$/.test(f.key) && f.value)
      .map((f) => { const n = f.key.replace('Exact quote', '').trim(); const sfx = n ? ' ' + n : '';
        const notes = (source.fields || []).filter((x) => new RegExp('^Quote note' + (n ? ' ' + n : '') + '(?:\\.\\d+)?$').test(x.key) && x.value).map((x) => { const by = get(source, x.key.replace('Quote note', 'Quote note by')); return by ? x.value + ' — ' + by : x.value; });
        const comments = (source.fields || []).filter((x) => new RegExp('^Quote comment' + (n ? ' ' + n : '') + '\\.\\d+$').test(x.key) && x.value).map((x) => ({ text: x.value, by: get(source, x.key.replace('Quote comment', 'Quote comment by')) }));
        return { addedBy: get(source, 'Quote added by' + sfx), addedVia: get(source, 'Quote added via' + sfx), checkedBy: get(source, 'Quote checked by' + sfx), checkedOn: get(source, 'Quote checked on' + sfx), text: f.value, where: get(source, 'Quote location' + sfx), context: get(source, 'Quote context' + sfx), withheld: get(source, 'Quote context withheld' + sfx), notes, comments,
          tags: (get(source, 'Quote tags' + sfx) || '').split(/[;,]\s*/).filter(Boolean) }; });
    const picked = extract && all.find((q) => q.text === extract);
    return picked ? [picked] : all;
  }
  function pin(tagId) {
    const tree = document.getElementById('reading-focus-tree');
    const target = tree?.querySelector(`[data-reading-tag="${CSS.escape(tagId)}"]`);
    if (!target) return;
    for (let list = target.closest('ul'); list && list !== tree; list = list.parentElement.closest('ul')) if (list.hidden) list.previousElementSibling?.querySelector('.reading-tag-toggle')?.click();
    target.click();
  }
  function source(item) {
    const s = byId.get(get(item, 'Source ID'));
    const box = el('div', 'ev-src');
    const head = el('div', 'ev-src-head');
    const audit = /^Audit evidence/.test(get(item, 'Role'));
    head.append(el('span', 'ev-name', s ? s.text : item.text));
    if (audit) head.append(el('span', 'ev-where', 'review evidence, not cited in the text'));
    box.append(head);
    if (!s) { box.append(el('p', 'ev-none', 'No source is linked yet.')); return box; }
    const extract = (item.children || []).map((c) => get(c, 'Exact supporting extract')).find(Boolean) || get(item, 'Exact supporting extract');
    const quotes = quotesFor(s, extract);
    for (const q of quotes) {
      box.append(el('blockquote', 'ev-quote', '“' + q.text + '”'));
      if (q.where) box.append(el('div', 'ev-where', q.where));
      { const parts = [q.addedBy && 'added by ' + q.addedBy + (q.addedVia ? ' via ' + q.addedVia : ''), q.checkedBy && 'checked by ' + q.checkedBy + (q.checkedOn ? ' on ' + q.checkedOn : '')].filter(Boolean);
        if (parts.length) box.append(el('div', 'ev-prov', parts.join(' · '))); }
      if (q.tags.length) {
        const row = el('div', 'ev-tags ev-quote-tags');
        for (const t of q.tags) { const info = tags.get(t); if (!info) continue; const b = el('button', 'ev-tag', info.name); b.type = 'button'; b.dataset.tone = info.tone; b.addEventListener('click', () => pin(t)); row.append(b); }
        if (row.childNodes.length) box.append(row);
      }
      // Children of the quote: the passage it sits in (quote marked), then notes on it.
      if (q.context || q.withheld || q.notes.length || q.comments.length) {
        const kids = el('ul', 'ev-kids');
        if (q.context) {
          const li = el('li', 'ev-kid');
          const d = document.createElement('details'); d.className = 'ev-context';
          const sum = el('summary', '', 'Where it sits'); d.append(sum);
          const p = el('p', 'ev-context-text');
          const at = q.context.indexOf(q.text);
          if (at >= 0) { p.append(q.context.slice(0, at)); p.append(el('mark', 'ev-mark', q.text)); p.append(q.context.slice(at + q.text.length)); } else p.textContent = q.context;
          d.append(p); li.append(d); kids.append(li);
        }
        if (!q.context && q.withheld) kids.append(el('li', 'ev-kid ev-kid-withheld', 'Passage not reproduced: ' + q.withheld));
        for (const note of q.notes) kids.append(el('li', 'ev-kid ev-kid-note', note));
        for (const c of q.comments) { const li = el('li', 'ev-kid ev-kid-comment'); li.append(el('span', 'ev-comment-by' + (c.by ? '' : ' unsigned'), c.by || 'Unsigned'), ' ', el('span', 'ev-comment-text', c.text)); kids.append(li); }
        box.append(kids);
      }
    }
    { const by = get(s, 'Added by'), via = get(s, 'Added via'), on = get(s, 'Added on');
      if (by || via) box.append(el('div', 'ev-prov', 'Record added' + (by ? ' by ' + by : '') + (via ? ' via ' + via : '') + (on ? ' on ' + on : ''))); }
    const relation = get(item, 'Relation to this sentence');
    if (relation) box.append(el('p', 'ev-note', relation));
    const ref = get(s, 'APA reference');
    if (ref) {
      const line = el('p', 'ev-ref', ref + ' '); line.dataset.source = s.id;
      const url = get(s, 'URL');
      if (/^https?:\/\//.test(url)) { const a = el('a', 'ev-open'); a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/></svg>'; a.setAttribute('aria-label', 'Open the source'); a.title = 'Open the source'; a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; line.append(a); }
      box.append(line);
    }
    return box;
  }
  function build(panel) {
    if (panel.querySelector(':scope > .ev')) return;
    const id = panel.querySelector('li.block')?.dataset.block;
    const sentence = byId.get(id);
    if (!sentence) return;
    const ev = el('div', 'ev');
    const top = el('div', 'ev-top');
    const tagRow = el('div', 'ev-tags');
    // Mathematics tags (added by math-tags.mjs) get their own line under the tags: symbols, then kinds.
    const mathRow = el('div', 'ev-math');
    const symbols = [], kinds = [];
    for (const t of sentence.tags || []) {
      const info = tags.get(t); if (!info || HIDE.test(t)) continue;
      const isMath = t.startsWith('math-');
      const name = isMath ? info.name.split(' · ')[0] : info.name;
      const b = el('button', 'ev-tag', name); b.type = 'button'; b.dataset.tone = info.tone; b.dataset.tagId = t;
      if (isMath && info.name !== name) b.title = info.name;
      b.addEventListener('click', () => pin(t));
      if (!isMath) tagRow.append(b); else (t.startsWith('math-t-') ? kinds : symbols).push(b);
    }
    if (symbols.length || kinds.length) {
      mathRow.append(el('span', 'ev-math-label', 'In the mathematics'));
      if (symbols.length) { const g = el('span', 'ev-math-group'); g.append(...symbols); mathRow.append(g); }
      if (kinds.length) { const g = el('span', 'ev-math-group ev-math-kinds'); g.append(...kinds); mathRow.append(g); }
    }
    const close = el('button', 'ev-close', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close evidence');
    close.addEventListener('click', () => panel.querySelector('.apa-evidence-head button')?.click());
    top.append(tagRow, close); ev.append(top);
    if (mathRow.childNodes.length) ev.append(mathRow);
    const review = get(sentence, 'Sentence review') || get(sentence, 'How this is supported');
    if (review) ev.append(el('p', 'ev-review', review));
    { const by = get(sentence, 'Added by'), via = get(sentence, 'Added via'); if (by || via) ev.append(el('div', 'ev-prov', 'Sentence added' + (by ? ' by ' + by : '') + (via ? ' via ' + via : ''))); }
    const status = get(sentence, 'Status');
    if (status && /recheck|check/i.test(status)) ev.append(el('p', 'ev-flag', status));
    const items = (sentence.children || []).filter((c) => ['citation', 'reference'].includes(c.type));
    for (const item of items) ev.append(source(item));
    // Comments: children of the sentence (or of its citations), threaded, with the person and their tags.
    const isComment = (b) => b.type === 'note' && (b.fields || []).some((f) => f.key === 'Comment by');
    const threads = [];
    (function collect(list) { for (const b of list || []) { if (isComment(b)) threads.push(b); else if (b.type !== 'sentence') collect(b.children); } })(sentence.children);
    if (threads.length) {
      const box = el('div', 'ev-comments');
      box.append(el('div', 'ev-comments-head', threads.length === 1 ? '1 comment' : threads.length + ' comments'));
      const draw = (b) => {
        const li = el('li', 'ev-comment');
        const head = el('div', 'ev-comment-head');
        const by = get(b, 'Comment by').trim();
        head.append(el('span', 'ev-comment-by' + (by ? '' : ' unsigned'), by || 'Unsigned'));
        const when = get(b, 'Commented on'); if (when) head.append(el('span', 'ev-comment-when', when));
        li.append(head, el('p', 'ev-comment-text', b.text));
        const t = (b.tags || []).filter((x) => !x.startsWith('comments') && tags.get(x));
        if (t.length) { const row = el('div', 'ev-tags ev-comment-tags'); for (const x of t) { const info = tags.get(x); const bt = el('button', 'ev-tag', info.name); bt.type = 'button'; bt.dataset.tone = info.tone; bt.addEventListener('click', () => pin(x)); row.append(bt); } li.append(row); }
        const replies = (b.children || []).filter(isComment);
        if (replies.length) { const ul = el('ul', 'ev-replies'); replies.forEach((r) => ul.append(draw(r))); li.append(ul); }
        return li;
      };
      const ul = el('ul', 'ev-comment-list'); threads.forEach((b) => ul.append(draw(b))); box.append(ul);
      ev.append(box);
    }
    for (const note of (sentence.children || []).filter((c) => c.type === 'note' && !isComment(c))) {
      const n = el('div', 'ev-src');
      n.append(el('div', 'ev-src-head')); n.firstChild.append(el('span', 'ev-name ev-plain', note.text));
      for (const c of note.children || []) n.append(el('p', 'ev-note', c.text));
      ev.append(n);
    }
    // Tabs: Sources first, because tracing is the point; then Tags; then Mathematics. The sentence's own
    // provenance line stays visible under whichever tab is open. Empty tabs are left out; one tab needs no bar.
    {
      const prov = [...ev.children].find((n) => n.classList.contains('ev-prov') && /^Sentence added/.test(n.textContent));
      const srcNodes = [...ev.children].filter((n) => n !== top && n !== mathRow && n !== prov);
      mathRow.querySelector('.ev-math-label')?.remove();
      const panes = [];
      if (srcNodes.length) panes.push(['Sources', items.length, srcNodes]);
      if (tagRow.childNodes.length) panes.push(['Tags', tagRow.childNodes.length, [tagRow]]);
      if (mathRow.childNodes.length) panes.push(['Mathematics', symbols.length + kinds.length, [mathRow]]);
      const bar = el('div', 'ev-tabs'); bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'Evidence');
      const tabs = [], divs = [];
      panes.forEach(([name, count, nodes], i) => {
        const t = el('button', 'ev-tab', name); t.type = 'button'; t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', String(i === 0)); t.tabIndex = i === 0 ? 0 : -1;
        if (count) t.append(el('span', 'ev-tab-n', String(count)));
        const d = el('div', 'ev-pane ev-pane-' + name.toLowerCase()); d.setAttribute('role', 'tabpanel'); d.hidden = i !== 0; d.append(...nodes);
        tabs.push(t); divs.push(d); bar.append(t);
      });
      const pick = (i) => tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; divs[k].hidden = k !== i; });
      tabs.forEach((t, i) => {
        t.addEventListener('click', (e) => { e.stopPropagation(); pick(i); });
        t.addEventListener('keydown', (e) => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); e.stopPropagation(); const k = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length; pick(k); tabs[k].focus(); });
      });
      // With one tab there is nothing to switch: keep only the close button in the bar.
      if (tabs.length <= 1) { bar.replaceChildren(); bar.classList.add('ev-tabs-single'); }
      bar.append(close);
      ev.replaceChildren(bar, ...divs, ...(prov ? [prov] : []));
    }
    panel.append(ev);
  }
  const scan = (root) => root.querySelectorAll?.('.apa-evidence').forEach(build);
  scan(document);
  new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType !== 1) return; if (n.matches?.('.apa-evidence')) build(n); else scan(n); }))).observe(document.getElementById('outline'), { childList: true, subtree: true });
})();
