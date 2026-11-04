import {IGame} from '../IGame';

/**
 * Helper for once-per-action effects.
 *
 * This doesn't need to be serialized. It ensures this is only evaluated once per action.
 * When the server restarts, the player has to take an action anyway.
 */
export class OncePerAction {
  private lastAction: number;
  constructor() {
    this.lastAction = -1;
  }
  public oncePerAction(game: IGame, cb: () => void) {
    const actionCount = game.getActionCount();
    if (this.lastAction !== actionCount) {
      this.lastAction = actionCount;
      cb();
    }
  }
  /** READ-ONLY: has the effect already fired during the action now running? (A forecast twin asks it; it never spends.) */
  public spent(game: IGame): boolean {
    return this.lastAction === game.getActionCount();
  }
}
