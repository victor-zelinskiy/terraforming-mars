import {expect} from 'chai';
import {
  abortHydroDraw, armHydroDraw, endHydroDraw, hydroDrawState, isHydroDrawActive,
  registerHydroDrawHandle, resetHydroDraw, setHydroDrawPhase,
} from '@/client/console/hydroDraw/consoleHydroDraw';

describe('consoleHydroDraw', () => {
  beforeEach(() => resetHydroDraw());
  afterEach(() => resetHydroDraw());

  it('arm sets the scene live synchronously (input gate closes, modal veils)', () => {
    expect(isHydroDrawActive()).to.eq(false);
    const before = hydroDrawState.nonce;
    armHydroDraw(5);
    expect(isHydroDrawActive()).to.eq(true);
    expect(hydroDrawState.phase).to.eq('lift');
    expect(hydroDrawState.stopPosition).to.eq(5);
    expect(hydroDrawState.nonce).to.eq(before + 1);
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
    endHydroDraw();
    expect(isHydroDrawActive()).to.eq(false);
    expect(hydroDrawState.phase).to.eq('idle');
    expect(hydroDrawState.stopPosition).to.eq(-1);
    endHydroDraw(); // idempotent
    expect(isHydroDrawActive()).to.eq(false);
  });

  it('abort recalls the layer via its handle AND clears the state', () => {
    armHydroDraw(7);
    let aborted = false;
    registerHydroDrawHandle({abort: () => {
      aborted = true;
    }});
    abortHydroDraw();
    expect(aborted).to.eq(true);
    expect(isHydroDrawActive()).to.eq(false);
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
