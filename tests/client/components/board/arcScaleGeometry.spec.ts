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
  placeArcMarker,
  spreadValues,
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

describe('placeArcMarker', () => {
  const center = {x: 300, y: 301};
  const bandRadius = 267;
  const bandWidth = 22;
  const base = {center, bandRadius, bandWidth, gap: 2, pointer: 8, size: 18};

  function dist(a: {x: number; y: number}, b: {x: number; y: number}): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  it('lands the connector tip EXACTLY on the band edge facing the chip (inside)', () => {
    const p = placeArcMarker({...base, thresholdAngle: -60, side: 'inside'});
    // The rail edge the connector touches is the INNER band edge.
    expect(dist(p.railEdgePoint, center)).to.be.closeTo(bandRadius - bandWidth / 2, 0.02);
    // pointerEnd IS the rail edge — the pointer physically reaches the rail.
    expect(p.pointerEnd.x).to.eq(p.railEdgePoint.x);
    expect(p.pointerEnd.y).to.eq(p.railEdgePoint.y);
  });

  it('lands the connector tip on the OUTER band edge for an outside chip', () => {
    const p = placeArcMarker({...base, thresholdAngle: 130, side: 'outside'});
    expect(dist(p.railEdgePoint, center)).to.be.closeTo(bandRadius + bandWidth / 2, 0.02);
  });

  it('puts the chip beyond the band edge (inside = smaller radius, toward the planet)', () => {
    const inside = placeArcMarker({...base, thresholdAngle: -60, side: 'inside'});
    const outside = placeArcMarker({...base, thresholdAngle: -60, side: 'outside'});
    expect(dist(inside.chipCenter, center)).to.be.lessThan(bandRadius - bandWidth / 2);
    expect(dist(outside.chipCenter, center)).to.be.greaterThan(bandRadius + bandWidth / 2);
  });

  it('keeps the connector touching the TRUE threshold rail point even when fanned along the arc', () => {
    const thresholdAngle = -60;
    const radial = placeArcMarker({...base, thresholdAngle, side: 'inside'});
    const fanned = placeArcMarker({...base, thresholdAngle, chipAngle: thresholdAngle + 6, side: 'inside'});
    // The rail anchor must NOT move — the connector still points at the value.
    expect(fanned.railEdgePoint.x).to.be.closeTo(radial.railEdgePoint.x, 0.02);
    expect(fanned.railEdgePoint.y).to.be.closeTo(radial.railEdgePoint.y, 0.02);
    // The chip itself moved (fanned out), and the connector lengthened to reach.
    expect(dist(fanned.chipCenter, radial.chipCenter)).to.be.greaterThan(5);
    expect(fanned.pointerLen).to.be.greaterThan(radial.pointerLen);
  });

  it('reports an axis-aligned chip bounds matching the size', () => {
    const p = placeArcMarker({...base, thresholdAngle: 90, side: 'inside'});
    expect(p.collisionBounds.w).to.eq(18);
    expect(p.collisionBounds.h).to.eq(18);
    expect(p.collisionBounds.x).to.be.closeTo(p.chipCenter.x - 9, 1e-6);
  });
});

describe('spreadValues (fan-out relaxation)', () => {
  it('leaves an already-spaced row untouched', () => {
    expect(spreadValues([0, 10, 20], 5)).to.deep.eq([0, 10, 20]);
  });

  it('pushes a cramped row apart to the minimum gap, centred on the original midpoint', () => {
    const out = spreadValues([0, 1, 2], 4);
    // Consecutive gaps are now >= 4.
    expect(out[1] - out[0]).to.be.closeTo(4, 1e-9);
    expect(out[2] - out[1]).to.be.closeTo(4, 1e-9);
    // Midpoint preserved (original mid = 1).
    expect((out[0] + out[2]) / 2).to.be.closeTo(1, 1e-9);
  });

  it('returns positions in the ORIGINAL input order (not sorted)', () => {
    const out = spreadValues([2, 0, 1], 4);
    expect(out.length).to.eq(3);
    // Input[0]=2 was the largest → should be the largest output.
    expect(out[0]).to.be.greaterThan(out[2]);
    expect(out[2]).to.be.greaterThan(out[1]);
  });

  it('handles 0 / 1 element gracefully', () => {
    expect(spreadValues([], 4)).to.deep.eq([]);
    expect(spreadValues([7], 4)).to.deep.eq([7]);
  });
});
