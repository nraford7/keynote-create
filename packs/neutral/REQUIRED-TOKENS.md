# Required token contract

Every pack's `tokens.css` MUST define all of these CSS custom properties
inside its `:root {}` block. `loadPack()` validates this set (comments
and declarations outside `:root` do not count). Missing any token fails
the pack load closed.

## Fonts
- `--display`     — display/title font stack (with fallbacks)
- `--body-font`   — body/label font stack (with fallbacks)
- `--wordmark`    — footer/cover wordmark font stack (with fallbacks)

## Accent (used as a scalpel — rules, markers, dots)
- `--accent`
- `--accent-light`
- `--accent-dark`
- `--accent-tint`   — very low-alpha fill (cards)
- `--accent-fade`   — low-alpha rule

## Light theme palette
- `--lt-bg`
- `--lt-bg2`
- `--lt-bg3`
- `--lt-card-bg`
- `--lt-text`
- `--lt-muted`
- `--lt-rule`
- `--lt-footer-bg`
- `--lt-card-rule`

## Dark theme palette
- `--deck-bg`
- `--deck-bg2`
- `--deck-bg3`
- `--dk-text`
- `--dk-muted`
- `--deck-rule`
- `--deck-border`

## Keynote caption family
- `--kn-ink`     — keynote black (slide bg, dark caption, one-word/number bg)
- `--kn-paper`   — keynote white (caption bg, one-word/number/cover text)

## Cover + geometry
- `--cover-bg`   — the full cover background (a color, gradient stack, or image); packs re-skin the cover entirely through this token
- `--W`          — slide width (invariant `1920px`; declared for completeness)
- `--H`          — slide height (invariant `1080px`)

Type scale (h1/h2/h-verdict px, line-heights), spacing, and the
1920×1080 geometry are **layout-family invariants** and live in
`layouts.css`, not in the skin.
