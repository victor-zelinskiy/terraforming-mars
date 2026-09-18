import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ParliamentSlotVm} from './consoleParliamentModel';

/*
 * THE DISPLAY HOLDS — what the delegates zone, the party plaques, the
 * ribbons, the supply and the deck STILL SHOW until each object has
 * physically moved. A scene that replays the political phase (today the
 * results scene; the sitting director after it) writes them as its beats fly
 * the cubes and deal the cards; the tiers read them over the live model, so
 * nothing is drawn at its destination before it has travelled there.
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

/**
 * What the results scene still has to MOVE: every cube stays where it was
 * until its beat flies it. Seeded BEFORE the scene opens, so its first frame
 * already shows the table as it stood before the phase.
 */
export function seedRecapHolds(model: ParliamentModel | undefined, slots: ReadonlyArray<ParliamentSlotVm>, enactedInstance: string | undefined): void {
  const pending = emptyParliamentHolds();
  const last = model?.lastPhase;
  if (last !== undefined && !consoleReducedMotionActive()) {
    for (const entry of last.returned ?? []) {
      pending.returns.set(entry.owner, entry.count);
    }
    for (const fresh of last.refreshed) {
      if (fresh.neutralVotes <= 0) {
        continue;
      }
      const slot = slots.find((s) => s.instance === fresh.instance);
      if (slot === undefined) {
        continue;
      }
      const neutralSeqs = slot.votes.filter((v) => v.owner === 'neutral').map((v) => v.seq).sort((a, b) => a - b).slice(0, fresh.neutralVotes);
      for (const seq of neutralSeqs) {
        pending.hiddenCubes.add(`${slot.instance}#${seq}`);
      }
      pending.support.set(fresh.party, (pending.support.get(fresh.party) ?? 0) + neutralSeqs.length);
    }
    for (const color of last.lobbyRefilled) {
      pending.lobby.add(color);
    }
    // The fresh resolutions are still ON the deck: their faces wait, the pile keeps them.
    for (const fresh of last.refreshed) {
      pending.freshFaces.add(fresh.instance);
    }
    pending.deckPending = last.refreshed.length;
    // THE ENACTED CARD moves in from the slot it won in: its government face
    // waits until the touchdown (an older save without the slot keeps it in place).
    if (last.winner.slot !== undefined && enactedInstance === last.enacted.instance) {
      pending.govAwaits = last.enacted.instance;
    }
  }
  Object.assign(parliamentHolds, pending);
}
