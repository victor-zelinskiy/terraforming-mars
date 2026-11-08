// Campaign «ТЕНДЕРЫ» — APPLICABILITY: a tender that can never be used in this
// campaign is never printed into its Register and never dealt (the owner's
// floor: no dead card on the table — `docs/CAMPAIGN_CONCESSIONS_DESIGN.md` §3.6).
//
// Pure over counts the manager computes once from the frozen settings (the
// card pools never change over a campaign's life).

import {TENDER_OPEN_CALL_PRELUDES, TENDER_RESTRUCTURING_CANDIDATES, TenderDef} from '../../common/campaign/tenders';

export type TenderApplicabilityContext = {
  /** The Prelude expansion is at the table. */
  preludes: boolean;
  /** Human seats. */
  humans: number;
  /** The route's length — the finale deploys `missionCount − 1` corporations per human. */
  missionCount: number;
  /** The prelude pool's size (every prelude card the frozen settings admit). */
  preludePool: number;
  /** Preludes dealt per human at a start. */
  startingPreludes: number;
  /** The corporation pool's size (every corporation the frozen settings admit). */
  corporationPool: number;
  /** The finale DRAFTS a corporation (the three-mission route — `campaignFinalePicksCorporation(missionCount − 1)`). */
  finaleDraftsCorporation: boolean;
  /** Corporations dealt per human at a start (the draft's size — what «Авантюра: корпорации» redeals). */
  startingCorporations: number;
};

export function tenderApplicable(def: TenderDef, ctx: TenderApplicabilityContext): boolean {
  if (def.needsPreludes && !ctx.preludes) {
    return false;
  }
  switch (def.id) {
  case 'openCall':
  case 'programExtension':
    // The finale's prelude deck must cover every human's deal with the widest
    // «Открытый конкурс» AND a carried prelude each — the worst case at once.
    return ctx.preludePool >= ctx.humans * (ctx.startingPreludes + TENDER_OPEN_CALL_PRELUDES + 1);
  case 'restructuring':
    // The finale bans every lineage corporation (and the bot's); the dealt
    // candidates must still exist for every human at once.
    return ctx.corporationPool >= ctx.humans * (ctx.missionCount - 1) + 2 + ctx.humans * TENDER_RESTRUCTURING_CANDIDATES;
  case 'gambleCorporations':
    // Only where the finale DRAFTS a corporation — and the pool must cover the draft, its redeal and a restructuring's
    // candidates for every human at once, past the lineage bans.
    return ctx.finaleDraftsCorporation &&
      ctx.corporationPool >= ctx.humans * (ctx.missionCount - 1) + 2 + 2 * ctx.humans * ctx.startingCorporations + ctx.humans * TENDER_RESTRUCTURING_CANDIDATES;
  default:
    return true;
  }
}
