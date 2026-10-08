import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {holderGroupKey, holderRoleClaims, holderRoleOf, holderRoleReading, HOLDER_ROLE_CAPTION} from '@/client/console/holderRoles';
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
    expect(holderRoleOf(CardName.POLITICAL_SCIENCE), 'data spent to draw — nothing the console names').to.deep.eq({kind: 'store'});
    expect(holderRoleOf('No Such Card' as CardName)).to.deep.eq({kind: 'store'});
  });

  it('the value line: a payment names its rate and WHERE, a delegate and a trade their verb; VP and storage say nothing (the VP line is the step\'s own)', () => {
    expect(holderRoleReading(holderRoleOf(CardName.EVA_MECHS))).to.deep.eq({label: 'Pays ${0} M€ per unit', params: ['5'], tail: 'for cards with a space tag'});
    expect(holderRoleReading({kind: 'delegate'})).to.deep.eq({label: 'A delegate on a resolution per unit'});
    expect(holderRoleReading({kind: 'trade'})).to.deep.eq({label: 'A free trade per unit'});
    expect(holderRoleReading({kind: 'vp', per: 1, each: 1})).to.eq(undefined);
    expect(holderRoleReading({kind: 'store'})).to.eq(undefined);
    expect(HOLDER_ROLE_CAPTION).to.deep.eq({payment: 'money', vp: 'VP', delegate: 'Delegates', trade: 'trade'});
  });

  it('a role CLAIMS (tender, a delegate, a trade) or it does not (a VP rule, storage) — only a claiming role of a split type gets a key of its own', () => {
    expect(['payment', 'delegate', 'trade'].map((k) => holderRoleClaims(k as never))).to.deep.eq([true, true, true]);
    expect(['vp', 'store'].map((k) => holderRoleClaims(k as never))).to.deep.eq([false, false]);
    expect(holderGroupKey('Mech' as never, {kind: 'delegate'}, false)).to.eq('mech');
    expect(holderGroupKey('Mech' as never, {kind: 'delegate'}, true)).to.eq('mech:delegate');
    expect(holderGroupKey('Mech' as never, {kind: 'vp', per: 1, each: 1}, true), 'the plain group keeps the resource\'s own address').to.eq('mech');
    expect(holderGroupKey('Mech' as never, {kind: 'store'}, true)).to.eq('mech');
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

  it('five mech holders, four meanings: the plain count (VP) · tender · delegates · trade — zeros included', () => {
    const groups = additionalResourceRoleGroups([
      card(CardName.MECH_SPORTS, 3), card(CardName.EVA_MECHS, 2), card(CardName.MARS_ARMY_MECHS, 1), card(CardName.AUTOMATED_CONVOYS, 0), card(CardName.CONSTRUCTION_MECHS, 4),
    ]);
    expect(groups.map((g) => [g.key, g.total])).to.deep.eq([['mech', 3], ['mech:payment', 6], ['mech:delegate', 1], ['mech:trade', 0]]);
    expect(groups[0].role.kind, 'the plain group scores — every holder in it is a VP rule').to.eq('vp');
    expect(groups[1].cards.map((c) => c.name), 'both tender pools under one chip (the coin names each lane)').to.deep.eq([CardName.EVA_MECHS, CardName.CONSTRUCTION_MECHS]);
  });

  it('data holders split the same way: the census (delegates) apart, the museum (VP) and a draw card (storage) ONE plain chip — and an unrelated type stays whole', () => {
    const groups = additionalResourceRoleGroups([
      card(CardName.MARTIAN_CENSUS, 3), card(CardName.RED_MUSEUM, 2), card(CardName.POLITICAL_SCIENCE, 1), card(CardName.MECH_SPORTS, 1),
    ]);
    expect(groups.map((g) => [g.key, g.total, g.split])).to.deep.eq([['data:delegate', 3, true], ['data', 3, true], ['mech', 1, false]]);
    expect(groups[1].role.kind, 'VP mixed with storage reads as storage — a VP badge over a draw card would lie').to.eq('store');
  });

  it('a VP holder beside a storage holder of one type is NOT a split (Tardigrades + Nitrite Reducing Bacteria): one «microbe» chip, as it always was', () => {
    const groups = additionalResourceRoleGroups([card(CardName.TARDIGRADES, 1), card(CardName.NITRITE_REDUCING_BACTERIA, 3)]);
    expect(groups.map((g) => [g.key, g.total, g.split, g.role.kind])).to.deep.eq([['microbe', 4, false, 'store']]);
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

  it('a mech onto Mech Sports: no value line of its own — the VP line is the step\'s, and storage says nothing', () => {
    const impacts = playedTargetQuickImpacts(playedTargetPreviewFor(undefined, input([{name: CardName.MECH_SPORTS, resources: 0}]), CardName.MECH_SPORTS, [onCardGain('mech', 1)]));
    expect(impacts.map((i) => i.label)).to.deep.eq(['Resources on this card']);
  });
});
