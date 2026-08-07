import {IProjectCard} from '../IProjectCard';
import {IActionCard, ICard} from '../ICard';
import {Card} from '../Card';
import {CardName} from '../../../common/cards/CardName';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {SelectCard} from '../../inputs/SelectCard';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';
import {MAX_TEMPERATURE} from '../../../common/constants';
import {LogHelper} from '../../LogHelper';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {CardRenderer} from '../render/CardRenderer';
import {TITLES} from '../../inputs/titles';
import {Resource} from '../../../common/Resource';
import * as actionReason from '../actionReasons';
import * as actionPreviews from '../actionPreviews';

const ADD_COST = 6;

export class DirectedImpactors extends Card implements IActionCard, IProjectCard {
  constructor() {
    super({
      type: CardType.ACTIVE,
      name: CardName.DIRECTED_IMPACTORS,
      tags: [Tag.SPACE],
      cost: 8,
      resourceType: CardResource.ASTEROID,

      metadata: {
        cardNumber: 'X19',
        infoText: [
          {kind: 'action-short', text: 'Add an asteroid to any card', tokens: ['titanium']},
          {kind: 'action-short', text: 'Raise temperature one step', tokens: ['temperature']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.action('Spend 6 M€ to add 1 asteroid to ANY CARD (titanium may be used to pay for this).', (eb) => {
            eb.megacredits(6).super((b) => b.titanium(1)).startAction.resource(CardResource.ASTEROID).asterix();
          }).br;
          b.or().br;
          b.action('Remove 1 asteroid here to raise temperature 1 step.', (eb) => {
            eb.resource(CardResource.ASTEROID).startAction.temperature(1);
          });
        }),
      },
    });
  }

  public canAct(player: IPlayer): boolean {
    const cardHasResources = this.resourceCount > 0;
    const canPayForAsteroid = this.canPayForAsteroid(player);

    if (player.game.getTemperature() === MAX_TEMPERATURE && cardHasResources) {
      return true;
    }
    if (canPayForAsteroid) {
      return true;
    }

    return player.canAfford({cost: 0, tr: {temperature: 1}}) && cardHasResources;
  }

  public actionUnavailableReason() {
    return actionReason.ruleReason('Cannot pay for an asteroid right now');
  }

  private canPayForAsteroid(player: IPlayer): boolean {
    return player.canAfford({cost: ADD_COST, titanium: true});
  }

  /**
   * Is REMOVE an option the player gets to pick? ONE reading, shared by the
   * preview and `action()`.
   *
   * The two used to be written out separately and disagreed with temperature
   * MAXED: the preview offered both branches while `action()` built a one-option
   * OrOptions, so the batch's `{or, index}` — which is POSITIONAL — either ran
   * the wrong branch (index 0 = "remove" in the preview, "add" live) or was
   * rejected outright as an invalid index.
   *
   * The rule itself: raising a maxed temperature buys nothing and the Reds tax
   * may be unaffordable, so the removal is normally hidden — UNLESS the add
   * branch is out of reach, where removing is the only thing left and the card
   * offers it regardless (that is the disjunct `canAct` relies on).
   */
  private removeIsOffered(player: IPlayer): boolean {
    if (this.resourceCount === 0) {
      return false;
    }
    const raiseIsWorthIt = player.game.getTemperature() !== MAX_TEMPERATURE &&
      player.canAfford({cost: 0, tr: {temperature: 1}});
    return raiseIsWorthIt || !this.canPayForAsteroid(player);
  }

  // Branch order MUST match action(): remove-asteroid (raise temperature)
  // pushed first, pay-to-add-asteroid second.
  public actionPreview(player: IPlayer) {
    // The 6 M€ is a CHOICE whenever titanium (or Helion heat) can cover it — the
    // live `SelectPaymentDeferred` then asks. Pre-collect it instead of letting
    // it arrive as a modal after the action was already confirmed.
    const pay = actionPreviews.paymentStep(player, ADD_COST, {canUseTitanium: true, title: TITLES.payForCardAction(this.name)});
    return actionPreviews.orBranches(this, [
      {
        available: this.removeIsOffered(player),
        title: 'Remove 1 asteroid to raise temperature 1 step',
        effects: [actionPreviews.cardCost(this, 1), actionPreviews.globalGain(player, 'temperature', 1)],
        // One blocker, named — checked in the order the rule reads.
        unavailableReason: this.resourceCount === 0 ?
          actionReason.ruleReason('No asteroid on this card') :
          (player.game.getTemperature() === MAX_TEMPERATURE ?
            actionReason.ruleReason('Temperature is already maxed') :
            actionReason.ruleReason('Can\'t afford the Reds tax')),
      },
      {
        // The asteroid TARGET still rides the follow-up routing.
        available: this.canPayForAsteroid(player),
        title: 'Pay 6 M€ to add 1 asteroid to a card',
        effects: pay !== undefined ?
          [actionPreviews.cardResourceGain(CardResource.ASTEROID, 1)] :
          [actionPreviews.stockCost(player, Resource.MEGACREDITS, ADD_COST), actionPreviews.cardResourceGain(CardResource.ASTEROID, 1)],
        steps: [pay],
        unavailableReason: actionReason.needMoreMC(player, ADD_COST),
      },
    ]);
  }

  public action(player: IPlayer) {
    const asteroidCards = player.getResourceCards(CardResource.ASTEROID);
    const opts = [];

    const addResource = new SelectOption('Pay 6 M€ to add 1 asteroid to a card', 'Pay').andThen(() => this.addResource(player, asteroidCards));
    const spendResource = new SelectOption('Remove 1 asteroid to raise temperature 1 step', 'Remove asteroid').andThen(() => this.spendResource(player));

    if (this.removeIsOffered(player)) {
      opts.push(spendResource);
    }
    if (this.canPayForAsteroid(player)) {
      opts.push(addResource);
    }

    // RESOLVE a lone option rather than asking the player to pick from a list of
    // one — the preview reports that case as "no branch pick" (index -1), so the
    // batch submits nothing for it and a one-option OrOptions would strand.
    if (opts.length === 1) {
      return opts[0].cb(undefined);
    }
    return new OrOptions(...opts);
  }

  private addResource(player: IPlayer, asteroidCards: ICard[]) {
    player.game.defer(new SelectPaymentDeferred(player, ADD_COST, {canUseTitanium: true, title: TITLES.payForCardAction(this.name)}));

    // ALWAYS ask which card — even a single candidate (which is this card itself) —
    // so the player SEES where the asteroid goes + its current → resulting (no silent
    // auto-add-to-self; fork-wide no-autoselect rule).
    return new SelectCard(
      'Select card to add 1 asteroid',
      'Add asteroid',
      asteroidCards)
      .andThen(([card]) => {
        player.addResourceTo(card, {log: true});
        return undefined;
      });
  }

  private spendResource(player: IPlayer) {
    this.resourceCount--;
    LogHelper.logRemoveResource(player, this, 1, 'raise temperature 1 step');
    player.game.increaseTemperature(player, 1);
    return undefined;
  }
}
