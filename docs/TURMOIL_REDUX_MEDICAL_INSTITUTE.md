# TRP9 · Medical Institute («Медицинский институт») — the first PRELUDE-REACTOR

**Card:** `src/server/cards/turmoilRedux/MedicalInstitute.ts` · **spec:** `tests/cards/turmoilRedux/MedicalInstitute.spec.ts` ·
**e2e:** `tests/e2e/console-medical-institute.spec.ts` (TIMING) · art + lore keyed `TRP9`.

## 1. The card

Prelude, **Microbe + Science**, `drawCard: 1`, `compatibility: 'prelude'`. Effect: «After you play a Science tag
(including this), add 1 microbe or data resource to ANY card.» The rulebook v1.0 and its FAQ say nothing about it; the
reading follows the sister reactors Olympus Conference / Mars University:

| # | Reading | Where |
|---|---|---|
| 1 | **Per Science tag** (`cardTagCount(card, SCIENCE)`) — a card with two Science tags owes two units, two independent picks; an event's Science tag counts | `onCardPlayed` |
| 2 | **«Including this»** by construction — `playCard` lays the card in `playedCards` before `Player.onCardPlayed` walks the tableau | engine |
| 3 | Own plays only (the owner's tableau is walked); MarsBot is never dealt a Prelude | engine |
| 4 | ONE pick over the union of microbe and data holders (`AddResourcesToCard` over `[MICROBE, DATA]` — RX18 / TRP8), `autoSelect: false` (one candidate is still asked), the unit's kind = the chosen card's | `whereStep` |
| 5 | No holder → the shared step's NAMED skip (`recordSkippedEffect`, «No eligible card»); the forecast states it with the same label | step + `cardPlayedForecast` |
| 6 | Order on one answer: the card is drawn first (`DRAW_CARDS`), then «where?» (`GAIN_RESOURCE_OR_PRODUCTION`) | `Priority` |
| 7 | `onNonCardTagAdded(SCIENCE)` answers like a played tag (Olympus parity; nothing in scope adds a bare Science tag today) | hook |

**ONE builder** (`whereStep(player, cardBeingPlayed?)`) is read by the live defer and by the forecast twin: one `asks`
fact per Science tag on effect frame #0 (`printedEffect: 0`, `reasonTag: SCIENCE`), its pick PRE-COLLECTED
(`forecast.tableQuestion` over the step's `previewPick()`), addressed to TRP9. `cardBeingPlayed` is load-bearing: a
microbe / data card being played (Supercomputer, Vector Computations…) is its own candidate, and the live set — the card
already on the table — must match the preview's.

## 2. The console

- **The rise on the shelf (PL-1118).** `ConsoleStartScene.startCarriesReactor` held the start's reactor place for
  CORPORATIONS only; a PRELUDE answering its own play is in flight from the queue to «РАЗЫГРАНО» when its reaction
  rises, so the director lifted a second instance at the reaction stage. The predicate now holds a carried prelude too;
  the face is the shelf's (`data-played-key`, already in `startVisibleFace`), waited for (bounded) as PL-1098 waits for
  the seat.
- **«КУДА» inside the start (PL-1117).** The start's play claim (`draw`/`pick`/`effect`, scope `chain`) was released
  by the FIRST seam of the take — `onWorkspaceResultDetached` (`result-detached`, forced, 14 ms before
  `drawn-complete`) — so the target pick that follows rose as the task host's own «ЦЕЛЬ НА КАРТЕ» band over the start.
  ONE structural predicate, `consolePlayOutcomeClaim.playOwesTargetPick(waitingFor)` (the claim admits `pick` ∧ the RAW
  prompt is a `card` with `resourceGainPrompt`), keeps the claim AS IT IS at all four release sites of the take
  (`onWorkspaceResultDetached`, `onEmbeddedDrawnComplete`, `embed-fell`, the start scene's reveal edge) — never re-posed
  to `awaiting` (the first attempt did, the zone stood empty and the start left for the board). The pick then stands in
  the start's zone — «СТАРТ ПАРТИИ › МЕДИЦИНСКИЙ ИНСТИТУТ › ЦЕЛЬ НА КАРТЕ», the Institute in the seat «Источник» (where
  it also rises) — and the reconciler releases the claim once it is answered. The token of the answer is born on a
  PAINTED source (`promptReceive.originsFor`): the plate's dock when it is painted, else the asking card's own face
  (`choiceContext` source → the seat «Источник» / a shelf slot) — an embedded pick's dock stands under its host's glass.
- **«Сработает» in the hand composer** is the reactor framework for free (TR51/TR80): one row per Science tag, each
  seeded with a sole candidate (T14), the answers riding the play's one batch.

## 3. What the next prelude-reactor inherits

A prelude whose effect answers its OWN play needs nothing new: the hook + its twin from one builder, `printedEffect`
on the source, the start's reactor place (a carried prelude is held now), and a target pick it asks after a draw stands
inside the start (`playOwesTargetPick`).
