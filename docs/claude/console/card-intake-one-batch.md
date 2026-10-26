# «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» — the card-intake law of the fork (2026-10-26)

The owner (2026-10-26): «при размещении тайла, при розыгрыше карт, при активации действий синих карт часто
срабатывают хуки на draw карт … игрок получает эти draw один за одним, и это неудобно … чтобы движок мог их все
агрегировать и игроку уже анимационно открывал их одной пачкой … со специальной сцено й: карты с поля зависают, рядом
всплывает карта, что даёт доп. draw, и с неё летит ещё карта, и вместе они собираются на экран для забора». Prompt:
`docs/claude/prompts/card-draw-one-batch-framework.md`. Ledger section **CM**.

## The law (R1–R9)

A **batch** (`CardDrawRevealModel` — `CardIntakeBatchModel` is the same type under the law's name) is every card ONE
recipient drew from the project deck under ONE root of the causal chain, until a MANDATORY input of that recipient
stood between two draws.

- **R1 · the merge key is the recipient + `actionId`** — the `EventRecorder` root (`currentRootId()`: a card play, a
  blue-card action, a standard project, a trade, a sitting, a production phase, …). Never a card's name, never a source
  type. A trade's `tradeId` is the same key in the trade's own spelling and stays as the fallback for a trade made
  outside any scope (the unit specs' `pluto.trade(player)`).
- **R2 · the segments keep the causes** — `segments: [{source, count, role?, sequence?, search?, exhausted?}]` in the
  deferred queue's order (the order of the rules), `Σ count === cards.length`. The same source dealing twice in a row
  is ONE run («Miranda ×2»). `tradeSegments` is gone from the model; the client derives the trade waves
  (`tradeSegmentsOf`) for the colony-trade cinematic.
- **R3 · the seal** — a batch closed to merging. Explicit where the rule names it (Pluto's pair:
  `sealCardDrawReveal(pendingAnswer)`), and STRUCTURAL in the input routes: `PlayerInput` / `PlayerInputBatch` call
  `sealCardDrawReveals()` before applying the player's LIVE answer — every batch on their screen closes. A pre-collected
  answer (the composer's batch, `replayBatch` / `drainBatchTail`) is not a live input and seals nothing. **A ledger
  row is a seal boundary too** (`gainAllColonyBonuses` queues a seal before each tile's cubes): the ledger pays row by
  row, so Miranda's card and Pluto's pair of one Habitat Science press are two batches — Pluto's pair re-defers
  behind the other rows and would otherwise land in Miranda's take (`console-habitat-science`, 2026-10-26).
- **R4 · a search is a segment** — its tape (`sequence` / `search` / `exhausted`) rides the segment; the batch-level
  twins cover the whole batch in dealing order (a plain run beside a search reads as its matched steps), so the
  one-tape search scene still replays honestly. **The SEARCH RUN of a merged batch plays on its OWN tape** (2026-10-26):
  exactly one segment with rejects beside plain runs (`intakeSearchRun`) → the deck layer's MIXED scene — the runs
  BEFORE it deal from their own places through the assembly (`playAssemblyRuns(…, {untilCard})`, the overlay already
  veiled, the frame cued on the first approach), the search run is judged on its segment's tape (its rejects alone
  go to the pile — `SceneStep.tail` marks the other runs' flyers, `cardProxyIndex` maps a card to its flyer), its finds
  assemble into the run's own slots (`assembleReveal` → the span), the runs AFTER it follow (`finishMixedSearch`), and
  every flyer dissolves over the real cards at once. Two searches in one press, or a search alone, keep the one-tape
  theatre. Stand: `console-draw-one-batch-search-tape` (fixture `sb-olympus` — Olympus' card dealt first from its face,
  the search judged with its two rejects, one reveal of three).
- **R5 · a foreign action's draw is its own channel** — `ExternalDrawIntake` never merges with a batch (different
  root by construction).
- **R6 · the seal is read, not waited for** — `pendingAnswer` names what the open batch waits on (`{kind: 'discard' |
  'question', card?, colony?, ordinal?}`), set at `setWaitingFor` off the prompt's structural markers (`discardPrompt`,
  `choiceContext`), cleared when the question is answered (`Player.process`) or when a draw merges in. A question
  whose answer MAY DRAW (an option exchanging a discard for cards — Mars University) carries `draws: true`: the
  console lays a sealed place for the answer's card on that flag alone (a colony pick, a target seal without one).
- **R7 · a batch presents where its ROOT is** — a workspace claims a batch when ANY segment is its
  (`workspaceClaimsRevealBatch` / `…DrawRevealBatch` / `…ColonyRevealBatch` over `intakeBatchSources`); a park holds a
  batch by its ROOT (the first segment's source — `ConsoleShell.revealBatchParked`), and the board-beat park never holds
  a claimed batch (a merged batch with a Venus-scale run beside the played card's own presents in the workspace).
- **R8 · one take** — one reveal, A per card / B all, one `runHandIntake`, one ack by `revealId`.
- **R9 · honesty** — `intakeSegmentTotal(segments) === cards.length` (guarded); a batch that grows after `dismissed`
  un-dismisses (the existing law); a batch nobody presents degrades to the standalone scene.

## The server (Ф1 — DONE)

`Player.enqueueCardDrawReveal` (the ONE funnel every `DrawCards.keepAll` reaches) builds the segment and merges it into
the recipient's LAST batch when that batch is unsealed and shares the root; `ServerModel` serializes `actionId`,
`segments`, `sealed`, `pendingAnswer`. `EventRecorder.currentRootId()` reads the innermost scope that knows its root
(a deferred lambda restores the scope of the action that queued it; a prompt's answer runs in the scope that asked —
so every draw of one press carries the same root). `allColonyBonuses.gainAllColonyBonuses` needed no change: its
lambdas run under the card's root, so Miranda ×2 merges into one run and Pluto's pairs stay apart by their own seal.
Guard: `tests/intake/cardIntakeMerge.spec.ts` (Ф-А · R3/R6 · Ф-Б · Ф-Г ×2 · R4 · R5 · R1).

## The client queue (Ф2 — DONE)

`drawnCardsState.DrawnCardEntry` carries `actionId` / `segments` / `sealed` / `pendingAnswer`; the queue park and the
presentation-flow park judge a BATCH (`CardIntakeBatchRef`); the received-cards head names every cause with its share
when the batch has more than one (`revealStageHead` — «ПОЛУЧЕНО 4 · Исследования +2 · Олимп +1 · Университет +1», in
both hosts, the stage's own card included; a `source` badge with a `count` draws «+N» and no L3 glyph).

## The assembly scene (Ф3 — iteration 1 DONE)

`console/cardIntake/intakeAssemblyPlan.ts` (pure, `tests/console/intakeAssemblyPlan.spec.ts`): the runs in the
server's order, each from its ORIGIN — `deck` (the stage card's own run; every cause without a better place: a scale,
an Agenda step, a party, a law, a colony off a ledger that is not on screen — named `degraded`), `card` (the TRIGGER
CARD surfaces beside the row and deals from its printed draw icon — `findPrintedCardsIcon`), `board-cell` (a tile run
while the board is visible). Cadence: a run starts `overlapMs` before the previous run's last landing; a trigger
surfaces `surfaceMs + holdMs` before its deal and recedes `recedeMs` after its last landing. The trigger seat is beside
the row (left → right → above → the corner, `triggerSeatRect`), never over a slot.

`ConsoleDeckDrawLayer.runAssembly` plays it: one `runBatchArrival` per run (the director gained `from?: ArrivalOrigin`
— the cards are born on the icon's rect, no deck settle-tick), the trigger faces as `.con-deckdraw__trigger`
(`data-dd-trigger="<CardName>"`, `data-dd-run` on the layer root), the frame cued at the first run's first approach,
one `releaseAndHandoff` at the end. A merged batch is this scene's whatever its root (`revealVerdict`), except: a
workspace flying its OWN arrival (the card-actions composer — its beat flies the whole batch off the deck, no
triggers: **next iteration**), a settlement table, and the board card-bonus scene ARMED at the submit — that scene flies
the CELL's run only (`startMulti` with `ownCount`), keeps the cards hovering in their slots, and hands the rest to
this layer through `cardIntake/intakeAssembly.ts` (`continueIntakeAssembly` → `playGuestAssembly`: the layer stands
as a GUEST without its own scene, the cover scene owns the gates and the final handoff). A merged batch with NO scene
armed never self-arms the cover scene (`revealToProcess`).

**2026-10-26 — the trigger rises through the SHARED primitive (CN).** `surfaceTrigger` / `recedeTrigger` are
`cardReactionStage.riseReactor` / `recedeReactor` with this scene's own timings — the card-reaction framework pinned
its tempo to `intakeAssemblyTimings` byte for byte (`docs/claude/console/card-reaction.md` law 3, guard
`cardReactionModel.spec`), so a trigger surfacing here and a reactor rising beside the rail are one motion. And a
SINGLE hook's draw whose cause is a card NOT on the stage goes through this scene too (`intakeAssemblyPresentsBatch`
— the owner's decision 5, PL-1053: Mars University's one card deals from the University's printed draw icon, the
University surfaced beside the row) instead of degrading to the deck; `intakeAssemblyOwnsBatch` still judges the
claims and the parks.

e2e: `console-draw-one-batch-play-table.spec.ts` (Ф-А on the `mu-olympus` fixture — one reveal, one batch on the
wire with two segments and one root, the head's two causes, the Olympus face surfaced beside the row and never over a
slot, the stage card never surfaced, one crumb); `console-table-question-defer` (B) reads the merged batch.

## Ф4 — THE SEALED PLACE is the fork's grammar (2026-10-26, both hosts)

The settlement table (`colonyTrade/settlementTable.ts` — ONE physical object: a place per owed card, a face-down card
under a SEAL whose condition reads as words, the seal breaking on the touchdown of what it waited for, the card
turning IN PLACE once, one instance for the whole press, parked under the step that answers) now stands for every
host of a sealed batch, keyed by `kind`:
- **`colony`** — a colony's pairs («draw 1, then discard 1» per settlement): the trade's own table (`via: ''`) and
  **a CARD's** (Habitat Science's «all your colony bonuses» — `via` = the paying card; the discard marked
  `colonyRepeat` with the card as its source, `settlementPairOf` reads both). The card's table stands in the ledger's
  own zone (`.con-composer__ledgerzone`), parks under the action workspace's hand step (`settlementTableParked` →
  `colonyBonusPayoutLive() && host === 'card-actions'`), the seal breaks on the ledger discard's touchdown
  (the table's OWN reader `cardDiscardSettlementPair` — `colonyBonus` or `colonyRepeat`; `cardDiscardColonyBonus` stays the
  trade's: every reader of it is the colony resolution's lifecycle, and a ledger discard read as the resolution's made it
  «live» for the flight, its falling edge then clearing the table mid-turn), the table ends with the payout
  (`finishColonyBonusPayout`).
  **The ledger hosts NO closing step**: the take IS the step and the action workspace opens its hand right after
  (TR23's `payoutDiscardDue` → `openLedgerDiscardStep`); the overlay's «Сбросить карту» button is a TRADE's only
  (`ConsoleRevealOverlay.closingStepOwed` — `ledgerPair` hands over at the take, remembering the place as taken and
  marking the hand's fresh card itself).
- **`question`** — a card's QUESTION of the same press whose answer may draw (`pendingAnswer {kind: 'question',
  draws: true}` — Mars University after the play's own draw): the sealed batch stands as the strip, ONE place lies
  sealed beside it («Откроется после ответа «Марсианский университет»», the zone labelled by the asking card), the
  table parks under the hand's album while the question is answered, the discard's touchdown breaks the seal
  (`cardDiscardAskedBy`), and the answer's draw — the next batch of the same `actionId` — turns in the place
  (`settlementClaimsBatch(source, batch)` claims it by root; the deck answers with the turn). Armed / advanced / ended
  by ONE shell watcher off the batches and the standing prompt (`ConsoleShell.questionTableKey` — index 0 while the
  question stands, 1 with the answer's batch, cleared when the question is gone with nothing drawn or its answer
  taken). `armQuestionTable` · `questionZones` · `questionArrival` · `questionSealReading`.
e2e: `console-draw-one-batch-sealed-ledger` (fixture `habitat-science-pluto2`: Luna ×1 · Pluto ×2 — one table, place 2
sealed, the take opens the hand, the second pair turns in place, nothing flies twice);
`console-draw-one-batch-sealed-question` (`mu-olympus` (A): the question table, the live album over it, the answer
turning in place, the table gone with the take). Guards: `settlementTable.spec` § Ф4, `cardIntakeMerge.spec` § R3/R6
(`draws`).

## Ф5 — one channel (2026-10-26)

- **A foreign action's draw leaves from ITS cause's own place.** `ExternalDrawIntake` stays its own channel (R5 — a
  different root by construction; the server drew at the trigger, the cards wait in `pendingCardIntakes`), and its
  take surface now deals the batch from the SOURCE SEAT — the effect card's face (or the enacted resolution's) standing
  in `.con-extdraw__source`, from its printed draw icon where it has one (`ConsoleExternalDrawWorkspace.dealOrigin` →
  `runBatchArrival({from})`); the HUD deck only when the seat is not painted. The deck's counter does not tick for it
  (it fell at the trigger). Stands: `console-external-draw`, `console-parliament-colonial`.
- **RX07 is one intake per PLAYER by construction.** The only plain-draw colony bonus in the fork is Miranda's
  (`ColonyBenefit.DRAW_CARDS`); Pluto's pairs never merge by rule (a discard between the draws) and every other tile
  pays no card. Miranda's k cubes are already ONE intake of k cards (`ColonialAffairs.drawStep`, the law of merging) —
  so «per-tile segments» would describe a batch that cannot exist; the model stays one cause per intake.

## Ф3 (2) — the composer's own arrival (2026-10-26)

`ConsoleActionComposer.launchBeatAssembly`: the beat waits for the answer when the forecast promises the viewer a
draw from a hook (`forecastPromisesDraw` — a `you`-recipient fact, exact or asked, gaining cards), and deals the merged
batch run by run with its own trigger faces (`beatTriggers`, the SAME assembly director).

## The one named degrade left

- **A tile's run under a COVERED board** stays `board-covered` → the deck, named in the plan. The L3 peek of the paying
  cell cannot host a deal: under the hand workspace the board section is `display: none` (the TR45 board peek re-lays
  the board out as a LEVEL of the composer), so a mid-deal peek would mean un-hiding and re-fitting the board under a
  flight into a receded workspace. The case arises only for a cell reached without the staged play (an auto-placed tile
  from a reserved slot inside a workspace); the staged play lands every ordinary tile on a visible board. Owner's call.

- **Ф6 — the audit** of every producer: `tests/intake/cardIntakeSourceCoverage.spec.ts` lists the imperative draw
  sites outside the card tree with their scope; a new site must declare its root.

## Decisions taken by default (the owner's batch, 1–7 of the prompt)

1 the server's order · 2 «ПОЛУЧЕНО N» + a chip per cause with its share · 3 a search beside a plain draw stays the
search theatre (its tape covers the batch) · 4 external draws never merge · 5 a cell under a covered board deals from
the deck (named), the peek is next · 6 B on a merged batch = «Забрать все» · 7 rows up to the stage layout's cap.
