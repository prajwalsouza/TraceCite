(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReadingPeek=api;})(globalThis,function(){
  'use strict';
  const breakpoint=1280;
  const isWideReading=(view,width)=>view==='apa'&&width>=breakpoint;
  // Categories keep their hue in both rails, including newly added descendants.
  function tagTones(doc){
    const roots={move:'plum',revision:'plum',planning:'plum',role:'blue',support:'amber',topic:'green','learning-topics':'green','document-structure':'blue','collab-workspace':'plum','collab-authors':'amber'};
    const tones=new Map();
    function visit(tags,inherited='neutral'){
      for(const tag of tags||[]){
        const tone=roots[tag.id]||inherited;
        tones.set(tag.id,tone);visit(tag.children,tone);
      }
    }
    visit(doc.tagTree);return tones;
  }
  // Add presentation spans only to known source labels. Never infer a citation
  // from a year alone, change wording, or turn audit-only evidence into a citation.
  function citationParts(doc,sentence,C){
    const text=C.apaSentence(doc,sentence),ranges=[];
    const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    for(const source of C.citationSources(doc,sentence)){
      const label=C.get(source,'APA citation'),year=C.get(source,'Year');
      if(!label||!year)continue;
      const variants=new Set([label,label.replace(/ & /g,' and ')]);
      if(label.endsWith(', '+year)){
        const authors=label.slice(0,-year.length-2);
        for(const author of [authors,authors.replace(/ & /g,' and ')]){
          variants.add(author+' ('+year+')');
          variants.add(author+"'s ("+year+')');variants.add(author+'’s ('+year+')');
        }
      }
      for(const variant of variants){
        const re=new RegExp('(?<![\\p{L}\\p{N}])'+escape(variant).replace(/\s+/g,'\\s+')+'(?![\\p{L}\\p{N}])','gu');
        for(const match of text.matchAll(re))ranges.push({start:match.index,end:match.index+match[0].length});
      }
    }
    const merged=[];
    for(const range of ranges.sort((a,b)=>a.start-b.start||b.end-a.end)){
      const last=merged.at(-1);if(last&&range.start<last.end)last.end=Math.max(last.end,range.end);else merged.push({...range});
    }
    const parts=[];let at=0;
    for(const {start,end} of merged){if(start>at)parts.push({text:text.slice(at,start),citation:false});parts.push({text:text.slice(start,end),citation:true});at=end;}
    if(at<text.length)parts.push({text:text.slice(at),citation:false});return parts;
  }
  // The hover outline is a projection, never a second editable copy.
  const detailKeys=/^(Status|Record status|Role|Relation to this sentence|Sentence review|Evidence scope|Evidence role|Claim|Quote|Exact excerpt|Excerpt|Locator|Page|Pages|Section|Context|Context note|Boundary|Limit|Limitations|APA|DOI|URL|Year|Authors|Title|Checked|Result|Finding|Source lines)$/i;
  function outline(doc,id,C){
    const tags=new Map(C.tagNodes(doc).map(({tag})=>[tag.id,tag.name]));
    function project(block,seen=new Set()){
      if(!block||seen.has(block.id))return null;
      const visited=new Set(seen).add(block.id);
      const children=(block.children||[]).map(child=>project(child,visited)).filter(Boolean);
      const sourceId=C.get(block,'Source ID'),source=sourceId&&doc.sources.find(s=>s.id===sourceId);
      if(source&&!visited.has(source.id))children.push(project(source,visited));
      const fields=(block.fields||[]).filter(f=>detailKeys.test(f.key)&&String(f.value).trim()).map((f,i)=>({id:block.id+'-peek-field-'+i,text:f.key+': '+f.value,tags:[],children:[]}));
      if(fields.length)children.push({id:block.id+'-peek-details',text:'Details',tags:[],children:fields});
      return {id:block.id,type:block.type,text:(C.tables?C.tables.label(doc,block,C):block.text)||block.type,tags:(block.tags||[]).map(id=>({id,name:tags.get(id)||id})),children};
    }
    const target=C.locate(doc,id)?.block;
    // A cell is understood within its row, just as in the stored outline.
    const row=target&&C.tables?.isCell(target)?C.tables.context(doc,id,C)?.row:null;
    return project(row||target);
  }
  return {breakpoint,isWideReading,tagTones,citationParts,outline};
});
