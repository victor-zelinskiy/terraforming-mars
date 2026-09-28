# Turmoil Redux COLONIES — the replacement and addition tiles (Pluto · Venus, 2026-09-28)

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
   if it replaces a base tile — an ADDITION with no base twin is simply absent
   from the map; `isTurmoilReduxAddition` derives it) + `COLONY_DESCRIPTIONS`.
2. `src/server/colonies/<Name>Redux.ts` — metadata (`lore`, per-position
   `trade.type` if the kind moves, `trade.fixed` if every trade pays one thing
   BESIDE the marker), `shouldIncreaseTrack: 'ask'` when the track pays
   different things, an override of `tradeIncomeBlockedReason` ONLY for a
   printed rule of the tile (the M€ fee it may need arrives as `TradeTerms`).
3. `TURMOIL_REDUX_COLONIES_TILES` in `ColonyManifest.ts`; `npm run make:cards`.
   If the tile needs another expansion to mean anything (Venus Next for a
   Venus step), the DEALER keeps it out without that expansion — decide and
   write the reason in the class doc.
4. LESS art alias; RU/UA `colonies.json` (name, description, any reason key);
   `lore_texts.json` if the sentence is new; `colonyLore.spec.ts` scope.
5. A spec in `tests/colonies/` (the rulebook's sentences one by one — see
   `PlutoRedux.spec.ts` / `VenusRedux.spec.ts`) and, if a surface changes
   shape, an e2e journey (`console-colony-pluto-redux.spec.ts` is the
   reference: the tile, the dossier, the stage, the lobby chip;
   `console-colony-venus-redux.spec.ts` adds the hosted Parliament step).
6. A new `ColonyBenefit` goes LAST in the enum (its number is exported to
   `genfiles/colonies.json`), with a `giveBonusImpl` case, a `colonyTradePlan`
   reading (`pushBenefit` / `describeBenefit` / `rewardDestinationKey`), a
   `BenefitGlyph` branch and a preview `note` kind if it defers a prompt.

## 5 · VENUS — the ADDITION tile (2026-09-28)
The rulebook's Venus: build «add 2 delegates to a resolution» (×3 berths),
colony bonus «draw a card, then discard a card», trade «terraform Venus 1
step, AND gain the bonus indicated by the colony marker» — −4 M€ · nothing ·
1 floater · 1 floater · 2 floaters · 1 delegate · 2 delegates — and two
refusals: «at its 1st position and you do not have the EXTRA 4 M€, you cannot
trade»; «at 3–5 and you have no card that can accept floaters, you cannot
trade». Starts ACTIVE, any player builds. Class: `src/server/colonies/VenusRedux.ts`.

**Naming — `VENUS_REDUX`, an ADDITION.** The community «Venus» (draw a card +
buy, an activation gated on a Venus tag) was DELETED outright (2026-09-28):
the two tiles share nothing but a planet, and reusing the enum member would
have made an old save's community colony silently become this one (its
`trackPosition`, `colonies` and `visitor` mean something else). The retired
name is gone from `ColonyName`; `ColonyDeserializer.deserializeAndFilter`
DROPS an unknown colony with a warning, so an old save loads without it
(`VenusRedux.spec.ts` § serialization). A stored `customColoniesList` naming
«Venus» (the community tile) is dropped the same way — there is no twin to
fall back to — and one naming «Venus Redux» is honoured only with the
expansion (`ColonyDealer.reduxReplacementFor` → `undefined` → filtered).

**Venus Next is REQUIRED (a project decision — the rulebook is silent).** The
fixed income terraforms Venus; without the expansion there is no scale to
move and every trade would silently lose its main effect (cross-cutting
invariant 4). `ColonyDealer` keeps the tile out of a game without Venus Next,
exactly as it kept the retired community tile out. With the expansion, a
scale at its MAXIMUM is the one case the step pays nothing — and the journal
says so (`Colony.giveBonusImpl` INCREASE_VENUS_SCALE logs the raised steps or
«cannot raise … already at its maximum»).

**The composite income is DATA, not a hook — `ColonyMetadata.trade.fixed`
(option «в»).** `FixedTradeIncome {description, type, quantity, resource?}`
sits beside the per-position `type` / `quantity`; `tradeFixedIncome(metadata)`
is the one reader. Rejected: (а) «a sequence of rewards per position» would
put the Venus step into all seven cells and hide that it is one rule, and
(б) a server hook the client cannot see would leave the tile / dossier /
reward package guessing. With data the server PAYS it first (`handleTrade`:
fixed → marker income → colony bonuses, the printed order; the manifest gains
`tradeIncomeFixed`), the client READS it first (`tradeOutcome` pushes the
fixed gain before the marker's; the grid tile draws «[Venus] + [bonus]» in
`data-colony-trade-fixed`; the dossier's TRADE INCOME group prints the fixed
line above the per-position one, `data-colinspect-fixed`), and the preview /
reward package carry it without a special case. The EMPTY 2nd position is a
`LOSE_RESOURCES` of quantity 0 — a zero income drawn as a void dash, never a
refusal and never a «−0» line (`giveBonusImpl` skips a zero levy);
`rewardKindAt` keeps positions 1 and 2 the same KIND, so «+1 from the 1st»
is forced onto the empty 2nd rather than asked.

**Two refusals, two English keys, one method.** `tradeIncomeBlockedReason`
(co-located) answers by the income's KIND at the position: a levy asks «fee +
4 ≤ M€» — the «EXTRA 4 M€» is judged OVER the fee the paying path takes, so
the method receives `TradeTerms {bonusTradeOffset, feeMegacredits}`
(`IColony.ts`; `tradeTermsOf` normalizes the old bare offset).
`Colonies.bestTradeTerms()` offers with the MIN fee among usable handlers (an
energy or titanium path pays 0 M€, the M€ path its whole `tradeCost` —
conservative, airtight for any mix), the SUBMIT re-judges with the CHOSEN
path's terms (`Colonies.termsOf(handler)` — an M€ path picked while short is
refused before it takes anything), and `trade()` itself runs with fee 0
(already paid). Floater positions ask `AddResourcesToCard(player,
FLOATER).getCards()` — the SAME candidate set the payout uses, wildcard
holders included. Reasons: `VENUS_REDUX_NO_EXTRA_MEGACREDITS_REASON` /
`VENUS_REDUX_NO_FLOATER_HOLDER_REASON` (RU in `colonies.json`); the server
publishes them through the existing `colonyTradeBlocks` (now computed with
`bestTradeTerms()`), so every console ladder speaks them unchanged.

⚠ **The Greens' STARTING RULE pays 2 M€ per TR step, and the Venus step IS a
TR step** — a Redux game with an empty government seat pays it on every
trade. Real and correct (the journal names the Greens), but a spec asserting
the tile's own M€ arithmetic seats a quiet Mars First government first
(`seatEnacted(parliament, ARCHITECTURE_AWARD_ID)`) and checks the interplay
in one `it` of its own.

**«Add N delegates to a resolution» is `ColonyBenefit.PLACE_DELEGATES_ON_RESOLUTION`**
(a new benefit, not a branch of `PLACE_DELEGATES` — that one is classic
Turmoil's party delegates) → `parliament/PlaceDelegatesOnResolution.ts`, a
`DeferredAction` the trade income (×1 / ×2) and the build (×2) both queue.
It NAMES every skip (no Mars Parliament · a seat that takes no part · no
resolution up for a vote · an empty reserve) and a SHORTFALL («only 1 of the 2
delegates in reserve»), then asks a `SelectParty` marked `votePrompt {source:
'grant', cost: 0, count, printed}` + `choiceContext {source: colony, mode:
'reward'}` — the player SEES the target (invariant 3) and the answer places
`count` cubes from the reserve via `Parliament.placeVote(…, 'reserve')`,
reporting the quest. The server's `voteModel` projects the grant's count
(`pendingDelegateGrantCount` → `projectVote(…, count)`), so the forecast on
every card is honest for ×2.

**The vote is an EMBEDDED STEP of the flow that paid it (the most important
requirement).** `followUpStepStage('party', wf)` answers `'Voting'` for a
grant marker (`DELEGATE_GRANT_STEP_STAGE`), so while the door waits the flow
OWES the step (`owed-step` hold, the crumb already names it). The shell's
`party` branch: with a live host (`workspaceHostForStep()` ≠ parliament) it
sets the host's phase `committed` and pushes a `parliament` frame (`serves:
['party']`, prompt-anchored, `nest` when a parliament root already stands —
the Unity door's `parliament ⊃ card-actions ⊃ colonies ⊃ parliament`); with
no host it falls back to the standalone `enterWorkspace('parliament')`. The
section is ONE instance: `ConsoleShell` teleports it into
`workspaceFrameTarget('parliament')` with `embedded` (no `con-ws`, no
`ConsoleWsHead`, no `data-motion-surface` — the seats ledger rides a small
toolbar instead of the head; the crumb goes UP through `frameCrumb`: subject
'' + stage), the colonies host publishes
`[data-embed-slot="colonies-parliament"]` (`frameSlotSelector`, `flush:
'post'`, republished on mount) as a full-stage zone the browse layer yields
to, and the section mounts STRAIGHT into the vote pose (`armGrantVoteFlow(slot)`
before the first render + `playFreshEntrance` in `mounted()`; the slot with
most of the seat's own cubes, else the first offered). The vote mode speaks
the grant (`bridge.grant` → «×2 из резерва · бесплатно», «Отправить
делегатов», the ledger's kicker «Ваши делегаты», B = «Свернуть»), submits the
PLAIN party response (`grantResponse`), flies `count` cubes from the reserve
in turn (`flyDelegates`, `pendingSeqs` / `landedSeqs`, `sourceHoldCount`),
and on the landing `onParliamentFlowComplete` POPS the hosted frame, after
which the host's own owed conclusion fires (`onColonyFlowComplete` for a
colonies ROOT — `concludeWorkspaceFlowOrOwe`; a colonies STEP is left to its
host's ending). `consoleTaskSummary` names the deferred grant «Add delegates
to a resolution» under the Parliament kicker. Surfaces paid for on the way:
`ConsoleColonyTile.__cell-fixed` must be `inline-flex` (a bare span let the
block-level glyph take the value's width and the «+» wrapped under the
label); the Venus sprite is a 3:2 OVAL and keeps its aspect in every glyph
box (`.benefit-glyph__tile.venus-tile`).

**Five laws the LIVE journey paid for (2026-09-28, `console-colony-venus-redux.spec.ts` § the step):**
1. **The colony follow-up is LIVE while the colony's own grant stands, and while its vote is hosted inside.**
   `colonyFollowUpLive` used to fall the response the build's cube landed — one response BEFORE the
   grant prompt was admitted — so `settleColonyFollowUp` popped the colonies frame, the std-projects
   host concluded over an empty stack, and the vote rose as a STRANDED prompt («Этот запрос пока
   недоступен»). Two terms now: `colonyGrantStepLive` (a `grant` vote marker whose `choiceContext.source`
   is a colony — the server names the giver) and `workspaceFrameHost('parliament') === 'colonies'`
   (the step stands, or its cubes are still landing). The frame leaves on the POP, never before.
2. **A standing grant is ANSWERABLE, full stop.** `ConsoleParliamentSection.canVoteNow` returned
   `canActNow` (= «no decision owed») for it — and the owed decision WAS the grant, so the CTA read
   «Сначала завершите текущее действие» over a live vote while the bar offered «A Отправить делегатов».
   A grant short-circuits to `true`; the ordinary vote keeps the gate.
3. **The carried object is the GIVER, latched.** The colonies' `crumbSubject` read the focus stage,
   which folds a beat before the vote opens — the crumb said «СТАНДАРТНЫЕ ПРОЕКТЫ › КОЛОНИЯ ›
   ГОЛОСОВАНИЕ» (the std project's own subject). The shell passes `grantColony` (the marker's
   `source.name`), the section latches it (`grantSubject`) for the hosted step's whole life — the
   prompt is gone at the submit while the cubes still fly — and clears it when the step leaves.
4. **A held std-projects ending must keep its flow record.** `endStdProjectsFlow` reset the record
   BEFORE concluding; the conclusion held on `nested-step` (the vote inside the colonies inside the
   project), and the re-ask (`stdpConclusionSignal` → `stdProjectsFlowLive()` first) returned early
   for good: the finished project stood in its browse list, «B Закрыть». Conclude first; reset on
   dismiss — the watcher re-asks when the step lets go and the flow LEAVES for the board.
5. **A hosted step keeps its embedded chrome through its LEAVE.** The frame pops first, so
   `workspaceFrameTarget('parliament')` is `undefined` for the whole dissolve, `embedded` flipped
   false and the leaving surface re-rendered as a standalone band (`con-ws` + its own head) for
   240 ms — the probe's «a standalone Parliament band stood». The shell latches the zone
   (`parliamentEmbedLatch`): `parliamentEmbedActive` and the teleport target hold it while
   `parliamentLeaving`, released with the leave.
Diagnosing a silent door: `window.__wsTrace = true` prints every frame-removing verb with its
caller's stack, and `__conColonyDiag()` states the stack + the colony flow's facts — read those
before theorising (two runs here went to guesses first).

**Guards (Venus):** `tests/colonies/VenusRedux.spec.ts` (39: the printed tile,
every position pays + the Venus step under a quiet government and under the
Greens' starting rule, the zero income, both refusals with fee terms / the
offer / the submit / `colonyTradeBlocks`, the offset both ways, the grant ×2
with shortfall / empty reserve / no slots / no parliament / an illegal party,
the dealer as an addition ± Venus Next, serialization + the retired tile's
save) · `colonyTradePlan.spec.ts` § a FIXED trade income ·
`consoleParliamentModel.spec.ts` § the DELEGATE GRANT bridge ·
`consoleTaskRouter.spec.ts` § a grant is a step · `consoleTaskSummary.spec.ts`
row · `colonyLore.spec.ts` scope · e2e `console-colony-venus-redux.spec.ts`
(the reading + the hosted step).

## Guards
`tests/colonies/PlutoRedux.spec.ts` (32: the tile, the refusal, the rules'
+2 / +1 example, the ask floor, the preview, the dealer, serialization) ·
`tests/client/components/colonies/colonyTradePlan.spec.ts` § per-position kind ·
`tests/client/components/console/colonyTradeReason.spec.ts` § server refusal ·
`tests/client/components/colonies/colonyLore.spec.ts` (scope widened) ·
`tests/e2e/console-colony-pluto-redux.spec.ts`.
