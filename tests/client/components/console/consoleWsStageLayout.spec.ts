import {expect} from 'chai';
import {
  WS_STAGE_FOCUS_SCALE, focusHeadroomPx, wsStageLayout, wsStageLayoutStyle,
} from '@/client/console/consoleWsStageLayout';

/**
 * THE EMBEDDED STAGE LAYOUT — the one geometry brain behind the buy pick and
 * the drawn reveal.
 *
 * `fitRowZoom` (its predecessor, still the standalone band's) solved SIZE only
 * and took the gap as a CSS constant, which is how a focused card's ring ended
 * up growing over its neighbour and how a large batch could only ever get
 * smaller. Here the gap is an OUTPUT solved together with the zoom, and the row
 * shape is chosen by measurement. These specs pin the properties the two stages
 * are required to share; a change moves BOTH, which is the point.
 */
describe('wsStageLayout — one geometry for buy and reveal', () => {
  const slot = {slotW: 320, slotH: 460};
  const band = {availW: 1200, availH: 700, ui: 1};

  describe('focus safety', () => {
    it('the gap always clears the focused card\'s own emphasis and ring', () => {
      for (const n of [1, 2, 3, 4, 5, 6]) {
        const l = wsStageLayout({...band, ...slot, n});
        expect(l.gapPx, `n=${n}`).to.be.greaterThanOrEqual(
          focusHeadroomPx(slot.slotW * l.zoom, 1) - 1e-9);
      }
    });

    it('the solved row still FITS its band — the gap is not bought on credit', () => {
      for (const n of [2, 3, 4, 5]) {
        const l = wsStageLayout({...band, ...slot, n});
        const used = l.perRow * slot.slotW * l.zoom + (l.perRow - 1) * l.gapPx;
        expect(used, `n=${n}`).to.be.lessThanOrEqual(band.availW + 1e-6);
      }
    });

    it('the height budget is spent on the CARD — the row padding carries the emphasis', () => {
      // The caller subtracts the row's own padding before handing over
      // `availH`, and that padding is where the focused card's growth (and its
      // pick band) live. Reserving the emphasis here as well was a double
      // count that quietly cost the hero ~4.5 % of its height.
      const l = wsStageLayout({...band, ...slot, n: 1});
      expect(slot.slotH * l.zoom).to.be.closeTo(band.availH, 1e-6);
      // The vertical clearance a focused card actually needs stays small
      // enough for any authored row padding to absorb.
      const grow = slot.slotH * l.zoom * (WS_STAGE_FOCUS_SCALE - 1) / 2;
      expect(grow).to.be.lessThan(20);
    });

    it('the gap never collapses, even on a starved handheld band', () => {
      const l = wsStageLayout({availW: 420, availH: 260, ...slot, n: 4, ui: 0.7});
      expect(l.gapPx).to.be.greaterThan(0);
    });
  });

  describe('adaptive composition', () => {
    it('a lone card gets the biggest hero the band can afford', () => {
      const one = wsStageLayout({...band, ...slot, n: 1});
      const two = wsStageLayout({...band, ...slot, n: 2});
      expect(one.rows).to.eq(1);
      expect(one.perRow).to.eq(1);
      // A wide band is HEIGHT-bound for both, so a lone card is not smaller…
      expect(one.zoom).to.be.greaterThanOrEqual(two.zoom);
      // …and the moment width binds, the lone hero is strictly bigger.
      const narrow = {availW: 760, availH: 900, ui: 1};
      expect(wsStageLayout({...narrow, ...slot, n: 1}).zoom)
        .to.be.greaterThan(wsStageLayout({...narrow, ...slot, n: 2}).zoom);
    });

    it('a small batch stays ONE reading line', () => {
      for (const n of [2, 3, 4]) {
        expect(wsStageLayout({...band, ...slot, n}).rows, `n=${n}`).to.eq(1);
      }
    });

    it('every card in the batch gets the SAME base size', () => {
      // The layout returns one zoom for the whole row on purpose: the only
      // thing that ever differs between two cards on this stage is which one
      // holds the focus, and that is a ring, not a size.
      const l = wsStageLayout({...band, ...slot, n: 3});
      expect(l).to.have.property('zoom');
      expect(Object.keys(l).filter((k) => k.startsWith('zoom'))).to.have.length(1);
    });

    it('wraps only when the second row makes the cards VISIBLY bigger', () => {
      // A wide, short band: a single row of 8 is already width-starved, so
      // wrapping genuinely buys size.
      const wide = wsStageLayout({availW: 900, availH: 900, ...slot, n: 8, ui: 1});
      expect(wide.rows).to.be.greaterThan(1);
      const single = (900 * 0.98) / (8 * 320);
      expect(wide.zoom).to.be.greaterThan(single * 1.18);
    });

    it('does not wrap a batch a single row serves well', () => {
      expect(wsStageLayout({availW: 2400, availH: 900, ...slot, n: 4, ui: 1}).rows).to.eq(1);
    });

    it('rows × perRow always covers the batch', () => {
      for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        const l = wsStageLayout({...band, ...slot, n});
        expect(l.rows * l.perRow, `n=${n}`).to.be.greaterThanOrEqual(n);
      }
    });
  });

  describe('profile scaling', () => {
    it('the CAP rides the TV rem factor', () => {
      const tv = wsStageLayout({availW: 8000, availH: 8000, ...slot, n: 1, ui: 2});
      expect(tv.zoom).to.eq(3.8); // 1.9 × ui
    });

    it('THE SOLVED SHAPE ALWAYS FITS — a card is never clipped, at any size', () => {
      // There is deliberately no floor. A floor is a readability courtesy, and
      // `shapeZoom` already returns the largest zoom that FITS — so raising a
      // result to one is by definition asking for a card that does not. That
      // shipped: a seven-card reveal at 4K solved three rows whose raw zoom was
      // under the old floor, got clamped UP to it, out-scored the feasible
      // two-row shape, and rendered cut off at the top AND bottom with nothing
      // to scroll to. Small honest cards beat cropped ones every time.
      //
      // Swept rather than sampled: this is the guarantee the whole engine
      // exists to make, and it has to hold for a starved Steam Deck band and a
      // 4K one alike.
      for (const ui of [1, 2]) {
        for (const availW of [120, 640, 1200, 1650, 2400, 3200]) {
          for (const availH of [80, 300, 560, 700, 1100, 1500]) {
            for (const n of [1, 2, 3, 5, 7, 9, 12]) {
              const l = wsStageLayout({availW, availH, ...slot, n, ui});
              const where = `ui=${ui} ${availW}x${availH} n=${n}`;
              const usedH = l.rows * slot.slotH * l.zoom + (l.rows - 1) * l.rowGapPx;
              const usedW = l.perRow * slot.slotW * l.zoom + (l.perRow - 1) * l.gapPx;
              expect(usedH, `height ${where}`).to.be.lessThanOrEqual(availH + 0.5);
              expect(usedW, `width ${where}`).to.be.lessThanOrEqual(availW + 0.5);
              expect(l.rows * l.perRow, `capacity ${where}`).to.be.greaterThanOrEqual(n);
            }
          }
        }
      }
    });

    it('a 4K band yields a bigger card than a 1080p one for the same batch', () => {
      const fhd = wsStageLayout({availW: 1200, availH: 700, ...slot, n: 2, ui: 1});
      const tv = wsStageLayout({availW: 2400, availH: 1400, ...slot, n: 2, ui: 2});
      expect(tv.zoom).to.be.greaterThan(fhd.zoom);
    });
  });

  describe('the WRAP CAP — a solved shape must be the shape that renders', () => {
    it('a multi-row shape publishes the exact planned row width (incl. the padding)', () => {
      // A TALL band: seven cards wrap to 4+3, and the solved row is far
      // narrower than the band — which is precisely when `flex-wrap` would
      // otherwise fit five on the first line and orphan two.
      const l = wsStageLayout({availW: 1400, availH: 900, ...slot, n: 7, ui: 1, padXPx: 26});
      expect(l.rows, 'seven cards in a tall band wrap').to.eq(2);
      expect(l.perRow).to.eq(4);
      expect(l.rowMaxPx, 'the cap is narrower than the band it must break inside')
        .to.be.lessThan(1400);
      const expected = l.perRow * slot.slotW * l.zoom + (l.perRow - 1) * l.gapPx + 26;
      expect(l.rowMaxPx).to.be.closeTo(expected, 0.01);
      expect(wsStageLayoutStyle(l)['--con-ws-stage-rowmax']).to.eq(`${expected.toFixed(2)}px`);
    });

    it('a SINGLE row is never capped — there is nothing to break', () => {
      const l = wsStageLayout({availW: 1400, availH: 420, ...slot, n: 2, ui: 1, padXPx: 26});
      expect(l.rows).to.eq(1);
      expect(wsStageLayoutStyle(l)['--con-ws-stage-rowmax']).to.eq('100%');
    });

    it('a caller that passes NO padding keeps the historical uncapped row', () => {
      const l = wsStageLayout({availW: 1400, availH: 900, ...slot, n: 7, ui: 1});
      expect(l.rowMaxPx).to.eq(undefined);
      expect(wsStageLayoutStyle(l)['--con-ws-stage-rowmax']).to.eq('100%');
    });
  });

  describe('the published contract', () => {
    it('is ONE writer — both hosts apply the same custom properties', () => {
      const style = wsStageLayoutStyle(wsStageLayout({...band, ...slot, n: 3}));
      expect(Object.keys(style).sort()).to.deep.eq([
        '--con-cards-zoom',
        '--con-ws-focus-scale',
        '--con-ws-stage-gap',
        '--con-ws-stage-per-row',
        '--con-ws-stage-rowgap',
        '--con-ws-stage-rowmax',
      ]);
    });

    it('publishes the focus scale the layout actually reserved room for', () => {
      // The LESS reads this; if the two ever disagree the reserved headroom
      // stops matching the emphasis and the row re-flows on focus.
      const style = wsStageLayoutStyle(wsStageLayout({...band, ...slot, n: 2}));
      expect(style['--con-ws-focus-scale']).to.eq(`${WS_STAGE_FOCUS_SCALE}`);
    });
  });
});
