/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A SCREEN THAT MOVES AND GOES NOWHERE — the livelock the liveness arbiter could not see (FREEZE ZERO — PLAN §4).
 *
 * The arbiter's progress is «the observable picture moved» (`consoleLiveness.observeLiveness`: the signature — the
 * question, the stack, the surfaces, the bar, the focus — changed). That is the right witness for a screen that
 * STANDS. It is blind, by construction, to the other way a console stops serving: a screen that flips between the
 * same few states BY ITSELF — a modal that blinks (the presence latch of 2026-11-01: «модалка мигает»), a frame that
 * opens and folds in a loop, two reactions undoing each other every tick. Such a screen «moves» every second, so
 * the stall clock restarts every second, no rung ever runs, no last line is ever asked — and the player, whose
 * presses land in whichever half of the flip happens to stand, cannot answer the question it keeps showing and
 * taking away.
 *
 * WHAT IS JUDGED — one look a second, the supervisor's own:
 *   · the server ASKS this player (a live, non-optional question) — off turn the screen is other seats' theatre and
 *     may well repeat itself (a bot's cards rise and fall);
 *   · the question is THE SAME one for the whole spell (a new question is a new story);
 *   · the player touched NOTHING for the whole spell (`inputs` — every press edge and direction of any device: a
 *     thumb walking ← → ← → flips the focus between two states and is nobody's defect);
 *   · and the picture CHANGED at least `OSCILLATION_MIN_FLIPS` times in `OSCILLATION_LOOKS` looks while showing no
 *     more than `OSCILLATION_MAX_STATES` different pictures — it keeps coming back to where it was.
 * A cinematic passes through its states once (many pictures, none revisited); a ticking counter is a new picture a
 * second (many states); a player thinking is no flips at all. Only a loop is few states, many flips, no hand.
 *
 * PURE: the next state and the verdict. The supervisor names it (`[liveness] oscillating …`) and — once the passes
 * have shown it silent on every healthy table — hands it to the arbiter as a stall of its own.
 */

/** Looks (seconds) the spell must have stood — untouched, on one question. */
export const OSCILLATION_LOOKS = 10;
/** …in which the picture changed at least this many times… */
export const OSCILLATION_MIN_FLIPS = 6;
/** …among no more than this many different pictures. */
export const OSCILLATION_MAX_STATES = 3;

export type OscillationSample = {
  /** The server asks THIS player (a live, non-optional question). */
  promptLive: boolean,
  /** The question's identity (`type#promptId` — never a title). */
  question: string,
  /** The observable picture (the arbiter's signature). */
  signature: string,
  /** Every press edge and direction the router has seen, of any device — a count that only grows. */
  inputs: number,
};

export type OscillationState = {
  question: string,
  inputs: number,
  /** The pictures of the spell, one a look, oldest first (bounded by `OSCILLATION_LOOKS`). */
  seen: ReadonlyArray<string>,
  /** The spell was already named (one line per spell). */
  told: boolean,
};

export const OSCILLATION_REST: OscillationState = {question: '', inputs: -1, seen: [], told: false};

export type OscillationVerdict =
  | {oscillating: false}
  | {
    oscillating: true,
    /** First look at which this spell is judged a loop — the line is said once. */
    first: boolean,
    flips: number,
    /** The few pictures it turns between, in the order first seen. */
    states: ReadonlyArray<string>,
    looks: number,
  };

export function observeOscillation(state: OscillationState, sample: OscillationSample): {state: OscillationState, verdict: OscillationVerdict} {
  // Not asked, another question, or the player's own hand: the spell starts over from this look.
  if (!sample.promptLive) {
    return {state: OSCILLATION_REST, verdict: {oscillating: false}};
  }
  if (sample.question !== state.question || sample.inputs !== state.inputs) {
    return {state: {question: sample.question, inputs: sample.inputs, seen: [sample.signature], told: false}, verdict: {oscillating: false}};
  }
  const seen = [...state.seen, sample.signature].slice(-OSCILLATION_LOOKS);
  if (seen.length < OSCILLATION_LOOKS) {
    return {state: {...state, seen}, verdict: {oscillating: false}};
  }
  let flips = 0;
  for (let i = 1; i < seen.length; i++) {
    if (seen[i] !== seen[i - 1]) {
      flips++;
    }
  }
  const states = [...new Set(seen)];
  if (flips < OSCILLATION_MIN_FLIPS || states.length > OSCILLATION_MAX_STATES) {
    return {state: {...state, seen, told: false}, verdict: {oscillating: false}};
  }
  return {state: {...state, seen, told: true}, verdict: {oscillating: true, first: !state.told, flips, states, looks: seen.length}};
}
