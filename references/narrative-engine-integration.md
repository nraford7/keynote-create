# Narrative Engine integration

Keynote Create bundles Narrative Engine's narrative process at the revision recorded in [`../vendor/narrative-engine/manifest.json`](../vendor/narrative-engine/manifest.json). It does not require another installed skill or a network call during a deck build. Read the vendored SKILL as the orchestrator; read its prompts only for the role being dispatched.

## Ownership and precedence

| Concern | Owner |
|---|---|
| Audience, focal origin, Material Read, argument outline, conditional shape, compiled brief | NE Phases 1–3.5 |
| Minimal builder, body/sidecar split, four gates, repair routing and counters | NE Phases 4–4.8 |
| Content-specific review and stress testing | NE Phases 5–5.5 |
| Boardroom/Keynote visual register, assets, style packs, talk kit, HTML/PDF, publication | Keynote Create |

The caller's instructions come first. Within these files, this integration contract specializes NE's generic presentation format and resolves renderer-specific conflicts. NE's source fidelity rules outrank legacy guidance to cut hedges, manufacture drama, fill a minimum number of slides, or force an emotional/reveal arc. The embedded title guide is a historical upstream copy: preserve its lineage, but compile the qualification-preservation rule below into every brief.

NE already embeds an older copy of Keynote Create's title guide and mentions Keynote Create Stage 4. That is a **production handoff**, never a call back into Stages 1–3. When Keynote Create is the entry point, resume its own Stage 3.5/4 after NE finishes. When NE is the entry point, accept its reviewed body and relevant review records, then start production. Missing review records mean unverified input, not an automatic claim that the gates passed; the user may explicitly request render-only work.

## Portable dispatch

Set `NE_ROOT` to the absolute `vendor/narrative-engine` directory of this checkout. Set `RUN_DIR` to a new unique directory (use a random suffix or `mkdtemp`, not just a date/topic). Resolve `NE_ROOT/...` tokens in prompt text before dispatch, or supply their exact expansion explicitly. `RUN_DIR` names in the templates resolve inside that one run. The sync tool adapts only the recorded machine-local NE path prefix and the keynote-devices link; all other upstream text is preserved.

Use the host's isolated-agent primitive for NE's “Task” calls. Builders and judges must receive fresh contexts, not a fork of the conversation. The focal judge's dispatch may contain infrastructure paths and audience/ask/register only. Never include the focal, candidate list, sidecar, selected shape, or example lines from the draft. Follow its cold-read → source → prior verdict → brief order. An Ask can itself resemble the focal; send the requested action, not an added rationale. If the user supplied them identically, disclose the limitation rather than claiming perfect blindness.

If isolated agents are unavailable, do not call a same-context reread blind. Produce a clearly labeled draft/render-only result if authorized; report which independent checks could not run. Do not silently skip gates while declaring narrative acceptance.

## Compile this presentation contract into the Build Brief

The builder's only inputs remain the brief, source, and NE's four craft files. Paste these operative requirements into the brief; do not add the whole Keynote Create skill or integration reference to the reading list:

> Output is a presentation. Write `ne-output.md` as audience-facing body only and `ne-output-meta.md` as private orchestration metadata. No YAML frontmatter, focal/shape labels, source-tag ledger or revision notes in the body. A source citation next to a claim is audience-facing evidence and stays. Do not put an administrative `Punchline` preamble ahead of the title chain: deliver the governing claim in its actual slide position instead. This specializes the generic NE template so the judge sees the argument rather than its intended answer.
>
> Start with `# Deck title`, then `## Title sequence`, then numbered titles for every visible slide. After `---`, each slide uses `## Slide N — title`, `**Headline:**`, `**Spotlight (≤60 words):**`, and `**Design note:**`. Keep each labeled value on one line; supporting bullets can follow. The Headline is the visible title; the heading and title-sequence entry must match it. Do not combine a caption and spoken line inside Headline. For Keynote, add a separate `**Narration:**` line containing the actual spoken sentence for every beat. Narration is required even if a full talk kit was not requested. It is part of the judged body, but presenter-only in rendered slides. Boardroom narration is optional.
>
> Count every visible slide, including a cover if one is wanted. The renderer will not add another cover. Answer-first means the claim is heard/read by visible slide 2. Keynote fragments are valid; evaluate their chain with written narration. Boardroom uses complete sentences and the title-only/antecedent tests. Preserve source qualifications, estimates, subgroup scope and correlation/causation distinctions in captions, bodies and narration. Never turn “may” into “will” for style. Any generated recommendation must be identified as a recommendation and supported to the degree the source allows; no invented facts, examples or essential arc beats.

Resolve register, density, length/time budget and source citations before copying the contract into the brief. “Keynote/sparse” maps to NE High-Impact with fragment titles and sparse visible bodies; it does not waive evidence review. Voice and audience rules are compiled as NE requires. Global image treatment and CSS stay with the production orchestrator.

## Review and repair

Follow upstream's full shared repair loop rather than a new local implementation. Keep a run record outside the judge's initial inputs with the focal-reopen count, evidence-review count, last report archive path, accepted-body hash, and disposition of each gate. Reports are markdown judgments, not machine-verified proof.

- Gate 1 rejects unsupported essential beats before drafting. No framework is a valid result.
- Gate 2 has PASS / NEEDS_REVISION / FRAMEWORK_MISMATCH / FOCAL_MISMATCH. User-stated/selected focal points receive advisories, never an automatic reset. Inferred focals can be reopened once per run. Preserve the upstream `needs_revision_count`; at 3 without convergence escalate.
- Gate 3 flags structural drift; only the builder edits. A plain, source-supported section is not a failure. These checks do not establish that writing is human or quantify its quality.
- Gate 4 audits the actual body, narration, source and sourcing sidecar. BLOCKING findings prevent accepted delivery. Minor-only findings can pass with disclosed notes. Two evidence-review dispatches maximum per draft; removing a trigger does not reset the counter. An unchanged draft with an existing CLEAN review does not consume another run.
- Trigger priority is focal → evidence → humanizing. Archive reports before removing resolved triggers. Judge-origin repairs always return to that judge; other repairs return when focal/ask/climax/close changed. The first evidence audit covers the whole draft; the second covers changes and unresolved findings. A third necessary audit escalates rather than silently weakening the cap.
- Selected specialist/stress-test changes also use this repair route. After the gates pass, art/layout may proceed. If a production edit changes content or order, reopen affected checks; do not claim an old verdict covers new claims. Full talk-kit notes extend the reviewed one-line narration; new claims require evidence review.

## Render the accepted body

```sh
node scripts/keynote-render.mjs /path/to/run/ne-output.md --mode boardroom --no-cover --out /path/to/deliverables
# or --mode keynote; add --style <pack path or registered name> as required
```

`--mode` explicitly supplies the register that would otherwise require frontmatter. `--no-cover` ensures the reviewed slide count and the rendered count agree. The renderer maps Headline → visible title, Spotlight → body, Design note → art direction, and Narration → hidden speaker note. A design note may appear in an image-needed draft placeholder, as existing Keynote behavior specifies. Missing images mean a production draft, not a finished visual deck. Plain supporting paragraphs are retained too. Sidecars, briefs and verdicts are never imported into HTML. The renderer parses and renders; it does not run agents or certify that narrative gates passed.

**Layout fidelity:** do not apply `number`, `oneword`, `wordless`, `verdict`, `pair` or `triptych` hints if their layout would omit reviewed support. Compare visible captions/body/citations with the accepted slide after promotion. Automatic numeric layout selection is restricted to bodyless slides; explicit hints still require this production check.

Legacy combined Markdown still works with its default generated cover. Do not render `ne-output-meta.md` or prepend its fields to the blind judge's copy. Avoid editing generated HTML for narrative changes: return to accepted Markdown, run affected gates, then regenerate. Layout-only promotion still happens in HTML under Stage 4.

Hidden narration is present in HTML source. Human public curation must remove private notes, cautions and unpublished claims from the **public copy** before Stage 6. CSS hiding is not redaction.

## Updating the pinned copy

```sh
node scripts/narrative-sync.mjs --check
node scripts/narrative-sync.mjs --check --source /path/to/Narrative-Engine
node scripts/narrative-sync.mjs --update --source /path/to/Narrative-Engine --revision <reviewed-commit>
```

The update reads committed files with `git show`, never uncommitted working-tree edits. It copies the top-level runtime Markdown and prompt templates, omitting README, SYNC, examples and development scripts. The manifest records the full upstream commit, upstream and adapted hashes, and finite path replacements. `--check` checks bundle integrity offline; `--check --source` additionally verifies against the pinned commit. Neither checks whether a newer upstream commit exists. Fetch upstream deliberately, review changes, update, run tests and repeat the pressure scenarios in the audit. Do not auto-update narrative behavior during deck generation.
