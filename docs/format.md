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
