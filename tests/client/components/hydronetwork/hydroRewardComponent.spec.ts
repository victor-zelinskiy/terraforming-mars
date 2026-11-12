/*
 * HydroReward — the Hydronetwork's reward as a row of chips. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): two props in, nothing out — the spec is what it renders for them. (The pure reward
 * READING, `hydroReward.ts`, is `hydroReward.spec.ts` beside this file — hence this one's name.)
 * The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {Resource} from '@/common/Resource';
import HydroReward from '@/client/components/hydronetwork/HydroReward.vue';

// No i18n plugin on purpose: the component imports its own `v-i18n`. Leaning on the global registration would be a
// Vue warning here — and the warn handler fails the spec.
const bare = {config: globalConfig.global.config};

function reward(props: Record<string, unknown>) {
  return mount(HydroReward, {props, global: bare});
}

describe('HydroReward — the Hydronetwork\'s reward chips', () => {
  it('a stock gain is its amount and the resource\'s icon — a «1» is never printed', () => {
    const w = reward({chips: [{resource: Resource.STEEL, amount: 2}, {resource: Resource.PLANTS, amount: 1}, {resource: Resource.HEAT}]});
    expect(w.classes()).to.deep.eq(['hydro-reward']);
    const chips = w.findAll('.hydro-reward__chip');
    expect(chips).to.have.length(3);
    expect(chips[0].find('.hydro-reward__amt').text()).to.eq('2');
    expect(chips[0].find('.hydro-reward__icon').classes()).to.include.members(['resource_icon', 'resource_icon--steel']);
    expect(chips[0].find('.hydro-reward__icon').attributes('aria-hidden')).to.eq('true');
    expect(chips[1].find('.hydro-reward__amt').exists(), 'an amount of one').to.eq(false);
    expect(chips[1].find('.hydro-reward__icon').classes()).to.include('resource_icon--plants');
    expect(chips[2].find('.hydro-reward__amt').exists(), 'no amount at all').to.eq(false);
    expect(chips[2].find('.hydro-reward__icon').classes()).to.include('resource_icon--heat');
    expect(w.find('.hydro-reward__prod').exists(), 'a stock gain wears no production frame').to.eq(false);
    expect(w.find('.hydro-reward__chip--special').exists()).to.eq(false);
  });

  it('a production gain stands its icon inside the production frame', () => {
    const w = reward({chips: [{resource: Resource.ENERGY, amount: 1, production: true}, {resource: Resource.MEGACREDITS, amount: 2, production: true}]});
    const chips = w.findAll('.hydro-reward__chip');
    expect(chips).to.have.length(2);
    expect(chips[0].find('.hydro-reward__amt').exists()).to.eq(false);
    expect(chips[0].find('.hydro-reward__prod > .hydro-reward__icon').classes()).to.include.members(['resource_icon', 'resource_icon--energy']);
    expect(chips[1].find('.hydro-reward__amt').text()).to.eq('2');
    expect(chips[1].find('.hydro-reward__prod > .hydro-reward__icon').classes()).to.include('resource_icon--megacredits');
  });

  it('a special effect is its own glyphs and its label', () => {
    const w = reward({chips: [
      {special: 'plants-per-plant-tag'}, {special: 'add-2-animals'}, {special: 'jovian-tag'}, {special: 'draw-4-keep-2'}, {special: 'reuse-blue-action'},
    ]});
    const chips = w.findAll('.hydro-reward__chip--special');
    expect(chips.map((chip) => chip.find('.hydro-reward__label').text())).to.deep.eq([
      '1 plant per plant tag',
      'Add 2 animals to a card',
      'Gain a Jovian tag',
      'Look at 4 cards, take up to 2',
      'Reuse a blue card action',
    ]);
    expect(chips[0].find('.hydro-reward__icon').classes()).to.include('resource_icon--plants');
    expect(chips[0].find('.hydro-reward__per').text()).to.eq('/');
    expect(chips[0].find('.hydro-reward__tag').classes()).to.include.members(['resource-tag', 'tag-plant']);
    expect(chips[1].find('.hydro-reward__amt').text()).to.eq('2');
    expect(chips[1].find('.hydro-reward__icon').classes()).to.include.members(['card-resource', 'card-resource-animal']);
    expect(chips[2].find('.hydro-reward__tag').classes()).to.include.members(['resource-tag', 'tag-jovian']);
    expect(chips[3].find('.hydro-reward__icon').classes()).to.include('resource_icon--cards');
    expect(chips[3].find('.hydro-reward__mini').text()).to.eq('4→2');
    expect(chips[4].find('.hydro-reward__glyph').text()).to.eq('↻');
  });

  it('`compact` keeps the glyphs and drops the labels — and follows the prop', async () => {
    const w = reward({chips: [{special: 'jovian-tag'}, {resource: Resource.STEEL, amount: 2}], compact: true});
    expect(w.classes()).to.deep.eq(['hydro-reward', 'hydro-reward--compact']);
    expect(w.find('.hydro-reward__label').exists()).to.eq(false);
    expect(w.find('.hydro-reward__tag.tag-jovian').exists()).to.eq(true);
    expect(w.find('.hydro-reward__amt').text()).to.eq('2');
    await w.setProps({compact: false});
    expect(w.classes()).to.deep.eq(['hydro-reward']);
    expect(w.find('.hydro-reward__label').text()).to.eq('Gain a Jovian tag');
  });
});
