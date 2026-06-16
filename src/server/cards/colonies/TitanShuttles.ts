import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Resource} from '../../../common/Resource';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectAmount} from '../../inputs/SelectAmount';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import * as actionPreviews from '../actionPreviews';
import * as actionReason from '../actionReasons';

export class TitanShuttles extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 23,
      tags: [Tag.JOVIAN, Tag.SPACE],
      name: CardName.TITAN_SHUTTLES,
      type: CardType.ACTIVE,
      resourceType: CardResource.FLOATER,
      victoryPoints: 1,

      metadata: {
        cardNumber: 'C45',
        renderData: CardRenderer.builder((b) => {
          b.action('Add 2 floaters to ANY JOVIAN CARD.', (eb) => {
            eb.empty().startAction.resource(CardResource.FLOATER, {amount: 2, secondaryTag: Tag.JOVIAN});
          }).br;
          b.or().br;
          b.action('Spend any number of floaters here to gain the same number of titanium.', (eb) => {
            eb.text('x').resource(CardResource.FLOATER).startAction.text('x').titanium(1);
          }).br;
        }),
      },
    });
  }


  public canAct(): boolean {
    return true;
  }

  // Branch order MUST match action(): add-to-Jovian first, spend-for-titanium second.
  public actionPreview(player: IPlayer) {
    return actionPreviews.orBranches(this, [
      {
        available: true,
        title: 'Add 2 floaters to a Jovian card',
        effects: [actionPreviews.cardResourceGain(CardResource.FLOATER, 2)],
        steps: [actionPreviews.addToCardStep(player, CardResource.FLOATER, {count: 2, restrictedTag: Tag.JOVIAN})],
      },
      {
        // The OrOptions option IS a SelectAmount, so the amount nests into the
        // branch pick (optionInput), not a separate step.
        available: this.resourceCount > 0,
        title: 'Remove X floaters on this card to gain X titanium',
        unavailableReason: actionReason.noResourcesHere(),
        optionInput: actionPreviews.amountInput('Remove X floaters on this card to gain X titanium', 'Remove floaters', 1, this.resourceCount, {icon: 'titanium'}),
      },
    ]);
  }

  public action(player: IPlayer) {
    if (this.resourceCount === 0) {
      // autoSelect:false — ALWAYS ask which Jovian card (even with one candidate) so
      // the player sees where the floaters land; the modal pre-collects the pick.
      player.game.defer(new AddResourcesToCard(player, CardResource.FLOATER, {count: 2, restrictedTag: Tag.JOVIAN, title: 'Add 2 floaters to a Jovian card', autoSelect: false}));
      return undefined;
    }

    return new OrOptions(
      new SelectOption('Add 2 floaters to a Jovian card', 'Add floaters').andThen(() => {
        player.game.defer(new AddResourcesToCard(player, CardResource.FLOATER, {count: 2, restrictedTag: Tag.JOVIAN, autoSelect: false}));
        return undefined;
      }),
      new SelectAmount(
        'Remove X floaters on this card to gain X titanium', 'Remove floaters',
        1, this.resourceCount, true,
      ).andThen((amount) => {
        player.removeResourceFrom(this, amount);
        // stock.add (NOT `player.titanium +=`) so the titanium gain is recorded as a
        // GameEvent → shown in the journal / notifications beside the floater spend.
        player.stock.add(Resource.TITANIUM, amount);
        player.game.log('${0} removed ${1} floaters to gain ${2} titanium', (b) => b.player(player).number(amount).number(amount));
        return undefined;
      }),
    );
  }
}
