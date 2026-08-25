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

const IDENTITY = {a: 1, d: 1, e: 0, f: 0};

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
    const end = {a: 1, d: 1, e: 0, f: 0};
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
});
