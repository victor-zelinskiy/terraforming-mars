/*
 * QUICK-WHEEL HANDOFF MODEL — the PURE declarative half of the wheel's
 * commit → destination continuity (no Vue / DOM / GSAP; unit-tested).
 *
 * The wheel's transition grammar is PRESS → MECHANICAL COMMIT → DEPTH
 * COLLAPSE → CONTEXT REVEAL: the chosen tile physically seats the command,
 * the wheel recedes a layer back, and the destination forms IN PARALLEL
 * over the same dimmed world. Nothing travels across the screen — the
 * continuity is carried by depth, dimming and rhythm, plus two small
 * declarative touches per entry:
 *
 *   echo    the destination's own header emblem (`data-wheel-anchor`)
 *           MATERIALIZES a beat into the reveal — the same symbol the
 *           player just pressed, surfacing in its new home. A local
 *           crossfade, never a flight.
 *   pulse   for direct actions that open NOTHING (heat), the real UI
 *           element about to change answers the commit with a short
 *           physical acknowledgement — the attention lands where the
 *           result will appear. Server-driven value animations (flips,
 *           delta chips, the temperature scale) then carry the actual
 *           change; the pulse never fakes or pre-times them.
 *
 * A new wheel entry gets its continuity by adding a row here — never by
 * threading bespoke animation calls through the shell. Entries absent from
 * the table simply commit and collapse (skip turn / plant conversion — the
 * placement mode itself is the reveal).
 */

export type WheelHandoffSpec = {
  /** `data-wheel-anchor` id of the destination's header emblem to echo. */
  echo?: string,
  /** `data-wheel-anchor` ids of live HUD elements that acknowledge the
   *  commit (in order, a small stagger between them). */
  pulse?: ReadonlyArray<string>,
};

export const WHEEL_HANDOFFS: Readonly<Record<string, WheelHandoffSpec>> = {
  trading: {echo: 'trading'},
  cardActions: {echo: 'card-actions'},
  standardProjects: {echo: 'std-projects'},
  hydro: {echo: 'hydro'},
  // Pass (and max-temp heat) land in the shared confirm card — its emblem
  // echoes the tile's symbol as the card forms.
  pass: {echo: 'confirm'},
  // Heat: the reservoir about to be spent acknowledges the commit; the
  // temperature scale answers only when the SERVER result lands (the
  // existing flip/delta/marker animations own that beat).
  convertHeat: {pulse: ['res-heat']},
  // Cards: the hand dock IS the continuity (it is already raised under the
  // wheel and the existing reveal flies the fan out of it) — a pulse on the
  // plate marks the handover without competing with the dock's own motion.
  cards: {pulse: ['hand-dock']},
  // skipTurn / convertPlants / voting: no echo, no pulse — the turn status
  // flip / the placement mode itself is the honest reveal.
};

export function wheelHandoffSpecFor(entryId: string): WheelHandoffSpec | undefined {
  return WHEEL_HANDOFFS[entryId];
}

/** The confirm-card retarget (pass always; heat at max temperature). */
export const CONFIRM_HANDOFF: WheelHandoffSpec = {echo: 'confirm'};
