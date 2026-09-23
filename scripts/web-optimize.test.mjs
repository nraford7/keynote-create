#!/usr/bin/env node
// web-optimize.test.mjs — node:test suite for scripts/web-optimize.mjs (plan Task 3).
//
// Runs the script against a COPY of docs/fixtures/sample-public.html in a temp
// dir (the script rewrites HTML in place and writes assets/ next to it), then
// asserts the brief's five contract points:
//   (a) rewritten HTML uses assets/ refs; zero image/ base64 data URIs
//       (font data URI must SURVIVE);
//   (b) the duplicated image produced ONE file referenced twice;
//   (c) every <img> carries loading="lazy" (and decoding="async");
//   (d) total assets bytes < sum of the original (unique) base64 payload bytes;
//   (e) the reused-at-two-sizes image: file dimensions >= 1.35 x its LARGER box
//       and <= natural size — the fixture hits the 810px bound EXACTLY, so
//       tolerances are ±2px, never approximate percentages.
//
// Run: node --test scripts/web-optimize.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(HERE);
const SCRIPT = path.join(HERE, 'web-optimize.mjs');
const FIXTURE = path.join(REPO, 'docs/fixtures/sample-public.html');

// ── helpers ─────────────────────────────────────────────────────────────────
// Extract image data URIs (mime + base64 payload) with span positions.
const URI_RE = /data:image\/(jpeg|png|svg\+xml);base64,([A-Za-z0-9+/=]+)/g;
function extractImageUris(html) {
  const out = [];
  for (const m of html.matchAll(URI_RE)) {
    out.push({ index: m.index, end: m.index + m[0].length, mime: m[1], b64: m[2] });
  }
  return out;
}
// Brief's signature formula — same collision heuristic the script itself uses.
function signature(b) {
  const t = b.replaceAll('=', '');
  return t.length + ':' + t.slice(0, 24) + ':' + t.slice(-24);
}
function identify(file) {
  // "WxH" of an image file via ImageMagick
  const out = execFileSync('magick', ['identify', '-format', '%wx%h', file], { encoding: 'utf8' });
  const [w, h] = out.split('x').map(Number);
  return { w, h };
}

// ── the run (shared by all assertions) ──────────────────────────────────────
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-webopt-'));
const deckPath = path.join(TMP, 'sample-public.html');
fs.copyFileSync(FIXTURE, deckPath);

const run = spawnSync('node', [SCRIPT, deckPath], { encoding: 'utf8' });
const report = run.status === 0 ? JSON.parse(run.stdout) : null;
const outHtml = fs.readFileSync(deckPath, 'utf8');
const assetsDir = path.join(TMP, 'assets');
const assetFiles = fs.existsSync(assetsDir)
  ? fs.readdirSync(assetsDir).filter(f => !f.startsWith('.')).map(f => path.join(assetsDir, f))
  : [];

// Pre-state for byte accounting (fixture content, computed from the ORIGINAL).
const originalHtml = fs.readFileSync(FIXTURE, 'utf8');
const originalUris = extractImageUris(originalHtml);
const originalUnique = new Map(); // sig -> decoded byte length
for (const u of originalUris) {
  const sig = signature(u.b64);
  if (!originalUnique.has(sig)) originalUnique.set(sig, Buffer.from(u.b64, 'base64').length);
}
const originalUniqueBytes = [...originalUnique.values()].reduce((a, b) => a + b, 0);

// ── tests ────────────────────────────────────────────────────────────────────

test('script exits 0 and prints valid JSON report', () => {
  assert.equal(run.status, 0, `stderr: ${run.stderr}`);
  assert.ok(report, 'report JSON parses');
  assert.ok(Array.isArray(report.images) && report.images.length > 0, 'images array');
  for (const key of ['htmlBytesBefore', 'htmlBytesAfter', 'assetsBytes']) {
    assert.ok(Number.isInteger(report[key]), `${key} integer`);
  }
});

test('(a) HTML rewritten to assets/ refs; zero image/ base64; font stays embedded', () => {
  assert.match(outHtml, /assets\//, 'assets/ reference present');
  assert.equal(extractImageUris(outHtml).length, 0, 'no image/ base64 data URIs remain');
  assert.match(outHtml, /data:font\/woff2;base64,/, 'font data URI survives');
});

test('(b) duplicated image produced ONE file referenced twice', () => {
  // fixture has 5 unique images (cover, dedupe, sizes, alpha, kn-bg) → 5 asset files
  assert.equal(assetFiles.length, 5, `expected 5 asset files, got ${assetFiles.length}`);
  // 7 references: 5 <img> (dedupe ×2, sizes ×2, alpha ×1) + 2 css bgs (.photo cover, .kn-bg)
  const refs = [...outHtml.matchAll(/assets\/[A-Za-z0-9._-]+/g)].map(m => m[0]);
  assert.equal(refs.length, 7, `expected 7 asset references, got ${refs.length}`);
  // the two IDENTICAL dedupe embeds (marked by alt text) → same one file
  const dupTags = [...outHtml.matchAll(/<img\b[^>]*>/g)].map(m => m[0])
    .filter(t => /identical embed/.test(t));
  assert.equal(dupTags.length, 2, 'two dedupe <img> embeds found');
  const srcs = dupTags.map(t => t.match(/src="([^"]+)"/)[1]);
  assert.equal(srcs[0], srcs[1], `dedupe embeds share ONE file (${srcs.join(' vs ')})`);
  assert.ok(report.images.some(i => `assets/${i.file}` === srcs[0]), 'duplicated asset in report');
});

test('(c) every <img> has loading="lazy" and decoding="async"', () => {
  const imgTags = [...outHtml.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  assert.ok(imgTags.length === 5, `expected 5 <img> tags (dedupe ×2, sizes ×2, alpha), got ${imgTags.length}`);
  for (const tag of imgTags) {
    assert.match(tag, /loading="lazy"/, `missing loading in: ${tag.slice(0, 60)}`);
    assert.match(tag, /decoding="async"/, `missing decoding in: ${tag.slice(0, 60)}`);
  }
});

test('(d) total assets bytes < sum of original base64 payload bytes', () => {
  const totalAssets = assetFiles.reduce((a, f) => a + fs.statSync(f).size, 0);
  assert.ok(totalAssets < originalUniqueBytes,
    `assets ${totalAssets}B not < original unique ${originalUniqueBytes}B`);
  assert.equal(report.assetsBytes, totalAssets, 'report assetsBytes matches disk');
});

test('(e) reused-at-two-sizes image: file dims >= 1.35 x LARGER box (±2px) and <= natural (±2px)', () => {
  // sizes.jpg: natural 900x450, boxes 200px and 600px (larger box = 600 wide).
  // s = min(1, 1.35 * max(600/900, 300/450)) = 0.9 exactly → 810x405. ZERO slack.
  const entry = report.images.find(i => i.naturalW === 900 && i.naturalH === 450);
  assert.ok(entry, 'sizes image (900x450 natural) present in report');
  assert.equal(entry.boxW, 600, 'max box is the 600px appearance');
  const TOL = 2;
  assert.ok(entry.outW >= Math.ceil(1.35 * entry.boxW) - TOL,
    `outW ${entry.outW} < 1.35*600-2 (${Math.ceil(1.35 * entry.boxW) - TOL})`);
  assert.ok(entry.outW <= entry.naturalW + TOL,
    `outW ${entry.outW} > natural+2 (${entry.naturalW + TOL})`);
  // verify the FILE on disk, not just the report's claim
  const file = path.join(assetsDir, entry.file);
  assert.ok(fs.existsSync(file), `asset file exists: ${entry.file}`);
  const { w, h } = identify(file);
  assert.ok(w >= Math.ceil(1.35 * entry.boxW) - TOL, `disk w ${w} < 808`);
  assert.ok(w <= entry.naturalW + TOL, `disk w ${w} > 902`);
  assert.ok(Math.abs(h - Math.round(w / 2)) <= 2, 'aspect preserved (2:1)');
});

test('report images carry the full schema', () => {
  for (const i of report.images) {
    for (const key of ['old', 'file', 'naturalW', 'naturalH', 'boxW', 'boxH', 'outW', 'outH', 'bytes']) {
      assert.ok(i[key] !== undefined, `image entry missing ${key}`);
    }
    assert.ok(fs.existsSync(path.join(assetsDir, i.file)), `file on disk: ${i.file}`);
  }
});

test('alpha image stays PNG (transparency survives)', () => {
  const entry = report.images.find(i => i.file.endsWith('.png'));
  assert.ok(entry, 'a .png asset exists');
  // alpha.png: 50x50 box, 50x50 natural → s = 1 → unchanged size
  assert.equal(entry.outW, 50); assert.equal(entry.outH, 50);
  const probe = execFileSync('magick',
    [path.join(assetsDir, entry.file), '-alpha', 'extract', '-format', '%[fx:1-minima]', 'info:'],
    { encoding: 'utf8' }).trim();
  assert.ok(Number(probe) > 0, `alpha channel real (probe=${probe})`);
});

test('kn-bg background image gets a measured box and is downscaled (C1 regression)', () => {
  // Slide 5: keynote-render.mjs' full-bleed emission — <div class="kn-bg" style="background-image:url(data:...)"/>
  // natural 3840x2160 at a 1920x1080 slide box: s = min(1, 1.35 * 0.5) = 0.675
  // → 3840*0.675 = 2592 exactly, 2160*0.675 = 1458 exactly.
  const entry = report.images.find(i => i.naturalW === 3840 && i.naturalH === 2160);
  assert.ok(entry, 'kn-bg image (3840x2160 natural) present in report');
  assert.equal(entry.boxW, 1920, `kn-bg box measured (${entry.boxW}x${entry.boxH}, expected the 1920x1080 slide)`);
  assert.equal(entry.boxH, 1080, 'kn-bg box height');
  const TOL = 2;
  assert.ok(Math.abs(entry.outW - 2592) <= TOL, `outW ${entry.outW} != 2592±2`);
  assert.ok(Math.abs(entry.outH - 1458) <= TOL, `outH ${entry.outH} != 1458±2`);
  // verify the FILE on disk, not just the report's claim
  const file = path.join(assetsDir, entry.file);
  assert.ok(fs.existsSync(file), `asset file exists: ${entry.file}`);
  const { w, h } = identify(file);
  assert.ok(Math.abs(w - 2592) <= TOL && Math.abs(h - 1458) <= TOL,
    `disk ${w}x${h} != 2592x1458±2 — kn-bg written unmeasured`);
  // and the .kn-bg style block references the rewritten asset (span replacement
  // keeps the surrounding url('…') quoting from the fixture)
  assert.ok(outHtml.includes(`background-image:url('assets/${entry.file}')`),
    'rewritten .kn-bg background references the asset');
});

// ── --out: refs must follow the actual output dir (final review I-2) ─────────
const TMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-webopt-out-'));
// deck in a SUBDIR, assets written OUTSIDE it (above the deck dir) → the
// correct ref prefix is '../custom-assets/'; default assets/ refs would be
// dangling (files land in custom-assets/, HTML would point at <subdir>/assets)
const subDir = path.join(TMP2, 'sub');
fs.mkdirSync(subDir);
const deck2 = path.join(subDir, 'sample-public.html');
fs.copyFileSync(FIXTURE, deck2);
const customOut = path.join(TMP2, 'custom-assets');

const run2 = spawnSync('node', [SCRIPT, deck2, '--out', customOut], { encoding: 'utf8' });
const outHtml2 = fs.readFileSync(deck2, 'utf8');
const customFiles = fs.existsSync(customOut)
  ? fs.readdirSync(customOut).filter(f => !f.startsWith('.')).map(f => path.join(customOut, f))
  : [];

test('--out: refs are relative to the deck dir and files exist there (I-2)', () => {
  assert.equal(run2.status, 0, `stderr: ${run2.stderr}`);
  const report2 = JSON.parse(run2.stdout);
  assert.equal(report2.images.length, 5, 'all five images written');
  // files really landed in the custom dir
  assert.equal(customFiles.length, 5, `expected 5 files in custom-assets, got ${customFiles.length}`);
  // every rewritten ref points INTO that dir from the deck's location
  const refs = [...outHtml2.matchAll(/(\.{2}\/[A-Za-z0-9._\/-]+|[A-Za-z0-9_-]+\/[A-Za-z0-9._/-]+)img-[\d.]+\.(jpg|png|svg)/g)].map(m => m[0]);
  assert.ok(refs.length >= 7, `expected >=7 asset refs, got ${refs.length}`);
  for (const r of new Set(refs)) {
    assert.ok(r.startsWith('../custom-assets/'), `ref ${r} not under ../custom-assets/`);
    const abs = path.resolve(subDir, r);
    assert.ok(fs.existsSync(abs), `referenced file missing on disk: ${r}`);
  }
  // no dangling default assets/ refs remain
  assert.doesNotMatch(outHtml2, /["'(]assets\//, 'HTML still points at default assets/ dir');
  // and the default-run HTML (same fixture, default --out) still uses assets/
  assert.match(outHtml, /["'(]assets\//, 'default run keeps assets/ prefix');
});
