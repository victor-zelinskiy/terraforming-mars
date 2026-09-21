import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {ParliamentPhaseSummaryModel} from '@/common/models/ParliamentModel';

/**
 * НАРОДНАЯ ПОДДЕРЖКА — the scene, as data («Заседание v3», В3).
 *
 * THE RULE the scene tells (the server's own, `ParliamentPhase.stepSupport`): right before the enactment
 * four parties gain popular support. The two parties represented NEITHER on a voting card NOR in the
 * government gain one NEUTRAL delegate each; then every UNENACTED resolution of the area brings its own
 * party one neutral delegate, and a second one when at least one player's delegate stands on that card.
 *
 * Everything about that is POSITIONAL, so the scene is built from the objects on screen and never from a
 * sentence: the ROLL CALL marks each party from the card that speaks for it (a slot, or the government),
 * and every cube then flies from the place it comes FROM — the neutral supply for an absent party, the
 * card itself for an unenacted resolution, that card's delegate ribbon for the second one. The enacted
 * card gives nothing, and that is visible: it is already marked as the one being enacted.
 *
 * Pure and server-authoritative: the COUNTS are the summary's (`gained`), the sources are its `reason`,
 * the order is the table's. Spec: `tests/console/supportScene.spec.ts`.
 */

/** Why a party stands where it stands in the roll call — one word per case, the tile's own state row. */
export type SupportStatus =
  /** Its resolution is the one being enacted: it gains nothing. */
  | 'enacted'
  /** Its resolution stayed on the table: it gains support from that card. */
  | 'lost'
  /** Neither on the table nor in the government: it gains support from the supply. */
  | 'absent'
  /** It rules: it gains nothing (its own card is the government's). */
  | 'ruling';

/** WHERE one cube comes from — a place on screen, never a caption. */
export type SupportSource =
  | {from: 'supply'}
  | {from: 'card', instance: string}
  | {from: 'ribbon', instance: string};

/** WHAT marks a party in the roll call — the object that speaks for it. */
export type SupportMark = {kind: 'slot', instance: string} | {kind: 'government'} | {kind: 'none'};

export type SupportRollEntry = {party: ReduxParty, status: SupportStatus, mark: SupportMark};
export type SupportWaveEntry = {
  party: ReduxParty,
  /** WHICH WAVE this is — the band reads the rule off it: the absent parties first, the unenacted cards after. */
  status: 'absent' | 'lost',
  cubes: ReadonlyArray<SupportSource>,
  /** The party's places are FULL: the cube arrives, the sockets answer as full, and it goes back to the supply. */
  overflow?: true,
};

export type SupportScene = {
  /** The roll call, left to right: the table's cards, then the government, then the parties nobody spoke for. */
  roll: ReadonlyArray<SupportRollEntry>;
  /** The waves, in playing order: the absent parties from the supply, then the unenacted cards. */
  waves: ReadonlyArray<SupportWaveEntry>;
};

/** A slot of the voting area AS SHOWN (the table as it was voted — the held slots while the sitting holds them). */
export type SupportSlot = {instance: string, party: ReduxParty};

/** The status a party keeps when two roles meet: an unenacted card outranks ruling (it does gain support). */
const STATUS_RANK: Record<SupportStatus, number> = {enacted: 3, lost: 2, ruling: 1, absent: 0};

/**
 * THE SCENE for one sitting's support step. `slots` is the table AS VOTED (the winner among them);
 * `summary.support` is the server's record — a party with no record simply gains nothing.
 */
export function supportSceneOf(
  summary: Pick<ParliamentPhaseSummaryModel, 'winner' | 'support'>,
  slots: ReadonlyArray<SupportSlot>,
  rulingParty: ReduxParty | undefined,
): SupportScene {
  const gains = new Map(summary.support.map((entry) => [entry.party, entry]));
  const roll: Array<SupportRollEntry> = [];
  const seen = new Map<ReduxParty, number>();
  const add = (party: ReduxParty, status: SupportStatus, mark: SupportMark): void => {
    const at = seen.get(party);
    if (at === undefined) {
      seen.set(party, roll.length);
      roll.push({party, status, mark});
      return;
    }
    // One entry per party: the stronger role speaks, and a card's mark outranks having none.
    const held = roll[at];
    if (STATUS_RANK[status] > STATUS_RANK[held.status]) {
      roll[at] = {party, status, mark: mark.kind === 'none' ? held.mark : mark};
    }
  };
  // ① The table, left to right: the winner is the card being enacted, every other card speaks for its party.
  for (const slot of slots) {
    add(slot.party, slot.instance === summary.winner.instance ? 'enacted' : 'lost', {kind: 'slot', instance: slot.instance});
  }
  // ② The government's card speaks for the party that rules.
  if (rulingParty !== undefined) {
    add(rulingParty, 'ruling', {kind: 'government'});
  }
  // ③ …and whoever the server paid as ABSENT was spoken for by nobody.
  for (const [party, entry] of gains) {
    if (entry.reason === 'absent') {
      add(party, 'absent', {kind: 'none'});
    }
  }

  // THE WAVES: the absent parties first (the supply answers), then the table's unenacted cards in their own order.
  const waves: Array<SupportWaveEntry> = [];
  for (const entry of roll) {
    if (entry.status !== 'absent') {
      continue;
    }
    const record = gains.get(entry.party);
    if (record === undefined) {
      continue;
    }
    if (record.gained > 0) {
      waves.push({party: entry.party, status: 'absent', cubes: Array.from({length: record.gained}, () => ({from: 'supply'} as SupportSource))});
    } else {
      // The server paid nothing because the party is FULL: the cube still travels, and the sockets say why.
      waves.push({party: entry.party, status: 'absent', cubes: [{from: 'supply'}], overflow: true});
    }
  }
  for (const entry of roll) {
    if (entry.status !== 'lost' || entry.mark.kind !== 'slot') {
      continue;
    }
    const record = gains.get(entry.party);
    if (record === undefined) {
      continue;
    }
    const instance = entry.mark.instance;
    if (record.gained === 0) {
      waves.push({party: entry.party, status: 'lost', cubes: [{from: 'card', instance}], overflow: true});
      continue;
    }
    // The FIRST cube is the card's own; the SECOND (a player's delegate stands on it) leaves that card's
    // delegate ribbon — two cubes, two different places, not one place twice.
    const cubes: Array<SupportSource> = [];
    for (let n = 0; n < record.gained; n++) {
      cubes.push(n === 1 && record.reason === 'lost-with-player-vote' ? {from: 'ribbon', instance} : {from: 'card', instance});
    }
    waves.push({party: entry.party, status: 'lost', cubes});
  }
  return {roll, waves};
}

/** The roll call's i18n key per status — the glossary's wording, one line per case. */
export function supportStatusKey(status: SupportStatus): string {
  switch (status) {
  case 'enacted': return 'Winning';
  case 'lost': return 'Not enacted';
  case 'absent': return 'Not in the vote';
  case 'ruling': return 'Ruling';
  }
}
