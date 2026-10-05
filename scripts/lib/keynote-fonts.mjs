// keynote-fonts.mjs — CSS font stacks → installed macOS PostScript names (Keynote export).
//
// Keynote can only use fonts installed on the Mac, addressed by PostScript
// name. Decks often embed web fonts (base64 @font-face) that are NOT
// installed, so every run is resolved against the real inventory: first
// installed family in the CSS stack wins, generic families map to macOS
// stand-ins, and anything unresolvable falls back to Helvetica Neue with one
// warning per missing family.
//
// Weights use NSFontManager's 0–15 scale (5 = regular, 9 = bold). Trait bits:
// 1 italic, 0x20 expanded, 0x40 condensed (`narrow`).

import { spawnSync } from 'node:child_process';

const FALLBACK = 'Helvetica Neue';
const GENERIC = {
  'sans-serif': 'Helvetica Neue',
  'system-ui': 'Helvetica Neue',
  '-apple-system': 'Helvetica Neue',
  'blinkmacsystemfont': 'Helvetica Neue',
  'ui-sans-serif': 'Helvetica Neue',
  'ui-rounded': 'Helvetica Neue',
  'serif': 'Times New Roman',
  'ui-serif': 'Times New Roman',
  'monospace': 'Menlo',
  'ui-monospace': 'Menlo',
  'cursive': 'Apple Chancery',
  'fantasy': 'Papyrus',
  'emoji': 'Apple Color Emoji',
  'math': 'STIX Two Math',
};
// Generic families Chromium draws in a font Keynote can't address (the SF
// system fonts) or picks itself: the stand-in is fine, but the geometry
// won't match, so --verify treats these words like a substituted font.
const STAND_IN = new Set(['system-ui', '-apple-system', 'blinkmacsystemfont', 'ui-sans-serif', 'ui-serif', 'ui-monospace', 'ui-rounded', 'cursive', 'fantasy', 'emoji', 'math']);
const CSS_TO_NS = [[100, 2], [200, 3], [300, 4], [400, 5], [500, 6], [600, 8], [700, 9], [800, 10], [900, 11]];

// cssWeightToNs(w) → NSFontManager weight; between two anchors, nearest wins
// and a tie rounds down.
export function cssWeightToNs(w) {
  let best = CSS_TO_NS[0];
  for (const pair of CSS_TO_NS) {
    if (Math.abs(pair[0] - w) < Math.abs(best[0] - w)) best = pair;
  }
  return best[1];
}

function cleanFamily(f) {
  return String(f).trim().replace(/^["']|["']$/g, '').trim();
}

function findFamily(name, inventory) {
  if (inventory[name]) return name;
  const lower = name.toLowerCase();
  return Object.keys(inventory).find((k) => k.toLowerCase() === lower) || null;
}

// Style names per CSS weight, best first. NSFontManager gives several members
// the same weight (Inter Thin, ExtraLight and Light are all 3; ExtraBold and
// Black are both 11), so the style name breaks the tie.
const STYLE_NAMES = {
  100: ['thin', 'hairline'], 200: ['extralight', 'ultralight'], 300: ['light'],
  400: ['regular', 'book', 'roman', 'normal', ''], 500: ['medium'], 600: ['semibold', 'demibold'],
  700: ['bold'], 800: ['extrabold', 'ultrabold', 'heavy'], 900: ['black', 'heavy'],
};

function styleKey(name) {
  return String(name || '').toLowerCase().replace(/italic|oblique|[\s_-]/g, '');
}

function styleRank(member, cssWeight) {
  const anchor = CSS_TO_NS.reduce((b, p) => (Math.abs(p[0] - cssWeight) < Math.abs(b[0] - cssWeight) ? p : b))[0];
  const i = STYLE_NAMES[anchor].indexOf(styleKey(member.style));
  return i === -1 ? Infinity : i;
}

// pickMember: normal width first (Helvetica Neue lists Condensed Bold and
// Condensed Black), then the requested italic, then a member whose style name
// matches the CSS weight (NSFontManager weights are uneven: Inter Black is
// 14, ExtraBold 11), then the nearest NSFontManager weight.
function pickMember(members, weight, italic) {
  const target = cssWeightToNs(weight);
  const prefer = (pool, keep) => { const p = pool.filter(keep); return p.length ? p : pool; };
  const pool = prefer(prefer(members, (m) => !m.narrow), (m) => m.italic === italic);
  const named = pool.filter((m) => styleRank(m, weight) !== Infinity);
  if (named.length) return named.reduce((best, m) => (styleRank(m, weight) < styleRank(best, weight) ? m : best));
  return pool.reduce((best, m) => (Math.abs(m.weight - target) < Math.abs(best.weight - target) ? m : best));
}

// resolveFont(families, weight, italic, inventory) → { ps, family, missing, fallback, skipped, generics }
// `skipped` lists the named (non-generic) families passed over because they
// are not installed, `generics` the generic ones whose stand-in isn't.
// `missing` is true whenever Keynote's text will not use the font the browser
// drew: a skipped family, a stand-in generic (STAND_IN), or the fallback.
export function resolveFont(families, weight, italic, inventory) {
  const skipped = [];
  const generics = [];
  for (const raw of families || []) {
    const name = cleanFamily(raw);
    if (!name) continue;
    const key = name.toLowerCase();
    const generic = Object.hasOwn(GENERIC, key) ? GENERIC[key] : null;
    const fam = findFamily(generic || name, inventory);
    if (fam && inventory[fam].length) {
      return { ps: pickMember(inventory[fam], weight, italic).ps, family: fam,
        missing: skipped.length > 0 || STAND_IN.has(key), fallback: false, skipped, generics };
    }
    (generic ? generics : skipped).push(name);
  }
  const fam = findFamily(FALLBACK, inventory);
  const ps = fam && inventory[fam].length ? pickMember(inventory[fam], weight, italic).ps : 'HelveticaNeue';
  return { ps, family: FALLBACK, missing: true, fallback: true, skipped, generics };
}

// mapFonts(deck, inventory) → warnings[]. Mutates every text run and table
// cell style in place to add `ps`. A text item set (partly) in a substituted
// font gets room to the slide's right edge: its lines are already broken where
// the HTML breaks them, and a wider substitute must not wrap them again. One warning per named family that is not
// installed, naming the family Keynote got instead.
export function mapFonts(deck, inventory) {
  const missing = new Map();
  const apply = (style) => {
    const r = resolveFont(style.font, style.weight ?? 400, !!style.italic, inventory);
    style.ps = r.ps;
    for (const f of r.skipped) if (!missing.has(f)) missing.set(f, r.family);
    // nothing named was skipped but no generic resolved either: name the generic
    if (r.fallback && !r.skipped.length) {
      const g = r.generics.length ? r.generics.map((n) => `${n} (${GENERIC[n.toLowerCase()]})`).join(', ') : '(no font family)';
      if (!missing.has(g)) missing.set(g, r.family);
    }
  };
  for (const slide of deck.slides || []) {
    for (const t of slide.texts || []) {
      let substituted = false;
      for (const run of t.runs || []) {
        apply(run);
        if (resolveFont(run.font, run.weight ?? 400, !!run.italic, inventory).missing) substituted = true;
      }
      if (substituted && Number.isFinite(t.x) && Number.isFinite(t.w)) t.w = Math.max(t.w, (deck.width || 1920) - t.x);
    }
    for (const tb of slide.tables || []) for (const row of tb.styles || []) for (const cell of row) apply(cell);
  }
  return [...missing].map(([f, used]) => `font not installed: "${f}" (used ${used}; install it and re-export for an exact match)`);
}

const INVENTORY_JXA = `
ObjC.import("AppKit");
const fm = $.NSFontManager.sharedFontManager;
const out = {};
for (const f of ObjC.deepUnwrap(fm.availableFontFamilies)) {
  const m = ObjC.deepUnwrap(fm.availableMembersOfFontFamily(f));
  if (m) out[f] = m.map(e => ({ ps: e[0], style: e[1], weight: e[2], italic: (e[3] & 1) === 1, narrow: (e[3] & 0x60) !== 0 }));
}
JSON.stringify(out);`;

// queryFontInventory() → Inventory (macOS only; one osascript call)
export function queryFontInventory() {
  if (process.platform !== 'darwin') throw new Error('font inventory needs macOS');
  const r = spawnSync('osascript', ['-l', 'JavaScript', '-e', INVENTORY_JXA], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`font inventory query failed: ${r.stderr.trim()}`);
  return JSON.parse(r.stdout);
}
