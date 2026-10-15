# Actions that change nothing — the «no effect» verdict

The owner's iteration of 2026-10-15: «действия, которые фактически не имеют смысла — повышают параметр, который уже на
максимуме, поиск жизни, когда ресурс науки уже лежит, конвертация тепла на максимуме температуры — при подтверждении паса
все перечисляются, хотя только сбивают пользователя». Owner's decisions (2026-10-15, AskUserQuestion):

- a card resource that only counts toward an award / milestone / chairman quest is **value while that race is live**;
- when only such actions remain, the pass confirm says it in **ONE quiet line**, never a warning list;
- the RT badge keeps **every allowed action** in its number; it is mint while ≥ 1 is useful, **white only when all are futile**;
- scope: the pass confirm, the RT badge, «Действия карт», the action composer, the LT heat tile, the standard projects.

## 1. The verdict is the SERVER's and it is PROVEN

`common/models/ActionFutilityModel.ts` — `ActionFutilityVerdict {kind, reason, parameter?, resource?}`, kinds
`parameter-maxed` · `zero-yield` · `no-target` · `vp-capped`; `ActionFutility {verdict?, branches?}` (`branches` in the
action preview's branch order; `verdict` set only when EVERY available branch is futile).

**No verdict means the action has value.** The engine never guesses: an action whose worth it cannot prove (a draw, a
choice, a bespoke effect without a hook) has none. The verdict is INFORMATION only — nothing anywhere blocks, hides or
dims-to-disabled a futile action: the player may take it to stall instead of passing.

`server/models/actionFutility.ts` — `actionFutility(player, card)` = the card's co-located hook
(`ICard.actionFutility?(player)`, invariant 8 — bespoke actions) ?? `declaredFutility` (read off the declarative
`Behavior`), then the RESCUES. `declaredFutility` judges yields: a global step at its limit, an ocean with none left
(`canAddOcean`), a `tr` / `addResources` / `stock` / `production` of exactly 0, a resource with no holder
(`AddResourcesToCard.getCards()`); `spend` / a negative amount is a PRICE, never a yield; any key it does not know is a
yield (honest by default). Card warnings (`maxtemp` …) are NOT the verdict — they mean «part of the effect is wasted»
(Ironworks at 14 % still pays its steel: the partial class is never futile).

**Rescues** — what the table answers to an apparently empty action: Whales (an ocean placed even at max), any
`onResourceAdded` reactor, a LIVE award / milestone declaring the resource (`IAward/IMilestone.cardResourceCount` — the
declaration is guarded: every award / milestone that reads a resource amount declares it), a live chairman quest
(`QuestTracker.match`), and for standard projects any `onStandardProject` card (CrediCor, Standard Technology). The engine
at a maxed parameter pays nothing (`Game.increase*` returns early — no TR, no hook, no party reward), so a maxed
parameter needs no further rescue.

Bespoke hooks (`server/cards/actionFutilities.ts`: `parameterMaxed` · `zeroYield` · `noTarget` · `vpCapped` ·
`futilityOfBranches`): Aquifer Pumping, Water Import From Europa, Search For Life, Directed Impactors, Rotator Impacts,
Forced Precipitation, Comet Aiming, Icy Impactors (spend → parameter · add), Jupiter Floating Station, Red Ships
(`paidTiles`), Floyd Continuum (`completedParameters`) — each reads the SAME helper its preview and its action read.

Where it rides: `CardModel.actionFutility` (own tableau, only while `canAct`), `ActionPreviewBranch.futile` (the
preview's exit pass, available branches only), `OptionMetadata.futile` (the heat conversion — both the 8-heat and the
Kelvinists option), `StandardProjectPreviewModel.futile` (only a target-less project whose every `tr` key is a maxed
parameter — a greenery still places a tile), `PotentialActionsModel.futileCardActions` (counted apart, still counted).

### 1.1 A threshold not reached is NOT futile (the owner's check, 2026-10-15)

A resource that lands SHORT of the card's next point (Ants 0 → 1 microbe at 1 VP per 2, Tardigrades 1 → 2 at 1 VP per
4) is a valid action: the resource is on the card. The server never claims it (`addResources` > 0 yields; the bespoke
movers have no hook; only Search For Life's single capped 3 VP is `vp-capped`). Its VP chip is a NEUTRAL fact, never
«no effect» and never a warning: `victoryPointsReading` (`server/cards/actionPreviews.ts`) adds the note
«пока без изменений · до следующего ещё N» (`resourcesToNextVictoryPoint` — the same `resourceVictoryPoints` reading),
`ActionEffectChip` paints it `--steady` (steel), and «already at maximum» is said only of a parameter
(`actionEffectReading.ts`: `victoryPointsSteady` · `gainAtParameterLimit` · `gainHasNoEffect`). The chip's VP badge rides
the chip's font-size (em) in every chip-token root — it was a 10 px speck on the 4K couch.

## 2. The surfaces

| Surface | What it does | Where |
| --- | --- | --- |
| Pass confirm | futile card actions are subtracted from «unused actions», a futile heat conversion is dropped; when nothing of value is left: ONE quiet line «Остались только действия без эффекта: N» (N = futile card actions + a futile heat conversion), no warning list, the verb calm | `console/passWarnings.ts` (pure) → `ConsoleShell.passReading` → `ConsoleActionConfirm` `quiet` |
| RT bar badge | the number = every allowed action; white (`badgeTone: 'neutral'`) and no glow when all are futile | `potentialAvailability.countTone` · `ConsoleShell` · `ConsoleCommandBar` |
| RT wheel «Действия карт» | the same tone on its badge | `consoleQuickModel` (`actionsFutile`) · `ConsoleQuickSelector` |
| LT wheel heat tile | a LIVE verb, a step quieter, the reason in place of the price; the rail's convert-heat glow off | `consoleQuickModel` (`convertHeatFutile`) · `ConsoleQuickSelector` |
| «Действия карт» | a whole-futile card sinks to its own band BELOW the blocked ones (`sortBand` 1.5 — available → blocked → nothing to gain → activated), synchronous with the view (never moves on a preview's arrival); a futile variant: steel stripe, content at .55, chip «БЕЗ ЭФФЕКТА», the reason in the meta line, the dossier's verdict «Доступно, но сейчас ничего не изменит»; the cursor opens on a useful tile; «можно выполнить» keeps the number and turns white when all are futile; the repeat pick ignores the verdict | `consoleCardActions.ts` (`variantFutility`, `sortBand`, `futileTiles`) · `ConsoleCardActions.vue` |
| Action composer | the verdict BEFORE the press — one calm line «<reason> · действие ничего не изменит», superseding the client's «one of the gains has no effect»; a branching row's futile option is a quiet live tile (`VariantChoiceOption.quiet`) | `ConsoleActionComposer` (`futileVerdict`) · `variantChoiceModel.variantQuiet` · `ConsoleVariantChoice` |
| Standard projects | the row quiets (never reordered), the foot names the verdict instead of the per-chip warning | `ConsoleStdProjectsScreen` (`rowFutile`, `focusedFutile`) |

Paint law (the console strips `filter`): the quiet state is OPACITY ON THE CHILDREN (the tile stays opaque) and a
white-on-steel register — never the amber of a refusal, never the faded print of `--off`. A futile tile keeps every live
paint (cursor ring, seal, A).

The heat conversion is detected by STRUCTURE (`turnIntents.isHeatConversion` — `globalParameter` metadata, the
temperature icon and a heat cost chip), never by its title (cross-cutting invariant 1 — the old title match died after
the first render).

## 3. Guards

- `tests/models/actionFutility.spec.ts` — the unit cases, the corpus walk (a rich seat, the open and the maxed table, the
  purity check through `game.serialize`), the award / milestone declaration guard.
- `tests/console/passWarnings.spec.ts`, `tests/console/consoleCardActionsFutile.spec.ts` (the band, the per-variant
  verdict, blocked never futile, the repeat pick, the grid filler, `countTone`, `variantQuiet`),
  `consoleQuickModel.spec` / `potentialAvailability.spec` / `turnIntents.spec`.
- e2e `console-futile-actions.spec.ts` (fhd + tv4k; fixtures `futile-only` / `futile-mixed` / `vp-threshold`): the
  white badges, the quiet heat tile, ONE quiet pass line and no list, the band under the blocked card, the cursor on a
  useful tile, the composer's verdict, the quiet std-project rows, and (C) Ants short of its next point — useful, a
  neutral VP chip, no «no effect», no amber warning — nothing sent.
- `actionEffectReading.spec` (the two readings of «N → N»), `ActionEffectChipVp.spec` (the neutral register, the
  server note over the fallback, a maxed parameter still muted).

Ledger: section AQ (PL-400…).
