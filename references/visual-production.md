# Visual production and Art Direct handoff

Read after accepting the narrative, or when entering an existing deck at production. Keynote Create coordinates; Narrative Engine owns meaning and reasoning; Art Direct supplies visual concepts and critique. Neither external skill needs to depend on Keynote Create.

## The production packet

Keep the accepted NE body, brief and review records intact. Copy the body to `deck.md`, assign `> Slide ID: pilot-result` (letters, digits, hyphen/underscore), and keep that ID through title edits and reordering. IDs belong to the production copy, not the blind judge's body. New slides receive new IDs; removed IDs are not reused.

Create `slide-plan.md` alongside it. Record shared delivery context (live/read-alone/both), time/slide limits, chosen register, resolved style and its source, approved direction, and reference to the accepted narrative. For each ID record:

| Field | What it controls |
|---|---|
| Argument job + approved claim | What this slide establishes and how it connects to the next |
| Visible support, citations and qualifications | Content no layout or image may conceal |
| Narration + estimated delivery time | What speech elaborates; budget pauses, examples and activities |
| Visual job | Explain a mechanism, compare, establish scale, make concrete, emphasize, or no extra visual |
| Visual form | Chart / diagram / comparison / documentary image / illustration / typography / none |
| Asset + provenance | File or source URL, factual status, required credit and whether generated |
| Composition + layout | Crop, text-safe area, placement, hint or saved rich layout |
| Review status | Content changes requiring NE review; visual/asset checks still needed |

Choose visual form before an image concept. A comparison can be a labeled matrix; a process can be a diagram; a conclusion can be text. Neither a numeral nor the Keynote register makes photography mandatory. Use `> Layout: text` for an intentional text-only Keynote slide; it renders supporting text without an image-needed placeholder. Keep a sketch or brief when an evidence asset is unavailable; do not fabricate a chart or generate a photograph as proof of an actual event.

For live/read-alone variants, reference one shared argument but maintain separate visible bodies, production packets and review records. Move necessary spoken explanation into the reading version, then review the adapted content. Hidden notes do not make a deck self-contained.

## Art Direct handoff

Use the installed `art-direct` skill when available and relevant. Within a Keynote Create commission, pass this specialization explicitly; standalone Art Direct's default intake, sample scope and metaphor preferences do not replace it.

**Inputs:** approved audience/purpose/success condition, narrative and structure, slide plan with stable IDs, delivery limits, existing assets/provenance, selected house/project style or explicit visual references, and scope (explore directions / full deck / named slides / critique).

**Task:**
1. Accept the approved framing. Identify missing visual information only; do not rediscover the audience, replace the point, choose a new arc or rewrite headlines.
2. With an approved style, apply it and flag real tensions. Otherwise offer 2–3 distinct visual directions, explain their fit, and get a selection before commissioning assets. A direction covers diagrams, charts, typography and images as relevant, not just photography.
3. For each planned visual, develop the form suited to its job. For images, consider literal, human, environmental, metaphorical and oblique lenses without ranking novelty above clarity. No image is valid. Don't generate five options for every slide as a quota.
4. Source real evidence assets for factual claims. Label conceptual/generated illustration and never present it as documentary evidence. Preserve data, scales, categories, uncertainty and credits in explanatory graphics.
5. Return a shared visual guide and per-ID briefs: visual job, chosen form/lens and reason, concrete concept, composition/crop/text-safe area, asset source or generation prompt, provenance/credit, and a useful alternative if needed. Apply only style rules relevant to that asset type.
6. Match the authorized scope. A full-deck commission covers all required slides, not two sample slides followed by another permission request. For exploration, samples are appropriate. Generate prompts only for the image tool actually being used, not a compulsory four-provider bundle. Image generation still follows the user's tool and spending authorization.

**Output ownership:** Keynote Create stores the accepted decisions and builds the deck. Art Direct proposes a narrative change only as a flagged suggestion; changes to content/order/count return through NE before production proceeds. A missing Art Direct skill is handled by preparing this same visual brief directly.

**Example:** A slide says “42% reported improvement in a nonrandom sample; no intervention was tested.” If the job is to explain the evidence limit, use a labeled result with that qualification visible, or a diagram distinguishing observation from causal testing. A dramatic photograph of transformation cannot establish an effect the source did not measure.

## Timing and talk kits

Check the planned narration against the live budget before commissioning assets. About 120 spoken words per minute is a starting estimate, not a guaranteed duration; include pauses, demonstrations and audience activity. Fix infeasible scope through the narrative workflow. Full talk-kit polish comes later and keeps private source cautions separate from spoken copy. New spoken claims need evidence review.

## Preserve work through revisions

1. `deck.md` stores supported layout hints, IDs, image paths, art direction and explicit speaker notes. `slide-plan.md` stores visual rationale and asset provenance. Narrative edits are reconciled into this production copy by ID; never replace it wholesale with the new NE output.
2. For rich HTML promotion, preserve `data-slide-id` on each `.slide-wrap`. After content fidelity and visual review, capture the rich slide markup:

   ```sh
   node scripts/keynote-promotions.mjs capture deck.md deck.html deck.layouts.json
   ```

3. After a narrative revision, rerun affected narrative checks, update the production copy and render it with the same resolved style, mode and `--no-cover`. Restore unchanged designs:

   ```sh
   node scripts/keynote-promotions.mjs apply deck.md deck.html deck.layouts.json
   ```

   Source or local-asset changes leave the fresh render in place and report `REVIEW` for those IDs. Reordering preserves designs by ID and updates page numbers. A changed stylesheet or deck branding rejects replay: review the new style rather than applying old designs silently. Remote or missing source assets cannot be fingerprinted locally and therefore leave their slides for review rather than replay. Store assets locally for reliable reuse. Inspect the visible images too; fingerprints do not establish their meaning.

4. Review and promote changed slides, run fidelity/visual checks, capture the updated layouts, then re-export PDF from the final HTML. Keep `deck.layouts.json` private alongside the production source: it contains full slide markup and may include hidden notes.

For local layout edits, compare untouched slides by ID. Reorder/page-number changes and global style changes have a larger declared scope; inspect every affected slide rather than claiming single-slide byte identity. Legacy HTML without IDs needs IDs before using saved promotions.

## Production fidelity

Run after baseline rendering, restoration and manual promotion:

```sh
node scripts/keynote-fidelity.mjs deck.md deck.html
```

This requires Playwright and checks slide count, order/IDs, and the presence of each expected headline/support item in visible DOM text. Hidden notes or hidden copies do not satisfy it. Use `--no-cover` when rendering: the production source describes every visible slide. Only explicit `> Speaker note:` / `**Narration:**` fields are private notes; ordinary blockquotes and source citations remain visible.

The renderer falls back from incompatible Keynote layouts rather than discarding approved content. A layout fallback is not visual approval; dense content may still need better composition. The fidelity script cannot establish semantic equivalence, detect every added claim, validate image/chart meaning, or certify clipping/contrast. Compare production text with the accepted narrative, inspect charts and evidence assets, then run the geometry/screenshot and PDF checks in SKILL.md. Art Direct can critique whether the rendered visuals communicate each slide's intended job and share a coherent language.

A production edit that changes a headline, claim, qualification, narration, order or count reopens affected narrative checks. An image that introduces a new factual claim requires source review too. Report checks not run; passing text fidelity does not mean the deck passed narrative or visual review.
