import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import ConsoleProtectionMark from '@/client/components/console/ConsoleProtectionMark.vue';
import {RailProtectionKind} from '@/client/console/railProtectionModel';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/*
 * THE PROTECTION MARK — the printed shield pinned to a guarded stock. What this spec owns: the three states differ
 * by MATERIAL (a check · «½» · a fill to the waist — never one glyph in three tints), the sentence is the aria, and
 * a mount is a one-shot settle that ends by itself (a wait of the flow kernel — the spec drives the kernel's clock).
 */
function mountMark(kind: RailProtectionKind, label = 'Protected: opponents cannot remove it') {
  return mount(ConsoleProtectionMark, {...globalConfig, props: {kind, label}});
}

describe('ConsoleProtectionMark — the shield on a guarded stock', () => {
  let clock: ManualFlowClock;
  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });

  it('a full shield: the engraved check, the sentence as its aria', () => {
    const mark = mountMark('full');
    expect(mark.classes()).to.include.members(['con-shieldmark', 'con-shieldmark--full']);
    expect(mark.attributes('role')).to.eq('img');
    expect(mark.attributes('aria-label')).to.eq('Protected: opponents cannot remove it');
    expect(mark.find('.con-shieldmark__check').exists()).to.eq(true);
    expect(mark.find('.con-shieldmark__half').exists()).to.eq(false);
    expect(mark.find('.con-shieldmark__fill').exists()).to.eq(false);
  });

  it('a halved effect reads «½», a partly shielded stock a fill to the waist — neither wears the check', () => {
    const half = mountMark('half');
    expect(half.classes()).to.include('con-shieldmark--half');
    expect(half.find('.con-shieldmark__half').text()).to.eq('½');
    expect(half.find('.con-shieldmark__check').exists()).to.eq(false);
    const partial = mountMark('partial');
    expect(partial.classes()).to.include('con-shieldmark--partial');
    expect(partial.find('.con-shieldmark__fill').exists()).to.eq(true);
    expect(partial.find('.con-shieldmark__check').exists()).to.eq(false);
    expect(partial.find('.con-shieldmark__half').exists()).to.eq(false);
  });

  it('a mount is a one-shot settle: the mark enters, and the settle ends on its own', async () => {
    const mark = mountMark('full');
    await nextTick();
    expect(mark.classes(), 'entering from the mount').to.include('con-shieldmark--enter');
    clock.advance(consoleMotionMs(460));
    await nextTick();
    expect(mark.classes(), 'settled').to.not.include('con-shieldmark--enter');
  });
});
