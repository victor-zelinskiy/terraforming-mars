import {expect} from 'chai';
import {
  collapseFinaleSession,
  endFinaleSession,
  enterFinaleSession,
  finaleSessionStanding,
  finaleSessionState,
  resetFinaleSession,
  restoreFinaleSession,
} from '@/client/console/finalGreenery/finalGreenerySession';

/*
 * THE FINALE SESSION (PL-303): one context from the announce's A to the seat's end of the phase. The shell's
 * readers (the dossier, Planet Focus, the bar, the announce gate) stand on these four verbs and nothing else.
 */
describe('finalGreenerySession', () => {
  beforeEach(() => resetFinaleSession());
  afterEach(() => resetFinaleSession());

  it('is off until the player opens the finale', () => {
    expect(finaleSessionState.active).to.be.false;
    expect(finaleSessionStanding()).to.be.false;
  });

  it('ENTER stands the context; it survives a re-enter (the next pick after a landing)', () => {
    enterFinaleSession();
    expect(finaleSessionStanding()).to.be.true;
    enterFinaleSession();
    expect(finaleSessionState).to.deep.include({active: true, collapsed: false});
  });

  it('COLLAPSE (B) hides the context but keeps the session; RESTORE brings it back as it stood', () => {
    enterFinaleSession();
    collapseFinaleSession();
    expect(finaleSessionState.active, 'the session lives on').to.be.true;
    expect(finaleSessionStanding(), 'the context is hidden').to.be.false;
    restoreFinaleSession();
    expect(finaleSessionStanding()).to.be.true;
  });

  it('a collapse or a restore without a session is a no-op (a stray B on the board home)', () => {
    collapseFinaleSession();
    restoreFinaleSession();
    expect(finaleSessionState).to.deep.include({active: false, collapsed: false});
  });

  it('END drops everything — the seat is done, the camera and the dossier let go', () => {
    enterFinaleSession();
    collapseFinaleSession();
    endFinaleSession();
    expect(finaleSessionState).to.deep.include({active: false, collapsed: false});
  });
});
