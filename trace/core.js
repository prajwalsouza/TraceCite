(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./structure.js') : root.OutlineStructure, typeof module === 'object' && module.exports ? require('./source-passages.js') : root.SourcePassages, typeof module === 'object' && module.exports ? require('./source-context.js') : root.SourceContext);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OutlineCore = api;
})(globalThis, function (S, P, X) {
  'use strict';
  const T = typeof module === 'object' && module.exports ? require('./table-blocks.js') : globalThis.TableBlocks;
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => globalThis.crypto?.randomUUID?.() || 'b-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const fields = object => Object.entries(object).map(([key, value]) => ({ key, value: String(value) }));
  const get = (block, key) => block?.fields?.find(field => field.key === key)?.value || '';
  const mediaAsset = block => /^assets\/media\/[a-zA-Z0-9_-]+\.mp4$/.test(get(block,'Video asset')) ? get(block,'Video asset') : '';
  const set = (block, key, value) => {
    const field = block.fields.find(field => field.key === key);
    if (field) field.value = String(value); else block.fields.push({ key, value: String(value) });
  };
  function walk(blocks, fn, parent = null, depth = 0) {
    blocks.forEach((block, index) => { fn(block, parent, index, depth); walk(block.children, fn, block, depth + 1); });
  }
  function locate(doc, id) {
    let found = null;
    for (const rootKey of ['blocks', 'sources', 'workPlan']) {
      walk(doc[rootKey] || [], (block, parent, index, depth) => {
        if (block.id === id) found = { block, parent, index, depth, rootKey, siblings: parent ? parent.children : doc[rootKey] };
      });
    }
    return found;
  }
  function makeBlock(type = 'note', text = '') {
    return { id: uid(), type, text, tags: type === 'sentence' ? ['support-recheck'] : [], collapsed: false, fields: fields(type === 'sentence' ? { Status: 'Needs checking' } : {}), children: [] };
  }
  function add(doc, id, position = 'after') {
    const loc = locate(doc, id);
    if (!loc) return null;
    if(T.isRow(loc.block)&&position==='child'&&T.cells(loc.block).length)return add(doc,T.cells(loc.block).at(-1).id,'after');
    if(T.isCell(loc.block)&&position==='after'){
      const ctx=T.context(doc,id,{locate});let selected;
      // A sibling cell is a new column, so other rows keep their alignment.
      for(const row of T.blockRows(ctx.table)){
        while(T.cells(row).length<=ctx.index)row.children.push(makeBlock('table-cell'));
        const cell=makeBlock('table-cell'),anchor=T.cells(row)[ctx.index];row.children.splice(row.children.indexOf(anchor)+1,0,cell);
        if(row===ctx.row)selected=cell.id;
      }
      return selected;
    }
    if(T.isTable(loc.block)&&T.migrated(loc.block)&&position==='child'||T.isRow(loc.block)&&position==='after'){
      const table=T.isRow(loc.block)?loc.parent:loc.block,rows=T.blockRows(table),row=makeBlock('table-row','Row');
      row.fields=fields({'Table header':'no'});row.children=Array.from({length:Math.max(1,...rows.map(r=>T.cells(r).length))},()=>makeBlock('table-cell'));
      const anchor=T.isRow(loc.block)?loc.block:rows.at(-1);table.children.splice(table.children.indexOf(anchor)+1,0,row);table.collapsed=false;return row.id;
    }
    const type = position === 'child' ? ({ paragraph: 'sentence', sentence: 'citation', citation: 'reference' }[loc.block.type] || 'note') : loc.block.type;
    const next = makeBlock(type);
    if (position === 'child') { loc.block.children.push(next); loc.block.collapsed = false; }
    else loc.siblings.splice(loc.index + 1, 0, next);
    return next.id;
  }
  function indent(doc, id) {
    const loc = locate(doc, id);
    if (!loc || loc.index === 0 || loc.depth >= 30) return false;
    const previous = loc.siblings[loc.index - 1];
    if(T.isRow(loc.block)||T.isCell(loc.block)||T.isRow(previous)||T.isCell(previous))return false;
    loc.siblings.splice(loc.index, 1); previous.children.push(loc.block); previous.collapsed = false;
    return true;
  }
  function outdent(doc, id) {
    const loc = locate(doc, id);
    if (!loc?.parent) return false;
    if(T.isRow(loc.block)||T.isCell(loc.block))return false;
    const parent = locate(doc, loc.parent.id);
    loc.siblings.splice(loc.index, 1); parent.siblings.splice(parent.index + 1, 0, loc.block);
    return true;
  }
  function move(doc, id, direction) {
    const loc = locate(doc, id);
    if (!loc || loc.index + direction < 0 || loc.index + direction >= loc.siblings.length) return false;
    if(T.isCell(loc.block))return false; // Column moves need an explicit whole-column command.
    if(T.isRow(loc.block)&&(get(loc.block,'Table header')==='yes'||!T.isRow(loc.siblings[loc.index+direction])||get(loc.siblings[loc.index+direction],'Table header')==='yes'))return false;
    loc.siblings.splice(loc.index, 1); loc.siblings.splice(loc.index + direction, 0, loc.block); return true;
  }
  function remove(doc, id) {
    const loc = locate(doc, id);
    if (!loc) return false;
    if(T.isRow(loc.block)&&get(loc.block,'Table header')==='yes')return false;
    if(T.isCell(loc.block)){
      const ctx=T.context(doc,id,{locate});if(T.cells(ctx.row).length<=1)return false;
      for(const row of T.blockRows(ctx.table)){const cell=T.cells(row)[ctx.index];if(cell)row.children.splice(row.children.indexOf(cell),1);}
      return true;
    }
    loc.siblings.splice(loc.index, 1); return true;
  }
  function validate(input) {
    if (!input || ![1, 2].includes(input.version) || typeof input.title !== 'string' || input.title.length > 2000 || !Array.isArray(input.blocks) || !Array.isArray(input.sources)) throw Error('This is not a Trace outline JSON file.');
    const tagIds = new Set();
    function visitTags(tags, depth = 0) {
      if (!Array.isArray(tags) || depth > 16) throw Error('Invalid tag hierarchy.');
      for (const tag of tags) {
        if (!tag || !/^[a-zA-Z0-9_-]{1,128}$/.test(tag.id) || tagIds.has(tag.id) || typeof tag.name !== 'string' || !tag.name.trim() || tag.name.length > 120 || tagIds.size > 500) throw Error('Each tag needs a unique ID and a short name.');
        tagIds.add(tag.id); visitTags(tag.children, depth + 1);
      }
    }
    if (input.version === 2) visitTags(input.tagTree);
    const ids = new Set(); let count = 0;
    function visit(blocks, depth = 0) {
      if (depth > 32) throw Error('The outline is deeper than 32 levels.');
      for (const b of blocks) {
        if (++count > 10000) throw Error('The outline exceeds 10,000 blocks.');
        if (!b || typeof b.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(b.id) || ids.has(b.id)) throw Error('Every block needs a unique ID using letters, numbers, dashes, or underscores.');
        ids.add(b.id);
        if (typeof b.text !== 'string' || b.text.length > 50000 || !['section', 'table', 'table-row', 'table-cell', 'figure', 'paragraph', 'sentence', 'citation', 'reference', 'note', 'source'].includes(b.type) || !Array.isArray(b.children) || !Array.isArray(b.fields)) throw Error('A block has invalid text, type, fields, or children.');
        if (input.version === 2 && (!Array.isArray(b.tags) || new Set(b.tags).size !== b.tags.length || b.tags.some(id => !tagIds.has(id)))) throw Error('A block refers to an unknown or duplicate tag.');
        if (b.fields.length > 100 || b.fields.some(f => !f || typeof f.key !== 'string' || typeof f.value !== 'string' || f.key.length > 200 || f.value.length > 50000)) throw Error('A block has invalid properties.');
        visit(b.children, depth + 1);
      }
    }
    visit(input.blocks); visit(input.sources);
    if (input.workPlan !== undefined) {
      if (!Array.isArray(input.workPlan)) throw Error('Invalid work-plan blocks.');
      visit(input.workPlan);
    }
    T.assertStructure(input);
    return clone(input);
  }
  function sourceFor(doc, block) {
    return doc.sources.find(s => s.id === get(block, 'Source ID')) || null;
  }
  function citationSources(doc, sentence) {
    const found = new Map();
    walk(sentence.children, b => { if (get(b, 'Role').startsWith('Audit evidence')) return; const source = sourceFor(doc, b); if (source) found.set(source.id, source); });
    return [...found.values()];
  }
  function readingText(doc, text) {
    if (!doc.presentation?.referenceLabels) return text;
    const labels=doc.presentation.referenceLabels;
    return text.replace(/(?:tab|fig|app):[a-zA-Z0-9-]+/g,key=>typeof labels[key]==='string'?labels[key]:key).replace(/\\eta\b/g,'η');
  }
  function apaSentence(doc, sentence) {
    let text = readingText(doc, sentence.text);
    const sources = citationSources(doc, sentence);
    const extra = sources.filter(s => get(s, 'Year') && !(get(s, 'First author') && text.includes(get(s, 'Year')) && text.includes(get(s, 'First author')))).sort((a, b) => get(a, 'APA citation').localeCompare(get(b, 'APA citation'))).map(s => get(s, 'APA citation')).filter(Boolean);
    if (extra.length) text = text.replace(/[.]$/, '') + ' (' + extra.join('; ') + ').';
    return text;
  }
  const safeUrl = value => { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const escapeMarkdown = value => String(value).replace(/[\\`*_{}\[\]<>]/g, '\\$&').replace(/\n/g, ' ');
  function markdown(doc, includeFields = true) {
    const lines = ['# ' + escapeMarkdown(doc.title), '', 'Sentence → citation → exact reference. Excerpts and their full context are kept together in shared source blocks below.', ''];
    function emit(b, depth = 0) {
      const pad = '  '.repeat(depth);
      lines.push(pad + '- ' + escapeMarkdown(b.text || '(empty block)') + ' ^' + b.id);
      if (b.tags?.length) lines.push(pad + '  - Tags:: ' + b.tags.map(id => tagPath(doc, id)).join('; '));
      if (includeFields) for (const f of b.fields) {
        if (f.key === 'Source ID') lines.push(pad + '  - Source block: [exact excerpt and reference](#' + encodeURIComponent(f.value) + ')');
        else if (f.key === 'Full context paragraphs' && f.value) {
          lines.push(pad + '  - Full context paragraphs::');
          f.value.split('\n').forEach(line => lines.push(pad + '    > ' + escapeMarkdown(line)));
        }
        else if (f.key === 'Full context blocks' && f.value) {
          try {
            const blocks=JSON.parse(f.value);
            if(!Array.isArray(blocks))throw Error('Not source blocks');
            for(const block of blocks){const url=safeUrl(block.url);lines.push(pad+'  - Source block location:: '+escapeMarkdown(block.location)+(url?' — [original passage]('+url+')':''));}
          }catch{lines.push(pad+'  - '+escapeMarkdown(f.key)+':: '+escapeMarkdown(f.value));}
        }
        else lines.push(pad + '  - ' + escapeMarkdown(f.key) + ':: ' + escapeMarkdown(f.value));
      }
      b.children.forEach(child => emit(child, depth + 1));
    }
    doc.blocks.forEach(b => { emit(b); lines.push(''); });
    if (doc.workPlan?.length) {
      lines.push('## Revision work plan', '', 'Planning blocks, separate from manuscript prose and APA export.', '');
      doc.workPlan.forEach(b => { emit(b); lines.push(''); });
    }
    lines.push('## Shared exact-source blocks', '');
    doc.sources.forEach(b => { lines.push('<a id="' + b.id + '"></a>'); emit(b); lines.push(''); });
    return lines.join('\n');
  }
  function apaMarkdown(doc) {
    const lines = ['# ' + doc.title, '', 'APA-style reading projection; the evidence blocks remain in the outline JSON.', ''];
    function emit(n,pad='') {
      const b=n.block;
      if(n.kind==='section')lines.push(pad+'#'.repeat(n.level)+' '+b.text,'');
      if(n.kind==='paragraph'){
        if(!n.listItem&&!get(n.host,'Source file')&&n.host.type==='paragraph'&&!n.host.tags?.some(t=>['caption','table-note','abstract','accessible-description'].includes(t)))lines.push(pad+'### '+n.host.text,'');
        const text=n.sentences.map(s=>apaSentence(doc,s)).join(' ');
        lines.push(pad+(n.host.tags?.includes('caption')?'*'+text+'*':n.host.tags?.includes('table-note')?'Note. '+text.replace(/^Note\.\s*/, ''):text),'');
      }
      if(n.kind==='table'){
        lines.push(pad+'**'+b.text+'**','');
        try {const rows=T.matrix(b).map(r=>r.map(v=>v.replace(/\|/g,'\\|').replace(/\n/g,'<br>')));lines.push(pad+'| '+rows[0].join(' | ')+' |',pad+'| '+rows[0].map(()=>'---').join(' | ')+' |',...rows.slice(1).map(row=>pad+'| '+row.join(' | ')+' |'),'');}catch{lines.push(pad+get(b,'Display table'),'');}
      }
      if(n.kind==='figure'){
        lines.push(pad+'**'+b.text+'**','');
        if(mediaAsset(b))lines.push(pad+'[Play or download the MP4]('+mediaAsset(b)+')','');
        try{for(const asset of JSON.parse(get(b,'Assets')))if(/^(?:images|figures)\/[a-zA-Z0-9_./-]+\.(png|jpg|pdf|svg)$/i.test(asset)&&!asset.includes('..'))lines.push(pad+(/\.pdf$/i.test(asset)?'[':'![')+escapeMarkdown(b.text)+'](assets/manuscript/'+asset+')','');}catch{/* Original asset fields remain in JSON. */}
      }
      if(n.kind==='note')lines.push(pad+b.text,'');
      if(n.kind==='code-block'||n.kind==='equation')lines.push(pad+'```'+(n.kind==='equation'?'latex':get(b,'Language')),pad+(get(b,'Code')||get(b,'Math source')||b.text).split('\n').join('\n'+pad),pad+'```','');
      if(n.kind==='quote'){n.children.forEach(c=>emit(c,pad+'> '));return;}
      if(n.kind==='list'){
        n.children.forEach((item,i)=>{const start=lines.length;item.children.forEach(c=>emit(c,pad+'    '));const marker=n.style==='ordered-item'?(n.start+i)+'. ':n.style==='description-item'?'**'+(get(item.block,'List label')||item.block.text)+'** — ':'- ';const first=lines.findIndex((line,j)=>j>=start&&line.trim());if(first>=0)lines[first]=pad+marker+lines[first].trimStart();});return;
      }
      n.children?.forEach(child=>emit(child,pad));
    }
    S.project(doc.blocks).forEach(n=>emit(n));
    lines.push('## References', '');
    const cited = new Map(); walk(doc.blocks, b => { if (get(b, 'Role').startsWith('Audit evidence')) return; const source = sourceFor(doc, b); if (source && get(source, 'APA reference')) cited.set(source.id, source); });
    [...cited.values()].sort((a, b) => get(a, 'APA reference').localeCompare(get(b, 'APA reference'))).forEach(s => lines.push(get(s, 'APA reference'), ''));
    return lines.join('\n');
  }
  function tagNodes(doc) {
    const result = [];
    function visit(nodes, parent = null, path = []) { nodes.forEach(tag => { const names = [...path, tag.name]; result.push({ tag, parent, path: names }); visit(tag.children, tag, names); }); }
    visit(doc.tagTree || []); return result;
  }
  function tagPath(doc, id) { return tagNodes(doc).find(x => x.tag.id === id)?.path.join(' / ') || id; }
  function descendants(doc, id) {
    const tag = tagNodes(doc).find(x => x.tag.id === id)?.tag; const result = new Set();
    function visit(t) { result.add(t.id); t.children.forEach(visit); }
    if (tag) visit(tag); return result;
  }
  function taggedSentences(doc, id) {
    const ids = descendants(doc, id), result = [];
    walk(doc.blocks, block => { if (block.type === 'sentence' && block.tags?.some(tag => ids.has(tag))) result.push(block); });
    return result;
  }
  function taggedBlocks(doc,id) {const ids=descendants(doc,id),result=[];walk(doc.blocks,b=>{if(b.tags?.some(tag=>ids.has(tag)))result.push(b);});return result;}
  function moveTag(doc, id, parentId) {
    const entry = tagNodes(doc).find(x => x.tag.id === id);
    const parent = parentId ? tagNodes(doc).find(x => x.tag.id === parentId)?.tag : null;
    if (!entry || (parentId && !parent) || descendants(doc, id).has(parentId)) return false;
    const siblings = entry.parent ? entry.parent.children : doc.tagTree;
    siblings.splice(siblings.indexOf(entry.tag), 1); (parent ? parent.children : doc.tagTree).push(entry.tag); return true;
  }
  function invalidate(block) {
    if (block.type !== 'sentence' && !(['table-row','table-cell'].includes(block.type)&&block.tags?.some(t=>t.startsWith('support-')))) return;
    set(block, 'Status', 'Needs rechecking'); set(block, 'Audit status', 'Changed since sentence review');
    block.tags = [...(block.tags || []).filter(t => !t.startsWith('support-')), 'support-recheck'];
  }
  async function packBackup(text) {
    if(typeof CompressionStream==='undefined') return text;
    const stream=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
    let binary=''; for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
    return JSON.stringify({backupEncoding:'gzip-base64-v1',data:btoa(binary)});
  }
  async function unpackBackup(text) {
    const value=JSON.parse(text);
    if(value.backupEncoding!=='gzip-base64-v1')return text;
    const bytes=Uint8Array.from(atob(value.data),char=>char.charCodeAt(0));
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  async function compactRecoveryCopies(storage,key) {
    const suffixes=['-before-meeting-work','-before-hypothesis-revision','-before-measurement-revision','-before-analysis-integration','-before-document-structure'];
    let saved=0;
    for(const suffix of suffixes){
      const target=key+suffix,initial=storage.getItem(target);if(!initial)continue;
      try{
        const raw=await unpackBackup(initial);validate(JSON.parse(raw));
        const packed=await packBackup(raw);
        if(packed.length>=initial.length||await unpackBackup(packed)!==raw||storage.getItem(target)!==initial)continue;
        storage.setItem(target,packed);saved+=initial.length-packed.length;
      }catch{/* A malformed, changed or unwritable backup stays untouched. */}
    }
    return saved;
  }
  // A reviewed patch is explicit and atomic. Never substitute the latest seed
  // for saved manuscript edits. Fold state alone is safe to carry forward.
  function applyOutlineRevision(input, patch) {
    const doc = validate(input);
    if (doc.appliedOutlineRevisions?.includes(patch.id)) return doc;
    if (patch.requires?.some(id=>!doc.appliedOutlineRevisions?.includes(id))) throw Error('Apply the preceding outline revision first. No revision was applied.');
    if (doc.manuscript?.sha256 !== patch.sourceHash) throw Error('The LaTeX baseline differs. No revision was applied.');
    const signature = S.signature;
    // An explicit patch may carry a wholly untouched child through its parent
    // replacement. Never use this exemption for a child the patch also edits.
    const preserved=new Map();
    for(const id of patch.preserveUnchanged || []) {
      const root=patch.roots.find(r=>locate({blocks:[r.before],sources:[]},id));
      const prior=root&&locate({blocks:[root.before],sources:[]},id)?.block;
      const after=root&&locate({blocks:[root.after],sources:[]},id)?.block;
      const current=locate(doc,id)?.block;
      if(!prior||!after||!current||id===root.id||signature(prior)!==signature(after))throw Error('An untouched child needs a manual merge: '+id+'. No revision was applied.');
      preserved.set(id,current);
    }
    const conflicts = patch.roots.filter(r => {
      const expected=clone(r.before);
      for(const [id,current] of preserved){const loc=locate({blocks:[expected],sources:[]},id);if(loc)loc.siblings[loc.index]=clone(current);}
      return signature(locate(doc,r.id)?.block)!==signature(expected);
    });
    if (conflicts.length) throw Error('Saved edits need a manual merge in: ' + conflicts.map(r => r.before.text).join('; ') + '. No revision was applied.');
    const sourceSignature=value=>JSON.stringify(value,(key,val)=>key==='collapsed'?undefined:val);
    const sourceConflicts=(patch.sources||[]).filter(s=>sourceSignature(doc.sources.find(b=>b.id===s.id)||null)!==sourceSignature(s.before));
    if(sourceConflicts.length) throw Error('Saved source edits need a manual merge: '+sourceConflicts.map(s=>s.id).join(', ')+'. No revision was applied.');
    const revisionTag = tagNodes(doc).find(t => t.tag.id === 'revision')?.tag;
    if (!revisionTag) throw Error('The Revision tag is missing. No revision was applied.');
    if (tagNodes(doc).some(t => t.tag.id === patch.tag.id)) throw Error('The revision tag already exists without its revision record. No revision was applied.');
    for (const root of patch.roots) {
      const location = locate(doc,root.id), folds = new Map(), originals=new Map();
      walk([location.block], b => {folds.set(b.id,b.collapsed);originals.set(b.id,b);});
      const replacement = clone(root.after);
      for(const [id,current] of preserved){const loc=locate({blocks:[replacement],sources:[]},id);if(loc)loc.siblings[loc.index]=clone(current);}
      walk([replacement], b => { if (folds.has(b.id)) b.collapsed = folds.get(b.id); S.carry(originals.get(b.id),b); });
      location.siblings[location.index] = replacement;
    }
    revisionTag.children.push(clone(patch.tag));
    for(const source of patch.sources||[]) {
      const index=doc.sources.findIndex(s=>s.id===source.id);
      const next=clone(source.after);if(index>=0){next.collapsed=doc.sources[index].collapsed;doc.sources[index]=next;}else doc.sources.push(next);
    }
    for(const change of [patch.task,...(patch.tasks||[])].filter(Boolean)) {
      const task = locate(doc,change.id)?.block;
      if (task) {
        for (const field of change.fields) if (get(task,field.key) === field.before) set(task,field.key,field.after);
        if (change.child&&!locate(doc,change.child.id)) task.children.unshift(clone(change.child));
      }
    }
    doc.appliedOutlineRevisions = [...(doc.appliedOutlineRevisions || []),patch.id];
    Object.assign(doc.manuscript,clone(patch.manuscript));
    return validate(doc);
  }
  function upgrade(input, seed) {
    const old = validate(input);
    if (old.version === 2) {
      // Add the new collection once. Never replace manuscript edits, user task
      // edits or intentionally emptied work-plan arrays with the shipped seed.
      if (old.workPlan === undefined && seed.workPlan) {
        old.workPlan = clone(seed.workPlan); old.workPlanManifest = clone(seed.workPlanManifest);
      }
      return validate(X.apply(P.apply(old)));
    }
    const result = clone(seed);
    const knownDraft = old.blocks.some(b => ['p1', 'p2', 'p3', 'p4'].includes(b.id));
    const baseline = seed.legacyBaseline;
    const signature = b => b ? JSON.stringify({ text: b.text, type: b.type, fields: b.fields, children: b.children.map(c => c.id) }) : '';
    const blockSignatures = blocks => { const entries = []; walk(blocks, b => entries.push([b.id, signature(b)])); return JSON.stringify(entries); };
    const preserveDraft = knownDraft && (!baseline || blockSignatures(old.blocks) !== blockSignatures(baseline.blocks));
    if (preserveDraft) {
      result.tagTree.push({ id: 'saved-draft', name: 'Saved earlier draft', collapsed: false, children: [] });
      result.blocks.push({ id: 'saved-earlier-draft', type: 'section', text: 'Saved earlier draft · your browser edits', collapsed: true, tags: ['saved-draft'], fields: fields({ Purpose: 'Preserved from the earlier browser workspace, not substituted into the current manuscript. Its wording and evidence need rechecking.' }), children: old.blocks });
    } else if (!knownDraft) { result.blocks = old.blocks; result.title = old.title; delete result.manuscript; delete result.appliedOutlineRevisions; }
    if (baseline && old.title !== baseline.title) result.title = old.title;
    if (baseline && old.subtitle !== baseline.subtitle) result.subtitle = old.subtitle;
    const changedSources = new Set();
    const sourceMap = new Map(result.sources.map(s => [s.id, s]));
    old.sources.forEach(s => { if (!baseline || signature(s) !== signature(locate(baseline, s.id)?.block)) { set(s, 'Record status', 'Edited — verify against source'); set(s, 'Checked', 'Needs rechecking'); sourceMap.set(s.id, s); changedSources.add(s.id); } });
    result.sources = [...sourceMap.values()];
    walk([...result.blocks, ...result.sources], b => {
      b.tags ||= [];
      const original = locate(seed, b.id)?.block;
      const unchanged = baseline && signature(b) === signature(locate(baseline, b.id)?.block);
      if (!b.tags.length && original && unchanged && original.text === b.text) {
        b.tags = clone(original.tags);
        ['Audit status','Sentence review','Review basis','Status'].forEach(key => { if (get(original, key)) set(b, key, get(original, key)); });
      }
      if (b.type === 'sentence' && !b.tags.some(t => t.startsWith('support-'))) invalidate(b);
      if (b.type === 'sentence') {
        let affected = false;
        walk(b.children, child => { if (changedSources.has(get(child, 'Source ID'))) affected = true; });
        if (affected) invalidate(b);
      }
    });
    if (preserveDraft) walk(result.blocks.find(b => b.id === 'saved-earlier-draft').children, b => { if (['paragraph','sentence'].includes(b.type)) b.tags.push('saved-draft'); });
    result.version = 2; result.migration = { from: 1, preservedLegacy: true, archivedEditedDraft: preserveDraft };
    return validate(X.apply(P.apply(result)));
  }
  return { clone, uid, fields, get, mediaAsset, set, walk, locate, makeBlock, add, indent, outdent, move, remove, validate, sourceFor, citationSources, readingText, apaSentence, safeUrl, markdown, apaMarkdown, tagNodes, tagPath, descendants, taggedSentences, taggedBlocks, moveTag, invalidate, upgrade, applyOutlineRevision, packBackup, unpackBackup, compactRecoveryCopies, tables:T, structure:S, readingTree:doc=>S.project(doc.blocks), applyStructureRevision:(doc,patch)=>validate(S.apply(validate(doc),patch.blueprint)) };
});
