# TraceCite

TraceCite is a format for documents whose sentences open to the evidence behind them. Its builder turns a JSON data file into one self-contained, reading-only HTML page.

## The reading page

Read the document as normal prose. Click a sentence to open its evidence just below it. See the source's exact words, their location and the full passage around them. Notes, tags and provenance show what each part means and who added or checked it.

A sidebar holds search, contents, a tag tree and settings. Hover over a tag to highlight related sentences, or pin it to keep them in focus. Readers can change fonts, colours and citation styles. Long documents can load in parts. These reading choices stay in the browser; they do not edit the document.

## Quick start

Use Node 20 or newer. There are no dependencies to install.

```sh
node scripts/build-reading.mjs --data examples/outliners.trace.json --out out.html
```

Open `out.html` in a browser. The document data, reader, bundled fonts and supported figure images are embedded. Some themes and font choices use Google Fonts at runtime. Math uses MathJax from a CDN; offline, its TeX remains plain text.

To check data and rebuild the supplied pages:

```sh
npm run validate
npm run build:examples
```

These commands run local scripts. The package metadata is not an npm publication workflow.

## One evidence tree

A document is one tree of blocks. Sections contain paragraphs. Paragraphs contain sentences. A sentence can lead to a citation, an exact quote, its full context passage, and further notes, tags and provenance.

```text
sentence
└─ citation → shared source record
   └─ exact quote
      ├─ location and context passage
      ├─ notes and comments
      ├─ tags
      └─ who added or checked it
```

Quotes and passages must preserve the source's words. If a passage cannot be reproduced, record why it was withheld. A source that was not read stays reference only. A trace shows where a claim came from; it does not prove the claim is true.

## Examples

- [Outlines you can read](references/outliners-reading.html): a short introduction to outliners. Shows a claim opening into local-source excerpts, context, notes and tags. Its [generator](examples/outliners-article.mjs), [data](examples/outliners.trace.json) and [context records](examples/outliners.contexts.json) sit together.
- [From roll to block](references/document-structure-reading.html): a history of document structure. Shows sections, lists, tables, figures, comments, source checks and withheld passages. Its [folder](examples/document-structure/) includes a generator, data, context records, figures, coding rules and verification limits.

Download a built HTML file and open it locally; GitHub's file view shows its source. Regenerate the data with `node examples/outliners-article.mjs` and `node examples/document-structure/document-structure.mjs`, then build the pages. [long-test-book.mjs](examples/long-test-book.mjs) makes a temporary stress-test document from existing data.

## Format at a glance

```json
{
  "format": "tracecite/1.0",
  "version": 2,
  "id": "my-document",
  "title": "A document with evidence",
  "tagTree": [],
  "blocks": [],
  "sources": []
}
```

`format` names the public format. `version` is the reader's storage revision; it stays `2`. Each block has an id, a type, text, tag ids, string key/value fields and children. Citations link to shared sources through a `Source ID` field.

Read the [TraceCite 1.0 specification](docs/format.md) and [JSON Schema](schema/tracecite-1.0.schema.json). The command-line validator checks links, tags and quote/context rules as well as core data structure:

```sh
node scripts/validate-trace.mjs examples/outliners.trace.json
```

## BibTrace at a glance

BibTrace is standard BibTeX plus `trace-*` evidence fields. Ordinary bibliography tools can ignore those extra fields. They hold exact quotes, context passages, notes, tags and provenance.

Set `"bibliography": "refs.bib"` in the data, relative to that file, or pass `--bib refs.bib` to the builder. A citation's `Source ID` is the BibTeX entry key. Bibliography entries replace inline sources with the same id.

See the [field guide](docs/bibtrace.md) and [complete sample bibliography](examples/bibtrace-example.bib).

## Use as an agent skill

The repository is also an agent skill. Point a skill-capable agent at the root [SKILL.md](SKILL.md), keeping this folder layout intact. It explains how to write the tree, record honest provenance, validate it and build the reading page. Agents should copy quotes from the source and check their context, then use the supplied builder.

## Licence and credits

MIT. Copyright (c) 2026 Prajwal DSouza. The [licence](LICENSE) covers this repository, including the vendored Trace reading code in `trace/`. Third-party parts keep their own licences, listed in [NOTICE.md](NOTICE.md).

TraceCite comes from Trace, Prajwal DSouza's evidence outliner. It uses Font Awesome Free icons, Raleway and Nunito fonts, runtime Google Fonts and MathJax. The examples cite their sources and retain their verification limits.
