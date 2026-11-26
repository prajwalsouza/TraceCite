# Changelog

## Unreleased (0.4.0)

- **Seven new themes.** Field Guide and Field Guide Night (white paper, Jost, stone-olive titles, wide-spaced capitals), Rubric (EB Garamond in two inks; palettes Vermilion, Illuminated, Lapis, Vellum, Candlelight), Terminal, Blueprint, Lab Notebook and Case File, each with its own palettes. Sage gains a White palette (a pure white page with Sage's green as the one accent). Neumorphism gains a Dark palette, and its preview no longer glows on dark themes. Themes restyle a document but never add words to it.
- **Home from the sidebar.** The sidebar's title goes back to the start of the paper from any view; with the sidebar collapsed, a T icon under the arrow does the same.
- Settings: a choice with many options (Citation style) gets its own line, so its label no longer squeezes to one word per line.
- Layered paper textures (grids, ruled lines) now draw; light palettes of dark themes (Printout, Whiteprint) switch the page to light.
- **Edit mode.** "Edit mode" in the sidebar (or E) makes the reading page the editor, in place. Click a sentence to change its text (as stored, with its markup), Enter to add a sentence after it, Backspace in an empty sentence to take it out, Tab to move on. Undo and redo cover whole edits. Unsaved edits come back after a reload. "Save version" makes the edits on the stored document and saves the package as its next version: downloaded as a .trace.zip, or, in the BibTrace extension, back into the library with the earlier version kept (`scripts/edit-mode.js`).
- **Comments and replies.** An opened sentence ends with one quiet line, "Add a comment"; a comment offers "Reply" only while the pointer is on it. The field grows as you type, and Post (with a name field, if no name is set) appears only once there is text. ⌘Enter posts, Escape cancels. Comments are stored as the format already defines them (a note with "Comment by" and "Commented on", replies as its children), recorded as changes, marked with a small dot until saved, kept across a reload and saved with the next version. Outside edit mode the bar shows only the count, Undo and Save version.
- **Format 1.1.** Adds `changes`, the edit history: one record per edit (text, insert, remove) with who, when, the package version, and what is needed to undo it. Schema `schema/tracecite-1.1.schema.json`; the validator checks it, and a document with `changes` must declare `tracecite/1.1`. `TracePackage.withEdits` writes a new version; `applyChange` and `invert` make and undo an edit.
- **Format 1.0 is frozen.** Its schema file may not change; `npm run validate` checks this (`scripts/check-format-lock.mjs`) and runs an edits round trip (`scripts/check-edits.mjs`).
- An opened sentence is quiet: only its source, the exact words and the reference show. Where the words sit, who added and checked them, tags, the passage, notes and comments appear when the pointer rests on that source (or on focus, or a tap on touch screens). The sentence's own review appears when the pointer rests on the sentence; the tabs always show. Details are hidden with CSS and shown with one class change, with no observers (`scripts/quiet-evidence.js`, `scripts/quiet-evidence.css`).
- A source you click in (to open its passage, a note or a link) stays open when the pointer leaves; a second click on its text lets it close. Kept sources are remembered per document in the browser, never in the trace data. Sources opened by hover alone close after a short grace period, with a fade.
- The reference line shows one "open the source" icon, the same size as the text and centred on it.
- An opened sentence shows tabs: Sources first, then Tags and Mathematics, each with a count. Empty tabs are left out. Notes, comments and the sentence's review sit under Sources, and "Sentence added by …" stays below whichever tab is open.

## 0.3.0 — 2026-11-25

- **Edits.** A model streams suggested edits into the open page through `window.TraceLive`, word by word. Readers ask by selecting words and pressing Enter. They review each suggestion in the new Edits view, or from the bar at the bottom (Accept, Reject, Comment). A decision log, which models read first, records every outcome. Only sentences can be edited, and every edit is a suggestion. Accepted edits come back after a reload. The page makes no network requests unless a relay is set with `?edits-server=`. See `docs/edits.md`.
- **The ruler.** Faint ticks at the right edge mark edits, darker while one is being written, and the sentences of the focused tag in that tag's colour. Click or drag the ruler to scroll.
- **The tour film**, rebuilt: under two minutes, opening on a model writing a sentence. Click for the next beat, use ↑ and ↓, or scroll to scrub.
- The demo site opens on a TraceCite document about TraceCite (`examples/tracecite/`), also at `/demo`. It quotes TraceCite's own docs as published at v0.2.0, with each passage cut from the file, and four earlier works. Its interactive counts the page's own checked sentences, and it links to every download. It replaces the separate landing page.
- The README opens with the GIF of a sentence opening into its evidence.
- The release workflow fetches tags, which the showcase needs.

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
