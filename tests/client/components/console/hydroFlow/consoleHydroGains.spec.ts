/*
 * ConsoleHydroGains — «ВЫ ПОЛУЧИТЕ», the ONE outcome block of the Hydronetwork. A `<script setup>` component (step A
 * of docs/claude/vapor/RECIPES.md). Three honest shapes decided by the DATA — an unresolved choice, resolved lines,
 * abstract chips — plus the movement's passive half («Дополнительно»), each number the server's.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import ConsoleHydroGains from '@/client/components/console/hydroFlow/ConsoleHydroGains.vue';
import {CardName} from '@/common/cards/CardName';
import {Resource} from '@/common/Resource';
import {$t} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {HydroRewardView} from '@/client/components/hydronetwork/hydroReward';
import {HydroRewardChip} from '@/client/components/hydronetwork/hydroStages';
import type {DeltaMovementBonusProjection} from '@/common/models/DeltaTrackPreviewModel';

// The chip row is `HydroReward`'s own subject; this spec reads what the block HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const RewardStub = defineComponent({
  name: 'HydroReward',
  props: {chips: Array, compact: Boolean},
  render: () => h('i', {class: 'reward-stub'}),
});

const NOTHING: HydroRewardView = {lines: [], rawChips: [], needsChoiceFirst: false};

type GainsProps = {
  view?: HydroRewardView,
  options?: ReadonlyArray<ReadonlyArray<HydroRewardChip>>,
  label?: string,
  extras?: ReadonlyArray<DeltaMovementBonusProjection>,
  compact?: boolean,
};

function gains(props: GainsProps) {
  return mount(ConsoleHydroGains, {
    ...globalConfig,
    props: {view: NOTHING, ...props},
    global: {...globalConfig.global, stubs: {HydroReward: RewardStub}},
  });
}

describe('ConsoleHydroGains — the Hydronetwork\'s one outcome block', () => {
  it('an UNRESOLVED choice shows both alternatives as the track prints them — never a concrete delta', () => {
    const steel: ReadonlyArray<HydroRewardChip> = [{resource: Resource.STEEL, amount: 2}];
    const plants: ReadonlyArray<HydroRewardChip> = [{resource: Resource.PLANTS, amount: 2}];
    const w = gains({view: {...NOTHING, needsChoiceFirst: true}, options: [steel, plants]});
    expect(w.classes()).to.contain('con-hydro__gains');
    expect(w.find('.con-hydro__section-label').text(), 'the default label').to.eq($t('You will gain'));
    const choice = w.find('.con-hydro__gains-choice');
    expect(choice.find('.con-hydro__stop-or').text()).to.eq($t('or'));
    expect(choice.findAllComponents(RewardStub).map((r: {props(): unknown}) => r.props())).to.deep.eq([
      {chips: steel, compact: true},
      {chips: plants, compact: true},
    ]);
    expect(w.find('.con-hydro__delta').exists()).to.eq(false);
    expect(w.find('.con-hydro__gains-extra').exists(), 'no passive half owed').to.eq(false);
  });

  it('resolved lines read before → after: a +N chip for a gain, the quiet word for an honest zero, the icon by kind', () => {
    const view: HydroRewardView = {
      lines: [
        {resource: Resource.STEEL, before: 3, after: 5, delta: 2},
        {resource: Resource.HEAT, production: true, before: 1, after: 1, delta: 0},
        {special: 'jovian-tag', before: 0, after: 1, delta: 1},
        {special: 'animals', before: 1, after: 3, delta: 2},
      ],
      rawChips: [{resource: Resource.STEEL, amount: 2}],
      vp: 2,
      needsChoiceFirst: false,
    };
    // A single alternative is a FIXED reward — not a choice.
    const w = gains({view, label: 'Reward', options: [[{resource: Resource.STEEL, amount: 2}]]});
    expect(w.find('.con-hydro__section-label').text()).to.eq($t('Reward'));
    expect(w.find('.con-hydro__gains-choice').exists()).to.eq(false);
    const lines = w.findAll('.con-hydro__delta');
    expect(lines.map((l) => l.find('.con-hydro__beforeafter').text())).to.deep.eq(['3 → 5', '1 → 1', '0 → 1', '1 → 3']);
    expect(lines.map((l) => l.find('.con-hydro__plus').exists() ? l.find('.con-hydro__plus').text() : '')).to.deep.eq(['+2', '', '+1', '+2']);
    expect(lines.map((l) => l.classes().includes('con-hydro__delta--zero'))).to.deep.eq([false, true, false, false]);
    expect(lines[1].find('.con-hydro__zero').text()).to.eq($t('No change'));
    expect(lines.map((l) => l.find('.con-hydro__delta-ico').classes().includes('con-hydro__delta-ico--prod'))).to.deep.eq([false, true, false, false]);
    expect(lines[0].find('.con-hydro__delta-img').classes()).to.include.members(iconClassFor(Resource.STEEL).split(' '));
    expect(lines[2].find('.con-hydro__delta-img').classes()).to.include.members(['resource-tag', 'tag-jovian']);
    expect(lines[3].find('.con-hydro__delta-img').classes()).to.include.members(['card-resource', 'card-resource-animal']);
    expect(w.find('.con-hydro__vpline .con-hydro__stage-vp').text()).to.eq(`2 ${$t('VP')}`);
    expect(w.findComponent(RewardStub).exists(), 'concrete lines stand — the abstract chips do not').to.eq(false);
  });

  it('with no concrete line the abstract chips stand — at the density the host asked for', () => {
    const rawChips: ReadonlyArray<HydroRewardChip> = [{special: 'draw-4-keep-2'}];
    const w = gains({view: {...NOTHING, rawChips}, compact: true});
    expect(w.findAllComponents(RewardStub).map((r) => r.props())).to.deep.eq([{chips: rawChips, compact: true}]);
    expect(w.find('.con-hydro__delta').exists()).to.eq(false);
    expect(w.find('.con-hydro__vpline').exists()).to.eq(false);
  });

  it('«Дополнительно» — a card\'s passive movement bonus is a secondary group naming its SOURCE', () => {
    const extras: ReadonlyArray<DeltaMovementBonusProjection> = [{card: CardName.BIRDS, resource: Resource.HEAT, amount: 2, before: 4, after: 6}];
    const w = gains({extras});
    const group = w.find('.con-hydro__gains-extra');
    expect(group.find('.con-hydro__section-label--extra').text()).to.eq($t('Additionally'));
    const rows = group.findAll('.con-hydro__extra');
    expect(rows).has.length(1);
    expect(rows[0].find('.con-hydro__extra-src').text()).to.eq($t(CardName.BIRDS));
    expect(rows[0].find('.con-hydro__beforeafter').text()).to.eq('4 → 6');
    expect(rows[0].find('.con-hydro__plus').text()).to.eq('+2');
    expect(rows[0].find('.con-hydro__delta-img').classes()).to.include.members(iconClassFor(Resource.HEAT).split(' '));
  });
});
