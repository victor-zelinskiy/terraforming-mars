import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {CAMPAIGN_SUPPORT, PopularSupportCampaign} from './PopularSupportCampaign';

/** «Gain 18 M€» — the printed stock. */
export const REDS_CAMPAIGN_MEGACREDITS = 18;
/** «Draw a card» — the printed draw. */
export const REDS_CAMPAIGN_CARDS = 1;

/**
 * TRP4 — REDS CAMPAIGN («Кампания «Красных»»), the fourth Turmoil Redux PRELUDE and the THIRD of the set's six CAMPAIGNS
 * (`PopularSupportCampaign` — «… Add 3 neutral delegates to <party>'s Popular Support Area»). Its own art and its own
 * printed lore, both keyed TRP4 («The third constant of humankind: There will always be resistance to change.»; the
 * art credit on the scan's edge is «Thibault Girard»).
 *
 * SCAN READING — the magenta PRELUDE plate; ONE tag in the corner: the red planet, the MARS tag. No cost, no
 * requirement, no VP. The effect row, in print order: a gold M€ plate with «18» · one card (draw a card) · «3» + a
 * NEUTRAL (dark) delegate wearing the Reds' emblem pill. The parenthesised text is the rule: «Gain 18 M€. Draw a card.
 * Add 3 neutral delegates to the Reds' Popular Support Area.» The purple Turmoil diamond on the left edge is the module
 * itself (no ▲ — no Colonies mark); a Prelude is dealt only beside the Prelude expansion.
 *
 * THREE EXISTING ENGINES, ONE CARD — nothing new is built here:
 *  · the M€ is a plain declaration (`stock: {megacredits: 18}` — also the Prelude's starting-M€ worth);
 *  · the draw is a plain declaration (`drawCard: 1` — the ordinary draw from the project deck, kept);
 *  · the support is the campaign's line (`PopularSupportCampaign` — TR31's rally with `{perResolution: 0, perArea: 3,
 *    recount: false}`), deferred BEHIND the draw.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/RedsCampaign.spec.ts; the campaign's own in the base file):
 *  1. The Reds' resolution up for a vote takes NONE of the three — they wait in the Reds' area for the next Reds card the
 *     refresh deals (rulebook p.9 / p.11 step 5), and become its votes then.
 *  2. Nothing is asked: the M€, the drawn card and the support all ride the play's own answer — the support last (the
 *     printed order; the console tells the draw first, then the Parliament's step).
 *  3. Always playable: no requirement, no placement — an empty deck reshuffles the discard, as every draw does.
 */
export class RedsCampaign extends PopularSupportCampaign {
  constructor() {
    super({
      name: CardName.REDS_CAMPAIGN,
      tags: [Tag.MARS],
      campaignParty: PartyName.REDS,

      behavior: {
        stock: {megacredits: REDS_CAMPAIGN_MEGACREDITS},
        drawCard: REDS_CAMPAIGN_CARDS,
      },

      metadata: {
        cardNumber: 'TRP4',
        infoText: [
          {text: 'Add 3 neutral delegates to the Reds\' Popular Support Area.', tokens: ['neutral-delegate']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.megacredits(REDS_CAMPAIGN_MEGACREDITS).nbsp.cards(REDS_CAMPAIGN_CARDS).nbsp
            .neutralDelegate(CAMPAIGN_SUPPORT, {digit}).partySeal(PartyName.REDS);
        }),
        description: 'Gain 18 M€. Draw a card. Add 3 neutral delegates to the Reds\' Popular Support Area.',
      },
    });
  }
}
