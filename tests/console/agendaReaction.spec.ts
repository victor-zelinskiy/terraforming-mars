import {expect} from 'chai';
import {Color} from '../../src/common/Color';
import {AGENDA_REACTION_PENDING_KEY, ParliamentModel, ParliamentPhaseModel} from '../../src/common/models/ParliamentModel';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';
import {CardName} from '../../src/common/cards/CardName';
import {
  agendaReactionHost, agendaReactionOf, agendaReactionResourceKey, agendaReactionStageKey, careerAgendaTold, careerPausedAt, careerResumeOwed,
  noteCareerAgendaTold, noteCareerResumed, questReactionOf, resetCareerPause, sittingReactionOf,
} from '../../src/client/console/parliament/agendaReaction';
import {sittingAskOf, sittingFieldOf, sittingPositionOf} from '../../src/client/console/parliament/consoleSittingFlow';
import {followUpStepStage} from '../../src/client/console/consoleTaskRouter';
import {sittingAskResolution} from '../../src/client/console/promptSource';
import {isResolutionAsk} from '../../src/client/console/consoleMandatoryGate';

/*
 * «ИСТРЕБИТЕЛЬ» — TR78 Arwind Inc.'s answer to a walk of the Career, the PURE half (`console/parliament/agendaReaction.ts`
 * and its readers): which prompt it is (the family's pick or its LAYOUT), which host it belongs to, its stage word, the
 * sitting's pause at the Career and its resume. The server's marker `agendaWalkPrompt` decides — never a title.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

function fighterPick(reason: 'quest' | 'phase' | 'card' | 'resolution', extra: Record<string, unknown> = {}): PlayerInputModel {
  return {
    type: 'card', title: 'Select a card', buttonLabel: 'Add resource', cards: [],
    choiceContext: {source: {kind: 'corporation', card: CardName.ARWIND_INC}, mode: 'reward'},
    resourceGainPrompt: {amount: 1, cardResource: 'fighter'},
    agendaWalkPrompt: {source: CardName.ARWIND_INC, reason, from: 1, to: 2, ...extra},
  } as unknown as PlayerInputModel;
}

/** The LAYOUT of a walk of several steps over several holders — the family's distribution, marked with the walk. */
function fighterLayout(reason: 'quest' | 'phase' | 'card' | 'resolution'): PlayerInputModel {
  return {
    type: 'and', title: 'Distribute 2 fighters', buttonLabel: 'OK', options: [],
    choiceContext: {source: {kind: 'corporation', card: CardName.ARWIND_INC}, mode: 'reward'},
    cardResourceDistributionPrompt: {amount: 2, cardResource: 'fighter', cards: []},
    agendaWalkPrompt: {source: CardName.ARWIND_INC, reason, from: 1, to: 3},
  } as unknown as PlayerInputModel;
}

function phase(over: Partial<ParliamentPhaseModel>): ParliamentPhaseModel {
  return {generation: 3, final: false, step: 'support', ...over};
}

function model(p: ParliamentPhaseModel | undefined): ParliamentModel {
  return {
    slots: [], rulingParty: 'greens', popularSupport: {}, deckSize: 0, discardSize: 0, neutralSupply: 0, botMode: 'none',
    players: [BLUE, RED].map((color) => ({
      color, participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 1,
      access: [], partyActionUses: {}, resolutionActionUses: 0,
    })),
    phase: p,
  } as unknown as ParliamentModel;
}

describe('agendaReaction — a table\'s answer to a walk of the Career (TR78 Arwind Inc.)', () => {
  afterEach(() => resetCareerPause());

  it('the marker decides the host: a card\'s walk is the hand\'s, every walk the Parliament runs is the Parliament\'s', () => {
    expect(agendaReactionHost(agendaReactionOf(fighterPick('card'))!)).eq('hand');
    for (const reason of ['quest', 'phase', 'resolution'] as const) {
      expect(agendaReactionHost(agendaReactionOf(fighterPick(reason))!), reason).eq('parliament');
    }
    expect(questReactionOf(fighterPick('quest'))).not.eq(undefined);
    expect(questReactionOf(fighterPick('phase'))).eq(undefined);
    expect(sittingReactionOf(fighterPick('phase'))).not.eq(undefined);
    expect(agendaReactionOf(fighterLayout('phase')), 'the LAYOUT carries the marker too').deep.include({reason: 'phase', from: 1, to: 3});
    expect(agendaReactionOf({type: 'card', title: 'x', buttonLabel: 'y'} as unknown as PlayerInputModel), 'an ordinary pick').eq(undefined);
  });

  it('the stage names WHAT is put down — «Fighter», off the pick and off the layout alike; never the law\'s generic «Choice» / «Distribution»', () => {
    expect(agendaReactionStageKey(fighterPick('quest'))).eq('Fighter');
    expect(agendaReactionStageKey(fighterLayout('quest')), 'the layout reads its own marker').eq('Fighter');
    expect(agendaReactionResourceKey('fighter'), 'a receipt names the record\'s own kind').eq('Fighter');
    expect(followUpStepStage('cardSelect', fighterPick('quest'))).eq('Fighter');
    expect(followUpStepStage('cardSelect', fighterLayout('phase'))).eq('Fighter');
    expect(followUpStepStage('cardSelect', fighterPick('resolution', {resolution: 'RDX_REDS_BUDGET'})), 'even under a law').eq('Fighter');
  });

  it('a law\'s walk of the Career makes the corporation\'s question a question of the LAW\'s sitting (announced as one)', () => {
    const pick = fighterPick('resolution', {resolution: 'RDX_REDS_BUDGET'});
    expect(sittingAskResolution(pick)).eq('RDX_REDS_BUDGET');
    expect(isResolutionAsk(pick)).eq(true);
    expect(sittingAskResolution(fighterPick('phase')), 'the winner\'s step is the sitting\'s, not a law\'s').eq(undefined);
    expect(sittingAskOf(pick)).eq('choice');
  });

  it('THE SITTING PAUSED AT THE CAREER: the asked seat holds its step (a pick, or a layout), every other seat reads who answers what', () => {
    const p = phase({pending: {player: BLUE, key: AGENDA_REACTION_PENDING_KEY, input: 'card'}});
    expect(careerPausedAt(p)).eq(true);
    expect(careerPausedAt(phase({}))).eq(false);
    expect(sittingAskOf(fighterPick('phase'))).eq('choice');
    expect(sittingAskOf(fighterLayout('phase')), 'several fighters over several holders: the layout').eq('distribution');
    const blue = sittingPositionOf(model(p), fighterPick('phase'), BLUE)!;
    expect(blue.career).eq(true);
    expect(blue.rewardStep).eq('choice');
    expect(blue.waitingFor).eq(undefined);
    const red = sittingPositionOf(model(p), undefined, RED)!;
    expect(red.career).eq(true);
    expect(red.waitingFor).deep.eq({player: BLUE, input: 'card'});
  });

  it('the enactment page opens its field for the ANSWER STAGE (a receipt, or the question once its ПОВЕСТКА has played)', () => {
    expect(sittingFieldOf('enact', 'choice', false, false, false, false, true)).deep.eq({pose: true, stepOpen: true});
    expect(sittingFieldOf('enact', 'choice', true, false, false, false, true), 'a wave in the air keeps the door shut').deep.eq({pose: true, stepOpen: false});
    expect(sittingFieldOf('enact', 'choice', false, false), 'without the answer stage the enactment page never holds a field').deep.eq({pose: false, stepOpen: false});
    expect(sittingFieldOf('reward', 'received', false, false, false, false, true), 'the reward page holds the field for a receipt too').deep.eq({pose: true, stepOpen: false});
  });

  it('the resume: the page owes its ПОДДЕРЖКА / ПРИНЯТИЕ once the server is past the pause — once', () => {
    const key = '3:7';
    const paused = phase({pending: {player: BLUE, key: AGENDA_REACTION_PENDING_KEY}});
    expect(careerResumeOwed(key, paused), 'nothing told yet').eq(false);
    noteCareerAgendaTold(key);
    expect(careerAgendaTold(key)).eq(true);
    expect(careerResumeOwed(key, paused), 'still paused on the server').eq(false);
    expect(careerResumeOwed(key, phase({step: 'done'})), 'the answer let the chain through').eq(true);
    noteCareerResumed(key);
    expect(careerResumeOwed(key, phase({step: 'done'})), 'played once').eq(false);
  });
});
