# TR54 Overclocked Equipment («Разогнанное оборудование») + the iteration «ПАЛИТРА СТАНДАРТНОГО РЕСУРСА»

**Status.** Shipped 2026-10-16. The prompt: `docs/claude/prompts/project-tr54-overclocked-equipment.md`. The rule lives in
`.claude/rules/console-ui.md` § THE VARIANT CHOICE IS ONE GRAMMAR (the fourth layout) and `docs/claude/console/variant-choice.md` § 6.

## 1 · The card

Green, 9 M€, a Power tag, the INDUSTRIALISTS' plate (the TR15 class — they rule, or 2 of the player's own delegates on
their resolution). «Also pay 3 energy. Pick a basic resource type. Gain an amount of that resource equal to your
production of it.» Lore: «It even comes with RGB lighting!». Art: `Mars Arts/TR54.png` (UBTech), imported as
`assets/card-images/TR54.webp`.

- **The price is a DECLARATION** — `behavior: {spend: {energy: 3}}`: the executor takes the energy with the play
  (`Executor.execute`, before `bespokePlay`), `canExecute` refuses the play below 3, and the hand names ONE blocker
  through the play ladder's new `spend` rung — `spendStockReasons` (`models/actionUnavailableReasons.ts`), the action
  ladder's own rung, now shared by both doors.
- **The question is ONE builder** (`OverclockedEquipment.resourceOptions`) read by the live `OrOptions` and by the
  preview's six `orBranches`: six `SelectOption`s in the RAIL's order (M€ · steel · titanium · plants · energy · heat),
  each `gainStock(player, res, max(0, production))`, the energy row read AFTER the price in the preview (the live
  option reads the paid stock), the `or` marked `cardEffect(…, 'reward')`. Never an auto-pick: five zeros are five
  answers.
- **A zero is a NAMED verdict, never a skip** — `actionFutilities.noProduction(production)`: «Production 0», a negative
  M€ production «Production −1 → gain 0» (RU «производство −1 → 0»), on the option (`OptionMetadata.futile`) and on the
  branch (`ActionPreviewBranch.futile`). The journal reads «gained 0 titanium» — the player's own choice, no
  `effect-skipped`.
- **A counted CHOICE, read as its ceiling**: every gain chip carries its basis (`counted(…, {label: 'Your production'})`);
  no `countedPlayForecast` (six counts are a CHOICE — the plate never shows six gains as if all landed); the hand plate reads
  «[?] up to +N» — `ICard.countedChoiceForecast` → `CardModel.countedChoice {max}`, the plate's third reader.

Spec: `tests/cards/turmoilRedux/OverclockedEquipment.spec.ts` (rules 1–12).

## 2 · The palette — what it replaces

«Which of the six standard resources» was asked in four dialects: six SENTENCES in the action composer's list
(Astrodrill — `screenshots/console-action-resource-pick/tv4k-1-resource-step.png`: «Получите 1 титан … [Ti] 500 → 501»
across a 2000 px column, the icon in a chip at the row's end), six BARE ICONS in the live task host (no number, no
`current → resulting`), production chips with no hero in the Industrialists' action, and nothing yet for a play.

**ONE layout of `ConsoleVariantChoice` — `palette`** (`variantChoiceModel.paletteOf`, `heroOfEffect`, `heroFigure`):

```
        [?] ОДИН ИЗ 6 · ВАШЕ ПРОИЗВОДСТВО            ← the kicker: the printed «?» (wild.png) + the exclusion (+ the «why»)
 ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
 │ [M€] │ │ [St] │ │ [Ti] │ │ [Pl] │ │ [En] │ │ [He] │  ← the HERO: the resource's own sprite at the scene's scale
 │   0  │ │  +2  │ │   0  │ │  +3  │ │  +1  │ │  +4  │  ← the NUMBER: the tile's loudest text
 │ ○ пр.│ │ 0→2  │ │ ○ пр.│ │ 0→3  │ │ 2→3  │ │ 0→4  │  ← the READING (the chip) — or the quiet line of a zero
 └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘
```

- One row of EQUAL tiles (`flex: 1 1 0`, `min-width 4.6rem`, `max-width 7.5rem` / TV `8.5rem`), centred; the cluster's
  own width folds them 3 + 3 (`@container (max-width: 31rem)`), never 5 + 1.
- No «ИЛИ» medallions — one object; the kicker (with the printed «?» at its start) carries the exclusion.
- The three facts, three paints unchanged (cursor · seal · rules); a quiet tile's hero and number step back, its line
  inside. A production hero stands on the face's riveted bronze plate.

## 3 · The hosts

| Host | Reads | Kicker | Walk |
| --- | --- | --- | --- |
| H1 the play composer (TR54) | every branch's own first chip is a stock gain (`variantHeroes`) | «Один из N · <the basis>» | ←→ the row (`variantGroupNav`), the bar «◄► Ресурс» |
| H2 the action composer's or-pick (Astrodrill) | every option's chip (`listHeroes`) | «Один из N» | ←→ (wrapping), ↑↓ kept |
| H3 the Industrialists' action | each row's production chips | the row's own head | the composer's own cursor |
| H4 the live `resource` prompt | `SelectResourceModel.include` + `amount` | «Один из N» | the host's own path |

## 4 · The token is born on the printed «?»

`consoleActionCommitMotion`: the needle `wild` (`wild.` — never the desktop's `wild-std`) and ONE rung — a STOCK gain
of a standard resource the scope prints nowhere is born on the k-th bare printed «?» (`bareWildIcons` — never the one
inside a production frame), only then the plate (`wildChosen`); `resolveResultIcon('resources')` the same. The play's
landing scene (`consolePlayedHero.railWaveWithPrintedVp` → `heroWildOrigin`): a standard resource chosen from the
face's bare «?» is born on it. The witness names the anchor `wild`.

## 5 · Measured

| | before | after (4K) | after (fhd) |
| --- | --- | --- | --- |
| TR54's play composer | — (no palette existed) | the group 2018 × 476 px in a 2106 px column, ONE row; the hero 92 px vs the reading chip 52 px | 1231 × 189, ONE row; 38 vs 21 |
| Astrodrill's or-pick | six sentence rows across ≈ 2000 px (`before/tv4k-1-resource-step.png`) | ONE row of six equal tiles, the hero ≥ 1.25 × the chip's box | same |
| the Industrialists' rows | chip tokens, no hero (`before/tv4k-industrialists-stage.png`) | two palettes, the production's bronze plate leading, «−1» / «+2» | — |
| the live `resource` prompt | six bare icons, no number | ONE row on the family plate, «+N» and `current → resulting` on every tile | 3 + 3 (the narrow plate) |

The commit (e2e A, both profiles): «−3» born on `rail:energy` before the gain, «+3» born on `wild`, landed on `rail:plants`,
`endsOverGlass` empty; A′ (energy chosen): the energy row reads 5 → 2 → 3 on the page's clock, two tokens in the order of
their causes. The decision column does not move on the seal (≤ 2 px).

Frames: `screenshots/tr54/{fhd,tv4k}/` (A-1 palette · A-2 sealed · A-3 after · A′ · B · B′), `screenshots/tr54/before/`,
`screenshots/parliament-actions/tv-4k/02-industrialists-stage.png`, `screenshots/prompt-family/*-gallery-resource-palette.png`
(outside git).

## 6 · Open

PL-454 — the Industrialists' «decrease» row hides a production at its minimum instead of showing it `off` with the server's
reason: the server sends no disabled options (`PartyEffects` builds only the decreasable ones) — a server change + the rail's
order. Closed on the way: PL-455 (a 3 + 3 palette walks as a GRID — `variantGroupNav` axis `grid`), PL-456 (the hand plate
reads the choice's CEILING «[?] up to +N» — `ICard.countedChoiceForecast` → `CardModel.countedChoice`).
