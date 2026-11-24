(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./source-context-data.json') : root.SOURCE_CONTEXT_DATA, typeof module === 'object' && module.exports ? require('./provided-context.js') : root.ProvidedContext, typeof module === 'object' && module.exports ? require('./online-context.js') : root.OnlineContext);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SourceContext = api;
})(globalThis, function (defaultBundle, Provided, Online) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const get = (s,k) => s.fields.find(f => f.key === k)?.value || '';
  const evidenceFields = s => s.fields.filter(f => /^(?:Exact quote(?: \d+)?|Quote location(?: \d+)?|URL|DOI|Record status|Checked)$/.test(f.key));
  const matches = (s,entry) => JSON.stringify(evidenceFields(s)) === JSON.stringify(entry.expected);
  const fieldNames = ['Context paragraphs (summary)', 'Context access', 'Context checked', 'Full context paragraphs', 'Full context location', 'Full context provenance'];
  const isLiterature = s => !s.id.startsWith('audit-') && s.id !== 'src-manuscript';
  function apply(input, bundle = defaultBundle) {
    const doc = clone(input);
    if (!bundle?.entries || (doc.appliedSourceContexts !== undefined && !Array.isArray(doc.appliedSourceContexts))) return doc;
    for (const source of doc.sources) {
      const entry = bundle.entries[source.id], key = bundle.version + ':' + source.id;
      if (!entry || doc.appliedSourceContexts?.includes(key) || !matches(source,entry)) continue;
      if (source.fields.some(f => fieldNames.includes(f.key))) continue;
      source.fields.push(
        { key: 'Context paragraphs (summary)', value: JSON.stringify(entry.paragraphs) },
        { key: 'Context access', value: entry.access },
        { key: 'Context checked', value: entry.checked }
      );
      doc.appliedSourceContexts ||= [];
      doc.appliedSourceContexts.push(key);
    }
    return Online.apply(Provided.apply(doc));
  }
  function paragraphs(value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) && parsed.length <= 20 && parsed.every(p => p && ['text','location','url'].every(k => typeof p[k] === 'string')) ? parsed : [];
    } catch { return []; }
  }
  function presentation(source, bundle = defaultBundle) {
    if (!isLiterature(source)) return null;
    const entry = bundle?.entries?.[source.id];
    const full = get(source, 'Full context paragraphs');
    const summaryValue = get(source, 'Context paragraphs (summary)');
    const summary = paragraphs(summaryValue);
    const online = Online.entry(source);
    const checked = (!!online && !online.full) || (!!entry && matches(source,entry) && JSON.stringify(summary) === JSON.stringify(entry.paragraphs)
      && get(source,'Context checked') === entry.checked && get(source,'Context access') === entry.access);
    return {
      full, fullChecked: Provided.verified(source) || !!online?.full, fullAsset: Provided.asset(source),
      verificationKind: online?.verification || 'PDF', contentKind: online?.kind || 'Full context',
      fullBlocks: online?.full ? paragraphs(get(source,'Full context blocks')) : [],
      license: online?.license || '',
      fullLocation: get(source,'Full context location'), provenance: get(source,'Full context provenance'),
      summary, access: get(source,'Context access'), checked,
      invalid: !!summaryValue && !summary.length,
      pending: !full && !summary.length,
      warning: summary.length && !checked ? 'Saved context summary: source or context fields have changed since the check. Verify this pairing.' : ''
    };
  }
  function highlightedParts(text, quotes) {
    const ranges = [];
    for (const quote of quotes.filter(q => q.trim())) {
      const pattern = quote.trim().split(/\s+/).map(q => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
      for (const match of text.matchAll(new RegExp(pattern,'gu'))) ranges.push([match.index,match.index + match[0].length]);
    }
    ranges.sort((a,b) => a[0]-b[0]);
    const merged = [];
    for (const range of ranges) {
      const last = merged.at(-1);
      if (last && range[0] <= last[1]) last[1] = Math.max(last[1],range[1]);
      else merged.push([...range]);
    }
    const parts = []; let start = 0;
    for (const [from,to] of merged) {
      if (from > start) parts.push({ text: text.slice(start,from), match: false });
      parts.push({ text: text.slice(from,to), match: true }); start = to;
    }
    if (start < text.length) parts.push({ text: text.slice(start), match: false });
    return parts;
  }
  // A passage-specific reference may focus a verified source record without
  // changing its shared quotes or certifying any edited text.
  function focusPassage(context, quote) {
    if (!context?.full || !quote || !context.fullBlocks?.length) return context;
    const normalized = s => s.replace(/\s+/g, ' ').trim();
    const blocks = context.fullBlocks.filter(b => normalized(b.text).includes(normalized(quote)));
    if (!blocks.length) return context;
    const page = blocks[0].url.match(/#page=([1-9]\d*)/)?.[1];
    return {...context, full:blocks.map(b=>b.text).join('\n\n'), fullBlocks:blocks,
      fullAsset:context.fullAsset && page ? context.fullAsset.replace(/#page=\d+/, '#page='+page) : context.fullAsset};
  }
  return { apply, presentation, focusPassage, highlightedParts, paragraphs, evidenceFields, fieldNames, isLiterature };
});
