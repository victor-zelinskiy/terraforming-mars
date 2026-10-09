import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsolePartyPlaque from '@/client/components/console/parliament/ConsolePartyPlaque.vue';
import ConsolePartyEffectsStrip from '@/client/components/console/ConsolePartyEffectsStrip.vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {ParliamentModel, ParliamentPlayerModel, ParliamentSlotModel, PartyAccessModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {
  accessReasonRows, buildParliamentView, effectDelegatesLowered, effectDelegatesOf, effectDelegatesSourceOf, ParliamentPartyVm, ParliamentSlotVm,
  PARTY_EFFECT_PLACES, partyStateOf, PartyStateVm, voteAccessOf, voteForecastOf, voteForecastRows,
} from '@/client/console/parliament/consoleParliamentModel';
import {resolutionStatusOf} from '@/client/console/parliament/resolutionInspectModel';
import {partyAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {voteFactsOf} from '@/client/console/parliament/voteInfoModel';
import {translateMessage} from '@/client/directives/i18n';
import {getPartyEffect} from '@/client/parliament/ClientParliamentManifest';

/*
 * THE LAW OF ACCESS, LOWERED (TR36 Council Seat — «you only need 1 delegate»).
 *
 * The threshold of the delegates road is the SERVER's number per seat
 * (`PartyAccessModel.effectDelegates`) and every client surface reads it
 * through ONE helper — so a seat whose card lowered it sees ONE live place
 * and ONE void one, «1/1», the held word, the card quoted in every phrase —
 * while every other seat (and every older fixture without the field) keeps
 * the printed two. The guard `parliamentThresholdGuard.spec` pins that no
 * surface decides by the constant; this spec pins what each decides BY the
 * model's number.
 */
const BLUE: Color = 'blue';
const SEAT = CardName.COUNCIL_SEAT;
const S = PartyName.SCIENTISTS;
const GRID = 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID';

function access(over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party: S, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

/** The owner of the card: threshold 1, the card named — with `delegates` cubes on the party's card. */
function lowered(delegates: number, over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return access({delegates, effectDelegates: 1, effectDelegatesBy: SEAT, byDelegates: delegates >= 1, hasEffect: delegates >= 1, satisfiesRequirement: delegates >= 2, ...over});
}

function party(over: Partial<ParliamentPartyVm> = {}): ParliamentPartyVm {
  return {party: S, effect: getPartyEffect(S), rule: 'r', support: 0, inArea: true, ruling: false, access: undefined, actionId: undefined, action: undefined, ...over};
}

function slotVm(over: Partial<ParliamentSlotVm> = {}): ParliamentSlotVm {
  return {
    instance: 'RDX_SCIENTISTS_1#0', resolutionId: 'RDX_SCIENTISTS_1', resolution: undefined, party: S,
    votes: [], totalVotes: 0, leader: undefined, leaderVotes: 0, isWinning: false, tiePriority: 1, viewerVotes: 0, viewerEffectDelegates: 1, projection: undefined, ...over,
  };
}

describe('the lowered law of access (TR36) — the ONE client reading', () => {
  it('`effectDelegatesOf` is the model\'s number; a fixture without the field reads the printed two; the source is the card\'s translated name', () => {
    expect(effectDelegatesOf(undefined)).to.eq(PARTY_EFFECT_PLACES);
    expect(effectDelegatesOf(access())).to.eq(2);
    expect(effectDelegatesOf(lowered(0))).to.eq(1);
    expect(effectDelegatesLowered(access())).to.eq(false);
    expect(effectDelegatesLowered(lowered(0))).to.eq(true);
    expect(effectDelegatesSourceOf(access()), 'the printed law quotes no card').to.eq('');
    expect(effectDelegatesSourceOf(lowered(0))).to.eq('Council Seat');
  });

  it('the tile\'s state: ONE cube under the lowered law is «Your effect · 1 delegate», two cubes keep the printed line; the state carries the threshold', () => {
    const one = partyStateOf(party({access: lowered(1)}), false);
    expect(one).to.deep.include({kind: 'delegates', label: 'Your effect · 1 delegate', held: true, delegates: 1, effectDelegates: 1});
    const two = partyStateOf(party({access: lowered(2)}), false);
    expect(two).to.deep.include({kind: 'delegates', label: 'Your effect · 2 delegates', effectDelegates: 1});
    const printed = partyStateOf(party({access: access({delegates: 2, byDelegates: true, hasEffect: true, satisfiesRequirement: true})}), false);
    expect(printed).to.deep.include({kind: 'delegates', label: 'Your effect · 2 delegates', effectDelegates: 2});
    expect(partyStateOf(party({access: lowered(0)}), false)).to.deep.include({kind: 'in-area', effectDelegates: 1});
    expect(partyStateOf(party({access: undefined}), false).effectDelegates, 'no access row — the printed law').to.eq(2);
  });

  it('the access reasons quote the card: holds by ONE cube, lacks with ONE cube enough, the requirement\'s note in the threshold\'s own words', () => {
    const ctx = {party: S as ReduxParty, enactedEmpty: true, enactedName: undefined, inArea: true};
    const held = accessReasonRows(lowered(1), ctx);
    expect(held.map((r) => [r.key, r.params, r.tone])).to.deep.eq([
      ['You have it: one of your delegates is on its resolution (${0}: one is enough)', ['Council Seat'], 'holds'],
      ['Card requirement of this party: not met — one delegate opens the effect, the requirement still asks for two', [], 'note'],
    ]);
    const twoCubes = accessReasonRows(lowered(2), ctx);
    expect(twoCubes.map((r) => r.key), 'two cubes: the printed road holds it and the requirement is met').to.deep.eq([
      'You have it: two of your delegates are on its resolution',
      'Card requirement of this party: met',
    ]);
    const lacks = accessReasonRows(lowered(0), ctx);
    expect(lacks.map((r) => [r.key, r.params])).to.deep.eq([['You do not have it — one of your delegates on its resolution would grant it (${0})', ['Council Seat']]]);
    expect(accessReasonRows(lowered(0), {...ctx, inArea: false})[0].key).to.contain('no resolution in the vote');
    // The printed law's phrases are untouched (they are right at two).
    expect(accessReasonRows(access(), ctx)[0].key).to.eq('You do not have it — two of your delegates on its resolution would grant it');
    expect(accessReasonRows(access({granted: ['Septem Tribus'], hasEffect: true}), ctx).map((r) => r.key)).to.deep.eq([
      'You have it: granted by ${0}', 'Card requirement of this party: not met — a granted effect does not count',
    ]);
  });

  it('the vote\'s access reading: the threshold is the viewer\'s own — the first cube is the edge, the second changes nothing about the effect', () => {
    const edge = voteAccessOf(slotVm({viewerVotes: 0}), party({access: lowered(0)}), 1);
    expect(edge).to.deep.include({threshold: 1, before: 0, after: 1, heldByOther: false});
    const past = voteAccessOf(slotVm({viewerVotes: 1}), party({access: lowered(1)}), 2);
    expect(past, 'held BY DELEGATES — never «held by another road»').to.deep.include({threshold: 1, before: 1, after: 2, heldByOther: false});
    const facts = voteFactsOf({slot: slotVm({viewerVotes: 1}), party: party({access: lowered(1)}), viewer: BLUE, forecast: undefined, snapshot: undefined, landed: false, mineBefore: 1, mineAfter: 2, nameOf: (c) => c});
    expect(facts.access.unchanged, 'the «1 → 2» vote draws no second place and no edge').to.eq(true);
    expect(facts.access.tone).to.eq('keep');
    const first = voteFactsOf({slot: slotVm({viewerVotes: 0}), party: party({access: lowered(0)}), viewer: BLUE, forecast: undefined, snapshot: undefined, landed: false, mineBefore: 0, mineAfter: 1, nameOf: (c) => c});
    expect(first.access).to.deep.include({tone: 'gain', unchanged: false, note: 'one of your delegates'});
    expect(first.access.before).to.deep.include({key: '${0} of ${1}', params: ['0', '1']});
    expect(first.access.after).to.deep.include({key: 'effect is yours'});
  });

  it('the forecast chip names the card under the lowered law and keeps the printed wording otherwise', () => {
    const projection = {instance: 'RDX_SCIENTISTS_1#0', votesAfter: 1, leaderAfter: BLUE, viewerLeads: true, becomesWinning: false, unlocksEffect: true, unlocksRequirement: false};
    const f = voteForecastOf(slotVm({projection}), BLUE, {available: true, reason: '', source: 'lobby', cost: 0, projections: []});
    const chip = voteForecastRows(f, false, lowered(0)).find((r) => r.key.startsWith('Unlocks the party effect'));
    expect(chip).to.deep.include({key: 'Unlocks the party effect for you (1 delegate — ${0})', params: ['Council Seat'], tone: 'gain'});
    const printed = voteForecastRows(f, false, access()).find((r) => r.key.startsWith('Unlocks the party effect'));
    expect(printed?.key).to.eq('Unlocks the party effect for you (2 delegates)');
    expect(voteForecastRows(f, true, lowered(0)).some((r) => r.key === 'party effect: yours'), 'the compact rail says the same fact').to.eq(true);
  });

  it('the inspector\'s footer: ONE place at threshold 1 — held by that one cube, «0/1» before it', () => {
    const slot = (votes: ReadonlyArray<{owner: Color, seq: number}>): ParliamentSlotModel =>
      ({instance: `${GRID}#0`, resolution: GRID, party: PartyName.INDUSTRIALISTS, votes, totalVotes: votes.length, leader: undefined, isWinning: false, tiePriority: 1, viewerVotes: votes.length});
    const model = (s: ParliamentSlotModel, a: PartyAccessModel): ParliamentModel => ({
      slots: [s], rulingParty: PartyName.GREENS, popularSupport: {},
      players: [{color: BLUE, participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0, access: [a], partyActionUses: {}, resolutionActionUses: 0}],
      deckSize: 0, discardSize: 0, neutralSupply: 0, botMode: 'none',
    } as unknown as ParliamentModel);
    const held = resolutionStatusOf(GRID, model(slot([{owner: BLUE, seq: 1}]), lowered(1, {party: PartyName.INDUSTRIALISTS})), BLUE);
    expect(held?.access).to.deep.include({kind: 'held', basis: 'delegates', mine: 1, threshold: 1, places: true});
    const progress = resolutionStatusOf(GRID, model(slot([]), lowered(0, {party: PartyName.INDUSTRIALISTS})), BLUE);
    expect(progress?.access).to.deep.include({kind: 'progress', mine: 0, threshold: 1, places: true});
    const printed = resolutionStatusOf(GRID, model(slot([{owner: BLUE, seq: 1}]), access({party: PartyName.INDUSTRIALISTS, delegates: 1})), BLUE);
    expect(printed?.access).to.deep.include({kind: 'progress', mine: 1, threshold: 2});
  });

  it('the view hands every slot the viewer\'s threshold for ITS party', () => {
    const slots: Array<ParliamentSlotModel> = [
      {instance: 'RDX_SCIENTISTS_1#0', resolution: 'RDX_SCIENTISTS_1', party: S, votes: [], totalVotes: 0, leader: undefined, isWinning: false, tiePriority: 1, viewerVotes: 0},
      {instance: `${GRID}#0`, resolution: GRID, party: PartyName.INDUSTRIALISTS, votes: [], totalVotes: 0, leader: undefined, isWinning: false, tiePriority: 2, viewerVotes: 0},
    ];
    const seat = (accessRows: Array<PartyAccessModel>): ParliamentPlayerModel => ({
      color: BLUE, participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0, access: accessRows, partyActionUses: {}, resolutionActionUses: 0,
    });
    const model = {slots, rulingParty: PartyName.GREENS, popularSupport: {}, players: [seat([lowered(0), access({party: PartyName.INDUSTRIALISTS})])], deckSize: 0, discardSize: 0, neutralSupply: 0, botMode: 'none'} as unknown as ParliamentModel;
    const view = buildParliamentView(model, BLUE, []);
    expect(view.slots.map((s) => s.viewerEffectDelegates)).to.deep.eq([1, 2]);
    expect(buildParliamentView(model, undefined, []).slots.map((s) => s.viewerEffectDelegates), 'a spectator: the printed law').to.deep.eq([2, 2]);
  });
});

describe('the party inspector\'s reference block speaks the viewer\'s own law (PL-113)', () => {
  const modelWith = (a: PartyAccessModel): ParliamentModel => ({
    slots: [{instance: 'RDX_SCIENTISTS_1#0', resolution: 'RDX_SCIENTISTS_1', party: S, votes: [], totalVotes: 0, leader: undefined, isWinning: false, tiePriority: 1, viewerVotes: a.delegates}],
    rulingParty: PartyName.GREENS, popularSupport: {},
    players: [{color: BLUE, participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0, access: [a], partyActionUses: {}, resolutionActionUses: 0}],
    deckSize: 0, discardSize: 0, neutralSupply: 0, botMode: 'none',
  } as unknown as ParliamentModel);
  const reference = (a: PartyAccessModel) => partyAnnotations(S, modelWith(a), BLUE).find((b) => b.id === 'group:access')?.rows[0];

  it('the printed two for the printed law; one delegate and the card under the lowered law — the «for you» rows quote the card too', () => {
    expect(reference(access())).to.deep.include({text: 'The ruling party\'s effect is everyone\'s. A party with two of your delegates on its resolution gives you its effect too.'});
    expect(reference(lowered(1))).to.deep.include({
      text: 'The ruling party\'s effect is everyone\'s. A party with one of your delegates on its resolution gives you its effect too (${0}).', params: ['Council Seat'],
    });
    const you = partyAnnotations(S, modelWith(lowered(1)), BLUE).find((b) => b.id === 'group:you')?.rows.map((r) => r.text);
    expect(you).to.deep.eq([
      'You have it: one of your delegates is on its resolution (${0}: one is enough)',
      'Card requirement of this party: not met — one delegate opens the effect, the requirement still asks for two',
    ]);
  });
});

describe('ConsolePartyPlaque — the places under the lowered law', () => {
  const state = (over: Partial<PartyStateVm>): PartyStateVm => ({kind: 'in-area', label: 'In the vote', params: [], tone: 'cyan', held: false, delegates: 0, effectDelegates: 2, ...over});
  function places(st: PartyStateVm) {
    const w = mount(ConsolePartyPlaque, {...globalConfig, props: {party: S, state: st, viewerColor: BLUE, formula: false}});
    const block = w.find('.con-pseal__places');
    expect(block.exists(), 'the places are drawn for a party in the vote').is.true;
    const all = block.findAll('.con-pseal__place');
    return {
      live: block.attributes('data-pseal-places'),
      count: block.find('.con-pseal__places-count').text(),
      places: all.length,
      on: all.filter((p) => p.classes().includes('con-pseal__place--on')).map((p) => Number(p.attributes('data-pseal-place'))),
      void: all.filter((p) => p.classes().includes('con-pseal__place--void')).map((p) => Number(p.attributes('data-pseal-place'))),
      cubes: block.findAllComponents({name: 'PlayerCube'}).length,
      word: w.find('.con-pseal__state-text').exists() ? w.find('.con-pseal__state-text').text() : '',
      held: w.find('.con-pseal__state-text--held').exists(),
    };
  }

  it('the printed law: two live places, «1/2», no void', () => {
    const s = places(state({kind: 'progress', label: '${0} of 2 delegates', params: ['1'], delegates: 1}));
    expect(s).to.deep.include({live: '2', count: '1/2', places: 2, on: [1], void: [], cubes: 1, word: '', held: false});
  });

  it('the lowered law with no cube: ONE live place, the second VOID and in the flow, «0/1»', () => {
    const s = places(state({effectDelegates: 1}));
    expect(s).to.deep.include({live: '1', count: '0/1', places: 2, on: [], void: [2], cubes: 0});
  });

  it('the lowered law with one cube: the one place lit, «1/1», the held word standing — a tile mounted holding plays no entry', () => {
    const s = places(state({kind: 'delegates', label: 'Your effect · 1 delegate', tone: 'mint', held: true, delegates: 1, effectDelegates: 1}));
    expect(s).to.deep.include({live: '1', count: '1/1', places: 2, on: [1], void: [2], cubes: 1, word: 'Your effect', held: false});
  });

  it('the held word ENTERS as a phrase only for a change the standing tile witnessed (K-2 — the class of every road)', async () => {
    const w = mount(ConsolePartyPlaque, {...globalConfig, props: {party: S, state: state({effectDelegates: 1}), viewerColor: BLUE, formula: false}});
    expect(w.find('.con-pseal__state-text').exists(), 'no word while the effect is not held').is.false;
    await w.setProps({state: state({kind: 'delegates', label: 'Your effect · 1 delegate', tone: 'mint', held: true, delegates: 1, effectDelegates: 1})});
    expect(w.find('.con-pseal__state-text').text()).to.eq('Your effect');
    expect(w.find('.con-pseal__state-text--held').exists(), 'the entry class — the word arrived on a standing tile').is.true;
    expect(w.find('.con-pseal__places-count').text()).to.eq('1/1');
    expect(w.findAll('.con-pseal__place--on').length).to.eq(1);
  });

  it('two cubes under the lowered law never light the void place — the count clamps to the live one', () => {
    const s = places(state({kind: 'delegates', label: 'Your effect · 2 delegates', tone: 'mint', held: true, delegates: 2, effectDelegates: 1}));
    expect(s).to.deep.include({count: '1/1', on: [1], void: [2], cubes: 1});
  });
});

describe('ConsolePartyEffectsStrip — the rule under the kicker names the seat\'s own law', () => {
  function strip(accessRows: Array<PartyAccessModel>) {
    const model = {
      slots: [], enacted: undefined, rulingParty: PartyName.GREENS, popularSupport: {},
      players: [{color: BLUE, participates: true, lobby: true, reserve: 5, onResolutions: 0, chairman: false, agenda: 0, influence: 0, access: accessRows, partyActionUses: {}, resolutionActionUses: 0}],
      deckSize: 0, discardSize: 0, neutralSupply: 0,
    } as unknown as ParliamentModel;
    return mount(ConsolePartyEffectsStrip, {...globalConfig, props: {parliament: model, color: BLUE}});
  }
  const printedRows = (): Array<PartyAccessModel> => REDUX_PARTIES.map((p) => access({party: p, ruling: p === PartyName.GREENS, hasEffect: p === PartyName.GREENS, satisfiesRequirement: p === PartyName.GREENS}));

  it('the printed two for a seat without the card; one delegate and the card for the owner — and the owner\'s single-cube row reads the card\'s line', () => {
    const w = strip(printedRows());
    expect(w.find('.con-pfx__sub').text()).to.eq('From the Parliament: the ruling party and every party with two of this player\'s delegates');
    const owner = strip(printedRows().map((a) => (a.party === S ? lowered(1) : {...a, effectDelegates: 1, effectDelegatesBy: SEAT})));
    expect(owner.find('.con-pfx__sub').text()).to.eq('From the Parliament: the ruling party and every party with one of this player\'s delegates (Council Seat)');
    const row = owner.find(`.con-pfx__item[data-party="${S}"]`);
    expect(row.exists()).is.true;
    expect(row.findAll('.con-pfx__reason').map((r) => r.text())).to.deep.eq([
      'You have it: one of your delegates is on its resolution (Council Seat: one is enough)',
      'Card requirement of this party: not met — one delegate opens the effect, the requirement still asks for two',
    ]);
  });
});

describe('translateMessage — a PARTY token speaks the parliament\'s glossary key (PL-109)', () => {
  it('renders the party by its `party name:` key where it is translated, and by the bare name otherwise', () => {
    // Under the test i18n nothing is translated: the bare name stands — never the raw `party name: …` key.
    const text = translateMessage({message: 'Opens the ${0} party effect now: your delegate stands on ${1}', data: [
      {type: LogMessageDataType.PARTY, value: S},
      {type: LogMessageDataType.RESOLUTION, value: 'RDX_INDUSTRIALISTS_CENTRAL_POWER_GRID'},
    ]});
    expect(text).to.not.contain('party name:');
    expect(text).to.contain('Scientists');
    expect(text).to.contain('party effect now');
  });
});
