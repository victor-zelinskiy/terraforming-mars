import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {OUTCOME_KINDS, REWARD_ADDRESS, rewardAddressOf} from '../../src/common/parliament/rewardAddress';
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
    expect(OUTCOME_KINDS.slice().sort()).deep.eq(['cardResource', 'cards', 'greenery', 'ocean', 'production', 'reaction', 'skipped', 'stock']);
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
    // A rail chip is BORN on a printed icon (the carrier's mechanic, the ruling party's formula) and rides a rail unit;
    // what the board or the stage plate presents has no flight source of its own.
    for (const kind of OUTCOME_KINDS) {
      const row = REWARD_ADDRESS[kind];
      if (row.surface === 'rail') {
        expect(['card-icon', 'party-plaque'], `${kind}: a rail chip is born on a printed icon`).includes(row.source);
        expect(['production', 'stock'], `${kind}: a rail unit`).includes(row.unit);
      }
      if (row.surface === 'board' || row.surface === 'stage-plate') {
        expect(row.source, `${kind}: nothing flies off the card`).eq('none');
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
    expect(animals.payload).deep.eq({resource: 'Animal', card: CardName.FISH, amount: 2});

    const ocean = rewardAddressOf(outcome({kind: 'ocean', part: 'winner', space: '03', parameter: {id: 'oceans', before: 2, after: 3}}), 'blue');
    expect(ocean.address.surface).eq('board');
    expect(ocean.skipped, 'a tile has no amount and is never a skip by its absence').is.undefined;
    expect(ocean.payload).deep.eq({parameter: {id: 'oceans', before: 2, after: 3}});

    const reaction = rewardAddressOf(outcome({kind: 'reaction', party: PartyName.GREENS, trigger: 'production-gain', production: Resource.MEGACREDITS, amount: 2}), 'blue');
    expect(reaction.address.source).eq('party-plaque');
    expect(reaction.payload).deep.eq({resource: 'megacredits', amount: 2, party: PartyName.GREENS});
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
});
