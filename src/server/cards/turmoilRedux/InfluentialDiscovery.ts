import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';

/** The printed «[science]*» — the first branch of the choice. */
export const SCIENCE_TO_ANY_CARD = 1;
/** The printed «6 [data]*» — the second branch. */
export const DATA_TO_ANY_CARD = 6;
/** The two branches' titles — the i18n keys the composer's variant row, the OrOptions and a skip's record all print. */
export const SCIENCE_BRANCH = 'Add 1 science resource to ANY card';
export const DATA_BRANCH = 'Add 6 data to ANY card';

/**
 * TR51 — INFLUENTIAL DISCOVERY («Судьбоносное открытие»), a Turmoil Redux
 * PROJECT card: a Scientists' plate whose WHOLE effect is one choice of two
 * «add to ANY card» branches — TR43 Ichtiology Grant's `or` without the
 * production beside it. The set's first «science to ANY card» (the science
 * holders in scope: Olympus Conference, Physics Complex, Search for Life)
 * against «6 data to ANY card» (ten data holders in scope — TR15's two
 * delegates, TR48's 12 M€ of Science payment, Martian Fiber's +6 M€ on ANY
 * target): the comparison the choice-grammar iteration of 2026-10-12 is
 * staged on (docs/claude/prompts/project-tr51-influential-discovery.md).
 *
 * «Requires the Scientists to be ruling or that you have 2 delegates there.
 * Add 1 science resource to ANY card, OR 6 data resources to ANY card.» Cost
 * 4, green, Science, no VP. ONE DECLARATION — the `or` of TR43 (`mustHaveCard`
 * + `autoSelect` + `optional`); no hook, no reason, no forecast of its own.
 *
 * SCAN READING — cost 4, green (AUTOMATED); one tag in the corner: SCIENCE
 * (the atom). The orange MIN box beside the cost holds the SCIENTISTS' emblem
 * (the flask) — a REQUIREMENT (`{party: SCIENTISTS}`), never a tag. One row:
 * «[science]* OR 6 [data]*» — the white science square, the orange data
 * square with the digit 6 before it, the asterisks the printed «to ANY card».
 * No VP badge. Only the module's icon at the bottom left: no
 * `compatibility`. Printed lore: «There was the life before it. And then there
 * was the life after it.» (`lore_texts.json` «TR51»). «pxfuel.com» is the
 * art's caption, not the face's.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/InfluentialDiscovery.spec.ts):
 *  1. The REQUIREMENT is the Scientists' plate — the Scientists rule or 2 of
 *     the player's OWN delegates on their resolution — checked at the PLAY
 *     only; TR36 Council Seat lowers an EFFECT's threshold, never a
 *     REQUIREMENT's.
 *  2. «To ANY card» = any of the player's OWN cards that hold the resource
 *     (`AddResourcesToCard.getCards`: the own tableau — Self-replicating
 *     Robots' hosts only for a declaration with `robotCards`, which this card
 *     has not; an opponent's card never). The target is NEVER applied
 *     automatically, a single holder included (the fork's invariant 3).
 *  3. ONE KIND DEAD (no holder of its resource): that branch stands greyed with
 *     its reason, the other is resolved WITHOUT an OrOptions (`autoSelect` —
 *     the preview gives it index −1, the batch sends the bare target answer).
 *  4. NO HOLDER OF EITHER KIND → THE CARD STAYS PLAYABLE (`optional`): the
 *     play buys the Science tag alone, and the loss is named ONCE per branch
 *     (`recordSkippedEffect` — the same words the preview's warning carries).
 *  5. The SCIENCE TAG wakes the neighbours in the engine's order — Olympus
 *     Conference, Mars University, Pharmacy Union ask; TR05 Vector
 *     Computations answers +2 data; and 6 data on ANY target answer Martian
 *     Fiber's +6 M€ (one per data). Science put on Olympus Conference is an
 *     ordinary science resource (no extra draw — its trigger is the tag).
 *  6. The LIVE ORDER and the BATCH are TR43's: the `or` deferred at `DEFAULT`
 *     (an OrOptions with `choiceContext 'effect-choice'`), the chosen branch's
 *     `AddResourcesToCard` after it; `[play, {or, index, {option}}, {card}]`,
 *     collapsed `[play, {card}]`, none `[play]` — all land through
 *     `replayBatch`.
 *  7. THE JOURNAL names the target («added 1 science to Physics Complex» /
 *     «added 6 data to Martian Census»); with no holder, a skip line per
 *     branch; the table's answers on their own lines.
 *  8. MarsBot never plays it (the bot's deck is tags); save / load adds
 *     nothing (card resources are ordinary fields).
 */
export class InfluentialDiscovery extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.INFLUENTIAL_DISCOVERY,
      type: CardType.AUTOMATED,
      tags: [Tag.SCIENCE],
      cost: 4,
      requirements: {party: PartyName.SCIENTISTS},

      behavior: {
        or: {
          optional: true,
          autoSelect: true,
          behaviors: [
            {title: SCIENCE_BRANCH, addResourcesToAnyCard: {type: CardResource.SCIENCE, count: SCIENCE_TO_ANY_CARD, mustHaveCard: true}},
            {title: DATA_BRANCH, addResourcesToAnyCard: {type: CardResource.DATA, count: DATA_TO_ANY_CARD, mustHaveCard: true}},
          ],
        },
      },

      metadata: {
        cardNumber: 'TR51',
        // The `or` is a declarative shape the generator does not prose on its own (`behavior.or (choice) — needs curation`).
        infoText: [
          {text: 'Add 1 science resource or 6 data to ANY card.', tokens: ['res-science', 'res-data']},
        ],
        renderData: CardRenderer.builder((b) => {
          // The scan's one row — «[science]* OR 6 [data]*» (TR43's digit form, the asterisk «to ANY card»).
          b.resource(CardResource.SCIENCE).asterix().or().resource(CardResource.DATA, {amount: DATA_TO_ANY_CARD, digit}).asterix();
        }),
        description: 'Requires the Scientists to be ruling or that you have 2 delegates there. Add 1 science resource to ANY card, OR 6 data resources to ANY card.',
      },
    });
  }
}
