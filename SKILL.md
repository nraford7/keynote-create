---
name: keynote-create
description: Transform raw text, research notes, brain-dumps, or source material into a presentation deck. Two modes — Keynote (image-led, ~80% full-bleed photography with fragment/one-word captions, an emotional or reveal arc; for talks, pitches, TED-style) and Boardroom (text-led Minto/McKinsey action-titles rendered in a serif + accent style; every title a complete story-beat sentence). A spine menu (Minto plus six keynote-native shapes) sets the narrative structure independently of mode. Stages — distill 2-3 candidate punchlines, confirm mode + punchline + length + density, pick a spine, draft titles and self-check them, polish via prose-craft, art-direct images (Keynote), then render to an HTML deck and export to PDF via headless Chrome. Markdown is the structural deliverable; HTML and PDF are the presentation deliverables. Style comes from a swappable style pack — a bundled neutral default, your configured house style, or a bring-your-own source (a reference deck, a URL, or a verbal brief); a project-local style guide is auto-detected when present. Does NOT generate .pptx. Trigger whenever the user wants to turn source material into a deck, presentation outline, slide structure, talk outline, keynote, or pitch — even when "narrative" or "story arc" is not mentioned. Also trigger on /keynote-create, "action titles", "narrative titles", "slide-as-beat", "keynote deck", "image-led deck", "McKinsey-style deck", "Minto pyramid", or any request for titles that "read as a story".
---

# Keynote Create

Shape source material — research notes, a brain-dump, an article draft, interview transcripts, a strategy memo, a personal essay — into a presentation outline structured as a five-act dramatic arc.

The defining constraint: **every slide title is a short complete sentence that delivers one beat of the story**. Read the titles top-to-bottom and you should hear the whole narrative — no slide bodies needed.

This skill outputs three artifacts in sequence: a **markdown outline** (the structural deliverable), an **HTML deck** rendered by a **style pack** (the bundled neutral default, your configured house style, or a bring-your-own source), and a **PDF export** for review. It does not generate `.pptx`.

## Workflow

Five stages. **Do not skip the confirmation stage. Do not draft slides before the user has confirmed punchline, length, and density.**

### Stage 1 — Read and propose 2-3 candidate punchlines

**First: know the room.** If the request doesn't already name the audience and the ask, ask one line before drafting anything:

> Who is this deck for, and what should they decide, do, or feel when it ends?

The same source yields different punchlines for a board, a conference hall, or a skeptical technical review — never pick a governing thought blind. If the request already makes audience and ask clear, don't re-ask: state your reading in one line and move on.

Read the source material carefully. Identify what's at stake, what tension drives the piece, what the central insight or turn is, and what changes by the end — *for this audience*.

Then draft **2 or 3 candidate punchlines**, each a single sentence, each committing to a different stance. For each, write one short line of reasoning: why this could be the spine of the deck. Present them numbered so the user can pick, edit, or write their own.

A good punchline:
- Is one sentence, short enough to say in a single breath
- States a claim, a recommendation, or a reframing — not a topic
- Is specific (numbers, names, verbs) — not "we should improve onboarding"
- Implicitly answers a question the audience cares about

A weak punchline ("The Golden Visa is a successful programme that faces challenges") is a topic with verbs glued on. A strong one ("Open the door to permanence — and lower the cost of walking through it") commits to a stance the rest of the deck has to earn.

Present the three candidates like:

> Based on the source, here are three angles the deck could land:
> 1. **[Punchline A]** — [one-line reason]
> 2. **[Punchline B]** — [one-line reason]
> 3. **[Punchline C]** — [one-line reason]
>
> Which one is the spine? You can pick, edit, or write your own.

### Stage 2 — Confirm mode, punchline, length, density

After the user picks or edits a punchline, ask **mode**, length, and density in one turn. **Mode is the first question** — it decides the visual system, the title register, and how the rest of the stages behave.

> **Mode?**
> - **Keynote** — Image-led. ~80% full-bleed photography with a small caption box; titles are fragments, one-word beats, questions, or coined terms; the story lives in the image sequence plus your spoken delivery. For talks, pitches, TED-style, public keynotes. *(Default when the source reads as a spoken talk or a pitch.)*
> - **Boardroom** — Text-led. Every title a complete action-title sentence; serif titles + a single accent; minimal imagery. For memos-as-decks, strategy readouts, technical or skeptical audiences. *(This is the classic Minto/McKinsey deck — the skill's original behaviour, unchanged.)*
>
> **Length?**
> - **Small** — 3 to 5 slides. High-impact compression.
> - **Medium** — 5 to 15 slides. Full arc with room for nuance.
> - **Extended** — as long as it needs to be. Comprehensive treatment.
>
> **Density?**
> - **High-Impact** — Maximum compression. One punch per slide. Titles do heavy lifting; bodies near-empty.
> - **Narrative** — Default. Beats get room to land. Bodies carry supporting fragments.
> - **Evidence** — Denser supporting material. Multiple proof points per body. For skeptics and technical audiences.
> - **Keynote/sparse** — Most slides one line or one word; the body is near-empty because the image *is* the body. The default density inside Keynote mode.
> - **ELI5** — Plain language, everyday analogies, no jargon. Concrete swaps for abstractions.

**Also confirm style** (unless an explicit style source or a project style guide has already settled it — see "Style resolution precedence" in Stage 4):

> **Style?**
> - **House style** — your saved house-style pack. The first time you pick this and none is configured, I'll ask you to point me at it (a folder, a style guide, or a reference deck) or describe it; I build the pack once, register it, and reuse it silently after. *(See "House-style first-run setup" below.)*
> - **Neutral** — the bundled generic default (clean serif + grotesk, restrained accent). The fallback when nothing else is specified.
> - **Bring-your-own** — give me a source now: a reference deck / screenshots, a URL, or a one-line verbal brief. I derive a one-off pack for this deck. *(See "Producers".)*

If the source reads as a spoken talk or a pitch, propose **Keynote** as the default and say so; the user can flip to Boardroom. Default density follows mode (Keynote → Keynote/sparse; Boardroom → Narrative) unless the user picks otherwise.

**Stop and wait.** Do not proceed until mode, punchline, length, density, and style are confirmed — and restate the audience and the ask in one line as part of the confirmation ("For the board; the ask is approval of the Q3 plan"). Acknowledge edits briefly and move on — don't re-litigate.

**Mode and spine are two independent dials.** Mode (above) sets the visual system and title register. The *spine* — the narrative structure — is chosen separately in Stage 3 from a menu that includes Minto and six keynote-native shapes. Minto is the Boardroom default and is never removed; it stays on the menu in either mode.

### Stage 3 — Build the deck (with cold-read gate and prose-craft polish)

Once mode, punchline, length, and density are confirmed:

1. **Name the dramatic question.** The punchline is the answer; the dramatic question is what it answers. Surface it explicitly — it goes in the output frontmatter.

2. **Pick the spine.** Read the source, suggest the fitting spine, and name one alternative — the user picks, swaps, or combines. The menu is a default-with-suggestion, never forced. See "Spine menu" below. Boardroom defaults to Minto; Keynote gets a spine suggested from the source (Minto still available).

3. **Sketch act assignments calibrated to length and spine.** See "Act structure by length" and "Spine menu" below.

4. **Draft the title sequence first, before any slide bodies.** Numbered list.
   - **Boardroom mode:** each title is a short complete sentence — a story beat that reads top-to-bottom.
   - **Keynote mode:** titles are beats/captions — fragments, one-to-three-word punches, pivot questions, or coined terms are the preferred register. Complete sentences are *rationed* — reserved for the 3–4 lines meant to land (the turn, the thesis, the closing aphorism). The story is carried by the image sequence plus spoken delivery, not by titles read alone.

5. **Self-check the sequence.**
   - **Boardroom mode — cold-read test.** Re-read the numbered title sequence as a paragraph, *ignoring the punchline*. Write one sentence: "Reading these titles cold, this is a deck about X, arguing Y, landing on Z." Compare to the confirmed punchline. If the cold-read story diverges (different stake, different ask, different landing), rewrite and re-read. Do not move on until the cold-read story matches the punchline.
   - **Keynote mode — beat + narration read.** Read the caption sequence *with one imagined spoken line per slide*. The deck should track as a told story, not self-narrate from titles alone. The strict titles-only / spoken-prose test applies **only** to a designated chained-caption climax run (see [`references/keynote-devices.md`](references/keynote-devices.md), device #10) — not deck-wide.

6. **Prose-craft pass on titles only.** Run the title sequence through prose-craft discipline (Strunk floor + writing-tropes filter). In **Keynote mode**, tune this looser — fragments, one-word beats, and coined terms are the register, not errors; still cut hedges, AI tells, and accidental sameness. Scan for and fix:
   - **Clarity (the stranger test).** Read each title without the source in front of you. If a smart reader who hasn't read the source would ask "what does that mean?" — rewrite to plain. Compressed expert-shorthand ("Golden Visa thresholds lift the rent floor") fails this test even when it is specific, short, and active. See [`references/title-craft.md`](references/title-craft.md) for the opaque-title failure mode and rewrite examples.
   - **The flat test.** Restate each title in the dullest possible language. If the flat version is clearer than the polished one, you over-compressed — rewrite to plain.
   - "Not X, but Y" parallelism repeated across slides
   - Three-item lists that are really two ideas
   - Em-dash dramatic pauses used more than once or twice
   - Hedged verbs that pretend to commit ("may," "could potentially," "appears to")
   - Sameness across adjacent titles (same opening word, same sentence shape)
   - Meta-language commenting on the argument instead of making it ("viewed from the other side," "the same problem")
   - Initialisms unless the audience definitely knows them (ICV, capex, BPO, OOH, KPI)
   - AI tells: "lean into," "unlock," "leverage," "robust," "seamless," "in today's [adjective] landscape"

   Bodies are bullets and fragments — prose-craft does not apply to them. Titles only.

7. **Fill in supporting content.** Short bullets, fragments, optional speaker notes. Calibrate to density. In Keynote/sparse this is often nothing — the image is the body.

   **7b. Support audit — titles must be earned.** For every claim-bearing title (any title asserting a fact, number, cause, or recommendation), name its warrant: the bullet on the slide or the passage in the source that backs it. A title with no warrant gets softened, re-scoped, or cut — an assertive title the deck can't back is worse than a duller one it can. In **Evidence** density, every bullet must carry a number, a name, or a citation. Bodies also get the step-6 *scan list* (hedged verbs, AI tells, initialisms, sameness) — the scan applies to bodies; the prose-craft register rules do not, because bodies stay bullets and fragments.

8. **Keynote mode only — art-direction pass (Stage 3.5).** Once the beat sequence is set, hand the deck to the **art-direct skill**. **Choose one global treatment first:** before any per-slide prompts, fix a single photographic treatment for the whole deck — grade, era, lens/film feel, palette temperature (e.g. "muted Kodachrome, 35mm, warm dusk, soft grain") — record it as `art_direction:` in the frontmatter, and append it verbatim to every per-slide AI-image prompt. Ten independently-prompted images with no shared treatment look like ten stock sites; the global treatment is what makes them one deck. Then, for each slide, art-direct returns an image concept, photography/style direction, mood, and an AI-image prompt. Hold to the **metaphor-not-illustration** principle the corpus uses (fire = "Volitocracy"; a broken foot beside a running shoe = "Fast inaction") — the image *stands for* the abstraction, it does not depict the words literally. Record each slide's direction on a `> Art:` line (presenter-only, like a speaker note) and, when an image file exists, an `![]()` or `> Image:` line. Boardroom mode skips this step.

9. **Deploy keynote devices (Keynote mode).** Read [`references/keynote-devices.md`](references/keynote-devices.md) and select from the palette only what the content affords — a good deck uses maybe 4 of 16. Never manufacture a device the source doesn't earn (no invented coined words, no false dread, no fabricated authority quotes).

10. **Output the markdown** in the format under "Output format" below. Always include mode, punchline, dramatic question, and the titles-only list at the top.

### Stage 4 — Render, promote layouts, export

Three sub-stages: baseline render, layout promotion via `/impeccable`, re-export.

**Style resolution precedence (applies to all sub-stages).** A deck is always rendered by a **style pack** — a directory the render script consumes (`pack.json` + `tokens.css` skin + `layouts.css` structure + `fonts.json` + `style-notes.md`; see `packs/neutral/REQUIRED-TOKENS.md`). Resolve which pack, in order:

1. **Explicit style source in the request.** The user gave a reference deck / URL / verbal brief, or a `--style <path>`. Run the matching **producer** (below) or use the path. This skips the Stage 2 style question.
2. **Project style detected.** If the working directory or any parent up to `$HOME` contains `DESIGN.md`, `tokens.css`, `deck.template.html`, `style-guide.html`, or a `CLAUDE.md` naming a deck style — adopt it via the **project adapter** and tell the user. This answers the Stage 2 style question rather than being asked.
3. **Stage 2 style choice** — House style / Neutral / Bring-your-own — when neither 1 nor 2 fired.
4. **Neutral fallback** — the bundled `packs/neutral` pack when nothing above is specified.

**Project adapter.** A project `tokens.css` that already defines the canonical token set (see `REQUIRED-TOKENS.md`) is used directly as a skin over the shared neutral `layouts.css`. A project `DESIGN.md` / `deck.template.html` that is *not* a canonical pack is run through the **from-reference** or **from-verbal** producer to synthesize a pack. Either way the result is finalized to a complete, `loadPack`-valid pack before use — this preserves project-style behavior instead of silently losing it.

**House-style first-run setup.** When the user picks **House style** and none is registered: ask them to point me at it (a folder, a style guide, or a reference deck) or describe it; run the matching producer; **finalize** to a complete pack; register it with `scripts/house-style.mjs` (`registerPack`); reuse it silently on later runs. The registry and any house pack live in local config (`~/.claude/keynote-house-style.json`, `~/.claude/keynote-packs/…`) — never in this repo.

Pass the resolved pack to the render script with `--style <pack-dir|name>`. An explicit but unresolvable `--style` is a hard error, never a silent neutral fallback.

**Keynote mode changes the visual system.** When `mode: keynote` is in the frontmatter, the render script routes every slide through the keynote layout family (full-bleed image + caption box, one-word-on-black, giant-number, wordless, recurring-motif) instead of the text layouts. The serif-title default does not apply to Keynote decks — the caption box over full-bleed photography is its own system. Boardroom mode renders exactly as before. Both families re-skin from the active pack's tokens.

#### Stage 4a — Baseline render

Run the render script to produce a first-pass HTML deck and PDF. The script uses four default layouts: COVER (slide 1), CLOSING (last), VERDICT (short bold body-less middle slides), EDITORIAL TITLE (everything else).

```bash
node ~/.claude/scripts/keynote-render.mjs <deck.md> [--style <pack-dir|name>] [--brand <name>] [--sublabel <text>]
```

`--style` takes a pack directory path or a name registered in the house-style registry; omit it for the bundled neutral pack. `--brand`/`--sublabel` default from the pack's `pack.json`.

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

- **Title size stays at h2 (64px serif weight 300).** Some pack templates use h3 (46px) for certain layouts (cards, stats) by convention. Override that — in our narrative-title model, the title carries the story and must remain visually dominant. When promoting a slide, set the title as `<h2 class="h2">` even if the source template uses `<h3 class="h3">`.
- **Drop eyebrows by default.** Eyebrows ("THREE PRESSURES SIT BENEATH THE RENT LINE" in tracked uppercase) compete with the title for the eye. Only include an eyebrow if it is a quiet act-label or section breadcrumb (e.g. "Act 1 · Context"), and keep it visually small. When in doubt, omit.
- **Speaker notes do not render.** They exist in the HTML source as `<div class="speaker-note">` for the model and user to reference, but the CSS hides them from the rendered slide. They are presenter-only context. Do not place them where they could visually overflow into the content area or footer.
- **Footer stays consistent.** Every slide carries the same `<div class="footer">` with brand + page number. Don't strip it.

#### Stage 4c — Re-export

After 4b, refresh the PDF from the modified HTML:

```bash
node ~/.claude/scripts/keynote-render.mjs <deck.html>
```

The script detects the `.html` extension and skips markdown parsing and font fetching — it just spawns Chrome with the same flags to refresh the PDF in place. Open the new PDF for visual review.

If a layout looks wrong, re-run 4b on the specific slide and re-export. The decision tree in the pack's `layout-catalog.md` is advisory, not binding — taste overrides rule when they conflict.

### Stage 5 (on-demand) — "Tighter"

User can request compression passes anytime after delivery. When they say "tighter":

1. Re-confirm the punchline. Has the point drifted?
2. Section pass: any slides that could merge or be cut?
3. Per-title compression: cut filler, sharpen verbs, lose any title that doesn't earn its slide.
4. Output the tighter markdown, then re-run the render script to refresh HTML + PDF.

Repeatable until the user says stop.

## Spine menu

The **spine** is the narrative structure, chosen in Stage 3 independently of mode. The skill suggests a fitting spine plus one alternative; the user picks, swaps, or combines. **Minto is never removed** — it is the Boardroom default and stays on the menu in either mode.

- **Spine 0 — Minto / McKinsey pyramid.** *(Default in Boardroom; available in Keynote. Works at any length.)* Answer-first, grouped supporting arguments, action-titles that read top-to-bottom. An image-led deck can run on it — Oxford's 2×2 scenario matrix and Singapore's 4-stage pyramid are essentially Minto with photographs.

  **Minto discipline (spine 0 only).** Minto is a method, not a title register. When this spine is chosen:
  - **Answer by slide 2.** The punchline lands up front; the deck then defends it. No mid-deck turn — the five-act arc does not apply (see "Act structure by length").
  - **Group the middle.** The supporting slides form 2–4 named argument groups. Check MECE-lite: do any two groups make the same argument (overlap)? Is there an obvious objection no group answers (gap)?
  - **Vertical Q&A.** Each group's lead title answers the question the punchline raises ("why?" / "how?" / "why now?"); each slide inside a group answers the question its group lead raises. A title that doesn't answer the level above belongs elsewhere — or nowhere.

The six additional spines (Keynote-native, but pairable with either mode):

1. **Emotional arc** — Dread → Turn → Reframe → Hope → Answer → Exhale. Fear accumulates across sparse slides, snaps on a word or black slide ("Normal," "It did," "Hope | Fear"), reframes ("Great Transition"), reveals the answer, exhales on a wordless image or the speaker's own line. *(Needs Medium or longer — dread must accumulate over ~6+ slides.)*
2. **Reveal / misdirection** — a long setup that recontextualizes at a hinge (a nine-slide dread run revealed as history: "It did / 1895–1945"; a glut of trend-reports revealed as a pathology: "there is no list!"). *(Needs ~8+ slides — the setup IS the deck. At Small length the hinge has no room; pick another spine.)*
3. **Framework build** — a recurring motif or diagram assembled across the deck (a pyramid filled tier by tier; a 2×2 whose quadrants become the acts; "Four Lessons" planted then walked one per section). *(Needs one slide per tier/quadrant plus a planting slide — minimum ~5–6.)*
4. **Forecast cascade → implication** — chained consequences, each slide's caption grammatically completing the last, then a pivot to "what this means for *you*." *(Works from ~5 slides — each link needs its own slide.)*
5. **Teaching / method** — problem → concept → how-to steps → proof. The most content-neutral spine; the default fallback when nothing else fits. *(Works at any length.)*
6. **Scenario-parallel** — name N futures up front, walk each as a mini-arc under a repeated divider template, land on a synthesis. *(Needs roughly 2×N+2 slides for N scenarios — divider + beat each, plus setup and synthesis.)*

**Cross-cutting permissions (all spines):**
- **Spines compose** — a Framework build can open with an Emotional dread run; a Minto pyramid can be delivered in Keynote visuals.
- **Late thesis follows the spine, not the mode.** The Reveal and Emotional-arc spines may land the thesis late (past mid-deck) in *either* mode — the spine defines that contract. All other spines keep the question live by slide 2; **Minto keeps answer-first everywhere.**
- **Check spine × length before drafting.** If the chosen spine's minimum (noted above) exceeds the confirmed length, say so and offer two ways out: stretch the length, or swap to a spine that fits. Never silently compress a Reveal into 4 slides.
- If the source fits no spine cleanly, default to **Minto** (Boardroom) or **Teaching/method** (Keynote) rather than inventing structure.

## Act structure by length

The five-act arc is the same in every length — exposition, rising action, climax, falling action, resolution. What changes is how compressed each act is. **Exception — Minto (spine 0) does not use the dramatic arc:** it is answer-first (punchline by slide 2, grouped defense, a landing that returns to the answer), with no mid-deck turn. The Keynote spines map their own beats onto the rising-then-resolving shape.

### Small (3–5 slides)

The arc compresses to its skeleton. Each slide does double duty.

- **3 slides:** Setup (Acts 1+2) → Turn (Act 3) → Landing (Acts 4+5)
- **4 slides:** Setup → Tension → Turn → Landing
- **5 slides:** Exposition → Rising tension → Turn → Consequence → Resolution

At this length, the punchline often becomes the final title verbatim, or very close to it. Every slide must carry weight; there is no room for a slide that only sets up another slide.

### Medium (5–15 slides)

The standard mode. Each act gets one to three slides depending on content density.

- **5–7 slides:** one slide per act, with one act getting an extra beat
- **8–12 slides:** balanced — typically 2-3-1-2-2 or 2-2-2-2-2
- **13–15 slides:** expanded falling action and resolution; more room for evidence and implication

### Extended (as long as needed)

Use judgment based on the source. Multiple slides per act, possibly with sub-arcs within an act. Common shapes:

- A long Act 2 with several rising complications, each a distinct beat
- A two-slide climax (the finding + its mechanism)
- A long Act 4 walking through consequences sector by sector
- A multi-slide Act 5 covering opportunities, recommendations, and a closing landing

Even at long lengths, no slide is allowed to be slack. If a slide doesn't earn its title, cut it.

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

Non-negotiable. The skill collapses if titles are weak.

- **Spoken prose, not a list.** The whole sequence read aloud must sound like spoken delivery, not a glossary. Each title carries its setup with it or resolves the previous title's open thread. *(This is the primary rule. The titles-only test below enforces it.)*
- **Sentences, not labels.** "Adoption stalled in Q3" — never "Adoption" or "Q3 Numbers."
- **Length.** 4–10 words default; stretch to 15 when chaining demands it (see "Title length" below).
- **One beat per slide.** A title doing two beats becomes two slides.
- **Active voice.** "We missed the signal" beats "The signal was missed."
- **Specific over abstract.** Numbers, names, concrete nouns earn attention. (In ELI5, concrete analogies also satisfy.)
- **Plain over clever.** A smart reader who hasn't read the source must understand each title alone. Compressed expert shorthand fails the stranger test.
- **No throat-clearing.** Banish "Introduction," "Overview," "Background," "Agenda," "Conclusion," "Thank you," "Questions?"
- **Forward motion.** If two adjacent titles can swap without loss, one isn't pulling weight.
- **The last title lands.** It should resolve, commit, reframe, or open forward. Never summarize.

See [`references/title-craft.md`](references/title-craft.md) for failure modes (opaque title, disconnected sequence), rewrite examples across genres, and the antecedent test. This is the primary reference for Stage 3, step 3.

## The titles-only test (the structural check)

**This is the most important test in the skill. If you skip it, the deck fails.**

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

A single markdown document. YAML frontmatter, then punchline and titles-only list, then slides separated by `---`.

````markdown
---
title: "Deck title"
subtitle: "Optional subtitle"
mode: "keynote | boardroom"
spine: "minto | emotional | reveal | framework | cascade | teaching | scenario"
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

> Speaker note: optional context for delivery.

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

The caption box sits **top-left**; the first bullet renders as a one-line **subcaption** beneath it (give most slides one). Recognised `> Layout:` hints in Keynote mode: `fullbleed` (default — image + caption box), `oneword`, `number`, `wordless`, `motif`, `caption-dark` (dark caption box, for light images). Omit the hint and the renderer picks heuristically (short numeric title → number; ≤2-word title → oneword; no title → wordless; else fullbleed).

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
- Does not skip the confirmation stage. The mode → punchline → length → density pause is the most important part of this skill.
- Does not run prose-craft on slide bodies — titles only. (Bodies still get the step-6 hedge/AI-tell scan as part of the step-7b support audit.)
- Does not override a project's own style guide when one is present in the working directory tree.

## References

- [`references/title-craft.md`](references/title-craft.md) — primary reference for Stage 3 title craft. Rules, failure modes, rewrite examples, the read-aloud test, and the Keynote fragment register.
- [`references/keynote-devices.md`](references/keynote-devices.md) — primary reference for Keynote mode. The 16-device palette (with affordance triggers and anti-pastiche rules), the six narrative spines, and the corpus examples they come from.
- [`references/layout-catalog.md`](references/layout-catalog.md) — primary reference for Stage 4b layout promotion in a `richPromotion` pack. The generic layout family (Boardroom) plus the keynote layout family, decision tree, content cues, rewrite procedure, common mistakes. A house pack may ship its own catalog + `template.html`.
- `~/.claude/scripts/keynote-render.mjs` — render script. Takes `.md` for the full pipeline; takes `.html` for re-export only (used after Stage 4b). `--style <pack-dir|name>`.
- `~/.claude/scripts/house-style.mjs` — the house-style registry (register/resolve a saved house pack).
- `packs/neutral/` — the bundled neutral style pack: `pack.json`, `tokens.css` (skin), `layouts.css` (shared structure), `fonts.json`, `style-notes.md`, and `REQUIRED-TOKENS.md` (the token contract every pack's `tokens.css` must satisfy).
