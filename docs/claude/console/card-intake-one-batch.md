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
  one-tape search scene still replays honestly. (The assembly scene plays plain merged batches only — a merged batch
  WITH discards keeps the search theatre; its per-segment tape is the next iteration.)
- **R5 · a foreign action's draw is its own channel** — `ExternalDrawIntake` never merges with a batch (different
  root by construction).
- **R6 · the seal is read, not waited for** — `pendingAnswer` names what the open batch waits on (`{kind: 'discard' |
  'question', card?, colony?, ordinal?}`), set at `setWaitingFor` off the prompt's structural markers (`discardPrompt`,
  `choiceContext`), cleared when the question is answered (`Player.process`) or when a draw merges in. The sealed
  place (the settlement table's grammar for the whole fork) is Ф4 — not built yet; the server side is ready.
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

e2e: `console-draw-one-batch-play-table.spec.ts` (Ф-А on the `mu-olympus` fixture — one reveal, one batch on the
wire with two segments and one root, the head's two causes, the Olympus face surfaced beside the row and never over a
slot, the stage card never surfaced, one crumb); `console-table-question-defer` (B) reads the merged batch.

## Not built yet (the next iterations of the same law)

- **Ф4 — the sealed place** (`cardIntake/sealedPlaces.ts`): the settlement table's grammar out of `colonyTrade/` for
  every host (Mars University's deferred question, a card's Pluto pairs, RX07). The server already announces
  `pendingAnswer` / `sealed`; the client glues the next batch of the same `actionId` to the place.
- **Ф5 — one channel**: `ExternalDrawIntake` as a `CardIntakeBatch {mandatory}` presented by the assembly director
  (`source-seat` origin); RX07 one intake per PLAYER with per-tile segments (today one per tile).
- **Ф3 (2)**: the composer's own arrival playing the assembly; a tile run under a covered board from the L3 peek
  (today: the deck, named `board-covered`); the search segment's own tape in a merged batch.
- **Ф6 — the audit** of every producer: `tests/intake/cardIntakeSourceCoverage.spec.ts` lists the imperative draw
  sites outside the card tree with their scope; a new site must declare its root.

## Decisions taken by default (the owner's batch, 1–7 of the prompt)

1 the server's order · 2 «ПОЛУЧЕНО N» + a chip per cause with its share · 3 a search beside a plain draw stays the
search theatre (its tape covers the batch) · 4 external draws never merge · 5 a cell under a covered board deals from
the deck (named), the peek is next · 6 B on a merged batch = «Забрать все» · 7 rows up to the stage layout's cap.
