import {expect} from 'chai';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {armChairmanQuestFlow, chairmanQuestFlow, resetChairmanQuestFlow} from '@/client/console/parliament/consoleChairmanQuest';
import {
  CHAIRMAN_QUEST_REACTION_UNSERVED_MS, chairmanQuestAwaitsReaction, chairmanQuestRunLive, ChairmanQuestDirectorContext, finishChairmanQuestBeats,
  hurryChairmanQuestReaction, killChairmanQuestBeats, noteChairmanQuestAnswer, probeChairmanQuestReaction, startChairmanQuestBeats,
} from '@/client/console/parliament/chairmanQuestDirector';
import {resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {resetParliamentRewards} from '@/client/console/parliament/parliamentRewardBeat';
import {resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {activeAnimationHoldLabels} from '@/client/components/presentation/animationHold';

/*
 * WAIT GRAPH R3 — «ИСТРЕБИТЕЛЬ»: THE FLOW HOLDING FOR THE TABLE'S QUESTION IS NEVER A DEAF SCREEN.
 *
 * The chairmanship flow holds after the step's bonus when a card of the viewer's table answers the step with a
 * question (TR78 Arwind Inc.). Its hold is released there (the pick is the player's — no ceiling over a decision) —
 * and it used to wait with NO bound, A and B both inert: a question that never reached the quest's answer stage
 * (nothing serving it) left the player in front of a screen nothing could end. The wait is now the flow's own and
 * bounded: it re-reads its question — gone ends the flow, standing UNSERVED past its bound settles it (`done`, A / B
 * close) — and A hurries either ending.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

function model(): ParliamentModel {
  return {
    slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, deckSize: 10, discardSize: 0, neutralSupply: 14, botMode: 'none',
    chairman: RED,
    players: [BLUE, RED].map((color) => ({
      color, participates: true, lobby: true, reserve: 5, onResolutions: 0,
      chairman: false, agenda: 1, influence: 1, access: [], partyActionUses: {}, resolutionActionUses: 0,
    })),
  } as unknown as ParliamentModel;
}

type Table = {question: string | undefined, served: boolean, done: number};

/** Start the beats and drive them («дожать») to the hold for the table's question. */
function holdForQuestion(table: Table): void {
  armChairmanQuestFlow(model(), BLUE);
  const ctx: ChairmanQuestDirectorContext = {
    root: document.createElement('div'),
    viewer: BLUE,
    generation: 3,
    playAgendaWalk: (_record, hooks) => hooks.onLanded(),
    onStage: () => undefined,
    owesSeatPick: () => false,
    owesReaction: () => table.question,
    reactionServed: () => table.served,
    onDone: () => {
      table.done++;
    },
  };
  startChairmanQuestBeats(ctx);
  noteChairmanQuestAnswer();
  finishChairmanQuestBeats();
}

describe('«ПРЕДСЕДАТЕЛЬСТВО» — wait graph R3: the hold for the table\'s question is bounded and answers A / B', () => {
  function resetAll(): void {
    killChairmanQuestBeats();
    resetChairmanQuestFlow();
    resetParliamentHolds();
    resetParliamentRewards();
    resetParliamentFlow();
  }
  beforeEach(resetAll);
  afterEach(resetAll);

  it('the flow reaches the hold: beat `reaction`, its animation hold released (the pick is the player\'s)', () => {
    const table: Table = {question: 'Fighter', served: true, done: 0};
    holdForQuestion(table);
    expect(chairmanQuestAwaitsReaction()).is.true;
    expect(chairmanQuestFlow.beat).eq('reaction');
    expect(activeAnimationHoldLabels().some((l) => l.startsWith('parliament-chairman-quest')), 'no ceiling over a decision').is.false;
  });

  it('the question GONE (answered wherever it was served) ends the flow by its own probe — no edge of the stage needed', () => {
    const table: Table = {question: 'Fighter', served: false, done: 0};
    holdForQuestion(table);
    table.question = undefined;
    expect(probeChairmanQuestReaction()).eq('answered');
    expect(chairmanQuestAwaitsReaction()).is.false;
    // Only the closing gap stands — and «дожать» takes it (never a `reaction` beat left with nothing to end it).
    finishChairmanQuestBeats();
    expect(chairmanQuestFlow.beat).eq('done');
    expect(table.done).eq(1);
  });

  it('a question SERVED on the stage is the player\'s: no bound runs, however long they read', () => {
    const table: Table = {question: 'Fighter', served: true, done: 0};
    holdForQuestion(table);
    expect(probeChairmanQuestReaction(0)).eq('waiting');
    expect(probeChairmanQuestReaction(10 * CHAIRMAN_QUEST_REACTION_UNSERVED_MS)).eq('waiting');
    expect(chairmanQuestAwaitsReaction()).is.true;
    expect(hurryChairmanQuestReaction(), 'A belongs to the pick').is.false;
  });

  it('a question standing UNSERVED past its bound SETTLES the flow (`done` — A / B close), counted from its first unserved read', () => {
    const table: Table = {question: 'Fighter', served: false, done: 0};
    holdForQuestion(table);
    expect(probeChairmanQuestReaction(1000)).eq('waiting');
    expect(probeChairmanQuestReaction(1000 + CHAIRMAN_QUEST_REACTION_UNSERVED_MS - 1)).eq('waiting');
    expect(probeChairmanQuestReaction(1000 + CHAIRMAN_QUEST_REACTION_UNSERVED_MS)).eq('settled');
    expect(chairmanQuestFlow.beat).eq('done');
    expect(chairmanQuestRunLive(), 'the run is over').is.false;
  });

  it('a question served AGAIN resets the unserved clock (a stage that took a while to enter is not a deaf screen)', () => {
    const table: Table = {question: 'Fighter', served: false, done: 0};
    holdForQuestion(table);
    probeChairmanQuestReaction(0);
    table.served = true;
    probeChairmanQuestReaction(CHAIRMAN_QUEST_REACTION_UNSERVED_MS - 1);
    table.served = false;
    expect(probeChairmanQuestReaction(CHAIRMAN_QUEST_REACTION_UNSERVED_MS + 1)).eq('waiting');
  });

  it('A «дожать»: an unserved question settles NOW; a gone one ends the flow NOW (no gap)', () => {
    const unserved: Table = {question: 'Fighter', served: false, done: 0};
    holdForQuestion(unserved);
    expect(hurryChairmanQuestReaction()).is.true;
    expect(chairmanQuestFlow.beat).eq('done');
    expect(chairmanQuestRunLive()).is.false;

    killChairmanQuestBeats();
    resetChairmanQuestFlow();
    const gone: Table = {question: 'Fighter', served: true, done: 0};
    holdForQuestion(gone);
    gone.question = undefined;
    expect(hurryChairmanQuestReaction()).is.true;
    expect(chairmanQuestFlow.beat).eq('done');
    expect(gone.done, 'the flow\'s own ending ran').eq(1);
  });

  it('a killed run ends the probe with it (nothing reads a flow that is gone)', () => {
    const table: Table = {question: 'Fighter', served: false, done: 0};
    holdForQuestion(table);
    killChairmanQuestBeats();
    expect(probeChairmanQuestReaction(10 * CHAIRMAN_QUEST_REACTION_UNSERVED_MS)).eq('none');
    expect(hurryChairmanQuestReaction()).is.false;
  });
});
