import {IProjectCard} from '../IProjectCard';
import {Tag} from '../../../common/cards/Tag';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';

/** The printed «[heat] [heat]» on the production plate — two STEPS of heat production. */
export const HEAT_PRODUCTION = 2;

/**
 * TR75 — SPONSORED MOHOLE («Грант на скважину»), the Turmoil Redux REPLACEMENT
 * of the classic Turmoil T13 — the THIRD of the set's seven replacements to be
 * authored, numbered by its REGISTRY row, not by the order it shipped in
 * (`common/cards/turmoilReduxReplacements.ts` — Political Alliance TR73 and
 * Recruitment TR74 come before it; `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.2).
 * Registered as `Sponsored Mohole:redux` (the plain name stays the classic
 * card's); the Redux manifest's `cardsToRemove` keeps the classic card out of
 * every Redux deck. Nothing of the play lives here: the requirement is the TR15
 * class (`{party}` — the reason, the emblem, the hand's counter), the production
 * is `behavior.production`, the point is `victoryPoints`.
 *
 * SCAN READING — cost 5, green (AUTOMATED). ONE tag in the corner: Building
 * (the brown roof). The orange MIN plate beside the cost holds the GREENS'
 * emblem (the conifer): the REQUIREMENT («Requires the Greens to be ruling or
 * that you have 2 delegates there») — PRINTED; here it is also what the general
 * Kelvinists → Greens reading of the classic card gives (`normalizeReduxParty`),
 * but the card names the Greens itself, never through the normalization. One
 * row: a brown production plate with TWO heat icons. A VP badge «1» — new: the
 * classic card had none. The scan's number box prints the placeholder «TR00»
 * (all six project replacements do) — the card is TR75, the FIFTH project row of
 * the registry. Only the module's symbol at the bottom left (no ▲, no Venus
 * icon): no `compatibility`. Printed lore under the rule: «Getting the World
 * Government as a partner.» — the owner's quote for the classic card, keyed
 * `T13` in `lore_texts.json` and borrowed through `reimplements` together with
 * the T13 art (the scan's credit: Kim Stanley Robinson, Bennett) — no `TR75` key.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/SponsoredMoholeRedux.spec.ts):
 *  1. The REQUIREMENT is the Greens' plate: they rule, or 2 of the player's OWN
 *     delegates stand on their resolution — checked at the play only; another
 *     party ruling is not a road; a party effect GRANTED by a card is not a road
 *     (FAQ p.19); TR70 Backroom Deal waives it. Without either road the hand
 *     names the party and both roads (`partyRequirementStanding`), or that the
 *     resolution is not up for a vote (`partyOffVote`).
 *  2. ON PLAY: +2 heat PRODUCTION (never stock), at once.
 *  3. 1 VP — counted with the card VP at the scoring, never a TR or a stock gain
 *     at the play.
 *  4. THE BUILDING TAG: counts for everything that answers a Building tag.
 *  5. PREVIEW = EXECUTION — declarative: the production chip; the preview is pure.
 *  6. MarsBot never plays the card.  7. Save / load: an ordinary card.
 */
export class SponsoredMoholeRedux extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.SPONSORED_MOHOLE_REDUX,
      type: CardType.AUTOMATED,
      tags: [Tag.BUILDING],
      cost: 5,
      // Rule 3 — the printed badge.
      victoryPoints: 1,
      // Rule 1 — the printed Greens.
      requirements: {party: PartyName.GREENS},

      // Rule 2.
      behavior: {
        production: {heat: HEAT_PRODUCTION},
      },

      metadata: {
        cardNumber: 'TR75',
        // The classic T13's art and lore — the same illustration and the same printed quote.
        reimplements: CardName.SPONSORED_MOHOLE,
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.heat(HEAT_PRODUCTION));
        }),
        description: 'Requires the Greens to be ruling or that you have 2 delegates there. Increase your heat production 2 steps.',
      },
    });
  }
}
