import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {CardResource} from '../../../common/CardResource';
import {IActionCard, ICard} from '../ICard';
import {CanAffordOptions, IPlayer} from '../../IPlayer';
import {ActivePreludeCard} from './ActivePreludeCard';
import {Resource} from '../../../common/Resource';
import {SelectPaymentDeferred} from '../../deferredActions/SelectPaymentDeferred';
import {cardSource} from '../../inputs/choiceContext';
import {UnplayableReason} from '../../../common/cards/UnplayableReason';
import {ActionPreview} from '../../../common/models/ActionPreviewModel';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {EffectForecastContext, EffectForecastGrant} from '../EffectForecastContext';
import * as actionPreviews from '../actionPreviews';
import * as actionReason from '../actionReasons';
import * as forecast from '../effectForecastPreviews';

/** The printed price («Lose 5 M€»). */
export const MAIN_BELT_ASTEROIDS_PRICE = 5;

/**
 * P53 — MAIN BELT ASTEROIDS («Астероидный пояс»), a Prelude 2 prelude: Space tag, asteroid resource, 1 VP per 2
 * asteroids here. The set's first card whose OWN action feeds its OWN effect: the action puts an asteroid on ANY card
 * (this one included), and an asteroid landing HERE pays 1 titanium.
 *
 * SCAN READING — the PRELUDE frame, the Space disc top right; two blocks side by side: «ACTION» `→ [asteroid]*`
 * «(Action: Gain 1 asteroid to ANY CARD.)» and «EFFECT» `[asteroid] : [titanium]` «(Effect: When gaining an asteroid
 * HERE, gain 1 titanium.)»; the bottom row `[−5 M€]` «(Lose 5 M€. 1 VP per 2 asteroids here.)». Lore: «There are many
 * metal-rich asteroids between Mars and Jupiter».
 *
 * RULE READINGS (pinned by tests/cards/prelude2/MainBeltAsteroids.spec.ts):
 *  1. THE PRICE is paid by the card itself (a negative `startingMegaCredits`); the bill names its asker (`cause`), so a
 *     pre-collected payment (Helion's heat) lands on it. The preview states it (the `cost` chip + the payment step) —
 *     the start's price gesture flies off that chip.
 *  2. AFFORDABILITY is honest: 5 M€ on top of any price held back before this play (P45 Board of Directors'
 *     `canAffordOptions.cost`); a shortfall is named.
 *  3. THE ACTION is declarative (`addResourcesToAnyCard`) — the pick is always asked, this card always among the
 *     candidates (it does not pay from here).
 *  4. THE EFFECT answers ONLY an asteroid landing on THIS card — from its own action, Comet Aiming, CEO's Favorite
 *     Project, anyone's. Its forecast twin is HONEST: it answers only where the landing is KNOWN (a grant «on this
 *     card» of this card, or this card's own action with itself the only holder); a pick among several is told per
 *     CANDIDATE by the shared step (`AddResourcesToCard` reads the candidate's twin into `extraByCard`) — never a
 *     «+1 titanium» promised for a pick that may go elsewhere.
 */
export class MainBeltAsteroids extends ActivePreludeCard implements IActionCard {
  constructor() {
    super({
      name: CardName.MAIN_BELT_ASTEROIDS,
      tags: [Tag.SPACE],
      resourceType: CardResource.ASTEROID,
      victoryPoints: {resourcesHere: {}, per: 2},

      startingMegacredits: -MAIN_BELT_ASTEROIDS_PRICE,

      action: {
        addResourcesToAnyCard: {type: CardResource.ASTEROID, count: 1},
      },

      metadata: {
        cardNumber: 'P53',
        infoText: [
          // The scan prints the effect BESIDE the action on one row: the derivation reads the row as the action's
          // group, so the effect's block is authored (the printed sentence — short enough to be its own caption).
          {kind: 'effect', text: 'Effect: When gaining an asteroid HERE, gain 1 titanium.', tokens: ['titanium']},
          {text: 'Lose 5 M€.', tokens: ['megacredits']},
          {kind: 'victory-points', text: '1 VP per 2 asteroids here.'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.action('Gain 1 asteroid to ANY CARD.', (ab) => {
            ab.empty().startAction.resource(CardResource.ASTEROID).asterix();
          }).nbsp.effect('When gaining an asteroid HERE, gain 1 titanium.', (ab) => {
            ab.resource(CardResource.ASTEROID).startEffect.titanium(1);
          }).br.megacredits(-MAIN_BELT_ASTEROIDS_PRICE);
        }),
        description: 'Lose 5 M€. 1 VP per 2 asteroids here.',
      },
    });
  }

  /** Rule 4 — an asteroid landing HERE pays 1 titanium per asteroid. */
  public onResourceAdded(player: IPlayer, card: ICard, count: number) {
    if (card === this) {
      player.stock.add(Resource.TITANIUM, count, {log: true, from: {card: this}});
    }
  }

  /**
   * Mirrors `onResourceAdded` — and only where the landing is KNOWN: a grant «on this card» of this very card, or this
   * card's own action while it is the owner's only asteroid holder (the pick is asked and shown, but its answer is
   * decided). Any other asteroid grant states nothing here: which card it lands on is the pick's, told per candidate.
   */
  public grantForecast(cardOwner: IPlayer, _activePlayer: IPlayer, grant: EffectForecastGrant, ctx: EffectForecastContext): ReadonlyArray<EffectForecastFact> {
    if (grant.kind !== 'cardResource' || grant.resource !== CardResource.ASTEROID || grant.amount <= 0 || ctx.card !== this) {
      return [];
    }
    if (grant.target !== 'self' && !this.soleHolder(cardOwner)) {
      return [];
    }
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'resource-added'),
      [actionPreviews.stockGain(cardOwner, Resource.TITANIUM, grant.amount)],
      'An asteroid lands here')];
  }

  /** This card is the owner's ONLY asteroid holder — «any card» can only mean this one. */
  private soleHolder(owner: IPlayer): boolean {
    const holders = owner.getResourceCards(CardResource.ASTEROID);
    return holders.length === 1 && holders[0] === this;
  }

  /** Rule 2 — the bill the affordability question asks: the price on top of any price held back before it. */
  private billOptions(canAffordOptions?: CanAffordOptions): CanAffordOptions {
    return {...canAffordOptions, cost: (canAffordOptions?.cost ?? 0) + MAIN_BELT_ASTEROIDS_PRICE};
  }

  public override bespokeCanPlay(player: IPlayer, canAffordOptions: CanAffordOptions) {
    return player.canAfford(this.billOptions(canAffordOptions));
  }

  public unplayableReason(player: IPlayer): UnplayableReason | undefined {
    return actionReason.needMoreMCFor(player, this.billOptions());
  }

  /** Rule 1 — the price chip and the payment step the server will ask (Helion / LTF), addressed by its cause. */
  public cardPlayPreview(player: IPlayer): ActionPreview {
    return actionPreviews.playPreview(this, player,
      [actionPreviews.stockCost(player, Resource.MEGACREDITS, MAIN_BELT_ASTEROIDS_PRICE)],
      [actionPreviews.paymentStep(player, MAIN_BELT_ASTEROIDS_PRICE, {cause: cardSource(this)})]);
  }

  public override bespokePlay(player: IPlayer) {
    player.game.defer(new SelectPaymentDeferred(player, MAIN_BELT_ASTEROIDS_PRICE, {cause: cardSource(this)}));
    return undefined;
  }
}
