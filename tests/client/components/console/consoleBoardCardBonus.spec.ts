import {expect} from 'chai';
import {
  abortBoardCardBonus, armBoardCardBonus, boardCardBonusState, bonusHoldingSingleZoom,
  bonusZoomOriginEl, endBoardCardBonus, isBoardCardBonusActive, isBonusRevealStaged,
  markBonusZoomEntryReady, registerBoardCardBonusHandle, registerBonusZoomOrigin,
  resetBoardCardBonus, setBoardCardBonusPhase, stageBoardCardBonusReveal,
  BoardCardBonusAbortMode,
} from '@/client/console/boardCardBonus/consoleBoardCardBonus';

describe('consoleBoardCardBonus', () => {
  beforeEach(() => resetBoardCardBonus());
  afterEach(() => resetBoardCardBonus());

  it('arm sets the scene live synchronously (input gate closes at once)', () => {
    expect(isBoardCardBonusActive()).to.be.false;
    armBoardCardBonus('05');
    expect(isBoardCardBonusActive()).to.be.true;
    expect(boardCardBonusState.phase).to.eq('lift');
    expect(boardCardBonusState.spaceId).to.eq('05');
    const nonce = boardCardBonusState.nonce;
    // A second arm while live is a no-op (one scene at a time).
    armBoardCardBonus('07');
    expect(boardCardBonusState.spaceId).to.eq('05');
    expect(boardCardBonusState.nonce).to.eq(nonce);
  });

  it('stage claims the reveal EXACTLY once, only while at the cell', () => {
    armBoardCardBonus('05');
    setBoardCardBonusPhase('hover');
    expect(stageBoardCardBonusReveal(3, 2)).to.be.true;
    expect(boardCardBonusState.stagedEventId).to.eq(3);
    expect(boardCardBonusState.stagedCount).to.eq(2);
    expect(isBonusRevealStaged(3)).to.be.true;
    expect(isBonusRevealStaged(4)).to.be.false;
    // Already staged → a second batch is NOT claimed.
    expect(stageBoardCardBonusReveal(4, 1)).to.be.false;
    expect(boardCardBonusState.stagedEventId).to.eq(3);
  });

  it('stage refuses mid-transfer and when idle (standard reveal instead)', () => {
    expect(stageBoardCardBonusReveal(3, 2)).to.be.false; // not armed
    armBoardCardBonus('05');
    setBoardCardBonusPhase('gather');
    expect(stageBoardCardBonusReveal(3, 2)).to.be.false; // cover already travelling
    expect(boardCardBonusState.stagedEventId).to.be.undefined;
  });

  it('single-card: the fullscreen auto-open is held until the cover arrives', () => {
    armBoardCardBonus('05');
    setBoardCardBonusPhase('hover');
    stageBoardCardBonusReveal(7, 1);
    expect(bonusHoldingSingleZoom(7)).to.be.true;
    expect(bonusHoldingSingleZoom(8)).to.be.false; // a different batch is never held
    markBonusZoomEntryReady();
    expect(bonusHoldingSingleZoom(7)).to.be.false;
  });

  it('a multi-card batch never holds the single-card auto-open', () => {
    armBoardCardBonus('05');
    stageBoardCardBonusReveal(7, 3);
    expect(bonusHoldingSingleZoom(7)).to.be.false;
  });

  it('end keeps the staged batch id (bonus-mode persists for the batch)', () => {
    armBoardCardBonus('05');
    stageBoardCardBonusReveal(7, 2);
    setBoardCardBonusPhase('handoff');
    endBoardCardBonus();
    expect(isBoardCardBonusActive()).to.be.false;
    expect(boardCardBonusState.phase).to.eq('done');
    expect(isBonusRevealStaged(7)).to.be.true; // the overlay's entrance stays suppressed
    // …until the NEXT arm supersedes it.
    armBoardCardBonus('09');
    expect(isBonusRevealStaged(7)).to.be.false;
  });

  it('abort recalls the scene AND releases every hold (never a stranded UI)', () => {
    const aborts: Array<BoardCardBonusAbortMode> = [];
    armBoardCardBonus('05');
    registerBoardCardBonusHandle({abort: (mode) => aborts.push(mode)});
    stageBoardCardBonusReveal(7, 1);
    expect(bonusHoldingSingleZoom(7)).to.be.true;
    abortBoardCardBonus('return');
    expect(aborts).to.deep.eq(['return']);
    expect(isBoardCardBonusActive()).to.be.false;
    // Staging cleared → the overlay unveils/releases instantly…
    expect(isBonusRevealStaged(7)).to.be.false;
    // …and the held single-card auto-open is released.
    expect(bonusHoldingSingleZoom(7)).to.be.false;
    // Idempotent: a second abort neither throws nor re-fires the handle.
    abortBoardCardBonus('instant');
    expect(aborts).to.have.length(1);
  });

  it('phase transitions only apply to a live scene (zombie-safe)', () => {
    setBoardCardBonusPhase('fan');
    expect(boardCardBonusState.phase).to.eq('idle');
    armBoardCardBonus('05');
    setBoardCardBonusPhase('fan');
    expect(boardCardBonusState.phase).to.eq('fan');
    endBoardCardBonus();
    setBoardCardBonusPhase('lift');
    expect(boardCardBonusState.phase).to.eq('done');
  });

  it('zoom origin resolver is registered/cleared with the scene', () => {
    expect(bonusZoomOriginEl()).to.eq(null);
    armBoardCardBonus('05');
    const el = {} as HTMLElement;
    registerBonusZoomOrigin(() => el);
    expect(bonusZoomOriginEl()).to.eq(el);
    endBoardCardBonus();
    expect(bonusZoomOriginEl()).to.eq(null);
  });
});
