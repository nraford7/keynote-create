#!/usr/bin/env node
// keynote-verify.test.mjs — node:test suite for scripts/keynote-verify.mjs (plan Task 5).
//
// Composes the full publish pipeline on COPIES of the Task-2 fixture
// (web-optimize → web-inject, both on temp copies), then runs the verify
// suite against the composed deck:
//
//   run A (good deck, default flags)  — every line PASS or SKIPPED, exit 0.
//       The fixture has NO deck nav script, so all present-flow checks must
//       come out SKIPPED (with a reason naming the missing show-mode
//       handler) — never FAIL, never silently absent.
//   run B (deliberately broken deck)   — the false-PASS guard: an injected
//       style pushes .body-list into the footer band and one <img> src is
//       missing. The suite MUST fail exactly those checks (chrome
//       clearance, images) while geometry/overflow — which is NOT broken —
//       still passes. Proves the suite can fail.
//   run C (good deck, --mobile --throttle) — mobile controls visible in a
//       hasTouch-without-isMobile context, present-flow mobile checks
//       SKIPPED (no nav), first contentful paint under throttle < 2.5s.
//
// Run: node --test scripts/keynote-verify.test.mjs
// (slow: three full browser suites, ~2–3 min)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(HERE);
const VERIFY = path.join(HERE, 'keynote-verify.mjs');
const OPTIMIZE = path.join(HERE, 'web-optimize.mjs');
const INJECT = path.join(HERE, 'web-inject.mjs');
const FIXTURE = path.join(REPO, 'docs/fixtures/sample-public.html');
const CANON = 'https://example.com/talks/sample-public/';

// ── the composed decks (module-level, shared by all assertions) ─────────────

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-verify-'));

// good deck: copy → optimize (extract/dedupe/resize/lazy) → inject (meta+chrome)
const goodDeck = path.join(TMP, 'good', 'sample-public.html');
fs.mkdirSync(path.dirname(goodDeck), { recursive: true });
fs.copyFileSync(FIXTURE, goodDeck);
const optRun = spawnSync('node', [OPTIMIZE, goodDeck], { encoding: 'utf8' });
if (optRun.status !== 0) {
  console.error('web-optimize failed during test setup:\n' + optRun.stderr);
  process.exit(1);
}
const injRun = spawnSync('node', [INJECT, goodDeck, '--url', CANON], { encoding: 'utf8' });
if (injRun.status !== 0) {
  console.error('web-inject failed during test setup:\n' + injRun.stderr);
  process.exit(1);
}

// broken deck: copy of the good deck with (a) a style that pushes the
// slide-4 .body-list down into the footer band (bottom:-40px against the
// .content box, whose bottom edge sits 52px above the slide bottom → the
// list lands 12px above the slide bottom, INSIDE the 52px footer band but
// NOT past the slide frame, so the overflow check must still pass), and
// (b) the first <img> src pointing at a nonexistent asset.
// NOTE: it lives in the SAME directory as the good deck so the relative
// assets/ references resolve — only the one rewritten src is broken.
const brokenDeck = path.join(path.dirname(goodDeck), 'broken.html');
{
  let html = fs.readFileSync(goodDeck, 'utf8');
  html = html.replace('</head>', '<style>.body-list{position:absolute;bottom:-40px;left:80px;}</style>\n</head>');
  html = html.replace('src="assets/', 'src="assets/does-not-exist-');
  fs.writeFileSync(brokenDeck, html);
}

// ── the three verify runs ────────────────────────────────────────────────────

function runVerify(deck, flags = []) {
  const r = spawnSync('node', [VERIFY, deck, ...flags], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

// parse "PASS  name — detail" lines into {status, name, detail}
function parseLines(stdout) {
  const out = [];
  for (const line of stdout.split('\n')) {
    const m = line.match(/^(PASS|FAIL|SKIPPED)\s+(\S+)(?:\s+—\s+(.*))?$/);
    if (m) out.push({ status: m[1], name: m[2], detail: m[3] || '' });
  }
  return out;
}

const runA = runVerify(goodDeck);
const linesA = runA.status === null || runA.stdout === undefined ? [] : parseLines(runA.stdout);

const runB = runVerify(brokenDeck);
const linesB = parseLines(runB.stdout || '');

const runC = runVerify(goodDeck, ['--mobile', '--throttle']);
const linesC = parseLines(runC.stdout || '');

// helper: status of a named check
const statusOf = (lines, name) => {
  const hit = lines.find(l => l.name === name);
  return hit ? hit.status : 'MISSING';
};

// ── tests ────────────────────────────────────────────────────────────────────

test('good deck: exit 0, no FAIL lines, summary counts agree', () => {
  assert.equal(runA.status, 0, `stderr: ${runA.stderr}\nstdout: ${runA.stdout}`);
  assert.ok(linesA.length >= 15, `expected >=15 check lines, got ${linesA.length}`);
  const fails = linesA.filter(l => l.status === 'FAIL');
  assert.deepEqual(fails.map(f => f.name), [], 'no FAIL lines on the good deck');
  const pass = linesA.filter(l => l.status === 'PASS').length;
  const skipped = linesA.filter(l => l.status === 'SKIPPED').length;
  assert.match(runA.stdout, new RegExp(`${pass} passed, 0 failed, ${skipped} skipped`));
});

test('good deck: geometry group passes (overflow, chrome clearance, block overlap, pagenos)', () => {
  assert.equal(statusOf(linesA, 'geometry/overflow'), 'PASS');
  assert.equal(statusOf(linesA, 'geometry/chrome-clearance'), 'PASS');
  assert.equal(statusOf(linesA, 'geometry/block-overlap'), 'PASS');
  assert.equal(statusOf(linesA, 'geometry/pagenos'), 'PASS');
});

test('good deck: image group passes (complete, lazy-after-scroll, backgrounds)', () => {
  assert.equal(statusOf(linesA, 'images/complete'), 'PASS');
  assert.equal(statusOf(linesA, 'images/lazy-after-scroll'), 'PASS');
  assert.equal(statusOf(linesA, 'images/backgrounds-resolve'), 'PASS');
});

test('good deck: hint lifecycle passes (appear, gone, keypress, hidden-on-touch)', () => {
  assert.equal(statusOf(linesA, 'hint/appear'), 'PASS');
  assert.equal(statusOf(linesA, 'hint/gone'), 'PASS');
  assert.equal(statusOf(linesA, 'hint/dismiss-on-key'), 'PASS');
  assert.equal(statusOf(linesA, 'hint/hidden-on-touch'), 'PASS');
});

test('good deck: present-flow checks SKIP (fixture has no show-mode handler), never FAIL', () => {
  // a run without --mobile must not contain the mobile group
  assert.equal(linesA.filter(l => l.name.startsWith('mobile/')).length, 0,
    'mobile/* checks only run with --mobile');
  const present = linesA.filter(l => l.name.startsWith('present/') || l.name === 'hint/hidden-on-present-hash');
  assert.ok(present.length >= 6, `expected >=6 present-related lines, got ${present.length}`);
  for (const l of present) {
    assert.equal(l.status, 'SKIPPED', `${l.name} must be SKIPPED, not ${l.status}`);
    assert.match(l.detail, /show-mode|nav/i, `${l.name} skip reason must name the missing handler`);
  }
});

test('good deck: no JS errors', () => {
  assert.equal(statusOf(linesA, 'js/no-errors'), 'PASS');
});

test('broken deck: exit 1 with the SPECIFIC fails (footer-band poke, missing image)', () => {
  assert.equal(runB.status, 1, 'any-fail must exit 1');
  assert.equal(statusOf(linesB, 'geometry/chrome-clearance'), 'FAIL',
    'the body-list poking into the footer band must fail chrome clearance');
  assert.equal(statusOf(linesB, 'images/complete'), 'FAIL',
    'the missing img src must fail the images check');
  assert.equal(statusOf(linesB, 'images/lazy-after-scroll'), 'FAIL',
    'the missing img is still broken after scroll-to-bottom');
});

test('broken deck: what is NOT broken still passes (specificity of the guard)', () => {
  assert.equal(statusOf(linesB, 'geometry/overflow'), 'PASS',
    'the poke stays inside the slide frame — overflow must NOT fail');
  assert.equal(statusOf(linesB, 'images/backgrounds-resolve'), 'PASS',
    'CSS backgrounds are untouched by the broken <img>');
  assert.equal(statusOf(linesB, 'geometry/pagenos'), 'PASS');
  assert.equal(statusOf(linesB, 'hint/appear'), 'PASS',
    'the hint lifecycle is independent of the broken image');
});

test('broken deck: the JS-error watch catches the failed resource', () => {
  assert.equal(statusOf(linesB, 'js/no-errors'), 'FAIL');
  assert.match(runB.stdout, /does-not-exist|Failed to load resource/i,
    'failure detail should surface the broken asset');
});

test('--mobile --throttle run: exit 0, controls visible, mobile present-flows SKIPPED', () => {
  assert.equal(runC.status, 0, `stderr: ${runC.stderr}\nstdout: ${runC.stdout}`);
  assert.equal(statusOf(linesC, 'mobile/controls-visible'), 'PASS',
    'present-btn must be visible in the hasTouch (no isMobile) 390px context');
  const mobileFlows = linesC.filter(l => l.name.startsWith('mobile/') && l.name !== 'mobile/controls-visible');
  assert.ok(mobileFlows.length >= 4, `expected >=4 mobile flow lines, got ${mobileFlows.length}`);
  for (const l of mobileFlows) {
    assert.equal(l.status, 'SKIPPED', `${l.name} must be SKIPPED without a nav script`);
  }
  assert.equal(statusOf(linesC, 'throttle/first-contentful-paint'), 'PASS');
  assert.equal(statusOf(linesC, 'geometry/overflow'), 'PASS',
    'desktop geometry re-checked in the flags run');
});
