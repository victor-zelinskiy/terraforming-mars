import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsolePartyPlaque from '@/client/components/console/parliament/ConsolePartyPlaque.vue';
import ConsoleParliamentEffects from '@/client/components/console/parliament/ConsoleParliamentEffects.vue';
import ConsolePartyAccessPanel from '@/client/components/console/parliament/ConsolePartyAccessPanel.vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, ParliamentRulingAnswerModel, ParliamentSlotModel, PartyAccessModel} from '@/common/models/ParliamentModel';
import {newViewerRulingAnswers, ratingAnswerSpecs} from '@/client/console/parliament/rulingChangeDraw';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {
  accessReasonRows, accessRingOf, accessRoadOf, allianceBadgeOf, allianceOf, alliancePairOf, alliancePartnerOf, allianceSourceOf, emptyParliamentView,
  ParliamentPartyVm, ParliamentSlotVm, ParliamentViewVm, PartyActionStateVm, partyStateOf, voteAccessOf, voteForecastOf,
} from '@/client/console/parliament/consoleParliamentModel';
import {parliamentEffectItems} from '@/client/console/parliament/parliamentEffectsModel';
import {parliamentEffectsStep} from '@/client/console/parliament/parliamentEffectsStepModel';
import {resolutionStatusOf} from '@/client/console/parliament/resolutionInspectModel';
import {panelFactsOf, voteFactsOf} from '@/client/console/parliament/voteInfoModel';
import {getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  allianceImpulsesSettled, allianceImpulseState, alliedPartiesOf, noteAllianceImpulseSeen, owedAllianceImpulses, resetAllianceImpulse, seedAllianceSeen,
} from '@/client/console/parliament/allianceImpulse';

/*
 * THE LAW OF ACCESS'S FOURTH ROAD (TR62 Tharsis Alliance — «while Mars First is ruling or you have 2 delegates there,
 * you may also use the Reds' effect and cards. And vice versa»).
 *
 * The road is the SERVER's (`PartyAccessModel.allied` / `alliances`) and every client surface reads it through ONE
 * set of helpers (`accessRoadOf`, `allianceOf`, …; guard `parliamentAccessRoadGuard`): the seal wears the BADGE on
 * both parties of the pair and the ally's BORROWED ring; every «why» names the partner and the card; the vote names
 * the ally the second cube opens BEFORE the press. This spec pins what each surface decides BY the model.
 */
const BLUE: Color = 'blue';
const ID = CardName.THARSIS_ALLIANCE;
const M: ReduxParty = PartyName.MARS;
const R: ReduxParty = PartyName.REDS;
const S: ReduxParty = PartyName.SCIENTISTS;

function access(party: ReduxParty, over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

/** The Reds under Mars First's rule: the effect and the cards by the alliance road. */
const redsAllied = (over: Partial<PartyAccessModel> = {}) => access(R, {
  allied: [{via: M, source: ID, road: 'ruling'}], alliances: [{partner: M, source: ID}], hasEffect: true, satisfiesRequirement: true, ...over,
});
/** Mars First ruling — the partner that lends the Reds. */
const marsRuling = () => access(M, {ruling: true, hasEffect: true, satisfiesRequirement: true, alliances: [{partner: R, source: ID}]});
/** A dormant pair: the card on the table, neither party standing. */
const redsDormant = () => access(R, {alliances: [{partner: M, source: ID}]});

function party(p: ReduxParty, a: PartyAccessModel | undefined, over: Partial<ParliamentPartyVm> = {}): ParliamentPartyVm {
  return {party: p, effect: getPartyEffect(p), rule: 'r', support: 0, inArea: true, ruling: a?.ruling ?? false, access: a, actionId: undefined, action: undefined, ...over};
}

function slotVm(over: Partial<ParliamentSlotVm> = {}): ParliamentSlotVm {
  return {
    instance: 'RDX_MARS_1#0', resolutionId: 'RDX_MARS_1', resolution: undefined, party: M,
    votes: [], totalVotes: 0, leader: undefined, leaderVotes: 0, isWinning: false, tiePriority: 1, viewerVotes: 1, viewerEffectDelegates: 2, projection: undefined, ...over,
  };
}

describe('the alliance road (TR62) — the ONE client reading', () => {
  it('the road, the pair, the partner, the card: ruling → delegates → alliance → card, as the server ranks them', () => {
    expect(accessRoadOf(undefined)).is.undefined;
    expect(accessRoadOf(access(R))).is.undefined;
    expect(accessRoadOf(redsAllied())).to.eq('alliance');
    expect(accessRoadOf(redsAllied({delegates: 2, byDelegates: true})), 'own cubes outrank the alliance').to.eq('delegates');
    expect(accessRoadOf(redsAllied({ruling: true})), 'the crown outranks everything').to.eq('ruling');
    expect(accessRoadOf(access(R, {granted: ['Septem Tribus'], hasEffect: true}))).to.eq('card');
    expect(allianceOf(redsAllied())).to.deep.eq({via: M, source: ID, road: 'ruling'});
    expect(alliancePairOf(redsDormant())).to.deep.eq({partner: M, source: ID});
    expect(alliancePartnerOf(redsDormant()), 'a dormant pair still names its partner').to.eq(M);
    expect(allianceSourceOf(redsAllied())).to.eq(ID);
    expect(allianceSourceOf(access(R))).to.eq('');
  });

  it('the badge: active while the alliance holds or the partner stands by its printed road, dormant otherwise; the ring by the road', () => {
    expect(allianceBadgeOf(redsAllied())).to.eq('active');
    expect(allianceBadgeOf(marsRuling()), 'the partner that LENDS is active too').to.eq('active');
    expect(allianceBadgeOf(access(M, {delegates: 2, byDelegates: true, alliances: [{partner: R, source: ID}]}))).to.eq('active');
    expect(allianceBadgeOf(redsDormant())).to.eq('dormant');
    expect(allianceBadgeOf(access(R))).is.undefined;
    expect([accessRingOf(redsAllied()), accessRingOf(marsRuling()), accessRingOf(access(M, {byDelegates: true, delegates: 2, hasEffect: true})), accessRingOf(redsDormant())])
      .to.deep.eq(['allied', 'ruling', 'own', 'none']);
  });

  it('the seal\'s state: «alliance» with the partner named; the badge rides the state of BOTH parties', () => {
    const reds = partyStateOf(party(R, redsAllied()), false);
    expect(reds).to.deep.include({kind: 'alliance', label: 'Your effect · by the alliance: ${0}', tone: 'mint', held: true, ring: 'allied'});
    expect(reds.params).to.deep.eq(['party name: Mars First']);
    expect(reds.ally).to.deep.eq({partner: M, badge: 'active'});
    expect(partyStateOf(party(M, marsRuling()), false)).to.deep.include({kind: 'ruling', ring: 'ruling', ally: {partner: R, badge: 'active'}});
    const dormant = partyStateOf(party(R, redsDormant()), false);
    expect(dormant).to.deep.include({kind: 'in-area', ring: 'none', ally: {partner: M, badge: 'dormant'}});
    expect(partyStateOf(party(S, access(S)), false).ally, 'a party outside the pair wears no badge').is.undefined;
  });

  it('the access reasons: held by the alliance (the partner\'s road, the card), the requirement met THROUGH the partner, the partner\'s own note', () => {
    const ctx = (p: ReduxParty) => ({party: p, enactedEmpty: false, enactedName: 'Law', inArea: true});
    expect(accessReasonRows(redsAllied(), ctx(R)).map((r) => [r.key, r.params, r.tone])).to.deep.eq([
      ['You have it by the alliance: ${0} rules (${1})', ['party name: Mars First', ID], 'holds'],
      ['Card requirement of this party: met by the alliance through ${0}', ['party name: Mars First'], 'note'],
    ]);
    const byCubes = redsAllied({allied: [{via: M, source: ID, road: 'delegates'}]});
    expect(accessReasonRows(byCubes, ctx(R))[0].key).to.eq('You have it by the alliance: two of your delegates on the resolution of ${0} (${1})');
    // The PARTNER's dossier knows the pair: its printed road lends the other party.
    expect(accessReasonRows(marsRuling(), ctx(M)).map((r) => r.key)).to.deep.eq([
      'You have it: the party rules — ${0} is enacted',
      'Alliance (${1}): your access to this party opens ${0} too',
      'Card requirement of this party: met',
    ]);
    // Dormant: the party's own way first, then the alliance's second road.
    expect(accessReasonRows(redsDormant(), ctx(R)).map((r) => [r.key, r.tone])).to.deep.eq([
      ['You do not have it — two of your delegates on its resolution would grant it', 'lacks'],
      ['The alliance would open it: ${0} ruling or two of your delegates on its resolution (${1})', 'lacks'],
    ]);
    // Met by its own two cubes beside a holding alliance: the requirement is simply «met».
    expect(accessReasonRows(redsAllied({delegates: 2, byDelegates: true}), ctx(R)).map((r) => r.key)).to.include('Card requirement of this party: met');
  });

  it('the vote: a party held by the alliance is «already yours» (the second cube adds nothing); the partner\'s printed edge names the ally', () => {
    const held = voteAccessOf(slotVm({party: R}), party(R, redsAllied()), 1, 0);
    expect(held).to.deep.include({heldByOther: true, reason: 'already yours: by the alliance'});
    const projection = {instance: 'RDX_MARS_1#0', votesAfter: 2, leaderAfter: BLUE, viewerLeads: true, becomesWinning: false, unlocksEffect: true, unlocksRequirement: true, unlocksAlliance: {party: R, source: ID}};
    const f = voteForecastOf(slotVm({projection}), BLUE, {available: true, reason: '', source: 'lobby', cost: 0, projections: []});
    expect(f?.unlocksAlliance).to.eq(R);
    const facts = voteFactsOf({slot: slotVm({projection}), party: party(M, access(M, {delegates: 1, alliances: [{partner: R, source: ID}]})), viewer: BLUE,
      forecast: f, snapshot: undefined, landed: false, mineBefore: 1, mineAfter: 2, nameOf: (c) => c});
    expect(facts.ally).to.deep.include({id: 'ally', label: 'Alliance', tone: 'gain', unchanged: false});
    expect(facts.ally?.before).to.deep.eq({key: 'party name: Reds'});
    expect(facts.ally?.after).to.deep.eq({key: 'effect and cards are yours'});
    expect(panelFactsOf(facts).map((x) => x.id), 'the edge\'s two facts: the party\'s own effect, then the ally').to.deep.eq(['lead', 'win', 'access', 'ally']);
    const landed = voteFactsOf({slot: slotVm({projection}), party: party(M, access(M)), viewer: BLUE, forecast: f, snapshot: undefined, landed: true, mineBefore: 1, mineAfter: 2, nameOf: (c) => c});
    expect(landed.ally, 'landed — the seals and the dossier say it').is.undefined;
  });

  it('the resolution footer names the alliance as the basis', () => {
    const GRID = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID';
    const slot: ParliamentSlotModel = {instance: `${GRID}#0`, resolution: GRID, party: PartyName.INDUSTRIALISTS, votes: [], totalVotes: 0, leader: undefined, isWinning: false, tiePriority: 1, viewerVotes: 0};
    const a = access(PartyName.INDUSTRIALISTS, {allied: [{via: M, source: ID, road: 'ruling'}], alliances: [{partner: M, source: ID}], hasEffect: true, satisfiesRequirement: true});
    const model = {
      slots: [slot], rulingParty: M, popularSupport: {},
      players: [{color: BLUE, participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0, access: [a], partyActionUses: {}, resolutionActionUses: 0}],
      deckSize: 0, discardSize: 0, neutralSupply: 0, botMode: 'none',
    } as unknown as ParliamentModel;
    expect(resolutionStatusOf(GRID, model, BLUE)?.access).to.deep.include({kind: 'held', basis: 'alliance', places: false});
  });
});

describe('«ВАШИ ЭФФЕКТЫ» — a party held by the alliance is a tile whose WHY is the partner', () => {
  function view(held: ReadonlyArray<PartyAccessModel>): ParliamentViewVm {
    return {
      ...emptyParliamentView(), rulingParty: M,
      parties: REDUX_PARTIES.map((p) => party(p, undefined, {ruling: p === M, inArea: false})),
      viewer: {color: BLUE, name: 'me', participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0, access: held, partyActionUses: {}, resolutionActionUses: 0},
    };
  }
  const states = (): Array<PartyActionStateVm> => REDUX_PARTIES.map(() => ({kind: 'none'}) as PartyActionStateVm);

  it('the model: the Reds\' tile reads `alliance` with Mars First as `via`; the inner step names the partner and the card', () => {
    const input = {view: view([marsRuling(), redsAllied()]), ruler: M, enacted: undefined, partyActionStates: states(), resolutionActionState: undefined};
    const items = parliamentEffectItems(input);
    expect(items.map((i) => [i.party, i.why, i.via])).to.deep.eq([[M, 'ruling', undefined], [R, 'alliance', M]]);
    const step = parliamentEffectsStep(input);
    const reds = [...step.standing, ...step.actions].find((e) => e.party === R)!;
    expect(reds.whyReading).to.deep.eq({key: 'by the alliance: ${0} · «${1}»', params: ['party name: Mars First', ID]});
  });

  it('the tile draws the partner\'s emblem and the link in the WHY slot', () => {
    const w = mount(ConsoleParliamentEffects, {...globalConfig, props: {view: view([marsRuling(), redsAllied()]), viewerColor: BLUE, partyActionStates: states()}});
    const row = w.find(`.con-parl__effects-row[data-party="${R}"]`);
    expect(row.find('[data-parl-effects-why]').attributes('data-parl-effects-why')).to.eq('alliance');
    expect(row.find('[data-parl-effects-via]').attributes('data-parl-effects-via')).to.eq(M);
    expect(row.find('.con-parl__effects-link').exists()).is.true;
  });
});

describe('ConsolePartyPlaque — the alliance is an OBJECT on the seal, never a caption', () => {
  function plaque(p: ReduxParty, a: PartyAccessModel, size: 'row' | 'ruler' | 'hero' = 'row') {
    return mount(ConsolePartyPlaque, {...globalConfig, props: {party: p, state: partyStateOf(party(p, a), false), viewerColor: BLUE, formula: false, size}});
  }

  it('the ally: the BORROWED ring (both live arcs in the partner\'s accent, the link at the seam) and the active badge', () => {
    const w = plaque(R, redsAllied());
    const root = w.find('.con-pseal');
    expect(root.attributes('data-pseal-ring')).to.eq('allied');
    expect(root.attributes('data-pseal-ally')).to.eq('active');
    expect(root.attributes('data-pseal-ally-partner')).to.eq(M);
    expect(root.classes()).to.include('con-pseal--allied');
    expect(root.attributes('style')).to.contain('--pseal-ally-accent');
    expect(w.findAll('.con-pseal__place--ally').length, 'both printed places are lit by the partner').to.eq(2);
    expect(w.find('[data-pseal-ring-link]').exists()).is.true;
    expect(w.find('.con-pseal__ally--active').exists()).is.true;
    expect(w.find('.con-pseal__state-text').exists(), 'a bench says it by objects — no word').is.false;
  });

  it('the partner: its own ring, the active badge; a dormant pair: the outlined badge, no borrowed ring', () => {
    const mars = plaque(M, access(M, {delegates: 2, byDelegates: true, hasEffect: true, satisfiesRequirement: true, alliances: [{partner: R, source: ID}]}));
    expect(mars.find('.con-pseal').attributes('data-pseal-ring')).to.eq('own');
    expect(mars.find('.con-pseal').attributes('data-pseal-ally')).to.eq('active');
    expect(mars.find('[data-pseal-ring-link]').exists()).is.false;
    const dormant = plaque(R, redsDormant());
    expect(dormant.find('.con-pseal').attributes('data-pseal-ally')).to.eq('dormant');
    expect(dormant.find('.con-pseal__ally--dormant').exists()).is.true;
    expect(dormant.findAll('.con-pseal__place--ally').length).to.eq(0);
  });

  it('a larger face names the partner in words («Эффект ваш · по альянсу: …»)', () => {
    const w = plaque(R, redsAllied(), 'hero');
    expect(w.find('.con-pseal__state-text').text()).to.eq('Your effect · by the alliance: party name: Mars First');
  });
});

describe('the party dossier\'s «ДОСТУП» — the alliance is the object\'s state', () => {
  it('tone `allied`, the partner\'s emblem in the ring\'s mark, no places (the road is not the viewer\'s cubes)', () => {
    const model = {
      slots: [], enacted: undefined, rulingParty: M, popularSupport: {},
      players: [{color: BLUE, participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0, access: [redsAllied()], partyActionUses: {}, resolutionActionUses: 0}],
      deckSize: 0, discardSize: 0, neutralSupply: 0,
    } as unknown as ParliamentModel;
    const w = mount(ConsolePartyAccessPanel, {...globalConfig, props: {party: R, parliament: model, viewer: BLUE}});
    expect(w.find('[data-parl-access-panel]').attributes('data-access-tone')).to.eq('allied');
    expect(w.find('[data-parl-access-via]').attributes('data-parl-access-via')).to.eq(M);
    expect(w.find('[data-parl-access-places]').exists()).is.false;
    expect(w.find('[data-parl-access-state]').text()).to.contain('You have it by the alliance');
  });
});

describe('the alliance\'s activation is SEEN once (decision 5a — `allianceImpulse.ts`)', () => {
  // Module state is bundle-shared: a chamber mounted by an earlier spec may have seeded it — start from a reset.
  beforeEach(() => resetAllianceImpulse());
  afterEach(() => resetAllianceImpulse());
  const viewWith = (accessList: Array<PartyAccessModel>) => ({
    thisPlayer: {color: BLUE},
    game: {parliament: {players: [{color: BLUE, access: accessList}]}},
  } as unknown as PlayerViewModel);

  it('the first view is the pose the player lands in: nothing is owed for an alliance that already stood', () => {
    seedAllianceSeen(viewWith([marsRuling(), redsAllied()]));
    expect(owedAllianceImpulses(alliedPartiesOf([marsRuling(), redsAllied()]))).deep.eq([]);
  });
  it('an activation the chamber did not show is OWED until it is played — and then never again', () => {
    seedAllianceSeen(viewWith([marsRuling(), redsDormant()]));
    const allied = alliedPartiesOf([marsRuling(), redsAllied()]);
    expect(allied).deep.eq([R]);
    expect(owedAllianceImpulses(allied), 'owed to the first time the seals are seen').deep.eq([R]);
    expect(allianceImpulseState.pending.has(R), 'the enactment\'s tail waits for it').is.true;
    expect(owedAllianceImpulses(allied), 'a chamber that left first: still owed').deep.eq([R]);
    noteAllianceImpulseSeen(R);
    expect(owedAllianceImpulses(allied), 'played once').deep.eq([]);
    expect(allianceImpulseState.pending.size).eq(0);
  });
  it('a lost alliance is forgotten — its next activation plays again', () => {
    seedAllianceSeen(viewWith([marsRuling(), redsAllied()]));
    expect(owedAllianceImpulses([])).deep.eq([]);
    expect(owedAllianceImpulses([R]), 'activated again').deep.eq([R]);
  });
  it('the tail\'s wait resolves once nothing is owed or in the air — and is bounded', async () => {
    const tick = (fn: () => void) => setTimeout(fn, 1);
    await allianceImpulsesSettled(50, tick);
    allianceImpulseState.flying = 1;
    const t0 = Date.now();
    await allianceImpulsesSettled(30, tick);
    expect(Date.now() - t0, 'bounded by its cap').to.be.greaterThanOrEqual(25);
  });
});

describe('a card\'s RATING answer to a change of power (TR63 — `rulingChangeDraw.ts`)', () => {
  const viewOf = (generation: number, answers: Array<ParliamentRulingAnswerModel> | undefined) => ({
    thisPlayer: {color: BLUE},
    game: {parliament: {phase: {generation, step: 'enact', summary: answers === undefined ? {} : {rulingAnswers: answers}}}},
  } as unknown as PlayerViewModel);
  const eden: ParliamentRulingAnswerModel = {player: BLUE, card: CardName.EDEN_ALLIANCE, party: PartyName.GREENS, tr: 1, stock: {megacredits: 2}};

  it('the response\'s NEW answers of the viewer, keyed structurally; a first view or a rival\'s answer adds nothing', () => {
    expect(newViewerRulingAnswers(viewOf(3, undefined), viewOf(3, [eden])).map((n) => n.answer)).deep.eq([eden]);
    expect(newViewerRulingAnswers(viewOf(3, [eden]), viewOf(3, [eden])), 'already seen').deep.eq([]);
    expect(newViewerRulingAnswers(undefined, viewOf(3, [eden])), 'a first view replays nothing').deep.eq([]);
    expect(newViewerRulingAnswers(viewOf(3, undefined), viewOf(3, [{...eden, player: 'red'}])), 'a rival\'s').deep.eq([]);
  });
  it('the rows a rating answer holds: the rating token, then the table\'s stock answer; a draw holds nothing here', () => {
    expect(ratingAnswerSpecs(eden)).deep.eq({
      specs: [{channel: 'stock', resource: 'rating', amount: 1}],
      reactions: [{channel: 'stock', resource: 'megacredits', amount: 2}],
    });
    expect(ratingAnswerSpecs({player: BLUE, card: ID, party: M, cards: 1})).is.undefined;
  });
  it('TR64: a PRODUCTION answer is a production token born on the same seal; a lowered production holds nothing', () => {
    const promethean: ParliamentRulingAnswerModel = {player: BLUE, card: CardName.PROMETHEAN_ALLIANCE, party: PartyName.SCIENTISTS, production: {megacredits: 2}};
    expect(ratingAnswerSpecs(promethean)).deep.eq({
      specs: [{channel: 'production', resource: 'megacredits', amount: 2}],
      reactions: [],
    });
    expect(ratingAnswerSpecs({...promethean, production: {megacredits: -1}})).is.undefined;
  });
});
