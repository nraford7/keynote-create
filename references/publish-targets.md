# Publish targets — registry and onboarding (Stage 6)

Stage 6 publishes a human-curated public deck to a **registered website target**. The publish core is site-agnostic, but every target is a concrete registered profile — never an improvisation, never a guess.

**User-local config, never in this repo.** The registry lives at `~/.claude/keynote-publish-targets.json`, mirroring the house-style registry pattern (`~/.claude/keynote-house-style.json`). This repo stays generic and PR-able upstream; personal configuration (house style, publish targets) stays in local registries outside it.

## Schema

```json
{
  "schema": 1,
  "targets": {
    "example.com": {
      "repo": "~/GitHub/example-site",
      "deckPath": "public/talks/<slug>/index.html",
      "hubPage": "src/pages/talks/index.astro",
      "listings": [{ "page": "src/pages/index.astro", "column": "talks" }],
      "structuredData": "src/pages/talks/index.astro — JSON-LD @graph hasPart Article entries per talk; update on publish",
      "build": "npm run build",
      "deploy": "push-to-main (GitHub Pages, deploy on push)",
      "urlBase": "https://example.com/talks/",
      "notes": "Astro; public/ copied verbatim; concurrent agent work possible — always fetch/rebase before push"
    }
  },
  "default": "example.com"
}
```

**Field notes:**

- `schema` — registry format version. Bump on breaking changes; readers check it.
- `repo` — local clone of the site repo, where Stage 6 works.
- `deckPath` — where the deck lands; `<slug>` is replaced per publish.
- `hubPage` — the talks hub page, which gets the deck's card.
- `listings` — other pages carrying an entry for the deck (e.g. the homepage's talks column).
- `structuredData` — a free-form note naming the structured data (JSON-LD) on the hub that grows per published item, and when to update it. Updated on publish as part of site integration.
- `build` / `deploy` — the site's build and deploy mechanics; deploy runs only after the push gate.
- `urlBase` — the canonical URL base; `urlBase` + slug is the `--url` passed to `web-inject`.
- `notes` — operational gotchas (bookkeeping, concurrent-work warnings like fetch/rebase-before-push).
- `default` — the target used when the user doesn't name one.

## Target resolution order (mirrors style-pack precedence)

1. **Explicit `--target <name>`** — the user named the target.
2. **The registry's `default`**, if one is set.
3. **The onboarding flow** — first run against an unregistered site (below).
4. **Hard error** — never a silent fallback. An unresolvable target is a stop, not a guess.

## Onboarding flow

First run against any unregistered site:

1. **Read the site repo** — routing structure, static-asset conventions, hub/listing pages, any structured data (JSON-LD) on the hub that grows per published item, and the build and deploy mechanics.
2. **Propose a profile** — the JSON above is the shape; fill each field from what the repo actually does.
3. **The user confirms** before anything persists. No silent writes to the registry.
4. **Persist** to `~/.claude/keynote-publish-targets.json` (create it with `{"schema": 1, "targets": {}, "default": null}` if absent), and set `default` if none is set yet.

Later runs are silent — a registered target resolves without ceremony.
