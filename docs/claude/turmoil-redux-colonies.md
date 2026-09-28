# Turmoil Redux COLONIES — the replacement tiles (Pluto, 2026-09-28)

The Turmoil Redux rulebook replaces some Colonies tiles with its own. The first
one shipped is **Pluto**: same placement bonus (draw 2), same colony bonus (draw
1, discard 1), a different trade income — DATA ×[1, 1, 2, 2, 3] at track
positions 1–5, CARDS ×[2, 3] at 6–7 — plus one rule: «when the colony marker is
at its lower positions, a player must have a card that can accept data
resources if they want to trade with Pluto. Any marker-advancing bonuses are
factored into this restriction.»

Two things in the shared layer did not exist before it, and both are general
(the next Redux / community tile joins by declaring, not by wiring):

---

## 1 · The income's KIND is per-position (`ColonyMetadata.trade.type`)

`trade.type` is `OneOrArray<ColonyBenefit>` — exactly as `trade.resource` was
already per-position (Europa, Mercury, Hygiea). `build.type` and `colony.type`
stay single.

**The ONE reading is `tradeBenefitAt(metadata, position)`** in
`src/common/colonies/ColonyMetadata.ts` (`{type, quantity, resource}` resolved
together; `tradeBenefitTypes(metadata)` lists the distinct kinds for the
claims). Nobody indexes the arrays by hand: the server pays it
(`Colony.handleTrade`, the manifest's `tradeIncome`), the preview plans it
(`colonyTradePreview.ts`), and every client surface draws it — the tile
(`ConsoleColonyTile` / `ColonyTile`), the track instrument
(`ConsoleColonyTrackInstrument.tradeBenefitAt`), the dossier
(`ConsoleColonyInspect.tradeBenefitNow`), the stage
(`ConsoleColonyFocusStage.tradeBenefitAt` / `resourceLost`), the shared plan
(`colonyTradePlan.rewardAtPosition` → `tradeOutcome` / `colonyRewardPackage`).
A reader that resolved the resource but not the kind would draw «3 cards» over
three data — the compiler is the worklist (the type change fails every raw
`trade.type ===` read).

Corollaries:
- `Colony.trade`'s `ask` decision compares the income's IDENTITY
  (`rewardKindAt` = kind + resource): a change of kind (data → cards) is a
  different reward exactly as Mercury's heat → steel is. For every existing
  colony the decision is unchanged.
- `recordTradeTrackBonus` (analytics): the extra reward of an advance across a
  kind boundary is the whole new reward.
- `colonyTradeMayDrawCards` / `colonyTradeAsksCardTargets` (the workspace
  CLAIMS) look at every position the track can reach — a claim may over-claim.

## 2 · A colony may REFUSE a player its trade — a rule of the tile, co-located

```
IColony.tradeIncomeBlockedReason(player, position): string | undefined   // the rule, per landing
IColony.tradeTrackPlan(player, bonusTradeOffset = 0): TradeTrackPlan     // reach × policy × refusals
IColony.tradeBlockedReason(player, bonusTradeOffset = 0): string | undefined  // = plan.blockedReason
```

- **The rule lives in the colony's own file** (`PlutoRedux.tradeIncomeBlockedReason`:
  a data position with no holder — the SAME candidate set the payout uses,
  `AddResourcesToCard.getCards`, WARE wildcard included — refuses with
  `PLUTO_REDUX_NO_DATA_HOLDER_REASON`, an English i18n key). The base class
  refuses nobody. Never a central table (invariant 8): Titan / Enceladus /
  Miranda / Iapetus II keep paying into nothing with the honest «ресурс
  пропадёт» line, because their printed rules do not forbid the trade.
- **`tradeTrackPlan` is the ONE arithmetic** `Colony.trade` executes and the
  read-only preview plans from — the offset's reach (`current + tradeOffset +
  bonusTradeOffset`, capped), the advance POLICY (`yes` → only the farthest
  step, `no` → only the current, `ask` → every step of the reach), minus the
  landings the colony refuses. The rules' example falls out of it: 4th position
  + 2 reaches the 6th (cards) → legal, FORCED (only one legal landing, no
  question); + 1 reaches only the 5th (3 data) → `blockedReason`, read at the
  farthest reach. `minSteps` is the floor of the legal range; `ask` only when
  the legal landings pay different things.
- **The offer and the submit** (`player/Colonies.ts`): `tradeableColonies(game,
  player, bonusTradeOffset)` / `blockedColonies(…)` / `tradeColonyPick(…)`
  in `ColoniesHandler` (every trade picker — the action, Titan FLP, Darkside,
  Collegium, Huygens — lists the refused colonies DISABLED with the reason,
  never dropped). The action's offer reaches as far as the LONGEST usable
  payment path (`IColonyTrader.bonusTradeOffset` — the Unity action's +1;
  `Colonies.bestBonusTradeOffset()`), and the chosen path re-judges at the
  submit BEFORE anything is paid (`InputError` with the reason — the rare
  «M€ where only the Unity step lifted the refusal»). `tradeBlockedReason()`
  (player-level, backs `canTrade()` / `potentialTradeCount`) names the refused
  colony's own reason when it is the only open one — «no colony available»
  would hide a tile that is plainly on the table.
- **A bulk trade** that reaches a refused colony (Trade Advance: «trade with
  all active colonies») is a NAMED skip in the journal
  (`${0} cannot trade with ${1}: ${2}`), never a payout into nothing.
  **COPY_TRADE** (Mercury's build bonus) disables the refused colony at its
  standing position.
- **`IncreaseColonyTrack(player, colony, steps, minSteps)`**: the ladder runs
  `steps … max(1, minSteps)`; below the floor the steps are DISABLED with the
  colony's reason at that landing; «don't increase» exists only when 0 is
  legal. Index mapping for the pre-collected answer is unchanged (`steps − N`).
  The preview's `trackChoice` carries `minSteps`; the console composer's
  ladder stops at it. (Known limit: the composer does not RENDER the refused
  rungs disabled — today no colony can reach `minSteps > 0 && ask`: Pluto's
  refused positions are all data, its legal ones all cards, one kind each
  side, so the question is never asked with a floor.)

### The client never derives the refusal — the server publishes it
`PublicPlayerModel.colonyTradeBlocks: [{colony, reason}]` (per seat, read at
the seat's best reach; `ServerModel`). The console's ONE «why can't I trade
here» ladder (`colonyTradeReason.ts`) takes it as `colonyBlock` — rung 1b:
INTRINSIC (a hard ✕ on the tile, the dossier's verdict, the stage's refusal),
after a docked fleet, before the fleet count and the turn. Without it the
ladder would have said «not enough resources» on the player's own turn (an
open action menu with no offered trade — exactly Pluto as the only open tile).
The open trade prompt says the same thing as `disabledColonies`.

## 3 · A replacement is a REPLACEMENT (`ColonyDealer.withReduxReplacements`)
`TURMOIL_REDUX_REPLACEMENTS` (`common/colonies/AllColonies.ts`: base → Redux)
is applied to the dealt pool AND to a hand-picked `customColoniesList`: with
the expansion «Pluto» becomes «Pluto Redux»; without it a stored preset naming
«Pluto Redux» falls back to the base tile. Never both in one game. The tile is
its own `ColonyName` (`'Pluto Redux'` — identity, i18n key, art alias
`.Pluto-Redux-background/-title` in `colonies.less`), module `turmoilRedux`
(`getColonyModule`), RU/UA name «Плутон» (the printed face says PLUTO; only one
Pluto ever exists in a game), same lore sentence as the base tile.

## 4 · Adding the next Redux colony
1. `ColonyName` + `TURMOIL_REDUX_COLONY_NAMES` (+ `TURMOIL_REDUX_REPLACEMENTS`
   if it replaces a base tile) + `COLONY_DESCRIPTIONS`.
2. `src/server/colonies/<Name>Redux.ts` — metadata (`lore`, per-position
   `trade.type` if the kind moves), `shouldIncreaseTrack: 'ask'` when the
   track pays different things, an override of `tradeIncomeBlockedReason` ONLY
   for a printed rule of the tile.
3. `TURMOIL_REDUX_COLONIES_TILES` in `ColonyManifest.ts`; `npm run make:cards`.
4. LESS art alias; RU/UA `colonies.json` (name, description, any reason key);
   `lore_texts.json` if the sentence is new; `colonyLore.spec.ts` scope.
5. A spec in `tests/colonies/` (the rulebook's sentences one by one — see
   `PlutoRedux.spec.ts`) and, if a surface changes shape, an e2e journey
   (`console-colony-pluto-redux.spec.ts` is the reference: the tile, the
   dossier, the stage, the lobby chip).

## Guards
`tests/colonies/PlutoRedux.spec.ts` (32: the tile, the refusal, the rules'
+2 / +1 example, the ask floor, the preview, the dealer, serialization) ·
`tests/client/components/colonies/colonyTradePlan.spec.ts` § per-position kind ·
`tests/client/components/console/colonyTradeReason.spec.ts` § server refusal ·
`tests/client/components/colonies/colonyLore.spec.ts` (scope widened) ·
`tests/e2e/console-colony-pluto-redux.spec.ts`.
