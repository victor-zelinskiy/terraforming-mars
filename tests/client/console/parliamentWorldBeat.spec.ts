import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel} from '@/common/models/ParliamentModel';
import {
  detectNewWorldMoves, enterWorldBeatSitting, parliamentWorldBeatState, resetParliamentWorldBeat, runWorldMoveBeat,
  seedWorldMoveBeat, takeWorldReceipt, worldMoveOwed, worldReceiptOwed,
} from '@/client/console/parliament/parliamentWorldBeat';
import {enterWorkspace, resetWorkspaceStack, stackYieldedToBoard, workspaceStackState} from '@/client/console/consoleWorkspaceStack';
import {resetBoardBeatPark} from '@/client/console/boardBeatPark';

/*
 * THE WORLD BEAT'S LEDGER (Turmoil Redux, Gas Export RX12). The sitting steps
 * aside for the planet and comes back owing one read — and the two honesties
 * this spec pins are the ones a beat like this gets wrong: it must be owed to
 * EVERY viewer (a world record names no seat), and it must never be owed
 * TWICE (a replay would move nothing but would stand the frame down again).
 */
const BLUE = 'blue';

function world(step: string, over: Partial<ParliamentEnactOutcomeModel> = {}): ParliamentEnactOutcomeModel {
  return {step, part: 'world', kind: 'globalParameter', amount: -1, parameter: {id: 'oxygen', before: 5, after: 4}, unrewarded: true, ...over} as ParliamentEnactOutcomeModel;
}

function view(generation: number, outcomes: Array<ParliamentEnactOutcomeModel>, viewer = BLUE): PlayerViewModel {
  return {
    thisPlayer: {color: viewer},
    game: {
      parliament: {
        phase: {
          generation, final: false, step: 'effects', outcomes,
          summary: {generation, seq: 1, support: [], refreshed: [], lobbyRefilled: [], outcomes},
        },
      },
    },
  } as unknown as PlayerViewModel;
}

describe('parliamentWorldBeat — the sitting steps aside for the planet', () => {
  beforeEach(() => {
    resetParliamentWorldBeat();
    resetWorkspaceStack();
    resetBoardBeatPark();
  });
  after(() => {
    resetParliamentWorldBeat();
    resetWorkspaceStack();
    resetBoardBeatPark();
  });

  it('DETECT: the world records this response ADDED — for every viewer alike', () => {
    const before = view(3, []);
    const after = view(3, [world('oxygen'), world('venus', {amount: 2, parameter: {id: 'venus', before: 10, after: 14}})]);
    expect(detectNewWorldMoves(before, after).map((o) => o.step)).deep.eq(['oxygen', 'venus']);
    // The SAME two records for a seat that is not the winner and not even a voter.
    expect(detectNewWorldMoves(view(3, [], 'red'), view(3, after.game.parliament!.phase!.outcomes as Array<ParliamentEnactOutcomeModel>, 'red')))
      .has.length(2);
  });

  it('DETECT adds nothing on a first view, a new generation, or a record already known', () => {
    const outcomes = [world('oxygen')];
    expect(detectNewWorldMoves(undefined, view(3, outcomes)), 'a reload has no «before»').deep.eq([]);
    expect(detectNewWorldMoves(view(2, []), view(3, outcomes)), 'a new generation replays nothing').deep.eq([]);
    expect(detectNewWorldMoves(view(3, outcomes), view(3, outcomes)), 'nothing was added').deep.eq([]);
  });

  it('…and a SEAT\'s record is never a world record', () => {
    const mine = {player: BLUE, step: 'megacredits', part: 'effect', kind: 'stock', amount: 4} as unknown as ParliamentEnactOutcomeModel;
    expect(detectNewWorldMoves(view(3, []), view(3, [mine]))).deep.eq([]);
  });

  it('SEED and OWE: the records are owed to the sitting, and a NEW sitting drops what the old one owed', () => {
    enterWorldBeatSitting('3:1');
    seedWorldMoveBeat(view(3, []), view(3, [world('oxygen')]));
    expect(worldMoveOwed('3:1')).is.true;
    expect(worldMoveOwed('4:2'), 'owed to ITS sitting, never to the next').is.false;
    enterWorldBeatSitting('4:2');
    expect(worldMoveOwed('3:1')).is.false;
    expect(parliamentWorldBeatState.owed).deep.eq([]);
  });

  it('RUN: the stack steps aside, comes back at the same depth, and the reward page owes ONE read', async () => {
    enterWorkspace('parliament');
    expect(workspaceStackState.frames).has.length(1);
    enterWorldBeatSitting('3:1');
    seedWorldMoveBeat(view(3, []), view(3, [world('oxygen'), world('venus', {amount: 2})]));
    const run = runWorldMoveBeat('3:1');
    // The frame is AWAY the moment the beat starts — that is what lets the board tell its story.
    expect(parliamentWorldBeatState.away).is.true;
    expect(stackYieldedToBoard()).is.true;
    expect(workspaceStackState.frames, 'the sitting is off screen while the planet moves').has.length(0);
    expect(await run).is.true;
    expect(parliamentWorldBeatState.away).is.false;
    expect(stackYieldedToBoard()).is.false;
    expect(workspaceStackState.frames, 'and back at the same depth').has.length(1);
    // …owing exactly one read, consumed once.
    expect(worldReceiptOwed('3:1')).is.true;
    expect(takeWorldReceipt('3:1')?.map((o) => o.step)).deep.eq(['oxygen', 'venus']);
    expect(worldReceiptOwed('3:1'), 'a receipt is taken once').is.false;
    expect(takeWorldReceipt('3:1')).is.undefined;
  });

  it('RUN never replays: the records leave the ledger when the beat takes them', async () => {
    enterWorkspace('parliament');
    enterWorldBeatSitting('3:1');
    seedWorldMoveBeat(view(3, []), view(3, [world('oxygen')]));
    expect(await runWorldMoveBeat('3:1')).is.true;
    expect(worldMoveOwed('3:1')).is.false;
    expect(await runWorldMoveBeat('3:1'), 'nothing owed — nothing happens').is.false;
  });

  it('a stack that cannot step aside owes nothing and stands nothing down', async () => {
    enterWorldBeatSitting('3:1');
    seedWorldMoveBeat(view(3, []), view(3, [world('oxygen')]));
    expect(await runWorldMoveBeat('3:1'), 'no root to yield').is.false;
    expect(parliamentWorldBeatState.away).is.false;
    expect(worldReceiptOwed('3:1'), 'a beat that could not play owes no read either').is.false;
  });
});
