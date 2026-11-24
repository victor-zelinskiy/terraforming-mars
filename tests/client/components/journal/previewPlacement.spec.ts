import {expect} from 'chai';
import {PREVIEW_GAP, PREVIEW_VIEWPORT_MARGIN, previewPlacement} from '@/client/components/journal/previewPlacement';

/*
 * WHERE A HOVER PREVIEW STANDS (`previewPlacement.ts`): beside the chip that raised it, by the size the preview REALLY
 * has. The first walk of the journal's chips under a pointer (FREEZE ZERO, stage 4 — `console-journal-chips.spec.ts`)
 * found the colony's preview 150 px above its name: placed by two constants its tile had outgrown.
 */
describe('previewPlacement — a hover preview stands beside its chip, by its measured box', () => {
  const VIEW = {width: 1280, height: 720};
  const chip = (left: number, top: number, width = 72, height = 22) => ({left, right: left + width, top, height});

  it('left of the chip, a gap away, centred on the chip\'s line — whatever the size', () => {
    for (const size of [{width: 155, height: 118}, {width: 240, height: 336}, {width: 300, height: 122}]) {
      // (A chip in the middle of the screen: no edge holds the preview.)
      const anchor = chip(1040, 349);
      const at = previewPlacement(anchor, size, VIEW);
      expect(at.left + size.width, `the right edge is a gap from the chip (${size.width}×${size.height})`).eq(anchor.left - PREVIEW_GAP);
      expect(at.top + size.height / 2, 'centred on the chip\'s line').closeTo(anchor.top + anchor.height / 2, 1);
    }
  });

  it('the size it is given is the size it places: an assumed 286 × 360 for a 155 × 118 tile stood 120 px off its line', () => {
    const anchor = chip(1040, 551);
    const real = {width: 155, height: 118};
    const assumed = previewPlacement(anchor, {width: 286, height: 360}, VIEW);
    const measured = previewPlacement(anchor, real, VIEW);
    expect(measured.top - assumed.top, 'the box placed by the stale size starts far above').greaterThan(100);
    expect(measured.left - assumed.left, '…and far to the left').eq(286 - 155);
  });

  it('no room on the left: the preview flips to the right of the chip', () => {
    const anchor = chip(60, 300);
    const at = previewPlacement(anchor, {width: 240, height: 200}, VIEW);
    expect(at.left).eq(anchor.right + PREVIEW_GAP);
  });

  it('a chip near the top or the bottom: the preview is held inside the screen, never cut', () => {
    const size = {width: 240, height: 336};
    expect(previewPlacement(chip(1040, 20), size, VIEW).top).eq(PREVIEW_VIEWPORT_MARGIN);
    expect(previewPlacement(chip(1040, 700), size, VIEW).top).eq(VIEW.height - size.height - PREVIEW_VIEWPORT_MARGIN);
  });

  it('a preview wider than the room on either side still lies inside the screen', () => {
    const at = previewPlacement(chip(1200, 300), {width: 400, height: 100}, {width: 480, height: 720});
    expect(at.left).eq(480 - 400 - PREVIEW_VIEWPORT_MARGIN);
  });
});
