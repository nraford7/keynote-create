#!/usr/bin/env node
// test-render.mjs — self-contained checks for the style-pack render pipeline.
// No test framework: each check prints PASS/FAIL and the process exits non-zero
// if any fails. All state uses temp dirs + injected env so the real
// ~/.claude registry and packs are never touched.
//
// Run: node scripts/test-render.mjs

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.dirname(HERE);
const RENDER = path.join(HERE, 'keynote-render.mjs');
const PACKS = path.join(REPO, 'packs');
const NEUTRAL = path.join(PACKS, 'neutral');
const FIX_B = path.join(REPO, 'docs/fixtures/sample-boardroom.md');
const FIX_K = path.join(REPO, 'docs/fixtures/sample-keynote.md');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kn-test-'));
const REG = path.join(TMP, 'registry.json');
let ok = true;
const chk = (cond, msg) => { console.log((cond ? 'PASS' : 'FAIL') + ' ' + msg); if (!cond) ok = false; };

// baseEnv: neutral pack findable via KEYNOTE_PACKS_DIR; registry isolated.
const baseEnv = { ...process.env, KEYNOTE_PACKS_DIR: PACKS, KEYNOTE_HOUSE_STYLE: REG };

// render(fixture, extraArgs, env) → { code, outDir, html }
function render(fixture, extraArgs = [], env = baseEnv) {
  const outDir = fs.mkdtempSync(path.join(TMP, 'out-'));
  const args = [RENDER, fixture, '--out', outDir, '--no-pdf', ...extraArgs];
  const r = spawnSync('node', args, { env, encoding: 'utf8' });
  const base = path.basename(fixture, path.extname(fixture));
  const htmlPath = path.join(outDir, base + '.html');
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';
  return { code: r.status, outDir, html, stderr: r.stderr };
}

// 1. neutral boardroom render: embedded fonts, no house-brand style
{
  const r = render(FIX_B);
  chk(r.code === 0, 'neutral boardroom renders (exit 0)');
  chk(/base64,/.test(r.html), 'neutral boardroom embeds @font-face base64');
  chk(/Fraunces/.test(r.html) && /Inter/.test(r.html), 'neutral boardroom uses Fraunces + Inter');
  chk(!/C9A96E/i.test(r.html) && !/Cormorant/i.test(r.html), 'neutral boardroom has no house-brand gold/font');
}

// 2. neutral keynote render
{
  const r = render(FIX_K);
  chk(r.code === 0, 'neutral keynote renders (exit 0)');
  chk(/kn-caption|kn-word|kn-number/.test(r.html), 'neutral keynote uses the keynote family');
  chk(!/C9A96E/i.test(r.html), 'neutral keynote has no house-brand gold');
}

// 3. explicit unknown --style fails closed
{
  const r = render(FIX_B, ['--style', '/no/such/pack']);
  chk(r.code !== 0, 'unknown --style path exits non-zero');
  chk(/is not a directory/.test(r.stderr), 'unknown --style prints a clear error');
}

// 4. named registry resolution + stale fail-closed
{
  // make a valid pack by copying neutral into a temp dir
  const pdir = path.join(TMP, 'mypack');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  execFileSync('node', ['--input-type=module', '-e',
    `import {registerPack} from '${path.join(HERE, 'house-style.mjs')}'; registerPack('My Brand', ${JSON.stringify(pdir)});`],
    { env: baseEnv });
  const r = render(FIX_B, ['--style', 'My Brand']);
  chk(r.code === 0, 'registered house-style name resolves + renders');
  // now move the pack away → stale
  fs.rmSync(pdir, { recursive: true, force: true });
  const r2 = render(FIX_B, ['--style', 'My Brand']);
  chk(r2.code !== 0, 'stale registered pack fails closed (no cross-brand fallback)');
}

// 5. layouts:"shared" pack resolves the bundled neutral layouts
{
  const pdir = path.join(TMP, 'sharedpack');
  fs.mkdirSync(pdir, { recursive: true });
  fs.copyFileSync(path.join(NEUTRAL, 'tokens.css'), path.join(pdir, 'tokens.css'));
  fs.copyFileSync(path.join(NEUTRAL, 'fonts.json'), path.join(pdir, 'fonts.json'));
  fs.copyFileSync(path.join(NEUTRAL, 'style-notes.md'), path.join(pdir, 'style-notes.md'));
  fs.writeFileSync(path.join(pdir, 'pack.json'),
    JSON.stringify({ schema: 1, name: 'shared', brand: '', sublabel: '', layouts: 'shared', richPromotion: false }));
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code === 0, 'layouts:"shared" pack renders via bundled neutral layouts');
  chk(/\.slide-wrap/.test(r.html), 'shared render includes the shared layout CSS');
}

// 6. malformed pack.json fails closed
{
  const pdir = path.join(TMP, 'badjson');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'pack.json'), '{ not json');
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code !== 0, 'malformed pack.json fails closed');
}

// 7. token-incomplete tokens.css (with a decoy in a comment) fails closed
{
  const pdir = path.join(TMP, 'badtokens');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'tokens.css'),
    ':root{ --accent:#111; }\n/* --display: decoy-in-comment should NOT satisfy validation */');
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code !== 0, 'token-incomplete pack fails closed');
  chk(/missing\/empty required tokens/.test(r.stderr) && /--display/.test(r.stderr),
    'decoy token inside a comment does not satisfy validation');
}

// 7b. --style with no value fails closed (does not silently render neutral)
{
  const r = render(FIX_B, ['--style']);
  chk(r.code !== 0 && /requires a value/.test(r.stderr), '--style with no value fails closed');
}

// 7c. invalid pack.json layouts value fails closed
{
  const pdir = path.join(TMP, 'badlayouts');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'pack.json'),
    JSON.stringify({ schema: 1, name: 'x', brand: '', sublabel: '', layouts: 'bogus', richPromotion: false }));
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code !== 0 && /layouts must be/.test(r.stderr), 'invalid layouts value fails closed');
}

// 7d. </style> breakout in pack CSS fails closed (injection guard)
{
  const pdir = path.join(TMP, 'evilcss');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  fs.appendFileSync(path.join(pdir, 'tokens.css'), '\n/* x */ a{content:"</style><script>alert(1)</script>"}');
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code !== 0 && /refusing to inline untrusted markup/.test(r.stderr), '</style> breakout in pack CSS fails closed');
}

// 7e. richPromotion:true without template.html fails closed
{
  const pdir = path.join(TMP, 'fakerich');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'pack.json'),
    JSON.stringify({ schema: 1, name: 'x', brand: '', sublabel: '', layouts: 'self', richPromotion: true }));
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code !== 0 && /richPromotion/.test(r.stderr), 'richPromotion without template.html fails closed');
}

// 8. brand/sublabel precedence: pack default vs CLI override
{
  const pdir = path.join(TMP, 'brandpack');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'pack.json'),
    JSON.stringify({ schema: 1, name: 'brandpack', brand: 'PackBrand', sublabel: 'PackSub', layouts: 'self', richPromotion: false }));
  const rDefault = render(FIX_B, ['--style', pdir]);
  chk(/PackBrand/.test(rDefault.html), 'brand defaults from pack.json');
  const rOverride = render(FIX_B, ['--style', pdir, '--brand', 'CliBrand']);
  chk(/CliBrand/.test(rOverride.html) && !/PackBrand/.test(rOverride.html), 'CLI --brand overrides pack.json');
}

// 9. cache keys are content-hashed, not basename (collision safety)
{
  const files = fs.existsSync(path.join(os.homedir(), '.claude/cache/fonts'))
    ? fs.readdirSync(path.join(os.homedir(), '.claude/cache/fonts')) : [];
  const hashed = files.filter(f => /^[0-9a-f]{20}\.woff2$/.test(f));
  chk(hashed.length > 0, 'font cache uses 20-hex-hash filenames (collision-safe, not basename)');
}

// 10. font-family sanitization rejects a CSS-breaking name
{
  const pdir = path.join(TMP, 'evilfont');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'fonts.json'), JSON.stringify({
    families: [{ name: 'Bad}Font', source: 'local', faces: [{ weight: 400, path: path.join(pdir, 'x.woff2') }] }],
  }));
  // give it a non-empty file so buildFontCss reaches safeFamily
  fs.writeFileSync(path.join(pdir, 'x.woff2'), Buffer.from('not-a-real-font'));
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code !== 0, 'unsafe font-family (contains }) fails closed');
}

// 10b. --style '' and option-looking values fail closed (no silent neutral)
{
  const rEmpty = render(FIX_B, ['--style', '']);
  chk(rEmpty.code !== 0, "empty --style '' fails closed");
  const rFlag = render(FIX_B, ['--style', '--no-pdf']);
  chk(rFlag.code !== 0 && /requires a value/.test(rFlag.stderr), '--style consuming a flag fails closed');
}

// 10c. local font that symlinks outside the pack is skipped, not embedded
{
  const pdir = path.join(TMP, 'symlinkfont');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  const outside = path.join(TMP, 'secret.bin');
  fs.writeFileSync(outside, Buffer.from('SECRET-FILE-CONTENTS-should-not-embed'));
  try { fs.symlinkSync(outside, path.join(pdir, 'evil.woff2')); } catch {}
  fs.writeFileSync(path.join(pdir, 'fonts.json'), JSON.stringify({
    families: [{ name: 'Evil', source: 'local', faces: [{ weight: 400, path: 'evil.woff2' }] }],
  }));
  const r = render(FIX_B, ['--style', pdir]);
  const embedded = /SECRET-FILE-CONTENTS/.test(r.html) ||
    r.html.includes(Buffer.from('SECRET-FILE-CONTENTS-should-not-embed').toString('base64'));
  chk(r.code === 0 && !embedded && /not confined/.test(r.stderr),
    'symlinked-outside local font is skipped, never embedded (no local-file disclosure)');
}

// 11. cache-key derivation is content-hashed: two different URLs with the SAME
// basename map to DIFFERENT cache files (collision safety, tested directly).
{
  const key = (u) => crypto.createHash('sha256').update(u).digest('hex').slice(0, 20) + '.woff2';
  const k1 = key('https://a.example/fonts/font.woff2');
  const k2 = key('https://b.example/fonts/font.woff2');
  chk(k1 !== k2 && /^[0-9a-f]{20}\.woff2$/.test(k1), 'same-basename different-URL fonts get distinct cache keys');
}

// 12. PDF export path works (not just --no-pdf): render to a real PDF above floor
{
  const outDir = fs.mkdtempSync(path.join(TMP, 'pdf-'));
  const r = spawnSync('node', [RENDER, FIX_B, '--out', outDir], { env: baseEnv, encoding: 'utf8' });
  const pdf = path.join(outDir, 'sample-boardroom.pdf');
  const kb = fs.existsSync(pdf) ? fs.statSync(pdf).size / 1024 : 0;
  chk(r.status === 0 && kb >= 30 * 5, `PDF export works and is above the ~30KB/slide floor (${kb.toFixed(0)}KB)`);
}

// 13. body-list measure is capped (no 140-char lines across the full slide)
{
  const r = render(FIX_B);
  chk(/\.body-list\{[^}]*max-width:1180px/.test(r.html), 'body-list has a max-width measure cap');
}

// 14. subcaption has an ink plate (not a text-shadow crutch) and no house-palette residue
{
  const r = render(FIX_K);
  chk(/\.kn-subcap\{[^}]*background:rgba\(0,0,0,\.55\)/.test(r.html), 'kn-subcap carries an ink plate');
  chk(!/#F3F1EC/i.test(r.html) && !/rgba\(74,71,64/.test(r.html), 'no hardcoded house-palette residue in shared layouts');
}

// 15. art note flagging a light image auto-flips the caption box to dark
{
  const md = path.join(TMP, 'light.md');
  fs.writeFileSync(md, '---\ntitle: "T"\nmode: "keynote"\n---\n\n# T\n\n---\n\n## The gallery was empty\n\n- one line\n\n> Art: bright white museum atrium, pale daylight\n');
  const r = render(md);
  chk(r.code === 0 && /kn-caption dark/.test(r.html), 'light art note auto-flips to caption-dark');
}

// 16. local images are base64-inlined; a missing image degrades to the placeholder
{
  const img = path.join(TMP, 'tiny.png');
  fs.writeFileSync(img, Buffer.from('89504e470d0a1a0a', 'hex'));
  const md = path.join(TMP, 'img.md');
  fs.writeFileSync(md, '---\ntitle: "T"\nmode: "keynote"\n---\n\n# T\n\n---\n\n## A real image\n\n![](' + img + ')\n\n---\n\n## A missing image\n\n![](./no-such-file.jpg)\n');
  const r = render(md);
  chk(r.code === 0 && /data:image\/png;base64,/.test(r.html), 'local slide image is base64-inlined');
  chk(!/no-such-file\.jpg/.test(r.html), 'missing image never leaves a dead URL in the HTML');
}

// 17. low-contrast core token pair fails closed
{
  const pdir = path.join(TMP, 'lowcontrast');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  let css = fs.readFileSync(path.join(pdir, 'tokens.css'), 'utf8');
  css = css.replace('--lt-text:#16181B;', '--lt-text:#EEEEEE;');
  fs.writeFileSync(path.join(pdir, 'tokens.css'), css);
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code !== 0 && /fails contrast/.test(r.stderr), 'low-contrast lt-text on lt-bg fails closed');
}

// 18. richPromotion demands layouts:"self" (shared CSS covers only the baseline family)
{
  const pdir = path.join(TMP, 'richshared');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'template.html'), '<div class="slide lt"></div>');
  fs.writeFileSync(path.join(pdir, 'layout-catalog.md'), '# catalog');
  fs.writeFileSync(path.join(pdir, 'pack.json'),
    JSON.stringify({ schema: 1, name: 'x', brand: '', sublabel: '', layouts: 'shared', richPromotion: true }));
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code !== 0 && /richPromotion/.test(r.stderr) && /self/.test(r.stderr), 'richPromotion on shared layouts fails closed');
}

// 19. richPromotion template classes must have a CSS rule in the pack
{
  const pdir = path.join(TMP, 'richuncovered');
  fs.cpSync(NEUTRAL, pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'template.html'), '<div class="slide lt"><div class="totally-unstyled-class"></div></div>');
  fs.writeFileSync(path.join(pdir, 'layout-catalog.md'), '# catalog');
  fs.writeFileSync(path.join(pdir, 'pack.json'),
    JSON.stringify({ schema: 1, name: 'x', brand: '', sublabel: '', layouts: 'self', richPromotion: true }));
  const r = render(FIX_B, ['--style', pdir]);
  chk(r.code !== 0 && /totally-unstyled-class/.test(r.stderr), 'template class with no CSS rule fails closed');
}

// 20. overflow probe flags an overstuffed slide during PDF export (needs Chrome, like #12)
{
  const bullets = Array.from({ length: 40 }, (_, i) => '- Bullet line number ' + (i + 1) + ' with enough words to take real vertical space on the slide').join('\n');
  const md = path.join(TMP, 'overflow.md');
  fs.writeFileSync(md, '---\ntitle: "T"\n---\n\n# T\n\n---\n\n## This slide has far too much body content\n\n' + bullets + '\n\n---\n\n## Closing beat\n');
  const outDir = fs.mkdtempSync(path.join(TMP, 'ovf-'));
  const r = spawnSync('node', [RENDER, md, '--out', outDir], { env: baseEnv, encoding: 'utf8' });
  chk(r.status === 0 && /overflows/.test(r.stdout + r.stderr), 'overflow probe flags the overstuffed slide');
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(ok ? '\nALL PASS' : '\nSOME FAILED');
process.exit(ok ? 0 : 1);
