import {expect} from 'chai';
import {
  dropTransferEnds, markTransferEndLeft, registerTransferEnds, resetTransferEnds, surfaceClear, surfaceHoldsTokens,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';

/*
 * THE LAW OF THE FOLD (T09 «ПОВЕРХНОСТЬ НЕ СКЛАДЫВАЕТСЯ ПОД СВОИМ ЖЕТОНОМ», ledger BY) — the engine's half. A surface may
 * fold when it is neither the SOURCE of a token still to leave it nor the DESTINATION of a token still to be absorbed on
 * it; `surfaceClear` says when, from the ends the run registered as OBJECTS. A price leaving the rail INTO a printed cost
 * icon on the surface holds it to its absorb (its departure off the rail says nothing about the surface); a gain born on
 * the surface holds it to its pop; both, to both.
 */
describe('surfaceClear — a surface never folds under its own token', () => {
  let surface: HTMLElement;
  let icon: HTMLElement;
  let rail: HTMLElement;
  const price: ResourceTransferSpec = {channel: 'stock', resource: 'plants', amount: 1, direction: 'loss'};
  const gain: ResourceTransferSpec = {channel: 'stock', resource: 'megacredits', amount: 7};

  const settled = async (p: Promise<void>): Promise<boolean> => {
    let done = false;
    void p.then(() => {
      done = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    return done;
  };

  beforeEach(() => {
    surface = document.createElement('div');
    surface.className = 'con-ws con-cardactions';
    icon = document.createElement('i');
    surface.appendChild(icon);
    rail = document.createElement('div');
    rail.className = 'con-res__row';
    document.body.append(surface, rail);
  });

  afterEach(() => {
    resetTransferEnds();
    surface.remove();
    rail.remove();
  });

  it('a PRICE drawn into an icon on the surface holds it to the ABSORB — its departure off the rail is no release', async () => {
    registerTransferEnds(1, price, rail, icon);
    markTransferEndLeft(1);
    expect(surfaceHoldsTokens(surface), 'the token left the rail and is still flying INTO the surface').is.true;
    const clear = surfaceClear(surface);
    expect(await settled(clear)).is.false;
    dropTransferEnds(1);
    expect(await settled(clear), 'absorbed — the surface is clear').is.true;
  });

  it('a GAIN born on the surface holds it to its POP, not to its touchdown on the rail', async () => {
    registerTransferEnds(2, gain, icon, rail);
    const clear = surfaceClear(surface);
    expect(await settled(clear)).is.false;
    markTransferEndLeft(2);
    expect(await settled(clear), 'popped out of its icon — the surface may go while it flies to the rail').is.true;
    expect(surfaceHoldsTokens(rail), 'the rail still receives it').is.true;
  });

  it('both ends on the surface hold it to BOTH (a landing on a composer row born on the hero)', async () => {
    const row = document.createElement('div');
    surface.appendChild(row);
    registerTransferEnds(3, {channel: 'card-resource', resource: 'microbe', amount: 1, targetCard: 'Tardigrades'} as ResourceTransferSpec, icon, row);
    const clear = surfaceClear(surface);
    markTransferEndLeft(3);
    expect(await settled(clear), 'left the hero, still landing on the row').is.false;
    dropTransferEnds(3);
    expect(await settled(clear)).is.true;
  });

  it('several tokens: the LAST one decides', async () => {
    registerTransferEnds(4, price, rail, icon);
    registerTransferEnds(5, gain, icon, rail);
    const clear = surfaceClear(surface);
    markTransferEndLeft(5);
    expect(await settled(clear)).is.false;
    dropTransferEnds(4);
    expect(await settled(clear)).is.true;
  });

  it('an end elsewhere holds nothing; a surface that is gone or absent answers at once (the sentinel speaks for it)', async () => {
    registerTransferEnds(6, gain, rail, rail);
    expect(await settled(surfaceClear(surface))).is.true;
    registerTransferEnds(7, price, rail, icon);
    surface.remove();
    expect(surfaceHoldsTokens(surface)).is.false;
    expect(await settled(surfaceClear(surface))).is.true;
    expect(await settled(surfaceClear(null))).is.true;
    expect(await settled(surfaceClear(undefined))).is.true;
  });
});
