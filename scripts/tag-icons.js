// Tag icons. Every tag shows a small line icon: common and special tags get their own
// (drawn here, 24px grid, 1.8 stroke, round joins); everything else gets a quiet tag mark.
// Icons are matched on the tag id or name, so new documents using these words get them too.
(function () {
  'use strict';
  const I = {
    tag: '<path d="M3.5 12.2V5.5a2 2 0 0 1 2-2h6.7l8.3 8.3a2 2 0 0 1 0 2.8l-5.7 5.7a2 2 0 0 1-2.8 0z"/><circle cx="8" cy="8" r="1.3"/>',
    figure: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M10 9.5v10"/>',
    caption: '<rect x="4" y="4" width="16" height="10" rx="2"/><path d="M5 18h14M8 21h8"/>',
    heading: '<path d="M6 5v14M18 5v14M6 12h12"/>',
    section: '<path d="M5 6h14M5 11h9M5 16h14M5 21h9"/>',
    paragraph: '<path d="M13 4v16M17 4v16M17 4h-6.5a4 4 0 0 0 0 8H13"/>',
    sentence: '<path d="M4 9h16M4 15h10"/><circle cx="18.5" cy="15" r="1" fill="currentColor" stroke="none"/>',
    quote: '<path d="M10 7H6.5A1.5 1.5 0 0 0 5 8.5v3A1.5 1.5 0 0 0 6.5 13H9v1a3 3 0 0 1-3 3M19 7h-3.5a1.5 1.5 0 0 0-1.5 1.5v3a1.5 1.5 0 0 0 1.5 1.5H18v1a3 3 0 0 1-3 3"/>',
    source: '<path d="M5 4.5h9.5a2 2 0 0 1 2 2V20l-3-2-3 2-3-2-2.5 2z"/><path d="M8 9h5M8 12.5h5"/>',
    citation: '<path d="M4 5.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4zM20 5.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6z"/>',
    orientation: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
    signpost: '<path d="M12 21V3M12 6h6.5l2 2-2 2H12M12 13H5.5l-2 2 2 2H12"/>',
    definition: '<path d="M5 19 9.5 5l4.5 14M6.7 14h5.6M16 10.5c1-1.5 4-1.5 4 .8V19M20 14.5c-2.5-.5-4.5.3-4.5 2.2 0 1.6 2 2.6 4.5.8"/>',
    question: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.7"/><circle cx="12" cy="16.8" r=".9" fill="currentColor" stroke="none"/>',
    report: '<path d="M4.5 6.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H11l-4.5 3.5v-3.5h0a2 2 0 0 1-2-2z"/><path d="M8.5 9h7M8.5 12h4.5"/>',
    attribution: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    claim: '<path d="M5 21V4M5 4.5h11l-2.5 4 2.5 4H5"/>',
    evidence: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
    example: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.7 10.7c.5.4.7 1 .7 1.6V16h6v-.7c0-.6.3-1.2.7-1.6A6 6 0 0 0 12 3z"/>',
    reasoning: '<path d="M9.5 14.5 14.5 9.5M8 11.5l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 12.5l2-2a3.5 3.5 0 0 0-5-5l-2 2"/>',
    qualification: '<path d="M12 4v16M6 20h12M5 8h14M5 8l-2.5 6a2.8 2.8 0 0 0 5 0zM19 8l-2.5 6a2.8 2.8 0 0 0 5 0z"/>',
    contrast: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    concession: '<path d="M4 12c0-4 3.5-7 8-7s8 3 8 7-3.5 7-8 7"/><path d="m8 15-4 4M4 15v4h4"/>',
    conclusion: '<circle cx="12" cy="12" r="8.5"/><path d="m8.2 12.3 2.6 2.6 5-5.4"/>',
    recall: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    implication: '<path d="M4 12h15M14 6l6 6-6 6"/>',
    history: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    limitation: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12h8"/>',
    interpretation: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    mechanism: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    quoted: '<path d="M10 7H6.5A1.5 1.5 0 0 0 5 8.5v3A1.5 1.5 0 0 0 6.5 13H9v1a3 3 0 0 1-3 3M19 7h-3.5a1.5 1.5 0 0 0-1.5 1.5v3a1.5 1.5 0 0 0 1.5 1.5H18v1a3 3 0 0 1-3 3"/>',
    reference: '<path d="M5 4.5h9.5a2 2 0 0 1 2 2V20l-3-2-3 2-3-2-2.5 2z"/>',
    none: '<circle cx="12" cy="12" r="8.5"/><path d="m7 17 10-10"/>',
    structure: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="17" height="7" rx="1.5"/>',
    topic: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    role: '<circle cx="8" cy="8" r="3"/><path d="M3 19a5 5 0 0 1 10 0M15 8h6M15 12h6M17 16h4"/>',
    support: '<path d="M12 3.5 19 6v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4.5"/>',
    parameters: '<path d="M5 20V11M10 20V5M15 20v-8M20 20v-5"/>',
    // People and agents (comment authors, provenance), comments, and the generated families.
    person: '<circle cx="12" cy="8" r="3.6"/><path d="M5.2 20.2c.8-3.6 3.6-5.6 6.8-5.6s6 2 6.8 5.6"/>',
    agent: '<rect x="5" y="8" width="14" height="11" rx="3.5"/><path d="M12 8V5M9.5 4.5h5"/><circle cx="9.5" cy="13.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="13.2" r="1.1" fill="currentColor" stroke="none"/><path d="M10 16.2h4"/>',
    people: '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.6 5.5 4.6"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M16.3 14.4c2.3.1 3.9 1.5 4.4 4"/>',
    comment: '<path d="M5 6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5.5L7.5 19v-3.5H7a2 2 0 0 1-2-2z"/>',
    unsigned: '<path d="M5 6.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-5.5L7.5 19v-3.5H7a2 2 0 0 1-2-2z"/><path d="M9 10h.01M12 10h.01M15 10h.01" stroke-width="2.4"/>',
    via: '<path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14"/><path d="M4 12h10M10.5 8.5 14 12l-3.5 3.5"/>',
    sigma: '<path d="M17.5 5H6.5l6 7-6 7h11"/>',
    variable: '<path d="M7 7.5c2.3-.4 3.4.8 4 3l2 6c.6 2.2 1.7 3.4 4 3M16.5 7.5l-9 12"/>',
    link: '<path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/>',
    result: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M15 3.5V7h3.5M9 12h6M9 15.5h4"/>',
    proof: '<path d="M6 3.5h9l3.5 3.5v13.5H6z"/><path d="M15 3.5V7h3.5"/><path d="m9 14 2 2 4-4.5"/>',
  };
  // Order matters: the first match wins. Ids and names are both checked.
  const RULES = [
    [/figure|image|photo/, 'figure'], [/table/, 'table'], [/caption/, 'caption'], [/heading/, 'heading'],
    [/^section$|sections/, 'section'], [/paragraph/, 'paragraph'], [/sentence(?!.*role)/, 'sentence'],
    [/quotation|^quote$/, 'quote'], [/citation|cited/, 'citation'], [/source(?!.*needed)/, 'source'],
    [/orientation|context|background/, 'orientation'], [/signpost/, 'signpost'], [/definition|define/, 'definition'], [/question|issue/, 'question'],
    [/report/, 'report'], [/attribution/, 'attribution'], [/claim|argument/, 'claim'], [/evidence|grounds|data/, 'evidence'],
    [/example|illustrat/, 'example'], [/reasoning|warrant|how it works|mechanism/, 'reasoning'],
    [/qualification|hedge/, 'qualification'], [/contrast/, 'contrast'], [/concession/, 'concession'],
    [/conclusion|closing|summary/, 'conclusion'], [/recall/, 'recall'], [/implication|consequence/, 'implication'],
    [/history|era|chronolog/, 'history'], [/limitation|limits?$/, 'limitation'], [/interpretation/, 'interpretation'],
    [/quoted|checked/, 'quoted'], [/reference only|reference-only|support-reference/, 'reference'], [/no source|support-none/, 'none'],
    [/framing/, 'orientation'], [/sourcing/, 'source'], [/positioning/, 'qualification'],
    [/content structure|rhetorical|^move$|document structure|document-structure/, 'structure'], [/sentence role|^role$/, 'role'],
    [/^support$/, 'support'], [/^topic$/, 'topic'], [/parameters?/, 'parameters'],
  ];
  const cache = new Map();
  // Generated families: people and agents, comments, provenance, mathematics, cross-references, environments.
  const AGENT = /claude|codex|gpt|gemini|llama|agent|bot|script|\(review\)|assistant/i;
  function special(id, name) {
    if (/^(comments-by|prov-by)-/.test(id)) return AGENT.test(name) ? 'agent' : 'person';
    if (id === 'comments-unsigned') return 'unsigned';
    if (id === 'comments') return 'comment';
    if (id === 'provenance') return 'people';
    if (id === 'prov-via' || /^prov-via-/.test(id)) return 'via';
    if (id === 'math' || id === 'math-types' || /^math-tg-|^math-t-/.test(id)) return 'sigma';
    if (/^math-(v|i|s)-|^math-variables$|^math-indices$|^math-sets$|^math-vg-/.test(id)) return 'variable';
    if (id === 'xref' || /^xref-/.test(id)) return /^xref-(recalls)$/.test(id) ? 'recall' : 'link';
    if (id === 'env-proof') return 'proof';
    if (id === 'env-definition') return 'definition';
    if (id === 'env' || /^env-/.test(id)) return 'result';
    return null;
  }
  function iconFor(id = '', name = '') {
    const key = id + '|' + name; if (cache.has(key)) return cache.get(key);
    const sp = special(String(id), String(name)); if (sp) { cache.set(key, sp); return sp; }
    const hay = [String(id).toLowerCase(), String(name).toLowerCase()];
    let hit = 'tag';
    for (const [re, k] of RULES) if (hay.some((h) => re.test(h))) { hit = k; break; }
    cache.set(key, hit); return hit;
  }
  const svg = (k) => `<svg class="tg-ico tg-${k}" viewBox="0 0 24 24" aria-hidden="true">${I[k] || I.tag}</svg>`;
  window.TraceTagIcon = { iconFor, svg, inner: (k) => I[k] || I.tag, html: (id, name) => svg(iconFor(id, name)) };

  // Decorate tag controls wherever they appear, now and after re-renders.
  const names = new Map();
  (function walk(list) { for (const t of list || []) { names.set(t.id, t.name); walk(t.children); } })(window.OUTLINE_SEED?.tagTree);
  function decorate(root) {
    root.querySelectorAll?.('.reading-tag-select:not([data-ico])').forEach((b) => {
      b.dataset.ico = '1'; const id = b.dataset.readingTag; const span = b.querySelector('span') || b;
      span.insertAdjacentHTML('afterbegin', svg(iconFor(id, names.get(id) || b.textContent.trim())));
    });
    root.querySelectorAll?.('.ev-tag:not([data-ico]), .tb-name:not([data-ico])').forEach((b) => {
      b.dataset.ico = '1'; b.insertAdjacentHTML('afterbegin', svg(iconFor(b.dataset.tagId || '', b.textContent.trim())));
    });
    root.querySelectorAll?.('.tb-family:not([data-ico]) > span:first-child').forEach((sp) => {
      const b = sp.parentElement; b.dataset.ico = '1'; sp.insertAdjacentHTML('afterbegin', svg(iconFor('', sp.textContent.trim())));
    });
  }
  decorate(document);
  new MutationObserver((rs) => rs.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType === 1) decorate(n.parentNode || n); }))).observe(document.body, { childList: true, subtree: true });
})();
