import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE RESULT OUTLIVES ITS SURFACE (PL-212) — the deck pick lets go of its workspace on the kept card's LIFT and the
 * cards left behind leaving, NEVER on the intake's end: the card flies to the dock in the app-level delivery layer
 * while the workspace folds.
 *
 * This is the STRUCTURE of the claim, pinned at its source. The e2e (`console-research-startups` C) used to read it as
 * an ORDER of two motions on two clocks — «the workspace was gone while the card was still in the air»: the rest's
 * tumble ends on a CSS `animationend`, the card's arc on a GSAP timeline, and on a 4K software-rasterized frame of
 * ~300 ms the tumble's end came 1.25 s after the lift against the arc's 0.9 s (CI hunt 44905308724, 3 of 30) — the
 * renderer's speed, never the product's. Nominally the tumble ends ≈ 0.3 s after the lift, the card lands ≈ 0.65 s
 * after it (motion ×0.5).
 */
describe('deck pick — the surface lets go on the lift, never on the intake\'s end (PL-212)', () => {
  const SFC = path.resolve('src/client/components/console/deckPick/ConsoleDeckPick.vue');
  const raw = fs.readFileSync(SFC, 'utf8').replace(/\r\n/g, '\n');
  const outgoing = raw.slice(raw.indexOf('async function runOutgoing('), raw.indexOf('function endOutgoing('));

  it('reads the commit (anti-vacuous)', () => {
    expect(outgoing.length, 'runOutgoing was found').to.be.greaterThan(500);
  });

  it('the release waits for the LIFT and the rest leaving — the intake runs on, awaited by nobody here', () => {
    expect(outgoing).to.include('await lifted;');
    expect(outgoing, 'the cards left behind leave before the surface lets go').to.include('await startClearing(0);');
    expect(outgoing, 'the intake is the dock\'s: never awaited by the surface').to.not.match(/await\s+intake\b/);
    expect(outgoing, 'its rejection handled, never an unhandled one').to.include('intake.catch(() => undefined);');
    // The lift is the intake's staging seam (`onStaged`), or the intake's own end when nothing lifts.
    expect(outgoing).to.include('const intake = sendToHand(kept, () => {');
    expect(outgoing).to.include('markLifted();');
  });
});
