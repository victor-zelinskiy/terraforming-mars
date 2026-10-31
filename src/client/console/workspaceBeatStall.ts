/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE BEAT STALL GUARD — the ONE answer to «a workspace says a machine beat is in flight; is anything actually
 * moving?».
 *
 * THE BUG CLASS IT CLOSES (the owner's field freeze of 2026-10-31 — R&D Funding repeating Asteroid Deflection's
 * action). A workspace past its commit stands in a TRANSIENT beat (`executing` / `completing` —
 * `consoleWorkspaceFlow.ts`: «a transient beat, never a navigation destination») while the server's answer is
 * presented. The beat absorbs the pad by contract (B = `none`, a double submit impossible by construction), and it
 * ends only when the stage its claim waits for arrives. A claim whose stage can NEVER arrive (a deck-check claimed
 * into the draw-only pending beat) is therefore a terminal freeze: the pad absorbed, no prompt, no warning — every
 * other net looks away by design: the leak detector counts the workspace's root as a serving surface, the foreground
 * watchdog only acts on the board home, the claim's 20 s backstop is REFUSED by the release funnel while the verdict
 * it holds is unacknowledged, and the owed-conclusion net only arms once the flow REPORTED finished. Only a reload
 * got the player out.
 *
 * THE RULE (`observeBeatStall`, pure). A beat is honest only while something is IN FLIGHT behind it: the transport's
 * request, a blocking animation hold (every cinematic registers one, each with its own named ceiling), the shell's
 * awaiting handoff, an owed fold. A beat that stands `WORKSPACE_BEAT_STALL_MS` with NOTHING in flight and the same
 * server prompt the whole time is not a beat — it is a stall, whatever its cause. The rule does not need to know the
 * cause, which is the point: the next mismatch of the same shape is caught by construction instead of by a reload.
 *
 * WHAT IT DOES NOT TOUCH. Only the TRANSIENT phases count: `committed` and `verdict` are stages the player ACTS on
 * and may legitimately stand for minutes; `browse` / `configure` are reversible. A surface that is not the deepest
 * live frame (a step nested inside it, the stack parked or yielded to the board, a placement live) is not where the
 * player stands, so its beat is not judged.
 *
 * RECOVERY NAMES ITSELF (invariant 4 — no silent loss): the shell warns `[workspace-stall]` with the beat, how long it
 * stood, what the claim held and what was serving, tears the workspace down through the force path the owed
 * conclusion already uses (the claim released with force, so a held verdict falls to the standalone presenter — the
 * result is still SEEN), and tells the player in one notice. A guard that healed invisibly would hide the next bug.
 */
import type {WorkspacePhase} from '@/client/console/consoleWorkspaceFlow';

/**
 * How long a transient beat may stand with NOTHING in flight before it is a stall. Above every flow's own minimum
 * beat (the commit beat 1.4 s, the claim's beat backstop 2.6 s, the arrival backstop 5 s, the awaiting safety 6 s) so a
 * working beat that merely paused between two holds is never accused; far below «the player reaches for the reload».
 */
export const WORKSPACE_BEAT_STALL_MS = 12_000;

/** The phases that are MACHINE time — the only ones this guard judges. */
export function isTransientBeat(phase: WorkspacePhase | undefined): boolean {
  return phase === 'executing' || phase === 'completing';
}

// ── the surfaces' reports ────────────────────────────────────────────────────

/**
 * A surface whose phase is DERIVED inside the component (the card-actions workspace — its `workspacePhase` computed;
 * nothing writes it to the stack frame) reports it here. Keyed by the workspace kind the surface IS, so the shell can
 * judge it against the stack (is it the deepest live frame?). A plain Map, deliberately not reactive: the guard is a
 * 1 Hz sampler, never a cached computed — a latch here is impossible by construction (invariant 17).
 */
const surfaceBeats = new Map<string, WorkspacePhase>();

/** A surface reports its derived phase (`undefined` = it unmounted / has nothing to report). */
export function reportSurfaceBeat(kind: string, phase: WorkspacePhase | undefined): void {
  if (phase === undefined) {
    surfaceBeats.delete(kind);
  } else {
    surfaceBeats.set(kind, phase);
  }
}

/** The surfaces standing in a transient beat right now, as `[kind, phase]` pairs. */
export function transientSurfaceBeats(): Array<[string, WorkspacePhase]> {
  return [...surfaceBeats.entries()].filter(([, phase]) => isTransientBeat(phase));
}

// ── the rule ─────────────────────────────────────────────────────────────────

export type BeatStallSample = {
  now: number;
  /** The beat being judged — `<kind>:<phase>` — or undefined when no judged surface stands in a transient beat. */
  beat: string | undefined;
  /** What legitimately keeps a beat standing right now (empty = nothing in flight). Named, for the diagnosis. */
  inFlight: ReadonlyArray<string>;
  /** The server prompt's identity (`promptIdentityKey` + promptId) — an answer moving it is progress. */
  promptKey: string;
};

export type BeatStallState = {
  beat: string | undefined;
  /** When the current beat began. */
  beatSince: number;
  /** The last moment something was in flight (or the prompt moved). */
  activeAt: number;
  promptKey: string;
  /** What was in flight the last time something was — the diagnosis names it. */
  lastInFlight: ReadonlyArray<string>;
};

export function initialBeatStallState(): BeatStallState {
  return {beat: undefined, beatSince: 0, activeAt: 0, promptKey: '', lastInFlight: []};
}

export type BeatStallVerdict =
  | {stalled: false}
  | {stalled: true, beat: string, stoodMs: number, quietMs: number, lastInFlight: ReadonlyArray<string>};

/**
 * One 1 Hz observation. Pure: the next state + the verdict. A stall is reported ONCE per beat — after a verdict the
 * clock restarts, so a recovery that could not cure the state is reported again only a full window later, never
 * every tick.
 */
export function observeBeatStall(state: BeatStallState, sample: BeatStallSample): {state: BeatStallState, verdict: BeatStallVerdict} {
  if (sample.beat === undefined) {
    return {state: {...initialBeatStallState(), promptKey: sample.promptKey}, verdict: {stalled: false}};
  }
  const fresh = sample.beat !== state.beat;
  const next: BeatStallState = {
    beat: sample.beat,
    beatSince: fresh ? sample.now : state.beatSince,
    activeAt: state.activeAt,
    promptKey: sample.promptKey,
    lastInFlight: state.lastInFlight,
  };
  if (fresh || sample.inFlight.length > 0 || sample.promptKey !== state.promptKey) {
    next.activeAt = sample.now;
    if (sample.inFlight.length > 0) {
      next.lastInFlight = [...sample.inFlight];
    }
  }
  const quietMs = sample.now - Math.max(next.beatSince, next.activeAt);
  if (quietMs < WORKSPACE_BEAT_STALL_MS) {
    return {state: next, verdict: {stalled: false}};
  }
  const verdict: BeatStallVerdict = {
    stalled: true,
    beat: sample.beat,
    stoodMs: sample.now - next.beatSince,
    quietMs,
    lastInFlight: next.lastInFlight,
  };
  // Restart the window: one report per stall, never a warning per tick.
  return {state: {...next, beatSince: sample.now, activeAt: sample.now}, verdict};
}

// ── the shell's sampler ──────────────────────────────────────────────────────

let tickState: BeatStallState = initialBeatStallState();

/** The shell's 1 Hz observation — the module keeps the state between ticks. */
export function tickBeatStall(sample: BeatStallSample): BeatStallVerdict {
  const result = observeBeatStall(tickState, sample);
  tickState = result.state;
  return result.verdict;
}

/** The shell unmounted / the game switched: nothing carries over. */
export function resetBeatStall(): void {
  tickState = initialBeatStallState();
  surfaceBeats.clear();
}
