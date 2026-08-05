import {expect} from 'chai';
import {handDockReachable} from '@/client/console/handDock/handDeliveryDirector';

/**
 * THE DESTINATION DECIDES THE GRAMMAR. A surface releasing cards asks ONE
 * question — «can a card physically reach the hand dock right now?» — and
 * picks per-card intake flights or the take-in-place fallback off the answer.
 * Never off its own identity ("am I embedded?"): the same embedded reveal is
 * flight-worthy inside the game (dock in the footer) and not during the
 * pre-game setup (no dock yet), and only the dock knows which is true.
 */
describe('handDockReachable — the ONE take-grammar switch', () => {
  let dock: HTMLElement | undefined;

  // The default box sits INSIDE the (JSDOM 1024×768) viewport — a footer dock.
  function mountDock(style: Partial<CSSStyleDeclaration> = {}, rect = {width: 600, height: 120, top: 620}): HTMLElement {
    const el = document.createElement('div');
    el.className = 'con-handdock';
    Object.assign(el.style, style);
    // JSDOM lays nothing out — the predicate reads a rect, so serve one.
    el.getBoundingClientRect = () => ({
      width: rect.width, height: rect.height, top: rect.top, left: 0,
      right: rect.width, bottom: rect.top + rect.height, x: 0, y: rect.top, toJSON: () => ({}),
    }) as DOMRect;
    document.body.appendChild(el);
    dock = el;
    return el;
  }

  afterEach(() => {
    dock?.remove();
    dock = undefined;
  });

  it('no dock in the document → unreachable (the pre-game setup: cards have nowhere to fly)', () => {
    expect(handDockReachable()).to.be.false;
  });

  it('a mounted, painted, measurable dock → reachable', () => {
    const el = mountDock();
    (el as unknown as {checkVisibility: () => boolean}).checkVisibility = () => true;
    expect(handDockReachable()).to.be.true;
  });

  /**
   * The dock is a `v-show` layer whose ANCESTORS hide it — an existence check
   * (or a raw opacity read on the node itself) would call it reachable and
   * aim every take at nothing. `checkVisibility` is the honest question.
   */
  it('hidden by an ancestor (checkVisibility=false) → unreachable', () => {
    const el = mountDock();
    (el as unknown as {checkVisibility: () => boolean}).checkVisibility = () => false;
    expect(handDockReachable()).to.be.false;
  });

  it('present but not laid out (zero box) → unreachable', () => {
    const el = mountDock({}, {width: 0, height: 0, top: 0});
    (el as unknown as {checkVisibility: () => boolean}).checkVisibility = () => true;
    expect(handDockReachable()).to.be.false;
  });

  it('parked entirely below the viewport → unreachable (a target off screen is no target)', () => {
    const el = mountDock({}, {width: 600, height: 120, top: window.innerHeight + 50});
    (el as unknown as {checkVisibility: () => boolean}).checkVisibility = () => true;
    expect(handDockReachable()).to.be.false;
  });
});
