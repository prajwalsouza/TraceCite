---
name: tracecite
description: "Trace, an evidence outliner (published as TraceCite): every sentence unfolds to its source's exact words, with the full passage they sit in, notes and tags (sources in BibTrace: BibTeX plus trace-* evidence fields). Its look and structure come from Trace. Use when building any tool where a document is a tree of blocks (section, paragraph, sentence, citation, exact quote) that people read first and edit second: a manuscript outliner, an evidence or provenance viewer, a literature or review workspace, a plan whose items unfold into their sources. Covers the soft sage shell, the reading-first mode, the two quiet reading rails, nested blocks with circular disclosures, inline fields, tags as pills and the exact-quote surface. Includes a builder that turns any trace data file into one self-contained, reading-only HTML page, with example papers in references/."
---

# TraceCite: evidence-first documents

This skill writes and builds TraceCite documents. Use the supplied reading-page
builder for exported documents. The later editing and app-design rules describe
Trace, the original outliner, rather than editing features in the exported page.

Each document declares `"format": "tracecite/1.0"` and `"version": 2`. The first
names the public format; the second is the reader's storage revision. See
[docs/format.md](docs/format.md) and
[schema/tracecite-1.0.schema.json](schema/tracecite-1.0.schema.json).

## The idea of Trace: every claim traces down to the exact words

**Read this first.** A trace document is not text with a reference list. Every sentence unfolds, in place, into where it comes from:

```text
sentence                         the claim, as written in the paper
└─ citation                      which source supports it
   └─ exact quote                the source's own words, verbatim, never paraphrased
      ├─ location                where they sit (section, paragraph, page, line)
      ├─ context                 the whole passage around them, verbatim, with the quote marked
      ├─ tags                    what the quote is evidence for
      ├─ notes                   what it means here, its limits, what to check
      │  └─ notes on notes …     the outline can keep going down
      └─ comments                people's remarks, signed or unsigned, with replies
any block
└─ comment (note + "Comment by") a person's remark on that block; replies are comments under it
every part of the trace          provenance: "Added by" (person or agent), "Added via" (manual, Zotero,
                                 agent, script, PDF, web page), "Added on"; quotes also "checked by / on"
```

**Structure is part of the outline, and the tag is the schema.** Sections nest (`section` blocks with "Heading level" 2, 3, 4 …) for subsections. A paragraph tagged `env-lemma` *is* a lemma: the tag decides how it renders and which fields it reads ("Label" 2, "Name" a worked example). The same holds for `env-theorem`, `env-proposition`, `env-corollary`, `env-definition`, `env-remark`, `env-example`, `env-conjecture`, `env-claim`, `env-assumption` and `env-proof`. Its sentences are the statement or the proof steps, and evidence hangs off them as usual: section → subsection → lemma → sentences → citations → quotes → contexts, notes, comments.

The rules that make this work:
- **A short quote alone is not enough.** A fragment can mean something different in its paragraph. Every quote should carry its **context**: the full passage it sits in, copied verbatim, so a reader can see the quote was not taken out of context.
- **Verbatim means verbatim.** Copy quotes and contexts programmatically from the source file or page text, and check that each quote appears inside its context and each context inside its source, before building. Never reconstruct a quote from memory, and never "tidy" its spelling or math.
- **Say how far each record is checked.** A source you could not open keeps no quote and says so ("Reference only · …"); the page shows it as unverified rather than inventing support.
- **Copyright.** Long passages from other people's work are for private reading copies. Before publishing a page, keep each quoted passage within what the source's licence allows (many arXiv papers are CC-BY; journal pages often are not), or link to it instead.
- **Sources live in BibTrace** (schema just below), so the same file works in any reference manager and carries the evidence tree.

## BibTrace, the source format (schema)

Standard BibTeX/BibLaTeX, plus `trace-*` fields that other tools ignore. The data file points at it with `"bibliography": "refs.bib"`; sentences cite an entry by its key. Quote 1 has no number, and later quotes are `-2`, `-3`, ….

| Field | Holds | Shown as |
| --- | --- | --- |
| any standard field (`author`, `title`, `journal`, `shortjournal`, `volume`, `number`, `pages`, `year`, `doi`, `url`, `eprint`, `archiveprefix`, `publisher`, `howpublished`, `shorthand`, …) | the reference | citation and reference list, in the reader's chosen style |
| `trace-quote[-n]` | the exact words, verbatim | the quote |
| `trace-quote[-n]-location` | where they sit | the line under the quote |
| `trace-quote[-n]-context` | the full passage around them, verbatim; it must contain the quote | **Where it sits**, with the quote marked |
| `trace-quote[-n]-context-withheld` | why the passage is not reproduced (for example copyright), instead of a context | "Passage not reproduced: …" under the quote |
| `trace-quote[-n]-tags` | tag ids, `;`-separated | coloured tags on the quote |
| `trace-quote[-n]-note-m` | notes on the quote (m = 1, 2, …) | the quote's children |
| `trace-quote[-n]-comment-m`, `trace-quote[-n]-comment-m-by` | people's comments on the quote, and who wrote them (optional) | under the quote, after its notes |
| `trace-quote[-n]-added-by`, `-added-via`, `-checked-by`, `-checked-on`; `trace-quote[-n]-note-m-by` | who added and who checked each quote; who wrote each note | a quiet provenance line under the quote |
| `trace-added-by`, `trace-added-via`, `trace-added-on` | who added the record, and how (manual, Zotero, agent, script, PDF, web page) | "Record added by … via …" |
| `trace-status` | how far the record is checked | the record's status |
| `trace-checked` | date checked (YYYY-MM-DD) | |
| `trace-url-read` | the page actually read | |
| `trace-note` | anything else about the record | |

A full example is in `examples/bibtrace-example.bib`; the parser, writer and converter are `scripts/bibtrace.mjs`. The validator rejects a quote without context unless a reason for withholding it is recorded. It also rejects a context that does not contain its quote verbatim.

**Filling contexts.** Copy contexts programmatically, never by hand:
- **Local files:** read the paragraph around the quote straight from the file, as the example paper does.
- **arXiv abstracts:** arXiv metadata, abstracts included, is CC0, so an abstract can be the context of a quote from it. Read it from the abstract page and check that it contains the quote.
- **Paper bodies:** use your own copies of the PDFs with `node scripts/contexts-from-pdf.mjs --bib refs.bib --pdfs ./pdfs [--write]`. It finds `pdfs/<key>.pdf` or `pdfs/<arXiv id>.pdf`, runs `pdftotext`, and joins line breaks and end-of-line hyphens. It adds the paragraph that contains the quote exactly, and reports quotes it cannot match, for example when math is typeset differently in the PDF. Web-reading tools may refuse to return long passages, and that limit is right: don't work around it, use your own copies.


Trace is an evidence outliner. Its generic reading code is vendored into `trace/` in this skill (copied once from Trace by a maintainer-only script that is not shipped, with the original paper's data files replaced by empty stubs), so the builder needs nothing outside this folder. Open `references/outliners-reading.html` (and `references/document-structure-reading.html` when present) to see the format working: each is one self-contained file, Reading view only.

## 0. Make a single-file reading page (the usual job)

Do not reimplement the interactions. The builder inlines Trace's own scripts and styles, so the tag tree, hover focus, pinning, the sentence hover outline, click-to-open evidence, citation colouring, the drawer and search behave exactly as in Trace.

```bash
node scripts/build-reading.mjs --data trace.json --out paper.html
# sources from a BibTrace bibliography (or set "bibliography" in the data):
node scripts/build-reading.mjs --data trace.json --bib refs.bib --out paper.html
# data as a separate file, fetched when served (otherwise it is baked in):
node scripts/build-reading.mjs --data trace.json --out paper.html --data-url paper.json
```

- `--data` is a **trace data file**, the JSON shape Trace stores (its `outline.json`): `format` (`"tracecite/1.0"`), `version` (storage revision `2`), `title`, `subtitle`, `tagTree`, `blocks`, `sources`, and optionally `documentStructure`, `bibliography` (a BibTrace .bib file), `mathTags` and `crossRefs`. Blocks are `{id, type, text, tags, fields:[{key,value}], collapsed, children}`. Types: `section`, `paragraph`, `sentence`, `citation`, `reference`, `note`, `figure`, `table`, `table-row`, `table-cell`. A citation or reference links to a source with a `Source ID` field. A source carries `APA citation`, `Year`, `APA reference`, `URL`, `Exact quote`, `Quote location` (and `Exact quote 2`…). Tag families get their colours from the root tag ids in `reading-peek.js` (`role` blue, `support` amber, `topic` green, `revision` plum).
- `--trace` points at a Trace checkout (default: the vendored copy in `trace/`). Figures named in `Assets` and `Video poster` fields are resized and embedded. Videos are left out.
- The output keeps only the Reading view. Other views, editing, export and the sources page cannot be reached. A tag chip inside an opened sentence pins that tag in the reading tag tree instead of switching views.
- `scripts/reading-only.js` holds those reading-only rules. The phone-only CSS lives in the builder.
- There is no paper card by default: the text sits directly on the page.
- **Sidebar menu.** Under the document title come Search (⌘K), Contents and Tag tree, each with an icon. Below them the paper's top-level sections are listed ("In this outline"), and Settings sits at the foot. Contents (`#/contents`) and Tag tree (`#/tags`) are standalone views, like Settings. Contents lists the sections with sentence counts. Tag tree is a full-screen board: one column per tag family, each tag with its count and a thin bar for its share of the family. A detail pane lists the picked tag's sentences by section, with "Read the paper with this tag in focus". Picking a sentence opens it in the paper. On narrower screens the pane drops below, and on phones the columns stack. Rows highlight by colour only, never a box or outline. The sidebar text uses four steps of ink, each mixed toward the panel colour so every theme keeps the same hierarchy: the title, then the menu items, then the contents list and Settings, then labels, numbers and key hints. Only the active item takes the accent. The menu buttons use `data-side-view`, not `data-view`, because the reading-only guard blocks every `data-view` control.
- **Desktop sidebar is persistent and collapsible** (house style). It stays open on the left and pushes the paper. The margin tag tree moves beside it. A « » toggle or the `[` key collapses it to an icon rail (Search, Contents, Tag tree, Settings) with tooltips. The state is saved and applied before first paint. Trace still treats it as a drawer, so `settings.js` keeps it open on wide screens. Phones keep the bottom menu icon and the full-screen sheet.
- **Search prefixes and icons.** `#` searches tags only and `@` searches sources only, and a small chip in the field shows which. Each result has a kind icon: a list mark for sections, a paragraph mark for sentences, a tag for tags and a book for sources.
- **Parametric tags** (`scripts/params.js`). These are tags that carry a value for every sentence instead of yes or no, so each is shown as a chart, never as a bare slider. They sit at the top of the tag tree in a quiet teal: first in the left margin, and as the first column of the Tag tree board.
  - **Collapsed by default.** Like tags, they are rows with chevrons. A chart appears only when its row is opened.
  - **Plot vocabulary.** Add new plot types to `chart()` in `params.js` and nowhere else.

    | Plot | For | How the reader filters |
    | --- | --- | --- |
    | `histogram` | continuous numbers | brush across the bars, or use the range slider under the chart |
    | `strip` | continuous numbers, one dot per sentence | brush across the dots, or use the range slider |
    | `counts` | small whole numbers | tap values on and off (for example 0 and 2, not 1) |
    | `categories` | text values | a labelled bar list; tap values on and off |

    Without `plot`, text gets `categories`, whole numbers spanning 8 or fewer get `counts`, and the rest get `histogram`.
  - **Range slider.** A thin track with two round handles and the span between filled. Dragging is exact, not snapped to bars, and the paper updates live while dragging. Arrow keys move a handle, clicking the track moves the nearer handle, and dragging both handles to the ends clears the filter.
  - **Every chart** has a caption with the selection and sentence count, and a Clear link right there.
  - **Filtering** dims the paper outside the selection. Several parameters narrow together and also combine with a pinned tag. On the board, the detail pane lists the sentences in range.
  - **Data:** a top-level `parameters` list in the trace file, shaped like `tagTree`, with `measure` (`characters`, `words`, `citations`, `quotes`, `{ "field": "Key" }` for a number, `{ "field": "Key", "type": "category" }` for text), and optional `plot` and `unit`. Without the list, Length (Characters as a histogram, Words as a strip) and Evidence (Citations and Checked quotes as counts) are used.
- **The Tag tree board folds like the tree.** Tag rows with children have a chevron and start folded. Layout follows the space the view actually has (a container query), not the screen width, so nothing overflows beside the sidebar. No grid minimum may exceed its column.
- **Bottom bars follow the phone toolbar pattern.** The pinned-tag bar and the parameter bar are one pill each: a leading icon (a tag or a small chart), the label, a quiet count, and a thin × at the trailing edge. On phones they sit on the menu button's row, 50 px tall, above the safe area. When both are active, the parameter bar stacks just above. Text glyphs (⌖, ×) are replaced with real icons.
- **No ellipses.** Labels never end in "…". They wrap with a hanging indent instead: numbers and icons keep their column and wrapped lines align under the text. This covers the sidebar, margin tree, parameters, board, search and bottom bars, and bars grow taller rather than cut. The only clamp is long sentences in search (two lines), and those carry their full text as a tooltip.
- **Skeleton while loading, never forever.** The builder puts a shimmering outline of the paper (title bar, headings and paragraph lines) in the markup, and Trace replaces it on first render. It uses the house-style skeleton colours per theme and holds still under reduced motion. `scripts/boot.js` guards it: a script error that leaves nothing drawn ends it after 0.6 s, a missing or slow data file ends it within 8 s, and anything else ends it after 10 s. Each case replaces the shimmer with a plain message: what went wrong, the error in small grey, and Try again. No loader, splash or skeleton in an outliner page may run without such a limit.
- **Data lives in the page.** By default the builder bakes the data into the HTML (`<script id="trace-data" type="application/json">`), so one file works on its own, even opened from disk. Only when the data must stay a separate file, build with `--data-url paper.json`: the builder writes the trimmed data next to the page, and the page fetches it when served and runs the reading scripts once it arrives. Opened from disk, such a page says it needs a server instead of spinning.
- **Math (LaTeX).** Write math in any block text, field value or source field as `\( … \)` or `$ … $` inline, and `\[ … \]` or `$$ … $$` for a display equation; `\$` is a literal dollar. MathJax 3 (TeX → SVG, from cdn.jsdelivr.net) renders it, so it takes the text colour in every theme. `scripts/math.js` sets it up. Trace re-renders the whole paper from raw text whenever a sentence opens, so typesetting again would flash raw TeX and make the page jump. Instead every rendered formula is cached by its TeX, and a MutationObserver swaps cached copies in synchronously, before the browser paints. Only formulas never seen before are typeset (asynchronously, then cached), so math also renders in the hover outline, opened evidence, search results and the views. MathJax's context menu is off, so clicking a formula behaves like clicking its sentence. The □ that ends a proof (`\square`) is the usual end-of-proof mark, not a rendering fault. Trace styles every `<svg>` as a 19 px stroked icon, so math.js copies each formula's own width and height into inline styles, and `themes.css` resets its fill and stroke; without that, formulas shrink into 19 px boxes. The builder adds MathJax only when the data contains math; `--math on` forces it, and `--math off` leaves it out. The validator warns about unbalanced delimiters. Long display equations scroll sideways on phones instead of overflowing. Offline, the TeX stays readable as plain text. In JavaScript generators, write math in `String.raw` templates, for titles and review fields too, so the backslashes survive. Macros `\R`, `\N`, `\Z`, `\C` and `\D` give the blackboard-bold sets.
- **Highlighting inside equations.** `\hl{…}` colours part of a formula in the accent colour, and `\hlb{…}`, `\hlg{…}`, `\hla{…}` and `\hlp{…}` use the blue, green, amber and plum tag colours (MathJax `\class`, styled in `themes.css`). Standard `\color{…}{…}` and `\textcolor{…}{…}` also work. Use it sparingly, for the part of an equation a sentence is about; colour is never the only signal.
- **Math tags** (`scripts/math-tags.mjs`, run by the builder). The builder parses every formula and adds a **Mathematics** family to the tag tree, so the symbols and kinds of mathematics become tags like any other:
  - **Variables:** symbols used on their own, most used first. Grouped by the document's own `mathTags.groups` when given, then known constants (π, ℏ) under Constants, then the rest under the section that uses each most, in document order.
  - **Indices:** letters used mostly as subscripts or superscripts.
  - **Number sets:** ℝ, ℕ, ℤ, ℂ, 𝔻 and so on.
  - **Equation types**, grouped as Relations (equality, inequality, approximation, set relation), Algebra (summation, product, fraction, binomial, root, logarithm, trigonometry, absolute value), Calculus (integral, derivative, limit, extremum, infinity, arrows, asymptotic notation `O(…)`) and Layout (display, numbered).

  Every sentence, table cell or note with math gets the matching tags, so hovering or pinning `n` or "Summation" dims the paper to where it is used. It also **lights up that symbol or construct inside the rendered equations** in the accent colour (`scripts/math.js` reads the index the builder embeds). An opened sentence lists its math tags on their own line, "In the mathematics", with symbols first and then kinds. The family is neutral in tone and is left out of Flow. Grouping is partly a judgement about the topic, so a document can set it in the data; the data file itself is never changed:

  ```json
  "mathTags": {
    "groups": { "Counts": ["n", "k"], "Probabilities": ["p", "q"], "Constants": ["\\pi", "e"] },
    "labels": { "n": "number of items", "\\mu": "mean" },
    "minSentences": 2, "exclude": ["d"], "off": false
  }
  ```

  Labels show in the tree as "n · number of items". `--math-tags off` leaves the family out.
- **BibTrace: sources live in a standard .bib file** (`scripts/bibtrace.mjs`). Point the data at it with `"bibliography": "refs.bib"` (relative to the data file), or build with `--bib refs.bib`. Sentences cite an entry by its key (`"Source ID": "raggett1999html"`). Every entry is ordinary BibTeX or BibLaTeX, so any reference manager or LaTeX build reads it; the trace evidence rides along as extra `trace-*` fields, which other tools ignore:

  ```bibtex
  @techreport{raggett1999html,
    author      = {Raggett, Dave and Le Hors, Arnaud and Jacobs, Ian},
    title       = {{HTML} 4.01 Specification},
    institution = {World Wide Web Consortium}, type = {W3C Recommendation}, year = {1999},
    url         = {https://www.w3.org/TR/html401/intro/intro.html},
    trace-quote            = {HTML has its roots in SGML which has always been a language for the specification of structural markup.},
    trace-quote-location   = {2.4.1 Separate structure and presentation · first sentence},
    trace-quote-context    = {…the whole paragraph the quote sits in, verbatim…},
    trace-quote-tags       = {topic-markup},
    trace-quote-note-1     = {The quote opens its passage.},
    trace-status   = {Checked excerpt · verbatim against the page text},
    trace-checked  = {2026-11-24},
    trace-url-read = {https://www.w3.org/TR/html401/intro/intro.html},
  }
  ```

  - **Evidence is nested, in the outliner's spirit.** Each quote (1 has no number; then `-2`, `-3`, …) can have children: `-location` (where it sits), `-context` (the longer passage, verbatim), `-tags` (tag ids, `;`-separated) and `-note-1`, `-note-2`, … (notes on it). In an opened sentence the quote shows its tags, then a **Where it sits** disclosure with the passage and the quote marked, then the notes.
  - **Record fields:** `trace-status` (how far the record is checked), `trace-checked` (date), `trace-url-read` (the page actually read) and `trace-note`.
  - **Labels:** BibLaTeX's `shorthand` field overrides the author–date label, which suits working files ("Lab notes, March" instead of "Lab, 2026f").
  - **Parsing:** LaTeX accents (`Erko{\c c}`), `--` dashes, `@string` and `#` concatenation are handled.
  - **Honesty:** quotes and contexts must be verbatim. When they come from local files, copy them programmatically and check that each appears in its file before building.
- **Citation styles** (`scripts/cite-styles.js`, `scripts/citations.js`; Settings → Reading → Citation style). Six styles, applied to the inline citations and the reference list of every source that comes from a bibliography:

  | Style | In-text citation | Used in |
  | --- | --- | --- |
  | APA 7 (default) | (Thomson, 1904) | psychology, education, social sciences |
  | Chicago | (Thomson 1904) | humanities, many sciences |
  | Physics (APS) | [1, 3] | Physical Review and most physics journals |
  | Nature | superscript ¹˒³ | Nature, Science-style journals |
  | Vancouver | (1, 3) | biology and medicine |
  | IEEE | [1], [3] | engineering, computer science |

  Numbered styles number sources by first citation, compress ranges (1–3) and order the list to match. Same author and year get a, b, c in the author–date styles. The scripts load just before Trace's `app.js`, because Trace draws the paper as soon as it loads. Changing the style reloads the page. The data is never rewritten.
- **Cross-references** (`scripts/crossrefs.mjs` at build time, `scripts/crossref.js` on the page). The builder finds where each label is stated:
  - a sentence starting "Theorem 4.1." or "Lemma 7.2 (name).", where a summary's "Theorem 4.1:" counts as a mention;
  - an equation `\tag{3.1}`;
  - a numbered heading ("6.3 A collar…");
  - a "Table 1" or "Figure 2" title.

  Every mention ("Theorem 4.1", "Lemmas 3.1 and 5.2", "Lemma 2.4(b)", "Section 6.3", "(3.1)") becomes a link in the citation colour. Clicking it scrolls to the target and flashes it, without opening the sentence around the link. A result's own statement never links to itself. The tag tree gains a **Cross-references** family: States a result, Recalls a result, Points ahead, and Results (one tag per result, grouped by Theorems, Lemmas, Equations, Sections and so on). So hovering "Lemma 5.2" shows every sentence that relies on it. `"crossRefs": {"off": true}` leaves it out.
- **Equation hover** (Settings → Reading → Highlight in equations, on by default). Hovering a symbol inside any equation lights up the same symbol in every equation on the page. Hovering an equation shows a small copy button that copies its exact LaTeX (beside display equations, clear of their number; above inline ones). Clicking it never opens the sentence. Escape clears both.
- **Colour palettes** (Settings → Appearance → Colour palette). Every theme keeps its own colours as the first choice and offers a few curated alternatives, drawn as circles:
  - **Sage:** whole pastel families (Mist, Clay, Lavender, Rose).
  - **Textbook Light:** paper tints (Mint, Sky, Lilac).
  - **The other themes:** accent families (Lavender, Sage, Sky, Rose).

  Amber and red are never offered, because they mean problems. Palettes are saved per theme and applied before first paint, and the colours are `[data-palette]` rules in `themes.css`. Add a palette only when it holds up in both the paper and the sidebar.
- **Comments** (`scripts/comments.mjs`). A comment is an outline block: `{"type": "note", "text": "…", "fields": [{"key": "Comment by", "value": "Name or empty"}, {"key": "Commented on", "value": "2026-11-24"}], "tags": […], "children": [replies]}`. Put it as a child of the sentence, citation or reference it is about. Replies are comments under it.
  - **Never in the prose:** the builder patches Trace's structure so comments are skipped there.
  - **In the tag tree:** a **Comments** family, with one tag per person plus Unsigned. Each comment and its sentence are tagged, so pinning a person shows everything they commented on.
  - **In an opened sentence:** "N comments", threaded, with the person, the date, the text and their tags.
  - **Quotes in BibTrace** take comments as `trace-quote[-n]-comment-m` (and `-by`).
  - **Honesty:** never invent comments for real people; sign generated review remarks as what they are, for example "AI agent (review)".
- **References drawn from BibTeX parts** (`cite-styles.js` `referenceParts`, `citations.js`). Every reference, in the list and in an opened sentence, is rebuilt from its parsed fields. Authors, year, title, venue (italic where the style says), volume (bold in APS and Nature), issue and pages each get a quiet class (`ref-authors`, `ref-year`, …). The DOI and arXiv id become links in the citation colour. Numbered styles show the number in a faint tabular figure.
- **More tag tones.** Besides Trace's blue, green, plum and amber, the builder can use teal, indigo and olive (`--reading-teal` and so on, light and dark). Math variable groups cycle through blue, teal, plum, green, indigo and olive, leaving out amber, so a symbol's group colour is the same in the tag tree, the "In the mathematics" line and the equation highlight.
- **Symbol marks in equations.** A hovered or focused symbol takes its tag group's colour (the accent for equation types) on a soft rounded tint behind it, drawn as an SVG rect inside the symbol's own group so it follows the glyph exactly. The copy-LaTeX button is a quiet round icon that fades in, turns into a check with "Copied", and fades out.
- **Mathematical environments** (`scripts/environments.mjs`, `scripts/environments.js`). A paragraph tagged `env-<kind>` renders as that environment. They are typeset like LaTeX's amsthm. Results stand apart with breathing room and a quiet accent rule on the left (neutral for definitions and assumptions, lighter for remarks and examples). Proofs sit indented under their result with a fine rule, one step per line. Theorem-like blocks get a run-in bold **Lemma 7.4 (name).** with the statement in italics (math stays upright). Proofs get a run-in *Proof.* (or *Proof of the upper bound.*) and a quiet "end of proof" mark on the right, never a bare square. Definitions, remarks and examples stay upright.
  - **Tag tree:** the "Mathematical structure" family (Theorems, Lemmas, …, Proofs) is added automatically before validation whenever a document uses `env-*` tags. Trace passes a paragraph's tags down to its sentences, so focusing Proofs dims everything else.
  - **Cross-references:** they resolve to these blocks via their "Label".
  - **Migrating old documents:** `splitEnvironments()` turns sentences written as "Lemma 2.1. …" and "Proof. … (End of proof.)" into tagged blocks.
- **Provenance** (`scripts/provenance.mjs`). Every part of a trace can say who added it and how: "Added by", "Added via" and "Added on" on any block, and the BibTrace fields above on records, quotes and notes.
  - **Tag tree:** an **Added by** family (one tag per person or agent, plus Added via), and each sentence is tagged with everyone behind it and its evidence.
  - **Opened sentences** show "Sentence added by …", "Record added by … via …" and "added by … · checked by … on …" under each quote.
  - **Honesty:** record agents as agents ("AI agent (review)", "script (verbatim check)"), never as a person.
- **Icons for generated families** (`tag-icons.js`):
  - a person for human authors, and a small robot head for agents and scripts (comment authors and Added by);
  - a speech bubble for comments, with dots for unsigned ones;
  - Σ for mathematics and equation types, and an italic x for variables;
  - a link for cross-references, and a recall arrow for Recalls a result;
  - a document for results, and a document with a tick for proofs.
- **Opened sentence focus.** Opening a sentence dims the rest of the paper to 32% (sentences, headings, environment labels, references, figures), so the selection is obvious without a background or outline; hovering another sentence lifts it to 70%. The opened outline unfolds from the line: its rows and tags ease in from just above, staggered by 30–40 ms. It is pure CSS (`:has()`, opacity and transform only), so it stays smooth on long papers, and reduced motion skips the animation.
- **Performance.** Equation marks are applied lazily: only to formulas on screen (plus 600 px), and to the rest as they scroll into view, through an IntersectionObserver. Parent tags (many symbols) colour without the tinted backing. Tag-tree focus changes are debounced (90 ms), and the observers watch only what they need, so hovering a top-level tag stays around 10–25 ms even when it matches every sentence. Trace's own cap of 100 fields per block is raised for reading builds, since sources with many quotes, contexts and provenance need more.
- **Inline markdown.** `**bold**` or `__bold__`, `*italic*` or `_italic_`, and `` `code` `` render in block text, fields and quotes (`scripts/rich-text.js`, always included). The data keeps the raw characters, so exact quotes stay verbatim; only the display changes. Math segments are left for MathJax. Code, inputs, SVG drawings and anything inside `.no-md` are skipped. Word-internal underscores such as `file_name` are not italics.
- **SVG text never inherits the icon stroke.** Trace's global `svg` rule gives every drawing a 1.6 px stroke, and text inside a drawing inherits it, looking bold and smudged. `themes.css` sets `svg text{stroke:none}`. Flow cards with an icon start their label 6 px after the icon, left-aligned like a chip, and widths are estimated at 7.1 px per character, so the label never runs into the icon.
- **The sidebar** (redesigned in `themes.css`) is a borderless floating panel with one 12 px gutter and 36 px rows (48 px on phones). It holds the document title and ×, the Tag tree / Contents text tabs on narrow screens, numbered contents and Settings at the foot. It has no search field, help footer or workspace note. Selection is shown by colour only.
- **Search** (`scripts/search.js`) is a Spotlight / Arc-style command bar. It opens from a search button beside the menu button, ⌘K / Ctrl K, or `/`, and floats near the top of the screen with one large field. It has no group headings, footer or key badges. Each result is one line with a small grey label (Section, Tag, Source, or the sentence's section), and matched words are in the accent colour. Use ↑ ↓ to move, ↵ to open and esc to close. The field never shows a focus ring. A sentence or source result scrolls to the sentence and opens its evidence, and a tag result pins the tag. On phones it is a full-screen sheet like iOS search: a pill-shaped field with Cancel, then large rows with the label underneath. The buttons sit at the bottom of the page.
- **Navigation is one icon.** A menu icon with no app name opens a full-height sidebar headed by the document's title. Settings lives at the foot of the sidebar, not in a corner. On phones the icon sits at the bottom left and the sidebar opens full screen.
- **Tag focus on phones.** A full-screen sheet hides the paper, so tapping a tag closes the sheet and pins it. The bottom bar then shows the tag, a counter (for example 3 / 5) and up and down arrows that scroll to the previous or next matching sentence, so the reader sees the paper adapt. Those taps are caught before Trace's own "tap elsewhere clears focus" handler.
- **The opened sentence is redesigned** (in `reading-only.js`, read straight from the trace data). It shows the sentence's tags as coloured words that pin when clicked, the reason for them in one muted line, and each source: its name, the exact quote, where the quote sits, and the reference in small grey with an "Open" link. A source without a checked quote says so in one quiet line. It has no nested toggles, type labels, panels, borders, glyph arrows or underlines. Bookkeeping tags (authors, workspace, structure) are left out. Trace's own panel stays hidden in the page so opening and closing behave as before.
- **The tag tree highlights by colour, never weight.** Tags at rest are a lighter, less saturated mix of their family colour. Hovering, previewing or pinning a tag gives it the full deep colour, at the same weight and with no fill or underline.
- **Settings** is its own view, in the house-style layout (`#/settings/appearance`, `#/settings/reading`, `#/settings/about`). It opens from the gear at the top right and from the foot of the sidebar. `scripts/settings.js` builds it and `scripts/themes.css` styles it.
  - **Appearance** has eleven themes. Sage is Trace's own pastel look. Seven are the house-style (Tosi) themes: Matte Black, Pitch Black, Clean Minimalist, Blackboard, Neumorphism, Textbook Light and Textbook Dark. Three are reading themes. **Book** is calm warm paper with one bookish serif for everything, in the spirit of a reading app's calm mode; the face is the single token `--font-book` (Gentium Book Plus). **Whiteboard** is Blackboard's white sibling: marker outlines, Kalam headings and highlighter strokes; it shares Blackboard's rules through `:is()`. **Magazine** is opinionated editorial: DM Serif Display headlines, Source Serif text, heavy rules, small-caps kickers and drop caps; floating parts (sidebar, search, sheets) keep their rounded corners. Each has palettes: Book has Calm, Paper, Quiet and Night; Whiteboard has Marker, Grid, Sticky note and Glass board; Magazine has Violet, Newsprint, Ochre and Noir. Their fonts load only when the theme is chosen. `themes.css` maps them onto Trace's variables and its hard-coded reading surfaces. The saved theme is applied in `<head>` before the page draws.
  - **Reading** sets text size, line spacing, the outline in the margin, the tag tree in the margin, coloured citations and the paper card.
  - **About** shows the document's counts, the date of the data, the format and the privacy note.
  - Preferences stay in `localStorage` (`trace-reading-prefs`). Poppins and Literata load from Google Fonts when online, with system fallbacks.
- The eyebrow label comes from the data's `eyebrow` field or `--label`.
- `examples/outliners-article.mjs` writes a second, self-contained demonstration: an essay on outliners (`references/outliners-reading.html`). Its quotes are verbatim from Trace's README, design brief and code comments. Its classic sources (Engelbart, OPML) carry no quote, so the page shows them as unverified. Use it as a template for new trace data.

The rest of this skill describes the format itself, for when a new tool must follow it.

The idea in one sentence: **one tree of blocks, shown as a calm paper you read, which unfolds in place to the exact evidence behind any sentence.**

## 1. The main rules

### Read first, edit second
- Every visit opens in **Reading** mode. No text is editable, and there are no field panels, add or delete buttons, undo, import or an editing dock. Folding, tags, sources, search and export still work.
- One switch enters **Editing**, and the same switch shows **Editing · Done** to leave. Do not remember the mode between visits.
- Editing a sentence marks it **Needs rechecking**. Editing a source flags every sentence linked to it. The tool never claims that changed text is still supported.

### One tree, several views
The document is one tree of blocks. Views are projections of the same blocks, never copies.
- **Reading** shows clean prose with author–year citations and a reference list. It is the default.
- **Outline** shows the hierarchy with disclosures, labels, tags and fields.
- **Tags** shows a tag tree beside the sentences that carry the selected tag. Selecting a parent includes its children, and each sentence appears once.
- **Sources** shows the source library. A source is a shared record, so editing it updates every citation that links to it.
- Switching views never rewrites or discards blocks.

### The hierarchy
Section → paragraph → sentence → citation → exact reference (the quote with its location). Every level has the same block row:
- a **circular disclosure** (a chevron in a soft circle) on the left
- a small grey **type label** (`section`, `paragraph`, `sentence`, `citation`)
- the **text**
- a row of small **tag pills** underneath
- in Editing mode only, a subtle **Fields** pill and a **+** to add a child

Children sit behind a thin pale indentation guide, not inside a card. Only one surface is ever a filled panel: the **open exact reference**, a pale cream rounded block with the verbatim quote, its locator line (for example "Abstract · final sentence") and its fields.

### Fields are inline key:value rows
Fields open under the block as a quiet two-column list (key in small grey, value in body text), like Tana or Logseq. They are not a form or a modal. Any block can have any fields. Shared source fields (`APA citation`, `APA reference`, `URL`, `Exact quote`, `Quote location`, `Exact quote 2`…) live on the source record.

### Reading rails (wide screens only)
At 1280 px and wider, Reading mode gets two quiet rails with no container chrome:
- **Left rail, the tag tree.** Coloured by family (blue, green, plum, amber, neutral). Hovering a tag dims every block that does not carry it, and clicking pins that focus. A floating × or Escape clears it. Nothing is hidden, reordered or rewritten.
- **Right rail, the hovered sentence.** Hovering a sentence highlights it with a soft green wash and shows its outline in the rail: the sentence, its tags, then its citations and evidence as small disclosures.

Under 1280 px the rails disappear. The tag tree moves into the sidebar drawer, and tapping a tag closes the drawer and leaves a pinned-focus chip.

### Navigation stays out of the way
- The sidebar is a floating drawer opened from a pill button ("☰ Trace ⌄") at the top left. It holds the view switch, search ("Find in paper", with `/` as the shortcut), numbered contents (01, 02 …) with the current item as a filled pill, the source library with a count, and a "Local workspace · No account. No uploads." note at the bottom.
- Document actions (save status, Edit document, Export, Import) live behind one circular chevron at the top right.
- The paper ends with a small ✳ mark and a one-line summary of the counts.

## 2. Look

Tokens, in HSLA:

```css
:root{
  --canvas: hsla(77, 27%, 93%, 1);    /* sage workspace */
  --paper: hsla(60, 57%, 98%, 1);     /* warm white page */
  --ink: hsla(86, 20%, 16%, 1);
  --muted: hsla(87, 10%, 39%, 1);
  --faint: hsla(87, 8%, 47%, 1);
  --green: hsla(85, 25%, 31%, 1);     /* selected switch, save dot */
  --green-wash: hsla(81, 32%, 90%, 1);/* hover, active nav pill, sentence highlight */
  --line: hsla(74, 19%, 88%, 1);      /* indentation guides, rules */
  --peach: hsla(36, 70%, 92%, 1);     /* amber pills, quote surface */
  --lavender: hsla(248, 27%, 94%, 1); /* revision and structure pills */
  --radius: 22px;
}
```

- **Type.** In the reading edition, Poppins is the default everywhere, for interface and paper text. Textbook themes keep Literata for headings only. In Trace itself: Raleway for headings and interface (titles about 32 px, semibold, tight letter spacing). Nunito for paper prose, at 14–15 px with generous line height (about 1.9 in Reading). Small uppercase labels with wide tracking ("AN ESSAY ON OUTLINERS", "IN THIS OUTLINE").
- **Shapes.** The paper has about 32 px corners. Pills, switches and nav items are fully rounded. The disclosure is a circle. Phone screens round to about 36 px.
- **Colour.** Almost everything is sage and cream. Pills use small tints: sage for topics and drafts, lavender for revision and structure, peach for "Needs rechecking" and interpretation. Citations in Reading prose are a muted blue. There is no dark theme in the original, and none is needed unless asked.
- **Calm.** No cards per sentence, no dashboards, no charts in the shell, no gradients, no heavy borders, no underlines. Soft shadows only on the shell and the floating drawer.
- **Touch.** Every control is at least 44 px high on phones. Editing uses a floating rounded dock at the bottom ("＋ Add child", "Fields", "Undo") instead of a tab bar.

## 3. Content rules

- **Never fabricate evidence.** A quote is verbatim and has its own location. Locators use sections and passage positions for HTML sources, not invented page numbers.
- **Interpretation is labelled as interpretation.** A sentence that is the author's synthesis carries a pill such as "Our interpretation", and the source fields say what the source does and does not support ("Support & scope").
- **Every sentence has a support decision** that is separate from its role tags, and the decisions can be exported as an audit.
- **Changes are explicit.** Revisions go in as guarded, named updates with a map of what changed. They never silently replace saved work.

## 4. Keyboard (Editing mode)

| Key | Action |
| --- | --- |
| Enter | New sibling |
| Ctrl/⌘ Enter | New child |
| Shift Enter | Line break |
| Tab / Shift Tab | Indent / outdent |
| Alt ↑ / ↓ | Move among siblings |
| Ctrl/⌘ Z, Ctrl/⌘ Shift Z | Undo, redo |
| Escape | Leave the text for the block's Fields control |
| / | Focus search |

## 5. Export

Outline JSON (every block and field, the editable backup), nested Markdown (the outline with its exact-source blocks), and APA-style Markdown (the manuscript only, with no planning notes).

## 6. Before you show it

- Open it fresh and confirm it starts in Reading mode with nothing editable.
- Open one sentence all the way down to its quote and check the quote surface is the only filled panel.
- At 1440 px, hover a sentence and a tag and check the two rails respond. At 390 × 844, check the drawer, the 44 px targets and that the rails are gone.
- Switch views and back, and confirm nothing in the tree changed.

## Schema, Flow, tables and media

- **Unknown tags are errors.** Trace refuses to draw a page whose blocks carry a tag that is not in `tagTree` ("A block refers to an unknown or duplicate tag"), so the validator treats it as an error, not a warning. Give a table no tags unless the tag is in the tree.
- **Schema.** `schema/tracecite-1.0.schema.json` (JSON Schema 2020-12) defines trace data independently of any viewer. It covers the outline (`blocks`), the separate tag schema (`tagTree`), shared `sources`, optional `parameters` (parametric tags) and optional `flow` settings. `scripts/validate-trace.mjs <file>` checks a file with no dependencies: ids, block types, table nesting, `Source ID` links, figure asset paths and files, parameters and quote locations. The builder runs it first and stops on errors.
- **Self-contained.** Trace's generic reading code is vendored into `trace/` (copied once by a maintainer-only script that is not shipped). The original paper's data files are empty stubs, and no paper-specific text remains. The builder needs nothing outside this folder.
- **Flow (advanced, off by default; Settings → Reading → Flow view).** This is an automatic structural analysis, and nothing about it is stored in the document. At the chosen level (sentences, paragraphs or sections) it works out which tags carry the structure.
  - **Labelling.** Every tag family, and the second level of nested families, is tried as a set of states.
    - **Unit labels.** A paragraph's or section's own tag in that family states the author's intent and is used directly. Otherwise the unit takes its sentences' most common tag.
    - **Scoring.** Each candidate is scored on its sequence with repeats collapsed, because structure is what follows a change. The score is the information the current state gives about the next one, I = H₀ − H(next | current), in bits. H₀ is the fair baseline: any other state, in proportion to how common it is, since a collapsed sequence never repeats. Two kinds therefore score zero, because they can only alternate. Counts use add-0.5 smoothing, so moves seen once don't count as certainty.
    - **Weighting.** The score is multiplied by coverage, with a penalty above 8 states. The best candidate is used, and the page says which and what share of the next-step uncertainty it explains.
  - **Inferred structure.** This is the primary chart. The main line starts where the document starts and follows the most frequent next tag. Other moves seen at least twice (or 34% or more) become side branches, and dashed returns go back to earlier steps. It is an approximate reading, not a rule.
  - **"How this was inferred"** (folded) holds the observed path (runs in reading order) and the transition arc chart (shown when some tag has at least `minTransitions` onward moves).
  - **Layout.** The inferred flowchart leads the view, centred on a faint dot-grid canvas. Its explanation sits directly under it, then the level picker (Sections, Paragraphs, Sentences, each with an icon), then the description and the folded evidence.
  - **Pan and zoom.** Drag to pan (on touch, a sideways drag pans and a vertical one scrolls the page). Cmd or Ctrl plus scroll, a trackpad pinch or a two-finger pinch zooms at the pointer (0.5×–3×). A drag past 4 px never clicks. Double-click on empty space, the reset button (shown only once moved), or 0 resets, and + and − zoom while focused. Changing level resets the view.
  - **Pencil ink.** Lines and heads pass through a light displacement filter, with a faint offset grain stroke. Arrowheads are open pencil V's, about 9 + 1.9 × width long, with two equal sides at equal angles. Their axis runs from where a circle of radius one head-length around the tip crosses the line (found by bisection) to the tip, so the head sits square on the end of the line even on tight curves. In the measured charts, the left and right angles agree to within 0.35°. Every edge stops 3 px short of its card, and dashed edges end in a solid stretch so the head never sits in a gap.
  - **Hierarchy by colour.** Main-line cards use the deepest tone of their family. Side-branch cards are lighter, less saturated and dash-bordered. Percentages are muted, and fainter still on dashed edges. The text below grades from ink (basis) to faint (notes).
  - **Centre.** A permanent centre icon fits and centres the chart. The chart opens fitted, and changing level refits it.
  - **Drawing.** Mermaid-Replay-like cards with cubic Bézier edges. Arrowheads follow the curve's local direction at the tip, and the line is trimmed to the arrow's base. Line width follows frequency. Switching level tweens nodes and edges, with new marks fading in and old ones fading out. Reduced motion skips the tween. Narrow widths stack the arc chart vertically.
  - **Interaction** (per interaction-completeness). Hover or keyboard focus highlights a node and its moves, or a single edge through a 16 px invisible hit path, by colour only. A readout line under the chart states the numbers. Click or tap pins the highlight, a second tap or Escape clears it, and touch never depends on hover. Enter or double-click on a step opens that part of the paper, while a single tap only highlights. Highlights are re-applied after every repaint.
  - **Mermaid.** Each chart has a copy icon (the code is never shown). The flowchart exports as `flowchart TD`, with dashed arrows for branches and returns.
- **Tables.** Quiet and theme-aware: a small uppercase header, hairline rows and no vertical rules. Highlighting is colour only: a soft tint on hover, the accent on the selected row. Tables wrap to the column on desktop. Phones scroll them sideways with a sticky first column. Trace's per-row inspect control is a quiet chevron that appears on hover or focus, and always faintly on touch screens.
- **Images and media.** Any figure image opens a full-screen viewer (`scripts/media.js`). It shows the caption at the bottom, a counter, a close button in the corner, arrows and ← → between figures, swipe on touch (down to close), Escape, a focus trap, and focus returned to the opener. Figures are `figure` blocks with an `Assets` field (PNG, JPG, SVG or PDF under `assets/manuscript/`) or a `Video asset`. Caption paragraphs are child blocks tagged `caption`.
- **Tag icons** (`scripts/tag-icons.js`). Every tag shows a small line icon, all drawn for this skill on one 24 px grid with a 1.8 stroke and round joins, so they read as one set.
  - **Coverage.** Common article parts (figure, table, caption, heading, section, paragraph, sentence, quote, citation, source), the Content structure groups and moves, and common role and support words each have their own icon. Everything else gets a quiet tag mark.
  - **Matching.** Icons are matched on tag id or name by ordered rules, so new documents using these words get them automatically.
  - **Where.** They appear in the margin and sidebar tag trees, the Tag tree board and the tag words of an opened sentence.
  - **Names.** Displayed tag names drop a leading "#" and start with a capital.
- **Content structure tags** (`examples/document-structure/CODING.md`). This is a two-level family (root id `move`) for what each sentence and paragraph is doing, adapted from Swales (1990), Toulmin (1958) and IRAC.
  - **Groups:** Framing, Sourcing, Argument, Positioning and Closing.
  - **Moves:** sixteen moves sit under the groups, such as orientation, report, claim, evidence, qualification and conclusion.
  - **Tagging:** sentences carry one move each, and paragraphs and sections carry one group, which Flow uses directly at those levels. On the demo paper, Flow then infers Framing → Argument → Sourcing → Positioning, with Closing as a branch.
- **Rails give way to the paper.** The page measures the paper's real width and keeps it at about 640 px or more. It hides the right inspection rail first, then the left tag rail, re-checking on resize and whenever the sidebar opens or collapses. Views (Settings, Contents, Tag tree, Flow) always get the full width.
- **Following header and feathered edges.** Once the page title scrolls away, a compact header slides in at the top. On the paper it shows the document and the current section (scroll-spied); in views it shows Back and the view's name. It fades into the page so content passes softly under it, with a matching fade along the bottom of the window. Under reduced motion it appears without sliding.
- **Sidebar list.** The section list scrolls inside the sidebar between soft top and bottom fades (a mask gradient). Its scrollbar is hidden and appears thin only on hover.
- **Flowchart layout.** On wide canvases the main line runs left to right, with returns alternating above and below in their own lanes and branches hanging below. Narrow canvases stack it vertically. Labels sit at the middle of their own curve, cards carry their tag's icon, and labels use regular weight.
- **Moving single cards.** Any card in a Flow chart can be dragged on its own after a 4 px move; a tap still pins its highlight. On touch, card drags never scroll the page. With a card focused, Shift + arrow keys nudge it.
  - **Rerouting.** The card's arrows reroute live from the nearer sides (left/right when side by side, top/bottom when stacked), with arrowheads, labels and hit areas following. Opposite moves between the same two cards are offset 5 px apart.
  - **Persistence.** Moved positions survive repaints and resizes. A "Restore layout" icon appears once anything has moved, and changing level starts fresh.
- **Collision handling.** After every layout and during drags, edge labels push apart from each other and off the cards. Each stays within 22 px of its curve, so a label never floats away from its arrow. Side cards settle so they never overlap each other or the main line. Both passes are deterministic.

## Reading interactions added later (search commands, parting paragraphs, performance)

- **Search commands.** In search, `/` runs commands: go to Contents, Tag tree, Settings pages or back to the paper; copy a link to the current section (`#/at/<block id>` deep links scroll to a section or open a sentence); clear tag focus; collapse or open the sidebar; switch theme, palette, citation style or text size; turn reading toggles on and off. A side panel (hidden on phones) lists the three prefixes (`#` tags, `@` sources, `/` commands) and the common commands. The field and the results are two separate cards with a gap; the field grows to more lines when needed. The page behind is washed out toward the theme's paper colour and blurred. The chosen result is shown by text colour only, never a filled row. `settings.js` exposes `window.TraceSettings = { THEMES, PALETTES, prefs, apply, set, setPalette, paletteOf }` for this.
- **Opening a sentence parts its paragraph** (`scripts/trace-part.js`). The text after the opened sentence moves into its own paragraph below the evidence, so the trace sits right under its line. The gap opens and each line of the trace draws in from the left, in reading order. Closing runs it backwards: the trace folds up before Trace redraws the paragraph whole. Clicking outside the open sentence and its trace, or Escape, closes it. Settings → Reading → "Animate opening a sentence" (on by default) turns the motion off; reduced motion does too.
- **Citation style switches live.** No reload: `citations.js` restores the APA fields from the data embedded in the page (never from Trace's saved copy, which may hold another style's labels) and calls Trace's `render` (the builder exposes it as `window.__traceRender`).
- **Performance.** Off-screen paragraphs, headings and references use `content-visibility: auto`, so a long paper with hundreds of MathJax equations only lays out what is near the viewport. The markdown pass skips MathJax, SVG and code subtrees in one step, remembers texts that needed nothing, and runs once per redraw rather than once per added node. On the 179-sentence example, opening a sentence went from about 220 ms to about 100 ms of work, and the animations run at full frame rate.
- **Small things.** A source without a checked quote shows nothing (no "No quote checked" line). "Open" on a reference is an icon. Sidebar contents use the paper's own section numbers when it has them. "In this outline" stays pinned while its list scrolls.

## Long documents, reading position, contents and front matter

**Document fields (all optional, added to the trace data schema).**

| Field | Meaning |
| --- | --- |
| `id` | Stable document id. Keys everything kept locally for this document (reading position, measured heights). Without it the title is used, so set it for anything that may be renamed. |
| `authors` | `[{ "name", "affiliations": ["aff-id"], "email", "orcid", "corresponding": true, "note" }]`, or plain name strings. |
| `affiliations` | `[{ "id", "name", "country" }]`. Numbered by first appearance; numbers show only when there is more than one. |
| `date`, `revision`, `doi`, `license`, `keywords` | One quiet line under the authors. |

Front matter (`scripts/front-matter.js`) sits under the title; any part with no data is simply absent. ORCID and the corresponding author's email are small icons.

**Reading position (local, never in the document).** Remembered by block, not by scroll offset: the sentence at the reading line, its section and the offset into it, in `localStorage` as
`trace-position:<id> = { "v": 1, "block", "section", "offset", "at" }`. The next visit opens there (after the loading skeleton and fonts settle), unless the address names a place (`#/at/<block id>`). Nothing is saved until the restore has finished, and any reader input stops the settling.

**Loading in parts** (`scripts/trace-window.js`; Settings → Reading → "Load long documents in parts": Auto, Always, Never). Trace redraws the whole paper on every open and close, which is too slow for a textbook. The reading tree is cut into chunks of about equal weight (sentences, characters, equations; breaking at section starts where possible). Only the chunks around the reader are drawn; the rest are shimmering placeholders of the right height that keep their `reading-<id>` anchors. Scrolling near a placeholder draws it and distant text turns back into placeholders (at most nine chunks at once). Heights are measured once seen and remembered locally. In this mode the page holds its own scroll anchor (the first visible sentence), through redraws and while maths typesets. Auto switches on above a total weight of 700 (about 450 sentences). Anything that jumps somewhere (contents, search, `/` commands, cross-references, the Flow view, deep links, the tag dock) goes through `TraceWindow.ensure(id)` / `TraceWindow.go(id)`, so the target is drawn first. The tag dock counts and steps through matches from the data, so "12 / 288" is true for the whole document. The builder patches two hooks into Trace's `renderAPA` and fails loudly if Trace changes underneath them. Measured on a 2,148-sentence, 7,900-equation test book: drawn whole it took 3.0 s and 250,000 nodes to load; in parts 0.48 s and 6,200 nodes. Trace's own redraw is 65 ms, the Tag tree 73 ms, Flow 101 ms, and search 17 ms per keystroke. Browser find-in-page (Ctrl F) sees only drawn parts; use the page's search.

**Contents** (`scripts/trace-toc.js`) replaces Trace's flat list with a tree for any shape of document: top-level parts always listed, the part being read opened to its subsections (up to four levels), chevrons to open others, a single wrapper section skipped. The paper's own numbers ("1.1", "Chapter 3", "Appendix A") fill the number column; otherwise top-level parts are counted. The current part takes the accent and its parents full ink, and the list keeps it in view. The reading header shows the same current part.

**Search can focus a tag.** `/ focus method` finds "Focus: Method"; tag results without a prefix and `#` searches pin tags too.

**Trace labels.** An opened trace labels its parts (Tags, In the mathematics, Sources, Comments) in small faint capitals above each part, at every width.

**Font override** (Settings → Reading → Font, and `/ font …` in search). Every theme brings its own fonts; the reader can lay one face over all of them (text, headings and interface): Gentium Book Plus, Libertinus Serif, Vollkorn, Literata, Libre Baskerville, EB Garamond, Atkinson Hyperlegible, Poppins or the system face. "Theme font" keeps each theme as designed. The setting is one button showing the current face; it opens a picker over a blurred page (full screen on phones): a card per font with a large Aa, the document's title as a sample in that face, and one line on what it is for. Arrow keys move, Enter picks, Escape closes and focus returns to the button. Selection is the accent colour and a check, never a fill; the chosen one loads from Google Fonts on demand and is applied in `<head>` before the page draws (`html[data-font]`, `--font-user`). Maths and code keep their own faces.

**Settings pages.** Settings is split by purpose: Appearance (themes and palettes), Text (font, text size, line spacing, paper card), Reading (outline and tag tree in the margin, the opening animation, equation highlights), Citations (style and colour), Advanced (loading in parts, Flow view) and About. Routes are `#/settings/<page>`; the old `#/settings/reading` still works. On phones the page menu is a scrolling row above the page.

**Phone checks (375 × 812).** The reading view, an opened trace, search (a full-screen sheet with Cancel), the sidebar and the font picker have no sideways scroll. A round search button sits beside the menu button (a fixed button of its own: Trace's top bar hides extra children). Contents rows and chevrons are at least 44 px tall.

**Tag tree heading.** The margin rail opens with a small "Tag tree" heading, aligned with the chevrons below it. Hovering, focusing or tapping it unfolds a short note in small grey text right underneath (no floating card, no shadow, no icon): an index of ideas, like a book's index but for what each sentence does; hover to light up, click to keep lit; a tag includes everything under it; parameters are measures to filter by. The note folds away by itself half a second after the pointer leaves (or nine seconds after a tap).
