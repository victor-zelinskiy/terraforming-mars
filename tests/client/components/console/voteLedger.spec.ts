import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {ParliamentModel, ParliamentPlayerModel, ParliamentSlotModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {influenceAtAgenda, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {ledgerPartText, LedgerChipVm, voteLedgerOf} from '@/client/console/parliament/voteLedgerModel';

/**
 * THE LEDGER OF OUTCOMES (Turmoil Redux): what the selected card pays EVERY
 * seat at ITS own influence — one chip per participating seat, the viewer's
 * first, numbers only. Driven with the SHIPPED catalog, so a re-declared card
 * fails here; the one synthetic resolution is the winner-only part, which no
 * card of the catalog declares yet (the tone is infrastructure ahead of it).
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;
const GREEN = 'green' as Color;

const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';
const PLANT_BAN = 'RDX_REDS_PLANT_BAN';
const COLONIAL = 'RDX_UNITY_COLONIAL_AFFAIRS';
const BUDGET = 'RDX_INDUSTRIALISTS_INDUSTRIALIST_BUDGET';
const SKYSCRAPERS = 'RDX_MARS_SKYSCRAPERS';
const DEV_PASSIVE = 'RDX_DEV_PASSIVE';

function shipped(id: string): IClientResolution {
  const r = getResolution(id);
  if (r === undefined) {
    throw new Error(`${id} is not in the client catalog`);
  }
  return r;
}

function seat(color: Color, agenda: number, over: Partial<ParliamentPlayerModel> = {}): ParliamentPlayerModel {
  return {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false,
    agenda, influence: influenceAtAgenda(agenda), access: [], partyActionUses: {}, resolutionActionUses: 0, ...over,
  };
}

function slotOf(resolution: IClientResolution): ParliamentSlotModel {
  return {
    instance: `${resolution.id}#1`, resolution: resolution.id, party: resolution.party as ReduxParty,
    votes: [], totalVotes: 0, isWinning: true, tiePriority: 1, viewerVotes: 0,
  };
}

function model(players: Array<ParliamentPlayerModel>, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players, deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none', ...over};
}

/** Tableaux, as the public player view carries them. */
const tableaux = (...entries: Array<[Color, Array<CardName>]>) => entries.map(([color, names]) => ({color, tableau: names.map((name) => ({name}))}));

/** The chip of one seat, or a failure that names the row it looked in. */
function chipOf(chips: ReadonlyArray<LedgerChipVm>, color: Color): LedgerChipVm {
  const chip = chips.find((c) => c.color === color);
  if (chip === undefined) {
    throw new Error(`no chip for ${color} in [${chips.map((c) => c.color).join(', ')}]`);
  }
  return chip;
}

/** What the row PRINTS for one seat — the text of every part, in order. */
const textsOf = (chip: LedgerChipVm) => chip.parts.map((part) => ledgerPartText(part));

describe('voteLedgerModel — the row of seats', () => {
  it('the VIEWER stands first, the rest in the model\'s order — never sorted by advantage', () => {
    const m = model([seat(RED, 5), seat(GREEN, 3), seat(BLUE, 1)], {slots: []});
    const chips = voteLedgerOf({resolution: shipped(AQUIFER), model: m, viewer: BLUE, players: tableaux([BLUE, [CardName.FISH]], [RED, [CardName.BIRDS]], [GREEN, [CardName.PETS]])});
    expect(chips.map((c) => c.color)).deep.eq([BLUE, RED, GREEN]);
    expect(chips.map((c) => c.you)).deep.eq([true, false, false]);
  });

  it('…and a spectator reads the same table with no «you» chip', () => {
    const m = model([seat(RED, 5), seat(GREEN, 3)]);
    const chips = voteLedgerOf({resolution: shipped(AQUIFER), model: m, viewer: undefined, players: tableaux([RED, [CardName.BIRDS]], [GREEN, [CardName.PETS]])});
    expect(chips.map((c) => c.color)).deep.eq([RED, GREEN]);
    expect(chips.some((c) => c.you)).eq(false);
  });

  it('a seat that does NOT take part (MarsBot) is never printed — not even as a zero', () => {
    const m = model([seat(BLUE, 3), seat(RED, 5, {participates: false})]);
    const chips = voteLedgerOf({resolution: shipped(AQUIFER), model: m, viewer: BLUE, players: tableaux([BLUE, [CardName.FISH]], [RED, [CardName.BIRDS]])});
    expect(chips.map((c) => c.color)).deep.eq([BLUE]);
  });

  it('each seat reads at ITS OWN influence — the whole point of the row', () => {
    // blue at step 1 (influence 1), red at step 5 (influence 3): 1 animal against 3.
    const m = model([seat(BLUE, 1), seat(RED, 5)]);
    const chips = voteLedgerOf({resolution: shipped(AQUIFER), model: m, viewer: BLUE, players: tableaux([BLUE, [CardName.FISH]], [RED, [CardName.BIRDS]])});
    expect(textsOf(chipOf(chips, BLUE))).deep.eq(['+1']);
    expect(textsOf(chipOf(chips, RED))).deep.eq(['+3']);
    expect(chipOf(chips, RED).parts[0].tone).eq('gain');
  });

  it('a payout with NOWHERE TO LAND names itself on that seat\'s chip — «✕ N», never a silent gap', () => {
    // red holds no card that can take an animal: the formula still says 3, and nothing would land.
    const m = model([seat(BLUE, 1), seat(RED, 5)]);
    const chips = voteLedgerOf({resolution: shipped(AQUIFER), model: m, viewer: BLUE, players: tableaux([BLUE, [CardName.FISH]], [RED, [CardName.MINE]])});
    const red = chipOf(chips, RED).parts[0];
    expect(red.tone).eq('lost');
    expect(ledgerPartText(red)).eq('✕ 3');
  });

  it('a CUT reads as what LEAVES each seat, and a seat at the limit reads a quiet zero (Plant Ban)', () => {
    // The target is «2 + influence»: blue (influence 3) keeps 5 of its 12 → −7; red (influence 1) keeps 3 and has 2 → 0.
    const m = model([seat(BLUE, 5, {stock: {[Resource.PLANTS]: 12}}), seat(RED, 1, {stock: {[Resource.PLANTS]: 2}})]);
    const chips = voteLedgerOf({resolution: shipped(PLANT_BAN), model: m, viewer: BLUE, players: tableaux([BLUE, []], [RED, []])});
    const blue = chipOf(chips, BLUE).parts[0];
    expect(blue.tone).eq('loss');
    expect(ledgerPartText(blue)).eq('−7');
    const red = chipOf(chips, RED).parts[0];
    expect(red.tone).eq('quiet');
    expect(ledgerPartText(red)).eq('0');
  });

  it('a MULTIPLIER reads as «×k» — it is not a count of anything (Colonial Affairs)', () => {
    // base 2 + 1 per 2 points of influence: blue at influence 0 → ×2, red at influence 3 → ×3.
    const m = model([seat(BLUE, 0), seat(RED, 5)]);
    const chips = voteLedgerOf({resolution: shipped(COLONIAL), model: m, viewer: BLUE, players: tableaux([BLUE, []], [RED, []])});
    expect(textsOf(chipOf(chips, BLUE))).deep.eq(['×2']);
    expect(textsOf(chipOf(chips, RED))).deep.eq(['×3']);
    expect(chipOf(chips, BLUE).parts[0].kind).eq('multiplier');
  });

  it('a BUDGET reads its levy as the seat\'s NET in that currency, with the production part apart', () => {
    // −10 M€ first; blue: influence 3 + 3 counted production steps → +6 → net −4. The «+4 M€ production» is its own part.
    const counts = [{id: 'steelTitaniumEnergyProduction' as const, count: 3, cards: [], byResource: [{resource: Resource.STEEL, count: 3}]}];
    const m = model([seat(BLUE, 5, {stock: {[Resource.MEGACREDITS]: 40}, counts}), seat(RED, 1, {stock: {[Resource.MEGACREDITS]: 40}, counts})]);
    const chips = voteLedgerOf({resolution: shipped(BUDGET), model: m, viewer: BLUE, players: tableaux([BLUE, []], [RED, []])});
    const blue = chipOf(chips, BLUE);
    expect(textsOf(blue)).deep.eq(['−4', '+4']);
    expect(blue.parts.map((p) => p.tone)).deep.eq(['loss', 'gain']);
    // red is poorer by the same levy at a lower influence: 1 + 3 = 4 → net −6.
    expect(textsOf(chipOf(chips, RED))).deep.eq(['−6', '+4']);
  });

  it('…and a seat holding less than the levy pays what it holds — the net follows the SAME arithmetic', () => {
    const counts = [{id: 'steelTitaniumEnergyProduction' as const, count: 0, cards: []}];
    const m = model([seat(BLUE, 1, {stock: {[Resource.MEGACREDITS]: 3}, counts})]);
    const chips = voteLedgerOf({resolution: shipped(BUDGET), model: m, viewer: BLUE, players: tableaux([BLUE, []])});
    // It pays 3 of the 10 owed and receives 1 → net −2.
    expect(textsOf(chipOf(chips, BLUE))[0]).eq('−2');
  });

  it('a TILE BY THRESHOLD is printed for the seats that pass on INFLUENCE, and «✕» for one with nowhere to build', () => {
    const resolution = shipped(SKYSCRAPERS);
    const cities = (n: number) => [{id: 'marsCities' as const, count: n, cards: []}];
    const m = model([
      seat(BLUE, 3, {counts: cities(2)}), // influence 2 — the line
      seat(RED, 1, {counts: cities(2)}), // influence 1 — below it
      seat(GREEN, 5, {counts: cities(0)}), // eligible, but no city on Mars
    ], {slots: [slotOf(resolution)]});
    const chips = voteLedgerOf({resolution, model: m, viewer: BLUE, players: tableaux([BLUE, []], [RED, []], [GREEN, []])});
    expect(chipOf(chips, BLUE).parts.map((p) => [p.kind, p.tone])).deep.eq([['tile', 'gain']]);
    expect(chipOf(chips, RED).parts).deep.eq([]);
    const green = chipOf(chips, GREEN).parts[0];
    expect([green.kind, green.tone]).deep.eq(['tile', 'lost']);
    expect(ledgerPartText(green)).eq('✕');
  });

  it('a card that pays NOBODY has no row at all (a passive, an action)', () => {
    const m = model([seat(BLUE, 3), seat(RED, 5)]);
    const chips = voteLedgerOf({resolution: shipped(DEV_PASSIVE), model: m, viewer: BLUE, players: tableaux([BLUE, []], [RED, []])});
    expect(chips).deep.eq([]);
  });

  it('no resolution, no model — no row (never an invented table)', () => {
    expect(voteLedgerOf({resolution: undefined, model: model([seat(BLUE, 3)]), viewer: BLUE, players: []})).deep.eq([]);
    expect(voteLedgerOf({resolution: shipped(AQUIFER), model: undefined, viewer: BLUE, players: []})).deep.eq([]);
  });

  it('a part paid to the WINNER of the vote alone carries the winner\'s own accent', () => {
    // No card of the catalog declares one yet — the tone is infrastructure ahead of the content.
    const resolution: IClientResolution = {
      ...shipped(AQUIFER),
      id: 'RDX_TEST_WINNER_PART' as IClientResolution['id'],
      scaled: [{id: 'prize', unit: {kind: 'stock', resource: Resource.TITANIUM}, perInfluence: 2, recipient: 'winner'}],
    };
    const m = model([seat(BLUE, 5)]);
    const chips = voteLedgerOf({resolution, model: m, viewer: BLUE, players: tableaux([BLUE, []])});
    const part = chipOf(chips, BLUE).parts[0];
    expect(part.tone).eq('winner');
    expect(ledgerPartText(part)).eq('+6');
  });

  it('the chip\'s TEXT is decided in one place — the sign follows the tone, never the caller', () => {
    const icon = {family: 'cards'} as const;
    expect(ledgerPartText({key: 'a', kind: 'amount', amount: 4, icon, tone: 'gain'})).eq('+4');
    expect(ledgerPartText({key: 'a', kind: 'amount', amount: 4, icon, tone: 'winner'})).eq('+4');
    expect(ledgerPartText({key: 'a', kind: 'amount', amount: 4, icon, tone: 'loss'})).eq('−4');
    expect(ledgerPartText({key: 'a', kind: 'amount', amount: 4, icon, tone: 'lost'})).eq('✕ 4');
    expect(ledgerPartText({key: 'a', kind: 'amount', amount: 0, icon, tone: 'quiet'})).eq('0');
    expect(ledgerPartText({key: 'a', kind: 'multiplier', amount: 3, icon, tone: 'gain'})).eq('×3');
    expect(ledgerPartText({key: 'tile', kind: 'tile', tone: 'gain'})).eq('');
  });
});
