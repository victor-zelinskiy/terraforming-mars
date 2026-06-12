import {IProjectCard} from '../IProjectCard';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {Resource} from '../../../common/Resource';
import {CardResource} from '../../../common/CardResource';
import {RemoveResourcesFromCard} from '../../deferredActions/RemoveResourcesFromCard';
import {StealResources} from '../../deferredActions/StealResources';
import {Card} from '../Card';
import {Size} from '../../../common/cards/render/Size';
import {CardRenderer} from '../render/CardRenderer';
import {all} from '../Options';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class AirRaid extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 0,
      name: CardName.AIR_RAID,
      type: CardType.EVENT,

      metadata: {
        cardNumber: 'C02',
        description: 'Requires that you lose 1 floater. Steal 5 M€ from any player.',
        renderData: CardRenderer.builder((b) => {
          b.minus().resource(CardResource.FLOATER);
          b.text('steal', Size.MEDIUM, true).megacredits(5, {all});
        }),
      },
    });
  }

  public override bespokeCanPlay(player: IPlayer): boolean {
    if (player.getResourceCount(CardResource.FLOATER) === 0) {
      return false;
    }
    if (player.game.isSoloMode()) {
      return true;
    }
    return StealResources.getCandidates(player, Resource.MEGACREDITS, 5, true).length > 0;
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(new StealResources(player, Resource.MEGACREDITS, 5, undefined, true));
    player.game.defer(new RemoveResourcesFromCard(player, CardResource.FLOATER, 1, {source: 'self', blockable: false}));
    return undefined;
  }

  // PRE-COLLECT both on-play choices IN the play modal (no follow-up). The steal
  // is MANDATORY for the full 5 M€, so candidates are only opponents with ≥5 (the
  // player always gains exactly +5; an opponent with fewer is shown disabled with a
  // "Not enough to steal" reason, one with 0 "Nothing to steal"). The per-target
  // chip shows how much the chosen opponent LOSES (current → resulting); the +5 M€
  // gain + −1 floater chips show what the PLAYER nets. Steal (ATTACK_OPPONENT)
  // defers before the floater spend (LOSE_RESOURCE_OR_PRODUCTION), so the steps are
  // ordered to match. Built read-only (the steal/floater builders mutate nothing).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    const stealOptions = new StealResources(player, Resource.MEGACREDITS, 5, undefined, true).previewOptions();
    const stealStep = stealOptions !== undefined ? actionPreviews.orOptionsStep(player, stealOptions) : undefined;
    const floaterStep = actionPreviews.inputStep(
      new RemoveResourcesFromCard(player, CardResource.FLOATER, 1, {source: 'self', blockable: false}).previewSelectCard(),
      -1);
    return actionPreviews.playPreview(this, player, [
      actionPreviews.stockGain(player, Resource.MEGACREDITS, 5),
      actionPreviews.cardResourceCost(CardResource.FLOATER, 1),
    ], [stealStep, floaterStep]);
  }
}
