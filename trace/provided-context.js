(function(root,factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./provided-context-data.json') : root.PROVIDED_CONTEXT_DATA);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProvidedContext = api;
})(globalThis,function(defaultBundle) {
  'use strict';
  const clone = v => JSON.parse(JSON.stringify(v));
  const unique = s => new Set(s.fields.map(f=>f.key)).size === s.fields.length;
  const get = (s,k) => s.fields.find(f=>f.key===k)?.value;
  const matches = (s,fields) => fields.every(f=>get(s,f.key)===f.value);
  function apply(input,bundle=defaultBundle) {
    const doc=clone(input);
    if (!bundle?.entries || (doc.providedContextHistory!==undefined && !Array.isArray(doc.providedContextHistory))) return doc;
    for (const source of doc.sources) {
      const entry=bundle.entries[source.id], id=bundle.version+':'+source.id;
      if (!entry || !unique(source) || source.text!==entry.text || !matches(source,entry.expected)) continue;
      if (doc.providedContextHistory?.some(h=>h.id===id)) continue;
      // Upgrade the previous, unchanged generated summary too. Author-edited or
      // incomplete context stays untouched. The archived source retains the old text.
      const context=entry.expectedContext || [];
      const hasContext=context.some(f=>source.fields.some(s=>s.key===f.key));
      if(hasContext && !matches(source,context))continue;
      // An empty author-created field is intentional too. Do not replace it.
      if (source.fields.some(f=>!entry.expected.some(e=>e.key===f.key) && !context.some(e=>e.key===f.key) && (/^(?:Exact quote|Quote location|Full context|Context |Source PDF|Passage )/.test(f.key) || entry.updates.some(u=>u.key===f.key)))) continue;
      doc.providedContextHistory ||= [];
      doc.providedContextHistory.push({id,sourceId:source.id,date:bundle.checked,before:clone(source)});
      if(hasContext)source.fields=source.fields.filter(f=>!context.some(e=>e.key===f.key));
      for (const field of entry.updates) {
        const existing=source.fields.find(f=>f.key===field.key);
        if(existing)existing.value=field.value; else source.fields.push(clone(field));
      }
    }
    return doc;
  }
  function verified(source,bundle=defaultBundle) {
    const entry=bundle?.entries?.[source.id];
    if(!entry || !unique(source) || source.text!==entry.text) return false;
    const unchanged=entry.expected.filter(e=>!entry.updates.some(u=>u.key===e.key));
    return matches(source,entry.updates) && matches(source,unchanged)
      && !source.fields.some(f=>/^Exact quote \d+$/.test(f.key) && !entry.updates.some(u=>u.key===f.key));
  }
  function asset(source) {
    const value=get(source,'Full context PDF') || '';
    return /^assets\/source-papers\/[a-z0-9-]+\.pdf#page=[1-9]\d*$/.test(value) ? value : '';
  }
  return {apply,verified,asset};
});
