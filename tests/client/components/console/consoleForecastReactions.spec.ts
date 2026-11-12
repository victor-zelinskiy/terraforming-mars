import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleForecastReactions from '@/client/components/console/ConsoleForecastReactions.vue';
import {forecastChipRailRow, VariantReaction, VariantReactionChip} from '@/client/console/effectForecastModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';

/*
 * THE «⚡ сработает» GROUP of an «ИЛИ» option card — what the table adds if THIS branch is chosen. What this spec
 * owns: the group is absent while the branch wakes nothing, every chip wears its vocabulary (own / asked / another
 * seat's / a loss / production), an own guaranteed chip names the rail row its answer is born on, and the fold
 * reads «+N». The chip itself is the shared `ActionEffectChip` — stubbed here, it has its own specs.
 */
const ChipStub = defineComponent({
  name: 'ActionEffectChip',
  props: {effect: {type: Object, required: true}},
  render: () => h('i', {class: 'chip-stub'}),
});

const GAIN: ActionEffect = {direction: 'gain', icon: 'megacredits', amount: 2};
const LOSS: ActionEffect = {direction: 'cost', icon: 'plants', amount: 1};

function chip(over: Partial<VariantReactionChip> = {}): VariantReactionChip {
  return {key: 'megacredits', effect: GAIN, production: false, asks: false, facts: 1, ...over};
}

function mountGroup(reaction: VariantReaction) {
  return mount(ConsoleForecastReactions, {
    global: {...globalConfig.global, stubs: {ActionEffectChip: ChipStub}},
    props: {reaction},
  });
}

describe('ConsoleForecastReactions — the «⚡ сработает» group of an option card', () => {
  it('renders nothing while the branch wakes nothing', () => {
    const group = mountGroup({chips: [], more: 0, total: 0});
    expect(group.find('[data-forecast-vfx]').exists()).to.equal(false);
  });

  it('an own guaranteed chip: the caption, the aria total, the rail row its answer is born on, the bare delta handed on', () => {
    const group = mountGroup({chips: [chip()], more: 0, total: 1});
    const root = group.find('[data-forecast-vfx]');
    expect(root.classes()).to.include('con-forecast__vfx');
    expect(root.attributes('role')).to.equal('note');
    expect(root.attributes('aria-label')).to.equal('Will trigger: 1');
    expect(root.find('.con-forecast__vfx-label').text()).to.equal('Will trigger');
    const chips = group.findAll('[data-forecast-vchip]');
    expect(chips.length).to.equal(1);
    expect(chips[0].classes()).to.include.members(['con-forecast__chip', 'con-forecast__vfx-chip', 'con-forecast__chip--own']);
    expect(chips[0].classes()).to.not.include('con-forecast__chip--other');
    expect(chips[0].attributes('data-forecast-rail'), 'the row the model itself names').to.equal(forecastChipRailRow(GAIN, false));
    expect(chips[0].find('.con-forecast__owner-dot').exists(), 'an own chip carries no owner mark').to.equal(false);
    expect(chips[0].find('.con-forecast__ask').exists()).to.equal(false);
    expect(group.findComponent(ChipStub).props('effect')).to.deep.equal(GAIN);
    expect(group.find('.con-forecast__vfx-more').exists(), 'nothing folded').to.equal(false);
  });

  it('another seat\'s chip wears its owner; an asked one its «?»; a loss and a production plate their tones — none names a rail row', () => {
    const group = mountGroup({
      chips: [
        chip({key: 'blue|plants', effect: LOSS, color: 'blue', bot: true}),
        chip({key: 'ask|megacredits', asks: true, production: true}),
      ],
      more: 0,
      total: 2,
    });
    const [other, asked] = group.findAll('.con-forecast__vfx-chip');
    expect(other.classes()).to.include.members(['con-forecast__chip--other', 'con-forecast__chip--bot', 'con-forecast__chip--loss']);
    expect(other.classes()).to.not.include('con-forecast__chip--own');
    expect(other.find('.con-forecast__owner-bar').classes()).to.include('player_bg_color_blue');
    expect(other.find('.con-forecast__owner-dot').classes()).to.include('player_bg_color_blue');
    expect(other.attributes('data-forecast-rail')).to.equal(undefined);
    expect(asked.classes()).to.include.members(['con-forecast__chip--asks', 'con-forecast__chip--production']);
    expect(asked.classes()).to.not.include('con-forecast__chip--own');
    expect(asked.find('.con-forecast__ask').text()).to.equal('?');
    expect(asked.attributes('data-forecast-rail')).to.equal(undefined);
  });

  it('the fold alone still stands the group and reads «+N»', () => {
    const group = mountGroup({chips: [], more: 3, total: 3});
    expect(group.find('[data-forecast-vfx]').exists()).to.equal(true);
    expect(group.findAll('.con-forecast__vfx-chip').length).to.equal(0);
    const more = group.find('.con-forecast__vfx-more');
    expect(more.text()).to.equal('+3');
    expect(more.attributes('data-forecast-vchip')).to.equal('');
  });
});
