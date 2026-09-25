import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentModel, ParliamentPlayerModel, VoteOptionModel, VoteProjectionModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {ParliamentPartyVm, ParliamentSlotVm, voteForecastOf} from '@/client/console/parliament/consoleParliamentModel';
import {voteYieldsOf, winSuffixesOf} from '@/client/console/parliament/influenceYieldModel';
import {QUIET_REWARD_KICKER} from '@/client/console/parliament/quietRewardPose';
import {
  factValueText, footerFactsOf, panelFactsOf, READING_KICKER_SEATED, READING_KICKER_SPECTATOR, voteFactsOf, VoteFactsVm, voteInfoBudget,
  voteInfoOf, voteReadingOf,
} from '@/client/console/parliament/voteInfoModel';

/**
 * THE VOTE PANEL'S ONE-NUMBER MODEL (Turmoil Redux): the estimate is the one
 * reading, the win's difference is a SUFFIX of it (never a second plate — and
 * none at all where the win raises nothing), the party's answer stands on the
 * number shown, the facts are the leader and the winning state with the party
 * effect only on the edge this delegate crosses, and a spectator reads the
 * graphic alone. Driven with the SHIPPED catalog, so a re-declared card fails here.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';
const CLIMATE = 'RDX_GREENS_CLIMATE_RESEARCH';
const GRID = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID';
const AWARD = 'RDX_MARS_ARCHITECTURE_AWARD';
const DEV_PASSIVE = 'RDX_DEV_PASSIVE';
const DEV_ACTION = 'RDX_DEV_ACTION';

function shipped(id: string): IClientResolution {
  const r = getResolution(id);
  if (r === undefined) {
    throw new Error(`${id} is not in the client catalog`);
  }
  return r;
}

function seat(agenda: number, over: Partial<ParliamentPlayerModel> = {}): ParliamentPlayerModel {
  return {
    color: BLUE, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false,
    agenda, influence: influenceAtAgenda(agenda), access: [], partyActionUses: {}, resolutionActionUses: 0, ...over,
  };
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

const TABLEAU_WITH_FISH = [{name: CardName.FISH}];

describe('voteInfoModel — the reading', () => {
  it('ONE reading per effect: the estimate; the forecast is folded into a suffix, never a second plate', () => {
    // Aquifer at the start of the track: 0 animals now, the win takes the marker to step 1 = influence 1.
    const reading = voteReadingOf(shipped(AQUIFER), model([seat(0)]), BLUE, TABLEAU_WITH_FISH);
    expect(reading.kicker).eq(READING_KICKER_SEATED);
    expect(reading.yields.map((y) => y.context)).deep.eq(['estimate']);
    expect(reading.yields[0]).deep.include({influence: 0, amount: 0});
    expect(reading.suffixes).deep.eq([{effectId: 'animals', delta: 1, agendaStep: 1, influence: 1, atCap: false}]);
    expect(reading.note, 'Fish holds animals — no note').is.undefined;
  });

  it('the suffix exists ONLY where the win raises the number: a TR step next → no suffix', () => {
    // Step 1 → the next step (2) is a TR step: influence stays 1.
    const reading = voteReadingOf(shipped(AQUIFER), model([seat(1)]), BLUE, TABLEAU_WITH_FISH);
    expect(reading.yields.map((y) => y.context)).deep.eq(['estimate']);
    expect(reading.suffixes).deep.eq([]);
  });

  it('the cap: at influence 5 the maximum is already reached — no suffix (Power Grid and Architecture Award alike)', () => {
    const grid = model([seat(12, {counts: [{id: 'powerTags', count: 3, cards: [CardName.POWER_PLANT, CardName.HE3_FUSION_PLANT], units: [1, 2]}]})]);
    const gridReading = voteReadingOf(shipped(GRID), grid, BLUE, []);
    expect(gridReading.yields[0]).deep.include({context: 'estimate', influence: 5, amount: 5, uncapped: 8});
    expect(gridReading.suffixes).deep.eq([]);
    const award = model([seat(12, {counts: [{id: 'buildingCardsWithNonNegativeVp', count: 1, cards: [CardName.ARTIFICIAL_LAKE]}]})]);
    const awardReading = voteReadingOf(shipped(AWARD), award, BLUE, []);
    expect(awardReading.yields[0]).deep.include({context: 'estimate', influence: 5, amount: 5});
    expect(awardReading.suffixes).deep.eq([]);
  });

  it('…and a win that REACHES the cap keeps its suffix, marked as reaching the maximum', () => {
    // P 3 + I 1 = 4 now; winning → step 3 (influence 2) → 5, the maximum.
    const grid = model([seat(2, {counts: [{id: 'powerTags', count: 3, cards: [CardName.POWER_PLANT, CardName.HE3_FUSION_PLANT], units: [1, 2]}]})]);
    const reading = voteReadingOf(shipped(GRID), grid, BLUE, []);
    expect(reading.yields[0]).deep.include({amount: 4});
    expect(reading.suffixes).deep.eq([{effectId: 'production', delta: 1, agendaStep: 3, influence: 2, atCap: true}]);
  });

  it('a sequel chain: one plate per link in one reading, and a suffix per link where the win raises it', () => {
    // Climate at step 2 (influence 1), heat production 4: +1 → 5 → 1 card now; winning → step 3 (influence 2): +2 → 6 → 2 cards.
    const reading = voteReadingOf(shipped(CLIMATE), model([seat(2, {production: {[Resource.HEAT]: 4}})]), BLUE, []);
    expect(reading.yields.map((y) => [y.effect.id, y.context, y.amount])).deep.eq([['heatProduction', 'estimate', 1], ['draw', 'estimate', 1]]);
    expect(reading.yields[1].total).deep.eq({before: 4, after: 5});
    expect(reading.suffixes).deep.eq([
      {effectId: 'heatProduction', delta: 1, agendaStep: 3, influence: 2, atCap: false},
      {effectId: 'draw', delta: 1, agendaStep: 3, influence: 2, atCap: false},
    ]);
    // The suffix is the very difference `voteYieldsOf` computes — nothing re-derived.
    expect(winSuffixesOf(voteYieldsOf(shipped(CLIMATE), model([seat(2, {production: {[Resource.HEAT]: 4}})]), BLUE))).deep.eq(reading.suffixes);
  });

  it('the ruling party answers the number SHOWN (the estimate), not the folded forecast', () => {
    const reading = voteReadingOf(shipped(CLIMATE), model([seat(2, {production: {[Resource.HEAT]: 4}})]), BLUE, []);
    expect(reading.reactions.map((r) => [r.party, r.amount, r.moment])).deep.eq([[PartyName.GREENS, 1, 'conditional']]);
    expect(getPartyEffect(PartyName.GREENS)?.reactions, 'the answer is the party\'s declared reaction').is.not.undefined;
  });

  it('a spectator (no seat) reads the graphic alone — no kicker «for you», no number, no suffix, no answer', () => {
    for (const viewer of [undefined, RED]) {
      const reading = voteReadingOf(shipped(AQUIFER), model([seat(3)]), viewer, []);
      expect(reading.kicker).eq(READING_KICKER_SPECTATOR);
      expect(reading.yields).deep.eq([]);
      expect(reading.suffixes).deep.eq([]);
      expect(reading.reactions).deep.eq([]);
    }
  });

  it('a card that pays NOTHING at the enactment (a passive, an action) reads under the quiet reward\'s kicker — the sitting\'s own words — never «for you»; a spectator keeps the plain heading', () => {
    const passive = voteReadingOf(shipped(DEV_PASSIVE), model([seat(3)]), BLUE, []);
    expect(passive.kicker).eq(QUIET_REWARD_KICKER.passive);
    expect(passive.yields).deep.eq([]);
    expect(passive.suffixes).deep.eq([]);
    const action = voteReadingOf(shipped(DEV_ACTION), model([seat(3)]), BLUE, []);
    expect(action.kicker).eq(QUIET_REWARD_KICKER.action);
    expect(action.yields).deep.eq([]);
    expect(voteReadingOf(shipped(DEV_PASSIVE), model([seat(3)]), RED, []).kicker).eq(READING_KICKER_SPECTATOR);
  });

  it('the honest note is the server\'s own compact reason when no card of the viewer can hold the payout', () => {
    const reading = voteReadingOf(shipped(AQUIFER), model([seat(3)]), BLUE, []);
    expect(reading.note).eq('No card can hold animals');
  });
});

// ── the facts ────────────────────────────────────────────────────────────────

function slotVm(over: Partial<ParliamentSlotVm> = {}): ParliamentSlotVm {
  return {
    instance: `${AQUIFER}#0`, resolutionId: AQUIFER, resolution: shipped(AQUIFER), party: PartyName.GREENS,
    votes: [], totalVotes: 0, leader: undefined, leaderVotes: 0, isWinning: false, tiePriority: 1, viewerVotes: 0, projection: undefined, ...over,
  };
}

function partyVm(over: Partial<ParliamentPartyVm> = {}): ParliamentPartyVm {
  return {party: PartyName.GREENS, effect: getPartyEffect(PartyName.GREENS), rule: 'r', support: 0, inArea: true, ruling: false, access: undefined, actionId: undefined, action: undefined, ...over};
}

function projection(over: Partial<VoteProjectionModel> = {}): VoteProjectionModel {
  return {instance: `${AQUIFER}#0`, votesAfter: 1, leaderAfter: BLUE, viewerLeads: true, becomesWinning: true, unlocksEffect: false, unlocksRequirement: false, ...over};
}

const VOTE: VoteOptionModel = {available: true, reason: '', source: 'lobby', cost: 0, projections: []};

function facts(slot: ParliamentSlotVm, party: ParliamentPartyVm | undefined, opts: Partial<Parameters<typeof voteFactsOf>[0]> = {}): VoteFactsVm {
  return voteFactsOf({
    slot, party, viewer: BLUE, forecast: voteForecastOf(slot, BLUE, VOTE),
    snapshot: undefined, landed: false, mineBefore: slot.viewerVotes, mineAfter: slot.viewerVotes + 1,
    nameOf: (c) => `name:${c}`, ...opts,
  });
}

describe('voteInfoModel — the facts', () => {
  it('the leader and the winning state read current → projected from the server\'s projection', () => {
    const slot = slotVm({votes: [{owner: RED, seq: 1}], totalVotes: 1, leader: RED, projection: projection({votesAfter: 2, tieNote: 'earlier-delegate'})});
    const f = facts(slot, partyVm());
    expect(f.lead.before).deep.eq({key: 'name:red', raw: true, cube: RED});
    expect(f.lead.after).deep.eq({key: 'you (earlier delegate)', cube: BLUE});
    expect(f.lead).deep.include({unchanged: false, tone: 'gain'});
    expect(f.win.before).deep.eq({key: 'no'});
    expect(f.win.after).deep.eq({key: 'yes'});
    expect(f.win).deep.include({unchanged: false, tone: 'gain', note: undefined});
  });

  it('a fact that does not change is ONE value; a card that stays behind names why (the inspector\'s note)', () => {
    const slot = slotVm({leader: RED, votes: [{owner: RED, seq: 1}, {owner: RED, seq: 2}], totalVotes: 2, projection: projection({leaderAfter: RED, viewerLeads: false, becomesWinning: false, votesAfter: 3})});
    const f = facts(slot, partyVm());
    expect(f.lead).deep.include({unchanged: true, tone: 'none'});
    expect(f.lead.after).deep.eq({key: 'name:red', raw: true, cube: RED});
    expect(f.win).deep.include({unchanged: true, tone: 'none', note: 'another resolution leads'});
    expect(f.win.after).deep.eq({key: 'no'});
  });

  it('no leader before the vote: the panel prints a dash, the inspector the words', () => {
    const f = facts(slotVm({projection: projection()}), partyVm());
    expect(f.lead.before).deep.eq({key: 'no leader yet', dash: true});
    expect(f.lead.after).deep.eq({key: 'you', cube: BLUE});
  });

  it('the party effect is a panel fact ONLY on the edge — the delegate that grants it', () => {
    const edge = facts(slotVm({viewerVotes: 1, projection: projection({unlocksEffect: true})}), partyVm({access: {party: PartyName.GREENS, ruling: false, delegates: 1, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false}}));
    expect(edge.access.before).deep.eq({key: '${0} of ${1}', params: ['1', '2']});
    expect(edge.access.after).deep.eq({key: 'effect is yours'});
    expect(edge.access).deep.include({unchanged: false, tone: 'gain', note: 'two of your delegates'});
    expect(panelFactsOf(edge).map((x) => x.id), 'on the edge: three facts').deep.eq(['lead', 'win', 'access']);

    const first = facts(slotVm({projection: projection()}), partyVm());
    expect(first.access.after).deep.eq({key: '${0} of ${1}', params: ['1', '2']});
    expect(first.access.tone).eq('keep');
    expect(panelFactsOf(first).map((x) => x.id), 'the first delegate: the places under the card say 1/2').deep.eq(['lead', 'win']);

    const held = facts(slotVm({projection: projection()}), partyVm({ruling: true, access: {party: PartyName.GREENS, ruling: true, delegates: 0, byDelegates: false, granted: [], hasEffect: true, satisfiesRequirement: true}}));
    expect(held.access).deep.include({unchanged: true, tone: 'keep', note: 'already yours: the party rules'});
    expect(panelFactsOf(held).map((x) => x.id), 'already held for another reason: not a fact of this vote').deep.eq(['lead', 'win']);
  });

  it('in the air the snapshot holds the pre-vote side; landed, the live model reads on both sides', () => {
    const live = slotVm({votes: [{owner: BLUE, seq: 3}], totalVotes: 1, leader: BLUE, isWinning: true, viewerVotes: 1});
    const inAir = facts(live, partyVm(), {snapshot: {leader: undefined, winning: false}, forecast: undefined, mineBefore: 0, mineAfter: 1});
    expect(inAir.lead.before).deep.eq({key: 'no leader yet', dash: true});
    expect(inAir.lead.after).deep.eq({key: 'you', cube: BLUE});
    expect(inAir.win).deep.include({unchanged: false, tone: 'gain'});
    const landed = facts(live, partyVm(), {snapshot: {leader: undefined, winning: false}, forecast: undefined, landed: true, mineBefore: 0, mineAfter: 1});
    expect(landed.lead.after).deep.eq({key: 'you', cube: BLUE});
    expect(landed.win.after).deep.eq({key: 'yes'});
  });

  it('the inspector\'s footer: the leader and the winning state as the panel\'s own rows — never a sentence, and never the access (the status chip projects that edge)', () => {
    const slot = slotVm({votes: [{owner: RED, seq: 1}], totalVotes: 1, leader: RED, projection: projection({votesAfter: 2, unlocksEffect: true}), viewerVotes: 1});
    const all = facts(slot, partyVm({access: {party: PartyName.GREENS, ruling: false, delegates: 1, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false}}));
    const text = (key: string, params?: ReadonlyArray<string>) => (params ?? []).reduce<string>((acc, p, i) => acc.split('${' + i + '}').join(p), key);
    const footer = footerFactsOf(all);
    expect(footer.map((f) => f.id), 'the leader, then the winning state — the edge is the status chip\'s').deep.eq(['lead', 'win']);
    expect(footer[0]).eq(all.lead);
    expect(footer[1]).eq(all.win);
    expect(all.access.tone, 'the edge stands in the facts for the panel').eq('gain');
    expect(factValueText({key: 'name:red', raw: true}, text)).eq('name:red');
  });
});

// ── the panel and its budget ────────────────────────────────────────────────

describe('voteInfoModel — the panel', () => {
  it('composes the reading, the source with the server\'s price and the panel\'s facts; the budget counts what is printed', () => {
    const slot = slotVm({resolutionId: CLIMATE, resolution: shipped(CLIMATE), instance: `${CLIMATE}#0`, projection: projection()});
    const m = model([seat(2, {production: {[Resource.HEAT]: 4}})]);
    const vm = voteInfoOf({
      slot, resolution: shipped(CLIMATE), model: m, subject: BLUE, tableau: [], name: 'Climate Research', winning: false,
      source: 'reserve', cost: 5, facts: facts(slot, partyVm()), numbers: {votesBefore: 0, votesAfter: 1, mineBefore: 0, mineAfter: 1},
    });
    expect(vm.vote).deep.include({source: 'reserve', cost: 5});
    expect(vm.vote.facts.map((f) => f.id)).deep.eq(['lead', 'win']);
    expect(vm.reading.suffixes.length).eq(2);
    const budget = voteInfoBudget(vm);
    expect(budget).deep.include({kickers: 2, readings: 1, facts: 2});
    // English keys: «For you when enacted» · 2 × «if you win step» · «Greens» · «Your vote» · «from the reserve M€» · «Leader you» · «Winning no yes».
    expect(budget.words).eq(4 + 2 * 4 + 1 + 2 + 4 + 2 + 3);
  });

  it('a lobby delegate is free whatever cost the caller passes', () => {
    const slot = slotVm({projection: projection()});
    const vm = voteInfoOf({
      slot, resolution: shipped(AQUIFER), model: model([seat(1)]), subject: BLUE, tableau: TABLEAU_WITH_FISH, name: 'Aquifer Contest', winning: true,
      source: 'lobby', cost: 5, facts: facts(slot, partyVm()), numbers: {votesBefore: 0, votesAfter: 1, mineBefore: 0, mineAfter: 1},
    });
    expect(vm.vote.cost).eq(0);
    expect(voteInfoBudget(vm).readings).eq(1);
  });
});
