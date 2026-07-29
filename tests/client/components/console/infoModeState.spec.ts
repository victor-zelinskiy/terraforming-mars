import {expect} from 'chai';
import {infoModeState, openInfoMode, closeInfoMode, settleInfoModeClose} from '@/client/console/infoModeState';

/**
 * The Information Workspace lifecycle flags (the `--info` stacking state of
 * .con-main rides `open || closing` — dropping `closing` early would let a
 * band surface pop OVER the dismissing panel; see ConsoleShell).
 */
describe('infoModeState — Information Workspace lifecycle', () => {
  afterEach(() => {
    // Module state is bundle-shared across specs — leave the mode fully closed.
    infoModeState.open = false;
    infoModeState.closing = false;
    infoModeState.playerColor = undefined;
    infoModeState.detail = undefined;
    infoModeState.snapshot = undefined;
  });

  it('close raises `closing` and keeps it until the dismiss settles', () => {
    openInfoMode('red', false);
    expect(infoModeState.open).to.be.true;
    expect(infoModeState.closing).to.be.false;
    closeInfoMode();
    expect(infoModeState.open).to.be.false;
    expect(infoModeState.closing).to.be.true;
    settleInfoModeClose();
    expect(infoModeState.closing).to.be.false;
  });

  it('a re-open mid-dismiss reclaims the stage (closing drops immediately)', () => {
    openInfoMode('red', false);
    closeInfoMode();
    expect(infoModeState.closing).to.be.true;
    openInfoMode('blue', true);
    expect(infoModeState.open).to.be.true;
    expect(infoModeState.closing).to.be.false;
    expect(infoModeState.playerColor).to.eq('blue');
  });

  it('open defaults the inspected player to the viewer', () => {
    openInfoMode('green', false);
    expect(infoModeState.playerColor).to.eq('green');
    expect(infoModeState.detail).to.be.undefined;
  });
});
