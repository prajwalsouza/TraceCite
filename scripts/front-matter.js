// Front matter under the title: authors, affiliations, and a quiet line of date, revision, DOI, licence and
// keywords. Every part is optional and simply absent when the data has none.
//   "authors": [{ "name": "Ada Lovelace", "affiliations": ["aff-1"], "email": "ada@example.org",
//                 "orcid": "0000-0002-1825-0097", "corresponding": true, "note": "Equal contribution" }]
//   "affiliations": [{ "id": "aff-1", "name": "Department of Mathematics, Example University", "country": "UK" }]
//   "date": "2026-11-24", "revision": "Draft 3", "doi": "10.1234/abcd", "license": "CC BY 4.0",
//   "keywords": ["document structure", "evidence"]
// A name may be a plain string ("authors": ["Ada Lovelace"]). Affiliation numbers follow first appearance.
(() => {
  const d = window.OUTLINE_SEED || {};
  const authors = (d.authors || []).map((a) => (typeof a === 'string' ? { name: a } : a)).filter((a) => a?.name);
  const affs = (d.affiliations || []).filter((a) => a?.id);
  const meta = [d.date && fmtDate(d.date), d.revision, d.doi && { doi: d.doi }, d.license].filter(Boolean);
  const keywords = (d.keywords || []).filter(Boolean);
  if (!authors.length && !meta.length && !keywords.length) return;
  function fmtDate(s) { const t = new Date(s); return isNaN(t) ? s : t.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); }
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const ICON = {
    orcid: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M8.6 10v6.5M8.6 7.4v.1M11.6 16.5V10h2.2a3.25 3.25 0 0 1 0 6.5z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/></svg>',
  };
  const box = el('div', 'fm');
  if (authors.length) {
    const order = [];
    for (const a of authors) for (const id of a.affiliations || []) if (!order.includes(id) && affs.some((x) => x.id === id)) order.push(id);
    const showNums = order.length > 1;
    const line = el('p', 'fm-authors');
    authors.forEach((a, i) => {
      const who = el('span', 'fm-author');
      who.append(el('span', 'fm-name', a.name));
      const nums = (a.affiliations || []).map((id) => order.indexOf(id) + 1).filter((n) => n > 0);
      if (showNums && nums.length) who.append(el('sup', 'fm-sup', nums.join(',')));
      if (a.orcid) { const o = el('a', 'fm-icon fm-orcid'); o.href = 'https://orcid.org/' + a.orcid.replace(/^https?:\/\/orcid\.org\//, ''); o.target = '_blank'; o.rel = 'noopener noreferrer'; o.innerHTML = ICON.orcid; o.setAttribute('aria-label', 'ORCID of ' + a.name); o.title = 'ORCID ' + a.orcid; who.append(o); }
      if (a.corresponding && a.email) { const m = el('a', 'fm-icon fm-mail'); m.href = 'mailto:' + a.email; m.innerHTML = ICON.mail; m.setAttribute('aria-label', 'Email ' + a.name + ' (corresponding author)'); m.title = 'Corresponding author · ' + a.email; who.append(m); }
      if (a.note) who.title = a.note;
      line.append(who);
      if (i < authors.length - 1) line.append(document.createTextNode(i === authors.length - 2 ? (authors.length > 2 ? ', and ' : ' and ') : ', '));
    });
    box.append(line);
    if (order.length) {
      const list = el('ol', 'fm-affs' + (showNums ? '' : ' fm-affs-single'));
      for (const id of order) { const a = affs.find((x) => x.id === id); list.append(el('li', '', [a.name, a.country].filter(Boolean).join(', '))); }
      box.append(list);
    }
    const notes = authors.filter((a) => a.note).map((a) => a.name + ': ' + a.note);
    if (notes.length) box.append(el('p', 'fm-notes', notes.join(' · ')));
  }
  if (meta.length || keywords.length) {
    const line = el('p', 'fm-meta');
    meta.forEach((m, i) => {
      if (i) line.append(el('span', 'fm-dot', '·'));
      if (m.doi) { const a = el('a', 'fm-doi', 'doi:' + m.doi); a.href = 'https://doi.org/' + m.doi; a.target = '_blank'; a.rel = 'noopener noreferrer'; line.append(a); }
      else line.append(el('span', '', m));
    });
    if (keywords.length) { if (meta.length) line.append(el('span', 'fm-dot', '·')); line.append(el('span', 'fm-keywords', keywords.join(', '))); }
    box.append(line);
  }
  const place = () => { const h = document.getElementById('document-title'); if (h && !document.querySelector('.document-header .fm')) h.after(box); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place); else place();
})();
