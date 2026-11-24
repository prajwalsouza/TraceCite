// Loading guard. The skeleton shimmer must never run forever: the page either
// draws the document or, within a time limit, says plainly that it could not.
// Data is normally baked into the page (#trace-data). When the page was built
// with --data-url, the data is fetched from that JSON file next to the page
// (this needs a web server; file:// pages cannot fetch) and the reading scripts
// run only once it has arrived.
(function () {
  'use strict';
  const LIMIT = 10000;            // ms until we give up waiting for the first draw
  const FETCH_LIMIT = 8000;       // ms for the data request itself
  const t0 = Date.now();
  let state = 'loading', firstError = null, poll = 0;
  const outline = () => document.getElementById('outline');
  const drawn = () => { const o = outline(); return !!o && !o.querySelector('.sk-paper') && o.children.length > 0; };
  function settle() {
    state = 'done'; clearInterval(poll);
    outline()?.removeAttribute('aria-busy');
    document.documentElement.classList.remove('is-loading');
  }
  function fail(why, detail) {
    if (state !== 'loading') return;
    state = 'failed'; clearInterval(poll);
    document.documentElement.classList.remove('is-loading');
    document.querySelectorAll('.sk').forEach((n) => n.remove());
    const o = outline(); if (!o) return;
    o.removeAttribute('aria-busy');
    o.innerHTML = '';
    const box = document.createElement('div'); box.className = 'load-fail'; box.setAttribute('role', 'alert');
    const h = document.createElement('p'); h.className = 'lf-title'; h.textContent = 'This document didn’t load';
    const p = document.createElement('p'); p.className = 'lf-why'; p.textContent = why;
    box.append(h, p);
    if (detail) { const d = document.createElement('p'); d.className = 'lf-detail'; d.textContent = detail; box.append(d); }
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lf-retry'; b.textContent = 'Try again';
    b.addEventListener('click', () => location.reload()); box.append(b);
    o.append(box);
    console.error('[outline] ' + why + (detail ? ' — ' + detail : ''));
  }
  addEventListener('error', (e) => {
    if (state !== 'loading') return;
    firstError = firstError || (e.error?.message || e.message || 'script error');
    // Give the page a moment: a non-fatal error may still be followed by a draw.
    setTimeout(() => { if (state === 'loading' && !drawn()) fail('Something in the page stopped it from drawing the document.', firstError); }, 600);
  });
  function watch() {
    clearInterval(poll);
    poll = setInterval(() => {
      if (drawn()) settle();
      else if (Date.now() - t0 > LIMIT) fail('The document took too long to draw.', firstError);
    }, 120);
  }
  function runDeferred() {
    for (const s of document.querySelectorAll('script[type="text/x-outline-deferred"]')) {
      const n = document.createElement('script'); n.textContent = s.textContent; s.replaceWith(n);
      if (state === 'failed') return;
    }
  }
  function hasShape(d) { return d && typeof d === 'object' && Array.isArray(d.blocks) && d.blocks.length > 0; }
  async function fetchData(url) {
    if (location.protocol === 'file:') { fail('This page loads its data from ' + url + ', which only works when the page is served.', 'Open it through a local web server, or rebuild it with the data baked in.'); return; }
    const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), FETCH_LIMIT);
    try {
      const r = await fetch(url, { signal: ctl.signal, cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url);
      const d = await r.json();
      if (!hasShape(d)) throw new Error(url + ' has no blocks to show');
      return d;
    } catch (e) {
      fail(e.name === 'AbortError' ? 'The data file took too long to arrive.' : 'The data file could not be read.', e.name === 'AbortError' ? url : e.message);
    } finally { clearTimeout(timer); }
  }
  window.__outlineBoot = {
    // Called after the inline scripts in the page. Baked data: just watch for the draw.
    async start() {
      const tag = document.getElementById('trace-data');
      const url = tag?.dataset.src;
      if (!url) {
        if (!hasShape(window.OUTLINE_SEED)) { fail('The page has no document data in it.'); return; }
        if (drawn()) settle(); else watch();
        return;
      }
      watch();
      const d = await fetchData(url); if (!d || state !== 'loading') return;
      window.OUTLINE_SEED = d;
      const title = document.getElementById('document-title'); if (title && d.title) document.title = d.title;
      runDeferred();
      if (state === 'loading' && drawn()) settle();
    },
  };
  document.documentElement.classList.add('is-loading');
})();
