import {IPlayer} from '../IPlayer';
import {SelectColony} from '../inputs/SelectColony';
import {DeferredAction} from './DeferredAction';
import {Priority} from './Priority';
import {systemChoice} from '../inputs/choiceContext';
import {ColoniesHandler} from '../colonies/ColoniesHandler';

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
        // The roster's own writer: the tile returns to the reserve as it lies
        // in the box, and the change is a typed fact (the game's rule gave it).
        ColoniesHandler.retireColonyTile(game, this.player, colony, {kind: 'system'});
        game.log('You discarded ${0}', (b) => b.colony(colony));
        return undefined;
      });
    removeColony.showTileOnly = true;
    // The roster marker: every tile in play may leave (nothing stands on a tile
    // before the first action of the game).
    removeColony.rosterChange = {kind: 'remove', outgoing: game.colonies.map((colony) => ({colony: colony.name}))};

    return removeColony;
  }
}
