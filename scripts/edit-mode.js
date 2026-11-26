// Edit mode (format 1.1): the reading page becomes the editor, in place, without changing how it looks.
//
// Turn it on with "Edit mode" in the sidebar (or E). Then:
//   click a sentence      edit its text (the text as stored, with its markup; citations stay as they are)
//   Enter                 keep the edit and start a new sentence after it
//   Backspace when empty  take the sentence out
//   Tab, Shift+Tab        the next or previous sentence
//   Escape                drop the edit in progress (Done, or E, leaves edit mode)
//   ⌘Z, ⇧⌘Z (not typing)  undo and redo whole edits
//   Comment, Reply        while reading (not in edit mode): an opened sentence ends with "Add a comment"
//   Save version          make the edits on the stored document, record each in its "changes" (format 1.1) and
//                         save the package as its next version (manifest history). In the BibTrace extension
//                         it goes back into the library; elsewhere it downloads as a .trace.zip.
// Edits not yet saved are kept in this browser (localStorage) and come back after a reload.
// Edits are made on the stored document (the package's .trace.json); the page shows them on the prepared copy
// it draws from. Needs TracePackage (package.js) and the page's window.__tracePackage.
(() => {
  const P = () => window.TracePackage;
  const PKG = () => window.__tracePackage;
  const DOC = () => window.__traceDocForCitations;
  const docKey = () => { const d = PKG()?.pkg?.doc; return 'trace-edits-pending:' + (d?.id || d?.title || document.title); };
  const NAME = 'trace-editor-name';
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const rid = (p) => p + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

  let on = false, work = null, pending = [], redo = [], editing = null, saving = false;

  // ---------- the two trees: the stored document (work) and the drawn copy ----------
  function ensureWork() {
    const pkg = PKG()?.pkg; if (!pkg?.doc) return false;
    if (!work || work.pkg !== pkg) { work = { pkg, blocks: clone(pkg.doc.blocks) }; }
    return true;
  }
  // The drawn copy is prepared from the stored document (sources merged, tags added), so edits are made on it
  // loosely: by id, without comparing the text it had.
  // The page draws from two copies: the outline's (app.js) and the opened-line panel's (reading-only.js, from
  // window.OUTLINE_SEED). Each edit reaches both.
  function applyDrawn(c) {
    const copies = [...new Set([DOC(), window.OUTLINE_SEED].filter((d) => d?.blocks))];
    for (const doc of copies) applyTo(doc, c);
  }
  function applyTo(doc, c) {
    const F = P().findBlock;
    if (c.op === 'text') { const hit = F(doc.blocks, c.block); if (hit) hit.b.text = c.after; }
    else if (c.op === 'insert') { if (F(doc.blocks, c.block)) return; const list = c.parent ? F(doc.blocks, c.parent)?.b.children : doc.blocks; if (!list) return; const i = c.previous ? list.findIndex((b) => b.id === c.previous) : -1; list.splice(c.previous ? (i < 0 ? list.length : i + 1) : 0, 0, clone(c.value)); }
    else if (c.op === 'remove') { const hit = F(doc.blocks, c.block); if (hit) hit.list.splice(hit.list.indexOf(hit.b), 1); }
  }
  function make(c, { record = true } = {}) {
    P().applyChange(work.blocks, c);
    applyDrawn(c);
    if (record) { pending.push(c); redo = []; }
    persist();
  }
  const persist = () => { store.set(docKey(), pending); document.documentElement.classList.toggle('trace-pending', pending.length > 0); };
  const render = () => { window.__traceRender?.(); requestAnimationFrame(mark); opened(); };

  // ---------- making edits ----------
  const who = () => (store.get(NAME, '') || '').trim();
  const now = () => new Date().toISOString();
  function textEdit(id, after) {
    const hit = P().findBlock(work.blocks, id); if (!hit) return;
    const before = hit.b.text;
    if (after === before) return;
    if (!after) return removeBlock(id);
    make({ id: rid('ch'), at: now(), by: who(), op: 'text', block: id, before, after });
  }
  function removeBlock(id) {
    const hit = P().findBlock(work.blocks, id); if (!hit) return;
    const i = hit.list.indexOf(hit.b);
    make({ id: rid('ch'), at: now(), by: who(), op: 'remove', block: id, parent: hit.parent?.id || null, previous: i > 0 ? hit.list[i - 1].id : null, value: clone(hit.b) });
  }
  function insertAfter(prevId, text) {
    const hit = P().findBlock(work.blocks, prevId); if (!hit || !text) return null;
    const id = rid('s');
    const fields = [{ key: 'Added on', value: now().slice(0, 10) }, ...(who() ? [{ key: 'Added by', value: who() }] : [])];
    make({ id: rid('ch'), at: now(), by: who(), op: 'insert', block: id, parent: hit.parent?.id || null, previous: prevId, value: { id, type: 'sentence', text, tags: [], fields, collapsed: false, children: [] } });
    return id;
  }
  function undo() { const c = pending.pop(); if (!c) return; make(P().invert(c), { record: false }); redo.push(c); persist(); render(); bar(); }
  function again() { const c = redo.pop(); if (!c) return; make(c, { record: false }); pending.push(c); persist(); render(); bar(); }

  // ---------- editing a sentence in place ----------
  const sentenceEl = (id) => document.querySelector(`#outline .apa-sentence[data-read-sentence="${CSS.escape(id)}"]`);
  const sentences = () => [...document.querySelectorAll('#outline .apa-sentence[data-read-sentence], #outline .te-new')];
  function caretAt(el, x, y, atEnd) {
    const sel = getSelection(); let r = null;
    if (!atEnd && x != null) { r = document.caretRangeFromPoint?.(x, y); if (r && !el.contains(r.startContainer)) r = null; }
    if (!r) { r = document.createRange(); r.selectNodeContents(el); r.collapse(atEnd !== false ? false : true); }
    sel.removeAllRanges(); sel.addRange(r);
  }
  function start(el, { x, y, atEnd } = {}) {
    if (editing?.el === el) return;
    const want = el.dataset.readSentence;
    finish();
    // Keeping the previous edit redraws the page; find the sentence again.
    if (!el.isConnected) { el = want && sentenceEl(want); if (!el) return; }
    const id = el.dataset.readSentence;
    const hit = id && P().findBlock(work.blocks, id);
    if (id && !hit) return;
    editing = { el, id: id || null, after: el.dataset.teAfter || null, html: el.innerHTML, raw: hit ? hit.b.text : '' };
    el.textContent = editing.raw;
    el.contentEditable = 'true'; el.spellcheck = true; el.classList.add('te-field');
    el.setAttribute('role', 'textbox'); el.setAttribute('aria-label', 'Sentence text');
    el.focus({ preventScroll: true });
    caretAt(el, x, y, atEnd);
    bar();
  }
  const valueOf = (el) => el.innerText.replace(/\s*\n\s*/g, ' ').replace(/ /g, ' ').trim();
  // Keep (or drop) the edit in progress. Returns the id of the sentence that now stands there, if any.
  function finish(cancel = false) {
    const e = editing; if (!e) return null; editing = null;
    const text = valueOf(e.el);
    e.el.contentEditable = 'false'; e.el.removeAttribute('contenteditable'); e.el.classList.remove('te-field'); e.el.removeAttribute('role'); e.el.removeAttribute('aria-label');
    let id = e.id;
    if (cancel) { if (e.id) e.el.innerHTML = e.html; else e.el.remove(); bar(); return id; }
    if (e.id) { if (text !== e.raw) { textEdit(e.id, text); if (!text) id = null; render(); } else e.el.innerHTML = e.html; }
    else { e.el.remove(); if (text) { id = insertAfter(e.after, text); render(); } else id = null; }
    bar();
    return id;
  }
  function newAfter(id) {
    const prev = sentenceEl(id); if (!prev) return;
    const el = document.createElement('span'); el.className = 'apa-sentence te-new'; el.dataset.teAfter = id;
    prev.after(document.createTextNode(' '), el);
    start(el, { atEnd: true });
  }
  function move(by) {
    const list = sentences(), i = list.indexOf(editing?.el);
    const target = list[i + by]?.dataset.readSentence;
    finish();
    const next = target && sentenceEl(target); if (next) start(next, { atEnd: by < 0 });
  }

  addEventListener('click', (ev) => {
    if (!on) return;
    const el = ev.target.closest?.('#outline .apa-sentence[data-read-sentence], #outline .te-new'); if (!el) { if (editing && !ev.target.closest?.('.te-bar')) finish(); return; }
    ev.preventDefault(); ev.stopPropagation();
    if (ev.target.closest('a') && !el.isContentEditable) return;
    start(el, { x: ev.clientX, y: ev.clientY });
  }, true);
  // Keys inside the field are this field's alone (the page's own shortcuts, and Edits' Enter-to-ask, never see them).
  addEventListener('keydown', (ev) => {
    if (!on) return;
    const k = ev.key, mod = ev.metaKey || ev.ctrlKey;
    if (editing && ev.target === editing.el) {
      ev.stopPropagation();
      if (k === 'Escape') { ev.preventDefault(); finish(true); }
      else if (k === 'Enter' && !ev.shiftKey) { ev.preventDefault(); const id = finish(); if (id) newAfter(id); }
      else if (k === 'Enter') ev.preventDefault();
      else if (k === 'Tab') { ev.preventDefault(); move(ev.shiftKey ? -1 : 1); }
      else if (k === 'Backspace' && !valueOf(editing.el)) {
        ev.preventDefault();
        const list = sentences(), i = list.indexOf(editing.el), prevId = list[i - 1]?.dataset.readSentence;
        editing.el.textContent = ''; finish();
        const p = prevId && sentenceEl(prevId); if (p) start(p, { atEnd: true });
      }
      return;
    }
    const typing = ev.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName);
    if (typing) return;
    if (mod && k.toLowerCase() === 'z') { ev.preventDefault(); ev.stopPropagation(); ev.shiftKey ? again() : undo(); }
  }, true);
  addEventListener('keydown', (ev) => {
    const typing = ev.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName);
    if (!typing && !ev.metaKey && !ev.ctrlKey && !ev.altKey && (ev.key === 'e' || ev.key === 'E') && document.getElementById('outline')) { ev.preventDefault(); toggle(); }
  });
  // Paste as plain text: the field holds stored text, never formatting.
  addEventListener('paste', (ev) => {
    if (!editing || ev.target !== editing.el && !editing.el.contains(ev.target)) return;
    ev.preventDefault(); document.execCommand('insertText', false, (ev.clipboardData?.getData('text/plain') || '').replace(/\s*\n\s*/g, ' '));
  }, true);

  // ---------- marks: what changed since the last save ----------
  function mark() {
    document.querySelectorAll('#outline .te-changed').forEach((n) => n.classList.remove('te-changed'));
    if (!on) return;
    const ids = new Set(pending.filter((c) => c.op !== 'remove').map((c) => c.block));
    for (const id of ids) sentenceEl(id)?.classList.add('te-changed');
  }

  // ---------- saving a version ----------
  async function save() {
    if (saving) return;
    finish();
    if (!pending.length) return;
    const p = PKG(); if (!p?.pkg) return say('This page has no package to save to.');
    saving = true; bar();
    try {
      const n = pending.length;
      // Edits made before a name was given are signed by the person saving them.
      const next = await P().withEdits(p.pkg, pending.map((c) => (c.by ? c : { ...c, by: who() })), { by: who(), note: n === 1 ? '1 edit' : n + ' edits' });
      const name = P().fileName ? P().fileName(next) : p.fileName;
      p.pkg = next; p.bytes = next.bytes; p.manifest = next.manifest;
      pending = []; redo = []; persist(); work = null; ensureWork();
      let where = '';
      if (window.TraceHost?.save) { const r = await window.TraceHost.save(next.bytes, name, { version: next.manifest.version }); where = r?.where || 'Saved'; }
      else { const url = URL.createObjectURL(new Blob([next.bytes], { type: 'application/zip' })); const a = document.createElement('a'); a.href = url; a.download = name || 'document.trace.zip'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); where = 'Downloaded'; }
      say(`${where} as version ${next.manifest.version}.`);
      mark();
    } catch (e) { say('Not saved: ' + (e?.message || e)); }
    saving = false; bar();
  }

  // ---------- comments and replies ----------
  // A comment is a note block with a "Comment by" field, under the sentence it is about; a reply is a comment
  // under a comment (docs/format.md). An opened sentence ends with one quiet line, "Add a comment"; a comment
  // offers "Reply" only while the pointer is on it. Posting records an insert change like any edit: it is
  // saved with the next version, and Undo takes it back. Comments are made while reading (not in edit mode,
  // where a click edits the sentence instead).
  const isComment = (b) => b?.type === 'note' && (b.fields || []).some((f) => f.key === 'Comment by');
  function addComment(parentId, text) {
    if (!ensureWork() || !text) return null;
    const hit = P().findBlock(work.blocks, parentId); if (!hit) return null;
    const kids = hit.b.children || [];
    const id = rid('c');
    const value = { id, type: 'note', text, tags: [], fields: [{ key: 'Comment by', value: who() }, { key: 'Commented on', value: now().slice(0, 10) }], collapsed: false, children: [] };
    make({ id: rid('ch'), at: now(), by: who(), op: 'insert', block: id, parent: parentId, previous: kids.length ? kids[kids.length - 1].id : null, value });
    return id;
  }
  // The comment ids in the order reading-only.js draws them (each thread, then its replies, depth first).
  function threadIds(sentence) {
    const out = [];
    const replies = (c) => { for (const r of (c.children || []).filter(isComment)) { out.push(r.id); replies(r); } };
    (function collect(list) { for (const b of list || []) { if (isComment(b)) { out.push(b.id); replies(b); } else if (b.type !== 'sentence') collect(b.children); } })(sentence.children);
    return out;
  }
  function augment() {
    if (on) return;
    const ev = document.querySelector('#outline .apa-evidence > .ev'); if (!ev || ev.dataset.cm) return;
    const sid = ev.parentElement.querySelector('li.block')?.dataset.block;
    const sentence = sid && DOC()?.blocks && P()?.findBlock(DOC().blocks, sid)?.b;
    if (!sentence || !ensureWork() || !P().findBlock(work.blocks, sid)) return;
    ev.dataset.cm = '1';
    const ids = threadIds(sentence), unsaved = new Set(pending.filter((c) => c.op === 'insert').map((c) => c.block));
    ev.querySelectorAll('li.ev-comment').forEach((li, i) => {
      const id = ids[i]; if (!id) return;
      li.dataset.comment = id; li.classList.toggle('cm-unsaved', unsaved.has(id));
      const by = li.querySelector(':scope > .ev-comment-head .ev-comment-by')?.textContent || '';
      const r = document.createElement('button'); r.type = 'button'; r.className = 'cm-reply'; r.textContent = 'Reply';
      r.addEventListener('click', (e) => { e.stopPropagation(); compose(li, id, by && by !== 'Unsigned' ? 'Reply to ' + by : 'Reply'); });
      li.querySelector(':scope > .ev-comment-head')?.append(r);
    });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'cm-add'; add.textContent = 'Add a comment';
    add.addEventListener('click', (e) => { e.stopPropagation(); compose(add, sid, 'Add a comment'); });
    const host = ev.querySelector(':scope > .ev-pane-sources') || ev;
    const prov = host === ev ? ev.querySelector(':scope > .ev-prov') : null;
    prov ? prov.before(add) : host.append(add);
  }
  function compose(anchor, parentId, label) {
    document.querySelectorAll('.cm-form').forEach((f) => f.remove());
    document.querySelectorAll('.cm-add[hidden]').forEach((b) => { b.hidden = false; });
    const f = document.createElement('form'); f.className = 'cm-form';
    const ta = document.createElement('textarea'); ta.rows = 1; ta.placeholder = label; ta.setAttribute('aria-label', label);
    const row = document.createElement('div'); row.className = 'cm-row';
    const name = document.createElement('input'); name.className = 'cm-name'; name.placeholder = 'Your name'; name.setAttribute('aria-label', 'Your name'); name.autocomplete = 'name'; name.hidden = !!who();
    const post = document.createElement('button'); post.type = 'submit'; post.className = 'cm-post'; post.textContent = 'Post';
    row.append(name, post); f.append(ta, row);
    const close = () => { f.remove(); if (anchor.classList.contains('cm-add')) anchor.hidden = false; };
    const fit = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; f.classList.toggle('cm-has', !!ta.value.trim()); };
    ta.addEventListener('input', fit);
    f.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); f.requestSubmit(); } });
    f.addEventListener('click', (e) => e.stopPropagation());
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = ta.value.replace(/\s+/g, ' ').trim(); if (!text) return;
      if (!name.hidden && name.value.trim()) { store.set(NAME, name.value.trim()); nameIn.value = name.value.trim(); }
      const id = addComment(parentId, text); if (!id) return;
      render();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const li = document.querySelector(`#outline li.ev-comment[data-comment="${CSS.escape(id)}"]`);
        li?.closest('.ev-comments')?.classList.add('ev-show');
        li?.classList.add('cm-flash');
      }));
      bar();
    });
    if (anchor.classList.contains('cm-add')) { anchor.hidden = true; anchor.after(f); } else anchor.append(f);
    ta.focus();
  }
  // The reader draws the opened panel a frame or two after the click: look for it over the next few frames.
  const opened = (n = 0) => requestAnimationFrame(() => { if (document.querySelector('#outline .apa-evidence > .ev:not([data-cm])')) augment(); else if (n < 12) opened(n + 1); });
  // Capture phase: the reader redraws the outline inside its own handler, taking the clicked node out of the page.
  document.addEventListener('click', (e) => { if (!on && e.target.closest?.('#outline')) opened(); }, true);
  document.addEventListener('keydown', (e) => { if (!on && (e.key === 'Enter' || e.key === ' ') && e.target.closest?.('#outline')) opened(); }, true);

  // ---------- the bar ----------
  const css = document.createElement('style');
  css.textContent = `
html.trace-editing #outline .apa-sentence{cursor:text;border-radius:4px;transition:background-color .15s ease}
html.trace-editing #outline .apa-sentence:hover{background:color-mix(in srgb,var(--accent-fill) 40%,transparent)}
html.trace-editing #outline .te-changed{background:color-mix(in srgb,var(--accent-fill) 55%,transparent)}
html.trace-editing #outline .te-field{background:color-mix(in srgb,var(--accent-fill) 70%,transparent);outline:none;box-decoration-break:clone;-webkit-box-decoration-break:clone;caret-color:var(--accent);padding:1px 2px;margin:-1px -2px}
html.trace-editing #outline .te-new:empty::before{content:'New sentence';color:var(--faint,var(--ink3))}
html.trace-editing #sentence-hover-rail,html.trace-editing .apa-evidence{display:none!important}
.te-bar{position:fixed;left:50%;bottom:16px;z-index:590;display:flex;align-items:center;gap:6px;max-width:calc(100vw - 24px);padding:6px 6px 6px 14px;border-radius:999px;background:var(--panel,var(--surface));color:var(--ink);box-shadow:0 12px 40px rgba(0,0,0,.14);font:500 12.5px/1.2 var(--font-ui,var(--font,system-ui));transform:translate(-50%,140%);opacity:0;transition:transform .26s cubic-bezier(.2,.7,.1,1),opacity .2s ease;pointer-events:none}
html:is(.trace-editing,.trace-pending) .te-bar{transform:translate(-50%,0);opacity:1;pointer-events:auto}
html:not(.trace-editing) .te-bar :is(.te-name,.te-redo,.te-done){display:none}
.te-bar .te-state{display:flex;align-items:center;gap:8px;white-space:nowrap;color:var(--ink2,var(--muted))}
.te-bar .te-dot{width:7px;height:7px;border-radius:50%;background:var(--accent);flex:none}
.te-bar input{width:112px;min-width:0;height:30px;padding:0 10px;border:0;border-radius:15px;background:var(--surface,transparent);color:var(--ink);font:inherit}
.te-bar input::placeholder{color:var(--faint,var(--ink3))}
.te-bar button{height:30px;padding:0 12px;border:0;border-radius:15px;background:none;color:var(--ink2,var(--muted));font:inherit;cursor:pointer;white-space:nowrap;transition:background-color .15s,color .15s}
.te-bar button:hover:not(:disabled),.te-bar button:focus-visible{background:var(--surface);color:var(--ink);outline:none}
.te-bar button:disabled{opacity:.4;cursor:default}
.te-bar button.te-save{background:var(--accent);color:var(--bg)}
.te-bar button.te-save:hover:not(:disabled){background:var(--accent);color:var(--bg);filter:brightness(1.06)}
.te-say{position:fixed;left:50%;bottom:64px;z-index:590;transform:translateX(-50%);padding:7px 14px;border-radius:999px;background:var(--ink);color:var(--bg);font:500 12px/1.3 var(--font-ui,system-ui);opacity:0;transition:opacity .2s;pointer-events:none}
.te-say.on{opacity:.92}
.te-side[aria-pressed=true],.te-side[aria-pressed=true] svg{color:var(--accent)}
#outline .cm-add{display:block;margin:12px 0 0;padding:4px 0;border:0;background:none;color:var(--faint,var(--ink3));font:500 12.5px/1.4 var(--font-ui,var(--font,system-ui));cursor:text;transition:color .15s}
#outline .cm-add:hover,#outline .cm-add:focus-visible{color:var(--ink2,var(--muted));outline:none}
#outline .cm-form{margin:10px 0 4px}
#outline li.ev-comment .cm-form{margin:8px 0 2px}
#outline .cm-form textarea{display:block;width:100%;box-sizing:border-box;min-height:36px;max-height:240px;padding:8px 12px;border:0;border-radius:12px;background:color-mix(in srgb,var(--ink) 4%,transparent);color:var(--ink);font:400 13.5px/1.6 var(--font-ui,var(--font,system-ui));resize:none;outline:none;transition:box-shadow .15s}
#outline .cm-form textarea:focus{box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 45%,transparent)}
#outline .cm-form textarea::placeholder{color:var(--faint,var(--ink3))}
#outline .cm-row{display:none;justify-content:flex-end;align-items:center;gap:6px;margin-top:6px}
#outline .cm-form.cm-has .cm-row{display:flex}
#outline .cm-name{width:130px;height:28px;padding:0 10px;border:0;border-radius:14px;background:color-mix(in srgb,var(--ink) 4%,transparent);color:var(--ink);font:400 12px var(--font-ui,system-ui);outline:none}
#outline .cm-name[hidden]{display:none}
#outline .cm-post{height:28px;padding:0 14px;border:0;border-radius:14px;background:var(--accent);color:var(--bg);font:500 12px var(--font-ui,system-ui);cursor:pointer}
#outline .cm-reply{margin-left:auto;padding:0;border:0;background:none;color:var(--faint,var(--ink3));font:500 11.5px var(--font-ui,system-ui);cursor:pointer;opacity:0;transition:opacity .15s,color .15s}
#outline .ev-comment-head:hover>.cm-reply,#outline .ev-comment-head:has(+.ev-comment-text:hover)>.cm-reply,#outline .cm-reply:focus-visible{opacity:1;outline:none}
#outline .cm-reply:hover{color:var(--ink2,var(--muted))}
@media (hover:none){#outline .cm-reply{opacity:1}}
#outline li.cm-unsaved>.ev-comment-head>.ev-comment-by::before{content:'';display:inline-block;width:6px;height:6px;margin:0 6px 1px 0;border-radius:50%;background:var(--accent);vertical-align:middle}
#outline li.cm-flash>.ev-comment-text{animation:cm-flash 1.6s ease}
@keyframes cm-flash{from{background:color-mix(in srgb,var(--accent-fill) 80%,transparent)}to{background:transparent}}
@media(max-width:620px){.te-bar{left:12px;right:12px;transform:translateY(140%);border-radius:18px;flex-wrap:wrap}html:is(.trace-editing,.trace-pending) .te-bar{transform:none}.te-bar input{flex:1}}
@media(prefers-reduced-motion:reduce){.te-bar,.te-say{transition:none}}`;
  document.head.append(css);
  const el = document.createElement('div'); el.className = 'te-bar'; el.setAttribute('role', 'toolbar'); el.setAttribute('aria-label', 'Edit mode');
  el.innerHTML = '<span class="te-state"><span class="te-dot" aria-hidden="true"></span><span class="te-count"></span></span>'
    + '<input class="te-name" type="text" placeholder="Your name" aria-label="Your name, for the history" autocomplete="name" spellcheck="false">'
    + '<button type="button" class="te-undo" title="Undo (⌘Z)">Undo</button><button type="button" class="te-redo" title="Redo (⇧⌘Z)">Redo</button>'
    + '<button type="button" class="te-save">Save version</button><button type="button" class="te-done" title="Leave edit mode (E)">Done</button>';
  document.body.append(el);
  const sayEl = document.createElement('div'); sayEl.className = 'te-say'; sayEl.setAttribute('role', 'status'); document.body.append(sayEl);
  function say(t) { sayEl.textContent = t; sayEl.classList.add('on'); clearTimeout(say.t); say.t = setTimeout(() => sayEl.classList.remove('on'), 3200); }
  const nameIn = el.querySelector('.te-name');
  nameIn.value = store.get(NAME, '');
  nameIn.addEventListener('input', () => store.set(NAME, nameIn.value));
  nameIn.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') nameIn.blur(); });
  el.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  el.querySelector('.te-undo').addEventListener('click', undo);
  el.querySelector('.te-redo').addEventListener('click', again);
  el.querySelector('.te-save').addEventListener('click', save);
  el.querySelector('.te-done').addEventListener('click', () => toggle(false));
  function bar() {
    const n = pending.length;
    el.querySelector('.te-count').textContent = saving ? 'Saving…' : editing ? 'Editing a sentence' : n ? (n === 1 ? '1 change not saved' : n + ' changes not saved') : 'Editing · click a sentence';
    el.querySelector('.te-undo').disabled = !n; el.querySelector('.te-redo').disabled = !redo.length;
    el.querySelector('.te-save').disabled = (!n && !editing) || saving;
    const c = document.querySelector('.te-side .te-n'); if (c) c.textContent = n || '';
  }

  // ---------- on and off ----------
  function toggle(want = !on) {
    if (want && !ensureWork()) { say('Open a TraceCite document to edit it.'); return; }
    if (!want) finish();
    on = want;
    document.documentElement.classList.toggle('trace-editing', on);
    document.querySelector('.te-side')?.setAttribute('aria-pressed', String(on));
    if (on && !nameIn.value) setTimeout(() => say('Click a sentence to change it. Enter adds one after it.'), 200);
    mark(); bar();
  }
  const ICON = '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M471.6 21.7c-21.9-21.9-57.3-21.9-79.2 0L362.3 51.7l97.9 97.9 30.1-30.1c21.9-21.9 21.9-57.3 0-79.2L471.6 21.7zm-299.2 220c-6.1 6.1-10.8 13.6-13.5 21.9l-29.6 88.8c-2.9 8.6-.6 18.1 5.8 24.6s15.9 8.7 24.6 5.8l88.8-29.6c8.2-2.7 15.7-7.4 21.9-13.5L437.7 172.3 339.7 74.3 172.4 241.7zM96 64C43 64 0 107 0 160V416c0 53 43 96 96 96H352c53 0 96-43 96-96V320c0-17.7-14.3-32-32-32s-32 14.3-32 32v96c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V160c0-17.7 14.3-32 32-32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H96z"/></svg>';
  function addSideItem() {
    if (document.querySelector('.te-side')) return true;
    const after = document.querySelector('.side-menu .le-side') || document.querySelector('.side-menu [data-side-view="tags"]'); if (!after) return false;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'nav-button side-item te-side'; b.title = 'Edit mode (E)'; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = ICON + '<span>Edit mode</span><span class="le-count te-n"></span>';
    b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); toggle(); });
    after.after(b); bar(); return true;
  }

  // ---------- start: the side item, and edits kept from before a reload ----------
  (function boot(tries = 0) {
    const ready = DOC()?.blocks && PKG()?.pkg?.doc && addSideItem();
    if (!ready) { if (tries < 80) setTimeout(() => boot(tries + 1), 250); return; }
    ensureWork();
    const kept = store.get(docKey(), []);
    let n = 0;
    for (const c of Array.isArray(kept) ? kept : []) { try { make(c, { record: false }); pending.push(c); n++; } catch { /* no longer applies */ } }
    persist();
    if (n) { render(); say(n === 1 ? '1 change from before is not saved yet.' : n + ' changes from before are not saved yet.'); }
    bar();
  })();
  window.TraceEditMode = { toggle, undo, redo: again, save, comments: augment, get pending() { return pending.slice(); }, get on() { return on; } };
})();
