import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {IProjectCard} from '../IProjectCard';
import {IPlayer} from '../../IPlayer';
import {createMarsSelectSpace} from '../../boards/marsSelectSpaceHelper';
import {CardName} from '../../../common/cards/CardName';
import {LogHelper} from '../../LogHelper';
import {CardRenderer} from '../render/CardRenderer';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as reason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

export class LandClaim extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.LAND_CLAIM,
      cost: 1,

      metadata: {

        infoText: [

          {text: 'Place your marker on a non-reserved area. Only you may place a tile there.', tokens: ['community']},

        ],
        cardNumber: '066',
        renderData: CardRenderer.builder((b) => {
          b.community().emptyTile();
        }),
      },
    });
  }
  public override bespokeCanPlay(player: IPlayer): boolean {
    return player.game.board.getNonReservedLandSpaces().length > 0;
  }

  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (player.game.board.getNonReservedLandSpaces().length === 0) {
      return reason.placementReason('No space available for the tile');
    }
    return undefined;
  }
  public override bespokePlay(player: IPlayer) {
    // Land Claim marks any non-reserved land. Off-limits cells get their
    // generic reason (occupied / reserved-noctis / reserved-colony /
    // owned-by-other / ocean-only) — no card-specific rule, so no customReasoner.
    return createMarsSelectSpace(
      player,
      'Select space for claim',
      player.game.board.getNonReservedLandSpaces(),
      {placementType: 'land'})
      .andThen((space) => {
        space.player = player;
        LogHelper.logBoardTileAction(player, space, 'land claim');
        return undefined;
      });
  }

  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.placementPreview(this, player, {text: 'After confirming, choose a space to reserve.'});
  }
}
