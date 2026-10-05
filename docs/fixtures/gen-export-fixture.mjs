#!/usr/bin/env node
// Generates docs/fixtures/sample-export.html and sample-export.expected.json:
// the test deck for scripts/keynote-export.mjs (HTML deck → native Keynote).
//
// Media are REAL bytes: ImageMagick (`magick`) makes the image, ffmpeg makes a
// 2-second VP9 WebM (Playwright's Chromium has no H.264). Both are embedded as
// base64 by this script, never hand-typed. The expected-text JSON is written
// from this script's own strings, never from the extractor, so an extraction
// bug can't hide behind a matching readback.
//
// Slides (1920×1080, deck convention: .slide-wrap > section.slide + footer):
//   1  left heading in a font family that is not installed (fallback test);
//      3-item list with padded <li>, separator rules and an absolutely
//      placed red em-dash li::before marker (as packs/neutral draws lists),
//      list-style none; a paragraph on a
//      solid black panel with red, bold and 55%-white runs; a display:none
//      block that must not export; speaker note.
//   2  full-bleed poster-less <video> (frame 0 = rgb(200,50,50), then
//      rgb(50,200,50)) under a bottom-half scrim and a caption plate whose
//      text is white; no notes.
//   3  centred heading that wraps to two lines; <table> with <thead>; <img>.
//   4  data-kn-chart element (inline SVG drawing of the same bars);
//      AppleScript-hostile paragraph (quotes, backslash, accent, bullet,
//      emoji) ending in a bold run; note with quotes and a backslash.
//
// Usage: node docs/fixtures/gen-export-fixture.mjs

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outHtml = path.join(here, 'sample-export.html');
const outJson = path.join(here, 'sample-export.expected.json');
const fontPath = path.join(here, 'fonts', 'inter-latin-400.woff2');

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const tmp = mkdtempSync(path.join(tmpdir(), 'kx-fixture-'));
const f = (n) => path.join(tmp, n);

sh('magick', ['-size', '600x400', 'gradient:#1e3a5f-#f5b400', '-strip', f('grad.png')]);
sh('ffmpeg', ['-hide_banner', '-loglevel', 'error',
  '-f', 'lavfi', '-i', 'color=c=0xC83232:s=1920x1080:d=1:r=10',
  '-f', 'lavfi', '-i', 'color=c=0x32C832:s=1920x1080:d=1:r=10',
  '-filter_complex', '[0:v][1:v]concat=n=2:v=1[v]', '-map', '[v]',
  '-c:v', 'libvpx-vp9', '-b:v', '200k', '-pix_fmt', 'yuv420p', '-y', f('clip.webm')]);

const b64 = (p) => readFileSync(p).toString('base64');
const gradUri = `data:image/png;base64,${b64(f('grad.png'))}`;
const videoUri = `data:video/webm;base64,${b64(f('clip.webm'))}`;
const fontB64 = b64(fontPath);
rmSync(tmp, { recursive: true, force: true });

// ── content (single source for HTML and expected JSON) ──────────────────────
const esc = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const BRAND = 'Export Fixture';
const MARKER = '\u2014'; // li::before content, red, absolutely placed
const S1 = {
  heading: 'Lists keep their rules',
  items: ['First point stays put', 'Second point keeps its rule', 'Third point ends the list'],
  para: ['Plain words, ', 'red words', ', ', 'bold words', ' and ', 'faded words', '.'],
  note: 'Speaker note for slide one.',
};
const S2 = { caption: 'Caption over moving image' };
const S3 = {
  heading: 'A centred heading that is long enough to wrap onto two lines',
  table: [['Region', 'Share', 'Change'], ['North', '41%', '+3'], ['South', '35%', '-2'], ['West', '24%', '-1']],
};
const S4 = {
  chart: { type: 'bar', rows: ['2021', '2026'], columns: ['Democrats', 'Republicans'], data: [[31, 45], [56, 49]] },
  hostile: 'He said "go" \\ now, café • 🙂 ',
  bold: 'bold',
  note: 'Note with "quotes" and a backslash \\ here.',
};

const footer = (n) => `<div class="footer"><span class="brand">${BRAND}</span><span class="pageno">${String(n).padStart(2, '0')}</span></div>`;

const chartSvg = (() => {
  const { rows, data } = S4.chart;
  const bars = [];
  rows.forEach((r, i) => data[i].forEach((v, j) => {
    const x = 60 + i * 300 + j * 110;
    bars.push(`<rect x="${x}" y="${400 - v * 5}" width="90" height="${v * 5}" fill="${j ? '#777777' : '#f5b400'}"/>`);
  }));
  return `<svg width="720" height="440" viewBox="0 0 720 440" xmlns="http://www.w3.org/2000/svg">${bars.join('')}</svg>`;
})();

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Keynote Export Fixture</title>
<style>
@font-face{font-family:'Fixture Sans';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${fontB64}) format('woff2');}
*{box-sizing:border-box;margin:0;padding:0;}
html,body{background:#2a2a2a;font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;}
.slide-wrap{width:1920px;height:1080px;margin:28px auto;position:relative;}
.slide{width:1920px;height:1080px;overflow:hidden;position:relative;background:#ffffff;color:#16181b;}
.footer{position:absolute;bottom:0;left:0;right:0;height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 80px;border-top:1px solid #dcdfe3;font-size:16px;z-index:10;background:#fafbfc;}
.speaker-note{display:none;}
h2{font-size:64px;font-weight:400;line-height:1.1;}
.s1 h2{position:absolute;left:80px;top:90px;font-family:'Fixture Sans';}
.list{position:absolute;left:80px;top:220px;width:820px;list-style:none;}
.list li{position:relative;font-size:28px;line-height:1.4;padding:18px 0 18px 40px;border-bottom:1px solid #b9bec4;}
.list li::before{content:'\\2014';position:absolute;left:0;top:24px;font-size:20px;color:rgb(210,34,34);}
.panel{position:absolute;left:1000px;top:220px;width:820px;height:420px;background:rgb(0,0,0);color:#ffffff;padding:48px;}
.panel p{font-size:36px;line-height:1.4;}
.red{color:rgb(210,34,34);} .faded{color:rgba(255,255,255,0.55);}
.s2 video{position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover;}
.scrim{position:absolute;left:0;right:0;bottom:0;height:540px;background:rgba(0,0,0,0.6);}
.plate{position:absolute;left:80px;bottom:120px;width:900px;padding:32px 40px;background:rgb(30,58,95);color:#ffffff;font-size:48px;line-height:1.2;}
.s3 h2{position:absolute;left:510px;top:80px;width:900px;text-align:center;font-size:56px;}
.s3 table{position:absolute;left:80px;top:330px;width:900px;border-collapse:collapse;font-size:28px;}
.s3 th,.s3 td{padding:14px 20px;text-align:left;border-bottom:1px solid #dcdfe3;}
.s3 thead th{background:rgb(236,238,240);font-weight:700;}
.s3 img{position:absolute;left:1180px;top:330px;width:600px;height:400px;}
.chart{position:absolute;left:80px;top:120px;width:720px;height:440px;}
.hostile{position:absolute;left:900px;top:160px;width:900px;font-size:40px;line-height:1.3;}
</style>
</head>
<body>

<div class="slide-wrap"><section class="slide s1" aria-label="Slide 1">
  <h2>${esc(S1.heading)}</h2>
  <ul class="list">${S1.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
  <div class="panel"><p>${esc(S1.para[0])}<span class="red">${esc(S1.para[1])}</span>${esc(S1.para[2])}<strong>${esc(S1.para[3])}</strong>${esc(S1.para[4])}<span class="faded">${esc(S1.para[5])}</span>${esc(S1.para[6])}</p></div>
  <div style="display:none">Hidden text must not export</div>
  <div class="speaker-note">${esc(S1.note)}</div>
  ${footer(1)}
</section></div>

<div class="slide-wrap"><section class="slide s2" aria-label="Slide 2">
  <video autoplay muted loop playsinline src="${videoUri}"></video>
  <div class="scrim"></div>
  <div class="plate">${esc(S2.caption)}</div>
  ${footer(2)}
</section></div>

<div class="slide-wrap"><section class="slide s3" aria-label="Slide 3">
  <h2>${esc(S3.heading)}</h2>
  <table><thead><tr>${S3.table[0].map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead>
  <tbody>${S3.table.slice(1).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <img src="${gradUri}" alt="Navy to gold gradient">
  ${footer(3)}
</section></div>

<div class="slide-wrap"><section class="slide s4" aria-label="Slide 4">
  <div class="chart" data-kn-chart='${JSON.stringify(S4.chart)}'>${chartSvg}</div>
  <p class="hostile">${esc(S4.hostile)}<strong>${esc(S4.bold)}</strong></p>
  <div class="speaker-note">${esc(S4.note)}</div>
  ${footer(4)}
</section></div>

</body>
</html>
`;

const expected = {
  slides: [
    { texts: [S1.heading, ...S1.items.flatMap((t) => [MARKER, t]), S1.para.join(''), BRAND, '01'], notes: S1.note, tables: [], charts: [] },
    { texts: [S2.caption, BRAND, '02'], notes: '', tables: [], charts: [] },
    { texts: [S3.heading, BRAND, '03'], notes: '', tables: [S3.table], charts: [] },
    { texts: [S4.hostile + S4.bold, BRAND, '04'], notes: S4.note, tables: [], charts: [S4.chart] },
  ],
  hiddenText: 'Hidden text must not export',
  videoFrame0: [200, 50, 50],
  fadedRun: { text: 'faded words', alpha: 0.55, expectedRgb: [140, 140, 140] },
  marker: { text: MARKER, color: [210, 34, 34], size: 20, x: 80 },
};

writeFileSync(outHtml, html);
writeFileSync(outJson, JSON.stringify(expected, null, 2) + '\n');
console.log(`wrote ${path.relative(process.cwd(), outHtml)} (${html.length} bytes) and ${path.relative(process.cwd(), outJson)}`);
