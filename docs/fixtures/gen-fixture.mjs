#!/usr/bin/env node
// Generates docs/fixtures/sample-public.html — the shared test substrate for
// the publish-stage scripts: web-optimize.mjs (Task 3), web-inject.mjs
// (Task 4) and keynote-verify.mjs (Task 5).
//
// All images are REAL bytes produced by ImageMagick (`magick`) and embedded
// as base64 by this script — never hand-typed. The embedded font is Inter
// (latin subset, weight 400), SIL Open Font License 1.1 — the woff2 and its
// license text are committed at docs/fixtures/fonts/inter-latin-400.woff2
// and docs/fixtures/fonts/OFL.txt (see the fixture README).
//
// Test-relevant layout of the fixture (see docs/fixtures/README.md):
//   Slide 1  cover, dark, NO footer, aria-label="Slide 1",
//            CSS background data-URI image on .cover-bg.photo
//   Slide 2  light content slide, footer + pageno 02,
//            <img> dedupe.jpg at a 200px box (appearance 1 of 2)
//            <img> sizes.jpg  at a 200px box (small box of the max-box pair)
//   Slide 3  light content slide, footer + pageno 03,
//            <img> dedupe.jpg at a 200px box (appearance 2 of 2 — dedupe test)
//            <img> sizes.jpg  at a 600px box (large box — max-box test)
//   Slide 4  light theme slide, footer + pageno 04,
//            <img> alpha.png at a 50px box (real alpha channel)
//   Slide 5  dark full-bleed slide, footer + pageno 05,
//            .kn-bg background data-URI div — EXACTLY the markup
//            scripts/keynote-render.mjs emits for full-bleed images
//            (natural 3840x2160 at a 1920x1080 box → must downscale)
//
// The standard deck nav script is deliberately OMITTED — the publish scripts
// must tolerate a deck with no show-mode handler.
//
// Usage: node docs/fixtures/gen-fixture.mjs [--out <path>]   (default: alongside this script)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultOut = path.join(here, 'sample-public.html');
const fontPath = path.join(here, 'fonts', 'inter-latin-400.woff2');

let outPath = defaultOut;
{
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') outPath = path.resolve(args[++i]);
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node gen-fixture.mjs [--out <path>]');
      process.exit(0);
    } else { console.error(`unknown arg: ${args[i]}`); process.exit(2); }
  }
}

function die(msg) { console.error(`gen-fixture: ${msg}`); process.exit(1); }
function sh(cmd, args, opts = {}) {
  try { return execFileSync(cmd, args, { encoding: 'utf8', ...opts }); }
  catch (e) { die(`${cmd} ${args.join(' ')} failed: ${e.message}`); }
}

// ── 1. Real image bytes via ImageMagick ─────────────────────────────────────
if (!sh('magick', ['-version']).includes('ImageMagick')) die('magick not usable');
if (!existsSync(fontPath)) die(`font missing: ${fontPath} (commit docs/fixtures/fonts/inter-latin-400.woff2)`);

const tmp = mkdtempSync(path.join(tmpdir(), 'kn-fixture-'));
const img = (name) => path.join(tmp, name);

// dedupe.jpg — appears twice (slides 2 and 3), identical bytes → dedupe test.
sh('magick', ['-size', '200x100', 'gradient:red-blue', img('dedupe.jpg')]);
// sizes.jpg — one image at a 200px box AND a 600px box → max-box test.
//   Natural 900x450 (not 200x100) so the Task-3 contract holds:
//   output ≥ 1.35 × larger box (810px) and ≤ natural size (900px).
sh('magick', ['-size', '900x450', 'gradient:yellow-green', img('sizes.jpg')]);
// cover.jpg — cover CSS background, full-bleed data URI.
sh('magick', ['-size', '1600x900', 'gradient:purple-orange', img('cover.jpg')]);
// knbg.jpg — keynote full-bleed .kn-bg background: natural 3840x2160 at a
//   1920x1080 box → 1.35 × 0.5 = 0.675 → must resize to 2592x1458.
sh('magick', ['-size', '3840x2160', 'gradient:teal-navy', img('knbg.jpg')]);
// alpha.png — 50×50 with a REAL alpha channel (checkerboard, alpha 50%).
//   -strip drops IM's date:create/date:modify tEXt chunks so regeneration is
//   byte-identical (the JPEGs are deterministic without it).
sh('magick', ['-size', '50x50', 'pattern:checkerboard', '-alpha', 'set',
  '-channel', 'A', '-evaluate', 'set', '50%', '+channel', '-strip', img('alpha.png')]);

// verify the alpha channel is genuinely partial (1 - minima.a > 0)
const alphaProbe = sh('magick', ['identify', '-format', '%[fx:1-minima.a]', img('alpha.png')]).trim();
if (!(Number(alphaProbe) > 0)) die(`alpha.png has no real alpha (probe=${alphaProbe})`);

// ── 2. Base64 embedding ────────────────────────────────────────────────────
const b64 = (p) => readFileSync(p).toString('base64');
const uri = (p, mime) => `data:${mime};base64,${b64(p)}`;
const dedupeUri = uri(img('dedupe.jpg'), 'image/jpeg');
const sizesUri = uri(img('sizes.jpg'), 'image/jpeg');
const coverUri = uri(img('cover.jpg'), 'image/jpeg');
const knbgUri = uri(img('knbg.jpg'), 'image/jpeg');
const alphaUri = uri(img('alpha.png'), 'image/png');
const fontB64 = b64(fontPath);

// ── 3. The deck HTML (deck-convention markup, no nav script) ────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sample Public Deck</title>
<style>
/* Fixture font — a real woff2 embedded as base64. Publish scripts must leave
   font data URIs alone (only image/ data URIs get extracted). */
@font-face{font-family:'Fixture Sans';font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${fontB64}) format('woff2');}

/* Neutral-pack tokens (docs/fixtures fixture skin) */
:root{
  --accent:#3B5568; --accent-light:#5A7488; --accent-dark:#2A4050;
  --lt-bg:#FFFFFF; --lt-bg2:#F6F7F8; --lt-bg3:#ECEEF0; --lt-card-bg:#F3F5F6;
  --lt-text:#16181B; --lt-muted:#3C4248; --lt-rule:#DCDFE3;
  --lt-footer-bg:#FAFBFC; --lt-card-rule:#E4E7EA;
  --deck-bg:#0E1113; --deck-bg2:#14181B; --deck-bg3:#1B2024;
  --dk-text:#E9ECEF; --dk-muted:#9AA2A9;
  --deck-rule:rgba(90,116,136,0.28);
  --display:'Fixture Sans','Georgia',serif;
  --wordmark:'Fixture Sans','Helvetica Neue',Arial,sans-serif;
  --body-font:'Fixture Sans','Helvetica Neue',Arial,sans-serif;
  --W:1920px; --H:1080px;
}
/* Shared layout family — trimmed from packs/neutral/layouts.css (structure only) */
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#2a2a2a;font-family:var(--body-font);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;}
.slide-wrap{width:var(--W);height:var(--H);margin:28px auto;zoom:var(--fit,1);box-shadow:0 10px 50px rgba(0,0,0,.5);position:relative;}
.slide{width:var(--W);height:var(--H);overflow:hidden;position:relative;}
.slide.lt{background:var(--lt-bg);color:var(--lt-text);}
.slide.dk{background:var(--deck-bg);color:var(--dk-text);}
.footer{position:absolute;bottom:0;left:0;right:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 80px;border-top:1px solid;z-index:10;}
.lt .footer{background:var(--lt-footer-bg);border-color:var(--lt-rule);}
.dk .footer{background:transparent;border-color:var(--deck-rule);}
.footer .brand{font-family:var(--wordmark);font-weight:500;letter-spacing:0;font-size:16px;}
.lt .footer .brand{color:var(--lt-text);} .dk .footer .brand{color:var(--dk-text);}
.footer .brand .sub{font-weight:500;font-size:12px;letter-spacing:.06em;margin-left:9px;color:var(--accent-dark);}
.dk .footer .brand .sub{color:var(--accent);}
.footer .pageno{font-family:var(--display);font-size:16px;letter-spacing:.08em;}
.lt .footer .pageno{color:var(--lt-muted);opacity:.7;} .dk .footer .pageno{color:var(--dk-muted);opacity:.75;}
.header-bar{position:absolute;top:0;left:0;right:0;height:78px;display:flex;align-items:center;gap:18px;padding:0 80px;z-index:5;}
.lt .header-bar{background:var(--lt-bg2);border-bottom:1px solid var(--lt-rule);}
.header-sec{font-family:var(--body-font);font-size:12px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--accent-dark);}
.content{position:absolute;top:78px;bottom:52px;left:0;right:0;padding:64px 80px 40px;display:flex;flex-direction:column;}
.content-header{flex-shrink:0;margin-bottom:36px;}
.col-body{flex:1;min-height:0;display:flex;}
.eyebrow{font-family:var(--body-font);font-size:13px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:var(--accent-dark);margin-bottom:16px;display:block;}
.dk .eyebrow{color:var(--accent);}
.title-rule{height:2px;width:56px;background:var(--accent);margin:14px 0 18px;}
.h2{font-family:var(--display);font-weight:300;font-size:64px;line-height:1.06;letter-spacing:-.01em;}
.body{font-family:var(--body-font);font-size:21px;line-height:1.6;}
.lt .body{color:var(--lt-muted);}
.body-list{list-style:none;margin-top:8px;max-width:1180px;}
.body-list li{font-family:var(--body-font);font-size:23px;line-height:1.6;color:var(--lt-muted);padding:14px 0 14px 28px;position:relative;border-bottom:1px solid var(--lt-rule);}
.body-list li:last-child{border-bottom:none;}
.body-list li::before{content:'\\2014';position:absolute;left:0;color:var(--accent);font-size:15px;top:18px;}
.cover{display:flex;flex-direction:column;height:100%;padding:90px 80px 80px;position:relative;z-index:2;}
.cover .wm{font-family:var(--wordmark);font-weight:500;letter-spacing:0;font-size:150px;line-height:.9;color:var(--dk-text);}
.cover .wm-sub{font-family:var(--display);font-weight:300;font-size:46px;color:var(--accent);margin-top:8px;}
.cover .meta{margin-top:auto;font-family:var(--body-font);font-size:18px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;color:var(--dk-muted);line-height:1.9;}
.cover-bg{position:absolute;inset:0;}
.photo{background-size:cover;background-position:center;background-repeat:no-repeat;}
/* keynote-render.mjs' full-bleed emission (packs/neutral/layouts.css) */
.kn-bg{position:absolute;inset:0;background-size:cover;background-position:center;background-repeat:no-repeat;}
.kn-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,17,19,0) 45%,rgba(14,17,19,.82));}
/* fixture figures */
figure.fg{margin:0;flex:0 0 auto;}
figure.fg img{display:block;border:1px solid var(--lt-rule);}
figure.fg figcaption{font-family:var(--body-font);font-size:15px;color:var(--lt-muted);margin-top:10px;letter-spacing:.02em;}
@media print{
  html,body{background:#fff;}
  @page{size:1920px 1080px;margin:0;}
  .slide-wrap{zoom:1 !important;margin:0 !important;box-shadow:none !important;width:1920px !important;height:1080px !important;}
}
</style>
</head>
<body>

<!-- Slide 1 — cover. Dark, NO footer (pagenos run 02–04 on the content slides).
     CSS background data-URI image; .photo so box measurement can find it. -->
<div class="slide-wrap"><section class="slide dk" aria-label="Slide 1">
  <div class="cover-bg photo" style="background-image:url('${coverUri}');"></div>
  <div class="cover">
    <span class="eyebrow">docs/fixtures</span>
    <div class="wm">Sample Public Deck</div>
    <div class="wm-sub">The publish-stage test substrate</div>
    <div class="meta">keynote-create · Task 2 Fixture</div>
  </div>
</section></div>

<!-- Slide 2 — light content slide. dedupe.jpg appearance 1 of 2;
     sizes.jpg at its SMALL (200px) box. -->
<div class="slide-wrap"><section class="slide lt" aria-label="Slide 2">
  <div class="header-bar">
    <span class="header-sec">Fixture Deck</span>
    <span class="header-dot"></span>
    <span class="header-sec" style="color:var(--lt-muted);">Publish Stage</span>
  </div>
  <div class="content">
    <div class="content-header">
      <h2 class="h2" style="max-width:1500px;">Duplicated and resized</h2>
      <div class="title-rule"></div>
    </div>
    <div class="col-body" style="display:flex;gap:48px;align-items:flex-start;">
      <figure class="fg">
        <img src="${dedupeUri}" alt="Red-to-blue gradient, first of two identical embeds" style="width:200px;">
        <figcaption>dedupe · 200px box · 1/2</figcaption>
      </figure>
      <figure class="fg">
        <img src="${sizesUri}" alt="Yellow-to-green gradient, small box" style="width:200px;">
        <figcaption>sizes · 200px box</figcaption>
      </figure>
    </div>
  </div>
  <div class="footer"><span class="brand">Fixture Deck<span class="sub">Publish Stage</span></span><span class="pageno">02</span></div>
</section></div>

<!-- Slide 3 — light content slide. dedupe.jpg appearance 2 of 2 (identical
     bytes → must produce ONE asset file); sizes.jpg at its LARGE (600px) box. -->
<div class="slide-wrap"><section class="slide lt" aria-label="Slide 3">
  <div class="header-bar">
    <span class="header-sec">Fixture Deck</span>
    <span class="header-dot"></span>
    <span class="header-sec" style="color:var(--lt-muted);">Publish Stage</span>
  </div>
  <div class="content">
    <div class="content-header">
      <h2 class="h2" style="max-width:1500px;">The same bytes, twice more</h2>
      <div class="title-rule"></div>
    </div>
    <div class="col-body" style="display:flex;gap:48px;align-items:flex-start;">
      <figure class="fg">
        <img src="${dedupeUri}" alt="Red-to-blue gradient, second identical embed" style="width:200px;">
        <figcaption>dedupe · 200px box · 2/2</figcaption>
      </figure>
      <figure class="fg">
        <img src="${sizesUri}" alt="Yellow-to-green gradient, large box" style="width:600px;">
        <figcaption>sizes · 600px box (max)</figcaption>
      </figure>
    </div>
  </div>
  <div class="footer"><span class="brand">Fixture Deck<span class="sub">Publish Stage</span></span><span class="pageno">03</span></div>
</section></div>

<!-- Slide 4 — light theme slide with the sample-deck footer + pageno pattern.
     alpha.png: 50×50 checkerboard with a REAL alpha channel. -->
<div class="slide-wrap"><section class="slide lt" aria-label="Slide 4">
  <div class="header-bar">
    <span class="header-sec">Fixture Deck</span>
    <span class="header-dot"></span>
    <span class="header-sec" style="color:var(--lt-muted);">Publish Stage</span>
  </div>
  <div class="content">
    <div class="content-header">
      <h2 class="h2" style="max-width:1500px;">Transparency survives the pipeline</h2>
      <div class="title-rule"></div>
    </div>
    <div class="col-body" style="display:flex;gap:48px;align-items:flex-start;">
      <figure class="fg">
        <img src="${alphaUri}" alt="Checkerboard square with a half-transparent alpha channel" style="width:50px;">
        <figcaption>alpha · 50px box</figcaption>
      </figure>
      <ul class="body-list">
        <li>Alpha PNGs must stay PNG (never flattened to JPEG)</li>
        <li>Fonts stay embedded — only image data URIs are extracted</li>
        <li>The deck nav script is deliberately absent</li>
      </ul>
    </div>
  </div>
  <div class="footer"><span class="brand">Fixture Deck<span class="sub">Publish Stage</span></span><span class="pageno">04</span></div>
</section></div>

<!-- Slide 5 — keynote full-bleed slide: a .kn-bg background div, EXACTLY the
     markup scripts/keynote-render.mjs emits (knBg()). Natural 3840x2160 at a
     1920x1080 box — the measured box must drive a 2592x1458 resize. -->
<div class="slide-wrap"><section class="slide dk" aria-label="Slide 5">
  <div class="kn-bg" style="background-image:url('${knbgUri}');"></div>
  <div class="kn-scrim"></div>
  <div class="cover">
    <span class="eyebrow">docs/fixtures</span>
    <div class="wm">Full-bleed</div>
    <div class="wm-sub">Rendered as a .kn-bg background</div>
  </div>
  <div class="footer"><span class="brand">Fixture Deck<span class="sub">Publish Stage</span></span><span class="pageno">05</span></div>
</section></div>

</body>
</html>
`;

// ── 4. Write + report ───────────────────────────────────────────────────────
writeFileSync(outPath, html);
const bytes = (p) => statSync(p).size;
const kb = (n) => (n / 1024).toFixed(1) + 'KB';
console.log(`wrote ${outPath} (${kb(html.length)})`);
for (const [n, p] of [['dedupe.jpg', img('dedupe.jpg')], ['sizes.jpg', img('sizes.jpg')],
  ['cover.jpg', img('cover.jpg')], ['knbg.jpg', img('knbg.jpg')],
  ['alpha.png', img('alpha.png')], ['font.woff2', fontPath]]) {
  console.log(`  ${n.padEnd(12)} ${bytes(p)} bytes  (base64 ${Math.ceil(bytes(p) * 4 / 3)} chars)`);
}
console.log(`  alpha probe 1-minima = ${alphaProbe} (>0 → real alpha)`);
rmSync(tmp, { recursive: true, force: true });
