import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {PartyName} from '@/common/turmoil/PartyName';
import {Tag} from '@/common/cards/Tag';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPhaseSummaryModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {InfluenceScaledEffect} from '@/common/parliament/influenceScaling';
import {rewardAddressOf} from '@/common/parliament/rewardAddress';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import ConsoleYieldUnit from '@/client/components/console/parliament/ConsoleYieldUnit.vue';
import {
  cardResourceIconKey, holdsAnyOf, noRecipientCompactNoteOf, noRecipientForecastKey, noRecipientNoteOf, noRecipientReasonKey, scaledEffectForCardResource,
  voteYieldsOf, yieldCountPresentation, yieldIconOf,
} from '@/client/console/parliament/influenceYieldModel';
import {detectResolutionPayout} from '@/client/console/parliament/consoleResolutionPayout';
import {resultsReadingOf} from '@/client/console/parliament/parliamentResultsModel';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';

/**
 * MEDICAL DATABASE (Turmoil Redux, RX18) — THE READINGS OF A UNIT OF TWO
 * KINDS («data or microbe»). What is pinned on the client: the manifest
 * declares the unit as a LIST of kinds with the science-tag count; the count
 * presents as the printed science TAG medallion with its own rule and skip;
 * the unit's icon is BOTH kinds, drawn as ONE unit joined by «or» in the
 * formula and in the result (Cloud Development keeps its one icon and no
 * «or»); the honest «no recipient» note reads the holders of EITHER kind and
 * names both; a picker over either icon finds the effect; a MIXED record flies
 * one chip per card wearing that card's own kind; the address payload and the
 * results carry the kinds and each card's own.
 */
const MEDICAL_ID = 'RDX_SCIENTISTS_MEDICAL_DATABASE';
const CLOUD_ID = 'RDX_UNITY_CLOUD_DEVELOPMENT';
const BLUE = 'blue' as Color;
const VAULT = CardName.MARTIAN_CULTURE; // a Pathfinders DATA holder — the branch the premium scope has no card for

function seat(color: Color, agenda: number, influence: number, counts: ParliamentPlayerModel['counts']): ParliamentPlayerModel {
  return {color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence, access: [], partyActionUses: {}, resolutionActionUses: 0, counts};
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

function view(p: ParliamentModel, waitingFor?: unknown): PlayerViewModel {
  return {thisPlayer: {color: BLUE}, game: {parliament: p}, waitingFor} as unknown as PlayerViewModel;
}

function phase(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel>): ParliamentModel {
  return model([], {phase: {generation: 3, final: false, step: 'effects', outcomes}});
}

const medical = (): NonNullable<ReturnType<typeof getResolution>> => {
  const resolution = getResolution(MEDICAL_ID);
  if (resolution === undefined) {
    throw new Error(`${MEDICAL_ID} is not in the client manifest`);
  }
  return resolution;
};

const t = {global: {mocks: {$t: (key: string) => key}}};

/** The shared distribution's marked `and` over BOTH kinds, as the server stamps it (Tardigrades a microbe holder, Martian Culture a data holder). */
const spread = {
  type: 'and', title: 'Place 4 resource(s) on your cards', buttonLabel: 'Confirm',
  options: [{type: 'amount', title: CardName.TARDIGRADES, min: 0, max: 4}, {type: 'amount', title: VAULT, min: 0, max: 4}],
  cardResourceDistributionPrompt: {
    amount: 4, cardResources: ['data', 'microbe'], cardResourceByCard: {[CardName.TARDIGRADES]: 'microbe', [VAULT]: 'data'},
    cards: [{name: CardName.TARDIGRADES}, {name: VAULT}],
  },
  choiceContext: {source: {kind: 'resolution', resolution: MEDICAL_ID}, mode: 'reward'},
};

/** The server's record of a MIXED landing: no single kind, the kinds, every card's own. */
const mixed: ParliamentEnactOutcomeModel = {
  player: BLUE, step: 'resources', effect: 'resources', kind: 'cardResource', amount: 4, influence: 1, count: 3,
  resources: [CardResource.DATA, CardResource.MICROBE],
  cards: [{card: CardName.TARDIGRADES, amount: 3, resource: CardResource.MICROBE}, {card: VAULT, amount: 1, resource: CardResource.DATA}],
};

describe('Medical Database — the readings of a unit of two kinds', () => {
  it('the manifest declares the unit as a LIST of kinds (data, microbe) with the science-tag count, spread; the family is the distributed one', () => {
    const resolution = medical();
    expect(resolution.code).eq('RX18');
    expect(resolution.party).eq(PartyName.SCIENTISTS);
    expect(resolution.scaled).has.length(1);
    const effect = resolution.scaled![0];
    expect(effect.unit).deep.eq({kind: 'cardResource', resources: [CardResource.DATA, CardResource.MICROBE], spread: true});
    expect(effect.count).deep.eq({id: 'scienceTags', per: 1});
    expect(effect.perInfluence).eq(1);
    expect(effect.cap).is.undefined;
    expect(resolution.quest).deep.eq({goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2});
    expect(familyOf(resolution)).eq('distributed');
  });

  it('the science-tag count presents as the printed TAG medallion, with its own plural, rule and skip', () => {
    expect(yieldCountPresentation('scienceTags')).deep.eq({
      glyph: {kind: 'tag', tag: Tag.SCIENCE},
      pluralKey: '${0} science tag(s)',
      ruleKey: 'Each science tag counts: a card with two science tags counts twice. Wild tags do not count.',
      skipReasonKey: 'No science tags and no influence',
    });
  });

  it('the unit\'s icon is BOTH kinds; a picker naming either icon — or the list — finds the effect, a floater does not', () => {
    const resolution = medical();
    const effect = resolution.scaled![0];
    expect(yieldIconOf(effect)).deep.eq({family: 'card-resource', resources: [CardResource.DATA, CardResource.MICROBE]});
    expect(cardResourceIconKey(CardResource.DATA)).eq('data');
    expect(scaledEffectForCardResource(resolution, 'microbe')).eq(effect);
    expect(scaledEffectForCardResource(resolution, 'data')).eq(effect);
    expect(scaledEffectForCardResource(resolution, ['data', 'microbe'])).eq(effect);
    expect(scaledEffectForCardResource(resolution, 'floater')).is.undefined;
    expect(scaledEffectForCardResource(resolution, [])).is.undefined;
    expect(scaledEffectForCardResource(getResolution(CLOUD_ID), ['data', 'microbe']), 'the floater card is not found by these').is.undefined;
  });

  it('the honest «no recipient» note reads the holders of EITHER kind and names both kinds; the skip reason is the server\'s own', () => {
    const effect = medical().scaled![0];
    const both: ReadonlyArray<CardResource> = [CardResource.DATA, CardResource.MICROBE];
    expect(holdsAnyOf([{name: CardName.TARDIGRADES}], both), 'a microbe holder').is.true;
    expect(holdsAnyOf([{name: VAULT}], both), 'a data holder').is.true;
    expect(holdsAnyOf([{name: CardName.FISH}, {name: CardName.RESEARCH}], both), 'an animal holder and a science tag are neither').is.false;
    expect(noRecipientNoteOf(effect, [{name: CardName.TARDIGRADES}])).is.undefined;
    expect(noRecipientNoteOf(effect, [{name: VAULT}])).is.undefined;
    expect(noRecipientNoteOf(effect, [{name: CardName.FISH}, {name: CardName.RESEARCH}])).eq('no eligible card — the data or microbes would be forfeited');
    expect(noRecipientCompactNoteOf(effect, [{name: CardName.RESEARCH}])).eq('No card can hold data or microbes');
    expect(noRecipientReasonKey(both)).eq('No card can hold data or microbes');
    expect(noRecipientForecastKey(both)).eq('no eligible card — the data or microbes would be forfeited');
    // The one-kind copy is untouched.
    expect(noRecipientReasonKey([CardResource.FLOATER])).eq('No card can hold floaters');
    expect(noRecipientForecastKey([CardResource.ANIMAL])).eq('no eligible card — the animals would be forfeited');
    expect(noRecipientReasonKey([CardResource.DATA])).eq('No card can hold data');
  });

  it('the BLOCK draws the two kinds as ONE unit joined by «or» — in the formula and in the result; Cloud Development keeps one icon and no «or»', () => {
    const counts: ParliamentPlayerModel['counts'] = [{id: 'scienceTags', count: 3, cards: [CardName.RESEARCH, CardName.GHG_PRODUCING_BACTERIA], units: [2, 1]}];
    const yields = voteYieldsOf(medical(), model([seat(BLUE, 3, 2, counts)]), BLUE);
    expect(yields[0]).deep.include({context: 'estimate', influence: 2, count: 3, amount: 5});
    const wrapper = mount(ConsoleInfluenceYield, {props: {yields, formula: true, oneNumber: true, captions: false}, ...t});
    const formula = wrapper.find('[data-yield-effect="resources"] .con-iyield__formula');
    expect(formula.findAll('.con-iyield__unit').map((u) => u.classes().join(' '))).deep.eq([
      'con-iyield__unit card-resource card-resource-data', 'con-iyield__unit card-resource card-resource-microbe',
    ]);
    expect(formula.findAll('.con-iyield__or').map((o) => o.text())).deep.eq(['or']);
    expect(formula.find('.con-iyield__glyph').exists(), 'the science tag medallion is the counted object').is.true;
    const result = wrapper.find('[data-yield-effect="resources"] .con-iyield__out');
    expect(result.find('b').text()).eq('+5');
    expect(result.findAll('.con-iyield__unit').map((u) => u.attributes('data-yield-unit-kind'))).deep.eq(['0', '1']);
    expect(result.find('.con-iyield__or').text()).eq('or');
    // The one-kind card: the very `<i>` it always printed, no «or».
    const cloudCounts: ParliamentPlayerModel['counts'] = [{id: 'venusJovianTags', count: 2, cards: [CardName.DIRIGIBLES, CardName.JOVIAN_LANTERNS], units: [1, 1], byTag: [{tag: Tag.VENUS, count: 1}, {tag: Tag.JOVIAN, count: 1}]}];
    const cloud = mount(ConsoleInfluenceYield, {props: {yields: voteYieldsOf(getResolution(CLOUD_ID)!, model([seat(BLUE, 3, 2, cloudCounts)]), BLUE), formula: true, oneNumber: true, captions: false}, ...t});
    expect(cloud.findAll('.con-iyield__formula .con-iyield__unit')).has.length(1);
    expect(cloud.find('.con-iyield__or').exists()).is.false;
    expect(cloud.find('.con-iyield__out .con-iyield__unit').attributes('data-yield-unit-kind')).is.undefined;
  });

  it('the unit component alone: one class is one bare icon, several are icons joined by «or» with a host\'s extra class on each', () => {
    const one = mount(ConsoleYieldUnit, {props: {classes: ['card-resource card-resource-floater'], extra: 'x'}, ...t});
    expect(one.html().trim()).eq('<i class="con-iyield__unit card-resource card-resource-floater x" aria-hidden="true"></i>');
    expect(one.findAll('*'), 'the bare icon, no wrapper').has.length(1);
    const two = mount(ConsoleYieldUnit, {props: {classes: ['a', 'b'], extra: 'x'}, ...t});
    expect(two.findAll('.con-iyield__unit').map((u) => u.classes().join(' '))).deep.eq(['con-iyield__unit a x', 'con-iyield__unit b x']);
    expect(two.findAll('.con-iyield__or')).has.length(1);
  });

  it('a MIXED payout flies one chip per recipient wearing ITS card\'s kind; a record over kinds with no kind on a card is not flown', () => {
    const before = view(phase([]), spread);
    const after = view(phase([mixed]));
    expect(detectResolutionPayout(before, after)).deep.eq({
      targets: [{card: CardName.TARDIGRADES, amount: 3, resource: 'microbe'}, {card: VAULT, amount: 1, resource: 'data'}],
      amount: 4, resolution: MEDICAL_ID,
    });
    // Every unit of ONE kind: the record names it, and every target reads it.
    const oneKind: ParliamentEnactOutcomeModel = {...mixed, resource: CardResource.MICROBE, cards: [{card: CardName.TARDIGRADES, amount: 4, resource: CardResource.MICROBE}], card: CardName.TARDIGRADES};
    expect(detectResolutionPayout(before, view(phase([oneKind])))).deep.eq({
      targets: [{card: CardName.TARDIGRADES, amount: 4, resource: 'microbe'}], resource: 'microbe', amount: 4, resolution: MEDICAL_ID,
    });
    // A record that names neither the one kind nor each card's: nothing can wear an honest icon — nothing flies.
    const kindless: ParliamentEnactOutcomeModel = {...mixed, cards: [{card: CardName.TARDIGRADES, amount: 3}, {card: VAULT, amount: 1}]};
    expect(detectResolutionPayout(before, view(phase([kindless])))).is.undefined;
  });

  it('the address payload carries the kinds and each card\'s own; the results part reads the kinds as its unit and each share with its icon', () => {
    const delivery = rewardAddressOf(mixed, BLUE);
    expect(delivery.address.kind).eq('cardResource');
    expect(delivery.skipped).is.undefined;
    expect(delivery.payload).deep.eq({
      resources: ['Data', 'Microbe'],
      cards: [{card: CardName.TARDIGRADES, amount: 3, resource: 'Microbe'}, {card: VAULT, amount: 1, resource: 'Data'}],
      amount: 4,
    });
    const summary = {
      generation: 4, final: false,
      winner: {instance: `${MEDICAL_ID}#0`, resolution: MEDICAL_ID, party: PartyName.SCIENTISTS, votes: 2, player: BLUE, slot: 0},
      support: [], enacted: {instance: `${MEDICAL_ID}#0`, resolution: MEDICAL_ID, party: PartyName.SCIENTISTS}, refreshed: [], lobbyRefilled: [],
      outcomes: [mixed],
    } as unknown as ParliamentPhaseSummaryModel;
    const reading = resultsReadingOf(summary, [{player: BLUE, lobby: true, reserve: 3}], [{party: PartyName.SCIENTISTS, support: 0}]);
    const part = reading.payouts[0].parts[0];
    expect(part.kind).eq('cardResource');
    expect(part.unit, 'no ONE unit').eq('');
    expect(part.units).deep.eq(['Data', 'Microbe']);
    expect(part.amount).eq(4);
    expect(part.cards).deep.eq([{card: CardName.TARDIGRADES, amount: 3, resource: 'Microbe'}, {card: VAULT, amount: 1, resource: 'Data'}]);
    // The skip of the same effect names its unit by the kinds too.
    const skip: ParliamentEnactOutcomeModel = {player: BLUE, step: 'resources', effect: 'resources', kind: 'skipped', amount: 5, influence: 2, count: 3,
      resources: [CardResource.DATA, CardResource.MICROBE], reason: 'No card can hold data or microbes'};
    expect(rewardAddressOf(skip, BLUE).payload).deep.eq({resources: ['Data', 'Microbe'], amount: 5});
    expect(rewardAddressOf(skip, BLUE).skipped).eq('No card can hold data or microbes');
  });

  it('a one-kind effect is untouched by the list: Aquifer Contest reads as before', () => {
    const aquifer = getResolution('RDX_GREENS_AQUIFER_CONTEST')!;
    const effect: InfluenceScaledEffect = aquifer.scaled![0];
    expect(effect.unit).deep.eq({kind: 'cardResource', resources: [CardResource.ANIMAL]});
    expect(yieldIconOf(effect)).deep.eq({family: 'card-resource', resources: [CardResource.ANIMAL]});
    expect(noRecipientNoteOf(effect, [{name: CardName.FISH}])).is.undefined;
    expect(noRecipientNoteOf(effect, [{name: CardName.TARDIGRADES}])).eq('no eligible card — the animals would be forfeited');
  });
});
