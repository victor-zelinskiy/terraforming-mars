import {expect} from 'chai';
import {resolveGainIconOrigins} from '@/client/console/consoleActionCommitMotion';
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
