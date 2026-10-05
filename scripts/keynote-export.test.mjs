#!/usr/bin/env node
// keynote-export.test.mjs — unit tests for the Keynote exporter (no Keynote, no browser).
//
// Sections: fonts (Task 1) · AppleScript generator (Task 2) · comparison (Task 3) · CLI (Task 6).
// Run: node --test scripts/keynote-export.test.mjs

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { cssWeightToNs, resolveFont, mapFonts } from './lib/keynote-fonts.mjs';

// ── fonts ────────────────────────────────────────────────────────────────────
const INV = {
  'Helvetica Neue': [
    { ps: 'HelveticaNeue', weight: 5, italic: false },
    { ps: 'HelveticaNeue-Bold', weight: 9, italic: false },
    { ps: 'HelveticaNeue-Italic', weight: 5, italic: true },
  ],
  Inter: [
    { ps: 'Inter-Regular', weight: 5, italic: false },
    { ps: 'Inter-SemiBold', weight: 8, italic: false },
  ],
};

test('cssWeightToNs maps the CSS scale onto NSFontManager weights', () => {
  const want = { 100: 2, 200: 3, 300: 4, 400: 5, 500: 6, 600: 8, 700: 9, 800: 10, 900: 11 };
  for (const [css, ns] of Object.entries(want)) assert.equal(cssWeightToNs(Number(css)), ns);
  assert.ok([5, 6].includes(cssWeightToNs(450)));
  assert.equal(cssWeightToNs(450), 5); // tie rounds down
});

test('resolveFont strips quotes and picks the nearest weight', () => {
  assert.deepEqual(resolveFont(['"Inter"', 'sans-serif'], 600, false, INV),
    { ps: 'Inter-SemiBold', family: 'Inter', missing: false, fallback: false, skipped: [], generics: [] });
});

test('resolveFont falls back to Helvetica Neue when no family is installed', () => {
  assert.deepEqual(resolveFont(['Cormorant Garamond', 'serif'], 400, false, INV),
    { ps: 'HelveticaNeue', family: 'Helvetica Neue', missing: true, fallback: true, skipped: ['Cormorant Garamond'], generics: ['serif'] });
});

// Members as NSFontManager lists them on macOS 26 (2026-10-05):
// [ps, style, weight, traits]; traits 1 italic, 2 bold, 0x40 condensed.
const member = ([ps, style, weight, traits]) => ({ ps, style, weight, italic: (traits & 1) === 1, narrow: (traits & 0x60) !== 0 });
const REAL = {
  Inter: [
    ['Inter-Regular', 'Regular', 5, 0], ['Inter-Regular_Italic', 'Italic', 5, 1],
    ['Inter-Regular_Thin', 'Thin', 3, 65536], ['Inter-Regular_Thin-Italic', 'Thin Italic', 3, 65537],
    ['Inter-Regular_ExtraLight', 'ExtraLight', 3, 0], ['Inter-Regular_ExtraLight-Italic', 'ExtraLight Italic', 3, 1],
    ['Inter-Regular_Light', 'Light', 3, 0], ['Inter-Regular_Light-Italic', 'Light Italic', 4, 1],
    ['Inter-Regular_Medium', 'Medium', 6, 0], ['Inter-Regular_Medium-Italic', 'Medium Italic', 6, 1],
    ['Inter-Regular_SemiBold', 'SemiBold', 8, 2], ['Inter-Regular_SemiBold-Italic', 'SemiBold Italic', 8, 3],
    ['Inter-Regular_Bold', 'Bold', 9, 2], ['Inter-Regular_Bold-Italic', 'Bold Italic', 9, 3],
    ['Inter-Regular_ExtraBold', 'ExtraBold', 11, 2], ['Inter-Regular_ExtraBold-Italic', 'ExtraBold Italic', 11, 3],
    ['Inter-Regular_Black', 'Black', 14, 2], ['Inter-Regular_Black-Italic', 'Black Italic', 14, 3],
  ].map(member),
  'Helvetica Neue': [
    ['HelveticaNeue', 'Regular', 5, 0], ['HelveticaNeue-Italic', 'Italic', 5, 1],
    ['HelveticaNeue-UltraLight', 'UltraLight', 2, 0], ['HelveticaNeue-UltraLightItalic', 'UltraLight Italic', 2, 1],
    ['HelveticaNeue-Thin', 'Thin', 3, 65536], ['HelveticaNeue-ThinItalic', 'Thin Italic', 3, 65537],
    ['HelveticaNeue-Light', 'Light', 3, 0], ['HelveticaNeue-LightItalic', 'Light Italic', 3, 1],
    ['HelveticaNeue-Medium', 'Medium', 6, 0], ['HelveticaNeue-MediumItalic', 'Medium Italic', 6, 1],
    ['HelveticaNeue-Bold', 'Bold', 9, 2], ['HelveticaNeue-BoldItalic', 'Bold Italic', 9, 3],
    ['HelveticaNeue-CondensedBold', 'Condensed Bold', 9, 66], ['HelveticaNeue-CondensedBlack', 'Condensed Black', 11, 66],
  ].map(member),
};

test('resolveFont picks by style name on real Inter (uneven weights: Black 14, Light Italic 4)', () => {
  const want = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black' };
  for (const [w, st] of Object.entries(want)) assert.equal(resolveFont(['Inter'], Number(w), false, REAL).ps, st === 'Regular' ? 'Inter-Regular' : `Inter-Regular_${st}`, w);
  assert.equal(resolveFont(['Inter'], 300, true, REAL).ps, 'Inter-Regular_Light-Italic');
  assert.equal(resolveFont(['Inter'], 400, true, REAL).ps, 'Inter-Regular_Italic');
  assert.equal(resolveFont(['Inter'], 900, true, REAL).ps, 'Inter-Regular_Black-Italic');
});

test('resolveFont never picks a condensed face (real Helvetica Neue)', () => {
  assert.equal(resolveFont(['Cormorant'], 900, false, REAL).ps, 'HelveticaNeue-Bold');
  assert.equal(resolveFont(['Helvetica Neue'], 800, false, REAL).ps, 'HelveticaNeue-Bold');
  assert.equal(resolveFont(['Helvetica Neue'], 700, false, REAL).ps, 'HelveticaNeue-Bold');
  assert.equal(resolveFont(['Helvetica Neue'], 200, false, REAL).ps, 'HelveticaNeue-UltraLight');
});

test('system font generics resolve to a stand-in but count as missing (no warning)', () => {
  for (const g of ['system-ui', '-apple-system', 'ui-sans-serif']) {
    const r = resolveFont([g, 'sans-serif'], 400, false, REAL);
    assert.equal(r.family, 'Helvetica Neue', g);
    assert.equal(r.missing, true, g);
    assert.deepEqual(r.skipped, [], g);
  }
  assert.equal(resolveFont(['sans-serif'], 400, false, REAL).missing, false);
  const deck = { slides: [{ index: 1, texts: [{ runs: [{ text: 'x', font: ['ui-sans-serif', 'system-ui', 'sans-serif'], weight: 400 }] }] }] };
  assert.deepEqual(mapFonts(deck, REAL), []);
});

test('mapFonts names the generic family when nothing in the stack is installed', () => {
  const deck = { slides: [{ index: 1, texts: [{ runs: [{ text: 'x', font: ['monospace'], weight: 400 }] }] }] };
  const w = mapFonts(deck, REAL);
  assert.equal(w.length, 1);
  assert.match(w[0], /"monospace \(Menlo\)" \(used Helvetica Neue/);
});

test('resolveFont reports a skipped named family even when a later one resolves', () => {
  const inv = { ...INV, 'Times New Roman': [{ ps: 'TimesNewRomanPSMT', weight: 5, italic: false }] };
  assert.deepEqual(resolveFont(['Cormorant Garamond', 'serif'], 400, false, inv),
    { ps: 'TimesNewRomanPSMT', family: 'Times New Roman', missing: true, fallback: false, skipped: ['Cormorant Garamond'], generics: [] });
  assert.equal(resolveFont(['sans-serif'], 400, false, inv).missing, false);
});

test('resolveFont prefers italic at the nearest weight, then the nearest weight', () => {
  assert.equal(resolveFont(['Inter'], 700, true, INV).ps, 'Inter-SemiBold');
  assert.equal(resolveFont(['Helvetica Neue'], 400, true, INV).ps, 'HelveticaNeue-Italic');
});

test('generic families map to installed macOS families', () => {
  for (const g of ['sans-serif', 'system-ui', '-apple-system']) {
    assert.equal(resolveFont([g], 400, false, INV).family, 'Helvetica Neue');
  }
  const inv = { ...INV, 'Times New Roman': [{ ps: 'TimesNewRomanPSMT', weight: 5, italic: false }],
    Menlo: [{ ps: 'Menlo-Regular', weight: 5, italic: false }] };
  assert.equal(resolveFont(['serif'], 400, false, inv).ps, 'TimesNewRomanPSMT');
  assert.equal(resolveFont(['monospace'], 400, false, inv).ps, 'Menlo-Regular');
});

test('mapFonts adds ps names and warns once per missing family', () => {
  const run = (font) => ({ text: 'x', font, weight: 400, italic: false, size: 20, color: [0, 0, 0], alpha: 1 });
  const deck = { width: 1920, height: 1080, warnings: [], slides: [
    { index: 1, texts: [{ runs: [run(['Cormorant Garamond']), run(['Inter'])] }], tables: [] },
    { index: 2, texts: [{ runs: [run(['Cormorant Garamond', 'serif'])] }],
      tables: [{ styles: [[{ font: ['Inter'], weight: 600, italic: false }]] }] },
  ] };
  const warnings = mapFonts(deck, INV);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Cormorant Garamond/);
  assert.equal(deck.slides[0].texts[0].runs[1].ps, 'Inter-Regular');
  assert.equal(deck.slides[1].tables[0].styles[0][0].ps, 'Inter-SemiBold');
});

test('mapFonts warns for a named family that fell through to a generic one', () => {
  const inv = { ...INV, 'Times New Roman': [{ ps: 'TimesNewRomanPSMT', weight: 5, italic: false }] };
  const deck = { slides: [{ index: 1, texts: [{ runs: [{ text: 'x', font: ['Cormorant Garamond', 'serif'], weight: 400 }] }] }] };
  const warnings = mapFonts(deck, inv);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /"Cormorant Garamond" \(used Times New Roman/);
  assert.equal(deck.slides[0].texts[0].runs[0].ps, 'TimesNewRomanPSMT');
});

// ── AppleScript generator ────────────────────────────────────────────────────
import { asString, colour16, posixFile, runRanges, buildAppleScript } from './lib/keynote-applescript.mjs';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

test('asString escapes quotes, backslashes and line breaks', () => {
  assert.equal(asString('a "b" \\ c\nd'), '"a \\"b\\" \\\\ c" & linefeed & "d"');
});

test('colour16 converts 8-bit to Keynote 16-bit', () => {
  assert.equal(colour16([255, 0, 128]), '{65535, 0, 32896}');
});

test('posixFile keeps apostrophes and spaces intact', () => {
  assert.equal(posixFile("/tmp/Terry's Deck - x.key"), `POSIX file "/tmp/Terry's Deck - x.key"`);
});

test('posixFile refuses a path with a line break', () => {
  assert.throws(() => posixFile('/tmp/a\nb.key'), /line break/);
  assert.equal(posixFile('/tmp/a "q" \\ b.key'), 'POSIX file "/tmp/a \\"q\\" \\\\ b.key"');
});

test('runRanges counts code points like Keynote (emoji 1, flag 2, e + accent 2)', () => {
  assert.deepEqual(runRanges([{ text: '🙂 a' }, { text: 'bold' }]), [{ start: 1, end: 3 }, { start: 4, end: 7 }]);
  assert.deepEqual(runRanges([{ text: 'a🇦🇪e\u0301' }, { text: 'z' }]), [{ start: 1, end: 5 }, { start: 6, end: 6 }]);
});

function sampleDeck() {
  const run = (text, extra = {}) => ({ text, ps: 'HelveticaNeue', font: ['Helvetica Neue'], weight: 400, italic: false, size: 32, color: [17, 17, 17], alpha: 1, ...extra });
  return { width: 1920, height: 1080, warnings: [], slides: [
    { index: 1, plate: { path: '/tmp/kx/s01-plate.png' },
      media: [{ path: '/tmp/kx/s01-m1.png', x: 100, y: 100, w: 400, h: 300, kind: 'img' }],
      tables: [{ x: 600, y: 100, w: 800, h: 200, headerRows: 1, rows: [['A', 'B'], ['1', '2']],
        styles: [[{ ps: 'HelveticaNeue-Bold', size: 20, color: [0, 0, 0], bg: [240, 240, 240], align: 'left' }, null], [null, null]] }],
      charts: [{ x: 100, y: 500, w: 600, h: 400, type: 'bar', rows: ['2021', '2022'], columns: ['A'], data: [[1], [2]] }],
      texts: [{ x: 96, y: 300, w: 820, h: 120, source: 'block',
        runs: [run('He said "go" '), run('bold', { ps: 'HelveticaNeue-Bold' })] }],
      notes: 'note one' },
    { index: 2, plate: { path: '/tmp/kx/s02-plate.png' }, media: [], tables: [], charts: [], texts: [], notes: '' },
  ] };
}

test('buildAppleScript holds its own document and never touches others', () => {
  const src = buildAppleScript(sampleDeck(), { savePath: "/tmp/Terry's Deck.export-1.key" });
  assert.equal(src.split('make new document with properties {document theme:theme "Basic White", width:1920, height:1080}').length - 1, 1);
  for (const banned of ['front document', 'document "', '.pptx']) assert.ok(!src.includes(banned), banned);
  assert.equal(src.split('make new slide').length - 1, 1);
  assert.match(src, /set presenter notes of s to "note one"/);
  assert.match(src, /save d in \(POSIX file "\/tmp\/Terry's Deck\.export-1\.key"\)\nclose d saving no/);
  assert.match(src, /on error errMsg number errNum\n {2}try\n {4}close d saving no/);
  assert.match(src, /error "kx-failed at " & kxWhere/);
  assert.ok(!buildAppleScript(sampleDeck(), { savePath: '/tmp/x.key', keepOpen: true }).includes('close d saving no\non error'));
});

test('buildAppleScript waits for each new image before styling it', () => {
  const src = buildAppleScript(sampleDeck(), { savePath: '/tmp/x.key' });
  const block = src.slice(src.indexOf('slide 1 plate'));
  assert.match(block, /make new image[^\n]*\nend tell\nrepeat 50 times\n {2}try\n {4}get width of kxObj\n {4}exit repeat\n {2}on error\n {4}delay 0\.1/);
  assert.ok(block.indexOf('repeat 50 times') < block.indexOf('set width of kxObj'));
  assert.equal(src.split('repeat 50 times').length - 1, 3, 'one wait per image (2 plates + 1 media)');
});

test('buildAppleScript emits native charts with unquoted constants', () => {
  const src = buildAppleScript(sampleDeck(), { savePath: '/tmp/x.key' });
  assert.ok(src.includes('add chart row names {"2021", "2022"} column names {"A"} data {{1}, {2}} type vertical_bar_2d group by chart column'));
  const types = { bar: 'vertical_bar_2d', horizontal_bar: 'horizontal_bar_2d', stacked_bar: 'stacked_vertical_bar_2d', line: 'line_2d', area: 'area_2d', pie: 'pie_2d' };
  for (const [t, k] of Object.entries(types)) {
    const d = sampleDeck(); d.slides[0].charts[0].type = t;
    assert.ok(buildAppleScript(d, { savePath: '/tmp/x.key' }).includes(`type ${k} group by chart column`), t);
  }
});

test('buildAppleScript styles text before positioning it, with per-run ranges', () => {
  const src = buildAppleScript(sampleDeck(), { savePath: '/tmp/x.key' });
  const block = src.slice(src.indexOf('slide 1 text 1'));
  assert.ok(block.indexOf('set font of object text of kxObj') < block.indexOf('set position of kxObj'));
  assert.ok(block.includes('set font of characters 14 thru 17 of object text of kxObj to "HelveticaNeue-Bold"'));
  assert.ok(block.includes('object text:"He said \\"go\\" bold"'));
});

test('buildAppleScript counts a CRLF as one character in run ranges', () => {
  const d = sampleDeck();
  d.slides[0].texts[0].runs = [{ ...d.slides[0].texts[0].runs[0], text: 'ab\r\ncd' }, { ...d.slides[0].texts[0].runs[1], text: 'XY' }];
  const src = buildAppleScript(d, { savePath: '/tmp/x.key' });
  assert.ok(src.includes('object text:"ab" & linefeed & "cdXY"'));
  assert.ok(src.includes('characters 6 thru 7 of object text'), 'bold run starts after a 5-character "ab\\ncd"');
});

test('buildAppleScript emits size and colour overrides on the run range', () => {
  const d = sampleDeck();
  d.slides[0].texts[0].runs[1] = { ...d.slides[0].texts[0].runs[1], ps: 'HelveticaNeue', size: 48, color: [255, 0, 0] };
  const src = buildAppleScript(d, { savePath: '/tmp/x.key' });
  assert.ok(src.includes('set size of characters 14 thru 17 of object text of kxObj to 48'));
  assert.ok(src.includes('set color of characters 14 thru 17 of object text of kxObj to {65535, 0, 0}'));
  assert.ok(!src.includes('set font of characters 14 thru 17'));
});

test('buildAppleScript escapes hostile text in tables, charts and notes', () => {
  const d = sampleDeck();
  const evil = 'a" & (do shell script "x") & "\\';
  d.slides[0].tables[0].rows[1][0] = evil;
  d.slides[0].charts[0].rows[0] = evil;
  d.slides[0].charts[0].columns[0] = evil;
  d.slides[0].notes = evil + '\nline 2';
  const src = buildAppleScript(d, { savePath: '/tmp/x.key' });
  const lit = '"a\\" & (do shell script \\"x\\") & \\"\\\\"';
  assert.ok(src.includes(`set value of cell 1 of row 2 to ${lit}`));
  assert.ok(src.includes(`add chart row names {${lit}, "2022"} column names {${lit}}`));
  assert.ok(src.includes(`set presenter notes of s to ${lit} & linefeed & "line 2"`));
  assert.ok(!/[^\\]"x"/.test(src.replaceAll('\\\\', '')), 'no unescaped inner quote');
});

test('buildAppleScript names the source slide in error locations', () => {
  const d = sampleDeck();
  d.slides[1].index = 5;
  const src = buildAppleScript(d, { savePath: '/tmp/x.key' });
  assert.ok(src.includes('set kxWhere to "slide 2 (source 5)"'));
  assert.ok(src.includes('set kxWhere to "slide 1"'));
});

test('buildAppleScript rejects non-numeric geometry and unknown chart types', () => {
  const bad = (mut, re) => { const d = sampleDeck(); mut(d); assert.throws(() => buildAppleScript(d, { savePath: '/tmp/x.key' }), re); };
  bad((d) => { d.slides[0].texts[0].x = NaN; }, /invalid x \(slide 1 text 1\)/);
  bad((d) => { d.slides[0].media[0].w = undefined; }, /invalid width/);
  bad((d) => { d.slides[0].charts[0].data[0][0] = 'abc'; }, /invalid chart value/);
  bad((d) => { d.slides[0].charts[0].data[0][0] = null; }, /invalid chart value/);
  bad((d) => { d.slides[0].tables[0].headerRows = '1; beep'; }, /invalid header rows/);
  bad((d) => { d.slides[0].index = '1" & beep & "'; }, /invalid slide index/);
  bad((d) => { d.slides[0].charts[0].type = 'constructor'; }, /unsupported chart type/);
  bad((d) => { d.slides[0].charts[0].type = 'donut'; }, /unsupported chart type "donut"/);
  const d = sampleDeck(); d.slides[0].tables[0].styles[0][0].align = 'toString';
  assert.ok(!buildAppleScript(d, { savePath: '/tmp/x.key' }).includes('set alignment of cell 1 of row 1 to toString'));
});

test('buildAppleScript skips an empty table and clamps header rows', () => {
  const d = sampleDeck();
  d.slides[0].tables.push({ x: 0, y: 0, w: 10, h: 10, headerRows: 0, rows: [], styles: [] });
  d.slides[0].tables[0].headerRows = 9;
  const src = buildAppleScript(d, { savePath: '/tmp/x.key' });
  assert.ok(!src.includes('slide 1 table 2'));
  assert.ok(src.includes('header row count:2,'));
});

test('buildAppleScript with keepOpen saves but leaves the document open', () => {
  const src = buildAppleScript(sampleDeck(), { savePath: '/tmp/x.key', keepOpen: true });
  assert.match(src, /save d in \(POSIX file "\/tmp\/x\.key"\)\non error/);
});

test('buildAppleScript keeps full precision in chart data', () => {
  const d = sampleDeck();
  d.slides[0].charts[0].data = [[0.004], [1234.5678]];
  assert.ok(buildAppleScript(d, { savePath: '/tmp/x.key' }).includes('data {{0.004}, {1234.5678}}'));
  d.slides[0].charts[0].data = [[1e-7], [2.5e21]];
  assert.ok(buildAppleScript(d, { savePath: '/tmp/x.key' }).includes('data {{0.0000001}, {2500000000000000000000}}'));
});

test('buildAppleScript rejects bad colours, chart shapes and blank numbers', () => {
  const bad = (mut, re) => { const d = sampleDeck(); mut(d); assert.throws(() => buildAppleScript(d, { savePath: '/tmp/x.key' }), re); };
  bad((d) => { d.slides[0].texts[0].runs[0].color = [NaN, 0, 0]; }, /invalid colour/);
  bad((d) => { d.slides[0].texts[0].runs[0].color = [0, 0, 0, 1]; }, /invalid colour/);
  bad((d) => { d.slides[0].tables[0].styles[0][0].bg = [0, 0]; }, /invalid background/);
  bad((d) => { d.slides[0].charts[0].data = [[1]]; }, /chart data shape/);
  bad((d) => { d.slides[0].charts[0].data = [[1, 2], [3, 4]]; }, /chart data shape/);
  bad((d) => { d.slides[0].charts[0].data[0][0] = ' '; }, /invalid chart value/);
  bad((d) => { d.slides[0].texts[0].x = []; }, /invalid x/);
});

test('buildAppleScript pads one-row tables to Keynote\'s two-row minimum, then deletes the spare row', () => {
  const d = sampleDeck();
  d.slides[0].tables[0] = { x: 0, y: 0, w: 100, h: 40, headerRows: 1, rows: [['only']], styles: [[null]] };
  const src = buildAppleScript(d, { savePath: '/tmp/x.key' });
  assert.ok(src.includes('make new table with properties {row count:2, column count:2, header row count:1,'));
  assert.ok(src.includes('tell kxObj\n  delete row 2\n  set format of cell 1 of row 1 to text'));
});

test('buildAppleScript sets the HTML column widths and row heights', () => {
  const d = sampleDeck();
  d.slides[0].tables[0].colWidths = [500, 300];
  d.slides[0].tables[0].rowHeights = [60, 48.5];
  const src = buildAppleScript(d, { savePath: '/tmp/x.key' });
  assert.ok(src.includes('  set width of column 1 to 500\n  set width of column 2 to 300\n  set height of row 1 to 60\n  set height of row 2 to 48.5'));
  d.slides[0].tables[0].colWidths = [500];
  assert.ok(!buildAppleScript(d, { savePath: '/tmp/x.key' }).includes('set width of column'), 'mismatched widths are ignored');
  d.slides[0].tables[0].colWidths = [500, NaN];
  assert.throws(() => buildAppleScript(d, { savePath: '/tmp/x.key' }), /invalid column width/);
});

test('buildAppleScript emits tables with values and cell styles', () => {
  const src = buildAppleScript(sampleDeck(), { savePath: '/tmp/x.key' });
  assert.ok(src.includes('make new table with properties {row count:2, column count:2, header row count:1'));
  assert.ok(src.includes('  set format of cell 2 of row 2 to text\n  set value of cell 2 of row 2 to "2"'), 'text format before value, so "+3" stays "+3"');
  assert.ok(src.includes('set font name of cell 1 of row 1 to "HelveticaNeue-Bold"'));
  assert.ok(src.includes('set background color of cell 1 of row 1 to {61680, 61680, 61680}'));
  assert.ok(src.includes('set alignment of cell 1 of row 1 to left'));
});

test('generated AppleScript compiles against Keynote\'s dictionary', { skip: process.platform !== 'darwin' || !fs.existsSync('/Applications/Keynote.app') }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-compile-'));
  const file = path.join(dir, 'build.applescript');
  fs.writeFileSync(file, buildAppleScript(sampleDeck(), { savePath: path.join(dir, 'x.key') }));
  const r = spawnSync('osacompile', ['-o', path.join(dir, 'build.scpt'), file], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

// ── comparison (--verify) ────────────────────────────────────────────────────
import { normWord, parseBboxHtml, matchWords, meanAbsDiff } from './lib/keynote-compare.mjs';

const words = [{ text: 'Ten', cx: 100, cy: 50 }, { text: 'small', cx: 200, cy: 50 }, { text: 'bets.', cx: 300, cy: 50 }];

test('matchWords passes identical word lists', () => {
  assert.deepEqual(matchWords(words, words), { matched: 3, total: 3, missing: [], displaced: [] });
});

test('matchWords fails a removed word (negative control)', () => {
  const r = matchWords(words, words.slice(0, 2));
  assert.deepEqual(r.missing, ['bets.']);
  assert.equal(r.matched, 2);
});

test('matchWords fails a word shifted 60 px (negative control)', () => {
  const pdf = words.map((w, i) => (i === 1 ? { ...w, cx: w.cx + 60 } : w));
  const r = matchWords(words, pdf);
  assert.equal(r.displaced.length, 1);
  assert.equal(r.displaced[0].text, 'small');
  assert.equal(r.displaced[0].dist, 60);
});

test('matchWords ignores extra PDF words such as chart labels', () => {
  const r = matchWords(words, [...words, { text: '2021', cx: 900, cy: 900 }]);
  assert.equal(r.matched, 3);
});

test('normWord drops punctuation and bullets but keeps emoji', () => {
  assert.equal(normWord('"Go"'), 'go');
  assert.equal(normWord('•'), '');
  assert.equal(normWord('🙂'), '🙂');
});

test('parseBboxHtml decodes entities and scales to 1920 wide', () => {
  const xml = '<doc><page width="960.000000" height="540.000000"><word xMin="10" yMin="20" xMax="30" yMax="40">Hi</word><word xMin="50" yMin="20" xMax="90" yMax="40">&quot;go&quot;</word><word xMin="95" yMin="20" xMax="99" yMax="40">•</word></page></doc>';
  const [page] = parseBboxHtml(xml);
  assert.deepEqual([...page], [{ text: 'Hi', cx: 40, cy: 60, h: 40 }, { text: '"go"', cx: 140, cy: 60, h: 40 }]);
});

test('matchWords pairs repeated words by least total distance', () => {
  // two "the" 30 px apart; Keynote moved both right by 20 px. Greedy matching
  // (HTML order or nearest pair first) gives one "the" the other's PDF word.
  const html = [{ text: 'the', cx: 100, cy: 50 }, { text: 'the', cx: 130, cy: 50 }];
  const pdf = [{ text: 'the', cx: 120, cy: 50 }, { text: 'the', cx: 150, cy: 50 }];
  assert.deepEqual(matchWords(html, pdf, 24), { matched: 2, total: 2, missing: [], displaced: [] });
  assert.deepEqual(matchWords([...html].reverse(), pdf, 24).displaced, []);
  // one PDF occurrence missing: one "the" is reported missing, not both
  assert.deepEqual(matchWords(html, pdf.slice(0, 1), 24).missing, ['the']);
});

test('parseBboxHtml keeps words with negative coordinates', () => {
  const xml = '<doc><page width="1920" height="1080"><word xMin="-4.5" yMin="10" xMax="20" yMax="30">Edge</word></page></doc>';
  assert.equal(parseBboxHtml(xml)[0].length, 1);
});

test('normWord folds ligatures from PDF text (NFKC)', () => {
  assert.equal(normWord('\uFB01nal'), 'final');
});

test('ligature-split and hyphen-wrapped PDF words still match (Keynote PDF, 2026-10-05)', () => {
  // real shape: "Office" comes out as "O" + "ce", the ffi glyph parked at the page bottom with no height
  const xml = '<doc><page width="1920" height="1080">'
    + '<word xMin="574" yMin="911.5" xMax="644" yMax="937">Private</word>'
    + '<word xMin="648.7" yMin="911.5" xMax="664.7" yMax="937">O</word>'
    + '<word xMin="685.6" yMin="911.5" xMax="709" yMax="937">ce</word>'
    + '<word xMin="580.7" yMin="1080" xMax="581.7" yMax="1080">ffi</word>'
    + '<word xMin="100" yMin="300" xMax="160" yMax="320">fast-</word>'
    + '<word xMin="100" yMin="330" xMax="180" yMax="350">growing</word>'
    + '</page></doc>';
  const [pdf] = parseBboxHtml(xml);
  assert.ok(!pdf.some((w) => w.text === 'ffi'), 'zero-height ligature glyph dropped');
  // the hyphenated word wrapped in Keynote (a substitute font): present, so relaxed passes it
  const html = [{ text: 'Private', cx: 609, cy: 924 }, { text: 'Office', cx: 679, cy: 924 }, { text: 'fast-growing', cx: 200, cy: 310, relaxed: true }];
  const r = matchWords(html, pdf);
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.displaced, []);
  assert.equal(r.matched, 3);
  // not relaxed: found, but it moved (the wrap is a real layout change)
  assert.deepEqual(matchWords([{ text: 'fast-growing', cx: 200, cy: 310 }], pdf).displaced.map((x) => x.text), ['fast-growing']);
  // stream order can interleave another line's words between the fragments (real shape)
  const interleaved = [{ text: 'and', cx: 1562, cy: 414, h: 33 }, { text: 'a', cx: 1598, cy: 414, h: 33 },
    { text: 'agreed', cx: 905, cy: 450, h: 33 }, { text: 'liated', cx: 1669, cy: 414, h: 33 }];
  assert.deepEqual(matchWords([{ text: 'affiliated', cx: 1640, cy: 414 }], interleaved).missing, []);
  // Cormorant's ligatures (real Keynote PDF shape): the page's parked glyphs say which letters can be missing
  const corm = '<doc><page width="1920" height="1080">'
    + '<word xMin="210.4" yMin="307.3" xMax="280" yMax="409">su</word><word xMin="352.6" yMin="307.3" xMax="443.5" yMax="409">est</word>'
    + '<word xMin="535.4" yMin="490.9" xMax="563.9" yMax="592.6">e</word><word xMin="219" yMin="700" xMax="407" yMax="860">ank</word>'
    + '<word xMin="373.3" yMin="1080" xMax="374.3" yMax="1080">Th</word><word xMin="196" yMin="1080" xMax="197" yMax="1080">gg</word>'
    + '</page></doc>';
  const [cp] = parseBboxHtml(corm);
  assert.deepEqual(cp.ghosts.sort(), ['gg', 'th']);
  const cr = matchWords([{ text: 'suggest', cx: 327, cy: 358 }, { text: 'The', cx: 520, cy: 542 }, { text: 'Thank', cx: 280, cy: 780 }], cp);
  assert.deepEqual(cr.missing, []);
  assert.deepEqual(cr.displaced, []);
  // hyphen wrap plus a ligature in the second half (real: "high-" / "uality", q parked)
  const hq = [{ text: 'high-', cx: 1095, cy: 937, h: 41 }, { text: 'uality', cx: 138, cy: 974, h: 41 }];
  hq.ghosts = ['q'];
  assert.deepEqual(matchWords([{ text: 'high-quality', cx: 1110, cy: 937, relaxed: false }], hq).missing, []);
  // a word that merely contains a fragment is not matched
  assert.deepEqual(matchWords([{ text: 'Theme', cx: 520, cy: 542 }], cp).missing, ['Theme']);
  // a ligature at the start of a word leaves one fragment
  assert.deepEqual(matchWords([{ text: 'fireside', cx: 130, cy: 400 }], [{ text: 'reside', cx: 135, cy: 400, h: 20 }]).missing, []);
  // a fragment is used once: a second "Office" with no fragments left is missing
  assert.deepEqual(matchWords([...html, { text: 'Office', cx: 679, cy: 924 }], pdf).missing, ['Office']);
});

test('parseBboxHtml decodes numeric entities', () => {
  const xml = '<doc><page width="1920" height="1080"><word xMin="0" yMin="0" xMax="10" yMax="10">caf&#233;&#x2019;s</word></page></doc>';
  assert.equal(parseBboxHtml(xml)[0][0].text, 'café’s');
});

test('matchWords checks only presence for relaxed (substituted-font) words', () => {
  const html = words.map((w, i) => (i === 1 ? { ...w, relaxed: true } : w));
  const pdf = words.map((w, i) => (i === 1 ? { ...w, cx: w.cx + 60 } : w));
  assert.deepEqual(matchWords(html, pdf), { matched: 3, total: 3, missing: [], displaced: [] });
  assert.deepEqual(matchWords(html, pdf.filter((_, i) => i !== 1)).missing, ['small']);
});

test('matchWords lets substituted-font words move sideways but not onto another line', () => {
  const html = words.map((w) => ({ ...w, relaxed: true }));
  const sideways = words.map((w) => ({ ...w, cx: w.cx + 80 }));
  assert.equal(matchWords(html, sideways).matched, 3);
  const wrapped = words.map((w, i) => (i === 2 ? { ...w, cx: 100, cy: w.cy + 60 } : w)); // "bets." pushed onto the next line
  const r = matchWords(html, wrapped);
  assert.deepEqual(r.displaced, [{ text: 'bets.', dist: 60 }]);
});

test('mapFonts gives text in a substituted font room to the slide edge', () => {
  const run = (font) => ({ text: 'x', font, weight: 400, italic: false, size: 20, color: [0, 0, 0], alpha: 1 });
  const deck = { width: 1920, slides: [{ index: 1, texts: [
    { x: 500, w: 300, runs: [run(['Cormorant Garamond', 'Georgia', 'serif'])] },
    { x: 500, w: 300, runs: [run(['Inter'])] },
  ] }] };
  mapFonts(deck, INV);
  assert.equal(deck.slides[0].texts[0].w, 1420);
  assert.equal(deck.slides[0].texts[1].w, 300);
});

test('matchWords adds a word\'s extraTol (dropped letter-spacing) to the tolerance', () => {
  const pdf = words.map((w, i) => (i === 1 ? { ...w, cx: w.cx + 40 } : w));
  assert.equal(matchWords(words.map((w, i) => (i === 1 ? { ...w, extraTol: 20 } : w)), pdf).displaced.length, 0);
  assert.equal(matchWords(words.map((w, i) => (i === 1 ? { ...w, extraTol: 10 } : w)), pdf).displaced.length, 1);
});

test('meanAbsDiff is 0 for equal images, 1 for opposite, and honours the mask', () => {
  const a = new Uint8Array([0, 0, 0, 0]);
  const b = new Uint8Array([255, 255, 255, 255]);
  assert.equal(meanAbsDiff(a, a), 0);
  assert.equal(meanAbsDiff(a, b), 1);
  const c = new Uint8Array([0, 0, 255, 255]);
  assert.equal(meanAbsDiff(a, c, new Uint8Array([0, 0, 1, 1])), 0);
  assert.throws(() => meanAbsDiff(a, new Uint8Array(3)));
});

// ── CLI (stubbed: no Keynote, no browser) ────────────────────────────────────
import { parseArgs, parseSlides, planOutput, main, replaceFile } from './keynote-export.mjs';

test('parseSlides expands ranges and rejects bad input', () => {
  assert.deepEqual(parseSlides('1,3-4', 5), [1, 3, 4]);
  assert.deepEqual(parseSlides('4,1-2,2', 5), [1, 2, 4]);
  assert.throws(() => parseSlides('0', 5), RangeError);
  assert.throws(() => parseSlides('2-9', 5), RangeError);
  assert.throws(() => parseSlides('a', 5), RangeError);
});

test('parseArgs rejects unknown flags and missing values', () => {
  assert.throws(() => parseArgs(['d.html', '--nope']));
  assert.throws(() => parseArgs(['d.html', '--out']));
  assert.throws(() => parseArgs([]));
  assert.equal(parseArgs(['d.html', '--verify', '--force']).verify, true);
});

test('planOutput refuses an existing file without --force and names temp files', () => {
  assert.equal(planOutput({ out: '/x/d.key', exists: true, force: false }).refuse, true);
  const p = planOutput({ out: '/x/d.key', exists: true, force: true, pid: 7, tag: () => 'abc123' });
  assert.equal(p.refuse, false);
  assert.equal(p.temp, '/x/d.export-7-abc123.key');
  // a taken temp name is never reused
  const tags = ['aaa', 'bbb'];
  assert.equal(planOutput({ out: '/x/d.key', exists: false, force: false, pid: 7, tag: () => tags.shift(), taken: (q) => q.endsWith('-aaa.key') }).temp, '/x/d.export-7-bbb.key');
  assert.equal(p.unverified, '/x/d.unverified.key');
});

// harness: a temp dir with a fake deck, and stub deps that record calls
function harness({ slides = 2, osa = 'ok', verify = 'pass', missingTool = null, playwright = true, onBuild = null, extractThrows = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kx-cli Terry's Deck - x "));
  harnessDirs.push(dir);
  const deck = path.join(dir, 'deck.html');
  fs.writeFileSync(deck, '<html></html>');
  const calls = { osa: 0, extract: 0, verify: 0, scripts: [], logs: [], errs: [] };
  const model = { width: 1920, height: 1080, warnings: [], slides: Array.from({ length: slides }, (_, i) => ({
    index: i + 1, plate: { path: path.join(dir, 'p.png') }, media: [], tables: [], charts: [], notes: '',
    texts: [{ x: 1, y: 1, w: 10, h: 10, source: 'block', runs: [{ text: 'hi', font: ['Helvetica Neue'], weight: 400, italic: false, size: 20, color: [0, 0, 0], alpha: 1 }] }] })) };
  const deps = {
    hasKeynote: () => true,
    hasPlaywright: () => playwright,
    onSignal: () => () => {},
    which: (c) => c !== missingTool,
    countSlides: async () => slides,
    extractDeck: async () => { calls.extract++; if (extractThrows) throw new Error('extract blew up'); return model; },
    queryFontInventory: () => INV,
    runOsa: (script) => {
      calls.osa++; calls.scripts.push(script);
      const m = script.match(/save d in \(POSIX file "(.+)"\)/);
      const savePath = m && m[1].replaceAll('\\"', '"').replaceAll('\\\\', '\\');
      if (osa === 'timeout') return { ok: false, timedOut: true, stdout: '', stderr: 'spawnSync osascript ETIMEDOUT' };
      if (osa === 'partial') { fs.writeFileSync(savePath, 'HALF'); return { ok: false, stdout: '', stderr: 'execution error: kx-failed at save: disk full' }; }
      if (osa !== 'ok') return { ok: false, stdout: '', stderr: 'execution error: kx-failed at slide 2 text 1: Invalid index. (-1719)' };
      if (savePath) fs.writeFileSync(savePath, 'NEW BUILD');
      if (onBuild) onBuild();
      return { ok: true, stdout: 'OK', stderr: '' };
    },
    verifyDeck: async (args) => { calls.verify++; calls.verifyArgs = args; if (verify === 'throw') throw new Error('page.evaluate: decode failed'); return { pass: verify === 'pass', lines: [`slide 1 words 1/1 diff 0.1% ${verify === 'pass' ? 'PASS' : 'FAIL'}`] }; },
    openInKeynote: (f) => { calls.opened = f; },
    log: (s) => calls.logs.push(s),
    err: (s) => calls.errs.push(s),
  };
  return { dir, deck, out: path.join(dir, 'x.key'), deps, calls };
}
const leftovers = (dir) => fs.readdirSync(dir).filter((f) => /\.export-/.test(f));
const harnessDirs = [];
after(() => { for (const d of harnessDirs) fs.rmSync(d, { recursive: true, force: true }); });

test('main refuses an existing output without --force before touching Keynote', async () => {
  const h = harness();
  fs.writeFileSync(h.out, 'USER EDITS');
  assert.equal(await main([h.deck, '--out', h.out], h.deps), 2);
  assert.equal(h.calls.osa + h.calls.extract, 0);
  assert.equal(fs.readFileSync(h.out, 'utf8'), 'USER EDITS');
});

test('main reports a file with no slides and never calls Keynote', async () => {
  const h = harness({ slides: 0 });
  assert.equal(await main([h.deck, '--out', h.out], h.deps), 1);
  assert.match(h.calls.errs.join('\n'), /no slides found/);
  assert.equal(h.calls.osa, 0);
});

test('main checks for Poppler before extracting when --verify is set', async () => {
  const h = harness({ missingTool: 'pdftotext' });
  assert.equal(await main([h.deck, '--out', h.out, '--verify'], h.deps), 2);
  assert.match(h.calls.errs.join('\n'), /Poppler/);
  assert.equal(h.calls.extract, 0);
});

test('main rejects a slide range outside the deck', async () => {
  const h = harness({ slides: 3 });
  assert.equal(await main([h.deck, '--out', h.out, '--slides', '2-9'], h.deps), 2);
  assert.equal(h.calls.osa + h.calls.extract, 0);
  assert.match(h.calls.errs.join('\n'), /2-9/);
});

test('parseArgs refuses a flag or an empty string where a value should be', () => {
  assert.throws(() => parseArgs(['d.html', '--out', '--force']), /--out needs a value/);
  assert.throws(() => parseArgs(['d.html', '--out', '--verify']), /--out needs a value/);
  assert.throws(() => parseArgs(['d.html', '--slides']), /--slides needs a value/);
  assert.throws(() => parseArgs(['d.html', '--slides', '']), /--slides needs a value/);
});

test('data protection: a half-written build from a failed save is removed', async () => {
  const h = harness({ osa: 'partial' });
  assert.equal(await main([h.deck, '--out', h.out], h.deps), 1);
  assert.deepEqual(leftovers(h.dir), []);
  assert.equal(fs.existsSync(h.out), false);
});

test('data protection: an older run\'s leftover build file is never deleted', async () => {
  const h = harness({ extractThrows: true });
  const old = path.join(h.dir, `x.export-${process.pid}.key`);
  fs.writeFileSync(old, 'OLD RUN');
  await assert.rejects(main([h.deck, '--out', h.out], h.deps), /extract blew up/);
  assert.equal(fs.readFileSync(old, 'utf8'), 'OLD RUN');
  const h2 = harness();
  const old2 = path.join(h2.dir, `x.export-${process.pid}.key`);
  fs.writeFileSync(old2, 'OLD RUN');
  assert.equal(await main([h2.deck, '--out', h2.out], h2.deps), 0);
  assert.equal(fs.readFileSync(old2, 'utf8'), 'OLD RUN');
});

test('data protection: a file saved at --out during the run is not replaced without --force', async () => {
  let h;
  h = harness({ onBuild: () => fs.writeFileSync(h.out, 'SAVED MEANWHILE') });
  assert.equal(await main([h.deck, '--out', h.out], h.deps), 1);
  assert.equal(fs.readFileSync(h.out, 'utf8'), 'SAVED MEANWHILE');
  assert.equal(fs.readFileSync(path.join(h.dir, 'x.unverified.key'), 'utf8'), 'NEW BUILD');
  assert.match(h.calls.errs.join('\n'), /appeared during the export/);
  assert.deepEqual(leftovers(h.dir), []);
});

test('data protection: --out must be a .key, never a folder or the deck itself', async () => {
  const h = harness();
  const folder = path.join(h.dir, 'MyProject');
  fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder, 'keep.txt'), 'KEEP');
  assert.equal(await main([h.deck, '--out', folder, '--force'], h.deps), 2);
  assert.equal(fs.readFileSync(path.join(folder, 'keep.txt'), 'utf8'), 'KEEP');
  assert.equal(await main([h.deck, '--out', h.deck, '--force'], h.deps), 2);
  assert.equal(fs.readFileSync(h.deck, 'utf8'), '<html></html>');
  assert.equal(h.calls.osa + h.calls.extract, 0);
  assert.match(h.calls.errs.join('\n'), /must end in \.key/);
});

test('data protection: a broken symlink at --out counts as an existing file', async () => {
  const h = harness();
  fs.symlinkSync(path.join(h.dir, 'nowhere.key'), h.out);
  assert.equal(await main([h.deck, '--out', h.out], h.deps), 2);
  assert.equal(fs.lstatSync(h.out).isSymbolicLink(), true);
});

test('data protection: an earlier .unverified.key is never replaced', async () => {
  const h = harness({ verify: 'fail' });
  const first = path.join(h.dir, 'x.unverified.key');
  fs.writeFileSync(first, 'HAND EDITS');
  assert.equal(await main([h.deck, '--out', h.out, '--verify'], h.deps), 1);
  assert.equal(fs.readFileSync(first, 'utf8'), 'HAND EDITS');
  assert.equal(fs.readFileSync(path.join(h.dir, 'x.unverified-2.key'), 'utf8'), 'NEW BUILD');
  assert.match(h.calls.errs.join('\n'), /x\.unverified-2\.key/);
});

test('font warnings are printed when verification fails too', async () => {
  const h = harness({ verify: 'fail' });
  h.deps.queryFontInventory = () => INV;
  const model = await h.deps.extractDeck();
  model.slides[0].texts[0].runs[0].font = ['Cormorant Garamond'];
  h.deps.extractDeck = async () => model;
  assert.equal(await main([h.deck, '--out', h.out, '--verify'], h.deps), 1);
  assert.match(h.calls.logs.join('\n'), /warning: font not installed: "Cormorant Garamond"/);
});

test('data protection: a crash inside verify keeps the build and the user file', async () => {
  const h = harness({ verify: 'throw' });
  fs.writeFileSync(h.out, 'USER EDITS');
  assert.equal(await main([h.deck, '--out', h.out, '--force', '--verify'], h.deps), 1);
  assert.equal(fs.readFileSync(h.out, 'utf8'), 'USER EDITS');
  assert.equal(fs.readFileSync(path.join(h.dir, 'x.unverified.key'), 'utf8'), 'NEW BUILD');
  assert.match(h.calls.logs.join('\n'), /verify: page\.evaluate: decode failed/);
  assert.deepEqual(leftovers(h.dir), []);
});

test('replaceFile restores the old file when the new one cannot be moved in', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-replace-'));
  const dest = path.join(dir, 'x.key');
  fs.writeFileSync(dest, 'USER EDITS');
  assert.throws(() => replaceFile(path.join(dir, 'missing.export-1.key'), dest));
  assert.equal(fs.readFileSync(dest, 'utf8'), 'USER EDITS');
  assert.deepEqual(fs.readdirSync(dir), ['x.key']);
  fs.writeFileSync(path.join(dir, 'new.key'), 'NEW');
  replaceFile(path.join(dir, 'new.key'), dest);
  assert.equal(fs.readFileSync(dest, 'utf8'), 'NEW');
  assert.deepEqual(fs.readdirSync(dir), ['x.key']);
});

test('main names the contact sheet after --out, keeps temp files on request, and opens on --open', async () => {
  const h = harness();
  assert.equal(await main([h.deck, '--out', h.out, '--verify', '--keep-temp', '--open'], h.deps), 0);
  assert.equal(h.calls.verifyArgs.sheetBase, h.out);
  const kept = h.calls.logs.join('\n').match(/temp files kept in (.+)/);
  assert.ok(kept && fs.existsSync(path.join(kept[1], 'build.applescript')), h.calls.logs.join('|'));
  assert.equal(h.calls.opened, h.out);
});

test('main reports a missing Playwright as a prerequisite error (exit 2)', async () => {
  const h = harness({ playwright: false });
  assert.equal(await main([h.deck, '--out', h.out], h.deps), 2);
  assert.match(h.calls.errs.join('\n'), /Playwright not found/);
  assert.equal(h.calls.extract, 0);
});

test('an osascript timeout says Keynote may have a document left open', async () => {
  const h = harness({ osa: 'timeout' });
  assert.equal(await main([h.deck, '--out', h.out], h.deps), 1);
  assert.match(h.calls.errs.join('\n'), /untitled export document open/);
  assert.deepEqual(leftovers(h.dir), []);
});

test('buildAppleScript runs inside its own AppleScript timeout', () => {
  const src = buildAppleScript(sampleDeck(), { savePath: '/tmp/x.key', timeoutS: 900 });
  assert.match(src, /tell application "Keynote"\nwith timeout of 900 seconds\n/);
  assert.match(src, /end try\nend timeout\nend tell/);
});

test('main saves into a path with an apostrophe and renames the build into place', async () => {
  const h = harness();
  assert.equal(await main([h.deck, '--out', h.out], h.deps), 0);
  assert.ok(h.calls.scripts[0].includes("Terry's Deck - x"));
  assert.equal(fs.readFileSync(h.out, 'utf8'), 'NEW BUILD');
  assert.deepEqual(leftovers(h.dir), []);
});

test('data protection: --force --verify failing leaves the user file untouched', async () => {
  const h = harness({ verify: 'fail' });
  fs.writeFileSync(h.out, 'USER EDITS');
  assert.equal(await main([h.deck, '--out', h.out, '--force', '--verify'], h.deps), 1);
  assert.equal(fs.readFileSync(h.out, 'utf8'), 'USER EDITS');
  assert.equal(fs.readFileSync(path.join(h.dir, 'x.unverified.key'), 'utf8'), 'NEW BUILD');
  assert.deepEqual(leftovers(h.dir), []);
});

test('data protection: an AppleScript error leaves the user file and no temp file', async () => {
  const h = harness({ osa: 'fail' });
  fs.writeFileSync(h.out, 'USER EDITS');
  assert.equal(await main([h.deck, '--out', h.out, '--force'], h.deps), 1);
  assert.equal(fs.readFileSync(h.out, 'utf8'), 'USER EDITS');
  assert.deepEqual(leftovers(h.dir), []);
  assert.match(h.calls.errs.join('\n'), /slide 2 text 1/);
});

test('main refuses an output path with a line break before touching Keynote', async () => {
  const h = harness();
  assert.equal(await main([h.deck, '--out', path.join(h.dir, 'a\nb.key')], h.deps), 2);
  assert.equal(h.calls.osa + h.calls.extract, 0);
});

test('main passes the font inventory to verifyDeck', async () => {
  const h = harness();
  assert.equal(await main([h.deck, '--out', h.out, '--verify'], h.deps), 0);
  assert.equal(h.calls.verifyArgs.inventory, INV);
});

test('data protection: --force --verify passing replaces the file cleanly', async () => {
  const h = harness();
  fs.writeFileSync(h.out, 'USER EDITS');
  assert.equal(await main([h.deck, '--out', h.out, '--force', '--verify'], h.deps), 0);
  assert.equal(fs.readFileSync(h.out, 'utf8'), 'NEW BUILD');
  assert.equal(fs.existsSync(path.join(h.dir, 'x.unverified.key')), false);
  assert.deepEqual(leftovers(h.dir), []);
});
