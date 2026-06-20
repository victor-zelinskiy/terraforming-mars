/*
 * Module-level reactive state for the REMATCH flow at the end of a game.
 *
 * Lives at module scope (mirrors endgameState / journalState) so it survives
 * App.vue's `:key="playerkey"` remount on every server poll. Populated by the
 * App-level `RematchLayer`, which polls `/api/game/rematch` while the game is
 * over; READ by both that layer (the accept prompt / created celebration) and
 * the endgame results overlay (the Offer/Join control).
 *
 * The whole tally is server-authoritative — the client never derives state, it
 * only renders the latest `RematchModel` and POSTs the viewer's intent.
 */
import {reactive} from 'vue';
import {paths} from '@/common/app/paths';
import {RematchAction, RematchModel} from '@/common/models/RematchModel';
import {ParticipantId} from '@/common/Types';

type RematchStateShape = {
  // Latest per-viewer model from the server (undefined before the first poll).
  model: RematchModel | undefined;
  // A POST (offer/accept/decline/cancel) is in flight — disables the controls.
  submitting: boolean;
};

export const rematchState: RematchStateShape = reactive({
  model: undefined,
  submitting: false,
});

export async function fetchRematch(viewerId: ParticipantId): Promise<void> {
  try {
    const response = await fetch(`${paths.API_GAME_REMATCH}?id=${viewerId}`);
    if (!response.ok) {
      return;
    }
    rematchState.model = await response.json() as RematchModel;
  } catch {
    // Transient network blip / aborted — the next poll reconciles.
  }
}

export async function submitRematch(viewerId: ParticipantId, action: RematchAction): Promise<void> {
  rematchState.submitting = true;
  try {
    const response = await fetch(`${paths.API_GAME_REMATCH}?id=${viewerId}&action=${action}`, {method: 'POST'});
    if (response.ok) {
      rematchState.model = await response.json() as RematchModel;
    }
  } catch {
    // Ignore — the poll loop will pick up the authoritative state.
  } finally {
    rematchState.submitting = false;
  }
}

export function resetRematchState(): void {
  rematchState.model = undefined;
  rematchState.submitting = false;
}

/** Builds the join URL (`player?id=…` / `spectator?id=…`) for the new game. */
export function rematchJoinHref(model: RematchModel | undefined): string | undefined {
  if (model === undefined || model.joinKind === undefined || model.joinId === undefined) {
    return undefined;
  }
  return `${model.joinKind}?id=${model.joinId}`;
}
