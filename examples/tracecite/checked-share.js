// The showcase's interactive: q of n sentences carry a checked quote (n and q are counted from the document).
// Everything drawn is computed from the settings and the slider; colours come from the tags' slots.
TraceViz.register('checked-share', (host, settings, api) => {
  const n = settings.n || 10;
  if (api.state.q == null) api.state.q = settings.q ?? Math.round(n / 2);
  const W = 360, H = 74, x = api.scale(0, n, 12, W - 12);
  const svg = api.svg(W, H, `${api.state.q} of ${n} sentences carry a checked quote`);
  const draw = () => {
    svg.replaceChildren();
    for (let i = 0; i < n; i++) {
      const on = i < api.state.q;
      api.S('rect', { x: x(i) + 2, y: 14, width: x(1) - x(0) - 4, height: 26, rx: 6, class: on ? api.tagClass('hl-q', 'fill') || 'f-acc' : 'f-faint' }, svg);
    }
    api.text(svg, 12, 62, [['q', 'i'], ` = ${api.state.q} of `, ['n', 'i'], ` = ${n}   `, ['p', 'i'], ` = ${(api.state.q / n).toFixed(1)}`], { class: 't-ink' });
    svg.setAttribute('aria-label', `${api.state.q} of ${n} sentences carry a checked quote`);
  };
  const s = api.slider({ label: 'q', min: 0, max: n, step: 1, value: api.state.q, onInput: (v) => { api.state.q = Math.round(v); draw(); } });
  host.append(svg, s);
  draw();
});
