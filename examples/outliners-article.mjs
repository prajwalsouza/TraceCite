#!/usr/bin/env node
// A demonstration article in the trace data format: "Outlines you can read".
// Writes outliners.trace.json next to this file. Build it with:
//   node ../scripts/build-reading.mjs --data outliners.trace.json --out ../references/outliners-reading.html
//
// Honesty rules used here, as in Trace: every exact quote was checked verbatim
// against its local file; sources without a checked quote carry no quote, so the
// page shows them as unverified; interpretation is tagged as interpretation.
import { writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const f = (fields) => Object.entries(fields).filter(([, v]) => v).map(([key, value]) => ({ key, value }));

const tagTree = [
  { id: 'role', name: 'Sentence role', children: [
    { id: 'role-definition', name: 'Definition', children: [] },
    { id: 'role-history', name: 'History', children: [] },
    { id: 'role-mechanism', name: 'How it works', children: [] },
    { id: 'role-interpretation', name: 'Our interpretation', children: [] },
    { id: 'role-limit', name: 'Limitation', children: [] },
  ] },
  { id: 'support', name: 'Support', children: [
    { id: 'support-quoted', name: 'Quoted from a checked file', children: [] },
    { id: 'support-reference', name: 'Reference only, no quote', children: [] },
    { id: 'support-none', name: 'No source needed', children: [] },
  ] },
  { id: 'topic', name: 'Topic', children: [
    { id: 'topic-structure', name: 'Structure', children: [
      { id: 'topic-blocks', name: 'Blocks and nesting', children: [] },
      { id: 'topic-fields', name: 'Fields and tags', children: [] },
    ] },
    { id: 'topic-reading', name: 'Reading', children: [] },
    { id: 'topic-evidence', name: 'Evidence', children: [] },
    { id: 'topic-tools', name: 'Tools and history', children: [] },
  ] },
  // Connected highlights: two threads the reader can follow by colour across sentences ([text]{.hl-tree}).
  { id: 'connected', name: 'Connected highlights', children: [
    { id: 'hl-tree', name: 'The tree of blocks', slot: 1, children: [] },
    { id: 'hl-words', name: 'The exact words', slot: 2, children: [] },
  ] },
];

// Sources. Local files carry checked verbatim quotes; classics carry references only.

const sources = [
  { id: 'src-readme', text: 'Trace README, 2026', fields: f({ 'APA citation': 'Trace README, 2026', 'First author': 'Trace README', Year: '2026', 'APA reference': 'Trace README. (2026). Project documentation for the Trace evidence outliner [Unpublished project file, README.md].',
    'Exact quote': 'Section → paragraph → sentence → citation → exact reference.', 'Quote location': 'README.md · What is in it · third list item',
    'Exact quote 2': 'Switching views does not discard or rewrite blocks.', 'Quote location 2': 'README.md · Views and export · APA view paragraph, last sentence',
    'Exact quote 3': 'No text is hidden, reordered, or rewritten.', 'Quote location 3': 'README.md · Views and export · focus counts paragraph',
    'Exact quote 4': 'Quotes and bibliographic metadata are stored in shared source blocks.', 'Quote location 4': 'README.md · What is in it · last list item',
    'Record status': 'Checked excerpt · verbatim' }) },
  { id: 'src-prompt', text: 'Trace design brief, 2026', fields: f({ 'APA citation': 'Trace design brief, 2026', 'First author': 'Trace design brief', Year: '2026', 'APA reference': 'Trace design brief. (2026). Interface concept prompt for the Margin outliner [Design note]. Unpublished project file, design/prompt.md.',
    'Exact quote': 'Fields reveal inline key:value rows like Tana or Logseq; these are not four separate forms or four boxed cards.', 'Quote location': 'design/prompt.md · Desktop UI · paragraph after the four hierarchy levels',
    'Record status': 'Checked excerpt · verbatim' }) },
  { id: 'src-code', text: 'Trace source comments, 2026', fields: f({ 'APA citation': 'Trace source comments, 2026', 'First author': 'Trace source comments', Year: '2026', 'APA reference': 'Trace source comments. (2026). Comments in reading-peek.js, reading-rails.css and app.js [Source code]. Unpublished project files.',
    'Exact quote': 'The hover outline is a projection, never a second editable copy.', 'Quote location': 'reading-peek.js · line 46',
    'Exact quote 2': 'Quiet reading aids. No container chrome; paper remains the primary surface.', 'Quote location 2': 'reading-rails.css · line 1',
    'Exact quote 3': 'Reading focus is transient UI state, separate from author text and backups.', 'Quote location 3': 'app.js · line 34',
    'Record status': 'Checked excerpt · verbatim' }) },
  { id: 'src-engelbart', text: 'Engelbart, 1962', fields: f({ 'APA citation': 'Engelbart, 1962', 'First author': 'Engelbart', Year: '1962', 'APA reference': 'Engelbart, D. C. (1962). Augmenting human intellect: A conceptual framework (Summary Report AFOSR-3223). Stanford Research Institute.',
    'Record status': 'Reference only · no passage checked for this article' }) },
  { id: 'src-engelbart-english', text: 'Engelbart & English, 1968', fields: f({ 'APA citation': 'Engelbart & English, 1968', 'First author': 'Engelbart', Year: '1968', 'APA reference': 'Engelbart, D. C., & English, W. K. (1968). A research center for augmenting human intellect. In Proceedings of the Fall Joint Computer Conference (pp. 395–410). AFIPS.',
    'Record status': 'Reference only · no passage checked for this article' }) },
  { id: 'src-opml', text: 'Winer, 2006', fields: f({ 'APA citation': 'Winer, 2006', 'First author': 'Winer', Year: '2006', 'APA reference': 'Winer, D. (2006). OPML 2.0 specification. http://opml.org/spec2.opml', URL: 'http://opml.org/spec2.opml',
    'Record status': 'Reference only · no passage checked for this article' }) },
].map((s) => ({ ...s, type: 'source', tags: [], collapsed: true, children: [] }));

// Trace's rule: every quote carries its context, the full passage it sits in. outliners.contexts.json was
// extracted from the Trace checkout with scripts/contexts-from-files.mjs, and each context contains its
// quote verbatim. Notes and comments on quotes show the tree going deeper: quote → context, notes, comments.
{
  const contexts = JSON.parse(await readFile(join(here, 'outliners.contexts.json'), 'utf8'));
  for (const [k, v] of Object.entries(contexts)) {
    const [id, n] = k.split('|'), sfx = n === '1' ? '' : ' ' + n, src = sources.find((x) => x.id === id);
    const q = src?.fields.find((x) => x.key === 'Exact quote' + sfx)?.value;
    if (!q || !v.context.includes(q)) throw new Error('context does not contain its quote: ' + k);
    src.fields.push({ key: 'Quote context' + sfx, value: v.context });
  }
  const add = (id, key, value) => sources.find((x) => x.id === id).fields.push({ key, value });
  add('src-readme', 'Quote note.1', 'The five levels are the whole idea: each one is a block you can open.');
  add('src-readme', 'Quote tags', 'topic-blocks;topic-evidence');
  add('src-readme', 'Quote note 2.1', 'A guarantee, not a habit: views are projections of one tree.');
  add('src-code', 'Quote note.1', 'Read from the code, not the docs: the margin outline cannot drift from the stored blocks.');
  add('src-code', 'Quote comment.1', 'Worth repeating in the user guide, where readers will actually see it.');
  add('src-code', 'Quote comment by.1', '');
  add('src-prompt', 'Quote note.1', 'Tana and Logseq are named only as a feel to aim for, not as sources.');
}

let n = 0;
// A sentence: text, tags, a short review, and its citations [sourceId, quote?].
function sentence(text, tags, review, cites = []) {
  const id = 'out-s' + ++n;
  return { id, type: 'sentence', text, tags, collapsed: true,
    fields: f({ 'Sentence review': review, Status: tags.includes('support-reference') ? 'Reference only · check before relying on it' : '' }),
    children: cites.map(([sourceId, quote], i) => {
      const source = sources.find((s) => s.id === sourceId);
      return { id: `${id}-c${i}`, type: 'citation', text: source.text, tags: [], collapsed: true, fields: f({ 'Source ID': sourceId }),
        children: [{ id: `${id}-c${i}-r`, type: 'reference', text: 'Exact reference', tags: [], collapsed: true, fields: f({ 'Source ID': sourceId, 'Exact supporting extract': quote }), children: [] }] };
    }) };
}
const paragraph = (id, title, sentences) => ({ id, type: 'paragraph', text: title, tags: [], collapsed: false, fields: f({ 'Source file': 'examples/outliners-article.mjs' }), children: sentences });
const section = (id, title, paragraphs) => ({ id, type: 'section', text: title, tags: ['topic'], collapsed: false, fields: f({ 'Heading level': '2' }), children: paragraphs });

const q = (i) => sources[0].fields.find((x) => x.key === (i ? `Exact quote ${i}` : 'Exact quote')).value;
const quote = (id, k = '') => sources.find((s) => s.id === id).fields.find((x) => x.key === 'Exact quote' + k).value;

const blocks = [
  section('sec-what', 'What an outliner is', [
    paragraph('p-what-1', 'Definition', [
      sentence('An outliner is a writing tool in which a document is a [tree of short blocks]{.hl-tree} rather than one long page.', ['role-definition', 'support-none', 'topic-blocks'], 'A working definition for this article. It describes the shape of the tool, not a claim from a source.'),
      sentence('Each block can hold children, and any branch can be folded away or opened again without changing the text inside it.', ['role-mechanism', 'support-none', 'topic-blocks'], 'Describes the common behaviour of outliners. No single source is needed for it.'),
      sentence('Because the structure is explicit, a reader can see at a glance which sentence belongs to which idea.', ['role-interpretation', 'support-none', 'topic-reading'], 'Our interpretation of why explicit structure helps reading. It is not a tested claim.'),
    ]),
  ]),
  section('sec-history', 'Where outliners come from', [
    paragraph('p-history-1', 'History', [
      sentence('The idea of working on text as a structure that can be folded, rearranged and linked is usually traced to Douglas Engelbart’s programme for augmenting human intellect.', ['role-history', 'support-reference', 'topic-tools'], 'Cited as the usual origin story. No passage from the report was checked for this article, so open the source before quoting it.', [['src-engelbart']]),
      sentence('His group demonstrated hierarchical, collapsible documents in a live system in 1968.', ['role-history', 'support-reference', 'topic-tools'], 'The conference paper describes the system. No passage was checked here, so the page shows it as unverified.', [['src-engelbart-english']]),
      sentence('Later outliners kept the tree but moved it into ordinary files, and [OPML](http://opml.org/spec2.opml) became a common way to exchange an outline between programs.', ['role-history', 'support-reference', 'topic-tools', 'topic-structure'], 'The OPML specification defines the exchange format. The claim that it became common is ours and is not measured here.', [['src-opml']]),
    ]),
  ]),
  section('sec-blocks', 'Blocks, fields and tags', [
    paragraph('p-blocks-1', 'Blocks', [
      sentence('In an evidence outliner [the tree]{.hl-tree} has a fixed meaning, running from the section down to [the exact words a source used]{.hl-words}.', ['role-mechanism', 'support-quoted', 'topic-blocks', 'topic-evidence'], 'The README gives the five levels verbatim. The sentence restates them without adding a claim.', [['src-readme', q(0)]]),
      sentence('Every block can also carry fields, which open as quiet key and value rows under the block instead of a separate form.', ['role-mechanism', 'support-quoted', 'topic-fields'], 'The design brief states this directly.', [['src-prompt', quote('src-prompt')]]),
      sentence('Tags sit beside the fields, and one sentence can carry several of them, for its role, its support and its topic.', ['role-mechanism', 'support-none', 'topic-fields'], 'Describes this page itself. Hover any sentence to see its tags.'),
    ]),
    paragraph('p-blocks-2', 'Shared sources', [
      sentence('A source is stored once and every citation points to it, so correcting a reference corrects it everywhere.', ['role-mechanism', 'support-quoted', 'topic-evidence'], 'The README states that quotes and metadata live in shared source blocks.', [['src-readme', q(4)]]),
    ]),
  ]),
  section('sec-reading', 'Reading an outline as a paper', [
    paragraph('p-reading-1', 'One tree, several views', [
      sentence('[The same tree]{.hl-tree} can be shown as an outline for writing or as plain prose for reading, and switching between them leaves the blocks untouched.', ['role-mechanism', 'support-quoted', 'topic-reading'], 'The README makes this guarantee for the APA view.', [['src-readme', q(2)]]),
      sentence('This page is the reading view: the outline is still there, but it stays out of the way until you ask for it.', ['role-interpretation', 'support-none', 'topic-reading'], 'A description of the page you are reading.'),
      sentence('Hovering a sentence shows its piece of the tree in the margin, and that margin is only a projection of the stored blocks.', ['role-mechanism', 'support-quoted', 'topic-reading', 'topic-blocks'], 'The code comment states that the hover outline is a projection.', [['src-code', quote('src-code')]]),
    ]),
    paragraph('p-reading-2', 'Focus without hiding', [
      sentence('Choosing a tag in the margin dims every sentence that does not carry it, so you can read one thread of the argument at a time.', ['role-mechanism', 'support-none', 'topic-reading', 'topic-fields'], 'Try it with the Topic tags on the left.'),
      sentence('Nothing is removed while you do this, and the focus is not saved into the document.', ['role-mechanism', 'support-quoted', 'topic-reading'], 'Both properties are stated in the project files.', [['src-readme', q(3)], ['src-code', quote('src-code', ' 3')]]),
    ]),
  ]),
  section('sec-evidence', 'Evidence you can open', [
    paragraph('p-evidence-1', 'From sentence to quote', [
      sentence('Clicking a sentence opens its branch in place, from the citation down to [the quoted passage]{.hl-words} and where that passage sits in the source.', ['role-mechanism', 'support-none', 'topic-evidence'], 'Click this sentence to see the behaviour it describes.'),
      sentence('When a source has no checked quote, the page says so instead of inventing one (see [Limits](#/at/sec-limits)).', ['role-mechanism', 'support-none', 'topic-evidence'], 'Open any sentence in the history section to see the unverified state.'),
      sentence('The tags separate what a sentence claims from how well it is supported, which keeps an interpretation from looking like a finding.', ['role-interpretation', 'support-none', 'topic-evidence', 'topic-fields'], 'Our interpretation of why role and support are separate tag families.'),
    ]),
  ]),
  section('sec-limits', 'Limits', [
    paragraph('p-limits-1', 'What an outliner does not do', [
      sentence('An outliner records where a claim comes from, but it does not check that the source really supports the claim.', ['role-limit', 'support-none', 'topic-evidence'], 'A limitation of the format. Support decisions are made by people.'),
      sentence('A tree also favours one way of dividing an argument, so ideas that cross branches have to be linked with tags or repeated citations.', ['role-limit', 'role-interpretation', 'support-none', 'topic-structure'], 'Our interpretation of a known trade-off of hierarchical documents.'),
      sentence('The reading view works best for documents that are finished enough to read, while the outline view remains the place to write.', ['role-interpretation', 'support-none', 'topic-reading'], 'A recommendation from building this page.'),
    ]),
  ]),
];

// Comments are outline blocks too: a note with "Comment by", a child of what it is about; replies nest.
const commentOn = (prefix, by, text, replies = []) => {
  const walk = (list) => { for (const b of list) { if (b.type === 'sentence' && b.text.startsWith(prefix)) return b; const r = walk(b.children || []); if (r) return r; } };
  const target = walk(blocks);
  if (!target) throw new Error('no sentence for comment: ' + prefix);
  const mk = (by, text, kids) => ({ id: 'out-c' + ++n, type: 'note', text, tags: [], collapsed: true, fields: f({ 'Comment by': by || ' ', 'Commented on': '2026-11-24' }).map((x) => ({ ...x, value: x.value.trim() })), children: kids.map(([b, t]) => mk(b, t, [])) });
  target.children.push(mk(by, text, replies));
};
commentOn('An outliner records where a claim comes from', 'Example reader', 'Could the tool flag a quote whose context no longer contains it?', [['', 'The validator does: a context that does not contain its quote is an error.']]);
commentOn('Hovering a sentence shows its piece of the tree', '', 'Nice: this is what makes the evidence feel close.');

// Provenance on every part of the trace: who added each record and quote, how, and who checked it.
for (const src of sources) {
  src.fields.push({ key: 'Added by', value: 'AI agent (example author)' }, { key: 'Added via', value: 'Trace checkout' }, { key: 'Added on', value: '2026-11-24' });
  for (const f of [...src.fields]) {
    const m = f.key.match(/^Exact quote(?: (\d+))?$/); if (!m || !f.value) continue;
    const sfx = m[1] ? ' ' + m[1] : '';
    src.fields.push({ key: 'Quote added by' + sfx, value: 'AI agent (example author)' }, { key: 'Quote checked by' + sfx, value: 'script (verbatim check)' }, { key: 'Quote checked on' + sfx, value: '2026-11-24' });
  }
}

const doc = { format: 'tracecite/1.0', version: 2, eyebrow: 'An essay on outliners', title: 'Outlines you can read', subtitle: 'What outliners are, and how a tree of blocks becomes a paper with its evidence attached.', updatedAt: new Date().toISOString(), tagTree, blocks, sources };
await writeFile(join(here, 'outliners.trace.json'), JSON.stringify(doc, null, 2));
console.log(`Wrote outliners.trace.json: ${n} sentences, ${sources.length} sources.`);
