// Mathematical environments as outline blocks: theorem, lemma, proposition, corollary, definition, remark,
// example, conjecture, claim, assumption and proof.
//
// The tag is the schema. A paragraph tagged env-lemma IS a lemma: the tag decides how it renders and which
// fields it reads:
//   tags:   ["env-lemma"]                 (env-theorem, env-proposition, env-corollary, env-definition,
//                                          env-remark, env-example, env-conjecture, env-claim,
//                                          env-assumption, env-proof)
//   fields: "Label": "7.4"                its number (optional for proofs)
//           "Name":  "a worked example"   optional; for proofs, e.g. "of the upper bound"
// Its sentences are the statement (or the proof's steps); notes, citations and comments hang off them as usual.
// The tag family "Mathematical structure" (id env) is added to the tag tree automatically when a document uses
// these tags (ensureEnvironmentTags, run before validation), and Trace passes a paragraph's tags down to its
// sentences, so focusing Lemmas or Proofs in the tag tree works with no extra tagging.
// Subsections are nested section blocks ("Heading level": 3, 4, …), so a document reads
//   section → subsection → lemma → its sentences → their evidence.
//
// The builder tags each sentence with its environment's kind (a "Mathematical structure" family: Theorems,
// Lemmas, …, Proofs), so the tag tree can focus on all proofs or all definitions, and writes an index the
// reading page uses (scripts/environments.js) to render run-in headings: **Lemma 2 (a worked example).**
// with the statement in italics, *Proof.* … with an end mark. Cross-references resolve to these blocks.

export const KINDS = {
  theorem: { name: 'Theorem', group: 'Theorems', italic: true },
  lemma: { name: 'Lemma', group: 'Lemmas', italic: true },
  proposition: { name: 'Proposition', group: 'Propositions', italic: true },
  corollary: { name: 'Corollary', group: 'Corollaries', italic: true },
  conjecture: { name: 'Conjecture', group: 'Conjectures', italic: true },
  claim: { name: 'Claim', group: 'Claims', italic: true },
  assumption: { name: 'Assumption', group: 'Assumptions', italic: true },
  definition: { name: 'Definition', group: 'Definitions', italic: false },
  remark: { name: 'Remark', group: 'Remarks', italic: false },
  example: { name: 'Example', group: 'Examples', italic: false },
  proof: { name: 'Proof', group: 'Proofs', italic: false },
};
const get = (b, k) => ((b.fields || []).find((f) => f.key === k)?.value || '').trim();

const kindOf = (b) => (b.tags || []).map((t) => t.match(/^env-([a-z]+)$/)?.[1]).find((k) => k && KINDS[k]);

// Make sure the "Mathematical structure" family exists for every env-* tag the document uses.
export function ensureEnvironmentTags(doc) {
  const used = new Set();
  (function walk(list) { for (const b of list || []) { for (const t of b.tags || []) { const k = t.match(/^env-([a-z]+)$/)?.[1]; if (k && KINDS[k]) used.add(k); } walk(b.children); } })(doc.blocks);
  if (!used.size) return 0;
  let fam = doc.tagTree.find((t) => t.id === 'env');
  if (!fam) { fam = { id: 'env', name: 'Mathematical structure', children: [] }; doc.tagTree.push(fam); }
  for (const k of Object.keys(KINDS)) if (used.has(k) && !fam.children.some((c) => c.id === 'env-' + k)) fam.children.push({ id: 'env-' + k, name: KINDS[k].group, children: [] });
  return used.size;
}

export function addEnvironments(trace) {
  const index = {};
  (function walk(list) {
    for (const b of list || []) {
      const env = kindOf(b);
      if (env) index[b.id] = { env, kind: KINDS[env].name, label: get(b, 'Label'), name: get(b, 'Name'), italic: KINDS[env].italic };
      walk(b.children);
    }
  })(trace.blocks);
  return Object.keys(index).length ? { index, count: Object.keys(index).length } : null;
}

// Turn a flat run of sentences into environment paragraphs, for generators that write results as
// "Lemma 2.1. …", "Proof. … (End of proof.)" sentences. Returns paragraph blocks; ordinary sentences
// between environments become untitled paragraphs.
export function splitEnvironments(sentences, makeId) {
  const START = /^(Theorem|Lemma|Proposition|Corollary|Conjecture|Claim|Assumption|Definition|Remark|Example)\s+(\d+(?:\.\d+)*)(?:\s*\(([^)]*)\))?\.\s+/;
  const PROOF = /^Proof(?:\s+(of [^.]+?|for [^.]+?))?(?:,\s*(step \d+))?\.\s+/i;
  const END = /\s*\(End of proof\.\)\s*$/;
  const out = [];
  let cur = null;
  const open = (env, fields) => { cur = { id: makeId(), type: 'paragraph', text: '', tags: env ? ['env-' + env] : [], collapsed: false, fields, children: [], env }; out.push(cur); };
  for (const s0 of sentences) {
    const s = { ...s0 };
    // Unnumbered remarks and examples ("Remark. …") are environments too.
    const u = s.text.match(/^(Remark|Example|Note)\.\s+/);
    if (u) { open(u[1] === 'Note' ? 'remark' : u[1].toLowerCase(), []); s.text = s.text.slice(u[0].length); cur.children.push(s); cur = { ...cur, closeAfterOne: true }; out[out.length - 1] = cur; continue; }
    const m = s.text.match(START), p = !m && s.text.match(PROOF);
    if (m) {
      open(m[1].toLowerCase(), [{ key: 'Label', value: m[2] }, ...(m[3] ? [{ key: 'Name', value: m[3] }] : [])]);
      s.text = s.text.slice(m[0].length); cur.children.push(s);
      cur = { ...cur, closeAfterOne: true }; out[out.length - 1] = cur;
      continue;
    }
    if (p) {
      open('proof', p[1] ? [{ key: 'Name', value: p[1] }] : []);
      s.text = s.text.slice(p[0].length);
      if (p[2]) s.text = p[2][0].toUpperCase() + p[2].slice(1) + '. ' + s.text;
    } else if (!cur || cur.closeAfterOne || cur.env !== 'proof') {
      if (!cur || cur.env || cur.closeAfterOne) open(null, []);
    }
    const ends = END.test(s.text);
    s.text = s.text.replace(END, '');
    cur.children.push(s);
    if (ends) cur = null;
  }
  return out.map(({ closeAfterOne, env, ...b }) => b);
}
