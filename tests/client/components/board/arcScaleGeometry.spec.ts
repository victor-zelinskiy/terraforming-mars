import {expect} from 'chai';
import {
  ArcScaleConfig,
  angleForValue,
  pointForValue,
  pointAtAngle,
  normalForValue,
  tangentForValue,
  pointerRotationForValue,
  arcPath,
  segments,
  tick,
  markerChip,
} from '@/client/components/board/arcScaleGeometry';

// The ocean arc the component ships with: concentric with the board scales,
// 9 values across the bottom window, value 1 down-left → value 9 down-right
// (so endAngle < startAngle — a descending-angle arc).
const CFG: ArcScaleConfig = {
  center: {x: 300, y: 301},
  radius: 264,
  startAngle: 116,
  endAngle: 64,
  startValue: 1,
  endValue: 9,
};

function dist(a: {x: number; y: number}, b: {x: number; y: number}): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('arcScaleGeometry', () => {
  it('interpolates angle linearly between the endpoints', () => {
    expect(angleForValue(CFG, 1)).to.eq(116);
    expect(angleForValue(CFG, 9)).to.eq(64);
    // Value 5 is the midpoint of 1..9 → bottom centre (90°).
    expect(angleForValue(CFG, 5)).to.eq(90);
  });

  it('places every value exactly on the circle (radius from centre == config radius)', () => {
    for (let v = 1; v <= 9; v++) {
      const p = pointForValue(CFG, v);
      expect(dist(p, CFG.center)).to.be.closeTo(264, 1e-6);
    }
  });

  it('puts value 5 at the bottom centre of the planet', () => {
    const p = pointForValue(CFG, 5);
    expect(p.x).to.be.closeTo(300, 1e-6); // directly below centre
    expect(p.y).to.be.closeTo(301 + 264, 1e-6);
  });

  it('keeps the ocean values clear of the neighbouring O₂-0 and Temp-30 digits', () => {
    // Digit centres from globs.less (@oxygen-vals / @temperature-vals).
    const oxygen0 = {x: 138, y: 513};
    const temp30 = {x: 451, y: 521};
    expect(dist(pointForValue(CFG, 1), oxygen0)).to.be.greaterThan(30);
    expect(dist(pointForValue(CFG, 9), temp30)).to.be.greaterThan(30);
  });

  it('returns a unit outward normal pointing away from the centre', () => {
    const n = normalForValue(CFG, 5);
    expect(Math.hypot(n.x, n.y)).to.be.closeTo(1, 1e-9);
    // At the bottom the outward normal points straight down (+y).
    expect(n.x).to.be.closeTo(0, 1e-6);
    expect(n.y).to.be.closeTo(1, 1e-6);
  });

  it('returns a unit tangent orthogonal to the normal', () => {
    const n = normalForValue(CFG, 3);
    const t = tangentForValue(CFG, 3);
    expect(Math.hypot(t.x, t.y)).to.be.closeTo(1, 1e-9);
    expect(n.x * t.x + n.y * t.y).to.be.closeTo(0, 1e-9); // perpendicular
  });

  it('aims an OUTER chip pointer straight up (toward the planet) at the bottom centre', () => {
    // An up-triangle rotated by this many degrees must point inward (-y) at v=5.
    // rotation 180° turns "up" into "down"; we want it to point UP toward the
    // band, so the rotation at the bottom centre is 0 for an outer chip.
    expect(pointerRotationForValue(CFG, 5, 'outer')).to.eq(0);
    // An inner chip at the bottom points outward (down) → 180°.
    expect(Math.abs(pointerRotationForValue(CFG, 5, 'inner'))).to.eq(180);
  });

  it('produces an arc path whose endpoints sit on the circle', () => {
    const d = arcPath(CFG.center, CFG.radius, 116, 64);
    // M x1 y1 A r r 0 large sweep x2 y2
    const nums = d.match(/-?\d*\.?\d+/g)!.map(Number);
    const start = {x: nums[0], y: nums[1]};
    const sweep = nums[6];
    const end = {x: nums[7], y: nums[8]};
    expect(dist(start, CFG.center)).to.be.closeTo(264, 0.5);
    expect(dist(end, CFG.center)).to.be.closeTo(264, 0.5);
    // Descending angle (116 → 64) draws the minor arc counter-clockwise → sweep 0.
    expect(sweep).to.eq(0);
  });

  it('makes one segment per value, each centred on its value', () => {
    const segs = segments(CFG);
    expect(segs.length).to.eq(9);
    expect(segs[0].value).to.eq(1);
    expect(segs[8].value).to.eq(9);
    for (const s of segs) {
      expect(dist(s.mid, pointForValue(CFG, s.value))).to.be.closeTo(0, 1e-6);
    }
  });

  it('draws a radial tick from the inner to the outer radius at a value', () => {
    const t = tick(CFG, 5, 256, 272);
    expect(dist({x: t.x1, y: t.y1}, CFG.center)).to.be.closeTo(256, 0.5);
    expect(dist({x: t.x2, y: t.y2}, CFG.center)).to.be.closeTo(272, 0.5);
    expect(t.x1).to.be.closeTo(300, 0.5); // straight down at the bottom centre
    expect(t.x2).to.be.closeTo(300, 0.5);
  });

  it('places an INSIDE marker chip toward the planet (above the bottom arc), pointer aiming at the band', () => {
    const opts = {bandInner: 255, bandOuter: 273, gap: 4, pointer: 7, size: 18};
    const inside = markerChip(CFG, 6, 'inside', opts);
    const outside = markerChip(CFG, 6, 'outside', opts);
    // Inside chip sits at a SMALLER radius than the band (closer to centre),
    // outside chip at a LARGER radius (further from centre).
    expect(dist(inside, CFG.center)).to.be.lessThan(255);
    expect(dist(outside, CFG.center)).to.be.greaterThan(273);
    // And the inside chip is therefore ABOVE the outside chip on the bottom arc.
    expect(inside.y).to.be.lessThan(outside.y);
    // Pointer push distance is symmetric (depends only on size/gap/pointer).
    expect(inside.pointerDist).to.eq(outside.pointerDist);
  });

  it('rotates an INSIDE bottom-arc chip pointer to aim back DOWN at the band', () => {
    const opts = {bandInner: 255, bandOuter: 273, gap: 4, pointer: 7, size: 18};
    // At the bottom centre an inside chip (above the band) must point its
    // triangle downward (180°) at the band; an outside chip points up (0°).
    expect(Math.abs(markerChip(CFG, 5, 'inside', opts).point)).to.eq(180);
    expect(markerChip(CFG, 5, 'outside', opts).point).to.eq(0);
  });

  it('pointAtAngle matches the cos/sin definition', () => {
    const p = pointAtAngle({x: 0, y: 0}, 10, 0);
    expect(p.x).to.be.closeTo(10, 1e-9);
    expect(p.y).to.be.closeTo(0, 1e-9);
    const p2 = pointAtAngle({x: 0, y: 0}, 10, 90);
    expect(p2.x).to.be.closeTo(0, 1e-9);
    expect(p2.y).to.be.closeTo(10, 1e-9);
  });
});
