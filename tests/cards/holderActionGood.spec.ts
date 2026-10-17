import {expect} from 'chai';
import {holderActionGoodOf} from '../../src/server/cards/holderActionGood';
import {ALL_MODULE_MANIFESTS} from '../../src/server/cards/AllManifests';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {ICard} from '../../src/server/cards/ICard';
import {HolderActionGood, roleGoodsOf} from '../../src/common/cards/holderRole';

/**
 * THE ACTION ROLE OF A HOLDER (PL-135) — what a card's stored resource buys
 * through its own declarative action, read off `action` at export time and
 * never declared. The table below is the whole reading, card by card: every
 * holder the console names a good (or a CHOICE of goods at one price — PL-484)
 * for, and every holder it deliberately leaves plain storage — a bespoke
 * action, two prices, a target to pick,
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
    // TR50 — TR40 with another B: the same `or`, the energy variant ignored, «1 mech → 1 card».
    [CardName.EXPEDITION_MECHS, {spend: 1, good: {kind: 'cards', amount: 1}}],
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
    // К-R1 (TR46): a BESPOKE action's good, declared once in the card file — ALL the data → as many cards, keep 1.
    [CardName.RESEARCH_STARTUPS, {spend: 'all', good: {kind: 'look', keep: 1}}],
    // TR61: a BESPOKE action's good, declared once — 1 mech here buys the REPEAT of an already-used action.
    [CardName.CARGO_MECHS, {spend: 1, good: {kind: 'repeat'}}],
    // PL-484 (K-§6.1): ONE PRICE, A CHOICE OF GOODS — every good in the printed order, the first as `good`.
    [CardName.MINING_MECHS, {spend: 2, good: {kind: 'production', resource: 'steel' as never, amount: 1}, or: [{kind: 'production', resource: 'titanium' as never, amount: 1}]}],
    [CardName.ATMO_COLLECTORS, {spend: 1, good: {kind: 'stock', resource: 'titanium' as never, amount: 2}, or: [
      {kind: 'stock', resource: 'energy' as never, amount: 3}, {kind: 'stock', resource: 'heat' as never, amount: 4}]}],
    // TR60 (the owner's decision 4a): ONE PRICE, A SET OF GOODS — one press buys every good, in the printed order.
    [CardName.CIVILIAN_SPACEFIGHTERS, {spend: 1, good: {kind: 'production', resource: 'megacredits' as never, amount: 1}, with: [
      {kind: 'stock', resource: 'megacredits' as never, amount: 3}]}],
    // …the same class in Underworld: «2 activists → 2 plants and +1 plant production» (storage until the set was read).
    [CardName.ARBORIST_COLLECTIVE, {spend: 2, good: {kind: 'stock', resource: 'plants' as never, amount: 2}, with: [
      {kind: 'production', resource: 'plants' as never, amount: 1}]}],
  ];

  for (const [name, expected] of NAMED) {
    it(`${name}: ${expected.spend} → ${JSON.stringify(expected.good)}`, () => {
      expect(holderActionGoodOf(cardOf(name))).to.deep.eq(expected);
    });
  }

  const PLAIN: ReadonlyArray<[CardName, string]> = [
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

  it('PL-484: a choice is read only at ONE price — two variants spending DIFFERENT amounts here are storage', () => {
    // A synthetic holder: «1 here → 2 titanium» OR «2 here → 1 steel production» — no one reading of «spend N».
    const twoPrices = {
      name: 'Two Prices' as CardName,
      resourceType: 'Floater',
      action: () => undefined,
      canAct: () => true,
      actionBehavior: {or: {behaviors: [
        {spend: {resourcesHere: 1}, stock: {titanium: 2}, title: 'a'},
        {spend: {resourcesHere: 2}, production: {steel: 1}, title: 'b'},
      ]}},
    } as unknown as ICard;
    expect(holderActionGoodOf(twoPrices)).is.undefined;
    // …and the same two goods at ONE price are the choice, in the printed order.
    const onePrice = {
      ...twoPrices,
      actionBehavior: {or: {behaviors: [
        {spend: {resourcesHere: 2}, stock: {titanium: 2}, title: 'a'},
        {spend: {resourcesHere: 2}, production: {steel: 1}, title: 'b'},
      ]}},
    } as unknown as ICard;
    expect(holderActionGoodOf(onePrice)).deep.eq({spend: 2, good: {kind: 'stock', resource: 'titanium', amount: 2}, or: [{kind: 'production', resource: 'steel', amount: 1}]});
  });

  it('TR60: a SET is read only from ONE spending variant — a choice between sets (or a set beside a single good) has no one plate: storage', () => {
    const card = (behaviors: ReadonlyArray<object>) => ({
      name: 'Sets' as CardName, resourceType: 'Fighter', action: () => undefined, canAct: () => true,
      actionBehavior: {or: {behaviors}},
    } as unknown as ICard);
    expect(holderActionGoodOf(card([
      {spend: {resourcesHere: 1}, stock: {megacredits: 3}, production: {megacredits: 1}, title: 'a'},
      {spend: {resourcesHere: 1}, stock: {titanium: 2}, title: 'b'},
    ]))).is.undefined;
    // …while a set beside a variant that BUYS the resource is the set (TR60's own shape).
    expect(holderActionGoodOf(card([
      {spend: {titanium: 1}, addResources: 2, title: 'a'},
      {spend: {resourcesHere: 1}, production: {megacredits: 1}, stock: {megacredits: 3}, title: 'b'},
    ]))).deep.eq({spend: 1, good: {kind: 'production', resource: 'megacredits', amount: 1}, with: [{kind: 'stock', resource: 'megacredits', amount: 3}]});
  });

  it('a DECLARED good is a bespoke action\'s only: a card with a declarative action never declares one (it is derived)', () => {
    for (const manifest of ALL_MODULE_MANIFESTS) {
      for (const [name, entry] of Object.entries(manifest.projectCards as Record<string, {Factory: new () => ICard}>)) {
        const card = new entry.Factory();
        if (card.holderActionGood !== undefined) {
          expect((card as ICard & {actionBehavior?: unknown}).actionBehavior, name).is.undefined;
        }
      }
    }
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
        if (good.spend !== 'all') {
          expect(good.spend, name).is.greaterThan(0);
        }
        // Every good of a CHOICE (PL-484) and of a SET (TR60) too — one empty good would promise nothing on its plate.
        for (const g of roleGoodsOf(good)) {
          // A REPEAT (TR61) is one action performed again — a verb with no magnitude; every other good carries one.
          const amount = g.kind === 'global' ? g.steps : g.kind === 'look' ? g.keep : g.kind === 'repeat' ? 1 : g.amount;
          expect(amount, name).is.greaterThan(0);
        }
      }
    }
    expect(named, 'the reading names at least the table above').is.gte(NAMED.length);
  });
});
