import {expect} from 'chai';
import {iconNeedlesFor} from '@/client/console/consoleActionCommitMotion';
import {effectResultOf, effectRowFor, effectRowsOf, resolveEffectIconEnds} from '@/client/console/cardReaction/effectIconEnds';

/*
 * WHERE A REACTION'S TOKEN IS BORN — the printed icon of the reacting card's EFFECT ROW («СРАБАТЫВАНИЕ КАРТЫ», the
 * owner's decision 2): the declared block (`printedEffect`), else the row that prints the token's resource; the k-th
 * token on the k-th icon; a production step on its plate; an action frame is never a birth place; a face that
 * prints no such icon births nothing (the caller degrades by name).
 */
function box(el: HTMLElement, w = 20, h = 20): void {
  el.getBoundingClientRect = () => ({width: w, height: h, left: 10, top: 10, right: 10 + w, bottom: 10 + h, x: 10, y: 10, toJSON: () => ({})}) as DOMRect;
}

function icon(key: string, cls = 'pcard-ic'): HTMLElement {
  const el = document.createElement('span');
  el.className = cls;
  const needle = iconNeedlesFor(key)?.[0] ?? key;
  el.style.backgroundImage = `url(assets/${needle})`;
  box(el);
  return el;
}

function part(...children: Array<HTMLElement>): HTMLElement {
  const el = document.createElement('span');
  el.className = 'pcard-effect__part';
  children.forEach((c) => el.appendChild(c));
  box(el, 80, 20);
  return el;
}

function frame(action: boolean, ...parts: Array<HTMLElement>): HTMLElement {
  const group = document.createElement('div');
  group.className = 'pcard-mech-group';
  const effect = document.createElement('span');
  effect.className = action ? 'pcard-effect pcard-effect--action' : 'pcard-effect';
  parts.forEach((p) => effect.appendChild(p));
  group.appendChild(effect);
  box(group, 200, 30);
  return group;
}

/** Hartlan's face: «[tile·green] : 6 [heat] [1 M€ prod]» and «12 [heat] → [card][card]». */
function hartlanFace(): HTMLElement {
  const face = document.createElement('div');
  face.className = 'pcard';
  const prod = document.createElement('span');
  prod.className = 'pcard-prod';
  prod.appendChild(icon('megacredits'));
  box(prod, 24, 24);
  face.appendChild(frame(false, part(icon('tile')), part(icon('heat'), prod)));
  face.appendChild(frame(true, part(icon('heat')), part(icon('cards'), icon('cards'))));
  box(face, 320, 460);
  document.body.appendChild(face);
  return face;
}

describe('effectIconEnds — the reactor\'s effect row is the birth place', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('effect frames only, in print order — never the action frame', () => {
    const face = hartlanFace();
    const rows = effectRowsOf(face);
    expect(rows).to.have.lengthOf(1);
    expect(rows[0].classList.contains('pcard-effect--action')).is.false;
    expect(effectResultOf(rows[0]).querySelectorAll('.pcard-ic').length, 'the result part: heat + the M€ plate').eq(2);
  });

  it('the declared block wins; else the row printing the first token\'s resource; else nothing', () => {
    const face = hartlanFace();
    const heat = {channel: 'stock' as const, resource: 'heat', amount: 1};
    expect(effectRowFor(face, 0, [heat])).eq(effectRowsOf(face)[0]);
    expect(effectRowFor(face, undefined, [heat])).eq(effectRowsOf(face)[0]);
    expect(effectRowFor(face, 7, [heat]), 'an out-of-range declaration falls back to the content').eq(effectRowsOf(face)[0]);
    const plain = document.createElement('div');
    plain.className = 'pcard';
    document.body.appendChild(plain);
    expect(effectRowFor(plain, 0, [heat])).is.undefined;
  });

  it('six heat tokens are all born on the ONE printed heat of the effect row (never the action\'s heat), the production on its plate', () => {
    const face = hartlanFace();
    const heatIcon = effectResultOf(effectRowsOf(face)[0]).querySelector('.pcard-ic');
    const tokens = Array.from({length: 6}, () => ({channel: 'stock' as const, resource: 'heat', amount: 1}));
    const ends = resolveEffectIconEnds(face, 0, tokens);
    expect(ends).to.have.lengthOf(6);
    ends.forEach((end) => expect(end?.el, 'the effect row\'s heat, not the action\'s').eq(heatIcon));
    const [prod] = resolveEffectIconEnds(face, 0, [{channel: 'production', resource: 'megacredits', amount: 1}]);
    expect(prod?.el.closest('.pcard-prod'), 'the production plate').is.not.null;
  });

  it('without a declared block EACH token finds the frame that prints ITS kind — Tharsis: the 3 M€ on the cash row, the step on the production row', () => {
    const face = document.createElement('div');
    face.className = 'pcard';
    const prod = document.createElement('span');
    prod.className = 'pcard-prod';
    prod.appendChild(icon('megacredits'));
    box(prod, 24, 24);
    const productionRow = frame(false, part(icon('city')), part(prod));
    // A stock M€ is printed as the M€ TILE with its number (never a sprite icon) — the grammar's `.pcard-mi--mc`.
    const mc = document.createElement('span');
    mc.className = 'pcard-mi pcard-mi--mc';
    mc.textContent = '3';
    box(mc, 24, 24);
    const cashRow = frame(false, part(icon('city')), part(mc));
    face.appendChild(productionRow);
    face.appendChild(cashRow);
    box(face, 320, 460);
    document.body.appendChild(face);
    const specs = [
      {channel: 'stock' as const, resource: 'megacredits', amount: 1},
      {channel: 'stock' as const, resource: 'megacredits', amount: 1},
      {channel: 'stock' as const, resource: 'megacredits', amount: 1},
      {channel: 'production' as const, resource: 'megacredits', amount: 1},
    ];
    const ends = resolveEffectIconEnds(face, undefined, specs);
    expect(ends).to.have.lengthOf(4);
    const cashTile = effectResultOf(effectRowsOf(face)[1]).querySelector('.pcard-mi--mc');
    ends.slice(0, 3).forEach((end) => expect(end?.el, 'the cash tokens on the cash row\'s M€ tile').eq(cashTile));
    expect(ends[3]?.el.closest('.pcard-prod'), 'the step on the production row\'s plate').is.not.null;
    expect(ends[3]?.el.closest('.pcard-mech-group'), 'on the OTHER row').eq(productionRow);
  });

  it('ONE frame with two results after two colons (Tharsis as printed): the step on the plate of the FIRST result, the cash on the tile of the last', () => {
    const face = document.createElement('div');
    face.className = 'pcard';
    const prod = document.createElement('span');
    prod.className = 'pcard-prod';
    prod.appendChild(icon('megacredits'));
    box(prod, 24, 24);
    const mc = document.createElement('span');
    mc.className = 'pcard-mi pcard-mi--mc';
    mc.textContent = '3';
    box(mc, 24, 24);
    face.appendChild(frame(false, part(icon('city')), part(prod), part(icon('city')), part(mc)));
    box(face, 320, 460);
    document.body.appendChild(face);
    const ends = resolveEffectIconEnds(face, undefined, [
      {channel: 'production', resource: 'megacredits', amount: 1},
      {channel: 'stock', resource: 'megacredits', amount: 1},
    ]);
    expect(ends[0]?.el.closest('.pcard-prod'), 'the step on the plate — an earlier part of the same frame').is.not.null;
    expect(ends[1]?.el, 'the cash on the last part\'s tile').eq(mc);
  });

  it('a resource the row does not print has no birth place — the token degrades by name, nothing is born out of nowhere', () => {
    const face = hartlanFace();
    const [end] = resolveEffectIconEnds(face, 0, [{channel: 'stock', resource: 'titanium', amount: 1}]);
    expect(end).is.undefined;
  });
});
