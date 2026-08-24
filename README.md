# keynote-create

A Claude Code skill that turns raw source material — research notes, a brain-dump, an essay, a strategy memo — into a presentation deck, then renders it to an HTML deck and a PDF.

## Two modes

- **Keynote** — image-led. ~80% full-bleed photography with a hard-edged caption box (top-left) plus a one-line subcaption; titles are fragments, one-word beats, questions, or coined terms. For talks, pitches, TED-style. Hands each slide to the `art-direct` skill for image briefs. Derived from a slide-by-slide study of real image-led keynote decks.
- **Boardroom** — text-led. Every title a complete Minto/McKinsey action-title sentence, rendered in the default house style (a serif + grotesk pairing, a restrained accent). The skill's original behaviour.

**Mode and spine are independent.** The *spine* (narrative structure) is picked separately from a menu of seven: Minto/pyramid plus six keynote-native shapes (emotional arc, reveal/misdirection, framework-build, forecast-cascade, teaching/method, scenario-parallel). Minto is the Boardroom default and stays on the menu in either mode.

Markdown is the structural deliverable; HTML + PDF are the presentation deliverables. The skill does **not** generate `.pptx`.

## Repository layout

| Path | Purpose |
|---|---|
| `SKILL.md` | The skill definition (frontmatter + workflow). |
| `references/title-craft.md` | Title-craft rules, failure modes, and the Keynote fragment register. |
| `references/keynote-devices.md` | The 16-device Keynote palette (affordance triggers + anti-pastiche rules) and the six spines. |
| `references/layout-catalog.md` | The generic Boardroom layouts plus the Keynote layout family. |
| `scripts/keynote-render.mjs` | Node renderer: markdown → self-contained HTML → 1920×1080 PDF via headless Chrome, fonts base64-embedded. Handles both modes; consumes a style pack. |
| `scripts/house-style.mjs` | House-style registry (register/resolve a saved house pack). Imported by the renderer. |
| `packs/neutral/` | The bundled neutral style pack (the default) + `REQUIRED-TOKENS.md` token contract. |
| `KEYNOTE-MODE-SPEC.md` | Design spec for the Keynote-mode addition (kept for provenance). |

## Deployment

This repo is the **canonical source**. The live skill runs from copies under `~/.claude`:

```sh
# skill files (SKILL.md, references, and the bundled packs)
cp SKILL.md KEYNOTE-MODE-SPEC.md ~/.claude/skills/keynote-create/
cp references/*.md               ~/.claude/skills/keynote-create/references/
cp -R packs                      ~/.claude/skills/keynote-create/     # bundled neutral pack — required for default resolution
# render scripts (SKILL.md references these hardcoded paths).
# keynote-render.mjs imports house-style.mjs — copy BOTH or it fails with ERR_MODULE_NOT_FOUND.
cp scripts/keynote-render.mjs scripts/house-style.mjs ~/.claude/scripts/
```

The renderer finds the bundled neutral pack via `$KEYNOTE_PACKS_DIR`, then
`~/.claude/skills/keynote-create/packs/neutral`, then a `packs/neutral` dir
walking up from the script — so the split between `~/.claude/scripts` and the
skill dir resolves. Edit here, then sync out — never edit the deployment copies in place.

## Security & threat model

This is a **local, single-user CLI**. Style packs are chosen by the person
running it. The renderer applies defense-in-depth against a naive malicious
pack — it rejects `</style>`/`<script>` breakouts in pack CSS, sanitises font
family/weight/style and image `url()` values, confines `local` font files to
the pack directory (realpath, no symlink/`../` escape), bounds remote font
fetches (timeout, hard deadline across redirects, 8 MB cap, redirect cap,
http(s) only, face cap), and blocks literal loopback/private/link-local/metadata
IPs for `url`-source fonts.

It is **not** a sandbox against a determined hostile pack: it does not resolve
DNS names to check the target address (a hostname pointing at a private IP is
not caught), and headless Chrome still fetches a pack's image `url()`s during
PDF export outside these guards. Treat an untrusted third-party pack the way you
would any untrusted code you run locally. Producers that fetch from a URL must
apply the same private-host refusal (see SKILL.md → Producers → from-url).

## Rendering a deck

```sh
node scripts/keynote-render.mjs <deck.md>        # markdown → HTML + PDF
node scripts/keynote-render.mjs <deck.html>      # re-export PDF from edited HTML
```

Keynote decks add per-slide `![](img)` / `> Image:`, `> Art:`, and `> Layout:` lines; a missing image renders a labelled placeholder carrying the art direction, so an image-less draft still exports.

## Requirements

- Node.js (no npm dependencies — standard library only).
- Google Chrome at `/Applications/Google Chrome.app` for PDF export.
- Network on first render to fetch + cache the two Google Fonts (cached in `~/.claude/cache/fonts/`).
