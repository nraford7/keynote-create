# Validation — 16 September 2026

| Check | Result |
|---|---|
| `npm test` | 20/20 pass: NE renderer handoff, legacy input, numeric evidence retention, bundle integrity/required inventory and web injection. |
| `npm run test:browser` | 20/20 pass: image optimization and publishing verification, including mobile/throttled fixtures. |
| `npm run test:render` | 41 pass, 1 fail: Google-font embedding assertion. The unchanged baseline reproduces the same failed Google Fonts CSS resolution and system fallback. This suite is not claimed fully green. |
| `node scripts/narrative-sync.mjs --check --source ../Narrative-Engine` | 23 runtime files match pinned upstream `f682a293f488bbec7d9e04a62db3d39c22d67a49` and the declared finite adaptations. |
| Real NE fixture → HTML/PDF | Boardroom and Keynote each export exactly 3 slides/pages with `--no-cover`, using a temporary local-font pack to avoid the failing remote fetch. |
| Layout guard | All 6 fixture slides pass. Representative middle-slide screenshots inspected for visible evidence and layout. Keynote uses labeled missing-image placeholders, as expected for this rendering fixture. |
| PDF inspection | Boardroom is 3 pages at 1440×810 points (1920×1080 CSS pixels); PDF font inspection confirms embedded Inter and Georgia fallback. The renderer's size-based warning fired despite embedded fonts, demonstrating that file size alone is only a heuristic. |
| Independent review | Baseline and revised pressure-scenario workflow simulations; final recheck found no remaining blocking errors. Not a repeated empirical agent benchmark. |
| `git diff --check` | Pass. |

No website was deployed, installed skill copy replaced, or upstream main branch changed by this validation.
