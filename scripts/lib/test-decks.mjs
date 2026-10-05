// test-decks.mjs — render the tracked fixture Markdown into HTML decks for
// tests (Keynote export, plan Task 4). docs/fixtures/baseline/ is gitignored
// and local only, so tests never read it; they render fresh copies instead.
// A Google Fonts fetch failure in a sandbox only yields a fallback-font
// warning from the renderer; it is not a failure here.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const RENDER = path.join(REPO, 'scripts', 'keynote-render.mjs');
const NEUTRAL = path.join(REPO, 'packs', 'neutral');

// renderBaselineDecks(tmpDir) → { boardroom, keynote } absolute HTML paths
export function renderBaselineDecks(tmpDir) {
  fs.mkdirSync(tmpDir, { recursive: true });
  const out = {};
  for (const name of ['boardroom', 'keynote']) {
    const md = path.join(tmpDir, `sample-${name}.md`);
    fs.copyFileSync(path.join(REPO, 'docs', 'fixtures', `sample-${name}.md`), md);
    const r = spawnSync(process.execPath, [RENDER, md, '--style', NEUTRAL], { encoding: 'utf8', timeout: 180_000 });
    const html = md.replace(/\.md$/, '.html');
    if (!fs.existsSync(html)) throw new Error(`render failed for ${name}: ${r.stderr || r.stdout}`);
    out[name] = html;
  }
  return out;
}
