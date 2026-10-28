import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {ActionEffect} from '../../../common/models/ActionPreviewModel';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import {IPlayer} from '../../IPlayer';
import {AddResourcesToCard} from '../../deferredActions/AddResourcesToCard';
import {cardSource} from '../../inputs/choiceContext';
import {ICard} from '../ICard';
import {PreludeCard} from '../prelude/PreludeCard';
import {CardRenderer} from '../render/CardRenderer';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** «Add 1 microbe or data resource to ANY card» — the printed kinds, in print order. */
export const MEDICAL_INSTITUTE_KINDS: ReadonlyArray<CardResource> = [CardResource.MICROBE, CardResource.DATA];

/** One unit per Science tag. */
export const MEDICAL_INSTITUTE_PER_TAG = 1;

/**
 * TRP9 — MEDICAL INSTITUTE («Медицинский институт»), the ninth Turmoil Redux PRELUDE and the set's FIRST PRELUDE-REACTOR:
 * a card that answers a tag after it lies on the table, its own play included. Its own art and printed lore, both keyed
 * TRP9 («Medical science has made so much progress that the world no longer has any healthy people.» — «Chris Caldow»
 * on the art's edge is the artist's credit, not the face).
 *
 * SCAN READING — the magenta PRELUDE plate; TWO tags in the corner, MICROBE (the green disc) and SCIENCE (the atom); no
 * cost, no requirement, no VP. The bottom field, left to right: a card back («draw a card») · ONE effect frame
 * «[science] : [microbe]* OR [data]*», each star the printed «to ANY card». The parenthesised text is the rule: «(Draw a
 * card. Effect: After you play a Science tag (including this), add 1 microbe or data resource to ANY card.)». The purple
 * diamond at the left edge is the module itself; a Prelude is dealt only beside the Prelude expansion
 * (`compatibility: 'prelude'` — TRP1 / TRP8). The rulebook v1.0 and its FAQ say nothing about the card.
 *
 * NOTHING NEW IS BUILT — three existing engines, one card:
 *  · the draw is a plain declaration (`drawCard: 1` — one batch, «одно действие — один забор»);
 *  · the effect is the tag-reactor form of Olympus Conference / Mars University (`onCardPlayed` → `cardTagCount(card,
 *    SCIENCE)`; one deferred step per tag), with its twin `cardPlayedForecast` reading the SAME builder (`whereStep`);
 *  · the step is the shared pick over a LIST of kinds (RX18 / TRP8 — `AddResourcesToCard` over `[MICROBE, DATA]`): ONE
 *    `SelectCard` over the union of the holders, the unit's kind the CHOSEN card's, never «microbe or data?» first.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/MedicalInstitute.spec.ts):
 *  1. Printed: a PRELUDE, Microbe + Science, `drawCard: 1`, `compatibility: 'prelude'`.
 *  2. «INCLUDING THIS» comes BY CONSTRUCTION: `playCard` lays the card into `playedCards` before `onCardPlayed` walks
 *     the tableau, so the prelude's own play finds the prelude and its one Science tag owes the first unit. The draw is
 *     deferred at `DRAW_CARDS`, the pick at `GAIN_RESOURCE_OR_PRODUCTION`: the card is taken first, then «where?».
 *  3. «A SCIENCE TAG» — PER TAG (the reading of the sisters Olympus Conference / Mars University): a card with two
 *     Science tags owes two units, two independent picks; an event's Science tag counts; a rival's play never does
 *     (`onCardPlayed` walks the OWNER's tableau); MarsBot is never dealt a Prelude. `onNonCardTagAdded(SCIENCE)` answers
 *     as Olympus does (parity with the sister; nothing in scope adds a bare Science tag today).
 *  4. The pick is ALWAYS asked — even with one candidate (`autoSelect: false`, the «ANY card» law); the composer seeds
 *     a sole candidate shown and marked (T14), the server still asks. Own cards only (`getResourceCards`).
 *  5. No holder of either kind is a NAMED skip (the shared step's `recordSkippedEffect` — «No eligible card»), the
 *     forecast states the same loss with the same label before the press; the prelude itself is always playable.
 *  6. The preview IS the execution: one fact per Science tag on the effect frame (`printedEffect: 0`, `reasonTag:
 *     SCIENCE`), each carrying the live step's own pick (`preselect` — `tableQuestion` over `whereStep(…, playedCard)`):
 *     the card being played is a candidate when it holds microbes or data (`cardBeingPlayed` — the live set, the card
 *     already on the table, matches the preview's).
 *  7. The card holds nothing (no `resourceType`); nothing to serialize beyond the card on the table.
 */
export class MedicalInstitute extends PreludeCard {
  constructor() {
    super({
      name: CardName.MEDICAL_INSTITUTE,
      tags: [Tag.MICROBE, Tag.SCIENCE],

      behavior: {
        drawCard: 1,
      },

      metadata: {
        cardNumber: 'TRP9',
        infoText: [
          // The printed rule runs past the caption clamp in RU.
          {kind: 'effect-short', text: 'Science tag: a microbe or data to any card', tokens: ['tag-science', 'res-microbe', 'res-data']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.cards(1).nbsp.effect('After you play a Science tag (including this), add 1 microbe or data resource to ANY card.', (eb) => {
            eb.tag(Tag.SCIENCE).startEffect.resource(CardResource.MICROBE).asterix().or().resource(CardResource.DATA).asterix();
          });
        }),
        description: 'Draw 1 card.',
      },
    });
  }

  /** Rules 2 · 3 — one pick per Science tag of the played card (this one's own included). */
  public onCardPlayed(player: IPlayer, card: ICard): void {
    const scienceTags = player.tags.cardTagCount(card, Tag.SCIENCE);
    for (let i = 0; i < scienceTags; i++) {
      player.game.defer(this.whereStep(player));
    }
  }

  /** Rule 3 — a bare Science tag answers as one played (Olympus Conference's parity). */
  public onNonCardTagAdded(player: IPlayer, tag: Tag): void {
    if (tag === Tag.SCIENCE) {
      player.game.defer(this.whereStep(player));
    }
  }

  /**
   * Rule 6 — the mirror: per Science tag ONE fact on the effect frame, its pick PRE-COLLECTED from the same builder the
   * live hook defers (the played card counted as a holder); no holder → the live step's own named loss.
   */
  public cardPlayedForecast(cardOwner: IPlayer, activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const scienceTags = cardOwner.tags.cardTagCount(card, Tag.SCIENCE);
    if (scienceTags === 0) {
      return [];
    }
    const source = {...forecast.sourceOf(this, cardOwner, 'card-played'), printedEffect: 0};
    const chip = MedicalInstitute.unitChip();
    const facts: Array<EffectForecastFact> = [];
    for (let i = 0; i < scienceTags; i++) {
      const prompt = this.whereStep(cardOwner, card).previewPick();
      if (prompt === undefined) {
        facts.push(forecast.skipped(source, [chip], actionPreviews.SKIP_REASON.noHolder, {id: `science-${i}`, reasonTag: Tag.SCIENCE}));
        continue;
      }
      // TR51 — every tag's pick is independent of the others (ViralEnhancers): each one is answered in the composer.
      facts.push(forecast.asks(source, [chip], [], forecast.tagReason(Tag.SCIENCE), {
        id: `science-${i}`,
        reasonTag: Tag.SCIENCE,
        ...forecast.AFTER_CARD_GAIN,
        ...(cardOwner === activePlayer ? {preselect: forecast.tableQuestion(this, cardOwner, prompt)} : {}),
      }));
    }
    return facts;
  }

  /** THE ONE STEP — read by the live defer and by the forecast (`cardBeingPlayed` only before the play). */
  private whereStep(player: IPlayer, cardBeingPlayed?: ICard): AddResourcesToCard {
    return new AddResourcesToCard(player, MEDICAL_INSTITUTE_KINDS, {
      count: MEDICAL_INSTITUTE_PER_TAG,
      autoSelect: false,
      cause: cardSource(this),
      ...(cardBeingPlayed !== undefined ? {cardBeingPlayed} : {}),
    });
  }

  /** «+1 [microbe] / [data] to a card» — the two kinds as one chip (TRP8's `icons`). */
  private static unitChip(): ActionEffect {
    return {
      direction: 'gain',
      icon: 'resources',
      icons: MEDICAL_INSTITUTE_KINDS.map(actionPreviews.cardResourceIcon),
      amount: MEDICAL_INSTITUTE_PER_TAG,
      note: 'to a card',
    };
  }
}
