import {CorporationCard} from '../corporation/CorporationCard';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Tag} from '../../../common/cards/Tag';
import {IPlayer} from '../../IPlayer';
import {ICard} from '../ICard';
import {CardResource} from '../../../common/CardResource';
import {Resource} from '../../../common/Resource';
import {OrOptions} from '../../inputs/OrOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {chip} from '../../inputs/optionMetadata';
import {cardEffect, cardSource} from '../../inputs/choiceContext';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «A bio tag» — the printed causes, in the scan's order (microbe / plant / animal). */
export const ECOTEC_BIO_TAGS: ReadonlyArray<Tag> = [Tag.MICROBE, Tag.PLANT, Tag.ANIMAL];

/**
 * PC04 — ECOTEC, the third corporation of Prelude 2 to cross (upstream `cardNumber: 'PC04'` «// Renumber» — kept: the
 * art and the lore are keyed by it). The first corporation of the set whose effect is a DECISION of the player.
 *
 * SCAN READING — the CORPORATION frame; the Microbe and Plant tags; the word mark «ECOTEC» on a plate of a green and a
 * yellow half; «42» M€ and a production box with ONE plant — «(You start with 42 M€. Increase your plant production 1
 * step.)». The EFFECT box, one row: «[microbe] / [plant] / [animal] : [plant] OR [microbe]*» — the three causes joined
 * by SLASHES (any one of them), the outcome by the printed word «OR», the star «to ANY card» — «(Effect: When playing a
 * bio tag, including these 2, gain 1 plant or add 1 microbe to ANY card.)». The Prelude 2 mark at the left; no number
 * printed on the scan.
 *
 * RULE READINGS (pinned by tests/cards/prelude2/Ecotec.spec.ts):
 *  1. START: 42 M€, plant production +1; the Microbe and Plant tags. «INCLUDING THESE 2» comes BY CONSTRUCTION: the
 *     corporation stands in `playedCards` before its own `onCardPlayed` walks the tableau, so its two bio tags owe two
 *     answers — at the start nobody holds microbes, so +2 plants.
 *  2. «A BIO TAG» = a PRINTED Microbe, Plant or Animal tag of the played card (`cardTagCount` — the wild tag is not
 *     counted). One answer PER TAG: a card with two owes two, with three owes three. An event's bio tag counts.
 *  3. «WHEN YOU PLAY»: the owner's own plays only, by any road through `playCard`; a rival's card or a bot flip — no.
 *  4. EVERY ANSWER IS ITS OWN DECISION: 1 plant OR 1 microbe on ANY own card that can hold microbes (the played card
 *     included when it holds them). The answers of one play are independent — two plants and a microbe, three microbes
 *     on one card, anything.
 *  5. NO HOLDER — NO QUESTION: the plants come at once, synchronously and in one write (the branch is one, no target
 *     is hidden). A HOLDER — the question is ALWAYS asked, a single candidate included (`autoSelect: false`, the «ANY
 *     card» law); the holders are read AT THE QUESTION, through the shared step's ONE predicate (`getCards()`).
 *  6. A bare Plant tag (`onNonCardTagAdded`) is one answer by the same rule (nothing in scope adds one today).
 *  7. MARSBOT: the human Ecotec and the bot twin C40 never meet on one table (the collision by `original`); the twin is
 *     untouched. A second corporation (Merger): the effect from the moment it is played — its own two tags ask twice
 *     when a holder already stands on the table.
 */
export class Ecotec extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.ECOTEC,
      tags: [Tag.MICROBE, Tag.PLANT],
      startingMegaCredits: 42,

      behavior: {
        production: {plants: 1},
      },

      metadata: {
        cardNumber: 'PC04', // Renumber
        infoText: [{kind: 'effect-short', text: 'Bio tag: a plant or a microbe to any card'}],
        renderData: CardRenderer.builder((b) => {
          b.br.br;
          b.megacredits(42).nbsp.production((pb) => pb.plants(1));
          b.corpBox('effect', (ce) => {
            ce.effect('When you play a bio tag, including these 2, gain 1 plant or add 1 microbe to ANY card.', (eb) => {
              eb.tag(Tag.MICROBE).slash().tag(Tag.PLANT).slash().tag(Tag.ANIMAL).startEffect;
              eb.plants(1).or().resource(CardResource.MICROBE).asterix();
            });
          });
        }),
        description: 'You start with 42 M€. Increase your plant production 1 step.',
      },
    });
  }

  /** Rule 2 — the answers a play owes: one per printed bio tag. */
  private bioTags(player: IPlayer, card: ICard): number {
    return player.tags.cardTagCount(card, [...ECOTEC_BIO_TAGS]);
  }

  /**
   * THE ONE STEP of the microbe branch — the shared «resource on ANY card» pick (rule 5): its `getCards()` is the ONE
   * answer to «who can hold a microbe», read by the hook, the live question and the forecast alike; `cardBeingPlayed`
   * only before the play (the forecast — the live card already stands on the table).
   */
  private microbeStep(player: IPlayer, cardBeingPlayed?: ICard): AddResourcesToCard {
    return new AddResourcesToCard(player, CardResource.MICROBE, {
      count: 1,
      autoSelect: false,
      cause: cardSource(this),
      from: {card: this},
      log: true,
      ...(cardBeingPlayed !== undefined ? {cardBeingPlayed} : {}),
    });
  }

  /** Rule 5 — is there anyone to ask about? The ONE predicate of the hook and its forecast twin. */
  private hasHolder(player: IPlayer, cardBeingPlayed?: ICard): boolean {
    return this.microbeStep(player, cardBeingPlayed).getCards().length > 0;
  }

  /** The plants of the effect — one write, the corporation named on the line. */
  private gainPlants(player: IPlayer, count: number): void {
    player.stock.add(Resource.PLANTS, count, {log: true, from: {card: this}});
  }

  /**
   * THE QUESTION one bio tag asks — ONE builder, read by the live defer and by the forecast's PRE-COLLECTED step (TR51,
   * `forecast.tableQuestion`). The upstream order: ① the pick «which card takes the microbe» — the shared step's own
   * applied pick (marker, readings, record), ② «Gain plant».
   */
  private question(player: IPlayer, cardBeingPlayed?: ICard): OrOptions {
    return new OrOptions(
      this.microbeStep(player, cardBeingPlayed).appliedPick(),
      new SelectOption('Gain plant')
        .withMetadata({kind: 'resourceGain', effects: [chip('gain', 'plants', 1)]})
        .andThen(() => {
          this.gainPlants(player, 1);
          return undefined;
        }),
    ).markChoiceContext(cardEffect(this, 'You played a plant, microbe, or animal tag.', 'effect-choice'));
  }

  /** Rules 4 · 5 — `count` answers: plants at once without a holder, else a question per answer. */
  private process(player: IPlayer, count: number): void {
    if (count === 0) {
      return;
    }
    if (!this.hasHolder(player)) {
      this.gainPlants(player, count);
      return;
    }
    for (let i = 0; i < count; i++) {
      // The holders are read when the question stands, never snapshotted at the play.
      player.defer(() => {
        if (this.hasHolder(player)) {
          return this.question(player);
        }
        this.gainPlants(player, 1);
        return undefined;
      });
    }
  }

  public onCardPlayed(player: IPlayer, card: ICard) {
    this.process(player, this.bioTags(player, card));
    return undefined;
  }

  /** Rule 6. */
  public onNonCardTagAdded(player: IPlayer, tag: Tag): void {
    if (tag === Tag.PLANT) {
      this.process(player, 1);
    }
  }

  /**
   * Mirrors `onCardPlayed` (rules 2 · 5): no holder — the plants, exact; a holder — the question PER TAG, its answer
   * pre-collected in the composer from the SAME builder. The played card counts as a holder (`cardBeingPlayed`): a card
   * that holds microbes itself turns the promise into a question already here, never a plant promised and a question
   * asked after the press.
   */
  public cardPlayedForecast(cardOwner: IPlayer, activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const count = this.bioTags(cardOwner, card);
    if (count === 0) {
      return [];
    }
    const source = {...forecast.sourceOf(this, cardOwner, 'card-played'), printedEffect: 0};
    const reason = 'You play a card with an animal, plant or microbe tag';
    if (!this.hasHolder(cardOwner, card)) {
      return [forecast.exact(source, [actionPreviews.stockGain(cardOwner, Resource.PLANTS, count)], reason)];
    }
    const facts: Array<EffectForecastFact> = [];
    for (let i = 0; i < count; i++) {
      facts.push(forecast.asks(source,
        [actionPreviews.cardResourceGain(CardResource.MICROBE, 1)],
        [{label: 'Gain plant', effects: [actionPreviews.stockGain(cardOwner, Resource.PLANTS, 1)]}],
        // TR51 — every tag's question is independent of the others (Viral Enhancers): each is answered in the composer.
        reason, {
          id: `tag-${i}`, ...forecast.AFTER_CARD,
          ...(cardOwner === activePlayer ? {preselect: forecast.tableQuestion(this, cardOwner, this.question(cardOwner, card))} : {}),
        }));
    }
    return facts;
  }
}
