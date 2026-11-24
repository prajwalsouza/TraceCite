(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TableEvidence=api;})(globalThis,function(){
  'use strict';
  function resolve(doc,block,C,bundle){
    const ctx=C.tables.context(doc,block.id,C);if(!ctx)return null;
    const binding=bundle?.bindings?.[ctx.row.id];
    if(!binding||binding.tableId!==ctx.table.id)return {context:ctx,available:false};
    const current=C.tables.cells(ctx.row),expected=Object.entries(binding.expectedCells);
    const matches=current.length===expected.length&&expected.every(([id,text])=>current.some(c=>c.id===id&&c.text===text));
    return {context:ctx,available:true,matches,binding,bundle,metric:binding.metricCells[block.id]||binding.metrics[0],rows:bundle.observations.filter(r=>r.condition===binding.condition)};
  }
  function evidence(doc,block,C){
    const ctx=C.tables.context(doc,block.id,C);if(!ctx)return[];
    const ids=new Set(),out=[];
    // Inherit the existing evidence, including references held by captions and
    // table notes, without copying them into every cell or inventing a source.
    function collect(nodes){C.walk(nodes,b=>{const source=C.sourceFor(doc,b);if(source&&!ids.has(source.id)){ids.add(source.id);out.push(source);}});}
    collect([block]);collect(ctx.row.children.filter(b=>!C.tables.isCell(b)));collect(ctx.table.children.filter(b=>!C.tables.isRow(b)));return out;
  }
  const safeAsset=p=>/^assets\/(?:table-evidence|study-evidence|result-traces)\/[a-zA-Z0-9_./-]+\.(?:csv|json|html|py|ipynb|png|pdf)(?:#[a-zA-Z0-9_-]+)?$/.test(p||'')&&!p.includes('..')?p:'';
  function rowAnalysis(doc,block,C){
    const ctx=C.tables.context(doc,block.id,C);if(!ctx)return null;
    const key=C.get(ctx.row,'Original analysis ID')||C.tables.cells(ctx.row)[0]?.text.match(/^(H[1-4][ab])(?:\\textsuperscript\\dagger)?$/)?.[1];if(!key)return null;
    // These are the existing, explicitly named Learning analysis records.
    return evidence(doc,block,C).find(s=>s.id==='audit-learning-'+key.toLowerCase())||null;
  }
  return {resolve,evidence,rowAnalysis,safeAsset};
});
