/*
 * ConsoleValueBadge — the value badge pinned to a rail icon's corner (an M€-rate coin, a tag's VP shield). A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its props, and its one
 * micro-behaviour — a figure that changes for the SAME displayed seat pulses once and the pulse ends by itself (a wait
 * of the flow kernel: the spec drives the kernel's clock), while a change of seat never pulses. It emits nothing and
 * exposes nothing. (Its host's readings are `ConsoleResourcePanel.spec.ts`'s.)
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import ConsoleValueBadge from '@/client/components/console/ConsoleValueBadge.vue';

/** One frame of the kernel's clock — the re-arm frame where the environment has frames at all. */
const FRAME_MS = 16;

function badge(props: {variant: 'mc' | 'vp', text: string, label: string, wide?: boolean, scopeKey?: string}) {
  return mount(ConsoleValueBadge, {...globalConfig, props});
}

describe('ConsoleValueBadge — the value badge on a rail icon', () => {
  let clock: ManualFlowClock;
  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });

  it('the M€ coin: the figure, the sentence as its aria, no shield — and the pill form when it is wide', async () => {
    const w = badge({variant: 'mc', text: '3', label: 'One steel replaces 3 M€'});
    expect(w.classes()).to.deep.eq(['con-valbadge', 'con-valbadge--mc']);
    expect(w.attributes('role')).to.eq('img');
    expect(w.attributes('aria-label')).to.eq('One steel replaces 3 M€');
    expect(w.find('.con-valbadge__text').text()).to.eq('3');
    expect(w.find('.con-valbadge__shield').exists(), 'the coin is the stylesheet\'s — only the VP badge draws a shield').to.eq(false);

    await w.setProps({text: '3/2', wide: true});
    expect(w.classes()).to.include.members(['con-valbadge', 'con-valbadge--mc', 'con-valbadge--wide']);
    expect(w.find('.con-valbadge__text').text()).to.eq('3/2');
  });

  it('the VP shield: the award silhouette behind the figure, hidden from the reader', () => {
    const w = badge({variant: 'vp', text: '½', label: 'Each Venus tag earns ½ VP'});
    expect(w.classes()).to.deep.eq(['con-valbadge', 'con-valbadge--vp']);
    const shield = w.find('svg.con-valbadge__shield');
    expect(shield.exists()).to.eq(true);
    expect(shield.attributes('aria-hidden')).to.eq('true');
    expect(shield.findAll('path').length).to.eq(4);
    expect(w.find('.con-valbadge__text').text()).to.eq('½');
    expect(w.attributes('aria-label')).to.eq('Each Venus tag earns ½ VP');
  });

  it('a figure that changes for the SAME seat pulses once — the mount never does, and the pulse ends by itself', async () => {
    const w = badge({variant: 'mc', text: '2', label: 'One steel replaces 2 M€', scopeKey: 'red'});
    await nextTick();
    expect(w.classes(), 'a mount is silent').to.not.include('con-valbadge--pulse');

    await w.setProps({text: '3'});
    clock.advance(FRAME_MS);
    await nextTick();
    expect(w.classes(), 'the value moved inside one scope').to.include('con-valbadge--pulse');

    clock.advance(consoleMotionMs(420));
    await nextTick();
    expect(w.classes(), 'a one-shot: it ends on its own').to.not.include('con-valbadge--pulse');
    expect(clock.pending(), 'nothing of the pulse is left on the clock').to.eq(0);
  });

  it('another seat\'s figure is a change of context — never a pulse', async () => {
    const w = badge({variant: 'mc', text: '2', label: 'One steel replaces 2 M€', scopeKey: 'red'});
    await w.setProps({text: '3', scopeKey: 'blue'});
    clock.advance(FRAME_MS);
    await nextTick();
    expect(w.find('.con-valbadge__text').text()).to.eq('3');
    expect(w.classes()).to.not.include('con-valbadge--pulse');
    expect(clock.pending(), 'no pulse was armed').to.eq(0);
  });
});
