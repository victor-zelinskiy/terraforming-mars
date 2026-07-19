# Pending-action cancel — audit & classification

Cancel of a **pending, not-yet-committed** action (NOT historical undo of a committed action). A cancel is only safe before the **commit barrier**: nothing spent, no tile/colony/token placed, no card revealed publicly, no triggers fired, no committed journal event.

The shared mechanism (built in the BoardInformation work): a server `placementContext` marker (`cancellable` + honest `reason`, `src/server/inputs/placementContext.ts`) on the pending input, a `CancelResponse {type:'cancel'}` handled by the input's `process` (→ an `onCancel` that sets the transient `player.pendingPlacementCancelled`), and `Player.getActions`' `runWhenEmpty` re-presenting the action menu **without counting the action**. Surfaced in the UI by `PlacementBanner` (board), `ColoniesOverlay` (colony build), and — the prominent anchor — the **mandatory-action notification** (`NotificationCard` "Cancel" CTA, driven by `waitingFor.placementContext.cancellable`).

## A — Safe to cancel now (IMPLEMENTED)
All pay-on-commit: the cost + effects apply only in the placement/selection commit callback, so cancel before commit spends nothing.

| Flow | How | Cancel surfaced in |
| --- | --- | --- |
| City / Greenery / Aquifer standard projects | `StandardProjectCard.payAndExecute` override → `StandardProjectPlacement` (cancellable `SelectSpace`) | PlacementBanner + notification |
| Build-Colony standard project | `BuildColonyStandardProject.payAndExecute` override → `BuildColony` with `commit`/`onCancel` + cancellable `SelectColony` | ColoniesOverlay "Cancel construction" + notification |
| Convert plants → greenery | already pay-on-commit (`ConvertPlants.action` spends plants in `andThen`); `cancellablePlacement` marker | PlacementBanner (client picker) |

## C — Client-only back/cancel (ALREADY have cancel; no server round-trip)
Nested picks inside a modal / the action menu — cancel restores the prior UI locally. They do NOT raise an `action-required` notification (the modal/overlay owns the screen), so no notification change was needed; each already shows a Cancel/close in its own overlay.

- Sell patents (`sellPatentsState` → "Cancel sale" in HandCardsOverlay)
- Played-card target pick (`playedCardsPickState.cancelPlayedCardsPick` → "Cancel" in PlayedCardsOverlay)
- Repeat-action pick (`actionsPickState.cancelActionsPick` → "Cancel" in ActionsOverlay)
- Convert-plants client picker (`toggleConvertPlantsPicker` via PlacementBanner `@cancel`)

## D — NOT safe now; needs a transactional refactor (classified, NOT implemented)
The action is **already committed** by the time the placement/selection prompt appears, so a cancel would leave inconsistent state. Left committed (honest — no misleading cancel shown).

- **Blue-card / corp / CEO ACTIONS that place or move** (e.g. Mars Nomads *action*, board-movement actions). `Player.playActionCard` (`src/server/Player.ts` ~1224-1238) marks `actionsThisGeneration.add(card)`, logs "used X action", and opens the journal `beginAction` scope **at selection time — BEFORE** the action's `SelectSpace`. Cancelling the placement would leave the card stuck "used" + a phantom journal root. **Fix (future):** defer the used-mark / log / scope to the action's commit (touches every blue-card action — do behind tests).
- **Card-play-with-placement** (a project card played from hand that then places a tile). The card is paid, revealed publicly, "played X" logged, and on-play effects run **before** the placement `SelectSpace`. Cancelling can't un-play it. **Fix (future):** a transactional card-play — reveal / pay / play committed only after placement; until then the card-play modal pre-collects choices but the residual placement is committed.
- **Mars Nomads initial placement (`bespokePlay`)** — same as card-play (the card is committed on play).

## E — Out of scope
Full historical undo after commit; any flow after a reveal / random / draw / dependent-trigger.

## Genuinely mandatory (correctly NO cancel)
Hand-select discard (`SelectCard`), forced play-from-hand (EccentricSponsor / EcologyExperts), free award funding (Vitor), `productionToLose`, payment, target / steal picks. These are required sub-decisions of an already-committed action — the notification shows no cancel (the `placementContext` marker is absent / `cancellable:false`).
