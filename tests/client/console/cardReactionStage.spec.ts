import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  cardReactionState, dropWarmReactors, registerCardReactionStage, seatReactor, unseatAllReactors, warmReactorFaces,
} from '@/client/console/cardReaction/cardReactionStage';

/**
 * A RISE STARTS ON A PAINTED FACE (iteration 3 — the Steam Deck's one-frame rise): the faces a chain will rise are
 * WARMED at the seed — mounted hidden in the layer — and the rise TAKES THE WARM FACE OVER with the same key, so the
 * element the browser already laid out is the one that tweens; a face nobody rose is dropped when the chain ends.
 */
describe('cardReactionStage — warm faces and their take-over', () => {
  const els = new Map<string, HTMLElement>();
  let unregister: (() => void) | undefined;
  const seat = {left: 100, top: 100, width: 320, height: 460};

  beforeEach(() => {
    unregister = registerCardReactionStage({
      faceEl: (key) => {
        if (!els.has(key)) {
          const el = document.createElement('div');
          el.setAttribute('data-key', key);
          document.body.appendChild(el);
          els.set(key, el);
        }
        return els.get(key) ?? null;
      },
      stageRect: () => ({left: 0, top: 0, width: 1920, height: 1080}),
    });
  });
  afterEach(() => {
    unregister?.();
    unseatAllReactors();
    els.forEach((el) => el.remove());
    els.clear();
  });

  it('warms a face once per card, hidden; the rise takes it over under the SAME key (no remount); the rest are dropped', async () => {
    warmReactorFaces([{name: CardName.THARSIS_REPUBLIC}, {name: CardName.PETS}], seat);
    warmReactorFaces([{name: CardName.THARSIS_REPUBLIC}], seat);
    expect(cardReactionState.faces.filter((f) => f.warm === true).map((f) => f.name)).deep.eq([CardName.THARSIS_REPUBLIC, CardName.PETS]);
    const warmKey = cardReactionState.faces.find((f) => f.name === CardName.THARSIS_REPUBLIC)?.key;
    expect(warmKey).to.match(/^warm:/);

    const seated = await seatReactor({key: 'live:1', name: CardName.THARSIS_REPUBLIC, seat: {...seat, left: 700}});
    expect(seated?.key, 'the warm face is taken over, its key kept').eq(warmKey);
    const face = cardReactionState.faces.find((f) => f.key === warmKey);
    expect(face?.warm, 'no longer warm').is.false;
    expect(face?.seat.left, 'the seat is the rise\'s').eq(700);
    expect(cardReactionState.faces.filter((f) => f.name === CardName.THARSIS_REPUBLIC), 'ONE face of the card').to.have.lengthOf(1);
    expect(seated?.el.getAttribute('data-key')).eq(warmKey);

    dropWarmReactors();
    expect(cardReactionState.faces.map((f) => f.name), 'the unrisen warm face is gone, the live one stays').deep.eq([CardName.THARSIS_REPUBLIC]);
  });

  it('a face with no warm twin is seated under its own key', async () => {
    const seated = await seatReactor({key: 'live:2', name: CardName.ROVER_CONSTRUCTION, seat});
    expect(seated?.key).eq('live:2');
    expect(cardReactionState.faces.map((f) => f.key)).deep.eq(['live:2']);
  });
});
