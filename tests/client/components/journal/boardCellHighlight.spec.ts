import {expect} from 'chai';
import {SpaceId} from '@/common/Types';
import {
  highlightBoardSpace,
  highlightBoardSpaces,
  startBoardHighlightPulse,
  stopBoardHighlightPulse,
} from '@/client/components/journal/boardCellHighlight';

const PULSE_CLASS = 'journal-pulse';

/**
 * Seed the hidden per-cell overlays BoardSpace/MoonSpace render
 * (`.board-log-highlight[data_log_highlight_id]`) inside the `#main_board`
 * region `boardCellHighlight` searches, so the pulse can find real DOM nodes.
 */
function seedBoard(spaceIds: ReadonlyArray<SpaceId>): Map<SpaceId, HTMLElement> {
  const board = document.createElement('div');
  board.id = 'main_board';
  const overlays = new Map<SpaceId, HTMLElement>();
  for (const id of spaceIds) {
    const el = document.createElement('div');
    el.className = 'board-log-highlight';
    el.setAttribute('data_log_highlight_id', id);
    board.appendChild(el);
    overlays.set(id, el);
  }
  document.body.appendChild(board);
  return overlays;
}

function pulsing(el: HTMLElement): boolean {
  return el.classList.contains(PULSE_CLASS);
}

describe('boardCellHighlight', () => {
  let overlays: Map<SpaceId, HTMLElement>;

  beforeEach(() => {
    overlays = seedBoard(['01', '05', '07']);
  });

  afterEach(() => {
    // Clears the persistent interval so the mocha process can exit.
    stopBoardHighlightPulse();
    document.getElementById('main_board')?.remove();
  });

  it('highlightBoardSpace pulses a single cell', () => {
    highlightBoardSpace('05');
    expect(pulsing(overlays.get('05')!)).to.be.true;
    expect(pulsing(overlays.get('01')!)).to.be.false;
  });

  it('highlightBoardSpaces pulses EVERY referenced cell, not just the first', () => {
    // Problem B: a bot turn that placed a city AND a greenery must light BOTH.
    highlightBoardSpaces(['05', '07']);
    expect(pulsing(overlays.get('05')!)).to.be.true;
    expect(pulsing(overlays.get('07')!)).to.be.true;
    // An unreferenced cell stays dark.
    expect(pulsing(overlays.get('01')!)).to.be.false;
  });

  it('startBoardHighlightPulse lights ALL cells immediately (the persistent peek)', () => {
    startBoardHighlightPulse(['01', '07']);
    expect(pulsing(overlays.get('01')!)).to.be.true;
    expect(pulsing(overlays.get('07')!)).to.be.true;
    expect(pulsing(overlays.get('05')!)).to.be.false;
  });

  it('startBoardHighlightPulse([]) is a no-op — nothing lights, no timer', () => {
    startBoardHighlightPulse([]);
    for (const el of overlays.values()) {
      expect(pulsing(el)).to.be.false;
    }
  });

  it('stopBoardHighlightPulse is idempotent and safe with no active pulse', () => {
    expect(() => {
      stopBoardHighlightPulse();
      stopBoardHighlightPulse();
    }).to.not.throw();
  });

  it('a space id with no overlay on the board is a graceful no-op', () => {
    expect(() => highlightBoardSpaces(['99'])).to.not.throw();
    // The known cells are untouched.
    for (const el of overlays.values()) {
      expect(pulsing(el)).to.be.false;
    }
  });
});
