import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CellResourcePayoutModel} from '@/common/models/TilePlacementRecordModel';
import {cellResourceState, resetCellResourceBeat, seedCellResourceHolds} from '@/client/console/cellResource/cellResourceBeat';
import {isAnimationHoldActive} from '@/client/components/presentation/animationHold';
import {clearPanelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {resetPresentationLedger} from '@/client/console/presentationLedger';
import {registerBoardWatchableProbe, resetBoardBeatPark} from '@/client/console/boardBeatPark';

/*
 * «КЛЕТКА ОТДАЁТ ВЫБРАННЫЙ РЕСУРС» (Amazonis Planitia's chosen-resource cells) — THE HOLD IS THE FLIGHT, NEVER THE WAIT
 * (FREEZE ZERO, the zero bar — CI #141, game 1145): the notification-only hold stood from the seed through the whole
 * wait for a stage — a story that was not playing held the feed behind the player's own screen (the starvation net at
 * 12 s, the foreground watchdog: «busy with NOTHING rendered»). And a cell with NO BOX on a board in view (not laid out)
 * is a stage that never comes — the rows tick at once, never after thirty seconds.
 */
const RIVAL = 'red';
function view(payouts: ReadonlyArray<CellResourcePayoutModel>): PlayerViewModel {
  return {
    id: 'p-blue',
    game: {phase: 'action', cellResourcePayouts: payouts},
    thisPlayer: {color: 'blue', megacredits: 10, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, tableau: []},
    players: [],
  } as unknown as PlayerViewModel;
}
const payout = (seq: number): CellResourcePayoutModel => ({seq, spaceId: '05', color: RIVAL, resource: 'steel', amount: 1} as CellResourcePayoutModel);

describe('cellResourceBeat — the hold is the flight, never the wait', () => {
  let board: HTMLElement | undefined;
  const mountCell = (box?: {width: number, height: number}): HTMLElement => {
    board = document.createElement('div');
    board.id = 'main_board';
    const cell = document.createElement('div');
    cell.setAttribute('data_space_id', '05');
    if (box !== undefined) {
      cell.getBoundingClientRect = () => ({x: 100, y: 0, left: 100, top: 0, right: 100 + box.width, bottom: box.height, ...box, toJSON: () => ({})}) as DOMRect;
    }
    board.appendChild(cell);
    document.body.appendChild(board);
    return cell;
  };

  beforeEach(() => {
    resetCellResourceBeat();
    seedCellResourceHolds(undefined, view([]));  // the first view only sets the baseline
  });
  afterEach(() => {
    board?.remove();
    board = undefined;
    resetCellResourceBeat();
    registerBoardWatchableProbe(undefined);
    clearPanelRewardHold();
    resetPresentationLedger();
    resetBoardBeatPark();
  });

  it('WAITING for a board the player covered holds NOTHING — the feed is not starved behind a story that is not playing', () => {
    registerBoardWatchableProbe(() => false);
    mountCell({width: 40, height: 40});
    seedCellResourceHolds(view([]), view([payout(1)]));
    expect(cellResourceState.phase, 'the beat waits for its stage').to.eq('waiting');
    expect(isAnimationHoldActive(), 'and holds no animation for it').to.eq(false);
  });

  it('the stage stands: the flight is decided in the seed\'s own task — the hold rises with it', () => {
    registerBoardWatchableProbe(() => true);
    mountCell({width: 40, height: 40});
    seedCellResourceHolds(view([]), view([payout(2)]));
    expect(cellResourceState.phase, 'flying at once').to.eq('flying');
    expect(isAnimationHoldActive(), 'the token in the air holds the feed').to.eq(true);
  });

  it('a cell with NO BOX on a board in view (not laid out) is a stage that never comes: the rows tick at once', async () => {
    registerBoardWatchableProbe(() => true);
    mountCell();
    seedCellResourceHolds(view([]), view([payout(3)]));
    await Promise.resolve();
    await Promise.resolve();
    expect(cellResourceState.phase, 'nothing waits thirty seconds for it').to.eq('idle');
    expect(cellResourceState.degraded, 'named as a degrade (nothing flew)').to.eq(true);
    expect(isAnimationHoldActive()).to.eq(false);
  });
});
