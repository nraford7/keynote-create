#!/usr/bin/env node
// keynote-export.keynote.test.mjs — live round trip through Apple Keynote
// (plan Task 7). macOS with Keynote and Poppler only; skipped elsewhere.
//
// For the export fixture and the two rendered baseline decks: the CLI builds
// with --verify (exit 0) and leaves Keynote's open-document count unchanged;
// a readback of the .key matches the extraction model text for text, with the
// font, size and colour of every character of every run; notes match; the
// fixture's table cells match the generator's expected JSON; the chart's data
// round-trips through Keynote's own PowerPoint export; and a second run
// without --force exits 2 and leaves the file alone.
//
// Run: npm run test:keynote

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { extractDeck } from './lib/keynote-extract.mjs';
import { mapFonts, queryFontInventory } from './lib/keynote-fonts.mjs';
import { posixFile } from './lib/keynote-applescript.mjs';
import { readbackScript, parseReadback } from './lib/keynote-readback.mjs';
import { renderBaselineDecks } from './lib/test-decks.mjs';
import { runOsa } from './keynote-export.mjs';
import { getPlaywright } from './lib/playwright.mjs';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const CLI = path.join(REPO, 'scripts/keynote-export.mjs');
const FIXTURE = path.join(REPO, 'docs/fixtures/sample-export.html');
const EXPECTED = JSON.parse(fs.readFileSync(path.join(REPO, 'docs/fixtures/sample-export.expected.json'), 'utf8'));

const has = (cmd) => spawnSync('which', [cmd]).status === 0;
const skip = process.platform !== 'darwin' ? 'needs macOS'
  : !fs.existsSync('/Applications/Keynote.app') ? 'needs /Applications/Keynote.app'
    : !has('pdftotext') || !has('pdftoppm') ? 'needs Poppler (brew install poppler)' : false;

// docState() → ids of the open Keynote documents, sorted. Equal before and
// after means none was opened, closed or left behind (ids are stable while a
// document stays open). Edits are checked on the sentinel's content: the
// `modified` flag is not usable, macOS autosave clears it on untitled
// documents mid-run (seen 2026-10-05).
const docState = () => {
  const r = runOsa(`set out to {}
tell application "Keynote"
  repeat with d in documents
    set end of out to (id of d) as text
  end repeat
end tell
set AppleScript's text item delimiters to linefeed
return out as text`);
  assert.ok(r.ok, r.stderr);
  return r.stdout.split('\n').filter(Boolean).sort().join('\n');
};

// A sentinel document stands in for the user's own open work: it stays open
// (frontmost when exports start) through every run, and must come out with
// the same id, modified flag and text. Closed unsaved at the end.
let sentinel = null;
const SENTINEL_TEXT = 'kx sentinel: must stay untouched';
const sentinelText = () => {
  const r = runOsa(`tell application "Keynote"
set d to (first document whose id is "${sentinel}")
return ((count of slides of d) as text) & "|" & (object text of text item 1 of slide 1 of d)
end tell`);
  assert.ok(r.ok, r.stderr);
  return r.stdout;
};
if (!skip) {
  const r = runOsa(`tell application "Keynote"
set d to make new document with properties {document theme:theme "Basic White"}
set base layout of slide 1 of d to master slide "Blank" of d
tell slide 1 of d to make new text item with properties {object text:"${SENTINEL_TEXT}"}
return id of d
end tell`);
  if (r.ok) sentinel = r.stdout;
  after(() => {
    if (sentinel) runOsa(`tell application "Keynote" to close (first document whose id is "${sentinel}") saving no`);
  });
}

// one export per deck, shared by the tests below; temp folders go at the end
const runs = {};
const tmpDirs = [];
after(() => { for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true }); });
async function exportDeck(name, html) {
  if (runs[name]) return runs[name];
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `kx-rt-${name}-`));
  tmpDirs.push(dir);
  const out = path.join(dir, 'x.key');
  const before = docState();
  const r = spawnSync(process.execPath, [CLI, html, '--out', out, '--verify', '--keep-temp'], { encoding: 'utf8', timeout: 1_800_000 });
  const kept = (r.stdout.match(/temp files kept in (.+)/) || [])[1];
  if (kept) tmpDirs.push(kept);
  const model = await extractDeck(html, { outDir: path.join(dir, 'model') });
  mapFonts(model, queryFontInventory());
  // read back only a finished build; checkDeck reports a failed CLI run first
  let back = null;
  if (r.status === 0) {
    const rb = runOsa(readbackScript(out));
    assert.ok(rb.ok, `readback: ${rb.stderr}`);
    back = parseReadback(rb.stdout);
  }
  const after = docState(); // after the readback too: it must close its document
  runs[name] = { dir, out, r, before, after, model, back, kept };
  return runs[name];
}

// the model text items Keynote should hold, in creation order
const modelItems = (slide) => slide.texts
  .map((t) => Object.assign(t.runs.map((r) => ({ ...r, text: String(r.text).replace(/\r\n?/g, '\n') })).filter((r) => r.text.length), { h: t.h }))
  .filter((runs) => runs.length);

function checkDeck(name, run) {
  assert.equal(run.r.status, 0, `${name}: CLI exit ${run.r.status}\n${run.r.stdout}\n${run.r.stderr}`);
  assert.ok(sentinel, 'sentinel document created');
  assert.ok(run.before.includes(sentinel), 'sentinel listed');
  assert.equal(run.after, run.before, `${name}: the user's open Keynote documents changed`);
  assert.equal(sentinelText(), `1|${SENTINEL_TEXT}`, `${name}: sentinel slides or text changed`);
  // --verify really ran: one PASS line per slide, and the contact sheet named after --out
  const verified = run.r.stdout.split('\n').filter((l) => /^slide \d+ words \d+\/\d+.* PASS$/.test(l));
  assert.equal(verified.length, run.model.slides.length, `${name}: verify lines\n${run.r.stdout}`);
  assert.ok(fs.existsSync(run.out.replace(/\.key$/, '.verify.png')), `${name}: contact sheet`);
  assert.equal(run.back.count, run.model.slides.length, `${name}: slide count`);
  run.model.slides.forEach((slide, si) => {
    const where = `${name} slide ${slide.index}`;
    const back = run.back.slides[si];
    const items = modelItems(slide);
    const texts = back.texts.filter((t) => t.text.length); // the Blank layout keeps two hidden, empty placeholders
    assert.deepEqual(texts.map((t) => t.text), items.map((runs) => runs.map((r) => r.text).join('')), `${where}: text`);
    items.forEach((runs, ti) => {
      const chars = texts[ti].chars;
      let at = 0;
      for (const r of runs) {
        const n = [...r.text].length; // Keynote counts code points
        for (let i = at; i < at + n; i++) {
          const c = chars[i];
          const label = `${where} text ${ti + 1} char ${i + 1} of run "${r.text.slice(0, 20)}"`;
          assert.ok(c, `${label}: missing`);
          assert.equal(c.font, r.ps, `${label}: font`);
          assert.ok(Math.abs(c.size - r.size) <= 0.01, `${label}: size ${c.size} vs ${r.size}`);
          assert.ok(c.color.every((v, k) => Math.abs(v - Math.round(r.color[k])) <= 1), `${label}: colour ${c.color} vs ${r.color}`);
        }
        at += n;
      }
      assert.equal(chars.length, at, `${where} text ${ti + 1}: character count`);
      // a one-line item must stay one line in Keynote (no wrap in a wider font).
      // Keynote adds a fixed inner margin (~9 pt: a 15 px one-liner is 27 pt
      // tall); an extra line adds ~1.2 x size, so 0.6 x size + 10 separates them.
      const size = Math.max(...runs.map((r) => r.size));
      if (runs.h < 1.6 * size) {
        assert.ok(texts[ti].h - runs.h < 0.6 * size + 10, `${where} text ${ti + 1} "${texts[ti].text.slice(0, 30)}" wrapped: Keynote height ${texts[ti].h} vs ${Math.round(runs.h)}`);
      }
    });
    assert.equal(back.notes, slide.notes || '', `${where}: notes`);
    assert.equal(back.tables.length, slide.tables.length, `${where}: tables`);
    assert.equal(back.charts, slide.charts.length, `${where}: charts`);
  });
}

test('export fixture round-trips through Keynote', { skip, timeout: 900_000 }, async () => {
  const run = await exportDeck('fixture', FIXTURE);
  checkDeck('fixture', run);
  process.stdout.write(`# fixture verify:\n${run.r.stdout.split('\n').filter((l) => /^slide /.test(l)).map((l) => `#   ${l}`).join('\n')}\n`);
  // table cells (slide 3) against the generator's own strings
  const t = run.back.slides[2].tables[0];
  const want = EXPECTED.slides[2].tables[0];
  assert.deepEqual([t.rows, t.cols], [want.length, want[0].length]);
  assert.deepEqual(t.cells, want.flat());
  // the verify screenshot of slide 2 shows the video's frame 0 (plan Task 6)
  const shot = path.join(run.kept, 'verify', 'html-2.png');
  const { chromium } = getPlaywright();
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    const px = await p.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      return [...ctx.getImageData(100, 100, 1, 1).data].slice(0, 3);
    }, fs.readFileSync(shot).toString('base64'));
    assert.ok(px.every((v, i) => Math.abs(v - EXPECTED.videoFrame0[i]) <= 12), `verify screenshot frame 0: ${px}`);
  } finally { await b.close(); }
  // fixture notes against the generator's own strings
  assert.equal(run.back.slides[0].notes, EXPECTED.slides[0].notes);
  assert.equal(run.back.slides[3].notes, EXPECTED.slides[3].notes);
});

test('chart data round-trips (Keynote export to PowerPoint, chart XML caches)', { skip, timeout: 300_000 }, async () => {
  const run = await exportDeck('fixture', FIXTURE);
  const pptx = path.join(run.dir, 'x.pptx');
  const before = docState();
  const r = runOsa(`tell application "Keynote"
set d to open (${posixFile(run.out)})
try
  export d to (${posixFile(pptx)}) as Microsoft PowerPoint
  close d saving no
on error errMsg number errNum
  try
    close d saving no
  end try
  error errMsg number errNum
end try
end tell`);
  assert.ok(r.ok, r.stderr);
  assert.equal(docState(), before);
  const names = spawnSync('unzip', ['-Z1', pptx], { encoding: 'utf8' }).stdout.split('\n').filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n));
  assert.equal(names.length, 1, names.join());
  const xml = spawnSync('unzip', ['-p', pptx, names[0]], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).stdout;
  const series = [...xml.matchAll(/<c:ser>([\s\S]*?)<\/c:ser>/g)].map((m) => m[1]);
  const pts = (block, tag) => {
    const sec = block.match(new RegExp(`<c:${tag}>([\\s\\S]*?)</c:${tag}>`));
    return sec ? [...sec[1].matchAll(/<c:pt idx="(\d+)">\s*<c:v>([^<]*)<\/c:v>/g)].sort((a, b) => a[1] - b[1]).map((m) => m[2]) : [];
  };
  const chart = EXPECTED.slides[3].charts[0];
  assert.deepEqual(series.map((s) => pts(s, 'tx')[0]), chart.columns, 'series names = columns');
  for (const [j, s] of series.entries()) {
    assert.deepEqual(pts(s, 'cat'), chart.rows, `categories of series ${j + 1}`);
    assert.deepEqual(pts(s, 'val').map(Number), chart.data.map((row) => row[j]), `values of series ${j + 1}`);
  }
});

test('a second run without --force exits 2 and leaves the file alone', { skip, timeout: 300_000 }, async () => {
  const run = await exportDeck('fixture', FIXTURE);
  const mtime = fs.statSync(run.out).mtimeMs;
  const before = docState();
  const r = spawnSync(process.execPath, [CLI, FIXTURE, '--out', run.out], { encoding: 'utf8' });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /--force/);
  assert.equal(fs.statSync(run.out).mtimeMs, mtime);
  assert.equal(docState(), before);
});

test('baseline decks round-trip through Keynote', { skip, timeout: 1_800_000 }, async () => {
  const decks = renderBaselineDecks(fs.mkdtempSync(path.join(os.tmpdir(), 'kx-rt-base-')));
  for (const [name, html] of Object.entries(decks)) {
    const run = await exportDeck(name, html);
    checkDeck(name, run);
    process.stdout.write(`# ${name} verify:\n${run.r.stdout.split('\n').filter((l) => /^slide /.test(l)).map((l) => `#   ${l}`).join('\n')}\n`);
  }
});
