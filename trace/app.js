(function () {
  'use strict';
  const C = window.OutlineCore;
  const shared = window.TraceShared;
  const paperConfig = window.TRACE_PAPER || {};
  // A named test workspace is a separate, visible sandbox, never the user's data.
  const sandbox = new URLSearchParams(location.search).get('workspace');
  const workspace = sandbox && /^[a-z0-9-]{1,50}$/.test(sandbox) ? sandbox : '';
  const KEY = (paperConfig.storageKey || 'trace-outline-v2') + (workspace ? '-' + workspace : '');
  // Product name is Trace; retain the storage key to preserve all existing work.
  const $ = selector => document.querySelector(selector);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const icon = name => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', { right: 'm9 6 6 6-6 6', down: 'm6 9 6 6 6-6', undo: 'M9 5 4 10l5 5M4 10h9a6 6 0 0 1 0 12', redo: 'm15 5 5 5-5 5m5-5h-9a6 6 0 0 0 0 12' }[name]);
    svg.append(path); return svg;
  };
  const button = (text, className, action, label) => {
    const b = el('button', className, text); b.type = 'button'; b.onclick = action;
    if (label) { b.setAttribute('aria-label', label); b.title = label; }
    return b;
  };
  let doc = C.validate(window.OUTLINE_SEED);
  const requestedView = new URLSearchParams(location.search).get('view');
  let view = ['outline','grounding','work','tags','apa','sources'].includes(requestedView) ? requestedView : 'apa', selectedId = 'ms-front', propertiesId = null, apaEvidenceId = null;
  let editing = false, selectedTag = 'revision';
  // Reading focus is transient UI state, separate from author text and backups.
  let readingSidebarMode = 'tags', hoveredReadingTag = null, keyboardReadingTag = null, pinnedReadingTag = null;
  const readingTagFolds = new Map();
  const wideReadingMedia = matchMedia('(min-width:1280px)');
  let peekId = null, peekOpenTimer, peekCloseTimer;
  let readingFocusMatches = new Map();
  const evidenceOpen = new Set();
  const tagPickersOpen = new Set();
  let query = '', history = [], future = [], editGroup = null, saveTimer, toastTimer;
  let saveBlocked = false, revisionApplying = false;
  let recoveryCompactionTried = false;
  try {
    const saved = shared ? null : localStorage.getItem(KEY);
    const legacy = !paperConfig.id && !shared && !workspace && !saved ? localStorage.getItem('margin-spectacle-outline-v1') : null;
    if (saved || legacy) {
      const previous = JSON.parse(saved || legacy);
      // A recoverable copy precedes the additive collection migration. This
      // never removes or substitutes the browser's manuscript/source edits.
      if (previous.workPlan === undefined && window.OUTLINE_SEED.workPlan) {
        const backupKey = KEY + '-before-meeting-work';
        if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, saved || legacy);
      }
      doc = C.upgrade(previous, window.OUTLINE_SEED);
    }
  } catch (error) {
    saveBlocked = true;
    warning('The saved outline could not be opened. It has not been overwritten. You can export this working copy or import a backup.');
  }
  // An additive, separate planning collection. Never replaces manuscript text.
  if (window.RevisionProposal) doc = window.RevisionProposal.attach(doc);
  function warning(message, actions = []) {
    const box = $('#storage-warning'); box.replaceChildren(el('span', '', message)); box.hidden = false;
    actions.forEach(([label, fn]) => box.append(button(label, '', fn)));
  }
  function toast(message) {
    clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false;
    toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3000);
  }
  function openOutlineBlock(id) {
    view = 'outline'; selectedId = id; query = ''; $('#search').value = '';
    const block = C.locate(doc,selectedId)?.block;
    if (block) block.collapsed = false;
    reveal(selectedId); render(); closeContents();
    document.getElementById('block-' + selectedId)?.scrollIntoView({block:'start'});
  }
  function revisionNotice() {
    if(shared){$('#revision-notice').hidden=true;return;}
    const patches=[window.OUTLINE_HYPOTHESIS_UPDATE,window.OUTLINE_MEASUREMENT_UPDATE,window.OUTLINE_ANALYSIS_UPDATE,window.OUTLINE_STRUCTURE_UPDATE,window.OUTLINE_NARRATIVE_UPDATE,window.OUTLINE_MEETING_ALIGNMENT_UPDATE].filter(Boolean);
    const has=p=>p.kind==='structure'?doc.documentStructure?.version===p.id:doc.appliedOutlineRevisions?.includes(p.id);
    const patch=patches.find(p=>!has(p))||patches.at(-1);
    const box = $('#revision-notice');
    box.replaceChildren(); box.hidden = !patch || saveBlocked;
    if (box.hidden) return;
    const applied = has(patch);
    box.append(el('span','',applied ? patch.notice||'Revision applied in this outline.' : patch.title+' is ready. Saved text and source edits are checked before applying it; LaTeX and PDFs stay unchanged.'));
    const open=()=>{if(patch.kind==='structure'){view='apa';selectedId=patch.focus;query='';$('#search').value='';render();document.getElementById('reading-'+patch.focus)?.scrollIntoView({block:'start'});}else openOutlineBlock(patch.focus||'ms-section-l127');};
    box.append(button(applied ? patch.openButton||'Open hypotheses' : patch.button||'Apply hypothesis revision','',applied ? open : async () => {
      if(revisionApplying)return;
      revisionApplying=true;
      try {
        if (saveBlocked) throw Error('Resolve the storage warning first.');
        const startingState=JSON.stringify(doc);
        const next = patch.kind==='structure'?C.applyStructureRevision(doc,patch):C.applyOutlineRevision(doc,patch);
        // Fail without replacing the working document if recovery or saving is
        // unavailable. This exact browser copy is exportable after the update.
        const key = KEY + (patch.backupSuffix||'-before-hypothesis-revision');
        const prior=await C.unpackBackup(localStorage.getItem(key)||JSON.stringify(doc));
        const packed=await C.packBackup(prior);
        if(await C.unpackBackup(packed)!==prior)throw Error('The recovery copy failed its lossless verification.');
        if(saveBlocked||JSON.stringify(doc)!==startingState)throw Error('The outline changed during backup. Nothing was replaced; retry after your changes are saved.');
        localStorage.setItem(key,packed);
        next.updatedAt = new Date().toISOString();
        localStorage.setItem(KEY,JSON.stringify(next));
        checkpoint(); clearTimeout(saveTimer); doc = next;
        $('#storage-warning').hidden=true;
        $('#save-status').textContent = 'Saved in this browser';
        $('#'+(patch.exportId||'export-before-hypotheses')).hidden = false;
        open(); toast(patch.title+' applied. Previous copy preserved.');
      } catch (error) {
        warning('The revision was not applied. ' + error.message + ' Export JSON to keep your current copy.');
      } finally { revisionApplying=false; }
    }));
  }
  function save() {
    clearTimeout(saveTimer);
    if(shared){shared.queue();return;}
    doc.updatedAt = new Date().toISOString();
    if (saveBlocked) { $('#save-status').textContent = 'Export to keep changes'; return; }
    try {
      localStorage.setItem(KEY, JSON.stringify(doc));
      $('#save-status').textContent = 'Saved in this browser';
    } catch (error) {
      $('#save-status').textContent = 'Not saved';
      warning('Browser storage is unavailable or full. Your current work is still open here. Export JSON to keep it.');
      if(!recoveryCompactionTried && error.name==='QuotaExceededError'){
        recoveryCompactionTried=true;
        C.compactRecoveryCopies(localStorage,KEY).then(saved=>{
          if(saved&&!saveBlocked){$('#storage-warning').hidden=true;save();}
        }).catch(()=>{/* Keep the export warning and every original backup. */});
      }
    }
  }
  function scheduleSave() {
    $('#save-status').textContent = 'Saving…'; clearTimeout(saveTimer); saveTimer = setTimeout(save, 250);
  }
  function checkpoint(group = null) {
    if (group && editGroup === group) return;
    history.push(C.clone(doc)); if (history.length > 80) history.shift(); future = [];
    editGroup = group; updateHistory();
  }
  function change(fn, options = {}) {
    if (!editing) return;
    checkpoint(); fn(); scheduleSave(); render();
    if (options.focus) focusBlock(options.focus);
    if (options.message) toast(options.message);
  }
  function undo() {
    if(shared){toast('Shared changes are recorded in Revision history. Use text-field undo while typing.');return;}
    if (!editing || !history.length) return;
    future.push(C.clone(doc)); doc = history.pop(); editGroup = null; scheduleSave(); render(); toast('Change undone');
  }
  function redo() {
    if(shared)return;
    if (!editing || !future.length) return;
    history.push(C.clone(doc)); doc = future.pop(); editGroup = null; scheduleSave(); render(); toast('Change restored');
  }
  function updateHistory() {
    $('#undo').disabled = $('#dock-undo').disabled = !history.length; $('#redo').disabled = !future.length;
  }
  function select(id) {
    selectedId = id;
    document.querySelectorAll('.block.selected').forEach(n => n.classList.remove('selected'));
    document.getElementById('block-' + id)?.classList.add('selected');
    const block = C.locate(doc, id)?.block;
    $('#dock-selection').textContent = block ? block.type + ' · ' + (block.text || 'Untitled') : 'Select a block';
    $('#dock-add').disabled = $('#dock-fields').disabled = !block;
  }
  function focusBlock(id) {
    if (!editing) return;
    requestAnimationFrame(() => {
      const node = document.getElementById('text-' + id);
      if (node) { node.focus(); const range = document.createRange(); range.selectNodeContents(node); range.collapse(false); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); }
    });
  }
  function reveal(id) {
    let loc = C.locate(doc, id);
    while (loc?.parent) { loc.parent.collapsed = false; loc = C.locate(doc, loc.parent.id); }
  }
  function setView(next) {
    hoveredReadingTag = keyboardReadingTag = null;
    editGroup = null; view = next; query = ''; $('#search').value = ''; render();
  }
  function showSource(id) {
    const source = C.locate(doc, id)?.block; if (!source) return;
    view = 'sources'; query = ''; $('#search').value = ''; propertiesId = editing ? id : null; evidenceOpen.add(id); selectedId = id; source.collapsed = false;
    render(); document.getElementById('block-' + id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  function toggleFields(id) {
    if (!editing) return;
    propertiesId = propertiesId === id ? null : id; select(id); render();
  }
  function addBlock(id, position) {
    if (!editing) return;
    if (!C.locate(doc, id)) return toast('Select a block first.');
    let next;
    change(() => { next = C.add(doc, id, position); markEdited(C.locate(doc, next).block); selectedId = next; reveal(next); const rootKey = C.locate(doc, next).rootKey; view = rootKey === 'sources' ? 'sources' : rootKey === 'workPlan' ? 'work' : view === 'grounding' ? 'grounding' : 'outline'; query = ''; $('#search').value = ''; });
    focusBlock(next); toast(position === 'child' ? 'Child block added' : 'Sibling block added');
  }
  function addRoot() {
    if (!editing) return;
    const source = view === 'sources'; const block = C.makeBlock(source ? 'source' : 'paragraph', source ? 'New source' : 'Untitled paragraph');
    if (source) block.fields = C.fields({ 'APA citation': '', 'First author': '', Year: '', 'APA reference': '', URL: '', DOI: '', Locator: '', 'Exact quote': '', 'Record status': 'Needs checking' });
    if (view === 'work') { block.type = 'note'; block.text = 'New revision task'; block.fields = C.fields({ Status:'Open', Question:'', 'Next change':'', Where:'', 'Done when':'', Owner:'' }); }
    change(() => { (source ? doc.sources : view === 'work' ? doc.workPlan : doc.blocks).push(block); selectedId = block.id; propertiesId = source ? block.id : null; if (!source && view !== 'work') view = 'outline'; query = ''; $('#search').value = ''; }, { focus: block.id });
  }
  function reorder(id, action) {
    if (!editing) return;
    const trial = C.clone(doc);
    const ok = action === 'indent' ? C.indent(trial, id) : action === 'outdent' ? C.outdent(trial, id) : C.move(trial, id, action === 'up' ? -1 : 1);
    if (!ok) return toast('This block cannot move further in that direction.');
    try { C.validate(trial); } catch (error) { return toast(error.message); }
    change(() => { doc = trial; }, { focus: id });
  }
  function deleteBlock(id) {
    if (!editing) return;
    const loc = C.locate(doc, id); if (!loc) return;
    if(C.tables.isRow(loc.block)&&C.get(loc.block,'Table header')==='yes')return toast('Keep the header row; edit its cells instead.');
    if(C.tables.isCell(loc.block)){
      const ctx=C.tables.context(doc,id,C);
      if(C.tables.cells(ctx.row).length<=1)return toast('Keep at least one column. You can clear a cell’s text.');
      if(!confirm('Delete the entire “'+ctx.column+'” column, including its cells and evidence in every row?'))return;
    }
    if (loc.block.children.length && !confirm('Delete this block and all its children? You can undo this change.')) return;
    if (loc.rootKey === 'sources') {
      let uses = 0; C.walk(doc.blocks, b => { if (C.get(b, 'Source ID') === id) uses++; });
      if (uses && !confirm('This source is linked from the outline. Deleting it will leave missing-source warnings. Continue?')) return;
    }
    change(() => { markEdited(loc.block); C.remove(doc, id); selectedId = loc.parent?.id || null; propertiesId = null; }, { message: 'Block removed. Undo is available.' });
  }
  function markEdited(block) {
    C.invalidate(block);
    let loc = C.locate(doc, block.id);
    while (loc?.parent) {
      C.invalidate(loc.parent);
      loc = C.locate(doc, loc.parent.id);
    }
    if (block.type === 'source') {
      C.set(block, 'Record status', 'Edited — verify against source'); C.set(block, 'Checked', 'Needs rechecking');
      C.walk(doc.blocks, b => { if (b.type !== 'sentence') return; let linked = false; C.walk(b.children, child => { if (C.get(child, 'Source ID') === block.id) linked = true; }); if (linked) C.invalidate(b); });
    }
  }
  function markFieldEdited(block,key){
    if(block.type!=='source'&&['List start','List label','List depth','List group','List number','Heading level','Float placement','Float width'].includes(key))C.set(block,'Presentation review','Reading-view properties changed by editor');
    else markEdited(block);
  }
  function statusClass(status) {
    if (/interpretation|Theory|Finding/.test(status)) return ' interpretation';
    if (/proposal|proposition|definition|application/.test(status)) return ' proposal';
    if (/example/.test(status)) return ' example';
    if (/checking/.test(status)) return ' interpretation';
    return '';
  }
  function rowMeta(block) {
    const meta = el('div', 'row-meta'); meta.append(el('span', 'kind-label', block.type));
    const status = C.get(block, block.type === 'source' ? 'Record status' : 'Status');
    if (status && !block.tags?.some(t => t.startsWith('support-'))) meta.append(el('span', 'status' + statusClass(status), status));
    for (const id of block.tags || []) {
      const tag = C.tagNodes(doc).find(x => x.tag.id === id)?.tag; if (!tag) continue;
      const chip = button(tag.name, 'tag-chip ' + (id.startsWith('support-') ? 'support-chip' : id.startsWith('revision') ? 'revision-chip' : ''), () => { selectedTag = id; setView('tags'); }, 'Show tag: ' + C.tagPath(doc, id));
      meta.append(chip);
    }
    if (block.children.length) meta.append(el('span', '', block.children.length + ' ' + (block.type === 'paragraph' ? 'blocks' : 'children')));
    return meta;
  }
  function link(label, url) {
    const safe = C.safeUrl(url); if (!safe) return null;
    const a = el('a', '', label); a.href = safe; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
  }
  function resultContext(block) {
    let location = C.locate(doc,block.id);
    while (location && location.block.type !== 'sentence') location = location.parent ? C.locate(doc,location.parent.id) : null;
    return location ? window.ResultPanel?.resolve(window.RESULT_TRACES,location.block) : null;
  }
  function evidenceCard(block) {
    const source = block.type === 'source' ? block : C.sourceFor(doc, block);
    if (!source) return el('div', 'missing-source', editing ? 'No source is linked yet. Choose a source in the fields.' : 'No source is linked to this block yet.');
    const passage = window.SourcePassages.presentation(source);
    const card = el('section', 'evidence-card'); card.setAttribute('aria-label', passage.complete ? 'Complete source sentence' : 'Source evidence');
    const result = resultContext(block);
    if (result && result.evidenceBlockId === block.id) card.append(window.ResultPanel.render(result));
    const label = el('div', 'evidence-label'); label.append(el('span', '', source.id.startsWith('audit-') ? 'STUDY EVIDENCE' : passage.label), el('span', '', source.text)); card.append(label);
    if (passage.conflict) card.append(el('p', 'edited-warning', passage.conflict));
    const allQuotes = source.fields.filter(f => /^Exact quote(?: \d+)?$/.test(f.key) && f.value);
    const requestedQuote = block.type === 'reference' ? C.get(block, 'Exact supporting extract') : '';
    const specificQuote = requestedQuote && allQuotes.find(f => f.value === requestedQuote);
    const quotes = specificQuote ? [specificQuote] : allQuotes;
    if (requestedQuote && !specificQuote) card.append(el('p', 'edited-warning', 'This reference’s selected extract no longer matches the shared source. All recorded extracts are shown for comparison.'));
    if (quotes.length) quotes.forEach(f => {
      card.append(el('blockquote', '', '“' + f.value + '”'));
      const location = C.get(source, f.key.replace('Exact quote', 'Quote location'));
      if (location) card.append(el('div', 'quote-locator', '↳ ' + location));
    });
    else if (!source.id.startsWith('audit-')) card.append(el('p', 'edited-warning', 'No exact quote recorded. This passage has not been verified.'));
    const context = window.SourceContext.focusPassage(window.SourceContext.presentation(source), specificQuote ? requestedQuote : '');
    if (context) {
      const area = el('details', 'source-context'); area.open = true;
      area.append(el('summary', '', context.full ? (context.fullChecked ? context.contentKind + ' · checked against ' + context.verificationKind : 'Full context · provided text, needs checking') : context.summary.length ? 'Surrounding context · summary, not verbatim' : 'Full paragraph context · pending'));
      if (context.full) {
        const blocks = context.fullBlocks.length ? context.fullBlocks : [{text:context.full,location:context.fullLocation,url:''}];
        let anyMatch = false;
        for (const block of blocks) {
          const full = el('blockquote', 'full-source-context');
          const parts = window.SourceContext.highlightedParts(block.text, quotes.map(f => f.value));
          for (const part of parts) full.append(part.match ? el('mark','',part.text) : document.createTextNode(part.text));
          anyMatch ||= parts.some(p=>p.match);
          area.append(full,el('p','quote-locator', block.location || 'Add the page, section and paragraph location.'));
          const original = window.OnlineContext.safeLink(block.url);
          if(original) area.append(link('Open this source block ↗',original));
        }
        if (context.fullAsset) {
          const pdf = el('a','','Open this paragraph in the PDF ↗'); pdf.href=context.fullAsset; pdf.target='_blank'; pdf.rel='noopener'; area.append(pdf);
        }
        const provenance = el('details','context-provenance');
        provenance.append(el('summary','','Source file & verification'),el('p','evidence-context', context.provenance || 'Provided text; provenance and source verification have not been recorded.'));
        area.append(provenance);
        if(context.license) provenance.append(link('Source reuse license ↗',window.OnlineContext.safeLink(context.license.replace(/^http:/,'https:'))));
        if(!context.fullChecked) area.append(el('p','edited-warning','This full context is not the unchanged source-checked record. Verify the wording and source pairing.'));
        if (!anyMatch) area.append(el('p','edited-warning','The recorded excerpt was not found verbatim in this context. Check the wording and paragraph.'));
      } else if (context.summary.length) {
        for (const paragraph of context.summary) {
          const section = el('div','context-paragraph');
          section.append(el('p','',paragraph.text), el('p','quote-locator',paragraph.location));
          const url = C.safeUrl(paragraph.url);
          if (url) section.append(link('Read original context ↗',url));
          area.append(section);
        }
        if (context.access) area.append(el('p','evidence-context',context.access));
        if (context.warning) area.append(el('p','edited-warning',context.warning));
      } else {
        area.append(el('p','evidence-context',context.invalid ? 'The saved context field could not be read. Its original value is preserved in the source fields.' : 'No surrounding paragraph is stored. The short excerpt alone is not a full-context check.'));
      }
      if (!context.full) area.append(el('p','context-pending','Full verbatim paragraph not stored.'));
      card.append(area);
    }
    if (!C.get(source, 'Quote location')) card.append(el('p', 'locator', 'Location · ' + (C.get(source, 'Locator') || 'Add a precise page, section, and passage location.')));
    if (C.get(source, 'Quote context')) card.append(el('p', 'evidence-context', C.get(source, 'Quote context')));
    if (C.get(source, 'Record status') !== 'Checked excerpt') card.append(el('p', 'edited-warning', C.get(source, 'Record status') || 'This source needs checking.'));
    card.append(el('p', 'source-apa', C.get(source, 'APA reference') || C.get(source, 'Local path') || source.text));
    const links = el('div', 'source-links');
    const url = C.safeUrl(C.get(source, 'URL'));
    const localAsset = C.get(source, 'Local evidence asset');
    if (/^assets\/study-evidence\/[a-z-]+\.(csv|json|html)(#[a-zA-Z0-9-]+)?$/.test(localAsset)) { const a = el('a', '', 'Open checked study record ↗'); a.href = localAsset; a.target = '_blank'; a.rel = 'noopener'; links.append(a); }
    if (url) {
      links.append(link('Open paper ↗', url));
      // Text fragments are a convenience, not a replacement for the explicit locator.
      if (!/\.pdf(?:[?#]|$)/i.test(url) && !url.includes('doi.org') && quotes[0]) links.append(link('Find this passage ↗', url.split('#')[0] + '#:~:text=' + encodeURIComponent(quotes[0].value)));
      else if (/\.pdf/.test(url) && /#page=\d+(?:&|$)/.test(url)) links.append(link('Open located PDF page ↗', url));
    }
    if (block.type !== 'source') links.append(button(editing ? 'Edit shared source fields' : 'View source record ↗', '', () => showSource(source.id)));
    card.append(links);
    const notes = el('details', 'evidence-notes'); notes.append(el('summary', '', 'Support & scope'));
    if (C.get(source, 'Supports')) notes.append(el('p', 'evidence-context', 'Supports · ' + C.get(source, 'Supports')));
    if (C.get(source, 'Boundary')) notes.append(el('p', 'evidence-context', 'Scope · ' + C.get(source, 'Boundary')));
    if (C.get(source, 'Access')) notes.append(el('p', 'evidence-context', 'Checked against · ' + C.get(source, 'Access')));
    if (C.get(source, 'Locator')) notes.append(el('p', 'evidence-context', 'Further location notes · ' + C.get(source, 'Locator')));
    card.append(notes);
    return card;
  }
  function properties(block) {
    const panel = el('section', 'properties'); panel.setAttribute('aria-label', 'Fields for ' + block.type); panel.dataset.owner = block.id;
    const head = el('div', 'properties-head'); head.append(el('span', '', 'Block fields'), el('code', '', block.id), button('×', 'row-action', () => toggleFields(block.id), 'Close fields')); panel.append(head);
    if (block.type === 'reference' || block.type === 'source') panel.append(evidenceCard(block));
    const typeRow = el('div', 'property-row'); const typeLabel = el('label', 'field-label', 'Block type'); const type = el('select'); type.id = 'type-' + block.id; typeLabel.htmlFor = type.id;
    for (const t of ['section', 'table', 'table-row', 'table-cell', 'figure', 'paragraph', 'sentence', 'citation', 'reference', 'note', 'source']) { const option = el('option', '', t); option.value = t; option.disabled=['table-row','table-cell'].includes(t)&&t!==block.type; type.append(option); }
    type.disabled=C.tables.isCell(block)||C.tables.isRow(block)||C.tables.migrated(block);
    type.value = block.type; type.onchange = () => change(() => { block.type = type.value; markEdited(block); }); typeRow.append(typeLabel, type); panel.append(typeRow);
    panel.append(tagPicker(block));
    block.fields.forEach((field, index) => {
      const row = el('div', 'property-row');
      const key = el('input', 'key'); key.value = field.key; key.setAttribute('aria-label', 'Field name ' + (index + 1)); key.dataset.fieldKey = index; key.dataset.block = block.id;
      let value;
      if (field.key === 'Source ID') {
        value = el('select'); value.append(new Option('Choose a source…', ''));
        doc.sources.forEach(s => value.append(new Option(s.text, s.id)));
        if (field.value && !doc.sources.some(s => s.id === field.value)) value.append(new Option('Missing: ' + field.value, field.value));
      } else { value = el('textarea'); value.rows = Math.min(6, Math.max(1, Math.ceil(field.value.length / 72))); }
      value.value = field.value; value.setAttribute('aria-label', field.key || 'Field value'); value.dataset.fieldValue = index; value.dataset.block = block.id;
      if (field.key === 'Source ID') value.onchange = () => change(() => { field.value = value.value; markEdited(block); });
      const remove = button('×', '', () => change(() => { block.fields.splice(index, 1); markFieldEdited(block,field.key); }), 'Remove field ' + field.key);
      if(C.tables.archived(field.key)||['Table storage','Table header'].includes(field.key)){key.disabled=true;value.disabled=true;remove.disabled=true;}
      row.append(key, value, remove); panel.append(row);
    });
    const actions = el('div', 'property-actions');
    if (block.type === 'source' && window.SourceContext.isLiterature(block)) actions.append(button('+ Full context fields','', () => change(() => {
      for (const key of ['Full context paragraphs','Full context location','Full context provenance']) if (!block.fields.some(f => f.key === key)) block.fields.push({key,value:''});
    })));
    actions.append(button('+ Field', '', () => change(() => { block.fields.push({ key: 'New field', value: '' }); })), button(C.tables.isRow(block)?'+ Column':C.tables.migrated(block)?'+ Row':'+ Child', '', () => addBlock(block.id, 'child')), button(C.tables.isCell(block)?'+ Column':C.tables.isRow(block)?'+ Row':'+ Sibling', '', () => addBlock(block.id, 'after')));
    for (const [label, action] of [['Indent →', 'indent'], ['← Outdent', 'outdent'], ['Move ↑', 'up'], ['Move ↓', 'down']]) actions.append(button(label, '', () => reorder(block.id, action)));
    actions.append(button(C.tables.isCell(block)?'Delete column':'Delete block', 'danger', () => deleteBlock(block.id))); panel.append(actions);
    return panel;
  }
  function ownMatch(block) {
    const source = C.sourceFor(doc, block);
    return [block.text, block.type, ...(block.tags || []).map(id => C.tagPath(doc, id)), ...block.fields.flatMap(f => [f.key, f.value]), ...(source ? [source.text, ...source.fields.map(f => f.value)] : [])].join(' ').toLowerCase().includes(query);
  }
  function matches(block) { return !query || ownMatch(block) || block.children.some(matches); }
  function blockLabel(block) {
    if(C.tables.isCell(block)||C.tables.isRow(block))return C.tables.label(doc,block,C);
    return view === 'grounding' && block.type === 'paragraph' ? C.get(block.children[0], 'Grounding paragraph') || block.text : block.text;
  }
  function visibleRoots() {
    if (view === 'sources') return doc.sources;
    if (view === 'work') return doc.workPlan || [];
    if (view === 'grounding') {
      const result = [];
      C.walk(doc.blocks, b => { if (b.type === 'paragraph' && b.children.some(s => C.get(s, 'Grounding draft ID'))) result.push(b); });
      return result;
    }
    return doc.blocks;
  }
  function planningFields(block) {
    const panel = el('dl', 'planning-fields'); panel.setAttribute('aria-label', 'Task and source properties');
    for (const field of block.fields) {
      if (!field.value || ['Status','Action ID'].includes(field.key)) continue;
      panel.append(el('dt', '', field.key));
      const value = el('dd', '', field.key === 'Source link' ? '' : field.value);
      if (field.key === 'Source link') {
        if (/^assets\/(work-evidence|study-evidence)\/[a-z-]+\.html#[a-zA-Z0-9-]+$/.test(field.value)) { const a = el('a', '', 'Open exact saved record ↗'); a.href=field.value; a.target='_blank'; a.rel='noopener'; value.append(a); }
        else value.textContent = field.value;
      }
      panel.append(value);
    }
    return panel;
  }
  function renderBlock(block, depth = 0, forceOpen = false, parentMatches = false) {
    const node = el('li', 'block type-' + block.type + (selectedId === block.id ? ' selected' : '')); node.id = 'block-' + block.id; node.dataset.block = block.id; node.style.setProperty('--depth', depth);
    const row = el('div', 'block-row');
    const planning = C.locate(doc, block.id)?.rootKey === 'workPlan';
    if (planning) node.classList.add('planning-block');
    const expandable = block.children.length > 0 || ['sentence','table-cell','reference','source','figure','table'].includes(block.type) || (planning && block.fields.length > 0);
    const open = block.children.length ? forceOpen || !!query || !block.collapsed : editing ? propertiesId === block.id : evidenceOpen.has(block.id);
    const disclosure = expandable ? button('', 'disclosure', () => {
      select(block.id);
      if (block.children.length) { block.collapsed = open; if (block.collapsed && propertiesId && contains(block, propertiesId)) propertiesId = null; scheduleSave(); render(); }
      else if (editing) toggleFields(block.id);
      else { evidenceOpen.has(block.id) ? evidenceOpen.delete(block.id) : evidenceOpen.add(block.id); render(); }
    }, (open ? 'Collapse ' : 'Expand ') + block.type + ': ' + (blockLabel(block) || 'Untitled')) : el('span', 'leaf-dot', '·');
    if (expandable) { disclosure.append(icon(open ? 'down' : 'right')); disclosure.setAttribute('aria-expanded', String(open)); }
    const displayText = C.readingText(doc, blockLabel(block));
    const content = el('div', 'row-content'); const text = el('div', 'block-text', editing ? block.text : displayText); text.id = 'text-' + block.id;
    if (editing) { text.contentEditable = 'plaintext-only'; text.setAttribute('role', 'textbox'); text.setAttribute('aria-multiline', 'true'); text.setAttribute('aria-label', block.type + ' text ' + block.id); text.dataset.editBlock = block.id; text.dataset.placeholder = 'Write a ' + block.type + '…'; }
    text.onfocus = () => select(block.id);
    if(editing&&C.tables.isCell(block))content.append(el('span','table-cell-label',C.tables.context(doc,block.id,C)?.column||'Cell'));
    content.append(text, rowMeta(block));
    const actions = el('div', 'row-actions'); const fields = button('Fields ' + block.fields.length, 'row-action', () => toggleFields(block.id), 'Fields for ' + block.type + ': ' + (block.text || 'Untitled'));
    fields.setAttribute('aria-expanded', String(propertiesId === block.id));
    actions.append(fields, button('+', 'row-action plus', () => addBlock(block.id, 'child'), 'Add child to ' + block.type));
    row.append(disclosure, content); if (editing) row.append(actions); node.append(row);
    if (editing && propertiesId === block.id) node.append(properties(block));
    if (!editing && open && planning && block.fields.length) node.append(planningFields(block));
    if (open && block.type === 'sentence') node.append(sentenceReview(block));
    if(shared&&['sentence','table-row','table-cell'].includes(block.type)&&(open||selectedId===block.id))node.append(shared.commentsPanel(block));
    if (!editing && open && ['reference','source'].includes(block.type)) node.append(evidenceCard(block));
    if (open && ['figure','table'].includes(block.type)) node.append(visualBlock(block));
    if (block.children.length && open) {
      const children = el('ul', 'children' + (depth > 3 ? ' deep' : ''));
      const includeAll = parentMatches || (!!query && ownMatch(block));
      block.children.filter(child => includeAll || matches(child)).forEach(child => children.append(renderBlock(child, depth + 1, false, includeAll)));
      node.append(children);
    }
    return node;
  }
  function contains(block, id) { return block.id === id || block.children.some(b => contains(b, id)); }
  function sentenceReview(block) {
    const box = el('aside', 'sentence-review'); box.setAttribute('aria-label', 'Sentence review');
    box.append(el('div', 'review-heading', 'Why these tags'));
    box.append(el('p', '', C.get(block, 'Sentence review') || C.get(block, 'How this is supported') || 'This sentence needs an individual evidence review.'));
    const result = window.ResultPanel?.resolve(window.RESULT_TRACES,block);
    if (result) {
      const update=el('div','trace-review-update');
      update.append(el('p','',result.matches?'Calculation update · '+result.trace.checkedOn+': the group summaries, Welch difference and interval, and ordinary OLS check now reproduce. The earlier review above is retained as history.':'This sentence has changed since its numerical trace was checked. Inspect the linked analysis before treating the revised wording as supported.'));
      update.append(button('Open result trace →','',()=>{
        reveal(block.id); evidenceOpen.add(result.evidenceBlockId); const ref=C.locate(doc,result.evidenceBlockId)?.block; if(ref)ref.collapsed=false; render();
        document.getElementById('block-'+result.evidenceBlockId)?.scrollIntoView({block:'start',behavior:'smooth'});
      }));box.append(update);
    } else if (block.tags?.includes('role-result')) box.append(el('p','trace-pending','Numerical trace not linked yet. Existing source evidence does not provide a complete data → calculation → plot trail for this result.'));
    const status = C.get(block, 'Audit status'); if (status) box.append(el('small', '', status));
    const file = C.get(block, 'Source file'), lines = C.get(block, 'Source lines');
    if (C.get(block,'Outline revision')) box.append(el('p','',C.get(block,'Integration status')));
    if (C.get(block,'Original hypothesis')) box.append(el('small','',C.get(block,'Original hypothesis') + ' → ' + C.get(block,'Current label') + ' · ' + C.get(block,'Question role')));
    if (C.get(block,'Text kind')==='Outline-only addition') box.append(el('small','review-location','Outline-only addition · '+C.get(block,'Insertion point')+(file?' · Draft source: '+file:'')));
    else if (file) box.append(el('small', 'review-location', (C.get(block,'Outline revision') ? 'Unchanged LaTeX baseline: ' : '') + file + (lines ? ' · line ' + lines : '')));
    else if (C.get(block, 'Draft location')) box.append(el('small', 'review-location', C.get(block, 'Draft location')));
    return box;
  }
  function visualBlock(block,kind=block.type) {
    const box = el('div', 'visual-block');
    if (kind === 'table') {
      try {
        const rows = C.tables.rows(block);
        const selectTableBlock=id=>{apaEvidenceId=apaEvidenceId===id?null:id;selectedId=id;render();if(apaEvidenceId){const panel=document.getElementById('table-inspector-'+block.id);panel?.scrollIntoView({block:'nearest'});panel?.focus({preventScroll:true});}};
        const scroller = el('div', 'table-scroll'); scroller.tabIndex = 0; scroller.setAttribute('aria-label', block.text + ' data; scroll horizontally');
        const table = el('table'), caption = el('caption'); caption.append(readingUnit(el('span', '', block.text), block.id)); table.append(caption);
        const head=el('thead'),body=el('tbody');
        rows.forEach(row=>{
          const tr=el('tr');if(row.block)tr.dataset.tableRow=row.block.id;
          if(row.block&&apaEvidenceId===row.block.id)tr.classList.add('reading-table-row-selected');
          row.cells.forEach((cell,column)=>{
            const td=el(row.header?'th':'td');if(row.header)td.scope='col';
            if(column===0&&row.block&&!row.header&&view==='apa'){
              td.classList.add('table-row-label');
              const rowSelect=button('›','table-row-select',()=>selectTableBlock(row.block.id));
              rowSelect.dataset.inspectRow=row.block.id;rowSelect.setAttribute('aria-label','Inspect row: '+C.tables.label(doc,row.block,C));rowSelect.setAttribute('aria-expanded',String(apaEvidenceId===row.block.id));td.append(rowSelect);
            }
            const text=readingUnit(el('span','',cell.text),cell.block?.id||block.id);
            if(cell.block&&view==='apa'){
              text.classList.add('reading-table-cell');text.tabIndex=0;text.setAttribute('role','button');
              text.dataset.readSentence=cell.block.id;td.dataset.tableCell=cell.block.id;
              text.setAttribute('aria-label','Inspect cell: '+C.tables.label(doc,cell.block,C));text.setAttribute('aria-expanded',String(apaEvidenceId===cell.block.id));
              const open=()=>selectTableBlock(cell.block.id);
              text.onclick=open;text.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}};
            }
            td.append(text);tr.append(td);
          });(row.header?head:body).append(tr);
        });table.append(head,body);
        scroller.append(table); box.append(scroller);
        const active=rows.find(r=>r.block?.id===apaEvidenceId)?.block||rows.flatMap(r=>r.cells).find(c=>c.block?.id===apaEvidenceId)?.block;
        if(active&&view==='apa'){
          const ctx=C.tables.context(doc,active.id,C),isRow=C.tables.isRow(active);
          const panel=el('section','apa-evidence table-inspector');panel.id='table-inspector-'+block.id;panel.tabIndex=-1;panel.setAttribute('aria-label',isRow?'Table row evidence':'Table cell evidence');
          const head=el('div','apa-evidence-head');head.append(el('span','inline-note',C.tables.label(doc,active,C)));
          if(!isRow)head.append(button('Whole row','',()=>selectTableBlock(ctx.row.id)));
          head.append(button('In outline ↗','',()=>{view='outline';query='';$('#search').value='';selectedId=active.id;reveal(active.id);render();document.getElementById('block-'+active.id)?.scrollIntoView({block:'center'});}),button('Close ×','',()=>{apaEvidenceId=null;render();$('#outline').querySelector(isRow?'[data-inspect-row="'+active.id+'"]':'[data-read-sentence="'+active.id+'"]')?.focus();}));panel.append(head);
          if(isRow){
            const values=el('dl','table-row-values'),headers=rows.find(r=>r.header)?.cells||[];
            C.tables.cells(active).forEach((cell,i)=>{const pair=el('div');pair.append(el('dt','',headers[i]?.text||'Column '+(i+1)),el('dd','',cell.text));values.append(pair);});panel.append(values);
          }
          const trace=window.TableEvidence?.resolve(doc,active,C,window.TABLE_EVIDENCE_DATA);
          if(trace?.available)panel.append(window.TableEvidencePanel.render(trace));
          const sources=window.TableEvidence?.evidence(doc,active,C)||[];
          const rowAnalysis=window.TableEvidence?.rowAnalysis(doc,active,C),rowAsset=rowAnalysis&&window.TableEvidence.safeAsset(C.get(rowAnalysis,'Local evidence asset'));
          if(rowAsset){const original=C.get(C.tables.context(doc,active.id,C).row,'Original analysis ID');const label=original?rowAnalysis.text+' (original analysis ID)':rowAnalysis.text;const a=el('a','table-row-analysis',label+' · data & calculation ↗');a.href=rowAsset;a.target='_blank';a.rel='noopener';panel.append(a);}
          if(sources.length){
            const evidence=el('details','table-data-source');evidence.open=!trace?.available&&!rowAnalysis&&sources.length<=3;evidence.append(el('summary','','Linked analysis & table sources'));
            for(const source of sources){const line=el('div','table-source-link'),asset=window.TableEvidence.safeAsset(C.get(source,'Local evidence asset'));line.append(button(source.text+' ↗','',()=>showSource(source.id)));if(asset){const a=el('a','','Open analysis ↗');a.href=asset;a.target='_blank';a.rel='noopener';line.append(a);}evidence.append(line);}panel.append(evidence);
          }else if(!trace?.available)panel.append(el('p','inline-note','No numeric data trace is linked to this row yet. The block outline remains available below.'));
          const outline=el('details','table-block-outline');outline.append(el('summary','','Block outline'));const list=el('ul','children');list.append(renderBlock({...active,collapsed:false},0,true));outline.append(list);panel.append(outline);box.append(panel);
        }
      } catch { box.append(el('p', '', 'Table data are not available. The original LaTeX remains in the export.')); }
    } else {
      const media=C.mediaAsset(block);
      if(media){
        const video=el('video','study-video');video.controls=true;video.playsInline=true;video.preload='none';video.src=media;video.setAttribute('aria-label',block.text);
        const poster=C.get(block,'Video poster');
        if(/^(?:images|figures)\/[a-zA-Z0-9_./-]+\.(png|jpg)$/i.test(poster)&&!poster.includes('..'))video.poster='assets/manuscript/'+poster;
        const download=el('a','study-video-download','Download MP4 (720p)');download.href=media;download.download='';
        box.append(video,download);
      }
      try {
        const assets = JSON.parse(C.get(block, 'Assets')); const gallery = readingUnit(el('div', 'figure-gallery'), block.id);
        if (C.get(block, 'Figure layout') === 'paired-comparison') gallery.classList.add('paired-comparison');
        const photos=C.get(block,'Figure layout')==='photo-comparison';
        if(photos)gallery.classList.add('photo-comparison');
        assets.forEach((asset, i) => {
          if (typeof asset !== 'string' || !/^(?:images|figures)\/[a-zA-Z0-9_./-]+\.(png|jpg|pdf|svg)$/i.test(asset) || asset.includes('..')) return;
          const url = 'assets/manuscript/' + asset;
          if (/\.pdf$/i.test(asset)) { const a = el('a', '', 'Open figure PDF ↗'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; gallery.append(a); }
          else { const img = el('img'); img.src = url; img.loading = 'lazy'; if (C.get(block,'Figure layout')==='paired-comparison') { img.width=440; img.height=644; }
            const labels=photos?C.get(block,'Panel labels').split(' | '):C.get(block,'Panel labels').split(' · ');
            img.alt = labels[i] || block.text;
            if(photos){
              let sizes=[];try{sizes=JSON.parse(C.get(block,'Panel sizes'));}catch{}
              if(sizes[i]?.length===2&&sizes[i].every(n=>Number.isInteger(n)&&n>0&&n<20000)){img.width=sizes[i][0];img.height=sizes[i][1];}
              const panel=el('figure'),label=el('figcaption','',img.alt);panel.append(img,label);gallery.append(panel);
            }else gallery.append(img);
          }
        }); box.append(gallery);
      } catch { box.append(el('p', '', 'Figure assets are not available.')); }
    }
    return box;
  }
  function tagPicker(block) {
    const picker = el('details', 'tag-picker'); picker.append(el('summary', '', 'Tags · ' + (block.tags || []).length));
    picker.open = tagPickersOpen.has(block.id);
    picker.ontoggle = () => { if (!picker.isConnected) return; picker.open ? tagPickersOpen.add(block.id) : tagPickersOpen.delete(block.id); };
    const options = el('div', 'tag-options');
    C.tagNodes(doc).forEach(({ tag, path }) => {
      const label = el('label'), input = el('input'); input.type = 'checkbox'; input.checked = (block.tags || []).includes(tag.id); input.setAttribute('aria-label', 'Tag ' + path.join(' / '));
      input.onchange = () => change(() => {
        if(C.structure.roles.includes(tag.id)){C.structure.toggle(block,tag.id,input.checked);C.set(block,'Tag review','Presentation tags changed by editor');return;}
        const next = new Set(block.tags || []);
        if (input.checked) {
          // The support decision is one axis; semantic roles/topics remain multi-tag.
          if (tag.id.startsWith('support-') && !tag.children.length) [...next].filter(id => id.startsWith('support-')).forEach(id => next.delete(id));
          next.add(tag.id);
        } else next.delete(tag.id);
        block.tags = [...next];
        if (tag.id.startsWith('support-') && !tag.children.length && input.checked) { C.set(block, 'Status', tag.name); C.set(block, 'Audit status', 'Support decision changed by editor'); }
        else C.set(block, 'Tag review', 'Tags changed by editor');
      });
      label.append(input, el('span', '', path.join(' / '))); options.append(label);
    }); picker.append(options); return picker;
  }
  function tagEditor() {
    const panel = el('details', 'tag-editor'); panel.append(el('summary', '', 'Organize tags'));
    const nodes = C.tagNodes(doc), current = nodes.find(x => x.tag.id === selectedTag);
    const name = el('input'); name.setAttribute('aria-label', 'Tag name'); name.placeholder = 'Tag name'; name.value = current?.tag.name || '';
    const parent = el('select'); parent.setAttribute('aria-label', 'Parent tag'); parent.append(new Option('Top level', ''));
    const excluded = C.descendants(doc, selectedTag);
    nodes.filter(x => !excluded.has(x.tag.id)).forEach(x => parent.append(new Option(x.path.join(' / '), x.tag.id)));
    parent.value = current?.parent?.id || '';
    const validName = () => name.value.trim() && name.value.trim().length <= 120;
    const save = button('Save tag', '', () => {
      if (!current || !validName()) return toast('Choose a tag and enter a name (1–120 characters).');
      change(() => { const trial = C.clone(doc); const t = C.tagNodes(trial).find(x => x.tag.id === selectedTag).tag; t.name = name.value.trim(); C.moveTag(trial, selectedTag, parent.value); try { doc = C.validate(trial); } catch (error) { toast(error.message); } });
    });
    const add = button('Add child tag', '', () => {
      if (!validName()) return toast('Enter the new tag’s name first.');
      change(() => { const t = { id: 'tag-' + C.uid(), name: name.value.trim(), children: [], collapsed: false }; const trial = C.clone(doc); const p = C.tagNodes(trial).find(x => x.tag.id === selectedTag)?.tag; (p ? p.children : trial.tagTree).push(t); try { doc = C.validate(trial); selectedTag = t.id; } catch (error) { toast(error.message); } });
    });
    const root = button('Add top-level tag', '', () => {
      if (!validName()) return toast('Enter the new tag’s name first.');
      change(() => { const t = { id: 'tag-' + C.uid(), name: name.value.trim(), children: [], collapsed: false }; const trial = C.clone(doc); trial.tagTree.push(t); try { doc = C.validate(trial); selectedTag = t.id; } catch (error) { toast(error.message); } });
    });
    panel.append(name, parent, save, add, root); return panel;
  }
  function locationFor(block) {
    const names = []; let loc = C.locate(doc, block.id);
    while (loc?.parent) { if (['paragraph','section'].includes(loc.parent.type)) names.unshift(loc.parent.text); loc = C.locate(doc, loc.parent.id); }
    return names.join(' / ');
  }
  function renderTags() {
    const layout = el('div', 'tag-layout'), nav = el('nav', 'tag-nav'); nav.setAttribute('aria-label', 'Hierarchical tags');
    nav.append(el('div', 'tag-nav-title', 'Browse by tag'));
    const structural=selectedTag==='document-structure'||C.structure.roles.includes(selectedTag);
    const all = []; C.walk(doc.blocks, b => { if(b.type==='sentence'||C.tables.isCell(b))all.push(b); });
    const counts = new Map(C.tagNodes(doc).map(({ tag }) => [tag.id, C.taggedBlocks(doc, tag.id).length]));
    const selectTag = id => { selectedTag = id; render(); };
    const allButton = button('All text blocks', 'tag-all' + (!selectedTag ? ' active' : ''), () => selectTag(null)); allButton.append(el('span', '', all.length)); nav.append(allButton);
    function branch(tags) {
      const list = el('ul', 'tag-branches');
      tags.forEach(tag => {
        const item = el('li'), row = el('div', 'tag-branch-row');
        const toggle = tag.children.length ? button('', 'tag-disclosure', () => { tag.collapsed = !tag.collapsed; scheduleSave(); render(); }, (tag.collapsed ? 'Expand tag ' : 'Collapse tag ') + tag.name) : el('span', 'tag-leaf', '·');
        if (tag.children.length) { toggle.append(icon(tag.collapsed ? 'right' : 'down')); toggle.setAttribute('aria-expanded', String(!tag.collapsed)); }
        const select = button('', 'tag-select' + (selectedTag === tag.id ? ' active' : ''), () => selectTag(tag.id), 'Filter by ' + C.tagPath(doc, tag.id));
        select.setAttribute('aria-pressed', String(selectedTag === tag.id)); select.append(el('span', '', tag.name), el('small', 'tag-count', counts.get(tag.id)));
        row.append(toggle, select); item.append(row); if (!tag.collapsed && tag.children.length) item.append(branch(tag.children)); list.append(item);
      }); return list;
    }
    nav.append(branch(doc.tagTree)); if (editing) nav.append(tagEditor());
    const results = el('section', 'tag-results'); results.setAttribute('aria-label', 'Tagged blocks');
    const selected = selectedTag ? C.tagNodes(doc).find(x => x.tag.id === selectedTag) : null;
    const candidates = selectedTag ? C.taggedBlocks(doc, selectedTag) : all;
    const matchesQuery = candidates.filter(matches);
    const heading = el('div', 'tag-results-heading'); heading.append(el('div', 'eyebrow', selected?.path.slice(0, -1).join(' / ') || 'BLOCK COLLECTION'), el('h2', '', selected?.tag.name || 'All blocks'));
    heading.append(el('p', '', matchesQuery.length + ' blocks' + (query ? ' matching your search' : '') + (selected?.tag.children.length ? ' · includes child tags · each block shown once' : '')));
    if(structural)heading.append(el('p','tag-hint','These tags control the reading view and Markdown export. #ordered-item gives numbers; #unordered-item gives bullets. Other structural tags identify headings, figures, tables, captions and notes. Text and evidence stay in the same blocks.'));
    if (selectedTag === 'revision') heading.append(el('p','tag-hint',paperConfig.revisionHint || 'All tagged revisions, shown once. Grounding is integrated in the LaTeX baseline; hypothesis and measurement changes are outline-only. Select a child tag to focus.'));
    if (selectedTag === 'revision-grounding') heading.append(el('p','tag-hint',paperConfig.groundingHint || 'The four background paragraphs, integrated in the LaTeX baseline. These are the same manuscript blocks, not separate copies.'));
    if (selectedTag === 'revision-hypotheses') heading.append(el('p','tag-hint','Questions, analysis wording and result labels revised in the outline only. Open a sentence for its prior label and baseline location. No analyses rerun.'));
    if (selectedTag === 'revision-measurement') heading.append(el('p','tag-hint','Revision notes for this tag.'));
    if (selectedTag?.startsWith('support')) heading.append(el('p', 'tag-hint', 'Sentence review is not the same as source verification. Open a sentence to see the reason and remaining checks.'));
    results.append(heading);
    const list = el('ul', 'tag-matches');
    matchesQuery.forEach(s => {
      const item = el('li', 'tag-match'); const context = el('div', 'match-context');
      context.append(el('span', '', locationFor(s)), button('In outline ↗', '', () => { view = 'outline'; query = ''; $('#search').value = ''; selectedId = s.id; reveal(s.id); render(); document.getElementById('block-' + s.id)?.scrollIntoView({ block: 'center' }); }));
      const ul = el('ul', 'outline-list'); ul.append(renderBlock(s)); item.append(context, ul); list.append(item);
    }); results.append(matchesQuery.length ? list : el('p', 'empty-state', query ? 'No blocks match this tag and search. Clear the search or choose another tag.' : 'No blocks have this tag or its children yet.'));
    $('#outline-tag-navigation').replaceChildren(nav); layout.append(results); return layout;
  }
  function readingUnit(node, id = '') {
    if (view === 'apa') { node.classList.add('reading-focus-unit'); node.dataset.readingBlock = id; }
    return node;
  }
  function clearReadingFocus() {
    hoveredReadingTag = keyboardReadingTag = pinnedReadingTag = null;
    updateReadingFocus();
  }
  function updateReadingSidebar() {
    const apa = view === 'apa', wide = apa && wideReadingMedia.matches, tags = apa && (wide || readingSidebarMode === 'tags');
    document.body.classList.toggle('apa-mode', apa);
    document.body.classList.toggle('reading-rails', wide);
    const tagSection = $('#reading-tag-sidebar'), rail = $('#reading-tag-rail');
    if(wide && tagSection.parentElement !== rail) rail.append(tagSection);
    else if(!wide && tagSection.parentElement === rail) $('#sidebar').insertBefore(tagSection,$('#sources-nav'));
    rail.hidden = !wide;
    if(!wide) hideSentencePeek();
    $('#reading-sidebar-switch').hidden = !apa || wide;
    $('#reading-tag-sidebar').hidden = !tags;
    $('#outline-navigation').hidden = (tags && !wide) || view === 'tags';
    $('#outline-tag-navigation').hidden = view !== 'tags';
    $('#reading-show-tags').setAttribute('aria-pressed', String(tags));
    $('#reading-show-contents').setAttribute('aria-pressed', String(apa && !tags));
  }
  function updateReadingFocus() {
    const id = view === 'apa' ? hoveredReadingTag || keyboardReadingTag || pinnedReadingTag : null;
    const result = readingFocusMatches.get(id), active = !!result?.count;
    // Only change leaf classes. Never rerender or scroll the paper on hover.
    $('#outline').classList.toggle('reading-focus-active', active);
    $('#outline').querySelectorAll('.reading-focus-unit').forEach(node => {
      node.classList.toggle('reading-focus-match', active && (node.dataset.readSource ? result.sources.has(node.dataset.readSource) : result.blocks.has(node.dataset.readingBlock)));
    });
    $('#outline').querySelectorAll('.reading-list > li').forEach(li => {
      li.classList.toggle('reading-marker-muted', active && !li.querySelector('.reading-focus-match'));
    });
    $('#reading-focus-tree').querySelectorAll('[data-reading-tag]').forEach(node => {
      node.classList.toggle('previewing', node.dataset.readingTag === id);
      node.setAttribute('aria-pressed', String(node.dataset.readingTag === pinnedReadingTag));
    });
    const tag = C.tagNodes(doc).find(n => n.tag.id === id)?.tag;
    $('#reading-focus-status').textContent = tag ? (result?.count ? result.count + ' matching blocks · ' + (id === pinnedReadingTag ? 'pinned' : 'preview') : 'No matching blocks in this reading view') : 'All reading blocks visible';
    const pinned = C.tagNodes(doc).find(n => n.tag.id === pinnedReadingTag)?.tag;
    $('#reading-focus-dock').hidden = view !== 'apa' || !pinned || wideReadingMedia.matches;
    $('#reading-focus-label').textContent = pinned ? pinned.name + ' · pinned' : '';
  }
  function renderReadingTags() {
    updateReadingSidebar();
    const nav = $('#reading-focus-tree'); nav.replaceChildren(); readingFocusMatches = new Map();
    if (view !== 'apa') { updateReadingFocus(); return; }
    const index = window.ReadingFocus.createIndex(doc, C);
    const tones = window.ReadingPeek.tagTones(doc);
    const visibleIds = [...$('#outline').querySelectorAll('[data-reading-block]')].filter(n => !n.closest('.apa-evidence')).map(n => n.dataset.readingBlock);
    C.tagNodes(doc).forEach(({tag}) => readingFocusMatches.set(tag.id, index.match(tag.id, visibleIds)));
    if (pinnedReadingTag && !readingFocusMatches.has(pinnedReadingTag)) pinnedReadingTag = null;
    function branch(tags, depth = 0) {
      const list = el('ul', 'reading-tag-branches');
      tags.forEach(tag => {
        const item = el('li'), row = el('div', 'reading-tag-row');
        row.dataset.tagTone = tones.get(tag.id) || 'neutral';
        const folded = readingTagFolds.has(tag.id) ? readingTagFolds.get(tag.id) : true;
        let children;
        if (tag.children.length) {
          children = branch(tag.children, depth + 1); children.hidden = folded; children.id = 'reading-tags-' + tag.id;
          const toggle = button('', 'reading-tag-toggle', () => {
            const close = !children.hidden; children.hidden = close; readingTagFolds.set(tag.id, close);
            toggle.replaceChildren(icon(close ? 'right' : 'down')); toggle.setAttribute('aria-expanded', String(!close));
            toggle.setAttribute('aria-label', (close ? 'Expand ' : 'Collapse ') + tag.name + ' tags');
          }, (folded ? 'Expand ' : 'Collapse ') + tag.name + ' tags');
          toggle.append(icon(folded ? 'right' : 'down')); toggle.setAttribute('aria-expanded', String(!folded)); toggle.setAttribute('aria-controls', children.id); row.append(toggle);
        } else row.append(el('span', 'reading-tag-leaf'));
        const count = readingFocusMatches.get(tag.id).count;
        const select = button('', 'reading-tag-select', () => {
          hoveredReadingTag = keyboardReadingTag = null;
          if (count) pinnedReadingTag = pinnedReadingTag === tag.id ? null : tag.id;
          else keyboardReadingTag = tag.id;
          updateReadingFocus();
          if (count && matchMedia('(max-width: 760px)').matches) { closeContents(); $(pinnedReadingTag ? '#reading-focus-reopen' : '#mobile-menu').focus({preventScroll:true}); }
        }, 'Focus reading on ' + C.tagPath(doc, tag.id));
        select.dataset.readingTag = tag.id; select.setAttribute('aria-pressed', 'false');
        select.append(el('span', '', tag.name));
        select.onpointerenter = event => { if (event.pointerType === 'touch') return; hoveredReadingTag = tag.id; updateReadingFocus(); };
        select.onpointerleave = () => { hoveredReadingTag = null; updateReadingFocus(); };
        select.onfocus = () => { if (select.matches(':focus-visible')) { keyboardReadingTag = tag.id; updateReadingFocus(); } };
        select.onblur = () => { keyboardReadingTag = null; updateReadingFocus(); };
        row.append(select); item.append(row); if (children) item.append(children); list.append(item);
      }); return list;
    }
    nav.append(branch(doc.tagTree)); updateReadingFocus();
  }
  function hideSentencePeek() {
    clearTimeout(peekOpenTimer); clearTimeout(peekCloseTimer); peekId = null;
    $('#sentence-hover-rail').hidden = true;
    $('#outline').querySelectorAll('.peek-target').forEach(n=>n.classList.remove('peek-target'));
  }
  function showSentencePeek(id) {
    if(view !== 'apa' || !wideReadingMedia.matches) return;
    clearTimeout(peekOpenTimer); clearTimeout(peekCloseTimer);
    if(peekId === id && !$('#sentence-hover-rail').hidden) return;
    const projected = window.ReadingPeek.outline(doc,id,C); if(!projected)return;
    peekId = id;
    $('#outline').querySelectorAll('.peek-target').forEach(n=>n.classList.remove('peek-target'));
    $('#outline').querySelector('[data-read-sentence="'+id+'"]')?.classList.add('peek-target');
    const rail = $('#sentence-hover-rail'); rail.replaceChildren(); rail.hidden=false;
    const tones = window.ReadingPeek.tagTones(doc);
    function tree(nodes,depth=0) {
      const list=el('ul',depth===0?'peek-tree':'');
      for(const n of nodes){
        const li=el('li'), hasChildren=n.children.length>0, content=el('span','peek-content'), text=el('span','peek-text'+(n.type==='citation'?' reading-citation':'')+(n.id===id?' peek-current':''),n.text);text.title=n.text;content.append(text);
        if(n.tags.length){const tags=el('span','peek-tags');for(const tag of n.tags){const label=el('span','',tag.name);label.dataset.tagTone=tones.get(tag.id)||'neutral';label.title=C.tagPath(doc,tag.id);tags.append(label);}content.append(tags);}
        if(hasChildren){const details=el('details'),summary=el('summary');details.open=depth===0;summary.append(icon('right'),content);details.append(summary,tree(n.children,depth+1));li.append(details);}
        else{const row=el('div','peek-leaf');row.append(el('span'),content);li.append(row);}
        list.append(li);
      }return list;
    }
    rail.append(tree([projected])); rail.scrollTop=0;
  }
  function schedulePeekClose() {
    clearTimeout(peekOpenTimer); clearTimeout(peekCloseTimer);
    peekCloseTimer=setTimeout(()=>{if(!$('#sentence-hover-rail').matches(':hover,:focus-within'))hideSentencePeek();},700);
  }
  function renderAPA() {
    const fragment = document.createDocumentFragment(); let total = 0;
    function paragraphNode(n,container){
      const paragraph=n.host,visible=n.sentences.filter(s=>matches(s)||(query&&ownMatch(paragraph)));
      if(query&&!visible.length)return;
      total++;
      const roles=paragraph.tags||[],isCaption=roles.includes('caption'),isDescription=roles.includes('accessible-description');
      const section=el(isDescription?'details':isCaption&&container.tagName==='FIGURE'?'figcaption':'section','apa-paragraph'+(isCaption?' reading-caption':'')+(roles.includes('table-note')?' reading-table-note':''));section.id='reading-'+n.block.id;
      if(isDescription)section.append(readingUnit(el('summary','','Image description'), paragraph.id));
      if(!n.listItem&&!C.get(paragraph,'Source file')&&paragraph.type==='paragraph'&&!roles.some(t=>['caption','table-note','abstract','accessible-description'].includes(t)))section.append(readingUnit(el('h3','',paragraph.text), paragraph.id));
      const p=el('p');
      visible.forEach((sentence, i) => {
        const span = readingUnit(el('span', 'apa-sentence' + (apaEvidenceId === sentence.id ? ' active' : '')), sentence.id);
        for(const part of window.ReadingPeek.citationParts(doc,sentence,C))span.append(part.citation?el('span','reading-citation',part.text):document.createTextNode(part.text));
        span.tabIndex = 0; span.setAttribute('role', 'button'); span.setAttribute('aria-label', 'Inspect sentence: ' + sentence.text); span.setAttribute('aria-expanded', String(apaEvidenceId === sentence.id)); span.dataset.readSentence = sentence.id;
        const open = () => { apaEvidenceId = apaEvidenceId === sentence.id ? null : sentence.id; selectedId = sentence.id; render(); };
        span.onclick = open; span.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } };
        p.append(span); if (i < visible.length - 1) p.append(' ');
      }); section.append(p);
      const active = visible.find(s => s.id === apaEvidenceId);
      if (active) {
        const panel = el('section', 'apa-evidence'); const head = el('div', 'apa-evidence-head'); head.append(el('span', 'inline-note', editing ? 'Same sentence · editable blocks and evidence' : 'Sentence tags and evidence'), button('Close ×', '', () => { apaEvidenceId = null; render(); }));
        panel.append(head); const list = el('ul', 'children'); list.append(renderBlock(active, 0, true)); panel.append(list); section.append(panel);
      }
      container.append(section);n.children.forEach(child=>emit(child,container));
    }
    function visibleNode(n){return n.kind==='list'?n.children.some(visibleNode):matches(n.block);}
    function emit(n,container){
      if(query&&!visibleNode(n))return;
      const b=n.block;
      if(n.kind==='paragraph'){paragraphNode(n,container);return;}
      if(n.kind==='list'){
        const list=el(n.style==='ordered-item'?'ol':n.style==='description-item'?'dl':'ul','reading-list');
        if(n.style==='ordered-item')list.start=n.start;
        n.children.forEach((item,i)=>{if(query&&!visibleNode(item))return;const li=el(n.style==='description-item'?'dd':'li');if(n.style==='ordered-item')li.value=n.start+i;if(n.style==='description-item')list.append(readingUnit(el('dt','',C.get(item.block,'List label')||item.block.text), item.block.id));item.children.forEach(child=>emit(child,li));if(li.childNodes.length)list.append(li);});if(list.childNodes.length)container.append(list);return;
      }
      if(n.kind==='section'){const group=el('section','reading-group');group.id='reading-'+b.id;group.append(readingUnit(el('h'+n.level,'reading-section',b.text), b.id));n.children.forEach(child=>emit(child,group));container.append(group);return;}
      if(n.kind==='quote'){const quote=el('blockquote','reading-quote');n.children.forEach(child=>emit(child,quote));container.append(quote);return;}
      if(n.kind==='table'||n.kind==='figure'){
        const visual=el(n.kind==='figure'?'figure':'section','reading-visual');visual.id='reading-'+b.id;visual.append(visualBlock(b,n.kind));
        for(const child of n.children){const target=n.kind==='table'&&child.host?.tags?.includes('caption')?visual.querySelector('caption')||visual:visual;emit(child,target);}
        container.append(visual);total++;return;
      }
      if(n.kind==='code-block'||n.kind==='equation'){const pre=readingUnit(el('pre','reading-code'), b.id);pre.id='reading-'+b.id;pre.append(el('code','',C.get(b,'Code')||C.get(b,'Math source')||b.text));if(n.kind==='equation')pre.setAttribute('aria-label','Equation source');container.append(pre);total++;return;}
      if(n.kind==='note'){container.append(readingUnit(el('p','reading-note',b.text), b.id));n.children.forEach(child=>emit(child,container));total++;}
    }
    C.readingTree(doc).forEach(n=>emit(n,fragment));
    if (!total) fragment.append(emptyState());
    const refs = el('section', 'apa-references'); refs.append(readingUnit(el('h2', '', 'References')));
    const cited = new Map(); C.walk(doc.blocks, b => { if (C.get(b, 'Role').startsWith('Audit evidence')) return; const s = C.sourceFor(doc, b); if (s && C.get(s, 'APA reference')) cited.set(s.id, s); });
    [...cited.values()].sort((a, b) => C.get(a, 'APA reference').localeCompare(C.get(b, 'APA reference'))).forEach(s => {
      const ref = el('div', 'apa-reference reading-focus-unit', C.get(s, 'APA reference')); ref.dataset.readSource = s.id; ref.append(' ', button(editing ? 'Evidence & fields ↗' : 'Evidence ↗', '', () => showSource(s.id))); refs.append(ref);
    }); fragment.append(refs); return fragment;
  }
  function emptyState() {
    const box = el('div', 'empty-state'); box.append(el('h2', '', query ? 'No matching blocks' : 'A little room to think'), el('p', '', query ? 'Try an author, a phrase, or a field value.' : 'Add a paragraph or source, then build its children.'));
    if (query || editing) box.append(button(query ? 'Clear search' : '+ Add a block', '', () => { if (query) { query = ''; $('#search').value = ''; render(); } else addRoot(); })); return box;
  }
  function render() {
    hideSentencePeek();
    window.ResultPanel?.dispose();
    revisionNotice();
    document.body.classList.toggle('read-mode', !editing);
    document.querySelectorAll('[data-edit-only]').forEach(node => node.hidden = !editing);
    $('#import-button').hidden = !!shared || !editing;
    const title = $('#document-title');
    if (editing) { title.contentEditable = 'plaintext-only'; title.setAttribute('role', 'textbox'); title.setAttribute('aria-label', 'Document title'); }
    else { title.removeAttribute('contenteditable'); title.removeAttribute('role'); title.removeAttribute('aria-label'); }
    $('#mode-toggle').textContent = editing ? 'Done editing' : 'Edit document';
    $('#mode-toggle').setAttribute('aria-label', editing ? 'Return to read-only mode' : 'Switch to edit mode'); $('#mode-toggle').setAttribute('aria-pressed', String(editing));
    if (document.activeElement !== $('#document-title')) $('#document-title').textContent = doc.title;
    document.title = 'Trace — ' + doc.title;
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    const contents = $('#contents'); contents.replaceChildren();
    (view === 'work' || view === 'grounding' ? visibleRoots() : doc.blocks).forEach((p, i) => {
      const active = selectedId && contains(p, selectedId) && view !== 'sources';
      const b = button('', 'contents-link' + (active ? ' active' : ''), () => {
        if (!['work','grounding','apa'].includes(view)) view = 'outline'; query = ''; $('#search').value = ''; p.collapsed = false; selectedId = p.id; render(); closeContents();
        document.getElementById((view === 'apa' ? 'reading-' : 'block-') + p.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }); b.append(el('span', 'nav-number', String(i + 1).padStart(2, '0')), el('span', '', blockLabel(p) || 'Untitled paragraph')); contents.append(b);
    });
    $('#section-count').textContent = String(view === 'work' || view === 'grounding' ? visibleRoots().length : doc.blocks.length).padStart(2, '0'); $('#source-count').textContent = doc.sources.length;
    $('#sources-nav').classList.toggle('active', view === 'sources');
    const root = $('#outline'); root.replaceChildren();
    if (view === 'tags') root.append(renderTags());
    else if (view === 'apa') root.append(renderAPA());
    else {
      if (view === 'sources') root.append(el('p', 'source-summary', 'One shared record per source. Exact-reference blocks use these quotes, locations, and bibliographic fields.'));
      if (view === 'work') root.append(el('p', 'work-intro', paperConfig.workIntro || 'Work plan.'));
      if (view === 'grounding') root.append(el('p', 'work-intro', paperConfig.groundingIntro || 'Four paragraphs: educational purpose → anticipation → participation and feedback → the reveal and its science. These are the same editable manuscript blocks, with sentence → citation → exact-reference children.'));
      const roots = visibleRoots().filter(matches);
      const list = el('ul', 'outline-list'); roots.forEach(b => list.append(renderBlock(b))); root.append(roots.length ? list : emptyState());
    }
    let sentences = 0, totalBlocks = 0; C.walk(doc.blocks, b => { totalBlocks++; if (b.type === 'sentence') sentences++; });
    $('#document-summary').textContent = doc.blocks.length + ' manuscript sections · ' + sentences + ' sentences · ' + doc.sources.length + ' source records' + (doc.workPlan ? ' · Separate revision work plan' : '');
    $('#view-caption').textContent = (workspace ? 'Test workspace: ' + workspace + ' · ' : '') + (view === 'outline' ? 'Full ' + (paperConfig.label || 'document') + ' outline · Open a sentence for its review and revision status.' : view === 'tags' ? 'Multiple tags per sentence · Parent tags include all descendants.' : view === 'apa' ? 'APA-style projection of this outline · Outline-only revisions have not been transferred to LaTeX.' : 'Source library · “Checked excerpt” means the recorded passage, not every linked claim.');
    if (view === 'work' || view === 'grounding') $('#view-caption').textContent = (workspace ? 'Test workspace: ' + workspace + ' · ' : '') + (view === 'work' ? (paperConfig.workCaption || 'Meeting follow-through · 23 actions, 13 decisions, 17 verification records · Reviewed 8 September 2026') : 'Theoretical grounding · Four paragraphs, stored once · Open sentences to inspect their support');
    $('#fold-all').hidden = view === 'apa' || view === 'tags';
    const roots = visibleRoots();
    $('#fold-all').textContent = roots.every(b => b.collapsed) ? 'Expand all' : 'Fold all';
    $('#add-end').textContent = view === 'sources' ? '＋ Add source' : '＋ Add paragraph';
    if (view === 'work') $('#add-end').textContent = '＋ Add task';
    $('#document').dataset.view=view;
    renderReadingTags(); select(selectedId); updateHistory();
    shared?.onRender();
  }
  function setSidebarOpen(open, focus = false) {
    const sidebar = $('#sidebar');
    const focusWasInside = sidebar.contains(document.activeElement);
    if (!open) { hoveredReadingTag = keyboardReadingTag = null; updateReadingFocus(); }
    sidebar.hidden = !open; sidebar.inert = !open; sidebar.classList.toggle('open',open);
    $('#mobile-menu').setAttribute('aria-expanded',String(open));
    $('#mobile-menu').setAttribute('aria-label',open ? 'Close navigation' : 'Open navigation');
    if (focus || (!open && focusWasInside)) $(open ? '#close-navigation' : '#mobile-menu').focus({preventScroll:true});
  }
  function closeContents() { setSidebarOpen(false); }
  function download(name, value, mime) {
    const url = URL.createObjectURL(new Blob([value], { type: mime })); const a = el('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  document.addEventListener('input', event => {
    if (!editing) return;
    const target = event.target;
    if (target.id === 'document-title') { checkpoint('title'); doc.title = target.textContent; scheduleSave(); return; }
    const id = target.dataset.editBlock || target.dataset.block; const block = C.locate(doc, id)?.block; if (!block) return;
    if (target.dataset.editBlock) {
      checkpoint('text-' + id); block.text = target.textContent; markEdited(block);
      if(C.tables.isCell(block))$('#outline').querySelectorAll('[data-read-sentence="'+id+'"].reading-table-cell').forEach(node=>{node.textContent=block.text;node.setAttribute('aria-label','Inspect cell: '+C.tables.label(doc,block,C));});
      const meta = document.getElementById('block-' + id)?.querySelector(':scope > .block-row .row-meta'); if (meta) meta.replaceWith(rowMeta(block));
    } else if (target.dataset.fieldKey !== undefined) {
      checkpoint('key-' + id + '-' + target.dataset.fieldKey); block.fields[Number(target.dataset.fieldKey)].key = target.value; markEdited(block);
    } else if (target.dataset.fieldValue !== undefined && target.tagName !== 'SELECT') {
      checkpoint('field-' + id + '-' + target.dataset.fieldValue); block.fields[Number(target.dataset.fieldValue)].value = target.value;
      // A manually changed quote or reference must not retain the original checked label.
      if (!['Status', 'Record status', 'Checked'].includes(block.fields[Number(target.dataset.fieldValue)].key)) markFieldEdited(block,block.fields[Number(target.dataset.fieldValue)].key);
    } else return;
    if (block.type === 'source') {
      const card = document.getElementById('block-' + id)?.querySelector('.evidence-card');
      if (card) card.replaceWith(evidenceCard(block));
      const panel = document.querySelector('.properties[data-owner="' + id + '"]');
      panel?.querySelectorAll('[data-field-value]').forEach(input => {
        if (input !== target && ['Record status', 'Checked'].includes(block.fields[Number(input.dataset.fieldValue)]?.key)) input.value = block.fields[Number(input.dataset.fieldValue)].value;
      });
    }
    scheduleSave();
  });
  document.addEventListener('focusin', event => {
    const target = event.target; if (target.dataset.editBlock || target.dataset.fieldKey !== undefined || target.dataset.fieldValue !== undefined || target.id === 'document-title') editGroup = null;
  });
  document.addEventListener('keydown', event => {
    const target = event.target; const modifier = event.metaKey || event.ctrlKey;
    if (editing && modifier && event.key.toLowerCase() === 'z') { if(shared)return;event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if (event.key === 'Escape') {
      hideSentencePeek();
      if (view === 'apa') clearReadingFocus();
      if (!$('#sidebar').hidden) { setSidebarOpen(false,true); return; }
      closeContents(); $('#export-menu').open = false;
      if (target.dataset.editBlock) document.getElementById('block-' + target.dataset.editBlock)?.querySelector('.row-action')?.focus();
      return;
    }
    if (event.key === '/' && !target.isContentEditable && !['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) { event.preventDefault(); setSidebarOpen(true); $('#search').focus(); return; }
    const id = target.dataset.editBlock; if (!editing || !id) return;
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); addBlock(id, modifier ? 'child' : 'after'); }
    if (event.key === 'Tab') { event.preventDefault(); reorder(id, event.shiftKey ? 'outdent' : 'indent'); }
    if (event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); reorder(id, event.key === 'ArrowUp' ? 'up' : 'down'); }
  });
  document.addEventListener('paste', event => {
    if (!editing || !event.target.isContentEditable) return;
    event.preventDefault();
    // execCommand is retained only for undo-friendly plain-text insertion in editable blocks.
    document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
  });
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { setView(b.dataset.view); closeContents(); });
  $('#mode-toggle').onclick = () => { if(!editing&&shared&&!shared.canEdit())return; editing = !editing; propertiesId = null; editGroup = null; $('#export-menu').open = false; if(!editing)save(); render(); window.TraceActions?.close({focus:true}); };
  $('#undo').append(icon('undo')); $('#redo').append(icon('redo'));
  $('#undo').onclick = $('#dock-undo').onclick = undo; $('#redo').onclick = redo;
  $('#sources-nav').onclick = () => { setView('sources'); closeContents(); };
  $('#new-paragraph').onclick = () => { view = 'outline'; addRoot(); closeContents(); };
  $('#add-end').onclick = addRoot;
  $('#dock-add').onclick = () => addBlock(selectedId, 'child'); $('#dock-fields').onclick = () => toggleFields(selectedId);
  $('#mobile-menu').onclick = () => setSidebarOpen($('#sidebar').hidden);
  $('#close-navigation').onclick = () => setSidebarOpen(false,true);
  document.addEventListener('pointerdown',event=>{if(!$('#sidebar').hidden&&!event.target.closest('#sidebar,#mobile-menu,#reading-focus-dock,#reading-tag-rail,#sentence-hover-rail'))closeContents();});
  // A tag is a temporary reading filter. Blank space, the paper and unrelated
  // controls dismiss it without consuming the click or rerendering the paper.
  function dismissReadingTag(event) {
    if (view !== 'apa' || (!pinnedReadingTag && !hoveredReadingTag && !keyboardReadingTag)) return;
    if (event.target.closest('#reading-focus-tree button, #reading-focus-reopen')) return;
    clearReadingFocus();
  }
  document.addEventListener('pointerdown', dismissReadingTag, true);
  document.addEventListener('click', dismissReadingTag, true);
  wideReadingMedia.addEventListener('change',()=>{hideSentencePeek();updateReadingSidebar();updateReadingFocus();});
  $('#outline').addEventListener('pointerover',event=>{
    if(event.pointerType==='touch'||view!=='apa'||!wideReadingMedia.matches)return;
    const sentence=event.target.closest('.apa-sentence,.reading-table-cell');if(!sentence||sentence.contains(event.relatedTarget))return;
    clearTimeout(peekCloseTimer);clearTimeout(peekOpenTimer);
    peekOpenTimer=setTimeout(()=>showSentencePeek(sentence.dataset.readSentence),130);
  });
  $('#outline').addEventListener('pointerout',event=>{
    const sentence=event.target.closest('.apa-sentence,.reading-table-cell');if(!sentence||sentence.contains(event.relatedTarget))return;
    if(event.relatedTarget?.closest?.('#sentence-hover-rail'))return;
    schedulePeekClose();
  });
  $('#outline').addEventListener('focusin',event=>{if(event.target.matches('.apa-sentence:focus-visible,.reading-table-cell:focus-visible'))showSentencePeek(event.target.dataset.readSentence);});
  $('#outline').addEventListener('focusout',event=>{if(event.target.matches('.apa-sentence,.reading-table-cell'))schedulePeekClose();});
  $('#sentence-hover-rail').addEventListener('pointerenter',()=>{clearTimeout(peekCloseTimer);clearTimeout(peekOpenTimer);});
  $('#sentence-hover-rail').addEventListener('pointerleave',schedulePeekClose);
  $('#sentence-hover-rail').addEventListener('focusin',()=>{clearTimeout(peekCloseTimer);clearTimeout(peekOpenTimer);});
  $('#sentence-hover-rail').addEventListener('focusout',schedulePeekClose);
  $('#revision-proposal-nav').onclick = () => {
    setView('work'); selectedId=window.RevisionProposal.id;
    const block=C.locate(doc,selectedId)?.block;
    if(block){block.collapsed=false;reveal(selectedId);render();closeContents();document.getElementById('block-'+selectedId)?.scrollIntoView({block:'start'});}
  };
  $('#reading-show-tags').onclick = () => { readingSidebarMode = 'tags'; updateReadingSidebar(); };
  $('#reading-show-contents').onclick = () => { clearReadingFocus(); readingSidebarMode = 'contents'; updateReadingSidebar(); };
  $('#reading-focus-clear').onclick = () => { clearReadingFocus(); $('#mobile-menu').focus({preventScroll:true}); };
  $('#reading-focus-reopen').onclick = () => {
    readingSidebarMode = 'tags'; updateReadingSidebar(); setSidebarOpen(true);
    const pinned = [...$('#reading-focus-tree').querySelectorAll('[data-reading-tag]')].find(n => n.dataset.readingTag === pinnedReadingTag);
    if (pinned) {
      let ancestor = pinned.parentElement;
      while (ancestor && ancestor !== $('#reading-focus-tree')) { if (ancestor.classList.contains('reading-tag-branches') && ancestor.hidden) ancestor.previousElementSibling?.querySelector('.reading-tag-toggle')?.click(); ancestor = ancestor.parentElement; }
      pinned.focus({preventScroll:true});
      const sidebar = $('#sidebar'), rail = sidebar.getBoundingClientRect(), row = pinned.getBoundingClientRect();
      if (row.top < rail.top) sidebar.scrollTop += row.top - rail.top - 8;
      else if (row.bottom > rail.bottom) sidebar.scrollTop += row.bottom - rail.bottom + 8;
    }
  };
  $('#search').oninput = event => { query = event.target.value.trim().toLowerCase(); render(); };
  $('#fold-all').onclick = () => {
    const roots = visibleRoots(); const fold = !roots.every(b => b.collapsed);
    C.walk(roots, b => { b.collapsed = fold; }); if (fold) propertiesId = null;
    scheduleSave(); render();
  };
  document.querySelectorAll('[data-export]').forEach(b => b.onclick = () => {
    save(); const format = b.dataset.export;
    if (format === 'json') download('trace-outline.json', JSON.stringify(doc, null, 2), 'application/json');
    if (format === 'md') download('trace-outline.md', C.markdown(doc), 'text/markdown;charset=utf-8');
    if (format === 'apa') download('trace-reading.md', C.apaMarkdown(doc), 'text/markdown;charset=utf-8');
    $('#export-menu').open = false; toast('Export created');
  });
  $('#import-button').onclick = () => { if (!editing) return; $('#export-menu').open = false; $('#import-file').click(); };
  const exportHypotheses = button('Before hypothesis revision','',async () => {
    try {
      const stored = localStorage.getItem(KEY + '-before-hypothesis-revision');
      if (!stored) return toast('No pre-revision copy is available in this workspace.');
      const original=await C.unpackBackup(stored);
      C.validate(JSON.parse(original));
      download('trace-outline-before-hypotheses.json',original,'application/json');
      $('#export-menu').open = false; toast('Pre-revision browser copy exported');
    } catch { warning('The pre-revision copy could not be exported. It has not been changed.'); }
  });
  exportHypotheses.id = 'export-before-hypotheses'; exportHypotheses.hidden = true;
  exportHypotheses.append(el('small','','Preserved browser copy · import to recover'));
  $('#import-button').before(exportHypotheses);
  try { exportHypotheses.hidden = !localStorage.getItem(KEY + '-before-hypothesis-revision'); } catch { /* Existing storage warning remains visible. */ }
  const exportMeasurement = button('Before measurement revision','',async () => {
    try {
      const stored=localStorage.getItem(KEY+'-before-measurement-revision');
      if(!stored)return toast('No pre-measurement copy is available in this workspace.');
      const original=await C.unpackBackup(stored);
      C.validate(JSON.parse(original));download('trace-outline-before-measurement.json',original,'application/json');
      $('#export-menu').open=false;toast('Pre-measurement browser copy exported');
    } catch {warning('The pre-measurement copy could not be exported. It has not been changed.');}
  });
  exportMeasurement.id='export-before-measurement';exportMeasurement.hidden=true;
  exportMeasurement.append(el('small','','Preserved browser copy · import to recover'));$('#import-button').before(exportMeasurement);
  try {exportMeasurement.hidden=!localStorage.getItem(KEY+'-before-measurement-revision');}catch{/* Storage warning remains visible. */}
  const exportAnalysis = button('Before analysis integration','',async () => {
    try {
      const stored=localStorage.getItem(KEY+'-before-analysis-integration');
      if(!stored)return toast('No pre-analysis copy is available in this workspace.');
      const original=await C.unpackBackup(stored);
      C.validate(JSON.parse(original));download('trace-outline-before-analysis.json',original,'application/json');
      $('#export-menu').open=false;toast('Pre-analysis browser copy exported');
    } catch {warning('The pre-analysis copy could not be exported. It has not been changed.');}
  });
  exportAnalysis.id='export-before-analysis';exportAnalysis.hidden=true;
  exportAnalysis.append(el('small','','Preserved browser copy · import to recover'));$('#import-button').before(exportAnalysis);
  try {exportAnalysis.hidden=!localStorage.getItem(KEY+'-before-analysis-integration');}catch{/* Storage warning remains visible. */}
  const exportStructure=button('Before document structure','',async()=>{
    try{const stored=localStorage.getItem(KEY+'-before-document-structure');if(!stored)return toast('No pre-structure copy is available.');const original=await C.unpackBackup(stored);C.validate(JSON.parse(original));download('trace-outline-before-structure.json',original,'application/json');$('#export-menu').open=false;toast('Pre-structure browser copy exported');}
    catch{warning('The pre-structure copy could not be exported. It has not been changed.');}
  });
  exportStructure.id='export-before-structure';exportStructure.hidden=true;exportStructure.append(el('small','','Preserved browser copy · import to recover'));$('#import-button').before(exportStructure);
  try{exportStructure.hidden=!localStorage.getItem(KEY+'-before-document-structure');}catch{/* Storage warning remains visible. */}
  const exportNarrative=button('Before abstract and discussion revision','',async()=>{
    try{const stored=localStorage.getItem(KEY+'-before-narrative-revision');if(!stored)return toast('No pre-narrative copy is available.');const original=await C.unpackBackup(stored);C.validate(JSON.parse(original));download('trace-outline-before-narrative.json',original,'application/json');$('#export-menu').open=false;toast('Pre-revision browser copy exported');}
    catch{warning('The pre-revision copy could not be exported. It has not been changed.');}
  });
  exportNarrative.id='export-before-narrative';exportNarrative.hidden=true;exportNarrative.append(el('small','','Preserved browser copy · import to recover'));$('#import-button').before(exportNarrative);
  try{exportNarrative.hidden=!localStorage.getItem(KEY+'-before-narrative-revision');}catch{/* Storage warning remains visible. */}
  const exportAlignment=button('Before meeting rationale revision','',async()=>{
    try{const stored=localStorage.getItem(KEY+'-before-meeting-alignment');if(!stored)return toast('No pre-alignment copy is available.');const original=await C.unpackBackup(stored);C.validate(JSON.parse(original));download('trace-outline-before-meeting-alignment.json',original,'application/json');$('#export-menu').open=false;toast('Pre-alignment copy exported');}
    catch{warning('The pre-alignment copy could not be exported. It has not been changed.');}
  });
  exportAlignment.id='export-before-alignment';exportAlignment.hidden=true;exportAlignment.append(el('small','','Preserved browser copy · import to recover'));$('#import-button').before(exportAlignment);
  try{exportAlignment.hidden=!localStorage.getItem(KEY+'-before-meeting-alignment');}catch{/* Storage warning remains visible. */}
  try { $('#export-before-work').hidden = !localStorage.getItem(KEY + '-before-meeting-work'); } catch { /* Storage warning handles unavailable storage. */ }
  $('#export-before-work').onclick = async () => {
    try {
      const stored = localStorage.getItem(KEY + '-before-meeting-work');
      if (!stored) return toast('No pre-update copy is available in this workspace.');
      const original = await C.unpackBackup(stored);
      C.validate(JSON.parse(original));
      download('trace-outline-before-meeting-work.json', original, 'application/json');
      $('#export-menu').open = false; toast('Pre-update browser copy exported');
    } catch { warning('The pre-update copy could not be exported. It has not been changed.'); }
  };
  $('#import-file').onchange = async event => {
    if(shared)return;
    const file = event.target.files[0]; event.target.value = ''; if (!editing || !file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw Error('Choose a JSON file smaller than 5 MB.');
      const incoming = C.upgrade(JSON.parse(await file.text()), window.OUTLINE_SEED);
      if (!confirm('Replace the current outline with “' + incoming.title + '”? Export first for a separate backup. You can also undo this import.')) return;
      saveBlocked = false; $('#storage-warning').hidden = true;
      change(() => { doc = incoming; view = 'outline'; selectedId = incoming.blocks[0]?.id || null; propertiesId = null; apaEvidenceId = null; query = ''; $('#search').value = ''; }, { message: 'Outline imported' });
    } catch (error) { warning('Import was not applied. ' + error.message); }
  };
  window.addEventListener('storage', event => {
    if(shared)return;
    if (event.key !== KEY || !event.newValue) return;
    try {
      const other = JSON.parse(event.newValue); const current = C.clone(doc);
      delete other.updatedAt; delete current.updatedAt;
      if (JSON.stringify(other) === JSON.stringify(current)) return;
    } catch (error) { /* Invalid external data still requires an explicit choice. */ }
    saveBlocked = true; clearTimeout(saveTimer); $('#save-status').textContent = 'Another tab changed this outline';
    warning('Another tab saved a different version. Your work here has not been replaced.', [
      ['Load other version', () => {
        try { const latest = C.validate(JSON.parse(localStorage.getItem(KEY))); checkpoint(); doc = latest; saveBlocked = false; $('#storage-warning').hidden = true; render(); $('#save-status').textContent = 'Saved in this browser'; }
        catch (error) { warning('The other version could not be loaded. Export your work before closing this tab.'); }
      }],
      ['Keep this version', () => { saveBlocked = false; $('#storage-warning').hidden = true; save(); }],
    ]);
  });
  window.addEventListener('pagehide', save);
  if(shared)shared.connect({getDocument:()=>C.clone(doc),isEditing:()=>editing,warning,render,replaceDocument:(next,redraw=true)=>{
    const folds=new Map();for(const key of ['blocks','sources','workPlan'])C.walk(doc[key]||[],b=>folds.set(b.id,b.collapsed));
    doc=C.validate(next);for(const key of ['blocks','sources','workPlan'])C.walk(doc[key]||[],b=>{if(folds.has(b.id))b.collapsed=folds.get(b.id);});
    if(redraw)render();
  }});
  render(); if(!shared)save();
  const requestedBlock=new URLSearchParams(location.search).get('block');
  if (requestedBlock && C.locate(doc,requestedBlock)?.rootKey==='blocks') openOutlineBlock(requestedBlock);
})();
