// house-style.mjs — the keynote-create house-style registry.
//
// Persists a small JSON pointer file mapping pack names → pack directories,
// plus an optional default. The registry lets a user configure a "House
// style" once (e.g. their brand) and reuse it silently thereafter.
//
// Path is injectable via $KEYNOTE_HOUSE_STYLE (tests set it to a temp file)
// and otherwise defaults to ~/.claude/keynote-house-style.json.
//
// Design guarantees:
//  - reads never throw: a missing or corrupt file yields a fresh registry
//    (+ a stderr warning) so a bad file can never crash a render.
//  - writes are atomic: write a sibling .tmp then rename() into place, so a
//    crash mid-write cannot leave a half-written registry.
//  - resolveName is fail-closed: it returns {error} for an unknown name OR a
//    stale (moved/deleted) path, and NEVER substitutes a different pack —
//    silently rendering the wrong brand is worse than failing.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const FRESH = () => ({ schema: 1, packs: {}, default: null });

export function registryPath() {
  return process.env.KEYNOTE_HOUSE_STYLE
    || path.join(os.homedir(), '.claude', 'keynote-house-style.json');
}

export function readRegistry() {
  const p = registryPath();
  let raw;
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') {
      process.stderr.write(`[house-style] WARN: could not read ${p} (${e.message}); using empty registry.\n`);
    }
    return FRESH();
  }
  try {
    const obj = JSON.parse(raw);
    const plainObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    if (!plainObj(obj) || obj.schema !== 1 || !plainObj(obj.packs)) {
      process.stderr.write(`[house-style] WARN: ${p} is malformed; using empty registry.\n`);
      return FRESH();
    }
    if (!('default' in obj)) obj.default = null;
    return obj;
  } catch (e) {
    process.stderr.write(`[house-style] WARN: ${p} is not valid JSON (${e.message}); using empty registry.\n`);
    return FRESH();
  }
}

export function writeRegistry(obj) {
  const p = registryPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, p); // atomic on POSIX
}

export function normalizeName(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Register (or overwrite) a pack pointer and persist. Returns the
// normalized name used as the key.
export function registerPack(name, packPath, { makeDefault = false } = {}) {
  const key = normalizeName(name);
  if (!key) throw new Error(`house-style: invalid pack name ${JSON.stringify(name)}`);
  const abs = path.resolve(packPath);
  const reg = readRegistry();
  reg.packs[key] = { path: abs, created: reg.packs[key]?.created || new Date().toISOString() };
  if (makeDefault || reg.default == null) reg.default = key;
  writeRegistry(reg);
  return key;
}

// Fail-closed resolver: {path} only when the name is registered AND the
// directory still exists; otherwise {error} — never a different pack.
export function resolveName(name) {
  const key = normalizeName(name);
  const reg = readRegistry();
  const entry = reg.packs[key];
  if (!entry) return { error: `no house-style pack named "${key}" is registered` };
  if (!fs.existsSync(entry.path) || !fs.statSync(entry.path).isDirectory()) {
    return { error: `house-style pack "${key}" points at a missing directory: ${entry.path}` };
  }
  return { path: entry.path };
}

export function getDefault() {
  const reg = readRegistry();
  if (!reg.default) return { error: 'no default house-style pack is set' };
  return resolveName(reg.default);
}
