import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {IPlayer} from '../../IPlayer';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {IColony} from '../../colonies/IColony';
import {SelectColony} from '../../inputs/SelectColony';
import {CardRenderer} from '../render/CardRenderer';
import {Card} from '../Card';
import {IColonyTrader} from '../../colonies/IColonyTrader';
import {ColoniesHandler} from '../../colonies/ColoniesHandler';
import {message} from '../../logs/MessageBuilder';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';
import {cardSource} from '../../inputs/choiceContext';

export class TitanFloatingLaunchPad extends Card implements IProjectCard {
  constructor() {
    super({
      cost: 18,
      tags: [Tag.JOVIAN],
      name: CardName.TITAN_FLOATING_LAUNCHPAD,
      type: CardType.ACTIVE,
      resourceType: CardResource.FLOATER,
      victoryPoints: 1,

      behavior: {
        addResourcesToAnyCard: {type: CardResource.FLOATER, count: 2, tag: Tag.JOVIAN},
      },

      metadata: {
        cardNumber: 'C44',
        // EACH PRINTED ROW DESCRIBES ITSELF. The first row used to carry NO
        // description, and a description-less action frame is folded into its
        // described sibling (`buildCardInformation.extractEffectActionGroups`)
        // — so ONE information group had to cover BOTH variants, and the card's
        // curated `action-short` landed on it unambiguously by accident
        // (`applyActionShorts`, `blocks.length === 1`). The console then showed
        // «Add 1 floater to ANY JOVIAN CARD **or** spend 1 floater here to trade
        // for free» on the variant that only trades. A caption that names the
        // other half of an «или» card is the one thing a per-variant slot may
        // never say. Two described rows → two groups → one rule each, and the
        // curated short is no longer needed: each rule already reads as its own
        // caption, which is exactly when the contract says to omit it.
        renderData: CardRenderer.builder((b) => {
          b.action('Add 1 floater to ANY JOVIAN CARD.', (eb) => {
            eb.empty().startAction.resource(CardResource.FLOATER, {secondaryTag: Tag.JOVIAN}).nbsp.or();
          }).br;
          b.action('Spend 1 floater here to trade for free.', (eb) => {
            eb.resource(CardResource.FLOATER).startAction.trade();
          }).br.br;
          b.resource(CardResource.FLOATER, {amount: 2, secondaryTag: Tag.JOVIAN});
        }),
        description: {
          text: 'Add two floaters to ANY JOVIAN CARD.',
          align: 'left',
        },
      },
    });
  }

  public canAct(): boolean {
    return true;
  }

  // Branch order MUST match action(): trade-for-free first, add-floater second.
  public actionPreview(player: IPlayer) {
    const canTrade = this.resourceCount > 0 && player.colonies.canTrade();
    return actionPreviews.orBranches(this, [
      {
        // The colony picker (SelectColony) appears after submit — a context note
        // tells the player they'll choose which colony to trade with.
        available: canTrade,
        title: 'Remove 1 floater on this card to trade for free',
        effects: [actionPreviews.cardCost(this, 1)],
        steps: [actionPreviews.noteStep('colony', 'After confirming, choose a colony to trade with.')],
        unavailableReason: this.resourceCount === 0 ?
          actionReason.ruleReason('No floaters on this card') :
          actionReason.ruleReason('No colony available to trade with'),
      },
      {
        available: true,
        title: 'Add 1 floater to a Jovian card',
        effects: [actionPreviews.cardResourceGain(CardResource.FLOATER, 1)],
        steps: [actionPreviews.addToCardStep(player, CardResource.FLOATER, {restrictedTag: Tag.JOVIAN})],
      },
    ]);
  }

  public action(player: IPlayer) {
    const orOptions = new OrOptions(
      new SelectOption('Remove 1 floater on this card to trade for free', 'Remove floater').andThen(() => {
        player.defer(
          new SelectColony('Select colony tile to trade with for free', 'Select', ColoniesHandler.tradeableColonies(player.game))
            .andThen((colony) => {
              this.resourceCount--;
              player.game.log('${0} spent 1 floater to trade with ${1}', (b) => b.player(player).colony(colony));
              colony.trade(player);
              return undefined;
            }));
        return undefined;
      }),
      new SelectOption('Add 1 floater to a Jovian card', 'Add floater').andThen(() => {
        // autoSelect:false — ALWAYS ask which Jovian card (even one candidate) so the
        // player sees the target; the confirm modal pre-collects the pick.
        player.game.defer(new AddResourcesToCard(player, CardResource.FLOATER, {restrictedTag: Tag.JOVIAN, title: 'Add 1 floater to a Jovian card', autoSelect: false, cause: cardSource(this)}));
        return undefined;
      }),
    );
    if (this.resourceCount === 0 || !player.colonies.canTrade()) {
      return orOptions.options[1].cb();
    }
    return orOptions;
  }
}

export class TradeWithTitanFloatingLaunchPad implements IColonyTrader {
  private titanFloatingLaunchPad: TitanFloatingLaunchPad | undefined;

  constructor(private player: IPlayer) {
    const card = player.tableau.get(CardName.TITAN_FLOATING_LAUNCHPAD);
    this.titanFloatingLaunchPad = card === undefined ? undefined : (card as TitanFloatingLaunchPad);
  }

  public canUse() {
    return (this.titanFloatingLaunchPad?.resourceCount ?? 0) > 0 &&
      !this.player.actionsThisGeneration.has(CardName.TITAN_FLOATING_LAUNCHPAD);
  }

  public optionText() {
    return message('Pay 1 floater (use ${0} action)', (b) => b.cardName(CardName.TITAN_FLOATING_LAUNCHPAD));
  }

  /** Mirrors `canUse`, one named blocker each. `undefined` = the player doesn't
   *  own the card, so the option stays hidden (there is nothing to explain). */
  public disabledReason() {
    if (this.titanFloatingLaunchPad === undefined) {
      return undefined;
    }
    if ((this.titanFloatingLaunchPad.resourceCount ?? 0) <= 0) {
      return 'No floaters on this card';
    }
    return 'This card\'s action was already used this generation';
  }

  public trade(colony: IColony) {
    // grr I wish there was a simpler syntax.
    if (this.titanFloatingLaunchPad !== undefined) {
      this.titanFloatingLaunchPad.resourceCount--;
    }
    this.player.actionsThisGeneration.add(CardName.TITAN_FLOATING_LAUNCHPAD);
    this.player.game.log('${0} spent 1 floater to trade with ${1}', (b) => b.player(this.player).colony(colony));
    colony.trade(this.player);
  }
}
