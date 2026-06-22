# Card-art extraction pipeline (v2 — mask-first, alpha output)

Offline tooling that extracts a **clean ART LAYER** from project-card scans as
**alpha-masked WebP** assets (+ a manifest + review artifacts). It does **not**
touch any game UI — it only writes assets under `--out` (default
`assets/card-art/`).

## Why v2 is mask-first (and v1 was scrapped)

v1 produced rectangular crops. That can never be pixel-clean on these cards,
because the art window is **not a rectangle**: it has a curved title arc on top
and a curved decorative **separator arc** on the bottom (the band that carries
the binary code capsule). Any rectangle leaks UI — the green/blue separator, the
code capsule, the VP badge, text panels, frame strips, author credits.

v2 cuts the art with an **alpha mask** (polygon, possibly curved): everything
that is not art becomes transparent. Future UI/CSS will fill the transparent
zones with a premium frame/background.

- Output: `{code}-512.webp` + `{code}-1024.webp` **with alpha** (no blur/placeholder).
- The exported pixels are **clean art only** — no gradient/vignette/glow baked in.

## Run (golden batch only — full batch is disabled)

```bash
# the first 10 project cards (001..010)
npm run card-art:extract -- --src "C:\Users\you\Downloads\TerraformingMars-CardDatabase\projects" --out "./assets/card-art" --golden-first 10 --debug

# specific cards
npm run card-art:extract -- --src "<folder>" --out "./assets/card-art" --only 002,005,008
```

A no-scope run errors out: *"Full batch disabled for v2 until the golden batch is
accepted. Use --golden-first N or --only A,B (or --allow-full-batch to override)."*
Do **not** use `--allow-full-batch` until the golden batch is accepted.

## Output structure

```
assets/card-art/
  001-512.webp  001-1024.webp   (alpha)
  ...           010-1024.webp
  manifest.json                  (v2: canvas + mask + qualityChecks, no blur)
  review/                        (git-ignored, regenerable)
    index.html                   strict per-card review
    mask-editor.html             click-to-author polygon masks
    report.json
    cards/<code>/                card.png, mask-overlay.png,
                                 art-checker.png / art-dark.png / art-light.png / art-2x.png
```

Only the `*.webp` + `manifest.json` are durable/committed; `review/` is
git-ignored.

## Review (the purity check)

Open `assets/card-art/review/index.html`. For every card it shows the normalized
card, the canvas + mask overlay, and the final art on **checkerboard / dark /
light** backgrounds + a **200%** zoom, with status + quality checks. **The
checkerboard is the authority for alpha purity** — if any title / text / icon /
VP badge / code capsule / separator / frame / credit is visible on the
checkerboard, the mask is not done.

The quality checks (`no-text-panel`, `no-separator-strip`, `no-code-capsule`,
`no-vp-badge`, `has-alpha`, `art-present`) are **advisory**: the separator /
capsule / VP-badge heuristics WARN (they false-positive on art that happens to be
uniform / cyan / orange — blueprints, deserts, sunsets, tunnels). Only
`no-text-panel` can FAIL (reliable). A manual mask is accepted on visual review,
not on the heuristics.

## Authoring / editing a mask

Masks live in `scripts/card-art/card-art-masks.json` (a card with an entry uses a
**manual mask**; otherwise the auto tracer seeds one and marks it
`needs-manual-mask` if it can't be trusted). Format (normalized; `canvas` is
card-normalized, polygon points are 0..1 **relative to the canvas**):

```json
{
  "005": {
    "canvas": { "x": 0.05, "y": 0.351, "w": 0.863, "h": 0.304 },
    "includePolygons": [ [ {"x":0,"y":0}, {"x":1,"y":0}, ... ] ],
    "excludePolygons": [ [ ... ] ],
    "focus": { "x": 0.5, "y": 0.45 },
    "note": "..."
  }
}
```

Three ways to author:

1. **`review/mask-editor.html`** — pick a card, click to add include-polygon
   points (Shift+Click for an exclude polygon, right-click removes the last
   point), watch the live checkerboard, copy the printed `masks.json` snippet.
2. **`node scripts/card-art/_mask.js <code> l= r= te= tc= be= bc= [exc=...]`** —
   a fast parametric model (straight sides `l`/`r` + parabolic top arc `te`/`tc`
   + parabolic bottom arc `be`/`bc`). Writes a checkerboard preview to
   `review/cards/<code>/_preview.png` and prints the `masks.json` entry. This is
   how the golden 10 were authored; their params live in
   `scripts/card-art/_genmasks.js` (edit params → `node _genmasks.js` rewrites
   `card-art-masks.json`).
3. Hand-edit `card-art-masks.json` directly.

Verify edges (thin slivers hide on a 1× checkerboard):
`node scripts/card-art/_edges.js [codes...]` → `review/cards/<code>/_edge.png`
(top/bottom zoom) + `_sides.png` (left/right zoom), all on checkerboard.

## Re-run a single card after editing its mask

```bash
npm run card-art:extract -- --src "<folder>" --out "./assets/card-art" --only 005
node scripts/card-art/_edges.js 005   # re-verify edges
```

## CLI options

| Option | Default | Meaning |
| --- | --- | --- |
| `--src` | *(required)* | folder of scans (searched recursively) |
| `--out` | `./assets/card-art` | output folder |
| `--masks` | `scripts/card-art/card-art-masks.json` | manual masks file |
| `--golden-first N` | — | process the first N cards by sorted code |
| `--only A,B,C` | — | process only these card codes |
| `--allow-full-batch` | off | required to run all cards (do not use yet) |
| `--review-only` | off | rebuild review from the manifest |
| `--debug` | off | write per-card `plan.json` |
| `--quality-preview` | 84 | 512px WebP quality |
| `--quality-large` | 88 | 1024px WebP quality |
| `--alpha-quality` | 100 | WebP alpha quality |
| `--preview-width` / `--large-width` | 512 / 1024 | variant widths |
| `--webp-effort` | 6 | encoder effort |
| `--sharpen` | `none` | `none` or `mild` |

## Status values

`manual-mask` (authored + visually verified — accepted) · `auto-mask` (auto
tracer, QC-clean — accepted) · `needs-manual-mask` (auto failed the gate) ·
`needs-review` (auto, ambiguous) · `rejected` (manual mask failed a hard check) ·
`failed` (could not export).
