#!/usr/bin/env node
// web-optimize.mjs — extract, dedupe, measure, resize, lazy-load (plan Task 3).
//
// Optimizes a rendered deck for web publishing:
//   1. EXTRACT every image/ base64 data URI (font URIs are left alone);
//   2. DEDUPE identical images by content signature → one asset file each;
//   3. MEASURE each image's largest rendered box (headless chromium);
//   4. RESIZE with ImageMagick to min(natural, 1.35 × max box) — alpha PNGs
//      stay PNG, opaque sources become JPEG (photos q82, screenshots q88);
//   5. REWRITE the HTML in place with relative asset references (relative
//      to the deck's directory — matching wherever --out actually wrote)
//      and loading="lazy" decoding="async" on every <img>.
//
// Usage: node scripts/web-optimize.mjs <deck.html> [--out <dir>] [--screenshot-quality <n>]
//   --out                  asset output dir (default: <deckdir>/assets)
//   --screenshot-quality  JPEG quality for opaque PNG sources (default 88)
//
// Prints a JSON report on stdout, exit 0 on success:
//   { images: [{old, file, naturalW, naturalH, boxW, boxH, outW, outH, bytes}],
//     htmlBytesBefore, htmlBytesAfter, assetsBytes }

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { extractSpans, dedupe } from './lib/extract-images.mjs';
import { measureBoxes } from './lib/measure-boxes.mjs';

// ── args ─────────────────────────────────────────────────────────────────────
let deckPath = null;
let outDir = null;
let screenshotQuality = 88;
{
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--out') outDir = path.resolve(args[++i]);
    else if (args[i] === '--screenshot-quality') screenshotQuality = Number(args[++i]);
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node web-optimize.mjs <deck.html> [--out <dir>] [--screenshot-quality <n>]');
      process.exit(0);
    } else if (!deckPath) deckPath = path.resolve(args[i]);
    else { console.error(`web-optimize: unknown arg: ${args[i]}`); process.exit(2); }
  }
}
if (!deckPath || !existsSync(deckPath)) {
  console.error('web-optimize: deck HTML path required (and must exist)');
  process.exit(2);
}
if (outDir === null) outDir = path.join(path.dirname(deckPath), 'assets');
// Asset refs are written relative to the DECK's own directory, so the HTML
// keeps working wherever --out points (Hard Rule 8: no silently broken deck).
// Default <deckdir>/assets → prefix 'assets/' (existing behavior); an --out
// elsewhere (even outside the deck dir) → '../custom-assets/' etc.
const refPrefix = (() => {
  const rel = path.relative(path.dirname(deckPath), outDir).split(path.sep).join('/');
  return rel === '' ? '' : `${rel}/`;
})();

const sh = (cmd, argv, opts = {}) =>
  execFileSync(cmd, argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });

// ── 1+2. extract + dedupe ────────────────────────────────────────────────────
const htmlBefore = readFileSync(deckPath, 'utf8');
const spans = extractSpans(htmlBefore); // every occurrence, with span positions
const unique = [...dedupe(spans).values()] // first occurrence per signature
  .sort((a, b) => a.firstStart - b.firstStart); // deterministic filename order

// ── 3. measure rendered boxes (largest box per signature wins) ───────────────
const boxes = await measureBoxes(deckPath);

// SVG dimension parsing — magick's SVG rasterizer needs fonts and exits 1 on
// text-bearing SVGs (seen on the Adelaide reference deck), so never hand SVGs
// to magick: read the root <svg> tag's width/height attrs, else viewBox.
function svgDims(buf) {
  const root = buf.toString('utf8').match(/<svg\b[^>]*>/);
  if (!root) return null;
  const tag = root[0];
  const w = tag.match(/\bwidth\s*=\s*["']([\d.]+)/);
  const h = tag.match(/\bheight\s*=\s*["']([\d.]+)/);
  if (w && h) return { natW: Math.round(Number(w[1])), natH: Math.round(Number(h[1])) };
  const vb = tag.match(/\bviewBox\s*=\s*["']\s*[\d.\s-]+\s+([\d.]+)\s+([\d.]+)/);
  if (vb) return { natW: Math.round(Number(vb[1])), natH: Math.round(Number(vb[2])) };
  return null;
}

// ── 4. resize + encode each unique image ────────────────────────────────────
const tmp = mkdtempSync(path.join(tmpdir(), 'kn-webopt-'));
const EXT = { jpeg: 'jpg', png: 'png', 'svg+xml': 'svg' };
const fileForSig = new Map(); // sig → assets-relative filename
const reportImages = [];

try {
  for (let i = 0; i < unique.length; i++) {
    const u = unique[i];
    const buf = Buffer.from(u.b64, 'base64');
    const srcFile = path.join(tmp, `src-${i}.${EXT[u.mime]}`);
    writeFileSync(srcFile, buf);

    // natural dimensions (SVG: parsed from XML — never rasterized via magick)
    let natW, natH;
    if (u.mime === 'svg+xml') {
      const d = svgDims(buf);
      natW = d ? d.natW : 0; natH = d ? d.natH : 0;
    } else {
      [natW, natH] = sh('magick', ['identify', '-format', '%w %h', srcFile]).trim().split(/\s+/).map(Number);
    }

    // rendered box (images that never render keep their natural size)
    const box = boxes.get(u.sig) || { boxW: natW, boxH: natH };
    if (!natW || !natH) { natW = box.boxW; natH = box.boxH; } // unparseable SVG fallback

    // target size: 1.35× the largest box, never upscaled past natural
    const s = Math.min(1, 1.35 * Math.max(box.boxW / natW, box.boxH / natH));
    const outW = Math.max(1, Math.round(natW * s));
    const outH = Math.max(1, Math.round(natH * s));

    // real-alpha probe: channel list mentions 'a' AND the alpha plane has
    // a min < 1 (PIL-style extrema check via -alpha extract).
    // NOTE: the plan's %[fx:1-minima.g] is broken on IM 7.1.2-31 (returns
    // ~-2.7e+303 garbage on the extracted grayscale); the channel-less
    // %[fx:1-minima] form is the working equivalent (verified 0.498 on the
    // fixture's 50%-alpha checkerboard).
    let hasAlpha = false;
    if (u.mime === 'png') {
      const channels = sh('magick', ['identify', '-format', '%[channels]', srcFile]).trim();
      if (channels.split(/\s+/).some(c => /a$/.test(c))) {
        const probe = sh('magick', [srcFile, '-alpha', 'extract', '-format', '%[fx:1-minima]', 'info:']).trim();
        hasAlpha = Number(probe) > 0;
      }
    }

    const name = `img-${String(i + 1).padStart(2, '0')}`;
    if (u.mime === 'svg+xml') {
      // vector: ship as-is, no rasterize/resize
      const file = `${name}.svg`;
      mkdirSync(outDir, { recursive: true });
      writeFileSync(path.join(outDir, file), buf);
      fileForSig.set(u.sig, file);
      reportImages.push({
        old: buf.length, file,
        naturalW: natW, naturalH: natH, boxW: box.boxW, boxH: box.boxH,
        outW: natW, outH: natH, bytes: buf.length,
      });
      continue;
    }

    mkdirSync(outDir, { recursive: true });
    let file;
    if (hasAlpha) {
      file = `${name}.png`;
      sh('magick', [srcFile, '-resize', `${outW}x${outH}`, '-strip',
        '-define', 'png:compression-level=9', path.join(outDir, file)]);
    } else {
      file = `${name}.jpg`;
      const q = u.mime === 'png' ? screenshotQuality : 82; // screenshots 88, photos 82
      sh('magick', [srcFile, '-resize', `${outW}x${outH}`, '-strip',
        '-quality', String(q), '-interlace', 'Plane', path.join(outDir, file)]);
    }
    fileForSig.set(u.sig, file);
    reportImages.push({
      old: buf.length, file,
      naturalW: natW, naturalH: natH, boxW: box.boxW, boxH: box.boxH,
      outW, outH, bytes: statSync(path.join(outDir, file)).size,
    });
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ── 5. rewrite HTML: spans back-to-front, then lazy/async on every <img> ─────
let html = htmlBefore;
for (let i = spans.length - 1; i >= 0; i--) {
  const sp = spans[i];
  const file = fileForSig.get(sp.sig);
  if (!file) continue; // unhandled mime (shouldn't happen)
  html = html.slice(0, sp.start) + refPrefix + file + html.slice(sp.end);
}
html = html.replace(/<img\b([^>]*)>/g, (m, attrs) =>
  /\bloading=/.test(attrs) ? m : `<img loading="lazy" decoding="async"${attrs}>`);

writeFileSync(deckPath, html);

// ── report ───────────────────────────────────────────────────────────────────
const report = {
  images: reportImages,
  htmlBytesBefore: Buffer.byteLength(htmlBefore),
  htmlBytesAfter: Buffer.byteLength(html),
  assetsBytes: reportImages.reduce((a, i) => a + i.bytes, 0),
};
console.log(JSON.stringify(report, null, 2));
