import {expect} from 'chai';
import {computed, watch, WatchStopHandle} from 'vue';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceId} from '@/common/Types';
import {TileType} from '@/common/TileType';
import {TileMoveRecordModel} from '@/common/boards/TileMove';
import {
  abortRemotePlacements, handRemoteLandingsOver, isRemotePlacementActive, remoteLandingBehindScreen, remoteLandingOwed, remotePlacementState,
  stageRemotePlacements,
} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {collectWaitNodes} from '@/client/console/waitGraph/waitGraph';
import {resetTileMoveClaims} from '@/client/console/tilePlacement/tileMoveRecords';
import {clearRemoteRevealHolds, isRemoteRevealHeld} from '@/client/console/tilePlacement/remoteRevealHold';
import {
  abortRemoteNomadMoves, isRemoteNomadMoveActive, nomadCellHidden, nomadMoveState, stageRemoteNomadMove,
} from '@/client/console/nomads/consoleNomadMove';
import {enterWorkspace, resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {activeAnimationHoldLabels, refreshAnimationHolds} from '@/client/components/presentation/animationHold';

/**
 * A REMOTE BOARD QUEUE HOLDS THE PRESENTATION FOR ITS SCENE, NEVER FOR ITS WAIT — and never across its own queue.
 *
 * The field log of 2026-10-23 («Коммерческая сеть»): `tile-placement-remote` held for 35 s with
 * `{active: true, waitingForBoard: true, queued: 1, draining: true}`. Another seat's two tiles were queued; the first
 * landed and left its stage flag up, the player opened «Действия карт», the second landing parked for the covered board
 * — and the hold still stood, because the predicate read the stale flag first. The action's own draw waits for the
 * blocking holds («Берём карты из колоды…» standing still), the landing waited for the workspace to leave: a deadlock
 * that only the 35 s ceiling ended. The nomads' remote hop had the very same shape.
 *
 * Both queues are driven exactly that way — event 1 on stage, the board covered, event 2 parked — and the PARK must
 * reach the registry at once (a `sync` watcher sees the release, no sweep needed): the workspace's own draw is what
 * is waiting on it.
 */
function space(id: string, over: Partial<SpaceModel> = {}): SpaceModel {
  return {id, x: 0, y: 0, spaceType: 'land', bonus: [], ...over} as unknown as SpaceModel;
}

/** A measurable board cell (JSDOM reports every rect 0×0). Returns a teardown. */
function boardCell(id: string, at: {x: number, y: number}): () => void {
  const cell = document.createElement('div');
  cell.className = 'board-space';
  cell.setAttribute('data_space_id', id);
  cell.getBoundingClientRect = () => ({
    x: at.x, y: at.y, left: at.x, top: at.y, right: at.x + 46, bottom: at.y + 51, width: 46, height: 51, toJSON: () => ({}),
  } as DOMRect);
  document.body.appendChild(cell);
  return () => cell.remove();
}

/** Resolve once `pred` holds (polled on short timers — they fire in due order, so a window of ≥ 60 ms is never missed). */
function until(pred: () => boolean, what: string, maxMs = 4000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (pred()) {
        resolve();
      } else if (Date.now() - started > maxMs) {
        reject(new Error(`timed out waiting for: ${what}`));
      } else {
        setTimeout(tick, 5);
      }
    };
    tick();
  });
}

/** Every value the predicate takes through a REACTIVE edge, the moment it takes it (the registry's own kind of read). */
function recordEdges(predicate: () => boolean): {edges: Array<boolean>, stop: WatchStopHandle} {
  const edges: Array<boolean> = [];
  const stop = watch(predicate, (value) => {
    edges.push(value);
  }, {flush: 'sync'});
  return {edges, stop};
}

describe('a remote board queue — the hold is for the scene, never for the wait', function() {
  // The queues' real timers are walked (the first look's probe tick, the 140 ms board poll, the 320 ms settle).
  // eslint-disable-next-line no-invalid-this
  this.timeout(10_000);
  let stopEdges: WatchStopHandle | undefined;
  const teardowns: Array<() => void> = [];

  afterEach(() => {
    stopEdges?.();
    stopEdges = undefined;
    teardowns.splice(0).forEach((teardown) => teardown());
    resetWorkspaceStack();
    abortRemotePlacements();
    abortRemoteNomadMoves();
    clearRemoteRevealHolds();
    resetTileMoveClaims();
  });

  it('TILES: the second landing parks for a covered board holding NOTHING — the first one\'s stage is down', async () => {
    // Event 1 — red's city MOVES 10 → 11 (the server's record); with no stage to fly on it degrades, and its degrade
    // beat stands the stage up for 60 ms (`degradeMove`): the stage flag the old predicate read first.
    // Event 2 — blue's greenery lands on 12 in the same response.
    const prev = [space('10', {tileType: TileType.CITY, color: 'red'}), space('11'), space('12')];
    const next = [space('10'), space('11', {tileType: TileType.CITY, color: 'red'}), space('12', {tileType: TileType.GREENERY, color: 'blue'})];
    const record: TileMoveRecordModel = {seq: 7301, from: '10' as SpaceId, to: '11' as SpaceId, tileType: TileType.CITY, color: 'red'};
    const recorded = recordEdges(isRemotePlacementActive);
    stopEdges = recorded.stop;

    stageRemotePlacements(prev, next, {gamePhase: 'action', tileMoves: [record]});
    expect(isRemotePlacementActive(), 'staged over a board in view: the landings hold').is.true;

    await until(() => remotePlacementState.moveDegraded, 'event 1 on stage (its degrade beat)');
    expect(remotePlacementState.active, 'event 1 stands the stage up').is.true;
    expect(isRemotePlacementActive()).is.true;
    // …and the player opens «Действия карт»: the board is covered.
    enterWorkspace('card-actions');

    await until(() => remotePlacementState.waitingForBoard, 'event 2 parked for the covered board');
    expect(remotePlacementState.active, 'nothing of event 1 is on stage through event 2\'s wait').is.false;
    expect(isRemotePlacementActive(), 'a landing parked for the board holds nothing').is.false;
    expect(recorded.edges[recorded.edges.length - 1], 'the release reached the registry at the park itself — no sweep needed').eq(false);
    refreshAnimationHolds();
    expect(activeAnimationHoldLabels(), 'the workspace\'s own draw is not held behind the parked landing')
      .not.includes('tile-placement-remote[blocking]');

    // The player comes back to the board: the landing holds again (its settle on a board in view, then its scene) —
    // read off the reactive edges, since the settle's length is the motion scale's, not this spec's.
    resetWorkspaceStack();
    await until(() => !isRemoteRevealHeld('12'), 'event 2 landed (degraded: no stage)');
    expect(recorded.edges.slice(0, 3), 'held on stage → released by the park → re-raised by the board\'s return').deep.eq([true, false, true]);
    expect(isRemotePlacementActive(), 'the queue is done').is.false;
  });

  it('«OWED» IS REACTIVE TO THE END: a cached computed falls with the drain, even after a DEGRADED landing', async () => {
    // The owner's field hang of 2026-10-30: a standard project's greenery / city — and every placement after it — stood
    // with NO grid until a reload. The shell's `remote-landing` admission block is a CACHED computed over
    // `remoteLandingOwed()`; it was re-read in the flush `queued → 0` scheduled, while the drain was still finishing,
    // and the drain's own end moved nothing reactive on a degraded landing (no stage ever stood up: `active` false
    // already). Here the landing degrades the same way (JSDOM: no measurable cell), and a PRE-flush watcher reads the
    // computed exactly as the shell's watchers do.
    const owed = computed(() => remoteLandingOwed());
    const seen: Array<boolean> = [];
    stopEdges = watch(owed, (value) => {
      seen.push(value);
    }, {immediate: true});

    stageRemotePlacements([space('31')], [space('31', {tileType: TileType.GREENERY, color: 'blue'})], {gamePhase: 'action'});
    expect(owed.value, 'a foreign tile is owed to the board').is.true;

    await until(() => !isRemoteRevealHeld('31'), 'the landing resolved (degraded: no stage)');
    // The drain's tail (the viewer's score shares, its `finally`) — the RAW predicate is the witness, never a sleep.
    await until(() => !remotePlacementState.draining && !remotePlacementState.active, 'the drain ended');
    expect(remotePlacementState.active, 'a degraded landing never stood a stage up').is.false;
    expect(owed.value, 'the cached «owed» fell with the drain — no placement is held for a landing that is over').is.false;
    expect(seen[seen.length - 1], 'and its watchers were told').eq(false);
  });

  /*
   * THE LANDING LAW (FREEZE ZERO, stage 6 — «like a clock, not on its nets», 2026-11-25). The wait for the board had
   * twenty seconds of the WALL: a tile of another seat placed while the player read their hand was «revealed without
   * its flight» under that hand — fifteen such lines in thirty-eight whole games, each filed «planned». The wait's
   * clock runs only while the board could show the landing; behind the player's own screen it waits for the player.
   */
  describe('the landing waits for the board — behind the screen of the player its clock does not run', () => {
    const warns: Array<string> = [];
    const realWarn = console.warn;
    const realNow = Date.now;
    /** The wall jumps (the module reads `Date.now`; the kernel's timers stay real, so the polls go on). */
    let jumped = 0;
    const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
    beforeEach(() => {
      warns.splice(0);
      jumped = 0;
      console.warn = (...args: Array<unknown>) => warns.push(args.map(String).join(' '));
      Date.now = () => realNow() + jumped;
    });
    afterEach(() => {
      console.warn = realWarn;
      Date.now = realNow;
    });
    const ceilings = (): Array<string> => warns.filter((line) => line.includes('[wait-graph] ceiling'));
    const node = () => collectWaitNodes(Date.now()).find((n) => n.id.startsWith('ceiling:remote-placement:watchable-board#'));

    it('five minutes in a workspace: the tile is still held for its flight, the node waits on the PLAYER — and the board, back, gets its landing', async () => {
      enterWorkspace('card-actions');
      stageRemotePlacements([space('41')], [space('41', {tileType: TileType.GREENERY, color: 'blue'})], {gamePhase: 'action'});
      await until(() => remotePlacementState.waitingForBoard && node() !== undefined, 'the landing parked behind the workspace');
      expect(remoteLandingBehindScreen(), 'it waits behind the screen of the player').is.true;
      await until(() => node()?.targets[0]?.kind === 'player', 'the node says on whom it waits');
      expect(node()?.boundMs, 'and carries no clock').eq(undefined);

      jumped += 5 * 60_000;
      await pause(450); // (three looks of the wait past the jump)
      expect(remotePlacementState.waitingForBoard, 'five minutes later it still waits').is.true;
      expect(isRemoteRevealHeld('41'), 'the tile is still held for its flight').is.true;
      expect(ceilings(), 'no ceiling ended it').deep.eq([]);
      expect(isRemotePlacementActive(), 'and the wait holds nothing').is.false;

      resetWorkspaceStack();
      await until(() => !isRemoteRevealHeld('41'), 'the board is back: the landing ran (degraded here: no stage in JSDOM)');
      await until(() => !remotePlacementState.draining, 'the drain ended');
      expect(ceilings(), 'told on the board, never ended by a clock').deep.eq([]);
    });

    it('a landing on a board in view is behind no screen — there is nothing to hand over', async () => {
      stageRemotePlacements([space('42')], [space('42', {tileType: TileType.GREENERY, color: 'blue'})], {gamePhase: 'action'});
      expect(remoteLandingBehindScreen(), 'a board in view: nothing is behind a screen').is.false;
      expect(handRemoteLandingsOver(), 'and there is nothing to hand over').is.false;
      await until(() => !isRemoteRevealHeld('42'), 'the landing resolved');
      await until(() => !remotePlacementState.draining, 'the drain ended');
    });

    it('NOMADS, the same law: five minutes in a workspace and the camp still waits to be carried — the board, back, gets the hop', async () => {
      teardowns.push(boardCell('61', {x: 100, y: 100}), boardCell('62', {x: 160, y: 100}));
      enterWorkspace('card-actions');
      stageRemoteNomadMove([space('61', {nomads: true}), space('62')], [space('61'), space('62', {nomads: true})]);
      await until(() => nomadMoveState.remoteWaiting, 'the hop parked behind the workspace');

      jumped += 5 * 60_000;
      await pause(450); // (three looks of the wait past the jump)
      expect(nomadMoveState.remoteWaiting, 'five minutes later it still waits').is.true;
      expect(nomadCellHidden('62'), 'the camp has not landed unseen').is.true;
      expect(ceilings(), 'no ceiling ended it').deep.eq([]);
      expect(isRemoteNomadMoveActive(), 'and the wait holds nothing').is.false;

      resetWorkspaceStack();
      await until(() => !nomadMoveState.remoteWaiting && !nomadCellHidden('62'), 'the board is back: the hop resolved');
      expect(ceilings(), 'carried on the board, never ended by a clock').deep.eq([]);
    });

    it('THE SCREEN IS HANDED OVER: every landing parked behind the workspace shows at once, no ceiling — the queue is done in a tick', async () => {
      enterWorkspace('hand');
      stageRemotePlacements([space('43'), space('44')],
        [space('43', {tileType: TileType.GREENERY, color: 'blue'}), space('44', {tileType: TileType.CITY, color: 'blue'})], {gamePhase: 'action'});
      await until(() => remotePlacementState.waitingForBoard, 'the first landing parked behind the hand');
      expect(isRemoteRevealHeld('43') && isRemoteRevealHeld('44'), 'both tiles are held').is.true;

      expect(handRemoteLandingsOver(), 'the transition hands them over').is.true;
      await until(() => !isRemoteRevealHeld('43') && !isRemoteRevealHeld('44'), 'both show without their flights');
      await until(() => !remoteLandingOwed(), 'nothing is owed any more — the transition goes on');
      expect(ceilings(), 'an event ended the wait, not its ceiling').deep.eq([]);
      // …and the next landing, on a board in view again, is not «handed over» by a flag left behind.
      resetWorkspaceStack();
      stageRemotePlacements([space('45')], [space('45', {tileType: TileType.GREENERY, color: 'blue'})], {gamePhase: 'action'});
      expect(handRemoteLandingsOver()).is.false;
      await until(() => !isRemoteRevealHeld('45'), 'it resolved on the board');
      await until(() => !remotePlacementState.draining, 'the drain ended');
    });
  });

  it('NOMADS: the second hop parks for a covered board holding NOTHING — the first hop\'s proxy is off the stage', async () => {
    // Hop 1 is measurable, so it stands its proxy up (`remoteActive`) before it finds no stage to fly on.
    teardowns.push(boardCell('21', {x: 100, y: 100}), boardCell('22', {x: 160, y: 100}));
    const recorded = recordEdges(isRemoteNomadMoveActive);
    stopEdges = recorded.stop;

    stageRemoteNomadMove([space('21', {nomads: true}), space('22')], [space('21'), space('22', {nomads: true})]);
    stageRemoteNomadMove([space('23', {nomads: true}), space('24')], [space('23'), space('24', {nomads: true})]);
    expect(isRemoteNomadMoveActive(), 'staged over a board in view: the hops hold').is.true;
    // Hop 1 has already taken its look at the board (synchronously, in the staging) — the player now opens a workspace.
    enterWorkspace('card-actions');

    await until(() => nomadMoveState.remoteWaiting, 'hop 2 parked for the covered board');
    expect(nomadMoveState.remoteActive, 'nothing of hop 1 is on stage through hop 2\'s wait').is.false;
    expect(isRemoteNomadMoveActive(), 'a hop parked for the board holds nothing').is.false;
    expect(recorded.edges, 'hop 1 held, the park released it at once').deep.eq([true, false]);
    refreshAnimationHolds();
    expect(activeAnimationHoldLabels()).not.includes('nomad-move-remote[blocking]');

    resetWorkspaceStack();
    await until(() => !nomadMoveState.remoteWaiting && !nomadCellHidden('24'), 'hop 2 resolved on the board');
    expect(recorded.edges.slice(0, 3), 'the board\'s return re-raised the hold for hop 2').deep.eq([true, false, true]);
    expect(isRemoteNomadMoveActive(), 'the queue is done').is.false;
  });
});
