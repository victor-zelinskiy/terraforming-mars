import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {buildPlayedZones} from '@/client/components/console/consolePlayedModel';
import {
  playedCategories, categoryCards, planCategoryView, categoryTargetRect,
  CAT_GRID_MIN_ZOOM, CAT_GRID_MAX_ZOOM,
} from '@/client/components/console/consolePlayedCategoryModel';
import {
  playedCategoryState, resetPlayedCategoryView, categoryOutNames,
  nextCategoryFlightId, registerCategoryFlightEl, categoryFlightEl,
} from '@/client/console/played/playedCategoryView';

function card(name: CardName): CardModel {
  return {name} as CardModel;
}

const MIXED = buildPlayedZones([
  card(CardName.THARSIS_REPUBLIC), // corporation
  card(CardName.ALLIED_BANK), // prelude
  card(CardName.PREDATORS), // active
  card(CardName.TREES), // automated
  card(CardName.BIRDS), // active
  card(CardName.ASTEROID), // event
  card(CardName.BIG_ASTEROID), // event
]);

describe('consolePlayedCategoryModel', () => {
  describe('playedCategories', () => {
    it('lists only NON-EMPTY families, in the fixed table order, events face down', () => {
      const cats = playedCategories(MIXED);
      expect(cats.map((c) => c.key)).to.deep.eq(['corporation', 'prelude', 'active', 'automated', 'events']);
      expect(cats.find((c) => c.key === 'events')?.faceDown).to.be.true;
      expect(cats.find((c) => c.key === 'active')?.count).to.eq(2);
      expect(playedCategories(buildPlayedZones([]))).to.have.length(0);
    });

    it('categoryCards keeps the tableau (play) order', () => {
      expect(categoryCards(MIXED, 'active').map((c) => c.name)).to.deep.eq([CardName.PREDATORS, CardName.BIRDS]);
      expect(categoryCards(MIXED, 'events').map((c) => c.name)).to.deep.eq([CardName.ASTEROID, CardName.BIG_ASTEROID]);
      expect(categoryCards(MIXED, 'ceo')).to.have.length(0);
    });
  });

  describe('planCategoryView', () => {
    it('ONE card → the near-fullscreen single stage (height-bound)', () => {
      const layout = planCategoryView({availW: 1500, availH: 700, count: 1});
      expect(layout.kind).to.eq('single');
      if (layout.kind === 'single') {
        // Height binds: 700 * 0.94 / 460 ≈ 1.43 — far larger than a grid card.
        expect(layout.zoom).to.be.closeTo((700 * 0.94) / 460, 1e-6);
        expect(layout.slotH).to.be.lessThan(700);
      }
    });

    it('a small category grows LARGE (fill pass) — bigger than the hand ceiling', () => {
      const layout = planCategoryView({availW: 1500, availH: 640, count: 2});
      expect(layout.kind).to.eq('grid');
      if (layout.kind === 'grid') {
        expect(layout.plan.cols).to.eq(2);
        expect(layout.plan.scrolls).to.be.false;
        // The grow-to-fit pass lifts the zoom past the base ladder (0.72/0.78).
        expect(layout.plan.cardZoom).to.be.greaterThan(CAT_GRID_MAX_ZOOM);
      }
    });

    it('sizes are MONOTONE: more cards never render larger', () => {
      let prev = Infinity;
      for (const n of [2, 3, 4, 5, 6, 12, 24, 40]) {
        const layout = planCategoryView({availW: 1500, availH: 640, count: n});
        expect(layout.kind).to.eq('grid');
        if (layout.kind === 'grid') {
          expect(layout.plan.cardZoom).to.be.at.most(prev + 1e-9, `count ${n}`);
          prev = layout.plan.cardZoom;
        }
      }
    });

    it('a LONG-game category scrolls at a readable floor instead of shrinking away', () => {
      const layout = planCategoryView({availW: 1500, availH: 640, count: 48});
      expect(layout.kind).to.eq('grid');
      if (layout.kind === 'grid') {
        expect(layout.plan.scrolls).to.be.true;
        expect(layout.plan.cardZoom).to.be.at.least(CAT_GRID_MIN_ZOOM - 1e-9);
        expect(layout.plan.visibleRows).to.be.at.least(2);
      }
    });

    it('the TV uiScale scales the whole plan in lockstep', () => {
      const base = planCategoryView({availW: 1500, availH: 640, count: 9});
      const tv = planCategoryView({availW: 3000, availH: 1280, count: 9, uiScale: 2});
      expect(base.kind).to.eq('grid');
      expect(tv.kind).to.eq('grid');
      if (base.kind === 'grid' && tv.kind === 'grid') {
        expect(tv.plan.cardZoom).to.be.closeTo(base.plan.cardZoom * 2, 0.02);
      }
    });
  });

  describe('categoryTargetRect (pre-computed flight landings)', () => {
    const origin = {x: 100, y: 50, w: 1500};

    it('a single card centres in the box', () => {
      const layout = planCategoryView({availW: 1500, availH: 700, count: 1});
      const r = categoryTargetRect(layout, 0, 1, origin);
      if (layout.kind === 'single') {
        expect(r.w).to.be.closeTo(layout.slotW, 1e-9);
        expect(r.x).to.be.closeTo(100 + (1500 - layout.slotW) / 2, 1e-9);
      }
    });

    it('grid rects follow cols/rowStride and CENTRE the partial last row', () => {
      const layout = planCategoryView({availW: 1500, availH: 640, count: 5});
      expect(layout.kind).to.eq('grid');
      if (layout.kind !== 'grid') {
        return;
      }
      const p = layout.plan;
      const r0 = categoryTargetRect(layout, 0, 5, origin);
      const r1 = categoryTargetRect(layout, 1, 5, origin);
      expect(r1.x - r0.x).to.be.closeTo(p.slotW + p.gapX, 1e-6);
      expect(r1.y).to.be.closeTo(r0.y, 1e-9);
      // The row below starts one stride down.
      const below = categoryTargetRect(layout, p.cols, 5, origin);
      expect(below.y - r0.y).to.be.closeTo(p.rowStride, 1e-6);
      // The partial LAST row centres: its first card sits right of column 0.
      const lastRowCount = 5 - (p.rows - 1) * p.cols;
      if (p.rows > 1 && lastRowCount < p.cols) {
        const lastFirst = categoryTargetRect(layout, (p.rows - 1) * p.cols, 5, origin);
        expect(lastFirst.x).to.be.greaterThan(r0.x);
      }
    });
  });

  describe('playedCategoryView state', () => {
    afterEach(() => {
      resetPlayedCategoryView();
    });

    it('categoryOutNames — held only from the proxy-paint turn (anti-blink)', () => {
      expect([...categoryOutNames()]).to.have.length(0);
      playedCategoryState.phase = 'opening';
      playedCategoryState.names = [CardName.ASTEROID as CardName];
      // Opening BEFORE the proxies are painted: the table still owns the cards.
      expect(categoryOutNames().has(CardName.ASTEROID)).to.be.false;
      playedCategoryState.holdCards = true;
      expect(categoryOutNames().has(CardName.ASTEROID)).to.be.true;
      // The settled view keeps the table held even after the grid handoff.
      playedCategoryState.holdCards = false;
      playedCategoryState.phase = 'open';
      expect(categoryOutNames().has(CardName.ASTEROID)).to.be.true;
      // The return flight holds to the last frame; reset releases everything.
      playedCategoryState.phase = 'closing';
      expect(categoryOutNames().has(CardName.ASTEROID)).to.be.true;
      resetPlayedCategoryView();
      expect([...categoryOutNames()]).to.have.length(0);
    });

    it('the flight element registry registers, resolves and clears', () => {
      const id = nextCategoryFlightId();
      const el = document.createElement('div');
      registerCategoryFlightEl(id, el);
      expect(categoryFlightEl(id)).to.eq(el);
      registerCategoryFlightEl(id, null);
      expect(categoryFlightEl(id)).to.be.undefined;
    });

    it('reset clears the pick seam too (browse mode stays pick-free)', () => {
      playedCategoryState.pick = {
        title: 't', buttonLabel: 'b', selectable: [], reasons: {}, min: 1, max: 1, selected: [],
        onResolve: () => {},
      };
      resetPlayedCategoryView();
      expect(playedCategoryState.pick).to.be.undefined;
    });
  });
});
