import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {CAMPAIGN_SUPPORT, PopularSupportCampaign} from './PopularSupportCampaign';

/** «Increase your energy production 3 steps» — the printed production. */
export const INDUSTRIALISTS_CAMPAIGN_ENERGY_PRODUCTION = 3;

/**
 * TRP7 — INDUSTRIALISTS CAMPAIGN («Кампания «Индустриалистов»»), the seventh Turmoil Redux PRELUDE and the LAST of the
 * set's six CAMPAIGNS (`PopularSupportCampaign` — «… Add 3 neutral delegates to <party>'s Popular Support Area»). Its own
 * art and its own printed lore, both keyed TRP7 («The American Dream got replaced with the Martian Dream.»; the art
 * credit on the scan's edge is «Sabina Lach»).
 *
 * SCAN READING — the magenta PRELUDE plate; ONE tag in the corner: the Power bolt. No cost, no requirement, no VP. The
 * effect row, in print order: a brown production plate with three energy glyphs (energy production +3) · «3» + a NEUTRAL
 * (dark) delegate wearing the Industrialists' emblem pill. The parenthesised text is the rule: «Increase your energy
 * production 3 steps. Add 3 neutral delegates to the Industrialists' Popular Support Area.» The purple Turmoil diamond on
 * the left edge is the module itself (no ▲ — no Colonies mark); a Prelude is dealt only beside the Prelude expansion.
 *
 * TWO EXISTING ENGINES, ONE CARD — nothing new is built here:
 *  · the production is a plain declaration (`production: {energy: 3}` — the one production funnel: every
 *    `onProductionGain` / party answer reads it there);
 *  · the support is the campaign's line (`PopularSupportCampaign` — TR31's rally with `{perResolution: 0, perArea: 3,
 *    recount: false}`), deferred BEHIND everything the play sets off.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/IndustrialistsCampaign.spec.ts; the campaign's own in the base file):
 *  1. The Industrialists' resolution up for a vote takes NONE of the three — they wait in the Industrialists' area for the
 *     next Industrialists card the refresh deals (rulebook p.9 / p.11 step 5), and become its votes then.
 *  2. Nothing is asked: the production and the support ride the play's own answer — the support last.
 *  3. THE TABLE MAY ANSWER THE PRODUCTION, never the energy as such: the ruling Greens answer only plant / heat
 *     production (their party effect), so at the start the play wakes nobody; a corporation that answers ANY production
 *     gain (Manutech — 3 energy at once) answers it, and the support still comes after.
 *  4. Always playable: no requirement, no placement.
 */
export class IndustrialistsCampaign extends PopularSupportCampaign {
  constructor() {
    super({
      name: CardName.INDUSTRIALISTS_CAMPAIGN,
      tags: [Tag.POWER],
      campaignParty: PartyName.INDUSTRIALISTS,

      behavior: {
        production: {energy: INDUSTRIALISTS_CAMPAIGN_ENERGY_PRODUCTION},
      },

      metadata: {
        cardNumber: 'TRP7',
        infoText: [
          {text: 'Add 3 neutral delegates to the Industrialists\' Popular Support Area.', tokens: ['neutral-delegate']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.production((pb) => pb.energy(INDUSTRIALISTS_CAMPAIGN_ENERGY_PRODUCTION)).nbsp
            .neutralDelegate(CAMPAIGN_SUPPORT, {digit}).partySeal(PartyName.INDUSTRIALISTS);
        }),
        description: 'Increase your energy production 3 steps. Add 3 neutral delegates to the Industrialists\' Popular Support Area.',
      },
    });
  }
}
