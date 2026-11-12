import {expect} from 'chai';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree, resetFlowKernel} from '@/client/console/kernel/flowScope';
import {beginConsoleSession, consoleSessionScope, endConsoleSession, resetConsoleSession} from '@/client/console/session/consoleSession';
import {createFlowRun} from '@/client/console/session/flowRun';
import {owedAnswer} from '@/client/console/session/owedAnswer';

/**
 * AN ANSWER SOMEBODY WAITS FOR HAS AN OWNER (architecture v2 — PLAN §11 · S6; `session/owedAnswer.ts`). The resolver a
 * module used to keep in a `let` — a transport gate's `resolve`, a pick's callback — is a debt with an owner: it is
 * visible while owed, given once, and CLOSED when its owner ends, so no exit path has to remember it.
 */
describe('an owed answer — the resolver mailbox, with an owner', () => {
  beforeEach(() => {
    resetFlowKernel();
    resetConsoleSession();
    resetFlowKernel();
    setFlowClock(createManualClock(0));
  });
  afterEach(() => {
    resetConsoleSession();
    setFlowClock(undefined);
  });

  const standing = (label: string): Array<string> => dumpFlowTree().filter((line) => line.includes(label));

  it('armed → a step of the tree under its owner; settled → given ONCE, the step gone', () => {
    beginConsoleSession();
    const gate = owedAnswer<[how: string]>('patent-sale:gate');
    const given: Array<string> = [];
    expect(gate.armed).to.equal(false);
    expect(gate.settle('nothing owed'), 'nothing owed — nobody called').to.equal(false);

    gate.arm((how) => given.push(how));
    expect(gate.armed).to.equal(true);
    expect(standing('step:owed:patent-sale:gate'), 'the debt is in the tree').to.have.length(1);

    expect(gate.settle('landed')).to.equal(true);
    expect(gate.settle('again'), 'a second answer gives nothing').to.equal(false);
    expect(given).to.deep.equal(['landed']);
    expect(gate.armed).to.equal(false);
    expect(standing('step:owed:patent-sale:gate')).to.deep.equal([]);
  });

  it('it stands down BEFORE it calls — an answer that re-enters its module finds nothing owed', () => {
    beginConsoleSession();
    const gate = owedAnswer('scene:gate');
    const seen: Array<boolean> = [];
    gate.arm(() => {
      seen.push(gate.armed);
      gate.settle();
    });
    gate.settle();
    expect(seen, 'called once, with the debt already closed').to.deep.equal([false]);
  });

  it('`drop` stands down uncalled; `take` hands the answer over for after the caller\'s own cleanup', () => {
    beginConsoleSession();
    const pick = owedAnswer<[cards: ReadonlyArray<string>]>('hand-pick');
    const given: Array<ReadonlyArray<string>> = [];
    pick.arm((cards) => given.push(cards));
    pick.drop();
    expect(pick.armed).to.equal(false);
    expect(given).to.deep.equal([]);

    pick.arm((cards) => given.push(cards));
    const answer = pick.take();
    expect(pick.armed, 'taken: nothing is owed by the module any more').to.equal(false);
    expect(standing('step:owed:hand-pick')).to.deep.equal([]);
    pick.drop(); // the module's reset, as it runs between the take and the call
    answer?.(['Algae']);
    expect(given).to.deep.equal([['Algae']]);
    expect(pick.take(), 'nothing owed → nothing to take').to.equal(undefined);
  });

  it('a second `arm` replaces the standing answer, uncalled — exactly what an overwritten variable did', () => {
    beginConsoleSession();
    const gate = owedAnswer('scene:gate');
    const given: Array<string> = [];
    gate.arm(() => given.push('first'));
    gate.arm(() => given.push('second'));
    expect(standing('step:owed:scene:gate'), 'ONE debt stands').to.have.length(1);
    gate.settle();
    expect(given).to.deep.equal(['second']);
  });

  it('THE OWNER ENDS UNDER A STANDING DEBT: with `orphaned` the waiting side is RELEASED — nobody had to remember', async () => {
    const session = beginConsoleSession();
    const gate = owedAnswer('scene:gate', {orphaned: () => []});
    let released = false;
    const waiting = new Promise<void>((resolve) => gate.arm(resolve)).then(() => {
      released = true;
    });
    endConsoleSession('the game screen left', session);
    await waiting;
    expect(released).to.equal(true);
    expect(gate.armed).to.equal(false);
  });

  it('…and without it the debt is DROPPED — a pick whose caller left with the screen is not answered', () => {
    const session = beginConsoleSession();
    const pick = owedAnswer<[card: string]>('played-pick');
    const given: Array<string> = [];
    pick.arm((card) => given.push(card));
    endConsoleSession('the game screen left', session);
    expect(pick.armed).to.equal(false);
    expect(given).to.deep.equal([]);
  });

  it('the NARROWEST owner: an answer owed by a run is released by EVERY ending of that run', () => {
    beginConsoleSession();
    const run = createFlowRun('patent-sale');
    const gate = owedAnswer('patent-sale:gate', {owner: () => run.scope, orphaned: () => []});
    let released = 0;
    run.begin();
    gate.arm(() => released++);
    expect(standing('step:owed:patent-sale:gate')[0], 'a step of the run').to.be.a('string');
    run.end();
    expect(released, 'the run ended — by whichever path — and the gate is free').to.equal(1);

    // …and with no run standing the session is the honest owner.
    gate.arm(() => released++);
    expect(gate.armed).to.equal(true);
    expect(consoleSessionScope().ended).to.equal(undefined);
    gate.settle();
    expect(released).to.equal(2);
  });
});
