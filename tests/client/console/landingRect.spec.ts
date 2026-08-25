/*
 * The pure math of the landing-geometry primitive (cardFlight/landingRect):
 * un-mapping a measured rect through live transient transforms into the rect
 * the element will occupy AT REST. The DOM half (getAnimations discovery) is
 * exercised by the e2e flight probes; THIS spec pins the algebra those
 * flights aim with — a wrong sign here is a 2×-the-entry-offset teleport at
 * the handoff, which no unit below the math would catch.
 */
import {expect} from 'chai';
import {unmapPoint, unmapRectThrough, LandingRect, TransformLink} from '@/client/console/cardFlight/landingRect';

const IDENTITY = {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0};

function link(partial: {
  cur?: Partial<TransformLink['cur']>,
  end?: TransformLink['end'],
  origin?: {x: number, y: number},
}): TransformLink {
  return {
    cur: {...IDENTITY, ...partial.cur},
    end: partial.end,
    origin: partial.origin ?? {x: 0, y: 0},
  };
}

describe('landingRect (pure math)', () => {
  it('subtracts a pure translation exactly (the entry-translate case)', () => {
    // A slot measured 14px below its rest (con-start-deal translateY mid-run).
    const measured: LandingRect = {left: 100, top: 214, width: 320, height: 460};
    const rest = unmapRectThrough(measured, [link({cur: {e: 0, f: 14}})]);
    expect(rest).to.deep.equal({left: 100, top: 200, width: 320, height: 460});
  });

  it('is exact for translation regardless of the origin', () => {
    const measured: LandingRect = {left: 50, top: 50, width: 10, height: 10};
    const a = unmapRectThrough(measured, [link({cur: {e: 7, f: -3}, origin: {x: 0, y: 0}})]);
    const b = unmapRectThrough(measured, [link({cur: {e: 7, f: -3}, origin: {x: 500, y: 900}})]);
    expect(a).to.deep.equal(b);
    expect(a.left).to.equal(43);
    expect(a.top).to.equal(53);
  });

  it('un-maps a centre-origin scale entry to its identity rest (trayin 0.93 shape)', () => {
    // An element whose UNTRANSFORMED box is 200×100 at (400, 300), currently
    // mid-entry at scale 0.93 about its centre (500, 350), translate 0, +10y.
    const s = 0.93;
    const cx = 500;
    const cy = 350 + 10; // the transformed centre carries the translate
    const measured: LandingRect = {
      left: cx - 100 * s, top: cy - 50 * s, width: 200 * s, height: 100 * s,
    };
    const rest = unmapRectThrough(measured, [
      link({cur: {a: s, d: s, e: 0, f: 10}, origin: {x: 500, y: 350}}),
    ]);
    expect(rest.left).to.be.closeTo(400, 1e-9);
    expect(rest.top).to.be.closeTo(300, 1e-9);
    expect(rest.width).to.be.closeTo(200, 1e-9);
    expect(rest.height).to.be.closeTo(100, 1e-9);
  });

  it('maps a mid-transition measure onto the transition DESTINATION (album page turn)', () => {
    // A strip mid-glide at translateX(-300), destination translateX(-960):
    // a slot measured now must aim at where the page will BERTH.
    const measured: LandingRect = {left: 700, top: 400, width: 320, height: 460};
    const rest = unmapRectThrough(measured, [
      link({cur: {e: -300, f: 0}, end: {...IDENTITY, e: -960, f: 0}}),
    ]);
    expect(rest.left).to.equal(700 - (-300) + (-960)); // = 40
    expect(rest.top).to.equal(400);
  });

  it('a finished both-filled entry (cur == end) is a no-op by construction', () => {
    const measured: LandingRect = {left: 120, top: 80, width: 50, height: 50};
    const end = {...IDENTITY};
    const rest = unmapRectThrough(measured, [link({cur: {...end}, end})]);
    expect(rest).to.deep.equal(measured);
  });

  it('composes a chain outermost-last (self entry inside an entering zone)', () => {
    const measured: LandingRect = {left: 0, top: 30, width: 10, height: 10};
    const rest = unmapRectThrough(measured, [
      link({cur: {e: 0, f: 9}}), // the slot's own descend cascade (y: 9)
      link({cur: {e: 0, f: 21}}), // the zone's entry translate under it
    ]);
    expect(rest.top).to.equal(0);
  });

  it('unmapPoint round-trips through a translate+scale link', () => {
    const l = link({cur: {a: 0.992, d: 0.992, e: 4, f: 9}, origin: {x: 960, y: 540}});
    const p = unmapPoint({x: 700, y: 400}, l);
    // Re-apply the current transform manually: q = O + M·(p−O) + t
    const back = {
      x: 960 + 0.992 * (p.x - 960) + 4,
      y: 540 + 0.992 * (p.y - 540) + 9,
    };
    expect(back.x).to.be.closeTo(700, 1e-9);
    expect(back.y).to.be.closeTo(400, 1e-9);
  });

  it('un-maps a TILTED pose ride to its tilted rest (the dock pack case)', () => {
    // A dock back mid pose-ride: compact = tilt 6° + scale 0.7 about the
    // centre + a sink translate; rest = the SAME tilt at scale 1, no sink.
    // (The compact→full flip is one transform transition per card, so cur
    // and end BOTH carry the tilt — the translate-scale-only gate used to
    // skip every such card and the landing stayed in the miniature pose.)
    const rad = (d: number) => (d * Math.PI) / 180;
    const rot = (deg: number, s: number) => ({
      a: s * Math.cos(rad(deg)), b: s * Math.sin(rad(deg)),
      c: -s * Math.sin(rad(deg)), d: s * Math.cos(rad(deg)),
    });
    const origin = {x: 500, y: 800};
    const cur = {...rot(6, 0.7), e: 0, f: 12};
    const end = {...rot(6, 1), e: 0, f: 0};
    // An untransformed 63×88 back centred on the origin, mapped by CUR:
    const w = 63;
    const h = 88;
    const corners = [
      {x: -w / 2, y: -h / 2}, {x: w / 2, y: -h / 2},
      {x: -w / 2, y: h / 2}, {x: w / 2, y: h / 2},
    ].map((p) => ({
      x: origin.x + cur.a * p.x + cur.c * p.y + cur.e,
      y: origin.y + cur.b * p.x + cur.d * p.y + cur.f,
    }));
    const xs = corners.map((p) => p.x);
    const ys = corners.map((p) => p.y);
    const measured: LandingRect = {
      left: Math.min(...xs), top: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
    };
    const rest = unmapRectThrough(measured, [{cur, end, origin}]);
    // Expected: the same corners under END (tilt kept, scale 1, no sink).
    const endCorners = [
      {x: -w / 2, y: -h / 2}, {x: w / 2, y: -h / 2},
      {x: -w / 2, y: h / 2}, {x: w / 2, y: h / 2},
    ].map((p) => ({
      x: origin.x + end.a * p.x + end.c * p.y + end.e,
      y: origin.y + end.b * p.x + end.d * p.y + end.f,
    }));
    const exs = endCorners.map((p) => p.x);
    const eys = endCorners.map((p) => p.y);
    expect(rest.left).to.be.closeTo(Math.min(...exs), 1e-6);
    expect(rest.top).to.be.closeTo(Math.min(...eys), 1e-6);
    expect(rest.width).to.be.closeTo(Math.max(...exs) - Math.min(...exs), 1e-6);
    expect(rest.height).to.be.closeTo(Math.max(...eys) - Math.min(...eys), 1e-6);
  });
});
