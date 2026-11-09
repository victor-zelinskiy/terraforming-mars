/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE LIVENESS ARBITER — the ONE invariant every freeze of this console violates, stated once, judged once a
 * second, cured by ONE ordered ladder.
 *
 * THE INVARIANT. The player must be able to ACT: while the server asks them something (or while they press),
 * either a surface that serves the question stands and accepts input, or something is PROVABLY IN FLIGHT (a request
 * on the wire, a blocking cinematic under its own ceiling, a story the ledger still owes within its grace). A screen
 * that is neither — nothing moving, nothing accepting, the same picture for `LIVENESS_GRACE_MS`, or the player
 * pressing and NOTHING changing — is a stall whatever its cause.
 *
 * WHY ONE ARBITER. Every freeze reported from the field (2026-10: the Floodgates fold, the Parliament's parked
 * submit, R&D Funding's claimed verdict, the Venus trade's board story) had the same shape: two presentation debts
 * waiting on each other, or one debt waiting on a condition the player's own surface held — and every NET of the
 * codebase looked away by its own contract (the leak detector counts the workspace's root as served, the foreground
 * watchdog acts only on the board home, a claim's backstop is refused while it serves, the ledger's stories degrade
 * at 30 s, the owed conclusion arms only once the flow reported finished). Each net is right about its own scope and
 * blind to the cycle. This arbiter does not know the cycle either — it does not need to: it judges the PLAYER'S
 * side (can they act?) and PROGRESS (does anything change?), which every cycle fails together.
 *
 * THE CURE IS A LADDER, NEVER ONE HAMMER. Each rung is a named release the owning module REGISTERED
 * (`registerLivenessRelease`), run in the order of how much truth it restores and how little it destroys:
 * the presentation debts first (truth before story — values release, parks un-park, stories degrade NOW instead of
 * at their 30 s), then the holds and the admission claims (the foreground watchdog's own cure, scope-free), then the
 * flows' own emergency conclusions (a claim released with force, a transaction concluded to committed truth), and
 * last the stack itself (home — where the mandatory plate re-announces whatever the server still asks). One rung per
 * tick, re-judged between rungs, so the gentlest cure that works is the one that runs.
 *
 * EVERY RUNG NAMES ITSELF (`[liveness] …`, with the diagnosis: what was asked, what stood, what the last thing in
 * flight was, how long nothing changed) and the player gets ONE notice. The e2e harness turns the marker red on
 * every spec: a cure that had to run is a defect upstream of it.
 *
 * PURE CORE (`observeLiveness`) + a registry; the shell samples and executes. The beat stall guard
 * (`workspaceBeatStall.ts`) is one of the arbiter's «not accepting» witnesses, not a second net.
 */

/** Nothing in flight and nothing accepting for this long = a stall, even with no press. */
export const LIVENESS_GRACE_MS = 10_000;
/**
 * …and a STRANDED question (the leak detector found NO surface serving it — unambiguous, never a scene still playing) is
 * judged sooner: the Hi-Tech Lab field freeze of 2026-11-09 stood under the «недоступен» plate for 10 s before the first
 * rung, and the player reloaded before the ladder reached the one that cured it.
 */
export const LIVENESS_STRANDED_GRACE_MS = 4_000;
/** The player pressed this many times with NOTHING changing (and nothing in flight) = a stall sooner. */
export const LIVENESS_PRESSES_NO_EFFECT = 3;
export const LIVENESS_PRESSED_GRACE_MS = 5_000;
/** Between two rungs of the ladder: the cure gets this long to take before the next, stronger one. */
export const LIVENESS_RUNG_GAP_MS = 2_000;
/** A ledger story younger than this is «in flight» (its owner's own machinery still has the floor); older, it is a
 *  debt the arbiter may cut. Below every story's own due (30 s) by design. */
export const LIVENESS_STORY_GRACE_MS = 8_000;
/** A submit whose answer ARRIVED but whose gates still hold the funnel is «in flight» this long; past it, the
 *  transport rung lets the funnel go. A request still on the wire is never cut by the arbiter. */
export const LIVENESS_TRANSPORT_GRACE_MS = 12_000;

export type LivenessSample = {
  now: number;
  /** The server asks THIS player (a non-optional prompt stands). */
  promptLive: boolean;
  /** A surface serves the player right now AND accepts input (not a transient beat, not an absorbed pad). */
  accepting: boolean;
  /** What is provably moving — named (empty = nothing). */
  inFlight: ReadonlyArray<string>;
  /**
   * A / B presses from any device (`inputEcho.verbPresses`) — the two verbs every live surface must answer. Counted
   * toward «presses with no effect» only while the screen is NOT accepting (the absorbed pad: a beat, a stranded
   * guard, an awaiting handoff); while it accepts, only `dropped` counts.
   */
  presses: number;
  /**
   * …of those, the ones NO handler took (`inputEcho.verbDropped`) — the deaf screen that claims to accept. A press a
   * surface took and answered with nothing visible (A on a disabled tile while the player thinks) is no evidence.
   */
  dropped?: number;
  /**
   * B presses a handler TOOK (`inputEcho.backTaken`) — counted toward «presses with no effect» on an accepting screen
   * only while `backJudged`: a frame stands PAST ITS COMMIT, where B is never an honest no-op (it collapses the frame),
   * the server asks the player something and nothing is in flight. A taken B that moved nothing there is a handler
   * swallowing the verb over a wedged flow — the chairman quest's leaked beat (2026-11-07), whose screen read
   * `accepting: true` for its whole life because every press was «taken».
   */
  backTaken?: number;
  backJudged?: boolean;
  /**
   * A TRANSIENT BEAT stands on screen (`executing` / `completing` — the pad absorbed by contract). It OWES the player
   * its end whether or not the server asks them anything: the two-campaign rally of 2026-11-07 (ledger HC) stood
   * `parliament:executing` for a minute during the OTHER seat's turn — no prompt, so `unserved` never fired, and the
   * beat-stall guard is a rung of this arbiter, not a judge of its own. Such a beat with nothing in flight is judged
   * like an unserved question.
   */
  beatOwed?: boolean;
  /** The leak detector names the live question STRANDED (no surface serves it) — judged at `LIVENESS_STRANDED_GRACE_MS`. */
  stranded?: boolean;
  /** An OBSERVABLE-STATE signature: the prompt's identity, the stack, the surfaces, the bar, the focus. A press that
   *  changes nothing leaves it equal; anything the player would SEE change moves it. */
  signature: string;
};

export type LivenessState = {
  signature: string;
  /** When the signature last changed, or something was last in flight. */
  progressAt: number;
  /** Presses delivered since the last progress. */
  pressesSinceProgress: number;
  lastPresses: number;
  lastDropped: number;
  lastBackTaken: number;
  lastInFlight: ReadonlyArray<string>;
  /** The ladder: the next rung to run (0 = none run yet for this stall) and when the last one ran. */
  rung: number;
  rungAt: number;
  /** Whether the current stall was already reported (one notice per stall). */
  reported: boolean;
};

export function initialLivenessState(now = 0): LivenessState {
  return {signature: '', progressAt: now, pressesSinceProgress: 0, lastPresses: 0, lastDropped: 0, lastBackTaken: 0, lastInFlight: [], rung: 0, rungAt: 0, reported: false};
}

export type LivenessVerdict =
  | {stalled: false}
  | {
    stalled: true,
    /** Why: no surface accepting for the grace, or presses with no effect. */
    reason: 'unserved' | 'presses-no-effect',
    quietMs: number,
    presses: number,
    lastInFlight: ReadonlyArray<string>,
    /** The rung to run NOW (undefined = the last rung is still being given its gap). */
    rung: number | undefined,
    /** First report of this stall. */
    first: boolean,
  };

/**
 * ONE observation. Pure: the next state + the verdict. Progress = the signature moved, or something is in flight;
 * a stall = no progress for the grace while the player is asked (or pressing) and nothing accepts.
 */
export function observeLiveness(state: LivenessState, sample: LivenessSample): {state: LivenessState, verdict: LivenessVerdict} {
  const next: LivenessState = {...state, lastInFlight: sample.inFlight.length > 0 ? [...sample.inFlight] : state.lastInFlight};
  const dropped = sample.dropped ?? 0;
  // An ACCEPTING screen is judged by the presses nobody took; an absorbed one by every A / B (see `LivenessSample`).
  // …and, on a frame past its commit, every B a handler took (it must have collapsed something — see `backJudged`).
  const backTaken = sample.backTaken ?? 0;
  const newPresses = sample.accepting ?
    Math.max(0, dropped - state.lastDropped) + (sample.backJudged === true ? Math.max(0, backTaken - state.lastBackTaken) : 0) :
    Math.max(0, sample.presses - state.lastPresses);
  next.lastPresses = sample.presses;
  next.lastDropped = dropped;
  next.lastBackTaken = backTaken;
  const moved = sample.signature !== state.signature;
  next.signature = sample.signature;
  next.pressesSinceProgress = state.pressesSinceProgress + newPresses;
  if (moved || sample.inFlight.length > 0 || (sample.accepting && !sample.promptLive && next.pressesSinceProgress === 0)) {
    // Progress — or an idle, accepting screen with nobody asked and nobody pressing: nothing to judge.
    next.progressAt = sample.now;
    next.pressesSinceProgress = 0;
    next.rung = 0;
    next.rungAt = 0;
    next.reported = false;
    return {state: next, verdict: {stalled: false}};
  }
  const quietMs = sample.now - next.progressAt;
  const pressed = next.pressesSinceProgress >= LIVENESS_PRESSES_NO_EFFECT && quietMs >= LIVENESS_PRESSED_GRACE_MS;
  const unserved = (sample.promptLive || sample.beatOwed === true) && !sample.accepting &&
    quietMs >= (sample.stranded === true ? LIVENESS_STRANDED_GRACE_MS : LIVENESS_GRACE_MS);
  if (!pressed && !unserved) {
    return {state: next, verdict: {stalled: false}};
  }
  const first = !next.reported;
  next.reported = true;
  let rung: number | undefined;
  if (next.rung === 0 || sample.now - next.rungAt >= LIVENESS_RUNG_GAP_MS) {
    rung = next.rung;
    next.rung++;
    next.rungAt = sample.now;
  }
  return {
    state: next,
    verdict: {
      stalled: true,
      reason: pressed ? 'presses-no-effect' : 'unserved',
      quietMs,
      presses: next.pressesSinceProgress,
      lastInFlight: next.lastInFlight,
      rung,
      first,
    },
  };
}

// ── THE LADDER — releases registered by their owners, in the order they are run ───────────────────────────────

export type LivenessRung = {
  /** The rung's rank: lower runs first. 0–9 presentation debts · 10–19 holds / admission · 20–29 flows · 30+ the stack. */
  rank: number;
  /** Named — the warn speaks it. */
  name: string;
  /** Run the release. Return a short description of what it did (empty = nothing to release here). */
  release: () => string;
};

const rungs: Array<LivenessRung> = [];

/** A module registers its emergency release once (idempotent by name). Returns the unregister. */
export function registerLivenessRelease(rung: LivenessRung): () => void {
  const i = rungs.findIndex((r) => r.name === rung.name);
  if (i !== -1) {
    rungs.splice(i, 1);
  }
  rungs.push(rung);
  rungs.sort((a, b) => a.rank - b.rank);
  return () => {
    const j = rungs.indexOf(rung);
    if (j !== -1) {
      rungs.splice(j, 1);
    }
  };
}

/** The ladder as registered (rank order). */
export function livenessLadder(): ReadonlyArray<LivenessRung> {
  return rungs;
}

/**
 * Run rung `index` of the ladder (every registered release of that rank group — several modules may share a rank).
 * Returns what it did, named per release; `undefined` past the ladder's end.
 */
export function runLivenessRung(index: number): string | undefined {
  const ranks = [...new Set(rungs.map((r) => r.rank))];
  const rank = ranks[index];
  if (rank === undefined) {
    return undefined;
  }
  const did: Array<string> = [];
  for (const rung of rungs.filter((r) => r.rank === rank)) {
    try {
      const what = rung.release();
      if (what !== '') {
        did.push(`${rung.name}: ${what}`);
      }
    } catch (e) {
      did.push(`${rung.name}: threw ${String(e)}`);
    }
  }
  return did.length === 0 ? `rank ${rank}: nothing to release` : did.join(' · ');
}

// ── the shell's sampler state ───────────────────────────────────────────────

let tickState: LivenessState = initialLivenessState();

/**
 * The rungs up to `next` (exclusive) have been run in this tick — a rung that had NOTHING to release costs no gap: the
 * shell walks on to the next one in the same tick, so the first rung that acts acts at once.
 */
export function advanceLivenessRung(next: number): void {
  tickState = {...tickState, rung: Math.max(tickState.rung, next)};
}

export function tickLiveness(sample: LivenessSample): LivenessVerdict {
  const r = observeLiveness(tickState, sample);
  tickState = r.state;
  return r.verdict;
}

export function livenessStateSnapshot(): LivenessState {
  return {...tickState, lastInFlight: [...tickState.lastInFlight]};
}

export function resetLiveness(): void {
  tickState = initialLivenessState();
}

/** Tests only — take the ladder aside (a spec composes its own) and put it back: the owners register ONCE, at import,
 *  so a spec that wiped the ladder would leave every later spec of the run without the real rungs. */
export function takeLivenessLadderForTest(): Array<LivenessRung> {
  return rungs.splice(0, rungs.length);
}

export function restoreLivenessLadderForTest(saved: ReadonlyArray<LivenessRung>): void {
  rungs.splice(0, rungs.length, ...saved);
}
