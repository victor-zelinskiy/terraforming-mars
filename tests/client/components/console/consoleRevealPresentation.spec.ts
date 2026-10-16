import {expect} from 'chai';
import {
  DrawnRevealPresentationCtx,
  ResultRevealPresentationCtx,
  drawnRevealDetached,
  drawnRevealHeadless,
  drawnRevealViewerOpens,
  drawnBatchGoesFullscreen,
  LONE_REWARD_CARD_FULLSCREEN,
  resultRevealPresentation,
} from '@/client/console/consoleRevealPresentation';

/*
 * WHO PRESENTS A DRAWN BATCH — the workspace's own stage, the standalone scene,
 * or (retired by TR57) the headless fullscreen viewer? (ConsoleRevealOverlay reads this decision; the component
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

describe('consoleRevealPresentation — ONE event, ONE scene: a lone reward card is never the fullscreen (TR57, decision 4)', () => {
  /*
   * THE REASON. A lone card from a board cell opened the fullscreen INSPECTOR — lore and rules for a simple reward,
   * its own chip bar over a dimmed shell bar repeating the same verbs — while two cards of the same cell stood in the
   * scene. One event spoke two languages. The scene is now the presentation for any count; the viewer opens on X.
   */
  it('an unowned single card stands in the scene (the board-cell cover lift) — no headless, no viewer opened for it', () => {
    expect(LONE_REWARD_CARD_FULLSCREEN).to.eq(false);
    expect(drawnRevealHeadless(ctx())).to.eq(false);
    expect(drawnRevealViewerOpens(ctx())).to.eq(false);
  });

  it('the scenes ask the SAME decision at their arm — a lone card flies into its slot, never to a presentation point', () => {
    expect(drawnBatchGoesFullscreen(1, false)).to.eq(false);
    expect(drawnBatchGoesFullscreen(1, true)).to.eq(false);
    expect(drawnBatchGoesFullscreen(3, false)).to.eq(false);
  });

  it('several cards are never headless — the batch keeps its real surface, taken down to one or not', () => {
    expect(drawnRevealHeadless(ctx({cardCount: 3, untakenCount: 3}))).to.eq(false);
    expect(drawnRevealHeadless(ctx({cardCount: 3, untakenCount: 1}))).to.eq(false);
  });

  it('a workspace that owns the batch presents it INSIDE itself; the take seam stays latched', () => {
    expect(drawnRevealHeadless(ctx({ownedNow: true}))).to.eq(false);
    expect(drawnRevealHeadless(ctx({ownedNow: false, ownedEver: true, untakenCount: 0}))).to.eq(false);
    expect(drawnRevealViewerOpens(ctx({ownedNow: false, ownedEver: true, untakenCount: 0}))).to.eq(false);
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
    return {
      present: true, acknowledged: false, workspaceOwns: false,
      hostDrawsItself: false, stageMounted: false, ...over,
    };
  }

  it('a verdict with no parent surface is the standalone band\'s — that is what it is FOR', () => {
    expect(resultRevealPresentation(rctx())).to.eq('standalone');
  });

  it('nothing to present / already acknowledged', () => {
    expect(resultRevealPresentation(rctx({present: false}))).to.eq('none');
    expect(resultRevealPresentation(rctx({acknowledged: true}))).to.eq('none');
  });

  /** «ДЕЙСТВИЯ КАРТ» draws its own verdict stage (hero column + deck flight +
   *  source FLIP): re-homing the overlay into it would be a second copy. */
  it('a host that draws its own verdict takes the overlay NOWHERE', () => {
    expect(resultRevealPresentation(rctx({workspaceOwns: true, hostDrawsItself: true, stageMounted: true})))
      .to.eq('none');
  });

  /**
   * THE NORTH STAR. A repeated action played from the hand («Проверка проекта»)
   * and the Hydronetwork's stage-7 copy are workspaces too — the press was made
   * inside them, so the verdict is THEIR stage. They have no verdict surface of
   * their own, so the SAME overlay is re-homed into their zone.
   */
  it('a claiming host with no verdict stage of its own gets the RE-HOMED overlay', () => {
    expect(resultRevealPresentation(rctx({workspaceOwns: true}))).to.eq('embedded');
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
    expect(resultRevealPresentation(rctx({workspaceOwns: true, hostDrawsItself: true, stageMounted: false})))
      .to.eq('none');
  });

  /** The other order: a repeat-reveal points the stage at the chosen card in the
   *  same tick it claims, so the mirror can be the first witness. */
  it('the mounted stage alone also suppresses the band (the claim has not landed yet)', () => {
    expect(resultRevealPresentation(rctx({workspaceOwns: false, stageMounted: true}))).to.eq('none');
  });
});
