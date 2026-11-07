// Campaign «ТЕНДЕРЫ» — the PURE readings of a seat's tender HOLDINGS for every campaign surface that spoke titles
// before (the map's rail, the mission card's podium, the mission results, the overview, the seat legacy, the in-game
// dossier). One reader of the model, one status vocabulary, one order — so no surface re-derives a holding.

import {CampaignRewardMode, TenderHolding, TenderId, TenderStatus, tenderNameKey} from '@/common/campaign/tenders';
import {CampaignModel, campaignModelRewardMode} from '@/common/campaign/CampaignModel';

/** One holding as a surface shows it: the kind, where it was won, its status. */
export type TenderHoldingView = {
  instance: string;
  id: TenderId;
  wonAtSlot: number;
  place: number;
  status: TenderStatus;
};

export function campaignRewardModeOf(model: CampaignModel): CampaignRewardMode {
  return campaignModelRewardMode(model);
}

/** The seat's holdings in acquisition order (empty for a titles campaign and for a seat with none). */
export function seatTenderHoldings(model: CampaignModel, seat: number): ReadonlyArray<TenderHoldingView> {
  const holdings: ReadonlyArray<TenderHolding> = model.progression.tenders?.[seat] ?? [];
  return holdings.map((h) => ({instance: h.instance, id: h.id, wonAtSlot: h.wonAtSlot, place: h.place, status: h.status}));
}

/** The lot a seat TOOK at a mission's bidding (the mission card's podium, the results' row) — `undefined` for none. */
export function seatTenderAtMission(model: CampaignModel, slot: number, seat: number): {id: TenderId, instance: string} | undefined {
  const bidding = model.missions[slot]?.bidding ?? (model.bidding?.sourceSlot === slot ? model.bidding : undefined);
  const card = bidding?.offer.find((c) => c.takenBy === seat);
  return card === undefined ? undefined : {id: card.id, instance: card.instance};
}

/** The status word (an i18n key) — «в запасе» · «исполнен» · «выкуплен». */
export function tenderStatusKey(status: TenderStatus): string {
  switch (status) {
  case 'executed': return 'Executed';
  case 'cashed': return 'Bought back';
  default: return 'Held';
  }
}

export function tenderHoldingName(id: TenderId): string {
  return tenderNameKey(id);
}

/** The one-line note of a tenders campaign's rail (an i18n key) — what the holdings are for, by the frame. */
export function tenderNoteKey(model: CampaignModel): string {
  if (model.phase === 'finished') {
    return 'Tenders were executed at the finale\'s start; the unexecuted ones paid 3 M€';
  }
  return 'Tenders execute at the finale\'s start; an unexecuted one pays 3 M€';
}
