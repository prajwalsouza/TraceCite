// Media in the paper: a full-screen image viewer for figures.
// Click (or press Enter on) any figure image: it opens full screen with its caption
// at the bottom, a counter, a close button in the corner, arrows between figures,
// swipe on touch screens, Escape to close and focus returned to where it was.
(function () {
  'use strict';
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const ICON = {
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  };
  const outline = document.getElementById('outline');
  const images = () => [...outline.querySelectorAll('.reading-visual img, .figure-gallery img')].filter((i) => i.getClientRects().length);
  // The caption is the figure's caption text; the figure's own label (Figure 1) leads it.
  function captionFor(img) {
    const fig = img.closest('figure, .reading-visual');
    const cap = fig?.querySelector('figcaption, .reading-caption');
    const label = fig?.querySelector('.visual-label, .figure-label, h4')?.textContent?.trim();
    const text = (cap?.textContent || img.alt || '').trim();
    return { label: label && !text.startsWith(label) ? label : '', text };
  }

  const box = el('div', 'iv'); box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Figure viewer');
  const stage = el('div', 'iv-stage'); const pic = el('img', 'iv-img'); pic.alt = '';
  const close = el('button', 'iv-btn iv-close'); close.type = 'button'; close.innerHTML = ICON.x; close.setAttribute('aria-label', 'Close');
  const prev = el('button', 'iv-btn iv-prev'); prev.type = 'button'; prev.innerHTML = ICON.left; prev.setAttribute('aria-label', 'Previous figure');
  const next = el('button', 'iv-btn iv-next'); next.type = 'button'; next.innerHTML = ICON.right; next.setAttribute('aria-label', 'Next figure');
  const foot = el('div', 'iv-foot'); const count = el('span', 'iv-count'); const capLabel = el('span', 'iv-label'); const capText = el('p', 'iv-caption');
  foot.append(el('div', 'iv-meta'), capText); foot.firstChild.append(capLabel, count);
  stage.append(pic); box.append(stage, close, prev, next, foot); document.body.append(box);
  let list = [], index = 0, opener = null;

  function show(i) {
    index = (i + list.length) % list.length;
    const img = list[index];
    pic.src = img.currentSrc || img.src; pic.alt = img.alt || '';
    const c = captionFor(img);
    capLabel.textContent = c.label; capText.textContent = c.text; capText.hidden = !c.text;
    count.textContent = list.length > 1 ? `${index + 1} / ${list.length}` : '';
    prev.hidden = next.hidden = list.length < 2;
  }
  function open(img) {
    list = images(); if (!list.length) return;
    opener = document.activeElement;
    show(Math.max(0, list.indexOf(img)));
    box.hidden = false; document.body.classList.add('iv-open');
    setTimeout(() => box.classList.add('in'), 0);
    close.focus({ preventScroll: true });
  }
  function hide() {
    if (box.hidden) return;
    box.classList.remove('in'); box.hidden = true; document.body.classList.remove('iv-open');
    if (opener?.isConnected) opener.focus({ preventScroll: true, focusVisible: false });
  }
  close.addEventListener('click', hide);
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  // Clicking the dark area (not the picture or caption) closes.
  box.addEventListener('click', (e) => { if (e.target === box || e.target === stage) hide(); });
  addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); hide(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1); }
    else if (e.key === 'Tab') { // keep focus inside the viewer
      const f = [close, prev, next].filter((b) => !b.hidden); const i = f.indexOf(document.activeElement);
      e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  }, true);
  // Swipe between figures on touch screens; swipe down to close.
  let sx = null, sy = null;
  stage.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (sx == null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = sy = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1)); else if (dy > 80) hide();
  });

  // Make every figure image open the viewer, by click or keyboard.
  function wire(root) {
    root.querySelectorAll?.('.reading-visual img, .figure-gallery img').forEach((img) => {
      if (img.dataset.iv) return; img.dataset.iv = '1';
      img.tabIndex = 0; img.setAttribute('role', 'button');
      img.setAttribute('aria-label', 'Open figure full screen' + (img.alt ? ': ' + img.alt : ''));
      img.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); open(img); });
      img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(img); } });
    });
  }
  wire(document);
  new MutationObserver((rs) => rs.forEach((r) => r.addedNodes.forEach((n) => n.nodeType === 1 && wire(n)))).observe(outline, { childList: true, subtree: true });
  window.TraceMedia = { open, close: hide };
})();
