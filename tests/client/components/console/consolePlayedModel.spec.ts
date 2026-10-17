import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {
  buildPlayedZones,
  flatFaceUp,
  packShelves,
  pageShelves,
  pageOfShelfCard,
  zonePages,
  zonesOnPage,
  planPlayedTable,
  tableAlbumSpec,
  pickSpatialTarget,
  unionNavRects,
  PLAYED_CARD_NATURAL_W,
  PLAYED_CARD_NATURAL_H,
  TABLE_HERO_GAIN,
  TABLE_EVENTS_GAIN,
  NavRect,
  PlayedShelfZone,
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

  describe('packShelves — zone runs on rows of `cols`', () => {
    const counts = (over: Partial<Record<PlayedShelfZone, number>>) =>
      ({prelude: 0, ceo: 0, active: 0, automated: 0, ...over});

    it('a zone starts a new row; a long zone splits into row-sized runs named as continuations', () => {
      const rows = packShelves(counts({active: 9}), 4);
      expect(rows.map((r) => r.count)).to.deep.eq([4, 4, 1]);
      expect(rows[0].runs).to.deep.eq([{zone: 'active', start: 0, count: 4, col: 0, first: true}]);
      expect(rows[1].runs).to.deep.eq([{zone: 'active', start: 4, count: 4, col: 0, first: false}]);
      expect(rows[2].runs).to.deep.eq([{zone: 'active', start: 8, count: 1, col: 0, first: false}]);
    });

    it('a short zone tucks in after the tail of the one before it when it fits WHOLE — else it takes a new row', () => {
      const tucked = packShelves(counts({active: 6, automated: 2}), 4);
      expect(tucked.map((r) => r.count)).to.deep.eq([4, 4]);
      expect(tucked[1].runs.map((r) => [r.zone, r.col, r.count])).to.deep.eq([['active', 0, 2], ['automated', 2, 2]]);
      const own = packShelves(counts({active: 6, automated: 3}), 4);
      expect(own.map((r) => r.count)).to.deep.eq([4, 2, 3]);
      expect(own[2].runs[0]).to.deep.include({zone: 'automated', col: 0, first: true});
    });

    it('is APPEND-ONLY: one more card extends the zone\'s last run or opens the next — nothing before it moves', () => {
      const before = packShelves(counts({prelude: 2, active: 5}), 4);
      const after = packShelves(counts({prelude: 2, active: 6}), 4);
      expect(after[0]).to.deep.eq(before[0]);
      expect(after[1]).to.deep.eq(before[1]);
      expect(after[2].runs[0]).to.deep.include({zone: 'active', start: 4, count: 2});
    });

    it('table order: preludes · CEO · active · automated; an empty zone is skipped; an empty table is no rows', () => {
      const rows = packShelves(counts({prelude: 1, ceo: 1, automated: 1}), 4);
      expect(rows).to.have.length(1);
      expect(rows[0].runs.map((r) => r.zone)).to.deep.eq(['prelude', 'ceo', 'automated']);
      expect(packShelves(counts({}), 4)).to.deep.eq([]);
    });
  });

  describe('pageShelves / the page lookups', () => {
    const counts = {prelude: 2, ceo: 0, active: 9, automated: 3};

    it('cuts the rows into strict pages; an empty table is one empty page', () => {
      const pages = pageShelves(packShelves(counts, 4), 2);
      // prelude ×2 | active 0–3 | active 4–7 | active 8 + automated ×3 (tucked in) → four rows, two pages
      expect(pages.map((p) => p.rows.length)).to.deep.eq([2, 2]);
      expect(pages.map((p) => p.index)).to.deep.eq([0, 1]);
      expect(pageShelves([], 2)).to.deep.eq([{index: 0, rows: []}]);
    });

    it('a card\'s page, a zone\'s pages, the zones of a page', () => {
      const pages = pageShelves(packShelves(counts, 4), 2);
      // page 0: prelude ×2 (row 1) · active 0–3 (row 2); page 1: active 4–7 (row 3) · active 8 + automated ×3 (row 4)
      expect(pageOfShelfCard(pages, 'prelude', 1)).to.eq(0);
      expect(pageOfShelfCard(pages, 'active', 0)).to.eq(0);
      expect(pageOfShelfCard(pages, 'active', 5)).to.eq(1);
      expect(pageOfShelfCard(pages, 'automated', 2)).to.eq(1);
      expect(pageOfShelfCard(pages, 'ceo', 0)).to.eq(undefined);
      expect(zonePages(pages, 'active')).to.deep.eq([0, 1]);
      expect(zonePages(pages, 'automated')).to.deep.eq([1]);
      expect(zonesOnPage(pages[0])).to.deep.eq(['prelude', 'active']);
      expect(zonesOnPage(pages[1])).to.deep.eq(['active', 'automated']);
      expect(zonesOnPage(undefined)).to.deep.eq([]);
    });
  });

  describe('planPlayedTable — the identity column + the shelf album', () => {
    const SPEC = {cols: 5, rows: 2};
    const box = (over: Partial<Parameters<typeof planPlayedTable>[0]> = {}) => planPlayedTable({
      availW: 1600, availH: 800, counts: {prelude: 2, ceo: 0, active: 9, automated: 3}, corporations: 1, spec: SPEC, ...over,
    });

    it('the album composes `cols − 1` of the profile page beside the identity column', () => {
      expect(tableAlbumSpec({cols: 5, rows: 2})).to.deep.eq({cols: 4, rows: 2});
      // The handheld album is one row (the hand's density); the TABLE never is (the owner, 2026-10-17 — PL-622).
      expect(tableAlbumSpec({cols: 4, rows: 1})).to.deep.eq({cols: 3, rows: 2});
      const plan = box();
      expect(plan.album.cols).to.eq(4);
      expect(plan.album.rowsPerPage).to.eq(2);
      expect(plan.pageCount).to.eq(2);
    });

    it('the shelf face is a BOX fact: one card and fifty are the same face; a growing table only adds pages', () => {
      const few = box({counts: {prelude: 0, ceo: 0, active: 6, automated: 0}});
      const many = box({counts: {prelude: 0, ceo: 0, active: 50, automated: 0}});
      expect(few.album.zoom).to.be.closeTo(many.album.zoom, 1e-9);
      expect(few.pageCount).to.eq(1);
      expect(many.pageCount).to.eq(7);
      expect(many.album.slotW).to.be.closeTo(PLAYED_CARD_NATURAL_W * many.album.zoom, 1e-9);
      expect(many.album.slotH).to.be.closeTo(PLAYED_CARD_NATURAL_H * many.album.zoom, 1e-9);
    });

    it('a ONE short row grows into its room (the showcase), bounded by the gain cap — never a two-row table', () => {
      const std = box({counts: {prelude: 0, ceo: 0, active: 6, automated: 0}});
      const two = box({counts: {prelude: 0, ceo: 0, active: 2, automated: 0}});
      expect(two.album.showcase).to.eq(true);
      expect(two.album.zoom).to.be.greaterThan(std.album.zoom);
      expect(two.album.zoom).to.be.at.most(std.album.zoom * 1.5 + 1e-9);
      expect(std.album.showcase).to.eq(false);
      const full = box({counts: {prelude: 0, ceo: 0, active: 4, automated: 0}});
      expect(full.album.showcase, 'a full row is the standard').to.eq(false);
    });

    it('the hero is larger than a shelf face (up to the gain) and the events stack smaller — both inside the column', () => {
      const plan = box();
      expect(plan.hero.zoom).to.be.greaterThan(plan.album.zoom);
      expect(plan.hero.zoom).to.be.at.most(plan.album.zoom * TABLE_HERO_GAIN + 1e-9);
      expect(plan.hero.slotW).to.be.at.most(plan.identityW);
      expect(plan.events.zoom).to.be.closeTo(plan.album.zoom * TABLE_EVENTS_GAIN, 1e-9);
      expect(plan.hero.count).to.eq(1);
      // Two corporations (Merger) share the hero's room — each smaller, both in the column.
      const two = box({corporations: 2});
      expect(two.hero.count).to.eq(2);
      expect(two.hero.zoom).to.be.lessThan(plan.hero.zoom);
      expect(2 * two.hero.slotH).to.be.lessThan(800);
    });

    it('the TV uiScale multiplies every px knob in lockstep', () => {
      const base = box();
      const tv = box({availW: 3200, availH: 1600, uiScale: 2});
      expect(tv.album.zoom).to.be.closeTo(base.album.zoom * 2, 1e-9);
      expect(tv.album.slotW).to.be.closeTo(base.album.slotW * 2, 1e-9);
      expect(tv.album.captionH).to.be.closeTo(base.album.captionH * 2, 1e-9);
      expect(tv.identityW).to.be.closeTo(base.identityW * 2, 1);
      expect(tv.hero.zoom).to.be.closeTo(base.hero.zoom * 2, 1e-9);
      expect(tv.pageCount).to.eq(base.pageCount);
    });

    it('identical input → identical plan (stability contract)', () => {
      expect(box()).to.deep.eq(box());
    });

    it('the rows are the PROFILE\'s — a taller box never adds a row, so two seats of one table share one face (PL-622)', () => {
      const counts = {prelude: 2, ceo: 0, active: 14, automated: 3};
      // The Deck's body (1000–1060 × 640–660): the table's page is TWO rows of three whatever the box (the handheld
      // album's one row is the hand's density — the owner chose two for the table, 2026-10-17).
      for (const [w, h] of [[1000, 640], [1045, 660], [1060, 1000]]) {
        const p = planPlayedTable({availW: w, availH: h, counts, corporations: 1, spec: {cols: 4, rows: 1}});
        expect(p.album.cols).to.eq(3);
        expect(p.album.rowsPerPage, `${w}×${h}`).to.eq(2);
      }
      // Measured: the Deck's own body reads ≈ 191 px faces and nineteen cards in 4 pages (one row read 208 px · 7).
      const deck = planPlayedTable({availW: 1000, availH: 640, counts, corporations: 1, spec: {cols: 4, rows: 1}});
      expect(deck.album.slotW).to.be.within(185, 197);
      expect(deck.pageCount).to.eq(4);
      // A bot's provenance line shortens the body by a line: the same composition (the face follows the box, as
      // on every two-row profile), never a different row count between two seats.
      const bot = planPlayedTable({availW: 1000, availH: 610, counts, corporations: 1, spec: {cols: 4, rows: 1}});
      expect(bot.album.rowsPerPage).to.eq(deck.album.rowsPerPage);
      expect(bot.album.cols).to.eq(deck.album.cols);
      // The TV / FHD two-row profile is untouched.
      expect(box().album.rowsPerPage).to.eq(2);
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
    it('a zone split over two rows is ONE target — the union of its runs; other keys stay apart', () => {
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
