import {expect} from 'chai';
import {
  abortHydroMarker, armHydroMarker, detectHydroMarker, endHydroMarker, hydroMarkerState,
  isHydroMarkerActive, registerHydroMarkerHandle, resetHydroMarker, runHydroMarker, setHydroMarkerPhase,
} from '@/client/console/hydroMarker/consoleHydroMarker';

describe('consoleHydroMarker', () => {
  beforeEach(() => resetHydroMarker());
  afterEach(() => resetHydroMarker());

  it('arm sets the advance live synchronously (input gate closes at once)', () => {
    expect(isHydroMarkerActive()).to.eq(false);
    armHydroMarker(2, 5, 'blue');
    expect(isHydroMarkerActive()).to.eq(true);
    expect(hydroMarkerState.phase).to.eq('charge');
    expect(hydroMarkerState.fromPosition).to.eq(2);
    expect(hydroMarkerState.toPosition).to.eq(5);
    expect(hydroMarkerState.color).to.eq('blue');
  });

  it('detect claims the arm EXACTLY once', () => {
    armHydroMarker(0, 3, 'red');
    const first = detectHydroMarker();
    expect(first).to.not.eq(undefined);
    expect(first?.toPosition).to.eq(3);
    expect(detectHydroMarker()).to.eq(undefined);
  });

  it('detect returns undefined when NOT armed (desktop / non-hydro submit)', () => {
    expect(detectHydroMarker()).to.eq(undefined);
  });

  it('run locks, then end crossfades (release) before clearing + settle glow', async () => {
    armHydroMarker(1, 4, 'green');
    let lockCalled = false;
    let releaseCalled = false;
    registerHydroMarkerHandle({
      lock: (onLand) => {
        lockCalled = true;
        onLand();
      },
      release: (onGone) => {
        releaseCalled = true;
        onGone();
      },
      skip: () => {},
    });
    detectHydroMarker();
    await runHydroMarker();
    expect(lockCalled).to.eq(true);
    expect(isHydroMarkerActive()).to.eq(true); // still active until the crossfade
    endHydroMarker();
    expect(releaseCalled).to.eq(true);
    expect(isHydroMarkerActive()).to.eq(false);
    expect(hydroMarkerState.settledPosition).to.eq(4);
  });

  it('run resolves even with NO director (degenerate / reduced snap)', async () => {
    armHydroMarker(0, 2, 'yellow');
    hydroMarkerState.reducedMotion = true;
    detectHydroMarker();
    await runHydroMarker();
    expect(true).to.eq(true);
  });

  it('abort recalls the marker AND resolves a pending gate (never hangs)', async () => {
    armHydroMarker(3, 6, 'purple');
    let skipped = false;
    registerHydroMarkerHandle({lock: () => {}, release: () => {}, skip: () => {
      skipped = true;
    }});
    detectHydroMarker();
    const gate = runHydroMarker();
    abortHydroMarker();
    await gate;
    expect(skipped).to.eq(true);
    expect(isHydroMarkerActive()).to.eq(false);
  });

  it('setHydroMarkerPhase only applies while active', () => {
    setHydroMarkerPhase('glide');
    expect(hydroMarkerState.phase).to.eq('idle');
    armHydroMarker(0, 1, 'blue');
    setHydroMarkerPhase('arrive');
    expect(hydroMarkerState.phase).to.eq('arrive');
  });
});
