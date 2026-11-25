# Edits: how a model streams edits into a TraceCite page

Runtime: `scripts/edits.js`, included in every reading page the builder makes (since 0.3.0).

A reading page can take edits while someone reads it. The model writes; the words appear in place, word by word;
the reader reviews each suggestion. **The page is the endpoint.** No server is required: anything that can run
script in the page (an agent with browser control, an extension, a test tool) talks to `window.TraceLive`.
A server that relays events is an optional transport, never a requirement: open the page with
`?edits-server=https://host` to have it listen to `<host>/events` and post requests and decisions to `<host>/inbox` and
`<host>/accepted`.

The page announces this in `<script type="application/json" id="trace-live-manifest">`. Look for it first.

## Before anything else: read what already happened

Every time you start (a new session, a new run, after any pause), check the page before you write anything:

```js
const mf = document.getElementById('trace-live-manifest')      // 1. is this page live-editable?
TraceLive.decisions                                             // 2. what the reader decided on earlier edits
TraceLive.decisionsSince(lastRunTime)                           //    or only what is new since you last looked
TraceLive.inbox.filter(r => r.status === 'open')                // 3. what the reader is waiting for
```

Each decision: `{ edit, decision: 'accepted' | 'rejected' | 'commented', op, target, result, before, text, by, req, at, comment? }`.

- **accepted**: that text is now the document. Build on it; never restore `before`.
- **rejected**: do not propose that edit again. If you try the same idea, change it.
- **commented**: the reader's `comment` asks you to revise that edit. Answer it with a new edit on the same target.

Only then answer the open requests. The page also fires `trace-live-decision` on `window` as decisions happen,
and remembers accepted edits across reloads in that browser.

## Read what the reader asked for

```js
TraceLive.inbox.filter(r => r.status === 'open')
// → [{ req, targets: ['s4'], selection: 'the gap between…', instruction: 'say this more simply',
//      onEdit: null | '<edit id>',   // set when the reader is commenting on one of your suggestions
//      blocks: [{ id, text }], at, status }]
```

The page also fires `trace-live-request` on `window` for each new request. Requests stay in that browser.

## Stream an edit

Whole edit, streamed by the page at writing pace (simplest):

```js
await TraceLive.stream({ op: 'replace', target: 's4', text: 'New sentence text…', by: 'Model name (agent)', req: 'r…' })
```

Or event by event, as your own tokens arrive:

```js
TraceLive.push({ type: 'focus',  target: 's4' })                       // optional: bring it into view
TraceLive.push({ type: 'begin',  edit: 'e1', op: 'replace', target: 's4', by: 'Model name (agent)', req: 'r…' })
TraceLive.push({ type: 'delta',  edit: 'e1', text: 'For each ' })      // as many as you like
TraceLive.push({ type: 'end',    edit: 'e1' })
TraceLive.push({ type: 'status', text: 'Reading section 2…' })         // optional, '' clears it
```

- `op`: `replace` (new text for the sentence) or `insert-after` (a new sentence after it).
- `target`: a sentence block id (`data-read-sentence` in the page, `id` in the trace data).
- `by`: always name yourself, and always as an agent: your model's name followed by `(agent)`, for example `"Example model (agent)"`. Accepted edits record
  `Added by / Edited by` with `via: agent`.
- `req`: the request you are answering, so it leaves the reader's waiting list.
- Text uses the trace format: `\( … \)` maths, `[words]{.tag-id}` spans, `[text](https://…)` links.
  Send each maths segment and each span whole in one delta (the page never shows half a formula).

## Rules

1. **Sentences only.** Never target citations, references, exact quotes or their passages; the page refuses them.
   A quote is the source's own words and stays verbatim.
2. **Every edit is a suggestion.** Nothing changes until the reader accepts it.
3. **One edit per idea.** Several small edits beat one long rewrite: the reader reviews them one by one.
4. **Keep the document's conventions:** its connected highlights (`hl-*` spans and `\class{hl-*}{…}` symbols),
   its tone, its terms.
5. A comment on your suggestion (`onEdit` set) asks you to revise it: stream a new edit for the same target.

## What the reader sees

- The old sentence struck through, the new words beside it, a caret while you write.
- A faint ruler of tick lines at the right edge, only while there is something to show (edits, or a tag in focus). The tick where an edit sits is darker;
  the tick being written to takes the accent colour and blinks. No dots, no other animation. Hovering a tick names
  the edit (beside the ruler when there is room, otherwise in the status line).
- A floating status line at the bottom centre: "Example model (agent) is writing…", "3 suggestions to review".
- **Review one by one** from that line (or a tick): Accept (A), Reject (R), Comment (C), previous/next (← →), Esc to stop.
  A comment is saved on the sentence as a suggestion comment (`Comment kind: suggestion`) and comes back to you as a request.
- **Edits** in the sidebar (under Tag tree) opens the edits view: every pending edit tinted, the current one stronger,
  with the review bar. Click Edits again or press Esc to leave it.
- The same ruler is a scroll track (click or drag to go anywhere; hovering names the section) and, while a tag is
  pinned or previewed, shows where its sentences are in that tag's colour.
