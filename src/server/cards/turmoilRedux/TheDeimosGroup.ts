import {Tag} from '../../../common/cards/Tag';
import {CardName} from '../../../common/cards/CardName';
import {CorporationCard} from '../corporation/CorporationCard';
import {ICorporationCard} from '../corporation/ICorporationCard';
import {CardRenderer} from '../render/CardRenderer';

/** «You have +2 influence» — one entry of the Parliament's influence ledger, named after the corporation. */
export const DEIMOS_INFLUENCE_BONUS = 2;
/** «As your first action, add a delegate to any resolution». */
export const DEIMOS_FIRST_ACTION_DELEGATES = 1;

/**
 * TR83 — THE DEIMOS GROUP («The Deimos Group»), the SIXTH of the eight NEW corporations of Turmoil Redux (not a
 * replacement — `common/cards/turmoilReduxCorporations.ts`, numbered TR83 by the order of the scan folder). Its own
 * art and its own printed lore, both keyed TR83; no `reimplements`.
 *
 * SCAN READING — the Mars tag (the red planet) in the corner; «50» + a WHITE delegate figure — «You start with 50 M€.
 * As your first action, add a delegate to any resolution» (the figure IS the first action: the sign of one delegate,
 * the player's own, never a piece of the corporation). The EFFECT box, one row: «+2 [influence]  [the party-
 * requirement plate — the wild-party pill on the MIN plate — STRUCK by a red cross]» — «You have +2 Influence. When
 * playing cards, you can ignore all party requirements». Printed lore: «The villain of every conspiracy theory…». No
 * VP, no action, no resources, no production. The purple Turmoil diamond at the bottom left is the module itself (no
 * `compatibility`).
 *
 * The whole card is THREE EXISTING DECLARATIONS — nothing of it lives in code:
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/TheDeimosGroup.spec.ts):
 *  1. THE FIRST ACTION is declarative (`firstAction: {turmoil: {sendDelegates: {count: 1}}}`): the Executor's
 *     `politics.placeDelegates` → `PlaceDelegatesOnResolution` — a `SelectParty` marked `votePrompt: {source:
 *     'grant'}` over the resolutions of the VOTING AREA (rulebook p.13: «"Add delegates to a party" becomes "Add
 *     delegates to a resolution" in Redux… not the Enacted resolution»), the delegate leaving the RESERVE. The set-up
 *     always deals three resolutions, so there is always an address; an empty voting area (a Merger corporation mid-
 *     game) is the grant's NAMED skip, never a crash.
 *  2. «+2 INFLUENCE» — `behavior: {turmoil: {influenceBonus: 2}}`, played with the corporation: ONE entry of the
 *     Parliament's influence ledger NAMED after the card (`addInfluenceBonus(player, 2, 'The Deimos Group')`), so the
 *     disc, the «+2» modifier, the Information zone, the payout and an influence requirement (TR04) all read it, and
 *     the journal writes it (`influence-changed`). Never the anonymous `getInfluenceBonus` hook.
 *  3. «WHEN PLAYING CARDS, YOU CAN IGNORE ALL PARTY REQUIREMENTS» — `partyRequirementWaiver: {}`, the TR70 declaration
 *     WITHOUT `nextCardOnly`: a STANDING waiver, live while the card is on the table (`Card.waivesPartyRequirements`),
 *     paid by `PartyRequirement.satisfies` before the Parliament is asked. It lifts ONLY a party requirement (never a
 *     global one, a tag, the chairman, cities / colonies / TR) and never grants the party's EFFECT — a requirement is
 *     the card's, an effect is the Parliament's (FAQ p.19, TR36 / TR70). It is not ARMED (nothing spends it): the
 *     public «ВЗВЕДЕНО» never shows it, the hand never says «One play».
 *  4. A STANDING WAIVER IS NAMED FIRST (`IPlayer.partyRequirementWaiver`): beside an armed Backroom Deal the
 *     requirement is lifted by this card; Backroom Deal's charge is spent by the next play anyway (TR49).
 *  5. The Parliament reads the waiver through ONE field of the seat (`ParliamentPlayerModel.partyRequirementWaiver`):
 *     the party plaque says the requirement is lifted, and the vote never promises «unlocks the requirement».
 *     `access().satisfiesRequirement` stays the printed roads.
 *  6. MarsBot never holds the card (no twin).
 */
export class TheDeimosGroup extends CorporationCard implements ICorporationCard {
  constructor() {
    super({
      name: CardName.THE_DEIMOS_GROUP,
      tags: [Tag.MARS],
      startingMegaCredits: 50,

      behavior: {
        turmoil: {influenceBonus: DEIMOS_INFLUENCE_BONUS},
      },

      firstAction: {
        text: 'Add a delegate to any resolution',
        turmoil: {sendDelegates: {count: DEIMOS_FIRST_ACTION_DELEGATES}},
      },

      partyRequirementWaiver: {},

      metadata: {
        cardNumber: 'TR83',
        description: 'You start with 50 M€. As your first action, add a delegate to any resolution.',
        infoText: [
          {text: 'As your first action, add a delegate to any resolution.', tokens: ['delegates']},
          // ONE effect frame, two facts: one caption without `tokens` (the generator's unambiguous case).
          {kind: 'effect-short', text: '+2 influence · party requirements ignored'},
        ],
        renderData: CardRenderer.builder((b) => {
          b.br;
          // The scan's «50» and the white figure — the first action's one delegate.
          b.megacredits(50).nbsp.delegates(1);
          b.corpBox('effect', (ce) => {
            ce.effect('You have +2 influence. When playing cards, you can ignore all party requirements.', (eb) => {
              eb.startEffect.plus().influence({amount: DEIMOS_INFLUENCE_BONUS, digit: true}).nbsp.partyRequirement({cancelled: true});
            });
          });
        }),
      },
    });
  }
}
