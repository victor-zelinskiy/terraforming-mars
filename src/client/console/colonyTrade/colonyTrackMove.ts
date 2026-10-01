/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CHOSEN TRACK'S MOVE, PLAYED ON THE STAGE IT WAS CONFIRMED ON (Turmoil
 * Redux TR07 Colony Sponsors — docs/TURMOIL_REDUX_COLONY_SPONSORS.md §5).
 *
 * The move is a FACT of the answer (the server set the marker at the top), so
 * the screen may show it only AFTER the answer — and must show it as a move,
 * never a marker that jumped. Three beats, one owner each:
 *
 *  · THE PROMISE (`promiseColonyTrackMove`) — set at A, by whoever submits the
 *    pick (the staged commit, the live door's confirm): which tile, whose card,
 *    the server's projection. Nothing moves yet; nothing is held.
 *  · THE SEED (`seedColonyTrackMoveHolds`) — in the transport's apply block,
 *    the SAME synchronous block as the view (the law every reward hold obeys:
 *    a hold seeded a tick late paints the new marker for a frame first). It
 *    reads the DIFF of the two views — the promised tile's marker moved
 *    forward — holds the tile at its old cell and owes the move. ONLY when the
 *    stage that will play it stands (the shell's registered probe): a hold
 *    nobody will release freezes the track for good, so with no stage the
 *    marker simply shows the server's position.
 *  · THE MOVE (`playOwedColonyTrackMove`) — ONE glide of the ONE track
 *    mechanism (`requestColonyTrackWave`, anchors `stage`, rhythm `rail`): the
 *    hold is released by the landing, never by a timer; a track that cannot be
 *    measured is CONFESSED (`degraded`, on the stage root) and lands in its
 *    final pose.
 *
 * A promise whose answer never moved the tile (a PARKED tail, a re-ask) stays
 * a promise until the flow that made it ends (`clearColonyTrackMove`).
 */
import {reactive} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  ColonyTrackWaveMove, colonyTrackWaveState, finishColonyTrackWave, holdColonyTracks, releaseColonyTrack, requestColonyTrackWave,
} from '@/client/console/colonyTrade/consoleColonyTrade';

/** The confirmed pick: the tile, the card whose effect it is (absent on a live pick with no named giver), the projection. */
export type ColonyTrackMovePromise = {colony: ColonyName, card?: CardName, before: number, after: number};

export const colonyTrackMoveFlow = reactive({
  /** The pick the player CONFIRMED, awaiting its answer. */
  promised: undefined as ColonyTrackMovePromise | undefined,
  /** The move the answer CARRIED — the tile is held at `before` until the stage plays it. */
  owed: undefined as ColonyTrackWaveMove | undefined,
  /** The move is being played on the stage (input is the wave's: none). */
  live: false,
  /** Why the last move could not be flown (a missing track) — '' when it flew. CONFESSED on the stage root. */
  degraded: '',
});

/** «Is the stage that would play a move of `colony` standing right now?» — registered by the shell. */
let hostProbe: (colony: ColonyName) => boolean = () => false;

export function registerColonyTrackMoveHost(probe: ((colony: ColonyName) => boolean) | undefined): void {
  hostProbe = probe ?? (() => false);
}

/** A: the pick is on the wire. */
export function promiseColonyTrackMove(promise: ColonyTrackMovePromise): void {
  colonyTrackMoveFlow.promised = promise;
  colonyTrackMoveFlow.degraded = '';
}

function trackOf(view: PlayerViewModel | undefined, colony: ColonyName): number | undefined {
  return view?.game.colonies.find((c) => c.name === colony)?.trackPosition;
}

/**
 * THE APPLY-BLOCK SEED (`gameTransport.seedRewardHolds`): the promised tile's
 * marker moved forward between the two views → hold it where it stood and
 * owe the move — only while its stage stands. A no-op for every other answer.
 */
export function seedColonyTrackMoveHolds(before: PlayerViewModel | undefined, after: PlayerViewModel | undefined): void {
  const promise = colonyTrackMoveFlow.promised;
  if (promise === undefined || after === undefined) {
    return;
  }
  const was = trackOf(before, promise.colony);
  const now = trackOf(after, promise.colony);
  if (was === undefined || now === undefined || now <= was) {
    // Not landed (yet): a parked tail lands with a later answer, a re-ask never does. The promise stays.
    return;
  }
  colonyTrackMoveFlow.promised = undefined;
  if (!hostProbe(promise.colony)) {
    // Nobody stands to play it: the marker shows the server's position with this very view.
    return;
  }
  holdColonyTracks([{colony: promise.colony, position: was}]);
  colonyTrackMoveFlow.owed = {colony: promise.colony, before: was, after: now};
}

/** The answer carried a move the stage still owes. */
export function colonyTrackMoveOwed(): boolean {
  return colonyTrackMoveFlow.owed !== undefined;
}

/**
 * PLAY the owed move — one glide on the stage's instrument (the tile as the
 * fallback), resolved once the marker has landed and been read. `false` when
 * nothing was owed. A move the layer could not measure lands in its final
 * pose and names itself (`degraded`).
 */
export async function playOwedColonyTrackMove(): Promise<boolean> {
  const move = colonyTrackMoveFlow.owed;
  if (move === undefined) {
    return false;
  }
  colonyTrackMoveFlow.owed = undefined;
  colonyTrackMoveFlow.live = true;
  colonyTrackMoveFlow.degraded = '';
  await requestColonyTrackWave([move], {anchors: 'stage', rhythm: 'rail'});
  colonyTrackMoveFlow.live = false;
  const finish = colonyTrackWaveState.lastFinish;
  if (finish !== 'landed') {
    colonyTrackMoveFlow.degraded = `${move.colony}: ${finish}`;
  }
  return true;
}

/**
 * The flow that promised the move is over (or was refused): every hold of its
 * own released, the move — if mid-flight — ended in its final pose. Idempotent.
 */
export function clearColonyTrackMove(): void {
  const owed = colonyTrackMoveFlow.owed;
  if (owed !== undefined) {
    releaseColonyTrack(owed.colony);
  }
  if (colonyTrackMoveFlow.live) {
    finishColonyTrackWave('abort');
    colonyTrackMoveFlow.live = false;
  }
  colonyTrackMoveFlow.promised = undefined;
  colonyTrackMoveFlow.owed = undefined;
}
