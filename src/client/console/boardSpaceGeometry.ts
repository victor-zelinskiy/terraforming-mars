/*
 * BOARD-SPACE GEOMETRY — the coordinate-space version of the Mars board
 * (mechanism D of docs/claude/console/presentation-reconciliation.md).
 *
 * A board-bound flight aims with a ONE-SHOT measure, and the board's
 * coordinate space legitimately moves under it: Planet Focus enters/exits
 * (scale up to ×4.8, transitions 680/760 ms), the fit engine re-calibrates
 * after a viewport/dock change. A flight that measured before such a move
 * lands hundreds of px off its cell. This module states the two facts every
 * such flight needs:
 *
 *   · `boardGeometryStable()` — may I MEASURE/LAUNCH right now? (injected by
 *     the board section from its own framing engine: no fit tween, no fit
 *     pass scheduled, focus phase parked at idle/active);
 *   · `boardSpaceEpoch()` — has the space MOVED since I measured? (bumped by
 *     the section on every stability flip — a consumer re-measures when the
 *     epoch it captured is no longer current).
 *
 * No probe registered → always stable, epoch frozen — desktop, tests and a
 * torn-down shell degrade to the historical one-shot behaviour.
 */

import {reactive} from 'vue';
import {probeTick} from '@/client/console/probeTick';

const state = reactive({epoch: 0});

let stabilityProbe: (() => boolean) | undefined;

/** The board section registers its framing verdict; returns the unregister. */
export function registerBoardGeometryProbe(probe: () => boolean): () => void {
  stabilityProbe = probe;
  return () => {
    if (stabilityProbe === probe) {
      stabilityProbe = undefined;
    }
  };
}

/** May a board-bound flight measure/launch right now? */
export function boardGeometryStable(): boolean {
  return stabilityProbe === undefined || stabilityProbe();
}

/** The current coordinate-space version. Capture at measure time; a later
 *  read that differs means the measured rect is stale. */
export function boardSpaceEpoch(): number {
  return state.epoch;
}

/** The section bumps this on every stability flip (both edges — consumers
 *  re-measure on ANY move, and the settle edge is when a re-measure is
 *  worth taking). */
export function bumpBoardSpaceEpoch(): void {
  state.epoch++;
}

/**
 * Bounded wait for stable geometry (probeTick — never bare rAF: a quiet
 * screen is exactly the state this waits in). Resolves soon when already
 * stable; never rejects.
 */
export function waitBoardGeometryStable(opts?: {maxMs?: number, alive?: () => boolean}): Promise<void> {
  const cap = opts?.maxMs ?? 4000;
  const alive = opts?.alive ?? (() => true);
  const started = Date.now();
  return new Promise((done) => {
    const poll = () => {
      if (!alive() || boardGeometryStable() || Date.now() - started >= cap) {
        done();
        return;
      }
      probeTick(poll);
    };
    poll();
  });
}

/** Full reset (tests / shell teardown). */
export function resetBoardSpaceGeometry(): void {
  stabilityProbe = undefined;
  state.epoch = 0;
}
