// Semantic document roles, shared by the importer, editor and reading exports.
// This is a finite rendering vocabulary, never arbitrary HTML/CSS from tags.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OutlineStructure=api;})(globalThis,function(){
  'use strict';
  const VERSION='document-structure-2026-09-08';
  const roles=['ordered-item','unordered-item','description-item','heading','figure','table','caption','table-note','abstract','quote','code-block','equation','accessible-description'];
  const get=(b,k)=>b?.fields?.find(f=>f.key===k)?.value||'';
  const set=(b,k,v)=>{const f=b.fields.find(f=>f.key===k);if(f)f.value=String(v);else b.fields.push({key:k,value:String(v)});};
  const walk=(bs,fn,depth=0)=>bs.forEach(b=>{fn(b,depth);walk(b.children,fn,depth+1);});
  const keys=['Structure imported','LaTeX environments','Contained LaTeX environments','LaTeX environment','List group','List depth','List start','List number','List label','Heading level','Float placement','Float width','LaTeX label'];
  const definitions=()=>({id:'document-structure',name:'Document structure',collapsed:false,children:roles.map(id=>({id,name:'#'+id,collapsed:false,children:[]}))});
  const listKind=b=>['ordered-item','unordered-item','description-item'].find(r=>b.tags?.includes(r));
  const role=b=>roles.find(r=>b.tags?.includes(r));
  const roleGroup=id=>['ordered-item','unordered-item','description-item'].includes(id)?['ordered-item','unordered-item','description-item']:['heading','figure','table','quote','code-block','equation'].includes(id)?['heading','figure','table','quote','code-block','equation']:[];
  function toggle(b,id,on){b.tags=b.tags||[];if(on)b.tags=[...b.tags.filter(t=>!roleGroup(id).includes(t)),id];else b.tags=b.tags.filter(t=>t!==id);b.tags=[...new Set(b.tags)];}
  function uncomment(line){for(let i=0;i<line.length;i++)if(line[i]==='%'){let n=0;for(let j=i-1;j>=0&&line[j]==='\\';j--)n++;if(n%2===0)return line.slice(0,i);}return line;}
  function scan(tex){
    const byLine={},stack=[],environments=new Set();
    tex.split(/\r?\n/).forEach((raw,i)=>{
      const text=uncomment(raw),line=i+1;
      const tokens=/\\(begin|end)\{([^}]+)\}(?:\[([^\]]*)\])?|\\item(?:\[([^\]]*)\])?/g;let m;
      while((m=tokens.exec(text))){
        if(m[1]==='begin'){const entry={name:m[2],line,options:m[3]||'',count:0};stack.push(entry);environments.add(entry.name);}
        else if(m[1]==='end'){const index=stack.map(x=>x.name).lastIndexOf(m[2]);if(index>=0)stack.splice(index);}
        else{const lists=stack.filter(x=>['enumerate','itemize','description'].includes(x.name)),last=lists.at(-1);if(last){last.count++;byLine[line]={envs:stack.map(x=>x.name),list:last.name,group:'latex-list-'+last.line,depth:lists.length,start:Number(last.options.match(/(?:^|,)\s*start\s*=\s*(\d+)/)?.[1]||1),number:last.count,label:m[4]||''};}}
      }
      byLine[line]||={envs:stack.map(x=>x.name)};
    });
    return {byLine,environments:[...environments]};
  }
  function blueprint(doc,tex){
    const scanned=scan(tex),blocks={};
    function visit(bs,headingDepth=1){for(const b of bs){
      const raw=get(b,'Original LaTeX'),line=Number(get(b,'Source lines').split(/[–-]/)[0]),context=scanned.byLine[line],fields={},tags=[];
      const kind=b.type==='paragraph'&&b.text==='Table note'?'Table note':get(b,'Text kind')||get(b.children?.[0],'Text kind');
      if(context?.envs.length)fields['LaTeX environments']=JSON.stringify(context.envs);
      if(b.type==='section'){tags.push('heading');fields['Heading level']=Math.min(6,headingDepth+1);}
      if(['table','figure'].includes(b.type)){tags.push(b.type);const env=raw.match(/\\begin\{([^}]+)\}(?:\[([^\]]*)\])?/);if(env){fields['LaTeX environment']=env[1];fields['Float placement']=env[2]||'';fields['Float width']=env[1].endsWith('*')?'full-width':'column';}const label=raw.match(/\\label\{([^}]+)\}/);if(label)fields['LaTeX label']=label[1];fields['Contained LaTeX environments']=JSON.stringify([...raw.matchAll(/\\begin\{([^}]+)\}/g)].map(m=>m[1]));}
      if(b.type==='paragraph'){
        const map={'Caption':'caption','Table note':'table-note','Accessible description':'accessible-description','Abstract':'abstract'};
        if(map[kind])tags.push(map[kind]);
        if(kind==='List item'&&context?.list){tags.push({enumerate:'ordered-item',itemize:'unordered-item',description:'description-item'}[context.list]);Object.assign(fields,{'LaTeX environment':context.list,'List group':context.group,'List depth':context.depth,'List start':context.start,'List number':context.start+context.number-1,'List label':context.label});}
        else if(kind==='List item')tags.push('unordered-item');
        if(context?.envs.some(x=>['quote','quotation'].includes(x)))tags.push('quote');
      }
      if(b.id==='analysis-sq2'){tags.push('unordered-item');fields['List group']='outline-secondary-sq2';fields['List depth']=1;}
      const env=raw.match(/^\s*\\begin\{(verbatim|lstlisting|equation\*?|align\*?)\}/)?.[1];
      if(env){tags.push(/verbatim|lstlisting/.test(env)?'code-block':'equation');fields['LaTeX environment']=env;}
      if(tags.length)blocks[b.id]={tags:[...new Set(tags)],fields};
      visit(b.children,headingDepth+(b.type==='section'?1:0));
    }}visit(doc.blocks);
    return {version:VERSION,sourceHash:doc.manuscript?.sha256,documentClass:tex.match(/\\documentclass(?:\[([^\]]*)\])?\{([^}]+)\}/)?.slice(1)||[],environments:scanned.environments,blocks};
  }
  function apply(doc,plan){
    const next=JSON.parse(JSON.stringify(doc));
    if(next.documentStructure?.version===plan.version)return next;
    if(next.manuscript?.sha256!==plan.sourceHash)throw Error('Document structure belongs to a different LaTeX baseline.');
    const found=new Map();function tags(bs){for(const b of bs){found.set(b.id,b);tags(b.children)}}tags(next.tagTree);
    if(roles.some(id=>found.has(id))||found.has('document-structure'))throw Error('A structural tag ID already exists. Export the saved copy and resolve the tag conflict first.');
    next.tagTree.push(definitions());
    walk(next.blocks,b=>{const entry=plan.blocks[b.id];if(!entry)return;
      // Structural additions never substitute prose, assets, citations, author
      // fields, source reviews or author-created/custom tags.
      for(const [k,v] of Object.entries(entry.fields))if(!b.fields.some(f=>f.key===k))set(b,k,v);
      if(!b.tags.some(t=>roles.includes(t)))b.tags.push(...entry.tags);
      set(b,'Structure imported',plan.version);
    });
    next.documentStructure={version:plan.version,sourceHash:plan.sourceHash,documentClass:plan.documentClass,environments:plan.environments};
    return next;
  }
  function signature(value){return JSON.stringify(value,(k,v)=>k==='collapsed'?undefined:k==='tags'?v.filter(t=>!roles.includes(t)):k==='fields'?v.filter(f=>!keys.includes(f.key)):v);}
  function carry(old,b){if(!old)return;for(const key of keys)if(old.fields.some(f=>f.key===key))set(b,key,get(old,key));b.tags=[...new Set([...b.tags.filter(t=>!roles.includes(t)),...old.tags.filter(t=>roles.includes(t))])];}
  // A rendering plan carries references to the same editable blocks. It does
  // not duplicate/rewrite the document or turn bibliography children into text.
  function project(blocks){
    function group(nodes){const out=[],stack=[];for(const n of nodes){
      if(n.kind!=='item'){out.push(n);stack.length=0;continue;}
      const level=Math.max(1,Math.min(16,Number(get(n.block,'List depth')||get(n.host,'List depth'))||1));
      const key=get(n.block,'List group')||get(n.host,'List group')||'siblings';
      while(stack.length&&(stack.at(-1).level>level||stack.at(-1).level===level&&(stack.at(-1).node.style!==n.style||stack.at(-1).key!==key)))stack.pop();
      let current=stack.at(-1);
      if(!current||current.level!==level){const list={kind:'list',style:n.style,children:[],start:Math.max(1,Number(get(n.block,'List start')||get(n.host,'List start'))||1)};if(current?.node.children.length)current.node.children.at(-1).children.push(list);else out.push(list);current={node:list,level,key};stack.push(current);}
      current.node.children.push(n);
    }return out;}
    function convert(b,depth){
      const own=role(b);
      if(b.type==='sentence'){const node={kind:'paragraph',block:b,host:b,sentences:[b],children:[],listItem:!!listKind(b)};return listKind(b)?[{kind:'item',style:listKind(b),block:b,host:b,children:[node]}]:[node];}
      if(b.type==='section'||own==='heading')return[{kind:'section',block:b,level:Math.max(2,Math.min(6,Number(get(b,'Heading level'))||depth+2)),children:group(b.children.filter(c=>!['citation','reference'].includes(c.type)).flatMap(c=>convert(c,depth+1)))}];
      if(['table','figure'].includes(own)||!own&&['table','figure'].includes(b.type))return[{kind:own||b.type,block:b,children:group(b.children.filter(c=>c.type!=='table-row'&&!c.id.includes('-row')).flatMap(c=>convert(c,depth)))}];
      if(['code-block','equation'].includes(own))return[{kind:own,block:b,children:[]}];
      if(b.type==='note'){const node={kind:'note',block:b,children:group(b.children.flatMap(c=>convert(c,depth)))};return listKind(b)?[{kind:'item',style:listKind(b),block:b,host:b,children:[node]}]:own==='quote'?[{kind:'quote',block:b,children:[node]}]:[node];}
      if(b.type!=='paragraph')return[];
      const nested=group(b.children.filter(c=>c.type!=='sentence').flatMap(c=>convert(c,depth)));
      const sentences=b.children.filter(c=>c.type==='sentence'),items=[];
      const explicit=sentences.some(s=>listKind(s));
      if(listKind(b)&&!explicit){items.push({kind:'item',style:listKind(b),block:b,host:b,children:[{kind:'paragraph',block:b,host:b,sentences,children:[],listItem:true},...nested]});}
      else if(explicit){let run=[];const flush=()=>{if(run.length){items.push({kind:'paragraph',block:run[0],host:b,sentences:run,children:[]});run=[];}};for(const s of sentences){const style=listKind(s);if(style){flush();items.push({kind:'item',style,block:s,host:b,children:[{kind:'paragraph',block:s,host:b,sentences:[s],children:[],listItem:true}]});}else run.push(s);}flush();items.push(...nested);}
      else items.push({kind:'paragraph',block:b,host:b,sentences,children:nested});
      return own==='quote'?[{kind:'quote',block:b,children:group(items)}]:items;
    }
    return group(blocks.flatMap(b=>convert(b,0)));
  }
  return {VERSION,roles,keys,definitions,scan,blueprint,apply,signature,carry,project,role,listKind,toggle};
});
