#!/usr/bin/env node
// keynote-check: layout guard for rendered decks. Usage: node keynote-check.mjs <deck.html> [slide numbers...] [--out dir]
// Screenshots the slides and reports any visual element that leaves the 1920x1080 frame, crosses the footer band,
// or overlaps another text/image block. Deterministic half; a Sonnet look at the screenshots is the other half.
import { getPlaywright } from './lib/playwright.mjs';
import { readdirSync, mkdirSync, existsSync } from 'node:fs'; import { homedir } from 'node:os'; import path from 'node:path';
const args = process.argv.slice(2); const html = path.resolve(args.shift());
const outIdx = args.indexOf('--out'); const out = outIdx >= 0 ? args.splice(outIdx, 2)[1] : path.join(path.dirname(html), '.check');
const want = args.map(Number).filter(Boolean); mkdirSync(out, { recursive: true });
const { chromium } = getPlaywright();
// Opportunistic: prefer the installed headless-shell build if present (faster
// than full Chrome); otherwise plain launch() with playwright's default
// browser resolution. Both paths are machine-agnostic.
let launchOpts = {};
try {
  const C = `${homedir()}/Library/Caches/ms-playwright`;
  const D = readdirSync(C).filter(d => d.startsWith('chromium_headless_shell-')).sort().pop();
  if (D) {
    const sub = readdirSync(`${C}/${D}`).find(d => d.startsWith('chrome-headless-shell'));
    const bin = sub && existsSync(`${C}/${D}/${sub}/${sub}`) ? `${C}/${D}/${sub}/${sub}` : null;
    if (bin) launchOpts = { executablePath: bin };
  }
} catch {}
const b = await chromium.launch(launchOpts);
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } }); await p.goto('file://' + html); await p.waitForTimeout(1200);
const n = await p.locator('.slide-wrap').count(); let bad = 0;
for (let i = 0; i < n; i++) {
  const no = i + 1; if (want.length && !want.includes(no)) continue;
  const wrap = p.locator('.slide-wrap').nth(i);
  const issues = await wrap.evaluate((w) => {
    const s = w.querySelector('.slide'); const S = s.getBoundingClientRect(); const out = [];
    const foot = s.querySelector('.footer, .kn-sub'); const footTop = foot ? foot.getBoundingClientRect().top - 12 : S.bottom;
    const sel = 'img, video, figure, h1, h2, h3, p, li, .kn-caption, .kn-subcap, .lede, .year, .label, .card, .stat';
    const els = [...s.querySelectorAll(sel)].filter(e => !e.closest('.footer, .kn-sub, .kn-pageno, .speaker-note') && !e.classList.contains('kn-bg') && e.getClientRects().length);
    const boxes = els.map(e => ({ e, r: e.getBoundingClientRect(), name: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') }));
    for (const { r, name } of boxes) {
      if (r.width === 0 || r.height === 0) continue;
      if (r.left < S.left - 1 || r.right > S.right + 1 || r.top < S.top - 1 || r.bottom > S.bottom + 1) out.push(`${name} leaves the frame`);
      else if (r.bottom > footTop && !s.classList.contains('kn')) out.push(`${name} crosses the footer band (bottom ${Math.round(r.bottom - S.top)} > ${Math.round(footTop - S.top)})`);
    }
    const leaf = boxes.filter(({ e }) => !boxes.some(o => o.e !== e && e.contains(o.e)));
    for (let a = 0; a < leaf.length; a++) for (let c = a + 1; c < leaf.length; c++) {
      const A = leaf[a], B = leaf[c]; if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
      const ov = Math.min(A.r.right, B.r.right) - Math.max(A.r.left, B.r.left), oh = Math.min(A.r.bottom, B.r.bottom) - Math.max(A.r.top, B.r.top);
      const isImg = x => /^(img|figure|video)/.test(x.name); const isTxt = x => !isImg(x);
      if (ov > 8 && oh > 8 && isTxt(A) && isTxt(B)) out.push(`${A.name} overlaps ${B.name}`);
    }
    return [...new Set(out)];
  });
  const file = path.join(out, `slide-${String(no).padStart(2, '0')}.png`); await wrap.screenshot({ path: file });
  if (issues.length) { bad++; console.log(`slide ${no}: ${issues.join('; ')}`); } else console.log(`slide ${no}: ok`);
}
await b.close(); console.log(`${bad} slide(s) with issues; screenshots in ${out}`); process.exit(bad ? 1 : 0);
