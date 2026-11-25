/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE ALLIANCE'S ACTIVATION IS SEEN ONCE (Turmoil Redux — TR62 Tharsis Alliance, the owner's decision 5a): when the
 * viewer comes to hold a party BY THE ALLIANCE road, ONE impulse of light leaves the PARTNER's seal for the ally's and
 * the ally's borrowed ring answers on its arrival. The road usually opens where the chamber is NOT on screen — the
 * card is played from the hand, the second cube is sent from the vote panel that covers the benches, the enactment
 * changes the government mid-walk — so the impulse is OWED until the chamber can show it, and played the first time
 * both seals are SEEN (never over a panel that covers them, never before the beat that caused it), then never again.
 *
 * Module state (it outlives the chamber's mounts): the parties the viewer has been SHOWN as allied. The first view of
 * a game seeds it silently — a reload or a fresh load lands in the final pose, nothing replays. A party that stops
 * being allied is forgotten, so a later activation plays again. Reset with the sitting's seed (a game switch).
 */
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PartyAccessModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {accessRoadOf} from './consoleParliamentModel';

let seen: Set<ReduxParty> | undefined;

/**
 * WHERE THE OWED IMPULSE STANDS — what the chamber knows each tick about whether it COULD show it (the box's game 1439:
 * the fullscreen viewer covered the seals, the chamber knew every tick it could not launch, and the enactment's tail
 * still waited 1.6 s for a start that could not come and said a ceiling):
 *  · `unmounted` — no chamber on screen to show it;
 *  · `idle`      — the chamber stands, its attempt has not begun (an access change is about to start it);
 *  · `resting`   — a sitting's beat still plays — the attempt waits for the chamber's rest;
 *  · `arming`    — at rest, both seals seen, the stillness check pending — the spark is a tick away;
 *  · `covered`   — at rest and the seals are NOT seen (a viewer, a panel over them) — or the attempt's window ended so.
 */
export type AllianceImpulseProspect = 'unmounted' | 'idle' | 'resting' | 'arming' | 'covered';

export const allianceImpulseState = {
  /** Impulses owed to the chamber right now (computed by the chamber when it reads the viewer's access). */
  pending: new Set<ReduxParty>(),
  /** An impulse in the air. */
  flying: 0,
  /** What the chamber knows of the owed impulse's chances right now (written by the chamber's attempt, every tick). */
  prospect: 'unmounted' as AllianceImpulseProspect,
};

/** The parties a seat holds BY THE ALLIANCE road (the one helper reads the road). */
export function alliedPartiesOf(access: ReadonlyArray<PartyAccessModel> | undefined): Array<ReduxParty> {
  return (access ?? []).filter((a) => accessRoadOf(a) === 'alliance').map((a) => a.party);
}

/** The viewer's own access off a view (`undefined` for a spectator / a game with no Parliament). */
function viewerAccess(view: PlayerViewModel): ReadonlyArray<PartyAccessModel> | undefined {
  const color = view.thisPlayer?.color;
  return view.game.parliament?.players.find((p) => p.color === color)?.access;
}

/** SEED (the apply block): the first view after a reset is the pose the player lands in — no impulse is owed for it. */
export function seedAllianceSeen(view: PlayerViewModel): void {
  if (seen === undefined) {
    seen = new Set(alliedPartiesOf(viewerAccess(view)));
  }
}

/** What the chamber owes NOW: the allied parties never shown as allied (a lost alliance is forgotten). */
export function owedAllianceImpulses(allied: ReadonlyArray<ReduxParty>): Array<ReduxParty> {
  // No view was seeded (a test mount): what stands is the pose.
  const shown = seen ?? new Set(allied);
  seen = shown;
  for (const party of Array.from(shown)) {
    if (!allied.includes(party)) {
      shown.delete(party);
    }
  }
  const owed = allied.filter((p) => !shown.has(p));
  allianceImpulseState.pending = new Set(owed);
  return owed;
}

/** The impulse for `party` has been played (or its answer shown at once) — it is never owed again. */
export function noteAllianceImpulseSeen(party: ReduxParty): void {
  seen?.add(party);
  allianceImpulseState.pending.delete(party);
}

/**
 * THE ENACTMENT'S TAIL WAITS FOR THE IMPULSE (the card a change of power draws is the NEXT beat — two objects never
 * move at once): resolves when nothing is owed and nothing is in the air, or after `capMs` (bounded, named).
 */
export function allianceImpulsesSettled(capMs: number, tick: (fn: () => void) => void): Promise<void> {
  const started = Date.now();
  return new Promise((resolve) => {
    const check = () => {
      if ((allianceImpulseState.pending.size === 0 && allianceImpulseState.flying === 0) || Date.now() - started >= capMs) {
        resolve();
        return;
      }
      tick(check);
    };
    check();
  });
}

/** Full reset (game switch, test cleanup). */
export function resetAllianceImpulse(): void {
  seen = undefined;
  allianceImpulseState.pending = new Set();
  allianceImpulseState.flying = 0;
  allianceImpulseState.prospect = 'unmounted';
}
