/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE TERMINAL STANDARD-PROJECT COMMIT — the short premium beat between the
 * A-press and the workspace leaving.
 *
 * A terminal project (Asteroid / Power Plant / Air Scrapping / …) has no
 * follow-up to descend into: the press IS the move. Before this module the
 * whole thing was one reactive frame — the rail's colour flipped from green to
 * gold on whatever render the answer happened to land in, the delta chips
 * appeared underneath it, and the workspace folded on a timer. Every part was
 * there; nothing CONNECTED them, so the press had no physical answer and the
 * gold read as a CSS class change rather than as the move being fixed.
 *
 * So the beat is a PHRASE, and its phases are named:
 *
 *   press      — the very press frame: the row compresses, the ring answers,
 *                input is already sealed (the frame's own `executing` phase).
 *                It plays whether or not the server has answered yet.
 *   committing — the answer arrived and was VERIFIED: the gold sweep runs the
 *                rail from the pressed row's own anchor.
 *   committed  — the sweep peaked: the world's change is released to the HUD
 *                (delta chips + counters land HERE, never before the player
 *                has seen the commit fix), and the gold holds just long enough
 *                to be read.
 *   idle       — the flow's own conclusion took over (or a refusal rolled the
 *                press back with no gold and no chips).
 *
 * WHY THE HUD IS HELD. The response carries the new numbers, so applying it on
 * arrival paints the final value BEFORE the commit has read as committed — the
 * result would arrive ahead of its own cause. `WaitingFor` therefore holds the
 * commit (`holdingForStdProject`) until `runStdProjectCommit()` resolves at the
 * gold's peak, exactly as the patent sale holds its payout until the chip
 * lands. A fast server cannot cut the beat; a slow one cannot stall it (the
 * press already answered, and a safety releases the hold).
 *
 * TIMING BUDGET: the phrase is deliberately no longer than the flat 950 ms it
 * replaces — press and sweep OVERLAP, the chips ride the sweep's peak, and the
 * hold that follows is the read, not a pause.
 */
import {reactive} from 'vue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

export type StdProjectCommitPhase = 'idle' | 'press' | 'committing' | 'committed';

// ── timings (1080-logical ms; motionMs folds the speed preset) ──────────────

/** The row's physical press acknowledgement (tactile, never a zoom). */
export const STDP_PRESS_MS = 150;
/** The gold wave across the row — the projected → committed transformation. */
export const STDP_SWEEP_MS = 340;
/**
 * The wave's PEAK — where the world's change is released (chips + counters).
 * Deliberately near the wave's end rather than halfway: the phase change is
 * what stops the animation, so a peak that lands mid-wave CUT the gold pass
 * off in the middle and the row read as «просто поменялся цвет» again. The
 * change still overlaps the crest — it just does not truncate it.
 */
export const STDP_SWEEP_PEAK_MS = 320;
/** How long the committed gold is held AFTER the change lands — the read. */
export const STDP_HOLD_MS = 300;

/**
 * The hold's own ceiling. The gate exists to keep the HUD from running ahead
 * of the beat; if the beat dies (a torn-down surface, a backgrounded tab) the
 * numbers must still arrive — a slightly abrupt commit beats a frozen one.
 */
const HOLD_SAFETY_MS = 1600;

export const stdProjectCommitState = reactive({
  phase: 'idle' as StdProjectCommitPhase,
  /** The project being committed (a CardName; '' while idle). */
  card: '' as string,
  /**
   * Bumped when the submitted project is REFUSED. The screen watches it to
   * release its press pose — the row returns to `selected`, no gold ever
   * plays, and nothing is credited.
   */
  abortNonce: 0,
});

let holdTimer: ReturnType<typeof setTimeout> | undefined;
let holdSafetyTimer: ReturnType<typeof setTimeout> | undefined;
/** The CURRENT beat's un-resolved `runStdProjectCommit` promise. Exactly one
 *  may be pending; every exit path (peak, safety, release, abort, a NEXT beat
 *  arming) funnels through `resolvePending`, so an awaiter — the transport's
 *  `transportHolds.stdProject` gate — can never be left hanging.
 *  (The safety used to be an UNSTORED timeout observing the module handle: a
 *  second commit armed inside its 1600 ms window had its own peak timer killed
 *  by the previous beat's stale safety, and its promise then never resolved,
 *  pinning the HUD hold for the session.) */
let pendingResolve: (() => void) | undefined;

function resolvePending(): void {
  const r = pendingResolve;
  pendingResolve = undefined;
  r?.();
}

function clearHoldTimer(): void {
  if (holdTimer !== undefined) {
    clearTimeout(holdTimer);
    holdTimer = undefined;
  }
  if (holdSafetyTimer !== undefined) {
    clearTimeout(holdSafetyTimer);
    holdSafetyTimer = undefined;
  }
}

/**
 * ARM at the press, SYNCHRONOUSLY — before the submit, so the tactile answer
 * cannot be late and so a response that beats the next frame still finds the
 * phrase started.
 */
export function armStdProjectCommit(card: string): void {
  clearHoldTimer();
  resolvePending(); // defensive: a new press must never inherit a hung gate
  stdProjectCommitState.phase = 'press';
  stdProjectCommitState.card = card;
}

/** Is a terminal commit armed for this response? (`WaitingFor`'s detect.) */
export function detectStdProjectCommit(): boolean {
  return stdProjectCommitState.phase === 'press';
}

/** Is the commit's beat currently owed the screen? */
export function stdProjectCommitActive(): boolean {
  return stdProjectCommitState.phase !== 'idle';
}

/** Is the row past the boundary (gold on screen)? */
export function stdProjectCommitted(): boolean {
  return stdProjectCommitState.phase === 'committed';
}

/**
 * RUN the gold half and resolve AT ITS PEAK — the resolution is what lets the
 * held commit through, so the delta chips and counters land on the crest.
 *
 * Under reduced motion the phases still happen (the state machine is the
 * contract), they just resolve immediately: the row goes gold, the numbers
 * arrive, nothing sweeps.
 */
export function runStdProjectCommit(): Promise<void> {
  if (stdProjectCommitState.phase === 'idle') {
    return Promise.resolve();
  }
  stdProjectCommitState.phase = 'committing';
  if (consoleReducedMotionActive()) {
    stdProjectCommitState.phase = 'committed';
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    clearHoldTimer();
    resolvePending(); // a previous beat's awaiter never outlives its beat
    pendingResolve = resolve;
    const settle = () => {
      clearHoldTimer();
      // The peak: the row is now COMMITTED, and the world may show it.
      if (stdProjectCommitState.phase === 'committing') {
        stdProjectCommitState.phase = 'committed';
      }
      resolvePending();
    };
    holdTimer = setTimeout(settle, motionMs(STDP_SWEEP_PEAK_MS));
    // The safety: whichever fires first wins, and the gate can never outlive
    // the beat it protects. Both handles are STORED and die together in
    // `clearHoldTimer`, so a stale closure can never fire into a later beat.
    holdSafetyTimer = setTimeout(settle, HOLD_SAFETY_MS);
  });
}

/** The flow's conclusion took over (the workspace is leaving). */
export function releaseStdProjectCommit(): void {
  clearHoldTimer();
  resolvePending();
  stdProjectCommitState.phase = 'idle';
  stdProjectCommitState.card = '';
}

/**
 * The project was REFUSED (server error / network). The press pose unwinds,
 * the gold never plays, nothing is credited — and the screen re-enables input
 * off `abortNonce`, so the row is immediately usable again.
 */
export function abortStdProjectCommit(): void {
  if (stdProjectCommitState.phase === 'idle') {
    return;
  }
  releaseStdProjectCommit();
  stdProjectCommitState.abortNonce++;
}

/** Full reset (game switch / spec cleanup). */
export function resetStdProjectCommit(): void {
  releaseStdProjectCommit();
  stdProjectCommitState.abortNonce = 0;
}

/**
 * The WHOLE phrase's length, for the conclusion's own gate: the sweep's peak
 * (where the change lands) plus the read that follows. The workspace leaves on
 * this, never on a number typed at the call site.
 */
export function stdProjectCommitBeatMs(): number {
  return motionMs(STDP_SWEEP_PEAK_MS + STDP_HOLD_MS);
}
