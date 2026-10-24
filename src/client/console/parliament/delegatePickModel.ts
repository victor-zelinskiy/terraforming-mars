/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE DELEGATE MODE — the PURE half (Turmoil Redux TR72 Banned Delegate:redux,
 * docs/TURMOIL_REDUX_BANNED_DELEGATE.md): the Parliament picks ONE FIGURE off
 * the table instead of a resolution or an area. The cursor walks the FIGURES
 * where they stand — on the three bills' ribbons (one stop per owner: «one
 * delegate of X here», the owner's LATEST figure being the one that leaves) and
 * on the plaques' support places (one stop per non-empty area) — and nothing
 * moves; the reading panel says whose figure it is, where it goes and what the
 * table reads without it.
 *
 * Every number is the SERVER's (`SelectParty.delegatePrompt.targets` — one row
 * per figure, built by `RemoveDelegate`): this module orders, finds and words;
 * it computes no forecast and decides no candidate.
 *
 * Pure: no DOM, no Vue, no i18n.
 */
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {DelegateOwner, DelegatePlace, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {DelegatePromptMeta, DelegateTargetProjection, DelegateWinnerProjection} from '@/common/models/PlayerInputModel';
import type {FactValue, VoteFactVm} from './voteInfoModel';
import {partyNameKey} from './partyNames';

/**
 * THE MODE'S STAGE NAME, by what the pick does to the figure — the crumb's tail («КАРТЫ В РУКЕ › ИЗГНАНИЕ ДЕЛЕГАТА ›
 * ИЗГНАНИЕ»), the band's kicker, the frame's stage. One row per `DelegatePromptMeta.source`: TR74 Recruitment's
 * «exchange a neutral delegate» is a new row, never a second mode.
 */
export const DELEGATE_STEP_STAGES: Readonly<Record<DelegatePromptMeta['source'], string>> = {
  remove: 'Banishment',
};

export function delegateStepStageOf(meta: DelegatePromptMeta | undefined): string {
  return meta === undefined ? '' : DELEGATE_STEP_STAGES[meta.source];
}

/** Where a stop stands on screen: the TABLE (a bill's ribbon) or the AREAS (the plaques' support places). */
export type DelegateZone = 'table' | 'areas';

/** One stop of the cursor — a server row and where it stands. */
export type DelegateStop = {
  zone: DelegateZone;
  target: DelegateTargetProjection;
  /** The vote the press would take (the owner's latest on that bill) — the ribbon figure the cursor marks; absent in an area. */
  seq?: number;
};

/** The table as the cursor reads it — the bills in their on-screen order with their votes, and the plaques' order. */
export type DelegateTableVm = {
  slots: ReadonlyArray<{party: ReduxParty, votes: ReadonlyArray<{owner: Color | 'neutral', seq: number}>}>;
  /** The support areas in the order they stand (the opposition column top to bottom, the ruler's tile last). */
  areaOrder: ReadonlyArray<ReduxParty>;
};

/** The owner's latest vote on a bill — the figure that leaves (`Parliament.removeVote`). */
function latestSeq(votes: ReadonlyArray<{owner: Color | 'neutral', seq: number}>, owner: DelegateOwner): number | undefined {
  let best: number | undefined;
  for (const vote of votes) {
    if (vote.owner === owner && (best === undefined || vote.seq > best)) {
      best = vote.seq;
    }
  }
  return best;
}

/**
 * THE CURSOR'S RING — the table's stops first (the bills left to right, inside a bill the owners in the order of
 * the figure that would leave — so the cursor walks the ribbon left to right), then the areas in the order the
 * plaques stand. A server row the table does not show (a reload between two frames) is dropped, never invented.
 */
export function delegateRing(meta: DelegatePromptMeta | undefined, table: DelegateTableVm): Array<DelegateStop> {
  if (meta === undefined) {
    return [];
  }
  const out: Array<DelegateStop> = [];
  table.slots.forEach((slot) => {
    const stops: Array<DelegateStop> = [];
    for (const target of meta.targets) {
      if (target.place !== 'resolution' || target.party !== slot.party) {
        continue;
      }
      const seq = latestSeq(slot.votes, target.owner);
      if (seq !== undefined) {
        stops.push({zone: 'table', target, seq});
      }
    }
    stops.sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0));
    out.push(...stops);
  });
  for (const party of table.areaOrder) {
    const target = meta.targets.find((row) => row.place === 'support' && row.party === party);
    if (target !== undefined) {
      out.push({zone: 'areas', target});
    }
  }
  return out;
}

/** The key of a stop — stable across frames (a bill's owner, an area). */
export function delegateStopKey(stop: Pick<DelegateStop, 'target'>): string {
  return `${stop.target.place}:${stop.target.party}:${stop.target.owner}`;
}

/** Where the cursor starts — the ring's first stop (a CURSOR, never a selection: A is always the player's press). */
export function delegateStartIndex(ring: ReadonlyArray<DelegateStop>): number {
  return ring.length === 0 ? -1 : 0;
}

/**
 * THE D-PAD over the ring, SPATIAL — the table's figures are a ROW (◀ ▶ walk it, clamped at its right end), the
 * areas a COLUMN on the left of it (▲ ▼ walk it, clamped at both ends): ◀ past the table's first figure steps into
 * the column, ▶ out of the column steps onto the table's first figure. Never a wrap that would jump the screen.
 */
export function delegateCursorStep(ring: ReadonlyArray<DelegateStop>, at: number, dir: 'left' | 'right' | 'up' | 'down'): number {
  if (ring.length === 0) {
    return -1;
  }
  const here = ring[at];
  if (here === undefined) {
    return delegateStartIndex(ring);
  }
  const table = ring.map((stop, i) => ({stop, i})).filter((e) => e.stop.zone === 'table').map((e) => e.i);
  const areas = ring.map((stop, i) => ({stop, i})).filter((e) => e.stop.zone === 'areas').map((e) => e.i);
  if (here.zone === 'table') {
    const k = table.indexOf(at);
    if (dir === 'right') {
      return table[Math.min(table.length - 1, k + 1)];
    }
    if (dir === 'left') {
      return k > 0 ? table[k - 1] : (areas[0] ?? at);
    }
    return at;
  }
  const k = areas.indexOf(at);
  if (dir === 'down') {
    return areas[Math.min(areas.length - 1, k + 1)];
  }
  if (dir === 'up') {
    return areas[Math.max(0, k - 1)];
  }
  if (dir === 'right') {
    return table[0] ?? at;
  }
  return at;
}

/** One line of the forecast — present only when the answer changes it (the server's rule). */
export type DelegateForecastLine =
  | {kind: 'votes', current: number, resulting: number}
  | {kind: 'support', current: number, resulting: number}
  | {kind: 'leader', current?: DelegateOwner, resulting?: DelegateOwner}
  | {kind: 'winner', current?: DelegateWinnerProjection, resulting?: DelegateWinnerProjection}
  | {kind: 'effects', parties: ReadonlyArray<PartyName>};

/** THE READING of the figure under the cursor — the panel's whole content. */
export type DelegateReadingVm = {
  place: DelegatePlace;
  party: PartyName;
  owner: DelegateOwner;
  /** The owner's figures in this place now (a bill: their votes on it; an area: its stock). */
  count: number;
  returnsTo: 'reserve' | 'supply';
  /** The figure under the cursor is the ONLY one the card can take (composer-preselect: shown and marked, never applied). */
  sole: boolean;
  lines: ReadonlyArray<DelegateForecastLine>;
};

export function delegateReadingOf(stop: DelegateStop | undefined, ringSize: number): DelegateReadingVm | undefined {
  if (stop === undefined) {
    return undefined;
  }
  const t = stop.target;
  const lines: Array<DelegateForecastLine> = [
    t.place === 'resolution' ?
      {kind: 'votes', current: t.total.current, resulting: t.total.resulting} :
      {kind: 'support', current: t.total.current, resulting: t.total.resulting},
  ];
  if (t.leader !== undefined) {
    lines.push({kind: 'leader', ...(t.leader.current === undefined ? {} : {current: t.leader.current}), ...(t.leader.resulting === undefined ? {} : {resulting: t.leader.resulting})});
  }
  if (t.winner !== undefined) {
    lines.push({kind: 'winner', ...(t.winner.current === undefined ? {} : {current: t.winner.current}), ...(t.winner.resulting === undefined ? {} : {resulting: t.winner.resulting})});
  }
  if (t.effectsLost !== undefined && t.effectsLost.length > 0) {
    lines.push({kind: 'effects', parties: t.effectsLost});
  }
  return {place: t.place, party: t.party, owner: t.owner, count: t.count, returnsTo: t.returnsTo, sole: ringSize === 1, lines};
}

/** The bill's figure under the cursor (`instance`-free: a bill is its party) — the ribbon's «уходит» mark. */
export function delegateOutgoingSeq(stop: DelegateStop | undefined, party: ReduxParty): number | undefined {
  return stop?.zone === 'table' && stop.target.party === party ? stop.seq : undefined;
}

/** The area under the cursor — its plaque marks ONE outgoing place (the last standing, the one a removal takes). */
export function delegateOutgoingArea(stop: DelegateStop | undefined, party: ReduxParty): number {
  return stop?.zone === 'areas' && stop.target.party === party ? 1 : 0;
}

/** What the facts need from the table: a seat's display name, a bill's printed name (an English key) by its party. */
export type DelegateFactNames = {
  owner: (owner: DelegateOwner) => string;
  resolution: (party: PartyName) => string | undefined;
};

/**
 * THE READING AS FACT ROWS — the vote panel's own row (`ConsoleVoteFactRow`: «КЛЮЧ current → resulting»), so the
 * delegate mode speaks the vote's language: «ДЕЛЕГАТЫ 3 → 2», «ЛИДЕР [фигура] → [фигура]», «ПОБЕЖДАЕТ «R» → «R′»»,
 * «ЭФФЕКТ ПАРТИИ «X» → Потеряно». Every value is the server's row; nothing is derived here.
 */
export function delegateFactsOf(reading: DelegateReadingVm, names: DelegateFactNames): Array<VoteFactVm> {
  const ownerValue = (owner: DelegateOwner | undefined): FactValue => owner === undefined ?
    {key: '—', raw: true, dash: true} : {key: names.owner(owner), raw: true, cube: owner === 'neutral' ? 'neutral' : owner};
  const winnerValue = (winner: DelegateWinnerProjection | undefined): FactValue => {
    if (winner === undefined) {
      return {key: '—', raw: true, dash: true};
    }
    const name = names.resolution(winner.party);
    return {key: name ?? partyNameKey(winner.party), cube: winner.owner === 'neutral' ? 'neutral' : winner.owner};
  };
  return reading.lines.flatMap((line): Array<VoteFactVm> => {
    switch (line.kind) {
    case 'votes':
    case 'support':
      return [{
        id: 'votes', label: line.kind === 'votes' ? 'Delegates' : 'Popular support',
        before: {key: String(line.current), raw: true}, after: {key: String(line.resulting), raw: true},
        unchanged: false, tone: 'keep', note: undefined,
      }];
    case 'leader':
      return [{id: 'lead', label: 'Leader', before: ownerValue(line.current), after: ownerValue(line.resulting), unchanged: false, tone: 'keep', note: undefined}];
    case 'winner':
      // The SAME resolution keeps winning and only its winner changes: the row names the seats («player2 → player1»),
      // never «R → R» (the resolution reads in the band and on the bill).
      if (line.current !== undefined && line.resulting !== undefined && line.current.party === line.resulting.party) {
        return [{id: 'win', label: 'Leading the vote', before: ownerValue(line.current.owner), after: ownerValue(line.resulting.owner), unchanged: false, tone: 'keep', note: undefined}];
      }
      return [{id: 'win', label: 'Leading the vote', before: winnerValue(line.current), after: winnerValue(line.resulting), unchanged: false, tone: 'keep', note: undefined}];
    case 'effects':
      return line.parties.map((party): VoteFactVm => ({
        id: 'effect', label: 'Party effect', before: {key: partyNameKey(party)}, after: {key: 'Lost'}, unchanged: false, tone: 'keep', note: undefined,
      }));
    }
  });
}
