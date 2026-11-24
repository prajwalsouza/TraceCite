// Provenance: who added each part of a trace, how, and who checked it. People and agents alike.
//
// On any block (sentence, citation, reference, note, comment):
//   "Added by"  the person or agent ("Ada Example", "AI agent (review)")
//   "Added via" how it came in ("manual", "Zotero", "agent", "script", "PDF")
//   "Added on"  date, YYYY-MM-DD
// On a source record (BibTrace field in brackets):
//   "Added by" (trace-added-by), "Added via" (trace-added-via), "Added on" (trace-added-on)
// On each quote n (BibTrace trace-quote[-n]-…):
//   "Quote added by n" (-added-by), "Quote checked by n" (-checked-by), "Quote checked on n" (-checked-on)
// On each note m of quote n: "Quote note by n.m" (trace-quote[-n]-note-m-by). Comments already carry "Comment by".
//
// The builder adds an "Added by" family to the tag tree: one tag per person or agent, plus one per way in
// (Zotero, manual, agent, …) under "Added via". A sentence is tagged with everyone who added it, its
// citations, or the quotes those citations rely on, so pinning a name shows everything that person or agent
// contributed. Opened sentences and quotes show the provenance in one quiet line.

const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
const get = (b, k) => ((b.fields || []).find((f) => f.key === k)?.value || '').trim();

export function addProvenance(trace) {
  const people = new Map(), ways = new Map();
  const note = (map, name) => { if (name) map.set(name, (map.get(name) || 0) + 1); };
  // Sources: who added the record, each quote, each note; who checked the quotes.
  const sourcePeople = new Map(); // source id → Set(names)
  const sourceWays = new Map();
  for (const s of trace.sources || []) {
    const names = new Set(), via = new Set();
    for (const f of s.fields || []) {
      if (!f.value) continue;
      if (f.key === 'Added by' || /^Quote (added|checked) by/.test(f.key) || /^Quote note by/.test(f.key)) { names.add(f.value.trim()); note(people, f.value.trim()); }
      if (f.key === 'Added via' || /^Quote added via/.test(f.key)) { via.add(f.value.trim()); note(ways, f.value.trim()); }
    }
    sourcePeople.set(s.id, names); sourceWays.set(s.id, via);
  }
  // Blocks.
  const blocks = [];
  (function walk(list) { for (const b of list || []) { blocks.push(b); const by = get(b, 'Added by'), via = get(b, 'Added via'); note(people, by); note(ways, via); walk(b.children); } })(trace.blocks);
  if (!people.size && !ways.size) return null;
  if (trace.tagTree.some((t) => t.id === 'provenance')) throw new Error('the tag tree already has a "provenance" family');
  const family = { id: 'provenance', name: 'Added by', children: [...people.keys()].sort().map((name) => ({ id: 'prov-by-' + slug(name), name, children: [] })) };
  if (ways.size) family.children.push({ id: 'prov-via', name: 'Added via', children: [...ways.keys()].sort().map((w) => ({ id: 'prov-via-' + slug(w), name: w, children: [] })) });
  trace.tagTree.push(family);
  // Tag each sentence with everyone behind it: itself, its children, and the sources it cites.
  for (const b of blocks.filter((x) => x.type === 'sentence')) {
    const tags = new Set(b.tags || []);
    (function walk(x) {
      const by = get(x, 'Added by'), via = get(x, 'Added via');
      if (by) tags.add('prov-by-' + slug(by)); if (via) tags.add('prov-via-' + slug(via));
      const src = get(x, 'Source ID');
      if (src) { for (const n of sourcePeople.get(src) || []) tags.add('prov-by-' + slug(n)); for (const w of sourceWays.get(src) || []) tags.add('prov-via-' + slug(w)); }
      if (x.type === 'note' && (x.fields || []).some((f) => f.key === 'Comment by')) return; // comments have their own family
      for (const c of x.children || []) walk(c);
    })(b);
    b.tags = [...tags];
  }
  return { people: people.size, ways: ways.size };
}
