import {expect} from 'chai';
import {
  DrawnRevealPresentationCtx,
  ResultRevealPresentationCtx,
  drawnRevealDetached,
  drawnRevealHeadless,
  drawnRevealViewerOpens,
  resultRevealPresents,
} from '@/client/console/consoleRevealPresentation';

/*
 * WHO PRESENTS A ONE-CARD DRAW — the workspace's own stage, or the headless
 * fullscreen viewer? (ConsoleRevealOverlay reads this decision; the component
 * itself cannot be unit-mounted — its static `Card` import loads a webpack
 * chunk mochapack cannot, which silently zeroes the whole spec file.)
 */

function ctx(over: Partial<DrawnRevealPresentationCtx> = {}): DrawnRevealPresentationCtx {
  return {
    cardCount: 1,
    untakenCount: 1,
    ownedNow: false,
    ownedEver: false,
    hasClosingStep: false,
    ...over,
  };
}

describe('consoleRevealPresentation — headless is for a card NOBODY owns', () => {
  it('an unowned single card IS the fullscreen viewer (the board-cell cover lift)', () => {
    expect(drawnRevealHeadless(ctx())).to.eq(true);
    expect(drawnRevealViewerOpens(ctx())).to.eq(true);
  });

  it('several cards are never headless — the batch keeps its real surface', () => {
    expect(drawnRevealHeadless(ctx({cardCount: 3, untakenCount: 3}))).to.eq(false);
    // …including one taken down to its last card: the mode never flips mid-batch.
    expect(drawnRevealHeadless(ctx({cardCount: 3, untakenCount: 1}))).to.eq(false);
  });

  it('a workspace that owns the batch presents it INSIDE itself, never fullscreen', () => {
    expect(drawnRevealHeadless(ctx({ownedNow: true}))).to.eq(false);
    expect(drawnRevealViewerOpens(ctx({ownedNow: true}))).to.eq(false);
  });

  it('THE TAKE SEAM: the claim is released while the batch is still on screen — ownership is LATCHED', () => {
    // The intake's staged commit takes the card and HOLDS the batch; the
    // `result-detached` emit then folds the workspace and drops the claim, so
    // the live answer is already false — a tick before the batch is dismissed.
    // Reading only `ownedNow` here is what threw the player into a fullscreen
    // viewer of the card that was at that moment flying into their hand.
    const seam = ctx({ownedNow: false, ownedEver: true, untakenCount: 0});
    expect(drawnRevealHeadless(seam)).to.eq(false);
    expect(drawnRevealViewerOpens(seam)).to.eq(false);
  });

  it('a claim that lands LATE still wins — the live term alone suppresses an open', () => {
    expect(drawnRevealHeadless(ctx({ownedNow: true, ownedEver: false}))).to.eq(false);
  });

  it('nothing left to take: the mandatory viewer must not (re-)open over a departed card', () => {
    // The surface itself stays as it is — flipping the PRESENTATION here would
    // blank the modal mid-flight; only the open is withheld.
    expect(drawnRevealHeadless(ctx({untakenCount: 0}))).to.eq(true);
    expect(drawnRevealViewerOpens(ctx({untakenCount: 0}))).to.eq(false);
  });

  it('a payout owing its mandatory closing step keeps the real modal (Pluto, 1 cube)', () => {
    expect(drawnRevealHeadless(ctx({hasClosingStep: true}))).to.eq(false);
  });
});

describe('consoleRevealPresentation — a finished batch whose host let go renders NOWHERE', () => {
  it('the closing tick of an embedded take: everything taken, the workspace folded', () => {
    expect(drawnRevealDetached(ctx({ownedEver: true, ownedNow: false, untakenCount: 0}))).to.eq(true);
  });

  it('cards still to take KEEP their surface — a dropped claim must never strand a prompt', () => {
    // An orphaned claim (reconcileWorkspaceOutcome) or a collapsed workspace
    // drops ownership with the batch untouched: the standalone presenter takes
    // over, and blanking it here would leave the cards nowhere.
    expect(drawnRevealDetached(ctx({ownedEver: true, ownedNow: false, untakenCount: 1}))).to.eq(false);
  });

  it('a payout still owing its closing step is not finished, however empty', () => {
    expect(drawnRevealDetached(ctx({ownedEver: true, ownedNow: false, untakenCount: 0, hasClosingStep: true}))).to.eq(false);
  });

  it('a batch nobody ever owned is not «detached» — it was always standalone', () => {
    expect(drawnRevealDetached(ctx({ownedEver: false, untakenCount: 0}))).to.eq(false);
  });

  it('the host still holds it: the workspace is presenting, not folding', () => {
    expect(drawnRevealDetached(ctx({ownedEver: true, ownedNow: true, untakenCount: 0}))).to.eq(false);
  });
});

describe('consoleRevealPresentation — the deck-check VERDICT belongs to whoever claimed it', () => {
  function rctx(over: Partial<ResultRevealPresentationCtx> = {}): ResultRevealPresentationCtx {
    return {present: true, acknowledged: false, workspaceOwns: false, stageMounted: false, ...over};
  }

  it('a verdict with no parent surface is the standalone overlay\'s (Project Inspection from the band)', () => {
    expect(resultRevealPresents(rctx())).to.eq(true);
  });

  it('nothing to present / already acknowledged', () => {
    expect(resultRevealPresents(rctx({present: false}))).to.eq(false);
    expect(resultRevealPresents(rctx({acknowledged: true}))).to.eq(false);
  });

  it('the workspace\'s own stage is up — the overlay must not double-mount over it', () => {
    expect(resultRevealPresents(rctx({workspaceOwns: true, stageMounted: true}))).to.eq(false);
  });

  /**
   * THE BUG. B on «Действия карт › Поиски жизни › РЕЗУЛЬТАТ ВСКРЫТИЯ» parked the
   * workspace, which UNMOUNTS the composer and clears its `revealClaim` mirror
   * (`resetConsoleActionComposerUi`). `lastReveal` is server state until the
   * player's next input, so with only the mirror to go on the legacy full-bleed
   * modal rose over the board carrying the very verdict just minimized. The
   * CLAIM survives the park, and it is the honest witness.
   */
  it('REGRESSION: a PARKED workspace still owns its verdict — the stage is gone, the claim is not', () => {
    expect(resultRevealPresents(rctx({workspaceOwns: true, stageMounted: false}))).to.eq(false);
  });

  /** The other order: a repeat-reveal points the stage at the chosen card in the
   *  same tick it claims, so the mirror can be the first witness. */
  it('the mounted stage alone also suppresses it (the claim has not landed yet)', () => {
    expect(resultRevealPresents(rctx({workspaceOwns: false, stageMounted: true}))).to.eq(false);
  });
});
