/*
 * ConsoleSitPayoutPart — ONE part of one seat's payout: the one renderer of a payout chip (an object and an amount, or
 * a skip with its reason), shared by the results card's «ВЫПЛАТЫ» and the step under it, «ПОДРОБНОСТИ ВЫПЛАТ». A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): it emits and exposes nothing — its contract is
 * the chip it draws for the part it is handed.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {PartyName} from '@/common/turmoil/PartyName';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {OWN_KIND_UNIT, ResultsPayoutPart} from '@/client/console/parliament/parliamentResultsModel';
import ConsoleSitPayoutPart from '@/client/components/console/parliament/ConsoleSitPayoutPart.vue';

const part = (over: Partial<ResultsPayoutPart> = {}): ResultsPayoutPart => ({id: 'p', kind: 'stock', unit: 'megacredits', production: false, ...over});

const chip = (props: {part: ResultsPayoutPart, leadsColony?: boolean}, attrs: Record<string, unknown> = {}) =>
  mount(ConsoleSitPayoutPart, {...globalConfig, props, attrs});

/** The classes the shared resolver gives an icon key — what a unit of the chip must wear. */
const sprite = (key: string): Array<string> => iconClassFor(key).split(' ').filter((c) => c !== '');

describe('ConsoleSitPayoutPart — one part of one seat\'s payout', () => {
  it('a number of a unit reads SIGNED beside its icon — a gain, a levy with its reason, a production step in its frame', () => {
    const gain = chip({part: part({amount: 6, party: PartyName.GREENS})}, {'class': 'from-host', 'data-from-host': 'yes'});
    // The template STARTS WITH ITS ROOT: the host's attributes land on the chip.
    expect((gain.element as HTMLElement).tagName).to.eq('SPAN');
    expect(gain.classes()).to.include.members(['con-sit__part', 'from-host']);
    expect(gain.attributes('data-from-host')).to.eq('yes');
    expect(gain.classes()).to.not.include('con-sit__part--skipped');
    expect(gain.attributes('data-sit-part')).to.eq('stock');
    const amount = gain.find('[data-sit-part-amount]');
    expect(amount.text()).to.eq('+6');
    expect(amount.attributes('data-sit-part-amount')).to.eq('6');
    expect(amount.classes()).to.not.include('con-sit__part-loss');
    expect(gain.find('i.con-sit__part-unit').classes()).to.include.members(sprite('megacredits'));
    expect(gain.find('img.con-sit__emblem').attributes('src'), 'the ruling party\'s own answer wears its emblem').to.eq(partyEmblemUrl(PartyName.GREENS));

    const levy = chip({part: part({amount: -10, owed: 12, note: 'Not enough M€'})});
    expect(levy.find('[data-sit-part-amount]').text(), 'a levy is read with its sign, never as a skip').to.eq('−10');
    expect(levy.find('[data-sit-part-amount]').classes()).to.include('con-sit__part-loss');
    expect(levy.find('[data-sit-part-note]').text()).to.eq($t('Not enough M€'));
    expect(levy.find('img.con-sit__emblem').exists()).to.eq(false);

    const step = chip({part: part({kind: 'production', unit: 'heat', production: true, amount: 1})});
    expect(step.find('i.con-sit__part-unit').classes()).to.include.members([...sprite('heat'), 'con-iyield__unit--prod']);
  });

  it('a skip NAMES itself — what it was and why; a level part at its target prints the calm phrase instead', () => {
    const skipped = chip({part: part({skipped: {title: 'Draw a card', reason: 'The deck is empty'}})});
    expect(skipped.classes()).to.include('con-sit__part--skipped');
    expect(skipped.find('.con-parl__chip-dim').text()).to.eq(`${$t('Skipped')} · ${$t('Draw a card')}`);
    expect(skipped.find('[data-sit-part-reason]').text()).to.eq($t('The deck is empty'));
    expect(skipped.find('[data-sit-part-amount]').exists(), 'a skip prints no amount').to.eq(false);

    const calm = chip({part: part({skipped: {title: 'Draw a card', reason: 'Already at the target'}, none: 'no draw needed'})});
    expect(calm.find('[data-sit-part-none]').text()).to.eq($t('no draw needed'));
    expect(calm.findAll('.con-parl__chip-dim').length, 'the calm phrase stands INSTEAD of the skip label').to.eq(1);
    expect(calm.find('[data-sit-part-reason]').text(), 'the server\'s reason still reads beside it').to.eq($t('Already at the target'));
  });

  it('an OBJECT is one record — a parameter\'s step with its rating, a city tier\'s stack, a walk of the Career, a colony led by its tile', async () => {
    const step = chip({part: part({kind: 'globalParameter', unit: '', amount: 2, parameter: {id: 'temperature', before: -20, after: -16}, tr: 2})});
    expect(step.find('i.con-sit__world-icon').classes()).to.include.members(['wgt-icon', 'wgt-icon--temperature']);
    const world = step.find('[data-sit-part-parameter]');
    expect(world.attributes('data-sit-part-param')).to.eq('temperature');
    expect(world.attributes('data-sit-part-steps')).to.eq('2');
    expect(world.findAll('b').map((b) => b.text())).to.deep.eq(['-20°C', '-16°C']);
    expect(step.find('[data-sit-part-tr]').text()).to.eq(translateTextWithParams('TR +${0}', ['2']));
    expect(step.find('[data-sit-part-amount]').exists(), 'the generic tail is not printed for an object').to.eq(false);

    const tier = chip({part: part({kind: 'city', unit: '', tile: 'city', stack: 2})});
    expect(tier.find('i.con-sit__door-tile').classes()).to.include('con-sit__door-tile--city');
    expect(tier.find('[data-sit-part-stack]').text()).to.eq('×2');
    expect(tier.find('[data-sit-part-tile-name]').exists()).to.eq(false);

    const walk = chip({part: part({kind: 'agenda', unit: '', walk: {from: 3, to: 4}, tr: 1, drawn: 1})});
    const marker = walk.find('[data-sit-part-walk]');
    expect(marker.attributes('data-sit-part-walk-from')).to.eq('3');
    expect(marker.attributes('data-sit-part-walk-to')).to.eq('4');
    expect(walk.find('[data-sit-part-tr]').text()).to.eq(translateTextWithParams('TR +${0}', ['1']));
    expect(walk.find('[data-sit-part-drawn]').text()).to.eq('+1');
    expect(walk.find('i.con-sit__part-unit').classes()).to.include.members(sprite('cards'));

    // A colony built for free: the tile's own name (a tile has no amount), led by its planet where the row groups by tile.
    const colony = chip({part: part({kind: 'colony', unit: '', tile: 'colony', colony: 'Luna'}), leadsColony: true});
    expect(colony.classes()).to.include('con-sit__part--colony');
    expect(colony.attributes('data-sit-part-colony')).to.eq('Luna');
    const lead = colony.find('[data-sit-part-tile]');
    expect(lead.find('.con-sit__part-planet').classes()).to.include('Luna-background');
    expect(lead.find('.con-sit__part-colony-name').text()).to.eq($t('Luna'));
    expect(colony.find('i.con-sit__door-tile').classes()).to.include('con-sit__door-tile--colony');
    expect(colony.find('[data-sit-part-tile-name]').text()).to.eq($t('Colony'));

    await colony.setProps({leadsColony: false});
    expect(colony.find('[data-sit-part-tile]').exists(), 'only the FIRST part of its colony carries the tile').to.eq(false);
    expect(colony.find('[data-sit-part-tile-name]').exists()).to.eq(true);
  });

  it('a resource onto CARDS — several kinds draw as one unit, a payout that asked nobody counts its cards, a spread names each recipient', () => {
    const several = chip({part: part({kind: 'cardResource', unit: '', units: ['Data', 'Microbe'], amount: 2})});
    const kinds = several.findAll('i.con-iyield__unit');
    expect(kinds.length, 'one icon per kind, joined by «or»').to.eq(2);
    expect(kinds[0].classes()).to.include.members([...sprite('data'), 'con-sit__part-unit']);
    expect(kinds[1].classes()).to.include.members([...sprite('microbe'), 'con-sit__part-unit']);
    expect(several.find('.con-iyield__or').text()).to.eq($t('or'));

    const each = chip({part: part({
      kind: 'cardResource', unit: OWN_KIND_UNIT, amount: 3, eachCard: 3,
      cards: [{card: 'Tardigrades', amount: 1, resource: 'Microbe'}, {card: 'Birds', amount: 1, resource: 'Animal'}, {card: 'Decomposers', amount: 1, resource: 'Microbe'}],
    })});
    expect(each.find('i.con-sit__part-unit').classes(), '«one of its own kind» is the face\'s «?» cube').to.include.members(sprite('wild'));
    const count = each.find('[data-sit-part-each]');
    expect(count.attributes('data-sit-part-each-count')).to.eq('3');
    expect(count.text()).to.eq(translateTextWithParams('on ${0} card(s)', ['3']));
    const paid = each.findAll('[data-sit-part-kind]');
    expect(paid.map((k) => k.attributes('data-sit-part-kind')), 'each kind once, in the cards\' order').to.deep.eq(['Microbe', 'Animal']);
    expect(paid[1].classes()).to.include.members(sprite('animal'));
    expect(each.find('[data-sit-part-card]').exists(), 'the names were the receipt\'s').to.eq(false);

    const spread = chip({part: part({kind: 'cardResource', unit: 'Microbe', amount: 3, cards: [{card: 'Tardigrades', amount: 2}, {card: 'Decomposers', amount: 1}]})});
    expect(spread.find('i.con-sit__part-unit').classes()).to.include.members(sprite('microbe'));
    const recipients = spread.findAll('[data-sit-part-card]');
    expect(recipients.map((c) => c.attributes('data-sit-part-card'))).to.deep.eq(['Tardigrades', 'Decomposers']);
    expect(recipients.map((c) => c.text())).to.deep.eq([`${$t('Tardigrades')} +2`, `${$t('Decomposers')} +1`]);
    expect(spread.find('[data-sit-part-each]').exists()).to.eq(false);
  });
});
