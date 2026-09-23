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

for (const [layout, count] of [['number', 2], ['oneword', 2], ['wordless', 2], ['verdict', 2], ['pair', 3], ['triptych', 4]]) {
  test(`explicit ${layout} cannot discard visible support`, t => {
    const support = Array.from({length: count}, (_, i) => `Qualification ${i + 1}: preliminary evidence only.`);
    const r = render(t, `# Pilot\n\n---\n\n## 42%\n${support.map(s => '- ' + s).join('\n')}\n> Layout: ${layout}\n`, ['--mode', 'keynote', '--no-cover']);
    assert.equal(r.status, 0, r.stderr);
    for (const s of support) assert.ok(r.html.includes(s), `${layout} lost ${s}`);
    assert.match(r.stderr, /preserv/i);
  });
}
test('wordless hint cannot hide an approved headline', t => {
  const r = render(t, '# Pilot\n\n---\n\n## This result does not establish causation.\n> Layout: wordless\n', ['--mode', 'keynote', '--no-cover']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /kn-caption[^>]*>This result does not establish causation\./);
});
test('a titleless slide retains visible evidence and quotations', t => {
  const r = render(t, '# Pilot\n\n---\n\n> Source: Pilot report, page 4.\n- Nonrandom sample.\n', ['--mode', 'keynote', '--no-cover']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.html, /Nonrandom sample/);
  assert.match(r.html, /Source: Pilot report, page 4/);
  assert.doesNotMatch(r.html, /speaker-note[^>]*>Source/);
});
test('stable slide IDs survive reordering without appearing as speaker notes', t => {
  const a = '## First claim\n> Slide ID: pilot-result\n- First support.';
  const b = '## Second claim\n> Slide ID: pilot-limit\n- Second support.';
  for (const parts of [[a,b],[b,a]]) {
    const r = render(t, '# Deck\n\n---\n\n' + parts.join('\n\n---\n\n'), ['--no-cover']);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.html, /data-slide-id="pilot-result"/);
    assert.match(r.html, /data-slide-id="pilot-limit"/);
    assert.doesNotMatch(r.html, /speaker-note[^>]*>Slide ID/);
  }
});
test('duplicate slide IDs fail rather than making revision mappings ambiguous', t => {
  const r = render(t, '# Deck\n\n---\n\n## A\n> Slide ID: same\n\n---\n\n## B\n> Slide ID: same\n', ['--no-cover']);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /duplicate.*slide.*id/i);
});
test('an intentional text slide needs no image placeholder in Keynote mode',t=>{
 const r=render(t,'# Deck\n\n---\n\n## Understand the evidence limit\n- This result is preliminary.\n> Art: Simple typographic explanation.\n> Layout: text\n',['--mode','keynote','--no-cover']);
 assert.equal(r.status,0,r.stderr);const body=r.html.split('<body>')[1].split('<script>')[0];
 assert.doesNotMatch(body,/Image needed/);assert.match(body,/This result is preliminary/);
});
