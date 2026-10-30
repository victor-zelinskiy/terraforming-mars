import {CardName} from '../../../common/cards/CardName';
import {Tag} from '../../../common/cards/Tag';
import {PartyName} from '../../../common/turmoil/PartyName';
import {CardRenderer} from '../render/CardRenderer';
import {digit} from '../Options';
import {CAMPAIGN_SUPPORT, PopularSupportCampaign} from './PopularSupportCampaign';

/** «Gain 3 titanium» — the printed stock. */
export const UNITY_CAMPAIGN_TITANIUM = 3;

/**
 * TRP2 — UNITY CAMPAIGN («Кампания «Единства»»), the second Turmoil Redux PRELUDE and the FIRST of the set's six
 * CAMPAIGNS (`PopularSupportCampaign` — the class of «… Add 3 neutral delegates to <party>'s Popular Support Area»).
 * Its own art and its own printed lore, both keyed TRP2 («"The real foible is to get two people to want the same thing
 * at once." - Polish saying»; the art credit on the scan's edge is «Shannon Brocas»).
 *
 * SCAN READING — the magenta PRELUDE plate; ONE tag in the corner: Jupiter on its disc, the JOVIAN tag (the preludes
 * sheet settles that the corner discs are tags — TRP5 Greens prints a plant and a microbe there, TRP6 two Science
 * tags; TRP1's red disc is the Mars tag). No cost, no requirement, no VP. The effect row, in print order: «3» +
 * titanium · the colony glyph · «3» + a NEUTRAL (dark) delegate wearing Unity's emblem pill. The parenthesised text
 * is the rule: «Gain 3 titanium. Place a colony. Add 3 neutral delegates to Unity's Popular Support Area.» The marks
 * on the scan's left edge: ▲ — Colonies (mandatory in Turmoil Redux, declared all the same — TR82 Proteus' precedent),
 * the purple Turmoil diamond — the module itself; a Prelude is dealt only beside the Prelude expansion.
 *
 * THREE EXISTING ENGINES, ONE CARD — nothing new is built here:
 *  · the titanium is a plain declaration (`stock: {titanium: 3}`);
 *  · the colony is the DSL's `colonies.buildColony` (the shared `BuildColony` step — the pick, its bonus, the named
 *    skip when no tile takes it);
 *  · the support is the campaign's line (`PopularSupportCampaign` — TR31's rally with `{perResolution: 0, perArea: 3,
 *    recount: false}`), deferred BEHIND the colony.
 *
 * RULE READINGS (pinned by tests/cards/turmoilRedux/UnityCampaign.spec.ts; the campaign's own in the base file):
 *  1. Unity's resolution up for a vote takes NONE of the three — they wait in Unity's area for the next Unity card
 *     the refresh deals (rulebook p.9 / p.11 step 5), and become its votes then.
 *  2. The colony goes on any tile the build's door opens (the 3-colony limit and «not twice on one tile» stand); with
 *     no tile to build on the Prelude is unplayable (the Executor's gate — it burns, Early Colonization's law).
 *  3. The printed order: titanium, the colony (its pick and its bonus), the support.
 */
export class UnityCampaign extends PopularSupportCampaign {
  constructor() {
    super({
      name: CardName.UNITY_CAMPAIGN,
      tags: [Tag.JOVIAN],
      campaignParty: PartyName.UNITY,

      behavior: {
        stock: {titanium: UNITY_CAMPAIGN_TITANIUM},
        colonies: {buildColony: {}},
      },

      metadata: {
        cardNumber: 'TRP2',
        infoText: [
          {kind: 'remainder', text: 'Add 3 neutral delegates to Unity\'s Popular Support Area.', tokens: ['neutral-delegate']},
        ],
        renderData: CardRenderer.builder((b) => {
          b.titanium(UNITY_CAMPAIGN_TITANIUM, {digit}).nbsp.colonies(1).nbsp.neutralDelegate(CAMPAIGN_SUPPORT, {digit}).partySeal(PartyName.UNITY);
        }),
        description: 'Gain 3 titanium. Place a colony. Add 3 neutral delegates to Unity\'s Popular Support Area.',
      },
    });
  }
}
