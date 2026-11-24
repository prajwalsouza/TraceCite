// Span tags, connected highlights and links: the preparation step (runs in the builder's check and, bundled
// as TracePrep.spans, in every reading page). The data file is never changed; this works on the prepared copy.
//
// Span tags mark part of a text with a tag, in Pandoc's bracketed-span syntax:
//     The input is a [list of n numbers]{.hl-x}.
// They work in block text, headings, captions and notes, never inside exact quotes (sources are left
// alone). A block that contains a span also carries its tag, so every block-level tag feature keeps working;
// tag focus then lights up exactly the spans as well. In mathematics, use MathJax's own \class{hl-x}{x}.
//
// Connected highlights are a use of span tags: a tag family (by convention "connected") whose tags have
//     "slot": 1–5        one of five theme-aware colours, the same thread colour across words and figures;
//     "symbols": ["x"]   TeX symbols coloured automatically in every formula (wrapped as \class{hl-x}{x}).
// Words are never coloured automatically; writers mark them with spans.
//
// Links: [text](https://…) opens in a new tab; [text](#/at/<block id>) jumps within the document; bare
// https:// addresses become links too. Only http, https, mailto and #/at/ are allowed; anything else stays
// plain text. A generated "Links" family tags every block that links out (External link, one child per site;
// Internal link). "links": {"off": true} in the data leaves the family out.
export const SPAN = /\[([^\[\]\n]+)\]\{\.([A-Za-z][\w-]*)\}/g;
export const LINK = /\[([^\[\]\n]+)\]\(([^()\s]+)\)/g;
export const BARE = /(?<![("\[\w])https?:\/\/[^\s<>()"]+[^\s<>()".,;:!?'’]/g;
const MATH = /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|(?<!\\)\$[^$\n]+?(?<!\\)\$)/g;

// What a link target is: 'external', 'mail', 'internal' or null (not allowed).
export function linkKind(url) {
  if (/^https?:\/\/[^\s]+$/i.test(url)) return 'external';
  if (/^mailto:[^\s]+$/i.test(url)) return 'mail';
  if (/^#\/at\/[\w.:-]+$/.test(url)) return 'internal';
  return null;
}
export function siteOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } }

// Spans, links and bare addresses in one text (outside its maths).
export function scan(text) {
  const out = { spans: [], links: [] };
  if (typeof text !== 'string' || !/[\[]|https?:/.test(text)) return out;
  const prose = text.replace(MATH, (m) => ' '.repeat(m.length));
  for (const m of prose.matchAll(SPAN)) out.spans.push({ text: m[1], tag: m[2] });
  for (const m of prose.matchAll(LINK)) out.links.push({ text: m[1], url: m[2], kind: linkKind(m[2]) });
  for (const m of prose.replace(LINK, (s) => ' '.repeat(s.length)).matchAll(BARE)) out.links.push({ text: m[0], url: m[0], kind: 'external' });
  return out;
}

// Every text a block shows: its text and its fields, except evidence fields (quotes stay verbatim).
const QUOTE_FIELD = /^(Exact quote|Quote context|Quote location|Bib data|APA reference|APA citation)/;
function texts(b) { return [b.text, ...(b.fields || []).filter((f) => !QUOTE_FIELD.test(f.key)).map((f) => f.value)].filter((t) => typeof t === 'string'); }

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function walkTags(list, fn, parent = null) { for (const t of list || []) { fn(t, parent); walkTags(t.children, fn, t); } }

export function addSpanTags(trace) {
  const tagIds = new Set(); const slotted = {};
  walkTags(trace.tagTree, (t) => {
    tagIds.add(t.id);
    if (t.slot || t.symbols) slotted[t.id] = { slot: Number.isInteger(t.slot) && t.slot >= 1 && t.slot <= 5 ? t.slot : null, symbols: [].concat(t.symbols || []).filter((s) => typeof s === 'string' && s) };
  });
  // Symbols of connected highlights: wrap each in \class{<tag>}{…} inside formulas, and tag the block.
  // One pass over each formula with every symbol at once (longest first), so nothing inserted is matched again;
  // a symbol is a whole token (no letter before or after it), and a writer's own \class{…}{…} is left alone.
  // Each one is wrapped in braces, so x_q stays valid TeX.
  const bySymbol = new Map(); for (const [id, v] of Object.entries(slotted)) for (const s of v.symbols) if (!bySymbol.has(s)) bySymbol.set(s, id);
  const symbolRe = bySymbol.size ? new RegExp('(?<![A-Za-z\\\\])(' + [...bySymbol.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join('|') + ')(?![A-Za-z])', 'g') : null;
  const linkOff = trace.links?.off;
  const external = new Map(); let internal = 0, mail = 0, spans = 0, symbolHits = 0;
  (function walk(list) {
    for (const b of list || []) {
      const add = new Set();
      for (const t of texts(b)) {
        const { spans: ss, links } = scan(t);
        for (const s of ss) { add.add(s.tag); spans++; }
        if (!linkOff) for (const l of links) {
          if (l.kind === 'external') { const site = siteOf(l.url); if (!external.has(site)) external.set(site, 0); external.set(site, external.get(site) + 1); add.add('link-external'); if (site) add.add('link-site-' + site.replace(/[^a-z0-9]+/gi, '-').toLowerCase()); }
          else if (l.kind === 'internal') { internal++; add.add('link-internal'); }
          else if (l.kind === 'mail') { mail++; add.add('link-mail'); }
        }
      }
      if (symbolRe && typeof b.text === 'string' && /\\\(|\\\[|\$/.test(b.text)) {
        b.text = b.text.replace(MATH, (math) => {
          const names = [...math.matchAll(/\\class\{[^}]*\}(?:\{[^}]*\})?/g)].map((m) => [m.index, m.index + m[0].length]);
          return math.replace(symbolRe, (s, _g, at) => {
            if (names.some(([a, z]) => at >= a && at < z)) return s;
            const id = bySymbol.get(s); add.add(id); symbolHits++;
            return `{\\class{${id}}{${s}}}`;
          });
        });
      }
      for (const id of add) if (!tagIds.has(id) && !/^link-/.test(id)) add.delete(id); // unknown ids: the validator reports them
      if (add.size) b.tags = [...new Set([...(b.tags || []), ...add])];
      walk(b.children);
    }
  })(trace.blocks);
  if (!linkOff && (external.size || internal || mail)) {
    if (trace.tagTree.some((t) => t.id === 'links')) throw new Error('the tag tree already has a "links" family; set "links": {"off": true}');
    const children = [];
    if (external.size) children.push({ id: 'link-external', name: 'External link', children: [...external.keys()].filter(Boolean).sort().map((s) => ({ id: 'link-site-' + s.replace(/[^a-z0-9]+/gi, '-').toLowerCase(), name: s, children: [] })) });
    if (internal) children.push({ id: 'link-internal', name: 'Internal link', children: [] });
    if (mail) children.push({ id: 'link-mail', name: 'Email', children: [] });
    trace.tagTree.push({ id: 'links', name: 'Links', children });
  }
  return Object.keys(slotted).length || spans || external.size || internal || mail ? { index: slotted, spans, symbols: symbolHits, links: [...external.values()].reduce((a, b) => a + b, 0) + internal + mail } : null;
}
