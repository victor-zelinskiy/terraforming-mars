import {expect} from 'chai';
import {resolveGainIconOrigins, resolveSpendIconOrigins} from '@/client/console/consoleActionCommitMotion';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';

/*
 * WHERE A TOKEN IS BORN — `resolveGainIconOrigins` maps each flown gain to the
 * centre of the PRINTED icon that pays it. Two printed icons of one resource
 * are two sources (TR27 Aurora Station's «[floater·V] [floater·V]»): the k-th
 * token of a resource is born on the k-th icon that prints it, never two
 * tokens on one; a row that prints fewer icons than tokens falls back to the
 * first.
 */
function icon(bg: string, left: number): HTMLElement {
  const el = document.createElement('span');
  el.className = 'pcard-ic';
  el.style.backgroundImage = `url(assets/resources/${bg}.png)`;
  el.getBoundingClientRect = () => ({left, top: 100, width: 20, height: 20, right: left + 20, bottom: 120, x: left, y: 100, toJSON: () => ({})}) as DOMRect;
  return el;
}

describe('resolveGainIconOrigins — a token is born on ITS OWN printed icon', () => {
  const floater = (): ResourceTransferSpec => ({channel: 'card-resource', resource: 'floater', amount: 1, targetCard: 'Floating Habs' as never});

  it('two floater tokens, two floater icons: two different birth points, in print order', () => {
    const result = document.createElement('div');
    result.append(icon('floater', 10), icon('floater', 50));
    const origins = resolveGainIconOrigins({cardEl: result, resultEl: result}, [floater(), floater()]);
    expect(origins).deep.eq([{x: 20, y: 110}, {x: 60, y: 110}]);
  });

  it('more tokens than printed icons: the extra token falls back to the first icon (never undefined)', () => {
    const result = document.createElement('div');
    result.append(icon('floater', 10));
    const origins = resolveGainIconOrigins({cardEl: result, resultEl: result}, [floater(), floater()]);
    expect(origins).deep.eq([{x: 20, y: 110}, {x: 20, y: 110}]);
  });
});

/*
 * WHERE A PRICE LANDS (PL-099, the rail-spend law) — `resolveSpendIconOrigins` maps a stock price's token to the
 * printed icon of that resource in the variant's COST cluster (the part before the arrow): «[plant] → [7 M€]»
 * absorbs the plant at the plant, never at the 7; a M€ price lands on the tile that prints it.
 */
describe('resolveSpendIconOrigins — a price is absorbed at the printed icon of that very cost', () => {
  const price = (resource: string, amount = 1): ResourceTransferSpec => ({channel: 'stock', resource, amount, direction: 'loss'});
  function mcTile(text: string, left: number): HTMLElement {
    const el = document.createElement('span');
    el.className = 'pcard-mi pcard-mi--mc';
    el.textContent = text;
    el.getBoundingClientRect = () => ({left, top: 100, width: 20, height: 20, right: left + 20, bottom: 120, x: left, y: 100, toJSON: () => ({})}) as DOMRect;
    return el;
  }

  it('the plant lands on the cost cluster\'s plant icon, not on the result\'s M€ tile', () => {
    const group = document.createElement('div');
    const cost = document.createElement('div');
    cost.append(icon('plant', 10));
    const result = document.createElement('div');
    result.append(mcTile('7', 90));
    group.append(cost, result);
    const anchors = {cardEl: group, groupEl: group, resultEl: result, costEl: cost};
    expect(resolveSpendIconOrigins(anchors, [price('plants')])).deep.eq([{x: 20, y: 110}]);
    expect(resolveGainIconOrigins(anchors, [{channel: 'stock', resource: 'megacredits', amount: 7}]), 'the gain is still born on the result tile').deep.eq([{x: 100, y: 110}]);
  });

  it('a M€ price lands on the cost tile that prints it; with no cost cluster the whole group is searched', () => {
    const group = document.createElement('div');
    const cost = document.createElement('div');
    cost.append(mcTile('7', 10));
    group.append(cost);
    expect(resolveSpendIconOrigins({cardEl: group, groupEl: group, resultEl: group, costEl: cost}, [price('megacredits', 7)])).deep.eq([{x: 20, y: 110}]);
    expect(resolveSpendIconOrigins({cardEl: group, groupEl: group, resultEl: group}, [price('megacredits', 7)])).deep.eq([{x: 20, y: 110}]);
  });
});
