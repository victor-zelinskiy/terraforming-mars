/*
 * draftWaitState — module-level reactive coordinator for the "modal
 * stays open in waiting view between draft / research rounds" UX.
 *
 * Why a module instead of a component flag:
 *   App.vue uses `<player-home :key="playerkey">` and bumps
 *   `playerkey` on EVERY server response, which Vue interprets as
 *   "destroy and recreate the whole player-home tree". That tree
 *   contains WaitingFor, MandatoryInputModal, and our card-selection
 *   content. Any state held inside the tree dies on every remount;
 *   any reactive flag we set on App's `data()` should survive — but
 *   in practice the timing of the remount + watcher firing order is
 *   brittle enough that the flag has been seen to clear before the
 *   newly-mounted modal could read it.
 *
 *   This module sits OUTSIDE the Vue component tree entirely. The
 *   `reactive()` object below is shared by importers and never
 *   recreated. Setting `pending = true` here persists across any
 *   number of player-home remounts; reading it from a computed
 *   inside WaitingFor establishes a reactive dependency that
 *   re-fires the computed whenever we toggle the flag.
 *
 * State machine:
 *
 *   pending = false   (initial / draft over / phase moved on)
 *      |
 *      | setDraftWaitPending(true) called by
 *      | CardSelectionContent.onConfirm right before
 *      | submitting the pick.
 *      v
 *   pending = true    (we're showing the waiting view)
 *      |
 *      | clearIfPhaseLeftCardPick(currentPhase) called from
 *      | WaitingFor's `phase` watcher when the server's
 *      | game.phase transitions out of RESEARCH / DRAFTING /
 *      | INITIALDRAFTING.
 *      v
 *   pending = false
 *
 * The flag is INTENTIONALLY sticky against waitingfor changes. A
 * card prompt arriving for the next round doesn't clear it — the
 * modal stays mounted and just swaps its content from
 * DraftWaitingContent to CardSelectionContent (both branches are
 * rendered through the same MandatoryInputModal mount). The
 * waiting-view -> card-grid transition happens via v-else-if in
 * WaitingFor's template; the flag only releases on the OUT
 * transition (phase moves away from card-pick).
 *
 * Safety net for never-cleared flag:
 *   `clearDraftWaitPending()` is exposed for explicit reset (used
 *   on game-end transitions, navigation, defensive cleanup).
 *   `Phase.END` always clears.
 */

import {reactive} from 'vue';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';

const CARD_PICK_PHASES: ReadonlySet<Phase> = new Set([
  Phase.RESEARCH,
  Phase.DRAFTING,
  Phase.INITIALDRAFTING,
]);

type DraftWaitState = {
  /** True while the player has submitted a pick and is waiting on
   *  the next prompt during a card-pick phase. */
  pending: boolean;
};

export const draftWaitState: DraftWaitState = reactive({
  pending: false,
});

/**
 * Called from `CardSelectionContent.onConfirm` immediately before
 * dispatching the SelectCard response to the server. Raises the
 * "modal must stay open in waiting view" signal.
 */
export function setDraftWaitPending(): void {
  draftWaitState.pending = true;
}

/**
 * Called from `WaitingFor`'s `playerView.game.phase` watcher every
 * time the server reports a phase. Clears the waiting signal IF
 * the phase has left the card-pick window (or hit END). No-op while
 * we're still in a card-pick phase, so the flag survives across
 * round boundaries within the same draft / research session.
 */
export function clearIfPhaseLeftCardPick(phase: Phase): void {
  if (!CARD_PICK_PHASES.has(phase)) {
    draftWaitState.pending = false;
  }
}

/**
 * Defensive reset. Use on game-end / navigation paths where we
 * unambiguously want the flag down regardless of phase.
 */
export function clearDraftWaitPending(): void {
  draftWaitState.pending = false;
}

/**
 * Should the App-level `playerkey++` REMOUNT of `<player-home>` be
 * SKIPPED for this transition? Returns true when:
 *   - we just submitted a card pick (`draftWaitState.pending`), and
 *   - the incoming server state keeps us inside a card-pick window
 *     (still in card-pick phase, and either no prompt yet OR the
 *     next card prompt).
 *
 * In that case the App caller does a plain reactive `playerView`
 * swap WITHOUT bumping `playerkey`. The `<player-home>` tree
 * (including WaitingFor → MandatoryInputModal → CardSelectionContent
 * / DraftWaitingContent) stays mounted, so the modal doesn't blink
 * out and back in between rounds. Vue's reactivity propagates the
 * new `playerView` to the existing tree, the modal content swaps
 * via v-if / v-else-if, and the player experiences a single
 * continuous modal across the whole draft / research session.
 *
 * Why a flag-gated check instead of just "any card-pick phase":
 *   `draftWaitState.pending` proves the previous frame was a
 *   submitted card pick. If we land in RESEARCH from a different
 *   path (e.g. game just started, or a turn-order change), we DO
 *   want the remount so the rest of player-home freshens up. The
 *   skip is ONLY for the in-flight card-pick continuation.
 */
export function shouldPreserveCardPickModal(newPlayerView: PlayerViewModel | undefined): boolean {
  if (!draftWaitState.pending) {
    return false;
  }
  if (newPlayerView === undefined) {
    return false;
  }
  if (!CARD_PICK_PHASES.has(newPlayerView.game.phase)) {
    return false;
  }
  const next = newPlayerView.waitingFor;
  return next === undefined || next.type === 'card';
}
