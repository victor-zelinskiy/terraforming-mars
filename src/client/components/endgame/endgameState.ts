/*
 * «Has this game ended?» — the one answer the app asks of a view at its root (`App.vue`: the rematch layer's and the
 * exit button's gate).
 *
 * (This module was the desktop END-OF-GAME experience's reactive state — the winner reveal, the results overlay, its
 * pill and its tabs. They left with the desktop: the end of a game is the console's own, inside
 * `ConsoleEndgameWorkspace`.)
 */
import {ViewModel} from '@/common/models/PlayerModel';
import {Phase} from '@/common/Phase';

/** The game of this view has reached its end. */
export function endgameAvailable(view: ViewModel | undefined): boolean {
  return view !== undefined && view.game.phase === Phase.END;
}
