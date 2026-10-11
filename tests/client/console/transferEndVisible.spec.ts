import {expect} from 'chai';
import {firstVisibleEnd, transferEndVerdict, TransferEndVerdict, TRANSFER_END_MIN_OPACITY} from '@/client/console/resourceTransfer/transferEndVisible';

/**
 * THE ENDS OF A FLIGHT ARE VISIBLE (the polish remediation iteration № 1, 2026-10-11).
 *
 * «Измерим» ≠ «видим»: the verdict refuses a box under a foreign band surface's
 * glass, a hidden or faded one, an off-screen one, an unmounted one — and
 * accepts an element standing INSIDE its own `.con-ws` (the hero in the
 * composer), a `pointer-events: none` element with nothing but the board under
 * it (the satellite on the open board), and a chip of the transfer layer over
 * the point (never «cover»).
 */
describe('transferEndVerdict — a place a token may be born on or land on', () => {
  let root: HTMLElement;
  const originalFromPoint = document.elementsFromPoint;

  const box = (el: HTMLElement, rect: {left: number, top: number, width: number, height: number}) => {
    el.getBoundingClientRect = () => ({
      ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}),
    }) as DOMRect;
  };
  const stack = (...els: Array<Element>) => {
    document.elementsFromPoint = () => els;
  };

  beforeEach(() => {
    root = document.createElement('div');
    document.body.appendChild(root);
    Object.defineProperty(window, 'innerWidth', {value: 1920, configurable: true});
    Object.defineProperty(window, 'innerHeight', {value: 1080, configurable: true});
  });
  afterEach(() => {
    root.remove();
    document.elementsFromPoint = originalFromPoint;
  });

  it('an unmounted or empty box is no end', () => {
    const loose = document.createElement('div');
    expect(transferEndVerdict(loose)).to.deep.eq({visible: false, why: 'unmounted'});
    expect(transferEndVerdict(null)).to.deep.eq({visible: false, why: 'unmounted'});
    const flat = document.createElement('div');
    root.appendChild(flat);
    box(flat, {left: 10, top: 10, width: 0, height: 0});
    expect(transferEndVerdict(flat)).to.deep.eq({visible: false, why: 'empty'});
  });

  it('hidden up the chain, faded below a half, off-screen — refused by name', () => {
    const section = document.createElement('section');
    const el = document.createElement('div');
    section.appendChild(el);
    root.appendChild(section);
    box(el, {left: 100, top: 100, width: 40, height: 40});
    section.style.visibility = 'hidden';
    expect(transferEndVerdict(el)).to.deep.eq({visible: false, why: 'hidden'});
    section.style.visibility = '';
    section.style.display = 'none';
    expect(transferEndVerdict(el)).to.deep.eq({visible: false, why: 'hidden'});
    section.style.display = '';
    section.style.opacity = String(TRANSFER_END_MIN_OPACITY - 0.1);
    stack(el);
    expect(transferEndVerdict(el)).to.deep.eq({visible: false, why: 'faded'});
    section.style.opacity = '0.8';
    el.style.opacity = '0.8'; // 0.64 — a product of the chain, still a place
    expect(transferEndVerdict(el)).to.deep.eq({visible: true});
    box(el, {left: -100, top: 100, width: 40, height: 40});
    expect(transferEndVerdict(el)).to.deep.eq({visible: false, why: 'off-screen'});
  });

  it('COVERED BY PAINT: a foreign .con-ws over the centre refuses; the element\'s own .con-ws, the board, a transfer chip do not', () => {
    const composer = document.createElement('div');
    composer.className = 'con-ws con-cardactions';
    const hero = document.createElement('div');
    composer.appendChild(hero);
    const satellite = document.createElement('div');
    satellite.className = 'con-res-aux__cell';
    const board = document.createElement('div');
    board.className = 'con-board';
    const chip = document.createElement('div');
    const layer = document.createElement('div');
    layer.className = 'con-transfer';
    layer.appendChild(chip);
    root.append(composer, satellite, board, layer);
    for (const el of [hero, satellite, board, composer]) {
      box(el, {left: 200, top: 200, width: 100, height: 60});
    }
    // The satellite under the composer's glass (the hit test never names a pointer-events:none satellite — it names the glass).
    stack(composer);
    expect(transferEndVerdict(satellite)).to.deep.eq({visible: false, why: 'covered', by: 'con-cardactions'});
    // The hero standing INSIDE that same composer: the glass is its own surface.
    expect(transferEndVerdict(hero)).to.deep.eq({visible: true});
    // The satellite on the open board: the board is under it, nothing over it.
    stack(board);
    expect(transferEndVerdict(satellite)).to.deep.eq({visible: true});
    // A chip of the transfer layer in the air over the point is never «cover».
    stack(chip, board);
    expect(transferEndVerdict(satellite)).to.deep.eq({visible: true});
    stack(chip, composer);
    expect(transferEndVerdict(satellite)).to.deep.eq({visible: false, why: 'covered', by: 'con-cardactions'});
    // A LEAVING surface (its fade below the half) still answers the hit test and covers nothing the eye can see —
    // the hand dissolving over the board while a tile's payout measures the satellite (Red Museum's data).
    composer.style.opacity = '0.3';
    stack(composer);
    expect(transferEndVerdict(satellite)).to.deep.eq({visible: true});
    composer.style.opacity = '0.6';
    expect(transferEndVerdict(satellite)).to.deep.eq({visible: false, why: 'covered', by: 'con-cardactions'});
    // STRICT (the detached wait, PL-165): a LEAVING surface still covers — it still imposes its layout — at any opacity,
    // and even when it no longer answers the hit test (the board under the point), by geometry alone.
    composer.style.opacity = '0.3';
    stack(composer);
    expect(transferEndVerdict(satellite, {strict: true})).to.deep.eq({visible: false, why: 'covered', by: 'con-cardactions'});
    stack(board);
    expect(transferEndVerdict(satellite, {strict: true})).to.deep.eq({visible: false, why: 'covered', by: 'con-cardactions'});
    composer.style.opacity = '';
    expect(transferEndVerdict(hero, {strict: true}), 'its own surface never covers it').to.deep.eq({visible: true});
    composer.remove();
    expect(transferEndVerdict(satellite, {strict: true}), 'the surface gone — the end is open').to.deep.eq({visible: true});
  });

  it('firstVisibleEnd takes the first VISIBLE match in document order and reports what it skipped', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    a.className = 'cand';
    b.className = 'cand';
    root.append(a, b);
    box(a, {left: 10, top: 10, width: 40, height: 40});
    box(b, {left: 60, top: 10, width: 40, height: 40});
    a.style.visibility = 'hidden';
    stack(b);
    const skipped: Array<{selector: string, verdict: TransferEndVerdict}> = [];
    expect(firstVisibleEnd('.cand', skipped)).to.eq(b);
    expect(skipped).to.deep.eq([{selector: '.cand', verdict: {visible: false, why: 'hidden'}}]);
    a.style.visibility = '';
    stack(a);
    expect(firstVisibleEnd('.cand')).to.eq(a);
    expect(firstVisibleEnd('.nothing')).to.eq(undefined);
  });
});
