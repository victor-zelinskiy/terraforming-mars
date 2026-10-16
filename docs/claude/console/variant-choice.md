# The VARIANT CHOICE — outcome tiles (the rework of 2026-10-14)

**Status.** Shipped 2026-10-14 over the TR51 grammar (`bb2a9e7817`, `2299c16aec`). The owner's photo of the 4K TV
(2026-10-13, «Сбор атмосферы»): three option tiles, each printing the WHOLE «аэростат → 2 титан / 3 энергия / 4
тепло» row on a bezel plate, stacked into a column taller than the band — the third tile cut under the commit button,
no tile saying which outcome it was. Three defects in one frame: the SLICE (every tile printed every outcome), the FIT
(a column of plates), the LOOK (a plate inside a tile inside a group — three frames around one icon). This document is
the as-built contract; the rule lives in `.claude/rules/console-ui.md` § THE VARIANT CHOICE IS ONE GRAMMAR.

Files: `foundation/ConsoleVariantChoice.vue` · `console/variantChoiceModel.ts` · `styles/console_variant_choice.less` ·
`components/actions/actionBranchView.ts` (`BranchView.printed`, `printedAlternatives`, `assignPrintedAlternatives`) ·
`ConsoleActionComposer.vue` (the `compare` group, `branchAxis`, `variantGroupNav`).

## 1 · The tile answers ONE question

«Что я получу, если выберу это» — in one glance, from the couch.

```
┌──────────────────────────┐
│                      (✓) │   the SEAL — the answer (absolute, zero layout)
│        2 [titanium]      │   the HERO — the card's own printed graphic of THIS outcome, bare on the glass
│       [Ti] 0 → 2         │   the READING — the host's chips, a step quieter
└──────────────────────────┘
```

- **The hero is the print, and the print is the branch's OWN.** A row the branch has to itself prints whole (its
  printed OR-connector stripped, as before). A row the server splits into several branches — «[floater] → 2 [Ti] /
  3 [En] / 4 [heat]», «[asteroid] → [production M€] ИЛИ 2 [Ti]» — is cut at its printed `/` and `ИЛИ`
  (`printedAlternatives`: the result row of the action box, split at `SLASH` / `OR` symbols, fillers trimmed), and
  each branch CLAIMS the segment its title names (`assignPrintedAlternatives`: token overlap of the behavior title
  against the segment's English words — `printedSegmentDescription`: amounts, the render type with its plural /
  singular, a card resource's name, «production», «wild any standard resource», and `M€` normalised to
  «megacredits» in the tokenizer). **Unambiguous or nothing**: every branch must claim a segment of its own by a
  positive score — no tie, no two the same — else the row is not sliced and the options speak in words and chips.
  The segments are REFERENCES into the face's render tree (the items on the printed row), never copies.
- **The shared cause is the action's price**, printed ONCE above the tiles («Будет списано», PL-074) — a sliced tile
  prints the outcome only, never «floater → 2 Ti» three times over.
- **No plate.** The print sits on the tile's glass; the tile's glass is the only frame. At 1080 the print is ×1.4 the
  face (a 24 px icon → 34 px), on the couch ×1.7 × `--con-ui-scale` — louder than the reading chip by a clear step.
- **Words only where the print cannot speak**: a title without a print is the headline; under a print it is a
  caption (quieter, lighter); a branch with a print and a formula has no words at all (the action composer).
- **The three facts, three paints** are the TR51 grammar unchanged: cursor = cold lift + cyan ring; answer = seal +
  mint kant (survives the cursor leaving; the other live options RECEDE at .6, never hide); rules = faded print + the
  reason on its own plate inside the tile. No `filter` anywhere.
- **The seal stands INSIDE the tile's corner** (2026-10-14 — the owner: «the ✓ can be half hidden»): astride the edge it
  was cut by the scroller the group stood in (the action composer's group sits at its scroller's top — 24 px of the
  seal gone at 4K). A row's seal (list, column) stands at its end, in the row's reserved right lane. The group keeps a
  `padding-block` HALO (.3 / .35rem) so the cursor's lift and its ring are not cut by the same edge.
- **Choosing moves nothing the player is looking at** — the decision column SETTLES (`console/settledColumn.ts`, rule
  § A DECISION COLUMN SETTLES): pinned from the first press, growing downward, every moved group sliding, every new one
  rising; the action formula's «Вы получите» side is reserved from the first frame (a chip-shaped slot) and the
  readiness hint rides the CTA dock's own lane. Measured at 4K (`screenshots/select-settle/{before,after}`): the action
  composer's plate / formula / tiles / rail 126 / 180 / 126 / 54 px of movement → 0; the play composer's column top
  122 px → 0, its rail's 243 px a 240 ms slide instead of a cut.

## 2 · The group is a ROW, and it moves the way it looks

- `compare` tiles share the line: `flex: 1 1 11rem` (TV 12rem), capped at `max-width: 19rem` (TV 21rem) so two tiles
  never stretch across a 4K column with one icon lost in the middle of each; the cluster's own width stacks them
  (`@container (max-width: 34rem)`). «ИЛИ» is the medallion on the seam — a narrow column with the gold hairline
  down it in a row, one slim line across in a column.
- **The action composer now follows the play composer's axis rule** (`variantGroupNav`, `consolePlayCardComposer.ts`):
  the group's axis is MEASURED off the tiles' `offsetTop` under a `useResizeObserver` (`branchAxis`, published as
  `data-variant-axis` on `.con-composer__branches`); in a row ←→ switch the tiles (wrapping), ↑↓ leave the group — ↓
  only once the commit gate lets the cursor out (an unanswered choice keeps it in), ↑ from the commit row re-enters
  on the tile the cursor left (`branchReturnIdx`); stacked, the tiles are rows of the ordinary ↑↓ walk. The bar reads
  **`◄► Вариант`** while the cursor stands in a side-by-side group. A on a tile SELECTS (the seal) and, as before,
  advances the cursor to the commit row.
- `column` (the task host) and `list` (pick lists) tiles are ROWS: the print leads, the words and the reading stand
  beside it, the seal at a list row's end.

## 3 · Measured (the `variant-tiles` fixture — Atmo Collectors, two floaters)

| | before (4K) | after (4K) | before (fhd) | after (fhd) |
| --- | --- | --- | --- | --- |
| the group | 1912 × 1281 px, a column; the viewport 1186 px — the third tile cut | 1912 × 294 px, one row | 966 × 600 (= the viewport, no margin) | 966 × 124 |
| a tile's print | floater · titanium · power · heat — on EVERY tile | ONE sprite — its own |  same | same |
| after the choice | the group 719 → 2000 px under a commit row at 1838 | the commit row clear under the group | | |

Frames: `screenshots/variant-tiles/{before,after2}/` (the stand `screenshots/variant-tiles/stand.spec.ts`, outside
git); the play composer re-shot on the same build: `screenshots/tr51/vchoice/` (two tiles at the cap, the print a
hero, the caption under it).

## 4 · Guards

- `tests/models/actionBranchPrinted.spec.ts` — Atmo Collectors (three segments, references into the row, the whole
  box for the lone branch), Asteroid Rights (the production plate / the titanium), `assignPrintedAlternatives`
  (order-free claims, no-overlap and tie refusals, `M€`, plurals), and the CORPUS worklist: every in-scope action
  card's shared row is sliced whole or not at all, every segment a face reference, no two branches the same; the
  rows the print cannot split are a frozen list (`KNOWN_UNSLICED` — Robinson Industries) — a card leaving it is
  locked in, a card arriving on it is named.
- `tests/client/components/console/ConsoleVariantChoice.spec.ts`, `tests/console/variantChoiceModel.spec.ts`,
  `composerRender.spec.ts` — the paint and the chips unchanged.
- e2e `console-variant-tiles` (fhd + tv4k): the slice (one sprite per tile, the same resource its chip names, no
  price on a tile), the fit (`data-variant-axis="row"`, one `offsetTop`, zero scroll, the commit row clear, no
  `[console-overflow]`), the grammar (←→ wrap, ↓ held by the gate, «Вариант» in the bar, ONE seal, the recede, ↑
  re-entry) and the landing (heat 6 → 10 on the server); Asteroid Rights' interior OR.
- The walks of `console-spaceship-recycling`, `console-expedition-mechs` and `console-action-resource-pick` sweep a
  side-by-side group with → (`data-variant-axis="row"`) — invariant 14, the same diff.

## 5 · Traps

- A tile whose print is a `.pcard-effect` box (a row of its own) prints the card's bordered action box — that IS the
  card's object; do not re-frame it.
- `printedAlternatives` reads `rows[2]` of the action box (cause · delimiter · result); a seam in the CAUSE is not an
  alternative (the DSL never writes one).
- The slice is cosmetic by construction: the submitted branch is `branch.index`, the mapping only decides the
  graphic — but a wrong graphic is a lie, so the matcher refuses rather than guesses.

## 6 · The FOURTH layout — the PALETTE (TR54, 2026-10-16)

`layout: 'palette'` — N options of ONE kind («which of the six standard resources», «which production»). Before it the
question had four dialects: six SENTENCES in the action composer's list (Astrodrill — «Получите 1 титан … [Ti] 500 → 501»
across a 2000 px column, the icon in a chip at the row's end), six BARE ICONS in the live task host (no number, no
`current → resulting`), production chips with no hero in the Industrialists' action, and nothing for a play.

- **The tile**: the HERO is the resource's own sprite at the scene's scale (`VariantChoiceOption.hero` — `{kind:
  'resource' | 'production', icon, amount?, direction}`; a production on the face's riveted bronze plate), the NUMBER
  («+3», «−1», a zero bare — `heroFigure`) the tile's loudest text, the READING (the host's chip) a step quieter; no
  words (the title is the aria name only). A quiet tile (the server's «no effect» — TR54's «production 0») keeps its
  place: the hero and the number a step back, the line inside.
- **The row**: equal tiles sharing ONE line (`flex: 1 1 0`, `min-width 4.6rem`, `max-width 7.5rem` / TV `8.5rem`),
  centred; the cluster's own width folds them 3 + 3 (`@container (max-width: 31rem)`), never 5 + 1.
- **No medallions** — the group is one object; its KICKER (`kicker` + `emblem: 'wild'` — the face's own `wild.png`,
  «any one standard resource») carries the exclusion, plus the «why» when every option counts the same thing.
- **Read, never declared**: `paletteOf(options, min = 3)` over `heroOfEffect(the option's own first chip)` — a stock
  gain / a production of a standard resource; the hosts are the play composer (TR54's six branches), the action
  composer's or-pick (Astrodrill), the Industrialists' two rows (`min = 2`), the live `resource` prompt (the server's
  `SelectResourceModel.amount`).
- **The token is born on the printed «?»** — `consoleActionCommitMotion`'s `wild` needle + the rung «a standard resource
  the row prints nowhere → the k-th bare «?»» (`bareWildIcons`, `wildChosen`), and the play scene's `heroWildOrigin`.

Measured (4K): the play composer's palette 2018 × 479 px in a 2106 px column, the hero 92 px against the reading chip's
52 px icon; fhd 1231 × 189, the hero 38 px against 21. Guards: `variantChoiceModel.spec` § THE PALETTE,
`ConsoleVariantChoice.spec` § THE PALETTE, `consoleActionCommitOrigins.spec` § the printed «?», `taskHostResourcePalette.spec`;
e2e `console-overclocked-equipment` (fhd + tv4k), the translated `console-action-resource-pick`, `console-parliament-actions`
§ Industrialists palette · tv4k, `console-prompt-family` § resource-palette. Contract: `docs/TURMOIL_REDUX_OVERCLOCKED_EQUIPMENT.md`.

## 7 · A payload names its ADDRESSES (TR56, «КУДА ЛЯЖЕТ», 2026-10-16)

An option that puts N of a resource on ANY card answers WHAT — and the half of the decision that differs most between
kinds is WHERE: each kind has its own set of holders. The tile shows them (`VariantChoiceOption.destinations` ←
`variantDestinationsOf(branch)` — the server's candidates of the branch's ONE gain pick, never a client search): up to
three holder faces fanned under the print (`ConsoleCardFaceLite` with the live models — the capsules state what each card
holds) beside «N карты на выбор» / the one holder's name; a fixed box (choosing repaints, moves nothing). A printed payload
with its addresses carries no sentence and no «+N на карту» chip (the print says both). A refused option has none — its
reason speaks. The same payload is then the target row's label («КУДА: [печать]») and the target step's contract line,
carried in by a FLIP — one language on every level (`docs/TURMOIL_REDUX_ROBOTICS_FACTORY.md` § 3).

Measured (4K, `robotics-factory`): three tiles in one row of a 2106 px column, addresses 1 · 1 · 2, the face zoom
`.16 × --con-ui-scale` (TV) / `.14` (fhd). Guards: `variantChoiceModel.spec` § «КУДА ЛЯЖЕТ», `ConsoleVariantChoice.spec`;
e2e `console-robotics-factory` (A).
