import {ActiveCorporationCard} from '../corporation/CorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {digit} from '../Options';
import {IPlayer} from '../../IPlayer';
import {Resource} from '../../../common/Resource';
import {ICard} from '../ICard';
import {Size} from '../../../common/cards/render/Size';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «Gain 1 titanium» — the effect's titanium per space event. */
export const PALLADIN_TITANIUM_PER_SPACE_EVENT = 1;
/** «Spend 2 titanium» — the action's price, in UNITS (never M€). */
export const PALLADIN_ACTION_TITANIUM = 2;

/**
 * PC02 — PALLADIN SHIPPING, the second corporation of Prelude 2 (upstream `cardNumber: 'PC02'` «// Renumber» — kept:
 * the art and the lore are keyed by it).
 *
 * SCAN READING — the CORPORATION frame; the Space tag; the word mark — a yellow lens with «PALLADIN SHIPPING» in grey
 * capitals; «36» M€ and «5 [titanium]» (a digit beside ONE icon) — «(You start with 36 M€. Gain 5 titanium.)». The
 * EFFECT/ACTION box, two rows: «[space] [event — the yellow disc with the down arrow] : [titanium]» and
 * «[titanium] [titanium] → [temperature]» — «(Effect: When you play a space event, gain 1 titanium. Action: Spend 2
 * titanium to raise temperature 1 step.)». The Prelude 2 mark at the left; no number printed on the scan. ⚠ The yellow
 * disc with the arrow is the EVENT TAG, never «discard».
 *
 * RULE READINGS (pinned by tests/cards/prelude2/PalladinShipping.spec.ts):
 *  1. START: 36 M€ and 5 titanium; the Space tag (counted wherever a corporation's tags count; the corporation is not
 *     an event and never wakes its own effect).
 *  2. «A SPACE EVENT» = type EVENT AND the printed Space tag (`card.tags`) — ONE predicate, `answersTo`, read by the
 *     live hook and its forecast twin alike. A space card that is not an event — no; an event without the Space tag —
 *     no. A counted «any tag» (the Redux Scientists' effect) never makes an event a space one.
 *  3. «WHEN YOU PLAY»: the owner's own plays only, by any road that puts the card down through `playCard`. A rival's
 *     event, a bot flip — no.
 *  4. THE TITANIUM COMES AFTER THE PAYMENT — it cannot pay for the event that produced it. One titanium per card,
 *     whatever its tags. The hook pays SYNCHRONOUSLY (the upstream table calls it directly) inside the dispatcher's
 *     `events.withEffect(…, 'card-played')` scope; `from: {card: this}` names the corporation on the journal line
 *     (the scope alone already names it on the record — probe 2026-11-05).
 *  5. THE ACTION is declarative — `{spend: {titanium: 2}, global: {temperature: 1}}`: unavailable below 2 titanium
 *     with the engine's own reason; once per generation, as every card action. The price is two UNITS of the resource,
 *     never M€: the titanium's value (Phobolog, Advanced Alloys, RX19) does not change it. The step is a rating step
 *     by the engine's general rule (TR, the track's bonuses, the 0 °C ocean — the player's own placement).
 *  6. AT THE TEMPERATURE MAXIMUM the action stays legal and gives nothing — the fork's «action without effect» (shown
 *     dimmed, activatable, the reason before the press); under RX35 it is judged by the replacement. Never blocked.
 *  7. THE CLASSIC REDS — by the upstream spec. Redux: whatever the table's politics does to the step's rating (RX42
 *     veto, RX35 replacement, P57 skip), the action reads it through the shared doors — the spec names each.
 *  8. MARSBOT: the human Palladin and the bot twin C43 never meet on one table (the collision by `original`); the twin
 *     is untouched. A second corporation (Merger): the effect and the action from the moment it is played.
 */
export class PalladinShipping extends ActiveCorporationCard {
  constructor() {
    super({
      name: CardName.PALLADIN_SHIPPING,
      tags: [Tag.SPACE],
      startingMegaCredits: 36,

      behavior: {
        stock: {titanium: 5},
      },

      action: {
        spend: {titanium: PALLADIN_ACTION_TITANIUM},
        global: {temperature: 1},
      },

      metadata: {
        cardNumber: 'PC02', // Renumber
        infoText: [{kind: 'effect-short', text: 'Space event played: gain 1 titanium'}],
        renderData: CardRenderer.builder((b) => {
          b.megacredits(36).titanium(5, {digit});
          b.corpBox('effect-action', (cea) => {
            cea.vSpace(Size.LARGE);
            cea.effect('When you play a space event, gain 1 titanium.', (eb) => {
              eb.tag(Tag.SPACE).tag(Tag.EVENT).startEffect.titanium(PALLADIN_TITANIUM_PER_SPACE_EVENT);
            });
            cea.vSpace();
            cea.action('Spend 2 titanium to raise the temperature 1 step.', (ab) => {
              ab.titanium(PALLADIN_ACTION_TITANIUM).startAction.temperature(1);
            });
          });
        }),
        description: 'You start with 36 M€. Gain 5 titanium.',
      },
    });
  }

  /** Rule 2 — THE class, read by the live hook and its forecast twin alike. */
  public static answersTo(card: ICard): boolean {
    return card.type === CardType.EVENT && card.tags.includes(Tag.SPACE);
  }

  /** Rule 4 — the titanium, synchronously, after the payment, under this card's effect scope. */
  public onCardPlayed(player: IPlayer, card: ICard) {
    if (PalladinShipping.answersTo(card)) {
      player.stock.add(Resource.TITANIUM, PALLADIN_TITANIUM_PER_SPACE_EVENT, {log: true, from: {card: this}});
    }
  }

  /**
   * Mirrors `onCardPlayed` (Optimal Aerobraking's twin, reason keys shared): a SPACE EVENT pays 1 titanium at once,
   * on printed effect block #0. The two «almost» cases are `no` facts — the tag matched, the condition did not.
   */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const source = {...forecast.sourceOf(this, cardOwner, 'card-played'), printedEffect: 0};
    if (PalladinShipping.answersTo(card)) {
      return [forecast.exact(source,
        [actionPreviews.stockGain(cardOwner, Resource.TITANIUM, PALLADIN_TITANIUM_PER_SPACE_EVENT)],
        'You play a space event', {reasonTag: Tag.SPACE})];
    }
    if (card.tags.includes(Tag.SPACE)) {
      return [forecast.no(source, 'The card is not an event', {reasonTag: Tag.SPACE})];
    }
    if (card.type === CardType.EVENT) {
      return [forecast.no(source, 'The event has no space tag', {reasonTag: Tag.SPACE})];
    }
    return [];
  }
}
