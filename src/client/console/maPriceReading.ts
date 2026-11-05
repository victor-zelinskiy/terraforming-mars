/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PRICE OF A MILESTONE / AN AWARD NAMES ITS CAUSE (PC01 Nirgal Enterprises · ledger GO). The engine used to hand
 * the console ONE number, so a 0 read as a bare «Бесплатно» — the same word as Vitor's free sponsorship, with no
 * cause, no printed price and nothing to tell two corporations apart. Every surface that prints a claim / funding price
 * (the overview's «ЦЕНА» chip, the milestone's exchange cell, the awards ladder, the ceremony) reads it through ONE
 * pure function, and the WAIVED reading through one renderer (`foundation/ConsoleMaWaivedPrice.vue`):
 *
 *   `paid`   — a number the player pays, printed as it always was (the PL-1621 price flight stays untouched);
 *   `waived` — the table's price struck, «0 M€», the source's seal (`PremiumModifierMarks` — the card silhouette of a
 *              standing corporation effect); nothing is armed, nothing flies, the M€ row never ticks;
 *   `free`   — Vitor's free sponsorship (its own rule, its own words «Бесплатно» / «Бесплатное спонсирование») — and the
 *              degrade of a 0 with no named cause (a model that predates the waiver).
 *
 * The printed price and the waiver are SERVER facts (`MaCostsModel.printed` / `.waiver`, a funded slot's `paid` /
 * `waivedBy`) — the client never derives the printed price of the NEXT step from the constants. Pure: no Vue, no DOM.
 */
import {CardName} from '@/common/cards/CardName';
import {MaCostsModel} from '@/common/models/PlayerModel';

export type MaPriceReading =
  | {kind: 'paid', price: number}
  | {kind: 'waived', printed: number | undefined, waivedBy: CardName}
  | {kind: 'free'};

export type MaPriceFacts = {
  /** What will be (was) charged. */
  price: number,
  /** The table's price as if nothing waived it — undefined where the server states none (a funded slot). */
  printed?: number,
  /** The card that waived the price (the server's `waiver` / a slot's `waivedBy`). */
  waivedBy?: CardName,
  /** Vitor's free sponsorship — its OWN rule, never a waiver. */
  free?: boolean,
};

export function maPriceReading(facts: MaPriceFacts): MaPriceReading {
  if (facts.free === true) {
    return {kind: 'free'};
  }
  if (facts.waivedBy !== undefined && facts.price === 0) {
    // A printed price that was already 0 is no saving to name — the seal alone still says WHO makes it free.
    const printed = facts.printed !== undefined && facts.printed > 0 ? facts.printed : undefined;
    return {kind: 'waived', printed, waivedBy: facts.waivedBy};
  }
  if (facts.price === 0) {
    return {kind: 'free'};
  }
  return {kind: 'paid', price: facts.price};
}

/**
 * A FUNDED slot's reading — the price it WENT for (PAST): the server's `paid` with the card that waived it, or the
 * rules' price of that slot for a save that predates the fact (the degrade — `rulesPrice`). A slot funded for 0 with
 * no waiver (Vitor's sponsorship) reads its number, 0 — the past is a number, «Бесплатно» is a word for the next press.
 */
export function maFundedSlotReading(slot: {paid?: number, waivedBy?: CardName}, rulesPrice: number): MaPriceReading {
  if (slot.paid === undefined) {
    return {kind: 'paid', price: rulesPrice};
  }
  if (slot.waivedBy !== undefined && slot.paid === 0) {
    return {kind: 'waived', printed: undefined, waivedBy: slot.waivedBy};
  }
  return {kind: 'paid', price: slot.paid};
}

/** The price is charged off the rail (the PL-1621 flight arms) only when it is a number above 0. */
export function maPriceCharged(reading: MaPriceReading): boolean {
  return reading.kind === 'paid' && reading.price > 0;
}

/** The waiver of one kind's NEXT price, as the server states it. */
export type MaPriceWaiver = {printed?: number, waivedBy: CardName};

/** The server's waiver of the next claim / funding (`maCosts.waiver` + `.printed`) — undefined when nobody waives. */
export function maPriceWaiverOf(costs: MaCostsModel | undefined, kind: 'milestones' | 'awards'): MaPriceWaiver | undefined {
  const key = kind === 'milestones' ? 'milestone' : 'award';
  const waivedBy = costs?.waiver?.[key];
  if (waivedBy === undefined) {
    return undefined;
  }
  const printed = costs?.printed?.[key];
  return printed !== undefined ? {printed, waivedBy} : {waivedBy};
}

/** A FUNDED award slot in FUNDING order — its sponsor's seat and the price it went for (the server's fact). */
export type MaSponsorSlot = {color: string, paid?: number, waivedBy?: CardName};
