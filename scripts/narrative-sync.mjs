#!/usr/bin/env node
// Pinned, reviewable NE snapshot. No implicit network fetch or runtime updates.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (['--check', '--update'].includes(arg)) opts[arg.slice(2)] = true;
  else if (['--source', '--revision', '--target'].includes(arg) && args[i + 1] && !args[i + 1].startsWith('--')) opts[arg.slice(2)] = args[++i];
  else { console.error(`Unknown or incomplete argument: ${arg}`); process.exit(1); }
}
const target = path.resolve(opts.target || path.join(root, 'vendor/narrative-engine'));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const REQUIRED = ["SKILL.md", "agent-reference-persuasion.md", "agent-reference-verification.md", "agent-reference-visual.md", "attention-loop.md", "audience-profiles.md", "checklists.md", "communication-frameworks.md", "deck-title-craft.md", "emotional-arcs.md", "framework-selection.md", "humanizing-pass.md", "narrative-arcs.md", "opening-closing-strategies.md", "prompts/builder.md", "prompts/evidence-reviewer.md", "prompts/focal-fidelity-judge.md", "prompts/reviewer.md", "prompts/stress-tester.md", "prose-craft-constructions.md", "prose-craft.md", "rhetorical-figures.md", "voice-profiles.md"];
const adaptations = [
  ['/Users/noahraford/.claude/skills/Narrative-Engine/', 'NE_ROOT/'],
  ['~/.claude/skills/keynote-create/references/keynote-devices.md', '../../references/keynote-devices.md'],
];
function adapt(body) {
  for (const [from, to] of adaptations) body = body.replaceAll(from, to);
  return body;
}
function git(...argv) {
  return execFileSync('git', ['-C', path.resolve(opts.source), ...argv], {encoding:'utf8'});
}
try {
  if (opts.update) {
    if (opts.check || !opts.source) throw Error('Use --update --source <NE checkout> [--revision <commit>]');
    const revision = git('rev-parse', '--verify', `${opts.revision || 'HEAD'}^{commit}`).trim();
    const names = git('ls-tree', '-r', '--name-only', revision).trim().split('\n').filter(name =>
      (/^[^/]+\.md$/.test(name) && !['README.md', 'SYNC.md'].includes(name)) || /^prompts\/[^/]+\.md$/.test(name));
    for (const required of REQUIRED) {
      if (!names.includes(required)) throw Error(`Upstream missing required runtime file: ${required}`);
    }
    const files = {};
    const contents = new Map();
    for (const name of names) {
      const source = git('show', `${revision}:${name}`), bundled = adapt(source);
      contents.set(name, bundled);
      files[name] = {upstreamSha256: sha(source), bundledSha256: sha(bundled)};
    }
    // Delete only files tracked by the prior snapshot; do not remove unrelated work.
    const manifestPath = path.join(target, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      const old = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      for (const name of Object.keys(old.files || {})) {
        if (!/^(?:prompts\/)?[\w-]+\.md$/.test(name)) throw Error(`Unsafe manifest path: ${name}`);
        if (!files[name]) fs.rmSync(path.join(target, name), {force:true});
      }
    }
    for (const [name, content] of contents) {
      fs.mkdirSync(path.dirname(path.join(target, name)), {recursive:true});
      fs.writeFileSync(path.join(target, name), content);
    }
    fs.writeFileSync(manifestPath, JSON.stringify({schema:1, repository:'https://github.com/nraford7/Narrative-Engine', revision, adaptations, files}, null, 2) + '\n');
    console.log(`Updated ${names.length} files from ${revision}; review the diff and rerun workflow scenarios.`);
  } else {
    const manifest = JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'));
    if (manifest.schema !== 1 || !/^[a-f0-9]{40}$/.test(manifest.revision || '') || !manifest.files || typeof manifest.files !== 'object') throw Error('Invalid NE manifest schema/revision/files');
    for (const name of REQUIRED) {
      if (!manifest.files[name]) throw Error(`Manifest missing required runtime file: ${name}`);
    }
    if (JSON.stringify(manifest.adaptations) !== JSON.stringify(adaptations)) throw Error('Manifest adaptations differ from sync tool');
    const problems = [];
    for (const [name, record] of Object.entries(manifest.files)) {
      if (!/^(?:prompts\/)?[\w-]+\.md$/.test(name)) throw Error(`Unsafe manifest path: ${name}`);
      const file = path.join(target, name);
      if (!fs.existsSync(file) || sha(fs.readFileSync(file)) !== record.bundledSha256) problems.push(name);
      if (opts.source) {
        const source = git('show', `${manifest.revision}:${name}`);
        if (sha(source) !== record.upstreamSha256 || sha(adapt(source)) !== record.bundledSha256) problems.push(`${name} (upstream/adaptation mismatch)`);
      }
    }
    if (problems.length) throw Error(`NE snapshot drift: ${problems.join(', ')}`);
    console.log(`PASS: ${Object.keys(manifest.files).length} NE files match ${manifest.revision}`);
  }
} catch (error) { console.error(error.message); process.exit(1); }
