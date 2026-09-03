import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE CARD-STATUS CONTRACT — two lock-step guards over the stylesheets.
 *
 * 1 · ONE-ROW STATUS RAIL (`--con-cardstatus-h`). Every card-selection /
 *     card-browsing status rail (the start wizard's rail, the draft
 *     workspace's status bar, the hand's verdict bar) reserves ONE fixed
 *     height — the shared token — and never grows with content. The bug this
 *     pins down: the start rail used to carry a taller «avail» variant
 *     (`--con-start-rail-avail-h`, a TWO-ROW zone), so a step with a long
 *     requirement re-laid the whole card scene out and the interface jumped
 *     when focus moved between cards. The taller variant is deleted; a rail
 *     that wants to say more speaks the COMPACT counter form
 *     (`unplayableReasonCompact`) and leaves the full sentence to the
 *     fullscreen panel.
 *
 * 2 · CHIP ZOOM PARITY. The hand grid's blocker chip (`.con-hand__chip`) and
 *     its flying twin on the reveal bodies (`.con-deal-proxy__chip`) must
 *     counter-zoom by the SAME law (`<emphasis> / var(--con-hand-zoom)`), or
 *     the plate changes size the moment the card starts moving. The bug this
 *     pins down: the proxy chip rode a `--reveal-chip-zoom` var that nothing
 *     ever set, fell back to zoom 1 inside a natural-size card, and rendered
 *     up to ~3× too big for the whole animation on a TV showcase page. The
 *     director stamps `--con-hand-zoom` per body (`revealChipHandZoom`), and
 *     the two selectors here must keep byte-identical formulas per profile.
 *
 * These are TEXT guards over LESS on purpose (the glyph-literal-guard
 * precedent): the drift they catch is exactly a constant edited in one of
 * the paired places. If you change a law, change its pair AND this spec in
 * the same diff.
 */

const ROOT = path.join(__dirname, '..', '..');
const read = (...p: Array<string>) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

describe('card-status contract (stylesheet lock-step guards)', () => {
  const consoleLess = read('src', 'styles', 'console.less');
  const tvLess = read('src', 'styles', 'console_tv.less');
  const dealLess = read('src', 'styles', 'console_card_deal.less');

  it('the shared one-row height token exists and every status rail rides it', () => {
    expect(consoleLess, 'base token declared').to.contain('--con-cardstatus-h: 2.6rem');
    expect(consoleLess, 'start rail rides the token').to.contain('--con-start-rail-h: var(--con-cardstatus-h');
    expect(consoleLess, 'draft status bar rides the token').to.contain('--con-draftws-status-h: var(--con-cardstatus-h');
    expect(consoleLess, 'the verdict bar is a FIXED height, not a min').to.contain('height: var(--con-cardstatus-h');
    expect(tvLess, 'the couch profile overrides the TOKEN, never a surface').to.contain('--con-cardstatus-h: 3rem');
    expect(consoleLess, 'the Deck profile overrides the TOKEN too').to.contain('--con-cardstatus-h: 2rem');
  });

  it('the two-row «avail» rail variant stays deleted — no second height for any context', () => {
    const styles = fs.readdirSync(path.join(ROOT, 'src', 'styles'))
      .filter((f) => f.endsWith('.less'))
      .map((f) => ({f, src: read('src', 'styles', f)}));
    for (const {f, src} of styles) {
      expect(src, `${f} must not resurrect the two-row rail`).to.not.contain('--con-start-rail-avail-h');
      // A literal re-statement of either alias silently un-shares the token.
      expect(src.match(/--con-start-rail-h:\s*[\d.]+rem/), `${f}: --con-start-rail-h must ride the token, not a literal`).to.eq(null);
      expect(src.match(/--con-draftws-status-h:\s*[\d.]+rem/), `${f}: --con-draftws-status-h must ride the token, not a literal`).to.eq(null);
    }
  });

  it('the hand chip and the flying proxy chip counter-zoom by the SAME base law', () => {
    const LAW = '0.99 / var(--con-hand-zoom, 0.66)';
    expect(consoleLess, '.con-hand__chip base law').to.contain(LAW);
    expect(dealLess, '.con-deal-proxy__chip must repeat it exactly').to.contain(LAW);
    expect(dealLess, 'the never-set --reveal-chip-zoom var stays deleted').to.not.contain('var(--reveal-chip-zoom');
  });

  it('…and by the SAME couch law on the TV profile (hand + proxy, lock-step)', () => {
    const LAW = '1.2 / var(--con-hand-zoom, 0.66)';
    const count = tvLess.split(LAW).length - 1;
    expect(count, 'exactly the hand chip and its proxy twin carry the couch law').to.eq(2);
  });

  it('…and the Deck ladder sizes both chips with ONE font (slot .65rem ⇒ proxy .65rem)', () => {
    // The handheld ladder shrinks the slot chip's type; the flying twin must
    // follow or the chip pops ~10% at every handoff (shipped exactly so).
    expect(consoleLess, 'the Deck slot chip density').to.contain('&__chip { font-size: .65rem; }');
    expect(consoleLess, 'the Deck proxy twin follows it').to.contain('.con-deal-proxy__chip { font-size: .65rem; }');
  });
});
