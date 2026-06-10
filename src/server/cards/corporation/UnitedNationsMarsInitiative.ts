import {CorporationCard} from './CorporationCard';
import {IActionCard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {ICorporationCard} from './ICorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {TITLES} from '../../inputs/titles';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {Resource} from '../../../common/Resource';
import * as actionPreviews from '../actionPreviews';
export const ACTION_COST = 3;
export class UnitedNationsMarsInitiative extends CorporationCard implements IActionCard, ICorporationCard {
  constructor() {
    super({
      name: CardName.UNITED_NATIONS_MARS_INITIATIVE,
      tags: [Tag.EARTH],
      startingMegaCredits: 40,

      metadata: {
        cardNumber: 'R32',
        description: 'You start with 40 M€.',
        renderData: CardRenderer.builder((b) => {
          // TODO(chosta): find a not so hacky solutions to spacing
          // b.br.br.br;
          b.empty().megacredits(40);
          b.corpBox('action', (ce) => {
            ce.action('If your Terraform Rating was raised this generation, you may pay 3 M€ to raise it 1 step more.', (eb) => {
              eb.megacredits(3).startAction.tr(1).asterix();
            });
          });
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    return player.hasIncreasedTerraformRatingThisGeneration && player.canAfford({cost: ACTION_COST, tr: {tr: 1}});
  }

  // Structured reason for the Actions overlay when the action is unavailable.
  public actionUnavailableReason(player: IPlayer): UnplayableReason | undefined {
    if (!player.hasIncreasedTerraformRatingThisGeneration) {
      return {type: 'rule', message: 'Your terraform rating was not raised this generation'};
    }
    if (!player.canAfford({cost: ACTION_COST, tr: {tr: 1}})) {
      return {type: 'megacredits', message: 'Need ${0} more M€', params: [String(Math.max(1, ACTION_COST - player.spendableMegacredits()))]};
    }
    return undefined;
  }
  // Pay 3 M€ to raise your TR 1 step more (only if TR was raised this generation).
  public actionPreview(player: IPlayer) {
    return actionPreviews.singleBranch(this, player, [], [
      actionPreviews.stockCost(player, Resource.MEGACREDITS, ACTION_COST),
      actionPreviews.trGain(player, 1),
    ]);
  }

  public action(player: IPlayer) {
    player.game.defer(new SelectPaymentDeferred(player, 3, {title: TITLES.payForCardAction(this.name)}))
      .andThen(() => player.increaseTerraformRating());
    return undefined;
  }
}
