import {expect} from 'chai';
import {createManualClock, setFlowClock} from '../../src/client/console/kernel/flowClock';
import {delay, openFlowRoot, resetFlowKernel} from '../../src/client/console/kernel/flowScope';
import {resetFlowTrace} from '../../src/client/console/kernel/flowTrace';
import {boundedTree, buildStallEvidence, stallHolder, StallHolderFacts} from '../../src/client/console/supervisor/stallEvidence';
import {DIAG_EVIDENCE_LINE_MAX, DIAG_EVIDENCE_TREE_MAX} from '../../src/common/diagnostics/DiagnosticModel';

/**
 * WHAT STOOD (`supervisor/stallEvidence.ts` — docs/claude/console/freeze-zero/PLAN.md §2.2): the one word that names
 * a stall's holder — the tail of its cause class — and the snapshot its event carries.
 */
const NOBODY: StallHolderFacts = {stranded: false, claim: '', deadFrame: '', beat: false, awaiting: '', block: '', hold: '', deaf: false};

describe('stall evidence — who holds the question, in one word', () => {
  it('ONE precedence: no surface at all, then what keeps a standing surface from taking input, then the circumstantial', () => {
    const all: StallHolderFacts = {stranded: true, claim: 'card-actions:awaiting', deadFrame: 'parliament', beat: true, awaiting: 'hand', block: 'reveal', hold: 'card-receive', deaf: true};
    expect(stallHolder(all), 'a stranded question names the claim beside it (an orphaned claim suppresses the question\'s own surface)').to.eq('stranded+claim:card-actions:awaiting');
    expect(stallHolder({...all, claim: ''})).to.eq('stranded');
    expect(stallHolder({...all, stranded: false})).to.eq('dead-frame:parliament');
    expect(stallHolder({...all, stranded: false, deadFrame: ''})).to.eq('beat');
    expect(stallHolder({...all, stranded: false, deadFrame: '', beat: false})).to.eq('awaiting:hand');
    expect(stallHolder({...all, stranded: false, deadFrame: '', beat: false, awaiting: ''})).to.eq('block:reveal');
    expect(stallHolder({...NOBODY, claim: 'hand:presenting', hold: 'card-receive', deaf: true})).to.eq('claim:hand:presenting');
    expect(stallHolder({...NOBODY, hold: 'card-receive', deaf: true})).to.eq('hold:card-receive');
    expect(stallHolder({...NOBODY, deaf: true}), 'the screen accepts and the presses change nothing').to.eq('deaf');
    expect(stallHolder(NOBODY)).to.eq('none');
  });
});

describe('stall evidence — the snapshot', () => {
  afterEach(() => {
    resetFlowKernel();
    resetFlowTrace();
    setFlowClock(undefined);
  });

  it('carries the kernel\'s tree with every wait, the standing waits, the last records and the pad\'s echo', () => {
    const clock = createManualClock(1_000);
    setFlowClock(clock);
    const session = openFlowRoot('session', 'game');
    const frame = session.open('frame', 'hand');
    frame.detail = 'committed';
    const claim = frame.open('claim', 'hand');
    void claim.wait(delay(20_000), {bound: {ms: 30_000, quiet: 'a spec\'s own wait'}});
    clock.advance(4_000);
    const evidence = buildStallEvidence({question: 'asked card#12 · task handPick', holders: ['holder: block:reveal']}, 5_000);
    expect(evidence.at).to.eq(5_000);
    expect(evidence.question).to.eq('asked card#12 · task handPick');
    expect(evidence.holders).to.deep.eq(['holder: block:reveal']);
    expect(evidence.tree.some((line) => /^ {2}frame:hand#\d+ 4\.0s committed/.test(line)), evidence.tree.join('\n')).to.eq(true);
    expect(evidence.tree.some((line) => /^ {4}claim:hand#\d+ .*⟵ waits/.test(line)), 'the waiting scope names what it waits for').to.eq(true);
    expect(evidence.trace.some((line) => / open frame:hand#/.test(line)), 'the kernel\'s last records').to.eq(true);
    expect(evidence.input).to.contain('A/B presses');
    clock.advance(30_000);
    frame.end({how: 'done'});
    session.end({how: 'done'});
    expect(clock.pending(), 'nothing of the spec stands').to.eq(0);
  });

  it('is bounded: a tree that does not fit keeps what is near the roots and every scope that WAITS', () => {
    const lines = ['session:game#1 100.0s'];
    for (let i = 0; i < 400; i++) {
      lines.push(`      task:leaf#${i} 1.0s`);
    }
    lines.push('      scene:hold:played-hero#7 30.0s  ⟵ waits «the lift» 30.0s/35s');
    lines.push(`  frame:hand#3 40.0s ${'x'.repeat(600)}`);
    const tree = boundedTree(lines);
    expect(tree.length).to.be.at.most(DIAG_EVIDENCE_TREE_MAX + 1);
    expect(tree[0]).to.eq('session:game#1 100.0s');
    expect(tree.some((line) => line.includes('scene:hold:played-hero#7')), 'a scope that waits is never cut for an idle leaf').to.eq(true);
    expect(tree.every((line) => line.length <= DIAG_EVIDENCE_LINE_MAX)).to.eq(true);
    expect(tree[tree.length - 1]).to.match(/^… \d+ more scope\(s\) stand/);
    expect(boundedTree(['a', 'b'])).to.deep.eq(['a', 'b']);
  });
});
