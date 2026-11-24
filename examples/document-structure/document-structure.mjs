#!/usr/bin/env node
// A demonstration paper in the trace data format: "From roll to block".
// A short history of how written documents came to carry their structure.
// Writes document-structure.trace.json next to this file. Build it with:
//   node ../../scripts/build-reading.mjs --data document-structure.trace.json --out ../../references/document-structure-reading.html
//
// Honesty rules used here, as in Trace:
// - every Exact quote was copied verbatim from a page fetched on 2026-11-24 and
//   checked as a substring of that page's text (see VERIFICATION.md);
// - sources whose text was not fetched carry no quote, and the sentences that
//   cite them are tagged support-reference, so the page shows them as unverified;
// - when a sentence draws on a fetched page beyond the recorded quote, the
//   citation says so in "Relation to this sentence";
// - interpretation is tagged role-interpretation and never attributed to a source.
import { writeFile, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const f = (fields) => Object.entries(fields).filter(([, v]) => v).map(([key, value]) => ({ key, value }));
const FETCHED = 'Fetched 2026-11-24 · quotes checked verbatim against the page text';
const REFONLY = 'Reference only · text not fetched for this paper · no passage checked';

const tagTree = [
  { id: 'role', name: 'Sentence role', children: [
    { id: 'role-definition', name: 'Definition', children: [] },
    { id: 'role-history', name: 'History', children: [] },
    { id: 'role-mechanism', name: 'How it works', children: [] },
    { id: 'role-interpretation', name: 'Our interpretation', children: [] },
    { id: 'role-limit', name: 'Limitation', children: [] },
  ] },
  { id: 'support', name: 'Support', children: [
    { id: 'support-quoted', name: 'Quoted from a fetched page', children: [] },
    { id: 'support-reference', name: 'Reference only, no quote', children: [] },
    { id: 'support-none', name: 'No source needed', children: [] },
  ] },
  { id: 'topic', name: 'Topic', children: [
    { id: 'topic-era', name: 'Era', children: [
      { id: 'topic-era-ancient', name: 'Antiquity and late antiquity', children: [] },
      { id: 'topic-era-medieval', name: 'Medieval manuscripts', children: [] },
      { id: 'topic-era-print', name: 'Early print', children: [] },
      { id: 'topic-era-modern', name: 'Journals and modern science', children: [] },
      { id: 'topic-era-digital', name: 'Computers and the web', children: [] },
    ] },
    { id: 'topic-device', name: 'Structural device', children: [
      { id: 'topic-device-form', name: 'Physical form', children: [] },
      { id: 'topic-device-navigation', name: 'Finding aids', children: [] },
      { id: 'topic-device-sections', name: 'Standard sections', children: [] },
      { id: 'topic-device-markup', name: 'Markup', children: [] },
      { id: 'topic-device-links', name: 'Links and outlines', children: [] },
      { id: 'topic-device-blocks', name: 'Blocks', children: [] },
      { id: 'topic-device-evidence', name: 'Citation and evidence', children: [] },
    ] },
  ] },
  // Content structure (see CODING.md): one leaf move per sentence, one group per paragraph and section.
  { id: 'move', name: 'Content structure', children: [
    { id: 'cs-framing', name: 'Framing', children: [
      { id: 'cs-orientation', name: 'Orientation', children: [] },
      { id: 'cs-signpost', name: 'Signpost', children: [] },
      { id: 'cs-definition', name: 'Definition', children: [] },
      { id: 'cs-question', name: 'Question', children: [] },
    ] },
    { id: 'cs-sourcing', name: 'Sourcing', children: [
      { id: 'cs-report', name: 'Report', children: [] },
      { id: 'cs-quotation', name: 'Quotation', children: [] },
      { id: 'cs-attribution', name: 'Attribution', children: [] },
    ] },
    { id: 'cs-argument', name: 'Argument', children: [
      { id: 'cs-claim', name: 'Claim', children: [] },
      { id: 'cs-evidence', name: 'Evidence', children: [] },
      { id: 'cs-example', name: 'Example', children: [] },
      { id: 'cs-reasoning', name: 'Reasoning', children: [] },
    ] },
    { id: 'cs-positioning', name: 'Positioning', children: [
      { id: 'cs-qualification', name: 'Qualification', children: [] },
      { id: 'cs-contrast', name: 'Contrast', children: [] },
      { id: 'cs-concession', name: 'Concession', children: [] },
    ] },
    { id: 'cs-closing', name: 'Closing', children: [
      { id: 'cs-conclusion', name: 'Conclusion', children: [] },
      { id: 'cs-recall', name: 'Recall', children: [] },
      { id: 'cs-implication', name: 'Implication', children: [] },
    ] },
  ] },
  { id: 'document-structure', name: 'Document structure', children: [
    { id: 'figure', name: '#figure', children: [] },
    { id: 'table', name: '#table', children: [] },
    { id: 'caption', name: '#caption', children: [] },
  ] },
];

// ---------------------------------------------------------------- sources
const src = (id, citation, year, reference, url, extra = {}) => ({ id, text: citation,
  fields: f({ 'APA citation': citation, 'First author': citation.split(/[ ,]/)[0], Year: year, 'APA reference': reference, URL: url, ...extra }) });

const sources = [
  src('src-ohogan', 'O’Hogan, 2015', '2015',
    'O’Hogan, C. (2015, June 15). The beginnings of the codex. Medieval manuscripts blog, British Library.',
    'https://www.bl.uk/stories/blogs/posts/the-beginnings-of-the-codex', {
      'Exact quote': 'By late antiquity, the majority of books were produced as codices, not very different from the books we still use today',
      'Quote location': 'Opening paragraph, third sentence',
      'Exact quote 2': 'it seems that early Christians had a clear preference for the codex form',
      'Quote location 2': 'Paragraph beginning “That last factor may come at first as a surprise”',
      'Record status': FETCHED }),
  src('src-princeton', 'Princeton University Library, n.d.', 'n.d.',
    'Princeton University Library. (n.d.). From papyrus scroll to codex. In Forms & function: The splendors of global book making [Online exhibition]. Digital PUL.',
    'https://dpul.princeton.edu/global-book-forms/feature/from-papyrus-scroll-to-codex', {
      'Exact quote': 'the scroll was superior to such alternatives as clay tablets, and remained central well into Roman times',
      'Quote location': 'Introductory text, second sentence',
      'Exact quote 2': 'Pages could be written on two sides, desired passages were easier to find, and they did not need frequent unrolling.',
      'Quote location 2': 'Introductory text, fifth sentence',
      'Record status': FETCHED }),
  src('src-johnson', 'Johnson, 2021', '2021',
    'Johnson, H. (2021, November 27). Monastic vs scholastic reading habits. Europeana.',
    'https://www.europeana.eu/en/blog/monastic-vs-scholastic-reading-habits', {
      'Exact quote': 'reading aids and methods had to be devised so that a person could find a specific place in a text easily',
      'Quote location': 'Paragraph beginning “In order to find the specific passage or quote”',
      'Exact quote 2': 'The Scholastic period also took the concept of ‘table of contents’ from Bible manuscripts and developed it into something like what we know today.',
      'Quote location 2': 'Paragraph beginning “The Scholastic period also took”, first sentence',
      'Record status': FETCHED }),
  src('src-parkes', 'Parkes, 1976', '1976',
    'Parkes, M. B. (1976). The influence of the concepts of ordinatio and compilatio on the development of the book. In J. J. G. Alexander & M. T. Gibson (Eds.), Medieval learning and literature: Essays presented to Richard William Hunt (pp. 115–141). Clarendon Press.',
    '', { 'Record status': REFONLY }),
  src('src-dabhoiwala', 'Dabhoiwala, 2023', '2023',
    'Dabhoiwala, F. (2023, June 22). Life is short. Indexes are necessary [Review of the book Index, a history of the, by D. Duncan]. The New York Review of Books.',
    'https://www.nybooks.com/articles/2023/06/22/life-is-short-indexes-are-necessary-dennis-duncan/', {
      'Exact quote': 'compiled an enormous subject index to the whole of the world’s knowledge',
      'Quote location': 'Paragraph beginning “The index was, in fact, part of an entire range”, sentence on Robert Grosseteste',
      'Exact quote 2': 'The first printed page number was not produced until 1470; even by 1500 only a small minority of books had adopted the practice.',
      'Quote location 2': 'Paragraph beginning “Soon enough, medieval readers were making their own indexes”',
      'Record status': FETCHED }),
  src('src-caius', 'Gonville & Caius College Library, n.d.', 'n.d.',
    'Gonville & Caius College Library. (n.d.). Title pages. In Print and the material book [Online exhibition]. Gonville & Caius College, University of Cambridge.',
    'https://cai.cam.ac.uk/discover/library/online-exhibitions/print-and-material-book/title-pages', {
      'Exact quote': 'The title page is a device of the printed era, stimulated by practical necessity, by the growth of the book-trade as an industry',
      'Quote location': 'Title pages · first sentence',
      'Exact quote 2': 'In the sixteenth century, the information in the colophon moved to what became the title page and the colophon itself disappeared',
      'Quote location 2': 'Title pages · paragraph beginning “In the sixteenth century”, first sentence',
      'Record status': FETCHED }),
  src('src-grafton', 'Grafton, 1997', '1997',
    'Grafton, A. (1997). The footnote: A curious history. Harvard University Press.',
    '', { 'Record status': REFONLY }),
  src('src-royalsociety', 'Royal Society, n.d.', 'n.d.',
    'Royal Society. (n.d.). History of Philosophical Transactions. Royal Society.',
    'https://royalsociety.org/journals/publishing-activities/publishing350/history-philosophical-transactions/', {
      'Exact quote': 'Philosophical Transactions is the world’s first and longest-running scientific journal.',
      'Quote location': 'Foundation, early tribulations, and success · first sentence',
      'Exact quote 2': 'It was launched in March 1665 by Henry Oldenburg',
      'Quote location 2': 'Foundation, early tribulations, and success · second sentence',
      'Record status': FETCHED }),
  src('src-sollaci', 'Sollaci & Pereira, 2004', '2004',
    'Sollaci, L. B., & Pereira, M. G. (2004). The introduction, methods, results, and discussion (IMRAD) structure: A fifty-year survey. Journal of the Medical Library Association, 92(3), 364–371.',
    'https://pmc.ncbi.nlm.nih.gov/articles/PMC442179/', {
      'Exact quote': 'evolved from the letter form and purely descriptive style in the seventeenth century',
      'Quote location': 'Abstract · Background',
      'Exact quote 2': 'In the 1970s, it reached 80% and, in the 1980s, was the only pattern adopted in original papers.',
      'Quote location 2': 'Abstract · Results',
      'Record status': FETCHED }),
  src('src-coombs', 'Coombs et al., 1987', '1987',
    'Coombs, J. H., Renear, A. H., & DeRose, S. J. (1987). Markup systems and the future of scholarly text processing. Communications of the ACM, 30(11), 933–947.',
    'https://xml.coverpages.org/coombs.html', {
      'Exact quote': 'major improvements in each can be made by converting to descriptive markup',
      'Quote location': 'Opening section, paragraph beginning “Although there is no simple solution” (online reproduction at xml.coverpages.org)',
      'Exact quote 2': 'Whenever an author writes anything, he or she "marks it up."',
      'Quote location 2': 'Markup Theory · first sentence (online reproduction at xml.coverpages.org)',
      'Record status': FETCHED + ' · from an online reproduction, not the journal PDF' }),
  src('src-iso8879', 'ISO, 1986', '1986',
    'International Organization for Standardization. (1986). Information processing — Text and office systems — Standard Generalized Markup Language (SGML) (ISO Standard No. 8879:1986).',
    'https://www.iso.org/standard/16387.html', { 'Record status': REFONLY + ' · the ISO page refused automated access' }),
  src('src-html401', 'Raggett et al., 1999', '1999',
    'Raggett, D., Le Hors, A., & Jacobs, I. (Eds.). (1999). HTML 4.01 specification (W3C Recommendation). World Wide Web Consortium.',
    'https://www.w3.org/TR/html401/intro/intro.html', {
      'Exact quote': 'HTML has its roots in SGML which has always been a language for the specification of structural markup.',
      'Quote location': '2.4.1 Separate structure and presentation · first sentence',
      'Exact quote 2': 'Experience has shown that separating the structure of a document from its presentational aspects reduces the cost of serving a wide range of platforms',
      'Quote location 2': '2.4.1 Separate structure and presentation · third sentence',
      'Record status': FETCHED }),
  src('src-xml', 'Bray et al., 2008', '2008',
    'Bray, T., Paoli, J., Sperberg-McQueen, C. M., Maler, E., & Yergeau, F. (Eds.). (2008). Extensible Markup Language (XML) 1.0 (5th ed., W3C Recommendation). World Wide Web Consortium.',
    'https://www.w3.org/TR/xml/', {
      'Exact quote': 'XML is an application profile or restricted form of SGML, the Standard Generalized Markup Language',
      'Quote location': '1 Introduction · first paragraph, second sentence',
      'Record status': FETCHED }),
  src('src-tei', 'TEI Consortium, 2026', '2026',
    'TEI Consortium. (2026). About these Guidelines. In TEI P5: Guidelines for electronic text encoding and interchange (Version 4.12.0). Text Encoding Initiative Consortium.',
    'https://tei-c.org/release/doc/tei-p5-doc/en/html/AB.html', {
      'Exact quote': 'without them a digitized text appears to be nothing but a sequence of undifferentiated bits',
      'Quote location': 'iv. About These Guidelines · paragraph beginning “They make recommendations”',
      'Exact quote 2': 'which was held at Vassar College in November 1987',
      'Quote location 2': 'iv.2 Historical Background · first sentence',
      'Record status': FETCHED }),
  src('src-bush', 'Bush, 1945', '1945',
    'Bush, V. (1945, July). As we may think. The Atlantic Monthly, 176(1), 101–108.',
    'https://www.w3.org/History/1945/vbush/vbush-all.shtml', {
      'Exact quote': 'Our ineptitude in getting at the record is largely caused by the artificiality of systems of indexing.',
      'Quote location': 'Part 6 · first paragraph (W3C-hosted HTML reproduction; The Atlantic page refused automated access)',
      'Exact quote 2': 'Wholly new forms of encyclopedias will appear, ready-made with a mesh of associative trails running through them',
      'Quote location 2': 'Part 8 · first sentence (W3C-hosted HTML reproduction)',
      'Record status': FETCHED + ' · from a reproduction hosted by W3C' }),
  src('src-engelbart62', 'Engelbart, 1962', '1962',
    'Engelbart, D. C. (1962). Augmenting human intellect: A conceptual framework (Summary Report AFOSR-3223). Stanford Research Institute.',
    'https://www.dougengelbart.org/content/view/138/', {
      'Exact quote': 'trial drafts could rapidly be composed from re-arranged excerpts of old drafts',
      'Quote location': 'II. Conceptual Framework · A. General · paragraph 2a20',
      'Exact quote 2': 'A given structure of concepts can be represented by any of an infinite number of different symbol structures',
      'Quote location 2': '4) Symbol Structuring · paragraph 2c5c4a',
      'Record status': FETCHED + ' · from the Doug Engelbart Institute web edition' }),
  src('src-engelbart68', 'Engelbart & English, 1968', '1968',
    'Engelbart, D. C., & English, W. K. (1968). A research center for augmenting human intellect. In AFIPS Conference Proceedings, Vol. 33: 1968 Fall Joint Computer Conference (pp. 395–410). Thompson Book Company.',
    'https://www.dougengelbart.org/content/view/140/', {
      'Exact quote': 'The principal manifestation of this hierarchical structure is the breaking up of text into arbitrary segments called "statements,"',
      'Quote location': 'Structure of Files · paragraph 3c2b1',
      'Exact quote 2': 'the number is vulnerable to subsequent structural change, whereas the name stays with the statement through changes in the structure around it',
      'Quote location 2': 'Structure of Files · paragraph 3c2c',
      'Record status': FETCHED + ' · from the Doug Engelbart Institute web edition' }),
  src('src-nelson', 'Nelson, 1965', '1965',
    'Nelson, T. H. (1965). Complex information processing: A file structure for the complex, the changing and the indeterminate. In Proceedings of the 1965 20th National Conference of the ACM (pp. 84–100). Association for Computing Machinery. https://doi.org/10.1145/800197.806036',
    'https://doi.org/10.1145/800197.806036', { 'Record status': REFONLY }),
  src('src-bernerslee', 'Berners-Lee, 1989', '1989',
    'Berners-Lee, T. (1989). Information management: A proposal. CERN.',
    'https://www.w3.org/History/1989/proposal.html', {
      'Exact quote': 'This is why a "web" of notes with links (like references) between them is far more useful than a fixed hierarchical system.',
      'Quote location': 'Linked information systems · first paragraph',
      'Exact quote 2': 'A tree has the practical advantage of giving every node a unique name. However, it does not allow the system to model the real world.',
      'Quote location 2': 'The problem with trees · first paragraph',
      'Record status': FETCHED }),
  src('src-notion', 'Teton-Landis, 2021', '2021',
    'Teton-Landis, J. (2021, May 18). The data model behind Notion’s flexibility. Notion Blog.',
    'https://www.notion.com/blog/data-model-behind-notion', {
      'Exact quote': 'Everything you see in Notion is a block.',
      'Quote location': 'Paragraph beginning “Everything you see in Notion is a block.”, first sentence',
      'Exact quote 2': 'dynamic units of information that can be transformed into other block types or moved freely within Notion',
      'Quote location 2': 'Same paragraph, second sentence',
      'Record status': FETCHED }),
].map((s) => ({ ...s, type: 'source', tags: [], collapsed: true, children: [] }));

// Trace's rule: every quote carries its context. Passages are reproduced only where the page's licence allows
// (W3C Document License; TEI Guidelines under a Creative Commons Attribution licence), extracted with
// scripts/contexts-from-files.mjs into document-structure.contexts.json and checked to contain each quote.
// Elsewhere the quote gets a note saying why its passage is not here, so the reader knows to open the source.
{
  const contexts = JSON.parse(await readFile(join(here, 'document-structure.contexts.json'), 'utf8'));
  const licence = { 'src-html401': 'Passage reproduced under the W3C Document License.', 'src-xml': 'Passage reproduced under the W3C Document License.', 'src-tei': 'Passage reproduced under the TEI Guidelines’ Creative Commons Attribution licence.' };
  for (const src of sources) {
    for (const f of [...src.fields]) {
      const m = f.key.match(/^Exact quote(?: (\d+))?$/); if (!m || !f.value) continue;
      const n = m[1] || '1', sfx = m[1] ? ' ' + m[1] : '', c = contexts[`${src.id}|${n}`];
      if (c) {
        if (!c.context.includes(f.value)) throw new Error('context does not contain its quote: ' + src.id + ' ' + n);
        src.fields.push({ key: 'Quote context' + sfx, value: c.context }, { key: `Quote note${sfx}.1`, value: licence[src.id] });
      } else {
        src.fields.push({ key: 'Quote context withheld' + sfx, value: 'the page is under copyright; open the source to read the quote in its passage.' });
      }
    }
  }
}

const quoteOf = (sourceId, k = 1) => {
  const s = sources.find((x) => x.id === sourceId);
  if (!s) throw new Error('Unknown source ' + sourceId);
  return s.fields.find((x) => x.key === (k === 1 ? 'Exact quote' : `Exact quote ${k}`))?.value || '';
};

// ---------------------------------------------------------------- blocks
let n = 0;
const csRoot = tagTree.find((t) => t.id === 'move');
const CS_GROUPS = new Set(csRoot.children.map((g) => g.id));
const CS_MOVES = new Set(csRoot.children.flatMap((g) => g.children.map((m) => m.id)));
const needGroup = (id, group) => { if (!CS_GROUPS.has(group)) throw new Error(`${id} needs one content-structure group, got ${group}`); return group; };
// A sentence: text, tags, a short review, and its citations.
// Each citation is [sourceId, quoteNumber (1, 2 or 0 for none), relation note].
function sentence(text, tags, review, cites = []) {
  const id = 'ds-s' + ++n;
  if (tags.filter((t) => t.startsWith('cs-')).length !== 1 || !tags.some((t) => CS_MOVES.has(t))) throw new Error(`${id} needs exactly one content-structure move (a cs- leaf)`);
  if (tags.includes('support-quoted') && !cites.some(([, k]) => k)) throw new Error(`${id} is tagged quoted but has no quote`);
  return { id, type: 'sentence', text, tags, collapsed: true,
    fields: f({ 'Sentence review': review, Status: tags.includes('support-reference') ? 'Reference only · check before relying on it' : '' }),
    children: cites.map(([sourceId, k = 0, relation = ''], i) => {
      const source = sources.find((s) => s.id === sourceId);
      if (!source) throw new Error('Unknown source ' + sourceId);
      const quote = k ? quoteOf(sourceId, k) : '';
      if (k && !quote) throw new Error(`${id}: ${sourceId} has no quote ${k}`);
      return { id: `${id}-c${i}`, type: 'citation', text: source.text, tags: [], collapsed: true,
        fields: f({ 'Source ID': sourceId, 'Relation to this sentence': relation }),
        children: [{ id: `${id}-c${i}-r`, type: 'reference', text: 'Exact reference', tags: [], collapsed: true,
          fields: f({ 'Source ID': sourceId, 'Exact supporting extract': quote }), children: [] }] };
    }) };
}
// group: the paragraph's overall job, one of the five content-structure groups.
const paragraph = (id, title, group, sentences, tags = []) => ({ id, type: 'paragraph', text: title, tags: [...tags, needGroup(id, group)], collapsed: false,
  fields: f({ 'Source file': 'examples/document-structure/document-structure.mjs' }), children: sentences });
const section = (id, title, group, children) => ({ id, type: 'section', text: title, tags: ['topic', needGroup(id, group)], collapsed: false, fields: f({ 'Heading level': '2' }), children });
const caption = (id, group, sentences) => paragraph(id, 'Caption', group, sentences, ['caption']);
const figure = (id, title, asset, alt, description, captionGroup, captionSentences) => ({ id, type: 'figure', text: title, tags: ['figure'], collapsed: false,
  fields: f({ Assets: JSON.stringify([asset]), 'Panel labels': alt, 'Figure description': description,
    'Figure status': 'Schematic drawn for this paper; not reproduced from any source' }),
  children: [caption(id + '-caption', captionGroup, captionSentences)] });

function table(id, title, header, rows, captionGroup, captionSentences) {
  const cell = (rowId, text, j) => ({ id: `${rowId}-cell${j + 1}`, type: 'table-cell', text, tags: [], collapsed: false, fields: [], children: [] });
  const headerId = `${id}-header`;
  return { id, type: 'table', text: title, tags: ['table'], collapsed: false,
    fields: f({ 'Table status': 'Summary compiled for this paper from the sources cited in the text' }),
    children: [
      { id: headerId, type: 'table-row', text: 'Header', tags: [], collapsed: false, fields: f({ 'Table header': 'yes' }), children: header.map((h, j) => cell(headerId, h, j)) },
      ...rows.map(([cells, basis], i) => {
        const rowId = `${id}-row${i + 1}`;
        return { id: rowId, type: 'table-row', text: 'Row', tags: [], collapsed: true,
          fields: f({ 'Table header': 'no', 'Row basis': basis }), children: cells.map((c, j) => cell(rowId, c, j)) };
      }),
      caption(id + '-caption', captionGroup, captionSentences),
    ] };
}

const Q = 'support-quoted', R = 'support-reference', N = 'support-none';
// Content structure (see CODING.md): exactly one leaf move per sentence, its main function in context.
const cO = 'cs-orientation', cS = 'cs-signpost', cD = 'cs-definition', cQ = 'cs-question',
  cR = 'cs-report', cQu = 'cs-quotation', cA = 'cs-attribution',
  cC = 'cs-claim', cE = 'cs-evidence', cX = 'cs-example', cW = 'cs-reasoning',
  cH = 'cs-qualification', cT = 'cs-contrast', cN = 'cs-concession',
  cK = 'cs-conclusion', cRc = 'cs-recall', cI = 'cs-implication';
// Content-structure groups, for paragraphs and sections: their overall job.
const gF = 'cs-framing', gS = 'cs-sourcing', gA = 'cs-argument', gP = 'cs-positioning', gC = 'cs-closing';
const DEF = 'role-definition', HIS = 'role-history', MEC = 'role-mechanism', INT = 'role-interpretation', LIM = 'role-limit';

const blocks = [
  section('sec-intro', 'Introduction', gF, [
    paragraph('p-intro-1', 'What structure means here', gF, [
      sentence('By the structure of a document we mean the devices that tell a reader what each part is and where to find it: the form of the object, its divisions, its finding aids and its links.',
        [DEF, N, 'topic-device-navigation', cD], 'A working definition for this paper, not a claim from a source.'),
      sentence('This paper follows those devices from the papyrus roll to the block editor in eight short steps.',
        [MEC, N, 'topic-device-form', cS], 'Describes the plan of the paper.'),
      sentence('It is written in the format it describes, so any sentence can be opened to show its role, its support and, where one was checked, the exact passage behind it.',
        [MEC, N, 'topic-device-evidence', cS], 'Describes this page. Open the sentence to see the behaviour it describes.'),
      sentence('The history is told briefly and from secondary sources, so it is an orientation rather than original research.',
        [LIM, N, cH], 'A limitation stated by the author of this demonstration.'),
    ]),
    figure('fig-timeline', 'Figure 1', 'figures/timeline.svg', 'Timeline from the roll to the block editor',
      'A horizontal timeline with eight stops: roll, codex, rubrics and tables, title page and page numbers, journal and IMRaD, markup, hypertext, blocks.', gF, [
        sentence('Figure 1. Eight steps in the history of document structure, from the roll to the block editor.',
          [MEC, N, 'topic-device-form', cO], 'A caption describing a figure drawn for this paper.'),
        sentence('Dates on the figure are those given by the sources cited in each section, and the spacing is not to scale.',
          [LIM, N, cH], 'States how the figure was made. Each date is supported in the section that discusses it.'),
      ]),
  ]),

  section('sec-codex', 'From roll to codex', gA, [
    paragraph('p-codex-1', 'The roll', gF, [
      sentence('The scroll was the first book form of the ancient world, and it remained the main form well into Roman times.',
        [HIS, Q, 'topic-era-ancient', 'topic-device-form', cO], 'The Princeton exhibition text states both points.', [['src-princeton', 1, 'The first half of the sentence paraphrases the exhibition’s opening sentence; the quote supports the second half.']]),
      sentence('A roll is read in one direction, so reaching a passage in the middle means winding through everything before it.',
        [INT, N, 'topic-era-ancient', 'topic-device-navigation', cQ], 'Our interpretation of what a roll implies for finding a passage. Compare the Princeton text on unrolling, cited in the next paragraph.'),
    ]),
    paragraph('p-codex-2', 'The codex', gA, [
      sentence('Over the first centuries AD the codex, a stack of leaves bound at one side, took the place of the roll, and by late antiquity most books were made this way.',
        [HIS, Q, 'topic-era-ancient', 'topic-device-form', cE], 'The British Library post states the late-antique majority directly.', [['src-ohogan', 1]]),
      sentence('A codex could be written on both sides of each leaf, and a reader could reach a chosen passage without unrolling.',
        [MEC, Q, 'topic-era-ancient', 'topic-device-form', 'topic-device-navigation', cE], 'The Princeton exhibition states this directly.', [['src-princeton', 2]]),
      sentence('Early Christians seem to have preferred the codex, but why the change happened is still debated, and most of the surviving evidence comes from Egypt.',
        [HIS, LIM, Q, 'topic-era-ancient', cH], 'The quote supports the preference. The same post calls the reasons an open question and warns about the Egyptian bias of the evidence; those parts are paraphrased.', [['src-ohogan', 2, 'The debate and the Egyptian evidence are paraphrased from the same post, not quoted.']]),
      sentence('Structurally, the codex was a first step from one long sequence toward a set of places a reader could turn to.',
        [INT, N, 'topic-device-form', 'topic-device-navigation', cK], 'Our interpretation, not a claim made by the sources.'),
    ]),
  ]),

  section('sec-medieval', 'The medieval page: rubrics, tables and indexes', gA, [
    paragraph('p-med-1', 'Reading for passages', gA, [
      sentence('In the thirteenth century, as universities grew, scholastic readers needed to find and cite passages from many books rather than memorise a few.',
        [HIS, Q, 'topic-era-medieval', 'topic-device-navigation', cO], 'The Europeana post describes this change from monastic to scholastic reading; the quote gives its consequence.', [['src-johnson', 1, 'The shift in reading habits is paraphrased from the post; the quote states the need it created.']]),
      sentence('Rubrics, short headings written in red ink, marked where parts of a text began, and tables of contents listed them.',
        [MEC, Q, 'topic-era-medieval', 'topic-device-navigation', cE], 'The quote supports the table of contents. The description of rubrics comes from the same post and is paraphrased.', [['src-johnson', 2, 'The red-ink description of rubrics is paraphrased from the same post.']]),
      sentence('Subject indexes appeared in the same period, and in Oxford Robert Grosseteste compiled one meant to cover all knowledge.',
        [HIS, Q, 'topic-era-medieval', 'topic-device-navigation', cX], 'The review of Duncan’s history of the index states this.', [['src-dabhoiwala', 1]]),
      sentence('Parkes described this new care for dividing and ordering texts through the medieval concepts of ordinatio and compilatio.',
        [HIS, R, 'topic-era-medieval', cA], 'A classic reference for this period. Its text was not fetched for this paper, so the claim is not checked against a passage.', [['src-parkes']]),
    ]),
    paragraph('p-med-2', 'What the apparatus did', gC, [
      sentence('Together these devices made the codex navigable: rubrics named its parts, tables listed them and indexes mapped topics to places.',
        [INT, N, 'topic-device-navigation', cK], 'Our synthesis of the paragraph above.'),
      sentence('They are the ancestors of the headings, contents lists and search boxes that a digital outliner offers.',
        [INT, N, 'topic-device-navigation', 'topic-device-blocks', cI], 'Our interpretation. No source makes this lineage claim.'),
    ]),
  ]),

  section('sec-print', 'Print: title pages, page numbers and notes', gA, [
    paragraph('p-print-1', 'Title pages', gS, [
      sentence('Early printed books named the work and its printer at the end, in a colophon, and in the sixteenth century that information moved to the title page.',
        [HIS, Q, 'topic-era-print', 'topic-device-navigation', cO], 'The Caius exhibition states the move from colophon to title page.', [['src-caius', 2]]),
      sentence('The Caius College exhibition presents the title page as a product of the book trade rather than of scholarship.',
        [HIS, Q, 'topic-era-print', cR], 'The quote ties the title page to practical necessity and the book trade; “rather than of scholarship” is our framing.', [['src-caius', 1]]),
    ]),
    paragraph('p-print-2', 'Page numbers and notes', gA, [
      sentence('Page numbers spread slowly: the first printed page number appeared in 1470, and by 1500 only a small minority of books used them.',
        [HIS, Q, 'topic-era-print', 'topic-device-navigation', cE], 'Stated directly in the review of Duncan’s book.', [['src-dabhoiwala', 2]]),
      sentence('Because printed copies were alike, a page number could point to the same place in every copy, which made it a shared address rather than a private one.',
        [MEC, Q, 'topic-era-print', 'topic-device-navigation', cW], 'The review makes this point just before the quoted sentence; it is paraphrased here.', [['src-dabhoiwala', 2, 'Paraphrased from the sentence before the quote, in the same paragraph.']]),
      sentence('The footnote grew into the scholar’s standard way of showing sources, a history traced by Grafton.',
        [HIS, R, 'topic-era-print', 'topic-device-evidence', cA], 'Grafton’s book was not fetched, so this is a reference only.', [['src-grafton']]),
      sentence('Print thus fixed a shared set of addresses, title, page and note, that later citation systems would rely on.',
        [INT, N, 'topic-era-print', 'topic-device-evidence', cK], 'Our interpretation of the section.'),
    ]),
  ]),

  section('sec-article', 'The scientific article and IMRaD', gA, [
    paragraph('p-art-1', 'The journal', gS, [
      sentence('The Royal Society describes Philosophical Transactions as the first and longest-running scientific journal.',
        [HIS, Q, 'topic-era-modern', 'topic-device-sections', cR], 'The Royal Society’s own page; the claim is the publisher’s.', [['src-royalsociety', 1]]),
      sentence('It was launched in March 1665 by Henry Oldenburg, the Society’s first Secretary.',
        [HIS, Q, 'topic-era-modern', cE], 'Stated on the same page.', [['src-royalsociety', 2, 'The role of Secretary is given in the same sentence of the source.']]),
    ]),
    paragraph('p-art-2', 'IMRaD', gA, [
      sentence('Scientific articles evolved from letters and descriptive reports toward a fixed order of introduction, methods, results and discussion, known as IMRaD.',
        [HIS, Q, 'topic-era-modern', 'topic-device-sections', cO], 'The abstract of Sollaci and Pereira states this.', [['src-sollaci', 1]]),
      sentence('In four leading medical journals, IMRaD reached 80 percent of articles in the 1970s and was the only pattern for original papers in the 1980s.',
        [HIS, Q, 'topic-era-modern', 'topic-device-sections', cE], 'The figures are quoted from the abstract’s results. The journals are named in its methods.', [['src-sollaci', 2]]),
      sentence('The authors link the adoption partly to the influence of other disciplines and to editors’ recommendations.',
        [HIS, Q, 'topic-era-modern', cR], 'Paraphrased from the conclusions of the same abstract; the recorded quote is the adoption figures this sentence explains.', [['src-sollaci', 2, 'Paraphrased from the abstract’s Conclusions; the quote shown is from its Results.']]),
      sentence('Because the study sampled internal medicine journals only, its figures describe medical writing, not science as a whole.',
        [LIM, Q, 'topic-era-modern', cH], 'A limitation drawn from the study’s own sample, named in its methods.', [['src-sollaci', 2, 'The sample of four internal medicine journals is given in the abstract’s Methods.']]),
      sentence('A fixed order lets a reader know where the methods or the result will be before reading a word, which is a structural promise rather than a typographic one.',
        [INT, N, 'topic-device-sections', cC], 'Our interpretation of why IMRaD matters for structure.'),
    ]),
  ]),

  section('sec-markup', 'Markup: naming structure apart from appearance', gS, [
    paragraph('p-mark-1', 'Descriptive markup', gS, [
      sentence('Coombs, Renear and DeRose argued that all writing is already marked up, because spaces, commas and full stops mark boundaries.',
        [HIS, DEF, Q, 'topic-era-digital', 'topic-device-markup', cR], 'Quoted from the opening of the Markup Theory section; the examples follow it in the source.', [['src-coombs', 2]]),
      sentence('They recommended descriptive markup, which names what a part is rather than how it should look, as the remedy for the problems of word processing for scholars.',
        [HIS, Q, 'topic-era-digital', 'topic-device-markup', cR], 'The quote states the recommendation. The gloss of descriptive markup is ours.', [['src-coombs', 1]]),
      sentence('The Standard Generalized Markup Language was published as the international standard ISO 8879 in 1986.',
        [HIS, R, 'topic-era-digital', 'topic-device-markup', cE], 'The standard’s number and year are in its reference. Its text was not fetched; the ISO page refused automated access.', [['src-iso8879']]),
    ]),
    paragraph('p-mark-2', 'HTML, XML and TEI', gS, [
      sentence('The HTML 4.01 specification traces HTML to SGML and calls SGML a language for structural markup.',
        [HIS, Q, 'topic-era-digital', 'topic-device-markup', cR], 'Stated directly in section 2.4.1.', [['src-html401', 1]]),
      sentence('The same section argues that separating structure from presentation lowers the cost of serving many platforms.',
        [MEC, Q, 'topic-era-digital', 'topic-device-markup', cR], 'Stated directly in section 2.4.1.', [['src-html401', 2]]),
      sentence('XML was defined as a restricted form of SGML, so XML documents are also conforming SGML documents.',
        [DEF, Q, 'topic-era-digital', 'topic-device-markup', cD], 'The quote gives the first half; the specification states the second half in the next sentence.', [['src-xml', 1, 'The second half paraphrases the sentence that follows the quote.']]),
      sentence('The Text Encoding Initiative grew out of a planning conference held at Vassar College in November 1987.',
        [HIS, Q, 'topic-era-digital', 'topic-device-markup', cE], 'Stated in the Historical Background of the TEI Guidelines.', [['src-tei', 2]]),
      sentence('Its Guidelines explain that without explicit markers a digitized text is, to a program, only a run of undifferentiated bits.',
        [MEC, Q, 'topic-era-digital', 'topic-device-markup', cQu], 'Paraphrase of the quoted clause.', [['src-tei', 1]]),
      sentence('Markup made the medieval finding aids explicit: a heading is no longer red ink but a declared element that any program can find.',
        [INT, N, 'topic-device-markup', 'topic-device-navigation', cRc], 'Our interpretation connecting this section to the medieval one.'),
    ]),
    figure('fig-separation', 'Figure 2', 'figures/structure-presentation.svg', 'One declared structure rendered three ways',
      'A marked-up source on the left, with arrows to a screen page, a printed page and speech.', gA, [
        sentence('Figure 2. One declared structure can be presented on screen, in print or as speech by applying different style rules.',
          [MEC, Q, 'topic-device-markup', cX], 'Illustrates the principle stated in HTML 4.01 section 2.4.1.', [['src-html401', 2]]),
        sentence('The element names are schematic and follow common HTML and TEI usage.',
          [LIM, N, 'topic-device-markup', cH], 'States how the figure was drawn.'),
      ]),
  ]),

  section('sec-hypertext', 'Hypertext and the outline', gS, [
    paragraph('p-hyp-1', 'Bush and the memex', gS, [
      sentence('In 1945 Vannevar Bush blamed the difficulty of finding records on the artificiality of indexing systems.',
        [HIS, Q, 'topic-era-digital', 'topic-device-links', cR], 'Stated directly in part 6 of the essay.', [['src-bush', 1]]),
      sentence('He proposed selection by association instead, and imagined encyclopedias threaded with associative trails.',
        [HIS, Q, 'topic-era-digital', 'topic-device-links', cR], 'The quote supports the encyclopedias; “selection by association” is a phrase from part 6 of the essay.', [['src-bush', 2, 'Selection by association is named in part 6 of the essay, paraphrased here.']]),
    ]),
    paragraph('p-hyp-2', 'Engelbart and Nelson', gS, [
      sentence('Douglas Engelbart imagined writing in which trial drafts are assembled from rearranged excerpts of old ones.',
        [HIS, Q, 'topic-era-digital', 'topic-device-blocks', cR], 'Stated directly in the 1962 report.', [['src-engelbart62', 1]]),
      sentence('His report also held that one structure of concepts can be shown through many different symbol structures.',
        [HIS, Q, 'topic-era-digital', 'topic-device-links', cR], 'Stated directly in the 1962 report.', [['src-engelbart62', 2]]),
      sentence('By 1968 his group broke text into numbered statements, each with a place in an outline.',
        [HIS, Q, 'topic-era-digital', 'topic-device-links', 'topic-device-blocks', cE], 'The quote names the statements; the numbers and outline levels are described in the rest of the same sentence.', [['src-engelbart68', 1]]),
      sentence('They noted that a statement’s number changes when the structure around it changes, while its name stays with it.',
        [MEC, Q, 'topic-era-digital', 'topic-device-links', cR], 'Stated directly in paragraph 3c2c.', [['src-engelbart68', 2]]),
      sentence('Ted Nelson’s 1965 paper proposed a file structure for complex, changing and indeterminate information.',
        [HIS, R, 'topic-era-digital', 'topic-device-links', cR], 'Paraphrases the paper’s title. The text was not fetched, so nothing else is claimed.', [['src-nelson']]),
    ]),
    paragraph('p-hyp-3', 'Trees and webs', gP, [
      sentence('In his 1989 proposal at CERN, Tim Berners-Lee argued that a web of linked notes is more useful than a fixed hierarchy.',
        [HIS, Q, 'topic-era-digital', 'topic-device-links', cR], 'Stated directly in the proposal.', [['src-bernerslee', 1]]),
      sentence('He granted that a tree gives every node a unique name but said it cannot model the real world.',
        [HIS, Q, 'topic-era-digital', 'topic-device-links', cR], 'Stated directly under “The problem with trees”.', [['src-bernerslee', 2]]),
      sentence('Engelbart’s numbered statements and Berners-Lee’s links answer the same question differently: whether a document is first a tree or first a web.',
        [INT, N, 'topic-device-links', cT], 'Our interpretation comparing two cited sources. Engelbart’s group also allowed cross-references, so the contrast is one of emphasis.'),
    ]),
    figure('fig-shapes', 'Figure 3', 'figures/three-shapes.svg', 'Linear, hierarchical and networked structure',
      'Three panels: a chain, a tree and a network of units.', gF, [
        sentence('Figure 3. Three shapes a document can take: a line read in one order, a tree in which each part has one parent, and a network whose links cross branches.',
          [DEF, N, 'topic-device-links', cD], 'A caption for a schematic drawn for this paper.'),
      ]),
  ]),

  section('sec-blocks', 'Blocks and outliners today', gC, [
    paragraph('p-blk-1', 'Block editors', gA, [
      sentence('Block editors make every unit of a document a separate object; Notion’s engineering blog states that everything in the product is a block.',
        [MEC, Q, 'topic-era-digital', 'topic-device-blocks', cO], 'Stated directly in the blog post.', [['src-notion', 1]]),
      sentence('Blocks can be turned into other block types or moved freely, so a document becomes an arrangement rather than a fixed sequence.',
        [MEC, Q, 'topic-era-digital', 'topic-device-blocks', cC], 'The quote supports the first half; the second half is our interpretation.', [['src-notion', 2]]),
      sentence('The same post names Engelbart and Nelson among the pioneers of this view of the computer.',
        [HIS, Q, 'topic-era-digital', cR], 'The post’s opening sentence lists them; it is paraphrased here.', [['src-notion', 1, 'Paraphrased from the post’s opening sentence, which names Doug Engelbart, Ted Nelson and Alan Kay.']]),
    ]),
    paragraph('p-blk-2', 'Evidence outliners', gC, [
      sentence('An evidence outliner takes the block down to the sentence and attaches to each sentence its sources, the exact passage quoted and a judgement of its support.',
        [MEC, N, 'topic-device-blocks', 'topic-device-evidence', cD], 'Describes this page and the trace format it is built from.'),
      sentence('Read this way, it revives the medieval apparatus at a finer grain: the rubric becomes a tag, the index becomes a filter and the gloss becomes an opened sentence.',
        [INT, N, 'topic-device-navigation', 'topic-device-evidence', cRc], 'Our interpretation, connecting this section to the medieval one.'),
    ]),
    figure('fig-tree', 'Figure 4', 'figures/evidence-tree.svg', 'The hierarchy of this paper, from document to exact quote',
      'An indented tree from document to section, paragraph, sentence, citation and source with its quote.', gF, [
        sentence('Figure 4. The hierarchy behind this page: document, section, paragraph, sentence, citation, and a source with its exact quote and location.',
          [MEC, N, 'topic-device-evidence', 'topic-device-blocks', cO], 'Describes the trace format used for this paper.'),
        sentence('A sentence without a checked passage is shown as reference only or as interpretation, never as quoted.',
          [MEC, N, 'topic-device-evidence', cO], 'Describes the honesty rule applied in this paper.'),
      ]),
    table('tab-eras', 'Table 1', ['Era', 'Medium', 'Main structural device', 'Example'], [
      [['Antiquity', 'Papyrus or textile scroll', 'One continuous sequence', 'Egyptian Book of the Dead scroll, Princeton'], 'Princeton University Library, n.d.'],
      [['Late antiquity', 'Parchment or papyrus codex', 'Leaves bound at one side', 'Papyrus 745, an early Latin codex fragment'], 'O’Hogan, 2015'],
      [['13th century', 'Manuscript codex', 'Rubrics, tables of contents, subject indexes', 'Grosseteste’s subject index'], 'Johnson, 2021; Dabhoiwala, 2023'],
      [['15th–16th century', 'Printed book', 'Colophon, then title page; page numbers', 'Basel Bible of 1538 with a title page'], 'Gonville & Caius College Library, n.d.; Dabhoiwala, 2023'],
      [['From 1665', 'Scientific journal', 'Periodical issues of reports', 'Philosophical Transactions'], 'Royal Society, n.d.'],
      [['1940s–1980s', 'Medical journal article', 'IMRaD sections', 'BMJ, JAMA, The Lancet, NEJM'], 'Sollaci & Pereira, 2004'],
      [['1945–1989', 'Proposed and early hypertext systems', 'Trails, numbered statements, links', 'Memex, NLS, the CERN proposal'], 'Bush, 1945; Engelbart & English, 1968; Berners-Lee, 1989'],
      [['From 1986', 'SGML, HTML, XML, TEI', 'Declared elements, styled separately', 'HTML 4.01 specification'], 'ISO, 1986 (reference only); Raggett et al., 1999; Bray et al., 2008; TEI Consortium, 2026'],
      [['Today', 'Block editor', 'Every unit a movable block', 'Notion'], 'Teton-Landis, 2021'],
    ], gC, [
      sentence('Table 1. Structural devices by era, summarised from the sources cited in each section.',
        [MEC, N, 'topic-device-form', cK], 'A caption for a summary table compiled for this paper. Each row names its sources in the row’s fields.'),
      sentence('The rows simplify overlapping periods, and an era’s device rarely replaced the one before it.',
        [LIM, INT, N, cH], 'A caveat about the table, from the author of this demonstration.'),
    ]),
  ]),

  section('sec-limits', 'Limits and open questions', gP, [
    paragraph('p-lim-1', 'What this history leaves out', gP, [
      sentence('This is a selective, Western and Latin-script history; the East Asian and pothī book traditions, which the Princeton exhibition places beside the codex, are left out.',
        [LIM, Q, 'topic-era-ancient', cH], 'The exhibition’s sections name these traditions; the quote shown is from its codex section.', [['src-princeton', 1, 'The exhibition’s navigation lists “The East Asian tradition” and “The pothī tradition” beside “The codex tradition”.']]),
      sentence('Several dates here rest on a single secondary source, and the evidence for the earliest periods is thin and unevenly preserved.',
        [LIM, Q, 'topic-era-ancient', cH], 'The British Library post warns about the thinness and Egyptian bias of early evidence; the rest is our own caveat.', [['src-ohogan', 2, 'The caution about thin, Egypt-heavy evidence is paraphrased from the same post.']]),
    ]),
    paragraph('p-lim-2', 'What an outliner cannot settle', gP, [
      sentence('A tree imposes one way of dividing an argument, which is the objection Berners-Lee raised against hierarchical systems.',
        [LIM, Q, 'topic-device-links', cN], 'Connects the trade-off to the cited proposal.', [['src-bernerslee', 2]]),
      sentence('Attaching quotes to sentences shows where a claim comes from, but it does not show that the claim is true, and the judgement of support stays human.',
        [LIM, N, 'topic-device-evidence', cH], 'A limitation of the format itself.'),
      sentence('Whether sentence-level evidence helps readers judge a paper better is an open empirical question that this demonstration does not test.',
        [LIM, N, 'topic-device-evidence', cI], 'States what is not known. No study is cited because none was checked for this paper.'),
    ]),
  ]),
];

// Comments are outline blocks: a note with "Comment by", a child of what it is about; replies nest.
{
  const find = (prefix) => { const walk = (list) => { for (const b of list) { if (b.type === 'sentence' && b.text.startsWith(prefix)) return b; const r = walk(b.children || []); if (r) return r; } }; return walk(blocks); };
  const target = blocks.flatMap(function all(b) { return [b, ...(b.children || []).flatMap(all)]; }).find((b) => b.type === 'sentence' && /markup/i.test(b.text));
  if (target) target.children.push({ id: 'ds-comment-1', type: 'note', text: 'Is “structural markup” the same idea as the outline here, or only its ancestor?', tags: [], collapsed: true,
    fields: [{ key: 'Comment by', value: 'Example reader' }, { key: 'Commented on', value: '2026-11-24' }],
    children: [{ id: 'ds-comment-2', type: 'note', text: 'An ancestor: markup tags spans of text; an outline makes the tree itself the document.', tags: [], collapsed: true, fields: [{ key: 'Comment by', value: '' }], children: [] }] });
}

// Provenance on every part of the trace: who added each record and quote, how, and who checked it.
for (const src of sources) {
  src.fields.push({ key: 'Added by', value: 'AI agent (example author)' }, { key: 'Added via', value: 'web page' }, { key: 'Added on', value: '2026-11-24' });
  for (const f of [...src.fields]) {
    const m = f.key.match(/^Exact quote(?: (\d+))?$/); if (!m || !f.value) continue;
    const sfx = m[1] ? ' ' + m[1] : '';
    src.fields.push({ key: 'Quote added by' + sfx, value: 'AI agent (example author)' }, { key: 'Quote checked by' + sfx, value: 'script (verbatim check)' }, { key: 'Quote checked on' + sfx, value: '2026-11-24' });
  }
}

const doc = {
  format: 'tracecite/1.0', version: 2,
  eyebrow: 'A demonstration paper',
  title: 'From roll to block',
  subtitle: 'A short history of how written documents came to carry their structure, written as an evidence outline.',
  updatedAt: new Date().toISOString(),
  tagTree, blocks, sources,
};
await writeFile(join(here, 'document-structure.trace.json'), JSON.stringify(doc, null, 2));
const quoted = sources.filter((s) => s.fields.some((x) => x.key === 'Exact quote')).length;
const quoteCount = sources.reduce((a, s) => a + s.fields.filter((x) => /^Exact quote/.test(x.key)).length, 0);
console.log(`Wrote document-structure.trace.json: ${n} sentences, ${sources.length} sources (${quoted} with quotes, ${quoteCount} quotes; ${sources.length - quoted} reference only).`);
