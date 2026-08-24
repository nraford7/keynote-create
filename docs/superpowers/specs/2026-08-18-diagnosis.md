# keynote-create Diagnosis — 2026-08-18

Two independent expert reviews (argument/deck-building + graphic design) of the two-mode
skill (Keynote/Boardroom + spine menu + generic style-pack layer). Overall verdict:
strong narrative craft and a genuinely well-built style system, with soft spots in
argument grounding and in the image-led mode's fidelity. Findings below, ranked.

## Argument / communication findings

- **A1 (high) — Audience-blind.** The punchline is chosen source-inward before anyone
  asks who the deck is for or what they must decide. No `audience`/`ask` anywhere; the
  final-title rule permits "open forward" even on decision decks.
- **A2 (high) — Titles can outrun their evidence.** No step reconciles claim-bearing
  titles with slide bodies or the source. Classic action-title pathology.
- **A3 (medium) — "Minto" is a name, not a method.** No MECE/grouping check, no vertical
  Q&A; worse, the five-act arc ("turn near the middle") is applied to Minto decks, which
  contradicts answer-first structure.
- **A4 (medium) — Spine × length mismatches pass silently.** Reveal (needs long setup)
  on a 3–5 slide deck; contradictory late-thesis rules for Boardroom + Reveal.
- **A5 (low) — Bodies exempt from all QC.** In Evidence density the bodies ARE the
  persuasion, and they get no hedge/AI-tell/specificity scan.

Rated strong (keep, don't touch): the titles-only test battery (spoken-prose, antecedent,
stranger, flat), the cold-read gate, the punchline stance requirement, the affordance-gated
device palette, mode-appropriate testing.

## Graphic design findings

- **D1 (high) — Subcaption legibility hangs on a text-shadow.** The scrim fades to ~20%
  where `.kn-subcap` sits; over light images it goes marginal. Needs its own ink plate +
  auto-flip to `caption-dark` when the art note flags a light image.
- **D2 (high) — Images never embedded.** Fonts are base64-inlined; images are raw
  `url()` — remote fetch misses Chrome's 10s budget or a moved file → blank gray slide.
  The surviving half of the old fidelity bug (CSS half confirmed fixed).
- **D3 (medium) — Boardroom bullets run ~140 chars/line.** `.body-list` has no
  max-width across the 1760px content area.
- **D4 (medium) — Pack contract validates presence, not integrity.** No contrast lint;
  `richPromotion:true` + `layouts:"shared"` is legal but the shared CSS covers only the
  baseline family; hardcoded house-palette residue in `layouts.css` (subcap `#F3F1EC`,
  footer pageno rgba values).
- **D5 (medium) — No deck-level photographic treatment.** Per-slide prompts with no
  shared grade/era/lens → incoherent image set.
- **D6 (low) — No overflow detection.** `.slide{overflow:hidden}` clips silently.
- **D7 (low) — Stale fixture.** `docs/fixtures/baseline/sample-boardroom.html` still
  carries pre-generic house classes (`forge-bg`, `h-gold`).

Rated strong (keep): structure/skin split, fail-closed pack validation + test suite,
the neutral pack's typographic scale and restraint, the caption grammar + layout
auto-picker, full CSS + font embedding in `buildHtml`.

## Acceptance criteria

1. Stage 1 asks (or reads from the request) audience + ask before punchlines; both land
   in frontmatter; final-title check references the ask. (A1)
2. A support-audit step exists: claim-titles name their warrant; Evidence bullets each
   carry a datum; bodies get the hedge/AI-tell scan. (A2, A5)
3. Minto spine: answer by slide 2, grouped middle with MECE-lite + vertical Q&A checks,
   explicitly exempt from the mid-deck turn. (A3)
4. Each spine lists a minimum viable length; a mismatch with confirmed length must be
   surfaced, never silently compressed. (A4)
5. `.kn-subcap` has an ink plate; light-flagged art notes auto-pick `caption-dark`. (D1)
6. Local images base64-inline; remote images download-and-inline via the cache; failure
   → placeholder + warning, never a dead URL. (D2)
7. `.body-list` capped at 1180px. (D3)
8. `loadPack` dies on: low-contrast core token pairs, `richPromotion` without
   `layouts:"self"`, template classes with no CSS rule. Hardcoded palette residue in
   shared `layouts.css` replaced with token-derived values. (D4)
9. `art_direction:` frontmatter field + Stage 3.5 mandate to append it verbatim to every
   per-slide image prompt. (D5)
10. PDF export warns per-page on content overflow. (D6)
11. Baseline fixture regenerated without house classes. (D7)
12. `node scripts/test-render.mjs` passes with new checks for 5–8 and 10; deploy copies
    (`~/.claude/skills/keynote-create`, `~/.claude/scripts/*.mjs`) synced; pushed.
