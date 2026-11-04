import {ICard} from '../ICard';
import {Tag} from '../../../common/cards/Tag';
import {PreludeCard} from '../prelude/PreludeCard';
import {CardName} from '../../../common/cards/CardName';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {CardRenderer} from '../render/CardRenderer';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** The tags the effect answers — read by the live hook and its forecast twin alike. */
const SOIL_BACTERIA_TAGS = [Tag.PLANT, Tag.MICROBE];

/**
 * P61 — SOIL BACTERIA: draw 2 microbe cards (a named search) and gain 3 plants; «when playing a plant tag or a microbe
 * tag, including this, gain 1 plant». RULE READINGS (pinned by tests/cards/prelude2/SoilBacteria.spec.ts):
 *  1. ONE count — `tagsOf` (per tag: a card with a plant AND a microbe tag owes 2), read by `onCardPlayed` and by
 *     `cardPlayedForecast`, so the promise and the payout cannot diverge.
 *  2. «INCLUDING THIS» comes by construction: `playCard` lays the prelude into `playedCards` before the fan-out, so
 *     its own Microbe tag owes the first plant (TRP9 Medical Institute's reading).
 *  3. The plant is paid SYNCHRONOUSLY with the card as its source (`from: {card: this}` — Decomposers / Viral
 *     Enhancers): inside the hook's `card-played` scope (the reaction record, cause = the played card) and named in
 *     the log line («… because of Soil Bacteria»). Upstream deferred it through `player.defer` with no source.
 *  4. `onNonCardTagAdded(PLANT)` answers as one played tag; nothing in the premium scope adds a bare Plant tag today
 *     (only Underworld does) — kept for parity, pinned by its spec.
 */
export class SoilBacteria extends PreludeCard {
  constructor() {
    super({
      name: CardName.SOIL_BACTERIA,
      tags: [Tag.MICROBE],

      behavior: {
        stock: {plants: 3},
        drawCard: {count: 2, tag: Tag.MICROBE},
      },

      metadata: {
        description: 'Draw 2 microbe cards and gain 3 plants.',
        cardNumber: 'P61',
        infoText: [
          // The printed rule runs past the caption clamp.
          {kind: 'effect-short', text: 'Each plant or microbe tag: gain 1 plant'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.effect('When playing a plant tag or a microbe tag, including this, gain 1 plant.', (eb) => {
            eb.tag(Tag.PLANT).slash().tag(Tag.MICROBE).startEffect.plants(1);
          });
          b.br;
          b.cards(2, {secondaryTag: Tag.MICROBE}).plants(3);
        }),
      },
    });
  }

  /** Rule 1 — THE count. */
  private static tagsOf(player: IPlayer, card: ICard): number {
    return player.tags.cardTagCount(card, SOIL_BACTERIA_TAGS);
  }

  /** Rule 3 — one plant per tag, at once, the card as the source. */
  private gainPlants(player: IPlayer, count: number): void {
    player.stock.add(Resource.PLANTS, count, {log: true, from: {card: this}});
  }

  /** Rule 4 — a bare Plant tag answers as one played. */
  public onNonCardTagAdded(player: IPlayer, tag: Tag): void {
    if (tag === Tag.PLANT) {
      this.gainPlants(player, 1);
    }
  }

  /** Rules 1 · 2 · 3. */
  public onCardPlayed(player: IPlayer, card: ICard): void {
    const amount = SoilBacteria.tagsOf(player, card);
    if (amount > 0) {
      this.gainPlants(player, amount);
    }
  }

  /** The mirror: the same count, one exact fact on the effect row (one «+N» for a card with both tags). */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const amount = SoilBacteria.tagsOf(cardOwner, card);
    if (amount === 0) {
      return [];
    }
    return [forecast.exact(
      {...forecast.sourceOf(this, cardOwner, 'card-played'), printedEffect: 0},
      [actionPreviews.stockGain(cardOwner, Resource.PLANTS, amount)],
      'You play a card with a plant or microbe tag')];
  }
}
