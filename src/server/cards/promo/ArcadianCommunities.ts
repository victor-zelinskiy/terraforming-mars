import {IPlayer} from '../../IPlayer';
import {CorporationCard} from '../corporation/CorporationCard';
import {Space} from '../../boards/Space';
import {IActionCard} from '../ICard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {digit} from '../Options';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';
import {PlacementIllegalReason} from '../../../common/inputs/PlacementIllegalReason';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class ArcadianCommunities extends CorporationCard implements ICorporationCard, IActionCard {
  constructor() {
    super({
      name: CardName.ARCADIAN_COMMUNITIES,
      startingMegaCredits: 40,
      initialActionText: 'Place a community (player marker) on a non-reserved area',

      behavior: {
        stock: {steel: 10},
      },

      metadata: {
        cardNumber: 'R44',
        description: 'You start with 40 M€ and 10 steel. AS YOUR FIRST ACTION, PLACE A COMMUNITY [PLAYER MARKER] ON A NON-RESERVED AREA.',
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(40).nbsp.steel(10, {digit}).nbsp.community().asterix();
          b.corpBox('action', (ce) => {
            ce.text('ACTION: PLACE A COMMUNITY (PLAYER MARKER) ON A NON-RESERVED AREA ADJACENT TO ONE OF YOUR TILES OR MARKED AREAS.', Size.TINY, true);
            ce.vSpace(Size.MEDIUM);
            ce.text('EFFECT: MARKED AREAS ARE RESERVED FOR YOU. WHEN YOU PLACE A TILE THERE, GAIN 3 M€.', Size.TINY, true);
          });
        }),
      },
    });
  }

  private askToClaimSpace(player: IPlayer, spaces: ReadonlyArray<Space>, requireAdjacency: boolean) {
    const board = player.game.board;
    const customReasoner = (space: Space): PlacementIllegalReason | undefined => {
      // Already-marked cells: distinguish OWN marker (already-marked)
      // from other-player marker (let generic emit 'owned-by-other').
      if (space.player === player) {
        return 'already-marked';
      }
      // For the adjacency-required action variant, flag cells without
      // any of YOUR neighbouring marker/tile.
      if (requireAdjacency && space.tile === undefined && space.player === undefined &&
          space.spaceType === 'land' &&
          space.id !== board.noctisCitySpaceId) {
        const adjacentToYours = board.getAdjacentSpaces(space).some((adj) => adj.player === player);
        if (!adjacentToYours) {
          return 'not-adjacent-to-yours';
        }
      }
      return undefined;
    };
    return createMarsSelectSpace(player, 'Select space for claim', spaces, {
      placementType: 'land',
      customReasoner,
    })
      .andThen((space: Space) => {
        space.player = player;
        player.game.log('${0} placed a Community (player marker)', (b) => b.player(player));
        return undefined;
      });
  }

  public override initialAction(player: IPlayer) {
    return this.askToClaimSpace(player, player.game.board.getAvailableSpacesOnLand(player), false);
  }

  public getAvailableSpacesForMarker(player: IPlayer): Array<Space> {
    const board = player.game.board;
    const candidateSpaces = board.getAvailableSpacesOnLand(player);
    const spaces = candidateSpaces.filter((space) => {
      // Exclude spaces that already have a player marker.
      if (space.player !== undefined) {
        return false;
      }
      const adjacentSpaces = board.getAdjacentSpaces(space);
      return adjacentSpaces.find((adj) => adj.player === player) !== undefined;
    });
      // Remove duplicates
    return spaces.filter((space, index) => spaces.indexOf(space) === index);
  }

  public canAct(player: IPlayer): boolean {
    return this.getAvailableSpacesForMarker(player).length > 0;
  }

  public actionUnavailableReason() {
    return actionReason.placementReason('No area to place a community');
  }

  // Placing the community marker is a board-space selection resolved on the
  // board after submit — no pre-collectable step or fixed effect.
  public actionPreview(player: IPlayer) {
    return actionPreviews.singleBranch(this, player);
  }

  public action(player: IPlayer) {
    return this.askToClaimSpace(player, this.getAvailableSpacesForMarker(player), true);
  }
}
