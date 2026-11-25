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
 * THE RULE. A beat is honest only while something is IN FLIGHT behind it: the transport's request, a blocking
 * animation hold (every cinematic registers one, each with its own named ceiling), the shell's awaiting handoff, an
 * owed fold. A beat that stands with NOTHING in flight is not a beat — it is a stall, whatever its cause. The rule
 * does not need to know the cause, which is the point: the next mismatch of the same shape is caught by construction
 * instead of by a reload.
 *
 * WHO JUDGES IT (since architecture v2): nobody samples it here any more. The beat is a state of the FRAME's own
 * machine with its own bound (`WORKSPACE_BEAT_STALL_MS` — `consoleWorkspaceStack.registerFrameBeatExpired`, and the
 * node `surface:<kind>` of the wait graph carries the same bound), and a beat that owes its end on a screen that
 * accepts nothing is the liveness arbiter's (`consoleLiveness` — `beatOwed`; its rung 25 tears the frame down much
 * sooner than the bound). The 1 Hz sampler that stood here (`observeBeatStall` / `tickBeatStall`) had no caller
 * left and was removed on 2026-11-23: a rule nothing runs reads as a net that stands. This module keeps the beat's
 * VOCABULARY — which phases are machine time, the bound, and the report of a surface that derives its phase itself.
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
import {reactive} from 'vue';
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
 * judge it against the stack (is it the deepest live frame?). REACTIVE (invariant 17): the samplers (the supervisor's
 * tick, a frame's look) read it, and so does a watcher — «the player has gone to do something else» asks the phase a
 * frame REALLY stands in (`surfacePhaseOf`), and a cached reader of a plain Map is a latch.
 */
const surfaceBeats = reactive(new Map<string, WorkspacePhase>());

/**
 * THE PHASE A FRAME REALLY STANDS IN: the surface's own report where its phase is derived inside it (card-actions —
 * its stack record says «browse» all flow long), else `undefined` (the record is the truth — read `frame.phase`).
 */
export function surfacePhaseOf(kind: string): WorkspacePhase | undefined {
  return surfaceBeats.get(kind);
}

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

/** The shell unmounted / the game switched: nothing carries over. */
export function resetBeatStall(): void {
  surfaceBeats.clear();
}
