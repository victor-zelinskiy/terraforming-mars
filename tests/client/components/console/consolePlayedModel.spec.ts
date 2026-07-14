import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {
  buildPlayedZones,
  buildPlayedTargets,
  flatFaceUp,
  splitPiles,
  planPlayedLayout,
  playedBaseZoom,
  pickSpatialTarget,
  EVENTS_PILE_KEY,
  MIN_PILE_CAP,
  MAX_PILE_CAP,
  PLAYED_CARD_NATURAL_W,
  PLAYED_CARD_NATURAL_H,
  NavRect,
} from '@/client/components/console/consolePlayedModel';

function card(name: CardName): CardModel {
  return {name} as CardModel;
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

  describe('splitPiles', () => {
    it('fills sequentially to the cap', () => {
      expect(splitPiles(7, 4)).to.deep.eq([{start: 0, size: 4}, {start: 4, size: 3}]);
    });

    it('is APPEND-ONLY: one more card never moves an existing pile', () => {
      const before = splitPiles(7, 4);
      const after = splitPiles(8, 4);
      // Every pre-existing pile keeps its start; only the tail grows.
      expect(after[0]).to.deep.eq(before[0]);
      expect(after[1].start).to.eq(before[1].start);
      expect(after[1].size).to.eq(before[1].size + 1);
      // Crossing the cap opens a NEW pile, leaving the rest untouched.
      const next = splitPiles(9, 4);
      expect(next.slice(0, 2)).to.deep.eq(after.slice(0, 2));
      expect(next[2]).to.deep.eq({start: 8, size: 1});
    });

    it('handles empty and single-card families', () => {
      expect(splitPiles(0, 4)).to.deep.eq([]);
      expect(splitPiles(1, 4)).to.deep.eq([{start: 0, size: 1}]);
    });
  });

  describe('planPlayedLayout', () => {
    it('derives the pile cap from the height budget, bounded', () => {
      const tight = planPlayedLayout({faceUpCount: 30, maxPileH: 10});
      expect(tight.cap).to.eq(MIN_PILE_CAP);
      const tall = planPlayedLayout({faceUpCount: 30, maxPileH: 5000});
      expect(tall.cap).to.eq(MAX_PILE_CAP);
    });

    it('the zoom ladder compacts a late-game table', () => {
      expect(playedBaseZoom(4)).to.be.greaterThan(playedBaseZoom(15));
      expect(playedBaseZoom(15)).to.be.greaterThan(playedBaseZoom(40));
      const early = planPlayedLayout({faceUpCount: 4, maxPileH: 600});
      const late = planPlayedLayout({faceUpCount: 40, maxPileH: 600});
      expect(late.zoom).to.be.lessThan(early.zoom);
      expect(late.slotW).to.be.closeTo(PLAYED_CARD_NATURAL_W * late.zoom, 1e-9);
      expect(late.cardH).to.be.closeTo(PLAYED_CARD_NATURAL_H * late.zoom, 1e-9);
    });

    it('a taller budget never yields a SHALLOWER pile (deterministic cap)', () => {
      const a = planPlayedLayout({faceUpCount: 20, maxPileH: 400});
      const b = planPlayedLayout({faceUpCount: 20, maxPileH: 700});
      expect(b.cap).to.be.at.least(a.cap);
    });

    it('the TV uiScale multiplies every px knob in lockstep', () => {
      const base = planPlayedLayout({faceUpCount: 12, maxPileH: 600});
      const tv = planPlayedLayout({faceUpCount: 12, maxPileH: 1200, uiScale: 2});
      expect(tv.zoom).to.be.closeTo(base.zoom * 2, 1e-9);
      expect(tv.slotW).to.be.closeTo(base.slotW * 2, 1e-9);
      expect(tv.peekH).to.be.closeTo(base.peekH * 2, 1e-9);
    });

    it('identical input → identical plan (stability contract)', () => {
      const a = planPlayedLayout({faceUpCount: 17, maxPileH: 555});
      const b = planPlayedLayout({faceUpCount: 17, maxPileH: 555});
      expect(a).to.deep.eq(b);
    });
  });

  describe('buildPlayedTargets', () => {
    it('face-up cards in visual order, then ONE events-pile target', () => {
      const zones = buildPlayedZones([
        card(CardName.PREDATORS),
        card(CardName.ASTEROID),
        card(CardName.THARSIS_REPUBLIC),
      ]);
      const targets = buildPlayedTargets(zones);
      expect(targets.map((t) => t.key)).to.deep.eq([CardName.THARSIS_REPUBLIC, CardName.PREDATORS, EVENTS_PILE_KEY]);
      expect(targets[targets.length - 1].kind).to.eq('events');
      expect(flatFaceUp(zones)).to.have.length(2);
    });

    it('no events → no events target; empty tableau → no targets', () => {
      const zones = buildPlayedZones([card(CardName.TREES)]);
      expect(buildPlayedTargets(zones).map((t) => t.key)).to.deep.eq([CardName.TREES]);
      expect(buildPlayedTargets(buildPlayedZones([]))).to.have.length(0);
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
