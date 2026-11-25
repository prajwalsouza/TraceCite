// Edits: a model streams edits into the open document, word by word, and the reader reviews them.
//
// The page is the endpoint; no server is needed. Anything that can run script in the page (an agent with browser
// control, an extension, a test tool) delivers events to
//   TraceLive.push({ type: 'begin' | 'delta' | 'end' | 'status' | 'focus', ... })
// or streams a whole edit in one call with TraceLive.stream({ op, target, text, by }).
// Reader requests wait in TraceLive.inbox; decisions (accepted, rejected, commented) are in TraceLive.decisions,
// which a model reads first on every run. The page announces all this in <script id="trace-live-manifest">.
// Full protocol: references/edits.md.
//
// Ask:     select words in one or more sentences, press Enter, say what should change.
// Stream:  a replacement writes its new text beside the old (struck through); an insertion writes a new sentence.
// Review:  Edits in the sidebar (under Tag tree) opens the edits view: every pending edit tinted, a review bar to
//          step through them (Accept, Reject, Comment). A comment is a suggestion comment on the sentence and goes
//          back to the model as a request.
// The ruler: faint ticks at the right edge whenever there is something to show. A darker tick where an edit is
//          (blinking in the accent while it is written), ticks in the focused tag's colour where its sentences are.
//          Click or drag it to scroll.
// Only sentences are editable: exact quotes and their passages are never touched.
(() => {
  const DOC = () => window.__traceDocForCitations;
  const find = (bs, id, parent = null) => { for (const b of bs || []) { if (b.id === id) return { b, parent, list: bs }; const r = find(b.children, id, b); if (r) return r; } return null; };
  const sentEl = (id) => document.querySelector(`#outline [data-read-sentence="${CSS.escape(id)}"]`);
  const sectionOf = (id) => { for (const s of DOC()?.blocks || []) if (find(s.children, id)) return String(s.text || '').replace(/\[([^\]]+)\]\{\.[\w-]+\}/g, '$1'); return ''; };
  const plain = (t) => String(t || '').replace(/\[([^\]]+)\]\{\.[\w-]+\}/g, '$1').replace(/\\\(|\\\)/g, '').replace(/\{\\class\{[\w-]+\}\{([^{}]*)\}\}/g, '$1').replace(/\\class\{[\w-]+\}\{([^{}]*)\}/g, '$1').replace(/\\[a-z]+/g, '').replace(/[{}]/g, '');
  const KEY = 'trace-live-inbox';
  const edits = new Map(), waiting = new Set();
  let inbox = []; try { inbox = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch {}
  const saveInbox = () => { try { localStorage.setItem(KEY, JSON.stringify(inbox.slice(-100))); } catch {} };
  // Every decision the reader makes, for the writer to read on its next run (and for the page to replay on reload).
  const DKEY = 'trace-live-decisions:' + (window.OUTLINE_SEED?.id || document.title);
  let decisions = []; try { decisions = JSON.parse(localStorage.getItem(DKEY) || '[]'); } catch {}
  const saveDecisions = () => { try { localStorage.setItem(DKEY, JSON.stringify(decisions.slice(-500))); } catch {} };
  function record(e, decision, extra = {}) {
    const d = { edit: e.id, decision, op: e.op, target: e.target, result: e.result || null, before: e.before ?? null, text: e.text, by: e.by, req: e.req || null, at: new Date().toISOString(), ...extra };
    decisions.push(d); saveDecisions();
    window.dispatchEvent(new CustomEvent('trace-live-decision', { detail: d }));
    if (server) fetch(SERVER + '/accepted', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }).catch(() => {});
    return d;
  }
  let SERVER = '', n = 0, server = false, panelOpen = false, reviewing = null;

  // ---------- styles (theme tokens only) ----------
  const css = document.createElement('style');
  css.textContent = `
.le-old{text-decoration:line-through;text-decoration-thickness:1.5px;text-decoration-color:color-mix(in srgb,var(--ink,#333) 45%,transparent);opacity:.45}
.le-draft{color:var(--link,var(--accent));cursor:pointer;border-radius:4px;transition:background-color .2s ease}
.le-draft.le-writing{cursor:default}
html.le-editing .le-draft{background:color-mix(in srgb,var(--accent-fill) 45%,transparent)}
.le-draft.le-current,html.le-editing .le-draft.le-current{background:var(--accent-fill);color:var(--on-accent,var(--ink))}
html.le-editing .le-side,html.le-editing .le-side svg{color:var(--accent)}
.le-caret{display:inline-block;width:2px;height:1.05em;margin-left:1px;vertical-align:-.15em;background:var(--accent);animation:le-blink 1s steps(1) infinite}
@keyframes le-blink{50%{opacity:0}}
.le-wait{background-image:linear-gradient(90deg,transparent,color-mix(in srgb,var(--accent) 22%,transparent),transparent);background-size:200% 100%;animation:le-sweep 1.4s linear infinite;border-radius:4px}
@keyframes le-sweep{from{background-position:200% 0}to{background-position:-200% 0}}
.le-flash{animation:le-flash 1.6s ease}
@keyframes le-flash{0%{background:color-mix(in srgb,var(--accent) 30%,transparent)}100%{background:transparent}}
.le-count{margin-left:auto;min-width:20px;padding:0 6px;border-radius:10px;background:var(--accent-fill);color:var(--on-accent,var(--ink));font-size:11.5px;line-height:20px;text-align:center}
.le-count:empty{display:none}
.le-panel{position:fixed;top:var(--gap,12px);right:var(--gap,12px);bottom:var(--gap,12px);z-index:580;width:min(360px,calc(100vw - 24px));display:flex;flex-direction:column;border-radius:18px;background:var(--panel,var(--surface));color:var(--ink);box-shadow:0 24px 60px rgba(0,0,0,.14);font:14px/1.45 var(--font-ui,var(--font,system-ui));transform:translateX(110%);transition:transform .28s cubic-bezier(.2,.7,.1,1)}
.le-panel.open{transform:none}
.le-panel header{display:flex;align-items:center;gap:10px;padding:16px 16px 8px}
.le-panel header b{flex:1;font-size:16px;font-weight:600}
.le-panel header button,.le-bar .x{width:30px;height:30px;border:0;border-radius:50%;background:none;color:var(--ink3,var(--faint));cursor:pointer;font-size:18px;line-height:1}
.le-panel header button:hover,.le-bar .x:hover{color:var(--ink)}
.le-panel .le-body{flex:1;overflow:auto;padding:0 8px 16px}
.le-panel h4{margin:16px 8px 4px;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3,var(--faint))}
.le-row{display:block;width:100%;padding:8px;border:0;border-radius:10px;background:none;color:var(--ink2,var(--muted));text-align:left;font:inherit;cursor:pointer}
.le-row:hover,.le-row:focus-visible{color:var(--ink)}
.le-row small{display:block;color:var(--ink3,var(--faint));font-size:11.5px;margin-bottom:2px}
.le-row.done{opacity:.55}
.le-row .dot{display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%;background:var(--accent);vertical-align:.1em;animation:le-blink 1s steps(1) infinite}
.le-start{margin:4px 8px 0;height:36px;padding:0 14px;border:0;border-radius:18px;background:var(--accent-fill);color:var(--on-accent,var(--ink));font:500 14px var(--font-ui,var(--font,system-ui));cursor:pointer}
.le-empty{margin:12px 8px;color:var(--ink3,var(--faint))}
.le-bar{position:fixed;left:50%;bottom:max(24px,env(safe-area-inset-bottom));z-index:590;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:calc(100vw - 32px);padding:10px;border-radius:999px;background:var(--surface,#fff);color:var(--ink2,#555);font:500 13.5px var(--font-ui,var(--font,system-ui));box-shadow:0 14px 40px rgba(0,0,0,.16)}
.le-bar .what{flex:none;width:170px;max-width:30vw;margin:0 10px 0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums}
.le-bar .what b{color:var(--ink);font-weight:600}
.le-bar button{height:36px;padding:0 14px;border:1px solid var(--line);border-radius:17px;background:none;color:var(--ink2,#555);font:inherit;cursor:pointer;white-space:nowrap}
.le-bar button:hover{color:var(--ink)}
.le-bar button.ok{background:var(--accent-fill);border-color:transparent;color:var(--on-accent,var(--ink))}
.le-bar button.nav{width:36px;padding:0;display:inline-grid;place-items:center}
.le-bar button.nav svg{width:13px;height:16px;fill:currentColor}
.le-bar .x{width:36px;height:36px;padding:0;margin-left:2px;display:inline-grid;place-items:center;border:0}
.le-bar .x svg,.le-panel header button svg{width:12px;height:16px;fill:currentColor}
.le-panel header button{display:inline-grid;place-items:center;padding:0}
.le-bar kbd{margin-left:4px;font:11px ui-monospace,monospace;color:var(--ink3,#999)}
.le-bar textarea{width:min(420px,60vw);height:34px;padding:7px 12px;resize:none;border:1px solid var(--line);border-radius:17px;background:none;color:var(--ink);font:inherit;outline:0}
.le-ask{position:fixed;z-index:600;width:min(420px,calc(100vw - 24px));padding:12px;border-radius:14px;background:var(--surface,#fff);color:var(--ink);box-shadow:0 24px 60px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.06)}
.le-ask textarea{width:100%;min-height:64px;resize:none;border:0;outline:0;background:none;color:inherit;font:15px/1.5 var(--font-ui,var(--font,system-ui))}
.le-ask .le-sel{margin:0 0 8px;color:var(--ink3,var(--faint));font-size:12.5px;line-height:1.45;max-height:3em;overflow:hidden}
.le-ask .le-hint{display:flex;justify-content:space-between;color:var(--ink3,var(--faint));font-size:12px}
.le-pill{position:fixed;left:50%;transform:translateX(-50%);bottom:max(24px,env(safe-area-inset-bottom));max-width:calc(100vw - 32px);z-index:585;display:flex;align-items:center;gap:10px;padding:12px 20px;border:0;border-radius:999px;background:var(--surface,#fff);color:var(--ink2,#555);font:500 13px var(--font-ui,var(--font,system-ui));box-shadow:0 10px 30px rgba(0,0,0,.12);cursor:pointer}
.le-pill i{width:8px;height:8px;border-radius:50%;background:var(--ink3,#aaa)}
.le-pill.on i{background:var(--ok,#5a9)}
.le-pill.busy i{background:var(--accent);animation:le-blink 1s steps(1) infinite}
.le-pill[hidden],.le-bar[hidden]{display:none}
.le-rail{position:fixed;top:16vh;bottom:16vh;right:14px;z-index:570;width:26px;opacity:0;transition:opacity .4s ease;pointer-events:none}
.le-rail.on{opacity:1;pointer-events:auto}
.le-rail::before{content:'';position:absolute;top:0;bottom:0;right:4px;width:12px;opacity:.5;background:repeating-linear-gradient(to bottom,color-mix(in srgb,var(--ink,#333) 22%,transparent) 0 1px,transparent 1px 10px),repeating-linear-gradient(to bottom,color-mix(in srgb,var(--ink,#333) 30%,transparent) 0 1px,transparent 1px 50px);background-size:6px 100%,12px 100%;background-repeat:repeat-y;background-position:right top,right top;transition:opacity .4s ease}
.le-rail.live::before{opacity:.9}
.le-view{position:absolute;right:0;width:3px;border-radius:2px;background:color-mix(in srgb,var(--ink,#333) 16%,transparent);transition:top .15s linear,height .15s linear}
.le-mark{position:absolute;right:-4px;width:22px;height:22px;margin-top:-11px;padding:0;border:0;background:none;cursor:pointer}
.le-mark{right:0}
.le-mark i{position:absolute;right:4px;top:10px;width:6px;height:1.5px;border-radius:1px;background:color-mix(in srgb,var(--ink,#333) 78%,transparent);transition:width .2s ease,background-color .3s ease}
.le-mark:hover i,.le-mark:focus-visible i{background:var(--ink,#222)}
.le-mark.req i{background:color-mix(in srgb,var(--ink,#333) 45%,transparent)}
.le-mark.writing i{background:var(--accent);animation:le-blink 1s steps(1) infinite}
.le-rail.tight .le-mark .tip{display:none}
.le-mark .tip{position:absolute;right:28px;top:11px;transform:translateY(-50%);width:max-content;max-width:var(--tip-w,260px);color:var(--ink2,#555);font:12.5px/1.35 var(--font-ui,var(--font,system-ui));text-align:right;opacity:0;pointer-events:none;transition:opacity .15s}
.le-mark .tip small{display:block;color:var(--ink3,#999);font-size:11px}
.le-mark:hover .tip,.le-mark:focus-visible .tip,.le-rail:hover .le-mark .tip,.le-rail.open .le-mark .tip{opacity:1}
.le-rail:hover .le-mark .tip,.le-rail.open .le-mark .tip{color:var(--ink3,#999)}
.le-mark:hover .tip,.le-mark:focus-visible .tip{color:var(--ink,#222)!important}
.le-rail.reviewing .le-mark .tip{opacity:0!important}
.le-rail .le-hint{position:absolute;right:28px;top:0;width:max-content;color:var(--ink3,#999);font:12.5px var(--font-ui,var(--font,system-ui))}
.le-rail.open{opacity:1;pointer-events:auto}
.le-rail.on{cursor:pointer;touch-action:none}
.le-hit{position:absolute;right:4px;width:6px;height:2px;margin-top:10px;border-radius:1px;background:var(--hit,var(--accent));pointer-events:none}
.le-hit.many{width:12px}
.le-where{position:absolute;right:28px;width:max-content;max-width:var(--tip-w,260px);transform:translateY(-50%);color:var(--ink2,#555);font:12.5px/1.35 var(--font-ui,var(--font,system-ui));text-align:right;pointer-events:none}
.le-rail.tight .le-where{display:none}
.le-rail{width:40px}
@media (min-width:761px){.le-panel{display:none}}
.le-bar .acts{display:contents}

@media (prefers-reduced-motion:reduce){.le-mark.writing i{animation:none}}
@media (max-width:760px){.le-rail{right:4px}}
@media (prefers-reduced-motion:reduce){.le-caret,.le-wait,.le-flash,.le-pill.busy i,.le-row .dot{animation:none}.le-panel{transition:none}}`;
  document.head.append(css);

  // ---------- status pill ----------
  const pill = document.createElement('button'); pill.type = 'button'; pill.className = 'le-pill'; pill.innerHTML = '<i></i><span></span>'; document.body.append(pill);
  let busyText = '', hoverText = '';
  const toReview = () => [...edits.values()].filter((e) => e.status === 'waiting');
  const writingNow = () => [...edits.values()].filter((e) => e.status === 'writing');
  function refresh() {
    const w = writingNow(), r = toReview();
    pill.className = 'le-pill ' + (w.length || busyText ? 'busy' : 'on');
    pill.querySelector('span').textContent = hoverText || busyText || (w.length ? `${w[0].by} is writing…` : r.length ? `${r.length} suggestion${r.length === 1 ? '' : 's'} to review` : '');
    pill.hidden = !!reviewing || !(hoverText || busyText || w.length || r.length);
    const c = document.querySelector('.le-side .le-count'); if (c) c.textContent = (w.length + r.length) || '';
    if (panelOpen) drawPanel();
    if (reviewing) drawBar();
    placeRail();
  }
  pill.addEventListener('click', () => { if (toReview().length) startReview(); });

  // ---------- drawing edits into the paper (again after every redraw) ----------
  const fitSvg = (el) => el.querySelectorAll('mjx-container svg').forEach((v) => { v.style.width = v.getAttribute('width'); v.style.height = v.getAttribute('height'); v.style.fill = 'currentColor'; v.style.stroke = 'currentColor'; });
  function typeset(el) { try { window.MathJax?.typesetPromise?.([el]).then(() => fitSvg(el)).catch(() => {}); } catch {} }
  function draftEl(e) {
    const d = document.createElement('span'); d.className = 'le-draft' + (e.status === 'writing' ? ' le-writing' : '') + (reviewing === e.id ? ' le-current' : ''); d.dataset.edit = e.id;
    d.textContent = ' ' + e.text;
    if (e.status === 'writing') { const c = document.createElement('span'); c.className = 'le-caret'; d.append(c); }
    d.addEventListener('click', (ev) => { ev.stopPropagation(); if (e.status === 'waiting') startReview(e.id); });
    return d;
  }
  function decorate() {
    for (const id of waiting) sentEl(id)?.classList.add('le-wait');
    for (const e of edits.values()) {
      if (e.status !== 'writing' && e.status !== 'waiting') continue;
      const s = sentEl(e.target); if (!s) continue;
      s.classList.toggle('le-old', e.op === 'replace');
      let d = document.querySelector(`.le-draft[data-edit="${e.id}"]`);
      if (!d) { d = draftEl(e); s.after(d); window.TraceRichText?.process(d); typeset(d); }
      d.classList.toggle('le-current', reviewing === e.id);
    }
    addSideItem();
  }
  let pending = false;
  new MutationObserver(() => { if (pending) return; pending = true; queueMicrotask(() => { pending = false; decorate(); }); }).observe(document.body, { childList: true, subtree: true });
  const jump = (id, block = 'center') => { const s = document.querySelector(`.le-draft[data-edit="${id}"]`) || sentEl(edits.get(id)?.target || id); if (!s) return; s.scrollIntoView({ block, behavior: 'smooth' }); };

  // ---------- the edit rail: faint ticks at the right edge, a dot where each edit is ----------
  const rail = document.createElement('div'); rail.className = 'le-rail'; rail.setAttribute('aria-label', 'Where the edits and matches are');
  const view = document.createElement('div'); view.className = 'le-view'; rail.append(view); document.body.append(rail);
  const markEl = new Map();
  function placeRail() {
    const live = [...edits.values()].filter((e) => e.status === 'writing' || e.status === 'waiting');
    const reqs = inbox.filter((x) => x.status === 'open' && waiting.has(x.targets[0]));
    const focus = document.getElementById('outline')?.classList.contains('reading-focus-active');
    rail.classList.toggle('on', live.length + reqs.length > 0 || !!focus);
    drawHits(focus, rail.clientHeight, Math.max(1, document.documentElement.scrollHeight)); rail.classList.toggle('live', live.some((e) => e.status === 'writing')); rail.classList.toggle('reviewing', !!reviewing);
    
    const H = Math.max(1, document.documentElement.scrollHeight), h = rail.clientHeight;
    view.style.top = (scrollY / H) * h + 'px'; view.style.height = Math.max(6, (innerHeight / H) * h) + 'px';
    const keep = new Set();
    const put = (key, el, cls, tip, go) => {
      if (!el) return; keep.add(key);
      let m = markEl.get(key);
      if (!m) { m = document.createElement('button'); m.type = 'button'; m.className = 'le-mark'; m.innerHTML = '<i></i><span class="tip"></span>'; m.addEventListener('click', () => m.go()); rail.append(m); markEl.set(key, m); }
      if (!m.hoverSet) { m.hoverSet = true; m.addEventListener('pointerenter', () => { if (rail.classList.contains('tight')) { hoverText = m.getAttribute('aria-label'); refresh(); } }); m.addEventListener('pointerleave', () => { if (hoverText) { hoverText = ''; refresh(); } }); }
      m.className = 'le-mark ' + cls; m.go = go; const [t1, t2] = tip.split(' :: '); const tp = m.querySelector('.tip'); tp.innerHTML = ''; const sm = document.createElement('small'); sm.textContent = t1; tp.append(sm, t2 || ''); m.setAttribute('aria-label', t1 + ': ' + (t2 || ''));
      const y = el.getBoundingClientRect().top + scrollY; m.style.top = Math.min(h, Math.max(0, Math.round(((y / H) * h) / 10) * 10)) + 'px';
    };
    for (const e of live) put(e.id, document.querySelector(`.le-draft[data-edit="${e.id}"]`) || sentEl(e.target), e.status, (e.status === 'writing' ? 'Being written · ' : 'Suggestion · ') + (e.op === 'replace' ? 'rewrite' : 'new sentence') + ' · ' + (sectionOf(e.target) || e.target) + ' :: ' + (plain(e.text).slice(0, 70) || '…'), () => (e.status === 'waiting' ? startReview(e.id) : jump(e.id)));
    for (const x of reqs) put(x.req, sentEl(x.targets[0]), 'req', 'Your request · ' + (sectionOf(x.targets[0]) || x.targets[0]) + ' :: ' + x.instruction.slice(0, 70), () => sentEl(x.targets[0])?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    for (const [k, m] of markEl) if (!keep.has(k)) { m.remove(); markEl.delete(k); }
    // Labels sit beside the ruler only where there is room between it and the text; they never overlap each other.
    const out = document.getElementById('outline')?.getBoundingClientRect(), room = out ? rail.getBoundingClientRect().left - out.right - 36 : 0;
    rail.classList.toggle('tight', room < 150); rail.style.setProperty('--tip-w', Math.max(0, Math.min(280, room)) + 'px');
    let last = -1e9; [...markEl.values()].sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top)).forEach((m) => { const y = parseFloat(m.style.top), ly = Math.max(y, last + 40); last = ly; m.querySelector('.tip').style.transform = `translateY(calc(-50% + ${ly - y}px))`; });
  }
  // Tag focus: like a browser's find-in-page marks, the ticks where matching sentences sit take the accent.
  const hitLayer = document.createElement('div'); rail.prepend(hitLayer);
  let hitKey = '';
  // The tag in focus: the one being previewed (hover), else the pinned one. Its ticks take that tag's own colour.
  function focusColour() {
    const b = document.querySelector('[data-reading-tag].previewing, [data-reading-tag][aria-pressed="true"]'); if (!b) return '';
    const cs = getComputedStyle(b), slot = (window.__traceSpanIndex || {})[b.dataset.readingTag]?.slot;
    return slot ? `var(--slot-${slot})` : (cs.getPropertyValue('--tag-ink').trim() || cs.color);
  }
  function drawHits(focus, h, H) {
    rail.style.setProperty('--hit', (focus && focusColour()) || 'var(--accent)');
    const ys = focus ? [...document.querySelectorAll('#outline .reading-focus-match')].map((el) => Math.min(h, Math.max(0, Math.round(((el.getBoundingClientRect().top + scrollY) / H) * h / 10) * 10))) : [];
    const count = new Map(); ys.forEach((y) => count.set(y, (count.get(y) || 0) + 1));
    const key = [...count].join(';'); if (key === hitKey) return; hitKey = key;
    hitLayer.innerHTML = ''; for (const [y, c] of count) { const d = document.createElement('div'); d.className = 'le-hit' + (c > 1 ? ' many' : ''); d.style.top = y + 'px'; hitLayer.append(d); }
  }
  // The ruler is a scroll track: click or drag anywhere on it to go there; hovering names the section at that point.
  const where = document.createElement('div'); where.className = 'le-where'; rail.append(where);
  const fracAt = (ev) => { const r = rail.getBoundingClientRect(); return Math.min(1, Math.max(0, (ev.clientY - r.top) / r.height)); };
  const sectionAt = (f) => { const y = f * document.documentElement.scrollHeight; let name = ''; for (const hd of document.querySelectorAll('#outline h2.reading-section, #outline h3, #outline h4')) { if (hd.getBoundingClientRect().top + scrollY <= y + 40) name = hd.textContent.trim(); else break; } return name; };
  const goTo = (f, smooth) => scrollTo({ top: f * document.documentElement.scrollHeight - innerHeight / 2, behavior: smooth ? 'smooth' : 'auto' });
  let dragging = false;
  // Trace clears a pinned tag on any pointer-down outside its tag tree (a capture listener on document), so the
  // ruler and the review bar take their pointer-down at the window, before that, and keep it.
  addEventListener('pointerdown', (ev) => {
    const t = ev.target.closest?.('.le-rail, .le-bar, .le-pill'); if (!t) return;
    ev.stopPropagation();
    // If the page still clears the pinned tag, put it back straight away.
    const pinned = document.querySelector('[data-reading-tag][aria-pressed="true"]')?.dataset.readingTag;
    if (pinned) for (const wait of [0, 60, 200]) setTimeout(() => { if (!document.querySelector(`[data-reading-tag="${CSS.escape(pinned)}"][aria-pressed="true"]`)) document.querySelector(`[data-reading-tag="${CSS.escape(pinned)}"]`)?.click(); }, wait);
    if (t === rail && !ev.target.closest('.le-mark')) { ev.preventDefault(); dragging = true; try { rail.setPointerCapture(ev.pointerId); } catch {} goTo(fracAt(ev), true); }
  }, true);
  rail.addEventListener('pointermove', (ev) => {
    const f = fracAt(ev), name = ev.target.closest('.le-mark') ? '' : sectionAt(f);
    where.textContent = name; where.style.top = (f * rail.clientHeight) + 'px';
    if (rail.classList.contains('tight')) { const t = name ? 'Go to · ' + name : ''; if (t !== hoverText) { hoverText = t; refresh(); } }
    if (dragging) goTo(f, false);
  });
  // Using the ruler must not clear the reader's tag focus (Trace clears it on clicks elsewhere).
  const endDrag = () => { dragging = false; };
  rail.addEventListener('pointerup', endDrag); rail.addEventListener('pointercancel', endDrag);
  rail.addEventListener('pointerleave', () => { where.textContent = ''; if (hoverText) { hoverText = ''; refresh(); } });
  addEventListener('scroll', () => { if (rail.classList.contains('on')) placeRail(); }, { passive: true });
  addEventListener('resize', placeRail);
  setInterval(() => { if (rail.classList.contains('on') || edits.size || document.getElementById('outline')?.classList.contains('reading-focus-active')) placeRail(); }, 400);

  // ---------- the endpoint ----------
  function push(m) {
    if (m.type === 'status') { busyText = m.text || ''; return refresh(); }
    if (m.type === 'focus') { const s = sentEl(m.target); if (s && !reviewing) { const r = s.getBoundingClientRect(); if (r.top < 80 || r.bottom > innerHeight - 80) s.scrollIntoView({ block: 'center', behavior: 'smooth' }); } return; }
    if (m.type === 'begin') {
      const hit = find(DOC()?.blocks, m.target);
      if (!hit || hit.b.type !== 'sentence') { busyText = 'Refused: only sentences can be edited'; refresh(); setTimeout(() => { busyText = ''; refresh(); }, 2500); return; }
      edits.set(m.edit, { id: m.edit, op: m.op, target: m.target, by: m.by || 'An agent', text: '', status: 'writing', req: m.req });
      if (m.req) { const r = inbox.find((x) => x.req === m.req); if (r) { r.status = 'answered'; saveInbox(); } }
      decorate(); return refresh();
    }
    const e = edits.get(m.edit); if (!e) return;
    if (m.type === 'delta') {
      e.text += m.text;
      const d = document.querySelector(`.le-draft[data-edit="${e.id}"]`);
      if (d) { const span = document.createElement('span'); span.textContent = m.text; d.insertBefore(span, d.querySelector('.le-caret')); if (/\\\(|\]\{\./.test(m.text)) { window.TraceRichText?.process(span); typeset(span); } }
      return;
    }
    if (m.type === 'end') {
      e.status = 'waiting'; e.text = e.text.trim(); waiting.delete(e.target); sentEl(e.target)?.classList.remove('le-wait');
      document.querySelector(`.le-draft[data-edit="${e.id}"]`)?.remove(); decorate(); refresh();
    }
  }
  // Stream a whole edit from inside the page: what an agent with browser control calls.
  const TOKEN = /\\\(.+?\\\)\S*\s*|\[[^\]]+\]\{\.[\w-]+\}\S*\s*|\S+\s*/g;
  function stream({ op = 'replace', target, text, by = 'An agent', req, speed = 1 }) {
    return new Promise((done) => {
      const id = 'e' + Date.now().toString(36) + (++n), toks = String(text).match(TOKEN) || [];
      push({ type: 'focus', target });
      setTimeout(() => {
        push({ type: 'begin', edit: id, op, target, by, req });
        let i = 0; const step = () => { if (i >= toks.length) { push({ type: 'end', edit: id }); return done(id); } const t = toks[i++]; push({ type: 'delta', edit: id, text: t }); setTimeout(step, (45 + Math.random() * 60 + (/[.,:;]\s*$/.test(t) ? 250 : 0)) / speed); };
        setTimeout(step, 400 / speed);
      }, 700 / speed);
    });
  }

  // ---------- deciding ----------
  function accept(id) {
    const e = edits.get(id); if (!e) return;
    const hit = find(DOC()?.blocks, e.target); if (!hit) return reject(id);
    const before = hit.b.text, now = new Date().toISOString();
    let newId = e.target;
    if (e.op === 'replace') {
      hit.b.text = e.text;
      hit.b.fields = (hit.b.fields || []).filter((f) => !/^Edited (by|via|on)$/.test(f.key)).concat([{ key: 'Edited by', value: e.by }, { key: 'Edited via', value: 'agent' }, { key: 'Edited on', value: now }]);
    } else {
      newId = 'live-' + Date.now().toString(36) + (++n);
      hit.list.splice(hit.list.indexOf(hit.b) + 1, 0, { id: newId, type: 'sentence', text: e.text, tags: [], collapsed: false, fields: [{ key: 'Added by', value: e.by }, { key: 'Added via', value: 'agent' }, { key: 'Added on', value: now }], children: [] });
    }
    e.status = 'accepted'; e.before = e.op === 'replace' ? before : null; e.result = newId;
    document.querySelector(`.le-draft[data-edit="${id}"]`)?.remove(); sentEl(e.target)?.classList.remove('le-old');
    window.__traceRender?.();
    setTimeout(() => { const s = sentEl(newId); s?.classList.add('le-flash'); setTimeout(() => s?.classList.remove('le-flash'), 1700); }, 60);
    record(e, 'accepted');
    refresh();
  }
  function reject(id) {
    const e = edits.get(id); if (!e) return;
    e.status = 'rejected'; record(e, 'rejected', { before: find(DOC()?.blocks, e.target)?.b.text ?? null }); document.querySelector(`.le-draft[data-edit="${id}"]`)?.remove(); sentEl(e.target)?.classList.remove('le-old'); refresh();
  }
  // A suggestion comment: the reader's reply to an edit. It is a comment on the sentence (a note with "Comment by"
  // and "Comment kind: suggestion"), and it goes back to the writer as a request.
  function comment(id, text) {
    const e = edits.get(id); if (!e || !text.trim()) return;
    const hit = find(DOC()?.blocks, e.target);
    if (hit) { hit.b.children = hit.b.children || []; hit.b.children.push({ id: 'cmt-' + Date.now().toString(36), type: 'note', text: text.trim(), tags: [], collapsed: false, fields: [{ key: 'Comment by', value: 'You' }, { key: 'Comment kind', value: 'suggestion' }, { key: 'On suggestion', value: plain(e.text) }, { key: 'Added on', value: new Date().toISOString() }], children: [] }); }
    request({ ids: [e.target], text: plain(e.text), instruction: text.trim(), onEdit: e.id });
    e.commented = (e.commented || 0) + 1; record(e, 'commented', { comment: text.trim() });
    window.__traceRender?.(); refresh();
  }

  // ---------- Edits in the sidebar (and, on phones, its list) ----------
  const PEN = '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M362.7 19.3L314.3 67.7 444.3 197.7l48.4-48.4c25-25 25-65.5 0-90.5L453.3 19.3c-25-25-65.5-25-90.5 0zm-71 71L58.6 323.5c-10.4 10.4-18 23.3-22.2 37.4L1 481.2C-1.5 489.7 .8 498.8 7 505s15.3 8.5 23.7 6.1l120.3-35.4c14.1-4.2 27-11.8 37.4-22.2L421.7 220.3 291.7 90.3z"/></svg>';
  function addSideItem() {
    if (document.querySelector('.le-side')) return;
    const tags = document.querySelector('.side-menu [data-side-view="tags"]'); if (!tags) return;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'nav-button side-item le-side'; b.title = 'Edits';
    b.innerHTML = PEN + '<span>Edits</span><span class="le-count"></span>';
    b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); if (reviewing) return stopReview(); if (toReview().length) return startReview(); busyText = writingNow().length ? '' : 'No edits to review'; refresh(); setTimeout(() => { if (busyText === 'No edits to review') { busyText = ''; refresh(); } }, 2200); });
    tags.after(b); refresh();
  }
  const panel = document.createElement('aside'); panel.className = 'le-panel'; panel.setAttribute('aria-label', 'Edits');
  panel.innerHTML = '<header><b>Edits</b><button type="button" aria-label="Close"><svg viewBox="0 0 384 512" aria-hidden="true"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg></button></header><div class="le-body"></div>';
  panel.querySelector('header button').addEventListener('click', () => togglePanel(false));
  document.body.append(panel);
  function togglePanel(open = !panelOpen) { panelOpen = open; panel.classList.toggle('open', open); if (open) drawPanel(); }
  function row(title, sub, cls, go) { const b = document.createElement('button'); b.type = 'button'; b.className = 'le-row ' + (cls || ''); const s = document.createElement('small'); s.textContent = sub; b.append(s, title); b.addEventListener('click', go); return b; }
  function drawPanel() {
    const body = panel.querySelector('.le-body'); body.innerHTML = '';
    const w = writingNow(), r = toReview(), q = inbox.filter((x) => x.status === 'open'), d = [...edits.values()].filter((e) => e.status === 'accepted' || e.status === 'rejected');
    if (r.length) { const s = document.createElement('button'); s.type = 'button'; s.className = 'le-start'; s.textContent = `Review one by one (${r.length})`; s.addEventListener('click', () => { togglePanel(false); startReview(); }); body.append(s); }
    const label = (e) => (e.op === 'replace' ? 'Rewrite' : 'New sentence') + ' · ' + (sectionOf(e.target) || e.target);
    const group = (h, list, make) => { if (!list.length) return; const t = document.createElement('h4'); t.textContent = h; body.append(t); list.forEach((x) => body.append(make(x))); };
    group('Being written now', w, (e) => { const b = row(plain(e.text).slice(0, 90) || '…', label(e), ''); const dot = document.createElement('span'); dot.className = 'dot'; b.prepend(dot); b.addEventListener('click', () => jump(e.id)); return b; });
    group('To review', r, (e) => row(plain(e.text).slice(0, 110), label(e) + (e.commented ? ' · commented' : ''), '', () => { togglePanel(false); startReview(e.id); }));
    group('Your requests', q, (x) => row(x.instruction.slice(0, 110), 'Waiting · ' + (sectionOf(x.targets[0]) || x.targets[0]), '', () => { sentEl(x.targets[0])?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }));
    group('Decided', d, (e) => row(plain(e.text).slice(0, 90), (e.status === 'accepted' ? 'Accepted' : 'Rejected') + ' · ' + label(e), 'done', () => { if (e.status === 'accepted') sentEl(e.result)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }));
    if (!body.children.length) { const p = document.createElement('p'); p.className = 'le-empty'; p.textContent = 'Nothing yet. Select words in any sentence and press Enter to ask for an edit.'; body.append(p); }
  }

  // ---------- one by one: the review bar ----------
  const bar = document.createElement('div'); bar.className = 'le-bar'; bar.hidden = true; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Review suggestions'); document.body.append(bar);
  let commenting = false;
  function startReview(id) { const r = toReview(); if (!r.length) return; document.documentElement.classList.add('le-editing'); reviewing = id && edits.get(id)?.status === 'waiting' ? id : r[0].id; commenting = false; bar.hidden = false; decorate(); refresh(); jump(reviewing); }
  function stopReview() { document.documentElement.classList.remove('le-editing'); reviewing = null; bar.hidden = true; decorate(); refresh(); }
  function step(dir) { const r = toReview(); if (!r.length) return stopReview(); const i = Math.max(0, r.findIndex((e) => e.id === reviewing)); reviewing = r[(i + dir + r.length) % r.length].id; commenting = false; decorate(); refresh(); jump(reviewing); }
  function decide(fn) { const r = toReview(), i = r.findIndex((e) => e.id === reviewing); fn(reviewing); const left = toReview(); if (!left.length) { bar.innerHTML = '<span class="what"><b>All reviewed</b></span>'; setTimeout(stopReview, 1400); reviewing = null; return; } reviewing = left[Math.min(i, left.length - 1)].id; commenting = false; decorate(); refresh(); setTimeout(() => jump(reviewing), 120); }
  const XMARK = '<svg viewBox="0 0 384 512" aria-hidden="true"><path d="M342.6 150.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192 210.7 86.6 105.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L146.7 256 41.4 361.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192 301.3 297.4 406.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.3 256 342.6 150.6z"/></svg>';
  const CHEV_L = '<svg viewBox="0 0 320 512" aria-hidden="true"><path d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z"/></svg>';
  const CHEV_R = '<svg viewBox="0 0 320 512" aria-hidden="true"><path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z"/></svg>';
  function btn(label, cls, fn, key) { const b = document.createElement('button'); b.type = 'button'; if (cls) b.className = cls; b.innerHTML = label + (key ? `<kbd>${key}</kbd>` : ''); b.addEventListener('click', fn); return b; }
  function drawBar() {
    const r = toReview(), e = edits.get(reviewing); if (!e || e.status !== 'waiting') return;
    const i = r.findIndex((x) => x.id === reviewing);
    bar.innerHTML = '';
    const what = document.createElement('span'); what.className = 'what'; what.innerHTML = `<b>${i + 1} of ${r.length}</b> · ${e.op === 'replace' ? 'rewrite' : 'new sentence'}`; what.title = 'Suggested by ' + e.by;
    if (commenting) {
      const ta = document.createElement('textarea'); ta.placeholder = 'Your suggestion for this edit…';
      ta.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Escape') { commenting = false; drawBar(); } if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); const t = ta.value; commenting = false; comment(e.id, t); } });
      bar.append(what, ta, btn('Cancel', '', () => { commenting = false; drawBar(); }));
      setTimeout(() => ta.focus(), 0); return;
    }
    const acts = document.createElement('span'); acts.className = 'acts';
    const nl = btn(CHEV_L, 'nav', () => step(-1)), nr = btn(CHEV_R, 'nav', () => step(1)); nl.setAttribute('aria-label', 'Previous suggestion'); nr.setAttribute('aria-label', 'Next suggestion');
    const x = document.createElement('button'); x.type = 'button'; x.className = 'x'; x.setAttribute('aria-label', 'Stop reviewing (Esc)'); x.innerHTML = XMARK; x.addEventListener('click', stopReview);
    acts.append(btn('Accept', 'ok', () => decide(accept), 'A'), btn('Reject', '', () => decide(reject), 'R'), btn('Comment', '', () => { commenting = true; drawBar(); }, 'C'), x);
    bar.append(nl, nr, what, acts); placeRail();
  }
  addEventListener('keydown', (ev) => {
    if (!reviewing || commenting || ev.metaKey || ev.ctrlKey || ev.altKey || ev.target.closest?.('input,textarea,[contenteditable="true"]')) return;
    const k = ev.key.toLowerCase(), act = { a: () => decide(accept), r: () => decide(reject), c: () => { commenting = true; drawBar(); }, n: () => step(1), p: () => step(-1), arrowright: () => step(1), arrowleft: () => step(-1), escape: stopReview }[k];
    if (act) { ev.preventDefault(); ev.stopPropagation(); act(); }
  }, true);

  // ---------- asking: select, Enter, say what should change ----------
  let ask = null;
  function selectedSentences() {
    const sel = getSelection(); if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0), root = document.getElementById('outline'); if (!root || !root.contains(r.commonAncestorContainer)) return null;
    const all = [...root.querySelectorAll('[data-read-sentence]')].filter((s) => r.intersectsNode(s));
    return all.length ? { ids: all.map((s) => s.dataset.readSentence), text: sel.toString().trim(), rect: r.getBoundingClientRect() } : null;
  }
  function openAsk(s) {
    closeAsk();
    ask = document.createElement('div'); ask.className = 'le-ask'; ask.setAttribute('role', 'dialog'); ask.setAttribute('aria-label', 'Ask for an edit');
    const p = document.createElement('p'); p.className = 'le-sel'; p.textContent = '“' + s.text.slice(0, 160) + (s.text.length > 160 ? '…' : '') + '”  ·  ' + s.ids.length + ' sentence' + (s.ids.length === 1 ? '' : 's');
    const ta = document.createElement('textarea'); ta.placeholder = 'What should change? For example: say this more simply, or add an example after it.';
    const h = document.createElement('div'); h.className = 'le-hint'; h.innerHTML = '<span>Enter to send · Shift+Enter for a new line</span><span>Esc to cancel</span>';
    ask.append(p, ta, h); document.body.append(ask);
    ask.style.top = Math.max(12, Math.min(innerHeight - ask.offsetHeight - 12, s.rect.bottom + 10)) + 'px'; ask.style.left = Math.max(12, Math.min(innerWidth - ask.offsetWidth - 12, s.rect.left)) + 'px';
    ta.focus();
    ta.addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Escape') { ev.preventDefault(); closeAsk(); } if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); const t = ta.value.trim(); if (!t) return; request({ ...s, instruction: t }); getSelection()?.removeAllRanges(); closeAsk(); } });
  }
  function closeAsk() { ask?.remove(); ask = null; }
  function request({ ids, text, instruction, onEdit }) {
    const r = { req: 'r' + Date.now().toString(36) + (++n), targets: ids, selection: text, instruction, onEdit: onEdit || null, blocks: ids.map((id) => ({ id, text: find(DOC()?.blocks, id)?.b.text || '' })), at: new Date().toISOString(), status: 'open' };
    inbox.push(r); saveInbox(); ids.forEach((id) => waiting.add(id)); decorate();
    busyText = 'Request waiting for the writer'; refresh(); setTimeout(() => { if (busyText === 'Request waiting for the writer') { busyText = ''; refresh(); } }, 3000);
    window.dispatchEvent(new CustomEvent('trace-live-request', { detail: r }));
    if (server) fetch(SERVER + '/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) }).catch(() => {});
    return r;
  }
  addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || ev.shiftKey || ev.metaKey || ev.ctrlKey || ask || reviewing) return;
    if (ev.target.closest?.('input,textarea,[contenteditable="true"]')) return;
    const s = selectedSentences(); if (!s) return;
    ev.preventDefault(); ev.stopPropagation(); openAsk(s);
  }, true);
  addEventListener('mousedown', (ev) => { if (ask && !ask.contains(ev.target)) closeAsk(); });

  // ---------- optional transport: a local server's event stream ----------
  (function connect() {
    // Opt-in only: ?edits-server=<url> (or window.TRACE_EDITS_SERVER) names a relay that serves /events and /inbox.
    const base = new URLSearchParams(location.search).get('edits-server') || window.TRACE_EDITS_SERVER || '';
    if (!base || !/^https?:/.test(location.protocol)) return;
    let opened = false; const es = new EventSource(base.replace(/\/$/, '') + '/events'); SERVER = base.replace(/\/$/, '');
    es.onopen = () => { opened = true; server = true; refresh(); };
    es.onmessage = (ev) => { try { const m = JSON.parse(ev.data); if (m.type !== 'hello' && m.type !== 'received') push(m); } catch (err) { console.warn('[live]', err); } };
    es.onerror = () => { if (!opened) { es.close(); server = false; } else if (es.readyState === 2) server = false; refresh(); };
  })();

  // The manifest: how a model finds this endpoint (see LIVE-EDITS.md).
  if (!document.getElementById('trace-live-manifest')) {
    const mf = document.createElement('script'); mf.type = 'application/json'; mf.id = 'trace-live-manifest';
    mf.textContent = JSON.stringify({ protocol: 'tracecite-live/0.1', endpoint: 'window.TraceLive', inbox: 'TraceLive.inbox (status "open"); event "trace-live-request" on window',
      stream: 'TraceLive.stream({op, target, text, by, req}) or TraceLive.push({type: begin|delta|end|status|focus, ...})', ops: ['replace', 'insert-after'],
      targets: 'sentence block ids only; never citations, references, exact quotes or passages', by: 'name yourself as an agent, e.g. "<model name> (agent)"',
      review: 'every edit is a suggestion until the reader accepts it', onEveryRun: 'read TraceLive.decisions (or decisionsSince(lastRun)) before writing: accepted text is now the document, rejected edits must not be proposed again, comments ask for a revision', decisions: 'TraceLive.decisions; event "trace-live-decision" on window', transports: ['in-page (browser control)', 'optional server-sent events at /events'] });
    document.head.append(mf);
  }
  // Replay this browser's accepted edits after a reload, where the document still matches what they were made on.
  (function replay(tries = 0) {
    const doc = DOC(); if (!doc?.blocks) { if (tries < 40) setTimeout(() => replay(tries + 1), 250); return; }
    let changed = 0;
    for (const d of decisions.filter((x) => x.decision === 'accepted')) {
      const hit = find(doc.blocks, d.target); if (!hit) continue;
      if (d.op === 'replace' && hit.b.text === d.before) { hit.b.text = d.text; changed++; }
      if (d.op === 'insert-after' && d.result && !find(doc.blocks, d.result)) { hit.list.splice(hit.list.indexOf(hit.b) + 1, 0, { id: d.result, type: 'sentence', text: d.text, tags: [], collapsed: false, fields: [{ key: 'Added by', value: d.by }, { key: 'Added via', value: 'agent' }, { key: 'Added on', value: d.at }], children: [] }); changed++; }
    }
    if (changed) window.__traceRender?.();
  })();
  window.TraceLive = { push, stream, accept, reject, comment, request, get inbox() { return inbox; }, get decisions() { return decisions; }, decisionsSince: (t) => decisions.filter((d) => d.at > t), edits, review: startReview, panel: togglePanel };
  refresh();
})();
