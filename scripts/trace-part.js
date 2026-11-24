// Opening a sentence parts its paragraph at that sentence. The lines before it stay where they are, the lines
// after it move down, and the trace is written into the gap: the space opens, then each part of the evidence
// draws in from the left, one after another. Trace places the evidence after the whole paragraph, so this moves
// the text after the opened sentence into its own paragraph below the evidence. Trace redraws the paper on
// every open and close, so the split never outlives the open sentence.
// Settings → Reading → "Animate opening a sentence" (html.no-trace-anim) shows the trace at once instead;
// reduced motion does the same. The split itself always happens.
(() => {
  const outline = document.getElementById('outline');
  if (!outline) return;
  let lastOpen = null;
  const still = () => document.documentElement.classList.contains('no-trace-anim') || matchMedia('(prefers-reduced-motion: reduce)').matches;

  function part(ev) {
    if (ev.dataset.parted) return;
    ev.dataset.parted = '1';
    const p = ev.previousElementSibling;
    const sentence = p?.tagName === 'P' && p.querySelector(':scope > .apa-sentence[aria-expanded="true"]');
    if (!sentence) return;
    const id = sentence.dataset.readingBlock || sentence.dataset.readSentence || '';
    const fresh = id !== lastOpen;
    lastOpen = id;
    // Everything after the sentence moves to a new paragraph below the evidence.
    const rest = [];
    for (let n = sentence.nextSibling; n; n = n.nextSibling) rest.push(n);
    const hasText = rest.some((n) => n.nodeType === 1 || n.textContent.trim());
    if (hasText) {
      const after = document.createElement('p');
      after.className = (p.className + ' trace-after').trim();
      while (rest.length && rest[0].nodeType === 3 && !rest[0].textContent.trim()) rest.shift().remove();
      if (rest[0]?.nodeType === 3) rest[0].textContent = rest[0].textContent.replace(/^\s+/, '');
      after.append(...rest);
      ev.after(after);
      p.classList.add('trace-before');
    }
    if (!fresh || still()) return;
    animate(ev, hasText ? ev.nextElementSibling : null);
  }

  function animate(ev, after) {
    // 1. The gap opens: the evidence grows from nothing, pushing the lines after it down.
    const h = ev.getBoundingClientRect().height;
    const open = ev.animate([{ height: '0px', opacity: 1 }, { height: h + 'px', opacity: 1 }], { duration: Math.min(520, 240 + h * 0.35), easing: 'cubic-bezier(.2,.75,.15,1)' });
    ev.style.overflow = 'hidden';
    open.finished.then(() => { ev.style.overflow = ''; }, () => { ev.style.overflow = ''; });
    after?.animate([{ transform: 'translateY(-6px)', opacity: 0.6 }, { transform: 'none', opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.2,.75,.15,1)' });
    // 2. The trace is written in: each line of the evidence draws from left to right, in reading order.
    // The innermost of these, so a quote and the lines inside its children each draw on their own.
    const SEL = '.ev-top, .ev-tags, .ev-math, .ev-src-head, .ev-quote, .ev-where, .ev-kids > li, .ev-ref, .ev-prov, .ev-comments-head, .ev-comment, .ev-note, .ev-flag, .ev-review';
    const all = [...ev.querySelectorAll(SEL)];
    const targets = all.filter((n) => !all.some((m) => m !== n && n.contains(m) && !n.matches('.ev-kids > li')))
      .filter((n) => !all.some((m) => m !== n && m.matches('.ev-kids > li') && m.contains(n)));
    targets.slice(0, 30).forEach((n, i) => {
      n.animate([
        { clipPath: 'inset(0 100% 0 0)', opacity: 0.2, transform: 'translateY(3px)' },
        { clipPath: 'inset(0 0 0 0)', opacity: 1, transform: 'none' },
      ], { duration: 520, delay: 140 + i * 70, easing: 'cubic-bezier(.25,.8,.25,1)', fill: 'backwards' });
    });
  }

  // Closing runs the opening backwards: the trace folds up, the lines below rise to meet the sentence, and
  // only then does Trace redraw the paragraph whole. The click is held for that moment and then replayed.
  let replaying = false;
  outline.addEventListener('click', (e) => {
    if (replaying || still()) return;
    const target = e.target.closest('.apa-sentence[aria-expanded="true"], .ev-close, .apa-evidence-head button');
    const ev = outline.querySelector('.apa-evidence[data-parted]');
    if (!target || !ev || ev.dataset.closing) return;
    if (target.matches('.apa-sentence') && e.target.closest('a, button, .xref')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    ev.dataset.closing = '1';
    const h = ev.getBoundingClientRect().height;
    ev.style.overflow = 'hidden';
    const kids = ev.querySelectorAll('.ev > *');
    kids.forEach((k) => k.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }));
    const after = ev.nextElementSibling?.classList.contains('trace-after') ? ev.nextElementSibling : null;
    const fold = ev.animate([{ height: h + 'px' }, { height: '0px', marginTop: '0px', marginBottom: '0px' }], { duration: Math.min(380, 180 + h * 0.25), easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    fold.finished.catch(() => {}).then(() => {
      if (after) after.style.opacity = '0';
      replaying = true;
      try { target.isConnected ? target.click() : outline.querySelector('.apa-sentence[aria-expanded="true"]')?.click(); } finally { replaying = false; }
      // The rejoined paragraph settles in rather than snapping.
      const joined = outline.querySelector('p:has(> .apa-sentence.active), p:has(> .apa-sentence[data-reading-block="' + CSS.escape(lastClosed) + '"])');
      joined?.animate([{ opacity: 0.75 }, { opacity: 1 }], { duration: 220, easing: 'ease-out' });
    });
    const s = ev.previousElementSibling?.querySelector('.apa-sentence[aria-expanded="true"]');
    lastClosed = s?.dataset.readingBlock || '';
  }, true);
  let lastClosed = '';

  // Click anywhere outside the open sentence and its trace (empty margin, another paragraph's blank space,
  // the page around the paper) to close it; Escape does the same. Links, buttons, other sentences, the
  // sidebar, search and settings keep their own meaning, and selecting text never closes anything.
  const closeOpen = () => {
    const btn = outline.querySelector('.apa-evidence .apa-evidence-head button');
    if (btn) btn.click();
  };
  document.addEventListener('click', (e) => {
    if (!outline.querySelector('.apa-evidence[data-parted]')) return;
    if (String(getSelection?.() || '').trim()) return;
    if (e.target.closest('.apa-evidence, .apa-sentence, a, button, input, textarea, select, label, summary, [role="button"], .mjx-copy, #sidebar, .spot-scrim, .tt-board, #reading-focus-tree, #reading-focus-dock, #sentence-hover-rail, .settings, [data-side-view]')) return;
    if (!/^#?\/?$/.test(location.hash)) return;
    closeOpen();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    if (document.querySelector('.spot-scrim:not([hidden])')) return;
    if (outline.querySelector('.apa-evidence[data-parted]')) closeOpen();
  });

  const scan = (root) => { if (root.matches?.('.apa-evidence')) part(root); root.querySelectorAll?.('.apa-evidence').forEach(part); };
  new MutationObserver((records) => {
    let any = false;
    for (const r of records) for (const n of r.addedNodes) if (n.nodeType === 1) { scan(n); any = true; }
    if (any && !outline.querySelector('.apa-sentence[aria-expanded="true"]')) lastOpen = null;
  }).observe(outline, { childList: true, subtree: true });
  scan(outline);
})();
