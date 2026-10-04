import {expect} from 'chai';
import {Color} from '@/common/Color';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyName} from '@/common/colonies/ColonyName';
import {CardResource} from '@/common/CardResource';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ColonyLedgerEntryModel, ParliamentEnactedModel, ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {cardColonyLedgerOf, colonyLedgerAskKey, colonyLedgerOf, isCardLedgerContext} from '@/client/console/parliament/colonyLedgerModel';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {voteReadingOf, voteInfoBudget, voteInfoOf, VOTE_INFO_LIMITS} from '@/client/console/parliament/voteInfoModel';
import {ParliamentPartyVm, ParliamentSlotVm, voteForecastOf} from '@/client/console/parliament/consoleParliamentModel';
import {voteFactsOf} from '@/client/console/parliament/voteInfoModel';

/**
 * THE COLONY LEDGER, the client reading (Colonial Affairs, RX07): the multiplier in the yield block's own
 * grammar (the estimate and the win's forecast, or the recorded k), one row per tile of the SERVER's
 * registry, the sums; «no colonies» in words; nothing for a spectator or another resolution. Driven with
 * the SHIPPED catalog, so a re-declared card fails here.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const COLONIAL = 'RDX_UNITY_COLONIAL_AFFAIRS';
const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';

function shipped(id: string): IClientResolution {
  const r = getResolution(id);
  if (r === undefined) {
    throw new Error(`${id} is not in the client catalog`);
  }
  return r;
}

const LUNA: ColonyLedgerEntryModel = {colony: ColonyName.LUNA, grant: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 2, resource: Resource.MEGACREDITS}, description: 'Gain 2 M€', cubes: 1};
const TITAN: ColonyLedgerEntryModel = {colony: ColonyName.TITAN, grant: {benefit: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: 1, cardResource: CardResource.FLOATER}, description: 'Add 1 floater to ANY card', cubes: 1};
const PLUTO: ColonyLedgerEntryModel = {colony: ColonyName.PLUTO, grant: {benefit: ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE, quantity: 1}, description: 'Draw 1 card and then discard 1 card', cubes: 1};

function seat(color: Color, agenda: number, colonies: ReadonlyArray<ColonyLedgerEntryModel> | undefined): ParliamentPlayerModel {
  const model: ParliamentPlayerModel = {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence: influenceAtAgenda(agenda),
    access: [], partyActionUses: {}, resolutionActionUses: 0,
  };
  if (colonies !== undefined) {
    model.colonyBonuses = colonies;
  }
  return model;
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

const outcome = (over: Partial<ParliamentEnactOutcomeModel> & {kind: ParliamentEnactOutcomeModel['kind']}): ParliamentEnactOutcomeModel =>
  ({player: BLUE, step: 'colony:X', part: 'effect', effect: 'colonyBonuses', multiplier: 3, influence: 3, ...over}) as ParliamentEnactOutcomeModel;

describe('colonyLedgerModel', () => {
  it('the shipped catalog declares Colonial Affairs as the colony-bonuses family: k = 2 + 1 per 2 influence, for every player', () => {
    const r = shipped(COLONIAL);
    expect(familyOf(r)).eq('colony-bonuses');
    expect(r.scaled).deep.eq([{id: 'colonyBonuses', unit: {kind: 'colonyBonuses'}, base: 2, perInfluence: 1, influenceStep: 2, recipient: 'each'}]);
  });

  it('the VOTE: the multiplier by the current influence with the win\'s k apart, the rows multiplied, the sums — from the SERVER\'s registry', () => {
    // Agenda step 5 = influence 3 → ×3; the win takes the marker to step 6 (a TR step) → still 3, no forecast.
    const atFive = colonyLedgerOf(shipped(COLONIAL), model([seat(BLUE, 5, [LUNA, TITAN, PLUTO])]), BLUE)!;
    expect(atFive.context).eq('vote');
    expect(atFive.multiplier).eq(3);
    expect(atFive.winMultiplier, 'a TR step next: the win raises nothing').is.undefined;
    expect(atFive.yields.map((y) => `${y.context}:${y.amount}`)).deep.eq(['estimate:3']);
    expect(atFive.rows.map((r) => `${r.colony}:${r.total}`)).deep.eq(['Luna:6', 'Titan:3', 'Pluto:3']);
    expect(atFive.totals).deep.eq({stock: [{resource: Resource.MEGACREDITS, amount: 6}], production: [], cardResources: [{resource: 'Floater', amount: 3}], cards: 0, pairs: 3, other: 0});
    expect(atFive.empty).is.false;
    // Agenda step 7 = influence 3 → ×3; the win takes the marker to step 8 = influence 4 → ×4.
    const atSeven = colonyLedgerOf(shipped(COLONIAL), model([seat(BLUE, 7, [LUNA])]), BLUE)!;
    expect(atSeven.multiplier).eq(3);
    expect(atSeven.winMultiplier).eq(4);
    expect(atSeven.yields.map((y) => `${y.context}:${y.amount}`)).deep.eq(['estimate:3', 'forecast:4']);
    expect(atSeven.rows[0].total, 'the rows stand on the CURRENT k — the win is a suffix, never a second ledger').eq(6);
  });

  it('NO COLONIES: the ledger exists and says so — never an empty box; the multiplier still reads', () => {
    const none = colonyLedgerOf(shipped(COLONIAL), model([seat(BLUE, 5, [])]), BLUE)!;
    expect(none.empty).is.true;
    expect(none.rows).deep.eq([]);
    expect(none.multiplier).eq(3);
    const absent = colonyLedgerOf(shipped(COLONIAL), model([seat(BLUE, 5, undefined)]), BLUE)!;
    expect(absent.empty, 'a model without the registry reads as no colonies (the server ships it for every participant)').is.true;
  });

  it('a SPECTATOR (no seat) and another resolution get no ledger at all', () => {
    expect(colonyLedgerOf(shipped(COLONIAL), model([seat(BLUE, 5, [LUNA])]), RED)).is.undefined;
    expect(colonyLedgerOf(shipped(COLONIAL), model([seat(BLUE, 5, [LUNA])]), undefined)).is.undefined;
    expect(colonyLedgerOf(shipped(AQUIFER), model([seat(BLUE, 5, [LUNA])]), BLUE)).is.undefined;
    expect(colonyLedgerOf(undefined, model([seat(BLUE, 5, [LUNA])]), BLUE)).is.undefined;
  });

  it('ENACTED: the recorded multiplier, the rows\' states off the records (paid / skipped with its reason / pending), «this payout» while live', () => {
    const outcomes = [
      outcome({kind: 'stock', step: 'colony:Luna', colony: ColonyName.LUNA, stock: Resource.MEGACREDITS, amount: 6}),
      outcome({kind: 'skipped', step: 'colony:Titan', colony: ColonyName.TITAN, resource: CardResource.FLOATER, amount: 3, reason: 'No card can hold floaters'}),
    ];
    const enacted: ParliamentEnactedModel = {instance: `${COLONIAL}#0`, resolution: COLONIAL, party: PartyName.UNITY};
    const live = model([seat(BLUE, 5, [LUNA, TITAN, PLUTO])], {
      rulingParty: PartyName.UNITY, enacted,
      phase: {generation: 3, final: false, step: 'effects', outcomes},
    });
    const reading = colonyLedgerOf(shipped(COLONIAL), live, BLUE, {enacted: true, live: true})!;
    expect(reading.context).eq('resolving');
    expect(reading.multiplier).eq(3);
    expect(reading.yields.map((y) => `${y.context}:${y.amount}`), 'the multiplier is the record\'s k, never the first row\'s 6').deep.eq(['resolving:3']);
    expect(reading.rows.map((r) => `${r.colony}:${r.state}`)).deep.eq(['Luna:paid', 'Titan:skipped', 'Pluto:pending']);
    expect(reading.rows[1].skipped).eq('No card can hold floaters');
    expect(reading.totals.cardResources, 'a skipped row adds nothing').deep.eq([]);
    // Recorded and finished: «received».
    const done = colonyLedgerOf(shipped(COLONIAL), model([seat(BLUE, 5, [LUNA])], {rulingParty: PartyName.UNITY, enacted, lastPhase: {
      generation: 3, final: false, winner: {instance: enacted.instance, resolution: COLONIAL, party: PartyName.UNITY, votes: 2, player: BLUE},
      outcomes: [outcomes[0]], support: [], enacted, refreshed: [], lobbyRefilled: [],
    }}), BLUE, {enacted: true})!;
    expect(done.context).eq('applied');
    expect(done.yields.map((y) => `${y.context}:${y.amount}`)).deep.eq(['applied:3']);
    expect(done.rows[0].state).eq('paid');
  });

  it('ENACTED with no colonies: the one skip record reads as the multiplier\'s own skip, and the ledger says «no colonies»', () => {
    const enacted: ParliamentEnactedModel = {instance: `${COLONIAL}#0`, resolution: COLONIAL, party: PartyName.UNITY};
    const live = model([seat(BLUE, 5, [])], {
      rulingParty: PartyName.UNITY, enacted,
      phase: {generation: 3, final: false, step: 'effects', outcomes: [outcome({kind: 'skipped', step: 'colonies', amount: 3, reason: 'You have no colonies'})]},
    });
    const reading = colonyLedgerOf(shipped(COLONIAL), live, BLUE, {enacted: true, live: true})!;
    expect(reading.empty).is.true;
    expect(reading.multiplier).eq(3);
    expect(reading.yields[0].skipped).eq('You have no colonies');
  });
});

/**
 * THE LEDGER OF A CARD (TR23 Habitat Science's action — «gain all your colony bonuses»): the same rows outside the
 * Parliament. No resolution, no influence, no record: the entries are the server's (`ActionPreviewBranch
 * .colonyBonuses`, in the order the engine pays), a row's repeats are its cubes, and what it asks / why it cannot
 * land ride the entry.
 */
describe('cardColonyLedgerOf — the ledger of a card, outside the Parliament', () => {
  const MIRANDA: ColonyLedgerEntryModel = {colony: ColonyName.MIRANDA, grant: {benefit: ColonyBenefit.DRAW_CARDS, quantity: 1}, description: 'Draw 1 card', cubes: 1, asks: 'draw'};

  it('reads the server\'s rows IN THE ORDER GIVEN — never re-sorted — with no effect, no yields and no win forecast', () => {
    const reading = cardColonyLedgerOf({entries: [LUNA, MIRANDA, {...PLUTO, asks: 'draw-discard'}, {...TITAN, asks: 'card'}]});
    expect(reading.context).eq('preview');
    expect(reading.effect).is.undefined;
    expect(reading.yields).is.undefined;
    expect(reading.winMultiplier).is.undefined;
    expect(reading.multiplier, 'a card pays once per cube').eq(1);
    expect(reading.empty).is.false;
    expect(reading.rows.map((r) => r.colony)).deep.eq([ColonyName.LUNA, ColonyName.MIRANDA, ColonyName.PLUTO, ColonyName.TITAN]);
    expect(reading.rows.map((r) => r.asks)).deep.eq([undefined, 'draw', 'draw-discard', 'card']);
    expect(reading.rows.every((r) => r.state === 'pending')).is.true;
  });

  it('a tile with TWO cubes is one row paid twice («× 2», the total doubled); one cube reads «× 1» — which the component does not print', () => {
    const reading = cardColonyLedgerOf({entries: [{...LUNA, cubes: 2}, {...PLUTO, cubes: 2, asks: 'draw-discard'}, TITAN]});
    expect(reading.rows.map((r) => [r.colony, r.cubes, r.multiplier, r.total])).deep.eq([
      [ColonyName.LUNA, 2, 2, 4],
      [ColonyName.PLUTO, 2, 2, 2],
      [ColonyName.TITAN, 1, 1, 1],
    ]);
  });

  it('a row the server refused is SKIPPED with its reason before anything is paid, and adds nothing to the sums', () => {
    const reading = cardColonyLedgerOf({entries: [LUNA, {...TITAN, skipped: {reason: 'No card can hold floaters', amount: 1}}]});
    expect(reading.rows[1]).deep.include({state: 'skipped', skipped: 'No card can hold floaters'});
    expect(reading.rows[1].asks, 'a refused row asks nothing').is.undefined;
    expect(reading.totals.cardResources).deep.eq([]);
    expect(reading.totals.stock).deep.eq([{resource: Resource.MEGACREDITS, amount: 2}]);
  });

  it('the composer\'s phase is the context: preview → paying → paid; `times` (Yvonne) is the multiplier', () => {
    expect(cardColonyLedgerOf({entries: [LUNA]}, 'paying').context).eq('paying');
    expect(cardColonyLedgerOf({entries: [LUNA]}, 'paid').context).eq('paid');
    const twice = cardColonyLedgerOf({entries: [LUNA], times: 2});
    expect(twice.multiplier).eq(2);
    expect(twice.rows[0]).deep.include({multiplier: 2, total: 4});
    expect(isCardLedgerContext('preview') && isCardLedgerContext('paying') && isCardLedgerContext('paid')).is.true;
    expect(isCardLedgerContext('vote') || isCardLedgerContext('resolving') || isCardLedgerContext('applied')).is.false;
  });

  it('no colonies: the ledger says so in words (`empty`), never an empty box', () => {
    const reading = cardColonyLedgerOf({entries: []});
    expect(reading.empty).is.true;
    expect(reading.rows).deep.eq([]);
  });

  it('the word of the step a pending row will raise', () => {
    expect(colonyLedgerAskKey('card')).eq('card choice');
    expect(colonyLedgerAskKey('draw')).eq('take the card');
    expect(colonyLedgerAskKey('draw-discard')).eq('card → discard');
    expect(colonyLedgerAskKey('choice')).eq('your choice');
    expect(colonyLedgerAskKey(undefined)).is.undefined;
  });
});

describe('voteInfoModel — the ledger in the vote panel', () => {
  it('the panel\'s reading carries the ledger for Colonial Affairs and nothing for another card; its words stay within the budget', () => {
    const withTiles = voteReadingOf(shipped(COLONIAL), model([seat(BLUE, 5, [LUNA, TITAN, PLUTO])]), BLUE, []);
    expect(withTiles.ledger?.rows.map((r) => r.colony)).deep.eq([ColonyName.LUNA, ColonyName.TITAN, ColonyName.PLUTO]);
    expect(withTiles.yields.map((y) => `${y.context}:${y.amount}`)).deep.eq(['estimate:3']);
    expect(voteReadingOf(shipped(AQUIFER), model([seat(BLUE, 5, [LUNA])]), BLUE, []).ledger).is.undefined;
    expect(voteReadingOf(shipped(COLONIAL), model([seat(BLUE, 5, [LUNA])]), RED, []).ledger, 'a spectator reads the graphic alone').is.undefined;
    // The budget counts the tiles' names and the sums' kicker — four tiles keep the panel under its ceiling.
    const four = [LUNA, TITAN, PLUTO, {colony: ColonyName.MIRANDA, grant: {benefit: ColonyBenefit.DRAW_CARDS, quantity: 1}, description: 'Draw 1 card', cubes: 1}];
    const resolution = shipped(COLONIAL);
    const instance = `${COLONIAL}#0`;
    const table = model([seat(BLUE, 5, four)], {
      slots: [{instance, resolution: COLONIAL, party: PartyName.UNITY, votes: [{owner: RED, seq: 1}], totalVotes: 1, leader: RED, isWinning: false, tiePriority: 1, viewerVotes: 0}],
      viewer: {vote: {available: true, reason: '', source: 'lobby', cost: 0, projections: [{instance, votesAfter: 2, leaderAfter: RED, viewerLeads: false, becomesWinning: false, unlocksEffect: false, unlocksRequirement: false}]}, partyActions: []},
    });
    const slot: ParliamentSlotVm = {
      instance, resolutionId: COLONIAL, resolution, party: PartyName.UNITY, votes: table.slots[0].votes, totalVotes: 1, leader: RED, leaderVotes: 1,
      isWinning: false, tiePriority: 1, viewerVotes: 0, projection: table.viewer!.vote.projections[0],
    };
    const party: ParliamentPartyVm = {party: PartyName.UNITY, effect: undefined, rule: '', support: 0, inArea: true, ruling: false, access: undefined, actionId: undefined, action: undefined};
    const facts = voteFactsOf({slot, party, viewer: BLUE, forecast: voteForecastOf(slot, BLUE, table.viewer!.vote), snapshot: undefined, landed: false, mineBefore: 0, mineAfter: 1, nameOf: (c) => c});
    const vm = voteInfoOf({slot, resolution, model: table, subject: BLUE, tableau: [], name: resolution.text.name, winning: false, source: 'lobby', cost: 0, facts, numbers: {votesBefore: 1, votesAfter: 2, mineBefore: 0, mineAfter: 1}});
    const budget = voteInfoBudget(vm);
    expect(budget.readings).eq(1);
    expect(budget.words).is.at.most(VOTE_INFO_LIMITS.words);
  });
});
