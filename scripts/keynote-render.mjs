#!/usr/bin/env node
// keynote-render.mjs
// Render a /keynote-create markdown deck into an HTML slide deck styled by a
// swappable "style pack", and export to PDF via headless Chrome with fonts
// embedded as base64 @font-face.
//
// Usage:
//   Full pipeline (markdown → HTML → PDF):
//     keynote-render.mjs <input.md> [--out <dir>] [--style <pack-dir|name>] [--brand <name>] [--sublabel <text>] [--no-pdf] [--mode boardroom|keynote] [--no-cover]
//
//   Re-export only (existing HTML → PDF, used after Stage 4b layout promotion):
//     keynote-render.mjs <input.html>
//
// Defaults:
//   --out      : same directory as the input markdown
//   --style    : the bundled neutral pack. Pass a pack directory path, or a
//                name registered in the house-style registry. An explicit but
//                unresolvable name/path is an error (never a silent fallback).
//   --brand    : from the pack's pack.json (CLI overrides)
//   --sublabel : from the pack's pack.json (CLI overrides)
//
// A style pack is a directory: pack.json + tokens.css (skin) + layouts.css
// (structure; may be "shared" → the bundled neutral layouts) + fonts.json +
// style-notes.md. See packs/neutral/REQUIRED-TOKENS.md for the token contract.
//
// PDF export honours the rules in ~/.claude/CLAUDE.md:
//   - Fonts are downloaded once, cached in ~/.claude/cache/fonts/, and
//     base64-inlined as @font-face
//   - Chrome is invoked with --virtual-time-budget=10000
//     --run-all-compositor-stages-before-draw

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import https from 'node:https';
import http from 'node:http';
import { resolveName, getDefault, registryPath } from './house-style.mjs';
import { parseDeck } from './lib/deck-content.mjs';

const HOME = os.homedir();
const FONT_CACHE = path.join(HOME, '.claude/cache/fonts');
const IMG_CACHE = path.join(HOME, '.claude/cache/deck-images');
const IMG_MAX_BYTES = 12 * 1024 * 1024; // full-bleed photography runs larger than fonts
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));

// Bounds for remote font fetches (arbitrary pack URLs are untrusted).
const FETCH_TIMEOUT_MS = 20_000;         // socket inactivity timeout
const FETCH_DEADLINE_MS = 30_000;        // hard wall-clock ceiling per request
const FETCH_MAX_BYTES = 8 * 1024 * 1024; // 8MB — a woff2 face is far smaller
const FETCH_MAX_REDIRECTS = 5;
const FETCH_MAX_FACES = 40;              // cap total faces an untrusted pack can request
const nowMs = () => Date.now();

// Block obvious SSRF targets given as literal addresses: loopback, private,
// link-local, and cloud-metadata, plus localhost. THREAT MODEL: this is a local
// single-user CLI; packs are chosen by the user. This guard is defense-in-depth
// against a naive malicious pack, NOT a security boundary — it does not resolve
// DNS names (a hostname resolving to a private IP is not caught), and Chrome
// still fetches pack image url()s during PDF export outside this guard. Untrusted
// packs remain the user's responsibility. See docs SECURITY note.
function isBlockedIPv4(a, b) {
  if (a === 127 || a === 10 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;         // link-local + cloud metadata
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  return false;
}
function isBlockedHost(hostname) {
  const h = String(hostname).toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) return isBlockedIPv4(+v4[1], +v4[2]);
  // IPv6 loopback / unspecified / unique-local (fc00::/7) / link-local (fe80::/10)
  if (h === '::1' || h === '::' || /^f[cd][0-9a-f]*:/.test(h) || /^fe[89ab][0-9a-f]*:/.test(h)) return true;
  // IPv4-mapped/compat IPv6 (::ffff:127.0.0.1, ::ffff:a9fe:...)
  const mapped = h.match(/(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (mapped && /^::(ffff:)?/.test(h)) return isBlockedIPv4(+mapped[1], +mapped[2]);
  return false;
}

// ── args ──
const args = process.argv.slice(2);
if (!args.length || args[0] === '--help' || args[0] === '-h') {
  console.log('Usage: keynote-render.mjs <input.md> [--out <dir>] [--style <pack-dir|name>] [--brand <name>] [--sublabel <text>] [--no-pdf] [--mode boardroom|keynote] [--no-cover]');
  process.exit(args[0] === '--help' || args[0] === '-h' ? 0 : 1);
}
const input = path.resolve(args[0]);
if (!fs.existsSync(input)) { console.error(`Input not found: ${input}`); process.exit(1); }

let outDir = path.dirname(input);
let styleFlag = null;          // null → bundled neutral pack
let cliBrand = null;           // overrides pack.json brand when set
let cliSublabel = null;        // overrides pack.json sublabel when set
let makePdf = true;
let cliMode = null;
let includeCover = true;
const needVal = (a, v) => {
  if (v === undefined || (typeof v === 'string' && v.startsWith('--'))) {
    console.error(`[args] ${a} requires a value`); process.exit(1);
  }
  return v;
};
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === '--out')      outDir = path.resolve(needVal(a, args[++i]));
  else if (a === '--style')    styleFlag = needVal(a, args[++i]);
  else if (a === '--brand')    cliBrand = needVal(a, args[++i]);
  else if (a === '--sublabel') cliSublabel = needVal(a, args[++i]);
  else if (a === '--no-pdf')   makePdf = false;
  else if (a === '--mode') cliMode = needVal(a, args[++i]).toLowerCase();
  else if (a === '--no-cover') includeCover = false;
  else { console.error(`[args] unknown argument: ${a}`); process.exit(1); }
}

if (cliMode != null && !['boardroom', 'keynote'].includes(cliMode)) {
  console.error('[args] --mode must be boardroom or keynote'); process.exit(1);
}

// brand/sublabel are resolved from the pack after loadPack (CLI overrides win).
let brand = cliBrand ?? '';
let sublabel = cliSublabel ?? '';

const inputExt = path.extname(input).toLowerCase();
const baseName = path.basename(input, inputExt);
const htmlOut = path.join(outDir, `${baseName}.html`);
const pdfOut  = path.join(outDir, `${baseName}.pdf`);
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(FONT_CACHE, { recursive: true });
fs.mkdirSync(IMG_CACHE, { recursive: true });

// ── re-export shortcut: existing HTML → PDF only ──
// Used by Stage 4b after the model has rewritten the baseline HTML to richer
// pack layouts. Skip markdown parsing and font fetching — the HTML already
// has base64-inlined @font-face declarations from the initial render.
if (inputExt === '.html' || inputExt === '.htm') {
  const ok = exportPdf(input, pdfOut);
  if (!ok) process.exit(1);
  const sz = fs.statSync(pdfOut).size;
  console.log(`[pdf]  ${pdfOut}  (${(sz/1024).toFixed(0)}KB, re-exported)`);
  process.exit(0);
}

// ── style pack resolution + loading ──
// A pack directory is located from --style (a path or a registered name) or,
// when --style is absent, the bundled neutral pack. An explicit but
// unresolvable --style is a hard error — never a silent neutral fallback.
function die(msg) { console.error(`[style] ${msg}`); process.exit(1); }

function bundledNeutralDir() {
  const candidates = [
    process.env.KEYNOTE_PACKS_DIR && path.join(process.env.KEYNOTE_PACKS_DIR, 'neutral'),
    path.join(HOME, '.claude/skills/keynote-create/packs/neutral'), // deployed layout
  ].filter(Boolean);
  // repo layout: walk up from the script dir looking for packs/neutral
  let dir = SCRIPT_DIR;
  for (let i = 0; i < 6; i++) {
    candidates.push(path.join(dir, 'packs/neutral'));
    dir = path.dirname(dir);
  }
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'pack.json'))) return c;
  }
  die(`could not locate the bundled neutral pack (looked in: ${candidates.join(', ')})`);
}

function resolvePack(styleArg) {
  if (styleArg == null) {
    // flag absent → the registry default first, then the bundled neutral pack.
    // A registry with NO default silently uses the bundled neutral pack (that is
    // the documented default behavior) — but a registry whose default is BROKEN
    // (moved/deleted directory, unregistered name) is a hard error, never a
    // silent neutral fallback (Hard Rule 8: unresolvable configuration stops).
    const d = getDefault();
    if (d.path) return d.path;
    if (/no default house-style pack is set/.test(d.error || '')) {
      return bundledNeutralDir();
    }
    die(`the registry default house-style pack is broken — ${d.error} (fix or clear the entry in ${registryPath()}; refusing to silently fall back to the bundled neutral pack)`);
  }
  if (styleArg === '') die(`--style requires a non-empty value`); // explicit empty → fail closed
  // an existing directory path wins
  if (fs.existsSync(styleArg) && fs.statSync(styleArg).isDirectory()) return path.resolve(styleArg);
  // otherwise treat it as a registered house-style name
  const r = resolveName(styleArg);
  if (r.error) die(`--style "${styleArg}" is not a directory and ${r.error}`);
  return r.path;
}

const REQUIRED_TOKENS = [
  '--display','--body-font','--wordmark',
  '--accent','--accent-light','--accent-dark','--accent-tint','--accent-fade',
  '--lt-bg','--lt-bg2','--lt-bg3','--lt-card-bg','--lt-text','--lt-muted','--lt-rule','--lt-footer-bg','--lt-card-rule',
  '--deck-bg','--deck-bg2','--deck-bg3','--dk-text','--dk-muted','--deck-rule','--deck-border',
  '--kn-ink','--kn-paper','--cover-bg','--W','--H',
];

// Collect --token: value pairs declared inside the :root{} block only,
// ignoring comments. Returns Map(name → trimmed value).
function tokensInRoot(css) {
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const m = noComments.match(/:root\s*\{([\s\S]*?)\}/);
  const out = new Map();
  if (!m) return out;
  for (const decl of m[1].split(';')) {
    const kv = decl.match(/^\s*(--[a-z0-9-]+)\s*:\s*([\s\S]*)$/i);
    if (kv) out.set(kv[1], kv[2].trim());
  }
  return out;
}

// Pack CSS is inlined verbatim into a <style> element and rendered by Chrome.
// A stray "</style>" would break out into markup, so reject it defensively —
// packs can come from untrusted sources.
function assertNoStyleBreakout(css, label) {
  if (/<\/style/i.test(css) || /<script/i.test(css)) {
    die(`${label} contains a "</style>" or "<script" sequence — refusing to inline untrusted markup`);
  }
}

// WCAG relative-luminance contrast for the pack lint. Only lints values that
// parse as flat colors (hex / rgb) — gradients and exotic notations are skipped,
// not failed, because we cannot judge what we cannot parse.
function parseColor(v) {
  const s = String(v ?? '').trim();
  let m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return [+m[1], +m[2], +m[3]];
  return null;
}
function contrastRatio(a, b) {
  const lum = (rgb) => {
    const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function loadPack(dir) {
  const pj = path.join(dir, 'pack.json');
  if (!fs.existsSync(pj)) die(`pack has no pack.json: ${dir}`);
  let meta;
  try { meta = JSON.parse(fs.readFileSync(pj, 'utf8')); }
  catch (e) { die(`pack.json is not valid JSON (${e.message}): ${pj}`); }
  if (meta.schema !== 1) die(`pack.json schema must be 1: ${pj}`);
  if (meta.layouts !== 'self' && meta.layouts !== 'shared') {
    die(`pack.json layouts must be "self" or "shared" (got ${JSON.stringify(meta.layouts)}): ${pj}`);
  }
  const layoutsMode = meta.layouts;
  // required files
  const isRegularFile = (p) => { try { return fs.statSync(p).isFile(); } catch { return false; } };
  const tokensPath = path.join(dir, 'tokens.css');
  const fontsPath = path.join(dir, 'fonts.json');
  const notesPath = path.join(dir, 'style-notes.md');
  for (const req of [tokensPath, fontsPath, notesPath]) {
    if (!isRegularFile(req)) die(`pack missing required file ${path.basename(req)} (must be a regular file): ${dir}`);
  }
  // richPromotion packs must carry the promotion assets AND their own layouts —
  // the shared neutral layouts.css styles only the baseline + keynote families,
  // so promoting against it produces unstyled slides.
  if (meta.richPromotion) {
    if (layoutsMode !== 'self') die(`pack.json richPromotion:true requires layouts:"self" (shared layouts cover only the baseline family): ${pj}`);
    for (const f of ['template.html', 'layout-catalog.md']) {
      if (!isRegularFile(path.join(dir, f))) die(`pack.json richPromotion:true but missing ${f}: ${dir}`);
    }
  }
  const tokensCss = fs.readFileSync(tokensPath, 'utf8');
  // validate the token contract against :root only — names present AND non-empty
  const declared = tokensInRoot(tokensCss);
  const missing = REQUIRED_TOKENS.filter(t => !declared.has(t) || declared.get(t) === '');
  if (missing.length) die(`pack tokens.css is missing/empty required tokens (${missing.join(', ')}): ${tokensPath}`);
  // contrast lint on the core text/background pairs — a pack that passes the
  // token contract but renders unreadable text is still a broken pack
  const CONTRAST_PAIRS = [['--lt-text', '--lt-bg'], ['--dk-text', '--deck-bg'], ['--kn-paper', '--kn-ink']];
  for (const [fg, bg] of CONTRAST_PAIRS) {
    const f = parseColor(declared.get(fg)), b = parseColor(declared.get(bg));
    if (f && b) {
      const ratio = contrastRatio(f, b);
      if (ratio < 4.5) die(`pack fails contrast: ${fg} on ${bg} is ${ratio.toFixed(2)}:1 (minimum 4.5:1): ${tokensPath}`);
    }
  }
  // resolve layouts.css: own, or the bundled neutral shared copy
  let layoutsPath;
  if (layoutsMode === 'self') {
    layoutsPath = path.join(dir, 'layouts.css');
    if (!fs.existsSync(layoutsPath)) die(`pack declares layouts:"self" but has no layouts.css: ${dir}`);
  } else {
    layoutsPath = path.join(bundledNeutralDir(), 'layouts.css');
    if (!fs.existsSync(layoutsPath)) die(`pack declares layouts:"shared" but the bundled neutral layouts.css is missing`);
  }
  const layoutsCss = fs.readFileSync(layoutsPath, 'utf8');
  assertNoStyleBreakout(tokensCss, `pack tokens.css (${tokensPath})`);
  assertNoStyleBreakout(layoutsCss, `layouts.css (${layoutsPath})`);
  // class-coverage lint: every class the promotion template uses must have at
  // least one CSS rule in the pack, or promoted slides render unstyled
  if (meta.richPromotion) {
    const tpl = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');
    const classes = new Set();
    for (const m of tpl.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach(c => c && classes.add(c));
    const css = tokensCss + '\n' + layoutsCss;
    const uncovered = [...classes].filter(c => !css.includes('.' + c));
    if (uncovered.length) die(`richPromotion template.html uses classes with no CSS rule in the pack (${uncovered.join(', ')}): ${dir}`);
  }
  // fonts
  let fontsSpec;
  try { fontsSpec = JSON.parse(fs.readFileSync(fontsPath, 'utf8')); }
  catch (e) { die(`fonts.json is not valid JSON (${e.message}): ${fontsPath}`); }
  const families = Array.isArray(fontsSpec.families) ? fontsSpec.families : [];
  return {
    dir, tokensCss, layoutsCss, families,
    brand: meta.brand ?? '', sublabel: meta.sublabel ?? '',
    richPromotion: !!meta.richPromotion,
  };
}

const pack = loadPack(resolvePack(styleFlag));
if (cliBrand == null) brand = pack.brand;
if (cliSublabel == null) sublabel = pack.sublabel;

// ── parse markdown ──
const raw = fs.readFileSync(input, 'utf8').replace(/\r\n/g, '\n');

const { meta, body, slides } = parseDeck(raw);
if (cliMode != null) meta.mode = cliMode;
if (meta.mode && !['boardroom', 'keynote'].includes(meta.mode.toLowerCase())) {
  console.error('[input] mode must be boardroom or keynote'); process.exit(1);
}
// Body-only NE output has no YAML; keep its audience-facing deck title.
if (!meta.title) meta.title = body.match(/^#\s+(.+)$/m)?.[1] || baseName;
// deck frontmatter `sublabel` names the client / project / talk in the footer slot;
// precedence: --sublabel CLI > deck frontmatter > pack.json
if (cliSublabel == null && typeof meta.sublabel === 'string' && meta.sublabel.trim()) sublabel = meta.sublabel.trim();

if (!slides.length) { console.error('[input] no slides found'); process.exit(1); }

// ── font fetching + base64 (pack-driven) ──
// A pack's fonts.json declares families with one of three sources:
//   google : fetched from the Google Fonts CSS API (latin woff2 per weight)
//   url    : an explicit remote woff2 per face
//   local  : a woff2 file on disk (pack-relative or absolute)
// Each unique remote file is cached once under ~/.claude/cache/fonts, keyed by
// a hash of its URL (not its basename — two packs may both ship "font.woff2").
// Values are sanitised before they reach the output CSS.

function httpGet(url, { responseType = 'text', redirects = 0, deadlineAt = null, maxBytes = FETCH_MAX_BYTES } = {}) {
  // One hard wall-clock ceiling for the WHOLE fetch, preserved across redirects.
  const absDeadline = deadlineAt ?? (nowMs() + FETCH_DEADLINE_MS);
  return new Promise((resolve, reject) => {
    let u;
    try { u = new URL(url); } catch { return reject(new Error(`bad URL: ${url}`)); }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      return reject(new Error(`refusing non-http(s) URL: ${url}`));
    }
    if (isBlockedHost(u.hostname)) {
      return reject(new Error(`refusing request to blocked host ${u.hostname} (SSRF guard)`));
    }
    const remaining = absDeadline - nowMs();
    if (remaining <= 0) return reject(new Error(`hard deadline exceeded before ${url}`));
    const mod = u.protocol === 'http:' ? http : https;
    const headers = {
      // Chrome UA so Google returns woff2 (older UAs get ttf/woff fallback).
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    };
    let settled = false;
    let req;
    const finish = (fn, arg) => { if (settled) return; settled = true; clearTimeout(timer); fn(arg); };
    const timer = setTimeout(() => { try { req && req.destroy(); } catch {} finish(reject, new Error(`hard deadline ${FETCH_DEADLINE_MS}ms exceeded for ${url}`)); }, remaining);
    req = mod.get(url, { headers, timeout: FETCH_TIMEOUT_MS }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        res.destroy(); // don't drain a redirect body — it could stream forever
        if (redirects >= FETCH_MAX_REDIRECTS) { finish(reject, new Error(`too many redirects for ${url}`)); return; }
        const loc = res.headers.location;
        if (!loc) { finish(reject, new Error(`redirect with no location for ${url}`)); return; }
        clearTimeout(timer); settled = true; // hand the same absDeadline to the next hop
        resolve(httpGet(new URL(loc, u).toString(), { responseType, redirects: redirects + 1, deadlineAt: absDeadline, maxBytes }));
        return;
      }
      if (res.statusCode !== 200) { res.destroy(); finish(reject, new Error(`HTTP ${res.statusCode} for ${url}`)); return; }
      const chunks = []; let total = 0;
      res.on('data', c => {
        total += c.length;
        if (total > maxBytes) { req.destroy(new Error(`response exceeded ${maxBytes} bytes for ${url}`)); return; }
        chunks.push(c);
      });
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        finish(resolve, responseType === 'buffer' ? buf : buf.toString('utf8'));
      });
      res.on('error', e => finish(reject, e));
    });
    req.on('timeout', () => req.destroy(new Error(`timeout after ${FETCH_TIMEOUT_MS}ms for ${url}`)));
    req.on('error', e => finish(reject, e));
  });
}

function parseFontFaces(css) {
  // Match each @font-face block, capture family / weight / src URL.
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) || [];
  const out = [];
  for (const blk of blocks) {
    const fam = (blk.match(/font-family:\s*['"]([^'"]+)['"]/) || [])[1];
    const wt  = (blk.match(/font-weight:\s*(\d+)/) || [])[1];
    const url = (blk.match(/url\((https:\/\/[^)]+\.woff2)\)/) || [])[1];
    // Google Fonts emits multiple @font-face per weight, one per unicode subset.
    // The latin block has range starting with U+0000 — we want that one.
    const unicode = (blk.match(/unicode-range:\s*([^;]+);/) || [])[1] || '';
    if (fam && wt && url && /U\+0000-00FF/i.test(unicode)) {
      out.push({ family: fam, weight: +wt, style: 'normal', url, source: 'google' });
    }
  }
  return out;
}

// Reject font-family names that could break out of the @font-face declaration.
function safeFamily(name) {
  const s = String(name ?? '');
  if (/[}{<>"';\n\r]/.test(s)) throw new Error(`unsafe font-family value: ${JSON.stringify(s)}`);
  return s;
}

function hashKey(s, ext = '.woff2') { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 20) + ext; }

// Resolve `rel` under `dir`, following symlinks, and return the real path only if
// it is a REGULAR FILE contained within the real `dir` (segment boundary, so
// `../` and symlink escapes are rejected but legit names like `..font.woff2`
// are allowed). Returns null otherwise. Prevents arbitrary local-file disclosure.
function confinedRealFile(dir, rel) {
  try {
    const rootReal = fs.realpathSync(dir);
    const cand = path.resolve(dir, rel);
    const candReal = fs.realpathSync(cand);
    const within = candReal === rootReal || candReal.startsWith(rootReal + path.sep);
    if (!within) return null;
    return fs.statSync(candReal).isFile() ? candReal : null;
  } catch { return null; }
}

// Coerce a font-weight to a safe integer for CSS interpolation.
function safeWeight(w) {
  const n = Number.parseInt(w, 10);
  return Number.isInteger(n) && n >= 1 && n <= 1000 ? n : 400;
}
function safeStyle(s) { return String(s).toLowerCase() === 'italic' ? 'italic' : 'normal'; }
// Google urlName must be alnum + '+' (e.g. "Playfair+Display"); normalise
// spaces to '+' and reject anything that could inject into the query string.
function safeGoogleName(name) {
  const s = String(name ?? '').trim().replace(/ /g, '+');
  return /^[A-Za-z0-9+]+$/.test(s) ? s : null;
}

// Resolve a pack's families into concrete faces: {family, weight, style, source, url?|path?}.
let _resolvedFaces = null;
async function resolveFaces() {
  if (_resolvedFaces) return _resolvedFaces;
  const faces = [];
  const googles = pack.families.filter(f => f.source === 'google');
  if (googles.length) {
    const parts = [];
    for (const f of googles) {
      const gn = safeGoogleName(f.urlName);
      if (!gn) { process.stderr.write(`[fonts] WARN: skipping google family with unsafe urlName ${JSON.stringify(f.urlName)}\n`); continue; }
      const wts = (f.weights || [400]).map(safeWeight).sort((a, b) => a - b);
      parts.push(`family=${gn}:wght@${wts.join(';')}`);
    }
    if (parts.length) {
      const cssUrl = `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
      try {
        const css = await httpGet(cssUrl);
        faces.push(...parseFontFaces(css));
      } catch (e) {
        process.stderr.write(`[fonts] WARN: could not resolve Google Fonts CSS (${e.message}). Falling back to system fonts for google families.\n`);
      }
    }
  }
  for (const f of pack.families) {
    if (f.source === 'url') {
      for (const face of (f.faces || [])) {
        if (face.url) faces.push({ family: f.name, weight: safeWeight(face.weight), style: safeStyle(face.style), url: face.url, source: 'url' });
      }
    } else if (f.source === 'local') {
      for (const face of (f.faces || [])) {
        if (!face.path) continue;
        const real = confinedRealFile(pack.dir, face.path);
        if (!real) {
          process.stderr.write(`[fonts] WARN: skipping local font not confined to a regular file inside the pack: ${face.path}\n`);
          continue;
        }
        faces.push({ family: f.name, weight: safeWeight(face.weight), style: safeStyle(face.style), path: real, source: 'local' });
      }
    }
  }
  if (faces.length > FETCH_MAX_FACES) {
    die(`pack declares ${faces.length} font faces — exceeds the cap of ${FETCH_MAX_FACES}`);
  }
  _resolvedFaces = faces;
  return faces;
}

// A stable identity + cache location for a face's bytes.
function faceRef(f) {
  if (f.source === 'local') return { id: 'local:' + f.path, file: f.path, remote: false };
  const file = path.join(FONT_CACHE, hashKey(f.url));
  return { id: f.url, file, remote: true };
}

async function ensureFonts() {
  const faces = await resolveFaces();
  const seen = new Set();
  for (const f of faces) {
    const ref = faceRef(f);
    if (seen.has(ref.id)) continue;
    seen.add(ref.id);
    if (!ref.remote) {
      if (!fs.existsSync(ref.file)) process.stderr.write(`[fonts] WARN: local font missing: ${ref.file}\n`);
      continue;
    }
    if (fs.existsSync(ref.file) && fs.statSync(ref.file).size > 0) continue;
    process.stderr.write(`[fonts] fetching ${path.basename(ref.file)} (${f.family} ${f.weight})…\n`);
    try {
      const buf = await httpGet(f.url, { responseType: 'buffer' });
      // atomic: write a unique tmp then rename, so a partial/failed write never
      // poisons the cache with a truncated file that later reads treat as valid.
      const tmp = `${ref.file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, buf);
      fs.renameSync(tmp, ref.file);
    } catch (e) {
      process.stderr.write(`[fonts] WARN: fetch failed for ${f.family} ${f.weight} (${e.message}).\n`);
    }
  }
}

async function buildFontCss() {
  const faces = await resolveFaces();
  // Group weights by (family, byte-source) so each unique file is inlined once,
  // declared with the span of weights that map to it.
  const groups = new Map();
  for (const f of faces) {
    const ref = faceRef(f);
    const style = f.style || 'normal';
    const key = `${f.family}::${style}::${ref.id}`;
    if (!groups.has(key)) groups.set(key, { family: f.family, style, file: ref.file, weights: [] });
    groups.get(key).weights.push(f.weight);
  }
  const out = [];
  for (const g of groups.values()) {
    if (!fs.existsSync(g.file) || fs.statSync(g.file).size === 0) continue;
    const b64 = fs.readFileSync(g.file).toString('base64');
    const wts = g.weights.slice().sort((a, b) => a - b);
    const wtSpec = wts.length === 1 ? String(wts[0]) : `${wts[0]} ${wts[wts.length - 1]}`;
    out.push(`@font-face{font-family:'${safeFamily(g.family)}';font-style:${g.style === 'italic' ? 'italic' : 'normal'};font-weight:${wtSpec};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`);
  }
  return out.join('\n');
}


// ── image inlining ──
// Images were the one asset class not embedded: a remote URL that misses
// Chrome's virtual-time budget, or a file that moves after render, exported as
// a blank gray field. Inline everything, same policy as fonts. Failure → ''
// (the keynote placeholder), never a dead URL.
const IMG_MIME = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml',
};
function mimeFor(p) { return IMG_MIME[path.extname(String(p)).toLowerCase()] || null; }

const VIDEO_EXT = /\.(mp4|webm|mov)$/i;
async function inlineImage(src) {
  const v = String(src ?? '').trim();
  if (!v || v.startsWith('data:')) return v;
  if (/^https?:\/\//i.test(v)) {
    let ext = '.jpg';
    try { ext = (new URL(v).pathname.match(/\.[a-z0-9]+$/i) || ['.jpg'])[0].toLowerCase(); } catch {}
    const mime = mimeFor('x' + ext) || 'image/jpeg';
    const file = path.join(IMG_CACHE, hashKey(v, IMG_MIME[ext] ? ext : '.jpg'));
    try {
      if (!fs.existsSync(file) || fs.statSync(file).size === 0) {
        process.stderr.write(`[img] fetching ${v}\n`);
        const buf = await httpGet(v, { responseType: 'buffer', maxBytes: IMG_MAX_BYTES });
        const tmp = `${file}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, buf);
        fs.renameSync(tmp, file);
      }
      return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
    } catch (e) {
      process.stderr.write(`[img] WARN: fetch failed for ${v} (${e.message}) — slide falls back to the placeholder\n`);
      return '';
    }
  }
  // local path — resolve relative to the input markdown's directory
  const p = path.isAbsolute(v) ? v : path.resolve(path.dirname(input), v);
  // video is referenced, never inlined (base64 video would bloat the file); path relative to the output dir
  if (VIDEO_EXT.test(p)) return path.relative(outDir, p) || path.basename(p);
  const mime = mimeFor(p);
  if (!mime) { process.stderr.write(`[img] WARN: unrecognised image type, leaving as-is: ${v}\n`); return v; }
  try {
    const b = fs.readFileSync(p);
    if (b.length > IMG_MAX_BYTES) {
      process.stderr.write(`[img] WARN: ${v} is ${(b.length / 1048576).toFixed(1)}MB (cap ${(IMG_MAX_BYTES / 1048576).toFixed(0)}MB) — referencing by file URL instead\n`);
      return 'file://' + p;
    }
    return `data:${mime};base64,${b.toString('base64')}`;
  } catch {
    process.stderr.write(`[img] WARN: image not found: ${p} — slide falls back to the placeholder\n`);
    return '';
  }
}

async function inlineAllImages(meta, slides) {
  meta.cover_image = await inlineImage(meta.cover_image || meta.image || '');
  for (const s of slides) s.image = await inlineImage(s.image);
  // triptych frames: art line "three dated frames: a.jpg / b.jpg / c.jpg. Subtitle: ..." (igs pack, keynote hint `triptych`)
  for (const s of slides) {
    const m = /(?:three dated|two) frames:\s*(.+?)(?=\.\s|$)(?:\.\s*Subtitle:\s*(.+))?/i.exec(s.art || '');
    if (m) {
      s.frames = await Promise.all(m[1].split('/').map(f => inlineImage(f.trim())));
      s.subtitle = (m[2] || '').trim();
    }
  }
}

// ── HTML generation ──
function esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

// Join non-empty label parts with a middot — avoids orphan separators when a
// pack leaves brand/sublabel empty (the neutral default).
function midJoin(parts) { return parts.filter(p => p && String(p).trim()).map(esc).join(' &middot; '); }

// Sanitise a value used inside a CSS url('...'): reject quotes, parens,
// backslash, angle brackets, and whitespace/newlines that could break out of
// the declaration. Returns '' (→ placeholder) if the value is unsafe.
function cssUrl(s) {
  const v = String(s ?? '').trim();
  return /['"()\\\n\r\t<>]/.test(v) ? '' : v;
}

// Inline-markdown for bullets and other content where the user expects
// **bold** and *italic* to render. esc() is run first to neutralise HTML
// from the input, then the bold/italic markers are converted to tags.
function escMd(s) {
  return esc(s)
    .replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
}

function renderCover(meta, pageno) {
  const subtitle = meta.subtitle || meta.dramatic_question || '';
  return `
<div class="slide-wrap"><div class="slide dk">
  <div class="cover-bg"></div>
  <div class="cover" style="position:relative;z-index:2;">
    ${meta.eyebrow ? `<span class="eyebrow">${esc(meta.eyebrow)}</span>` : ''}
    <div class="wm">${esc(meta.title || 'Untitled')}</div>
    ${subtitle ? `<div class="wm-sub">${esc(subtitle)}</div>` : ''}
    <div class="meta">${midJoin([brand, sublabel])}</div>
  </div>
  <div class="footer"><span class="brand">${esc(brand)}<span class="sub">${esc(sublabel)}</span></span><span class="pageno">${String(pageno).padStart(2,'0')}</span></div>
</div></div>`;
}

function renderClosing(slide, pageno, punchline) {
  return `
<div class="slide-wrap"><div class="slide dk">
  <div class="content no-head" style="justify-content:center;">
    <div class="wm" style="font-family:var(--wordmark);font-weight:500;letter-spacing:0;font-size:112px;color:var(--dk-text);">${esc(brand)}</div>
    <div class="title-rule" style="margin:24px 0;"></div>
    <p class="h-accent" style="max-width:1400px;">${esc(slide.title || punchline || '')}</p>
    ${slide.bullets.length ? `<p class="body" style="margin-top:24px;color:var(--dk-muted);max-width:1100px;">${esc(slide.bullets.join(' · '))}</p>` : ''}
  </div>
  ${slide.speakerNote ? `<div class="speaker-note">${esc(slide.speakerNote)}</div>` : ''}
  <div class="footer"><span class="brand">${esc(brand)}<span class="sub">${esc(sublabel)}</span></span><span class="pageno">${String(pageno).padStart(2,'0')}</span></div>
</div></div>`;
}

function renderEditorial(slide, pageno, sectionLabel) {
  const noBullets = slide.bullets.length === 0;
  const dense = slide.bullets.length >= 4;
  // body-list with em-dash markers
  const bulletHtml = slide.bullets.length
    ? `<ul class="body-list">${slide.bullets.map(b => `<li>${escMd(b)}</li>`).join('')}</ul>`
    : '';
  const titleSize = noBullets ? 'h1' : 'h2';
  return `
<div class="slide-wrap"><div class="slide lt">
  <div class="header-bar">
    ${(() => { const l = esc(sectionLabel || brand), r = esc(sublabel); return [
      l ? `<span class="header-sec">${l}</span>` : '',
      (l && r) ? '<span class="header-dot"></span>' : '',
      r ? `<span class="header-sec" style="color:var(--lt-muted);">${r}</span>` : '',
    ].join(''); })()}
  </div>
  <div class="content">
    <div class="content-header">
      <h2 class="${titleSize}" style="max-width:1500px;">${esc(slide.title)}</h2>
      <div class="title-rule"></div>
    </div>
    <div class="col-body" style="display:block;${dense ? '' : 'align-items:flex-start;'}">
      ${bulletHtml}
    </div>
  </div>
  ${slide.speakerNote ? `<div class="speaker-note">${esc(slide.speakerNote)}</div>` : ''}
  <div class="footer"><span class="brand">${esc(brand)}<span class="sub">${esc(sublabel)}</span></span><span class="pageno">${String(pageno).padStart(2,'0')}</span></div>
</div></div>`;
}

function renderVerdict(slide, pageno) {
  return `
<div class="slide-wrap"><div class="slide dk">
  <div class="content no-head" style="justify-content:center;">
    <h2 class="h-verdict" style="max-width:1600px;">${esc(slide.title)}</h2>
    ${slide.bullets.length ? `<p class="lead" style="margin-top:30px;max-width:1200px;color:var(--accent-light);">${esc(slide.bullets.join(' · '))}</p>` : ''}
  </div>
  ${slide.speakerNote ? `<div class="speaker-note">${esc(slide.speakerNote)}</div>` : ''}
  <div class="footer"><span class="brand">${esc(brand)}<span class="sub">${esc(sublabel)}</span></span><span class="pageno">${String(pageno).padStart(2,'0')}</span></div>
</div></div>`;
}

// ── Keynote renderers ──
function knPlaceholder(note) {
  return `<div class="kn-placeholder"><div class="lbl"><strong>Image needed</strong>${esc(note || 'Full-bleed image')}</div></div>`;
}
function knBg(slide) {
  if (VIDEO_EXT.test(String(slide.image || ''))) {
    // muted + playsinline so autoplay is allowed; the show-mode script restarts it when its slide appears
    return `<video class="kn-bg" src="${esc(slide.image)}" autoplay muted loop playsinline preload="auto"></video>`;
  }
  const src = cssUrl(slide.image);
  return src
    ? `<div class="kn-bg" style="background-image:url('${src}')"></div>`
    : knPlaceholder(slide.art || slide.title);
}
function knPageno(pageno) {
  // running foot (deck sublabel) + folio; packs style or hide either. Emitted only when a sublabel exists.
  const foot = sublabel ? `<div class="kn-sub">${esc(sublabel)}</div>` : '';
  return `${foot}<div class="kn-pageno">${String(pageno).padStart(2, '0')}</div>`;
}
function knNote(slide) {
  const bits = [];
  if (slide.art) bits.push('Art: ' + slide.art);
  if (slide.speakerNote) bits.push(slide.speakerNote);
  return bits.length ? `<div class="speaker-note">${esc(bits.join(' — '))}</div>` : '';
}

function renderKnCover(meta, pageno) {
  const img = cssUrl(meta.cover_image || meta.image || '');
  const subtitle = meta.subtitle || meta.dramatic_question || '';
  const bg = img ? `<div class="kn-bg" style="background-image:url('${img}')"></div>` : knPlaceholder('Cover full-bleed image');
  return `
<div class="slide-wrap"><div class="slide kn">
  ${bg}
  <div class="kn-scrim soft"></div>
  <div class="kn-cover-box">
    <div class="kn-cover-title">${esc(meta.title || 'Untitled')}</div>
    ${subtitle ? `<div class="kn-cover-sub">${esc(subtitle)}</div>` : ''}
    <div class="kn-cover-meta">${midJoin([brand, sublabel])}</div>
  </div>
  ${knPageno(pageno)}
</div></div>`;
}

function renderKnFullbleed(slide, pageno, cls) {
  const capClass = cls.split(' ').includes('dark') ? 'kn-caption dark' : 'kn-caption';
  const cap = slide.title ? `<div class="${capClass}">${escMd(slide.title)}</div>` : '';
  const sub = slide.bullets.length ? `<div class="kn-subcap">${slide.bullets.map(escMd).join(' &middot; ')}</div>` : '';
  const wrap = (cap || sub) ? `<div class="kn-capwrap">${cap}${sub}</div>` : '';
  return `
<div class="slide-wrap"><div class="slide ${cls}">
  ${knBg(slide)}
  <div class="kn-scrim"></div>
  ${wrap}
  ${knNote(slide)}
  ${knPageno(pageno)}
</div></div>`;
}

// triptych: three dated 4:3 frames, title and one-line subtitle above (pack text-family scaffold 28, emitted from markdown)
function renderKnTriptych(slide, pageno, extra = '') {
  const frames = (slide.frames || []);
  const n = extra ? 2 : 3;
  const cells = Array.from({ length: n }, (_, i) => slide.bullets[i] || '').map((b, i) => {
    const [year, ...rest] = b.split(/\s+[·•]\s+/);
    const img = frames[i] ? `<img src="${frames[i]}" alt="">` : '';
    const meta = b ? `<div class="year">${escMd(year)}</div><div class="label">${escMd(rest.join(' · ') || '')}</div>` : '';
    return `<div class="frame"><figure>${img}</figure>${meta}</div>`;
  }).join('');
  const lede = slide.subtitle ? `<p class="lede">${escMd(slide.subtitle)}</p>` : '';
  return `
<div class="slide-wrap"><div class="slide lt" data-layout="${extra ? 'pair' : 'triptych'}">
  <div class="content">
    ${slide.title ? `<div class="content-header"><h2 class="h2">${escMd(slide.title)}</h2><div class="title-rule"></div>${lede}</div>` : ''}
    <div class="tri${extra ? " " + extra : ""}">${cells}</div>
  </div>
  ${knNote(slide)}
  <div class="footer"><span class="brand">${esc(brand)}<span class="sub">${esc(sublabel)}</span></span><span class="pageno">${String(pageno).padStart(2,'0')}</span></div>
</div></div>`;
}

// verdict: dark, the claim set large, one volt subline (pack text-family scaffold 08, emitted from markdown)
function renderKnVerdict(slide, pageno) {
  const lead = slide.bullets.length ? `<p class="lead" style="margin-top:30px;color:var(--accent-light);">${escMd(slide.bullets[0])}</p>` : '';
  return `
<div class="slide-wrap"><div class="slide dk" data-layout="verdict">
  <div class="content no-head" style="justify-content:center;">
    <h2 class="h-verdict">${escMd(slide.title)}</h2>
    ${lead}
  </div>
  ${knNote(slide)}
  <div class="footer"><span class="brand">${esc(brand)}<span class="sub">${esc(sublabel)}</span></span><span class="pageno">${String(pageno).padStart(2,'0')}</span></div>
</div></div>`;
}

function renderKnWordless(slide, pageno, cls) {
  return `
<div class="slide-wrap"><div class="slide ${cls}">
  ${knBg(slide)}
  ${knNote(slide)}
  ${knPageno(pageno)}
</div></div>`;
}

function renderKnOneWord(slide, pageno, cls) {
  return `
<div class="slide-wrap"><div class="slide ${cls}">
  <div class="kn-black"></div>
  <div class="kn-word">${escMd(slide.title)}</div>
  ${knNote(slide)}
  ${knPageno(pageno)}
</div></div>`;
}

function renderKnNumber(slide, pageno, cls) {
  const bg = slide.image
    ? `${knBg(slide)}<div class="kn-scrim" style="background:rgba(0,0,0,.45);"></div>`
    : `<div class="kn-black"></div>`;
  return `
<div class="slide-wrap"><div class="slide ${cls}">
  ${bg}
  <div class="kn-number">${escMd(slide.title)}</div>
  ${knNote(slide)}
  ${knPageno(pageno)}
</div></div>`;
}

// keynote layout hint resolution — modifier pass-through with alias map.
// The hint is split on whitespace: the first word resolves against the
// allowlist (through a small alias map), every remaining word is validated
// as a simple class token and added to the .slide element's class list so a
// pack can style it. Unknown first words fall to the heuristic picker with a
// one-line warning naming the slide and the hint.
const KN_ALLOWLIST = ['text', 'fullbleed', 'caption-dark', 'motif', 'wordless', 'oneword', 'number', 'cover', 'object', 'triptych', 'pair', 'verdict'];
const KN_ALIASES = {
  'caption-dark': { layout: 'fullbleed', classes: ['dark'] },
  'object':       { layout: 'fullbleed', classes: ['object'] },
};

function resolveKnHint(slide, pageno) {
  const hint = (slide.layout || '').trim();
  const words = hint ? hint.split(/\s+/) : [];
  let layout = '';
  const classes = [];
  if (words.length) {
    const first = words[0];
    if (KN_ALLOWLIST.includes(first)) {
      if (first === 'motif') layout = 'fullbleed';          // motif renders as fullbleed
      else if (KN_ALIASES[first]) { layout = KN_ALIASES[first].layout; classes.push(...KN_ALIASES[first].classes); }
      else layout = first;                                   // 'cover' is handled separately upstream
    } else {
      process.stderr.write(`[layout] WARN: slide ${pageno}: unknown layout hint "${hint}" — falling back to the heuristic picker\n`);
    }
    for (const w of words.slice(1)) {
      if (/^[a-z][a-z0-9-]*$/.test(w)) classes.push(w);
      else process.stderr.write(`[layout] WARN: slide ${pageno}: ignoring invalid class token "${w}" in hint "${hint}"\n`);
    }
  }
  return { layout, classes };
}

// keynote layout picker — heuristic half only (no hint, or unknown hint)
function pickKnLayout(slide) {
  const t = (slide.title || '').trim();
  if (!t) return slide.bullets.length ? 'fullbleed' : 'wordless';
  const words = t.split(/\s+/).length;
  // giant number: short title carrying a prominent numeral
  if (slide.bullets.length === 0 && words <= 3 && /\d/.test(t) && /[\$€£]?\d[\d,\.]*\s*(%|bn|billion|million|m|k)?\b/i.test(t)) return 'number';
  if (words <= 2 && slide.bullets.length === 0) return 'oneword';
  // a light image drowns the default white caption box — flip to the dark box
  if (/\b(light|bright|white|pale|overexposed|snow|fog|daylit|sunlit)\b/i.test(slide.art || '')) return 'caption-dark';
  return 'fullbleed';
}

function renderKnSlide(slide, pageno) {
  const { layout: hintLayout, classes } = resolveKnHint(slide, pageno);
  let layout = hintLayout || pickKnLayout(slide);
  // Explicit hints must preserve the same content as automatic layouts.
  const capacities = {number: 0, oneword: 0, wordless: 0, verdict: 1, pair: 2, triptych: 3};
  if ((layout === 'wordless' && slide.title) || slide.bullets.length > (capacities[layout] ?? Infinity)
      || (slide.image && ['text', 'oneword', 'verdict', 'pair', 'triptych'].includes(layout))) {
    process.stderr.write(`[layout] WARN: slide ${pageno}: ${layout} would omit content; using fullbleed to preserve it.\n`);
    layout = 'fullbleed';
    classes.length = 0;
  }
  const clsList = ['kn', ...classes];
  if (layout === 'caption-dark') {           // one code path: fullbleed + dark class
    layout = 'fullbleed';
    if (!clsList.includes('dark')) clsList.push('dark');
  }
  const cls = clsList.join(' ');
  switch (layout) {
    case 'text': return renderEditorial(slide, pageno, '');
    case 'wordless': return renderKnWordless(slide, pageno, cls);
    case 'oneword':  return renderKnOneWord(slide, pageno, cls);
    case 'number':   return renderKnNumber(slide, pageno, cls);
    case 'triptych': return renderKnTriptych(slide, pageno);
    case 'pair':     return renderKnTriptych(slide, pageno, 'two contain');
    case 'verdict':  return renderKnVerdict(slide, pageno);
    default:         return renderKnFullbleed(slide, pageno, cls);
  }
}

// pick a layout heuristically
function pickLayout(slide, idx, total, punchline) {
  if (idx === 0) return 'cover';
  if (idx === total - 1) {
    // closing if the last title matches punchline or contains it strongly
    if (punchline && (slide.title.toLowerCase() === punchline.toLowerCase() ||
        punchline.toLowerCase().includes(slide.title.toLowerCase().split(/[\s\.\,]/)[0]))) {
      return 'closing';
    }
    return 'closing';
  }
  // verdict for very short, bold, no-body slides that read as a punch line
  const words = slide.title.split(/\s+/).length;
  if (slide.bullets.length === 0 && words <= 6) return 'verdict';
  return 'editorial';
}

function identifySlide(html, slide) {
  return slide.id ? html.replace('class="slide-wrap"', `class="slide-wrap" data-slide-id="${esc(slide.id)}"`) : html;
}

function buildHtml(meta, slides, fontCss) {
  const punchline = meta.punchline || '';
  const keynote = (meta.mode || '').toLowerCase() === 'keynote';
  let html = '';
  if (keynote) {
    // Keynote mode: image-led family. Cover from frontmatter, then one keynote slide each.
    if (includeCover) html += renderKnCover(meta, 1);
    slides.forEach((s, i) => { html += identifySlide(renderKnSlide(s, i + (includeCover ? 2 : 1)), s); });
  } else {
    // Boardroom mode: text layouts from the active pack.
    if (includeCover) html += renderCover(meta, 1);
    slides.forEach((s, i) => {
      const pageno = i + (includeCover ? 2 : 1);
      const layout = pickLayout(s, i, slides.length, punchline);
      if (layout === 'closing') html += identifySlide(renderClosing(s, pageno, punchline), s);
      else if (layout === 'verdict') html += identifySlide(renderVerdict(s, pageno), s);
      else html += identifySlide(renderEditorial(s, pageno, meta.eyebrow || ''), s);
    });
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="keynote-render-context" content="${esc(JSON.stringify({brand, sublabel, mode: meta.mode || 'boardroom', eyebrow: meta.eyebrow || ''}))}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(meta.title || baseName)}</title>
<style>
${fontCss}
${pack.tokensCss}
${pack.layoutsCss}
/* renderer base: video backgrounds and show mode (pack-agnostic, keep last so it wins) */
video.kn-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
body.show{background:#000;margin:0;overflow:hidden;}
body.show .slide-wrap{display:none;margin:0;box-shadow:none;}
body.show .slide-wrap.current{display:block;position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(var(--show-fit,1));transform-origin:center;zoom:1;}
body.show .show-help{position:fixed;left:0;right:0;bottom:16px;text-align:center;font:12px/1.4 -apple-system,system-ui,sans-serif;color:#8a8a8a;pointer-events:none;transition:opacity .6s;}
body.show .show-help.hidden{opacity:0;}
</style>
</head>
<body>
${html}
<script>
function fit(){var s=Math.min(1,(window.innerWidth-56)/1920);document.documentElement.style.setProperty('--fit',s);
  document.documentElement.style.setProperty('--show-fit',Math.min(window.innerWidth/1920,window.innerHeight/1080));}
fit(); addEventListener('resize',fit);
// ── show mode: one slide at a time, fullscreen, keyboard / clicker / click to advance.
//    Enter with p or f, or open the file with #present. Esc leaves. The hash (#12) tracks the slide in both modes.
(function(){
  var wraps=Array.prototype.slice.call(document.querySelectorAll('.slide-wrap'));
  if(!wraps.length) return;
  var body=document.body, cur=0, help=null;
  function clampIdx(i){return Math.max(0,Math.min(wraps.length-1,i));}
  function hashIdx(){var m=(location.hash||'').match(/^#(\\d+)/);return m?clampIdx(parseInt(m[1],10)-1):null;}
  function setHash(i,present){var h='#'+(i+1)+(present?'-present':'');if(location.hash!==h)history.replaceState(null,'',h);}
  function showSlide(i){
    cur=clampIdx(i);
    wraps.forEach(function(w,k){w.classList.toggle('current',k===cur);
      w.querySelectorAll('video').forEach(function(v){if(k===cur){try{v.currentTime=0;v.play();}catch(e){}}else{v.pause();}});});
    setHash(cur,true);
  }
  function enter(i){
    body.classList.add('show'); showSlide(i==null?cur:i);
    if(document.fullscreenEnabled&&!document.fullscreenElement){document.documentElement.requestFullscreen().catch(function(){});}
    if(!help){help=document.createElement('div');help.className='show-help';help.textContent='→ next · ← back · Esc exit';body.appendChild(help);
      setTimeout(function(){help.classList.add('hidden');},2500);}
  }
  function leave(){
    body.classList.remove('show'); wraps.forEach(function(w){w.classList.remove('current');});
    if(document.fullscreenElement){document.exitFullscreen().catch(function(){});}
    setHash(cur,false); wraps[cur].scrollIntoView({block:'center'});
  }
  function inShow(){return body.classList.contains('show');}
  addEventListener('keydown',function(e){
    if(e.metaKey||e.ctrlKey||e.altKey) return;
    var k=e.key;
    if(!inShow()){ if(k==='p'||k==='f'){e.preventDefault();enter(nearestIdx());} return; }
    if(k==='ArrowRight'||k==='ArrowDown'||k===' '||k==='PageDown'||k==='Enter'){e.preventDefault();showSlide(cur+1);}
    else if(k==='ArrowLeft'||k==='ArrowUp'||k==='PageUp'||k==='Backspace'){e.preventDefault();showSlide(cur-1);}
    else if(k==='Home'){e.preventDefault();showSlide(0);}
    else if(k==='End'){e.preventDefault();showSlide(wraps.length-1);}
    else if(k==='Escape'){e.preventDefault();leave();}
  });
  addEventListener('click',function(e){ if(inShow()&&!e.target.closest('a')) showSlide(cur+1); });
  document.addEventListener('fullscreenchange',function(){ if(!document.fullscreenElement&&inShow()) leave(); });
  function nearestIdx(){var mid=window.innerHeight/2,best=0,bd=Infinity;wraps.forEach(function(w,k){var r=w.getBoundingClientRect(),d=Math.abs((r.top+r.bottom)/2-mid);if(d<bd){bd=d;best=k;}});return best;}
  // track the scroll position in the hash while reading
  var t=null; addEventListener('scroll',function(){ if(inShow()) return; clearTimeout(t); t=setTimeout(function(){cur=nearestIdx();setHash(cur,false);},150); });
  // initial state from the hash
  var h=hashIdx();
  if(h!==null){cur=h; if(/-present$/.test(location.hash)||/#present$/.test(location.hash)) enter(cur); else wraps[cur].scrollIntoView({block:'center'});}
  else if(location.hash==='#present'){enter(0);}
})();
// overflow probe: .slide clips silently (overflow:hidden), so report any slide
// whose content exceeds the frame. exportPdf reads these console lines from
// Chrome's stderr (--enable-logging=stderr) and surfaces them as warnings.
addEventListener('load',function(){
  document.querySelectorAll('.slide').forEach(function(s,i){
    if(s.scrollHeight>s.clientHeight+1||s.scrollWidth>s.clientWidth+1){
      console.log('KN-OVERFLOW slide '+(i+1));
    }
  });
});
</script>
</body>
</html>`;
}

// ── PDF export via headless Chrome ──
function exportPdf(htmlPath, pdfPath) {
  if (!fs.existsSync(CHROME)) {
    console.error(`[pdf] Chrome not found at ${CHROME}. Skipping PDF.`);
    return false;
  }
  const url = 'file://' + htmlPath;
  const flags = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--enable-logging=stderr',
    '--virtual-time-budget=10000',
    '--run-all-compositor-stages-before-draw',
    `--print-to-pdf=${pdfPath}`,
    '--no-pdf-header-footer',
    url,
  ];
  const r = spawnSync(CHROME, flags, { encoding: 'utf8', timeout: 60_000 });
  if (r.status !== 0) {
    if (r.stderr) process.stderr.write(r.stderr);
    console.error(`[pdf] Chrome exited ${r.status}`);
    return false;
  }
  const pages = new Set();
  for (const m of (r.stderr || '').matchAll(/KN-OVERFLOW slide (\d+)/g)) pages.add(+m[1]);
  for (const n of [...pages].sort((a, b) => a - b)) {
    console.log(`[pdf]  WARN: content overflows the slide frame on page ${n} — inspect that page in the PDF`);
  }
  return true;
}

// ── main ──
(async () => {
  await ensureFonts();
  await inlineAllImages(meta, slides);
  const fontCss = await buildFontCss();
  if (!fontCss) {
    process.stderr.write('[fonts] WARN: no fonts embedded; PDF may use system fallback.\n');
  }
  const html = buildHtml(meta, slides, fontCss);
  fs.writeFileSync(htmlOut, html, 'utf8');
  console.log(`[html] ${htmlOut}  (${slides.length + Number(includeCover)} slides, ${(fs.statSync(htmlOut).size/1024).toFixed(0)}KB)`);
  if (makePdf) {
    const ok = exportPdf(htmlOut, pdfOut);
    if (ok) {
      const sz = fs.statSync(pdfOut).size;
      const kb = (sz/1024).toFixed(0);
      const slideCount = slides.length + Number(includeCover);
      console.log(`[pdf]  ${pdfOut}  (${kb}KB, ${slideCount} pages)`);
      // Chrome subsets fonts during PDF generation, so deck PDFs are smaller than
      // their A4-memo cousins. ~30KB/slide is a reasonable floor for a properly
      // font-embedded deck (covers subset glyph data + page layout).
      const expectedMin = 30 * slideCount * 1024;
      if (sz < expectedMin) {
        console.log(`[pdf]  WARN: ${kb}KB is below the expected ~${(expectedMin/1024).toFixed(0)}KB floor for ${slideCount} slides — fonts may not have embedded. Inspect the PDF.`);
      }
    }
  }
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
