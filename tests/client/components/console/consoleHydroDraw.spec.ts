import {expect} from 'chai';
import {
  abortHydroDraw, armHydroDraw, endHydroDraw, hydroDrawState, isHydroDrawActive,
  isHydroDrawClaimed, markHydroDrawClaimed, registerHydroDrawHandle, resetHydroDraw,
  setHydroDrawPhase,
} from '@/client/console/hydroDraw/consoleHydroDraw';

describe('consoleHydroDraw', () => {
  beforeEach(() => resetHydroDraw());
  afterEach(() => resetHydroDraw());

  it('arm sets the scene live synchronously (the input gate closes)', () => {
    expect(isHydroDrawActive()).to.eq(false);
    const before = hydroDrawState.nonce;
    armHydroDraw(5);
    expect(isHydroDrawActive()).to.eq(true);
    expect(hydroDrawState.phase).to.eq('lift');
    expect(hydroDrawState.stopPosition).to.eq(5);
    expect(hydroDrawState.nonce).to.eq(before + 1);
  });

  it('arm names the CELL the cards come out of (the stop the marker advances to)', () => {
    armHydroDraw(7);
    // The layer waits for the marker to SETTLE on this stop before the cards
    // appear — the landing is what puts the cell in focus.
    expect(hydroDrawState.stopPosition).to.eq(7);
  });

  it('an armed-but-unclaimed scene NEVER veils the pick modal', () => {
    armHydroDraw(5);
    // The task host reads `isHydroDrawClaimed()`, not `isHydroDrawActive()`:
    // a scene nobody is playing must not hold the modal invisible.
    expect(isHydroDrawActive()).to.eq(true);
    expect(isHydroDrawClaimed()).to.eq(false);
    markHydroDrawClaimed();
    expect(isHydroDrawClaimed()).to.eq(true);
  });

  it('a claim outside an armed scene is a no-op (never a stale veil)', () => {
    markHydroDrawClaimed();
    expect(hydroDrawState.claimed).to.eq(false);
    expect(isHydroDrawClaimed()).to.eq(false);
  });

  it('phase transitions only apply while active (lift → fan → frame → handoff)', () => {
    setHydroDrawPhase('fan');
    expect(hydroDrawState.phase).to.eq('idle'); // no-op when inactive
    armHydroDraw(5);
    setHydroDrawPhase('fan');
    expect(hydroDrawState.phase).to.eq('fan');
    setHydroDrawPhase('frame');
    expect(hydroDrawState.phase).to.eq('frame');
    setHydroDrawPhase('handoff');
    expect(hydroDrawState.phase).to.eq('handoff');
  });

  it('end drops the veil + the input gate (idempotent)', () => {
    armHydroDraw(5);
    markHydroDrawClaimed();
    endHydroDraw();
    expect(isHydroDrawActive()).to.eq(false);
    expect(isHydroDrawClaimed()).to.eq(false);
    expect(hydroDrawState.phase).to.eq('idle');
    expect(hydroDrawState.stopPosition).to.eq(-1);
    endHydroDraw(); // idempotent
    expect(isHydroDrawActive()).to.eq(false);
  });

  it('abort recalls the layer via its handle AND clears the state', () => {
    armHydroDraw(7);
    markHydroDrawClaimed();
    let aborted = false;
    registerHydroDrawHandle({abort: () => {
      aborted = true;
    }});
    abortHydroDraw();
    expect(aborted).to.eq(true);
    expect(isHydroDrawActive()).to.eq(false);
    expect(isHydroDrawClaimed()).to.eq(false);
    expect(hydroDrawState.phase).to.eq('idle');
  });

  it('abort is a no-op when nothing is armed', () => {
    let aborted = false;
    registerHydroDrawHandle({abort: () => {
      aborted = true;
    }});
    abortHydroDraw();
    expect(aborted).to.eq(false);
  });
});
