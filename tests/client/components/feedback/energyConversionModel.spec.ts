import {expect} from 'chai';
import {
  CONVERSION_MAX_MS,
  CONVERSION_MIN_MS,
  CONVERSION_REDUCED_MS,
  conversionDurationMs,
  easeOutCubic,
  interpolate,
  readConversionEvent,
  shouldAnimateConversion,
} from '@/client/components/feedback/energyConversionModel';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';

// Minimal view factory — only the fields readConversionEvent touches.
function playerView(overrides: {
  energyHeatConversion?: {amount: number, energyBefore: number, heatBefore: number, generation: number},
  color?: string,
  runId?: string,
  hasThisPlayer?: boolean,
} = {}): PlayerViewModel {
  const hasThisPlayer = overrides.hasThisPlayer ?? true;
  return {
    runId: overrides.runId ?? 'run-1',
    thisPlayer: hasThisPlayer ? {color: overrides.color ?? 'red'} : undefined,
    energyHeatConversion: overrides.energyHeatConversion,
  } as unknown as PlayerViewModel;
}

describe('energyConversionModel', () => {
  describe('conversionDurationMs', () => {
    it('clamps to the min for a tiny conversion', () => {
      expect(conversionDurationMs(1, false)).to.eq(CONVERSION_MIN_MS); // 1145 → 1200
      expect(conversionDurationMs(2, false)).to.eq(CONVERSION_MIN_MS); // 1190 → 1200
    });

    it('scales in the readable middle band', () => {
      expect(conversionDurationMs(3, false)).to.eq(1100 + 3 * 45); // 1235 (clears the floor)
      expect(conversionDurationMs(8, false)).to.eq(1100 + 8 * 45); // 1460
      expect(conversionDurationMs(12, false)).to.eq(1100 + 12 * 45); // 1640
    });

    it('caps at the max for a big battery dump', () => {
      expect(conversionDurationMs(30, false)).to.eq(CONVERSION_MAX_MS); // 2450 → 2200
      expect(conversionDurationMs(100, false)).to.eq(CONVERSION_MAX_MS);
    });

    it('uses the short fixed duration under reduced motion regardless of amount', () => {
      expect(conversionDurationMs(1, true)).to.eq(CONVERSION_REDUCED_MS);
      expect(conversionDurationMs(40, true)).to.eq(CONVERSION_REDUCED_MS);
    });
  });

  describe('readConversionEvent', () => {
    it('returns undefined for an undefined view', () => {
      expect(readConversionEvent(undefined)).to.be.undefined;
    });

    it('returns undefined when there is no conversion snapshot', () => {
      expect(readConversionEvent(playerView())).to.be.undefined;
    });

    it('returns undefined for a zero-amount conversion (nothing converted)', () => {
      expect(readConversionEvent(playerView({
        energyHeatConversion: {amount: 0, energyBefore: 0, heatBefore: 5, generation: 2},
      }))).to.be.undefined;
    });

    it('returns undefined for a spectator-style view (no thisPlayer)', () => {
      expect(readConversionEvent(playerView({
        hasThisPlayer: false,
        energyHeatConversion: {amount: 8, energyBefore: 8, heatBefore: 12, generation: 2},
      }))).to.be.undefined;
    });

    it('resolves a full paired event from the snapshot', () => {
      const event = readConversionEvent(playerView({
        color: 'blue',
        runId: 'game-7',
        energyHeatConversion: {amount: 8, energyBefore: 8, heatBefore: 12, generation: 4},
      }));
      expect(event).to.not.be.undefined;
      expect(event!.color).to.eq('blue');
      expect(event!.runId).to.eq('game-7');
      expect(event!.amount).to.eq(8);
      expect(event!.source).to.deep.eq({resource: 'energy', before: 8, after: 0, delta: -8});
      expect(event!.target).to.deep.eq({resource: 'heat', before: 12, after: 20, delta: 8});
      expect(event!.dedupeKey).to.eq('blue:4');
    });

    it('handles a partial (Supercapacitors) conversion that leaves energy behind', () => {
      const event = readConversionEvent(playerView({
        energyHeatConversion: {amount: 5, energyBefore: 12, heatBefore: 4, generation: 3},
      }));
      expect(event!.source).to.deep.eq({resource: 'energy', before: 12, after: 7, delta: -5});
      expect(event!.target).to.deep.eq({resource: 'heat', before: 4, after: 9, delta: 5});
    });
  });

  describe('shouldAnimateConversion', () => {
    const event = readConversionEvent(playerView({
      energyHeatConversion: {amount: 8, energyBefore: 8, heatBefore: 12, generation: 4},
    }))!;
    const prev = playerView() as ViewModel;

    it('is false when there is no event', () => {
      expect(shouldAnimateConversion(prev, undefined, new Set())).to.be.false;
    });

    it('is false when the conversion was already seen (poll replay)', () => {
      expect(shouldAnimateConversion(prev, event, new Set([event.dedupeKey]))).to.be.false;
    });

    it('is false on a fresh load with no previous view (moment already passed)', () => {
      expect(shouldAnimateConversion(undefined, event, new Set())).to.be.false;
    });

    it('is true for a fresh, unseen conversion with a previous view', () => {
      expect(shouldAnimateConversion(prev, event, new Set())).to.be.true;
    });
  });

  describe('interpolation', () => {
    it('eases from 0 to 1 with a decelerating curve', () => {
      expect(easeOutCubic(0)).to.eq(0);
      expect(easeOutCubic(1)).to.eq(1);
      expect(easeOutCubic(0.5)).to.be.greaterThan(0.5); // ease-out is ahead at the midpoint
    });

    it('clamps t outside [0, 1]', () => {
      expect(interpolate(10, 0, -1)).to.eq(10);
      expect(interpolate(10, 0, 2)).to.eq(0);
    });

    it('lands exactly on the endpoints', () => {
      expect(interpolate(8, 0, 0)).to.eq(8);
      expect(interpolate(8, 0, 1)).to.eq(0);
      expect(interpolate(12, 20, 1)).to.eq(20);
    });
  });
});
