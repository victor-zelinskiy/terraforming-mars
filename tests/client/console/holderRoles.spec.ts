import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {actionGoodKey, actionRoleGoodKey, holderGainOutcome, holderGainOutcomeIcon, holderGainOutcomeIcons, holderGainOutcomeReading, holderGroupKey, holderLossOutcome, holderLossOutcomeReading, holderRoleCaption, holderRoleClaims, holderRoleIcon, holderRoleIcons, holderRoleIsChoice, holderRoleOf, holderRolePlate, holderRoleReading, HOLDER_ROLE_CAPTION} from '@/client/console/holderRoles';
import {additionalResourceRoleGroups} from '@/client/components/additionalResources/additionalResources';
import {buildExtrasTypes} from '@/client/console/extrasExplorerModel';
import {infoExtrasChips} from '@/client/console/infoExtrasChips';
import {playedTargetPreviewFor} from '@/client/console/played/consolePlayedTargetPreview';
import {playedTargetQuickImpacts, playedTargetTagOfPreview} from '@/client/console/played/consolePlayedTargetModel';

/**
 * THE ROLE OF A HOLDER (PL-030 / PL-075 — the TR34 walk): what a card's stored
 * resource is FOR, read off the manifest — a payment unit, a printed VP rule,
 * a declared delegate / trade role — never off a card's name in the console.
 * ONE vocabulary feeds the satellite's split, the extras explorer's types,
 * the Info ring and the target step's value line.
 */
const card = (name: CardName, resources?: number): CardModel => ({name, resources} as CardModel);
const input = (cards: ReadonlyArray<{name: string, resources?: number}>): SelectCardModel =>
  ({type: 'card', title: 't', buttonLabel: 'b', cards: cards as ReadonlyArray<CardModel>, min: 1, max: 1} as never);
const onCardGain = (icon: string, amount: number): ActionEffect => ({direction: 'gain', icon, amount, note: 'to a card'});

describe('holderRoles — what a stored resource is for', () => {
  it('a PAYMENT unit is its enabling card: EVA Mechs pay 5 for a Space card, Construction Mechs 5 for a Building or City card', () => {
    expect(holderRoleOf(CardName.EVA_MECHS)).to.deep.eq({kind: 'payment', unit: 'mechs', rate: 5, context: 'space'});
    expect(holderRoleOf(CardName.CONSTRUCTION_MECHS)).to.deep.eq({kind: 'payment', unit: 'constructionMechs', rate: 5, context: 'building-or-city'});
    // TR48: the THIRD unit stands by itself — no declaration in the card file (its action's good is a target to pick).
    expect(holderRoleOf(CardName.SUPERCOMPUTER)).to.deep.eq({kind: 'payment', unit: 'supercomputerData', rate: 2, context: 'science'});
  });

  it('a VP rule is the card\'s own printed «per resources here»: Mech Sports 1 per 1, Red Museum 1 per 2', () => {
    expect(holderRoleOf(CardName.MECH_SPORTS)).to.deep.eq({kind: 'vp', per: 1, each: 1});
    expect(holderRoleOf(CardName.RED_MUSEUM)).to.deep.eq({kind: 'vp', per: 2, each: 1});
  });

  it('DELEGATE and TRADE are the card\'s declaration (TR34 / the censuses, TR66); a holder with no role is storage', () => {
    // The declaration carries its PRICE — the very constant the card's action reads (TR48 walk: «per unit» lied for 3 data).
    expect(holderRoleOf(CardName.MARS_ARMY_MECHS)).to.deep.eq({kind: 'delegate', price: 1});
    expect(holderRoleOf(CardName.MARTIAN_CENSUS)).to.deep.eq({kind: 'delegate', price: 3});
    expect(holderRoleOf(CardName.VENUSIAN_CENSUS)).to.deep.eq({kind: 'delegate', price: 3});
    expect(holderRoleOf(CardName.AUTOMATED_CONVOYS)).to.deep.eq({kind: 'trade', price: 1});
    expect(holderRoleOf(CardName.EARTH_ARMY_CONTRACT), 'fighters that score nothing, pay nothing and buy nothing by themselves — storage').to.deep.eq({kind: 'store'});
    expect(holderRoleOf('No Such Card' as CardName)).to.deep.eq({kind: 'store'});
  });

  it('an ACTION role is what the card\'s own declarative action BUYS with the resource (PL-135 — exported, never declared): TR40, TR38, TR02, TR05, Local Shading', () => {
    expect(holderRoleOf(CardName.FORESTRY_MECHS)).to.deep.eq({kind: 'action', spend: 1, good: {kind: 'production', resource: 'plants', amount: 1}});
    expect(holderRoleOf(CardName.BIOLOGICAL_SIMULATIONS)).to.deep.eq({kind: 'action', spend: 2, good: {kind: 'production', resource: 'plants', amount: 1}});
    expect(holderRoleOf(CardName.POLITICAL_SCIENCE)).to.deep.eq({kind: 'action', spend: 3, good: {kind: 'cards', amount: 1}});
    expect(holderRoleOf(CardName.VECTOR_COMPUTATIONS)).to.deep.eq({kind: 'action', spend: 4, good: {kind: 'cards', amount: 1, tag: 'space'}});
    expect(holderRoleOf(CardName.LOCAL_SHADING)).to.deep.eq({kind: 'action', spend: 1, good: {kind: 'production', resource: 'megacredits', amount: 1}});
    // Generically or not at all: a bespoke action — storage.
    expect(holderRoleOf(CardName.HABITAT_SCIENCE), 'a bespoke action').to.deep.eq({kind: 'store'});
    // Precedence: a payment unit and a printed VP rule outrank the action's good.
    expect(holderRoleOf(CardName.EVA_MECHS).kind).to.eq('payment');
    expect(holderRoleOf(CardName.MECH_SPORTS).kind).to.eq('vp');
  });

  it('the value line: a payment names its rate and WHERE, a delegate and a trade their verb; VP and storage say nothing (the VP line is the step\'s own)', () => {
    expect(holderRoleReading(holderRoleOf(CardName.EVA_MECHS))).to.deep.eq({label: 'Pays ${0} M€ per unit', params: ['5'], tail: 'for cards with a space tag'});
    // `params` is REQUIRED on a reading (PL-160): an empty list for a key without placeholders.
    expect(holderRoleReading({kind: 'delegate', price: 1})).to.deep.eq({label: 'A delegate on a resolution per unit', params: []});
    expect(holderRoleReading({kind: 'trade', price: 1})).to.deep.eq({label: 'A free trade per unit', params: []});
    // A price above one is NAMED: the census's «a delegate per 3 data».
    expect(holderRoleReading(holderRoleOf(CardName.MARTIAN_CENSUS))).to.deep.eq({label: 'A delegate on a resolution per ${0} units', params: ['3']});
    expect(holderRoleReading({kind: 'trade', price: 2})).to.deep.eq({label: 'A free trade per ${0} units', params: ['2']});
    expect(holderRoleReading({kind: 'vp', per: 1, each: 1})).to.eq(undefined);
    expect(holderRoleReading({kind: 'store'})).to.eq(undefined);
    expect(HOLDER_ROLE_CAPTION).to.deep.eq({payment: 'money', vp: 'VP', delegate: 'Delegates', trade: 'trade'});
  });

  it('the ACTION role\'s value line: «Spend N from here: +M» with the good\'s icon and its tail; its caption is the good\'s family word; a production good rides the plate', () => {
    const forestry = holderRoleOf(CardName.FORESTRY_MECHS);
    expect(holderRoleReading(forestry)).to.deep.eq({label: 'Spend ${0} from here: +${1}', params: ['1', '1'], tail: 'production'});
    expect(holderRoleIcon(forestry)).to.eq('plants');
    expect(holderRolePlate(forestry)).to.eq('production');
    expect(holderRoleCaption(forestry)).to.eq('production');
    const political = holderRoleOf(CardName.POLITICAL_SCIENCE);
    expect(holderRoleReading(political)).to.deep.eq({label: 'Spend ${0} from here: +${1}', params: ['3', '1'], tail: 'card'});
    expect(holderRoleIcon(political)).to.eq('cards');
    expect(holderRolePlate(political)).to.eq(undefined);
    expect(holderRoleCaption(political)).to.eq('cards');
    expect(holderRoleReading({kind: 'action', spend: 3, good: {kind: 'tr', amount: 1}})).to.deep.eq({label: 'Spend ${0} from here: +${1}', params: ['3', '1'], tail: 'TR'});
    expect(holderRoleReading({kind: 'action', spend: 2, good: {kind: 'global', parameter: 'venus', steps: 1}})).to.deep.eq({label: 'Spend ${0} from here: +${1}', params: ['2', '1'], tail: 'venus'});
    expect(holderRoleReading({kind: 'action', spend: 1, good: {kind: 'stock', resource: 'titanium' as never, amount: 2}})).to.deep.eq({label: 'Spend ${0} from here: +${1}', params: ['1', '2']});
    expect(holderRoleCaption({kind: 'store'})).to.eq(undefined);
    expect(holderRoleCaption(holderRoleOf(CardName.EVA_MECHS))).to.eq('money');
  });

  it('PL-484 (К-§6.1): ONE PRICE, A CHOICE OF GOODS is an action role with its whole set — every icon, the plate only when every good is production, the family word, «+N production of your choice»', () => {
    const mining = holderRoleOf(CardName.MINING_MECHS);
    expect(mining).to.deep.eq({kind: 'action', spend: 2, good: {kind: 'production', resource: 'steel', amount: 1}, or: [{kind: 'production', resource: 'titanium', amount: 1}]});
    expect(holderRoleIsChoice(mining)).to.eq(true);
    expect(holderRoleIcons(mining)).to.deep.eq(['steel', 'titanium']);
    expect(holderRolePlate(mining)).to.eq('production');
    expect(holderRoleCaption(mining)).to.eq('production');
    // One amount for both goods — said once; the words in the TAIL, never translated inside a param.
    expect(holderRoleReading(mining)).to.deep.eq({label: 'Spend ${0} from here: +${1}', params: ['2', '1'], tail: 'production of your choice'});
    const atmo = holderRoleOf(CardName.ATMO_COLLECTORS);
    expect(holderRoleIcons(atmo)).to.deep.eq(['titanium', 'energy', 'heat']);
    expect(holderRolePlate(atmo), 'stock goods ride no plate').to.eq(undefined);
    expect(holderRoleCaption(atmo)).to.eq('resources');
    // Different amounts — in the icons' order.
    expect(holderRoleReading(atmo)).to.deep.eq({label: 'Spend ${0} from here: +${1}', params: ['1', '2 / 3 / 4'], tail: 'of your choice'});
    // A choice ACROSS families has no family word but the action's own; a mixed set rides no plate.
    const mixed = {kind: 'action', spend: 1, good: {kind: 'production', resource: 'megacredits', amount: 1}, or: [{kind: 'stock', resource: 'titanium', amount: 2}]} as const;
    expect(holderRoleCaption(mixed as never)).to.eq('Action');
    expect(holderRolePlate(mixed as never)).to.eq(undefined);
    // A single good is no choice: one icon, as before.
    expect(holderRoleIsChoice(holderRoleOf(CardName.FORESTRY_MECHS))).to.eq(false);
    expect(holderRoleIcons(holderRoleOf(CardName.FORESTRY_MECHS))).to.deep.eq(['plants']);
    expect(holderRoleIcons({kind: 'delegate', price: 1})).to.deep.eq(['delegate']);
    expect(holderRoleIcons({kind: 'store'})).to.deep.eq([]);
    // The lane of a choice is its whole set: steel OR titanium production is not steel production alone.
    expect(mining.kind === 'action' ? actionRoleGoodKey(mining) : '').to.eq('production-steel|production-titanium');
    expect(holderGroupKey('Mech' as never, mining, true, false, true)).to.eq('mech:action:production-steel|production-titanium');
  });

  it('PL-484: a choice\'s gain / loss outcomes wear the whole set too — «The action opens: 2 / 2» under [steel] / [titanium]', () => {
    const mining = holderRoleOf(CardName.MINING_MECHS);
    const opens = holderGainOutcome(mining, 1, 3);
    expect(opens).to.deep.include({kind: 'reach', good: 'action', have: 3, need: 2, state: 'opens'});
    expect(holderGainOutcomeIcons(opens!)).to.deep.eq(['steel', 'titanium']);
    expect(holderGainOutcomeIcon(opens!), 'the single-icon reader keeps the first good').to.eq('steel');
    const lost = holderLossOutcome(mining, 2, 1);
    expect(holderGainOutcomeIcons(lost!)).to.deep.eq(['steel', 'titanium']);
    expect(holderGainOutcomeIcons({kind: 'money', amount: 4, context: 'any'} as never)).to.deep.eq(['megacredits']);
  });

  it('К-R1 (TR46): a BESPOKE action\'s declared good — «All from here: as many cards off the deck, 1 to the hand», the card icon', () => {
    const startups = holderRoleOf(CardName.RESEARCH_STARTUPS);
    expect(startups).to.deep.eq({kind: 'action', spend: 'all', good: {kind: 'look', keep: 1}});
    expect(holderRoleReading(startups)).to.deep.eq({label: 'All from here: as many cards off the deck, ${0} to the hand', params: ['1']});
    expect(holderRoleIcon(startups)).to.eq('cards');
    expect(holderRoleCaption(startups)).to.eq('cards');
    expect(holderRolePlate(startups)).to.eq(undefined);
  });

  it('a role CLAIMS (tender, a delegate, a trade, an action\'s good) or it does not (a VP rule, storage) — only a claiming role of a split type gets a key of its own; a payment keyed by its UNIT when two tender pools stand', () => {
    expect(['payment', 'delegate', 'trade', 'action'].map((k) => holderRoleClaims(k as never))).to.deep.eq([true, true, true, true]);
    expect(['vp', 'store'].map((k) => holderRoleClaims(k as never))).to.deep.eq([false, false]);
    expect(holderGroupKey('Mech' as never, {kind: 'delegate', price: 1}, false)).to.eq('mech');
    expect(holderGroupKey('Mech' as never, {kind: 'delegate', price: 1}, true)).to.eq('mech:delegate');
    expect(holderGroupKey('Mech' as never, {kind: 'vp', per: 1, each: 1}, true), 'the plain group keeps the resource\'s own address').to.eq('mech');
    expect(holderGroupKey('Mech' as never, {kind: 'store'}, true)).to.eq('mech');
    expect(holderGroupKey('Mech' as never, holderRoleOf(CardName.FORESTRY_MECHS), true)).to.eq('mech:action');
    const eva = holderRoleOf(CardName.EVA_MECHS);
    expect(holderGroupKey('Mech' as never, eva, true), 'one tender pool — the address it always had').to.eq('mech:payment');
    expect(holderGroupKey('Mech' as never, eva, true, true), 'two tender pools — the unit is the address (PL-136)').to.eq('mech:payment:mechs');
  });
});

describe('additionalResourceRoleGroups — a chip per MEANING, never one number under one coin (PL-030)', () => {
  it('one holder, one role: the group is the resource\'s — key, total and holders exactly as before', () => {
    const groups = additionalResourceRoleGroups([card(CardName.EVA_MECHS, 2)]);
    expect(groups.map((g) => [g.key, g.total, g.split, g.role.kind])).to.deep.eq([['mech', 2, false, 'payment']]);
  });

  it('EVA Mechs beside Mars Army Mechs: TWO mech groups — tender 1, delegates 2 — in first-appearance order, each marked split', () => {
    const groups = additionalResourceRoleGroups([card(CardName.EVA_MECHS, 1), card(CardName.MARS_ARMY_MECHS, 2)]);
    expect(groups.map((g) => [g.key, g.total, g.split])).to.deep.eq([['mech:payment', 1, true], ['mech:delegate', 2, true]]);
    expect(groups.map((g) => g.cards.map((c) => c.name))).to.deep.eq([[CardName.EVA_MECHS], [CardName.MARS_ARMY_MECHS]]);
    const reversed = additionalResourceRoleGroups([card(CardName.MARS_ARMY_MECHS, 2), card(CardName.EVA_MECHS, 1)]);
    expect(reversed.map((g) => g.key), 'the play order decides the order').to.deep.eq(['mech:delegate', 'mech:payment']);
  });

  it('five mech holders, four meanings: the plain count (VP) · tender ×2 (PL-136: a coin PER UNIT when two pools stand) · delegates · trade — zeros included', () => {
    const groups = additionalResourceRoleGroups([
      card(CardName.MECH_SPORTS, 3), card(CardName.EVA_MECHS, 2), card(CardName.MARS_ARMY_MECHS, 1), card(CardName.AUTOMATED_CONVOYS, 0), card(CardName.CONSTRUCTION_MECHS, 4),
    ]);
    expect(groups.map((g) => [g.key, g.total])).to.deep.eq([['mech', 3], ['mech:payment:mechs', 2], ['mech:delegate', 1], ['mech:trade', 0], ['mech:payment:constructionMechs', 4]]);
    expect(groups[0].role.kind, 'the plain group scores — every holder in it is a VP rule').to.eq('vp');
    expect(groups.map((g) => g.unitSplit), 'every group of the type knows the tender pools are two').to.deep.eq([true, true, true, true, true]);
    expect(groups[1].cards.map((c) => c.name), 'EVA\'s Space mechs are their own coin').to.deep.eq([CardName.EVA_MECHS]);
    expect(groups[4].cards.map((c) => c.name), 'Construction Mechs\' Building mechs are their own coin').to.deep.eq([CardName.CONSTRUCTION_MECHS]);
  });

  it('SIX mech holders, FIVE meanings (TR40): tender ×2 · VP · delegates · trade · the action\'s good — TR40\'s mechs never share the VP chip', () => {
    const groups = additionalResourceRoleGroups([
      card(CardName.FORESTRY_MECHS, 2), card(CardName.EVA_MECHS, 1), card(CardName.CONSTRUCTION_MECHS, 1), card(CardName.MECH_SPORTS, 1),
      card(CardName.MARS_ARMY_MECHS, 1), card(CardName.AUTOMATED_CONVOYS, 1),
    ]);
    expect(groups.map((g) => [g.key, g.total, g.role.kind])).to.deep.eq([
      ['mech:action', 2, 'action'], ['mech:payment:mechs', 1, 'payment'], ['mech:payment:constructionMechs', 1, 'payment'],
      ['mech', 1, 'vp'], ['mech:delegate', 1, 'delegate'], ['mech:trade', 1, 'trade'],
    ]);
    // One tender pool beside the action's: the coin keeps its old address, the action keeps its own.
    const two = additionalResourceRoleGroups([card(CardName.FORESTRY_MECHS, 2), card(CardName.EVA_MECHS, 1)]);
    expect(two.map((g) => [g.key, g.unitSplit])).to.deep.eq([['mech:action', false], ['mech:payment', false]]);
  });

  it('PL-484: TR57 beside TR40 — a CHOICE of goods is its own lane: «[mech] 3 · steel / titanium production» and «[mech] 2 · plant production», never one chip', () => {
    const groups = additionalResourceRoleGroups([card(CardName.MINING_MECHS, 3), card(CardName.FORESTRY_MECHS, 2)]);
    expect(groups.map((g) => [g.key, g.total, g.role.kind, g.goodSplit])).to.deep.eq([
      ['mech:action:production-steel|production-titanium', 3, 'action', true],
      ['mech:action:production-plants', 2, 'action', true],
    ]);
    // Alone on the table it is the resource's own chip, as every unsplit holder is.
    expect(additionalResourceRoleGroups([card(CardName.MINING_MECHS, 3)]).map((g) => [g.key, g.split])).to.deep.eq([['mech', false]]);
  });

  it('SEVEN mech holders, SIX meanings (TR50, PL-223): two action GOODS are two chips — Forestry\'s plant production never speaks for Expedition Mechs\' card', () => {
    const groups = additionalResourceRoleGroups([
      card(CardName.EVA_MECHS, 2), card(CardName.CONSTRUCTION_MECHS, 1), card(CardName.MECH_SPORTS, 3), card(CardName.MARS_ARMY_MECHS, 1),
      card(CardName.AUTOMATED_CONVOYS, 1), card(CardName.FORESTRY_MECHS, 2), card(CardName.EXPEDITION_MECHS, 1),
    ]);
    expect(groups.map((g) => [g.key, g.total, g.role.kind])).to.deep.eq([
      ['mech:payment:mechs', 2, 'payment'], ['mech:payment:constructionMechs', 1, 'payment'], ['mech', 3, 'vp'], ['mech:delegate', 1, 'delegate'],
      ['mech:trade', 1, 'trade'], ['mech:action:production-plants', 2, 'action'], ['mech:action:cards', 1, 'action'],
    ]);
    expect(groups[5].role).to.deep.eq({kind: 'action', spend: 1, good: {kind: 'production', resource: 'plants', amount: 1}});
    expect(groups[6].role, 'TR50\'s mech buys a card').to.deep.eq({kind: 'action', spend: 1, good: {kind: 'cards', amount: 1}});
    expect(groups.map((g) => g.goodSplit), 'every group of the type knows the action goods are two').to.deep.eq([true, true, true, true, true, true, true]);
    // One action good (TR40 alone, or TR40 beside a second plant-production holder): the address it always had.
    const one = additionalResourceRoleGroups([card(CardName.FORESTRY_MECHS, 2), card(CardName.EVA_MECHS, 1)]);
    expect(one.map((g) => [g.key, g.goodSplit])).to.deep.eq([['mech:action', false], ['mech:payment', false]]);
    expect(holderGroupKey('Mech' as never, holderRoleOf(CardName.EXPEDITION_MECHS), true, false, true)).to.eq('mech:action:cards');
    expect(actionGoodKey({kind: 'cards', amount: 1, tag: 'space' as never})).to.eq('cards-space');
  });

  it('data holders split the same way: the census (delegates) apart, the museum (VP) alone on the plain chip, TR02\'s draw (an action good) apart — and an unrelated type stays whole', () => {
    const groups = additionalResourceRoleGroups([
      card(CardName.MARTIAN_CENSUS, 3), card(CardName.RED_MUSEUM, 2), card(CardName.POLITICAL_SCIENCE, 1), card(CardName.MECH_SPORTS, 1),
    ]);
    expect(groups.map((g) => [g.key, g.total, g.split])).to.deep.eq([['data:delegate', 3, true], ['data', 2, true], ['data:action', 1, true], ['mech', 1, false]]);
    expect(groups[1].role.kind, 'the museum alone on the plain lane scores').to.eq('vp');
    expect(groups[2].role).to.deep.eq({kind: 'action', spend: 3, good: {kind: 'cards', amount: 1}});
  });

  it('five FIGHTER holders, three meanings (TR35): Security Fleet / TR08 score, TR28 / TR29 store — ONE plain chip; Mars Army Ships\' delegates apart', () => {
    expect([CardName.SECURITY_FLEET, CardName.FORMULA_ZERO, CardName.EARTH_ARMY_CONTRACT, CardName.SPACESHIP_RECYCLING, CardName.MARS_ARMY_SHIPS]
      .map((name) => holderRoleOf(name).kind)).to.deep.eq(['vp', 'vp', 'store', 'store', 'delegate']);
    const groups = additionalResourceRoleGroups([
      card(CardName.SECURITY_FLEET, 2), card(CardName.MARS_ARMY_SHIPS, 2), card(CardName.FORMULA_ZERO, 1), card(CardName.EARTH_ARMY_CONTRACT, 1), card(CardName.SPACESHIP_RECYCLING, 0),
    ]);
    expect(groups.map((g) => [g.key, g.total, g.split])).to.deep.eq([['fighter', 4, true], ['fighter:delegate', 2, true]]);
    expect(groups[0].role.kind, 'VP mixed with storage reads as storage — no VP badge over TR28\'s TR fuel').to.eq('store');
    expect(groups[1].cards.map((c) => c.name)).to.deep.eq([CardName.MARS_ARMY_SHIPS]);
  });

  it('two VP holders of one type are NOT a split (Tardigrades + Decomposers): one «microbe» chip, as it always was — while a holder whose microbes BUY a TR step (Nitrite Reducing Bacteria) stands apart', () => {
    const groups = additionalResourceRoleGroups([card(CardName.TARDIGRADES, 1), card(CardName.DECOMPOSERS, 3)]);
    expect(groups.map((g) => [g.key, g.total, g.split, g.role.kind])).to.deep.eq([['microbe', 4, false, 'vp']]);
    const bought = additionalResourceRoleGroups([card(CardName.TARDIGRADES, 1), card(CardName.NITRITE_REDUCING_BACTERIA, 3)]);
    expect(bought.map((g) => [g.key, g.total, g.split, g.role.kind])).to.deep.eq([['microbe', 1, true, 'vp'], ['microbe:action', 3, true, 'action']]);
  });

  it('the extras explorer and the Info ring stand on the same groups: the types\' keys and captions follow the split, the tender badge stays with the payment group', () => {
    const tableau = [card(CardName.EVA_MECHS, 1), card(CardName.MARS_ARMY_MECHS, 2)];
    const groups = additionalResourceRoleGroups(tableau);
    const types = buildExtrasTypes({
      groups, detailsCards: [], vpVisible: true,
      lookup: () => ({isCorporation: false, hasAction: true}),
      payments: new Map([['Mech' as never, {text: '5', rates: [5], facts: [{unit: 'mechs', rate: 5, context: 'space', source: CardName.EVA_MECHS, spendableAmount: 1}]}]]),
    });
    expect(types.map((t) => [t.key, t.roleCaption, t.payment !== undefined])).to.deep.eq([['mech:payment', 'money', true], ['mech:delegate', 'Delegates', false]]);
    expect(infoExtrasChips({tableau}, undefined).map((c) => c.key)).to.deep.eq(['mech:payment', 'mech:delegate']);
    // One role → the old address, no caption.
    const alone = buildExtrasTypes({groups: additionalResourceRoleGroups([card(CardName.EVA_MECHS, 1)]), detailsCards: [], vpVisible: true, lookup: () => undefined});
    expect(alone.map((t) => [t.key, t.roleCaption])).to.deep.eq([['mech', undefined]]);
  });
});

describe('the target step\'s VALUE LINE (PL-075) — what one unit is worth on the candidate', () => {
  it('a mech onto Mars Army Mechs: the counter, then «a delegate on a resolution per unit» — static, with the delegate\'s icon', () => {
    const impacts = playedTargetQuickImpacts(playedTargetPreviewFor(undefined, input([{name: CardName.MARS_ARMY_MECHS, resources: 2}]), CardName.MARS_ARMY_MECHS, [onCardGain('mech', 1)]));
    expect(impacts.map((i) => i.label)).to.deep.eq(['Resources on this card', 'A delegate on a resolution per unit']);
    expect(impacts[0]).to.include({from: 2, to: 3});
    expect(impacts[1]).to.include({value: true, icon: 'delegate'});
  });

  it('a mech onto EVA Mechs: the GAIN\'s money takes the value line\'s slot (К-T1) — «payment: +5 M€ · for cards with a space tag»', () => {
    const impacts = playedTargetQuickImpacts(playedTargetPreviewFor(undefined, input([{name: CardName.EVA_MECHS, resources: 1}]), CardName.EVA_MECHS, [onCardGain('mech', 1)]));
    expect(impacts.map((i) => i.label)).to.deep.eq(['Resources on this card', 'Payment: +${0} M€']);
    expect(impacts[1]).to.include({tail: 'for cards with a space tag', outcome: 'gain', icon: 'megacredits'});
    expect(impacts[1].params).to.deep.eq(['5']);
    // A LOSS reads what it COSTS in the same slot (PL-267, TR52 — it used to keep the per-unit value line, which said
    // what a unit is worth and never what leaving cost): TR29's source step spending the tender loses 5 M€ of payment.
    const step = {kind: 'input', amount: -1, cardResource: 'mech'} as never;
    const spent = playedTargetQuickImpacts(playedTargetPreviewFor(step, input([{name: CardName.EVA_MECHS, resources: 2}]), CardName.EVA_MECHS));
    expect(spent.map((i) => i.label)).to.deep.eq(['Resources on this card', 'Payment: −${0} M€']);
    expect(spent[1]).to.include({tail: 'for cards with a space tag', outcome: 'loss', icon: 'megacredits'});
    expect(spent[1].params).to.deep.eq(['5']);
  });

  it('К-T1 beside the value line: a priced holder ALREADY within reach keeps the value line (the gain opens nothing); one the gain reaches reads the outcome', () => {
    // Mars Army Mechs at 2 (1 a delegate) +1: already within reach → the value line, unchanged.
    const full = playedTargetQuickImpacts(playedTargetPreviewFor(undefined, input([{name: CardName.MARS_ARMY_MECHS, resources: 2}]), CardName.MARS_ARMY_MECHS, [onCardGain('mech', 1)]));
    expect(full.map((i) => i.outcome ?? (i.value === true ? 'value' : ''))).to.deep.eq(['', 'value']);
    // …at 0 +1: the gain brings the delegate within reach → the outcome in the value line's slot.
    const empty = playedTargetQuickImpacts(playedTargetPreviewFor(undefined, input([{name: CardName.MARS_ARMY_MECHS, resources: 0}]), CardName.MARS_ARMY_MECHS, [onCardGain('mech', 1)]));
    expect(empty.map((i) => i.label)).to.deep.eq(['Resources on this card', 'A delegate within reach: ${0} / ${1}']);
    expect(empty[1].params).to.deep.eq(['1', '1']);
  });

  it('PL-484: mechs onto Mining Mechs — the value line, the outcome and the tag wear BOTH goods on the plate («[steel] / [titanium]»), never the first for the set', () => {
    const preview = playedTargetPreviewFor(undefined, input([{name: CardName.MINING_MECHS, resources: 1}]), CardName.MINING_MECHS, [onCardGain('mech', 3)]);
    const impacts = preview.flatMap((s) => s.impacts);
    const value = impacts.find((i) => i.value === true && i.label === 'Spend ${0} from here: +${1}');
    expect(value).to.include({tail: 'production of your choice', plate: 'production', icon: 'steel'});
    expect(value?.icons).to.deep.eq(['steel', 'titanium']);
    // 1 → 4 of 2: the gain opens the action — the outcome wears the set too.
    const opens = impacts.find((i) => i.outcome === 'opens');
    expect(opens?.icons).to.deep.eq(['steel', 'titanium']);
    const tag = preview.find((s) => s.tag !== undefined)?.tag;
    expect(tag).to.deep.include({icon: 'steel', plate: 'production', reached: true, tone: 'opens'});
    expect(tag?.icons).to.deep.eq(['steel', 'titanium']);
    // A single good carries no `icons` — the renderers' old path, untouched.
    const forestry = playedTargetPreviewFor(undefined, input([{name: CardName.FORESTRY_MECHS, resources: 0}]), CardName.FORESTRY_MECHS, [onCardGain('mech', 1)]);
    expect(forestry.flatMap((s) => s.impacts).some((i) => i.icons !== undefined)).to.eq(false);
    expect(forestry.find((s) => s.tag !== undefined)?.tag?.icons).to.eq(undefined);
  });

  it('a mech onto Forestry Mechs (PL-135): «spend 1 from here: +1 · production» with the plants icon ON THE PLATE; data onto Biological Simulations: «spend 2 from here: +1 · production»', () => {
    const forestry = playedTargetQuickImpacts(playedTargetPreviewFor(undefined, input([{name: CardName.FORESTRY_MECHS, resources: 2}]), CardName.FORESTRY_MECHS, [onCardGain('mech', 1)]));
    expect(forestry.map((i) => i.label)).to.deep.eq(['Resources on this card', 'Spend ${0} from here: +${1}']);
    expect(forestry[0]).to.include({from: 2, to: 3});
    expect(forestry[1]).to.include({value: true, icon: 'plants', tail: 'production', plate: 'production'});
    expect(forestry[1].params).to.deep.eq(['1', '1']);
    const simulations = playedTargetQuickImpacts(playedTargetPreviewFor(undefined, input([{name: CardName.BIOLOGICAL_SIMULATIONS, resources: 1}]), CardName.BIOLOGICAL_SIMULATIONS, [onCardGain('data', 2)]));
    expect(simulations[1]).to.include({value: true, icon: 'plants', tail: 'production', plate: 'production'});
    expect(simulations[1].params).to.deep.eq(['2', '1']);
    // A draw's good: the card icon, no plate.
    const political = playedTargetQuickImpacts(playedTargetPreviewFor(undefined, input([{name: CardName.POLITICAL_SCIENCE, resources: 0}]), CardName.POLITICAL_SCIENCE, [onCardGain('data', 1)]));
    expect(political[1]).to.include({value: true, icon: 'cards', tail: 'card'});
    expect(political[1].plate).to.eq(undefined);
  });

  it('a fighter spent FROM Mars Army Ships (TR29\'s source step, −1): the counter falls, and the slot says what the loss costs — the delegate stays within reach (PL-267)', () => {
    const step = {kind: 'input', amount: -1, cardResource: 'fighter'} as never;
    const impacts = playedTargetQuickImpacts(playedTargetPreviewFor(step, input([{name: CardName.MARS_ARMY_SHIPS, resources: 2}]), CardName.MARS_ARMY_SHIPS));
    expect(impacts.map((i) => i.label)).to.deep.eq(['Resources on this card', 'A delegate still within reach: ${0} → ${1} / ${2}']);
    expect(impacts[0]).to.include({from: 2, to: 1, icon: 'fighter'});
    expect(impacts[1]).to.include({outcome: 'kept', icon: 'delegate'});
    expect(impacts[1].params).to.deep.eq(['2', '1', '1']);
    // …and the last fighter takes the delegate with it.
    const last = playedTargetQuickImpacts(playedTargetPreviewFor(step, input([{name: CardName.MARS_ARMY_SHIPS, resources: 1}]), CardName.MARS_ARMY_SHIPS));
    expect(last[1]).to.include({label: 'No longer a delegate within reach: ${0} → ${1} / ${2}', outcome: 'lost'});
  });

  it('PL-219 — THE OUTCOME TAG under every candidate: the family of seven reads by meaning in glyphs and digits, from the same outcome as the rail', () => {
    const tagOf = (name: CardName, resources: number, vpBox?: Record<string, {from: number, to: number}>) =>
      playedTargetTagOfPreview(playedTargetPreviewFor(undefined, input([{name, resources}]), name, [onCardGain('mech', 1)], vpBox as never));
    // TR56 (П4): the COUNT LEADS every answer that is not the count itself — «[мех] 2 → 3 · [M€] +5 [Космос]».
    expect(tagOf(CardName.EVA_MECHS, 2), 'tender: the money and the tag it pays for').to.deep.eq({lead: {icon: 'mech', text: '2 → 3'}, icon: 'megacredits', text: '+5', tone: 'gain', payTag: 'space'});
    expect(tagOf(CardName.CONSTRUCTION_MECHS, 1)).to.deep.eq({lead: {icon: 'mech', text: '1 → 2'}, icon: 'megacredits', text: '+5', tone: 'gain', payTag: 'building'});
    expect(tagOf(CardName.MECH_SPORTS, 3, {[CardName.MECH_SPORTS]: {from: 3, to: 4}}), 'a VP holder: its points').to.deep.eq({lead: {icon: 'mech', text: '3 → 4'}, word: 'VP', text: '3 → 4', tone: 'gain'});
    // Points that do not move are no answer — the count is (TR53 iteration: «ПО 0 → 0» under a 1-of-4 holder).
    expect(tagOf(CardName.MECH_SPORTS, 3, {[CardName.MECH_SPORTS]: {from: 3, to: 3}})?.word, 'still points: the count instead').to.eq(undefined);
    expect(tagOf(CardName.MARS_ARMY_MECHS, 1), 'a delegate already within reach: a quiet ✓ (the rail keeps the value line)').to.deep.eq({lead: {icon: 'mech', text: '1 → 2'}, icon: 'delegate', text: '', reached: true, tone: 'already'});
    expect(tagOf(CardName.MARS_ARMY_MECHS, 0), 'the gain brings it within reach: the ✓ (the leading count says how many — TR56)').to.deep.eq({lead: {icon: 'mech', text: '0 → 1'}, icon: 'delegate', text: '', reached: true, tone: 'opens'});
    expect(tagOf(CardName.FORESTRY_MECHS, 2), 'the action\'s good on its production plate').to.deep.include({icon: 'plants', plate: 'production', reached: true, tone: 'already'});
    expect(tagOf(CardName.EXPEDITION_MECHS, 0), 'TR50: the card its action draws').to.deep.eq({lead: {icon: 'mech', text: '0 → 1'}, icon: 'cards', text: '', reached: true, tone: 'opens'});
    // A priced good still SHORT after the gain: the fraction, no ✓ (data onto the census, 3 a delegate).
    const census = playedTargetTagOfPreview(playedTargetPreviewFor(undefined, input([{name: CardName.MARTIAN_CENSUS, resources: 0}]), CardName.MARTIAN_CENSUS, [onCardGain('data', 2)]));
    expect(census).to.deep.eq({lead: {icon: 'data', text: '0 → 2'}, icon: 'delegate', text: '2/3', tone: 'short'});
    // A LOSS wears no tag — the rail keeps the reading (TR29's source step).
    const spent = playedTargetPreviewFor({kind: 'input', amount: -1, cardResource: 'mech'} as never, input([{name: CardName.EVA_MECHS, resources: 2}]), CardName.EVA_MECHS);
    expect(playedTargetTagOfPreview(spent)).to.eq(undefined);
  });

  it('a mech onto Mech Sports: no value line of its own — the VP line is the step\'s, and storage says nothing', () => {
    const impacts = playedTargetQuickImpacts(playedTargetPreviewFor(undefined, input([{name: CardName.MECH_SPORTS, resources: 0}]), CardName.MECH_SPORTS, [onCardGain('mech', 1)]));
    expect(impacts.map((i) => i.label)).to.deep.eq(['Resources on this card']);
  });

  /**
   * К-T1 (TR48 — the owner's decision 2026-10-12): WHAT +N DO on a holder, by its role — the reading a «put N on
   * ANY card» target step prints for each candidate. The table is roles × the candidate's current → resulting.
   */
  describe('the gain outcome — what +N do here', () => {
    it('tender: the money it becomes, with its «where» (Supercomputer 0 → 2 = +4 M€ for a Science card)', () => {
      const outcome = holderGainOutcome(holderRoleOf(CardName.SUPERCOMPUTER), 0, 2);
      expect(outcome).to.deep.eq({kind: 'money', amount: 4, context: 'science'});
      expect(holderGainOutcomeReading(outcome!)).to.deep.eq({label: 'Payment: +${0} M€', params: ['4'], tail: 'for cards with a science tag'});
      expect(holderGainOutcomeIcon(outcome!)).to.eq('megacredits');
    });

    it('a priced DELEGATE (the census, 3 data): short · within reach · already within reach', () => {
      const census = holderRoleOf(CardName.MARTIAN_CENSUS);
      const read = (from: number, to: number) => holderGainOutcomeReading(holderGainOutcome(census, from, to)!);
      expect(read(0, 2)).to.deep.eq({label: '${2} more to a delegate: ${0} / ${1}', params: ['2', '3', '1']});
      expect(read(1, 3)).to.deep.eq({label: 'A delegate within reach: ${0} / ${1}', params: ['3', '3']});
      expect(read(3, 5)).to.deep.eq({label: 'A delegate already within reach: ${0} / ${1}', params: ['5', '3']});
      expect(holderGainOutcome(census, 1, 3)).to.deep.include({state: 'opens', have: 3, need: 3});
      expect(holderGainOutcomeIcon(holderGainOutcome(census, 1, 3)!)).to.eq('delegate');
    });

    it('a TRADE (TR66, 1 mech): one is within reach at once', () => {
      expect(holderGainOutcome(holderRoleOf(CardName.AUTOMATED_CONVOYS), 0, 1)).to.deep.include({kind: 'reach', good: 'trade', state: 'opens'});
    });

    it('the card\'s own ACTION at a numeric spend (TR38 2 data → +1 plant production): the threshold, the good\'s icon on its plate', () => {
      const sims = holderRoleOf(CardName.BIOLOGICAL_SIMULATIONS);
      expect(holderGainOutcome(sims, 0, 2)).to.deep.include({kind: 'reach', good: 'action', state: 'opens', have: 2, need: 2});
      expect(holderGainOutcome(sims, 0, 1)).to.deep.include({state: 'short'});
      expect(holderGainOutcomeIcon(holderGainOutcome(sims, 0, 2)!)).to.eq('plants');
      // TR02 at 3: 0 → 2 is still one short.
      expect(holderGainOutcomeReading(holderGainOutcome(holderRoleOf(CardName.POLITICAL_SCIENCE), 0, 2)!).params).to.deep.eq(['2', '3', '1']);
    });

    it('a LOOK (TR46 — every unit one more card turned over): the count it grows to', () => {
      const look = holderGainOutcome(holderRoleOf(CardName.RESEARCH_STARTUPS), 2, 4);
      expect(look).to.deep.eq({kind: 'look', from: 2, to: 4});
      expect(holderGainOutcomeReading(look!)).to.deep.eq({label: 'Cards turned over: ${0} → ${1}', params: ['2', '4']});
    });

    it('VP (the step\'s own line) and storage answer nothing; a loss answers nothing', () => {
      expect(holderGainOutcome(holderRoleOf(CardName.MARTIAN_FIBER), 1, 3)).to.eq(undefined);
      expect(holderGainOutcome({kind: 'store'}, 0, 2)).to.eq(undefined);
      expect(holderGainOutcome(holderRoleOf(CardName.MARTIAN_CENSUS), 3, 1)).to.eq(undefined);
    });
  });

  describe('the LOSS outcome — what −N cost there (PL-267, TR52)', () => {
    it('tender: the payment it no longer makes, with its «where» (Supercomputer 3 → 1 = −4 M€ for a Science card)', () => {
      const outcome = holderLossOutcome(holderRoleOf(CardName.SUPERCOMPUTER), 3, 1);
      expect(outcome).to.deep.eq({kind: 'money', amount: 4, context: 'science'});
      expect(holderLossOutcomeReading(outcome!)).to.deep.eq({label: 'Payment: −${0} M€', params: ['4'], tail: 'for cards with a science tag'});
      expect(holderGainOutcomeIcon(outcome!)).to.eq('megacredits');
    });

    it('a priced DELEGATE (the census, 3 data): lost · kept · further', () => {
      const census = holderRoleOf(CardName.MARTIAN_CENSUS);
      const read = (from: number, to: number) => holderLossOutcomeReading(holderLossOutcome(census, from, to)!);
      expect(read(3, 1)).to.deep.eq({label: 'No longer a delegate within reach: ${0} → ${1} / ${2}', params: ['3', '1', '3']});
      expect(read(5, 3)).to.deep.eq({label: 'A delegate still within reach: ${0} → ${1} / ${2}', params: ['5', '3', '3']});
      expect(read(2, 0)).to.deep.eq({label: 'Further from a delegate: ${0} → ${1} / ${2}', params: ['2', '0', '3']});
      expect(holderLossOutcome(census, 3, 1)).to.deep.include({kind: 'reach', good: 'delegate', state: 'lost'});
      expect(holderGainOutcomeIcon(holderLossOutcome(census, 3, 1)!)).to.eq('delegate');
    });

    it('a TRADE and the card\'s own ACTION at a numeric spend read their own words', () => {
      expect(holderLossOutcome(holderRoleOf(CardName.AUTOMATED_CONVOYS), 1, 0)).to.deep.include({kind: 'reach', good: 'trade', state: 'lost'});
      const sims = holderRoleOf(CardName.BIOLOGICAL_SIMULATIONS);
      expect(holderLossOutcome(sims, 4, 2)).to.deep.include({kind: 'reach', good: 'action', state: 'kept'});
      expect(holderLossOutcomeReading(holderLossOutcome(sims, 2, 0)!).label).to.eq('The action closes: ${0} → ${1} / ${2}');
    });

    it('a LOOK shrinks; a gain, VP and storage answer nothing', () => {
      expect(holderLossOutcome(holderRoleOf(CardName.RESEARCH_STARTUPS), 4, 2)).to.deep.eq({kind: 'look', from: 4, to: 2});
      expect(holderLossOutcome(holderRoleOf(CardName.MARTIAN_CENSUS), 1, 3)).to.eq(undefined);
      expect(holderLossOutcome(holderRoleOf(CardName.MARTIAN_FIBER), 3, 1)).to.eq(undefined);
      expect(holderLossOutcome({kind: 'store'}, 2, 0)).to.eq(undefined);
    });

    it('every loss reading prints exactly its placeholders (PL-160)', () => {
      const roles = [CardName.SUPERCOMPUTER, CardName.MARTIAN_CENSUS, CardName.AUTOMATED_CONVOYS, CardName.BIOLOGICAL_SIMULATIONS, CardName.RESEARCH_STARTUPS];
      for (const name of roles) {
        for (const [from, to] of [[5, 3], [3, 1], [2, 0]]) {
          const outcome = holderLossOutcome(holderRoleOf(name), from, to);
          if (outcome === undefined) {
            continue;
          }
          const reading = holderLossOutcomeReading(outcome);
          const holes = new Set((reading.label.match(/\$\{\d\}/g) ?? []));
          expect(reading.params.length, `${name} ${from} → ${to}: ${reading.label}`).to.eq(holes.size);
        }
      }
    });
  });
});
