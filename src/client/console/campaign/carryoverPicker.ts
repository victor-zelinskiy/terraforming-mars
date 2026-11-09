// Campaign — «Наследие проектов»: the PURE readings of the carryover step (P87).
//
// Every number here is the SEAT's limit handed down from the server (`CampaignCarryoverModel.yourLimit`, read once by
// `campaignMapModel` as `yourCarryLimit`) — the client never knows a default, and a source guard keeps the server's
// constant out of `src/client/**` (`tests/campaign/carryoverPicker.spec.ts`).

import {CardName} from '@/common/cards/CardName';
import {translateTextWithParams} from '@/client/directives/i18n';

/**
 * One seat of the manifest: its 1-based number, the card that took it (in pick order) and whether a TENDER added it
 * (the «Тендеры» mode's «Расширенное наследие» — the LAST `tenderSeats` places; the server's `yourTenderSeats`).
 */
export type CarryoverSeat = {
  n: number,
  name?: CardName,
  tender?: true,
  /** A PRELUDE seat («Продление программы») — it stands right of the project seats, in its own register. */
  prelude?: true,
  /** The seat a tender's MODE is about to open (§19): previewed in place — a dashed ghost the activation materializes. */
  ghost?: true,
};

/** The manifest — one place per seat of the limit, filled in the order the cards were kept; the tender seats last. */
export function carryoverSeats(limit: number, selected: ReadonlyArray<CardName>, tenderSeats: number = 0): Array<CarryoverSeat> {
  const seats: Array<CarryoverSeat> = [];
  const total = Math.max(0, Math.floor(limit));
  const firstTender = total - Math.max(0, Math.min(total, Math.floor(tenderSeats)));
  for (let i = 0; i < total; i++) {
    const seat: CarryoverSeat = selected[i] !== undefined ? {n: i + 1, name: selected[i]} : {n: i + 1};
    if (i >= firstTender) {
      seat.tender = true;
    }
    seats.push(seat);
  }
  return seats;
}

/** The prelude band's ask («Продление программы»): how many played preludes, into which mission — parameters, never words. */
export function carryoverPreludeAskText(limit: number, nextMission: number): string {
  return translateTextWithParams('Carry up to ${0} played prelude(s) — played again in mission ${1} (Programme Extension)',
    [String(limit), String(nextMission)]);
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

/**
 * THE PRELUDE SEATS («Продление программы», §19): one place per carried prelude of the allowance, in pick order, beside
 * the project seats — and, while the tender stands in its mode, the GHOST of the one its activation opens (the same
 * place the real seat will take: the activation materializes it in place, nothing re-flows).
 */
export function carryoverPreludeSeats(limit: number, selected: ReadonlyArray<CardName>, ghost: boolean = false): Array<CarryoverSeat> {
  const seats: Array<CarryoverSeat> = [];
  const total = Math.max(0, Math.floor(limit));
  for (let i = 0; i < total; i++) {
    seats.push(selected[i] !== undefined ? {n: i + 1, name: selected[i], prelude: true} : {n: i + 1, prelude: true});
  }
  if (ghost) {
    seats.push({n: total + 1, prelude: true, ghost: true});
  }
  return seats;
}

/** The project manifest with the GHOST seat a standing «Расширенное наследие» previews (its number is the next one). */
export function carryoverSeatsWithGhost(limit: number, selected: ReadonlyArray<CardName>, tenderSeats: number, ghost: boolean): Array<CarryoverSeat> {
  const seats = carryoverSeats(limit, selected, tenderSeats);
  if (ghost) {
    seats.push({n: Math.max(0, Math.floor(limit)) + 1, tender: true, ghost: true});
  }
  return seats;
}
