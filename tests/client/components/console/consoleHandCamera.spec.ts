import {expect} from 'chai';
import {solveCameraShot, CameraBox} from '@/client/console/consoleHandStageMotion';

/**
 * THE CAMERA SOLVE — the heart of the hand → play transition.
 *
 * The chosen card is not flown to the play anchor; the whole browse layer is
 * transformed so the card COMES TO REST on it. That makes the solve the one
 * thing the transition cannot get wrong, and it has exactly one classic bug:
 * pivoting the scale on the layer's centre instead of on the card, which makes
 * the translate depend on the scale and lands the card off by the grid's own
 * offset — visibly «almost right», which is worse than obviously broken.
 *
 * So these tests assert the CONTRACT, by applying the solved transform the way
 * the browser would and checking where the card ends up.
 */

/** Apply `scale` about `origin` (layer-local), then translate — CSS order. */
function project(layer: CameraBox, card: CameraBox, shot: {x: number, y: number, scale: number, origin: string}): CameraBox {
  const [ox, oy] = shot.origin.split(' ').map((v) => Number.parseFloat(v));
  // The origin in viewport space.
  const px = layer.left + ox;
  const py = layer.top + oy;
  const left = px + (card.left - px) * shot.scale + shot.x;
  const top = py + (card.top - py) * shot.scale + shot.y;
  return {left, top, width: card.width * shot.scale, height: card.height * shot.scale};
}

const LAYER: CameraBox = {left: 240, top: 100, width: 1600, height: 820};
/** The play stage's hero anchor — always the same place, whatever was picked. */
const ANCHOR: CameraBox = {left: 300, top: 300, width: 320, height: 460};

describe('hand → play CAMERA solve', () => {
  it('lands the chosen card exactly on the anchor', () => {
    const card: CameraBox = {left: 400, top: 200, width: 160, height: 230};
    const shot = solveCameraShot(LAYER, card, ANCHOR);
    expect(shot).to.not.eq(undefined);
    const landed = project(LAYER, card, shot!);
    expect(landed.left).to.be.closeTo(ANCHOR.left, 0.5);
    expect(landed.top).to.be.closeTo(ANCHOR.top, 0.5);
    expect(landed.width).to.be.closeTo(ANCHOR.width, 0.5);
    expect(landed.height).to.be.closeTo(ANCHOR.height, 0.5);
  });

  /**
   * THE REASON THIS TRANSITION EXISTS. A card at the far right of the grid must
   * land as precisely as one at the far left — and the ONLY thing that may
   * differ between them is how far the layer travels, never whether the card
   * arrives. A per-card flight got worse the further right the card sat; this
   * has to be provably uniform.
   */
  it('lands EVERY grid position on the same anchor — first, last, top, bottom', () => {
    const positions: ReadonlyArray<CameraBox> = [
      {left: 300, top: 140, width: 160, height: 230},   // top-left
      {left: 1640, top: 140, width: 160, height: 230},  // top-FAR-RIGHT
      {left: 300, top: 640, width: 160, height: 230},   // bottom-left
      {left: 1640, top: 640, width: 160, height: 230},  // bottom-far-right
    ];
    for (const card of positions) {
      const landed = project(LAYER, card, solveCameraShot(LAYER, card, ANCHOR)!);
      expect(landed.left, `left for ${card.left}/${card.top}`).to.be.closeTo(ANCHOR.left, 0.5);
      expect(landed.top, `top for ${card.left}/${card.top}`).to.be.closeTo(ANCHOR.top, 0.5);
      expect(landed.width, `width for ${card.left}/${card.top}`).to.be.closeTo(ANCHOR.width, 0.5);
    }
  });

  it('pivots on the CARD, not on the layer — the origin is the card centre, layer-local', () => {
    const card: CameraBox = {left: 1640, top: 640, width: 160, height: 230};
    const shot = solveCameraShot(LAYER, card, ANCHOR)!;
    const [ox, oy] = shot.origin.split(' ').map((v) => Number.parseFloat(v));
    expect(ox).to.be.closeTo(card.left + card.width / 2 - LAYER.left, 0.2);
    expect(oy).to.be.closeTo(card.top + card.height / 2 - LAYER.top, 0.2);
  });

  it('the scale is the pure size ratio — the card grows into the anchor, never past it', () => {
    const card: CameraBox = {left: 500, top: 300, width: 160, height: 230};
    expect(solveCameraShot(LAYER, card, ANCHOR)!.scale).to.be.closeTo(320 / 160, 0.001);
  });

  /** Unusable geometry must yield NOTHING, so the caller degrades to a plain
   *  open rather than flinging the layer somewhere arbitrary. */
  it('refuses to solve on degenerate geometry', () => {
    const card: CameraBox = {left: 500, top: 300, width: 160, height: 230};
    expect(solveCameraShot({left: 0, top: 0, width: 0, height: 0}, card, ANCHOR)).to.eq(undefined);
    expect(solveCameraShot(LAYER, {left: 0, top: 0, width: 0, height: 0}, ANCHOR)).to.eq(undefined);
    expect(solveCameraShot(LAYER, card, {left: 0, top: 0, width: 0, height: 0})).to.eq(undefined);
  });

  /** B replays the SAME shot in reverse, so the card must be able to go home
   *  from the anchor to its own slot with the inverse of what brought it. */
  it('is reversible — the anchor maps back onto the slot it came from', () => {
    const card: CameraBox = {left: 1400, top: 520, width: 160, height: 230};
    const shot = solveCameraShot(LAYER, card, ANCHOR)!;
    // Going home is the layer returning to identity: the card, drawn at its own
    // untransformed rect, is exactly where it started.
    const home = project(LAYER, card, {x: 0, y: 0, scale: 1, origin: shot.origin});
    expect(home.left).to.be.closeTo(card.left, 0.001);
    expect(home.top).to.be.closeTo(card.top, 0.001);
    expect(home.width).to.be.closeTo(card.width, 0.001);
  });
});
