import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  cardReactionState, dropWarmFacesOf, dropWarmReactors, registerCardReactionStage, seatReactor, unseatAllReactors, warmReactorFaces,
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
  // ── P82 · «ПОДНИМАЕТСЯ ТОЛЬКО ТА КАРТА, ЧТО СРАБОТАЛА» — § WARM (H2) ──

  it('WARM · a warm face belongs to ONE group: two groups of one card get two warm faces, and each rise takes its OWN (never the other\'s by name)', async () => {
    warmReactorFaces([{name: CardName.PETS, seq: 7}, {name: CardName.PETS, seq: 9}], seat);
    const warm = cardReactionState.faces.filter((f) => f.warm === true);
    expect(warm.map((f) => f.seq), 'one warm face per group').deep.eq([7, 9]);
    const seated = await seatReactor({key: 'live:9', name: CardName.PETS, seq: 9, seat});
    expect(seated?.key, 'group 9 takes group 9\'s face').eq(warm[1].key);
    expect(cardReactionState.faces.find((f) => f.key === warm[0].key)?.warm, 'group 7\'s face stays warm, untouched').is.true;
  });

  it('WARM · the moment a group is decided NOT to rise at the stage (lifted in its place, summarized, let go), its warm face leaves — the layer never keeps a face of a card that is not still to rise', () => {
    warmReactorFaces([{name: CardName.PETS, seq: 7}, {name: CardName.DECOMPOSERS, seq: 8}], seat);
    dropWarmFacesOf([7]);
    expect(cardReactionState.faces.map((f) => f.name), 'only the dropped group\'s face left').deep.eq([CardName.DECOMPOSERS]);
    dropWarmFacesOf([]);
    expect(cardReactionState.faces).to.have.lengthOf(1);
  });

  it('WARM · a warm face is never painted: the layer\'s CSS hides it and the take-over is the only door to paint', () => {
    warmReactorFaces([{name: CardName.PETS, seq: 3}], seat);
    const face = cardReactionState.faces[0];
    expect(face.warm, 'warm').is.true;
    expect(face.key).to.match(/^warm:3:/);
  });
});
