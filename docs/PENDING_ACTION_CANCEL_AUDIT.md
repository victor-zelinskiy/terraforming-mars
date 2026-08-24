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

### The trap pay-on-commit creates: the target list is built with money that is already spoken for

Deferring the charge to the commit callback means the TARGET LIST is computed while
the project's own price is still sitting in the player's stock. Any target that
carries an ADDITIONAL cost of its own — an Ares hazard to clear (8 / 16 M€ + TR),
an Ares adjacency cost, the Hellas ocean space (6 M€), the Vastitas north pole
(3 M€), the Terra Cimmeria colony space (5 M€) — was therefore measured against a
balance that included the very money about to be spent on the project.

The failure that reported it: a city standard project offered a severe-hazard cell
to a player holding 35 M€ (25 + 16 = 41 needed). `AresHandler.assertCanPay` ran
BEFORE `commitCost` and approved 16 M€ against 35; the tile was seated, the hazard
cleared and its 2 TR granted; `commitCost` then took the 25; and the DEFERRED
placement payment finally threw `Player does not have 16 M€` — an untranslated red
error over a game left with the hazard removed, the cost never paid and the turn
dead. `canAct` never had this hole (it asks with the project's cost included); the
space list simply asked a different question.

The contract now, in three places that must stay together:

1. **`StandardProjectCard.placementCanAffordOptions(player, payment)`** — the ONE
   affordability basis for a pay-on-commit target list. The chosen `payment` is
   already known when `payAndExecute` runs, so it reserves EXACTLY the units the
   commit will spend (`reserveUnits`) and asks what a placement may still cost on
   top. It deliberately does not carry the project's `canPayWith`: a placement cost
   takes M€ (plus Helion heat / Luna Trade Federation titanium), never steel or seeds.
2. **`StandardProjectPlacement`** filters every target by it, re-checks it at commit
   BEFORE any mutation, and passes it to `createMarsSelectSpace` so a cell excluded
   for money explains itself as `cannot-afford` with the honest gap («Нужно ещё 6 M€»)
   instead of a vaguer reason. If no target survives, nothing has been spent yet, so
   it resolves like a cancel — the player keeps the money and the action.
3. **The commit charges BEFORE it places** (as `BuildColonyStandardProject` already
   did, and as the committed path always did): the placement's own costs are then
   measured against what is actually left, so `assertCanPay` cannot approve a bill
   the player can no longer pay.

`Board.canAfford` also SUMS the caller's TR with the space's TR (`sumTRSources`)
rather than overwriting it — a greenery project clearing a hazard under Reds owes
the tax on both bumps, and an under-counted tax is the same starved-payment crash.

Guarded by `tests/cards/base/standardProjects/StandardProjectPayOnCommit.spec.ts`
§ «placement costs».

#### And the refusal has to be arithmetic the player can CHECK

Filtering the cell out is only half the answer — the panel then said «Не хватает 1 M€»
next to its own «расчистка: 16 M€» row while the bank plainly showed 40 M€, three
numbers that only add up once the fourth is named. `PlacementIllegalSpace` therefore
also carries **`committed`** — the M€ the pending action has already earmarked (cash,
plus heat when heat IS money for that player) — and the refusal reads
«Не хватает 1 M€ — ещё 25 M€ уйдёт на сам проект». Steel or titanium reserved for the
project's own price are deliberately NOT counted: they could never have paid a
placement cost, so naming them would misexplain the shortfall.

### The same starvation outside the standard projects: Reds policy 2

`rp02` («When you place a tile, pay 3 M€ **or as much as possible**») sized its tax
in `onTilePlaced`, i.e. when the payment was QUEUED — behind the Ares hazard-removal
payment for the very same placement. The hazard took the money first and the tax
then threw `Player does not have 3 M€` with the tile already on the board, for ANY
tile placement (a card's, not just a standard project's). `SelectPaymentDeferred`
now has an **`atMost`** option that clamps the amount to what the player can pay AT
EXECUTION TIME, which is the only moment an «as much as possible» rule can be sized.
It is only for a rule that genuinely says that — a MANDATORY cost must keep throwing,
because silently charging less breaks the rule instead of reporting it.

Guarded by `tests/turmoil/parties/Reds.spec.ts` § «Ruling policy 2».

### What a placement cost is made of (the audit behind the fix)

Everything below reaches the filter, the cell preview and the M€ gap through the
SAME `Board.computeAdditionalCosts` → `Board.canAfford` pair, so all three agree:

| Modifier | Source |
| --- | --- |
| Ares hazard on the target cell (8 / 16 M€ + 1 / 2 TR) | `computeAdditionalCosts` |
| Ares adjacency cost of a neighbour (e.g. Nuclear Zone, 2 M€) | `space.adjacency.cost` |
| Ares hazard ADJACENCY production penalty (1 / 2 per neighbour) | production branch, waived for an ocean tile and for Athena's owner (`subjectToHazardAdjacency`) |
| Hellas ocean 6 M€ · Vastitas 3 M€ · Vastitas Nova 4 M€ · Terra Cimmeria Nova colony 5 M€ | each board's `spaceCosts` override (all four checked; no other board declares a costed bonus) |
| Underworld `place6mc` (−6 M€) | `Board.canAfford` — **see the caveat below** |
| Reds TR tax on the space's TR **and** on the project's own TR | `sumTRSources` in `Board.canAfford` |
| World Government (solar phase) waiving Ares costs wholesale | `AresHandler.placementCostsWaived` |
| The project's own discounts (Labor Trafficking, …) | inherent — the reserve is the ACTUAL `payment`, never a recomputed price |
| Reds policy 2's 3 M€ tile tax | deliberately NOT in the filter: «or as much as possible» must never block a placement (it is sized at payment time instead) |

Two boundaries were wrong and are now aligned with the check that CHARGES:
* the production penalty compared with `>` while `AresHandler.assertCanPay` uses
  `>=` — a cell the rule allows (shed EXACTLY everything) was hidden with no way
  to ask why;
* `Board.canAfford` overwrote the caller's TR with the space's TR (see above).

**KNOWN, NOT FIXED — Underworld `place6mc` against a placement cost.** The filter
subtracts the token's incoming 6 M€ (`plan.cost -= 6`) but nothing else does: the
6 M€ is granted by `grantPlacementBonuses` as a deferred gain queued BEHIND the
placement payment, and `AresHandler.assertCanPay` does not know about the token at
all. Reproduced: a mild hazard (8 M€) on a `place6mc` cell with 3 M€ in hand is
OFFERED and then refused with `Placing here costs 8 M€`. It cannot corrupt a game
(the assert runs before any mutation) but it is an offered-then-refused cell.
Fixing it is a product call between two directions: make the filter conservative
(drop the −6, one line, the cell is simply not offered) or make the money real
before the fee is collected (grant the token's 6 M€ ahead of the placement costs
AND teach `assertCanPay` about it). Underworld is outside the fork's premium scope,
so neither was taken unilaterally.

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
