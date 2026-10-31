import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  buriedUnderAnotherCard, domReactorPlace, findReactorPlace, liftTargetOf, placeShowsCard, reactorHomeSelectors, registerReactorPlace, resetReactorPlaces,
  visibleReactorHome,
} from '@/client/console/cardReaction/reactorPlaces';

/**
 * A CARD THAT STANDS ON SCREEN REACTS IN ITS PLACE — never a second instance («СРАБАТЫВАНИЕ КАРТЫ», iteration 3; the
 * owner's field report of 2026-10-27: Martian Fiber's own action woke its own effect and the framework rose a COPY of
 * the composer's hero beside the rail). A registered host's place answers first; else the DOM's painted face on the
 * product's own hooks — judged by the ONE visibility verdict; the reaction layer's own faces and slivers never count.
 */
describe('reactorPlaces — where a reacting card already stands', () => {
  let root: HTMLElement;
  const originalFromPoint = document.elementsFromPoint;

  const box = (el: HTMLElement, rect: {left: number, top: number, width: number, height: number}) => {
    el.getBoundingClientRect = () => ({
      ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}),
    }) as DOMRect;
  };

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    Object.defineProperty(window, 'innerWidth', {value: 1920, configurable: true});
    Object.defineProperty(window, 'innerHeight', {value: 1080, configurable: true});
    document.elementsFromPoint = () => [];
  });
  afterEach(() => {
    root.remove();
    resetReactorPlaces();
    document.elementsFromPoint = originalFromPoint;
  });

  it('the selectors name the product\'s own hooks, most specific first — the composer\'s hero, a target miniature, a played slot', () => {
    expect(reactorHomeSelectors(CardName.MARTIAN_FIBER)).deep.eq([
      '[data-reaction-home="Martian Fiber"]', '[data-composer-card="Martian Fiber"]', '[data-played-face="Martian Fiber"]', '[data-played-key="Martian Fiber"]',
    ]);
  });

  it('a registered host answers first — its own choreography, never the DOM\'s lift', async () => {
    const calls: Array<string> = [];
    const unregister = registerReactorPlace({
      id: 'stage',
      standsIn: (card) => card === CardName.PETS,
      emergeTarget: async () => {
        calls.push('emerge');
      },
      settleTarget: async () => {
        calls.push('settle');
      },
      emergedFaceEl: () => root,
    });
    const place = findReactorPlace(CardName.PETS);
    expect(place).is.not.undefined;
    await place?.emergeTarget(CardName.PETS);
    await place?.settleTarget(CardName.PETS);
    expect(calls).deep.eq(['emerge', 'settle']);
    expect(place?.emergedFaceEl(CardName.PETS)).eq(root);
    expect(findReactorPlace(CardName.THARSIS_REPUBLIC), 'another card is not the host\'s').is.undefined;
    unregister();
    expect(findReactorPlace(CardName.PETS), 'unregistered — nothing stands').is.undefined;
  });

  it('a VISIBLE face on a product hook is the place; the reaction layer\'s own face and a sliver never are', () => {
    const hero = document.createElement('div');
    hero.setAttribute('data-reaction-home', CardName.MARTIAN_FIBER);
    box(hero, {left: 400, top: 300, width: 320, height: 460});
    root.appendChild(hero);
    expect(visibleReactorHome(CardName.MARTIAN_FIBER)).eq(hero);
    const place = domReactorPlace(CardName.MARTIAN_FIBER);
    expect(place?.standsIn(CardName.MARTIAN_FIBER)).is.true;
    expect(place?.standsIn(CardName.PETS)).is.false;
    expect(place?.emergedFaceEl(CardName.MARTIAN_FIBER)).eq(hero);

    // The layer's own face of the same card is NOT a place (a reactor is not its own place).
    const layer = document.createElement('div');
    layer.className = 'con-reaction';
    const own = document.createElement('div');
    own.setAttribute('data-played-key', CardName.PETS);
    box(own, {left: 100, top: 100, width: 320, height: 460});
    layer.appendChild(own);
    root.appendChild(layer);
    expect(visibleReactorHome(CardName.PETS)).is.undefined;

    // A sliver — a cascade's title band — is no face.
    const band = document.createElement('div');
    band.setAttribute('data-played-key', CardName.THARSIS_REPUBLIC);
    box(band, {left: 100, top: 100, width: 320, height: 30});
    root.appendChild(band);
    expect(visibleReactorHome(CardName.THARSIS_REPUBLIC)).is.undefined;

    // A hidden face is no place (the ONE verdict).
    const hidden = document.createElement('div');
    hidden.setAttribute('data-composer-card', CardName.ROVER_CONSTRUCTION);
    hidden.style.display = 'none';
    box(hidden, {left: 100, top: 100, width: 320, height: 460});
    root.appendChild(hidden);
    expect(visibleReactorHome(CardName.ROVER_CONSTRUCTION)).is.undefined;
    expect(findReactorPlace(CardName.ROVER_CONSTRUCTION)).is.undefined;
  });

  it('a face BURIED in a cascade (another card lies on top of its centre) is NO place — the card on top would read as the reactor', () => {
    // The played table's stack: Pets is covered (its title band shows), Birds lies on top of it, both full-height slots.
    const covered = document.createElement('div');
    covered.setAttribute('data-played-key', CardName.PETS);
    box(covered, {left: 100, top: 100, width: 320, height: 460});
    const coveredFace = document.createElement('div');
    covered.appendChild(coveredFace);
    const onTop = document.createElement('div');
    onTop.setAttribute('data-played-key', CardName.BIRDS);
    box(onTop, {left: 100, top: 140, width: 320, height: 460});
    const onTopFace = document.createElement('div');
    onTop.appendChild(onTopFace);
    root.appendChild(covered);
    root.appendChild(onTop);
    // Pets' centre (260, 330) is painted by Birds' face; Birds' own centre (260, 370) by itself.
    document.elementsFromPoint = (_x: number, y: number) => (y === 330 ? [onTopFace, onTop, coveredFace, covered] : [onTopFace, onTop]);
    expect(buriedUnderAnotherCard(covered)).is.true;
    expect(buriedUnderAnotherCard(onTop)).is.false;
    expect(visibleReactorHome(CardName.PETS), 'the buried card rises at the stage, never under Birds').is.undefined;
    expect(findReactorPlace(CardName.PETS)).is.undefined;
    expect(visibleReactorHome(CardName.BIRDS), 'the card on top is its own place').eq(onTop);
  });

  it('a slot that KEYS one card and SHOWS another (the start shelf while its top card is on loan) is a place only for the face it shows', () => {
    // The away card (Titan Holdings) keeps the top slot's key for its flight home; the card underneath is promoted into it.
    const slot = document.createElement('div');
    slot.setAttribute('data-played-key', CardName.TITAN_HOLDINGS);
    slot.setAttribute('data-played-face', CardName.PROTEUS);
    box(slot, {left: 100, top: 100, width: 320, height: 460});
    root.appendChild(slot);
    expect(placeShowsCard(slot, CardName.TITAN_HOLDINGS)).is.false;
    expect(placeShowsCard(slot, CardName.PROTEUS)).is.true;
    expect(visibleReactorHome(CardName.TITAN_HOLDINGS), 'the away card never lifts the promoted card').is.undefined;
    expect(visibleReactorHome(CardName.PROTEUS), 'the promoted card IS painted there — its own place').eq(slot);
  });

  it('no hit-test evidence (a pointer-events: none face, a host with no hit test) is no evidence of cover', () => {
    const face = document.createElement('div');
    face.setAttribute('data-composer-card', CardName.PETS);
    box(face, {left: 100, top: 100, width: 320, height: 460});
    root.appendChild(face);
    document.elementsFromPoint = () => [];
    expect(buriedUnderAnotherCard(face)).is.false;
    expect(visibleReactorHome(CardName.PETS)).eq(face);
  });

  it('the lift marks the face while it stands forward and clears the mark on the settle', async () => {
    const hero = document.createElement('div');
    hero.setAttribute('data-reaction-home', CardName.MARTIAN_FIBER);
    box(hero, {left: 400, top: 300, width: 320, height: 460});
    root.appendChild(hero);
    const place = domReactorPlace(CardName.MARTIAN_FIBER);
    const emerge = place!.emergeTarget(CardName.MARTIAN_FIBER);
    expect(hero.getAttribute('data-reaction-lifted'), 'marked from the first frame of the lift').eq('1');
    await emerge;
    await place!.settleTarget(CardName.MARTIAN_FIBER);
    expect(hero.hasAttribute('data-reaction-lifted'), 'the mark leaves with the settle').is.false;
  });
  // ── P82 · «ПОДНИМАЕТСЯ ТОЛЬКО ТА КАРТА, ЧТО СРАБОТАЛА» — § ONE FACE (H3) ──

  it('ONE FACE · a hook on a WRAPPER that holds another card\'s face is no place — a lift would raise both («карта с левой картой под ней»); the reactor rises at the stage', () => {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-played-key', CardName.PETS);
    box(wrap, {left: 400, top: 300, width: 320, height: 460});
    const other = document.createElement('div');
    other.setAttribute('data-played-key', CardName.DECOMPOSERS);
    box(other, {left: 400, top: 300, width: 320, height: 460});
    wrap.appendChild(other);
    root.appendChild(wrap);
    expect(visibleReactorHome(CardName.PETS), 'the wrapper carries Decomposers too — not a place').is.undefined;
  });

  it('ONE FACE · a wrapper whose LIFT BODY (`data-reaction-lift`) carries only its own face is a place — and the lift moves that body, never the wrapper', () => {
    const wrap = document.createElement('div');
    wrap.setAttribute('data-reaction-home', CardName.PETS);
    box(wrap, {left: 400, top: 300, width: 320, height: 460});
    const body = document.createElement('div');
    body.setAttribute('data-reaction-lift', '');
    wrap.appendChild(body);
    root.appendChild(wrap);
    expect(visibleReactorHome(CardName.PETS)).eq(wrap);
    expect(liftTargetOf(wrap), 'the lift moves the face\'s body').eq(body);
  });

  it('ONE FACE · the fixes of 2026-10-30 stand: a face buried under another card is no place; a slot showing another face is no place for the away card', () => {
    const slot = document.createElement('div');
    slot.setAttribute('data-played-key', CardName.PETS);
    slot.setAttribute('data-played-face', CardName.DECOMPOSERS);
    box(slot, {left: 400, top: 300, width: 320, height: 460});
    root.appendChild(slot);
    expect(placeShowsCard(slot, CardName.PETS)).is.false;
    expect(visibleReactorHome(CardName.PETS), 'the slot shows Decomposers').is.undefined;
    const buried = document.createElement('div');
    buried.setAttribute('data-played-key', CardName.THARSIS_REPUBLIC);
    box(buried, {left: 900, top: 300, width: 320, height: 460});
    const top = document.createElement('div');
    top.setAttribute('data-played-key', CardName.ROVER_CONSTRUCTION);
    root.append(buried, top);
    document.elementsFromPoint = () => [top];
    expect(buriedUnderAnotherCard(buried)).is.true;
    expect(visibleReactorHome(CardName.THARSIS_REPUBLIC)).is.undefined;
  });
});
