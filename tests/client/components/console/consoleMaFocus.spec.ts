import {expect} from 'chai';
import {
  maFocusState,
  openMaFocus,
  closeMaFocus,
  setMaFocusError,
  beginMaFocusCommit,
  failMaFocusCommit,
  beginMaFocusCeremony,
  beginMaFocusClosing,
  suspendMaFocus,
  discardMaFocusDraft,
  resetMaFocus,
  maFocusAcceptsInput,
  maFocusCommitArmed,
  maWorkspacePhase,
  maWorkspaceBackVerb,
  maFocusCommitOutcome,
  COMMIT_ARM_MS,
} from '@/client/console/consoleMaFocus';

/**
 * The MA workspace flow — the typed browse ⇄ detail ⇄ commit ⇄ ceremony
 * lifecycle behind the Milestones/Awards workspace (the North-Star rework):
 * the phase machine is deterministic (never a spread of booleans), B's verb
 * derives from the family vocabulary, input past the commit boundary is
 * absorbed by construction, and the commit outcome is a pure decision the
 * shell's watchers merely execute.
 */
describe('consoleMaFocus', () => {
  beforeEach(() => resetMaFocus());
  // Module state is BUNDLE-SHARED in mochapack — leave nothing open.
  after(() => resetMaFocus());

  const at = {gameAge: 10, undoCount: 2};

  describe('the commit ARM (a double-tap of A must not buy what it just opened)', () => {
    it('the stage refuses its own commit until it has been readable', () => {
      openMaFocus('award', 'Banker', 1_000);
      expect(maFocusCommitArmed(1_000), 'the opening frame is not a decision').to.eq(false);
      expect(maFocusCommitArmed(1_000 + COMMIT_ARM_MS - 1)).to.eq(false);
      expect(maFocusCommitArmed(1_000 + COMMIT_ARM_MS)).to.eq(true);
    });

    it('a closed workspace is never armed', () => {
      expect(maFocusCommitArmed(9_999_999)).to.eq(false);
    });
  });

  describe('the phase machine', () => {
    it('opens at the reversible detail; B = back; input live', () => {
      openMaFocus('award', 'Banker');
      expect(maFocusState).to.deep.include({open: true, kind: 'award', name: 'Banker', phase: 'detail'});
      expect(maWorkspacePhase()).to.eq('configure');
      expect(maWorkspaceBackVerb()).to.eq('back');
      expect(maFocusAcceptsInput()).to.eq(true);
    });

    it('closed = the browse layer; B = close', () => {
      expect(maWorkspacePhase()).to.eq('browse');
      expect(maWorkspaceBackVerb()).to.eq('close');
      expect(maFocusAcceptsInput()).to.eq(true);
    });

    it('the commit is an executing beat: input absorbed, B = none', () => {
      openMaFocus('milestone', 'Mayor');
      beginMaFocusCommit(at);
      expect(maFocusState.phase).to.eq('committing');
      expect(maFocusState.committedAt).to.deep.eq(at);
      expect(maWorkspacePhase()).to.eq('executing');
      expect(maWorkspaceBackVerb()).to.eq('none');
      expect(maFocusAcceptsInput()).to.eq(false);
    });

    it('the ceremony and the close stay absorbed — never a navigation destination', () => {
      openMaFocus('milestone', 'Mayor');
      beginMaFocusCommit(at);
      beginMaFocusCeremony();
      expect(maFocusState.phase).to.eq('ceremony');
      expect(maWorkspaceBackVerb()).to.eq('none');
      expect(maFocusAcceptsInput()).to.eq(false);
      beginMaFocusClosing();
      expect(maFocusState.phase).to.eq('closing');
      expect(maWorkspacePhase()).to.eq('completing');
      expect(maFocusAcceptsInput()).to.eq(false);
    });

    it('a refusal restores the REVERSIBLE detail with the inline reason', () => {
      openMaFocus('award', 'Banker');
      beginMaFocusCommit(at);
      failMaFocusCommit('Already funded');
      expect(maFocusState).to.deep.include({open: true, phase: 'detail', error: 'Already funded'});
      expect(maFocusState.committedAt).to.eq(undefined);
      expect(maWorkspaceBackVerb()).to.eq('back');
      // The player may retry: a fresh commit clears the stale reason.
      beginMaFocusCommit(at);
      expect(maFocusState.error).to.eq('');
    });

    it('B (close) works only from the reversible detail', () => {
      openMaFocus('award', 'Banker');
      beginMaFocusCommit(at);
      closeMaFocus();
      expect(maFocusState.open).to.eq(true); // an executing beat cannot be closed
      failMaFocusCommit('x');
      closeMaFocus();
      expect(maFocusState.open).to.eq(false);
    });

    it('the ceremony can only follow a commit (never re-entered)', () => {
      openMaFocus('milestone', 'Mayor');
      beginMaFocusCeremony();
      expect(maFocusState.phase).to.eq('detail'); // no commit — no ceremony
      beginMaFocusCommit(at);
      beginMaFocusCeremony();
      beginMaFocusCeremony();
      expect(maFocusState.phase).to.eq('ceremony');
    });

    it('a pre-submit inline error speaks only at the reversible detail', () => {
      openMaFocus('award', 'Banker');
      setMaFocusError('Not enough M€');
      expect(maFocusState.error).to.eq('Not enough M€');
      beginMaFocusCommit(at);
      setMaFocusError('late');
      expect(maFocusState.error).to.eq(''); // the commit cleared it; absorbed after
    });
  });

  describe('the suspended-instance draft (RESUME ≠ FRESH-OPEN)', () => {
    it('an unmount under a live PRE-COMMIT detail keeps the draft', () => {
      openMaFocus('award', 'Banker');
      suspendMaFocus();
      expect(maFocusState.open).to.eq(false);
      expect(maFocusState.draft).to.deep.eq({kind: 'award', name: 'Banker'});
    });

    it('a re-open consumes nothing by itself; openMaFocus clears the draft', () => {
      openMaFocus('award', 'Banker');
      suspendMaFocus();
      openMaFocus('award', 'Banker');
      expect(maFocusState.draft).to.eq(undefined);
    });

    it('an unmount past the commit boundary resets without a draft', () => {
      openMaFocus('milestone', 'Mayor');
      beginMaFocusCommit(at);
      suspendMaFocus();
      expect(maFocusState.open).to.eq(false);
      expect(maFocusState.draft).to.eq(undefined);
    });

    it('a discarded draft is gone (the restore door closed)', () => {
      openMaFocus('award', 'Banker');
      suspendMaFocus();
      discardMaFocusDraft();
      expect(maFocusState.draft).to.eq(undefined);
    });
  });

  describe('the commit outcome (pure decision)', () => {
    const base = {
      committing: true,
      kind: 'milestone' as const,
      name: 'Mayor',
      beat: undefined,
      takenByViewer: false,
      takenByOther: false,
      paymentPromptUp: false,
      viewAdvanced: false,
    };

    it('waits while the submit is on the wire', () => {
      expect(maFocusCommitOutcome(base)).to.deep.eq({kind: 'wait'});
    });

    it("the viewer's own matching beat → the ceremony owns the stage", () => {
      expect(maFocusCommitOutcome({
        ...base,
        beat: {kind: 'milestone', name: 'Mayor', own: true},
      })).to.deep.eq({kind: 'ceremony'});
    });

    it("someone ELSE's beat (or another slot's) never starts our ceremony", () => {
      expect(maFocusCommitOutcome({
        ...base,
        beat: {kind: 'milestone', name: 'Mayor', own: false},
      })).to.deep.eq({kind: 'wait'});
      expect(maFocusCommitOutcome({
        ...base,
        beat: {kind: 'award', name: 'Banker', own: true},
      })).to.deep.eq({kind: 'wait'});
    });

    it('the slot flipped to the VIEWER but the beat is still queued → wait (it is guaranteed to come)', () => {
      expect(maFocusCommitOutcome({
        ...base,
        takenByViewer: true,
        viewAdvanced: true,
      })).to.deep.eq({kind: 'wait'});
    });

    it('the claim answered with its own PAYMENT step (Helion) → yield to the payment surface', () => {
      expect(maFocusCommitOutcome({
        ...base,
        viewAdvanced: true,
        paymentPromptUp: true,
      })).to.deep.eq({kind: 'payment'});
    });

    it('a pre-existing payment prompt without a view advance is NOT a verdict', () => {
      expect(maFocusCommitOutcome({
        ...base,
        paymentPromptUp: true,
      })).to.deep.eq({kind: 'wait'});
    });

    it('the race was lost → refused (raced)', () => {
      expect(maFocusCommitOutcome({
        ...base,
        takenByOther: true,
        viewAdvanced: true,
      })).to.deep.eq({kind: 'refused', cause: 'raced'});
    });

    it('the view advanced with no take at all → refused (stale)', () => {
      expect(maFocusCommitOutcome({
        ...base,
        viewAdvanced: true,
      })).to.deep.eq({kind: 'refused', cause: 'stale'});
    });

    it('not committing → always wait (the watchers may fire any time)', () => {
      expect(maFocusCommitOutcome({
        ...base,
        committing: false,
        beat: {kind: 'milestone', name: 'Mayor', own: true},
      })).to.deep.eq({kind: 'wait'});
    });
  });
});
