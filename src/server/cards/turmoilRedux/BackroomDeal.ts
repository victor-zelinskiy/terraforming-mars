import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';

/** The price in rating — the Mars disc with «−1» at the scan's right. */
export const TR_LOST = 1;
/** The one-play discount the next card spends («it will also cost you 10 less M€»). */
export const DISCOUNT = 10;

/**
 * TR70 — BACKROOM DEAL («Закулисная сделка»), a Turmoil Redux PROJECT card:
 * the set's last card, an EVENT of the ONE-PLAY class (TR49) that ARMS TWO
 * effects at once for the price of a rating step — the next card this player
 * plays this generation ignores its PARTY requirement (the class's FOURTH
 * kind, `partyWaiver` — declared here as `partyRequirementWaiver`, read by
 * the one reader and paid by `PartyRequirement.satisfies` through
 * `IPlayer.partyRequirementWaiver`) and costs 10 M€ less (Indentured Workers'
 * own declaration, `cardDiscount: {nextCardOnly: true}`). The whole card is
 * three declarations; nothing of it lives in code.
 *
 * SCAN READING — a RED frame (EVENT), cost 2, the MIN plate EMPTY (no
 * requirement), the event's yellow disc in the corner and NO tag. One row:
 * «NEXT CARD : [the party-requirement plate — the wild-party pill on the
 * yellow MIN plate — STRUCK by a red diagonal] [−10 on the gold M€ token]»,
 * and at the right a large Mars disc with «−1» — a rating LOST. The rule in
 * words: «(Ignore any party requirements on the next card you play this
 * generation. It will also cost you 10 less M€.)». The quote is the scan's
 * («"Collusion"? That's crass. We prefer to call it "Bipartisanship".»). Only
 * the module's icon at the bottom left: no `compatibility`.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/BackroomDeal.spec.ts):
 *  1. No requirement; an event — into the events pile face down, Media Group
 *     +3 M€; no tag, so nothing else on the table answers it.
 *  2. The play is THREE effects of one card: (a) −1 TR at once; (b) the ARMED
 *     waiver of the next card's PARTY requirement; (c) the ARMED discount of
 *     10 M€ on the next card.
 *  3. The rating LOSS is `behavior: {tr: -1}` → `decreaseTerraformRating`:
 *     the Reds' tax is a tax on a RAISE and never touches a loss; the rating
 *     has no floor and the card has no `canPlay` for it (Pristar, Terralabs
 *     Research and Midas lose rating the same way) — at 0 TR the card is
 *     playable and the rating goes negative; the journal writes «lost 1 TR»
 *     (the Executor writes every rating loss) and the rival's feed reads
 *     «−1 РТ».
 *  4. Both armed effects live as `lastCardPlayed` (the TR49 class): spent by
 *     the NEXT card played by any road, needed or not; a standard project, a
 *     card action, a conversion spend nothing; the pass loses them; a new
 *     play REPLACES what was armed (this card after Cutting-Edge Design: the
 *     global waiver is spent on THIS card, the party waiver + discount armed —
 *     and TR49 after this card spends both and arms its own; never a SUM of
 *     two armed sources).
 *  5. The discount is Indentured Workers' declaration: 10 off the next card's
 *     price in `getCardCostBreakdown` (floor 0 — a card cheaper than 10 spends
 *     all of it); the journal «saved N M€ playing with Backroom Deal».
 *  6. The PARTY waiver lifts ONLY a `PartyRequirement` (TR15's class — «the
 *     party rules, or 2 of your delegates on its resolution»): the next card
 *     is playable with that party out of power and 0 delegates. NOT lifted: a
 *     global-parameter requirement (that is TR49's kind), a tag, a chairman
 *     requirement, cities / colonies / TR. And the party's EFFECT is not
 *     granted — a requirement is the card's, an effect is the Parliament's
 *     (TR36 Council Seat lowers the EFFECT's threshold and never a
 *     requirement; this card is its mirror).
 *  7. Two effects from one source: the public «ВЗВЕДЕНО» shows BOTH, in the
 *     printed order (the waiver, then the price); the next play's forecast
 *     names each as used or spent for nothing.
 *  8. The journal: under the next play «… ignored the party requirement of …
 *     thanks to Backroom Deal» (`requirement-eased`, kind `waive`, the party
 *     named) beside the discount's own line.
 *  9. Never futile (the discount serves any next card); MarsBot never plays it
 *     (its cards are not from a hand); save / load keeps `lastCardPlayed`, so
 *     both armed effects survive a reload.
 */
export class BackroomDeal extends Card implements IProjectCard {
  constructor() {
    super({
      name: CardName.BACKROOM_DEAL,
      type: CardType.EVENT,
      tags: [],
      cost: 2,
      // Rule 3 — the price in rating, at once.
      behavior: {tr: -TR_LOST},
      // Rules 4–6 — what the NEXT card spends: its party requirement lifted, its price lowered.
      partyRequirementWaiver: {nextCardOnly: true},
      cardDiscount: {amount: DISCOUNT, nextCardOnly: true},

      metadata: {
        cardNumber: 'TR70',
        renderData: CardRenderer.builder((b) => {
          // «NEXT CARD : [party plate, struck] [−10 M€]» … and the rating lost, large, at the right.
          b.text('next card', Size.SMALL, true).colon().partyRequirement({cancelled: true}).megacredits(-DISCOUNT);
          b.nbsp.nbsp.nbsp.tr(-TR_LOST, {size: Size.LARGE});
        }),
        infoText: [
          {text: 'Ignore any party requirements on the next card you play this generation.', tokens: ['party-requirement']},
          {text: 'The next card you play this generation costs 10 M€ less.', tokens: ['megacredits']},
          {text: 'Lose 1 TR.', tokens: ['tr']},
        ],
        description: 'Ignore any party requirements on the next card you play this generation. It will also cost you 10 less M€. Lose 1 TR.',
      },
    });
  }
}
