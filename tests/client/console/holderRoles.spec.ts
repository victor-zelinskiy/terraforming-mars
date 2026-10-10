import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {holderGroupKey, holderRoleCaption, holderRoleClaims, holderRoleIcon, holderRoleOf, holderRolePlate, holderRoleReading, HOLDER_ROLE_CAPTION} from '@/client/console/holderRoles';
import {additionalResourceRoleGroups} from '@/client/components/additionalResources/additionalResources';
import {buildExtrasTypes} from '@/client/console/extrasExplorerModel';
import {infoExtrasChips} from '@/client/console/infoExtrasChips';
import {playedTargetPreviewFor} from '@/client/console/played/consolePlayedTargetPreview';
import {playedTargetQuickImpacts} from '@/client/console/played/consolePlayedTargetModel';

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
  });

  it('a VP rule is the card\'s own printed «per resources here»: Mech Sports 1 per 1, Red Museum 1 per 2', () => {
    expect(holderRoleOf(CardName.MECH_SPORTS)).to.deep.eq({kind: 'vp', per: 1, each: 1});
    expect(holderRoleOf(CardName.RED_MUSEUM)).to.deep.eq({kind: 'vp', per: 2, each: 1});
  });

  it('DELEGATE and TRADE are the card\'s declaration (TR34 / the censuses, TR66); a holder with no role is storage', () => {
    expect(holderRoleOf(CardName.MARS_ARMY_MECHS)).to.deep.eq({kind: 'delegate'});
    expect(holderRoleOf(CardName.MARTIAN_CENSUS)).to.deep.eq({kind: 'delegate'});
    expect(holderRoleOf(CardName.VENUSIAN_CENSUS)).to.deep.eq({kind: 'delegate'});
    expect(holderRoleOf(CardName.AUTOMATED_CONVOYS)).to.deep.eq({kind: 'trade'});
    expect(holderRoleOf(CardName.EARTH_ARMY_CONTRACT), 'fighters that score nothing, pay nothing and buy nothing by themselves — storage').to.deep.eq({kind: 'store'});
    expect(holderRoleOf('No Such Card' as CardName)).to.deep.eq({kind: 'store'});
  });

  it('an ACTION role is what the card\'s own declarative action BUYS with the resource (PL-135 — exported, never declared): TR40, TR38, TR02, TR05, Local Shading', () => {
    expect(holderRoleOf(CardName.FORESTRY_MECHS)).to.deep.eq({kind: 'action', spend: 1, good: {kind: 'production', resource: 'plants', amount: 1}});
    expect(holderRoleOf(CardName.BIOLOGICAL_SIMULATIONS)).to.deep.eq({kind: 'action', spend: 2, good: {kind: 'production', resource: 'plants', amount: 1}});
    expect(holderRoleOf(CardName.POLITICAL_SCIENCE)).to.deep.eq({kind: 'action', spend: 3, good: {kind: 'cards', amount: 1}});
    expect(holderRoleOf(CardName.VECTOR_COMPUTATIONS)).to.deep.eq({kind: 'action', spend: 4, good: {kind: 'cards', amount: 1, tag: 'space'}});
    expect(holderRoleOf(CardName.LOCAL_SHADING)).to.deep.eq({kind: 'action', spend: 1, good: {kind: 'production', resource: 'megacredits', amount: 1}});
    // Generically or not at all: a choice of goods, a bespoke action — storage.
    expect(holderRoleOf(CardName.ATMO_COLLECTORS), 'one floater buys a CHOICE of three goods').to.deep.eq({kind: 'store'});
    expect(holderRoleOf(CardName.HABITAT_SCIENCE), 'a bespoke action').to.deep.eq({kind: 'store'});
    // Precedence: a payment unit and a printed VP rule outrank the action's good.
    expect(holderRoleOf(CardName.EVA_MECHS).kind).to.eq('payment');
    expect(holderRoleOf(CardName.MECH_SPORTS).kind).to.eq('vp');
  });

  it('the value line: a payment names its rate and WHERE, a delegate and a trade their verb; VP and storage say nothing (the VP line is the step\'s own)', () => {
    expect(holderRoleReading(holderRoleOf(CardName.EVA_MECHS))).to.deep.eq({label: 'Pays ${0} M€ per unit', params: ['5'], tail: 'for cards with a space tag'});
    expect(holderRoleReading({kind: 'delegate'})).to.deep.eq({label: 'A delegate on a resolution per unit'});
    expect(holderRoleReading({kind: 'trade'})).to.deep.eq({label: 'A free trade per unit'});
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

  it('a role CLAIMS (tender, a delegate, a trade, an action\'s good) or it does not (a VP rule, storage) — only a claiming role of a split type gets a key of its own; a payment keyed by its UNIT when two tender pools stand', () => {
    expect(['payment', 'delegate', 'trade', 'action'].map((k) => holderRoleClaims(k as never))).to.deep.eq([true, true, true, true]);
    expect(['vp', 'store'].map((k) => holderRoleClaims(k as never))).to.deep.eq([false, false]);
    expect(holderGroupKey('Mech' as never, {kind: 'delegate'}, false)).to.eq('mech');
    expect(holderGroupKey('Mech' as never, {kind: 'delegate'}, true)).to.eq('mech:delegate');
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

  it('a mech onto EVA Mechs: «pays 5 M€ per unit · for cards with a space tag»', () => {
    const impacts = playedTargetQuickImpacts(playedTargetPreviewFor(undefined, input([{name: CardName.EVA_MECHS, resources: 1}]), CardName.EVA_MECHS, [onCardGain('mech', 1)]));
    expect(impacts[1]).to.include({label: 'Pays ${0} M€ per unit', tail: 'for cards with a space tag', value: true, icon: 'megacredits'});
    expect(impacts[1].params).to.deep.eq(['5']);
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

  it('a fighter spent FROM Mars Army Ships (TR29\'s source step, −1): the counter falls, and the same value line says what leaves — a delegate\'s fuel', () => {
    const step = {kind: 'input', amount: -1, cardResource: 'fighter'} as never;
    const impacts = playedTargetQuickImpacts(playedTargetPreviewFor(step, input([{name: CardName.MARS_ARMY_SHIPS, resources: 2}]), CardName.MARS_ARMY_SHIPS));
    expect(impacts.map((i) => i.label)).to.deep.eq(['Resources on this card', 'A delegate on a resolution per unit']);
    expect(impacts[0]).to.include({from: 2, to: 1, icon: 'fighter'});
    expect(impacts[1]).to.include({value: true, icon: 'delegate'});
  });

  it('a mech onto Mech Sports: no value line of its own — the VP line is the step\'s, and storage says nothing', () => {
    const impacts = playedTargetQuickImpacts(playedTargetPreviewFor(undefined, input([{name: CardName.MECH_SPORTS, resources: 0}]), CardName.MECH_SPORTS, [onCardGain('mech', 1)]));
    expect(impacts.map((i) => i.label)).to.deep.eq(['Resources on this card']);
  });
});
