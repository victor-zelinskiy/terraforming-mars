# THE HAND DOCK PRESENCE CONTRACT — never hidden, always on top, compact under load

*(2026-08-06 standardization. Not auto-loaded; read when touching
`ConsoleHandDock`, the shell's dock computeds, or any surface that might be
tempted to hide the dock. Supersedes the old «pack dives under scenes by
z-index» model — this is a deliberate contract REVERSAL.)*

## The contract

1. **Once the dock appears after setup, it stays to the end of the game.** Its
   only lifecycle gates are birth (`setupHandPending` — the player has no hand
   yet) and death (`game.phase === 'end'`). No screen, sheet, panel or
   workspace may `v-show` it away — the old per-surface hide list
   (`dockParkedUnderScene` in the v-show; MA sheet, infoPanel, composers,
   confirms…) is GONE. The player learns once: the hand is always at the
   bottom centre.

   ⚠️ **BIRTH IS A PERSONAL FACT, NEVER THE TABLE'S PHASE.** `setupHandPending`'s
   third clause (`generation === 1 && phase === RESEARCH && waitingFor ===
   undefined`) reads as «no hand yet» only in a solo game. Generation-1
   RESEARCH is a TABLE state: `Game.playerIsFinishedWithResearchPhase` holds
   the phase until the LAST seat has played AND paid, so in multiplayer a
   player who is done sits in exactly that triple — with a real hand, and with
   the cards they just paid for physically flying into the dock. The bare
   triple therefore `display:none`'d the dock at the frame `runHandDelivery`
   needed it: `stableTargetRect` polled a zero-width rect for its whole ~1.8 s
   budget and the whole starting hand landed nowhere («карты некуда лететь»).
   Solo vs MarsBot never showed it — `gotoInitialResearchPhase` pre-seeds the
   bot into `researchedPlayers`, so the human's own confirm flips the phase in
   the same response and the window has zero length. The clause now also
   requires `!startCorporationPlayed(view)` (`consoleStartState.ts`): the
   viewer's PICKED corporation appearing in their own tableau is the
   server-authoritative, monotone, reload-proof «my setup is played». It is
   deliberately not `startDeploymentBegun()` — that latch is re-armed by a
   live prompt and a reload landing straight in the wait would lose it.
2. **The dock is one welded unit at the TOP of the section/band ladder.**
   Chassis plate/counter z11705, wings z11703, and now the card PACK z11704 —
   always, in every state. The pack no longer re-layers to z0 under scenes
   (and the start-scene z11490 exception is gone with it).
3. **Collisions are answered by the COMPACT pose, never by hiding or
   re-layering.** `handDockCompact` (shell): compact when Planet Focus owns
   the board OR when `!handDockInteractive` — the one predicate that already
   enumerates «something owns the screen» (sections, sheets, workspaces,
   composers, confirms, info mode…). The compact pose is a **TUCK, not a
   shrink** (pose iteration 2026-09-01, `handBodies.ts` POSE_KNOBS +
   `packProfileTuning`): the dominant carrier is the SINK — the pack settles
   into the tray until a tidy, ARC-FLATTENED crown of card tops shows over
   the plate — scale steps back only to 0.9 (the gold-edge rhythm survives
   nearly intact), and a dark veil (`.con-handbody--tucked` ::after,
   opacity-only) takes the crown's light down so it stops being a standing
   band of gold noise. The «КАРТЫ N/M» counter stays fully readable — what
   the player needs from a stepped-back hand is the COUNT.
4. **THE INTAKE ACCENT: while cards are physically arriving, the dock is
   FULL — whatever is open.** Two reasons, both load-bearing: the landing is
   the one moment the pack must be seen at size, and every such episode
   MEASURES dock rects — a pose change mid-flight would move the targets out
   from under the proxies.

   **It is a BOUNDED LEASE, never a predicate over foreign flags**
   (`consoleDockAccent.ts`): `beginDockIntakeAccent(label)` → release, plus
   `holdDockIntakeAccent(label, promise)` which releases on BOTH outcomes.
   Leases nest (an intake landing while the hand opens) and **every one of
   them expires on its own after `ACCENT_MAX_MS`**, so no director can pin the
   pose. Held by: `runHandIntake`, the hand open/close reveal episodes.

   ⚠️ THE BUG THIS REPLACES. The first cut ORed four booleans owned by four
   directors (`isHandDeliveryActive() || isHandRevealEpisodeRunning() ||
   handRevealState.holdSlots || dockHeld.length > 0`). Any one sticking pinned
   the accent ON — i.e. **silently disabled the compact pose for the rest of
   the game**, which is exactly what shipped: `openHandWithReveal` sets
   `phase='opening'` + `holdSlots=true` BEFORE it measures, and the section
   watcher deliberately skipped resetting `opening`/`closing`, so a section
   change inside that pre-install window latched `holdSlots` true forever.
   (That leak also rendered every hand slot held/invisible — the same latch
   was behind «карты в руке не отображаются».) Both halves are fixed: the
   watcher now resets on leaving the hand from ANY phase — safe, because the
   birth happens with the section set TO `'hand'`, so that branch can never
   kill it — and the accent can no longer be poisoned by a foreign flag.

   *A pose that silently stops working is worse than a pose that is briefly
   wrong.* The worst case is now «full a few seconds too long», never «compact
   is dead until restart».
5. **Full-bleed cinematics may COVER the dock; nothing may UNMOUNT it.** The
   reveal overlay (z11900), the fullscreen zoom veil (z11890) and the endgame
   legitimately paint over it — those are the moments the whole table steps
   back, and the reveal's card flights must fly above the pack they land into.
   The dock stays mounted and is back the instant they release. (The zoom's
   old `visibility: hidden` on the dock is removed — the veil dimming it IS
   the presentation.)
6. **THE INSPECTION CONTEXT (the Information Workspace, 2026-09): while Y
   inspects a seat, the dock IS that seat's hand.** One pure model decides
   the seat (`handDock/dockInspection.ts`): the viewer's own seat →
   `undefined` (the ordinary dock — real pack, real «КАРТЫ n/m», the accent
   only); another human → a read-only CLOSED FAN + the exact public
   `cardsInHandNbr`; the MarsBot → the SAME fan over its ACTION DECK
   (`actionDeckSize` — the deck it plays from and, empty, passes on; never
   a parallel counter). Mechanics, each load-bearing:
   - **The fan is NOT hand bodies.** Sleeves render inside the dock chassis
     (`.con-handdock__insp`, z11704 — behind the plate like the own pack),
     derived from ONE integer, posed with the COMPACT knobs
     (`inspectionFan` reuses `handDockPlan` + `packProfileTuning`), capped
     at `INSPECTION_FAN_MAX` while the counter stays exact. No faces, no
     names, no `data-hand-dock-card`, no flights — privacy and the
     single-owner pack contract both hold by construction.
   - **The own pack rides to the `away` pose** (`PackPose` 'away' — the
     tuck taken all the way: compactSink + the card's own height, so
     nothing peeks; same quiet sine settle family, `poseRideSpec`). Two
     crowns in one tray would be two hands claiming one object. Gated on
     the SAME predicate as the fan (`ConsoleShell.dockInspection`), so
     they can never disagree about who owns the tray.
   - **The intake accent OUTRANKS the guest** (cards physically arriving
     to the OWN hand): `dockInspection` returns `undefined` while the
     lease is live — the landing must be seen and measured; the guest fan
     returns when the lease expires.
   - **Read-only by construction**: the guest dock never emits `open`, the
     `--live`/`--hot` own-hand affordances go dark, the album spine yields
     the bay to the guest readout and returns untouched on close (the page
     lives in `consoleState.handIndex`, which inspection never writes).
   - **The accent is the shared `con-insp-<color>` root tokens** (the rail
     ring + the workspace seam + the dock's `--insp` plate response — one
     composition, one source: `infoModeState.playerColor`). The counter
     joins the LB/RB beat via `data-insp-fade` (the rail's own value dip —
     the dock is an anchor and never translates).
   Guards: `tests/console/dockInspection.spec.ts`,
   `tests/client/components/console/consoleHandDockInspection.spec.ts`,
   the away-pose block in `handBodiesPose.spec.ts`, and the dock asserts in
   `tests/e2e/console-info-workspace.spec.ts`.

## Why the reversal

The old model hid the dock on some screens (MA sheet, info panel, composers)
and z-dropped the pack under others — so the dock's whereabouts were a
per-surface accident: sometimes gone, sometimes diving, sometimes floating
over a status rail it wasn't supposed to touch (the sponsor hand step shipped
exactly that overlap — the start frame is a stacking context, so the hand's
rail at z11711 was trapped at the frame's level while the pack rode the root
ladder above it). One contract replaces all of it: visible always, top always,
compact when the screen is busy, full while receiving.

## Guards

`tests/client/components/console/consoleStartState.spec.ts` §
`startCorporationPlayed` (the personal birth fact — picked-but-unplayed vs
played, and that a foreign tableau never satisfies it),
`tests/client/components/console/consoleDockAccent.spec.ts` (the lease: nesting,
out-of-order release, idempotence, release on reject — and **a leaked lease
expiring on its own ceiling**, which is the guarantee the compact pose rests
on), `tests/e2e/hand-dock-probe.spec.ts` (poses, centring,
welded-under-the-wheel, placement clearance), `tests/e2e/console-start-sponsor.spec.ts`
(compact pose inside the workspace step; no card over the status rail; dock
mounted throughout; **and that the compact pose still works AFTER the whole
sponsor flow** — the regression that started this). The probe boots through the SHARED driver — never a hand-rolled
key walk (that walk livelocked the moment the wizard's input lock landed a
press differently).

## THE PACK'S GEOMETRY IS THE BODIES LAYER'S — the chassis carries no pose

Since the single-owner rework (hand-album rev 9–15) the dock renders CHASSIS
ONLY; every card is one persistent `.con-handbody` element on the reveal
layer, placed by the ANALYTIC pose (`handBodies.ts dockedBodyPose` =
`handDockPlan` slots × POSE_KNOBS × `packProfileTuning`). Three rules keep
that single-source honest:

- **The pack anchor is POSE-INVARIANT.** `.con-handdock__pack` is the
  measured bottom-centre axis and wears NO transform/transition — the old
  CSS pose echo (`translateY(sink) scale(...)`) moved the measured bottom
  WITH the pose, double-counting the sink against the analytic pose's own
  (benign at the historical 2px sink, a ~19px intake mis-aim at the tuck
  depth compact has now). The pose paints on the CARDS and nowhere else;
  the chassis pose classes (`--compact`/`--raised`) are witnesses + the
  plate's light response only.
- **The pose TRANSITIONS carry semantic priorities** (`poseRideSpec`, pure +
  spec'd in `handBodiesPose.spec.ts`): «→ compact» is the console's
  lowest-attention move — long (640ms), sine-in-out, no stagger, peak
  velocity ~1px/frame (the player busy with the surface that just opened
  must be able to not notice it); «→ raised» is the RT wheel's ECHO — the
  wheel pops first (120ms), the hand rises a 60ms beat later and opens
  CENTRE-OUT; returns are calm in-outs. One duration + one ease for the
  whole pack per ride (one object changing posture). Interrupted rides
  restart from the current visual position with a distance-scaled duration
  (`rideDurationForRemainder`) — a wheel flutter (RT open/close ×N) moves
  the fan a few px and softly catches, instead of full-amplitude
  oscillation. The old shared 340ms power2.out for every pair put a
  ~560px/s velocity burst on frame one of the tuck — that burst WAS the
  reported «мельтешение».
- **The root column keeps its three members.** `.con-root > [class*="--embed"]
  { position: absolute; }` — no `[data-embed-slot]` is ever a direct child of
  the root (they all live inside `.con-cardactions` / `.con-colonies` /
  `.con-hand` / `.con-hydro` / `.con-stdp` / `.con-start`), so this can only
  match the teleport-fallback state, where the surface is inside nothing and
  its in-zone geometry is simply false. Without it, one stray flow member
  squeezes `.con-main` and the footer (with the measured tray axis) rides up
  ~500px for a flush.

Материя the docked pack carries (both opacity-only, console_card_deal.less):
the per-card CONTACT SHADOW (`.con-handbody::before`, docked + non-deep
only — fades out as a flight seizes the card, back in on touchdown) and the
compact TUCK VEIL (`--tucked` ::after on the faces). Pinned by
`tests/styles/handDockAnchorContract.spec.ts` (source contract),
`tests/e2e/console-hand-dock-anchor.spec.ts` (frame-by-frame, fhd + tv4k)
and the pose witnesses in `tests/e2e/console-planet-focus.spec.ts` (painted
body width + veil, never a chassis CSS var — there is nothing left on the
chassis to witness a pose with).
