import {expect} from 'chai';
import {clampScaleTooltipPosition, TooltipSafeZones} from '@/client/components/board/scaleTooltipState';

/**
 * Pure unit tests for the unified scale-HUD tooltip clamp — the load-bearing
 * "never spills under the bottom toolbar / behind the sidebars" guarantee. No
 * DOM needed (runs under the server runner).
 */
describe('clampScaleTooltipPosition', () => {
  // A roomy 1280×800 viewport with a 36px bottom bar (+16 pad) and a 62px right
  // sidebar — mirrors the live CSS-var fallbacks.
  const zones: TooltipSafeZones = {top: 12, bottom: 800 - 52, left: 8, right: 1280 - 62 - 8};
  const W = 220;
  const H = 84;

  function anchorAt(cx: number, top: number, h = 18): {left: number; top: number; bottom: number; width: number} {
    return {left: cx - 9, top, bottom: top + h, width: 18};
  }

  it('places the tooltip ABOVE an anchor with room above', () => {
    const a = anchorAt(640, 400);
    const p = clampScaleTooltipPosition(a, W, H, zones);
    // top = anchor.top - gap(10) - H(84) = 400 - 94 = 306
    expect(p.top).to.eq(306);
    // centred: left = cx - W/2 = 640 - 110 = 530
    expect(p.left).to.eq(530);
  });

  it('drops BELOW when there is no room above (near the viewport top)', () => {
    const a = anchorAt(640, 14, 18); // anchor.top 14 → above would be -80 < top(12)
    const p = clampScaleTooltipPosition(a, W, H, zones);
    // below = anchor.bottom(32) + gap(10) = 42, fits (42+84 <= 748)
    expect(p.top).to.eq(42);
  });

  it('NEVER lets the box cross the bottom safe line (the bottom toolbar)', () => {
    // A bottom-of-planet anchor (ocean scale) sits low; the tooltip must stay
    // fully above the bottom safe line, not slide under the toolbar.
    const a = anchorAt(640, 740, 18);
    const p = clampScaleTooltipPosition(a, W, H, zones);
    expect(p.top + H).to.be.at.most(zones.bottom);
    // With room above (740-94=646 ≥ top), it goes above.
    expect(p.top).to.eq(646);
  });

  it('clamps horizontally so it never spills behind the right sidebar', () => {
    const a = anchorAt(1200, 400); // far right, near the temperature scale
    const p = clampScaleTooltipPosition(a, W, H, zones);
    const right = p.left + W;
    expect(right).to.be.at.most(zones.right - 8 + 1); // within the safe band (+margin rounding)
  });

  it('clamps horizontally so it never spills past the left safe line', () => {
    const zonesL: TooltipSafeZones = {...zones, left: 160}; // left panel present
    const a = anchorAt(180, 400);
    const p = clampScaleTooltipPosition(a, W, H, zonesL);
    expect(p.left).to.be.at.least(zonesL.left + 8 - 1);
  });

  it('keeps the final top within [top, bottom-height] even when neither side fits cleanly', () => {
    // Degenerate tall tooltip in a short safe band.
    const tight: TooltipSafeZones = {top: 12, bottom: 120, left: 8, right: 1272};
    const a = anchorAt(640, 60, 18);
    const p = clampScaleTooltipPosition(a, W, 200, tight);
    expect(p.top).to.be.at.least(tight.top);
  });
});
