import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {DECK_CHECK_PEEL_DY, deckPeelDy} from '../../src/client/console/deckDraw/deckPeel';

/**
 * PL-089 — THE PEEL OFF THE HUD DECK GOES DOWN. The pile sits on the screen's
 * top edge; a card that separates UPWARD leaves the screen (≈ 10.7 px on fhd).
 * The owner's decision (2026-10-07): every flight off `.con-deckstack__pile`
 * separates DOWN, into the screen, through ONE helper — the scanner below
 * fails with the file that rolls its own lift.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const DIRECTORS = [
  'src/client/console/deckDraw/deckDrawDirector.ts',
  'src/client/console/consoleBatchArrivalMotion.ts',
  'src/client/console/consoleActionRevealMotion.ts',
];

describe('deckPeel (PL-089)', () => {
  it('the separation is always DOWN (positive screen y), and grows with the pile\'s scale', () => {
    for (const scale of [0.02, 0.06, 0.1, 0.3]) {
      expect(deckPeelDy(scale), `scale ${scale}`).greaterThan(0);
    }
    expect(deckPeelDy(0.3)).greaterThan(deckPeelDy(0.06));
    expect(DECK_CHECK_PEEL_DY).greaterThan(0);
  });

  it('every flight off the HUD deck peels through the helper — no director lifts a card UP on its own', () => {
    for (const file of DIRECTORS) {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect(src, `${file} imports the one peel`).to.match(/from '[^']*deckPeel'/);
      expect(/Cy - 10 - 14 \* startScale/.test(src), `${file} rolls an UPWARD peel of its own`).eq(false);
      expect(/y: `-=\$\{12\}`/.test(src), `${file} lifts the deck check UP`).eq(false);
    }
  });
});
