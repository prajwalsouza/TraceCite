// Citation styles for trace sources that carry structured bibliographic data ("Bib data", from BibTrace).
// Works in Node (the builder precomputes the APA fields Trace needs) and in the browser (citations.js
// restyles the page when the reader picks another style in Settings → Reading).
//
// Styles
//   apa       APA 7th, author–date               (Thomson, 1904)          social sciences, psychology, education
//   chicago   Chicago 17th, author–date          (Thomson 1904)           humanities and many sciences
//   aps       American Physical Society          [1, 3]                   Physical Review and most physics journals
//   nature    Nature                             superscript ¹,³          Nature, Science-style journals
//   vancouver Vancouver / ICMJE                  (1, 3)                   biology and medicine (PubMed journals)
//   ieee      IEEE                               [1], [3]                 engineering and computer science
//
// Reference text uses inline markdown (*italic*, **bold**), which the reading page renders.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TraceCiteStyles = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const STYLES = {
    apa: { name: 'APA 7', note: 'Author–date, as in psychology, education and the social sciences.', numeric: false },
    chicago: { name: 'Chicago', note: 'Author–date, as in the humanities and many sciences.', numeric: false },
    aps: { name: 'Physics (APS)', note: 'Numbered in brackets, as in Physical Review.', numeric: true },
    nature: { name: 'Nature', note: 'Numbered as superscripts, as in Nature.', numeric: true },
    vancouver: { name: 'Vancouver', note: 'Numbered in parentheses, as in biology and medicine.', numeric: true },
    ieee: { name: 'IEEE', note: 'Numbered in brackets, as in engineering.', numeric: true },
  };

  // ---------- names ----------
  // A BibTeX name list: "Family, Given and Given Family and {Organisation Name}".
  function splitTop(str, sep) {
    const out = []; let depth = 0, cur = '';
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '{') depth++; else if (c === '}') depth--;
      if (!depth && s.slice(i, i + sep.length).toLowerCase() === sep.toLowerCase()) { out.push(cur); cur = ''; i += sep.length - 1; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map((x) => x.trim()).filter(Boolean);
  }
  const unbrace = (s) => String(s || '').replace(/[{}]/g, '').trim();
  function parseNames(list) {
    return splitTop(list, ' and ').map((raw) => {
      if (/^\{[\s\S]*\}$/.test(raw)) return { literal: unbrace(raw) };
      const parts = splitTop(raw, ',');
      if (parts.length >= 2) return { family: unbrace(parts[0]), given: unbrace(parts.slice(1).join(' ')) };
      const words = raw.split(/\s+/);
      if (words.length === 1) return { literal: unbrace(raw) };
      // "Given von Family": lowercase particles join the family name.
      let i = words.length - 1; while (i > 1 && /^[a-z]/.test(words[i - 1])) i--;
      return { family: unbrace(words.slice(i).join(' ')), given: unbrace(words.slice(0, i).join(' ')) };
    });
  }
  const initials = (given, { dots = true, space = true } = {}) => String(given || '').split(/\s+/).filter(Boolean)
    .map((w) => w.split('-').map((p) => (p[0] || '') + (dots ? '.' : '')).join('-')).join(space ? ' ' : '');
  const fam = (n) => n.literal || n.family;

  // ---------- helpers ----------
  const pages = (p) => String(p || '').replace(/--?/g, '–');
  const doiUrl = (d) => (d ? 'https://doi.org/' + String(d).replace(/^https?:\/\/(dx\.)?doi\.org\//, '') : '');
  const arxivId = (b) => (/arxiv/i.test(b.archiveprefix || b.eprinttype || '') || /arxiv/i.test(b.journal || '') ? b.eprint : '') || (String(b.url || '').match(/arxiv\.org\/abs\/([^\s?#]+)/) || [])[1] || '';
  const venue = (b, short) => (short && (b.shortjournal || b.journalabbrev)) || b.journal || b.booktitle || '';
  const end = (s) => (/[.?!]$/.test(s) ? s : s + '.');
  const join = (list, sep, last) => (list.length < 2 ? list.join('') : list.slice(0, -1).join(sep) + last + list[list.length - 1]);
  const yearOf = (b) => String(b.year || (b.date || '').slice(0, 4) || 'n.d.');
  const dateApa = (b) => { const y = yearOf(b); if (b.month && b.day) return `${y}, ${b.month} ${b.day}`; if (b.month) return `${y}, ${b.month}`; return y; };

  // ---------- inline labels (author–date) ----------
  function authorLabel(b, style) {
    const names = parseNames(b.author || b.editor || '');
    if (!names.length) return unbrace(b.organization || b.institution || b.title || '?');
    const amp = style === 'apa' ? ' & ' : ' and ';
    if (names.length === 1) return fam(names[0]);
    if (names.length === 2) return fam(names[0]) + amp + fam(names[1]);
    return fam(names[0]) + ' et al.';
  }
  // Same author label and year → a, b, c by title, as both author–date styles require.
  function suffixes(entries, style) {
    const groups = new Map();
    for (const e of entries.filter((x) => !x.bib.shorthand)) { const k = authorLabel(e.bib, style) + '|' + yearOf(e.bib); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(e); }
    const out = new Map();
    for (const list of groups.values()) if (list.length > 1) list.sort((a, b) => unbrace(a.bib.title).localeCompare(unbrace(b.bib.title))).forEach((e, i) => out.set(e.id, 'abcdefghijklmnopqrstuvwxyz'[i] || String(i + 1)));
    return out;
  }
  function inline(b, style, suffix = '') {
    // BibLaTeX's standard shorthand field overrides the author–date label (e.g. working files).
    if (b.shorthand) return unbrace(b.shorthand);
    const y = yearOf(b) + suffix;
    return style === 'chicago' ? `${authorLabel(b, style)} ${y}` : `${authorLabel(b, 'apa')}, ${y}`;
  }

  // ---------- references ----------
  function authorsRef(b, style) {
    const names = parseNames(b.author || b.editor || '');
    if (!names.length) return unbrace(b.organization || b.institution || '');
    const f = {
      apa: (n) => (n.literal ? n.literal : `${n.family}, ${initials(n.given)}`),
      chicago: (n, i) => (n.literal ? n.literal : i === 0 ? `${n.family}, ${n.given}` : `${n.given} ${n.family}`),
      aps: (n) => (n.literal ? n.literal : `${initials(n.given)} ${n.family}`),
      ieee: (n) => (n.literal ? n.literal : `${initials(n.given)} ${n.family}`),
      nature: (n) => (n.literal ? n.literal : `${n.family}, ${initials(n.given)}`),
      vancouver: (n) => (n.literal ? n.literal : `${n.family} ${initials(n.given, { dots: false, space: false })}`),
    }[style];
    let list = names.map(f);
    if (style === 'apa') { if (list.length > 20) list = [...list.slice(0, 19), '… ' + list[list.length - 1]]; return list.length === 1 ? list[0] : join(list, ', ', ', & '); }
    if (style === 'chicago') return list.length > 10 ? list.slice(0, 7).join(', ') + ', et al.' : list.length === 2 ? list.join(' and ') : join(list, ', ', ', and ');
    if (style === 'aps' || style === 'ieee') return list.length > (style === 'ieee' ? 6 : 15) ? list[0] + ' et al.' : list.length === 2 ? list.join(' and ') : join(list, ', ', ', and ');
    if (style === 'nature') return list.length > 5 ? list[0] + ' et al.' : list.length === 2 ? list.join(' & ') : join(list, ', ', ' & ');
    if (style === 'vancouver') return list.length > 6 ? list.slice(0, 6).join(', ') + ', et al.' : list.join(', ');
    return list.join(', ');
  }
  // A reference in the given style. With parts = true, each part is wrapped as \u0001role\u0002text\u0003
  // (roles: authors, year, title, venue, volume, issue, pages, publisher, link, arxiv, note) so the reading
  // page can style and link them; referenceParts() splits that into [role, text] pairs.
  function reference(b, style, suffix = '', parts = false) {
    const W = (role, t) => (t === '' || t == null ? '' : parts ? `\u0001${role}\u0002${t}\u0003` : String(t));
    const type = String(b.type || 'misc').toLowerCase();
    const title = unbrace(b.title);
    const au = authorsRef(b, style);
    const y = yearOf(b) + suffix;
    const vol = b.volume, num = b.number, pp = pages(b.pages);
    const doi = b.doi, url = b.url, ax = arxivId(b);
    const link = doi ? doiUrl(doi) : url || '';
    const doiBare = doi ? String(doi).replace(/^https?:\/\/(dx\.)?doi\.org\//, '') : '';
    const isBook = type === 'book';
    const isPreprint = !!ax && !b.journal;
    const extra = b.howpublished ? unbrace(b.howpublished) : b.note && type === 'misc' ? unbrace(b.note) : '';
    const pub = unbrace(b.publisher || b.institution || b.organization || '');
    const AU = (t) => W('authors', t), Y = (t) => W('year', t), T = (t) => W('title', t), V = (t) => W('venue', t), VOL = (t) => W('volume', t), PP = (t) => W('pages', t), L = (t) => W('link', t), AX = (t) => W('arxiv', t), PUB = (t) => W('publisher', t), N = (t) => W('note', t), IS = (t) => W('issue', t);
    switch (style) {
      case 'apa': {
        let s = `${AU(end(au))} (${Y(type === 'misc' && b.month ? dateApa(b) + suffix : y)}). `;
        if (isBook) s += `*${T(end(title))}* ${pub ? PUB(end(pub)) : ''}`;
        else if (isPreprint) s += `*${T(title)}* [Preprint]. ${AX('arXiv:' + ax)}.`;
        else if (b.journal) s += `${T(end(title))} *${V(b.journal)}*${vol ? `, *${VOL(vol)}*` : ''}${num ? `(${IS(num)})` : ''}${pp ? `, ${PP(pp)}` : ''}.`;
        else if (b.booktitle) s += `${T(end(title))} In *${V(b.booktitle)}*${pp ? ` (pp. ${PP(pp)})` : ''}.${pub ? ' ' + PUB(end(pub)) : ''}`;
        else s += `*${T(title)}*${extra ? ` [${N(extra)}]` : ''}.`;
        return (s + (link ? ' ' + L(link) : '')).trim();
      }
      case 'chicago': {
        let s = `${AU(end(au))} ${Y(y)}. `;
        if (isBook) s += `*${T(end(title))}* ${pub ? PUB(end(pub)) : ''}`;
        else if (isPreprint) s += `“${T(end(title))}” Preprint, ${AX('arXiv:' + ax)}.`;
        else if (b.journal) s += `“${T(end(title))}” *${V(b.journal)}*${vol ? ` ${VOL(vol)}` : ''}${num ? ` (${IS(num)})` : ''}${pp ? `: ${PP(pp)}` : ''}.`;
        else s += `*${T(end(title))}*${extra ? ' ' + N(end(extra)) : ''}`;
        return (s + (link ? ' ' + L(link) + '.' : '')).trim();
      }
      case 'aps': {
        let s = `${AU(au)}, `;
        if (isBook) s += `*${T(title)}* (${pub ? PUB(pub) + ', ' : ''}${Y(y)}).`;
        else if (isPreprint) s += `${T(title)}, ${AX('arXiv:' + ax)} (${Y(y)}).`;
        else if (b.journal) s += `${T(title)}, ${V(venue(b, true))} **${VOL(vol || '')}**${pp ? ', ' + PP(pp) : ''} (${Y(y)}).`;
        else s += `${T(title)}${extra ? ', ' + N(extra) : ''} (${Y(y)}).`;
        return s + (doiBare && parts ? ' ' + L(doiUrl(doiBare)) : '');
      }
      case 'nature': {
        let s = `${AU(au)} `;
        if (isBook) s += `*${T(title)}* (${pub ? PUB(pub) + ', ' : ''}${Y(y)}).`;
        else if (isPreprint) s += `${T(end(title))} Preprint at ${L(link || 'https://arxiv.org/abs/' + ax)} (${Y(y)}).`;
        else if (b.journal) s += `${T(end(title))} *${V(venue(b, true))}* **${VOL(vol || '')}**${pp ? ', ' + PP(pp) : ''} (${Y(y)}).`;
        else s += `${T(end(title))}${extra ? ' ' + N(end(extra)) : ''} (${Y(y)}).`;
        return s;
      }
      case 'vancouver': {
        let s = `${AU(end(au))} `;
        if (isBook) s += `${T(end(title))} ${pub ? PUB(pub) + '; ' : ''}${Y(y)}.`;
        else if (isPreprint) s += `${T(end(title))} arXiv [Preprint]. ${Y(y)}. ${AX('arXiv:' + ax)}.`;
        else if (b.journal) s += `${T(end(title))} ${V(venue(b, true))}. ${Y(y)}${vol ? ';' + VOL(vol) : ''}${num ? `(${IS(num)})` : ''}${pp ? ':' + PP(pp) : ''}.`;
        else s += `${T(end(title))}${extra ? ' ' + N(end(extra)) : ''} ${Y(y)}.`;
        return s + (doiBare ? ` doi:${L(doiBare)}` : '');
      }
      case 'ieee': {
        let s = `${AU(au)}, `;
        if (isBook) s += `*${T(title)}*. ${pub ? PUB(pub) + ', ' : ''}${Y(y)}.`;
        else if (isPreprint) s += `“${T(title)},” ${AX('arXiv:' + ax)}, ${Y(y)}.`;
        else if (b.journal) s += `“${T(title)},” *${V(venue(b, true))}*${vol ? `, vol. ${VOL(vol)}` : ''}${num ? `, no. ${IS(num)}` : ''}${pp ? `, pp. ${PP(pp)}` : ''}, ${Y(y)}.`;
        else s += `“${T(title)},” ${extra ? N(extra) + ', ' : ''}${Y(y)}.`;
        return s + (doiBare ? ` doi: ${L(doiBare)}.` : '');
      }
    }
    return title;
  }
  function referenceParts(b, style, suffix = '') {
    const marked = reference(b, style, suffix, true), out = [];
    const re = /\u0001([a-z]+)\u0002([\s\S]*?)\u0003/g;
    let last = 0, m;
    while ((m = re.exec(marked))) { if (m.index > last) out.push(['', marked.slice(last, m.index)]); out.push([m[1], m[2]]); last = m.index + m[0].length; }
    if (last < marked.length) out.push(['', marked.slice(last)]);
    return out;
  }

  // Numbered styles: compress 1, 2, 3, 5 → 1–3, 5.
  function ranges(nums) {
    const n = [...new Set(nums)].sort((a, b) => a - b), out = [];
    for (let i = 0; i < n.length; i++) { let j = i; while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++; out.push(j - i >= 2 ? `${n[i]}–${n[j]}` : j > i ? `${n[i]}, ${n[j]}` : `${n[i]}`); i = j; }
    return out.join(', ');
  }
  const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', ',': '˒', '–': '⁻', ' ': '' };
  function numericGroup(nums, style) {
    const r = ranges(nums);
    if (style === 'aps') return `[${r}]`;
    if (style === 'ieee') return [...new Set(nums)].sort((a, b) => a - b).map((x) => `[${x}]`).join(', ');
    if (style === 'vancouver') return `(${r})`;
    if (style === 'nature') return r.split('').map((c) => SUP[c] ?? c).join('');
    return `[${r}]`;
  }
  function numberedLabel(n, style) {
    if (style === 'aps' || style === 'ieee') return `[${n}]`;
    return `${n}.`;
  }
  return { STYLES, parseNames, inline, reference, referenceParts, suffixes, numericGroup, numberedLabel, authorLabel, yearOf };
});
