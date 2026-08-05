import {expect} from 'chai';
import {gsap} from 'gsap';
import {
  CARD3D_CLASS, CARD3D_OUTER_CLASS, FACE_DOWN_DEG, FACE_UP_DEG,
  addCard3DTurn, buildCard3DInner, card3DFlipDeg, card3DIsFaceUp, readCard3DInner,
  setCard3DFace,
} from '@/client/console/cardFlight/card3dInner';

type Rec = {target: unknown, vars: Record<string, unknown>, at: number | string | undefined};

/** A recording stand-in for the caller's flight timeline. */
function recorder() {
  const tos: Array<Rec> = [];
  const calls: Array<{at: number | string}> = [];
  return {
    tos,
    calls,
    tl: {
      to(target: object, vars: object, position?: number | string) {
        tos.push({target, vars: vars as Record<string, unknown>, at: position});
        return undefined;
      },
      call(cb: () => void, _p: undefined, position: number | string) {
        calls.push({at: position});
        cb();
        return undefined;
      },
    },
  };
}

function outer(): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

/**
 * Card3DInner — the physical card body. The artefact it removes: a "flip"
 * that is really one image being replaced by another. Two structural things
 * make it a real object instead — both sides existing at once, and a parent
 * that projects the rotation — so both are asserted here.
 */
describe('Card3DInner — the physical card body', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts BOTH sides at once — a face is never swapped in mid-turn', () => {
    const card = buildCard3DInner(outer(), {faceUp: true});
    expect(card.face).to.not.eq(undefined);
    expect(card.back).to.not.eq(undefined);
    expect(card.outer.querySelectorAll('.con-card3d__face').length).to.eq(1);
    expect(card.outer.querySelectorAll('.con-card3d__back').length).to.eq(1);
    // Both are in the DOM simultaneously, in the same parent, from birth.
    expect(card.face.parentElement).to.eq(card.inner);
    expect(card.back.parentElement).to.eq(card.inner);
    // …and the back really carries card-back art, not an empty placeholder.
    expect(card.back.querySelector('.con-card-back')).to.not.eq(null);
  });

  it('keeps the shared chassis class names, so every shared face rule applies', () => {
    const card = buildCard3DInner(outer(), {faceUp: true});
    expect(card.inner.classList.contains(CARD3D_CLASS)).to.eq(true);
    expect(card.inner.classList.contains('con-deal-proxy__flip')).to.eq(true);
    expect(card.face.classList.contains('con-deal-proxy__face')).to.eq(true);
    expect(card.back.classList.contains('con-deal-proxy__back')).to.eq(true);
  });

  /** The perspective owner is the OUTER; without it the rotation is
   *  orthographic and reads exactly like a picture swap. */
  it('marks the outer as the perspective owner and keeps the host classes', () => {
    const el = outer();
    el.classList.add('con-startdock-proxy');
    const card = buildCard3DInner(el, {faceUp: true, outerClass: 'extra-class'});
    expect(card.outer.classList.contains(CARD3D_OUTER_CLASS)).to.eq(true);
    expect(card.outer.classList.contains('con-startdock-proxy')).to.eq(true);
    expect(card.outer.classList.contains('extra-class')).to.eq(true);
  });

  it('has a real edge plane (a turning card is never a vanishing line)', () => {
    const card = buildCard3DInner(outer(), {faceUp: true});
    expect(card.edge).to.not.eq(undefined);
    expect(card.edge?.classList.contains('con-card3d__edge')).to.eq(true);
    const noEdge = buildCard3DInner(outer(), {faceUp: true, edge: false});
    expect(noEdge.edge).to.eq(undefined);
  });

  it('is born on the requested side and can be re-faced without motion', () => {
    const up = buildCard3DInner(outer(), {faceUp: true});
    expect(card3DFlipDeg(up)).to.eq(FACE_UP_DEG);
    expect(card3DIsFaceUp(up)).to.eq(true);
    const down = buildCard3DInner(outer(), {faceUp: false});
    expect(card3DFlipDeg(down)).to.eq(FACE_DOWN_DEG);
    expect(card3DIsFaceUp(down)).to.eq(false);
    setCard3DFace(down, true);
    expect(card3DIsFaceUp(down)).to.eq(true);
  });

  it('reads an existing chassis (a Vue-rendered flyer upgrades in place)', () => {
    const el = outer();
    el.innerHTML =
      '<div class="con-deal-proxy__flip">' +
        '<div class="con-deal-proxy__face"></div>' +
        '<div class="con-deal-proxy__back"></div>' +
      '</div>';
    const card = readCard3DInner(el);
    expect(card).to.not.eq(undefined);
    expect(card?.face.classList.contains('con-deal-proxy__face')).to.eq(true);
    expect(readCard3DInner(document.createElement('div'))).to.eq(undefined);
  });

  describe('the turn', () => {
    it('drives rotationY to the requested side — never an opacity on the body', () => {
      const card = buildCard3DInner(outer(), {faceUp: true});
      const r = recorder();
      addCard3DTurn(r.tl, {card, at: 0.2, dur: 0.4, to: FACE_DOWN_DEG});
      const onInner = r.tos.filter((t) => t.target === card.inner);
      const turn = onInner.find((t) => t.vars['rotationY'] !== undefined);
      expect(turn, 'a rotationY tween').to.not.eq(undefined);
      expect(turn?.vars['rotationY']).to.eq(FACE_DOWN_DEG);
      expect(turn?.at).to.eq(0.2);
      // ⚠️ opacity on a preserve-3d element forces `flat` and shows a MIRROR
      // of the face instead of the back. It must never appear here.
      for (const t of onInner) {
        expect(t.vars['opacity'], 'opacity on the 3D body').to.eq(undefined);
        expect(t.vars['autoAlpha'], 'autoAlpha on the 3D body').to.eq(undefined);
      }
    });

    it('gives the turn volume: a forward pitch and a depth push', () => {
      const card = buildCard3DInner(outer(), {faceUp: false});
      const r = recorder();
      addCard3DTurn(r.tl, {card, at: 0, dur: 0.5, to: FACE_UP_DEG});
      const onInner = r.tos.filter((t) => t.target === card.inner);
      expect(onInner.some((t) => Number(t.vars['rotationX']) < 0), 'pitch').to.eq(true);
      expect(onInner.some((t) => Number(t.vars['z']) > 0), 'depth push').to.eq(true);
      // …and both return to rest, so nothing accumulates across turns.
      expect(onInner.some((t) => t.vars['rotationX'] === 0)).to.eq(true);
      expect(onInner.some((t) => t.vars['z'] === 0)).to.eq(true);
    });

    it('shows the edge only while the card is passing through its own plane', () => {
      const card = buildCard3DInner(outer(), {faceUp: true});
      const r = recorder();
      addCard3DTurn(r.tl, {card, at: 0, dur: 1, to: FACE_DOWN_DEG});
      const edgeTweens = r.tos.filter((t) => t.target === card.edge);
      expect(edgeTweens.length).to.eq(2);
      expect(edgeTweens[0].vars['opacity']).to.eq(1);
      expect(edgeTweens[1].vars['opacity']).to.eq(0);
      // In before the crossing, out before the landing.
      expect(Number(edgeTweens[0].at)).to.be.lessThan(0.5);
      expect(Number(edgeTweens[1].at)).to.be.greaterThan(0.5);
      expect(Number(edgeTweens[1].at)).to.be.lessThan(1);
    });

    it('announces the crossing once, at the first readable frame', () => {
      const card = buildCard3DInner(outer(), {faceUp: false});
      let crossed = 0;
      const r = recorder();
      addCard3DTurn(r.tl, {
        card, at: 0, dur: 1, to: FACE_UP_DEG,
        glintClass: 'test-glint', onSideCrossed: () => crossed++,
      });
      expect(crossed).to.eq(1);
      expect(card.outer.classList.contains('test-glint')).to.eq(true);
      expect(r.calls.length).to.eq(1);
      expect(Number(r.calls[0].at)).to.be.greaterThan(0.3);
      expect(Number(r.calls[0].at)).to.be.lessThan(0.7);
    });

    it('does NOT paint a glint when the card is turning face DOWN', () => {
      const card = buildCard3DInner(outer(), {faceUp: true});
      const r = recorder();
      addCard3DTurn(r.tl, {card, at: 0, dur: 1, to: FACE_DOWN_DEG, glintClass: 'test-glint'});
      expect(card.outer.classList.contains('test-glint')).to.eq(false);
    });

    /**
     * REDUCED MOTION removes flourish, never causality: the card still TURNS
     * (an instant set would be the face swap this primitive exists to kill),
     * it just loses the pitch and the depth push.
     */
    it('reduced motion keeps the turn and drops only the flourish', () => {
      const card = buildCard3DInner(outer(), {faceUp: true});
      const r = recorder();
      addCard3DTurn(r.tl, {card, at: 0, dur: 0.2, to: FACE_DOWN_DEG, reduced: true});
      const onInner = r.tos.filter((t) => t.target === card.inner);
      expect(onInner.some((t) => t.vars['rotationY'] === FACE_DOWN_DEG), 'still turns').to.eq(true);
      expect(onInner.some((t) => t.vars['rotationX'] !== undefined), 'no pitch').to.eq(false);
      expect(onInner.some((t) => t.vars['z'] !== undefined), 'no push').to.eq(false);
      // The edge still reads — it is geometry, not motion.
      expect(r.tos.some((t) => t.target === card.edge)).to.eq(true);
    });

    it('is a no-op when the card is already on the requested side', () => {
      const card = buildCard3DInner(outer(), {faceUp: true});
      const r = recorder();
      addCard3DTurn(r.tl, {card, at: 0, dur: 0.4, to: FACE_UP_DEG});
      expect(r.tos.length).to.eq(0);
      expect(r.calls.length).to.eq(0);
    });

    it('turns from the side the card is actually on (no assumed start)', () => {
      const card = buildCard3DInner(outer(), {faceUp: true});
      gsap.set(card.inner, {rotationY: FACE_DOWN_DEG});
      const r = recorder();
      addCard3DTurn(r.tl, {card, at: 0, dur: 0.4, to: FACE_UP_DEG});
      expect(r.tos.some((t) => t.vars['rotationY'] === FACE_UP_DEG)).to.eq(true);
    });
  });
});
