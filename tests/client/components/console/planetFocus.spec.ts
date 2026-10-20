import {expect} from 'chai';
import {
  planetFocusState, enterPlanetFocus, beginPlanetFocusExit, snapPlanetFocusSettled,
  planetFocusSettling, qualifiesForPlanetFocus,
  captureGlobalParams, resetPlanetFocus, isPlanetFocusEngaged, planetFocusStoryReady,
  HeldGlobalParams, PLANET_ARCS_RETURN_MS, PLANET_FOCUS_EXIT_MS, PLANET_STORY_READY_MS,
} from '@/client/console/planetFocus';
import {GameModel} from '@/common/models/GameModel';
import {SpaceModel} from '@/common/models/SpaceModel';
import {SpaceId} from '@/common/Types';
import {SpaceType} from '@/common/boards/SpaceType';

function space(id: string, spaceType: SpaceType): SpaceModel {
  return {id: id as SpaceId, x: 0, y: 0, spaceType, bonus: []};
}

function gameWith(params: Partial<HeldGlobalParams>): GameModel {
  return {
    temperature: params.temperature ?? -24,
    oxygenLevel: params.oxygenLevel ?? 2,
    oceans: params.oceans ?? 1,
    venusScaleLevel: params.venusScaleLevel ?? 4,
  } as GameModel;
}

/** The exit is fully settled (transition + the module's settle margin). */
const EXIT_SETTLED_MS = PLANET_FOCUS_EXIT_MS + 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/*
 * Since the ONE-OWNER merge (presentation-reconciliation, mechanism C) this
 * module owns only the CAMERA: phases, the arcs' return beat and the
 * exit-transition hold. The display freeze + the post-exit scale story live
 * in boardBeatPark (see boardBeatPark.spec.ts — the shell's watchable probe
 * counts an engaged focus as a covered board).
 */
describe('planetFocus — the main-grid placement stage', function() {
  // The phase-machine cases walk the REAL enter/exit windows (the module's
  // timers are its contract — nothing is faked). Isolated they take ~1.0-1.5 s
  // against mocha's 2 s default; inside the full client suite that margin is
  // gone and the run reports a timeout on a phase walk that finished
  // (isolated re-run: 26/26). Same treatment as `boardBeatPark.spec.ts`.
  // eslint-disable-next-line no-invalid-this
  this.timeout(15_000);

  afterEach(() => {
    // Module state is bundle-shared across specs — drop phases and timers.
    resetPlanetFocus();
  });

  describe('qualifiesForPlanetFocus', () => {
    const spaces = [
      space('03', SpaceType.LAND),
      space('04', SpaceType.OCEAN),
      space('01', SpaceType.COLONY),
    ];

    it('accepts a set that lives entirely on the main grid', () => {
      expect(qualifiesForPlanetFocus(['03', '04'] as Array<SpaceId>, spaces)).to.be.true;
    });

    it('rejects a set containing an off-Mars colony slot', () => {
      expect(qualifiesForPlanetFocus(['03', '01'] as Array<SpaceId>, spaces)).to.be.false;
    });

    it('rejects an id the displayed board does not know (a Moon cell)', () => {
      expect(qualifiesForPlanetFocus(['03', 'm04'] as Array<SpaceId>, spaces)).to.be.false;
    });

    it('rejects an empty / missing candidate set', () => {
      expect(qualifiesForPlanetFocus([] as Array<SpaceId>, spaces)).to.be.false;
      expect(qualifiesForPlanetFocus(undefined, spaces)).to.be.false;
      expect(qualifiesForPlanetFocus(['03'] as Array<SpaceId>, undefined)).to.be.false;
    });
  });

  describe('captureGlobalParams', () => {
    it('snapshots the four displayed parameters', () => {
      const snap = captureGlobalParams(gameWith({temperature: -20, oceans: 2}));
      expect(snap).to.deep.eq({temperature: -20, oxygenLevel: 2, oceans: 2, venusScaleLevel: 4});
    });
  });

  describe('the phase machine', () => {
    it('enter engages; snap settles the growth', () => {
      enterPlanetFocus();
      expect(planetFocusState.phase).to.eq('entering');
      expect(isPlanetFocusEngaged()).to.be.true;
      expect(planetFocusSettling()).to.be.true; // the camera is in motion

      snapPlanetFocusSettled();
      expect(planetFocusState.phase).to.eq('active');
      // A fully-grown stage is STABLE — scenes measure against it.
      expect(planetFocusSettling()).to.be.false;

      // A second enter (chained placement) is a no-op while engaged.
      enterPlanetFocus();
      expect(planetFocusState.phase).to.eq('active');
    });

    it('the CEREMONY mode (TR70): the same machine, the mode on the state; it takes an engaged placement camera, a placement never takes it back; idle restores the default', async () => {
      enterPlanetFocus();
      expect(planetFocusState.mode).to.eq('placement');
      enterPlanetFocus('ceremony');
      expect(planetFocusState.mode, 'the ceremony arriving over a placement camera takes the mode').to.eq('ceremony');
      expect(planetFocusState.phase).to.eq('entering');
      enterPlanetFocus('placement');
      expect(planetFocusState.mode, 'a placement never takes the mode back from a playing ceremony').to.eq('ceremony');
      snapPlanetFocusSettled();
      beginPlanetFocusExit();
      await new Promise((resolve) => setTimeout(resolve, 1300));
      expect(planetFocusState.phase).to.eq('idle');
      expect(planetFocusState.arcsReturning).to.eq(false);
      expect(planetFocusState.mode, 'idle is the placement\'s default').to.eq('placement');
      resetPlanetFocus();
      enterPlanetFocus('ceremony');
      resetPlanetFocus();
      expect(planetFocusState.mode).to.eq('placement');
    });

    it('exit walks exit-prep → exiting → idle and plays the arcs return beat', async () => {
      enterPlanetFocus();
      snapPlanetFocusSettled();

      beginPlanetFocusExit();
      expect(planetFocusState.phase).to.eq('exit-prep');
      expect(planetFocusSettling()).to.be.true;
      // rAF/16ms → 'exiting', then the exit settle (the transition + the
      // module's own margin) → 'idle'.
      await sleep(80);
      expect(planetFocusState.phase).to.eq('exiting');
      await sleep(EXIT_SETTLED_MS);
      expect(planetFocusState.phase).to.eq('idle');
      // The planet has landed and the arc band is fading back in — nothing
      // may move a scale through this window (the park's watchable probe
      // reads this very flag).
      expect(planetFocusState.arcsReturning).to.be.true;
      expect(planetFocusSettling()).to.be.true;

      await sleep(PLANET_ARCS_RETURN_MS + 120);
      expect(planetFocusState.arcsReturning).to.be.false;
      expect(planetFocusSettling()).to.be.false;
    });

    /*
     * THE SCALE STORY STARTS WITH THE PULLBACK (the tile language, W6 — the owner, 2026-10-20): past
     * `PLANET_STORY_READY_MS` of the exit the instruments are READABLE while the camera still lands — the park's drain
     * may tell the story from here. Every other automatic transition keeps the whole tail (`planetFocusSettling`).
     */
    it('the STORY-READY moment: readable inside the exit, the camera still «settling» for everyone else', async () => {
      expect(planetFocusStoryReady(), 'a camera at rest is ready').to.be.true;
      enterPlanetFocus();
      snapPlanetFocusSettled();
      expect(planetFocusStoryReady(), 'an engaged camera is not').to.be.false;
      beginPlanetFocusExit();
      await sleep(80);
      expect(planetFocusState.phase).to.eq('exiting');
      expect(planetFocusStoryReady(), 'the exit\'s first frames — the band is not formed').to.be.false;
      await sleep(PLANET_STORY_READY_MS);
      expect(planetFocusState.phase, 'still landing').to.eq('exiting');
      expect(planetFocusStoryReady(), 'readable from here').to.be.true;
      expect(planetFocusSettling(), '…while every other transition still waits the tail out').to.be.true;
      await sleep(EXIT_SETTLED_MS - PLANET_STORY_READY_MS);
      expect(planetFocusState.arcsReturning).to.be.true;
      expect(planetFocusStoryReady(), 'through the arcs\' return').to.be.true;
      await sleep(PLANET_ARCS_RETURN_MS + 120);
      expect(planetFocusState.storyReady).to.be.false;
      expect(planetFocusStoryReady(), 'at rest again').to.be.true;
      expect(planetFocusSettling()).to.be.false;
    });

    it('a reversal mid-exit drops the story-ready moment with the exit', async () => {
      enterPlanetFocus();
      snapPlanetFocusSettled();
      beginPlanetFocusExit();
      await sleep(80 + PLANET_STORY_READY_MS);
      expect(planetFocusStoryReady()).to.be.true;
      enterPlanetFocus();
      expect(planetFocusState.storyReady).to.be.false;
      expect(planetFocusStoryReady(), 'the camera is coming back in').to.be.false;
    });

    it('a mid-exit re-enter reclaims the mode and cancels the exit', async () => {
      enterPlanetFocus();
      snapPlanetFocusSettled();
      beginPlanetFocusExit();
      expect(planetFocusState.phase).to.eq('exit-prep');

      enterPlanetFocus();
      expect(planetFocusState.phase).to.eq('entering');
      // The cancelled exit settle must never fire behind the reversal.
      await sleep(EXIT_SETTLED_MS);
      expect(planetFocusState.phase).to.not.eq('idle');
    });

    it('reset drops the phase, the timers and the return beat', async () => {
      enterPlanetFocus();
      snapPlanetFocusSettled();
      beginPlanetFocusExit();
      await sleep(80);

      resetPlanetFocus();
      expect(planetFocusState.phase).to.eq('idle');
      expect(planetFocusState.arcsReturning).to.be.false;
      // The cancelled exit settle must not resurrect the return beat.
      await sleep(EXIT_SETTLED_MS);
      expect(planetFocusState.arcsReturning).to.be.false;
    });
  });
});
