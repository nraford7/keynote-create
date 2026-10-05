# Keynote Create technical guide

For installation and everyday use, start with the [README](../README.md).

## Repository layout

| Path | Purpose |
|---|---|
| `vendor/narrative-engine/` | Pinned NE runtime references and prompts, with source hashes and portable path adaptations. |
| `references/narrative-engine-integration.md` | Ownership, compiled deck contract, agent isolation, repair and rendering handoff. |
| `scripts/narrative-sync.mjs` | Offline bundle integrity check and explicit updates from an upstream checkout. |
| `SKILL.md` | The skill definition (frontmatter + workflow). |
| `vendor/narrative-engine/deck-title-craft.md` | Title-craft rules and failure modes (NE's canonical title guide, vendored). |
| `references/keynote-devices.md` | The 16-device Keynote palette (affordance triggers + anti-pastiche rules) and the six spines. |
| `references/layout-catalog.md` | The generic Boardroom layouts plus the Keynote layout family. |
| `scripts/keynote-render.mjs` | Node renderer: markdown → self-contained HTML → 1920×1080 PDF via headless Chrome, fonts base64-embedded. Handles both modes; consumes a style pack. |
| `scripts/house-style.mjs` | House-style registry (register/resolve a saved house pack). Imported by the renderer. |
| `scripts/keynote-check.mjs` | Layout guard: screenshots each slide, reports anything leaving the 1920×1080 frame, crossing the footer band, or overlapping. |
| `scripts/web-optimize.mjs` | Web publish step 1: extracts base64 images to asset files (content-deduped), resizes them to their measured rendered boxes, adds lazy-loading. |
| `scripts/web-inject.mjs` | Web publish step 2: injects meta/OG/Twitter tags + canonical URL, the reading-mode hint, and mobile present controls. Idempotent. |
| `scripts/keynote-verify.mjs` | Publish assertion suite: slide-relative geometry, images, hint, present flow, mobile touch flows, throttled FCP — works on a local file or a live URL. |
| `scripts/lib/` | Shared helpers: playwright resolution, image extraction/measurement, the site-additions CSS/JS templates. |
| `packs/neutral/` | The bundled neutral style pack (the default) + `REQUIRED-TOKENS.md` token contract. |
| `references/publish-targets.md` | The publish-target registry schema and onboarding flow (the registry itself is user-local, never in this repo). |
| `docs/fixtures/` | Test fixtures: `sample-public.html` (self-contained publish-stage fixture) + its generator, plus sample Boardroom/Keynote decks. |
| `docs/archive-KEYNOTE-MODE-SPEC.md` | Retired design spec for the Keynote-mode addition (provenance only; superseded by SKILL.md). |

## Deployment

Install the whole repository using the [README instructions](../README.md#install). Keep `scripts/`, `references/`, `packs/`, and `vendor/` beside `SKILL.md`. Run commands below from that root. Local style and publishing registries remain outside the repo.

For a Git-based installation, update with `git pull --ff-only` from the installed directory, then run `node scripts/narrative-sync.mjs --check`. If the install is a copied folder or symlink, update its source checkout and synchronize the complete folder; preserve local customizations first. Do not replace a folder blindly or copy only SKILL.md.

## Security & threat model

This is a **local, single-user CLI**. Style packs are chosen by the person
running it. The renderer applies defense-in-depth against a naive malicious
pack — it rejects `</style>`/`<script>` breakouts in pack CSS, sanitises font
family/weight/style and image `url()` values, confines `local` font files to
the pack directory (realpath, no symlink/`../` escape), bounds remote font
fetches (timeout, hard deadline across redirects, 8 MB cap, redirect cap,
http(s) only, face cap), and blocks literal loopback/private/link-local/metadata
IPs for `url`-source fonts.

It is **not** a sandbox against a determined hostile pack: it does not resolve
DNS names to check the target address (a hostname pointing at a private IP is
not caught), and headless Chrome still fetches a pack's image `url()`s during
PDF export outside these guards. Treat an untrusted third-party pack the way you
would any untrusted code you run locally. Producers that fetch from a URL must
apply the same private-host refusal (see SKILL.md → Producers → from-url).

## Rendering a deck

```sh
node scripts/keynote-render.mjs <deck.md>        # markdown → HTML + PDF
node scripts/keynote-render.mjs <deck.html>      # re-export PDF from edited HTML
# NE body-only output; register is supplied separately and all planned slides already exist:
node scripts/keynote-render.mjs <ne-output.md> --mode keynote --no-cover
```

Keynote decks add per-slide `![](img)` / `> Image:`, `> Art:`, and `> Layout:` lines; a missing image renders a labelled placeholder carrying the art direction, so an image-less draft still exports.

## Publishing a deck to the web

Stages 1–5 produce the talk artifact; **Stage 6** (see `SKILL.md`) publishes a **human-curated public copy** to a registered website target. Stage 6 is mechanical only — what to trim for the public version is human judgment done *before* Stage 6, and the push gate is an explicit human yes, every time. Three scripts carry it:

```sh
# 1. externalize images: base64 → asset files, content-deduped, resized to
#    their measured rendered boxes, lazy-loaded
node scripts/web-optimize.mjs <deck.html> [--out <dir>]

# 2. inject meta/OG/Twitter + canonical URL, the reading-mode hint, and
#    mobile present controls (idempotent — safe to re-run)
node scripts/web-inject.mjs <deck.html> --url <canonical-url> [--description <text>]

# 3. assert: slide-relative geometry, images, hint, present flow, mobile
#    touch flows, throttled first paint — local file or live URL
node scripts/keynote-verify.mjs <deck.html | URL> [--mobile] [--throttle]
```

`keynote-verify` doubles as the Stage 4 QA discipline (its navigation subset runs after every slide change) and re-runs against the **live URL** after deploy — exit 0 before a publish is called done. SKIPPED lines are expected for decks without a show-mode handler; only a FAIL fails a run.

**Publish targets are user-local, never in this repo.** The registry lives at `~/.claude/keynote-publish-targets.json` — same pattern as the house-style registry (`~/.claude/keynote-house-style.json`): each target is a concrete profile (repo, deck path, hub page, build, deploy), resolved as explicit `--target` > registry default > onboarding flow > **hard error, never a silent guess**. Schema and onboarding: [`references/publish-targets.md`](../references/publish-targets.md).

**Talk kit (opt-in, Stage 3.6).** When a deck fronts a live talk, the skill can also produce a talk kit next to the deck: speaker notes — per-slide spoken prose written for ~120 wpm delivery, with cumulative timings and a source-cautions block kept strictly separate from the spoken copy — plus a one-page worksheet, only when the deck contains activity slides.

## Keynote export

`scripts/keynote-export.mjs` turns a rendered HTML deck into a native, editable Apple Keynote document (SKILL.md Stage 4d). macOS only.

```sh
node scripts/keynote-export.mjs <deck.html> [--out deck.key] [--force] [--slides 1,3-5] [--open] [--verify] [--keep-temp]
```

**Pipeline.** Playwright opens the deck in a 2000×1200 window at 2× pixel density and reads each 1920×1080 slide in slide pixels. Every video is frozen first, on its poster or on its first frame; a video that never loads is reported and may come out blank. `scripts/lib/keynote-extract.mjs` reads each slide into a JSON slide model plus PNG layers. `scripts/lib/keynote-fonts.mjs` maps each CSS font stack to an installed PostScript name (one JXA call to NSFontManager). `scripts/lib/keynote-applescript.mjs` turns the model into one AppleScript program. `osascript` runs it. Keynote makes a new document, builds the slides, saves to a temporary `.key` and closes it. The CLI moves the temporary file to `--out`.

**Layers per slide, bottom to top.**

1. Plate: one 2× PNG of the slide with all text hidden and all media, tables and charts removed. Decoration lives here, because Keynote's scripting cannot draw coloured shapes.
2. Media: one PNG per image, SVG, canvas or video. Anything that paints above a media element (found with `elementsFromPoint`) is captured into that PNG and removed from the plate. Media that share one overlay become a single PNG, so they are no longer separate pictures in Keynote. Overlapping media keep their paint order.
3. Native tables, from the HTML table cells, with per-cell font, size, colour, background and alignment.
4. Native charts, from a `data-kn-chart` attribute holding JSON such as `{"type":"bar","rows":["2021","2026"],"columns":["North","South"],"data":[[31,45],[56,49]]}`. `rows` and `columns` must not be empty, and `data` needs one array per row with one number per column. Types: `bar`, `line`, `area`, `pie`, `stacked_bar`, `horizontal_bar`. The renderer does not add the attribute; anything without a valid one stays an image.
5. Text items with styled runs: one per text block and one per list item, with a soft line break (U+2028) wherever the HTML wraps, so Keynote cannot re-wrap them. Keynote's fixed line spacing (about 1.2×) makes a tight heading taller; the box keeps its top when there is room below, keeps its bottom when there is room above, and only when neither fits (or for centred or right-aligned text that wraps) becomes one item per line. Text in a substituted font gets room to the slide's right edge. A list marker outside the text, or an absolutely placed `li::before`, becomes its own small text item.

Speaker notes (`.speaker-note`) become presenter notes. Translucent text and tinted table cells get the colour a viewer sees, sampled from the rendered slide.

**Model.** The header comment of `scripts/lib/keynote-extract.mjs` describes the layers. In short, a deck is `{ width, height, slides, warnings }`. Each slide has `index` (its place in the source deck), `plate.path`, `media` (`path, x, y, w, h, kind`), `tables` (`rows` of cell text plus a matching `styles` grid), `charts` (`type, rows, columns, data` plus a box), `texts` (a box, a `source` of `block`, `li`, `line` or `marker`, and `runs` of `text, font, weight, italic, size, color, alpha`) and `notes`. Every model value is validated before it reaches AppleScript. Strings are escaped, numbers must be finite, colours must be three numbers, and file paths with line breaks are refused.

**Keynote rules learned from probes (2026-10-05).** Hold the reference from `make new document`; never use `front document`. Set a text item's style before its position. Character ranges count Unicode code points. Wait for a large image to exist before styling it. Set a table cell's format to text before its value, so `+3` stays `+3`. Keynote refuses tables under two rows or two columns.

**Verify.** `--verify` opens the built `.key` in Keynote, exports a PDF, and compares each slide with the HTML in two ways. Each visible word on the slide must sit within 24 px of its HTML position at 1920 wide (`pdftotext -bbox`). The whole-slide greyscale difference at 480 px wide must be at most 8%. The check leaves out speaker notes, text inside charts and SVG drawings, and the chart areas of the image comparison, so charts need a look by eye. Words in a substituted font may move sideways but must stay on their line. Words in a box kept whole despite Keynote's line spacing get that drift as extra tolerance. Letter-spaced words get extra tolerance for the spacing Keynote drops. A contact sheet `<name>.verify.png` next to the `.key` shows HTML and Keynote side by side.

**Output rules.** `--out` must end in `.key`. An existing `--out` is refused without `--force` (exit 2, before Keynote starts), and a file that appears there during the run is not replaced. With `--force`, the old file stays as a backup until the new one is in place. A failed `--verify` keeps the build under the first free name (`<name>.unverified.key`, `<name>.unverified-2.key`, …) and leaves `--out` untouched (exit 1). After an AppleScript timeout or Ctrl-C (exit 130), Keynote may hold an untitled export document; close it without saving.

**Limits.** No chart styling, text alignment, line spacing, letter-spacing, text shadows, table borders or animations. Decoration is flattened. Videos become still frames. Fonts that are not installed fall back along the CSS stack, then to Helvetica Neue, with one warning per font.

**Tests.**

```sh
npm test               # unit: fonts, generator, comparison, CLI with stubbed Keynote
npm run test:browser   # extraction on docs/fixtures/sample-export.html, the baseline decks and an edge deck
npm run test:keynote   # live round trip through Keynote (macOS + Keynote + Poppler; skipped elsewhere)
```

`test:keynote` exports the fixture and both baseline decks with `--verify`, then reads every `.key` back. It checks the font, size and colour of every character, item heights (a one-line item must not wrap), notes, table cells, and chart data through Keynote's own PowerPoint export. It keeps a sentinel Keynote document open; its id, slides and text must come through unchanged, and no other document may appear or disappear. Regenerate the fixture with `node docs/fixtures/gen-export-fixture.mjs`; it needs ImageMagick (`magick`) and `ffmpeg` with VP9 (see `docs/fixtures/README.md`).

## Requirements

- Node.js (no mandatory npm dependencies — playwright is an optional peer, see `package.json`).
- Google Chrome at `/Applications/Google Chrome.app` for PDF export.
- Network for Google Fonts CSS resolution and any uncached font files. Font files are cached in `~/.claude/cache/fonts/`; CSS resolution still uses the network. A style pack with local font files avoids this dependency.
- For the Keynote export: macOS with Keynote in `/Applications`, the Playwright install below, and Poppler (`brew install poppler`) for `--verify`.
- For the publish scripts: a Playwright install, resolved via the `PLAYWRIGHT_MODULE` env var (point it at an existing `node_modules/playwright/index.mjs`) or a plain `npm i playwright`; plus ImageMagick 7 (`magick`) for `web-optimize`'s resizing.

## Validation and upstream updates

```sh
npm test                         # offline handoff, sync integrity and web injection tests
npm run test:render               # full legacy renderer suite; font downloads on first run
npm run test:browser              # Playwright + ImageMagick publish suites
node scripts/narrative-sync.mjs --check --source /path/to/Narrative-Engine
# Explicit update after reviewing a newer upstream commit:
node scripts/narrative-sync.mjs --update --source /path/to/Narrative-Engine --revision <commit>
```

Tests validate scripts and renderer contracts; they do not certify LLM judgments. The narrative gates are agent procedures. The sync checker verifies the pinned bytes, not upstream freshness. Hidden presenter notes remain in HTML source; remove private content from a public copy before publishing.


## Production checks and saved layouts

The current workflow and ownership contract live in `SKILL.md` and [visual production](../references/visual-production.md). Project style is resolved by the orchestrator before a house default, and passed explicitly to the renderer. The bare renderer resolves only an explicit style, registered default or neutral fallback; it does not inspect project design documents.

- `npm test`: renderer, bundle integrity and web metadata regression tests.
- `npm run test:production`: browser tests for visible-content fidelity and saved-layout restoration.
- `npm run test:browser`: publication optimization and browser verification tests.
- `node scripts/keynote-fidelity.mjs deck.md deck.html`: verify visible source text, slide count and IDs/order after production. Requires Playwright. Does not certify visual meaning, clipping or charts.
- `node scripts/keynote-promotions.mjs capture deck.md deck.html deck.layouts.json`: save rich HTML by stable slide ID after review.
- `node scripts/keynote-promotions.mjs apply deck.md deck.html deck.layouts.json`: restore unchanged designs after regeneration; changed source remains a fresh render for review, changed styles reject replay.

Production Markdown uses `> Slide ID: stable-name`. Generic blockquotes are visible content; use explicit speaker-note or Narration fields for private notes. Restrictive Keynote layout hints fall back rather than dropping visible support. Saved layout records contain full HTML and may contain hidden notes: treat them as private working files.
