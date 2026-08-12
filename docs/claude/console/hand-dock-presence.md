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
   composers, confirms, info mode…). The compact pose is the existing uniform
   pack shrink (`--hd-compact-scale/sink`, tuned per profile) — the same
   object, further away; the «КАРТЫ N/M» counter stays fully readable.
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
