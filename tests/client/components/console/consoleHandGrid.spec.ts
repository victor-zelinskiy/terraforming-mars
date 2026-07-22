import {expect} from 'chai';
import {UnplayableReason, UnplayableReasonType} from '@/common/cards/UnplayableReason';
import {
  planHandGrid,
  stepHandGrid,
  shortBlockerLabel,
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_COLS,
  TV_FILL_MAX_ZOOM,
} from '@/client/components/console/consoleHandGrid';

function reason(type: UnplayableReasonType, message: string): UnplayableReason {
  return {type, message};
}

describe('consoleHandGrid', () => {
  describe('planHandGrid', () => {
    it('is empty and non-scrolling for an empty hand', () => {
      const p = planHandGrid({availW: 1400, availH: 800, count: 0});
      expect(p.rows).to.eq(0);
      expect(p.scrolls).to.be.false;
    });

    it('a small hand is one centred, non-scrolling row (cols = count, big zoom)', () => {
      const p = planHandGrid({availW: 1400, availH: 800, count: 3});
      expect(p.cols).to.eq(3);
      expect(p.rows).to.eq(1);
      expect(p.scrolls).to.be.false;
      expect(p.cardZoom).to.be.closeTo(0.72, 1e-9);
      expect(p.contentW).to.be.greaterThan(0);
    });

    it('never gives more columns than cards', () => {
      const p = planHandGrid({availW: 1600, availH: 900, count: 2});
      expect(p.cols).to.eq(2);
    });

    it('caps columns at MAX_COLS and scrolls a big hand', () => {
      const p = planHandGrid({availW: 1400, availH: 500, count: 25});
      expect(p.cols).to.be.at.most(MAX_COLS);
      expect(p.cols).to.eq(5); // 25 balanced into 5×5 (anti-orphan)
      expect(p.rows).to.eq(5);
      expect(p.scrolls).to.be.true;
      expect(p.visibleRows).to.be.at.least(2);
    });

    it('rebalances so the last row is never a lone orphan (7 → 4+3, not 6+1)', () => {
      const p = planHandGrid({availW: 1400, availH: 900, count: 7});
      expect(p.cols).to.eq(4);
      expect(p.rows).to.eq(2);
    });

    it('shrinks the zoom (floored at MIN_ZOOM) so a short box keeps rows readable', () => {
      const p = planHandGrid({availW: 1400, availH: 300, count: 30});
      expect(p.cardZoom).to.eq(MIN_ZOOM);
      expect(p.scrolls).to.be.true;
    });

    it('keeps the zoom within [MIN_ZOOM, MAX_ZOOM]', () => {
      for (const count of [1, 5, 12, 40, 80]) {
        const p = planHandGrid({availW: 1200, availH: 700, count});
        expect(p.cardZoom).to.be.at.least(MIN_ZOOM);
        expect(p.cardZoom).to.be.at.most(MAX_ZOOM);
      }
    });

    it('derives a consistent rowStride and content height', () => {
      const p = planHandGrid({availW: 1400, availH: 500, count: 25});
      expect(p.rowStride).to.be.closeTo(p.slotH + p.gapY, 1e-9);
      expect(p.contentH).to.be.closeTo(p.rows * p.slotH + (p.rows - 1) * p.gapY, 1e-9);
    });

    it('degrades gracefully to a sane plan when the box is not measured', () => {
      const p = planHandGrid({availW: 0, availH: 0, count: 5});
      expect(p.cols).to.eq(1);
      expect(p.rows).to.eq(0);
      expect(p.scrolls).to.be.false;
    });
  });

  describe('TV fill pass (uiScale > 1)', () => {
    // A 4K-ish shelf box in real px (the tv profile feeds uiScale ≈ 2).
    const box = {availW: 3400, availH: 1500, uiScale: 2};

    it('fewer cards are never smaller: zoom is monotone non-increasing in count', () => {
      let prev = Infinity;
      for (const count of [1, 2, 3, 4, 5, 6, 8, 12]) {
        const p = planHandGrid({...box, count});
        expect(p.cardZoom, `count ${count}`).to.be.at.most(prev + 1e-9);
        prev = p.cardZoom;
      }
    });

    it('a 1–3 card hand shares the same fill ceiling (no solo shrink)', () => {
      const z1 = planHandGrid({...box, count: 1}).cardZoom;
      const z2 = planHandGrid({...box, count: 2}).cardZoom;
      const z3 = planHandGrid({...box, count: 3}).cardZoom;
      expect(z1).to.be.closeTo(z3, 1e-9);
      expect(z2).to.be.closeTo(z3, 1e-9);
    });

    it('the grown zoom never exceeds the art ceiling and never overflows the box', () => {
      for (const count of [1, 2, 3, 4, 6, 9]) {
        const p = planHandGrid({...box, count});
        expect(p.cardZoom, `count ${count}`).to.be.at.most(TV_FILL_MAX_ZOOM + 1e-9);
        if (!p.scrolls) {
          expect(p.contentH, `count ${count}`).to.be.at.most(box.availH + 0.5);
        }
      }
    });

    it('uiScale 1 (non-tv profiles) skips the fill pass entirely', () => {
      const p = planHandGrid({availW: 1400, availH: 800, count: 3, uiScale: 1});
      expect(p.cardZoom).to.be.closeTo(0.72, 1e-9);
    });

    it('a wide 4K hand spreads past the 1080 column cap into the free width', () => {
      // 15 cards on the 4K shelf: the 1080-tuned MAX_COLS (6) would rebalance to
      // 5×3 and SCROLL, clustering the cards in the middle with large side
      // margins. The TV-scaled column ceiling uses the free horizontal space
      // instead — more columns, fewer rows, no scroll.
      const p = planHandGrid({...box, count: 15});
      expect(p.cols).to.be.greaterThan(MAX_COLS);
      expect(p.rows).to.eq(2);
      expect(p.scrolls).to.be.false;
    });

    it('16 cards flatten to a balanced 8×2 instead of 6×3 + scroll (the reported case)', () => {
      // The anti-orphan rebalance used to collapse 16 into 6×3 (6+6+4) and
      // scroll, wasting the side space; the layout search finds the balanced
      // 8+8 = 2 rows that fills the width and needs no scroll.
      const p = planHandGrid({...box, count: 16});
      expect(p.cols).to.eq(8);
      expect(p.rows).to.eq(2);
      expect(p.scrolls).to.be.false;
      // A full row still fits the box width (no horizontal overflow).
      expect(p.cols * p.slotW + (p.cols - 1) * p.gapX).to.be.at.most(box.availW);
    });

    it('never picks a lopsided last row when a balanced one fits the same rows', () => {
      // 16 in 3 rows would be 6+6+4 (balanced) not 7+7+2 — the search only
      // considers the minimal (balanced) column count for each row count.
      const p = planHandGrid({...box, count: 16});
      // 2 rows is achievable, so it's preferred over any 3-row layout entirely.
      expect(p.rows).to.eq(2);
      const perRow = Math.ceil(16 / p.rows);
      expect(p.cols).to.eq(perRow);
    });

    it('the TV column ceiling scales with uiScale but width still binds', () => {
      // Even with a generous ceiling the width-fit is the real limiter — cards
      // never get thinner than the box allows.
      const p = planHandGrid({...box, count: 40});
      expect(p.cols).to.be.at.most(Math.round(MAX_COLS * box.uiScale));
      expect(p.slotW).to.be.greaterThan(0);
      // A full row must fit the box width (no horizontal overflow).
      expect(p.cols * p.slotW + (p.cols - 1) * p.gapX).to.be.at.most(box.availW);
    });
  });

  describe('stepHandGrid', () => {
    // count 10, cols 4 → row0:[0,1,2,3] row1:[4,5,6,7] row2:[8,9]
    const N = 10;
    const C = 4;

    it('left/right step ±1 across the flat list, clamped (no wrap)', () => {
      expect(stepHandGrid(0, 'left', N, C)).to.eq(0); // top-left edge stays
      expect(stepHandGrid(5, 'left', N, C)).to.eq(4);
      expect(stepHandGrid(3, 'right', N, C)).to.eq(4); // crosses into the next row
      expect(stepHandGrid(9, 'right', N, C)).to.eq(9); // last card edge stays
    });

    it('up preserves the column and the top edge stays put', () => {
      expect(stepHandGrid(0, 'up', N, C)).to.eq(0); // row 0 → stay
      expect(stepHandGrid(5, 'up', N, C)).to.eq(1); // row1 col1 → row0 col1
      expect(stepHandGrid(9, 'up', N, C)).to.eq(5); // row2 col1 → row1 col1
    });

    it('down preserves the column, clamps into a partial last row, bottom edge stays', () => {
      expect(stepHandGrid(0, 'down', N, C)).to.eq(4); // row0 col0 → row1 col0
      expect(stepHandGrid(5, 'down', N, C)).to.eq(9); // row1 col1 → row2 col1
      expect(stepHandGrid(6, 'down', N, C)).to.eq(9); // row1 col2 → last row has no col2 → last card
      expect(stepHandGrid(9, 'down', N, C)).to.eq(9); // last row → stay
    });

    it('is safe for an empty list', () => {
      expect(stepHandGrid(0, 'left', 0, 4)).to.eq(0);
      expect(stepHandGrid(0, 'down', 0, 4)).to.eq(0);
    });
  });

  describe('shortBlockerLabel', () => {
    it('returns undefined when there is no reason (playable)', () => {
      expect(shortBlockerLabel([])).to.be.undefined;
    });

    it('maps each reason type to a compact label', () => {
      expect(shortBlockerLabel([reason('megacredits', 'Need ${0} more M€')])).to.eq('Not enough M€');
      expect(shortBlockerLabel([reason('placement', 'No space available for the tile')])).to.eq('No space');
      expect(shortBlockerLabel([reason('target', 'No target to reduce production')])).to.eq('No target');
      expect(shortBlockerLabel([reason('tag', 'Requires ${0} tag(s)')])).to.eq('Tag needed');
      expect(shortBlockerLabel([reason('production', 'Requires ${0} production')])).to.eq('Production');
      expect(shortBlockerLabel([reason('party', 'Requires a specific political situation')])).to.eq('Politics');
      expect(shortBlockerLabel([reason('tr', 'Requires a terraform rating of ${0}')])).to.eq('Rating');
      expect(shortBlockerLabel([reason('resource', 'Not enough energy')])).to.eq('Resource');
      expect(shortBlockerLabel([reason('count', 'Requires ${0} city tile(s)')])).to.eq('Condition');
      expect(shortBlockerLabel([reason('rule', 'Card is unavailable')])).to.eq('Condition');
    });

    it('names the specific global parameter from the english message (legacy fallback)', () => {
      expect(shortBlockerLabel([reason('globalParameter', 'Requires ${0}°C')])).to.eq('Temperature');
      expect(shortBlockerLabel([reason('globalParameter', 'Requires Venus ${0}%')])).to.eq('Venus');
      expect(shortBlockerLabel([reason('globalParameter', 'Requires ${0} ocean(s)')])).to.eq('Oceans');
      expect(shortBlockerLabel([reason('globalParameter', 'Requires ${0}% oxygen')])).to.eq('Oxygen');
    });

    it('names the global parameter STRUCTURALLY from the server field (locale-independent)', () => {
      // The structural field wins over the message text — so a LOCALISED message
      // (no English "Venus" / "ocean" / "oxygen" word) still yields the right
      // label. This is the whole point: never sniff the translatable message.
      const gp = (globalParameter: NonNullable<UnplayableReason['globalParameter']>): UnplayableReason =>
        ({type: 'globalParameter', message: 'локализованный текст без ключевого слова', globalParameter});
      expect(shortBlockerLabel([gp('temperature')])).to.eq('Temperature');
      expect(shortBlockerLabel([gp('venus')])).to.eq('Venus');
      expect(shortBlockerLabel([gp('oceans')])).to.eq('Oceans');
      expect(shortBlockerLabel([gp('oxygen')])).to.eq('Oxygen');
    });

    it('uses the PRIMARY (first) reason for the chip', () => {
      const reasons = [reason('megacredits', 'Need ${0} more M€'), reason('placement', 'No space available for the tile')];
      expect(shortBlockerLabel(reasons)).to.eq('Not enough M€');
    });
  });
});
