// Table data live in cell text. Reading/export are projections of the same tree.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TableBlocks=api;})(globalThis,function(){
  'use strict';
  const get=(b,k)=>b?.fields?.find(f=>f.key===k)?.value||'';
  const isTable=b=>b.type==='table'||b.tags?.includes('table');
  const isRow=b=>b?.type==='table-row',isCell=b=>b?.type==='table-cell';
  const cells=row=>row.children.filter(isCell);
  const blockRows=table=>table.children.filter(isRow);
  const migrated=table=>get(table,'Table storage')==='cell-blocks-v1';
  const archived=k=>['Table before cell blocks','Display before cell blocks','Row before cell blocks'].includes(k);
  function rows(table){
    if(migrated(table)||blockRows(table).length)return blockRows(table).map(block=>({block,header:get(block,'Table header')==='yes',cells:cells(block).map(block=>({block,text:block.text}))}));
    const data=JSON.parse(get(table,'Rows'));
    if(!Array.isArray(data)||data.some(r=>!Array.isArray(r)||r.some(c=>typeof c!=='string')))throw Error('Table rows must be arrays of text cells.');
    return data.map((r,i)=>({block:null,header:i===0,cells:r.map(text=>({block:null,text}))}));
  }
  const matrix=table=>rows(table).map(r=>r.cells.map(c=>c.text));
  const node=(id,type,text,fields=[])=>({id,type,text,fields,tags:[],collapsed:true,children:[]});
  function migrate(doc,tableId){
    const next=JSON.parse(JSON.stringify(doc)),ids=new Set();let count=0;
    function walk(bs,fn){for(const b of bs||[]){fn(b);walk(b.children,fn);}}
    for(const key of ['blocks','sources','workPlan'])walk(next[key],b=>ids.add(b.id));
    const fresh=(id,type,text,fields)=>{if(ids.has(id)||id.length>128)throw Error('Table block ID collision: '+id);ids.add(id);return node(id,type,text,fields);};
    walk(next.blocks,table=>{
      if(!isTable(table)||migrated(table)||tableId&&table.id!==tableId)return;
      if(blockRows(table).length)throw Error('Partly migrated table: '+table.id);
      const data=matrix(table);if(!data.length||!data[0].length)throw Error('Table has no header: '+table.id);
      const prior=table.children.filter(c=>c.type==='note'&&c.id.startsWith(table.id+'-row')&&/^\d+$/.test(c.id.slice((table.id+'-row').length)));
      if(prior.length&&prior.length!==data.length-1)throw Error('Row count differs from table data: '+table.id);
      // Match by current child order, not the original row-ID number: revised
      // hypothesis tables already reorder their stable row identities.
      prior.forEach((row,i)=>{
        const expected=data[i+1].map((v,j)=>data[0][j]+': '+v).join(' · ');
        if(row.text!==expected)throw Error('Row text and table disagree; review before migration: '+row.id);
      });
      const converted=data.map((values,i)=>{
        const row=i?prior[i-1]||fresh(table.id+'-row'+i,'table-row','Row'):fresh(table.id+'-header','table-row','Header');
        if(prior.includes(row))row.fields.push({key:'Row before cell blocks',value:row.text});
        row.type='table-row';row.text=i?'Row':'Header';row.fields.push({key:'Table header',value:i?'no':'yes'});
        row.children.unshift(...values.map((value,j)=>fresh(row.id+'-cell'+(j+1),'table-cell',value)));
        return row;
      });
      const at=prior.length?table.children.indexOf(prior[0]):0;
      table.children=table.children.filter(c=>!prior.includes(c));table.children.splice(at,0,...converted);
      for(const f of table.fields){if(f.key==='Rows')f.key='Table before cell blocks';if(f.key==='Display table')f.key='Display before cell blocks';}
      table.fields.push({key:'Table storage',value:'cell-blocks-v1'});count++;
    });
    return {doc:next,count};
  }
  function context(doc,id,C){
    const loc=C.locate(doc,id);if(!loc)return null;
    const row=isCell(loc.block)?loc.parent:isRow(loc.block)?loc.block:null;
    if(!isRow(row))return null;
    const table=C.locate(doc,row.id)?.parent;if(!table||!isTable(table))return null;
    const index=isCell(loc.block)?cells(row).indexOf(loc.block):-1;
    const header=blockRows(table).find(r=>get(r,'Table header')==='yes');
    return {table,row,index,column:index<0?'':cells(header||{children:[]})[index]?.text||'Column '+(index+1)};
  }
  function label(doc,block,C){
    const ctx=context(doc,block.id,C);
    if(isRow(block))return block.text==='Row'?cells(block)[0]?.text||'Row':block.text;
    if(isCell(block))return (ctx?.column||'Cell')+': '+(block.text||'(empty)');
    return block.text;
  }
  function assertStructure(doc){
    function visit(bs,parent){for(const b of bs||[]){
      if(isRow(b)&&(!parent||!isTable(parent)))throw Error('A table row must stay inside a table.');
      if(isCell(b)&&!isRow(parent))throw Error('A table cell must stay inside a row.');
      if(isTable(b)&&migrated(b)){
        const rs=blockRows(b);if(rs.filter(r=>get(r,'Table header')==='yes').length!==1||get(rs[0],'Table header')!=='yes')throw Error('A table needs its header row first.');
        if(b.fields.some(f=>['Rows','Display table'].includes(f.key)))throw Error('Edit cell blocks, not a second table-data field.');
      }
      visit(b.children,b);
    }}
    for(const key of ['blocks','sources','workPlan'])visit(doc[key],null);
  }
  return {isTable,isRow,isCell,cells,blockRows,migrated,archived,rows,matrix,migrate,context,label,assertStructure};
});
