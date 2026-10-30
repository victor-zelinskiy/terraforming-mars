import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {CAMPAIGN_SUPPORT, PopularSupportCampaign} from './PopularSupportCampaign';

/** «Draw 3 cards» — the printed draw. */
export const SCIENTISTS_CAMPAIGN_CARDS = 3;

/**
 * TRP6 — SCIENTISTS CAMPAIGN («Кампания «Учёных»»), the sixth Turmoil Redux PRELUDE and the FIFTH of the set's six
 * CAMPAIGNS (`PopularSupportCampaign` — «… Add 3 neutral delegates to <party>'s Popular Support Area»). Its own art and
 * its own printed lore, both keyed TRP6 («Science isn't about WHY. It's about WHY NOT.»; the art credit on the scan's
 * edge is «Pablo Palomeque»).
 *
 * SCAN READING — the magenta PRELUDE plate; TWO tags in the corner: two Science atoms. No cost, no requirement, no VP.
 * The effect row, in print order: three card backs (draw 3 cards) · «3» + a NEUTRAL (dark) delegate wearing the
 * Scientists' emblem pill. The parenthesised text is the rule: «Draw 3 cards. Add 3 neutral Delegates to the Scientists'
 * Popular Support Area.» The purple Turmoil diamond on the left edge is the module itself (no ▲ — no Colonies mark); a
 * Prelude is dealt only beside the Prelude expansion.
 *
 * TWO EXISTING ENGINES, ONE CARD — nothing new is built here:
 *  · the draw is a plain declaration (`drawCard: 3` — the ordinary draw from the project deck, all three kept: ONE
 *    batch, «одно действие — один забор»);
 *  · the support is the campaign's line (`PopularSupportCampaign` — TR31's rally with `{perResolution: 0, perArea: 3,
 *    recount: false}`), deferred BEHIND the draw and everything the play sets off.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/ScientistsCampaign.spec.ts; the campaign's own in the base file):
 *  1. The Scientists' resolution up for a vote takes NONE of the three — they wait in the Scientists' area for the next
 *     Scientists card the refresh deals (rulebook p.9 / p.11 step 5), and become its votes then.
 *  2. Nothing of the card's own is asked: the three cards and the support ride the play's own answer — the support last
 *     (the printed order; the console tells the draw first, then the Parliament's step).
 *  3. THE TWO SCIENCE TAGS ARE PLAYED TAGS: whatever answers a Science tag answers both (Pharmacy Union: two triggers,
 *     each its own question when no disease is stored) — and the support still comes after every one of them.
 *  4. Always playable: no requirement, no placement — an empty deck reshuffles the discard, as every draw does.
 */
export class ScientistsCampaign extends PopularSupportCampaign {
  constructor() {
    super({
      name: CardName.SCIENTISTS_CAMPAIGN,
      tags: [Tag.SCIENCE, Tag.SCIENCE],
      campaignParty: PartyName.SCIENTISTS,

      behavior: {
        drawCard: SCIENTISTS_CAMPAIGN_CARDS,
      },

      metadata: {
        cardNumber: 'TRP6',
        infoText: [
          {kind: 'remainder', text: 'Add 3 neutral delegates to the Scientists\' Popular Support Area.', tokens: ['neutral-delegate']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.cards(SCIENTISTS_CAMPAIGN_CARDS).nbsp.neutralDelegate(CAMPAIGN_SUPPORT, {digit}).partySeal(PartyName.SCIENTISTS);
        }),
        description: 'Draw 3 cards. Add 3 neutral delegates to the Scientists\' Popular Support Area.',
      },
    });
  }
}
