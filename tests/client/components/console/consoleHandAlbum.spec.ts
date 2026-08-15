import {expect} from 'chai';
import {
  albumSpecFor,
  planHandAlbum,
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

  describe('stepHandAlbum — deterministic album navigation', () => {
    const p = {cols: 5, perPage: 10};

    it('left/right walk the flat order and cross page edges (the order continues)', () => {
      expect(stepHandAlbum(9, 'right', 19, p)).to.eq(10); // page 0 → page 1
      expect(stepHandAlbum(10, 'left', 19, p)).to.eq(9); // page 1 → page 0
      expect(stepHandAlbum(0, 'left', 19, p)).to.eq(0); // the first edge is felt
      expect(stepHandAlbum(18, 'right', 19, p)).to.eq(18); // the last edge is felt
    });

    it('up/down move by a row WITHIN the page, preserving the column', () => {
      expect(stepHandAlbum(2, 'down', 19, p)).to.eq(7);
      expect(stepHandAlbum(7, 'up', 19, p)).to.eq(2);
      expect(stepHandAlbum(2, 'up', 19, p)).to.eq(2); // top row stays
      expect(stepHandAlbum(7, 'down', 19, p)).to.eq(7); // bottom row stays
      // Second page: same law, offset by the page base.
      expect(stepHandAlbum(12, 'down', 30, p)).to.eq(17);
    });

    it('down into a partial last row clamps to its final card (nearest existing)', () => {
      // 13 cards: page 1 holds 10..12 (a 3-card top row is also its last row).
      // On page 0 (full), plain row stepping applies; on a partial page the
      // clamp keeps the cursor on existing cards.
      expect(stepHandAlbum(14, 'down', 17, p)).to.eq(16); // 17 cards: page 1 = 10..16, col 4 → last card
    });

    it('vertical motion never turns a page', () => {
      expect(stepHandAlbum(7, 'down', 30, p)).to.eq(7); // bottom row of page 0, page 1 exists below in flat order
    });

    it('a single-row profile keeps up/down inert', () => {
      const deck = {cols: 4, perPage: 4};
      expect(stepHandAlbum(1, 'up', 9, deck)).to.eq(1);
      expect(stepHandAlbum(1, 'down', 9, deck)).to.eq(1);
    });

    it('an empty hand pins the cursor at zero', () => {
      expect(stepHandAlbum(3, 'right', 0, p)).to.eq(0);
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
