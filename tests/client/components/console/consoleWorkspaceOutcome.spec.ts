import {expect} from 'chai';
import {
  claimWorkspaceOutcome,
  markWorkspaceOutcomeAnswerIn,
  markWorkspaceOutcomeArrivalDone,
  markWorkspaceOutcomeArrivalFlown,
  markWorkspaceOutcomeBeatDone,
  markWorkspaceOutcomePresenting,
  outcomeHostConcludesFlow,
  releaseWorkspaceOutcome,
  resetWorkspaceOutcome,
  retainWorkspaceOutcomeForNextBatch,
  setWorkspaceOutcomeSlot,
  workspaceClaimsColonyReveal,
  workspaceClaimsDeckCheck,
  workspaceClaimsDrawReveal,
  workspaceClaimsPick,
  workspaceOutcomeAdmits,
  workspaceOutcomeArrivalFlown,
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
  });

  /**
   * AN UNATTRIBUTED DRAW IS THE OPEN WORKSPACE'S (contract change, 2026-08-14).
   *
   * This spec used to assert the opposite — «an unattributed draw is the
   * deck-draw scene's, never a workspace's» — and that is what shipped
   * Celestic's first action as a standalone full-bleed «Получены карты» over
   * a start workspace that was standing right behind it, source seat and all.
   * The server names a source from the running event scope and not every
   * effect establishes one, so «no source» does not mean «not ours»; it means
   * NOTHING IS KNOWN. Every presenter that could compete for a batch is
   * identified BY its source (tile / colony / global parameter — asserted
   * above), so a sourceless batch has no other owner, and a modal over an
   * open workspace is never the answer: if a workspace is open, it hosts the
   * draw.
   */
  it('an UNATTRIBUTED draw belongs to the open workspace — a modal over it never does', () => {
    expect(workspaceClaimsDrawReveal(undefined), 'no claim → nobody to give it to').to.eq(false);
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw', 'pick']);
    expect(workspaceClaimsDrawReveal(undefined)).to.eq(true);
    // …but only when the claim admits DRAWS at all.
    resetWorkspaceOutcome();
    claimWorkspaceOutcome('card-actions', 'Search For Life', ['deck-check']);
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

  /**
   * A REPEAT commits one card and the server attributes the verdict to the card
   * whose action actually RAN: «Проверка проекта» is played, «Поиски жизни»
   * turns the card over. Keyed on the name alone that verdict matched no claim
   * and left for the full-bleed modal over the very workspace whose press had
   * produced it — the same reason a draw's claim carries a scope.
   */
  it('a CHAIN claim answers for the whole causal chain — the repeated card\'s verdict included', () => {
    claimWorkspaceOutcome('hand', 'Project Inspection', ['draw', 'pick', 'deck-check'], 0, 0, 'chain');
    expect(workspaceClaimsDeckCheck('Search For Life')).to.eq(true);
    // …but the KINDS still bound it: a play that copies nothing revealing
    // claims no verdict at all.
    resetWorkspaceOutcome();
    claimWorkspaceOutcome('hand', 'Project Inspection', ['draw', 'pick'], 0, 0, 'chain');
    expect(workspaceClaimsDeckCheck('Search For Life')).to.eq(false);
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

  /**
   * WHO PHYSICALLY FLEW THE CARDS. An arriving surface that deals its own batch
   * off the deck (the draw & select screen) must adopt the host's landed cards
   * instead of pulling a second batch off the same pile.
   */
  describe('the arrival-flown fact', () => {
    it('is false until a beat actually launches — a surface with no host beat deals as usual', () => {
      claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw', 'pick'], 0, 2);
      expect(workspaceOutcomeArrivalFlown()).to.eq(false);
      markWorkspaceOutcomeArrivalFlown();
      expect(workspaceOutcomeArrivalFlown()).to.eq(true);
    });

    it('is never claimed with no claim standing (a standalone deck pick owns its own deal)', () => {
      markWorkspaceOutcomeArrivalFlown();
      expect(workspaceOutcomeArrivalFlown()).to.eq(false);
    });

    it('a second activation starts from scratch — one draw\'s flight never covers the next', () => {
      claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw', 'pick'], 0, 2);
      markWorkspaceOutcomeArrivalFlown();
      claimWorkspaceOutcome('card-actions', RESTRICTED, ['draw', 'pick'], 0, 2);
      expect(workspaceOutcomeArrivalFlown()).to.eq(false);
    });

    it('is dropped with the claim', () => {
      claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw'], 0, 1);
      markWorkspaceOutcomeArrivalFlown();
      releaseWorkspaceOutcome();
      expect(workspaceOutcomeArrivalFlown()).to.eq(false);
    });
  });

  /**
   * THE CHAIN SCOPE — a card PLAY answers for everything one press sets off.
   *
   * The server attributes a draw to the card whose EFFECT ran, and a triggered
   * effect is not the card the player pressed: Point Luna's «сыграв метку
   * Земли, возьмите карту» fires on its own play and on every later Earth-tag
   * card. Keyed on the pressed name alone, those batches matched no claim and
   * left for a fullscreen viewer over a workspace that had already let go.
   */
  describe('the claim SCOPE', () => {
    it('a CHAIN claim answers for a draw a triggered effect made — the pressed card is not the drawer', () => {
      claimWorkspaceOutcome('hand', RESTRICTED, ['draw', 'pick'], 0, 0, 'chain');
      // The played card's own draw…
      expect(workspaceClaimsDrawReveal(cardSource(RESTRICTED))).to.eq(true);
      // …and the draw its Earth tag triggered on the corporation.
      expect(workspaceClaimsDrawReveal(cardSource(CardName.POINT_LUNA))).to.eq(true);
    });

    it('a CHAIN claim is still bounded by the SOURCE TYPE and the kinds', () => {
      claimWorkspaceOutcome('hand', RESTRICTED, ['draw'], 0, 0, 'chain');
      // A tile / colony / global-parameter payout keeps its own scene: those
      // are things the BOARD produced, not this press.
      expect(workspaceClaimsDrawReveal({type: 'tile'})).to.eq(false);
      expect(workspaceClaimsDrawReveal({type: 'colony', colonyName: 'Pluto'} as CardDrawRevealSource)).to.eq(false);
      expect(workspaceClaimsColonyReveal({type: 'colony', colonyName: 'Pluto'} as CardDrawRevealSource)).to.eq(false);
      // …an UNATTRIBUTED batch is NOT one of those: nothing identifies it as
      // the board's, and a workspace is open (see the contract note above).
      expect(workspaceClaimsDrawReveal(undefined)).to.eq(true);
    });

    it('the default scope stays EXACT — an activation answers for its own card only', () => {
      claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw', 'pick']);
      expect(workspaceOutcomeState.scope).to.eq('card');
      expect(workspaceClaimsDrawReveal(cardSource(RESTRICTED))).to.eq(false);
    });

    it('the scope never bleeds into the next claim', () => {
      claimWorkspaceOutcome('hand', RESTRICTED, ['draw'], 0, 0, 'chain');
      releaseWorkspaceOutcome();
      expect(workspaceOutcomeState.scope).to.eq('card');
      claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw']);
      expect(workspaceClaimsDrawReveal(cardSource(RESTRICTED))).to.eq(false);
    });
  });

  /**
   * WHOSE WORKSPACE ENDS WITH THE OUTCOME. The two sites that fold a finished
   * flow used to name «card-actions» outright and skip the hosts that end
   * differently by exclusion (`host !== 'colonies' && host !== 'hydro'`), so a
   * new host concluded either somebody else's workspace or nobody's.
   */
  describe('the host → conclusion table', () => {
    it('a flow-shaped workspace ends with its outcome; a phase / a longer resolution does not', () => {
      expect(outcomeHostConcludesFlow('card-actions')).to.eq(true);
      expect(outcomeHostConcludesFlow('hand')).to.eq(true);
      // The opening is a PHASE, not a flow — a corporation's play can never end it.
      expect(outcomeHostConcludesFlow('start')).to.eq(false);
      // One batch is a LEG of the colony resolution / the hydro advance.
      expect(outcomeHostConcludesFlow('colonies')).to.eq(false);
      expect(outcomeHostConcludesFlow('hydro')).to.eq(false);
      expect(outcomeHostConcludesFlow(undefined)).to.eq(false);
    });
  });

  describe('the COLONY host (the trade\'s Pluto payout)', () => {
    const colonySource = (colonyName: string, tradeId = 'Pluto:g3:a120'): CardDrawRevealSource =>
      ({type: 'colony', colonyName, trade: {tradeId, role: 'income'}} as CardDrawRevealSource);

    it('claims a COLONY-sourced batch only for the traded colony', () => {
      claimWorkspaceOutcome('colonies', 'Pluto', ['draw']);
      expect(workspaceClaimsColonyReveal(colonySource('Pluto'))).to.eq(true);
      expect(workspaceClaimsColonyReveal(colonySource('Luna'))).to.eq(false);
      expect(workspaceClaimsColonyReveal(undefined)).to.eq(false);
    });

    it('a CARD-sourced batch is never the colony host\'s (and vice versa)', () => {
      claimWorkspaceOutcome('colonies', 'Pluto', ['draw']);
      expect(workspaceClaimsColonyReveal(cardSource(AI_CENTRAL))).to.eq(false);
      // The card-claim predicate must not cross-match a colony claim either:
      // 'Pluto' the colony is not a card name, but the guard is structural.
      expect(workspaceClaimsDrawReveal(colonySource('Pluto'))).to.eq(false);
    });

    it('another workspace\'s claim never answers for the colonies', () => {
      claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw']);
      expect(workspaceClaimsColonyReveal(colonySource(AI_CENTRAL))).to.eq(false);
    });
  });

  describe('RETAIN for a queued sibling batch (one press, several reveals)', () => {
    it('re-arms the SAME lease: host / kinds / scope / slot survive, the arrival resets', () => {
      claimWorkspaceOutcome('hydro', AI_CENTRAL, ['draw', 'pick'], 2, 4, 'chain');
      setWorkspaceOutcomeSlot('[data-embed-slot="hydro"]');
      markWorkspaceOutcomePresenting();
      markWorkspaceOutcomeArrivalFlown();
      markWorkspaceOutcomeArrivalDone();
      retainWorkspaceOutcomeForNextBatch(2);
      // The lease's identity is untouched — the queued batch matches it and
      // presents in the SAME zone, behind the same scene-exit barrier.
      expect(workspaceOutcomeClaimed()).to.eq(true);
      expect(workspaceOutcomeState.host).to.eq('hydro');
      expect(workspaceOutcomeState.scope).to.eq('chain');
      expect(workspaceOutcomeState.embedSlot).to.eq('[data-embed-slot="hydro"]');
      expect(workspaceClaimsDrawReveal(cardSource(RESTRICTED)), 'chain scope answers the sibling').to.eq(true);
      // …while the per-batch lifecycle starts over.
      expect(workspaceOutcomeState.stage).to.eq('awaiting');
      expect(workspaceOutcomeState.expectedCards).to.eq(2);
      expect(workspaceOutcomeArrivalFlown()).to.eq(false);
      expect(workspaceOutcomeState.arrivalDone, 'a draw claim owes a fresh arrival').to.eq(false);
    });

    it('with NO live claim it is a no-op (never resurrects a released lease)', () => {
      retainWorkspaceOutcomeForNextBatch(3);
      expect(workspaceOutcomeClaimed()).to.eq(false);
    });
  });
});
