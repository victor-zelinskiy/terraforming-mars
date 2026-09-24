import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {OUTCOME_KINDS, REWARD_ADDRESS, rewardAddressOf, rewardFlightSourceOf} from '../../src/common/parliament/rewardAddress';
import {ParliamentEnactOutcomeModel} from '../../src/common/models/ParliamentModel';
import {Resource} from '../../src/common/Resource';
import {CardResource} from '../../src/common/CardResource';
import {CardName} from '../../src/common/cards/CardName';
import {PartyName} from '../../src/common/turmoil/PartyName';

const ROOT = path.join(__dirname, '..', '..');
const LOCALE: Record<string, string> = Object.assign({}, ...fs.readdirSync(path.join(ROOT, 'src', 'locales', 'ru'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'locales', 'ru', f), 'utf8')) as Record<string, string>));

function outcome(over: Partial<ParliamentEnactOutcomeModel> & {kind: ParliamentEnactOutcomeModel['kind']}): ParliamentEnactOutcomeModel {
  return {player: 'blue', step: 'step', part: 'effect', ...over} as ParliamentEnactOutcomeModel;
}

/**
 * THE REWARD ADDRESS TABLE (plan §4): exhaustive over the outcome `kind`
 * union by construction — this spec pins what the type system cannot: every
 * row names a place, a source, a unit, a stage and a translated skip title,
 * and the delivery of a record resolves the record itself, never a rule.
 */
describe('rewardAddress — the table', () => {
  it('has a row for EVERY outcome kind — and only for kinds (the union and the table are one)', () => {
    expect(OUTCOME_KINDS.slice().sort()).deep.eq(['cardResource', 'cards', 'colony', 'colonyBonus', 'discard', 'globalParameter', 'greenery', 'ocean', 'production', 'reaction', 'skipped', 'stock']);
    for (const kind of OUTCOME_KINDS) {
      expect(REWARD_ADDRESS[kind].kind, kind).eq(kind);
    }
  });

  it('every row names a surface, a flight source, a unit, a stage and a reading; every skip title is a translated key', () => {
    for (const kind of OUTCOME_KINDS) {
      const row = REWARD_ADDRESS[kind];
      expect(row.surface, `${kind}.surface`).is.a('string').and.not.empty;
      expect(row.source, `${kind}.source`).is.a('string').and.not.empty;
      expect(row.unit, `${kind}.unit`).is.a('string').and.not.empty;
      expect(row.stage, `${kind}.stage`).is.a('string').and.not.empty;
      expect(row.reading, `${kind}.reading`).is.a('string').and.not.empty;
      expect(LOCALE[row.skipTitle], `${kind}.skipTitle «${row.skipTitle}» has a RU translation`).is.not.undefined;
    }
  });

  it('a paying kind lands where the player looks for it: the rail, the tableau card, the hand dock, the board; a skip lives on the stage plate', () => {
    expect(REWARD_ADDRESS.production.surface).eq('rail');
    expect(REWARD_ADDRESS.stock.surface).eq('rail');
    expect(REWARD_ADDRESS.cardResource.surface).eq('tableau-card');
    expect(REWARD_ADDRESS.cards.surface).eq('hand-dock');
    expect(REWARD_ADDRESS.ocean.surface).eq('board');
    expect(REWARD_ADDRESS.greenery.surface).eq('board');
    expect(REWARD_ADDRESS.skipped.surface).eq('stage-plate');
    // The ruling party's answer flies from the PARTY's plaque — the law is the party's, never the resolution's.
    expect(REWARD_ADDRESS.reaction.source).eq('party-plaque');
    expect(REWARD_ADDRESS.cards.source).eq('project-deck');
    // A tile is placed by the board scene itself: nothing flies off the card.
    expect(REWARD_ADDRESS.ocean.source).eq('none');
    // COLONIAL AFFAIRS' two kinds: a card thrown away by Pluto's second half leaves the HAND for the pile (the discard
    // scene's own flight, hosted as the sitting's DISCARD step); a colony bonus the chip language does not speak
    // commits through the HUD counter it moves — nothing flies off the card, the ledger row names it.
    expect(REWARD_ADDRESS.discard.surface).eq('hand-dock');
    expect(REWARD_ADDRESS.discard.source).eq('hand');
    expect(REWARD_ADDRESS.discard.stage).eq('discard');
    expect(REWARD_ADDRESS.discard.reading).eq('colony-ledger');
    expect(REWARD_ADDRESS.colonyBonus.surface).eq('hud');
    expect(REWARD_ADDRESS.colonyBonus.source).eq('none');
    expect(REWARD_ADDRESS.colonyBonus.reading).eq('colony-ledger');
    // COLONY CONTEST's kind: the winner's colony is built on the COLONIES SCREEN — hosted as the sitting's own step
    // («КОЛОНИИ»), the cube placed by that screen's build scene (nothing flies off the card), read as the winner's part.
    expect(REWARD_ADDRESS.colony.surface).eq('colonies');
    expect(REWARD_ADDRESS.colony.source).eq('none');
    expect(REWARD_ADDRESS.colony.unit).eq('tile');
    expect(REWARD_ADDRESS.colony.stage).eq('colonies');
    expect(REWARD_ADDRESS.colony.reading).eq('winner-reward');
    expect(REWARD_ADDRESS.colony.skipTitle).eq('Skipped: the winner\'s colony');
  });

  it('a record that names its COLONY is born on its LEDGER ROW, never on the resolution\'s icon — the ledger is where the player read the bonus', () => {
    const record = outcome({kind: 'stock', stock: Resource.MEGACREDITS, amount: 6, colony: 'Luna' as never, multiplier: 3});
    expect(rewardFlightSourceOf(record)).eq('colony-row');
    const luna = rewardAddressOf(record, 'blue');
    expect(luna.source).eq('colony-row');
    expect(luna.payload).deep.eq({resource: 'megacredits', amount: 6, colony: 'Luna', multiplier: 3});
    // Without a colony the same kind keeps the table's source; a reaction never moves to the row (its source is the plaque).
    expect(rewardAddressOf(outcome({kind: 'stock', stock: Resource.MEGACREDITS, amount: 2}), 'blue').source).eq('card-icon');
    expect(rewardAddressOf(outcome({kind: 'reaction', party: PartyName.GREENS, stock: Resource.MEGACREDITS, amount: 2, colony: 'Luna' as never}), 'blue').source).eq('party-plaque');
    // A LOSS is a payout with a negative amount (Titania), never a skip; a colony bonus that came to nothing is.
    const loss = rewardAddressOf(outcome({kind: 'colonyBonus', stock: Resource.MEGACREDITS, amount: -5, colony: 'Titania' as never, multiplier: 2, description: 'Lose 3 M€'}), 'blue');
    expect(loss.skipped).is.undefined;
    expect(loss.payload).deep.include({amount: -5, colony: 'Titania', multiplier: 2, description: 'Lose 3 M€'});
    expect(rewardAddressOf(outcome({kind: 'colonyBonus', amount: 0, colony: 'Iapetus' as never}), 'blue').skipped).eq(REWARD_ADDRESS.colonyBonus.skipTitle);
    // A discard is a payout of one card; zero cards thrown away is the address's own skip.
    expect(rewardAddressOf(outcome({kind: 'discard', amount: 1, card: CardName.FISH, colony: 'Pluto' as never}), 'blue').skipped).is.undefined;
    expect(rewardAddressOf(outcome({kind: 'discard', amount: 0, colony: 'Pluto' as never}), 'blue').skipped).eq(REWARD_ADDRESS.discard.skipTitle);
  });

  it('Э5 — the STAGE LADDER: a rail record is the reward page\'s own wave; a card resource, a draw and a tile are hosted STEPS of it (choice / take / board); the party\'s answer rides the wave', () => {
    expect(REWARD_ADDRESS.production.stage).eq('reward');
    expect(REWARD_ADDRESS.stock.stage).eq('reward');
    expect(REWARD_ADDRESS.reaction.stage).eq('reward');
    expect(REWARD_ADDRESS.skipped.stage).eq('reward');
    expect(REWARD_ADDRESS.cardResource.stage).eq('choice');
    expect(REWARD_ADDRESS.cards.stage).eq('take');
    expect(REWARD_ADDRESS.ocean.stage).eq('board');
    expect(REWARD_ADDRESS.greenery.stage).eq('board');
    // …and a WORLD move of a global parameter is the board's too (Gas Export): the sitting yields, the scale
    // marker makes the step, the frame comes back — no seat, no rail, no chip in anybody's hands.
    expect(REWARD_ADDRESS.globalParameter.stage).eq('board');
    expect(REWARD_ADDRESS.globalParameter.unit).eq('none');
    // A rail chip is BORN on a printed icon (the carrier's mechanic, the ruling party's formula) and rides a rail unit;
    // what the board or the stage plate presents has no flight source of its own.
    for (const kind of OUTCOME_KINDS) {
      const row = REWARD_ADDRESS[kind];
      if (row.surface === 'rail') {
        expect(['card-icon', 'party-plaque'], `${kind}: a rail chip is born on a printed icon`).includes(row.source);
        expect(['production', 'stock'], `${kind}: a rail unit`).includes(row.unit);
      }
      if (row.surface === 'board' || row.surface === 'colonies' || row.surface === 'stage-plate') {
        // A TILE is placed by the board's own scene and a plate moves nothing — neither has a flight
        // source. A WORLD PARAMETER MOVE is the exception ON PURPOSE: its impulse leaves the law's own
        // printed graphic (the minus over the oxygen icon, the Venus dials) and reaches the scale, which
        // is the only thing that answers «why did the marker move».
        expect(row.source, `${kind}: nothing flies off the card`).eq(kind === 'globalParameter' ? 'card-icon' : 'none');
      }
    }
  });
});

describe('rewardAddress — the delivery of a record', () => {
  it('resolves the payload from the record (resource, card, amount, parameter, party) and whether it is the viewer\'s', () => {
    const production = rewardAddressOf(outcome({kind: 'production', production: Resource.MEGACREDITS, amount: 4, before: 1, after: 5}), 'blue');
    expect(production.address.kind).eq('production');
    expect(production.mine).is.true;
    expect(production.skipped).is.undefined;
    expect(production.payload).deep.eq({resource: 'megacredits', amount: 4});

    const animals = rewardAddressOf(outcome({kind: 'cardResource', resource: CardResource.ANIMAL, card: CardName.FISH, amount: 2}), 'red');
    expect(animals.mine, 'another seat\'s record').is.false;
    // ONE recipient is the LIST of one: every reader of a card-resource record reads `cards`.
    expect(animals.payload).deep.eq({resource: 'Animal', card: CardName.FISH, cards: [{card: CardName.FISH, amount: 2}], amount: 2});
    // A DISTRIBUTED record names its cards one by one, and no single card.
    const spread = rewardAddressOf(outcome({kind: 'cardResource', resource: CardResource.FLOATER, amount: 3,
      cards: [{card: CardName.DIRIGIBLES, amount: 2}, {card: CardName.FLOATING_HABS, amount: 1}]}), 'blue');
    expect(spread.mine).is.true;
    expect(spread.skipped).is.undefined;
    expect(spread.payload).deep.eq({resource: 'Floater', cards: [{card: CardName.DIRIGIBLES, amount: 2}, {card: CardName.FLOATING_HABS, amount: 1}], amount: 3});

    const ocean = rewardAddressOf(outcome({kind: 'ocean', part: 'winner', space: '03', parameter: {id: 'oceans', before: 2, after: 3}}), 'blue');
    expect(ocean.address.surface).eq('board');
    expect(ocean.skipped, 'a tile has no amount and is never a skip by its absence').is.undefined;
    expect(ocean.payload).deep.eq({parameter: {id: 'oceans', before: 2, after: 3}});

    const reaction = rewardAddressOf(outcome({kind: 'reaction', party: PartyName.GREENS, trigger: 'production-gain', production: Resource.MEGACREDITS, amount: 2}), 'blue');
    expect(reaction.address.source).eq('party-plaque');
    expect(reaction.payload).deep.eq({resource: 'megacredits', amount: 2, party: PartyName.GREENS});

    // The winner's COLONY (Colony Contest): a tile unit with no amount — never a skip by its absence; the record names
    // the tile the cube landed on, and it is born nowhere (the colonies screen's own build scene places it).
    const colony = rewardAddressOf(outcome({kind: 'colony', colony: 'Luna' as never}), 'blue');
    expect(colony.skipped).is.undefined;
    expect(colony.source, 'a colony record names a tile, yet it is not a ledger row — nothing flies off the card').eq('none');
    expect(colony.payload).deep.eq({colony: 'Luna'});
    expect(colony.address.reading).eq('winner-reward');
  });

  it('a `skipped` record names its own reason; a paying kind that paid nothing is named by the address', () => {
    const skipped = rewardAddressOf(outcome({kind: 'skipped', reason: 'No card can hold animals', amount: 2, resource: CardResource.ANIMAL}), 'blue');
    expect(skipped.skipped).eq('No card can hold animals');
    expect(skipped.address.reading).eq('skip-plate');
    expect(skipped.payload.amount, 'the forfeited amount rides along').eq(2);
    const zero = rewardAddressOf(outcome({kind: 'stock', stock: Resource.PLANTS, amount: 0}), 'blue');
    expect(zero.skipped).eq(REWARD_ADDRESS.stock.skipTitle);
    const nameless = rewardAddressOf(outcome({kind: 'skipped'}), undefined);
    expect(nameless.skipped, 'a skip with no reason still names itself').eq('Skipped');
    expect(nameless.mine, 'no viewer — nobody\'s').is.false;
  });

  it('a LEVY (Industrialist Budget, RX15) is a `stock` record with a NEGATIVE amount — the address walked BACKWARDS, a loss and never a skip; `owed` rides the payload', () => {
    const levy = rewardAddressOf(outcome({kind: 'stock', stock: Resource.MEGACREDITS, amount: -10, owed: 10, before: 34, after: 24}), 'blue');
    expect(levy.skipped, 'a loss is a payout the seat suffered, not «nothing happened»').is.undefined;
    expect(levy.direction).eq('loss');
    expect(levy.address, 'the SAME address as a gain — the rail, the card\'s icon, the reward page').eq(REWARD_ADDRESS.stock);
    expect(levy.source).eq('card-icon');
    expect(levy.payload).deep.eq({resource: 'megacredits', amount: -10, owed: 10});
    // A SHORT seat: 4 of 10 taken — still a loss, with the shortfall's reason on the record itself.
    const short = rewardAddressOf(outcome({kind: 'stock', stock: Resource.MEGACREDITS, amount: -4, owed: 10, reason: 'Not enough M€: the rest of the levy is not taken'}), 'blue');
    expect(short.direction).eq('loss');
    expect(short.skipped).is.undefined;
    expect(short.payload).deep.eq({resource: 'megacredits', amount: -4, owed: 10});
    // A seat that held NOTHING records the levy's own skip — its reason, the owed sum beside it.
    const nothing = rewardAddressOf(outcome({kind: 'skipped', stock: Resource.MEGACREDITS, amount: 0, owed: 10, reason: 'No M€ to pay the levy'}), 'blue');
    expect(nothing.skipped).eq('No M€ to pay the levy');
    expect(nothing.direction).eq('gain');
    expect(nothing.payload).deep.eq({resource: 'megacredits', amount: 0, owed: 10});
    // Every gain reads `gain`; a reaction never reads as a loss whatever its sign.
    expect(rewardAddressOf(outcome({kind: 'stock', stock: Resource.MEGACREDITS, amount: 7}), 'blue').direction).eq('gain');
    expect(rewardAddressOf(outcome({kind: 'production', production: Resource.MEGACREDITS, amount: 4}), 'blue').direction).eq('gain');
    expect(rewardAddressOf(outcome({kind: 'reaction', party: PartyName.GREENS, stock: Resource.MEGACREDITS, amount: -1}), 'blue').direction).eq('gain');
  });
});
