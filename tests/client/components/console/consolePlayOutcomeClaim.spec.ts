import {expect} from 'chai';
import {
  beginPlayLandingRelease, claimPlayOutcome, isPlayOutcomeHost, markPlayLandingReleased,
  playLandingHolding, playLandingReleasing, playLandingShowing, playLandingYieldedToOutcome,
  playOutcomeHost,
} from '@/client/console/played/consolePlayOutcomeClaim';
import {
  markWorkspaceOutcomePresenting, releaseWorkspaceOutcome, resetWorkspaceOutcome,
  workspaceClaimsDrawReveal, workspaceClaimsEffect, workspaceClaimsPick, workspaceOutcomeState,
} from '@/client/console/consoleWorkspaceOutcome';
import {armDeckDraw, markDeckDrawDealing, resetDeckDraw} from '@/client/console/deckDraw/consoleDeckDraw';
import {
  descendWorkspaceFrame, pushWorkspaceFrame, resetWorkspaceStack,
} from '@/client/console/consoleWorkspaceStack';
import {CardName} from '@/common/cards/CardName';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';

const LAGRANGE = CardName.LAGRANGE_OBSERVATORY as string;

function cardSource(cardName: string): CardDrawRevealSource {
  return {type: 'card', cardName: cardName as CardName};
}

/** The hand workspace, browse layer (the player walked in). */
function standHand(): void {
  pushWorkspaceFrame({
    kind: 'hand', subject: '', stage: '', phase: 'browse',
    serves: ['projectCard'], anchor: {type: 'always'},
  });
}

/** …and a card picked up in it — the play composer's home. */
function descendIntoPlay(card: string): void {
  descendWorkspaceFrame('hand', card, 'Playing', {type: 'cardInHand', card});
}

function standStart(): void {
  pushWorkspaceFrame({
    kind: 'start', subject: '', stage: '', phase: 'browse',
    serves: ['startSequence'], anchor: {type: 'phase', phase: 'preludes'},
  });
}

describe('consolePlayOutcomeClaim — WHERE a card play\'s follow-up presents', () => {
  // Module state is BUNDLE-SHARED under mochapack: a leaked claim would
  // suppress the standalone reveal for every later spec.
  afterEach(() => {
    resetWorkspaceOutcome();
    resetWorkspaceStack();
  });

  it('no workspace behind the play → nobody claims (the standalone band is honest there)', () => {
    expect(playOutcomeHost()).to.eq(undefined);
    expect(claimPlayOutcome(LAGRANGE, 1)).to.eq(undefined);
    expect(workspaceOutcomeState.sourceCard).to.eq('');
    // …and the full-bleed presenters keep their artifact.
    expect(workspaceClaimsDrawReveal(cardSource(LAGRANGE))).to.eq(false);
    // …including an unattributed one: with no claim there is nobody to give
    // it to, so the standalone reveal is the honest presenter.
    expect(workspaceClaimsDrawReveal(undefined)).to.eq(false);
  });

  /**
   * AN UNATTRIBUTED BATCH BELONGS TO THE OPEN WORKSPACE.
   *
   * The server names a draw's source from the running event scope, and not
   * every effect establishes one — a corporation's mandatory first action
   * (Celestic: «reveal until 2 floater cards») reached the client with NO
   * source. Keyed on a name match alone it belonged to nobody and opened the
   * standalone full-bleed reveal OVER the workspace whose contract is to host
   * exactly that. Every presenter that could compete for a batch is
   * identified BY its source, so a sourceless one has no other owner.
   */
  it('a draw with NO source is the open workspace\'s (Celestic\'s first action)', () => {
    standStart();
    expect(claimPlayOutcome(CardName.CELESTIC as string, 2)).to.eq('start');
    expect(workspaceClaimsDrawReveal(undefined)).to.eq(true);
    // …and a NON-card source still keeps its own presenter: a tile bonus is
    // identified BY that source and has a scene of its own, so «no source»
    // is what widens the claim here, never «any source».
    expect(workspaceClaimsDrawReveal({type: 'tile'} as never)).to.eq(false);
  });

  it('the HAND owns a play only once a card is picked up in it — its zone IS the play stage', () => {
    standHand();
    // At the browse layer there is no play for a follow-up to belong to.
    expect(playOutcomeHost()).to.eq(undefined);
    descendIntoPlay(LAGRANGE);
    expect(playOutcomeHost()?.host).to.eq('hand');
  });

  it('claims the play\'s whole chain INTO the hand workspace, zone published first', () => {
    standHand();
    descendIntoPlay(LAGRANGE);
    expect(claimPlayOutcome(LAGRANGE, 1)).to.eq('hand');
    expect(workspaceOutcomeState.host).to.eq('hand');
    expect(workspaceOutcomeState.sourceCard).to.eq(LAGRANGE);
    expect(workspaceOutcomeState.embedSlot).to.eq('[data-embed-slot="hand-outcome"]');
    expect(workspaceOutcomeState.expectedCards).to.eq(1);
    // The drawn batch, the pick it may raise AND the optional effect one of
    // the player's OTHER cards answers this press with — one press, one claim.
    expect(workspaceClaimsDrawReveal(cardSource(LAGRANGE))).to.eq(true);
    expect(workspaceClaimsPick()).to.eq(true);
    expect(workspaceClaimsEffect()).to.eq(true);
  });

  /**
   * «МАРСИАНСКИЙ УНИВЕРСИТЕТ». A triggered effect is invisible to every
   * preview — the played card knows nothing about the card that answers its
   * science tag — so the only way to catch the question at all is to claim
   * before knowing. It is the reconciler that settles the claim against what
   * actually came back.
   */
  it('claims the optional EFFECT a triggered card raises, whichever door the play used', () => {
    standStart();
    expect(claimPlayOutcome(CardName.POINT_LUNA as string, 0)).to.eq('start');
    expect(workspaceClaimsEffect()).to.eq(true);
    // …and with no workspace behind the play there is nothing to claim, so the
    // standalone decision band stays honest.
    resetWorkspaceOutcome();
    resetWorkspaceStack();
    expect(claimPlayOutcome(LAGRANGE, 0)).to.eq(undefined);
    expect(workspaceClaimsEffect()).to.eq(false);
  });

  /**
   * POINT LUNA. The corporation draws from a TRIGGERED effect on its own play,
   * so no `behavior` preview advertises it and the server attributes the batch
   * to POINT LUNA rather than to the pressed card. Both halves are tested at
   * once: the claim exists with `expectedCards === 0` (nothing was promised),
   * and it answers for a batch drawn by another card.
   */
  it('an UNDECLARED, triggered draw is still this play\'s (Point Luna)', () => {
    standStart();
    expect(claimPlayOutcome(CardName.POINT_LUNA as string, 0)).to.eq('start');
    expect(workspaceOutcomeState.expectedCards).to.eq(0);
    expect(workspaceClaimsDrawReveal(cardSource(CardName.POINT_LUNA))).to.eq(true);

    // …and the same effect firing for an Earth-tag card played later in the
    // deployment: the press is the prelude, the drawer is the corporation.
    resetWorkspaceOutcome();
    expect(claimPlayOutcome(CardName.BUSINESS_EMPIRE as string, 0)).to.eq('start');
    expect(workspaceClaimsDrawReveal(cardSource(CardName.POINT_LUNA))).to.eq(true);
  });

  /**
   * `start ⊃ hand` — the sponsor's play-from-hand prelude. The play belongs to
   * the NEAREST live unfinished step, the same law `workspaceHostForStep`
   * states for frames: its result lands in the hand step's own zone, not in
   * the deployment behind it.
   */
  it('a play inside a hosted hand belongs to the HAND, not to the start behind it', () => {
    standStart();
    standHand();
    descendIntoPlay(LAGRANGE);
    expect(claimPlayOutcome(LAGRANGE, 0)).to.eq('hand');
    expect(workspaceOutcomeState.embedSlot).to.eq('[data-embed-slot="hand-outcome"]');
  });

  /**
   * THE LANDING SCENE'S SHIFT CHANGE. The hero transaction ends when the card
   * has landed and its rewards resolved, but the cards it DREW have not even
   * left the deck yet (the deck cinematic waits for the hero, by design). So
   * the tableau holds the stage through that gap — and lets go the moment the
   * deal actually starts, because from there the room belongs to what is
   * arriving. It goes with a dissolve, and the dissolve is the reason
   * «showing» and «holding» are two questions.
   */
  describe('the landing scene\'s hold and its exit', () => {
    afterEach(() => {
      markPlayLandingReleased();
      resetDeckDraw();
    });

    function claimedPlay(): void {
      standHand();
      descendIntoPlay(LAGRANGE);
      claimPlayOutcome(LAGRANGE, 1);
    }

    it('holds the stage after the hero, while nothing else needs it', () => {
      claimedPlay();
      expect(playLandingHolding()).to.eq(true);
      expect(playLandingShowing()).to.eq(true);
      expect(playLandingYieldedToOutcome()).to.eq(false);
    });

    it('LETS GO the moment the deck starts dealing — not when the batch arrives', () => {
      claimedPlay();
      armDeckDraw(7, {hasDiscards: false, preDrawSize: 40, reducedMotion: false});
      // Claimed, but the scene is still waiting for the hero: nothing has
      // moved, so the tableau is right to stay.
      expect(playLandingHolding(), 'a CLAIMED batch is not a dealing one').to.eq(true);
      markDeckDrawDealing();
      expect(playLandingHolding()).to.eq(false);
      expect(playLandingYieldedToOutcome(), 'the fall is an EXIT, not a rollback').to.eq(true);
    });

    /**
     * AN OUTCOME WITH NO CARDS IN IT still needs the stage. «Марсианский
     * университет» asks its question and nothing comes off the deck, so keyed
     * on the deal alone the tableau held forever and the only thing that ever
     * removed it was its own component being torn out — a cut, in the one
     * place this scene exists to make continuous.
     */
    it('LETS GO when the outcome PRESENTS, even though nothing was dealt', () => {
      claimedPlay();
      expect(playLandingHolding()).to.eq(true);
      markWorkspaceOutcomePresenting();
      expect(playLandingHolding()).to.eq(false);
      expect(playLandingYieldedToOutcome(), 'the decision took the stage').to.eq(true);
    });

    it('stays SHOWING through its dissolve — the mount cannot cut its own exit', () => {
      claimedPlay();
      armDeckDraw(7, {hasDiscards: false, preDrawSize: 40, reducedMotion: false});
      markDeckDrawDealing();
      beginPlayLandingRelease();
      expect(playLandingHolding()).to.eq(false);
      expect(playLandingShowing(), 'mounted + frozen for the fade').to.eq(true);
      markPlayLandingReleased();
      expect(playLandingShowing()).to.eq(false);
    });

    it('a REFUSED play is not an exit — nothing arrived, so the setup rolls back', () => {
      claimedPlay();
      expect(playLandingYieldedToOutcome()).to.eq(false);
      releaseWorkspaceOutcome(); // the claim goes with the refusal
      expect(playLandingHolding()).to.eq(false);
      expect(playLandingYieldedToOutcome()).to.eq(false);
    });

    it('a new play never inherits a dissolve the last one left hanging', () => {
      claimedPlay();
      beginPlayLandingRelease();
      expect(playLandingShowing()).to.eq(true);
      claimPlayOutcome(LAGRANGE, 0);
      expect(playLandingReleasing(), 'the exit belongs to the play that started it').to.eq(false);
    });
  });

  it('only a PLAY host claims optimistically — the others claim on structural evidence', () => {
    expect(isPlayOutcomeHost('hand')).to.eq(true);
    expect(isPlayOutcomeHost('start')).to.eq(true);
    expect(isPlayOutcomeHost('card-actions')).to.eq(false);
    expect(isPlayOutcomeHost('colonies')).to.eq(false);
    expect(isPlayOutcomeHost('hydro')).to.eq(false);
    expect(isPlayOutcomeHost(undefined)).to.eq(false);
  });
});
