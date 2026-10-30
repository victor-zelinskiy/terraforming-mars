import {expect} from 'chai';
import {delegateFlightMs} from '../../src/client/console/parliament/delegateFlightPose';
import {GRANT_CUBE_STAGGER_MS, GRANT_TOUCH_GAP_MS, grantCubeSchedule, grantPhraseMs} from '../../src/client/console/parliament/grantCubeSchedule';

/**
 * A GRANT OF SEVERAL DELEGATES IS ONE PHRASE (P72 — ledger CZ): the cubes of one answer leave the reserve staggered,
 * never each waiting for the previous touchdown; one flight keeps its own length (the cube's law, §8).
 */
describe('grantCubeSchedule — the pair as ONE phrase', () => {
  /** Distances a ribbon offers on every profile: a short hop (Deck), a mid reach (FHD), a long carry (4K). */
  const PROFILES: ReadonlyArray<ReadonlyArray<number>> = [
    [120, 140], [140, 120], [600, 640], [640, 600], [1500, 1560], [1560, 1500], [0, 10_000], [10_000, 0],
  ];

  it('a grant of ONE is exactly the old phrase — one start at 0, one whole flight', () => {
    expect(grantCubeSchedule([400])).deep.eq([{startMs: 0, durationMs: delegateFlightMs(400), touchMs: delegateFlightMs(400)}]);
  });

  it('the starts are ≥ 90 ms apart (law 12) — the stagger itself is 120 ms', () => {
    expect(GRANT_CUBE_STAGGER_MS).to.be.at.least(90);
    for (const distances of PROFILES) {
      const [a, b] = grantCubeSchedule(distances);
      expect(b.startMs - a.startMs, JSON.stringify(distances)).to.be.at.least(GRANT_CUBE_STAGGER_MS);
    }
  });

  it('ONE PHRASE — the second cube lifts BEFORE the first touches down, for any distances', () => {
    for (const distances of PROFILES) {
      const [a, b] = grantCubeSchedule(distances);
      expect(b.startMs, JSON.stringify(distances)).to.be.below(a.touchMs);
    }
  });

  it('the touchdowns keep the order of the starts, never closer than one tick apart', () => {
    for (const distances of [...PROFILES, [800, 100, 900, 50]]) {
      const beats = grantCubeSchedule(distances);
      for (let i = 1; i < beats.length; i++) {
        expect(beats[i].touchMs - beats[i - 1].touchMs, JSON.stringify(distances)).to.be.at.least(GRANT_TOUCH_GAP_MS);
        expect(beats[i].startMs).to.be.above(beats[i - 1].startMs);
      }
    }
  });

  it('one flight is never shortened — each keeps `delegateFlightMs` of its own distance', () => {
    const beats = grantCubeSchedule([200, 900]);
    expect(beats.map((b) => b.durationMs)).deep.eq([delegateFlightMs(200), delegateFlightMs(900)]);
    beats.forEach((b) => expect(b.touchMs - b.startMs).eq(b.durationMs));
  });

  it('the phrase is shorter than the queue by about one flight minus the stagger', () => {
    const distances = [600, 640];
    const queue = distances.reduce((sum, d) => sum + delegateFlightMs(d), 0);
    const phrase = grantPhraseMs(grantCubeSchedule(distances));
    expect(queue - phrase).to.be.closeTo(delegateFlightMs(600) - GRANT_CUBE_STAGGER_MS, 1);
  });

  it('reduced motion: no schedule at all (the cubes are simply there)', () => {
    expect(grantCubeSchedule([400, 400], true)).deep.eq([]);
    expect(grantPhraseMs([])).eq(0);
  });
});
