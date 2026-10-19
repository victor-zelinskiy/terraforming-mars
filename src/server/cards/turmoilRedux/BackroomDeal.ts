import {IProjectCard} from '../IProjectCard';
import {Card} from '../Card';
import {CardType} from '../../../common/cards/CardType';
import {CardName} from '../../../common/cards/CardName';
import {CardRenderer} from '../render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';

/** The price in VICTORY POINTS — the Mars disc with «−1» at the scan's right (the set's VP badge, TR01's «4»). */
export const VICTORY_POINTS = -1;
/** The one-play discount the next card spends («it will also cost you 10 less M€»). */
export const DISCOUNT = 10;

/**
 * TR70 — BACKROOM DEAL («Закулисная сделка»), a Turmoil Redux PROJECT card:
 * the set's last card, an EVENT of the ONE-PLAY class (TR49) that ARMS TWO
 * effects at once for the price of a victory point — the next card this player
 * plays this generation ignores its PARTY requirement (the class's FOURTH
 * kind, `partyWaiver` — declared here as `partyRequirementWaiver`, read by
 * the one reader and paid by `PartyRequirement.satisfies` through
 * `IPlayer.partyRequirementWaiver`) and costs 10 M€ less (Indentured Workers'
 * own declaration, `cardDiscount: {nextCardOnly: true}`). The whole card is
 * three declarations; nothing of it lives in code — Indentured Workers (the
 * base game's «next card −8 M€» for −1 VP) is its exact precedent.
 *
 * SCAN READING — a RED frame (EVENT), cost 2, the MIN plate EMPTY (no
 * requirement), the event's yellow disc in the corner and NO tag. One row:
 * «NEXT CARD : [the party-requirement plate — the wild-party pill on the
 * yellow MIN plate — STRUCK by a red diagonal] [−10 on the gold M€ token]»,
 * and at the right a large Mars disc with «−1» — the VP badge (the set prints
 * every card's VP on that disc: TR01's «4», TR67's «2»), so −1 VP at the end
 * of the game, exactly as Bribed Committee prints its −2. The rule in words
 * says nothing of the rating: «(Ignore any party requirements on the next
 * card you play this generation. It will also cost you 10 less M€.)». The
 * first reading of the scan («−1 TR at once») was wrong and is gone: the
 * disc is never a rating. The quote is the scan's
 * («"Collusion"? That's crass. We prefer to call it "Bipartisanship".»). Only
 * the module's icon at the bottom left: no `compatibility`.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/BackroomDeal.spec.ts):
 *  1. No requirement; an event — into the events pile face down, Media Group
 *     +3 M€; no tag, so nothing else on the table answers it.
 *  2. The play is TWO armed effects of one card: (a) the waiver of the next
 *     card's PARTY requirement; (b) the discount of 10 M€ on the next card.
 *     The play itself moves nothing — no rating, no stock.
 *  3. The price is −1 VP at the end of the game (`victoryPoints: -1`, the
 *     shared `Card.getVictoryPoints` — Indentured Workers' and Bribed
 *     Committee's road): the terraform rating is never touched, so nothing
 *     gates the play and the Reds have nothing to tax.
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
      // Rule 3 — the price: −1 VP at the end of the game, the rating untouched.
      victoryPoints: VICTORY_POINTS,
      // Rules 4–6 — what the NEXT card spends: its party requirement lifted, its price lowered.
      partyRequirementWaiver: {nextCardOnly: true},
      cardDiscount: {amount: DISCOUNT, nextCardOnly: true},

      metadata: {
        cardNumber: 'TR70',
        renderData: CardRenderer.builder((b) => {
          // «NEXT CARD : [party plate, struck] [−10 M€]» — the −1 at the right is the VP badge, drawn from `victoryPoints`.
          b.text('next card', Size.SMALL, true).colon().partyRequirement({cancelled: true}).megacredits(-DISCOUNT);
        }),
        infoText: [
          {text: 'Ignore any party requirements on the next card you play this generation.', tokens: ['party-requirement']},
          {text: 'The next card you play this generation costs 10 M€ less.', tokens: ['megacredits']},
        ],
        description: 'Ignore any party requirements on the next card you play this generation. It will also cost you 10 less M€.',
      },
    });
  }
}
