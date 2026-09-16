---
name: keynote-create
description: "Use when turning source material into a presentation, keynote, pitch, slide outline, or action-title deck, or when rendering, tightening, preparing a talk kit, or publishing an existing deck. Combines a pinned Narrative Engine workflow with Boardroom sentence titles or Keynote image-led fragments, style packs, HTML and PDF output. Does not generate .pptx or .key files."
---

# Keynote Create

Turn source material into a source-supported argument, then into an HTML deck and PDF. Markdown is the structural deliverable. **Boardroom** uses complete action-title sentences; **Keynote** uses image-led fragments with written narration. Register determines presentation, not the argument's shape.

## Workflow

**Narrative Engine owns the narrative stages; Keynote Create owns production.** Read [`references/narrative-engine-integration.md`](references/narrative-engine-integration.md), then the pinned [`vendor/narrative-engine/SKILL.md`](vendor/narrative-engine/SKILL.md) for narrative orchestration. These are embedded files, not calls to another installed skill. The integration reference resolves the boundaries and presentation contract; do not recursively invoke either skill. Existing deck rendering or publishing starts at its relevant production stage, without restarting discovery.

### Stage 1 — Import, audience, material, focal point

Use NE Phases 1–2: Fast/Guided discovery, audience and ask, Material Read, and 2–3 stance-committing focal candidates. Capture the One Thing, Ask, Through-Line and `focal_origin`. An explicitly supplied point is `user-stated`, never `inferred`. Default to Fast when the user asks for speed or provides clear instructions. Surface assumptions in one consolidated brief; do not repeat already-answered questions. Honor an explicit instruction to proceed without questions.

### Stage 2 — Argument outline and compiled brief

Use NE Phases 2.5–3.5. Write the plain argument outline first; **answer-first is the default in both registers**. Admit a withheld reveal only when the Material Read identifies a genuine surprise. Named arcs, including the local spine menu, require quoted source support for essential beats and a passing skeleton stamp test. No required five-act arc, minimum slide count, obligatory emotional reversal, or prewritten killer line.

Compile the brief with focal origin, audience/ask, full Material Read, argument outline, approved shape and kept beats, register, density, voice and audience essentials. Include the renderer contract from the integration reference verbatim. Length is content-driven within the user's actual slide/time budget; count every visible slide, including any cover. Keynote/sparse is a visual density alias of High-Impact, not a new narrative shape.

Resolve style using Stage 4's precedence. Present one consolidated confirmation in Fast mode, unless the user already authorized proceeding; use guided questions only for unresolved choices. Keep visual style details with the orchestrator, outside the builder's small reading list.

### Stage 3 — Build and four gates

Create a unique `RUN_DIR` and write the source and compiled brief. Dispatch the embedded NE builder with a fresh context. It writes `ne-output.md` (body only) and `ne-output-meta.md` (focal, shape, sourcing and revisions). **Do not send the builder this entire skill or the reference catalogs.**

Run NE's gates and shared repair loop:
1. **Shape support** before drafting (Stage 2).
2. **Blind focal fidelity** after drafting: a fresh judge reads the body, records its cold read, reads the source, then the brief. Dispatch audience/ask/register only, never the focal, sidecar or inherited conversation. Keynote judges read actual written narration, not an imagined line.
3. **Humanizing check**, flag-only by the orchestrator; the builder makes repairs.
4. **Evidence review** with source and sidecar: unsupported claims, stripped qualifications, missing reasoning, overreaching asks and provenance mistakes. Never remove evidentiary “may”, “estimated”, “preliminary” or “correlational” to make a title punchier.

Use upstream verdict routing, trigger priority, report archives, judge counter and two-evidence-reviews-per-draft cap. Do not treat PASS at the focal gate as permission to deliver. Run targeted review automatically for high-stakes content and offer it otherwise; offer stress tests only where NE calls for them. Revisions after review must re-enter the affected gates. See the integration reference for limitations when isolated agents are unavailable.

### Stage 3.5 — Art direction and production handoff

After narrative gates and any selected reviews pass, freeze the accepted slide sequence. For Keynote, choose one global photographic treatment, then record per-slide image direction and assets with `> Art:`, `> Image:` / `![]()`, and optional `> Layout:`. Use an available art-direction skill or write briefs directly; a missing external skill must not block an otherwise usable deck. Select devices from [`references/keynote-devices.md`](references/keynote-devices.md) only where source material supports them. There is no device or imagery quota. Evidence diagrams and literal images are valid when clearer than metaphor.

Keep production metadata outside the judged body. Make `deck.md` as a production copy only after review; the accepted NE body remains the comparison reference. Adding assets is permitted; changing claims, captions, narration, order or count invalidates the affected narrative checks. New talk-kit claims also need source review.

### Stage 3.6 (opt-in) — Talk kit

Offered when the deck fronts a **live talk or workshop**: the frontmatter carries `occasion: talk`, the user names a live event ("I'm giving this at MOD. Adelaide"), or the user asks for it directly. Offer in one line and wait for the go-ahead — never forced. Numbered 3.6 because it sits after the Keynote-mode art-direction pass (3.5, above) and before rendering — existing stages are never renumbered.

Two deliverables, both landing **next to the deck** (same directory as the markdown):

1. **Speaker notes** — per-slide spoken prose written for delivery at **~120 wpm**, with **cumulative timings** per slide ("3:12 by the end of this one"). Two clearly separated blocks per slide:
   - **Spoken copy** — what the presenter actually says.
   - **Source cautions** — preparation-only evidence notes, kept strictly separate from the spoken copy. A number, name, or citation that will be *spoken* must be verified before the talk; a claim that lives only in the caution block stays out of the spoken line until it is verified. This caution discipline is what keeps a deck's claims defensible: pre-verified, never asserted.

2. **Worksheet** — one A4 page, **only when the deck contains activity/exercise slides**. No activity slides, no worksheet.

### Stage 4 — Render, promote layouts, export

Three sub-stages: baseline render, layout promotion via `/impeccable`, re-export.

**Style resolution precedence (applies to all sub-stages).** A deck is always rendered by a **style pack** — a directory the render script consumes (`pack.json` + `tokens.css` skin + `layouts.css` structure + `fonts.json` + `style-notes.md`; see `packs/neutral/REQUIRED-TOKENS.md`). Resolve which pack, in order:

1. **Explicit style source in the request.** The user gave a reference deck / URL / verbal brief, or a `--style <path>`. Run the matching **producer** (below) or use the path. This skips the Stage 2 style question.
2. **Registered house default.** If the registry's `default` names a pack, use it: omit `--style` (the renderer resolves the default itself) and never substitute neutral. This is the normal case once a house pack exists.
3. **Project style detected.** If the working directory or any parent up to `$HOME` contains `DESIGN.md`, `tokens.css`, `deck.template.html`, `style-guide.html`, or a `CLAUDE.md` naming a deck style — adopt it via the **project adapter** and tell the user. This answers the Stage 2 style question rather than being asked.
4. **Stage 2 style choice** — House style / Neutral / Bring-your-own — only when none of 1 to 3 fired.
5. **Neutral fallback** — the bundled `packs/neutral` pack when nothing above is specified.

**Project adapter.** A project `tokens.css` that already defines the canonical token set (see `REQUIRED-TOKENS.md`) is used directly as a skin over the shared neutral `layouts.css`. A project `DESIGN.md` / `deck.template.html` that is *not* a canonical pack is run through the **from-reference** or **from-verbal** producer to synthesize a pack. Either way the result is finalized to a complete, `loadPack`-valid pack before use — this preserves project-style behavior instead of silently losing it.

**House-style first-run setup.** When the user picks **House style** and none is registered: ask them to point me at it (a folder, a style guide, or a reference deck) or describe it; run the matching producer; **finalize** to a complete pack; register it with `scripts/house-style.mjs` (`registerPack`); reuse it silently on later runs. The registry and any house pack live in local config (`~/.claude/keynote-house-style.json`, `~/.claude/keynote-packs/…`) — never in this repo.

Pass the resolved pack to the render script with `--style <pack-dir|name>`. An explicit but unresolvable `--style` is a hard error, never a silent neutral fallback.

**Keynote mode changes the visual system.** When `mode: keynote` is in the frontmatter, the render script routes every slide through the keynote layout family (full-bleed image + caption box, one-word-on-black, giant-number, wordless, recurring-motif) instead of the text layouts. The serif-title default does not apply to Keynote decks — the caption box over full-bleed photography is its own system. Boardroom mode renders exactly as before. Both families re-skin from the active pack's tokens.

**Layout check after every slide change (mandatory).** Any time a slide is added or changed, run the guard and then look:

```
node scripts/keynote-check.mjs <deck.html> <slide numbers…> --out <dir>
```

It screenshots the slides and fails on anything that leaves the frame, crosses the footer band, or overlaps another text block. Then hand the screenshots to an available vision-capable reviewer with the slide's intent and ask for PASS/FAIL, misalignments with pixel positions, and one concrete adjustment. Fix, re-render, re-check. A slide is not done until both halves pass.

**QA discipline (mandatory, on top of the layout check).** Every slide change — add, edit, reorder — also requires:

1. **Snapshot before.** Before touching the file, record each slide's exact byte span — the `.slide-wrap` slice, by index.
2. **Byte-proof after.** An **agent procedure, not a script** — it runs per manual slide edit and needs judgment about what counts as the changed unit. Extract each slide-wrap's exact byte span from the before and after files, compare slide-by-slide, and report **"only slide N changed; other M slides byte-identical."** A silent difference in any other slide is a failure, even if it renders fine.
3. **Rendered-page comparison** before/after PDF export: compare corresponding unchanged page images. A whole-file PDF hash changes with metadata or any edited page and cannot prove that unchanged slides look identical.
4. **E2E navigation check.** The nav subset of `node scripts/keynote-verify.mjs <deck.html>` must pass before the change counts as done: synthetic `p`/Escape/arrow keys drive the deck, `#N` and `#present` deep-links resolve from a fresh page load. Decks without a show-mode handler report these lines as SKIPPED — SKIPPED never fails a run.

#### Stage 4a — Baseline render

Run the render script to produce a first-pass HTML deck and PDF. The script uses four default layouts: COVER (slide 1), CLOSING (last), VERDICT (short bold body-less middle slides), EDITORIAL TITLE (everything else).

```bash
node scripts/keynote-render.mjs <deck.md> [--style <pack-dir|name>] [--brand <name>] [--sublabel <text>]
```

`--style` takes a pack directory path or a name registered in the house-style registry; omitted, the renderer uses the registry default and falls back to the bundled neutral pack only when no default is set — a registry default that is set but broken (moved directory, unregistered name) is a hard error, never a silent fallback. `--brand`/`--sublabel` default from the pack's `pack.json`.

The script:
1. Parses the markdown's YAML frontmatter + slides
2. Downloads the active pack's fonts once into `~/.claude/cache/fonts/`, inlines them as base64 `@font-face`
3. Generates a self-contained HTML deck next to the input markdown
4. Spawns headless Chrome with `--virtual-time-budget=10000 --run-all-compositor-stages-before-draw` to produce a 1920×1080 PDF
5. Warns if the PDF is below ~30KB/slide (signals font-embed failure)

The HTML and PDF land next to the input markdown (`deck.md` → `deck.html`, `deck.pdf`). Open the PDF.

#### Stage 4b — Layout promotion via `/impeccable`

The baseline uses 4 layouts. **Rich promotion depends on the active pack.** A pack whose `pack.json` sets `richPromotion: true` ships a `template.html` (a catalog of layout scaffolds) and a `layout-catalog.md`; promote each slide to the layout its content wants. A pack with `richPromotion: false` (the neutral default and most bring-your-own packs) has no template — promote only *within* the baseline + keynote family, and tell the user "this pack has no rich layout template; keeping the baseline family" rather than silently doing nothing.

For a `richPromotion` pack:

1. **Invoke `/impeccable`** on the generated HTML. The skill applies design discipline (typography, the accent used as a scalpel, hierarchy from type scale, no chartjunk) to the rewrite work.
2. **Read the active pack's `layout-catalog.md`** — the catalog of layouts with a decision tree and content cues for picking. (The bundled generic catalog is [`references/layout-catalog.md`](references/layout-catalog.md).)
3. **Read the active pack's `template.html`** — the source-of-truth for layout markup. Each template slide is a working scaffold.
4. **For each slide in the generated HTML**, classify by walking the decision tree in the catalog top-to-bottom; stop at first match.
5. **Rewrite each slide's HTML in place**, copying the layout scaffold from `template.html` and filling in the slide's content. Preserve the footer (`brand` + `pageno`) on every slide.
6. **Validate** light/dark rhythm: don't put more than 3 light slides in a row, more than 2 dark in a row. Dark layouts (VERDICT, PULL QUOTE, FULL-BLEED IMAGE, SECTION DIVIDER, HALF-BLEED) are punctuation between light editorial slides.
7. **Validate div balance** after all rewrites: count `<div` vs `</div>` in the file; they must match. Imbalanced divs break the deck silently.

The catalog also includes the common rewrite mistakes to avoid — wrong theme class, body text in the accent color, missing title-rule, stripped footer.

If the deck is small (3-5 slides) and the baseline already looks right, or the pack has no template, the user can skip 4b. Default behaviour is to run 4b automatically for `richPromotion` packs — tell the user "promoting layouts" before starting; they can interrupt with "skip promotion".

**Layout promotion constraints — non-negotiable:**

- **Boardroom title hierarchy follows the active pack; Keynote retains its caption/device layout.** Some pack templates use h3 (46px) for certain layouts (cards, stats) by convention. Override that — in our narrative-title model, the title carries the story and must remain visually dominant. For Boardroom, prefer `<h2 class="h2">` when the pack supports it; use its tokens rather than forcing a font or size across registers.
- **Drop eyebrows by default.** Eyebrows ("THREE PRESSURES SIT BENEATH THE RENT LINE" in tracked uppercase) compete with the title for the eye. Only include an eyebrow if it is a quiet act-label or section breadcrumb (e.g. "Act 1 · Context"), and keep it visually small. When in doubt, omit.
- **Speaker notes do not render.** They exist in the HTML source as `<div class="speaker-note">` for the model and user to reference, but the CSS hides them from the rendered slide. They are presenter-only context. Do not place them where they could visually overflow into the content area or footer.
- **Footer stays consistent.** Every slide carries the same `<div class="footer">` with brand + page number. Don't strip it.

#### Stage 4c — Re-export

After re-export, tell the user how to present: open the HTML and press `p` for show mode (fullscreen, arrow keys or a clicker to advance, Esc to leave; `#present` in the URL opens straight into it). Video slides use `![](clip.mp4)` and must ship the video file next to the HTML.

After 4b, refresh the PDF from the modified HTML:

```bash
node scripts/keynote-render.mjs <deck.html>
```

The script now lives in the skill directory (`scripts/` in this repo's clone), so run it from the skill root. It detects the `.html` extension and skips markdown parsing and font fetching — it just spawns Chrome with the same flags to refresh the PDF in place. Open the new PDF for visual review.

If a layout looks wrong, re-run 4b on the specific slide and re-export. The decision tree in the pack's `layout-catalog.md` is advisory, not binding — taste overrides rule when they conflict.

### Stage 5 (on-demand) — "Tighter"

User can request compression passes anytime after delivery. When they say "tighter":

1. Re-confirm the punchline. Has the point drifted?
2. Section pass: any slides that could merge or be cut?
3. Per-title compression: cut filler, sharpen verbs, lose any title that does not justify its slide.
4. Re-run craft and humanizing checks. Route changed claims, ask, climax, close, sourced material or narration through the affected NE gates and shared repair loop; preserve report counters. Then render the tighter markdown with the same mode and cover policy to refresh HTML + PDF.

Repeatable until the user says stop.

### Stage 6 — Publish

Publishes a **human-curated public deck** to a registered website target. Stage 6 is mechanical only — it never edits content. What to trim, what the public intro slide says, and what stays talk-only is deck-specific judgment the human does **before** Stage 6; the skill never guesses.

1. **Confirm the public HTML exists, is human-curated, and is separate from the source artifact (hard rule).** If the public version doesn't exist yet, stop and return the deck — the human curates first. Stage 6 never edits the talk artifact.
2. **Resolve the target.** Explicit `--target <name>` > the registry's `default` > the onboarding flow (below) > **hard error**. Never a silent guess. The registry lives at `~/.claude/keynote-publish-targets.json` — see [`references/publish-targets.md`](references/publish-targets.md).
3. **Copy-to-work.** Copy the deck to a working location. The talk artifact is the source of truth and is never edited — enforced, not convention.
4. **`web-optimize`** — externalize base64 images and resize them to their measured rendered boxes:
   ```bash
   node scripts/web-optimize.mjs <work.html> [--out <dir>]
   ```
5. **`web-inject`** — meta/OG/Twitter tags + canonical URL, reading-mode hint, mobile present controls:
   ```bash
   node scripts/web-inject.mjs <work.html> --url <urlBase><slug> --description "<text>"
   ```
   The canonical URL is the target's `urlBase` + the deck slug; the `<title>` comes from the deck. **Confirm the description with the user** before injecting.
6. **Site integration** per the target profile: the deck lands at the target's `deckPath`; a hub card, listing entry, and structured-data entry are added. **Card copy is approved by the user before anything is written.**
7. **Build, then verify locally.** Run the target's `build`, then the assertion suite on the deck at its target path:
   ```bash
   node scripts/keynote-verify.mjs <target-repo>/<deckPath> [--mobile] [--throttle]
   ```
   Exit 0 required. Reading the report: geometry is slide-relative by construction; the pageno check requires each numbered slide's page number to **equal its 1-based slide index** (+1 apart — slides without a pageno, like the cover, are exempt); the reading-mode hint must appear within 3 s of load and auto-dismiss by **7.5 s** (6 s timeout + fade); under `--throttle`, first contentful paint must land under **2.5 s** at 1.6 Mbps / 150 ms. **SKIPPED lines are expected, not failures** — a nav-less deck (no show-mode handler) skips the present-flow checks; only a FAIL fails the run. `--mobile` re-runs geometry and present flows in a `hasTouch` context (never `isMobile` — it inflates `window.innerWidth` and poisons geometry), covering tap advance, swipe next/back, the exit button, and the rotate toast.
8. **Commit** the site repo.
9. **Push gate — explicit human yes, every time.** Never push on assumption or momentum; a go-ahead from earlier in the session is not a go-ahead now.
10. **Deploy** per the target profile (e.g. push-to-main → GitHub Pages).
11. **Re-run `keynote-verify` against the live URL** — the same suite, now on the deployed page. Exit 0 before the publish is called done.
12. **Record the outcome** — what was published, where, and the verify results.

**Onboarding flow** (first run against any unregistered site; later runs are silent): read the site repo — routing structure, static-asset conventions, hub/listing pages, any structured data (JSON-LD) on the hub that grows per published item, build and deploy mechanics — then propose a profile; the user confirms before it persists to `~/.claude/keynote-publish-targets.json`. See [`references/publish-targets.md`](references/publish-targets.md) for the schema.

## Spine menu — optional, source-licensed structures

A plain answer-first argument is a complete result. Minto's grouped reasons and vertical Q&A are useful when the material supports them, in either register. There is no mandatory mid-deck turn.

The local palette remains available: emotional arc, reveal/misdirection, framework build, forecast cascade, teaching/method, and scenario-parallel. Read [`references/keynote-devices.md`](references/keynote-devices.md) as an orchestrator reference. Its example pacing and slide counts are illustrative, not minimums. Apply NE Gate 1 to each proposed structure: quote support for essential beats, test the focal and ask against the landing, reject unsupported beats rather than manufacture them. Forecasts stay conditional; scenarios remain scenarios.

Choose a different shape if the required beats cannot fit the user's budget. Never pad to satisfy an arc. Compile only the selected, supported beats into the brief; the builder does not read the menu.

## Density calibration

Density modifies how the title sequence and bodies are tuned within the chosen length.

| Density | Title style | Body style |
|---|---|---|
| High-Impact | Bone-bare, declarative, near-aphoristic | One bullet, often none |
| Narrative | Conversational, beat-shaped, room to breathe | 2-3 short fragments |
| Evidence | Specific, claim-bearing, numbers when possible | 3-4 bullets including a data point or citation |
| Keynote/sparse | Fragment, one-word beat, question, or coined term | Near-empty — the image is the body |
| ELI5 | Plain words, concrete nouns, no jargon | Short fragments with everyday analogies |

**Keynote/sparse** is the default density inside Keynote mode: the caption is one line or one word, and the full-bleed image does the work the body would otherwise do. Even so, **give most slides a one-line subcaption** — a single short bullet that elaborates the beat. It renders as a small line beneath the top-left caption box (like the corpus close). Caption + subcaption is the standard keynote slide; leave the body empty only for deliberate wordless or one-word beats.

In **ELI5** mode, the title-craft rule "specific over abstract" is satisfied by concrete analogies as well as numbers. "Our pipeline is a leaky bucket" beats "Conversion dropped 18% in funnel stage 3" if the audience won't recognise the latter.

## Title craft

**The sentence and continuous-prose rules below apply to Boardroom.** Keynote uses fragments plus explicit narration; only a designated chained-caption run receives the strict titles-only test. Both registers preserve evidence qualifications and undergo the independent gates.

- **Spoken prose, not a list.** The whole sequence read aloud must sound like spoken delivery, not a glossary. Each title carries its setup with it or resolves the previous title's open thread. *(This is the primary rule. The titles-only test below enforces it.)*
- **Sentences, not labels.** "Adoption stalled in Q3" — never "Adoption" or "Q3 Numbers."
- **Length.** 4–10 words default; stretch to 15 when chaining demands it (see "Title length" below).
- **One beat per slide.** A title doing two beats becomes two slides.
- **Active voice.** "We missed the signal" beats "The signal was missed."
- **Specific over abstract.** Numbers, names, concrete nouns hold attention. (In ELI5, concrete analogies also satisfy.)
- **Plain over clever.** A smart reader who hasn't read the source must understand each title alone. Compressed expert shorthand fails the stranger test.
- **No throat-clearing.** Banish "Introduction," "Overview," "Background," "Agenda," "Conclusion," "Thank you," "Questions?"
- **Forward motion.** If two adjacent titles can swap without loss, one isn't pulling weight.
- **The last title lands.** It should resolve, commit, reframe, or open forward. Never summarize.

See [`references/title-craft.md`](references/title-craft.md) for failure modes (opaque title, disconnected sequence), rewrite examples across genres, and the antecedent test. This is the primary reference for Stage 3, step 3.

## The titles-only test (the structural check)

**Boardroom:** apply this test to the full title chain. **Keynote:** apply the beat + written narration test instead; use this strict test only for a designated chained-caption run. These self-checks supplement, never replace, the blind focal judge.

Before producing final output, write every title — *literally, every one, in order* — as a single concatenated paragraph. Then:

### 1. The spoken-prose test

Read the paragraph aloud, as if you were *speaking the deck* to a stranger. It must sound like spoken delivery — a continuous argument, not a list of true statements. The failure mode is titles that are individually clear but don't chain. Each title must either carry its setup with it or resolve the previous title's open thread.

If reading the paragraph produces questions like "to what?" / "what strategy?" / "what policies?" / "who is *they*?" / "who is *he*?" — the chain is broken. Rewrite the offending titles to carry their context.

See [`references/title-craft.md`](references/title-craft.md) for the antecedent test and worked fail/pass examples.

### 2. The antecedent test

For each title after the cover:
- What is its subject? Is it introduced here or carried from the previous title?
- For every pronoun ("they," "their," "it," "this," "those"), find the antecedent in the previous title or two. If you can't, the title presumes context that isn't on-screen — rewrite.
- For every "the X" — is X named in this title, or specified in the previous one? If neither, name it or specify it.

### 3. The classic checks

- Does a stranger get the story from titles alone?
- Is the question live by the second slide (or first, at small length)?
- Is there an unmistakable turn near the middle? *(Arc spines only — a Minto deck has no turn; check instead that the answer lands by slide 2.)*
- Does the last title land the punchline, not summarize?
- Does the final title contain or directly set up the ask? ("Open forward" endings are allowed only when the confirmed ask is reflective — never on a decision deck.)
- Can any adjacent pair be swapped without loss?

If any answer is no, rewrite before continuing. Include the numbered list at the top of the final output.

## Title length

Default: 4–10 words.

**Narrative-flow exception:** when the spoken-prose test requires connective tissue ("So…", "They told us that…", "What stalls their investment is…"), stretch to 15 words. A title that chains the argument and reads as spoken delivery at 12 words beats a tight 8-word title that leaves the chain broken.

**Hierarchy when the rules conflict:**
1. Clarity to a stranger (the stranger test)
2. Chains in spoken prose (the spoken-prose test)
3. Short (the 4–10 word default)

Past 15 words: the title has become two beats — split into two slides or compress.

## Output format

**Primary NE handoff:** body-only `ne-output.md` plus a private `ne-output-meta.md` sidecar, as defined in the integration reference. Render the reviewed body with `--mode boardroom|keynote --no-cover`; it already contains every planned visible slide. No sidecar is read by the renderer.

**Legacy/production format:** the following combined Markdown remains supported for existing decks and production copies. Never use its focal/shape frontmatter as input to a blind judge. By default the legacy renderer adds one cover; use `--no-cover` if the slides already include it. The parser supports simple one-line frontmatter values, not general YAML.

````markdown
---
title: "Deck title"
subtitle: "Optional subtitle"
mode: "keynote | boardroom"
spine: "answer-first | withheld-reveal | approved named arc"
punchline: "The one-line message, confirmed with the user"
audience: "Who the deck is for, in a few words"
ask: "What the audience should decide, do, or feel at the end"
dramatic_question: "The central tension in one sentence"
length: "small | medium | extended"
density: "high-impact | narrative | evidence | keynote-sparse | eli5"
art_direction: "one global photographic treatment appended verbatim to every image prompt (keynote)"
cover_image: "path-or-url to the cover full-bleed image (keynote, optional)"
---

# Deck title

> **Punchline:** The one-line message, confirmed with the user

## Title sequence

1. First title
2. Second title
3. ...

---

## First title

- Short supporting bullet
- Short supporting bullet

> Speaker note: required spoken line for a Keynote fragment; optional in Boardroom.

---

## Second title

- Bullet
- Bullet

---

## ...
````

**Keynote slides** add image and art-direction lines. A slide may carry a full-bleed image and its art direction; either is optional (a missing image renders as a labeled placeholder holding the art note):

````markdown
## It did

![](path-or-url-to-image.jpg)

> Layout: oneword
> Art: black slide, single word in white serif — the reveal beat. No image needed.

---

## $182 billion

> Image: photo of a trading floor, desaturated
> Layout: number
> Art: one oversized figure over a busy financial image; the number is the shock.
````

The caption box sits **top-left**; the first bullet renders as a one-line **subcaption** beneath it (give most slides one). Recognised `> Layout:` hints in Keynote mode: `fullbleed` (default — image + caption box), `oneword`, `number`, `wordless`, `motif`, `caption-dark` (dark caption box, for light images). Two text-family layouts also render straight from markdown: `triptych` (bullets `YEAR · label`, art line `three dated frames: a / b / c. Subtitle: …`) and `pair` (art line `two frames: a / b`, title optional). Omit the hint and the renderer picks heuristically (short numeric title → number; ≤2-word title → oneword; no title → wordless; else fullbleed).

`---` is the standard slide separator used by Marp, reveal.js, and Slidev, so downstream HTML/PDF conversion is straightforward. Slide bodies stay terse — bullets and fragments, not paragraphs. The title carries the meaning; the body (Boardroom) or the image (Keynote) supports.

## Producers (building a style pack)

A **producer** turns a style source into a complete, valid style pack. Every
producer — and the project adapter — MUST end with the **pack-finalization
step**: write `tokens.css` (all tokens in `REQUIRED-TOKENS.md`), `fonts.json`,
`style-notes.md`, and `pack.json`, then dry-run the render script against the
pack (or otherwise confirm `loadPack` succeeds) **before** registering or using
it. A half-built skin that fails validation is never registered.

Fidelity is **tokens + mood** ("inspired-by"), not a pixel-faithful clone. A
producer emits ~30 lines of tokens + a fonts list + a short mood note; it does
**not** author custom layouts. All packs inherit the shared neutral
`layouts.css` unless a pack deliberately ships its own (`layouts: "self"`).

1. **neutral-default** — the bundled `packs/neutral` pack. No derivation.
2. **from-verbal** — the user describes the style in prose ("clean Swiss, navy +
   warm grey, big grotesk, lots of whitespace"). Translate to font choices, a
   palette, an accent, and a light/dark mood; write the tokens.
3. **from-url** — a website or brand page. **Never WebFetch.** `curl -sL` the raw
   HTML, then `curl` each linked `<link rel=stylesheet>` href and `@import` URL
   (http(s) only, `--max-time 20`, `--max-filesize` cap, bounded redirects).
   **Refuse private/loopback/link-local/metadata hosts** (localhost, `127.*`,
   `10.*`, `172.16–31.*`, `192.168.*`, `169.254.*`, `::1`, `fc00::/7`, `fe80::/10`)
   — including after each redirect — so a supplied URL can't be used for SSRF.
   Read the CSS for `font-family` stacks, colors, and type feel; **you** author a
   clean `tokens.css` from what you read — never pipe scraped bytes into CSS, and
   reject any value containing `}`, `<`, or a newline. On fetch failure, fall
   back to asking for a verbal brief.
4. **from-reference** — a reference deck (PDF export) or screenshots the user
   likes. Read them with the **art-direct** skill's eye: pull the palette,
   best-guess the named fonts (map to the nearest Google-Fonts-available family),
   and capture the mood + light/dark feel. Write the tokens.

Producer #5 (art-direction-**generated** style via `frontend-design`) is a
deferred follow-up — not yet built.

## What this skill does not do

- Does not generate `.pptx`. For PowerPoint, hand off to a separate skill.
- Does not write long-form prose in slide bodies. Keep bodies sparse.
- Confirms unresolved narrative choices in one Fast brief or Guided discovery; honors explicit authorization to proceed without questions.
- Applies sentence craft to titles and source fidelity to all visible content and narration; supporting fragments need not become full sentences.
- Resolves explicit style, house default, project style and neutral fallback using Stage 4 precedence.
- Does not curate the public version. What to trim, what the public intro slide says, and what stays talk-only is decided by hand, before Stage 6 — never guessed.
- Does not push without an explicit human yes. The Stage 6 push gate applies every time, no exceptions.

## References

- [`references/title-craft.md`](references/title-craft.md) — primary reference for Stage 3 title craft. Rules, failure modes, rewrite examples, the read-aloud test, and the Keynote fragment register.
- [`references/keynote-devices.md`](references/keynote-devices.md) — primary reference for Keynote mode. The 16-device palette (with affordance triggers and anti-pastiche rules), the six narrative spines, and the corpus examples they come from.
- [`references/layout-catalog.md`](references/layout-catalog.md) — primary reference for Stage 4b layout promotion in a `richPromotion` pack. The generic layout family (Boardroom) plus the keynote layout family, decision tree, content cues, rewrite procedure, common mistakes. A house pack may ship its own catalog + `template.html`.
- [`references/publish-targets.md`](references/publish-targets.md) — primary reference for Stage 6. The publish-target registry (user-local `~/.claude/keynote-publish-targets.json`, never in this repo), its schema, the target resolution order, and the onboarding flow for unregistered sites.
- `scripts/keynote-render.mjs` — render script. Takes `.md` for the full pipeline; takes `.html` for re-export only (used after Stage 4b). `--style <pack-dir|name>`.
- `scripts/house-style.mjs` — the house-style registry (register/resolve a saved house pack).
- `scripts/web-optimize.mjs` — Stage 6: extract base64 images, dedupe by content hash, resize to measured rendered boxes (1.35×, never upscaling), rewrite to lazy-loaded relative assets. Prints a before/after size report.
- `scripts/web-inject.mjs` — Stage 6: inject the meta/OG/Twitter tags + canonical URL, the reading-mode hint pill, and the mobile present controls. `--url` required.
- `scripts/keynote-verify.mjs` — Stage 6 + Stage 4 QA: the assertion suite (slide-relative geometry, images, hint lifecycle, present flows; `--mobile` adds touch-context checks, `--throttle` adds a throttled first-paint budget). Works on `file://` or a live URL; exit 0 on all-pass, 1 on any FAIL, 2 on usage error.
- `packs/neutral/` — the bundled neutral style pack: `pack.json`, `tokens.css` (skin), `layouts.css` (shared structure), `fonts.json`, `style-notes.md`, and `REQUIRED-TOKENS.md` (the token contract every pack's `tokens.css` must satisfy).
