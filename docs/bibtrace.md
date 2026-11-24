# BibTrace

BibTrace is BibTeX plus `trace-*` fields. A source record can travel with its
exact quotes, their context passages, notes, tags and provenance. Ordinary
bibliography tools can ignore the extra fields.

## Use a bibliography

Set `"bibliography": "refs.bib"` in a TraceCite data file. The path is relative
to that file. An array loads several files in order. The builder also accepts
`--bib refs.bib`, resolved relative to the data file. Citation and reference
blocks link through a `Source ID` field whose value is the BibTeX entry key.
Loaded entries replace inline sources with the same id; later files win.
The document still needs a `sources` array, which may be empty.

`scripts/bibtrace.mjs` exports `parseBib`, `writeBib`, `bibToSources`,
`loadBibliography` and `delatex`. It handles braced and quoted values,
`@string` definitions, `#` concatenation and common LaTeX accents. Trace evidence
fields preserve their wording; ordinary bibliographic text is normalised for
display. This is a small parser, not a full TeX processor.

## Fields on each record

| BibTeX field | Meaning | Trace source field |
| --- | --- | --- |
| Standard fields: `author`, `editor`, `title`, `journal`, `shortjournal`, `booktitle`, `volume`, `number`, `pages`, `year`, `month`, `day`, `doi`, `url`, `eprint`, `archiveprefix`, `publisher`, `institution`, `organization`, `howpublished`, `shorthand`, and others | Ordinary bibliography data. `shorthand` overrides the author–date label. | Preserved in `Bib data`; the converter computes `APA citation`, `First author`, `Year`, `APA reference`, `URL` and `DOI`. The entry key becomes the source id and `Bib key`. |
| `trace-status` | How far the record has been checked. Set this explicitly. Without it, the converter labels a record with a first quote `Checked excerpt`, otherwise `Reference only · no passage checked`. That default is not an independent verification. | `Record status` |
| `trace-checked` | Date checked, normally `YYYY-MM-DD`. | `Checked on` |
| `trace-url-read` | The page actually read. | `Page read` |
| `trace-note` | A general note about this record. | `Note` |
| `trace-added-by` | Person or agent that added the record. | `Added by` |
| `trace-added-via` | How it arrived: manual, Zotero, agent, script, PDF, web page, etc. | `Added via` |
| `trace-added-on` | Date added. | `Added on` |

## Fields on each quote n

Quote 1 has no numeric suffix: `trace-quote`, `trace-quote-context`, etc.
For quote 2, insert `-2` after `quote`: `trace-quote-2`,
`trace-quote-2-context`, etc. Continue with `-3`, `-4`, and so on.
In the table, `[-n]` means that optional suffix. It is not literal text.
`m` is a note or comment number, starting at 1.

| BibTrace field | Meaning | Trace source field for quote 1 / quote 2 |
| --- | --- | --- |
| `trace-quote[-n]` | Exact words from a checked source. | `Exact quote` / `Exact quote 2` |
| `trace-quote[-n]-location` | Section, paragraph, page or line. | `Quote location` / `Quote location 2` |
| `trace-quote[-n]-context` | Full passage around the quote, verbatim. It must contain the exact quote. | `Quote context` / `Quote context 2` |
| `trace-quote[-n]-context-withheld` | Non-empty reason why that passage is omitted. Required when no context is supplied. | `Quote context withheld` / `Quote context withheld 2` |
| `trace-quote[-n]-tags` | Semicolon-separated tag ids, defined in the document's tag tree. | `Quote tags` / `Quote tags 2` |
| `trace-quote[-n]-note-m` | A note interpreting or qualifying the quote. | `Quote note.1` / `Quote note 2.1` for note 1 |
| `trace-quote[-n]-note-m-by` | Who wrote the note. | `Quote note by.1` / `Quote note by 2.1` |
| `trace-quote[-n]-comment-m` | A comment on the quote. | `Quote comment.1` / `Quote comment 2.1` |
| `trace-quote[-n]-comment-m-by` | Comment author; optional, empty means unsigned. | `Quote comment by.1` / `Quote comment by 2.1` |
| `trace-quote[-n]-added-by` | Who added the quote. | `Quote added by` / `Quote added by 2` |
| `trace-quote[-n]-added-via` | How the quote arrived. | `Quote added via` / `Quote added via 2` |
| `trace-quote[-n]-checked-by` | Who checked the quote. | `Quote checked by` / `Quote checked by 2` |
| `trace-quote[-n]-checked-on` | Date of that check. | `Quote checked on` / `Quote checked on 2` |

The older location spelling `trace-quote-location-2` is also read, but the
preferred spelling is `trace-quote-2-location`. There is no per-quote
`trace-quote-added-on` field in this converter; use record `trace-added-on` and
quote `trace-quote-checked-on` for their respective dates.

Number quotes, notes and comments consecutively. The current converter reads
numbers 1 through 49 and stops at the first missing later quote, note or comment.
It can read quote 2 when quote 1 is absent, but authors should start at 1.

A quote must be copied from its source. Copy its context too, or state why that
passage is withheld. The validator rejects missing contexts and passages that
do not contain their quote. It cannot verify an external source or infer that
a check really happened. Do not call an unread source checked. Use honest
labels such as `AI agent (example author)` and `script (verbatim check)` when
those are who performed the work.

## Complete record

This is the complete W3C HTML record from
[examples/bibtrace-example.bib](../examples/bibtrace-example.bib). It has two
quotes from the same passage. Each quote keeps its own location and note. The
`topic-markup` tag must exist in the document that imports this record.

```bibtex
@techreport{raggett1999html,
  author                   = {Raggett, Dave and Le Hors, Arnaud and Jacobs, Ian},
  title                    = {{HTML} 4.01 Specification},
  institution              = {World Wide Web Consortium},
  type                     = {W3C Recommendation},
  year                     = {1999},
  url                      = {https://www.w3.org/TR/html401/intro/intro.html},
  trace-quote              = {HTML has its roots in SGML which has always been a language for the specification of structural markup.},
  trace-quote-location     = {2.4.1 Separate structure and presentation · first sentence},
  trace-quote-context      = {HTML has its roots in SGML which has always been a language for the specification of structural markup. As HTML matures, more and more of its presentational elements and attributes are being replaced by other mechanisms, in particular style sheets. Experience has shown that separating the structure of a document from its presentational aspects reduces the cost of serving a wide range of platforms, media, etc., and facilitates document revisions.},
  trace-quote-tags         = {topic-markup},
  trace-quote-note-1       = {The quote is the first sentence of its passage, so the passage starts with it.},
  trace-quote-checked-by   = {script (verbatim check)},
  trace-quote-checked-on   = {2026-11-24},
  trace-quote-2            = {Experience has shown that separating the structure of a document from its presentational aspects reduces the cost of serving a wide range of platforms},
  trace-quote-2-location   = {2.4.1 Separate structure and presentation · third sentence},
  trace-quote-2-context    = {HTML has its roots in SGML which has always been a language for the specification of structural markup. As HTML matures, more and more of its presentational elements and attributes are being replaced by other mechanisms, in particular style sheets. Experience has shown that separating the structure of a document from its presentational aspects reduces the cost of serving a wide range of platforms, media, etc., and facilitates document revisions.},
  trace-quote-2-note-1     = {Two quotes may share one passage; each marks its own words in it.},
  trace-added-via          = {web page},
  trace-added-on           = {2026-11-24},
  trace-status             = {Checked excerpt · quotes checked verbatim against the page text},
  trace-checked            = {2026-11-24},
  trace-url-read           = {https://www.w3.org/TR/html401/intro/intro.html},
}
```

That bibliography also includes W3C XML and TEI P5 excerpts, plus a reference-only
book record. See [NOTICE.md](../NOTICE.md) for passage credits and licences.
