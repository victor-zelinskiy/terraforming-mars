import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';

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
};

export function emptyParliamentHolds(): ParliamentDisplayHolds {
  return {returns: new Map(), support: new Map(), hiddenCubes: new Set(), lobby: new Set(), freshFaces: new Set(), deckPending: 0, govAwaits: undefined, parked: undefined};
}

export const parliamentHolds = reactive(emptyParliamentHolds()) as ParliamentDisplayHolds;

export function resetParliamentHolds(): void {
  Object.assign(parliamentHolds, emptyParliamentHolds());
}
