/*
 * A STANDARD PROJECT'S SAFETY BELONGS TO ITS OWN SUBMIT (FLAKE ZERO · the hunt 44954735303 — `stdProjectsController`).
 *
 * A submit whose answer never lands must not strand the workspace in its sealed `executing` beat: a 12 s safety rolls
 * the flow back to browse. Its fingerprint used to be «still submitting the SAME CARD» — and the same project played
 * twice within the 12 s (Air Scrapping at Venus 30 %, then again at 32 %) met it: the FIRST submit's safety fired
 * 110 ms into the SECOND one, rolled the live flow back, and the Venus bonus that submit's answer asked found no host —
 * it stood on its own band beside the browse list (2 of 120). The safety now names its submit (`submitSeq`).
 */
import {expect} from 'chai';
import {effectScope, EffectScope} from 'vue';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {createStdProjectsController, StdProjectsPort} from '@/client/console/shell/stdProjectsController';
import {resetStdProjectsFlow, stdProjectSubmitLive, stdProjectsFlow} from '@/client/console/consoleStdProjects';
import {releaseStdProjectCommit} from '@/client/console/consoleStdProjectCommit';
import {enterWorkspace, resetWorkspaceStack} from '@/client/console/consoleWorkspaceStack';
import {SubmitTicket} from '@/client/console/transport/gameTransport';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardName} from '@/common/cards/CardName';
import {Payment} from '@/common/inputs/Payment';

const SAFETY_MS = 12_000;

describe('standard projects · the lost answer\'s safety belongs to ONE submit', () => {
  let clock: ManualFlowClock;
  let es: EffectScope;
  let notices: Array<string>;
  let submits: number;
  let controller: ReturnType<typeof createStdProjectsController>;

  beforeEach(() => {
    resetStdProjectsFlow();
    resetWorkspaceStack();
    clock = createManualClock(0);
    setFlowClock(clock);
    notices = [];
    submits = 0;
    const port = {
      surfaces: {at: () => undefined},
      actionBlockedReason: undefined,
      awaitingInput: true,
      cardsTotalCount: 0,
      colonyResolutionLive: false,
      concludeWorkspaceFlow: () => true,
      game: {gameAge: 9, undoCount: 0, gameOptions: {fastModeOption: false}},
      handEntries: [],
      myTurn: true,
      openHandWithReveal: () => Promise.resolve(),
      pendingClientPayment: undefined,
      pendingClientPick: undefined,
      placementActive: false,
      // The standard projects asked as the top-level prompt (no OrOptions to walk): the submit's path is `[]`.
      playerView: {waitingFor: {type: 'projectCard', promptId: 3, cards: [], title: ''}} as unknown as PlayerViewModel,
      shellTask: {kind: 'projectCard', mode: 'standardProject'},
      showNotice: (message: string) => notices.push(message),
      submit: () => {
        submits += 1;
        return {accepted: true} as unknown as SubmitTicket;
      },
      submitBatch: () => ({accepted: true}) as unknown as SubmitTicket,
      thisPlayer: {megacredits: 40, patentSalesThisGeneration: 0},
      viewerPassed: false,
    } as unknown as StdProjectsPort;
    es = effectScope();
    controller = es.run(() => createStdProjectsController(port))!;
    enterWorkspace('standard-projects');
  });
  afterEach(() => {
    es.stop();
    releaseStdProjectCommit();
    resetStdProjectsFlow();
    resetWorkspaceStack();
    setFlowClock(undefined);
  });

  function press(): number {
    controller.submitStandardProjectPayment(CardName.AIR_SCRAPPING_STANDARD_PROJECT_VARIANT, Payment.of({megacredits: 15}));
    expect(stdProjectsFlow.state, 'the press put the flow on the wire').to.eq('submitting');
    return stdProjectsFlow.submitSeq;
  }

  it('a LOST answer: the submit\'s own safety rolls the flow back at 12 s and says so', () => {
    const seq = press();
    clock.advance(SAFETY_MS - 1);
    expect(stdProjectSubmitLive(seq), 'still on the wire').to.eq(true);
    clock.advance(1);
    expect(stdProjectsFlow.state, 'rolled back to browse').to.eq('idle');
    expect(notices, 'the rollback names itself to the player').to.have.length(1);
  });

  it('the SAME project submitted again inside the 12 s is never rolled back by the FIRST submit\'s safety', () => {
    const first = press();
    // The first submit is answered and its flow ends (the terminal beat, the conclusion) — its safety still stands.
    clock.advance(4_000);
    resetStdProjectsFlow();
    clock.advance(4_000);
    const second = press();
    expect(second, 'a submit of its own').to.not.eq(first);
    expect(submits).to.eq(2);
    // The first safety comes due here — 12 s after the FIRST press, 4 s into the second submit.
    clock.advance(SAFETY_MS - 8_000);
    expect(stdProjectSubmitLive(second), 'the second submit stands — the first safety let it be').to.eq(true);
    expect(notices, 'no rollback notice').to.have.length(0);
    // …while the second submit's OWN safety still guards it.
    clock.advance(8_000);
    expect(stdProjectsFlow.state, 'its own safety rolls it back').to.eq('idle');
    expect(notices).to.have.length(1);
  });
});
