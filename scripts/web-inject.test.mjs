#!/usr/bin/env node
// web-inject.test.mjs — node:test suite for scripts/web-inject.mjs (plan Task 4).
//
// Runs the script against COPIES of docs/fixtures/sample-public.html in temp
// dirs (the script rewrites HTML in place), then asserts the brief's contract:
//   - meta description, og:title, og:url, canonical, twitter:card present with
//     correct values; meta block sits BEFORE <title>;
//   - .present-btn / .present-exit / .rotate-hint / .deck-hint CSS rules with
//     z-index 9999, the (max-width:720px),(pointer:coarse) gating and print
//     rules, injected as a <style> before </head>;
//   - the JS (before </body>) contains the synthetic-key dispatch, swipe
//     handlers, and the MutationObserver rotate-hint with an immediate
//     checkRotate() call;
//   - idempotence: a second run changes nothing;
//   - --url absent is a hard error; --description defaults to
//     "<title> — a talk by <og:site/brand>"; attribute values are escaped;
//   - I-1 carry-forward (Task 3 review): a deck whose images already reference
//     assets/ (optimized by web-optimize) injects cleanly and its asset
//     references are byte-identical before/after.
//
// Run: node --test scripts/web-inject.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(HERE);
const SCRIPT = path.join(HERE, 'web-inject.mjs');
const FIXTURE = path.join(REPO, 'docs/fixtures/sample-public.html');
const MARKER = '/* site addition */';

const URL_ = 'https://example.com/talks/sample-public/';
const DESC = 'A test description for the sample public deck.';
// hand-escaped expectation — deliberately NOT computed with the script's own
// escaper, so an escaping bug cannot hide behind a shared heuristic.
const DESC_TRICKY = 'He said "deck" & <presented> it';
const DESC_TRICKY_ESCAPED = 'He said &quot;deck&quot; &amp; &lt;presented&gt; it';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-webinject-'));
function freshDeck(name) {
  const p = path.join(TMP, name);
  fs.copyFileSync(FIXTURE, p);
  return p;
}
function inject(deck, extraArgs = []) {
  return spawnSync('node', [SCRIPT, deck, ...extraArgs], { encoding: 'utf8' });
}
// pull one attribute value out of a tag (regex parse, no DOM needed)
function attr(html, tagRe, attrName) {
  const tag = html.match(tagRe);
  if (!tag) return undefined;
  const m = tag[0].match(new RegExp(`${attrName}="([^"]*)"`));
  return m ? m[1] : undefined;
}

// ── the runs (shared by all assertions) ──────────────────────────────────────

// run 0: missing --url (hard error)
const deckNoUrl = freshDeck('no-url.html');
const runNoUrl = inject(deckNoUrl);

// run 1: explicit description
const deckMain = freshDeck('main.html');
const run1 = inject(deckMain, ['--url', URL_, '--description', DESC]);
const mainHtml = fs.readFileSync(deckMain, 'utf8');
const report1 = run1.status === 0 ? JSON.parse(run1.stdout) : null;

// run 2: idempotence (same file, same args)
const bytesAfterRun1 = fs.readFileSync(deckMain);
const run2 = inject(deckMain, ['--url', URL_, '--description', DESC]);
const bytesAfterRun2 = fs.readFileSync(deckMain);
const report2 = run2.status === 0 ? JSON.parse(run2.stdout) : null;

// run 3: default description (no --description) — fresh copy
const deckDefault = freshDeck('default.html');
const run3 = inject(deckDefault, ['--url', URL_]);
const defaultHtml = fs.readFileSync(deckDefault, 'utf8');
const report3 = run3.status === 0 ? JSON.parse(run3.stdout) : null;

// run 4: escaping — description with quotes/ampersands/angle brackets
const deckTricky = freshDeck('tricky.html');
const run4 = inject(deckTricky, ['--url', URL_, '--description', DESC_TRICKY]);
const trickyHtml = run4.status === 0 ? fs.readFileSync(deckTricky, 'utf8') : '';

// run 5: assets-referencing (web-optimize output style) deck — I-1 tolerance
const deckAssets = freshDeck('assets.html');
{
  // stand in for web-optimize output: swap image data URIs for assets/ refs
  // (font data URIs are data:font/ and are NOT matched)
  let i = 0;
  let variant = fs.readFileSync(deckAssets, 'utf8')
    .replace(/data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g,
      () => `assets/img-${String(++i).padStart(2, '0')}.jpg`);
  fs.writeFileSync(deckAssets, variant);
}
const assetsRefsBefore = [...fs.readFileSync(deckAssets, 'utf8')
  .matchAll(/assets\/[A-Za-z0-9._-]+/g)].map(m => m[0]);
const run5 = inject(deckAssets, ['--url', URL_, '--description', DESC]);
const assetsHtml = run5.status === 0 ? fs.readFileSync(deckAssets, 'utf8') : '';
const assetsRefsAfter = [...assetsHtml.matchAll(/assets\/[A-Za-z0-9._-]+/g)].map(m => m[0]);

// run 6 (F1 fix, Task 8 round 1): hand-styled additions — additions ported
// before web-inject existed carry different marker comments, so the canonical
// marker check misses them. The script must detect them by behavioral
// fingerprint (CSS rules / keydown dispatch + present-btn / og:title meta),
// say what it detected, and leave the file byte-identical.
function handStyled(name, { css = false, js = false, og = false } = {}) {
  const p = path.join(TMP, name);
  let h = fs.readFileSync(FIXTURE, 'utf8');
  if (og) h = h.replace('<title>',
    '<meta property="og:title" content="Hand Ported Deck">\n<title>');
  if (css) h = h.replace('</head>',
    '<style>\n/* Mobile present controls (site addition) */\n' +
    '.present-btn{position:fixed;bottom:16px;right:16px;z-index:99}\n' +
    '.deck-hint{position:fixed;z-index:99}\n</style>\n</head>');
  if (js) h = h.replace('</body>',
    '<script>\n/* hand-ported additions — predates the script, no canonical marker */\n' +
    "const key = k => new KeyboardEvent('keydown', {key: k});\n" +
    "const btn = document.createElement('button');\n" +
    "btn.className = 'present-btn';\n" +
    "btn.addEventListener('click', () => key('p'));\n" +
    'document.body.appendChild(btn);\n</script>\n</body>');
  fs.writeFileSync(p, h);
  return p;
}
function injectExpectSkip(p) {
  const before = fs.readFileSync(p);
  const r = inject(p, ['--url', URL_, '--description', DESC]);
  const after = fs.readFileSync(p);
  return { r, unchanged: Buffer.compare(before, after) === 0 };
}

const handAll = injectExpectSkip(handStyled('hand-all.html', { css: true, js: true, og: true }));
const handCss = injectExpectSkip(handStyled('hand-css.html', { css: true }));
const handJs  = injectExpectSkip(handStyled('hand-js.html', { js: true }));
const handOg  = injectExpectSkip(handStyled('hand-og.html', { og: true }));

// ── tests ────────────────────────────────────────────────────────────────────

test('missing --url is a hard error (nonzero exit, message names --url)', () => {
  assert.notEqual(runNoUrl.status, 0, 'must not exit 0 without --url');
  assert.equal(runNoUrl.status, 1, 'hard error exit code is 1');
  assert.match(runNoUrl.stderr, /--url/, 'stderr mentions --url');
});

test('script exits 0 and prints valid JSON report', () => {
  assert.equal(run1.status, 0, `stderr: ${run1.stderr}`);
  assert.ok(report1, 'report JSON parses');
  assert.equal(report1.injected, true);
  for (const key of ['url', 'title', 'description', 'htmlBytesBefore', 'htmlBytesAfter']) {
    assert.ok(report1[key] !== undefined, `report missing ${key}`);
  }
});

test('meta/OG/Twitter + canonical present with correct values', () => {
  assert.equal(attr(mainHtml, /<meta name="description"[^>]*>/, 'content'), DESC);
  assert.equal(attr(mainHtml, /<meta property="og:title"[^>]*>/, 'content'), 'Sample Public Deck');
  assert.equal(attr(mainHtml, /<meta property="og:description"[^>]*>/, 'content'), DESC);
  assert.equal(attr(mainHtml, /<meta property="og:type"[^>]*>/, 'content'), 'article');
  assert.equal(attr(mainHtml, /<meta property="og:url"[^>]*>/, 'content'), URL_);
  assert.equal(attr(mainHtml, /<meta name="twitter:card"[^>]*>/, 'content'), 'summary');
  assert.equal(attr(mainHtml, /<meta name="twitter:title"[^>]*>/, 'content'), 'Sample Public Deck');
  assert.equal(attr(mainHtml, /<meta name="twitter:description"[^>]*>/, 'content'), DESC);
  assert.equal(attr(mainHtml, /<link rel="canonical"[^>]*>/, 'href'), URL_);
});

test('meta block sits before <title>', () => {
  assert.ok(mainHtml.indexOf('<meta name="description"') > -1, 'meta description present');
  assert.ok(mainHtml.indexOf('<title>') > -1, 'fixture title present');
  assert.ok(mainHtml.indexOf('<meta name="description"') < mainHtml.indexOf('<title>'),
    'injected meta must precede <title>');
});

test('CSS block: rules, z-index 9999, mobile gating, print rules — before </head>', () => {
  for (const rule of ['.deck-hint{', '.present-btn{', '.present-exit{', '.rotate-hint{']) {
    assert.ok(mainHtml.includes(rule), `CSS rule missing: ${rule}`);
  }
  const z = mainHtml.match(/z-index:9999/g) || [];
  assert.ok(z.length >= 4, `expected >=4 z-index:9999 (one per fixed control), got ${z.length}`);
  assert.ok(mainHtml.includes('@media (max-width:720px),(pointer:coarse)'),
    'mobile/coarse media gating present');
  assert.ok(/@media print/.test(mainHtml), 'print rules present');
  const headClose = mainHtml.indexOf('</head>');
  assert.ok(headClose > -1);
  const styleMarker = mainHtml.indexOf(MARKER);
  assert.ok(styleMarker > -1 && styleMarker < headClose, 'style block injected before </head>');
});

test('JS block: synthetic-key dispatch, swipe handlers, MutationObserver + immediate checkRotate', () => {
  const bodyClose = mainHtml.indexOf('</body>');
  assert.ok(bodyClose > -1);
  const lastMarker = mainHtml.lastIndexOf(MARKER);
  assert.ok(lastMarker > mainHtml.indexOf('</head>') && lastMarker < bodyClose,
    'script block injected before </body>');
  const js = mainHtml.slice(lastMarker, bodyClose);
  assert.ok(js.includes("new KeyboardEvent('keydown',{key:k})"),
    'synthetic-key dispatch via KeyboardEvent');
  assert.ok(js.includes("key('p')"), 'p dispatched to enter present mode');
  assert.ok(js.includes("key('Escape')"), 'Escape dispatched to exit');
  assert.ok(js.includes("key('ArrowRight')") && js.includes("key('ArrowLeft')"),
    'swipe directions dispatched');
  for (const ev of ['touchstart', 'touchmove', 'touchend']) {
    assert.ok(js.includes(`'${ev}'`), `swipe handler ${ev} present`);
  }
  assert.ok(js.includes('>40'), '40px swipe threshold preserved');
  const obs = js.indexOf('new MutationObserver(checkRotate)');
  assert.ok(obs > -1, 'MutationObserver on body class');
  const immediate = js.indexOf('checkRotate();', obs);
  assert.ok(immediate > -1, 'immediate checkRotate() call after observer setup');
});

test('idempotence: second run changes nothing', () => {
  assert.equal(run2.status, 0, `stderr: ${run2.stderr}`);
  assert.ok(report2, 'second run prints JSON');
  assert.equal(report2.injected, false, 'report says nothing injected');
  assert.ok(Buffer.compare(bytesAfterRun1, bytesAfterRun2) === 0,
    'file bytes identical after second run');
  assert.equal((mainHtml.match(new RegExp(MARKER.replace(/[*/]/g, '\\$&'), 'g')) || []).length, 2,
    'exactly two marker comments (style + script), not four');
});

test('default description: <title> — a talk by <brand>', () => {
  assert.equal(run3.status, 0, `stderr: ${run3.stderr}`);
  assert.ok(report3, 'report JSON parses');
  assert.equal(report3.description, 'Sample Public Deck — a talk by Fixture Deck',
    'title + brand default');
  assert.equal(attr(defaultHtml, /<meta property="og:description"[^>]*>/, 'content'),
    'Sample Public Deck — a talk by Fixture Deck');
});

test('attribute values are HTML-escaped', () => {
  assert.equal(run4.status, 0, `stderr: ${run4.stderr}`);
  assert.equal(attr(trickyHtml, /<meta name="description"[^>]*>/, 'content'), DESC_TRICKY_ESCAPED);
  assert.equal(attr(trickyHtml, /<meta property="og:description"[^>]*>/, 'content'), DESC_TRICKY_ESCAPED);
  // the raw, unescaped description never appears as an attribute value
  assert.ok(!trickyHtml.includes(`content="${DESC_TRICKY}"`),
    'unescaped description must not leak into an attribute');
});

test('I-1 tolerance: assets/-referencing deck injects cleanly, refs untouched', () => {
  assert.equal(run5.status, 0, `stderr: ${run5.stderr}`);
  assert.ok(assetsRefsBefore.length >= 5, 'variant deck has assets/ references');
  assert.deepEqual(assetsRefsAfter, assetsRefsBefore,
    'every assets/ reference byte-identical after injection');
  assert.ok(assetsHtml.includes(MARKER), 'injection happened');
  assert.ok(assetsHtml.includes('data:font/woff2;base64,'),
    'embedded font still intact (inject touches only meta/style/script)');
});

test('F1: hand-styled additions (no canonical markers) → skipped with message, file byte-identical', () => {
  assert.equal(handAll.r.status, 0, `stderr: ${handAll.r.stderr}`);
  const msg = handAll.r.stdout.trim();
  assert.match(msg, /^site additions already present \(fingerprint: .+\) — skipping injection$/,
    'skip must SAY what was detected (no silent no-op)');
  for (const fp of ['css-rule', 'js-key-dispatch', 'og:title-meta']) {
    assert.ok(msg.includes(fp), `fingerprint "${fp}" named in message: ${msg}`);
  }
  assert.ok(handAll.unchanged, 'file must be byte-identical after the skipped run');
  const h = fs.readFileSync(path.join(TMP, 'hand-all.html'), 'utf8');
  assert.ok(!h.includes(MARKER), 'no canonical marker was added');
  assert.ok(!h.includes('Injected by scripts/web-inject.mjs'), 'nothing was injected');
});

test('F1: each fingerprint alone is enough to skip (css / js / og:title)', () => {
  for (const [label, run, fp] of [
    ['css-rule', handCss, 'css-rule'],
    ['js-key-dispatch', handJs, 'js-key-dispatch'],
    ['og:title-meta', handOg, 'og:title-meta'],
  ]) {
    assert.equal(run.r.status, 0, `${label}: stderr ${run.r.stderr}`);
    const msg = run.r.stdout.trim();
    assert.match(msg, /^site additions already present \(fingerprint: .+\) — skipping injection$/,
      `${label}: skip message present`);
    assert.ok(msg.includes(fp), `${label}: message names its fingerprint: ${msg}`);
    assert.ok(run.unchanged, `${label}: file byte-identical after skip`);
  }
});
