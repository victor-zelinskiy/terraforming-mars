import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {expect} from 'chai';
import {$t} from '@/client/directives/i18n';
import {ConversionPromptVm, ConversionSideVm} from '@/client/console/conversionPromptModel';
import ConsoleAmountOperation from '@/client/components/console/foundation/ConsoleAmountOperation.vue';

function side(over: Partial<ConversionSideVm>): ConversionSideVm {
  return {icon: 'energy', labelKey: 'Energy', production: false, current: 5, after: 3, delta: -2, ...over};
}

/** «2 energy → 2 heat», dialed to `value` (0 = the calm preview). */
function vm(value: number, over: Partial<ConversionPromptVm> = {}): ConversionPromptVm {
  return {
    kind: 'conversion',
    headlineKey: undefined,
    from: side({after: 5 - value, delta: -value}),
    to: side({icon: 'heat', labelKey: 'Heat', current: 1, after: 1 + value, delta: value}),
    neutral: value === 0,
    binary: false,
    min: 0,
    max: 5,
    value,
    ...over,
  };
}

function operation(props: Record<string, unknown>) {
  return mount(ConsoleAmountOperation, {...globalConfig, props: {...props}});
}

describe('ConsoleAmountOperation — the two sides of an amount operation', () => {
  it('a dialed value: both sides as `current → after` with their signed deltas', () => {
    const w = operation({vm: vm(2)});
    expect(w.classes()).to.contain('con-convert__preview');
    expect(w.classes()).to.not.contain('con-convert__preview--neutral');
    expect(w.classes()).to.not.contain('con-convert__preview--inrow');
    const from = w.find('.con-convert__row--from');
    expect(from.find('i.con-convert__res').classes()).to.include.members(['resource_icon', 'resource_icon--energy']);
    expect(from.find('.con-convert__name').text()).to.eq($t('Energy'));
    expect(from.find('.con-convert__scope').exists(), 'a stock side wears no production mark').to.eq(false);
    expect([from.find('.con-convert__cur').text(), from.find('.con-convert__aft').text()]).to.deep.eq(['5', '3']);
    expect(from.find('.con-convert__delta--spend').text()).to.eq('-2');
    expect(from.find('.con-convert__delta').classes()).to.not.contain('con-convert__delta--none');
    const to = w.find('.con-convert__row--to');
    expect(to.find('i.con-convert__res').classes()).to.include.members(['resource_icon', 'resource_icon--heat']);
    expect(to.find('.con-convert__name').text()).to.eq($t('Heat'));
    expect([to.find('.con-convert__cur').text(), to.find('.con-convert__aft--gain').text()]).to.deep.eq(['1', '3']);
    expect(to.find('.con-convert__delta--gain').text()).to.eq('+2');
    // The caption line is RESERVED (the standalone prompt never jumps) and blank while something changes.
    expect(w.find('.con-convert__note').exists()).to.eq(true);
    expect(w.find('.con-convert__note').text()).to.eq('');
  });

  it('value 0 stays CALM: the neutral class, the delta slots kept in layout, an honest «No changes»', () => {
    const w = operation({vm: vm(0)});
    expect(w.classes()).to.contain('con-convert__preview--neutral');
    expect(w.findAll('.con-convert__delta').map((d) => d.classes().includes('con-convert__delta--none'))).to.deep.eq([true, true]);
    expect(w.find('.con-convert__note').text()).to.eq($t('No changes'));
  });

  it('`compact` is the composer row: the in-row class and no reserved caption line', () => {
    const w = operation({vm: vm(0), compact: true});
    expect(w.classes()).to.include.members(['con-convert__preview--neutral', 'con-convert__preview--inrow']);
    expect(w.find('.con-convert__note').exists()).to.eq(false);
  });

  it('a production side says so; a side with no honest figure or name keeps only its icon and delta', () => {
    const w = operation({vm: vm(1, {
      from: side({icon: 'floater', labelKey: '', current: undefined, after: undefined, delta: -1}),
      to: side({icon: 'megacredits', labelKey: 'M€', production: true, current: 2, after: 3, delta: 1}),
    })});
    const from = w.find('.con-convert__row--from');
    expect(from.find('.con-convert__name').exists()).to.eq(false);
    expect(from.find('.con-convert__figures').exists()).to.eq(false);
    expect(from.find('.con-convert__delta--spend').text()).to.eq('-1');
    const to = w.find('.con-convert__row--to');
    expect(to.find('.con-convert__scope').text()).to.eq($t('Production rate'));
    expect(to.find('.con-convert__figures').exists()).to.eq(true);
  });
});
