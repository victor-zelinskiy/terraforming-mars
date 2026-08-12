# THE COLONY RESOLUTION — the Pluto flow's one interaction owner

**Status: SHIPPED (2026-08-11, iterations 2–4 same day).** Module:
`src/client/console/colonyTrade/colonyResolution.ts` (pure derivations + the
remote-entry context + `colonyResolutionUi.discardStage`). Spec:
`tests/client/components/console/colonyResolution.spec.ts`. E2E:
`tests/e2e/console-colony-pluto-embed.spec.ts` (four tests — trade, build, the
full own-colony draw+discard resolution with the root-exclusivity,
no-blank-stage, no-focus-hand-zone, marker-in-focus and return-leg guards, and
the PARKED leg: gather on collapse, plain browse on a visit, clean restore).

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

## Iteration 3 — the launch reads as SEPARATION FROM THE PRINTED BACK

- The cover ladders lead with the REWARD CELL's own card-back glyph
  (`[data-colony-card-cell]` on the track cell body) and the owner-bonus
  zone's printed card (`[data-colony-bonus-cell]` on `__ob-value`); the
  planet is only the deep fallback. ⚠️ The anchor binds
  `cell.effective || cell.marker`: post-commit (when the covers actually
  measure) the EFFECTIVE flag has collapsed with the spent offer, and the
  frozen MARKER cell (presented pre-reset position) IS the paid cell —
  binding effective alone silently degraded every launch to the planet.
- `runTradeCoverFlight` speaks the board-bonus lift grammar: SEPARATION
  (straight up off the cell, growing, the flip beginning WITH the growth,
  `TRADE_COVER_LIFT_MS`) → TRAVEL (two-channel arc, remaining growth,
  deceleration) → SETTLE. The hover size is STRICTLY MONOTONIC (capped at
  92 % of the landing scale) — the bare ×1.6 arm once inflated a mid-sized
  source past the slot, and grow-then-shrink is the «резко» read. Stagger
  170 ms — «по одной» is readable. The source cell answers each departure
  (`con-colcell--dealt`, transform+box-shadow only).
- A SINGLE-card batch flies to the CENTRE presentation pose only on the
  standalone/headless path; an EMBEDDED reveal has a real slot and the
  multi path lands the cover pixel-perfect on it (the centre detour +
  slot-release read as a teleport).
- **Reveal → discard is DIRECT**: `armColonyFocusQuickExit()` makes the next
  focus LEAVE a short quiet fade — the full fold-to-tile re-materialized the
  colony composition for a second between the reveal and the hand.
- Diagnosing a wrong launch: the e2e `watchPayout` records `proxyPose` (the
  first POSED cover's rect + its landing slot) — a birth rect the size of
  the planet, or an apex above the slot, names the broken ladder rung in one
  run.

## Iteration 4 — the fan, the late dissolve, and the park as a real place

- **The launch opens with a FAN.** One wave's covers are born STACKED on the
  printed back (the cell shows one back — that is the truth) and peel into
  the REAL count side by side: small rise, small growth, face-down,
  `TRADE_FAN_STAGGER_MS` apart, then a readable hold (`TRADE_FAN_HOLD_MS`)
  before the first grow-flip-travel departs. The player counts the payout
  over the still-standing scene; two covers departing from one rect was the
  reported «наложились одна на другую». The plan carries the fan
  (`fanDelayMs`/`fanIndex`/`fanCount`); `delayMs` (the departure) already
  includes `TRADE_FAN_LEAD_MS`, so the budget formula never changed. Scale
  stays monotonic end-to-end: fan ≤ hover ≤ 92 % of landing.
- **The stage dissolves LATE, under almost-grown cards.** New scene value
  `'ascend'` (`ColonyTradeCardScene`): the layer fires it when the first
  cover is ~45 % into its travel; `outcomeHandoffDue` keys on
  `ascend|frame|handoff` (never `fly`), and the reveal's whole-modal veil
  (`bonusVeiled`) drops at the same beat — «Получены карты» materializes
  under the landing flight. `fly` still input-locks; `ascend` joined it.
- **«Свернуть» is physical both ways.** `collapseWorkspace` with the OPEN
  hand as the visible step measures the grid FIRST, starts the standard
  close episode, then parks — the gather flies over the board (the park IS
  this path's `setSection`; the episode's own hook then fires against an
  empty live stack, a no-op). The restore (`restoreDeferredTask`) seeds
  `phase='opening'`+`holdSlots` BEFORE the frames return and replays the
  dock→grid reveal (`replayHandOpenReveal` — a bounded RAF loop rides the
  re-mounting teleport chain). ⚠️ Reduced motion and a zero-pair measure
  keep the instant park: the episode's empty/reduced path calls its section
  hook SYNCHRONOUSLY, which would pop the hand frame BEFORE the park and
  lose the step's depth.
- **The restore never paints the focus over the discard.** The focus-reopen
  branch is gated `!colonyResolutionUi.discardStage` — the hand owns the
  room in that phase (reopening it was the reported two-screen overlay).
- **A parked resolution is invisible to a browse VISIT.** The wheel's
  «Колонии» is a lateral `enterWorkspace` (the park is untouched), but the
  CLAIM lives in module state and survives the park — so the section gates
  everything claim-derived on `!workspaceFrameParked('colonies')`
  (`resolutionParked`): `revealEmbedActive`, the discard-stage yield, the
  crumb, the seat. Without the gate the visit rendered the parked flow's
  crumb «ПЛУТОН › ДОБОР КАРТ» over a yielded (blank) browse. ⚠️ The unmount
  slot-clear now checks the RAW claim (`outcomeState.host === 'colonies'`),
  because a collapse parks the frames BEFORE `beforeUnmount` runs — the
  gated computed is already false there and the stale selector would
  survive into a detached node.
- **The hero column never re-judges past the commit.** `commitLatched` (set
  on `pastCommit`'s rising edge, `immediate` — a stage mounting
  mid-resolution is past it from frame one) permanently hides the
  pre-commit verdict for that stage session, and `presentedContext` holds
  the LAST source role to the final frame — the resolution's end releases
  `pastCommit`'s terms one signal at a time, and the gap flashed a red
  «✕ Здесь стоит ваш флот» over the payout that fleet had just earned.
  Plus the ability line's floor: `__desc` keeps two lines (`min-height:
  2.68em`), `__idmeta` crops as the last resort, and the inspect stage got
  the height those floors need (21rem base / 23.5rem tv).
- Small fixes shipped with it: the trade-fee picker's floater path now
  carries `optionMetadata()` on the SERVER
  (`TradeWithTitanFloatingLaunchPad` — icon + `current → resulting`, the
  same marker shape as energy/titanium/M€); the track scale is wordless
  (the «ВОЗВРАТ» / «МЕСТА КОЛОНИЙ» captions restated the drawn rule); the
  discard's colony context moved INTO the hand's ask plate (planet mini +
  the colony's name via `DiscardIntent.colonyName`, replacing the section's
  green chip row), and the bare hand count reads «Всего карт: N» in select
  mode.

## Iteration 5 — the OTHER shape of an owner bonus (Miranda)

Pluto's owner bonus is «draw 1, then discard 1»; Miranda's is a plain «возьмите
карту». Everything the resolution had was built around the first shape, so the
second fell through both halves of it.

- **A BONUS CARD LEAVES THE STRIP ONLY WHEN SOMETHING WILL DRAW IT.** The
  reveal split the batch's bonus wave out unconditionally and rendered it in
  the «Бонус колонии» ZONES — which exist only while the server's *discard*
  marker does. A bonus card with no zone therefore rendered in NEITHER place:
  no slot ⇒ the trade covers had no landing target (they degraded), and the
  take had no origin to fly from (`runHandIntake` needs the slot element), so
  «Взять» was a dead press over an empty stage. `revealWaveForIndex(segments,
  i, zoned)` is that one question, asked by the renderer that knows the
  answer; the cover's `faceDown` is decided per card off the REAL slot it is
  flying to (`.con-reveal__bonus-zone` ancestor = the zone will turn it over).
- **A REMOTE bonus is DELIVERED, not posted.** A plain draw paid by somebody
  else's trade had no prompt at all, so there was nothing for the gate to
  announce and nothing to hold: the card landed in a hand nobody had looked at
  and a full-bleed reveal appeared over whatever screen its owner was on, mid
  another player's turn. The server now asks: `ColonyBenefit.DRAW_CARDS` paid
  to a NON-trader becomes a `SelectOption` marked `colonyBonusPrompt`
  (`ColonyBonusCollectMeta` — colony, cards, cube index/total, trader), and
  **the cards are drawn inside the answer**. The trader's own cube stays
  inline (they are already watching their own payout), a bot never prompts.
  ⚠️ It is queued with `player.defer(…, Priority.BACK_OF_THE_LINE)` on the
  RECIPIENT, never returned to `GiveColonyBonus`: returning it holds the whole
  deferred queue until every recipient has answered, so the TRADER's own trade
  income (Miranda's animals resolve at `GAIN_RESOURCE_OR_PRODUCTION`, i.e.
  after the bonus) and their track reset would freeze behind an opponent's
  click. The two are independent by the rules — the delivery is the tail.
- **The console routes it as its own kind**: `colonyBonus` (marker over type —
  on the wire it is a bare `option`), in `SHELL_SECTION_KINDS` and in the
  gate's `ALWAYS_INTERRUPTIVE` (it can never be the viewer's own doing). The
  announcement says WHAT happened («Сработал бонус колонии: Миранда» — the
  same sentence Pluto's uses) and its A-verb says what the press does
  (`ConsoleTaskSummary.openKey` = «Забрать карту»). The press is the answer
  AND the journey: `openColonyBonusCollect` enters the colony's bonus stage
  FIRST (so the claim exists before anything can arrive) and only then
  submits — the drawn card then flies from the deck into the workspace's own
  zone. The NEXT cube of a multi-settlement payout collects ITSELF
  (`colonyBonusAutoCollect`, gated on an empty table) instead of announcing
  again at a colony the player is already standing on.
- The resolution's serve-set is one constant now (`COLONY_RESOLUTION_SERVES` —
  `colony` + `handSelect` + `colonyBonus`), earned on the rising edge and at
  every entry, never a registry default.

## Iteration 6 — the reset is the LAST beat, and the gate must prove it

The marker glided across the track WHILE the first card was still flying to
the table. The gate asked the wrong list:

- `stagedRevealsConfirmed()` walked `colonyTradeState.stagedRevealIds` — what
  the COVER SCENE has claimed. That list fills a tick or two AFTER the batch
  lands (the reveal store is reconciled by its own `playerView` watcher), so
  «nothing staged» read as «every reveal confirmed». For a colony whose trade
  income IS the draw (Pluto) there are no resource chips to wait for, so the
  commit walked straight to `awaiting` and the whole conclusion — glide,
  settle, `finishTrade` — ran inside that gap.
- The gate is now `tradeCardsOutstanding()`: batches matched **by tradeId**
  (server truth, present from the moment the response lands), plus «the
  manifest promises cards the store has not seen yet» (`plannedViewerCards()`
  from `benefitCardCount` + `viewerBonusCubes`, with a latched `revealSeen` so
  a taken-and-acked batch — gone from the store — never re-opens the gate).
  The one case where a promised card never arrives (an exhausted deck yields
  no batch at all) is a bounded, named degrade net (`REVEAL_WAIT_MS`), not an
  open wait.
- ⚠️ It only became VISIBLE in iteration 4: before the late dissolve the
  colony stage had already faded by the time the marker moved, so the early
  glide happened off screen. A timing bug that hides behind another animation
  is still a timing bug — the fence is now in the e2e (`glideOverReveal`, on
  every Pluto payout watch) and in the unit spec («a trade whose income is a
  DRAW never concludes before its cards exist»).
- **AND THE STAGE MUST BE BACK, not merely the cards gone.** The payout pose
  `--handing` takes `.con-colfocus__main` to `opacity: 0` — and the TRACK is
  drawn there. The pose used to ride the CLAIM, which by design outlives the
  batch (the resolution owns the workspace until the reset commits), so the
  colony stayed blank for its own closing beat: a white dot crossing an empty
  panel. Two halves, both needed:
  · the pose now rides the PAYOUT (`workingAreaYielded` = the handoff played
    AND a reveal batch is on the table), so the working area comes back the
    moment the last card is taken;
  · the conclusion WAITS for it (`setColonyStageYielded` — published by the
    stage, consulted only by `maybeAdvance`), and the release is dwelled by
    the pose's own transition (`WORKING_AREA_BACK_MS`), because a marker
    launched into the fade is the same fault a third of a second shorter.
  A stage that UNMOUNTS clears the flag (the discard closes the focus
  mid-flow; the reset then plays on the restored one, or on the overview
  tile) — the conclusion may never wait on a screen that no longer exists.
  Fenced end-to-end: Pluto test 1 now takes the card and watches the closing
  beat (`markerSeen` + `glideOverReveal` + `glideOverBlankStage`), so «the
  reset ran at all», «never over an open reveal» and «never over a hidden
  track» are asserted together.

## Iteration 7 — the summary rail is a REWARD PACKAGE, the overview has ONE verb

- **Three questions, in the order a player asks them** (`colonyRewardPackage`
  in `colonyTradePlan.ts` — pure, swept in its spec): «ВАШ ИТОГ» is what the
  VIEWER ends up with (the track's income + their OWN settlements' bonuses,
  merged per reward TYPE **and** DESTINATION — Io's 6 + 2 heat is one «+8
  тепла», Miranda's animals and card stay two lines); «СОСТАВ НАГРАДЫ» is the
  arithmetic behind it, one row per payer with the multiplier that turns two
  identical settlements into «Ваша колония ×2»; «ДРУГИМ ИГРОКАМ» is everyone
  else's, and it is **never** part of the total — the rail used to print the
  per-cube rate beside every name right under the payout, which read as money
  the player was about to receive.
- A total line always carries a READING: `current → resulting` when the
  viewer's stock has an unambiguous number, otherwise the DESTINATION
  («На выбранную карту», «В руку»). A bare «+2 животных» is an amount the
  player cannot place.
- Mechanism: `tradeOutcome`'s gain chips now carry `source` (`track` /
  `ownColony` / `card`) + `benefit`, so the package GROUPS the very chips the
  panel already trusted instead of re-deriving the trade a second time (two
  derivations of one payout drift — that is the whole reason this is one pure
  function). `current → resulting` survives the merge because the chips were
  computed in sequence: the first chip's `current`, the last one's
  `resulting`. ⚠️ `data-colony-trade-source` moved with the income's value into
  the breakdown row — it is the chip/cover LAUNCH anchor and must stay on the
  number they physically leave.
- **The overview offers ONE press.** «X Осмотреть» is gone (both verbs opened
  the same stage, so the bar advertised a choice that did not exist) and A is
  always «Выбрать» — never «К строительству» / «Торговать», a destination the
  overview cannot promise. The stage is the dossier AND the action, and it is
  where availability and its blocked reason are stated.

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
