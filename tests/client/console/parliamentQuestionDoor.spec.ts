import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {
  closeStage, foldFinishedStage, overviewServesQuestion, ParliamentSectionPort, playWalkAnswer, retireFinishedFlows, retireQuestFlow, serveStandingQuestion,
  standingDoorOwed, standingQuestionServed, walkRunAlive,
} from '@/client/components/console/consoleParliamentSectionLogic';
import {AgendaWalkBeat, agendaWalkFlow, resetAgendaWalkFlow} from '@/client/console/parliament/agendaWalk';
import {armChairmanQuestFlow, chairmanQuestFlow, resetChairmanQuestFlow} from '@/client/console/parliament/consoleChairmanQuest';
import {killChairmanQuestBeats} from '@/client/console/parliament/chairmanQuestDirector';
import {parliamentFlow, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {resetParliamentRewards} from '@/client/console/parliament/parliamentRewardBeat';
import {resetNeutralRallyFlow} from '@/client/console/parliament/neutralRally';

/*
 * WAIT GRAPH R1 / W2 — THE PARLIAMENT'S QUESTION DOOR SAYS «SERVED» ONLY WHEN IT SERVES (wait-graph-inventory.md).
 *
 * The shell's guarded conclusion, held on `owned-prompt` for the Parliament, opens the section's door
 * (`serveStandingQuestion`) and DROPS its owe on `true` — the question's own flow is trusted to end it. The door used
 * to answer `true` from any stage that was not browse / landed / access (a support / banner / delegate mode standing
 * `done` after its flow-complete — R1), and from the overview even when its quest-gate door stayed shut behind an owed
 * walk (W2): an orphan the owe no longer tracked. Now: a stage that serves the question → `true`, nothing done; a
 * FINISHED stage folds back by its own close and the overview's doors are asked → `true` (its pending fold); anything
 * that cannot serve → `false` and NOTHING touched — the shell keeps the conclusion owed.
 *
 * And R5 — the walk's inner endings are keyed on the run's own record, never the global `live`.
 *
 * The door's bodies stand in the section's sibling module (`consoleParliamentSectionLogic.ts` — the component is their
 * one-line delegates over its PORT) and run here against a stub port (the point is what the door decides and touches,
 * not the mount of the section).
 */
const BLUE = 'blue' as Color;

type Stub = ParliamentSectionPort & Record<string, unknown> & {
  calls: Array<string>;
  ticks: Array<() => void>;
};

/** A section stub: the real door members, the overview's doors simulated by `reconcileStandingPrompts`. */
function section(over: Record<string, unknown> = {}): Stub {
  const stub = {
    calls: [],
    ticks: [],
    warm: false,
    leaving: false,
    embedded: false,
    sittingUp: false,
    questGate: undefined,
    bridge: {},
    reconciledKey: 'k',
    answerKey: 'k',
    walkOwed: false,
    refs: {},
    ...over,
  } as unknown as Stub;
  // The real members, each reading the stub as its port — a member another one calls THROUGH the port is the real one
  // too (the two that read nothing of the section take no port).
  stub.serveStandingQuestion = () => serveStandingQuestion(stub);
  stub.standingDoorOwed = () => standingDoorOwed(stub);
  stub.standingQuestionServed = () => standingQuestionServed(stub);
  stub.overviewServesQuestion = () => overviewServesQuestion(stub);
  stub.foldFinishedStage = () => foldFinishedStage(stub);
  stub.retireFinishedFlows = retireFinishedFlows;
  stub.retireQuestFlow = () => retireQuestFlow(stub);
  stub.closeStage = () => closeStage(stub);
  stub.walkRunAlive = walkRunAlive;
  stub.playWalkAnswer = (seq: number, onDone: () => void) => playWalkAnswer(stub, seq, onDone);
  stub.$nextTick = (fn: () => void) => {
    stub.ticks.push(fn);
    return Promise.resolve();
  };
  stub.voteModeNow = () => ({closeVote: () => {
    stub.calls.push('closeVote');
    parliamentFlow.stage = 'browse';
  }});
  // THE OVERVIEW'S DOORS, as their watchers open them from browse (the quest gate behind the same conditions).
  stub.reconcileStandingPrompts = () => {
    stub.calls.push('reconcile');
    if (parliamentFlow.stage !== 'browse') {
      return;
    }
    if (stub.questGate !== undefined && !chairmanQuestFlow.live && !stub.embedded && agendaWalkFlow.owed === undefined) {
      armChairmanQuestFlow(undefined, BLUE);
      parliamentFlow.stage = 'quest';
    }
  };
  return stub;
}

function finishedMode(stub: Stub, mode: 'support' | 'banner' | 'delegate'): void {
  parliamentFlow.stage = mode;
  if (mode === 'support') {
    parliamentFlow.supportBeat = 'done';
  } else if (mode === 'banner') {
    parliamentFlow.bannerBeat = 'done';
  } else {
    parliamentFlow.delegateBeat = 'done';
  }
  (stub.refs as Record<string, unknown>)[`${mode}Mode`] = {closeFinished: () => stub.calls.push(`closeFinished:${mode}`)};
}

function owedWalk(beat: AgendaWalkBeat, live: boolean): void {
  agendaWalkFlow.owed = {player: BLUE, from: 1, to: 2, steps: [{to: 2}], seq: 7, card: CardName.MINORITY_REPRESENTATION, generation: 3, host: 'parliament'};
  agendaWalkFlow.live = live;
  agendaWalkFlow.beat = beat;
}

function resetAll(): void {
  killChairmanQuestBeats();
  resetChairmanQuestFlow();
  resetAgendaWalkFlow();
  resetNeutralRallyFlow();
  resetParliamentFlow();
  resetParliamentHolds();
  resetParliamentRewards();
}

describe('ConsoleParliamentSection — wait graph R1 / W2: the question door says «served» only when it serves', () => {
  beforeEach(resetAll);
  afterEach(resetAll);

  it('nothing owed, or a door that cannot serve (embedded / warm / leaving): `false`, nothing touched', () => {
    expect(serveStandingQuestion(section())).is.false;
    for (const flag of ['embedded', 'warm', 'leaving']) {
      const stub = section({questGate: {generation: 3}, [flag]: true});
      expect(serveStandingQuestion(stub), flag).is.false;
      expect(stub.calls, flag).deep.eq([]);
    }
  });

  it('R1 — a FINISHED mode (support / banner / delegate `done`) folds back by its own close; the overview\'s doors are asked on the next tick', () => {
    for (const mode of ['support', 'banner', 'delegate'] as const) {
      resetAll();
      const stub = section({questGate: {generation: 3}});
      finishedMode(stub, mode);
      expect(serveStandingQuestion(stub), mode).is.true;
      expect(stub.calls, mode).deep.eq([`closeFinished:${mode}`]);
      expect(parliamentFlow.stage, `${mode}: folded to the overview`).eq('browse');
      stub.ticks.splice(0).forEach((fn) => fn());
      expect(parliamentFlow.stage, `${mode}: the overview's door opened the quest`).eq('quest');
      expect(chairmanQuestFlow.live).is.true;
    }
  });

  it('R1 — a mode still AT WORK for something else is not this door\'s to cut: `false`, the stage stands', () => {
    const stub = section({questGate: {generation: 3}});
    finishedMode(stub, 'support');
    parliamentFlow.supportBeat = 'discard';
    expect(serveStandingQuestion(stub)).is.false;
    expect(stub.calls).deep.eq([]);
    expect(parliamentFlow.stage).eq('support');
  });

  it('a stage that SERVES the question (the live pick\'s own mode, the quest\'s own flow) answers `true` and does nothing', () => {
    const pick = section({bridge: {supportPick: {staged: false, meta: {}}}});
    parliamentFlow.stage = 'support';
    parliamentFlow.supportBeat = '';
    expect(serveStandingQuestion(pick)).is.true;
    expect(pick.calls).deep.eq([]);

    resetAll();
    const quest = section({questGate: {generation: 3}});
    armChairmanQuestFlow(undefined, BLUE);
    parliamentFlow.stage = 'quest';
    expect(serveStandingQuestion(quest)).is.true;
    expect(quest.calls).deep.eq([]);
  });

  it('W2 — the overview whose quest door stays SHUT behind an owed walk: `false`, and the finished mode is NOT folded either', () => {
    const browse = section({questGate: {generation: 3}});
    owedWalk('', false);
    expect(serveStandingQuestion(browse), 'browse: the quest gate waits for the walk').is.false;
    expect(browse.calls).deep.eq([]);

    const mode = section({questGate: {generation: 3}});
    finishedMode(mode, 'banner');
    expect(serveStandingQuestion(mode)).is.false;
    expect(mode.calls).deep.eq([]);
    expect(parliamentFlow.stage).eq('banner');
  });

  it('W2 — the overview\'s doors are asked and the door answers what they DID: a reconcile that opened nothing is `false`', () => {
    const stub = section({bridge: {seat: {type: 'party'}}});
    expect(serveStandingQuestion(stub), 'the seat door opened nothing in this stub').is.false;
    expect(stub.calls).deep.eq(['reconcile']);
  });

  it('a FINISHED walk\'s record no longer shuts the quest door: it is retired, the quest opens in place → `true`', () => {
    const stub = section({questGate: {generation: 3}});
    owedWalk('done', true);
    expect(serveStandingQuestion(stub)).is.true;
    expect(agendaWalkFlow.owed, 'the finished walk is retired').is.undefined;
    expect(parliamentFlow.stage).eq('quest');
  });

  it('a finished vote (`landed`) folds by its own leave and asks the doors on the next tick → `true`', () => {
    const stub = section({questGate: {generation: 3}});
    parliamentFlow.stage = 'landed';
    expect(serveStandingQuestion(stub)).is.true;
    expect(stub.calls).deep.eq(['closeVote']);
    stub.ticks.splice(0).forEach((fn) => fn());
    expect(parliamentFlow.stage).eq('quest');
  });
});

describe('ConsoleParliamentSection — wait graph R5: a walk run\'s endings are keyed on its own record', () => {
  beforeEach(resetAll);
  afterEach(resetAll);

  it('`walkRunAlive` reads the run\'s own seq — a released or replaced run is dead even while ANOTHER walk is live', () => {
    owedWalk('walk', true);
    expect(walkRunAlive(7)).is.true;
    expect(walkRunAlive(6), 'an older run: the global `live` is the next walk\'s').is.false;
    agendaWalkFlow.live = false;
    expect(walkRunAlive(7)).is.false;
  });

  it('a stale run\'s read beat ends NOTHING — the next walk\'s flow is never ended by it', () => {
    const stub = section();
    owedWalk('read', true);
    let ended = 0;
    playWalkAnswer(stub, 6, () => ended++);
    expect(ended, 'run #6 is not the one playing').eq(0);
    playWalkAnswer(stub, 7, () => ended++);
    expect(ended, 'the live run #7 ends (no receipt owed)').eq(1);
  });
});
