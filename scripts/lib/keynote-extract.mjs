// keynote-extract.mjs — rendered HTML deck → slide model + PNG layers for the
// Keynote exporter (plan Task 5).
//
// Per slide, four layers (bottom to top), all in slide-relative CSS px at
// 1920×1080:
//   plate   one PNG of the slide with all text transparent and every media,
//           table and chart element hidden (decoration flattens here because
//           Keynote's scripting can't colour shapes)
//   media   one PNG per <img>/<svg>/<canvas>/<video>. Decoration that paints
//           ABOVE a media element (each painting element that overlaps it is
//           probed with elementsFromPoint inside the overlap) is captured into
//           that media PNG (kind 'group') and stripped from the plate, so paint
//           order survives.
//   tables  native-table data + per-cell computed style
//   charts  data-kn-chart JSON
//   texts   text items with styled runs: one per text block, one per <li>
//           (prefixed with its real marker: the ::marker glyph, or the text of
//           an inline li::before; an absolutely placed li::before becomes its
//           own small text item), one per rendered line for centred/right text
//           that wraps (Keynote can't script text alignment) and for text
//           whose line pitch Keynote's default spacing would visibly change
//           (Keynote can't script line spacing either)
// Text is hidden from the plate with -webkit-text-fill-color, never `color`,
// so borders, outlines, shadows and SVG fills in currentColor stay painted.
// Videos are frozen at frame 0 (or their poster) before any capture.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getPlaywright } from './playwright.mjs';

const VIEWPORT = { width: 2000, height: 1200 };
const SLIDE_W = 1920;
const SLIDE_H = 1080;

// ── browser session ─────────────────────────────────────────────────────────
// withDeck(htmlPath, { scale }, fn) → fn's result; opens the deck at zoom 1 in
// headless Chromium and always closes it.
export async function withDeck(htmlPath, { scale = 2 } = {}, fn) {
  const { chromium } = getPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: scale });
    await page.goto(pathToFileURL(path.resolve(htmlPath)).href, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForTimeout(300);
    return await fn(page);
  } finally {
    await browser.close();
  }
}

// freezeVideos(page) → warnings[]: every <video> shows a fixed frame. With a
// poster: the poster (autoplay removed, reloaded). Without: paused at 0 after
// `seeked` and readyState ≥ 2; a video that never gets there is reported.
// Same call before extraction and before verify screenshots, so both sides
// see the same frame.
export async function freezeVideos(page) {
  return page.evaluate(async () => {
    const warnings = [];
    const wait = (el, ev, ms) => new Promise((res) => {
      const t = setTimeout(res, ms);
      el.addEventListener(ev, () => { clearTimeout(t); res(); }, { once: true });
    });
    for (const v of document.querySelectorAll('video')) {
      v.removeAttribute('autoplay');
      v.autoplay = false;
      v.muted = true;
      v.pause();
      if (v.getAttribute('poster')) { v.load(); continue; }
      if (v.readyState === 0) { v.preload = 'auto'; v.load(); } // preload="none" never loads by itself
      if (v.readyState < 2) await wait(v, 'loadeddata', 3000);
      const seeked = wait(v, 'seeked', 2000);
      v.currentTime = 0;
      await seeked;
      v.pause();
      if (v.readyState < 2 || v.seeking || v.currentTime !== 0) {
        const slide = v.closest('.slide');
        const n = slide ? [...document.querySelectorAll('.slide')].indexOf(slide) + 1 : '?';
        warnings.push(`slide ${n}: a video did not load its first frame (readyState ${v.readyState}); its still may be blank`);
      }
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return warnings;
  });
}

export async function slideCount(page) {
  return page.evaluate(() => document.querySelectorAll('.slide').length);
}

// ── in-page analysis (runs inside Chromium) ─────────────────────────────────
// Tags every element of slide `idx` with data-kx-id and returns the raw model
// (rects already slide-relative and divided by the slide's zoom factor).
function analyseSlide(idx) {
  const slide = document.querySelectorAll('.slide')[idx];
  slide.scrollIntoView({ block: 'center' });
  const sr = slide.getBoundingClientRect();
  const k = sr.width / slide.offsetWidth || 1; // zoom factor (decks may set --fit)
  const rel = (r) => ({ x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k });

  let next = 0;
  const idOf = (el) => {
    if (!el.dataset.kxId) el.dataset.kxId = `k${idx}-${next++}`;
    return el.dataset.kxId;
  };
  slide.dataset.kxSlide = String(idx);

  const EXCLUDE = 'table, [data-kn-chart], svg, video, canvas, img, script, style, noscript, template, .speaker-note';
  const warnings = [];
  const visible = (el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
  const inSlide = (r) => r.width > 0 && r.height > 0 && r.right > sr.left && r.left < sr.right && r.bottom > sr.top && r.top < sr.bottom;
  // parseColour(css) → { rgb, a }. Chromium reports legacy colours as rgb()/
  // rgba(); oklch(), lab(), color(srgb …) go through a 1×1 canvas to sRGB.
  const cctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const colours = new Map();
  const parseColour = (c) => {
    if (colours.has(c)) return colours.get(c);
    let out;
    const m = c.match(/^rgba?\(([^)]+)\)$/);
    if (m) {
      const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      out = { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 };
    } else if (c === 'transparent') {
      out = { rgb: [0, 0, 0], a: 0 };
    } else {
      cctx.fillStyle = '#010203';
      cctx.fillStyle = c;
      if (cctx.fillStyle === '#010203') {
        warnings.push(`slide ${idx + 1}: colour "${c}" not understood; used black`);
        out = { rgb: [0, 0, 0], a: 1 };
      } else {
        cctx.clearRect(0, 0, 1, 1);
        cctx.fillRect(0, 0, 1, 1);
        const d = cctx.getImageData(0, 0, 1, 1).data;
        out = { rgb: [d[0], d[1], d[2]], a: Math.round((d[3] / 255) * 1000) / 1000 };
      }
    }
    colours.set(c, out);
    return out;
  };
  // effectiveBg(el) → the RGB a viewer sees behind el: its background layers
  // and its ancestors', blended down to the first opaque one (white if none).
  const effectiveBg = (el) => {
    const layers = [];
    for (let e = el; e && e !== slide.parentElement; e = e.parentElement) {
      const c = parseColour(getComputedStyle(e).backgroundColor);
      if (c.a > 0) layers.push(c);
      if (c.a >= 1) break;
    }
    let base = [255, 255, 255];
    for (const c of layers.reverse()) base = base.map((v, i) => v * (1 - c.a) + c.rgb[i] * c.a);
    return base.map(Math.round);
  };
  const opacityChain = (el) => {
    let o = 1;
    for (let e = el; e && e !== slide.parentElement; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity) || 0;
    return o;
  };
  // opHost(el) → id of the outermost ancestor (or el) with opacity < 1, or null
  const opHost = (el) => {
    let host = null;
    for (let e = el; e && e !== slide.parentElement; e = e.parentElement) if ((parseFloat(getComputedStyle(e).opacity) || 0) < 1) host = e;
    return host ? idOf(host) : null;
  };
  // paintRect(el) → viewport rect of everything el paints: border box, box
  // shadows, outline and painting ::before/::after (absolutely placed ones at
  // their CSS position, which may lie outside el).
  const shadowPad = (cs) => {
    const pad = { l: 0, t: 0, r: 0, b: 0 };
    if (cs.boxShadow !== 'none') {
      for (const sh of cs.boxShadow.replace(/(rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]*\)/g, '').split(',')) {
        if (/inset/.test(sh)) continue;
        const [x = 0, y = 0, b = 0, sp = 0] = (sh.match(/-?[\d.]+px/g) || []).map(parseFloat);
        pad.l = Math.max(pad.l, b + sp - x); pad.r = Math.max(pad.r, b + sp + x);
        pad.t = Math.max(pad.t, b + sp - y); pad.b = Math.max(pad.b, b + sp + y);
      }
    }
    if (cs.outlineStyle !== 'none') {
      const o = (parseFloat(cs.outlineWidth) || 0) + (parseFloat(cs.outlineOffset) || 0);
      for (const kk of ['l', 't', 'r', 'b']) pad[kk] = Math.max(pad[kk], o);
    }
    return pad;
  };
  const grow = (r, pad) => ({ left: r.left - pad.l * k, top: r.top - pad.t * k, right: r.right + pad.r * k, bottom: r.bottom + pad.b * k });
  const pseudoRect = (el, p) => {
    const cs = getComputedStyle(el, p);
    const o = el.getBoundingClientRect();
    if (!/absolute|fixed/.test(cs.position)) return grow(o, shadowPad(cs));
    const os = getComputedStyle(el);
    const px = (v) => parseFloat(v);
    const pbL = o.left + px(os.borderLeftWidth) * k, pbT = o.top + px(os.borderTopWidth) * k;
    const pbR = o.right - px(os.borderRightWidth) * k, pbB = o.bottom - px(os.borderBottomWidth) * k;
    const box = (a, b, sz, pads) => (Number.isFinite(sz) ? sz + (cs.boxSizing === 'border-box' ? 0 : pads) : NaN);
    const w = box(0, 0, px(cs.width), px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth));
    const h = box(0, 0, px(cs.height), px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth));
    const W = Number.isFinite(w) ? w * k : pbR - pbL;
    const H = Number.isFinite(h) ? h * k : pbB - pbT;
    const left = Number.isFinite(px(cs.left)) ? pbL + px(cs.left) * k : Number.isFinite(px(cs.right)) ? pbR - px(cs.right) * k - W : pbL;
    const top = Number.isFinite(px(cs.top)) ? pbT + px(cs.top) * k : Number.isFinite(px(cs.bottom)) ? pbB - px(cs.bottom) * k - H : pbT;
    return grow({ left, top, right: left + W, bottom: top + H }, shadowPad(cs));
  };
  const unite = (rs) => rs.reduce((u, b) => ({ left: Math.min(u.left, b.left), top: Math.min(u.top, b.top),
    right: Math.max(u.right, b.right), bottom: Math.max(u.bottom, b.bottom) }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const families = (ff) => ff.split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  // applyTransforms(parts): text-transform across a whole item, so
  // `capitalize` sees word starts across part and node boundaries.
  const applyTransforms = (parts) => {
    let prev = ' ';
    for (const p of parts) {
      let out = '';
      for (const ch of p.text) {
        const tt = p.style.tt;
        out += tt === 'uppercase' ? ch.toUpperCase() : tt === 'lowercase' ? ch.toLowerCase()
          : tt === 'capitalize' && /\s/.test(prev) ? ch.toUpperCase() : ch;
        prev = ch;
      }
      p.text = out;
    }
    return parts;
  };
  const isInlineEl = (el) => {
    const d = getComputedStyle(el).display;
    return d === 'inline' || d === 'contents';
  };
  const boxPaints = (cs) => parseColour(cs.backgroundColor).a > 0 || cs.backgroundImage !== 'none'
    || ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== 'none')
    || cs.boxShadow !== 'none' || (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0);
  // pseudoPaints(el) → ['::before'|'::after'] whose box paints something
  const pseudoPaints = (el) => ['::before', '::after'].filter((p) => {
    const cs = getComputedStyle(el, p);
    return cs.content !== 'none' && cs.content !== 'normal' && cs.display !== 'none' && boxPaints(cs);
  });
  const paints = (el) => boxPaints(getComputedStyle(el)) || pseudoPaints(el).length > 0;

  // ── media, tables, charts ────────────────────────────────────────────────
  const mediaEls = [...slide.querySelectorAll('img, svg, canvas, video')].filter((el) =>
    !el.closest('[data-kn-chart]') && !(el.tagName.toLowerCase() === 'svg' && el.parentElement.closest('svg')) && visible(el) && inSlide(el.getBoundingClientRect()));
  // Paint-order test: every painting element that overlaps a media element is
  // probed at five points inside the overlap. If it (or one of its own
  // descendants) is hit before the media element, it paints above it. An
  // ancestor of the media counts only through its ::before/::after (its own
  // background is always below). pointer-events is forced on while probing,
  // so `pointer-events: none` overlays are still hit.
  const pe = document.createElement('style');
  pe.textContent = `[data-kx-slide="${idx}"], [data-kx-slide="${idx}"] *, [data-kx-slide="${idx}"]::before, [data-kx-slide="${idx}"]::after, [data-kx-slide="${idx}"] *::before, [data-kx-slide="${idx}"] *::after { pointer-events: auto !important; }`;
  document.head.appendChild(pe);
  const painters = [slide, ...slide.querySelectorAll('*')].filter((e) =>
    !e.closest(EXCLUDE.replace(', .speaker-note', '')) && visible(e) && paints(e));
  const probes = mediaEls.map((el) => {
    const r = el.getBoundingClientRect();
    const above = new Set();
    const pseudo = new Set();
    for (const e of painters) {
      const anc = e.contains(el);
      const ps = pseudoPaints(e);
      if (anc && !ps.length) continue;
      const pr = ps.map((p) => pseudoRect(e, p));
      const b = anc ? unite(pr) : unite([grow(e.getBoundingClientRect(), shadowPad(getComputedStyle(e))), ...pr]);
      const L = Math.max(r.left, b.left, sr.left), T = Math.max(r.top, b.top, sr.top);
      const R = Math.min(r.right, b.right, sr.right), B = Math.min(r.bottom, b.bottom, sr.bottom);
      if (R - L < 1 || B - T < 1) continue;
      const pts = [[0.5, 0.5], [0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85]];
      const hit = pts.some(([fx, fy]) => {
        const stack = document.elementsFromPoint(L + fx * (R - L), T + fy * (B - T));
        const at = stack.findIndex((x) => x === el || el.contains(x));
        return at > 0 && stack.slice(0, at).some((x) => (anc ? x === e : x === e || e.contains(x)));
      });
      if (hit) (anc ? pseudo : above).add(e);
    }
    return { el, above, pseudo };
  });
  // One painter above several media elements → one group, so it's drawn once.
  const groups = [];
  for (const pr of probes) {
    const painted = new Set([...pr.above, ...pr.pseudo]);
    const into = groups.filter((g) => [...painted].some((e) => g.above.has(e) || g.pseudo.has(e)));
    const g = { els: [pr.el], above: new Set(pr.above), pseudo: new Set(pr.pseudo) };
    for (const o of into) {
      g.els.unshift(...o.els);
      o.above.forEach((e) => g.above.add(e));
      o.pseudo.forEach((e) => g.pseudo.add(e));
      groups.splice(groups.indexOf(o), 1);
    }
    groups.push(g);
  }
  // Paint order between groups: where two groups overlap, the one hit first
  // by elementsFromPoint is on top and must be inserted later (Keynote stacks
  // in insertion order). Topological sort, DOM order breaking ties.
  groups.sort((a, b) => mediaEls.indexOf(a.els[0]) - mediaEls.indexOf(b.els[0]));
  const rectOfGroup = (g) => unite(g.els.map((e) => e.getBoundingClientRect()));
  const below = groups.map(() => new Set()); // below[i] = groups that must come before i
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const a = rectOfGroup(groups[i]);
      const b = rectOfGroup(groups[j]);
      const L = Math.max(a.left, b.left, sr.left), T = Math.max(a.top, b.top, sr.top);
      const R = Math.min(a.right, b.right, sr.right), B = Math.min(a.bottom, b.bottom, sr.bottom);
      if (R - L < 1 || B - T < 1) continue;
      const inG = (g, x) => g.els.some((e) => e === x || e.contains(x));
      const stack = document.elementsFromPoint((L + R) / 2, (T + B) / 2);
      const ai = stack.findIndex((x) => inG(groups[i], x));
      const bi = stack.findIndex((x) => inG(groups[j], x));
      if (ai < 0 || bi < 0) continue;
      if (ai < bi) below[i].add(j); else below[j].add(i);
    }
  }
  const ordered = [];
  const placed = new Set();
  while (ordered.length < groups.length) {
    const next = groups.findIndex((g, i) => !placed.has(i) && [...below[i]].every((d) => placed.has(d)));
    const pick = next >= 0 ? next : groups.findIndex((g, i) => !placed.has(i)); // cycle: fall back to DOM order
    placed.add(pick);
    ordered.push(groups[pick]);
  }
  groups.splice(0, groups.length, ...ordered);
  const media = [];
  const aboveAll = new Set();
  const pseudoAll = new Set();
  for (const g of groups) {
    const ids = [...g.above].map(idOf);
    ids.forEach((id) => aboveAll.add(id));
    const pseudoSel = [...g.pseudo].flatMap((e) => pseudoPaints(e).map((p) => `[data-kx-id="${idOf(e)}"]${p}`));
    pseudoSel.forEach((ps) => pseudoAll.add(ps));
    const u = unite([
      ...g.els.map((e) => grow(e.getBoundingClientRect(), shadowPad(getComputedStyle(e)))),
      ...[...g.above].flatMap((e) => [...(boxPaints(getComputedStyle(e)) ? [grow(e.getBoundingClientRect(), shadowPad(getComputedStyle(e)))] : []),
        ...pseudoPaints(e).map((p) => pseudoRect(e, p))]),
      ...[...g.pseudo].flatMap((e) => pseudoPaints(e).map((p) => pseudoRect(e, p))),
    ]);
    const box = { left: Math.max(sr.left, u.left), top: Math.max(sr.top, u.top), right: Math.min(sr.right, u.right), bottom: Math.min(sr.bottom, u.bottom) };
    const single = g.els.length === 1 && !ids.length && !pseudoSel.length;
    media.push({ ids: g.els.map(idOf), above: ids, pseudo: pseudoSel, kind: single ? g.els[0].tagName.toLowerCase() : 'group',
      ...rel({ left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top }) });
  }
  pe.remove();

  const tables = [];
  for (const t of slide.querySelectorAll('table')) {
    if (!visible(t) || !inSlide(t.getBoundingClientRect())) continue;
    const rows = [];
    const styles = [];
    for (const tr of t.rows) {
      // display:none rows and cells are not in the rendered table at all;
      // a visibility:hidden cell keeps its place but shows nothing
      if (getComputedStyle(tr).display === 'none') continue;
      const rr = [];
      const ss = [];
      for (const cell of tr.cells) {
        const cs = getComputedStyle(cell);
        if (cs.display === 'none') continue;
        const shown = visible(cell);
        rr.push(shown ? cell.innerText.replace(/\s+/g, ' ').trim() : '');
        // The colours a viewer sees: a tinted cell's background and any
        // translucent text are sampled from the rendered slide later (pt).
        const tinted = [cell, tr, tr.parentElement, t].some((e) => parseColour(getComputedStyle(e).backgroundColor).a > 0);
        const c = parseColour(cs.color);
        const cr = cell.getBoundingClientRect();
        ss.push({ font: families(cs.fontFamily), weight: parseInt(cs.fontWeight, 10) || 400, italic: cs.fontStyle === 'italic',
          size: parseFloat(cs.fontSize), color: c.rgb, alpha: Math.round(c.a * opacityChain(cell) * 1000) / 1000,
          bg: tinted ? effectiveBg(cell) : null, tinted,
          pt: [(cr.left + cr.width / 2 - sr.left) / k, (cr.top + cr.height / 2 - sr.top) / k],
          align: ({ start: 'left', end: 'right', '-webkit-center': 'center' })[cs.textAlign] || cs.textAlign });
      }
      if (!rr.length) continue;
      rows.push(rr);
      styles.push(ss);
    }
    // column widths from the rendered row with the most cells; row heights per row
    const shownRows = [...t.rows].filter((tr) => getComputedStyle(tr).display !== 'none');
    const widest = shownRows.reduce((a, tr) => ([...tr.cells].filter((c) => getComputedStyle(c).display !== 'none').length > [...a.cells].filter((c) => getComputedStyle(c).display !== 'none').length ? tr : a), shownRows[0]);
    const colWidths = widest ? [...widest.cells].filter((c) => getComputedStyle(c).display !== 'none' && c.colSpan === 1).map((c) => c.getBoundingClientRect().width / k) : [];
    const rowHeights = shownRows.filter((tr) => [...tr.cells].some((c) => getComputedStyle(c).display !== 'none')).map((tr) => tr.getBoundingClientRect().height / k);
    if (rows.length && Math.max(...rows.map((r) => r.length)) === 1) warnings.push(`slide ${idx + 1}: one-column table gets an extra empty column (Keynote's minimum is two)`);
    tables.push({ id: idOf(t), headerRows: t.tHead ? t.tHead.rows.length : 0, rows, styles,
      colWidths: colWidths.length === Math.max(...rows.map((r) => r.length)) ? colWidths : null,
      rowHeights: rowHeights.length === rows.length ? rowHeights : null, ...rel(t.getBoundingClientRect()) });
  }

  const charts = [];
  const CHART_TYPES = ['bar', 'line', 'area', 'pie', 'stacked_bar', 'horizontal_bar'];
  for (const el of slide.querySelectorAll('[data-kn-chart]')) {
    if (!visible(el)) continue;
    let spec = null;
    try { spec = JSON.parse(el.getAttribute('data-kn-chart')); } catch { /* reported below */ }
    const ok = spec && CHART_TYPES.includes(spec.type) && Array.isArray(spec.rows) && Array.isArray(spec.columns)
      && spec.rows.length > 0 && spec.columns.length > 0
      && Array.isArray(spec.data) && spec.data.length === spec.rows.length
      && spec.data.every((r) => Array.isArray(r) && r.length === spec.columns.length && r.every((v) => typeof v === 'number' && Number.isFinite(v)));
    if (!ok) {
      warnings.push(`slide ${idx + 1}: data-kn-chart is not valid ({type, rows, columns, data}); exported as an image`);
      el.removeAttribute('data-kn-chart');
      continue;
    }
    charts.push({ id: idOf(el), type: spec.type, rows: spec.rows.map(String), columns: spec.columns.map(String),
      data: spec.data, ...rel(el.getBoundingClientRect()) });
  }

  // ── text ─────────────────────────────────────────────────────────────────
  const texts = [];
  // Keynote text items are a few px wider than Chromium's text for the same
  // string (inner padding + metrics: 'Export Fixture' 16px is 106 in Chromium,
  // 109 natural in Keynote; '01' is 21 vs 27). Pad so nothing re-wraps.
  const slack = (w) => w * 1.04 + 16;
  // A single line must never wrap in Keynote, even in a wider substitute font:
  // give it room to the right (harmless for left-set text), within the slide.
  const fitW = (box, single) => (single ? Math.max(slack(box.w), Math.min(slide.offsetWidth - box.x, box.w * 1.3 + 40)) : slack(box.w));
  // Keynote sets lines ~1.2× the font size apart and that can't be scripted.
  const KN_PITCH = 1.2;
  // lineOf(lines, r) → the line a glyph rect belongs to: rects on one line
  // overlap vertically by at least half the smaller one (mixed font sizes
  // share a baseline but not a top).
  const lineOf = (lines, r) => {
    let L = lines.find((l) => Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top) >= 0.5 * Math.min(l.bottom - l.top, r.height));
    if (!L) { L = { top: r.top, bottom: r.bottom, parts: [], rects: [] }; lines.push(L); }
    L.top = Math.min(L.top, r.top);
    L.bottom = Math.max(L.bottom, r.bottom);
    return L;
  };
  const lineTopsOf = (rs) => {
    const lines = [];
    for (const r of rs) lineOf(lines, r);
    return lines.map((l) => l.top).sort((a, b) => a - b);
  };
  const styleOf = (el) => {
    const cs = getComputedStyle(el);
    const c = parseColour(cs.color);
    return { font: families(cs.fontFamily), weight: parseInt(cs.fontWeight, 10) || 400, italic: cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique'),
      size: Math.round(parseFloat(cs.fontSize) * 100) / 100, color: c.rgb, alpha: c.a * opacityChain(el), tt: cs.textTransform, ws: cs.whiteSpace,
      ca: c.a, op: opacityChain(el), host: opHost(el), bgKey: c.a * opacityChain(el) < 1 ? bgOf(el) : null };
  };
  // bgOf(el) → id of the nearest element (el or an ancestor) that paints a
  // background: translucent text over different backgrounds can't share one
  // run, because each run's colour is sampled once
  const bgOf = (el) => {
    for (let e = el; e && e !== slide.parentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (parseColour(cs.backgroundColor).a > 0 || cs.backgroundImage !== 'none') return idOf(e);
    }
    return null;
  };
  // ptOf(part) → slide-px centre of the part's first glyph box (where its
  // colour is sampled when it's translucent)
  const ptOf = (p) => {
    const range = document.createRange();
    if (p.ci !== undefined) { range.setStart(p.node, p.ci); range.setEnd(p.node, p.ci + 1); } else range.selectNodeContents(p.node);
    const r = [...range.getClientRects()].find((x) => x.width > 0) || p.node.parentElement.getBoundingClientRect();
    return [(r.left + r.width / 2 - sr.left) / k, (r.top + r.height / 2 - sr.top) / k];
  };
  const sameRunStyle = (a, b) => a.font.join() === b.font.join() && a.weight === b.weight && a.italic === b.italic
    && a.size === b.size && a.color.join() === b.color.join() && a.alpha === b.alpha && (a.bgKey ?? null) === (b.bgKey ?? null);

  // collect(el) → [{node, text, style}] for el's own inline content
  const collect = (el, out = []) => {
    for (const n of el.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) {
        const st = styleOf(n.parentElement);
        if (st.alpha <= 0) continue;
        let t = n.textContent;
        if (!/pre/.test(st.ws)) t = t.replace(/[\t\n\r ]+/g, ' ');
        if (t) out.push({ node: n, text: t, style: st });
      } else if (n.nodeType === Node.ELEMENT_NODE) {
        if (n.matches(EXCLUDE) || !visible(n)) continue;
        if (n.tagName === 'BR') { if (out.length) out[out.length - 1].text += '\n'; continue; }
        if (isInlineEl(n)) collect(n, out);
      }
    }
    return out;
  };
  const tidy = (parts) => {
    // collapse spaces across part boundaries, trim the block edges
    for (let i = 1; i < parts.length; i++) {
      if (/[ \n]$/.test(parts[i - 1].text) && parts[i].text.startsWith(' ')) parts[i].text = parts[i].text.slice(1);
    }
    if (parts.length) {
      parts[0].text = parts[0].text.replace(/^ +/, '');
      parts[parts.length - 1].text = parts[parts.length - 1].text.replace(/[ \n]+$/, '');
    }
    return parts.filter((p) => p.text.length);
  };
  const toRuns = (parts) => {
    const runs = [];
    for (const p of parts) {
      const last = runs[runs.length - 1];
      if (last && sameRunStyle(last._st, p.style)) last.text += p.text;
      else runs.push({ text: p.text, font: p.style.font, weight: p.style.weight, italic: p.style.italic,
        size: p.style.size, color: p.style.color, alpha: Math.round(p.style.alpha * 1000) / 1000, _st: p.style,
        _pt: ptOf(p), _a: p.style.ca, _op: p.style.op, _host: p.style.host });
    }
    return runs;
  };
  const rectsOf = (parts) => {
    const rs = [];
    for (const p of parts) {
      const range = document.createRange();
      range.selectNodeContents(p.node);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) rs.push(r);
    }
    return rs;
  };
  const union = (rs) => rs.reduce((u, r) => ({ left: Math.min(u.left, r.left), top: Math.min(u.top, r.top),
    right: Math.max(u.right, r.right), bottom: Math.max(u.bottom, r.bottom) }),
  { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });

  // ── list markers ───────────────────────────────────────────────────────
  const ALPHA = (n) => { let s = ''; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(97 + ((n - 1) % 26)) + s; return s; };
  const ROMAN = (n) => [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]
    .reduce((acc, [v, r]) => { while (n >= v) { acc += r; n -= v; } return acc; }, '');
  const ordinal = (li) => {
    const list = li.parentElement;
    const items = [...list.children].filter((c) => c.tagName === 'LI');
    const ol = list.tagName === 'OL';
    const step = ol && list.reversed ? -1 : 1;
    let n = ol && list.hasAttribute('start') ? list.start : (step < 0 ? items.length : 1);
    for (const it of items) {
      if (it.hasAttribute('value')) n = parseInt(it.getAttribute('value'), 10);
      if (it === li) return n;
      n += step;
    }
    return n;
  };
  const markerGlyph = (li, type) => {
    if (type.startsWith('"')) return quoted(type);
    const n = ordinal(li);
    const glyphs = { disc: '•', circle: '◦', square: '▪' };
    if (glyphs[type]) return glyphs[type] + ' ';
    const num = { 'decimal-leading-zero': String(n).padStart(2, '0'), 'lower-alpha': ALPHA(n), 'lower-latin': ALPHA(n),
      'upper-alpha': ALPHA(n).toUpperCase(), 'upper-latin': ALPHA(n).toUpperCase(), 'lower-roman': ROMAN(n), 'upper-roman': ROMAN(n).toUpperCase() }[type];
    return `${num ?? n}. `;
  };
  const quoted = (content) => [...content.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\(.)/g, '$1')).join('');
  // markerOf(li) → { text, cs, place } | null. A text li::before wins (decks
  // draw custom markers that way); otherwise the ::marker of a list-item,
  // its own `content` first. place: 'absolute' (positioned ::before: own item
  // at its CSS position), 'outside' (::marker outside the box: own item left
  // of the text, so wrapped lines keep their hanging indent), 'inline' (an
  // in-flow ::before or an inside ::marker: a prefix run, as the HTML wraps it).
  const markerOf = (li) => {
    const b = getComputedStyle(li, '::before');
    if (b.content !== 'none' && b.content !== 'normal' && b.display !== 'none' && b.visibility !== 'hidden') {
      const txt = (/counter\(/.test(b.content) ? String(ordinal(li)) : '') + quoted(b.content);
      if (txt.trim()) return { text: txt, cs: b, place: /absolute|fixed/.test(b.position) && getComputedStyle(li).position !== 'static' ? 'absolute' : 'inline' };
    }
    const cs = getComputedStyle(li);
    if (cs.display !== 'list-item') return null;
    const m = getComputedStyle(li, '::marker');
    let text;
    if (m.content && m.content !== 'normal') {
      if (m.content === 'none') return null;
      text = (/counter\(/.test(m.content) ? `${ordinal(li)}. ` : '') + quoted(m.content);
    } else {
      if (cs.listStyleType === 'none') return null;
      text = markerGlyph(li, cs.listStyleType);
    }
    if (!text.trim()) return null;
    return { text, cs: m, place: cs.listStylePosition === 'inside' ? 'inline' : 'outside' };
  };
  const measure = (text, cs) => {
    cctx.font = `${cs.fontStyle === 'italic' ? 'italic ' : ''}${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return cctx.measureText(text).width;
  };
  const runOf = (text, cs, owner) => {
    const c = parseColour(cs.color);
    return { text, font: families(cs.fontFamily), weight: parseInt(cs.fontWeight, 10) || 400,
      italic: cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique'), size: Math.round(parseFloat(cs.fontSize) * 100) / 100,
      color: c.rgb, alpha: Math.round(c.a * opacityChain(owner) * 1000) / 1000, _a: c.a, _op: opacityChain(owner), _host: opHost(owner) };
  };

  // freeSpace(el, u) → { above, below } in slide px: the clear gap between the
  // text's ink box u and the nearest other painted, media or text element
  // that overlaps it horizontally (or the slide edge).
  let obstacleCache = null;
  const obstacles = () => obstacleCache || (obstacleCache = [...slide.querySelectorAll('*')].filter((e) => visible(e)
    && !e.closest('.speaker-note, script, style') && (paints(e) || e.matches('img, svg, video, canvas, table, [data-kn-chart]')
      || [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim()))));
  const freeSpace = (el, u) => {
    let above = (u.top - sr.top) / k;
    let below = (sr.bottom - u.bottom) / k;
    for (const o of obstacles()) {
      if (o === el || o.contains(el) || el.contains(o)) continue;
      const r = o.getBoundingClientRect();
      if (r.right <= u.left || r.left >= u.right || !r.width || !r.height) continue;
      if (r.top >= u.bottom - 1) below = Math.min(below, (r.top - u.bottom) / k);
      else if (r.bottom <= u.top + 1) above = Math.min(above, (u.top - r.bottom) / k);
      else if (!(r.left <= u.left && r.right >= u.right && r.top <= u.top && r.bottom >= u.bottom)) {
        // overlaps the ink box without being a backdrop behind it: no room on its side
        if ((r.top + r.bottom) / 2 < (u.top + u.bottom) / 2) above = 0; else below = 0;
      }
    }
    return { above, below };
  };

  // splitLines(parts) → [{ parts, rects }] per rendered line, top to bottom.
  // Walks the source characters and buckets them by line; text-transform is
  // decided per character from the source text, so a word wrapped mid-word
  // isn't capitalised again on the next line.
  const splitLines = (parts) => {
    const lines = [];
    let prev = ' ';
    for (const p of parts) {
      const txt = p.node.textContent;
      const range = document.createRange();
      for (let ci = 0; ci < txt.length; ci++) {
        const raw = txt[ci];
        const tt = p.style.tt;
        const ch = tt === 'uppercase' ? raw.toUpperCase() : tt === 'lowercase' ? raw.toLowerCase()
          : tt === 'capitalize' && /\s/.test(prev) ? raw.toUpperCase() : raw;
        prev = raw;
        range.setStart(p.node, ci); range.setEnd(p.node, ci + 1);
        const cr = range.getClientRects()[0];
        if (!cr) continue;
        const L = lineOf(lines, cr);
        const lastPart = L.parts[L.parts.length - 1];
        if (lastPart && lastPart.style === p.style) lastPart.text += ch;
        else L.parts.push({ node: p.node, text: ch, style: p.style, ci });
        if (cr.width > 0) L.rects.push(cr);
      }
    }
    const out = [];
    for (const L of lines.sort((a, b) => a.top - b.top)) {
      for (const lp of L.parts) if (!/pre/.test(lp.style.ws)) lp.text = lp.text.replace(/[\t\n\r ]+/g, ' ');
      const lparts = tidy(L.parts);
      if (lparts.length && L.rects.length) out.push({ parts: lparts, rects: L.rects });
    }
    return out;
  };

  const blocks = [...slide.querySelectorAll('*')].filter((el) =>
    !el.closest(EXCLUDE) && !isInlineEl(el) && visible(el));
  for (const el of blocks) {
    const parts = tidy(collect(el));
    if (!parts.length) continue;
    const rs = rectsOf(parts);
    if (!rs.length) continue;
    const u = union(rs);
    if (!inSlide({ left: u.left, top: u.top, right: u.right, bottom: u.bottom, width: u.right - u.left, height: u.bottom - u.top })) continue;
    const align = getComputedStyle(el).textAlign;
    const isLi = el.tagName === 'LI';
    const marker = isLi ? markerOf(el) : null;
    const lineTops = lineTopsOf(rs);
    const centred = /center|right|end/.test(align) && !isLi;
    const domSize = Math.max(...parts.map((p) => p.style.size));
    const pitch = lineTops.length > 1 ? (lineTops[lineTops.length - 1] - lineTops[0]) / (lineTops.length - 1) / k : 0;
    // extra: how much taller (+) or shorter (-) the text gets at Keynote's
    // fixed line spacing. Keep one editable box when that fits: grow down
    // into free space below, or up into free space above (anchor 'bottom');
    // split into one box per line only when either way would hit something.
    const extra = lineTops.length > 1 ? (KN_PITCH * domSize - pitch) * (lineTops.length - 1) : 0;
    let anchor = 'top';
    if (!isLi && !centred && extra > 12) {
      const room = freeSpace(el, u);
      anchor = room.below >= extra + 4 ? 'top' : room.above >= extra + 4 ? 'bottom' : 'split';
    }
    if (!isLi && lineTops.length > 1 && (centred || anchor === 'split')) {
      // one item per rendered line
      for (const L of splitLines(parts)) {
        const lu = union(L.rects);
        const lb = rel({ left: lu.left, top: lu.top, width: lu.right - lu.left, height: lu.bottom - lu.top });
        texts.push({ source: 'line', runs: toRuns(L.parts), ...lb, w: fitW(lb, true) });
      }
      continue;
    }
    let runs;
    if (lineTops.length > 1 && !parts.some((p) => /pre/.test(p.style.ws))) {
      // One editable item, broken exactly where the HTML wraps: Keynote's box
      // is a little wider and its line spacing tighter, so left to itself it
      // would wrap the paragraph elsewhere. The break is U+2028 (a soft line
      // break, Shift-Return in Keynote): a linefeed starts a new paragraph and
      // the theme adds paragraph spacing (~38 px, seen 2026-10-05).
      const joined = [];
      splitLines(parts).forEach((L, i) => {
        if (i > 0) {
          const last = joined[joined.length - 1];
          joined.push({ node: last.node, ci: last.ci, text: '\u2028', style: last.style });
        }
        joined.push(...L.parts);
      });
      runs = toRuns(joined);
    } else {
      applyTransforms(parts);
      runs = toRuns(parts);
    }
    const box = rel({ left: u.left, top: u.top, width: u.right - u.left, height: u.bottom - u.top });
    if (marker && marker.place === 'outside') {
      // outside ::marker: its own item just left of the first line, so wrapped
      // lines keep the hanging indent the HTML gives them
      const first = rs.reduce((a, r) => (r.top < a.top - 2 || (Math.abs(r.top - a.top) <= 2 && r.left < a.left) ? r : a));
      const text = /\s$/.test(marker.text) ? marker.text : marker.text + ' ';
      const mw = measure(text, marker.cs);
      const size = parseFloat(marker.cs.fontSize);
      const mb = rel({ left: first.left - mw * k, top: first.top + (first.height - size * 1.15 * k) / 2, width: mw * k, height: size * 1.2 * k });
      const run = runOf(text.trim(), marker.cs, el);
      run._pt = [mb.x + mb.w / 2, mb.y + mb.h / 2];
      if (run.alpha > 0) texts.push({ source: 'marker', runs: [run], ...mb, w: fitW(mb, true) });
    } else if (marker && marker.place === 'absolute') {
      // an absolutely placed li::before: its own text item where the HTML puts it
      const lr = el.getBoundingClientRect();
      const ls = getComputedStyle(el);
      const size = parseFloat(marker.cs.fontSize);
      const lh = marker.cs.lineHeight === 'normal' ? size * 1.2 : parseFloat(marker.cs.lineHeight);
      const left = parseFloat(marker.cs.left);
      const top = parseFloat(marker.cs.top);
      const mx = lr.left + parseFloat(ls.borderLeftWidth) + (Number.isFinite(left) ? left * k : parseFloat(ls.paddingLeft) * k);
      const my = lr.top + parseFloat(ls.borderTopWidth) + (Number.isFinite(top) ? top * k : parseFloat(ls.paddingTop) * k);
      const mw = measure(marker.text, marker.cs);
      const mb = rel({ left: mx, top: my + Math.max(0, (lh - size * 1.15) / 2) * k, width: mw * k, height: size * 1.2 * k });
      const run = runOf(marker.text.trim(), marker.cs, el);
      run._pt = [mb.x + mb.w / 2, mb.y + mb.h / 2];
      if (run.alpha > 0) texts.push({ source: 'marker', runs: [run], ...mb, w: fitW(mb, true) });
    } else if (marker) {
      // the marker isn't in the HTML text box: measure it in its own font and
      // widen the box to the left so the words stay where the HTML put them
      const text = /\s$/.test(marker.text) ? marker.text : marker.text + ' ';
      const pw = measure(text, marker.cs);
      const run = runOf(text, marker.cs, el);
      run._pt = runs[0]._pt;
      run._st = { font: run.font, weight: run.weight, italic: run.italic, size: run.size, color: run.color, alpha: run.alpha };
      if (sameRunStyle(runs[0]._st, run._st)) runs[0].text = text + runs[0].text;
      else runs.unshift(run);
      box.x -= pw;
      box.w += pw;
    }
    const item = { source: isLi ? 'li' : 'block', runs, ...box, w: fitW(box, lineTops.length === 1) };
    if (Math.abs(extra) > 1) {
      // for --verify: words in this box may sit up to |extra| from the HTML
      item.drift = { tol: Math.abs(extra), left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h };
      if (anchor === 'bottom') item.y -= extra;
    }
    texts.push(item);
  }
  for (const t of texts) for (const r of t.runs) delete r._st;

  const notes = [...slide.querySelectorAll('.speaker-note')].map((n) => n.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
  return { media, aboveAll: [...aboveAll], pseudoAll: [...pseudoAll], tables, charts, texts, notes, warnings, zoom: k };
}

// slideWords(page, idx) → [{text, cx, cy, font, weight, italic, spacingDrift}]
// slide-relative word centres for every visible word (tables included; notes,
// chart drawings and media excluded), with the word's CSS font stack and the
// most its letter-spacing can move it in Keynote (which can't script
// tracking), so --verify can allow for what Keynote can't reproduce. A word
// split across inline elements (<span>inter</span>national) is one word, as
// in the PDF.
export async function slideWords(page, idx) {
  return page.evaluate((i) => {
    const slide = document.querySelectorAll('.slide')[i];
    slide.scrollIntoView({ block: 'center' });
    const sr = slide.getBoundingClientRect();
    const k = sr.width / slide.offsetWidth || 1;
    const out = [];
    const walker = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT);
    const tt = (t, mode) => (mode === 'uppercase' ? t.toUpperCase() : mode === 'lowercase' ? t.toLowerCase() : t);
    const blockOf = (el) => { let e = el; while (e && e !== slide && /^(inline|contents)$/.test(getComputedStyle(e).display)) e = e.parentElement; return e; };
    let prev = null; // last token, if it ran to the end of its text node
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('.speaker-note, [data-kn-chart], svg, script, style')) { prev = null; continue; }
      if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) { prev = null; continue; }
      const cs = getComputedStyle(el);
      const mode = cs.textTransform;
      const font = cs.fontFamily.split(',').map((f) => f.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      const weight = parseInt(cs.fontWeight, 10) || 400;
      const italic = cs.fontStyle === 'italic' || cs.fontStyle.startsWith('oblique');
      const ls = Math.abs(parseFloat(cs.letterSpacing) || 0);
      const block = blockOf(el);
      const txt = n.textContent;
      if (!txt.length) continue;
      let last = null;
      for (const m of txt.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length);
        // a word broken across lines (at its hyphen) is placed by its first piece,
        // as the PDF side places it; the union box would sit mid-paragraph
        const pieces = [...range.getClientRects()].filter((x) => x.width > 0);
        const r = pieces.length > 1 && pieces[1].top > pieces[0].bottom - 2 ? pieces[0] : range.getBoundingClientRect();
        if (!r.width || r.right < sr.left || r.left > sr.right || r.bottom < sr.top || r.top > sr.bottom) { last = null; continue; }
        const word = { text: tt(m[0], mode), l: r.left, t: r.top, r: r.right, b: r.bottom, font, weight, italic,
          // most a dropped letter-spacing can move this word: one gap per character up to its end
          spacingDrift: ls > 0.3 ? ls * (m.index + m[0].length) : 0, block, open: m.index + m[0].length === txt.length };
        const glued = m.index === 0 && prev && prev.open && prev.block === block
          && Math.min(prev.b, word.b) - Math.max(prev.t, word.t) > 0.5 * Math.min(prev.b - prev.t, word.b - word.t);
        if (glued) {
          Object.assign(prev, { text: prev.text + word.text, l: Math.min(prev.l, word.l), t: Math.min(prev.t, word.t),
            r: Math.max(prev.r, word.r), b: Math.max(prev.b, word.b), spacingDrift: Math.max(prev.spacingDrift, word.spacingDrift), open: word.open });
          last = prev;
        } else {
          out.push(word);
          last = word;
        }
      }
      prev = last && last.open ? last : null;
    }
    return out.map((w) => ({ text: w.text, cx: ((w.l + w.r) / 2 - sr.left) / k, cy: ((w.t + w.b) / 2 - sr.top) / k,
      font: w.font, weight: w.weight, italic: w.italic, spacingDrift: w.spacingDrift }));
  }, idx);
}

// ── captures ────────────────────────────────────────────────────────────────
async function withStyle(page, css, fn) {
  const handle = await page.addStyleTag({ content: css });
  try { return await fn(); } finally { await handle.evaluate((el) => el.remove()); }
}

const sel = (idx) => `[data-kx-slide="${idx}"]`;

// Text hidden, everything else painted. -webkit-text-fill-color (not color)
// so currentColor borders, outlines, shadows and SVG fills survive.
const hideText = (idx) => `${sel(idx)}, ${sel(idx)}::before, ${sel(idx)}::after, ${sel(idx)} *, ${sel(idx)} *::before, ${sel(idx)} *::after { -webkit-text-fill-color: transparent !important; text-shadow: none !important; -webkit-text-stroke: 0 !important; text-decoration-color: transparent !important; }
${sel(idx)} li::marker { color: transparent !important; }`;
const byId = (ids) => ids.map((id) => `[data-kx-id="${id}"]`).join(',');

async function capturePlate(page, idx, raw, file) {
  const hide = byId([...raw.media.flatMap((m) => m.ids), ...raw.tables.map((t) => t.id), ...raw.charts.map((c) => c.id)]);
  const strip = byId(raw.aboveAll);
  const pseudo = raw.pseudoAll.join(',');
  const css = `${hideText(idx)}
${hide ? `${hide} { visibility: hidden !important; }` : ''}
${strip ? `${strip} { background: none !important; border-color: transparent !important; box-shadow: none !important; outline-color: transparent !important; }` : ''}
${strip ? raw.aboveAll.map((id) => `[data-kx-id="${id}"]::before, [data-kx-id="${id}"]::after`).join(',') + ' { visibility: hidden !important; }' : ''}
${pseudo ? `${pseudo} { visibility: hidden !important; }` : ''}`;
  await withStyle(page, css, () => page.locator(sel(idx)).screenshot({ path: file, animations: 'disabled' }));
}

async function captureMedia(page, idx, m, file) {
  const members = byId(m.ids);
  const above = byId(m.above);
  const css = `html, body, .slide-wrap { background: transparent !important; box-shadow: none !important; }
${sel(idx)} { background: transparent !important; box-shadow: none !important; }
${sel(idx)}::before, ${sel(idx)}::after, ${sel(idx)} *, ${sel(idx)} *::before, ${sel(idx)} *::after { visibility: hidden !important; }
${members}, ${m.ids.map((id) => `[data-kx-id="${id}"] *`).join(',')} { visibility: visible !important; }
${above ? `${above}, ${m.above.map((id) => `[data-kx-id="${id}"]::before, [data-kx-id="${id}"]::after`).join(',')} { visibility: visible !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }` : ''}
${m.pseudo.length ? `${m.pseudo.join(',')} { visibility: visible !important; -webkit-text-fill-color: transparent !important; }` : ''}`;
  await withStyle(page, css, async () => {
    const box = await page.locator(sel(idx)).boundingBox();
    const k = box.width / SLIDE_W;
    await page.screenshot({ path: file, omitBackground: true, animations: 'disabled',
      clip: { x: box.x + m.x * k, y: box.y + m.y * k, width: m.w * k, height: m.h * k } });
  });
}

// sampleColours: the colours a viewer sees for translucent text and tinted
// table cells, read from the rendered slide with text hidden (U). The plate
// is the wrong source: it has media, scrims and tables removed. Text inside
// an element with opacity < 1 is a group: CSS composites the group as a
// whole, so a second capture with those groups hidden gives what is behind
// them (O), and the group's own backdrop is recovered as (U - (1-op)·O)/op.
async function sampleColours(page, idx, raw, dir, scale) {
  const runs = raw.texts.flatMap((t) => t.runs);
  const cells = raw.tables.flatMap((t) => t.styles.flat()).filter(Boolean);
  const lucent = runs.filter((r) => r.alpha < 1);
  const cellsNeeding = cells.filter((c) => c.tinted || c.alpha < 1);
  if (!lucent.length && !cellsNeeding.length) return;
  const k = raw.zoom * scale; // slide px → screenshot px
  const shoot = async (css, name) => {
    const file = path.join(dir, `${name}-${idx}.png`);
    await withStyle(page, css, () => page.locator(sel(idx)).screenshot({ path: file, animations: 'disabled' }));
    const b64 = fs.readFileSync(file).toString('base64');
    fs.rmSync(file, { force: true });
    return b64;
  };
  const read = (b64, pts) => page.evaluate(async ({ b64, pts }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return pts.map(([x, y]) => [...ctx.getImageData(Math.max(0, Math.min(x, c.width - 1)), Math.max(0, Math.min(y, c.height - 1)), 1, 1).data].slice(0, 3));
  }, { b64, pts });
  const px = (pt) => [Math.round(pt[0] * k), Math.round(pt[1] * k)];
  const U = await shoot(hideText(idx), 'under');
  const uRuns = await read(U, lucent.map((r) => px(r._pt)));
  const uCells = await read(U, cellsNeeding.map((c) => px(c.pt)));
  const hosts = [...new Set(lucent.filter((r) => r._op < 1 && r._host).map((r) => r._host))];
  let oRuns = null;
  if (hosts.length) {
    const O = await shoot(`${hideText(idx)}\n${byId(hosts)} { visibility: hidden !important; }`, 'behind');
    oRuns = await read(O, lucent.map((r) => px(r._pt)));
  }
  const clamp = (v) => Math.max(0, Math.min(255, v));
  lucent.forEach((r, i) => {
    const u = uRuns[i];
    const a = r._a ?? r.alpha;
    const op = r._op ?? 1;
    if (op < 1 && oRuns) {
      const o = oRuns[i];
      r.color = r.color.map((t, ch) => {
        const g = clamp((u[ch] - (1 - op) * o[ch]) / op);
        return Math.round(op * (a * t + (1 - a) * g) + (1 - op) * o[ch]);
      });
    } else {
      r.color = r.color.map((t, ch) => Math.round(a * t + (1 - a) * u[ch]));
    }
  });
  cellsNeeding.forEach((c, i) => {
    const u = uCells[i];
    if (c.tinted) c.bg = u.map(Math.round);
    if (c.alpha < 1) c.color = c.color.map((t, ch) => Math.round(c.alpha * t + (1 - c.alpha) * u[ch]));
  });
}

// extractDeck(htmlPath, { outDir, slides, scale }) → DeckModel
//   slides: 1-based source indexes to export (default: all)
export async function extractDeck(htmlPath, { outDir, slides = null, scale = 2 } = {}) {
  if (!outDir) throw new Error('extractDeck: outDir required');
  fs.mkdirSync(outDir, { recursive: true });
  return withDeck(htmlPath, { scale }, async (page) => {
    const total = await slideCount(page);
    const want = slides || Array.from({ length: total }, (_, i) => i + 1);
    const videoWarnings = await freezeVideos(page);
    const deck = { width: SLIDE_W, height: SLIDE_H, total, slides: [], warnings: videoWarnings.filter((w) => want.some((n) => w.startsWith(`slide ${n}:`))) };
    for (const n of want) {
      const idx = n - 1;
      const raw = await page.evaluate(analyseSlide, idx);
      const pad = String(n).padStart(2, '0');
      const plate = path.join(outDir, `s${pad}-plate.png`);
      await capturePlate(page, idx, raw, plate);
      const media = [];
      for (const [i, m] of raw.media.entries()) {
        const file = path.join(outDir, `s${pad}-m${i + 1}.png`);
        await captureMedia(page, idx, m, file);
        media.push({ path: file, x: m.x, y: m.y, w: m.w, h: m.h, kind: m.kind });
      }
      await sampleColours(page, idx, raw, outDir, scale);
      for (const t of raw.texts) for (const r of t.runs) { delete r._pt; delete r._a; delete r._op; delete r._host; }
      for (const tb of raw.tables) for (const row of tb.styles) for (const c of row) { delete c.pt; delete c.tinted; delete c.alpha; }
      deck.warnings.push(...raw.warnings);
      deck.slides.push({
        index: n,
        plate: { path: plate },
        media,
        tables: raw.tables.map(({ id, ...t }) => t),
        charts: raw.charts.map(({ id, ...c }) => c),
        texts: raw.texts,
        notes: raw.notes,
      });
    }
    return deck;
  });
}
