// Quiet evidence: an opened line shows only where its words come from (the source, its exact words, the
// reference). The rest waits inside each node and opens when the pointer rests on that node:
//   a source:  where the words are, who added and checked them, their tags, the passage, notes, the relation
//   comments:  the thread under "n comments"
//   the line:  its review and "Sentence added by …" (rest on the opened sentence); the Sources / Tags tabs always show
// Keyboard focus inside a node opens it too. Where there is no hover (touch), a tap opens or closes a node.
//
// Kept open: a click inside a node (expanding its passage, opening a note, following a link, or the node
// itself) means the reader wants to read it, so the node stays open when the pointer leaves. Nothing extra is
// drawn. A second click on the node's own text (not a link or toggle) lets it close again. Kept nodes are remembered per document in this browser (localStorage,
// "trace-kept-evidence"), never written into the trace data: they are reading state, not evidence.
// Nodes opened by hover alone close after a short grace period, with a fade rather than a snap.
//
// Cost: nothing when a line opens (quiet-evidence.css hides the details), one set of delegated listeners for
// the whole page, and one childList observer that only restores kept nodes when evidence is drawn.
(() => {
  const NODE = '.ev-src, .ev-comments';
  const LINE = '.apa-sentence.active, .ev-tabs';
  const OPEN_AFTER = 200, CLOSE_AFTER = 700, FADE = 220;
  const STORE = 'trace-kept-evidence', MAX_KEPT = 400;
  const fine = matchMedia('(hover: hover)');
  const timers = new Map();
  const line = {}; // timer key for the line's details
  const later = (key, fn, ms) => { clearTimeout(timers.get(key)); timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, ms)); };
  const panel = () => document.querySelector('#outline .apa-evidence > .ev');
  const within = (t) => t instanceof Element && t.closest('#outline') ? t : null;
  const entered = (el, e) => el && !el.contains(e.relatedTarget);

  // ---------- which nodes are kept, per document ----------
  const docKey = () => location.pathname.replace(/index\.html$/, '') + '|' + (document.querySelector('#document-title')?.textContent || document.title).trim();
  const readAll = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } };
  const kept = () => new Set(readAll()[docKey()] || []);
  const writeKept = (set) => { try { const all = readAll(); const list = [...set].slice(-MAX_KEPT); if (list.length) all[docKey()] = list; else delete all[docKey()]; localStorage.setItem(STORE, JSON.stringify(all)); } catch {} };
  function nodeId(n) {
    const ev = n.closest('.ev'); if (!ev) return null;
    const s = document.querySelector('#outline .apa-sentence[aria-expanded="true"], #outline .apa-sentence.active');
    const sid = s?.dataset.readingBlock || s?.dataset.readSentence; if (!sid) return null;
    if (n.matches('.ev-comments')) return sid + '|comments';
    const i = [...ev.querySelectorAll('.ev-src')].indexOf(n);
    return sid + '|' + (n.querySelector('.ev-ref')?.dataset.source || '') + '|' + i;
  }

  // ---------- showing and hiding a node ----------
  function show(n) { clearTimeout(timers.get(n)); timers.delete(n); n.classList.remove('ev-hiding'); n.classList.add('ev-show'); }
  function hide(n) {
    if (n.classList.contains('ev-keep') || !n.classList.contains('ev-show')) return;
    n.classList.add('ev-hiding');
    later(n, () => n.classList.remove('ev-show', 'ev-hiding'), FADE);
  }
  function keep(n, on, remember = true) {
    n.classList.toggle('ev-keep', on);
    if (on) show(n);
    if (!remember) return;
    const id = nodeId(n); if (!id) return;
    const set = kept(); set.delete(id); if (on) set.add(id); writeKept(set);
  }
  // Evidence is drawn afresh each time a line opens: put back what this reader kept.
  function restore() {
    const ev = panel(); if (!ev) return;
    const set = kept(); if (!set.size) return;
    ev.querySelectorAll(NODE).forEach((n) => { if (!n.classList.contains('ev-keep') && set.has(nodeId(n))) keep(n, true, false); });
  }
  let queued = false;
  new MutationObserver((records) => {
    if (queued || !records.some((r) => [...r.addedNodes].some((a) => a.nodeType === 1 && (a.matches?.('.ev, .apa-evidence, .ev-src, .ev-comments') || a.querySelector?.('.ev-src, .ev-comments'))))) return;
    queued = true; requestAnimationFrame(() => { queued = false; restore(); });
  }).observe(document.documentElement, { childList: true, subtree: true });

  // ---------- pointer, keyboard, touch ----------
  function hoverIntent(e, open) {
    if (!fine.matches) return;
    const t = within(e.target); if (!t) return;
    const n = t.closest(NODE);
    if (entered(n, e)) { if (open) later(n, () => show(n), OPEN_AFTER); else if (!n.classList.contains('ev-keep')) later(n, () => hide(n), CLOSE_AFTER); }
    const l = t.closest(LINE);
    if (entered(l, e)) later(line, () => panel()?.classList.toggle('ev-show-line', open), open ? OPEN_AFTER : CLOSE_AFTER);
  }
  document.addEventListener('mouseover', (e) => hoverIntent(e, true), { passive: true });
  document.addEventListener('mouseout', (e) => hoverIntent(e, false), { passive: true });

  document.addEventListener('focusin', (e) => { const n = within(e.target)?.closest(NODE); if (n) show(n); });
  document.addEventListener('focusout', (e) => { const n = within(e.target)?.closest(NODE); if (n && !n.contains(e.relatedTarget) && !n.matches(':hover')) hide(n); });

  document.addEventListener('click', (e) => {
    const t = within(e.target); if (!t) return;
    const n = t.closest(NODE);
    if (n) {
      // A click on a link or toggle inside a node means "I'm reading this": keep it. A click on the node's own
      // text toggles keeping, so a second click lets it close (on touch, it closes at once).
      if (t.closest('a, button, summary, input, [role=button]')) { keep(n, true); return; }
      const on = !n.classList.contains('ev-keep'); keep(n, on);
      if (!on && !fine.matches) hide(n);
      return;
    }
    if (!fine.matches && !t.closest('a, button, summary, input') && t.closest('.apa-sentence.active')) panel()?.classList.toggle('ev-show-line');
  }, true);
})();
