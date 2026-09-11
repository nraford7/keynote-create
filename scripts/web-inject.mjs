#!/usr/bin/env node
// web-inject.mjs — meta/OG + present hint + mobile controls (plan Task 4).
//
// Injects the tested site-additions block into a (published copy of a) deck:
//   (a) meta/OG/Twitter + canonical, inserted before <title>;
//   (b) the site-additions CSS as a <style> before </head>;
//   (c) the site-additions JS before </body>.
// Every injected block is delimited with `/* site addition */` marker
// comments; a second run detects the marker and changes nothing (idempotent).
// Decks whose additions were hand-ported BEFORE this script existed carry
// different marker comments, so the marker check alone misses them; a
// behavioral-fingerprint fallback (F1, Task 8 round 1) detects already-present
// additions by what they DO and skips with a message naming the fingerprint.
//
// The CSS/JS template lives in scripts/lib/site-additions.{css,js} (ported
// verbatim from a production deck's verified site-addition blocks — the
// Adelaide reference deck) and is read at runtime — the script only ever touches meta tags,
// style and script blocks, never src/url references, so it tolerates decks
// whose optimized assets live at non-default paths (Task 3 review I-1).
//
// Usage: node scripts/web-inject.mjs <deck.html> --url <canonical> [--description <text>]
//   --url          canonical URL — REQUIRED (hard error if absent)
//   --description  meta/OG description text; defaults to the deck <title>
//                  + " — a talk by <og:site_name or footer .brand>"
//
// Prints a JSON report on stdout; exit 0 on success (including the
// idempotent no-op), exit 1 on hard errors (missing --url, unreadable deck,
// missing <title>/</head>/</body>).

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARKER = '/* site addition */';

// ── args ─────────────────────────────────────────────────────────────────────
let deckPath = null;
let url = null;
let description = null;
{
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url') url = args[++i];
    else if (args[i] === '--description') description = args[++i];
    else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Usage: node web-inject.mjs <deck.html> --url <canonical> [--description <text>]');
      process.exit(0);
    } else if (!deckPath) deckPath = path.resolve(args[i]);
    else { console.error(`web-inject: unknown arg: ${args[i]}`); process.exit(2); }
  }
}
if (!deckPath || !existsSync(deckPath)) {
  console.error('web-inject: deck HTML path required (and must exist)');
  process.exit(1);
}
if (!url) {
  console.error('web-inject: --url <canonical> is required (canonical/og:url have no safe default)');
  process.exit(1);
}

// ── read deck + templates ────────────────────────────────────────────────────
const html = readFileSync(deckPath, 'utf8');
let cssTemplate, jsTemplate;
try {
  cssTemplate = readFileSync(path.join(HERE, 'lib', 'site-additions.css'), 'utf8');
  jsTemplate = readFileSync(path.join(HERE, 'lib', 'site-additions.js'), 'utf8');
} catch (e) {
  console.error(`web-inject: cannot read site-additions template: ${e.message}`);
  process.exit(1);
}

// ── idempotence: marker present → no-op (primary, fast path) ──────────────
if (html.includes(MARKER)) {
  console.log(JSON.stringify({ injected: false, reason: 'site addition marker already present', deck: deckPath }, null, 2));
  process.exit(0);
}

// ── idempotence fallback: behavioral fingerprints of hand-ported additions ──
// (a) a CSS rule for any of the additions' fixed controls,
// (b) a synthetic keydown dispatch paired with present-btn in one script
//     block, (c) an og:title meta already in <head>. Any hit → skip, saying
//     what was detected (idempotence must not be a silent no-op).
const fingerprints = [];
if (/\.(?:deck-hint|present-btn|present-exit|rotate-hint)\b[^{};]*\{/.test(html)) {
  fingerprints.push('css-rule');
}
const hasKeyDispatch = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .some(m => /KeyboardEvent\(\s*['"]keydown['"]/.test(m[1]) && m[1].includes('present-btn'));
if (hasKeyDispatch) {
  fingerprints.push('js-key-dispatch');
}
const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
if (headMatch && /<meta\s[^>]*property=['"]og:title['"]/.test(headMatch[1])) {
  fingerprints.push('og:title-meta');
}
if (fingerprints.length > 0) {
  console.log(`site additions already present (fingerprint: ${fingerprints.join(', ')}) — skipping injection`);
  process.exit(0);
}

// ── title, site name, description ─────────────────────────────────────────────
const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
if (!titleMatch) {
  console.error('web-inject: deck has no <title> — cannot derive og:title / default description');
  process.exit(1);
}
const title = titleMatch[1].trim();

// site name: og:site_name meta if present, else the footer .brand's first text
const siteName =
  (html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']*)["']/i) ||
   html.match(/\bclass=["'][^"']*\bbrand\b[^"']*["'][^>]*>([^<]*)/i) || [])[1]?.trim() || null;

if (description === null || description === undefined) {
  description = siteName ? `${title} — a talk by ${siteName}` : title;
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── the three injected blocks ────────────────────────────────────────────────
const NOTE = 'Injected by scripts/web-inject.mjs — template: scripts/lib/site-additions.{css,js}. Idempotent: re-running adds nothing.';

const metaBlock = [
  '<!-- site addition -->',
  `<meta name="description" content="${esc(description)}">`,
  `<meta property="og:title" content="${esc(title)}">`,
  `<meta property="og:description" content="${esc(description)}">`,
  `<meta property="og:type" content="article">`,
  `<meta property="og:url" content="${esc(url)}">`,
  `<meta name="twitter:card" content="summary">`,
  `<meta name="twitter:title" content="${esc(title)}">`,
  `<meta name="twitter:description" content="${esc(description)}">`,
  `<link rel="canonical" href="${esc(url)}">`,
  '<!-- /site addition -->',
].join('\n');

const styleBlock = `<style>\n${MARKER}\n/* ${NOTE} */\n${cssTemplate.trimEnd()}\n</style>`;
const scriptBlock = `<script>\n${MARKER}\n/* ${NOTE} */\n${jsTemplate.trimEnd()}\n</script>`;

// ── insertion points (each must exist — hard error otherwise) ────────────────
// (no separate <title> check: titleMatch above already hard-errors on a
// missing <title>, so a second check here was unreachable)
if (!/<\/head>/i.test(html)) {
  console.error('web-inject: no </head> insertion point'); process.exit(1);
}
if (!/<\/body>/i.test(html)) {
  console.error('web-inject: no </body> insertion point'); process.exit(1);
}

let out = html
  .replace(/<title[^>]*>/i, m => `${metaBlock}\n${m}`)
  .replace(/<\/head>/i, `${styleBlock}\n</head>`)
  .replace(/<\/body>/i, `${scriptBlock}\n</body>`);

writeFileSync(deckPath, out);

// ── report ───────────────────────────────────────────────────────────────────
console.log(JSON.stringify({
  injected: true,
  url,
  title,
  description,
  siteName,
  htmlBytesBefore: Buffer.byteLength(html),
  htmlBytesAfter: Buffer.byteLength(out),
}, null, 2));
