// Interactives: live figures inside a trace document.
//
// A figure block becomes an interactive when it carries an "Interactive" field naming a component, and optionally
// "Interactive settings" (JSON); the older names "Viz" and "Viz settings" also work. Components are plain
// functions registered with TraceViz.register(name, draw) (also TraceInteractives.register); a document brings
// its own component files (data field "interactiveScripts": ["my-interactive.js"], or "vizScripts", relative to the
// data file), which the page runs after this runtime once the package is prepared (boot.js).
//
//   draw(host, settings, api)   host: an empty <div class="viz">; settings: the parsed "Interactive settings";
//                               api: { state, svg, S, slider, scale, text, onVisible, reduced, cached, tagColor, tagClass }
// Connected highlights: api.tagColor('hl-x') is the colour of that tag's slot ('var(--slot-2)', or '' when it
// has none), and api.tagClass('hl-x', 'stroke' | 'fill' | 'text') the matching class, so a graph's line for x is
// the same colour as x in the text and in every formula.
//
// Trace redraws the whole paper whenever a sentence opens, so a drawing is re-mounted often: keep slider
// values in api.state (it survives redraws), and cache heavy computations with api.cached(key, fn).
// Colours come only from theme variables through the classes in themes.css (.v-ink, .v-acc, .v-blue …),
// so every theme, palette and dark mode works without separate images.
(() => {
  let INDEX = {};
  try { INDEX = JSON.parse(document.getElementById('trace-viz-index')?.textContent || '{}'); } catch {}
  const registry = {}, states = new Map(), cache = new Map();
  const NS = 'http://www.w3.org/2000/svg';
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- helpers given to components ----------
  const S = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    if (parent) parent.append(n);
    return n;
  };
  const svg = (w, h, label) => {
    const s = S('svg', { viewBox: `0 0 ${w} ${h}`, class: 'viz-svg', role: 'img', 'aria-label': label || '' });
    s.style.width = '100%'; s.style.height = 'auto'; s.style.maxWidth = w + 'px';
    return s;
  };
  const scale = (d0, d1, r0, r1) => { const f = (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0); f.inv = (p) => d0 + ((p - r0) / (r1 - r0)) * (d1 - d0); return f; };
  // Text with simple maths: parts are strings or [text, 'sub' | 'sup' | 'i'] for subscripts, superscripts, italics.
  const text = (parent, x, y, parts, attrs = {}) => {
    const t = S('text', { x, y, ...attrs }, parent);
    for (const p of [].concat(parts)) {
      if (typeof p === 'string') { t.append(document.createTextNode(p)); continue; }
      const [s, kind] = p;
      const sp = S('tspan', kind === 'i' ? { 'font-style': 'italic' } : { 'baseline-shift': kind === 'sub' ? 'sub' : 'super', 'font-size': '72%' }, t);
      sp.textContent = s;
    }
    return t;
  };
  // A slider in the house style: label, range input, live value.
  const slider = ({ label, min, max, step, value, format = (v) => v, onInput, log = false }) => {
    const wrap = document.createElement('label'); wrap.className = 'viz-slider';
    const name = document.createElement('span'); name.className = 'viz-slider-name'; name.textContent = label;
    const input = document.createElement('input'); input.type = 'range';
    const toPos = (v) => (log ? Math.log(v) : v), fromPos = (p) => (log ? Math.exp(p) : p);
    input.min = toPos(min); input.max = toPos(max); input.step = log ? (toPos(max) - toPos(min)) / 400 : step; input.value = toPos(value);
    const out = document.createElement('output'); out.className = 'viz-slider-value';
    const sync = (fire) => { const v = fromPos(+input.value); out.textContent = format(v); input.style.setProperty('--viz-fill', ((+input.value - input.min) / (input.max - input.min)) * 100 + '%'); if (fire) onInput?.(v); };
    input.addEventListener('input', () => sync(true));
    wrap.append(name, input, out); sync(false);
    wrap.set = (v) => { input.value = toPos(v); sync(false); };
    return wrap;
  };
  const onVisible = (host, cb) => { const io = new IntersectionObserver((e) => cb(e[0].isIntersecting)); io.observe(host); return () => io.disconnect(); };
  const cached = (key, fn) => { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); };

  // ---------- mounting ----------
  function mount(id) {
    const v = INDEX[id], fig = document.getElementById('reading-' + id);
    if (!v || !fig || fig.querySelector('.viz')) return;
    const draw = registry[v.component];
    if (!draw) return;
    const host = document.createElement('div'); host.className = 'viz'; host.dataset.viz = v.component;
    const box = fig.querySelector(':scope > .visual-block') || fig;
    box.prepend(host);
    if (!states.has(id)) states.set(id, {});
    try { draw(host, v.settings || {}, { state: states.get(id), svg, S, slider, scale, text, onVisible, reduced, cached, tagColor, tagClass }); }
    catch (e) { host.textContent = 'This interactive could not be drawn.'; host.classList.add('viz-failed'); console.warn('[viz]', v.component, e); }
  }
  const scan = () => Object.keys(INDEX).forEach(mount);
  const slotOf = (id) => (window.__traceSpanIndex || {})[id]?.slot || 0;
  const tagColor = (id) => (slotOf(id) ? `var(--slot-${slotOf(id)})` : '');
  const tagClass = (id, kind = 'stroke') => (slotOf(id) ? ({ stroke: 'v-', fill: 'f-', text: 't-' }[kind] || 'v-') + 'slot' + slotOf(id) : '');
  window.TraceViz = window.TraceInteractives = { register(name, draw) { registry[name] = draw; scan(); }, index: INDEX };
  const start = () => {
    scan();
    const outline = document.getElementById('outline');
    if (outline) new MutationObserver(scan).observe(outline, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
