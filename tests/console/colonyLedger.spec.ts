import {expect} from 'chai';
import {ColonyBenefit} from '../../src/common/colonies/ColonyBenefit';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {CardResource} from '../../src/common/CardResource';
import {Resource} from '../../src/common/Resource';
import {Color} from '../../src/common/Color';
import {ColonyLedgerEntryModel, ParliamentEnactOutcomeModel} from '../../src/common/models/ParliamentModel';
import {
  colonyBonusShape, colonyLedgerBonusOf, colonyLedgerRows, colonyLedgerTotals, recordedMultiplierOf,
} from '../../src/common/parliament/colonyLedger';
import {ALL_COLONIES_TILES} from '../../src/server/colonies/ColonyManifest';

/*
 * THE COLONY LEDGER's pure half (Colonial Affairs): the shape a printed bonus takes under ×k, a row per
 * tile of the SERVER's registry multiplied by k, the row's state off the server's records, the sums by
 * unit. Every tile of the manifest maps to a paying shape; nothing here decides what a colony bonus is.
 */
const BLUE = 'blue' as Color;

const LUNA: ColonyLedgerEntryModel = {colony: ColonyName.LUNA, grant: {benefit: ColonyBenefit.GAIN_RESOURCES, quantity: 2, resource: Resource.MEGACREDITS}, description: 'Gain 2 M€'};
const TITAN: ColonyLedgerEntryModel = {colony: ColonyName.TITAN, grant: {benefit: ColonyBenefit.ADD_RESOURCES_TO_CARD, quantity: 1, cardResource: CardResource.FLOATER}, description: 'Add 1 floater to ANY card'};
const MIRANDA: ColonyLedgerEntryModel = {colony: ColonyName.MIRANDA, grant: {benefit: ColonyBenefit.DRAW_CARDS, quantity: 1}, description: 'Draw 1 card'};
const PLUTO: ColonyLedgerEntryModel = {colony: ColonyName.PLUTO, grant: {benefit: ColonyBenefit.DRAW_CARDS_AND_DISCARD_ONE, quantity: 1}, description: 'Draw 1 card and then discard 1 card'};
const TITANIA: ColonyLedgerEntryModel = {colony: ColonyName.TITANIA, grant: {benefit: ColonyBenefit.LOSE_RESOURCES, quantity: 3, resource: Resource.MEGACREDITS}, description: 'Lose 3 M€'};
const IAPETUS: ColonyLedgerEntryModel = {colony: ColonyName.IAPETUS, grant: {benefit: ColonyBenefit.GAIN_CARD_DISCOUNT, quantity: 1}, description: 'Pay 1 M€ less for cards this generation'};

const record = (over: Partial<ParliamentEnactOutcomeModel> & {kind: ParliamentEnactOutcomeModel['kind']}): ParliamentEnactOutcomeModel =>
  ({player: BLUE, step: 'colony:X', part: 'effect', effect: 'colonyBonuses', multiplier: 3, influence: 3, ...over}) as ParliamentEnactOutcomeModel;

describe('colonyLedger — the shared pure half of «gain all your colony bonuses k times»', () => {
  it('every tile of the manifest prints a colony bonus of a PAYING shape (Pallas is Turmoil-only and never in a Redux game)', () => {
    for (const entry of ALL_COLONIES_TILES) {
      const colony = new entry.Factory();
      if (colony.name === ColonyName.PALLAS) {
        continue;
      }
      expect(colonyBonusShape(colony.metadata.colony.type), colony.name).not.eq('unsupported');
    }
    expect(colonyBonusShape(ColonyBenefit.PLACE_DELEGATES)).eq('unsupported');
  });

  it('a printed bonus reads as ONE repeat\'s chip: a supply amount, a resource onto a card, a card, Pluto\'s pair, a description-only benefit, a LOSS', () => {
    expect(colonyLedgerBonusOf(LUNA)).deep.eq({kind: 'stock', resource: Resource.MEGACREDITS, amount: 2, description: 'Gain 2 M€'});
    expect(colonyLedgerBonusOf(TITAN)).deep.eq({kind: 'card-resource', resource: 'Floater', amount: 1, description: 'Add 1 floater to ANY card'});
    expect(colonyLedgerBonusOf(MIRANDA)).deep.eq({kind: 'cards', amount: 1, description: 'Draw 1 card'});
    expect(colonyLedgerBonusOf(PLUTO)).deep.eq({kind: 'draw-discard', amount: 1, description: 'Draw 1 card and then discard 1 card'});
    expect(colonyLedgerBonusOf(IAPETUS)).deep.eq({kind: 'hud', amount: 1, description: 'Pay 1 M€ less for cards this generation'});
    expect(colonyLedgerBonusOf(TITANIA)).deep.eq({kind: 'hud', resource: Resource.MEGACREDITS, amount: 3, loss: true, description: 'Lose 3 M€'});
  });

  it('the rows multiply the registry by k in the registry\'s order: 2 M€ ×3 = 6, 1 floater ×3 = 3, 1 card ×3 = 3, Pluto = 3 PAIRS — every row pending before the payout', () => {
    const rows = colonyLedgerRows([LUNA, TITAN, MIRANDA, PLUTO], 3);
    expect(rows.map((r) => `${r.colony}:${r.bonus.kind}:${r.total}:${r.state}`)).deep.eq([
      'Luna:stock:6:pending', 'Titan:card-resource:3:pending', 'Miranda:cards:3:pending', 'Pluto:draw-discard:3:pending',
    ]);
    expect(rows.every((r) => r.multiplier === 3 && r.records.length === 0)).is.true;
    expect(colonyLedgerRows([], 3), 'no tiles — no rows').deep.eq([]);
  });

  it('the sums by unit: M€ 6, floaters 3, cards 3, pairs 3 — and a skipped row adds nothing', () => {
    const paidRows = colonyLedgerRows([LUNA, TITAN, MIRANDA, PLUTO, IAPETUS], 3);
    expect(colonyLedgerTotals(paidRows)).deep.eq({
      stock: [{resource: Resource.MEGACREDITS, amount: 6}], production: [], cardResources: [{resource: 'Floater', amount: 3}], cards: 3, pairs: 3, other: 1,
    });
    const skippedTitan = colonyLedgerRows([LUNA, TITAN], 3, [record({kind: 'skipped', colony: ColonyName.TITAN, reason: 'No card can hold floaters', amount: 3})]);
    expect(colonyLedgerTotals(skippedTitan)).deep.eq({stock: [{resource: Resource.MEGACREDITS, amount: 6}], production: [], cardResources: [], cards: 0, pairs: 0, other: 0});
    // Two tiles of one resource ADD UP.
    const twoLunas = colonyLedgerRows([LUNA, {...LUNA, colony: ColonyName.MERCURY}], 2);
    expect(colonyLedgerTotals(twoLunas).stock).deep.eq([{resource: Resource.MEGACREDITS, amount: 8}]);
  });

  it('a row\'s STATE is the server\'s own records: paid, skipped WITH the reason, pending — never guessed; the records ride the row', () => {
    const records = [
      record({kind: 'stock', step: 'colony:Luna', colony: ColonyName.LUNA, stock: Resource.MEGACREDITS, amount: 6}),
      record({kind: 'skipped', step: 'colony:Titan', colony: ColonyName.TITAN, reason: 'No card can hold floaters', amount: 3}),
      record({kind: 'cards', step: 'colony:Pluto:1:draw', colony: ColonyName.PLUTO, amount: 1, drawn: 1}),
      record({kind: 'discard', step: 'colony:Pluto:1:discard', colony: ColonyName.PLUTO, amount: 1}),
      record({kind: 'reaction', step: 'colony:Luna', colony: ColonyName.LUNA, amount: 2}),
      // Another effect's / seat's records are not this ledger's business — the caller filters them; a foreign colony is ignored here.
      record({kind: 'stock', step: 'colony:Io', colony: ColonyName.IO, amount: 4}),
    ];
    const rows = colonyLedgerRows([LUNA, TITAN, MIRANDA, PLUTO], 3, records);
    expect(rows.map((r) => `${r.colony}:${r.state}`)).deep.eq(['Luna:paid', 'Titan:skipped', 'Miranda:pending', 'Pluto:paid']);
    expect(rows[1].skipped).eq('No card can hold floaters');
    expect(rows[0].records.map((o) => o.kind), 'the ruling party\'s answer is not the row\'s record').deep.eq(['stock']);
    expect(rows[3].records.map((o) => o.step)).deep.eq(['colony:Pluto:1:draw', 'colony:Pluto:1:discard']);
    expect(recordedMultiplierOf(records)).eq(3);
    expect(recordedMultiplierOf([])).is.undefined;
  });
});
