import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {
  buildPlayedZones,
  flatFaceUp,
  drawnStacks,
  splitLanes,
  planPlayedStacks,
  stackSlotOf,
  pickSpatialTarget,
  unionNavRects,
  PLAYED_CARD_NATURAL_W,
  PLAYED_CARD_NATURAL_H,
  PLAYED_STACK_ORDER,
  STACK_GAP,
  STACK_MAX_ZOOM,
  STACK_MIN_ZOOM,
  STACK_PEEK_COMFORT,
  STACK_PEEK_TIGHT,
  STACK_SPREAD_GAP,
  NavRect,
  PlayedStackKey,
  PlayedStacksPlan,
} from '@/client/components/console/consolePlayedModel';

function card(name: CardName): CardModel {
  return {name} as CardModel;
}

function counts(over: Partial<Record<PlayedStackKey, number>>): Record<PlayedStackKey, number> {
  return {corporation: 0, prelude: 0, ceo: 0, active: 0, automated: 0, events: 0, ...over};
}

describe('consolePlayedModel', () => {
  describe('buildPlayedZones', () => {
    it('groups a mixed tableau structurally and preserves play order', () => {
      const tableau = [
        card(CardName.THARSIS_REPUBLIC), // corporation
        card(CardName.ALLIED_BANK), // prelude
        card(CardName.PREDATORS), // active
        card(CardName.ASTEROID), // event
        card(CardName.TREES), // automated
        card(CardName.BIRDS), // active — played later than Predators
      ];
      const zones = buildPlayedZones(tableau);
      expect(zones.corporations.map((c) => c.name)).to.deep.eq([CardName.THARSIS_REPUBLIC]);
      expect(zones.preludes.map((c) => c.name)).to.deep.eq([CardName.ALLIED_BANK]);
      expect(zones.active.map((c) => c.name)).to.deep.eq([CardName.PREDATORS, CardName.BIRDS]);
      expect(zones.automated.map((c) => c.name)).to.deep.eq([CardName.TREES]);
      expect(zones.events.map((c) => c.name)).to.deep.eq([CardName.ASTEROID]);
    });

    it('keeps a Merger second corporation in the corporation zone', () => {
      const zones = buildPlayedZones([
        card(CardName.THARSIS_REPUBLIC),
        card(CardName.CREDICOR),
      ]);
      expect(zones.corporations.map((c) => c.name)).to.deep.eq([CardName.THARSIS_REPUBLIC, CardName.CREDICOR]);
    });
  });

  describe('splitLanes / drawnStacks', () => {
    it('a zone splits into BALANCED contiguous lanes — the earlier lanes take the remainder; the newest card closes the last lane', () => {
      expect(splitLanes(15, 2)).to.deep.eq([{start: 0, count: 8}, {start: 8, count: 7}]);
      expect(splitLanes(9, 3)).to.deep.eq([{start: 0, count: 3}, {start: 3, count: 3}, {start: 6, count: 3}]);
      expect(splitLanes(1, 3), 'never more lanes than cards').to.deep.eq([{start: 0, count: 1}]);
      expect(splitLanes(0, 2)).to.deep.eq([{start: 0, count: 0}]);
    });

    it('the corporation and the events are always drawn (a prepared place when empty); a project zone only with a card', () => {
      expect(drawnStacks(counts({}))).to.deep.eq(['corporation', 'events']);
      expect(drawnStacks(counts({active: 2, ceo: 1}))).to.deep.eq(['corporation', 'ceo', 'active', 'events']);
      expect(PLAYED_STACK_ORDER).to.deep.eq(['corporation', 'prelude', 'ceo', 'active', 'automated', 'events']);
    });
  });

  describe('planPlayedStacks — the whole table on ONE page, the compactness solved', () => {
    const box = (c: Partial<Record<PlayedStackKey, number>>, over: {availW?: number, availH?: number, uiScale?: number} = {}) =>
      planPlayedStacks({availW: 1480, availH: 800, counts: counts(c), ...over});
    /** The content stands inside the box (one page — never an overflow). */
    const fits = (p: PlayedStacksPlan, w: number, h: number) => {
      const right = Math.max(...p.stacks.map((st) => st.x + st.w));
      expect(right, 'the stacks end inside the box').to.be.at.most(w + 0.5);
      expect(Math.min(...p.stacks.map((st) => st.x)), 'and start inside it').to.be.at.least(0);
      expect(p.padTop + p.contentH, 'the tallest stack ends inside the box').to.be.at.most(h + 0.5);
    };

    it('a few cards: the largest face the WIDTH allows, one lane each — and a short stack the height holds is laid out WHOLE', () => {
      const p = box({corporation: 1, prelude: 2, active: 1, automated: 2}, {availH: 900});
      expect(p.density).to.eq('comfort');
      expect(p.peek).to.be.closeTo(STACK_PEEK_COMFORT * p.zoom, 1e-9);
      expect(p.stacks.every((st) => st.lanes.length === 1)).to.eq(true);
      // Five one-lane stacks fill the width (the face is width-bound, under the cap).
      expect(p.zoom).to.be.lessThan(STACK_MAX_ZOOM);
      expect(p.contentW).to.be.closeTo(1480 - 2 * 14, 1);
      // The two preludes fit the height whole: no band baring half a picture — both cards whole, a gap between.
      const preludes = p.stacks.find((st) => st.key === 'prelude')!;
      expect(preludes.spread).to.eq(true);
      expect(preludes.peek).to.be.closeTo(p.slotH + STACK_SPREAD_GAP, 1e-9);
      expect(preludes.h).to.be.closeTo(2 * p.slotH + STACK_SPREAD_GAP, 1e-9);
      fits(p, 1480, 900);
      // A table of two stacks (the corporation alone) reads at the cap.
      expect(box({corporation: 1}).zoom).to.be.closeTo(STACK_MAX_ZOOM, 1e-9);
    });

    it('a late table stays ONE page: a long zone takes a second lane, the band tightens — never under the name', () => {
      const t50 = box({corporation: 1, prelude: 2, active: 20, automated: 20, events: 7});
      fits(t50, 1480, 800);
      expect(t50.stacks.find((st) => st.key === 'active')?.lanes.length).to.be.greaterThan(1);
      expect(t50.peek / t50.zoom).to.be.at.least(STACK_PEEK_TIGHT - 0.01);
      const t100 = box({corporation: 2, prelude: 4, ceo: 1, active: 40, automated: 40, events: 13});
      fits(t100, 1480, 800);
      expect(t100.zoom, 'more cards — a smaller face').to.be.lessThan(t50.zoom);
      expect(t100.peek / t100.zoom).to.be.at.least(STACK_PEEK_TIGHT - 0.01);
    });

    it('past every readable band the floor face takes the band the height leaves (a pile\'s edges) — still one page', () => {
      const p = planPlayedStacks({availW: 900, availH: 420, counts: counts({corporation: 1, active: 90, automated: 90, events: 20})});
      expect(p.density).to.eq('pile');
      expect(p.zoom).to.be.closeTo(STACK_MIN_ZOOM, 0.02);
      fits(p, 900, 420);
    });

    it('the events are ONE face-down pile (one card box, one lane) and a lone corporation one face', () => {
      const p = box({corporation: 1, active: 6, events: 9});
      const events = p.stacks.find((st) => st.key === 'events')!;
      expect(events.faceDown).to.eq(true);
      expect(events.lanes).to.deep.eq([{start: 0, count: 9}]);
      expect(events.h).to.be.closeTo(p.slotH, 1e-9);
      expect(events.w).to.be.closeTo(p.slotW, 1e-9);
      const corp = p.stacks.find((st) => st.key === 'corporation')!;
      expect(corp.h).to.be.closeTo(p.slotH, 1e-9);
    });

    it('a stack\'s box is its lanes: the front face and the bands above it; the face is the planner\'s for every stack', () => {
      const p = box({corporation: 1, active: 5, automated: 3});
      const active = p.stacks.find((st) => st.key === 'active')!;
      const k = Math.max(...active.lanes.map((l) => l.count));
      expect(active.h).to.be.closeTo(p.slotH + (k - 1) * active.peek, 1e-9);
      // A cascade the height cannot hold whole keeps the table's band.
      const long = box({corporation: 1, active: 14}).stacks.find((st) => st.key === 'active')!;
      expect(long.spread).to.eq(false);
      expect(active.w).to.be.closeTo(active.lanes.length * p.slotW + (active.lanes.length - 1) * p.laneGap, 1e-9);
      expect(p.slotW).to.be.closeTo(PLAYED_CARD_NATURAL_W * p.zoom, 1e-9);
      expect(p.slotH).to.be.closeTo(PLAYED_CARD_NATURAL_H * p.zoom, 1e-9);
    });

    it('the NEWEST card of a zone is the FRONT of its last lane — the landing\'s target is always a whole face', () => {
      const p = box({corporation: 1, active: 20, automated: 20});
      const active = p.stacks.find((st) => st.key === 'active')!;
      const last = active.lanes[active.lanes.length - 1];
      expect(stackSlotOf(p, 'active', 19)).to.deep.eq({lane: active.lanes.length - 1, depth: last.count - 1});
      expect(stackSlotOf(p, 'active', 0)).to.deep.eq({lane: 0, depth: 0});
      expect(stackSlotOf(p, 'ceo', 0)).to.eq(undefined);
    });

    it('an identity-only table keeps its stacks at the left edge — the room right of them is the projects\' place', () => {
      const p = box({corporation: 1});
      expect(p.stacks.map((st) => st.key)).to.deep.eq(['corporation', 'events']);
      expect(p.stacks[0].x).to.be.closeTo(14, 1e-9);
      expect(p.gap).to.be.closeTo(STACK_GAP, 1e-9);
    });

    it('the TV uiScale multiplies every px knob in lockstep — the same composition', () => {
      const c = {corporation: 1, prelude: 2, active: 14, automated: 6, events: 3};
      const base = box(c);
      const tv = box(c, {availW: 2960, availH: 1600, uiScale: 2});
      expect(tv.zoom).to.be.closeTo(base.zoom * 2, 1e-6);
      expect(tv.peek).to.be.closeTo(base.peek * 2, 1e-6);
      expect(tv.captionH).to.be.closeTo(base.captionH * 2, 1e-9);
      expect(tv.stacks.map((st) => st.lanes.length)).to.deep.eq(base.stacks.map((st) => st.lanes.length));
    });

    it('identical input → identical plan (stability contract)', () => {
      const c = {corporation: 1, prelude: 2, active: 9, automated: 3, events: 2};
      expect(box(c)).to.deep.eq(box(c));
    });
  });

  describe('flatFaceUp', () => {
    it('every face-up card in visual order (identity first); events excluded', () => {
      const zones = buildPlayedZones([
        card(CardName.PREDATORS),
        card(CardName.ASTEROID),
        card(CardName.THARSIS_REPUBLIC),
      ]);
      expect(flatFaceUp(zones).map((c) => c.name)).to.deep.eq([CardName.THARSIS_REPUBLIC, CardName.PREDATORS]);
      expect(flatFaceUp(buildPlayedZones([]))).to.have.length(0);
    });
  });

  describe('unionNavRects', () => {
    it('one rect per key — the union of its parts; other keys stay apart', () => {
      const out = unionNavRects([
        {key: 'active', x: 0, y: 0, w: 100, h: 50},
        {key: 'active', x: 0, y: 60, w: 40, h: 50},
        {key: 'automated', x: 50, y: 60, w: 50, h: 50},
      ]);
      expect(out).to.deep.eq([
        {key: 'active', x: 0, y: 0, w: 100, h: 110},
        {key: 'automated', x: 50, y: 60, w: 50, h: 50},
      ]);
    });
  });

  describe('pickSpatialTarget', () => {
    const r = (key: string, x: number, y: number): NavRect => ({key, x, y, w: 80, h: 40});
    const grid = [r('a', 0, 0), r('b', 100, 0), r('c', 0, 100), r('d', 100, 100)];

    it('moves to the geometric neighbour in the pressed direction', () => {
      expect(pickSpatialTarget('a', grid, 'right')).to.eq('b');
      expect(pickSpatialTarget('a', grid, 'down')).to.eq('c');
      expect(pickSpatialTarget('d', grid, 'left')).to.eq('c');
      expect(pickSpatialTarget('d', grid, 'up')).to.eq('b');
    });

    it('the edge is felt — no wrap', () => {
      expect(pickSpatialTarget('a', grid, 'left')).to.be.undefined;
      expect(pickSpatialTarget('a', grid, 'up')).to.be.undefined;
      expect(pickSpatialTarget('d', grid, 'right')).to.be.undefined;
    });

    it('prefers the visually ALIGNED neighbour over a nearer diagonal one', () => {
      const rects = [r('from', 0, 0), r('aligned', 220, 4), r('diag', 120, 130)];
      expect(pickSpatialTarget('from', rects, 'right')).to.eq('aligned');
    });

    it('a vanished focus key falls back to the first target', () => {
      expect(pickSpatialTarget('gone', grid, 'down')).to.eq('a');
    });

    it('deterministic tie-break: the first candidate in DOM order wins', () => {
      const rects = [r('from', 0, 0), r('t1', 100, 50), r('t2', 100, -50)];
      expect(pickSpatialTarget('from', rects, 'right')).to.eq('t1');
    });
  });
});
