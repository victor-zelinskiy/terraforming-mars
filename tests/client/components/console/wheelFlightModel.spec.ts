import {expect} from 'chai';
import {
  CONFIRM_FLIGHT,
  FLIGHT_ACQUIRE_TIMEOUT_MS,
  WHEEL_FLIGHTS,
  flightArcPoint,
  flightBulgeOf,
  flightTravelMsOf,
  wheelFlightSpecFor,
} from '@/client/console/quickWheel/wheelFlightModel';
import {buildLtQuickEntries, buildRtQuickEntries} from '@/client/console/consoleQuickModel';

describe('wheelFlightModel', () => {
  it('EVERY wheel entry of both selectors has a declared flight (the table is the coverage guard)', () => {
    const rt = buildRtQuickEntries({
      cardsPlayable: 1, cardsTotal: 2, actionsAvailable: 1,
      hasColonies: true, hasTurmoil: true, hasHydro: true,
    });
    const lt = buildLtQuickEntries({
      myTurn: true, awaitingInput: true, stdAvailable: true, endTurnAvailable: true,
      passAvailable: true, convertPlantsAvailable: true, convertHeatAvailable: true,
      plantsNeeded: 8, heatNeeded: 8,
    });
    // «Голосование» is a reserved never-available slot — the one entry that
    // deliberately has no transition (nothing ever commits from it).
    const expectFlightless = new Set(['voting']);
    for (const entry of [...rt, ...lt]) {
      if (expectFlightless.has(entry.id)) {
        expect(wheelFlightSpecFor(entry.id), entry.id).to.eq(undefined);
      } else {
        expect(wheelFlightSpecFor(entry.id), `wheel entry '${entry.id}' needs a WHEEL_FLIGHTS row`).to.not.eq(undefined);
      }
    }
  });

  it('every declared anchor rides a landing mode, and self-contained beats have neither', () => {
    for (const [id, spec] of Object.entries(WHEEL_FLIGHTS)) {
      if (spec.anchor !== undefined) {
        expect(spec.landing, `'${id}' has an anchor and must declare its landing`).to.be.oneOf(['become', 'absorb']);
      } else {
        expect(spec.landing, `'${id}' is self-contained — landing is meaningless`).to.eq(undefined);
      }
    }
  });

  it('the confirm retarget lands as a become on the confirm anchor', () => {
    expect(CONFIRM_FLIGHT.anchor).to.eq('confirm');
    expect(CONFIRM_FLIGHT.landing).to.eq('become');
  });

  it('flightArcPoint starts at from, ends at to, and bulges off the chord in between', () => {
    const from = {x: 0, y: 0};
    const to = {x: 100, y: 0};
    expect(flightArcPoint(0, from, to, 0.25)).to.deep.eq({x: 0, y: 0});
    expect(flightArcPoint(1, from, to, 0.25)).to.deep.eq({x: 100, y: 0});
    const mid = flightArcPoint(0.5, from, to, 0.25);
    expect(mid.x).to.be.closeTo(50, 1e-9);
    expect(mid.y).to.be.closeTo(12.5, 1e-9); // half the control offset (100 * 0.25 / 2)
    // Zero bulge degenerates to the straight chord.
    expect(flightArcPoint(0.5, from, to, 0)).to.deep.eq({x: 50, y: 0});
  });

  it('every character resolves a travel duration and a (possibly zero) bulge', () => {
    const characters = ['orbit', 'surge', 'forge', 'wave', 'deal', 'flag', 'ember', 'sprout', 'stamp'] as const;
    for (const c of characters) {
      expect(flightTravelMsOf(c), c).to.be.greaterThan(0);
      // The wheel is a high-frequency control — no flight may drag.
      expect(flightTravelMsOf(c), c).to.be.at.most(450);
      expect(flightBulgeOf(c), c).to.be.a('number');
    }
  });

  it('acquisition is bounded (a missing destination can never strand the proxy)', () => {
    expect(FLIGHT_ACQUIRE_TIMEOUT_MS).to.be.greaterThan(0);
    expect(FLIGHT_ACQUIRE_TIMEOUT_MS).to.be.at.most(1500);
  });
});
