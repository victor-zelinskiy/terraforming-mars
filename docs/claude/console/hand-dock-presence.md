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
   FULL — whatever is open.** `dockIntakeAccent` = hand delivery active ∨ a
   hand-reveal episode running ∨ `holdSlots` ∨ delivery-held names. Two
   reasons, both load-bearing: the landing is the one moment the pack must be
   seen at size (the visual accent of receiving cards), and every one of those
   episodes MEASURES dock rects — a pose change mid-episode would move the
   targets out from under the proxies. When the episode ends, the pose eases
   back to whatever the screen calls for.
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

`tests/e2e/hand-dock-probe.spec.ts` (poses, centring, welded-under-the-wheel,
placement clearance), `tests/e2e/console-start-sponsor.spec.ts` (compact pose
inside the workspace step; no card over the status rail; dock mounted
throughout). The probe boots through the SHARED driver — never a hand-rolled
key walk (that walk livelocked the moment the wizard's input lock landed a
press differently).
