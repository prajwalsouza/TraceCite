# TraceCite 1.0 specification

A TraceCite document is one tree. Open a sentence to see the evidence under it.
The public format identifier is `tracecite/1.0`. The schema is
[schema/tracecite-1.0.schema.json](../schema/tracecite-1.0.schema.json), using
JSON Schema draft 2020-12.

The key words MUST, SHOULD and MAY express requirements, recommendations and
options. A conforming document MUST satisfy the schema and the semantic rules
below. The dependency-free validator checks core structure and semantic rules;
it is not a general JSON Schema implementation.

## Top-level fields

| Field | Shape and meaning |
| --- | --- |
| `format` | Required. `"tracecite/1.0"` for this specification. |
| `version` | Required. The number `2`. This is the storage revision the Trace reader expects, separate from `format`. |
| `id` | Optional stable document id. Set it when a title may change. The reader uses the title if no id is given. |
| `title` | Required non-empty string, at most 2,000 characters. |
| `subtitle` | Optional string under the title. |
| `authors` | Optional array of name strings or objects: `{ "name": "Ada Example", "affiliations": ["a1"], "email": "ada@example.org", "orcid": "0000-0000-0000-0000", "corresponding": true, "note": "Author note" }`. Only `name` is required in an object. |
| `affiliations` | Optional array of `{ "id": "a1", "name": "Example Institute", "country": "Country" }`. `id` and `name` are required. Authors link to ids. |
| `date` | Optional display string, normally `YYYY-MM-DD`. |
| `revision` | Optional display string, such as `Draft 2`. This is a document revision, separate from the format and storage versions. |
| `doi` | Optional document DOI string. |
| `license` | Optional document licence string. It describes the document, not the software. |
| `keywords` | Optional array of strings. |
| `tagTree` | Required array of tag definitions. It is the document's tag schema. |
| `parameters` | Optional tree of numeric or category measures. See below. |
| `blocks` | Required array of blocks, in reading order. |
| `sources` | Required array of shared source records. It may be empty when a bibliography supplies them. |
| `bibliography` | Optional BibTrace path, or array of paths, relative to the data file. Entries are loaded before validation. A matching entry id replaces an inline source. |
| `links` | Optional. `{ "off": true }` leaves out the generated Links tag family (see Links below). |
| `interactiveScripts` | Optional array of script paths, relative to the data file, that register interactive components (see Interactives below). `vizScripts` is the older name and is still accepted. |
| `mathTags` | Optional object controlling generated math tags: `groups` maps group names to symbol arrays; `labels` maps symbols to descriptions; `minSentences` defaults to `2`; `exclude` is a symbol array; `off: true` disables generation. |
| `documentStructure` | Optional structure-import metadata: `version`, `sourceHash`, `documentClass` strings and an `environments` string array. Rendering roles are defined by block tags and fields, not this metadata alone. |

Other supported top-level fields are `eyebrow` (a short label above the title),
`updatedAt` (an ISO date-time string), `note` (a string), `flow` and `crossRefs`.
`flow` accepts `families` (root tag ids to analyse) and `minTransitions` (a positive
integer, default `3`). `crossRefs: { "off": true }` disables generated
cross-reference tags and links. Unknown extension properties are allowed by the
schema, but a reader need not preserve or display them. The HTML builder keeps
only the fields needed by its reader and resolves bibliography data into sources.

## Blocks

Every block MUST contain these fields:

```json
{
  "id": "sentence-1",
  "type": "sentence",
  "text": "The claim as written.",
  "tags": ["role-claim"],
  "fields": [{ "key": "Added by", "value": "AI agent (example author)" }],
  "collapsed": true,
  "children": []
}
```

`collapsed` is optional. Every other property shown is required. `id` matches
`^[A-Za-z0-9_.:-]{1,160}$` and MUST be unique among blocks. `text` is a string.
`tags` contains tag ids. Each `fields` item has exactly two string properties,
`key` and `value`. Field names are case-sensitive. Authors SHOULD use a field key
only once in a record. Unknown field keys can hold extra metadata.
`children` is another array of blocks. It can continue to any depth.

| Type | Use and recognised fields |
| --- | --- |
| `section` | Heading and nested sections. `Heading level` is a string number, normally `2` through `6`. |
| `paragraph` | Groups sentences. It may also carry a structural or environment tag. An environment reads `Label` and optional `Name`. |
| `sentence` | One unit of prose. Optional `Sentence review` and `Status` explain its evidence or limits. |
| `citation` | Links to a shared source using `Source ID`. Its children can include a reference. |
| `reference` | Detailed source link using `Source ID`. `Exact supporting extract` selects the wording used here; `Relation to this sentence` explains how it supports this claim. The shared source holds quote contexts. |
| `note` | A note under any block, with further notes as children. A `Comment by` field, even with an empty value, makes it a comment; `Commented on` gives its date. Replies are child comments. |
| `figure` | Label in `text`. `Assets` is a JSON array encoded as a string, such as `["figures/tree.svg"]`. `Video asset`, `Video poster` and `Figure layout` are optional. Add a caption paragraph as a child. Supported images are embedded by the builder; videos are left out of the reading page. |
| `table` | Contains `table-row` children. Captions and table notes can also be children. `Table storage: cell-blocks-v1` marks cell-block storage. Legacy `Rows` data is supported by the vendored reader; new documents SHOULD use cell blocks. |
| `table-row` | MUST be a child of `table`. `Table header: yes` marks the header. For cell-block rendering, put exactly one header row first. |
| `table-cell` | MUST be a child of `table-row`. The cell's content is its `text`; evidence can be attached below it. |

Any block can carry `Added by`, `Added via` and `Added on` fields. These describe
who added it, how, and when. Mark agents and scripts honestly. A recorded check
is a provenance claim, not a guarantee that the evidence is correct.

Figure asset paths use `images/` or `figures/` below `assets/manuscript/`, next to
the data file. The validator permits PNG, JPEG, SVG and PDF paths and forbids
`..`. The reading builder embeds PNG, JPEG and SVG images; a PDF is not an
embedded figure. `Video poster` names a poster image. The builder can also look
for assets in the vendored Trace folder.

## Tags are a schema

Each tag is `{ "id": "role", "name": "Sentence role", "children": [] }`.
Children have the same shape. An optional `collapsed` boolean controls the
initial disclosure. Ids match `^[a-zA-Z0-9_-]{1,128}$` and MUST be unique across
the entire tag tree. Names are non-empty strings of at most 120 characters.
A block's tags, source tags and `Quote tags` MUST name defined tags. Unknown tags
are errors. An ancestor tag includes the tags beneath it when reading in focus.

Root tags define families. Conventional families are `role`, `support`, `topic`
and `revision`. They receive the reader's blue, amber, green and plum colours.
An author can define other families.

Some tags have rendering meaning. Under a `document-structure` family, the
reader recognises `ordered-item`, `unordered-item`, `description-item`, `heading`,
`figure`, `table`, `caption`, `table-note`, `abstract`, `quote`, `code-block`,
`equation` and `accessible-description`. These tags MUST still be defined in
`tagTree`. List fields include `List group`, `List depth`, `List start`,
`List number` and `List label`. Their values are strings.

A paragraph tagged `env-lemma` is a lemma. The same rule covers `env-theorem`,
`env-proposition`, `env-corollary`, `env-definition`, `env-remark`, `env-example`,
`env-conjecture`, `env-claim`, `env-assumption` and `env-proof`. `Label` supplies
its number; `Name` supplies an optional name. Sentences below it carry the
statement or proof steps. The builder and CLI validator add the `env` family
and the used environment tags before validation. A caller of the exported
`validate()` function MUST call `ensureEnvironmentTags()` first for that shorthand.

The builder reserves `math` and `math-*` for generated mathematics tags, `xref`
and `xref-*` for cross-references, `provenance` and `prov-*` for provenance, and
`comments` and `comments-*` for comments. Authors SHOULD leave these names free.
The builder rejects an existing generated root when it needs to add that family.
Math and cross-reference generation can be switched off with the options above.
The generated families and indexes are added to the built page; they do not
rewrite the input JSON.

## Span tags and connected highlights

A span tag marks part of a text with a tag. It uses Pandoc's bracketed-span
syntax, so it exports cleanly:

```text
The input is a [list of n numbers]{.hl-x}.
```

Spans work in block text, headings, captions and notes. They never go inside
exact quotes or their passages, which stay verbatim. The tag id must be in
`tagTree`; an unknown id is an error, as for block tags. A block that contains
a span also carries the span's tag, so every block-level tag feature keeps
working, and tag focus lights up exactly the spans. In formulas, use MathJax's
own `\class{hl-x}{x}`.

**Connected highlights** are one use of span tags: threads that a reader can
follow by colour across words, symbols, headings and figures. By convention
they sit in a tag family `connected`. A tag has two optional properties:

| Property | Meaning |
| --- | --- |
| `slot` | 1 to 5: one of five theme-aware colours. Spans with the tag take it as a soft tint and text colour. |
| `symbols` | TeX symbols, such as `"q"` or `"\\mu"`, coloured automatically in every formula. Each one becomes `\class{<tag>}{…}` when the page is prepared. The data file is not changed. |

```json
{ "id": "connected", "name": "Connected highlights", "children": [
  { "id": "hl-q", "name": "q, the power", "slot": 1, "symbols": ["q"], "children": [] },
  { "id": "hl-x", "name": "x, the data", "slot": 2, "symbols": ["x"], "children": [] } ] }
```

Words are never coloured automatically: writers mark them with spans. These
are the author's judgement, unlike the automatic maths tags, which tag every
symbol mechanically. A highlight need not be maths: "paracetamol" in the text
and a tablet drawn in the same colour in an interactive are one thread.
Interactives get a tag's colour with `api.tagColor(id)` or
`api.tagClass(id, 'stroke' | 'fill' | 'text')`.

Readers choose how they look under Settings → Reading → Connected highlights: **Text colour** (the default), **Highlighted** (adds a soft tint) or **Off** (ink only). Tag focus tints the focused spans in every style.

Use them sparingly:

- At most five threads; usually two to four.
- Mark the first mention and the key later ones, especially where a different
  word refers to the same thing ("the data" for x).
- Colour is never the only signal: the words still say what they are.
- A thread keeps its slot in every theme.

## Links

```text
See [the W3C spec](https://www.w3.org/TR/html401/), or [the definition](#/at/p-def).
```

`[text](https://…)`, `http://` and `mailto:` links open in a new tab, and
bare `https://` addresses become links too. `[text](#/at/<block id>)` jumps
to that block within the document. Nothing else becomes a link: other schemes
(`javascript:`, `data:` and the rest) stay plain text, and the validator warns
about them. Links work wherever span tags do, and never inside exact quotes.
They are never underlined. External ones end in a small arrow and show their
address on hover. Clicking a link never opens the sentence around it.

Links are also tags. When the page is prepared, a generated **Links** family
tags every block that links out:

- **External link**, with one child per site (for example `w3.org`);
- **Internal link**;
- **Email**.

The tag tree can then light up every line that links somewhere. The data file
is not changed, and `"links": { "off": true }` leaves the family out.

## Parameters

A parameter has `id`, `name`, optional `measure`, `plot`, `unit` and `children`.
`measure` is `characters`, `words`, `citations`, `quotes`, or an object such as
`{ "field": "Confidence" }` for a number and
`{ "field": "Method", "type": "category" }` for text. `type: "number"` is also
accepted. Parent rows can group child parameters without their own measure.

`plot` is `histogram`, `strip`, `counts` or `categories`. Without a plot, text
uses categories, whole numbers spanning at most eight use counts, and other
numbers use a histogram. Without `parameters`, the reader supplies Length
(characters and words) and Evidence (citations and checked quotes). Filtering
changes the reading view, not the document's data.

## Sources and quotes

A source has `id`, `type: "source"`, `text` and `fields`. Optional properties are
`tags`, `collapsed` and `children`. Source ids follow the block id syntax and
MUST be unique among sources. A `Source ID` field MUST resolve to a source after
bibliographies have been loaded. The usual path is sentence → citation →
reference → shared source fields. Exact quotes and contexts are stored as
fields, not as extra block types.

| Source field | Meaning |
| --- | --- |
| `APA citation`, `First author`, `Year`, `APA reference` | Citation label and reference text. |
| `URL`, `DOI` | Source location and identifier. |
| `Bib key`, `Bib data` | Bibliography key and structured bibliography data encoded as a JSON string. Used to restyle citations. |
| `Record status` | How far this source has been checked. A source without a checked passage SHOULD say `Reference only` and carry no invented quote. |
| `Checked on`, `Page read`, `Note` | Record check date, page actually read and a general note. |
| `Added by`, `Added via`, `Added on` | Record provenance. Dates normally use `YYYY-MM-DD`. |
| `Exact quote`, `Exact quote 2`, … | Source wording, copied verbatim. Quote 1 has no numeric suffix. |
| `Quote location`, `Quote location 2`, … | Where that quote sits: section, paragraph, page or line. |
| `Quote context`, `Quote context 2`, … | The full passage containing that quote, copied verbatim. It MUST contain the quote as an exact substring. |
| `Quote context withheld`, `Quote context withheld 2`, … | A non-empty reason for omitting the passage, such as copyright. Use this when the context cannot be reproduced. |
| `Quote tags`, `Quote tags 2`, … | Semicolon-separated tag ids from `tagTree`. |
| `Quote note.1`, `Quote note.2`, `Quote note 2.1`, … | Notes on quote 1, then on quote 2. The final number is the note number. |
| `Quote note by.1`, `Quote note by 2.1`, … | Who wrote that note. |
| `Quote comment.1`, `Quote comment 2.1`, … | Comments on a quote. |
| `Quote comment by.1`, `Quote comment by 2.1`, … | Comment authors; empty means unsigned. |
| `Quote added by`, `Quote added via`, `Quote checked by`, `Quote checked on` | Quote provenance. Append ` 2`, ` 3`, … for later quotes. There is no per-quote added-date field in the current BibTrace converter. |

Copy quotes and contexts from the source. Do not repair wording, punctuation or
math. Notes interpret the evidence separately. A context SHOULD be the full
paragraph or other meaningful passage, not an unrelated surrounding slice.
Each non-empty quote MUST have its context or an explicit withholding reason.
When both fields are supplied, any supplied context MUST still contain the quote.
Check separately that a quote and its passage actually occur in the source.
The validator cannot check that external fact or decide whether a passage is
complete or its reproduction is permitted.

## Validation and building

```sh
node scripts/validate-trace.mjs examples/outliners.trace.json
node scripts/build-reading.mjs --data examples/outliners.trace.json --out out.html
```

The CLI loads bibliography entries and environment definitions before checking.
The builder does the same and stops on errors. Errors include missing core
fields, a storage revision other than `2`, duplicate block, source or tag ids,
unknown block types or tags, unresolved source links, invalid table nesting,
unsafe figure paths, invalid parameter choices, invalid Flow family ids, and
missing or mismatched quote contexts. The format check warns for a missing
`format` for compatibility with older Trace data. It rejects malformed format
identifiers and other major versions, including `tracecite/2.0`. The 1.0 schema
requires `format: "tracecite/1.0"`; the CLI accepts other `1.x` or `1.x.y`
identifiers but does not implement future features merely by accepting them.

Warnings cover quotes over 40 words, missing quote locations, missing asset
files, figures without media and unbalanced math delimiters. A warning is not a
licence decision or a completed source check. Schema validation and semantic
validation complement each other: JSON Schema checks field shapes; the script
checks relationships, exact context inclusion and local asset paths.

Block text and field values may contain inline markdown. Math accepts
`\( … \)` or `$ … $` inline and `\[ … \]` or `$$ … $$` for display. Store the
backslashes as normal JSON string escapes. The builder embeds the document and
reading code by default. `--data-url name.json` instead writes data beside the
page for fetching over HTTP. That option needs a server. Neither build changes
the source JSON. Runtime fonts and MathJax may need network access.

## Local reading state

Reading position is local browser state. It MUST NOT be stored in the document.
The key is `trace-position:<id>`, falling back to the title when `id` is absent:

```text
{ "v": 1, "block": "sentence-1", "section": "section-1", "offset": 0, "at": "2026-11-24T12:00:00.000Z" }
```

`block` and `section` identify the reading place; `offset` gives the position
within it in pixels; `at` is the save time as an ISO date-time string. The local record's `v` is its own revision.
An explicit `#/at/<block id>` address takes precedence over a saved position.
Themes, filters and measured chunk heights are also reader state, separate from
source evidence and authorship.

## Versioning

The format uses semantic versions: major.minor.patch. This specification is
1.0.0, identified in documents as `tracecite/1.0` (patch zero is implicit).
Additive changes are minor. Breaking changes require a new major version.
Clarifications and compatible fixes are patch changes. A document declares the
format version it was written for. The storage field `version: 2` and the
software release `0.1.0` are separate version sequences.

A released format version is frozen: its schema file never changes again, and
`npm run validate` fails if it does (`scripts/check-format-lock.mjs`). New
features go into the next version, with its own schema file.

| Format | Schema | Status | Adds |
| --- | --- | --- | --- |
| `tracecite/1.0` | `schema/tracecite-1.0.schema.json` | Frozen with release 0.3.0 | Everything above |
| `tracecite/1.1` | `schema/tracecite-1.1.schema.json` | In progress, frozen with release 0.4.0 | `changes`, the edit history |

A reader for 1.0 can open a 1.1 document: the edits are already made in its
blocks, and `changes` is an extra field it may ignore. A document with
`changes` MUST declare `tracecite/1.1` or later.

## Edit history (1.1)

Edit mode in the reader records every edit in `changes`, oldest first. The
blocks always hold the edited document; `changes` says how it got there, so it
can be read as a history, shown as a diff or undone.

```json
"changes": [
  { "id": "ch-1", "at": "2026-11-25T12:00:00.000Z", "by": "Ada Example", "version": 2,
    "op": "text", "block": "s-1", "before": "Markup languages…", "after": "Markup says…" },
  { "id": "ch-2", "at": "2026-11-25T12:01:00.000Z", "by": "Ada Example", "version": 2,
    "op": "insert", "block": "s-9", "parent": "p-structure", "previous": "s-1",
    "value": { "id": "s-9", "type": "sentence", "text": "A new sentence.", "tags": [], "fields": [], "children": [] } }
]
```

| Field | Meaning |
| --- | --- |
| `id` | Required. Unique among changes. |
| `at` | Required. When, as an ISO date-time. |
| `by` | Who: a person, or a model named as an agent. Empty when unsigned. |
| `op` | Required. `text` (a block's text changed), `insert` (a block was added) or `remove` (a block was taken out). |
| `block` | Required. The block's id. |
| `before`, `after` | `text`: the text before and after. |
| `parent`, `previous` | `insert` and `remove`: the parent block (or `null` at the top) and the sibling just before it (or `null` when first). |
| `value` | `insert` and `remove`: the whole block, so the edit can be undone. |
| `version` | The package version (manifest `history`) the edit was saved in. |
| `note` | Why, if the editor said. |

Saving in edit mode makes the edits on the stored `.trace.json`, appends them
to `changes`, declares `tracecite/1.1` and adds an entry to the package's
version history (see package.md). Edits not yet saved stay in the browser.

## Interactives

An interactive is a live figure. A `figure` block becomes one when it has an
`Interactive` field naming a component, and optionally an
`Interactive settings` field holding JSON. The older names `Viz` and
`Viz settings` are still accepted.

```json
{ "id": "fig-tug", "type": "figure", "text": "Figure 2. The tug of war",
  "tags": [], "collapsed": false, "children": [],
  "fields": [{ "key": "Interactive", "value": "tug-of-war" },
             { "key": "Interactive settings", "value": "{\"data\":[1,2,4]}" }] }
```

Components are scripts that call `TraceViz.register(name, draw)`; `api.tagColor(id)` and `api.tagClass(id, kind)` give a connected highlight's colour, so a figure's line for x matches x in the text. A document
lists its scripts in `interactiveScripts`, and they travel inside its
`.trace.zip` (see [package.md](package.md)). An interactive figure needs no
`Assets`. The hook is deliberately small: anything a script can draw, a
document can bring. Interactives use theme classes rather than fixed colours,
so they follow the reader's theme.

