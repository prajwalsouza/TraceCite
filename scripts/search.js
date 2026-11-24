// Search, in the macOS Spotlight / Arc command-bar style: a floating bar near the
// top of the screen with one large field and grouped results under it.
// Opens with the search button, Cmd/Ctrl K, or "/". Arrow keys move, Enter opens,
// Escape closes. Results come from the trace data, so nothing is fetched.
(function () {
  'use strict';
  const doc = window.OUTLINE_SEED || { blocks: [], sources: [], tagTree: [] };
  const get = (b, k) => b?.fields?.find((f) => f.key === k)?.value || '';
  const ICON = {
    section: ['0 0 512 512', 'M64 144a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM64 464a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm48-208a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z'],
    sentence: ['0 0 448 512', 'M448 296c0 66.3-53.7 120-120 120h-8c-17.7 0-32-14.3-32-32s14.3-32 32-32h8c30.9 0 56-25.1 56-56v-8H320c-35.3 0-64-28.7-64-64V160c0-35.3 28.7-64 64-64h64c35.3 0 64 28.7 64 64v32 32 72zm-256 0c0 66.3-53.7 120-120 120H64c-17.7 0-32-14.3-32-32s14.3-32 32-32h8c30.9 0 56-25.1 56-56v-8H64c-35.3 0-64-28.7-64-64V160c0-35.3 28.7-64 64-64h64c35.3 0 64 28.7 64 64v32 32 72z'],
    tag: ['0 0 448 512', 'M0 80V229.5c0 17 6.7 33.3 18.7 45.3l176 176c25 25 65.5 25 90.5 0L418.7 317.3c25-25 25-65.5 0-90.5l-176-176c-12-12-28.3-18.7-45.3-18.7H48C21.5 32 0 53.5 0 80zm112 32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z'],
    source: ['0 0 448 512', 'M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96zm0 384H352v64H96c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16zm16 48H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z'],
    search: ['0 0 512 512', 'M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z'],
  };
  ICON.command = ['0 0 448 512', 'M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zM64 256c0-17.7 14.3-32 32-32H352c17.7 0 32 14.3 32 32s-14.3 32-32 32H96c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z'];
  const svg = (n) => `<svg viewBox="${ICON[n][0]}" aria-hidden="true"><path d="${ICON[n][1]}"/></svg>`;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  // ---------- index ----------
  const HIDE = /^(collab-|heading$|document-structure)/;
  const items = [];
  const sectionOf = new Map();
  (function walk(blocks, section) {
    for (const b of blocks || []) {
      if (b.type === 'section') { items.push({ kind: 'Sections', id: b.id, text: b.text }); walk(b.children, b.text); continue; }
      if (b.type === 'sentence') { items.push({ kind: 'Sentences', id: b.id, text: b.text, hint: section || '' }); sectionOf.set(b.id, section); }
      walk(b.children, section);
    }
  })(doc.blocks);
  (function tags(list, path) {
    for (const t of list || []) { if (!HIDE.test(t.id)) items.push({ kind: 'Tags', id: t.id, text: t.name, hint: path.join(' / ') }); tags(t.children, [...path, t.name]); }
  })(doc.tagTree, []);
  const citedBy = new Map();
  (function walk(blocks, sentence) {
    for (const b of blocks || []) {
      const s = b.type === 'sentence' ? b.id : sentence;
      const src = get(b, 'Source ID');
      if (src && s && !citedBy.has(src)) citedBy.set(src, s);
      walk(b.children, s);
    }
  })(doc.blocks);
  for (const s of doc.sources || []) if (citedBy.has(s.id)) items.push({ kind: 'Sources', id: s.id, text: s.text, hint: get(s, 'APA reference'), extra: (s.fields || []).filter((f) => /^Exact quote/.test(f.key)).map((f) => f.value).join(' ') });
  const ORDER = ['Commands', 'Sections', 'Sentences', 'Tags', 'Sources'];
  const LIMIT = { Commands: 3, Sections: 5, Sentences: 8, Tags: 5, Sources: 5 };

  // "#" searches tags only, "@" sources only and "/" runs commands.
  const PREFIX = { '#': 'Tags', '@': 'Sources', '/': 'Commands' };
  function scope(query) {
    const m = query.match(/^\s*([#@/])\s*/);
    if (!m) return { kinds: null, text: query };
    return { kinds: [PREFIX[m[1]]], text: query.slice(m[0].length) };
  }

  // ---------- commands ----------
  // Built fresh each time, so they always show the current state (On / Off, the theme in use).
  const go = (hash) => () => { location.hash = hash; };
  function currentSection() {
    const secs = [...document.querySelectorAll('#outline section[id^="reading-"]')];
    let best = null;
    for (const sec of secs) { const top = sec.getBoundingClientRect().top; if (top <= innerHeight * 0.3) best = sec; else break; }
    return (best || secs[0])?.id.replace(/^reading-/, '');
  }
  function copyLink() {
    const id = currentSection(); if (!id) return;
    const url = location.href.split('#')[0] + '#/at/' + id;
    navigator.clipboard?.writeText(url).then(() => toast('Link to this section copied'), () => toast(url));
  }
  let toastNode = null;
  function toast(text) {
    toastNode?.remove();
    toastNode = el('div', 'spot-toast', text); toastNode.setAttribute('role', 'status');
    document.body.append(toastNode);
    setTimeout(() => toastNode?.remove(), 2200);
  }
  function commands() {
    const S = window.TraceSettings, P = S?.prefs || {}, out = [];
    const add = (text, hint, run, common) => out.push({ kind: 'Commands', id: 'cmd-' + out.length, text, hint, run, common });
    const onOff = (key, name) => add((P[key] ? 'Turn off ' : 'Turn on ') + name.toLowerCase(), P[key] ? 'On now' : 'Off now', () => S.set(key, !P[key]));
    add('Contents', 'Go to', go('/contents'), true);
    add('Tag tree', 'Go to', go('/tags'), true);
    add('Back to the paper', 'Go to', go('/'));
    add('Settings · Appearance', 'Go to', go('/settings/appearance'));
    add('Settings · Text', 'Go to · font, size, spacing', go('/settings/text'));
    add('Settings · Reading', 'Go to', go('/settings/reading'));
    add('Settings · Citations', 'Go to', go('/settings/citations'));
    add('Settings · Advanced', 'Go to · long documents, Flow', go('/settings/advanced'));
    add('Settings · About', 'Go to', go('/settings/about'));
    add('Copy a link to this section', 'Share', copyLink, true);
    // Focus on any tag (the same as picking it in the tag tree): "/ focus method" finds "Focus: Method".
    for (const t of items.filter((i) => i.kind === 'Tags')) add('Focus: ' + t.text, t.hint ? 'Tag · ' + t.hint : 'Tag family', () => pinTag(t.id));
    if (document.querySelector('#reading-focus-clear') && !document.querySelector('#reading-focus-dock')?.hidden) add('Clear tag focus', 'Tags', () => document.getElementById('reading-focus-clear')?.click(), true);
    if (S) {
      add(P.side === 'shut' ? 'Open the sidebar' : 'Collapse the sidebar', 'Layout  ·  [', () => S.set('side', P.side === 'shut' ? 'open' : 'shut'), true);
      for (const t of S.THEMES) if (t.id !== P.theme) add('Theme: ' + t.name, t.mode === 'dark' ? 'Dark theme' : 'Light theme', () => S.set('theme', t.id));
      const theme = P.theme || 'sage', cur = S.paletteOf?.(theme) || '';
      for (const [id, name] of S.PALETTES?.[theme] || []) if (id !== cur) add('Palette: ' + name, 'Colours for this theme', () => S.setPalette(theme, id));
      for (const [id, st] of Object.entries(window.TraceCiteStyles?.STYLES || {})) if (id !== P.cite) add('Citation style: ' + st.name, 'Citations', () => S.set('cite', id));
      for (const [id, name] of S.FONTS || []) if (id !== (P.font || '')) add('Font: ' + name, id ? 'Over the theme' : 'Back to the theme’s own', () => S.set('font', id));
      for (const [v, name] of [['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['xl', 'Larger']]) if (v !== P.size) add('Text size: ' + name, 'Reading', () => S.set('size', v));
      onOff('eqHover', 'Highlight in equations');
      onOff('traceAnim', 'Animate opening a sentence');
      onOff('citations', 'Colour citations');
      onOff('peek', 'Outline in the margin');
      onOff('tagRail', 'Tag tree in the margin');
      onOff('paper', 'Paper card');
    }
    return out;
  }
  // Deep links: #/at/<block id> scrolls to a section or opens a sentence.
  function follow() {
    const m = location.hash.match(/^#\/at\/(.+)$/); if (!m) return;
    const id = decodeURIComponent(m[1]);
    let tries = 0;
    (function wait() {
      window.TraceWindow?.ensure(id);
      const sec = document.getElementById('reading-' + id), sen = document.querySelector(`#outline [data-read-sentence="${CSS.escape(id)}"]`);
      if (sec) { sec.scrollIntoView({ block: 'start' }); history.replaceState(null, '', location.pathname + location.search + '#/'); }
      else if (sen) { history.replaceState(null, '', location.pathname + location.search + '#/'); openSentence(id); }
      else if (tries++ < 60) setTimeout(wait, 100);
    })();
  }
  addEventListener('hashchange', follow); setTimeout(follow, 0);

  function search(raw) {
    const { kinds, text: query } = scope(raw);
    const all = kinds && kinds[0] === 'Commands' ? commands() : kinds ? items : [...commands(), ...items];
    const pool = kinds ? all.filter((i) => kinds.includes(i.kind)) : all;
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return kinds ? pool.slice(0, 60) : pool.filter((i) => i.kind === 'Sections' || (i.kind === 'Tags' && !i.hint)).slice(0, 12);
    const scored = [];
    for (const i of pool) {
      const hay = (i.text + ' ' + (i.hint || '') + ' ' + (i.extra || '')).toLowerCase();
      if (!words.every((w) => hay.includes(w))) continue;
      const title = i.text.toLowerCase();
      let score = words.filter((w) => title.includes(w)).length * 2;
      if (title.startsWith(words[0])) score += 3;
      if (i.kind === 'Sections' || i.kind === 'Tags') score += 1;
      scored.push([score, i]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    const out = [], counts = {};
    for (const [, i] of scored) { counts[i.kind] = (counts[i.kind] || 0) + 1; if (kinds || counts[i.kind] <= LIMIT[i.kind]) out.push(i); }
    return ORDER.flatMap((k) => out.filter((i) => i.kind === k));
  }
  // Matched words shown in the accent colour, never bold.
  function marked(text, query, max = 100000) {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = text;
    if (text.length > max && words.length) {
      const at = text.toLowerCase().indexOf(words[0]);
      const start = Math.max(0, Math.min(at - 40, text.length - max));
      shown = (start > 0 ? '…' : '') + text.slice(start, start + max) + (start + max < text.length ? '…' : '');
    } else if (text.length > max) shown = text.slice(0, max) + '…';
    const frag = document.createDocumentFragment();
    if (!words.length) { frag.append(shown); return frag; }
    const re = new RegExp('(' + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
    shown.split(re).forEach((part, k) => frag.append(k % 2 ? el('mark', '', part) : part));
    return frag;
  }

  // ---------- actions ----------
  const leaveSettings = () => { if (location.hash.startsWith('#/settings')) location.hash = '/'; };
  function openSentence(id) {
    leaveSettings();
    requestAnimationFrame(() => {
      window.TraceWindow?.ensure(id);
      const node = document.querySelector(`#outline [data-read-sentence="${CSS.escape(id)}"]`);
      if (!node) return;
      if (node.getAttribute('aria-expanded') !== 'true') node.click();
      const fresh = document.querySelector(`#outline [data-read-sentence="${CSS.escape(id)}"]`) || node;
      fresh.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }
  function pinTag(id) {
    leaveSettings();
    const tree = document.getElementById('reading-focus-tree');
    const target = tree?.querySelector(`[data-reading-tag="${CSS.escape(id)}"]`);
    if (!target) return;
    for (let list = target.closest('ul'); list && list !== tree; list = list.parentElement.closest('ul')) if (list.hidden) list.previousElementSibling?.querySelector('.reading-tag-toggle')?.click();
    if (target.getAttribute('aria-pressed') !== 'true') target.click();
    document.getElementById('close-navigation')?.click();
  }
  function act(item) {
    close();
    if (item.kind === 'Commands') { item.run(); return; }
    if (item.kind === 'Sections') { leaveSettings(); requestAnimationFrame(() => { window.TraceWindow?.ensure(item.id); document.getElementById('reading-' + item.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }); }
    else if (item.kind === 'Sentences') openSentence(item.id);
    else if (item.kind === 'Tags') pinTag(item.id);
    else if (item.kind === 'Sources') openSentence(citedBy.get(item.id));
  }

  // ---------- the bar ----------
  const scrim = el('div', 'spot-scrim'); scrim.hidden = true;
  const bar = el('div', 'spot'); bar.setAttribute('role', 'dialog'); bar.setAttribute('aria-modal', 'true'); bar.setAttribute('aria-label', 'Search this document');
  const field = el('div', 'spot-field');
  const icon = el('span', 'spot-icon'); icon.innerHTML = svg('search');
  const input = el('textarea', 'spot-input'); input.rows = 1; input.placeholder = 'Search, or type / for commands'; input.setAttribute('aria-label', 'Search'); input.setAttribute('autocomplete', 'off'); input.setAttribute('spellcheck', 'false');
  input.setAttribute('role', 'combobox'); input.setAttribute('aria-controls', 'spot-list'); input.setAttribute('aria-expanded', 'true');
  // Phones get an iOS-style Cancel beside the field; desktops close with Escape.
  const cancel = el('button', 'spot-cancel', 'Cancel'); cancel.type = 'button';
  cancel.addEventListener('click', () => close());
  field.append(icon, input, cancel);
  const list = el('div', 'spot-list'); list.id = 'spot-list'; list.setAttribute('role', 'listbox');
  // The side panel: the three prefixes, and the commands people reach for most. Hidden on phones.
  const aside = el('div', 'spot-aside'); aside.setAttribute('aria-label', 'Search modes and common commands');
  const body = el('div', 'spot-main'); body.append(list, aside);
  function drawAside() {
    aside.replaceChildren();
    aside.append(el('div', 'spot-aside-h', 'Narrow the search'));
    for (const [p, what, about] of [['#', 'Tags', 'tags only'], ['@', 'Sources', 'sources only'], ['/', 'Commands', 'views, themes, settings']]) {
      const b = el('button', 'spot-aside-row'); b.type = 'button';
      b.append(el('kbd', '', p), el('span', '', what), el('small', '', about));
      b.addEventListener('click', () => { input.value = p + ' '; active = 0; showMode(); draw(); input.focus(); });
      aside.append(b);
    }
    aside.append(el('div', 'spot-aside-h', 'Common'));
    for (const c of commands().filter((x) => x.common)) {
      const b = el('button', 'spot-aside-row cmd'); b.type = 'button';
      b.append(el('span', '', c.text));
      b.addEventListener('click', () => act(c));
      aside.append(b);
    }
  }
  bar.append(field, body); scrim.append(bar); document.body.append(scrim);
  let results = [], active = 0, lastFocus = null;

  function draw() {
    results = search(input.value);
    active = Math.min(active, Math.max(0, results.length - 1));
    list.replaceChildren();
    if (!results.length) { list.append(el('div', 'spot-empty', 'No matches')); input.removeAttribute('aria-activedescendant'); return; }
    const KIND = { Sections: 'Section', Tags: 'Tag', Sources: 'Source', Commands: 'Command' };
    const ICONS = { Sections: 'section', Sentences: 'sentence', Tags: 'tag', Sources: 'source', Commands: 'command' };
    const q = scope(input.value).text;
    results.forEach((item, k) => {
      const row = el('div', 'spot-row kind-' + ICONS[item.kind] + (k === active ? ' on' : ''));
      row.id = 'spot-' + k; row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(k === active));
      const ic = el('span', 'spot-kind'); ic.innerHTML = svg(ICONS[item.kind]); ic.title = KIND[item.kind] || 'Sentence';
      const main = el('span', 'spot-text'); main.append(marked(item.text, q)); main.title = item.text;
      const body = el('span', 'spot-body'); body.append(main, el('span', 'spot-hint', item.kind === 'Sentences' || item.kind === 'Commands' ? (item.hint || '') : item.kind === 'Tags' ? (item.hint || 'Tag') : KIND[item.kind]));
      row.append(ic, body);
      row.addEventListener('pointermove', () => { if (active !== k) { active = k; paint(); } });
      row.addEventListener('click', () => act(item));
      list.append(row);
    });
    paint();
  }
  function paint() {
    list.querySelectorAll('.spot-row').forEach((r, k) => { r.classList.toggle('on', k === active); r.setAttribute('aria-selected', String(k === active)); });
    input.setAttribute('aria-activedescendant', 'spot-' + active);
    list.querySelector('.spot-row.on')?.scrollIntoView({ block: 'nearest' });
  }
  function open() {
    if (!scrim.hidden) { input.select(); return; }
    lastFocus = document.activeElement;
    if (!document.getElementById('sidebar')?.hidden) document.getElementById('close-navigation')?.click();
    scrim.hidden = false; document.body.classList.add('spot-open');
    input.value = ''; grow(); active = 0; showMode(); drawAside(); draw();
    requestAnimationFrame(() => input.focus());
  }
  function close() {
    if (scrim.hidden) return;
    scrim.hidden = true; document.body.classList.remove('spot-open');
    if (lastFocus?.isConnected && lastFocus !== document.body) lastFocus.focus?.({ preventScroll: true, focusVisible: false });
  }
  const mode = el('span', 'spot-mode'); field.insertBefore(mode, input);
  function showMode() { const k = scope(input.value).kinds; mode.textContent = k ? k[0] : ''; mode.hidden = !k; field.dataset.mode = k ? k[0] : ''; }
  const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; };
  input.addEventListener('input', () => { grow(); active = 0; showMode(); draw(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % Math.max(1, results.length); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + results.length) % Math.max(1, results.length); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) act(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
  });
  scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) close(); });
  // Before Trace's own key handler, which would open the sidebar's old search on "/".
  addEventListener('keydown', (e) => {
    const typing = e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); e.stopImmediatePropagation(); scrim.hidden ? open() : close(); }
    else if (e.key === '/' && !typing) { e.preventDefault(); e.stopImmediatePropagation(); open(); }
    else if (e.key === 'Escape' && !scrim.hidden) { e.preventDefault(); e.stopImmediatePropagation(); close(); }
  }, true);

  // ---------- Search is the first item in the sidebar menu ----------
  const item = el('button', 'nav-button side-item search-item'); item.type = 'button';
  item.innerHTML = svg('search');
  item.append(el('span', '', 'Search'), el('kbd', 'side-kbd', navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'));
  item.addEventListener('click', open);
  item.title = 'Search';
  document.querySelector('#sidebar .side-menu')?.prepend(item);
  // Phones: a round search button beside the menu button (the top bar that holds both is hidden on desktop,
  // where Search sits in the sidebar with ⌘K).
  const menuBtn = document.getElementById('mobile-menu');
  if (menuBtn && !document.querySelector('.search-trigger')) {
    const b = el('button', 'search-trigger'); b.type = 'button'; b.innerHTML = svg('search');
    b.setAttribute('aria-label', 'Search'); b.title = 'Search';
    b.addEventListener('click', open);
    document.body.append(b);
  }
  window.TraceSearch = { open, close };
})();
