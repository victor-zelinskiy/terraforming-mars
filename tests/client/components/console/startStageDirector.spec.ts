import {expect} from 'chai';
import {
  BACKWARD_PHASES, FORWARD_PHASES, FROM_SUMMARY_PHASES, TO_SUMMARY_PHASES,
  beginStartTransition, commitFollowsSeparation, commitPhaseOf, currentSurfaceVisible,
  endStartTransition, inputLocked, nextSurfaceVisible, pendingStage, phasesFor,
  setStartTransitionPhase, startTransition, startTransitionActive, summaryChoreography,
  transitionDirection, transitionKind,
} from '@/client/console/startStageDirector';

/**
 * THE STAGE-ORDER CONTRACT of the Game Start Workspace.
 *
 * The bug this exists to prevent: the stage used to commit synchronously at
 * the press, so the next step's card grid was already painted (and fading in)
 * while the chosen card of the PREVIOUS step was still flying over it — two
 * card surfaces on screen, the moving card crossing a table it never belonged
 * to. Ordering, not z-index; hence an ordering test.
 */
describe('startStageDirector — the stage-order contract', () => {
  afterEach(() => endStartTransition());

  const KINDS = ['step-forward', 'to-summary', 'step-back', 'from-summary'] as const;

  it('classifies a move by what it physically is', () => {
    // 3 card steps + the summary at index 3.
    expect(transitionKind(0, 1, 3)).to.eq('step-forward');
    expect(transitionKind(2, 3, 3)).to.eq('to-summary');
    expect(transitionKind(1, 0, 3)).to.eq('step-back');
    expect(transitionKind(3, 2, 3)).to.eq('from-summary');
    expect(transitionKind(1, 1, 3)).to.eq(undefined);
  });

  it('every kind has a commit phase inside its own order', () => {
    for (const kind of KINDS) {
      const phases = phasesFor(kind);
      expect(phases.indexOf(commitPhaseOf(kind)), kind).to.be.greaterThan(-1);
      // Every order opens by accepting the press and closes by stabilizing.
      expect(phases[0], kind).to.eq('accepting-navigation');
      expect(phases[phases.length - 1], kind).to.eq('stabilizing-focus');
    }
  });

  /** THE invariant: forward, nothing of the next stage may exist until the
   *  cards have left the old one AND the old surface has retired. */
  it('FORWARD commits only after the picks separated and the surface parked', () => {
    for (const kind of ['step-forward', 'to-summary'] as const) {
      expect(commitFollowsSeparation(kind), kind).to.eq(true);
      const phases = phasesFor(kind);
      expect(phases.indexOf('lifting-selection'), kind)
        .to.be.lessThan(phases.indexOf('parking-current-surface'));
      expect(phases.indexOf('parking-current-surface'), kind)
        .to.be.lessThan(phases.indexOf(commitPhaseOf(kind)));
    }
    // A step advance additionally waits for the SHELF to have the cards.
    expect(FORWARD_PHASES.indexOf('docking-selection'))
      .to.be.lessThan(FORWARD_PHASES.indexOf('committing-stage'));
  });

  /**
   * BACKWARD is deliberately NOT the mirror image: a card can only come home
   * to a table that already stands, so the previous surface is restored
   * BEFORE anything is released from the shelf.
   */
  it('BACKWARD restores the receiving surface before releasing the cards', () => {
    const release = BACKWARD_PHASES.indexOf('releasing-selection-from-dock');
    expect(BACKWARD_PHASES.indexOf('committing-previous-stage')).to.be.lessThan(release);
    expect(BACKWARD_PHASES.indexOf('revealing-previous-surface')).to.be.lessThan(release);
    expect(BACKWARD_PHASES.indexOf('preparing-reserved-slots')).to.be.lessThan(release);
    expect(commitFollowsSeparation('step-back')).to.eq(true);

    const carry = FROM_SUMMARY_PHASES.indexOf('transferring-selection-home');
    expect(FROM_SUMMARY_PHASES.indexOf('revealing-previous-surface')).to.be.lessThan(carry);
    expect(FROM_SUMMARY_PHASES.indexOf('preparing-reserved-slots')).to.be.lessThan(carry);
  });

  it('the two orders are genuinely different (never one symmetric crossfade)', () => {
    expect(FORWARD_PHASES.join()).to.not.eq([...BACKWARD_PHASES].reverse().join());
    expect(FORWARD_PHASES.indexOf('parking-current-surface'))
      .to.be.greaterThan(FORWARD_PHASES.indexOf('compressing-selection'));
    // Backward parks FIRST — there is nothing to take off the old table.
    expect(BACKWARD_PHASES.indexOf('parking-current-surface')).to.eq(1);
  });

  /** NEVER two card surfaces at once — walk every phase of every kind. */
  it('no phase shows the old cards and the new cards together', () => {
    for (const kind of KINDS) {
      for (const phase of phasesFor(kind)) {
        const both = currentSurfaceVisible(kind, phase) && nextSurfaceVisible(kind, phase);
        expect(both, `${kind}/${phase}`).to.eq(false);
      }
    }
  });

  it('the summary layout is prepared BEFORE any card is distributed', () => {
    expect(TO_SUMMARY_PHASES.indexOf('preparing-summary-layout'))
      .to.be.lessThan(TO_SUMMARY_PHASES.indexOf('distributing-summary-cards'));
    // …and the summary's own status/controls come after the LAST landing.
    expect(TO_SUMMARY_PHASES.indexOf('docking-all-summary-cards'))
      .to.be.lessThan(TO_SUMMARY_PHASES.indexOf('revealing-summary-status'));
  });

  it('input is locked for the whole transition and released on the last phase', () => {
    for (const kind of KINDS) {
      const phases = phasesFor(kind);
      for (const phase of phases.slice(0, -1)) {
        expect(inputLocked(phase), `${kind}/${phase}`).to.eq(true);
      }
      expect(inputLocked('stabilizing-focus')).to.eq(false);
      expect(inputLocked('idle')).to.eq(false);
    }
  });

  it('pendingStage is the REQUESTED stage and exists only while transitioning', () => {
    expect(startTransitionActive()).to.eq(false);
    expect(pendingStage()).to.eq(undefined);
    beginStartTransition('step-forward', 0, 1);
    expect(startTransitionActive()).to.eq(true);
    expect(pendingStage()).to.eq(1);
    // The ACTIVE stage is the host's own `stepIdx` and is untouched here —
    // the director never writes it, it only says when it may be written.
    expect(startTransition.from).to.eq(0);
    expect(startTransition.dir).to.eq(1);
    endStartTransition();
    expect(pendingStage()).to.eq(undefined);
  });

  it('direction is per kind, not per index arithmetic', () => {
    expect(transitionDirection('step-forward')).to.eq(1);
    expect(transitionDirection('to-summary')).to.eq(1);
    expect(transitionDirection('step-back')).to.eq(-1);
    expect(transitionDirection('from-summary')).to.eq(-1);
  });

  it('phases may be skipped but the recorded phase always advances', () => {
    beginStartTransition('step-forward', 0, 1);
    setStartTransitionPhase('lifting-selection');
    expect(startTransition.phase).to.eq('lifting-selection');
    setStartTransitionPhase('committing-stage'); // skipping is legal
    expect(startTransition.phase).to.eq('committing-stage');
  });

  /**
   * ADAPTIVE CHOREOGRAPHY. The forbidden shape is «animate the first N, place
   * the rest»: the spread may GROW with the set (and saturate), the per-card
   * spacing may COMPRESS, but nothing may ever be dropped.
   */
  describe('summaryChoreography — grows, compresses, never truncates', () => {
    it('tiers by count', () => {
      expect(summaryChoreography(1).tier).to.eq('single');
      expect(summaryChoreography(4).tier).to.eq('few');
      expect(summaryChoreography(10).tier).to.eq('several');
      expect(summaryChoreography(15).tier).to.eq('many');
      expect(summaryChoreography(20).tier).to.eq('many');
    });

    it('total spread grows with the set but saturates', () => {
      const four = summaryChoreography(4).spread;
      const ten = summaryChoreography(10).spread;
      const twenty = summaryChoreography(20).spread;
      expect(four).to.be.greaterThan(0);
      expect(ten).to.be.greaterThan(four);
      expect(twenty).to.be.greaterThan(ten);
      // Sub-linear: 5× the cards must not mean 5× the wait.
      expect(twenty).to.be.lessThan(four * 5);
      expect(twenty).to.be.at.most(900);
    });

    it('per-card spacing compresses as the set grows, and never reaches zero', () => {
      expect(summaryChoreography(4).stagger).to.be.greaterThan(summaryChoreography(20).stagger);
      for (const n of [2, 4, 8, 12, 16, 20, 40]) {
        expect(summaryChoreography(n).stagger, `n=${n}`).to.be.greaterThan(0);
      }
    });

    it('a single card has no stagger, and zero cards is not a crash', () => {
      expect(summaryChoreography(1)).to.deep.eq({tier: 'single', stagger: 0, spread: 0});
      expect(summaryChoreography(0).spread).to.eq(0);
    });
  });
});
