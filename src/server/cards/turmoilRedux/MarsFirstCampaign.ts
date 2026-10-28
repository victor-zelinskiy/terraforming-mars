import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {CAMPAIGN_SUPPORT, PopularSupportCampaign} from './PopularSupportCampaign';

/** «Increase your steel production 1 step» — the printed production. */
export const MARS_FIRST_CAMPAIGN_STEEL_PRODUCTION = 1;

/**
 * TRP3 — MARS FIRST CAMPAIGN («Кампания «Марс вперёд»»), the third Turmoil Redux PRELUDE and the SECOND of the set's six
 * CAMPAIGNS (`PopularSupportCampaign` — «… Add 3 neutral delegates to <party>'s Popular Support Area»). Its own art and
 * its own printed lore, both keyed TRP3 («In the face of squalor all ideologies are equal.»; the art credit on the
 * scan's edge is «marssociety.org»).
 *
 * SCAN READING — the magenta PRELUDE plate; THREE tags in the corner: Mars (the red planet), City (the skyline),
 * Building (the brown roof). No cost, no requirement, no VP. The effect row, in print order: the grey city hex (place
 * a city tile) · a brown production plate with the steel glyph (steel production +1) · «3» + a NEUTRAL (dark) delegate
 * wearing Mars First's emblem pill. The parenthesised text is the rule: «Place a city tile. Increase your steel
 * production 1 step. Add 3 neutral delegates to Mars First's Popular Support Area.» The purple Turmoil diamond on the
 * left edge is the module itself (no ▲ — no Colonies mark); a Prelude is dealt only beside the Prelude expansion.
 *
 * THREE EXISTING ENGINES, ONE CARD — nothing new is built here:
 *  · the city is a plain declaration (`city: {}` — the ordinary city's placement rules, the cell's bonus, the
 *    placement scene on the board);
 *  · the production is a plain declaration (`production: {steel: 1}`);
 *  · the support is the campaign's line (`PopularSupportCampaign` — TR31's rally with `{perResolution: 0, perArea: 3,
 *    recount: false}`), deferred BEHIND the city.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/MarsFirstCampaign.spec.ts; the campaign's own in the base file):
 *  1. Mars First's resolution up for a vote takes NONE of the three — they wait in Mars First's area for the next Mars
 *     First card the refresh deals (rulebook p.9 / p.11 step 5), and become its votes then.
 *  2. The city goes on any cell an ordinary city may take (not next to another city, not reserved); with no legal cell
 *     the Prelude is unplayable (the Executor's gate — it burns).
 *  3. The printed order is the played order for the support: the city (its pick, the cell's bonus) before the cubes.
 *     The production is the Executor's own and lands with the play (rules-neutral — nothing in the city reads it).
 */
export class MarsFirstCampaign extends PopularSupportCampaign {
  constructor() {
    super({
      name: CardName.MARS_FIRST_CAMPAIGN,
      tags: [Tag.MARS, Tag.CITY, Tag.BUILDING],
      campaignParty: PartyName.MARS,

      behavior: {
        city: {},
        production: {steel: MARS_FIRST_CAMPAIGN_STEEL_PRODUCTION},
      },

      metadata: {
        cardNumber: 'TRP3',
        infoText: [
          {text: 'Add 3 neutral delegates to Mars First\'s Popular Support Area.', tokens: ['neutral-delegate']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.city().nbsp.production((pb) => pb.steel(MARS_FIRST_CAMPAIGN_STEEL_PRODUCTION)).nbsp
            .neutralDelegate(CAMPAIGN_SUPPORT, {digit}).partySeal(PartyName.MARS);
        }),
        description: 'Place a city tile. Increase your steel production 1 step. Add 3 neutral delegates to Mars First\'s Popular Support Area.',
      },
    });
  }
}
