import {StandardActionCard} from '../../StandardActionCard';
import {CardName} from '../../../../common/cards/CardName';
import {CardRenderer} from '../../render/CardRenderer';
import {IPlayer} from '../../../IPlayer';
import {MAX_OXYGEN_LEVEL} from '../../../../common/constants';
import {Units} from '../../../../common/Units';
import {message} from '../../../logs/MessageBuilder';
import {createMarsSelectSpace} from '../../../boards/marsSelectSpaceHelper';
import {cancellablePlacement} from '../../../inputs/placementContext';
import {SelectOption} from '../../../inputs/SelectOption';
import {Resource} from '../../../../common/Resource';
import {TileType} from '../../../../common/TileType';
import {OptionMetadata} from '../../../../common/models/PlayerInputModel';
import * as actionPreviews from '../../actionPreviews';
import {rewardReactionForecast} from '../../../models/effectForecast';
import {divertEffects, divertedFutility} from '../../../models/divertedTerraforming';
import * as divertedGate from '../../../parliament/divertedTerraformingGate';


/**
 * THE OPTION'S READING UNDER A REPLACING LAW (RX35) — the twin of `heatConversionMetadata`: the plants as the price,
 * the greenery the player would gain STRUCK with the data it becomes, the table's answer, the «where» pre-collected.
 * `card` names the standard action structurally (the console finds the plant conversion by it, never by its title,
 * now that the option is no cell pick). Read-only.
 */
export function plantConversionMetadata(player: IPlayer): OptionMetadata {
  const diverted = divertEffects(player, [actionPreviews.stockCost(player, Resource.PLANTS, player.plantsNeededForGreenery)],
    [{kind: 'boardPlacement', placementType: 'greenery', tileType: TileType.GREENERY}]);
  const effects = actionPreviews.withImpliedRating(diverted.effects);
  const forecast = rewardReactionForecast(player, undefined, effects);
  const futile = divertedFutility(player);
  return {
    kind: 'globalParameter', icon: 'greenery', amount: 1, card: CardName.CONVERT_PLANTS, effects,
    ...(forecast !== undefined ? {forecast} : {}),
    ...(futile !== undefined ? {futile} : {}),
    ...(diverted.steps.length > 0 ? {steps: diverted.steps} : {}),
  };
}

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
    // Turmoil Redux (RX35): under a law that REPLACES the greenery the plants buy data — no cell is needed and no
    // rating is paid, so the price alone gates (decision Р5).
    if (divertedGate.divertsTerraforming(player)) {
      return true;
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
    // Turmoil Redux (RX35): no cell — the option itself is the conversion; the plants are spent, the greenery the
    // player would gain is handed to the law (one unit), and the law's ONE «where» follows at the back of the line.
    // The console's one-press verb reads the option's metadata (the struck greenery, the pre-collected pick).
    if (divertedGate.divertsTerraforming(player)) {
      const option = new SelectOption(message('Convert ${0} plants into greenery', (b) => b.number(player.plantsNeededForGreenery)), 'Convert plants')
        .andThen(() => {
          const events = player.game?.events;
          events?.beginAction(player, {kind: 'standardProject', card: this.name}, {category: 'standard-project'});
          try {
            this.actionUsed(player);
            player.plants -= player.plantsNeededForGreenery;
            player.recordGreeneryDiscount();
            divertedGate.divertTerraforming(player, {kind: 'tile', tile: 'greenery', count: 1}, {kind: 'standardProject', card: this.name});
          } finally {
            events?.endScope();
          }
          return undefined;
        });
      option.metadata = plantConversionMetadata(player);
      return option;
    }
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
