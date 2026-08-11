# THE COLONY RESOLUTION — the Pluto flow's one interaction owner

**Status: SHIPPED (2026-08-11, iteration 2 same day).** Module:
`src/client/console/colonyTrade/colonyResolution.ts` (pure derivations + the
remote-entry context + `colonyResolutionUi.discardStage`). Spec:
`tests/client/components/console/colonyResolution.spec.ts`. E2E:
`tests/e2e/console-colony-pluto-embed.spec.ts` (three tests — trade, build, and
the full own-colony draw+discard resolution with the root-exclusivity,
no-blank-stage, no-focus-hand-zone, marker-in-focus and return-leg guards).

## Iteration 2 — the physically continuous choreography

1. **The config releases UNDER the flying cards, never at the claim.** The
   focus stage's handoff cue is `outcomeHandoffDue` (covers airborne —
   `colonyTradeState.cardScene` off `'idle'` for this colony — with
   `outcomeContentIn` as the coverless fallback), one-shot
   (`outcomeHandoffPlayed`, drives the `--handing` pose too). Releasing at the
   claim was «интерфейс исчезает одним кадром → пустая пауза → готовый
   reveal». Both trade-confirm sites also `markWorkspaceOutcomeBeatDone()` —
   the trade owns its own pacing, and the veiled reveal must mount promptly
   for the covers to measure its slots.
2. **The FULL-STAGE discard.** The focus-stage hand zone is GONE (it was the
   broken B-only intermediate: a hand squeezed beside the hero planet with the
   stage intercepting input). `openColonyBonusDiscard` sets
   `colonyResolutionUi.discardStage`, closes the focus, and opens the hand via
   the PREMIUM dock→grid episode (`openHandWithReveal({keepTask:true})` — the
   same physical opening every route gets). The section renders the SOURCE
   CHIP («⏺ ПЛУТОН · БОНУС ВЛАДЕЛЬЦА», the tile's own planet art) and the
   section-level «СБРОШЕННЫЕ» seat; the browse grid stays yielded through the
   whole phase (`--yield` includes `discardStage`, which clears only AFTER the
   focus re-opens — no overview frame, ever).
3. **The held next cycle.** During `discardStage` the outcome slot selector is
   EMPTY (the claimed reveal renders nowhere) and BOTH card scenes (trade
   covers / deck-draw) skip claimed colony batches — a cycle-2 batch that rode
   the discard's own response parks and opens on the RESTORED focus stage.
4. **The return leg.** `handOffHandForDiscard` (a colony-bonus discard) arms
   `colonyFocusRestorePending`, gathers the hand home, then
   `restoreColonyFocusAfterDiscard`: focus re-opens FIRST, `discardStage`
   clears second, zones republish, and only then `syncColonyTrackCommit`
   reports the committed reset — the marker's return is the resolution's
   FINAL commit beat and always plays on the colony's own big track.

### The two traps iteration 2 paid for
- ⚠️ **The hand-reveal director's `setSection` hook spoke `goBoardHome` for
  every non-overlay hand.** For a hand hosted as an embedded STEP that wiped
  the whole stack the instant the close episode finished (e2e tail: stack
  empty at t≈0.75s, before the server even answered). The hook now pops ONE
  level for ANY hosted hand (`workspaceFrameHost('hand') !== undefined`), and
  `leaveHandAfterAnswer` early-returns when the episode already returned the
  frame — acting on an absent hand pops the HOST.
- ⚠️ **The embedded fit must solve for `stripCount`** (the batch total + the
  other zones), not the untaken remainder: the untaken count re-ran the fit as
  cards left and the survivors — and the lone taken-socket — visibly GREW
  mid-batch. The embedded closer also moved into the ONE stage status bar
  (`con-ws-stage-status`); an in-zone button was what pushed the bonus zone
  past the stage's vertical budget (the clipped top label / bottom CTA).

## The invariant

From the trade confirm to the last owed follow-up, the COLONY WORKSPACE is the
one root interaction owner. It may **collapse** («свернуть» — the stack parks,
the board shows the return card, the decision stays live) but it never unmounts,
never yields to a standalone reveal band, never hands the mandatory discard to a
second workspace, and never shares the screen with one.

The close gate is `colonyResolutionLive` (a ConsoleShell computed over
`colonyResolutionLiveFor`), true while ANY of these authoritative signals hold:

| Signal | Meaning | Source of truth |
| --- | --- | --- |
| `tradeActive` | the viewer's own trade transaction is running | `colonyTradeState.active` — concludes only on the COMMITTED track reset, which the server itself sequences AFTER every colony bonus (`Priority.DECREASE_COLONY_TRACK_AFTER_TRADE` vs the discards' `SUPERPOWER`) |
| `discardMeta` | a mandatory colony-bonus discard is the pending input | `waitingFor.discardPrompt.colonyBonus` (`{colonyName, index, total}`) |
| `discardFlightMeta` | the chosen card is physically leaving the hand | the running `cardDiscard` scene's own armed marker (`cardDiscardColonyBonus()`) |
| `entryColony` | the viewer entered a REMOTE owner-bonus resolution | `colonyBonusEntry` (armed at the announce door, cleared on the resolution's falling edge) |
| a colony-sourced reveal | a payout batch is on the table / parked | `currentRevealEvent().source` (`{type:'colony', colonyName, trade?}`) |

**What is deliberately NOT a close signal:** «the reveal has no untaken cards».
An empty reveal between two bonus cycles, a discard prompt whose batch was fully
collected, a discard flight after the prompt was answered — each is a
mid-resolution state, and each keeps exactly one of the terms above true until
the next takes over. Binding the lifetime to `visibleCards.length === 0` is the
exact bug this module replaced (`COLONIES → MODAL НА ПОЛЕ → HAND WORKSPACE`).

## How the lifecycle drives the stack

- `WORKSPACE_KINDS.colonies` is `hosts: 'inFlow'`. On the resolution's RISING
  edge (the `colonyResolutionLive` watcher in ConsoleShell) the colonies frame
  goes `phase: 'committed'` and EARNS `serves: ['colony', 'handSelect']` —
  runtime-earned, never a registry default, so an idle colonies screen can't
  mask an unrelated stranded hand pick from the leak detector.
- The mandatory discard routes through `openShellTaskSurface` →
  `openColonyBonusDiscard`: `openHandWorkspace()` now finds
  `workspaceHostForStep() === 'colonies'` and pushes the hand as an **embedded
  step** (`colonies ⊃ hand`), teleported into the workspace's own zone. The
  crumb reads «КОЛОНИИ › ПЛУТОН › СБРОС КАРТЫ» (`setWorkspaceFrameStage('hand',
  'Discarding a card')`).
- The FALLING edge releases the outcome claim, shrinks `serves` back, returns
  the frame phase to the player's own depth and clears the entry context. The
  claim-release sites that used to fire per-batch (`onEmbeddedDrawnComplete`,
  the `workspaceOutcomeEmbedded` falling edge, `reconcileWorkspaceOutcome`) all
  carry a `host === 'colonies' && colonyResolutionLive` keep-guard.

## The zones (one writer each)

The colonies section publishes TWO teleport channels:

- **The outcome claim channel** (`setWorkspaceOutcomeSlot`) — the reveal:
  `[data-embed-slot="colonies-focus-reveal"]` while the focus stage stands,
  `[data-embed-slot="colonies-reveal"]` otherwise (unchanged).
- **The stack frame channel** (`setWorkspaceFrameSlot('colonies', …)`) — the
  hand step: `[data-embed-slot="colonies-focus-hand"]` (a sibling of the
  outcome zone in the focus stage, same room the payout occupied) with the
  section-level `[data-embed-slot="colonies-hand"]` fallback for a reload
  straight into the discard. Both republished from `mounted()` (the
  restore-mid-resolution case) and retracted in `beforeUnmount`.

## The stage's resolution presentation (`ConsoleColonyFocusStage`)

- **The hero is the SOURCE and stays lit**: the `--handing` dim is `.92`
  (was `.5` — «Плутон выглядит отключённым»), and the identity column carries
  the `◈ ИСТОЧНИК` chip + the role line that advances with the waves —
  «Награда за торговлю» → «Бонус владельца» (cyan chip, amber/mint role —
  survives desaturation by weight).
- **A remote entry names its trigger**: «Сработал бонус владельца» + «<трейдер>
  торговал с этой колонией», the trader resolved from the colony's `visitor`
  (authoritative — the trade parked their fleet there; no new server field).
- **«СБРОШЕНО» seat** (`[data-colony-discard-seat]` / the
  `[data-colony-discard-tray]` anchor): the shared discard cinematic's tray
  TELEPORTS into it (`ConsoleCardDiscardLayer.workspaceSeat` — same reactive
  guard the seat's own `v-if` reads; a collapsed workspace falls back to the
  stock corner berth). Between cycles the seat keeps the receipt
  (`colonyResolutionUi.discarded`) so a completed cycle stays fixed on screen.

## The remote owner bonus (a foreign trade)

`remoteColonyBonusPendingFor` — the batch/discard exist, the viewer neither
traded nor entered. While pending:

- `rawDrawnRevealPending` answers false (nothing mounts over wherever the
  player stands) and the deck-draw layer skips the batch (`remoteColonyBonusHold`);
- the mandatory gate's `handSelect` beat announces itself with the specific
  copy «Сработал бонус колонии: <колония>» (`consoleTaskSummary`, a data-token
  Message — never a title match);
- opening the announce arms `colonyBonusEntry` → the hold drops → the workspace
  opens DIRECTLY on the colony's focus stage (never the overview), the claim
  embeds the reveal, and the deck-draw scene SERVES it — the cards honestly
  peel off the deck into the embedded slots (the start-host pattern).

⚠️ **The hold is keyed on the DISCARD MARKER only.** A bonus batch with no
marker is the auto-discard edge (the owner's hand was too small for a choice —
the server discarded silently): no mandatory action exists, no beat could ever
open the door, and holding it would park the batch forever.

## B across the resolution

- Focus stage, resolution live, frame committed → **collapse** (the whole stack
  parks; mandatory-defer standard — never a fold that tears the reveal out,
  never a way around the mandatory discard). The frame's own phase is the
  discriminator, so a casual inspect while someone ELSE's payout is pending
  still closes normally.
- The nested hand step → the existing rule (B on a nested step minimizes the
  hosting workspace).
- Restore from the park re-opens the FOCUS STAGE when the resolution is live
  (`restoreDeferredTask`) — the flow comes back on its scene, not the overview.

## Traps this rework paid for (keep them fixed)

1. **`section` is a projection.** The nested hand step projects
   `section: 'hand'` while the colonies frame still hosts it — the shell's
   section watcher must reset the colony focus only when the colonies frame is
   GONE (`!workspaceFrameKnown('colonies')`), or the stage unmounts under the
   step and the hand renders nowhere.
2. **An overlay over a browse layer is a split screen.** `openHandWorkspace`
   overlays only a frame genuinely MID-FLOW that cannot host; a stack idling at
   browse is a lateral `enterWorkspace` — overlaying it painted two live
   workspaces side by side.
3. **The embedded fit must count the bonus zones.** `fitEmbeddedStrip` solves
   the row from `stripEntries + bonusZones` — the zones stand card-sized slots
   of their own, and solving for the flat entries alone clipped the last zone
   on the stage edge. The embedded strip also reserves the zone frame's
   overhang as padding (`console_colony_trade.less` `:has` rule), so the ring
   and glow never cut.
4. **The last take's commit runs at the intake's seam — HOLD FIRST, DECIDE A
   TICK LATER.** The reveal's take commit once sampled the discard marker on a
   mid-update frame, read it blinked-off, and closed a batch that still owed
   its mandatory step (the e2e timeline showed claim → completeFlow →
   goBoardHome inside 400 ms). Both take paths now `holdRevealForFollowUp`
   provisionally and decide close-vs-keep on `$nextTick`, on settled state; a
   trade transaction is likewise NOT a reliable «own flow» proof (a
   no-track-move trade concludes before the discard), so the own/remote split
   keys off the workspace's live CLAIM (`claimedByColonies`).
5. **Debugging a wrong release**: `releaseWorkspaceOutcome(reason)` records
   its caller tag (`lastOutcomeReleaseStack`, exposed via `__conColonyDiag`),
   and the Pluto e2e's `watchPayout` keeps a transition timeline — read those
   before instrumenting anything new.
