import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';

/** The printed «9 [energy]» — energy RESOURCES, into the stock. */
export const NUCLEAR_WARHEAD_ENERGY = 9;
/** The printed VP badge — a fixed 2. */
export const NUCLEAR_WARHEAD_VP = 2;

/**
 * TR55 — NUCLEAR WARHEAD UTILIZATION («Утилизация ядерных боеголовок»), a
 * Turmoil Redux PROJECT card: the set's FIRST card under the INDUSTRIALISTS'
 * plate — and a whole declaration. Nothing of it lives here: the requirement
 * is the TR15 class (`{party}` — the reason, the emblem, the hand's counter),
 * the energy is the engine's stock gain, the 2 VP are the standard fixed badge
 * every surface reads off `victoryPoints`, and the Power tag wakes whatever
 * the table already answers a Power tag with.
 *
 * SCAN READING — cost 3, green (AUTOMATED). ONE tag in the corner: Power (the
 * purple disc with the lightning). The orange MIN plate beside the cost holds
 * the INDUSTRIALISTS' emblem (the cog around the globe): the REQUIREMENT
 * («Requires the Industrialists to be ruling or that you have 2 delegates
 * there»), never a tag. The field holds ONE row: a large «9» and ONE energy
 * icon (`b.energy(9, {digit})` — never nine icons). The VP badge on the Mars
 * disc: «2». Only the module's symbol at the bottom left (the purple diamond
 * with the arrow; no ▲, no Venus icon): no `compatibility`. Printed lore under
 * the rule: «The loops you have to jump through to have these delivered from
 * Earth are an endeavor all on their own.» (`lore_texts.json` «TR55», word for
 * word — NOT an invented entry). Art credit: Federation of American Scientists.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/NuclearWarheadUtilization.spec.ts):
 *  1. The REQUIREMENT is the Industrialists' plate (the TR15 class): they rule,
 *     or 2 of the player's OWN delegates stand on their resolution — checked at
 *     the play only; TR36 Council Seat lowers an EFFECT's threshold, never a
 *     requirement's (the FAQ, pp. 18–19). Without either road the hand names
 *     the party and both roads (`partyRequirementStanding`).
 *  2. ON PLAY: +9 energy RESOURCES into the stock (never production), at once;
 *     the journal reads «gained 9 energy». Unused energy turns to heat in the
 *     production phase — the engine's rule, untouched by the card.
 *  3. 2 VP, FIXED: they join the live score the moment the card lands (one row
 *     of `detailsCards`).
 *  4. THE POWER TAG: Thorgate's −3 M€ (cost 0 — «free», the payment head names
 *     the corporation); other cards' Power-tag requirements count it; RX04
 *     Central Power Grid counts it at its enactment (`'raw'`), and its chairman
 *     quest «play 2 power tags» moves with the play (`QuestTracker` `{kind:
 *     'tag'}`); a completed quest stands as the gate at `BACK_OF_THE_LINE`
 *     (`ChairmanSeat`) — nothing of the office is applied before the answer.
 *  5. PREVIEW = EXECUTION — declarative: the chip «+9 [energy] current →
 *     resulting», the level-2 «★ VP +2», the tags row; `cardPlayPreviewCoverage`
 *     takes the card by itself.
 *  6. THE TABLE'S ANSWERS — whatever answers a Power tag (the effect forecast
 *     names it); no party answers a play without TR.
 *  7. A RIVAL sees the play's notification; the +2 VP reach them only with
 *     `showOtherPlayersVP` (the mask holds).
 *  8. MarsBot never plays the card.  9. Save / load: an ordinary card.
 * 10. Name / lore — the owner's decision 1 (the prompt of 2026-10-15).
 */
export class NuclearWarheadUtilization extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.NUCLEAR_WARHEAD_UTILIZATION,
      type: CardType.AUTOMATED,
      tags: [Tag.POWER],
      cost: 3,
      requirements: {party: PartyName.INDUSTRIALISTS},
      victoryPoints: NUCLEAR_WARHEAD_VP,

      // Rule 2.
      behavior: {
        stock: {energy: NUCLEAR_WARHEAD_ENERGY},
      },

      metadata: {
        cardNumber: 'TR55',
        renderData: CardRenderer.builder((b) => {
          b.energy(NUCLEAR_WARHEAD_ENERGY, {digit});
        }),
        description: 'Requires the Industrialists to be ruling or that you have 2 delegates there. Gain 9 energy resources.',
      },
    });
  }
}
