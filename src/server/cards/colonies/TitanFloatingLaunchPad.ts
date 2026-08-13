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
    // ONE named blocker, from the SAME code the gate is (`Colonies.canTrade` is
    // derived from `tradeBlockedReason`). The card's own floater cost is checked
    // first — it is the only condition this card adds.
    const tradeBlocked = player.colonies.tradeBlockedReason();
    const canTrade = this.resourceCount > 0 && tradeBlocked === undefined;
    return actionPreviews.orBranches(this, [
      {
        // NOT a trade of its own — the second entry point into the ONE trade,
        // paid through this card's own `IColonyTrader` (below). The console
        // reads this step and hands the player to the colony workspace with
        // that payment path locked, committing nothing until the trade is.
        available: canTrade,
        title: 'Remove 1 floater on this card to trade for free',
        effects: [actionPreviews.cardCost(this, 1)],
        steps: [actionPreviews.colonyTradeStep(this)],
        // «Нет колонии для торговли» is ONE of three reasons a trade can be
        // blocked, and it used to speak for all of them — most often for «your
        // only trade fleet is already out», which it plainly is not. The
        // fallback is unreachable (the branch is available exactly when neither
        // condition holds) and stays only so the type is total.
        unavailableReason: actionReason.ruleReason(
          this.resourceCount === 0 ?
            'No floaters on this card' :
            tradeBlocked ?? 'No colony available to trade with'),
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
        // ONE implementation of «spend the floater and trade». This branch used
        // to decrement `resourceCount` and call `colony.trade` itself, so the
        // card's own action and the trade prompt's floater payment path were two
        // codes doing the same thing — and they had already drifted: only the
        // payment path opened the colony EVENT SCOPE, so a trade taken from the
        // card grouped differently in the journal, and only it carried the
        // `'trade'` button label the console's trade orchestration keys on.
        // The trader IS the implementation; this is one of its two entry points.
        const trader = new TradeWithTitanFloatingLaunchPad(player);
        player.defer(
          new SelectColony('Select colony tile to trade with for free', 'trade', ColoniesHandler.tradeableColonies(player.game))
            .andThen((colony) => {
              const events = player.game.events;
              events?.beginAction(player, {kind: 'colony', name: colony.name}, {category: 'colony'});
              try {
                trader.trade(colony);
              } finally {
                events?.endScope();
              }
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

  /** The console's payment picker renders every trade path in ONE grammar —
   *  icon + `current → resulting` — from this marker (the same shape
   *  TradeWithEnergy/Titanium/Megacredits attach); without it the floater row
   *  stood bare beside fully-dressed siblings. `card` is this path's structural
   *  IDENTITY: the card's own action enters this option, and the console must
   *  find it without matching the translated label. */
  public optionMetadata() {
    const current = this.titanFloatingLaunchPad?.resourceCount ?? 0;
    return {kind: 'resourceRemoval' as const, icon: 'floater', amount: 1,
      card: CardName.TITAN_FLOATING_LAUNCHPAD,
      resource: {current, resulting: Math.max(0, current - 1)}};
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
