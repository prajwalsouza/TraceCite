(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else{root.TraceActions=api;const start=()=>Object.assign(api,api.mount(root.document));if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
})(globalThis,function(){
  'use strict';
  function state(status,editing){
    const text=String(status||'');let label='',tone='quiet';
    if(/session expired/i.test(text)){label='Sign in';tone='warning';}
    else if(/competing|another tab/i.test(text)){label='Review edits';tone='warning';}
    else if(/not saved|export to keep/i.test(text)){label='Not saved';tone='warning';}
    else if(/choose.*name|name.*retry/i.test(text)){label='Choose name';tone='warning';}
    else if(/reconnecting/i.test(text)){label='Reconnecting…';tone='warning';}
    else if(/update waiting/i.test(text)){label='Update waiting';tone='pending';}
    else if(/^saving/i.test(text)){label='Saving…';tone='pending';}
    return {label:editing?(label?'Editing · '+label:'Editing'):label,tone};
  }
  function mount(doc){
    const trigger=doc.querySelector('#document-actions-toggle'),panel=doc.querySelector('#document-actions-panel');
    if(!trigger||!panel)return {};
    const container=trigger.parentElement,label=doc.querySelector('#document-actions-state'),announcement=doc.querySelector('#document-actions-announcement'),status=doc.querySelector('#save-status'),mode=doc.querySelector('#mode-toggle');
    let lastAnnouncement='';
    function refresh(){
      const current=state(status.textContent,mode.getAttribute('aria-pressed')==='true');
      label.textContent=current.label;label.hidden=!current.label;trigger.dataset.state=current.tone;
      trigger.setAttribute('aria-label',(panel.hidden?'Open':'Close')+' document actions'+(current.label?' · '+current.label:''));
      const announce=current.label||'All changes saved';
      if(lastAnnouncement&&announce!==lastAnnouncement)announcement.textContent=announce;
      lastAnnouncement=announce;
    }
    function close({focus=false}={}){
      if(panel.hidden)return;
      for(const details of panel.querySelectorAll('details[open]'))details.open=false;
      if(panel.contains(doc.activeElement))focus=true;
      panel.hidden=true;panel.inert=true;trigger.setAttribute('aria-expanded','false');refresh();
      if(focus)trigger.focus({preventScroll:true});
    }
    function open({focus=false}={}){
      const sidebar=doc.querySelector('#sidebar');if(sidebar&&!sidebar.hidden)doc.querySelector('#close-navigation')?.click();
      panel.hidden=false;panel.inert=false;trigger.setAttribute('aria-expanded','true');refresh();
      if(focus)panel.querySelector('summary,button:not([hidden]):not(:disabled),select')?.focus();
    }
    trigger.addEventListener('click',event=>panel.hidden?open({focus:event.detail===0}):close());
    trigger.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();open({focus:true});}});
    doc.addEventListener('pointerdown',event=>{if(!container.contains(event.target))close();});
    doc.querySelector('#mobile-menu')?.addEventListener('click',()=>close());
    panel.addEventListener('focusout',()=>queueMicrotask(()=>{if(!container.contains(doc.activeElement))close();}));
    panel.addEventListener('click',event=>{if(event.target.closest('[data-export]'))close({focus:true});});
    doc.addEventListener('keydown',event=>{
      if(event.key!=='Escape'||panel.hidden)return;
      event.preventDefault();event.stopImmediatePropagation();
      const nested=[...panel.querySelectorAll('details[open]')].at(-1);
      if(nested){nested.open=false;nested.querySelector('summary')?.focus();}else close({focus:true});
    },true);
    // Reuse the real save/edit state. This observer never touches paper data.
    const observer=new MutationObserver(refresh);
    observer.observe(status,{childList:true,subtree:true,characterData:true});
    observer.observe(mode,{attributes:true,attributeFilter:['aria-pressed']});
    refresh();return {open,close,refresh};
  }
  return {state,mount};
});
