# keynote-create Diagnosis Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the 11 diagnosed weaknesses in the keynote-create skill — argument grounding (audience/ask, support audit, real Minto, spine×length guards) and render fidelity (subcaption legibility, image embedding, measure cap, pack lint, global art direction, overflow probe, stale fixture).

**Architecture:** Prose fixes edit `SKILL.md` in place (exact old/new strings below). Code fixes edit `packs/neutral/layouts.css` and `scripts/keynote-render.mjs`, each gated by a new check appended to the framework-free test suite `scripts/test-render.mjs` (PASS/FAIL lines, non-zero exit on failure). Nothing new is invented — every change extends an existing mechanism (the token contract, the fail-closed `loadPack`, the font-cache machinery, the Chrome export).

**Tech Stack:** Plain Node.js ESM (no dependencies), CSS, markdown. Tests: `node scripts/test-render.mjs`. PDF checks need Google Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (already required by test 12).

**Spec:** `docs/superpowers/specs/2026-08-18-diagnosis.md`

## Global Constraints

- Repo: `/Users/noahraford/Projects/keynote-create-skill` (canonical; `~/.claude` holds deploy copies — Task 12 syncs them).
- 🚫 Never use WebFetch anywhere, including in any prompt you write.
- 🚫 Banned words in ALL authored text (code comments, docs, commits): "ship/shipped/shipping" (any work-completion sense), "load bearing"/"load-bearing". Never letter-space the word EMIR.
- Zero house-brand values in this public repo (tests already assert no `C9A96E`/`Cormorant` — keep it that way).
- Fail-closed philosophy: a bad pack dies loudly with a specific message; never a silent fallback.
- Type scale + 1920×1080 geometry are invariants in `layouts.css`; palette/fonts come from pack tokens.
- All `Edit` old-strings below were copied verbatim from the files on 2026-08-18. If an edit fails to match, re-Read the file — do not paraphrase-match.
- Run the full suite (`node scripts/test-render.mjs`) before every commit; commit only on ALL PASS.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

### Task 1: Cap the Boardroom bullet measure (D3)

**Files:**
- Modify: `packs/neutral/layouts.css:54`
- Test: `scripts/test-render.mjs` (append check 13)

**Interfaces:**
- Consumes: existing `render()` helper in test-render.mjs, fixture `docs/fixtures/sample-boardroom.md`.
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test.** Append to `scripts/test-render.mjs`, immediately BEFORE the final cleanup lines (`fs.rmSync(TMP, ...)`):

```js
// 13. body-list measure is capped (no 140-char lines across the full slide)
{
  const r = render(FIX_B);
  chk(/\.body-list\{[^}]*max-width:1180px/.test(r.html), 'body-list has a max-width measure cap');
}
```

- [ ] **Step 2: Run to verify it fails.** Run: `node scripts/test-render.mjs`. Expected: `FAIL body-list has a max-width measure cap` (everything else PASS).

- [ ] **Step 3: Apply the CSS edit.** In `packs/neutral/layouts.css` replace:

```css
  .body-list{list-style:none;margin-top:8px;}
```

with:

```css
  .body-list{list-style:none;margin-top:8px;max-width:1180px;}
```

- [ ] **Step 4: Run tests.** Run: `node scripts/test-render.mjs`. Expected: ALL PASS.

- [ ] **Step 5: Commit.**

```bash
git add packs/neutral/layouts.css scripts/test-render.mjs
git commit -m "fix(neutral): cap body-list measure at 1180px (D3)"
```

---

### Task 2: Subcaption ink plate + de-brand hardcoded colors (D1a, D4c)

**Files:**
- Modify: `packs/neutral/layouts.css:20` (footer pagenos), `packs/neutral/layouts.css:89-90` (subcap)
- Test: `scripts/test-render.mjs` (append check 14)

**Interfaces:**
- Consumes: tokens `--kn-paper`, `--lt-muted`, `--dk-muted` (already in the required contract).
- Produces: `.kn-subcap` plate styling that Task 3's caption-dark test renders against.

- [ ] **Step 1: Write the failing test.** Append (before cleanup):

```js
// 14. subcaption has an ink plate (not a text-shadow crutch) and no house-palette residue
{
  const r = render(FIX_K);
  chk(/\.kn-subcap\{[^}]*background:rgba\(0,0,0,\.55\)/.test(r.html), 'kn-subcap carries an ink plate');
  chk(!/#F3F1EC/i.test(r.html) && !/rgba\(74,71,64/.test(r.html), 'no hardcoded house-palette residue in shared layouts');
}
```

- [ ] **Step 2: Run to verify both new checks fail.** Run: `node scripts/test-render.mjs`.

- [ ] **Step 3: Apply the CSS edits.** In `packs/neutral/layouts.css` replace:

```css
  .lt .footer .pageno{color:rgba(74,71,64,.65);} .dk .footer .pageno{color:rgba(232,230,225,.4);}
```

with:

```css
  .lt .footer .pageno{color:var(--lt-muted);opacity:.7;} .dk .footer .pageno{color:var(--dk-muted);opacity:.75;}
```

and replace:

```css
  .kn-subcap{max-width:1080px;font-family:var(--body-font);font-size:27px;font-weight:500;line-height:1.45;color:#F3F1EC;
    text-shadow:0 1px 12px rgba(0,0,0,.92),0 0 3px rgba(0,0,0,.7);}
```

with:

```css
  /* Subcaption sits below the caption box where the scrim has faded — it gets
     its own hard-edged ink plate (same grammar as the caption box), never a
     text-shadow over an unknown image. Plate black is photographic, not brand. */
  .kn-subcap{max-width:1080px;font-family:var(--body-font);font-size:27px;font-weight:500;line-height:1.45;
    color:var(--kn-paper);background:rgba(0,0,0,.55);padding:10px 18px;}
```

- [ ] **Step 4: Run tests.** Expected: ALL PASS.

- [ ] **Step 5: Visual spot-check.** Render the keynote fixture with PDF: `node scripts/keynote-render.mjs docs/fixtures/sample-keynote.md --out /tmp/kn-check` and open `/tmp/kn-check/sample-keynote.pdf`. Confirm the subcaption line reads as a plate under the caption box, left-aligned with it.

- [ ] **Step 6: Commit.**

```bash
git add packs/neutral/layouts.css scripts/test-render.mjs
git commit -m "fix(neutral): give kn-subcap an ink plate; tokenize footer pagenos (D1, D4)"
```

---

### Task 3: Auto-flip to caption-dark on light images (D1b)

**Files:**
- Modify: `scripts/keynote-render.mjs:698-711` (`renderKnFullbleed`), `scripts/keynote-render.mjs:745-769` (`pickKnLayout` + `renderKnSlide`)
- Test: `scripts/test-render.mjs` (append check 15)

**Interfaces:**
- Consumes: `slide.art` (already parsed from `> Art:` lines).
- Produces: `renderKnFullbleed(slide, pageno, dark)` — third boolean param; `renderKnSlide` passes it. No other callers exist.

- [ ] **Step 1: Write the failing test.** Append (before cleanup):

```js
// 15. art note flagging a light image auto-flips the caption box to dark
{
  const md = path.join(TMP, 'light.md');
  fs.writeFileSync(md, '---\ntitle: "T"\nmode: "keynote"\n---\n\n# T\n\n---\n\n## The gallery was empty\n\n- one line\n\n> Art: bright white museum atrium, pale daylight\n');
  const r = render(md);
  chk(r.code === 0 && /kn-caption dark/.test(r.html), 'light art note auto-flips to caption-dark');
}
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement.** In `scripts/keynote-render.mjs`:

(a) Replace the `renderKnFullbleed` opening:

```js
function renderKnFullbleed(slide, pageno) {
  const capClass = slide.layout === 'caption-dark' ? 'kn-caption dark' : 'kn-caption';
```

with:

```js
function renderKnFullbleed(slide, pageno, dark = false) {
  const capClass = dark ? 'kn-caption dark' : 'kn-caption';
```

(b) In `pickKnLayout`, replace:

```js
  if (words <= 2 && slide.bullets.length === 0) return 'oneword';
  return 'fullbleed';
```

with:

```js
  if (words <= 2 && slide.bullets.length === 0) return 'oneword';
  // a light image drowns the default white caption box — flip to the dark box
  if (/\b(light|bright|white|pale|overexposed|snow|fog|daylit|sunlit)\b/i.test(slide.art || '')) return 'caption-dark';
  return 'fullbleed';
```

(c) Replace `renderKnSlide` entirely:

```js
function renderKnSlide(slide, pageno) {
  const layout = pickKnLayout(slide);
  switch (layout) {
    case 'wordless': return renderKnWordless(slide, pageno);
    case 'oneword':  return renderKnOneWord(slide, pageno);
    case 'number':   return renderKnNumber(slide, pageno);
    default:         return renderKnFullbleed(slide, pageno, layout === 'caption-dark');
  }
}
```

(Note: this also fixes a latent bug — the heuristic path could never produce a dark caption before, because `renderKnFullbleed` read `slide.layout`, which is empty when the pick was heuristic.)

- [ ] **Step 4: Run tests.** Expected: ALL PASS (explicit `> Layout: caption-dark` hints still work — the hint returns `'caption-dark'` from the hint branch and flows through the same default case).

- [ ] **Step 5: Commit.**

```bash
git add scripts/keynote-render.mjs scripts/test-render.mjs
git commit -m "fix(render): auto caption-dark on light-flagged art notes; fix heuristic dark-caption path (D1)"
```

---

### Task 4: Base64-inline slide images (D2)

**Files:**
- Modify: `scripts/keynote-render.mjs` — constants block (~line 43), `httpGet` (~line 355), `hashKey` (~line 431), new functions after `buildFontCss`, main IIFE (~line 857)
- Test: `scripts/test-render.mjs` (append check 16)

**Interfaces:**
- Consumes: existing `httpGet`, `hashKey`, `FONT_CACHE` pattern, `cssUrl` (data URIs pass its filter — base64 contains no quotes/parens/whitespace).
- Produces: `async inlineImage(src) -> string` (data URI | original value | `''`), `async inlineAllImages(meta, slides) -> void` (mutates `meta.cover_image` and each `slide.image` in place). Called once from the main IIFE before `buildHtml`.

- [ ] **Step 1: Write the failing test.** Append (before cleanup):

```js
// 16. local images are base64-inlined; a missing image degrades to the placeholder
{
  const img = path.join(TMP, 'tiny.png');
  fs.writeFileSync(img, Buffer.from('89504e470d0a1a0a', 'hex'));
  const md = path.join(TMP, 'img.md');
  fs.writeFileSync(md, '---\ntitle: "T"\nmode: "keynote"\n---\n\n# T\n\n---\n\n## A real image\n\n![](' + img + ')\n\n---\n\n## A missing image\n\n![](./no-such-file.jpg)\n');
  const r = render(md);
  chk(r.code === 0 && /data:image\/png;base64,/.test(r.html), 'local slide image is base64-inlined');
  chk(!/no-such-file\.jpg/.test(r.html), 'missing image never leaves a dead URL in the HTML');
}
```

- [ ] **Step 2: Run to verify both fail.**

- [ ] **Step 3: Implement.** In `scripts/keynote-render.mjs`:

(a) Below `const FONT_CACHE = ...` add:

```js
const IMG_CACHE = path.join(HOME, '.claude/cache/deck-images');
const IMG_MAX_BYTES = 12 * 1024 * 1024; // full-bleed photography runs larger than fonts
```

(b) Next to the existing `fs.mkdirSync(FONT_CACHE, { recursive: true });` add:

```js
fs.mkdirSync(IMG_CACHE, { recursive: true });
```

(c) Give `httpGet` a per-call byte cap. Replace its signature line:

```js
function httpGet(url, { responseType = 'text', redirects = 0, deadlineAt = null } = {}) {
```

with:

```js
function httpGet(url, { responseType = 'text', redirects = 0, deadlineAt = null, maxBytes = FETCH_MAX_BYTES } = {}) {
```

then inside it replace both uses of the cap: the data handler line

```js
        if (total > FETCH_MAX_BYTES) { req.destroy(new Error(`response exceeded ${FETCH_MAX_BYTES} bytes for ${url}`)); return; }
```

becomes

```js
        if (total > maxBytes) { req.destroy(new Error(`response exceeded ${maxBytes} bytes for ${url}`)); return; }
```

and the redirect recursion line

```js
        resolve(httpGet(new URL(loc, u).toString(), { responseType, redirects: redirects + 1, deadlineAt: absDeadline }));
```

becomes

```js
        resolve(httpGet(new URL(loc, u).toString(), { responseType, redirects: redirects + 1, deadlineAt: absDeadline, maxBytes }));
```

(d) Generalize the cache key. Replace:

```js
function hashKey(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 20) + '.woff2'; }
```

with:

```js
function hashKey(s, ext = '.woff2') { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 20) + ext; }
```

(No other call site changes — the default preserves font behavior, and test 11's direct key derivation still matches.)

(e) After the `buildFontCss` function, add:

```js
// ── image inlining ──
// Images were the one asset class not embedded: a remote URL that misses
// Chrome's virtual-time budget, or a file that moves after render, exported as
// a blank gray field. Inline everything, same policy as fonts. Failure → ''
// (the keynote placeholder), never a dead URL.
const IMG_MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml',
};
function mimeFor(p) { return IMG_MIME[path.extname(String(p)).toLowerCase()] || null; }

async function inlineImage(src) {
  const v = String(src ?? '').trim();
  if (!v || v.startsWith('data:')) return v;
  if (/^https?:\/\//i.test(v)) {
    let ext = '.jpg';
    try { ext = (new URL(v).pathname.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase(); } catch {}
    const mime = mimeFor('x' + ext) || 'image/jpeg';
    const file = path.join(IMG_CACHE, hashKey(v, IMG_MIME[ext] ? ext : '.jpg'));
    try {
      if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
        process.stderr.write(`[img] fetching ${v}\n`);
        const buf = await httpGet(v, { responseType: 'buffer', maxBytes: IMG_MAX_BYTES });
        const tmp = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, buf);
        fs.renameSync(tmp, file);
      }
      return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
    } catch (e) {
      process.stderr.write(`[img] WARN: fetch failed for ${v} (${e.message}) — slide falls back to the placeholder\n`);
      return '';
    }
  }
  // local path — resolve relative to the input markdown's directory
  const p = path.isAbsolute(v) ? v : path.resolve(path.dirname(input), v);
  const mime = mimeFor(p);
  if (!mime) { process.stderr.write(`[img] WARN: unrecognised image type, leaving as-is: ${v}\n`); return v; }
  try {
    const b = fs.readFileSync(p);
    if (b.length > IMG_MAX_BYTES) {
      process.stderr.write(`[img] WARN: ${v} is ${(b.length / 1048576).toFixed(1)}MB (cap ${(IMG_MAX_BYTES / 1048576).toFixed(0)}MB) — referencing by file URL instead\n`);
      return 'file://' + p;
    }
    return `data:${mime};base64,${b.toString('base64')}`;
  } catch {
    process.stderr.write(`[img] WARN: image not found: ${p} — slide falls back to the placeholder\n`);
    return '';
  }
}

async function inlineAllImages(meta, slides) {
  meta.cover_image = await inlineImage(meta.cover_image || meta.image || '');
  for (const s of slides) s.image = await inlineImage(s.image);
}
```

(f) In the main IIFE, replace:

```js
  await ensureFonts();
  const fontCss = await buildFontCss();
```

with:

```js
  await ensureFonts();
  await inlineAllImages(meta, slides);
  const fontCss = await buildFontCss();
```

- [ ] **Step 4: Run tests.** Expected: ALL PASS. (`renderKnCover` reads `meta.cover_image || meta.image` — `inlineAllImages` has already consolidated into `meta.cover_image`, so both branches stay correct.)

- [ ] **Step 5: Commit.**

```bash
git add scripts/keynote-render.mjs scripts/test-render.mjs
git commit -m "feat(render): base64-inline slide + cover images with cache; dead paths fall back to placeholder (D2)"
```

---

### Task 5: Pack integrity lint — contrast, richPromotion coupling, class coverage (D4a, D4b)

**Files:**
- Modify: `scripts/keynote-render.mjs` — new helpers above `loadPack` (~line 211), edits inside `loadPack`
- Test: `scripts/test-render.mjs` (append checks 17–19)

**Interfaces:**
- Consumes: `tokensInRoot` map (`declared`), `layoutsCss` string inside `loadPack`.
- Produces: `parseColor(v) -> [r,g,b]|null`, `contrastRatio(a, b) -> number` (module-level; also reusable by producers later).

- [ ] **Step 1: Write the failing tests.** Append (before cleanup):

```js
// 17. low-contrast core token pair fails closed
{
  const pdir = path.join(TMP, 'lowcontrast');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  let css = fs.readFileSync(path.join(pdir, 'tokens.css'), 'utf8');
  css = css.replace('--lt-text:#16181B;', '--lt-text:#EEEEEE;');
  fs.writeFileSync(path.join(pdir, 'tokens.css'), css);
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code !== 0 && /fails contrast/.test(r.stderr), 'low-contrast lt-text on lt-bg fails closed');
}

// 18. richPromotion demands layouts:"self" (shared CSS covers only the baseline family)
{
  const pdir = path.join(TMP, 'richshared');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'template.html'), '<div class="slide lt"></div>');
  fs.writeFileSync(path.join(pdir, 'layout-catalog.md'), '# catalog');
  fs.writeFileSync(path.join(pdir, 'pack.json'),
    JSON.stringify({ schema: 1, name: 'x', brand: '', sublabel: '', layouts: 'shared', richPromotion: true }));
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code !== 0 && /richPromotion/.test(r.stderr) && /self/.test(r.stderr), 'richPromotion on shared layouts fails closed');
}

// 19. richPromotion template classes must have a CSS rule in the pack
{
  const pdir = path.join(TMP, 'richuncovered');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'template.html'), '<div class="slide lt"><div class="totally-unstyled-class"></div></div>');
  fs.writeFileSync(path.join(pdir, 'layout-catalog.md'), '# catalog');
  fs.writeFileSync(path.join(pdir, 'pack.json'),
    JSON.stringify({ schema: 1, name: 'x', brand: '', sublabel: '', layouts: 'self', richPromotion: true }));
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code !== 0 && /totally-unstyled-class/.test(r.stderr), 'template class with no CSS rule fails closed');
}
```

- [ ] **Step 2: Run to verify 17–19 fail** (they will render successfully instead of dying).

- [ ] **Step 3: Implement.** In `scripts/keynote-render.mjs`:

(a) Above `function loadPack(dir) {` add:

```js
// WCAG relative-luminance contrast for the pack lint. Only lints values that
// parse as flat colors (hex / rgb) — gradients and exotic notations are skipped,
// not failed, because we cannot judge what we cannot parse.
function parseColor(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return [+m[1], +m[2], +m[3]];
  return null;
}
function contrastRatio(a, b) {
  const lum = (rgb) => {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
```

(b) Inside `loadPack`, replace the richPromotion file check:

```js
  // richPromotion packs must actually ship the promotion assets
  if (meta.richPromotion) {
    for (const f of ['template.html', 'layout-catalog.md']) {
      if (!isRegularFile(path.join(dir, f))) die(`pack.json richPromotion:true but missing ${f}: ${dir}`);
    }
  }
```

with:

```js
  // richPromotion packs must carry the promotion assets AND their own layouts —
  // the shared neutral layouts.css styles only the baseline + keynote families,
  // so promoting against it produces unstyled slides.
  if (meta.richPromotion) {
    if (layoutsMode !== 'self') die(`pack.json richPromotion:true requires layouts:"self" (shared layouts cover only the baseline family): ${pj}`);
    for (const f of ['template.html', 'layout-catalog.md']) {
      if (!isRegularFile(path.join(dir, f))) die(`pack.json richPromotion:true but missing ${f}: ${dir}`);
    }
  }
```

(c) Immediately after the existing `missing` token check (`if (missing.length) die(...)`), add:

```js
  // contrast lint on the core text/background pairs — a pack that passes the
  // token contract but renders unreadable text is still a broken pack
  const CONTRAST_PAIRS = [['--lt-text', '--lt-bg'], ['--dk-text', '--deck-bg'], ['--kn-paper', '--kn-ink']];
  for (const [fg, bg] of CONTRAST_PAIRS) {
    const f = parseColor(declared.get(fg)), b = parseColor(declared.get(bg));
    if (f && b) {
      const ratio = contrastRatio(f, b);
      if (ratio < 4.5) die(`pack fails contrast: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (minimum 4.5:1): ${tokensPath}`);
    }
  }
```

(d) After the two `assertNoStyleBreakout(...)` calls (both `tokensCss` and `layoutsCss` are loaded by then), add:

```js
  // class-coverage lint: every class the promotion template uses must have at
  // least one CSS rule in the pack, or promoted slides render unstyled
  if (meta.richPromotion) {
    const tpl = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');
    const classes = new Set();
    for (const m of tpl.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c => c && classes.add(c));
    const css = tokensCss + '\n' + layoutsCss;
    const uncovered = [...classes].filter(c => !css.includes('.' + c));
    if (uncovered.length) die(`richPromotion template.html uses classes with no CSS rule in the pack (${uncovered.join(', ')}): ${dir}`);
  }
```

- [ ] **Step 4: Run tests.** Expected: ALL PASS — including the pre-existing checks 1–12 (the neutral pack passes all three lints: its contrast pairs are far above 4.5:1, and it is `richPromotion:false`).

- [ ] **Step 5: Commit.**

```bash
git add scripts/keynote-render.mjs scripts/test-render.mjs
git commit -m "feat(render): pack integrity lint — contrast floor, richPromotion/layouts coupling, template class coverage (D4)"
```

---

### Task 6: Overflow probe on PDF export (D6)

**Files:**
- Modify: `scripts/keynote-render.mjs` — `buildHtml` tail (~line 820), `exportPdf` (~line 831), re-export shortcut (~line 128)
- Test: `scripts/test-render.mjs` (append check 20; needs Chrome, same as check 12)

**Interfaces:**
- Consumes: `.slide{overflow:hidden}` (scrollHeight still reports full content height under hidden overflow).
- Produces: `KN-OVERFLOW slide N` console lines in the HTML; `exportPdf` surfaces them as `[pdf]  WARN` lines. Re-export path now calls `exportPdf` (deduplicates the Chrome invocation).

- [ ] **Step 1: Write the failing test.** Append (before cleanup):

```js
// 20. overflow probe flags an overstuffed slide during PDF export (needs Chrome, like #12)
{
  const bullets = Array.from({ length: 40 }, (_, i) => '- Bullet line number ' + (i + 1) + ' with enough words to take real vertical space on the slide').join('\n');
  const md = path.join(TMP, 'overflow.md');
  fs.writeFileSync(md, '---\ntitle: "T"\n---\n\n# T\n\n---\n\n## This slide has far too much body content\n\n' + bullets + '\n\n---\n\n## Closing beat\n');
  const outDir = fs.mkdtempSync(path.join(TMP, 'ovf-'));
  const r = spawnSync('node', [RENDER, md, '--out', outDir], { env: baseEnv, encoding: 'utf8' });
  chk(r.status === 0 && /overflows/.test(r.stdout + r.stderr), 'overflow probe flags the overstuffed slide');
}
```

- [ ] **Step 2: Run to verify it fails.**

- [ ] **Step 3: Implement.** In `scripts/keynote-render.mjs`:

(a) In `buildHtml`, replace the closing script block:

```js
<script>
function fit(){var s=Math.min(1,(window.innerWidth-56)/1920);document.documentElement.style.setProperty('--fit',s);}
fit(); addEventListener('resize',fit);
</script>
```

with:

```js
<script>
function fit(){var s=Math.min(1,(window.innerWidth-56)/1920);document.documentElement.style.setProperty('--fit',s);}
fit(); addEventListener('resize',fit);
// overflow probe: .slide clips silently (overflow:hidden), so report any slide
// whose content exceeds the frame. exportPdf reads these console lines from
// Chrome's stderr (--enable-logging=stderr) and surfaces them as warnings.
addEventListener('load',function(){
  document.querySelectorAll('.slide').forEach(function(s,i){
    if(s.scrollHeight>s.clientHeight+1||s.scrollWidth>s.clientWidth+1){
      console.log('KN-OVERFLOW slide '+(i+1));
    }
  });
});
</script>
```

(b) Replace the whole `exportPdf` function:

```js
function exportPdf(htmlPath, pdfPath) {
  if (!fs.existsSync(CHROME)) {
    console.error(`[pdf] Chrome not found at ${CHROME}. Skipping PDF.`);
    return false;
  }
  const url = 'file://' + htmlPath;
  const flags = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--enable-logging=stderr',
    '--virtual-time-budget=10000',
    '--run-all-compositor-stages-before-draw',
    `--print-to-pdf=${pdfPath}`,
    '--no-pdf-header-footer',
    url,
  ];
  const r = spawnSync(CHROME, flags, { encoding: 'utf8', timeout: 60_000 });
  if (r.status !== 0) {
    if (r.stderr) process.stderr.write(r.stderr);
    console.error(`[pdf] Chrome exited ${r.status}`);
    return false;
  }
  const pages = new Set();
  for (const m of (r.stderr || '').matchAll(/KN-OVERFLOW slide (\d+)/g)) pages.add(+m[1]);
  for (const n of [...pages].sort((a, b) => a - b)) {
    console.log(`[pdf]  WARN: content overflows the slide frame on page ${n} — inspect that page in the PDF`);
  }
  return true;
}
```

(c) Simplify the `.html` re-export shortcut so both paths share the probe. Replace the body of the shortcut block (everything between `if (inputExt === '.html' || inputExt === '.htm') {` and its closing `}`) with:

```js
  const ok = exportPdf(input, pdfOut);
  if (!ok) process.exit(1);
  const sz = fs.statSync(pdfOut).size;
  console.log(`[pdf]  ${pdfOut}  (${(sz/1024).toFixed(0)}KB, re-exported)`);
  process.exit(0);
```

(`exportPdf` is a hoisted function declaration and `CHROME` is defined above the shortcut, so this call is valid at that point in the module. Delete the now-unused Chrome-existence check, `url`, `flags`, and `spawnSync` lines inside the shortcut. Note the probe only fires for HTML generated after this task — older HTML re-exports simply produce no probe lines.)

- [ ] **Step 4: Run tests.** Expected: ALL PASS — including check 12 (PDF floor) still passing with the captured-stdio Chrome invocation.

- [ ] **Step 5: Commit.**

```bash
git add scripts/keynote-render.mjs scripts/test-render.mjs
git commit -m "feat(render): per-slide overflow probe surfaced as PDF export warnings (D6)"
```

---

### Task 7: Audience + ask discipline in SKILL.md (A1)

**Files:**
- Modify: `SKILL.md` (Stage 1 ~line 18, Stage 2 ~line 70, classic checks ~line 312, frontmatter ~line 338)

**Interfaces:**
- Consumes: nothing.
- Produces: `audience:` and `ask:` frontmatter fields that Task 8's support audit and the final-title check reference. (The render script ignores unknown frontmatter keys — no code change needed.)

- [ ] **Step 1: Stage 1 asks about the room.** In `SKILL.md` replace:

```markdown
### Stage 1 — Read and propose 2-3 candidate punchlines

Read the source material carefully. Identify what's at stake, what tension drives the piece, what the central insight or turn is, and what changes by the end.
```

with:

```markdown
### Stage 1 — Read and propose 2-3 candidate punchlines

**First: know the room.** If the request doesn't already name the audience and the ask, ask one line before drafting anything:

> Who is this deck for, and what should they decide, do, or feel when it ends?

The same source yields different punchlines for a board, a conference hall, or a skeptical technical review — never pick a governing thought blind. If the request already makes audience and ask clear, don't re-ask: state your reading in one line and move on.

Read the source material carefully. Identify what's at stake, what tension drives the piece, what the central insight or turn is, and what changes by the end — *for this audience*.
```

- [ ] **Step 2: Stage 2 confirmation restates audience + ask.** Replace:

```markdown
**Stop and wait.** Do not proceed until mode, punchline, length, density, and style are confirmed. Acknowledge edits briefly and move on — don't re-litigate.
```

with:

```markdown
**Stop and wait.** Do not proceed until mode, punchline, length, density, and style are confirmed — and restate the audience and the ask in one line as part of the confirmation ("For the board; the ask is approval of the Q3 plan"). Acknowledge edits briefly and move on — don't re-litigate.
```

- [ ] **Step 3: The last title must carry the ask.** In "The classic checks", replace:

```markdown
- Does the last title land the punchline, not summarize?
- Can any adjacent pair be swapped without loss?
```

with:

```markdown
- Does the last title land the punchline, not summarize?
- Does the final title contain or directly set up the ask? ("Open forward" endings are allowed only when the confirmed ask is reflective — never on a decision deck.)
- Can any adjacent pair be swapped without loss?
```

- [ ] **Step 4: Frontmatter fields.** In the output-format block, replace:

```markdown
punchline: "The one-line message, confirmed with the user"
dramatic_question: "The central tension in one sentence"
```

with:

```markdown
punchline: "The one-line message, confirmed with the user"
audience: "Who the deck is for, in a few words"
ask: "What the audience should decide, do, or feel at the end"
dramatic_question: "The central tension in one sentence"
```

- [ ] **Step 5: Verify.** Run: `grep -n "know the room\|^audience:\|^ask:\|set up the ask" SKILL.md` — expect 4+ hits spanning Stages 1–2, the classic checks, and the frontmatter block.

- [ ] **Step 6: Commit.**

```bash
git add SKILL.md
git commit -m "feat(skill): audience + ask discipline — asked in Stage 1, confirmed in Stage 2, checked on the final title (A1)"
```

---

### Task 8: Support audit + body QC (A2, A5)

**Files:**
- Modify: `SKILL.md` (Stage 3 step 7 ~line 106, "What this skill does not do" ~line 442)

**Interfaces:**
- Consumes: the step-6 scan list (hedges, AI tells, initialisms) already in SKILL.md.
- Produces: step 7b, referenced by nothing downstream.

- [ ] **Step 1: Add the support audit.** Replace:

```markdown
7. **Fill in supporting content.** Short bullets, fragments, optional speaker notes. Calibrate to density. In Keynote/sparse this is often nothing — the image is the body.
```

with:

```markdown
7. **Fill in supporting content.** Short bullets, fragments, optional speaker notes. Calibrate to density. In Keynote/sparse this is often nothing — the image is the body.

   **7b. Support audit — titles must be earned.** For every claim-bearing title (any title asserting a fact, number, cause, or recommendation), name its warrant: the bullet on the slide or the passage in the source that backs it. A title with no warrant gets softened, re-scoped, or cut — an assertive title the deck can't back is worse than a duller one it can. In **Evidence** density, every bullet must carry a number, a name, or a citation. Bodies also get the step-6 *scan list* (hedged verbs, AI tells, initialisms, sameness) — the scan applies to bodies; the prose-craft register rules do not, because bodies stay bullets and fragments.
```

- [ ] **Step 2: Reconcile the exclusions list.** Replace:

```markdown
- Does not run prose-craft on slide bodies. Titles only.
```

with:

```markdown
- Does not run prose-craft on slide bodies — titles only. (Bodies still get the step-6 hedge/AI-tell scan as part of the step-7b support audit.)
```

- [ ] **Step 3: Verify.** Run: `grep -n "7b\. Support audit\|step-7b" SKILL.md` — expect 2 hits.

- [ ] **Step 4: Commit.**

```bash
git add SKILL.md
git commit -m "feat(skill): support audit — claim-titles name their warrant; bodies get the QC scan (A2, A5)"
```

---

### Task 9: Real Minto + spine×length guards (A3, A4)

**Files:**
- Modify: `SKILL.md` (spine menu ~lines 204–218, act structure ~line 222, classic checks ~line 311)

**Interfaces:**
- Consumes: the confirmed length from Stage 2.
- Produces: per-spine minimum lengths that the Stage 3 spine pick must check against.

- [ ] **Step 1: Give spine 0 the method, not just the name.** Replace:

```markdown
- **Spine 0 — Minto / McKinsey pyramid.** *(Default in Boardroom; available in Keynote.)* Answer-first, grouped supporting arguments, action-titles that read top-to-bottom. This is the skill's original behaviour, unchanged. An image-led deck can run on it — Oxford's 2×2 scenario matrix and Singapore's 4-stage pyramid are essentially Minto with photographs.
```

with:

```markdown
- **Spine 0 — Minto / McKinsey pyramid.** *(Default in Boardroom; available in Keynote. Works at any length.)* Answer-first, grouped supporting arguments, action-titles that read top-to-bottom. An image-led deck can run on it — Oxford's 2×2 scenario matrix and Singapore's 4-stage pyramid are essentially Minto with photographs.

  **Minto discipline (spine 0 only).** Minto is a method, not a title register. When this spine is chosen:
  - **Answer by slide 2.** The punchline lands up front; the deck then defends it. No mid-deck turn — the five-act arc does not apply (see "Act structure by length").
  - **Group the middle.** The supporting slides form 2–4 named argument groups. Check MECE-lite: do any two groups make the same argument (overlap)? Is there an obvious objection no group answers (gap)?
  - **Vertical Q&A.** Each group's lead title answers the question the punchline raises ("why?" / "how?" / "why now?"); each slide inside a group answers the question its group lead raises. A title that doesn't answer the level above belongs elsewhere — or nowhere.
```

- [ ] **Step 2: Per-spine minimum lengths.** Replace the six-spine list:

```markdown
1. **Emotional arc** — Dread → Turn → Reframe → Hope → Answer → Exhale. Fear accumulates across sparse slides, snaps on a word or black slide ("Normal," "It did," "Hope | Fear"), reframes ("Great Transition"), reveals the answer, exhales on a wordless image or the speaker's own line.
2. **Reveal / misdirection** — a long setup that recontextualizes at a hinge (a nine-slide dread run revealed as history: "It did / 1895–1945"; a glut of trend-reports revealed as a pathology: "there is no list!").
3. **Framework build** — a recurring motif or diagram assembled across the deck (a pyramid filled tier by tier; a 2×2 whose quadrants become the acts; "Four Lessons" planted then walked one per section).
4. **Forecast cascade → implication** — chained consequences, each slide's caption grammatically completing the last, then a pivot to "what this means for *you*."
5. **Teaching / method** — problem → concept → how-to steps → proof. The most content-neutral spine; the default fallback when nothing else fits.
6. **Scenario-parallel** — name N futures up front, walk each as a mini-arc under a repeated divider template, land on a synthesis.
```

with:

```markdown
1. **Emotional arc** — Dread → Turn → Reframe → Hope → Answer → Exhale. Fear accumulates across sparse slides, snaps on a word or black slide ("Normal," "It did," "Hope | Fear"), reframes ("Great Transition"), reveals the answer, exhales on a wordless image or the speaker's own line. *(Needs Medium or longer — dread must accumulate over ~6+ slides.)*
2. **Reveal / misdirection** — a long setup that recontextualizes at a hinge (a nine-slide dread run revealed as history: "It did / 1895–1945"; a glut of trend-reports revealed as a pathology: "there is no list!"). *(Needs ~8+ slides — the setup IS the deck. At Small length the hinge has no room; pick another spine.)*
3. **Framework build** — a recurring motif or diagram assembled across the deck (a pyramid filled tier by tier; a 2×2 whose quadrants become the acts; "Four Lessons" planted then walked one per section). *(Needs one slide per tier/quadrant plus a planting slide — minimum ~5–6.)*
4. **Forecast cascade → implication** — chained consequences, each slide's caption grammatically completing the last, then a pivot to "what this means for *you*." *(Works from ~5 slides — each link needs its own slide.)*
5. **Teaching / method** — problem → concept → how-to steps → proof. The most content-neutral spine; the default fallback when nothing else fits. *(Works at any length.)*
6. **Scenario-parallel** — name N futures up front, walk each as a mini-arc under a repeated divider template, land on a synthesis. *(Needs roughly 2×N+2 slides for N scenarios — divider + beat each, plus setup and synthesis.)*
```

- [ ] **Step 3: Fix the cross-cutting rules.** Replace:

```markdown
**Cross-cutting permissions (all spines):**
- **Spines compose** — a Framework build can open with an Emotional dread run; a Minto pyramid can be delivered in Keynote visuals.
- In **Keynote mode only**, the thesis may land late (slide 10–19) and the "question live by slide 2" rule relaxes. **Boardroom + Minto keeps answer-first.**
- If the source fits no spine cleanly, default to **Minto** (Boardroom) or **Teaching/method** (Keynote) rather than inventing structure.
```

with:

```markdown
**Cross-cutting permissions (all spines):**
- **Spines compose** — a Framework build can open with an Emotional dread run; a Minto pyramid can be delivered in Keynote visuals.
- **Late thesis follows the spine, not the mode.** The Reveal and Emotional-arc spines may land the thesis late (past mid-deck) in *either* mode — the spine defines that contract. All other spines keep the question live by slide 2; **Minto keeps answer-first everywhere.**
- **Check spine × length before drafting.** If the chosen spine's minimum (noted above) exceeds the confirmed length, say so and offer two ways out: stretch the length, or swap to a spine that fits. Never silently compress a Reveal into 4 slides.
- If the source fits no spine cleanly, default to **Minto** (Boardroom) or **Teaching/method** (Keynote) rather than inventing structure.
```

- [ ] **Step 4: Exempt Minto from the dramatic arc.** Replace:

```markdown
The five-act arc is the same in every length — exposition, rising action, climax, falling action, resolution. What changes is how compressed each act is. This applies directly to Minto and Boardroom decks; Keynote spines above map their own beats onto the same rising-then-resolving shape.
```

with:

```markdown
The five-act arc is the same in every length — exposition, rising action, climax, falling action, resolution. What changes is how compressed each act is. **Exception — Minto (spine 0) does not use the dramatic arc:** it is answer-first (punchline by slide 2, grouped defense, a landing that returns to the answer), with no mid-deck turn. The Keynote spines map their own beats onto the rising-then-resolving shape.
```

- [ ] **Step 5: Scope the turn check.** In "The classic checks", replace:

```markdown
- Is there an unmistakable turn near the middle?
```

with:

```markdown
- Is there an unmistakable turn near the middle? *(Arc spines only — a Minto deck has no turn; check instead that the answer lands by slide 2.)*
```

- [ ] **Step 6: Verify.** Run: `grep -n "Minto discipline\|Check spine × length\|does not use the dramatic arc\|Arc spines only" SKILL.md` — expect 4 hits.

- [ ] **Step 7: Commit.**

```bash
git add SKILL.md
git commit -m "feat(skill): Minto gets its method (MECE-lite, vertical Q&A, no turn); spine × length guards (A3, A4)"
```

---

### Task 10: Global photographic treatment (D5)

**Files:**
- Modify: `SKILL.md` (Stage 3.5 ~line 108, output-format frontmatter ~line 343)

**Interfaces:**
- Consumes: the art-direct skill hand-off already described in Stage 3.5.
- Produces: `art_direction:` frontmatter field (ignored by the renderer; consumed by the model during image prompting).

- [ ] **Step 1: Mandate one treatment per deck.** In Stage 3.5, replace:

```markdown
8. **Keynote mode only — art-direction pass (Stage 3.5).** Once the beat sequence is set, hand the deck to the **art-direct skill**. For each slide it returns an image concept, photography/style direction, mood, and an AI-image prompt. Hold to the **metaphor-not-illustration** principle the corpus uses (fire = "Volitocracy"; a broken foot beside a running shoe = "Fast inaction") — the image *stands for* the abstraction, it does not depict the words literally. Record each slide's direction on a `> Art:` line (presenter-only, like a speaker note) and, when an image file exists, an `![]()` or `> Image:` line. Boardroom mode skips this step.
```

with:

```markdown
8. **Keynote mode only — art-direction pass (Stage 3.5).** Once the beat sequence is set, hand the deck to the **art-direct skill**. **Choose one global treatment first:** before any per-slide prompts, fix a single photographic treatment for the whole deck — grade, era, lens/film feel, palette temperature (e.g. "muted Kodachrome, 35mm, warm dusk, soft grain") — record it as `art_direction:` in the frontmatter, and append it verbatim to every per-slide AI-image prompt. Ten independently-prompted images with no shared treatment look like ten stock sites; the global treatment is what makes them one deck. Then, for each slide, art-direct returns an image concept, photography/style direction, mood, and an AI-image prompt. Hold to the **metaphor-not-illustration** principle the corpus uses (fire = "Volitocracy"; a broken foot beside a running shoe = "Fast inaction") — the image *stands for* the abstraction, it does not depict the words literally. Record each slide's direction on a `> Art:` line (presenter-only, like a speaker note) and, when an image file exists, an `![]()` or `> Image:` line. Boardroom mode skips this step.
```

- [ ] **Step 2: Frontmatter field.** In the output-format block, replace:

```markdown
density: "high-impact | narrative | evidence | keynote-sparse | eli5"
cover_image: "path-or-url to the cover full-bleed image (keynote, optional)"
```

with:

```markdown
density: "high-impact | narrative | evidence | keynote-sparse | eli5"
art_direction: "one global photographic treatment appended verbatim to every image prompt (keynote)"
cover_image: "path-or-url to the cover full-bleed image (keynote, optional)"
```

- [ ] **Step 3: Verify.** Run: `grep -n "art_direction\|global treatment" SKILL.md` — expect 3+ hits.

- [ ] **Step 4: Commit.**

```bash
git add SKILL.md
git commit -m "feat(skill): one global photographic treatment per deck, appended to every image prompt (D5)"
```

---

### Task 11: Refresh the stale baseline fixture (D7)

**Files:**
- Modify: `docs/fixtures/baseline/sample-boardroom.html` (regenerated, not hand-edited)

**Interfaces:**
- Consumes: the render script as modified by Tasks 1–6.
- Produces: nothing downstream (documentation artifact; not referenced by tests).

- [ ] **Step 1: Confirm the staleness.** Run: `grep -c "forge-bg\|h-gold" docs/fixtures/baseline/sample-boardroom.html`. Expected: a non-zero count (pre-generic house classes). If the file doesn't exist or greps clean, skip to Task 12 and note it in the commit trail.

- [ ] **Step 2: Regenerate.** Run:

```bash
node scripts/keynote-render.mjs docs/fixtures/sample-boardroom.md --out docs/fixtures/baseline --no-pdf
```

- [ ] **Step 3: Verify.** Run: `grep -c "forge-bg\|h-gold\|C9A96E\|Cormorant" docs/fixtures/baseline/sample-boardroom.html`. Expected: 0 (grep exits 1). Confirm the file now contains `max-width:1180px` (Task 1's CSS made it in).

- [ ] **Step 4: Commit.**

```bash
git add docs/fixtures/baseline/sample-boardroom.html
git commit -m "chore(fixtures): regenerate baseline boardroom HTML from the generic neutral pack (D7)"
```

---

### Task 12: Full verification, deploy sync, push

**Files:**
- No repo edits. Syncs to `~/.claude/skills/keynote-create/` and `~/.claude/scripts/` (both may be symlinks into `~/Dropbox/Noah_Remote_Shared/claude-brain/` — always write to the resolved real target, never through the symlink).

- [ ] **Step 1: Full suite.** Run: `node scripts/test-render.mjs`. Expected: ALL PASS (checks 1–20).

- [ ] **Step 2: End-to-end render.** Run both fixtures WITH PDF and open the results:

```bash
node scripts/keynote-render.mjs docs/fixtures/sample-boardroom.md --out /tmp/kn-final
node scripts/keynote-render.mjs docs/fixtures/sample-keynote.md --out /tmp/kn-final
open /tmp/kn-final/sample-boardroom.pdf /tmp/kn-final/sample-keynote.pdf
```

Expected: no overflow warnings, no font-floor warnings; bullets visibly narrower than the slide; subcaptions on plates.

- [ ] **Step 3: Resolve deploy targets.** Run: `ls -la ~/.claude/skills/keynote-create ~/.claude/scripts/keynote-render.mjs` and note whether either is a symlink; resolve with `readlink -f` if so.

- [ ] **Step 4: Sync deploy copies** (into the RESOLVED real paths from Step 3):

```bash
DEPLOY_SKILL="$(readlink -f ~/.claude/skills/keynote-create 2>/dev/null || echo ~/.claude/skills/keynote-create)"
rsync -a --delete --exclude '.git' --exclude 'docs/superpowers' ~/Projects/keynote-create-skill/ "$DEPLOY_SKILL/"
cp ~/Projects/keynote-create-skill/scripts/keynote-render.mjs ~/Projects/keynote-create-skill/scripts/house-style.mjs "$(dirname "$(readlink -f ~/.claude/scripts/keynote-render.mjs 2>/dev/null || echo ~/.claude/scripts/keynote-render.mjs)")/"
```

- [ ] **Step 5: Smoke-test the deploy copy.** Run: `node ~/.claude/scripts/keynote-render.mjs ~/Projects/keynote-create-skill/docs/fixtures/sample-keynote.md --out /tmp/kn-deploy --no-pdf` — expect exit 0 and an HTML containing `max-width:1180px`.

- [ ] **Step 6: Push.**

```bash
git -C ~/Projects/keynote-create-skill push origin master
```

- [ ] **Step 7: Report.** State plainly which tasks landed, the test count, and any deviations from this plan.
