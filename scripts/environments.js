// Mathematical environments on the reading page (index from scripts/environments.mjs). A paragraph tagged
// env-lemma renders as a lemma: its (empty) heading is dropped, the first sentence starts with a run-in label
// **Lemma 2 (a worked example).**, theorem-like statements are italic, and a proof starts with *Proof.*
// and ends with a quiet end mark. Trace redraws the paper as you read, so this is re-applied on every redraw.
(() => {
  let INDEX = {};
  try { INDEX = JSON.parse(document.getElementById('trace-env-index')?.textContent || '{}'); } catch {}
  const ids = Object.keys(INDEX);
  if (!ids.length) return;
  function apply() {
    for (const id of ids) {
      const sec = document.getElementById('reading-' + id);
      if (!sec || sec.dataset.env) continue;
      const e = INDEX[id];
      sec.dataset.env = e.env;
      sec.classList.add('env', 'env-' + e.env, e.italic ? 'env-italic' : 'env-upright');
      const h = sec.querySelector(':scope > h3');
      if (h && !h.textContent.trim()) h.classList.add('env-empty-title');
      const p = sec.querySelector(':scope > p');
      if (!p) continue;
      const label = document.createElement('span');
      label.className = 'env-label no-xref no-md';
      const title = e.env === 'proof' ? 'Proof' + (e.name ? ' ' + e.name : '') : e.kind + (e.label ? ' ' + e.label : '') + (e.name ? ' (' + e.name + ')' : '');
      label.textContent = title + '.';
      label.setAttribute('aria-label', title);
      p.prepend(label, ' ');
      if (e.env === 'proof') {
        const last = [...sec.querySelectorAll(':scope > p')].pop();
        const end = document.createElement('span'); end.className = 'env-end'; end.textContent = 'end of proof'; end.setAttribute('aria-label', 'End of proof');
        last.append(end);
      }
    }
  }
  // Untitled paragraphs between environments have an empty heading; hide those too.
  const tidy = () => document.querySelectorAll('#outline section[id^="reading-"] > h3').forEach((h) => { if (!h.textContent.trim()) h.classList.add('env-empty-title'); });
  const run = () => { apply(); tidy(); };
  const start = () => { run(); new MutationObserver(run).observe(document.body, { childList: true, subtree: true }); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
