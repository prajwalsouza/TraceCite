# A sample that uses every part

`docs/sample/` holds one small TraceCite document that uses every part of the
format. Use it as a template, and as a reference for what each piece looks
like. It validates with no warnings:

```sh
node scripts/validate-trace.mjs docs/sample/sample.trace.json
```

Read it as a page:
[references/sample-reading.html](https://prajwalsouza.github.io/TraceCite/references/sample-reading.html).
Or download its package,
[samples/sample.trace.zip](../samples/sample.trace.zip), and drop it on
`trace-reader.html`.

## The files

```text
docs/sample/
├─ sample.trace.json       the document: one tree of blocks, its tags and front matter
├─ sample.bib              its sources in BibTrace: BibTeX plus trace-* evidence fields
└─ sample-interactive.js   one interactive component, registered with TraceViz.register
```

## The document: [sample.trace.json](sample/sample.trace.json)

| Part | Where in the sample | Shows |
| --- | --- | --- |
| Format and version | `format`, `version` | `"tracecite/1.0"`, and storage revision `2` |
| Front matter | `title`, `subtitle`, `eyebrow`, `authors`, `affiliations`, `date`, `revision`, `license`, `keywords` | The lines under the title |
| Sources | `bibliography: "sample.bib"`, `sources: []` | Sources live in BibTrace, and cite by entry key |
| Tag tree | `tagTree` | Role, support and topic families, and a `caption` tag |
| Connected highlights | `tagTree` → `connected` → `hl-n`, `hl-q` | `slot` colours, and `symbols` coloured in formulas |
| Parameters | `parameters` → `length-words` | A per-sentence measure, drawn as a strip |
| Sections | `sec-structure`, `sec-share` | `"Heading level": "2"`, and a span tag inside a heading |
| Sentences | `s-1` … `s-6` | Role and support tags, and a `Sentence review` field |
| Citation and exact reference | `s-1-c`, `s-1-c-r` | `Source ID`, and the quote it rests on |
| A comment and a reply | `s-2-n`, `s-2-n-r` | Note blocks with `Comment by` (a person, then an agent) |
| Interpretation | `s-3` | Labelled `role-interpretation`, with no source needed |
| Links | `s-3` | An external link (new tab) and an internal `#/at/sec-share` link |
| An environment | `p-def` | `env-definition`, with `Label` and `Name` fields |
| Maths | `s-4`, `s-5` | `\( p = q / n \)`, with `n` and `q` coloured |
| Span tags | `s-4`, `s-6`, `sec-share` | `[sentences]{.hl-n}`, `[checked quote]{.hl-q}` |
| An interactive figure | `fig-share` | `Interactive`, `Interactive settings`, and a caption paragraph |

## The sources: [sample.bib](sample/sample.bib)

Two BibTrace records, with passages checked verbatim:

- `raggett1999html`, the HTML 4.01 specification:
  - two quotes (`trace-quote`, `trace-quote-2`) that share one passage;
  - each quote's `-location`, `-context`, `-tags` and `-note-1`;
  - who added and checked them (`trace-quote-added-by`, `-checked-by`,
    `-checked-on`);
  - record-level `trace-added-by`, `-via` and `-on`, `trace-status`,
    `trace-checked` and `trace-url-read`.
- `tei2026guidelines`, the TEI P5 Guidelines: one quote with its passage, and
  a note signed by a person (`trace-quote-note-1-by`).

See [bibtrace.md](bibtrace.md) for every field.

## The package: sample.trace.zip

Building the sample, or exporting it from the reader, gives one zip:

```text
sample.trace.zip
├─ manifest.json            what is inside, and the version history
├─ sample.trace.json        the document, exactly as written
├─ sample.bib               its BibTrace sources
├─ sample-interactive.js    its interactive component
└─ assets/manuscript/…      figure images, when a figure names them in "Assets"
```

Its `manifest.json`:

```json
{
  "format": "tracecite/1.0",
  "package": 1,
  "version": 1,
  "title": "A small document that uses every part",
  "data": "sample.trace.json",
  "bibliography": ["sample.bib"],
  "assets": [],
  "interactiveScripts": ["sample-interactive.js"],
  "files": [
    { "path": "sample.trace.json", "bytes": 12268 },
    { "path": "sample.bib", "bytes": 5551 },
    { "path": "sample-interactive.js", "bytes": 1234 }
  ],
  "history": [
    { "version": 1, "date": "2026-11-25T00:00:00.000Z", "note": "First package",
      "hash": "sha256:f18843b7…", "previous": null }
  ],
  "generator": "TraceCite build-reading"
}
```

When the content changes, the next build adds version 2 to the history, with
the previous hash. [package.md](package.md) describes every field.

## Make your own from it

1. Copy `docs/sample/` and rename the files.
2. Replace the blocks, tags and sources with your own. Keep every quote
   verbatim, with the passage it sits in.
3. Validate it, then either drop the `.json` and `.bib` (and scripts) on
   `trace-reader.html` and Export a `.trace.zip`, or build a page:

```sh
node scripts/build-reading.mjs --data my.trace.json --out my.html --zip my.trace.zip
```
