# TR61 Cargo Mechs («Грузовые мехи») + the iteration «СМЕНА ПОКОЛЕНИЯ — ОДНА СЦЕНА»

**Status.** Shipped 2026-10-17. The prompt: `docs/claude/prompts/project-tr61-cargo-mechs.md`. The laws: `.claude/rules/console-ui.md`
§ THE GENERATION CHANGE IS ONE SCENE, `.claude/rules/server.md` § Event stream (the production phase goes through the recorder).
Ledger: section BB (`docs/claude/gameplay-polish-ledger.md`, PL-599…609). Decisions 1–9 were taken at their defaults (§ 9); the
scene plays its beats in the SERVER's order (conversion before the income — § 5), which is the one deviation put to the owner.

## 1 · The card

Blue (ACTIVE), 7 M€, a Building tag, the INDUSTRIALISTS' plate (the TR15 class — checked at PLAY, the action works under any ruler),
a MECH holder, no VP, no play block. The action is TWO printed rows joined by «ИЛИ» (`CargoMechs.ts`):

- **A** — «Pay 1 energy to add a mech resource to ANY card» (`CARGO_MECHS_ADD_TITLE`): 1 energy off the rail (`from: {card: this}`),
  then `AddResourcesToCard(MECH, {count: 1, autoSelect: false, cause: cardSource(this)})` — the target is ASKED ALWAYS, this card
  included (a mech put here is next generation's B).
- **B** — Viron's own key «Perform again an action from a played card»: 1 mech leaves this card (the branch's price), then the ONE
  repeat mechanism (§ 2) runs the chosen card's used action again.

`canAct` = A's price is there OR B has a candidate; `actionUnavailableReason` names the energy first («Not enough energy»), then B's
«No other action card to copy». One live option IS the action (the census pattern — no `OrOptions` round a single branch); both
live → `OrOptions.markChoiceContext(effectChoice(this))`. `actionPreview` is `orBranches`: A = `stockCost(energy 1)` +
`cardResourceGain(mech 1)` + the «КУДА» `addToCardStep`; B = `cardCost(1 mech)` + `selectCardStep({repeatAction: true})` — the
REPEAT SLOT the composer paints. Futility: none. The face prints the scan's two rows — `eb.energy(1).startAction.resource(MECH).asterix()`
over `eb.resource(MECH).startAction.replayAction()`; `infoText action-short` for B: «Spend 1 mech to repeat a used action» (token
`action-replay`). RU «Грузовые мехи»; lore (EN word for word, key `TR61`): «Too late! I'm forklift-certified!» — RU «Поздно!
У меня есть права на погрузчик!». **Art imported** (`Mars Arts/TR61.png` → `assets/card-images/TR61.webp` + thumb, Ken Le Bras).

Spec `tests/cards/turmoilRedux/CargoMechs.spec.ts` (28): the requirement at play; A asks the target with one holder and lists every
own holder including itself; A refused without energy; B refused with «0 of 1 mech on this card» (class PL-197); one live branch is the
action, two are the choice; B's candidate list is `repeatableActionCards(player, this)` (used this generation + can act + not itself);
the mech leaves BEFORE the copied action and the copied action's own price is paid by it; the journal names the copier; the preview's
two branches and their steps; purity; the loop guard against Viron (§ 2); save / load.

## 2 · «ПОВТОР — ПЯТЫЙ ПОТРЕБИТЕЛЬ» (decision 4a)

Cargo Mechs is the fifth consumer of ONE mechanism, never a fifth interface. Server: `cards/repeatableActions.ts`
`repeatableActionCards(player, copier)` — the four conditions (a played action card · used THIS generation · `canAct` again · not
the copier itself; a copier mid-check excluded by its loop counter), `SelectCard(...).markRepeatActionPrompt()` as the prompt, the
copied action run inside `events.withCopiedAction(copier, card)` so the journal's root names the copier and the chain the copied
card («${0} used ${1} action with ${2}»). Console: the composer's B branch carries the REPEAT SLOT (`selectCardStep({repeatAction:
true})`) → `openRepeatPick` → `enterConsoleRepeatPick` → «ДЕЙСТВИЯ КАРТ» in REPEAT MODE over the asking composer (the crumb stays
«ГРУЗОВЫЕ МЕХИ › ПОВТОР ДЕЙСТВИЯ», the bar's A is «Выбрать», the candidate's own composer captures the copy's steps), the source
composer comes back PAINTED with the chosen action in its slot, and the commit is ONE batch — `[activate, {or: B}, {card: [chosen]},
…composed]` (`buildActionBatch` + `repeatActionResponses`). Byte for byte Viron's road; no spec of that road changed.

**The loop guard is load-bearing.** Viron and Cargo Mechs on one table list EACH OTHER: `repeatableActionCards` asks every candidate's
`canAct`, Viron's `canAct` builds its list (which asks Cargo Mechs' `canAct`), which builds ITS list (which asks Viron's) — a
`RangeError` without a counter. `CargoMechs implements IHasCheckLoops` (`getCheckLoops`), and `repeatCandidates()` wraps the list in
`checkLoops++ / --` (try / finally), so a copier that is already being checked is left out of the other's list (the Playwrights
precedent). Proven by the twin test in `tests/cards/venusNext/Viron.spec.ts` (an unguarded twin overflows the stack; the guarded pair
lists each other and never itself).

## 3 · The holder's REPEAT role (decision 5a)

B pays a mech for a REPEAT, not for a plain good, and the role derivation (`server/cards/holderActionGood.ts`) reads a bespoke action
only through the card's own declaration (door К-R1): `holderActionGood = {spend: 1, good: {kind: 'repeat'}}`. `common/cards/holderRole.ts`
gains the kind `repeat`; the console readers speak it through the one helper (`holderRoles.ts` — icon `action-replay`, the reading
«Spend ${0} from here: repeat a used action», the caption «Repeat action»; `optionIcons.ts` `MISC_ICON_CLASSES['action-replay']`,
`.con-plate-icon--action-replay`), so the ДОП. РЕСУРСЫ satellite reads «[mech] 1 · [↻]» and a «put N on ANY card» target step reads
what the mechs DO here. Guards: `tests/cards/holderActionGood.spec.ts` (the corpus — the NAMED row, `repeat` counts as a positive good
of amount 1), `tests/client/console/holderRoles.spec.ts`.

## 4 · «ДОХОД — СОБЫТИЕ» (part А, decision 8a)

The production phase wrote past the recorder (`Player.finishProductionPhase` added six values and the rating with no scope): no journal
group, no aggregate, no fact, and the client had nothing to play a scene from. Now:

- **One scope per seat per phase.** `EventRecorder.beginProductionPhase(player)` emits the root `production-phase-income` (a
  `correlationId`, `category: 'production'` — a new `JournalActionCategory`) and pushes the scope; `Player.runProductionPhase` opens it
  (try / finally `endScope`), logs «${0} received the production income of generation ${1}» (RU «получает доход фазы производства
  поколения»), then runs the conversion, then `finishProductionPhase`.
- **Every move has a source.** `EventSource {kind: 'production', part?: 'rating' | 'conversion'}` (`sourceKey` → `production` /
  `production:<part>`): the rating is paid as M€ FIRST under `part: 'rating'`, then the six production values through `stock.add`
  under the bare `production` source, the energy → heat conversion is its OWN event under `part: 'conversion'`
  (`Player.convertEnergyToHeat(amount)` — the snapshot `energyHeatConversion` kept, the log «converted ${1} units of energy to
  heat»); the `onProductionPhase` hooks (Mons Insurance, the levy) run INSIDE the scope with their own sources.
- **The record the scene plays.** `ProductionIncomeModel {generation, correlationId, income: Units, rating, conversion}` on the SELF
  model (`PlayerModel.productionIncome`, `ServerModel`), transient like `energyHeatConversion` — cleared in `Player.process`, rebuilt by
  `finishProductionPhase` for Supercapacitors' deferred half (the rootId read off the live scope, the conversion off the snapshot).
- **The readers.** Journal: `journalEventChild.ts` labels the rows by part («Terraform rating» / «Energy conversion» / «Production»),
  `journal.less .journal-group--production` (an amber accent); `notificationCauseView` names the category «Production phase».
  **Notifications: NONE, by policy** — `notificationContentPolicy.ANNOUNCED_ELSEWHERE = {production: 'the generation scene'}`,
  `buildRootNotification` returns nothing for the category (the cross-player coverage guard lists the door with that reason) — the
  scene IS the announcement. Aggregates: `aggregate.productionIncomeByPlayerGeneration(events)` → `ProductionIncomeStats {generation,
  stock, rating, conversion}` per seat. Endgame: the fact `productionIncome` (`endgameFacts.productionIncomeFacts` — generations,
  firstGeneration, units, megacredits, rating, conversion, peakGeneration, peakUnits, averageUnits; tags economy + timeline; the roots as
  `relatedEventIds`) — the data for «экономика партии»; no storyteller analyzer reads it yet (PL-608).

Guards: `tests/events/productionIncomeJournal.spec.ts` (9 — one root per seat, the category, the rating apart, the conversion event,
Supercapacitors' deferred half through `player.process`, the hooks inside the scope, the record, the aggregate, an old save),
`crossPlayerCoverageGuard` (the `production` door). `IndustrialistBudget.spec` monkey-patched `stock.add` to throw on ANY positive M€ —
the rating's M€ is one now; the throw is gated on the Parliament phase.

## 5 · «ОДНА СЦЕНА» (part Б, decision 6a)

Before: the pass landed as `+N` chips on the rail and, a second later, the purchase plate. Now the generation change is ONE scene,
played by `console/generationScene/generationScene.ts` off the SERVER's record (never a diff):

1. **DETECT in the apply block, claimed once.** `detectGenerationScene(prev, next)` reads `next.productionIncome` of the viewer's own
   seat, claims `${color}:${generation}` (a re-fetched view never replays it, a fresh load plays nothing, a running scene refuses a
   second) — before either commit path of `gameTransport`.
2. **Beat 1 — the counter FLIPS.** On the gated path `transportHolds.generationScene` stands and `runGenerationFlip` sets the DISPLAYED
   view's generation ahead of the commit (the marker hold's precedent), so the strip's own `ConsoleFlipValue` plays its flip-swap; the
   beat settles on the strip's `flip-end` (`noteGenerationFlipEnd(generation)` — an older readout's end is not this flip), net 1540 ms;
   reduced motion resolves at once. No generation advance in the response (a Parliament sitting between) → no flip, no wait.
3. **Beat 2 — the conversion.** The existing energy → heat gate (`endEnergyConversion`) is the scene's second beat
   (`markGenerationConversion`): the energy counts down to zero, the heat up, under the same hold.
4. **Beat 3 — the income TICKS; a card hook's payout FLIES** (the owner, 2026-10-26 — replacing TR61's «the income FLOWS»: a fan of
   tokens off every production badge at once overloaded the beat, drew the eye off the rail, and played only when the two views agreed —
   so «sometimes yes, sometimes no»). The STANDARD income — the rating's M€, every production value, the conversion — is a set of
   KNOWN moves in `generationIncomeReward`: the rows tick with the commit and each speaks through its own delta chip, no token born.
   What FLIES is what a card's own production hook paid inside the phase (the record's `hooks`, R07 Pristar: 6 M€ and +1 preservation
   with its point): `seedGenerationIncomeHold(before, after)` holds those rows through `seedRailReward` (only when the views' diff keeps
   the promise); after the commit `runGenerationIncomeFlights` lets the card's mark CHARGE first (`chargeHookMarks` — a one-shot
   `con-income-charge` on Pristar's token on the rating cell, the scene waiting for its `animationend`), then `flyRailReward` births the
   payout ON the mark at the featured pace (`TRANSFER_FEATURED_PACE`, 1.35 — the beat's whole subject, slower than a reward wave), the
   M€ row ticking on its touchdown, the preservation landing on its satellite cell with its point; the purchase rises only once the
   rail host holds no token in the air (`surfaceClear`). A hook that pays something it does not name holds nothing — the counters tick
   with the commit, the scene still runs (PL-607).
5. **Beat 4 — the purchase RISES.** `concludeGenerationScene`: when `betweenGenResearchLive(view)` and no draft frame stands yet, the
   scene acknowledges the draft flow's mandatory beat and enters the workspace itself (`enterWorkspace('draft', {anchor: phase
   draft})`) under its own hold — the plate never flashes; a reload or a scene that did not run keeps the plate path (the beat is the
   player's A).

The hold is the supplier `generation-scene` (bounded, named; `endGenerationScene(reason)` releases every held row, `resetGenerationScene`
on the shell's unmount). A STAGED response (fresh bot turns commit in the closure) has no pre-commit beat: the strip flips off the
commit and the income flies after it (PL-606). The order is the SERVER's — the conversion is recorded before the income, so the energy
row drains to zero and then receives its production; playing the income first would show «6 → 2» for a conversion the server recorded
as 4 → 0 (§ 9, decision 6).

Guards: `tests/console/generationScene.spec.ts` (6 — the claim, no record no scene, the flip beat and its signal, the promise, the seed's
verdict, the broken promise), e2e `console-generation-scene` (A solo without a draft: flip → conversion → every row's delta chip, NO token born → the workspace; B the drafting table — the same scene, the picks and the buy in ONE workspace, the rival driven over
the wire; C no energy — two beats; D reduced motion — snaps, no flights, the purchase still rises; E the journal — ONE production group
per seat with its rows), the transfer witness (`rail:<row>` landings, no end over glass).

## 6 · «ОДНА ПОКУПКА» (part В, decision 7a)

The research purchase between generations had TWO surfaces: with a draft it rose in the draft workspace's `--buy` stage, without one
(solo, a no-draft table) the server's `cardSelect buy` prompt went to the standalone plate. `consoleDraftFlow.betweenGenResearchLive`
(the former `betweenGenDraftLive`, kept as an alias) drops the `draftVariant` term: `Phase.RESEARCH` + the viewer's `needsToResearch`
+ generation ≥ 2 — with or without a draft. Without one `draftJourneyPhases({draft: false})` is ONE chapter («01 ПОКУПКА → ГОТОВО»),
the root key is «Research» («ИССЛЕДОВАНИЕ › ПОКУПКА»; with a draft «ДРАФТ › …»), and a `sawResearchStart` latch (a live ACTION →
RESEARCH edge without a draft) lets the buy ARRIVE (`prepareBuyArrival`) instead of snapping into place. The standalone `cardSelect buy`
plate stays for purchases INSIDE an action (Business Network and kin — PL-294). `console-energy-conversion-prompt` now waits for the
workspace as the next prompt.

## 7 · «ПОКУПКА В МАСШТАБЕ 4K» (part Г, decision 9a)

Measured on the 4K TV (GPU; the before frames `screenshots/tr61/tv4k/before/w2-03-buy-enter-*.png`, the after frames
`screenshots/tr61/tv4k/after/`, the probe `console-generation-scene` § A):

| 4K TV · the research purchase | BEFORE (the `cardSelect buy` plate) | AFTER (the research workspace) |
| --- | --- | --- |
| the card's height | ≈ 883 px (≈ 45 % of the 1948 px opening) | 1119 px (57 % — the probe; ≥ ⅓ asserted) |
| the row's width | ≈ 2573 px of 3840 | ≈ 3091 px |
| the head | a prose question + three chips («Выбрано 0 / 4 · Покупка −0 · У вас 515») | the crumb + the one-chapter rail + the financial strip |
| the financial strip | — | «ПОКУПКА −0 · 0 × 3 · У ВАС 515 → ПОСЛЕ ПОКУПКИ 515», label / detail at the TV floor (32 px; they sat at 31.2 — the one TV block, `console_tv.less`) |
| the rails | the strategy rail lit beside the plate | the workspace takes the strategy rail's zone (the band family) |

No re-composition was needed beyond the TV block: the workspace's own `wsStageLayout` already puts four cards at the album's scale.

## 8 · Polish by the way

- **The Hydronetwork read its OWN copy of the repeatable list** (`DeltaProjectExpansion.getUsedActionCards`, byte-identical to the four
  conditions) — it now delegates to `repeatableActionCards(player)` (the track is not a card, so no copier). The delta suite (448)
  green (PL-603).
- **The milestone / award ceremony spoke with two voices** (the TR61 walk, backlog № 19): the status rail read the LIVE item under the
  hero — «Claimed by player1» the instant the answer landed, while the scene said «ДОСТИЖЕНИЕ ПОЛУЧЕНО». `ConsoleMaFocusStage` pins
  the item with the view at `committing` (`heldItem`), released on a refusal; past the press the rail states the transaction AS PRESSED
  (PL-604).

## 9 · Decisions

1. RU «Грузовые мехи» (default). 2. The lore EN word for word, RU as above (default). 3. Art imported (Ken Le Bras). 4. (a) the
self-repeat is impossible by construction — condition 1 of the module. 5. (a) the holder good `repeat`, declared by the card (К-R1).
6. (a) ONE scene — **with the beats in the server's order**: flip → conversion → income → rise (the prompt wrote income → conversion);
the energy row then drains and refills honestly, and the existing conversion gate keeps its own numbers. Put to the owner with the
storyboard. 7. (a) one purchase surface — the research workspace's `--buy` stage with or without a draft. 8. (a) the full event layer,
no notifications by policy. 9. (a) the card at the album's scale, the strip at the TV floor, measured in § 7.

## 10 · Tests

Server: `CargoMechs.spec` (28), `Viron.spec` (+ the twin), `holderActionGood.spec`, `productionIncomeJournal.spec` (9),
`generationScene.spec` (6), `IndustrialistBudget.spec` (the gated throw), `crossPlayerCoverageGuard` (the door), the delta suite
(448). Client: `holderRoles.spec`, `consoleDraftFlow.spec` (26 — the renamed predicate, the no-draft cases, the one-chapter rail,
the latch). e2e: `console-generation-scene` (A–E, fhd + tv4k), `console-cargo-mechs` (B the repeat road — two tiles, the slot, the
ONE repeat surface, the painted slot, the commit's copy, the witness; A the empty card — B's tile refused with its count, A's
«КУДА» with this card as a target), `console-energy-conversion-prompt` (translated).

## 11 · Open (the ledger, BB)

PL-606 (a staged bot-turn response skips the pre-commit flip), PL-607 (a hook's payout in the same response breaks the rail
promise — honest tick), PL-608 (the endgame fact has no storyteller analyzer), PL-609 (a rival's production is the journal's only —
the scene is the viewer's own rail by design; a rival's income in the journal reads as one group per seat).
