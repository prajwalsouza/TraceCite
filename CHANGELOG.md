# Changelog

## 0.2.0 — 2026-11-25

Read, share and open TraceCite documents without building anything.

- **TraceCite packages (`.trace.zip`).** One plain zip per document: a manifest, the trace data, its BibTrace files, figures and interactive scripts. See `docs/package.md`.
- **Version history.** The manifest records each version of the document with its date, author, note, a SHA-256 content hash and the previous hash. Rebuilding unchanged content keeps the history and the bytes unchanged.
- **One file that reads everything.** `trace-reader.html` opens any package and prepares it in the browser: BibTrace, maths tags, cross-references, environments, provenance, citation styles and interactives. No Node, no install. Every release attaches it, with sample packages.
- **Import anywhere.** Drop a `.trace.zip`, a `.trace.json`, or a `.json` with its `.bib`, scripts and images on any reading page. A full-page overlay catches the file and shows each stage as it happens. Then the new document replaces the old one, with a way back. Broken files get a clear message.
- **Export** in the sidebar, just above Settings. **Settings → Document** holds Import, Export, the document's version and its history.
- **Interactives.** A figure with an `Interactive` field is drawn by a component from the document's `interactiveScripts`. The older names `Viz`, `Viz settings` and `vizScripts` still work.
- Reading pages carry their package and use the same code as the reader. Builds are reproducible.
- Builder options `--zip`, `--data-url`, `--reader`, `--by`, `--note` and `--history`.
- Dependency-free zip reader and writer (`scripts/zip.js`).
- In an opened sentence, maths variables show without the variable icon, so they no longer read as multiplied symbols.
- **Span tags and connected highlights.** Mark part of a text with a tag, `[words]{.tag-id}`. Tags in a `connected` family can take a `slot` (one of five theme-aware colours) and `symbols` (TeX symbols coloured in every formula), so a reader can follow a thread across words, maths and figures. Tag focus lights exactly the spans.
- **Links.** `[text](https://…)` opens in a new tab, `[text](#/at/block-id)` jumps within the document, and bare `https://` addresses link too. Other schemes stay plain text. A generated Links tag family tags every line that links out.
- Interactives can use a highlight's colour: `api.tagColor(id)` and `api.tagClass(id, kind)`.
- **Samples.** `docs/sample/` holds one document that uses every part (`.trace.json`, `.bib`, an interactive), and `docs/sample.md` explains each part and the `.trace.zip` layout.
- **For agents.** `llms.txt`, `llms-full.txt` and `docs/writing-with-agents.md`.
- The import note shows the opened title and the way back as separate, quieter parts.
- The scroll-in header is centred over the paper, with the current section above a smaller document title.
- The builder runs the page's own preparation as a check, so a broken document fails the build rather than the page.
- Demo site: `index.html`, served by GitHub Pages.
- A release workflow builds and attaches `trace-reader.html` and the sample packages on every version tag.

## 0.1.0 — 2026-11-24

First public release.

- TraceCite 1.0 format (`tracecite/1.0`), JSON Schema and validator.
- Single-file, reading-only HTML builder. Node 20 or newer; no dependencies.
- Vendored Trace reader with in-place evidence, search, tag focus and settings.
- BibTrace parsing, writing and source conversion.
- Two example documents, their generators, evidence records and built pages.
- Agent skill, format guide, BibTrace guide and MIT licence.
