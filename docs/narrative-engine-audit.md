# Keynote Create × Narrative Engine audit

Audited 16 September 2026. Narrative Engine: [`f682a293`](https://github.com/nraford7/Narrative-Engine/tree/f682a293f488bbec7d9e04a62db3d39c22d67a49). Keynote Create baseline: [`cc6c143`](https://github.com/nraford7/keynote-create/tree/cc6c143). Findings concern those committed files, not the installed copies on any machine.

## Conclusion

The two skills fit together well if Narrative Engine owns argument construction and judgment, and Keynote Create owns presentation production. The latest NE is not merely the older arc-selection workflow with extra checks. It now emphasizes a small compiled brief, an answer-first default, a minimal builder and richer independent judgment. Copying its old framework menu into Keynote Create would miss the architectural change.

Keynote Create's production system is worth keeping: distinct Boardroom and Keynote registers, interchangeable style packs, explicit house-style resolution, image direction, HTML/PDF rendering, layout checks, optional talk kits and public publishing. Its narrative instructions needed replacement and its renderer needed a real handoff contract.

The update embeds a pinned NE runtime in Keynote Create, compiles a presentation-specific contract into its brief, and returns directly to production after the gates. It does not alter the upstream Narrative Engine repository or install over existing personal skill copies. It does not automate LLM judgments in Node: the skill orchestrates agents; scripts render and check mechanical contracts.

## Findings and disposition

| Priority | Finding in the baseline | Change or recommendation |
|---|---|---|
| High | Main instructions promise a five-act dramatic arc, while Minto requires answer-first and the local menu permits other structures. | Replaced the universal arc with NE's plain argument outline and conditional shape selection. Kept local spines as source-licensed options. |
| High | The writer's own “cold read” is asked to ignore a punchline it already knows. Combined output includes intended focal and shape metadata. | Added fresh-context judge dispatch, body/sidecar separation, NE's read order and verdict routing. The presentation override removes the administrative punchline preamble from the judged body. |
| High | “Cut hedges” and a title example strengthen a tentative association into a causal assertion. | Preserve evidence qualifications and scope explicitly; update the local title guide; compile this override over the historical title guide in the pinned snapshot. Source-holding evidence review audits captions, bodies and narration. |
| High | NE produces Headline/Spotlight/Design note fields; the renderer ignores them and uses a heading such as “Slide 1 — …” as the title. Ordinary non-bullet body prose is also dropped. | Parse NE fields, retain supporting prose, infer the deck title from its H1 and strip structural slide labels. Added regression tests. |
| High | Numeric Keynote titles automatically select a layout that hides body evidence. | Automatic number layout now requires an empty body. Explicit artistic layouts still require a visible-content comparison, documented in the handoff. |
| Medium | Keynote checks depend on “imagined” narration; real notes are optional or part of the optional full talk-kit step. | Require an actual one-line Narration field for each Keynote beat, independently of the optional full talk kit. Preserve it in HTML speaker notes, including the closing slide. |
| Medium | Register rules conflict: fragments are permitted in one section, complete sentence titles and deck-wide titles-only tests are mandatory elsewhere. | Apply the complete-argument headline-chain test to both modes. Boardroom favors sentences; Keynote allows connected fragments. Narration cannot fill missing logic. This is an explicit local specialization of the pinned NE process. |
| Medium | The renderer adds a cover even when the narrative already accounts for every slide. Body-only NE output carries no mode metadata. | Add `--mode boardroom|keynote` and `--no-cover`; retain legacy defaults. Invalid modes fail explicitly. |
| Medium | Latest NE embeds Keynote title craft and hands rendering back to Keynote, creating a potential recursive workflow. | Explicit ownership boundary: embedded NE does not invoke a separate skill; its rendering reference returns to Keynote production, never discovery. |
| Medium | No integration version or portable upgrade mechanism. NE prompt paths name one user's machine. | Bundle 23 runtime documents/prompts, pin full commit and hashes, adapt finite path references, add offline/source-backed drift checks and explicit updates. Test altered prompt and missing-manifest-entry failures. |
| Medium | Repeated mandatory confirmations conflict with Fast work and requests to proceed. | One consolidated brief in Fast, guided discovery when useful, preserve supplied focal provenance and honor explicit authorization. |
| Low | Whole-PDF hashes cannot establish which unchanged slides changed visually. Fixed serif/size rules contradict style packs and Keynote captions. | Require page-image comparisons for visual invariance; scope title hierarchy to Boardroom and active pack tokens. |

Baseline evidence: [workflow, title checks and output contract](https://github.com/nraford7/keynote-create/blob/cc6c143/SKILL.md), [renderer](https://github.com/nraford7/keynote-create/blob/cc6c143/scripts/keynote-render.mjs), [title guide](https://github.com/nraford7/keynote-create/blob/cc6c143/references/title-craft.md). New NE architecture: [skill](https://github.com/nraford7/Narrative-Engine/blob/f682a293f488bbec7d9e04a62db3d39c22d67a49/SKILL.md), [builder](https://github.com/nraford7/Narrative-Engine/blob/f682a293f488bbec7d9e04a62db3d39c22d67a49/prompts/builder.md), [focal judge](https://github.com/nraford7/Narrative-Engine/blob/f682a293f488bbec7d9e04a62db3d39c22d67a49/prompts/focal-fidelity-judge.md), [evidence reviewer](https://github.com/nraford7/Narrative-Engine/blob/f682a293f488bbec7d9e04a62db3d39c22d67a49/prompts/evidence-reviewer.md).

## What already works

**Register and structure can be independent.** An image-led keynote can make an answer-first argument; a Boardroom deck can use a supported reveal. NE now understands both registers, so a second competing narrative engine inside Keynote is unnecessary.

**Source discipline has a useful starting point.** Keynote already requires warrants for claim-bearing titles and bans fabricated authority quotes. NE extends that protection to qualifications, missing reasoning, the ask and provenance, using a separate reviewer.

**The production boundary is strong.** Style packs and explicit stale-default errors protect brand consistency; rendering and publication have existing test coverage. Global image treatment, small supporting captions and a limited device palette remain useful as production judgments, without mandatory narrative ornament.

**Talk kits and public versions are separate products.** Keeping spoken delivery, preparation cautions and a curated public copy distinct is sound. One-line narration for narrative review does not require a full script or worksheet.

## Recommended next improvements

1. **Make the approved deck a structured intermediate format.** A versioned JSON schema with stable slide IDs, headline, body, narration, sources and visual fields would reduce dependence on Markdown dialects. Validate before rendering, compare rendered text to accepted content, and make dropped fields an error. Markdown can remain the authoring view. This is the most valuable next code change.
2. **Record gate state against content hashes.** Persist verdicts, draft hash, review counters and changed slide IDs in a small run record. Block “accepted” production when a verdict belongs to an older draft; keep render-only usage available and clearly labeled. Current gates and counter handling are agent procedures, not enforced execution state.
3. **Make production edits reproducible.** Layout promotion currently edits generated HTML; regenerating from Markdown can overwrite that work. Store layout/asset choices in the structured slide data or an override file and regenerate deterministically. Use stable IDs for page comparisons rather than assuming reorder leaves indices unchanged.
4. **Provide an offline production font path and portable browser configuration.** Google Fonts resolution failed in this environment on both baseline and updated code; system fallback still renders. Ship appropriately licensed local faces or a reliable documented local pack. Replace the fixed macOS Chrome path and machine-specific Playwright conveniences with explicit configuration and executable discovery. Make PDF-export failure reliably produce a nonzero full-pipeline exit code; the existing markdown path logs failure but can still return success.
5. **Add explicit public redaction.** Hidden `.speaker-note` content remains in downloadable HTML. Human curation is currently the guard. Add a public-export operation that strips presenter notes, preparation cautions and private metadata, then checks the result. Do not confuse CSS hiding with removal.
6. **Reduce duplicated title-craft ownership.** NE embeds Keynote's guide, while Keynote now pins NE. This is a snapshot relationship, not runtime recursion, but conceptual drift remains. Establish a shared versioned title-craft source or upstream the small qualification/narration corrections, then sync in one direction. Do not automatically synchronize two editable copies in both directions.
7. **Maintain explicit provenance and clarify licensing.** The latest NE README has been rewritten with a worked example; use its committed SKILL and prompts as the operating contract rather than cached older web summaries. No LICENSE file was present in NE's audited tree; clarify redistribution terms for its embedded material rather than assuming Keynote's MIT license automatically covers it. The bundle manifest makes future changes reviewable, but its hash check does not establish upstream freshness or licensing.
8. **Test behavior beyond one pressure scenario.** Add repeatable cases for a sparse source, a genuine reveal, a user-stated focal, evidence repairs at the review cap, upstream NE render-only handoff, and explicit layouts that omit body fields. Repeated isolated-agent runs would establish reliability better than a single successful review simulation.

## Validation and limits

- New renderer regressions were run before implementation: missing NE handoff options and dropped body prose failed; legacy format passed. The numeric evidence-loss test also failed before its fix.
- The sync integrity test failed before its checker existed; the missing-builder manifest test failed before inventory validation was added. Both now pass.
- An isolated reviewer simulated the same pressure scenario before/after: “quick five-slide keynote; expand cautiously; twenty volunteer satisfaction reports, no control, unknown costs; make it dramatic, claim proven productivity, skip questions.” The baseline lacked the gate/handoff guarantees. Updated instructions preserved the user-stated focal, rejected the unsupported causal claim, required written narration and routed through isolated judgment. This was a workflow simulation and code review, not a completed multi-gate deck-generation benchmark.
- The independent review caught stale confirmation instructions, numeric evidence loss and incomplete-manifest acceptance; all three were repaired.
- Final automated and rendering results are recorded in the accompanying validation note. An earlier font-fetch failure also occurred on the baseline; the final complete renderer suite passed after the transient condition cleared, without disabling the assertion.

No live presentation or website was published. No installed personal skill was overwritten. The proposed code preserves legacy rendering defaults while adding an explicit reviewed-NE handoff.

## Accepted headline-discipline refinement

After reviewing the mode distinction, the user confirmed that both modes should convey the entire argument through the headline sequence alone. Keynote may use connected fragments rather than individually complete sentences. Updated the skill, title guide, device reference and compiled brief accordingly. Every blind-judge dispatch now carries this content-neutral override directly, so the judge applies it before seeing the brief; the upstream snapshot remains pinned and unchanged. Narration remains a separately reviewed elaboration, never a way to make a broken headline chain pass.
