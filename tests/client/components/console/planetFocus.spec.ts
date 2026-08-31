import {expect} from 'chai';
import {
  planetFocusState, enterPlanetFocus, beginPlanetFocusExit, snapPlanetFocusSettled,
  playPlanetFocusScaleBeat, planetFocusBeatAllowed, qualifiesForPlanetFocus,
  captureGlobalParams, changedGlobalParams, displayGlobalParams,
  registerPlanetFocusParamsSource, resetPlanetFocus, isPlanetFocusEngaged,
  HeldGlobalParams, PLANET_ARCS_RETURN_MS, PLANET_FOCUS_EXIT_MS,
} from '@/client/console/planetFocus';
import {AdmissionSignals} from '@/client/console/consolePromptAdmission';
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

function quietSignals(over?: Partial<AdmissionSignals>): AdmissionSignals {
  return {
    revealOpen: false,
    revealPending: false,
    playedHero: false,
    tileHero: false,
    cardArrival: false,
    boardBonus: false,
    cardDiscard: false,
    presentation: false,
    announceGate: false,
    stageGated: false,
    anyAnimation: false,
    ...over,
  };
}

/** The exit is fully settled (transition + the module's settle margin). */
const EXIT_SETTLED_MS = PLANET_FOCUS_EXIT_MS + 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('planetFocus — the main-grid placement stage', () => {
  let unregister: (() => void) | undefined;

  afterEach(() => {
    // Module state is bundle-shared across specs — drop phases, held
    // values, accent classes and the params source.
    unregister?.();
    unregister = undefined;
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

  describe('the display hold', () => {
    it('serves live values while idle and the frozen snapshot while engaged', () => {
      const before = gameWith({temperature: -20, oceans: 2});
      expect(displayGlobalParams(before).temperature).to.eq(-20);

      enterPlanetFocus(before);
      // The commit lands mid-scene — the display must not move.
      const after = gameWith({temperature: -18, oceans: 3});
      expect(displayGlobalParams(after).temperature).to.eq(-20);
      expect(displayGlobalParams(after).oceans).to.eq(2);
    });

    it('changedGlobalParams names exactly the moved scales', () => {
      const held = captureGlobalParams(gameWith({temperature: -20, oceans: 2}));
      const live = captureGlobalParams(gameWith({temperature: -18, oceans: 2, oxygenLevel: 3}));
      expect(changedGlobalParams(held, live)).to.deep.eq(['temperature', 'oxygen']);
      expect(changedGlobalParams(held, held)).to.deep.eq([]);
    });
  });

  describe('the phase machine', () => {
    it('enter captures the snapshot once; snap settles the growth', () => {
      enterPlanetFocus(gameWith({temperature: -20}));
      expect(planetFocusState.phase).to.eq('entering');
      expect(isPlanetFocusEngaged()).to.be.true;
      expect(planetFocusState.heldParams?.temperature).to.eq(-20);

      snapPlanetFocusSettled();
      expect(planetFocusState.phase).to.eq('active');

      // A second enter (chained placement) keeps the ORIGINAL hold.
      enterPlanetFocus(gameWith({temperature: -12}));
      expect(planetFocusState.heldParams?.temperature).to.eq(-20);
    });

    it('exit walks exit-prep → exiting → idle and owes the beat on a change', async () => {
      unregister = registerPlanetFocusParamsSource(
        () => captureGlobalParams(gameWith({temperature: -18})));
      enterPlanetFocus(gameWith({temperature: -20}));
      snapPlanetFocusSettled();

      beginPlanetFocusExit();
      expect(planetFocusState.phase).to.eq('exit-prep');
      // rAF/16ms → 'exiting', then the exit settle (the transition + the
      // module's own margin) → 'idle'.
      await sleep(80);
      expect(planetFocusState.phase).to.eq('exiting');
      await sleep(EXIT_SETTLED_MS);
      expect(planetFocusState.phase).to.eq('idle');
      // Temperature moved held → live: the beat is OWED, values still held.
      expect(planetFocusState.beatPending).to.be.true;
      expect(planetFocusState.heldParams?.temperature).to.eq(-20);
    });

    it('an unchanged exit releases silently — no beat is owed', async () => {
      unregister = registerPlanetFocusParamsSource(
        () => captureGlobalParams(gameWith({temperature: -20})));
      enterPlanetFocus(gameWith({temperature: -20}));
      snapPlanetFocusSettled();
      beginPlanetFocusExit();
      await sleep(EXIT_SETTLED_MS);
      expect(planetFocusState.phase).to.eq('idle');
      expect(planetFocusState.beatPending).to.be.false;
      expect(planetFocusState.heldParams).to.be.undefined;
    });

    it('a mid-exit re-enter reclaims the mode and cancels the exit', async () => {
      unregister = registerPlanetFocusParamsSource(
        () => captureGlobalParams(gameWith({temperature: -18})));
      enterPlanetFocus(gameWith({temperature: -20}));
      snapPlanetFocusSettled();
      beginPlanetFocusExit();
      expect(planetFocusState.phase).to.eq('exit-prep');

      enterPlanetFocus(gameWith({temperature: -18}));
      expect(planetFocusState.phase).to.eq('entering');
      // The ORIGINAL hold survives the reversal (the chain's one story).
      expect(planetFocusState.heldParams?.temperature).to.eq(-20);
      // The cancelled exit settle must never fire behind the reversal.
      await sleep(EXIT_SETTLED_MS);
      expect(planetFocusState.phase).to.not.eq('idle');
    });
  });

  describe('the scale beat', () => {
    it('is allowed only when the scales can be read', () => {
      enterPlanetFocus(gameWith({}));
      planetFocusState.beatPending = true;
      expect(planetFocusBeatAllowed(quietSignals())).to.be.true;
      expect(planetFocusBeatAllowed(quietSignals({revealOpen: true}))).to.be.false;
      expect(planetFocusBeatAllowed(quietSignals({revealPending: true}))).to.be.false;
      expect(planetFocusBeatAllowed(quietSignals({cardArrival: true}))).to.be.false;
      expect(planetFocusBeatAllowed(quietSignals({boardBonus: true}))).to.be.false;
      expect(planetFocusBeatAllowed(quietSignals({cardDiscard: true}))).to.be.false;
      // Deliberately IGNORED: the beat is itself a blocking hold, and the
      // announce must come after the story (see planetFocus.ts).
      expect(planetFocusBeatAllowed(quietSignals({presentation: true, anyAnimation: true, announceGate: true}))).to.be.true;
      planetFocusState.beatPending = false;
      expect(planetFocusBeatAllowed(quietSignals())).to.be.false;
    });

    it('waits for the INSTRUMENTS to come back before it may play', async () => {
      unregister = registerPlanetFocusParamsSource(
        () => captureGlobalParams(gameWith({temperature: -18})));
      enterPlanetFocus(gameWith({temperature: -20}));
      snapPlanetFocusSettled();
      beginPlanetFocusExit();
      await sleep(EXIT_SETTLED_MS); // exit-prep → exiting → idle

      // The planet has landed and the arc band is fading back in: the beat
      // is OWED and HOLDS the foreground, but it may not play yet — a glide
      // behind a half-transparent band is the story this mode exists to fix.
      expect(planetFocusState.phase).to.eq('idle');
      expect(planetFocusState.arcsReturning).to.be.true;
      expect(planetFocusState.beatPending).to.be.true;
      expect(planetFocusBeatAllowed(quietSignals())).to.be.false;

      await sleep(PLANET_ARCS_RETURN_MS + 120);
      expect(planetFocusState.arcsReturning).to.be.false;
      expect(planetFocusBeatAllowed(quietSignals())).to.be.true;
    });

    it('releases the held values and pulses the changed scales', () => {
      unregister = registerPlanetFocusParamsSource(
        () => captureGlobalParams(gameWith({temperature: -18, oceans: 3})));
      enterPlanetFocus(gameWith({temperature: -20, oceans: 2}));
      // Simulate the exit having landed with the beat owed.
      planetFocusState.phase = 'idle';
      planetFocusState.beatPending = true;

      playPlanetFocusScaleBeat();
      expect(planetFocusState.beatPending).to.be.false;
      expect(planetFocusState.scaleBeat).to.be.true;
      expect(planetFocusState.heldParams).to.be.undefined;
      const html = document.documentElement.classList;
      expect(html.contains('con-scale-focus-temperature')).to.be.true;
      expect(html.contains('con-scale-focus-oceans')).to.be.true;
      expect(html.contains('con-scale-focus-oxygen')).to.be.false;
    });

    it('reset drops the beat, the hold and the accent classes', () => {
      unregister = registerPlanetFocusParamsSource(
        () => captureGlobalParams(gameWith({temperature: -18})));
      enterPlanetFocus(gameWith({temperature: -20}));
      planetFocusState.phase = 'idle';
      planetFocusState.beatPending = true;
      playPlanetFocusScaleBeat();
      expect(planetFocusState.scaleBeat).to.be.true;

      resetPlanetFocus();
      expect(planetFocusState.scaleBeat).to.be.false;
      expect(planetFocusState.beatPending).to.be.false;
      expect(planetFocusState.heldParams).to.be.undefined;
      expect(planetFocusState.phase).to.eq('idle');
      expect(document.documentElement.classList.contains('con-scale-focus-temperature')).to.be.false;
    });
  });
});
