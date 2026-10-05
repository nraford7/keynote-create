#!/usr/bin/env node
// keynote-export.browser.test.mjs — extraction tests (needs Playwright).
// Runs extractDeck on the export fixture and on freshly rendered baseline
// decks, and checks the slide model against sample-export.expected.json
// (written by the fixture generator, never by the extractor).
//
// Run: node --test scripts/keynote-export.browser.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractDeck, withDeck, freezeVideos, slideWords } from './lib/keynote-extract.mjs';
import { renderBaselineDecks } from './lib/test-decks.mjs';
import { getPlaywright } from './lib/playwright.mjs';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FIXTURE = path.join(REPO, 'docs/fixtures/sample-export.html');
const EXPECTED = JSON.parse(fs.readFileSync(path.join(REPO, 'docs/fixtures/sample-export.expected.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kx-browser-'));
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const joined = (slide) => norm(slide.texts.map((t) => t.runs.map((r) => r.text).join('')).join(' '));

const deck = await extractDeck(FIXTURE, { outDir: path.join(tmp, 'fx') });

// pixel(png, x, y) → [r,g,b,a] read in a browser canvas (no npm PNG decoder)
async function pixels(file, pts) {
  const { chromium } = getPlaywright();
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    return await p.evaluate(async ({ b64, pts }) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      return { w: img.width, h: img.height, px: pts.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data]) };
    }, { b64: fs.readFileSync(file).toString('base64'), pts });
  } finally { await b.close(); }
}
const near = (a, b, tol) => b.every((v, i) => Math.abs(a[i] - v) <= tol);

test('four slides, each with a 2x plate PNG', async () => {
  assert.equal(deck.slides.length, 4);
  for (const s of deck.slides) {
    const { w, h } = await pixels(s.plate.path, []);
    assert.deepEqual([w, h], [3840, 2160]);
  }
});

test('text per slide equals the generator-written expected text', () => {
  deck.slides.forEach((s, i) => assert.equal(joined(s), norm(EXPECTED.slides[i].texts.join(' ')), `slide ${i + 1}`));
});

test('hidden content never exports', () => {
  for (const s of deck.slides) assert.ok(!joined(s).includes(EXPECTED.hiddenText));
});

test('slide 1: one item per <li>, its em-dash marker a separate red item where the HTML puts it', async () => {
  const lis = deck.slides[0].texts.filter((t) => t.source === 'li');
  const marks = deck.slides[0].texts.filter((t) => t.source === 'marker');
  assert.equal(lis.length, 3);
  assert.equal(marks.length, 3);
  for (const t of lis) assert.ok(!t.runs[0].text.startsWith(EXPECTED.marker.text), t.runs[0].text);
  for (const m of marks) {
    assert.equal(m.runs.length, 1);
    assert.equal(m.runs[0].text, EXPECTED.marker.text);
    assert.deepEqual(m.runs[0].color, EXPECTED.marker.color);
    assert.equal(m.runs[0].size, EXPECTED.marker.size);
    assert.ok(Math.abs(m.x - EXPECTED.marker.x) <= 3, `marker x ${m.x}`);
  }
  const tops = await withDeck(FIXTURE, {}, (page) => page.evaluate(() => {
    const s = document.querySelectorAll('.slide')[0].getBoundingClientRect();
    return [...document.querySelectorAll('.list li')].map((li) => {
      const r = document.createRange(); r.selectNodeContents(li.firstChild);
      const b = r.getBoundingClientRect();
      return { top: b.top - s.top, left: b.left - s.left, mid: b.top + b.height / 2 - s.top };
    });
  }));
  lis.forEach((t, i) => {
    assert.ok(Math.abs(t.y - tops[i].top) <= 2, `li ${i + 1}: ${t.y} vs ${tops[i].top}`);
    assert.ok(Math.abs(t.x - tops[i].left) <= 2, `li ${i + 1} x: ${t.x} vs ${tops[i].left}`);
    const mm = marks[i].y + marks[i].h / 2;
    assert.ok(Math.abs(mm - tops[i].mid) <= 8, `marker ${i + 1} mid ${mm} vs text mid ${tops[i].mid}`);
  });
});

test('slide 1: the red run keeps its colour', () => {
  const run = deck.slides[0].texts.flatMap((t) => t.runs).find((r) => r.text === 'red words');
  assert.deepEqual(run.color, [210, 34, 34]);
});

test('plates keep decoration rules and drop text, scrims and media', async () => {
  // slide 1: footer rule (#dcdfe3, 1px at y=1028) and li rules stay; marker and text gone
  const s1 = await pixels(deck.slides[0].plate.path, [[800, 2056], [300, 2 * 220 + 2], [161, 2 * 220 + 2 * 24 + 14]]);
  assert.ok(near(s1.px[0], [220, 223, 227], 8), `footer rule ${s1.px[0]}`);
  assert.ok(near(s1.px[2], [255, 255, 255], 4), `marker stripped ${s1.px[2]}`);
  // slide 2: the scrim is above the video, so it lives in the group, not the plate
  const s2 = await pixels(deck.slides[1].plate.path, [[2400, 1400]]);
  assert.ok(near(s2.px[0], [255, 255, 255], 4), `scrim stripped from plate ${s2.px[0]}`);
});

test('slide 1: 55% white over black composites to RGB 140 (independent expectation)', () => {
  const run = deck.slides[0].texts.flatMap((t) => t.runs).find((r) => r.text === EXPECTED.fadedRun.text);
  assert.ok(run, 'faded run present');
  assert.equal(run.alpha, EXPECTED.fadedRun.alpha);
  assert.ok(near(run.color, EXPECTED.fadedRun.expectedRgb, 1), run.color.join());
});

test('slide 1: notes come from .speaker-note only', () => {
  assert.equal(deck.slides[0].notes, EXPECTED.slides[0].notes);
  assert.equal(deck.slides[1].notes, '');
  assert.equal(deck.slides[3].notes, EXPECTED.slides[3].notes);
});

test('slide 2: video, scrim and caption plate become one group; caption text stays editable', async () => {
  const media = deck.slides[1].media;
  assert.equal(media.length, 1);
  assert.equal(media[0].kind, 'group');
  assert.deepEqual([media[0].x, media[0].y, media[0].w, media[0].h].map(Math.round), [0, 0, 1920, 1080]);
  const cap = deck.slides[1].texts.find((t) => t.runs.some((r) => r.text.includes('Caption')));
  const cx = Math.round((cap.x + cap.w / 2.08) * 2), cy = Math.round((cap.y + cap.h / 2) * 2);
  const { px } = await pixels(media[0].path, [[cx, cy], [200, 200]]);
  assert.ok(near(px[0], [30, 58, 95], 10), `caption centre ${px[0]}`); // plate colour, text transparent
  assert.ok(near(px[1], EXPECTED.videoFrame0, 12), `frame 0 ${px[1]}`);
});

test('video frame stays frame 0 after playback resumes', async () => {
  await withDeck(FIXTURE, {}, async (page) => {
    await page.evaluate(() => { const v = document.querySelector('video'); v.muted = true; return v.play(); });
    await page.waitForTimeout(1500);
    await freezeVideos(page);
    const st = await page.evaluate(() => { const v = document.querySelector('video'); return { paused: v.paused, t: v.currentTime }; });
    assert.equal(st.paused, true);
    assert.equal(st.t, 0);
    const file = path.join(tmp, 'refrozen.png');
    await page.locator('.slide >> nth=1').screenshot({ path: file });
    const { px } = await pixels(file, [[200, 200]]);
    assert.ok(near(px[0], EXPECTED.videoFrame0, 12), `refrozen ${px[0]}`);
  });
});

test('slide 3: native table data and a centred heading split per line', () => {
  const s = deck.slides[2];
  assert.equal(s.tables.length, 1);
  assert.deepEqual(s.tables[0].rows, EXPECTED.slides[2].tables[0]);
  assert.equal(s.tables[0].headerRows, 1);
  assert.equal(s.tables[0].styles[0][0].weight, 700);
  assert.deepEqual(s.tables[0].styles[0][0].bg, [236, 238, 240]);
  assert.equal(s.tables[0].styles[1][0].bg, null);
  const lines = s.texts.filter((t) => t.source === 'line');
  assert.equal(lines.length, 2);
  assert.notEqual(Math.round(lines[0].y), Math.round(lines[1].y));
  assert.equal(s.media.length, 1);
  assert.equal(s.media[0].kind, 'img');
});

test('slide 4: chart from data-kn-chart, no image for its SVG, hostile text exact', () => {
  const s = deck.slides[3];
  assert.equal(s.charts.length, 1);
  const { x, y, w, h, ...chart } = s.charts[0];
  assert.deepEqual(chart, EXPECTED.slides[3].charts[0]);
  assert.equal(s.media.length, 0);
  const runs = s.texts[0].runs.map((r) => r.text);
  assert.deepEqual(runs, ['He said "go" \\ now, café • 🙂 ', 'bold']);
  assert.equal(s.texts[0].runs[1].weight, 700);
});

test('slideWords returns slide-relative word centres', async () => {
  const words = await withDeck(FIXTURE, {}, (page) => slideWords(page, 0));
  const w = words.find((x) => x.text === 'Lists');
  assert.ok(w && w.cx > 80 && w.cx < 400 && w.cy > 80 && w.cy < 200, JSON.stringify(w));
  assert.ok(!words.some((x) => x.text === 'Hidden'));
});

test('a --slides subset keeps source indexes and file names', async () => {
  const d = await extractDeck(FIXTURE, { outDir: path.join(tmp, 'subset'), slides: [2, 4] });
  assert.deepEqual(d.slides.map((s) => s.index), [2, 4]);
  assert.deepEqual(d.slides.map((s) => path.basename(s.plate.path)), ['s02-plate.png', 's04-plate.png']);
  assert.equal(d.slides[1].charts.length, 1);
});

test('baseline decks render and extract; notes stay out of slide text', async () => {
  const decks = renderBaselineDecks(path.join(tmp, 'baseline'));
  const want = { boardroom: 5, keynote: 6 };
  for (const [name, html] of Object.entries(decks)) {
    const d = await extractDeck(html, { outDir: path.join(tmp, name) });
    assert.equal(d.slides.length, want[name], name);
    const { w, h } = await pixels(d.slides[0].plate.path, []);
    assert.deepEqual([w, h], [3840, 2160], name);
    // expectations come from the source Markdown, not from the extractor
    const md = fs.readFileSync(path.join(REPO, 'docs/fixtures', `sample-${name}.md`), 'utf8');
    const lower = (x) => norm(x).toLowerCase();
    const allText = lower(d.slides.map(joined).join(' '));
    const headings = [...md.matchAll(/^##? (.+)$/gm)].map((m) => m[1]).filter((h) => h !== 'Title sequence');
    assert.ok(headings.length >= 5, `${name}: headings parsed`);
    for (const h of headings) assert.ok(allText.includes(lower(h)), `${name}: heading "${h}" missing from slide text`);
    const mdNotes = [...md.matchAll(/^> Speaker note: (.+)$/gm)].map((m) => norm(m[1]));
    const notes = d.slides.map((s) => norm(s.notes)).filter(Boolean);
    for (const n of mdNotes) {
      assert.ok(notes.some((x) => x.includes(n)), `${name}: note "${n.slice(0, 30)}" not extracted`);
      assert.ok(!allText.includes(lower(n).slice(0, 30)), `${name}: note leaked into slide text`);
    }
    if (name === 'boardroom') assert.equal(mdNotes.length, 1);
  }
});

// ── edge deck: one slide per extraction hazard, in a file name with '#' ─────
const VIDEO = fs.readFileSync(FIXTURE, 'utf8').match(/src="(data:video\/webm;base64,[^"]+)"/)[1];
const solid = (rgb) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="rgb(${rgb})"/></svg>`)}`;
const EDGE = path.join(tmp, 'edge #2.html');
fs.writeFileSync(EDGE, `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0;}
body{background:#222;font-family:'Helvetica Neue',sans-serif;}
.slide{width:1920px;height:1080px;position:relative;overflow:hidden;background:#fff;color:#111;margin-bottom:20px;}
.abs{position:absolute;}
img{display:block;}
.frame{position:absolute;left:100px;top:100px;width:600px;height:400px;}
.frame img{width:600px;height:400px;}
.frame::after{content:'';position:absolute;inset:0;background:rgba(0,0,0,.5);}
.ghost{position:absolute;left:1000px;top:100px;width:600px;height:400px;background:rgba(0,0,0,.5);pointer-events:none;}
.wide-scrim{position:absolute;left:0;top:600px;width:1920px;height:300px;background:rgba(0,0,0,.5);}
.rule{position:absolute;left:100px;top:100px;width:800px;height:40px;color:rgb(0,128,0);border-top:6px solid;}
.cap{position:absolute;left:510px;top:80px;width:900px;text-align:center;font-size:56px;text-transform:capitalize;}
.ok{position:absolute;left:100px;top:300px;font-size:40px;color:oklch(62.8% 0.2577 29.23);}
.tint tr{background:rgba(0,0,0,.05);}
.over{position:absolute;left:1200px;top:640px;font-size:40px;color:rgba(255,255,255,.5);}
.owner::after{content:'';position:absolute;left:100px;top:0;width:400px;height:200px;background:rgba(0,0,0,.5);}
.arrow::marker{content:"→ ";}
.nomark::marker{content:"";}
.hid td{background:#000;color:#fff;}
.hid td.lucent{color:rgba(255,255,255,.5);}
table.over tr{background:rgba(0,0,0,.5);}
table.over td{color:#fff;}
</style></head><body>
<section class="slide"><div class="frame"><img src="${solid('0,0,255')}"></div>
  <img class="abs" style="left:1000px;top:100px;width:600px;height:400px" src="${solid('0,0,255')}"><div class="ghost"></div>
  <h1 class="abs tight" style="left:100px;top:600px;width:640px;font-size:90px;line-height:.9;font-weight:400">tight heading wraps here</h1>
  <p class="abs loose" style="left:1000px;top:600px;width:520px;font-size:30px;line-height:1.25">a loose paragraph that wraps onto two lines of text</p>
  <div class="abs" style="left:1000px;top:790px;width:700px;height:10px;background:#c00"></div>
  <h1 class="abs crowd" style="left:1000px;top:805px;width:560px;font-size:70px;line-height:.9;font-weight:400">crowded heading wraps here</h1>
  <div class="abs" style="left:1000px;top:942px;width:700px;height:10px;background:#c00"></div></section>
<section class="slide"><img class="abs" style="left:100px;top:620px;width:500px;height:200px" src="${solid('0,0,255')}">
  <img class="abs" style="left:1200px;top:620px;width:500px;height:200px" src="${solid('0,0,255')}"><div class="wide-scrim"></div>
  <div class="rule"></div>
  <svg class="abs" style="left:1500px;top:100px;color:rgb(220,0,0)" width="100" height="100"><rect width="100" height="100" fill="currentColor"/></svg></section>
<section class="slide"><h2 class="cap">a heading with many words that is long enough to wrap</h2>
  <p class="ok">oklch words</p>
  <table class="abs tint" style="left:100px;top:400px;width:600px"><tbody><tr><td>tinted</td></tr></tbody></table>
  <ol class="abs" start="3" style="left:100px;top:550px;list-style-type:lower-alpha;padding-left:60px;font-size:30px"><li>third</li></ol>
  <ul class="abs" style="left:100px;top:650px;padding-left:60px;font-size:30px"><li>disc item</li></ul>
  <img class="abs" style="left:1100px;top:600px;width:600px;height:200px" src="${solid('0,0,255')}"><p class="over">see through</p></section>
<section class="slide"><div class="abs" style="left:100px;top:100px;width:400px;height:300px" data-kn-chart='{"type":"bar","rows":[],"columns":[],"data":[]}'></div>
  <video class="abs" preload="none" muted style="left:800px;top:100px;width:960px;height:540px" src="${VIDEO}"></video></section>
<section class="slide">
  <img class="abs" style="left:100px;top:100px;width:400px;height:300px;z-index:2" src="${solid('255,0,0')}">
  <img class="abs" style="left:300px;top:200px;width:400px;height:300px;z-index:1" src="${solid('0,0,255')}">
  <img class="abs" style="left:900px;top:100px;width:300px;height:200px" src="${solid('0,0,255')}">
  <div class="abs owner" style="left:800px;top:100px;width:50px;height:50px"></div>
  <h2 class="abs" style="left:600px;top:450px;width:700px;text-align:center;font-size:60px;font-weight:400">Big words <small style="font-size:30px">small</small> end</h2>
  <p class="abs" style="left:100px;top:700px;width:150px;text-align:center;text-transform:capitalize;overflow-wrap:anywhere;font-size:30px">supercalifragilistic</p>
  <ul class="abs" style="left:1300px;top:400px;width:500px;font-size:28px;padding-left:40px"><li class="arrow">arrow item</li><li class="nomark">blank marker</li></ul>
  <ul class="abs" style="left:1300px;top:600px;width:300px;font-size:24px;padding-left:40px"><li>a long list item that wraps onto more lines</li></ul>
  <p class="abs" style="left:400px;top:900px;font-size:30px">inter<span style="font-weight:700">national</span> trade</p></section>
<section class="slide">
  <table class="abs hid" style="left:100px;top:100px;width:600px;font-size:24px"><tbody>
    <tr><td>keep</td><td style="visibility:hidden">secret</td></tr><tr style="display:none"><td>gone</td><td>gone</td></tr><tr><td class="lucent">half</td><td>b</td></tr></tbody></table>
  <img class="abs" style="left:100px;top:400px;width:600px;height:200px" src="${solid('0,0,255')}">
  <table class="abs over" style="left:150px;top:450px;width:500px;font-size:24px"><tbody><tr><td>on image</td><td>x</td></tr><tr><td>y</td><td>z</td></tr></tbody></table>
  <p class="abs" style="left:900px;top:100px;font-size:40px;color:rgba(255,255,255,.5)">plain <span style="background:#000">dark</span></p>
  <div class="abs" style="left:900px;top:300px;width:500px;height:200px;background:#000;opacity:.5"><p style="color:#fff;font-size:40px">grouped</p></div>
  <video class="abs" muted style="left:900px;top:600px;width:320px;height:180px" src="data:video/webm;base64,AAAA"></video></section>
<section class="slide" style="zoom:.5">
  <img class="abs" style="left:900px;top:500px;width:600px;height:300px" src="${solid('0,0,255')}">
  <p class="abs" style="left:1000px;top:600px;font-size:40px;color:rgba(255,255,255,.5)">zoomed</p></section>
</body></html>`);
const edge = await extractDeck(EDGE, { outDir: path.join(tmp, 'edge') });

test('edge: a file name with # loads', () => {
  assert.equal(edge.slides.length, 7);
});

test('edge: ancestor ::after scrim and pointer-events:none overlay group with their image', async () => {
  const m = edge.slides[0].media;
  assert.equal(m.length, 2);
  assert.deepEqual(m.map((x) => x.kind), ['group', 'group']);
  const { px } = await pixels(edge.slides[0].plate.path, [[800, 600], [2600, 600]]);
  assert.ok(near(px[0], [255, 255, 255], 4), `::after scrim stripped from plate ${px[0]}`);
  assert.ok(near(px[1], [255, 255, 255], 4), `ghost stripped from plate ${px[1]}`);
  const g = await pixels(m[0].path, [[600, 400]]);
  assert.ok(near(g.px[0], [0, 0, 128], 6), `scrim drawn over the image in the group ${g.px[0]}`);
});

test('edge: tight line-height stays one box when it has room, splits when boxed in; near-default spacing stays one block', () => {
  const t = edge.slides[0].texts;
  // room below: one editable box, broken where the HTML wraps, with a drift allowance for --verify
  const tight = t.filter((x) => x.runs[0].size === 90);
  assert.equal(tight.length, 1);
  assert.equal(tight[0].source, 'block');
  const tt = tight[0].runs.map((r) => r.text).join('');
  assert.equal(tt.replace(/\u2028/g, ' '), 'tight heading wraps here');
  assert.ok(tt.includes('\u2028'));
  assert.ok(tight[0].drift && tight[0].drift.tol > 12, JSON.stringify(tight[0].drift));
  // red rules right above and below: no room, so one box per line
  const crowd = t.filter((x) => x.runs[0].size === 70);
  assert.ok(crowd.length >= 2, `crowded heading lines: ${crowd.length}`);
  assert.ok(crowd.every((x) => x.source === 'line'));
  assert.equal(crowd.map((x) => x.runs[0].text).join(' '), 'crowded heading wraps here');
  const loose = t.filter((x) => x.runs[0].size === 30);
  assert.equal(loose.length, 1);
  assert.equal(loose[0].source, 'block');
  // one editable item, broken where the HTML wraps it
  const lt = loose[0].runs.map((r) => r.text).join('');
  assert.equal(lt.split('\u2028').length, 2, JSON.stringify(lt));
  assert.equal(lt.replace('\u2028', ' '), 'a loose paragraph that wraps onto two lines of text');
});

test('edge: one scrim over two images is one group, drawn once', async () => {
  const s = edge.slides[1];
  const groups = s.media.filter((x) => x.kind === 'group');
  assert.equal(groups.length, 1);
  const g = groups[0];
  assert.deepEqual([g.x, g.y, g.w, g.h].map(Math.round), [0, 600, 1920, 300]);
  // group png covers x 0..1920, y 600..900 at 2x: left image, right image, scrim-only gap
  const { px } = await pixels(g.path, [[2 * 350, 2 * 100], [2 * 1450, 2 * 100], [2 * 900, 2 * 100]]);
  assert.ok(near(px[0], [0, 0, 128], 6), `left image under one 50% scrim ${px[0]}`);
  assert.ok(near(px[1], [0, 0, 128], 6), `right image under one 50% scrim ${px[1]}`);
  assert.ok(near(px[2], [0, 0, 0, 128], 8), `scrim alone, half transparent ${px[2]}`);
});

test('edge: currentColor border stays on the plate; currentColor svg fill stays in its image', async () => {
  const s = edge.slides[1];
  const { px } = await pixels(s.plate.path, [[2 * 500, 2 * 102]]);
  assert.ok(near(px[0], [0, 128, 0], 6), `rule ${px[0]}`);
  const icon = s.media.find((x) => x.kind === 'svg');
  const ip = await pixels(icon.path, [[100, 100]]);
  assert.ok(near(ip.px[0], [220, 0, 0, 255], 6), `icon ${ip.px[0]}`);
});

test('edge: capitalize on split lines, oklch colour, tinted table, real list markers, see-through text', () => {
  const s = edge.slides[2];
  const lines = s.texts.filter((t) => t.source === 'line').map((t) => t.runs.map((r) => r.text).join(''));
  assert.ok(lines.length >= 2);
  assert.equal(lines.join(' '), 'A Heading With Many Words That Is Long Enough To Wrap');
  const ok = s.texts.find((t) => t.runs[0].text === 'oklch words').runs[0].color;
  assert.ok(ok[0] > 200 && ok[1] < 80 && ok[2] < 80, `oklch ${ok}`);
  assert.ok(near(s.tables[0].styles[0][0].bg, [242, 242, 242], 1), `tint ${s.tables[0].styles[0][0].bg}`);
  const lis = s.texts.filter((t) => t.source === 'li');
  assert.deepEqual(lis.map((t) => t.runs.map((r) => r.text).join('')), ['third', 'disc item']);
  const marks = s.texts.filter((t) => t.source === 'marker');
  assert.deepEqual(marks.map((t) => t.runs[0].text), ['c.', '•']);
  marks.forEach((m, i) => assert.ok(m.x < lis[i].x - 5 && lis[i].x - m.x < 80, `marker ${i + 1} left of its text: ${m.x} vs ${lis[i].x}`));
  const over = s.texts.find((t) => t.runs[0].text === 'see through').runs[0].color;
  assert.ok(near(over, [128, 128, 255], 3), `composited over the image ${over}`);
});

test('edge: an empty chart spec is refused with a warning; a preload=none video still freezes at frame 0', async () => {
  const s = edge.slides[3];
  assert.equal(s.charts.length, 0);
  assert.ok(edge.warnings.some((w) => /slide 4: data-kn-chart is not valid/.test(w)), edge.warnings.join('|'));
  const v = s.media.find((x) => x.kind === 'video');
  const { px } = await pixels(v.path, [[400, 300]]);
  assert.ok(near(px[0], [200, 50, 50, 255], 14), `frame 0 ${px[0]}`);
});

test('edge: overlapping images follow paint order (z-index), not DOM order', async () => {
  const imgs = edge.slides[4].media.filter((m) => m.kind === 'img' && m.x < 800);
  assert.equal(imgs.length, 2);
  const colours = await Promise.all(imgs.map(async (m) => (await pixels(m.path, [[20, 20]])).px[0]));
  // Keynote stacks in insertion order: the blue (z-index 1) must come first
  assert.ok(near(colours[0], [0, 0, 255, 255], 6), `first ${colours[0]}`);
  assert.ok(near(colours[1], [255, 0, 0, 255], 6), `second ${colours[1]}`);
});

test('edge: a ::after scrim outside its owner box still groups with the image it covers', async () => {
  const s = edge.slides[4];
  const g = s.media.find((m) => m.kind === 'group');
  assert.ok(g, 'group present');
  // image 900..1200, scrim (owner 800 + left 100, 400 wide) 900..1300
  assert.deepEqual([g.x, g.y, g.w, g.h].map(Math.round), [900, 100, 400, 200]);
  const { px } = await pixels(s.plate.path, [[2 * 1000, 2 * 150]]);
  assert.ok(near(px[0], [255, 255, 255], 4), `scrim stripped from plate ${px[0]}`);
  const gp = await pixels(g.path, [[100, 100]]);
  assert.ok(near(gp.px[0], [0, 0, 128, 255], 6), `scrim drawn over the image ${gp.px[0]}`);
});

test('edge: mixed font sizes on one centred line stay one item; mid-word wraps keep one capital', () => {
  const t = edge.slides[4].texts;
  const big = t.filter((x) => x.runs.some((r) => /Big words/.test(r.text)));
  assert.equal(big.length, 1);
  assert.equal(big[0].runs.map((r) => r.text).join(''), 'Big words small end');
  const sup = t.filter((x) => x.runs[0].size === 30 && x.source === 'line').map((x) => x.runs.map((r) => r.text).join(''));
  assert.ok(sup.length >= 2, `wrapped lines ${sup.length}`);
  assert.equal(sup.join(''), 'Supercalifragilistic');
});

test('edge: ::marker content is used, an empty one gives no marker, wrapped items keep their indent', () => {
  const t = edge.slides[4].texts;
  const marks = t.filter((x) => x.source === 'marker').map((x) => x.runs[0].text);
  assert.deepEqual(marks, ['→', '•']);
  const blank = t.find((x) => x.source === 'li' && x.runs[0].text.includes('blank marker'));
  assert.equal(blank.runs.map((r) => r.text).join(''), 'blank marker');
  const long = t.find((x) => x.source === 'li' && x.runs[0].text.startsWith('a long list item'));
  assert.ok(Math.abs(long.x - 1340) <= 3, `wrapped item keeps the content edge: ${long.x}`);
});

test('edge: a word split across inline elements is one verify word', async () => {
  const words = await withDeck(EDGE, {}, (page) => slideWords(page, 4));
  assert.ok(words.some((w) => w.text === 'international'), words.map((w) => w.text).join(' '));
  assert.ok(!words.some((w) => w.text === 'inter' || w.text === 'national'));
});

test('edge: hidden table rows and cells, translucent cell text, tint over an image', () => {
  const [hid, over] = edge.slides[5].tables;
  assert.deepEqual(hid.rows, [['keep', ''], ['half', 'b']]);
  assert.ok(near(hid.styles[1][0].color, [128, 128, 128], 3), `half-white text on black ${hid.styles[1][0].color}`);
  assert.ok(near(over.styles[0][0].bg, [0, 0, 128], 4), `50% black over blue ${over.styles[0][0].bg}`);
});

test('edge: translucent runs sample their own backdrop; group opacity composites as a group', () => {
  const t = edge.slides[5].texts;
  const runs = t.flatMap((x) => x.runs);
  const plain = runs.find((r) => r.text.trim() === 'plain');
  const dark = runs.find((r) => r.text === 'dark');
  assert.ok(plain && dark, runs.map((r) => r.text).join('|'));
  assert.ok(near(plain.color, [255, 255, 255], 3), `plain over white ${plain.color}`);
  assert.ok(near(dark.color, [128, 128, 128], 3), `dark over black ${dark.color}`);
  const grouped = runs.find((r) => r.text === 'grouped');
  assert.ok(near(grouped.color, [255, 255, 255], 4), `white text in a 50% black group over white ${grouped.color}`);
});

test('edge: a video that never loads is reported', () => {
  assert.ok(edge.warnings.some((w) => /^slide 6: a video did not load/.test(w)), edge.warnings.join('|'));
});

test('edge: colour sampling follows slide zoom', () => {
  const r = edge.slides[6].texts.flatMap((x) => x.runs).find((x) => x.text === 'zoomed');
  assert.ok(near(r.color, [128, 128, 255], 4), `zoomed ${r.color}`);
});
