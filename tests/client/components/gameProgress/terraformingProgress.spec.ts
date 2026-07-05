import {expect} from 'chai';
import {terraformingProgress, venusDisplayProgress} from '@/client/components/gameProgress/terraformingProgress';

describe('terraformingProgress', () => {
  it('starts at 0% on a fresh board', () => {
    const p = terraformingProgress({temperature: -30, oxygenLevel: 0, oceans: 0});
    expect(p.percent).to.eq(0);
    expect(p.total).to.eq(0);
    expect(p.complete).to.be.false;
  });

  it('aggregates Temperature + Oxygen + Oceans with equal weight', () => {
    // The reference mid-game snapshot: -28°C, 2% O₂, 2 oceans → 14%
    // (matches the shipped desktop sidebar readout).
    const p = terraformingProgress({temperature: -28, oxygenLevel: 2, oceans: 2});
    expect(p.temperature).to.be.closeTo(2 / 38, 1e-9);
    expect(p.oxygen).to.be.closeTo(2 / 14, 1e-9);
    expect(p.oceans).to.be.closeTo(2 / 9, 1e-9);
    expect(p.percent).to.eq(14);
    expect(p.complete).to.be.false;
  });

  it('Venus is NOT an input — the type has no venus field and the math never reads one', () => {
    // Passing an object with an (ignored) venus level changes nothing.
    const withVenus = terraformingProgress({temperature: -28, oxygenLevel: 2, oceans: 2, venusScaleLevel: 30} as never);
    const withoutVenus = terraformingProgress({temperature: -28, oxygenLevel: 2, oceans: 2});
    expect(withVenus).to.deep.eq(withoutVenus);
  });

  it('clamps out-of-range values', () => {
    const p = terraformingProgress({temperature: 12, oxygenLevel: 20, oceans: 11});
    expect(p.temperature).to.eq(1);
    expect(p.oxygen).to.eq(1);
    expect(p.oceans).to.eq(1);
    expect(p.percent).to.eq(100);
    expect(p.complete).to.be.true;
  });

  it('never reads 100% until ALL THREE parameters are complete', () => {
    // Max temperature + oxygen, 8/9 oceans — the highest possible
    // not-complete state.
    const p = terraformingProgress({temperature: 8, oxygenLevel: 14, oceans: 8});
    expect(p.complete).to.be.false;
    expect(p.percent).to.be.lessThan(100);
  });

  it('reads exactly 100% when the three parameters are maxed', () => {
    const p = terraformingProgress({temperature: 8, oxygenLevel: 14, oceans: 9});
    expect(p.complete).to.be.true;
    expect(p.percent).to.eq(100);
  });

  it('rounding is stable (integer percent per state — no visual jitter)', () => {
    const a = terraformingProgress({temperature: -28, oxygenLevel: 2, oceans: 2});
    const b = terraformingProgress({temperature: -28, oxygenLevel: 2, oceans: 2});
    expect(a.percent).to.eq(b.percent);
    expect(Number.isInteger(a.percent)).to.be.true;
  });

  it('venusDisplayProgress is a separate per-axis scale', () => {
    expect(venusDisplayProgress(0)).to.eq(0);
    expect(venusDisplayProgress(15)).to.be.closeTo(0.5, 1e-9);
    expect(venusDisplayProgress(30)).to.eq(1);
    expect(venusDisplayProgress(40)).to.eq(1);
  });
});
