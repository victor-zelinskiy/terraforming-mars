import {expect} from 'chai';
import {firstVisibleEnd, fullscreenCoverAt, transferEndVerdict, TransferEndVerdict, TRANSFER_END_MIN_OPACITY} from '@/client/console/resourceTransfer/transferEndVisible';

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

  /*
   * A LEAVE DECIDED IS A SURFACE GONE (the monkey's seed of the day on CI, 2026-11-22 — `d20261122:colony-trade-hub-bot`,
   * issues #90 / #93): B closed «Разыграно», and in the first half of its dissolve — opacity still above the half —
   * a card's M€ took its printed icon there as its source; by the token's pop the table was gone.
   */
  it('an end on a surface whose leave is decided is refused by name — at any opacity, for exactly as long as the leave lasts', () => {
    const surface = document.createElement('div');
    surface.className = 'con-played con-ws';
    const icon = document.createElement('span');
    surface.appendChild(icon);
    root.appendChild(surface);
    box(icon, {left: 100, top: 100, width: 40, height: 40});
    stack(icon);
    expect(transferEndVerdict(icon), 'the table stands — its icon is a place').to.deep.eq({visible: true});
    surface.dataset.motionLeaving = '1';
    surface.style.opacity = '0.9';
    expect(transferEndVerdict(icon), 'the leave is decided: no place, though the fade has hardly begun').to.deep.eq({visible: false, why: 'leaving', by: 'con-played'});
    expect(transferEndVerdict(icon, {lenient: true}), 'a flight already in the air keeps its object through the leave').to.deep.eq({visible: true});
    // OCCUPANCY is another question: whoever must stand CLEAR of the surface asks what still paints — and through the
    // first half of its dissolve it does (the reaction stage past the Hydronetwork's context column, the whole suite
    // on CI: the charter rose over a column still on screen at 0.9).
    expect(transferEndVerdict(icon, {painted: true}), 'still painted — still in the way').to.deep.eq({visible: true});
    surface.style.opacity = '0.3';
    expect(transferEndVerdict(icon, {painted: true}), '…until the fade has taken it, by the same half as ever').to.deep.eq({visible: false, why: 'faded'});
    surface.style.opacity = '0.9';
    delete surface.dataset.motionLeaving;
    surface.style.opacity = '';
    expect(transferEndVerdict(icon), 'a leave cancelled (the surface shown again) gives the place back').to.deep.eq({visible: true});
  });

  it('LENIENT (the final approach, T06): a faded or covered object is still there — only a gone one fails', () => {
    const section = document.createElement('section');
    const el = document.createElement('div');
    section.appendChild(el);
    root.appendChild(section);
    box(el, {left: 100, top: 100, width: 40, height: 40});
    section.style.opacity = '0.1';
    expect(transferEndVerdict(el)).to.deep.eq({visible: false, why: 'faded'});
    expect(transferEndVerdict(el, {lenient: true}), 'a transient fade keeps the object').to.deep.eq({visible: true});
    section.style.display = 'none';
    expect(transferEndVerdict(el, {lenient: true}), 'hidden is gone').to.deep.eq({visible: false, why: 'hidden'});
    section.style.display = '';
    el.remove();
    expect(transferEndVerdict(el, {lenient: true}), 'unmounted is gone').to.deep.eq({visible: false, why: 'unmounted'});
  });

  it('a FULL-SCREEN overlay covers too (ledger HC — the monkey, day2): an end under the card viewer\'s veil or the system menu is refused, and so is one INSIDE it', () => {
    const veil = document.createElement('div');
    veil.className = 'con-zoom-veil con-zoom-veil--lifted';
    const shown = document.createElement('div');
    veil.appendChild(shown);
    const sys = document.createElement('div');
    sys.className = 'con-sys con-sys--menu';
    const capsule = document.createElement('div');
    root.append(veil, sys, capsule);
    for (const el of [veil, shown, sys, capsule]) {
      box(el, {left: 200, top: 200, width: 100, height: 60});
    }
    stack(veil);
    expect(transferEndVerdict(capsule)).to.deep.eq({visible: false, why: 'covered', by: 'con-zoom-veil.con-zoom-veil--lifted'});
    expect(transferEndVerdict(shown), 'an end INSIDE the viewer is no flight end — the flight layer stands under it').to.deep.eq({visible: false, why: 'covered', by: 'con-zoom-veil.con-zoom-veil--lifted'});
    stack(sys);
    expect(transferEndVerdict(capsule)).to.deep.eq({visible: false, why: 'covered', by: 'con-sys.con-sys--menu'});
    // …and a BARE point (no object to ask) is judged by the same overlays: the birth of a point source under them refuses.
    stack(veil);
    expect(fullscreenCoverAt({x: 250, y: 230})).eq('con-zoom-veil.con-zoom-veil--lifted');
    stack(capsule);
    expect(fullscreenCoverAt({x: 250, y: 230}), 'nothing over the frame — the point is painted').eq(undefined);
  });

  it('the MarsBot TURN REVIEW is a full-screen overlay too (FLAKE ZERO, bonus-card attack): an end under it is covered, one inside it is no flight end, a bare point under it is covered', () => {
    // The review raised by an X-hold from the live card, over the rail whose M€ row a token of the bot's attack
    // would have been born on (`[transfer] token painted under section.mbr__chains at the birth`).
    const review = document.createElement('div');
    review.className = 'con-bot-review';
    const chains = document.createElement('section');
    chains.className = 'mbr__chains';
    review.appendChild(chains);
    const row = document.createElement('div');
    row.className = 'con-res__row';
    root.append(review, row);
    for (const el of [review, chains, row]) {
      box(el, {left: 200, top: 200, width: 100, height: 60});
    }
    stack(chains, review, row);
    expect(transferEndVerdict(row), 'the rail row under the review is no place to be born').to.deep.eq({visible: false, why: 'covered', by: 'con-bot-review'});
    expect(transferEndVerdict(chains), 'an end INSIDE the review is no flight end').to.deep.eq({visible: false, why: 'covered', by: 'con-bot-review'});
    expect(fullscreenCoverAt({x: 250, y: 230})).eq('con-bot-review');
    // The PEEK lets the board read through (`pointer-events: none` — the hit test passes it): the row is painted again.
    stack(row);
    expect(transferEndVerdict(row)).to.deep.eq({visible: true});
  });

  /*
   * THE ANNOUNCE PLATE COVERS TOO (the real-browser monkey's seed of the day, 2026-11-23 — issues #103 / #104:
   * «[transfer] token painted under span.con-mandatory__open at the birth — stock:rating»). A small plate, not a
   * scene — but it stands above the flight layer by the z map for as long as the question waits, and the end's
   * verdict did not know it: the token was born under the plate and flew out from behind it.
   */
  it('the ANNOUNCE PLATE stands over the flight layer: an end under it is covered, a bare point under it is covered — beside it, painted', () => {
    const plate = document.createElement('div');
    plate.className = 'con-mandatory';
    const open = document.createElement('span');
    open.className = 'con-mandatory__open';
    plate.appendChild(open);
    const cell = document.createElement('div');
    cell.className = 'board-space';
    root.append(plate, cell);
    for (const el of [plate, open, cell]) {
      box(el, {left: 200, top: 200, width: 100, height: 60});
    }
    stack(open, plate, cell);
    expect(transferEndVerdict(cell), 'a source under the plate is no place to be born').to.deep.eq({visible: false, why: 'covered', by: 'con-mandatory'});
    expect(fullscreenCoverAt({x: 250, y: 230}), 'a bare point under the plate').eq('con-mandatory');
    // The plate gone (the question opened, or answered): the cell is painted again.
    stack(cell);
    expect(transferEndVerdict(cell)).to.deep.eq({visible: true});
    expect(fullscreenCoverAt({x: 250, y: 230})).eq(undefined);
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

  it('THE CARD-REACTION LAYER paints over every band (iteration 3): a reactor\'s face over a standing composer is never covered by it — the hit test names the band under the pointer-events-none layer', () => {
    const composer = document.createElement('div');
    composer.className = 'con-ws con-cardactions';
    const layer = document.createElement('div');
    layer.className = 'con-reaction';
    const face = document.createElement('div');
    face.className = 'con-reaction__face';
    const icon = document.createElement('div');
    icon.className = 'pcard-ic';
    face.appendChild(icon);
    layer.appendChild(face);
    root.append(composer, layer);
    for (const el of [composer, face, icon]) {
      box(el, {left: 600, top: 300, width: 120, height: 80});
    }
    stack(composer); // the hit test under the face names the composer — the layer refuses the pointer
    expect(transferEndVerdict(icon), 'a printed icon of the reactor over the band').to.deep.eq({visible: true});
    expect(transferEndVerdict(icon, {strict: true}), 'strict too — no band can cover the layer').to.deep.eq({visible: true});
    // …while a satellite under that same glass stays covered (the exemption is the layer's alone).
    const satellite = document.createElement('div');
    satellite.className = 'con-res-aux__cell';
    root.append(satellite);
    box(satellite, {left: 600, top: 300, width: 120, height: 80});
    expect(transferEndVerdict(satellite)).to.deep.eq({visible: false, why: 'covered', by: 'con-cardactions'});
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
