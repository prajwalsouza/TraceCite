// Quiet evidence: an opened line shows only where its words come from (the source, its exact words, the
// reference). The rest waits inside each node and opens when the pointer rests on that node:
//   a source:  where the words are, who added and checked them, their tags, the passage, notes, the relation
//   comments:  the thread under "n comments"
//   the line:  its review, "Sentence added by …" and the Sources / Tags tabs (rest on the opened sentence)
// Keyboard focus inside a node opens it too. Where there is no hover (touch), a tap opens or closes a node.
//
// Cost: nothing when a line opens (quiet-evidence.css hides the details), no observers, and one set of
// delegated listeners for the whole page. Opening a node is one class change: one layout, then a short fade
// that only uses opacity and transform.
(() => {
  const NODE = '.ev-src, .ev-comments';
  const LINE = '.apa-sentence.active, .ev-tabs';
  const OPEN_AFTER = 200, CLOSE_AFTER = 150;
  const fine = matchMedia('(hover: hover)');
  const timers = new Map();
  const line = {}; // timer key for the line's details
  const later = (key, fn, ms) => { clearTimeout(timers.get(key)); timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, ms)); };
  const panel = () => document.querySelector('#outline .apa-evidence > .ev');
  const within = (t) => t instanceof Element && t.closest('#outline') ? t : null;
  const entered = (el, e) => el && !el.contains(e.relatedTarget);

  function hoverIntent(e, open) {
    if (!fine.matches) return;
    const t = within(e.target); if (!t) return;
    const n = t.closest(NODE);
    if (entered(n, e)) later(n, () => n.classList.toggle('ev-show', open), open ? OPEN_AFTER : CLOSE_AFTER);
    const l = t.closest(LINE);
    if (entered(l, e)) later(line, () => panel()?.classList.toggle('ev-show-line', open), open ? OPEN_AFTER : CLOSE_AFTER);
  }
  document.addEventListener('mouseover', (e) => hoverIntent(e, true), { passive: true });
  document.addEventListener('mouseout', (e) => hoverIntent(e, false), { passive: true });

  document.addEventListener('focusin', (e) => { const n = within(e.target)?.closest(NODE); if (n) { clearTimeout(timers.get(n)); n.classList.add('ev-show'); } });
  document.addEventListener('focusout', (e) => { const n = within(e.target)?.closest(NODE); if (n && !n.contains(e.relatedTarget) && !n.matches(':hover')) n.classList.remove('ev-show'); });

  document.addEventListener('click', (e) => {
    if (fine.matches) return;
    const t = within(e.target); if (!t || t.closest('a, button, summary, input')) return;
    const n = t.closest(NODE); if (n) { n.classList.toggle('ev-show'); return; }
    if (t.closest('.apa-sentence.active')) panel()?.classList.toggle('ev-show-line');
  });
})();
