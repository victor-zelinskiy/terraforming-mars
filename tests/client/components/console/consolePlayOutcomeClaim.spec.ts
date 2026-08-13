import {expect} from 'chai';
import {
  claimPlayOutcome, isPlayOutcomeHost, playOutcomeHost,
} from '@/client/console/played/consolePlayOutcomeClaim';
import {
  resetWorkspaceOutcome, workspaceClaimsDrawReveal, workspaceClaimsPick, workspaceOutcomeState,
} from '@/client/console/consoleWorkspaceOutcome';
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
    // The drawn batch AND the pick it may raise — one press, one claim.
    expect(workspaceClaimsDrawReveal(cardSource(LAGRANGE))).to.eq(true);
    expect(workspaceClaimsPick()).to.eq(true);
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

  it('only a PLAY host claims optimistically — the others claim on structural evidence', () => {
    expect(isPlayOutcomeHost('hand')).to.eq(true);
    expect(isPlayOutcomeHost('start')).to.eq(true);
    expect(isPlayOutcomeHost('card-actions')).to.eq(false);
    expect(isPlayOutcomeHost('colonies')).to.eq(false);
    expect(isPlayOutcomeHost('hydro')).to.eq(false);
    expect(isPlayOutcomeHost(undefined)).to.eq(false);
  });
});
