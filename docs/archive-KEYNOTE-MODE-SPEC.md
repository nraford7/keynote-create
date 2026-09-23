# Keynote-Create — Keynote Mode Spec

Design spec for adding an **image-led "Keynote" mode** to the keynote-create skill, derived from a slide-by-slide read of 9 real Noah Raford decks (417 slides): Oxford Future of Cities, UNDP Asia Climate, UNDP Istanbul, Bangkok USAID, Bangkok Futurescaper, Etihad/Dubai Culture Museum, Singapore Cultural Institute, UoD TedX, Abu Dhabi School of Govt.

Status: **spec for review** — no skill files changed yet.

---

## 0. The problem in one line

The skill has exactly one mode — a text-first Minto/action-title deck rendered in serif titles + a single accent, generating zero images. Every one of the target keynote decks is the near-inverse: ~80% full-bleed photography, fragment/one-word captions, an emotional (not logical) arc, thesis landing late. The skill cannot currently produce a deck that looks or feels like any of them.

Fix: keep today's deck as **Boardroom mode**; add **Keynote mode** as a second, co-equal mode, and default to it whenever the source is a talk or pitch.

---

## 1. Evidence base (what the 9 decks establish)

- **Image-led, ~80% full-bleed** in all 9. Text rides in a small hard-edged **white (sometimes black) caption box**, typically a corner. Photo carries emotion + argument; words name the beat.
- **Titles are fragments/beats, not sentences.** Dominant modes: bare noun-phrase ("Warlord tax collectors"), one-to-three-word punch ("Bonkers," "Normal," "It did," "Six days," "Accelerating"), pivot questions ("What can we do about it?"), and **coined vocabulary** ("Volitocracy," "Metrostremism," "guberment," "Futurological Materialism"). Full sentences are rationed — 3–4 per deck, saved to land.
- **Emotional arc, not logical pyramid.** Recurring shape: **Dread → Turn → Reframe → Hope → Answer → Exhale.** Fear accumulates across many slides, snaps on a single word or black slide, reframes, then reveals the answer.
- **Thesis lands late** — 10–19 slides of setup is normal.
- **A repeatable multi-slide unit carries the body**: either a *repeated-headline photo essay* (one title held constant, image swaps across 6–9 slides) or a *two-beat tension pair* (force A vs force B = the paradox).
- **The spoken-prose / chained-caption device is real but LOCAL** — Noah uses grammatically-chained captions ("…which will lead to… / …but at a cost…") only for **climax runs** (Asia Climate 10–24, Istanbul 75–82, Oxford scenarios), not deck-wide.

---

## 2. Change list (exact edits)

### Change 1 — Mode fork at Stage 2 (SKILL.md)

Insert a mode question **before** length/density in Stage 2. New copy:

> **Mode?**
> - **Keynote** — Image-led. ~80% full-bleed photography, fragment/one-word captions, emotional arc. For talks, pitches, TED-style, public keynotes. *(Default when the source is a talk or pitch.)*
> - **Boardroom** — Text-led. Every title a complete sentence, serif titles + a single accent, minimal imagery. For memos-as-decks, strategy readouts, technical/skeptic audiences.

Rule: if the source reads as a spoken talk or a pitch, propose **Keynote** as the default and say so; the user can flip to Boardroom. Length + density still asked in the same turn.

Frontmatter gains `mode: keynote | boardroom`.

### Change 2 — Keynote-mode title rules (SKILL.md + title-craft.md)

Add a boxed exception: **In Keynote mode, the "every title is a complete sentence" rule does not apply.** Fragments, one-to-three-word beats, pivot questions, and coined terms are the *preferred* register. Complete sentences are rationed — reserved for the 3–4 lines meant to land (the turn, the thesis, the closing aphorism).

Replace the deck-wide **titles-only test** in Keynote mode with a **beat + narration read**: read the caption sequence *with* one spoken line per slide imagined; the deck should track as a told story, not self-narrate from titles alone. Keep the strict titles-only/spoken-prose test **only** for a designated chained-caption climax run (see Change 4, device #10).

### Change 3 — Spine menu (SKILL.md, "Act structure by length")

**Mode and spine are two independent dials.** *Mode* sets the visual system + title register (Boardroom = text/serif/sentences; Keynote = image/caption-box/fragments). *Spine* sets the narrative structure. They are chosen separately, and **Minto/McKinsey is never removed** — it stays the Boardroom default and remains a first-class option on the spine menu in either mode.

The skill reads the source, **suggests a fitting spine + names one alternative**; the user picks, swaps, or combines. The menu is a *default-with-suggestion*, not a forced choice.

**Spine 0 — Minto / McKinsey pyramid** *(default in Boardroom; available in Keynote too).* Answer-first, grouped supporting arguments, action-titles that read top-to-bottom. This is today's skill, unchanged. An image-led deck can run on it — Oxford's 2×2 and Singapore's pyramid are essentially Minto with photographs.

The six additional spines the corpus shows (all optional, Keynote-native but pairable with either mode):

1. **Emotional arc** — Dread → Turn → Reframe → Hope → Answer → Exhale. Snaps on a word or black slide ("Normal," "It did," "Hope | Fear"). *(Etihad, Abu Dhabi.)*
2. **Reveal / misdirection** — a long setup that recontextualizes at a hinge. *(TedX "It did / 1895–1945"; Bangkok "there is no list!")*
3. **Framework build** — a recurring motif/diagram assembled across the deck. *(Singapore pyramid, Oxford 2×2, "Four Lessons.")*
4. **Forecast cascade → implication** — chained consequences, then "what this means for *you*." *(Asia Climate, Istanbul climax.)*
5. **Teaching / method** — problem → concept → how-to steps → proof. *(Futurescaper, Istanbul.)*
6. **Scenario-parallel** — name N futures, walk each as a mini-arc, land on synthesis. *(Oxford.)*

(First-draft correction: the emotional arc is **not** "the" keynote spine — only ~3 of the 9 corpus decks use it. It is one card among seven, Minto included.)

Cross-cutting permissions for **all** spines:
- **Spines compose** — a Framework build can open with an Emotional dread run (TedX does both); a Minto pyramid can be delivered in Keynote visuals.
- In **Keynote mode only**, the thesis may land late (slide 10–19); the "question live by slide 2" rule relaxes. **Boardroom + Minto keeps answer-first.**
- If the source fits no spine cleanly, default to **Minto** (the most content-neutral) rather than inventing structure.

### Change 4 — New reference: `references/keynote-devices.md`

A deployable catalogue of the signature moves. **These are content-agnostic rhetorical/visual techniques, not futures/policy topics** — they were extracted from Noah's talks but depend on properties of the *argument*, not the subject. The reference opens with four framing rules so they generalize to any source (a SaaS pitch, a research readout, a personal talk):

- **Palette, not checklist.** Select only what the content affords. A good deck uses maybe 4 of 16. Using all 16 is pastiche.
- **Affordance triggers.** Each device carries an "affords when…" condition tied to a content property — *has a shocking number?* → giant-number; *has a paradox?* → two-beat pair; *has a hinge that recontextualizes?* → reveal; *has a repeated structure?* → anaphora / motif. The model matches devices to what the source actually contains.
- **Anti-pastiche rule.** Never manufacture what the source lacks. No invented coined words for content with no new concept, no false dread, no fabricated authority quotes. Devices serve the argument; drama the content doesn't hold reads as parody.
- **Universal grammar vs. signature flavor.** The *structural grammar* — image-led, caption box, beat titles, spine menu, base layouts — transfers to any deck and is **on by default**. The *signature tics* — coined vocabulary (#12), borrowed-authority stacks (#13), fear-of-the-future framing — are **opt-in flavor, off by default**, offered only when the source and audience clearly warrant them. Dry/technical input that affords few devices still renders on the base layouts or leans hybrid toward Boardroom.

Device catalogue (each entry: 1-line *what* · *affords when* · 1 verbatim corpus example):

1. **White caption box** over full-bleed photo — the house template.
2. **Go-to-black breath slide** — pure black or one white line, between dense runs and before reveals.
3. **Giant-number shock** — one oversized figure on an image ("$182 billion," "800," "114,000 books").
4. **Reused-photo run** — hold one image, advance the text across slides.
5. **Repeated-headline photo essay** — hold one title, swap the image across 6–9 slides (body engine A).
6. **Two-beat tension pair** — force A then force B on consecutive slides; the paradox is the gap (body engine B).
7. **One-word turn** — long setup collapses to a single word.
8. **Wordless slide** — image the speaker talks over; no caption.
9. **Recurring visual motif / diagram** — a spine object reused as a build (the pyramid, the 2×2 matrix, the "Outline" divider lit in red).
10. **Chained-caption climax** — captions grammatically complete across slides ("…which will lead to… / …but at a cost…"). *This is where the strict spoken-prose test applies.*
11. **Bookend** — open and close on the same image family.
12. **Coined vocabulary** — invent 3–6 sticky terms as the deck's takeaway.
13. **Borrowed-authority quote stack** — sequence quotes (thinker → local leader).
14. **Anaphora section engine** — repeat a stem across a run ("…brought to you by government").
15. **Humor as release valve** — one comic image at the pivot.
16. **Speaker aphorism close** — end on the presenter's own line, not "Thank you."

Each device: 1-line *what*, its *affords-when* trigger, 1 verbatim example from the corpus.

### Change 5 — Image pipeline via art-direct (SKILL.md Stage 4, + render script)

Keynote mode is image-first, so imagery is generated, not omitted.

- **Stage 3.5 (new): art-direction pass.** After the beat sequence is confirmed, hand the deck to the **art-direct skill**. For each slide it returns: image concept, photography/style direction, mood, and an AI-image prompt. The metaphor-not-illustration principle applies (fire = Volitocracy, broken foot + running shoe = Fast Inaction) — the image stands for the abstraction, it doesn't depict the words.
- Store per-slide art direction in the markdown as a `> Art:` line (presenter-only, like speaker notes).
- **Render layouts (keynote-render.mjs / Stage 4b) gain a keynote layout family:** `FULL-BLEED-PHOTO + caption box`, `ONE-WORD-ON-BLACK`, `GIANT-NUMBER`, `WORDLESS`, `RECURRING-MOTIF`. Caption box = hard-edged solid rectangle, corner-anchored, high-contrast — not serif chrome.
- Images: slots accept a generated/sourced image; until filled, render a labeled placeholder carrying the art-direction caption.
- Drop the serif-title default in Keynote mode. Boardroom mode keeps the default style unchanged.

### Change 6 — "Keynote/sparse" density (SKILL.md density table)

Add a density row: **Keynote/sparse** — most slides one line or one word; body near-empty; the image is the body. Becomes the default density inside Keynote mode.

---

## 3. What stays unchanged

- **Boardroom mode = today's skill, verbatim.** Minto action-titles, titles-only test, serif display + accent, sparse text bodies. Nothing removed.
- Stage 1 (2–3 candidate punchlines) and the confirmation gate.
- prose-craft pass on titles (applies to both modes; just tuned looser in Keynote for fragments).
- Markdown-as-structural-deliverable; HTML + PDF as presentation deliverables; no .pptx.

---

## 4. Build order (once spec approved)

1. SKILL.md: mode fork (Stage 2), emotional-arc spine, keynote density row, Keynote title-rule exception, Stage 3.5 art-direction pass, frontmatter `mode`.
2. `references/keynote-devices.md`: write the 16-device catalogue with corpus examples.
3. `references/title-craft.md`: add the Keynote fragment register + the "spoken-prose test is climax-local" note.
4. keynote-render.mjs + layout-catalog.md: add the 5 keynote layouts + caption-box CSS; wire the placeholder-image slot.
5. Smoke test: run one of the 9 source talks back through the skill in Keynote mode; compare beat map + look against the original.

---

## 5. Open questions for review

- Should Keynote mode ever *co-exist* with serif type (e.g. serif captions), or is the hard caption box always sans? (Corpus is mixed serif/sans; leaning: let art-direct pick per deck.)
- Placeholder vs. fully-generated images at first render — art-direct auto-brief is chosen; confirm whether to also auto-generate images or stop at prompts.
- Does the smoke-test comparison belong in the skill as a regression fixture?
