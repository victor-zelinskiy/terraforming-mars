import {StandardActionCard} from '../../StandardActionCard';
import {CardName} from '../../../../common/cards/CardName';
import {CardRenderer} from '../../render/CardRenderer';
import {IPlayer} from '../../../IPlayer';
import {MAX_OXYGEN_LEVEL} from '../../../../common/constants';
import {Units} from '../../../../common/Units';
import {message} from '../../../logs/MessageBuilder';
import {createMarsSelectSpace} from '../../../boards/marsSelectSpaceHelper';
import {cancellablePlacement} from '../../../inputs/placementContext';


export class ConvertPlants extends StandardActionCard {
  constructor() {
    super({
      name: CardName.CONVERT_PLANTS,
      metadata: {
        cardNumber: 'SA2',
        renderData: CardRenderer.builder((b) =>
          b.standardProject('Spend 8 plants to place a greenery tile and raise oxygen 1 step.', (eb) => {
            eb.plants(8).startAction.greenery();
          }),
        ),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    if (player.plants < player.plantsNeededForGreenery) {
      return false;
    }
    if (player.game.board.getAvailableSpacesForGreenery(player).length === 0) {
      return false;
    }
    if (player.game.getOxygenLevel() === MAX_OXYGEN_LEVEL) {
      // The level is maximized, and that means you don't have to try to figure out if the
      // player can afford the reds tax when increasing the oxygen level.
      return true;
    }
    return player.canAfford({
      cost: 0,
      tr: {oxygen: 1},
      reserveUnits: Units.of({plants: player.plantsNeededForGreenery}),
    });
  }

  public action(player: IPlayer) {
    return createMarsSelectSpace(
      player,
      message('Convert ${0} plants into greenery', (b) => b.number(player.plantsNeededForGreenery)),
      player.game.board.getAvailableSpacesForGreenery(player),
      // Convert plants is a pre-commit picker: plants are spent in the andThen
      // below, so the placement is genuinely cancellable before a space is chosen.
      // The source names THIS card, not just its kind: the console's board
      // panel shows «ИСТОЧНИК · Потратить растения» and L3 opens the real
      // standard-action card, exactly as a card-driven placement does. A bare
      // `{kind:'standardProject'}` left the one basic action that places a tile
      // as the only placement on the board with nothing to look at.
      {placementType: 'greenery', placementContext: cancellablePlacement({kind: 'standardProject', card: this.name})})
      .andThen((space) => {
        // Root the analytics chain at the conversion so the greenery placement,
        // oxygen rise and triggered effects group under it in the journal.
        const events = player.game?.events;
        events?.beginAction(player, {kind: 'standardProject', card: this.name}, {category: 'standard-project'});
        try {
          this.actionUsed(player);
          player.game.addGreenery(player, space);
          player.plants -= player.plantsNeededForGreenery;
          // Attribute the plants saved (8 − plantsNeededForGreenery) to the
          // greenery-discount effect (EcoLine) so the effects overlay tallies it.
          player.recordGreeneryDiscount();
        } finally {
          events?.endScope();
        }
        return undefined;
      });
  }
}
