import {expect} from 'chai';
import {computed} from 'vue';
import {
  boundSurfaceFrameHold, dropTransferEnds, markTransferEndLeft, oweSurfaceTokens, registerTransferEnds, resetTransferEnds, settleSurfaceDebt, surfaceClear,
  surfaceHoldsTokens, surfaceKeepsItsFrame, witnessFrameLeft,
} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {causeOf} from '@/common/diagnostics/cause';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {LEAVE_WAITS_TOKENS_ATTR, leaveAfterTokens} from '@/client/console/surfaceMotion/leaveAfterTokens';

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

  /*
   * A SURFACE LEAVES AFTER ITS TOKENS (`leaveAfterTokens` — CI #146, game 1183): whichever verb took the frame off (the
   * generation scene's rise into a sitting, 67 ms after the play), the surface's LEAVE waits for the token born on it.
   */
  it('THE LEAVE WAITS: a gain still being born on the surface keeps it standing, inert, marked — its leave plays after the pop', async () => {
    registerTransferEnds(5, gain, icon, rail);
    let left = false;
    leaveAfterTokens(surface, false, () => {
      left = true;
    });
    expect(left, 'the surface stays for its token').is.false;
    expect(surface.hasAttribute(LEAVE_WAITS_TOKENS_ATTR), 'marked — the fold\'s witness reads it').is.true;
    expect(surface.style.pointerEvents, 'and answers no pointer').eq('none');
    markTransferEndLeft(5);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(left, 'popped — the leave plays').is.true;
    expect(surface.hasAttribute(LEAVE_WAITS_TOKENS_ATTR)).is.false;
  });

  it('…and a surface with nothing standing on it leaves at once (the ordinary road is untouched)', () => {
    let left = false;
    leaveAfterTokens(surface, true, () => {
      left = true;
    });
    expect(left).is.true;
    expect(surface.style.position, 'never pinned for nothing').eq('');
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

  /*
   * A SERIES OF RUNS IS ONE DEBT (CI, `fz3` · CPU ×4 · `arwind-sitting-win-solo`, 2026-11-18): the Parliament pays the
   * steel's wave, then the titanium's — one run each, and no token at all between them. The B owed since the steel left
   * folded the surface in that gap, under the titanium's birth.
   */
  it('a host that pays IN TURN holds the surface between two of its runs — to the last wave, not to the first', async () => {
    oweSurfaceTokens('parliament-reward', surface);
    registerTransferEnds(5, gain, icon, rail);
    const clear = surfaceClear(surface);
    markTransferEndLeft(5);
    dropTransferEnds(5);
    expect(surfaceHoldsTokens(surface), 'the first wave landed, the second is not born yet: the surface is still owed').is.true;
    expect(await settled(clear), 'a fold that waited for the first wave waits on').is.false;
    registerTransferEnds(6, gain, icon, rail);
    markTransferEndLeft(6);
    dropTransferEnds(6);
    expect(await settled(clear), 'the host has not said the series is over').is.false;
    settleSurfaceDebt('parliament-reward');
    expect(await settled(clear), 'the last wave landed: the surface is clear').is.true;
    expect(surfaceHoldsTokens(surface)).is.false;
    // A debt on ANOTHER surface holds nothing here; settling twice is nothing.
    oweSurfaceTokens('parliament-reward', rail);
    expect(surfaceHoldsTokens(surface)).is.false;
    settleSurfaceDebt('parliament-reward');
    settleSurfaceDebt('parliament-reward');
    // No surface to owe (the carrier is not on screen): nothing is held.
    oweSurfaceTokens('parliament-reward', null);
    expect(surfaceHoldsTokens(surface)).is.false;
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

  /*
   * THE FOLD's OWN WITNESS, IN SHADOW (freeze zero — CI `fz0` · duo, `arwind-chairman-quest-solo`, 2026-11-19): the
   * sentinel judges a fold at the token's END and cannot say which verb took the surface away. This one is asked at
   * the fold: a frame left the live stack while its surface held a token's end or an owed series. Counted, by the
   * workspace and with the verb in the line — never an event until its walks are read.
   */
  /*
   * THE TOKENS KEEP THEIR FRAME (the zero bar, game 1289 of the fourth hundred — «Точная организация»: «Взять всё» on
   * the drawn batch released the claim, the one thing that kept the frame, and the workspace left under a price still
   * landing and a gain still being born). The guarded conclusion asks the surface — through a CACHE (its facts are a
   * computed's), so the answer must move at a reactive edge (invariant 17), and it is bounded.
   */
  it('THE QUESTION OF THE FRAME is reactive: a cached reader hears a token arrive, leave its source and be absorbed', () => {
    const keeps = computed(() => surfaceKeepsItsFrame(surface));
    expect(keeps.value, 'a quiet surface keeps nothing').to.eq(false);
    registerTransferEnds(31, price, rail, icon);   // the price: lands on the printed icon
    registerTransferEnds(32, gain, icon, rail);    // the gain: born on it
    expect(keeps.value, 'the cache heard the tokens').to.eq(true);
    markTransferEndLeft(32);
    expect(keeps.value, 'the gain has popped off — the price still lands here').to.eq(true);
    dropTransferEnds(32);
    dropTransferEnds(31);
    expect(keeps.value, 'the last token absorbed: the frame may go').to.eq(false);
    // …and a series a host still owes holds it the same way.
    oweSurfaceTokens('host', surface);
    expect(keeps.value).to.eq(true);
    settleSurfaceDebt('host');
    expect(keeps.value).to.eq(false);
  });

  it('…and BOUNDED: the hold is the wait of `surfaceClear` — when the tokens land it is over, and a surface with none is never bounded', async () => {
    const keeps = computed(() => surfaceKeepsItsFrame(surface));
    boundSurfaceFrameHold(surface);                 // nothing stands: a no-op
    expect(keeps.value).to.eq(false);
    registerTransferEnds(41, price, rail, icon);
    boundSurfaceFrameHold(surface);
    boundSurfaceFrameHold(surface);                 // idempotent
    expect(keeps.value, 'held while the price lands').to.eq(true);
    dropTransferEnds(41);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(keeps.value, 'landed: the hold is over').to.eq(false);
    // The next token on the same surface holds it again (nothing was «waited out»).
    registerTransferEnds(42, gain, icon, rail);
    expect(keeps.value).to.eq(true);
    dropTransferEnds(42);
  });

  it('THE FOLD IS WITNESSED WHERE IT HAPPENS: a frame that leaves holding a token is named with its verb — a defect on a page that paints, the honest end of one that does not', () => {
    const said: Array<string> = [];
    const warn = console.warn;
    console.warn = (...args: Array<unknown>) => said.push(args.map(String).join(' '));
    try {
      // Nothing on the surface: a frame may leave.
      witnessFrameLeft('card-actions', 'leaveWorkspace', surface);
      witnessFrameLeft('card-actions', 'leaveWorkspace', null);
      expect(said).to.deep.eq([]);
      // A price still to be absorbed on it:
      registerTransferEnds(8, price, rail, icon);
      witnessFrameLeft('card-actions', 'closePhaseRoot:parliament', surface);
      expect(said).to.have.length(1);
      expect(said[0]).to.match(/^\[transfer\] a frame left with tokens on its surface — «card-actions» by closePhaseRoot:parliament, holding /);
      const cause = causeOf(said[0], 'warn');
      expect(cause?.cls).to.eq('transfer/frame-left-holding/card-actions');
      // On a page that PAINTS a frame leaving under its own token is the law broken — a defect, with the verb…
      expect(cause?.tier).to.eq('defect');
      // …and on a page that does not paint (the line says so) no flight was ever started: that page's honest end.
      expect(causeOf(`${said[0]} (planned: the page gave the motion 33 of 1780 ms — a motion cannot keep its bound on a page that does not paint)`, 'warn')?.tier)
        .to.eq('planned');
      // …and a series the host still owes holds it as a token does.
      dropTransferEnds(8);
      oweSurfaceTokens('reward', surface);
      witnessFrameLeft('card-actions', '', surface);
      expect(said[1]).to.match(/by an unnamed verb, holding owed by reward/);
      settleSurfaceDebt('reward');
    } finally {
      console.warn = warn;
    }
  });
});
