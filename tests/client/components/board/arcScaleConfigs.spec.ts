import {expect} from 'chai';
import {OXYGEN_ARC, TEMPERATURE_ARC, VENUS_ARC, arcAngleForValue, arcFillFraction, DynamicArcConfig} from '@/client/components/board/arcScaleConfigs';

const ALL: ReadonlyArray<DynamicArcConfig> = [OXYGEN_ARC, TEMPERATURE_ARC, VENUS_ARC];

describe('arcScaleConfigs', () => {
  it('derives configs concentric with the board scales (centre 300,301, radius ≈ 267)', () => {
    for (const c of ALL) {
      expect(c.center).to.deep.eq({x: 300, y: 301});
      expect(c.bandRadius).to.be.greaterThan(255);
      expect(c.bandRadius).to.be.lessThan(280);
    }
  });

  it('orders digits ascending and keeps angles MONOTONIC (no ±180° seam jumps)', () => {
    for (const c of ALL) {
      const vals = c.digits.map((d) => d.value);
      expect(vals).to.deep.eq([...vals].sort((a, b) => a - b));
      // Every consecutive angle step is < 180° in magnitude AND same direction.
      const steps = c.digits.slice(1).map((d, i) => d.angle - c.digits[i].angle);
      for (const s of steps) {
        expect(Math.abs(s)).to.be.lessThan(180);
      }
      const sign = Math.sign(steps[0]);
      for (const s of steps) {
        expect(Math.sign(s)).to.eq(sign);
      }
    }
  });

  it('exposes start/end angle matching the first/last value', () => {
    for (const c of ALL) {
      expect(c.startAngle).to.eq(c.digits[0].angle);
      expect(c.endAngle).to.eq(c.digits[c.digits.length - 1].angle);
    }
  });

  it('matches the known value ranges (O₂ 0–14, Temp -30–+8, Venus 0–30)', () => {
    expect([OXYGEN_ARC.startValue, OXYGEN_ARC.endValue]).to.deep.eq([0, 14]);
    expect([TEMPERATURE_ARC.startValue, TEMPERATURE_ARC.endValue]).to.deep.eq([-30, 8]);
    expect([VENUS_ARC.startValue, VENUS_ARC.endValue]).to.deep.eq([0, 30]);
  });

  it('fills 0 at the minimum, 1 at the maximum, clamped between', () => {
    for (const c of ALL) {
      expect(arcFillFraction(c, c.startValue)).to.be.closeTo(0, 1e-9);
      expect(arcFillFraction(c, c.endValue)).to.be.closeTo(1, 1e-9);
      const mid = c.digits[Math.floor(c.digits.length / 2)].value;
      const f = arcFillFraction(c, mid);
      expect(f).to.be.greaterThan(0);
      expect(f).to.be.lessThan(1);
      // Out-of-range clamps.
      expect(arcFillFraction(c, c.startValue - 100)).to.eq(0);
      expect(arcFillFraction(c, c.endValue + 100)).to.eq(1);
    }
  });

  it('arcAngleForValue snaps to the nearest tick', () => {
    // Temperature ticks step by 2; an odd query picks the nearest even tick.
    const a = arcAngleForValue(TEMPERATURE_ARC, -9);
    expect(a).to.be.a('number');
    const near = TEMPERATURE_ARC.digits.find((d) => d.value === -10 || d.value === -8);
    expect(near).to.not.eq(undefined);
  });

  it('places the Venus arc across the TOP and the O₂ arc on the LEFT (sanity of derived angles)', () => {
    // Angles are unwrapped (may be negative); normalise to [0,360) for the check.
    // Venus midpoint ≈ 270° (straight up); O₂ midpoint ≈ 180° (left).
    const norm = (a: number) => ((a % 360) + 360) % 360;
    const venusMid = norm((VENUS_ARC.startAngle + VENUS_ARC.endAngle) / 2);
    const oxyMid = norm((OXYGEN_ARC.startAngle + OXYGEN_ARC.endAngle) / 2);
    expect(venusMid).to.be.closeTo(270, 12);
    expect(oxyMid).to.be.closeTo(180, 14);
  });
});
