import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {
  domReactorPlace, findReactorPlace, reactorHomeSelectors, registerReactorPlace, resetReactorPlaces, visibleReactorHome,
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
      '[data-reaction-home="Martian Fiber"]', '[data-composer-card="Martian Fiber"]', '[data-played-key="Martian Fiber"]',
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
});
