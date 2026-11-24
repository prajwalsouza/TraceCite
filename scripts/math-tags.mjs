// Math tags: parse the TeX in a trace document and add a "Mathematics" family to its tag tree.
// Every sentence that contains math gets tags for the symbols and the kinds of mathematics it uses, so the
// tag tree, the Tag tree board, search and the opened sentence all show where N, a summation or a
// fraction appears. Reading pages then highlight the symbol inside the equations when its tag is hovered
// or pinned (scripts/math.js reads the index written here).
//
//   Mathematics
//     Variables       symbols used on their own (N, M, x, μ, …), most used first
//     Indices         symbols that only ever appear as subscripts or superscripts (i, j, k, …)
//     Number sets     ℝ, ℕ, ℤ, ℂ, 𝔻, …
//     Equation types  summation, integral, fraction, root, limit, inequality, …
//
// The source data is never changed: the builder adds these tags to its in-memory copy.
// Options in the data (all optional):
//   "mathTags": {
//     "minSentences": 2,            a symbol must appear in at least this many sentences
//     "exclude": ["d"],             symbols to leave out (TeX, as written in the formulas)
//     "groups": { "Counts": ["n", "k"], "Constants": ["\\pi", "e"] },   your own variable groups
//     "labels": { "n": "number of items", "\\mu": "mean" },     a short meaning per symbol
//     "off": false
//   }
// Grouping is partly a judgement about the topic, so "groups" always wins. Symbols it does not list are
// grouped automatically: known constants (π, ℏ) under Constants, the rest under the section that uses
// them most, in document order.

const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ϵ', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', varpi: 'ϖ', rho: 'ρ', varrho: 'ϱ', sigma: 'σ', varsigma: 'ς', tau: 'τ', upsilon: 'υ', phi: 'ϕ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', ell: 'ℓ', hbar: 'ℏ' };
const SETS = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', C: 'ℂ', D: '𝔻', Q: 'ℚ', P: 'ℙ', E: '𝔼' };
// The document's own macros (from math.js): \R → ℝ and so on.
const SET_MACROS = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', C: 'ℂ', D: '𝔻' };

// Kinds of mathematics, keyed by what reveals them. "glyphs" and "nodes" tell the reading page what to
// light up inside the rendered equation (MathJax SVG: data-c code points and data-mml-node names).
export const CONSTRUCTS = [
  { id: 'sum', group: 'Algebra', name: 'Summation', tex: ['sum'], glyphs: ['2211'] },
  { id: 'product', group: 'Algebra', name: 'Product', tex: ['prod'], glyphs: ['220F'] },
  { id: 'integral', group: 'Calculus', name: 'Integral', tex: ['int', 'iint', 'iiint', 'oint'], glyphs: ['222B', '222C', '222D', '222E'] },
  { id: 'fraction', group: 'Algebra', name: 'Fraction', tex: ['frac', 'tfrac', 'dfrac', 'cfrac'], nodes: ['mfrac'] },
  { id: 'binomial', group: 'Algebra', name: 'Binomial coefficient', tex: ['binom', 'tbinom', 'dbinom'], nodes: ['mfrac'] },
  { id: 'root', group: 'Algebra', name: 'Square root', tex: ['sqrt'], nodes: ['msqrt', 'mroot'] },
  { id: 'limit', group: 'Calculus', name: 'Limit', tex: ['lim', 'liminf', 'limsup'], words: ['lim', 'liminf', 'limsup', 'lim inf', 'lim sup'] },
  { id: 'extremum', group: 'Calculus', name: 'Maximum or minimum', tex: ['max', 'min', 'sup', 'inf', 'argmax', 'argmin'], words: ['max', 'min', 'sup', 'inf', 'arg'] },
  { id: 'log', group: 'Algebra', name: 'Logarithm or exponential', tex: ['log', 'ln', 'exp'], words: ['log', 'ln', 'exp'] },
  { id: 'trig', group: 'Algebra', name: 'Trigonometric function', tex: ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh'], words: ['sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh'] },
  { id: 'derivative', group: 'Calculus', name: 'Derivative', tex: ['partial', 'nabla', 'prime'], chars: ["'"], glyphs: ['2202', '2207', '2032', '2033'] },
  { id: 'inequality', group: 'Relations', name: 'Inequality', tex: ['le', 'leq', 'ge', 'geq', 'lt', 'gt', 'lesssim', 'gtrsim', 'll', 'gg', 'leqslant', 'geqslant', 'ne', 'neq'], chars: ['<', '>'], glyphs: ['2264', '2265', '3C', '3E', '2272', '2273', '226A', '226B', '2A7D', '2A7E', '2260'] },
  { id: 'approx', group: 'Relations', name: 'Approximation', tex: ['approx', 'sim', 'simeq', 'asymp', 'propto'], glyphs: ['2248', '223C', '2243', '224D', '221D'] },
  { id: 'equation', group: 'Relations', name: 'Equality', chars: ['='], glyphs: ['3D'] },
  { id: 'infinity', group: 'Calculus', name: 'Infinity', tex: ['infty'], glyphs: ['221E'] },
  { id: 'abs', group: 'Algebra', name: 'Absolute value or norm', chars: ['|'], tex: ['lvert', 'rvert', 'Vert', 'lVert', 'rVert', 'mid'], glyphs: ['7C', '2223', '2225', '2016'] },
  { id: 'arrow', group: 'Calculus', name: 'Arrow or limit process', tex: ['to', 'rightarrow', 'mapsto', 'Rightarrow', 'implies', 'iff'], glyphs: ['2192', '21A6', '21D2', '27F9', '27FA'] },
  { id: 'set', group: 'Relations', name: 'Set relation', tex: ['in', 'notin', 'subset', 'subseteq', 'cup', 'cap', 'setminus', 'emptyset', 'varnothing'], glyphs: ['2208', '2209', '2282', '2286', '222A', '2229', '2216', '2205'] },
  { id: 'bigo', group: 'Calculus', name: 'Asymptotic notation', words: ['O', 'o'] },
  { id: 'numbered', group: 'Layout', name: 'Numbered equation', tex: ['tag'] },
  { id: 'display', group: 'Layout', name: 'Display equation' },
];
const BY_TEX = new Map(CONSTRUCTS.flatMap((c) => (c.tex || []).map((t) => [t, c.id])));
const BY_CHAR = new Map(CONSTRUCTS.flatMap((c) => (c.chars || []).map((t) => [t, c.id])));
// Commands whose argument is words, not mathematics.
const WORD_ARG = new Set(['text', 'textrm', 'textit', 'textbf', 'mathrm', 'operatorname', 'mbox', 'tag', 'label', 'href', 'class', 'cssId', 'style', 'color', 'textcolor', 'hl', 'hlb', 'hlg', 'hla', 'hlp']);
const KEEP_ARG = new Set(['hl', 'hlb', 'hlg', 'hla', 'hlp', 'class', 'textcolor']); // the second argument is still maths

const SEG = /\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]|\$\$([\s\S]*?)\$\$|(?<!\\)\$([^$\n]+?)(?<!\\)\$/g;
export function formulas(text) {
  const out = [];
  for (const m of String(text || '').matchAll(SEG)) out.push({ tex: m[1] ?? m[2] ?? m[3] ?? m[4], display: m[2] !== undefined || m[3] !== undefined });
  return out;
}

// Read one formula. Returns { symbols: Map(key → { inScript, solo }), constructs: Set }.
export function parse(tex, display = false) {
  const symbols = new Map(), constructs = new Set();
  if (display) constructs.add('display');
  const note = (key, script) => { const s = symbols.get(key) || { solo: 0, script: 0 }; s[script ? 'script' : 'solo']++; symbols.set(key, s); };
  const s = tex;
  let i = 0;
  const group = () => { // read a {…} group or a single token; return [start, end]
    while (s[i] === ' ') i++;
    if (s[i] === '{') { let depth = 0, j = i; for (; j < s.length; j++) { if (s[j] === '{' && s[j - 1] !== '\\') depth++; else if (s[j] === '}' && s[j - 1] !== '\\') { depth--; if (!depth) break; } } const r = [i + 1, j]; i = j + 1; return r; }
    if (s[i] === '\\') { let j = i + 1; while (/[A-Za-z]/.test(s[j] || '')) j++; if (j === i + 1) j++; const r = [i, j]; i = j; return r; }
    const r = [i, i + 1]; i++; return r;
  };
  function walk(from, to, script) {
    i = from;
    while (i < to) {
      const c = s[i];
      if (c === '\\') {
        let j = i + 1; while (/[A-Za-z]/.test(s[j] || '')) j++;
        const name = s.slice(i + 1, j) || s[i + 1];
        i = j === i + 1 ? i + 2 : j;
        if (BY_TEX.has(name)) constructs.add(BY_TEX.get(name));
        if (name === 'tag') constructs.add('numbered');
        if (GREEK[name]) note(GREEK[name], script);
        else if (SET_MACROS[name] && name.length === 1) note(SET_MACROS[name], script);
        else if (name === 'mathbb') { const [a, b] = group(); const k = s.slice(a, b).trim(); note(SETS[k] || '𝕏' + k, script); }
        else if (name === 'mathcal' || name === 'mathscr' || name === 'mathfrak' || name === 'mathbf' || name === 'boldsymbol') { const [a, b] = group(); const save = i; walk(a, b, script); i = save; }
        else if (WORD_ARG.has(name)) {
          if (name === 'class' || name === 'textcolor' || name === 'color') { group(); if (name !== 'color') { const [a, b] = group(); const save = i; walk(a, b, script); i = save; } }
          else if (KEEP_ARG.has(name)) { const [a, b] = group(); const save = i; walk(a, b, script); i = save; }
          else group();
        }
        continue;
      }
      if (c === '_' || c === '^') {
        i++;
        if (c === '^' && s[i] === '*') { i++; continue; }
        const [a, b] = group(); const save = i; walk(a, b, true); i = save;
        continue;
      }
      if ((c === 'O' || c === 'o') && /^\s*(\(|\\bigl?\(|\\left\()/.test(s.slice(i + 1)) && !/[A-Za-z]/.test(s[i - 1] || '')) { constructs.add('bigo'); i++; continue; }
      if (/[A-Za-z]/.test(c)) { note(c, script); i++; continue; }
      if (BY_CHAR.has(c)) constructs.add(BY_CHAR.get(c));
      i++;
    }
  }
  walk(0, s.length, false);
  return { symbols, constructs };
}

const keyOf = (tex) => { const k = [...parse(String(tex)).symbols.keys()]; return k.length === 1 ? k[0] : String(tex); };
const CONSTANTS = new Set(['π', 'ℏ']);
const idFor = (key) => {
  const greek = Object.entries(GREEK).find(([, v]) => v === key)?.[0];
  if (greek) return greek;
  const set = Object.entries(SETS).find(([, v]) => v === key)?.[0];
  if (set) return 'set-' + set;
  if (/^[A-Z]$/.test(key)) return 'cap-' + key;
  return key.replace(/[^a-zA-Z0-9]/g, (ch) => 'u' + ch.codePointAt(0).toString(16));
};
const texFor = (key) => {
  const greek = Object.entries(GREEK).find(([, v]) => v === key)?.[0];
  if (greek) return '\\(\\' + greek + '\\)';
  const set = Object.entries(SETS).find(([, v]) => v === key)?.[0];
  if (set) return '\\(\\mathbb{' + set + '}\\)';
  return '\\(' + key + '\\)';
};

// Add the Mathematics family to a trace document (in place) and return the index for reading pages.
export function addMathTags(trace, options = {}) {
  const opt = { minSentences: 2, exclude: [], ...(trace.mathTags || {}), ...options };
  if (opt.off) return null;
  const per = new Map(); // block id → parse results merged
  const sectionUse = new Map(); // symbol → Map(section → sentences using it there)
  const symbolUse = new Map(); // key → { solo, script, sentences:Set }
  const constructUse = new Map(); // id → Set(sentence ids)
  (function walk(list, section) {
    for (const b of list || []) {
      const sec = section || (b.type === 'section' ? b : null);
      if (['sentence', 'table-cell', 'note'].includes(b.type)) {
        const fs = formulas(b.text);
        if (fs.length) {
          const syms = new Set(), cons = new Set();
          for (const f of fs) {
            const { symbols, constructs } = parse(f.tex, f.display);
            for (const [k, v] of symbols) { if (sec) { const m = sectionUse.get(k) || new Map(); m.set(sec, (m.get(sec) || 0) + 1); sectionUse.set(k, m); } const u = symbolUse.get(k) || { solo: 0, script: 0, sentences: new Set() }; u.solo += v.solo; u.script += v.script; u.sentences.add(b.id); symbolUse.set(k, u); syms.add(k); }
            for (const c of constructs) { const u = constructUse.get(c) || new Set(); u.add(b.id); constructUse.set(c, u); cons.add(c); }
          }
          per.set(b.id, { block: b, syms, cons });
        }
      }
      walk(b.children, sec);
    }
  })(trace.blocks, null);
  if (!per.size) return null;

  const excluded = new Set((opt.exclude || []).map(keyOf));
  const labels = new Map(Object.entries(opt.labels || {}).map(([t, l]) => [keyOf(t), l]));
  const keep = [...symbolUse].filter(([k, u]) => !excluded.has(k) && u.sentences.size >= opt.minSentences)
    .sort((a, b) => b[1].sentences.size - a[1].sentences.size || a[0].localeCompare(b[0]));
  const isSet = (k) => Object.values(SETS).includes(k) || k.startsWith('𝕏');
  // Indices: letters used mostly (or only) as subscripts and superscripts.
  const isIndex = (u) => u.solo === 0 || u.script >= 2 * u.solo;
  const vars = keep.filter(([k, u]) => !isSet(k) && !isIndex(u));
  const indices = keep.filter(([k, u]) => !isSet(k) && isIndex(u));
  const sets = keep.filter(([k]) => isSet(k));
  const cons = CONSTRUCTS.filter((c) => constructUse.has(c.id));

  const index = {}; // tag id → what to light up
  const tones = {}; // tag-group id → tone
  const leaf = (prefix, key) => { const id = `math-${prefix}-${idFor(key)}`; index[id] = { symbol: key }; return { id, name: labels.has(key) ? `${texFor(key)} · ${labels.get(key)}` : texFor(key), children: [] }; };
  const family = { id: 'math', name: 'Mathematics', children: [] };
  // Variables: the document's own groups first, then constants, then by the section that uses each most
  // (in document order), most used first within a group.
  const order = new Map(); (function walk(list) { for (const b of list || []) { if (b.type === 'section') order.set(b, order.size); walk(b.children); } })(trace.blocks);
  const home = (k) => { let best = null, n = 0; for (const [sec, c] of sectionUse.get(k) || []) if (c > n) { best = sec; n = c; } return best; };
  if (vars.length) {
    const groups = [], placed = new Set(), varKeys = new Set(vars.map(([k]) => k));
    for (const [name, list] of Object.entries(opt.groups || {})) {
      const keys = list.map(keyOf).filter((k) => varKeys.has(k) && !placed.has(k));
      keys.forEach((k) => placed.add(k));
      if (keys.length) groups.push({ id: 'math-vg-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, children: keys.map((k) => leaf('v', k)) });
    }
    const consts = vars.map(([k]) => k).filter((k) => CONSTANTS.has(k) && !placed.has(k));
    if (consts.length && !groups.some((g) => g.name === 'Constants')) { consts.forEach((k) => placed.add(k)); groups.push({ id: 'math-vg-constants', name: 'Constants', children: consts.map((k) => leaf('v', k)) }); }
    const rest = vars.map(([k]) => k).filter((k) => !placed.has(k));
    const bySection = new Map();
    for (const k of rest) { const sec = home(k); const key = sec ? sec.id : '_'; if (!bySection.has(key)) bySection.set(key, { sec, list: [] }); bySection.get(key).list.push(k); }
    const auto = [...bySection.values()].sort((a, b) => (order.get(a.sec) ?? 1e9) - (order.get(b.sec) ?? 1e9))
      .map(({ sec, list }) => ({ id: 'math-vg-' + (sec ? sec.id : 'other').replace(/[^a-zA-Z0-9_-]/g, '-'), name: sec ? sec.text : 'Elsewhere', children: list.map((k) => leaf('v', k)) }));
    if (groups.length && auto.length) groups.push({ id: 'math-vg-by-section', name: 'Other, by section', children: auto });
    else groups.push(...auto);
    // Each variable group gets its own soft tone, used in the tag tree, the opened sentence and the highlight
    // inside equations, so a symbol lights up in the colour of its tag. Amber and red are left out (problems).
    const TONES = ['blue', 'teal', 'plum', 'green', 'indigo', 'olive'];
    const flatGroups = groups.flatMap((g) => (g.children.every((c) => !c.children.length) ? [g] : g.children));
    flatGroups.forEach((g, i) => { tones[g.id] = TONES[i % TONES.length]; for (const c of g.children) if (index[c.id]) index[c.id].tone = tones[g.id]; });
    family.children.push({ id: 'math-variables', name: 'Variables', children: groups.length === 1 ? groups[0].children : groups });
  }
  if (indices.length) family.children.push({ id: 'math-indices', name: 'Indices', children: indices.map(([k]) => leaf('i', k)) });
  if (sets.length) family.children.push({ id: 'math-sets', name: 'Number sets', children: sets.map(([k]) => leaf('s', k)) });
  if (cons.length) {
    const order = ['Relations', 'Algebra', 'Calculus', 'Layout'];
    const children = order.map((g) => ({ g, list: cons.filter((c) => c.group === g) })).filter((x) => x.list.length).map(({ g, list }) => ({
      id: 'math-tg-' + g.toLowerCase(), name: g,
      children: list.map((c) => { const id = 'math-t-' + c.id; index[id] = { glyphs: c.glyphs || [], nodes: c.nodes || [], words: c.words || [], display: c.id === 'display' }; return { id, name: c.name, children: [] }; }) }));
    family.children.push({ id: 'math-types', name: 'Equation types', children });
  }
  // Parents light up everything beneath them.
  (function parents(node) { for (const c of node.children) { if (c.children.length) { index[c.id] = { children: c.children.map((x) => x.id) }; parents(c); } } })(family);
  index.math = { children: family.children.map((g) => g.id) };
  if (trace.tagTree.some((t) => t.id === 'math')) throw new Error('the tag tree already has a "math" family; set "mathTags": {"off": true} or rename it');
  trace.tagTree.push(family);

  const symbolTag = new Map(Object.entries(index).filter(([, e]) => e.symbol).map(([id, e]) => [e.symbol, id]));
  for (const { block, syms, cons: used } of per.values()) {
    const add = [...syms].map((k) => symbolTag.get(k)).filter(Boolean).concat([...used].map((c) => 'math-t-' + c));
    block.tags = [...new Set([...(block.tags || []), ...add])];
  }
  return { index, tones, counts: { sentences: per.size, variables: vars.length, indices: indices.length, sets: sets.length, types: cons.length } };
}
