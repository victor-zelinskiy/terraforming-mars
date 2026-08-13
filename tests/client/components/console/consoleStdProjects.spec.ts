import {expect} from 'chai';
import {
  beginStdProjectSubmit,
  markStdProjectCommit,
  markStdProjectTarget,
  requestStdProjectCancel,
  resetStdProjectsFlow,
  stdProjectsFlow,
  stdProjectsFlowLive,
  stdProjectsFramePhase,
} from '@/client/console/consoleStdProjects';
import {StdProjectItem} from '@/client/console/consoleQuickModel';

const ROW: StdProjectItem = {
  key: 'Asteroid:SP',
  cardName: undefined,
  title: 'Asteroid:SP',
  iconClass: 'std-icon',
  description: 'desc',
  cost: 14,
  available: true,
  reason: '',
};

describe('consoleStdProjects (the flow model)', () => {
  afterEach(() => {
    // Module state is bundle-shared in mochapack — never leak a live flow.
    resetStdProjectsFlow();
  });

  it('maps flow states onto the ONE workspace phase vocabulary', () => {
    // B's verb and the input gate derive from these — the round trip and the
    // committed beat are machine beats (input absorbed), the target step is
    // the flow's reversible configure stage.
    expect(stdProjectsFramePhase('idle')).to.eq('browse');
    expect(stdProjectsFramePhase('submitting')).to.eq('executing');
    expect(stdProjectsFramePhase('target')).to.eq('configure');
    expect(stdProjectsFramePhase('commit')).to.eq('completing');
  });

  it('a submit freezes the rows (a COPY) and arms the board-excursion draft', () => {
    beginStdProjectSubmit('Asteroid:SP', [ROW], 3, '5|0');
    expect(stdProjectsFlowLive()).to.eq(true);
    expect(stdProjectsFlow.state).to.eq('submitting');
    expect(stdProjectsFlow.card).to.eq('Asteroid:SP');
    expect(stdProjectsFlow.submittedAt).to.eq('5|0');
    expect(stdProjectsFlow.boardExcursion).to.deep.eq({card: 'Asteroid:SP', sheetIndex: 3});
    expect(stdProjectsFlow.frozenItems).to.have.length(1);
    // A frozen row is a snapshot, not a reference — the live model moving on
    // must not rewrite what the beat is showing.
    expect(stdProjectsFlow.frozenItems![0]).to.not.eq(ROW);
    expect(stdProjectsFlow.frozenItems![0].cost).to.eq(14);
  });

  it('the terminal commit clears the excursion draft (nothing to come back to)', () => {
    beginStdProjectSubmit('Asteroid:SP', [ROW], 3, '5|0');
    markStdProjectCommit();
    expect(stdProjectsFlow.state).to.eq('commit');
    expect(stdProjectsFlow.boardExcursion).to.eq(undefined);
  });

  it('a target follow-up keeps the flow reversible and the draft armed', () => {
    beginStdProjectSubmit('City:SP', [ROW], 1, '5|0');
    markStdProjectTarget();
    expect(stdProjectsFlow.state).to.eq('target');
    expect(stdProjectsFlow.boardExcursion).to.deep.eq({card: 'City:SP', sheetIndex: 1});
    requestStdProjectCancel();
    expect(stdProjectsFlow.cancelRequested).to.eq(true);
  });

  it('reset returns EVERYTHING to idle (always safe to call)', () => {
    beginStdProjectSubmit('City:SP', [ROW], 1, '5|0');
    markStdProjectTarget();
    requestStdProjectCancel();
    resetStdProjectsFlow();
    expect(stdProjectsFlowLive()).to.eq(false);
    expect(stdProjectsFlow.card).to.eq('');
    expect(stdProjectsFlow.submittedAt).to.eq('');
    expect(stdProjectsFlow.frozenItems).to.eq(undefined);
    expect(stdProjectsFlow.boardExcursion).to.eq(undefined);
    expect(stdProjectsFlow.cancelRequested).to.eq(false);
  });
});
