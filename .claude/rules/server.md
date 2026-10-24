---
description: Server engine rules — inputs, deferred actions, UI markers, read-only endpoints/engines, event stream, logging.
paths:
  - "src/server/**"
  - "src/common/**"
  - "tests/routes/**"
  - "tests/events/**"
  - "tests/models/**"
---

# Server rules

## Layering
`src/server/` (engine, cards, routes, DB) · `src/client/` (Vue 3 Options API) · `src/common/` (shared types/models — no runtime logic bound to either side). `@/` maps to `./src/`.

## Effects, choices, sequencing
- `Behavior` (`src/server/behavior/Behavior.ts`) is the declarative effect DSL, interpreted by `Executor`.
- Multi-step effects and player choices queue via `game.defer(action)` with a `Priority`; chain follow-ups with `.andThen()`. **Step ORDER is load-bearing** — a preview's pre-collected steps must be emitted in the SAME order the executor defers them, or the batch replay misaligns.
- **A card's own on-play input sits at `Priority.DEFAULT` — an effect the same play TRIGGERS can be asked first** (the Reds tax at `COST`, Olympus Conference / Pharmacy Union on a science tag, …). A pre-collected answer therefore does not always meet its own prompt: `inputs/deferredInputBatch.ts` PARKS it and lands it once the interloper is answered (`drainBatchTail`), and `Player.takeAction` expires it with the action. Never make a flow depend on the card's input being the very next thing asked; full audit in `docs/claude/action-prompt-audit.md` § CLASS 6.
- **…and a parked answer lands only on ITS OWN prompt — the ADDRESS decides, never the prompt's kind** (the pre-select law, 2026-10-11): a batch answer carries `for: {source, role}` (stamped by the preview family's exit pass `models/preselectAddresses.ts`, copied by the composers' `addressed`), a prompt's address is ONE reader (`promptAddressOf` over the structural markers), and `replayBatch` / `drainBatchTail` process an `own` answer, park a `foreign` one untried, and keep the positional rules for an `anonymous` prompt or an unaddressed answer. `stagedFor` is the same address in its older spelling. The only kind-rule left is the deck pick (`hiddenInfoPrompt`). A rung like «every discard is hidden information» is forbidden — it made every pre-collected discard unlandable. A prompt a pre-select may meet names its asker (`markChoiceContext` / `cause`). Guard: `tests/models/cardPlayReplayCoverage.spec.ts`; audit § CLASS 8.
- Player choices are `PlayerInput`s in `src/server/inputs/` (`SelectSpace`, `SelectCard`, `OrOptions`, …).

## The soft gates — a sitting's close is a prompt of the SEAT (Turmoil Redux, 2026-10-24)
A publisher of a seat's first prompt of the new generation (the draft pick, the research buy, the World Government's step — and any new one) asks `Parliament.holdsSittingAck` and leaves the prompt to the seat's admission (`IGame.admitToGeneration`); no prompt is ever written over a standing one (the specs throw: `TM_STRICT_PROMPTS`). Contract: `docs/claude/console/parliament-soft-gates.md`.

## UI markers — the client must never guess
The client is forbidden from detecting a prompt by its (translatable) title. So a prompt whose UI needs context carries an explicit marker on `BaseInputModel`, serialized centrally in `ServerModel.getWaitingFor`: `startGamePrompt`, `choiceContext` (`markChoiceContext`), `placementContext` (`markPlacementContext` — cancellable vs committed), `awardFundingPrompt`, `reveal` (`RevealLogMeta`), option metadata (`optionMetadata.ts` factories) + `disabled` candidates with an English i18n `reason` key.
**Adding a new prompt shape → add a marker + a spec; never rely on text.**

Do NOT put in metadata what the client already derives (per-player current→resulting values, corp name, self-target flag). The server sends the hint (`icon`/`amount`/`scope`) and the rule-based reason.

## Read-only surfaces stay read-only
Explainability engines (`BoardInformationEngine`, preview builders, `cardPlayPreview`, `actionPreview`, aggregate/fact modules) NEVER mutate state and NEVER re-implement rules — they reuse the real sources. Purity is test-guarded (state snapshot before/after). Never call `grantPlacementBonuses` / `addTile` / `game.events.*` / `game.defer` from them.

## New endpoint checklist
Bounded, read-only, viewer-authenticated by participant `id`. (1) route file in `src/server/routes/`, (2) path constant in `paths.ts`, (3) registration in `requestProcessor.ts`, (4) **add it to the Electron CORS allowlist (`CORS_PATHS`) + its spec** — a client-fetched endpoint that misses this breaks in the desktop build, (5) a spec in `tests/routes/`.

## AN EXPIRED SUBJECT IS NOT AN ERROR — the preview family answers 204
Every preview route (`action-preview`, `card-play-preview`, `corp-first-action-preview`, `game/board-cell-preview`, `game/colony-trade-preview`) is asked about a SUBJECT resolved against LIVE state, and that subject legitimately expires — the client cannot always avoid asking. Aridor is the whole class in one card: the first-action ledger (`pendingInitialActions`) drains at the SUBMIT, inside the same response that raises the colony catalog the action produces, while the briefing that asked is still mounted and re-asks on every `gameStateVersion` move; and that catalog rails the game's UNUSED colonies (`discardedColonies`), so descending into one asked for the trade preview of a colony that is not in the game. Both answered `notFound`: a `console.warn` per benign race on the server and a red 404 in the client console, which is exactly where the ones that MEAN something get buried.

So: **`responses.noPreview(res, reason)` → 204, reason in `X-No-Preview`, empty body** for «the subject named is not previewable against current state»; **`notFound` stays for IDENTITY errors** (unknown game, unknown player) — an addressing bug must keep shouting. Client side there is ONE road — `fetchPreview()` (`src/client/utils/previewFetch.ts`), which never rejects and never calls `.json()` on a 204 (`Response.ok` is TRUE for it, so the old hand-copied `r.ok ? r.json() : undefined` reached the right answer by way of a thrown exception). Narrowing the ask is still the CLIENT's job — the 204 covers the residual race, it is not a licence to ask for anything (`firstActionPreviewable`, `colonyRailIsCatalog`). Guards: `tests/routes/previewNoPreview.spec.ts` (204 / 200 / 404 per route), `tests/console/previewFetch.spec.ts`.

## Event stream
**The PRODUCTION PHASE goes through the recorder too (TR61, 2026-10-17).** `Player.runProductionPhase` opens `events.beginProductionPhase(player)` — ONE root `production-phase-income` per seat per phase, category `production` — and every move inside it has a source: the rating paid as M€ under `{kind: 'production', part: 'rating'}` (first), the six production values through `stock.add` under `{kind: 'production'}`, the energy → heat conversion as its own event under `part: 'conversion'` (`convertEnergyToHeat`), the `onProductionPhase` hooks inside the scope with their own sources. The seat's `productionIncome` record (`ProductionIncomeModel`, transient on the self model) is what the console's generation scene plays; a card that pays in the production phase (Supercapacitors' deferred half) must leave the record whole — `finishProductionPhase` rebuilds it off the live scope. Guard: `tests/events/productionIncomeJournal.spec.ts`.

Game actions are recorded under scopes (`events.beginAction(...)` … `endScope()`), which is what the journal, notifications, effect/action stats and endgame facts all read. **A direct field mutation bypasses the recorder — go through `stock.add` / `production.add` / the recorder helpers**, else the event never exists. Analytics-only tags (`resource-payment`, `payment-bonus`, `colony-track`, `trade-discount`, `global-parameter`, `reveal`) are excluded from the journal route on purpose. Never emit an event for data the engine doesn't actually produce (there is no mid-game VP mutation — VP is endgame-computed). **…but a PROJECTION the engine already computes may ride the event that moved it as a FACT** (PL-041, the owner's decision 2026-10-10): an ocean carried away from (or onto) a cell beside somebody's Capital changes that Capital's adjacency VP — no VP is mutated, so there is no VP event; the move's own `tile-moved` event carries `TileMoveFact.adjacencyVp` (`server/boards/capitalAdjacencyVp.ts` — snapshots around the real `Board` rule before and after, by owner, with `before → after`), the game logs «${player}'s Capital loses/gains an adjacent ocean: N → M VP», and the client reads it as the owner's loss / gain (the rival's notification, the journal's row — `notificationSemantics` / `journalEventChild`). The same shape for any future «a standing projection changed because of somebody's move»: a fact on the event that caused it, computed by the rule that owns the number, never a VP event and never a client re-derivation. Guards: `tests/boards/oceanMove.spec.ts`, `notificationAdjacencyVp.spec.ts`, e2e `console-canyon-carving` (red reads «ПО −1»).

## The live VP score is read by its BREAKDOWN — the client never recounts (TR55, 2026-10-15)
Every surface that must say WHY the viewer's score moved reads the server's `VictoryPointsBreakdown` (`calculateVictoryPoints` — the TR, the cards row by row with their `mechanics`, the cities cell by cell, milestones / awards by name) through ONE pure difference, `common/game/vpAttribution.ts` — never a client re-derivation of a rule. A new scoring component goes into the breakdown with its own named detail (or the attribution's residual names it `other:unattributed`); never a VP event for a projection the engine already computes (the PL-041 law above).

## Logging
`game.log()` / `player.log()` take a template with `${player}` / `${card}` / `${amount}` placeholders plus typed `LogMessageData` tokens (never pre-rendered HTML) — the premium journal renders tokens as chips.

## Database
Pluggable backends in `src/server/database/` (SQLite / PostgreSQL / LocalFilesystem) through `SerializedGame` / `SerializedPlayer`; `GameLoader` caches. New serialized fields must degrade gracefully on old saves (optional + a sensible default).

## Deep reference
`docs/claude/architecture-reference.md`, `docs/claude/board-information.md`, `docs/claude/modal-inputs-and-metadata-contract.md`, `docs/EVENT_STAT_FOUNDATION.md`, `docs/ENDGAME_STORYTELLING.md`.
