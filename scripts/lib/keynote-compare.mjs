// keynote-compare.mjs — pure checks behind `keynote-export --verify` (plan Task 3).
//
// Two independent signals per slide, so a slide can't pass on looks alone:
// - word geometry: every word visible in the HTML must appear in the Keynote
//   PDF (pdftotext -bbox) with its centre within a pixel tolerance. A missing
//   or displaced word fails the slide however small it is.
// - whole-slide difference: mean absolute greyscale difference, with native
//   chart boxes masked (Keynote draws charts in its own style).
// Extra PDF words (chart labels, axis numbers) are ignored.

const ENTITIES = { '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&apos;': "'" };

function decode(s) {
  return s.replace(/&(?:#x([\da-f]+)|#(\d+)|quot|amp|lt|gt|apos);/gi, (m, hex, dec) => {
    if (hex || dec) {
      const cp = parseInt(hex || dec, hex ? 16 : 10);
      return cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return ENTITIES[m] ?? m;
  });
}

// normWord(s) → comparison key: NFKC (PDF text can carry ligatures such as
// "ﬁ"), lowercase, punctuation and bullets removed.
export function normWord(s) {
  return String(s).normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}•]/gu, (ch) => (/\p{Extended_Pictographic}/u.test(ch) ? ch : '')).trim();
}

// parseBboxHtml(xml, targetWidth = 1920) → per-page [{text, cx, cy, h}] (plus
// a `ghosts` list of the page's parked ligature texts) in
// stream order, scaled so the page is targetWidth wide. Words whose key is
// empty (pure punctuation) are dropped, and so are zero-height words: Keynote's
// PDF parks each ligature glyph (ffi, fi, ...) at the page bottom with no
// height, leaving "Office" as "O" + "ce" (seen 2026-10-05).
export function parseBboxHtml(xml, targetWidth = 1920) {
  const pages = [];
  for (const pm of xml.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)) {
    const k = targetWidth / parseFloat(pm[1]);
    const words = [];
    const ghosts = new Set();
    for (const wm of pm[3].matchAll(/<word xMin="(-?[\d.]+)" yMin="(-?[\d.]+)" xMax="(-?[\d.]+)" yMax="(-?[\d.]+)">([\s\S]*?)<\/word>/g)) {
      const text = decode(wm[5]);
      if (!normWord(text)) continue;
      const [x0, y0, x1, y1] = wm.slice(1, 5).map(Number);
      if (y1 - y0 < 0.5) { ghosts.add(normWord(text)); continue; } // a parked ligature glyph: remember its letters
      words.push({ text, cx: ((x0 + x1) / 2) * k, cy: ((y0 + y1) / 2) * k, h: (y1 - y0) * k });
    }
    words.ghosts = [...ghosts].filter(Boolean); // this page's ligatures, e.g. ffi, th, gg
    pages.push(words);
  }
  return pages;
}

// assign(cost) → row → column for the least total cost (Hungarian method);
// cost is n×m with n ≤ m.
function assign(cost) {
  const n = cost.length;
  const m = cost[0].length;
  const u = new Array(n + 1).fill(0);
  const v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0);
  const way = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const res = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (p[j]) res[p[j] - 1] = j - 1;
  return res;
}

// matchWords(htmlWords, pdfWords, tol = 24) → { matched, total, missing, displaced }
// Each word's occurrences are paired HTML↔PDF for the least total distance,
// so a repeated word can't take another occurrence's match. Surplus HTML
// occurrences are missing.
// A word with `relaxed: true` (its font is not installed, so Keynote set it
// in a substitute with different metrics) may move sideways freely but must
// stay on its line (vertical distance within the tolerance), so a line the
// substitute pushed onto an extra line still fails. A word with `extraTol`
// (letter-spacing Keynote drops, line spacing) gets that much more distance.
export function matchWords(htmlWords, pdfWords, tol = 24) {
  const html = htmlWords.map((w) => ({ ...w, key: normWord(w.text) })).filter((w) => w.key);
  const byKey = new Map();
  for (const pw of pdfWords) {
    const key = normWord(pw.text);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(pw);
  }
  const dist = new Map(); // html index → distance to its PDF partner
  const assigned = new Map(); // html index → index in its key's PDF pool
  const dyOf = new Map(); // html index → vertical distance to its partner
  const groups = new Map();
  html.forEach((hw, i) => { if (!groups.has(hw.key)) groups.set(hw.key, []); groups.get(hw.key).push(i); });
  for (const [key, idxs] of groups) {
    const pool = byKey.get(key) || [];
    if (!pool.length) continue;
    const d = (i, pw) => Math.hypot(pw.cx - html[i].cx, pw.cy - html[i].cy);
    if (idxs.length <= pool.length) {
      assign(idxs.map((i) => pool.map((pw) => d(i, pw)))).forEach((j, r) => { dist.set(idxs[r], d(idxs[r], pool[j])); dyOf.set(idxs[r], Math.abs(pool[j].cy - html[idxs[r]].cy)); assigned.set(idxs[r], j); });
    } else {
      assign(pool.map((pw) => idxs.map((i) => d(i, pw)))).forEach((c, r) => { dist.set(idxs[c], d(idxs[c], pool[r])); dyOf.set(idxs[c], Math.abs(pool[r].cy - html[idxs[c]].cy)); assigned.set(idxs[c], r); });
    }
  }
  // Second chance for unmatched words: up to three consecutive unused PDF
  // words that join into the word, either on one line with the ligature
  // letters gone ("O" + "ce" for "office") or across a hyphen wrap
  // ("fast-" + "growing").
  const usedPdf = new Set();
  for (const [key, idxs] of groups) {
    const pool = byKey.get(key) || [];
    for (const i of idxs) if (dist.has(i)) usedPdf.add(pool[assigned.get(i)]);
  }
  // ligature letters that can be missing between fragments: the page's own
  // parked glyphs (Cormorant drops Th, Qu, gg, st...), else the common f-ligatures
  const ghosts = (pdfWords.ghosts && pdfWords.ghosts.length ? pdfWords.ghosts : ['ffi', 'ffl', 'ff', 'fi', 'fl']);
  // spells(key, frags): key = g0 + f1 + g1 + ... + fn + gn, each g a ligature or ''
  const spells = (key, frags) => {
    const go = (pos, i) => {
      for (const g of ['', ...ghosts]) {
        if (!key.startsWith(g, pos)) continue;
        const p = pos + g.length;
        if (i === frags.length) { if (p === key.length) return true; continue; }
        if (key.startsWith(frags[i], p) && go(p + frags[i].length, i + 1)) return true;
      }
      return false;
    };
    return go(0, 0);
  };
  // fragments are joined in reading order (lines top to bottom, words left to
  // right): pdftotext's stream order can put another line's words between them
  const lines = [];
  for (const w of [...pdfWords].sort((x, y) => x.cy - y.cy)) {
    const L = lines.find((l) => Math.abs(l.cy - w.cy) < 0.5 * (w.h || 20));
    if (L) L.words.push(w); else lines.push({ cy: w.cy, words: [w] });
  }
  const reading = lines.flatMap((l) => l.words.sort((x, y) => x.cx - y.cx));
  const cands = [];
  html.forEach((hw, i) => {
    if (dist.has(i)) return;
    for (let a = 0; a < reading.length; a++) {
      const frags = [];
      for (let b = a; b < Math.min(a + 3, reading.length); b++) {
        const pw = reading[b];
        if (usedPdf.has(pw)) break;
        if (b > a && Math.abs(pw.cy - reading[b - 1].cy) >= 0.5 * (reading[b - 1].h || 20)) break; // same line only
        frags.push(normWord(pw.text));
        const flat = frags.join('');
        if (!flat || flat === hw.key || flat.length >= hw.key.length || !spells(hw.key, frags)) continue;
        const frag = reading.slice(a, b + 1);
        // the missing ligature glyphs shift the centre: allow ~0.6 em per missing letter sideways
        const h = frag[0].h || 20;
        const allowX = (hw.key.length - flat.length) * 0.6 * h;
        const cx = (frag[0].cx + frag[frag.length - 1].cx) / 2;
        const dy = Math.abs(frag[0].cy - hw.cy);
        cands.push({ i, frag, d: Math.hypot(Math.max(0, Math.abs(cx - hw.cx) - allowX), dy), dy });
      }
    }
    // a hyphenated word wrapped at its hyphen: "fast-" ends a line and
    // "growing" is on a following line (any column, so search below it)
    const hy = hw.text.split('-').map(normWord);
    if (hy.length === 2 && hy[0] && hy[1]) {
      for (const p1 of pdfWords) {
        if (usedPdf.has(p1) || !/-$/.test(p1.text) || normWord(p1.text) !== hy[0]) continue;
        for (const p2 of pdfWords) {
          const k2 = normWord(p2.text);
          if (usedPdf.has(p2) || !(k2 === hy[1] || (k2 && k2.length < hy[1].length && spells(hy[1], [k2])))) continue;
          const below = p2.cy - p1.cy;
          if (below > 0.5 * (p1.h || 20) && below < 3 * (p1.h || 20)) {
            cands.push({ i, frag: [p1, p2], d: Math.hypot(p1.cx - hw.cx, p1.cy - hw.cy), dy: Math.abs(p1.cy - hw.cy) });
          }
        }
      }
    }
  });
  // nearest first across the slide, each PDF fragment used once
  for (const c of cands.sort((x, y) => x.d - y.d)) {
    if (dist.has(c.i) || c.frag.some((f) => usedPdf.has(f))) continue;
    dist.set(c.i, c.d);
    dyOf.set(c.i, c.dy);
    c.frag.forEach((f) => usedPdf.add(f));
  }
  const missing = [];
  const displaced = [];
  let matched = 0;
  html.forEach((hw, i) => {
    if (!dist.has(i)) { missing.push(hw.text); return; }
    const di = dist.get(i);
    const allow = tol + (hw.extraTol || 0);
    if (hw.relaxed ? dyOf.get(i) <= allow : di <= allow) matched++;
    else displaced.push({ text: hw.text, dist: Math.round(hw.relaxed ? dyOf.get(i) : di) });
  });
  return { matched, total: html.length, missing, displaced };
}

// meanAbsDiff(a, b, mask?) → 0..1 over greyscale bytes; mask[i] = 1 skips pixel i.
export function meanAbsDiff(a, b, mask) {
  if (a.length !== b.length) throw new Error(`image size mismatch: ${a.length} vs ${b.length}`);
  let sum = 0;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    if (mask && mask[i]) continue;
    sum += Math.abs(a[i] - b[i]);
    n++;
  }
  return n ? sum / n / 255 : 0;
}
