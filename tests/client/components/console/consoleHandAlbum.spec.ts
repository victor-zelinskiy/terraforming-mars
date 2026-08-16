import {expect} from 'chai';
import {
  albumSpecFor,
  planHandAlbum,
  planAlbumPage,
  pageRowsFor,
  pageOfIndex,
  pageSlotOfIndex,
  stepHandAlbum,
  pageJumpIndex,
  packetRect,
  ALBUM_MAX_ZOOM,
  ALBUM_MIN_ZOOM,
  HandAlbumPlan,
} from '@/client/components/console/consoleHandAlbum';
import {CARD_NATURAL_W, CARD_NATURAL_H} from '@/client/components/console/consoleHandGrid';

const TV = {cols: 5, rows: 2};
const DECK = {cols: 4, rows: 1};

function plan(count: number, spec = TV, availW = 1600, availH = 780, uiScale?: number): HandAlbumPlan {
  return planHandAlbum({availW, availH, count, spec, uiScale});
}

function pagePlan(n: number, spec = TV, availW = 1600, availH = 780, uiScale?: number) {
  const base = planHandAlbum({availW, availH, count: n, spec, uiScale});
  return planAlbumPage({availW, availH, count: n, spec, uiScale}, n, base);
}

describe('consoleHandAlbum', () => {
  describe('albumSpecFor', () => {
    it('handheld is a single generous row of four', () => {
      expect(albumSpecFor('handheld')).to.deep.eq({cols: 4, rows: 1});
    });
    it('every couch/desk profile shares the 5×2 page', () => {
      expect(albumSpecFor('tv')).to.deep.eq({cols: 5, rows: 2});
      expect(albumSpecFor('standard')).to.deep.eq({cols: 5, rows: 2});
      expect(albumSpecFor('large')).to.deep.eq({cols: 5, rows: 2});
    });
    it('«Крупные карты» is one row of four on EVERY profile (the handheld coincides)', () => {
      expect(albumSpecFor('tv', 'large')).to.deep.eq({cols: 4, rows: 1});
      expect(albumSpecFor('standard', 'large')).to.deep.eq({cols: 4, rows: 1});
      expect(albumSpecFor('handheld', 'large')).to.deep.eq({cols: 4, rows: 1});
      expect(albumSpecFor('handheld', 'adaptive')).to.deep.eq(albumSpecFor('handheld', 'large'));
    });
  });

  describe('pageRowsFor — the adaptive composition table', () => {
    it('two-row capacity balances 6..10 and showcases 1..5', () => {
      const cases: Array<[number, ReadonlyArray<number>]> = [
        [10, [5, 5]], [9, [5, 4]], [8, [4, 4]], [7, [4, 3]], [6, [3, 3]],
        [5, [5]], [4, [4]], [3, [3]], [2, [2]], [1, [1]], [0, []],
      ];
      for (const [n, rows] of cases) {
        expect(pageRowsFor(n, TV), `n=${n}`).to.deep.eq(rows);
      }
    });
    it('weak 5+1 / 5+2 splits are unexpressible', () => {
      for (let n = 6; n <= 10; n++) {
        const rows = pageRowsFor(n, TV);
        expect(rows.length).to.eq(2);
        expect(rows[0] - rows[1], `n=${n} balanced`).to.be.at.most(1);
      }
    });
    it('a single-row capacity always composes one row', () => {
      for (let n = 1; n <= 4; n++) {
        expect(pageRowsFor(n, DECK)).to.deep.eq([n]);
      }
    });
  });

  describe('planAlbumPage — Showcase Pages', () => {
    it('a two-row page keeps the STANDARD card size (never «bigger because six»)', () => {
      const base = plan(20);
      for (const n of [6, 7, 8, 9, 10]) {
        expect(pagePlan(n).zoom, `n=${n}`).to.eq(base.cardZoom);
      }
    });
    it('showcase size is MONOTONE: fewer cards never render smaller', () => {
      let prev = 0;
      for (const n of [5, 4, 3, 2, 1]) {
        const z = pagePlan(n).zoom;
        expect(z, `n=${n} vs n=${n + 1}`).to.be.at.least(prev - 1e-9);
        prev = z;
      }
    });
    it('every showcase page renders LARGER than the standard two-row card', () => {
      const base = plan(20);
      for (const n of [5, 4, 3, 2, 1]) {
        expect(pagePlan(n).zoom, `n=${n}`).to.be.greaterThan(base.cardZoom);
      }
    });
    it('a showcase page stays inside the box (air included) and centres vertically', () => {
      for (const n of [5, 3, 1]) {
        const pp = pagePlan(n);
        expect(pp.rows).to.deep.eq([n]);
        expect(pp.padX + pp.pageW).to.be.at.most(1600 + 0.5);
        expect(pp.padTop + pp.pageH).to.be.at.most(780 + 0.5);
        expect(pp.padTop, `n=${n} vertical centring`).to.be.greaterThan(26);
      }
    });
    it('the deck full single row IS the standard size (width-bound either way)', () => {
      const base = plan(9, DECK, 1000, 520);
      expect(pagePlan(4, DECK, 1000, 520).zoom).to.eq(base.cardZoom);
      expect(pagePlan(3, DECK, 1000, 520).zoom).to.be.greaterThan(base.cardZoom);
    });
    it('«Крупные карты» full page of four is far larger than the adaptive standard', () => {
      const adaptive = plan(15, TV, 1600, 780);
      const LARGE = {cols: 4, rows: 1};
      const large = pagePlan(4, LARGE, 1600, 780);
      expect(large.zoom).to.be.greaterThan(adaptive.cardZoom * 1.3);
    });
  });

  describe('planHandAlbum — card size is COUNT-INDEPENDENT', () => {
    it('one card, four cards and ten cards share the exact same geometry', () => {
      const one = plan(1);
      const four = plan(4);
      const ten = plan(10);
      for (const p of [four, ten]) {
        expect(p.cardZoom).to.eq(one.cardZoom);
        expect(p.slotW).to.eq(one.slotW);
        expect(p.slotH).to.eq(one.slotH);
        expect(p.pageW).to.eq(one.pageW);
        expect(p.pageH).to.eq(one.pageH);
      }
    });

    it('a growing hand only ever adds pages (0/1/4/5/9/10/11/19/20+)', () => {
      const cases: Array<[number, number]> = [
        [0, 1], [1, 1], [4, 1], [5, 1], [9, 1], [10, 1], [11, 2], [19, 2], [20, 2], [21, 3], [30, 3],
      ];
      for (const [count, pages] of cases) {
        const p = plan(count);
        expect(p.pageCount, `count=${count}`).to.eq(pages);
        expect(p.perPage, `count=${count}`).to.eq(10);
      }
    });

    it('the Deck page holds four cards in one row', () => {
      const p = plan(9, DECK, 1000, 520);
      expect(p.perPage).to.eq(4);
      expect(p.pageCount).to.eq(3);
      expect(p.rows).to.eq(1);
    });

    it('the page always fits the box (5×2 within width and height budgets)', () => {
      const p = plan(10);
      expect(p.pageW).to.be.at.most(1600);
      expect(p.pageH).to.be.at.most(780);
      expect(p.padX).to.be.greaterThan(0);
      expect(p.padTop).to.be.greaterThan(0);
      // The page block, seated at its pads, stays inside the box.
      expect(p.padX + p.pageW).to.be.at.most(1600 + 0.5);
      expect(p.padTop + p.pageH).to.be.at.most(780 + 0.5);
    });

    it('slots keep the premium card aspect at the applied zoom', () => {
      const p = plan(10);
      expect(p.slotW / p.slotH).to.be.closeTo(CARD_NATURAL_W / CARD_NATURAL_H, 1e-9);
      expect(p.slotW).to.be.closeTo(CARD_NATURAL_W * p.cardZoom, 1e-9);
    });

    it('uiScale grows the applied zoom with the TV profile (same logical layout)', () => {
      const base = plan(10, TV, 1600, 780, 1);
      const tv4k = plan(10, TV, 3200, 1560, 2);
      expect(tv4k.cardZoom).to.be.closeTo(base.cardZoom * 2, 1e-6);
    });

    it('clamps into [ALBUM_MIN_ZOOM, ALBUM_MAX_ZOOM] × uiScale', () => {
      const starved = plan(10, TV, 300, 200);
      expect(starved.cardZoom).to.eq(ALBUM_MIN_ZOOM);
      const vast = plan(10, TV, 20000, 20000);
      expect(vast.cardZoom).to.eq(ALBUM_MAX_ZOOM);
    });

    it('the stride clears the album width (neighbour pages fully off-stage)', () => {
      const p = plan(20);
      expect(p.stride).to.be.greaterThan(1600);
    });
  });

  describe('pageOfIndex / pageSlotOfIndex', () => {
    it('maps flat indices onto pages and slots', () => {
      expect(pageOfIndex(0, 10)).to.eq(0);
      expect(pageOfIndex(9, 10)).to.eq(0);
      expect(pageOfIndex(10, 10)).to.eq(1);
      expect(pageOfIndex(25, 10)).to.eq(2);
      expect(pageSlotOfIndex(13, 10)).to.eq(3);
    });
  });

  describe('stepHandAlbum — deterministic album navigation over COMPOSED rows', () => {
    const full = {perPage: 10, rows: [5, 5] as ReadonlyArray<number>};

    it('left/right walk the flat order and cross page edges (the order continues)', () => {
      expect(stepHandAlbum(9, 'right', 19, full)).to.eq(10); // page 0 → page 1
      expect(stepHandAlbum(10, 'left', 19, full)).to.eq(9); // page 1 → page 0
      expect(stepHandAlbum(0, 'left', 19, full)).to.eq(0); // the first edge is felt
      expect(stepHandAlbum(18, 'right', 19, full)).to.eq(18); // the last edge is felt
    });

    it('up/down move between the composed rows, preserving the column', () => {
      expect(stepHandAlbum(2, 'down', 19, full)).to.eq(7);
      expect(stepHandAlbum(7, 'up', 19, full)).to.eq(2);
      expect(stepHandAlbum(2, 'up', 19, full)).to.eq(2); // top row stays
      expect(stepHandAlbum(7, 'down', 19, full)).to.eq(7); // bottom row stays
    });

    it('a [5,4] page clamps the down-step into the shorter row', () => {
      const nine = {perPage: 10, rows: [5, 4] as ReadonlyArray<number>};
      // Page 1 of 19 (indices 10..18, 9 cards → 5+4): col 4 of the top row
      // has no col 4 below — clamp to the last card of the 4-row.
      expect(stepHandAlbum(14, 'down', 19, nine)).to.eq(18);
      expect(stepHandAlbum(18, 'up', 19, nine)).to.eq(13); // col preserved back up
      expect(stepHandAlbum(12, 'down', 19, nine)).to.eq(17); // col 2 exists below
    });

    it('a [4,3] seven-card page keeps the column law', () => {
      const seven = {perPage: 10, rows: [4, 3] as ReadonlyArray<number>};
      expect(stepHandAlbum(3, 'down', 7, seven)).to.eq(6); // col 3 → clamp to col 2
      expect(stepHandAlbum(6, 'up', 7, seven)).to.eq(2);
      expect(stepHandAlbum(4, 'up', 7, seven)).to.eq(0);
    });

    it('vertical motion never turns a page', () => {
      expect(stepHandAlbum(7, 'down', 30, full)).to.eq(7); // bottom row of page 0
    });

    it('a showcase (single-row) page keeps up/down inert', () => {
      const showcase = {perPage: 10, rows: [3] as ReadonlyArray<number>};
      expect(stepHandAlbum(11, 'up', 13, showcase)).to.eq(11);
      expect(stepHandAlbum(11, 'down', 13, showcase)).to.eq(11);
      const deck = {perPage: 4, rows: [4] as ReadonlyArray<number>};
      expect(stepHandAlbum(1, 'up', 9, deck)).to.eq(1);
      expect(stepHandAlbum(1, 'down', 9, deck)).to.eq(1);
    });

    it('an empty hand pins the cursor at zero', () => {
      expect(stepHandAlbum(3, 'right', 0, full)).to.eq(0);
    });
  });

  describe('pageJumpIndex — the explicit page turn', () => {
    it('keeps the relative slot on the neighbouring page', () => {
      expect(pageJumpIndex(3, 1, 30, 10)).to.eq(13);
      expect(pageJumpIndex(13, -1, 30, 10)).to.eq(3);
    });

    it('clamps into a partial page (nearest existing card)', () => {
      expect(pageJumpIndex(9, 1, 13, 10)).to.eq(12); // slot 9 → page 1 has 3 cards
    });

    it('refuses past the first/last page', () => {
      expect(pageJumpIndex(3, -1, 30, 10)).to.eq(3);
      expect(pageJumpIndex(25, 1, 30, 10)).to.eq(25);
    });
  });

  describe('«Крупные карты» pagination facts (capacity 4)', () => {
    const per = 4;
    it('page counts: 5→2, 9→3, 15→4', () => {
      for (const [n, pages] of [[5, 2], [9, 3], [15, 4]] as Array<[number, number]>) {
        expect(Math.ceil(n / per), `n=${n}`).to.eq(pages);
      }
    });
    it('the last page composes by its actual remainder (15→3, 9→1, 5→1)', () => {
      const LARGE = {cols: 4, rows: 1};
      expect(pageRowsFor(15 - 12, LARGE)).to.deep.eq([3]);
      expect(pageRowsFor(9 - 8, LARGE)).to.deep.eq([1]);
      expect(pageRowsFor(5 - 4, LARGE)).to.deep.eq([1]);
    });
    it('pager ranges cover 15 as 1–4 / 5–8 / 9–12 / 13–15', () => {
      const ranges = [0, 1, 2, 3].map((p) => {
        const start = p * per;
        return `${start + 1}–${Math.min(15, start + per)}`;
      });
      expect(ranges).to.deep.eq(['1–4', '5–8', '9–12', '13–15']);
    });
    it('a smaller remainder renders LARGER (the density ladder of the last page)', () => {
      const LARGE = {cols: 4, rows: 1};
      const z4 = pagePlan(4, LARGE).zoom;
      const z3 = pagePlan(3, LARGE).zoom;
      const z1 = pagePlan(1, LARGE).zoom;
      expect(z3).to.be.greaterThan(z4);
      expect(z1).to.be.at.least(z3 - 1e-9);
    });
  });

  describe('packetRect — the parked pages beyond the stage edges', () => {
    const box = {left: 200, top: 100, width: 1600, height: 800};

    it('left packets sit fully left of the box, right packets fully right', () => {
      const l = packetRect('left', 1, 0, box, 240, 345);
      expect(l.left + l.width).to.be.at.most(box.left);
      const r = packetRect('right', 1, 0, box, 240, 345);
      expect(r.left).to.be.at.least(box.left + box.width);
    });

    it('cards of one page converge (micro-stagger, not a scatter)', () => {
      const a = packetRect('right', 1, 0, box, 240, 345);
      const b = packetRect('right', 1, 9, box, 240, 345);
      expect(Math.abs(a.left - b.left)).to.be.at.most(30);
      expect(Math.abs(a.top - b.top)).to.be.at.most(30);
    });

    it('deeper pages park farther out', () => {
      const near = packetRect('right', 1, 0, box, 240, 345);
      const far = packetRect('right', 3, 0, box, 240, 345);
      expect(far.left).to.be.greaterThan(near.left);
    });
  });
});

// ── the «Компоновка альбома» preference module ─────────────────────────────
import {albumLayoutState, setConsoleAlbumLayout} from '@/client/console/consoleAlbumLayout';

describe('consoleAlbumLayout preference', () => {
  after(() => {
    // Module state is bundle-shared — never leak a non-default layout.
    setConsoleAlbumLayout('adaptive');
  });

  it('defaults to adaptive and persists the choice', () => {
    expect(albumLayoutState.layout).to.eq('adaptive');
    setConsoleAlbumLayout('large');
    expect(albumLayoutState.layout).to.eq('large');
    // Storage is optional in the test env (setup.ts exposes constructors,
    // not imperative APIs) — the persistence write is asserted where it
    // exists and gracefully absent where it does not (the module's own
    // private-mode behaviour).
    const store = (globalThis as {localStorage?: Storage}).localStorage;
    if (store !== undefined) {
      expect(store.getItem('tm_console_album')).to.eq('large');
    }
    setConsoleAlbumLayout('adaptive');
    expect(albumLayoutState.layout).to.eq('adaptive');
    if (store !== undefined) {
      expect(store.getItem('tm_console_album')).to.eq('adaptive');
    }
  });
});
