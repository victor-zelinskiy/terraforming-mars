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

## Iteration 8 — one flight language for BOTH doors, and one turn per card

The payout's choreography was written for the TRADE and never reached the
BUILD, and the bonus zone kept a second turn of its own. Three roots, all
general:

1. **A held EXECUTION BEAT starves the flight that needs the surface.** The
   build's claim marked the arrival done but not the BEAT, so
   `revealHeldForWorkspace` kept the reveal unmounted for the whole 2.6 s
   backstop. The cover-lift scene lifted its cover, reached `gather`, found no
   `[data-zoom-slot]` to measure (its probe is 40 frames), degraded — and the
   cards then appeared out of nothing when the backstop fired: the reported
   «при строительстве колонии карты просто появляются». **A claim whose payout
   is flown by a scene must mark the beat done at claim time** — the hold
   exists to protect a beat nobody else is playing.
2. **Every card of a payout turns IN THE AIR.** The colony-bonus cover used to
   be delivered face-down for the zone to open on the table
   (`runTradeCoverFlight({faceDown})`, `con-bonus-turn`). That drew the zone's
   own card BACK from the moment it mounted — so while the cover was airborne
   there were TWO backs for one card — and then played a second, differently
   shaped turn on the one card of the row that had not turned on the way. The
   zone now renders the card exactly as the strip does, the flip chassis is the
   take-in-place turn's alone, and `bonus-held` additionally holds every BACK
   (zone card, waiting placeholder, taken socket): nothing of a card exists in
   the destination while its cover is still carrying it.
3. **The stage evaporates WITH the cards, and the cue belongs to no scene.**
   `colonyResolutionUi.payoutLiftOff` is raised by whichever scene is flying —
   the trade's covers at their separation (`TRADE_LIFTOFF_AT_F` of the lift
   leg), the build's cover-lift when its proxies take over — and the focus
   stage reads that ONE fact. The `--handing` dissolve is now a 620 ms opacity
   ramp (was 260) so it runs across the rise and turn; the RETURN keeps its
   own short transition on the base rule, because the closing beat waits
   `WORKING_AREA_BACK_MS` for it and a slow return would launch the reset
   marker into a fading track. Per-scene phase reads are gone: the build path
   never had one, which is why its stage could only let go after the fact.

Guard: `tests/e2e/console-colony-build-flight.spec.ts` (the cover separates,
both cards fly as their own objects, nothing is painted in the reveal while a
cover is airborne, no post-landing flip, the stage is still up at launch).
Diagnosis hook: `__conColonyDiag().bonusScene` (the cover-lift's phase ladder —
an `idle` scene beside a live colony reveal IS the missing-animation
signature).

## Iteration 9 — the three follow-ups (one-object, one door, the forward step)

1. **THE LIFT-CLASS IS ELEMENT-AGNOSTIC.** `con-bonus-source-lifted` was scoped
   to `.board-space-bonus--card`, so a colony BUILD slot's `.benefit-glyph__card`
   (and the Venus 8 % marker) stayed lit under its own rising cover — the card
   visibly DUPLICATED out of the slot the cube was about to take. The rule is
   now on the class itself: a cover and its source are one object, whatever
   that source happens to be drawn as.
2. **A SECTION-SERVED PROMPT SUPPRESSES THE DESKTOP MODAL.** `colonyBonus` is
   served by the colony workspace after a mandatory ANNOUNCE, so there is a
   deliberate window where none of its DOM is mounted. The suppression
   predicate read only the host/composite classifications, so that window
   looked unserved and the legacy `MandatoryInputModal` rose into it —
   «Заберите 1 карту с колонии Миранда» over the board, and answering it THERE
   bypassed `openColonyBonusCollect`: no entry armed, no claim, so the card
   flew to a full-bleed reveal instead of into the colony that paid it. The
   shell now asks `promptServedNatively` (host ∪ composite ∪
   `SECTION_SERVED_KINDS`), deliberately distinct from `hostServesPrompt`
   (which the outcome reconciler needs to mean «might the HOST take this»).
   `projectCard` is out of the set on purpose — its degenerate shape has no
   console screen, and the legacy modal is its honest fallback.
3. **THE PRE-TRADE ADVANCE IS A MOVE, NOT A NUMBER THAT CHANGED.** A
   trade-offset card («Торговая колония») advances the track before the reward
   is read — the server does it inside the same response, so the marker simply
   appeared further along. The glide is now TWO LEGS on ONE mechanism
   (`colonyTradeState.glideKind`): `advance` steps RIGHT from the cell the
   player pressed (captured at `armColonyTrade`) to the manifest's
   `preTradeTrackPosition`, then the chips fly; `reset` steps LEFT at the end
   as before. SEVERAL offset cards are one summed move by construction — the
   destination is the server's post-advance position, never a client sum of
   card behaviours — and the leg is bounded by its own net
   (`TRACK_ADVANCE_SAFETY_MS`), so an unmeasurable track can never hold a
   payout.
   ⚠️ **AND THE SEQUENCE IS STRICT: the cause finishes before its consequence
   starts.** Adding the leg is not enough — every consumer of «may the payout
   begin?» has to know about it, and three did not: the cover scene waited only
   on `chips`, the stage's dissolve fired on `outcomeContentIn` (true the moment
   the batch teleports into the zone — i.e. mid-glide), and the input lock did
   not cover the new phase. The reveal therefore opened, and the track's own
   interface evaporated, while the marker was still crossing it. One
   authoritative fact each: `colonyPayoutPending()` (armed | advance | chips —
   the covers wait on it) and `colonyTrackAdvancing()` (the stage refuses to
   dissolve). ⚠️ `armed` is IN the payout predicate deliberately: the batch is
   claimed on a PRE-FLUSH watcher while the reward run starts a tick later, so
   a predicate that knew only `advance`/`chips` sampled the phase before it was
   set and let the covers fly into the glide anyway.

## Iteration 11 — THE TRADER NEVER WAITS FOR SOMEBODY ELSE'S CLICK (2026-08-23)

The reported hang: trade on Pluto with an opponent's settlement → the screen
froze on «КОЛОНИИ › ПЛУТОН › ДОБОР КАРТ» over an empty stage for up to the 60 s
ceiling, the opponent got their prompt ~20 s late, and on Titan the trader's
pre-collected floater targets were re-asked in a standalone band afterwards.
One server-side root: `GiveColonyBonus` resolved EVERY recipient inside the
trader's deferred chain, in cube-placement order — an opponent placed first
froze the queue before the trader's own bonus had even drawn, ahead of the
trader's income prompt (prio 20) and the reset (22); the batch route drops its
remaining steps at a foreign `waitingFor` (`PlayerInputBatch.ts` breaks on
`getWaitingFor() === undefined`); and a paused queue emitted NO realtime
invalidation (the only broadcast sites live in `Player.takeAction`, which a
pause never reaches). Five fixes, one architecture:

1. **DETACHED DELIVERY (server)** — `Colony.isDetachedBonusDelivery`: every
   interactive colony bonus owed to a non-trader queues at `BACK_OF_THE_LINE`
   on its own recipient, AFTER the trade finalizer (generalizes Miranda's
   collect pattern to Pluto's draw+discard pair and the whole `action`-tail —
   Titan/Enceladus `AddResourcesToCard`, keep-one picks, COPY_TRADE, ocean,
   steal, opponent-discard). The trader's own chain — income, own cubes
   (per-cube pairing intact via the SUPERPOWER discard), reset — runs
   contiguously in their own request chain, so the batch consumes every
   pre-collected step and the committed reset rides the trader's own
   response. Tabletop-faithful (active player first). Guard:
   `tests/colonies/colonyTradeDetachedDelivery.spec.ts`.
2. **THE QUEUE PAUSE BROADCASTS (server)** — `DeferredActionsQueue.run` and
   `GiveColonyBonus`'s inline prompt emit `game.notifyStateChange()` when they
   pause the drain on a prompt: the recipient's client wakes over WS instantly
   ('GO'), observers refresh ('REFRESH' off the already-bumped gameAge), chips
   light immediately. Guard: `tests/realtime/QueuePauseBroadcast.spec.ts`.
3. **THE PARKED NET (client)** — `syncParkedEvidence` in
   `consoleColonyTrade.ts`: a committed view proving «viewer owes nothing ∧
   another player holds the pending input ∧ only the reset gate is closed»
   concludes the transaction to committed truth after `TRADE_PARKED_NET_MS`
   (2.5 s) — the workspace releases and the waiting player's chip tells the
   story. Post-rework this should never fire for colony flows; it exists for
   an off-turn reaction wedged mid-trade and for older servers. The blind
   60 s ceiling stays as the last backstop.
4. **ONE CONTINUOUS DEAL (visual)** — the bonus cover is the deal's LAST
   card: `TRADE_WAVE_GAP_MS` is now the small breath ON TOP of the cadence
   (fan overlapping the income flight), the stage dissolve keys to the LAST
   wave's separation (`liftAnchor`), `--bonus-held` holds the zone's frame,
   caption and name bar until the handoff, the outcome entrance is
   opacity-only, the embedded fit defers its re-solve under airborne covers,
   and the zone slot speaks the stage row's own focus grammar (the flatten
   tie against `console_colony_trade.less` is broken by a more specific
   held row).
5. **THE `pick` CLAIM (client)** — `colonyTradeClaimKinds` /
   `colonyBuildAsksCardTarget`: a colony whose reward can land ON a card
   claims `['draw'?, 'pick'?]` structurally at every confirm site, so a late
   card-target prompt (a pruned capture) teleports into the colony stage's
   own zone instead of rising as a standalone `ConsoleTaskHost` band.
5b. **THE OUT-OF-TRADE OWNER BONUS RENDERS IN ITS ZONE TOO** (the field
   report: the card standing BESIDE the «БОНУС КОЛОНИИ» zone while the zone
   showed a taken-✓ socket over a card nobody had taken). ProductiveOutpost /
   Yvonne pay Pluto's «draw 1, then discard 1» outside any trade window, so
   the draw carries no trade tag and the batch arrives with
   `tradeSegments: undefined` — the wave split then classified the card as
   ordinary income, the active zone had no entry, and the template's `v-else`
   fell through to the taken-socket branch. Two fixes, both general:
   `segmentlessZoneBatch` (pure, `colonyBonusDiscardStep.ts` — the discard
   MARKER + the batch's own colony source + exactly one card is the
   structural proof the batch belongs to the zone; a merged trade batch keeps
   its segment-driven split), and an explicit ACTIVE-without-entry template
   branch that renders the empty socket WITHOUT the ✓ — an active zone may
   never claim «this colony has paid». Wire guard:
   `colonyTradeDetachedDelivery.spec.ts` § the OUT-OF-TRADE owner bonus.
6. **THE MARKER IS THE FINAL BEAT** (official rules: «после полного
   разрешения наград белый маркер торговли опускается на самую нижнюю
   свободную позицию трека») — enforced twice over:
   · **`maybeAdvance` waits out the DISPOSAL** — a colony-bonus discard whose
     card is still physically leaving the hand (`cardDiscardColonyBonus()`)
     is part of the rewards' resolution, so the committed reset alone may
     not start the marker; the falling-edge module watcher re-asks when the
     disposal lands. Before this the glide launched into the tray-seating
     and the restored stage's own entrance at once.
   · **the glide waits for a STANDING track** — `runTrackGlide` no longer
     measures once and hopes: `waitForStandingTrack` polls the WHOLE path
     (origin included) until every cell exists, is honestly VISIBLE
     (`checkVisibility` with opacity — a rect inside the `--handing`
     working area at opacity 0, or a yielded browse tile, is exactly the
     «маркер бежит по пустоте» bug) and holds a stable rect two consecutive
     frames — bounded by `TRACK_STANDING_WAIT_MS` (2 s), after which the
     values release with the instant commit and nothing flies. Reduced
     motion takes one honest look. The wait also absorbs the restored
     focus stage's entrance: the marker starts only over a track that has
     finished materializing, as the workspace's last animated word before
     `finishTrade` → the resolution's falling edge → the conclusion.

## Iteration 12 — THE COMMITTED STAGE IS A RECEIPT, AND ITS BEATS TAKE TURNS (2026-09-01)

Four reports, one shape: everything between «A Подтвердить» and the workspace
leaving was written as *state that happens to be true*, not as an ORDER. Each
fix below states an order and lets the surfaces obey it.

### 1 · The configuration RE-DERIVED past its own commit

`heldView` pinned `{mode, available, payment}` and let everything else read the
LIVE props, on the assumption stated beside the held payment row: «past the
commit the server takes the options away». That is true of the «Колонии» door
and **false of every other one**. A CARD-ACTION trade («Летающая платформа» →
Ио) is answered while the player still owns the action, so the very next
response offers the NEXT trade: a fresh `OrOptions` (with the spent card now
carrying «уже использовано в этом поколении»), a fresh preview, a fresh step
list. Three live payment rows and a new «ИТОГ ТОРГОВЛИ» then stood over a marker
still gliding home.

The boundary now pins the SERVER'S OWN INPUTS too — `options`,
`disabledOptions`, `preview`, `tradeOffset` — and every derivation of the
working area reads the pinned trio (`presentedOptions` / `presentedDisabled` /
`presentedPreview` / `presentedOffset`). Past the boundary the stage describes
exactly one trade: the one that was made on it. Three consequences fall out of
one flag (`configPinned`): the payment LIST goes empty (the single locked
receipt row is the whole zone), `focusables` goes empty (a receipt has no cursor
stops), and `canConfirm` is false (the bar advertised «Подтвердить» over a
resolving trade, for a press `handleIntent` absorbs anyway).

⚠️ **WHOEVER NOTICES THE BOUNDARY FIRST TAKES THE SNAPSHOT.** The ordinary pin
runs at the shell's accept, through an OPTIONAL-CHAINED ref
(`coloniesSection.$refs.focusStage?.holdPresentation()`), so a frame in which
that ref is not resolved yet silently pins NOTHING — and the working area then
re-derives from the live props for the whole resolution, i.e. exactly the defect
the pin exists for (measured: 62 of 273 post-commit samples showing a three-row
payment menu, ~1 run in 4). `pinConfig()` is therefore called from the stage's
OWN commit latch too, which is the same fact from a side that cannot be missed.
Deliberately only the CONFIG half — `presentedTargets` is a decision-time
snapshot and re-taking it there would read the server's answer instead.

…and the pinned config OUTLIVES `heldView`: the crumb and the mode should
re-derive when the resolution ends, but the working area may not — the stage is
still mounted for the conclusion's own beat, and re-deriving there is the same
re-lit menu one frame later (`pinnedConfig`, cleared only by a new colony or a
fresh mount).

### 2 · The hand-back was a CROSS-FADE, so the glide launched inside it

`cardlandReleased` flipped `--carding` off and `--leaving` on in the SAME flush:
the card's 280 ms fade-out and the working area's 280 ms fade-in ran over each
other, `stageBusy` fell on that same frame, and `WORKING_AREA_BACK_MS` later the
marker set off — «карта продолжает висеть посреди экрана в момент анимации
трека». The departure is now a BEAT of its own: `cardlandReleased` starts the
leave pose (`translateY` + `scale`, `CARDLAND_LEAVE_MS`), the leave's end
UNMOUNTS the card, and only that drops `--carding` (the room is empty when the
interface returns) and `stageBusy` (the marker may finally move). `cardlandHolds`
is therefore `cardlandVisible` — the hold ends when the card is GONE, not when it
begins to go. ⚠️ `clearCardlandDwell` deliberately does NOT clear the leave
timer: several paths clear the dwell and re-arm it without touching
`cardlandReleased`, and killing a departure there strands the card with no edge
left to restart it.

### 3 · The destination row was never SOLVED before the covers aimed at it

`fitEmbeddedStrip` defers a re-solve while covers fly — «a landing target must
not move under a flying cover». Its premise was «the mount-time fit is
untouched, the scene only launches after it», and that is false for the path
that matters: the trade claims its batch on a PRE-FLUSH watcher, so `cardScene`
is already `'fly'` when the overlay MOUNTS and the FIRST fit was deferred too.
The strip rendered at the coarse count-ladder fallback, the covers aimed at
THOSE rects, and the real solve landed at the handoff — every card resized under
the cards that had just come down on it. The guard now holds a SOLVED row still
(`fitSolvedKey === revealKey`) and never withholds a row's first solve.

…and the aim itself was taken slot by slot: `Promise.all(keys.map(stableRect))`
resolves each slot as soon as ITS OWN rect holds for two frames, so slot 1 could
be measured before the fit had solved and slot 4 after — one flight aimed at two
layouts. `waitForStandingSlots` measures the row as ONE object (every slot
present, non-degenerate, and the same SET of rects across two consecutive
frames), bounded by its own net.

### 4 · One resolution, several cycles — and one shared scene context

`ConsoleColonyTradeLayer`'s module `ctx` was only ever cleared on TEARDOWN, so a
Pluto payout's second colony inherited the first cycle's live timelines and
pending timers: a stale `setColonyTradeBeat('bonus')`, a stale `ascend` cue, a
stale cell pulse firing inside the next cycle. Each cycle now starts from a
clean context — **but the MARKER keeps its own** (`glideHandles` /
`glideTimers`): the pre-trade ADVANCE leg is exactly the beat the covers wait
out, and one shared list would let the cycle reset kill the glide whose
`onLanded` releases the payout.

### 5 · The two Pluto cycles were separated by a RACE (server)

«Draw 1, then discard 1» is paid per cube, and by the rules the next colony's
card is not revealed until this one is finished. Nothing enforced that: the
same-trade reveal MERGE (one trade = one batch) reached across the mandatory
discard, and the only thing separating the cycles was the client's
fire-and-forget acknowledgement winning a race with its own discard submit. When
it lost, colony 2's card was appended to a batch the client had already
dismissed (drawn and never shown) — or, worse, to one whose arrival cinematic
was still airborne, so the row re-flowed under the flying covers.

`CardDrawReveal.sealed` makes the boundary structural: a payout that owes a
MANDATORY answer calls `player.sealCardDrawReveal()` beside its own
`DiscardCards` defer, and `enqueueCardDrawReveal` never merges into a sealed
batch. Miranda's two plain draws still merge (nothing is owed between them). The
client keeps the other half of the law as a net: `reconcileDrawnCards`
UN-DISMISSES a batch that GREW, because `dismissed` is a client latch and a
batch that gained a card while wearing it is a card drawn and never shown.

### 6 · Four unbounded holds, and the one still open

Chasing the second cycle of a two-settlement Pluto payout turned up a state the
player cannot leave: the workspace standing, the room prepared and PUBLISHED,
and no reveal anywhere —

```
roots ["con-colonies"] · browseYielded true · embedZone true
slots ["colonies-reveal"] · crumb «КОЛОНИИ › ПЛУТОН › БОНУС ВЛАДЕЛЬЦА»
```

— with a mandatory discard owed for the second colony. Four candidate holders
were found, and every one of them was a client-written wait with no bound. All
four are now bounded, and each was a genuine defect on its own:

1. **`colonyResolutionUi.discardStage`** was cleared by exactly ONE call site
   (`handOffHandForDiscard` → `restoreColonyFocusAfterDiscard`), and that site
   returns early when the section has already been projected away from the hand.
   The flag then survived the whole resolution: browse yielded, outcome slot
   deliberately empty, focus never re-opened. Released from a DERIVED fact
   instead (`ConsoleShell.colonyDiscardStageStranded`: the hand step is gone, the
   server is not asking, no card is leaving, no return is in flight).
2. **The resolution's falling edge could fire in the GAP between two cycles** —
   one flush in which every authoritative term is false. It cleared the entry
   and released the claim, and the next batch then met a viewer who «had not
   walked in», so `remoteColonyBonusPendingFor` parked it behind an announce
   that only renders on the board home. Bridged by the server's own ordinal
   (`colonyBonusSequence` — `index < total` means another cycle is owed),
   bounded exactly as the entry is.
3. **The scene-exit barrier** (`revealHeldForWorkspace`) was «completion signals
   only — never a timeout» over `cardStageExitBusy`, every term of which is a
   client motion flag. A missed completion withheld the next batch for the rest
   of the session. Now bounded per batch (`REVEAL_EXIT_BARRIER_NET_MS`), with
   the completion signals still the primary release.
4. **rAF-driven measurement probes starve on a quiet compositor** — and a quiet
   screen is exactly what these probes wait in. The deck-draw scene arms,
   `deckDrawHolds()` withholds the reveal, the scene probes the deck's rect, and
   the frame never comes: the surface stays unmounted until the 30 s whole-scene
   abort. Every measurement loop now ticks through **`probeTick`** (rAF with a
   50 ms timer fallback — the alignment when the compositor runs, no liveness
   dependency when it does not), and the withholding window has its own short
   net (`DEAL_START_SAFETY_MS`), because the whole-scene safety is the wrong
   bound for something that hides a mandatory surface.

⚠️ **The state above still reproduces at ~25–30 %** and none of the four is its
cause. It is recorded as `test.fixme('the second cycle always presents inside
the workspace')` in `console-pluto-two-colony-sequence.spec.ts`, with the full
evidence and the next step: instrument the shell's `consoleRevealMode` decision
directly — every DOM-visible term has been eliminated, so the answer is in which
of `revealHeldForWorkspace` / `rawDrawnRevealPending` / `currentRevealEvent()`
answers wrongly. The spec's own subject (each card arrives exactly ONCE) holds in
every run and is asserted.

**Guards.** `ColonyTradeManifest.spec.ts` § two Pluto cubes (never
acknowledges — the seal is what must hold) · `drawnCardsTakeLifecycle.spec.ts` §
a batch that GREW comes back · e2e `console-colony-trade-receipt.spec.ts` (both
doors: the post-commit window sampled continuously — no re-lit list, no refused
path, the receipt row present, the glide never over a standing card) · e2e
`console-pluto-two-colony-sequence.spec.ts` (each card arrives exactly once
across the whole two-cycle resolution; the probe's own liveness is asserted).

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
| `tradeActive` | the viewer's own trade transaction is running | `colonyTradeState.active` — concludes on the COMMITTED track reset, which the server sequences AFTER the trader's OWN colony bonuses and BEFORE every foreign one (detached deliveries at `BACK_OF_THE_LINE` — see Iteration 11), so it always arrives inside the trader's own response chain; a view that still proves the queue parked on ANOTHER player concludes it on the bounded `TRADE_PARKED_NET_MS` net |
| `discardMeta` | a mandatory colony-bonus discard is the pending input | `waitingFor.discardPrompt.colonyBonus` (`{colonyName, index, total}`) |
| `discardFlightMeta` | the chosen card is physically leaving the hand | the running `cardDiscard` scene's own armed marker (`cardDiscardColonyBonus()`) |
| `collectMeta` | a colony-bonus DELIVERY is owed (Miranda) | `waitingFor.colonyBonusPrompt` |
| `cardPickColony` | a colony bonus must be PLACED («куда положить ресурс») | `waitingFor.choiceContext.source` = `{kind:'colony', name}` on a `SelectCard` with no `discardPrompt` |
| `discardFlightMeta` | the chosen card is physically leaving the hand | the running `cardDiscard` scene's own armed marker (`cardDiscardColonyBonus()`) |
| `entryAwaiting` | the viewer entered a REMOTE owner-bonus resolution and NOTHING has arrived yet | `colonyBonusEntry.awaiting` — **bounded**, see below |
| a colony-sourced reveal | a payout batch is on the table / parked | `currentRevealEvent().source` (`{type:'colony', colonyName, trade?}`) |

⚠️ **THE ENTRY IS THE ONLY TERM THE CLIENT WRITES, SO IT IS THE ONLY ONE THAT
COULD LATCH — AND IT DID.** `clearColonyBonusEntry()` runs on exactly one edge:
the FALLING edge of `colonyResolutionLive`. While the armed entry was itself a
term of that predicate, the edge was unreachable by construction — the flag kept
the resolution true and the resolution kept the flag. Everything downstream then
never happened for the rest of the session: the claim was never released, the
workspace never concluded (the board offered «Вернуться к решению», A returned to
a colony screen with nothing to do, B left an empty frame), the «СБРОШЕНО»
receipt kept counting across resolutions, and the stage kept naming a trader from
a payout two generations old — over the viewer's OWN trade.

The fix splits the gate in two. `colonyResolutionEvidenceFor` is the
AUTHORITATIVE half (everything above except the entry); the entry contributes
only `awaiting`, which is:

- **armed** with the entry (`armColonyBonusEntry`),
- **ended** the moment evidence exists — read straight at the entry site (the
  marker that opened the door is pending from the same tick) and by the shell's
  `colonyResolutionEvidence` watcher for every later rise,
- **ended anyway** on a bounded named net (`COLONY_BONUS_ENTRY_WAIT_MS`, 8 s) for
  the one case with no signal at all (an answer that produced nothing — an empty
  deck, a bonus the server resolved silently).

After that the entry is what it always was in substance: CONTEXT (which colony,
whose trade) carried to the end of the resolution and cleared with it. A bounded
wait ends; a latch does not, and that is the whole difference.

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

### …and it opens the BONUS COMPOSITION, not the trading screen

`intent: 'bonus'` (`ColonyFocusIntent`) is a fifth composition of the one stage,
and it exists because the other four all describe an ACTION THE PLAYER IS
TAKING. Being paid by somebody else's trade is not one: there is nothing to
configure, nothing to weigh and nothing to confirm — one thing is owed and the
player has to answer it. So the stage drops its entire working half:

- **no trade track, no guard rail, no berths, no configuration** (`__main` is
  not rendered — `v-if="!bonusMode"`),
- **no reward package** (`__result` likewise: it answers «what happens if I
  confirm now?», a question nobody posed),
- **no availability verdict** — a red «✕ Здесь стоит ваш флот» over a reward the
  colony owes you is the screen refusing something nobody asked for,
- the hero column carries the COLONY BONUS description (not the trade line the
  player is not performing) plus «ВАШИ КОЛОНИИ ЗДЕСЬ ×N» when more than one
  settlement is paying,
- the source context LEADS (`--lead`): the role («БОНУС ВЛАДЕЛЬЦА») as the
  title, «X торговал с этой колонией» as its subtitle, on their own plate. It is
  the reason the surface exists, not a footnote to a dossier.
- the payout zone therefore IS the body, so `--handing` rides `bonusMode &&
  outcomeZone` (there is no working area to hand over first).

The three shapes of an owner bonus all land here: Pluto's card + mandatory
discard, Miranda's collect, and a card TARGET pick («куда положить ресурс» —
Enceladus, Titan). The last one is a plain host task by shape, so the ANNOUNCE
press routes it (`openMandatoryAnnounce` → `enterColonyBonusStage`) and the
claim admits `pick`, which teleports `ConsoleTaskHost` into this stage's own
zone (`taskEmbedTarget` → `workspaceClaimsPick`). Detection is structural —
`choiceContext.source = {kind:'colony', name}`, the marker the server already
sets via `colonySource(...)`; the discard half of Pluto's bonus is the same
input type and is excluded by its `discardPrompt`.

⚠️ **The trader is inferred from the colony's parked `visitor`** for every door
whose marker does not name one (only the collect marker carries `trader`). That
is authoritative for a TRADE-triggered bonus — the fleet is parked there until
the generation ends — and it is why the viewer's own live transaction OUTRANKS
the entry context in `resolutionContext`: the entry is a client-armed fact about
a FOREIGN trade, and asking it first is how «Бот торговал с этой колонией» stood
over the player's own fleet during their own trade. A trader who IS the viewer
is never named either.

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
- **A SECOND-DOOR resolution restores at full depth** (`card-actions ⊃
  colonies ⊃ hand`): the Action Center re-seats its composer from the descent
  draft (`actionWorkspaceRestorePlan` — host-scoped, so this workspace never
  adopts the resolution's own `host: 'colonies'` claim), the composer
  republishes the step zone from `mounted()`, and the colonies/hand rebuild
  through the ordinary teleport chain. A wheel-open of «Действия карт» beside
  the parked resolution is a FRESH read-only browse (`openSheet` never
  restores) — the resolution's claim, yield and crumb stay gated behind
  `resolutionParked`, same as the browse visit to «Колонии». Full contract:
  `docs/COLONY_TRADE_FLOW.md` § THE SECOND DOOR.

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
   ⚠️ **…and a ZONE IS NOT A SLOT.** `wsStageLayout` solves `n` boxes of exactly
   `slotW × slotH`; a bonus zone is a slot PLUS furniture — a lateral margin
   keeping its frame off its neighbour, a caption that floats ABOVE the row, and
   a box that is simply TALLER than the slot it holds. All three are real
   layout, so all three ride into the fit MEASURED FROM THE DOM (never re-stated
   from LESS): margins come off `availW` and go into `padXPx` (the wrap cap must
   hold the line that will actually be laid out), the extra height comes off
   `availH` (a flex line is as tall as its tallest item), and the caption's
   overhang is added to `rowGapPx` so a WRAPPED zone has the clearance the
   strip's own padding only ever gave the first row.

   ⚠️ **Subtract, NEVER floor.** Writing those costs as
   `Math.max(slotW/slotH, avail − cost)` reads like a safety rail and is the
   engine's one forbidden move: a budget raised to a whole unzoomed card is by
   definition asking for a card that does not fit (`consoleWsStageLayout`:
   «ceiling only… small honest cards beat cropped ones»). It shipped for one
   run and cropped the row at 1080 — the fit solved 387 px of card into a
   293 px budget it had itself replaced with 460. Clamp only against a
   degenerate measurement (`Math.max(1, …)`).

   **Read the fit's own inputs before theorising**: the row carries them
   (`data-fit="w… h… slot…x… n… zx…/… gap… → z… r…×…"`, written by
   `fitEmbeddedStrip` on every solve). Both faults above were one glance each
   once that existed, and guesswork for an hour before.

   ⚠️⚠️ **…AND THE GAP THE ENGINE SOLVES MUST BE THE GAP THAT RENDERS.** On the
   TV profile it was not: `html.con-profile-tv .con-reveal__strip { gap: … }`
   (0,2,1) out-specified the stage row's own
   `column-gap: var(--con-ws-stage-gap)` (0,2,0) and replaced a solved 30 px gap
   with 96 px. The engine then planned a line ~200 px narrower than the browser
   laid out, `flex-wrap` broke a card onto a row the stage had no height for,
   `align-content: center` split the overflow, and a merged Pluto payout (two
   income cards + two colony zones) rendered CROPPED TOP AND BOTTOM at 4K —
   while the very same batch fitted at 1080. Measured before/after:
   `cg=96px → 29.96px`, 3 rendered lines → 1, overflow `513px → 0`. The profile
   ladder is now scoped to the standalone band (`&__strip:not(.con-ws-stage-row)`).
   **A profile that re-states a solved value silently unsolves it** — and a fit
   claim asserted at one resolution is a claim about one resolution (the first
   guard for this passed at the 720p default viewport while the screenshot said
   otherwise; `tests/e2e/console-colony-remote-bonus.spec.ts` now measures the
   row at 3840×2160 and prints the solved values beside the painted ones).
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
   before instrumenting anything new. `__conColonyDiag` also reports
   `resolutionLive` beside `resolutionEvidence` and `entry` — «live with no
   evidence, past the bounded wait» IS the latch, stated in one read.
6. **A ONE-SHOT ARMED BY A WATCHER NEEDS BOTH ITS EDGES AND ITS MOUNT.** The
   payout pose (`--handing`, which is what takes the track out from under the
   reveal) hung off a plain `outcomeHandoffDue` watcher, and there are two ways
   into a handed-over stage that never fire one: a stage that MOUNTS
   mid-resolution (the post-discard restore, a remote entry, a reload — no
   rising edge is left), and the NEXT cycle's zone re-opening while the cue is
   already true (`payoutLiftOff` is resolution-scoped — true→true fires
   nothing). Both produced the same screenshot: the reveal drawn ON TOP of a
   fully lit track and summary rail. The watcher is now `immediate` and the
   zone's own rising edge re-arms it (`armOutcomeHandoff`, one writer); the
   animation is skipped when there is no `$el` yet, which is exactly right —
   a stage that mounts already handed over has nothing to release, only a pose
   to be in.
