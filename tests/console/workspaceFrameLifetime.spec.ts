import {expect} from 'chai';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree} from '@/client/console/kernel/flowScope';
import {FRAME_BEAT_MAX_MS} from '@/client/console/consoleWorkspaceFrame';
import {
  closePhaseRoot, collapseWorkspaceStack, discardWorkspacePark, discardYieldedStack, enterWorkspace, goBoardHome,
  hydrateWorkspaceStack, popWorkspaceFrame, pushWorkspaceFrame, registerFrameBeatExpired, resetWorkspaceStack,
  restoreWorkspaceStack, resumeStackFromBoard, serializeWorkspaceStack, setWorkspaceFramePhase, workspaceFramePhase,
  workspaceFrameScope, workspaceStackState, yieldStackForStagedPlay,
} from '@/client/console/consoleWorkspaceStack';
import {announceSubmitTicket, SubmitSettle, SubmitTicket} from '@/client/console/transport/submitTicket';

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i++) {
    await Promise.resolve();
  }
}

function ticket(accepted: boolean): {ticket: SubmitTicket, settle: (status: SubmitSettle['status']) => void} {
  let resolve: (settle: SubmitSettle) => void = () => {};
  const settled = new Promise<SubmitSettle>((r) => {
    resolve = r;
  });
  if (!accepted) {
    resolve({id: '', status: 'rejected'});
  }
  return {
    ticket: accepted ? {accepted: true, id: 'submit#t', settled} : {accepted: false, id: '', reason: 'busy', settled},
    settle: (status) => resolve({id: 'submit#t', status}),
  };
}

/**
 * A FRAME IS A SCOPE, ITS PHASE A MACHINE (architecture v2, lifecycle 2). What belongs to a frame is opened in the
 * frame's scope and ends with it, wherever the frame stands — the claim that outlived its host (Hi-Tech Lab), the
 * release that knew two of the frame's three homes (the Hydronetwork's copied Mars Nomads), the flag that outlived its
 * frame (twelve watchers of that shape in the shell) have no representation. A beat is a state with a bound, and a
 * press that did not land puts the frame back.
 */
describe('workspace frame · a frame is a scope', () => {
  let clock: ManualFlowClock;
  let warn: typeof console.warn;
  let warned: Array<string>;

  beforeEach(() => {
    resetWorkspaceStack();
    clock = createManualClock(0);
    setFlowClock(clock);
    warned = [];
    warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warned.push(String(args[0]));
    };
  });
  afterEach(() => {
    resetWorkspaceStack();
    registerFrameBeatExpired(undefined);
    setFlowClock(undefined);
    console.warn = warn;
  });

  const hosted = (kind: 'colonies' | 'hand' | 'card-actions' | 'hydro') =>
    pushWorkspaceFrame({kind, subject: '', stage: '', phase: 'browse', serves: [], anchor: {type: 'always'}});

  describe('lifetime', () => {
    it('every frame has a scope, a child of the frame below it', () => {
      enterWorkspace('card-actions');
      hosted('colonies');
      const host = workspaceFrameScope('card-actions');
      const step = workspaceFrameScope('colonies');
      expect(host?.id).to.match(/^frame:card-actions#/);
      expect(step?.parent).to.eq(host);
      expect(workspaceFrameScope('hand')).to.eq(undefined);
    });

    it('what is opened in a frame\'s scope ends with the frame — by every verb that removes it', () => {
      const verbs: Array<[string, () => void]> = [
        ['pop', () => popWorkspaceFrame()],
        ['goBoardHome', () => goBoardHome()],
        ['a lateral move', () => enterWorkspace('hydro')],
        ['reset', () => resetWorkspaceStack()],
      ];
      for (const [name, verb] of verbs) {
        resetWorkspaceStack();
        enterWorkspace('card-actions');
        let released = 0;
        const claim = workspaceFrameScope('card-actions')?.open('claim', 'Hi-Tech Lab');
        claim?.defer(() => released++);
        verb();
        expect(claim?.ended?.how, name).to.eq('cancelled');
        expect(released, name).to.eq(1);
      }
    });

    it('a host leaving takes the step inside it — an inner frame cannot outlive its host', () => {
      enterWorkspace('hand');
      setWorkspaceFramePhase('hand', 'configure');
      hosted('colonies');
      const step = workspaceFrameScope('colonies');
      goBoardHome();
      expect(step?.ended?.how).to.eq('cancelled');
      expect(workspaceStackState.frames.length).to.eq(0);
    });

    it('THE THREE HOMES ARE ONE LIFE: parked, aside for the board and back — the same scope, never ended', () => {
      enterWorkspace('hydro');
      const scope = workspaceFrameScope('hydro');
      const claim = scope?.open('claim', 'Mars Nomads');
      // «свернуть» — the park
      collapseWorkspaceStack();
      expect(workspaceFrameScope('hydro'), 'known in the park').to.eq(scope);
      expect(claim?.ended).to.eq(undefined);
      restoreWorkspaceStack();
      // aside for its own board step (the place nobody had listed — the claim was released there 1.5 s in)
      yieldStackForStagedPlay();
      expect(workspaceFrameScope('hydro'), 'known aside').to.eq(scope);
      expect(claim?.ended).to.eq(undefined);
      resumeStackFromBoard();
      expect(workspaceFrameScope('hydro')).to.eq(scope);
      expect(claim?.ended).to.eq(undefined);
      expect(scope?.ended).to.eq(undefined);
    });

    it('a frame that goes while OFF stage ends too: a discarded park, a discarded yield, a closed phase', () => {
      enterWorkspace('card-actions');
      const parked = workspaceFrameScope('card-actions');
      collapseWorkspaceStack();
      discardWorkspacePark();
      expect(parked?.ended?.how).to.eq('cancelled');

      enterWorkspace('hand');
      const aside = workspaceFrameScope('hand');
      yieldStackForStagedPlay();
      discardYieldedStack();
      expect(aside?.ended?.how).to.eq('cancelled');

      pushWorkspaceFrame({kind: 'draft', subject: '', stage: '', phase: 'browse', serves: [], anchor: {type: 'phase', phase: 'drafting'}});
      const phase = workspaceFrameScope('draft');
      collapseWorkspaceStack();
      closePhaseRoot('draft');
      expect(phase?.ended?.how).to.eq('cancelled');
    });

    it('a park REPLACED by a newer park ends the frames it replaced', () => {
      enterWorkspace('card-actions');
      const first = workspaceFrameScope('card-actions');
      collapseWorkspaceStack();
      enterWorkspace('colonies');
      collapseWorkspaceStack();
      expect(first?.ended?.how).to.eq('cancelled');
      expect(workspaceFrameScope('colonies')?.ended).to.eq(undefined);
    });

    it('re-entering a workspace keeps its frame — and its scope', () => {
      enterWorkspace('hand');
      const scope = workspaceFrameScope('hand');
      pushWorkspaceFrame({kind: 'hand', subject: 'Some Card', stage: '', phase: 'configure', serves: [], anchor: {type: 'always'}});
      expect(workspaceFrameScope('hand')).to.eq(scope);
      expect(workspaceFramePhase('hand')).to.eq('configure');
    });

    it('a hydrated stack has scopes; the tree dump shows frames with their phases', () => {
      enterWorkspace('hand');
      setWorkspaceFramePhase('hand', 'committed');
      const stored = serializeWorkspaceStack();
      hydrateWorkspaceStack(stored, () => true);
      expect(workspaceFrameScope('hand')?.ended).to.eq(undefined);
      expect(dumpFlowTree().some((line) => /frame:hand#\d+ .* committed/.test(line))).to.eq(true);
    });
  });

  describe('the phase is the machine\'s — the record is its mirror', () => {
    it('`setWorkspaceFramePhase` moves the machine and the record together, wherever the frame stands', () => {
      enterWorkspace('hydro');
      setWorkspaceFramePhase('hydro', 'executing');
      expect(workspaceFramePhase('hydro')).to.eq('executing');
      yieldStackForStagedPlay();
      // A phase written while the frame is away is never lost (the hidden-scene class).
      setWorkspaceFramePhase('hydro', 'committed');
      resumeStackFromBoard();
      expect(workspaceFramePhase('hydro')).to.eq('committed');
    });

    it('a BEAT IS BOUNDED: a frame cannot stand `executing` on stage for ever — the record reads `committed` and the owner is told', () => {
      const expired: Array<string> = [];
      registerFrameBeatExpired((kind, phase) => expired.push(`${kind}:${phase}`));
      enterWorkspace('card-actions');
      setWorkspaceFramePhase('card-actions', 'executing');
      clock.advance(FRAME_BEAT_MAX_MS - 1);
      expect(workspaceFramePhase('card-actions')).to.eq('executing');
      clock.advance(1);
      expect(workspaceFramePhase('card-actions'), 'the pad is the player\'s again (B collapses)').to.eq('committed');
      expect(expired).to.deep.eq(['card-actions:executing']);
      expect(warned.some((line) => line.includes('[workspace] «card-actions» stood in «executing» on stage past its bound'))).to.eq(true);
    });

    it('…and `completing` likewise', () => {
      enterWorkspace('standard-projects');
      setWorkspaceFramePhase('standard-projects', 'completing');
      clock.advance(FRAME_BEAT_MAX_MS);
      expect(workspaceFramePhase('standard-projects')).to.eq('committed');
    });

    it('the bound runs only ON STAGE: a frame aside for the board absorbs nobody\'s pad, however long the player aims', () => {
      enterWorkspace('hydro');
      setWorkspaceFramePhase('hydro', 'executing');
      clock.advance(FRAME_BEAT_MAX_MS - 10);
      yieldStackForStagedPlay();
      clock.advance(FRAME_BEAT_MAX_MS * 5);
      resumeStackFromBoard();
      expect(workspaceFramePhase('hydro'), 'still its own beat').to.eq('executing');
      // …and back on stage the beat owes its end again, from the return.
      clock.advance(FRAME_BEAT_MAX_MS - 1);
      expect(workspaceFramePhase('hydro')).to.eq('executing');
      clock.advance(1);
      expect(workspaceFramePhase('hydro')).to.eq('committed');
    });

    it('a beat written again while it stands does not restart its bound', () => {
      enterWorkspace('card-actions');
      setWorkspaceFramePhase('card-actions', 'executing');
      clock.advance(FRAME_BEAT_MAX_MS - 5);
      setWorkspaceFramePhase('card-actions', 'executing');
      clock.advance(5);
      expect(workspaceFramePhase('card-actions')).to.eq('committed');
    });

    it('a beat that ends in time leaves no timer behind', () => {
      enterWorkspace('card-actions');
      setWorkspaceFramePhase('card-actions', 'executing');
      setWorkspaceFramePhase('card-actions', 'committed');
      expect(clock.pending()).to.eq(0);
      setWorkspaceFramePhase('card-actions', 'executing');
      goBoardHome();
      expect(clock.pending(), 'the frame took its bound with it').to.eq(0);
    });
  });

  describe('the beat\'s lease — a press that did not land puts the frame back', () => {
    it('a press REFUSED by a busy funnel: the frame is back where it stood, at once (inventory R11)', async () => {
      enterWorkspace('hand');
      setWorkspaceFramePhase('hand', 'configure');
      setWorkspaceFramePhase('hand', 'executing');
      announceSubmitTicket(ticket(false).ticket);
      expect(workspaceFramePhase('hand')).to.eq('configure');
      expect(warned.some((line) => line.includes('«hand» goes back executing → configure') && line.includes('the funnel was busy'))).to.eq(true);
    });

    it('…the same when the surface submits first and crosses the boundary a line later', async () => {
      enterWorkspace('standard-projects');
      announceSubmitTicket(ticket(false).ticket);
      setWorkspaceFramePhase('standard-projects', 'executing');
      expect(workspaceFramePhase('standard-projects'), 'back at browse — where the beat came from').to.eq('browse');
    });

    for (const status of ['refused', 'failed', 'silent'] as const) {
      it(`an answer that did not land (${status}): the frame goes back when the ticket settles`, async () => {
        enterWorkspace('card-actions');
        setWorkspaceFramePhase('card-actions', 'configure');
        setWorkspaceFramePhase('card-actions', 'executing');
        const press = ticket(true);
        announceSubmitTicket(press.ticket);
        await flush();
        expect(workspaceFramePhase('card-actions')).to.eq('executing');
        press.settle(status);
        await flush();
        expect(workspaceFramePhase('card-actions')).to.eq('configure');
      });
    }

    it('an answer that LANDED leaves the beat to its flow', async () => {
      enterWorkspace('card-actions');
      setWorkspaceFramePhase('card-actions', 'configure');
      setWorkspaceFramePhase('card-actions', 'executing');
      const press = ticket(true);
      announceSubmitTicket(press.ticket);
      press.settle('applied');
      await flush();
      expect(workspaceFramePhase('card-actions')).to.eq('executing');
      expect(warned).to.deep.eq([]);
    });

    it('a surface\'s own rollback wins — the lease then finds nothing to do', async () => {
      enterWorkspace('standard-projects');
      setWorkspaceFramePhase('standard-projects', 'configure');
      setWorkspaceFramePhase('standard-projects', 'executing');
      const press = ticket(true);
      announceSubmitTicket(press.ticket);
      await flush();
      // The surface's own watcher on its refused state:
      setWorkspaceFramePhase('standard-projects', 'browse');
      press.settle('refused');
      await flush();
      expect(workspaceFramePhase('standard-projects')).to.eq('browse');
      expect(warned).to.deep.eq([]);
    });

    it('a LATER beat is never rolled back by an older press', async () => {
      enterWorkspace('card-actions');
      setWorkspaceFramePhase('card-actions', 'configure');
      setWorkspaceFramePhase('card-actions', 'executing');
      const first = ticket(true);
      announceSubmitTicket(first.ticket);
      await flush();
      setWorkspaceFramePhase('card-actions', 'committed');
      setWorkspaceFramePhase('card-actions', 'executing');
      await flush();
      first.settle('failed');
      await flush();
      expect(workspaceFramePhase('card-actions'), 'the second beat is another press\'s').to.eq('executing');
    });

    it('a press binds only the beats of ITS OWN synchronous stretch — a frame already in a beat is not its', async () => {
      enterWorkspace('hydro');
      setWorkspaceFramePhase('hydro', 'configure');
      setWorkspaceFramePhase('hydro', 'executing');
      await flush();
      // A later, unrelated press is refused: the standing traversal is not rolled back by it.
      announceSubmitTicket(ticket(false).ticket);
      expect(workspaceFramePhase('hydro')).to.eq('executing');
    });

    it('a frame BORN in a beat has nowhere to go back to — it is its owner\'s to pop', async () => {
      pushWorkspaceFrame({kind: 'hydro', subject: '', stage: '', phase: 'executing', serves: [], anchor: {type: 'always'}});
      announceSubmitTicket(ticket(false).ticket);
      expect(workspaceFramePhase('hydro')).to.eq('executing');
    });
  });
});
