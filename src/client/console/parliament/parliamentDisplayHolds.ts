import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import type {ParliamentSlotVm} from './consoleParliamentModel';

/*
 * THE DISPLAY HOLDS — what the delegates zone, the party plaques, the
 * ribbons, the supply and the deck STILL SHOW until each object has
 * physically moved. The SITTING DIRECTOR (Э4 — `sittingDirector.ts`) writes
 * them as its beats fly the cubes and deal the cards; the tiers read them over
 * the live model, so nothing is drawn at its destination before it has
 * travelled there. The director seeds them per stage (`seedEnactHolds` /
 * `seedRenewalHolds`) and its beats consume them touchdown by touchdown.
 */
export type ParliamentDisplayHolds = {
  /** Delegates that left the enacted card and have not reached their reserve / the supply yet. */
  returns: Map<Color | 'neutral', number>;
  /** Popular-support cubes that have not left their party's places yet (party → count). */
  support: Map<ReduxParty, number>;
  /** Neutral cubes on a fresh card that have not arrived yet (`instance#seq`). */
  hiddenCubes: Set<string>;
  /** Players whose free delegate has not reached the lobby yet. */
  lobby: Set<Color>;
  /** Fresh resolutions whose card has not been dealt from the deck yet (their faces stay hidden). */
  freshFaces: Set<string>;
  /** Cards the deck still SHOWS on its pile (dealt in the model, not yet flown). */
  deckPending: number;
  /** The ENACTED card whose government face waits until it has moved in from its voting slot (its instance). */
  govAwaits: string | undefined;
  /** The proxy (flight id) of that card, parked over its former voting slot until the enactment beat. */
  parked: string | undefined;
  /**
   * THE VOTING SLOTS AS THEY STOOD before the server's refresh — the losers
   * with their delegate ribbons and tallies — while the REWARD pose is HELD
   * through the step that arrived with the record (registry R-25в: the
   * columns showed the refreshed table under a page still reading «this
   * payout»). The renewal's entry releases it; the beat then flies the
   * losers off from the same homes.
   */
  heldSlots: ReadonlyArray<ParliamentSlotVm> | undefined;
};

export function emptyParliamentHolds(): ParliamentDisplayHolds {
  return {returns: new Map(), support: new Map(), hiddenCubes: new Set(), lobby: new Set(), freshFaces: new Set(), deckPending: 0, govAwaits: undefined, parked: undefined, heldSlots: undefined};
}

export const parliamentHolds = reactive(emptyParliamentHolds()) as ParliamentDisplayHolds;

export function resetParliamentHolds(): void {
  Object.assign(parliamentHolds, emptyParliamentHolds());
}

/**
 * THE TABLE AS IT STOOD when the sitting's frame YIELDED to the board (the
 * winner's tile): the section unmounts, the server refreshes the slots
 * meanwhile, and the receipt pose the frame comes back to keeps the losers
 * on the table (registry R-25в). Module-level on purpose — it must survive
 * the unmount; the next mount TAKES it (consumed by the receipt, discarded by
 * a fresh open).
 */
let slotsBeforeYield: ReadonlyArray<ParliamentSlotVm> | undefined;

export function noteSlotsBeforeYield(slots: ReadonlyArray<ParliamentSlotVm>): void {
  slotsBeforeYield = slots;
}

export function takeSlotsBeforeYield(): ReadonlyArray<ParliamentSlotVm> | undefined {
  const out = slotsBeforeYield;
  slotsBeforeYield = undefined;
  return out;
}
