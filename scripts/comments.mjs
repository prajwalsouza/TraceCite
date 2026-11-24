// Comments: people's remarks, kept in the outline as children of what they are about.
//
// A comment is a block of type "note" with a "Comment by" field (empty for an unsigned comment):
//   { "id": "c1", "type": "note", "text": "Is the constant in Lemma 5.2 tight?",
//     "fields": [{ "key": "Comment by", "value": "Ans Ahmed" }, { "key": "Commented on", "value": "2026-11-24" }],
//     "tags": ["topic-markup"], "children": [ …replies, which are comments too… ] }
// Put it under the sentence, citation or reference it is about; replies go under the comment.
// Comments never appear in the prose. The builder adds a "Comments" family to the tag tree (one tag per
// person, plus Unsigned), tags each comment and the sentence it belongs to, so the tag tree shows where
// people commented. An opened sentence lists its comments, threaded, with their tags.
// Quotes in a BibTrace bibliography can carry comments too: trace-quote[-n]-comment-m and
// trace-quote[-n]-comment-m-by.

const isComment = (b) => b.type === 'note' && (b.fields || []).some((f) => f.key === 'Comment by');
const byOf = (b) => ((b.fields || []).find((f) => f.key === 'Comment by')?.value || '').trim();
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';

export function addComments(trace) {
  const people = new Map(); // name → count
  let unsigned = 0, total = 0;
  const found = [];
  (function walk(list, sentence) {
    for (const b of list || []) {
      const here = b.type === 'sentence' ? b : sentence;
      if (isComment(b)) { found.push({ b, sentence: here }); total++; const by = byOf(b); if (by) people.set(by, (people.get(by) || 0) + 1); else unsigned++; }
      walk(b.children, here);
    }
  })(trace.blocks, null);
  // Comments carried by sources (BibTrace quote comments) count too.
  for (const s of trace.sources || []) for (const f of s.fields || []) if (/^Quote comment by/.test(f.key)) { total++; if (f.value) people.set(f.value, (people.get(f.value) || 0) + 1); }
  for (const s of trace.sources || []) for (const f of s.fields || []) if (/^Quote comment(?! by)/.test(f.key) && !(s.fields || []).some((x) => x.key === f.key.replace('Quote comment', 'Quote comment by') && x.value)) unsigned++;
  if (!total) return null;
  if (trace.tagTree.some((t) => t.id === 'comments')) throw new Error('the tag tree already has a "comments" family');
  const family = { id: 'comments', name: 'Comments', children: [...people.keys()].sort().map((name) => ({ id: 'comments-by-' + slug(name), name, children: [] })) };
  if (unsigned) family.children.push({ id: 'comments-unsigned', name: 'Unsigned', children: [] });
  trace.tagTree.push(family);
  for (const { b, sentence } of found) {
    const t = byOf(b) ? 'comments-by-' + slug(byOf(b)) : 'comments-unsigned';
    b.tags = [...new Set([...(b.tags || []), t])];
    if (sentence) sentence.tags = [...new Set([...(sentence.tags || []), t])];
  }
  return { total, people: people.size, unsigned };
}
