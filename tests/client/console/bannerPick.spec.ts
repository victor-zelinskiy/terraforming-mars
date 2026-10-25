import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {BannerPromptMeta, PlayerInputModel, SelectPartyModel} from '@/common/models/PlayerInputModel';
import {ParliamentModel, PartyAccessModel} from '@/common/models/ParliamentModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {
  accessReasonRows, bannerCubesOn, bannerPickResponse, hasBannerCube, parliamentPromptBridge,
} from '@/client/console/parliament/consoleParliamentModel';
import {parliamentCommandsOf} from '@/client/console/parliament/parliamentCommands';
import {
  armBannerPickFlow, parliamentBannerUp, parliamentCrumbCommitted, parliamentCrumbSubject, parliamentFlow, resetParliamentFlow,
} from '@/client/console/parliament/consoleParliamentFlow';
import {
  BANNER_CUBE_FAQ_KEY, bannerConsequenceKey, bannerReadingOf, bannerStartParty, bannerStepStageOf,
} from '@/client/console/parliament/bannerPickModel';
import {
  bannerCubeHeld, bannerCubesShown, releaseBannerCube, resetBannerCubeScene, seedBannerCubeHolds,
} from '@/client/console/parliament/bannerCubeScene';
import {supportCursorOrder} from '@/client/console/parliament/supportPickModel';
import {partyStepStageOf, taskFor} from '@/client/console/consoleTaskRouter';

/**
 * THE BANNER MODE (Septem Tribus:redux — «a cube on the banner of any party»). The prompt's marker
 * (`bannerPrompt`) opens the Parliament's banner mode over the support mode's ring; a cube on a banner is a GRANT
 * of the party's effect read through the public access rows. Pinned here: the readings, the bridge and the answer,
 * the crumb and the bar, the road's own words, and the holds that keep a cube off its banner until its flight lands.
 */
const S = PartyName.SCIENTISTS;
const M = PartyName.MARS;
const G = PartyName.GREENS;
const R = PartyName.REDS;
const CORP = CardName.SEPTEM_TRIBUS_REDUX;

/** The six banners as the server words them: the Greens rule (the effect is the viewer's by another road), Mars First holds the cube. */
const META: BannerPromptMeta = {
  source: 'first-action',
  parties: REDUX_PARTIES.map((party) => party === M ?
    {party, available: false, hasCube: true, hasEffect: true, reason: 'Your cube already stands on this banner'} :
    {party, available: true, hasCube: false, hasEffect: party === G}),
};

function bannerPrompt(): SelectPartyModel {
  return {
    type: 'party', title: 'Select a party to place your cube on its banner', buttonLabel: 'Place cube',
    parties: REDUX_PARTIES.filter((p) => p !== M),
    bannerPrompt: META,
    choiceContext: {source: {kind: 'corporation', card: CORP}, mode: 'effect-choice'},
  } as unknown as SelectPartyModel;
}

function access(party: ReduxParty, granted: ReadonlyArray<string>): PartyAccessModel {
  return {party, ruling: false, delegates: 0, byDelegates: false, granted, hasEffect: granted.length > 0, satisfiesRequirement: false};
}

/** A parliament where `cubes` maps a seat colour to the parties whose banner holds its cube. */
function model(cubes: Partial<Record<Color, ReadonlyArray<ReduxParty>>>): ParliamentModel {
  const players = (Object.keys(cubes) as Array<Color>).map((color) => ({
    color, participates: true,
    access: REDUX_PARTIES.map((party) => access(party, cubes[color]?.includes(party) === true ? [CORP] : [])),
  }));
  return {players} as unknown as ParliamentModel;
}

function view(parliament: ParliamentModel, wf?: PlayerInputModel, color: Color = 'red'): PlayerViewModel {
  return {thisPlayer: {color}, waitingFor: wf, game: {parliament}} as unknown as PlayerViewModel;
}

describe('bannerPickModel — the readings', () => {
  it('the stage is «ЗНАМЯ» for the first action; the router names the same step', () => {
    expect(bannerStepStageOf(META)).eq('Banner');
    expect(partyStepStageOf(bannerPrompt())).eq('Banner');
    // …and the prompt is a PARTY task (the Parliament serves it) — never `unknown` (a stranded prompt).
    expect(taskFor({waitingFor: bannerPrompt()} as unknown as PlayerViewModel)?.kind).eq('party');
  });

  it('the cursor STARTS on the first banner on offer in the ring (a cursor, never a selection)', () => {
    const order = supportCursorOrder([...REDUX_PARTIES], G);
    expect(bannerStartParty(META, order)).eq(order[0]);
    const onlyMars: BannerPromptMeta = {source: 'first-action', parties: META.parties.map((row) => ({...row, available: row.party === S}))};
    expect(bannerStartParty(onlyMars, order)).eq(S);
  });

  it('a candidate reads what the cube opens; the ruling party\'s banner reads «already yours, the cube keeps it»; a banner holding the cube is refused with its reason', () => {
    const sci = bannerReadingOf(META, S)!;
    expect(sci).deep.eq({party: S, available: true, hasCube: false, hasEffect: false});
    expect(bannerConsequenceKey(sci)).eq('You gain this party\'s effect');
    expect(bannerConsequenceKey(bannerReadingOf(META, G)!)).match(/already yours/);
    expect(bannerReadingOf(META, M)).deep.eq({party: M, available: false, hasCube: true, hasEffect: true, reason: 'Your cube already stands on this banner'});
    expect(BANNER_CUBE_FAQ_KEY).match(/not its favour/);
  });
});

describe('consoleParliamentModel — the banner pick: the bridge, the answer, the road', () => {
  it('the LIVE banner prompt is the banner pick (never a grant, a support pick or a delegate pick), the corporation its giver', () => {
    const bridge = parliamentPromptBridge(bannerPrompt(), undefined);
    expect(bridge.bannerPick?.meta).deep.eq(META);
    expect(bridge.bannerPick?.card).eq(CORP);
    expect(bridge.grant).eq(undefined);
    expect(bridge.supportPick).eq(undefined);
    expect(bridge.delegatePick).eq(undefined);
  });

  it('the answer is the plain party response — only for a banner the prompt offers', () => {
    const bridge = parliamentPromptBridge(bannerPrompt(), undefined);
    expect(bannerPickResponse(bridge, S)).deep.eq({type: 'party', partyName: S});
    expect(bannerPickResponse(bridge, M), 'the cube already stands there').eq(undefined);
  });

  it('a cube is read off the PUBLIC access rows — every seat\'s, in seat order', () => {
    const m = model({red: [S, R], blue: [S]});
    expect(bannerCubesOn(m, S)).deep.eq(['red', 'blue']);
    expect(bannerCubesOn(m, R)).deep.eq(['red']);
    expect(bannerCubesOn(m, G)).deep.eq([]);
    expect(hasBannerCube(access(S, [CORP]))).is.true;
    expect(hasBannerCube(access(S, [CardName.REDS_NEWS_OUTLET])), 'another card\'s grant is not a cube').is.false;
  });

  it('the road\'s words: «Доступен · ваш куб на знамени» for a cube, the source\'s name for any other grant', () => {
    const ctx = {party: S as ReduxParty, enactedEmpty: false, enactedName: undefined, inArea: false};
    expect(accessReasonRows(access(S, [CORP]), ctx)[0]).deep.include({key: 'You have it: your cube stands on its banner', tone: 'holds'});
    expect(accessReasonRows(access(S, ['Somebody']), ctx)[0]).deep.include({key: 'You have it: granted by ${0}', params: ['Somebody']});
  });
});

describe('consoleParliamentFlow — the banner mode\'s crumb and bar', () => {
  afterEach(() => resetParliamentFlow());

  it('armed, the mode stands: the subject is its stage, amber from the start (a LIVE, mandatory prompt)', () => {
    armBannerPickFlow({zone: 'parties', partyIndex: 0}, 'Banner', META);
    expect(parliamentBannerUp()).is.true;
    expect(parliamentCrumbSubject()).eq('Banner');
    expect(parliamentCrumbCommitted()).is.true;
  });

  it('the bar: «Поставить куб» lit on a banner on offer, «Свернуть» (never «Назад»), L3 for the corporation; past A a status', () => {
    armBannerPickFlow({zone: 'parties', partyIndex: 0}, 'Banner', META);
    const base = {stage: 'banner'} as unknown as Parameters<typeof parliamentCommandsOf>[0];
    const cmds = parliamentCommandsOf({...base, banner: {committed: false, source: true, available: true}} as never);
    expect(cmds.map((c) => c.label)).deep.include.members(['Place cube', 'Inspect', 'Source', 'Minimize']);
    expect(cmds.find((c) => c.control === 'confirm')).deep.include({enabled: true});
    parliamentFlow.bannerCommitted = true;
    const busy = parliamentCommandsOf({...base, banner: {committed: true, source: true, available: false}} as never);
    expect(busy).deep.eq([{control: 'confirm', label: 'Performing…', enabled: false}]);
  });
});

describe('bannerCubeScene — a cube is held off its banner until its flight lands', () => {
  afterEach(() => resetBannerCubeScene());

  it('the viewer\'s own answer to the banner prompt holds the new cube; the surfaces draw the banner without it', () => {
    const before = view(model({red: []}), bannerPrompt());
    const after = view(model({red: [S]}), undefined);
    seedBannerCubeHolds(before, after);
    expect(bannerCubeHeld(S, 'red')).is.true;
    expect(bannerCubesShown(S, ['red', 'blue'])).deep.eq(['blue']);
    releaseBannerCube(S, 'red', true);
    expect(bannerCubesShown(S, ['red'])).deep.eq(['red']);
  });

  it('a RIVAL\'s first action is not held (nobody flies it — it simply stands); a first view seeds nothing', () => {
    seedBannerCubeHolds(view(model({red: [], blue: []}), undefined), view(model({red: [], blue: [R]}), undefined));
    expect(bannerCubeHeld(R, 'blue')).is.false;
    seedBannerCubeHolds(undefined, view(model({red: [S]}), bannerPrompt()));
    expect(bannerCubeHeld(S, 'red')).is.false;
  });

  it('a cube the sitting\'s record names is held for its beat — every viewer watches it', () => {
    const before = view(model({red: [], blue: []}), undefined, 'blue');
    const afterModel = model({red: [S], blue: []});
    (afterModel as unknown as {phase: unknown}).phase = {summary: {bannerCubes: [{player: 'red', party: S, card: CORP}]}};
    seedBannerCubeHolds(before, view(afterModel, undefined, 'blue'));
    expect(bannerCubeHeld(S, 'red')).is.true;
  });
});
