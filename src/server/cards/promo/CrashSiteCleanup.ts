import {IPlayer} from '../../IPlayer';
import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {Resource, StandardResource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import * as actionPreviews from '../actionPreviews';

export class CrashSiteCleanup extends Card implements IProjectCard {
  constructor() {
    super({
      type: CardType.EVENT,
      name: CardName.CRASH_SITE_CLEANUP,
      cost: 4,
      requirements: {plantsRemoved: true},
      victoryPoints: 1,

      metadata: {
        description: 'Requires that a player removed ANOTHER PLAYER\'s plants this generation. Gain 1 titanium or 2 steel.',
        cardNumber: 'X17',
        renderData: CardRenderer.builder((b) => {
          b.titanium(1).nbsp.or().nbsp.steel(2);
        }),
      },
    });
  }

  public override bespokePlay(player: IPlayer) {
    const gainTitanium = new SelectOption(
      'Gain 1 titanium',
      'Gain titanium')
      .andThen(() => {
        player.stock.add(Resource.TITANIUM, 1, {log: true});
        return undefined;
      });

    const gain2Steel = new SelectOption(
      'Gain 2 steel',
      'Gain steel')
      .andThen(() => {
        player.stock.add(Resource.STEEL, 2, {log: true});
        return undefined;
      });

    return new OrOptions(gainTitanium, gain2Steel);
  }

  // The on-play preview: the two-way OrOptions `bespokePlay` builds, shown as
  // branches with their gain chips so the player picks titanium vs steel inside
  // the play modal. Always two options (never auto-resolves).
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.orBranches(this, [
      {available: true, title: 'Gain 1 titanium', effects: [actionPreviews.stockGain(player, Resource.TITANIUM, 1)]},
      {available: true, title: 'Gain 2 steel', effects: [actionPreviews.stockGain(player, Resource.STEEL, 2)]},
    ]);
  }

  public static resourceHook(player: IPlayer, resource: Resource | StandardResource, amount: number, from: IPlayer) {
    if (from === player || amount >= 0) {
      return;
    }
    if (resource === Resource.PLANTS && amount < 0) {
      player.game.someoneHasRemovedOtherPlayersPlants = true;
    }
  }
}

