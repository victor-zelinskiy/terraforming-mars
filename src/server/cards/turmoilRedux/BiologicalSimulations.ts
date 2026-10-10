import {ICard, IActionCard} from '../ICard';
import {IPlayer} from '../../IPlayer';
import {Tag} from '../../../common/cards/Tag';
import {CardType} from '../../../common/cards/CardType';
import {CardResource} from '../../../common/CardResource';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {ActionCard} from '../ActionCard';
import {EffectForecastFact} from '../../../common/models/EffectForecastModel';
import * as actionPreviews from '../actionPreviews';
import * as forecast from '../effectForecastPreviews';

/** The printed «add 2 data resources to this card» of the play. */
export const DATA_ON_PLAY = 2;
/** The printed effect — 1 data per microbe or animal tag the owner plays. */
export const DATA_PER_TAG = 1;
/** The printed action — 2 data from here buy one step of plant production. */
export const DATA_PER_ACTION = 2;
/** The tags the effect listens to — EXACTLY these two, each counted by itself. */
export const BIO_TAGS: ReadonlyArray<Tag> = [Tag.MICROBE, Tag.ANIMAL];

/**
 * TR38 — BIOLOGICAL SIMULATIONS («Биологические симуляции»), a Turmoil Redux
 * PROJECT card: the set's FIRST plate of the GREENS, a data holder with a
 * tag trigger (the TR05 class on two tags) and the set's first action that
 * buys PRODUCTION with a stored resource — the one the Greens' own passive
 * answers.
 *
 * «Requires the Greens to be ruling or that you have 2 delegates there. Add
 * 2 data resources to this card. Effect: After you play a microbe or animal
 * tag, add 1 data resource to this card. Action: Spend 2 data from here to
 * increase your plant production 1 step.» Cost 7, blue, Science + Plant, no VP.
 *
 * Everything the card does is a class that already stands: the play is a
 * declarative `addResources` (a fixed self-target — the one exception to «no
 * auto-select»), the trigger is `onCardPlayed` → `cardTagCount` (Decomposers,
 * TR05) with its forecast twin, the action is `{spend: {resourcesHere},
 * production}` (Deuterium Export, Local Shading), and the Greens' answer to the
 * plant-production step is the Parliament's own `onProductionChanged` hook plus
 * the `greens-production` forecast fact — none of it lives here.
 *
 * SCAN READING — cost 7, blue (ACTIVE); two tags in the corner: the atom on
 * white (Science) and the leaf on green (Plant). The orange MIN box beside the
 * cost holds the GREENS' emblem — a REQUIREMENT (`{party: GREENS}`), never a
 * tag; the Redux plates before this one were Mars First, Unity and the Reds
 * (TR30–TR37) — this is the Greens' first. The effect row prints «[microbe] OR
 * [animal] : [data]»; the action row prints TWO data icons, not a digit
 * («[data] [data] → [plant production]»); the bottom block prints two data
 * icons again — the play's own two. No VP badge. Only the module's icon at the
 * bottom left (no ▲, no Venus icon): no `compatibility` — for a card of THIS
 * manifest the political engine is the module itself. Printed lore: «Early
 * versions of the algorithm kept evolving stuff into crabs for some reason?»
 * (`lore_texts.json` «TR38» — the question mark is the scan's).
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/BiologicalSimulations.spec.ts):
 *  1. The REQUIREMENT is the Greens' plate — the Greens rule (the STARTING
 *     RULE counts: with nothing enacted the Greens rule in generation 1, so the
 *     card is playable with no delegate anywhere), or 2 of the player's OWN
 *     delegates on their resolution — checked at the PLAY only (the TR15 class:
 *     the emblem in the MIN plate, the hand's «N of 2»). TR36 Council Seat
 *     lowers the EFFECT's threshold, never a REQUIREMENT's (FAQ p.19).
 *  2. The PLAY puts 2 data on THIS card (`behavior: {addResources: 2}`) and
 *     nothing else; the card's own Science and Plant tags are not microbe or
 *     animal tags, so its own play adds nothing through the effect.
 *  3. The TRIGGER counts BY TAG: every microbe or animal tag of a card the
 *     OWNER plays pays 1 data — a card with a microbe AND an animal tag pays 2,
 *     two microbe tags pay 2, a played EVENT's printed tags count (a play is a
 *     play), a WILD tag never counts (`cardTagCount` — Decomposers' reading),
 *     an opponent's play pays nothing (`onCardPlayed`, not «by any player»).
 *     The card is in `playedCards` before the fan-out, so the order is the
 *     engine's: the play, then every reactor under `withEffect(…, 'card-played')`.
 *  4. A microbe or animal tag NOT from a card does not exist in the engine
 *     (Leavitt gives Science, the Underworld Science / Plant, Delta a Jovian)
 *     — so no `onNonCardTagAdded` is declared; a future source would fail the
 *     forecast parity, not this card.
 *  5. The Scientists' WILD tag is a tag you HAVE, not one you PLAY: the trigger
 *     never sees it.
 *  6. The ACTION is declarative: `spend.resourcesHere: 2` + `production.plants:
 *     1`; below 2 data the automatic reason is «Not enough resources on this
 *     card»; one use per generation like every action.
 *  7. The plant-production step is an ORDINARY production gain: with the
 *     Greens' effect at the moment of the ACTION (ruling, 2 delegates, TR36's
 *     «1 delegate») the Parliament raises M€ production by the applied delta
 *     (`PartyEffects` → `onProductionChanged`); without it, nothing. The
 *     action's forecast names «+1 M€ production · the Greens» before the press
 *     (`partyFacts` → `greens-production`).
 *  8. The card's OWN tags wake its neighbours: Science — TR05 (+2 data),
 *     Olympus Conference, Mars University; Plant — Decomposers (+1 microbe),
 *     Viral Enhancers, Ecological Zone.
 *  9. Data here are ORDINARY data: the Scientists' action (2), TR01 (4), RX18,
 *     TR21, the Pluto Redux trade (this card opens its data positions) and the
 *     DATA space bonus all land here; data are never a payment unit, never VP.
 * 10. Save / load: the data count and the action's once-per-generation flag
 *     serialize as on every action card.
 * 11. MarsBot never plays it (the bot's deck is tags); the trigger counts only
 *     the OWNER's plays, never the bot's tags.
 * 12. THE JOURNAL: the trigger logs one line under the card's effect scope
 *     («added 1 data to Biological Simulations»); the action logs the spend,
 *     then the plant-production step, then the Greens' answer as ITS line.
 *
 * NOT IMPLEMENTED (the engine's gap, not this card's): the Dataminer milestone
 * («7 data on your cards», rulebook p.16–17) — like Aeronaut (TR28).
 */
export class BiologicalSimulations extends ActionCard implements IActionCard {
  constructor() {
    super({
      name: CardName.BIOLOGICAL_SIMULATIONS,
      type: CardType.ACTIVE,
      tags: [Tag.SCIENCE, Tag.PLANT],
      cost: 7,
      requirements: {party: PartyName.GREENS},
      resourceType: CardResource.DATA,

      behavior: {
        addResources: DATA_ON_PLAY,
      },

      action: {
        spend: {resourcesHere: DATA_PER_ACTION},
        production: {plants: 1},
      },

      metadata: {
        cardNumber: 'TR38',
        infoText: [
          {kind: 'effect-short', text: 'Microbe or animal tag: +1 data here'},
          {kind: 'action-short', text: 'Spend 2 data for 1 plant production'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.effect('After you play a microbe or animal tag, add 1 data resource to this card.', (eb) => {
            eb.tag(Tag.MICROBE).or().tag(Tag.ANIMAL).startEffect.resource(CardResource.DATA);
          }).br;
          b.action('Spend 2 data from here to increase your plant production 1 step.', (eb) => {
            eb.resource(CardResource.DATA, DATA_PER_ACTION).startAction.production((pb) => pb.plants(1));
          }).br;
          b.resource(CardResource.DATA, DATA_ON_PLAY);
        }),
        description: 'Requires the Greens to be ruling or that you have 2 delegates there. Add 2 data resources to this card.',
      },
    });
  }

  /** Rule 3: 1 data per microbe or animal tag of the owner's played card, at once, through the recorder. */
  public onCardPlayed(player: IPlayer, card: ICard): void {
    const tags = player.tags.cardTagCount(card, [...BIO_TAGS]);
    if (tags > 0) {
      player.addResourceTo(this, {qty: DATA_PER_TAG * tags, log: true});
    }
  }

  /**
   * Mirrors `onCardPlayed`: an EXACT, immediate gain — 1 data per microbe or
   * animal tag of the played card, read by the SAME `cardTagCount`. Nothing is
   * asked, nothing deferred. The reason's tag is the one that fires (the
   * microbe when both do — the icon beside the sentence, never the text).
   */
  public cardPlayedForecast(cardOwner: IPlayer, _activePlayer: IPlayer, card: ICard): ReadonlyArray<EffectForecastFact> {
    const tags = cardOwner.tags.cardTagCount(card, [...BIO_TAGS]);
    if (tags === 0) {
      return [];
    }
    const reasonTag = BIO_TAGS.find((tag) => cardOwner.tags.cardTagCount(card, tag) > 0) ?? Tag.MICROBE;
    return [forecast.exact(forecast.sourceOf(this, cardOwner, 'card-played'),
      [actionPreviews.cardGain(this, DATA_PER_TAG * tags)],
      'You play a card with a microbe or animal tag',
      {id: 'bio-tags', reasonTag})];
  }
}
