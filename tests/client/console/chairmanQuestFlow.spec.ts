import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../components/getLocalVue';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import ConsoleParliamentAgenda from '@/client/components/console/parliament/ConsoleParliamentAgenda.vue';
import {agendaViewOf, buildParliamentView} from '@/client/console/parliament/consoleParliamentModel';
import {
  armChairmanQuestFlow, chairmanQuestFlow, chairmanQuestGateOf, chairmanQuestStageKey, detectChairmanChange,
  detectChairmanQuestAdvance, releaseChairmanQuestHolds, resetChairmanQuestFlow, seedChairmanQuestHolds,
} from '@/client/console/parliament/consoleChairmanQuest';
import {parliamentBandLine} from '@/client/console/parliament/parliamentBand';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {
  parliamentParksReveal, parliamentRewardState, resetParliamentRewards,
} from '@/client/console/parliament/parliamentRewardBeat';
import {parliamentCrumbStage, parliamentCrumbSubject, parliamentFlow, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';

/*
 * «ПРЕДСЕДАТЕЛЬСТВО» — the flow's PURE half (probes 6 and 7 of
 * docs/claude/prompts/parliament-chairman-quest.md §6, plus the crumb and the
 * band's reading). The marker may not stand on its new step for a single frame
 * before the beat that moves it, and the step's bonus may not tick before the
 * marker lands on it.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const A = 'RDX_GREENS_AQUIFER_CONTEST#0';

function model(over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {
    slots: [{instance: A, resolution: 'RDX_GREENS_AQUIFER_CONTEST', party: PartyName.GREENS, votes: [], totalVotes: 0, isWinning: true, tiePriority: 1, viewerVotes: 0}],
    rulingParty: PartyName.GREENS, popularSupport: {}, deckSize: 10, discardSize: 0, neutralSupply: 14, botMode: 'none',
    players: [BLUE, RED].map((color) => ({
      color, participates: true, lobby: true, reserve: color === BLUE ? 5 : 6, onResolutions: 0,
      chairman: false, agenda: color === BLUE ? 1 : 0, influence: 1, access: [], partyActionUses: {}, resolutionActionUses: 0,
    })),
    ...over,
  } as unknown as ParliamentModel;
}

function view(parliament: ParliamentModel, generation = 3): PlayerViewModel {
  return {
    thisPlayer: {color: BLUE},
    players: [{color: BLUE, name: 'Blue'}, {color: RED, name: 'Red'}],
    game: {generation, parliament},
  } as unknown as PlayerViewModel;
}

/** The two views around the gate's answer: the office moves RED → BLUE and the marker 1 → 2 (a TR step). */
function answerPair(bonus?: 'tr' | 'card') {
  const before = view(model({chairman: RED, lastAdvance: {seq: 4, player: RED, from: 0, to: 1, reason: 'quest', generation: 2}} as never));
  const after = view(model({
    chairman: BLUE,
    lastAdvance: {seq: 5, player: BLUE, from: 1, to: 2, bonus, reason: 'quest', generation: 3},
  } as never));
  return {before, after};
}

describe('«ПРЕДСЕДАТЕЛЬСТВО» — the chairman-quest flow', () => {
  beforeEach(() => {
    resetChairmanQuestFlow();
    resetParliamentHolds();
    resetParliamentRewards();
    resetParliamentFlow();
  });
  after(() => {
    resetChairmanQuestFlow();
    resetParliamentHolds();
    resetParliamentRewards();
    resetParliamentFlow();
  });

  it('the gate is found by the SERVER\'s marker, never by a title', () => {
    expect(chairmanQuestGateOf(undefined)).is.undefined;
    expect(chairmanQuestGateOf({type: 'option', title: 'You completed the chairman quest'} as never), 'the title alone is not the gate').is.undefined;
    expect(chairmanQuestGateOf({type: 'option', title: 'anything at all', chairmanQuestPrompt: {generation: 3}} as never)).deep.eq({generation: 3});
  });

  it('ARM reads the office and the delegate\'s place as they stand BEFORE the answer', () => {
    armChairmanQuestFlow(model({chairman: RED}), BLUE);
    expect(chairmanQuestFlow.live).is.true;
    expect(chairmanQuestFlow.seatWas, 'the office is still the previous holder\'s').eq(RED);
    expect(chairmanQuestFlow.seatSource, 'the reserve first — the rulebook\'s own order').eq('reserve');
    // Every delegate out: the free one in the lobby is the source instead.
    armChairmanQuestFlow(model({chairman: RED, players: [{color: BLUE, participates: true, lobby: true, reserve: 0, onResolutions: 7, chairman: false, agenda: 1, influence: 1, access: [], partyActionUses: {}, resolutionActionUses: 0}]} as never), BLUE);
    expect(chairmanQuestFlow.seatSource).eq('lobby');
  });

  it('DETECT: only a `quest` advance whose serial GREW, and only a real change of office', () => {
    const {before, after} = answerPair('tr');
    expect(detectChairmanQuestAdvance(before, after)).deep.eq({move: {player: BLUE, from: 1, to: 2}, bonus: 'tr'});
    expect(detectChairmanQuestAdvance(after, after), 'the same record twice (an echo frame)').is.undefined;
    expect(detectChairmanQuestAdvance(undefined, after), 'a first view — a reload has nothing to move from').is.undefined;
    const phase = view(model({lastAdvance: {seq: 9, player: BLUE, from: 1, to: 2, reason: 'phase', generation: 3}} as never));
    expect(detectChairmanQuestAdvance(before, phase), 'the political phase plays its own step').is.undefined;
    expect(detectChairmanChange(before, after)).deep.eq({from: RED, to: BLUE});
    expect(detectChairmanChange(after, after), 'the sitting chairman kept the office').is.undefined;
  });

  it('PROBE 6 — the marker never stands on its new step before its beat: the seed holds it on the old one', () => {
    const {before, after} = answerPair('tr');
    // Outside the flow nothing is held (the marker's own watcher plays what it can).
    seedChairmanQuestHolds(before, after);
    expect(parliamentHolds.agendaAwaits, 'a hold nobody would consume would freeze the track for good').is.undefined;

    armChairmanQuestFlow(before.game.parliament, BLUE);
    seedChairmanQuestHolds(before, after);
    expect(parliamentHolds.agendaAwaits).deep.eq({player: BLUE, from: 1, to: 2});
    expect(parliamentHolds.chairAwaits).deep.eq({from: RED, to: BLUE});
    expect(parliamentHolds.returns.get(RED), 'the outgoing delegate is on its way HOME — the reserve keeps its old count').eq(1);

    // …and the tier READS the hold: the marker is drawn on step 1, not on 2.
    const vm = buildParliamentView(after.game.parliament!, BLUE, after.players as never);
    const wrapper = mount(ConsoleParliamentAgenda, {
      ...globalConfig,
      props: {view: vm, model: after.game.parliament, agendaVm: agendaViewOf(vm), viewerParticipates: true},
    });
    const shown = (wrapper.vm as unknown as {shown: {viewerPosition: number, steps: ReadonlyArray<{index: number, cubes: ReadonlyArray<Color>}>}}).shown;
    expect(shown.viewerPosition, 'the marker stands where it stood').eq(1);
    expect(shown.steps.find((s) => s.index === 1)?.cubes, 'the cube is still drawn on the old step').to.include(BLUE);
    expect(shown.steps.find((s) => s.index === 2)?.cubes, 'and NOT on the new one').to.not.include(BLUE);
    wrapper.unmount();
  });

  it('PROBE 7a — a TR step is held on the rail at the step the marker reached', () => {
    const {before, after} = answerPair('tr');
    armChairmanQuestFlow(before.game.parliament, BLUE);
    seedChairmanQuestHolds(before, after);
    expect(parliamentRewardState.agendaBonus, 'the rating is owed at the step the marker reached')
      .includes({generation: 3, player: BLUE, step: 2, kind: 'tr'});
  });

  it('PROBE 7b — a CARD step PARKS its own reveal until the cover can lift off the step', () => {
    const {before, after} = answerPair('card');
    armChairmanQuestFlow(before.game.parliament, BLUE);
    seedChairmanQuestHolds(before, after);
    expect(parliamentRewardState.agendaBonus?.kind).eq('card');
    expect(parliamentParksReveal({type: 'agenda'}), 'the drawn card presents NOWHERE until the cover can lift off the step').is.true;
    expect(parliamentParksReveal({type: 'card'}), '…and only that batch is parked').is.false;
  });

  it('PROBE 7c — an INFLUENCE step pays nothing of its own: nothing is owed, and the marker still glides', () => {
    const {before, after} = answerPair();
    armChairmanQuestFlow(before.game.parliament, BLUE);
    seedChairmanQuestHolds(before, after);
    expect(parliamentRewardState.agendaBonus).is.undefined;
    expect(parliamentHolds.agendaAwaits, 'the step itself IS the reward').is.not.undefined;
  });

  it('releasing the flow lets every hold go at once (the section unmounts, the beats have nowhere to play)', () => {
    const {before, after} = answerPair('tr');
    armChairmanQuestFlow(before.game.parliament, BLUE);
    seedChairmanQuestHolds(before, after);
    releaseChairmanQuestHolds('unmount');
    expect(parliamentHolds.agendaAwaits).is.undefined;
    expect(parliamentHolds.chairAwaits).is.undefined;
    expect(parliamentHolds.returns.size).eq(0);
    expect(parliamentRewardState.agendaBonus).is.undefined;
  });

  it('THE CRUMB is continuous: «ПАРЛАМЕНТ › ПРЕДСЕДАТЕЛЬСТВО › <СТАДИЯ>», and only the tail advances', () => {
    parliamentFlow.stage = 'quest';
    expect(parliamentCrumbSubject(true)).eq('Chairmanship');
    expect(parliamentCrumbStage('', chairmanQuestStageKey('task'))).eq('Quest');
    expect(parliamentCrumbStage('', chairmanQuestStageKey('agenda'))).eq('Agenda');
    // The delegate pick is a STAGE of the flow, not a screen of its own.
    parliamentFlow.stage = 'seat';
    expect(parliamentCrumbSubject(true), 'the subject never restarts').eq('Chairmanship');
    expect(parliamentCrumbSubject(false), 'stand-alone (a reload into the pending pick) it is the overview\'s').eq('Parliament overview');
    expect(parliamentCrumbStage('', '')).eq('Seat');
    // A submit inside the flow keeps the stage it left — the tail never blinks back.
    parliamentFlow.stage = 'submitting';
    parliamentFlow.stageBeforeSubmit = 'quest';
    expect(parliamentCrumbSubject(true)).eq('Chairmanship');
    expect(parliamentCrumbStage('', chairmanQuestStageKey('task'))).eq('Quest');
  });

  it('THE BAND reads one line per beat — never what an object on screen says itself', () => {
    const standing = {votes: 0};
    const task = parliamentBandLine({standing, quest: {beat: 'task', player: BLUE}});
    expect(task.kicker).eq('Quest');
    expect(task.committed, 'the quest is closed and the answer is already on its way').is.true;
    expect(task.chips.map((c) => c.kind)).deep.eq(['label', 'player', 'label']);
    expect(task.chips.filter((c) => c.kind === 'label').map((c) => (c as {key: string}).key))
      .deep.eq(['Completed', 'Chairmanship']);

    const seat = parliamentBandLine({standing, quest: {beat: 'seat', player: BLUE, seatWas: RED}});
    expect(seat.kicker).eq('Chairmanship');
    expect(seat.chips.some((c) => c.kind === 'label' && (c as {key: string}).key === 'The delegate returns to the reserve'),
      'the outgoing delegate\'s own fact — where it GOES, not what was lost').is.true;
    const kept = parliamentBandLine({standing, quest: {beat: 'seat', player: BLUE, seatWas: BLUE}});
    expect(kept.chips.some((c) => c.kind === 'label'), 'a sitting chairman loses nothing, and nothing is claimed').is.false;

    const agenda = parliamentBandLine({standing, quest: {beat: 'agenda', player: BLUE, move: {from: 1, to: 2, bonus: 'tr'}}});
    expect(agenda.kicker).eq('Agenda');
    expect(agenda.chips.find((c) => c.kind === 'agenda')).deep.eq({kind: 'agenda', to: 2, bonus: 'tr'});
    expect(agenda.key, 'the crossfade fires exactly when the reading changes').not.eq(seat.key);

    const end = parliamentBandLine({standing, quest: {beat: 'agenda', player: BLUE}});
    expect(end.chips, 'at the end of the track there is no step to show, and none is invented')
      .deep.eq([{kind: 'label', key: 'end of the track', tone: 'quiet'}]);
  });
});
