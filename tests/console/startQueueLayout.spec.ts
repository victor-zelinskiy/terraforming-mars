import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {
  QUEUE_FX_EDGE_REM, QUEUE_FX_GAP_REM, QUEUE_MAX_ZOOM, QUEUE_MIN_ZOOM, startQueueFxLane, startQueueLayout, startQueueReading,
} from '../../src/client/console/startQueueLayout';
import {seedInside} from '../../src/client/console/consoleForecastFocusMotion';
import {preludeRisk} from '../../src/client/console/startPreludeRisk';

/**
 * TRP0 · DE — «РАЗВЁРТЫВАНИЕ ПРОЛОГОВ — ОДНИМ ВЗГЛЯДОМ»: the queue card's size solved from the box (the album's law —
 * a row capacity, never the cards of the moment) and the one reading line under every card (a verdict, never a fact of
 * the face).
 */
describe('startQueueLayout — the queue card sized from the box', () => {
  // The tv4k queue: ~3300 × 1075 px at 40 px per rem, uiScale 2.
  const TV = {width: 3300, height: 1075, othersWidth: 0, others: 0};

  it('fills the column on a TV: the card takes over half of the queue\'s height', () => {
    const plan = startQueueLayout(TV, 2, 40, 2);
    expect(plan.rows).eq(1);
    expect(plan.cardH / TV.height).to.be.above(0.55);
    // …and the room under it (the pill, the reading line) is never eaten.
    expect(plan.cardH + 4.2 * 40).to.be.at.most(TV.height);
  });

  it('one to four cards share ONE geometry — a card that leaves never makes the rest grow', () => {
    const sizes = [1, 2, 3, 4].map((n) => startQueueLayout(TV, n, 40, 2).zoom);
    expect(new Set(sizes).size).eq(1);
  });

  it('five and more take a second row, smaller', () => {
    const one = startQueueLayout(TV, 4, 40, 2);
    const two = startQueueLayout(TV, 5, 40, 2);
    expect(two.rows).eq(2);
    expect(two.zoom).to.be.below(one.zoom);
  });

  it('the row\'s other blocks (the bought projects) take their measured width first', () => {
    const narrow = {width: 1600, height: 1075, othersWidth: 0, others: 0};
    const alone = startQueueLayout(narrow, 3, 40, 2);
    const withBuy = startQueueLayout({...narrow, othersWidth: 700, others: 1}, 3, 40, 2);
    expect(withBuy.zoom).to.be.below(alone.zoom);
  });

  it('clamped: never past the natural frame × uiScale, never under the old short-viewport notch', () => {
    expect(startQueueLayout({width: 20000, height: 20000, othersWidth: 0, others: 0}, 1, 20, 1).zoom).eq(QUEUE_MAX_ZOOM);
    expect(startQueueLayout({width: 200, height: 120, othersWidth: 0, others: 0}, 1, 20, 1).zoom).eq(QUEUE_MIN_ZOOM);
    expect(startQueueLayout({width: 20000, height: 20000, othersWidth: 0, others: 0}, 1, 40, 2).zoom).eq(QUEUE_MAX_ZOOM * 2);
  });
});

describe('startQueueReading — the line under every queue card', () => {
  const name = (n: CardName) => `«${n}»`;

  it('a playable card reads «Можно разыграть»; a candidate and a card not yet pressable read nothing', () => {
    expect(startQueueReading({kind: 'prelude', playable: true, risk: undefined}, name)).deep.include({verdict: 'playable', text: 'Playable now', tone: 'ok'});
    expect(startQueueReading({kind: 'corp', playable: true, risk: undefined}, name).verdict).eq('playable');
    expect(startQueueReading({kind: 'candidate', playable: true, risk: undefined}, name)).deep.include({verdict: 'none', text: undefined});
    expect(startQueueReading({kind: 'prelude', playable: false, risk: undefined}, name)).deep.include({verdict: 'none', text: undefined});
  });

  it('a prelude waiting on ONE other names it; on several, names what it lacks', () => {
    const one = preludeRisk({state: 'deferred', certainty: 'guaranteed', enablers: [CardName.MOHOLE]} as never, (n) => n);
    expect(startQueueReading({kind: 'prelude', playable: true, risk: one}, name)).deep.eq({verdict: 'waiting', text: 'First: ${0}', params: ['«Mohole»'], tone: 'wait'});
    const two = preludeRisk({state: 'deferred', certainty: 'possible', enablers: [CardName.MOHOLE, CardName.LOAN]} as never, (n) => n);
    expect(startQueueReading({kind: 'prelude', playable: true, risk: two}, name)).deep.include({verdict: 'waiting', text: two?.title, tone: 'wait'});
  });

  it('a prelude that will lose its effect names what nothing can meet — the badge on the card names the loss', () => {
    const final = preludeRisk({state: 'noEffect', need: 'playableCard'} as never, (n) => n);
    const reading = startQueueReading({kind: 'prelude', playable: true, risk: final}, name);
    expect(reading).deep.include({verdict: 'lost', tone: 'loss', text: final?.title});
    expect(reading.text).not.eq(final?.badge);
  });
});

/**
 * P79 · DI — «СРАБОТАЕТ» ON THE PRELUDES' DEPLOYMENT: the layer opens in the QUEUE's space beside the hero (the focused
 * card stands; the panel takes the wider side), and its unfold is seeded on the panel's edge right over the rail's row.
 */
describe('startQueueFxLane — the «Эффекты» lane beside the hero (P79 · DI)', () => {
  const REM = 40;
  const zone = {left: 500, top: 300, width: 3200, height: 1500};

  it("a centred hero: the panel opens on its right, the hero's box never covered", () => {
    const hero = {left: 1800, top: 400, width: 600, height: 900};
    const lane = startQueueFxLane(zone, hero, REM)!;
    expect(lane.side).eq('right');
    expect(lane.left).eq(hero.left + hero.width - zone.left + QUEUE_FX_GAP_REM * REM);
    expect(lane.right).eq(QUEUE_FX_EDGE_REM * REM);
    expect(zone.left + lane.left, 'the panel starts past the hero').greaterThan(hero.left + hero.width);
  });

  it("a hero at the row's right end: the panel takes the LEFT side (the wider room)", () => {
    const hero = {left: 3000, top: 400, width: 600, height: 900};
    const lane = startQueueFxLane(zone, hero, REM)!;
    expect(lane.side).eq('left');
    expect(lane.left).eq(QUEUE_FX_EDGE_REM * REM);
    expect(zone.left + zone.width - lane.right, 'the panel ends before the hero').lessThan(hero.left);
  });

  it('narrow when the lane cannot hold the dossier beside the list (< 50 rem); wide otherwise', () => {
    expect(startQueueFxLane(zone, {left: 1800, top: 0, width: 600, height: 900}, REM)!.narrow, '≈ 31 rem').is.true;
    expect(startQueueFxLane(zone, {left: 560, top: 0, width: 400, height: 900}, REM)!.narrow, '≈ 74 rem').is.false;
  });

  it("a zoomed zone: the insets are in the zone's own px", () => {
    const hero = {left: 1800, top: 400, width: 600, height: 900};
    const plain = startQueueFxLane(zone, hero, REM)!;
    const zoomed = startQueueFxLane(zone, hero, REM, 0.5)!;
    expect(zoomed.left).eq(Math.round((hero.left + hero.width - zone.left) * 0.5 + QUEUE_FX_GAP_REM * REM));
    expect(zoomed.left).lessThan(plain.left);
  });

  it('a zone with no width has no lane', () => {
    expect(startQueueFxLane({...zone, width: 0}, {left: 0, top: 0, width: 10, height: 10}, REM)).is.undefined;
  });
});

describe('seedInside — the unfold grows OUT of a row standing outside the panel (P79 · DI)', () => {
  const panel = {left: 1000, top: 200, width: 1200, height: 1400};

  it("a row on the rail BELOW the panel: its own size, on the panel's foot, at its own x", () => {
    const row = {left: 1800, top: 1640, width: 300, height: 60};
    expect(seedInside(row, panel)).deep.eq({left: 1800, top: 1540, width: 300, height: 60});
  });

  it("a row reaching past the panel's side: slid inside, never wider than the panel", () => {
    expect(seedInside({left: 2100, top: 1700, width: 400, height: 60}, panel)).deep.eq({left: 1800, top: 1540, width: 400, height: 60});
    expect(seedInside({left: 0, top: 1700, width: 5000, height: 60}, panel).width).eq(1200);
  });

  it('a row that meets the panel (every composer\'s): untouched', () => {
    const row = {left: 1100, top: 900, width: 300, height: 60};
    expect(seedInside(row, panel)).eq(row);
  });
});
