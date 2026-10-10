import {expect} from 'chai';
import {holderActionGoodOf} from '../../src/server/cards/holderActionGood';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {ICard} from '../../src/server/cards/ICard';
import {HolderActionGood} from '../../src/common/cards/holderRole';

/**
 * THE ACTION ROLE OF A HOLDER (PL-135) — what a card's stored resource buys
 * through its own declarative action, read off `action` at export time and
 * never declared. The table below is the whole reading, card by card: every
 * holder the console names a good for, and every holder it deliberately
 * leaves plain storage — a bespoke action, a choice of goods, a target to pick,
 * a draw-and-keep, a payment unit whose action buys the resource rather than
 * spending it. A new holder that spends `resourcesHere` for one plain good
 * joins the first list by itself; one that the reading cannot name fails
 * nothing and says nothing — the guard here is that the reading never widens
 * silently (the second list) and never narrows silently (the first).
 */
function cardOf(name: CardName): ICard {
  for (const manifest of ALL_MODULE_MANIFESTS) {
    for (const deck of [manifest.projectCards, manifest.corporationCards, manifest.preludeCards, manifest.ceoCards]) {
      const Factory = (deck as Record<string, {Factory?: new () => ICard}> | undefined)?.[name]?.Factory;
      if (Factory !== undefined) {
        return new Factory();
      }
    }
  }
  throw new Error(`no such card: ${name}`);
}

describe('holderActionGoodOf — the good a stored resource buys through the card\'s own action', () => {
  const NAMED: ReadonlyArray<[CardName, HolderActionGood]> = [
    [CardName.FORESTRY_MECHS, {spend: 1, good: {kind: 'production', resource: 'plants' as never, amount: 1}}],
    [CardName.BIOLOGICAL_SIMULATIONS, {spend: 2, good: {kind: 'production', resource: 'plants' as never, amount: 1}}],
    [CardName.LOCAL_SHADING, {spend: 1, good: {kind: 'production', resource: 'megacredits' as never, amount: 1}}],
    [CardName.DEUTERIUM_EXPORT, {spend: 1, good: {kind: 'production', resource: 'energy' as never, amount: 1}}],
    [CardName.POLITICAL_SCIENCE, {spend: 3, good: {kind: 'cards', amount: 1}}],
    [CardName.VECTOR_COMPUTATIONS, {spend: 4, good: {kind: 'cards', amount: 1, tag: Tag.SPACE}}],
    [CardName.AERIAL_MAPPERS, {spend: 1, good: {kind: 'cards', amount: 1}}],
    [CardName.NITRITE_REDUCING_BACTERIA, {spend: 3, good: {kind: 'tr', amount: 1}}],
    [CardName.GHG_PRODUCING_BACTERIA, {spend: 2, good: {kind: 'global', parameter: 'temperature', steps: 1}}],
    [CardName.REGOLITH_EATERS, {spend: 2, good: {kind: 'global', parameter: 'oxygen', steps: 1}}],
    [CardName.THERMOPHILES, {spend: 2, good: {kind: 'global', parameter: 'venus', steps: 1}}],
  ];

  for (const [name, expected] of NAMED) {
    it(`${name}: ${expected.spend} → ${JSON.stringify(expected.good)}`, () => {
      expect(holderActionGoodOf(cardOf(name))).to.deep.eq(expected);
    });
  }

  const PLAIN: ReadonlyArray<[CardName, string]> = [
    [CardName.ATMO_COLLECTORS, 'one floater buys a CHOICE of three goods — not one good'],
    [CardName.EXTRACTOR_BALLOONS, 'a bespoke action (its declarative form is commented out) — nothing to read'],
    [CardName.WEATHER_BALLOONS, 'a VARIABLE good (1 M€ per city on Mars — a countable, not a number) — not one plain good'],
    [CardName.HABITAT_SCIENCE, 'a bespoke action (all your colony bonuses) — nothing declarative to read'],
    [CardName.MARS_ARMY_MECHS, 'a bespoke census action — the delegate role is the card\'s own declaration'],
    [CardName.EVA_MECHS, 'the action BUYS the mech (1 energy → a mech), it spends none'],
    [CardName.MECH_SPORTS, 'the action buys the mech; the VP rule is the printed one'],
    [CardName.SPACESHIP_RECYCLING, 'spends a fighter from ANY card — never from here'],
    [CardName.TARDIGRADES, 'no action at all'],
  ];

  for (const [name, why] of PLAIN) {
    it(`${name}: plain storage — ${why}`, () => {
      expect(holderActionGoodOf(cardOf(name))).is.undefined;
    });
  }

  it('TR40\'s `or`: the variant that spends energy is ignored, the variant that spends a mech is the role — one good, not two', () => {
    const card = cardOf(CardName.FORESTRY_MECHS);
    const action = (card as ICard & {actionBehavior?: {or?: {behaviors: ReadonlyArray<unknown>}}}).actionBehavior;
    expect(action?.or?.behaviors).has.length(2);
    expect(holderActionGoodOf(card)?.spend).eq(1);
  });

  it('the whole manifest: every holder with a reading spends a POSITIVE number of its own resource for a positive good', () => {
    let named = 0;
    for (const manifest of ALL_MODULE_MANIFESTS) {
      for (const [name, entry] of Object.entries(manifest.projectCards as Record<string, {Factory: new () => ICard}>)) {
        const good = holderActionGoodOf(new entry.Factory());
        if (good === undefined) {
          continue;
        }
        named++;
        expect(good.spend, name).is.greaterThan(0);
        expect(good.good.kind === 'global' ? good.good.steps : good.good.amount, name).is.greaterThan(0);
      }
    }
    expect(named, 'the reading names at least the table above').is.gte(NAMED.length);
  });
});
