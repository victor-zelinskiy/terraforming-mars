import {IPlayer} from '../IPlayer';
import {SelectColony} from '../inputs/SelectColony';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {systemChoice} from '../inputs/choiceContext';

export class RemoveColonyFromGame extends DeferredAction {
  constructor(player: IPlayer) {
    super(player, Priority.DEFAULT);
  }

  public execute() {
    const game = this.player.game;
    // A game-SETUP trim (the colony count cap), not any card's doing — the
    // game-rule source is the honest dock for it.
    const removeColony = new SelectColony('Select colony tile to remove', 'Remove colony', game.colonies)
      .markChoiceContext(systemChoice('system'))
      .andThen((colony) => {
        game.colonies.splice(game.colonies.indexOf(colony), 1);
        game.discardedColonies.push(colony);
        game.log('You discarded ${0}', (b) => b.colony(colony));
        return undefined;
      });
    removeColony.showTileOnly = true;

    return removeColony;
  }
}
