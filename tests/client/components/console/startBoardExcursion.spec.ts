import {expect} from 'chai';
import {
  engageStartExcursion, releaseStartExcursion, startExcursionActive,
  startExcursionQuiet, StartExcursionSignals, EXCURSION_BLOCKING_KINDS,
} from '@/client/console/startBoardExcursion';
import {TaskKind} from '@/client/console/consoleTaskRouter';

/**
 * THE COMPLETION BARRIER of a start-flow board placement: the Game Start
 * Workspace stays hidden from the moment it yields to a placement until the
 * WHOLE causal chain of that placement has completed — the commit flight, the
 * reward transfers, the cell's bonus-card reveal (with its hand intake) and
 * every follow-up prompt (the Ares hazard penalty, a chained second
 * placement). The workspace returns exactly once, onto a settled frame —
 * never between two legs of one play.
 */
function quietSignals(overrides: Partial<StartExcursionSignals> = {}): StartExcursionSignals {
  return {
    placementAsked: false,
    tileHero: false,
    transfers: false,
    boardBonus: false,
    revealBusy: false,
    handIntake: false,
    followUpKind: undefined,
    ...overrides,
  };
}

describe('startBoardExcursion (the placement completion barrier)', () => {
  afterEach(() => {
    releaseStartExcursion(); // module state is bundle-shared — never leak the latch
  });

  it('the latch: engage → active, release → inactive', () => {
    expect(startExcursionActive()).to.be.false;
    engageStartExcursion();
    expect(startExcursionActive()).to.be.true;
    releaseStartExcursion();
    expect(startExcursionActive()).to.be.false;
  });

  it('a fully settled chain is quiet', () => {
    expect(startExcursionQuiet(quietSignals())).to.be.true;
  });

  it('EVERY visual leg of the chain individually holds the barrier', () => {
    // The space still asked (incl. a chained second placement held behind the
    // first tile's cinematic), the commit flight + reward beat, the resource
    // flights, the cell's bonus-card scene, the reveal, the hand intake.
    const legs: Array<Partial<StartExcursionSignals>> = [
      {placementAsked: true},
      {tileHero: true},
      {transfers: true},
      {boardBonus: true},
      {revealBusy: true},
      {handIntake: true},
    ];
    for (const leg of legs) {
      expect(startExcursionQuiet(quietSignals(leg)), JSON.stringify(leg)).to.be.false;
    }
  });

  it('a follow-up prompt served OVER the board holds the barrier (Ares production loss, a choice)', () => {
    // The Ares hazard-adjacency penalty (`distribute`) and every other
    // board-band follow-up keep the workspace hidden — returning under them
    // is exactly the mid-chain flash the barrier removes.
    for (const kind of EXCURSION_BLOCKING_KINDS) {
      expect(startExcursionQuiet(quietSignals({followUpKind: kind})), kind).to.be.false;
    }
    expect(EXCURSION_BLOCKING_KINDS.has('distribute'), 'the Ares hazard penalty is a distribute').to.be.true;
    expect(EXCURSION_BLOCKING_KINDS.has('choice')).to.be.true;
  });

  it('the workspace\'s OWN prompts and its hosted steps RELEASE the barrier', () => {
    // The scene must come back to serve these — a start prompt (the next
    // prelude), and every step the start workspace hosts inside itself.
    const releasing: Array<TaskKind> = [
      'startSequence', 'corpFirstAction', 'initialDraft',
      'projectCard', 'handSelect', 'colony', 'colonyBonus', 'deckSelect',
      'actionMenu',
    ];
    for (const kind of releasing) {
      expect(EXCURSION_BLOCKING_KINDS.has(kind), `${kind} must not block the return`).to.be.false;
      expect(startExcursionQuiet(quietSignals({followUpKind: kind})), kind).to.be.true;
    }
  });

  it('«space» is deliberately NOT in the kind policy — it is the placementAsked signal itself', () => {
    // A chained second placement arrives as `waitingFor.type === 'space'`
    // (often HELD behind the first tile's cinematic) — the raw signal keeps
    // the barrier down without any admission gating.
    expect(EXCURSION_BLOCKING_KINDS.has('space')).to.be.false;
    expect(startExcursionQuiet(quietSignals({placementAsked: true, followUpKind: 'space'}))).to.be.false;
  });

  /*
   * ⚠️ A CARD-GRANTED BONUS ACTION IS NOT ONE OF THESE. A placement is one
   * demand the board answers and hands straight back, so the workspace stays
   * alive behind it; «Фора» grants an ORDINARY TURN, and a workspace alive
   * behind that fights the player for every surface it still owns. That
   * window is handled by the workspace LETTING GO entirely
   * (`ConsoleShell.bonusTurnLive`), never by this barrier — which is why an
   * action menu still, plainly, means the deployment is over.
   */
  it('a plain action menu still means the deployment is over', () => {
    expect(EXCURSION_BLOCKING_KINDS.has('actionMenu')).to.be.false;
    expect(startExcursionQuiet(quietSignals({followUpKind: 'actionMenu'}))).to.be.true;
  });
});
