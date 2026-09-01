import {expect} from 'chai';
import {watch} from 'vue';
import {
  armHydroMarkerTraversal, detectHydroMarker, endHydroMarker, hydroMarkerState,
  hydroParkedForeignStop, hydroStepActivated, hydroTraversalPaused, hydroTraversalPending,
  hydroVisualTrackPosition, registerHydroMarkerHandle, resetHydroMarker,
  resumeHydroMarkerTraversal, runHydroMarker, seedHydroMarkerRewardHold,
} from '@/client/console/hydroMarker/consoleHydroMarker';
import {clearPanelRewardHold, panelRewardHold} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import type {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';

/**
 * THE MULTI-ACTOR ESPIONAGE PLAN (Corporate Espionage, DP10): a traversal
 * whose FIRST leg moves ANOTHER PLAYER's marker (their colour, their cells,
 * a `foreign` leg) and whose second leg is the owner's own advance. The
 * printed order is the contract — the target retreats and fully resolves
 * BEFORE the owner's token moves — and these specs hold it at every
 * intermediate phase, exactly like the stage-bound suite beside them.
 */
describe('consoleHydroMarker — the espionage plan', () => {
  beforeEach(() => resetHydroMarker());
  afterEach(() => {
    resetHydroMarker();
    clearPanelRewardHold();
  });

  function manualDirector(): {beat: () => Promise<void>, stop: () => void} {
    let pending: Array<() => void> = [];
    const serve = () => registerHydroMarkerHandle({
      lock: (onLand) => pending.push(onLand),
      release: (onGone) => pending.push(onGone),
      skip: () => {},
    });
    serve();
    const stop = watch(() => hydroMarkerState.nonce, () => serve());
    return {
      beat: async () => {
        await new Promise((r) => setTimeout(r, 0));
        const q = pending;
        pending = [];
        q.forEach((fn) => fn());
      },
      stop,
    };
  }

  async function until(cond: () => boolean, ms = 1500): Promise<void> {
    const start = Date.now();
    while (!cond()) {
      if (Date.now() - start > ms) {
        throw new Error('until() timed out');
      }
      await new Promise((r) => setTimeout(r, 2));
    }
  }

  const OWNER_REWARD: ResourceTransferSpec = {channel: 'production', resource: 'megacredits', amount: 2};

  it('a DETERMINISTIC plan: the target leg glides THEIR marker first, the owner follows', async () => {
    const d = manualDirector();
    try {
      armHydroMarkerTraversal(2, [
        {position: 3, fromOverride: 4, color: 'red', foreign: true, transfers: [], beatMs: 1},
        {position: 3, fromOverride: 2, transfers: []},
      ], 'blue');

      // LEG 1 — the TARGET's: their colour, their departure cell; the
      // viewer's visual cursor stays parked on the OWNER's from.
      expect(hydroMarkerState.color).to.eq('red');
      expect(hydroMarkerState.fromPosition).to.eq(4);
      expect(hydroMarkerState.toPosition).to.eq(3);
      expect(hydroVisualTrackPosition()).to.eq(2);

      detectHydroMarker();
      const gate = runHydroMarker();
      await d.beat(); // lock on 3 (the target's landing)
      await gate;
      endHydroMarker();
      await d.beat(); // release — the target's real marker takes the cell

      // The FOREIGN leg wrote nothing of the viewer's walk: the visual
      // cursor still holds the owner's from, and no step cell activated.
      await until(() => hydroMarkerState.toPosition === 3 && hydroMarkerState.fromPosition === 2);
      expect(hydroVisualTrackPosition()).to.eq(2);
      expect(hydroStepActivated(3)).to.eq(false);

      // LEG 2 — the OWNER's: the plan's base colour, the owner's own route.
      expect(hydroMarkerState.color).to.eq('blue');

      await d.beat(); // lock on 3 (the owner's landing)
      await d.beat(); // release
      await until(() => !hydroTraversalPending());
      expect(hydroMarkerState.color).to.eq('');
      expect(hydroVisualTrackPosition()).to.eq(-1);
    } finally {
      d.stop();
    }
  });

  it('an INTERACTIVE target parks the plan on a FOREIGN prompt stop; the resume plays the owner leg', async () => {
    const d = manualDirector();
    try {
      armHydroMarkerTraversal(2, [
        {position: 3, fromOverride: 4, color: 'red', foreign: true, transfers: [], stop: 'prompt'},
        {position: 3, fromOverride: 2, transfers: [OWNER_REWARD]},
      ], 'blue');

      // The seed range SPLITS at the prompt stop: the first response grants
      // nothing of the owner's rewards (the target has not decided yet).
      seedHydroMarkerRewardHold();
      expect(panelRewardHold.active).to.eq(false);

      detectHydroMarker();
      const gate = runHydroMarker();
      await d.beat(); // lock (target lands)
      await gate;
      endHydroMarker();
      await d.beat(); // release
      await until(() => hydroTraversalPaused());

      // Parked on the TARGET's own decision — the foreign park, the one the
      // shell resumes on SERVER evidence and never on the local screen.
      expect(hydroParkedForeignStop()).to.eq(true);
      expect(hydroMarkerState.parkedAt).to.eq(3);
      expect(hydroVisualTrackPosition()).to.eq(2);

      // The ANSWERING response applies — the next range (the owner's
      // rewards) seeds now, and only now.
      seedHydroMarkerRewardHold();
      expect(panelRewardHold.active).to.eq(true);
      expect(panelRewardHold.production['megacredits']).to.eq(2);

      // The owner's position arrived — the shell resumes; the owner leg runs.
      resumeHydroMarkerTraversal();
      await until(() => hydroMarkerState.active);
      expect(hydroParkedForeignStop()).to.eq(false);
      expect(hydroMarkerState.color).to.eq('blue');
      expect(hydroMarkerState.fromPosition).to.eq(2);
      await d.beat(); // lock (owner lands)
      await d.beat(); // release
      await until(() => !hydroTraversalPending());
    } finally {
      d.stop();
    }
  });

  it('a VIEWER-ONLY plan is untouched by the extension (regression)', async () => {
    const d = manualDirector();
    try {
      armHydroMarkerTraversal(4, [
        {position: 5, transfers: []},
        {position: 6, transfers: []},
      ], 'blue');
      expect(hydroMarkerState.color).to.eq('blue');
      expect(hydroMarkerState.fromPosition).to.eq(4);
      detectHydroMarker();
      const gate = runHydroMarker();
      await d.beat();
      await gate;
      endHydroMarker();
      await d.beat();
      await until(() => hydroVisualTrackPosition() === 5);
      expect(hydroStepActivated(5)).to.eq(true);
      await until(() => hydroMarkerState.toPosition === 6);
      expect(hydroMarkerState.fromPosition).to.eq(5);
      await d.beat();
      await d.beat();
      await until(() => !hydroTraversalPending());
    } finally {
      d.stop();
    }
  });
});
