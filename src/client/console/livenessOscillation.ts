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
 *     more than `OSCILLATION_MAX_STATES` different pictures — it keeps coming back to where it was — and is STILL
 *     turning (a change within the last `OSCILLATION_STILL_LOOKS` looks: a loop that stopped is over at once).
 * A cinematic passes through its states once (many pictures, none revisited); a ticking counter is a new picture a
 * second (many states); a player thinking is no flips at all. Only a loop is few states, many flips, no hand.
 *
 * A LOOK IS A SAMPLE, AND A SAMPLE HAS A PHASE (stage 1, 2026-11-17). A band that is up for a quarter of a second of
 * every second or two is seen or missed by WHEN the look falls: the same loop stood a day on a green gate and turned
 * it red the next, on the same code. So a change is counted on the picture's own EDGES too (`edges` — every mount
 * and unmount of a surface, counted as it happens: `supervisor/surfaceEdges.ts`): a look that finds the same picture
 * as the one before it, with two or more edges between them, is a ROUND TRIP — a surface left and came back, or came
 * and left — and it is a flip like any other. No phase can hide a loop, and none can invent one.
 *
 * PURE: the next state and the verdict. The supervisor names it (`[liveness] oscillating …`) and, when the loop has
 * stood as long again (`OSCILLATION_LAST_LINE_LOOKS`), asks THE LAST LINE for it directly (`sessionRebuild.ts`) —
 * never the ladder: a loop is not a wait, and rungs that change the picture only hide it from this judge for one
 * more spell (decision F14 and the lesson under it, PLAN §0 row A8).
 */

/** Looks (seconds) the spell must have stood — untouched, on one question. */
export const OSCILLATION_LOOKS = 10;
/** …in which the picture changed at least this many times… */
export const OSCILLATION_MIN_FLIPS = 6;
/** …among no more than this many different pictures. */
export const OSCILLATION_MAX_STATES = 3;
/**
 * …and it is STILL TURNING: the picture changed within the last this-many looks. A loop that has stopped is over NOW —
 * the window remembers its flips for ten looks, and a screen that settled must not be judged by what it did before
 * (the arbiter takes a loop for «not progress, not accepting»: on a settled screen that would be a stall of nothing).
 */
export const OSCILLATION_STILL_LOOKS = 3;
/**
 * A loop that stands THIS MANY looks after it was named is due for the last line (`sessionRebuild.ts`): twenty
 * untouched seconds of a picture turning between the same few states under a live question. Asked once per spell.
 */
export const OSCILLATION_LAST_LINE_LOOKS = 10;

export type OscillationSample = {
  /** The server asks THIS player (a live, non-optional question). */
  promptLive: boolean,
  /** The question's identity (`type#promptId` — never a title). */
  question: string,
  /** The observable picture (the arbiter's signature). */
  signature: string,
  /** Every press edge and direction the router has seen, of any device — a count that only grows. */
  inputs: number,
  /** Every mount and unmount of a surface of the picture so far — a count that only grows (absent = not counted). */
  edges?: number,
};

/** A look that found the picture it had found before, with at least this many edges in between, saw a round trip. */
export const OSCILLATION_ROUND_TRIP_EDGES = 2;

export type OscillationState = {
  question: string,
  inputs: number,
  /** The pictures of the spell, one a look, oldest first (bounded by `OSCILLATION_LOOKS`). */
  seen: ReadonlyArray<string>,
  /** …and, beside each, whether a ROUND TRIP fell between it and the look before it (same bound, same order). */
  trips?: ReadonlyArray<boolean>,
  /** The edge count at the last look. */
  edges?: number,
  /** The spell was already named (one line per spell). */
  told: boolean,
  /** Consecutive looks at which the spell was judged a loop (0 = it is not one now). */
  standing: number,
};

export const OSCILLATION_REST: OscillationState = {question: '', inputs: -1, seen: [], told: false, standing: 0};

export type OscillationVerdict =
  | {oscillating: false}
  | {
    oscillating: true,
    /** First look at which this spell is judged a loop — the line is said once. */
    first: boolean,
    flips: number,
    /** The few pictures it turns between, in the order first seen. */
    states: ReadonlyArray<string>,
    /** How many of the flips were ROUND TRIPS — a change no look saw (the picture was the same at both ends). */
    roundTrips: number,
    looks: number,
    /** Consecutive looks the loop has stood since it was named (1 at the naming). */
    standing: number,
    /** The loop has stood `OSCILLATION_LAST_LINE_LOOKS` looks past its naming — said at exactly that look. */
    due: boolean,
  };

/**
 * The fields of the arbiter's signature AFTER the question, in its own order (`supervisorController.checkLiveness`).
 * Read from the END of the signature: the question's identity key may itself hold the separator.
 */
const SIGNATURE_TAIL = ['frames', 'section', 'surfaces', 'bar', 'focus', 'request'] as const;

/**
 * WHAT TURNS — the fields of the picture that differ between the loop's states, each with its values: a loop named
 * only as «2 states» sends its reader to reproduce it; named as «bar: «A Open» ⇄ «Waiting»» it names its cause. PURE.
 */
export function oscillationTurns(states: ReadonlyArray<string>): string {
  const rows = states.map((state) => {
    const parts = state.split('|');
    const tail = parts.slice(-SIGNATURE_TAIL.length);
    return [parts.slice(0, Math.max(0, parts.length - SIGNATURE_TAIL.length)).join('|'), ...tail];
  });
  const names = ['question', ...SIGNATURE_TAIL];
  const turning: Array<string> = [];
  names.forEach((name, i) => {
    const values = [...new Set(rows.map((row) => row[i] ?? ''))];
    if (values.length > 1) {
      turning.push(`${name}: ${values.map((value) => `«${value.slice(0, 60)}»`).join(' ⇄ ')}`);
    }
  });
  return turning.length === 0 ? 'nothing the signature names' : turning.join(' · ');
}

export function observeOscillation(state: OscillationState, sample: OscillationSample): {state: OscillationState, verdict: OscillationVerdict} {
  // Not asked, another question, or the player's own hand: the spell starts over from this look.
  if (!sample.promptLive) {
    return {state: OSCILLATION_REST, verdict: {oscillating: false}};
  }
  const edges = sample.edges ?? 0;
  if (sample.question !== state.question || sample.inputs !== state.inputs) {
    return {state: {question: sample.question, inputs: sample.inputs, seen: [sample.signature], trips: [false], edges, told: false, standing: 0}, verdict: {oscillating: false}};
  }
  // A ROUND TRIP: the same picture as at the look before, and the surfaces moved in between — a change no look saw.
  const before = state.seen[state.seen.length - 1];
  const trip = sample.signature === before && edges - (state.edges ?? edges) >= OSCILLATION_ROUND_TRIP_EDGES;
  const seen = [...state.seen, sample.signature].slice(-OSCILLATION_LOOKS);
  const trips = [...(state.trips ?? state.seen.map(() => false)), trip].slice(-OSCILLATION_LOOKS);
  if (seen.length < OSCILLATION_LOOKS) {
    return {state: {...state, seen, trips, edges}, verdict: {oscillating: false}};
  }
  // A look CHANGED when its picture differs from the one before it — or when a round trip fell between them.
  const changed = seen.map((picture, i) => i > 0 && (picture !== seen[i - 1] || trips[i]));
  const flips = changed.filter(Boolean).length;
  const roundTrips = trips.filter((flag, i) => i > 0 && flag).length;
  const states = [...new Set(seen)];
  const stillTurning = changed.slice(-OSCILLATION_STILL_LOOKS).some(Boolean);
  if (flips < OSCILLATION_MIN_FLIPS || states.length > OSCILLATION_MAX_STATES || !stillTurning) {
    return {state: {...state, seen, trips, edges, told: false, standing: 0}, verdict: {oscillating: false}};
  }
  const standing = state.standing + 1;
  return {
    state: {...state, seen, trips, edges, told: true, standing},
    verdict: {oscillating: true, first: !state.told, flips, states, roundTrips, looks: seen.length, standing, due: standing === OSCILLATION_LAST_LINE_LOOKS + 1},
  };
}
