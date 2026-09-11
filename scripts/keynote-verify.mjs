#!/usr/bin/env node
// keynote-verify.mjs — the publish-stage assertion suite (plan Task 5).
//
// Works on a deck HTML file (via file://) or a live URL. Runs the checks in
// the plan's fixed order and prints one PASS/FAIL/SKIPPED line per check;
// exit 0 when everything passed, 1 on any FAIL (SKIPPED never fails).
//
//   geometry   slide-RELATIVE coordinates only (element bounds minus the
//              slide's own top-left — never page-absolute, which produced a
//              false PASS in the field):
//                - per-slide overflow (scrollHeight/Width <= client + 1)
//                - content blocks (text ink + images) vs chrome bands
//                  (.footer / .header-bar / .deck-sub)
//                - pairwise overlap of text ink vs text ink and text ink vs
//                  images (the "identity column vs map", "cards vs footer"
//                  class of field bugs)
//                - sequential pagenos (NN === slide index, +1 apart)
//              Text overlaps are measured with INK bounds (canvas
//              TextMetrics actualBoundingBox), not font-metric line boxes —
//              tight leading (line-height < font box) otherwise flags every
//              stacked cover title. SVG-internal text is excluded (hand-
//              positioned diagram labels) — the <svg> root participates as
//              one media block. A figcaption overlapping its own figure's
//              image is a legitimate design pattern and is allowed.
//   images     every <img> complete with naturalWidth > 0; lazy imgs load
//              after a scroll-to-bottom; every CSS background url() renders.
//   hint       the injected reading-mode hint: appears <= 3s after load,
//              gone by 7.5s (6s timeout + fade), dismisses on a keypress,
//              never appears in a hasTouch context or on a #present load.
//   present    only when the deck HAS a show-mode handler (detected by
//              dispatching a synthetic `p` / loading #present and watching
//              body.show). Decks without one — like the Task-2 fixture —
//              get SKIPPED lines, never FAILs. Every hash test starts from
//              a FRESH page (hash-only navigation is same-document).
//   mobile     --mobile: hasTouch:true WITHOUT isMobile (isMobile emulation
//              inflates window.innerWidth via layout-viewport expansion
//              and poisons geometry). Present controls visible, tap enters
//              show mode, tap on .slide-wrap.current advances, CDP-input
//              swipe next/back, exit button leaves, rotate toast on
//              portrait entry. Mobile checks are RELATIVE to the observed
//              entry slide — enter() picks nearestIdx(), which on narrow
//              viewports is not slide 1.
//   throttle   --throttle: CDP Network.emulateNetworkConditions at
//              1.6 Mbps / 150 ms — first contentful paint < 2.5s (a local
//              check; live-network FCP depends on the site, not the deck).
//   js         page errors and console errors collected across every page
//              opened by the suite are failures.
//
// Usage: node scripts/keynote-verify.mjs <deck.html | URL> [--mobile] [--throttle]
// Exit: 0 all-pass, 1 any FAIL, 2 usage error.

import path from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { getPlaywright } from './lib/playwright.mjs';

// ── args ─────────────────────────────────────────────────────────────────────
let target = null;
let mobile = false;
let throttle = false;
{
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--mobile') mobile = true;
    else if (args[i] === '--throttle') throttle = true;
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node scripts/keynote-verify.mjs <deck.html | URL> [--mobile] [--throttle]');
      process.exit(0);
    } else if (!target) target = args[i];
    else { console.error(`keynote-verify: unknown arg: ${args[i]}`); process.exit(2); }
  }
}
if (!target) {
  console.error('keynote-verify: a deck HTML path or URL is required');
  process.exit(2);
}
const isUrl = /^[a-z][a-z0-9+.-]*:\/\//i.test(target);
const url = isUrl ? target : (() => {
  const p = path.resolve(target);
  if (!existsSync(p)) {
    console.error(`keynote-verify: no such file: ${p}`);
    process.exit(2);
  }
  return pathToFileURL(p).href;
})();

// ── result recorder ──────────────────────────────────────────────────────────
let passed = 0, failed = 0, skipped = 0;
function rec(name, status, detail = '') {
  if (status === 'PASS') passed++;
  else if (status === 'FAIL') failed++;
  else skipped++;
  console.log(`${status.padEnd(7)} ${name}${detail ? ` — ${detail}` : ''}`);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── in-page evaluation payloads ───────────────────────────────────────────────
// geometry: everything slide-relative; text as ink rects (see header note)
const GEOMETRY_EVAL = `(() => {
  const CHROME_SEL = '.footer,.header-bar,.deck-sub,.deck-hint,.present-btn,.present-exit,.rotate-hint,.show-help';
  const ctx = document.createElement('canvas').getContext('2d');
  const out = { slides: 0, overflow: [], chromeOverlaps: [], blockOverlaps: [], pagenos: [], textBlocks: 0, mediaBlocks: 0, metricFallbacks: 0 };
  const slides = [...document.querySelectorAll('.slide')];
  out.slides = slides.length;
  const vis = el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const inChrome = el => !!el.closest(CHROME_SEL);
  const inSvg = el => !!(el.closest && el.closest('svg'));
  const ix = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const iy = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  const ovl = (a, b) => ix(a, b) > 1 && iy(a, b) > 1;
  function inkRects(el) {
    const rr = [];
    for (const tn of el.childNodes) {
      if (tn.nodeType !== 3 || !tn.textContent.trim()) continue;
      let fba = null, ab = null;
      try {
        ctx.font = getComputedStyle(el).font;
        const m = ctx.measureText(tn.textContent);
        if (Number.isFinite(m.fontBoundingBoxAscent) && Number.isFinite(m.actualBoundingBoxAscent)) {
          fba = m.fontBoundingBoxAscent; ab = [m.actualBoundingBoxAscent, m.actualBoundingBoxDescent];
        }
      } catch (e) {}
      const rg = document.createRange(); rg.selectNodeContents(tn);
      for (const r of rg.getClientRects()) {
        if (r.width <= 0 || r.height <= 0) continue;
        if (fba === null) { rr.push({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }); out.metricFallbacks++; continue; }
        const baseline = r.top + fba;
        rr.push({
          left: r.left, right: r.right,
          top: Math.max(r.top, baseline - ab[0]),
          bottom: Math.min(r.bottom, baseline + ab[1]),
        });
      }
    }
    return rr;
  }
  const describe = el => {
    const cls = (typeof el.className === 'string' && el.className.trim()) ? '.' + el.className.trim().split(/\\s+/).join('.') : '';
    return el.tagName.toLowerCase() + cls;
  };
  slides.forEach((s, i) => {
    if (s.scrollHeight > s.clientHeight + 1 || s.scrollWidth > s.clientWidth + 1)
      out.overflow.push({ slide: i + 1 });
    const sr = s.getBoundingClientRect();
    const rel = r => ({ left: r.left - sr.left, top: r.top - sr.top, right: r.right - sr.left, bottom: r.bottom - sr.top });
    const chromeRects = [...s.querySelectorAll('.footer,.header-bar,.deck-sub')].filter(vis)
      .map(el => ({ el, r: rel(el.getBoundingClientRect()) }));
    const textFrags = [], media = [];
    const walk = document.createTreeWalker(s, NodeFilter.SHOW_ELEMENT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const el = n;
      if (inChrome(el) || !vis(el)) continue;
      const tag = el.tagName.toUpperCase();
      if (tag === 'IMG' || tag === 'SVG' || tag === 'VIDEO') {
        if (!inSvg(el)) media.push({ el, slide: i + 1, rect: rel(el.getBoundingClientRect()) });
        continue;
      }
      if (inSvg(el)) continue; // hand-positioned diagram labels
      const rr = inkRects(el).map(rel);
      if (rr.length) textFrags.push({ el, slide: i + 1, rects: rr });
    }
    out.textBlocks += textFrags.length; out.mediaBlocks += media.length;
    for (const c of chromeRects) {
      for (const t of textFrags)
        for (const r of t.rects)
          if (ovl(r, c.r)) { out.chromeOverlaps.push({ slide: i + 1, content: describe(t.el), chrome: describe(c.el) }); break; }
      for (const m of media)
        if (ovl(m.rect, c.r)) out.chromeOverlaps.push({ slide: i + 1, content: describe(m.el), chrome: describe(c.el) });
    }
    for (let a = 0; a < textFrags.length; a++)
      for (let b = a + 1; b < textFrags.length; b++) {
        const A = textFrags[a], B = textFrags[b];
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        if (A.rects.some(ra => B.rects.some(rb => ovl(ra, rb))))
          out.blockOverlaps.push({ slide: A.slide, a: describe(A.el), b: describe(B.el) });
      }
    for (const t of textFrags)
      for (const m of media) {
        if (t.el.contains(m.el) || m.el.contains(t.el)) continue;
        if (t.el.closest('figure') && t.el.closest('figure') === m.el.closest('figure')) continue;
        if (t.rects.some(ra => ovl(ra, m.rect)))
          out.blockOverlaps.push({ slide: t.slide, a: describe(t.el), b: describe(m.el) });
      }
  });
  slides.forEach((s, i) => {
    const el = s.querySelector('.footer .pageno');
    out.pagenos.push(el ? el.textContent.trim() : null);
  });
  return out;
})()`;

// definitive failure = the browser finished trying and has nothing to show.
// A not-yet-complete image is NOT a failure here — that is lazy deferral,
// which images/lazy-after-scroll exercises after scrolling through.
const IMAGES_EVAL = `(() => {
  const imgs = [...document.querySelectorAll('img')];
  return {
    count: imgs.length,
    bad: imgs.filter(i => i.complete && i.naturalWidth === 0).length,
    deferred: imgs.filter(i => !i.complete).length,
  };
})()`;

// scroll through the deck like a reader (half-viewport steps — a single
// jump-to-bottom SKIPS the middle: lazy loading is intersection-triggered),
// then report the final state of every <img>
const SCROLL_THROUGH_EVAL = `(() => new Promise(resolve => {
  (async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += Math.max(200, innerHeight / 2)) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 120));
    }
    window.scrollTo(0, h);
    await new Promise(r => setTimeout(r, 300));
    const imgs = [...document.querySelectorAll('img')];
    resolve({ count: imgs.length, bad: imgs.filter(i => !i.complete || i.naturalWidth === 0).length });
  })();
}))()`;

const BACKGROUNDS_EVAL = `(() => new Promise(resolve => {
  const urls = new Set();
  for (const el of document.querySelectorAll('*')) {
    const bg = getComputedStyle(el).backgroundImage;
    if (!bg || bg === 'none') continue;
    for (const m of bg.matchAll(/url\\((['"]?)([^'")]+)\\1\\)/g)) urls.add(m[2]);
  }
  const list = [...urls];
  if (!list.length) return resolve({ count: 0, bad: [] });
  const bad = [];
  let left = list.length;
  const done = () => { if (--left === 0) resolve({ count: list.length, bad }); };
  for (const u of list) {
    const im = new Image();
    const t = setTimeout(() => { bad.push(u); im.src = ''; done(); }, 8000);
    im.onload = im.onerror = () => {
      clearTimeout(t);
      if (!im.naturalWidth) bad.push(u);
      done();
    };
    im.src = u;
  }
}))()`;

const HINT_VISIBLE = `(() => {
  const h = document.querySelector('.deck-hint');
  if (!h) return false;
  const cs = getComputedStyle(h);
  return cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.05;
})()`;

const KEY = k => `dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(k)} }))`;

const CURRENT_IDX = `[...document.querySelectorAll('.slide-wrap')].findIndex(w => w.classList.contains('current'))`;

// ── the suite ────────────────────────────────────────────────────────────────
const { chromium } = getPlaywright();
const browser = await chromium.launch();
const jsErrors = []; // {page, text} — page errors + console errors, everywhere
// One console message is deliberately NOT an error: Chromium's touch
// intervention notice "Ignored attempt to cancel a touchend event with
// cancelable=false" — fired when our CDP-injected swipe hits the site's
// passive touchmove listeners and its touchend preventDefault() is a no-op.
// It is browser output about synthetic input, not a page defect (the swipe
// still advances exactly one slide; the browser suppresses the trailing
// click for scroll-classified gestures itself).
const BENIGN_CONSOLE = [/^Ignored attempt to cancel a touch(?:end|move) event with cancelable=false/];

function watch(page, label) {
  page.on('pageerror', e => jsErrors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error' && !BENIGN_CONSOLE.some(re => re.test(m.text())))
      jsErrors.push(`[${label}] console: ${m.text()}`);
  });
  return page;
}

async function freshPage(ctx, label, hash = '') {
  const page = await ctx.newPage();
  watch(page, label);
  await page.goto(hash ? url + hash : url, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(300);
  return page;
}

async function poll(page, expr, { timeout = 3000, interval = 150 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(expr)) return true;
    if (Date.now() >= deadline) return false;
    await sleep(interval);
  }
}

try {
  // ── desktop context ───────────────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });

  // geometry + pagenos (main page)
  {
    const page = await freshPage(ctx, 'geometry');
    const g = await page.evaluate(GEOMETRY_EVAL);

    rec('geometry/overflow', g.overflow.length ? 'FAIL' : 'PASS',
      g.overflow.length
        ? `slides overflow their frame: ${g.overflow.map(o => o.slide).join(', ')}`
        : `${g.slides} slides, none overflow (scroll <= client + 1)`);

    rec('geometry/chrome-clearance', g.chromeOverlaps.length ? 'FAIL' : 'PASS',
      g.chromeOverlaps.length
        ? g.chromeOverlaps.slice(0, 5).map(o => `slide ${o.slide}: ${o.content} overlaps ${o.chrome}`).join('; ')
        : `${g.textBlocks + g.mediaBlocks} content blocks clear of footer/header-bar/deck-sub bands`);

    rec('geometry/block-overlap', g.blockOverlaps.length ? 'FAIL' : 'PASS',
      g.blockOverlaps.length
        ? g.blockOverlaps.slice(0, 5).map(o => `slide ${o.slide}: ${o.a} over ${o.b}`).join('; ')
        : `${g.textBlocks} text (ink) + ${g.mediaBlocks} media blocks, no overlaps`);

    // pagenos: sequential, and each equals its slide index (deck convention)
    const pn = g.pagenos.map((t, i) => (t === null ? null : { slide: i + 1, num: parseInt(t, 10) }));
    const numbered = pn.filter(Boolean);
    const badPn = [];
    for (let i = 0; i < numbered.length; i++) {
      if (numbered[i].num !== numbered[i].slide) badPn.push(`slide ${numbered[i].slide} shows ${String(numbered[i].num).padStart(2, '0')}`);
      if (i && numbered[i].num !== numbered[i - 1].num + 1) badPn.push(`${numbered[i - 1].num} then ${numbered[i].num}`);
    }
    rec('geometry/pagenos', badPn.length ? 'FAIL' : 'PASS',
      badPn.length ? badPn.join('; ') : `pagenos ${g.pagenos.filter(Boolean).join(',')} match slide indexes`);
    var slideCount = g.slides; // eslint-disable-line no-var
  }

  // images
  {
    const page = await freshPage(ctx, 'images');
    const before = await page.evaluate(IMAGES_EVAL);
    rec('images/complete', before.bad ? 'FAIL' : 'PASS',
      before.bad
        ? `${before.bad} of ${before.count} <img> definitively failed (complete, naturalWidth 0)`
        : `${before.count} imgs loaded (${before.deferred} deferred by lazy-loading)`);

    await page.evaluate(SCROLL_THROUGH_EVAL);
    let after = await page.evaluate(IMAGES_EVAL);
    for (let t = 0; t < 15 && after.bad > 0; t++) { // allow slow (remote) assets
      await sleep(600);
      after = await page.evaluate(IMAGES_EVAL);
    }
    const final = await page.evaluate(`(() => {
      const imgs = [...document.querySelectorAll('img')];
      return { count: imgs.length, bad: imgs.filter(i => !i.complete || i.naturalWidth === 0).length };
    })()`);
    rec('images/lazy-after-scroll', final.bad === 0 && final.count === before.count ? 'PASS' : 'FAIL',
      final.bad === 0 ? `${final.count} imgs all loaded after scrolling through the deck` : `${final.bad} img(s) still unloaded after scroll-through`);

    const bg = await page.evaluate(BACKGROUNDS_EVAL);
    rec('images/backgrounds-resolve', bg.bad.length ? 'FAIL' : 'PASS',
      bg.bad.length ? `background url(s) fail to render: ${bg.bad.slice(0, 3).join(', ')}` : `${bg.count} CSS background url(s) render`);
  }

  // hint lifecycle (fresh pages — timing-sensitive)
  {
    const page = await freshPage(ctx, 'hint');
    const appeared = await poll(page, HINT_VISIBLE, { timeout: 3000 });
    rec('hint/appear', appeared ? 'PASS' : 'FAIL', appeared ? 'deck-hint visible within 3s of load' : 'deck-hint never appeared');

    const goneBy = await poll(page, `!(${HINT_VISIBLE})`, { timeout: 7500, interval: 250 });
    rec('hint/gone', goneBy ? 'PASS' : 'FAIL', goneBy ? 'auto-dismissed (6s timeout + fade) by 7.5s' : 'still visible at 7.5s');
  }
  {
    const page = await freshPage(ctx, 'hint-key');
    await poll(page, HINT_VISIBLE, { timeout: 3000 });
    await page.keyboard.press('x');
    const dismissed = await poll(page, `!(${HINT_VISIBLE})`, { timeout: 2000 });
    rec('hint/dismiss-on-key', dismissed ? 'PASS' : 'FAIL', dismissed ? 'hidden within 2s of a keypress' : 'keypressed, still visible after 2s');
  }
  // hasTouch WITHOUT isMobile — isMobile inflates innerWidth and poisons geometry (Hard Rule 5)
  {
    const tctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const page = await freshPage(tctx, 'hint-touch');
    await page.waitForTimeout(1200);
    const hidden = await page.evaluate(`!(${HINT_VISIBLE})`);
    rec('hint/hidden-on-touch', hidden ? 'PASS' : 'FAIL', hidden ? 'no visible hint in hasTouch (no isMobile) context' : 'hint visible under touch');
    await tctx.close();
  }

  // ── show-mode detection ────────────────────────────────────────────────────
  let navPresent = false;
  let presentPage = null; // reused for the #present assertions below
  {
    const page = await freshPage(ctx, 'detect');
    await page.evaluate(KEY('p'));
    await page.waitForTimeout(800);
    navPresent = await page.evaluate(`document.body.classList.contains('show')`);
    if (!navPresent) {
      const p2 = await freshPage(ctx, 'detect-hash', '#present');
      await p2.waitForTimeout(500);
      navPresent = await p2.evaluate(`document.body.classList.contains('show')`);
      presentPage = p2;
    }
  }

  if (navPresent) {
    // #present from a FRESH page (hash navigation is same-document — Hard Rule 7)
    const p = presentPage || await freshPage(ctx, 'present-hash', '#present');
    await p.waitForTimeout(300);
    const st = await p.evaluate(`({ show: document.body.classList.contains('show'), cur: ${CURRENT_IDX} })`);
    rec('present/hash-enters-show', st.show && st.cur === 0 ? 'PASS' : 'FAIL',
      st.show ? `show mode, slide ${st.cur + 1} current` : 'no show mode after #present load');

    const hintHidden = await p.evaluate(`!(${HINT_VISIBLE})`);
    rec('hint/hidden-on-present-hash', hintHidden ? 'PASS' : 'FAIL', hintHidden ? 'no hint on #present entry' : 'hint visible on a presenter load');

    // synthetic keys: p enters, arrows advance/retreat, Escape exits.
    // The entry slide is whatever nearestIdx() picks — record it, assert
    // relative movement (a cover slide never has build states).
    const k = await freshPage(ctx, 'present-keys');
    await k.evaluate(KEY('p'));
    await k.waitForTimeout(500);
    const inShow = await k.evaluate(`document.body.classList.contains('show')`);
    const cur0 = await k.evaluate(CURRENT_IDX);
    rec('present/key-p-enters-show', inShow && cur0 >= 0 ? 'PASS' : 'FAIL',
      inShow ? `show mode from synthetic p, slide ${cur0 + 1} current` : 'synthetic p did not enter show mode');

    await k.evaluate(KEY('ArrowRight'));
    await k.waitForTimeout(300);
    const cur1 = await k.evaluate(CURRENT_IDX);
    await k.evaluate(KEY('ArrowLeft'));
    await k.waitForTimeout(300);
    const curBack = await k.evaluate(CURRENT_IDX);
    rec('present/arrows-advance', cur0 >= 0 && cur1 === cur0 + 1 && curBack === cur0 ? 'PASS' : 'FAIL',
      `ArrowRight → slide ${cur1 + 1}, ArrowLeft → slide ${curBack + 1}`);

    await k.evaluate(KEY('Escape'));
    await k.waitForTimeout(300);
    const exited = await k.evaluate(`!document.body.classList.contains('show') && document.querySelector('.slide-wrap.current') === null`);
    rec('present/escape-exits', exited ? 'PASS' : 'FAIL', exited ? 'back to reading mode, no current slide' : 'still in show mode after Escape');

    // deep-link #N from a fresh page
    const n = Math.min(3, slideCount);
    const d = await freshPage(ctx, 'deep-link', `#${n}`);
    await d.waitForTimeout(500);
    const dl = await d.evaluate(`(() => {
      const w = document.querySelectorAll('.slide-wrap')[${n - 1}];
      const r = w.getBoundingClientRect();
      return { show: document.body.classList.contains('show'),
               centerDelta: Math.abs((r.top + r.bottom) / 2 - innerHeight / 2) };
    })()`);
    rec('present/deep-link-centers', !dl.show && dl.centerDelta < 150 ? 'PASS' : 'FAIL',
      `#${n} → slide ${n} centered (Δ ${Math.round(dl.centerDelta)}px, reading mode)`);
  } else {
    const reason = 'no show-mode handler detected (synthetic p / #present leave body.show unset)';
    rec('present/hash-enters-show', 'SKIPPED', reason);
    rec('present/key-p-enters-show', 'SKIPPED', reason);
    rec('present/arrows-advance', 'SKIPPED', reason);
    rec('present/escape-exits', 'SKIPPED', reason);
    rec('present/deep-link-centers', 'SKIPPED', reason);
    rec('hint/hidden-on-present-hash', 'SKIPPED', reason);
  }

  // ── mobile (--mobile): hasTouch WITHOUT isMobile ──────────────────────────
  if (mobile) {
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const m = await freshPage(mctx, 'mobile');

    const controls = await m.evaluate(`(() => {
      const b = document.querySelector('.present-btn');
      return b ? getComputedStyle(b).display !== 'none' : false;
    })()`);
    rec('mobile/controls-visible', controls ? 'PASS' : 'FAIL',
      controls ? 'present-btn visible in the 390px hasTouch context' : 'present-btn not visible');

    if (navPresent) {
      await m.tap('.present-btn');
      const entered = await poll(m, `document.body.classList.contains('show')`, { timeout: 1500 });
      rec('mobile/tap-enters-show', entered ? 'PASS' : 'FAIL', entered ? 'Present tap → show mode' : 'Present tap did not enter show mode');
      // entry slide is nearestIdx()-dependent on narrow viewports — record it
      const entry = await m.evaluate(CURRENT_IDX);

      const coarse = await m.evaluate(`matchMedia('(pointer:coarse)').matches`);
      if (coarse) {
        const toast = await poll(m, `(() => { const t = document.querySelector('.rotate-hint'); return t ? getComputedStyle(t).opacity !== '0' : false; })()`, { timeout: 2500 });
        const toastGone = toast ? await poll(m, `!document.querySelector('.rotate-hint')`, { timeout: 6000, interval: 250 }) : false;
        rec('mobile/rotate-toast', toast && toastGone ? 'PASS' : 'FAIL',
          toast && toastGone ? 'rotate toast shown on portrait entry, auto-removed' : 'rotate toast lifecycle broken');
      } else {
        rec('mobile/rotate-toast', 'SKIPPED', 'pointer:coarse not matched in this context');
      }

      // tap advance: pick a point inside the current slide that is NOT a
      // link (the deck's click-advance ignores clicks on <a>)
      const point = await m.evaluate(`(() => {
        const w = document.querySelector('.slide-wrap.current');
        if (!w) return null;
        const r = w.getBoundingClientRect();
        for (const [fx, fy] of [[.5,.5],[.08,.08],[.92,.08],[.08,.92],[.92,.92],[.5,.08],[.5,.92]]) {
          const x = r.x + r.width * fx, y = r.y + r.height * fy;
          const hit = document.elementFromPoint(x, y);
          if (!hit || !hit.closest('a')) return [Math.round(x), Math.round(y)];
        }
        return null;
      })()`);
      if (point) {
        await m.touchscreen.tap(point[0], point[1]);
        const adv = await poll(m, `(() => { const c = ${CURRENT_IDX}; return c === ${JSON.stringify(entry)} + 1; })()`, { timeout: 1500 });
        rec('mobile/tap-advance', adv ? 'PASS' : 'FAIL', adv ? `tap on current slide advances (${entry + 1} → ${entry + 2})` : 'tap on current slide did not advance');
      } else {
        rec('mobile/tap-advance', 'SKIPPED', 'no non-link tap point on the current slide');
      }

      // synthetic swipes via the CDP input pipeline (trusted events —
      // page-dispatched TouchEvents are not delivered reliably after a real
      // tap gesture): swipe left → next, swipe right → back
      const cdp = await mctx.newCDPSession(m);
      const swipe = async (x0, x1) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: 400 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: (x0 + x1) / 2, y: 400 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1, y: 400 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      };
      // re-baseline immediately before the swipes: whatever slide the tap
      // (or its failure / a link-dense slide) left us on is the swipes' OWN
      // starting point — a prior check's state must not cascade into a false
      // swipe FAIL. The swipe test measures movement, not absolute position.
      const swipeBase = await m.evaluate(CURRENT_IDX);
      await swipe(200, 80);
      const swNext = await poll(m, `(() => { const c = ${CURRENT_IDX}; return c === ${JSON.stringify(swipeBase)} + 1; })()`, { timeout: 1500 });
      await swipe(80, 200);
      const swBack = await poll(m, `(() => { const c = ${CURRENT_IDX}; return c === ${JSON.stringify(swipeBase)}; })()`, { timeout: 1500 });
      rec('mobile/swipe-next-back', swNext && swBack ? 'PASS' : 'FAIL',
        `swipe left → slide ${swipeBase + 2}, swipe right → slide ${swipeBase + 1}`);

      const exitVisible = await m.evaluate(`(() => { const e = document.querySelector('.present-exit'); return e ? getComputedStyle(e).display !== 'none' : false; })()`);
      await m.tap('.present-exit');
      const exited = await poll(m, `!document.body.classList.contains('show')`, { timeout: 1500 });
      rec('mobile/exit-button', exitVisible && exited ? 'PASS' : 'FAIL',
        exitVisible && exited ? '✕ visible in show mode, tap exits' : `exit button visible=${exitVisible}, exited=${exited}`);
    } else {
      const reason = 'no show-mode handler detected — mobile present flows need show mode';
      for (const name of ['mobile/tap-enters-show', 'mobile/rotate-toast', 'mobile/tap-advance', 'mobile/swipe-next-back', 'mobile/exit-button'])
        rec(name, 'SKIPPED', reason);
    }
    await mctx.close();
  }

  // ── throttle (--throttle): CDP network emulation, FCP budget ──────────────
  if (throttle) {
    const tctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await tctx.newPage();
    watch(page, 'throttle');
    const cdp = await tctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 150, // ms RTT
      downloadThroughput: Math.round(1.6 * 1024 * 1024 / 8), // 1.6 Mbps → B/s
      uploadThroughput: Math.round(1.6 * 1024 * 1024 / 8),
    });
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    let fcp = null;
    for (let t = 0; t < 10 && fcp === null; t++) {
      fcp = await page.evaluate(`(() => { const e = performance.getEntriesByName('first-contentful-paint'); return e.length ? e[0].startTime : null; })()`);
      if (fcp === null) await sleep(500);
    }
    rec('throttle/first-contentful-paint', fcp !== null && fcp < 2500 ? 'PASS' : 'FAIL',
      fcp === null ? 'no first-contentful-paint entry' : `${Math.round(fcp)}ms at 1.6 Mbps / 150ms (budget 2500ms)`);
    await tctx.close();
  }

  await ctx.close();

  // ── JS errors, collected across every page ────────────────────────────────
  rec('js/no-errors', jsErrors.length ? 'FAIL' : 'PASS',
    jsErrors.length ? `${jsErrors.length} error(s): ${jsErrors.slice(0, 3).join(' | ')}` : 'no page errors, no console errors');
} catch (e) {
  rec('suite/completed', 'FAIL', `aborted: ${e.message}`);
} finally {
  await browser.close();
}

console.log(`keynote-verify: ${passed} passed, ${failed} failed, ${skipped} skipped — ${target}`);
process.exit(failed ? 1 : 0);
