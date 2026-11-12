/*
 * ConsolePlayedEventsPile — the face-down pile of played events. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): a leaf with no children, no emits and nothing exposed — its contract is what it
 * renders for its props (the hero scene and the category view read its classes and its box).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import ConsolePlayedEventsPile from '@/client/components/console/played/ConsolePlayedEventsPile.vue';

const BASE = {count: 1, focused: false, slotW: 120, cardH: 168};

function pile(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
  return mount(ConsolePlayedEventsPile as any, {...globalConfig, props: {...BASE, ...props}, attrs});
}

/** The offset backs on the stack, top one last — `--3`, `--2`, `--1`. */
const backs = (w: ReturnType<typeof pile>): Array<string | undefined> =>
  w.findAll('.con-played__backstack > .con-card-back.con-played__back').map((b) => b.classes().find((c) => c.startsWith('con-played__back--')));

describe('ConsolePlayedEventsPile — the face-down events pile', () => {
  it('one stack of sleeves with the count on it, in the box its host solved', () => {
    const w = pile({count: 1});
    expect(w.classes()).to.include.members(['con-played__pile', 'con-played__pile--events']);
    expect((w.element as HTMLElement).style.width).to.eq('120px');
    const slot = w.find('.con-played__slot.con-played__slot--events');
    expect((slot.element as HTMLElement).style.height).to.eq('168px');
    const stack = w.find('.con-played__lift > .con-played__backstack.con-played__focusbox');
    expect((stack.element as HTMLElement).style.height).to.eq('168px');
    expect(stack.find('.con-played__events-count').text()).to.eq('1');
    expect(backs(w)).to.deep.eq(['con-played__back--1']);
  });

  it('a physical thickness of up to three backs — and it follows the count', async () => {
    const w = pile({count: 2});
    expect(backs(w)).to.deep.eq(['con-played__back--2', 'con-played__back--1']);
    await w.setProps({count: 7});
    expect(backs(w)).to.deep.eq(['con-played__back--3', 'con-played__back--2', 'con-played__back--1']);
    expect(w.find('.con-played__events-count').text()).to.eq('7');
  });

  it('focused, lifted out and reserved are classes of the slot and the pile — off by default', async () => {
    const w = pile();
    const slot = w.find('.con-played__slot');
    expect(slot.classes()).to.not.include('con-played__slot--focused');
    expect(slot.classes()).to.not.include('con-played__slot--events-out');
    expect(w.classes()).to.not.include('con-played__pile--reserved');

    await w.setProps({focused: true, out: true, reserved: true});
    expect(slot.classes()).to.include.members(['con-played__slot--focused', 'con-played__slot--events-out']);
    expect(w.classes()).to.include('con-played__pile--reserved');
  });

  it('the template STARTS WITH ITS ROOT — what a host lets fall through lands on the pile', () => {
    const w = pile({}, {'class': 'from-host', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-played__pile', 'from-host']);
    expect(w.attributes('data-from-host')).to.eq('yes');
  });
});
