# Content structure coding

`document-structure.mjs` codes the paper with the `move` tag family, named **Content structure**. It works at two levels:

- every sentence, including figure and table captions, carries exactly one of the 16 **moves** (the leaf tags);
- every paragraph block (captions included) and every section carries exactly one of the 5 **groups** (the middle tags), for its overall job.

The generator throws an error if a sentence has no `cs-` tag, more than one, or a group instead of a leaf. It also throws if a paragraph or section is built without a valid group.

The codes adapt three traditions: Swales's move analysis (Swales, 1990), Toulmin's argument roles of claim, grounds, warrant, qualifier and rebuttal (Toulmin, 1958), and the legal IRAC pattern of issue, rule, application and conclusion.

## Groups and moves

| Group | Tag id | Move | Definition |
| --- | --- | --- | --- |
| Framing (`cs-framing`) | `cs-orientation` | Orientation | Gives context or background, or sets the scene. |
| | `cs-signpost` | Signpost | Announces how the text is organised or what comes next. |
| | `cs-definition` | Definition | Says what a term means. |
| | `cs-question` | Question | Poses a problem or question that the text goes on to answer. |
| Sourcing (`cs-sourcing`) | `cs-report` | Report | States what a source found, argued or did, with the source as the subject. |
| | `cs-quotation` | Quotation | The sentence centres on a quoted passage. |
| | `cs-attribution` | Attribution | Credits an idea or term to someone, briefly, while the sentence is about something else. |
| Argument (`cs-argument`) | `cs-claim` | Claim | The author's own assertion. |
| | `cs-evidence` | Evidence | Data, dates or facts offered in support. |
| | `cs-example` | Example | A concrete case or instance that illustrates a point. |
| | `cs-reasoning` | Reasoning | Explains why or how the evidence supports a claim (the warrant). |
| Positioning (`cs-positioning`) | `cs-qualification` | Qualification | Limits or hedges. |
| | `cs-contrast` | Contrast | Sets one view, period or case against another. |
| | `cs-concession` | Concession | Grants a point, often against the author's own position, before moving on. |
| Closing (`cs-closing`) | `cs-conclusion` | Conclusion | Sums up or draws the preceding sentences together. |
| | `cs-recall` | Recall | Points back to an earlier point in the paper. |
| | `cs-implication` | Implication | Says what follows, why it matters or what comes next. |

A paragraph's or section's group names its job in the paper, not the most common group among its sentences.

## Decision rules used

- A sourced historical fact that opens a section or paragraph and sets its topic is Orientation. The same kind of fact in the middle of a paragraph, supporting an interpretation, is Evidence.
- A sentence is Report only when the source (author, document or organisation) is its subject: "Parkes described…", "The same section argues…". When the source appears only as a short credit at the end or as a modifier ("a history traced by Grafton"), the sentence is Attribution.
- Quotation is used only when the sentence is built around the quoted wording itself (the TEI "undifferentiated bits"), not when it paraphrases a source's argument.
- Evidence is a general supporting fact; Example is a single named instance chosen to illustrate (Grosseteste's index, Figure 2).
- An interpretation that adds a new point is Claim. One that spells out why a fact leads to a conclusion, usually with "because" or "so", is Reasoning. One that sums up the sentences before it is Conclusion.
- An interpretation whose main work is to connect back to an earlier section is Recall. One that points forward, to the present or to future work, is Implication.
- A reported source's own concession or contrast stays Report: the move records what the paper does, not what the source did.
- Captions are Orientation when they give an overview or say how to read the figure, Example when the figure illustrates a stated principle, Definition when it names and explains a set of terms, Conclusion when it summarises the paper (Table 1), and Qualification when it states a caveat about how it was made.
- Paragraph groups: Framing for a paragraph that sets up a problem or the paper; Sourcing for one whose job is to lay out what sources said; Argument for one that builds a point from evidence, even if it cites heavily; Positioning for limits and set-against views; Closing for one that draws together, looks back or looks forward.
- Section groups follow the same rules for the whole section. Captions are coded but weigh little in the section's group.

## Hard cases

- **"A roll is read in one direction…"** (sentence 8). It is the author's own assertion, so Claim fits, but its job is to set up the problem of finding a passage that the codex, rubrics and indexes then answer. Coded Question, which also makes the paragraph Framing.
- **"Scientific articles evolved… known as IMRaD"** (sentence 27). It introduces the term, but its main job is to open the paragraph's history. Coded Orientation, not Definition.
- **"He granted that a tree gives every node a unique name…"** (sentence 51). A concession, but Berners-Lee's, reported. Coded Report under the rule above.
- **"Engelbart's numbered statements and Berners-Lee's links answer the same question differently"** (sentence 52). It closes the section, so Conclusion was possible. Its specific work is setting two cases against each other, so it is Contrast, and the paragraph is Positioning.
- **"The same post names Engelbart and Nelson…"** (sentence 56). It links back to the hypertext section, but the source is the subject, so it is Report, not Recall.
- **"A tree imposes one way of dividing an argument…"** (sentence 65). A limitation, but specifically the paper granting a critic's point against its own format. Coded Concession. The next sentence ("…shows where a claim comes from, but it does not show that the claim is true") also grants something, but its weight is on the limit, so it is Qualification.
- **"Whether sentence-level evidence helps readers… is an open empirical question"** (sentence 67). It poses a question, but in the last position and as future work, not as a problem the paper answers. Coded Implication.
- **Markup and Hypertext sections.** Both end on an interpretation (Recall, Contrast), but most of their work is laying out what sources argued, so both sections are Sourcing.
- **Blocks and outliners today.** It adds new material (Notion), but it carries the history to the present, ties it back to the medieval apparatus and holds the summary table, so the section is Closing. The paper has no separate conclusion section; Limits ends it as Positioning.
- **Print, title pages paragraph.** One orienting fact and one report; its job is to give the source's account of the title page, so Sourcing rather than Framing.
