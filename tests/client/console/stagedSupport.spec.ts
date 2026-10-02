import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {ActionPreviewBranch, StagedVoteModel} from '@/common/models/ActionPreviewModel';
import {PlayerInputModel, SelectPartyModel, SupportPromptMeta} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {parliamentPromptBridge, supportPickResponse, SUPPORT_CUBE_STAGGER_MS} from '@/client/console/parliament/consoleParliamentModel';
import {parliamentCommandsOf} from '@/client/console/parliament/parliamentCommands';
import {
  armSupportPickFlow, parliamentCrumbCommitted, parliamentCrumbStage, parliamentCrumbSubject, parliamentFlow, parliamentSupportUp, resetParliamentFlow,
} from '@/client/console/parliament/consoleParliamentFlow';
import {
  supportAreaOf, supportCursorOrder, supportCursorStep, supportDiscardOrder, supportReadingOf, supportStartParty, supportStepStageOf,
} from '@/client/console/parliament/supportPickModel';
import {
  clearSupportDiscard, landSupportDiscardCube, liftSupportDiscardCube, promiseSupportDiscard, registerSupportDiscardHost, seedSupportDiscardHolds,
  settleSupportDiscard, supportDiscardFlow, supportDiscardPoolHeld, supportDiscardStanding,
} from '@/client/console/parliament/supportDiscard';
import {playCommitVerb, playDoorNextStepKey, playDoorOf} from '@/client/console/consolePlayCardComposer';
import {DELEGATE_GRANT_STEP_STAGE, followUpStepStage, partyStepStageOf} from '@/client/console/consoleTaskRouter';
import {emptyParliamentView} from '@/client/console/parliament/consoleParliamentModel';

/**
 * THE SUPPORT-AREA MODE — the Parliament picks a PARTY'S POPULAR SUPPORT AREA
 * (Turmoil Redux TR12 Party Sanctions, docs/TURMOIL_REDUX_PARTY_SANCTIONS.md).
 *
 * The door is the staged party pick TR03 built — ONE store, ONE bridge, ONE
 * addressed tail — and the MODE is a feature of the prompt's marker
 * (`supportPrompt`), never a second staged target or a second kind of door.
 * Pinned here: the ring the cursor walks, the server's readings, the bridge
 * (staged == live but for `staged`; the vote unchanged), the answer's address,
 * the discard's holds (seeded from the diff, released lift by lift and landing
 * by landing), the bar, the crumb, the composer's door.
 */
const M = PartyName.MARS;
const S = PartyName.SCIENTISTS;
const I = PartyName.INDUSTRIALISTS;
const CARD = CardName.PARTY_SANCTIONS;

/** The six areas as the server words them (`DiscardPopularSupport`): Mars First 3, the Scientists 1, the rest empty. */
const META: SupportPromptMeta = {
  source: 'discard',
  areas: REDUX_PARTIES.map((party) => {
    const current = party === M ? 3 : party === S ? 1 : 0;
    return current > 0 ?
      {party, current, resulting: 0, available: true} :
      {party, current, resulting: 0, available: false, reason: 'The support area is empty'};
  }),
};

function areaPrompt(): SelectPartyModel {
  return {
    type: 'party', title: 'Select a Popular Support Area to discard its neutral delegates', buttonLabel: 'Select', parties: [S, M],
    supportPrompt: META,
    choiceContext: {source: {kind: 'card', card: CARD}, mode: 'effect-choice'},
  } as unknown as SelectPartyModel;
}

const STAGED: StagedVoteModel = {prompt: areaPrompt(), sourceCard: CARD};
const MENU = {type: 'or', title: 'Take your next action', buttonLabel: '', options: []} as unknown as PlayerInputModel;

function viewWith(support: Partial<Record<PartyName, number>>): PlayerViewModel {
  return {game: {parliament: {popularSupport: support}}} as unknown as PlayerViewModel;
}

describe('supportPickModel — the ring, the readings, the order the cubes leave', () => {
  const parties = [...REDUX_PARTIES] as Array<ReduxParty>;

  it('the ring is the overview\'s: the opposition row in order, the ruler LAST', () => {
    expect(supportCursorOrder(parties, I)).deep.eq([PartyName.UNITY, PartyName.GREENS, S, M, PartyName.REDS, I]);
  });

  it('the cursor STARTS on the first area on offer — a cursor, never a selection', () => {
    expect(supportStartParty(META, supportCursorOrder(parties, I))).eq(S);
  });

  it('◀ ▶ walk the ring and clamp at its ends; ▲ climbs to the ruler, ▼ comes back onto the row', () => {
    const order = supportCursorOrder(parties, I);
    expect(supportCursorStep(order, I, S, 'right')).eq(M);
    expect(supportCursorStep(order, I, PartyName.UNITY, 'left'), 'a wall, never a wrap').eq(PartyName.UNITY);
    expect(supportCursorStep(order, I, I, 'right'), 'the ruler ends the ring').eq(I);
    expect(supportCursorStep(order, I, S, 'up')).eq(I);
    expect(supportCursorStep(order, I, I, 'down')).eq(PartyName.REDS);
    expect(supportCursorStep(order, I, S, 'down'), '▼ on the row moves nothing').eq(S);
  });

  it('a candidate reads «N → 0» and the cubes that would leave; a refused area its ONE reason, nothing leaving', () => {
    expect(supportReadingOf(META, M)).deep.eq({party: M, current: 3, resulting: 0, available: true, leaving: 3});
    expect(supportReadingOf(META, PartyName.REDS)).deep.eq({
      party: PartyName.REDS, current: 0, resulting: 0, available: false, reason: 'The support area is empty', leaving: 0,
    });
    expect(supportAreaOf(META, undefined)).eq(undefined);
  });

  it('the cubes leave from the RIGHT — the last one laid down goes first — at the support scene\'s rhythm', () => {
    expect(supportDiscardOrder(3)).deep.eq([3, 2, 1]);
    expect(supportDiscardOrder(0)).deep.eq([]);
    expect(SUPPORT_CUBE_STAGGER_MS, 'law 12: a cube every ≥ 90 ms').gte(90);
  });

  it('the stage is named by what the pick does — «САНКЦИИ» for a discard', () => {
    expect(supportStepStageOf(META)).eq('Sanctions');
  });
});

describe('consoleParliamentModel — the support-area pick: ONE bridge, the vote untouched', () => {
  it('the STAGED area pick is the LIVE one but for `staged`; it never reads as a delegate grant', () => {
    const staged = parliamentPromptBridge(MENU, STAGED);
    const live = parliamentPromptBridge(areaPrompt(), undefined);
    expect(staged.grant, 'an area pick is not a grant').eq(undefined);
    expect(live.grant).eq(undefined);
    expect(staged.supportPick?.staged).eq(true);
    expect(live.supportPick?.staged).eq(undefined);
    expect({...staged.supportPick, staged: undefined}).deep.eq({...live.supportPick, staged: undefined});
    expect(staged.supportPick?.card).eq(CARD);
    expect(staged.supportPick?.meta).deep.eq(META);
  });

  it('the LIVE prompt always wins over a staged one', () => {
    const bridge = parliamentPromptBridge(areaPrompt(), STAGED);
    expect(bridge.supportPick?.staged).eq(undefined);
  });

  it('the STAGED answer is ADDRESSED to the card; the live answer is the plain party response; an area not on offer has none', () => {
    expect(supportPickResponse(parliamentPromptBridge(MENU, STAGED), M)).deep.eq({type: 'party', partyName: M, stagedFor: CARD});
    expect(supportPickResponse(parliamentPromptBridge(areaPrompt(), undefined), M)).deep.eq({type: 'party', partyName: M});
    expect(supportPickResponse(parliamentPromptBridge(MENU, STAGED), PartyName.REDS), 'an empty area is refused').eq(undefined);
  });
});

describe('supportDiscard — the holds are seeded from the DIFF and released touch by touch', () => {
  afterEach(() => {
    clearSupportDiscard();
    registerSupportDiscardHost(undefined);
  });

  it('LANDED with the mode standing: the plaque keeps drawing the cubes, the pool keeps its old count', () => {
    registerSupportDiscardHost(() => true);
    promiseSupportDiscard({party: M, card: CARD});
    seedSupportDiscardHolds(viewWith({[M]: 3}), viewWith({[M]: 0}));
    expect(supportDiscardFlow.promised, 'the promise is kept').eq(undefined);
    expect(supportDiscardStanding(M)).eq(3);
    expect(supportDiscardStanding(S), 'another plaque draws its own').eq(0);
    expect(supportDiscardPoolHeld()).eq(3);
    // The first cube LIFTS (the place goes dark), then LANDS (the pool counts it).
    liftSupportDiscardCube();
    expect([supportDiscardStanding(M), supportDiscardPoolHeld()]).deep.eq([2, 3]);
    landSupportDiscardCube();
    expect([supportDiscardStanding(M), supportDiscardPoolHeld()]).deep.eq([2, 2]);
    settleSupportDiscard();
    expect([supportDiscardStanding(M), supportDiscardPoolHeld()]).deep.eq([0, 0]);
  });

  it('nobody to play it: the area and the pool read the server at once (a hold nobody releases would freeze them)', () => {
    registerSupportDiscardHost(() => false);
    promiseSupportDiscard({party: M});
    seedSupportDiscardHolds(viewWith({[M]: 3}), viewWith({[M]: 0}));
    expect(supportDiscardFlow.promised).eq(undefined);
    expect(supportDiscardFlow.owed).eq(undefined);
    expect(supportDiscardPoolHeld()).eq(0);
  });

  it('PARKED (the area did not move): nothing is held and the promise STAYS for the answer that lands it', () => {
    registerSupportDiscardHost(() => true);
    promiseSupportDiscard({party: M});
    seedSupportDiscardHolds(viewWith({[M]: 3}), viewWith({[M]: 3}));
    expect(supportDiscardFlow.promised?.party).eq(M);
    expect(supportDiscardFlow.owed).eq(undefined);
  });

  it('no promise: an area that shrank for any other reason is never this mode\'s to play', () => {
    registerSupportDiscardHost(() => true);
    seedSupportDiscardHolds(viewWith({[M]: 3}), viewWith({[M]: 0}));
    expect(supportDiscardFlow.owed).eq(undefined);
  });
});

describe('the support-area mode in the flow record, the crumb and the bar', () => {
  afterEach(() => resetParliamentFlow());

  const input = (support: {staged: boolean, available: boolean, source?: boolean}) => ({
    view: emptyParliamentView(), canVoteNow: false, partyActionStates: [],
    support: {staged: support.staged, stagedFlow: 'play' as const, source: support.source ?? true, available: support.available},
  });

  it('armed: the stage is `support`, the crumb names it, cyan until A', () => {
    armSupportPickFlow({zone: 'parties', partyIndex: 2}, 'Sanctions', false, META);
    expect(parliamentFlow.stage).eq('support');
    expect(parliamentSupportUp()).eq(true);
    expect(parliamentCrumbSubject()).eq('Sanctions');
    expect(parliamentCrumbStage('')).eq('');
    expect(parliamentCrumbCommitted(), 'cyan before A').eq(false);
    parliamentFlow.supportCommitted = true;
    expect(parliamentCrumbCommitted(), 'amber past it').eq(true);
  });

  it('a LIVE door is past the commit of the flow that raised it: amber from the start', () => {
    armSupportPickFlow({zone: 'ruler', partyIndex: 0}, 'Sanctions', true, META);
    expect(parliamentCrumbCommitted()).eq(true);
  });

  it('STAGED: A «Разыграть карту» · X «Осмотреть» · L3 «Источник» · B «Назад»; a refused area dims A', () => {
    armSupportPickFlow({zone: 'parties', partyIndex: 3}, 'Sanctions', false, META);
    expect(parliamentCommandsOf(input({staged: true, available: true})).map((c) => [c.control, c.label, c.enabled !== false])).deep.eq([
      ['confirm', 'Play card', true], ['secondary', 'Inspect', true], ['stickL', 'Source', true], ['back', 'Back', true],
    ]);
    expect(parliamentCommandsOf(input({staged: true, available: false}))[0].enabled).eq(false);
  });

  it('LIVE: A «Выбрать» · B «Свернуть»; past A the bar is a STATUS — never «На поле» over an absorbed beat', () => {
    armSupportPickFlow({zone: 'parties', partyIndex: 3}, 'Sanctions', true, META);
    const live = parliamentCommandsOf(input({staged: false, available: true}));
    expect(live[0].label).eq('Select');
    expect(live[live.length - 1]).deep.eq({control: 'back', label: 'Minimize'});
    parliamentFlow.supportCommitted = true;
    expect(parliamentCommandsOf(input({staged: false, available: true}))).deep.eq([{control: 'confirm', label: 'Performing…', enabled: false}]);
  });
});

describe('the composer\'s door and the step\'s name — one classification, the mode a feature of it', () => {
  const branch = (steps: ActionPreviewBranch['steps']): ActionPreviewBranch => ({effects: [], steps} as unknown as ActionPreviewBranch);

  it('a `supportDiscard` step is the PARLIAMENT door in its support mode: «Выбрать партию», its own step row', () => {
    const door = playDoorOf(branch([{kind: 'supportDiscard', staged: STAGED}]));
    expect(door).deep.eq({kind: 'parliament', staged: STAGED, mode: 'support'});
    expect(playCommitVerb(door)).eq('Choose the party');
    expect(playDoorNextStepKey(door)).eq('Popular support area — chosen in the Parliament');
  });

  it('…and a `delegateGrant` stays the vote, word for word (TR03 / TR15 unchanged)', () => {
    const grant: StagedVoteModel = {prompt: {type: 'party', parties: [M]} as unknown as SelectPartyModel, sourceCard: CardName.POLITICAL_DONATION};
    const door = playDoorOf(branch([{kind: 'delegateGrant', staged: grant}]));
    expect(door).deep.eq({kind: 'parliament', staged: grant, mode: 'vote'});
    expect(playCommitVerb(door)).eq('Choose the resolution');
    expect(playDoorNextStepKey(door)).eq('Resolution — chosen in the Parliament');
  });

  it('the hosted step\'s crumb tail: «САНКЦИИ» for an area pick, «ГОЛОСОВАНИЕ» for a grant — by the marker', () => {
    expect(partyStepStageOf(areaPrompt())).eq('Sanctions');
    expect(partyStepStageOf({type: 'party', votePrompt: {source: 'grant', cost: 0}} as unknown as PlayerInputModel)).eq(DELEGATE_GRANT_STEP_STAGE);
    expect(followUpStepStage('party', areaPrompt())).eq('Sanctions');
    expect(followUpStepStage('party', {type: 'party', votePrompt: {source: 'chairman-seat', cost: 0}} as unknown as PlayerInputModel),
      'the chairman\'s seat is nobody\'s step').eq(undefined);
  });
});
