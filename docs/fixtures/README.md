# docs/fixtures — publish-stage test substrate

`sample-public.html` is the shared fixture for the publish-stage scripts:
`web-optimize.mjs` (Task 3), `web-inject.mjs` (Task 4), and
`keynote-verify.mjs` (Task 5). It is a small, fully self-contained deck —
all images and the font are embedded as base64 data URIs, and the standard
deck nav script is **deliberately omitted** (the publish scripts must tolerate
a deck with no show-mode handler).

## Fixture map (what each test-relevant feature is, and where)

| Feature | Where | Exercises |
|---|---|---|
| CSS background data-URI image | Slide 1 (cover), `.cover-bg.photo` | extraction of `url(data:image/...)` in CSS, `.photo` box measurement |
| Keynote full-bleed background | Slide 5, `.kn-bg` div (renderer `knBg()` markup), `knbg.jpg` natural 3840×2160 at a 1920×1080 box | generic background box measurement → downscales to 2592×1458 (1.35×box, ≤ natural) |
| Duplicated image (identical bytes, twice) | Slides 2 & 3, `dedupe.jpg` at 200px boxes | signature dedupe → ONE asset file referenced twice |
| One image at two box sizes | Slides 2 & 3, `sizes.jpg` at 200px and 600px boxes | max-box resize (natural 900×450, so output ≥ 1.35×600 and ≤ natural) |
| Real-alpha PNG | Slide 4, `alpha.png` 50×50 at a 50px box | alpha detection → stays PNG, never flattened to JPEG |
| Base64-embedded font | `@font-face 'Fixture Sans'` (the committed Inter woff2) | fonts must survive optimize untouched (only `image/` URIs are extracted) |
| Footer + pageno pattern | Slides 2–5, pagenos `02`–`05` (cover has no footer) | deck-convention markup for the verify suite's geometry/pageno checks |

Deck convention: `<div class="slide-wrap"><section class="slide lt" aria-label="Slide N">…<div class="footer"><span class="brand">…<span class="sub">…</span></span><span class="pageno">NN</span></div></section></div>`,
1920×1080 slides, `zoom: var(--fit,1)` (no fit script — defaults to 1; measure at
a ≥1976px-wide viewport).

## Regenerating

```sh
node docs/fixtures/gen-fixture.mjs            # writes docs/fixtures/sample-public.html
node docs/fixtures/gen-fixture.mjs --out /tmp/copy.html
```

The generator produces all images as **real bytes via `magick`**
(ImageMagick 7) and embeds them as base64 itself — base64 is never
hand-typed. The embedded font is **Inter** (latin subset, weight 400),
licensed under the **SIL Open Font License 1.1** — the woff2 and its
license text are committed at `docs/fixtures/fonts/inter-latin-400.woff2`
and `docs/fixtures/fonts/OFL.txt`. OFL 1.1 permits redistribution with the
license included; do not strip the name table or the reserved font name.

## Playwright resolution

The publish scripts drive a headless browser via the shared helper
`scripts/lib/playwright.mjs`, which resolves the playwright module in this
order:

1. **`PLAYWRIGHT_MODULE` env var** — the canonical way to point at a
   specific playwright install:
   ```sh
   export PLAYWRIGHT_MODULE=/path/to/some/project/node_modules/playwright/index.mjs
   ```
2. **A machine-specific known-good path** (an optional convenience entry,
   e.g. a sibling project's `node_modules/playwright` — see the helper for
   the current example; irrelevant on any machine where (1) or (3) works).
3. **A bare `require('playwright')`** — i.e. `npm i playwright` in this repo
   or any ancestor directory.

If none resolve, the scripts exit 1 with instructions to set
`PLAYWRIGHT_MODULE` or `npm i playwright`.

## Verify it renders headlessly

```sh
PLAYWRIGHT_MODULE=/path/to/playwright node -e "const{chromium}=require(process.env.PLAYWRIGHT_MODULE);(async()=>{const b=await chromium.launch();const p=await b.newPage();await p.goto('file://'+process.cwd()+'/docs/fixtures/sample-public.html');await p.waitForTimeout(500);console.log('slides:',await p.evaluate(()=>document.querySelectorAll('.slide-wrap').length));await b.close();})()"
```

Expected: `slides: 4`, no JS errors. All five `<img>` elements load
(`complete && naturalWidth > 0`), the embedded font loads
(`document.fonts.check('16px "Fixture Sans"') → true`), and no slide overflows
(`scrollHeight <= clientHeight + 1`).
