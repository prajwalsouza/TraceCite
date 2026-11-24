# TraceCite packages (`.trace.zip`)

A package holds one TraceCite document and everything it needs, in one file.
It is a plain zip, so any zip tool can open it. Reading pages carry their
package, `trace-reader.html` opens any package, and Export hands one back.

## Contents

```text
outliners.trace.zip
├─ manifest.json              what is in the package, and its version history
├─ outliners.trace.json       the trace data, exactly as written
├─ refs.bib                   BibTrace sources (optional)
├─ assets/manuscript/…        figure images (optional)
└─ my-interactive.js          interactive components (optional)
```

Paths keep their places relative to the data file, as on disk, so the data is
never rewritten. A path may not leave that folder (`..`) or be absolute.

## manifest.json

```json
{
  "format": "tracecite/1.0",
  "package": 1,
  "version": 2,
  "title": "Outlines you can read",
  "data": "outliners.trace.json",
  "bibliography": ["refs.bib"],
  "assets": ["assets/manuscript/figures/timeline.svg"],
  "interactiveScripts": ["my-interactive.js"],
  "files": [{ "path": "outliners.trace.json", "bytes": 61234 }],
  "history": [
    { "version": 1, "date": "2026-11-24T18:30:01.320Z", "note": "First package",
      "hash": "sha256:2cb0…", "previous": null },
    { "version": 2, "date": "2026-11-25T09:00:00.000Z", "by": "Ada Example", "note": "Sharper subtitle",
      "hash": "sha256:c28e…", "previous": "sha256:2cb0…" }
  ],
  "generator": "TraceCite build-reading"
}
```

| Field | Meaning |
| --- | --- |
| `format` | Required. The TraceCite format version, `tracecite/1.x`. A reader rejects another major version. |
| `package` | Required. The package layout version, `1`. |
| `version` | The document's own version: the latest entry in `history`. It is separate from `format`. |
| `title` | The document's title, for file names and listings. |
| `data` | Required. The path of the trace data file. |
| `bibliography` | BibTrace files to load, in order. Entries replace inline sources with the same id. |
| `assets` | Figure images named in `Assets` and `Video poster` fields, under `assets/manuscript/`. |
| `interactiveScripts` | Interactive components named in the data's `interactiveScripts` (or the older `vizScripts`). |
| `files` | Every file except the manifest, with its size in bytes. |
| `history` | The document's versions, oldest first. See below. |
| `label` | Optional eyebrow label above the title, if the data has no `eyebrow`. |
| `generator` | What wrote the package. |

## Version history

Each entry in `history` records one version of the document's content:

| Field | Meaning |
| --- | --- |
| `version` | 1, 2, 3, … |
| `date` | When this version was made (ISO 8601). |
| `by` | Who made it (optional). |
| `note` | What changed (optional). |
| `hash` | `sha256:` of the data file and its `.bib` files, in path order. |
| `previous` | The previous entry's hash, or `null` for the first. |

A new entry is added only when the hash changes. Comparing the hashes of two
exports tells you whether their content differs. The builder carries the
history over from the last package it wrote for the document: the `--zip`
file, the page being rebuilt, or `--history old.trace.zip`. Use `--by` and
`--note` to sign and describe the new entry. Rebuilding unchanged data gives
the same bytes. A reading page never edits its document, so Export hands back
the package as it was opened. A document opened from loose files gets its
first entry when it is packed.

The reader shows the history under Settings → Document.

## Opening a document

Any reading page opens a document dropped anywhere on it, or chosen under
Settings → Document → Import. The standalone reader also has **Choose a file**
and `?src=URL`. It accepts:

- a `.trace.zip` package, or any `.zip` holding one TraceCite document;
- a `.trace.json` (any `.json` with `blocks`) on its own;
- a `.json` dropped together with its `.bib`, scripts and images. Files are
  matched by name to the paths the data names, then packed.

If a document needs files that are missing, it still opens, and the page says
what is missing: for example, an interactive's script.

The page shows each stage as it happens:

1. reading the file;
2. unzipping;
3. checking the manifest and version history;
4. preparing sources, maths, structure, cross-references, figures and
   interactives;
5. drawing.

If a document is already open, the new one replaces it, with a way back.
`scripts/zip.js` reads and writes zips with no dependencies, using
`CompressionStream` and `DecompressionStream`. `scripts/package.js` opens,
prepares and exports packages. Both run in browsers and in Node 20 or newer.

## One file that reads everything

`trace-reader.html` is a single, self-contained file. Everything happens in the
browser: BibTrace, maths tags, cross-references, environments, provenance,
citation styles and interactives. Readers need no Node, no builder and no
install. Download it from the
[latest release](https://github.com/prajwalsouza/TraceCite/releases/latest/download/trace-reader.html),
open it, and drop a package on it. Every release attaches it automatically,
with a sample package.

## Building (for authors)

```sh
# a reading page that carries its package (works opened from disk)
node scripts/build-reading.mjs --data doc.trace.json --out doc.html
# also write the package, signing the new version
node scripts/build-reading.mjs --data doc.trace.json --out doc.html --zip doc.trace.zip --by "Ada Example" --note "What changed"
# a page that fetches its package when served
node scripts/build-reading.mjs --data doc.trace.json --out doc.html --data-url doc.trace.zip
# the standalone reader
node scripts/build-reading.mjs --reader --out trace-reader.html
```

The builder validates the data before packing it.

## Network use

Packages and the reader work offline. Google Fonts and MathJax load from their
CDNs when online. Offline, the system fonts are used, and TeX stays readable
as plain text. To render maths offline, bundle MathJax (`tex-svg.js`, about
2 MB) and point `MATHJAX` in `scripts/build-reading.mjs` at your copy.
