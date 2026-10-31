import {IProjectCard} from '../IProjectCard';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {StealResources} from '../../deferredActions/StealResources';
import {Card} from '../Card';
import {Size} from '../../../common/cards/render/Size';
import {CardRenderer} from '../render/CardRenderer';
import {all, digit} from '../Options';
import {PartyName} from '../../../common/turmoil/PartyName';
import {Tag} from '../../../common/cards/Tag';
import {message} from '../../logs/MessageBuilder';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import * as reason from '../actionReasons';
import {cardSource} from '../../inputs/choiceContext';

export class SpecialPermit extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 5,
      name: CardName.SPECIAL_PERMIT,
      type: CardType.EVENT,
      tags: [Tag.PLANT],
      requirements: {party: PartyName.GREENS},

      metadata: {
        cardNumber: 'P82',
        // Redux voice: «another player» — the engine's truth (`StealResources` targets OPPONENTS only; solo gains 4).
        description: 'Requires that Greens are ruling or that you have 2 delegates there. Steal 4 plants from another player.',
        renderData: CardRenderer.builder((b) => {
          b.text('steal', Size.MEDIUM, true).plants(4, {all, digit});
        }),
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    if (player.game.isSoloMode()) {
      return true;
    }
    return StealResources.getCandidates(player, Resource.PLANTS, 4, /* mandatory= */ true).length > 0;
  }

  // The bespoke block the generic explainer can't introspect: nobody to steal 4 plants from (named, never a bare «no»).
  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    if (!player.game.isSoloMode() && StealResources.getCandidates(player, Resource.PLANTS, 4, true).length === 0) {
      return reason.targetReason('No player to steal 4 plants from');
    }
    return undefined;
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(
      new StealResources(
        player,
        Resource.PLANTS,
        4,
        message('Select player to steal ${0} ${1} from', (b) => b.number(4).string(Resource.PLANTS)),
        /* mandatory= */ true,
        cardSource(this)));

    return undefined;
  }

  // PRE-COLLECT the target IN the play composer, after Air Raid: the steal is MANDATORY for the full 4, so the
  // candidates are the opponents with ≥ 4 unprotected plants (Botanical Experience: 8); one with fewer is shown
  // disabled with its reason (the near miss). The +4 plants chip is what the PLAYER nets. Read-only — the steal's
  // builder mutates nothing (each option's attack lives in its `andThen`).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const stealOptions = new StealResources(player, Resource.PLANTS, 4, undefined, true, cardSource(this)).previewOptions();
    const stealStep = stealOptions !== undefined ? actionPreviews.orOptionsStep(player, stealOptions) : undefined;
    return actionPreviews.playPreview(this, player, [
      actionPreviews.stockGain(player, Resource.PLANTS, 4),
    ], [stealStep]);
  }
}
