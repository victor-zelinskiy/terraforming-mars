import {expect} from 'chai';
import {watch} from 'vue';
import {
  abortHydroMarker, armHydroMarker, armHydroMarkerTraversal, detectHydroMarker, endHydroMarker,
  hydroMarkerState, hydroTraversalPaused, hydroTraversalPending, hydroVisualTrackPosition,
  isHydroMarkerActive, registerHydroMarkerHandle, resetHydroMarker, resumeHydroMarkerTraversal,
  runHydroMarker, seedHydroMarkerRewardHold, setHydroMarkerPhase,
} from '@/client/console/hydroMarker/consoleHydroMarker';
import {clearPanelRewardHold, panelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';

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

  describe('the TRAVERSAL plan (Delta Surge — ordered legs, stops, resume)', () => {
    /** Auto-serve every leg's director: lock and release instantly, and
     *  re-register on each nonce bump (the layer's own contract). Reduced
     *  motion keeps the excluded-cell dwell out of the clock. */
    function autoDirector(): () => void {
      const serve = () => registerHydroMarkerHandle({
        lock: (onLand) => onLand(),
        release: (onGone) => onGone(),
        skip: () => {},
      });
      serve();
      const stop = watch(() => hydroMarkerState.nonce, () => serve());
      return stop;
    }

    /** Poll a condition on macro-ticks (the runner is async across legs). */
    function until(cond: () => boolean, limitMs = 4000): Promise<void> {
      return new Promise((resolve, reject) => {
        const t0 = Date.now();
        const tick = () => {
          if (cond()) {
            resolve();
          } else if (Date.now() - t0 > limitMs) {
            reject(new Error('condition never held'));
          } else {
            setTimeout(tick, 10);
          }
        };
        tick();
      });
    }

    it('arms the whole plan; the FIRST leg rides the standard transport gate', () => {
      armHydroMarkerTraversal(0, [
        {position: 1, transfers: []},
        {position: 2, transfers: []},
      ], 'blue');
      expect(isHydroMarkerActive()).to.eq(true);
      expect(hydroTraversalPending()).to.eq(true);
      expect(hydroMarkerState.fromPosition).to.eq(0);
      expect(hydroMarkerState.toPosition).to.eq(1);
      expect(hydroVisualTrackPosition()).to.eq(0);
      expect(detectHydroMarker()?.toPosition).to.eq(1);
      expect(detectHydroMarker(), 'claimed once').to.eq(undefined);
    });

    it('runs every leg IN ORDER and finishes: the visual cursor walks, never teleports', async () => {
      const stop = autoDirector();
      try {
        hydroMarkerState.reducedMotion = true;
        armHydroMarkerTraversal(0, [
          {position: 1, transfers: []},
          {position: 2, transfers: []},
          {position: 3, transfers: []},
        ], 'blue');
        hydroMarkerState.reducedMotion = true;
        const seen: Array<number> = [];
        const unwatch = watch(() => hydroMarkerState.visualPosition, (v) => {
          if (v >= 0) {
            seen.push(v);
          }
        });
        detectHydroMarker();
        await runHydroMarker();
        endHydroMarker();
        await until(() => !hydroTraversalPending());
        unwatch();
        expect(seen).to.deep.eq([1, 2, 3]);
        expect(isHydroMarkerActive()).to.eq(false);
        expect(hydroMarkerState.settledPosition).to.eq(3);
      } finally {
        stop();
      }
    });

    it('PARKS at an interactive stop (the input gate opens) and RESUMES on the shell signal only', async () => {
      const stop = autoDirector();
      try {
        armHydroMarkerTraversal(4, [
          {position: 5, transfers: [], stop: 'deck-draw'},
          {position: 6, transfers: []},
        ], 'blue');
        hydroMarkerState.reducedMotion = true;
        detectHydroMarker();
        await runHydroMarker();
        endHydroMarker();
        await until(() => hydroTraversalPaused());
        // Parked ON the stop: the player can interact, the plan still stands.
        expect(isHydroMarkerActive()).to.eq(false);
        expect(hydroTraversalPending()).to.eq(true);
        expect(hydroVisualTrackPosition()).to.eq(5);
        // Nothing moves on its own.
        await new Promise((r) => setTimeout(r, 60));
        expect(hydroTraversalPaused()).to.eq(true);
        resumeHydroMarkerTraversal();
        expect(isHydroMarkerActive()).to.eq(true);
        await until(() => !hydroTraversalPending());
        expect(hydroMarkerState.settledPosition).to.eq(6);
      } finally {
        stop();
      }
    });

    it('an EXCLUDED cell (the 2 VP crossing) is walked through — settle, no wave, the sequence continues', async () => {
      const stop = autoDirector();
      try {
        armHydroMarkerTraversal(9, [
          {position: 10, transfers: [], excluded: true},
          {position: 11, transfers: []},
        ], 'blue');
        hydroMarkerState.reducedMotion = true;
        detectHydroMarker();
        await runHydroMarker();
        const seen: Array<number> = [];
        const unwatch = watch(() => hydroMarkerState.visualPosition, (v) => {
          if (v >= 0) {
            seen.push(v);
          }
        });
        endHydroMarker();
        await until(() => !hydroTraversalPending());
        unwatch();
        // The marker physically crossed the excluded cell before the finish.
        expect(seen).to.deep.eq([10, 11]);
      } finally {
        stop();
      }
    });

    it('abort mid-plan clears the plan and yields the visual cursor to the server truth', async () => {
      armHydroMarkerTraversal(0, [
        {position: 1, transfers: []},
        {position: 2, transfers: [], stop: 'deck-draw'},
      ], 'blue');
      abortHydroMarker();
      expect(hydroTraversalPending()).to.eq(false);
      expect(hydroVisualTrackPosition()).to.eq(-1);
      expect(isHydroMarkerActive()).to.eq(false);
    });

    it('an interactive stop\'s OWN gains fly at the RESUME, never on arrival (the closing beat)', async () => {
      // A repeated action's rewards exist only once its whole presentation
      // (reveal, picks, the hand intake) has finished — so the stop's
      // transfers are stashed at the pause and become the resume's wave. The
      // panel hold is the witness: seeded with the response, still HELD
      // through the whole pause, released only by the resume's wave (jsdom
      // degrades the flight and releases per spec — honest, just instant).
      const stop = autoDirector();
      const steel: ResourceTransferSpec = {channel: 'stock', resource: 'steel', amount: 2};
      try {
        armHydroMarkerTraversal(6, [
          {position: 7, transfers: [steel], stop: 'repeat'},
        ], 'blue');
        // The transport's synchronous seed (same block as the view apply).
        seedHydroMarkerRewardHold();
        expect(panelRewardHold.active, 'seeded with the response').to.eq(true);
        detectHydroMarker();
        await runHydroMarker();
        endHydroMarker();
        await until(() => hydroTraversalPaused());
        // Parked ON the stop: nothing flew — the reward is still held.
        expect(panelRewardHold.active, 'held through the pause').to.eq(true);
        expect(hydroTraversalPending()).to.eq(true);
        resumeHydroMarkerTraversal();
        await until(() => !hydroTraversalPending());
        // The resume's wave released the hold (per touchdown; degraded =
        // instant) and the one-leg plan finished.
        expect(panelRewardHold.active, 'released by the resume wave').to.eq(false);
        expect(hydroMarkerState.settledPosition).to.eq(7);
      } finally {
        stop();
        clearPanelRewardHold();
      }
    });

    it('abort while parked at a stop clears the stashed resume wave (no ghost flight later)', () => {
      armHydroMarkerTraversal(6, [
        {position: 7, transfers: [{channel: 'stock', resource: 'steel', amount: 2}], stop: 'repeat'},
      ], 'blue');
      abortHydroMarker();
      // A resume after the abort must be a no-op: no plan, no wave, no hold.
      resumeHydroMarkerTraversal();
      expect(hydroTraversalPending()).to.eq(false);
      expect(panelRewardHold.active).to.eq(false);
    });
  });
});
