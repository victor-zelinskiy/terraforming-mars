import {IPlayer} from '../../IPlayer';
import {CorporationCard} from '../corporation/CorporationCard';
import {Space} from '../../boards/Space';
import {IActionCard} from '../ICard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
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
        // The corp box draws its action and effect as plain text (no effect
        // frame), so both are authored here and tethered to the community
        // marker on the starting row.
        description: 'You start with 40 M€ and 10 steel. AS YOUR FIRST ACTION, PLACE A COMMUNITY [PLAYER MARKER] ON A NON-RESERVED AREA.',
        // The action + effect texts are the CO-LOCATED descriptions of the two
        // corp-box frames below (auto-extracted into their ДЕЙСТВИЕ / ЭФФЕКТ
        // blocks). Only the first-action immediate is authored (it has no frame).
        infoText: [
          {text: 'As your first action, place a community (player marker) on a non-reserved area.', tokens: ['community']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br;
          b.megacredits(40).nbsp.steel(10, {digit}).nbsp.community().asterix();
          b.corpBox('effect-action', (ce) => {
            // ACTION: place a community marker — simple cube + «*» (see rule text).
            ce.action('Place a community (player marker) on a non-reserved area next to one of your tiles or marked areas.', (eb) => {
              eb.empty().startAction.community().asterix();
            });
            // EFFECT: place a tile on a marked area → gain 3 M€.
            ce.effect('Marked areas are reserved for you. When you place a tile on a marked area, gain 3 M€.', (eb) => {
              eb.emptyTile().startEffect.megacredits(3);
            });
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

  // Same board-space follow-up as the repeatable action (minus the adjacency
  // rule) — the first-action confirm reuses the same honest note.
  public firstActionPreview() {
    return actionPreviews.firstActionBranch(this, [], [
      actionPreviews.noteStep('board', 'After confirming, choose where to place the community.'),
    ]);
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
  // board after submit — no pre-collectable step or fixed effect. A context note
  // tells the player they'll pick a space, so the modal isn't mute.
  public actionPreview(player: IPlayer) {
    return actionPreviews.singleBranch(this, player, [
      actionPreviews.noteStep('board', 'After confirming, choose where to place the community.'),
    ]);
  }

  public action(player: IPlayer) {
    return this.askToClaimSpace(player, this.getAvailableSpacesForMarker(player), true);
  }
}
