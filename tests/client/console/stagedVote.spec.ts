import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {TileType} from '@/common/TileType';
import {PartyName} from '@/common/turmoil/PartyName';
import {StagedVoteModel} from '@/common/models/ActionPreviewModel';
import {PlayerInputModel, SelectPartyModel, VoteSupportProjection} from '@/common/models/PlayerInputModel';
import {
  armStagedPlay, clearStagedPlay, markStagedPlayCommitting, abortStagedPlayCommit, stagedPlacementOf, stagedPlayActive, stagedPlayState, stagedVoteOf,
  StagedPlayArm,
} from '@/client/console/stagedPlay';
import {
  emptyParliamentView, grantResponse, grantSupportOf, parliamentPromptBridge, SUPPORT_CUBE_STAGGER_MS, voteVerbOf,
} from '@/client/console/parliament/consoleParliamentModel';
import {parliamentCommandsOf} from '@/client/console/parliament/parliamentCommands';
import {parliamentFlow, parliamentSupportInFlight, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';

/**
 * THE STAGED VOTE — the vote's third door (Turmoil Redux TR03 Political
 * Donation: a card that places a delegate by being PLAYED).
 *
 * «Выбрать резолюцию» sends nothing: the play batch parks in the ONE staged
 * store, whose target is a RESOLUTION instead of a cell, and the Parliament's
 * vote mode serves the play preview's staged prompt through the very bridge a
 * live grant uses — so the mode has one code path and the two doors differ in
 * exactly what this spec pins: the answer's address, A's verb, B's verb.
 */
const SUPPORT: ReadonlyArray<VoteSupportProjection> = [
  {party: PartyName.GREENS, current: 0, gained: 3, resulting: 3, printed: 3},
  {party: PartyName.MARS, current: 2, gained: 1, resulting: 3, printed: 3, limit: 'area'},
];

/** The grant prompt as the server words it — `PlaceDelegatesOnResolution.previewSelectParty()` and the live prompt are this, field for field. */
function grantPrompt(): SelectPartyModel {
  return {
    type: 'party', title: 'Add 1 delegate to a resolution', buttonLabel: 'Add', parties: [PartyName.GREENS, PartyName.MARS],
    votePrompt: {source: 'grant', cost: 0, count: 1, printed: 1, support: SUPPORT},
    choiceContext: {source: {kind: 'card', card: CardName.POLITICAL_DONATION}, mode: 'reward'},
  } as unknown as SelectPartyModel;
}

const STAGED: StagedVoteModel = {prompt: grantPrompt(), sourceCard: CardName.POLITICAL_DONATION};
/** The action menu the viewer stands on while nothing is sent (its own vote branch beside it). */
const MENU = {
  type: 'or', title: 'Take your next action', buttonLabel: '', options: [
    {type: 'party', title: 'Vote', buttonLabel: '', parties: [PartyName.GREENS, PartyName.MARS], votePrompt: {source: 'lobby', cost: 0}},
  ],
} as unknown as PlayerInputModel;

function arm(target: StagedPlayArm['target']): StagedPlayArm {
  return {flow: 'play', cardName: CardName.POLITICAL_DONATION, isEvent: false, batch: [{type: 'projectCard'}], target, draws: 0, deckCheck: false, yieldedStack: false, receipt: {amount: 4, icon: 'megacredits'}};
}

describe('stagedPlay — the third target: a RESOLUTION', () => {
  afterEach(() => {
    // Module state is bundle-shared: leave nothing armed for later specs.
    clearStagedPlay();
    resetParliamentFlow();
  });

  it('ONE store, exactly one target: a staged vote is not a staged cell, and the other way round', () => {
    armStagedPlay(arm({kind: 'resolution', vote: STAGED}));
    expect(stagedPlayActive()).to.eq(true);
    expect(stagedVoteOf(), 'the store is reactive: the same model, by value').to.deep.eq(STAGED);
    expect(stagedPlacementOf(), 'no cell is being picked').to.eq(undefined);
    clearStagedPlay();
    const placement = {title: '', spaces: [], sourceCard: CardName.NUCLEAR_ZONE, tileType: TileType.NUCLEAR_ZONE};
    armStagedPlay(arm({kind: 'cell', placement}));
    expect(stagedPlacementOf()).to.deep.eq(placement);
    expect(stagedVoteOf()).to.eq(undefined);
    clearStagedPlay();
    expect(stagedPlayActive()).to.eq(false);
    expect(stagedVoteOf()).to.eq(undefined);
  });

  it('the ONE abort battery serves it: a refused commit is «not yet sent» again, the arm intact', () => {
    armStagedPlay(arm({kind: 'resolution', vote: STAGED}));
    markStagedPlayCommitting();
    expect(stagedPlayState.committing).to.eq(true);
    abortStagedPlayCommit();
    expect(stagedPlayState.committing).to.eq(false);
    expect(stagedVoteOf(), 'still staged — B still walks back, A still commits').to.deep.eq(STAGED);
  });
});

describe('consoleParliamentModel — the STAGED grant is the LIVE grant (one bridge, two sources)', () => {
  afterEach(() => resetParliamentFlow());

  it('the bridge built from the staged model equals the bridge built from the live prompt — but for `staged`', () => {
    const live = parliamentPromptBridge(grantPrompt() as unknown as PlayerInputModel).grant;
    const staged = parliamentPromptBridge(MENU, STAGED).grant;
    expect(live).to.not.eq(undefined);
    expect(staged).to.deep.eq({...live, staged: true});
    expect(live).to.deep.include({count: 1, printed: 1, card: CardName.POLITICAL_DONATION, support: SUPPORT});
    expect(live?.staged, 'a live door is never staged').to.eq(undefined);
  });

  it('the staged door leaves the viewer\'s own vote branch readable, and the LIVE prompt always wins', () => {
    const staged = parliamentPromptBridge(MENU, STAGED);
    expect(staged.vote?.menuIndex, 'the action menu\'s vote is still the menu\'s').to.eq(0);
    // A live grant of the same card (the server re-asked) is answered live: never staged.
    expect(parliamentPromptBridge(grantPrompt() as unknown as PlayerInputModel, STAGED).grant?.staged).to.eq(undefined);
    // A chairman's seat standing: no grant at all — the staged answer is not the seat's.
    const seat = {type: 'party', title: '', buttonLabel: '', parties: [PartyName.GREENS], votePrompt: {source: 'chairman-seat', cost: 0}} as unknown as PlayerInputModel;
    const seated = parliamentPromptBridge(seat, STAGED);
    expect(seated.seat).to.not.eq(undefined);
    expect(seated.grant).to.eq(undefined);
  });

  it('the STAGED answer is ADDRESSED to the card; the live answer is the plain party response', () => {
    expect(grantResponse(parliamentPromptBridge(MENU, STAGED), PartyName.MARS))
      .to.deep.eq({type: 'party', partyName: PartyName.MARS, stagedFor: CardName.POLITICAL_DONATION});
    expect(grantResponse(parliamentPromptBridge(grantPrompt() as unknown as PlayerInputModel), PartyName.MARS))
      .to.deep.eq({type: 'party', partyName: PartyName.MARS});
    expect(grantResponse(parliamentPromptBridge(MENU, STAGED), PartyName.UNITY), 'a party the prompt does not offer').to.eq(undefined);
  });

  it('the support of the chosen party is the SERVER\'s row — read, never computed', () => {
    const grant = parliamentPromptBridge(MENU, STAGED).grant;
    expect(grantSupportOf(grant, PartyName.MARS)).to.eq(SUPPORT[1]);
    expect(grantSupportOf(grant, PartyName.UNITY)).to.eq(undefined);
    // A colony's grant pays no support: no row for anybody.
    const colony = {...grantPrompt(), votePrompt: {source: 'grant', cost: 0, count: 2, printed: 2}, choiceContext: {source: {kind: 'colony', name: 'Venus Redux'}, mode: 'reward'}} as unknown as PlayerInputModel;
    const bridge = parliamentPromptBridge(colony).grant;
    expect(bridge?.card).to.eq(undefined);
    expect(grantSupportOf(bridge, PartyName.GREENS)).to.eq(undefined);
  });
});

describe('voteVerbOf — the inspector\'s A under a delegate grant', () => {
  // The grant is the decision standing on this very screen: the caller feeds ITS prompt's parties and its own
  // gate (the viewer's action window is not a grant's gate), and the verb names the door it answers.
  const base: Parameters<typeof voteVerbOf>[0] = {
    participates: true,
    tile: {available: true, source: 'reserve', cost: 0},
    refusalText: '',
    offered: true,
    canActNow: true,
    offeredParties: [PartyName.GREENS, PartyName.MARS],
    party: PartyName.MARS,
    turnText: 'not now',
    notOfferedText: 'no longer offered',
  };

  it('a STAGED card door: available, and named `card` — the press is the play\'s commit', () => {
    expect(voteVerbOf({...base, door: 'card'})).to.deep.eq({available: true, gate: undefined, source: 'reserve', cost: 0, reason: undefined, door: 'card'});
  });

  it('a LIVE grant: named `grant`; the viewer\'s own vote carries no door at all', () => {
    expect(voteVerbOf({...base, door: 'grant'})?.door).to.eq('grant');
    expect(voteVerbOf(base)).to.not.have.property('door');
  });

  it('the door survives every refusal — a blocked verb still says whose delegate it is', () => {
    expect(voteVerbOf({...base, door: 'card', party: PartyName.UNITY})).to.deep.include({available: false, gate: 'rule', reason: 'no longer offered', door: 'card'});
    expect(voteVerbOf({...base, door: 'card', tile: {available: false, source: 'reserve', cost: 0}, refusalText: 'none left'}))
      .to.deep.include({available: false, gate: 'rule', reason: 'none left', door: 'card'});
    expect(voteVerbOf({...base, door: 'grant', canActNow: false})).to.deep.include({available: false, gate: 'turn', door: 'grant'});
  });

  it('the neutral delegates lift off ONE AFTER ANOTHER — the support scene\'s rhythm (law 12: a cube every ≥ 90 ms)', () => {
    expect(SUPPORT_CUBE_STAGGER_MS).to.be.at.least(90);
  });
});

describe('parliamentCommands — the staged door\'s bar', () => {
  beforeEach(() => {
    resetParliamentFlow();
    parliamentFlow.stage = 'vote';
  });
  afterEach(() => resetParliamentFlow());

  const base = {view: emptyParliamentView(), canVoteNow: true, partyActionStates: []};

  it('STAGED: A «Разыграть карту» · X «Осмотреть» · L3 «Источник» · B «Назад»', () => {
    const cmds = parliamentCommandsOf({...base, grant: {count: 1, staged: true, source: true}});
    expect(cmds.find((c) => c.control === 'confirm')).to.deep.include({label: 'Play card', enabled: true});
    expect(cmds.find((c) => c.control === 'secondary')?.label).to.eq('Inspect');
    expect(cmds.find((c) => c.control === 'stickL')?.label).to.eq('Source');
    expect(cmds.find((c) => c.control === 'back')?.label, 'reversible — nothing was sent').to.eq('Back');
  });

  it('a card\'s LIVE door (re-asked, a reload): «Отправить делегата» · L3 «Источник» · B «Свернуть»', () => {
    const cmds = parliamentCommandsOf({...base, grant: {count: 1, staged: false, source: true}});
    expect(cmds.find((c) => c.control === 'confirm')?.label).to.eq('Send the delegate');
    expect(cmds.find((c) => c.control === 'stickL')?.label).to.eq('Source');
    expect(cmds.find((c) => c.control === 'back')?.label).to.eq('Minimize');
  });

  it('a colony\'s grant keeps its bar word for word (no source verb: the giver is not a card)', () => {
    const cmds = parliamentCommandsOf({...base, grant: {count: 2}});
    expect(cmds.map((c) => c.control)).to.deep.eq(['confirm', 'secondary', 'back']);
    expect(cmds.find((c) => c.control === 'confirm')?.label).to.eq('Send the delegates');
    expect(cmds.find((c) => c.control === 'back')?.label).to.eq('Minimize');
  });

  it('the landed bar stays «Выполняется…» until the party\'s neutral delegates have landed too', () => {
    parliamentFlow.stage = 'landed';
    parliamentFlow.landedSeq = 7;
    parliamentFlow.voteSnapshot = {votes: 0, mine: 0, leader: undefined, winning: false, winner: undefined, source: 'reserve', count: 1, door: 'card', support: SUPPORT[0]};
    parliamentFlow.supportLanded = 1;
    expect(parliamentSupportInFlight()).to.eq(true);
    expect(parliamentCommandsOf(base)[0].label).to.eq('Performing…');
    parliamentFlow.supportLanded = 3;
    expect(parliamentSupportInFlight()).to.eq(false);
    expect(parliamentCommandsOf(base)[0].label).to.eq('Delegate placed');
  });
});
