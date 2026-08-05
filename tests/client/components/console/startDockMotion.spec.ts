import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  captureCards, cardRectOf, convoyBeats, liveFlightProxies, measureTargets,
  registerStartDockLayer, resetStartDockMotion, staggerFor,
} from '@/client/console/startDockMotion';
import {FACE_DOWN_DEG} from '@/client/console/cardFlight/card3dInner';

/**
 * THE CARD FLIGHT CORE of the Game Start Workspace.
 *
 * The regression this file exists for: a convoy used to clear the WHOLE proxy
 * layer when it finished, so in a combined transition (the bought projects
 * gliding grid → summary WHILE the earlier piles opened into theirs) the
 * SHORTER convoy wiped the longer one's still-airborne cards — their
 * timelines kept running and kept revealing destinations, so the tail of the
 * set appeared to teleport into the summary one card at a time, and it got
 * worse the more projects were bought. Ownership is per batch now.
 *
 * jsdom has no layout engine, so every rect here is stubbed; what is under
 * test is OWNERSHIP and SEQUENCING, not pixels (those are verified by hand).
 */
describe('startDockMotion — flight ownership and handoff', () => {
  let layer: HTMLElement;

  const rect = (el: HTMLElement, x: number, y: number, w = 200, h = 288): HTMLElement => {
    el.getBoundingClientRect = () => ({
      left: x, top: y, right: x + w, bottom: y + h, width: w, height: h, x, y,
      toJSON: () => ({}),
    }) as DOMRect;
    return el;
  };

  const slot = (x: number, y: number): HTMLElement => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    return rect(el, x, y);
  };

  const sources = (n: number, x = 0) => Array.from({length: n}, (_v, i) => ({
    name: `card-${x}-${i}` as CardName,
    el: slot(x + i * 4, 100 + i * 3),
  }));

  beforeEach(() => {
    document.body.innerHTML = '';
    layer = document.createElement('div');
    document.body.appendChild(layer);
    registerStartDockLayer(layer);
  });

  afterEach(() => {
    resetStartDockMotion();
    registerStartDockLayer(undefined);
    document.body.innerHTML = '';
  });

  it('captures EVERY measurable source as a real 3D body', () => {
    const capture = captureCards(sources(5));
    expect(capture.names.length).to.eq(5);
    expect(capture.uncaptured.length).to.eq(0);
    const proxies = liveFlightProxies();
    expect(proxies.length).to.eq(5);
    for (const p of proxies) {
      expect(p.querySelector('.con-card3d__face'), 'face').to.not.eq(null);
      expect(p.querySelector('.con-card3d__back'), 'back').to.not.eq(null);
      expect(p.querySelector('.con-card3d__edge'), 'edge').to.not.eq(null);
      expect(p.classList.contains('con-card3d-outer'), 'perspective owner').to.eq(true);
    }
    capture.dispose();
  });

  it('reports an unmeasurable source instead of pretending it flew', () => {
    const bad = document.createElement('div'); // no rect → 0×0 in jsdom
    document.body.appendChild(bad);
    const capture = captureCards([
      ...sources(2),
      {name: 'ghost' as CardName, el: bad},
    ]);
    expect(capture.names.length).to.eq(2);
    expect(capture.uncaptured).to.deep.eq(['ghost']);
    capture.dispose();
  });

  /** ⚠️ THE REGRESSION. Two convoys share the layer; the short one must not
   *  take the long one's cards with it when it finishes. */
  it('one convoy finishing does NOT destroy another convoy still in the air', async () => {
    const target = slot(900, 600);
    const short = captureCards(sources(1, 0));
    const long = captureCards(sources(12, 400));

    let proxiesWhenShortEnded = -1;
    const landedLong: Array<CardName> = [];
    let liveAtEveryLongLanding = true;

    const shortFlight = short.flyTo(() => target, undefined, {flipTo: FACE_DOWN_DEG}).then(() => {
      proxiesWhenShortEnded = liveFlightProxies().length;
    });
    const longFlight = long.flyTo(() => target, (n) => {
      landedLong.push(n);
      // A landing card must still HAVE a body at the moment it lands.
      if (liveFlightProxies().length === 0) {
        liveAtEveryLongLanding = false;
      }
    });

    await Promise.all([shortFlight, longFlight]);

    // The short convoy ended first and left the long one's bodies alone.
    expect(proxiesWhenShortEnded, 'survivors when the short convoy ended')
      .to.be.greaterThan(0);
    expect(liveAtEveryLongLanding, 'every long-convoy landing had a body').to.eq(true);
    // EVERY card of the long convoy landed — none was dropped, none doubled.
    expect(landedLong.length).to.eq(12);
    expect(new Set(landedLong).size).to.eq(12);
    // Both batches cleaned up after themselves.
    expect(liveFlightProxies().length).to.eq(0);
    // A real flight takes real seconds; mocha's 2 s default would flake.
  }).timeout(30_000);

  /**
   * THE HANDOFF: the destination is revealed FIRST and the proxy is retired
   * only afterwards. There must never be a frame with no card at all (reveal
   * after hide), and the reveal must not happen mid-carry (which would be the
   * two-visible-copies artefact).
   */
  it('reveals the destination while the proxy still stands, never before landing', async () => {
    const target = slot(700, 500);
    const capture = captureCards(sources(3));
    const started = Date.now();
    const observations: Array<{visible: boolean, elapsed: number}> = [];
    await capture.flyTo(() => target, () => {
      // At reveal time the flyer layer still owns at least one visible body:
      // the destination and the proxy overlap, they are never both absent.
      const visible = liveFlightProxies().some((p) => p.style.visibility !== 'hidden');
      observations.push({visible, elapsed: Date.now() - started});
    });
    expect(observations.length).to.eq(3);
    for (const o of observations) {
      expect(o.visible, 'a body is on screen at the handoff frame').to.eq(true);
      // …and nothing was revealed at t≈0: every card genuinely travelled.
      expect(o.elapsed, 'the card actually flew').to.be.greaterThan(120);
    }
    capture.dispose();
  }).timeout(30_000);

  it('carries a LARGE set whole — no cap, no per-card bail-out', async () => {
    const target = slot(800, 400);
    const capture = captureCards(sources(20));
    expect(capture.names.length).to.eq(20);
    const landed: Array<CardName> = [];
    await capture.flyTo(() => target, (n) => landed.push(n));
    expect(landed.length).to.eq(20);
    expect(new Set(landed).size).to.eq(20);
    expect(liveFlightProxies().length).to.eq(0);
  }).timeout(60_000);

  it('a disposed capture never leaves a body behind', () => {
    const capture = captureCards(sources(4));
    expect(liveFlightProxies().length).to.eq(4);
    capture.dispose();
    expect(liveFlightProxies().length).to.eq(0);
    capture.dispose(); // idempotent
    expect(liveFlightProxies().length).to.eq(0);
  });

  describe('measureTargets — destinations are measured, never assumed', () => {
    it('resolves what exists and NAMES what does not', async () => {
      const a = slot(10, 10);
      const missingEl = document.createElement('div');
      document.body.appendChild(missingEl);
      const here = 'here' as unknown as CardName;
      const gone = 'gone' as unknown as CardName;
      const {rects, missing} = await measureTargets(
        [here, gone],
        (n) => (n === here ? a : missingEl),
        2);
      expect(rects.get(here)?.w).to.eq(200);
      expect(missing).to.deep.eq([gone]);
    });

    it('a tile that appears a few frames late is still measured', async () => {
      const late = document.createElement('div');
      document.body.appendChild(late);
      let frames = 0;
      late.getBoundingClientRect = () => {
        frames++;
        return (frames > 2 ?
          {left: 5, top: 6, right: 205, bottom: 294, width: 200, height: 288, x: 5, y: 6} :
          {left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0}) as DOMRect;
      };
      const lateName = 'late' as unknown as CardName;
      const {rects, missing} = await measureTargets([lateName], () => late, 20);
      expect(missing.length).to.eq(0);
      expect(rects.get(lateName)?.x).to.eq(5);
    });
  });

  it('cardRectOf measures the CARD inside a slot, not the slot box', () => {
    const host = slot(0, 0);
    const card = document.createElement('div');
    card.className = 'pcard';
    host.appendChild(card);
    rect(card, 12, 14, 100, 144);
    expect(cardRectOf(host)).to.deep.eq({x: 12, y: 14, w: 100, h: 144});
    expect(cardRectOf(null)).to.eq(undefined);
  });

  /** Adaptive, never truncating — the convoy spreads out but nothing drops. */
  it('the convoy stagger compresses with the batch and never hits zero', () => {
    expect(staggerFor(2)).to.be.greaterThan(staggerFor(20));
    for (const n of [2, 5, 10, 15, 20, 40]) {
      expect(staggerFor(n), `n=${n}`).to.be.greaterThan(0);
    }
    // The published beats grow with the count (a host timing against them
    // must never be told a 20-card convoy lands as fast as a 2-card one).
    expect(convoyBeats(20).landed).to.be.greaterThan(convoyBeats(2).landed);
  });
});
