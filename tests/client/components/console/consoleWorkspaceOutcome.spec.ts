import {expect} from 'chai';
import {
  claimWorkspaceOutcome,
  markWorkspaceOutcomePresenting,
  releaseWorkspaceOutcome,
  resetWorkspaceOutcome,
  setWorkspaceOutcomeSlot,
  workspaceClaimsDeckCheck,
  workspaceClaimsDrawReveal,
  workspaceClaimsPick,
  workspaceOutcomeAdmits,
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

  it('a fresh claim REPLACES the previous one (a second activation never inherits the first)', () => {
    claimWorkspaceOutcome('card-actions', AI_CENTRAL, ['draw']);
    claimWorkspaceOutcome('card-actions', RESTRICTED, ['draw']);
    expect(workspaceClaimsDrawReveal(cardSource(AI_CENTRAL))).to.eq(false);
    expect(workspaceClaimsDrawReveal(cardSource(RESTRICTED))).to.eq(true);
  });
});
