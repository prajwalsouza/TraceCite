(function(root,factory) {
  const node=typeof module==='object' && module.exports;
  const api=factory(node?require('./online-context-data.json'):root.ONLINE_CONTEXT_DATA,node?require('./provided-context.js'):root.ProvidedContext);
  if(node)module.exports=api;else root.OnlineContext=api;
})(globalThis,function(defaultBundle,P) {
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v));
  function apply(input,bundle=defaultBundle) {
    if(input.onlineContextHistory!==undefined&&!Array.isArray(input.onlineContextHistory))return clone(input);
    const working=clone(input),original=working.providedContextHistory;
    working.providedContextHistory=working.onlineContextHistory||[];
    let next=P.apply(working,bundle);
    // Upgrade the exact temporary browser-preview revision without treating an
    // author-modified record as generated data. Keep both recoverable versions.
    if(bundle.previousVersion){
      const upgrades={};
      for(const source of next.sources){
        const e=bundle.entries[source.id];
        if(!e?.previousUpdates||!next.providedContextHistory.some(h=>h.id===bundle.previousVersion+':'+source.id))continue;
        const previous={entries:{[source.id]:{...e,updates:e.previousUpdates}}};
        if(!P.verified(source,previous))continue;
        const expected=clone(e.expected);
        for(const f of e.previousUpdates){const old=expected.find(x=>x.key===f.key);if(old)old.value=f.value;else expected.push(clone(f));}
        upgrades[source.id]={...e,expected,expectedContext:[]};
      }
      next=P.apply(next,{...bundle,entries:upgrades});
    }
    if(next.providedContextHistory.length || input.onlineContextHistory!==undefined)next.onlineContextHistory=next.providedContextHistory;
    if(original===undefined)delete next.providedContextHistory;else next.providedContextHistory=original;
    return next;
  }
  const verified=(source,bundle=defaultBundle)=>P.verified(source,bundle);
  const entry=(source,bundle=defaultBundle)=>verified(source,bundle)?bundle.entries[source.id]:null;
  function safeLink(value) {try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
  return {apply,verified,entry,safeLink};
});
