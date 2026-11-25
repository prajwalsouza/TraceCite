#!/usr/bin/env node
// The showcase: a document about TraceCite, written in TraceCite. It is the demo site's front page.
//
//   node examples/tracecite/tracecite.mjs        writes examples/tracecite/tracecite.trace.json
//
// Every quote is verbatim. Quotes from TraceCite's own documentation are read from the files as published at
// the v0.2.0 tag (git show v0.2.0:<file>), and their passages are cut from those files programmatically, so
// each one can be checked against https://github.com/prajwalsouza/TraceCite/blob/v0.2.0/<file>. Quotes from
// other works reuse the records checked for examples/document-structure (passages withheld where the page is
// under copyright). The interactive's counts are computed from this document, not written in.
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const TAG = 'v0.2.0';
const f = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== '').map(([key, value]) => ({ key, value: String(value) }));
const fileAt = (path) => execFileSync('git', ['-C', root, 'show', `${TAG}:${path}`], { encoding: 'utf8' });
// The paragraph (text between blank lines) that holds the quote, with Markdown line breaks joined.
function passage(text, quote, where) {
  const para = text.split(/\n\s*\n/).find((p) => p.includes(quote));
  if (!para) throw new Error(`quote not found in ${where}: ${quote}`);
  return para.replace(/\s*\n\s*/g, ' ').trim();
}

// ---------- sources ----------
const own = [
  { id: 'src-readme', file: 'README.md', cite: 'TraceCite README, 2026', ref: 'DSouza, P. (2026). TraceCite README (Version 0.2.0) [Software documentation]. GitHub.', quotes: [
    ['Click a sentence and the source\'s exact words open in place, with the passage they sit in, notes, tags and who checked them.', 'README.md · opening paragraph'],
    ['A trace shows where a claim came from; it does not prove the claim is true.', 'README.md · One evidence tree · last paragraph, last sentence'],
  ] },
  { id: 'src-format', file: 'docs/format.md', cite: 'TraceCite format, 2026', ref: 'DSouza, P. (2026). TraceCite 1.0 specification (Version 0.2.0) [Software documentation]. GitHub.', quotes: [
    ['A TraceCite document is one tree.', 'docs/format.md · opening paragraph, first sentence'],
  ] },
  { id: 'src-package', file: 'docs/package.md', cite: 'TraceCite packages, 2026', ref: 'DSouza, P. (2026). TraceCite packages (.trace.zip) (Version 0.2.0) [Software documentation]. GitHub.', quotes: [
    ['A package holds one TraceCite document and everything it needs, in one file.', 'docs/package.md · opening paragraph, first sentence'],
  ] },
  { id: 'src-agents', file: 'docs/writing-with-agents.md', cite: 'Writing with agents, 2026', ref: 'DSouza, P. (2026). Writing TraceCite documents with an agent (Version 0.2.0) [Software documentation]. GitHub.', quotes: [
    ['Never retype a quote or rebuild it from memory.', 'docs/writing-with-agents.md · Evidence · first point'],
  ] },
];
const sources = own.map((s) => {
  const text = fileAt(s.file);
  const fields = { 'APA citation': s.cite, 'First author': 'DSouza', Year: '2026', 'APA reference': s.ref, URL: `https://github.com/prajwalsouza/TraceCite/blob/${TAG}/${s.file}`, 'Record status': `Checked excerpt · read from ${s.file} at ${TAG}; passage cut from the file by script` };
  s.quotes.forEach(([q, loc], i) => {
    const n = i ? ' ' + (i + 1) : '';
    fields['Exact quote' + n] = q; fields['Quote location' + n] = loc; fields['Quote context' + n] = passage(text, q, s.file);
    fields['Quote added by' + n] = 'AI agent (example author)'; fields['Quote checked by' + n] = 'script (verbatim check)'; fields['Quote checked on' + n] = '2026-11-25';
  });
  fields['Added by'] = 'AI agent (example author)'; fields['Added via'] = 'repository file'; fields['Added on'] = '2026-11-25';
  return { id: s.id, type: 'source', text: s.cite, tags: [], collapsed: true, children: [], fields: f(fields) };
});
const ds = JSON.parse(await readFile(join(root, 'examples/document-structure/document-structure.trace.json'), 'utf8'));
for (const id of ['src-bush', 'src-engelbart68', 'src-bernerslee', 'src-tei', 'src-html401']) sources.push(JSON.parse(JSON.stringify(ds.sources.find((s) => s.id === id))));
const src = (id) => sources.find((s) => s.id === id);
const quoteOf = (id, n = 1) => src(id).fields.find((x) => x.key === 'Exact quote' + (n > 1 ? ' ' + n : '')).value;

// ---------- blocks ----------
let n = 0;
function sentence(text, tags, review, cites = []) {
  const id = 'tc-s' + ++n;
  return { id, type: 'sentence', text, tags, collapsed: true, fields: f({ 'Sentence review': review }),
    children: cites.map(([sid, q], i) => ({ id: `${id}-c${i}`, type: 'citation', text: src(sid).text, tags: [], collapsed: true, fields: f({ 'Source ID': sid }),
      children: [{ id: `${id}-c${i}-r`, type: 'reference', text: 'Exact reference', tags: [], collapsed: true, fields: f({ 'Source ID': sid, 'Exact supporting extract': quoteOf(sid, q) }), children: [] }] })) };
}
const paragraph = (id, title, children, tags = [], fields = {}) => ({ id, type: 'paragraph', text: title, tags, collapsed: false, fields: f(fields), children });
const section = (id, title, children) => ({ id, type: 'section', text: title, tags: [], collapsed: false, fields: f({ 'Heading level': '2' }), children });
const REL = 'https://github.com/prajwalsouza/TraceCite/releases/latest/download/';
const SITE = 'https://prajwalsouza.github.io/TraceCite/';

const blocks = [
  section('tc-open', 'Click a sentence', [
    paragraph('tc-p-open', 'Opening', [
      sentence('This page is a TraceCite document, so every sentence on it can be opened: click one and see what it rests on.', ['role-guide', 'support-none'], 'An instruction to the reader; nothing to cite.'),
      sentence('A citation usually points at a whole work, and the reader is left to find [the words]{.hl-words} that support [the claim]{.hl-claim}.', ['role-interpretation', 'support-none', 'topic-evidence'], 'Our framing of the problem; it is an interpretation, not a finding.'),
      sentence('Here [a claim]{.hl-claim} opens in place to [the exact words]{.hl-words} a source used, [the passage they sit in]{.hl-passage}, and who checked them.', ['role-mechanism', 'support-quoted', 'topic-evidence'], 'The README states this verbatim.', [['src-readme', 1]]),
    ]),
  ]),
  section('tc-history', 'An old wish, made checkable', [
    paragraph('tc-p-history', 'Trails and trees', [
      sentence('In 1945 Vannevar Bush blamed our trouble with the record on artificial systems of indexing.', ['role-history', 'support-quoted', 'topic-history'], 'A close paraphrase of the quoted sentence.', [['src-bush', 1]]),
      sentence('He imagined encyclopedias that came with trails of association already running through them.', ['role-history', 'support-quoted', 'topic-history'], 'Paraphrases the second quote.', [['src-bush', 2]]),
      sentence('Engelbart\'s group broke text into small named statements arranged in a hierarchy, the ancestor of every outliner.', ['role-history', 'support-quoted', 'topic-history'], 'The first quote describes the hierarchy of statements; "ancestor of every outliner" is our gloss.', [['src-engelbart68', 1]]),
      sentence('Berners-Lee answered that a web of linked notes models the world better than a fixed tree.', ['role-history', 'support-quoted', 'topic-history'], 'Paraphrases the quote.', [['src-bernerslee', 1]]),
      sentence('TraceCite keeps both: [one tree]{.hl-claim} for the argument, and links and tags that cross it.', ['role-interpretation', 'support-quoted', 'topic-structure'], 'The format document states the one-tree rule; the synthesis with the history is ours.', [['src-format', 1]]),
    ]),
  ]),
  section('tc-tree', 'One tree, all the way down', [
    paragraph('tc-p-tree', 'The levels', [
      sentence('Each sentence holds its citations, each citation holds [the exact words]{.hl-words}, and each quote holds [the passage it came from]{.hl-passage}.', ['role-mechanism', 'support-none', 'topic-structure'], 'Describes this page\'s own structure, which the reader can open.'),
      sentence('Markup exists so that this structure is written down: without explicit marks a program sees only a sequence of undifferentiated bits.', ['role-mechanism', 'support-quoted', 'topic-structure'], 'The TEI quote, used for its own point.', [['src-tei', 1]]),
      sentence('The tags in the margin are this document\'s own schema; hover one, or pin it, and the rest of the page steps back.', ['role-guide', 'support-none', 'topic-structure'], 'An instruction; try it in the tag tree.'),
      sentence('The coloured threads you have been reading, [claim]{.hl-claim}, [words]{.hl-words} and [passage]{.hl-passage}, are connected highlights: the same idea keeps one colour wherever it appears.', ['role-guide', 'support-none', 'topic-structure'], 'Describes the highlights on this page.'),
    ]),
  ]),
  section('tc-count', 'Count what is checked', [
    paragraph('tc-p-def', 'Definition', [
      sentence('For a document with \\(n\\) [sentences]{.hl-n}, of which \\(q\\) open to a [checked quote]{.hl-q}, call \\(p = q / n\\) its checked share.', ['role-definition', 'support-none', 'topic-evidence'], 'Our definition.'),
    ], ['env-definition'], { Label: '1', Name: 'checked share' }),
    paragraph('tc-p-count', 'This page', [
      sentence('The figure below counts this very page, and the slider lets you see how the share moves.', ['role-guide', 'support-none', 'topic-evidence'], 'The counts are computed from this document by its generator.'),
    ]),
    { id: 'tc-fig', type: 'figure', text: 'Figure 1. How much of this page is checked', tags: [], collapsed: false, fields: f({ Interactive: 'checked-share' }), children: [
      paragraph('tc-fig-cap', 'Caption', [
        sentence('Each square is a sentence of this page; filled ones open to a [checked quote]{.hl-q}, out of all [n sentences]{.hl-n}.', ['caption', 'support-none'], 'Describes the figure.'),
      ], ['caption']),
    ] },
  ]),
  section('tc-take', 'Take it with you', [
    paragraph('tc-p-take', 'Packages and the reader', [
      sentence('A document travels as one file: a .trace.zip holding its data, its sources, its figures and its version history.', ['role-mechanism', 'support-quoted', 'topic-tools'], 'The package document states this.', [['src-package', 1]]),
      sentence('Drop any .trace.zip on this page to read it right here, for example [the sample](https://prajwalsouza.github.io/TraceCite/samples/sample.trace.zip) or [the essay on outliners](https://prajwalsouza.github.io/TraceCite/samples/outliners.trace.zip); nothing is uploaded.', ['role-guide', 'support-none', 'topic-tools'], 'An instruction; the files are on this site.'),
      sentence('To read packages anywhere, download [trace-reader.html](' + REL + 'trace-reader.html), one file that does all the work in the browser.', ['role-guide', 'support-none', 'topic-tools'], 'A pointer to the release download.'),
      sentence('Settings, under Document, holds Import, Export and this page\'s version history.', ['role-guide', 'support-none', 'topic-tools'], 'A pointer to the Settings page.'),
      sentence('More to read: [a sample that uses every part](' + SITE + 'references/sample-reading.html), [a history of document structure](' + SITE + 'references/document-structure-reading.html), and [an essay on outliners](' + SITE + 'references/outliners-reading.html).', ['role-guide', 'support-none', 'topic-tools'], 'Links to the other examples on this site.'),
    ]),
    paragraph('tc-p-agents', 'Writing with agents', [
      sentence('An AI agent can write these documents too, if it copies every quote rather than recalling it.', ['role-interpretation', 'support-quoted', 'topic-tools'], 'The guide states the rule; the condition is our summary.', [['src-agents', 1]]),
      sentence('Point it at [llms.txt](' + SITE + 'llms.txt) and the [source on GitHub](https://github.com/prajwalsouza/TraceCite).', ['role-guide', 'support-none', 'topic-tools'], 'Pointers.'),
    ]),
  ]),
  section('tc-limits', 'What it does not do', [
    paragraph('tc-p-limits', 'Limits', [
      sentence('Opening a sentence shows where it came from; it cannot tell you that the source is right.', ['role-limit', 'support-quoted', 'topic-evidence'], 'The README says exactly this.', [['src-readme', 2]]),
      sentence('A quote is only as good as the check behind it, so every record says how far it was checked, and an unchecked one says so.', ['role-limit', 'support-none', 'topic-evidence'], 'Describes the format\'s record status; open any source above.'),
    ]),
  ]),
];

// The interactive counts this page: sentences, and those whose citations reach a quote that is not withheld or missing.
const all = []; (function w(list) { for (const b of list) { if (b.type === 'sentence') all.push(b); w(b.children || []); } })(blocks);
const checked = all.filter((s) => (s.children || []).some((c) => c.type === 'citation'));
const fig = blocks.find((b) => b.id === 'tc-count').children.find((b) => b.id === 'tc-fig');
fig.fields.push({ key: 'Interactive settings', value: JSON.stringify({ n: all.length, q: checked.length }) });

const tagTree = [
  { id: 'role', name: 'Sentence role', children: [
    { id: 'role-guide', name: 'Guide to this page', children: [] },
    { id: 'role-mechanism', name: 'How it works', children: [] },
    { id: 'role-history', name: 'History', children: [] },
    { id: 'role-definition', name: 'Definition', children: [] },
    { id: 'role-interpretation', name: 'Our interpretation', children: [] },
    { id: 'role-limit', name: 'Limit', children: [] },
  ] },
  { id: 'support', name: 'Support', children: [
    { id: 'support-quoted', name: 'Quoted from a checked source', children: [] },
    { id: 'support-none', name: 'No source needed', children: [] },
  ] },
  { id: 'topic', name: 'Topic', children: [
    { id: 'topic-evidence', name: 'Evidence', children: [] },
    { id: 'topic-history', name: 'History', children: [] },
    { id: 'topic-structure', name: 'Structure', children: [] },
    { id: 'topic-tools', name: 'Tools', children: [] },
  ] },
  { id: 'connected', name: 'Connected highlights', children: [
    { id: 'hl-claim', name: 'the claim', slot: 1, children: [] },
    { id: 'hl-words', name: 'the exact words', slot: 2, children: [] },
    { id: 'hl-passage', name: 'the passage', slot: 3, children: [] },
    { id: 'hl-n', name: 'n, the sentences', slot: 4, symbols: ['n'], children: [] },
    { id: 'hl-q', name: 'q, the checked ones', slot: 5, symbols: ['q'], children: [] },
  ] },
  { id: 'caption', name: 'Caption', children: [] },
];

const doc = {
  format: 'tracecite/1.0', version: 2, id: 'tracecite-showcase',
  eyebrow: 'TraceCite', title: 'Every sentence opens',
  subtitle: 'A document about TraceCite, written in TraceCite. Click any sentence to see what it rests on.',
  authors: [{ name: 'Prajwal DSouza' }], date: '2026-11-25', license: 'MIT (software) · quoted passages keep their own licences',
  keywords: ['evidence', 'citation', 'outliner', 'reading'],
  updatedAt: '2026-11-25T00:00:00.000Z',
  interactiveScripts: ['checked-share.js'],
  tagTree, blocks, sources,
};
await writeFile(join(here, 'tracecite.trace.json'), JSON.stringify(doc, null, 2) + '\n');
console.log(`Wrote examples/tracecite/tracecite.trace.json (${all.length} sentences, ${checked.length} with checked sources, ${sources.length} sources).`);
