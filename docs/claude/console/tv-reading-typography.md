# TV reading typography — the couch-reading system (2026-08-16)

The iteration that made card RULES and the ARCHIVE ENTRY readable from a couch
(42" 4K, 2.5–3 m). Everything here is token-driven and reusable; per-surface
ad-hoc sizes for long-form text are the thing this system replaced.

## The three type ROLES

| Role | Family | Where declared | Used for |
| --- | --- | --- | --- |
| **Display** | `@con-font` = Prototype (single real weight 400 — every `bold` on it is synthetic; fine on a 5-letter chip, destructive on a sentence) | `console.less` | headers, chips, labels, numeric readouts, controller hints |
| **Reading** | `@con-font-read` = `'Golos Text'` (variable wght 400–900, latin+cyrillic subsets, self-hosted) | `console.less` + `common.less` @font-face | long-form SENTENCES: card rule texts, prompt bodies, reasons, notices |
| **Lore** | Literata (italic + upright) / Newsreader (latin) | `common.less` @font-face, consumed by `card_lore.less` | the archive entry only |

Rule of thumb: **a string with a verb reads in the reading face; a label, a
name or a number stays display.** The adoption list for existing sentence
surfaces is the grouped rule beside `.con-read-text()` in `console.less`
(family + `font-synthesis-weight: none` only — sizes untouched).

## Tokens (base `html.console-native` → TV `html.con-profile-tv`)

- `--con-t-read-lg / --con-t-read / --con-t-read-sm` — reading sizes by
  CONTENT LENGTH (brief / regular / dense). TV: 1.55 / 1.4 / **1.3rem = 26
  logical px — the TV reading FLOOR** (industry couch floors are 24–28 @1080
  logical; the service floor `--con-t-floor` 16px is for chrome, not prose).
- `--con-read-lh` — reading line-height (1.5 / TV 1.52).
- `--con-read-scale` — the player magnifier (settings → Интерфейс → «Размер
  текста чтения», 100/115/130%). Reading font-sizes multiply by it; chrome
  never does. Module: `consoleReadingScale.ts` (persist + `<html>` bridge,
  applied in `main.ts` before first paint).
- `--con-rules-w` — ONE width for the rules panel AND the inspect dossier
  (21rem → TV 26.5rem: the measure keeps 30+ chars at couch size).
- `--con-lore-w`, `--con-lore-fs-lg/-fs/-fs-sm` — the archive entry column +
  sizes. ⚠️ These tokens carry the WHOLE expression: base = the shipped
  vw-responsive `clamp(...)` (rem is fixed there, vw tracks the viewport);
  TV = fixed rem (its rem base already scales, and the 22vw midpoint would
  strangle the measure). Putting a token only in the clamp's max slot is the
  mistake this replaced — on TV the vw midpoint wins and the token never
  applies.
- `.con-read-text(@weight: 450)` — the reading mixin: family, real weight
  (450 compensates dark-polarity thinning without reading as semibold),
  `font-synthesis: none`, kerning, lining nums, `text-wrap: pretty`.

## Length TIERS (never a per-card size)

**Rules panel** (`ConsoleCardRulesPanel.vue` → `lengthTier` computed over the
LOCALIZED text volume): `--brief` ≤90 chars (read-lg, roomier), regular ≤240,
`--dense` >240 (read-sm + `hyphens: auto`). The dense tier is a floor, not a
compressor — nothing truncates, ellipsizes or drops below it.

**Archive entry** (`cardLore.ts` tiers, localized): short ≤65 → italic 500;
regular ≤170 → italic 510; **extended >170 → UPRIGHT 470 + hyphens** (the
editorial shift: sustained italic at 200+ chars works against the reader; the
upright Literata/Newsreader subsets ship for exactly this). The e2e guard
`console-card-lore.spec.ts` asserts the tier-aware voice.

## Fonts on disk / loading

`assets/GolosText-{latin,cyrillic}.woff2`, `Literata-Regular-{latin,cyrillic}`,
`Newsreader-Regular-latin` — `@fontsource-variable` 5.3.0 `wght` subsets, the
same source/versions as the shipped italics. Registered in THREE places:
`common.less` @font-face, `ServeAsset.toFile` allowlist (+ its spec), and
`assets/index.html` `<link rel="preload" as="font" crossorigin>` (crossorigin
is required even same-origin or the font double-downloads). `main.ts` also
stamps the real `html.lang` (beside `data-lang`) — CSS `hyphens: auto`
resolves its dictionary through it.

## Verification

`tests/e2e/tv-reading-matrix.spec.ts` — the acceptance matrix at `tv-4k` +
`fhd`: the three rules tiers on real cards (Comet 87 / Livestock 178 / NPC 210
/ Self-replicating Robots 265), the extended corp lore beside the rules panel,
`document.fonts.check` (a silent fallback passes every geometry check),
computed size ≥ the couch floor, and a no-clip sweep. Screenshots land in
`screenshots/tv-reading/<preset>/`.

⚠️ Two e2e traps this matrix hit: (1) MOUNTED ≠ READABLE — the lore reveal
starts at opacity 0; gate screenshots on the quote's computed opacity. (2) The
app's own settle chains are rAF-driven, and headless Chromium starves rAF on a
static screen — X-inspect then absorbs forever. A tiny `page.screenshot()`
forces a BeginFrame between presses (`openZoomForced`).
