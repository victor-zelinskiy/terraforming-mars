import {expect} from 'chai';
import {
  claimWorkspaceOutcome,
  markWorkspaceOutcomeAnswerIn,
  markWorkspaceOutcomeArrivalDone,
  markWorkspaceOutcomeBeatDone,
  markWorkspaceOutcomePresenting,
  releaseWorkspaceOutcome,
  resetWorkspaceOutcome,
  setWorkspaceOutcomeSlot,
  workspaceClaimsDeckCheck,
  workspaceClaimsDrawReveal,
  workspaceClaimsPick,
  workspaceOutcomeAdmits,
  workspaceOutcomeArrivalPending,
  workspaceOutcomeBeatPending,
  workspaceOutcomeClaimed,
  workspaceOutcomeState,
} from '@/client/console/consoleWorkspaceOutcome';
import {CardName} from '@/common/cards/CardName';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';

const AI_CENTRAL = CardName.AI_CENTRAL as string;
const RESTRICTED = CardName.RESTRICTED_AREA as string;

function cardSource(cardName: string): CardDrawRevealSource {
  return {type: 'card', cardName: cardName as CardName};
}

describe('consoleWorkspaceOutcome — the EMBEDDED claim', () => {
  // Module state is BUNDLE-SHARED under mochapack: a leaked claim would
  // suppress the standalone reveal for every later spec.
  afterEach(() => resetWorkspaceOutcome());

  it('no claim by default — every presenter keeps its own artifact', () => {
    expect(workspaceOutcomeClaimed()).to.eq(false);
    expect(workspaceClaimsDrawReveal(cardSource(AI_CENTRAL))).to.eq(false);
    expect(workspaceClaimsDeckCheck('Search For Life')).to.eq(false);
    expect(workspaceClaimsPick()).to.eq(false);
  });

  it('claims a drawn batch ONLY for the claimed card — a draw from another card is not ours', () => {
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw', 'pick']);
    expect(workspaceClaimsDrawReveal(cardSource(AI_CENTRAL))).to.eq(true);
    expect(workspaceClaimsDrawReveal(cardSource(RESTRICTED))).to.eq(false);
  });

  it('a NON-card source is never claimed — a tile / colony / global bonus keeps its own scene', () => {
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw', 'pick']);
    expect(workspaceClaimsDrawReveal({type: 'tile'})).to.eq(false);
    expect(workspaceClaimsDrawReveal({type: 'other'})).to.eq(false);
    expect(workspaceClaimsDrawReveal({type: 'globalParameter', parameter: 'venus'} as CardDrawRevealSource)).to.eq(false);
    // An UNATTRIBUTED draw is the deck-draw scene's, never a workspace's.
    expect(workspaceClaimsDrawReveal(undefined)).to.eq(false);
  });

  it('the KINDS bound the claim — a deck-check-only claim never swallows a draw or a pick', () => {
    claimWorkspaceOutcome('card-actions', 'Search For Life', ['deck-check']);
    expect(workspaceClaimsDeckCheck('Search For Life')).to.eq(true);
    expect(workspaceOutcomeAdmits('deck-check')).to.eq(true);
    // The surface that has no zone for these must not strand them.
    expect(workspaceClaimsDrawReveal(cardSource('Search For Life'))).to.eq(false);
    expect(workspaceClaimsPick()).to.eq(false);
  });

  it('a deck-check claim matches the ACTING card, not any card', () => {
    claimWorkspaceOutcome('card-actions', 'Search For Life', ['deck-check']);
    expect(workspaceClaimsDeckCheck('Asteroid Deflection System')).to.eq(false);
    expect(workspaceClaimsDeckCheck(undefined)).to.eq(false);
  });

  it('an EMPTY kind list is a no-op, not a claim on everything', () => {
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, []);
    expect(workspaceOutcomeClaimed()).to.eq(false);
    expect(workspaceClaimsDrawReveal(cardSource(AI_CENTRAL))).to.eq(false);
  });

  it('release drops the claim AND the teleport slot — a stale selector would swallow the next batch', () => {
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw']);
    setWorkspaceOutcomeSlot('[data-embed-slot="workspace-reveal"]');
    markWorkspaceOutcomePresenting();
    expect(workspaceOutcomeState.stage).to.eq('presenting');

    releaseWorkspaceOutcome();
    expect(workspaceOutcomeClaimed()).to.eq(false);
    expect(workspaceOutcomeState.embedSlot).to.eq('');
    expect(workspaceOutcomeState.stage).to.eq('idle');
    expect(workspaceClaimsDrawReveal(cardSource(AI_CENTRAL))).to.eq(false);
  });

  it('presenting DISARMS the backstop — a long read must never expire the claim under the player', () => {
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw']);
    markWorkspaceOutcomePresenting();
    // The timer guards «claimed and nothing came»; once something is on screen
    // that question is settled and the artifact's own lifecycle takes over.
    // (Asserted structurally: the claim survives with no pending timer, so the
    // only thing that can end it now is an explicit release.)
    expect(workspaceOutcomeState.stage).to.eq('presenting');
    expect(workspaceOutcomeClaimed()).to.eq(true);
  });

  /**
   * REGRESSION. The shell closes the (voluntary) card-action center whenever
   * the top prompt is no longer the action menu. That rule predates embedded
   * outcomes and read EVERY non-menu prompt as "someone else's" — so buying a
   * revealed card tore the workspace down mid-flow and handed the prompt to a
   * standalone band: «ДЕЙСТВИЯ КАРТ» vanished and an unrelated window took its
   * place. `workspaceOutcomeClaimed()` is the exemption the shell now checks;
   * if this ever goes false while an outcome is live, that bug is back.
   */
  it('REGRESSION: a live claim is VISIBLE to the shell\'s voluntary-surface close rule', () => {
    expect(workspaceOutcomeClaimed()).to.eq(false);
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw', 'pick']);
    // True from the confirm onward — BEFORE anything has been re-homed, which
    // is exactly the window the close rule fires in.
    expect(workspaceOutcomeClaimed()).to.eq(true);
    expect(workspaceOutcomeState.stage).to.eq('awaiting');
    markWorkspaceOutcomePresenting();
    expect(workspaceOutcomeClaimed()).to.eq(true);
    releaseWorkspaceOutcome();
    expect(workspaceOutcomeClaimed()).to.eq(false);
  });

  /**
   * COLLAPSE → RESTORE. A real minimize CLOSES the surface (that is the only
   * way the board goes live and the «вернуться» prompt appears), so the
   * component is destroyed — and the committed decision has to survive that in
   * module state, or the player comes back to nothing. Card AND variant.
   */
  it('the committed decision survives the surface being destroyed (collapse → restore)', () => {
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw', 'pick'], 2);
    markWorkspaceOutcomePresenting();
    // The surface unmounts on collapse and retracts its teleport slot…
    setWorkspaceOutcomeSlot('');
    // …but everything needed to rebuild the committed stage is still here.
    expect(workspaceOutcomeClaimed()).to.eq(true);
    expect(workspaceOutcomeState.sourceCard).to.eq(AI_CENTRAL);
    expect(workspaceOutcomeState.nodeIndex).to.eq(2);
    expect(workspaceOutcomeState.stage).to.eq('presenting');
    // The prompt is STILL routed to the workspace, so restoring re-opens it
    // rather than letting the prompt rise as a standalone band.
    expect(workspaceClaimsPick()).to.eq(true);
    // The execution beat already played; it is not owed a second time.
    expect(workspaceOutcomeState.answerIn).to.eq(false);
  });

  /**
   * THE EXECUTION BEAT is an animation, not a stall. `answerIn` and `beatDone`
   * are deliberately SEPARATE: the beat starts at the confirm (a card back
   * needs no data) and turns over on the answer. Collapsing them into one flag
   * — or gating the answer on the beat — deadlocks the flow.
   */
  it('the beat and the answer are independent: it starts before the answer and ends after it', () => {
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw', 'pick']);
    // At the confirm: the card is already travelling, nothing has answered.
    expect(workspaceOutcomeState.answerIn).to.eq(false);
    expect(workspaceOutcomeBeatPending()).to.eq(true);

    // The answer lands — the card may turn over, but the beat is not over yet
    // (a fast server must still watch the flip, not skip it).
    markWorkspaceOutcomeAnswerIn();
    expect(workspaceOutcomeState.answerIn).to.eq(true);
    expect(workspaceOutcomeBeatPending()).to.eq(true);

    // The flight settles — only now may the real surface take the zone.
    markWorkspaceOutcomeBeatDone();
    expect(workspaceOutcomeBeatPending()).to.eq(false);
  });

  it('the answer flag needs a live claim — a stray publish cannot arm a dead flow', () => {
    expect(workspaceOutcomeClaimed()).to.eq(false);
    markWorkspaceOutcomeAnswerIn();
    expect(workspaceOutcomeState.answerIn).to.eq(false);
  });

  it('a new activation re-arms the beat (the previous flight never satisfies the next)', () => {
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw']);
    markWorkspaceOutcomeAnswerIn();
    markWorkspaceOutcomeBeatDone();
    expect(workspaceOutcomeBeatPending()).to.eq(false);

    claimWorkspaceOutcome('card-actions', RESTRICTED, ['draw']);
    expect(workspaceOutcomeState.answerIn).to.eq(false);
    expect(workspaceOutcomeBeatPending()).to.eq(true);
  });

  it('nodeIndex defaults to 0 and is cleared on release (no bleed into the next activation)', () => {
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw'], 3);
    expect(workspaceOutcomeState.nodeIndex).to.eq(3);
    releaseWorkspaceOutcome();
    expect(workspaceOutcomeState.nodeIndex).to.eq(0);
    claimWorkspaceOutcome('card-actions', RESTRICTED, ['draw']);
    expect(workspaceOutcomeState.nodeIndex).to.eq(0);
  });

  it('a fresh claim REPLACES the previous one (a second activation never inherits the first)', () => {
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw']);
    claimWorkspaceOutcome('card-actions', RESTRICTED, ['draw']);
    expect(workspaceClaimsDrawReveal(cardSource(AI_CENTRAL))).to.eq(false);
    expect(workspaceClaimsDrawReveal(cardSource(RESTRICTED))).to.eq(true);
  });

  /**
   * THE ARRIVAL GATE — deliberately later than `beatDone`. That one releases
   * the SURFACE (so it can mount and be measured under the still-flying
   * proxies); this one releases the PLAYER. Between the two the real cards are
   * held invisible beneath their proxies, and a focus ring or an «A Взять»
   * there would point at an empty slot and accept a press for a card that has
   * not landed.
   */
  describe('the arrival gate', () => {
    it('opens closed for a CARD outcome and only the arrival opens it', () => {
      claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw', 'pick'], 0, 2);
      expect(workspaceOutcomeArrivalPending()).to.eq(true);
      // The beat finishing is NOT enough — the handoff still owes its frames.
      markWorkspaceOutcomeBeatDone();
      expect(workspaceOutcomeArrivalPending()).to.eq(true);
      markWorkspaceOutcomeArrivalDone();
      expect(workspaceOutcomeArrivalPending()).to.eq(false);
    });

    it('never closes for a deck CHECK — that result presents in the composer itself', () => {
      // Leaving it shut there would strand the input of a stage that has no
      // flying batch to wait for.
      claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['deck-check']);
      expect(workspaceOutcomeArrivalPending()).to.eq(false);
    });

    it('is open whenever nothing is claimed (a standalone reveal is never gated)', () => {
      expect(workspaceOutcomeArrivalPending()).to.eq(false);
      claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw']);
      releaseWorkspaceOutcome();
      expect(workspaceOutcomeArrivalPending()).to.eq(false);
    });

    it('carries the PROMISED card count — the batch is planned before it moves', () => {
      // The count has to exist before the first frame (N cards leave the pile,
      // N slots are prepared), and on a slow server the answer is not back yet.
      claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw', 'pick'], 0, 3);
      expect(workspaceOutcomeState.expectedCards).to.eq(3);
      releaseWorkspaceOutcome();
      expect(workspaceOutcomeState.expectedCards).to.eq(0);
    });

    it('a second activation never inherits the first batch\'s size or gate', () => {
      claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw'], 0, 4);
      markWorkspaceOutcomeArrivalDone();
      claimWorkspaceOutcome('card-actions', RESTRICTED, ['draw'], 0, 1);
      expect(workspaceOutcomeState.expectedCards).to.eq(1);
      expect(workspaceOutcomeArrivalPending()).to.eq(true);
    });
  });
});
