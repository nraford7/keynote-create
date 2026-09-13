// playwright.mjs — shared playwright resolution.
//
// Resolution order: PLAYWRIGHT_MODULE env var (the canonical way to point at
// a specific install) → a machine-specific known-good path (optional
// convenience entry; an example from one contributor's machine — irrelevant
// wherever the env var or a bare `npm i playwright` works) → bare require.
// Hard-exits 1 when none resolve.

import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
export function getPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_MODULE,
    '/Users/zeigor/GitHub/diagramming/node_modules/playwright/index.mjs', // machine-specific example entry — override via PLAYWRIGHT_MODULE
    '/Users/noahraford/Projects/bookie/node_modules/playwright/index.mjs', // machine-specific: NR's Mac
  ].filter(Boolean);
  for (const c of candidates) { try { return require(c); } catch {} }
  try { return require('playwright'); } catch {}
  console.error('web-optimize: playwright not found. Set PLAYWRIGHT_MODULE or npm i playwright.');
  process.exit(1);
}
