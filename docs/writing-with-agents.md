# Writing TraceCite documents with an agent

A TraceCite document makes one promise: **every claim opens to the exact words
it rests on, and says how far those words were checked.** These heuristics
keep that promise when an AI agent writes or edits a document. They are about
spirit more than rules. When a case is not covered, ask which choice keeps a
reader able to check the claim.

## Evidence

- **Quote exactly, by copying.** Copy each quote programmatically from the
  source, with the whole passage it sits in (`trace-quote` and
  `trace-quote-context`). Never retype a quote or rebuild it from memory. A
  passage must contain its quote word for word. The validator rejects a quote
  with no passage unless a reason is given (`-context-withheld`).
- **Never invent.** No made-up sources, quotes, page numbers, comments or
  reviewers. A source you could not open keeps no quote: it stays "Reference
  only" and shows as unchecked.
- **Say how far each record is checked.** Use `trace-status`, `trace-checked`
  and `trace-url-read`. Unchecked stays visibly unchecked.
- **Locate quotes honestly.** Use sections and paragraph positions for web
  pages. Use page numbers only when you read the page.

## Claims

- **Label interpretation as interpretation.** A sentence that is your synthesis
  carries a role such as "Our interpretation". Its review says what the sources
  do and do not support.
- **Keep support separate from role.** Every sentence has a support decision
  (quoted, reference only, no source needed), apart from what it does
  (definition, claim, history).
- **A trace is not proof.** It shows where a claim came from. It does not show
  that the claim is true.

## Provenance

- **Agents are agents.** Record who added and checked each part: "AI agent
  (review)", "script (verbatim check)". Never present an agent as a person.
- **Sign comments as what they are.** Never write comments in a real person's
  name.

## Copyright

- **Before publishing,** keep each quoted passage within what its licence
  allows. W3C, CC BY and CC0 passages are usually fine. Journal pages often are
  not. Otherwise give a short quote, withhold the passage with a reason, and
  link to it.

## Structure

- **The tag is the schema.** A paragraph tagged `env-definition` is a
  definition, with `Label` and `Name` fields. Subsections are nested sections.
- **Comments are blocks:** `note` blocks with `Comment by`, placed under what
  they are about. Replies sit under them.
- **One tree.** Do not duplicate text across branches. Use tags and citations
  to connect ideas.

## Connected highlights, span tags and links

- **Highlights are threads, not decoration.** Use two to four, never more than
  five. Mark the first mention and the key later ones, above all where a
  different word names the same thing ("the data" for x). Colour is never the
  only signal: the words must still say what they mean.
- **Spans** (`[words]{.tag-id}`) go in your own text, never inside quotes.
  Give maths symbols a tag's `symbols` list instead of marking every formula.
- **Links** go in your own text: `[text](https://…)`, or
  `[text](#/at/block-id)` to point within the document. Every link becomes a
  tag, so add one only where a reader would want to follow it.

## Editing an open page

- **Read what already happened first.** On every run, first read `TraceLive.decisions` (what was accepted, rejected or commented), then the open requests in `TraceLive.inbox`, before writing anything. Only sentences are editable. Name yourself as an agent. Every edit is a suggestion the reader accepts or rejects. See [edits.md](edits.md).

## Interactives

- **Compute what you draw.** Derive every shape from the settings and the
  definitions. Never place things by hand.
- **Use theme classes only** (`v-…`, `f-…`, `t-…`, and `api.tagClass`), so
  every theme works. Amber and red are for problems.
- **Keep them simple.** One idea per figure. The caption says what to do and
  what to notice.

## Before you finish

1. Validate: `node scripts/validate-trace.mjs doc.trace.json` should show no
   errors, and warnings should be understood.
2. Build or open the page, and check it shows the document with no console
   errors.
3. Open one sentence all the way down: its citation, the exact quote, where it
   sits, and the passage. Check that the words match the source.
4. Export the `.trace.zip`, and note what changed (`--note`) so the version
   history says why.

See [SKILL.md](../SKILL.md) for the full agent skill, [format.md](format.md)
for the format, and [sample.md](sample.md) for a document that uses every part.
