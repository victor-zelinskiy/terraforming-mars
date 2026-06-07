import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {IActionCard} from '../ICard';
import {intersection} from '../../../common/utils/utils';
import {message} from '../../logs/MessageBuilder';
import {AresHandler} from '../../ares/AresHandler';
import {BoardType} from '../../boards/BoardType';
import {MarsBoard} from '../../boards/MarsBoard';
import {Space} from '../../boards/Space';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';
import * as actionReason from '../actionReasons';
export class MarsNomads extends Card implements IActionCard {
  /*
   * A good page about this card: https://boardgamegeek.com/thread/3154812.
   *
   * 1. Arcadian Communities and Land Claim block Mars Nomads.
   *  1a. Even if it's your AC.
   * 2. Mining Guild and Philares cannot take advantage of it.
   * 3. Placing next to an ocean tile gives a placement bonus.
   *
   * Ares: Adjacency bonuses are not placement bonuses.
   */
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.MARS_NOMADS,
      cost: 13,

      metadata: {
        cardNumber: 'X59',
        renderData: CardRenderer.builder((b) => {
          b.action('MOVE THE NOMADS to an adjacent, non-reserved empty area and collect THE PLACEMENT BONUS ' +
            'as if placing a special tile there. No tiles may be placed on the Nomad area.', (ab) => {
            ab.empty().startAction.nomads().asterix();
          }).br;

          b.nomads().asterix().br;
          b.plainText('PLACE THE NOMADS on a non-reserved, empty area on the game board.');
        }),
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer) {
    const spaces = player.game.board.getNonReservedLandSpaces();
    return spaces.length > 0;
  }

  public override bespokePlay(player: IPlayer) {
    return createMarsSelectSpace(
      player,
      message('Select space for ${0}', (b) => b.card(this)),
      player.game.board.getNonReservedLandSpaces(),
      {placementType: 'land'})
      .andThen((space) => {
        player.game.nomadSpace = space.id;
        return undefined;
      });
  }

  private canAffordPlacementBonus(player: IPlayer, space: Space): boolean {
    // Bonuses are not granted when moving onto a hazard tile.
    if (AresHandler.hasHazardTile(space)) {
      return true;
    }
    return MarsBoard.canAffordPlacementBonuses(player, space);
  }

  private eliglbleDestinationSpaces(player: IPlayer) {
    const game = player.game;
    const board = game.board;
    if (game.nomadSpace === undefined) {
      return [];
    }

    const availableSpaces = board.getNonReservedLandSpaces();
    const currentNomadSpace = board.getSpaceOrThrow(game.nomadSpace);
    const adjacentSpaces = board.getAdjacentSpaces(currentNomadSpace);
    return intersection(availableSpaces, adjacentSpaces)
      .filter((space) => this.canAffordPlacementBonus(player, space));
  }

  public canAct(player: IPlayer) {
    return this.eliglbleDestinationSpaces(player).length > 0;
  }

  public actionUnavailableReason() {
    return actionReason.placementReason('No valid destination space');
  }

  public action(player: IPlayer) {
    const spaces = this.eliglbleDestinationSpaces(player);
    // Custom reasoner: cells that are empty + non-reserved land + correct
    // owner but NOT adjacent to the current nomad position need a clearer
    // tooltip than the generic 'unavailable'. Generic checks (occupied,
    // reserved-noctis, owned-by-other) still fire when applicable —
    // returning undefined falls through.
    const board = player.game.board;
    const currentNomadSpace = player.game.nomadSpace !== undefined ?
      board.getSpaceOrThrow(player.game.nomadSpace) : undefined;
    const adjacentIds = currentNomadSpace !== undefined ?
      new Set(board.getAdjacentSpaces(currentNomadSpace).map((s) => s.id)) :
      new Set<string>();

    return createMarsSelectSpace(
      player,
      message('Select new space for ${0}', (b) => b.card(this)),
      spaces,
      {
        placementType: 'land',
        customReasoner: (space) => {
          // Cells with tiles / reserved / other-owned: let generic say so.
          if (space.tile !== undefined) {
            return undefined;
          }
          if (space.id === board.noctisCitySpaceId) {
            return undefined;
          }
          if (space.player !== undefined && space.player !== player) {
            return undefined;
          }
          // Non-land terrain → generic 'wrong-terrain'.
          if (space.spaceType !== 'land') {
            return undefined;
          }
          // Now we know: empty, land, owner-OK. Two card-specific reasons:
          if (!adjacentIds.has(space.id)) {
            return 'not-adjacent-to-nomads';
          }
          if (!this.canAffordPlacementBonus(player, space)) {
            return 'cannot-afford-bonus';
          }
          return undefined;
        },
      })
      .andThen((space) => {
        player.game.nomadSpace = space.id;

        // Don't grant bonuses when moving onto hazard tiles. Even though you're allowed
        // to move Mars Nomads onto that space.
        const coveringExistingSpace = AresHandler.hasHazardTile(space);
        player.game.grantPlacementBonuses(player, space, coveringExistingSpace);

        // Trigger onTilePlaced callbacks even though no actual tile is placed.
        // Note: all onTilePlaced callbacks must handle space.tile being undefined.
        player.game.triggerForAllCards((p, c) => c.onTilePlaced?.(p, player, space, BoardType.MARS));

        return undefined;
      });
  }
}
