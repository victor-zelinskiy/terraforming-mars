import {expect} from 'chai';
import {watch} from 'vue';
import {createManualClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {dumpFlowTree, resetFlowKernel} from '@/client/console/kernel/flowScope';
import {beginConsoleSession, endConsoleSession, resetConsoleSession} from '@/client/console/session/consoleSession';
import {advanceQuestion, questionKeyStanding, questionScope, resetQuestionScope} from '@/client/console/session/questionScope';
import {scopedState} from '@/client/console/session/scopedState';
import {collapseWorkspaceStack, enterWorkspace, resetWorkspaceStack, restoreWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {consoleState} from '@/client/console/consoleRouter';
import {lastQuestionTakenUp, questionSetAside, setAsideRecord, setQuestionAside, takeUpQuestion} from '@/client/console/setAside';

/**
 * THE QUESTION IS A SCOPE (architecture v2 — PLAN §5 · S4; `session/questionScope.ts`). What exists only for the
 * server's current question — the branch a task was sent to place, a client-built payment, the play composer, «set
 * aside» — is opened IN that scope and ends with it; the view-apply reaction no longer lowers nineteen flags by hand.
 */
describe('the question\'s scope — what belongs to a question ends with it', () => {
  beforeEach(() => {
    resetFlowKernel();
    resetConsoleSession();
    resetQuestionScope();
    resetFlowKernel();
    resetWorkspaceStack();
    setFlowClock(createManualClock(0));
  });
  afterEach(() => {
    resetWorkspaceStack();
    resetQuestionScope();
    resetConsoleSession();
    setFlowClock(undefined);
  });

  const standing = (label: string): Array<string> => dumpFlowTree().filter((line) => line.includes(label));

  it('one scope per question, a child of the session; the next question ends the one that stood', () => {
    beginConsoleSession();
    advanceQuestion('or|Take your first action');
    const first = questionScope();
    expect(first.parent?.kind).to.equal('session');
    expect(questionKeyStanding()).to.equal('or|Take your first action');
    expect(questionScope(), 'asked again: the same scope').to.equal(first);

    advanceQuestion('space|Select space for ocean');
    expect(first.ended, 'the question that stood is over').to.not.equal(undefined);
    expect(questionScope()).to.not.equal(first);
    expect(standing('question:'), 'ONE question stands').to.have.length(1);
  });

  it('a latch of the question falls at `advanceQuestion` — in that very call, as an edge its watchers see', () => {
    beginConsoleSession();
    advanceQuestion('or|menu');
    const pendingPayment = scopedState('pending-client-payment', undefined as {cost: number} | undefined, questionScope);
    const seen: Array<number | undefined> = [];
    watch(pendingPayment, (value) => seen.push(value?.cost), {flush: 'sync'});

    pendingPayment.value = {cost: 12};
    expect(standing('step:pending-client-payment'), 'raised: a step of the question').to.have.length(1);

    advanceQuestion('payment|Pay');
    expect(pendingPayment.value, 'the server asks something else — the payment built for the old question is gone').to.equal(undefined);
    expect(seen).to.deep.equal([12, undefined]);
    expect(standing('step:pending-client-payment')).to.deep.equal([]);
  });

  it('a latch raised before any question was applied belongs to «no question yet» — and ends with the first one', () => {
    beginConsoleSession();
    const pick = scopedState('final-greenery-pick-pending', false, questionScope);
    pick.value = true;
    expect(questionKeyStanding()).to.equal('');
    advanceQuestion('space|greenery');
    expect(pick.value).to.equal(false);
  });

  it('`outlives`: the latch is re-homed under the NEXT question and asked again when that one leaves', () => {
    beginConsoleSession();
    advanceQuestion('card|pick');
    let sceneStillPlays = true;
    const pick = scopedState('pending-client-pick', undefined as {answered: boolean} | undefined, questionScope, {outlives: () => sceneStillPlays});
    pick.value = {answered: true};

    advanceQuestion('or|menu');
    expect(pick.value, 'the answer\'s scene still plays: the pick outlives the question it answered').to.deep.equal({answered: true});
    expect(standing('step:pending-client-pick'), '…as a step of the question that stands now').to.have.length(1);

    sceneStillPlays = false;
    advanceQuestion('or|next menu');
    expect(pick.value, 'asked again at the next change, exactly as the reaction used to re-check it').to.equal(undefined);
  });

  it('nothing outlives the SESSION — a latch that would outlive a question still falls when the game screen leaves', () => {
    const session = beginConsoleSession();
    advanceQuestion('card|pick');
    const pick = scopedState('pending-client-pick', false, questionScope, {outlives: () => true});
    pick.value = true;
    endConsoleSession('the game screen left', session);
    expect(pick.value).to.equal(false);
    expect(standing('step:pending-client-pick')).to.deep.equal([]);
  });

  describe('«set aside» is a record of the question', () => {
    it('two verbs with a reason; the projection every `v-if` reads follows; taking up nothing is nothing', () => {
      beginConsoleSession();
      advanceQuestion('or|menu');
      expect(consoleState.task.deferred).to.equal(false);
      takeUpQuestion('answered');
      expect(lastQuestionTakenUp(), 'nothing was set aside — nothing recorded').to.equal(undefined);

      setQuestionAside('question');
      expect(questionSetAside()).to.equal(true);
      expect(consoleState.task.deferred, 'the read-only projection').to.equal(true);
      expect(setAsideRecord()?.what).to.equal('question');
      expect(standing('step:set-aside'), 'it stands in the tree, under its question').to.have.length(1);

      takeUpQuestion('restored');
      expect(consoleState.task.deferred).to.equal(false);
      expect(lastQuestionTakenUp()?.why).to.equal('restored');
    });

    it('it ends with its question — nobody has to lower it when the server asks something else', () => {
      beginConsoleSession();
      advanceQuestion('or|menu');
      setQuestionAside('navigation');
      advanceQuestion('space|Select space');
      expect(questionSetAside()).to.equal(false);
    });

    it('PARKED ⇒ SET ASIDE: while a parked chain stands the record outlives its question; once the park is gone it ends with the next', () => {
      beginConsoleSession();
      advanceQuestion('or|menu');
      enterWorkspace('card-actions');
      collapseWorkspaceStack();
      setQuestionAside('chain');

      advanceQuestion('card|buy');
      expect(questionSetAside(), 'the restore card is the one way back to the parked chain — it must still be drawn').to.equal(true);

      restoreWorkspaceStack();
      advanceQuestion('or|menu again');
      expect(questionSetAside(), 'nothing is parked any more').to.equal(false);
    });

    it('a stronger reason renames a standing record; it keeps its age', () => {
      beginConsoleSession();
      advanceQuestion('or|menu');
      setQuestionAside('question');
      const since = setAsideRecord()!.since;
      setQuestionAside('chain');
      expect(setAsideRecord()).to.deep.equal({what: 'chain', since});
      setQuestionAside('navigation');
      expect(setAsideRecord()?.what, 'a weaker reason does not').to.equal('chain');
    });
  });
});
