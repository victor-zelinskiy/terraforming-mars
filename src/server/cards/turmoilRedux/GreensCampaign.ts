import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {CAMPAIGN_SUPPORT, PopularSupportCampaign} from './PopularSupportCampaign';

/** «Gain 2 TR» — the printed rating. */
export const GREENS_CAMPAIGN_TR = 2;
/** «Increase your plant production 1 step» — the printed production. */
export const GREENS_CAMPAIGN_PLANT_PRODUCTION = 1;

/**
 * TRP5 — GREENS CAMPAIGN («Кампания «Зелёных»»), the fifth Turmoil Redux PRELUDE and the FOURTH of the set's six
 * CAMPAIGNS (`PopularSupportCampaign` — «… Add 3 neutral delegates to <party>'s Popular Support Area»). Its own art and
 * its own printed lore, both keyed TRP5 («"That is well said," replied Candide, "but we must cultivate our garden." —
 * Voltaire, Candide»; the art credit on the scan's edge is «Bryan Versteeg»).
 *
 * SCAN READING — the magenta PRELUDE plate; TWO tags in the corner: Plant (the leaf) and Microbe. No cost, no
 * requirement, no VP. The effect row, in print order: two TR plates stacked (gain 2 TR) · a brown production plate with
 * the plant glyph (plant production +1) · «3» + a NEUTRAL (dark) delegate wearing the Greens' emblem pill. The
 * parenthesised text is the rule: «Gain 2 TR. Increase your plant production 1 step. Add 3 neutral delegates to the
 * Greens' Popular Support Area.» The purple Turmoil diamond on the left edge is the module itself (no ▲ — no Colonies
 * mark); a Prelude is dealt only beside the Prelude expansion.
 *
 * THREE EXISTING ENGINES, ONE CARD — nothing new is built here:
 *  · the rating is a plain declaration (`tr: 2` — the ONE rating funnel: the ruling party's answer, a law's veto, the
 *    UNMI flags all read it there);
 *  · the production is a plain declaration (`production: {plants: 1}`);
 *  · the support is the campaign's line (`PopularSupportCampaign` — TR31's rally with `{perResolution: 0, perArea: 3,
 *    recount: false}`), deferred BEHIND everything the play sets off.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/GreensCampaign.spec.ts; the campaign's own in the base file):
 *  1. The Greens' resolution up for a vote takes NONE of the three — they wait in the Greens' area for the next Greens
 *     card the refresh deals (rulebook p.9 / p.11 step 5), and become its votes then.
 *  2. THE RULER'S OWN AREA: at the start of a game the Greens rule by default (the ENACTED slot is empty, p.8). Their
 *     area fills all the same (p.9 names no exception) — and since the refresh deals only NON-ruling parties (p.11
 *     step 5), the three wait until the Greens no longer rule.
 *  3. Nothing is asked: the rating, the production and the support ride the play's own answer — the support last. The
 *     ruling Greens ANSWER the play's rating and its plant production (their party effect — the table's answer, told by
 *     the card-reaction scene before the Parliament's step).
 *  4. Always playable: no requirement, no placement.
 */
export class GreensCampaign extends PopularSupportCampaign {
  constructor() {
    super({
      name: CardName.GREENS_CAMPAIGN,
      tags: [Tag.PLANT, Tag.MICROBE],
      campaignParty: PartyName.GREENS,

      behavior: {
        tr: GREENS_CAMPAIGN_TR,
        production: {plants: GREENS_CAMPAIGN_PLANT_PRODUCTION},
      },

      metadata: {
        cardNumber: 'TRP5',
        infoText: [
          {text: 'Add 3 neutral delegates to the Greens\' Popular Support Area.', tokens: ['neutral-delegate']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.tr(GREENS_CAMPAIGN_TR).nbsp.production((pb) => pb.plants(GREENS_CAMPAIGN_PLANT_PRODUCTION)).nbsp
            .neutralDelegate(CAMPAIGN_SUPPORT, {digit}).partySeal(PartyName.GREENS);
        }),
        description: 'Gain 2 TR. Increase your plant production 1 step. Add 3 neutral delegates to the Greens\' Popular Support Area.',
      },
    });
  }
}
