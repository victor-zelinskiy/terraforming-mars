import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel} from '@/common/models/ParliamentModel';
import {
  detectNewWorldMoves, enterWorldBeatSitting, isPlanetRecord, isSeatTileRecord, parliamentWorldBeatState, resetParliamentWorldBeat, runWorldMoveBeat,
  seatTileOwed, seedWorldMoveBeat, takeWorldReceipt, worldMoveOwed, worldReceiptOwed,
} from '@/client/console/parliament/parliamentWorldBeat';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
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

  it('RUN over a SURVIVING PHASE ROOT ([start, parliament] — a seat whose first action waits behind the phase): the WHOLE stack steps aside and comes back at depth 2', async () => {
    enterWorkspace('start', {anchor: {type: 'phase', phase: 'start'}});
    enterWorkspace('parliament');
    expect(workspaceStackState.frames.map((f) => f.kind), 'the sitting stands OVER the start root').deep.eq(['start', 'parliament']);
    enterWorldBeatSitting('1:1');
    seedWorldMoveBeat(view(1, []), view(1, [{step: 'oceanRemoval', part: 'world', kind: 'tileRemoved', amount: -1, tile: 1, space: '10', parameter: {id: 'oceans', before: 1, after: 0}} as unknown as ParliamentEnactOutcomeModel]));
    expect(worldMoveOwed('1:1'), "a tile's removal is a board record the sitting owes").is.true;
    const run = runWorldMoveBeat('1:1');
    expect(stackYieldedToBoard(), "the root's «no» no longer decides — the top frame yields and takes the root with it").is.true;
    expect(workspaceStackState.frames, 'both frames are off screen while the tile leaves').has.length(0);
    expect(await run).is.true;
    expect(workspaceStackState.frames.map((f) => f.kind), 'and both come back, same order, same depth').deep.eq(['start', 'parliament']);
    expect(takeWorldReceipt('1:1')?.map((o) => o.step)).deep.eq(['oceanRemoval']);
  });

  it('a stack that cannot step aside owes nothing and stands nothing down', async () => {
    enterWorldBeatSitting('3:1');
    seedWorldMoveBeat(view(3, []), view(3, [world('oxygen')]));
    expect(await runWorldMoveBeat('3:1'), 'no root to yield').is.false;
    expect(parliamentWorldBeatState.away).is.false;
    expect(worldReceiptOwed('3:1'), 'a beat that could not play owes no read either').is.false;
  });

  /*
   * ANOTHER SEAT'S TILE (PL-764 — Mars First Budget, the bot first in the order): the city the law made the bot place
   * in the response that asks the viewer for its own is a BOARD story of the sitting — owed to the viewer (never to its
   * owner, whose door is its own), played in place over a board already in view, and never a trip for a tile that has
   * already landed (nothing of the remote stage owed — a yield would be a blink and straight back).
   */
  describe('another seat\'s tile (PL-764)', () => {
    const botCity = (over: Partial<ParliamentEnactOutcomeModel> = {}): ParliamentEnactOutcomeModel =>
      ({player: 'red', step: 'city', part: 'effect', kind: 'city', influence: 0, space: '23', ...over}) as ParliamentEnactOutcomeModel;

    afterEach(() => {
      consoleParliamentUi.worldTripHoldsDoor = false;
    });

    it('DETECT: a seat\'s tile of the law is a story for the OTHER viewers only; the winner\'s tile keeps its own road', () => {
      expect(isSeatTileRecord(botCity())).is.true;
      expect(isSeatTileRecord(botCity({kind: 'stock'})), 'money is the rail\'s').is.false;
      expect(isSeatTileRecord(botCity({space: undefined})), 'a named skip lands nowhere').is.false;
      expect(isSeatTileRecord(botCity({part: 'winner', kind: 'ocean'})), 'the winner\'s tile is the placement\'s').is.false;
      expect(detectNewWorldMoves(view(3, []), view(3, [botCity()])).map((o) => `${o.player}:${o.step}`), 'blue watches the bot\'s city').deep.eq(['red:city']);
      expect(detectNewWorldMoves(view(3, [], 'red'), view(3, [botCity()], 'red')), 'never its own seat\'s').deep.eq([]);
      expect(detectNewWorldMoves(view(3, [botCity()]), view(3, [botCity()])), 'known already').deep.eq([]);
    });

    it('SEED: over a COVERED board it is owed a trip; over a board in view it lands in place and owes the receipt only', () => {
      enterWorkspace('parliament');
      enterWorldBeatSitting('3:1');
      seedWorldMoveBeat(view(3, []), view(3, [botCity()]));
      expect(seatTileOwed('3:1'), 'the sitting covers the board: a trip is owed').is.true;
      resetWorkspaceStack();
      resetParliamentWorldBeat();
      enterWorldBeatSitting('3:1');
      seedWorldMoveBeat(view(3, []), view(3, [botCity()]));
      expect(seatTileOwed('3:1'), 'the board is in view: the landing plays at once').is.false;
      expect(worldReceiptOwed('3:1'), 'the reward page reads it on the way back').is.true;
    });

    it('RUN: a tile that has ALREADY LANDED owes no trip — no yield, no door held, nothing owed after', async () => {
      enterWorkspace('parliament');
      enterWorldBeatSitting('3:1');
      seedWorldMoveBeat(view(3, []), view(3, [botCity()]));
      expect(await runWorldMoveBeat('3:1'), 'nothing of the remote stage is owed').is.false;
      expect(stackYieldedToBoard(), 'the sitting never stepped aside').is.false;
      expect(workspaceStackState.frames).has.length(1);
      expect(consoleParliamentUi.worldTripHoldsDoor, 'no door held').is.false;
      expect(seatTileOwed('3:1')).is.false;
    });

    it('a trip HOLDS THE DOOR while away and hands it back to the stage — or lets go when the frame stays aside', async () => {
      enterWorkspace('parliament');
      enterWorldBeatSitting('3:1');
      seedWorldMoveBeat(view(3, []), view(3, [world('oxygen')]));
      const run = runWorldMoveBeat('3:1', {boardBusy: () => true});
      expect(consoleParliamentUi.worldTripHoldsDoor, 'the seat\'s own tile waits while the sitting is away').is.true;
      await run;
      expect(consoleParliamentUi.worldTripHoldsDoor, 'the frame stays aside: the door is the board\'s').is.false;
    });

    it('RESET: a new sitting releases a door the old trip held', () => {
      consoleParliamentUi.worldTripHoldsDoor = true;
      enterWorldBeatSitting('4:1');
      expect(consoleParliamentUi.worldTripHoldsDoor).is.false;
      consoleParliamentUi.worldTripHoldsDoor = true;
      resetParliamentWorldBeat();
      expect(consoleParliamentUi.worldTripHoldsDoor).is.false;
    });
  });

  /*
   * THE WINNER'S OWN STEP OF A PARAMETER (Mohole Contest, RX23) is a PLANET record too — the same beat, in
   * the rewarded tone: every viewer plays it, and while the winner's OWN placement (the ocean of 0 °C)
   * stands on the board the frame does not come back — the placement's end resumes the stack.
   */
  describe('the winner\'s own step of a parameter', () => {
    const winnerStep = (over: Partial<ParliamentEnactOutcomeModel> = {}): ParliamentEnactOutcomeModel =>
      ({player: BLUE, step: 'temperature', part: 'winner', kind: 'globalParameter', amount: 2, parameter: {id: 'temperature', before: -20, after: -16}, tr: 2, ...over}) as ParliamentEnactOutcomeModel;

    it('DETECT: the winner\'s step is a planet record, for the winner AND for every other viewer; a tile or a skip is not', () => {
      expect(isPlanetRecord(winnerStep())).is.true;
      expect(isPlanetRecord(world('oxygen'))).is.true;
      expect(isPlanetRecord({player: BLUE, step: 'ocean', part: 'winner', kind: 'ocean'} as ParliamentEnactOutcomeModel), 'a tile\'s trip is the placement\'s').is.false;
      expect(isPlanetRecord(winnerStep({kind: 'skipped', amount: 0})), 'a named skip moves nothing').is.false;
      expect(isPlanetRecord({player: BLUE, step: 'heat', part: 'effect', kind: 'stock'} as ParliamentEnactOutcomeModel)).is.false;
      expect(detectNewWorldMoves(view(3, []), view(3, [winnerStep()])).map((o) => `${o.player}:${o.step}`)).deep.eq(['blue:temperature']);
      expect(detectNewWorldMoves(view(3, [], 'red'), view(3, [winnerStep()], 'red')).map((o) => o.step), 'the other seat plays it too').deep.eq(['temperature']);
      expect(detectNewWorldMoves(view(3, [winnerStep()]), view(3, [winnerStep()])), 'known already').deep.eq([]);
    });

    it('RUN with the board still BUSY (the 0 °C ocean stands): the frame stays aside and the receipt is owed all the same', async () => {
      enterWorkspace('parliament');
      enterWorldBeatSitting('3:1');
      seedWorldMoveBeat(view(3, []), view(3, [winnerStep()]));
      expect(await runWorldMoveBeat('3:1', {boardBusy: () => true})).is.true;
      expect(parliamentWorldBeatState.away).is.false;
      expect(stackYieldedToBoard(), 'the placement\'s own end brings the frame back, not the beat').is.true;
      expect(workspaceStackState.frames).has.length(0);
      expect(worldReceiptOwed('3:1'), 'the read is owed for when it does').is.true;
      expect(takeWorldReceipt('3:1')?.map((o) => o.step)).deep.eq(['temperature']);
      // …and with the board free the beat resumes the stack itself, as for a world move.
      resetWorkspaceStack();
      enterWorkspace('parliament');
      seedWorldMoveBeat(view(3, []), view(3, [winnerStep({step: 'venus'})]));
      expect(await runWorldMoveBeat('3:1', {boardBusy: () => false})).is.true;
      expect(stackYieldedToBoard()).is.false;
      expect(workspaceStackState.frames).has.length(1);
    });
  });
});
