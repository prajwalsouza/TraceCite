// Citation styles on the reading page (Settings → Reading → Citation style). Sources from a BibTrace
// bibliography carry "Bib data"; for those, the chosen style (scripts/cite-styles.js) rewrites the inline
// citations and the reference list. Numbered styles number sources by first citation and order the list
// that way. Sources without "Bib data" keep their APA text. The document itself is never changed.
(() => {
  const CS = window.TraceCiteStyles, C = window.OutlineCore, P = window.ReadingPeek;
  if (!CS || !C || !P) return;
  let style = 'apa';
  try { style = JSON.parse(localStorage.getItem('trace-reading-prefs') || '{}').cite || 'apa'; } catch {}
  if (!CS.STYLES[style]) style = 'apa';
  let numeric = CS.STYLES[style].numeric;
  const get = (b, k) => (b.fields || []).find((f) => f.key === k)?.value || '';
  let styled = new WeakMap(); // doc → { number: Map(id → n) }
  // The document's own APA fields, taken from the data embedded in the page (never from Trace's saved copy,
  // which may hold another style's labels), so the style can change without a reload.
  const KEEP = ['APA citation', 'Year', 'APA reference'];
  let ORIGINAL = null; // source id → { key: value }
  const remember0 = () => { if (!ORIGINAL) ORIGINAL = new Map((window.OUTLINE_SEED?.sources || []).map((s) => [s.id, Object.fromEntries(KEEP.map((k) => [k, get(s, k)]))])); };
  const restore = (doc) => { remember0(); for (const s of doc?.sources || []) { const o = ORIGINAL.get(s.id); if (o) for (const k of KEEP) { const f = (s.fields || []).find((x) => x.key === k); if (f) f.value = o[k]; } } };

  function prepare(doc) {
    if (styled.has(doc)) return styled.get(doc);
    restore(doc);
    const info = { number: new Map() };
    styled.set(doc, info);
    // Number by first citation in reading order.
    (function walk(list) { for (const b of list || []) { if (b.type === 'sentence') for (const s of C.citationSources(doc, b)) if (!info.number.has(s.id)) info.number.set(s.id, info.number.size + 1); walk(b.children); } })(doc.blocks);
    const recs = (doc.sources || []).map((s) => { try { return { id: s.id, src: s, bib: JSON.parse(get(s, 'Bib data') || 'null') }; } catch { return { id: s.id, src: s, bib: null }; } }).filter((r) => r.bib);
    const suf = CS.suffixes(recs, style);
    info.parts = new Map();
    for (const { id, bib } of recs) {
      const sx = suf.get(id) || '', n = info.number.get(id);
      const parts = CS.referenceParts(bib, style, sx);
      info.parts.set(id, numeric && n ? [['label', CS.numberedLabel(n, style)], ['', ' '], ...parts] : parts);
    }
    if (style === 'apa') return info;
    for (const { id, src, bib } of recs) {
      const sx = suf.get(id) || '', n = info.number.get(id);
      const set = (k, v) => { const f = src.fields.find((x) => x.key === k); if (f) f.value = v; else src.fields.push({ key: k, value: v }); };
      if (numeric) {
        set('APA citation', n ? `[${n}]` : CS.authorLabel(bib, 'apa'));
        set('APA reference', (n ? `${CS.numberedLabel(n, style)} ` : '') + CS.reference(bib, style, sx));
      } else {
        set('APA citation', CS.inline(bib, style, sx));
        set('Year', CS.yearOf(bib) + sx);
        set('APA reference', CS.reference(bib, style, sx));
      }
    }
    return info;
  }

  // Inline citations.
  const apaSentence = C.apaSentence;
  C.apaSentence = function (doc, sentence) {
    const info = prepare(doc);
    if (!numeric) {
      if (style !== 'chicago') return apaSentence.call(this, doc, sentence);
      const text = apaSentence.call(this, doc, sentence);
      return text; // labels already restyled; Chicago joins with semicolons like APA
    }
    let text = C.readingText(doc, sentence.text);
    const nums = C.citationSources(doc, sentence).map((s) => info.number.get(s.id)).filter(Boolean);
    if (nums.length) text = text.replace(/[.]$/, '') + (style === 'nature' ? '' : ' ') + CS.numericGroup(nums, style) + '.';
    return text;
  };
  {
    const parts = P.citationParts;
    P.citationParts = function (doc, sentence, core) {
      if (!numeric) return parts.call(this, doc, sentence, core);
      const text = core.apaSentence(doc, sentence);
      const m = text.match(/(\s?(?:\[[\d,\s–]+\](?:,\s\[\d+\])*|\([\d,\s–]+\)|[⁰¹²³⁴⁵⁶⁷⁸⁹˒⁻]+))\.$/);
      if (!m) return parts.call(this, doc, sentence, core);
      const at = text.length - m[0].length;
      return [{ text: text.slice(0, at) + (m[1].startsWith(' ') ? ' ' : ''), citation: false }, { text: m[1].trim(), citation: true }, { text: '.', citation: false }];
    };
    // Reference list in citation order, re-applied whenever Trace redraws it.
    const order = () => {
      if (!numeric) return;
      const list = document.querySelector('#outline .apa-references');
      if (!list) return;
      const items = [...list.querySelectorAll(':scope > .apa-reference')];
      const doc = window.__traceDocForCitations;
      const num = (el) => (doc && styled.get(doc)?.number.get(el.dataset.readSource)) || 1e9;
      const sorted = [...items].sort((a, b) => num(a) - num(b));
      if (sorted.some((el, i) => el !== items[i])) sorted.forEach((el) => list.append(el));
    };
    const remember = C.citationSources;
    C.citationSources = function (doc, sentence) { window.__traceDocForCitations = doc; return remember.call(this, doc, sentence); };
    new MutationObserver(() => order()).observe(document.documentElement, { childList: true, subtree: true });
  }
  // References drawn from their parsed BibTeX parts: authors, year, title, venue, volume, pages, links.
  function partsFragment(parts) {
    const frag = document.createDocumentFragment();
    let it = false, bold = false;
    const emit = (role, text) => {
      if (!text) return;
      let node;
      if (role === 'link' || role === 'arxiv') {
        const href = role === 'arxiv' ? 'https://arxiv.org/abs/' + text.replace(/^arXiv:/, '') : /^https?:/.test(text) ? text : 'https://doi.org/' + text;
        node = document.createElement('a'); node.href = href; node.target = '_blank'; node.rel = 'noopener noreferrer'; node.textContent = text;
      } else { node = document.createElement('span'); node.textContent = text; }
      node.className = ['ref-part', role && 'ref-' + role, it && 'ref-i', bold && 'ref-b'].filter(Boolean).join(' ');
      frag.append(node);
    };
    for (const [role, text] of parts) {
      if (role) { emit(role, text.replace(/\*/g, '')); continue; }
      // Literal glue may toggle italics (*) or bold (**) around the next parts.
      let buf = '';
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '*') { emit('', buf); buf = ''; if (text[i + 1] === '*') { bold = !bold; i++; } else it = !it; continue; }
        buf += text[i];
      }
      emit('', buf);
    }
    return frag;
  }
  const docFor = () => window.__traceDocForCitations;
  function restyle() {
    const doc = docFor(); if (!doc) return;
    const info = styled.get(doc); if (!info?.parts) return;
    document.querySelectorAll('.apa-reference[data-read-source]:not([data-ref-parts]), .ev-ref[data-source]:not([data-ref-parts])').forEach((el) => {
      const parts = info.parts.get(el.dataset.readSource || el.dataset.source); if (!parts) return;
      const keep = el.querySelector(':scope > button, :scope > a.ev-open');
      [...el.childNodes].forEach((n) => { if (n !== keep) n.remove(); });
      el.insertBefore(partsFragment(parts), keep || null);
      if (keep) el.insertBefore(document.createTextNode(' '), keep);
      el.dataset.refParts = '1';
    });
  }
  new MutationObserver(() => restyle()).observe(document.documentElement, { childList: true, subtree: true });
  document.documentElement.dataset.citeStyle = style;
  // Live switch (Settings → Reading → Citation style, or the / command): restore the document's own APA
  // fields, forget the numbering, and let Trace redraw. No reload, so nothing flickers.
  window.TraceCitations = {
    setStyle(next) {
      if (!CS.STYLES[next] || next === style) return false;
      restore(docFor());
      style = next; numeric = CS.STYLES[style].numeric; styled = new WeakMap();
      document.documentElement.dataset.citeStyle = style;
      window.__traceRender?.();
      return true;
    },
  };
})();
