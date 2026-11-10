import {expect} from 'chai';
import {nextTick, ref, watch} from 'vue';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree} from '@/client/console/kernel/flowScope';
import {
  closeWorkspaceRoot, collapseWorkspaceStack, enterWorkspace, pushWorkspaceFrame, resetWorkspaceStack, WorkspaceFrameKind,
} from '@/client/console/consoleWorkspaceStack';
import {
  CONCLUSION_REASK_GRACE_MS, CONCLUSION_REASK_MS, conclusionOwed, ConclusionReask, oweConclusion, owedConclusionFactsKey,
  owedConclusions, reaskMovedConclusions, reaskOwedConclusion, registerConclusionOwePort, resetConclusionOwes,
  withdrawConclusionOwe,
} from '@/client/console/workspaceConclusionOwe';
import {OWED_CONCLUSION_FORCE_MS, OWED_CONCLUSION_GHOST_CONFIRM_MS} from '@/client/console/shell/shellFlowState';

async function flush(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    await nextTick();
    await Promise.resolve();
  }
}

/** The shell's `owedConclusionFacts` ROW, played by the spec: a watcher over the debts' facts key. */
function installRow(): () => void {
  return watch(() => owedConclusionFactsKey(), () => reaskMovedConclusions());
}

/**
 * AN OWED CONCLUSION IS A RUN IN ITS FRAME'S SCOPE (architecture v2 · S5). The mailbox it replaces — one field for
 * the whole console, re-driven by a watcher over a hand-written list of the hold's ingredients — produced a field
 * hang for every ingredient the list forgot. Here the debt is re-asked on the decision's own facts, belongs to the
 * frame that owes it, and is bounded; each case below is one of the old failure shapes, as a path that now ends.
 */
describe('workspace conclusion · an owed ending is a run in its frame\'s scope', () => {
  let clock: ManualFlowClock;
  /** What the fake owner says: per kind, does the conclusion hold; is the workspace a ghost. */
  const holds = ref<Partial<Record<WorkspaceFrameKind, boolean>>>({});
  const ghost = ref<Partial<Record<WorkspaceFrameKind, boolean>>>({});
  let cadence = true;
  let asks: Array<string>;
  let forced: Array<string>;
  let answer: (kind: WorkspaceFrameKind) => ConclusionReask;
  let stopRow: () => void;
  let warned: Array<string>;
  let warn: typeof console.warn;

  const frame = (kind: WorkspaceFrameKind) => pushWorkspaceFrame({kind, subject: '', stage: '', phase: 'committed', serves: [], anchor: {type: 'always'}});

  beforeEach(() => {
    resetWorkspaceStack();
    resetConclusionOwes();
    clock = createManualClock(1_000_000);
    setFlowClock(clock);
    holds.value = {};
    ghost.value = {};
    cadence = true;
    asks = [];
    forced = [];
    warned = [];
    warn = console.warn;
    console.warn = (...args: Array<unknown>) => {
      warned.push(String(args[0]));
    };
    // By default a re-ask concludes exactly when the decision no longer holds — and closes the frame, as the real one does.
    answer = (kind) => {
      if (holds.value[kind] === true) {
        return 'held';
      }
      closeWorkspaceRoot(kind);
      return 'done';
    };
    registerConclusionOwePort({
      facts: (kind) => `holds:${holds.value[kind] === true}`,
      reask: (kind) => {
        asks.push(kind);
        return answer(kind);
      },
      cadenceApplies: () => cadence,
      ghost: (kind) => ghost.value[kind] === true,
      force: (kind) => {
        forced.push(kind);
        closeWorkspaceRoot(kind);
      },
    });
    stopRow = installRow();
  });
  afterEach(() => {
    stopRow();
    registerConclusionOwePort(undefined);
    resetConclusionOwes();
    resetWorkspaceStack();
    setFlowClock(undefined);
    console.warn = warn;
  });

  it('the debt is re-asked when THE DECISION\'S FACTS move — in the row\'s turn, once', async () => {
    enterWorkspace('hand');
    holds.value = {hand: true};
    oweConclusion('hand', true);
    await flush();
    expect(asks, 'a refusal that still stands is not re-asked by its own owing').to.deep.equal([]);
    expect(conclusionOwed('hand')).to.equal(true);

    holds.value = {hand: false};
    await nextTick(); // Vue's flush: the row is where the debt is asked
    expect(asks).to.deep.equal(['hand']);
    await flush();
    expect(conclusionOwed('hand')).to.equal(false);
    expect(dumpFlowTree().some((line) => line.includes('conclusion owed')), 'nothing of the run is left').to.equal(false);
    expect(owedConclusionFactsKey(), 'the row is inert again').to.equal('');
  });

  it('THERE IS NO LIST: whatever the decision reads wakes the debt — a fact no signal string ever named', async () => {
    // The class of the board-beat park's drain (2026-09-11), the chairmanship, the hidden scene: a hold whose fall the
    // enumerated signal did not carry stood until an unrelated 20–30 s safety.
    const somethingNobodyListed = ref(true);
    registerConclusionOwePort({
      facts: () => `x:${somethingNobodyListed.value}`,
      reask: (kind) => {
        asks.push(kind);
        closeWorkspaceRoot(kind);
        return 'done';
      },
      cadenceApplies: () => false,
      ghost: () => false,
      force: () => {},
    });
    enterWorkspace('colonies');
    oweConclusion('colonies', true);
    await flush();
    somethingNobodyListed.value = false;
    await nextTick();
    expect(asks).to.deep.equal(['colonies']);
  });

  it('TWO workspaces owe independently — a second debt never overwrites the first', async () => {
    enterWorkspace('hand');
    frame('colonies');
    holds.value = {hand: true, colonies: true};
    oweConclusion('hand', true);
    oweConclusion('colonies', false);
    expect(owedConclusions().map((o) => o.kind).sort()).to.deep.equal(['colonies', 'hand']);

    holds.value = {hand: true, colonies: false};
    await flush();
    expect(asks).to.deep.equal(['colonies']);
    expect(conclusionOwed('hand'), 'the host frame\'s debt stands').to.equal(true);

    holds.value = {hand: false};
    await flush();
    expect(asks).to.deep.equal(['colonies', 'hand']);
    expect(owedConclusions()).to.deep.equal([]);
  });

  it('A FRAME THAT GOES TAKES ITS DEBT WITH IT — there is no «gone» to detect', async () => {
    enterWorkspace('hand');
    holds.value = {hand: true};
    oweConclusion('hand', true);
    await flush();
    closeWorkspaceRoot('hand'); // any verb: the frame's scope ends
    await flush();
    expect(conclusionOwed('hand')).to.equal(false);
    holds.value = {hand: false};
    await flush();
    clock.advance(10 * CONCLUSION_REASK_MS);
    await flush();
    expect(asks, 'nobody re-asks an ending whose frame is gone').to.deep.equal([]);
    expect(dumpFlowTree().some((line) => line.includes('conclusion owed'))).to.equal(false);
  });

  it('…and a frame that only left the stage (collapsed) keeps it: the debt is the frame\'s, wherever it stands', async () => {
    enterWorkspace('hand');
    holds.value = {hand: true};
    oweConclusion('hand', true);
    await flush();
    collapseWorkspaceStack();
    await flush();
    expect(conclusionOwed('hand')).to.equal(true);
  });

  it('a re-owe of the same frame is the SAME debt: one run, the clock kept', async () => {
    enterWorkspace('hand');
    holds.value = {hand: true};
    oweConclusion('hand', true);
    const since = owedConclusions()[0].since;
    clock.advance(400);
    await flush();
    oweConclusion('hand', false);
    expect(owedConclusions()).to.deep.equal([{kind: 'hand', since, servedPromptHolds: false}]);
    expect(dumpFlowTree().filter((line) => line.includes('conclusion owed'))).to.have.length(1);
  });

  it('facts that move while the conclusion STILL holds are asked once per move — reconcile gets its turn, nothing spins', async () => {
    enterWorkspace('hand');
    const stage = ref('presenting');
    registerConclusionOwePort({
      facts: () => `claim:${stage.value}`,
      reask: (kind) => {
        asks.push(`${kind}@${stage.value}`);
        return 'held';
      },
      cadenceApplies: () => false,
      ghost: () => false,
      force: () => {},
    });
    oweConclusion('hand', true);
    await flush();
    stage.value = 'released';
    await flush();
    expect(asks).to.deep.equal(['hand@released']);
    clock.advance(CONCLUSION_REASK_MS);
    await flush();
    expect(asks, 'the same facts are not asked twice').to.deep.equal(['hand@released']);
    stage.value = 'idle';
    await flush();
    expect(asks).to.deep.equal(['hand@released', 'hand@idle']);
  });

  describe('WHEN in the tick — among the shell\'s reactions, before its render', () => {
    // The facts of a conclusion move in TWO steps inside one tick: an owed step's door falls (`owedStep: false`) and a
    // reaction of the shell then pushes the step's frame (`nested: true`). `console-multi-effect-sequence`, 2026-11-11.
    const owedStep = ref(true);
    const nested = ref(false);
    let verdicts: Array<string>;
    const arrange = () => {
      owedStep.value = true;
      nested.value = false;
      verdicts = [];
      registerConclusionOwePort({
        facts: () => `owed:${owedStep.value}|nested:${nested.value}`,
        reask: (kind) => {
          const holding = owedStep.value || nested.value;
          verdicts.push(holding ? 'held' : 'concluded');
          if (!holding) {
            closeWorkspaceRoot(kind);
          }
          return holding ? 'held' : 'done';
        },
        cadenceApplies: () => false,
        ghost: () => false,
        force: () => {},
      });
    };
    const door = () => watch(owedStep, (owed) => {
      if (!owed) {
        nested.value = true; // the door's own reaction: the step stands up inside the frame
      }
    });

    it('the wake, a watcher beside the door\'s own, asks with the tick\'s COMPLETED facts: the workspace stands under its step', async () => {
      // The shell's shape (and the old signal's): a watcher over the facts' key, subscribed when the debt begins — the
      // door's reaction, woken by the same write, is already queued ahead of it.
      arrange();
      enterWorkspace('hand');
      const stopDoor = door();
      oweConclusion('hand', true);
      await flush();
      owedStep.value = false;
      await flush();
      stopDoor();
      expect(verdicts).to.deep.equal(['held']);
      expect(conclusionOwed('hand')).to.equal(true);
    });

    it('…and asked in the write itself (what a free, synchronous wake would do) it reads «nothing holds»', () => {
      // The reason the wake is NOT the kernel's own `until` (sync), nor a watcher of no component (queued first by Vue
      // 3.5): either asks here — between the door's fall and the frame its reaction pushes.
      arrange();
      enterWorkspace('hand');
      const stopDoor = door();
      oweConclusion('hand', true);
      owedStep.value = false;
      reaskMovedConclusions(); // «now», in the same synchronous stretch as the write
      stopDoor();
      expect(verdicts, 'the half-way facts').to.deep.equal(['concluded']);
    });
  });

  it('THE CADENCE re-asks what moved with no write behind it — after the grace, and only where it applies', async () => {
    enterWorkspace('hand');
    holds.value = {hand: true};
    let releasable = false; // a plain fact: a claim that became releasable with nothing reactive changing
    answer = (kind) => {
      if (!releasable) {
        return 'held';
      }
      closeWorkspaceRoot(kind);
      return 'done';
    };
    oweConclusion('hand', true);
    await flush();
    for (let t = 0; t < CONCLUSION_REASK_GRACE_MS - CONCLUSION_REASK_MS; t += CONCLUSION_REASK_MS) {
      clock.advance(CONCLUSION_REASK_MS);
      await flush();
    }
    expect(asks, 'a fresh refusal is left alone for the grace').to.deep.equal([]);

    cadence = false; // the player's own time: a nested step, a park, a claim serving a prompt
    for (let i = 0; i < 4; i++) {
      clock.advance(CONCLUSION_REASK_MS);
      await flush();
    }
    expect(asks, 'not re-asked while the hold is the player\'s own time').to.deep.equal([]);

    cadence = true;
    clock.advance(CONCLUSION_REASK_MS);
    await flush();
    expect(asks.length, 're-asked on the cadence').to.be.greaterThan(0);
    expect(conclusionOwed('hand')).to.equal(true);

    releasable = true;
    clock.advance(CONCLUSION_REASK_MS);
    await flush();
    expect(conclusionOwed('hand')).to.equal(false);
    // …and an ending the CADENCE made is NAMED — the field log's word on a term that is not reactive.
    expect(warned.filter((line) => line.startsWith('[workspace-conclusion] «hand» concluded on the re-ask cadence'))).to.have.length(1);
  });

  it('A GHOST IS TORN DOWN — after the escalation grace AND a continuous confirm, never on one read', async () => {
    enterWorkspace('hand');
    holds.value = {hand: true};
    oweConclusion('hand', true);
    await flush();
    const step = async (ms: number) => {
      for (let t = 0; t < ms; t += CONCLUSION_REASK_MS) {
        clock.advance(CONCLUSION_REASK_MS);
        await flush();
      }
    };
    // Not a ghost for the whole escalation grace: the player is working in it.
    await step(OWED_CONCLUSION_FORCE_MS + 1000);
    expect(forced).to.deep.equal([]);
    // It reads as a ghost now — but one read is not a verdict.
    ghost.value = {hand: true};
    await step(OWED_CONCLUSION_GHOST_CONFIRM_MS - CONCLUSION_REASK_MS);
    expect(forced, 'the confirm window has not run').to.deep.equal([]);
    // …a blink of «not a ghost» restarts the confirm.
    ghost.value = {hand: false};
    await step(CONCLUSION_REASK_MS);
    ghost.value = {hand: true};
    await step(OWED_CONCLUSION_GHOST_CONFIRM_MS - CONCLUSION_REASK_MS);
    expect(forced, 'the confirm restarted').to.deep.equal([]);
    await step(2 * CONCLUSION_REASK_MS);
    expect(forced).to.deep.equal(['hand']);
    expect(conclusionOwed('hand')).to.equal(false);
  });

  it('a flow handed to its own question owes nothing; a door that served asks again at once', async () => {
    enterWorkspace('parliament');
    holds.value = {parliament: true};
    oweConclusion('parliament', true);
    await flush();
    answer = () => 'handed';
    expect(reaskOwedConclusion('parliament')).to.equal('handed');
    expect(conclusionOwed('parliament')).to.equal(false);
    expect(reaskOwedConclusion('parliament'), 'nothing owed — nothing asked').to.equal(undefined);
    await flush();
    expect(dumpFlowTree().some((line) => line.includes('conclusion owed'))).to.equal(false);
  });

  it('withdrawn by another road (the ending came by itself): the run ends at once', async () => {
    enterWorkspace('hand');
    holds.value = {hand: true};
    oweConclusion('hand', true);
    await flush();
    withdrawConclusionOwe('hand');
    await flush();
    expect(dumpFlowTree().some((line) => line.includes('conclusion owed'))).to.equal(false);
    holds.value = {hand: false};
    await flush();
    expect(asks).to.deep.equal([]);
  });

  it('no frame, no debt: an ending reported for a workspace on no stack owes nothing', () => {
    holds.value = {hydro: true};
    oweConclusion('hydro', true);
    expect(owedConclusions()).to.deep.equal([]);
  });
});
