#!/usr/bin/env node
// keynote-export.mjs — rendered keynote-create HTML deck → native, editable
// Apple Keynote file (.key). macOS with Keynote only.
//
// Pipeline: Playwright extracts a slide model + PNG layers → a generated
// AppleScript builds a new Keynote document (plate and media images, native
// tables and charts, styled text items, presenter notes) → saved to a temp
// .key next to the output → renamed into place.
//
// Output rules (an existing .key may hold the user's hand edits):
//   - an existing --out is refused without --force (exit 2, before Keynote)
//   - builds go to <name>.export-<pid>.key and are renamed on success
//   - --verify failure: the build is kept as <name>.unverified.key, any
//     existing --out is left untouched, exit 1
//   - AppleScript error: our document is closed unsaved, the temp file is
//     removed, the failing slide/object is printed, exit 1
// The exporter never opens import files (pptx etc.) in Keynote and never
// addresses other open documents.
//
// --verify (needs Poppler: pdftotext, pdftoppm) exports the built file to PDF
// through Keynote and checks each slide: every HTML word must appear within
// 24 px in the PDF (pdftotext -bbox), and the greyscale mean absolute
// difference at 480 px wide must be ≤ 8% with native chart boxes masked.
//
// Usage:
//   node scripts/keynote-export.mjs <deck.html> [--out deck.key] [--force]
//        [--slides 1,3-5] [--open] [--verify] [--keep-temp]
// Exit: 0 success · 1 failure · 2 usage or prerequisite error.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { buildAppleScript, posixFile } from './lib/keynote-applescript.mjs';
import { findPlaywright } from './lib/playwright.mjs';
import { mapFonts, queryFontInventory, resolveFont } from './lib/keynote-fonts.mjs';
import { parseBboxHtml, matchWords, meanAbsDiff } from './lib/keynote-compare.mjs';

export const WORD_TOL = 24;      // px at 1920 wide (calibratable once, see run manifest)
export const DIFF_MAX = 0.08;    // mean abs greyscale difference at 480 px wide
const SMALL_W = 480;
const SMALL_H = 270;

const USAGE = 'usage: node scripts/keynote-export.mjs <deck.html> [--out deck.key] [--force] [--slides 1,3-5] [--open] [--verify] [--keep-temp]';

export const LIMITS = 'Not carried over (Keynote scripting limits): chart styling, text alignment and line spacing (Keynote uses its own spacing; text that would collide, and centred text that wraps, is split into one item per line), letter-spacing, text shadows, animations. Decoration is flattened into images; videos become still frames.';

export class UsageError extends Error {}

export function parseArgs(argv) {
  const o = { deck: null, out: null, force: false, slides: null, open: false, verify: false, keepTemp: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '--slides') {
      const v = argv[++i];
      if (v === undefined || v.startsWith('-') || !v.trim()) throw new UsageError(`${a} needs a value`);
      if (a === '--out') o.out = v; else o.slides = v;
    }
    else if (a === '--force') o.force = true;
    else if (a === '--open') o.open = true;
    else if (a === '--verify') o.verify = true;
    else if (a === '--keep-temp') o.keepTemp = true;
    else if (a.startsWith('-')) throw new UsageError(`unknown flag ${a}`);
    else if (!o.deck) o.deck = a;
    else throw new UsageError(`unexpected argument ${a}`);
  }
  if (!o.deck) throw new UsageError('missing <deck.html>');
  return o;
}

// parseSlides('1,3-4', 5) → [1,3,4]; RangeError on bad input.
export function parseSlides(spec, total) {
  const out = new Set();
  for (const part of String(spec).split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) throw new RangeError(`bad slide range "${part}"`);
    const a = Number(m[1]);
    const b = m[2] ? Number(m[2]) : a;
    if (a < 1 || b < a || b > total) throw new RangeError(`slides "${part}" outside 1-${total}`);
    for (let n = a; n <= b; n++) out.add(n);
  }
  if (!out.size) throw new RangeError('empty slide list');
  return [...out].sort((x, y) => x - y);
}

// planOutput → { refuse, temp, final, unverified }. `unverified` is the first
// free name (x.unverified.key, x.unverified-2.key, …): a build kept by an
// earlier failed --verify may hold the user's edits and is never replaced.
// `temp` carries the pid and a random tag and is never an existing path, so
// cleanup can only ever remove this run's own build.
export function planOutput({ out, exists, force, pid = process.pid, taken = () => false, tag = () => Math.random().toString(16).slice(2, 8) }) {
  const dir = path.dirname(out);
  const name = path.basename(out).replace(/\.key$/i, '');
  let unverified = path.join(dir, `${name}.unverified.key`);
  for (let n = 2; taken(unverified); n++) unverified = path.join(dir, `${name}.unverified-${n}.key`);
  let temp;
  do temp = path.join(dir, `${name}.export-${pid}-${tag()}.key`); while (taken(temp));
  return {
    refuse: !!exists && !force,
    temp,
    final: out,
    unverified,
  };
}

// publishNew(src, dest) → true when src now sits at dest, false when dest
// appeared meanwhile (someone saved there during the run). A hard link fails
// on an existing dest, so a file created after the start-up check is never
// replaced without --force. A package-style .key (a folder) can't be hard
// linked: re-check, then rename.
export function publishNew(src, dest, fsx = fs) {
  try {
    fsx.linkSync(src, dest);
    fsx.unlinkSync(src);
    return true;
  } catch (e) {
    if (e.code === 'EEXIST') return false;
    if (lexists(dest)) return false;
    fsx.renameSync(src, dest);
    return true;
  }
}

// lexists(p): true for anything at p, a broken symlink included
export function lexists(p) {
  try { fs.lstatSync(p); return true; } catch { return false; }
}

// replaceFile(src, dest): put src at dest. An existing dest is first moved
// to a backup name and restored if the move fails, so the user never ends
// up with neither file. (The SIGINT handler in main keeps Ctrl-C from
// landing between the two renames.)
export function replaceFile(src, dest, fsx = fs) {
  if (!lexists(dest)) { fsx.renameSync(src, dest); return; }
  const backup = `${dest}.kx-backup-${process.pid}`;
  fsx.renameSync(dest, backup);
  try {
    fsx.renameSync(src, dest);
  } catch (e) {
    fsx.renameSync(backup, dest);
    throw e;
  }
  fs.rmSync(backup, { recursive: true, force: true });
}

// runOsa(script) → { ok, stdout, stderr, timedOut }. The generated scripts
// carry their own `with timeout` (OSA_TIMEOUT_S), so AppleScript fails and
// closes its document before this hard kill.
export const OSA_TIMEOUT_S = 1200;
export function runOsa(script) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-osa-'));
  const file = path.join(dir, 'run.applescript');
  fs.writeFileSync(file, script);
  const r = spawnSync('osascript', [file], { encoding: 'utf8', timeout: (OSA_TIMEOUT_S + 300) * 1000, maxBuffer: 32 * 1024 * 1024 });
  fs.rmSync(dir, { recursive: true, force: true });
  const timedOut = r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM';
  return { ok: r.status === 0, timedOut, stdout: (r.stdout || '').trim(), stderr: (r.stderr || r.error?.message || '').trim() };
}

const LEFT_OPEN = 'Keynote may still have an untitled export document open; close it without saving';

export function which(cmd) {
  return spawnSync('which', [cmd], { encoding: 'utf8' }).status === 0;
}

function rmrf(p) { fs.rmSync(p, { recursive: true, force: true }); }

// ── verify ──────────────────────────────────────────────────────────────────
// verifyDeck: words whose font is not installed (resolveFont reports
// `missing`; the export already warns) may move sideways but must stay on
// their line.
// Letter-spaced words get extra tolerance equal to the most the dropped
// spacing can move them (Keynote can't script tracking).
// The contact sheet is named after `sheetBase` (the final --out path).
export async function verifyDeck({ deck, keyPath, model, outDir, inventory = null, sheetBase = keyPath, runOsa: osa = runOsa }) {
  const { withDeck, freezeVideos, slideWords } = await import('./lib/keynote-extract.mjs');
  fs.mkdirSync(outDir, { recursive: true });
  const pdf = path.join(outDir, 'keynote.pdf');
  const exp = osa(`tell application "Keynote"
with timeout of ${OSA_TIMEOUT_S} seconds
set d to open (${posixFile(keyPath)})
try
  export d to (${posixFile(pdf)}) as PDF
  close d saving no
on error errMsg number errNum
  try
    close d saving no
  end try
  error errMsg number errNum
end try
end timeout
end tell
return "OK"`);
  if (!exp.ok) return { pass: false, lines: [`verify: Keynote PDF export failed: ${exp.stderr}${exp.timedOut ? ` (${LEFT_OPEN})` : ''}`] };
  const bbox = spawnSync('pdftotext', ['-bbox', pdf, '-'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (bbox.status !== 0) return { pass: false, lines: [`verify: pdftotext failed: ${(bbox.stderr || bbox.error?.message || '').trim()}`] };
  const pages = parseBboxHtml(bbox.stdout || '');
  const prefix = path.join(outDir, 'kpage');
  const ppm = spawnSync('pdftoppm', ['-png', '-scale-to-x', String(SMALL_W), '-scale-to-y', '-1', pdf, prefix], { encoding: 'utf8' });
  if (ppm.status !== 0) return { pass: false, lines: [`verify: pdftoppm failed: ${(ppm.stderr || ppm.error?.message || '').trim()}`] };
  const pageFiles = fs.readdirSync(outDir).filter((f) => f.startsWith('kpage') && f.endsWith('.png')).sort()
    .map((f) => path.join(outDir, f));

  return withDeck(deck, { scale: 1 }, async (page) => {
    await freezeVideos(page);
    const lines = [];
    let pass = pages.length === model.slides.length && pageFiles.length === model.slides.length;
    if (!pass) lines.push(`verify: page count mismatch (pdf ${pages.length}/${pageFiles.length}, slides ${model.slides.length})`);
    const sheet = [];
    for (const [i, s] of model.slides.entries()) {
      const idx = s.index - 1;
      if (!pageFiles[i]) { lines.push(`slide ${s.index}: no page in the Keynote PDF FAIL`); pass = false; continue; }
      const html = path.join(outDir, `html-${s.index}.png`);
      await page.locator('.slide').nth(idx).screenshot({ path: html });
      // a box kept whole despite Keynote's line spacing lets its words move by its drift
      const driftAt = (w) => (s.texts || []).filter((t) => t.drift && w.cx >= t.drift.left && w.cx <= t.drift.right
        && w.cy >= t.drift.top && w.cy <= t.drift.bottom).reduce((m, t) => Math.max(m, t.drift.tol), 0);
      const words = (await slideWords(page, idx)).map((w) => ({ ...w, extraTol: (w.spacingDrift || 0) + driftAt(w),
        relaxed: !!inventory && resolveFont(w.font, w.weight, w.italic, inventory).missing }));
      const relaxed = words.filter((w) => w.relaxed).length;
      const m = matchWords(words, pages[i] || [], WORD_TOL);
      const masks = (s.charts || []).map((c) => [c.x, c.y, c.w, c.h]);
      const grey = await page.evaluate(async ({ a, b, masks, W, H }) => {
        const load = async (b64) => { const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode(); return im; };
        const g = async (b64) => {
          const im = await load(b64);
          const c = document.createElement('canvas'); c.width = W; c.height = H;
          const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0, W, H);
          const d = ctx.getImageData(0, 0, W, H).data;
          const out = []; for (let p = 0; p < d.length; p += 4) out.push(Math.round(0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]));
          return { out, w: im.width, h: im.height };
        };
        const A = await g(a); const B = await g(b);
        const mask = new Array(W * H).fill(0);
        for (const [x, y, w, h] of masks) {
          for (let yy = Math.floor(y * H / 1080); yy < Math.ceil((y + h) * H / 1080) && yy < H; yy++)
            for (let xx = Math.floor(x * W / 1920); xx < Math.ceil((x + w) * W / 1920) && xx < W; xx++) mask[yy * W + xx] = 1;
        }
        return { a: A.out, b: B.out, mask, pdfDims: [B.w, B.h], htmlDims: [A.w, A.h] };
      }, { a: fs.readFileSync(html).toString('base64'), b: pageFiles[i] ? fs.readFileSync(pageFiles[i]).toString('base64') : '', masks, W: SMALL_W, H: SMALL_H });
      // both rasters must be 16:9 before they are compared at 480×270
      const dimsOk = grey.pdfDims[0] === SMALL_W && grey.pdfDims[1] === SMALL_H
        && Math.abs(grey.htmlDims[0] / grey.htmlDims[1] - SMALL_W / SMALL_H) < 0.01;
      const diff = meanAbsDiff(Uint8Array.from(grey.a), Uint8Array.from(grey.b), Uint8Array.from(grey.mask));
      const ok = dimsOk && m.missing.length === 0 && m.displaced.length === 0 && diff <= DIFF_MAX;
      if (!ok) pass = false;
      let line = `slide ${s.index} words ${m.matched}/${m.total}${relaxed ? ` (${relaxed} in substituted fonts, line checked only)` : ''} diff ${(diff * 100).toFixed(1)}% ${ok ? 'PASS' : 'FAIL'}`;
      if (!dimsOk) line += ` (pdf raster ${grey.pdfDims.join('x')}, html ${grey.htmlDims.join('x')}, expected ${SMALL_W}x${SMALL_H})`;
      if (m.missing.length) line += ` missing: ${m.missing.slice(0, 8).join(' ')}`;
      if (m.displaced.length) line += ` displaced: ${m.displaced.slice(0, 8).map((d) => `${d.text}(${d.dist}px)`).join(' ')}`;
      lines.push(line);
      sheet.push([html, pageFiles[i]]);
    }
    // contact sheet: HTML left, Keynote right, one row per slide
    const sheetPath = sheetBase.replace(/\.key$/i, '') + '.verify.png';
    const data = await page.evaluate(async ({ rows, W, H }) => {
      const c = document.createElement('canvas'); c.width = W * 2 + 10; c.height = rows.length * (H + 10);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#888'; ctx.fillRect(0, 0, c.width, c.height);
      for (const [r, [a, b]] of rows.entries()) for (const [col, b64] of [[0, a], [1, b]]) {
        if (!b64) continue;
        const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
        ctx.drawImage(im, col * (W + 10), r * (H + 10), W, H);
      }
      return c.toDataURL('image/png').split(',')[1];
    }, { rows: sheet.map(([a, b]) => [fs.readFileSync(a).toString('base64'), b ? fs.readFileSync(b).toString('base64') : '']), W: SMALL_W, H: SMALL_H });
    fs.writeFileSync(sheetPath, Buffer.from(data, 'base64'));
    lines.push(`contact sheet: ${sheetPath}`);
    return { pass, lines, sheetPath };
  });
}

// ── main ────────────────────────────────────────────────────────────────────
const defaultDeps = {
  runOsa,
  which,
  queryFontInventory,
  verifyDeck,
  hasKeynote: () => process.platform === 'darwin' && fs.existsSync('/Applications/Keynote.app'),
  hasPlaywright: () => findPlaywright() !== null,
  async countSlides(html) {
    const { withDeck, slideCount } = await import('./lib/keynote-extract.mjs');
    return withDeck(html, { scale: 1 }, slideCount);
  },
  onSignal(fn) {
    for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, fn);
    return () => { for (const sig of ['SIGINT', 'SIGTERM']) process.off(sig, fn); };
  },
  async extractDeck(html, opts) {
    const { extractDeck } = await import('./lib/keynote-extract.mjs');
    return extractDeck(html, opts);
  },
  openInKeynote: (file) => spawnSync('open', ['-a', 'Keynote', file]),
  log: (s) => console.log(s),
  err: (s) => console.error(s),
};

export async function main(argv, deps = {}) {
  const d = { ...defaultDeps, ...deps };
  let o;
  try { o = parseArgs(argv); } catch (e) { d.err(`keynote-export: ${e.message}\n${USAGE}`); return 2; }
  const deck = path.resolve(o.deck);
  if (!fs.existsSync(deck)) { d.err(`keynote-export: deck not found: ${deck}`); return 2; }
  if (!d.hasKeynote()) { d.err('keynote-export: needs macOS with Keynote installed (/Applications/Keynote.app)'); return 2; }
  const out = path.resolve(o.out || deck.replace(/\.html?$/i, '') + '.key');
  if (/[\r\n]/.test(out)) { d.err('keynote-export: the output path contains a line break; Keynote cannot save to it'); return 2; }
  // a .key name is required, so --out can never be a folder or the deck itself
  if (!/\.key$/i.test(out)) { d.err(`keynote-export: --out must end in .key (got ${out})`); return 2; }
  const plan = planOutput({ out, exists: lexists(out), force: o.force, taken: lexists });
  if (plan.refuse) { d.err(`keynote-export: ${out} exists; pass --force to replace it (it may contain your edits)`); return 2; }
  if (o.verify) {
    const missing = ['pdftotext', 'pdftoppm'].filter((c) => !d.which(c));
    if (missing.length) { d.err(`keynote-export: --verify needs Poppler (${missing.join(', ')} not found; brew install poppler)`); return 2; }
  }

  if (!d.hasPlaywright()) { d.err('keynote-export: Playwright not found; set PLAYWRIGHT_MODULE or npm i playwright'); return 2; }
  let total;
  try {
    total = await d.countSlides(deck);
  } catch (e) {
    // Playwright is there but its browser is not
    if (/Executable doesn't exist|browserType\.launch/.test(e.message)) {
      d.err(`keynote-export: Playwright's Chromium is missing (npx playwright install chromium): ${e.message.split('\n')[0]}`);
      return 2;
    }
    throw e;
  }
  if (!total) { d.err(`keynote-export: no slides found in ${deck} (expected .slide elements)`); return 1; }
  let slides = null;
  if (o.slides) {
    try { slides = parseSlides(o.slides, total); } catch (e) { d.err(`keynote-export: ${e.message}`); return 2; }
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-export-'));
  const cleanup = () => { if (!o.keepTemp) rmrf(tmp); };
  // Ctrl-C: remove our temp files and say what may be left in Keynote. With a
  // listener installed, Node delivers the signal between statements, so the
  // two renames in replaceFile can't be split.
  let created = false;
  const offSignal = d.onSignal(() => {
    if (created && lexists(plan.temp)) rmrf(plan.temp);
    cleanup();
    d.err(`keynote-export: interrupted; ${LEFT_OPEN}`);
    process.exit(130);
  });
  try {
    const model = await d.extractDeck(deck, { outDir: tmp, slides });
    if (!model.slides.length) { d.err(`keynote-export: no slides found in ${deck}`); return 1; }
    const inventory = d.queryFontInventory();
    const warnings = [...(model.warnings || []), ...mapFonts(model, inventory)];
    const script = buildAppleScript(model, { savePath: plan.temp, keepOpen: false, timeoutS: OSA_TIMEOUT_S });
    if (o.keepTemp) {
      fs.writeFileSync(path.join(tmp, 'build.applescript'), script);
      d.log(`keynote-export: temp files kept in ${tmp}`);
    }
    created = true; // from here on plan.temp, if it exists, is this run's build
    const r = d.runOsa(script);
    if (!r.ok) {
      rmrf(plan.temp);
      d.err(`keynote-export: Keynote build failed: ${r.stderr}${r.timedOut ? ` (${LEFT_OPEN})` : ''}`);
      warnings.forEach((w) => d.log(`warning: ${w}`));
      return 1;
    }
    if (o.verify) {
      let v;
      try {
        v = await d.verifyDeck({ deck, keyPath: plan.temp, model, outDir: path.join(tmp, 'verify'), inventory, sheetBase: plan.final, runOsa: d.runOsa });
      } catch (e) {
        v = { pass: false, lines: [`verify: ${e.message}`] };
      }
      v.lines.forEach((l) => d.log(l));
      if (!v.pass) {
        fs.renameSync(plan.temp, plan.unverified); // a free name: never replaces anything
        d.err(`keynote-export: verification failed; build kept as ${plan.unverified}${lexists(out) ? `; ${out} left untouched` : ''}`);
        warnings.forEach((w) => d.log(`warning: ${w}`)); // a substituted font often explains a failed slide
        return 1;
      }
    }
    if (o.force) {
      replaceFile(plan.temp, plan.final);
    } else if (!publishNew(plan.temp, plan.final)) {
      fs.renameSync(plan.temp, plan.unverified);
      d.err(`keynote-export: ${out} appeared during the export and was left untouched; build kept as ${plan.unverified}`);
      return 1;
    }
    d.log(`keynote-export: wrote ${plan.final} (${model.slides.length} slides)`);
    warnings.forEach((w) => d.log(`warning: ${w}`));
    d.log(LIMITS);
    if (o.open) d.openInKeynote(plan.final);
    return 0;
  } finally {
    offSignal();
    if (created && lexists(plan.temp)) rmrf(plan.temp);
    cleanup();
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(e); process.exit(1); });
}
