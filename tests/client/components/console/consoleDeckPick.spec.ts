import {expect} from 'chai';
import {
  beginDeckPickChoosing, beginDeckPickClearing, beginDeckPickDeal, beginDeckPickSend,
  deckPickHolding, deckPickState, disownDeckPickDeal, endDeckPickCommit, isDeckPickBusy, markBatchDealt,
  resetDeckPick, rollbackDeckPickCommit, saveDeckPickDraft, shouldDealBatch, takeDeckPickDraft,
} from '../../../../src/client/console/deckPick/consoleDeckPick';

/**
 * THE DRAW & SELECT FLOW MODULE.
 *
 * Its whole reason to exist is the window AFTER the submit: the prompt ends the
 * moment the answer reaches the server, but the picks are still flying to the
 * hand dock and the cards left behind have not gone anywhere yet. So the
 * assertions that matter are about the HOLD — when it goes up, what it survives,
 * and that it can never stay up.
 *
 * PURE (no Vue components, no DOM), so it runs under the fast server runner too.
 */
describe('consoleDeckPick', () => {
  beforeEach(() => resetDeckPick());
  after(() => resetDeckPick());

  it('starts idle and holds nothing', () => {
    expect(deckPickState.phase).to.eq('idle');
    expect(deckPickHolding()).to.be.false;
    expect(isDeckPickBusy()).to.be.false;
  });

  it('the deal is not a busy beat — it is the surface arriving, not leaving', () => {
    beginDeckPickDeal();
    expect(deckPickState.phase).to.eq('dealing');
    // `committing` is about the OUTGOING half only: a deal that never gets
    // confirmed must not keep the surface alive past its own prompt.
    expect(deckPickHolding()).to.be.false;
  });

  it('THE HOLD goes up with the submit, not with the response', () => {
    beginDeckPickDeal();
    beginDeckPickChoosing();
    expect(deckPickHolding()).to.be.false;

    beginDeckPickSend(2);
    expect(deckPickState.phase).to.eq('sending');
    expect(deckPickState.kept).to.eq(2);
    // The prompt is already gone by the time the response lands; this is what
    // stops the surface being deleted out from under the flight.
    expect(deckPickHolding()).to.be.true;
    expect(isDeckPickBusy()).to.be.true;
  });

  it('sending → clearing → released, and only then may the surface go', () => {
    beginDeckPickSend(2);
    beginDeckPickClearing();
    expect(deckPickState.phase).to.eq('clearing');
    expect(deckPickHolding()).to.be.true;

    endDeckPickCommit();
    expect(deckPickState.phase).to.eq('idle');
    expect(deckPickHolding()).to.be.false;
    expect(isDeckPickBusy()).to.be.false;
  });

  it('a REFUSED submit gives the screen back instead of stranding a beat', () => {
    beginDeckPickSend(2);
    rollbackDeckPickCommit();
    expect(deckPickState.phase).to.eq('choosing');
    expect(deckPickState.kept).to.eq(0);
    // The hold is down: the prompt is still live, so the ordinary mount gate
    // keeps the surface up — a hold on top of it could never be released.
    expect(deckPickHolding()).to.be.false;
  });

  it('the beats are not navigation destinations — `choosing` cannot walk back into one', () => {
    beginDeckPickSend(2);
    beginDeckPickChoosing();
    expect(deckPickState.phase).to.eq('sending');

    beginDeckPickClearing();
    beginDeckPickChoosing();
    expect(deckPickState.phase).to.eq('clearing');
  });

  it('clearing is only reachable from a live commit (a stray call cannot fake one)', () => {
    beginDeckPickDeal();
    beginDeckPickChoosing();
    beginDeckPickClearing();
    expect(deckPickState.phase).to.eq('choosing');
    expect(deckPickHolding()).to.be.false;
  });

  it('a new deal wipes the previous commit whole (no carried hold, no carried count)', () => {
    beginDeckPickSend(3);
    beginDeckPickDeal();
    expect(deckPickState.phase).to.eq('dealing');
    expect(deckPickState.committing).to.be.false;
    expect(deckPickState.kept).to.eq(0);
  });

  /**
   * ══ THE DEAL PLAYS EXACTLY ONCE PER BATCH ══════════════════════════════
   *
   * The deal is the presentation of a NEW reward batch — keyed on the batch's
   * own identity (the structural prompt key), never on a mount. Collapsing the
   * hosting workspace and reopening the mandatory prompt re-mounts the surface
   * over the SAME server ask; keying on the mount replayed the whole draw.
   */
  describe('the deal-once identity', () => {
    const KEY = 'CardA|CardB|CardC|CardD#2-2';

    it('a NEW batch deals; the SAME batch adopts on every later mount', () => {
      expect(shouldDealBatch(KEY), 'first presentation → deal').to.be.true;
      markBatchDealt(KEY);
      expect(shouldDealBatch(KEY), 'collapse → reopen / inspect / resize → adopt').to.be.false;
      expect(shouldDealBatch('CardE|CardF#1-1'), 'the NEXT batch is new again').to.be.true;
    });

    it('a duplicate render of the same ask cannot double-deal', () => {
      markBatchDealt(KEY);
      markBatchDealt(KEY);
      expect(shouldDealBatch(KEY)).to.be.false;
    });

    it('the reset epoch clears the identity (a new game may deal again)', () => {
      markBatchDealt(KEY);
      resetDeckPick();
      expect(shouldDealBatch(KEY)).to.be.true;
    });
  });

  /**
   * ══ THE PARKED TABLE ═══════════════════════════════════════════════════
   *
   * «Свернуть» keeps the pending choice: the draft picks and the cursor are
   * MODULE state, restored to a remount of the SAME batch and never to a
   * different one. The answer itself is untouched — this is presentation
   * persistence, not a submit.
   */
  describe('the parked draft', () => {
    const KEY = 'CardA|CardB|CardC|CardD#2-2';

    it('survives a park and comes back for the same batch, consumed', () => {
      saveDeckPickDraft(KEY, ['CardA', 'CardC'] as never, 2);
      const back = takeDeckPickDraft(KEY);
      expect(back?.picks).to.deep.eq(['CardA', 'CardC']);
      expect(back?.focusIdx).to.eq(2);
      expect(takeDeckPickDraft(KEY), 'consumed — a second take gets nothing').to.eq(undefined);
    });

    it('a DIFFERENT batch never inherits a stale draft', () => {
      saveDeckPickDraft(KEY, ['CardA'] as never, 0);
      expect(takeDeckPickDraft('CardE|CardF#1-1')).to.eq(undefined);
    });

    it('an ANSWERED batch cannot hand its draft back', () => {
      saveDeckPickDraft(KEY, ['CardA'] as never, 0);
      endDeckPickCommit();
      expect(takeDeckPickDraft(KEY)).to.eq(undefined);
    });
  });

  /*
   * WAIT GRAPH R13 — `dealing` has a ceiling. The deal's ending is the surface's own landing; a landing that never comes
   * ends at the ceiling through the surface's handover (cards shown, input open), and with no surface standing the flow
   * simply rests — never a shut pad or a hydro traversal waiting on a phase nobody will move.
   */
  describe('the deal is bounded (wait graph R13)', () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    it('a deal that never lands is handed over at its ceiling — input opens', async () => {
      let handed = 0;
      beginDeckPickDeal(() => handed++, 30);
      expect(deckPickState.phase).to.eq('dealing');
      await wait(80);
      expect(handed, 'the surface handover ran').to.eq(1);
      expect(deckPickState.phase).to.eq('choosing');
    });

    it('a deal whose surface is gone lets the flow rest at its ceiling', async () => {
      const seq = beginDeckPickDeal(() => {
        throw new Error('a torn-down surface is never asked');
      }, 30);
      disownDeckPickDeal(seq);
      await wait(80);
      expect(deckPickState.phase).to.eq('idle');
    });

    it('a deal that LANDED is never touched by its ceiling', async () => {
      let handed = 0;
      beginDeckPickDeal(() => handed++, 30);
      beginDeckPickChoosing();
      beginDeckPickSend(1); // the player already confirmed
      await wait(80);
      expect(handed).to.eq(0);
      expect(deckPickState.phase).to.eq('sending');
    });

    it('an older deal’s ceiling never ends a newer deal', async () => {
      let first = 0;
      let second = 0;
      beginDeckPickDeal(() => first++, 30);
      beginDeckPickDeal(() => second++, 400); // a re-deal of a new batch before the first ceiling
      await wait(80);
      expect(first).to.eq(0);
      expect(second).to.eq(0);
      expect(deckPickState.phase).to.eq('dealing');
    });
  });
});
