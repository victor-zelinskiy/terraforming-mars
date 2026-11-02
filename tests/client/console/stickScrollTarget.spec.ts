/*
 * THE RIGHT STICK'S NET (`console/stickScrollTarget.ts`): when no routed surface takes the stick, it moves the
 * overflowing container the player is LOOKING AT — painted, on top, the largest — and nothing else. jsdom has no
 * layout, so each candidate's geometry and the hit test are stubbed per element; the module reads only those.
 */
import {expect} from 'chai';
import {stickScrollBy, stickScrollTarget} from '@/client/console/stickScrollTarget';

type Box = {left: number, top: number, width: number, height: number};

const restore: Array<() => void> = [];

function stubBox(el: HTMLElement, box: Box, scroll: {scrollHeight: number, clientHeight: number}): void {
  el.getBoundingClientRect = () => ({
    ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({}),
  }) as DOMRect;
  Object.defineProperty(el, 'scrollHeight', {configurable: true, get: () => scroll.scrollHeight});
  Object.defineProperty(el, 'clientHeight', {configurable: true, get: () => scroll.clientHeight});
  Object.defineProperty(el, 'offsetParent', {configurable: true, get: () => document.body});
}

/** The hit test answers the LAST stubbed element whose box holds the point (DOM order = paint order here). */
function stubHitTest(order: ReadonlyArray<HTMLElement>): void {
  const doc = document as Document & {elementsFromPoint?: (x: number, y: number) => Array<Element>};
  const before = doc.elementsFromPoint;
  doc.elementsFromPoint = (x: number, y: number) => order.filter((el) => {
    const r = el.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }).reverse();
  restore.push(() => {
    doc.elementsFromPoint = before as never;
  });
}

function viewport(cls = 'con-scroll-area__viewport'): HTMLElement {
  const el = document.createElement('div');
  el.className = cls;
  document.body.appendChild(el);
  restore.push(() => el.remove());
  return el;
}

describe('stickScrollTarget — the right stick\'s net', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {configurable: true, value: 1920});
    Object.defineProperty(window, 'innerHeight', {configurable: true, value: 1080});
  });
  afterEach(() => {
    while (restore.length > 0) {
      restore.pop()?.();
    }
  });

  it('takes the overflowing list on screen (the effects grid the stick ignored)', () => {
    const list = viewport();
    stubBox(list, {left: 900, top: 200, width: 1000, height: 800}, {scrollHeight: 1800, clientHeight: 800});
    stubHitTest([list]);
    expect(stickScrollTarget()).to.equal(list);
  });

  it('never takes a container that FITS', () => {
    const list = viewport();
    stubBox(list, {left: 900, top: 200, width: 1000, height: 800}, {scrollHeight: 800, clientHeight: 800});
    stubHitTest([list]);
    expect(stickScrollTarget()).to.equal(undefined);
  });

  it('never takes a container under a FOREIGN surface', () => {
    const list = viewport();
    stubBox(list, {left: 0, top: 0, width: 1000, height: 800}, {scrollHeight: 1800, clientHeight: 800});
    const cover = document.createElement('div');
    document.body.appendChild(cover);
    restore.push(() => cover.remove());
    stubBox(cover, {left: 0, top: 0, width: 1920, height: 1080}, {scrollHeight: 0, clientHeight: 0});
    stubHitTest([list, cover]);
    expect(stickScrollTarget()).to.equal(undefined);
  });

  it('never takes a PARKED (visibility: hidden) layer', () => {
    const list = viewport();
    list.style.visibility = 'hidden';
    stubBox(list, {left: 0, top: 0, width: 1000, height: 800}, {scrollHeight: 1800, clientHeight: 800});
    stubHitTest([list]);
    // jsdom has no checkVisibility — the probe falls back on offsetParent, so the hidden layer is told by the stub.
    Object.defineProperty(list, 'offsetParent', {configurable: true, get: () => null});
    expect(stickScrollTarget()).to.equal(undefined);
  });

  it('prefers the LARGEST of two lists on screen (the grid over a side column)', () => {
    const side = viewport();
    stubBox(side, {left: 0, top: 0, width: 300, height: 800}, {scrollHeight: 1200, clientHeight: 800});
    const grid = viewport();
    stubBox(grid, {left: 400, top: 0, width: 1200, height: 800}, {scrollHeight: 2000, clientHeight: 800});
    stubHitTest([side, grid]);
    expect(stickScrollTarget()).to.equal(grid);
  });

  it('reads a plain overflow container that declares data-stick-scroll', () => {
    const panel = viewport('con-colonies__scroll');
    panel.setAttribute('data-stick-scroll', '');
    stubBox(panel, {left: 0, top: 0, width: 1000, height: 600}, {scrollHeight: 1400, clientHeight: 600});
    stubHitTest([panel]);
    expect(stickScrollTarget()).to.equal(panel);
  });

  it('scrolls by the deflection scaled to pixels, and ignores a resting stick', () => {
    const list = viewport();
    stubBox(list, {left: 0, top: 0, width: 1000, height: 800}, {scrollHeight: 1800, clientHeight: 800});
    stubHitTest([list]);
    let moved = 0;
    list.scrollBy = ((opts: {top?: number}) => {
      moved += opts.top ?? 0;
    }) as typeof list.scrollBy;
    expect(stickScrollBy(0.01)).to.equal(false);
    expect(moved).to.equal(0);
    expect(stickScrollBy(1)).to.equal(true);
    expect(moved).to.be.greaterThan(1); // whole pixels a frame — never the raw deflection
  });
});
