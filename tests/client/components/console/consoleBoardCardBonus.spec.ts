import {expect} from 'chai';
import {
  abortBoardCardBonus, armBoardCardBonus, boardCardBonusState, bonusHoldingSingleZoom,
  bonusZoomOriginEl, endBoardCardBonus, isBoardCardBonusActive, isBonusRevealStaged,
  isVenusScaleReveal, markBonusZoomEntryReady, registerBoardCardBonusHandle,
  registerBonusZoomOrigin, resetBoardCardBonus, revealMatchesSource, setBoardCardBonusPhase,
  stageBoardCardBonusReveal, BoardCardBonusAbortMode,
} from '@/client/console/boardCardBonus/consoleBoardCardBonus';

const CELL = {kind: 'board-cell', spaceId: '05'} as const;
const VENUS = {kind: 'venus-scale'} as const;

describe('consoleBoardCardBonus', () => {
  beforeEach(() => resetBoardCardBonus());
  afterEach(() => resetBoardCardBonus());

  it('arm sets the scene live synchronously (input gate closes at once)', () => {
    expect(isBoardCardBonusActive()).to.be.false;
    armBoardCardBonus(CELL);
    expect(isBoardCardBonusActive()).to.be.true;
    expect(boardCardBonusState.phase).to.eq('lift');
    expect(boardCardBonusState.source).to.deep.eq({kind: 'board-cell', spaceId: '05'});
    const nonce = boardCardBonusState.nonce;
    // A second arm while live is a no-op (one scene at a time).
    armBoardCardBonus({kind: 'board-cell', spaceId: '07'});
    expect(boardCardBonusState.source).to.deep.eq({kind: 'board-cell', spaceId: '05'});
    expect(boardCardBonusState.nonce).to.eq(nonce);
  });

  it('matches a reveal to its scene source (board=tile, venus=globalParameter)', () => {
    expect(isVenusScaleReveal({type: 'globalParameter', parameter: 'venus'} as any)).to.be.true;
    expect(isVenusScaleReveal({type: 'tile'})).to.be.false;
    expect(isVenusScaleReveal(undefined)).to.be.false;
    expect(revealMatchesSource({type: 'tile'}, CELL)).to.be.true;
    expect(revealMatchesSource({type: 'globalParameter', parameter: 'venus'} as any, CELL)).to.be.false;
    expect(revealMatchesSource({type: 'globalParameter', parameter: 'venus'} as any, VENUS)).to.be.true;
    expect(revealMatchesSource({type: 'tile'}, VENUS)).to.be.false;
  });

  it('a venus-scale scene arms from its own descriptor', () => {
    armBoardCardBonus(VENUS);
    expect(boardCardBonusState.source).to.deep.eq({kind: 'venus-scale'});
    setBoardCardBonusPhase('hover');
    expect(stageBoardCardBonusReveal(11, 1)).to.be.true;
    expect(bonusHoldingSingleZoom(11)).to.be.true;
  });

  it('a FINISHED venus batch stays remembered (guards the layer re-arm loop)', () => {
    // The layer's venus self-arm is gated on `e.id !== stagedEventId`. After
    // the scene ends, the (still-untaken) venus reveal must NOT re-match — else
    // it would re-arm endlessly and keep the input gate locked so the take
    // never fires. The persisted `stagedEventId` is what makes that guard work.
    armBoardCardBonus(VENUS);
    setBoardCardBonusPhase('hover');
    stageBoardCardBonusReveal(11, 1);
    setBoardCardBonusPhase('frame');
    endBoardCardBonus();
    expect(isBoardCardBonusActive()).to.be.false;
    // The batch id is remembered → the layer's `e.id !== stagedEventId` guard
    // holds, so the same untaken reveal is not re-armed.
    expect(boardCardBonusState.stagedEventId).to.eq(11);
    expect(isBonusRevealStaged(11)).to.be.true;
  });

  it('stage claims the reveal EXACTLY once, only while at the cell', () => {
    armBoardCardBonus(CELL);
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
    armBoardCardBonus(CELL);
    setBoardCardBonusPhase('gather');
    expect(stageBoardCardBonusReveal(3, 2)).to.be.false; // cover already travelling
    expect(boardCardBonusState.stagedEventId).to.be.undefined;
  });

  it('single-card: the fullscreen auto-open is held until the cover arrives', () => {
    armBoardCardBonus(CELL);
    setBoardCardBonusPhase('hover');
    stageBoardCardBonusReveal(7, 1);
    expect(bonusHoldingSingleZoom(7)).to.be.true;
    expect(bonusHoldingSingleZoom(8)).to.be.false; // a different batch is never held
    markBonusZoomEntryReady();
    expect(bonusHoldingSingleZoom(7)).to.be.false;
  });

  it('a multi-card batch never holds the single-card auto-open', () => {
    armBoardCardBonus(CELL);
    stageBoardCardBonusReveal(7, 3);
    expect(bonusHoldingSingleZoom(7)).to.be.false;
  });

  it('end keeps the staged batch id (bonus-mode persists for the batch)', () => {
    armBoardCardBonus(CELL);
    stageBoardCardBonusReveal(7, 2);
    setBoardCardBonusPhase('handoff');
    endBoardCardBonus();
    expect(isBoardCardBonusActive()).to.be.false;
    expect(boardCardBonusState.phase).to.eq('done');
    expect(isBonusRevealStaged(7)).to.be.true; // the overlay's entrance stays suppressed
    // …until the NEXT arm supersedes it.
    armBoardCardBonus({kind: 'board-cell', spaceId: '09'});
    expect(isBonusRevealStaged(7)).to.be.false;
  });

  it('abort recalls the scene AND releases every hold (never a stranded UI)', () => {
    const aborts: Array<BoardCardBonusAbortMode> = [];
    armBoardCardBonus(CELL);
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
    armBoardCardBonus(CELL);
    setBoardCardBonusPhase('fan');
    expect(boardCardBonusState.phase).to.eq('fan');
    endBoardCardBonus();
    setBoardCardBonusPhase('lift');
    expect(boardCardBonusState.phase).to.eq('done');
  });

  it('zoom origin resolver is registered/cleared with the scene', () => {
    expect(bonusZoomOriginEl()).to.eq(null);
    armBoardCardBonus(CELL);
    const el = {} as HTMLElement;
    registerBonusZoomOrigin(() => el);
    expect(bonusZoomOriginEl()).to.eq(el);
    endBoardCardBonus();
    expect(bonusZoomOriginEl()).to.eq(null);
  });
});
