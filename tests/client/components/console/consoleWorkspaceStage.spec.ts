import {expect} from 'chai';
import {
  openWorkspaceStage,
  closeWorkspaceStage,
  markWorkspaceStageCommitted,
  rollbackWorkspaceStageCommit,
  resetWorkspaceStage,
  setWorkspaceStageName,
  setWorkspaceStageSlot,
  workspaceStageAcceptsInput,
  workspaceStageBackVerb,
  workspaceStageCrumb,
  workspaceStageOpen,
  workspaceStageState,
  workspaceStageTarget,
} from '@/client/console/consoleWorkspaceStage';
import {buildWorkspaceHeader} from '@/client/console/consoleWorkspaceHeader';

const SLOT = '[data-embed-slot="hand-play"]';

describe('consoleWorkspaceStage — the DESCENT model of a workspace', () => {
  // Module state is bundle-shared under mochapack: never leave a claim behind.
  afterEach(() => resetWorkspaceStage());

  it('starts at the browse layer — nothing is claimed, nothing is embedded', () => {
    expect(workspaceStageOpen('hand')).to.eq(false);
    expect(workspaceStageTarget('hand')).to.eq(undefined);
    expect(workspaceStageBackVerb('hand')).to.eq('close');
  });

  it('descending claims the workspace, the carried card and the step', () => {
    openWorkspaceStage('hand', 'AI Central', 'Playing');
    expect(workspaceStageOpen('hand')).to.eq(true);
    expect(workspaceStageState.subject).to.eq('AI Central');
    expect(workspaceStageState.stage).to.eq('Playing');
  });

  /**
   * THE B CONTRACT this whole migration is for. Inside the descent B is ONE
   * logical level (back to the shelf), not "close the screen". Deriving it from
   * the phase — never from a hand-rolled branch at the call site — is what stops
   * B from meaning whichever `if` happened to be checked last.
   */
  it('B is one level inside the descent, and the screen only at the browse layer', () => {
    expect(workspaceStageBackVerb('hand')).to.eq('close');
    openWorkspaceStage('hand', 'AI Central', 'Playing');
    expect(workspaceStageBackVerb('hand')).to.eq('back');
    closeWorkspaceStage();
    expect(workspaceStageBackVerb('hand')).to.eq('close');
  });

  it('a committed beat absorbs input, so a double submit is impossible by construction', () => {
    openWorkspaceStage('hand', 'AI Central', 'Playing');
    expect(workspaceStageAcceptsInput()).to.eq(true);
    markWorkspaceStageCommitted();
    expect(workspaceStageAcceptsInput()).to.eq(false);
    expect(workspaceStageBackVerb('hand')).to.eq('none');
  });

  it('a REFUSED move rolls the boundary back — B must not stay dead after a reject', () => {
    openWorkspaceStage('hand', 'AI Central', 'Playing');
    markWorkspaceStageCommitted();
    rollbackWorkspaceStageCommit();
    expect(workspaceStageAcceptsInput()).to.eq(true);
    expect(workspaceStageBackVerb('hand')).to.eq('back');
    expect(workspaceStageCrumb('hand').committed).to.eq(false);
  });

  it('the rollback is a no-op with no descent, and never invents one', () => {
    rollbackWorkspaceStageCommit();
    expect(workspaceStageOpen('hand')).to.eq(false);
  });

  /**
   * OWNERSHIP ≠ READINESS. The descent is claimed synchronously on the press,
   * but the zone it teleports into exists a flush later. Conflating the two is
   * what let a standalone band win the race in the blue-action flow — the
   * surface mounted in its own modal for one frame and then moved.
   */
  it('owns the flow BEFORE the slot exists — and only then is it a teleport target', () => {
    openWorkspaceStage('hand', 'AI Central', 'Playing');
    expect(workspaceStageOpen('hand')).to.eq(true);
    expect(workspaceStageTarget('hand')).to.eq(undefined);
    setWorkspaceStageSlot(SLOT);
    expect(workspaceStageTarget('hand')).to.eq(SLOT);
  });

  /**
   * The host's MOUNT owns the slot, not the flow. Clearing it from the flow
   * side would retract a target that is still in the DOM through the leave
   * transition, and the teleport would drop its content mid-fold — the one
   * frame the fold exists to show.
   */
  it('leaving the stage does NOT retract the slot — the host retracts it on unmount', () => {
    openWorkspaceStage('hand', 'AI Central', 'Playing');
    setWorkspaceStageSlot(SLOT);
    closeWorkspaceStage();
    expect(workspaceStageState.slot).to.eq(SLOT);
    // …but it is no longer a target for anyone, because nobody owns the flow.
    expect(workspaceStageTarget('hand')).to.eq(undefined);
  });

  it('the embedded surface names its own step, and only while a descent is live', () => {
    setWorkspaceStageName('Payment');
    expect(workspaceStageState.stage).to.eq('');
    openWorkspaceStage('hand', 'AI Central', 'Playing');
    setWorkspaceStageName('Payment');
    expect(workspaceStageState.stage).to.eq('Payment');
  });

  describe('the breadcrumb', () => {
    it('is the ROOT alone at the browse layer — the line has no tail to show yet', () => {
      const crumb = workspaceStageCrumb('hand');
      expect(crumb.root).to.eq('Cards in hand');
      expect(crumb.subject).to.eq(undefined);
      expect(crumb.stage).to.eq(undefined);
    });

    /**
     * STABLE CONTEXT BEFORE MUTABLE STAGE: the crumb only ever GAINS a tail.
     * The root and the subject must be the same segments in both states, or the
     * line re-flows every phase and reads as arriving somewhere else.
     */
    it('GROWS a tail on descent — root and subject keep their places', () => {
      openWorkspaceStage('hand', 'AI Central', 'Playing');
      const model = buildWorkspaceHeader(workspaceStageCrumb('hand'));
      expect(model.segments.map((s) => s.role)).to.deep.eq(['root', 'subject', 'stage']);
      expect(model.segments.map((s) => s.text)).to.deep.eq(['Cards in hand', 'AI Central', 'Playing']);
    });

    it('only the STAGE segment changes as the step advances', () => {
      openWorkspaceStage('hand', 'AI Central', 'Playing');
      const before = buildWorkspaceHeader(workspaceStageCrumb('hand'));
      setWorkspaceStageName('Payment');
      const after = buildWorkspaceHeader(workspaceStageCrumb('hand'));
      expect(after.segments[0]).to.deep.eq(before.segments[0]);
      expect(after.segments[1]).to.deep.eq(before.segments[1]);
      expect(after.stageKey).to.eq('Payment');
      expect(before.stageKey).to.eq('Playing');
    });

    it('dresses the stage as COMMITTED only past the boundary', () => {
      openWorkspaceStage('hand', 'AI Central', 'Playing');
      expect(workspaceStageCrumb('hand').committed).to.eq(false);
      markWorkspaceStageCommitted();
      expect(workspaceStageCrumb('hand').committed).to.eq(true);
    });

    it('answers for the asking host only — another workspace sees a bare root', () => {
      openWorkspaceStage('hand', 'AI Central', 'Playing');
      expect(workspaceStageOpen('hand')).to.eq(true);
      expect(workspaceStageTarget('hand')).to.eq(undefined);
      setWorkspaceStageSlot(SLOT);
      expect(workspaceStageTarget('hand')).to.eq(SLOT);
      closeWorkspaceStage();
      expect(workspaceStageCrumb('hand').subject).to.eq(undefined);
    });
  });

  it('a full reset clears the slot too (game switch / shell unmount)', () => {
    openWorkspaceStage('hand', 'AI Central', 'Playing');
    setWorkspaceStageSlot(SLOT);
    resetWorkspaceStage();
    expect(workspaceStageState.slot).to.eq('');
    expect(workspaceStageOpen('hand')).to.eq(false);
  });
});
