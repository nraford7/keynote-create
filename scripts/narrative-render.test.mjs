import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function render(t, content, args = []) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ne-render-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const pack = path.join(dir, 'pack');
  fs.cpSync(path.join(root, 'packs/neutral'), pack, { recursive: true });
  fs.writeFileSync(path.join(pack, 'fonts.json'), '{"families":[]}');
  const input = path.join(dir, 'deck.md');
  fs.writeFileSync(input, content);
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/keynote-render.mjs'), input, '--style', pack, '--no-pdf', ...args], { encoding: 'utf8' });
  const html = path.join(dir, 'deck.html');
  return { ...r, html: fs.existsSync(html) ? fs.readFileSync(html, 'utf8') : '' };
}
const ne = `# A cautious expansion\n\n**Punchline:** Expand the pilot cautiously.\n\n## Title sequence\n1. Volunteers liked the pilot.\n2. Test before expanding.\n\n---\n\n## Slide 1 — Draft label\n**Headline:** Volunteers liked the pilot.\n**Spotlight (≤60 words):** Twenty volunteers reported satisfaction; productivity was not measured. [Pilot memo]\n**Design note:** A simple comparison, no invented chart.\n**Narration:** Satisfaction is promising, but it does not establish productivity.\n\n---\n\n## Slide 2 — Test before expanding.\n**Headline:** Test before expanding.\n**Spotlight (≤60 words):** Costs remain unknown.\n**Design note:** An open question.\n**Narration:** Measure costs before deciding on expansion.\n`;
test('NE fields survive rendering without slide labels or an extra cover', t => {
  const r = render(t, ne, ['--no-cover']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /Twenty volunteers reported satisfaction; productivity was not measured/);
  assert.match(r.html, /<title>A cautious expansion<\/title>/);
  assert.doesNotMatch(r.html, /Slide 1 — Draft label/);
  assert.equal((r.html.match(/class="slide-wrap"/g) || []).length, 2);
  assert.match(r.html, /speaker-note[^>]*>[^<]*Satisfaction is promising/);
});
test('explicit keynote register routes body-only NE to keynote layouts', t => {
  const r = render(t, ne, ['--mode', 'keynote', '--no-cover']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /class="[^"]*kn-caption/);
  assert.match(r.html, /Twenty volunteers/);
});
test('plain supporting paragraphs and source qualifications are retained', t => {
  const r = render(t, '# Deck\n\n---\n\n## Results remain preliminary.\n\nThe pilot may help. Costs are estimated.\n');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /The pilot may help\. Costs are estimated\./);
});
test('invalid explicit mode fails instead of silently changing register', t => {
  const r = render(t, ne, ['--mode', 'keynot']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /boardroom.*keynote/);
});
test('legacy frontmatter and directives still render', t => {
  const r = render(t, '---\ntitle: "Legacy"\nmode: "keynote"\n---\n\n# Legacy\n\n---\n\n## One beat\n- Supporting line\n> Art: Warm film\n> Speaker note: Preserve this note.\n');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /Supporting line/);
  assert.match(r.html, /Preserve this note/);
  assert.equal((r.html.match(/class="slide-wrap"/g) || []).length, 2);
});
test('short and numeric Keynote titles do not silently discard supporting evidence', t => {
  for (const title of ['Twenty volunteers', '20']) {
    const r = render(t, `# Pilot\n\n---\n\n## Slide 1 — ${title}\n**Headline:** ${title}\n**Spotlight (≤60 words):** Satisfaction only; productivity unmeasured.\n**Narration:** This does not prove productivity.\n`, ['--mode', 'keynote', '--no-cover']);
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.html.includes('Satisfaction only; productivity unmeasured.'), `Evidence lost for ${title}`);
  }
});
