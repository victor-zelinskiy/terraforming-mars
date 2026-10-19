import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {buildPlayedZones} from '@/client/components/console/consolePlayedModel';
import {
  playedCategories, categoryCards, planCategoryView, categoryTargetRect,
  plannedFlightIndices, CAT_GRID_MAX_ZOOM,
  categoryAlbumSpec, planCategoryAlbum, albumPageOf, albumPageIndices, stepCategoryAlbum, turnCategoryAlbum,
  CategoryViewLayout,
} from '@/client/components/console/consolePlayedCategoryModel';
import {
  playedCategoryState, resetPlayedCategoryView, categoryOutNames,
  categoryAwayNames, categoryGroundedNames,
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

    it('while ONE screen holds the zone the grid\'s sizes are MONOTONE: more cards never render larger', () => {
      let prev = Infinity;
      for (const n of [2, 3, 4, 5, 6, 12]) {
        const layout = planCategoryView({availW: 1500, availH: 640, count: n});
        expect(layout.kind).to.eq('grid');
        if (layout.kind === 'grid') {
          expect(layout.plan.scrolls, `count ${n} on one screen`).to.be.false;
          expect(layout.plan.cardZoom).to.be.at.most(prev + 1e-9, `count ${n}`);
          prev = layout.plan.cardZoom;
        }
      }
    });

    it('a LONG-game category is a PAGED ALBUM — at least two rows a page, never a scroll (the owner, 2026-10-19)', () => {
      for (const n of [24, 48, 100]) {
        const layout = planCategoryView({availW: 1500, availH: 640, count: n});
        expect(layout.kind, `count ${n}`).to.eq('album');
        if (layout.kind === 'album') {
          expect(layout.album.rows).to.be.at.least(2);
          expect(layout.album.pageCount).to.eq(Math.ceil(n / layout.album.perPage));
          expect(layout.album.pageCount).to.be.greaterThan(1);
        }
      }
      // Never a grid that scrolls, whatever the count.
      for (let n = 2; n <= 120; n += 7) {
        const layout = planCategoryView({availW: 1500, availH: 640, count: n});
        expect(layout.kind === 'grid' && layout.plan.scrolls, `count ${n}`).to.eq(false);
      }
    });

    it('a LIFT never shrinks a face while the zone can stand on one screen — the air yields first (PL-619)', () => {
      // The Deck's body (≈ 990 × 600), its shelf face 208 px (applied zoom 0.65): four cards with their generous air
      // fell to 186 px under the shelf — packed tight they stand in one row at the shelf's face or larger.
      const shelf = 208 / 320;
      const free = planCategoryView({availW: 990, availH: 600, count: 4});
      const floored = planCategoryView({availW: 990, availH: 600, count: 4, faceFloorZoom: shelf});
      expect(free.kind).to.eq('grid');
      expect(floored.kind).to.eq('grid');
      if (free.kind === 'grid' && floored.kind === 'grid') {
        expect(free.plan.cardZoom, 'unfloored, the air shrank them under the shelf').to.be.lessThan(shelf);
        expect(floored.plan.cardZoom).to.be.at.least(shelf - 1e-9);
        expect(floored.plan.scrolls, 'one screen').to.be.false;
      }
      // A small set still GROWS past the floor into the box (4K, three cards).
      const few = planCategoryView({availW: 3300, availH: 1780, count: 3, uiScale: 2, faceFloorZoom: 551 / 320});
      if (few.kind === 'grid') {
        expect(few.plan.cardZoom).to.be.greaterThan(551 / 320);
      }
      // A floor under the grid's own minimum changes nothing.
      const low = planCategoryView({availW: 1500, availH: 640, count: 9, faceFloorZoom: 0.2});
      const none = planCategoryView({availW: 1500, availH: 640, count: 9});
      expect(low).to.deep.eq(none);
    });

    it('…UNLESS the face is what keeps the zone on ONE screen: it shrinks just enough, never scrolls (PL-619 × goal 1)', () => {
      // 4K: fourteen active cards cannot stand on one screen at the 528 px shelf face — the whole zone stays together.
      const shelf = 528 / 320;
      const plan = planCategoryView({availW: 3300, availH: 1780, count: 14, uiScale: 2, faceFloorZoom: shelf});
      expect(plan.kind).to.eq('grid');
      if (plan.kind === 'grid') {
        expect(plan.plan.scrolls, 'the whole zone on one screen').to.be.false;
        expect(plan.plan.cardZoom).to.be.lessThan(shelf);
        expect(plan.plan.cols * plan.plan.rows).to.be.at.least(14);
      }
      // A zone too big even for that is an ALBUM of pages — never a scroll.
      const huge = planCategoryView({availW: 1500, availH: 640, count: 48, faceFloorZoom: 0.85});
      expect(huge.kind).to.eq('album');
      // The Deck's body (993 × 638): fourteen active cards would need ≈ 132 px faces on one screen, under the readable
      // floor — an album of the handheld's page with TWO rows (4 × 2), two pages.
      const deck = planCategoryView({availW: 993, availH: 638, count: 14, faceFloorZoom: 0.3, albumSpec: {cols: 4, rows: 1}});
      expect(deck.kind).to.eq('album');
      if (deck.kind === 'album') {
        expect([deck.album.cols, deck.album.rows]).to.deep.eq([4, 2]);
        expect(deck.album.pageCount).to.eq(2);
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

  describe('the PAGED ALBUM (a zone too big for one readable screen)', () => {
    const album = (count: number, over: {availW?: number, availH?: number, uiScale?: number} = {}) =>
      planCategoryAlbum({availW: 1500, availH: 640, count, spec: {cols: 5, rows: 2}, ...over});

    it('the page grid is the profile\'s hand page with AT LEAST two rows', () => {
      expect(categoryAlbumSpec({cols: 5, rows: 2})).to.deep.eq({cols: 5, rows: 2});
      expect(categoryAlbumSpec({cols: 4, rows: 1}), 'the handheld / «Крупные карты»').to.deep.eq({cols: 4, rows: 2});
    });

    it('the face is a BOX fact — 24 cards and 100 are the same face; the count only adds pages', () => {
      const a = album(24);
      const b = album(100);
      expect(a.zoom).to.be.closeTo(b.zoom, 1e-9);
      expect([a.pageCount, b.pageCount]).to.deep.eq([3, 10]);
      expect(a.slotW).to.be.closeTo(320 * a.zoom, 1e-9);
      // The page fits the box with its spine lane under it.
      expect(a.padTop + a.pageH + a.spineH).to.be.at.most(640 + 1e-6);
      expect(a.padX * 2 + a.pageW).to.be.closeTo(1500, 1e-6);
      const tv = album(24, {availW: 3000, availH: 1280, uiScale: 2});
      expect(tv.zoom).to.be.closeTo(a.zoom * 2, 1e-6);
    });

    it('a card\'s page, a page\'s cards', () => {
      const a = album(24);
      expect(albumPageOf(a, 0)).to.eq(0);
      expect(albumPageOf(a, 9)).to.eq(0);
      expect(albumPageOf(a, 10)).to.eq(1);
      expect(albumPageOf(a, 23)).to.eq(2);
      expect(albumPageIndices(a, 24, 2)).to.deep.eq([20, 21, 22, 23]);
    });

    it('the d-pad walks the page; ◀ / ▶ off its edge continue onto the next page keeping the row; ▲ / ▼ feel the edge', () => {
      const a = album(24);
      expect(stepCategoryAlbum(a, 0, 'right', 24)).to.eq(1);
      expect(stepCategoryAlbum(a, 4, 'right', 24), 'past the first row\'s end → the next page, same row').to.eq(10);
      expect(stepCategoryAlbum(a, 9, 'right', 24), 'second row → the next page\'s second row').to.eq(15);
      expect(stepCategoryAlbum(a, 10, 'left', 24), 'back across the edge — the row\'s last column').to.eq(4);
      expect(stepCategoryAlbum(a, 0, 'left', 24), 'the first page\'s edge is felt').to.eq(0);
      expect(stepCategoryAlbum(a, 0, 'down', 24)).to.eq(5);
      expect(stepCategoryAlbum(a, 5, 'down', 24), 'the page\'s last row').to.eq(5);
      expect(stepCategoryAlbum(a, 5, 'up', 24)).to.eq(0);
      // The partial last page (4 cards, one row): ▶ from page 1's second row lands on its only row.
      expect(stepCategoryAlbum(a, 19, 'right', 24)).to.eq(20);
      expect(stepCategoryAlbum(a, 23, 'right', 24), 'the last card is the edge').to.eq(23);
    });

    it('LB / RB keep the relative slot on the neighbouring page (clamped into a partial one); the ends are felt', () => {
      const a = album(24);
      expect(turnCategoryAlbum(a, 3, 1, 24)).to.eq(13);
      expect(turnCategoryAlbum(a, 18, 1, 24), 'clamped into the 4-card last page').to.eq(23);
      expect(turnCategoryAlbum(a, 13, -1, 24)).to.eq(3);
      expect(turnCategoryAlbum(a, 3, -1, 24)).to.eq(3);
      expect(turnCategoryAlbum(a, 21, 1, 24)).to.eq(21);
    });

    it('a slot lies on its page by the SAME arithmetic the flights land on — a partial last row centres', () => {
      const a = album(24);
      const layout: CategoryViewLayout = {kind: 'album', album: a};
      const o = {x: 100, y: 40, w: 1500};
      const r0 = categoryTargetRect(layout, 0, 24, o);
      expect(r0.x).to.be.closeTo(100 + a.padX, 1e-6);
      expect(r0.y).to.be.closeTo(40 + a.padTop, 1e-6);
      // Page 1's first card stands where page 0's did (the page on screen stands at the box).
      const r10 = categoryTargetRect(layout, 10, 24, o);
      expect([r10.x, r10.y]).to.deep.eq([r0.x, r0.y]);
      // The last page's lone row of four centres.
      const r20 = categoryTargetRect(layout, 20, 24, o);
      expect(r20.x).to.be.closeTo(100 + a.padX + (a.pageW - (4 * a.slotW + 3 * a.gapX)) / 2, 1e-6);
    });
  });

  describe('plannedFlightIndices (bounded category flights)', () => {
    it('a non-scrolling grid (every card visible) flies whole', () => {
      const layout = planCategoryView({availW: 1500, availH: 900, count: 8});
      const idx = plannedFlightIndices(layout, 8, 900, 0);
      expect(idx).to.deep.eq([0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('a single card flies whole', () => {
      const layout = planCategoryView({availW: 1500, availH: 700, count: 1});
      expect(plannedFlightIndices(layout, 1, 700, 0)).to.deep.eq([0]);
    });

    it('an ALBUM flies the page on screen — the other pages\' cards dissolve in place (grounded)', () => {
      const layout = planCategoryView({availW: 1500, availH: 640, count: 100});
      expect(layout.kind).to.eq('album');
      expect(plannedFlightIndices(layout, 100, 640, 0)).to.deep.eq([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      // The close from page 3 flies page 3 home.
      expect(plannedFlightIndices(layout, 100, 640, 0, 3)).to.deep.eq([30, 31, 32, 33, 34, 35, 36, 37, 38, 39]);
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
      playedCategoryState.flights = [{id: 1, name: CardName.ASTEROID, index: 0, faceDown: true}];
      // Opening BEFORE the proxies are painted: the table still owns the cards.
      expect(categoryOutNames().has(CardName.ASTEROID)).to.be.false;
      playedCategoryState.holdCards = true;
      expect(categoryOutNames().has(CardName.ASTEROID)).to.be.true;
      // The settled view keeps the table held even after the grid handoff.
      playedCategoryState.holdCards = false;
      playedCategoryState.flights = [];
      playedCategoryState.phase = 'open';
      expect(categoryOutNames().has(CardName.ASTEROID)).to.be.true;
      // The close's PRE-PAINT gap (no proxies yet): everything stays away.
      playedCategoryState.phase = 'closing';
      expect(categoryOutNames().has(CardName.ASTEROID)).to.be.true;
      resetPlayedCategoryView();
      expect([...categoryOutNames()]).to.have.length(0);
    });

    it('bounded flights: the visibility hold covers the FLOWN cards; grounded stay away logically', () => {
      playedCategoryState.phase = 'opening';
      playedCategoryState.names = [CardName.ASTEROID as CardName, CardName.BIG_ASTEROID as CardName];
      playedCategoryState.flights = [{id: 1, name: CardName.ASTEROID, index: 0, faceDown: false}];
      playedCategoryState.groundedNames = [CardName.BIG_ASTEROID];
      playedCategoryState.holdCards = true;
      // Transition: only the flown card carries the visibility hold…
      expect(categoryOutNames().has(CardName.ASTEROID)).to.be.true;
      expect(categoryOutNames().has(CardName.BIG_ASTEROID)).to.be.false;
      // …the grounded one dissolves via its own class…
      expect(categoryGroundedNames().has(CardName.BIG_ASTEROID)).to.be.true;
      // …and BOTH are logically away (the events count / full-ghost read).
      expect(categoryAwayNames().has(CardName.ASTEROID)).to.be.true;
      expect(categoryAwayNames().has(CardName.BIG_ASTEROID)).to.be.true;
      // Settled OPEN: the hold covers everything; grounded class persists.
      playedCategoryState.holdCards = false;
      playedCategoryState.flights = [];
      playedCategoryState.phase = 'open';
      expect(categoryOutNames().has(CardName.BIG_ASTEROID)).to.be.true;
      expect(categoryGroundedNames().has(CardName.BIG_ASTEROID)).to.be.true;
      // CLOSING with a fresh bounded spawn: the grounded set empties its
      // class (the cards fade back in place) while the flown hold stands.
      playedCategoryState.phase = 'closing';
      playedCategoryState.flights = [{id: 2, name: CardName.ASTEROID, index: 0, faceDown: false}];
      playedCategoryState.holdCards = true;
      expect(categoryOutNames().has(CardName.ASTEROID)).to.be.true;
      expect(categoryOutNames().has(CardName.BIG_ASTEROID)).to.be.false;
      expect(categoryGroundedNames().has(CardName.BIG_ASTEROID)).to.be.false;
      expect(categoryAwayNames().has(CardName.BIG_ASTEROID)).to.be.true;
    });

    it('the flight element registry registers, resolves and clears', () => {
      const id = nextCategoryFlightId();
      const el = document.createElement('div');
      registerCategoryFlightEl(id, el);
      expect(categoryFlightEl(id)).to.eq(el);
      registerCategoryFlightEl(id, null);
      expect(categoryFlightEl(id)).to.be.undefined;
    });
  });
});
