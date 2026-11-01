// Campaign — «Наследие проектов»: the PURE readings of the carryover step (P87).
//
// Every number here is the SEAT's limit handed down from the server (`CampaignCarryoverModel.yourLimit`, read once by
// `campaignMapModel` as `yourCarryLimit`) — the client never knows a default, and a source guard keeps the server's
// constant out of `src/client/**` (`tests/campaign/carryoverPicker.spec.ts`).

import {CardName} from '@/common/cards/CardName';
import {translateTextWithParams} from '@/client/directives/i18n';

/** One seat of the manifest: its 1-based number and the card that took it (in pick order). */
export type CarryoverSeat = {n: number, name?: CardName};

/** The manifest — one place per seat of the limit, filled in the order the cards were kept. */
export function carryoverSeats(limit: number, selected: ReadonlyArray<CardName>): Array<CarryoverSeat> {
  const seats: Array<CarryoverSeat> = [];
  for (let i = 0; i < Math.max(0, Math.floor(limit)); i++) {
    seats.push(selected[i] !== undefined ? {n: i + 1, name: selected[i]} : {n: i + 1});
  }
  return seats;
}

/** The question line: how many cards, into which mission — the limit is a parameter, never a word. */
export function carryoverAskText(limit: number, nextMission: number): string {
  if (limit <= 0) {
    return translateTextWithParams('No project card can be carried into mission ${0}', [String(nextMission)]);
  }
  return translateTextWithParams('Keep up to ${0} project card(s) — they travel into mission ${1}, free of charge',
    [String(limit), String(nextMission)]);
}

/** A kept card's band — the mission it travels into and its SEAT («✓ В миссию 2 · 1»). */
export function carryoverBandText(nextMission: number, seat: number): string {
  return '✓ ' + translateTextWithParams('Into mission ${0} · ${1}', [String(nextMission), String(seat)]);
}
