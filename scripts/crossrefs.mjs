// Cross-references inside a document: "Theorem 4.1", "Lemmas 3.1 and 5.2", "Corollary 7.8", "Section 6.3",
// "Table 1", "Figure 2", "(3.1)".
//
// The builder finds where each label is stated:
//   - a sentence that starts with it ("Theorem 4.1. …", "Lemma 7.2 (Hermite bound). …"),
//   - an equation tag \tag{3.1} inside a sentence (referred to as "(3.1)" or "Equation 3.1"),
//   - a numbered heading ("6.3 A collar …", "8. The size of the energy"),
//   - a table or figure whose title starts "Table 1" or "Figure 2".
// It then tags every sentence that mentions a label, and writes an index the reading page uses to turn each
// mention into a link that scrolls to its target (scripts/crossref.js).
//
//   Cross-references
//     States a result         sentences that state a numbered result
//     Recalls a result        sentences that refer back to an earlier one
//     Points ahead            sentences that refer to a later one
//     Results                 one tag per result, grouped (Theorems, Lemmas, …, Equations, Sections, Tables, Figures)
//
// Options in the data: "crossRefs": { "off": true } leaves it out.
import { KINDS as ENV } from './environments.mjs';

const KINDS = ['Theorem', 'Lemma', 'Proposition', 'Corollary', 'Definition', 'Remark', 'Conjecture', 'Example', 'Claim', 'Assumption', 'Section', 'Table', 'Figure', 'Equation'];
const PLURAL = { Theorems: 'Theorem', Lemmas: 'Lemma', Propositions: 'Proposition', Corollaries: 'Corollary', Definitions: 'Definition', Remarks: 'Remark', Conjectures: 'Conjecture', Examples: 'Example', Claims: 'Claim', Assumptions: 'Assumption', Sections: 'Section', Tables: 'Table', Figures: 'Figure', Equations: 'Equation', Eq: 'Equation', 'Eq.': 'Equation', Sec: 'Section', 'Sec.': 'Section', Fig: 'Figure', 'Fig.': 'Figure', Thm: 'Theorem', 'Thm.': 'Theorem' };
const KIND_RE = '(Theorems?|Lemmas?|Propositions?|Corollar(?:y|ies)|Definitions?|Remarks?|Conjectures?|Examples?|Claims?|Assumptions?|Sections?|Tables?|Figures?|Equations?|Eq\\.|Sec\\.|Fig\\.|Thm\\.)';
const NUM = '\\d+(?:\\.\\d+)*';
export const MENTION = new RegExp(`\\b${KIND_RE}\\s+(${NUM}(?:\\([a-z]\\))?(?:(?:,\\s*|\\s+and\\s+|\\s*[–-]\\s*)${NUM}(?:\\([a-z]\\))?)*)`, 'g');
const EQREF = /(?<![\w\\])\((\d+\.\d+)\)/g;
const MATH = /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|(?<!\\)\$[^$\n]+?(?<!\\)\$/g;
const singular = (k) => PLURAL[k] || k;
const kindGroup = { Theorem: 'Theorems', Lemma: 'Lemmas', Proposition: 'Propositions', Corollary: 'Corollaries', Definition: 'Definitions', Remark: 'Remarks', Conjecture: 'Conjectures', Example: 'Examples', Claim: 'Claims', Assumption: 'Assumptions', Section: 'Sections', Table: 'Tables', Figure: 'Figures', Equation: 'Equations' };

// The labels a sentence mentions, outside its math. Returns [{ kind, num }].
export function mentions(text, eqLabels = new Set()) {
  const plain = String(text || '').replace(MATH, (m) => ' '.repeat(m.length));
  const out = [];
  for (const m of plain.matchAll(MENTION)) {
    const kind = singular(m[1].replace(/ies$/, 'y'));
    for (const n of m[2].matchAll(new RegExp(NUM, 'g'))) out.push({ kind: kind === 'Corollary' || KINDS.includes(kind) ? kind : singular(m[1]), num: n[0] });
  }
  for (const m of plain.matchAll(EQREF)) if (eqLabels.has(m[1])) out.push({ kind: 'Equation', num: m[1] });
  return out;
}

export function addCrossRefs(trace) {
  if (trace.crossRefs?.off) return null;
  const targets = new Map(); // "Theorem 4.1" → { id, kind, num, order }
  const order = new Map(), parentOf = new Map();
  let k = 0;
  const define = (kind, num, id) => { const key = `${kind} ${num}`; if (!targets.has(key)) targets.set(key, { id, kind, num, order: order.get(id) }); };
  (function walk(list) {
    for (const b of list || []) {
      order.set(b.id, k++);
      for (const c of b.children || []) parentOf.set(c.id, b.id);
      const text = String(b.text || '');
      if (b.type === 'sentence') {
        // A statement starts "Theorem 4.1." or "Lemma 7.2 (name)."; "Theorem 4.1:" in a summary is a mention.
        const m = text.match(new RegExp(`^(${KINDS.slice(0, 10).join('|')})\\s+(${NUM})(?=\\.\\s|\\.$|\\s\\()`));
        if (m) define(m[1], m[2], b.id);
        for (const t of text.matchAll(/\\tag\{([^}]+)\}/g)) define('Equation', t[1], b.id);
      }
      // A block tagged env-lemma with "Label": "7.4" states Lemma 7.4.
      { const env = (b.tags || []).map((t) => t.match(/^env-([a-z]+)$/)?.[1]).find((k) => k && ENV[k] && k !== 'proof');
        const label = (b.fields || []).find((f) => f.key === 'Label')?.value;
        if (env && label) define(ENV[env].name, label.trim(), b.id); }
      if (b.type === 'section' || b.type === 'paragraph') { const h = text.match(new RegExp(`^(${NUM})\\.?\\s+\\S`)); if (h) define('Section', h[1], b.id); }
      if (b.type === 'table' || b.type === 'figure') { const t = text.match(/^(Table|Figure|Fig\.)\s+(\d+)/); if (t) define(singular(t[1]), t[2], b.id); }
      walk(b.children);
    }
  })(trace.blocks);
  if (!targets.size) return null;
  const eqLabels = new Set([...targets.values()].filter((t) => t.kind === 'Equation').map((t) => t.num));

  const used = new Map(); // key → Set(sentence ids)
  const perSentence = new Map();
  (function walk(list) {
    for (const b of list || []) {
      if (b.type === 'sentence') {
        const found = mentions(b.text, eqLabels).map((x) => `${x.kind} ${x.num}`).filter((key) => targets.has(key) && targets.get(key).id !== b.id && targets.get(key).id !== parentOf.get(b.id));
        if (found.length) { perSentence.set(b, [...new Set(found)]); for (const key of found) { if (!used.has(key)) used.set(key, new Set()); used.get(key).add(b.id); } }
      }
      walk(b.children);
    }
  })(trace.blocks);

  const slug = (key) => 'xref-r-' + key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const states = [...targets.values()].filter((t) => !['Section', 'Table', 'Figure'].includes(t.kind));
  const groups = new Map();
  for (const [key, t] of [...targets].sort((a, b) => a[1].order - b[1].order)) {
    if (!used.has(key) && !states.includes(t)) continue;
    const g = kindGroup[t.kind] || 'Other';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push({ id: slug(key), name: t.kind === 'Equation' ? `Equation (${t.num})` : key, children: [] });
  }
  const groupOrder = ['Theorems', 'Lemmas', 'Propositions', 'Corollaries', 'Definitions', 'Remarks', 'Conjectures', 'Claims', 'Assumptions', 'Examples', 'Equations', 'Sections', 'Tables', 'Figures', 'Other'];
  const family = { id: 'xref', name: 'Cross-references', children: [
    { id: 'xref-states', name: 'States a result', children: [] },
    { id: 'xref-recalls', name: 'Recalls a result', children: [] },
    { id: 'xref-ahead', name: 'Points ahead', children: [] },
    { id: 'xref-results', name: 'Results', children: groupOrder.filter((g) => groups.has(g)).map((g) => ({ id: 'xref-g-' + g.toLowerCase(), name: g, children: groups.get(g) })) },
  ] };
  if (trace.tagTree.some((t) => t.id === 'xref')) throw new Error('the tag tree already has an "xref" family; set "crossRefs": {"off": true}');
  trace.tagTree.push(family);
  const has = new Set(family.children[3].children.flatMap((g) => g.children.map((c) => c.id)));
  (function walk(list) {
    for (const b of list || []) {
      if (b.type === 'sentence') {
        const add = [];
        const own = [...targets].find(([, t]) => (t.id === b.id || t.id === parentOf.get(b.id)) && !['Section', 'Table', 'Figure'].includes(t.kind));
        if (own) { add.push('xref-states'); if (has.has(slug(own[0]))) add.push(slug(own[0])); }
        for (const key of perSentence.get(b) || []) {
          const t = targets.get(key);
          add.push(order.get(b.id) > t.order ? 'xref-recalls' : 'xref-ahead');
          if (has.has(slug(key))) add.push(slug(key));
        }
        if (add.length) b.tags = [...new Set([...(b.tags || []), ...add])];
      }
      walk(b.children);
    }
  })(trace.blocks);
  const index = Object.fromEntries([...targets].map(([key, t]) => [key, { id: t.id, tag: has.has(slug(key)) ? slug(key) : null }]));
  return { index, counts: { labels: targets.size, mentioning: perSentence.size } };
}
