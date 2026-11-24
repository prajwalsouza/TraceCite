(function(root){
  'use strict';
  const labels={};
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(text,fn){const b=el('button','',text);b.type='button';b.onclick=fn;return b;}
  function link(text,path){const a=el('a','',text);a.href=root.TableEvidence.safeAsset(path);a.target='_blank';a.rel='noopener';return a;}
  function render(trace){
    const box=el('section','table-evidence-data');box.setAttribute('aria-label','Condition data and graph');
    let metric=trace.metric,view='graph',page=0;
    const controls=el('div','table-data-controls'),metricLabel=el('label','','Measure '),select=el('select');select.setAttribute('aria-label','Table measure');
    for(const key of trace.binding.metrics){const option=el('option','',labels[key]);option.value=key;select.append(option);}select.value=metric;
    if(trace.binding.metrics.length>1){metricLabel.append(select);controls.append(metricLabel);}
    const graphButton=button('Graph',()=>{view='graph';draw();}),dataButton=button('Data',()=>{view='data';page=0;draw();});
    controls.append(graphButton,dataButton);box.append(controls);
    const content=el('div','table-data-content');content.tabIndex=-1;box.append(content);
    if(!trace.matches)box.append(el('p','edited-warning','This row has changed since its data were checked. The graph and values below use the saved dataset, not the edited table text.'));
    const sources=el('details','table-data-source');sources.append(el('summary','','Source & downloads'));
    const links=el('div','source-links');links.append(link('Download observations CSV',trace.bundle.files.data),link('Checked summaries JSON',trace.bundle.files.json),link('Reproduction code',trace.bundle.files.code));
    sources.append(links,el('p','',trace.bundle.source.path),el('p','',trace.bundle.source.locator),el('p','table-data-hash','SHA256 '+trace.bundle.source.sha256));box.append(sources);
    select.onchange=()=>{metric=select.value;page=0;draw();};
    function draw(){
      content.replaceChildren();graphButton.setAttribute('aria-pressed',String(view==='graph'));dataButton.setAttribute('aria-pressed',String(view==='data'));
      const summary=trace.binding.summaries[metric],unit=metric==='minutes'?'minutes':'1–7 scale',digits=metric==='minutes'?1:2;
      content.append(el('h4','',labels[metric]+' · '+trace.binding.label),el('p','table-data-summary',`n = ${summary.n} · M = ${summary.mean.toFixed(digits)} · SD = ${summary.sd.toFixed(digits)} · range ${summary.min.toFixed(digits)}–${summary.max.toFixed(digits)} ${unit}`));
      if(view==='graph'){
        const width=document.documentElement.clientWidth<600?300:640;
        const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${width} 160`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`${labels[metric]} distribution for ${trace.binding.label}; ${summary.n} observations. Mean ${summary.mean.toFixed(digits)} ${unit}. Use Data for exact values.`);
        const make=(tag,attrs,text)=>{const n=document.createElementNS(svg.namespaceURI,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);return n;};
        const lo=metric==='minutes'?0:1,hi=metric==='minutes'?35:7,x=v=>25+(v-lo)/(hi-lo)*(width-50);
        make('line',{x1:25,x2:width-25,y1:115,y2:115,stroke:'currentColor',opacity:'.25'});
        for(const value of metric==='minutes'?[0,5,10,15,20,25,30,35]:[1,2,3,4,5,6,7])make('text',{x:x(value),y:139,'text-anchor':'middle',fill:'currentColor','font-size':12},value);
        const m=x(summary.mean);make('line',{x1:m,x2:m,y1:38,y2:110,stroke:'#245f91','stroke-width':1.5});make('text',{x:m,y:23,'text-anchor':'middle',fill:'#245f91','font-size':12},'Mean '+summary.mean.toFixed(digits));
        trace.rows.forEach((r,i)=>{const dot=make('circle',{cx:x(r[metric]),cy:54+(i%6)*9,r:3.5,fill:'#245f91',opacity:'.7'});const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=`Observation ${r.row}: ${r[metric].toFixed(3)} ${unit}; source CSV line ${r.sourceCsvLine}`;dot.append(title);});
        content.append(svg,el('p','table-data-note','Each dot is one observation; dots can overlap. Vertical position only separates them.'));
      }else{
        const scroll=el('div','table-scroll'),table=el('table'),head=el('thead'),tr=el('tr'),body=el('tbody');
        for(const label of ['Observation',labels[metric]+' ('+unit+')','Source CSV line']){const th=el('th','',label);th.scope='col';tr.append(th);}head.append(tr);
        trace.rows.slice(page*15,(page+1)*15).forEach(r=>{const row=el('tr');[r.row,r[metric].toFixed(3),r.sourceCsvLine].forEach(v=>row.append(el('td','',v)));body.append(row);});table.append(head,body);scroll.append(table);content.append(scroll);
        const nav=el('div','table-data-pages');const previous=button('Previous',()=>{page--;draw();content.focus();}),next=button('Next',()=>{page++;draw();content.focus();});previous.disabled=page===0;next.disabled=(page+1)*15>=trace.rows.length;
        nav.append(previous,el('span','',`${page*15+1}–${Math.min((page+1)*15,trace.rows.length)} of ${trace.rows.length}`),next);content.append(nav);
      }
      if(metric==='minutes')content.append(el('p','table-data-note',trace.bundle.durationNote));
      else content.append(el('p','table-data-note','Descriptive values for this row.'));
    }
    draw();return box;
  }
  root.TableEvidencePanel={render};
})(globalThis);
