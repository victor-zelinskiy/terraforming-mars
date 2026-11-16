/*
 * THE AWAITING HANDOFF'S EXPIRY IS FOR A LOST RESPONSE (FLAKE ZERO · class N — `cardActionsController.ts`).
 *
 * The composer's commit holds the stage through the round trip (`beginAwaitingHandoff`); a belt-and-braces expiry,
 * counted from the SUBMIT, clears it and closes the layers if nothing ever answers. But an ANSWER that resolved the
 * commit keeps the awaiting standing on purpose while its FOLD is owed (`commitFoldOwed`: a token still in the air off
 * the surface, a dismissal parked on the commit beat's settle): on a slow renderer those tokens outlived the submit's
 * budget and the expiry closed the layers under them. Past the answer the net waits for the fold, up to its own
 * ceiling.
 */
import {expect} from 'chai';
import {effectScope, EffectScope} from 'vue';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {AWAITING_FOLD_OWED_MAX_MS, CardActionsPort, createCardActionsController} from '@/client/console/shell/cardActionsController';
import {clearAwaitingHandoff, surfaceMotionState} from '@/client/console/surfaceMotion/surfaceMotionState';
import {AWAITING_SAFETY_MS} from '@/client/console/surfaceMotion/surfaceMotionModel';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import {PlayerViewModel} from '@/common/models/PlayerModel';

describe('card actions · the awaiting handoff\'s expiry waits for an OWED fold', () => {
  let clock: ManualFlowClock;
  let es: EffectScope;
  let port: CardActionsPort;

  beforeEach(() => {
    clearAwaitingHandoff();
    clock = createManualClock(0);
    setFlowClock(clock);
    port = {
      armLawPlayLanding: () => {},
      collapseWorkspace: () => {},
      commitFoldOwed: false,
      concludeWorkspaceFlowOrOwe: () => true,
      parliamentLeaveRelease: undefined,
      playerView: {game: {gameAge: 7, undoCount: 0}} as unknown as PlayerViewModel,
      submitBatch: () => ({accepted: true}) as unknown as SubmitTicket,
      wheelCounts: {cardActions: 0} as CardActionsPort['wheelCounts'],
    };
    es = effectScope();
  });
  afterEach(() => {
    es.stop();
    clearAwaitingHandoff();
    setFlowClock(undefined);
  });

  function submit(): void {
    const controller = es.run(() => createCardActionsController(port))!;
    controller.onCardActionsSubmitBatch([]);
    expect(surfaceMotionState.awaiting, 'the commit holds the stage').to.not.eq(undefined);
  }

  it('a LOST response: nothing answered — the stage is let go at the submit\'s budget, as before', () => {
    submit();
    clock.advance(AWAITING_SAFETY_MS + 249);
    expect(surfaceMotionState.awaiting).to.not.eq(undefined);
    clock.advance(1);
    expect(surfaceMotionState.awaiting, 'expired').to.eq(undefined);
  });

  it('an ANSWERED commit whose fold is owed: the expiry steps aside — the fold ends the awaiting', () => {
    submit();
    // The answer resolved the commit: its tokens are still in the air off the surface, the fold is owed.
    port.commitFoldOwed = true;
    clock.advance(AWAITING_SAFETY_MS + 250 + 3000);
    expect(surfaceMotionState.awaiting, 'the stage still stands under the tokens').to.not.eq(undefined);
    // The fold runs on its own (its tokens left the surface): it clears the awaiting itself.
    port.commitFoldOwed = false;
    clearAwaitingHandoff();
    clock.advance(AWAITING_FOLD_OWED_MAX_MS * 2);
    expect(clock.pending(), 'nothing left armed past the fold').to.eq(0);
  });

  it('a fold that NEVER runs is still bounded — by its own ceiling, counted from the submit\'s expiry', () => {
    submit();
    port.commitFoldOwed = true;
    clock.advance(AWAITING_SAFETY_MS + 250);
    clock.advance(AWAITING_FOLD_OWED_MAX_MS - 1);
    expect(surfaceMotionState.awaiting).to.not.eq(undefined);
    clock.advance(1);
    expect(surfaceMotionState.awaiting, 'the never-happened net').to.eq(undefined);
  });
});
