# Deck Layouts — Catalog & Decision Table

This catalog maps the 19 layouts in `the active pack's template.html` to the content shapes they fit. Use it in Stage 4b (Layout Promotion) to upgrade each slide from the baseline editorial layout to a layout that earns the content.

> **Boardroom mode only.** The 19 layouts below are the generic text-deck system used in **Boardroom mode**. **Keynote mode** uses a separate image-led family — see "Keynote layout family" at the bottom of this file. In Keynote mode the render script routes every slide through that family automatically; you do not promote to these layouts.

**Source of truth:** Always read `the active pack's template.html` for the exact HTML scaffolding. This file is the picker.

## The 19 layouts

| # | Layout | Theme | Use when |
|---|---|---|---|
| 1 | COVER | dark | First slide of every deck. Wordmark + subtitle + meta block over the full-bleed gradient. |
| 2 | SECTION DIVIDER | dark | Transition between major acts. Watermark numeral, single phrase, accent rule. |
| 3 | EDITORIAL TITLE | light | Default for declarative middle slides. Big `h1` weight 300, title-rule, optional lead. |
| 4 | VERDICT | dark | One number, one claim. ≤6-word title, no body. `h-verdict` weight 700. |
| 5 | THREE CARDS | light | Three named buckets (e.g. Cut / Hold / Bulk). Each card has a `card-label` and 2-4 short items. |
| 6 | TABLE + BADGES | light | Comparison rows (sector × dimension × posture). Strong/Moderate/Weak badges if applicable. |
| 7 | STATS | light | 2-3 standout numbers, each with one-line label. `.stat` blocks with accent top rule. |
| 8 | NUMBERED LIST | light | 4+ ordered steps (playbook, sequence). Large accent numerals, single-sentence steps. |
| 9 | PULL QUOTE / OBSERVATION | dark | An italic insight set apart by accent-faded rules. Title doubles as quote. |
| 10 | FULL-BLEED IMAGE (full-bleed) | dark | A single image moment. Image breathes; title and caption sit left under the gradient. |
| 11 | CLOSING | dark | Last slide. brand wordmark, title-rule, punchline in `h-accent`, contact line. |
| 12 | TEXT-DENSE 2-COL | light | Multi-paragraph argument. `lead` on top, two body columns underneath. |
| 13 | SPLIT (text + inset image) | light | Argument plus supporting image. Half text, half captioned figure. |
| 14 | FIGURE CARDS (3 captioned) | light | Three comparable cases with images (e.g. 1973 / 2008 / 2020). |
| 15 | HALF-BLEED IMAGE | dark | Image holds one slide edge; argument takes the other half. |
| 16 | THREE-COL TEXT | light | Three lenses on the same topic (e.g. Capital / Cost / Tempo). `col-eyebrow` + `col-title` + body per column. |
| 17 | 1/3 + 2/3 TEXT | light | Bold statement on the left, elaboration on the right. |
| 18 | 1/3 TEXT + 2/3 IMAGE | light | When the picture does the persuading and the words only frame. |
| 19 | THREE-COL BODY | light | Long sequential argument across three columns. Use when text density justifies it. |

## Decision tree

Walk this in order, top to bottom. Stop at the first match.

1. **Slide index 0** → **COVER** (1)
2. **Last slide** AND **title matches/restates the punchline** → **CLOSING** (11)
3. **Title is short (≤6 words)** AND **no bullets** AND **declarative claim with a number, percentage, or absolute** → **VERDICT** (4)
4. **Title is a direct quote** (starts/ends with quotation marks) OR **slide explicitly marked as observation** → **PULL QUOTE** (9)
5. **Bullets are 2-3 standout numbers** (%, $, ×, K, M, B) **with one-line labels each** → **STATS** (7)
6. **Bullets form a comparison row** (multiple columns of data per item) → **TABLE + BADGES** (6)
7. **Bullets read as 3 named buckets** with labels like "First / Second / Third", or domain labels (Cut / Hold / Bulk; Capital / Cost / Tempo) → **THREE CARDS** (5) or **THREE-COL TEXT** (16)
   - Use **THREE CARDS** when each bucket has 2-4 sub-items
   - Use **THREE-COL TEXT** when each bucket has a single paragraph of body
8. **Bullets read as 4+ ordered steps** (verbs first: "Map / Cut / Hold / Bulk") → **NUMBERED LIST** (8)
9. **Body is multiple paragraphs of argument (>60 words)** → **TEXT-DENSE 2-COL** (12) or **TEXT-DENSE 3-COL** (19)
   - Use **2-COL** for medium density (~150-250 words)
   - Use **3-COL** when content runs longer or breaks into 6+ discrete moves
10. **Slide is a transition between acts** (Act 1→2, Act 2→3, etc.) AND **content is a single phrase** → **SECTION DIVIDER** (2)
11. **Slide pairs an argument with a visual** that already exists in the source → **SPLIT** (13) or **1/3 + 2/3 IMAGE** (18) or **HALF-BLEED** (15)
12. **Slide is a single bold statement with one paragraph of elaboration** → **1/3 + 2/3 TEXT** (17)
13. **Three comparable visual cases** (e.g. shocks across decades, sectors across regions) → **FIGURE CARDS** (14)
14. **Default** → **EDITORIAL TITLE** (3) with the body bullets rendered as a list

## Light vs dark, used as rhythm

The layout family alternates. Don't put more than 3 light slides in a row, or more than 2 dark slides in a row. Use dark layouts (VERDICT, PULL QUOTE, FULL-BLEED IMAGE, SECTION DIVIDER, HALF-BLEED) as punctuation between light editorial slides.

A small deck (3-5 slides) often reads best as: dark cover → light → dark verdict OR pull quote → light → dark closing.

A medium deck (8-12) typically wants 2-3 dark moments interleaved.

## Content cues — what to look for

| Cue | Likely layout |
|---|---|
| Numeral in title (`80% lose position`, `49% froze hiring`) | VERDICT |
| Verbatim quote (`"The firms that thrive..."`) | PULL QUOTE |
| List of bullets each with own metric (`49% froze X`, `0% playing offense`, `6× historic gain`) | STATS |
| 3 buckets with sub-items each | THREE CARDS |
| 3 buckets each one paragraph | THREE-COL TEXT |
| Ordered steps with verbs first | NUMBERED LIST |
| Table-shaped raw content (`A: x \| y \| z`) | TABLE |
| Multi-paragraph reasoning in source | TEXT-DENSE |
| Image cue in source (`[image: full-bleed floor]`, `Photo of...`) | SPLIT / HALF-BLEED / FULL-BLEED IMAGE / FIGURE CARDS |

## Rewrite procedure

Stage 4b runs after the baseline render. For each slide in the generated HTML:

1. **Classify** using the decision tree.
2. **Read** the corresponding template slide markup in `the active pack's template.html`.
3. **Rewrite** the slide's `<div class="slide-wrap"><div class="slide ...">…</div></div>` block in place, preserving the footer's brand + pageno.
4. **Validate** div balance after every rewrite — the layout docs warn that imbalanced divs break the deck silently. After all rewrites, count `<div` and `</div>` in the file; they must match.
5. **Save** the modified HTML.
6. **Re-export** PDF: `node ~/.claude/scripts/keynote-render.mjs <path-to-edited.html>`.

## Title size and eyebrows — non-negotiable for promotion

Some pack templates use `h3` (46px serif weight 400) for some layouts (cards at slide 5, stats at slide 7) by convention. **Override that during promotion.** In the narrative-title model the title carries the story, so it must stay visually dominant.

- **Always use `<h2 class="h2">` for the slide title** when promoting from baseline, regardless of what the template's source slide uses. The h2 (64px weight 300) reads as the story beat; h3 (46px weight 400) reads as a section header.
- **Drop eyebrows by default.** Eyebrows render as tracked-uppercase 13px accent-dark text. They compete with the title for the eye, especially with `text-transform:uppercase` making them look shouty. Some templates use eyebrows because the template's slides need section context — promoted narrative slides don't. Omit unless the eyebrow is acting as a quiet act-label breadcrumb (e.g. "Act 1 · Context") and the deck has clearly demarcated acts.
- **When the layout's structure requires a label** (a card's `card-label`, a stat's `stat-label`, a column's `col-eyebrow`), keep it — those are structural, not decorative. The constraint is on the slide-level eyebrow above the title.

## Speaker notes never render on the slide

The render script's CSS hides `<div class="speaker-note">` with `display:none`. Speaker notes exist in the HTML source as model/user context (the conversation can reference them, the user can read them), but they do not appear in the PDF. Treat them as presenter notes that will surface in a future presenter mode — never place them inside the visible content area or position them visibly absolute on the slide.

## Common rewrite mistakes — avoid

- **Leaving the wrong theme class.** A VERDICT slide needs `.dk`, not `.lt`. Check after every rewrite.
- **Downgrading the title to h3.** Even when copying scaffolding from a template's cards or stats slides, the title stays at h2.
- **Adding a competing eyebrow above the title.** Drop it unless it earns its space as a breadcrumb.
- **Rendering speaker notes visibly.** The CSS hides them by default — do not override that.
- **Over-using dark slides.** They're punctuation, not the body.
- **Forgetting the title-rule.** Most layouts include `<div class="title-rule"></div>` — the accent detail that gives the type hierarchy its anchor.
- **Putting body text in accent.** `--accent-dark` and `--accent` are heading and accent colours only. Body type fails WCAG AA in accent.
- **Stripping the footer.** Every slide keeps `<div class="footer">…<span class="pageno">…</span></div>` with the correct page number.
- **Over-using card layouts.** Three Cards is for true 3-bucket frameworks. If you have 4 buckets, it's a numbered list. If you have 2, it's 1/3 + 2/3.

## Keynote layout family (Keynote mode)

When the deck frontmatter carries `mode: keynote`, the render script ignores the text layouts and routes every slide through this image-led family instead. The visual grammar is a **full-bleed image with a hard-edged caption box anchored top-left**, and a **one-line subcaption beneath it** — the house style of the corpus decks. There is no forced light/dark alternation and no accent-serif chrome; the images carry the rhythm. A top scrim darkens the upper third so the caption and subcaption read over any image.

| Layout | `> Layout:` hint | Renders as | Use when |
|---|---|---|---|
| FULL-BLEED + caption | `fullbleed` *(default)* | Full-bleed image; title in a solid white caption box, **top-left**; the first bullet becomes a one-line subcaption directly beneath | The default keynote slide — one image, one beat, one line of elaboration |
| CAPTION-DARK | `caption-dark` | Same, but a black caption box (white text) | When the image is light and a white box would vanish |
| ONE-WORD-ON-BLACK | `oneword` | Black slide, one word centered in large serif | The one-word turn ("Normal," "It did," "Accelerating") |
| GIANT-NUMBER | `number` | One oversized figure, centered; over the image (with scrim) or on black | A single shocking statistic ("$182 billion," "800") |
| WORDLESS | `wordless` | Full-bleed image, no caption at all | A pure emotional/atmospheric beat the speaker talks over |
| RECURRING-MOTIF | `motif` | Full-bleed diagram/motif image + caption box | A returning spine object (pyramid, 2×2, "Outline" divider) — supply the motif as an image |

**Picker (when no `> Layout:` hint is given):** short title containing a prominent numeral (≤3 words) → GIANT-NUMBER; ≤2-word title, no bullets → ONE-WORD-ON-BLACK; no title → WORDLESS; otherwise FULL-BLEED + caption.

**Subcaption (standard).** Give most slides a single short bullet — it renders as a one-line subcaption under the caption box that *elaborates* the beat (like slide 12 of the corpus close). Keep it to one line (~14 words); a second bullet is joined with a middot. This is the default, not an option: a keynote slide is usually caption + subcaption. Leave the body empty only for deliberate wordless/one-word beats.

**Images.** Each slide takes its image from a markdown `![](src)` line or a `> Image: src` line. When no image is present, the slide renders a **labeled placeholder** (a hatched panel) carrying the slide's `> Art:` direction, so an image-less draft still exports and shows exactly what art each slide needs. Fill the placeholders by adding image lines and re-exporting.

**Cover.** The keynote cover is a full-bleed `cover_image` (from frontmatter) with the title, subtitle, and brand/meta in the **top-left** over a soft top scrim. Missing `cover_image` renders the placeholder.

**Footer.** Keynote slides carry a single small page number, lower-right, low-opacity white — not the brand footer. Wordless and one-word slides keep it too (it stays out of the way).

**Keynote rhythm rules:**
- Don't run more than ~3 dense caption slides without a WORDLESS or ONE-WORD breath.
- A GIANT-NUMBER or ONE-WORD slide lands hardest right after a busy run — use them as punctuation, not filler.
- Reserve the chained-caption climax (captions completing across slides) for one act; don't chain the whole deck.
- One idea can span many slides via a repeated caption + changing image (the photo-essay engine) — this is expected, not repetition to cut.
