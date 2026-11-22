import {expect} from 'chai';
import {FRAME_PROTOCOL, frameEdgeOnProtocol, frameMoveOnProtocol} from '../../../src/client/console/consoleWorkspaceFrame';
import {WorkspacePhase} from '../../../src/client/console/consoleWorkspaceFlow';
import {machineEdges, machineUniverse} from '../../../src/client/console/flowCoverageProbe';
import {createManualClock, setFlowClock} from '../../../src/client/console/kernel/flowClock';
import {coverageKeyOf, coverageScope, flowCoverage, installFlowCoverage, resetFlowCoverage, seedFlowCoverage} from '../../../src/client/console/kernel/flowCoverage';
import {FLOW_MACHINES} from '../../../src/client/console/kernel/flowMachines';
import {delay, openFlowRoot, resetFlowKernel} from '../../../src/client/console/kernel/flowScope';
import {resetFlowTrace} from '../../../src/client/console/kernel/flowTrace';

/**
 * THE KERNEL'S STATE SPACE, WALKED (`kernel/flowCoverage.ts`, `flowCoverageProbe.ts` —
 * docs/claude/console/freeze-zero/PLAN.md §3.1): the trace's steps as coverage keys with what varies between two runs
 * of one flow taken out, and the universe of what the registered machines can do.
 */
describe('flow coverage — the kernel\'s trace as keys', () => {
  afterEach(() => {
    resetFlowCoverage();
    resetFlowKernel();
    resetFlowTrace();
    setFlowClock(undefined);
  });

  it('a scope\'s name loses what varies between two runs of one flow', () => {
    expect(coverageScope('frame:hand#3')).to.eq('frame:hand');
    expect(coverageScope('question:card#12')).to.eq('question:card');
    expect(coverageScope('scene:hold:played-hero#40')).to.eq('scene:hold:played-hero');
    expect(coverageScope('claim:hand/Ganymede Colony#7'), 'a claim is its host\'s — the card is the table\'s').to.eq('claim:hand');
    expect(coverageScope('submit#31')).to.eq('submit');
  });

  it('each kind of record marks one key; what ends a wait already counted marks none', () => {
    expect(coverageKeyOf({kind: 'open', scope: 'frame:hand#3', detail: 'in chain:live#1'})).to.eq('open frame:hand');
    expect(coverageKeyOf({kind: 'end', scope: 'frame:hand#3', detail: 'cancelled (the frame left)'})).to.eq('end frame:hand cancelled');
    expect(coverageKeyOf({kind: 'end', scope: 'scene:hold:played-hero#2', detail: 'expired (35000ms)'})).to.eq('end scene:hold:played-hero expired');
    expect(coverageKeyOf({kind: 'state', scope: 'frame:hand#3', detail: 'browse → committed'})).to.eq('state frame:hand browse → committed');
    expect(coverageKeyOf({kind: 'wait', scope: 'claim:hand/Pets#7', detail: 'server «the claimed answer» ≤20000ms'})).to.eq('wait claim:hand server');
    expect(coverageKeyOf({kind: 'bound', scope: 'frame:hand#3', detail: '«x» 60000ms'})).to.eq('bound frame:hand');
    expect(coverageKeyOf({kind: 'cycle', scope: 'step:x#1', detail: 'a → b → a'})).to.eq('cycle step:x');
    expect(coverageKeyOf({kind: 'met', scope: 'frame:hand#3', detail: '«x» after 10ms'})).to.eq(undefined);
    expect(coverageKeyOf({kind: 'cancel', scope: 'frame:hand#3', detail: '«x» — gone'})).to.eq(undefined);
  });

  it('marks what a session walks — the same flow twice is one key — and nothing until asked', () => {
    const clock = createManualClock(0);
    setFlowClock(clock);
    const idle = openFlowRoot('session', 'game');
    idle.open('frame', 'hand').end({how: 'done'});
    expect(flowCoverage(), 'nothing is marked until coverage is installed').to.deep.eq([]);
    const stop = installFlowCoverage();
    for (let run = 0; run < 2; run++) {
      const frame = idle.open('frame', 'hand');
      void frame.wait(delay(1_000), {bound: {ms: 5_000, quiet: 'a spec\'s own wait'}});
      clock.advance(1_000);
      frame.end({how: 'done'});
    }
    idle.open('frame', 'colonies').end({how: 'cancelled', reason: 'left'});
    expect(flowCoverage()).to.deep.eq([
      'end frame:colonies cancelled', 'end frame:hand done', 'open frame:colonies', 'open frame:hand', 'wait frame:hand motion',
    ]);
    // A reload of the same walk hands its keys to the next page.
    seedFlowCoverage(['open frame:parliament']);
    expect(flowCoverage()).to.include('open frame:parliament');
    stop();
    idle.open('frame', 'hydro').end({how: 'done'});
    expect(flowCoverage(), 'stopped: nothing more is marked').to.not.include('open frame:hydro');
    idle.end({how: 'done'});
  });
});

describe('flow coverage — what the registered machines can do', () => {
  it('every machine has moves, and they are named the way the trace prints a transition', () => {
    let moves = 0;
    for (const entry of FLOW_MACHINES) {
      const edges = machineEdges(entry.machine, entry.events, entry.input, entry.key);
      moves += edges.length;
      for (const edge of edges) {
        expect(edge, entry.name).to.match(/^.+ → .+$/);
      }
    }
    // (A machine born at rest — an announce already acknowledged — has no move of its own; the register as a whole has many.)
    expect(moves, 'the explorer reached the moves of the machines').to.be.greaterThan(20);
  });

  it('the universe is by the scope kind a machine runs in', () => {
    const universe = machineUniverse();
    expect(Object.keys(universe).sort()).to.deep.eq(['announce', 'claim', 'frame', 'submit']);
    expect(universe.frame, 'a frame crosses its commit').to.include('browse → committed');
    expect(universe.submit.some((edge) => edge.startsWith('sending → ')), 'a submit leaves the wire').to.eq(true);
  });

  /*
   * THE FRAME'S PROTOCOL (`consoleWorkspaceFrame.FRAME_PROTOCOL` — FREEZE ZERO, stage 4). The machine takes any phase
   * from any phase; the universe of the coverage is the moves the PRODUCT makes — read off 3 421 walks (the whole e2e
   * suite, the monkey in the bottle, the monkey in the real browser), written down, and held here.
   */
  describe('the frame — its universe is its protocol, not every pair', () => {
    const PHASES: ReadonlyArray<WorkspacePhase> = ['browse', 'configure', 'executing', 'committed', 'verdict', 'completing'];

    it('the protocol by phase: what the walks made, and nothing a walk never made', () => {
      // (Each a move the walks made hundreds of times.)
      expect(frameMoveOnProtocol('browse', 'configure')).to.eq(true);
      expect(frameMoveOnProtocol('configure', 'executing')).to.eq(true);
      expect(frameMoveOnProtocol('executing', 'committed')).to.eq(true);
      expect(frameMoveOnProtocol('executing', 'configure'), 'a press that did not land goes back where it came from').to.eq(true);
      expect(frameMoveOnProtocol('committed', 'completing')).to.eq(true);
      expect(frameMoveOnProtocol('verdict', 'executing'), 'the verdict has one door — its «ОК»').to.eq(true);
      // (A phase written again is no move.)
      for (const phase of PHASES) {
        expect(frameMoveOnProtocol(phase, phase), phase).to.eq(true);
      }
      // (…and what no walk of the product makes.)
      expect(frameMoveOnProtocol('verdict', 'browse')).to.eq(false);
      expect(frameMoveOnProtocol('configure', 'verdict')).to.eq(false);
      expect(frameMoveOnProtocol('browse', 'completing')).to.eq(false);
      expect(frameMoveOnProtocol('completing', 'browse'), 'a completing frame LEAVES — it never folds back by a move').to.eq(false);
      expect(frameMoveOnProtocol('completing', 'committed'), 'its bound, and the recovery that follows').to.eq(true);
      // (Nineteen moves by phase, of thirty pairs.)
      expect(PHASES.reduce((sum, phase) => sum + FRAME_PROTOCOL[phase].length, 0)).to.eq(19);
    });

    it('the same law over the machine\'s state values, as the trace prints them', () => {
      expect(frameEdgeOnProtocol('browse', '{"executing":"onStage"}')).to.eq(true);
      expect(frameEdgeOnProtocol('{"executing":"onStage"}', '{"executing":"away"}'), 'a beat set aside is the same phase').to.eq(true);
      expect(frameEdgeOnProtocol('{"completing":"onStage"}', 'committed')).to.eq(true);
      expect(frameEdgeOnProtocol('verdict', 'configure')).to.eq(false);
      expect(frameEdgeOnProtocol('{"completing":"away"}', 'browse')).to.eq(false);
    });

    it('the universe holds the protocol only — and the machine still CAN do the rest (the law judges that)', () => {
      const frame = FLOW_MACHINES.find((entry) => entry.name === 'frame')!;
      const all = machineEdges(frame.machine, frame.events, frame.input, frame.key);
      const universe = machineUniverse().frame;
      expect(universe.length, 'the protocol is a part of what the machine takes').to.be.lessThan(all.length);
      for (const edge of universe) {
        const [from, to] = edge.split(' → ');
        expect(frameEdgeOnProtocol(from, to), edge).to.eq(true);
      }
      // (Every edge left out is a move off the protocol — none dropped by accident.)
      for (const edge of all.filter((e) => !universe.includes(e))) {
        const [from, to] = edge.split(' → ');
        expect(frameEdgeOnProtocol(from, to), edge).to.eq(false);
      }
      expect(universe).to.include('{"completing":"onStage"} → committed');
      expect(universe).not.to.include('verdict → browse');
    });
  });
});
