# TR81 Lotus Innovations — the fourth new corporation of Turmoil Redux (2026-10-26)

«You start with 46 M€. As your first action, increase your TR 2 steps. 1 VP per 4 data resources here. EFFECT: after
each time you increase your TR by 1, including from this, add 1 data resource to this card.» Science tag, a data
holder, no production, no action. Card `src/server/cards/turmoilRedux/LotusInnovations.ts`, spec
`tests/cards/turmoilRedux/LotusInnovations.spec.ts`, art `assets/card-images/TR81.webp`, lore `TR81` (EN + RU —
printed on the scan), registry row `common/cards/turmoilReduxCorporations.ts` (`authored`).

## 1. The rule — the ONE rating funnel

Every rating gain of the game goes through `Player.increaseTerraformRating`, which asks
`onIncreaseTerraformRatingByAnyPlayer(cardOwner, raiser, steps)` of every seat's tableau under the card's effect scope
(`tr-increase`). Lotus answers its OWNER's gain only, one data per step, all the steps of one call at once (`+2 TR` is
two data in ONE record). Whatever raises the rating counts — a card's printed TR, a scale step (the engine's
`{global: true}` raise), the Venus 16 % bonus, a standard project, a step of the Career, the final greenery — and what
the funnel REFUSES pays nothing because the hook never runs: the UNMI veto (RX42), the step Preservation Program eats
(the rest of the call is counted). «Including from this»: the corporation is in the tableau when its own first action
(`firstAction: {tr: 2}`) raises the rating — no special case. 1 VP per 4 data (`victoryPoints: {resourcesHere: {}, per:
4}`, the Arklight form). Lotus is the first card of the premium scope with this hook (TR26 / TR28 only mention it).

## 2. THE RATING PASS — one arithmetic for every answer to a rating gain

The forecast engine had no mirror of the rating hook: `reactsToGrant` knew no `tr` grant and `FORECAST_HOOK_PAIRS` had
no pair, so a composer promised nothing for Lotus — not even an `unknown`. Now (`server/models/effectForecast.ts`):

- **`ratingStepsOf(player, grants, effects, tiles)`** is THE operation's rating, `{now, placed}`: `now` = the explicit
  `tr` grants + every `global` grant's steps + the bonus steps the raise crosses (`scaleBonusPass`'s extra); `placed` =
  what the TILES the operation places carry (an ocean's step, a greenery's oxygen step where the scale has room and the
  Redux tile's own — `vetoedRating.tileRatingEvents`, the veto pass's own reading of a tile). The veto: a seat first by
  rating gains nothing; below the top, the struck IMPLIED steps are taken off the tiles first (the funnel judges them
  last) — an explicit struck chip already made no grant and is never subtracted twice.
- **The ruling Greens read it** (`partyFacts`): «2 M€ per step» now (`greens-tr`) and — new — for a placed tile after the
  placement (`greens-tr-placed`, `deferred`: Ice Asteroid's two oceans, Mangrove's greenery). Two readers, one sum, so the
  Greens' fact and Lotus' can never disagree.
- **`ratingRaiseFacts`** offers the sum as ONE `tr` grant to every seat's `onIncreaseTerraformRatingByAnyPlayer`
  reactors (the live walk's order): `exact` for the press's own steps, `deferred` / `after-placement` for a placed tile's;
  a reactor with the hook and no twin is ONE honest `unknown`; a world move raises nobody's rating. Its facts cascade
  like any first-order fact (a data → its readers). It runs beside `partyFacts` in every door: the play / action
  composer (`buildForecast`, per branch too) and every reward outside a composer (`rewardReactionFacts` — a standard
  asteroid, a fleet dock's TR).
- The pair `{live: 'onIncreaseTerraformRatingByAnyPlayer', forecast: 'grantForecast'}` is a row of `FORECAST_HOOK_PAIRS`:
  the coverage guard demands the twin of every future rating reactor; the parity guard plays a trigger with an explicit
  TR (Release of Inert Gases) and asks the foreign table too.
- Lotus' twin: `grantForecast` → `grant.kind === 'tr'` for its owner → ONE `exact` fact on its effect row
  (`printedEffect: 0`), `cardGain(this, N)` — «+N [data]» on this card. A rival's raise: nothing (not a `no` fact).

Guards: `tests/models/ratingRaiseFacts.spec.ts` (explicit · scale · Venus 16 % · placed tiles deferred · veto · world ·
a rival's reactor · one unknown per card · the Greens and a reactor on one sum · the partial veto),
`effectForecastCoverage` / `effectForecastParity`.

## 3. The first action's preview carries the forecast — and the start stage is a door

`models/corpFirstActionPreview.ts` attaches `forecast` (`effectForecastForAction` over the first action's branch — the
forecast's law 8: the same route, the same version key, no new fetch), absent when nothing answers. The start stage
«СТАРТ ПАРТИИ › КОРПОРАЦИЯ › ПЕРВОЕ ДЕЙСТВИЕ» draws the «Сработает» row under the result (the shared
`ConsoleForecastRow`, `[data-start-firstact-forecast]`), R3 opens the «Эффекты» layer — a LEVEL inside the stage
(host `'start'`, `.con-start__fxhost` is the room right of the seat; the briefing parks, the seat stays), the crumb
reads «… › ПЕРВОЕ ДЕЙСТВИЕ · ЭФФЕКТЫ», the bar the explorer's own; the press folds it.

## 4. The start stage — the THIRD ATTACHED host of the card-reaction framework

The first action used to TICK its rating with the commit, and Lotus' answer went to the STANDALONE chain — the
corporation surfacing at a seat beside the rail while its own card stood on the start stage. Now
(`console/startFirstActionRail.ts`): ARM at the press (`firstActionRailOf` — the action's rail gains, a rating split
into ONE TOKEN PER PRINTED PLATE; the reactions = the forecast's exact rail rows + its CAPSULE rows,
`cardAnswerSpecs`) → SEED in the transport's apply block, before the card-reaction seeder (`seedFirstActionRail` —
checked against the views, a view that paid nothing yet keeps it owed; the answer DECLARED) → FLY by the stage
(`ConsoleStartScene.runFirstActionRail`): each rating token born on its own TR plate of the seated face flies to the
score cell, then the director's answer flight with the SEAT as the reactor's place (`firstActionEmergence` — the seated
face lifts 14 px, transform only), the data tokens born on its printed effect row land in its OWN capsule (the seat's
live model — `seatCapsuleModel`, the transfer ladder's `.con-start__embedsource [data-start-seat-card]` rung), the rating
cell marked as the cause; the stage's completion barrier waits for the half and the reactor's settle
(`firstActionChainQuiet`).

## 5. Framework changes the card brought (CN)

- **One play, one rise** — `cardReactionModel.mergeCardReactions`: records of one card of one owner under one root are
  ONE group (Nitrogen-Rich Asteroid: the degree and the printed TR are two rating calls → two records → one rise).
- **A card resource is a wave** — `reactionTokensOf` counts a card-resource gain one token per unit (cap 6): «+2 [data]»
  is two tokens off the printed data, the capsule ticking on each.
- **A corporation is a holder of the play scene** — `receivingStageModel.playCardReactions` admits a `corporation`
  source: Lotus answering a hand play rises out of the receiving stage's corporation zone.
- **The Parliament's field** is on the seat's avoid list (`.con-parl--sitting .con-parl__field`).
- **A rating reactor waits for the SCALE's rating story** (`cardReactionDirector.waitRatingStoryQuiet`, PL-1076): a scale
  step's TR leaves the marker once it has ARRIVED under a notification-only hold, so a standalone chain with a
  `tr-increase` record starts only once `scaleStepRatingBusy()` falls — the asteroid project's data used to rise and pay
  a second before the step's own TR (the box, scene C).

## 6. What the next rating reactor inherits

The hook, the `grantForecast` twin on the `tr` grant (the coverage guard names a hook without one), `printedEffect` when
the card prints several effects — and nothing else: the rating pass offers it every rating the Greens are paid on, the
record and the scene come from the framework, the start stage hosts a corporation's answer to its own first action.

## 7. Tests and stands

Server: `LotusInnovations.spec` (rules 0–6), `ratingRaiseFacts.spec`, `corpFirstActionPreview.spec` § the forecast,
`effectForecastParity` (Release of Inert Gases, the foreign table), the manifest / deck / information / caption guards.
Client: `cardReactionModel.spec` (the merge, the card-resource wave), `startFirstActionRail.spec`,
`receivingStageModel.spec` § a corporation holder. e2e (the Steam Machine, TIMING): `console-lotus-innovations`.
