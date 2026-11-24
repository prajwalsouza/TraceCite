// Settings view for the Trace reading page, in the house-style (Tosi) layout:
// its own route (#/settings/<page>), a page menu, and Appearance (themes),
// Reading (outliner preferences) and About pages. Preferences stay in this browser.
(function () {
  'use strict';
  const ICON = {
    upload: ['0 0 512 512', 'M288 109.3V352c0 17.7-14.3 32-32 32s-32-14.3-32-32V109.3l-73.4 73.4c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l128-128c12.5-12.5 32.8-12.5 45.3 0l128 128c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L288 109.3zM64 352H192c0 35.3 28.7 64 64 64s64-28.7 64-64H448c35.3 0 64 28.7 64 64v32c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V416c0-35.3 28.7-64 64-64zM432 456a24 24 0 1 0 0-48 24 24 0 1 0 0 48z'],
    download: ['0 0 512 512', 'M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32V274.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64H448c35.3 0 64-28.7 64-64V416c0-35.3-28.7-64-64-64H346.5l-45.3 45.3c-25 25-65.5 25-90.5 0L165.5 352H64zm368 56a24 24 0 1 1 0 48 24 24 0 1 1 0-48z'],
    gear: ['0 0 512 512', 'M495.9 166.6c3.2 8.7 .5 18.4-6.4 24.6l-43.3 39.4c1.1 8.3 1.7 16.8 1.7 25.4s-.6 17.1-1.7 25.4l43.3 39.4c6.9 6.2 9.6 15.9 6.4 24.6c-4.4 11.9-9.7 23.3-15.8 34.3l-4.7 8.1c-6.6 11-14 21.4-22.1 31.2c-5.9 7.2-15.7 9.6-24.5 6.8l-55.7-17.7c-13.4 10.3-28.2 18.9-44 25.4l-12.5 57.1c-2 9.1-9 16.3-18.2 17.8c-13.8 2.3-28 3.5-42.5 3.5s-28.7-1.2-42.5-3.5c-9.2-1.5-16.2-8.7-18.2-17.8l-12.5-57.1c-15.8-6.5-30.6-15.1-44-25.4L83.1 425.9c-8.8 2.8-18.6 .3-24.5-6.8c-8.1-9.8-15.5-20.2-22.1-31.2l-4.7-8.1c-6.1-11-11.4-22.4-15.8-34.3c-3.2-8.7-.5-18.4 6.4-24.6l43.3-39.4C64.6 273.1 64 264.6 64 256s.6-17.1 1.7-25.4L22.4 191.2c-6.9-6.2-9.6-15.9-6.4-24.6c4.4-11.9 9.7-23.3 15.8-34.3l4.7-8.1c6.6-11 14-21.4 22.1-31.2c5.9-7.2 15.7-9.6 24.5-6.8l55.7 17.7c13.4-10.3 28.2-18.9 44-25.4l12.5-57.1c2-9.1 9-16.3 18.2-17.8C227.3 1.2 241.5 0 256 0s28.7 1.2 42.5 3.5c9.2 1.5 16.2 8.7 18.2 17.8l12.5 57.1c15.8 6.5 30.6 15.1 44 25.4l55.7-17.7c8.8-2.8 18.6-.3 24.5 6.8c8.1 9.8 15.5 20.2 22.1 31.2l4.7 8.1c6.1 11 11.4 22.4 15.8 34.3zM256 336a80 80 0 1 0 0-160 80 80 0 1 0 0 160z'],
    palette: ['0 0 512 512', 'M512 256c0 .9 0 1.8 0 2.7c-.4 36.5-33.6 61.3-70.1 61.3H344c-26.5 0-48 21.5-48 48c0 3.4 .4 6.7 1 9.9c2.1 10.2 6.5 20 10.8 29.9c6.1 13.8 12.1 27.5 12.1 42c0 31.8-21.6 60.7-53.4 62c-3.5 .1-7 .2-10.6 .2C114.6 512 0 397.4 0 256S114.6 0 256 0S512 114.6 512 256zM128 288a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm0-96a32 32 0 1 0 0-64 32 32 0 1 0 0 64zM288 96a32 32 0 1 0 -64 0 32 32 0 1 0 64 0zm96 96a32 32 0 1 0 0-64 32 32 0 1 0 0 64z'],
    info: ['0 0 512 512', 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z'],
    font: ['0 0 448 512', 'M254 52.8C249.3 40.3 237.3 32 224 32s-25.3 8.3-30 20.8L57.8 416H32c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32h-1.8l18-48H303.8l18 48H320c-17.7 0-32 14.3-32 32s14.3 32 32 32h96c17.7 0 32-14.3 32-32s-14.3-32-32-32H390.2L254 52.8zM279.8 304H168.2L224 155.1 279.8 304z'],
    quote: ['0 0 448 512', 'M0 216C0 149.7 53.7 96 120 96h8c17.7 0 32 14.3 32 32s-14.3 32-32 32h-8c-30.9 0-56 25.1-56 56v8h64c35.3 0 64 28.7 64 64v64c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V320 288 216zm256 0c0-66.3 53.7-120 120-120h8c17.7 0 32 14.3 32 32s-14.3 32-32 32h-8c-30.9 0-56 25.1-56 56v8h64c35.3 0 64 28.7 64 64v64c0 35.3-28.7 64-64 64H320c-35.3 0-64-28.7-64-64V320 288 216z'],
    book: ['0 0 448 512', 'M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96zm0 384H352v64H96c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16zm16 48H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z'],
    check: ['0 0 448 512', 'M438.6 105.4c12.5 12.5 12.5 32.8 0 45.3l-256 256c-12.5 12.5-32.8 12.5-45.3 0l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0L160 338.7 393.4 105.4c12.5-12.5 32.8-12.5 45.3 0z'],
    sun: ['0 0 512 512', 'M361.5 1.2c5 2.1 8.6 6.6 9.6 11.9L391 121l107.9 19.8c5.3 1 9.8 4.6 11.9 9.6s1.5 10.7-1.6 15.2L446.9 256l62.3 90.3c3.1 4.5 3.7 10.2 1.6 15.2s-6.6 8.6-11.9 9.6L391 391 371.1 498.9c-1 5.3-4.6 9.8-9.6 11.9s-10.7 1.5-15.2-1.6L256 446.9l-90.3 62.3c-4.5 3.1-10.2 3.7-15.2 1.6s-8.6-6.6-9.6-11.9L121 391 13.1 371.1c-5.3-1-9.8-4.6-11.9-9.6s-1.5-10.7 1.6-15.2L65.1 256 2.8 165.7c-3.1-4.5-3.7-10.2-1.6-15.2s6.6-8.6 11.9-9.6L121 121 140.9 13.1c1-5.3 4.6-9.8 9.6-11.9s10.7-1.5 15.2 1.6L256 65.1 346.3 2.8c4.5-3.1 10.2-3.7 15.2-1.6zM160 256a96 96 0 1 1 192 0 96 96 0 1 1 -192 0z'],
    moon: ['0 0 384 512', 'M223.5 32C100 32 0 132.3 0 256S100 480 223.5 480c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z'],
    bars: ['0 0 448 512', 'M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 0 96zM0 256c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zM448 416c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z'],
    up: ['0 0 448 512', 'M201.4 137.4c12.5-12.5 32.8-12.5 45.3 0l160 160c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L224 205.3 86.6 342.6c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3l160-160z'],
    down: ['0 0 448 512', 'M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7 86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z'],
    list: ['0 0 512 512', 'M64 144a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32H480c17.7 0 32-14.3 32-32s-14.3-32-32-32H192zM64 464a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm48-208a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z'],
    tag: ['0 0 448 512', 'M0 80V229.5c0 17 6.7 33.3 18.7 45.3l176 176c25 25 65.5 25 90.5 0L418.7 317.3c25-25 25-65.5 0-90.5l-176-176c-12-12-28.3-18.7-45.3-18.7H48C21.5 32 0 53.5 0 80zm112 32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z'],
    chev: ['0 0 320 512', 'M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z'],
    shut: ['0 0 512 512', 'M41.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 256 246.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160zm352-160l-160 160c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L301.3 256 438.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0z'],
    open: ['0 0 512 512', 'M470.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 256 265.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160zm-352 160l160-160c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L210.7 256 73.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0z'],
    flow: ['0 0 576 512', 'M0 80C0 53.5 21.5 32 48 32h96c26.5 0 48 21.5 48 48V96H384V80c0-26.5 21.5-48 48-48h96c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48H432c-26.5 0-48-21.5-48-48V160H192v16c0 1.7-.1 3.4-.3 5L272 288h96c26.5 0 48 21.5 48 48v96c0 26.5-21.5 48-48 48H272c-26.5 0-48-21.5-48-48V336c0-1.7 .1-3.4 .3-5L144 224H48c-26.5 0-48-21.5-48-48V80z'],
    left: ['0 0 320 512', 'M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z'],
  };
  const svg = (name) => `<svg viewBox="${ICON[name][0]}" aria-hidden="true"><path d="${ICON[name][1]}"/></svg>`;
  const THEMES = [
    { id: 'sage', name: 'Sage', mode: 'light', about: 'Trace’s own pastel paper: sage and cream, Raleway and Nunito.' },
    { id: 'matte', name: 'Matte Black', mode: 'dark', about: 'Soft black, quiet greys.' },
    { id: 'pitch', name: 'Pitch Black', mode: 'dark', about: 'True black, for dark rooms and OLED screens.' },
    { id: 'minimal', name: 'Clean Minimalist', mode: 'light', about: 'Warm paper, one ink, one accent.' },
    { id: 'blackboard', name: 'Blackboard', mode: 'light', about: 'Hand-drawn outlines on dotted paper. Playful.' },
    { id: 'neumorphism', name: 'Neumorphism', mode: 'light', about: 'One soft colour; depth from light and shadow.' },
    { id: 'textbook-light', name: 'Textbook Light', mode: 'light', about: 'Apricot pastels on cream. Literata headings, Nunito text.' },
    { id: 'textbook-dark', name: 'Textbook Dark', mode: 'dark', about: 'The same apricot book, by lamplight.' },
    { id: 'book', name: 'Book', mode: 'light', about: 'Calm, warm paper and a bookish serif, like a reading app at its quietest.' },
    { id: 'whiteboard', name: 'Whiteboard', mode: 'light', about: 'Blackboard’s bright sibling: marker lines on a white board.' },
    { id: 'magazine', name: 'Magazine', mode: 'light', about: 'Opinionated editorial: huge headlines, heavy rules, drop caps.' },
  ];
  const KEY = 'trace-reading-prefs';
  const DEFAULTS = { flow: false, side: 'open', theme: 'sage', size: 'm', lh: 'comfortable', peek: true, tagRail: true, citations: true, paper: false, cite: 'apa', eqHover: true, traceAnim: true, hlStyle: 'text', windowing: 'auto', font: '', palettes: {} };
  // Curated colour palettes per theme (the first is the theme's own). Drawn as circles under the themes;
  // the colours live in themes.css as [data-palette] rules. Amber and red stay reserved for problems.
  const PALETTES = {
    sage: [['', 'Sage'], ['mist', 'Mist'], ['clay', 'Clay'], ['lavender', 'Lavender'], ['rose', 'Rose']],
    matte: [['', 'Lavender'], ['sage', 'Sage'], ['sky', 'Sky'], ['rose', 'Rose'], ['copper', 'Copper']],
    pitch: [['', 'Lavender'], ['sage', 'Sage'], ['sky', 'Sky'], ['rose', 'Rose'], ['copper', 'Copper']],
    minimal: [['', 'Lavender'], ['sage', 'Sage'], ['sky', 'Sky'], ['rose', 'Rose']],
    blackboard: [['', 'Dotted'], ['graph', 'Graph'], ['manila', 'Manila'], ['eraser', 'Eraser'], ['slate', 'Slate']],
    neumorphism: [['', 'Lavender'], ['sage', 'Sage'], ['sky', 'Sky'], ['rose', 'Rose']],
    'textbook-light': [['', 'Apricot'], ['parchment', 'Parchment'], ['kraft', 'Kraft'], ['sepia', 'Sepia'], ['celadon', 'Celadon']],
    'textbook-dark': [['', 'Lamplight'], ['walnut', 'Walnut'], ['ink', 'Ink'], ['forest', 'Forest']],
    book: [['', 'Calm'], ['paper', 'Paper'], ['quiet', 'Quiet'], ['night', 'Night']],
    whiteboard: [['', 'Marker'], ['grid', 'Grid'], ['sticky', 'Sticky note'], ['glass', 'Glass board']],
    magazine: [['', 'Violet'], ['newsprint', 'Newsprint'], ['ochre', 'Ochre'], ['noir', 'Noir']],
  };
  // Palettes that turn a light theme dark (Slate is a real chalkboard).
  const DARK_PALETTES = new Set(['blackboard:slate', 'book:night', 'whiteboard:glass', 'magazine:noir']);
  const paletteOf = (theme) => { const v = (prefs.palettes || {})[theme] || ''; return (PALETTES[theme] || []).some(([id]) => id === v) ? v : ''; };
  const prefs = (() => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {} };
  const root = document.documentElement;

  // Fonts some themes need, loaded only when that theme is chosen. Book's face is one token (--font-book).
  const THEME_FONTS = {
    book: 'family=Gentium+Book+Plus:ital,wght@0,400;0,700;1,400',
    whiteboard: 'family=Kalam:wght@400;700',
    magazine: 'family=DM+Serif+Display:ital@0;1&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400',
  };
  // Font (Settings → Reading → Font): the reader's own choice, laid over whatever the theme uses, for the
  // text, headings and the interface alike. '' keeps the theme's fonts.
  const FONTS = [
    ['', 'Theme font', null, null, 'Each theme’s own faces, as designed'],
    ['gentium', 'Gentium Book Plus', "'Gentium Book Plus',Charter,Georgia,serif", 'family=Gentium+Book+Plus:ital,wght@0,400;0,700;1,400', 'Serif · calm and open, for long reading'],
    ['libertinus', 'Libertinus Serif', "'Libertinus Serif','Linux Libertine',Georgia,serif", 'family=Libertinus+Serif:ital,wght@0,400;0,600;0,700;1,400', 'Serif · scholarly, at home beside LaTeX maths'],
    ['vollkorn', 'Vollkorn', "'Vollkorn',Georgia,serif", 'family=Vollkorn:ital,wght@0,400;0,600;1,400', 'Serif · sturdy and warm, close to Bookman'],
    ['literata', 'Literata', "'Literata',Georgia,serif", 'family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,600;1,7..72,400', 'Serif · drawn for reading books on screens'],
    ['baskerville', 'Libre Baskerville', "'Libre Baskerville',Baskerville,Georgia,serif", 'family=Libre+Baskerville:ital,wght@0,400;0,700;1,400', 'Serif · classic, crisp contrast'],
    ['garamond', 'EB Garamond', "'EB Garamond',Garamond,Georgia,serif", 'family=EB+Garamond:ital,wght@0,400;0,600;1,400', 'Serif · old-style and elegant'],
    ['atkinson', 'Atkinson Hyperlegible', "'Atkinson Hyperlegible',system-ui,sans-serif", 'family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400', 'Sans · made to be legible for low-vision readers'],
    ['poppins', 'Poppins', "'Poppins',system-ui,sans-serif", null, 'Sans · the house face'],
    ['system', 'System', "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", null, 'Sans · your device’s own'],
  ];
  const loadFontQuery = (key, q) => { if (!q || document.getElementById('font-' + key)) return; const l = document.createElement('link'); l.id = 'font-' + key; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + q + '&display=swap'; document.head.append(l); };
  const loadFonts = (id) => { const q = THEME_FONTS[id]; if (!q || document.getElementById('font-' + id)) return; const l = document.createElement('link'); l.id = 'font-' + id; l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + q + '&display=swap'; document.head.append(l); };
  function apply() {
    const theme = THEMES.find((t) => t.id === prefs.theme) || THEMES[0];
    loadFonts(theme.id);
    const f = FONTS.find(([id]) => id && id === prefs.font);
    if (f) { root.dataset.font = f[0]; root.style.setProperty('--font-user', f[2]); loadFontQuery('user-' + f[0], f[3]); }
    else { delete root.dataset.font; root.style.removeProperty('--font-user'); }
    root.dataset.theme = theme.id;
    const pal = paletteOf(theme.id); if (pal) root.dataset.palette = pal; else delete root.dataset.palette;
    root.classList.toggle('eq-hover-off', !prefs.eqHover);
    root.classList.toggle('no-trace-anim', !prefs.traceAnim);
    root.classList.toggle('hl-tint', prefs.hlStyle === 'tint'); root.classList.toggle('hl-off', prefs.hlStyle === 'off');
    root.classList.toggle('house', theme.id !== 'sage');
    root.classList.toggle('dark', theme.mode === 'dark' || DARK_PALETTES.has(theme.id + ':' + paletteOf(theme.id)));
    for (const s of ['s', 'l', 'xl']) root.classList.toggle('size-' + s, prefs.size === s);
    root.classList.toggle('lh-compact', prefs.lh === 'compact');
    root.classList.toggle('lh-airy', prefs.lh === 'airy');
    root.classList.toggle('no-peek', !prefs.peek);
    root.classList.toggle('no-tag-rail', !prefs.tagRail);
    root.classList.toggle('plain-citations', !prefs.citations);
    root.classList.toggle('paper-card', prefs.paper);
    root.classList.toggle('side-shut', prefs.side === 'shut');
    root.classList.toggle('flow-on', !!prefs.flow);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(document.body).backgroundColor);
  }
  function set(key, value) { prefs[key] = value; save(); apply(); draw(); if (key === 'cite' && !window.TraceCitations?.setStyle(value) && !window.__traceRender) location.reload(); if (key === 'windowing') location.reload(); }
  function setPalette(theme, id) { prefs.palettes = { ...(prefs.palettes || {}), [theme]: id }; save(); apply(); draw(); }

  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'html') n.innerHTML = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null) n.append(kid);
    return n;
  };

  // ---------- pages ----------
  function appearance() {
    return [
      el('h2', { html: svg('palette') }, 'Appearance'),
      el('p', { class: 'lede' }, `${THEMES.length} themes, one reading page. Sage is Trace’s own look; the other seven are the house themes. Each preview is drawn in its own theme.`),
      el('div', { class: 'themes', role: 'radiogroup', 'aria-label': 'Theme' }, THEMES.map((t) =>
        el('button', { class: 'th' + (t.id === prefs.theme ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String(t.id === prefs.theme), onclick: () => set('theme', t.id) },
          el('div', { class: 'prev', 'data-theme': t.id, 'aria-hidden': 'true' },
            el('div', { class: 'ps' }, el('i', { class: 'a' }), el('i'), el('i')),
            el('div', { class: 'pm' }, el('i', { class: 'h' }), el('i'), el('i', { style: 'width:70%' }), el('i', { class: 'c' }))),
          el('div', { class: 'meta', html: svg(t.mode === 'dark' ? 'moon' : 'sun') }, el('b', {}, t.name), t.id === prefs.theme ? el('span', { class: 'chk', html: svg('check') }) : null),
          el('small', {}, t.about)))),
      palettes(),
    ];
  }
  function palettes() {
    const theme = (THEMES.find((t) => t.id === prefs.theme) || THEMES[0]).id, list = PALETTES[theme] || [];
    if (list.length < 2) return null;
    const current = paletteOf(theme);
    return el('div', { class: 'palettes' },
      el('h3', {}, 'Colour palette'),
      el('p', { class: 'lede' }, 'Colour families made for this theme: paper, panel, a primary and a secondary. The first is the theme’s own. Hover to see each one’s colours.'),
      el('div', { class: 'pal-row', role: 'radiogroup', 'aria-label': 'Colour palette' }, list.map(([id, name]) =>
        el('button', { class: 'pal' + (id === current ? ' on' : ''), type: 'button', role: 'radio', 'aria-checked': String(id === current), title: name, onclick: () => setPalette(theme, id) },
          el('span', { class: 'pal-dot', 'data-theme': theme, 'data-palette': id || null, 'aria-hidden': 'true' },
            ...[['Paper', 'the page'], ['Panel', 'sidebar and cards'], ['Text', 'reading text'], ['Primary', 'selection, highlights and marks'], ['Secondary', 'links and citations']]
              .map(([what, where]) => el('b', { 'data-tip': what + ' · ' + where }))),
          el('small', {}, name)))));
  }
  const seg = (key, options) => el('div', { class: 'seg ctl', role: 'group' }, options.map(([value, label]) =>
    el('button', { type: 'button', 'aria-pressed': String(prefs[key] === value), onclick: () => set(key, value) }, label)));
  const toggle = (key, label) => el('button', { class: 'switch ctl', type: 'button', role: 'switch', 'aria-checked': String(!!prefs[key]), 'aria-label': label, onclick: () => set(key, !prefs[key]) });
  const row = (title, note, control) => el('div', { class: 'row' }, el('b', {}, title), control, el('small', {}, note));
  // Font: one quiet button showing the current face; it opens a full-screen picker of large samples.
  function fontPicker() {
    const cur = FONTS.find(([id]) => id === (prefs.font || '')) || FONTS[0];
    const b = el('button', { type: 'button', class: 'font-trigger ctl', 'aria-haspopup': 'dialog', style: cur[2] ? 'font-family:' + cur[2] : '', onclick: (e) => openFontSheet(e.currentTarget) },
      el('span', {}, cur[1]), el('span', { class: 'font-trigger-chev', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24"><path d="M8 10l4 4 4-4"/></svg>' }));
    if (cur[3]) loadFontQuery('user-' + cur[0], cur[3]);
    return b;
  }
  function openFontSheet(trigger) {
    FONTS.forEach(([id, , , q]) => loadFontQuery('user-' + id, q)); // every sample in its own face
    const sample = (() => { const t = (window.OUTLINE_SEED?.title || ''); return t.length > 12 && t.length < 90 ? t : 'Every sentence unfolds to the exact words behind it.'; })();
    const scrim = el('div', { class: 'font-scrim' });
    const sheet = el('div', { class: 'font-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Choose a font' });
    const close = () => { scrim.classList.add('out'); setTimeout(() => scrim.remove(), 160); removeEventListener('keydown', keys, true); (trigger?.isConnected ? trigger : document.querySelector('.font-trigger'))?.focus({ preventScroll: true }); };
    const head = el('div', { class: 'font-sheet-head' }, el('h2', {}, 'Font'), el('p', {}, 'Laid over the theme’s own faces, for text, headings and the interface. Maths and code keep theirs.'),
      el('button', { type: 'button', class: 'font-sheet-x', 'aria-label': 'Close', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>', onclick: close }));
    const grid = el('div', { class: 'font-grid', role: 'radiogroup', 'aria-label': 'Fonts' }, FONTS.map(([id, name, family, , about]) => {
      const on = (prefs.font || '') === id;
      return el('button', { type: 'button', role: 'radio', class: 'font-card' + (on ? ' on' : ''), 'aria-checked': String(on), 'data-font': id, onclick: () => { set('font', id); close(); } },
        el('span', { class: 'font-card-aa', style: family ? 'font-family:' + family : '' }, 'Aa'),
        el('span', { class: 'font-card-sample', style: family ? 'font-family:' + family : '' }, sample),
        el('span', { class: 'font-card-meta' }, el('b', {}, name), el('small', {}, about || '')),
        el('span', { class: 'font-card-check', 'aria-hidden': 'true', html: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.2 4.2L19 7"/></svg>' }));
    }));
    sheet.append(head, grid); scrim.append(sheet); document.body.append(scrim);
    scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) close(); });
    const cards = [...grid.querySelectorAll('.font-card')];
    const keys = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); return; }
      const i = cards.indexOf(document.activeElement); if (i < 0) return;
      const cols = Math.max(1, Math.round(grid.clientWidth / cards[0].offsetWidth));
      const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
      if (step) { e.preventDefault(); cards[Math.max(0, Math.min(cards.length - 1, i + step))].focus(); }
    };
    addEventListener('keydown', keys, true);
    requestAnimationFrame(() => (grid.querySelector('.font-card.on') || cards[0]).focus());
  }
  function textPage() {
    return [
      el('h2', { html: svg('font') }, 'Text'),
      el('p', { class: 'lede' }, 'The typeface and how the paper’s text sits on the page. Only this browser’s view changes, never the document.'),
      el('div', { class: 'rows' },
        row('Font', 'Your choice of typeface, over the theme’s own. Theme font keeps each theme as designed.', fontPicker()),
        row('Text size', 'Size of the paper’s body text.', seg('size', [['s', 'Small'], ['m', 'Medium'], ['l', 'Large'], ['xl', 'Larger']])),
        row('Line spacing', 'Space between lines of the paper.', seg('lh', [['compact', 'Compact'], ['comfortable', 'Comfortable'], ['airy', 'Airy']])),
        row('Paper card', 'Draw the paper on its own card instead of directly on the page.', toggle('paper', 'Paper card')),
      ),
    ];
  }
  function reading() {
    return [
      el('h2', { html: svg('book') }, 'Reading'),
      el('p', { class: 'lede' }, 'What appears around the text while you read, and how a sentence opens to its trace.'),
      el('div', { class: 'rows' },
        row('Outline in the margin', 'On wide screens, hovering a sentence shows its branch of the outline on the right.', toggle('peek', 'Outline in the margin')),
        row('Tag tree in the margin', 'On wide screens, keep the tag tree on the left. It is always in the sidebar.', toggle('tagRail', 'Tag tree in the margin')),
        row('Animate opening a sentence', 'The paragraph parts at the line and the trace writes itself into the gap. Turn off to show it at once (lighter on slow devices).', toggle('traceAnim', 'Animate opening a sentence')),
        row('Connected highlights', 'The few ideas a document follows throughout keep one colour wherever they appear: in words, symbols and figures.', seg('hlStyle', [['text', 'Text colour'], ['tint', 'Highlighted'], ['off', 'Off']])),
        row('Highlight in equations', 'Hovering a symbol lights it up in every equation, and a copy button gives an equation’s LaTeX.', toggle('eqHover', 'Highlight in equations')),
      ),
    ];
  }
  function citationsPage() {
    return [
      el('h2', { html: svg('quote') }, 'Citations'),
      el('p', { class: 'lede' }, 'How sources are cited in the text and listed at the end.'),
      el('div', { class: 'rows' },
        row('Citation style', (window.TraceCiteStyles?.STYLES[prefs.cite] || { note: '' }).note + ' Applies to sources from a bibliography.', seg('cite', Object.entries(window.TraceCiteStyles?.STYLES || { apa: { name: 'APA 7' } }).map(([id, st]) => [id, st.name]))),
        row('Colour citations', 'Show author–year citations in the link colour.', toggle('citations', 'Colour citations')),
      ),
    ];
  }
  function advanced() {
    return [
      el('h2', { html: svg('gear') }, 'Advanced'),
      el('p', { class: 'lede' }, 'For long documents and structural analysis.'),
      el('div', { class: 'rows' },
        row('Load long documents in parts', (window.TraceWindow ? 'This document: ' + (window.TraceWindow.windowed ? 'loaded in ' + window.TraceWindow.chunks + ' parts as you read.' : 'drawn whole.') + ' ' : '') + 'Long documents draw only what is near you, so they open fast. Auto turns this on for long documents. The page reloads.', seg('windowing', [['auto', 'Auto'], ['on', 'Always'], ['off', 'Never']])),
        row('Flow view (advanced)', 'Add a Flow view to the sidebar: a structural analysis of how the document moves between its tags, drawn as flowcharts you can copy as Mermaid.', toggle('flow', 'Flow view')),
      ),
    ];
  }
  function about() {
    const doc = window.OUTLINE_SEED || {};
    let sentences = 0, quotes = 0;
    const walk = (bs) => (bs || []).forEach((b) => { if (b.type === 'sentence') sentences++; walk(b.children); });
    walk(doc.blocks);
    for (const s of doc.sources || []) quotes += (s.fields || []).filter((f) => /^Exact quote/.test(f.key) && f.value).length;
    const date = doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    return [
      el('h2', { html: svg('info') }, 'About'),
      el('p', { class: 'lede' }, 'A reading edition of a Trace outline: one file, one tree of blocks, every sentence open to its evidence.'),
      el('dl', { class: 'about' },
        el('dt', {}, 'Document'), el('dd', {}, doc.title || ''),
        doc.subtitle ? [el('dt', {}, 'Summary'), el('dd', {}, doc.subtitle)] : [],
        el('dt', {}, 'Contents'), el('dd', {}, `${(doc.blocks || []).length} sections · ${sentences} sentences · ${(doc.sources || []).length} sources · ${quotes} recorded quotes`),
        date ? [el('dt', {}, 'Data updated'), el('dd', {}, date)] : [],
        el('dt', {}, 'Format'), el('dd', {}, `Trace data, version ${doc.version || '?'}`),
        el('dt', {}, 'Edition'), el('dd', {}, 'Reading only. Import, Export and the version history are under Document.'),
        el('dt', {}, 'Privacy'), el('dd', {}, 'No account. Nothing is uploaded. Preferences stay in this browser.'),
        el('dt', {}, 'Theme'), el('dd', {}, (THEMES.find((t) => t.id === prefs.theme) || THEMES[0]).name)),
    ];
  }
  // Import, Export and the version history of the document's package (boot.js and package.js do the work).
  async function exportPackage() {
    const p = window.__tracePackage; if (!p?.pkg) return;
    const bytes = await window.TracePackage.exportBytes(p.pkg);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    const a = el('a', { href: url, download: p.fileName || 'document.trace.zip' }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function documentPage() {
    const p = window.__tracePackage, m = p?.manifest || {};
    const history = [...(m.history || [])].reverse();
    const when = (d) => { const t = new Date(d); return isNaN(t) ? String(d || '') : t.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }); };
    const files = (m.files || []).map((f) => (typeof f === 'string' ? f : f.path));
    return [
      el('h2', { html: svg('download') }, 'Document'),
      el('p', { class: 'lede' }, 'This document travels as one TraceCite package (.trace.zip): its trace data, BibTrace sources, figures and interactive scripts. Export saves it; Import opens another here. You can also drop a file anywhere on the page.'),
      el('div', { class: 'doc-actions' },
        el('button', { type: 'button', class: 'primary', html: svg('upload'), onclick: () => window.TraceImport?.pick() }, 'Import a document'),
        p?.pkg ? el('button', { type: 'button', html: svg('download'), onclick: exportPackage }, 'Export ' + (p.fileName || '.trace.zip')) : null),
      el('dl', { class: 'about' },
        el('dt', {}, 'Format'), el('dd', {}, m.format || 'tracecite/1.0'),
        el('dt', {}, 'Document version'), el('dd', {}, String(m.version || 1)),
        files.length ? [el('dt', {}, 'In the package'), el('dd', {}, files.join(' · '))] : []),
      el('h3', {}, 'Version history'),
      history.length
        ? el('ol', { class: 'doc-history' }, history.map((h) => el('li', {},
          el('span', { class: 'v' }, 'v' + h.version),
          el('span', { class: 'when' }, when(h.date) + (h.by ? ' · ' + h.by : '')),
          el('span', { class: 'meta' }, [h.note, h.hash ? 'content ' + h.hash.replace(/^(\w+):(.{10}).*$/, '$1 $2…') : '', h.previous ? 'after ' + h.previous.replace(/^(\w+):(.{10}).*$/, '$1 $2…') : 'first version'].filter(Boolean).join(' · ')))))
        : el('p', { class: 'lede' }, 'No history recorded yet. Exporting adds the first entry.'),
    ];
  }
  const PAGES = [
    { id: 'appearance', label: 'Appearance', icon: 'palette', draw: appearance },
    { id: 'text', label: 'Text', icon: 'font', draw: textPage },
    { id: 'reading', label: 'Reading', icon: 'book', draw: reading },
    { id: 'citations', label: 'Citations', icon: 'quote', draw: citationsPage },
    { id: 'document', label: 'Document', icon: 'download', draw: documentPage },
    { id: 'advanced', label: 'Advanced', icon: 'gear', draw: advanced },
    { id: 'about', label: 'About', icon: 'info', draw: about },
  ];

  // ---------- view and routing ----------
  const main = document.getElementById('document');
  const view = el('section', { id: 'settings-view', class: 'settings-view', hidden: true, 'aria-label': 'Settings' });
  main.append(view);
  const route = () => (location.hash.replace(/^#/, '') || '/').replace(/\/+$/, '') || '/';
  let readingScroll = 0;
  // ---------- Contents and Tag tree: standalone views ----------
  const doc0 = window.OUTLINE_SEED || { blocks: [], tagTree: [] };
  const fget = (b, k) => b?.fields?.find((f) => f.key === k)?.value || '';
  const HIDE = /^(collab-|heading$|document-structure)/;
  const TONE = { move: 'plum', role: 'blue', support: 'amber', topic: 'green', 'learning-topics': 'green', revision: 'plum', planning: 'plum' };
  const sentencesIn = (b) => { const out = []; (function w(x) { for (const c of x.children || []) { if (c.type === 'sentence') out.push(c); w(c); } })(b); return out; };
  const allSentences = doc0.blocks.flatMap((b) => sentencesIn(b));
  const sectionOf = new Map(); for (const b of doc0.blocks) for (const s of sentencesIn(b)) sectionOf.set(s.id, b.text);
  const goSection = (id) => { location.hash = '/'; setTimeout(() => window.TraceWindow?.ensure(id) ?? document.getElementById('reading-' + id)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60); };
  const goSentence = (id) => { location.hash = '/'; setTimeout(() => { window.TraceWindow?.ensure(id); const n = document.querySelector(`#outline [data-read-sentence="${CSS.escape(id)}"]`); if (!n) return; if (n.getAttribute('aria-expanded') !== 'true') n.click(); (document.querySelector(`#outline [data-read-sentence="${CSS.escape(id)}"]`) || n).scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60); };
  const pinTag = (id) => {
    location.hash = '/';
    setTimeout(() => {
      const tree = document.getElementById('reading-focus-tree');
      const t = tree?.querySelector(`[data-reading-tag="${CSS.escape(id)}"]`); if (!t) return;
      for (let l = t.closest('ul'); l && l !== tree; l = l.parentElement.closest('ul')) if (l.hidden) l.previousElementSibling?.querySelector('.reading-tag-toggle')?.click();
      if (t.getAttribute('aria-pressed') !== 'true') t.click();
      document.getElementById('close-navigation')?.click();
    }, 60);
  };
  function contentsView() {
    const list = el('ol', { class: 'toc' }, doc0.blocks.map((b, i) => {
      const n = sentencesIn(b).length;
      return el('li', {}, el('button', { type: 'button', class: 'toc-row', onclick: () => goSection(b.id) },
        el('span', { class: 'toc-num' }, String(i + 1).padStart(2, '0')),
        el('span', { class: 'toc-title' }, b.text),
        el('span', { class: 'toc-count' }, n ? `${n} sentence${n === 1 ? '' : 's'}` : '')));
    }));
    return [el('p', { class: 'lede' }, 'Every section of the paper. Pick one to read from there.'), list];
  }
  // Tag tree, full screen: one column per tag family, a detail pane for the picked tag.
  let tagPicked = null;
  const flatTags = new Map(); const parentOf = new Map();
  (function w(list, parent) { for (const t of list || []) { flatTags.set(t.id, t); if (parent) parentOf.set(t.id, parent); w(t.children, t.id); } })(doc0.tagTree);
  const toneOf = (id) => { for (let x = id; x; x = parentOf.get(x)) if (TONE[x]) return TONE[x]; return 'neutral'; };
  const pathOf = (id) => { const out = []; for (let x = id; x; x = parentOf.get(x)) out.unshift(flatTags.get(x).name); return out; };
  const taggedWith = (id) => { const ids = new Set(); (function w(t) { ids.add(t.id); (t.children || []).forEach(w); })(flatTags.get(id)); return allSentences.filter((s) => (s.tags || []).some((x) => ids.has(x))); };
  // Tags fold like the margin tree: rows with children get a chevron and start folded.
  const boardOpen = new Set();
  function tagsView() {
    const families = (doc0.tagTree || []).filter((t) => !HIDE.test(t.id));
    const chevSvg = (open) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${open ? 'm6 9 6 6 6-6' : 'm9 6 6 6-6 6'}"/></svg>`;
    function rowsFor(list, total, depth) {
      const out = [];
      for (const t of list || []) {
        if (HIDE.test(t.id)) continue;
        const kids = (t.children || []).filter((c) => !HIDE.test(c.id));
        const open = boardOpen.has(t.id);
        const n = taggedWith(t.id).length;
        const row = el('div', { class: 'tb-row' + (tagPicked === t.id ? ' on' : ''), style: `--depth:${depth};--share:${Math.round((n / total) * 100)}%` });
        const toggle = el('button', { type: 'button', class: 'tb-chev' + (kids.length ? '' : ' none'), 'aria-expanded': kids.length ? String(open) : null, 'aria-label': kids.length ? (open ? 'Fold ' : 'Unfold ') + t.name : null, tabindex: kids.length ? null : '-1', html: kids.length ? chevSvg(open) : '',
          onclick: () => { if (!kids.length) return; open ? boardOpen.delete(t.id) : boardOpen.add(t.id); draw(); } });
        const name = el('button', { type: 'button', class: 'tb-name', 'data-tag-id': t.id, 'aria-pressed': String(tagPicked === t.id), onclick: () => { tagPicked = tagPicked === t.id ? null : t.id; draw(); } }, t.name);
        row.append(toggle, name, el('span', { class: 'tb-count' }, String(n)), el('span', { class: 'tb-bar', 'aria-hidden': 'true' }));
        out.push(row);
        if (open) out.push(...rowsFor(kids, total, depth + 1));
      }
      return out;
    }
    const P = window.TraceParams;
    const paramCol = P ? el('section', { class: 'tb-col tb-col-params', 'data-tone': 'param' },
      el('div', { class: 'tb-family tb-family-static' }, el('span', {}, 'Parameters'), el('span', { class: 'tb-count' }, String(P.LEAVES.size))),
      P.tree({ size: { width: 240, height: 60 } })) : null;
    const cols = el('div', { class: 'tb-cols' }, paramCol, families.map((fam) => {
      const total = taggedWith(fam.id).length || 1;
      return el('section', { class: 'tb-col', 'data-tone': toneOf(fam.id) },
        el('button', { type: 'button', class: 'tb-family' + (tagPicked === fam.id ? ' on' : ''), onclick: () => { tagPicked = tagPicked === fam.id ? null : fam.id; draw(); } }, el('span', {}, fam.name), el('span', { class: 'tb-count' }, String(taggedWith(fam.id).length))),
        el('div', { class: 'tb-rows' }, rowsFor(fam.children, total, 0)));
    }));
    const inRange = P?.matches();
    const sentenceList = (list) => {
      const bySection = new Map(); for (const s of list) { const k = sectionOf.get(s.id) || ''; if (!bySection.has(k)) bySection.set(k, []); bySection.get(k).push(s); }
      return [...bySection].map(([sec, ss]) => el('div', { class: 'tb-group' }, el('div', { class: 'tb-sec' }, sec),
        ss.map((s) => el('button', { type: 'button', class: 'tb-sentence', onclick: () => goSentence(s.id) }, s.text))));
    };
    let detail;
    if (tagPicked) {
      const list = taggedWith(tagPicked).filter((s) => !inRange || inRange.has(s.id));
      const path = pathOf(tagPicked);
      detail = el('aside', { class: 'tb-detail', 'data-tone': toneOf(tagPicked) },
        el('div', { class: 'tb-path' }, path.slice(0, -1).join(' / ')),
        el('h2', { class: 'tb-title' }, path[path.length - 1]),
        el('div', { class: 'tb-meta' }, `${list.length} sentence${list.length === 1 ? '' : 's'}` + (inRange ? ' within the parameter filters' : '')),
        el('button', { type: 'button', class: 'tb-focus', onclick: () => pinTag(tagPicked) }, 'Read the paper with this tag in focus'),
        sentenceList(list));
    } else if (inRange) {
      const list = P.sentences.filter((s) => inRange.has(s.id));
      detail = el('aside', { class: 'tb-detail', 'data-tone': 'param' },
        el('div', { class: 'tb-path' }, 'Parameters'),
        el('h2', { class: 'tb-title' }, 'In range'),
        el('div', { class: 'tb-meta' }, `${list.length} sentence${list.length === 1 ? '' : 's'}`),
        el('button', { type: 'button', class: 'tb-focus', onclick: () => { location.hash = '/'; } }, 'Read the paper with these in focus'),
        sentenceList(list));
    } else detail = el('aside', { class: 'tb-detail tb-empty' }, el('p', {}, 'Pick a tag to see its sentences, or open a parameter and filter its chart.'));
    return [el('p', { class: 'lede' }, 'Parameters measure every sentence; open one to see its chart and filter it. Tags mark each sentence’s role, support and topic; bars show how much of its family a tag covers.'), el('div', { class: 'tb-board' }, el('div', { class: 'tb-main' }, cols), detail)];
  }
  window.TraceParams?.onChange(() => { if (route() === '/tags') { const y = scrollY; draw(); scrollTo(0, y); } });
  const VIEWS = { contents: { title: 'Contents', icon: 'list', draw: contentsView }, tags: { title: 'Tag tree', icon: 'tag', draw: tagsView }, flow: { title: 'Flow', icon: 'flow', draw: () => (window.TraceFlow ? window.TraceFlow.view() : []), advanced: true } };

  function draw() {
    const parts = route().split('/').filter(Boolean);
    const on = parts[0] === 'settings' || !!VIEWS[parts[0]];
    if (on && !document.body.classList.contains('settings-mode')) readingScroll = scrollY;
    const was = document.body.classList.contains('settings-mode');
    document.body.classList.toggle('settings-mode', on);
    view.hidden = !on;
    sideButton.classList.toggle('active', parts[0] === 'settings');
    menuButtons.forEach((b) => b.classList.toggle('active', b.dataset.sideView === parts[0]));
    document.body.classList.toggle('view-wide', parts[0] === 'tags' || parts[0] === 'flow');
    if (parts[0] === 'flow' && !prefs.flow) { location.hash = '/'; return; }
    if (!on) { if (was) requestAnimationFrame(() => scrollTo(0, readingScroll)); document.title = window.OUTLINE_SEED?.title || ''; return; }
    const back = el('button', { class: 'back', type: 'button', html: svg('left'), onclick: () => { location.hash = '/'; } }, 'Back to the paper');
    if (VIEWS[parts[0]]) {
      const v = VIEWS[parts[0]];
      view.replaceChildren(back, el('h1', { class: 'view-title', html: svg(v.icon) }, v.title), el('div', { class: 'view-body view-' + parts[0] }, v.draw()));
      document.title = v.title + ' · ' + (window.OUTLINE_SEED?.title || '');
      if (!was) scrollTo(0, 0);
      return;
    }
    const page = PAGES.find((p) => p.id === parts[1]) || PAGES[0];
    view.replaceChildren(
      back,
      el('h1', {}, 'Settings'),
      el('div', { class: 'set' },
        el('nav', { class: 'sub', 'aria-label': 'Settings pages' }, PAGES.map((p) =>
          el('a', { href: `#/settings/${p.id}`, class: p === page ? 'on' : '', 'aria-current': p === page ? 'page' : null, html: svg(p.icon) }, p.label))),
        el('section', { class: 'page' }, page.draw())));
    document.title = 'Settings · ' + (window.OUTLINE_SEED?.title || '');
    if (!was) scrollTo(0, 0);
  }
  // The menu is one icon. The sidebar is headed by the document, not the app name.
  const menu = document.getElementById('mobile-menu');
  if (menu) menu.innerHTML = svg('bars');
  const brand = document.querySelector('.navigation-heading .brand');
  if (brand) brand.textContent = window.OUTLINE_SEED?.title || '';
  // Settings lives at the foot of the sidebar.
  const sideButton = el('button', { class: 'nav-button', id: 'settings-nav', type: 'button', html: svg('gear') }, el('span', {}, 'Settings'));
  sideButton.addEventListener('click', () => { location.hash = '/settings/appearance'; document.getElementById('close-navigation')?.click(); });
  document.querySelector('.sidebar-bottom')?.prepend(sideButton);
  // Export sits just above Settings: it downloads the document as the TraceCite package it was read from
  // (.trace.zip: the trace data, its BibTrace sources, figures and interactive scripts), which any reader opens.
  const exportButton = el('button', { class: 'nav-button', id: 'export-nav', type: 'button', title: 'Download this document as a .trace.zip package', html: svg('download') }, el('span', {}, 'Export'));
  exportButton.addEventListener('click', exportPackage);
  if (window.__tracePackage?.bytes) document.querySelector('.sidebar-bottom')?.prepend(exportButton);
  // The sidebar menu: Contents and Tag tree, each its own view.
  const menuNav = el('nav', { class: 'side-menu', 'aria-label': 'Views' });
  const menuButtons = Object.entries(VIEWS).map(([id, v]) => {
    const b = el('button', { class: 'nav-button side-item', type: 'button', 'data-view-link': id, html: svg(v.icon) }, el('span', {}, v.title));
    b.dataset.sideView = id;
    b.addEventListener('click', () => { location.hash = '/' + id; document.getElementById('close-navigation')?.click(); });
    menuNav.append(b); return b;
  });
  document.querySelector('#sidebar .navigation-heading')?.after(menuNav);
  // The sidebar always lists the contents under the menu; the tag tree has its own view.
  document.getElementById('reading-show-contents')?.click();
  // Anything that navigates the paper leaves Settings first.
  document.addEventListener('click', (event) => {
    if (/^\/(settings|contents|tags|flow)/.test(route()) && event.target.closest('.contents-link, [data-reading-tag], #reading-focus-reopen')) { location.hash = '/'; }
  }, true);
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && /^\/(settings|contents|tags|flow)/.test(route())) location.hash = '/'; });
  addEventListener('hashchange', draw);

  // ---------- A header that follows the reader ----------
  // When the page title scrolls away, a compact header slides in at the top: the
  // document and the current section on the paper; Back and the view's name in views.
  // It feathers into the page, and a matching feather sits at the bottom of the window.
  const head = el('div', { class: 'read-head', 'aria-hidden': 'true' });
  const headBack = el('button', { class: 'read-head-back', type: 'button', html: svg('left'), 'aria-label': 'Back to the paper', tabindex: '-1', onclick: () => { location.hash = '/'; } });
  const headTitle = el('span', { class: 'read-head-title' });
  const headSep = el('span', { class: 'read-head-sep' }, '·');
  const headSection = el('span', { class: 'read-head-section' });
  head.append(headBack, headTitle, headSep, headSection);
  const foot = el('div', { class: 'read-foot', 'aria-hidden': 'true' });
  document.body.append(head, foot);
  let headTick = 0;
  function updateHead() {
    headTick = 0;
    const inView = document.body.classList.contains('settings-mode');
    const titleEl = inView ? view.querySelector('h1') : document.getElementById('document-title');
    const past = titleEl ? titleEl.getBoundingClientRect().bottom < 8 : false;
    head.classList.toggle('on', past);
    head.setAttribute('aria-hidden', String(!past)); headBack.tabIndex = past && inView ? 0 : -1;
    headBack.hidden = !inView;
    if (inView) { headTitle.textContent = titleEl?.textContent.trim() || ''; headSep.hidden = headSection.hidden = true; return; }
    headTitle.textContent = window.OUTLINE_SEED?.title || '';
    let current = window.TraceToc?.current?.title || '';
    if (!window.TraceToc) for (const h of document.querySelectorAll('#outline .reading-section')) { if (h.getBoundingClientRect().top < 90) current = h.textContent.trim(); else break; }
    headSection.textContent = current; headSep.hidden = headSection.hidden = !current;
  }
  const scheduleHead = () => { if (!headTick) headTick = setTimeout(updateHead, 16); };
  addEventListener('scroll', scheduleHead, { passive: true }); addEventListener('trace-toc-change', scheduleHead); addEventListener('resize', scheduleHead); addEventListener('hashchange', () => setTimeout(updateHead, 30));
  setTimeout(updateHead, 0);

  // ---------- Desktop: a persistent, collapsible sidebar (house style) ----------
  // Trace opens and closes its sidebar as a drawer. On wider screens it stays
  // open; the toggle collapses it to an icon rail instead.
  const side = document.getElementById('sidebar');
  const desk = matchMedia('(min-width: 761px)');
  const keepOpen = () => { if (!desk.matches || !side) return; if (side.hidden) side.hidden = false; if (side.inert) side.inert = false; side.classList.add('open'); };
  if (side) new MutationObserver(keepOpen).observe(side, { attributes: true, attributeFilter: ['hidden', 'inert'] });
  desk.addEventListener('change', () => { if (desk.matches) keepOpen(); else if (side) { side.hidden = true; side.inert = true; side.classList.remove('open'); } });
  keepOpen();
  const sideToggle = el('button', { class: 'side-toggle', type: 'button' });
  const paintToggle = () => {
    const shut = prefs.side === 'shut';
    sideToggle.innerHTML = svg(shut ? 'open' : 'shut');
    const label = shut ? 'Open the sidebar  [' : 'Collapse the sidebar  [';
    sideToggle.title = label; sideToggle.setAttribute('aria-label', label.replace(/\s+\[$/, '')); sideToggle.setAttribute('aria-expanded', String(!shut));
  };
  const toggleSide = () => { prefs.side = prefs.side === 'shut' ? 'open' : 'shut'; save(); apply(); paintToggle(); };
  sideToggle.addEventListener('click', toggleSide);
  // The paper comes first. Measure its real width and give space back in order:
  // first the right inspection rail, then the left tag rail (tags stay reachable
  // through the Tag tree view). Rails return only with clear room, so nothing flickers.
  const MIN_PAPER = 640, RIGHT = 264, LEFT = 204;
  let fitting = false;
  function fitRails() {
    if (fitting) return; fitting = true;
    const paper = () => document.getElementById('outline')?.getBoundingClientRect().width || 0;
    const wide = document.body.classList.contains('reading-rails');
    if (!wide) { root.classList.remove('no-right-rail', 'no-left-rail'); fitting = false; return; }
    // Start from the most generous layout that might fit, then step down.
    root.classList.remove('no-right-rail', 'no-left-rail');
    if (paper() < MIN_PAPER) root.classList.add('no-right-rail');
    if (paper() < MIN_PAPER - 40) root.classList.add('no-left-rail');
    fitting = false;
  }
  let fitTimer = 0; const fitSoon = () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitRails, 60); };
  addEventListener('resize', fitSoon); desk.addEventListener('change', fitSoon);
  if (side) new ResizeObserver(fitSoon).observe(side);
  new MutationObserver(fitSoon).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  setTimeout(fitRails, 0);
  paintToggle();
  document.querySelector('#sidebar .navigation-heading')?.append(sideToggle);
  addEventListener('keydown', (e) => {
    const typing = e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
    if (e.key === '[' && !typing && !e.metaKey && !e.ctrlKey && desk.matches) { e.preventDefault(); toggleSide(); }
  });
  // Tooltips for the icon rail.
  [...menuButtons, sideButton].forEach((b) => { b.title = b.textContent.trim(); });

  // Phone: a pinned tag shows a bar with previous and next, so the reader can
  // step through the matching sentences and watch the paper change.
  const dock = document.getElementById('reading-focus-dock');
  if (dock) {
    // Real icons instead of the text glyphs Trace uses.
    const reopen = document.getElementById('reading-focus-reopen');
    reopen?.querySelector('span[aria-hidden]')?.replaceWith(Object.assign(document.createElement('span'), { className: 'dock-icon', innerHTML: svg('tag') }));
    const clearBtn = document.getElementById('reading-focus-clear');
    if (clearBtn) { clearBtn.classList.add('dock-x'); clearBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>'; }
    const count = el('span', { class: 'focus-count', 'aria-live': 'polite' });
    // In a document loaded in parts, matches come from the data (every sentence, drawn or not), so the counter
    // is true for the whole document and the arrows can travel to parts not drawn yet.
    const order = [], up = new Map();
    (function walk(list, p) { for (const b of list || []) { if (p) up.set(b.id, p); if (b.type === 'sentence') order.push(b); walk(b.children, b); } })(window.OUTLINE_SEED?.blocks, null);
    let lastStep = null;
    const posOf = new Map(order.map((b, i) => [b.id, i]));
    const under = (id) => { const out = new Set(); (function find(list) { for (const t of list || []) { if (t.id === id) { (function all(x) { out.add(x.id); (x.children || []).forEach(all); })(t); return true; } if (find(t.children)) return true; } return false; })(window.OUTLINE_SEED?.tagTree); return out; };
    const dataStep = (dir) => {
      const tag = document.querySelector('#reading-focus-tree [data-reading-tag][aria-pressed="true"]')?.dataset.readingTag;
      if (!tag) return false;
      const set = under(tag);
      const hit = (b) => { for (let x = b; x; x = up.get(x.id)) if ((x.tags || []).some((t) => set.has(t))) return true; return false; };
      const matches = order.filter(hit);
      if (!matches.length) return true;
      const line = innerHeight * 0.3;
      const here = [...document.querySelectorAll('#outline .apa-sentence')].find((n) => n.getBoundingClientRect().top > line - 4);
      const pos = (b) => posOf.get(b.id);
      const at = here ? posOf.get(here.dataset.readSentence) ?? 0 : 0;
      // Stepping again from the match just shown continues from it, whatever settled around it.
      const last = lastStep && lastStep.tag === tag ? matches.findIndex((b) => b.id === lastStep.id) : -1;
      const lastEl = last > -1 && document.querySelector(`#outline [data-read-sentence="${CSS.escape(lastStep.id)}"]`);
      let i = lastEl && Math.abs(lastEl.getBoundingClientRect().top - line) < 60 ? (last + dir + matches.length) % matches.length
        : dir > 0 ? matches.findIndex((b) => pos(b) > at || (pos(b) === at && here.getBoundingClientRect().top > line + 4)) : matches.map((b, k) => [pos(b), k]).filter(([o]) => o < at).map(([, k]) => k).pop();
      if (i === -1 || i === undefined) i = dir > 0 ? 0 : matches.length - 1;
      const el = window.TraceWindow.go(matches[i].id, { block: 'start' });
      if (el) window.scrollBy({ top: el.getBoundingClientRect().top - line, behavior: 'auto' });
      count.textContent = `${i + 1} / ${matches.length}`;
      lastStep = { tag, id: matches[i].id };
      return true;
    };
    const step = (dir) => {
      if (window.TraceWindow?.windowed && dataStep(dir)) return;
      const matches = [...document.querySelectorAll('#outline .reading-focus-match')].filter((n) => !n.closest('.apa-evidence') && n.getClientRects().length);
      if (!matches.length) return;
      const line = innerHeight * 0.3;
      const tops = matches.map((n) => n.getBoundingClientRect().top);
      let i = dir > 0 ? tops.findIndex((t) => t > line + 4) : tops.map((t, k) => [t, k]).filter(([t]) => t < line - 4).map(([, k]) => k).pop();
      if (i === -1 || i === undefined) i = dir > 0 ? 0 : matches.length - 1;
      window.scrollBy({ top: tops[i] - line, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      count.textContent = `${i + 1} / ${matches.length}`;
    };
    const prev = el('button', { class: 'focus-step', type: 'button', 'data-dir': '-1', 'aria-label': 'Previous matching sentence', html: svg('up') });
    const next = el('button', { class: 'focus-step', type: 'button', 'data-dir': '1', 'aria-label': 'Next matching sentence', html: svg('down') });
    // Trace clears a pinned tag on any tap outside its own controls, so these
    // taps are handled before Trace's listeners see them.
    for (const type of ['pointerdown', 'click']) addEventListener(type, (event) => {
      const button = event.target.closest?.('.focus-step');
      if (!button) return;
      event.stopPropagation();
      if (type === 'click') step(Number(button.dataset.dir));
    }, true);
    // Counter first, at a fixed width, so the arrows never move under the thumb.
    const clear = document.getElementById('reading-focus-clear');
    dock.insertBefore(count, clear); dock.insertBefore(prev, clear); dock.insertBefore(next, clear);
    new MutationObserver(() => { if (dock.hidden) count.textContent = ''; }).observe(dock, { attributes: true, attributeFilter: ['hidden'] });
  }
  apply(); draw();
  window.TraceSettings = { THEMES, PALETTES, FONTS, prefs, apply, set, setPalette, paletteOf };
})();
// The following header is centred over the paper itself, not the window: the margin tag tree and the sidebar
// push the paper sideways, so measure its column and give the header the same left and right edges.
(() => {
  const align = () => {
    const h = document.querySelector('.read-head'), paper = document.getElementById('outline');
    if (!h || !paper || matchMedia('(max-width: 760px)').matches) { if (h) { h.style.paddingLeft = h.style.paddingRight = ''; } return; }
    const r = paper.getBoundingClientRect();
    if (!r.width) return;
    h.style.paddingLeft = Math.max(16, r.left) + 'px';
    h.style.paddingRight = Math.max(16, innerWidth - r.right) + 'px';
  };
  let t = 0; const soon = () => { clearTimeout(t); t = setTimeout(align, 60); };
  addEventListener('resize', soon); addEventListener('hashchange', soon);
  new MutationObserver(soon).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(align, 300)); else setTimeout(align, 300);
})();
