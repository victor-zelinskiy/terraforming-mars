/*
 * EFFECT DECISION — the tiny slice of state that must OUTLIVE the screen.
 *
 * The decision modal unmounts whenever it hands off to a specialized overlay
 * (the hand grid), and re-mounts when the player comes back with B. The prompt
 * is unchanged, so from the player's point of view they never left — which
 * means the focus must be exactly where they put it, on the action card that
 * opened the overlay. A component-local `data()` cannot carry that across the
 * unmount, so it lives here.
 *
 * Deliberately minimal: no view model, no callbacks, nothing the adapter can
 * derive. Module-level reactive state per the console's state rule (it must
 * also survive the `playerkey` reset epoch).
 */

import {reactive} from 'vue';
import type {PlayerViewModel} from '@/common/models/PlayerModel';
import {gameStateVersion} from '@/client/console/gameStateVersion';

export const effectDecisionState = reactive({
  /** Index INTO the view model's `actions` the player last focused. */
  focusIdx: 0,
  /**
   * The PROMPT STAMP (`decisionPromptStamp`) at which the ALBUM a decision IS (`directPick`) was answered — a pick or
   * its decline is on the wire, and the prompt it answered still stands until the server moves past it. The album
   * must not re-open on that very prompt (it would ask a question already answered). '' = nothing in flight; a
   * refused answer clears it (`clearDecisionPickAnswered`, the transport's unwind battery).
   */
  pickAnsweredAt: '',
});

/**
 * WHICH PROMPT this view is asking — the server's own serial (`promptId`, a new one per `setWaitingFor`), never the
 * game-state version: declining Mars University's FIRST question logs nothing and finishes no action, so the version
 * does not move while the SECOND, identical question takes its place — a version latch held that one off for good.
 * The version is only the fallback of a view with no serial.
 */
export function decisionPromptStamp(view: PlayerViewModel): string {
  const serial = view.waitingFor?.promptId;
  return serial !== undefined ? `prompt:${serial}` : `version:${gameStateVersion(view)}`;
}

export function markDecisionPickAnswered(stamp: string): void {
  effectDecisionState.pickAnsweredAt = stamp;
}

export function clearDecisionPickAnswered(): void {
  effectDecisionState.pickAnsweredAt = '';
}

export function rememberDecisionFocus(index: number): void {
  effectDecisionState.focusIdx = Math.max(0, index);
}

/** A genuinely NEW decision starts at the top — never on a stale index. */
export function resetDecisionFocus(): void {
  effectDecisionState.focusIdx = 0;
}
